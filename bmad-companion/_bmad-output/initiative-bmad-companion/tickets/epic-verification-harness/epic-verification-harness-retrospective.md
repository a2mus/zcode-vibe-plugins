---
epic: epic-verification-harness
date: 2026-11-23
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospective — epic-verification-harness (Zero-dependency verification harness)

## Epic summary

- **Epic:** `epic-verification-harness` (`id: 1`, `Zero-dependency verification harness`), covering `R1` (parent `R23`) and constraints `C1`, `C6`, `C11`, `C13` (`_bmad-output/initiative-bmad-companion/tickets/epic-verification-harness/epic-verification-harness.md`).
- **Tickets (build order from `tickets.py status`):**
  1. `1.1` — `node:test harness + temp-workspace fixture tracer` (`status: done`, `state: done`, route `oneshot`, review `none`) — range `72f7ca385cf61ea8159fb0daa9b0e0a0276a7043..bd9312d5b3920442e3e981c86dc45b44f93917dc` (Story 1.1 commit `7dc4e0a`; `bd9312d` in range belongs to sibling `vibe-debrief` Story 2.1).
  2. `1.2` — `MCP stdio transport smoke harness` (`status: done`, `state: done`, route `full`, review `quick`) — range `bd9312d5b3920442e3e981c86dc45b44f93917dc..6003edcf74fcdd41ac10100c22aaf138bfe19878` (Story 1.2 commit `111e469`; `20b8c2d` belongs to sibling `vibe-debrief`, `6003edc` is Story 1.3 baseline reset).
  3. `1.3` — `Hook stdout-isolation harness` (`status: done`, `state: done`, route `full`, review `quick`) — range `6003edcf74fcdd41ac10100c22aaf138bfe19878..bea9bf7d1f7cc9855ac0f958695e468b2b33e73b` (Story 1.3 commits `ebf7496`, `71e716c`; `3524276` is out-of-epic `feat(queue)` work, `7331beb` belongs to sibling `vibe-debrief`, `bea9bf7` is Story 1.4 baseline reset).
  4. `1.4` — `Version tri-sync gate` (`status: done`, `state: done`, route `full`, review `quick`) — range `bea9bf7d1f7cc9855ac0f958695e468b2b33e73b..834177a6430aa4807cff101232daa6e41a3f050f` (Story 1.4 commit `834177a`).
  5. `1.5` — `Refactor sweep` (`status: done`, `state: done`, route `full`, review `quick`) — range `834177a6430aa4807cff101232daa6e41a3f050f..ca76e2e` (Story 1.5 commit `ca76e2e`; inferred cut at `ca76e2e`, excluding subsequent `da2e921` sibling `vibe-debrief` Story 3.1 and uncommitted working-tree edits).
- **Tickets still at `built`:** None in `tickets.toml` (`0/5`). Note: in git `ca76e2e`, plans `1.1`, `1.2`, `1.4`, and `1.5` still record `status: built` and currently have uncommitted `status: built -> done` edits in the working tree.
- **Pending tickets:** None (`0/5`).
- **Evidence inventory:**
  - *Available:* `epic-verification-harness.md`, `tickets.toml`, all 5 story plans (`story-*-plan.md`), `git_evidence.py` metrics for all 5 plan ranges, `initiative-bmad-companion.md`, `architecture-bmad-companion.md`, `../scripts/release.mjs`, `AGENTS.md`, `README.md`, and all `scripts/` + `tests/` files.
  - *Missing (narrowed scope):* Separate per-ticket `story_file`s (`file: null` for all 5 entries; requirements come from `tickets.toml` and plan files), `<type>-*/` run folders (none present), prior retrospective (none — this is Epic 1), and session logs (absent — process-lesson analysis is narrowed to commit history and plan notes rather than session transcripts).

## Findings

### Aggregate views

