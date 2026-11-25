---
epic: epic-mcp-surface
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective — epic-mcp-surface (9-tool MCP contract & clean-session launch)

Run mode: headless, token-saving (`route=oneshot`, `review=none`). The `bmad-review` multi-lens pass and the team discussion (Phase 3) were not run; Phase 2 was done inline over plan files, source and tests (narrowed scope, recorded under Assumptions).

## Epic summary

- **Epic:** `epic-mcp-surface` (`id: 2`, ticket refs `2.1`–`2.5`), covering `R1`–`R4`, `R6`–`R8` of the parent (`epic-mcp-surface.md:1-12`), `status: done` in the epic frontmatter.
- **Tickets (`tickets.py status`, counts `total: 5, done: 5`, `pending_tickets` empty):**
  1. `2.1` Read-only tool contract tracer — `done`, plan `story-read-only-tool-contract-tracer-open-companion-get-state-reco-plan.md` (baseline `23c9b4b`, route `oneshot`, review `none`).
  2. `2.2` Advisor update + live hostModels sync + storyOverrides persistence — `done`, plan `story-advisor-update-live-hostmodels-sync-storyoverrides-persistence-plan.md` (baseline `a013a2a`).
  3. `2.3` Clean-session launch + OS automation fallback — `done`, `hitl: true`, `risk: high`, plan `plan-3-clean-session-launch-os-automation-fallback.md` (baseline `3c50d56`).
  4. `2.4` Artifact inspect/open workspace confinement + git diff — `done`, plan `plan-4-artifact-inspect-open-workspace-confinement-git-diff.md` (baseline `3c50d56`).
  5. `2.5` Refactor sweep — `done`, plan `plan-5-refactor-sweep.md` (baseline `3c50d56`).
- **Tickets still at `built`:** none. **Pending tickets:** none.
- **Plan ranges:** all five plans record `deferred: []` and `warnings: []` except `2.3`, which records the HITL warning (`plan-3-…:19`). Plans 3–5 share the same baseline `3c50d56`, so per-plan git ranges cannot be separated; `git_evidence.py` per-plan ranges were not computed (narrowed scope). Test history: `git log -- tests/mcp-surface.test.mjs` shows `fd10b24` (story 1 freeze), `9361055`, `abac6ec`.
- **Evidence inventory:**
  - *Available:* epic file, `tickets.toml`, 5 plan files, `scripts/mcp-server.mjs`, `scripts/bmad-engine.mjs`, `tests/mcp-surface.test.mjs` (18 `it(...)` cases across 4 describe blocks), full test suite run in this session.
  - *Missing (narrowed):* separate story files (`file: null` for all five), run folders, previous retro for this epic (the only sibling retro is `epic-verification-harness-retrospective.md`), session logs, and any HITL observation of a real clean-session launch on any OS.

## Findings

### Aggregate views

#### Architecture delta
- **Single shared confinement helper (checked and clean — accept):** `resolveWorkspaceArtifactPath` (`scripts/bmad-engine.mjs:2826`) rejects empty paths, NUL bytes, drive-relative `C:foo`, `..` escapes and absolute escapes after `/` normalization, satisfying constraint `C3`. The test at `tests/mcp-surface.test.mjs:1033` covers traversal, absolute escapes, directories, empty paths and symlink escapes.
- **Result-shape helpers (accept):** `toolResult`/`toolErrorResult` (`scripts/mcp-server.mjs:494,502`), `errorMessage` (`scripts/bmad-engine.mjs:411`), `commandFailureDetail`/`launchOutcome` (`scripts/bmad-engine.mjs:4448,4453`) match what `plan-5-refactor-sweep.md` claims.

#### Duplication map
- No duplicated confinement or clipboard helper remains between `scripts/mcp-server.mjs` and `scripts/bmad-engine.mjs` (grep of the helper definitions above shows one definition each). *Checked and clean.*

#### God-class / size growth
- **`scripts/bmad-engine.mjs` is large (>4600 lines; launch code at `:4373-4604`, artifact code at `:2826+`) and now holds scanning, scoring, reconciliation, queue, clipboard and OS automation in one module.** *(Disposition: defer)* Splitting OS-launch automation into its own module would shrink the blast radius of the highest-risk story (`2.3`), but is not required by this epic's criteria.

#### Pattern divergence
- **Darwin timeouts differ from the epic's stated budget (`epic-mcp-surface.md` `C11`: "hard timeouts 8000/6000/2500ms"):** darwin `pbcopy` uses `3000ms` (`scripts/bmad-engine.mjs:4525`) and the test asserts `3000` (`tests/mcp-surface.test.mjs:830`; test title at `:816` says "3000/6000ms"). *(Disposition: fix now — spec reconciliation: record `3000` as the shipped darwin clipboard timeout in `C11`/ticket `2.3`.)*

#### Spec-to-implementation reconciliation
- **Ticket wording drift in `tickets.toml` (entries `2.3`, `2.4`):** ticket `2.3` still says `preparedSession`, and ticket `2.4` says `contentPreview + gitDiff`, whereas shipped code persists `lastLaunchedSession` (`scripts/bmad-engine.mjs:1422,2453,4604`) and returns `preview`/`diff`. The epic file already records this as settled `OQ-B` (`epic-mcp-surface.md` Notes, decision 2026-11-23). *(Disposition: accept; optionally refresh ticket text.)*
- **Verify-command wording:** every `verify` string in `tickets.toml` says `node --test tests/`; `AGENTS.md` mandates the quoted glob `node --test "tests/*.test.mjs"` because Node 22 treats a bare directory as a glob and fails. It passes here on Node `v26.12.1` but may fail on the CI Node 22. *(Disposition: fix now — change the strings to the quoted glob.)*
- **Recommendation count:** `R5` in the epic says "up to 7" and the code slices 7 (`scripts/bmad-engine.mjs:2823`) and 12 `matchingSkills` (`scripts/mcp-server.mjs:600`). *Checked and clean.*

