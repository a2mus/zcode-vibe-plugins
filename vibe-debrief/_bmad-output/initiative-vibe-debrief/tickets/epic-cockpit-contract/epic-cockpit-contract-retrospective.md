---
epic: epic-cockpit-contract
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective — epic-cockpit-contract (Wave 2 Epic 5, v0.4.0 OQ-5 contract)

Part of the combined Wave 2 retrospective run (Epics 5–7) executed as BMAD Queue Task #4
(`/bmad-retrospective`, route=oneshot, review=none). Sibling documents:
`../epic-cockpit-hud-core/epic-cockpit-hud-core-retrospective.md`,
`../epic-concept-deep-dive/epic-concept-deep-dive-retrospective.md`.

## Epic summary

Spec: `epic-cockpit-contract.md` (Requirements R1–R5, `Done when` 1–3 — declared criteria).

Tickets (build order, from `tickets.py status epic-cockpit-contract`, run 2026-11-25):

| Ref | Title | Status at run start | Status after this run |
|-----|-------|--------------------|------------------------|
| 5.1 | OQ-5 schema enrichment & publish pass-through tracer | done | done |
| 5.2 | 5-grammar diagramSpec normalizer & lane-safe edge synthesis | done | done |
| 5.3 | Model-agnostic cheapest model & visual plugin discovery | done | done |
| 5.4 | Anytime explainer gate, Tiny-Turn Minimal Mode & Stop confidence | **planned (no plan file)** | done (reconciled — see Assumptions) |
| 5.5 | Widened set_persona, export_html & Clarify hook delegation | done | done |
| 5.6 | Refactor sweep | done | done |

At run start `pending_tickets = [5.4]`; the machine verdict was therefore **rejected**. The
queue task explicitly directed reconciling the missing 5.4 tracker, and the scope was verified
landed in code before the mark (evidence in Findings F5-3). Post-reconciliation verdict below.

Evidence inventory (Phase 1):

- Epic file read in full; `tickets.toml` entries read (descriptions/verify for 5.1–5.6).
- Plans: `plan-5.1…md`, `plan-5.2…md`, `plan-5.3…md`, `plan-5.5…md`, `plan-5.6…md` (frontmatter
  + Intent/Implementation/Verification sections). **None carries `baseline_revision`**, so no
  per-plan diff range could be derived — recorded as missing evidence; one inferred epic-set
  range used instead: `a013a2a..HEAD` (v0.3.0 marketplace stamp → HEAD `8b1ab76`, 11 commits,
  0 merges), which also contains sibling `bmad-companion/` work (monorepo) — churn below is
  filtered to `vibe-debrief/` paths.
- `git_evidence.py` (range `a013a2a..HEAD`, stories 5.1–7.5): `scripts/debrief-engine.mjs`
  +1558/−140 (net +1418, 3 commits), `assets/panel.html` +3725/−767 (net +2958, 3 commits),
  `scripts/mcp-server.mjs` +68/−10, `scripts/hook-runner.mjs` +49/−6, new suites
  `tests/cockpit-e2e.test.mjs` +1195 and `tests/export-parity.test.mjs` +892,
  `tests/debrief-engine.test.mjs` +795/−4, `tests/transports-and-sync.test.mjs` +196/−12,
  `skills/eli5/SKILL.md` +11, `skills/vibe-debrief/SKILL.md` +12.
- Attribution caveat: the only commit tagged story `5.4` by the tool, `2ef7728`
  "release(bmad-companion): v0.5.4", is a **false match on the version substring** — not 5.4 evidence.
- Run-folder records in-tree: `tickets/plan-review-4.3-5.1-combined-queue-code-review.md`,
  `tickets/plan-review-validate-agents-readme-queue-code-review.md`,
  `tickets/plan-review-wave2-v0.4.0-precommit-queue-code-review.md` (records 272/272 tests and
  0.4.0 sync on 2026-11-25) — read; treated as claims and re-verified this session (274/274 below).
