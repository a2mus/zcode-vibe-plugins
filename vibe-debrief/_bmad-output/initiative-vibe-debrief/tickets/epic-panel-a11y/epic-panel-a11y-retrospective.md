---
epic: epic-panel-a11y
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective — epic-panel-a11y (Wave 1 Epic 4, keyboard/AT panel & v0.3.0 release)

Part of the combined Wave 1 retrospective run (Epics 1–4) executed as BMAD Queue Task #2
(`/bmad-retrospective`, route=oneshot, review=none) before tagging `v0.4.0`. Sibling documents:
`../epic-test-suite/epic-test-suite-retrospective.md`,
`../epic-atomic-state/epic-atomic-state-retrospective.md`,
`../epic-theme-parity/epic-theme-parity-retrospective.md`.

## Epic summary

Spec: `epic-panel-a11y.md` (Requirements R1–R3, Constraints C1/C3–C5, `Done when` 1–3 — declared
criteria; companions `DESIGN.md`, `EXPERIENCE.md`).

Tickets (build order, `tickets.py status epic-panel-a11y`, run 2026-11-25):

| Ref | Title | Status |
|-----|-------|--------|
| 4.1 | Panel ARIA landmarks, live regions, focus rings & tab keyboard navigation tracer | done |
| 4.2 | Keyboard-operable SVG nodes, history rows & prefers-reduced-motion support | done |
| 4.3 | 4-file version sync verifier (check-version-sync.mjs) & v0.3.0 release stamp | done |

`pending_tickets` is empty (`3/3` done in `tickets.toml` and `plan-4.1`..`plan-4.3`). Also in
`tickets/` (non-entry queue records, flagged by `tickets.py status` as skipped):
`plan-review-3.2-4.1-4.2-combined-queue-code-review.md`, `plan-ux-audit-views-flows-ergonomics.md`,
`plan-ux-enhance-views-flows-ergonomics.md`.

Evidence inventory (Phase 1):

- Epic file `epic-panel-a11y.md` and `tickets/tickets.toml` read in full.
- Plans `plan-4.1-panel-aria-landmarks-live-regions-focus-rings-keyboard-nav.md`,
  `plan-4.2-keyboard-svg-nodes-history-reduced-motion.md`, and
  `plan-4.3-4-file-version-sync-verifier-v0-3-0-release-stamp.md` read in full. **None carries
  `baseline_revision`**, so per-plan diff ranges could not be derived; inferred Wave 1 tail range
  `da2e921..a013a2a` (8 commits, 0 merges; monorepo — filtered to `vibe-debrief/`) was measured via
  `git_evidence.py`.
- `git_evidence.py` (`da2e921..a013a2a`, `vibe-debrief/` paths): `assets/panel.html` +682/−147 (net
  +535 across `799747a` and `23c9b4b`), `scripts/check-version-sync.mjs` +171 (new),
  `scripts/debrief-engine.mjs` +623/−101 (includes `3.2` export parity + `4.2` export a11y + early
  `5.1` work in `23c9b4b`), `scripts/mcp-server.mjs` +260/−56 (early `5.1` overlap in `23c9b4b`),
  `scripts/hook-runner.mjs` +1/−1 (`0.3.0` banner), `.zcode-plugin/plugin.json` +1/−1 (`0.3.0`),
  `tests/panel-a11y.test.mjs` +1336/−8 (net +1328), `tests/transports-and-sync.test.mjs` +260/−3,
  `tests/debrief-engine.test.mjs` +778/−28, plus UX specs (`DESIGN.md`, `EXPERIENCE.md`,
  `ux-vibe-debrief.md`, `.memlog.md`) and `marketplace.json` +1/−1 (`a013a2a` bumping `vibe-debrief`
  to `0.3.0`). `binary_revisions` 0.
- Run records in-tree: `plan-review-3.2-4.1-4.2-combined-queue-code-review.md`,
  `plan-ux-audit-views-flows-ergonomics.md`, `plan-ux-enhance-views-flows-ergonomics.md` read.
- Current absolute sizes (measured this session): `assets/panel.html` 5,927 lines (expanded further
  in Wave 2), `scripts/check-version-sync.mjs` 171 lines, `tests/panel-a11y.test.mjs` 3,157 lines.
