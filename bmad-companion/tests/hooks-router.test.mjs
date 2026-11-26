import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import {
  loadPersistedState,
  manageBmadTaskQueue,
  savePersistedState,
  scanBmadWorkspace,
  updateAdvisorState
} from "../scripts/bmad-engine.mjs";
import {
  REPO_ROOT,
  assertSingleJsonObjectStdout,
  createTempWorkspaceTracker,
  readJsonFile,
  runHookRunner
} from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

function startStubLlmServer(handler) {
  const requests = [];
  const sockets = new Set();
  const server = createServer((req, res) => {
    let rawBody = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      rawBody += chunk;
    });
    req.on("end", () => {
      let parsedBody = null;
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : null;
      } catch {}
      const entry = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        rawBody,
        body: parsedBody,
        receivedAt: performance.now(),
        closedAt: null,
        aborted: false
      };
      req.on("close", () => {
        entry.closedAt = performance.now();
        if (!res.writableEnded) {
          entry.aborted = true;
        }
      });
      requests.push(entry);
      handler(req, res, entry);
    });
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        requests,
        close() {
          for (const socket of sockets) {
            try {
              socket.destroy();
            } catch {}
          }
          return new Promise((done) => server.close(() => done()));
        }
      });
    });
  });
}

describe("Epic 6 Story 6.5: Stop hook turn synthesis + queue auto-advance + optional LLM", () => {
  it("increments turnCount across turns, stores lastAssistantMessage (or responseText / transcript fallback, <=6000 chars), and finishes within the <=350ms deterministic budget without API keys (C11, C12)", async () => {
    const ws = workspaces.create();
    savePersistedState(ws.root, {
      lastUserPrompt: '/bmad-build "Implement Story 6.5 Stop hook turn synthesis"'
    });

    // Turn 1: deterministic Stop without API key
    const t0 = performance.now();
    const res1 = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: {
        last_assistant_message: "Turn 1: Implemented deterministic Stop turn state."
      }
    });
    const elapsed1 = performance.now() - t0;
    const frame1 = assertSingleJsonObjectStdout(res1);
    assert.deepEqual(frame1, {});
    assert.ok(
      elapsed1 <= 350,
      `C11: deterministic Stop hook must complete in <= 350ms, took ${elapsed1.toFixed(1)}ms`
    );

    const state1 = readJsonFile(ws.statePath);
    assert.equal(state1.turnCount, 1);
    assert.equal(state1.lastAssistantMessage, "Turn 1: Implemented deterministic Stop turn state.");
    assert.equal(typeof state1.lastTurnAnalyzedAt, "string");
    assert.equal(state1.agentAdvisorOverride ?? null, null);

    // Turn 2: responseText payload fallback + 6000-char cap
    const oversizedResponse = "A".repeat(6500);
    const res2 = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: {
        responseText: oversizedResponse
      }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(res2), {});
    const state2 = readJsonFile(ws.statePath);
    assert.equal(state2.turnCount, 2);
    assert.equal(state2.lastAssistantMessage.length, 6000);
    assert.equal(state2.lastAssistantMessage, "A".repeat(6000));

    // Turn 3: transcript_path JSONL fallback when last_assistant_message/responseText are omitted
    const transcriptPath = ws.write(
      "turn-transcript.jsonl",
      [
        JSON.stringify({ message: { content: [{ text: "Earlier assistant turn" }] } }),
        JSON.stringify({ message: { content: [{ text: "Final assistant message from transcript" }] } })
      ].join("\n") + "\n"
    );
    const res3 = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: {
        transcript_path: transcriptPath
      }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(res3), {});
    const state3 = readJsonFile(ws.statePath);
    assert.equal(state3.turnCount, 3);
    assert.equal(state3.lastAssistantMessage, "Final assistant message from transcript");
  });

  it("auto-completes a running single-session task via prompt prefix, upgraded effectivePrompt, or storyId reference, syncs storyOverrides, and skips orchestrator or foreign-session turns", async () => {
    const ws = workspaces.seed();
    const added = manageBmadTaskQueue(ws.root, {
      action: "add",
      executionMode: "separate-sessions",
      items: [
        {
          title: "Story 1: Upgraded /bmad-build prompt",
          skill: "/bmad-build",
          prompt: '/bmad-build "Harden Stop hook queue auto-advance and turn state"',
          model: "new-provider/model-a",
          reviewMode: "none",
          storyId: "1",
          overrideKey: "epic-core#1"
        },
        {
          title: "Story 2: Story reference match",
          skill: "/bmad-build-auto",
          prompt: '/bmad-build-auto "Verify story 1.2 scan contract in epic-core"',
          model: "new-provider/model-b",
          reviewMode: "quick",
          storyId: "1.2",
          overrideKey: "epic-core#2"
        }
      ]
    });
    const [task1, task2] = added.taskQueue.items;

    manageBmadTaskQueue(ws.root, { action: "start-queue", executionMode: "separate-sessions" });
    manageBmadTaskQueue(ws.root, {
      action: "start-task",
      taskId: task1.id,
      sessionId: "sess_zcode_1"
    });

    // 1. Queue-orchestrator prompt must never auto-complete the running task
    savePersistedState(ws.root, {
      lastUserPrompt: 'Execute the active @bmad-companion Task Queue via .zcode/workflows/bmad-task-queue.dwf.ts'
    });
    const orchRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Orchestrator launched child session." },
      env: { ZCODE_SESSION_ID: "sess_zcode_1" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(orchRes), {});
    assert.equal(
      loadPersistedState(ws.root).taskQueue.items.find((it) => it.id === task1.id).status,
      "running",
      "orchestrator prompt must not auto-complete the running task"
    );

    // 2. Foreign ZCODE_SESSION_ID must not auto-complete task1
    savePersistedState(ws.root, {
      lastUserPrompt: task1.effectivePrompt
    });
    const foreignRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Unrelated session turn." },
      env: { ZCODE_SESSION_ID: "sess_intruder" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(foreignRes), {});
    assert.equal(
      loadPersistedState(ws.root).taskQueue.items.find((it) => it.id === task1.id).status,
      "running"
    );

    // 3. Owning ZCODE_SESSION_ID with upgraded effectivePrompt (/bmad-build -> /bmad-build-auto)
    //    auto-completes task1, syncs storyOverrides["epic-core#1"] = done, and emits block continuation for task2
    const done1Res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: {
        last_assistant_message: "Completed   task 1\nwith   full   verification."
      },
      env: { ZCODE_SESSION_ID: "sess_zcode_1" }
    });
    const frame1 = assertSingleJsonObjectStdout(done1Res);
    assert.equal(frame1.decision, "block");
    assert.match(frame1.reason, /BMAD Companion queue continuation/);
    assert.ok(frame1.reason.includes(task2.id));
    assert.ok(frame1.reason.includes(task2.model));

    const afterTask1 = loadPersistedState(ws.root);
    const item1 = afterTask1.taskQueue.items.find((it) => it.id === task1.id);
    assert.equal(item1.status, "done");
    assert.equal(item1.resultSummary, "Completed task 1 with full verification.");
    assert.equal(afterTask1.storyOverrides["epic-core#1"]?.status, "done");
    assert.equal(
      afterTask1.storyOverrides["epic-core#1"]?.reason,
      "Completed task 1 with full verification."
    );

    // 4. Start task2 and match via `ticket 1.2` story reference (even when prompt prefix differs)
    manageBmadTaskQueue(ws.root, {
      action: "start-task",
      taskId: task2.id,
      sessionId: "sess_zcode_2"
    });
    savePersistedState(ws.root, {
      lastUserPrompt: "Please finish ticket 1.2 and run the verification suite."
    });
    const done2Res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Ticket 1.2 verified and closed." },
      env: { ZCODE_SESSION_ID: "sess_zcode_2" }
    });
    // Final task in queue -> queue transitions to completed, no continuation block
    assert.deepEqual(assertSingleJsonObjectStdout(done2Res), {});

    const afterTask2 = loadPersistedState(ws.root);
    assert.equal(afterTask2.taskQueue.status, "completed");
    assert.equal(afterTask2.taskQueue.activeTaskId, null);
    assert.equal(afterTask2.taskQueue.items.find((it) => it.id === task2.id).status, "done");
    assert.equal(afterTask2.storyOverrides["epic-core#2"]?.status, "done");
  });

  it("calls optional OpenAI-compatible synthesis when BMAD_COMPANION_OPENAI_KEY or OPENAI_API_KEY is set and persists agentAdvisorOverride (R4, C12)", async () => {
    const ws = workspaces.seed();
    savePersistedState(ws.root, {
      lastUserPrompt: '/bmad-build "Complete Story 6.5 Stop synthesis"',
      hostModels: [
        {
          id: "new-provider/gemini-4-argon-high",
          modelId: "gemini-4-argon-high",
          providerId: "new-provider",
          providerLabel: "New Provider",
          current: true
        }
      ]
    });

    const llm = await startStubLlmServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: "Story 6.5 Stop synthesis verified",
                  turnSummary: "Stop hook persisted synthesized next-step recommendations.",
                  recommendations: [
                    {
                      skill: "/bmad-code-review",
                      fullCommand:
                        '/bmad-code-review "Review Story 6.5 Stop hook turn synthesis and timeout guards"',
                      title: "Review Story 6.5 Stop Hook",
                      rationale: "Verify timeout and stdout isolation invariants.",
                      recommendedModel: "new-provider/gemini-4-argon-high",
                      modelReason: "Fast high-context verification",
                      phase: "4-implementation",
                      priority: "high"
                    }
                  ]
                })
              }
            }
          ]
        })
      );
    });

    try {
      const res = await runHookRunner({
        workspaceRoot: ws.root,
        mode: "stop",
        payload: {
          last_assistant_message: "Implemented Story 6.5 Stop hook synthesis and tests."
        },
        env: {
          BMAD_COMPANION_OPENAI_KEY: "sk-bmad-priority-key",
          OPENAI_API_KEY: "sk-fallback-key",
          BMAD_COMPANION_OPENAI_BASE_URL: `${llm.baseUrl}/`,
          BMAD_COMPANION_MODEL: "gpt-4.1-mini"
        }
      });

      assert.deepEqual(assertSingleJsonObjectStdout(res), {});
      assert.equal(llm.requests.length, 1);

      const req = llm.requests[0];
      assert.equal(req.method, "POST");
      assert.equal(req.url, "/v1/chat/completions");
      assert.equal(
        req.headers.authorization,
        "Bearer sk-bmad-priority-key",
        "BMAD_COMPANION_OPENAI_KEY must take precedence over OPENAI_API_KEY"
      );
      assert.equal(req.body.model, "gpt-4.1-mini");
      assert.deepEqual(req.body.response_format, { type: "json_object" });

      const userPayload = JSON.parse(req.body.messages[1].content);
      assert.equal(userPayload.lastUserPrompt, '/bmad-build "Complete Story 6.5 Stop synthesis"');
      assert.equal(
        userPayload.lastAssistantMessage,
        "Implemented Story 6.5 Stop hook synthesis and tests."
      );
      assert.ok(Array.isArray(userPayload.availableModels));
      assert.ok(userPayload.availableModels.includes("new-provider/gemini-4-argon-high"));

      const state = readJsonFile(ws.statePath);
      assert.equal(state.turnCount, 1);
      assert.ok(state.agentAdvisorOverride);
      assert.equal(state.agentAdvisorOverride.headline, "Story 6.5 Stop synthesis verified");
      assert.equal(
        state.agentAdvisorOverride.turnSummary,
        "Stop hook persisted synthesized next-step recommendations."
      );
      assert.equal(state.agentAdvisorOverride.recommendations.length, 1);
      assert.equal(typeof state.agentAdvisorOverride.updatedAt, "string");

      // Confirm scanBmadWorkspace surfaces the synthesized advisor override
      const scan = scanBmadWorkspace(ws.root);
      assert.equal(scan.turnAnalysis.aiSummaryHeadline, "Story 6.5 Stop synthesis verified");
      assert.equal(scan.recommendations[0].title, "Review Story 6.5 Stop Hook");
      assert.equal(scan.recommendations[0].badge, "AI Turn Synthesis");
    } finally {
      await llm.close();
    }
  });

  it("falls back silently when optional LLM returns HTTP error, invalid JSON, or empty recommendations", async () => {
    const ws = workspaces.create();
    savePersistedState(ws.root, {
      lastUserPrompt: '/bmad-build "Test silent LLM fallbacks"'
    });

    let mode = "http-500";
    const llm = await startStubLlmServer((_req, res) => {
      if (mode === "http-500") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "upstream failure" }));
        return;
      }
      if (mode === "bad-json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: "{not-valid-json" } }]
          })
        );
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: "Empty recs",
                  turnSummary: "Should not overwrite advisor",
                  recommendations: []
                })
              }
            }
          ]
        })
      );
    });

    try {
      for (const [idx, nextMode] of ["http-500", "bad-json", "empty-recs"].entries()) {
        mode = nextMode;
        const res = await runHookRunner({
          workspaceRoot: ws.root,
          mode: "stop",
          payload: { last_assistant_message: `Turn ${idx + 1} (${nextMode})` },
          env: {
            OPENAI_API_KEY: "sk-test-fallback",
            BMAD_COMPANION_OPENAI_BASE_URL: llm.baseUrl
          }
        });
        assert.deepEqual(assertSingleJsonObjectStdout(res), {});
        const state = readJsonFile(ws.statePath);
        assert.equal(state.turnCount, idx + 1);
        assert.equal(state.lastAssistantMessage, `Turn ${idx + 1} (${nextMode})`);
        assert.equal(state.agentAdvisorOverride ?? null, null);
      }
      assert.equal(llm.requests.length, 3);
    } finally {
      await llm.close();
    }
  });

  it("aborts a stubbed slow LLM at 4500ms via AbortSignal.timeout(4500) and falls back silently within the <=4800ms LLM budget (C11, C12)", async () => {
    const ws = workspaces.create();
    savePersistedState(ws.root, {
      lastUserPrompt: '/bmad-build "Verify 4500ms AbortSignal timeout on slow LLM"'
    });

    const timers = new Set();
    const llm = await startStubLlmServer((_req, res) => {
      // Intentionally stall for 10s so AbortSignal.timeout(4500) aborts the fetch
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!res.writableEnded) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end("{}");
        }
      }, 10000);
      timers.add(timer);
    });

    try {
      const t0 = performance.now();
      const res = await runHookRunner({
        workspaceRoot: ws.root,
        mode: "stop",
        payload: {
          last_assistant_message: "Turn completed before slow LLM timeout."
        },
        env: {
          BMAD_COMPANION_OPENAI_KEY: "sk-slow-timeout",
          BMAD_COMPANION_OPENAI_BASE_URL: llm.baseUrl
        },
        timeoutMs: 8000
      });
      const totalElapsedMs = performance.now() - t0;

      const frame = assertSingleJsonObjectStdout(res);
      assert.deepEqual(frame, {});

      assert.equal(llm.requests.length, 1, "slow LLM server must receive the synthesis POST");
      const reqEntry = llm.requests[0];
      assert.equal(reqEntry.aborted, true, "slow LLM request must be aborted before response ends");
      assert.ok(
        totalElapsedMs >= 4400 && totalElapsedMs <= 4800,
        `C11/C12: Stop hook with slow LLM must abort at ~4500ms within <=4800ms budget (got ${totalElapsedMs.toFixed(1)}ms)`
      );

      const state = readJsonFile(ws.statePath);
      assert.equal(state.turnCount, 1);
      assert.equal(state.lastAssistantMessage, "Turn completed before slow LLM timeout.");
      assert.equal(state.agentAdvisorOverride ?? null, null);
    } finally {
      for (const timer of timers) clearTimeout(timer);
      await llm.close();
    }
  });

  it("covers deferred hook adapter paths: default session-start mode, user-prompt transcript fallback + auto-start, and post-tool 15-file cap", async () => {
    const ws = workspaces.seed();

    // 1. Omitted mode defaults to session-start
    const defaultModeRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: undefined,
      payload: {}
    });
    const startFrame = assertSingleJsonObjectStdout(defaultModeRes);
    assert.ok(startFrame.additionalContext.includes("[BMAD Companion Active for"));

    // 2. user-prompt transcript_path fallback + queue auto-start
    const added = manageBmadTaskQueue(ws.root, {
      action: "add",
      executionMode: "separate-sessions",
      items: [
        {
          title: "Story 1: Transcript auto-start",
          prompt: '/bmad-build-auto "Auto-start task from transcript fallback in user-prompt"',
          model: "new-provider/model-a",
          reviewMode: "none"
        }
      ]
    });
    const queuedTask = added.taskQueue.items[0];
    const transcriptFile = ws.write(
      "user-prompt.jsonl",
      JSON.stringify({
        message: {
          content: [{ text: queuedTask.prompt }]
        }
      }) + "\n"
    );

    const promptRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { transcript_path: transcriptFile },
      env: { ZCODE_SESSION_ID: "sess_transcript_1" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(promptRes), {});
    const afterPrompt = readJsonFile(ws.statePath);
    assert.equal(afterPrompt.lastUserPrompt, queuedTask.prompt);
    assert.equal(afterPrompt.taskQueue.activeTaskId, queuedTask.id);
    assert.equal(
      afterPrompt.taskQueue.items.find((it) => it.id === queuedTask.id)?.sessionId,
      "sess_transcript_1"
    );

    // 3. post-tool supports tool_input.path and toolInput.file_path and caps recentTouchedFiles at 15
    for (let i = 1; i <= 18; i++) {
      const rel = `docs/file-${i}.md`;
      const payload =
        i % 2 === 0
          ? { tool_input: { path: rel } }
          : { toolInput: { file_path: rel } };
      const toolRes = await runHookRunner({
        workspaceRoot: ws.root,
        mode: "post-tool",
        payload
      });
      assert.deepEqual(assertSingleJsonObjectStdout(toolRes), {});
    }

    const afterTools = readJsonFile(ws.statePath);
    assert.equal(afterTools.recentTouchedFiles.length, 15);
    assert.equal(afterTools.recentTouchedFiles[0], "docs/file-4.md");
    assert.equal(afterTools.recentTouchedFiles[14], "docs/file-18.md");
  });
});

