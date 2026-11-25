---
type: epic
title: Dual progress tracking & safe tracker reconciliation
parent: initiative-bmad-companion
covers: [R5, R10, R11]
sources:
  - _bmad-output/initiative-bmad-companion/initiative-bmad-companion.md
companions: []
after: [epic-verification-harness, epic-mcp-surface]
status: done
refined: true
risk: high
---

# Dual progress tracking & safe tracker reconciliation

## Description

Builds on Epic 1's temp-workspace fixtures (`1.1`) and Epic 2's hardened engine state/advisor lane in `scripts/bmad-engine.mjs` (same file edited once) to prove dual Static-vs-Smart progress metrics, the smart evidence evaluator, non-destructive reconciliation with `.bak` backups + audit ledger, and the `bmad_reconcile_trackers` MCP tool contract. Hands off the reconciled engine scan/state baseline to Epic 5.

## Outcome

Maya sees lagging `sprint-status.yaml`/`tickets.toml` reconciled against verified delivery in one click — both progress bars align, every modified tracker keeps a `.bak` and its comments, and an audit record lands in `reconciliation-log.json` (`SM-3`).

## Requirements

1. **R1 (parent R10)**: On every scan the engine parses BMAD v6/v7 artifacts with zero-dependency parsers (`parseFrontmatter`, `parseTomlBlocks`, `parseSprintStatusYaml`) to compute Static Tracker Progress (`declaredDoneStories`, `declaredOverallPct`) and Smart AI Progress (`smartDoneStories`, `smartOverallPct`, `reconciledStoriesCount`) with a `smartReason` evidence string per upgraded story; smart `done` only on verified evidence and failing reports hold `in-progress`/`review` with a remediation recommendation.
2. **R2 (parent R11)**: With `dryRun: false`, `reconcileWorkspaceTrackers` writes `<tracker>.bak` before modifying any file (unless `backup: false`), updates story keys and summary headers in `sprint-status.yaml`/`tickets.toml` in place preserving comments and indentation, and appends an audit record to `.zcode/bmad-companion/reconciliation-log.json`.
3. **R3 (parent R5)**: `bmad_reconcile_trackers` synchronizes v6 (`sprint-status.yaml`/`.yml`) and/or v7 (`tickets.toml` + epic frontmatter) with smart-verified statuses, supporting `dryRun`, `target` (`all`/`v6-yaml`/`v7-tickets`), and `backup` (default `true`), returning the flat `ReconcileResult` (`{ reconciledAt, dryRun, target, changesCount, updatedFiles, changes, before, after, newScan }`).

## Constraints

- **C1, C3, C8, C10, C12** (parent `C1`, `C3`, `C8`, `C10`, `C12`): zero-dependency parsers; tracker writes confined to `workspaceRoot` with normalized `/` paths; no disk writes on `dryRun: true` and `.bak` before modify when `backup !== false`; scan depth ≤4, reads 24–30KB cap, git 2500ms timeout; deterministic evidence rules (overrides done / plan `done`/`completed`/`shipped` / passing `failCount === 0` / retrospective), failing reports hold + remediation.

## Done when

1. A seeded v6+v7 fixture yields both `declared*` and `smart*` metric sets with a `smartReason` per upgraded story in the scan test.
2. The evidence evaluator upgrades to `done` only on verified evidence and holds `in-progress`/`review` with a remediation recommendation on a failing report (`failCount > 0`).
3. Live reconciliation creates a `.bak` before each modified tracker, preserves comments/indentation and unrelated keys, updates header counters, and appends an audit record; `dryRun: true` writes nothing (`SM-3`).
4. `bmad_reconcile_trackers` honors `target` and `backup` and returns the documented `ReconcileResult` shape (`updatedFiles`, `changesCount`, `changes`, `before`, `after`, `newScan`).

## Boundaries

- Belongs to siblings: the other eight MCP tools (`epic-mcp-surface`, `epic-execution-queue`), panel progress rendering (`epic-panel-polling-safety`), artifact discovery/git diff (`epic-hooks-model-router`). This epic owns the parsers, dual-metric computation, evidence evaluator, and reconciler.
- Must not change: tracker files during a scan (`DEC-4` — mutation only on explicit reconcile); upstream skills (`C5`).

## References

- parent — `_bmad-output/initiative-bmad-companion/initiative-bmad-companion.md`, Requirements `R5`, `R10`, `R11`, Constraints `C1`, `C3`, `C8`, `C10`, `C12`
- prd — `_bmad-output/planning-artifacts/prd-bmad-companion/prd-bmad-companion.md`, Feature 2 (`FR-10`, `FR-11`), `FR-5`, Rules `RULE-8`, Quality `RULE-10`, AI behavior and evaluation (Smart Story Status Evidence Rules), `SM-3`, `DEC-4`
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md`, Key Flows (Flow 2 — UJ-2)

## Notes

- Decision: 2026-11-19 — Tracer bullet is Story 1 (dual-progress scan tracer over a v6+v7 fixture), proving the parser → declared-vs-smart metric path before Story 2 hardens the evidence rules and Story 3 adds disk mutation.
- Decision: 2026-11-23 — Settled `OQ-B` per user confirmation: `bmad_reconcile_trackers` aligns to the shipped flat `ReconcileResult` (`updatedFiles`, `changesCount`, `newScan`).
- Risk reason (`high`): Story 3 mutates user tracker files in place; a parser or header-counter bug could corrupt `sprint-status.yaml`/`tickets.toml` — `.bak` + comment preservation + dry-run are the safety net (`C8`, `SM-3`).
- Waits on epic-verification-harness because: needs the temp-workspace fixtures and engine harness (`1.1`).
- Waits on epic-mcp-surface because: shares the `scripts/bmad-engine.mjs` state/advisor lane; the same file is edited once.
- Layer files: `scripts/bmad-engine.mjs` (parsers/scanner/reconciler), `scripts/mcp-server.mjs` (reconcile handler), `tests/reconciliation.test.mjs`.
