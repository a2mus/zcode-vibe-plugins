---
title: 'Concurrent MCP + Hook race stress suite & <=50ms Stop latency check'
type: feature
ticket: '2'
created: '2026-11-20'
status: done
baseline_revision: '111e4695a71f5ed33c7e3aa1e289ec70131bb03b'
route: full
route_source: auto
risk: high
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/initiative-vibe-debrief/tickets/epic-atomic-state/epic-atomic-state.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 1 proved `savePersistedState` atomic write + cleanup in single-process unit tests, but concurrent real child processes (MCP `tools/call` and Hook `post-tool`/`stop`) racing against the same workspace and the `<= 50ms` `Stop`-hook heuristic latency budget (`C6`) are not yet stress-verified.

**Approach:** Add a parallel spawned-process race stress test (`runMcpServer` + `runHookRunner`) hammering a shared temp workspace while a continuous reader loop validates every read of `vibe-debrief-state.json`, plus an automated `<= 50ms` `Stop`-hook heuristic synthesis + atomic write benchmark in `tests/atomic-state.test.mjs`.

## Boundaries & Constraints

**Always:**
- Use zero external dependencies (`node:` built-ins and existing `tests/helpers.mjs` fixtures/process runners).
- Run all stress and latency tests against disposable `createTempFixture` / `createTempWorkspace` roots (`ZCODE_WORKSPACE_ROOT`, `ZCODE_PROJECT_DIR`, `ZCODE_HOME_DIR`) so live `~/.zcode` and repo `.zcode` are never touched.
- Enforce zero torn/invalid JSON reads (missing `state.json` before first write is allowed; once created, every read must parse cleanly as valid JSON), zero leftover `.tmp` files after completion, and `<= 50ms` for the `Stop`-hook heuristic synthesis + atomic `savePersistedState` path (`C6`).

