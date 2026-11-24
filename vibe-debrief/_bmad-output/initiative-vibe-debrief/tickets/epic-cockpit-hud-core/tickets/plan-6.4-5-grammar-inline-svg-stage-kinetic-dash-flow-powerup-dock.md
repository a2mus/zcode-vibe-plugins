---
title: '5-grammar inline SVG stage, kinetic dash-flow & powerup-dock'
type: feature
ticket: 4
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R4]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/epic-cockpit-hud-core.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 6.4 — 5-Grammar Inline SVG Stage, Kinetic Dash-Flow & Powerup-Dock

## Intent

Completes Story 6.4 (`epic-cockpit-hud-core` Story 4, R4, AD-14):
Builds on Story 6.3's X-Ray dual-coded binding helpers and Story 5.2's `diagramSpec` normalizer to render all 5 grammars (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`; `viewBox="0 0 460 H"`, `<= 6` nodes, zero pan/zoom) with Dark HUD & Field Desk Light CSS variables, kinetic `.dash-flow` motion honoring `prefers-reduced-motion: reduce`, click/keyboard node inspector with X-Ray dual-coding, and the 5-button `powerup-dock`.

## Implementation Details

- `assets/panel.html`:
  - Added `.diagram-stage` / `.svg-stage` dot-matrix backdrop (`--grid-dot`), `.dash-flow` / `@keyframes flowDash` kinetic stroke animation (disabled inside `@media (prefers-reduced-motion: reduce)`), `.powerup-dock` / `.powerup-btn` styles (including `.complex-pulse` and Field Desk Light contrast rules), and `.node-inspector code` styles.
  - Updated `#microBlockDiagram` markup to add `#diagramGrammarPill`, `.svg-stage` + `data-grammar` on `#diagramSvg`, and `#powerupDock` (`#btnPowerupSvg`, `#btnPowerupExcalidraw`, `#btnPowerupVisualize`, `#btnPowerupVectorcraft`, `#btnPowerupAnimate`).
  - Added `GRAMMAR_LABELS`, `LEGACY_GRAMMAR_MAP`, `resolveClientDiagramGrammar`, `resolveNodeRiskColor`, `resolveEdgeColor`, `resolveArrowMarkerId`, `renderSvgNodeBox`, `build5GrammarSvgMarkup`, and `triggerStage2Powerup`.
  - Updated `renderInteractiveDiagram(debrief)` to resolve all 5 grammars (with deterministic 4-to-5 legacy `diagramType` mapping and `choices.length >= 2` -> `decision-tree`), enforce `<= 6` nodes, prevent cross-lane edges in `before-after`, dual-code `#diagramTitleLabel` + `#nodeInspectorBar` + SVG `techLabel` `<tspan>`s via Story 6.3 helpers, highlight `#btnPowerupAnimate` on complex turns, and wire all 5 `powerup-dock` buttons without inline `onclick=` or dynamic `eval`.
- `tests/panel-a11y.test.mjs`:
  - Added `Story 6.4 — 5-grammar inline SVG stage, kinetic dash-flow & powerup-dock` suite (4 tests): static/CSS/CSP checks, all 5 grammars (`viewBox 460`, `<= 6` nodes, `.dash-flow`, lane-safe `before-after`), keyboard node inspection with C8-escaped X-Ray dual-coding, and `powerup-dock` triggers (`[Animate]` complex pulse, installed `excalidraw` `ui/message`, missing `vectorcraft` fallback warning).
- `tests/theme-parity.test.mjs`:
  - Extended static color-literal check to `build5GrammarSvgMarkup` and added theme-parity test rendering all 5 `diagramSpec` grammars in both Dark HUD and Field Desk Light without dark-literal leakage.

## Verification (Executed 2026-11-24)

- `node --test tests/` — exits 0 (`224` tests across `40` suites: `224` pass, `0` fail).
- `node scripts/check-version-sync.mjs` — exits 0 (`0.3.0` synced across all 4 locations).
- `node ../scripts/validate.mjs` — exits 0 (`bmad-companion`, `vibe-debrief`, `project-colors` validated).
- Headless Chrome (`--headless=new --allow-file-access-from-files --disable-web-security`) verified all 5 `diagramSpec` grammars (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`) across both `dark` (`rect` fill `rgb(24, 33, 48)`, text `rgb(231, 237, 246)`) and `light` (`rect` fill `rgb(255, 255, 255)`, text `rgb(23, 32, 46)`) themes: `viewBox` width `460`, `<= 6` nodes, lane-safe `before-after` (`2` intra-lane edges, `0` cross-lane bridges), keyboard `Enter`/`Space` inspection + toggle-off, `.dash-flow` `stroke-dasharray: 5px, 4px` with `flowDash` animation rule disabled cleanly under `prefers-reduced-motion: reduce`, and `0` horizontal overflow at `380px`.

## Notes / Handoff

- `build5GrammarSvgMarkup` and `triggerStage2Powerup` provide clean handoff points for Story 6.5 (`[Animate]` tour + Minimal Mode / `unclear-box`), Story 6.6 (standalone HTML export 5-grammar parity), and Epic 7 (`Stage 2 Pop-Out` + `missingPluginFallback` HTML export).
