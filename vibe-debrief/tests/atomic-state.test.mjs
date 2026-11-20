import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";

import {
  loadPersistedState,
  savePersistedState,
  synthesizeHeuristicDebrief
} from "../scripts/debrief-engine.mjs";
import {
  buildDebriefFixture,
  createTempFixture,
  createTempWorkspace,
  readJsonFile,
  runHookRunner,
  runMcpServer
} from "./helpers.mjs";

const SIBLING_TEMP_RE = new RegExp(
  `^vibe-debrief-state\\.${process.pid}\\.\\d+-\\d+\\.tmp$`
);

function listZcodeEntries(workspace) {
  return readdirSync(join(workspace.root, ".zcode"));
}

function listTempFiles(workspace) {
  return listZcodeEntries(workspace).filter((name) => name.endsWith(".tmp"));
}

function makeFsError(code, message = code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

describe("atomic savePersistedState", () => {
  it("writes a unique sibling .tmp file and atomically renames it over state.json with zero leftover .tmp files", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-atomic-" });

    try {
      const seenTempPaths = [];
      const seenRenames = [];

      const saved = savePersistedState(
        workspace.root,
        { turnCount: 3, lastUserPrompt: "Atomic tracer" },
        {
          fs: {
            writeFileSync(filePath, content, encoding) {
              seenTempPaths.push(filePath);
              writeFileSync(filePath, content, encoding);
            },
            renameSync(fromPath, toPath) {
              seenRenames.push({ fromPath, toPath });
              renameSync(fromPath, toPath);
            }
          }
        }
      );

      assert.equal(seenTempPaths.length, 1);
      assert.equal(dirname(seenTempPaths[0]), join(workspace.root, ".zcode"));
      assert.match(seenTempPaths[0].split(/[\\/]/).at(-1), SIBLING_TEMP_RE);

      assert.equal(seenRenames.length, 1);
      assert.equal(seenRenames[0].fromPath, seenTempPaths[0]);
      assert.equal(seenRenames[0].toPath, workspace.statePath);

      assert.deepEqual(readJsonFile(workspace.statePath), saved);
      assert.deepEqual(listTempFiles(workspace), []);
    } finally {
      workspace.cleanup();
    }
  });

  it("generates distinct sibling temp filenames across rapid sequential saves", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-atomic-" });

    try {
      const tempNames = [];
      const trackingFs = {
        writeFileSync(filePath, content, encoding) {
          tempNames.push(filePath.split(/[\\/]/).at(-1));
          writeFileSync(filePath, content, encoding);
        }
      };

      savePersistedState(workspace.root, { turnCount: 1 }, { fs: trackingFs });
      savePersistedState(workspace.root, { turnCount: 2 }, { fs: trackingFs });
      savePersistedState(workspace.root, { turnCount: 3 }, { fs: trackingFs });

      assert.equal(tempNames.length, 3);
      assert.equal(new Set(tempNames).size, 3);
      for (const name of tempNames) {
        assert.match(name, SIBLING_TEMP_RE);
      }
      assert.equal(readJsonFile(workspace.statePath).turnCount, 3);
      assert.deepEqual(listTempFiles(workspace), []);
    } finally {
      workspace.cleanup();
    }
  });

  for (const transientCode of ["EPERM", "EACCES"]) {
    it(`retries transient Windows ${transientCode} on renameSync and succeeds atomically`, () => {
      const workspace = createTempWorkspace({ prefix: "vibe-debrief-atomic-" });

      try {
        let renameAttempts = 0;
        let targetDirectWrites = 0;
        const delays = [];

        const saved = savePersistedState(
          workspace.root,
          { turnCount: 7, lastUserPrompt: `Recovered ${transientCode}` },
          {
            retryDelaysMs: [1, 2],
            sleepSync(ms) {
              delays.push(ms);
            },
            fs: {
              writeFileSync(filePath, content, encoding) {
                if (filePath === workspace.statePath) {
                  targetDirectWrites += 1;
                }
                writeFileSync(filePath, content, encoding);
              },
              renameSync(fromPath, toPath) {
                renameAttempts += 1;
                if (renameAttempts === 1) {
                  throw makeFsError(transientCode, `simulated ${transientCode}`);
                }
                renameSync(fromPath, toPath);
              }
            }
          }
        );

        assert.equal(renameAttempts, 2);
        assert.deepEqual(delays, [1]);
        assert.equal(targetDirectWrites, 0);
        assert.deepEqual(readJsonFile(workspace.statePath), saved);
        assert.deepEqual(listTempFiles(workspace), []);
      } finally {
        workspace.cleanup();
      }
    });
  }

  it("falls back safely on persistent EXDEV and guarantees .tmp cleanup", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-atomic-" });

    try {
      let renameAttempts = 0;
      let unlinkCalls = 0;
      const delays = [];

      const saved = savePersistedState(
        workspace.root,
        { turnCount: 9, lastUserPrompt: "Fallback EXDEV" },
        {
          retryDelaysMs: [1, 2],
          sleepSync(ms) {
            delays.push(ms);
          },
          fs: {
            renameSync() {
              renameAttempts += 1;
              throw makeFsError("EXDEV", "persistent EXDEV");
            },
            unlinkSync(filePath) {
              unlinkCalls += 1;
              unlinkSync(filePath);
            }
          }
        }
      );

      assert.equal(renameAttempts, 1);
      assert.deepEqual(delays, []);
      assert.equal(unlinkCalls, 1);
      assert.deepEqual(readJsonFile(workspace.statePath), saved);
      assert.deepEqual(listTempFiles(workspace), []);
    } finally {
      workspace.cleanup();
    }
  });

  for (const persistentCode of ["EPERM", "EACCES"]) {
    it(`preserves prior state.json intact and cleans up .tmp on persistent ${persistentCode} without non-atomic overwrite`, () => {
      const workspace = createTempWorkspace({ prefix: "vibe-debrief-atomic-" });

      try {
        const baseline = savePersistedState(workspace.root, {
          turnCount: 8,
          lastUserPrompt: "Atomic baseline"
        });

        let renameAttempts = 0;
        let unlinkCalls = 0;
        let targetDirectWrites = 0;
        const delays = [];

        savePersistedState(
          workspace.root,
          { turnCount: 9, lastUserPrompt: `Persistent ${persistentCode}` },
          {
            retryDelaysMs: [1, 2],
            sleepSync(ms) {
              delays.push(ms);
            },
            fs: {
              writeFileSync(filePath, content, encoding) {
                if (filePath === workspace.statePath) {
                  targetDirectWrites += 1;
                }
                writeFileSync(filePath, content, encoding);
              },
              renameSync() {
                renameAttempts += 1;
                throw makeFsError(persistentCode, `persistent ${persistentCode}`);
              },
              unlinkSync(filePath) {
                unlinkCalls += 1;
                unlinkSync(filePath);
              }
            }
          }
        );

        assert.equal(renameAttempts, 3);
        assert.deepEqual(delays, [1, 2]);
        assert.equal(targetDirectWrites, 0);
        assert.equal(unlinkCalls, 1);
        assert.deepEqual(readJsonFile(workspace.statePath), baseline);
        assert.deepEqual(listTempFiles(workspace), []);
      } finally {
        workspace.cleanup();
      }
    });
  }

  it("preserves prior state.json intact and cleans up .tmp when writeFileSync or renameSync fails fatally", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-atomic-" });

    try {
      const baseline = savePersistedState(workspace.root, {
        turnCount: 4,
        lastUserPrompt: "Known good baseline"
      });

      // Case 1: temp file created partway, then write throws ENOSPC
      const returnedAfterPartialWrite = savePersistedState(
        workspace.root,
        { turnCount: 5, lastUserPrompt: "Should not land" },
        {
          fs: {
            writeFileSync(filePath, _content, encoding) {
              writeFileSync(filePath, '{"partial":', encoding);
              throw makeFsError("ENOSPC", "disk full");
            }
          }
        }
      );

      assert.equal(returnedAfterPartialWrite.turnCount, 5);
      assert.deepEqual(readJsonFile(workspace.statePath), baseline);
      assert.deepEqual(listTempFiles(workspace), []);

      // Case 2: temp file written, then renameSync throws non-fallback EIO
      savePersistedState(
        workspace.root,
        { turnCount: 6, lastUserPrompt: "Also should not land" },
        {
          fs: {
            renameSync() {
              throw makeFsError("EIO", "I/O error");
            }
          }
        }
      );

      assert.deepEqual(readJsonFile(workspace.statePath), baseline);
      assert.deepEqual(listTempFiles(workspace), []);
    } finally {
      workspace.cleanup();
    }
  });

  it("degrades gracefully on read-only / unwritable directories with zero .tmp files", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-ro-" });

    try {
      // Cross-platform unwritable .zcode path: regular file blocks mkdirSync(.zcode)
      workspace.write(".zcode", "read-only-sentinel");
      const blockedResult = savePersistedState(workspace.root, {
        turnCount: 11,
        lastUserPrompt: "Blocked dir"
      });
      assert.equal(blockedResult.turnCount, 11);
      assert.equal(workspace.read(".zcode"), "read-only-sentinel");
    } finally {
      workspace.cleanup();
    }

    // Simulated EACCES / EROFS on directory/temp creation
    const simulatedRo = createTempWorkspace({ prefix: "vibe-debrief-ro-sim-" });
    try {
      mkdirSync(join(simulatedRo.root, ".zcode"), { recursive: true });
      const result = savePersistedState(
        simulatedRo.root,
        { turnCount: 12 },
        {
          fs: {
            writeFileSync() {
              throw makeFsError("EROFS", "read-only filesystem");
            }
          }
        }
      );
      assert.equal(result.turnCount, 12);
      assert.equal(simulatedRo.exists(".zcode/vibe-debrief-state.json"), false);
      assert.deepEqual(listTempFiles(simulatedRo), []);
    } finally {
      simulatedRo.cleanup();
    }

    // Real POSIX read-only .zcode directory test when non-root POSIX enforces mode bits
    if (process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() !== 0) {
      const posixRo = createTempWorkspace({ prefix: "vibe-debrief-ro-posix-" });
      const zcodeDir = join(posixRo.root, ".zcode");
      try {
        mkdirSync(zcodeDir, { recursive: true });
        chmodSync(zcodeDir, 0o555);
        const result = savePersistedState(posixRo.root, { turnCount: 13 });
        assert.equal(result.turnCount, 13);
        assert.equal(posixRo.exists(".zcode/vibe-debrief-state.json"), false);
        assert.deepEqual(listTempFiles(posixRo), []);
      } finally {
        chmodSync(zcodeDir, 0o755);
        posixRo.cleanup();
      }
    }
  });

  it("preserves 15/15/50 collection bounds across atomic saves", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-atomic-caps-" });

    try {
      const saved = savePersistedState(workspace.root, {
        history: Array.from({ length: 18 }, (_, i) => ({ id: `h-${i}` })),
        recentTouchedFiles: Array.from({ length: 18 }, (_, i) => `f-${i}.mjs`),
        confirmedLessons: Array.from({ length: 55 }, (_, i) => ({ slug: `l-${i}` }))
      });

      assert.equal(saved.history.length, 15);
      assert.equal(saved.recentTouchedFiles.length, 15);
      assert.equal(saved.confirmedLessons.length, 50);

      const loaded = loadPersistedState(workspace.root);
      assert.equal(loaded.history.length, 15);
      assert.equal(loaded.recentTouchedFiles[0], "f-3.mjs");
      assert.equal(loaded.confirmedLessons.length, 50);
      assert.deepEqual(listTempFiles(workspace), []);
    } finally {
      workspace.cleanup();
    }
  });
});

