---
type: epic
title: 9-tool MCP contract & clean-session launch
parent: initiative-bmad-companion
covers: [R1, R2, R3, R4, R6, R7, R8]
sources:
  - _bmad-output/initiative-bmad-companion/initiative-bmad-companion.md
companions: []
after: [epic-verification-harness]
refined: true
risk: high
---

# 9-tool MCP contract & clean-session launch

## Description

Builds on Epic 1's MCP stdio harness (`1.2`) to harden the read-only tool contract (`bmad_open_companion` → `bmad_get_state` → `bmad_recommend_next`), advisor `hostModels` sync + `storyOverrides` persistence, clean-session OS automation with clipboard fallback, and workspace-confined artifact inspect/open with live `git diff`. Hands off the frozen `ScanResult`/polling payload contract to Epics 3–5 and the panel to Epic 4.

## Outcome

Alex launches an edited recommendation into a clean ZCode session in one click (<5s, `SM-4`) and Maya inspects an artifact's live diff under strict path confinement, while every recommendation stays a contextual `/bmad-<skill> "<prompt>"` with a valid model (`SM-1`).

## Requirements

1. **R1 (parent R1)**: `bmad_open_companion` opens the `bmad-companion` surface, optionally persists `focus`, scans the workspace, and returns Markdown `content` + full `structuredContent`.
2. **R2 (parent R2)**: `bmad_get_state` scans on demand (`refresh`) and returns `structuredContent` with metadata, 4-phase progress, epic/story trees, dual metrics, active models, ranked recommendations, artifacts, and `taskQueue`.
3. **R3 (parent R3)**: `bmad_update_advisor` merges `headline`/`turnSummary`/`recommendations`, syncs live `hostModels[]` from `ListModels` over disk `provider_config.json`, and persists `storyStatusUpdates[]` (`overrideKey`/`status`/`reason`) through `savePersistedState`.
4. **R4 (parent R4)**: `bmad_prepare_new_session` copies the command to the OS clipboard, persists `preparedSession`, and when `openDirectly !== false` triggers `win32`/`darwin`/`linux` keystroke automation to pre-paste into a clean session, falling back cleanly to clipboard copy (`copied: true`) with an instructional toast when keystrokes are blocked.
5. **R5 (parent R6)**: `bmad_recommend_next` returns up to 6 topic-filtered `/bmad-<skill> "<contextual prompt>"` recommendations with paired `recommendedModel` objects.
6. **R6 (parent R7)**: `bmad_inspect_artifact` reads an artifact by `relPath`, returns metadata/`contentPreview`/`gitDiff`, and rejects paths outside `workspaceRoot`.
7. **R7 (parent R8)**: `bmad_open_artifact_file` opens a workspace-confined artifact in the desktop editor (`cmd /c start`/`open`/`xdg-open`) and returns `contentPreview` + `gitDiff`.

## Constraints

- **C1–C4, C11, C13** (parent `C1`–`C4`, `C11`, `C13`): zero npm dependencies; every recommendation matches `/^\/bmad-[a-z0-9-]+\s+".+"$/` with `providerId/modelId` (`C2`); artifact reads/opens confined to `workspaceRoot` with normalized `/` paths rejecting `..` (`C3`); all `state.json` writes via `savePersistedState` (`C4`); OS automation ≤1500ms p95 with hard timeouts 8000/6000/2500ms and tool calls ≤300ms p95 (`C11`); additive-only `0.5.x` JSON-RPC contract (`C13`).

## Done when

1. The read-only tool contract test asserts the full `ScanResult` shape and that 100% of recommendations match the contextual-prompt regex with a valid `providerId/modelId` (`SM-1`).
2. `bmad_update_advisor` merges advisor fields, overrides disk models with live `hostModels`, and persists `storyOverrides` keyed `<epic-slug>#<story-num>` via `savePersistedState`.
3. `bmad_prepare_new_session` pre-pastes into a fresh session on each supported OS within budget and falls back to clipboard copy with a toast when keystrokes are blocked, with zero unconfirmed auto-submissions (`SM-4`).
4. `bmad_inspect_artifact`/`bmad_open_artifact_file` reject `..` traversal outside `workspaceRoot` and return live `git diff` for confined paths.

## Boundaries

- Belongs to siblings: reconciliation tool behavior (`epic-dual-progress-reconciliation` owns `bmad_reconcile_trackers`), queue tool behavior (`epic-execution-queue` owns `bmad_queue_manage`), panel rendering (`epic-panel-polling-safety`), scorer/discovery and hooks (`epic-hooks-model-router`). This epic hardens the seven tools it covers and the shared `ScanResult` contract.
- Must not change: `overrideKey` format or remove `structuredContent.metrics` fields without a `0.x.0` bump + migration (`C13`); upstream skills (`C5`).

## References

- parent — `_bmad-output/initiative-bmad-companion/initiative-bmad-companion.md`, Requirements `R1`–`R4`, `R6`–`R8`, Constraints `C1`–`C4`, `C11`, `C13`
- prd — `_bmad-output/planning-artifacts/prd-bmad-companion/prd-bmad-companion.md`, Feature 1 (`FR-1`–`FR-4`, `FR-6`–`FR-8`), API contract and versioning, SLOs, `A-2`, `SM-1`, `SM-4`
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md`, Interaction Primitives (Launch semantics), Responsive & Platform

## Notes

- Decision: 2026-11-19 — Tracer bullet is Story 1 (read-only tool contract tracer `open_companion → get_state → recommend_next`), proving the thinnest MCP handler → engine scan → `structuredContent` path before Stories 2–4 add advisor mutation, OS launch, and artifact confinement.
- Risk reason (`high`): Story 3 drives OS-specific synthetic keystrokes (`SendKeys`/`osascript`/`xdotool`) under a ≤1500ms budget with platform-dependent fallback (`A-2`); a person observes the pre-pasted fresh session per OS (`hitl`).
- Waits on epic-verification-harness because: needs the spawned MCP stdio harness (`1.2`) and temp-workspace fixtures (`1.1`).
- Layer files: `scripts/mcp-server.mjs`, `scripts/bmad-engine.mjs` (advisor/state/artifact helpers), `tests/mcp-surface.test.mjs`.