- Session logs: **not available** in the queue context → process-lesson analysis from logs skipped.
- Previous retrospective: none exists in `../epic-panel-a11y/` → nothing to follow through on
  (missing file, not "no outstanding items").

## Findings

### Spec-to-implementation reconciliation

- **F5-1 — R4's computed 4-condition `minimalMode` gate lives client-side, not in the engine.**
  Epic R4 (`epic-cockpit-contract.md:33`) says `ensureDebriefEnriched` "computes `minimalMode: true`
  only when all four conditions hold". As built, the engine passes the field through
  (`scripts/debrief-engine.mjs:1389`: `debrief.minimalMode !== undefined ? Boolean(...) : false`,
  default `false` = "no opinion"), and the panel computes the gate in `resolveMinimalMode`
  (`assets/panel.html:3952-3986`): all four spec conditions **plus stronger vetoes** —
  `heuristicConfidence < 0.55` returns false *before* an explicit `minimalMode: true` is honored,
  `rawQuote` vetoes, unverified proof claims veto (C9), generated scenes veto. The deviation is
  documented in the panel comment block (`assets/panel.html:3943-3951`). Behavior intent of the
  5.4 verify clause ("confidence < 0.55 forces minimalMode false") holds at the rendering layer.
  Disposition: **accept as-is** (documented deviation) + **propose spec reconciliation** of the R4
  wording (Action item A1). Prevention: plans should record *where* a requirement's computation lands.
