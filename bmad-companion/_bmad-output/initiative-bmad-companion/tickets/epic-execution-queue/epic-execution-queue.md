---
type: epic
title: Multi-task execution queue & workflow compiler
parent: initiative-bmad-companion
covers: [R9, R15, R16]
sources:
  - _bmad-output/initiative-bmad-companion/initiative-bmad-companion.md
companions: []
after: [epic-verification-harness, epic-dual-progress-reconciliation, epic-mcp-surface]
status: done
refined: true
risk: high
---

# Multi-task execution queue & workflow compiler

## Description

Builds on Epic 1's harness (`1.1`), Epic 3's reconciled engine lane in `scripts/bmad-engine.mjs`, and Epic 2's `mcp-server.mjs` handler lane to harden the 14-action queue lifecycle, review-mode prompt shaping, dual execution-engine generation (`.dwf.ts` + step-updater / `CreateSession` plan), and the `bmad_queue_manage` MCP contract with `taskQueue`/`storyOverrides` sync. Hands off the queue `start-task`/`complete-task` actions to Epic 6's hooks.

## Outcome

Devon queues an epic with per-task models and token-saving review gates and starts it in one click — generated plans adhere 100% to `reviewMode` and `taskQueue` stays synchronized with `storyOverrides` (`SM-5`).

## Requirements

1. **R1 (parent R9)**: `manageBmadTaskQueue`/`bmad_queue_manage` manages the queue across all 14 actions (`get`, `add`, `add-epic`, `update-item`, `set-review-mode`, `set-execution-mode`, `reorder`, `remove`, `clear`, `start-queue`, `start-task`, `complete-task`, `pause-queue`, `generate-workflow`) with per-task `model`, `reviewMode` (`none`/`quick`/`thorough`), and `executionMode` (`dynamic-workflow`/`separate-sessions`), persisting through `savePersistedState` and keeping `taskQueue` synchronized with `storyOverrides`.
2. **R2 (parent R15)**: `buildEffectiveTaskPrompt` compiles each task's `effectivePrompt` per `reviewMode`: `none` (oneshot + deterministic verification only), `quick` (oneshot + single self-review pass), `thorough` (multi-lens BMAD code review gate).
3. **R3 (parent R16)**: On `start-queue`/`generate-workflow`, `generateQueueWorkflowFiles` compiles `.zcode/workflows/bmad-task-queue.dwf.ts` + `.zcode/bmad-companion/queue-step-updater.mjs` (`dynamic-workflow`) or emits a sequential `CreateSession` + `WaitSessions` orchestration plan (`separate-sessions`).

## Constraints

- **C1, C4, C11, C13** (parent `C1`, `C4`, `C11`, `C13`): zero npm dependencies; all `taskQueue` writes via `savePersistedState`; generated workflow/plan artifacts confined to `workspaceRoot`; additive-only `0.5.x` queue tool contract; 100% `reviewMode` adherence and `taskQueue`↔`storyOverrides` sync (`SM-5`).

## Done when

1. The queue lifecycle test drives `add → start-task → complete-task → get` through `queued → running → done` with persisted state.
2. All 14 actions behave per contract, including `reorder`/`remove`/`clear`/`pause-queue`, `set-review-mode` (`applyToAll`), and `set-execution-mode`.
3. `buildEffectiveTaskPrompt` produces the correct oneshot/self-review/multi-lens prompt for each `reviewMode` (`SM-5`).
4. `generateQueueWorkflowFiles` emits a valid `.dwf.ts` + step-updater for `dynamic-workflow` and a `CreateSession`+`WaitSessions` plan for `separate-sessions`, and `taskQueue` stays synced with `storyOverrides`.

## Boundaries

- Belongs to siblings: the other MCP tools (`epic-mcp-surface`, `epic-dual-progress-reconciliation`), panel queue rendering (`epic-panel-polling-safety`), hook auto-start/auto-complete (`epic-hooks-model-router`). This epic owns the queue engine, prompt shaping, workflow compiler, and queue tool handler.
- Must not change: `overrideKey` format (`C13`); upstream skills (`C5`); no autonomous git commits/pushes from generated workflows (initiative non-goal).

## References

- parent — `_bmad-output/initiative-bmad-companion/initiative-bmad-companion.md`, Requirements `R9`, `R15`, `R16`, Constraints `C1`, `C4`, `C11`, `C13`
- prd — `_bmad-output/planning-artifacts/prd-bmad-companion/prd-bmad-companion.md`, Feature 4 (`FR-15`, `FR-16`), `FR-9`, API contract (`bmad_queue_manage`), `SM-5`, `DEC-5`
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md`, Key Flows (Flow 3 — UJ-3), Interaction Primitives (Reorder without drag)

## Notes

- Decision: 2026-11-19 — Tracer bullet is Story 1 (queue lifecycle tracer `add → start-task → complete-task → get`), proving the thinnest queue → state persistence → view path before Stories 2–5 add the full action set, prompt shaping, workflow generation, and tool contract.
- Decision: 2026-11-23 — Settled `OQ-B` per user confirmation: `bmad_queue_manage` aligns to the shipped `{ ...ScanResult, queueActionResult: { action, taskQueue, generatedWorkflow } }` shape.
- Risk reason (`high`): Story 4 generates executable `.dwf.ts` + step-updater artifacts that drive automated multi-task execution; a malformed compiler output could mis-route models or skip review gates (`SM-5`).
- Waits on epic-verification-harness because: needs the node:test harness (`1.1`).
- Waits on epic-dual-progress-reconciliation because: shares the `scripts/bmad-engine.mjs` queue/state lane; the same file is edited once.
- Waits on epic-mcp-surface because: shares the `scripts/mcp-server.mjs` tool handler lane.
- Layer files: `scripts/bmad-engine.mjs` (queue/compiler), `scripts/mcp-server.mjs` (queue handler), `tests/execution-queue.test.mjs`.
