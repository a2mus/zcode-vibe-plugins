import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { createTempWorkspaceTracker } from "./helpers.mjs";

describe("bmad-companion test harness helpers", () => {
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
});