#### Architecture delta
- **Zero-dependency test substrate established cleanly (`AD-1`, `AD-16`):** Across `7dc4e0a..ca76e2e`, Epic 1 added 1 new runtime-adjacent CLI script (`scripts/check-version-sync.mjs`, 139 lines, imports only `node:fs`, `node:path`, `node:process`, `node:url`) and 7 test files under `tests/` (`tests/helpers.mjs` 559 lines; 6 `*.test.mjs` files) with no `package.json` and no external dependencies. Dependency direction holds: `tests/helpers.mjs` imports only `node:*`; `engine-smoke.test.mjs` and `queue-handoff.test.mjs` import `../scripts/bmad-engine.mjs`; `version-sync.test.mjs` imports `../scripts/check-version-sync.mjs`; `mcp-transport.test.mjs` and `hook-stdout-isolation.test.mjs` spawn `mcp-server.mjs` and `hook-runner.mjs` as black-box child processes.
- **Out-of-epic commit interleaved on `main` (`3524276`) & scope bleed into Story 1.5 (`ca76e2e`):** *(Disposition: accept as-is for history; prevent via branching/gate)* Between Story 1.3 (`ebf7496`) and Story 1.4 (`834177a`), commit `3524276` (`feat(queue): implement Stop-hook auto-chain handoff and session tracking`) landed directly on `main` outside Epic 1, bumping the plugin version `0.5.2 -> 0.5.3`, editing `scripts/bmad-engine.mjs`, `scripts/hook-runner.mjs`, `scripts/mcp-server.mjs`, `assets/panel.html`, `skills/bmad-companion/SKILL.md`, and `../marketplace.json`, and adding `tests/queue-handoff.test.mjs` (211 lines). Story 1.5 (`ca76e2e`) then swept `tests/queue-handoff.test.mjs` into its refactoring diff. Furthermore, uncommitted `hostModels` / `tests/model-catalog.test.mjs` WIP currently sits on `main`. While Story 1.5 itself touched zero runtime files, `epic-verification-harness.md` boundary `"Must not change: runtime scripts/*.mjs behavior beyond adding the version-sync script"` was violated in history on `main` by `3524276`.

#### Duplication map
- **Test harness consolidation succeeded (`tests/helpers.mjs`):** *(Disposition: checked and clean)* Story 1.5 (`ca76e2e`) eliminated all per-suite `trackWorkspace` arrays, local `HOOK_RUNNER_PATH` spawn wrappers (`runHook`, `runStopHook`), local stdout-hygiene helpers (`assertStrictJsonRpcStdout`, `assertSingleJsonLine`), and unused imports (`join` in `version-sync.test.mjs`) across all 6 committed `*.test.mjs` suites. Note: the untracked WIP file `tests/model-catalog.test.mjs` imports only `node:test`, `node:assert/strict`, and `../scripts/bmad-engine.mjs` (pure function unit tests, no temp workspaces).

#### God-class / size growth
- **`tests/helpers.mjs` grew to 559 lines across 3 commits (`7dc4e0a` +163, `111e469` +225, `ca76e2e` +172/-3):** *(Disposition: defer)* Currently cohesive (workspace fixture/tracker, process runner, MCP/Hook wrappers, stdout assertions), though `runNodeProcess` (129 lines, `tests/helpers.mjs:252-380`) + `seedBmadWorkspace` (111 lines, `tests/helpers.mjs:93-203`) will keep growing in Epics 2–6 if panel/reconcile/queue fixtures land in the same file. Splitting fixtures from process runners is worth revisiting once Epic 3–4 fixtures arrive.

#### Pattern divergence
- **Live-repo tests hardcode `"0.5.3"` (`tests/version-sync.test.mjs:105, 121`):** *(Disposition: fix now)* While `scripts/check-version-sync.mjs` dynamically compares the three version targets and `../scripts/release.mjs:111-158` updates `marketplace.json`, `plugin.json`, `mcp-server.mjs`, `panel.html`, and root `README.md` on release bumps, `tests/version-sync.test.mjs:105, 121` asserts the literal string `"0.5.3"`. Any coordinated release bump to `0.5.4` will pass `check-version-sync.mjs` and break `node --test tests/`.
- **Non-hermetic host config reads (`tests/helpers.mjs:399-410, 458-473` vs `scripts/bmad-engine.mjs:387, 405, 468`):** *(Disposition: fix now)* `runMcpServer` and `runHookRunner` isolate `ZCODE_WORKSPACE_ROOT`, `ZCODE_PROJECT_DIR`, and `CLAUDE_PROJECT_DIR`, but do not override `HOME`, `USERPROFILE`, `APPDATA`, or `LOCALAPPDATA`. Because `discoverConfiguredModels` (`scripts/bmad-engine.mjs:387, 405, 468`) reads `homedir()/.zcode/v2` and `process.env.LOCALAPPDATA`, spawned MCP/Hook tests read the developer's live machine config instead of an isolated test home.
- **Unverified `node:test` floor below Node 18.13 (`tests/*.test.mjs`):** *(Disposition: defer)* All test suites import `{ afterEach, describe, it } from "node:test"` (`tests/engine-smoke.test.mjs:1`, etc.), while `epic-verification-harness.md:26` specifies `Node 18+` (verified on `v26.12.1`). If Epics/CI run on Node 18.0–18.12, `describe`/`it`/`afterEach` imports should be checked or the minimum floor documented as `Node 18.13+` / `20+`.

