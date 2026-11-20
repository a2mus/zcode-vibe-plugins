import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MCP_SERVER_PATH,
  PANEL_HTML_PATH,
  REPO_ROOT,
  createTempWorkspace,
  readJsonFile,
  runMcpServer,
  runNodeProcess
} from "./helpers.mjs";

const workspaces = [];

function trackWorkspace(options) {
  const ws = createTempWorkspace(options);
  workspaces.push(ws);
  return ws;
}

afterEach(() => {
  while (workspaces.length > 0) {
    workspaces.pop().cleanup();
  }
});

/**
 * Verify strict JSON-RPC 2.0 stdout isolation: clean exit, empty stderr,
 * LF-only lines (no CRLF, no blank lines), and valid JSON-RPC 2.0 frames.
 */
function assertStrictJsonRpcStdout(res) {
  assert.equal(res.code, 0, `expected exit code 0, got ${res.code} (stderr=${res.stderr})`);
  assert.equal(res.stderr, "", `expected empty stderr, got: ${res.stderr}`);
  assert.equal(res.stdout.includes("\r"), false, "stdout must use LF only (no CRLF)");
  assert.equal(res.parseError, null, res.parseError?.message);

  if (res.lines.length > 0) {
    assert.equal(res.stdout.endsWith("\n"), true, "non-empty stdout must end with LF");
    assert.ok(
      res.lines.every((line) => line.length > 0),
      "stdout must not contain blank lines"
    );
  }

  for (const frame of res.responses) {
    assert.equal(typeof frame, "object");
    assert.ok(frame !== null);
    assert.equal(frame.jsonrpc, "2.0");
    assert.ok(frame.id !== undefined && frame.id !== null, "response frame must include id");
    assert.notEqual(
      "result" in frame,
      "error" in frame,
      "JSON-RPC 2.0 response must contain result xor error"
    );
  }
}

const EXPECTED_TOOLS = [
  "bmad_open_companion",
  "bmad_get_state",
  "bmad_update_advisor",
  "bmad_prepare_new_session",
  "bmad_reconcile_trackers",
  "bmad_recommend_next",
  "bmad_inspect_artifact",
  "bmad_open_artifact_file",
  "bmad_queue_manage"
];

