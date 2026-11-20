---
title: 'Hook stdout-isolation harness'
type: feature
ticket: 3
created: '2026-11-20'
status: done
baseline_revision: '6003edcf74fcdd41ac10100c22aaf138bfe19878'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `scripts/hook-runner.mjs` has no automated stdout-isolation coverage: the host parses exactly one JSON line per hook invocation, and any stray output (logs, warnings, extra lines) silently breaks SessionStart/UserPromptSubmit/PostToolUse/Stop context injection.

**Approach:** Add `tests/hook-stdout-isolation.test.mjs`, a spawned-process harness reusing `runNodeProcess` from `tests/helpers.mjs`, that runs all four hook modes against a seeded temp workspace and asserts a single parseable JSON stdout line with the expected per-mode shape, zero non-JSON output, and correct state side effects. Hands the hook transport pattern to Epic 6.

## Boundaries & Constraints

**Always:** `node:test` + `node:*` built-ins only, zero npm; reuse `createTempWorkspace`/`seedBmadWorkspace`/`runNodeProcess`/`splitLines`/`parseJsonLines` from `tests/helpers.mjs`; bounded spawn timeouts (default 5000ms); strip `OPENAI_API_KEY` and `BMAD_COMPANION_OPENAI_KEY` via `undefined` env overrides so Stop never attempts network synthesis; isolate every run in a temp workspace (`payload.cwd` + `ZCODE_PROJECT_DIR`/`CLAUDE_PROJECT_DIR` env); clean up workspaces in `afterEach`.

**Never:** modify runtime `scripts/*.mjs`, `hooks/hooks.json`, or `assets/panel.html`; add `package.json` or dependencies; touch upstream skills; make real network calls; assert internal proxies instead of the spawned stdout surface.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| SessionStart | seeded ws, mode `session-start`, stdin `{}` | exit 0; exactly 1 JSON line `{additionalContext}`; string contains `[BMAD Companion Active for` and `Smart Progress:`; `state.json` gains `lastSessionStartAt` | no error expected |
| UserPromptSubmit | mode `user-prompt`, stdin `{prompt}` | exit 0; exactly 1 line `{}`; `state.json` `lastUserPrompt` equals prompt | no error expected |
| PostToolUse | mode `post-tool`, stdin `{tool_input:{file_path}}` inside ws | exit 0; exactly 1 line `{}`; `recentTouchedFiles` contains ws-relative path | no error expected |
| PostToolUse escape | `file_path` outside ws root | exactly 1 line `{}`; outside path NOT recorded | confinement via `relative()` check |
| Stop | mode `stop`, stdin `{last_assistant_message}`, API keys stripped | exit 0; exactly 1 line `{}`; `turnCount` increments; no network | synthesis skipped without keys |
| Malformed stdin | raw `"{not-json"` | exit 0; exactly 1 line `{}` | `readStdinJson` catch → `{}` |
| Unknown mode | argv `bogus-mode` | exit 0; exactly 1 line `{}` | fallback branch |

</intent-contract>

## Code Map

- `tests/helpers.mjs` — REUSE, do not modify: `runNodeProcess` (L213, returns `{ok,code,signal,stdout,stderr}`; env merge at L223 drops `undefined` values → key stripping), `createTempWorkspace` (L18, exposes `.statePath`, `.write/.read/.cleanup`), `seedBmadWorkspace` (L54), `splitLines` (L170), `parseJsonLines` (L190), `readJsonFile` (L205), `HOOK_RUNNER_PATH` (L12).
- `scripts/hook-runner.mjs` — READ-ONLY contract: mode = `argv[2]`; workspace root = `payload.cwd || ZCODE_PROJECT_DIR || CLAUDE_PROJECT_DIR || cwd` (L71); `session-start` emits `{additionalContext}` (L97), `user-prompt`/`post-tool`/`stop`/fallback emit `{}` (L134/155/215/219); `main().catch` emits `{}` (L222); Stop AI synthesis gated on `BMAD_COMPANION_OPENAI_KEY || OPENAI_API_KEY` (L21).
- `hooks/hooks.json` — event→mode wiring: SessionStart→`session-start`, UserPromptSubmit→`user-prompt`, PostToolUse→`post-tool`, Stop→`stop`.
- `tests/mcp-transport.test.mjs` — idiom to mirror: `trackWorkspace` array + `afterEach` cleanup (L16-28), strict-stdout assertion helper (L34-59), `describe`/`it` + `assert/strict`.
- `tests/hook-stdout-isolation.test.mjs` — NEW: the only file this story creates.