#### Spec-to-implementation reconciliation
- **Recorded verification gate absent from `AGENTS.md` and `README.md` (`epic-verification-harness.md:34` vs `AGENTS.md:24`, `README.md:26-32`):** *(Disposition: fix now)* `Done when #1` requires `node --test tests/` to be the recorded verification gate, yet `AGENTS.md:24` still states `"there is no automated test suite or linter"` and `README.md:26-32` lists only `zcode plugins validate .`.
- **Ratified PRD-vs-code drift in `tests/mcp-transport.test.mjs` (`OQ-A`, `OQ-G`):** *(Disposition: accept as-is; keep tracked in PO Epic 2 conflict pass)* `epic-verification-harness.md:30` states `_meta.ui.csp` (`C13`), while `scripts/mcp-server.mjs:932, 958` emits `_meta["zcode/csp"].unsafeEval: false` (`OQ-G`) and `mcp-server.mjs:880` echoes `protocolVersion` with fallback `"2025-11-25"` (`OQ-A`). Per `architecture-bmad-companion.md:287`, Story 1.2 encoded the shipped runtime contract and documented `OQ-G`.
- **Hook stdout contract wording in `1.3` ticket (`tickets.toml` vs `hook-runner.mjs:97, 134, 155, 215, 250`):** *(Disposition: propose spec reconciliation)* Ticket `1.3`'s `description` states all four hooks emit `"the expected additionalContext shape"`, whereas `hook-runner.mjs` emits `{ additionalContext }` only on `session-start` and `{}` (or `{ decision: "block", reason }` on queue continuation) for the others. Story 1.3 Design Notes already documented this and tested the real contract.
- **`normalizeStatus("built")` dead branch (`scripts/bmad-engine.mjs:1150-1157, 1487` vs `tests/helpers.mjs:180, 184`):** *(Disposition: defer to Epic 3)* `normalizeStatus("built")` returns `"backlog"`, making `planStatus === "built"` at `bmad-engine.mjs:1487` unreachable. Story 1.1 seeded `status: done` in `tests/helpers.mjs:180` while leaving comment `"Seeded story plan proving built status reconciliation."` at `tests/helpers.mjs:184`.
- **`check-version-sync.mjs` scope vs `C6` / `AD-14` (`scripts/check-version-sync.mjs` vs `AGENTS.md:11`, `architecture-bmad-companion.md:137, 276`):** *(Disposition: accept as-is / defer)* `scripts/check-version-sync.mjs` checks `version` across the 3 files named in Story 1.4 (`plugin.json`, `marketplace.json`, `mcp-server.mjs`), matching `Done when #4`, but does not verify synchronized `description` fields (`C6`) or `assets/panel.html:1173, 1412` (`appInfo.version` and title banner joined to the sync set in `AD-14`).

---

### Code-review lenses (`bmad-review`)

