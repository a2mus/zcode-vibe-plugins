import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  HOOK_RUNNER_PATH,
  createTempWorkspace,
  parseJsonLines,
  readJsonFile,
  runNodeProcess,
  seedBmadWorkspace,
  splitLines
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
 * Spawn scripts/hook-runner.mjs for one hook mode against an isolated temp
 * workspace. payload.cwd plus ZCODE_PROJECT_DIR/CLAUDE_PROJECT_DIR pin the
 * workspace root; OPENAI_API_KEY/BMAD_COMPANION_OPENAI_KEY are stripped via
 * undefined env overrides (runNodeProcess drops undefined values) so Stop
 * never attempts network synthesis.
 */
function runHook(ws, mode, payload = {}, { stdin, timeoutMs } = {}) {
  return runNodeProcess(HOOK_RUNNER_PATH, {
    args: [mode],
    cwd: ws.root,
    env: {
      ZCODE_PROJECT_DIR: ws.root,
      CLAUDE_PROJECT_DIR: ws.root,
      OPENAI_API_KEY: undefined,
      BMAD_COMPANION_OPENAI_KEY: undefined
    },
    stdin: stdin !== undefined ? stdin : JSON.stringify({ cwd: ws.root, ...payload }),
    timeoutMs
  });
}

/**
 * Strict hook stdout isolation: exit 0, empty stderr, LF-only output,
 * exactly one non-blank line terminated by LF, and that line parses as JSON.
 * Returns the parsed object.
 */
function assertSingleJsonLine(res) {
  assert.equal(res.code, 0, `expected exit code 0, got ${res.code} (stderr=${res.stderr})`);
  assert.equal(res.stderr, "", `expected empty stderr, got: ${res.stderr}`);
  assert.equal(res.stdout.includes("\r"), false, "stdout must use LF only (no CRLF)");
  assert.equal(res.stdout.endsWith("\n"), true, "stdout must end with LF");

  const lines = splitLines(res.stdout);
  assert.equal(
    lines.length,
    1,
    `expected exactly one stdout line, got ${lines.length}: ${JSON.stringify(res.stdout)}`
  );
  assert.ok(lines[0].length > 0, "stdout line must not be blank");

  const parsed = parseJsonLines(res.stdout);
  assert.equal(parsed.length, 1);
  assert.equal(typeof parsed[0], "object");
  assert.ok(parsed[0] !== null && !Array.isArray(parsed[0]), "stdout JSON must be a non-null, non-array object");
  return parsed[0];
}

