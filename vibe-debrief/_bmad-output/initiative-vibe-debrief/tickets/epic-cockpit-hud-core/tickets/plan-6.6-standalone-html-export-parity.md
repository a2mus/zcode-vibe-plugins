---
title: 'Standalone HTML export parity for Cockpit HUD & 5 grammars'
type: feature
ticket: 6
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R7]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/epic-cockpit-hud-core.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 6.6 — Standalone HTML Export Parity for Cockpit HUD & 5 Grammars

## Intent

Completes Story 6.6 (`epic-cockpit-hud-core` Story 6, R7):
Builds on Epic 3's `generateStandaloneHtmlArtifact` baseline (3.2) and Stories 3–5's dual-coded X-Ray, 5-grammar SVG, and Anytime Canvas tour to upgrade the standalone export with the 10s Radar, a local X-Ray toggle, the composable microBlocks (choice-grid, proof pills, audit rows, lessons, waiting strip), all 5 SVG grammars, and the Canvas tour with scene pills — all offline with zero external URLs, `@media (prefers-color-scheme: light)` Field Desk Light tokens, and `\u003c` JSON escaping with `node:test` assertions.

## Implementation Details

- `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`, ~+150 lines template / ~-40 legacy lines):
  - **10s Radar card**: the export `hero` became `hero radar-card` (`role="region" aria-label="10 second radar summary"`) with `#radarVerdictPill` (Built/Solved/Blocked/Planned classes), `#radarVerifyCount` (`N verified · M unverified` / `N checks left`), a `<= 14`-word dual-coded `#tldrHeadline` (Story 6.3 `buildXrayDualCodedMarkup` + `collectXrayTechTokens`), meta pills (mode / persona / STE metrics / complexity), timestamp, analogy, and the 5-state `wait-strip` (`wait-badge` + dual-coded prompt + offline `action-chip`s).
  - **Local X-Ray toggle**: `#btnXrayToggle` (`data-mode`, `aria-pressed`, `aria-label`) wired in the export script to flip `body[data-xray-mode]` between `plain`/`tech` — one attribute write, CSS-only swap of the pre-bound `.xray-plain`/`.xray-tech` pairs (same contract as the panel; SVG node titles emit the dual `tspan` pair when `techLabel` differs).
  - **microBlocks**: `#microBlockChoices` (choice-grid with dual-coded titles/subtexts + 34x4px `tbar` trade-off bars; offline click marks `picked` + `aria-pressed` + `#choicePickedPill`, no chat dispatch), `#microBlockProofAudit` (proof pills with `aria-expanded`/`aria-controls` + expandable `.proof-detail` + `.audit-row`s), `lessons` microBlock, and the existing storyboard cards/checklist. Waiting chips select locally and surface the honest note `Offline export — send this reply from the live panel: <prompt>` instead of faking a `ui/message` send.
  - **All 5 SVG grammars**: the export script now carries an ES5 port of the panel's 5-grammar builder (sequence lifelines, before-after lane split with the AD-14 lane-safe edge guard, decision-tree root/branches, subway-map lane tracks/station dots, flow-diff left-accent cards) with `viewBox 0 0 460 <h>`, `data-grammar` on `#diagramSvg`, kinetic `.dash-flow` edges, `vd-arrow*` token markers, keyboard/click node inspector, and `dnode` class preserved for the existing a11y/escape tests.
  - **Canvas tour**: kept the token-driven canvas + Play/Pause and added `#explainerScenePills` (static server-rendered pills, client `active`/`aria-pressed` sync, jump-to-scene + caption update). Tour header is honest about scope: `Anytime`/`Complex-Workflow` Animated Explainer.
  - **Theme parity**: new component CSS (radar, xray-toggle, wait-strip, choice-grid, proof pills, audit rows, scene pills, `@keyframes flowDash`) is token-only (zero hardcoded hex); the `@media (prefers-color-scheme: light)` block gained the Field Desk Light semantic wash (`.action-chip.selected/.primary`, `.proof-pill.ok/.risk`, `.choice-item.picked`, `.xray-toggle[data-mode="tech"]`, `.scene-pill.active` → `color:var(--text-primary)`).
  - **Payload**: `DATA` now embeds `diagram` (grammar/groups/techTitle/techLabel nodes), `scenes`, `touchedFiles`, and `waiting`, still `.replace(/</g, "\\u003c")`; all dynamic markup interpolated through `escapeHtml`/`buildXrayDualCodedMarkup`.
  - `resolveTokens()` extended with `border`, `borderSubtle`, `textMuted`, `bgElevated`, `accentBorder`, `ok/warn/risk Soft/Border` so the grammar builder matches the panel's token surface.
- `tests/debrief-engine.test.mjs`:
  - Updated 2 theme-parity token expectations to the 5-grammar rendering (dark step badges/station dots now use `--bg-app` `#090d13`/`#efeae0` per panel parity instead of the legacy single-row `--bg-panel`) and the headline regex to `<h1[^>]*>` (the h1 gained `class`/`id`). Intent of all three assertions unchanged (token-driven render, dual-coded pre-bound headline).
