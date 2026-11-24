---
title: 'Review-mode prompt shaping (none/quick/thorough)'
type: feature
ticket: 3
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

**Problem:** Story 5.1 established the initial queue lifecycle tracer and a basic placeholder for `buildEffectiveTaskPrompt`. However, prompt shaping across the three review modes (`none`, `quick`, and `thorough`) was not fully hardened against contract requirements (SM-5 / R2): (1) `quick` mode route hints were not formatted per the contract (`single self-review pass`), (2) `thorough` mode route hints did not include the full code review gate (`multi-lens BMAD code review gate`), (3) switching a task from `thorough` or `quick` to `none` leaked prior route hints and execution policies because the previous stripping regex missed multi-word route descriptions and brackets, and (4) non-build skills and unquoted or repeatedly shaped prompts lacked clean policy application and idempotency guarantees.

**Approach:**
1. Harden `buildEffectiveTaskPrompt` in `scripts/bmad-engine.mjs`:
   - Support `none` (oneshot + deterministic verification only), `quick` (oneshot + single self-review pass), and `thorough` (multi-lens BMAD code review gate).
   - Strip all prior route hints (`ROUTE_HINT_REGEX`) and execution policy brackets (`EXECUTION_POLICY_REGEX`) from both quoted and unquoted prompts before appending the requested mode's hint.
   - For `/bmad-build` commands, normalize `/bmad-build` to `/bmad-build-auto` and append the appropriate route hint inside the closing quote or at the prompt end.
   - For non-build skills, strip any prior execution policies and attach clean bracketed `[Execution Policy: ...]` directives matching the review mode.
   - Ensure 100% adherence without leaking any review instructions into `none` tasks.
   - Synchronize `normalizeComparablePrompt` in `scripts/bmad-engine.mjs` and `normPrompt` in `queue-step-updater.mjs` to strip route hints and execution policies consistently.
2. Add comprehensive unit tests in `tests/execution-queue.test.mjs` under `Epic 5 Story 5.3: Review-mode prompt shaping (none/quick/thorough)`:
   - Verify prompt compilation for each of the three review modes (`none`, `quick`, `thorough`).
   - Verify zero leakage of review instructions (`thorough`, `multi-lens`, `self-review`, etc.) when transitioning from `thorough` or `quick` to `none`.
   - Verify idempotent re-shaping and stripping of stacked/corrupted route hints.
   - Verify non-build skill prompt shaping and leakage prevention.
   - Verify edge cases: unquoted prompts, story titles containing the word 'review' and parentheses, empty/missing prompt handling, and string callers.
   - Verify queue integration across `add-epic`, `set-review-mode` with `applyToAll: true`, and `update-item`.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Hardened `buildEffectiveTaskPrompt` with comprehensive route hint and execution policy stripping regexes (`ROUTE_HINT_REGEX` and `EXECUTION_POLICY_REGEX`).
  - Standardized route hints:
    - `none`: `" (route: oneshot, review: none — skip review lenses, run deterministic verification commands only)"`
    - `quick`: `" (route: oneshot, review: quick — single self-review pass)"`
    - `thorough`: `" (route: full, review: thorough — multi-lens BMAD code review gate)"`
  - Added non-build skill execution policy shaping with zero review leakage into `none` tasks.
  - Aligned `normalizeComparablePrompt` and `normPrompt` in `queue-step-updater.mjs` template.
- **`tests/execution-queue.test.mjs`:**
  - Updated line 299 assertion to match hardened `quick` prompt formatting (`single self-review pass`).
  - Added 5 comprehensive test cases under `Epic 5 Story 5.3: Review-mode prompt shaping (none/quick/thorough)` covering all requirements, edge cases, and queue integration.
