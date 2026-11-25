---
title: 'Enhance Application UI/UX & Interaction Flows (v0.4.0 Views, Contrast & Ergonomics)'
type: ux
ticket: ux-enhance-views-flows-v0.4.0
created: '2026-11-25'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R10, R11, R14, R15, R16, R17, R18]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/tickets/plan-ux-refine-sync-views-flows-v0.4.0.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/.memlog.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/ux-vibe-debrief.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# BMAD Queue Task #7 — Enhance Application UI/UX & Interaction Flows

## Intent

Audits all 6 application views (`HUD`, `Visual`, `Memory & History`, `Settings & Export`, `Stage 2 Pop-Out`, `Standalone HTML Export`), user flows (`UJ-1`–`UJ-5`), Field Desk Light visual consistency, and keyboard/focus ergonomics against `plan-ux-refine-sync-views-flows-v0.4.0.md`, `.memlog.md`, `ux-vibe-debrief.md`, `DESIGN.md`, and `EXPERIENCE.md`, implementing targeted fixes and deterministic regression tests.

## Changes Delivered

- `assets/panel.html`
  - **Field Desk Light Semantic Wash & Hover Contrast (`>= 13.3:1`):** Extended `body.theme-light` / `html[data-theme="light"]` `color: var(--text-primary)` overrides to `.concept-pill.active`, `.concept-pill:hover`, `.target-tag`, `.pill-bug`, `.pill-persona`, `.action-chip:hover:not(:disabled)`, and `.pop-chip:hover:not(:disabled)`.
  - **320px Narrow-Panel Wrapping & Alignment:** Added `flex-wrap: wrap; overflow-wrap: anywhere` to `.node-inspector`, `max-width: 100%; overflow-wrap: anywhere; text-align: left` to `.file-badge`, `overflow-wrap: anywhere` to `.stage1-title`, and `max-width: 100%; text-align: left` to `.action-chip`, `.proof-pill`, and `.concept-pill`.
  - **Visual, Popover & Missing-Banner Focus Ergonomics:** Added `openVisualView()` (used by `complexityPill` and `#btnPowerupAnimate`) so opening `Visual` focuses `#btnExplainerPlay` when scenes exist or `#btnGenerateQuickTour` when scenes are empty; closed `#gearPopover` with focus return to `#btnGearSettings` on `Export HTML` completion so `#toastBanner` is not obscured; and restored focus to `#tabBtnHud` when `Escape` dismisses a focused `#missingPluginBanner`.
- `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`)
  - **Empty Analogy & Light-Mode Export Parity:** Suppressed empty `.analogy` boxes when `realWorldAnalogy` is blank (matching `#analogyBox` in `assets/panel.html`), added `@media (prefers-color-scheme: light)` `color: var(--text-primary)` overrides for `.pill.bug` and `.action-chip:hover`, and added `overflow-wrap: anywhere` / left-aligned wrapping on `.inspector`, `.chip`, `.stage2-deep-card`, `.action-chip`, and `.proof-pill`.
- `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/{DESIGN.md,EXPERIENCE.md,ux-vibe-debrief.md,.memlog.md}`
  - Synchronized the expanded Field Desk Light semantic wash selectors, 320px wrapping rules, `Export HTML` popover close/focus behavior, empty-scene `Visual` focus target, and `missing-banner` `Escape` focus return, and recorded the Task #7 decision/event in `.memlog.md`.
- `tests/panel-a11y.test.mjs` & `tests/export-parity.test.mjs`
  - Added `UX Views, Flows & Ergonomics Parity (v0.4.0)` (`5` tests in `tests/panel-a11y.test.mjs`) and offline empty-analogy/light-wash/wrapping parity assertions (`1` test in `tests/export-parity.test.mjs`).

## Verification (executed 2026-11-25)

- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — exit `0` (`283` tests across `52` suites: `283` pass, `0` fail, `0` skipped; all 4 version locations synced to `0.4.0`; `bmad-companion v0.5.4`, `vibe-debrief v0.4.0`, `project-colors v0.1.0` validated).