### Lenses (inline, narrowed — `bmad-review` not invoked in `review=none` mode)

#### Verification-gap
1. **`SM-4` / `C11` timing is not asserted.** The only timing assertion is the timeout-cleanup bound `elapsed < 1500` (`tests/mcp-surface.test.mjs:1011`). No test measures the ≤1500ms p95 launch or the ≤300ms p95 tool-call budgets from `C11`. *(Disposition: defer — add a coarse latency smoke test or drop the p95 wording from `C11`.)*
2. **`Done when #3` HITL check not run.** `plan-3-…:19,52-53` states live ZCode UI launch and keystroke-blocking observation on `win32`/`darwin`/`linux` was not run. Tests stub the command runner, so keystroke automation (`SendKeys` at `scripts/bmad-engine.mjs:4486-4488`, `osascript` at `:4537`) is verified only as invoked arguments, not as real behavior. Ticket `2.3` is marked `done` despite `hitl: true`. *(Disposition: fix now — a human must observe the pre-pasted fresh session once per OS; keep the item open.)*
3. **Panel toast is checked by source string only.** The fallback-toast test (`tests/mcp-surface.test.mjs:1024`) reads `assets/panel.html` text; it does not render the toast. *(Disposition: defer.)*

#### Adversarial / edge-case
- Windows `SendKeys ^n/^v` targets whichever window has focus; a wrong focused window gets keystrokes. Auto-submit is guarded (zero Enter sent, asserted in the win32/darwin/linux tests), but the paste destination is not verified. *(Disposition: accept with `A-2` risk; covered by the HITL item above.)*

## Behavior verification

Run in this session on Node `v26.12.1`, win32:

1. `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — **passed**: `tests 182, suites 44, pass 182, fail 0, cancelled 0, skipped 0`; `[check-version-sync] OK: all 3 versions match (0.5.4)`.
2. `node --test tests/` (the form used in `tickets.toml` verify strings) — **passed** on this Node (`fail 0`).
3. `uv run _bmad/method/scripts/tickets.py --project-root . status _bmad-output/initiative-bmad-companion/tickets/epic-mcp-surface` — `counts: {total: 5, done: 5}`, no pending tickets.
4. **Not run:** real clean-session launch on any OS (HITL), live `ListModels` sync inside a ZCode host, tool-call latency measurement.

## Previous-retro follow-through

No previous retro exists for this epic. The preceding epic's retro (`epic-verification-harness-retrospective.md`) deferred "unexercised `tools/call`" paths to this epic (Verification-Gap item 5); `tests/mcp-surface.test.mjs` now exercises `tools/call` for all seven tools of this epic over stdio. *Landed.*

## Action items

Proposed only; none applied by this retrospective.

1. **[Fix now — HITL] Observe a real clean-session launch on `win32` (and `darwin`/`linux` if available), including blocked-keystroke fallback toast** — Owner: repo owner. Closes `Done when #3` / `SM-4` for ticket `2.3`.
2. **[Fix now — spec reconciliation] Update `C11` and ticket `2.3` to the shipped darwin timeouts (`3000/6000ms`)** — Owner: PO (`bmad-agent-po`).
3. **[Fix now — docs] Change `verify` strings in `tickets.toml` to `node --test "tests/*.test.mjs"`** — Owner: PO.
4. **[Defer] Add a coarse latency smoke test for tool calls/launch, or relax the p95 wording** — Owner: Dev (`bmad-build`).
5. **[Defer] Consider extracting OS-launch automation from `scripts/bmad-engine.mjs`** — Owner: Architect.
6. **[Process lesson] Mark HITL tickets as `built` rather than `done` until the human check is recorded.** Ticket `2.3` reached `done` with the HITL step explicitly unrun; keeping that distinction would make the tracker truthful.

## Decision records

None proposed. The confinement and result-helper choices are local, reversible and already captured in the epic file's Notes and `plan-5-refactor-sweep.md`.

## Acceptance verdict

- **Verdict:** `accepted-with-open-items`
- **Criteria basis:** `declared` (`epic-mcp-surface.md` Requirements `R1`–`R7`, Done when 1–4).
- **Evidence:** all 5 tickets `done` with zero pending; `Done when #1`, `#2`, `#4` are covered by passing tests in `tests/mcp-surface.test.mjs` (full suite 182/182 green). `Done when #3` is verified only at the stubbed-command level; the per-OS human observation was not run (`plan-3-…:19`), and no p95 latency test exists. These keep the verdict from a clean `accepted`.

## Open questions

1. Should ticket `2.3` be treated as fully closed before a human has observed the launch on at least `win32`?
2. Should the p95 budgets in `C11` be enforced by a test or reworded as targets?

## Assumptions

- Epic reference `epic-mcp-surface` (from the task) resolved to folder `_bmad-output/initiative-bmad-companion/tickets/epic-mcp-surface`; `pending_tickets` was empty.
- The `bmad-review` skill, per-plan `git_evidence.py` ranges and the Phase 3 team discussion were skipped per the token-saving policy (`review=none`); findings come from direct reads of the plans, source and tests.
- All proposed action items were recorded without user confirmation.
