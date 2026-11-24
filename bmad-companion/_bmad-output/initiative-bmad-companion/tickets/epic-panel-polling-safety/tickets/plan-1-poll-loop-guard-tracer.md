---
title: 'Poll-loop guard tracer (visible-gated 5s poll + isRefreshing + stash/flush)'
type: feature
ticket: 1
container: epic-panel-polling-safety
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

**Problem:** To support safe, non-destructive background polling in `assets/panel.html` without clobbering in-progress form interactions, keystrokes, or focus, the panel requires a visibility-gated 5000ms polling loop guarded by `isUserInteractingWithForm()`, serialized by an `isRefreshing` concurrency lock, stashing incoming payloads in `pendingWorkspaceState` mid-flight, and flushing via `flushPendingState()` on `focusout`/`change`/`Escape`/`Tab` within <=100ms with zero lost edits.

**Approach:**
1. Hardened `isPanelVisible()` in `assets/panel.html` to verify both `!document.hidden` and `document.visibilityState === "visible"`, ensuring polling skips when the panel or document is hidden.
2. Hardened form interaction detection in `isUserInteractingWithForm()` with case-insensitive tag matching for `TEXTAREA` and `INPUT`, and preserved the 15000ms `selectOpenUntil` window.
3. Extended event listeners to handle `keydown` (blurring/flushing on `Escape`, extending on `Space`/`Enter`/arrow navigation for `SELECT`), `change`, and `focusout` (debounced at 50ms <= 100ms).
4. Provided `window.__bmadTestHooks` for zero-eval test harness introspection in `assets/panel.html`.
5. Exported `extractInlineScript` in `tests/helpers.mjs`.
6. Created `tests/panel-guards.test.mjs` verifying the stubbed DOM environment: hidden document polling skip, overlapping poll serialization under `isRefreshing`, mid-flight background poll stashing and flush on `focusout`, inbound tool-result stashing, select 15000ms window guards and flushes, and user edit preservation with zero lost edits (`SM-2`).

</intent-contract>

## Implementation Notes

- **`assets/panel.html`:**
  - Added `isPanelVisible()` gating `setInterval` 5000ms loop against `document.hidden` and `document.visibilityState !== "visible"`.
  - Hardened `isUserInteractingWithForm()` to uppercase `active.tagName` for safe matching.
  - Hardened `pointerdown` listener to recognize select targets and sub-elements.
  - Added `Escape` key handling on active textareas/inputs to blur and flush pending state.
  - Hardened `change` listener to handle both `SELECT` and `INPUT` triggers.
  - Preserved `flushPendingState` 50ms delay on `focusout` (well within <=100ms budget).
  - Exposed test inspection hooks on `window.__bmadTestHooks`.
- **`tests/helpers.mjs`:**
  - Added `extractInlineScript(html)` export.
- **`tests/panel-guards.test.mjs`:**
  - Implemented 12 comprehensive test cases exercising visibility gating, concurrent poll serialization via `isRefreshing`, mid-flight stashing and `focusout` flush, select 15s window, keyboard dismissals, error handling, and edit preservation.

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --test tests/panel-guards.test.mjs` — passed (12/12 tests, 0 failures, 1 suite).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — passed (104/104 tests, 0 failures, 22 suites; all versions match 0.5.3).
- `node ../scripts/validate.mjs` — passed (all marketplace plugins validated).
