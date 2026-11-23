import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer } from "node:http";

import { manageBmadTaskQueue } from "../scripts/bmad-engine.mjs";
import {
  assertSingleJsonObjectStdout,
  assertStrictJsonRpcStdout,
  createTempWorkspaceTracker,
  readJsonFile,
  runHookRunner,
  runMcpServer
} from "./helpers.mjs";

function withProcessEnv(overrides, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, prev] of previous.entries()) {
        if (prev === undefined) delete process.env[key];
        else process.env[key] = prev;
      }
    });
}

describe("bmad-companion test harness helpers", () => {
  const workspaces = createTempWorkspaceTracker(afterEach);

  it("cleanup() runs LIFO across all tracked workspaces, removes all dirs, and rethrows first error only after remaining cleanups run", () => {
    const tracker = createTempWorkspaceTracker();
    const ws1 = tracker.create({ prefix: "bmad-tracker-1-" });
    const ws2 = tracker.create({ prefix: "bmad-tracker-2-" });
    const ws3 = tracker.create({ prefix: "bmad-tracker-3-" });

    const roots = [ws1.root, ws2.root, ws3.root];
    for (const root of roots) {
      assert.equal(existsSync(root), true);
    }

    const cleanupOrder = [];
    const orig1 = ws1.cleanup;
    const orig2 = ws2.cleanup;
    const orig3 = ws3.cleanup;
    const firstError = new Error("first cleanup failure (ws3)");
    const secondError = new Error("second cleanup failure (ws2)");

    ws1.cleanup = () => {
      cleanupOrder.push("ws1");
      orig1();
    };
    ws2.cleanup = () => {
      cleanupOrder.push("ws2");
      orig2();
      throw secondError;
    };
    ws3.cleanup = () => {
      cleanupOrder.push("ws3");
      orig3();
      throw firstError;
    };

    try {
      assert.throws(
        () => tracker.cleanup(),
        (err) => {
          assert.equal(err, firstError);
          assert.deepEqual(
            cleanupOrder,
            ["ws3", "ws2", "ws1"],
            "all remaining cleanups must finish in LIFO order before rethrowing"
          );
          return true;
        }
      );

      for (const root of roots) {
        assert.equal(existsSync(root), false, `expected ${root} to be removed from disk`);
      }
    } finally {
      for (const orig of [orig1, orig2, orig3]) {
        try {
          orig();
        } catch {}
      }
    }
  });

  it("runHookRunner strips populated host API key and session ID env vars", async () => {
    const ws = workspaces.seed();
    const added = manageBmadTaskQueue(ws.root, {
      action: "add",
      executionMode: "separate-sessions",
      items: [
        {
          title: "Story 1: Env strip guard",
          prompt: '/bmad-build-auto "test env stripping"',
          model: "new-provider/model-a",
          reviewMode: "none"
        }
      ]
    });
    const first = added.taskQueue.items[0];
    manageBmadTaskQueue(ws.root, { action: "start-queue", executionMode: "separate-sessions" });

    let llmRequestCount = 0;
    const server = createServer((req, res) => {
      llmRequestCount++;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: "Mock synthesis",
                  turnSummary: "Received explicit key",
                  recommendations: [
                    {
                      skill: "/bmad-ux",
                      fullCommand: '/bmad-ux "Polish UX"',
                      title: "Polish UX"
                    }
                  ]
                })
              }
            }
          ]
        })
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      await withProcessEnv(
        {
          OPENAI_API_KEY: "sk-host-leak",
          BMAD_COMPANION_OPENAI_KEY: "sk-host-bmad-leak",
          BMAD_COMPANION_OPENAI_BASE_URL: `http://127.0.0.1:${port}`,
          ZCODE_SESSION_ID: "sess_host_leak",
          CLAUDE_SESSION_ID: "sess_host_leak"
        },
        async () => {
          const promptRes = await runHookRunner({
            workspaceRoot: ws.root,
            mode: "user-prompt",
            payload: { prompt: first.prompt }
          });
          assert.deepEqual(assertSingleJsonObjectStdout(promptRes), {});
          const afterPrompt = readJsonFile(ws.statePath);
          assert.equal(afterPrompt.taskQueue.activeTaskId, first.id);
          const claimedItem = afterPrompt.taskQueue.items.find((it) => it.id === first.id);
          assert.equal(
            claimedItem?.sessionId ?? null,
            null,
            "stripped ZCODE_SESSION_ID/CLAUDE_SESSION_ID must not be recorded on claimed task"
          );

          const stopRes = await runHookRunner({
            workspaceRoot: ws.root,
            mode: "stop",
            payload: { last_assistant_message: "Finished step." }
          });
          assert.deepEqual(assertSingleJsonObjectStdout(stopRes), {});
          const afterStop = readJsonFile(ws.statePath);
          assert.equal(llmRequestCount, 0, "stripped API keys must prevent outbound LLM requests");
          assert.equal(afterStop.agentAdvisorOverride ?? null, null);

          // Positive control: explicit env overrides pass through to the hook child.
          const wsExplicit = workspaces.seed();
          const explicitAdded = manageBmadTaskQueue(wsExplicit.root, {
            action: "add",
            executionMode: "separate-sessions",
            items: [
              {
                title: "Story 1: Explicit env override",
                prompt: '/bmad-build-auto "test explicit override"',
                model: "new-provider/model-a",
                reviewMode: "none"
              }
            ]
          });
          const explicitTask = explicitAdded.taskQueue.items[0];
          manageBmadTaskQueue(wsExplicit.root, { action: "start-queue", executionMode: "separate-sessions" });

          const explicitPromptRes = await runHookRunner({
            workspaceRoot: wsExplicit.root,
            mode: "user-prompt",
            payload: { prompt: explicitTask.prompt },
            env: { ZCODE_SESSION_ID: "sess_explicit" }
          });
          assert.deepEqual(assertSingleJsonObjectStdout(explicitPromptRes), {});
          const explicitAfterPrompt = readJsonFile(wsExplicit.statePath);
          assert.equal(explicitAfterPrompt.taskQueue.activeTaskId, explicitTask.id);
          const explicitClaimed = explicitAfterPrompt.taskQueue.items.find((it) => it.id === explicitTask.id);
          assert.equal(explicitClaimed?.sessionId, "sess_explicit");

          const explicitStopRes = await runHookRunner({
            workspaceRoot: wsExplicit.root,
            mode: "stop",
            payload: { last_assistant_message: "Finished explicit step." },
            env: { OPENAI_API_KEY: "sk-explicit" }
          });
          assert.deepEqual(assertSingleJsonObjectStdout(explicitStopRes), {});
          const explicitAfterStop = readJsonFile(wsExplicit.statePath);
          assert.equal(llmRequestCount, 1, "explicit OPENAI_API_KEY should reach mock LLM endpoint");
          assert.equal(explicitAfterStop.agentAdvisorOverride?.headline, "Mock synthesis");
        }
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("runHookRunner and runMcpServer isolate HOME, USERPROFILE, APPDATA, and LOCALAPPDATA from host config", async () => {
    const ws = workspaces.seed();
    const fakeHost = workspaces.create({ prefix: "bmad-fake-host-" });
    fakeHost.write(
      ".zcode/v2/provider_config.json",
      JSON.stringify({
        config: {
          providerConfigRules: {
            providerRules: [
              {
                providerId: "leak-sentinel",
                providerName: "LeakSentinelProvider",
                enabled: true,
                config: {
                  enabled: true,
                  personalModelIds: ["sentinel-model"]
                }
              }
            ]
          }
        }
      })
    );
    fakeHost.write(
      "AppData/Local/Programs/ZCode/resources/config/provider/zcode-builtin.json",
      JSON.stringify({
        config: {
          modelConfigRules: {
            modelRules: [
              {
                modelMatch: "sentinel-model",
                config: {
                  properties: { contextWindow: 777000 }
                }
              }
            ]
          }
        }
      })
    );

    await withProcessEnv(
      {
        HOME: fakeHost.root,
        USERPROFILE: fakeHost.root,
        APPDATA: fakeHost.path("AppData", "Roaming"),
        LOCALAPPDATA: fakeHost.path("AppData", "Local")
      },
      async () => {
        const hookRes = await runHookRunner({
          workspaceRoot: ws.root,
          mode: "session-start",
          payload: {}
        });
        const hookFrame = assertSingleJsonObjectStdout(hookRes);
        assert.equal(
          hookFrame.additionalContext.includes("LeakSentinelProvider"),
          false,
          "runHookRunner must not read host HOME/.zcode/v2 config"
        );

        const mcpRes = await runMcpServer({
          workspaceRoot: ws.root,
          requests: [
            {
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: { name: "bmad_get_state", arguments: {} }
            }
          ]
        });
        assertStrictJsonRpcStdout(mcpRes);
        const isolatedModels = mcpRes.responses[0].result.structuredContent.availableModels;
        assert.equal(
          isolatedModels.some((m) => m.id === "leak-sentinel/sentinel-model"),
          false,
          "runMcpServer must not read host HOME/.zcode/v2 config"
        );

        const overrideRes = await runMcpServer({
          workspaceRoot: ws.root,
          env: {
            HOME: fakeHost.root,
            USERPROFILE: fakeHost.root,
            APPDATA: fakeHost.path("AppData", "Roaming"),
            LOCALAPPDATA: fakeHost.path("AppData", "Local")
          },
          requests: [
            {
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: { name: "bmad_get_state", arguments: {} }
            }
          ]
        });
        assertStrictJsonRpcStdout(overrideRes);
        const overrideModels = overrideRes.responses[0].result.structuredContent.availableModels;
        const sentinel = overrideModels.find((m) => m.id === "leak-sentinel/sentinel-model");
        assert.ok(sentinel, "explicit env override should allow reading custom host config");
        assert.equal(sentinel.contextWindow, 777000);
      }
    );
  });
});
