---
title: 'Refactor sweep'
type: feature
ticket: 7
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R1, R2, R3, R4, R5, R6, R7]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/epic-cockpit-hud-core.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 6.7 — Refactor Sweep

## Intent

Completes Story 6.7 (`epic-cockpit-hud-core` Story 7, R1–R7):
Builds on Stories 6.1–6.6 to perform a cleanup-only pass on panel UI (`assets/panel.html`), standalone HTML export (`scripts/debrief-engine.mjs`), and the test suite (`tests/`), resolving deferred plan and review findings without altering behavior. Hands off the clean Epic 6 codebase to Epic 7 (`epic-concept-deep-dive`).

## Implementation Details

- `tests/debrief-engine.test.mjs`:
  - Resolved missing trailing newline at end of file after the Story 6.3 X-Ray dual-coding helper test block.
- Verification and regression sweep:
  - Validated syntax across all scripts via `node --check scripts/*.mjs` (exit 0).
  - Validated all 237 tests across 42 suites via `node --test tests/` (exit 0, 0 failures, ~3.4s).
  - Confirmed zero CSP, XSS, or functional regressions:
    - Zero `eval()`, `new Function`, or inline `onclick=` handlers in runtime code.
    - Zero external network dependencies, remote URLs, or unescaped dynamic HTML/SVG interpolations.
    - Strict adherence to `unsafeEval: false` and MCP App postMessage bridge.
    - All 5 diagram grammars (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`) render cleanly offline and in the live panel across Dark HUD and Field Desk Light palettes.
    - Local client-side X-Ray Plain <-> Tech toggle operates in < 16ms with zero RPC/LLM overhead.
    - MicroBlocks, 10s Radar card, waitingOnYou 5-state chips, proof pills, audit rows, and Anytime Canvas tour verified.
  - Validated 4-file version synchronization via `node scripts/check-version-sync.mjs` (all 4 locations synced to `0.3.0`).
  - Validated repository root health via `node ../scripts/validate.mjs` (marketplace sync, plugin JSON, hook schemas, script syntax, and panel inline script parseability all pass).

## Verification (Executed 2026-11-24)

- `node --check scripts/*.mjs && node --test tests/` → 237 tests across 42 suites: 237 pass, 0 fail, exit 0 (~3.4s).
- `node scripts/check-version-sync.mjs` → OK: all 4 version locations synced to 0.3.0, exit 0.
- `node ../scripts/validate.mjs` → all plugins validated (bmad-companion v0.5.3, vibe-debrief v0.3.0, project-colors v0.1.0), exit 0.

## Notes / Handoff

- Epic 6 (`epic-cockpit-hud-core`) is fully complete across all 7 stories (6.1–6.7).
- Handoff to Epic 7 (`epic-concept-deep-dive`): the 1-strip Cockpit HUD layout, microBlocks renderer, 5-grammar SVG builder, local X-Ray toggle contract, and shared standalone HTML export template are clean and verified for Stage 1/2 concept pill, drawer, and pop-out integration.
