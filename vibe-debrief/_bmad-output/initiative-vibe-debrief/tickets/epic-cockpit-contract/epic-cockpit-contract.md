---
type: epic
title: Cockpit HUD OQ-5 engine, MCP & hook contract
parent: initiative-vibe-debrief
covers: [R13, R17]
sources:
  - _bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
after: [epic-test-suite, epic-atomic-state, epic-theme-parity, epic-panel-a11y]
refined: true
risk: high
---

# Cockpit HUD OQ-5 engine, MCP & hook contract

## Description

Builds on Epic 1's `node:test` harnesses, Epic 2's atomic `savePersistedState` write path, Epic 3's `generateStandaloneHtmlArtifact` baseline, and Epic 4's `v0.3.0` release and `check-version-sync.mjs` baseline. Delivers the additive `v0.4.0` `OQ-5` schema enrichment in the Core Engine, `discoverCheapestEnabledModels` (retaining `discoverLightweightGeminiModels` alias) and `discoverInstalledVisualPlugins`, 5-grammar `diagramSpec` normalization, Anytime explainer + Tiny-Turn Minimal Mode + `heuristicConfidence`/`rawQuote`, widened MCP tool schemas, model-agnostic `Clarify`/`Distill` hook delegation, and optional `OQ-5` hints in skills. Hands off the frozen `OQ-5` payload contract, widened MCP tools, `Clarify` hook wiring, and `installedVisualPlugins`/`export_html` contract to Epics 6 and 7.

## Outcome

Any `v0.2.0`/`v0.3.0` or `v0.4.0` turn produces a valid, bounded, backward-compatible `OQ-5` payload over MCP and lifecycle hooks without breaking `R1`–`R12` or `Stop`-hook `<= 50ms` latency.

## Requirements

