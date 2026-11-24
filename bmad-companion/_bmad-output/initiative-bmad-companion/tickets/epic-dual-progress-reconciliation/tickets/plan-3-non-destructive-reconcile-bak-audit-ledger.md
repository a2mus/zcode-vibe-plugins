---
title: 'Non-destructive reconcile + .bak + audit ledger'
type: feature
ticket: 3
container: epic-dual-progress-reconciliation
created: '2026-11-24'
status: done
baseline_revision: '3c50d56f79836df6604b0515bc0a6998d16241f8'
route: oneshot
route_source: pinned
risk: high
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

**Problem:** Under C8 and SM-3, `reconcileWorkspaceTrackers` in `scripts/bmad-engine.mjs` had several defects during disk mutation and dry-run simulation:
1. `dryRun: true` unconditionally created `.zcode/bmad-companion` on disk via `getStateFilePath` and `mkdirSync(logDir)`.
2. `tickets.toml` reconciliation checked `currentEntry.status` when parsing `v6_key` before `status` was read, misreporting `oldStatus: "unspecified"` and inserting a duplicate `status = "..."` line; it also failed to match entries lacking `v6_key`.
3. `parseTomlBlocks` did not strip inline `#` comments outside quotes/brackets, corrupting parsed statuses on commented TOML lines.
4. `sprint-status.yaml` reconciliation treated unrelated keys inside `development_status:` as story counts and treated `ready-for-dev` vs `ready` as a spurious mismatch.

**Approach:**
1. Update `getStateFilePath` (`ensureDir = true` default, `false` in `loadPersistedState`) and guard `.zcode/bmad-companion` creation in `reconcileWorkspaceTrackers` so `dryRun: true` leaves disk completely untouched.
2. Harden v6 YAML (`sprint-status.yaml`/`.yml`) reconciliation to preserve comments, indentation, line endings, and unrelated keys, compare via `normalizeStatus(currentVal) !== targetStatus`, count only valid story keys, and update `last_updated` + summary header counters (`# Completed Stories`, `# Remaining Backlog`, `# Progress`, and optional YAML numeric counters) in place.
3. Refactor v7 TOML (`tickets.toml`) reconciliation to parse per-`[[entry]]` sections cleanly, match stories by `epicSlug#id` or `v6_key`, update `status` in place without duplicating lines (or insert cleanly if absent), preserve comments/indentation/unrelated keys, and update header summary comments.
4. Fix `parseTomlBlocks` with `stripTomlInlineComment` so inline TOML `#` comments are stripped outside quotes and brackets.
5. Write `<tracker>.bak` before modifying any file (unless `backup: false`) and append an audit record to `.zcode/bmad-companion/reconciliation-log.json` on live changes.
6. Add Story 3.3 tests in `tests/reconciliation.test.mjs`.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `stripTomlInlineComment` and updated `parseTomlBlocks` to strip inline `#` comments outside strings and arrays.
  - Updated `getStateFilePath(workspaceRoot, { ensureDir = true } = {})` and `loadPersistedState` (`ensureDir: false`) so read-only scans and `dryRun: true` never touch disk.
  - Added `updateSummaryCommentHeaders` and hardened `reconcileWorkspaceTrackers` for v6 YAML and v7 `tickets.toml` in-place mutation, `.bak` backup creation, workspace confinement, and `.zcode/bmad-companion/reconciliation-log.json` audit logging.
- **`tests/reconciliation.test.mjs`:**
  - Added 4 tests under `non-destructive reconcile + .bak + audit ledger (Epic 3 Story 3.3)` verifying `dryRun: true` zero disk writes, live `.bak` creation per modified file + audit ledger appending without duplicate TOML `status` lines, comment/indentation/unrelated-key preservation + in-place header counter updates, and `backup: false`.

## Verification

**Commands (executed on win32):**
- `node --test tests/` — passed (87/87 tests, 0 failures, 20 suites).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — passed (87/87 tests, 0 failures; `[check-version-sync] OK: all 3 versions match (0.5.3)`; `bmad-companion v0.5.3`, `vibe-debrief v0.3.0`, `project-colors v0.1.0` validated).

## Auto Run Result

- **Summary:** Implemented Story 3.3 non-destructive reconciliation with `dryRun: true` zero-write safety, per-file `.bak` backups (unless `backup: false`), comment/indentation/unrelated-key preservation, in-place header counter updates across v6 YAML and v7 `tickets.toml`, and `.zcode/bmad-companion/reconciliation-log.json` audit logging.
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `tests/reconciliation.test.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-dual-progress-reconciliation/tickets/plan-3-non-destructive-reconcile-bak-audit-ledger.md`
