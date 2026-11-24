---
title: 'Reconcile MCP tool contract (dryRun/target/backup)'
type: feature
ticket: 4
container: epic-dual-progress-reconciliation
created: '2026-11-24'
status: done
baseline_revision: '3c50d56f79836df6604b0515bc0a6998d16241f8'
route: oneshot
route_source: pinned
risk: low
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Under R3 (parent R5), `bmad_reconcile_trackers` MCP tool handler and `reconcileWorkspaceTrackers` needed to:
1. Return the documented flat `ReconcileResult` shape (`{ reconciledAt, dryRun, target, changesCount, updatedFiles, changes, before, after, newScan }`) with rich Markdown summary content over MCP stdio.
2. Honor `dryRun: true` leaving disk completely untouched, `dryRun: false` writing files and `.bak` backups.
3. Honor `target` selecting `"all"`, `"v6-yaml"`, or `"v7-tickets"` where `"v6-yaml"` and `"v7-tickets"` each mutate only their tracker family and leave the sibling family untouched.
4. Honor `backup` defaulting to `true` (creating `.bak` copies before modify) and skipping `.bak` copies when `backup: false`.
5. Validate `target` to reject invalid targets with an informative error.

**Approach:**
1. Harden `reconcileWorkspaceTrackers` in `scripts/bmad-engine.mjs` to validate `target` against `['all', 'v6-yaml', 'v7-tickets']`, robustly parse `dryRun` and `backup` boolean / string options with `backup` defaulting to `true`, and ensure `target: 'v6-yaml'` and `target: 'v7-tickets'` strictly isolate mutations and `.bak` creations to their respective tracker families.
2. Update `bmad_reconcile_trackers` MCP input schema in `scripts/mcp-server.mjs` with explicit defaults (`default: false`, `default: 'all'`, `default: true`) and update the tool call handler to output `- **Target:** \`${result.target}\`` and clear empty-change messaging in Markdown text alongside the flat `result` object in `structuredContent`.
3. Add full MCP stdio contract verification in `tests/reconciliation.test.mjs` testing flat `ReconcileResult` shape, Markdown content, `dryRun: true`, isolated `target: "v6-yaml"` and `target: "v7-tickets"` mutations, `backup: false` skip, and invalid `target` error rejection.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added target validation (`['all', 'v6-yaml', 'v7-tickets']`) throwing a descriptive Error on invalid targets.
  - Normalized `dryRun` (`options.dryRun === true || options.dryRun === "true"`) and `makeBackup` (`options.backup !== false && options.backup !== "false"`).
- **`scripts/mcp-server.mjs`:**
  - Added explicit schema defaults (`dryRun: false`, `target: 'all'`, `backup: true`).
  - Included `- **Target:** \`${result.target}\`` and clean empty-state messaging in `bmad_reconcile_trackers` tool result text.
- **`tests/reconciliation.test.mjs`:**
  - Added `reconcile MCP tool contract (Epic 3 Story 3.4)` test suite with 5 comprehensive tests:
    1. Returns flat `ReconcileResult` shape and Markdown content from `bmad_reconcile_trackers` over MCP stdio with `dryRun: true`.
    2. Verifies `target: 'v6-yaml'` modifies only `sprint-status.yaml` and leaves `tickets.toml` completely untouched.
    3. Verifies `target: 'v7-tickets'` modifies only `tickets.toml` and leaves `sprint-status.yaml` completely untouched.
    4. Verifies `target: 'all'` (default) modifies both tracker families and honors `backup: false`.
    5. Verifies invalid `target` rejection with informative error over MCP stdio.

## Verification

**Commands (executed on win32):**
- `node --test tests/` — passed (92/92 tests, 0 failures, 21 suites).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — passed (92/92 tests, 0 failures; `[check-version-sync] OK: all 3 versions match (0.5.3)`; `bmad-companion v0.5.3`, `vibe-debrief v0.3.0`, `project-colors v0.1.0` validated).

## Auto Run Result

- **Summary:** Hardened `bmad_reconcile_trackers` MCP handler and `reconcileWorkspaceTrackers` to honor `dryRun`, `target` (`all` | `v6-yaml` | `v7-tickets`), and `backup` (default `true`), returning the flat `ReconcileResult` shape with isolated tracker family modifications and verified via deterministic test suite.
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `scripts/mcp-server.mjs`
  - `tests/reconciliation.test.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-dual-progress-reconciliation/tickets/plan-4-reconcile-mcp-tool-contract.md`
