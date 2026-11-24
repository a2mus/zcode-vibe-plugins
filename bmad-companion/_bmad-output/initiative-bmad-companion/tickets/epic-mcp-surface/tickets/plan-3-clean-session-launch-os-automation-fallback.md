---
title: 'Clean-session launch + OS automation fallback'
type: feature
ticket: 3
container: epic-mcp-surface
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
warnings:
  - 'HITL manual check not run in headless win32 subagent: live ZCode UI launch and keystroke blocking observation on win32/darwin/linux require interactive human verification.'
deferred: []
---

<intent-contract>

## Intent

**Problem:** `bmad_prepare_new_session` in `scripts/mcp-server.mjs` had three reliability gaps: (1) on `win32`, `Clipboard::SetDataObject` and `SendKeys::SendWait` ran under `$ErrorActionPreference = 'Stop'` without tracking clipboard success, returning `copied: false` (`win32-failed`) whenever keystrokes were blocked or timed out; (2) `runCommandAsync` lacked `child.stdin` `EPIPE` error guards, stream destruction on timeout, and explicit `timedOut` diagnostics; and (3) `rl.on("line", ...)` processed stdio JSON-RPC requests concurrently, allowing a synchronous `bmad_get_state` call to overtake an async `bmad_prepare_new_session` response.

**Approach:** Extract `runCommandAsync`, `openNewConversationWithPrompt`, and `prepareNewSession` into `scripts/bmad-engine.mjs` behind the thin `bmad_prepare_new_session` MCP adapter in `scripts/mcp-server.mjs`, serialize stdio JSON-RPC line processing, emit a flushed `BMAD_CLIPBOARD_OK` marker on `win32` before `try/catch` around `SendKeys` so blocked/timed-out keystrokes fall back to `copied: true` (`win32-clipboard-only`), harden `darwin` (`pbcopy`+`osascript`) and `linux` (`wl-copy`/`xclip`/`xsel`+`xdotool`) timeouts and error reporting, and cover all paths in `tests/mcp-surface.test.mjs`.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `runCommandAsync` with `child.stdin` error protection (`EPIPE`-safe), stream destruction and `SIGKILL` cleanup on timeout, `timedOut` flag, and partial stdout retention.
  - Added `openNewConversationWithPrompt(promptText, openDirectly, deps)` supporting `win32` (`powershell.exe` `Clipboard::SetDataObject` + flushed `BMAD_CLIPBOARD_OK` marker + `try/catch` `SendKeys` `^n`/`^v` with 8000ms timeout and `win32-clipboard-only` fallback), `darwin` (`pbcopy` 3000ms + `osascript` 6000ms + `darwin-clipboard-only` fallback), and `linux` (`wl-copy`/`xclip`/`xsel` + `xdotool` 2500ms timeouts + `linux-clipboard-only`/`linux-xdotool-ctrl-n-only` fallback), with zero auto-submissions (`SM-4`) and whitespace/empty prompt guard (`empty_prompt`).
  - Added `prepareNewSession(workspaceRoot, args, deps)` persisting `lastLaunchedSession` (`requestedAt`, `prompt`, `model`, `skill`, `title`) via `savePersistedState` (OQ-B, C4) before invoking OS automation.
- **`scripts/mcp-server.mjs`:**
  - Replaced inline `runCommandAsync` / `openNewConversationWithPrompt` with `prepareNewSession` imported from `./bmad-engine.mjs`.
  - Serialized `rl.on("line", ...)` through `processLine` + `lineQueue` so consecutive JSON-RPC requests preserve response ordering and state visibility.
- **`tests/mcp-surface.test.mjs`:**
  - Added 6 `node:test` cases under `bmad_prepare_new_session & clean-session launch (Epic 2 Story 3)` covering MCP stdio `lastLaunchedSession` persistence & empty prompt guard, `win32`/`darwin`/`linux` command invocations/timeouts/blocked-keystroke clipboard-only fallbacks/zero auto-submit, real child-process `runCommandAsync` timeout + `EPIPE` safety, and `assets/panel.html` fallback toast contract.

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check tests/mcp-surface.test.mjs` — passed (exit 0).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — passed (68/68 tests, 0 failures; `[check-version-sync] OK: all 3 versions match (0.5.3)`; `bmad-companion v0.5.3 validated`).
- `node --test tests/` — passed (68/68 tests, 0 failures).

**Not Run (HITL / Cross-OS Interactive Observation):**
- Interactive ZCode UI launch observation on `win32`, `darwin`, and `linux` (confirming a fresh session opens pre-pasted without auto-submit and observing the toast when OS keystrokes are blocked) was not run in this headless `win32` subagent session.

## Auto Run Result

- **Summary:** Hardened `bmad_prepare_new_session` via `runCommandAsync`, `openNewConversationWithPrompt`, and `prepareNewSession` in `scripts/bmad-engine.mjs` and serialized stdio JSON-RPC line handling in `scripts/mcp-server.mjs`, delivering `win32`/`darwin`/`linux` clipboard-only fallbacks (`copied: true`), bounded timeouts (`8000`/`6000`/`2500`ms), `EPIPE` safety, and zero auto-submissions, verified by 6 new tests in `tests/mcp-surface.test.mjs` (68/68 total passing). Interactive cross-OS ZCode UI HITL checks remain not run.
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `scripts/mcp-server.mjs`
  - `tests/mcp-surface.test.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-mcp-surface/tickets/plan-3-clean-session-launch-os-automation-fallback.md`
- **Review:** none, no lenses launched (pinned).
