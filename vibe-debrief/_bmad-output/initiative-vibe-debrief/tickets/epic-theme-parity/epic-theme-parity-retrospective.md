---
epic: epic-theme-parity
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective — epic-theme-parity (Wave 1 Epic 3, light-theme parity)

Part of the combined Wave 1 retrospective run (Epics 1–4) executed as BMAD Queue Task #2
(`/bmad-retrospective`, route=oneshot, review=none) before tagging `v0.4.0`. Sibling documents:
`../epic-test-suite/epic-test-suite-retrospective.md`,
`../epic-atomic-state/epic-atomic-state-retrospective.md`,
`../epic-panel-a11y/epic-panel-a11y-retrospective.md`.

## Epic summary

Spec: `epic-theme-parity.md` (Requirements R1–R2, Constraints C1/C3/C5, `Done when` 1–3 — declared
criteria; companion `DESIGN.md`).

Tickets (build order, `tickets.py status epic-theme-parity`, run 2026-11-25):

| Ref | Title | Status |
|-----|-------|--------|
| 3.1 | Shared Dark HUD & Field Desk Light CSS tokens & panel SVG diagram parity tracer | done |
| 3.2 | Panel Canvas explainer & standalone HTML export light/dark theme parity | done |

`pending_tickets` is empty (`2/2` done in `tickets.toml` and both plan files).

Evidence inventory (Phase 1):

- Epic file `epic-theme-parity.md` and `tickets/tickets.toml` read in full.
- Plans `story-shared-dark-hud-field-desk-light-css-tokens-panel-svg-diagra-plan.md` (`3.1`) and
  `plan-3.2-canvas-standalone-html-theme-parity.md` (`3.2`) read in full. Story `3.1` carries
  `baseline_revision: 'ca76e2e11303215be2920969dbc1c25055e44c55'`; Story `3.2` **omits
  `baseline_revision`** and landed bundled inside commit `799747a` alongside Stories `4.1` and `4.2`.
- `git_evidence.py` ranges:
  - `3.1` (`ca76e2e..da2e921`, 1 commit `da2e921`, 0 merges): `assets/panel.html` +279/−79 (net
    +200), `tests/theme-parity.test.mjs` +729 (new), plan +112.
  - `3.2` (inside `da2e921..a013a2a`, specifically commit `799747a` shared with Stories `4.1`–`4.2`):
    `assets/panel.html` +684 total in `799747a`, `scripts/debrief-engine.mjs` +167 (`generateStandaloneHtmlArtifact`),
    `tests/helpers.mjs` +60 (shared CSS/contrast helpers), `tests/theme-parity.test.mjs` +175/−70,
    `tests/debrief-engine.test.mjs` +275, UX doc sync (`DESIGN.md`, `EXPERIENCE.md`, `.memlog.md`).
  - `binary_revisions` 0 across both ranges.
- Run records in-tree: `../epic-panel-a11y/tickets/plan-review-3.2-4.1-4.2-combined-queue-code-review.md`
  read (approved `3.2`/`4.1`/`4.2` with 3 minor non-blocking notes).
- Current absolute sizes (measured this session): `tests/theme-parity.test.mjs` 957 lines;
  `THEME_TOKEN_DEFAULTS` / `resolveThemeTokens` / `applyHostTheme` at `assets/panel.html:2479-2662`.
- Session logs: **not available** in queue context → process-lesson analysis from logs skipped.
- Previous retrospective: `../epic-atomic-state/epic-atomic-state-retrospective.md` (created in this
  same Wave 1 retro run; no prior retro existed when Epic 3 ran).

## Findings

### Process / commit attribution

- **F3-1 — Story 3.2 lacks `baseline_revision` and landed bundled with Epic 4 (`4.1`–`4.2`) in commit `799747a`.**
  Because `plan-3.2` has no `baseline_revision` and commit `799747a` combines Story `3.2` with
  Stories `4.1` and `4.2`, isolated `3.2` vs `4.1`/`4.2` diff volumes in `assets/panel.html` cannot
  be separated deterministically. Mitigated by the combined queue review in
  `plan-review-3.2-4.1-4.2-combined-queue-code-review.md`. Disposition: **accept as-is** + process
  lesson (one story/epic per commit with `baseline_revision`).

### Spec-to-implementation reconciliation

- **F3-2 — Two light Canvas stage tokens were derived because `DESIGN.md` omitted explicit light stage/grid entries.**
  Recorded in `plan-3.2-canvas-standalone-html-theme-parity.md:72-73`: `--explainer-stage-bg`
  (`#f1ece1`, from `DESIGN.md` `bg-elevated-light`) and `--canvas-grid-line` (`rgba(2, 132, 199, 0.08)`,
  from `accent-light`) were derived during Story 3.2 implementation and verified via WCAG AA
  contrast and `drawExplainerFrame()` tests. Disposition: **accept as-is** (documented in `plan-3.2`
  and verified in `tests/theme-parity.test.mjs`).

- **F3-3 — Real-browser / OS light-mode inspection was not exercised in headless runs.**
  `epic-theme-parity/tickets/tickets.toml:10,22` specifies switching host theme and inspecting the
  panel Canvas and exported HTML artifact in light and dark modes. Automated verification runs in a
  Node `vm` DOM/Canvas stub (`tests/theme-parity.test.mjs`, `tests/debrief-engine.test.mjs`), not a
  live Chromium/ZCode iframe. Disposition: **defer** — already tracked in Wave 2 Epic 6 Open item O1
  ("one real-browser smoke pass at 320–460px in both themes").