1. **R1 (parent R13)**: `ensureDebriefEnriched` upgrades any `v0.2.0`/`v0.3.0` or new debrief with `verdict`, 5-state `waitingOnYou`, `choices`, raw unescaped `xray` (`plain` in `state.language` and `tech` symbols/paths/commands), `microBlocks` ordered IDs, `concepts` (`<= 6`), `minimalMode`, `heuristicConfidence`, and `rawQuote`, keeping legacy `bugReport`/`implementationReport` intact and bounded (`history <= 15`, `recentTouchedFiles <= 15`, `confirmedLessons <= 50`, `diagramSpec.nodes <= 6`, `concepts <= 6`, `waitingOnYou.chips <= 4`).
2. **R2 (parent R13)**: `buildDefaultDiagram` and `diagramSpec` normalization support all 5 grammars (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`; `viewBoxWidth: 460`, `groups`, `nodes <= 6`, `techLabel`, `lane`, `branch`, `animated`), deterministic 4-to-5 mapping, sync-aliasing with `debrief.diagram`, and lane-safe `"before-after"` edge synthesis without cross-lane jumps.
3. **R3 (parent R13)**: `discoverInstalledVisualPlugins` inspects `~/.zcode/cli/plugins/` and `.mcp.json` / project skills to expose `installedVisualPlugins` (`excalidraw`, `visualize`, `vectorcraft`, `designcraft`) in `buildFullPanelState`, while the MCP server widens `vibe_debrief_publish` (`OQ-5` fields), `vibe_debrief_set_persona` (`language`, `preferredModel`, `themePreference`), and `vibe_debrief_export_html` (`conceptSlug`, `targetPlugin`), and the plugin skills document optional `OQ-5` publish hints.
4. **R4 (parent R13)**: `assessWorkflowComplexity` and `buildExplainerScenesIfComplex` continue returning `[]` for `"simple"` turns (`R5`/`R8` preserved), while `ensureDebriefEnriched` populates `explainerScenes` (`< 5ms`) on non-minimal turns and computes `minimalMode: true` only when all four conditions hold: (1) trivial turn (`<= 1` low-risk file, `score <= 1`, short response), (2) `waitingOnYou.state === "none"`, (3) `choices.length === 0`, and (4) `heuristicConfidence >= 0.55`.
5. **R5 (parent R17)**: `discoverCheapestEnabledModels` (keeping `discoverLightweightGeminiModels` as a backward-compatible export alias) ranks fast/cheapest models across all enabled `~/.zcode/v2/` providers with `"active-session"` fallback, `synthesizeHeuristicDebrief` computes `heuristicConfidence` (`0.0–1.0`) and `rawQuote` (`<= 280` chars) within `<= 50ms`, and `UserPromptSubmit` intercepts `[Vibe Debrief — Clarify]` / `[Vibe Debrief — Deep Refresh]` using model-agnostic `CreateSession` / active-session delegation.

## Constraints

- **C1–C9** (parent `C1`–`C9`): Zero external dependencies (`node:` built-ins only), strict 4-layer separation and `stdout` isolation, atomic temp+`renameSync` persistence, `<= 50ms` `Stop`-hook heuristic budget, bounded collections, raw unescaped `xray` strings (`C8`), and strict proof discipline banning unrun tests from `verified` (`C9`).

## Done when

1. `node --test tests/` runs green covering `v0.2.0`/`v0.3.0` state upgrades, 5-grammar `diagramSpec` normalization, `discoverCheapestEnabledModels`, `discoverInstalledVisualPlugins`, `minimalMode` + `heuristicConfidence` gates, and widened MCP/Hook round-trips.
2. `buildExplainerScenesIfComplex` still returns `[]` for `"simple"` turns (`R5`/`R8` preserved) while `Stop`-hook heuristic synthesis remains `<= 50ms` (`C6`).
3. Both `/vibe-debrief` and `/eli5` skill docs carry optional `OQ-5` publish hints while keeping `v0.2.0` compatibility, and `node --check` passes on all backend scripts with zero non-protocol `stdout` leaks.

## Boundaries

- Belongs to siblings: Wave 1 test/state/theme/a11y baseline (`epic-test-suite`, `epic-atomic-state`, `epic-theme-parity`, `epic-panel-a11y`), Cockpit HUD UI & HTML export rendering (`epic-cockpit-hud-core`), and Stage 1/2 Concept Deep Dive UI & `v0.4.0` stamp (`epic-concept-deep-dive`).
- Touch points owned: `~/.zcode/cli/plugins/`, `.mcp.json` & project skills discovery, `~/.zcode/v2/` multi-provider discovery, `~/.zcode/cli/memories/` `OQ-5` regression check, and `skills/vibe-debrief/SKILL.md` / `skills/eli5/SKILL.md` `OQ-5` hints.

## References

- parent — `_bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md`, Requirements `R13` & `R17`, Constraints `C1`–`C9`
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md`, `AD-1`–`AD-5`, `AD-7`, `AD-9`, `AD-11`–`AD-17`, Canonical Data Contracts `OQ-5`
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md`, State Patterns, Open Questions & Unvalidated Assumptions (`OQ-5`)

## Notes

- Risk reason (`high`): Changes core `Stop`-hook synthesis latency (`<= 50ms` budget), `v0.2.0`/`v0.3.0` state backward compatibility, and MCP tool schemas relied on by every downstream HUD story.
- High-risk check beyond criteria: Benchmark `Stop`-hook heuristic synthesis latency (`<= 50ms`) on a multi-file turn payload and verify a `v0.2.0`/`v0.3.0` state snapshot survives an MCP `vibe_debrief_publish` + `Stop`-hook round-trip without dropping legacy `bugReport`/`implementationReport`/`diagram` fields.
- Decision: 2026-11-19 — Tracer bullet is Story 1 (`OQ-5 schema enrichment & publish pass-through tracer`), proving end-to-end Engine -> MCP -> State persistence on the additive `OQ-5` contract; Stories 2–6 serialize cleanly across shared files (`5.1 -> 5.2 -> 5.3 -> 5.4 -> 5.5 -> 5.6`) so no two parallel stories edit `scripts/debrief-engine.mjs` concurrently, closing with `Refactor sweep` (`5.6`).
- Waits on epic-test-suite because: uses the `node:test` engine, MCP, and hook test harnesses.
- Waits on epic-atomic-state because: builds on the atomic `savePersistedState` write path in `scripts/debrief-engine.mjs`.
- Waits on epic-theme-parity because: builds on the updated `generateStandaloneHtmlArtifact` baseline in `scripts/debrief-engine.mjs`.
- Waits on epic-panel-a11y because: builds on the `v0.3.0` release baseline and `scripts/check-version-sync.mjs` gate.
- Layer files: `scripts/debrief-engine.mjs`, `scripts/mcp-server.mjs`, `scripts/hook-runner.mjs`, `skills/vibe-debrief/SKILL.md`, `skills/eli5/SKILL.md`, `tests/`.
