---
epic: epic-atomic-state
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective — epic-atomic-state (Wave 1 Epic 2, atomic state writes)

Part of the combined Wave 1 retrospective run (Epics 1–4) executed as BMAD Queue Task #2
(`/bmad-retrospective`, route=oneshot, review=none) before tagging `v0.4.0`. Sibling documents:
`../epic-test-suite/epic-test-suite-retrospective.md`,
`../epic-theme-parity/epic-theme-parity-retrospective.md`,
`../epic-panel-a11y/epic-panel-a11y-retrospective.md`.

## Epic summary

Spec: `epic-atomic-state.md` (Requirements R1–R2, Constraints C1/C2/C5–C7, `Done when` 1–3, plus
named high-risk beyond-criteria check — declared criteria).

Tickets (build order, `tickets.py status epic-atomic-state`, run 2026-11-25):

| Ref | Title | Status |
|-----|-------|--------|
| 2.1 | Temp-file + renameSync atomic savePersistedState tracer | done |
| 2.2 | Concurrent MCP + Hook race stress suite & <=50ms Stop latency check | done |

`pending_tickets` is empty (`2/2` done in `tickets.toml` and both plan files). Note: `tickets.py
status` reports the epic-level `status` as `""` because `epic-atomic-state.md:1-14` omits `status: done`
(see F2-3).

Evidence inventory (Phase 1):

- Epic file `epic-atomic-state.md` and `tickets/tickets.toml` read in full.
- Plans `story-temp-file-renamesync-atomic-savepersistedstate-tracer-plan.md` (`2.1`) and
  `story-concurrent-mcp-hook-race-stress-suite-50ms-stop-latency-chec-plan.md` (`2.2`) read in full.
  Both plans record explicit `baseline_revision` values (`7dc4e0a` for `2.1`, `111e469` for `2.2`).
- `git_evidence.py` (`7dc4e0a..7331beb`, `vibe-debrief/` paths): `scripts/debrief-engine.mjs`
  +112/−8 (net +104, 2 commits `bd9312d` and `20b8c2d`), `tests/atomic-state.test.mjs` +692/−10
  (net +682, 2 commits), plus plan updates (+161/−10). `binary_revisions` 0, 0 merges. (Range also
  contains sibling `bmad-companion/` commits `111e469` and `6003edc`.)
- Run/walkthrough records in-tree: `_bmad-output/initiative-vibe-debrief/walkthrough-ticket-2-1-atomic-state/walkthrough-ticket-2-1-atomic-state.md`
  read; treated as descriptive record alongside current code/tests.
- Current absolute sizes (measured this session): `tests/atomic-state.test.mjs` 682 lines;
  `atomicWriteStateFileSync` / `savePersistedState` at `scripts/debrief-engine.mjs:106-217`.
- Session logs: **not available** in queue context → process-lesson analysis from logs skipped.
- Previous retrospective: `../epic-test-suite/epic-test-suite-retrospective.md` (created in this
  same Wave 1 retro run; no prior historical action items existed before Epic 2 ran).

## Findings

### High-risk verification & Windows contention fix (checked and clean)

- **F2-1 — Story 2.2's concurrent stress test caught a real Windows `EPERM` non-atomic fallback race.**
  Story 2.1 (`bd9312d`) initially allowed `EPERM`/`EACCES` on `renameSync` to fall back to direct
  `writeFileSync(targetPath)` after `[2, 5]ms` retries. When Story 2.2's 24-child-process parallel
  MCP + Hook race stress test (`tests/atomic-state.test.mjs:382-576`) ran on Windows with a
  continuous `JSON.parse` reader loop, transient `EPERM` contention triggered that fallback and tore
  `vibe-debrief-state.json`. Commit `20b8c2d` fixed this in `scripts/debrief-engine.mjs:135-191` by
  narrowing `isRenameFallbackError` to `EXDEV` only (`:139-141`) and expanding default
  `retryDelaysMs` to `[2, 5, 10, 15, 25, 40]` (`:156`), so persistent Windows `EPERM`/`EACCES`
  preserves the prior valid `state.json` and cleans up `.tmp` in `finally` (`:193-200`).
  Disposition: **accept as-is** (resolved and continuously regression-tested).