- **F3-4 — R1/R2 and CSP/duplication controls checked and clean.**
  `THEME_TOKEN_DEFAULTS`, `resolveThemeTokens()`, and `applyHostTheme()` (`assets/panel.html:2479-2662`)
  remain the shared theme-resolution spine used by Wave 2 Cockpit HUD visuals (`:3652`, `:4372`,
  `:4462`, `:4925`). `assets/panel.html` has `0` `eval(`/new Function/`onclick=`/external fetch violations,
  and `tests/helpers.mjs` deduplicated CSS parsing/contrast helpers across `theme-parity.test.mjs`
  and `debrief-engine.test.mjs`.

## Behavior verification

Executed in this session (2026-11-25, headless queue on Node `v26.12.1`):

- `node --test "tests/*.test.mjs"` → **274 tests, 50 suites, 274 pass, 0 fail, 0 skipped** (~10.8s).
  Includes `tests/theme-parity.test.mjs`, `tests/export-parity.test.mjs`, and
  `tests/debrief-engine.test.mjs` dark/light CSS token, WCAG AA contrast, SVG, Canvas, and
  `prefers-color-scheme: light` export parity suites.
- `node --check scripts/*.mjs` and `node ../scripts/validate.mjs` → exit `0` (includes inline panel
  `<script>` syntax parseability).
- Narrowing recorded: `bmad-review` multi-lens pass **skipped per queue execution policy (`review=none`)**;
  live browser/ZCode iframe rendering not exercised headlessly (F3-3 / Epic 6 O1).

## Previous-retro follow-through

`../epic-atomic-state/epic-atomic-state-retrospective.md` was produced in this same Wave 1 run; no
prior retrospective existed when Epic 3 executed.

## Action items

- **A3-1 (defer — rides on Epic 6 O1, owner: user)**: include Wave 1 theme parity spot-check (Dark
  HUD vs Field Desk Light SVG/Canvas and exported HTML in OS light mode) in the live ZCode desktop
  visual spot-check at `320–460px` width (F3-3).

Durable engineering lessons (recorded for reuse):

1. Centralizing CSS token extraction and WCAG contrast math in `tests/helpers.mjs` eliminated
   duplication between panel and export theme tests and scaled cleanly into Wave 2's `export-parity.test.mjs`.
2. Resolving theme tokens dynamically via `getComputedStyle` with a structured `THEME_TOKEN_DEFAULTS`
   fallback let Wave 2 add 5 diagram grammars and Stage 1 micro-visuals without reintroducing
   hardcoded dark-only hex literals.

## Decision records

Story 3.1's `<intent-contract>` (`:34`) records preserving legacy CSS aliases (`--bg-primary`,
`--bg-secondary`, `--bg-tertiary`, `--success`, `--warning`, `--danger`) mapped to `DESIGN.md`
tokens, and `plan-3.1`/`plan-3.2` record dual-mode `@media (prefers-color-scheme: light)` export
parity (`AD-6`). Headless run: **proposed only, no file written**:

- **Proposed ADR — "Theme-token resolver (`resolveThemeTokens`) + automatic `@media (prefers-color-scheme: light)` export parity"**:
  context — panel runs inside ZCode's themed iframe (`hostContext.theme` / `host-context-changed`)
  while exported HTML runs standalone offline; decision — panel resolves CSS custom properties via
  `resolveThemeTokens()` (`assets/panel.html:2557`) with legacy variable aliases preserved, and
  standalone exports embed both `:root` Dark HUD and `@media (prefers-color-scheme: light)` palettes
  with a live `matchMedia` listener (`scripts/debrief-engine.mjs`); why — recorded in
  `epic-theme-parity.md:59` (`AD-6`) and `plan-3.1`/`plan-3.2` Intent sections. Suggested file:
  `docs/decisions/adr-theme-token-resolver-and-export-media-parity.md` — awaiting user approval.

## Acceptance verdict

**accepted-with-open-items** — criteria **declared** (`epic-theme-parity.md` Requirements R1–R2,
`Done when` 1–3).

- Done-when 1 (SVG/Canvas read resolved CSS custom properties and re-render on `host-context-changed`):
  met at DOM/vm level — `assets/panel.html:2479-2662`, verified in `tests/theme-parity.test.mjs`.
- Done-when 2 (standalone export embeds Dark HUD + `@media (prefers-color-scheme: light)` palettes,
  drives SVG/Canvas from tokens, zero external assets): met — verified in `tests/debrief-engine.test.mjs`
  and `tests/export-parity.test.mjs`.
- Done-when 3 (`node:test` light/dark theme-token suites pass): met — `274/274` pass this session.
- Both tickets (`3.1`, `3.2`) finished (`pending_tickets` empty); sole open item is the non-blocking
  real-browser visual spot-check (`A3-1`, shared with Epic 6 O1).

## Open questions

- Confirm whether live ZCode desktop spot-check (`A3-1` / Epic 6 O1) closes both Epic 3 and Epic 6
  browser-verification open items together.

## Assumptions (headless run)

1. Epic resolved from the invocation ("Wave 1 epics (…, epic-theme-parity, …)") to
   `_bmad-output/initiative-vibe-debrief/tickets/epic-theme-parity`.
2. Headless queue mode: no interactive confirmations, no Phase 3 team discussion, verdict rendered
   from evidence alone.
3. `bmad-review` multi-lens pass skipped per queue execution policy `review=none`; narrowing recorded.
4. No workspace files outside this retrospective document were edited; the proposed ADR was not written.
