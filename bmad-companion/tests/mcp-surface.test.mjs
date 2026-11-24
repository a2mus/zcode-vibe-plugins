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
