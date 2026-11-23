import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { scanBmadWorkspace } from "../scripts/bmad-engine.mjs";
import { REPO_ROOT, createTempWorkspaceTracker } from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

describe("bmad-companion engine smoke tracer", () => {
  it("keeps zero npm dependencies (no package.json at plugin root)", () => {
    assert.equal(existsSync(join(REPO_ROOT, "package.json")), false);
  });

  it("scans a seeded v7 + sprint-status temp workspace into a valid ScanResult", () => {
    const workspace = workspaces.seed();

    const result = scanBmadWorkspace(workspace.root);

    assert.equal(result.workspaceRoot, workspace.root);
    assert.ok(result.scannedAt);

    // Metrics contract
    assert.equal(typeof result.metrics, "object");
    assert.equal(result.metrics.totalEpics, 1);
    assert.equal(result.metrics.totalStories, 2);
    assert.equal(result.metrics.declaredDoneStories, 0);
    assert.equal(result.metrics.smartDoneStories, 1);
    assert.equal(result.metrics.inProgressStories, 1);
    assert.equal(result.metrics.reconciledStoriesCount, 1);
    assert.equal(result.metrics.declaredOverallPct, 0);
    assert.equal(result.metrics.smartOverallPct, 50);

    // Phases contract (4 BMAD phases)
    assert.ok(Array.isArray(result.phases));
    assert.equal(result.phases.length, 4);
    assert.deepEqual(
      result.phases.map((p) => p.id),
      ["1-analysis", "2-planning", "3-solutioning", "4-implementation"]
    );
    for (const phase of result.phases) {
      assert.equal(typeof phase.progressPct, "number");
      assert.ok(Array.isArray(phase.artifacts));
    }

    // Epics & stories contract
    assert.ok(Array.isArray(result.epics));
    assert.equal(result.epics.length, 1);
    assert.equal(result.epics[0].slug, "epic-core");
    assert.equal(result.epics[0].stories.length, 2);
    assert.equal(result.epics[0].stories[0].declaredStatus, "backlog");
    assert.equal(result.epics[0].stories[0].smartStatus, "done");
    assert.equal(result.epics[0].stories[0].aiReconciled, true);
    assert.equal(result.epics[0].stories[1].smartStatus, "in-progress");

    // Artifacts contract
    assert.ok(Array.isArray(result.artifacts));
    assert.ok(result.artifacts.length >= 4);
    assert.ok(
      result.artifacts.some((a) => a.relPath.endsWith("prd-demo.md")),
      "expected seeded PRD artifact to be discovered"
    );
    assert.ok(
      result.artifacts.some((a) => a.relPath.endsWith("sprint-status.yaml")),
      "expected seeded sprint-status.yaml artifact to be discovered"
    );
  });

  it("falls back to v6 sprint-status.yaml when no v7 initiative directory exists", () => {
    const workspace = workspaces.create({
      files: {
        "_bmad-output/implementation-artifacts/sprint-status.yaml": [
          "development_status:",
          "  epic-1: in-progress",
          "  1-1-alpha: done",
          "  1-2-beta: ready-for-dev"
        ].join("\n") + "\n"
      }
    });

    const result = scanBmadWorkspace(workspace.root);

    assert.equal(result.metrics.totalEpics, 1);
    assert.equal(result.metrics.totalStories, 2);
    assert.equal(result.metrics.declaredDoneStories, 1);
    assert.equal(result.metrics.smartDoneStories, 1);
    assert.equal(result.epics.length, 1);
    assert.equal(result.epics[0].stories[0].smartStatus, "done");
    assert.equal(result.epics[0].stories[1].smartStatus, "ready");
    assert.equal(result.phases.length, 4);
    assert.ok(result.artifacts.some((a) => a.relPath.endsWith("sprint-status.yaml")));
  });
});
