---
title: 'Refactor sweep'
type: chore
ticket: 6
container: epic-execution-queue
created: '2026-11-24'
status: done
baseline_revision: '3c50d56f79836df6604b0515bc0a6998d16241f8'
route: oneshot
route_source: pinned
risk: low
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

**Problem:** After Stories 5.1-5.5 (tickets 1-5), the queue machinery in `scripts/bmad-engine.mjs` carried substantial copy-paste duplication:
1. The review-mode enum `["none", "quick", "thorough"]` was inlined 6 times (`buildEffectiveTaskPrompt`, twice in `buildTaskQueueView`, twice in `generateQueueWorkflowFiles`, `manageBmadTaskQueue`), the execution-mode enum `["dynamic-workflow", "separate-sessions"]` 4 times (including a re-inlined copy inside the `start-queue` branch that shadowed the function's own `VALID_EXECUTION_MODES`), and the task-status enum `["queued", "running", "done", "failed", "skipped"]` twice.
2. The default-model fallback chain (`current` model -> first model -> `new-provider/claude-sonnet-5-5-high`) was duplicated verbatim in `buildTaskQueueView` and `manageBmadTaskQueue`; the default persisted `taskQueue` shape was duplicated verbatim in `loadPersistedState` and `savePersistedState`; the recommendation-vs-completed-item matching logic was duplicated between `isRecommendationCompleted` and the `complete-task` advisor-override pruning; `String(x.prompt || x.fullCommand || "").trim()` prompt extraction appeared in three normalizers; the `` `qtask-${idx + 1}` `` fallback id appeared in both queue-item normalizers.
3. Prompt-shaping branches were open-coded ternary/if chains keyed on reviewMode in `buildEffectiveTaskPrompt` (execution-policy suffix and route hint) and in `generateQueueWorkflowFiles` (`reviewPolicyDesc`), and the two strip regexes (Execution Policy / route hint) were written out as literals in three functions.
4. `manageBmadTaskQueue` dispatched its 13 mutating branches through a 280-line `if/else if (action === ...)` chain with per-call enum array literals and two inline action lists (execution-mode override actions, workflow-regeneration actions).
5. The workflow artifact paths `.zcode/workflows/bmad-task-queue.dwf.ts` (3 literals) and `.zcode/bmad-companion/queue-step-updater.mjs` (1 literal) were scattered strings instead of named constants.

The `deferred:` lists of plans 1-5 were all empty, so scope was set from the ticket's three cleanup clauses: deduplicate queue-view/compiler helpers, normalize action dispatch and prompt-shaping branches, tighten workflow artifact paths. No new behavior.

**Approach:**
1. Add a single-source "Shared queue vocabulary" block at the head of the queue section in `scripts/bmad-engine.mjs`: module constants `VALID_QUEUE_ACTIONS`, `VALID_REVIEW_MODES`, `VALID_EXECUTION_MODES`, `VALID_TASK_STATUSES`, `VALID_STORY_STATUSES`, `DEFAULT_REVIEW_MODE`, `DEFAULT_EXECUTION_MODE`, `FALLBACK_QUEUE_MODEL_ID`, `QUEUE_WORKFLOW_REL_PATH`, `QUEUE_UPDATER_REL_PATH`, `EXECUTION_MODE_ACTIONS`, `WORKFLOW_REGENERATION_ACTIONS`, `EXECUTION_POLICY_RE`, `ROUTE_HINT_RE`, plus shared helpers `normalizeReviewMode`, `normalizeExecutionMode`, `resolveDefaultModelId`, `extractTaskPromptText`, `defaultQueueTaskId`, `createDefaultTaskQueueState`, `recommendationMatchesCompletedItem`. Every former inline copy now calls the shared constant/helper with byte-identical semantics (fallback chains and validation orders preserved exactly).
2. Normalize prompt shaping into reviewMode-keyed lookup maps — `EXECUTION_POLICY_SUFFIX_BY_REVIEW_MODE`, `ROUTE_HINT_BY_REVIEW_MODE`, `REVIEW_POLICY_DESC_BY_REVIEW_MODE` — replacing the if/ternary chains in `buildEffectiveTaskPrompt` and `generateQueueWorkflowFiles`; the maps are only indexed with already-normalized review modes, and every string is unchanged. `normalizeComparablePrompt` now reuses `EXECUTION_POLICY_RE`/`ROUTE_HINT_RE`.
3. Normalize action dispatch: convert the `if/else if` chain in `manageBmadTaskQueue` to a flat-case `switch (action)` with block-scoped `case` bodies (branch bodies byte-identical, `break` per case, `default` documenting that `get`/`generate-workflow` do not mutate items), replace the per-call enum literals with the module constants, and replace the two inline action lists with `EXECUTION_MODE_ACTIONS` / `WORKFLOW_REGENERATION_ACTIONS` (same members, same order).
4. Tighten artifact paths: `buildTaskQueueView` default `workflowPath`, `generateQueueWorkflowFiles` write targets, and the `manageBmadTaskQueue` persisted `workflowPath` all reference `QUEUE_WORKFLOW_REL_PATH` / `QUEUE_UPDATER_REL_PATH` (relative, `/`-normalized, resolved only through `resolveConfinedGeneratedPath`'s workspaceRoot confinement).

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added the shared queue constants/helpers block under the `Multi-Task Execution Queue` section header; `createDefaultTaskQueueState` and `recommendationMatchesCompletedItem` are function declarations (hoisted) used by earlier-defined `loadPersistedState`/`savePersistedState`/`isRecommendationCompleted`, which only run after module evaluation.
  - `buildEffectiveTaskPrompt`: prompt extraction, review-mode normalization, strip regexes, and both policy strings now come from the shared vocabulary; string-item input still returns `item.trim()` and object/null input is unchanged.
  - `buildTaskQueueView`: `resolveDefaultModelId`, `normalizeReviewMode`, `normalizeExecutionMode`, `VALID_TASK_STATUSES`, `extractTaskPromptText`, `defaultQueueTaskId`, `QUEUE_WORKFLOW_REL_PATH` replace the inline copies.
  - `generateQueueWorkflowFiles`: `QUEUE_UPDATER_REL_PATH`/`QUEUE_WORKFLOW_REL_PATH`, `normalizeExecutionMode` (equivalent to the former `=== "separate-sessions"` ternary), `normalizeReviewMode`, `extractTaskPromptText`, `defaultQueueTaskId`, and `REVIEW_POLICY_DESC_BY_REVIEW_MODE` replace the inline copies; added a source comment (not generated output) noting the generated updater's `normPrompt()` intentionally mirrors `normalizeComparablePrompt()` because the emitted artifact must stay dependency-free in the target workspace.
  - `manageBmadTaskQueue`: local `VALID_*` enum literals removed (module constants used), `resolveDefaultModelId(scan.availableModels)`, `EXECUTION_MODE_ACTIONS` precheck, `start-queue` uses `VALID_EXECUTION_MODES`, `complete-task` pruning uses `recommendationMatchesCompletedItem` (same prompt-then-title match order), persisted `workflowPath` uses `QUEUE_WORKFLOW_REL_PATH`, regeneration gate uses `WORKFLOW_REGENERATION_ACTIONS`; dispatch is now `switch (action)` with 13 block-scoped cases + default. Error messages (`Invalid queue action ...`, `Invalid storyStatus ...`, asserted in `tests/execution-queue.test.mjs`) are unchanged.
  - Deliberately not deduplicated: the `modelShort` derivations in `buildTaskQueueView` (model always non-empty after fallback) vs `generateQueueWorkflowFiles` (tolerates minimal direct inputs with a `"default"` fallback) — unifying them would change hardened Story 5.4 behavior for minimal inputs; and the generated `queue-step-updater.mjs` source string, which must remain self-contained.
  - No behavior change: view shapes, effective-prompt strings, generated `.dwf.ts`/updater contents, action semantics, storyOverrides sync, and the `{ action, taskQueue, generatedWorkflow, scan }` return shape are untouched. Each queue helper (`buildTaskQueueView`, `generateQueueWorkflowFiles`, `buildEffectiveTaskPrompt`, `manageBmadTaskQueue`, `buildTaskSessionLaunchInstructions`, `resolveConfinedGeneratedPath`, and the 7 new shared helpers) is defined exactly once (verified by `grep -c "function <name>("` = 1 for all 13).
- No test changes were needed — the sweep is behavior-preserving and the existing 156 tests (including the execution-queue, queue-handoff, MCP-surface, and engine-smoke suites) pin the preserved behavior.

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --test tests/` — passed (156/156 tests, 0 failures, 40 suites).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — passed (156/156 tests, 0 failures; `[check-version-sync] OK: all 3 versions match (0.5.3)`).
- `node ../scripts/validate.mjs` — passed (`bmad-companion v0.5.3`, `vibe-debrief v0.4.0`, `project-colors v0.1.0` validated).
- Duplication audit — review-mode enum literal: 1 (the constant); execution-mode enum literal: 1; task-status enum literal: 1; `new-provider/claude-sonnet-5-5-high`: 1; `qtask-${idx`: 1 (inside `defaultQueueTaskId`); each artifact path literal: 1 (its constant); `else if (action ===` in engine dispatch: 0 (the single remaining occurrence is inside the generated `queue-step-updater.mjs` source string, which is intentionally self-contained); `grep -c "function <name>("` returns 1 for every queue-view/compiler helper.

## Auto Run Result

- **Summary:** Completed the Story 5.6 refactor sweep: single-sourced the queue enums/defaults/artifact paths into a shared vocabulary block, deduplicated the queue-view/compiler helper logic (default-model resolution, default taskQueue shape, prompt extraction, fallback task id, recommendation-vs-completed-item matching), normalized prompt shaping into reviewMode-keyed maps and the 13-branch action dispatch into a block-scoped `switch` — zero behavior change, full suite green (156/156) plus version-sync and repo-root validate.
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-execution-queue/tickets/plan-6-refactor-sweep.md`
