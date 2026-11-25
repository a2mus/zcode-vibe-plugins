---
title: 'Closing end-to-end suite (UJ-1-UJ-4 tracer paths)'
type: story
ticket: 7
container: epic-hooks-model-router
created: '2026-11-25'
status: done
baseline_revision: '2ef7728a82ea7f1481a7bce7e568317df1fdf71b'
route: oneshot
route_source: pinned
risk: medium
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

**Problem:** Epics 1–6 verified each runtime layer (`bmad-engine.mjs`, `mcp-server.mjs`, `hook-runner.mjs`, `assets/panel.html`, `check-version-sync.mjs`) individually, but lacked the closing cross-epic end-to-end suite exercising the four PRD user journeys (`UJ-1`–`UJ-4`) together across hooks, MCP stdio, panel polling guards, tracker reconciliation, execution queue + review gates, and workspace-confined artifact diffing to prove `SM-1`–`SM-5` under the initiative's one-command verification gate (`R23`).

**Approach:**
1. Add `tests/e2e-journeys.test.mjs` using zero-dependency `node:test` and `tests/helpers.mjs` (`createTempWorkspaceTracker`, `runMcpServer`, `runHookRunner`, `assertStrictJsonRpcStdout`, `assertSingleJsonObjectStdout`).
2. Prove `C7` inline script parseability (`new Function(extractInlineScript(PANEL_HTML))`) and wire a zero-eval stubbed DOM harness to real spawned `mcp-server.mjs` stdio (`bmad_get_state`) and injectable `prepareNewSession` (`bmad_prepare_new_session`) for `UJ-1`.
3. Exercise `UJ-1` (`SM-1`, `SM-2`, `SM-4`), `UJ-2` (`SM-3`), `UJ-3` (`SM-5`), and `UJ-4` (`R7`, `R8`, `R17`, `C3`) end-to-end.
4. Update `README.md` Validation section to reflect `tests/e2e-journeys.test.mjs` inside the `node --test "tests/*.test.mjs"` one-command verification gate.

</intent-contract>

## Implementation Notes

- **`tests/e2e-journeys.test.mjs`:**
  - `UJ-1 (SM-1, SM-2, SM-4)`: Seeds a workspace with a Product Brief, pushes live `hostModels` via `bmad_update_advisor`, checks `bmad_recommend_next` (`SM-1`: 100% `/bmad-<skill> "<prompt>"` + `providerId/modelId`), runs `session-start` and `stop` hooks, drives `assets/panel.html` through an in-flight 5s background poll + `ui/notifications/tool-result` while `rec-cmd-0` is focused and `rec-model-0` is changed (`SM-2`: `isUserInteractingWithForm()`, `pendingWorkspaceState` stash, `<= 100ms` deferred flush, zero lost edits), clicks the rendered `button[data-action="launch-new-rec"]` to invoke `bmad_prepare_new_session`, and verifies `lastLaunchedSession` persistence + `< 5000ms` launch velocity with zero auto-submit (`SM-4`) alongside a real MCP stdio `bmad_prepare_new_session({ openDirectly: false })` call.
  - `UJ-2 (SM-3)`: Seeds a dual v6 + v7 workspace with comments, summary headers, story plans, and a passing test report; confirms `bmad_get_state` shows smart-vs-static lag; runs `bmad_reconcile_trackers({ dryRun: true })` with zero disk writes; runs live `bmad_reconcile_trackers({ dryRun: false, target: "all", backup: true })` and verifies byte-for-byte `.bak` backups, preserved comments/unrelated keys, updated summary headers, `reconciliation-log.json` audit record, and clean re-scan alignment.
  - `UJ-3 (SM-5)`: Seeds `epic-auth`, queues pending stories via `bmad_queue_manage` (`add-epic`), configures per-task models and all three `reviewMode` levels (`none`, `quick`, `thorough`), compiles `.zcode/workflows/bmad-task-queue.dwf.ts` + `.zcode/bmad-companion/queue-step-updater.mjs` via `start-queue` (`dynamic-workflow`), switches to `separate-sessions`, and drives `user-prompt` -> `post-tool` -> `stop` hooks to assert 100% `taskQueue` ↔ `storyOverrides` sync and next-task handoff.
  - `UJ-4 (R7, R8, R17, C3)`: Initializes a git repository in a seeded workspace, edits a tracked PRD artifact, and verifies `bmad_get_state` discovery (`/` paths), `bmad_inspect_artifact` working-tree `git diff` + frontmatter metadata, `../` traversal rejection on `bmad_inspect_artifact` and `bmad_open_artifact_file`, and `openWorkspaceArtifactExternally` launcher invocation.
- **`README.md`:** Documented `tests/e2e-journeys.test.mjs` (`UJ-1`–`UJ-4`, `SM-1`–`SM-5`) in the `Validation` section for `node --test "tests/*.test.mjs"`.

## Verification

- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs && node --check tests/e2e-journeys.test.mjs` — passed (exit 0).
- `node --test "tests/*.test.mjs"` — passed (161/161 tests, 41 suites, 0 failures; includes 5/5 in `tests/e2e-journeys.test.mjs`).
- `node scripts/check-version-sync.mjs` — passed (`[check-version-sync] OK: all 3 versions match (0.5.4)`).
- `node ../scripts/validate.mjs` — passed (`bmad-companion v0.5.4`, `vibe-debrief v0.4.0`, `project-colors v0.1.0` validated).
