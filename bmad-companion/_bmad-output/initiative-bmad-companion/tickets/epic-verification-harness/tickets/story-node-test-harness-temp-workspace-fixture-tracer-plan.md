---
title: 'node:test harness + temp-workspace fixture tracer'
type: feature
ticket: 1
created: '2026-11-20'
status: done
baseline_revision: '72f7ca385cf61ea8159fb0daa9b0e0a0276a7043'
route: oneshot
route_source: pinned
risk: low
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `bmad-companion` currently has no automated test suite (`AGENTS.md` notes only manual `node --check` and stdio checks), leaving `scanBmadWorkspace` and future epic verification without a repeatable zero-dependency test harness or temp-workspace fixture helper.

**Approach:** Stand up `tests/` using Node's built-in `node:test` and `node:assert/strict` (zero `package.json` or npm dependencies), provide a reusable temp-workspace fixture helper in `tests/helpers.mjs` that seeds `_bmad-output/`, `sprint-status.yaml`, `tickets.toml`, and story plans with cleanup, and add a `scanBmadWorkspace` smoke test proving the fixture -> engine import -> `ScanResult` (`metrics`, `phases`, `epics`, `artifacts`) tracer path.

</frozen-after-approval>

## Implementation Notes

- Route `oneshot` was pinned by invocation (`route: oneshot`) and fits this low-risk tracer bullet: it adds new isolated files under `tests/` without modifying any production `scripts/*.mjs` or `assets/panel.html` code.
- Created `tests/helpers.mjs` (`createTempWorkspace`, `seedBmadWorkspace`, `REPO_ROOT`, script path constants) and `tests/engine-smoke.test.mjs` (`node:test` + `node:assert/strict` covering zero-`package.json` policy, v7 initiative + `tickets.toml` + `sprint-status.yaml` + story plan scan, and v6 `sprint-status.yaml` fallback).
- Observation during test run: `normalizeStatus("built")` in `scripts/bmad-engine.mjs` currently maps `"built"` to `"backlog"`, whereas `"done"` maps to `"done"` and triggers smart reconciliation; seeded `story-seed-fixture-plan.md` with `status: done` without altering runtime `scripts/bmad-engine.mjs` (deferred to `epic-dual-progress-reconciliation`).
- Verification: `node --test tests/` passed (3/3 tests, 0 failures) and `node --check` passed on `scripts/bmad-engine.mjs`, `scripts/mcp-server.mjs`, and `scripts/hook-runner.mjs`.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `node --test tests/` -- expected: all tests pass with exit code 0 on Node 18+ with zero npm dependencies (`package.json` absent), confirming `scanBmadWorkspace` returns valid `metrics`, `phases`, `epics`, and `artifacts` keys from a seeded temp workspace.
- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` -- expected: syntax checks pass with exit code 0.
