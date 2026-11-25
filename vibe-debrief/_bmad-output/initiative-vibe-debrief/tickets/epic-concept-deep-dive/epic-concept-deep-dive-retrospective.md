---
epic: epic-concept-deep-dive
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective — epic-concept-deep-dive (Wave 2 Epic 7, two-stage deep dive & v0.4.0 stamp)

Part of the combined Wave 2 retrospective run (Epics 5–7) executed as BMAD Queue Task #4
(`/bmad-retrospective`, route=oneshot, review=none). Sibling documents:
`../epic-cockpit-contract/epic-cockpit-contract-retrospective.md`,
`../epic-cockpit-hud-core/epic-cockpit-hud-core-retrospective.md`.

## Epic summary

Spec: `epic-concept-deep-dive.md` (Requirements R1–R4, `Done when` 1–3 — declared criteria;
risk `high` with a named beyond-criteria check: simulated Stage 2 missing-plugin flow with an
immediate `tool-result` push, banner survival, snapshot + version-sync verification).

Tickets (build order, `tickets.py status epic-concept-deep-dive`, run 2026-11-25): 7.1 concept
pills & <100ms Stage 1 micro-drawer tracer — done; 7.2 Stage 2 Pop-Out routing — done; 7.3
mandatory 3-column Stage 2 HTML fallback & persistent missing-banner — done; 7.4 refactor sweep —
done; 7.5 end-to-end Cockpit HUD suite & v0.4.0 4-file version stamp — done. `pending_tickets`
empty at run start and after. These are the only Wave 2 tickets whose `tickets.py` rows carry
explicit `file` links (plan-7.2 … plan-7.5).

Evidence inventory (Phase 1):

- Epic file read in full; plans `plan-7.1…md` … `plan-7.5…md` frontmatter + sections read
  (Intent / Implementation Details / Verification (Executed 2026-11-24/25)). **No
  `baseline_revision`** in any plan → per-plan ranges underivable; shared inferred epic-set range
  `a013a2a..HEAD` (11 commits, 0 merges, monorepo-filtered) — full note in the Epic 5 retro.
- `git_evidence.py` churn for this epic's surfaces: `tests/cockpit-e2e.test.mjs` **+1195 (new,
  single commit — Story 7.5's suite)**, `assets/panel.html` +3725/−767 (shared with Epic 6),
  `scripts/debrief-engine.mjs` +1558/−140 (Stage 2 export grid half), `.zcode-plugin/plugin.json`
  and `scripts/check-version-sync.mjs` 1-line version touches (the 0.4.0 stamp).
- Session logs: not available → process-lesson analysis from logs skipped.
- Previous retrospective: none exists → nothing to follow through on (missing file, not "no items").

## Findings

### Spec-to-implementation reconciliation (checked and clean)

- **F7-1 — R1 Stage 1 drawer verified with real timing, not presence-only.**
  `tests/cockpit-e2e.test.mjs:765-772` measures the drawer open and asserts
  `stage1Ms < 100` ("Stage 1 drawer took …ms (must be < 100ms)"), with zero-RPC inline rendering;
  same-turn re-render preservation of the open drawer and Escape/re-click collapse with focus
  restoration asserted in `tests/panel-a11y.test.mjs:2697-2712` (Story 7.1 describe).
- **F7-2 — R2/R3 Stage 2 routing and mandatory fallback verified end to end.** UJ-2
  (`tests/cockpit-e2e.test.mjs:641`) covers "Stage 2 installed ui/message & missing-plugin HTML
  fallback + **tool-result survival** + Minimal/Visual tour" — i.e. the epic's named high-risk
  beyond-criteria check (banner persists across a `tool-result` push) is a running assertion, not a
  manual step. Missing-banner a11y contract asserted at `tests/panel-a11y.test.mjs:3139-3144`
  (Story 7.3 describe: `role="status"` + `aria-live="polite"`).
- **F7-3 — R4 release stamp verified.** `node scripts/check-version-sync.mjs` this session:
  `OK: all 4 version locations synced to 0.4.0` (plugin.json, mcp-server.mjs serverInfo,
  panel.html appInfo, hook-runner.mjs banner), exit 0; repo-root `validate.mjs` agrees
  (`✓ vibe-debrief v0.4.0 validated`). v0.2.0/v0.3.0 snapshot backward compatibility covered by
  the Story 7.5 suite (`tests/cockpit-e2e.test.mjs:485` describe title names it) and
  debrief-engine upgrade tests — green this session.
- **F7-4 — UJ coverage is a named, running suite**: `tests/cockpit-e2e.test.mjs:485-985` —
  UJ-1 (`:486`), UJ-2 (`:641`), UJ-3 cost-aware Clarify after low-confidence Stop (`:860`), UJ-4
  MEMORY.md promotion via real MCP `confirm_lesson` (`:985`). No epic requirement was left without
  a deterministic assertion in the sampled reconciliation.

### Process / evidence quality

- **F7-5 — Epic 7 is the tracker-hygiene counterexample to Epic 5.** Its plans are the only Wave 2
  plans `tickets.py` links by `file`, its suite landed as one attributable commit (+1195), and its
  verification blocks carry executed dates/counts. Same queue, same wave — the difference is
  per-story plan discipline. Disposition: **accept as-is**; adopted as the model in lesson L1.
