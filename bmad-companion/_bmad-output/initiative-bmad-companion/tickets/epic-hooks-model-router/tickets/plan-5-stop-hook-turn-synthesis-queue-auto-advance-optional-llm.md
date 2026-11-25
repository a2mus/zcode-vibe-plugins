---
title: 'Stop hook turn synthesis + queue auto-advance + optional LLM'
type: story
ticket: 5
container: epic-hooks-model-router
created: '2026-11-25'
status: done
baseline_revision: 'cfdf8de29a21f9df7bb6879c2463d5898b065f30'
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

**Problem:** Story 6.5 (`epic-hooks-model-router#5`) remained in `review` without a dedicated plan artifact or dedicated verification suite for the `Stop` hook turn synthesis, single-session queue auto-completion edge cases (upgraded `/bmad-build` → `/bmad-build-auto` `effectivePrompt` prefix matching, multi-dot `storyId` reference matching, `transcript_path` assistant fallback), and the `AbortSignal.timeout(4500)` slow-LLM abort within the `C11`/`C12` budgets (`<= 350ms` deterministic / `<= 4800ms` with optional LLM). Additionally, `handleStop` ran `scanBmadWorkspace(workspaceRoot)` unconditionally on every `Stop` invocation even when no `BMAD_COMPANION_OPENAI_KEY`/`OPENAI_API_KEY` was configured or after `manageBmadTaskQueue(..., { action: "complete-task" })` had already computed a fresh post-completion scan.

**Approach:**
1. Harden `handleStop`, `tryOptionalAiTurnSynthesis`, `taskItemMatchesPrompt`, and `buildStoryRefRegex` in `scripts/hook-runner.mjs`:
   - Skip `scanBmadWorkspace` on deterministic `Stop` runs when no non-empty `BMAD_COMPANION_OPENAI_KEY`/`OPENAI_API_KEY` (or no prompt/assistant text) is present, and reuse `completed.scan` from `complete-task` when synthesis is enabled.
   - Start `AbortSignal.timeout(AI_SYNTHESIS_TIMEOUT_MS)` (`4500ms`) at the start of the synthesis `try` block and cancel unread non-OK response bodies so slow LLM requests abort cleanly within the `<= 4800ms` `Stop` LLM budget (`C11`, `C12`).
   - Support `transcript_path` JSONL fallback for assistant messages when `last_assistant_message`/`responseText` are omitted, match both `item.prompt` and `item.effectivePrompt` prefixes plus global-dot-escaped `ticket|story <storyId>` references in `taskItemMatchesPrompt`, and fall back to a running item when `activeTaskId` is omitted.
2. Add `tests/hooks-router.test.mjs` covering deterministic `Stop` state updates and `<= 350ms` budget, single-session queue auto-advance and session/orchestrator guards, optional OpenAI-compatible synthesis (`BMAD_COMPANION_OPENAI_KEY` priority + `agentAdvisorOverride` persistence), silent fallbacks on HTTP 500 / malformed JSON / empty recommendations, `4500ms` slow-LLM abort within `<= 4800ms`, and the Epic 1 → Epic 6 deferred hook adapter paths.

</intent-contract>

## Implementation Notes

- `scripts/hook-runner.mjs`: Lazy scan evaluation in `tryOptionalAiTurnSynthesis` reusing `completed?.scan`, trimmed API-key guard, `AbortSignal.timeout(4500)` bounding the synthesis block, `transcript_path` assistant message fallback in `handleStop`, `item.effectivePrompt` prefix support in `taskItemMatchesPrompt`, and `/\./g` escaping in `buildStoryRefRegex`.
- `tests/hooks-router.test.mjs`: 6 tests verifying `Stop` `turnCount` increment, `lastAssistantMessage` storage (`last_assistant_message` / `responseText` / `transcript_path`, `<= 6000` chars), `<= 350ms` deterministic budget without API keys, single-session `complete-task` auto-advance + `storyOverrides` sync + continuation block, optional LLM synthesis with `agentAdvisorOverride` persistence, silent error fallbacks, `4500ms` slow-LLM timeout abort within `<= 4800ms`, and deferred `session-start`/`user-prompt`/`post-tool` adapter paths.

## Verification

- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs && node --check tests/hooks-router.test.mjs` — passed (exit 0).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — passed (181/181 tests, 44 suites, 0 failures; includes 6/6 in `tests/hooks-router.test.mjs`; version sync 0.5.4 OK).
- `node ../scripts/validate.mjs` — passed.