function validateParsedStateSnapshot(parsed) {
  assert.equal(typeof parsed, "object", "state.json must parse to an object");
  assert.notEqual(parsed, null, "state.json must not be null");
  assert.equal(Array.isArray(parsed), false, "state.json must not be an array");
  assert.ok(Array.isArray(parsed.history), "history must be an array");
  assert.ok(parsed.history.length <= 15, `history exceeded cap: ${parsed.history.length}`);
  assert.ok(Array.isArray(parsed.recentTouchedFiles), "recentTouchedFiles must be an array");
  assert.ok(
    parsed.recentTouchedFiles.length <= 15,
    `recentTouchedFiles exceeded cap: ${parsed.recentTouchedFiles.length}`
  );
  assert.ok(Array.isArray(parsed.confirmedLessons), "confirmedLessons must be an array");
  assert.ok(
    parsed.confirmedLessons.length <= 50,
    `confirmedLessons exceeded cap: ${parsed.confirmedLessons.length}`
  );
  assert.equal(typeof parsed.currentDebrief, "object", "currentDebrief must be an object");
  assert.notEqual(parsed.currentDebrief, null, "currentDebrief must not be null");
}

function buildPublishRpcMessage(index) {
  return {
    jsonrpc: "2.0",
    id: index + 1,
    method: "tools/call",
    params: {
      name: "vibe_debrief_publish",
      arguments: {
        responseType: index % 2 === 0 ? "implementation" : "bug",
        persona: "vibe-mentor",
        tldrHeadline: `Concurrent stress publish ${index}.`,
        realWorldAnalogy: `Like relay lane ${index} handing off the baton cleanly.`,
        diagram: {
          diagramType: "architecture",
          title: `Concurrent Flow ${index}`,
          nodes: [
            { id: "n1", label: "Hook", sublabel: "post-tool", role: "Hooks", file: "scripts/hook-runner.mjs", risk: "low", status: "done" },
            { id: "n2", label: "Engine", sublabel: `turn-${index}`, role: "Core", file: "scripts/debrief-engine.mjs", risk: "medium", status: "active" }
          ],
          edges: [{ from: "n1", to: "n2", stepNumber: 1, label: "Writes", risk: "low" }]
        },
        implementationReport: {
          objective: `Verify concurrent MCP write ${index}.`,
          planAndWhy: "Write via atomic sibling temp rename.",
          result: "State file stays valid.",
          consequences: "No torn reads."
        },
        bugReport: {
          cause: `Simulated race check ${index}.`,
          plan: "Atomic sibling rename.",
          succeeded: "yes",
          successSummary: "State remained valid.",
          consequences: "Zero corrupt reads."
        },
        proofClaims: [
          { claim: `Write ${index} landed atomically.`, evidence: "node --test", status: "verified" }
        ]
      }
    }
  };
}