## Tasks & Acceptance

**Execution:**
- [x] `tests/hook-stdout-isolation.test.mjs` — create suite with a local `runHook(ws, mode, payload)` wrapper over `runNodeProcess(HOOK_RUNNER_PATH, {args:[mode], cwd:ws.root, env:{ZCODE_PROJECT_DIR, CLAUDE_PROJECT_DIR, OPENAI_API_KEY:undefined, BMAD_COMPANION_OPENAI_KEY:undefined}, stdin:JSON.stringify(payload)})` and an `assertSingleJsonLine(res)` helper (exit 0, empty stderr, LF-only, exactly one non-blank line ending in LF, parseable JSON) — covers every I/O Matrix row plus a four-mode lifecycle sequence on one seeded workspace asserting cumulative state.

**Acceptance Criteria:**
- Given a seeded temp workspace, when `node --test tests/` runs, then all four hook modes emit exactly one parseable JSON stdout line each with the per-mode shape above and zero non-JSON output, and the whole suite exits 0.
- Given the suite runs on a host where `OPENAI_API_KEY` is set, when Stop executes, then it still emits `{}` within the bounded timeout with no network attempt (keys stripped by env override).
- Given any hook run, when it completes, then all writes land under the temp workspace's `.zcode/bmad-companion/state.json` and the real repo workspace is untouched.

## Implementation Notes

- Route `full` (auto): estimated ~230 new lines > 100-line oneshot threshold; implemented by a coding subagent from this plan as sole source of truth.
- Created `tests/hook-stdout-isolation.test.mjs` (234 lines, 8 tests): local `runHook` wrapper over `runNodeProcess(HOOK_RUNNER_PATH)` + `assertSingleJsonLine` strict-stdout helper; mirrors `mcp-transport.test.mjs` idioms (`trackWorkspace` + `afterEach` cleanup). No runtime scripts, hooks, panel, or helpers modified; no `package.json`.
- Decision: malformed-stdin row uses mode `user-prompt` because `session-start` emits `additionalContext` even with bad stdin, so the `{}` assertion requires a `{}`-emitting mode; workspace root then comes from `ZCODE_PROJECT_DIR` (payload.cwd unavailable).
- Decision: lifecycle order session-start → user-prompt → post-tool → stop because `user-prompt` resets `recentTouchedFiles` by contract; unknown-mode test additionally asserts no state file is created (fallback is side-effect-free).
- Verification (orchestrator re-run): `node --check scripts/hook-runner.mjs` exit 0; `node --test tests/` 16/16 pass, 3 suites, 0 skipped; re-run with `OPENAI_API_KEY`/`BMAD_COMPANION_OPENAI_KEY` set to dummy host values still 16/16 (hermeticity non-vacuous). Matrix audit: all 7 rows covered by named tests that ran and passed.
- Diff since baseline `6003edcf74fcdd41ac10100c22aaf138bfe19878` staged and read: only this plan file and the new test file.

## Plan Change Log

## Review Triage Log

### 2026-11-20 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `assertSingleJsonLine` accepted JSON arrays (`typeof [] === "object"`), looser than its "Returns the parsed object" contract; contained today because every caller asserts the exact frame shape — fixed at `tests/hook-stdout-isolation.test.mjs:73` by extending the null guard with `!Array.isArray(parsed[0])` (re-engaged step-03 subagent); full suite re-run 16/16 pass.
  - `[low]` `[reject]` stale "Auto Run Result" halt narrative ("Status: draft … re-dispatch") contradicted the updated frontmatter — rejected because its fix edits this build's plan; Finalize rewrote the section with the completed-run record, resolving the inconsistency.

