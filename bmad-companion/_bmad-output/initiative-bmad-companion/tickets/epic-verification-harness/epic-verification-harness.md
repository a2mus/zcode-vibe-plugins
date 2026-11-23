---
type: epic
title: Zero-dependency verification harness
parent: initiative-bmad-companion
covers: [R23]
sources:
  - _bmad-output/initiative-bmad-companion/initiative-bmad-companion.md
companions: []
after: []
status: done
refined: true
risk: medium
---

# Zero-dependency verification harness

## Description

Stands up the one-command `node --test tests/` suite the shipped `v0.5.2` baseline lacks (`AGENTS.md`: "no automated test suite or linter"), realizing parent `R23`: temp-workspace fixtures, an engine smoke tracer, spawned MCP stdio and hook stdout-isolation harnesses, and a version tri-sync gate. This is the platform baseline every later epic waits on; it hands off the fixtures and transport harnesses to Epics 2–6 and the closing end-to-end suite to Epic 6.

## Outcome

Any engineer or agent verifies the engine, MCP transport, hook, and version contracts with one command on Node 18+, replacing the manual `node --check` + stdio smoke checklist with a regression gate.

## Requirements

1. **R1 (parent R23)**: A zero-dependency `node:test` suite under `tests/` runs green with one command (`node --test tests/`) on Node 18+, providing temp-workspace fixtures, a `scanBmadWorkspace` engine smoke path, spawned-process MCP stdio (`initialize`/`tools/list`/`resources/read`) and hook stdout-isolation harnesses, and a version tri-sync gate — automating the PRD's syntax + stdio smoke verification gate without any npm dependency.

## Constraints

- **C1, C6, C11, C13** (parent `C1`, `C6`, `C11`, `C13`): tests use `node:test` and `node:*` built-ins only (no `package.json`/npm); the version gate keeps `plugin.json`, `../marketplace.json`, and `serverInfo.version` synced; the MCP harness asserts `protocolVersion: "2024-11-05"` and the `text/html;profile=mcp-app` resource with `csp.unsafeEval: false`; harness spawn timeouts stay bounded.

## Done when

1. `node --test tests/` runs green with one command on Node 18+ and is the recorded verification gate.
2. A seeded temp-workspace fixture drives `scanBmadWorkspace` to a valid `ScanResult` in the engine smoke test.
3. Spawned MCP `initialize`/`tools/list`/`resources/read` and the four hook stdout-isolation checks pass as automated tests.
4. `scripts/check-version-sync.mjs` fails on a deliberate version mismatch and passes when the three locations agree, wired into the suite.

## Boundaries

- Belongs to siblings: MCP tool behavior (`epic-mcp-surface`), reconciliation (`epic-dual-progress-reconciliation`), panel guards/a11y (`epic-panel-polling-safety`), queue (`epic-execution-queue`), hooks/scorer and the closing end-to-end suite (`epic-hooks-model-router`). This epic builds only the harness, fixtures, and version gate — not feature behavior.
- Must not change: runtime `scripts/*.mjs` behavior beyond adding the version-sync script; upstream skills (`C5`).

## References

- parent — `_bmad-output/initiative-bmad-companion/initiative-bmad-companion.md`, Requirements `R23`, Constraints `C1`, `C6`, `C11`, `C13`
- prd — `_bmad-output/planning-artifacts/prd-bmad-companion/prd-bmad-companion.md`, Developer experience (Verification Commands), API contract and versioning

## Notes

- Decision: 2026-11-19 — Tracer bullet is Story 1 (`node:test harness + temp-workspace fixture tracer`), proving the thinnest fixture → engine import → assert path before Stories 2–3 add the spawned MCP/hook transports and Story 4 adds the version gate.
- Decision: 2026-11-19 — Opening platform-baseline epic; no separate scaffold epic because `v0.5.2` already ships the runtime layers, plugin wiring, and UI (initiative Decision).
- Decision: 2026-11-23 — Closed on user confirmation after all 5 stories (`1.1`–`1.5`) completed and all 3 retrospective test-harness fixes landed (`af5bd65`; `node --test tests/` 49/49 pass, `check-version-sync.mjs` OK at `0.5.3`). Recording `node --test tests/` in `AGENTS.md` and `README.md` (`Done when #1`) is handed off to `bmad-project-context`.
- Risk reason (`medium`): establishes the spawned-process harness and temp-workspace fixtures every later epic depends on; a flawed fixture or transport helper propagates.
- Layer files: `tests/`, `scripts/check-version-sync.mjs` (new), spawned `scripts/mcp-server.mjs` and `scripts/hook-runner.mjs`.