- **F5-2 — `explainerScenes` gating is complexity-based, not "non-minimal turns".**
  R4 wording says scenes populate "on non-minimal turns"; the engine populates them only when
  `complexity.level === "complex"` or via explicit override (`scripts/debrief-engine.mjs:1364-1376`),
  matching the AGENTS.md convention ("gate `explainerScenes` … `level === "complex"` (score >= 4)
  unless explicitly overridden"). The "Anytime" promise is delivered at the UI layer by Story 6.5
  (Visual tour unlocked on every non-minimal turn — `epic-cockpit-hud-core.md:36` R5).
  Disposition: **accept as-is**; recorded so later retros stop re-flagging.
- **R1/R2/R3/R5 checked and clean.** OQ-5 additive fields normalized and emitted
  (`debrief-engine.mjs:1387-1417`); `rawQuote` bounded to 280 chars (`:1388`); confidence clamped
  with derived fallbacks 0.45/0.65/0.9 (`normalizeHeuristicConfidence`, `:1279-1290`);
  `discoverCheapestEnabledModels` + backward-compat alias + `discoverInstalledVisualPlugins`
  (`:3257`, `:3392`, `:3424`) wired into `buildFullPanelState` (`:3632`, `:3642`); MCP schema
  widening (`scripts/mcp-server.mjs:224`, `:925`); Clarify/Deep-Refresh delegation per plan-5.5's
  executed verification record; SKILL.md OQ-5 hints (+11/+12 lines, skills files). 5-grammar
  normalization verified via `tests/debrief-engine.test.mjs` suites (217+).

### Process / tracker integrity

- **F5-3 — Story 5.4 shipped with no tracker and no named commit.** `tickets.py find
  epic-cockpit-contract 5.4` resolved `plan` to
  `tickets/story-anytime-explainer-gate-tiny-turn-minimal-mode-stop-confidenc-plan.md`, which never
  existed; `git log --grep="5.4"` and `git log -S` show its scope landed across squash commits
  `23c9b4b` (engine `minimalMode`/`normalizeHeuristicConfidence` — folded into the v0.3.0 stamp
  commit), `abac6ec` (panel `resolveMinimalMode`), `40b33d3` (tests). Landing evidence verified this
  session: `buildExplainerScenesIfComplex` returns `[]` for simple/null (`debrief-engine.mjs:1015`;
  tests `debrief-engine.test.mjs:566-571`, force-override `:600-605`); Stop-hook ≤50ms p95+max
  latency suite (`tests/atomic-state.test.mjs:577-667`); minimalMode pass-through round-trips
  (`tests/transports-and-sync.test.mjs:460,588`; `tests/debrief-engine.test.mjs:1943-1944,2078,2194`).
  Dependent stories 5.5 ("Builds on Story 4's minimalMode/confidence fields") and 6.5 completed on
  top of it. Disposition: **fix now** — reconciled in this run via `tickets.py mark … 5.4 done`
  (creates the missing plan file) + post-hoc reconciliation content (Action item A2 for the lesson).
- **F5-4 — Plans carry no `baseline_revision`.** All five plan frontmatters omit it, so the retro
  could not derive per-plan ranges (see Epic summary). Disposition: **defer** → process lesson A3.
- **F5-5 — Evidence-tool story tagger false positive** (`v0.5.4` → story `5.4` on `2ef7728`).
  Upstream `.agents/skills` script — repo policy forbids hand-editing it. Disposition: **accept
  as-is**, caveat recorded (A6).

## Behavior verification

Executed in this session (2026-11-25, queue/headless — deterministic env, no interactive browser):

- `node --test "tests/*.test.mjs"` → **274 tests, 50 suites, 274 pass, 0 fail** (~12.1s). Covers
  MCP stdio JSON-RPC round-trips, all four hook lifecycle modes, state upgrade from v0.2.0/v0.3.0
  snapshots, 5-grammar normalization, discovery fixtures, and the ≤50ms Stop-latency budget.
- `node scripts/check-version-sync.mjs` → `OK: all 4 version locations synced to 0.4.0`, exit 0.
- `node --check` on `debrief-engine.mjs`, `mcp-server.mjs`, `hook-runner.mjs`,
  `check-version-sync.mjs` → all pass; repo-root `node scripts/validate.mjs` → `✓ vibe-debrief
  v0.4.0 validated`, exit 0.
- Stdout discipline: zero `console.log` in `scripts/mcp-server.mjs` / `scripts/hook-runner.mjs`.
- Import graph (architecture delta): strictly one-way `mcp-server → debrief-engine`,
  `hook-runner → debrief-engine`, engine imports `node:*` only — no cycles, no new cross-cutting deps.
- Narrowing recorded: the `bmad-review` multi-lens pass was **skipped per the queue execution
  policy (review=none)**, not substituted inline. Working tree at run time carried a pre-existing
  uncommitted test tail (`tests/export-parity.test.mjs` +31, `tests/panel-a11y.test.mjs` +17/−1)
  from the UX-audit queue task; the suite above passes including it.

## Previous-retro follow-through

Nothing to follow through on — no previous retrospective file exists (checked
`../epic-panel-a11y/` and all epic folders; this is the first retro in the initiative).

## Action items

- **A1 (propose — spec reconciliation, owner: user via `bmad-agent-po`)**: reconcile
  `epic-cockpit-contract.md:33` R4 (and the 5.4 `verify` wording in `tickets/tickets.toml`) with
  the as-built locus: engine normalizes/pass-through `minimalMode`, panel `resolveMinimalMode`
  computes the gate with stronger honesty vetoes. Evidence: F5-1.
- **A2 (process lesson, owner: queue operator / build workflow)**: create the plan tracker and run
  `tickets.py mark <ref> built|done` **at story completion**, and name the story ref in commit
  subjects. 5.4 shipped invisibly across three squash commits (F5-3).
- **A3 (process lesson, owner: build workflow)**: record `baseline_revision` in every queue-built
  plan's frontmatter so retros derive per-plan diff ranges (F5-4).
- **A4 (defer, owner: user)**: commit the uncommitted UX-audit test tail + untracked
  `../epic-cockpit-hud-core/tickets/plan-ux-audit-v0.4.0-panel-exports.md` through the normal loop
  (suite green including them).
- **A6 (caveat, owner: user/upstream)**: `git_evidence.py` story tagging matched `v0.5.4` as story
  `5.4`; treat `stories` tags on release commits as noise (F5-5).

Durable engineering lessons (recorded for reuse):

1. A frozen cross-layer contract (OQ-5) works: three epics built on the payload without rework.
2. Honesty vetoes belong at the rendering boundary — the client-side gate (confidence/rawQuote/
   unverified-proof) is stronger than the engine-side computation the spec imagined.
3. Squash commits without story refs make delivery unauditable; the tracker, not the diff, is the
   only per-story record — keep both.

## Decision records

No plan in this epic carries a `<frozen-after-approval>`/`<intent-contract>` block or Design Notes
(verified by grep across all Wave 2 plans) — nothing extractable from plans. One decision proposed
from the as-built record (headless run: **proposed only, no file written**):

- **Proposed ADR — "Tiny-Turn minimal gate computed client-side over an engine pass-through
  field"**: context/decision/why documented at `assets/panel.html:3943-3986` and
  `scripts/debrief-engine.mjs:1389`; landed via `abac6ec`/`23c9b4b`. Hard to reverse (OQ-5
  `minimalMode` semantics are frozen and consumed by Epics 6–7), surprising without context (R4
  reads engine-side), real trade-off (engine purity/statefulness vs instant, veto-capable UI
  honesty). Suggested file: `docs/decisions/adr-minimal-mode-client-gate.md` — awaiting user approval.

## Acceptance verdict

**accepted-with-open-items** — criteria **declared** (epic file Requirements R1–R5, Done when 1–3).

- Done-when 1 (suite green covering upgrades, grammars, discovery, gates, MCP/hook round-trips):
  met — 274/274 this session.
- Done-when 2 (simple turns `[]`, Stop ≤50ms): met — `debrief-engine.test.mjs:566-571`,
  `atomic-state.test.mjs:577-667`.
- Done-when 3 (SKILL.md OQ-5 hints, `node --check`, zero stdout leaks): met — skills diff +11/+12,
  node --check pass, console.log grep clean.
- Open items: A1 spec reconciliation (proposed), A4 uncommitted tail (deferred). No blocking
  finding stands; no ticket unfinished after the directed reconciliation.
- Machine-verdict note: at run start `pending_tickets=[5.4]` → rejected; overridden by the queue
  task's explicit reconciliation directive plus verified landing evidence (hard rule 1: a directed
  human/orchestrator decision overrides). Recorded in Assumptions.

