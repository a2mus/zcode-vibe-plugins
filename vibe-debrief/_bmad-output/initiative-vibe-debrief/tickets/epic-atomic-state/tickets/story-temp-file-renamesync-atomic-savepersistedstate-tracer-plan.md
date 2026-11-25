---
title: 'Temp-file + renameSync atomic savePersistedState tracer'
type: refactor
ticket: '1'
created: '2026-11-20'
status: done
baseline_revision: '7dc4e0a4277ffec2b5e1a9523a7d696c31f15daf'
route: oneshot
route_source: pinned
risk: high
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/initiative-vibe-debrief/tickets/epic-atomic-state/epic-atomic-state.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `savePersistedState` in `scripts/debrief-engine.mjs` currently overwrites `<workspaceRoot>/.zcode/vibe-debrief-state.json` directly with `writeFileSync`, risking torn, empty, or corrupted state files during concurrent or interrupted writes.

**Approach:** Replace the direct `writeFileSync` overwrite in `savePersistedState` with a sibling temporary file (`vibe-debrief-state.<pid>.<timestamp>-<seq>.tmp`) followed by atomic `renameSync`, safe Windows `EPERM`/`EACCES`/`EXDEV` retry/fallback handling, guaranteed `.tmp` cleanup in `finally`, preserved read-only catch-and-ignore behavior and `15/15/50` collection bounds, and dedicated unit tests in `tests/`.

</frozen-after-approval>

## Implementation Notes

- Route `oneshot` pinned per explicit user request (`using oneshot route and skip review`) for cohesive single-engine-function + unit-test tracer ticket `2.1` (`epic-atomic-state`, `id: 1`).
- Codebase investigation baseline: `scripts/debrief-engine.mjs` lines 36–113 (`getStateFilePath`, `STATE_COLLECTION_LIMITS`, `boundStateCollections`, `loadPersistedState`, `savePersistedState`), `tests/helpers.mjs` (`createTempWorkspace`), and `tests/debrief-engine.test.mjs` (`describe("workspace state persistence", ...)`).
- Updated `scripts/debrief-engine.mjs`: added `buildSiblingTempPath` (`vibe-debrief-state.<pid>.<timestamp>-<seq>.tmp`), `atomicWriteStateFileSync` (sibling temp `writeFileSync` + atomic `renameSync`, `[2, 5]ms` bounded `Atomics.wait` retry on Windows `EPERM`/`EACCES`, safe `writeFileSync` fallback on persistent `EPERM`/`EACCES`/`EXDEV`, guaranteed `.tmp` `unlinkSync` in `finally`), and optional `options` injection on `savePersistedState(workspaceRoot, patch, options = {})` keeping all 2-arg callers unchanged.
- Added `tests/atomic-state.test.mjs` (10 tests): sibling `.tmp` naming + atomic rename, sequential unique `<seq>` generation, transient `EPERM`/`EACCES` retry recovery, persistent `EPERM`/`EACCES`/`EXDEV` fallback + `.tmp` cleanup, fatal mid-write/rename failure preserving prior `state.json`, unwritable/read-only directory fallback, and `15/15/50` bounds preservation.
- Verification run: `node --test tests/` passed `118/118` tests (`21` suites, `0` failures); syntax checks and `hook-runner.mjs session-start` smoke test exited `0`.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `node --test tests/` -- expected: all existing and new atomic-write / cleanup / Windows-fallback / read-only tests pass with zero failures
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` -- expected: exits 0 with no syntax errors
- `echo '{}' | node scripts/hook-runner.mjs session-start` -- expected: exits 0 and emits valid single-line JSON

## Auto Run Result

- **Summary:** Follow-up review pass with `review: none` confirmed ticket 2.1's atomic `savePersistedState` tracer is implemented and verified end to end. No code changes were required in this pass.
- **Files changed (since baseline `7dc4e0a`):**
  - `scripts/debrief-engine.mjs` — adds `buildSiblingTempPath` (unique `vibe-debrief-state.<pid>.<timestamp>-<seq>.tmp`), `atomicWriteStateFileSync` (temp write + atomic `renameSync`, bounded Windows `EPERM`/`EACCES` retry, `EXDEV` direct-write fallback, guaranteed `.tmp` cleanup in `finally`), and injectable `options` on `savePersistedState` while all existing 2-arg callers stay unchanged (commit `bd9312d`).
  - `tests/atomic-state.test.mjs` — atomic-state unit tests for sibling `.tmp` naming, sequential uniqueness, transient `EPERM`/`EACCES` recovery, `EXDEV` fallback, persistent-lock preservation, fatal mid-write/rename preservation, read-only/unwritable degradation, and `15/15/50` bounds, plus concurrent MCP/Hook race stress and Stop latency checks (commits `bd9312d`, `20b8c2d`).
  - This plan file — status and `## Auto Run Result` updates for this pass.
- **Review:** none; no lenses launched (pinned).
- **Verification performed:**
  - `node --test tests/` → **120/120 tests pass**, 22 suites, 0 failures (includes `describe("atomic savePersistedState")` and the concurrent race suite).
  - `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` → exit 0.
  - `echo '{}' | node scripts/hook-runner.mjs session-start` → exit 0 with valid single-line JSON.
  - Direct Node inspection in temp workspaces: `savePersistedState` wrote `turnCount: 21` with matching `updatedAt` and left **zero `.tmp` files**; a read-only `.zcode` blocker left the sentinel intact and returned the merged state without throwing, confirming graceful degradation.
- **Residual risks:** Windows lock retry uses bounded synchronous waits (default schedule `[2,5,10,15,25,40] ms`) on the persistence path, and persistent `EPERM`/`EACCES` silently preserves prior state by design (matching the read-only ignore contract). The shared git repository root also holds pre-existing, unrelated uncommitted files under `../bmad-companion/` that predate this run; they are outside this ticket's reviewed diff and were left untouched.
