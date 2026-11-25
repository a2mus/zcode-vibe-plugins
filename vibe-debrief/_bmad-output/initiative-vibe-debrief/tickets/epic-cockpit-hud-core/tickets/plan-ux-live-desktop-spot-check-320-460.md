---
title: 'Live ZCode Desktop Visual Spot-Check of assets/panel.html (Dark HUD & Field Desk Light, 320px-460px)'
type: ux
ticket: ux-live-desktop-spot-check-320-460
created: '2026-11-25'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R10, R11, R14, R15, R16, R17, R18]
context:
  - 'assets/panel.html'
  - 'tests/panel-a11y.test.mjs'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# BMAD Queue Task #4 — Live ZCode Desktop Visual Spot-Check

## Intent

Spot-check live rendering of `assets/panel.html` across both **Dark HUD** and **Field Desk Light** at `320px–460px` width (`320`, `340`, `341`, `360`, `390`, `460` viewports inside a simulated ZCode `postMessage` host iframe using headless Chromium via Chrome DevTools Protocol), fix any responsive layout/clipping/overlap issues discovered, add deterministic regression assertions, and verify via the full test & version-sync gate.

## Spot-Check Findings & Fixes Delivered

- `assets/panel.html`
  - **320px–360px View-Switcher Tab Clipping (`.view-switcher`, `.view-tab-label`, `#tabBtnMemory`):** Replaced `grid-template-columns: repeat(3, 1fr)` with `minmax(0, 0.78fr) minmax(0, 0.82fr) minmax(0, 1.4fr)` plus `@media (max-width: 390px)` `grid-template-columns: auto auto minmax(0, 1fr)` and compact tab padding (`4px 6px`, `11px` font), and wrapped `Memory & History (<span id="memoryCountBadge">0</span>)` in `<span class="view-tab-label">` so `"Memory & History (1)"` no longer clips on both sides at `320px–360px` or renders `( 1 )` flex-gap spacing at `460px`.
  - **Wrapped `<=340px` Header & Gear Popover Overlap (`@media (max-width: 340px)`):** Added `.hud-controls { margin-left: auto; }` so wrapped `X-Ray` + `Gear` controls align cleanly to the right edge on row 2, and placed `.gear-popover { top: 72px; }` inside `@media (max-width: 340px)` after the base `.gear-popover` rule so the open popover sits cleanly below `#btnGearSettings` instead of overlapping it.
  - **320px Memory & History Wrapping (`#memoryDirPathLabel`, `.lesson-title-row`):** Added `overflow-wrap: anywhere` to `#memoryDirPathLabel` and its wrapper, and added `flex-wrap: wrap` on `.lesson-title-row` with `white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis;` on `.lesson-title-row .pill` so long memory paths wrap cleanly and lesson `.md` slug pills never squish into tall multi-line ovals at `320px`.
- `tests/panel-a11y.test.mjs`
  - Added `320px-460px Live Desktop Rendering Guards` test suite (`3` tests) asserting the proportional/narrow `.view-switcher` rules, `.view-tab-label` wrapper, `@media (max-width: 340px)` `.hud-controls` right-alignment + `.gear-popover` `top: 72px` cascade ordering, `#memoryDirPathLabel` wrapping, and `.lesson-title-row` pill non-squish rules.

## Scope Honesty

- Automated headless Chromium rendering (`320px`, `340px`, `341px`, `360px`, `390px`, `460px` in Dark HUD and Field Desk Light via a local `postMessage` MCP App host harness) verified `0` horizontal overflow elements, `0` clipped tabs, and `0` gear-popover overlaps across HUD, Gear Popover, Visual, and Memory & History views, plus visual inspection of captured screenshots.
- Live ZCode desktop native sidebar host window pixel rendering outside this headless Chromium iframe harness was not directly captured by OS desktop screenshot (MCP live state launch verified via `vibe_debrief_get_state`).

## Verification (executed 2026-11-25)

- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — exit `0` (`277` tests across `51` suites: `277` pass, `0` fail, `0` skipped; all 4 version locations synced to `0.4.0`; `bmad-companion v0.5.4`, `vibe-debrief v0.4.0`, `project-colors v0.1.0` validated).