**Never:**
- Do not modify production runtime semantics in `scripts/debrief-engine.mjs`, `scripts/mcp-server.mjs`, or `scripts/hook-runner.mjs` unless a genuine race or latency defect is exposed during stress testing.
- Do not assert `<= 50ms` on OS child-process spawn startup overhead (`spawn(node)`); measure the in-process `Stop` heuristic synthesis + atomic write pipeline (`loadPersistedState` -> `synthesizeHeuristicDebrief` -> `savePersistedState`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Concurrent MCP + Hook writers with continuous reader | Parallel `runMcpServer` (`vibe_debrief_publish`) and `runHookRunner` (`post-tool`, `stop`) against one workspace while reader polls `vibe-debrief-state.json` | All child processes exit `0`; every observed `state.json` parses as valid JSON with bounded arrays; zero `.tmp` files remain | Reader treats initial `ENOENT` (before first write) as not-yet-created; any `SyntaxError` or leftover `.tmp` fails the test |
| `Stop`-hook heuristic synthesis + atomic write latency (`C6`) | Repeated `loadPersistedState` + `synthesizeHeuristicDebrief` + `savePersistedState` runs on realistic multi-file turn payload | `Stop`-hook heuristic synthesis + atomic write completes within `<= 50ms` | Assert measured p95 / max duration `<= 50ms` |

</intent-contract>

## Code Map

- `tests/atomic-state.test.mjs` -- Existing Story 1 unit suite (lines 1–315) using `createTempWorkspace`, `readJsonFile`, `listTempFiles`; append Story 2 concurrent race stress and Stop latency tests here.
- `tests/helpers.mjs` -- Reusable `createTempFixture`, `runMcpServer`, `runHookRunner`, `readJsonFile` (lines 109–395); `runHookRunner` already clears `VIBE_DEBRIEF_OPENAI_KEY` and `OPENAI_API_KEY` for hermetic `stop` runs.
- `scripts/debrief-engine.mjs` -- `loadPersistedState`, `savePersistedState`, `synthesizeHeuristicDebrief` (lines 86–214, plus `synthesizeHeuristicDebrief`); read-only unless a real race/latency bug surfaces.
- `scripts/hook-runner.mjs` -- `post-tool` (lines 160–189) and `stop` heuristic + atomic save path (lines 191–311); `stop` emits `{}` to stdout with zero extra logs.
- `scripts/mcp-server.mjs` -- `vibe_debrief_publish` handler calling `savePersistedState` via stdio JSON-RPC.

## Tasks & Acceptance

**Execution:**
- [x] `tests/atomic-state.test.mjs` -- Add a concurrent MCP (`vibe_debrief_publish`) + Hook (`post-tool`, `stop`) spawned-process race stress test using `createTempFixture`, `runMcpServer`, `runHookRunner`, and a continuous `readFileSync` + `JSON.parse` reader loop asserting zero parse errors, valid state schema/bounds, clean child exits, and zero leftover `.tmp` files -- directly verifies R2 and the epic high-risk race check.
- [x] `tests/atomic-state.test.mjs` -- Add a `Stop`-hook heuristic synthesis + atomic write latency benchmark (`loadPersistedState` + `synthesizeHeuristicDebrief` + `savePersistedState` with `performance.now()`) asserting `<= 50ms` (`C6`) across repeated realistic turns -- directly verifies C6 and R2 without OS process-spawn flakiness.

**Acceptance Criteria:**
- Given a shared disposable workspace, when parallel spawned MCP (`vibe_debrief_publish`) and Hook (`post-tool`, `stop`) processes write concurrently while a reader loop continuously parses `vibe-debrief-state.json`, then zero JSON parse errors occur, all processes exit `0`, final state is valid and bounded (`15/15/50`), and zero `.tmp` files remain.
- Given a realistic turn payload with touched files and assistant output, when the `Stop`-hook heuristic synthesis and atomic `savePersistedState` path executes, then it completes within `<= 50ms` (`C6`).

## Implementation Notes

- Added `describe("concurrent MCP + Hook race stress & Stop latency", ...)` to `../../../../tests/atomic-state.test.mjs` with a 2-wave, 24-child-process concurrent race stress test (`runMcpServer` `vibe_debrief_publish` + `runHookRunner` `post-tool` and `stop`) paired with a continuous `setImmediate` `readFileSync` + `JSON.parse` reader loop and a 20-run `Stop`-hook heuristic synthesis + atomic `savePersistedState` latency benchmark (`p95 <= 50ms`, `max <= 50ms`).
- **Windows race defect exposed & fixed in `../../../../scripts/debrief-engine.mjs`:** Under concurrent reader + writer contention on Windows, `renameSync` hit transient `EPERM` beyond the `[2, 5]ms` retry budget and fell back via `isRenameFallbackError` to a direct non-atomic `writeFileSync(targetPath, ...)`, causing torn JSON reads. Narrowed `isRenameFallbackError` to `EXDEV` only (preserving the prior valid `vibe-debrief-state.json` and cleaning up `.tmp` on persistent `EPERM`/`EACCES`) and expanded default `retryDelaysMs` to `[2, 5, 10, 15, 25, 40]`.
- Updated the Story 1 persistent `EPERM`/`EACCES` unit tests in `../../../../tests/atomic-state.test.mjs` to assert preservation of the baseline `state.json` and zero non-atomic `writeFileSync(statePath)` calls, while keeping the `EXDEV` fallback test intact.

## Plan Change Log

## Review Triage Log

### 2026-11-20 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none (`quick` lens reported all ACs, `AGENTS.md` rules, and surrounding contracts satisfied with no bugs).

## Auto Run Result

- **Summary of implemented change:** Added the concurrent spawned-process MCP + Hook race stress suite and `<= 50ms` `Stop`-hook heuristic latency benchmark (`C6`), and fixed a real Windows `EPERM` non-atomic fallback race exposed by the stress test in `atomicWriteStateFileSync`.
- **Files changed:**
  - `../../../../scripts/debrief-engine.mjs` — Narrowed `isRenameFallbackError` to `EXDEV` only and expanded default `retryDelaysMs` to `[2, 5, 10, 15, 25, 40]` so Windows `EPERM`/`EACCES` contention never tears `vibe-debrief-state.json`.
  - `../../../../tests/atomic-state.test.mjs` — Added 24-process MCP/Hook concurrent race stress test with continuous reader loop, `<= 50ms` `Stop`-hook heuristic latency check, and updated persistent `EPERM`/`EACCES` unit assertions.
  - `story-concurrent-mcp-hook-race-stress-suite-50ms-stop-latency-chec-plan.md` — Story 2.2 plan, triage log, and completion record.
- **Review findings breakdown:** 0 findings (`0` patches applied, `0` deferred, `0` rejected).
- **Follow-up review recommendation:** `false` (patched counts: `high 0`, `medium 0`, `low 0`).
- **Verification performed:**
  - `node --test tests/atomic-state.test.mjs` — `12/12` passed (`0` failures).
  - `node --test tests/` — `120/120` passed across `22` suites (`0` failures).
  - `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` — exited `0`.
- **Residual risks:** Under extreme sustained Windows file-lock contention exceeding the `[2, 5, 10, 15, 25, 40]ms` retry schedule, a single `savePersistedState` write preserves the previous valid `vibe-debrief-state.json` intact rather than tearing it (last-writer-wins with clean `.tmp` cleanup).

## Verification

**Commands:**
- `node --test tests/atomic-state.test.mjs` -- expected: all Story 1 unit tests and Story 2 concurrent race + `<= 50ms` Stop latency tests pass with 0 failures
- `node --test tests/` -- expected: full test suite passes with 0 failures
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` -- expected: exits 0
