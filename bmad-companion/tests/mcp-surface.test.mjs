import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, symlinkSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  containsBmadJargon,
  inspectWorkspaceArtifact,
  openNewConversationWithPrompt,
  openWorkspaceArtifactExternally,
  prepareNewSession,
  resolveWorkspaceArtifactPath,
  runCommandAsync,
  savePersistedState,
  stripBmadJargon
} from "../scripts/bmad-engine.mjs";
import {
  PANEL_HTML_PATH,
  assertStrictJsonRpcStdout,
  createTempWorkspaceTracker,
  runMcpServer
} from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

// SM-1 / C2: every recommendation is `/bmad-<skill> "<contextual prompt>"`.
const CONTEXTUAL_PROMPT_RE = /^\/bmad-[a-z0-9-]+\s+".+"$/;

const SCAN_RESULT_KEYS = [
  "scannedAt",
  "workspaceRoot",
  "projectName",
  "techStack",
  "availableModels",
  "providerState",
  "git",
  "taskQueue",
  "metrics",
  "turnAnalysis",
  "recommendations",
  "smartInsights",
  "phases",
  "artifacts",
  "initiatives",
  "epics",
  "skillsCatalog",
  "agentsCatalog"
];

const METRIC_KEYS = [
  "totalEpics",
  "completedEpics",
  "totalStories",
  "declaredDoneStories",
  "smartDoneStories",
  "reviewStories",
  "inProgressStories",
  "backlogStories",
  "reconciledStoriesCount",
  "declaredOverallPct",
  "smartOverallPct"
];

// The isolated test HOME has no provider_config.json, so seed a live host
// catalog in persisted state; otherwise every model is the `host-default`
// placeholder with an empty modelId.
const HOST_MODELS = [
  {
    id: "test/claude-sonnet-5-5-high",
    modelId: "claude-sonnet-5-5-high",
    providerId: "test",
    providerLabel: "Test Provider",
    current: true
  },
  {
    id: "test/gemini-4-argon-high",
    modelId: "gemini-4-argon-high",
    providerId: "test",
    providerLabel: "Test Provider"
  }
];

function seedSurfaceWorkspace() {
  const ws = workspaces.seed();
  ws.write(
    ".zcode/bmad-companion/state.json",
    JSON.stringify({ hostModels: HOST_MODELS }, null, 2)
  );
  return ws;
}

function toolCall(id, name, args = {}) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

function assertContextualRecommendation(rec, knownModelIds) {
  assert.match(rec.fullCommand, CONTEXTUAL_PROMPT_RE, `recommendation ${rec.id} fullCommand`);
  assert.ok(rec.fullCommand.startsWith(`${rec.skill} `), "fullCommand starts with its skill");
  assert.ok(rec.recommendedModel, `recommendation ${rec.id} has a recommendedModel`);
  const modelId = rec.recommendedModel.modelId;
  assert.match(modelId, /^[^/]+\/.+$/, `recommendation ${rec.id} modelId is providerId/modelId`);
  assert.ok(knownModelIds.has(modelId), `${modelId} is one of the available models`);
  // AD-8 / RD-9 (Epic 7 sweep): every recommendation also carries plain Work copy.
  assert.ok(typeof rec.plainTitle === "string" && rec.plainTitle.trim().length > 0, `recommendation ${rec.id} plainTitle`);
  assert.ok(typeof rec.plainSummary === "string" && rec.plainSummary.trim().length > 0, `recommendation ${rec.id} plainSummary`);
  assert.ok(!containsBmadJargon(rec.plainTitle), `recommendation ${rec.id} plainTitle jargon-free`);
  assert.ok(!containsBmadJargon(rec.plainSummary), `recommendation ${rec.id} plainSummary jargon-free`);
}

function assertScanResultShape(scan, workspaceRoot) {
  for (const key of SCAN_RESULT_KEYS) {
    assert.ok(key in scan, `ScanResult is missing "${key}"`);
  }
  assert.equal(scan.workspaceRoot, workspaceRoot);
  assert.ok(!Number.isNaN(Date.parse(scan.scannedAt)));

  for (const key of METRIC_KEYS) {
    assert.equal(typeof scan.metrics[key], "number", `metrics.${key}`);
  }
  assert.equal(scan.metrics.totalStories, 2);
  assert.equal(scan.metrics.smartDoneStories, 1);
  assert.equal(scan.metrics.smartOverallPct, 50);

  assert.deepEqual(
    scan.phases.map((p) => p.id),
    ["1-analysis", "2-planning", "3-solutioning", "4-implementation"]
  );
  assert.equal(scan.epics.length, 1);
  assert.equal(scan.epics[0].slug, "epic-core");
  assert.deepEqual(
    scan.epics[0].stories.map((s) => s.overrideKey),
    ["epic-core#1", "epic-core#2"]
  );

  assert.ok(Array.isArray(scan.artifacts) && scan.artifacts.length >= 4);
  assert.ok(scan.artifacts.every((a) => typeof a.relPath === "string" && !a.relPath.includes("\\")));

  assert.equal(scan.taskQueue.status, "idle");
  assert.deepEqual(scan.taskQueue.items, []);

  assert.deepEqual(
    scan.availableModels.map((m) => m.id).sort(),
    HOST_MODELS.map((m) => m.id).sort()
  );

  // AD-18 (Epic 7 sweep): currentFocus closed schema on every scan shape.
  const focus = scan.turnAnalysis.currentFocus;
  assert.ok(focus && typeof focus === "object", "turnAnalysis.currentFocus present");
  assert.equal(focus.basisLabel, "Current focus");
  assert.ok(
    ["advisor-override", "stop-synthesis", "deterministic"].includes(focus.source),
    `currentFocus.source closed enum, got ${focus.source}`
  );
  assert.ok(
    Number.isInteger(focus.conversationCount) && focus.conversationCount >= 0 && focus.conversationCount <= 3,
    "currentFocus.conversationCount honest 0..3"
  );
  assert.ok(typeof focus.text === "string" && focus.text.trim().length > 0);
  assert.ok(!containsBmadJargon(focus.text), "currentFocus.text jargon-free");
}

