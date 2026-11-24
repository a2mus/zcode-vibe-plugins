---
title: 'Refine & Synchronize UX Design Specifications (Application Views, User Flows & Visual Consistency)'
type: ux
ticket: ux-sync-views-flows-consistency
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R10, R11, R14, R15, R16, R17, R18]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-panel-a11y/tickets/plan-ux-audit-views-flows-ergonomics.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/.memlog.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/ux-vibe-debrief.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/mockups/cockpit-hud.html'
---

# BMAD Queue Task #3 — Refine & Synchronize UX Design Specifications

## Intent

Synchronizes `DESIGN.md`, `EXPERIENCE.md`, `ux-vibe-debrief.md`, `.memlog.md`, `mockups/cockpit-hud.html`, and `assets/panel.html` around application views, user flows (`UJ-1`–`UJ-5`), and Dark HUD / Field Desk Light visual consistency per `plan-ux-audit-views-flows-ergonomics.md`.

## Changes Delivered

- `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md`
  - Added `text-on-warn-light: '#ffffff'` (`5.02:1` contrast on `{colors.warn-light}` `#b45309`, fixing `#140d00`'s `3.85:1` light-mode contrast gap) and updated `missing-banner.ctaLightForeground`.
  - Synchronized `hud-toast` foreground tokens to `{colors.text-primary}` (`>= 13.3:1` in Field Desk Light over semantic `-soft` fills, matching `assets/panel.html` `.toast-banner`) and documented the **Field Desk Light Semantic Wash Rule** in `Colors`.
  - Added the **6-View Spatial Matrix** and **Narrow-Panel Wrapping Guard (`320px` Floor)** inside `Layout & Spacing`, plus `2.4px` SVG hover/focus stroke parity in `Components`.
- `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md`
  - Synchronized `Cross-View Transitions & Layout Flow` (same-turn transient preservation vs. cross-turn `selectedNodeId` / inspector / file-chip reset, `#btnReturnLatest` focus return to `HUD` tab button, honest async `Distill`/`Sync` toast timing, and `Escape` propagation hygiene).
  - Updated `Component Patterns` (`svg-stage`, `explainer-stage` `aria-pressed` Play/Pause parity, `lesson-form` prefill reset + missing-field focus, `snapshot-banner` & `hud-toast` variants), `Accessibility Floor` (Panel + Standalone HTML Export parity), and `UJ-4`/`UJ-5` edge-case paths.
- `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/ux-vibe-debrief.md` & `.memlog.md`
  - Updated the UX hub with `plan-ux-audit-views-flows-ergonomics.md`, expanded the 6-view summary (`Trigger`, `Envelope`, `Primary Purpose & Empty / Fallback State`), added `Cross-View Transitions & Ergonomic Invariants`, and appended 3 timestamped entries to `.memlog.md` via `memlog.py`.
- `assets/panel.html`, `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/mockups/cockpit-hud.html`, & `tests/theme-parity.test.mjs`
  - Updated `--text-on-warn: #ffffff` in Field Desk Light (`assets/panel.html` & `THEME_TOKEN_DEFAULTS.light.textOnWarn`), aligned `cockpit-hud.html` (`.hud-toast`, light `.install-btn`, `:focus-visible`, `prefers-reduced-motion`), and added WCAG AA button-text contrast assertions (`--text-on-accent` on `--accent`, `--text-on-warn` on `--warn`) in `tests/theme-parity.test.mjs`.

## Verification (executed 2026-11-24)

- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --test tests/ && node scripts/check-version-sync.mjs` — exit 0 (`189` tests across `34` suites: `189` pass, `0` fail; all 4 version locations synced to `0.3.0`).
- `node ../scripts/validate.mjs` — exit 0 (`bmad-companion v0.5.3`, `vibe-debrief v0.3.0`, `project-colors v0.1.0` validated).
