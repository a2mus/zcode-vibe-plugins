---
title: 'Dual-progress scan tracer (v6 YAML + v7 TOML fixture -> declared vs smart)'
type: feature
ticket: 1
container: epic-dual-progress-reconciliation
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

**Problem:** To support safe tracker reconciliation (Epic 3), the engine scanner must accurately compute and distinguish between Static Tracker Progress (`declaredDoneStories`, `declaredOverallPct`) and Smart AI Progress (`smartDoneStories`, `smartOverallPct`, `reconciledStoriesCount`) across BMAD v6 (`sprint-status.yaml`) and v7 (`tickets.toml` + story plans) workspaces, providing a traceable `smartReason` per upgraded story. Prior to Story 3.1, story objects only exposed `smartEvidence` and test harnesses lacked a standardized dual-metric fixture with test reports for testing reconciliation.

**Approach:**
1. Populate `smartReason: smartEvidence` across all story objects generated in `scanBmadWorkspace` (`scripts/bmad-engine.mjs`), ensuring evidence reasons are accessible under both keys while preserving backward compatibility.
2. In `tests/helpers.mjs`, provide `includePassingTestReport` in `seedBmadWorkspace`, export `seedDualMetricWorkspace`, and add `seedDualMetric` to `createTempWorkspaceTracker` to seed a realistic workspace with v6 `sprint-status.yaml`, v7 `tickets.toml`, story plans, and a passing test report.
3. Update `assets/panel.html` to accept `smartReason || smartEvidence`.
4. Create `tests/reconciliation.test.mjs` verifying the dual metric sets (`declared*` vs `smart*`) and non-empty `smartReason` on the seeded v6+v7 fixture as well as v6 fallback workspaces.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `smartReason: smartEvidence` to story representations across v7 toml entries, unlisted plan files, epic retrospectives, v6 fallback stories, and implementation report delivery/stabilization items.
  - Updated `reconcileWorkspaceTrackers` to look up `story.smartReason || story.smartEvidence`.
- **`assets/panel.html`:**
  - Updated story evidence rendering to check `s.smartReason || s.smartEvidence`.
- **`tests/helpers.mjs` & `tests/helpers.test.mjs`:**
  - Added `includePassingTestReport` and `testReportName` options to `seedBmadWorkspace`.
  - Exported `seedDualMetricWorkspace` and added `tracker.seedDualMetric()` to `createTempWorkspaceTracker`.
  - Added test in `tests/helpers.test.mjs` asserting fixture generation with passing test report.
- **`tests/engine-smoke.test.mjs`:**
  - Added assertions for `smartReason` on the smoke scan story.
- **`tests/reconciliation.test.mjs`:**
  - Added 5 test cases for Epic 3 Story 3.1 asserting dual `declared*` and `smart*` metric sets, non-empty `smartReason` on evidence-upgraded stories, v6 fallback dual metrics, and fixture handoff to Stories 3.2 and 3.3.

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --check scripts/bmad-engine.mjs && node --check tests/helpers.mjs && node --check tests/reconciliation.test.mjs` — passed (exit 0).
- `node --test tests/` — passed (77/77 tests, 0 failures, 18 suites).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — passed (77/77 tests, 0 failures; `[check-version-sync] OK: all 3 versions match (0.5.3)`; all plugins validated).

## Auto Run Result

- **Summary:** Implemented Story 3.1 dual-progress scan tracer exposing both `declared*` and `smart*` metric sets and a non-empty `smartReason` per upgraded story, seeded the reusable dual-metric fixture in `tests/helpers.mjs`, and verified with 5 new tests in `tests/reconciliation.test.mjs` (77/77 passing across suite).
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `assets/panel.html`
  - `tests/helpers.mjs`
  - `tests/helpers.test.mjs`
  - `tests/engine-smoke.test.mjs`
  - `tests/reconciliation.test.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-dual-progress-reconciliation/tickets/plan-1-dual-progress-scan-tracer.md`
