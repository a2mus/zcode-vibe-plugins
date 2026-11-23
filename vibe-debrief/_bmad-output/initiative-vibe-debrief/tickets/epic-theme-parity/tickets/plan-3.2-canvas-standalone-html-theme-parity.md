---
title: 'Panel Canvas explainer & standalone HTML export light/dark theme parity'
type: feature
ticket: 2
created: '2026-11-23'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R2]
context:
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-theme-parity/epic-theme-parity.md'
---

# Build Ticket 3.2 — Canvas & Standalone HTML Theme Parity

## Intent

Consume Story 3.1's `resolveThemeTokens()` in the panel Canvas explainer draw loop and embed the
shared Dark HUD (`:root`) + Field Desk Light (`@media (prefers-color-scheme: light)`) token contract
in `generateStandaloneHtmlArtifact`, so Canvas steps, export SVG nodes, and export cards stay legible
in both themes with zero external assets and `\u003c` JSON escaping (epic R2, constraints C1/C3/C5).

## Implementation Notes

- `assets/panel.html`
  - Light theme block adds `--explainer-stage-bg: #f1ece1` (DESIGN.md `bg-elevated-light` for light
    canvas stages) and `--canvas-grid-line: rgba(2, 132, 199, 0.08)` (accent-light grid).
  - `THEME_TOKEN_DEFAULTS` and `resolveThemeTokens()` extended with `explainerStageBg` and
    `canvasGridLine` (dark + light fallbacks).
  - `drawExplainerFrame()` now paints the stage background and resolves every grid, edge, pulse,
    node fill/stroke, label, sublabel, risk, title, callout, and timeline color from
    `resolveThemeTokens()` — zero hardcoded dark-only literals remain.
  - `applyHostTheme()` re-draws the explainer canvas alongside the SVG diagram on
    `ui/initialize` / `ui/notifications/host-context-changed`.
- `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`)
  - Export CSS embeds the full DESIGN.md Dark HUD `:root` palette plus a
    `@media (prefers-color-scheme: light)` Field Desk Light override; legacy artifact aliases
    (`--bg`, `--card`, `--panel`, `--text`, `--muted`, `--bad`) map to the shared tokens via `var()`.
  - Pill borders, checklist hairlines, and the canvas stage background use tokens instead of
    hardcoded rgba/hex literals.
  - Export inline script adds `resolveTokens()` reading `getComputedStyle(document.documentElement)`;
    SVG rendering is wrapped in `renderDiagram()` and the Canvas `drawFrame()` resolves tokens per
    frame; a `matchMedia("(prefers-color-scheme: light)")` change listener re-renders both visuals
    when the OS theme flips. `\u003c` payload escaping and `escapeHtml()`/`esc()` unchanged.
- `tests/helpers.mjs` — shared `extractStyleContent`, `extractInlineScript`, `parseCssBlockVars`
  (now parses compact multi-declaration lines), `resolveCssAliases`, `contrastRatio` (deduplicated
  from `theme-parity.test.mjs`, per Story 1.5 direction).
- `tests/theme-parity.test.mjs` — 5 new Canvas parity tests (static zero-literal check, dark draw,
  light draw, live host-theme toggle re-draw, empty-computed-style fallbacks); harness canvas stub
  now records draw ops.
- `tests/debrief-engine.test.mjs` — 7 new export parity tests (dual palette embedding, WCAG AA
  contrast floors, script zero-literal check, dark/light SVG token rendering, dark/light Canvas
  token rendering, runtime `prefers-color-scheme` re-render); `renderArtifactScript` harness now
  supplies `getComputedStyle`, `matchMedia`, and a recording 2D context.

## Verification (executed 2026-11-23)

- `node --test tests/` — 146 tests, 27 suites, 146 pass, 0 fail, 0 skipped (134 prior + 12 new).
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` — exit 0.
- MCP stdio smoke (`initialize` / `tools/list` / `resources/list`) — 3 JSON-RPC frames, 8 tools,
  `ui://vibe-debrief/panel.html` resource served.
- `echo '{}' | node scripts/hook-runner.mjs session-start` — single protocol JSON line with banner.

## Residual Risks

- Canvas and export rendering verified in Node `vm` DOM harnesses, not a live Chromium/ZCode iframe
  or a real OS light-mode browser session (manual light/dark inspection from the ticket `verify`
  string remains a human spot-check).
- Light `--canvas-grid-line` / `--explainer-stage-bg` values derive from DESIGN.md `accent-light`
  and `bg-elevated-light`; DESIGN.md lists no explicit light variant for these two stage tokens.