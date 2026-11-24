import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { savePersistedState } from "../scripts/debrief-engine.mjs";
import {
  checkVersionSync,
  collectVersionDeclarations,
  compareVersionDeclarations
} from "../scripts/check-version-sync.mjs";
import {
  PANEL_HTML_PATH,
  REPO_ROOT,
  buildDebriefFixture,
  createTempFixture,
  readJsonFile,
  runHookRunner,
  runMcpServer,
  runNodeProcess
} from "./helpers.mjs";

const PANEL_URI = "ui://vibe-debrief/panel.html";
const PANEL_MIME = "text/html;profile=mcp-app";
const PROTOCOL_VERSION = "2025-11-25";

const EXPECTED_TOOL_NAMES = [
  "vibe_debrief_confirm_lesson",
  "vibe_debrief_export_html",
  "vibe_debrief_generate_explainer",
  "vibe_debrief_get_state",
  "vibe_debrief_open",
  "vibe_debrief_publish",
  "vibe_debrief_set_persona",
  "vibe_debrief_toggle_check"
];

// ---------------------------------------------------------------------------
// Protocol assertions
//
// R3/C2: MCP stdout carries JSON-RPC frames only. Every non-empty stdout line
// must parse as JSON, declare jsonrpc 2.0, and carry exactly one of result or
// error. Hook stdout carries exactly one JSON line per lifecycle run.
// ---------------------------------------------------------------------------

function protocolLines(result, label) {
  assert.equal(result.exitCode, 0, `${label} must exit 0 (stderr: ${result.stderr})`);
  assert.equal(result.stderr, "", `${label} must keep stderr clean`);
  const stdout = String(result.stdout ?? "");
  assert.ok(stdout.length > 0, `${label} must write protocol output`);
  assert.ok(stdout.endsWith("\n"), `${label} must end with a newline`);
  assert.equal(stdout.includes("\r"), false, `${label} must not emit CRLF line endings`);

  const lines = stdout.slice(0, -1).split("\n");
  for (const [index, line] of lines.entries()) {
    assert.notEqual(
      line.trim(),
      "",
      `${label} line ${index + 1} is blank non-protocol output`
    );
  }
  return lines;
}

function assertValidJsonRpcFrame(frame, label, index) {
  assert.equal(typeof frame, "object", `${label} frame ${index + 1} must be an object`);
  assert.notEqual(frame, null, `${label} frame ${index + 1} must not be null`);
  assert.equal(
    frame.jsonrpc,
    "2.0",
    `${label} frame ${index + 1} must declare jsonrpc 2.0: ${JSON.stringify(frame)}`
  );
  assert.ok(
    Object.hasOwn(frame, "id"),
    `${label} frame ${index + 1} must carry the request id`
  );

  const hasResult = Object.hasOwn(frame, "result");
  const hasError = Object.hasOwn(frame, "error");
  assert.equal(
    hasResult || hasError,
    true,
    `${label} frame ${index + 1} must carry result or error`
  );
  assert.equal(
    hasResult && hasError,
    false,
    `${label} frame ${index + 1} must not carry both result and error`
  );
  if (hasError) {
    assert.equal(typeof frame.error.code, "number", `${label} error frame needs a numeric code`);
    assert.equal(typeof frame.error.message, "string", `${label} error frame needs a message`);
  }
}

function parseMcpFrames(result, label) {
  return protocolLines(result, label).map((line, index) => {
    let frame;
    try {
      frame = JSON.parse(line);
    } catch {
      assert.fail(`${label} line ${index + 1} is not valid JSON: ${JSON.stringify(line)}`);
    }
    assertValidJsonRpcFrame(frame, label, index);
    return frame;
  });
}

function parseHookFrame(result, mode) {
  const label = `hook ${mode}`;
  const lines = protocolLines(result, label);
  assert.equal(lines.length, 1, `${label} must emit exactly one stdout line, got ${lines.length}`);

  let frame;
  try {
    frame = JSON.parse(lines[0]);
  } catch {
    assert.fail(`${label} line is not valid JSON: ${JSON.stringify(lines[0])}`);
  }
  assert.equal(Array.isArray(frame), false, `${label} must emit a JSON object`);
  assert.notEqual(frame, null, `${label} must emit a JSON object`);

  // Hook protocol frames carry `additionalContext` or nothing. Anything else
  // means transport or debug data leaked into stdout.
  for (const key of Object.keys(frame)) {
    assert.equal(key, "additionalContext", `${label} emitted non-protocol key "${key}"`);
  }
  if (Object.hasOwn(frame, "additionalContext")) {
    assert.equal(
      typeof frame.additionalContext,
      "string",
      `${label} additionalContext must be a string`
    );
  }
  return frame;
}

function mcpEnv(workspace, home, extra = {}) {
  return {
    ...home.env,
    ZCODE_WORKSPACE_ROOT: workspace.root,
    ZCODE_PROJECT_DIR: workspace.root,
    ...extra
  };
}

/**
 * Spawn one fresh MCP server process, call one tool, and return its tool result.
 * A fresh process per call keeps assertions deterministic and proves the
 * round-trip survives a real stdio handshake.
 */
async function callTool(name, args, { workspace, home, env = {} } = {}) {
  const result = await runMcpServer({
    messages: [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args }
      }
    ],
    cwd: workspace.root,
    env: mcpEnv(workspace, home, env)
  });

  const frames = parseMcpFrames(result, `MCP tools/call ${name}`);
  assert.equal(frames.length, 1, `tools/call ${name} must answer with exactly one frame`);
  assert.equal(frames[0].id, 1);
  assert.equal(
    frames[0].result?.isError,
    undefined,
    `tools/call ${name} returned a tool error: ${JSON.stringify(frames[0].result)}`
  );
  return frames[0].result;
}

/** Create a workspace + home pair seeded with a persisted fixture debrief. */
function createSeededFixture() {
  const fixture = createTempFixture();
  savePersistedState(fixture.workspace.root, { currentDebrief: buildDebriefFixture() });
  return fixture;
}