### Working-tree / untracked artifact hygiene

- **F2-2 — Twelve leftover numeric directories (`0/` through `11/`) exist at plugin root.**
  Inspection of `vibe-debrief/` (`ls -la`) found 12 directories `0/`..`11/` timestamped `Nov 20 16:12`
  (six minutes before commit `20b8c2d` at `16:18:18`), each containing `.zcode/vibe-debrief-state.json`.
  Because `../.gitignore` excludes `.zcode/` and Git does not track empty parent directories whose
  only contents are ignored, `git status` reports the tree clean while those directories remain on
  disk. Disposition: **defer** — clean up `0/`..`11/` after user confirmation (not deleted by this
  retro run; Action item A2-1). Prevention: stress tests must always write inside `os.tmpdir()`
  (`createTempFixture`) and verify `process.cwd()` is untouched.

### Tracker / metadata hygiene

- **F2-3 — `epic-atomic-state.md` frontmatter lacks `status: done`.**
  `tickets.py status epic-atomic-state` reports `"status": ""` on the epic record, whereas
  `epic-test-suite.md:3`, `epic-theme-parity.md:3`, and `epic-panel-a11y.md:17` all declare
  `status: done`. Both stories (`2.1`, `2.2`) are `done` in `tickets.toml` and their plans.
  Disposition: **defer** — propose setting `status: done` when closing via `bmad-agent-po`
  (Action item A2-2).

### Spec-to-implementation reconciliation (checked and clean)

- **F2-4 — R1/R2, bounds, read-only fallback, and `<= 50ms` Stop latency checked and clean.**
  `tests/atomic-state.test.mjs` verifies sibling temp naming (`vibe-debrief-state.<pid>.<ts>-<seq>.tmp`),
  Windows `EPERM`/`EACCES` retries, `EXDEV` fallback, fatal error preservation, read-only degradation,
  `15/15/50` bounds, 24-process concurrent MCP+Hook race safety, and 20-iteration Stop-hook heuristic
  + atomic save latency (`p95 <= 50ms`, `max <= 50ms`, `:577-679`), all passing in this session.
  Architecture delta: zero new dependencies (`node:fs` only), no lockfiles, and `savePersistedState`
  retains backward-compatible 2-arg callers (`options = {}` at `scripts/debrief-engine.mjs:203`).

## Behavior verification

Executed in this session (2026-11-25, headless queue on Windows `win32 10.0.26200`, Node `v26.12.1`):

