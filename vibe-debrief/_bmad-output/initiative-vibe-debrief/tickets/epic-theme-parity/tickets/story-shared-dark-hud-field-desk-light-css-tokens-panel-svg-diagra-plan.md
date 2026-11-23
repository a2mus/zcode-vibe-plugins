---
title: 'Shared Dark HUD & Field Desk Light CSS tokens & panel SVG diagram parity tracer'
type: feature
ticket: 1
created: '2026-11-23'
status: done
baseline_revision: 'ca76e2e11303215be2920969dbc1c25055e44c55'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `assets/panel.html` uses pre-`DESIGN.md` light/dark CSS variables and renders SVG diagram nodes, arrow markers, edge badges, and text with hardcoded dark-only hexes (`#0b0f17`, `#131a26`, `#f0f6fc`, `#9ba7b8`, `#38bdf8`, `#fb7185`, `#fbbf24`, `#34d399`), while `applyHostTheme` does not set `html[data-theme]` or re-render SVG visuals on theme change.

**Approach:** Align `:root` (Dark HUD) and `body.theme-light, html[data-theme="light"]` (Field Desk Light) CSS custom properties in `assets/panel.html` with `DESIGN.md`, add a reusable `resolveThemeTokens()` helper, refactor `renderInteractiveDiagram` to use resolved theme tokens, re-render active visuals on `ui/initialize` and `ui/notifications/host-context-changed`, and add `node:test` parity tests.

## Boundaries & Constraints

**Always:**
- Preserve all legacy CSS variable names (`--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--success`, `--warning`, `--danger`) mapped to the new `DESIGN.md` tokens so existing panel rules render consistently.
- Keep `assets/panel.html` 100% self-contained with zero external assets and compliant with `unsafeEval: false` (no `eval`, `new Function`, or inline `onclick=`), escaping dynamic text with `escapeHtml()`.
- Keep `node --test tests/` zero-dependency using only `node:` built-ins.

**Never:**
- Do not modify `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`) or refactor `drawExplainerFrame` color palettes here (owned by Story 3.2).
- Do not break the existing `resources/read` verbatim contract or any of the 120 existing tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Init with light hostContext | `ui/initialize` returns `hostContext: { theme: "light" }` | `body.theme-light` added, `html[data-theme="light"]` set, `#diagramSvg` renders using Field Desk Light tokens | Missing `hostContext.theme` defaults to dark without throwing |
| Live host theme toggle | `ui/notifications/host-context-changed` with `{ theme: "light" }` then `{ theme: "dark" }` | Classes/attributes flip, `resolveThemeTokens()` reads updated tokens, and `#diagramSvg` re-renders immediately when `currentState?.currentDebrief` exists | Missing `currentState` skips diagram re-render safely |
| Empty diagram nodes | `diagram.nodes = []` under dark or light theme | Pending `<text>` fill uses resolved `textSecondary` token (zero hardcoded `#9ba7b8`) | Renders placeholder safely |
| Node / edge risk & status | `risk: "high" \| "medium" \| "low"`, `status: "active"`, `selectedNodeId` match | Strokes/fills map to `risk`, `warn`, `accent`, `ok`, `accentSoft`, `bgCard`, `bgApp`, `textPrimary` | Unknown risk/status defaults to `ok` / `accent` |

</intent-contract>

## Code Map

- `assets/panel.html:8-57` — Current `:root` and `body.theme-light` CSS custom properties; align with `DESIGN.md` Dark HUD & Field Desk Light tokens and keep legacy aliases.
- `assets/panel.html:108-184,824` — Minor hardcoded dark hexes (`#0b0f17`, `#070b12`) in CSS rules; map to `--text-on-accent` and `--explainer-stage-bg`.
- `assets/panel.html:1201-1244` — `applyHostTheme(theme)` and `ui/notifications/host-context-changed` listener; sync `body.theme-light` + `html[data-theme]`, and re-render `renderInteractiveDiagram(currentState.currentDebrief)` when present.
- `assets/panel.html:1346-1503` — `renderInteractiveDiagram(debrief)`; replace hardcoded hex literals (`#9ba7b8`, `#38bdf8`, `#fb7185`, `#fbbf24`, `#34d399`, `#0b0f17`, `#f0f6fc`, `#131a26`, `rgba(56,189,248,0.16)`) with `resolveThemeTokens()` values.
- `assets/panel.html:2211-2230` — `initMcpApp()` reads `res.hostContext.theme` and calls `applyHostTheme`.
- `tests/theme-parity.test.mjs` — New zero-dependency `node:test` file verifying CSS tokens, WCAG AA contrast floor, zero dark-only literals in `renderInteractiveDiagram`, and `ui/initialize` / `host-context-changed` theme switching + SVG re-render.
- `tests/helpers.mjs` — Reuse `PANEL_HTML_PATH` and `buildDebriefFixture`.

## Tasks & Acceptance