const PUBLISH_ARGS = {
  responseType: "implementation",
  persona: "visual-mapper",
  tldrHeadline: "Adds the transport test suite.",
  realWorldAnalogy: "Like a smoke alarm for the message pipes.",
  implementationReport: {
    objective: "Check every stdio frame.",
    planAndWhy: "Spawn the real transport processes.",
    result: "All frames parse as JSON-RPC.",
    consequences: "Release gates can trust the hooks."
  },
  proofClaims: [
    { claim: "Every frame parses.", evidence: "node --test tests/", status: "verified" }
  ],
  uncertaintyAudit: [
    { area: "Windows pipes", reason: "Check stdout isolation.", riskLevel: "low" }
  ],
  verificationChecklist: [
    {
      id: "chk-transport-1",
      text: "Run the transport suite.",
      source: "CLI",
      risk: "low",
      checked: false
    }
  ],
  diagram: {
    diagramType: "sequence",
    title: "Stdio Transport",
    nodes: [
      { id: "n1", label: "Test Runner", sublabel: "node:test", role: "Test", risk: "low", status: "done" },
      {
        id: "n2",
        label: "MCP Server",
        sublabel: "stdio",
        role: "Transport",
        file: "scripts/mcp-server.mjs",
        risk: "medium",
        status: "active"
      },
      {
        id: "n3",
        label: "State File",
        sublabel: "workspace",
        role: "Persistence",
        file: ".zcode/vibe-debrief-state.json",
        risk: "low",
        status: "pending"
      }
    ],
    edges: [
      { from: "n1", to: "n2", stepNumber: 1, label: "Sends frames", risk: "low" },
      { from: "n2", to: "n3", stepNumber: 2, label: "Writes state", risk: "low" }
    ]
  }
};

// ---------------------------------------------------------------------------
// MCP stdio JSON-RPC transport
// ---------------------------------------------------------------------------

