---
title: 'User edit preservation + section signature diffing regression'
type: feature
ticket: 2
container: epic-panel-polling-safety
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

**Problem:** To support non-destructive background polling and rendering in `assets/panel.html`, in-progress user prompt edits and model selections must be preserved across unchanged-base polls and only reset when the server base changes or the chosen model leaves `availableModels`. Furthermore, section rendering must use `lastSectionSignatures` per-section early-returns so that DOM `innerHTML` is replaced only when underlying data differs, while explicit user actions continue to render immediately even when a form element is focused.

**Approach:**
1. Hardened `resolveUserModel(key, serverModelId)` in `assets/panel.html` to keep `userSelectedModels` while `base === serverModelId` and the chosen model is still available, and drop the entry via `userSelectedModels.delete(key)` when base changes or when `entry.value` leaves `currentState.availableModels`.
2. Verified `resolveUserPrompt(key, serverCmd)` retains `userEditedPrompts` when `base === serverCmd` and drops via `userEditedPrompts.delete(key)` when base changes.
3. Hardened section render functions (`renderLiveQueueBannerAndTab`, `renderRecommendations`, `renderInsights`, `renderPhases`, `renderEpics`, `renderSkillsCatalog`, `renderArtifactsDirectory`) to support `force = false` with strict boolean checking and early-return against `lastSectionSignatures`, ensuring `innerHTML` assignments are completely skipped when section data is unchanged.
4. Ensured explicit actions (such as `refreshState({ isBackground: false })`, `btnSelectAllRecs`, queue management actions) bypass background stashing and force immediate rendering even when user interaction or input/textarea focus is active.
5. Extended `window.__bmadTestHooks` to expose `resolveUserPrompt`, `resolveUserModel`, `setCurrentState`, and section renderers for deterministic zero-eval test introspection.
6. Added comprehensive unit and regression tests in `tests/panel-guards.test.mjs` verifying edit preservation on unchanged base, reset on base change, reset on model departure from `availableModels`, skipping `innerHTML` when signatures match, and immediate rendering during explicit actions while focused.

</intent-contract>

## Implementation Notes

- **`assets/panel.html`:**
  - Hardened `resolveUserModel`: checks `entry.value && Array.isArray(models) && !models.some(m => m.id === entry.value)` and drops entry via `userSelectedModels.delete(key)` if the chosen model leaves `availableModels`.
  - Moved `queueSig` calculation and signature comparison to the top of `renderLiveQueueBannerAndTab` with early return, preventing redundant `bannerContent.innerHTML`, `epicPicker.innerHTML`, `spotlightEl.innerHTML`, and `listEl.innerHTML` writes on unchanged polls.
  - Added defensive `force = false` handling with `typeof force !== "boolean"` normalization across all section render functions.
  - Fixed `renderArtifactsDirectory` invocation in `renderWorkspaceState` to avoid passing truthy non-boolean arguments.
  - Exposed `resolveUserPrompt`, `resolveUserModel`, `setCurrentState`, and section render methods on `window.__bmadTestHooks`.
- **`tests/panel-guards.test.mjs`:**
  - Enhanced stubbed DOM elements to track `innerHtmlSetCount` and parse dynamic tags/IDs.
  - Added test suite `Epic 4 Story 4.2: User edit preservation + section signature diffing regression` with 7 test cases covering prompt/model edit preservation, base change resets, model removal resets, section signature innerHTML skipping, explicit sync rendering while focused, and explicit user action forced rendering while focused.

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --test tests/` — passed (111/111 tests, 0 failures, 23 suites).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — passed (111/111 tests, 0 failures, 23 suites; all versions match 0.5.3).
- `node ../scripts/validate.mjs` — passed (all marketplace plugins validated).
