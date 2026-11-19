---
type: epic
title: Cockpit HUD shell, 10s Radar, X-Ray & 5-grammar visuals
parent: initiative-vibe-debrief
covers: [R14, R15, R16, R17]
sources:
  - _bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
after: [epic-test-suite, epic-theme-parity, epic-panel-a11y, epic-cockpit-contract]
refined: true
risk: medium
---

# Cockpit HUD shell, 10s Radar, X-Ray & 5-grammar visuals

## Description

Builds on Epic 1's `node:test` suite, Epic 3's shared theme tokens and `generateStandaloneHtmlArtifact` baseline, Epic 4's ARIA/keyboard/`prefers-reduced-motion` baseline, and Epic 5's frozen `OQ-5` payload contract, widened MCP schemas, and `Clarify` hook delegation. Replaces the stacked multi-row chrome in the panel UI and offline HTML exports with the 1-strip Cockpit HUD header, `gear-popover`, `10s Radar` (`What Just Happened` + 5-state `Waiting On You` `ui/message` chips), `< 16ms` client-side `X-Ray`, composable `microBlocks`, 5-grammar inline SVG with kinetic `.dash-flow`, Anytime `Visual` curator tour + `minimal-strip`, and low-confidence `unclear-box` across Dark HUD and Field Desk Light. Hands off the 1-strip Cockpit HUD layout, `microBlocks` renderer, and shared HTML export template to Epic 7.

## Outcome

Developers scan any AI turn in 10 seconds inside the `320–460px` sidebar, reply or clarify in one click via `ui/message`, flip between `STE-80` plain language and exact code symbols with zero LLM spend, and view the same rich diagram/audit output offline.

## Requirements

