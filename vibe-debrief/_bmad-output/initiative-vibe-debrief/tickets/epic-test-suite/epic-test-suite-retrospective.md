---
epic: epic-test-suite
date: 2026-11-25
verdict: accepted
criteria: declared
headless: true
---

# Retrospective — epic-test-suite (Wave 1 Epic 1, zero-dependency test suite)

Part of the combined Wave 1 retrospective run (Epics 1–4) executed as BMAD Queue Task #2
(`/bmad-retrospective`, route=oneshot, review=none) before tagging `v0.4.0`. Sibling documents:
`../epic-atomic-state/epic-atomic-state-retrospective.md`,
`../epic-theme-parity/epic-theme-parity-retrospective.md`,
`../epic-panel-a11y/epic-panel-a11y-retrospective.md`.

## Epic summary

Spec: `epic-test-suite.md` (Requirements R1–R3, Constraints C1–C3/C5/C7, `Done when` 1–3 — declared
criteria).

Tickets (build order, `tickets.py status epic-test-suite`, run 2026-11-25):

| Ref | Title | Status |
|-----|-------|--------|
| 1.1 | node:test harness, temp-workspace fixtures & STE-80/diagram engine tracer | done |
| 1.2 | HTML export escaping, state persistence & ZCode Memory unit suite | done |
| 1.3 | MCP stdio JSON-RPC & lifecycle hook stdout isolation suite | done |
| 1.4 | Refactor sweep | done |

`pending_tickets` is empty (`4/4` done in `tickets.toml` and `plan-1`..`plan-4`). `story_file` is
`null` for all four rows (`tickets.py find` confirms descriptions/verify live in `tickets.toml`).

Evidence inventory (Phase 1):

- Epic file `epic-test-suite.md` and `tickets/tickets.toml` read in full.
- Plans `plan-1-node-test-harness.md`, `plan-2-html-export-state-memory.md`,
  `plan-3-mcp-hook-stdio-isolation.md`, and `plan-4-refactor-sweep.md` read in full. **None carries
  `baseline_revision`**, so per-plan diff ranges could not be derived; one inferred epic-wide
  range `1613b69..72f7ca3` was measured with `git_evidence.py` (2 commits, 0 merges; monorepo commit
  `72f7ca3` bundled `vibe-debrief` Stories 1.1–1.4 together with `bmad-companion/` and
  `project-colors/` files — churn below is filtered to `vibe-debrief/`).
- `git_evidence.py` (`1613b69..72f7ca3`, `vibe-debrief/` paths): `tests/debrief-engine.test.mjs`
  +1486, `tests/transports-and-sync.test.mjs` +930, `tests/helpers.mjs` +395,
  `tests/helpers.test.mjs` +233, `scripts/debrief-engine.mjs` +55/−10 (net +45: `ZCODE_HOME_DIR`
  override + SVG `innerHTML` hardening), `AGENTS.md` +7/−4, `epic-test-suite.md` +1,
  `plan-1..4` +44, plus an early draft of `epic-atomic-state` plan 2.1 (+15). `binary_revisions` 0.
- Current absolute sizes (measured this session): `tests/debrief-engine.test.mjs` 3,027 lines,
  `tests/transports-and-sync.test.mjs` 1,371 lines, `tests/helpers.mjs` 455 lines,
  `tests/helpers.test.mjs` 233 lines; zero `package.json` or `node_modules` at repository root.
- Session logs: **not available** in queue context → process-lesson analysis from logs skipped.
- Previous retrospective: none exists prior to Epic 1 (first epic in Wave 1).

## Findings

### Process / tracker provenance

- **F1-1 — Stories 1.1–1.4 shipped in one monorepo squash commit (`72f7ca3`) without `baseline_revision` metadata.**
  None of `plan-1`..`plan-4` records `baseline_revision`, and commit `72f7ca3` combined all four
  Epic 1 stories alongside `bmad-companion/` and `project-colors/` work plus an early draft of
  Epic 2 Story 2.1's plan. Per-story diff ranges are therefore underivable after the fact.
  Disposition: **accept as-is** (already landed and superseded by `AGENTS.md` / Wave 2). Prevention:
  keep commits scoped to one plugin/story and record `baseline_revision` in every plan frontmatter
  (reinforces Wave 2 Action items A2/A3).

### Spec-to-implementation & CI compatibility

- **F1-2 — Epic `Done when` #1 and `tickets.toml` cite `node --test tests/`, which fails on Node 22.**
  `epic-test-suite.md:39` and `tickets/tickets.toml:10,22,34,46` specify `node --test tests/`. While
  local Node `v26.12.1` runs `node --test tests/` cleanly (`274/274` this session), CI on Node 22
  treats `--test` arguments as glob patterns and exited with `MODULE_NOT_FOUND` until commit
  `3c50d56` ("fix(ci): make per-plugin test gates run on Node 22") switched `.github/workflows/validate.yml`
  and `AGENTS.md` to quoted `node --test "tests/*.test.mjs"`. Disposition: **accept as-is** (CI and
  `AGENTS.md` are already fixed in `3c50d56`) + **propose spec note** if epic docs are revisited.

### Spec-to-implementation reconciliation (checked and clean)

