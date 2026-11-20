---
title: 'Temp-file + renameSync atomic savePersistedState tracer'
type: refactor
ticket: '1'
created: '2026-11-20'
status: built
baseline_revision: '7dc4e0a4277ffec2b5e1a9523a7d696c31f15daf'
route: oneshot
route_source: pinned
risk: high
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
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
