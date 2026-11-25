---
title: 'UX Audit: v0.4.0 Cockpit HUD & Stage 1/Stage 2 flows in assets/panel.html and generateStandaloneHtmlArtifact'
type: ux
ticket: ux-audit-v0.4.0-panel-exports
created: '2026-11-25'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R1, R2, R3, R4, R5, R6, R7, R10, R11]
context:
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
  - 'assets/panel.html'
  - 'scripts/debrief-engine.mjs'
---

# BMAD Queue Task #3 — Audit v0.4.0 Panel & Exports Against UX Specs

## Intent

Audits the implemented `v0.4.0` Cockpit HUD and Stage 1 / Stage 2 deep-dive flows in `assets/panel.html` and `generateStandaloneHtmlArtifact` (`scripts/debrief-engine.mjs`) against `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md` and `EXPERIENCE.md`, fixing any contrast, keyboard-parity, playback-sync, or offline-fallback gaps without violating `unsafeEval: false` or `v0.2.0`/`v0.3.0` compatibility.

## Audit Findings & Changes Delivered

- `assets/panel.html`
  - **Field Desk Light Semantic Wash Contrast (`DESIGN.md` Colors):** Added `body.theme-light` / `html[data-theme="light"]` `color: var(--text-primary)` overrides for `.minimal-badge`, `.unclear-title`, `.missing-artifact-link`, and `.lesson-form-title` (moved `#customLessonForm` heading's inline `color: var(--warning)` to `.lesson-form-title`) so 10–12px text over soft semantic washes and light paper meets WCAG AA `>= 4.5:1`.
  - **320px Narrow-Panel Wrapping (`DESIGN.md` Layout & Spacing):** Added `overflow-wrap: anywhere` to `.stage1-copy` and `.stage1-analogy` inside `stage1-drawer`.
  - **Stage 1 Keyboard Focus Preservation (`EXPERIENCE.md` Accessibility Floor):** Updated `.concept-pill` click/toggle handler in `renderConceptsBlock` to restore focus to the toggled `.concept-pill` after DOM re-render.
- `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`)
  - **Field Desk Light Semantic Wash Parity:** Added `.wait-badge`, `.pill.grammar`, `.missing-banner strong`, and `.unclear-title` (`color: var(--text-primary)`) inside `@media (prefers-color-scheme: light)`.
  - **Canvas Tour Playback & Keyboard Parity (`EXPERIENCE.md` Visual `explainer-stage`):** Synced `syncScenePills()` inside `tick()` when scenes auto-advance during playback, and added roving `tabindex` plus `ArrowRight` / `ArrowLeft` / `Home` / `End` keyboard navigation on `#explainerScenePills`.
  - **Honest `unclear-box` Fallback in Offline Exports (`EXPERIENCE.md` `unclear-box`):** Rendered `#microBlockUnclear` (escaped `rawQuote <= 280` chars + confidence pill) whenever `heuristicConfidence < 0.55` or `rawQuote` is present.
- `tests/panel-a11y.test.mjs` & `tests/export-parity.test.mjs`
  - Added deterministic assertions for Field Desk Light semantic wash overrides, `concept-pill` focus preservation on collapse, `#explainerScenePills` keyboard navigation (`ArrowRight`/`ArrowLeft`/`Home`/`End` + roving `tabindex`), and low-confidence `unclear-box` offline export rendering + XSS escaping.

## Verification (executed 2026-11-25)

- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — exit 0 (`274` tests across `50` suites: `274` pass, `0` fail; all 4 version locations synced to `0.4.0`).
- `node ../scripts/validate.mjs` — exit 0 (`bmad-companion v0.5.3`, `vibe-debrief v0.4.0`, `project-colors v0.1.0` validated).
