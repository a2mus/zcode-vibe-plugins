---
title: 'Refactor sweep'
type: refactor
ticket: 5
created: '2026-11-23'
status: done
baseline_revision: '834177a6430aa4807cff101232daa6e41a3f050f'
route: full
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stories 1.1–1.4 and the queue-handoff suite accumulated duplicated workspace-tracking boilerplate, inconsistent `cleanup()` error handling, duplicate `HOOK_RUNNER_PATH` spawn wrappers, repeated stdout-hygiene assertions, and minor naming/import quirks (`runNodeProcess("--check", ...)`, unused `join`) across `tests/`.

**Approach:** Consolidate shared workspace tracking/teardown, `runHookRunner`, `runNodeSyntaxCheck`, and stdout-frame assertions into `tests/helpers.mjs`, then update all five `tests/*.test.mjs` suites to consume those canonical helpers without changing any runtime code or test behavior.

## Boundaries & Constraints

**Always:**
- Keep tests zero-dependency using Node 18+ built-ins (`node:*`) only (no `package.json`).
- Preserve all 35 existing test cases, their isolation guarantees (`ZCODE_*`/`CLAUDE_*` pinning, `OPENAI_API_KEY`/`BMAD_COMPANION_OPENAI_KEY` stripping), and exact failure assertions.
- Leave every temp workspace removed after each test via normalized teardown in `tests/helpers.mjs`.

**Never:**
- Modify `scripts/*.mjs`, `assets/panel.html`, `hooks/hooks.json`, `.zcode-plugin/plugin.json`, `../marketplace.json`, or upstream skills.
- Add new features, new test behaviors, or alter the production contracts verified by Stories 1.1–1.4 and queue-handoff.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tracked workspace teardown | Multiple tracked temp workspaces in one test | `cleanup()` removes all workspaces in LIFO order even if one throws | Re-throws first cleanup error only after all remaining cleanups run |
| Hermetic hook runner | `runHookRunner({ workspaceRoot, mode, payload, env })` | Strips `CLAUDE_SESSION_ID`, `OPENAI_API_KEY`, `BMAD_COMPANION_OPENAI_KEY` unless overridden in `env`; returns `{ ...res, lines, frames, parseError }` | Bounded `timeoutMs` kills child and rejects with `ETIMEDOUT` |
| Syntax check helper | `runNodeSyntaxCheck(scriptPath)` | Spawns `node --check <scriptPath>` via `runNodeProcess` with `nodeArgs: ["--check"]` | Non-zero exit or syntax error reported via standard `{ ok, code, stderr }` |

</frozen-after-approval>

## Code Map

- `tests/helpers.mjs` -- Central harness exports (`REPO_ROOT`, `*_PATH`, `createTempWorkspace`, `seedBmadWorkspace`, `splitLines`, `toJsonLines`, `parseJsonLines`, `readJsonFile`, `runNodeProcess`, `runMcpServer`). Extend with `createTempWorkspaceTracker`, `runNodeSyntaxCheck` (via `nodeArgs` on `runNodeProcess`), `runHookRunner`, `assertCleanJsonLinesStdout`, `assertSingleJsonObjectStdout`, and `assertStrictJsonRpcStdout`; add `maxRetries: 3, retryDelay: 50` to `createTempWorkspace().cleanup()`.
- `tests/engine-smoke.test.mjs` -- Replace local `workspaces`/`trackWorkspace`/`afterEach` (L9-21) with `createTempWorkspaceTracker(afterEach)`.
- `tests/mcp-transport.test.mjs` -- Replace local `workspaces`/`trackWorkspace`/`afterEach` (L16-28) and `assertStrictJsonRpcStdout` (L34-59) with `tests/helpers.mjs` imports.
- `tests/hook-stdout-isolation.test.mjs` -- Replace local `workspaces`/`trackWorkspace`/`afterEach` (L15-27), `runHook` (L36-49), and `assertSingleJsonLine` (L56-75) with `createTempWorkspaceTracker`, `runHookRunner`, and `assertSingleJsonObjectStdout`.
- `tests/queue-handoff.test.mjs` -- Replace local `workspaces`/`trackWorkspace`/`afterEach` (L20-32), `runStopHook` (L55-69), and repeated `parseJsonLines` frame checks (L152-157, L182-184, L204-206) with `createTempWorkspaceTracker`, `runHookRunner`, and `assertSingleJsonObjectStdout`; align `describe` prefix to `"bmad-companion queue handoff chain"`.
- `tests/version-sync.test.mjs` -- Remove unused `join` import (L4), replace local `workspaces`/`trackWorkspace`/`afterEach` (L14-28) with `createTempWorkspaceTracker(afterEach)`, and replace `runNodeProcess("--check", ...)` (L107-109) with `runNodeSyntaxCheck(CHECK_VERSION_SYNC_PATH)`.