describe("bmad-companion read-only tool contract tracer", () => {
  it("returns the full ScanResult from bmad_open_companion and bmad_get_state with Markdown content", async () => {
    const ws = seedSurfaceWorkspace();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_open_companion"),
        toolCall(2, "bmad_get_state", { refresh: true })
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 2);

    for (const frame of res.responses) {
      assert.ok(!frame.result.isError, "tool call must not flag isError");
      assert.equal(frame.result.content[0].type, "text");
      assert.match(frame.result.content[0].text, /^# BMAD Companion — /);
      assertScanResultShape(frame.result.structuredContent, ws.root);
    }

    const [opened, state] = res.responses.map((f) => f.result.structuredContent);
    assert.deepEqual(Object.keys(opened).sort(), Object.keys(state).sort());
    assert.deepEqual(opened.metrics, state.metrics);
    assert.deepEqual(opened.epics, state.epics);
  });

  it("keeps every ScanResult recommendation a contextual /bmad-<skill> prompt with a providerId/modelId pair", async () => {
    const ws = seedSurfaceWorkspace();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_open_companion"),
        toolCall(2, "bmad_get_state"),
        toolCall(3, "bmad_recommend_next", { topic: "ux" }),
        toolCall(4, "bmad_recommend_next")
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 4);

    const knownModelIds = new Set(HOST_MODELS.map((m) => m.id));
    let checked = 0;
    for (const frame of res.responses) {
      const { recommendations } = frame.result.structuredContent;
      assert.ok(recommendations.length >= 1, "at least one recommendation per tool");
      assert.ok(recommendations.length <= 7, "OQ-D: up to 7 recommendations");
      for (const rec of recommendations) {
        assertContextualRecommendation(rec, knownModelIds);
        checked += 1;
      }
    }
    assert.ok(checked >= 4);

    // The skills catalog commands carry the same contract.
    const { skillsCatalog } = res.responses[1].result.structuredContent;
    assert.ok(skillsCatalog.length > 0);
    for (const skill of skillsCatalog) {
      assert.match(skill.contextualCommand, CONTEXTUAL_PROMPT_RE);
      assert.ok(knownModelIds.has(skill.recommendedModel.modelId));
    }
  });

  it("returns the shipped { recommendations, matchingSkills } shape from bmad_recommend_next, filtered by topic", async () => {
    const ws = seedSurfaceWorkspace();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_recommend_next"),
        toolCall(2, "bmad_recommend_next", { topic: "retrospective" }),
        toolCall(3, "bmad_recommend_next", { topic: "zz-no-such-topic-zz" })
      ]
    });

    assertStrictJsonRpcStdout(res);
    const [all, filtered, none] = res.responses.map((f) => f.result);

    for (const result of [all, filtered, none]) {
      // OQ-B: the shipped shape, not the older `{ topic, recommendations, availableModels }`.
      assert.deepEqual(Object.keys(result.structuredContent).sort(), [
        "matchingSkills",
        "recommendations"
      ]);
      assert.match(result.content[0].text, /^# Contextual BMAD Skill \+ Prompt \+ Model Suggestions/);
    }

    assert.ok(all.structuredContent.matchingSkills.length > 0);
    assert.ok(all.structuredContent.matchingSkills.length <= 12, "OQ-D: up to 12 matchingSkills");

    assert.ok(filtered.structuredContent.matchingSkills.length > 0);
    for (const s of filtered.structuredContent.matchingSkills) {
      assert.ok(
        [s.skill, s.displayName, s.description, s.phase].some((v) =>
          v.toLowerCase().includes("retrospective")
        ),
        `${s.skill} does not match the topic`
      );
    }

    assert.deepEqual(none.structuredContent.matchingSkills, []);
  });

  it("persists focus via bmad_open_companion without any other write and keeps get_state read-only", async () => {
    const ws = seedSurfaceWorkspace();
    const before = ws.read(".zcode/bmad-companion/state.json");

    const readOnly = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [toolCall(1, "bmad_get_state", { refresh: true })]
    });
    assertStrictJsonRpcStdout(readOnly);
    assert.equal(ws.read(".zcode/bmad-companion/state.json"), before, "get_state must not rewrite state.json");

    const focused = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [toolCall(1, "bmad_open_companion", { focus: "harden the MCP surface" })]
    });
    assertStrictJsonRpcStdout(focused);

    const persisted = JSON.parse(ws.read(".zcode/bmad-companion/state.json"));
    assert.equal(persisted.lastUserPrompt, "harden the MCP surface");
    assert.ok(!Number.isNaN(Date.parse(persisted.lastUserPromptAt)));
    assert.deepEqual(persisted.hostModels, HOST_MODELS, "focus write preserves the seeded host catalog");
  });

  it("serves the three tools after an initialize that echoes the client protocolVersion (OQ-A)", async () => {
    const ws = seedSurfaceWorkspace();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2026-01-26", capabilities: {}, clientInfo: { name: "tracer", version: "1.0.0" } }
        },
        toolCall(2, "bmad_open_companion"),
        toolCall(3, "bmad_get_state"),
        toolCall(4, "bmad_recommend_next")
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.deepEqual(res.responses.map((r) => r.id), [1, 2, 3, 4]);
    assert.equal(res.responses[0].result.protocolVersion, "2026-01-26");
    for (const frame of res.responses.slice(1)) {
      assert.ok(frame.result.structuredContent);
      assert.ok(!frame.error);
    }
  });
});

function writeDiskProviderConfig(ws, providerConfig) {
  ws.write(".test-home/.zcode/v2/provider_config.json", JSON.stringify(providerConfig, null, 2));
}

