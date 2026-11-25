---
title: 'Workspace-confined artifact discovery + diffing'
type: story
ticket: 3
container: epic-hooks-model-router
created: '2026-11-25'
status: done
baseline_revision: '2ef7728a82ea7f1481a7bce7e568317df1fdf71b'
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
deferred:
  - "Reconcile tracker discovery (`reconcileWorkspaceTrackers`) still walks the workspace root at depth 6 and reads trackers up to 500KB; it is a write path outside scanBmadWorkspace and was left unchanged because depth 4 from the root would miss `_bmad-output/<initiative>/tickets/<epic>/tickets/tickets.toml`."
  - "`runGitCapture` keeps Node's 1MB default maxBuffer; an oversized diff falls through to the next diff source instead of being truncated."
---

<intent-contract>

## Intent

**Problem:** AD-7 recorded that scan call sites exceeded the C10 envelope (walk depth 6/3, reads up to 40-120KB, git 3000-4000ms) and that git status/diff paths leaked parent-repo prefixes when `workspaceRoot` was a subdirectory inside a larger git repository.

**Approach:** Add one frozen `SCAN_LIMITS` envelope (`maxDepth: 4`, `heuristicReadBytes: 30000`, `gitTimeoutMs: 2500`) in `scripts/bmad-engine.mjs` and route `scanBmadWorkspace` walks, `safeReadText` / `readJsonConfig` default caps (30KB), `inspectWorkspaceArtifact`, and the single `runGitCapture` git primitive through it. `safeReadText` reads at most `maxBytes` bytes from disk instead of loading the whole file, root `AGENTS.md`/`CONTEXT.md` discovery verifies regular non-symlink files via `lstatSync`, and `runGitInfo` / `inspectWorkspaceArtifact` scope git status (`-c status.relativePaths=true -c color.status=false status --short -- .`) and diffs (`--relative`) to `workspaceRoot` with normalized `/` paths.

</intent-contract>

## Implementation Notes

- `scripts/bmad-engine.mjs`: `SCAN_LIMITS`, bounded `safeReadText` and `readJsonConfig` defaulting to `SCAN_LIMITS.heuristicReadBytes` (30000 bytes), `walkFiles(..., SCAN_LIMITS.maxDepth)` for `_bmad-output/` and `docs/`, `lstatSync` regular-file guard on root `AGENTS.md`/`CONTEXT.md`, workspace-confined relative `git status` and `git diff --relative` / `git log --relative`, and 2500ms git subprocess timeouts.
- `tests/artifact-discovery.test.mjs`: 9 tests covering the envelope constants, depth <= 4 discovery across `_bmad-output/` and `docs/`, root `AGENTS.md`/`CONTEXT.md`/`docs/` (including non-file root entry rejection), per-artifact git status and subdirectory workspace confinement, diff previews (modified / last-commit / untracked) with normalized `/` paths, `../` / absolute / backslash / directory rejection, 30KB default read cap, single 2500ms git spawn site, and non-git workspaces.

## Verification

- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — passed (175/175 tests, 43 suites; re-verified 2026-11-25 in queue task #2, 0 failures; includes 9/9 in `tests/artifact-discovery.test.mjs`; version sync 0.5.4 OK).
- `node --check scripts/*.mjs` — passed.