## Tasks & Acceptance

**Execution:**
- [x] `tests/helpers.mjs` -- Add `maxRetries`/`retryDelay` to `createTempWorkspace().cleanup()`, add `nodeArgs` option to `runNodeProcess`, and export `createTempWorkspaceTracker`, `runNodeSyntaxCheck`, `runHookRunner`, `assertCleanJsonLinesStdout`, `assertSingleJsonObjectStdout`, and `assertStrictJsonRpcStdout` -- Centralizes fixture teardown, process spawning, and stdout-hygiene assertions across all test suites.
- [x] `tests/engine-smoke.test.mjs` & `tests/version-sync.test.mjs` -- Adopt `createTempWorkspaceTracker(afterEach)` and `runNodeSyntaxCheck`, and drop unused `join` import -- Eliminates per-file teardown drift and flag-as-scriptPath hack.
- [x] `tests/mcp-transport.test.mjs`, `tests/hook-stdout-isolation.test.mjs`, & `tests/queue-handoff.test.mjs` -- Adopt `createTempWorkspaceTracker(afterEach)`, `runHookRunner`, `assertSingleJsonObjectStdout`, and `assertStrictJsonRpcStdout`; remove local `runHook`, `runStopHook`, and `assertSingleJsonLine`/`assertStrictJsonRpcStdout`; align `queue-handoff` suite title -- Eliminates all duplicated spawn/stdout helpers and normalizes naming.

**Acceptance Criteria:**
- Given all five test files under `tests/`, when inspected for local `trackWorkspace` arrays, `HOOK_RUNNER_PATH` spawn wrappers, or duplicated stdout JSON-line assertions, zero duplicates remain outside `tests/helpers.mjs`.
- Given `node --test tests/` runs on the refactored suite, all 35 existing tests pass with exit code 0, zero npm dependencies, and zero leftover temp directories.
- Given `git diff --name-only` against baseline, only `tests/*` and this plan file are modified; zero runtime `scripts/*.mjs` files are changed.

## Implementation Notes

- Consolidated workspace tracking/teardown (`createTempWorkspaceTracker` with LIFO cleanup, `maxRetries: 3`, `retryDelay: 50`, and first-error rethrow after all cleanups complete), `nodeArgs` support on `runNodeProcess`, `runNodeSyntaxCheck`, `runHookRunner` (pinning `ZCODE_WORKSPACE_ROOT`/`ZCODE_PROJECT_DIR`/`CLAUDE_PROJECT_DIR` and stripping `CLAUDE_SESSION_ID`/`ZCODE_SESSION_ID`/`OPENAI_API_KEY`/`BMAD_COMPANION_OPENAI_KEY`), and stdout assertions (`assertCleanJsonLinesStdout`, `assertSingleJsonObjectStdout`, `assertStrictJsonRpcStdout`) in `tests/helpers.mjs`.
- Updated `tests/engine-smoke.test.mjs`, `tests/mcp-transport.test.mjs`, `tests/hook-stdout-isolation.test.mjs`, `tests/queue-handoff.test.mjs`, and `tests/version-sync.test.mjs` to consume the shared helpers, removed local duplicates and unused `join` import, and aligned the queue-handoff `describe` label to `bmad-companion queue handoff chain`.
- Added `tests/helpers.test.mjs` covering Matrix Row 1 (`createTempWorkspaceTracker.cleanup()` LIFO execution, disk removal, and deferred first-error rethrow).
- Zero runtime `scripts/*.mjs` files or non-test assets were modified.

## Plan Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none

## Design Notes

- **Canonical workspace tracker:** `createTempWorkspaceTracker(registerAfterEach)` wraps `createTempWorkspace`/`seedBmadWorkspace` so each suite replaces 13 lines of boilerplate with `const workspaces = createTempWorkspaceTracker(afterEach);` (`workspaces.create(...)` / `workspaces.seed(...)`), while `cleanup()` iterates all tracked workspaces before rethrowing any first error.
- **Canonical hook runner:** `runHookRunner({ workspaceRoot, cwd, mode, payload = {}, stdin, env = {}, timeoutMs = 5000 })` mirrors `runMcpServer`, defaulting `CLAUDE_SESSION_ID`, `OPENAI_API_KEY`, and `BMAD_COMPANION_OPENAI_KEY` to `undefined` unless overridden in `env`, returning `{ ...res, lines, frames, parseError }`.

## Verification

**Commands:**
- `node --test tests/` -- expected: all 35 tests across 8 suites pass with exit code 0 on Node 18+ with zero npm dependencies.
- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs && node --check tests/helpers.mjs` -- expected: exit code 0.
- `node scripts/check-version-sync.mjs` -- expected: exit code 0 (`0.5.3` tri-sync intact).
