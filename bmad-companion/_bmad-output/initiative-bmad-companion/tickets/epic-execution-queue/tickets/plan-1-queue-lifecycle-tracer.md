---
title: 'Queue lifecycle tracer (add -> start-task -> complete-task -> get)'
type: feature
ticket: 1
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

**Problem:** To support multi-task execution queue operations (Epic 5), `manageBmadTaskQueue` and `buildTaskQueueView` must support the complete lifecycle path `add -> start-task -> complete-task -> get` across the `queued -> running -> done` state transitions with state persistence via `savePersistedState` into `.zcode/bmad-companion/state.json`. Prior to Story 5.1, dedicated test verification for the thinnest queue lifecycle and caller ergonomics did not exist under `tests/execution-queue.test.mjs`.

**Approach:**
1. Harden `manageBmadTaskQueue` in `scripts/bmad-engine.mjs` to support ergonomic option shapes on `add` (`options.items`, `options.item`, or direct top-level options `{ title, prompt, ... }`) and auto-target resolution on `start-task` (`options.taskId || currentView.nextQueuedTask?.id`).
2. Verify that `add -> start-task -> complete-task -> get` transitions through `queued -> running -> done` and persists each state transition to `.zcode/bmad-companion/state.json`.
3. Verify that `buildTaskQueueView` computes all summary counts (`total`, `running`, `queued`, `done`, `failed`, `progressPct`), `modelShort`, and `effectivePrompt` with review-mode shaping.
4. Establish `tests/execution-queue.test.mjs` verifying the queue lifecycle tracer, multi-task queuing with queued isolation during active tasks, storyOverrides synchronization, view computation, and ergonomic caller invocation.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added fallback in `manageBmadTaskQueue` `add` action to accept top-level options when `item` or `items` are omitted.
  - Added auto-selection fallback in `start-task` action to start `currentView.nextQueuedTask?.id` if `options.taskId` is not passed.
- **`tests/execution-queue.test.mjs`:**
  - Added 5 test cases for Epic 5 Story 5.1 covering single-task lifecycle tracer, multi-task queued state isolation, storyOverrides synchronization, `buildTaskQueueView` formatting and empty defaults, and top-level options ergonomics.
