---
title: 'Smart evidence evaluator rules'
type: feature
ticket: 2
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

**Problem:** Under C12, deterministic primary path execution requires verified evidence before upgrading `smartStatus` to `done`. Specifically, the evidence evaluator must upgrade `smartStatus` to `done` only on:
1. `storyOverrides` done (`status: "done"`)
2. story plan status marked `done`, `completed`, or `shipped`
3. passing implementation/test report (`failCount === 0`)
4. completed epic retrospective (`hasRetrospective: true`)

Conversely, a failing test report (`failCount > 0`) must hold status at `in-progress`/`review` and emit a high-priority remediation recommendation, and an unverified story must stay declared-only without false smart progression.

**Approach:**
1. In `scripts/bmad-engine.mjs`:
   - Updated `normalizeStatus` to recognize `"shipped"` and `"built"` alongside `"done"` and `"completed"`.
   - Exported `parseTestReportSummary(text)` to reliably extract total, passed, and failed counts (via frontmatter `failCount`/`failed`, summary regex `Total: X, Passed: Y, Failed: Z`, or inline counts) along with any failing test suite name.
   - Hardened v7 and v6 story evaluation:
     - Upgraded `smartStatus` to `done` only when verified by `storyOverrides` done, plan `done`/`completed`/`shipped`, passing report `failCount === 0`, or completed retrospective.
     - Kept unverified stories strictly declared-only (`smartStatus = declaredStatus`, `aiReconciled = false`, `smartReason = null`).
     - On failing reports (`failCount > 0`), held status at `review`/`in-progress` (never `done`).
   - Enhanced `buildRecommendations` to accept `failingReports` and emit a high-priority remediation recommendation (`priority: "high"`, `badge: "Remediation"`, `skill: "/bmad-build"`) whenever test failures are detected.
2. In `tests/reconciliation.test.mjs`:
   - Added 6 comprehensive tests in `smart evidence evaluator rules (Epic 3 Story 3.2)` asserting each evidence path (`storyOverrides`, plans `done`/`completed`/`shipped`, passing report `failCount === 0`, completed retro), the failing report hold + remediation recommendation, and unverified story declared-only behavior.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `"shipped"` and `"built"` to `normalizeStatus` return `"done"`.
  - Added `parseTestReportSummary(text)` helper handling frontmatter, `Total: X, Passed: Y, Failed: Z`, and inline `failCount` tokens.
  - Linked candidate implementation reports to stories during scan, tracking matched reports to prevent duplicate standalone reporting.
  - Hardened standalone and matched implementation reports so `failCount > 0` holds at `review` with warning insights and registers into `failingReports`.
  - Added high-priority remediation recommendation loop in `buildRecommendations` with `badge: "Remediation"` and contextual remediation prompt.
- **`tests/reconciliation.test.mjs`:**
  - Added test suite for Epic 3 Story 3.2 verifying all evidence paths and constraints across 6 test cases (83/83 total tests passing).

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --check scripts/bmad-engine.mjs && node --check tests/reconciliation.test.mjs` — passed (exit 0).
- `node --test tests/` — passed (83/83 tests, 0 failures, 19 suites).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — passed (83/83 tests, 0 failures; `[check-version-sync] OK: all 3 versions match (0.5.3)`; all plugins validated).

## Auto Run Result

- **Summary:** Implemented Story 3.2 smart evidence evaluator rules upgrading `smartStatus` to `done` only on verified evidence (`storyOverrides` done, plan `done`/`completed`/`shipped`, passing report `failCount === 0`, or completed retrospective), holding status at `review`/`in-progress` with high-priority remediation recommendations on `failCount > 0`, and keeping unverified stories declared-only.
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `tests/reconciliation.test.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-dual-progress-reconciliation/tickets/plan-2-smart-evidence-evaluator-rules.md`
