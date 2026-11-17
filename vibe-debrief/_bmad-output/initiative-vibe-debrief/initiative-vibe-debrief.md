---
type: initiative
title: vibe-debrief
parent: none
sources:
  - _bmad-output/planning-artifacts/prd-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
risk: medium
---

# vibe-debrief

## Description

Vibe Debrief turns ZCode's right-side panel into a fast comprehension cockpit: each agent turn distills into STE-80 prose, an always-on interactive SVG diagram, fused proof/uncertainty/checklist oversight, an optional standalone HTML export, a complexity-gated Canvas explainer, and one-click `MEMORY.md` persistence. The v0.2.0 baseline (R1–R7) is shipped; the remaining work is the v0.3.0 hardening wave the architecture spine deferred: a zero-dependency test suite (OQ-2), atomic state writes (AD-5), light-theme SVG/Canvas parity, and ARIA/keyboard support. Derived from the PRD and the architecture spine; both are sources of this ticket.

## Outcome

Multi-project vibe-coders audit each turn's impact in under a minute with confidence that the plugin itself is regression-tested, theme-correct, and keyboard-accessible — the PRD's own measure being `SM-1`–`SM-5`, gated in v0.3.0 by the validation signal in OQ-1.

## Requirements

1. **R1** (prd FR-1–FR-8a): The 8-tool MCP surface and right-side panel work over stdio JSON-RPC 2.0; tools return structured content and the panel renders Bug vs. Implementation views, diagram, node inspector, explainer, memory and history tabs.
2. **R2** (prd FR-9–FR-13): The four lifecycle hooks keep the panel current each turn — SessionStart context banner, UserPromptSubmit reset plus Deep Refresh delegation, PostToolUse file tracking, Stop preservation or heuristic/AI fallback — without corrupting stdout.
3. **R3** (prd FR-14–FR-17): Published prose meets STE-80 clarity with score, grade and metrics; four personas shape tone; Bug and Implementation turns render distinct 4-card views with shared Lessons.
4. **R4** (prd FR-18–FR-21): Every debrief carries an interactive SVG diagram (max 6 real-named nodes, numbered edges) with file role and risk, node inspector, and fused proof, uncertainty and checklist oversight promotable to lessons.
5. **R5** (prd FR-22–FR-24): The Canvas explainer appears only on complex turns (score >= 4 or explicit override) with player controls, narration and a plain-text verification script.
6. **R6** (prd FR-25–FR-26): Any debrief exports to a self-contained offline `.html` artifact at the configured path with safe escaping.
7. **R7** (prd FR-27–FR-28): Confirmed lessons persist as slug `.md` plus `MEMORY.md` under ZCode memory with workspace fallback, and state stays bounded (history 15, touched files 15, lessons 50).
8. **R8** (prd OQ-2; spine Deferred OQ-2): A zero-dependency `node:test` suite verifies the engine priority exports (STE-80, complexity gate, diagram synthesis, escaping, classification, lesson persistence) and the transport gates (MCP handshake, hook single-line stdout) with one command.
9. **R9** (spine AD-5 hardening): Concurrent MCP and Hook processes never leave a torn or partially written `vibe-debrief-state.json`; a write lands whole or leaves the previous state intact.
10. **R10** (spine Deferred light-theme; ux DESIGN): Panel SVG diagram, Canvas explainer and the standalone HTML export render correctly in both light and dark themes from one shared theme-token contract.
11. **R11** (spine Deferred ARIA; ux EXPERIENCE): The panel is fully operable by keyboard (focus order, Enter and Space activation, visible focus) and announces state changes to assistive technology, honoring `prefers-reduced-motion`.

R1–R7 are delivered in v0.2.0 and are the regression scope the test suite protects; R8–R11 are the v0.3.0 delta the epics deliver.

## Constraints

