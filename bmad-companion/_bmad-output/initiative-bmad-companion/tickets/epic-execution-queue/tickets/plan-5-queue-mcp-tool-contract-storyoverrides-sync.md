---
title: 'Queue MCP tool contract + storyOverrides sync'
type: feature
ticket: 5
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

**Problem:** While Story 5.1-5.4 hardened the in-process queue lifecycle, 14-action contract, prompt shaping, and dual workflow compiler, `bmad_queue_manage` lacked MCP stdio contract test coverage and input validation: (1) unknown `action` values and invalid `complete-task` `storyStatus` values were silently accepted instead of returning `isError: true`, (2) `start-task` omitted `updatedAt` on `storyOverrides` entries, (3) `complete-task` left `storyOverrides` unchanged when `failed: true` and could set queue `status: "completed"` when called with a nonexistent `taskId`, (4) `buildTaskQueueView` matched `storyId` without scoping by `epicSlug`, and (5) `bmad_queue_manage` `inputSchema` omitted optional `title` (used by `update-item`). Note: Per the `2026-11-23` `OQ-B` settlement in `epic-execution-queue.md` and `prd-bmad-companion.md`, `bmad_queue_manage` aligns to the shipped `{ ...ScanResult, queueActionResult: { action, taskQueue, generatedWorkflow } }` `structuredContent` contract consumed by `assets/panel.html`.

**Approach:**
1. Harden `manageBmadTaskQueue` and `buildTaskQueueView` in `scripts/bmad-engine.mjs`:
   - Validate `action` against all 15 supported queue actions (defaulting empty/omitted `action` to `"get"`), throwing an informative error on invalid actions.
   - Validate `storyStatus` on `complete-task` against `["done", "review", "in-progress", "backlog"]`.
   - Enforce safe `overrideKey` validation (`isSafeStoryOverrideKey`), stamp `updatedAt` on both `start-task` and `complete-task`, sync `storyOverrides` on failed `complete-task` (`in-progress` or explicit `storyStatus` with failure reason), and scope `buildTaskQueueView` story matching by `epicSlug::storyId` before falling back to `storyId`.
   - Guard `complete-task` queue status updates and advisor recommendation pruning behind `if (completedItem)` so nonexistent `taskId` calls do not corrupt queue state.
2. Harden `bmad_queue_manage` in `scripts/mcp-server.mjs`:
   - Add additive optional `title` property to `inputSchema.properties`.
   - Include failed task count in the Markdown status line when `q.counts.failed > 0`.
   - Preserve the settled `{ ...ScanResult, queueActionResult: { action, taskQueue, generatedWorkflow } }` `structuredContent` shape.
3. Add Story 5.5 MCP stdio & `storyOverrides` sync tests in `tests/execution-queue.test.mjs` covering full lifecycle over MCP stdio (`add-epic -> start-queue -> start-task -> complete-task -> get`), `separate-sessions` launch plan output, non-done `storyStatus` (`review`), `failed: true` `storyOverrides` sync, and `isError` rejection of invalid `action` and `storyStatus`.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `isSafeStoryOverrideKey`, `VALID_QUEUE_ACTIONS`, `VALID_STORY_STATUSES`, and `epicSlug::storyId` matching in `buildTaskQueueView`.
  - Updated `start-task` and `complete-task` to consistently sync `storyOverrides` (including `updatedAt` and failed task status/reason) and guarded post-completion queue state updates on `completedItem`.
- **`scripts/mcp-server.mjs`:**
  - Added optional `title` to `bmad_queue_manage` `inputSchema.properties` and displayed failed count in Markdown status summary when `q.counts.failed > 0`.
- **`tests/execution-queue.test.mjs`:**
  - Added 3 tests under `Epic 5 Story 5.5: Queue MCP tool contract + storyOverrides sync` verifying the `{ ...ScanResult, queueActionResult }` MCP stdio contract, `taskQueue`↔`storyOverrides` sync, and `isError` validation guards.

## Verification

- `node --test tests/ && node scripts/check-version-sync.mjs`: 156/156 tests passed across 40 suites (`[check-version-sync] OK: all 3 versions match (0.5.3)`).