describe("bmad_update_advisor contract (Epic 2 Story 2)", () => {
  it("merges headline, turnSummary, and recommendations across partial updates without clobbering omitted fields", async () => {
    const ws = seedSurfaceWorkspace();
    const rec1 = {
      skill: "/bmad-code-review",
      fullCommand: '/bmad-code-review "Audit Story 2.2 advisor merge semantics"',
      title: "Review Advisor Merge",
      rationale: "Verify merged fields survive partial updates.",
      recommendedModel: "test/claude-sonnet-5-5-high",
      modelReason: "Balanced code review model.",
      phase: "4-implementation",
      priority: "high"
    };
    const rec2 = {
      skill: "/bmad-ux",
      fullCommand: '/bmad-ux "Audit panel advisor headline rendering"',
      title: "Refine Advisor Headline UI",
      rationale: "Ensure updated headline fits cleanly in the panel header.",
      recommendedModel: "test/gemini-4-argon-high",
      phase: "2-planning",
      priority: "medium"
    };

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_update_advisor", {
          headline: "Initial advisor headline",
          turnSummary: "First turn completed cleanly.",
          recommendations: [rec1]
        }),
        toolCall(2, "bmad_update_advisor", {
          turnSummary: "Second turn refined summary only."
        }),
        toolCall(3, "bmad_update_advisor", {
          headline: "Third turn updated headline",
          recommendations: [rec2]
        }),
        toolCall(4, "bmad_update_advisor", {
          storyStatusUpdates: [
            { overrideKey: "epic-core#2", status: "review", reason: "Ready for review" }
          ]
        })
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 4);

    const [r1, r2, r3, r4] = res.responses.map((f) => f.result);
    for (const r of [r1, r2, r3, r4]) {
      assert.ok(!r.isError);
      assert.match(r.content[0].text, /^Updated BMAD Companion advisor state\.\n\n# BMAD Companion — /);
    }

    assert.equal(r1.structuredContent.turnAnalysis.aiSummaryHeadline, "Initial advisor headline");
    assert.equal(r1.structuredContent.turnAnalysis.lastAssistantSummary, "First turn completed cleanly.");
    assert.equal(r1.structuredContent.recommendations[0].fullCommand, rec1.fullCommand);
    assert.equal(r1.structuredContent.recommendations[0].badge, "AI Turn Synthesis");
    assert.equal(r1.structuredContent.recommendations[0].recommendedModel.modelId, rec1.recommendedModel);

    // Call 2 updated turnSummary only — headline and recommendations must survive.
    assert.equal(r2.structuredContent.turnAnalysis.aiSummaryHeadline, "Initial advisor headline");
    assert.equal(r2.structuredContent.turnAnalysis.lastAssistantSummary, "Second turn refined summary only.");
    assert.equal(r2.structuredContent.recommendations[0].fullCommand, rec1.fullCommand);

    // Call 3 updated headline + recommendations — turnSummary must survive.
    assert.equal(r3.structuredContent.turnAnalysis.aiSummaryHeadline, "Third turn updated headline");
    assert.equal(r3.structuredContent.turnAnalysis.lastAssistantSummary, "Second turn refined summary only.");
    assert.equal(r3.structuredContent.recommendations[0].fullCommand, rec2.fullCommand);

    // Call 4 sent storyStatusUpdates only — all three advisor override fields must survive.
    assert.equal(r4.structuredContent.turnAnalysis.aiSummaryHeadline, "Third turn updated headline");
    assert.equal(r4.structuredContent.turnAnalysis.lastAssistantSummary, "Second turn refined summary only.");
    assert.equal(r4.structuredContent.recommendations[0].fullCommand, rec2.fullCommand);

    const persisted = JSON.parse(ws.read(".zcode/bmad-companion/state.json"));
    assert.equal(persisted.agentAdvisorOverride.headline, "Third turn updated headline");
    assert.equal(persisted.agentAdvisorOverride.turnSummary, "Second turn refined summary only.");
    assert.equal(persisted.agentAdvisorOverride.recommendations.length, 1);
    assert.equal(persisted.agentAdvisorOverride.recommendations[0].fullCommand, rec2.fullCommand);
    assert.ok(!Number.isNaN(Date.parse(persisted.agentAdvisorOverride.updatedAt)));
    assert.ok(!Number.isNaN(Date.parse(persisted.lastTurnAnalyzedAt)));
    assert.ok(!Number.isNaN(Date.parse(persisted.updatedAt)));
  });

  it("overrides disk provider_config.json with live hostModels[] and merges partial updates", async () => {
    const ws = workspaces.seed();
    writeDiskProviderConfig(ws, {
      config: {
        providerOrder: ["disk-prov"],
        providerConfigRules: {
          providerRules: [
            {
              providerId: "disk-prov",
              providerName: "Disk Provider",
              enabled: true,
              config: {
                enabled: true,
                group: "custom-provider",
                access: { type: "api-key", apiKey: "sk-disk-fixture" },
                modelOrder: ["claude-sonnet-5-5-high", "legacy-disk-model", "kept-disk-model"]
              }
            }
          ]
        },
        modelConfigRules: {
          providerModelRules: [
            {
              providerId: "disk-prov",
              modelId: "claude-sonnet-5-5-high",
              config: {
                enabled: true,
                properties: { contextWindow: 64000 },
                optionSpecs: { reasoningLevel: { values: ["disabled", "enabled"] } }
              }
            }
          ]
        }
      }
    });

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_get_state"),
        toolCall(2, "bmad_update_advisor", {
          hostModels: [
            {
              id: "disk-prov/claude-sonnet-5-5-high",
              providerId: "disk-prov",
              modelId: "claude-sonnet-5-5-high",
              providerLabel: "Live Disk Override",
              contextWindow: 256000,
              reasoningLevels: ["low", "high", "xhigh"],
              defaultReasoningLevel: "high",
              current: true
            },
            {
              id: "disk-prov/legacy-disk-model",
              providerId: "disk-prov",
              modelId: "legacy-disk-model",
              disabledReason: "disabled in ListModels"
            },
            {
              providerId: "live-prov",
              modelId: "gemini-4-argon-high",
              providerLabel: "Live Runtime",
              contextWindow: 1000000
            }
          ]
        }),
        toolCall(3, "bmad_update_advisor", {
          hostModels: [
            {
              id: "live-prov/gemini-4-argon-high",
              providerLabel: "Live Runtime Refined"
            }
          ]
        })
      ]
    });

    assertStrictJsonRpcStdout(res);
    const [beforeScan, afterSync, afterPartial] = res.responses.map((f) => f.result.structuredContent);

    // Before live sync: models come strictly from disk provider_config.json.
    assert.equal(beforeScan.providerState.syncedFromRuntime, false);
    const diskSonnetBefore = beforeScan.availableModels.find((m) => m.id === "disk-prov/claude-sonnet-5-5-high");
    assert.ok(diskSonnetBefore);
    assert.equal(diskSonnetBefore.contextWindow, 64000);
    assert.equal(diskSonnetBefore.providerName, "Disk Provider");
    assert.ok(beforeScan.availableModels.some((m) => m.id === "disk-prov/legacy-disk-model"));

    // After live hostModels sync: live overrides disk metadata, removes explicitly disabled disk models,
    // adds new runtime models, and preserves unrelated disk models.
    assert.equal(afterSync.providerState.syncedFromRuntime, true);
    const syncedSonnet = afterSync.availableModels.find((m) => m.id === "disk-prov/claude-sonnet-5-5-high");
    assert.ok(syncedSonnet);
    assert.equal(syncedSonnet.contextWindow, 256000);
    assert.equal(syncedSonnet.providerName, "Live Disk Override");
    assert.deepEqual(syncedSonnet.reasoningLevels, ["low", "high", "xhigh"]);
    assert.equal(syncedSonnet.defaultReasoningLevel, "high");
    assert.equal(syncedSonnet.current, true);

    assert.equal(
      afterSync.availableModels.some((m) => m.id === "disk-prov/legacy-disk-model"),
      false,
      "disabledReason in live hostModels must override disk enablement"
    );
    assert.equal(
      afterSync.availableModels.some((m) => m.id === "disk-prov/kept-disk-model"),
      true,
      "partial hostModels update must not hide unrelated disk models"
    );
    const liveArgon = afterSync.availableModels.find((m) => m.id === "live-prov/gemini-4-argon-high");
    assert.ok(liveArgon, "entry with providerId+modelId without id must normalize and register");
    assert.equal(liveArgon.providerName, "Live Runtime");
    assert.equal(liveArgon.contextWindow, 1000000);

    const knownIds = new Set(afterSync.availableModels.map((m) => m.id));
    for (const rec of afterSync.recommendations) {
      assertContextualRecommendation(rec, knownIds);
    }

    // After smaller partial follow-up: stored catalog merges by id rather than dropping previous entries.
    const refinedArgon = afterPartial.availableModels.find((m) => m.id === "live-prov/gemini-4-argon-high");
    assert.equal(refinedArgon.providerName, "Live Runtime Refined");
    assert.equal(
      afterPartial.availableModels.find((m) => m.id === "disk-prov/claude-sonnet-5-5-high").contextWindow,
      256000
    );
    const persisted = JSON.parse(ws.read(".zcode/bmad-companion/state.json"));
    assert.equal(persisted.hostModels.length, 3);
    assert.deepEqual(
      persisted.hostModels.map((m) => m.id).sort(),
      [
        "disk-prov/claude-sonnet-5-5-high",
        "disk-prov/legacy-disk-model",
        "live-prov/gemini-4-argon-high"
      ]
    );
  });

  it("persists storyStatusUpdates[] keyed <epic-slug>#<story-num> via savePersistedState across v7 and v6 workspaces", async () => {
    // 1. BMAD v7 workspace: accumulate overrides across calls, ignore malformed keys/statuses.
    const v7 = seedSurfaceWorkspace();
    const v7Res = await runMcpServer({
      workspaceRoot: v7.root,
      requests: [
        toolCall(1, "bmad_update_advisor", {
          storyStatusUpdates: [
            {
              overrideKey: "epic-core#2",
              status: "done",
              reason: "Verified via Story 2.2 test gate"
            },
            {
              overrideKey: "malformed-without-hash",
              status: "done",
              reason: "Should be ignored"
            },
            {
              overrideKey: "epic-core#99",
              status: "invalid-status",
              reason: "Should be ignored"
            }
          ]
        }),
        toolCall(2, "bmad_update_advisor", {
          storyStatusUpdates: [
            {
              overrideKey: "epic-core#1",
              status: "review",
              reason: "Re-opened for code review"
            }
          ]
        }),
        toolCall(3, "bmad_get_state")
      ]
    });

    assertStrictJsonRpcStdout(v7Res);
    const [u1, u2, stateAfter] = v7Res.responses.map((f) => f.result.structuredContent);

    assert.equal(u1.metrics.smartDoneStories, 2);
    assert.equal(u1.metrics.smartOverallPct, 100);
    const story2AfterFirst = u1.epics[0].stories.find((s) => s.overrideKey === "epic-core#2");
    assert.equal(story2AfterFirst.smartStatus, "done");
    assert.equal(story2AfterFirst.smartEvidence, "Verified via Story 2.2 test gate");
    assert.equal(story2AfterFirst.aiReconciled, true);

    // Second update must preserve epic-core#2 while adding epic-core#1 (C4 key-level merge).
    const persistedV7 = JSON.parse(v7.read(".zcode/bmad-companion/state.json"));
    assert.deepEqual(Object.keys(persistedV7.storyOverrides).sort(), ["epic-core#1", "epic-core#2"]);
    assert.equal(persistedV7.storyOverrides["epic-core#2"].status, "done");
    assert.equal(persistedV7.storyOverrides["epic-core#1"].status, "review");
    assert.ok(!Number.isNaN(Date.parse(persistedV7.storyOverrides["epic-core#2"].updatedAt)));

    assert.equal(u2.metrics.smartDoneStories, 1);
    assert.equal(u2.metrics.reviewStories, 1);
    assert.deepEqual(stateAfter.metrics, u2.metrics);

    // 2. BMAD v6-only workspace (sprint-status.yaml, no initiative-* directory).
    const v6 = workspaces.create();
    v6.write(
      "_bmad-output/implementation-artifacts/sprint-status.yaml",
      [
        "development_status:",
        "  epic-1: in-progress",
        "  1-1-alpha-story: done",
        "  1-2-beta-story: in-progress"
      ].join("\n") + "\n"
    );
    v6.write(
      ".zcode/bmad-companion/state.json",
      JSON.stringify({ hostModels: HOST_MODELS }, null, 2)
    );

    const v6Res = await runMcpServer({
      workspaceRoot: v6.root,
      requests: [
        toolCall(1, "bmad_update_advisor", {
          storyStatusUpdates: [
            {
              overrideKey: "epic-1#2",
              status: "done",
              reason: "v6 story override confirmed"
            }
          ]
        })
      ]
    });

    assertStrictJsonRpcStdout(v6Res);
    const v6Scan = v6Res.responses[0].result.structuredContent;
    assert.equal(v6Scan.metrics.totalStories, 2);
    assert.equal(v6Scan.metrics.smartDoneStories, 2);
    assert.equal(v6Scan.metrics.smartOverallPct, 100);
    const v6Story2 = v6Scan.epics[0].stories.find((s) => s.overrideKey === "epic-1#2");
    assert.equal(v6Story2.smartStatus, "done");
    assert.equal(v6Story2.smartEvidence, "v6 story override confirmed");
    assert.equal(v6Story2.aiReconciled, true);
  });

  it("enforces C2 contextual-prompt and providerId/modelId hygiene on advisor recommendations", async () => {
    const ws = seedSurfaceWorkspace();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_update_advisor", {
          recommendations: [
            {
              skill: "bmad-ux",
              fullCommand: "/bmad-ux",
              title: "Audit panel contrast tokens",
              rationale: "Tighten contrast across light and dark themes.",
              recommendedModel: "invalid-model-without-provider"
            }
          ]
        })
      ]
    });

    assertStrictJsonRpcStdout(res);
    const scan = res.responses[0].result.structuredContent;
    const knownModelIds = new Set(HOST_MODELS.map((m) => m.id));
    for (const rec of scan.recommendations) {
      assertContextualRecommendation(rec, knownModelIds);
    }
    assert.equal(scan.recommendations[0].skill, "/bmad-ux");
    assert.equal(scan.recommendations[0].fullCommand, '/bmad-ux "Audit panel contrast tokens"');
  });
});

