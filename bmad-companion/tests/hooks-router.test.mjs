import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import {
  loadPersistedState,
  manageBmadTaskQueue,
  savePersistedState,
  scanBmadWorkspace
} from "../scripts/bmad-engine.mjs";
import {
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
