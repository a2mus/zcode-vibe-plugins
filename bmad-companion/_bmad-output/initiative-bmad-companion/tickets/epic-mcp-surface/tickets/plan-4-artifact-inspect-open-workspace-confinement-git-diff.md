---
title: 'Artifact inspect/open workspace confinement + git diff'
type: feature
ticket: 4
container: epic-mcp-surface
created: '2026-11-24'
status: done
baseline_revision: '3c50d56f79836df6604b0515bc0a6998d16241f8'
route: oneshot
route_source: pinned
risk: medium
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `inspectWorkspaceArtifact` and `openWorkspaceArtifactExternally` in `scripts/bmad-engine.mjs` duplicated confinement checks, stripped leading `/` characters before `resolve()` (risking absolute path normalization into workspace-relative lookups), accepted empty/`.`/directory paths instead of requiring an actual file inside `workspaceRoot`, lacked symlink confinement (`realpathSync`) and Windows drive-relative/null-byte rejection, lacked `deps` injection on `openWorkspaceArtifactExternally` for cross-OS verification without spawning desktop viewers, and had zero automated coverage in `tests/mcp-surface.test.mjs`.

**Approach:** Extract `resolveWorkspaceArtifactPath(workspaceRoot, relPath)` in `scripts/bmad-engine.mjs` so both `inspectWorkspaceArtifact` and `openWorkspaceArtifactExternally` enforce strict `workspaceRoot` confinement (`..` traversal, absolute escapes, null bytes, Windows drive-relative paths, non-file paths, and `realpathSync` symlink escapes) and normalize paths to `/` separators; add `deps` (`platform`, `execFileSync`) and `openMethod` reporting to `openWorkspaceArtifactExternally` while preserving the ratified `OQ-B` `structuredContent` contract (`relPath`, `name`, `size`, `mtimeMs`, `lastModifiedIso`, `meta`, `diff`, `diffSource`, `preview`, `truncated`, `openedExternally`); and cover all paths in `tests/mcp-surface.test.mjs`.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `resolveWorkspaceArtifactPath(workspaceRoot, relPath)` using `resolve`, `relative`, `isAbsolute`, `statSync` (`st.isFile()`), and `realpathSync` to reject empty/whitespace paths, null bytes, Windows drive-relative paths, `..` or absolute escapes outside `workspaceRoot`, directories, and symlink escapes, returning normalized `/` `relPath`, `fullPath`, and `stat`.
  - Updated `inspectWorkspaceArtifact(workspaceRoot, relPath)` to use `resolveWorkspaceArtifactPath` and preserve metadata, frontmatter `meta`, 12,000-char `preview` + `truncated`, and 3-tier `git diff` (`Working tree diff vs HEAD`, `Last commit diff (working tree is clean)`, `Untracked / New Artifact Diff`).
  - Updated `openWorkspaceArtifactExternally(workspaceRoot, relPath, deps = {})` to use `resolveWorkspaceArtifactPath`, accept optional `deps.platform` / `deps.execFileSync` for deterministic cross-OS verification, and return `openMethod` (`cmd /c start` | `open` | `xdg-open`) alongside `opened`, `relPath`, `fullPath`, and `error` on failure.
- **`tests/mcp-surface.test.mjs`:**
  - Added 3 `node:test` cases under `bmad_inspect_artifact & bmad_open_artifact_file confinement + git diff (Epic 2 Story 4)` verifying: (1) `..` escapes, backslash escapes, absolute paths, empty/`.`, directory targets, missing files, null-byte/drive-relative paths, and symlink escapes (when OS permits) are rejected over MCP stdio and helper calls; (2) `/` path normalization, metadata/frontmatter, 12,000-char `preview` truncation, and live `git diff` across clean committed, modified working tree, and untracked files in a git-initialized temp workspace; and (3) `openWorkspaceArtifactExternally` invokes `cmd.exe /c start "" <fullPath>` (`win32`), `open <fullPath>` (`darwin`), and `xdg-open <fullPath>` (`linux`) only after confinement succeeds, and fails gracefully when the OS opener throws.

## Verification

**Commands (executed on win32):**
- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check tests/mcp-surface.test.mjs` — passed (exit 0).
- `node --test tests/` — passed (71/71 tests, 0 failures).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — passed (71/71 tests, 0 failures; `[check-version-sync] OK: all 3 versions match (0.5.3)`; `bmad-companion v0.5.3 validated`).

## Auto Run Result

- **Summary:** Hardened `inspectWorkspaceArtifact` and `openWorkspaceArtifactExternally` via shared `resolveWorkspaceArtifactPath` confinement in `scripts/bmad-engine.mjs` (rejecting `..` escapes, absolute/drive-relative/null-byte/directory/symlink escapes and normalizing `/` paths) while preserving live `git diff`, `preview`, metadata, and platform-appropriate `cmd /c start` | `open` | `xdg-open` dispatch, verified by 3 new tests in `tests/mcp-surface.test.mjs` (71/71 passing).
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `tests/mcp-surface.test.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-mcp-surface/tickets/plan-4-artifact-inspect-open-workspace-confinement-git-diff.md`
- **Review:** none, no lenses launched (pinned).
