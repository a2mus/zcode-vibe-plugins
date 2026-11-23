---
title: 'Keyboard-operable SVG nodes, history rows & prefers-reduced-motion support'
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
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-panel-a11y/epic-panel-a11y.md'
---

# Build Ticket 4.2 & UX Audit — Keyboard-Operable SVG Nodes, History Replay, Reduced Motion & Interaction Ergonomics

## Intent

Audits all application views, user flows, and visual consistency against `DESIGN.md`, `EXPERIENCE.md`, and `.memlog.md`, and completes Story 4.2 (`epic-panel-a11y` R2): keyboard-operable SVG diagram nodes, turn history rows, and complexity triggers (`tabindex="0"`, `role="button"`, escaped `aria-label`, `Enter`/`Space`), `prefers-reduced-motion: reduce` support across CSS transitions and `<canvas>` explainer frames, WCAG AA contrast refinements, responsive narrow-panel header layout, history snapshot replay indicator (`Return to Latest`), and RPC busy/error ergonomics.

## Implementation Notes

- `assets/panel.html`
  - **Keyboard operability (Story 4.2)**:
    - SVG `<g class="diagram-node-group">` nodes now declare `tabindex="0"`, `role="button"`, `aria-pressed`, and `escapeHtml()`-protected `aria-label`s, support `Enter`/`Space` activation, toggle inspection off cleanly on re-activation, and preserve focus on keyboard activation.
    - History items (`.history-item`) declare `tabindex="0"`, `role="button"`, `aria-pressed`, and escaped `aria-label`s with `Enter`/`Space` activation.
    - `#complexityPill` declares `role="button"`, dynamic `tabindex="0"`, and `Enter`/`Space` listeners (replacing inline `.onclick` assignment) to open the Explainer tab and focus `#btnExplainerPlay`.
  - **Reduced motion (`prefers-reduced-motion: reduce`)**:
    - Added `@media (prefers-reduced-motion: reduce)` CSS disabling transitions, animations, and smooth scrolling.
    - Added `prefersReducedMotion()` guard in `drawExplainerFrame()`, `startCanvasAnimationLoop()`, and `scrollIntoView` so `<canvas>` renders static highlighted scene frames without continuous `requestAnimationFrame` pulse loops.
  - **UX & visual consistency audit**:
    - Updated `.btn-primary` to `background: var(--accent); color: var(--text-on-accent)` (`>= 4.5:1` WCAG AA contrast in both Dark HUD and Field Desk Light).
    - Upgraded `.proof-evidence` and empty-state copy from `--text-muted` to `--text-secondary` (`>= 4.5:1` per `DESIGN.md`).
    - Added `#historySnapshotBanner` + `#btnReturnLatest` (`Viewing Turn Snapshot -> Return to Latest`) when loading historical turns from History.
    - Added responsive `.brand-row` / `.tabs-nav` wrapping and overflow rules for `320–460px` sidebars.
    - Added descriptive `aria-label`s to header controls, prev/next/speed explainer controls, and custom lesson inputs, plus validation focus on missing required fields, `setButtonBusy()` in-flight guards, and error toasts replacing silent `catch {}` blocks.
- `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`)
  - Added `:focus-visible` outline styling, `@media (prefers-reduced-motion: reduce)` CSS and static Canvas frame guard, `role="status" aria-live="polite"` on `#nodeInspector`, and `tabindex="0" role="button"` + escaped `aria-label` + `Enter`/`Space` keyboard activation on `.dnode` SVG nodes.
- `tests/panel-a11y.test.mjs` & `tests/debrief-engine.test.mjs`
  - Added 6 deterministic tests covering `.btn-primary` contrast & `aria-label`s, `prefers-reduced-motion` static Canvas rendering, SVG node `Enter`/`Space` toggle inspection & escaped `aria-label`s, keyboard history snapshot loading & `Return to Latest`, `#complexityPill` keyboard trigger + validation focus + RPC error recovery, and standalone HTML keyboard/reduced-motion parity.

## Verification (executed 2026-11-23)

- `node --test tests/` — 167 tests across 31 suites, 167 pass, 0 fail, 0 skipped.
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` — exits 0.
- MCP stdio smoke (`initialize` / `tools/list` / `resources/list`) — exits 0, returns 3 JSON-RPC frames.
- Hook runner smoke (`echo '{}' | node scripts/hook-runner.mjs session-start`) — exits 0, emits single JSON protocol line.