describe("bmad-companion MCP stdio transport smoke harness", () => {
  it("completes initialize, ping, tools/list, resources/list, and resources/templates/list in order", async () => {
    const ws = trackWorkspace();
    const pluginManifest = readJsonFile(join(REPO_ROOT, ".zcode-plugin", "plugin.json"));

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "mcp-transport-smoke", version: "1.0.0" }
          }
        },
        { jsonrpc: "2.0", id: 2, method: "ping" },
        { jsonrpc: "2.0", id: 3, method: "tools/list" },
        { jsonrpc: "2.0", id: 4, method: "resources/list" },
        { jsonrpc: "2.0", id: 5, method: "resources/templates/list" }
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 5);
    assert.deepEqual(
      res.responses.map((r) => r.id),
      [1, 2, 3, 4, 5]
    );
    for (const frame of res.responses) {
      assert.ok("result" in frame, `expected result in frame id=${frame.id}`);
    }

    // 1. initialize
    const initResult = res.responses[0].result;
    assert.equal(initResult.protocolVersion, "2024-11-05");
    assert.equal(initResult.serverInfo?.name, "bmad-companion");
    assert.equal(initResult.serverInfo?.name, pluginManifest.name);
    assert.equal(initResult.serverInfo?.version, pluginManifest.version);
    assert.deepEqual(initResult.capabilities, {
      tools: { listChanged: true },
      resources: { listChanged: true }
    });

    // 2. ping
    assert.deepEqual(res.responses[1].result, {});

    // 3. tools/list
    const tools = res.responses[2].result.tools;
    assert.ok(Array.isArray(tools));
    assert.equal(tools.length, EXPECTED_TOOLS.length);
    assert.deepEqual(
      tools.map((t) => t.name),
      EXPECTED_TOOLS
    );
    for (const tool of tools) {
      assert.equal(typeof tool.description, "string");
      assert.ok(tool.description.length > 0, `expected description on ${tool.name}`);
      assert.equal(tool.inputSchema?.type, "object", `expected object schema on ${tool.name}`);
      assert.equal(typeof tool.inputSchema?.properties, "object");
      assert.equal(typeof tool.annotations?.readOnlyHint, "boolean", `expected readOnlyHint on ${tool.name}`);
    }

    // 4. resources/list (OQ-G: ratified _meta["zcode/csp"].unsafeEval === false)
    const resources = res.responses[3].result.resources;
    assert.ok(Array.isArray(resources));
    assert.equal(resources.length, 1);
    assert.equal(resources[0].uri, "ui://bmad-companion/panel.html");
    assert.equal(resources[0].mimeType, "text/html;profile=mcp-app");
    assert.equal(resources[0]._meta?.["zcode/csp"]?.unsafeEval, false);

    // 5. resources/templates/list
    assert.deepEqual(res.responses[4].result, { resourceTemplates: [] });
  });

  it("falls back to protocolVersion 2025-11-25 when initialize omits params.protocolVersion", async () => {
    const ws = trackWorkspace();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [{ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 1);
    assert.equal(res.responses[0].result.protocolVersion, "2025-11-25");
  });

  it("serves assets/panel.html verbatim on resources/read with MCP App MIME and CSP metadata", async () => {
    const ws = trackWorkspace();
    const expectedHtml = readFileSync(PANEL_HTML_PATH, "utf8");

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "resources/read",
          params: { uri: "ui://bmad-companion/panel.html" }
        }
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 1);

    const contents = res.responses[0].result.contents;
    assert.ok(Array.isArray(contents));
    assert.equal(contents.length, 1);
    assert.equal(contents[0].uri, "ui://bmad-companion/panel.html");
    assert.equal(contents[0].mimeType, "text/html;profile=mcp-app");
    // OQ-G: server emits CSP metadata under _meta["zcode/csp"].unsafeEval: false
    assert.equal(contents[0]._meta?.["zcode/csp"]?.unsafeEval, false);
    assert.equal(contents[0].text, expectedHtml);
  });

  it("ignores notifications and malformed JSON, emits -32602/-32601 errors, and stays alive", async () => {
    const ws = trackWorkspace();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: null, method: "notifications/cancelled" },
        "",
        "{not-valid-json",
        {
          jsonrpc: "2.0",
          id: 10,
          method: "resources/read",
          params: { uri: "ui://bmad-companion/does-not-exist.html" }
        },
        { jsonrpc: "2.0", id: 11, method: "nonexistent/method" },
        { jsonrpc: "2.0", id: 12, method: "ping" }
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 3);
    assert.deepEqual(
      res.responses.map((r) => r.id),
      [10, 11, 12]
    );

    // Unknown resource URI -> -32602
    assert.equal(res.responses[0].error.code, -32602);
    assert.match(res.responses[0].error.message, /Resource not found/);

    // Unknown method -> -32601
    assert.equal(res.responses[1].error.code, -32601);
    assert.match(res.responses[1].error.message, /Method not found/);

    // Subsequent valid request still succeeds
    assert.deepEqual(res.responses[2].result, {});
  });

  it("kills a non-exiting child and rejects with diagnostic stdout/stderr when timeoutMs expires", async () => {
    const ws = trackWorkspace();

    await assert.rejects(
      () =>
        runMcpServer({
          workspaceRoot: ws.root,
          requests: [{ jsonrpc: "2.0", id: 1, method: "ping" }],
          keepStdinOpen: true,
          timeoutMs: 200
        }),
      (err) => {
        assert.equal(err.code, "ETIMEDOUT");
        assert.match(err.message, /timed out after 200ms/);
        assert.ok(err.stdout.includes('"id":1'), "timeout error should retain captured stdout");
        assert.ok(err.message.includes(err.stdout.trim()), "timeout message should include stdout");
        assert.equal(err.stderr, "");
        return true;
      }
    );

    await assert.rejects(
      () =>
        runNodeProcess(MCP_SERVER_PATH, {
          cwd: ws.root,
          env: {
            ZCODE_WORKSPACE_ROOT: ws.root,
            ZCODE_PROJECT_DIR: ws.root,
            CLAUDE_PROJECT_DIR: ws.root
          },
          stdin: null,
          timeoutMs: 150
        }),
      (err) => {
        assert.equal(err.code, "ETIMEDOUT");
        assert.match(err.message, /timed out after 150ms/);
        return true;
      }
    );
  });
});