describe("bmad-companion hook stdout-isolation harness", () => {
  it("session-start emits one {additionalContext} line and records lastSessionStartAt", async () => {
    const ws = seedBmadWorkspace(trackWorkspace());

    const res = await runHook(ws, "session-start", {});
    const frame = assertSingleJsonLine(res);

    assert.deepEqual(Object.keys(frame), ["additionalContext"]);
    assert.equal(typeof frame.additionalContext, "string");
    assert.ok(
      frame.additionalContext.includes("[BMAD Companion Active for"),
      "additionalContext must contain the activation banner"
    );
    assert.ok(
      frame.additionalContext.includes("Smart Progress:"),
      "additionalContext must contain the Smart Progress line"
    );

    const state = readJsonFile(ws.statePath);
    assert.equal(typeof state.lastSessionStartAt, "string");
    assert.ok(state.lastSessionStartAt.length > 0, "lastSessionStartAt must be an ISO timestamp");
  });

  it("user-prompt emits one {} line and records the prompt verbatim", async () => {
    const ws = seedBmadWorkspace(trackWorkspace());
    const prompt = 'Implement story 1.3 with /bmad-build "wire the hook harness"';

    const res = await runHook(ws, "user-prompt", { prompt });
    const frame = assertSingleJsonLine(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.equal(state.lastUserPrompt, prompt);
    assert.equal(typeof state.lastUserPromptAt, "string");
    assert.deepEqual(state.recentTouchedFiles, []);
  });

  it("post-tool emits one {} line and records the ws-relative touched path", async () => {
    const ws = seedBmadWorkspace(trackWorkspace());
    const relPath = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const filePath = ws.write(relPath, "development_status:\n  epic-1: in-progress\n");

    const res = await runHook(ws, "post-tool", { tool_input: { file_path: filePath } });
    const frame = assertSingleJsonLine(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.ok(Array.isArray(state.recentTouchedFiles));
    assert.ok(
      state.recentTouchedFiles.includes(relPath),
      `recentTouchedFiles must contain ${relPath}, got ${JSON.stringify(state.recentTouchedFiles)}`
    );
  });

  it("post-tool confinement: a file_path outside the workspace root is not recorded", async () => {
    const ws = seedBmadWorkspace(trackWorkspace());
    const outsidePath = join(ws.root, "..", "hook-escape-target.md");

    const res = await runHook(ws, "post-tool", { tool_input: { file_path: outsidePath } });
    const frame = assertSingleJsonLine(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.deepEqual(state.recentTouchedFiles, []);
  });

  it("stop emits one {} line, increments turnCount, and skips synthesis without API keys", async () => {
    const ws = seedBmadWorkspace(trackWorkspace());
    const assistantMessage = "Implemented the hook stdout-isolation harness.";

    const res = await runHook(ws, "stop", { last_assistant_message: assistantMessage });
    const frame = assertSingleJsonLine(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.equal(state.turnCount, 1);
    assert.equal(state.lastAssistantMessage, assistantMessage);
    assert.equal(typeof state.lastTurnAnalyzedAt, "string");
    // Keys are stripped by runHook env overrides, so synthesis must be skipped.
    assert.equal(state.agentAdvisorOverride ?? null, null);
  });

  it("malformed stdin falls back to {} payload and still emits one {} line", async () => {
    const ws = seedBmadWorkspace(trackWorkspace());

    // Raw invalid JSON: readStdinJson catch -> {}; workspace root comes from
    // ZCODE_PROJECT_DIR since payload.cwd is unavailable.
    const res = await runHook(ws, "user-prompt", {}, { stdin: "{not-json" });
    const frame = assertSingleJsonLine(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.equal(state.lastUserPrompt, "");
  });

  it("unknown mode falls back to one {} line without state side effects", async () => {
    const ws = seedBmadWorkspace(trackWorkspace());

    const res = await runHook(ws, "bogus-mode", {});
    const frame = assertSingleJsonLine(res);
    assert.deepEqual(frame, {});

    assert.equal(
      ws.exists(".zcode/bmad-companion/state.json"),
      false,
      "fallback branch must not create workspace state"
    );
  });

  it("four-mode lifecycle on one seeded workspace accumulates state across runs", async () => {
    const ws = seedBmadWorkspace(trackWorkspace());
    const prompt = 'Run /bmad-build-auto "implement epic 1 story 3"';
    const relPath = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const filePath = ws.write(relPath, "development_status:\n  epic-1: in-progress\n");
    const assistantMessage = "Story 3 harness implemented and verified.";

    // 1. SessionStart
    const startFrame = assertSingleJsonLine(await runHook(ws, "session-start", {}));
    assert.ok(startFrame.additionalContext.includes("[BMAD Companion Active for"));
    const afterStart = readJsonFile(ws.statePath);
    assert.equal(typeof afterStart.lastSessionStartAt, "string");

    // 2. UserPromptSubmit (resets recentTouchedFiles by contract)
    assert.deepEqual(assertSingleJsonLine(await runHook(ws, "user-prompt", { prompt })), {});
    const afterPrompt = readJsonFile(ws.statePath);
    assert.equal(afterPrompt.lastUserPrompt, prompt);
    assert.equal(afterPrompt.lastSessionStartAt, afterStart.lastSessionStartAt);
    assert.deepEqual(afterPrompt.recentTouchedFiles, []);

    // 3. PostToolUse
    assert.deepEqual(
      assertSingleJsonLine(await runHook(ws, "post-tool", { tool_input: { file_path: filePath } })),
      {}
    );
    const afterTool = readJsonFile(ws.statePath);
    assert.ok(afterTool.recentTouchedFiles.includes(relPath));
    assert.equal(afterTool.lastUserPrompt, prompt);

    // 4. Stop
    assert.deepEqual(
      assertSingleJsonLine(await runHook(ws, "stop", { last_assistant_message: assistantMessage })),
      {}
    );

    // Cumulative state: every mode's writes merged into the same state.json.
    const finalState = readJsonFile(ws.statePath);
    assert.equal(finalState.lastSessionStartAt, afterStart.lastSessionStartAt);
    assert.equal(finalState.lastUserPrompt, prompt);
    assert.ok(finalState.recentTouchedFiles.includes(relPath));
    assert.equal(finalState.turnCount, 1);
    assert.equal(finalState.lastAssistantMessage, assistantMessage);

    // All writes stayed inside the temp workspace state file: no tracker
    // backups or reconciliation logs, and no state leakage into the repo.
    assert.equal(ws.exists(".zcode/bmad-companion/reconciliation-log.json"), false);
    assert.equal(ws.exists("_bmad-output/implementation-artifacts/sprint-status.yaml.bak"), false);
  });
});
