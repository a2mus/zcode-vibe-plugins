---
title: 'Version tri-sync gate'
type: feature
ticket: 4
created: '2026-11-20'
status: done
baseline_revision: 'bea9bf7d1f7cc9855ac0f958695e468b2b33e73b'
route: full
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `bmad-companion` requires its version to be strictly synchronized across `.zcode-plugin/plugin.json`, `../marketplace.json`, and `serverInfo.version` in `scripts/mcp-server.mjs` (Policy and Constraint C6), but has no automated gate script or test fixture to detect version drift.

**Approach:** Add `scripts/check-version-sync.mjs` as a zero-dependency CLI & module validator that parses and compares all three version targets, and wire a `node:test` suite in `tests/version-sync.test.mjs` (exporting `CHECK_VERSION_SYNC_PATH` in `tests/helpers.mjs`) verifying clean sync on the current tree and non-zero exit on deliberate mismatches.

## Boundaries & Constraints

**Always:**
- Use Node 18+ ESM built-ins only (`node:fs`, `node:path`, `node:url`, `node:process`, `node:test`, `node:assert/strict`) with zero `package.json` or external npm dependencies (Constraint C1, C6).
- Script `scripts/check-version-sync.mjs` must accept an optional target plugin root directory (via CLI argument `process.argv[2]` or programmatic function argument), defaulting to the repo root of `bmad-companion`.
- Verify all three targets: `.zcode-plugin/plugin.json` (`version`), `../marketplace.json` (`plugins` array where `name === "bmad-companion"` -> `version`), and `scripts/mcp-server.mjs` (`serverInfo.version`).
- Exit with status code 0 and log OK when all 3 versions match; exit with status code 1 and log detailed mismatch diagnostics when any version differs or a file cannot be read/parsed.
- Pass `node --check scripts/check-version-sync.mjs` syntax verification.

**Never:**
- Never modify version numbers or runtime behaviors of `scripts/mcp-server.mjs`, `scripts/bmad-engine.mjs`, or `scripts/hook-runner.mjs`.
- Never introduce any `package.json` or external npm dependencies.
- Never write to or mutate live `../marketplace.json` or `.zcode-plugin/plugin.json` during test runs (use isolated temp-workspace fixtures for mismatch tests).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Synced workspace (happy path) | All 3 targets match (`0.5.3`) | Returns `{ synced: true, versions: { plugin: "0.5.3", marketplace: "0.5.3", mcpServer: "0.5.3" }, errors: [] }`; CLI exits 0 with OK message | No error expected |
| Bumped plugin.json mismatch | Fixture workspace where `plugin.json` is `0.5.4` while others are `0.5.3` | Returns `synced: false`, lists mismatch in `errors`; CLI exits 1 with non-zero exit code | Diagnostic mismatch log on stderr |
| Marketplace version mismatch | Fixture where `marketplace.json` has `0.5.2` while others have `0.5.3` | Returns `synced: false`, lists mismatch in `errors`; CLI exits 1 | Diagnostic mismatch log on stderr |
| MCP server version mismatch | Fixture where `mcp-server.mjs` has `0.5.2` while others have `0.5.3` | Returns `synced: false`, lists mismatch in `errors`; CLI exits 1 | Diagnostic mismatch log on stderr |
| Missing plugin or marketplace file | Target directory missing `plugin.json` or `marketplace.json` | Returns `synced: false`, records file read/parse error in `errors`; CLI exits 1 | Clear missing file / parse error on stderr |

</intent-contract>

## Code Map

- `scripts/check-version-sync.mjs` -- Zero-dependency ESM CLI script and exported validator `checkVersionSync(pluginRoot)` reading `.zcode-plugin/plugin.json`, `../marketplace.json`, and `scripts/mcp-server.mjs`.
- `tests/helpers.mjs` -- Export `CHECK_VERSION_SYNC_PATH`, reuse `createTempWorkspace` and `runNodeProcess` for testing version gate execution and fixture isolation.
- `tests/version-sync.test.mjs` -- New `node:test` suite verifying in-process sync of current workspace, CLI process execution exit code 0, and temp-workspace deliberate mismatch fixtures exiting with code 1.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/check-version-sync.mjs` -- Implement zero-dependency version tri-sync validator and CLI runner -- Enforces Constraint C6 across plugin.json, marketplace.json, and mcp-server.mjs
- [x] `tests/helpers.mjs` -- Export `CHECK_VERSION_SYNC_PATH` constant -- Provides canonical script path to test suites
- [x] `tests/version-sync.test.mjs` -- Implement `node:test` suite for tri-sync validator and mismatch CLI fixtures -- Verifies sync on live repo and non-zero exit on deliberate mismatch fixtures

**Acceptance Criteria:**
- Given the current repo state, when `scripts/check-version-sync.mjs` is executed via CLI or imported, all three versions resolve to `0.5.3` and process exits with 0.
- Given a temp-workspace fixture with a bumped `plugin.json` version (e.g. `0.5.4`), when `scripts/check-version-sync.mjs` runs against that fixture, it outputs mismatch details to stderr and exits with non-zero code (1).
- Given a temp-workspace fixture with a mismatched `marketplace.json` or `mcp-server.mjs` version, when `scripts/check-version-sync.mjs` runs against that fixture, it detects the mismatch and exits with non-zero code (1).
- Given `node --test tests/`, all test suites pass with exit code 0 on Node 18+ with zero npm dependencies.
- Given `node --check scripts/check-version-sync.mjs`, syntax check passes with exit code 0.

## Implementation Notes

- Implemented `scripts/check-version-sync.mjs` with zero dependencies, exporting `checkVersionSync(pluginRoot, options)` and supporting both direct CLI invocation (defaulting to plugin repo root or custom directory via `argv[2]`) and programmatic usage.
- Exported `CHECK_VERSION_SYNC_PATH` from `tests/helpers.mjs`.
- Created `tests/version-sync.test.mjs` using `node:test` and `node:assert/strict` covering:
  - In-process check on live repo verifying clean tri-sync (`0.5.3` across all 3 targets).
  - CLI execution against live repo (explicit path argument and default fallback) logging `[check-version-sync] OK: all 3 versions match (0.5.3)` and exiting code 0.
  - Isolated temp-workspace fixtures for bumped `plugin.json`, mismatched `marketplace.json`, mismatched `mcp-server.mjs`, missing files, unparseable JSON, and unextractable `serverInfo`, verifying non-zero exit (1) and detailed stderr diagnostics without mutating live files.

## Plan Change Log

## Review Triage Log

### 2026-11-20 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` scripts/check-version-sync.mjs whitespace-only version values bypass invalid field check and yield empty errors array — patched by checking `rawVersion.length > 0` after trim before assignment and pushing invalid version error otherwise.
  - `[low]` `[patch]` scripts/check-version-sync.mjs marketplace search matches preceding bmad-companion when testing other plugin names — patched by searching for `p.name === pluginName` directly.
  - `[low]` `[patch]` tests/version-sync.test.mjs test description claims syntax validation but only checked file existence — patched by spawning `node --check` via `runNodeProcess` and asserting exit code 0.