describe("concurrent MCP + Hook race stress & Stop latency", () => {
  it("survives parallel spawned MCP + Hook writers with continuous reader validation and zero leftover .tmp files", async () => {
    const fixture = createTempFixture({
      workspace: { prefix: "vibe-debrief-race-ws-" },
      home: { prefix: "vibe-debrief-race-home-" }
    });

    try {
      const childEnv = {
        ...fixture.home.env,
        ZCODE_WORKSPACE_ROOT: fixture.workspace.root,
        ZCODE_PROJECT_DIR: fixture.workspace.root
      };

      let polling = true;
      let hasSeenStateFile = false;
      let observedValidReads = 0;
      const readErrors = [];

      const readerLoop = (async () => {
        while (polling) {
          try {
            const raw = readFileSync(fixture.workspace.statePath, "utf8");
            hasSeenStateFile = true;
            const parsed = JSON.parse(raw);
            validateParsedStateSnapshot(parsed);
            observedValidReads += 1;
          } catch (err) {
            if (err?.code === "ENOENT") {
              if (hasSeenStateFile) {
                readErrors.push(new Error(`state.json missing after initial creation: ${err.message}`));
              }
            } else {
              readErrors.push(err);
            }
          }
          await new Promise((resolve) => setImmediate(resolve));
        }
      })();

      const runWriterWave = async (waveIndex) => {
        const tasks = [];
        for (let i = 0; i < 4; i++) {
          const idx = waveIndex * 10 + i;
          tasks.push(
            runMcpServer({
              messages: [buildPublishRpcMessage(idx)],
              cwd: fixture.workspace.root,
              env: childEnv
            }).then((result) => ({ kind: "mcp", idx, result }))
          );
          tasks.push(
            runHookRunner(
              "post-tool",
              i % 2 === 0
                ? {
                    cwd: fixture.workspace.root,
                    tool_name: "Edit",
                    tool_input: { file_path: join(fixture.workspace.root, "src", `race-${waveIndex}-${i}.mjs`) }
                  }
                : {
                    cwd: fixture.workspace.root,
                    tool_name: "Bash",
                    tool_response: { stdout: "10 passed, 0 errors" }
                  },
              { cwd: fixture.workspace.root, env: childEnv }
            ).then((result) => ({ kind: "post-tool", idx, result }))
          );
          tasks.push(
            runHookRunner(
              "stop",
              {
                cwd: fixture.workspace.root,
                last_assistant_message: `Turn ${idx} updated src/race-${waveIndex}-${i}.mjs and ran tests cleanly with 0 errors.`
              },
              { cwd: fixture.workspace.root, env: childEnv }
            ).then((result) => ({ kind: "stop", idx, result }))
          );
        }
        return Promise.all(tasks);
      };

      let waveResults = [];
      try {
        const wave1 = await runWriterWave(0);
        const wave2 = await runWriterWave(1);
        waveResults = [...wave1, ...wave2];
      } finally {
        polling = false;
        await readerLoop;
      }

      assert.equal(
        readErrors.length,
        0,
        `Continuous reader observed ${readErrors.length} error(s): ${readErrors
          .slice(0, 5)
          .map((e) => e.message)
          .join(" | ")}`
      );
      assert.ok(observedValidReads > 0, "Continuous reader must observe at least one valid state.json read");

      for (const entry of waveResults) {
        const { kind, idx, result } = entry;
        assert.equal(
          result.exitCode,
          0,
          `${kind}#${idx} exited ${result.exitCode} (stderr: ${result.stderr})`
        );
        assert.equal(result.stderr, "", `${kind}#${idx} wrote unexpected stderr: ${result.stderr}`);
        assert.equal(
          result.stdoutLines.length,
          1,
          `${kind}#${idx} expected 1 stdout line, got ${result.stdoutLines.length}: ${result.stdout}`
        );
        const frame = JSON.parse(result.stdoutLines[0]);
        if (kind === "mcp") {
          assert.equal(frame.jsonrpc, "2.0");
          assert.equal(frame.error, undefined, `MCP#${idx} returned JSON-RPC error: ${JSON.stringify(frame.error)}`);
          assert.equal(frame.result?.isError, undefined, `MCP#${idx} returned tool error`);
        } else {
          assert.deepEqual(frame, {});
        }
      }

      const finalState = readJsonFile(fixture.workspace.statePath);
      validateParsedStateSnapshot(finalState);
      assert.deepEqual(listTempFiles(fixture.workspace), []);
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps Stop-hook heuristic synthesis + atomic savePersistedState within <= 50ms (C6)", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-stop-latency-" });

    try {
      const realisticTouchedFiles = [
        "scripts/debrief-engine.mjs",
        "scripts/mcp-server.mjs",
        "scripts/hook-runner.mjs",
        "assets/panel.html",
        "tests/atomic-state.test.mjs",
        "src/api/session-auth.ts",
        "src/ui/CockpitPanel.tsx",
        "docs/architecture.md"
      ];

      const seedHistory = Array.from({ length: 15 }, (_, idx) =>
        buildDebriefFixture({
          id: `seed-debrief-${idx}`,
          tldrHeadline: `Prior turn ${idx} updated core files cleanly.`
        })
      );

      savePersistedState(workspace.root, {
        activePersona: "vibe-mentor",
        ste100Enabled: true,
        turnCount: 15,
        lastUserPrompt:
          "Fix the race condition in savePersistedState, verify the hook runner stop path, and ensure the panel renders safely.",
        recentTouchedFiles: realisticTouchedFiles,
        lastCommandExitZero: true,
        history: seedHistory,
        confirmedLessons: Array.from({ length: 10 }, (_, idx) => ({
          slug: `lesson-${idx}`,
          title: `Lesson ${idx}`,
          summary: "Keep atomic writes simple.",
          why: "Prevents torn reads.",
          howToApply: "Write sibling temp file then renameSync.",
          memoryType: "feedback",
          confirmed: true
        }))
      });

      const assistantMessage = [
        "**Cause:** Direct writes to `vibe-debrief-state.json` risked partial reads when hooks and MCP calls overlapped.",
        "**Plan:** Route every `savePersistedState` update through a sibling temporary file in `.zcode/` and replace the target via `renameSync`, keeping `post-tool` and `stop` lock-free.",
        "**Result:** Updated `scripts/debrief-engine.mjs`, `scripts/mcp-server.mjs`, `scripts/hook-runner.mjs`, and `tests/atomic-state.test.mjs`. All tests passed with 0 errors.",
        "**Consequences:** Concurrent writers follow last-writer-wins semantics, collections stay bounded at 15/15/50, and read-only workspaces still degrade without throwing.",
        "**Lesson:** Always write state files to a sibling temp path before renaming over the live target."
      ].join("\n\n");

      const runStopHeuristicCycle = () => {
        const state = loadPersistedState(workspace.root);
        const steOn = state.ste100Enabled !== false;
        const touchedRaw = state.recentTouchedFiles || [];
        const heuristic = synthesizeHeuristicDebrief({
          workspaceRoot: workspace.root,
          userPrompt: state.lastUserPrompt,
          assistantMessage,
          touchedFiles: touchedRaw,
          lastCommandExitZero: state.lastCommandExitZero,
          persona: state.activePersona || "vibe-mentor",
          ste100Enabled: steOn
        });
        const prevHistory = Array.isArray(state.history) ? state.history : [];
        savePersistedState(workspace.root, {
          lastAssistantMessage: assistantMessage,
          turnCount: (state.turnCount || 0) + 1,
          currentDebrief: heuristic,
          history: [heuristic, ...prevHistory.filter((h) => h.id !== heuristic.id)].slice(0, 15)
        });
      };

      const durationsMs = [];
      const runs = 20;
      for (let i = 0; i < runs; i++) {
        const start = performance.now();
        runStopHeuristicCycle();
        durationsMs.push(performance.now() - start);
      }

      const sorted = [...durationsMs].sort((a, b) => a - b);
      const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
      const max = sorted[sorted.length - 1];

      assert.ok(
        p95 <= 50,
        `Stop-hook heuristic p95 latency exceeded 50ms: p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`
      );
      assert.ok(
        max <= 50,
        `Stop-hook heuristic max latency exceeded 50ms: max=${max.toFixed(2)}ms, samples=${durationsMs
          .map((d) => d.toFixed(2))
          .join(", ")}`
      );

      const finalState = readJsonFile(workspace.statePath);
      validateParsedStateSnapshot(finalState);
      assert.equal(finalState.turnCount, 15 + runs);
      assert.equal(finalState.history.length, 15);
      assert.deepEqual(listTempFiles(workspace), []);
    } finally {
      workspace.cleanup();
    }
  });
});