## Design Notes

Ticket wording says "expected additionalContext shape" for all four hooks, but the runtime contract emits `additionalContext` only for `session-start`; the other three modes emit `{}`. Tests assert the actual per-mode contract (single JSON line + shape), which satisfies the ticket's verify clause ("single parseable JSON stdout line ... zero non-JSON output").

Golden wrapper shape:

```js
const res = await runNodeProcess(HOOK_RUNNER_PATH, {
  args: [mode],
  cwd: ws.root,
  env: { ZCODE_PROJECT_DIR: ws.root, CLAUDE_PROJECT_DIR: ws.root,
         OPENAI_API_KEY: undefined, BMAD_COMPANION_OPENAI_KEY: undefined },
  stdin: JSON.stringify({ cwd: ws.root, ...payload })
});
```

State assertions read `ws.statePath` with `readJsonFile` after each run; `savePersistedState` merges, so lifecycle tests can assert cumulative fields (`lastSessionStartAt`, `lastUserPrompt`, `recentTouchedFiles`, `turnCount`).

## Verification

**Commands:**
- `node --test tests/` — expected: all suites green (engine smoke, MCP transport, hook stdout-isolation), exit 0, zero npm dependencies.
- `node --check scripts/hook-runner.mjs` — expected: exit 0 (runtime unchanged).

## Auto Run Result

Status: built (ticket 1.3, ref `1.3`, "Hook stdout-isolation harness"; first pass, route full, review quick).

**History:** an earlier dispatch HALTed `blocked` at the step-01 clean-tree gate (sibling vibe-debrief WIP). Unblocked by user instruction on 2026-11-20: vibe-debrief WIP committed as `20b8c2d` by its own session, halt artifact committed as `6003edcf74fcdd41ac10100c22aaf138bfe19878` (this run's baseline), and the sibling's in-flight walkthrough folder locally excluded via `.git/info/exclude` (remove that entry once the vibe-debrief session commits it).

**Summary:** added a spawned-process hook stdout-isolation harness reusing `runNodeProcess` from `tests/helpers.mjs`: all four hook modes (`session-start`, `user-prompt`, `post-tool`, `stop`) run against seeded temp workspaces and must emit exactly one parseable JSON stdout line with the per-mode shape, zero non-JSON output, exit 0, and correct confined state side effects. Hands the hook transport pattern to Epic 6.

**Files changed:**
- `tests/hook-stdout-isolation.test.mjs` (new, 234 lines) — 8 tests: 7 I/O-matrix rows + four-mode lifecycle with cumulative state assertions; `runHook` wrapper strips `OPENAI_API_KEY`/`BMAD_COMPANION_OPENAI_KEY` for hermetic Stop runs.
- this plan file — full-route plan, implementation notes, triage log, result record.

**Review breakdown (quick lens, 2 findings):** 1 patch applied (low: `assertSingleJsonLine` array acceptance → `!Array.isArray` guard at L73, fixed by re-engaged implementation subagent); 1 rejected (low: stale Auto Run Result narrative — fix would edit this build's plan; resolved by this Finalize rewrite). 0 deferred, 0 intent_gap, 0 bad_plan. Patched counts: high 0, medium 0, low 1.

**Follow-up review recommendation:** false (first pass; no high patched, fewer than two medium patched).

**Verification:** `node --check scripts/hook-runner.mjs` exit 0; `node --test tests/` 16/16 pass across 3 suites, 0 skipped (re-run after patch); suite also 16/16 with dummy host `OPENAI_API_KEY`/`BMAD_COMPANION_OPENAI_KEY` set (hermeticity non-vacuous; subagent additionally proved 0 synthesis attempts vs 1 for an unstripped control via a localhost sink, since deleted). Matrix audit: all 7 rows covered by named tests that ran and passed. Diff since baseline staged and read by orchestrator: only the two files above; no runtime scripts, hooks, panel, helpers, or `package.json` touched.

**Residual risks:** none known. The harness asserts the runtime contract as-is; if Epic 6 changes hook stdout shapes, these tests are the intended regression gate.