describe("bmad_prepare_new_session & clean-session launch (Epic 2 Story 3)", () => {
  it("persists lastLaunchedSession via savePersistedState and guards empty prompts over MCP stdio", async () => {
    const ws = seedSurfaceWorkspace();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_prepare_new_session", {
          prompt: "   ",
          model: "test/claude-sonnet-5-5-high",
          skill: "/bmad-build",
          title: "Story 2.3"
        }),
        toolCall(2, "bmad_get_state")
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 2);
    const prep = res.responses[0].result;
    assert.ok(!prep.isError);
    assert.equal(prep.structuredContent.prompt, "   ");
    assert.equal(prep.structuredContent.model, "test/claude-sonnet-5-5-high");
    assert.equal(prep.structuredContent.skill, "/bmad-build");
    assert.equal(prep.structuredContent.title, "Story 2.3");
    assert.ok(!Number.isNaN(Date.parse(prep.structuredContent.requestedAt)));
    assert.equal(prep.structuredContent.copied, false);
    assert.equal(prep.structuredContent.openedDirectly, false);
    assert.equal(prep.structuredContent.pasted, false);
    assert.equal(prep.structuredContent.method, "none");
    assert.equal(prep.structuredContent.error, "empty_prompt");

    const persisted = JSON.parse(ws.read(".zcode/bmad-companion/state.json"));
    assert.equal(persisted.lastLaunchedSession.model, "test/claude-sonnet-5-5-high");
    assert.equal(persisted.lastLaunchedSession.skill, "/bmad-build");
    assert.equal(persisted.lastLaunchedSession.title, "Story 2.3");
    assert.equal(
      res.responses[1].result.structuredContent.turnAnalysis.lastLaunchedSession.requestedAt,
      prep.structuredContent.requestedAt
    );
  });

  it("persists lastLaunchedSession and executes win32 SendKeys ^n/^v with 8000ms timeout, clipboard fallback, and zero auto-submit", async () => {
    const ws = seedSurfaceWorkspace();
    const prompt = '/bmad-build "Implement Story 2.3 with ~ special {ENTER} chars"\nSecond line';
    const calls = [];

    const launched = await prepareNewSession(
      ws.root,
      {
        prompt,
        model: "test/claude-sonnet-5-5-high",
        skill: "/bmad-build",
        title: "Win32 Launch"
      },
      {
        platform: "win32",
        runCommand: async (command, args, opts) => {
          calls.push({ command, args, opts });
          return { ok: true, code: 0, timedOut: false, stdout: "BMAD_CLIPBOARD_OK\n", stderr: "" };
        }
      }
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "powershell.exe");
    assert.equal(calls[0].opts.timeoutMs, 8000);
    assert.equal(calls[0].opts.env.BMAD_OPEN_DIRECTLY, "1");
    assert.equal(
      Buffer.from(calls[0].opts.env.BMAD_PROMPT_B64, "base64").toString("utf8"),
      prompt
    );
    const psCmd = calls[0].args[calls[0].args.length - 1];
    assert.match(psCmd, /SendKeys\]::SendWait\('\^n'\)/);
    assert.match(psCmd, /SendKeys\]::SendWait\('\^v'\)/);
    assert.equal(/SendWait\(['"][^'"]*(?:\{ENTER\}|~)/i.test(psCmd), false, "must never auto-submit");

    assert.equal(launched.copied, true);
    assert.equal(launched.openedDirectly, true);
    assert.equal(launched.pasted, true);
    assert.equal(launched.method, "win32-sendkeys-ctrl-n-v");
    const persisted = JSON.parse(ws.read(".zcode/bmad-companion/state.json"));
    assert.equal(persisted.lastLaunchedSession.prompt, prompt);

    // openDirectly: false skips SendKeys while copying to clipboard.
    const clipOnlyCalls = [];
    const clipOnly = await openNewConversationWithPrompt(prompt, false, {
      platform: "win32",
      runCommand: async (command, args, opts) => {
        clipOnlyCalls.push({ command, args, opts });
        return { ok: true, code: 0, timedOut: false, stdout: "BMAD_CLIPBOARD_OK\n", stderr: "" };
      }
    });
    assert.equal(clipOnlyCalls[0].opts.env.BMAD_OPEN_DIRECTLY, "0");
    assert.deepEqual(clipOnly, {
      copied: true,
      openedDirectly: false,
      pasted: false,
      method: "win32-clipboard"
    });

    // SendKeys blocked after clipboard succeeded -> graceful clipboard-only fallback (copied: true).
    const blocked = await openNewConversationWithPrompt(prompt, true, {
      platform: "win32",
      runCommand: async () => ({
        ok: false,
        code: 2,
        timedOut: false,
        stdout: "BMAD_CLIPBOARD_OK\r\n",
        stderr: "SendKeys access denied\r\n"
      })
    });
    assert.deepEqual(blocked, {
      copied: true,
      openedDirectly: false,
      pasted: false,
      method: "win32-clipboard-only",
      error: "SendKeys access denied"
    });

    // Timeout after clipboard succeeded -> still preserves copied: true fallback.
    const timedOutAfterCopy = await openNewConversationWithPrompt(prompt, true, {
      platform: "win32",
      runCommand: async () => ({
        ok: false,
        code: null,
        timedOut: true,
        stdout: "BMAD_CLIPBOARD_OK\n",
        stderr: "timeout"
      })
    });
    assert.deepEqual(timedOutAfterCopy, {
      copied: true,
      openedDirectly: false,
      pasted: false,
      method: "win32-clipboard-only",
      error: "timeout"
    });

    // Clipboard failure before BMAD_CLIPBOARD_OK -> win32-failed.
    const failed = await openNewConversationWithPrompt(prompt, true, {
      platform: "win32",
      runCommand: async () => ({
        ok: false,
        code: 1,
        timedOut: false,
        stdout: "",
        stderr: "Clipboard unavailable"
      })
    });
    assert.deepEqual(failed, {
      copied: false,
      openedDirectly: false,
      pasted: false,
      method: "win32-failed",
      error: "Clipboard unavailable"
    });
  });

  it("handles darwin pbcopy + osascript automation, 3000/6000ms timeouts, fallback, and zero auto-submit", async () => {
    const prompt = '/bmad-ux "Audit Story 2.3 panel toast"';
    const calls = [];

    const okRes = await openNewConversationWithPrompt(prompt, true, {
      platform: "darwin",
      runCommand: async (command, args, opts) => {
        calls.push({ command, args, opts });
        return { ok: true, code: 0, timedOut: false, stdout: "", stderr: "" };
      }
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].command, "pbcopy");
    assert.equal(calls[0].opts.stdinText, prompt);
    assert.equal(calls[0].opts.timeoutMs, 3000);
    assert.equal(calls[1].command, "osascript");
    assert.equal(calls[1].opts.timeoutMs, 6000);
    const osaJoined = calls[1].args.join(" ");
    assert.match(osaJoined, /keystroke "n" using command down/);
    assert.match(osaJoined, /keystroke "v" using command down/);
    assert.equal(/keystroke return|key code 36/i.test(osaJoined), false, "must never auto-submit");
    assert.deepEqual(okRes, {
      copied: true,
      openedDirectly: true,
      pasted: true,
      method: "darwin-osascript-cmd-n-v"
    });

    // openDirectly: false -> pbcopy only.
    const clipOnlyCalls = [];
    const clipOnly = await openNewConversationWithPrompt(prompt, false, {
      platform: "darwin",
      runCommand: async (command, args, opts) => {
        clipOnlyCalls.push({ command, args, opts });
        return { ok: true, code: 0, timedOut: false, stdout: "", stderr: "" };
      }
    });
    assert.equal(clipOnlyCalls.length, 1);
    assert.deepEqual(clipOnly, {
      copied: true,
      openedDirectly: false,
      pasted: false,
      method: "darwin-clipboard"
    });

    // osascript blocked (Accessibility permission denied) -> clipboard-only fallback.
    const blocked = await openNewConversationWithPrompt(prompt, true, {
      platform: "darwin",
      runCommand: async (command) =>
        command === "pbcopy"
          ? { ok: true, code: 0, timedOut: false, stdout: "", stderr: "" }
          : { ok: false, code: 1, timedOut: false, stdout: "", stderr: "osascript is not allowed assistive access" }
    });
    assert.deepEqual(blocked, {
      copied: true,
      openedDirectly: false,
      pasted: false,
      method: "darwin-clipboard-only",
      error: "osascript is not allowed assistive access"
    });

    // pbcopy fails -> darwin-pbcopy-failed.
    const pbFailed = await openNewConversationWithPrompt(prompt, true, {
      platform: "darwin",
      runCommand: async () => ({ ok: false, code: 1, timedOut: false, stdout: "", stderr: "pbcopy error" })
    });
    assert.deepEqual(pbFailed, {
      copied: false,
      openedDirectly: false,
      pasted: false,
      method: "darwin-pbcopy-failed",
      error: "pbcopy error"
    });
  });

  it("handles linux wl-copy/xclip/xsel + xdotool fallback chain, 2500ms timeouts, and zero auto-submit", async () => {
    const prompt = '/bmad-code-review "Verify Linux clean-session launch"';
    const calls = [];
    const sleepCalls = [];

    // wl-copy missing, xclip succeeds, xdotool ctrl+n + ctrl+v succeed.
    const okRes = await openNewConversationWithPrompt(prompt, true, {
      platform: "linux",
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
      runCommand: async (command, args, opts) => {
        calls.push({ command, args, opts });
        if (command === "wl-copy") {
          return { ok: false, code: null, timedOut: false, stdout: "", stderr: "spawn wl-copy ENOENT" };
        }
        return { ok: true, code: 0, timedOut: false, stdout: "", stderr: "" };
      }
    });
    assert.deepEqual(
      calls.map((c) => [c.command, c.args, c.opts.timeoutMs]),
      [
        ["wl-copy", [], 2500],
        ["xclip", ["-selection", "clipboard"], 2500],
        ["xdotool", ["key", "--clearmodifiers", "ctrl+n"], 2500],
        ["xdotool", ["key", "--clearmodifiers", "ctrl+v"], 2500]
      ]
    );
    assert.deepEqual(sleepCalls, [500]);
    assert.equal(calls.some((c) => c.args.includes("Return")), false, "must never auto-submit");
    assert.deepEqual(okRes, {
      copied: true,
      openedDirectly: true,
      pasted: true,
      method: "linux-xdotool-ctrl-n-v"
    });

    // xsel fallback when wl-copy & xclip fail, with openDirectly: false.
    const xselCalls = [];
    const xselRes = await openNewConversationWithPrompt(prompt, false, {
      platform: "linux",
      runCommand: async (command, args, opts) => {
        xselCalls.push({ command, args, opts });
        if (command === "xsel") return { ok: true, code: 0, timedOut: false, stdout: "", stderr: "" };
        return { ok: false, code: 1, timedOut: false, stdout: "", stderr: "missing" };
      }
    });
    assert.deepEqual(
      xselCalls.map((c) => c.command),
      ["wl-copy", "xclip", "xsel"]
    );
    assert.deepEqual(xselRes, {
      copied: true,
      openedDirectly: false,
      pasted: false,
      method: "linux-clipboard"
    });

    // xdotool ctrl+n blocked -> linux-clipboard-only (copied: true).
    const blockedN = await openNewConversationWithPrompt(prompt, true, {
      platform: "linux",
      runCommand: async (command) =>
        command === "wl-copy"
          ? { ok: true, code: 0, timedOut: false, stdout: "", stderr: "" }
          : { ok: false, code: 1, timedOut: false, stdout: "", stderr: "xdotool unavailable" }
    });
    assert.deepEqual(blockedN, {
      copied: true,
      openedDirectly: false,
      pasted: false,
      method: "linux-clipboard-only",
      error: "xdotool unavailable"
    });

    // xdotool ctrl+v fails after ctrl+n succeeded -> linux-xdotool-ctrl-n-only with copied: true.
    const blockedV = await openNewConversationWithPrompt(prompt, true, {
      platform: "linux",
      sleep: async () => {},
      runCommand: async (command, args) => {
        if (command === "wl-copy") return { ok: true, code: 0, timedOut: false, stdout: "", stderr: "" };
        if (args.includes("ctrl+n")) return { ok: true, code: 0, timedOut: false, stdout: "", stderr: "" };
        return { ok: false, code: null, timedOut: true, stdout: "", stderr: "timeout" };
      }
    });
    assert.deepEqual(blockedV, {
      copied: true,
      openedDirectly: true,
      pasted: false,
      method: "linux-xdotool-ctrl-n-only",
      error: "timeout"
    });

    // No clipboard tool available -> linux-unsupported.
    const unsupported = await openNewConversationWithPrompt(prompt, true, {
      platform: "linux",
      runCommand: async () => ({ ok: false, code: null, timedOut: false, stdout: "", stderr: "ENOENT" })
    });
    assert.deepEqual(unsupported, {
      copied: false,
      openedDirectly: false,
      pasted: false,
      method: "linux-unsupported",
      error: "ENOENT"
    });
  });

  it("enforces hard child-process timeouts, retains partial stdout, and prevents EPIPE crashes in runCommandAsync", async () => {
    const start = Date.now();
    const timedOutRes = await runCommandAsync(
      process.execPath,
      ["-e", 'process.stdout.write("BMAD_CLIPBOARD_OK\\n"); setInterval(() => {}, 1000);'],
      { timeoutMs: 150 }
    );
    const elapsed = Date.now() - start;

    assert.equal(timedOutRes.ok, false);
    assert.equal(timedOutRes.timedOut, true);
    assert.equal(timedOutRes.code, null);
    assert.match(timedOutRes.stdout, /BMAD_CLIPBOARD_OK/);
    assert.equal(timedOutRes.stderr, "timeout");
    assert.ok(elapsed < 1500, `timeout cleanup took ${elapsed}ms, expected < 1500ms`);

    // Immediate exit while piping stdin must not emit an unhandled EPIPE crash.
    const epipeRes = await runCommandAsync(
      process.execPath,
      ["-e", "process.exit(1);"],
      { stdinText: "x".repeat(64 * 1024), timeoutMs: 2500 }
    );
    assert.equal(epipeRes.ok, false);
    assert.equal(epipeRes.timedOut, false);
    assert.equal(epipeRes.code, 1);
  });

  it("renders instructional clipboard fallback toast in assets/panel.html when keystrokes are blocked", () => {
    const panelHtml = readFileSync(PANEL_HTML_PATH, "utf8");
    assert.match(panelHtml, /callServerTool\("bmad_prepare_new_session",\s*\{[\s\S]*?openDirectly:\s*true/);
    assert.match(panelHtml, /if\s*\(status\.openedDirectly\s*&&\s*status\.pasted\)/);
    assert.match(panelHtml, /if\s*\(status\.copied\)[\s\S]*?Prompt copied! Press Ctrl\+N then Ctrl\+V/);
  });
});

describe("bmad_inspect_artifact & bmad_open_artifact_file confinement + git diff (Epic 2 Story 4)", () => {
  it("rejects .. traversal, absolute escapes, directories, empty paths, and symlink escapes under workspace confinement", async () => {
    const ws = seedSurfaceWorkspace();
    const outsideWs = workspaces.create();
    const outsideFile = outsideWs.write("outside-secret.md", "# Secret\nDo not leak\n");
    const escapeRel = relative(ws.root, outsideFile).replace(/\\/g, "/");
    const backslashEscape = escapeRel.replace(/\//g, "\\");
    const nestedEscape = `_bmad-output/../../${relative(resolve(ws.root, ".."), outsideFile).replace(/\\/g, "/")}`;

    const requests = [
      toolCall(1, "bmad_inspect_artifact", { relPath: escapeRel }),
      toolCall(2, "bmad_inspect_artifact", { relPath: backslashEscape }),
      toolCall(3, "bmad_inspect_artifact", { relPath: nestedEscape }),
      toolCall(4, "bmad_inspect_artifact", { relPath: outsideFile }),
      toolCall(5, "bmad_inspect_artifact", { relPath: "/etc/passwd" }),
      toolCall(6, "bmad_inspect_artifact", { relPath: "." }),
      toolCall(7, "bmad_inspect_artifact", { relPath: "_bmad-output" }),
      toolCall(8, "bmad_inspect_artifact", { relPath: "   " }),
      toolCall(9, "bmad_inspect_artifact", { relPath: "_bmad-output/missing.md" }),
      toolCall(10, "bmad_open_artifact_file", { relPath: escapeRel }),
      toolCall(11, "bmad_open_artifact_file", { relPath: "_bmad-output" }),
      toolCall(12, "bmad_open_artifact_file", { relPath: "_bmad-output/missing.md" })
    ];

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, requests.length);

    for (const frame of res.responses) {
      assert.equal(frame.result.isError, true, `request ${frame.id} must return isError: true`);
      assert.equal(frame.result.structuredContent, undefined);
    }

    const msg = (id) => res.responses.find((f) => f.id === id).result.content[0].text;
    for (const id of [1, 2, 3, 4, 5, 6, 10]) {
      assert.equal(msg(id), "Artifact path must stay within the workspace root.");
    }
    assert.equal(msg(7), "Artifact path must refer to a file: _bmad-output");
    assert.equal(msg(8), "Artifact path must be a non-empty workspace-relative path.");
    assert.equal(msg(9), "Artifact not found: _bmad-output/missing.md");
    assert.equal(msg(11), "Artifact path must refer to a file: _bmad-output");
    assert.equal(msg(12), "Artifact not found: _bmad-output/missing.md");

    // Verify null-byte and drive-relative rejections directly in resolveWorkspaceArtifactPath.
    assert.throws(() => resolveWorkspaceArtifactPath(ws.root, "docs/ok.md\0.txt"), /workspace root/);
    assert.throws(() => resolveWorkspaceArtifactPath(ws.root, "C:drive-relative.md"), /workspace root/);

    // Verify symlink escape rejection when OS privileges allow creating symlinks.
    let symlinkCreated = false;
    try {
      symlinkSync(outsideFile, ws.path("escape-link.md"));
      symlinkCreated = true;
    } catch {}
    if (symlinkCreated) {
      assert.throws(() => inspectWorkspaceArtifact(ws.root, "escape-link.md"), /workspace root/);
      assert.throws(
        () =>
          openWorkspaceArtifactExternally(ws.root, "escape-link.md", {
            platform: "linux",
            execFileSync: () => {
              throw new Error("must not execute");
            }
          }),
        /workspace root/
      );
    }
  });

  it("normalizes / paths and returns metadata, preview (with truncation), and live git diff over MCP stdio", async () => {
    const ws = seedSurfaceWorkspace();
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test Runner",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test Runner",
      GIT_COMMITTER_EMAIL: "test@example.com"
    };
    const runGit = (args) => execFileSync("git", ["-C", ws.root, ...args], { env: gitEnv, stdio: "pipe" });

    ws.write(
      "docs/guide.md",
      "---\ntitle: Confinement Guide\nstatus: draft\n---\n\n# Guide\nInitial line\n"
    );
    ws.write("docs/large.md", "A".repeat(13500));

    runGit(["init"]);
    runGit(["add", "docs/guide.md"]);
    runGit(["commit", "-m", "Add confinement guide"]);

    // 1. Clean committed file -> Last commit diff, backslash & ./ path normalization.
    const cleanRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_inspect_artifact", { relPath: ".\\docs//sub/../guide.md" }),
        toolCall(2, "bmad_inspect_artifact", { relPath: "docs\\large.md" })
      ]
    });

    assertStrictJsonRpcStdout(cleanRes);
    const cleanInfo = cleanRes.responses[0].result.structuredContent;
    assert.ok(!cleanRes.responses[0].result.isError);
    assert.equal(cleanInfo.relPath, "docs/guide.md");
    assert.equal(cleanInfo.name, "guide.md");
    assert.equal(typeof cleanInfo.size, "number");
    assert.equal(typeof cleanInfo.mtimeMs, "number");
    assert.ok(!Number.isNaN(Date.parse(cleanInfo.lastModifiedIso)));
    assert.deepEqual(cleanInfo.meta, { title: "Confinement Guide", status: "draft" });
    assert.equal(cleanInfo.diffSource, "Last commit diff (working tree is clean)");
    assert.match(cleanInfo.diff, /Add confinement guide/);
    assert.match(cleanInfo.diff, /\+Initial line/);
    assert.match(cleanInfo.preview, /# Guide\nInitial line/);
    assert.equal(cleanInfo.truncated, false);

    const largeInfo = cleanRes.responses[1].result.structuredContent;
    assert.equal(largeInfo.relPath, "docs/large.md");
    assert.equal(largeInfo.preview.length, 12000);
    assert.equal(largeInfo.truncated, true);
    assert.equal(largeInfo.diffSource, "Untracked / New Artifact Diff");
    assert.match(largeInfo.diff, /^\-\-\- \/dev\/null\n\+\+\+ b\/docs\/large\.md/);

    // 2. Modified committed file -> Working tree diff vs HEAD.
    ws.write(
      "docs/guide.md",
      "---\ntitle: Confinement Guide\nstatus: review\n---\n\n# Guide\nUpdated line\n"
    );

    const dirtyRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [toolCall(1, "bmad_inspect_artifact", { relPath: "docs/guide.md" })]
    });

    assertStrictJsonRpcStdout(dirtyRes);
    const dirtyInfo = dirtyRes.responses[0].result.structuredContent;
    assert.equal(dirtyInfo.diffSource, "Working tree diff vs HEAD");
    assert.match(dirtyInfo.diff, /-Initial line/);
    assert.match(dirtyInfo.diff, /\+Updated line/);
    assert.deepEqual(dirtyInfo.meta, { title: "Confinement Guide", status: "review" });
    assert.match(dirtyRes.responses[0].result.content[0].text, /^# Artifact: docs\/guide\.md/);
  });

  it("opens confined artifacts using platform-appropriate cmd /c start | open | xdg-open and rejects escapes before spawning", () => {
    const ws = seedSurfaceWorkspace();
    const expectedFull = ws.path("_bmad-output/planning-artifacts/prd-demo/prd-demo.md");
    const calls = [];
    const mockExec = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
    };

    // Traversal must reject before invoking any OS opener.
    assert.throws(
      () => openWorkspaceArtifactExternally(ws.root, "../outside.md", { platform: "win32", execFileSync: mockExec }),
      /workspace root/
    );
    assert.equal(calls.length, 0);

    // win32 -> cmd.exe /c start "" <fullPath>
    const winRes = openWorkspaceArtifactExternally(
      ws.root,
      "_bmad-output\\planning-artifacts\\prd-demo\\prd-demo.md",
      { platform: "win32", execFileSync: mockExec }
    );
    assert.deepEqual(winRes, {
      opened: true,
      relPath: "_bmad-output/planning-artifacts/prd-demo/prd-demo.md",
      fullPath: expectedFull,
      openMethod: "cmd /c start"
    });

    // darwin -> open <fullPath>
    const macRes = openWorkspaceArtifactExternally(
      ws.root,
      "./_bmad-output/planning-artifacts/prd-demo/prd-demo.md",
      { platform: "darwin", execFileSync: mockExec }
    );
    assert.deepEqual(macRes, {
      opened: true,
      relPath: "_bmad-output/planning-artifacts/prd-demo/prd-demo.md",
      fullPath: expectedFull,
      openMethod: "open"
    });

    // linux -> xdg-open <fullPath>
    const linuxRes = openWorkspaceArtifactExternally(
      ws.root,
      "_bmad-output/planning-artifacts/prd-demo/prd-demo.md",
      { platform: "linux", execFileSync: mockExec }
    );
    assert.deepEqual(linuxRes, {
      opened: true,
      relPath: "_bmad-output/planning-artifacts/prd-demo/prd-demo.md",
      fullPath: expectedFull,
      openMethod: "xdg-open"
    });

    assert.deepEqual(calls, [
      {
        cmd: "cmd.exe",
        args: ["/c", "start", "", expectedFull],
        opts: { timeout: 3000, windowsHide: true, stdio: "ignore" }
      },
      {
        cmd: "open",
        args: [expectedFull],
        opts: { timeout: 3000, stdio: "ignore" }
      },
      {
        cmd: "xdg-open",
        args: [expectedFull],
        opts: { timeout: 3000, stdio: "ignore" }
      }
    ]);

    // Graceful failure when the OS launcher fails.
    const failRes = openWorkspaceArtifactExternally(
      ws.root,
      "_bmad-output/planning-artifacts/prd-demo/prd-demo.md",
      {
        platform: "linux",
        execFileSync: () => {
          throw new Error("spawn xdg-open ENOENT");
        }
      }
    );
    assert.deepEqual(failRes, {
      opened: false,
      relPath: "_bmad-output/planning-artifacts/prd-demo/prd-demo.md",
      fullPath: expectedFull,
      openMethod: "xdg-open",
      error: "spawn xdg-open ENOENT"
    });
  });
});

