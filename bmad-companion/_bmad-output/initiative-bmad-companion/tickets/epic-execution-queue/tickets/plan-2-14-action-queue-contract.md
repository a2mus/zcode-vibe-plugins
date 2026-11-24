---
title: '14-action queue contract + per-task model/reviewMode/executionMode'
type: feature
ticket: 2
container: epic-execution-queue
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

**Problem:** Story 5.1 proved the basic `add -> start-task -> complete-task -> get` lifecycle, leaving the full 14-action `manageBmadTaskQueue` contract (`get`, `add`, `add-epic`, `update-item`, `set-review-mode`, `set-execution-mode`, `reorder`, `remove`, `clear`, `start-queue`, `start-task`, `complete-task`, `pause-queue`, `generate-workflow`) without full contract hardening and tests. Specifically: (1) passing per-task `reviewMode` to `update-item` or `add` inadvertently mutated queue-level `defaultReviewMode`, (2) invalid `executionMode` values could clobber the active `executionMode`, (3) `add-epic` with `includeDone: true` and `update-item` resetting a completed story to `queued` had their `status: "queued"` overridden back to `"done"` by `buildTaskQueueView`, and (4) `update-item` did not validate `reviewMode`/`status` or clear `activeTaskId` when moving the active task off `running`.

**Approach:**
1. Harden `manageBmadTaskQueue` and `buildTaskQueueView` in `scripts/bmad-engine.mjs`:
   - Scope `executionMode` updates from `options.executionMode` to valid values (`dynamic-workflow` | `separate-sessions`) on `add`, `add-epic`, `set-execution-mode`, `start-queue`, and `generate-workflow`.
   - Keep `defaultReviewMode` isolated from per-task `reviewMode` in `add`, `add-epic`, and `update-item`; only `set-review-mode` updates `defaultReviewMode`.
   - Preserve explicit re-queuing (`forceQueued: true` while `status === "queued"`) in `buildTaskQueueView` when `add-epic` passes `includeDone: true`, `add` re-queues a `done` task, or `update-item` sets `status: "queued"`.
   - Validate `reviewMode` and `status` in `update-item` and clear `activeTaskId` if the active task transitions off `"running"`.
2. Add comprehensive tests in `tests/execution-queue.test.mjs` covering all 14 actions, per-task `model`/`reviewMode`/`executionMode`, `set-review-mode` (`applyToAll: true` and `false`), `add-epic` (`includeDone: false` and `true`), `reorder` (`up`/`down` and boundaries), `remove`, `clear` (`onlyCompleted: true` and `false`), `start-queue`, `pause-queue`, and `generate-workflow`.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Updated `buildTaskQueueView` (`!it.forceQueued` guard on auto-completing queued stories with `smartStatus === "done"`).
  - Hardened `manageBmadTaskQueue` option handling for `executionMode`, `defaultReviewMode`, `add`, `add-epic` (`includeDone` + `options.reviewMode`), `update-item`, `set-review-mode`, and `set-execution-mode`.
- **`tests/execution-queue.test.mjs`:**
  - Added 4 tests under `Epic 5 Story 5.2: 14-action queue contract + per-task model/reviewMode/executionMode` exercising all 14 actions and contract edges.