**Execution:**
- [x] `assets/panel.html` -- Align `:root` and `body.theme-light, html[data-theme="light"]` CSS custom properties with `DESIGN.md` (preserving legacy variable aliases and mapping CSS `#070b12` / `#0b0f17` rules to tokens) -- Establishes the single shared theme token contract for Story 3.1, Story 3.2, and Epics 4 & 6.
- [x] `assets/panel.html` -- Add `resolveThemeTokens()` reading `getComputedStyle` CSS custom properties (with `DESIGN.md` theme fallbacks), update `applyHostTheme(theme)` to sync `body.theme-light` and `html[data-theme]` and re-render `renderInteractiveDiagram(currentState.currentDebrief)`, and refactor `renderInteractiveDiagram` to consume resolved tokens for all SVG fills, strokes, markers, badges, and text -- Eliminates all hardcoded dark-only SVG colors and makes theme switches live.
- [x] `tests/theme-parity.test.mjs` -- Add `node:test` assertions for Dark HUD & Field Desk Light tokens, WCAG contrast floor (`>= 4.5:1` text, `>= 3:1` strokes/accents), zero hardcoded dark-only colors in `renderInteractiveDiagram`, and simulated `ui/initialize` + `ui/notifications/host-context-changed` SVG re-rendering -- Proves theme parity automatically in `node --test tests/`.

**Acceptance Criteria:**
- Given `assets/panel.html`, when inspected for Dark HUD (`:root`) and Field Desk Light (`body.theme-light`, `html[data-theme="light"]`) CSS custom properties, then every `DESIGN.md` color token is defined with WCAG 2.1 AA contrast (`>= 4.5:1` primary/secondary text on card/panel/surface, `>= 3:1` semantic strokes/accents).
- Given the panel SVG diagram renderer under dark and light themes, when `ui/initialize` (`hostContext.theme`) or `ui/notifications/host-context-changed` switches between `"dark"` and `"light"`, then `body.theme-light` and `html[data-theme]` update and `#diagramSvg` re-renders nodes, edges, arrow markers, badge circles, and text using resolved light/dark CSS tokens with zero hardcoded dark-only fills or strokes.
- Given the repository test suite, when `node --test tests/` and `node --check` run, then all existing and new theme-parity tests pass with exit code `0`.

## Implementation Notes

- Aligned `:root` Dark HUD and `body.theme-light, html[data-theme="light"]` Field Desk Light CSS custom properties in [panel.html](../../../../../assets/panel.html) with `DESIGN.md`, keeping legacy aliases (`--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--success`, `--warning`, `--danger`) mapped in both themes.
- Added `THEME_TOKEN_DEFAULTS`, `isLightThemeActive()`, and `resolveThemeTokens()` in [panel.html](../../../../../assets/panel.html) for reuse by Story 3.2 and Epics 4 & 6, updated `applyHostTheme()` and `initMcpApp()` to sync `body.theme-light` and `html[data-theme]` and re-render `#diagramSvg`, and refactored `renderInteractiveDiagram()` to use resolved theme tokens with zero hardcoded dark-only colors.
- Added 14 zero-dependency tests in [theme-parity.test.mjs](../../../../../tests/theme-parity.test.mjs) covering CSS tokens, WCAG 2.1 AA contrast, CSP/static checks, and simulated `ui/initialize` + `host-context-changed` SVG re-renders.

## Plan Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none

## Design Notes

- `resolveThemeTokens()` should read `getComputedStyle(document.documentElement)` (or `document.body` when `body.theme-light` is active) using `getPropertyValue("--token").trim()` so both `body.theme-light` and `html[data-theme="light"]` resolve accurately, falling back to `DESIGN.md` hex values matching the active theme only if computed styles are empty in a non-CSS test stub.
- Note in `renderInteractiveDiagram`: node inspector risk color and `.diagram-svg` elements must keep `escapeHtml()` around all dynamic data (`n.id`, `n.label`, `n.sublabel`, `n.risk`, `e.stepNumber`) and avoid inline event attributes (`unsafeEval: false`).

## Verification

**Commands:**
- `node --test tests/` -- expected: all tests pass with exit code `0`, including `tests/theme-parity.test.mjs`
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` -- expected: exits `0`

## Auto Run Result

- **Summary of implemented change:** Aligned `assets/panel.html` `:root` Dark HUD and `body.theme-light, html[data-theme="light"]` Field Desk Light CSS custom properties with `DESIGN.md`, added `resolveThemeTokens()`, updated `applyHostTheme()` and `initMcpApp()` to synchronize theme state and re-render `#diagramSvg` on `ui/initialize` and `ui/notifications/host-context-changed`, refactored `renderInteractiveDiagram()` to consume resolved theme tokens with zero hardcoded dark-only hexes, and added `tests/theme-parity.test.mjs`.
- **Files changed:**
  - [panel.html](../../../../../assets/panel.html) — Shared Dark HUD & Field Desk Light CSS tokens, `resolveThemeTokens()`, theme-reactive `applyHostTheme()`, and token-driven `renderInteractiveDiagram()`.
  - [theme-parity.test.mjs](../../../../../tests/theme-parity.test.mjs) — 14 `node:test` parity, WCAG AA contrast, static CSP/hex, and simulated live theme-toggle tests.
  - [story-shared-dark-hud-field-desk-light-css-tokens-panel-svg-diagra-plan.md](story-shared-dark-hud-field-desk-light-css-tokens-panel-svg-diagra-plan.md) — Ticket 3.1 plan, implementation notes, review triage log, and auto-run result.
- **Review findings breakdown:** 0 findings (`quick` lens) — 0 patched, 0 deferred, 0 rejected.
- **Follow-up review recommendation:** `false` (patched counts by verdict: high 0, medium 0, low 0).
- **Verification performed:**
  - `node --test tests/` — 134 tests across 25 suites, 134 passed, 0 failed, 0 skipped.
  - `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` — exited `0`.
- **Residual risks:** Panel SVG rendering and `getComputedStyle` token resolution were verified in a Node `vm` DOM harness rather than a live Chromium/ZCode iframe; `drawExplainerFrame` and `generateStandaloneHtmlArtifact` remain scoped to Story 3.2.