describe("Epic 7 Story 7.1: rolling 3-conversation memory (AD-3 / AD-18)", () => {
  it("savePersistedState upserts by sessionId: moves to index 0, preserves non-empty snippets, dedups, and caps at 3 newest-first", () => {
    const ws = workspaces.create();

    savePersistedState(ws.root, {
      recentConversations: [
        { sessionId: "s1", promptSnippet: "first prompt", outcomeSnippet: "first outcome", completedAt: "2026-11-25T10:00:00.000Z" }
      ]
    });
    savePersistedState(ws.root, {
      recentConversations: [{ sessionId: "s2", promptSnippet: "second prompt" }]
    });
    savePersistedState(ws.root, {
      recentConversations: [{ sessionId: "s3", promptSnippet: "third prompt" }]
    });

    // Upsert s2 with a new promptSnippet only: moves to index 0, outcomeSnippet
    // (absent here) would be preserved if present, no duplicate sessionId.
    savePersistedState(ws.root, {
      recentConversations: [{ sessionId: "s2", promptSnippet: "second prompt refined" }]
    });
    let buffer = loadPersistedState(ws.root).recentConversations;
    assert.deepEqual(buffer.map((c) => c.sessionId), ["s2", "s3", "s1"]);
    assert.equal(buffer[0].promptSnippet, "second prompt refined");

    // A 4th session evicts the oldest (s1); newest is index 0; no duplicates.
    savePersistedState(ws.root, {
      recentConversations: [{ sessionId: "s4", promptSnippet: "fourth prompt" }]
    });
    buffer = loadPersistedState(ws.root).recentConversations;
    assert.deepEqual(buffer.map((c) => c.sessionId), ["s4", "s2", "s3"]);
    assert.equal(new Set(buffer.map((c) => c.sessionId)).size, buffer.length);

    // Field preservation: an empty/omitted snippet never blanks a recorded one,
    // and completedAt survives a prompt-only partial update.
    savePersistedState(ws.root, {
      recentConversations: [{ sessionId: "s4", promptSnippet: "", outcomeSnippet: "   " }]
    });
    buffer = loadPersistedState(ws.root).recentConversations;
    assert.equal(buffer[0].sessionId, "s4");
    assert.equal(buffer[0].promptSnippet, "fourth prompt");

    // Omitted recentConversations leaves the array untouched.
    const beforeOmitted = JSON.stringify(buffer);
    savePersistedState(ws.root, { lastUserPrompt: "unrelated write" });
    assert.equal(JSON.stringify(loadPersistedState(ws.root).recentConversations), beforeOmitted);

    // Entries without a sessionId are skipped (no fallback entries).
    savePersistedState(ws.root, {
      recentConversations: [{ promptSnippet: "no session" }, { sessionId: "", promptSnippet: "empty session" }]
    });
    assert.equal(JSON.stringify(loadPersistedState(ws.root).recentConversations), beforeOmitted);
  });

  it("hook capture: user-prompt records promptSnippet <=300, Stop records outcomeSnippet <=400 + completedAt + touchedCount, within the <=350ms budget and one stdout line", async () => {
    const ws = workspaces.create();
    const longPrompt = "P".repeat(500);
    const longOutcome = "O".repeat(700);

    const promptRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: longPrompt },
      env: { ZCODE_SESSION_ID: "sess_capture_1" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(promptRes), {});
    let state = readJsonFile(ws.statePath);
    assert.equal(state.recentConversations.length, 1);
    assert.equal(state.recentConversations[0].sessionId, "sess_capture_1");
    assert.equal(state.recentConversations[0].promptSnippet.length, 300);
    assert.equal(state.recentConversations[0].promptSnippet, "P".repeat(300));
    assert.equal(state.recentConversations[0].outcomeSnippet ?? "", "");

    // Two touched files before Stop -> touchedCount reflects recentTouchedFiles.
    for (const rel of ["docs/a.md", "docs/b.md"]) {
      await runHookRunner({
        workspaceRoot: ws.root,
        mode: "post-tool",
        payload: { tool_input: { file_path: rel } }
      });
    }

    const t0 = performance.now();
    const stopRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: longOutcome },
      env: { ZCODE_SESSION_ID: "sess_capture_1" }
    });
    const elapsed = performance.now() - t0;
    assert.deepEqual(assertSingleJsonObjectStdout(stopRes), {});
    assert.ok(elapsed <= 350, `C11: deterministic Stop with capture must stay <= 350ms, took ${elapsed.toFixed(1)}ms`);

    state = readJsonFile(ws.statePath);
    assert.equal(state.recentConversations.length, 1, "same session upserts, never duplicates");
    const entry = state.recentConversations[0];
    assert.equal(entry.sessionId, "sess_capture_1");
    assert.equal(entry.promptSnippet, "P".repeat(300), "Stop must not blank the recorded promptSnippet");
    assert.equal(entry.outcomeSnippet.length, 400);
    assert.equal(entry.outcomeSnippet, "O".repeat(400));
    assert.ok(!Number.isNaN(Date.parse(entry.completedAt)));
    assert.equal(entry.touchedCount, 2);
    assert.equal(state.turnCount, 1);
  });

  it("hook capture accepts payload.session_id fallback, and skips conversation capture (only) when no sessionId is known", async () => {
    const ws = workspaces.create();

    // payload.session_id fallback (env stripped by runHookRunner).
    const fallbackRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "fallback session prompt", session_id: "sess_payload_1" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(fallbackRes), {});
    let state = readJsonFile(ws.statePath);
    assert.equal(state.recentConversations.length, 1);
    assert.equal(state.recentConversations[0].sessionId, "sess_payload_1");
    assert.equal(state.recentConversations[0].promptSnippet, "fallback session prompt");

    // No sessionId anywhere: other state writes proceed, zero conversation entries.
    const noSessionRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "No session turn." }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(noSessionRes), {});
    state = readJsonFile(ws.statePath);
    assert.equal(state.turnCount, 1);
    assert.equal(state.lastAssistantMessage, "No session turn.");
    assert.equal(state.recentConversations.length, 1, "no fallback entry may be created without a sessionId");
    assert.equal(state.recentConversations[0].sessionId, "sess_payload_1");
  });

  it("acceptance: a 4th session's hook evicts the oldest of 3 recorded conversations, newest first, no duplicate sessionId", async () => {
    const ws = workspaces.create();
    for (const sessionId of ["sess_a", "sess_b", "sess_c"]) {
      const res = await runHookRunner({
        workspaceRoot: ws.root,
        mode: "user-prompt",
        payload: { prompt: `prompt for ${sessionId}` },
        env: { ZCODE_SESSION_ID: sessionId }
      });
      assert.deepEqual(assertSingleJsonObjectStdout(res), {});
    }
    let buffer = readJsonFile(ws.statePath).recentConversations;
    assert.deepEqual(buffer.map((c) => c.sessionId), ["sess_c", "sess_b", "sess_a"]);

    const fourth = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "prompt for sess_d" },
      env: { ZCODE_SESSION_ID: "sess_d" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(fourth), {});
    buffer = readJsonFile(ws.statePath).recentConversations;
    assert.deepEqual(buffer.map((c) => c.sessionId), ["sess_d", "sess_c", "sess_b"]);
    assert.equal(new Set(buffer.map((c) => c.sessionId)).size, 3);
  });
});