- `node --test "tests/*.test.mjs"` → **274 tests, 50 suites, 274 pass, 0 fail, 0 skipped** (~10.8s).
  `atomic savePersistedState` (10 tests, ~108.9ms) and `concurrent MCP + Hook race stress & Stop latency`
  (2 tests, ~1546.4ms) both pass with zero torn JSON reads, zero `.tmp` leftovers, and `<= 50ms`
  `p95` and `max` Stop latency.
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs` → exit `0`.
- `node scripts/check-version-sync.mjs` and `node ../scripts/validate.mjs` → exit `0`.
- Narrowing recorded: `bmad-review` multi-lens pass **skipped per queue execution policy
  (`review=none`)**.

## Previous-retro follow-through

`../epic-test-suite/epic-test-suite-retrospective.md` was produced in this same Wave 1 retro run;
its process lessons (`A1-1`, `A1-2`) did not predate Epic 2's execution. Notably, Epic 2 **did**
record `baseline_revision` in both plan frontmatters (`7dc4e0a`, `111e469`), enabling exact
per-story commit/diff attribution.

## Action items

- **A2-1 (defer — workspace cleanup, owner: user)**: confirm and remove the 12 leftover `Nov 20`
  directories `vibe-debrief/0/`..`11/` containing ignored `.zcode/vibe-debrief-state.json` files
  (F2-2).
- **A2-2 (propose — metadata sync, owner: user via `bmad-agent-po`)**: add `status: done` to
  `_bmad-output/initiative-vibe-debrief/tickets/epic-atomic-state/epic-atomic-state.md` frontmatter
  so `tickets.py status` matches Epics 1, 3, and 4 (F2-3).

Durable engineering lessons (recorded for reuse):

1. Unit tests with mocked `fs` stubs did not catch real Windows `EPERM` timing contention; only the
   multi-process stress test (`2.2`) exposed that falling back to direct `writeFileSync` on `EPERM`
   caused torn reads.
2. On Windows, preserving the previous valid state file on persistent `EPERM`/`EACCES` (and restricting
   direct fallback strictly to `EXDEV`) is essential for true crash/race atomicity without lockfiles.

## Decision records

Both Story 2.1's `<frozen-after-approval>` block and Story 2.2's `<intent-contract>` codify a
hard-to-reverse architectural choice backed by commits `bd9312d` and `20b8c2d` (no existing ADR in
`docs/decisions/`). Headless run: **proposed only, no file written**:

- **Proposed ADR — "Atomic state persistence via sibling temp-file + renameSync with EXDEV-only fallback"**:
  context — concurrent MCP and Hook processes write `.zcode/vibe-debrief-state.json` under a
  `<= 50ms` Stop-hook budget without npm lockfile dependencies; decision — write to
  `vibe-debrief-state.<pid>.<timestamp>-<seq>.tmp`, retry Windows `EPERM`/`EACCES` over
  `[2, 5, 10, 15, 25, 40]ms`, fall back to direct write only on `EXDEV`, preserve prior state on
  persistent locks, and unlink `.tmp` in `finally` (`scripts/debrief-engine.mjs:106-217`, plans
  `2.1`/`2.2`, commits `bd9312d`/`20b8c2d`); why — eliminates torn reads and lockfile deadlocks
  while honoring read-only fallback (`C6`/`C7`/`AD-5`). Suggested file:
  `docs/decisions/adr-atomic-state-sibling-rename.md` — awaiting user approval.

## Acceptance verdict

**accepted-with-open-items** — criteria **declared** (`epic-atomic-state.md` Requirements R1–R2,
`Done when` 1–3, plus high-risk race check).

- Done-when 1 (sibling temp + `renameSync`, Windows error handling, `.tmp` cleanup, no lockfiles):
  met — `scripts/debrief-engine.mjs:151-217`, verified by 10 unit tests.
- Done-when 2 (concurrent MCP + Hook race test with zero torn reads and zero `.tmp` leftovers):
  met — 24-process parallel stress test passes (`tests/atomic-state.test.mjs:382-576`).
- Done-when 3 (read-only fallback + `<= 50ms` Stop-hook latency): met — verified in
  `tests/atomic-state.test.mjs:318-355,577-679` this session.
- Both tickets (`2.1`, `2.2`) finished (`pending_tickets` empty); open items are non-blocking
  housekeeping (`A2-1` leftover `0/`..`11/` dirs, `A2-2` epic frontmatter `status: done`).

## Open questions

- Confirm deleting the leftover `0/`..`11/` directories created during the Nov 20 stress-test run (F2-2).
- Whether to write the proposed `adr-atomic-state-sibling-rename.md` decision record.

## Assumptions (headless run)

1. Epic resolved from the invocation ("Wave 1 epics (…, epic-atomic-state, …)") to
   `_bmad-output/initiative-vibe-debrief/tickets/epic-atomic-state`.
2. Headless queue mode: no interactive confirmations, no Phase 3 team discussion, verdict rendered
   from evidence alone.
3. `bmad-review` multi-lens pass skipped per queue execution policy `review=none`; narrowing recorded.
4. No workspace cleanup or ADR file writes were executed autonomously; `A2-1`, `A2-2`, and the
   proposed ADR await user approval.
