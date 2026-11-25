import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

import {
  SCAN_LIMITS,
  inspectWorkspaceArtifact,
  resolveWorkspaceArtifactPath,
  safeReadText,
  scanBmadWorkspace
} from "../scripts/bmad-engine.mjs";
import { ENGINE_PATH, createTempWorkspaceTracker } from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function initRepo(ws) {
  git(ws.root, "init", "-q");
  git(ws.root, "config", "user.email", "t@example.com");
  git(ws.root, "config", "user.name", "T");
  git(ws.root, "config", "commit.gpgsign", "false");
}

function artifactPaths(scan) {
  return scan.artifacts.map((a) => a.relPath);
}

// Story 6.3 (R6 / C10 / C3): bounded, workspace-confined artifact discovery + diffing.
describe("workspace-confined artifact discovery + diffing (6.3)", () => {
  it("binds the C10 envelope: depth 4, 30KB heuristic reads, 2500ms git", () => {
    assert.equal(SCAN_LIMITS.maxDepth, 4);
    assert.ok(SCAN_LIMITS.heuristicReadBytes >= 24000 && SCAN_LIMITS.heuristicReadBytes <= 30000);
    assert.equal(SCAN_LIMITS.gitTimeoutMs, 2500);
  });

  it("walks _bmad-output and docs at depth <= 4 and never surfaces deeper artifacts", () => {
    const ws = workspaces.create({
      files: {
        "_bmad-output/a/plan-d1.md": "# d1\n",
        "_bmad-output/a/b/c/d/plan-d4.md": "# d4\n",
        "_bmad-output/a/b/c/d/e/plan-d5.md": "# d5\n",
        "_bmad-output/a/b/c/d/e/f/plan-d6.md": "# d6\n",
        "docs/a/b/c/d/spec-d4.md": "# docs d4\n",
        "docs/a/b/c/d/e/spec-d5.md": "# docs d5\n"
      }
    });
    const paths = artifactPaths(scanBmadWorkspace(ws.root));
    assert.ok(paths.includes("_bmad-output/a/plan-d1.md"));
    assert.ok(paths.includes("_bmad-output/a/b/c/d/plan-d4.md"), "depth-4 _bmad-output artifact is discovered");
    assert.ok(!paths.includes("_bmad-output/a/b/c/d/e/plan-d5.md"), "depth-5 _bmad-output artifact is excluded");
    assert.ok(!paths.includes("_bmad-output/a/b/c/d/e/f/plan-d6.md"), "depth-6 _bmad-output artifact is excluded");
    assert.ok(paths.includes("docs/a/b/c/d/spec-d4.md"), "depth-4 docs/ artifact is discovered");
    assert.ok(!paths.includes("docs/a/b/c/d/e/spec-d5.md"), "depth-5 docs/ artifact is excluded");
  });

  it("discovers root AGENTS.md / CONTEXT.md and docs/ with normalized / paths, ignoring non-file root entries", () => {
    const ws = workspaces.create({
      files: {
        "AGENTS.md": "# agents\n",
        "CONTEXT.md": "# context\n",
        "docs/spec-guide.md": "# spec\n"
      }
    });
    const paths = artifactPaths(scanBmadWorkspace(ws.root));
    for (const expected of ["AGENTS.md", "CONTEXT.md", "docs/spec-guide.md"]) {
      assert.ok(paths.includes(expected), `${expected} discovered`);
    }
    assert.ok(paths.every((p) => !p.includes("\\")), "no backslashes in artifact paths");

    const wsDirRootDoc = workspaces.create({
      files: {
        "AGENTS.md/nested.md": "# directory named AGENTS.md\n",
        "CONTEXT.md": "# valid file\n"
      }
    });
    const dirDocPaths = artifactPaths(scanBmadWorkspace(wsDirRootDoc.root));
    assert.ok(!dirDocPaths.includes("AGENTS.md"), "directory named AGENTS.md is not surfaced as a file artifact");
    assert.ok(dirDocPaths.includes("CONTEXT.md"));
  });

  it("reports per-artifact git status (committed / modified / untracked) and confines status/diffs when workspaceRoot is a git subdirectory", () => {
    const ws = workspaces.create({
      files: {
        "sibling-plugin/outside.md": "# sibling\n",
        "subworkspace/_bmad-output/plan-committed.md": "# committed\n",
        "subworkspace/_bmad-output/plan-modified.md": "# before\n"
      }
    });
    initRepo(ws);
    git(ws.root, "add", "-A");
    git(ws.root, "commit", "-q", "-m", "init");
    ws.write("sibling-plugin/outside.md", "# sibling modified\n");
    ws.write("sibling-plugin/untracked.md", "# sibling untracked\n");
    ws.write("subworkspace/_bmad-output/plan-modified.md", "# after\n");
    ws.write("subworkspace/_bmad-output/plan-untracked.md", "# new\n");

    const subRoot = ws.path("subworkspace");
    const scan = scanBmadWorkspace(subRoot);
    const byPath = Object.fromEntries(scan.artifacts.map((a) => [a.relPath, a.gitStatus]));
    assert.equal(byPath["_bmad-output/plan-committed.md"], "committed");
    assert.equal(byPath["_bmad-output/plan-modified.md"], "modified");
    assert.equal(byPath["_bmad-output/plan-untracked.md"], "untracked");
    assert.ok(
      scan.git.modifiedFiles.every((m) => !m.path.startsWith("..") && !m.path.includes("sibling-plugin")),
      "git.modifiedFiles stays confined to workspaceRoot"
    );
    assert.ok(
      scan.git.untrackedFiles.every((u) => !u.startsWith("..") && !u.includes("sibling-plugin")),
      "git.untrackedFiles stays confined to workspaceRoot"
    );

    const subDiff = inspectWorkspaceArtifact(subRoot, "_bmad-output/plan-modified.md");
    assert.equal(subDiff.relPath, "_bmad-output/plan-modified.md");
    assert.match(subDiff.diff, /\+\+\+ b\/_bmad-output\/plan-modified\.md/);
  });

  it("returns git diff previews with normalized / paths for modified, committed, and untracked artifacts", () => {
    const ws = workspaces.create({ files: { "_bmad-output/sub/plan-a.md": "# one\n", "_bmad-output/sub/plan-b.md": "# b\n" } });
    initRepo(ws);
    git(ws.root, "add", "-A");
    git(ws.root, "commit", "-q", "-m", "init");
    ws.write("_bmad-output/sub/plan-a.md", "# one\nchanged line\n");
    ws.write("_bmad-output/sub/plan-c.md", "# brand new\n");

    const modified = inspectWorkspaceArtifact(ws.root, String.raw`.\_bmad-output\sub\plan-a.md`);
    assert.equal(modified.relPath, "_bmad-output/sub/plan-a.md");
    assert.match(modified.diffSource, /Working tree diff/);
    assert.match(modified.diff, /\+changed line/);

    const committed = inspectWorkspaceArtifact(ws.root, "_bmad-output/sub/plan-b.md");
    assert.match(committed.diffSource, /Last commit diff/);

    const untracked = inspectWorkspaceArtifact(ws.root, "_bmad-output/sub/plan-c.md");
    assert.match(untracked.diffSource, /Untracked/);
    assert.match(untracked.diff, /\+\+\+ b\/_bmad-output\/sub\/plan-c\.md/);
  });

  it("rejects ../ escapes, absolute paths outside the root, and directories", () => {
    const ws = workspaces.create({ files: { "_bmad-output/plan-a.md": "# a\n" } });
    for (const bad of ["../outside.md", "_bmad-output/../../outside.md", String.raw`..\outside.md`, String.raw`C:\Windows\win.ini`, "/etc/passwd", "", "_bmad-output"]) {
      assert.throws(() => resolveWorkspaceArtifactPath(ws.root, bad), Error, `rejects ${JSON.stringify(bad)}`);
      assert.throws(() => inspectWorkspaceArtifact(ws.root, bad), Error, `inspect rejects ${JSON.stringify(bad)}`);
    }
  });

  it("caps heuristic reads at 30KB by default without loading oversized files whole", () => {
    const ws = workspaces.create({ files: { "_bmad-output/plan-big.md": "x".repeat(200000) } });
    const full = ws.path("_bmad-output/plan-big.md");
    assert.equal(safeReadText(full).length, SCAN_LIMITS.heuristicReadBytes, "default maxBytes is SCAN_LIMITS.heuristicReadBytes (30KB)");
    assert.equal(safeReadText(full, SCAN_LIMITS.heuristicReadBytes).length, SCAN_LIMITS.heuristicReadBytes);
    assert.equal(safeReadText(ws.path("missing.md"), 100), "");
    assert.equal(safeReadText(ws.path("_bmad-output"), 100), "", "directories read as empty");

    const inspected = inspectWorkspaceArtifact(ws.root, "_bmad-output/plan-big.md");
    assert.equal(inspected.size, statSync(full).size, "reported size is the real file size");
    assert.ok(inspected.diff.length <= 24100, "diff is bounded");
  });

  it("routes every git subprocess through one 2500ms-bounded primitive", () => {
    const src = readFileSync(ENGINE_PATH, "utf8");
    assert.equal((src.match(/execFileSync\(\s*"git"/g) || []).length, 1, "exactly one git spawn site");
    assert.match(src, /GIT_METADATA_TIMEOUT_MS = SCAN_LIMITS\.gitTimeoutMs/);
    assert.match(src, /GIT_CAPTURE_TIMEOUT_MS = SCAN_LIMITS\.gitTimeoutMs/);
    assert.match(src, /timeout: timeoutMs,\s+stdio: \["ignore", "pipe", "ignore"\]/);
  });

  it("degrades to an empty git status (not a crash) outside a git repository", () => {
    const ws = workspaces.create({ files: { "_bmad-output/plan-a.md": "# a\n" } });
    const scan = scanBmadWorkspace(ws.root);
    assert.ok(artifactPaths(scan).includes("_bmad-output/plan-a.md"));
  });
});
