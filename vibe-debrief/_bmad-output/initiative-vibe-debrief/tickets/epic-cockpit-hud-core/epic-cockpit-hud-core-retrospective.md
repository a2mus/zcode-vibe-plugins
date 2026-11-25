---
epic: epic-cockpit-hud-core
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective — epic-cockpit-hud-core (Wave 2 Epic 6, Cockpit HUD shell & visuals)

Part of the combined Wave 2 retrospective run (Epics 5–7) executed as BMAD Queue Task #4
(`/bmad-retrospective`, route=oneshot, review=none). Sibling documents:
`../epic-cockpit-contract/epic-cockpit-contract-retrospective.md`,
`../epic-concept-deep-dive/epic-concept-deep-dive-retrospective.md`.

## Epic summary

Spec: `epic-cockpit-hud-core.md` (Requirements R1–R7, `Done when` 1–3 — declared criteria).

Tickets (build order, `tickets.py status epic-cockpit-hud-core`, run 2026-11-25): 6.1 header/
gear-popover/Radar tracer — done; 6.2 Waiting-On-You chips/inline reply/microBlocks — done;
6.3 X-Ray toggle — done; 6.4 5-grammar SVG stage/dash-flow/powerup-dock — done; 6.5 Anytime
Visual tour/Minimal strip/unclear-box — done; 6.6 standalone HTML export parity — done;
6.7 refactor sweep — done. `pending_tickets` empty at run start and after.

Also tracked in `tickets/` (non-entry queue records, skipped by `tickets.py` as "names no entry"):
`plan-ux-audit-v0.4.0-panel-exports.md` (untracked at run time), `plan-ux-sync-views-flows-consistency.md`.

Evidence inventory (Phase 1):

- Epic file read in full; plans `plan-6.1…md` … `plan-6.7…md` frontmatter + sections read
  (Intent / Implementation Details / Verification (Executed 2026-11-24/25)). **No plan carries
  `baseline_revision`** → per-plan diff ranges underivable; one inferred epic-set range
  `a013a2a..HEAD` used (11 commits, 0 merges; monorepo — sibling `bmad-companion/` churn excluded
  from the ranking below). Shared with the Epic 5 retro; see that document for the full range note.
- `git_evidence.py` churn for this epic's layer files: `assets/panel.html` +3725/−767 (net **+2958**,
  3 commits), `scripts/debrief-engine.mjs` +1558/−140 (export template half),
  `tests/export-parity.test.mjs` +892 (new), `tests/panel-a11y.test.mjs` +2536/−722 (2 commits),
  `tests/cockpit-e2e.test.mjs` +1195 (new), `tests/theme-parity.test.mjs` +131/−8.
  `binary_revisions` 0; no merges → ranking complete for the range.
- Current absolute sizes (read this session): `assets/panel.html` **5,927 lines**,
  `scripts/debrief-engine.mjs` **3,674 lines**, `tests/panel-a11y.test.mjs` 3,157,
  `tests/cockpit-e2e.test.mjs` 1,195, `tests/export-parity.test.mjs` 923.
- Session logs: not available → process-lesson analysis from logs skipped.
- Previous retrospective: none exists → nothing to follow through on (missing file, not "no items").
- UX run records: `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/.memlog.md` (decision log
  through "UX ergonomics audit & implementation complete (197/197 tests, version sync,
  validate.mjs)") — read; treated as claims, re-verified by this session's full-suite run.

## Findings

### God-file / size growth

- **F6-1 — `assets/panel.html` grew net +2,958 lines this wave to 5,927 lines** (churn ranking top
  of `files`; absolute size read this session). It is the single largest artifact and accreted all
  seven stories. Qualifier: this is **legitimately large by constraint**, not a god-class by
  oversight — AGENTS.md mandates a 100% self-contained panel (zero external `<script>`/`<link>`/
  fetches, `unsafeEval: false`), which forbids module splitting; internal section banners
  (e.g. `// Story 6.5 — Minimal Mode gate` at `assets/panel.html:3942-3951`) and the
  panel-a11y/e2e suites are the mitigation. Disposition: **accept as-is with watch** — any future
  wave adding >1k lines should first extract shared render helpers into clearly delimited internal
  sections or revisit the constraint with the user (lesson L2 below).

### Duplication map

- **F6-2 — Panel renderer and `generateStandaloneHtmlArtifact` dual-code X-Ray, the 5 grammars,
  microBlocks, and the unclear-box.** This is bounded by design: `tests/export-parity.test.mjs`
  (923 lines) asserts shared contracts rather than duplicated snapshots — e.g. "shares the X-Ray
  CSS-only swap contract with the panel (body[data-xray-mode] rules + pre-bound spans)"
  (`tests/export-parity.test.mjs`, Story 6.6 describe) and the low-confidence unclear-box export
  (`scripts/debrief-engine.mjs:2049-2058`, asserted with XSS-escape checks in the uncommitted tail,
  see F6-4). Disposition: **accept as-is** — parity tests are the control; keep them growing with
  every new dual-coded component (lesson L3).

### Spec-to-implementation reconciliation

- **F6-3 — R1–R7 checked against code/tests, no silent drops found.** Sampled anchors: minimal-strip
  + Expand override + mutual exclusion with unclear-box (`assets/panel.html:3952-4000`, `:4324`,
  `:4768`, `:5623-5628`); low-confidence unclear-box in exports (`debrief-engine.mjs:2049-2058`);
  CSP contract clean (`eval(`/`new Function`/`onclick=` count in panel.html: **0**, grep this
  session); stdout discipline clean. Done-when #1's *browser* clause ("Opening the panel at
  320–460px shows…") is verified headlessly at DOM level only — **never checked in a real
  browser in this run**; recorded as narrowed, not clean-and-verified (open item O1).