#### Adversarial & Edge-Case Hunter (consolidated, source-verified)
1. **`scripts/check-version-sync.mjs:82-90` — fragile `serverInfo` regex:** *(Disposition: defer)* `content.match(/serverInfo\s*:\s*\{([^}]*)\}/)` stops at the first `}` and could match a comment containing `serverInfo` or fail if a nested object is added inside `serverInfo`; the version regex `\bversion\s*:\s*["'\`]?([^"'\`,\s]+)["'\`]?` accepts asymmetric or missing quotes and truncates values containing whitespace.
2. **`scripts/check-version-sync.mjs:98-104` — partial comparison & `serverInfo.name`:** *(Disposition: defer)* Equality comparison runs only when all three versions are non-null, masking a drift between two readable files when the third is missing/unparseable; `serverInfo.name` is not checked. Also at `:60`, duplicate plugin entries with the same `name` in `marketplace.json` silently use the first match.
3. **`scripts/check-version-sync.mjs:119-130` — symlink `isMain` & CLI flags:** *(Disposition: defer)* Comparing `resolve(process.argv[1])` without `realpathSync` skips CLI execution when invoked via a symlink/junction, and flags like `--help` are treated as a directory path.
4. **`tests/helpers.mjs:298-321` — process-tree kill & `timeoutMs` validation:** *(Disposition: defer)* `runNodeProcess` sends `SIGKILL` only to the immediate child PID (`child.kill("SIGKILL")`), not descendant processes (which matters once Epic 2–3 tests spawn `git` or `powershell.exe` children), and `timeoutMs <= 0` or `NaN` silently disables the timeout.
5. **`tests/helpers.mjs:339-341, 364-378` — stream error handling & `stdin: null`:** *(Disposition: defer)* `stdout`/`stderr` lack `"error"` listeners, `child.stdin` swallows non-`EPIPE` errors silently, and passing `stdin: null` with default `keepStdinOpen: false` leaves stdin open instead of closing it (`tests/mcp-transport.test.mjs:220` relies on this behavior to induce timeout).
6. **`tests/helpers.mjs:28-43, 263, 459` — workspace helper confinement & `null` overrides:** *(Disposition: defer)* `createTempWorkspace().write/read/exists` does not guard against `..` escaping `root`; `rmSync` retry budget is `3 * 50ms = 150ms`; `env` filtering at `:263` drops `undefined` but passes `null` as `"null"`; `runHookRunner` at `:459` passes `mode: null` as `["null"]`.
7. **`tests/mcp-transport.test.mjs:193-209` — 200ms timeout/flush race:** *(Disposition: fix now)* Asserting `err.stdout.includes('"id":1')` after `timeoutMs: 200` couples cold-start ESM import + `bmad-engine.mjs` load time to timeout capture, risking flakiness on loaded CI or Windows Defender scans.

#### Verification-Gap Lens (source-verified)
1. **`tests/version-sync.test.mjs:91-96` & `tests/helpers.mjs:11` — incomplete `node --check` gate (`broken-verification-gap`):** *(Disposition: fix now)* `runNodeSyntaxCheck` is called only on `CHECK_VERSION_SYNC_PATH`, asserting `ok === true` and `code === 0` (which `check-version-sync.mjs` also returns when run *without* `--check`), and is never wired for `ENGINE_PATH` (unused across all `tests/*.test.mjs`), `MCP_SERVER_PATH`, or `HOOK_RUNNER_PATH`. A regression dropping `--check` in `runNodeProcess` or a syntax error in `bmad-engine.mjs` passes the suite.
2. **`tests/hook-stdout-isolation.test.mjs:92-110` — env-stripping never tested under populated host env (`broken-verification-gap`):** *(Disposition: fix now)* `hook-stdout-isolation.test.mjs:108` assumes `runHookRunner` strips `OPENAI_API_KEY`, `BMAD_COMPANION_OPENAI_KEY`, `ZCODE_SESSION_ID`, and `CLAUDE_SESSION_ID`, but no test sets those keys in `process.env` to verify `runNodeProcess` / `runHookRunner` actually strips them.
3. **`scripts/check-version-sync.mjs:21, 59, 77` — untested branches (`regression-gap`):** *(Disposition: defer)* `tests/version-sync.test.mjs` never passes `omitMcpServer: true` (exists check at `:77`), `invalidMarketplaceJson` / missing `plugins` array / missing plugin entry in `marketplace.json` (`:59-62`), or `options.{pluginJsonPath, marketplacePath, mcpServerPath}` (`:21-23`).
4. **`tests/helpers.mjs:496-558` — untested negative paths on stdout assertion helpers (`regression-gap`):** *(Disposition: defer)* `tests/helpers.test.mjs` covers only `createTempWorkspaceTracker.cleanup()`, leaving negative rejection paths in `assertCleanJsonLinesStdout` (CRLF, blank lines), `assertSingleJsonObjectStdout` (arrays), and `assertStrictJsonRpcStdout` (`result` + `error` together) unpinned by unit tests.
5. **`tests/mcp-transport.test.mjs:75-189` & `tests/hook-stdout-isolation.test.mjs:18-142` — unexercised adapter paths:** *(Disposition: defer to Epics 2 & 6)* `mcp-transport.test.mjs` does not send `tools/call` (deferred to Epic 2), and `hook-stdout-isolation.test.mjs` does not test omitted CLI mode, `transcript_path` fallback, `toolInput.file_path`, or `ZCODE_SESSION_ID` / unowned-session `Stop` paths (deferred to Epic 6).