- **F7-6 — Uncommitted tail touches this epic's test blocks**: the pre-existing working-tree diff
  adds focus-preservation to the Story 7.1 describe and light-wash ink assertions after Story 7.3
  (`tests/panel-a11y.test.mjs` +17/−1), from the later UX-audit queue task; suite green including
  them (274/274). Disposition: **defer** → commit through the normal loop (A4 in the Epic 5 retro).

## Behavior verification

Executed in this session (2026-11-25, headless queue):

- `node --test "tests/*.test.mjs"` → **274 tests, 50 suites, 274 pass, 0 fail** (~12.1s), including
  the full UJ-1..UJ-4 e2e suite driven through the real MCP stdio transport and lifecycle hooks.
- `node scripts/check-version-sync.mjs` → 4/4 at 0.4.0, exit 0.
- `node --check scripts/*.mjs` → pass; repo-root `node scripts/validate.mjs` → exit 0.
- Narrowing recorded: `bmad-review` multi-lens pass skipped per queue execution policy
  (review=none); interactions exercised in the deterministic DOM env, not a real browser
  (shared open item O1 in the Epic 6 retro covers the browser pass for the combined HUD surface).

## Previous-retro follow-through

Nothing to follow through on — no previous retrospective file exists in the initiative.

## Action items

- **A4 (defer, owner: user)**: commit the uncommitted UX-audit test tail extending Story 7.1/7.3
  blocks + the untracked `plan-ux-audit-v0.4.0-panel-exports.md` (F7-6).
- **L1 (lesson, owner: build workflow)**: adopt Epic 7's tracker discipline as the Wave 3 standard —
  one plan file per story, linked by `tickets.py`, verification blocks with executed dates/counts,
  story-attributable commits. (Contrast: Epic 5's Story 5.4 shipped with no tracker at all.)
- **L4 (lesson)**: high-risk "beyond criteria" checks named in the epic file should be encoded as
  running e2e assertions (as 7.5 did for tool-result survival), not left as manual release steps.

Durable engineering lessons (recorded for reuse):

1. Timing budgets (<100ms, ≤50ms) are only real when a test measures them — presence assertions
   never caught a budget regression in this wave; the measured ones did their job.
2. Closing a wave with a dedicated e2e + release-stamp story (7.5) converts the epic's risk notes
   into permanent regression coverage.

## Decision records

No `<frozen-after-approval>`/`<intent-contract>` blocks or Design Notes in `plan-7.*.md` (grep) —
nothing extractable from plans. One decision proposed from the as-built record (headless:
**proposed only, not written**):

- **Proposed ADR — "Missing-plugin Stage 2 always falls back to a built-in standalone HTML
  explainer rather than failing the Pop-Out"**: context — external visual plugins may be absent
  (`epic-concept-deep-dive.md:34` R3, AD-17 mandatory fallback); decision — panel sets transient
  `missingPluginFallback`, calls `vibe_debrief_export_html({conceptSlug, targetPlugin})`, renders
  the 3-column grid + persistent `missing-banner` with `Install <plugin>` CTA; why — recorded in
  the epic's risk note ("Owns the mandatory missing-plugin Stage 2 HTML fallback (AD-17)") and
  plan-7.3's Intent. Suggested file: `docs/decisions/adr-mandatory-stage2-html-fallback.md` —
  awaiting user approval.

## Acceptance verdict

**accepted-with-open-items** — criteria **declared** (R1–R4, Done when 1–3).

- Done-when 1 (pill → drawer <100ms, zero RPC, 104px micro-visual, both themes): met —
  `cockpit-e2e.test.mjs:765-772` measured timing; theme coverage via panel-a11y/theme suites.
- Done-when 2 (Stage 2 ui/message for installed plugins; 3-column HTML artifact + banner survival
  for missing ones): met — UJ-2 `cockpit-e2e.test.mjs:641`, banner a11y `panel-a11y.test.mjs:3139`.
- Done-when 3 (full suite green + 4 locations at 0.4.0): met — 274/274 and sync OK, executed this
  session.
- All 5 tickets finished; no blocking findings. Sole open item: A4 (deferred uncommitted tail);
  real-browser confirmation rides on Epic 6's O1.

## Open questions

- Should the three proposed ADRs (Epics 5–7 retros) be written to `docs/decisions/`? A headless
  run only proposes; a user answer decides.
- Whether to persist the top wave lessons to ZCode `MEMORY.md` via `vibe_debrief_confirm_lesson`
  (plugin Memory Rule requires user confirmation, unavailable here).

## Assumptions (headless run)

1. Epic resolved from the invocation ("Wave 2 Epics 5-7") to this folder; no interactive offer.
2. Headless mode assumed (queue context, no interactive user): no confirmations, no team
   discussion, verdict on evidence alone.
3. `bmad-review` skipped per queue execution policy `review=none`; narrowing recorded.
4. Verdict rendered with no human decision present; A4 and the ADR proposal left deferred/proposed.
5. The pre-existing uncommitted test tail was treated as evidence, not modified or committed by
   this run.