describe("MCP stdio JSON-RPC transport", () => {
  it("completes initialize, ping, tools/list, resources/list and resources/templates/list", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      const result = await runMcpServer({
        messages: [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              clientInfo: { name: "vibe-debrief-suite", version: "1.0.0" }
            }
          },
          { jsonrpc: "2.0", id: 2, method: "ping", params: {} },
          { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
          { jsonrpc: "2.0", id: 4, method: "resources/list", params: {} },
          { jsonrpc: "2.0", id: 5, method: "resources/templates/list", params: {} }
        ],
        cwd: workspace.root,
        env: mcpEnv(workspace, home)
      });

      const frames = parseMcpFrames(result, "MCP handshake");
      assert.equal(frames.length, 5, "every request must get exactly one response frame");
      assert.deepEqual(frames.map((frame) => frame.id), [1, 2, 3, 4, 5]);

      const init = frames[0].result;
      assert.equal(init.protocolVersion, PROTOCOL_VERSION);
      assert.deepEqual(init.capabilities, {
        tools: { listChanged: true },
        resources: { listChanged: true }
      });
      assert.equal(init.serverInfo.name, "vibe-debrief");
      const manifest = readJsonFile(join(REPO_ROOT, ".zcode-plugin", "plugin.json"));
      assert.equal(
        init.serverInfo.version,
        manifest.version,
        "serverInfo.version must match the plugin manifest"
      );

      assert.deepEqual(frames[1].result, {});

      const tools = frames[2].result.tools;
      assert.equal(tools.length, 8, "the server must expose all 8 vibe_debrief tools");
      assert.deepEqual(
        tools.map((tool) => tool.name).sort(),
        EXPECTED_TOOL_NAMES,
        "tools/list must expose the documented tool surface"
      );
      for (const tool of tools) {
        assert.equal(tool.inputSchema?.type, "object", `${tool.name} needs an object input schema`);
        assert.equal(typeof tool.description, "string", `${tool.name} needs a description`);
        assert.ok(tool.description.length > 20, `${tool.name} description is too short`);
        assert.equal(typeof tool.annotations, "object", `${tool.name} needs annotations`);
      }
      const publish = tools.find((tool) => tool.name === "vibe_debrief_publish");
      assert.deepEqual(publish.inputSchema.required, ["responseType", "tldrHeadline"]);
      assert.deepEqual(publish.annotations, { readOnlyHint: false });
      const open = tools.find((tool) => tool.name === "vibe_debrief_open");
      assert.equal(open._meta.ui.resourceUri, PANEL_URI);
      assert.equal(open._meta.ui.surface, "vibe-debrief");

      const resources = frames[3].result.resources;
      assert.equal(resources.length, 1, "the UI surface exposes exactly one panel resource");
      assert.equal(resources[0].uri, PANEL_URI);
      assert.equal(resources[0].mimeType, PANEL_MIME);
      assert.equal(resources[0]._meta["zcode/csp"].unsafeEval, false);

      assert.deepEqual(frames[4].result, { resourceTemplates: [] });
    } finally {
      cleanup();
    }
  });

  it("serves the self-contained panel resource with the MCP App MIME and CSP metadata", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      const result = await runMcpServer({
        messages: [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "resources/read",
            params: { uri: PANEL_URI }
          }
        ],
        cwd: workspace.root,
        env: mcpEnv(workspace, home)
      });

      const frames = parseMcpFrames(result, "MCP resources/read");
      assert.equal(frames.length, 1);
      const contents = frames[0].result.contents;
      assert.equal(contents.length, 1);
      assert.equal(contents[0].uri, PANEL_URI);
      assert.equal(contents[0].mimeType, PANEL_MIME);
      assert.equal(contents[0]._meta["zcode/csp"].unsafeEval, false);

      const panelSource = readFileSync(PANEL_HTML_PATH, "utf8");
      assert.equal(contents[0].text, panelSource, "resources/read must serve assets/panel.html verbatim");
      assert.match(contents[0].text, /^<!doctype html>/i);
      assert.match(contents[0].text, /ui:\/\/vibe-debrief\/panel\.html|vibe-debrief/);
    } finally {
      cleanup();
    }
  });

  it("keeps stdout protocol-clean for blank, malformed, notification and error input", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      const result = await runMcpServer({
        messages: [
          "",
          "this line is not JSON",
          { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
          { jsonrpc: "2.0", id: 0, method: "ping", params: {} },
          {
            jsonrpc: "2.0",
            id: 7,
            method: "missing/method",
            params: {}
          },
          {
            jsonrpc: "2.0",
            id: 8,
            method: "resources/read",
            params: { uri: "ui://vibe-debrief/missing.html" }
          },
          {
            jsonrpc: "2.0",
            id: 9,
            method: "tools/call",
            params: { name: "vibe_debrief_missing_tool", arguments: {} }
          }
        ],
        cwd: workspace.root,
        env: mcpEnv(workspace, home)
      });

      const frames = parseMcpFrames(result, "MCP noisy input");
      assert.deepEqual(
        frames.map((frame) => frame.id),
        [0, 7, 8, 9],
        "only requests with ids may answer; notifications and malformed lines stay silent"
      );
      assert.deepEqual(frames[0].result, {}, "id 0 is a valid JSON-RPC id and must respond");

      assert.equal(frames[1].error.code, -32601);
      assert.match(frames[1].error.message, /Method not found/);

      assert.equal(frames[2].error.code, -32602);
      assert.match(frames[2].error.message, /Unknown resource URI/);

      assert.equal(frames[3].result.isError, true);
      assert.match(frames[3].result.content[0].text, /Unknown tool/);
    } finally {
      cleanup();
    }
  });

  it("round-trips vibe_debrief_publish and reads the published state back", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      const published = await callTool("vibe_debrief_publish", PUBLISH_ARGS, { workspace, home });

      assert.equal(published.content.length, 1);
      assert.equal(published.content[0].type, "text");
      assert.match(published.content[0].text, /# Vibe Debrief \(🚀 Implementation\)/);
      assert.match(published.content[0].text, /TL;DR:/);
      assert.match(published.content[0].text, /Stdio Transport/);

      const debrief = published.structuredContent.currentDebrief;
      assert.equal(debrief.responseType, "implementation");
      assert.equal(debrief.persona, "visual-mapper");
      assert.equal(debrief.tldrHeadline, PUBLISH_ARGS.tldrHeadline);
      assert.equal(debrief.diagram.title, "Stdio Transport");
      assert.equal(debrief.diagram.nodes.length, 3);
      assert.equal(debrief.diagram.edges.length, 2);
      assert.equal(debrief.proofClaims.length, 1);
      assert.equal(debrief.verificationChecklist[0].id, "chk-transport-1");
      assert.ok(["STE-80", "Clear", "Dense"].includes(debrief.ste100Metrics.grade));

      const persisted = readJsonFile(workspace.statePath);
      assert.equal(persisted.currentDebrief.id, debrief.id);
      assert.equal(persisted.agentPublishedThisTurn, true);
      assert.equal(persisted.history.length, 1);

      const stateResult = await callTool("vibe_debrief_get_state", { refresh: true }, {
        workspace,
        home
      });
      assert.equal(stateResult.structuredContent.currentDebrief.id, debrief.id);
      assert.equal(stateResult.structuredContent.currentDebrief.tldrHeadline, PUBLISH_ARGS.tldrHeadline);
      assert.match(stateResult.content[0].text, /^# Vibe Debrief/);
    } finally {
      cleanup();
    }
  });

  it("Story 5.1 — round-trips widened vibe_debrief_publish with all OQ-5 fields over stdio MCP", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    const oq5PublishArgs = {
      responseType: "bug",
      persona: "vibe-mentor",
      tldrHeadline: "Fixed retry guard in webhook handler across 2 files.",
      realWorldAnalogy: "Like a circuit breaker tripping before the power grid blows.",
      verdict: "Solved",
      minimalMode: false,
      heuristicConfidence: 0.92,
      rawQuote: "Retries bounded to MAX_RETRIES <= 3.",
      xray: {
        plain: {
          headline: "Fixed retry guard in webhook handler across 2 files.",
          summaryBullets: ["Stop duplicate retries when webhook returns HTTP 500."]
        },
        tech: {
          headline: "Patched retryWebhook() guard in src/webhook.mjs and test/webhook.test.mjs.",
          summaryBullets: ["Added MAX_RETRIES <= 3 guard before scheduling backoff timer."],
          symbols: ["retryWebhook", "MAX_RETRIES"],
          paths: ["src/webhook.mjs", "test/webhook.test.mjs"],
          commands: ["node --test test/webhook.test.mjs"],
          exitCodes: [0],
          proofLines: ["PASS test/webhook.test.mjs (2/2 assertions)"]
        }
      },
      waitingOnYou: {
        state: "action",
        label: "Verify / Run",
        prompt: "Run the webhook retry test to confirm exit code 0.",
        allowInlineReply: false,
        chips: [
          {
            id: "act-1",
            key: "1",
            label: "Run webhook retry test",
            techLabel: "node --test test/webhook.test.mjs",
            messagePrompt: "Please run `node --test test/webhook.test.mjs` and publish the updated Vibe Debrief.",
            primary: true
          }
        ]
      },
      choices: [
        {
          id: "choice-A",
          key: "A",
          title: "Exponential Backoff with Jitter",
          plainSubtext: "Spreads retries over time so bursts do not overload the server.",
          techSubtext: "baseDelayMs * (2 ** attempt) + randomJitter(0..250)",
          messagePrompt: "Let's proceed with Option A: Exponential Backoff with Jitter.",
          picked: false,
          tradeOffs: [
            { label: "Safety", score: 95 },
            { label: "Speed", score: 70 }
          ]
        }
      ],
      diagramSpec: {
        grammar: "flow-diff",
        title: "Webhook Retry Guard Flow",
        techTitle: "src/webhook.mjs::retryWebhook FlowDiff",
        viewBoxWidth: 460,
        groups: [{ id: "g-api", label: "API Layer", lane: "api" }],
        nodes: [
          {
            id: "n1",
            label: "Webhook Handler",
            techLabel: "src/webhook.mjs::retryWebhook",
            sublabel: "Retry guard added",
            role: "API / Transport",
            file: "src/webhook.mjs",
            risk: "high",
            status: "active",
            lane: "api"
          }
        ],
        edges: []
      },
      microBlocks: ["choices", "diagram", "proof-audit", "concepts", "lessons"],
      concepts: [
        {
          slug: "idempotent-retry",
          label: "Idempotent Retry",
          techSymbol: "retryWebhook()",
          targetPlugin: "visualize",
          stage1: {
            definition: "An operation that produces the same safe result even if called multiple times.",
            analogy: "Like pressing an elevator call button: pressing it five times still calls one elevator.",
            microVisualSpec: { type: "loop-3node", nodes: ["Request", "Dedup Key", "Safe State"] }
          },
          stage2: {
            howItWorks: "Checks idempotency key before executing retry logic and caps attempts at MAX_RETRIES.",
            keyTradeOff: "Requires tracking request IDs in memory or storage across retry windows.",
            inYourCodebase: "Enforced in src/webhook.mjs inside retryWebhook()."
          },
          stage2Prompt: "Create an interactive simulation of idempotent webhook retry backoff and deduplication."
        }
      ],
      proofClaims: [
        {
          claim: "Webhook retry test passes",
          evidence: "test/webhook.test.mjs",
          detail: "assert.equal(res.status, 200)",
          status: "verified"
        }
      ],
      bugReport: {
        cause: "Infinite retry loop on HTTP 500.",
        plan: "Cap retries at 3.",
        succeeded: "yes",
        successSummary: "Fixed with backoff.",
        consequences: "Safe retry behavior."
      }
    };

    try {
      const published = await callTool("vibe_debrief_publish", oq5PublishArgs, { workspace, home });

      assert.equal(published.content.length, 1);
      assert.equal(published.content[0].type, "text");
      assert.match(published.content[0].text, /# Vibe Debrief \(🐛 Bug \/ Error Fix\)/);

      const debrief = published.structuredContent.currentDebrief;

      // Legacy fields intact
      assert.equal(debrief.responseType, "bug");
      assert.equal(debrief.persona, "vibe-mentor");
      assert.equal(debrief.tldrHeadline, oq5PublishArgs.tldrHeadline);
      assert.equal(debrief.bugReport.cause, oq5PublishArgs.bugReport.cause);
      assert.equal(debrief.bugReport.succeeded, "yes");
      assert.equal(debrief.diagram.title, "Webhook Retry Guard Flow");
      assert.equal(debrief.diagram.nodes.length, 1);
      assert.equal(debrief.proofClaims[0].detail, "assert.equal(res.status, 200)");

      // All OQ-5 fields present and populated
      assert.equal(debrief.verdict, "Solved");
      assert.equal(debrief.minimalMode, false);
      assert.equal(debrief.heuristicConfidence, 0.92);
      assert.equal(debrief.rawQuote, "Retries bounded to MAX_RETRIES <= 3.");

      assert.equal(debrief.xray.plain.headline, oq5PublishArgs.xray.plain.headline);
      assert.deepEqual(debrief.xray.tech.symbols, ["retryWebhook", "MAX_RETRIES"]);
      assert.deepEqual(debrief.xray.tech.paths, ["src/webhook.mjs", "test/webhook.test.mjs"]);

      assert.equal(debrief.waitingOnYou.state, "action");
      assert.equal(debrief.waitingOnYou.chips.length, 1);
      assert.equal(debrief.waitingOnYou.chips[0].techLabel, "node --test test/webhook.test.mjs");

      assert.equal(debrief.choices.length, 1);
      assert.equal(debrief.choices[0].title, "Exponential Backoff with Jitter");
      assert.equal(debrief.choices[0].tradeOffs[0].score, 95);

      assert.equal(debrief.diagramSpec.grammar, "flow-diff");
      assert.equal(debrief.diagramSpec.nodes[0].techLabel, "src/webhook.mjs::retryWebhook");
      assert.equal(debrief.diagramSpec.nodes[0].lane, "api");

      assert.deepEqual(debrief.microBlocks, ["choices", "diagram", "proof-audit", "concepts", "lessons"]);

      assert.equal(debrief.concepts.length, 1);
      assert.equal(debrief.concepts[0].slug, "idempotent-retry");
      assert.equal(debrief.concepts[0].targetPlugin, "visualize");

      // Verify persisted to state file
      const persisted = readJsonFile(workspace.statePath);
      assert.equal(persisted.currentDebrief.id, debrief.id);
      assert.equal(persisted.currentDebrief.verdict, "Solved");
      assert.equal(persisted.currentDebrief.waitingOnYou.state, "action");
      assert.equal(persisted.currentDebrief.concepts[0].slug, "idempotent-retry");
      assert.equal(persisted.agentPublishedThisTurn, true);

      // Verify reading back state
      const stateResult = await callTool("vibe_debrief_get_state", { refresh: true }, {
        workspace,
        home
      });
      assert.equal(stateResult.structuredContent.currentDebrief.id, debrief.id);
      assert.equal(stateResult.structuredContent.currentDebrief.verdict, "Solved");
      assert.equal(stateResult.structuredContent.currentDebrief.diagramSpec.grammar, "flow-diff");
      assert.equal(stateResult.structuredContent.currentDebrief.concepts.length, 1);
    } finally {
      cleanup();
    }
  });

  it("round-trips get_state, set_persona, toggle_check and open", async () => {
    const { workspace, home, cleanup } = createSeededFixture();

    try {
      const stateResult = await callTool("vibe_debrief_get_state", { refresh: false }, {
        workspace,
        home
      });
      assert.equal(stateResult.structuredContent.currentDebrief.id, "fixture-debrief");
      assert.match(stateResult.content[0].text, /^# Vibe Debrief/);

      const personaResult = await callTool(
        "vibe_debrief_set_persona",
        {
          persona: "indie-founder",
          ste100Enabled: false,
          language: "fr",
          preferredModel: "openai/gpt-5-nano",
          themePreference: "light"
        },
        { workspace, home }
      );
      assert.equal(personaResult.structuredContent.activePersona, "indie-founder");
      assert.equal(personaResult.structuredContent.ste100Enabled, false);
      assert.equal(personaResult.structuredContent.language, "fr");
      assert.equal(personaResult.structuredContent.preferredModel, "openai/gpt-5-nano");
      assert.equal(personaResult.structuredContent.themePreference, "light");
      assert.equal(personaResult.structuredContent.currentDebrief.persona, "indie-founder");
      assert.match(personaResult.content[0].text, /indie-founder/);

      const reloadedState = await callTool("vibe_debrief_get_state", { refresh: true }, { workspace, home });
      assert.equal(reloadedState.structuredContent.language, "fr");
      assert.equal(reloadedState.structuredContent.preferredModel, "openai/gpt-5-nano");
      assert.equal(reloadedState.structuredContent.themePreference, "light");

      const toggleResult = await callTool(
        "vibe_debrief_toggle_check",
        { checkId: "chk-fixture-1", checked: true },
        { workspace, home }
      );
      const toggled = toggleResult.structuredContent.currentDebrief.verificationChecklist.find(
        (item) => item.id === "chk-fixture-1"
      );
      assert.equal(toggled.checked, true);
      const persistedAfterToggle = readJsonFile(workspace.statePath);
      assert.equal(
        persistedAfterToggle.currentDebrief.verificationChecklist.find(
          (item) => item.id === "chk-fixture-1"
        ).checked,
        true
      );

      const openResult = await callTool("vibe_debrief_open", { persona: "eli5-storyteller" }, {
        workspace,
        home
      });
      assert.equal(openResult.structuredContent.activePersona, "eli5-storyteller");
      assert.equal(openResult.structuredContent.currentDebrief.persona, "eli5-storyteller");
      assert.match(openResult.content[0].text, /# Vibe Debrief/);
    } finally {
      cleanup();
    }
  });

  it("round-trips export_html and generate_explainer against the temp workspace", async () => {
    const { workspace, home, cleanup } = createSeededFixture();
    const artifactDir = join(workspace.root, "artifacts");

    try {
      const exportResult = await callTool("vibe_debrief_export_html", {}, {
        workspace,
        home,
        env: { ZCODE_VISUALIZATION_DIR: artifactDir }
      });
      const artifact = exportResult.structuredContent.exportedArtifact;
      assert.ok(artifact, "export_html must return the saved artifact metadata");
      assert.equal(
        relative(artifactDir, artifact.filePath).startsWith(".."),
        false,
        "the export must stay inside ZCODE_VISUALIZATION_DIR"
      );
      assert.match(artifact.fileName, /^vibe-debrief-[\dT-]+\.html$/);
      assert.equal(existsSync(artifact.filePath), true, "export_html must write the artifact file");
      const html = readFileSync(artifact.filePath, "utf8");
      assert.match(html, /^<!doctype html>/i);
      assert.match(html, /Fixture Flow/);
      assert.equal(artifact.bytes, Buffer.byteLength(html, "utf8"));

      const explainerResult = await callTool("vibe_debrief_generate_explainer", {}, {
        workspace,
        home
      });
      const scenes = explainerResult.structuredContent.currentDebrief.explainerScenes;
      assert.equal(scenes.length, 4, "generate_explainer must produce the four explainer scenes");
      assert.deepEqual(
        scenes.map((scene) => scene.id),
        ["scene-1", "scene-2", "scene-3", "scene-4"]
      );
      assert.match(explainerResult.structuredContent.plainTextScript, /^\[Scene 1 · 7s\]/);
      assert.match(explainerResult.content[0].text, /Generated 4 animated explainer scenes/);
    } finally {
      cleanup();
    }
  });

  it("export_html accepts { conceptSlug, targetPlugin } and writes the Stage 2 3-column fallback", async () => {
    const { workspace, home, cleanup } = createSeededFixture();
    const artifactDir = join(workspace.root, "artifacts");

    try {
      // Seed a concept so the matched-concept path is exercised end-to-end.
      const seeded = buildDebriefFixture({
        concepts: [
          {
            slug: "sse-stream",
            label: "SSE Stream",
            targetPlugin: "visualize",
            stage2: {
              howItWorks: "Server writes SSE frames over one open connection.",
              keyTradeOff: "SSE is one-directional, unlike WebSockets.",
              inYourCodebase: "Find EventSource calls in the frontend."
            }
          }
        ]
      });
      savePersistedState(workspace.root, { currentDebrief: seeded });

      const result = await callTool(
        "vibe_debrief_export_html",
        { conceptSlug: "sse-stream", targetPlugin: "visualize" },
        { workspace, home, env: { ZCODE_VISUALIZATION_DIR: artifactDir } }
      );
      const artifact = result.structuredContent.exportedArtifact;
      assert.ok(artifact, "export_html must return artifact metadata");
      assert.equal(artifact.conceptSlug, "sse-stream");
      assert.equal(artifact.targetPlugin, "visualize");
      assert.equal(existsSync(artifact.filePath), true);

      const html = readFileSync(artifact.filePath, "utf8");
      assert.match(html, /id="stage2Popout"/);
      assert.match(html, /<h3>How It Works<\/h3>/);
      assert.match(html, /<h3>Key Trade-off<\/h3>/);
      assert.match(html, /<h3>In Your Codebase<\/h3>/);
      assert.match(html, /Server writes SSE frames over one open connection\./);
      assert.match(html, /id="missingBanner"/);
      assert.match(html, /Install visualize/);
      assert.match(html, /id="stage2TelemetryPill"/);

      // conceptSlug null still renders the fallback, synthesized from the debrief.
      const nullResult = await callTool(
        "vibe_debrief_export_html",
        { conceptSlug: null, targetPlugin: "excalidraw" },
        { workspace, home, env: { ZCODE_VISUALIZATION_DIR: artifactDir } }
      );
      const nullHtml = readFileSync(nullResult.structuredContent.exportedArtifact.filePath, "utf8");
      assert.match(nullHtml, /id="stage2Popout"/);
      assert.match(nullHtml, /Keep the change small\./);
      assert.match(nullHtml, /Install excalidraw/);
      assert.equal(nullHtml.includes("Server writes SSE frames"), false);
    } finally {
      cleanup();
    }
  });

  it("round-trips confirm_lesson into an isolated ZCode memory directory", async () => {
    const { workspace, home, cleanup } = createSeededFixture();
    const lesson = {
      slug: "stdio-isolation-rule",
      title: "Keep stdout protocol only",
      summary: "Rules out debug lines from breaking the JSON-RPC frames.",
      why: "Clients parse each stdout line as JSON.",
      howToApply: "Send diagnostics to stderr and protocol frames to stdout.",
      memoryType: "feedback"
    };

    try {
      const result = await callTool("vibe_debrief_confirm_lesson", lesson, { workspace, home });
      const record = result.structuredContent.lastSavedLesson;

      assert.equal(record.slug, lesson.slug);
      assert.match(record.savedMemoryPath, /stdio-isolation-rule\.md$/);
      assert.equal(
        relative(home.memoryProjectsRoot, record.savedMemoryPath).startsWith(".."),
        false,
        "the memory file must stay inside the isolated temp home"
      );
      assert.equal(existsSync(record.savedMemoryPath), true);

      const memoryFile = readFileSync(record.savedMemoryPath, "utf8");
      assert.match(memoryFile, /^---\nname: stdio-isolation-rule\n/);
      assert.match(memoryFile, /\*\*Why:\*\* /);
      assert.match(memoryFile, /\*\*How to apply:\*\* /);

      const index = readFileSync(record.memoryIndexPath, "utf8");
      assert.match(index, /\(stdio-isolation-rule\.md\)/);

      assert.equal(result.structuredContent.confirmedLessons[0].slug, lesson.slug);
      assert.equal(result.structuredContent.currentDebrief.lessonsLearned[0].confirmed, true);
      assert.match(result.content[0].text, /saved to ZCode Memory/);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Hook runner stdout isolation (all four lifecycle modes)
// ---------------------------------------------------------------------------

describe("hook runner stdout isolation", () => {
  it("emits exactly one protocol JSON line in every lifecycle mode", async () => {
    const { workspace, home, cleanup } = createTempFixture();
    const touchedFile = workspace.write("scripts/transport.mjs", "export const ok = true;\n");

    try {
      const session = await runHookRunner("session-start", {}, {
        cwd: workspace.root,
        env: mcpEnv(workspace, home)
      });
      const sessionFrame = parseHookFrame(session, "session-start");
      assert.match(sessionFrame.additionalContext, /Vibe Debrief v0\.4\.0/);
      assert.match(sessionFrame.additionalContext, /Persona: Vibe Mentor/);
      assert.match(sessionFrame.additionalContext, /STE-80: ON/);
      assert.match(sessionFrame.additionalContext, /Always include `diagram`/);
      assert.match(sessionFrame.additionalContext, /new-provider\/gemini-3\.8-flash/);

      const prompt = await runHookRunner("user-prompt", { prompt: "Add the transport suite." }, {
        cwd: workspace.root,
        env: mcpEnv(workspace, home)
      });
      const promptFrame = parseHookFrame(prompt, "user-prompt");
      assert.deepEqual(promptFrame, {}, "a plain prompt leaves stdout as an empty protocol object");

      const postTool = await runHookRunner(
        "post-tool",
        {
          tool_name: "Edit",
          tool_input: { file_path: touchedFile },
          tool_response: { ok: true }
        },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.deepEqual(parseHookFrame(postTool, "post-tool"), {});

      const stop = await runHookRunner(
        "stop",
        { last_assistant_message: "Implemented the transport suite. Tests pass." },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.deepEqual(parseHookFrame(stop, "stop"), {});

      const persisted = readJsonFile(workspace.statePath);
      assert.equal(persisted.lastUserPrompt, "Add the transport suite.");
      assert.equal(persisted.lastAssistantMessage, "Implemented the transport suite. Tests pass.");
      assert.equal(persisted.turnCount, 1);
      assert.equal(persisted.currentDebrief.responseType, "implementation");
      assert.ok(persisted.currentDebrief.diagram.nodes.length >= 2);
    } finally {
      cleanup();
    }
  });

  it("resets per-turn tracking on user-prompt", async () => {
    const { workspace, home, cleanup } = createTempFixture();
    savePersistedState(workspace.root, {
      recentTouchedFiles: ["scripts/old.mjs"],
      lastCommandExitZero: false,
      agentPublishedThisTurn: true
    });

    try {
      const result = await runHookRunner("user-prompt", { prompt: "Build the next view." }, {
        cwd: workspace.root,
        env: mcpEnv(workspace, home)
      });
      parseHookFrame(result, "user-prompt");

      const persisted = readJsonFile(workspace.statePath);
      assert.equal(persisted.lastUserPrompt, "Build the next view.");
      assert.deepEqual(persisted.recentTouchedFiles, []);
      assert.equal(persisted.lastCommandExitZero, null);
      assert.equal(persisted.agentPublishedThisTurn, false);
      assert.ok(persisted.lastUserPromptAt);
    } finally {
      cleanup();
    }
  });

  it("delegates a Deep Refresh prompt with the cost-aware directive", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      const result = await runHookRunner(
        "user-prompt",
        { prompt: "[Vibe Debrief — Deep Refresh] explain the last turn" },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      const frame = parseHookFrame(result, "user-prompt (deep refresh)");
      assert.match(frame.additionalContext, /MANDATORY COST-AWARE ACTION FOR \[Vibe Debrief — Deep Refresh\]/);
      assert.match(frame.additionalContext, /CreateSession/);
      assert.match(frame.additionalContext, /vibe_debrief_publish/);
      assert.match(frame.additionalContext, /new-provider\/gemini-3\.8-flash/);

      const persisted = readJsonFile(workspace.statePath);
      assert.equal(persisted.lastUserPrompt, "[Vibe Debrief — Deep Refresh] explain the last turn");
    } finally {
      cleanup();
    }
  });

  it("tracks edited files and Bash outcomes on post-tool", async () => {
    const { workspace, home, cleanup } = createTempFixture();
    const touchedFile = workspace.write("src/panel-view.mjs", "export const view = 1;\n");

    try {
      const edit = await runHookRunner(
        "post-tool",
        {
          tool_name: "Edit",
          tool_input: { file_path: touchedFile },
          tool_response: { content: "patched" }
        },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.deepEqual(parseHookFrame(edit, "post-tool edit"), {});

      let persisted = readJsonFile(workspace.statePath);
      assert.deepEqual(persisted.recentTouchedFiles, ["src/panel-view.mjs"]);

      const failingBash = await runHookRunner(
        "post-tool",
        {
          tool_name: "Bash",
          tool_input: { command: "node --test tests/" },
          tool_response: { stdout: "Error: one test failed", exit_code: 1 }
        },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.deepEqual(parseHookFrame(failingBash, "post-tool bash failure"), {});
      persisted = readJsonFile(workspace.statePath);
      assert.equal(persisted.lastCommandExitZero, false);

      const cleanBash = await runHookRunner(
        "post-tool",
        {
          tool_name: "Bash",
          tool_input: { command: "node --test tests/" },
          tool_response: { stdout: "0 errors, all tests pass", exit_code: 0 }
        },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.deepEqual(parseHookFrame(cleanBash, "post-tool bash success"), {});
      persisted = readJsonFile(workspace.statePath);
      assert.equal(persisted.lastCommandExitZero, true);
      assert.deepEqual(persisted.recentTouchedFiles, ["src/panel-view.mjs"]);
    } finally {
      cleanup();
    }
  });

  it("preserves an agent-published debrief on stop", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      // The agent calls vibe_debrief_publish during the turn, then the Stop hook fires.
      const published = await callTool("vibe_debrief_publish", PUBLISH_ARGS, { workspace, home });
      const publishedId = published.structuredContent.currentDebrief.id;
      const beforeStop = readJsonFile(workspace.statePath);
      assert.equal(beforeStop.agentPublishedThisTurn, true);

      const assistantMessage = "I published the debrief for this turn.";
      const stop = await runHookRunner(
        "stop",
        { last_assistant_message: assistantMessage },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.deepEqual(parseHookFrame(stop, "stop (agent published)"), {});

      const afterStop = readJsonFile(workspace.statePath);
      assert.equal(afterStop.currentDebrief.id, publishedId, "stop must not rebuild a published debrief");
      assert.equal(afterStop.currentDebrief.tldrHeadline, PUBLISH_ARGS.tldrHeadline);
      assert.equal(afterStop.lastAssistantMessage, assistantMessage);
      assert.equal(afterStop.turnCount, 1);
      assert.equal(afterStop.agentPublishedThisTurn, false);
      assert.equal(afterStop.history.length, 1, "stop must not append a duplicate history entry");
    } finally {
      cleanup();
    }
  });

  it("falls back to the heuristic debrief when AI synthesis fails", async () => {
    const { workspace, home, cleanup } = createTempFixture();
    workspace.write("scripts/transport.mjs", "export const ok = true;\n");

    const server = await startChatCompletionServer(({ res }) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "upstream failure" }));
    });

    try {
      const result = await runHookRunner(
        "stop",
        { last_assistant_message: "Implemented the transport suite. Tests pass." },
        {
          cwd: workspace.root,
          env: mcpEnv(workspace, home, {
            VIBE_DEBRIEF_OPENAI_KEY: "test-key",
            VIBE_DEBRIEF_OPENAI_BASE_URL: server.url,
            VIBE_DEBRIEF_MODEL: "gemini-test"
          })
        }
      );
      assert.deepEqual(parseHookFrame(result, "stop (AI fallback)"), {});

      const persisted = readJsonFile(workspace.statePath);
      assert.match(persisted.currentDebrief.tldrHeadline, /^Built:/);
      assert.ok(persisted.currentDebrief.ste100Metrics.score > 0);
      assert.equal(persisted.turnCount, 1);
    } finally {
      await server.close();
      cleanup();
    }
  });

  it("merges OpenAI-compatible AI synthesis into the stop debrief", async () => {
    const { workspace, home, cleanup } = createTempFixture();
    workspace.write("scripts/transport.mjs", "export const ok = true;\n");

    const requests = [];
    const server = await startChatCompletionServer(({ res, parsed }) => {
      requests.push(parsed);
      respondWithChatJson(res, {
        responseType: "bug",
        tldrHeadline: "AI synthesized headline from the compatible endpoint.",
        realWorldAnalogy: "AI analogy for the transport pipe.",
        diagram: {
          diagramType: "cause-effect",
          title: "AI Flow",
          nodes: [
            { id: "n1", label: "Prompt", role: "Input", risk: "low", status: "done" },
            { id: "n2", label: "Hook", role: "Transport", risk: "medium", status: "active" },
            { id: "n3", label: "State", role: "Persistence", risk: "low", status: "pending" }
          ],
          edges: [
            { from: "n1", to: "n2", stepNumber: 1, label: "Triggers", risk: "low" },
            { from: "n2", to: "n3", stepNumber: 2, label: "Persists", risk: "low" }
          ]
        },
        bugReport: {
          cause: "The stop hook had no synthesized story.",
          plan: "Call the compatible endpoint.",
          succeeded: "yes",
          successSummary: "The merge works.",
          consequences: "The panel gets a richer debrief."
        },
        proofClaims: [{ claim: "AI merge applied.", evidence: "local server", status: "verified" }],
        uncertaintyAudit: [{ area: "Remote model", reason: "Check latency.", riskLevel: "medium" }],
        verificationChecklist: [
          { id: "chk-ai-1", text: "Confirm the AI headline.", source: "Hook", risk: "low" }
        ]
      });
    });

    try {
      const result = await runHookRunner(
        "stop",
        { last_assistant_message: "Implemented the transport suite. Tests pass." },
        {
          cwd: workspace.root,
          env: mcpEnv(workspace, home, {
            VIBE_DEBRIEF_OPENAI_KEY: "test-key",
            VIBE_DEBRIEF_OPENAI_BASE_URL: server.url,
            VIBE_DEBRIEF_MODEL: "gemini-test"
          })
        }
      );
      assert.deepEqual(parseHookFrame(result, "stop (AI merge)"), {});

      const persisted = readJsonFile(workspace.statePath);
      const debrief = persisted.currentDebrief;
      assert.equal(debrief.responseType, "bug");
      assert.match(debrief.tldrHeadline, /synthesized headline from the compatible endpoint/);
      assert.equal(debrief.diagram.title, "AI Flow");
      assert.equal(debrief.diagram.nodes.length, 3);
      assert.equal(debrief.proofClaims[0].claim, "AI merge applied.");
      assert.equal(debrief.verificationChecklist[0].id, "chk-ai-1");
      assert.equal(persisted.turnCount, 1);

      assert.equal(requests.length, 1, "the hook must call the compatible endpoint once");
      assert.equal(requests[0].model, "gemini-test");
      assert.equal(requests[0].messages[0].role, "system");
      const userPayload = JSON.parse(requests[0].messages[1].content);
      assert.match(userPayload.assistantResponse, /Implemented the transport suite/);
    } finally {
      await server.close();
      cleanup();
    }
  });

  it("still emits one protocol line when stdin is not valid JSON", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      const result = await runHookRunner("session-start", "this is not json {", {
        cwd: workspace.root,
        env: mcpEnv(workspace, home)
      });
      const frame = parseHookFrame(result, "session-start (malformed stdin)");
      assert.match(frame.additionalContext, /Vibe Debrief v0\.4\.0/);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 4-file version sync gate (Story 4.3 / epic-panel-a11y R3 & Story 7.5 v0.4.0)
// ---------------------------------------------------------------------------

describe("4-file version sync gate", () => {
  it("collects a 0.4.0 declaration from every canonical version location", () => {
    const declarations = collectVersionDeclarations(REPO_ROOT);
    assert.equal(declarations.length, 4, "the gate must cover all four version locations");
    for (const entry of declarations) {
      assert.equal(entry.error, null, `${entry.label} must be readable`);
      assert.equal(entry.version, "0.4.0", `${entry.label} must declare 0.4.0`);
    }
  });

  it("passes the release gate for the real repository at 0.4.0", () => {
    const result = checkVersionSync({ expectedVersion: "0.4.0" });
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
    assert.equal(result.version, "0.4.0");
  });

  it("exits 0 as a CLI gate and reports all four locations synced", async () => {
    const result = await runNodeProcess({
      args: [join(REPO_ROOT, "scripts", "check-version-sync.mjs"), "0.4.0"]
    });
    assert.equal(result.exitCode, 0, `gate stderr: ${result.stderr}`);
    assert.equal(result.stderr, "", "a passing gate must keep stderr clean");
    assert.match(result.stdout, /all 4 version locations synced to 0\.4\.0/);
  });

  it("detects drift when one location disagrees with the others", () => {
    const declarations = collectVersionDeclarations(REPO_ROOT).map((entry) =>
      entry.id === "hook-banner" ? { ...entry, version: "0.2.0" } : entry
    );
    const result = compareVersionDeclarations(declarations);
    assert.equal(result.ok, false);
    assert.ok(
      result.problems.some((problem) => problem.includes("version drift")),
      `expected a drift problem, got: ${result.problems.join("; ")}`
    );
  });

  it("fails when a location is unreadable or its declaration is missing", () => {
    const declarations = collectVersionDeclarations(REPO_ROOT).map((entry) =>
      entry.id === "panel-app-info"
        ? { ...entry, version: null, error: "version declaration not found" }
        : entry
    );
    const result = compareVersionDeclarations(declarations);
    assert.equal(result.ok, false);
    assert.ok(
      result.problems.some((problem) => problem.includes("assets/panel.html")),
      `expected a panel problem, got: ${result.problems.join("; ")}`
    );
  });

  it("rejects an expected version that does not match the stamped release", () => {
    const result = checkVersionSync({ expectedVersion: "9.9.9" });
    assert.equal(result.ok, false);
    assert.ok(
      result.problems.some((problem) => problem.includes("expected 9.9.9")),
      `expected a mismatch problem, got: ${result.problems.join("; ")}`
    );
  });
});

// ---------------------------------------------------------------------------
// Local OpenAI-compatible endpoint used by the optional Stop synthesis tests
// ---------------------------------------------------------------------------

function startChatCompletionServer(handler) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = null;
        }
        handler({ request, res: response, body, parsed });
      });
    });
    server.on("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolvePromise({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((resolveClose) => {
            server.close(resolveClose);
          })
      });
    });
  });
}

function respondWithChatJson(response, payload) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: JSON.stringify(payload) } }]
    })
  );
}
