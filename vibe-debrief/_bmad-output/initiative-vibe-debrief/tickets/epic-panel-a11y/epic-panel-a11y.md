---
type: epic
title: Keyboard and assistive-tech panel (v0.3.0 release)
parent: initiative-vibe-debrief
covers: [R11, R12]
sources:
  - _bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
after: [epic-test-suite, epic-atomic-state, epic-theme-parity]
refined: true
risk: medium
---

# Keyboard and assistive-tech panel (v0.3.0 release)

## Description

Builds on Epic 1's `node:test` suite (`1.1`–`1.4`), Epic 2's shipped atomic write path (`2.2`), and Epic 3's final `v0.3.0` panel markup and theme-token contract (`3.1`, `3.2`) so the panel is operable end-to-end by keyboard, announces state changes to assistive technology, honors `prefers-reduced-motion: reduce`, and ships Wave 1 as `v0.3.0` with all four version locations synced via `scripts/check-version-sync.mjs`. Hands off the `v0.3.0` release baseline, ARIA/keyboard/reduced-motion panel baseline, and `scripts/check-version-sync.mjs` gate to Epics 5–7.

## Outcome

Keyboard-only and screen-reader developers navigate and operate the entire panel without mouse clicks, and `v0.3.0` releases with automated 4-file version sync verification.

## Requirements

1. **R1 (parent R11)**: The panel UI exposes semantic ARIA landmarks, tab semantics, and polite live regions (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`, `aria-pressed` on toggle controls, `role="status"` + `aria-live="polite"` on toast notifications and node inspector state updates), visible `>= 3:1` `:focus-visible` outlines across Dark HUD and Field Desk Light, `ArrowLeft`/`ArrowRight` navigation on tabs and scene pills, and `Escape` to dismiss the inline lesson form.
2. **R2 (parent R11)**: Custom interactive elements in the panel — SVG diagram nodes, turn history items, and clickable complexity/explainer triggers — carry `tabindex="0"`, `role="button"`, descriptive `aria-label` attributes, and `Enter`/`Space` activation handlers, while `@media (prefers-reduced-motion: reduce)` and `window.matchMedia("(prefers-reduced-motion: reduce)")` suppress CSS transitions and continuous `<canvas>` pulse `requestAnimationFrame` loops in favor of static highlighted scene frames.
3. **R3 (parent R12)**: Zero-dependency `scripts/check-version-sync.mjs` verifies that `.zcode-plugin/plugin.json` (`version`), `scripts/mcp-server.mjs` (`serverInfo.version`), `assets/panel.html` (`appInfo.version`), and `scripts/hook-runner.mjs` (`SessionStart` banner) all declare the exact same semver version, is wired into `node --test tests/`, and passes with all four files stamped to `0.3.0`.

## Constraints

- **C1, C3–C5** (parent `C1`, `C3`–`C5`): Zero external dependencies (`C1`), CSP `unsafeEval: false` with zero inline `onclick=`/`onkeydown=` attributes and `escapeHtml()` on all dynamic ARIA labels (`C3`), atomic 4-file version synchronization (`C4`), and one-command `node --test tests/` verification (`C5`).

## Done when

1. Every interactive control, tab, SVG node, and history row in the panel supports logical `Tab` order, `Enter`/`Space` (and `ArrowLeft`/`ArrowRight` / `Escape`) keyboard activation, visible `:focus-visible` outlines, semantic ARIA roles/live regions, and `prefers-reduced-motion: reduce`.
2. `scripts/check-version-sync.mjs` verifies all 4 version locations (`.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs`, `assets/panel.html`, `scripts/hook-runner.mjs`) match `0.3.0` and is wired into `node --test tests/`.
3. The full `node --test tests/` suite runs green with `v0.3.0` stamped.

## Boundaries

- Belongs to siblings: Wave 1 test/state/theme epics (`epic-test-suite`, `epic-atomic-state`, `epic-theme-parity`) and Wave 2 Cockpit HUD epics (`epic-cockpit-contract`, `epic-cockpit-hud-core`, `epic-concept-deep-dive`).

## References

- parent — `_bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md`, Requirements `R11` & `R12`, Constraints `C1`, `C3`–`C5`
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md`, `AD-6`, `AD-8`, `AD-10`
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md`, Contrast & Theme Parity Floor
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md`, Interaction Primitives, Accessibility Floor (`R11`)

## Notes

- Risk reason (`medium`): Retrofits keyboard handlers, ARIA roles, reduced-motion guards, and the 4-file `0.3.0` release stamp across the single-file MCP App and backend scripts without breaking `unsafeEval: false` or Wave 2 Cockpit HUD refactoring.
- Decision: 2026-11-19 — Tracer bullet is Story 1 (`Panel ARIA landmarks, live regions, focus rings & tab keyboard navigation tracer`), proving semantic ARIA roles, live regions, `:focus-visible` rings, and keyboard tab/form navigation in the panel before Story 2 adds SVG node/history keyboard operability + `prefers-reduced-motion` and Story 3 wires `scripts/check-version-sync.mjs` and stamps `0.3.0` (`4.1 -> 4.2 -> 4.3`).
- Waits on epic-test-suite because: needs the `node:test` suite (`1.1`–`1.4`) that the release gate runs.
- Waits on epic-atomic-state because: needs the shipped atomic write path (`2.2`) before stamping `v0.3.0`.
- Waits on epic-theme-parity because: needs the final `v0.3.0` panel markup and theme-token contract (`3.1`, `3.2`) so `assets/panel.html` is edited in one ordered lane.
- Layer files & DOM targets: `assets/panel.html` (`#toastBanner`, `#nodeInspectorBar`, `#customLessonForm`, `<g class="diagram-node-group">`, `.history-item`, `#complexityPill` — assert semantic ARIA roles/attributes such as `role="tablist"`, `role="tab"`, `role="status"`, `aria-live="polite"`, `tabindex="0"`, `:focus-visible`, and `prefers-reduced-motion: reduce` in `tests/` so assertions remain stable when Epic 6 upgrades to Cockpit HUD layout), `scripts/check-version-sync.mjs`, `.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs`, `scripts/hook-runner.mjs`, `tests/transports-and-sync.test.mjs`.