- Session logs: **not available** in queue context → process-lesson analysis from logs skipped.
- Previous retrospective: `../epic-theme-parity/epic-theme-parity-retrospective.md` (created in this
  same Wave 1 retro run; no prior retro existed when Epic 4 ran).

## Findings

### Process & cross-epic commit contamination

- **F4-1 — Commit `23c9b4b` bundled in-flight Wave 2 Story 5.1 schema work into the Wave 1 `v0.3.0` release stamp.**
  `23c9b4b` ("land version tri-sync gate (4.3) and v0.3.0 stamp") touched `scripts/debrief-engine.mjs`
  and `scripts/mcp-server.mjs` (+762/−111 between `799747a` and `23c9b4b`) for in-flight Story 5.1
  publish pass-through alongside Story 4.3's `check-version-sync.mjs` and `0.3.0` stamp (`plan-5.1`
  was also added in the same commit). Similarly, `799747a` combined Stories `3.2`, `4.1`, and `4.2`,
  and none of `plan-4.1`..`plan-4.3` recorded `baseline_revision`. Disposition: **accept as-is**
  (Story 5.1 completed cleanly in Wave 2). Prevention: keep release-stamp commits isolated from
  next-wave runtime changes (Action item A4-1).

- **F4-2 — Auxiliary review/UX plan files in `tickets/` trigger `tickets.py status` skipped-file warnings.**
  `plan-review-3.2-4.1-4.2-combined-queue-code-review.md`, `plan-ux-audit-views-flows-ergonomics.md`,
  and `plan-ux-enhance-views-flows-ergonomics.md` live in `epic-panel-a11y/tickets/` without
  matching `tickets.toml` entries, emitting 3 `problems` warnings in `tickets.py status` (same
  pattern observed in Wave 2 Epics 5–6). Disposition: **accept as-is** (harmless tool warning; record
  for Wave 3 queue hygiene).

### Release gate & accessibility continuity into `v0.4.0`

- **F4-3 — No git tag exists for `v0.3.0` (`git tag -l` empty), while `check-version-sync.mjs` now enforces `v0.4.0`.**
  `git tag -l` returned empty this session; the repository progressed directly from `a013a2a`
  (`v0.3.0` marketplace bump) into Wave 2 (`v0.4.0` stamped in Story 7.5). `scripts/check-version-sync.mjs`
  continues to pass (`4/4` locations synced to `0.4.0`), proving Wave 1's Story 4.3 gate protects
  Wave 2 release readiness before tagging `v0.4.0`.

- **F4-4 — R1/R2/R3 and CSP/security constraints checked and clean; real-browser AT check narrowed.**
  - `assets/panel.html` grep this session: `0` occurrences of `eval(`, `new Function`, `onclick=`,
    `onkeydown=`, `fetch(`, `XMLHttpRequest`, `<script src`, or `<link `.
  - `console.log` grep in `scripts/mcp-server.mjs`, `scripts/hook-runner.mjs`, and
    `scripts/debrief-engine.mjs`: `0` occurrences.
  - `prefersReducedMotion()` (`assets/panel.html:2399`, `:3935`, `:4384`, `:4953`, `:5151`) and
    3,157 lines of ARIA/keyboard/reduced-motion tests in `tests/panel-a11y.test.mjs` pass inside
    the `274`-test suite.
  - Real-browser / screen-reader / keyboard spot-check (`tickets.toml` `verify` strings for `4.1`–`4.2`)
    was verified via Node `vm` DOM stub rather than a live browser; rides on Wave 2 Epic 6 Open item
    O1 (Action item A4-2).

## Behavior verification

Executed in this session (2026-11-25, headless queue on Node `v26.12.1`):

- `node --test "tests/*.test.mjs"` → **274 tests, 50 suites, 274 pass, 0 fail, 0 skipped** (~10.8s).
  Includes `tests/panel-a11y.test.mjs` and `tests/transports-and-sync.test.mjs` (`4-file version sync
  gate`, 6 tests).
- `node scripts/check-version-sync.mjs` → `.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs`,
  `assets/panel.html`, `scripts/hook-runner.mjs` all report `0.4.0`, exit `0`.
- `node --check scripts/*.mjs` and `node ../scripts/validate.mjs` → `✓ vibe-debrief v0.4.0 validated`,
  exit `0`.
- Narrowing recorded: `bmad-review` multi-lens pass **skipped per queue execution policy (`review=none`)**;
  live assistive-tech / keyboard browser session not executed headlessly (F4-4 / Epic 6 O1).

