---
title: 'Refactor sweep'
type: chore
ticket: 5
container: epic-mcp-surface
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

**Problem:** After Stories 1-4 the MCP surface carried cleanup debt: (1) `openNewConversationWithPrompt` in `scripts/bmad-engine.mjs` hand-built 11 launch-result object literals and repeated the same failure-detail expression (`(res.stderr || "").trim() || (res.timedOut ? "timeout" : exit_<code>)`) 6 times; (2) tool-error text extraction (`err instanceof Error ? err.message : String(err)`) was copied 3 times across `scripts/mcp-server.mjs` (2x) and `scripts/bmad-engine.mjs` (1x); and (3) every `handleToolCall` branch in `scripts/mcp-server.mjs` assembled its `{ content, structuredContent }` result as an inline literal (7 copies) with the error shape assembled separately. All Story 1-4 plan files record `deferred: []`, so the sweep scope is exactly the ticket's three named items — no deferred review findings were outstanding.

**Approach:** Cleanup only, no new behavior: extract shared helpers so each shape is built in exactly one place — `commandFailureDetail(res)` and `launchOutcome({...})` (module-private) plus exported `errorMessage(err)` in `scripts/bmad-engine.mjs`; `toolResult(text, structuredContent)` and `toolErrorResult(text)` (module-private) in `scripts/mcp-server.mjs` — and route every launch return, error-text extraction, and tool-result assembly through them. Story 4 had already unified workspace confinement into the single exported `resolveWorkspaceArtifactPath` helper and Story 3 had already moved all clipboard code into `scripts/bmad-engine.mjs`; this sweep verified no duplicated confinement or clipboard helper remains across the two files.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added exported `errorMessage(err)` (single tool-error text extraction) and used it in `openWorkspaceArtifactExternally`'s catch.
  - Added module-private `commandFailureDetail(res)` — replaces the 6 duplicated stderr/timeout/exit-code expressions in `openNewConversationWithPrompt`.
  - Added module-private `launchOutcome({ copied, openedDirectly, pasted, method, error })` — single builder for all 11 launch-result returns; coerces booleans and includes the `error` key only when truthy, so every returned object is structurally identical to the pre-sweep shapes asserted by `assert.deepEqual` in `tests/mcp-surface.test.mjs`.
- **`scripts/mcp-server.mjs`:**
  - Added module-private `toolResult(text, structuredContent)` (success shape) and `toolErrorResult(text)` (`isError: true` shape, no `structuredContent`); all 7 success branches and the `tools/call` catch now route through them.
  - Imported `errorMessage` from `./bmad-engine.mjs` for both error-text sites (`tools/call` catch and the JSON-RPC `-32603` catch).
- **Dedup verification (no duplicated confinement or clipboard helper remains):**
  - Confinement: `scripts/mcp-server.mjs` contains zero path-confinement logic (delegates entirely); `scripts/bmad-engine.mjs` has exactly one implementation, `resolveWorkspaceArtifactPath` (line ~2592), consumed by both `inspectWorkspaceArtifact` and `openWorkspaceArtifactExternally`.
  - Clipboard: zero clipboard command references (`pbcopy`/`wl-copy`/`xclip`/`xsel`/`SetDataObject`) in `scripts/mcp-server.mjs`; the failure-detail expression now appears exactly once in `scripts/bmad-engine.mjs` (`commandFailureDetail`), and all launch-result literals are built by `launchOutcome`.
  - `scripts/hook-runner.mjs` was also checked and contains no confinement or clipboard duplication.

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs` — passed (exit 0).
- `node --test tests/` — passed (71/71 tests, 0 failures; run both before the sweep as a green baseline and after the sweep).
- `node scripts/check-version-sync.mjs` — passed (`[check-version-sync] OK: all 3 versions match (0.5.3)`).
- `node ../scripts/validate.mjs` — passed (`bmad-companion v0.5.3 validated`).
- Dedup greps across `scripts/mcp-server.mjs` + `scripts/bmad-engine.mjs` — confirmed single confinement implementation, zero clipboard code in the server, and single failure-detail expression (evidence recorded in Implementation Notes).

## Auto Run Result

- **Summary:** Completed the Epic 2 refactor sweep with zero behavior change: unified tool-error shapes behind exported `errorMessage` plus `toolResult`/`toolErrorResult` in `scripts/mcp-server.mjs`, deduplicated clipboard launch-result construction behind `commandFailureDetail`/`launchOutcome` in `scripts/bmad-engine.mjs`, normalized all 7 `structuredContent` assemblies through one helper, and verified a single confinement implementation (`resolveWorkspaceArtifactPath`) with no duplication remaining across the two scripts. Full suite green (71/71), version sync and repo validation pass.
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `scripts/mcp-server.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-mcp-surface/tickets/plan-5-refactor-sweep.md`
- **Review:** none, no lenses launched (pinned).
