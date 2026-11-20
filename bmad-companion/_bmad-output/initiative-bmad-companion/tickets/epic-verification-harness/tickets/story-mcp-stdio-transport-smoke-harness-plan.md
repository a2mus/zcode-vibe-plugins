---
title: 'MCP stdio transport smoke harness'
type: feature
ticket: 2
created: '2026-11-20'
status: built
baseline_revision: 'bd9312d5b3920442e3e981c86dc45b44f93917dc'
route: full
route_source: auto
risk: medium
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

**Problem:** `bmad-companion` has no automated test for its spawned MCP stdio JSON-RPC 2.0 server (`scripts/mcp-server.mjs`) and `tests/helpers.mjs` lacks a reusable spawned-process transport helper for Epics 2, 3, and 5.

**Approach:** Extend `tests/helpers.mjs` with a bounded, zero-dependency spawned-process MCP stdio runner (`runNodeProcess`, `runMcpServer`, JSON-lines helpers) and add `tests/mcp-transport.test.mjs` to exercise `initialize`, `ping`, `tools/list`, `resources/list`, `resources/read`, protocol error frames, and stdout JSON-RPC isolation against a temp workspace.

## Boundaries & Constraints

**Always:**
- Use only Node 18+ built-in modules (`node:test`, `node:assert/strict`, `node:child_process`, `node:fs`, `node:path`) with zero `package.json` or npm dependencies.
- Spawn `scripts/mcp-server.mjs` with bounded timeouts and isolated `cwd` / `ZCODE_WORKSPACE_ROOT` / `ZCODE_PROJECT_DIR` pointing at a temp workspace cleaned up after each test.
- Assert strict JSON-RPC 2.0 stdout isolation (valid JSON lines only, no blank lines, no CRLF, empty stderr) and clean process exit (`0`).

**Never:**
- Modify `scripts/mcp-server.mjs`, `scripts/bmad-engine.mjs`, `scripts/hook-runner.mjs`, `assets/panel.html`, or upstream skills under `.agents/skills/` / `.zcode/skills/`.
- Leave spawned child processes hanging or temp workspace directories behind after test completion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Handshake + discovery | `initialize` (`protocolVersion: "2024-11-05"`), `ping`, `tools/list`, `resources/list`, `resources/templates/list` on stdin | 5 JSON-RPC 2.0 frames in order (`id` 1..5); `protocolVersion` `"2024-11-05"`; `serverInfo.name` `"bmad-companion"`; `serverInfo.version` matches `.zcode-plugin/plugin.json`; all 9 tool names present; `resources/list` has `ui://bmad-companion/panel.html` with `text/html;profile=mcp-app` and `_meta["zcode/csp"].unsafeEval === false` | Non-zero exit, timeout, or non-JSON stdout fails test |
| Panel resource read | `resources/read` with `uri: "ui://bmad-companion/panel.html"` | 1 content item matching `assets/panel.html` verbatim, `mimeType: "text/html;profile=mcp-app"`, `_meta["zcode/csp"].unsafeEval === false` | Mismatched HTML or missing CSP flag fails test |
| Unknown method / resource / notification | Notification without `id`, `resources/read` with unknown URI, unknown JSON-RPC method, and malformed JSON line | Notification and malformed JSON emit no response frame; unknown URI returns error `-32602`; unknown method returns error `-32601`; server stays alive and answers subsequent valid request | Uncaught crash or leaked non-JSON stdout fails test |
| Timeout guard | `runNodeProcess` / `runMcpServer` given a bounded `timeoutMs` on a non-exiting child | Helper kills child process and rejects with diagnostic timeout error containing stdout/stderr | Never hangs test runner indefinitely |

</intent-contract>

## Code Map