## Design Notes

- `checkVersionSync(pluginRoot = defaultRoot)`:
  - Default `pluginRoot` is `resolve(__dirname, "..")`.
  - Resolves `pluginJsonPath = join(pluginRoot, ".zcode-plugin", "plugin.json")`.
  - Resolves `marketplacePath = resolve(pluginRoot, "..", "marketplace.json")`.
  - Resolves `mcpServerPath = join(pluginRoot, "scripts", "mcp-server.mjs")`.
  - Parses `plugin.json` with `JSON.parse`.
  - Parses `marketplace.json` with `JSON.parse`, searches `marketplace.plugins.find(p => p.name === pluginName || p.name === "bmad-companion")`.
  - Parses `mcp-server.mjs` using regex for `serverInfo` block and extracts `version: "..."`.
  - Compares all three version strings. If all present and identical, `synced: true`. Otherwise `synced: false`.
  - CLI execution check: runs when `process.argv[1]` points to `check-version-sync.mjs`.

## Verification

**Commands:**
- `node scripts/check-version-sync.mjs` -- expected: exits 0 with `[check-version-sync] OK: all 3 versions match (0.5.3)`
- `node --check scripts/check-version-sync.mjs` -- expected: syntax check passes with exit code 0
- `node --test tests/` -- expected: all suites pass with exit code 0 including version-sync tests

## Auto Run Result

Status: built (Story 1.4 fully implemented and verified against baseline `bea9bf7d1f7cc9855ac0f958695e468b2b33e73b`, 2026-11-20)

### Summary of Implemented Change
- Implemented `scripts/check-version-sync.mjs` as a zero-dependency CLI utility and exported validator `checkVersionSync(pluginRoot, options)`.
- Validates version tri-sync across `.zcode-plugin/plugin.json`, `../marketplace.json` (entry `bmad-companion`), and `scripts/mcp-server.mjs` (`serverInfo.version`).
- Exits 0 with `[check-version-sync] OK: all 3 versions match (<version>)` when all three agree.
- Exits 1 with detailed diagnostic logs on stderr when any version differs or a target file is missing/unparseable.
- Exported `CHECK_VERSION_SYNC_PATH` in `tests/helpers.mjs`.
- Implemented `tests/version-sync.test.mjs` with 14 `node:test` assertions covering in-process validation, CLI execution, syntax check, and isolated temp fixtures for bumped `plugin.json`, mismatched `marketplace.json`, mismatched `mcp-server.mjs`, missing files, whitespace-only versions, and malformed content.

### Files Changed
- `scripts/check-version-sync.mjs`: Zero-dependency tri-sync validator and CLI script.
- `tests/helpers.mjs`: Exported `CHECK_VERSION_SYNC_PATH` path constant.
- `tests/version-sync.test.mjs`: Comprehensive `node:test` suite for tri-sync gate and failure fixtures.
- `_bmad-output/initiative-bmad-companion/tickets/epic-verification-harness/tickets/story-version-tri-sync-gate-plan.md`: Story 1.4 plan, review triage log, and auto run result.

### Review Findings Breakdown
- Patches applied: 3 (`[low]` whitespace version check, `[low]` marketplace plugin search predicate, `[low]` syntax check in test).
- Items deferred: 0.
- Items rejected: 0.
- Patched counts by verdict: high 0, medium 0, low 3.

### Follow-up Review Recommendation
- Recommended: false (0 high, 0 medium patches applied; all 35 suite tests passing).

### Verification Performed
- `node scripts/check-version-sync.mjs` -- passed (exited code 0, reported OK for `0.5.3`).
- `node --check scripts/check-version-sync.mjs` -- passed (syntax check exited code 0).
- `node --test tests/version-sync.test.mjs` -- passed (14/14 tests pass).
- `node --test tests/` -- passed (all 35 tests pass across 8 suites in 2.98s with zero npm dependencies).
- Syntax checks across all scripts (`bmad-engine.mjs`, `mcp-server.mjs`, `hook-runner.mjs`, `check-version-sync.mjs`) -- passed.

### Residual Risks
- None. All three version targets are synchronized at `0.5.3` and the automated gate enforces future release synchronization.