## Behavior verification

Executed directly against the workspace on Node `v26.12.1` (Windows `win32`):
1. **Syntax trio + version gate:** `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs` — **exit 0**.
2. **Version tri-sync happy path:** `node scripts/check-version-sync.mjs` — **exit 0**, stdout: `[check-version-sync] OK: all 3 versions match (0.5.3)`.
3. **Version tri-sync deliberate mismatch (live CLI spawn on isolated temp fixture):** bumped `plugin.json` to `0.5.4` against `0.5.3` in `marketplace.json` and `mcp-server.mjs` — **exit 1**, stderr: `[check-version-sync] ERROR: version tri-sync check failed: - Version mismatch: plugin.json=0.5.4, marketplace.json=0.5.3, mcp-server.mjs=0.5.3`.
4. **Targeted Epic 1 + refactored suites:** `node --test tests/engine-smoke.test.mjs tests/helpers.test.mjs tests/mcp-transport.test.mjs tests/hook-stdout-isolation.test.mjs tests/version-sync.test.mjs tests/queue-handoff.test.mjs` — **36/36 passed** across 9 suites in ~3.9s (0 failed, 0 skipped).
5. **One-command full gate (`Done when #1`):** `node --test tests/` — **45/45 passed** across 13 suites in ~3.95s (including the 9 unit tests in untracked working-tree `tests/model-catalog.test.mjs`), 0 failed, 0 skipped.

## Previous-retro follow-through

No previous retrospective exists because `epic-verification-harness` is Epic 1 (`after: []`).

## Action items

Proposed below for human confirmation / execution — none auto-applied during this retrospective:

1. **[Fix now — Remediation] Remove hardcoded `"0.5.3"` in `tests/version-sync.test.mjs:105, 121`** *(Owner: Dev / `bmad-build`)*
   - Read the live version from `.zcode-plugin/plugin.json` instead of hardcoding `"0.5.3"`, so `../scripts/release.mjs` version bumps do not break `node --test tests/`.
2. **[Fix now — Remediation] Isolate `HOME` / `USERPROFILE` / `APPDATA` / `LOCALAPPDATA` in `runMcpServer` & `runHookRunner` (`tests/helpers.mjs:399-410, 458-473`) and add env-stripping regression test (`tests/helpers.test.mjs`)** *(Owner: Dev / `bmad-build`)*
   - Point user-config env vars at an isolated subdir under `isolatedRoot` (unless overridden in `env`) so `discoverConfiguredModels` never reads host `~/.zcode/v2` configs during tests, and add a `process.env` leak test proving `OPENAI_API_KEY`/`ZCODE_SESSION_ID`/`CLAUDE_SESSION_ID` are stripped.
3. **[Fix now — Remediation] Wire `runNodeSyntaxCheck` for all runtime scripts + negative test (`tests/version-sync.test.mjs:91-96` or `tests/helpers.test.mjs`) and deflake the 200ms timeout test (`tests/mcp-transport.test.mjs:193-209`)** *(Owner: Dev / `bmad-build`)*
   - Run `runNodeSyntaxCheck` across `ENGINE_PATH`, `MCP_SERVER_PATH`, `HOOK_RUNNER_PATH`, and `CHECK_VERSION_SYNC_PATH` (asserting `stdout === ""` and invalid-syntax rejection), and separate stdout-capture verification from the 200ms cold-start timeout in `mcp-transport.test.mjs`.
4. **[Fix now — Docs sync] Record `node --test tests/` as the verification gate in `AGENTS.md:24` and `README.md:26-32`** *(Owner: PO / `bmad-project-context`)*
   - Replace `"there is no automated test suite or linter"` in `AGENTS.md:24` and document `node --test tests/` + `node scripts/check-version-sync.mjs` in `README.md`.