- `tests/helpers.mjs` -- Existing exports: `REPO_ROOT`, `ENGINE_PATH`, `MCP_SERVER_PATH`, `HOOK_RUNNER_PATH`, `PANEL_HTML_PATH`, `createTempWorkspace`, `seedBmadWorkspace` (lines 8-163). Extend with `splitLines`, `toJsonLines`, `parseJsonLines`, `readJsonFile`, `runNodeProcess`, and `runMcpServer` (reused by Epics 2, 3, and 5).
- `tests/mcp-transport.test.mjs` -- New `node:test` file for spawned `scripts/mcp-server.mjs` JSON-RPC 2.0 handshake, tool/resource discovery, `resources/read`, edge-case error handling, and stdout isolation.
- `scripts/mcp-server.mjs` -- Read-only target under test: `TOOLS` (lines 222-620) defines the 9 tools (`bmad_open_companion`, `bmad_get_state`, `bmad_update_advisor`, `bmad_prepare_new_session`, `bmad_reconcile_trackers`, `bmad_recommend_next`, `bmad_inspect_artifact`, `bmad_open_artifact_file`, `bmad_queue_manage`); `rl.on("line")` (lines 851-963) handles `initialize` (echoes `params.protocolVersion` or `"2025-11-25"`), `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, `resources/read` (`_meta["zcode/csp"].unsafeEval: false`), and JSON-RPC error codes `-32601`/`-32602`/`-32603`.
- `.zcode-plugin/plugin.json` -- Read-only manifest (`name: "bmad-companion"`, `version: "0.5.2"`) cross-checked against `serverInfo`.
- `assets/panel.html` -- Read-only panel source cross-checked verbatim against `resources/read` `contents[0].text`.

## Tasks & Acceptance

**Execution:**
- [x] `tests/helpers.mjs` -- Add `splitLines`, `toJsonLines`, `parseJsonLines`, `readJsonFile`, `runNodeProcess` (with `stdio: ["pipe", "pipe", "pipe"]`, `windowsHide: true`, `EPIPE`-safe `stdin.end`, and `timeoutMs` kill guard), and `runMcpServer` targeting `MCP_SERVER_PATH` -- Provides the shared spawned-process MCP stdio transport helper handed off to Epics 2, 3, and 5.
- [x] `tests/mcp-transport.test.mjs` -- Add `node:test` suite driving spawned `scripts/mcp-server.mjs` inside disposable temp workspaces for: (1) `initialize` (`protocolVersion: "2024-11-05"` and fallback echo check), `ping`, `tools/list` (all 9 tool names, descriptions, object schemas, annotations), `resources/list`, and `resources/templates/list`; (2) `resources/read` serving `assets/panel.html` verbatim with `mimeType: "text/html;profile=mcp-app"` and `_meta["zcode/csp"].unsafeEval === false`; (3) I/O edge cases (notifications without `id`, malformed JSON line, `-32602` unknown resource, `-32601` unknown method, timeout guard) and strict JSON-RPC-only stdout / clean stderr assertions -- Verifies Story 1.2 contract and I/O matrix without mutating runtime code.

**Acceptance Criteria:**
- Given a disposable temp workspace and the shipped `scripts/mcp-server.mjs`, when `node --test tests/` spawns the server and sends `initialize` (`2024-11-05`), `ping`, `tools/list`, `resources/list`, `resources/templates/list`, and `resources/read`, then all tests pass with exit code 0, verifying `serverInfo.name`/`version`, all 9 documented tool names, and `ui://bmad-companion/panel.html` MIME and CSP metadata.
- Given valid requests mixed with notifications, malformed JSON lines, unknown URIs, and unknown methods on stdin, when the server responds over stdout, then every stdout line is a single valid JSON-RPC 2.0 frame (`jsonrpc: "2.0"` with `id` and `result` xor `error`), stderr is empty, and all temp workspaces are removed on teardown.

## Implementation Notes

- Extended `tests/helpers.mjs` with `splitLines`, `toJsonLines`, `parseJsonLines`, `readJsonFile`, `runNodeProcess`, and `runMcpServer` using Node built-ins only.
- `runNodeProcess` waits up to `500ms` for the child `close` event after `SIGKILL` on timeout so Windows directory/handle locks release cleanly before temp-workspace teardown.
- Added `tests/mcp-transport.test.mjs` covering `initialize` (`2024-11-05` + `"2025-11-25"` fallback), `ping`, `tools/list` (9 tools), `resources/list`, `resources/templates/list`, `resources/read` (`assets/panel.html` verbatim, `text/html;profile=mcp-app`, ratified `_meta["zcode/csp"].unsafeEval === false` per `OQ-G`), notification/malformed-line/error-frame handling (`-32602`, `-32601`), strict JSON-RPC stdout isolation, and timeout cleanup.

