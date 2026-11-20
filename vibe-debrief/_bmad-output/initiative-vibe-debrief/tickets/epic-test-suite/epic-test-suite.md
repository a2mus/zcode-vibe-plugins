---
type: epic
status: done
title: Zero-dependency test suite
parent: initiative-vibe-debrief
covers: [R8]
sources:
  - _bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
companions:
  - _bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md
after: []
refined: true
risk: medium
---

# Zero-dependency test suite

## Description

Delivers a zero-dependency `node:test` verification suite and shared temp-workspace and spawned-process helpers so `node --test tests/` runs green on Node >= 20 with one command and replaces the manual smoke checklist for Core Engine priority exports (`R1`–`R7` regression floor) and MCP/Hook transport gates (`R8`). Hands off the spawned-process harness and temp-workspace fixtures to Epics 2–7, and the diagram and HTML export regression tests to Epic 3.

## Outcome

Contributors and release gates run `node --test tests/` in one command to catch regressions in engine logic, state persistence, standalone HTML exports, ZCode Memory writes, and stdio/hook isolation before any edit ships.

## Requirements

1. **R1 (parent R8)**: Core Engine pure-transform unit tests verify `applySte100Polish`, `computeSte100Metrics`, `classifyFileRole`, `assessWorkflowComplexity`, `buildExplainerScenesIfComplex` (returning `[]` for `"simple"` turns and 4 scenes for `"complex"` turns), `buildPlainTextScript`, `buildDefaultDiagram` (6-node cap, sequential edge synthesis, touched-file node synthesis), `buildDefaultVerificationData`, `detectResponseType`, and `synthesizeHeuristicDebrief` directly without `stdin`/`stdout` transport setup.
2. **R2 (parent R8)**: Hermetic filesystem, export, and discovery unit tests verify `loadPersistedState` / `savePersistedState` (welcome-seed on missing/corrupt state, bounded `history <= 15` / `recentTouchedFiles <= 15` / `confirmedLessons <= 50`), `generateStandaloneHtmlArtifact` / `saveStandaloneHtmlArtifact` (`escapeHtml()` on dynamic strings, `\u003c` embedded JSON escaping, `ZCODE_VISUALIZATION_DIR` override), `confirmAndSaveLessonToZCodeMemory` (`<slug>.md` YAML frontmatter + idempotent `MEMORY.md` pointer update under an isolated temp home/memory root with workspace `.zcode/memory/` fallback), and `discoverLightweightGeminiModels` against fixture config directories.
3. **R3 (parent R8)**: Spawned-process transport tests verify MCP server line-delimited JSON-RPC 2.0 over stdio (`initialize`, `ping`, `tools/list` for all 8 tools, `resources/list`, `resources/templates/list`, `resources/read` serving `ui://vibe-debrief/panel.html` with `text/html;profile=mcp-app` and `_meta["zcode/csp"].unsafeEval: false`, and `tools/call` round-trips) and hook runner single-line JSON `stdout` isolation across all 4 lifecycle modes (`session-start`, `user-prompt` including `[Vibe Debrief — Deep Refresh]`, `post-tool`, and `stop` including `agentPublishedThisTurn` preservation and optional OpenAI-compatible AI synthesis fallback).

## Constraints

- **C1–C3, C5, C7** (parent `C1`–`C3`, `C5`, `C7`): Zero external dependencies (`node:test`, `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path` only; no `package.json` or `node_modules`), strict 4-layer separation and `stdout` isolation, XSS/CSP escaping assertions, and hermetic temp directories that never mutate the developer's live `~/.zcode/cli/memories/`.

## Done when

1. `node --test tests/` runs green with one command on Node >= 20 using only `node:` built-ins (no `package.json` or `node_modules`).
2. Engine unit tests cover `applySte100Polish`, `computeSte100Metrics`, `assessWorkflowComplexity`, `buildExplainerScenesIfComplex`, `buildDefaultDiagram`, `classifyFileRole`, `generateStandaloneHtmlArtifact`, `confirmAndSaveLessonToZCodeMemory`, and `discoverLightweightGeminiModels` against isolated temp directories.
3. Transport tests verify MCP stdio handshake (`initialize`, `tools/list`, `resources/list`, `resources/read` with `unsafeEval: false`, `tools/call`) and hook runner single-line `stdout` isolation across all 4 hook modes.

## Boundaries

- Belongs to siblings: atomic `savePersistedState` race hardening (`epic-atomic-state`), theme-token parity (`epic-theme-parity`), ARIA/keyboard & `check-version-sync.mjs` (`epic-panel-a11y`), and `v0.4.0` Cockpit HUD work (`epic-cockpit-contract`, `epic-cockpit-hud-core`, `epic-concept-deep-dive`).
- Touch points owned: `~/.zcode/cli/memories/` persistence tests (via isolated `ZCODE_HOME_DIR` temp override), `~/.zcode/v2/` read-only model discovery tests, and optional OpenAI-compatible `Stop` fallback regression tests.

## References

- parent — `_bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md`, Requirements `R8` & `R1`–`R7`, Constraints `C1`–`C3`, `C5`, `C7`
- architecture — `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md`, `AD-1`–`AD-6`, `AD-11`–`AD-13`, Consistency Conventions (Verification gate)

## Notes

- Risk reason (`medium`): Establishes the hermetic temp-workspace and spawned-process stdio verification harness that gates all Wave 1 and Wave 2 releases without polluting `~/.zcode`.
- Decision: 2026-11-19 — Tracer bullet is Story 1 (`node:test harness, temp-workspace fixtures & STE-80/diagram engine tracer`), standing up shared test helpers (temp workspace, `ZCODE_HOME_DIR` override support, and spawned-process stdio helpers) plus the pure-engine assertions; Stories 1–4 serialize cleanly (`1.1 -> 1.2 -> 1.3 -> 1.4`) closing with `Refactor sweep` (`1.4`).
- Layer files: `tests/helpers.mjs`, `tests/debrief-engine.test.mjs`, `tests/transports-and-sync.test.mjs`, `scripts/debrief-engine.mjs` (optional `ZCODE_HOME_DIR` env override for hermetic home-directory tests).
