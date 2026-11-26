---
title: 'Story 8.3 — Unified in-iframe overlay controller, polling guard & semantic draft store'
type: feature
ticket: 3
container: epic-panel-readability-redesign
created: '2026-11-26'
status: done
baseline_revision: '9a3e18b'
route: oneshot
route_source: pinned
risk: high
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 8.3 requires a single unified in-iframe modal overlay controller (`AD-17`) in `assets/panel.html` to serve both the Work Action Window (`RD-9`) and Focus View (`RD-7`) without colliding focus traps, duplicating background DOM IDs, losing edits or focus during 5-second background polls (`AD-10`), or dropping user-selected models when a recommendation omits an explicit `recommendedModel`.

**Approach:**
1. **Single AD-17 Modal Overlay Layer & Controller (`assets/panel.html`):**
   - Added `<div class="overlay-backdrop" id="overlayLayer" role="dialog" aria-modal="true" aria-labelledby="overlayTitle" aria-hidden="true" style="display: none;">` with `#overlayCard`, `#overlayTitle`, `#overlayCloseBtn`, and `#overlayBody`, styled with Palette C tokens and closed-ramp overlay type variables (`--overlay-title-size`, `--overlay-body-size`, `--overlay-command-size`, `--overlay-meta-size`).
   - Implemented `activeOverlay` (`null | { kind: "action" | "focus", targetType, targetKey, triggerEl, triggerSelector }`), `isOverlayOpen()`, `openOverlay(spec)`, `closeOverlay(options)`, `reconcileActiveOverlay(freshState)`, `resolveOverlayTarget(state, overlay)`, and `renderOverlayContent(state, overlay)` using `overlay-*` non-duplicating DOM IDs (`#overlay-rec-cmd`, `#overlay-rec-model`, `#overlay-q-model`, `#overlay-q-review`, etc.).
   - Implemented `Tab` / `Shift+Tab` focus trapping across `getOverlayFocusableElements()`, main scroll locking (`.scroll-locked`), interactive-descendant click guarding (`isInteractiveDescendantClick`), `switchTab()` overlay closure, and focus restoration (`triggerEl` if `isConnected !== false` -> `document.querySelector(triggerSelector)` -> `focusActiveTabHeading()`).
2. **Polling Guard & Single Capture-Phase `Escape` Precedence (`AD-10`):**
   - Added `isOverlayOpen()` as the 3rd clause in `isUserInteractingWithForm()` so 5s background polls and inbound `ui/notifications/tool-result` notifications stash into `pendingWorkspaceState` while an overlay is open and flush immediately (`0ms`) on `closeOverlay()`.
   - Unified capture-phase `Escape` precedence in the single capture-phase `keydown` listener: (1) if `Date.now() < selectOpenUntil`, clears `selectOpenUntil = 0`, stops propagation, and keeps the overlay open; (2) else if `isOverlayOpen()`, closes the overlay immediately (even when focused inside an overlay `TEXTAREA`/`INPUT`), restoring focus and flushing stashed state; (3) else runs non-overlay `Escape` behavior.
   - Updated `renderWorkspaceState(state)` to clear stale `pendingWorkspaceState = null` on explicit renders and invoke `reconcileActiveOverlay(state)` when an overlay is open (updating controls in place while preserving intra-overlay focus by `overlay-*` ID, or closing with toast `"That item is no longer available"` and focusing the active tab heading when the target item disappears).
3. **Semantic Draft Store & Unified Model Base (`AD-10`):**
   - Updated `getRecOverrideKey(r)` to emit canonical semantic `rec:<skill>:<title>` keys without falling back to DOM index.
   - Replaced index-based selection with `selectedRecKeys` (`Set<recKey>`), added `expandedDisclosures` (`Set`), and added unified `getRecommendationBaseModelId(rec)` shared across card render, Action Window, and batch enqueue (`btnQueueSelectedRecs`) so `resolveUserModel` never drops drafts on a base mismatch.
   - Included draft Map overrides in the `recommendations` section signature (`recSig`) and synced drafts back to underlying cards on overlay close.
4. **Verification (`tests/panel-guards.test.mjs`):**
   - Extended `window.__bmadTestHooks` and added 7 deterministic tests in `tests/panel-guards.test.mjs` covering overlay dialog semantics, 3rd-clause polling guard stash/flush, capture-phase `Escape` precedence, focus trap + `triggerEl` -> `triggerSelector` -> tab-heading focus restoration, explicit-action `pendingWorkspaceState` clear + `reconcileActiveOverlay` (in-place and missing-item toast), semantic draft persistence across overlay close/reopen + `selectedRecKeys` + `getRecommendationBaseModelId`, and interactive-descendant click guarding.

</intent-contract>

## Verification

- `node --test tests/panel-guards.test.mjs` — 26/26 tests passing.
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — 213/213 tests passing across 51 suites; version sync OK (`0.5.4`).
