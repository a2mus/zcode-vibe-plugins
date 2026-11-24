---
title: 'Accessibility floor: close AD-1-AD-5'
type: feature
ticket: 3
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

**Problem:** `EXPERIENCE.md` tracked accessibility deviations `AD-1` through `AD-5` in `assets/panel.html`:
- **AD-1:** Invisible textarea focus (`.cmd-textarea` sets `outline:none` with no replacement focus style, so the primary editing surface shows no focus indicator).
- **AD-2:** No tab semantics (the tab strip used plain `<button>` elements without ARIA tablist/tab/tabpanel, missing `aria-selected`, roving `tabindex`, and keyboard arrow navigation).
- **AD-3:** Toasts not announced (missing `role="status"` and `aria-live`, so screen readers miss action and error announcements).
- **AD-4:** Unassociated labels (queue review-gate and epic-picker labels lacked `for`/`id` association, and command-editor labels were decorative divs).
- **AD-5:** Motion not gated (`.pulse-dot` animated infinitely without respecting `prefers-reduced-motion`).

**Approach:**
1. **AD-1 (Visible Focus Ring):** Added `.cmd-textarea:focus, .cmd-textarea:focus-visible` with `outline: 2px solid var(--accent)` and container highlight `.cmd-editor-wrap:focus-within { border-color: var(--accent); }`. Added global `:focus-visible` outline. Verified >= 3:1 focus indicator contrast in both dark theme (ratio 5.5:1 against `#0d1117`, 5.0:1 against `#161b22`, 4.3:1 against `#1f2630`) and light theme (ratio 5.25:1 against `#ffffff`, 4.9:1 against `#f6f8fa`).
2. **AD-2 (ARIA Tab Semantics & Arrow Navigation):**
   - Declared `role="banner"` on `<header class="top-bar">` and `role="main"` on `<main class="main-scroll">`.
   - Updated navigation to `<nav class="tabs-nav" id="tabsNav" role="tablist" aria-label="BMAD Navigation Tabs">`.
   - Updated all five tab buttons (`#tabBtnAdvisor`, `#tabBtnQueue`, `#tabBtnProgress`, `#tabBtnCatalog`, `#tabBtnArtifacts`) to declare `role="tab"`, `aria-selected`, `aria-controls`, and roving `tabindex`.
   - Updated all five sections (`#tab-advisor`, `#tab-queue`, `#tab-progress`, `#tab-catalog`, `#tab-artifacts`) to declare `role="tabpanel"`, `tabindex="0"`, and `aria-labelledby`.
   - Updated `switchTab(tabId, focusBtn)` to synchronize `aria-selected`, roving `tabindex` (`0` on active, `-1` on inactive), and element focus.
   - Implemented `handleTabKeydown` supporting `ArrowRight`, `ArrowLeft`, `ArrowDown`, `ArrowUp`, `Home`, and `End` with wraparound navigation across tabs.
3. **AD-3 (Announced Toasts):**
   - Declared `role="status"`, `aria-live="polite"`, and `aria-atomic="true"` on `#toastBanner`.
   - Enhanced `showToast(msg)` to dynamically evaluate message severity: setting `aria-live="assertive"` and `role="alert"` for errors (matching `❌`, `failed`, or `error`), and `aria-live="polite"` and `role="status"` for non-error notifications.
4. **AD-4 (Associated Form & Editor Labels):**
   - Associated Queue tab review gate label (`<label for="queueDefaultReviewSelect">`) with `<select id="queueDefaultReviewSelect">`.
   - Associated Queue tab epic picker label (`<label for="queueEpicPicker">`) with `<select id="queueEpicPicker">`.
   - Replaced decorative divs in command editors with `<label class="cmd-label" for="rec-cmd-${idx}">` and `<label class="cmd-label" for="cat-cmd-${idx}">`.
   - Associated Queue item per-task model select (`<label for="q-model-${idx}">`) and review gate select (`<label for="q-review-${idx}">`).
   - Added accessible `aria-label` attributes across filter inputs and selects (`#storySearch`, `#storyStatusFilter`, `#skillSearch`, `#skillPhaseFilter`, `#artifactSearch`).
5. **AD-5 (Reduced Motion Gating):**
   - Added `@media (prefers-reduced-motion: reduce)` block in `assets/panel.html` disabling `.pulse-dot` animation (`animation: none`) and glow (`box-shadow: none`), plus disabling transitions on animated controls.

</intent-contract>

## Implementation Notes

- **`assets/panel.html`:**
  - CSS: Added `:focus-visible`, `.cmd-textarea:focus, .cmd-textarea:focus-visible`, `.cmd-editor-wrap:focus-within`, and `@media (prefers-reduced-motion: reduce)`.
  - Markup: Added landmark roles `role="banner"` and `role="main"`. Added ARIA tablist/tab/tabpanel markup with roving `tabindex` and `aria-controls`/`aria-labelledby`.
  - Live Region: Added `role="status" aria-live="polite" aria-atomic="true"` on `#toastBanner`.
  - Labels: Added `for`/`id` associations on Queue controls, recommendation editor labels, catalog editor labels, and queue task controls.
  - Script: Enhanced `showToast` for polite vs assertive error announcements; enhanced `switchTab` for roving `tabindex` and focus management; added `handleTabKeydown` arrow-key roving tab navigation; exposed `switchTab`, `showToast`, and `handleTabKeydown` on `window.__bmadTestHooks`.
- **`tests/panel-a11y.test.mjs`:**
  - Comprehensive suite with 18 tests verifying AD-1 through AD-5.
- **`tests/helpers.mjs`:**
  - Added reusable `extractStyleContent`, `relativeLuminance`, and `contrastRatio` helpers.

## Verification

- `node --test tests/panel-a11y.test.mjs`: 18 tests passing (0 failures).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs`: all 129 tests passing and version sync verified (0.5.3).
- `node ../scripts/validate.mjs`: all plugin validations passed cleanly.