- **C1** (prd RULE-2; spine AD-4): Zero external dependencies — tests use `node:test` only, no `package.json` or npm packages; panel and exports stay fully self-contained.
- **C2** (prd RULE-4; spine AD-2, AD-3): Layer separation and stdout isolation hold — tests exercise the engine without stdin/stdout transports, MCP stdout stays JSON-RPC only, hook stdout stays one JSON line, engine never touches stdin/stdout.
- **C3** (prd RULE-3; spine AD-6): CSP and XSS safety hold — no `eval`, `new Function` or inline `onclick` introduced; dynamic strings stay `escapeHtml`-escaped.
- **C4** (prd RULE-5; spine AD-8): Version bumps update all four files together (`plugin.json`, `serverInfo`, `appInfo`, hook banner).
- **C5** (prd Quality, Verification Gate): Every `.mjs` edit passes `node --check`, MCP handshake and hook smoke test; v0.3.0 automates these in the suite per R8.
- **C6** (prd SM-1; spine AD-11): Stop-hook heuristic latency stays at or under 50ms — atomic writes must not regress it.
- **C7** (prd FR-28; spine AD-5): Bounded collections (15/15/50), welcome-seed on missing state and read-only write fallback behavior are preserved.

## Done when

1. `node --test tests/` runs green with one command on Node >= 20 and is the recorded verification gate, replacing the manual smoke checklist.
2. Concurrent MCP and Hook invocations on one workspace never produce a corrupt or partial state file, proven by a race test in the suite.
3. A light-theme host shows a fully legible panel (SVG and Canvas) and a light-theme export reads correctly; dark theme is unchanged.
4. The panel is operable end-to-end by keyboard alone and a screen reader announces tab changes and debrief updates.
5. The plugin releases as v0.3.0 with all four version locations synced, checked by the version-sync script.

## Boundaries

- Out: cross-turn architecture diff maps and live CI calibration, team onboarding handbooks (prd MVP scope, v0.3.0+), inline diff editing and in-panel multi-turn chat (prd non-goals), lockfile-based write coordination, CI/CD pipelines and hosted telemetry (spine Deferred deployment).
- Touch point: `~/.zcode/cli/memories/` and workspace memory dirs — read/written only via Engine; owner: epic-test-suite (persistence tests).
- Touch point: `~/.zcode/v2/` provider configs — read-only input to model discovery tests; owner: epic-test-suite.
- Touch point: ZCode host theme context (`host-context-changed`, init `hostContext`) — consumed, never set, by the panel; owner: epic-theme-parity.
- Tracer path: test harness proves engine testability (epic-test-suite) → hardened state writes land under its protection (epic-atomic-state) → one theme-token contract spans panel and export (epic-theme-parity) → keyboard/AT panel plus the v0.3.0 stamp (epic-panel-a11y).

## References

- prd — `_bmad-output/planning-artifacts/prd-vibe-debrief.md` (Features and requirements; Rules; Quality and constraints; MVP scope; Open questions)
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md` (AD-1–AD-13; Consistency Conventions; Deferred)
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md` (theme tokens; light/dark assumptions)
- design — `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md` (interaction and accessibility assumptions)

## Notes

- Assumption: Dev and host machines run Node >= 20 so `node:test` is stable (session env runs v26.12.1); suite targets Node >= 20.
- Assumption: Atomic write mechanism is temp file plus `renameSync` with last-writer-wins semantics and no lockfile; settles at Epic 2 refinement.
- Assumption: Standalone export theming follows `prefers-color-scheme` with both palettes embedded and no user-facing toggle; settles at Epic 3 refinement.
- Open question: OQ-1 (prd) — primary v0.3.0 validation signal; owner is the Product Owner, gates SM-4/SM-5 measurement only, does not block these epics; PO pick is checklist interaction rate.
- Open question: OQ-4 (prd) — fold `scripts/check-version-sync.mjs` into the v0.3.0 release story in the closing epic; PO pick is yes.
- Decision: 2026-11-17 — v0.3.0 scope is the four spine Deferred hardening areas (test suite OQ-2, atomic state writes AD-5, light-theme parity, ARIA/keyboard); cross-turn diff maps, live CI calibration and onboarding handbooks stay out (user request).
- Decision: 2026-11-17 — OQ-2 resolved: zero-dependency `node:test` suite adopted (session memory confirmed by spine Stack row).
- Decision: 2026-11-17 — OQ-3 resolved: keep Stop hook AI synthesis alongside CreateSession delegation (session memory confirmed by spine Deferred row).
