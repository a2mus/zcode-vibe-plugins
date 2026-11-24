---
title: 'Concept pills & <100ms Stage 1 inline micro-drawer tracer'
type: feature
ticket: 1
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R1]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-concept-deep-dive/epic-concept-deep-dive.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 7.1 — Concept Pills & <100ms Stage 1 Inline Micro-Drawer Tracer

## Intent

Implements Story 7.1 (`epic-concept-deep-dive` Story 1, R1):
Renders clickable `concept-pill` buttons (`<= 6` per turn) in `#microBlockConcepts` and opens `#stage1Drawer` inline in `< 100ms` with zero outbound RPC calls, displaying `.target-tag`, `STE-80` definition (`X-Ray: Tech` `techSymbol` dual-coding), left-accented analogy box, `104px` micro-visual SVG (`loop-3node`, `pipeline-3node`, `split-compare`) across Dark HUD and Field Desk Light, and the `#btnOpenStage2` (`Deep Dive & Pop Out ↗`) CTA. Collapses cleanly on re-click, `#btnCloseStage1`, or `Escape` (with focus restoration) and preserves `uiState.activeConceptSlug` across same-turn re-renders.

## Implementation Details

- `assets/panel.html`:
  - Added token-only CSS for `.concept-pills`, `.concept-pill`, `.stage1-drawer`, `@keyframes stage1SlideIn`, `.stage1-head`, `.stage1-title`, `.target-tag`, `.stage1-close`, `.stage1-copy`, `.stage1-analogy`, `.stage1-canvas-wrap`, `.stage1-micro-svg`, `.stage1-cta`, and `.popout-btn`.
  - Updated `resolveMicroBlocks` and `renderMicroBlocks` to activate `#microBlockConcepts` when `concepts` is non-empty and hide it when minimal-mode collapsed.
  - Implemented `renderConceptsBlock`, `buildStage1MicroVisualSvg`, `renderStage1MicroVisual`, `formatStage1PluginLabel`, and `closeStage1Drawer` with `escapeHtml()` escaping, X-Ray dual-coding (`techSymbol`), and `Escape` / re-click collapse + focus restoration.
  - Updated `applyEffectiveTheme()` to re-render the open `stage1-drawer` `104px` micro-visual on `Dark HUD <-> Field Desk Light` theme toggles.
  - Updated the window `Escape` handler to check `form.style.display === "block"` before falling through to `closeStage1Drawer({ restoreFocus: true })`.
- `tests/panel-a11y.test.mjs` & `tests/theme-parity.test.mjs`:
  - Added Story 7.1 tests covering `<= 6` pill capping, `< 100ms` zero-RPC drawer open, all 3 micro-visual types (`loop-3node`, `pipeline-3node`, `split-compare`), re-click / `Escape` collapse with focus restoration, same-turn `activeConceptSlug` persistence, X-Ray `techSymbol` + XSS escaping, and Dark HUD / Field Desk Light theme parity.

## Verification

- `node --test "tests/*.test.mjs" && node --check scripts/*.mjs && node scripts/check-version-sync.mjs`:
  - 241 tests across 44 suites passed (0 failures).
  - Syntax check clean across `scripts/*.mjs`.
  - All 4 version locations synced at `0.3.0`.