5. **[Process lesson — Clean branch/epic hygiene] Commit or stash out-of-epic WIP before opening Epic 2 (`bmad-agent-po` / `bmad-build-auto`)** *(Owner: Repo owner / PO)*
   - `3524276` landed directly on `main` mid-epic, and uncommitted `hostModels` / `model-catalog.test.mjs` edits + 4 plan `status: done` diffs currently dirty `main`. Clean up the working tree and avoid landing non-epic code commits on `main` mid-epic.
6. **[Spec reconciliation — Proposed] Clarify Story `1.3` `tickets.toml` description (`additionalContext` only on `session-start`) and `Done when` / `C6` alignment** *(Owner: PO / `bmad-agent-po`)*
   - Update `epic-verification-harness/tickets/tickets.toml` entry `1.3` wording (`{ additionalContext }` on `session-start`, `{}` / `{ decision, reason }` on others) and decide during Epic 2 PO conflict resolution whether `check-version-sync.mjs` should stay 3-target (`Done when #4`) or expand to `assets/panel.html` (`AD-14`) and `description` (`C6`).
7. **[Deferred — Backlog for Epics 2–6]**
   - Harden `tests/helpers.mjs` process-tree kill (`taskkill /T` / process-group `-pid`), `stdin: null` vs `keepStdinOpen`, `null` env stripping, workspace `..` confinement, and unit tests for stdout assertion helpers before Epics 2–3 build heavier tests on top of `helpers.mjs`.
   - Harden `scripts/check-version-sync.mjs` (`serverInfo` comment/brace parsing, `options.*Path` / `omitMcpServer` / malformed `marketplace.json` tests) and check `node:test` compatibility on Node 18.0–18.12 (`describe`/`it`/`afterEach`) vs pinning Node `>=18.13` / `>=20`.
   - Resolve `normalizeStatus("built")` dead branch in `scripts/bmad-engine.mjs:1150, 1487` and update `tests/helpers.mjs:180, 184` in `epic-dual-progress-reconciliation` (Epic 3).

## Decision records

No new decision record (`adr-*.md`) passes the ADR threshold (`hard to reverse, surprising without context, and the result of a real trade-off, not already recorded`):
- Encoding `_meta["zcode/csp"].unsafeEval === false` and `protocolVersion` echo in `tests/mcp-transport.test.mjs` (`Story 1.2 Design Notes`) implements `OQ-G` and `OQ-A` already recorded in `_bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md` (`AD-9`, `AD-14`).
- Seeding `status: done` in `tests/helpers.mjs:180` (`Story 1.1 Implementation Notes`), using `user-prompt` for malformed stdin and stripping API keys in `runHookRunner` (`Story 1.3`), regex extraction in `scripts/check-version-sync.mjs` (`Story 1.4`), and `createTempWorkspaceTracker` LIFO API (`Story 1.5`) are local, easily reversible harness details.

## Acceptance verdict

- **Verdict:** `accepted-with-open-items`
- **Criteria basis:** `declared` (`epic-verification-harness.md` Requirements & `Done when`)
- **Evidence:** All 5 tickets (`1.1`–`1.5`) are `done` in `tickets.toml` with zero `pending_tickets`. Every `Done when` item (1–4) was directly verified green (`45/45` full suite, `36/36` Epic 1 + queue suites, `node --check` exit 0 on all 4 scripts, `check-version-sync.mjs` exit 0 on synced repo and exit 1 on bumped fixture). Held from clean `accepted` because of open items that affect release safety and test hermeticity (hardcoded `"0.5.3"` in `version-sync.test.mjs`, host `HOME`/`LOCALAPPDATA` leak in `runMcpServer`/`runHookRunner`, incomplete `runNodeSyntaxCheck` coverage across core scripts, 200ms timeout flush race, and stale `"no automated test suite"` text in `AGENTS.md`/`README.md`).

## Open questions

1. Should the 3 "Fix now" test-harness items (Items 1–3 above) be patched before closing Epic 1 (`bmad-agent-po`), or tracked as opening cleanup before Epic 2 starts?
2. Should `scripts/check-version-sync.mjs` expand to check `assets/panel.html` (`AD-14`) and `description` (`C6`), or stay scoped to the 3 version targets (`Done when #4`)?
3. What should happen to the uncommitted `hostModels` / `tests/model-catalog.test.mjs` WIP and the 4 uncommitted plan `status: done` edits currently on `main`?
