---
title: 'Epic 1 Retrospective Test-Harness Remediation'
type: bugfix
ticket: ''
created: '2026-11-23'
status: built
baseline_revision: '799747aee28ac2f608a60dd54d4ef29b7d35ebc9'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran:
  - quick
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-bmad-companion/tickets/epic-verification-harness/epic-verification-harness-retrospective.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 1's retrospective (`epic-verification-harness-retrospective.md`) left three open test-harness defects: `tests/version-sync.test.mjs` hardcodes `"0.5.3"` and only syntax-checks `check-version-sync.mjs`, `tests/helpers.mjs` leaks host `HOME`/`LOCALAPPDATA` configs into `runMcpServer`/`runHookRunner` without an env-stripping regression test, and `tests/mcp-transport.test.mjs` couples cold-start `bmad-engine.mjs` loading to a 200ms stdout-capture timeout race.

**Approach:** Read the live version from `.zcode-plugin/plugin.json` and wire `runNodeSyntaxCheck` across all four runtime scripts (with negative syntax rejection) in `tests/version-sync.test.mjs`, isolate `HOME`/`USERPROFILE`/`APPDATA`/`LOCALAPPDATA` in `runMcpServer`/`runHookRunner` with an env-stripping and home-isolation regression test in `tests/helpers.test.mjs`, and decouple deterministic timeout stdout/stderr retention from the 200ms cold-start timeout in `tests/mcp-transport.test.mjs`.

</frozen-after-approval>

## Implementation Notes

- Routed `oneshot` (`route_source: auto`): ~90 lines across 4 existing test/helper files (`tests/version-sync.test.mjs`, `tests/helpers.mjs`, `tests/helpers.test.mjs`, `tests/mcp-transport.test.mjs`), zero runtime `scripts/*.mjs` changes, and straightforward mechanical remediation from `epic-verification-harness-retrospective.md` action items 1–3.
- Updated `tests/version-sync.test.mjs` to read the expected version dynamically from `.zcode-plugin/plugin.json`, run `runNodeSyntaxCheck` across `ENGINE_PATH`, `MCP_SERVER_PATH`, `HOOK_RUNNER_PATH`, and `CHECK_VERSION_SYNC_PATH` (checking empty stdout/stderr), and assert invalid JS syntax fails `runNodeSyntaxCheck`.
- Isolated `HOME`, `USERPROFILE`, `APPDATA`, and `LOCALAPPDATA` to `join(isolatedRoot, ".test-home")` in `runMcpServer` and `runHookRunner` (`tests/helpers.mjs`) and added host env-stripping + home-isolation regression tests in `tests/helpers.test.mjs`.
- Separated the `200ms`/`150ms` `ETIMEDOUT` assertions from deterministic `stdout`/`stderr` capture verification (`emit-and-hang.mjs`, `400ms` timeout) in `tests/mcp-transport.test.mjs`.

## Plan Change Log

## Review Triage Log

- Quick review pass (`lenses_ran: [quick]`): 0 high, 2 medium, 0 low, 0 false, 0 maybe-false.
  1. `[medium -> patch]` `tests/helpers.test.mjs`: `BMAD_COMPANION_OPENAI_BASE` did not match `BMAD_COMPANION_OPENAI_BASE_URL` read by `scripts/hook-runner.mjs:25`. Patched to `BMAD_COMPANION_OPENAI_BASE_URL` and added an explicit `env: { OPENAI_API_KEY }` positive control reaching the local mock endpoint (`llmRequestCount === 1`, `agentAdvisorOverride.headline === "Mock synthesis"`).
  2. `[medium -> patch]` `tests/helpers.test.mjs`: `stop` mode treats empty `currentSessionId` as `ownsTask === true`, and `/bmad-build` was rewritten to `/bmad-build-auto` in `effectivePrompt`. Patched to test `user-prompt` mode task claiming (verifying persisted `items[].sessionId ?? null === null` when stripped vs `"sess_explicit"` when explicitly passed via `env`).

## Verification

**Commands:**
- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs` -- expected: exit 0 with empty stdout/stderr
- `node --test tests/` -- expected: all suites pass (0 failed, 0 skipped)
- `node scripts/check-version-sync.mjs` -- expected: exit 0 reporting synced versions
