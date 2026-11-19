---
type: epic
title: Two-stage concept deep dive, fallback HTML & v0.4.0 release
parent: initiative-vibe-debrief
covers: [R18]
sources:
  - _bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
after: [epic-test-suite, epic-panel-a11y, epic-cockpit-contract, epic-cockpit-hud-core]
refined: true
risk: high
---

# Two-stage concept deep dive, fallback HTML & v0.4.0 release

## Description

Builds on Epic 1's `node:test` verification suite, Epic 4's `scripts/check-version-sync.mjs`, Epic 5's `installedVisualPlugins` discovery and `{ conceptSlug, targetPlugin }` `export_html` contract, and Epic 6's 1-strip Cockpit HUD layout, `microBlocks` renderer, and shared HTML export template. Implements clickable `concept-pill`s opening `< 100ms` inline `stage1-drawer` (`STE-80` definition, analogy, `104px` micro-visual), Stage 2 `Deep Dive & Pop Out` routing installed plugins (`excalidraw`, `visualize`, `vectorcraft`, `designcraft`) via `ui/message` or automatically invoking `vibe_debrief_export_html` to render the 3-column Stage 2 HTML fallback + persistent `missing-banner` with an `Install <plugin>` trigger, and closes Wave 2 by verifying `UJ-1`–`UJ-4` end-to-end and stamping `v0.4.0` across all four version locations.

## Outcome

Visual learners grasp unfamiliar concepts inside the sidebar in `< 100ms` and escalate seamlessly to main-stage visual plugins — or to an instant 3-column built-in HTML explainer when plugins are absent — with `v0.4.0` verified green across all four version files.

## Requirements

1. **R1 (parent R18)**: Clicking any `concept-pill` (`<= 6` per turn) opens `stage1-drawer` inline in `< 100ms` with zero MCP/external plugin calls, displaying `target-tag`, `STE-80` definition in `state.language`, left-accented analogy card, `104px` micro-canvas/3-node SVG (`loop-3node`, `pipeline-3node`, `split-compare`) across Dark HUD and Field Desk Light, and `Deep Dive & Pop Out ↗` CTA, collapsing on re-click or `Escape` and preserving `activeConceptSlug` across same-turn re-renders.
2. **R2 (parent R18)**: Clicking `Deep Dive & Pop Out ↗` in `stage1-drawer` or external plugin buttons in `powerup-dock` (`conceptSlug: null`) checks `panelState.installedVisualPlugins`; when installed, the panel dispatches a structured `ui/message` carrying serialized `diagramSpec`, `stage2` summary, and `stage2Prompt` to the host and shows `hud-toast` (`"Sent to <Plugin>"`).
3. **R3 (parent R18)**: When the target plugin is absent/unavailable, the panel sets transient `missingPluginFallback` and calls `vibe_debrief_export_html` (`{ conceptSlug, targetPlugin }`); `generateStandaloneHtmlArtifact` renders the `stage2-popout` 3-column deep explanation grid (`How It Works`, `Key Trade-off`, `In Your Codebase` — populated from the matched concept's `stage2` or, when `conceptSlug` is `null`, synthesized from the debrief's plan/result/consequences summary), floating telemetry pill, and `missing-banner`; and the panel displays `missing-banner` with the clickable artifact link and 1-click `Install <plugin>` `ui/message` CTA, persisting across accompanying `tool-result` pushes (`AD-10`, `AD-17`).
4. **R4 (parent R18)**: End-to-end `node:test` verification covers `UJ-1`–`UJ-4` and `v0.2.0`/`v0.3.0` snapshot backward-compatibility, and Wave 2 stamps `0.4.0` atomically across `.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs`, `assets/panel.html`, and `scripts/hook-runner.mjs`, passing `scripts/check-version-sync.mjs` and `node --test tests/`.

## Constraints

