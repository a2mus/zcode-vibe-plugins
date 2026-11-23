---
type: epic
title: Lifecycle hooks, 4-tier model router & closing end-to-end suite
parent: initiative-bmad-companion
covers: [R17, R18, R19, R20, R21, R22]
sources:
  - _bmad-output/initiative-bmad-companion/initiative-bmad-companion.md
companions: []
after: [epic-verification-harness, epic-execution-queue]
refined: true
risk: high
---

# Lifecycle hooks, 4-tier model router & closing end-to-end suite

## Description

Builds on Epic 1's hook stdout-isolation harness (`1.3`) and Epic 5's queue `start-task`/`complete-task` actions (`5.1`) to harden the four lifecycle hooks (`SessionStart`/`UserPromptSubmit`/`PostToolUse`/`Stop`), the 4-tier enabled-model scorer, workspace-confined artifact discovery, and optional `Stop` LLM synthesis; closes with the cross-epic end-to-end suite proving `UJ-1`–`UJ-4` and the `SM-1`–`SM-5` gate.

## Outcome

Every turn keeps the panel current — context injection, prompt/file tracking, queue auto-advance, and cost-optimal model routing — with deterministic offline defaults and a silent optional-LLM fallback, proven end-to-end by the four user journeys.

## Requirements

1. **R1 (parent R19)**: On `SessionStart`, `hook-runner.mjs` scans the workspace and outputs `additionalContext` with smart-vs-static metrics, active provider counts, top 3 `/bmad-<skill> "<prompt>"` commands with recommended models, and companion rules, on a single JSON stdout line.
2. **R2 (parent R20)**: On `UserPromptSubmit`, `hook-runner.mjs` stores `lastUserPrompt`, resets `recentTouchedFiles`, and auto-transitions a matching queued task to `running` (`start-task`).
3. **R3 (parent R21)**: On `PostToolUse` (`Write`/`Edit`/`MultiEdit`), `hook-runner.mjs` records up to 15 workspace-relative paths in `recentTouchedFiles`.
4. **R4 (parent R22)**: On `Stop`, `hook-runner.mjs` increments `turnCount`, stores `lastAssistantMessage`, auto-completes a running single-session queued task (`complete-task`), and optionally invokes `BMAD_COMPANION_OPENAI_KEY`/`OPENAI_API_KEY` synthesis bounded by `AbortSignal.timeout(4500)` with silent fallback.
5. **R5 (parent R18)**: The engine resolves enabled models from `state.json -> hostModels` (via `ListModels`) or `~/.zcode/v2/provider_config.json`, excludes `enabled === false`/`disabledReason`, scores each against the skill's `modelProfile` (`deep-reasoning`/`creative-ux`/`agentic-coding`/`planning-fast`), and returns the top `providerId/modelId`, tier label, and rationale.
6. **R6 (parent R17)**: The scanner walks `_bmad-output/`, `docs/`, `AGENTS.md`, and `CONTEXT.md` (max depth 4) and computes per-artifact git status and `git diff` previews with normalized `/` paths confined to `workspaceRoot`, heuristic reads capped 24–30KB and git subprocesses timed out at 2500ms.

## Constraints

- **C1–C3, C10–C12** (parent `C1`–`C3`, `C10`–`C12`): zero npm dependencies; recommendations match the contextual-prompt regex with `providerId/modelId`; discovery confined to `workspaceRoot` rejecting `..`; scan depth ≤4 / reads 24–30KB / git 2500ms; deterministic hooks ≤350ms p95 and ≤4800ms with optional `Stop` LLM; deterministic primary path with optional LLM only on `Stop` with a key, `AbortSignal.timeout(4500)`, silent fallback.

## Done when

1. The `SessionStart` hook emits single-line JSON `additionalContext` with smart-vs-static metrics, provider counts, and top-3 contextual commands + models.
2. The scorer excludes disabled models and returns the top `providerId/modelId` + tier + rationale for each `modelProfile` from live `hostModels` or disk config.
3. Artifact discovery stays depth-4/read-cap/git-timeout bounded and workspace-confined; `UserPromptSubmit`/`PostToolUse` track prompt + ≤15 files and auto-start a matching task; `Stop` auto-completes and falls back silently without a key.
4. The closing end-to-end suite exercises `UJ-1`–`UJ-4` over the harness and the full `node --test tests/` gate is green, proving `SM-1`–`SM-5`.

## Boundaries

- Belongs to siblings: MCP tool contracts (`epic-mcp-surface`), reconciliation (`epic-dual-progress-reconciliation`), panel rendering (`epic-panel-polling-safety`), queue engine/compiler (`epic-execution-queue`). This epic owns `hook-runner.mjs`, the scorer, and artifact discovery, and closes the initiative-wide end-to-end suite.
- Must not change: hook single-line stdout isolation; queue actions owned by Epic 5 (consumed here); upstream skills (`C5`); no cloud telemetry without a user-set key.

## References

- parent — `_bmad-output/initiative-bmad-companion/initiative-bmad-companion.md`, Requirements `R17`–`R22`, Constraints `C1`–`C3`, `C10`–`C12`
- prd — `_bmad-output/planning-artifacts/prd-bmad-companion/prd-bmad-companion.md`, Feature 5 (`FR-17`–`FR-22`), AI behavior and evaluation (4-Tier Model Scoring), SLOs, `RULE-10`, `A-4`
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md`, Key Flows (`UJ-1`–`UJ-4`)

## Notes

- Decision: 2026-11-19 — Tracer bullet is Story 1 (`SessionStart` context-injection tracer), proving the thinnest hook → scan → single-line `additionalContext` path before Stories 2–5 add scoring, discovery, and the remaining hooks.
- Decision: 2026-11-19 — Closing end-to-end suite (Story 7) lands here after the refactor sweep, exercising `UJ-1`–`UJ-4` as the initiative's recorded `SM-1`–`SM-5` gate (initiative Decision).
- Decision: 2026-11-23 — Settled `OQ-D` per user confirmation: aligned `R5` (`modelProfile`) to the shipped `agentic-coding` key.
- Risk reason (`high`): Story 5 mutates turn state and optionally calls an external LLM under a 4500ms bound; a stdout or timeout regression breaks hook isolation or the ≤350ms deterministic budget (`C11`).
- Waits on epic-verification-harness because: needs the hook stdout-isolation harness (`1.3`).
- Waits on epic-execution-queue because: needs the `taskQueue` `start-task`/`complete-task` actions (`5.1`) the hooks auto-advance and the engine scorer/discovery lane.
- Layer files: `scripts/hook-runner.mjs`, `scripts/bmad-engine.mjs` (scorer/discovery), `tests/hooks-router.test.mjs`, `tests/e2e-journeys.test.mjs`.