describe("Epic 7 Story 7.2: same-turn-safe focus freshness + Stop focus synthesis (AD-18)", () => {
  it("a fresh advisor focusSummary survives same-session Stop seconds later, then expires when a different session completes", async () => {
    const ws = workspaces.create();

    // Turn starts in sess_focus_1.
    await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "Improve the checkout flow" },
      env: { ZCODE_SESSION_ID: "sess_focus_1" }
    });

    // Advisor writes a jargon-free focusSummary mid-turn, bound to sess_focus_1.
    updateAdvisorState(ws.root, {
      focusSummary: "The checkout flow now validates payment details before submitting the order.",
      sessionId: "sess_focus_1"
    });

    // Stop fires seconds later for the SAME session: override must survive.
    const sameStop = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Checkout validation implemented and verified." },
      env: { ZCODE_SESSION_ID: "sess_focus_1" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(sameStop), {});
    let focus = scanBmadWorkspace(ws.root).turnAnalysis.currentFocus;
    assert.equal(focus.source, "advisor-override");
    assert.equal(focus.text, "The checkout flow now validates payment details before submitting the order.");
    assert.equal(focus.basisLabel, "Current focus");
    assert.equal(focus.conversationCount, 1);

    // A DIFFERENT session completes later: override expires -> deterministic.
    await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "Unrelated follow-up in another chat" },
      env: { ZCODE_SESSION_ID: "sess_focus_2" }
    });
    const otherStop = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Other session finished its own work." },
      env: { ZCODE_SESSION_ID: "sess_focus_2" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(otherStop), {});
    focus = scanBmadWorkspace(ws.root).turnAnalysis.currentFocus;
    assert.equal(focus.source, "deterministic");
    assert.equal(focus.conversationCount, 2);
    assert.ok(!focus.text.includes("checkout flow now validates"), "expired override text must not surface");
  });

  it("a newer prompt in the SAME session expires the focus override (lastUserPromptAt freshness branch)", async () => {
    const ws = workspaces.create();
    await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "First request in this chat" },
      env: { ZCODE_SESSION_ID: "sess_newprompt_1" }
    });
    updateAdvisorState(ws.root, {
      focusSummary: "The first request was handled and its result is verified.",
      sessionId: "sess_newprompt_1"
    });
    let focus = scanBmadWorkspace(ws.root).turnAnalysis.currentFocus;
    assert.equal(focus.source, "advisor-override");

    // A newer prompt starts in the same session: the override must expire even
    // though no other conversation has completed.
    await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "A newer request in the same chat" },
      env: { ZCODE_SESSION_ID: "sess_newprompt_1" }
    });
    focus = scanBmadWorkspace(ws.root).turnAnalysis.currentFocus;
    assert.equal(focus.source, "deterministic");
    assert.ok(!focus.text.includes("first request was handled"), "expired override text must not surface");
    assert.equal(focus.conversationCount, 1, "same session upserts, count stays honest");
  });

  it("an unbound focusSummary (no sessionId) survives same-session Stop, then expires on a newer prompt", async () => {
    const ws = workspaces.create();

    await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "Improve the search page" },
      env: { ZCODE_SESSION_ID: "sess_unbound_1" }
    });

    // Advisor writes a focusSummary WITHOUT a sessionId binding.
    updateAdvisorState(ws.root, {
      focusSummary: "The search page now filters results as you type."
    });
    assert.equal(
      loadPersistedState(ws.root).agentAdvisorOverride.focusSummarySessionId ?? null,
      null,
      "no binding may be invented for an unbound focusSummary"
    );

    // Same-session Stop stamps completedAt > updatedAt on its own entry; the
    // unbound summary must survive (no conversation binding to compare against).
    const stopRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Search filtering implemented and verified." },
      env: { ZCODE_SESSION_ID: "sess_unbound_1" }
    });
    assert.deepEqual(assertSingleJsonObjectStdout(stopRes), {});
    let focus = scanBmadWorkspace(ws.root).turnAnalysis.currentFocus;
    assert.equal(focus.source, "advisor-override");
    assert.equal(focus.text, "The search page now filters results as you type.");

    // Newer-prompt expiry still applies to unbound summaries.
    await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "A newer prompt in the same chat" },
      env: { ZCODE_SESSION_ID: "sess_unbound_1" }
    });
    focus = scanBmadWorkspace(ws.root).turnAnalysis.currentFocus;
    assert.equal(focus.source, "deterministic");
  });

  it("Stop LLM focusSummary persists with source stop-synthesis; jargon-laden focusSummary falls back to deterministic text", async () => {
    const ws = workspaces.create();
    await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      payload: { prompt: "Tidy the settings page" },
      env: { ZCODE_SESSION_ID: "sess_synth_1" }
    });

    let focusPayload = "The settings page now saves changes instantly and confirms each update.";
    const llm = await startStubLlmServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: "Settings turn synthesized",
                  turnSummary: "Settings page work completed.",
                  focusSummary: focusPayload,
                  recommendations: [
                    {
                      skill: "/bmad-code-review",
                      fullCommand: '/bmad-code-review "Review the settings page changes"',
                      title: "Review Settings Changes",
                      rationale: "Verify the settings save flow.",
                      phase: "4-implementation",
                      priority: "high"
                    }
                  ]
                })
              }
            }
          ]
        })
      );
    });

    try {
      const res = await runHookRunner({
        workspaceRoot: ws.root,
        mode: "stop",
        payload: { last_assistant_message: "Settings page saves instantly now." },
        env: {
          ZCODE_SESSION_ID: "sess_synth_1",
          BMAD_COMPANION_OPENAI_KEY: "sk-focus-synth",
          BMAD_COMPANION_OPENAI_BASE_URL: llm.baseUrl
        }
      });
      assert.deepEqual(assertSingleJsonObjectStdout(res), {});

      const state = readJsonFile(ws.statePath);
      assert.equal(state.agentAdvisorOverride.focusSummary, focusPayload);
      assert.equal(state.agentAdvisorOverride.focusSummarySource, "stop-synthesis");
      assert.equal(state.agentAdvisorOverride.focusSummarySessionId, "sess_synth_1");

      let focus = scanBmadWorkspace(ws.root).turnAnalysis.currentFocus;
      assert.equal(focus.source, "stop-synthesis");
      assert.equal(focus.text, focusPayload);

      // Second turn: jargon-laden focusSummary must be rejected at scan time.
      focusPayload = "Run /bmad-build in 4-implementation and update sprint-status.yaml for epic-core#1.";
      const jargonRes = await runHookRunner({
        workspaceRoot: ws.root,
        mode: "stop",
        payload: { last_assistant_message: "Settings follow-up turn completed." },
        env: {
          ZCODE_SESSION_ID: "sess_synth_1",
          BMAD_COMPANION_OPENAI_KEY: "sk-focus-synth",
          BMAD_COMPANION_OPENAI_BASE_URL: llm.baseUrl
        }
      });
      assert.deepEqual(assertSingleJsonObjectStdout(jargonRes), {});
      focus = scanBmadWorkspace(ws.root).turnAnalysis.currentFocus;
      assert.equal(focus.source, "deterministic");
      assert.ok(!/\/bmad-|4-implementation|sprint-status\.yaml|epic-core#1/.test(focus.text));
      assert.ok(focus.text.length > 0);
    } finally {
      await llm.close();
    }
  });
});

describe("Epic 7 Story 7.3: OQ-E PostToolUse matcher alignment", () => {
  it("hooks.json PostToolUse matcher is Write|Edit|MultiEdit (FR-21), not the legacy Edit|Write|Bash", () => {
    const hooksConfig = JSON.parse(readFileSync(join(REPO_ROOT, "hooks", "hooks.json"), "utf8"));
    const postToolUse = hooksConfig.hooks.PostToolUse;
    assert.ok(Array.isArray(postToolUse) && postToolUse.length > 0);
    assert.equal(postToolUse[0].matcher, "Write|Edit|MultiEdit");
    assert.ok(!postToolUse[0].matcher.includes("Bash"), "Bash must not trigger artifact tracking");
  });
});