- **C1–C10** (parent `C1`–`C10`): Zero external dependencies, `unsafeEval: false` and `escapeHtml()` / `\u003c` safety, zero pan/zoom or full whiteboard editing inside the `320–460px` sidebar (`C10`), cross-plugin triggers routed solely via `ui/message` (`AD-9`, `AD-17`), and 4-file version sync enforced by `scripts/check-version-sync.mjs` (`C4`).

## Done when

1. Clicking a `concept-pill` opens `stage1-drawer` in `< 100ms` with zero RPC calls and renders its `104px` micro-visual across Dark HUD and Field Desk Light.
2. Stage 2 Pop-Out dispatches `ui/message` for installed plugins and, for any missing plugin, generates the 3-column Stage 2 standalone HTML artifact and keeps `missing-banner` visible across `tool-result` state pushes.
3. End-to-end `node --test tests/` and `node scripts/check-version-sync.mjs` run green with all four version locations stamped `0.4.0`.

## Boundaries

- Belongs to siblings: Wave 1 hardening (`epic-test-suite`, `epic-atomic-state`, `epic-theme-parity`, `epic-panel-a11y`), `OQ-5` backend/discovery/export-param contract (`epic-cockpit-contract`), and Cockpit HUD shell / Radar / X-Ray / 5-grammar SVG (`epic-cockpit-hud-core`).
- Out: `COULD` scope items (`Sprint Reel Deck Export`, `Compare Exhibits History Diff`, `Visual Memory Thumbnails`) and `WON'T` items (`Full Inline Whiteboard Editor in 360px Panel`, `3D Blender Spatial Scene Bridge`).
- Touch points owned: Stage 2 `ui/message` delegation to external visual plugins (`excalidraw`, `visualize`, `vectorcraft`, `designcraft`) and `Install <plugin>` chat suggestions.

## References

- parent — `_bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md`, Requirements `R18`, Constraints `C1`–`C10`
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md`, `AD-5`, `AD-6`, `AD-8`, `AD-9`, `AD-10`, `AD-17`
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md`, `concept-pill`, `stage1-drawer`, `stage2-popout`, `missing-banner`
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md`, Component Patterns, State Patterns, `UJ-2`

## Notes

- Risk reason (`high`): Owns the mandatory missing-plugin Stage 2 HTML fallback (`AD-17`), transient `missing-banner` survival across `tool-result` notifications (`AD-10`), and the final `v0.4.0` 4-file release stamp (`AD-8`).
- High-risk check beyond criteria: Run a simulated Stage 2 missing-plugin flow where `vibe_debrief_export_html` triggers an immediate `ui/notifications/tool-result` push and confirm `missing-banner` remains visible with a valid clickable artifact path, plus verify `v0.2.0`/`v0.3.0` snapshots and `scripts/check-version-sync.mjs` against `0.4.0`.
- Decision: 2026-11-19 — Tracer bullet is Story 1 (`Concept pills & <100ms Stage 1 inline micro-drawer tracer`), proving zero-RPC inline Stage 1 rendering inside `microBlocks`; stories serialize cleanly (`7.1 -> 7.2 -> 7.3 -> 7.4 -> 7.5`) after Epic 6's refactor sweep (`6.7`).
- Waits on epic-test-suite because: runs the end-to-end `node:test` verification suite.
- Waits on epic-panel-a11y because: uses `scripts/check-version-sync.mjs` for the `v0.4.0` 4-file stamp and preserves ARIA/keyboard behavior in `stage1-drawer` and `missing-banner`.
- Waits on epic-cockpit-contract because: consumes `installedVisualPlugins` discovery and `{ conceptSlug, targetPlugin }` `vibe_debrief_export_html` support.
- Waits on epic-cockpit-hud-core because: builds into the 1-strip Cockpit HUD `microBlocks` slot, `powerup-dock`, and shared HTML export template after `6.7`.
- Layer files: `assets/panel.html`, `scripts/debrief-engine.mjs`, `.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs`, `scripts/hook-runner.mjs`, `tests/`.
