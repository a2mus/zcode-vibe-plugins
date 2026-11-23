---
title: 'Panel ARIA landmarks, live regions, focus rings & tab keyboard navigation tracer'
type: feature
ticket: 1
created: '2026-11-23'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R1]
context:
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-panel-a11y/epic-panel-a11y.md'
---

# Build Ticket 4.1 — Panel ARIA Landmarks, Live Regions, Focus Rings & Tab Keyboard Navigation Tracer

## Intent

Builds on Epic 1's test harness (`1.1`, `1.4`) and Epic 3's themed panel markup (`3.1`, `3.2`) to add semantic ARIA landmarks and states (`role="banner"`, `role="tablist"` + `aria-label`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`, `aria-labelledby`, `aria-pressed` on toggle controls, polite live regions `role="status"` + `aria-live="polite"` on toast notifications and node inspector updates), visible `>= 3:1` `:focus-visible` outlines across Dark HUD and Field Desk Light, `ArrowLeft`/`ArrowRight` tab and scene-pill navigation, and `Escape` dismissing the inline lesson form with zero external dependencies and `node:test` verification.

## Implementation Notes

- `assets/panel.html`
  - High-contrast visible focus rings: added `:focus-visible`, `button:focus-visible`, `input:focus-visible`, `textarea:focus-visible`, `select:focus-visible`, `[tabindex="0"]:focus-visible`, `[role="tab"]:focus-visible` with `outline: 2px solid var(--accent); outline-offset: 2px;` (contrast `>= 3:1` in both Dark HUD and Field Desk Light).
  - ARIA landmarks and container roles:
    - `<header class="top-bar" role="banner">`
    - `<nav class="tabs-nav" id="tabsNav" role="tablist" aria-label="Debrief sections">`
    - Mode switcher row `<div class="mode-switcher-row" role="group" aria-label="Debrief view mode">`
    - Persona strip `<div class="persona-strip" id="personaStrip" role="group" aria-label="Debrief personas">`
  - Tab semantics & roving tabindex:
    - `#tabBtnStoryboard`, `#tabBtnExplainer`, `#tabBtnMemory`, `#tabBtnHistory` declare `role="tab"`, `aria-selected`, `aria-controls`, and roving `tabindex="0"` on active tab and `"-1"` on inactive tabs.
    - Each section (`#tab-storyboard`, `#tab-explainer`, `#tab-memory`, `#tab-history`) declares `role="tabpanel"`, `tabindex="0"`, and `aria-labelledby`.
    - `switchTab(tabId)` dynamically synchronizes `active` class, `aria-selected="true"|"false"`, `tabindex="0"|"-1"`, and section visibility.
  - Polite live regions:
    - `#toastBanner`: `role="status" aria-live="polite" aria-atomic="true"`
    - `#nodeInspectorBar`: `role="status" aria-live="polite" aria-atomic="true"`
  - Toggle controls (`aria-pressed` & `aria-expanded`):
    - `#btnModeBug` and `#btnModeImpl`: `role="button"` and `aria-pressed` synchronized during `renderActiveDebrief`.
    - `#btnToggleSte100`: `role="button"` and `aria-pressed` synchronized during `renderPanelState`.
    - Persona chips: `role="button"` and `aria-pressed` synchronized for active persona.
    - Explainer controls: `#btnExplainerPlay` and `#btnExplainerVoice` toggle `aria-pressed="true"|"false"`.
    - Explainer scene pills: `role="button" aria-pressed` and roving `tabindex`.
    - `#btnToggleCustomLesson`: `aria-expanded` and `aria-controls="customLessonForm"`.
    - `#customLessonForm`: `role="region" aria-label="Add Lesson to ZCode Memory"`.
  - Keyboard navigation:
    - ArrowLeft/ArrowRight/Home/End navigation on `#tabsNav` steps through visible tabs with wrap-around, activates the selected tab via `switchTab`, and moves focus.
    - ArrowLeft/ArrowRight/Home/End navigation on `#explainerScenePills` steps through scene pills with wrap-around, updates `playerState.sceneIndex`, re-renders scene, and moves focus.
    - Escape key listener on `#customLessonForm` and `window` dismisses the custom lesson form, updates `aria-expanded="false"`, and restores focus to `#btnToggleCustomLesson`.
- `tests/panel-a11y.test.mjs`
  - Created 15 deterministic unit and integration tests verifying landmarks, tablist/tab/tabpanel semantics, live regions, focus rings contrast floors, `switchTab` ARIA state updates, ArrowLeft/ArrowRight tabs navigation, ArrowLeft/ArrowRight scene pills navigation, mode/STE toggle `aria-pressed`, and Escape dismissal of the lesson form.

## Verification (executed 2026-11-23)

- `node --test tests/` (161 tests across 30 suites pass in ~3.2s)
- `node --test tests/panel-a11y.test.mjs` (15 tests pass)
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` (exits 0)
- Smoke MCP stdio JSON-RPC handshake (initialize, tools/list, resources/list exit 0)
- Smoke lifecycle hook runner in session-start mode (exits 0)