- **F1-3 — R1–R3 and zero-dependency constraints checked and clean.**
  - Zero `package.json` or `node_modules` in the repository (`ls -la` verified this session).
  - `ZCODE_HOME_DIR` isolation override implemented at `scripts/debrief-engine.mjs:77-82`, keeping
    `MEMORY.md` and `discoverLightweightGeminiModels` tests hermetic away from `~/.zcode`.
  - Pure engine transforms (R1), persistence/HTML/Memory/discovery tests (R2), and spawned-process
    MCP stdio JSON-RPC + 4-mode hook stdout isolation tests (R3) all remain active and pass inside
    the current `274`-test suite.
  - Architecture delta: `tests/helpers.mjs` imports `node:*` built-ins and `scripts/debrief-engine.mjs`
    only; zero cycles and zero `console.log` leaks in `scripts/mcp-server.mjs`,
    `scripts/hook-runner.mjs`, or `scripts/debrief-engine.mjs`.

## Behavior verification

Executed in this session (2026-11-25, headless queue on Node `v26.12.1`):

- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs` → exit `0`.
- `node --test "tests/*.test.mjs"` → **274 tests, 50 suites, 274 pass, 0 fail, 0 skipped** (~10.8s).
  Includes `tests/helpers.test.mjs`, `tests/debrief-engine.test.mjs`, and
  `tests/transports-and-sync.test.mjs`.
- `node --test tests/` (bare directory argument) → **274 tests, 50 suites, 274 pass, 0 fail** (~10.6s)
  on local Node `v26.12.1` (note: Node 22 CI requires quoted `"tests/*.test.mjs"` per `3c50d56`).
- `node scripts/check-version-sync.mjs` → `OK: all 4 version locations synced to 0.4.0`, exit `0`.
- `node ../scripts/validate.mjs` → `✓ vibe-debrief v0.4.0 validated`, exit `0`.
- Narrowing recorded: `bmad-review` multi-lens pass **skipped per queue execution policy
  (`review=none`)**, not substituted inline.

## Previous-retro follow-through

Nothing to follow through on — `epic-test-suite` is the first epic in Wave 1 (no preceding retro
exists). Note: Wave 2 retrospectives (`cfdf8de`) ran before this Wave 1 retro.

## Action items

- **A1-1 (process lesson, owner: build workflow)**: always quote `"tests/*.test.mjs"` in epic/story
  `Done when` and `verify` gates so Node 22 CI and local Node runs behave identically (`3c50d56`).
- **A1-2 (process lesson, owner: build workflow)**: record `baseline_revision` in every plan and
  avoid bundling multi-plugin/multi-story work into one commit (`72f7ca3`).

Durable engineering lessons (recorded for reuse):

1. Hermetic `ZCODE_HOME_DIR` + disposable temp-workspace helpers (`tests/helpers.mjs`) proved durable:
   all seven Wave 1 and Wave 2 epics built on the same fixture harness without mutating `~/.zcode`.
2. Zero-dependency `node:test` + spawned-process stdio harnesses keep verification fast (~10.8s for
   274 tests) and eliminate toolchain drift.

## Decision records

No plan in `epic-test-suite` carries a `<frozen-after-approval>`/`<intent-contract>` block or
Design Notes — nothing extractable from plans. One decision proposed from the as-built record
(headless run: **proposed only, not written**):

- **Proposed ADR — "Hermetic ZCODE_HOME_DIR override for ZCode Memory and model discovery tests"**:
  context — R2/C7 forbid touching live `~/.zcode/cli/memories/` or `~/.zcode/v2/` during tests;
  decision — `scripts/debrief-engine.mjs:77-82` honors `process.env.ZCODE_HOME_DIR` before `os.homedir()`;
  why — recorded in `epic-test-suite.md:56-57` and `plan-1-node-test-harness.md:8`. Suggested
  file: `docs/decisions/adr-zcode-home-dir-test-isolation.md` — awaiting user approval.

## Acceptance verdict

**accepted** — criteria **declared** (`epic-test-suite.md` Requirements R1–R3, `Done when` 1–3).

- Done-when 1 (one-command `node:test` green with zero external dependencies): met — `274/274` pass
  this session (`node --test "tests/*.test.mjs"`), zero `package.json`/`node_modules`.
- Done-when 2 (unit coverage for all named Core Engine exports, HTML escaping, ZCode Memory, and
  model discovery against isolated temp directories): met — verified in `tests/debrief-engine.test.mjs`.
- Done-when 3 (spawned-process MCP stdio JSON-RPC + `unsafeEval: false` + 4-mode hook stdout
  isolation): met — verified in `tests/transports-and-sync.test.mjs`.
- All 4 tickets (`1.1`–`1.4`) finished (`pending_tickets` empty); no blocking findings remain.

## Open questions

- Whether to backfill `baseline_revision` or update `epic-test-suite.md:39` (`tests/` -> `"tests/*.test.mjs"`) — purely cosmetic since `AGENTS.md` and CI (`3c50d56`) already enforce the quoted glob.

## Assumptions (headless run)

1. Epic resolved from the invocation ("Wave 1 epics (epic-test-suite, …)") to
   `_bmad-output/initiative-vibe-debrief/tickets/epic-test-suite`.
2. Headless queue mode: no interactive confirmations, no Phase 3 team discussion, verdict rendered
   from repository evidence and verification runs alone.
3. `bmad-review` multi-lens pass skipped per queue execution policy `review=none`; narrowing recorded.
4. No files outside this retrospective document were modified; the proposed ADR was not written.