## Plan Change Log

## Review Triage Log

### 2026-11-20 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none

## Design Notes

- **Ratified PRD-vs-code drift (`OQ-A` and `OQ-G` in `architecture-bmad-companion.md`):** `scripts/mcp-server.mjs` echoes `params?.protocolVersion || "2025-11-25"` (line 868) and emits resource CSP metadata under `_meta["zcode/csp"].unsafeEval: false` (lines 920, 946), rather than `_meta.ui.csp`. Because Epic 1 forbids changing runtime `scripts/*.mjs` behavior and `architecture-bmad-companion.md` explicitly instructs `epic-verification-harness` to encode the ratified code behavior (`AD-9`, `AD-14`, `OQ-G`), `tests/mcp-transport.test.mjs` sends `protocolVersion: "2024-11-05"` on `initialize` and asserts `_meta["zcode/csp"].unsafeEval === false` directly (documenting `OQ-G` in comments).

## Verification

**Commands:**
- `node --test tests/` -- expected: all tests in `tests/engine-smoke.test.mjs` and `tests/mcp-transport.test.mjs` pass with exit code 0 on Node 18+ with zero npm dependencies.
- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check tests/helpers.mjs && node --check tests/mcp-transport.test.mjs` -- expected: syntax checks pass with exit code 0.

## Auto Run Result

- **Summary:** Implemented Story 1.2 (MCP stdio transport smoke harness) by extending `tests/helpers.mjs` with a bounded, zero-dependency spawned-process MCP stdio runner (`runNodeProcess`, `runMcpServer`, JSON-lines helpers) and adding `tests/mcp-transport.test.mjs` to verify `initialize`, `ping`, `tools/list`, `resources/list`, `resources/templates/list`, `resources/read`, protocol error frames, timeout cleanup, and strict JSON-RPC 2.0 stdout isolation without modifying any runtime `scripts/*.mjs` files.
- **Files changed:**
  - `tests/helpers.mjs` — Added `splitLines`, `toJsonLines`, `parseJsonLines`, `readJsonFile`, `runNodeProcess`, and `runMcpServer` for reusable spawned-process stdio testing across Epics 2, 3, and 5.
  - `tests/mcp-transport.test.mjs` — Added 5 `node:test` integration tests covering the MCP handshake, 9-tool schema discovery, verbatim panel resource + CSP metadata (`_meta["zcode/csp"].unsafeEval === false`), notification/malformed-input/error-code handling, stdout isolation, and child timeout termination.
  - `_bmad-output/initiative-bmad-companion/tickets/epic-verification-harness/tickets/story-mcp-stdio-transport-smoke-harness-plan.md` — Story plan, review triage log, and run summary.
- **Review findings breakdown:**
  - Quick lens reported 0 findings (0 high, 0 medium, 0 low, 0 false, 0 maybe-false).
  - Patches applied: none.
  - Items deferred: none.
  - Rejected findings: none.
- **Follow-up review recommendation:** `false` (patched counts: high 0, medium 0, low 0).
- **Verification performed:**
  - `node --test tests/` — passed (8/8 tests across 2 suites, 0 failures, Node v26.12.1).
  - `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check tests/helpers.mjs && node --check tests/mcp-transport.test.mjs` — passed (exit code 0).
- **Residual risks:**
  - `tests/mcp-transport.test.mjs` asserts the ratified `_meta["zcode/csp"].unsafeEval === false` host key (`OQ-G` in `architecture-bmad-companion.md`); if `OQ-G` later switches `scripts/mcp-server.mjs` to `_meta.ui.csp`, update the test expectation alongside that change.
  - `runNodeProcess` waits up to `500ms` for child `close` after `SIGKILL` on timeout so Windows directory handles release cleanly before temp cleanup.