## Open questions

- Should the R4 spec text move the gate description to the panel layer (A1), or should the engine
  gain the computation with the panel keeping its vetoes? A human/PO answer changes whether F5-1
  closes as doc-fix or code-fix.
- Whether the top lesson/ADR should also persist to ZCode `MEMORY.md` via
  `vibe_debrief_confirm_lesson` — the plugin's Memory Rule requires user confirmation, which a
  headless queue run cannot obtain.

## Assumptions (headless run)

1. Epic reference resolved from the invocation ("Wave 2 Epics 5-7") to folder
   `_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract`; no interactive offer made.
2. Run in headless mode (queue context has no interactive user): no confirmations sought, no team
   discussion, verdict rendered on evidence alone.
3. `pending_tickets` at run start was `[5.4]`; the run proceeded over it per headless rules and the
   queue task's explicit directive to reconcile the missing tracker.
4. `bmad-review` multi-lens pass skipped per queue execution policy `review=none`; narrowing recorded.
5. Story 5.4 judged delivered on the code/test/commit evidence in F5-3 before `tickets.py mark
   epic-cockpit-contract 5.4 done` was run; the mark + post-hoc plan content are this run's tracker
   sync (queue "Tracker Sync (Required)" overrides the workflow's default no-status-change stance;
   this override is itself recorded here as directed).
6. Verdict `accepted-with-open-items` rendered without a human decision present; A1/A4/ADR left
   proposed, not applied.
