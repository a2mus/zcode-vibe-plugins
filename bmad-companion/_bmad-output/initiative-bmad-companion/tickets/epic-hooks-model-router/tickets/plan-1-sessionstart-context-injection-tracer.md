---
title: 'SessionStart context-injection tracer'
type: story
ticket: 1
container: epic-hooks-model-router
created: '2026-11-25'
status: done
baseline_revision: 'e717dfe'
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

**Problem:** Story 6.1 (`epic-hooks-model-router#1`) delivers the `SessionStart` context-injection tracer on top of Epic 1's hook stdout-isolation harness (`1.3`), ensuring `SessionStart` scans the workspace and emits a single JSON stdout line carrying `additionalContext` with smart-vs-static metrics, active provider counts, top 3 `/bmad-<skill> "<prompt>"` commands paired with recommended `providerId/modelId` models, and companion guidance rules (`R1`, parent `R19`).

**Approach:**
1. Assemble the `SessionStart` `additionalContext` block via `buildSessionStartContext(scan)` in `scripts/bmad-engine.mjs` and emit it from `handleSessionStart` in `scripts/hook-runner.mjs` through the single guarded `emitHookFrame` stdout point while updating `lastSessionStartAt`.
2. Verify via `tests/hook-stdout-isolation.test.mjs` and `tests/hooks-router.test.mjs` that `SessionStart` emits one parseable JSON stdout line with `hookSpecificOutput.additionalContext` containing smart-vs-static metrics, active provider counts, and contextual `/bmad-<skill> "<prompt>"` recommendations with `providerId/modelId`.

</intent-contract>

## Implementation Notes

- `scripts/bmad-engine.mjs`: `buildSessionStartContext(scan)` formats the smart-vs-static summary, active provider/model summary, top 3 `/bmad-<skill> "<prompt>"` commands with `[Recommended Model: \`providerId/modelId\`]`, and companion guidance rules.
- `scripts/hook-runner.mjs`: `handleSessionStart` scans the workspace, persists `lastSessionStartAt`, and returns the `SessionStart` `hookSpecificOutput` frame emitted on a single JSON stdout line.
- `tests/hook-stdout-isolation.test.mjs` & `tests/hooks-router.test.mjs`: Automated tests confirming single-line JSON stdout isolation, smart-vs-static progress metrics, provider summary, and contextual commands.

## Verification

- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — passed.
