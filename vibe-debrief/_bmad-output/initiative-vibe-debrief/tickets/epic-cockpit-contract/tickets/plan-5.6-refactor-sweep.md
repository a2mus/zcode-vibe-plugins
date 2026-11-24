---
title: 'Refactor sweep'
type: feature
ticket: 6
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R1, R2, R3, R4, R5]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/epic-cockpit-contract.md'
---

# Build Ticket 5.6 — Refactor Sweep

## Intent

Completes Story 5.6 (`epic-cockpit-contract` Story 6, R1–R5, AD-14):
Builds on Stories 5.1–5.5 to perform a cleanup-only pass across `scripts/debrief-engine.mjs`, `scripts/mcp-server.mjs`, `scripts/hook-runner.mjs`, `scripts/check-version-sync.mjs`, and `tests/`, resolving deferred plan and review findings without altering behavior. Hands off the clean Epic 5 codebase to Epics 6 and 7.

## Implementation Details

- `scripts/check-version-sync.mjs`:
  - Updated section pointer comment on line 30 from `AGENTS.md §5 "Version Synchronization"` to `AGENTS.md ## Policy "Version Synchronization"`, resolving the documentation drift identified during the `validate.yml` / `AGENTS.md` queue review.

- `scripts/hook-runner.mjs`:
  - Updated AI synthesis system prompt diagram schema guidance on line 47 from the legacy 4 diagram types (`architecture | sequence | state-flow | cause-effect`) to all 5 OQ-5 grammars (`sequence | flow-diff | subway-map | before-after | decision-tree`), resolving the advisory finding from the Story 4.3/5.1 combined code review.

- Verification and regression sweep:
  - Validated syntax across all scripts via `node --check scripts/*.mjs`.
  - Validated full test suite via `node --test tests/` (197 tests across 35 suites passing with zero failures).
  - Validated 4-file version synchronization via `node scripts/check-version-sync.mjs` (all 4 locations synced to 0.3.0).
  - Validated repo-root sanity via `node ../scripts/validate.mjs`.

## Verification (Executed 2026-11-24)

- `node --check scripts/*.mjs` → exit 0.
- `node --test tests/` → 197 tests, 35 suites, 197 pass, 0 fail, exit 0 (~3.2s).
- `node scripts/check-version-sync.mjs` → `OK: all 4 version locations synced to 0.3.0`, exit 0.
- `node ../scripts/validate.mjs` → all plugins validated, exit 0.
