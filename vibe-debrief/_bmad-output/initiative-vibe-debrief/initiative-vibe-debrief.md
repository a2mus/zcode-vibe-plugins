---
type: initiative
title: vibe-debrief
parent: none
sources:
  - _bmad-output/planning-artifacts/prd-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md
  - _bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md
risk: medium
---

# vibe-debrief

## Description

Vibe Debrief turns ZCode's right-side panel into a 10-second developer comprehension cockpit: each agent turn distills into `STE-80` prose in the active project/conversation language, an interactive multi-grammar SVG diagram, fused proof/uncertainty/checklist oversight, standalone HTML export, Canvas walkthroughs, and one-click `MEMORY.md` persistence. The `v0.2.0` baseline (`R1`–`R7`) is shipped. The remaining work runs in two sequential waves governed by `AD-1`–`AD-17`: Wave 1 (`v0.3.0` hardening, `R8`–`R12`) delivers a zero-dependency `node:test` suite, atomic state writes, Dark HUD / Field Desk Light parity, ARIA/keyboard accessibility, and automated 4-file version sync; Wave 2 (`v0.4.0` Cockpit HUD vNext, `R13`–`R18`) delivers the additive `OQ-5` schema contract, 1-strip header, `10s Radar` (`What Just Happened` + 5-state `Waiting On You`), `< 16ms` client-side `X-Ray`, composable `microBlocks`, 5-grammar inline SVG, Anytime Curator Tour + Tiny-Turn Minimal Mode, model-agnostic `Clarify`, and Two-Stage Concept Deep Dive with mandatory HTML fallback.

## Outcome

Multi-project vibe-coders audit any turn's impact in 10 seconds (full verification under 60 seconds) with zero-cost deterministic defaults, honest low-confidence fallbacks, regression-tested persistence/transports, light/dark parity, and keyboard operability — measured by `SM-1`–`SM-5`, `v0.3.0` checklist interaction rate (`OQ-1`), and the `EXPERIENCE.md` scan/fallback bars.

## Requirements

