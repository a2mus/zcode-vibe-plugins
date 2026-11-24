import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
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
