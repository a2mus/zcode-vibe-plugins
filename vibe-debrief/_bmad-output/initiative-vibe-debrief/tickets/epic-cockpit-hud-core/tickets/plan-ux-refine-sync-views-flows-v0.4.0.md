---
title: 'Refine & Synchronize UX Design Specifications for Shipped v0.4.0 Cockpit HUD'
type: ux
ticket: ux-refine-sync-views-flows-v0.4.0
created: '2026-11-25'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R10, R11, R14, R15, R16, R17, R18]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-panel-a11y/tickets/plan-ux-enhance-views-flows-ergonomics.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/tickets/plan-ux-sync-views-flows-consistency.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/tickets/plan-ux-audit-v0.4.0-panel-exports.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/tickets/plan-ux-live-desktop-spot-check-320-460.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/.memlog.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/ux-vibe-debrief.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/mockups/cockpit-hud.html'
---

# BMAD Queue Task #5 — Refine & Synchronize UX Design Specifications

## Intent

Synchronizes `DESIGN.md`, `EXPERIENCE.md`, `ux-vibe-debrief.md`, `.memlog.md`, and `mockups/cockpit-hud.html` with the shipped `v0.4.0` Cockpit HUD & Stage 1/Stage 2 implementation (`assets/panel.html`, `scripts/debrief-engine.mjs`) and prior UX audit/ergonomics/spot-check decisions (`plan-ux-enhance-views-flows-ergonomics.md`, `plan-ux-sync-views-flows-consistency.md`, `plan-ux-audit-v0.4.0-panel-exports.md`, `plan-ux-live-desktop-spot-check-320-460.md`).

## Changes Delivered

- `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md`
  - Updated header/metadata to `updated: 2026-11-25` for shipped `v0.4.0`, aligned `spacing.header-padding` (`8px 12px`) and `spacing.export-canvas-*` (`880×230`), and corrected the `Standalone HTML Export` row in the **6-View Spatial Matrix** from the stale `880×210 viewBox SVG` to the shipped `460px` viewBox 5-grammar SVG + `#fileChips` + `880×230` Canvas tour + `unclear-box` + Stage 2 3-column fallback.
  - Expanded the **Field Desk Light Semantic Wash Rule** in `Colors` to cover every `v0.4.0` panel and export semantic wash selector (`.minimal-badge`, `.unclear-title`, `.missing-artifact-link`, `.lesson-form-title`, `.distill-btn`, `.xray-toggle[data-mode="tech"]`, `.pop-chip[aria-pressed="true"]`, `.view-tab.active`, `.action-chip.primary`/`.selected`, `.proof-pill.ok`/`.risk`, `.powerup-btn.active`/`.complex-pulse`, `.node-inspector code`, `.wait-badge`, `.pill.grammar`, `.missing-banner strong`).
  - Synchronized `Layout & Spacing` and `Components` with the `320–460px` live desktop spot-check guards (`plan-ux-live-desktop-spot-check-320-460.md`): proportional `.view-switcher` columns (`minmax(0, 0.78fr) minmax(0, 0.82fr) minmax(0, 1.4fr)`) + `<= 390px` `auto auto minmax(0, 1fr)` (`4px 6px`, `11px`) and `.view-tab-label` ellipsis on `Memory & History (N)`, `<= 340px` right-aligned `.hud-controls` + `gear-popover` `top: 72px` clearance below wrapped 2-row header, `#memoryDirPathLabel` `overflow-wrap: anywhere`, `.lesson-title-row` `flex-wrap: wrap` + single-line truncated `.pill` slugs, `svg-stage` `2.4px` panel / `2.6px` export hover/focus strokes, `radar-card` meta row + collapsible `analogy-box` + clickable `complexityPill`, `stage1-drawer` `×` close + `overflow-wrap: anywhere`, `missing-banner` clickable artifact link + `×` dismiss, `unclear-box` offline export parity, `explainer-stage`, and `lesson-form`.
- `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md`
  - Synchronized `Information Architecture`, `Cross-View Transitions & Layout Flow`, `Component Patterns`, `State Patterns`, `Accessibility Floor`, `Responsive & Platform`, and `UJ-5` with shipped `v0.4.0` behavior: dual `Visual` empty-tour prompts (`Minimal turn — no tour generated` vs. `No tour generated yet — anytime playback is one click away`), complete cross-turn reset list (`selectedFilePath`, `activeConceptSlug`, `missingPluginFallback`, `expandedProofIds`, `showRawReply`, `minimalModeExpanded`, `selectedWaitingChipId`, `selectedChoiceId`, `playerState`), matched & unmatched file-chip toggle + focus preservation, `concept-pill` toggle focus preservation, bilingual `EN`/`FR` Stage 1 chrome, `Escape` dismissal on `missing-banner`, `#explainerScenePills` keyboard navigation + `tick()` sync in offline HTML exports, `unclear-box` offline export parity, and `320–460px` responsive wrapping/popover/tab-sizing guards.
- `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/ux-vibe-debrief.md` & `.memlog.md`
  - Linked all 6 UX audit/sync/spot-check plans in `Spines & Artifacts`, synchronized the 6-view summary (`HUD`, `Visual`, `Memory & History` wrapping, `Settings & Export` `<= 340px` `gear-popover`, `Stage 2 Pop-Out`, `Standalone HTML Export`), cross-view ergonomic invariants, and Field Desk Light Semantic Wash Rule, and appended decision/finalization entries to `.memlog.md`.
- `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/mockups/cockpit-hud.html`
  - Added `html[data-theme="light"]` `color: var(--text-primary)` overrides for `.wait-badge.reply`, `.wait-badge.blocked`, `.proof-pill.risk`, `.target-tag`, `.missing-copy strong`, and `.gear-popover .mono` so every semantic soft-wash pill in the interactive prototype matches the `>= 13.3:1` light-mode contrast contract.

## Verification (executed 2026-11-25)

- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — exit 0 (`277` tests across `51` suites: `277` pass, `0` fail, `0` skipped; all 4 version locations synced to `0.4.0`; `bmad-companion v0.5.4`, `vibe-debrief v0.4.0`, `project-colors v0.1.0` validated).