- `tests/export-parity.test.mjs` (new, 6 tests):
  - Mini-DOM harness that "opens" an artifact offline: parses the static body markup (boolean + quoted attributes, entities unescaped for text) and executes the inline script in a `node:vm` sandbox exposing **no network APIs** (`document`, `getComputedStyle` theme tables, `matchMedia` listeners, rAF, recording canvas ctx).
  - Tests: (1) writes the 5 grammar exports to disk, reads the bytes back, asserts zero external URLs / no `<script src>` / no `<link>` / no `fetch`/XHR/sendBeacon/`eval`/`new Function`, then clicks `#btnXrayToggle` in each file → `body[data-xray-mode]` `plain→tech→plain` with `aria-pressed`/`data-mode`/label sync; (2) per-grammar SVG structure (460 viewBox, `dash-flow`, `vd-arrow`, dual `tspan` titles, sequence lifelines, before-after BEFORE/AFTER lanes, decision-tree root+leaves, subway station dots + lane labels, flow-diff left bars) + keyboard node inspection; (3) `prefers-color-scheme` flip re-renders SVG + Canvas with Field Desk Light tokens and no dark leakage; (4) hostile `\u003c` DATA escaping (`JSON.parse` valid, no raw `<`, SVG markup stays escaped, hostile chip id still binds); (5) microBlocks offline interactions (choice pick, proof pill expand/collapse, waiting chip note, scene pill jump, Play/Pause `aria-pressed`); (6) the CSS-only X-Ray swap contract + `flowDash` + reduced-motion kill switch + paired `xray-plain`/`xray-tech` counts.

## Verification (Executed 2026-11-24)

- `node --test tests/` — exits 0 (`237` tests across `42` suites: `237` pass, `0` fail; +6 Story 6.6 tests over the 231 at Story 6.5). Also run as `node --test "tests/*.test.mjs"` — identical 237/237.
- `node scripts/check-version-sync.mjs` — exits 0 (`0.3.0` synced across all 4 locations; no release bump — Epic 6 stays on the 0.3.0 dev line).
- `node ../scripts/validate.mjs` — exits 0 (`bmad-companion` v0.5.3, `vibe-debrief` v0.3.0, `project-colors` v0.1.0 validated; engine `node --check` + inline script parseability pass).
- `saveStandaloneHtmlArtifact` offline-open sweep across all 5 grammars (real engine → temp-dir files → byte checks): X-Ray toggle button + CSS-only swap rules present, `@media (prefers-color-scheme: light)` with both Dark HUD (`#090d13`) and Field Desk Light (`#efeae0`) tokens, zero external URLs, `\u003c`-escaped JSON-valid `DATA` payload, `data-grammar` per file — **5/5 PASS** (`ALL_5_GRAMMARS_OFFLINE_OPEN_OK`).
- Headless Chrome (`--headless=new --allow-file-access-from-files --virtual-time-budget=20000 --dump-dom`, `file://` iframes, real clicks + `getComputedStyle`) opened the 5 exported files offline — **5/5 PASS, 0 FAIL** per grammar: toggle cycles `plain→tech→plain` with `aria-pressed`/`data-mode` sync; `.xray-plain`/`.xray-tech` computed display swaps `inline/none → none/inline` (CSS-only, real engine); `viewBox="0 0 460 …"`; `.dash-flow` edges; dual `tspan` node titles; proof pill expands to `display:block`; scene pill 2 jumps with caption `Open offline and toggle X-Ray.`; waiting chip selects with the honest offline note; radar verdict `Built`; zero script errors.
- **Not run — real-browser light-scheme render**: no Chrome CLI flag in this build forces `prefers-color-scheme: light` (probed `--blink-settings=preferredColorScheme`, `--force-prefers-color-scheme`, `--force-color-scheme`, feature flags — headless follows the OS dark preference). Light-mode styling is instead verified deterministically by the static CSS parity tests and the vm media-change re-render tests above (SVG/Canvas re-render with `#0284c7`/`#ffffff`/`#f1ece1` and zero dark-literal leakage).

## Notes / Handoff

- Offline semantics: waiting chips and choices intentionally do NOT dispatch `ui/message` in the export (no MCP bridge offline); they mark local selection state and surface the exact prompt to send from the live panel — honest fallback, no fabricated sends.
- Stage 1/2 handoff to Epic 7: the export is Stage 1-complete (local SVG + Canvas tour). Stage 2 power-ups (Excalidraw / Interactive Gen UI / VectorCraft buttons) stay panel-only because offline artifacts cannot reach external plugins without violating the zero-external-URL contract; Epic 7 can layer them behind an explicit user opt-in if that contract is relaxed.
- The mini-DOM harness in `tests/export-parity.test.mjs` is reusable for any future export-surface story (it already supports `classList`, `innerHTML` re-parse, keyboard dispatch, canvas recording, and media-change listeners).
- Pre-existing untracked work: `tests/export-parity.test.mjs` joins the other uncommitted Epic 6 files (`assets/panel.html`, `scripts/*`, `tests/*`) on the `0.3.0` dev line — commit cadence stays with the repo owner.