1. **R1** (prd FR-1–FR-8a): The 8-tool MCP surface and right-side panel work over stdio JSON-RPC 2.0; tools return structured content and the panel renders Bug vs. Implementation views, diagram, node inspector, explainer, memory and history tabs.
2. **R2** (prd FR-9–FR-13): The four lifecycle hooks keep the panel current each turn — SessionStart context banner, UserPromptSubmit reset plus Deep Refresh delegation, PostToolUse file tracking, Stop preservation or heuristic/AI fallback — without corrupting stdout.
3. **R3** (prd FR-14–FR-17): Published prose meets STE-80 clarity with score, grade and metrics; four personas shape tone; Bug and Implementation turns render distinct 4-card views with shared Lessons.
4. **R4** (prd FR-18–FR-21): Every debrief carries an interactive SVG diagram (max 6 real-named nodes, numbered edges) with file role and risk, node inspector, and fused proof, uncertainty and checklist oversight promotable to lessons.
5. **R5** (prd FR-22–FR-24): The Canvas explainer appears only on complex turns (score >= 4 or explicit override) with player controls, narration and a plain-text verification script.
6. **R6** (prd FR-25–FR-26): Any debrief exports to a self-contained offline `.html` artifact at the configured path with safe escaping.
7. **R7** (prd FR-27–FR-28): Confirmed lessons persist as slug `.md` plus `MEMORY.md` under ZCode memory with workspace fallback, and state stays bounded (history 15, touched files 15, lessons 50).
8. **R8** (prd OQ-2; spine AD-1, AD-2, AD-4): A zero-dependency `node:test` suite verifies the engine priority exports (STE-80, complexity gate, diagram synthesis, escaping, classification, lesson persistence) and the transport gates (MCP handshake, hook single-line stdout) with one command.
9. **R9** (spine AD-5): Concurrent MCP and Hook processes never leave a torn or partially written `vibe-debrief-state.json`; a write lands whole or leaves the previous state intact.
10. **R10** (spine AD-6; ux DESIGN Colors): Panel SVG diagram, Canvas explainer and the standalone HTML export render correctly in both light and dark themes from one shared theme-token contract.
11. **R11** (spine AD-10; ux EXPERIENCE Accessibility Floor): The panel is fully operable by keyboard (focus order, Enter and Space activation, visible focus) and announces state changes to assistive technology, honoring `prefers-reduced-motion`.
12. **R12** (prd RULE-5, OQ-4; spine AD-8): v0.3.0 ships with all four version locations synced, checked by a zero-dependency `scripts/check-version-sync.mjs` wired into the suite.
13. **R13** (spine AD-5, AD-15, OQ-5; ux DESIGN, EXPERIENCE): Additive `v0.4.0` `OQ-5` schema enrichment (`ensureDebriefEnriched`) populates `verdict`, `waitingOnYou`, `choices`, `xray`, `diagramSpec`, `microBlocks`, `concepts`, `minimalMode`, `heuristicConfidence`, and `rawQuote` while keeping `v0.2.0`/`v0.3.0` snapshots valid, adds `discoverInstalledVisualPlugins`, and widens `vibe_debrief_publish`, `vibe_debrief_set_persona`, and `vibe_debrief_export_html` (`{ conceptSlug, targetPlugin }`) MCP schemas with bounded caps (`history` <= 15, `recentTouchedFiles` <= 15, `confirmedLessons` <= 50, `diagramSpec.nodes` <= 6, `concepts` <= 6, `waitingOnYou.chips` <= 4).
14. **R14** (spine AD-6, AD-9, AD-10, AD-16; ux DESIGN, EXPERIENCE): The panel renders a 1-strip header (`Distill`, `xray-toggle`, `gear-popover` persisting `persona`, `responseType`, `ste100Enabled`, `language`, `preferredModel`, `themePreference`, and `view-switcher`), a `10s Radar` card (`verdict`, <= 14-word headline, verification counts, and 5-state `waitingOnYou` chips + `inline-reply-box` dispatching via `ui/message`), composable `microBlocks` (`unclear`, `choices`, `diagram`, `proof-audit`, `concepts`, `lessons`), and `< 16ms` client-side `X-Ray` (`Plain` `STE-80` in `state.language` <-> `Tech`) with zero LLM calls and preserved transient UI state across same-turn updates.
15. **R15** (spine AD-6, AD-14; ux DESIGN, EXPERIENCE): A declarative 5-grammar `diagramSpec` (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`; `viewBoxWidth: 460`, <= 6 primary nodes, numbered edges without cross-lane corruption in `before-after`) renders as pure inline SVG with kinetic `.dash-flow` motion across both `panel.html` (`svg-stage`) and standalone HTML exports (`generateStandaloneHtmlArtifact`).
16. **R16** (spine AD-12; ux EXPERIENCE): Anytime Curator Tour and Tiny-Turn Minimal Mode unlock `Visual` (`explainer-stage`) and `[Animate]` in `powerup-dock` on every non-minimal turn (highlighting `[Animate]` when `complexity.level === "complex"`) and collapse trivial high-confidence turns (`<= 1` low-risk file, `score <= 1`, `waitingOnYou.state === "none"`, `choices.length === 0`, `heuristicConfidence >= 0.55`) into a 1-line `minimal-strip` with `Expand`, while keeping `buildExplainerScenesIfComplex` returning `[]` for `"simple"` turns.
17. **R17** (spine AD-5, AD-13; ux EXPERIENCE): Model-agnostic cost-aware discovery (`discoverCheapestEnabledModels`, retaining `discoverLightweightGeminiModels` as a backward-compatible alias) ranks enabled provider models with `"active-session"` fallback, and low-confidence heuristic `Stop` turns (`heuristicConfidence < 0.55`) render `unclear-box` (`rawQuote` <= 280 chars, `Show Raw Reply`, `Clarify (Fast / Cheapest Model)`) injecting Reading-Boundary `UserPromptSubmit` delegation without hardcoding a single model ID.
18. **R18** (spine AD-5, AD-6, AD-8, AD-17; ux DESIGN, EXPERIENCE): Two-Stage Concept Deep Dive (`concepts` <= 6 per turn) opens `stage1-drawer` (`STE-80` definition, analogy, `104px` micro-visual) inline in `< 100ms` with zero external calls; `Deep Dive & Pop Out` inspects `installedVisualPlugins` (`excalidraw`, `visualize`, `vectorcraft`, `designcraft`) to either dispatch a `ui/message` spec to the installed plugin or automatically trigger `vibe_debrief_export_html` (`{ conceptSlug, targetPlugin }`) rendering the 3-column Stage 2 HTML fallback + persistent `missing-banner` with an `Install <plugin>` trigger; and Wave 2 closes by stamping `v0.4.0` across all four version locations verified by `scripts/check-version-sync.mjs`.

`R1`–`R7` are delivered in `v0.2.0` and form the regression subset protected by Epic 1. `R8`–`R12` form the Wave 1 `v0.3.0` hardening delta (Epics 1–4). `R13`–`R18` form the Wave 2 `v0.4.0` Cockpit HUD vNext delta (Epics 5–7).

## Constraints

- **C1** (prd RULE-2; spine AD-4): Zero external dependencies — tests use `node:test` only, no `package.json` or npm packages; panel and exports stay fully self-contained.
- **C2** (prd RULE-4; spine AD-2, AD-3): Layer separation and stdout isolation hold — tests exercise the engine without stdin/stdout transports, MCP stdout stays JSON-RPC only, hook stdout stays one JSON line, engine never touches stdin/stdout.
- **C3** (prd RULE-3; spine AD-6): CSP and XSS safety hold — no `eval`, `new Function` or inline `onclick` introduced; dynamic strings stay `escapeHtml`-escaped.
- **C4** (prd RULE-5; spine AD-8): Version bumps (`v0.3.0` and `v0.4.0`) update all four files together (`plugin.json`, `serverInfo`, `appInfo`, hook banner) and pass `scripts/check-version-sync.mjs`.
- **C5** (prd Quality, Verification Gate): Every `.mjs` edit passes `node --check`, MCP handshake and hook smoke test; `v0.3.0` automates these in `node --test tests/` per `R8`.
- **C6** (prd SM-1; spine AD-11): Stop-hook heuristic latency stays at or under 50ms (`< 20ms` nominal) — atomic writes and `OQ-5` enrichment must not regress it.
- **C7** (prd FR-28; spine AD-5): Bounded collections (`history` 15 / `recentTouchedFiles` 15 / `confirmedLessons` 50 / `nodes` 6 / `concepts` 6 / `chips` 4), welcome-seed on missing state, and read-only write fallback behavior are preserved.
- **C8** (spine AD-7): Plain `STE-80` prose uses `state.language` while code identifiers, file paths, and CLI flags remain untranslated/unmutated inside `.sym` and `xray.tech`; `xray.plain` and `xray.tech` store raw unescaped text wrapped after `escapeHtml`.
- **C9** (spine AD-7; prd FR-21): Strict proof discipline — unrun tests are banned from `verified` (`ok` pill) and must land in `uncertaintyAudit` or `unverified` (`risk` pill).
- **C10** (spine AD-9, AD-17; ux EXPERIENCE): Zero pan/zoom canvas, in-panel multi-turn chat, inline whiteboard editor, or inline diff editor inside the `320–460px` sidebar; all cross-plugin handoffs and quick replies route exclusively via `postMessage` (`ui/message` or Vibe Debrief's `tools/call`).

## Done when

1. `node --test tests/` runs green with one command on Node >= 20 and is the recorded verification gate, replacing the manual smoke checklist.
2. Concurrent MCP and Hook invocations on one workspace never produce a corrupt or partial state file, proven by a race test in the suite.
3. A light-theme host shows a fully legible panel (SVG and Canvas) and a light-theme export reads correctly; dark theme is unchanged.
4. The panel is operable end-to-end by keyboard alone and a screen reader announces tab changes and debrief updates.
5. The plugin ships Wave 1 as `v0.3.0` with all four version locations synced, checked by `scripts/check-version-sync.mjs`.
6. `v0.2.0`/`v0.3.0` state snapshots upgrade seamlessly via `ensureDebriefEnriched` and all `node --test tests/` unit, atomic-state, and transport checks pass against the widened `OQ-5` schemas.
7. The panel renders the 1-strip header, `10s Radar`, `< 16ms` `X-Ray`, composable `microBlocks`, 5-grammar inline `svg-stage`, Anytime `Visual` tour, `minimal-strip`, and `unclear-box` with model-agnostic `Clarify` across Dark HUD and Field Desk Light.
8. Stage 1 `concept-pill` drawers open in `< 100ms`, Stage 2 pop-out routes installed plugins via `ui/message` and falls back to the 3-column standalone HTML + persistent `missing-banner` when absent, and Wave 2 ships as `v0.4.0` with all four version locations synced and `node --test tests/` green.

## Boundaries

- Out: `COULD` scope items (`Sprint Reel Deck Export`, `Compare Exhibits History Diff`, `Visual Memory Thumbnails`) per `architecture Deferred`, `WON'T` items (`Full Inline Whiteboard Editor in 360px Panel`, `3D Blender Spatial Scene Bridge`), cross-turn architecture diff maps and live CI calibration, team onboarding handbooks, inline diff editing, in-panel multi-turn chat, lockfile-based write coordination, CI/CD pipelines, and hosted telemetry.
- Touch point: `~/.zcode/cli/memories/` and workspace memory dirs — read/written only via Engine; owner: `epic-test-suite` (persistence tests) and `epic-cockpit-contract` (`OQ-5` regression).
- Touch point: `~/.zcode/v2/` provider configs — read-only input to `discoverCheapestEnabledModels` (`discoverLightweightGeminiModels` alias); owner: `epic-test-suite` and `epic-cockpit-contract`.
- Touch point: `~/.zcode/cli/plugins/`, `.mcp.json`, and project skills — read-only input to `discoverInstalledVisualPlugins`; owner: `epic-cockpit-contract`.
- Touch point: Optional OpenAI-compatible API (`VIBE_DEBRIEF_OPENAI_KEY` / `OPENAI_API_KEY`, `4500ms` timeout) — optional fallback synthesis in `hook-runner.mjs` `Stop` hook; owner: `epic-test-suite` (regression/fallback coverage).
- Touch point: `commands/` (`/eli5`, `/vibe-debrief`) and `skills/` (`skills/eli5/SKILL.md`, `skills/vibe-debrief/SKILL.md`) — agent guidance for `vibe_debrief_publish`; owner: `epic-cockpit-contract` (optional `OQ-5` publish hints while preserving `v0.2.0` compatibility).
- Touch point: ZCode host theme context (`host-context-changed`, init `hostContext`) — consumed, never set, by the panel; owner: `epic-theme-parity` (and `epic-cockpit-hud-core` for `themePreference` override).
- Touch point: ZCode Host Chat and external visual plugins (`excalidraw`, `visualize`, `vectorcraft`, `designcraft`) — triggered solely via `ui/message` prompts; owner: `epic-cockpit-hud-core` (`Waiting On You` / `Clarify`) and `epic-concept-deep-dive` (Stage 2 Pop-Out).
- Tracer path: `epic-test-suite` (test harness) → `epic-atomic-state` (hardened writes) → `epic-theme-parity` (shared theme tokens) → `epic-panel-a11y` (keyboard/AT + `v0.3.0` stamp) → `epic-cockpit-contract` (`OQ-5` engine/MCP/Hook contract) → `epic-cockpit-hud-core` (1-strip HUD, 10s Radar, X-Ray, 5-grammar SVG & Anytime Tour) → `epic-concept-deep-dive` (Stage 1/2 Concept Deep Dive, fallback HTML & `v0.4.0` stamp).

## References

- prd — `_bmad-output/planning-artifacts/prd-vibe-debrief.md` (Features and requirements; Rules; Quality and constraints; MVP scope; Open questions)
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md` (AD-1–AD-17; Canonical Data Contracts `OQ-5`; Consistency Conventions; Deferred)
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md` (Dark HUD & Field Desk Light tokens; typography; components; contrast floor)
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md` (Information architecture; Component patterns; State patterns; Accessibility floor; Key flows; Open questions)

## Notes

- Assumption: Dev and host machines run Node >= 20 so `node:test` is stable (session env runs v26.12.1); suite targets Node >= 20.
- Assumption: Atomic write mechanism is temp file plus `renameSync` with last-writer-wins semantics and no lockfile; settles at Epic 2 refinement.
- Assumption: Initiative ships as sequential Wave 1 `v0.3.0` hardening (Epics 1–4) followed by Wave 2 `v0.4.0` Cockpit HUD vNext (Epics 5–7) per `architecture Deferred` PO sequencing.
- Assumption: `v0.4.0` Cockpit HUD splits into three epics (`epic-cockpit-contract`, `epic-cockpit-hud-core`, `epic-concept-deep-dive`) after Epics 1–4 so each epic stays <= 10 stories with clean contract boundaries.
- Assumption: Standalone HTML export keeps `@media (prefers-color-scheme: light)` auto-theming while `panel.html` adds `gear-popover` `themePreference` (`"auto"` | `"dark"` | `"light"`) per `AD-6`/`AD-9`.
- Assumption: `commands/` and `skills/` stay backward-compatible via `ensureDebriefEnriched` while `epic-cockpit-contract` updates `skills/vibe-debrief/SKILL.md` and `skills/eli5/SKILL.md` with optional `OQ-5` publish hints.
- Open question: `OQ-1` (prd) — primary `v0.3.0` validation signal; owner is the Product Owner, gates `SM-4`/`SM-5` measurement only, does not block these epics; PO pick is checklist interaction rate.
- Open question: Unvalidated UX assumptions (`EXPERIENCE.md`) — `< 10s` `radar-card` scan speed vs `<= 60s` full audit, `Field Desk Light` eyebrow contrast (`#768396`) under WCAG AA, `Clarify` cheapest-model discovery accuracy across non-Gemini providers, and `Minimal Mode` trigger threshold tuning on hybrid replies.
- Decision: 2026-11-17 — `OQ-4` resolved: `scripts/check-version-sync.mjs` is built in Epic 4, wired into the suite, and recorded as `R12`.
- Decision: 2026-11-17 — No platform-baseline epic: `v0.2.0` already ships the four runtime layers, plugin wiring and UI; the opening epic is the verification harness every later epic waits on.
- Decision: 2026-11-17 — `R1`–`R7` stay the shipped `v0.2.0` baseline and carry no epic; the Epic 1 suite covers the engine, state, transport and export paths beneath them.
- Decision: 2026-11-17 — `OQ-2` resolved: zero-dependency `node:test` suite adopted.
- Decision: 2026-11-17 — `OQ-3` resolved: keep `Stop` hook AI synthesis alongside `CreateSession` delegation.
- Decision: 2026-11-19 — Initiative scope expands beyond `v0.3.0`-only hardening (superseding the `2026-11-17` cap) to cover Wave 1 `v0.3.0` hardening (`R8`–`R12`, Epics 1–4) intact plus Wave 2 `v0.4.0` Cockpit HUD vNext (`R13`–`R18`, Epics 5–7) against `AD-1`–`AD-17`; `COULD` items (`Sprint Reel Deck Export`, `Compare Exhibits History Diff`, `Visual Memory Thumbnails`) remain deferred.
