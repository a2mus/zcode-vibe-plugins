---
title: '1-strip Cockpit HUD header, gear-popover & 10s Radar tracer'
type: feature
ticket: 1
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R1]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/epic-cockpit-hud-core.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 6.1 — 1-Strip Cockpit HUD Header, Gear Popover & 10s Radar Tracer

## Intent

Completes Story 6.1 (`epic-cockpit-hud-core` Story 1, R1, AD-6, AD-9, AD-10, AD-16):
Replaces the stacked multi-row header and 4-tab bar in `assets/panel.html` with the 1-strip `hud-header` (`Distill`, `xray-toggle`, `gear-btn`), floating 6-row `gear-popover`, compact 3-segment `view-switcher` (`HUD` | `Visual` | `Memory & History`), `radar-card` top summary (`verdict`, `<= 14`-word headline, verification counts, `WAITING ON YOU` badge), and panel-owned `uiState` transient preservation across same-turn `renderPanelState` updates, while widening `vibe_debrief_set_persona` in `scripts/mcp-server.mjs` so all `gear-popover` settings persist across reloads. Hands off the 1-strip HUD shell and `renderPanelState` transient hooks to Stories 6.2–6.5 and Epic 7.

## Implementation Details

- `scripts/mcp-server.mjs`:
  - Widened `vibe_debrief_set_persona` `inputSchema` and `handleToolCall` to accept and persist `language`, `preferredModel`, and `themePreference` alongside `persona`, `responseType`, and `ste100Enabled` via `savePersistedState` (`AD-9`).
- `assets/panel.html`:
  - Replaced `.mode-switcher-row`, `.persona-row`, and the 4-tab bar with `.top-bar.hud-header` containing `.hud-header-strip` (`#panelTitle`, `#panelWorkspace`, `#btnDistill`, `#btnXrayToggle`, `#btnGearSettings`) and the 3-segment `.view-switcher` (`#tabBtnHud`, `#tabBtnVisual`, `#tabBtnMemory`).
  - Added the 6-row `#gearPopover` (`role="dialog"`, `aria-hidden`) for `Surface Theme` (`#gearThemeSelect`), `Language` (`#gearLanguageSelect`), `Persona` (`#gearPersonaSelect`), `Clarity Guard` (`#gearSteToggleBtn`), `Model` (`#gearModelSelect`), and `Standalone Export` (`#gearExportHtmlBtn`), with outside-click and `Escape` focus restoration to `#btnGearSettings`.
  - Added `#radarCard` at the top of `#tab-hud` displaying `#radarVerdictPill`, `#radarVerifyCount`, `<= 14`-word `#tldrHeadline` (with C8-safe `<span class="sym">` wrapping in `xrayMode === "tech"`), `#complexityPill`, and `#radarWaitingStrip` (`#waitingBadge` across `choice`/`action`/`reply`/`blocked`/`none` + `#waitingPromptText`).
  - Wired `#btnDistill` to dispatch `[Vibe Debrief — Deep Refresh]` via `ui/message` using `preferredModel`/`recommendedModel` (no hardcoded model name), made `#tab-visual` anytime-accessible with `#visualEmptyPrompt` (`Generate Quick Tour` + `Return to HUD`) when scenes are empty while stopping `<canvas>` playback and cancelling `window.speechSynthesis` on view switches away from `Visual`, combined Memory & History in `#tab-memory`, and centralized transient flags in `uiState` preserved across same-turn `renderPanelState` refreshes (`AD-10`).
- `tests/panel-a11y.test.mjs` & `tests/transports-and-sync.test.mjs`:
  - Updated ARIA/keyboard/a11y assertions for the 1-strip `hud-header`, 3-segment `view-switcher`, `gearPopover`, and `Visual` empty-tour state, and added `Story 6.1` tests covering CSP/DOM safety, `gear-popover` setting persistence across reload, `radar-card`, `Distill` `ui/message` dispatch, `Visual` playback/speech cancellation, same-turn `uiState` preservation, and stdio MCP persistence of `language`, `preferredModel`, and `themePreference`.

## Verification (Executed 2026-11-24)

- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — exits 0 (`202` tests across `36` suites: `202` pass, `0` fail; all 4 version locations synced to `0.3.0`; repo-root validation passed).
- Headless Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe --headless=new`) viewport & persistence check at `320px`, `380px`, and `460px` against `assets/panel.html` + `scripts/mcp-server.mjs`:
  - `320px`: `overflowX: false`, `topBarHeight: 115px`, `radarTop: 127px`, `radarBottom: 532px` (`radarAboveFold: true`).
  - `380px`: `overflowX: false`, `headerStripHeight: 44px`, `topBarHeight: 86px`, `sameRowDistillXrayGear: true`, `radarTop: 98px`, `radarBottom: 459px` (`radarAboveFold: true`).
  - `460px`: `overflowX: false`, `headerStripHeight: 44px`, `topBarHeight: 86px`, `sameRowDistillXrayGear: true`, `radarTop: 98px`, `radarBottom: 420px` (`radarAboveFold: true`).
  - `gear-popover` reload persistence: `themePreference="light"`, `language="fr"` persisted through `vibe_debrief_set_persona` and survived full `Page.reload` (`data-theme="light"`, `gearThemeSelect="light"`, `gearLanguageSelect="fr"`).
