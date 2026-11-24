---
title: 'Dual execution engine generation (.dwf.ts + step-updater / CreateSession plan)'
type: feature
ticket: 4
container: epic-execution-queue
created: '2026-11-24'
status: done
baseline_revision: '3c50d56f79836df6604b0515bc0a6998d16241f8'
route: oneshot
route_source: pinned
risk: high
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

**Problem:** While initial scaffolding for `generateQueueWorkflowFiles` existed, Story 5.4 required hardening dual execution engine generation for both `dynamic-workflow` (`.zcode/workflows/bmad-task-queue.dwf.ts` + `.zcode/bmad-companion/queue-step-updater.mjs`) and `separate-sessions` (`CreateSession` handoff plan referencing `WaitSessions` non-blocking semantics), enforcing strict `workspaceRoot` confinement (including symlink escape rejection), handling `skipped` tasks and minimal/direct `generateQueueWorkflowFiles` inputs safely, regenerating workflows on `set-execution-mode`, and proving `.dwf.ts` TypeScript parseability and per-task `model`/`reviewMode` preservation in deterministic tests.

**Approach:**
1. Harden `generateQueueWorkflowFiles` and `buildTaskSessionLaunchInstructions` in `scripts/bmad-engine.mjs`:
   - Add `resolveConfinedGeneratedPath` enforcing `workspaceRoot` existence, relative path confinement, `realpathSync` directory verification, and symlink target rejection before writing `.zcode/bmad-companion/queue-step-updater.mjs` and `.zcode/workflows/bmad-task-queue.dwf.ts`.
   - Normalize direct/minimal `queueView.items` inputs (`model`, `modelShort`, `reviewMode`, `effectivePrompt`) and exclude both `done` and `skipped` tasks when runnable tasks exist.
   - Return `executionMode`, `updaterFullPath`, and `executionPrompt` alongside `workflowRelPath`, `workflowFullPath`, `updaterRelPath`, `tasksCount`, `workflowLaunchPrompt`, and `separateSessionsPrompt`.
   - Regenerate workflow artifacts when `set-execution-mode` runs on a non-empty queue in `manageBmadTaskQueue`.
2. Update `bmad_queue_manage` markdown summary in `scripts/mcp-server.mjs` to display the `separateSessionsPrompt` launch plan when `executionMode === "separate-sessions"`.
3. Add comprehensive Story 5.4 unit and integration tests in `tests/execution-queue.test.mjs` verifying `.dwf.ts` TypeScript parseability (`stripTypeScriptTypes` + `Function` parse), `queue-step-updater.mjs` syntax and state mutations, per-task `model` and `reviewMode` preservation, `separate-sessions` `CreateSession`/`WaitSessions` plan generation, and `workspaceRoot` / symlink confinement.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `resolveConfinedGeneratedPath` using `resolve`, `relative`, `realpathSync`, and `lstatSync` to enforce `workspaceRoot` confinement and reject symlink targets.
  - Hardened `generateQueueWorkflowFiles` item normalization, `skipped` task exclusion, and return metadata (`executionMode`, `updaterFullPath`, `executionPrompt`).
  - Hardened `buildTaskSessionLaunchInstructions` fallback shaping via `buildEffectiveTaskPrompt`.
  - Added `"set-execution-mode"` to the `manageBmadTaskQueue` workflow regeneration action list.
- **`scripts/mcp-server.mjs`:**
  - Updated `bmad_queue_manage` summary output to show the separate-sessions launch plan when `executionMode === "separate-sessions"`.
- **`tests/execution-queue.test.mjs`:**
  - Added 3 tests under `Epic 5 Story 5.4: Dual execution engine generation (.dwf.ts + step-updater / CreateSession plan)` covering dynamic-workflow `.dwf.ts` parseability and `queue-step-updater.mjs` execution, `separate-sessions` `CreateSession`/`WaitSessions` plan generation, and `workspaceRoot` confinement.