describe("Epic 7: focus hero engine surface (AD-8 / AD-14 / AD-18)", () => {
  it("bmad_update_advisor exposes additive optional focusSummary/sessionId schema fields (AD-14)", async () => {
    const ws = seedSurfaceWorkspace();
    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [{ jsonrpc: "2.0", id: 1, method: "tools/list" }]
    });
    assertStrictJsonRpcStdout(res);
    const tools = res.responses[0].result.tools;
    const advisor = tools.find((t) => t.name === "bmad_update_advisor");
    assert.ok(advisor, "bmad_update_advisor must be listed");
    assert.equal(advisor.inputSchema.additionalProperties, false);
    assert.equal(advisor.inputSchema.properties.focusSummary.type, "string");
    assert.equal(advisor.inputSchema.properties.sessionId.type, "string");
    assert.ok(!advisor.inputSchema.required?.includes("focusSummary"), "focusSummary stays optional");
    assert.ok(!advisor.inputSchema.required?.includes("sessionId"), "sessionId stays optional");
    // Existing fields are untouched (additive-only change).
    for (const legacyField of ["headline", "turnSummary", "recommendations", "hostModels", "storyStatusUpdates"]) {
      assert.ok(advisor.inputSchema.properties[legacyField], `${legacyField} retained`);
    }
  });

  it("accepts focusSummary/sessionId, binds the override, upserts a conversation entry only with sessionId, and never creates fallback entries", async () => {
    const ws = seedSurfaceWorkspace();
    const focusText = "The settings page now saves changes instantly and confirms each update.";

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_update_advisor", { focusSummary: focusText, sessionId: "sess_mcp_1" }),
        toolCall(2, "bmad_update_advisor", { focusSummary: "A second plain focus sentence without any session binding." }),
        toolCall(3, "bmad_get_state")
      ]
    });
    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 3);
    for (const frame of res.responses) {
      assert.ok(!frame.result.isError, "additive advisor fields must be accepted");
    }

    const [withSession, withoutSession] = res.responses.map((f) => f.result.structuredContent);
    assert.equal(withSession.turnAnalysis.currentFocus.source, "advisor-override");
    assert.equal(withSession.turnAnalysis.currentFocus.text, focusText);
    assert.equal(withSession.turnAnalysis.currentFocus.basisLabel, "Current focus");
    assert.equal(withSession.turnAnalysis.currentFocus.conversationCount, 1);

    const persisted = JSON.parse(ws.read(".zcode/bmad-companion/state.json"));
    assert.equal(persisted.agentAdvisorOverride.focusSummary, "A second plain focus sentence without any session binding.");
    assert.equal(persisted.agentAdvisorOverride.focusSummarySource, "advisor-override");
    assert.equal(
      persisted.agentAdvisorOverride.focusSummarySessionId,
      null,
      "an unbound replacement focusSummary must not inherit the previous conversation binding"
    );
    assert.ok(!Number.isNaN(Date.parse(persisted.agentAdvisorOverride.updatedAt)));
    assert.equal(persisted.recentConversations.length, 1, "no sessionId -> zero new conversation entries");
    assert.equal(persisted.recentConversations[0].sessionId, "sess_mcp_1");

    // Without a session binding the fresh override still surfaces, count stays honest.
    assert.equal(withoutSession.turnAnalysis.currentFocus.source, "advisor-override");
    assert.equal(withoutSession.turnAnalysis.currentFocus.conversationCount, 1);
    assert.equal(res.responses[2].result.structuredContent.turnAnalysis.currentFocus.conversationCount, 1);
  });

  it("currentFocus keeps the closed source enum, honest 0..3 counts, and rejects jargon-laden overrides with a deterministic fallback", async () => {
    // Empty workspace: 0 conversations, deterministic ready-state text.
    const empty = workspaces.create();
    const emptyScan = (
      await runMcpServer({ workspaceRoot: empty.root, requests: [toolCall(1, "bmad_get_state")] })
    ).responses[0].result.structuredContent;
    const emptyFocus = emptyScan.turnAnalysis.currentFocus;
    assert.equal(emptyFocus.conversationCount, 0);
    assert.equal(emptyFocus.source, "deterministic");
    assert.equal(emptyFocus.basisLabel, "Current focus");
    assert.ok(emptyFocus.text.length > 0);
    assert.ok(!containsBmadJargon(emptyFocus.text));

    // Three recorded conversations: honest count 3, deterministic snippet synthesis.
    const seeded = workspaces.create();
    savePersistedState(seeded.root, {
      recentConversations: [
        { sessionId: "c1", promptSnippet: "first request", outcomeSnippet: "First result delivered.", completedAt: "2026-11-25T10:00:00.000Z" },
        { sessionId: "c2", promptSnippet: "second request", outcomeSnippet: "Second result delivered.", completedAt: "2026-11-25T11:00:00.000Z" },
        { sessionId: "c3", promptSnippet: "third request", outcomeSnippet: "Third result delivered.", completedAt: "2026-11-25T12:00:00.000Z" }
      ]
    });
    const seededScan = (
      await runMcpServer({ workspaceRoot: seeded.root, requests: [toolCall(1, "bmad_get_state")] })
    ).responses[0].result.structuredContent;
    assert.equal(seededScan.turnAnalysis.currentFocus.conversationCount, 3);
    assert.equal(seededScan.turnAnalysis.currentFocus.source, "deterministic");
    assert.ok(seededScan.turnAnalysis.currentFocus.text.includes("Third result delivered"));
    assert.ok(!containsBmadJargon(seededScan.turnAnalysis.currentFocus.text));

    // Jargon-laden advisor focusSummary: rejected at scan -> deterministic fallback.
    const jargon = workspaces.create();
    const jargonRes = await runMcpServer({
      workspaceRoot: jargon.root,
      requests: [
        toolCall(1, "bmad_update_advisor", {
          focusSummary: "Run /bmad-build in 4-implementation and reconcile sprint-status.yaml for epic-core#1.",
          sessionId: "sess_jargon"
        })
      ]
    });
    assertStrictJsonRpcStdout(jargonRes);
    const jargonFocus = jargonRes.responses[0].result.structuredContent.turnAnalysis.currentFocus;
    assert.equal(jargonFocus.source, "deterministic");
    assert.ok(!containsBmadJargon(jargonFocus.text));
    assert.ok(!/\/bmad-|4-implementation|sprint-status\.yaml|epic-core#1/.test(jargonFocus.text));

    // Shared jargon filter: detection + stripping on the canonical token families.
    for (const token of ["/bmad-ux", "bmad-build", "2-planning", "sprint-status.yaml", "tickets.toml", "epic-core#1"]) {
      assert.ok(containsBmadJargon(`before ${token} after`), `${token} detected as jargon`);
      assert.ok(!containsBmadJargon(stripBmadJargon(`before ${token} after`)), `${token} stripped`);
    }
    assert.ok(!containsBmadJargon("The checkout flow now validates payment details."));
  });

  it("every recommendation carries non-empty jargon-free plainTitle/plainSummary with original fields unchanged, and catalogs are retained", async () => {
    const assertPlainCopy = (scan) => {
      assert.ok(scan.recommendations.length >= 1);
      for (const rec of scan.recommendations) {
        assert.equal(typeof rec.plainTitle, "string");
        assert.equal(typeof rec.plainSummary, "string");
        assert.ok(rec.plainTitle.trim().length > 0, `plainTitle non-empty for ${rec.id}`);
        assert.ok(rec.plainSummary.trim().length > 0, `plainSummary non-empty for ${rec.id}`);
        assert.ok(!containsBmadJargon(rec.plainTitle), `plainTitle jargon-free for ${rec.id}: ${rec.plainTitle}`);
        assert.ok(!containsBmadJargon(rec.plainSummary), `plainSummary jargon-free for ${rec.id}: ${rec.plainSummary}`);
        // AD-14: original recommendation fields stay present and untouched.
        assert.ok(rec.title && rec.rationale && rec.skill && rec.phase);
      }
      // AD-14: catalogs remain in bmad_get_state structuredContent.
      assert.ok(Array.isArray(scan.skillsCatalog) && scan.skillsCatalog.length > 0);
      assert.ok(Array.isArray(scan.agentsCatalog) && scan.agentsCatalog.length > 0);
    };

    // 1. Onboarding (empty workspace) recommendations.
    const empty = workspaces.create();
    const emptyRes = await runMcpServer({ workspaceRoot: empty.root, requests: [toolCall(1, "bmad_get_state")] });
    assertStrictJsonRpcStdout(emptyRes);
    assertPlainCopy(emptyRes.responses[0].result.structuredContent);

    // 2. Active epic workspace + AI-override recommendations.
    const ws = seedSurfaceWorkspace();
    const overrideRec = {
      skill: "/bmad-code-review",
      fullCommand: '/bmad-code-review "Review the focus hero engine changes"',
      title: "Review Focus Hero Engine",
      rationale: "Verify jargon filtering and freshness gates.",
      recommendedModel: "test/claude-sonnet-5-5-high",
      phase: "4-implementation",
      priority: "high"
    };
    const activeRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_get_state"),
        toolCall(2, "bmad_update_advisor", { recommendations: [overrideRec] }),
        toolCall(3, "bmad_recommend_next")
      ]
    });
    assertStrictJsonRpcStdout(activeRes);
    assertPlainCopy(activeRes.responses[0].result.structuredContent);
    const overrideScan = activeRes.responses[1].result.structuredContent;
    assertPlainCopy(overrideScan);
    const aiRec = overrideScan.recommendations.find((r) => r.badge === "AI Turn Synthesis");
    assert.ok(aiRec, "AI override recommendation present");
    assert.equal(aiRec.title, overrideRec.title);
    assert.equal(aiRec.rationale, overrideRec.rationale);
    assert.equal(aiRec.skill, overrideRec.skill);
    assert.equal(aiRec.phase, overrideRec.phase);
    assert.ok(aiRec.plainTitle.length > 0 && aiRec.plainSummary.length > 0);
    // recommend_next recommendations carry the same plain copy.
    for (const rec of activeRes.responses[2].result.structuredContent.recommendations) {
      assert.ok(rec.plainTitle && rec.plainSummary);
      assert.ok(!containsBmadJargon(rec.plainTitle) && !containsBmadJargon(rec.plainSummary));
    }
  });

  it("currentFocus.text caps at the first two sentences on both override and deterministic paths", async () => {
    // Override path: a 3-sentence focusSummary keeps only the first two.
    const ws = workspaces.create();
    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_update_advisor", {
          focusSummary: "First plain sentence. Second plain sentence. Third plain sentence."
        })
      ]
    });
    assertStrictJsonRpcStdout(res);
    const overrideFocus = res.responses[0].result.structuredContent.turnAnalysis.currentFocus;
    assert.equal(overrideFocus.source, "advisor-override");
    assert.equal(overrideFocus.text, "First plain sentence. Second plain sentence.");

    // Deterministic path: a multi-sentence outcome plus the "You asked:"
    // sentence must also cap at two sentences total.
    const det = workspaces.create();
    savePersistedState(det.root, {
      recentConversations: [
        {
          sessionId: "det-1",
          promptSnippet: "what changed",
          outcomeSnippet: "Alpha done. Beta done. Gamma done.",
          completedAt: "2026-11-25T12:00:00.000Z"
        }
      ]
    });
    const detRes = await runMcpServer({ workspaceRoot: det.root, requests: [toolCall(1, "bmad_get_state")] });
    assertStrictJsonRpcStdout(detRes);
    const detFocus = detRes.responses[0].result.structuredContent.turnAnalysis.currentFocus;
    assert.equal(detFocus.source, "deterministic");
    assert.equal(detFocus.text, "Alpha done. Beta done.");
  });

  it("plain copy drops whole jargon sentences and filename parentheticals, keeping grammatical remainders", async () => {
    const FILENAME_PAREN_RE = /\([^)]*\.(?:md|toml|ya?ml|json)\b[^)]*\)/i;
    const ws = seedSurfaceWorkspace();

    // The two cited rationale sources, verbatim, through the same addRec funnel.
    const uxRationale =
      "Your recent activity relates to UI/UX components. Use /bmad-ux with a concrete prompt to evolve DESIGN.md and EXPERIENCE.md alongside the UI views.";
    const remediationRationale =
      "Smart AI scan detected 3 test failure(s) in report-test-suite.md. BMAD quality gate requires 100% passing tests before completing stories or reconciling trackers.";
    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_update_advisor", {
          recommendations: [
            {
              skill: "/bmad-ux",
              fullCommand: '/bmad-ux "Enhance the UI/UX design of the application"',
              title: "Refine & Synchronize UX Design Specifications",
              rationale: uxRationale,
              phase: "2-planning",
              priority: "high"
            },
            {
              skill: "/bmad-build",
              fullCommand: '/bmad-build "Remediate 3 failing test(s) reported in report-test-suite.md"',
              title: "Remediate Test Failures: 3 failing test(s) in report-test-suite.md",
              rationale: remediationRationale,
              phase: "4-implementation",
              priority: "high"
            }
          ]
        })
      ]
    });
    assertStrictJsonRpcStdout(res);
    const recs = res.responses[0].result.structuredContent.recommendations;

    const uxRec = recs.find((r) => r.rationale === uxRationale);
    assert.ok(uxRec);
    assert.equal(uxRec.plainSummary, "Your recent activity relates to UI/UX components.");
    assert.ok(!uxRec.plainSummary.includes("Use with a concrete prompt"), "no mid-sentence stripping fragment");
    assert.ok(!uxRec.plainSummary.includes("DESIGN.md"));

    const remRec = recs.find((r) => r.rationale === remediationRationale);
    assert.ok(remRec);
    assert.equal(remRec.plainSummary, "Smart AI scan detected 3 test failure(s) in report-test-suite.md.");
    assert.ok(!remRec.plainSummary.includes("quality gate requires"), "jargon sentence dropped whole, not mid-stripped");

    // Onboarding title parentheticals with artifact filenames are dropped.
    const empty = workspaces.create();
    const onboardingRes = await runMcpServer({ workspaceRoot: empty.root, requests: [toolCall(1, "bmad_get_state")] });
    assertStrictJsonRpcStdout(onboardingRes);
    const onboardingRecs = onboardingRes.responses[0].result.structuredContent.recommendations;
    const contextRec = onboardingRecs.find((r) => r.title === "Initialize Repository Agent Context (AGENTS.md)");
    assert.ok(contextRec);
    assert.equal(contextRec.plainTitle, "Initialize Repository Agent Context");

    // No plain copy anywhere carries a filename parenthetical.
    for (const rec of [...recs, ...onboardingRecs]) {
      assert.ok(!FILENAME_PAREN_RE.test(rec.plainTitle), `plainTitle filename parenthetical: ${rec.plainTitle}`);
      assert.ok(!FILENAME_PAREN_RE.test(rec.plainSummary), `plainSummary filename parenthetical: ${rec.plainSummary}`);
    }
  });
});
