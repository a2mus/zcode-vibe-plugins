---
type: epic
title: Light-theme parity
parent: initiative-vibe-debrief
covers: [R10]
sources:
  - _bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
after: [epic-test-suite, epic-atomic-state]
refined: true
risk: medium
---

# Light-theme parity

## Description

Builds on Epic 1's diagram and export regression tests (`1.1`, `1.2`, `1.4`) and Epic 2's finished atomic write path (`2.1`, `2.2`) so one shared Dark HUD and Field Desk Light theme-token contract drives the panel SVG diagram, Canvas explainer, and standalone HTML export legibly in both light and dark themes. Hands off the final `v0.3.0` panel markup, shared standalone HTML export baseline, and theme-token contract to Epics 4–6.

## Outcome

Vibe-coders using ZCode's light theme or opening standalone HTML exports on a light-mode OS read every diagram node, numbered edge, Canvas step, and card with full contrast parity while dark theme stays crisp.

## Requirements

1. **R1 (parent R10)**: The panel UI defines the shared Dark HUD (`:root`) and Field Desk Light (`body.theme-light`, `html[data-theme="light"]`) CSS custom property tokens from `DESIGN.md`, and the panel SVG diagram renderer resolves node fills/strokes, numbered edge badges, and text colors from CSS custom properties (via `var(--*)` / `getComputedStyle(document.documentElement)`) rather than hardcoded dark-only hexes, re-rendering cleanly when `ui/initialize` (`hostContext.theme`) or `ui/notifications/host-context-changed` updates the active theme.
2. **R2 (parent R10)**: The panel Canvas explainer draw loop and the standalone HTML export generator consume resolved theme tokens (with standalone HTML exports embedding both Dark HUD `:root` and `@media (prefers-color-scheme: light)` Field Desk Light palettes, zero external assets, and `\u003c` JSON escaping), verified by light/dark theme-token regression tests in `node --test tests/`.

## Constraints

- **C1, C3, C5** (parent `C1`, `C3`, `C5`): Zero external dependencies or external stylesheets/fonts (`C1`), strict CSP `unsafeEval: false` and `escapeHtml()` / `\u003c` safety (`C3`), and automated verification in `node --test tests/` (`C5`).

## Done when

1. Panel SVG nodes/edges and Canvas 2D draw loops read resolved CSS custom properties rather than hardcoded dark-only hexes and re-render on `host-context-changed`.
2. The standalone HTML export generator embeds both Dark HUD and `@media (prefers-color-scheme: light)` Field Desk Light palettes and drives its inline SVG and Canvas from resolved theme tokens with zero external assets.
3. Diagram and export regression tests in `node --test tests/` pass for both light and dark theme token contracts.

## Boundaries

- Belongs to siblings: base test harness (`epic-test-suite`), atomic writes (`epic-atomic-state`), panel ARIA/keyboard + `v0.3.0` stamp (`epic-panel-a11y`), and `v0.4.0` Cockpit HUD (`epic-cockpit-contract`, `epic-cockpit-hud-core`, `epic-concept-deep-dive`).
- Touch point owned: ZCode host theme context (`host-context-changed`, init `hostContext`), consumed read-only by the panel.

## References

- parent — `_bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md`, Requirements `R10`, Constraints `C1`, `C3`, `C5`
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md`, `AD-6`, `AD-9`, `AD-10`
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md`, Colors, Contrast & Theme Parity Floor (`R10`)

## Notes

- Risk reason (`medium`): Replaces hardcoded SVG and Canvas color literals across both the sandboxed MCP App panel and offline HTML export template under `unsafeEval: false` and `\u003c` escaping constraints.
- Assumption: `Field Desk Light` muted text token `{colors.text-muted-light}` (`#768396`) is restricted strictly to non-essential uppercase eyebrows and completed strikethroughs while load-bearing copy uses `{colors.text-primary-light}` (`#17202e`) and `{colors.text-secondary-light}` (`#4c5a6d`) for `>= 4.5:1` WCAG AA contrast (`DESIGN.md` Contrast & Theme Parity Floor).
- Decision: 2026-11-19 — Confirmed standalone HTML export embeds both Dark HUD (`:root`) and Field Desk Light (`@media (prefers-color-scheme: light)`) palettes automatically in `v0.3.0`, while interactive theme switching in the panel follows `hostContext.theme` / `host-context-changed` (`AD-6`).
- Decision: 2026-11-19 — Tracer bullet is Story 1 (`Shared Dark HUD & Field Desk Light CSS tokens & panel SVG diagram parity tracer`), proving the shared CSS custom property token table and theme-reactive SVG rendering in the panel before Story 2 extends token resolution to the Canvas explainer and standalone HTML export (`3.1 -> 3.2`).
- Waits on epic-test-suite because: needs the diagram and export regression tests (`1.1`, `1.2`, `1.4`).
- Waits on epic-atomic-state because: needs the finished write path in `scripts/debrief-engine.mjs` (`2.1`, `2.2`) so the same file is edited in a single ordered lane.
- Layer files: `assets/panel.html` (`renderInteractiveDiagram`, `drawExplainerFrame`), `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`), `tests/debrief-engine.test.mjs`.
