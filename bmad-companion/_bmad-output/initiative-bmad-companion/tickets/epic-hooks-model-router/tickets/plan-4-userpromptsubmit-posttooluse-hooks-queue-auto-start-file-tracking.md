---
title: 'UserPromptSubmit + PostToolUse hooks (queue auto-start + file tracking)'
type: story
ticket: 4
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

**Problem:** Story 6.4 (`epic-hooks-model-router#4`) hardens `UserPromptSubmit` (`handleUserPrompt`) to store `lastUserPrompt`, reset `recentTouchedFiles`, and auto-transition a matching queued task to `running` (`start-task`), and hardens `PostToolUse` (`handlePostTool`) to record up to 15 workspace-relative paths on `Write`/`Edit`/`MultiEdit` (`R2`, `R3`, parent `R20`, `R21`).

**Approach:**
1. In `handleUserPrompt` (`scripts/hook-runner.mjs`), persist `lastUserPrompt` (up to 4000 chars), reset `recentTouchedFiles: []`, and match queued tasks via `taskItemMatchesPrompt` (45-char prompt/effectivePrompt prefix or `ticket|story <storyId>` reference, excluding queue orchestrator prompts) to auto-invoke `manageBmadTaskQueue(workspaceRoot, { action: "start-task", taskId, sessionId })`.
2. In `handlePostTool` (`scripts/hook-runner.mjs`), filter `Write`/`Edit`/`MultiEdit` tool invocations, normalize workspace-relative `/` paths, and cap `recentTouchedFiles` at 15 unique entries.
3. Verify via `tests/hook-stdout-isolation.test.mjs`, `tests/queue-handoff.test.mjs`, and `tests/hooks-router.test.mjs`.

</intent-contract>

## Implementation Notes

- `scripts/hook-runner.mjs`: `handleUserPrompt`, `handlePostTool`, `taskItemMatchesPrompt`, `AUTO_START_PROMPT_PREFIX_LEN = 45`, and 15-file cap on `recentTouchedFiles`.
- `tests/hook-stdout-isolation.test.mjs`, `tests/queue-handoff.test.mjs`, `tests/hooks-router.test.mjs`: Automated verification of prompt persistence, touched-file reset and 15-item cap, and queue auto-start transitions.

## Verification

- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — passed.
