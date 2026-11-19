---
type: epic
title: Atomic state writes
parent: initiative-vibe-debrief
covers: [R9]
sources:
  - _bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
after: [epic-test-suite]
refined: true
risk: high
---

# Atomic state writes

## Description

Builds on Epic 1's spawned-process harness and temp-workspace fixtures (`1.1`–`1.4`) so concurrent MCP and Hook processes writing `vibe-debrief-state.json` never leave a torn or partial file; every write lands whole via a sibling temporary file plus atomic `renameSync` or preserves the previous state while keeping `Stop`-hook heuristic latency at or under `50ms` (`C6`). Hands off the finished atomic write path to Epics 3–5.

## Outcome

Concurrent MCP and Hook turns never corrupt workspace state on disk and preserve sub-50ms `Stop`-hook responsiveness.

## Requirements

1. **R1 (parent R9)**: `savePersistedState` writes serialized JSON to a uniquely named sibling temporary file (`vibe-debrief-state.<pid>.<timestamp>-<seq>.tmp`) in `<workspaceRoot>/.zcode/` and atomically replaces `vibe-debrief-state.json` via `renameSync` (with safe Windows `EPERM`/`EACCES`/`EXDEV` retry/fallback and guaranteed `.tmp` cleanup) with last-writer-wins semantics, no lockfiles, and preserved read-only workspace fallback and collection bounds (`15/15/50`).
2. **R2 (parent R9)**: Concurrent MCP (`tools/call`) and Hook (`post-tool`, `stop`) processes racing against the same workspace never produce a torn, empty, or corrupted `vibe-debrief-state.json` or orphaned `.tmp` files, and `Stop`-hook heuristic synthesis + atomic write completes within `<= 50ms` (`C6`).

## Constraints

- **C1, C2, C5–C7** (parent `C1`, `C2`, `C5`–`C7`): Zero external dependencies (`node:fs` built-ins only, no lockfile packages), strict Engine/MCP/Hook layer separation, `Stop`-hook heuristic latency `<= 50ms` (`C6`), bounded collections (`15/15/50`), welcome-seed on missing/corrupt state, and graceful read-only workspace fallback (`C7`).

## Done when

1. `savePersistedState` writes via sibling temp file plus atomic `renameSync` (with safe Windows `EPERM`/`EACCES`/`EXDEV` handling and temp cleanup) without lockfiles.
2. A concurrent MCP + Hook race test in `node --test tests/` passes with zero torn or partial `vibe-debrief-state.json` reads and zero orphaned `.tmp` files.
3. Read-only workspace fallback and `Stop`-hook `<= 50ms` heuristic latency (`C6`) hold under automated verification.

## Boundaries

- Belongs to siblings: base test harness (`epic-test-suite`), theme-token parity (`epic-theme-parity`), panel accessibility & `v0.3.0` release stamp (`epic-panel-a11y`), and `v0.4.0` Cockpit HUD (`epic-cockpit-contract`, `epic-cockpit-hud-core`, `epic-concept-deep-dive`).

## References

- parent — `_bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md`, Requirements `R9`, Constraints `C1`, `C2`, `C5`–`C7`
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md`, `AD-5`, `AD-11`

## Notes

- Risk reason (`high`): Modifies the core `savePersistedState` disk write path invoked by every MCP mutation tool and lifecycle hook on Windows and POSIX filesystems under a `<= 50ms` `Stop`-hook latency budget.
- High-risk check beyond criteria: Run a parallel spawned-process stress test where MCP `vibe_debrief_publish` and Hook `stop`/`post-tool` processes hammer a shared temp workspace simultaneously while a reader loop continuously parses `vibe-debrief-state.json` and verifies zero parse errors, zero leftover `.tmp` files, and `<= 50ms` `Stop` latency.
- Decision: 2026-11-19 — Confirmed atomic write mechanism is sibling temp file (`vibe-debrief-state.<pid>.<timestamp>-<seq>.tmp`) plus `renameSync` with last-writer-wins semantics and no lockfile (`AD-5`).
- Decision: 2026-11-19 — Tracer bullet is Story 1 (`Temp-file + renameSync atomic savePersistedState tracer`), proving the atomic write + Windows fallback + cleanup path before Story 2 stresses it across concurrent MCP/Hook child processes (`2.1 -> 2.2`).
- Waits on epic-test-suite because: needs the spawned-process harness and temp-workspace fixtures (`1.1`–`1.4`) to verify concurrent MCP/Hook writes.
- Layer files: `scripts/debrief-engine.mjs`, `tests/atomic-state.test.mjs`.