## Previous-retro follow-through

`../epic-theme-parity/epic-theme-parity-retrospective.md` was produced in this same Wave 1 run; no
prior retrospective existed when Epic 4 executed.

## Action items

- **A4-1 (process lesson, owner: release/queue operator)**: never bundle next-wave runtime/schema
  edits into a release-stamp commit (`23c9b4b`); tag releases (`v0.4.0`) only on clean stamp/test
  boundaries.
- **A4-2 (defer — rides on Epic 6 O1, owner: user)**: include keyboard-only `Tab`/`Arrow`/`Enter`/`Space`/
  `Escape` navigation and `prefers-reduced-motion` smoke verification during the live ZCode desktop
  panel pass at `320–460px` width (F4-4).

Durable engineering lessons (recorded for reuse):

1. Separating pure extraction/comparison functions (`collectVersionDeclarations`, `compareVersionDeclarations`)
   from `main()` in `scripts/check-version-sync.mjs` allowed `node:test` to verify drift/error paths
   without mutating real manifests, and scaled seamlessly from `0.3.0` to `0.4.0`.
2. Asserting semantic ARIA roles/attributes (`tablist`/`tab`/`tabpanel`, `role="status"`,
   `aria-live="polite"`, `tabindex="0"`) rather than fragile layout wrappers let Wave 1's `panel-a11y`
   floor survive Wave 2's full Cockpit HUD layout overhaul.

## Decision records

No plan in `epic-panel-a11y` carries a `<frozen-after-approval>`/`<intent-contract>` block or Design
Notes — nothing extractable from plans. One decision proposed from the as-built record (headless
run: **proposed only, not written**):

- **Proposed ADR — "Zero-dependency 4-file version sync gate (`scripts/check-version-sync.mjs`)"**:
  context — ZCode plugins declare semver across four independent files (`.zcode-plugin/plugin.json`,
  `scripts/mcp-server.mjs` `serverInfo.version`, `assets/panel.html` `appInfo.version`, and
  `scripts/hook-runner.mjs` `SessionStart` banner) (`C4`); decision — `scripts/check-version-sync.mjs`
  exports pure `collectVersionDeclarations` + `compareVersionDeclarations` helpers tested in
  `tests/transports-and-sync.test.mjs` and runs as a standalone CLI release gate (`23c9b4b`); why —
  recorded in `epic-panel-a11y.md:35` and `plan-4.3:16-36`. Suggested file:
  `docs/decisions/adr-4-file-version-sync-gate.md` — awaiting user approval.

## Acceptance verdict

**accepted-with-open-items** — criteria **declared** (`epic-panel-a11y.md` Requirements R1–R3,
`Done when` 1–3).

- Done-when 1 (semantic ARIA landmarks/live regions, `:focus-visible`, keyboard navigation, and
  `prefers-reduced-motion: reduce`): met at DOM/vm level — `tests/panel-a11y.test.mjs` passes inside
  `274/274` suite; live browser/AT check rides on Epic 6 O1 (`A4-2`).
- Done-when 2 (`scripts/check-version-sync.mjs` verifies all 4 locations and is wired into
  `node:test`): met — verified at `0.3.0` in `23c9b4b` and passing at `0.4.0` this session.
- Done-when 3 (full `node:test` suite green): met — `274/274` pass this session.
- All 3 tickets (`4.1`–`4.3`) finished (`pending_tickets` empty); no blocking findings remain before
  tagging `v0.4.0`.

## Open questions

- Confirm whether the combined live ZCode desktop spot-check (`A4-2` / Epic 6 O1) should run before
  creating the `v0.4.0` git tag, and whether any of the proposed Wave 1/Wave 2 ADRs should be written
  to `docs/decisions/`.

## Assumptions (headless run)

1. Epic resolved from the invocation ("Wave 1 epics (…, epic-panel-a11y)") to
   `_bmad-output/initiative-vibe-debrief/tickets/epic-panel-a11y`.
2. Headless queue mode: no interactive confirmations, no Phase 3 team discussion, verdict rendered
   from evidence alone.
3. `bmad-review` multi-lens pass skipped per queue execution policy `review=none`; narrowing recorded.
4. No workspace files outside this retrospective document were edited; the proposed ADR was not written.
