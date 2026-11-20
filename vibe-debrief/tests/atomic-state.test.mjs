import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import { loadPersistedState, savePersistedState } from "../scripts/debrief-engine.mjs";
import { createTempWorkspace, readJsonFile } from "./helpers.mjs";

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

  for (const fallbackCode of ["EPERM", "EACCES", "EXDEV"]) {
    it(`falls back safely on persistent ${fallbackCode} and guarantees .tmp cleanup`, () => {
      const workspace = createTempWorkspace({ prefix: "vibe-debrief-atomic-" });

      try {
        let renameAttempts = 0;
        let unlinkCalls = 0;
        const delays = [];

        const saved = savePersistedState(
          workspace.root,
          { turnCount: 9, lastUserPrompt: `Fallback ${fallbackCode}` },
          {
            retryDelaysMs: [1, 2],
            sleepSync(ms) {
              delays.push(ms);
            },
            fs: {
              renameSync() {
                renameAttempts += 1;
                throw makeFsError(fallbackCode, `persistent ${fallbackCode}`);
              },
              unlinkSync(filePath) {
                unlinkCalls += 1;
                unlinkSync(filePath);
              }
            }
          }
        );

        assert.equal(renameAttempts, fallbackCode === "EXDEV" ? 1 : 3);
        assert.deepEqual(delays, fallbackCode === "EXDEV" ? [] : [1, 2]);
        assert.equal(unlinkCalls, 1);
        assert.deepEqual(readJsonFile(workspace.statePath), saved);
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