### Pattern divergence / working-tree state

- **F6-4 — Uncommitted test tail at retro time**: `tests/export-parity.test.mjs` +31 (scene-pill
  keyboard nav: Home/End/Arrow roving tabindex; Field Desk Light wash overrides; unclear-box export
  escaping) and `tests/panel-a11y.test.mjs` +17/−1 (concept-pill focus preservation; light-theme
  ink overrides), plus untracked `tickets/plan-ux-audit-v0.4.0-panel-exports.md`. These extend
  Story 6.6/7.1/7.3 assertions from the UX-audit queue task; the full suite passes **including**
  them (274/274 below). Disposition: **defer** — commit through the normal loop (Action item A4 in
  the Epic 5 retro; owner: user/next queue task). Not authored by this retro run.

## Behavior verification

Executed in this session (2026-11-25, headless queue — deterministic DOM env, no real browser):

- `node --test "tests/*.test.mjs"` → **274 tests, 50 suites, 274 pass, 0 fail** (~12.1s). Exercises
  the HUD shell, 5-state chips, X-Ray swap, 5-grammar SVG, minimal-strip/unclear-box exclusivity,
  export parity (offline, `\u003c` escaping, zero external assets), theme parity, a11y/keyboard,
  and the UJ-1..UJ-4 e2e flows through the real MCP stdio transport.
- `node scripts/check-version-sync.mjs` → OK, 4/4 locations at 0.4.0, exit 0.
- `node --check scripts/*.mjs` → pass; repo-root `node scripts/validate.mjs` → `✓ vibe-debrief
  v0.4.0 validated`, exit 0 (includes inline panel `<script>` parseability).
- Narrowing recorded: `bmad-review` multi-lens pass **skipped per queue execution policy
  (review=none)**; no interactive-browser pass performed (O1).

## Previous-retro follow-through

Nothing to follow through on — no previous retrospective file exists in the initiative (this run
created the first three, for Wave 2 Epics 5–7).

## Action items

- **O1/A5 (defer, owner: user)**: one real-browser smoke pass of Done-when #1 at 320–460px — HUD |
  Visual | Memory & History views, gear-popover persistence, both themes, reduced-motion — which
  headless DOM tests cannot fully substitute (F6-3).
- **A4 (defer, owner: user)**: commit the uncommitted UX-audit test tail + untracked
  `plan-ux-audit-v0.4.0-panel-exports.md` (F6-4).
- **L2 (lesson, owner: future waves)**: panel.html at ~5.9k lines is at the constraint's ceiling;
  propose an internal-section extraction pass or a constraint review before the next +1k-line wave.
- **L3 (lesson)**: every new dual-coded panel/export component must land with an export-parity
  contract test in the same story — the wave's clean duplication record comes from that discipline.

Durable engineering lessons (recorded for reuse):

1. Parity tests that assert *shared contracts* (same CSS selectors, same swap mechanism) scale
   better than snapshot-matching duplicated renderers.
2. A single-file UI mandated by a security constraint needs section-banner discipline and size
   watch in retros, since the usual god-class remedy (split modules) is forbidden.

## Decision records

No `<frozen-after-approval>`/`<intent-contract>` blocks or Design Notes exist in this epic's plans
(grep across all `plan-6.*.md`) — nothing extractable. One decision proposed from the as-built
record (headless: **proposed only, not written**):

- **Proposed ADR — "Standalone HTML export dual-codes panel visuals under contract-parity tests
  instead of sharing a template engine"**: context — zero-external-asset offline exports
  (`epic-cockpit-hud-core.md:38` R7/C1–C10) forbid runtime reuse of panel.html; decision — string-
  built export in `generateStandaloneHtmlArtifact` with `tests/export-parity.test.mjs` enforcing
  contract equality; why — recorded in plan-6.6 Intent ("all offline with zero external URLs")
  and the Story 6.6 verification block. Suggested file:
  `docs/decisions/adr-export-parity-dual-coding.md` — awaiting user approval.

## Acceptance verdict

**accepted-with-open-items** — criteria **declared** (R1–R7, Done when 1–3).

- Done-when 1: components verified present and behaviorally asserted at DOM level across both
  themes (panel-a11y + cockpit-e2e suites, 274/274 this session); real-browser confirmation at
  320–460px **not performed** in this headless run → open item O1 (deferred, tracked).
- Done-when 2: export self-containment, 5 grammars, light/dark `@media` parity, `\u003c` escaping —
  export-parity suite green this session.
- Done-when 3: `node --test` 274/274 and `node --check` pass; CSP/XSS/a11y assertions green.
- All 7 tickets finished; no blocking finding open. Open items: O1, A4.

## Open questions

- Does the user consider DOM-level e2e sufficient for Done-when #1, or is a browser pass required
  before Epic 6 is called closed? A human answer moves O1 from deferred to closed-or-blocking.
- Whether the proposed export-parity ADR should be written (headless run cannot approve it).

## Assumptions (headless run)

1. Epic resolved from the invocation ("Wave 2 Epics 5-7") to this folder; no interactive offer.
2. Headless mode assumed (no interactive user in queue context): no confirmations, no team
   discussion, verdict on evidence alone.
3. `bmad-review` skipped per queue execution policy `review=none`; narrowing recorded, not substituted.
4. Verdict rendered with no human decision present; O1/A4/ADR left proposed/deferred, not applied.
5. The uncommitted test tail (F6-4) was treated as pre-existing evidence, not modified or committed
   by this run; the 274/274 result includes it, and committed-tree results are recorded separately
   in `tickets/plan-review-wave2-v0.4.0-precommit-queue-code-review.md` (272/272).