1. **R1 (parent R14)**: The panel renders the 1-strip `hud-header` (`Distill` triggering `[Vibe Debrief — Deep Refresh]` via `ui/message`, `xray-toggle`, `gear-btn`, `view-switcher`: `HUD` | `Visual` | `Memory & History`), `gear-popover` persisting `themePreference`, `language`, `persona`, `ste100Enabled`, and `preferredModel` via `vibe_debrief_set_persona` and triggering offline export via `vibe_debrief_export_html`, `radar-card` (`verdict`, <= 14-word headline, verification counts), stops `<canvas>`/`speechSynthesis` when switching away from `Visual`, and preserves transient UI state across same-turn `renderPanelState` updates.
2. **R2 (parent R14)**: `radar-card` and composable `microBlocks` render all 5 `waitingOnYou` states (`Choice`, `Action`, `Reply`, `Blocked`, `None`) with `action-chip` & `inline-reply-box` dispatching via `ui/message`, `choice-grid` (`choice-item` dispatching `messagePrompt` via `ui/message` with `34x4px` trade-off bars), `proof-pill` with expandable `proof-detail`, `audit-row` (`💡→Rule` prefilling `lesson-form`), `lessons` (`MEMORY.md` confirmation), and `Memory & History` view without truncating hybrid replies.
3. **R3 (parent R14)**: `xray-toggle` swaps pre-bound `Plain` (`STE-80` in `state.language`) and `Tech` (`.sym` symbols, paths, commands, exit codes, raw proof lines) representations in `< 16ms` with zero RPC/LLM calls, escaping raw `xray` strings with `escapeHtml()` before wrapping `.sym` badges (`C8`).
4. **R4 (parent R15)**: Pure inline SVG (`viewBox="0 0 460 H"`, `<= 6` primary nodes, zero pan/zoom) renders all 5 `diagramSpec` grammars (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`) using `DESIGN.md` Dark HUD & Field Desk Light CSS variables, kinetic `.dash-flow` motion honoring `prefers-reduced-motion: reduce`, click/keyboard node inspector, and `powerup-dock` (`[SVG]`, `[Excalidraw]`, `[Interactive Gen UI]`, `[VectorCraft]`, `[Animate]`).
5. **R5 (parent R16)**: `Visual` (`explainer-stage`) and `[Animate]` in `powerup-dock` are unlocked on every non-minimal turn (highlighting `[Animate]` with an active pulse badge when `complexity.level === "complex"`), and trivial high-confidence turns render `minimal-strip` (`Minimal Mode · Verified`) with a 1-click `Expand` override.
6. **R6 (parent R17)**: Low-confidence heuristic `Stop` turns (`heuristicConfidence < 0.55`) render `unclear-box` (`rawQuote` <= 280 chars, `Show Raw Reply` toggle, `Clarify (Fast / Cheapest Model)` `ui/message` trigger) instead of collapsing to `minimal-strip` or fabricating verified claims.
7. **R7 (parent R14, R15, R16)**: `generateStandaloneHtmlArtifact` renders `10s Radar`, local `X-Ray` toggle, composable `microBlocks`, all 5 inline SVG grammars, Anytime Canvas tour, and `@media (prefers-color-scheme: light)` Field Desk Light tokens with `<` escaped as `\u003c` and zero external assets.

## Constraints

- **C1–C10** (parent `C1`–`C10`): Zero external assets, `unsafeEval: false` (no `eval`, `new Function`, inline `onclick=`), `escapeHtml()` on all dynamic markup, `\u003c` escaping in embedded JSON, `X-Ray` `.sym` wrapping after escaping (`C8`), unrun tests banned from `ok` pills (`C9`), zero pan/zoom or inline diff/chat/whiteboard editors inside the `320–460px` panel (`C10`), and full keyboard/ARIA/`prefers-reduced-motion` parity (`R11`).

## Done when

1. Opening the panel at `320–460px` shows the 1-strip header, `gear-popover` persistence, `10s Radar` (`5` waiting states), `< 16ms` `X-Ray`, composable `microBlocks`, 5-grammar inline SVG, Anytime `Visual` tour, `minimal-strip`, and `unclear-box` across Dark HUD and Field Desk Light.
2. `generateStandaloneHtmlArtifact` produces self-contained offline `.html` files across all 5 grammars with local `X-Ray`, light/dark `@media` parity, and zero unescaped `<` in embedded JSON.
3. `node --test tests/` and `node --check` pass with zero CSP, XSS, or a11y regressions.

## Boundaries

- Belongs to siblings: Wave 1 epics (`epic-test-suite`, `epic-atomic-state`, `epic-theme-parity`, `epic-panel-a11y`), `OQ-5` backend/MCP/Hook contract (`epic-cockpit-contract`), and Stage 1/2 `concept-pill` / `stage1-drawer` / Stage 2 Pop-Out & `v0.4.0` stamp (`epic-concept-deep-dive`).
- Touch points owned: ZCode host `themePreference` override on top of `host-context-changed`, and `ui/message` dispatch for `Waiting On You` chips, `choice-item`, `Distill`, and `Clarify`.

## References

- parent — `_bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md`, Requirements `R14`–`R17`, Constraints `C1`–`C10`
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md`, `AD-6`, `AD-7`, `AD-9`, `AD-10`, `AD-12`–`AD-16`
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md`, Colors, Typography, Layout & Spacing, Components
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md`, Information Architecture, Component Patterns, State Patterns, Accessibility Floor, `UJ-1`, `UJ-3`, `UJ-4`

## Notes

- Assumption: `responseType` (`bug` | `implementation`) remains switchable via `vibe_debrief_set_persona` MCP calls while `gear-popover` exposes the 6 UX controls in `DESIGN.md` (`themePreference`, `language`, `persona`, `ste100Enabled`, `preferredModel`, `Export HTML`).
- Decision: 2026-11-19 — Tracer bullet is Story 1 (`1-strip Cockpit HUD header, gear-popover & 10s Radar tracer`), proving the single-strip shell, `gear-popover` `set_persona` persistence, and `radar-card` render path; intra-epic lane serializes `assets/panel.html` edits cleanly (`6.1 -> 6.2 -> 6.3 -> 6.4 -> 6.5 -> 6.6 -> 6.7`) after Epic 5's refactor sweep (`5.6`).
- Waits on epic-test-suite because: runs automated CSP, DOM, and export regression assertions in `node --test tests/`.
- Waits on epic-theme-parity because: builds on the shared Dark HUD / Field Desk Light theme-token contract and `generateStandaloneHtmlArtifact` baseline.
- Waits on epic-panel-a11y because: preserves ARIA roles, keyboard navigation, and `prefers-reduced-motion` while refactoring `assets/panel.html`.
- Waits on epic-cockpit-contract because: consumes the frozen `OQ-5` payload, widened `vibe_debrief_set_persona` schema, and `Clarify` hook delegation after `5.6`.
- Layer files: `assets/panel.html`, `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`), `tests/`.
