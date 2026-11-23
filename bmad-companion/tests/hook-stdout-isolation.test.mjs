import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  assertSingleJsonObjectStdout,
  createTempWorkspaceTracker,
  readJsonFile,
  runHookRunner
} from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

describe("bmad-companion hook stdout-isolation harness", () => {
  it("session-start emits one {additionalContext} line and records lastSessionStartAt", async () => {
    const ws = workspaces.seed();

    const res = await runHookRunner({ workspaceRoot: ws.root, mode: "session-start", payload: {} });
    const frame = assertSingleJsonObjectStdout(res);

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
    const ws = workspaces.seed();
    const prompt = 'Implement story 1.3 with /bmad-build "wire the hook harness"';

    const res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt }
    });
    const frame = assertSingleJsonObjectStdout(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.equal(state.lastUserPrompt, prompt);
    assert.equal(typeof state.lastUserPromptAt, "string");
    assert.deepEqual(state.recentTouchedFiles, []);
  });

  it("post-tool emits one {} line and records the ws-relative touched path", async () => {
    const ws = workspaces.seed();
    const relPath = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const filePath = ws.write(relPath, "development_status:\n  epic-1: in-progress\n");

    const res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "post-tool",
      payload: { tool_input: { file_path: filePath } }
    });
    const frame = assertSingleJsonObjectStdout(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.ok(Array.isArray(state.recentTouchedFiles));
    assert.ok(
      state.recentTouchedFiles.includes(relPath),
      `recentTouchedFiles must contain ${relPath}, got ${JSON.stringify(state.recentTouchedFiles)}`
    );
  });

  it("post-tool confinement: a file_path outside the workspace root is not recorded", async () => {
    const ws = workspaces.seed();
    const outsidePath = join(ws.root, "..", "hook-escape-target.md");

    const res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "post-tool",
      payload: { tool_input: { file_path: outsidePath } }
    });
    const frame = assertSingleJsonObjectStdout(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.deepEqual(state.recentTouchedFiles, []);
  });

  it("stop emits one {} line, increments turnCount, and skips synthesis without API keys", async () => {
    const ws = workspaces.seed();
    const assistantMessage = "Implemented the hook stdout-isolation harness.";

    const res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: assistantMessage }
    });
    const frame = assertSingleJsonObjectStdout(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.equal(state.turnCount, 1);
    assert.equal(state.lastAssistantMessage, assistantMessage);
    assert.equal(typeof state.lastTurnAnalyzedAt, "string");
    // Keys are stripped by runHookRunner env overrides, so synthesis must be skipped.
    assert.equal(state.agentAdvisorOverride ?? null, null);
  });

  it("malformed stdin falls back to {} payload and still emits one {} line", async () => {
    const ws = workspaces.seed();

    // Raw invalid JSON: readStdinJson catch -> {}; workspace root comes from
    // ZCODE_PROJECT_DIR since payload.cwd is unavailable.
    const res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: {},
      stdin: "{not-json"
    });
    const frame = assertSingleJsonObjectStdout(res);
    assert.deepEqual(frame, {});

    const state = readJsonFile(ws.statePath);
    assert.equal(state.lastUserPrompt, "");
  });

  it("unknown mode falls back to one {} line without state side effects", async () => {
    const ws = workspaces.seed();

    const res = await runHookRunner({ workspaceRoot: ws.root, mode: "bogus-mode", payload: {} });
    const frame = assertSingleJsonObjectStdout(res);
    assert.deepEqual(frame, {});

    assert.equal(
      ws.exists(".zcode/bmad-companion/state.json"),
      false,
      "fallback branch must not create workspace state"
    );
  });

  it("four-mode lifecycle on one seeded workspace accumulates state across runs", async () => {
    const ws = workspaces.seed();
    const prompt = 'Run /bmad-build-auto "implement epic 1 story 3"';
    const relPath = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const filePath = ws.write(relPath, "development_status:\n  epic-1: in-progress\n");
    const assistantMessage = "Story 3 harness implemented and verified.";

    // 1. SessionStart
    const startFrame = assertSingleJsonObjectStdout(
      await runHookRunner({ workspaceRoot: ws.root, mode: "session-start", payload: {} })
    );
    assert.ok(startFrame.additionalContext.includes("[BMAD Companion Active for"));
    const afterStart = readJsonFile(ws.statePath);
    assert.equal(typeof afterStart.lastSessionStartAt, "string");

    // 2. UserPromptSubmit (resets recentTouchedFiles by contract)
    assert.deepEqual(
      assertSingleJsonObjectStdout(
        await runHookRunner({ workspaceRoot: ws.root, mode: "user-prompt", payload: { prompt } })
      ),
      {}
    );
    const afterPrompt = readJsonFile(ws.statePath);
    assert.equal(afterPrompt.lastUserPrompt, prompt);
    assert.equal(afterPrompt.lastSessionStartAt, afterStart.lastSessionStartAt);
    assert.deepEqual(afterPrompt.recentTouchedFiles, []);

    // 3. PostToolUse
    assert.deepEqual(
      assertSingleJsonObjectStdout(
        await runHookRunner({
          workspaceRoot: ws.root,
          mode: "post-tool",
          payload: { tool_input: { file_path: filePath } }
        })
      ),
      {}
    );
    const afterTool = readJsonFile(ws.statePath);
    assert.ok(afterTool.recentTouchedFiles.includes(relPath));
    assert.equal(afterTool.lastUserPrompt, prompt);

    // 4. Stop
    assert.deepEqual(
      assertSingleJsonObjectStdout(
        await runHookRunner({
          workspaceRoot: ws.root,
          mode: "stop",
          payload: { last_assistant_message: assistantMessage }
        })
      ),
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
