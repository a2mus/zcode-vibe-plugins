---
title: 'Story 8.2 — 3-tab Work / Queue / Project shell, plain headings & Project consolidation'
type: feature
ticket: '2'
created: '2026-11-26'
status: done
baseline_revision: 'fe214a6ac1ee64872c54f846fc4db68c67a88225'
route: full
route_source: pinned
risk: high
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
context:
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
  - _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Although Story 8.1 Palette C tokens and closed type ramp (`9a3e18b`), Stories 8.3–8.4 unified overlay controller + Work current-focus hero / Action Window / counted disclosures (`06676fe`), and the Queue Plan→Build 2-model split controls (`fe214a6`) already landed, `assets/panel.html` still ships the legacy 5-tab navigation shell (`advisor`, `queue`, `progress`, `catalog`, `artifacts`), feature-oriented jargon headings on Queue and Project, missing `"Use it when…"` tab purpose cues, the retired Skills and Specialist Agents UI lists, collapsible phase accordions whose artifact chips jump away via `switchTab("artifacts")`, and obsolete 5-tab/catalog assertions in `tests/panel-a11y.test.mjs` and `tests/panel-guards.test.mjs`.

**Approach:** Consolidate `assets/panel.html` onto the ratified 3-tab ARIA cockpit (`work`, `queue`, `project`) with plain task headings (`RD-3`) and verbatim `"Use it when…"` tab cues (`RD-4`), remove the Skills and Specialist Agents UI lists (`OQ-9`), flatten the Project phase progress list (`RD-9`) with inline diff inspection inside `project` (`AD-17` §1), move Recently Changed Files + diff/content inspector into `#tab-project`, enforce the Project single-focal-point rule on `#btnReconcileTrackers` when trackers disagree (`RD-5`), preserve Story 8.3's overlay controller, Story 8.4's Work hero / Action Window / disclosures, and Queue's Plan→Build split controls, and update `tests/panel-a11y.test.mjs` and `tests/panel-guards.test.mjs`.

## Boundaries & Constraints

**Always:**
- Use the ratified 3-tab IDs `work`, `queue`, `project` (`#tabBtnWork`/`#tab-work`, `#tabBtnQueue`/`#tab-queue`, `#tabBtnProject`/`#tab-project`) in a single-row `repeat(3, minmax(0, 1fr))` ARIA `tablist` with wrapping `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End` navigation (`EXPERIENCE.md` `AD-2`, `DESIGN.md` Layout & Spacing, `AD-17` §1).
- Apply `RD-3` plain task headings (`🚀 What to do next`, `⛓️ Queued tasks`, `📈 Line up your tickets with the code`, `🏛️ Phases`, `📦 Epics and tickets`, `🕒 Recently changed files`) and `RD-4` `"Use it when…"` copy verbatim from `EXPERIENCE.md` on each tab button's `title`, via `aria-describedby` (`#tabDescWork`, `#tabDescQueue`, `#tabDescProject`), and as a visible `.tab-purpose` subtitle directly under each tab heading.
- Preserve `#workTabHeading`, `#queueTabHeading`, `#projectTabHeading`, all `data-overlay-trigger` hooks (including `phase:<id>`, `epic:<id>`, `story:<key>`, `artifact:<relPath>`, `reconciliation-diff:reconciliation-diff`), Story 8.3's overlay controller (`activeOverlay`, `isOverlayOpen()`, capture-phase `Escape`, focus trap/restore, `switchTab` overlay close), Story 8.4's Work current-focus hero, Action Window, and counted disclosures, `fe214a6`'s Queue Plan→Build split controls (`#queueSplitPlanBuildToggle`, `#queuePlannerModelSelect`, `#queueBuilderModelSelect`), 5s polling/draft guards, `escapeHtml()`, CSP `unsafeEval: false`, and the Story 8.1 closed type ramp (`{16, 15, 14.5, 14, 13.5, 13, 12.5, 12}px`, zero inline `font-size`).
- Keep `skillsCatalog` and `agentsCatalog` completely untouched in backend MCP `bmad_get_state` payloads (`AD-14`).

**Never:**
- Never call `switchTab("artifacts")` or render `#tab-advisor`, `#tab-progress`, `#tab-catalog`, `#tab-artifacts`, `#tabBtnAdvisor`, `#tabBtnProgress`, `#tabBtnCatalog`, `#tabBtnArtifacts`, `#skillsCatalogList`, `#agentsCatalogList`, `#skillSearch`, `#skillPhaseFilter`, `#btnExpandAllPhases`, `#btnCollapseAllPhases`, `.agent-card`, or `.phase-summary-row`.
- Never touch `scripts/*.mjs`, `hooks/*`, `tests/e2e-journeys.test.mjs`, upstream skills (`.agents/skills/`, `.zcode/skills/`, `skills-lock.json`), or the synced plugin version `0.5.4` (bump to `0.6.0` belongs to Story 8.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tab keyboard nav | `ArrowRight`/`ArrowLeft`/`ArrowDown`/`ArrowUp`/`Home`/`End` on `#tabsNav` | Cycles `work` ↔ `queue` ↔ `project` with wrap, `aria-selected`, roving `tabindex` (`0`/`-1`), panel display, and `mainScroll.scrollTop = 0`; closes any open overlay | Ignore if `defaultPrevented` or no tab buttons exist |
| Unknown/legacy tab ID | `switchTab("artifacts")` or unknown string | Normalizes safely to `"work"` so one valid panel stays visible and `activeTabId` stays in `{"work","queue","project"}` | Never leaves all tabpanels hidden |
| Phase file chip diff | Click `[data-art-diff]` inside flat `#phasesList` while on `project` | Active tab remains `"project"`; calls `bmad_inspect_artifact({ relPath })` and shows `#artifactPreviewCard` inline in `#tab-project` (with guarded `scrollIntoView?.`) | Tool error renders `"Failed to load artifact: <message>"` in `#artifactPreviewContent` |
| Empty phase / empty or missed files | `phase.artifacts = []`, `artifacts = []`, or `#artifactSearch` filter miss | Flat phase renders `"No artifacts generated in this phase yet."`; `#artifactsDirectoryList` renders `.empty-state-card`; clicking `#btnClearArtifactSearch` clears search and focuses `#artifactSearch` | Guard `searchEl?.focus?.()` |
| Tracker drift accent (`RD-5`) | `reconciledStoriesCount > 0` or `smartOverallPct !== declaredOverallPct` or `smartDoneStories !== declaredDoneStories` | `#btnReconcileTrackers` carries `btn-primary` only when trackers disagree, and plain `.btn` when synchronized; `#artifactPreviewCard` border and `#previewFileName` remain neutral (`var(--border)` / `var(--text-primary)`) | Missing metrics default to synced (`.btn`, no `btn-primary`) |
| Overlay focus fallback on `project` | Overlay opened on `project` closes with detached `triggerEl` and unmatched `triggerSelector` | Focus restores cleanly to `#projectTabHeading` via `focusActiveTabHeading()` | Falls back to `#tab-project` if heading absent |

</frozen-after-approval>

## Code Map

- `assets/panel.html` (4,556 lines at `fe214a6ac1ee64872c54f846fc4db68c67a88225`) — the only product file:
  - **CSS (`~258–303`, `~599–658`, `~948–962`):**
    - `258–266`: change `.tabs-nav` `grid-template-columns` from `repeat(5, minmax(0, 1fr))` to `repeat(3, minmax(0, 1fr))`.
    - Add `.tab-purpose { font-size: 12.5px; color: var(--text-secondary); margin-top: 2px; }` (inside closed ramp `caption` role, zero inline `font-size`).
    - `599–658`: add `padding: 9px 11px;` to `.phase-card`; delete `.phase-summary-row` (`607–619`), `.phase-summary-row:hover` (`621–623`), `.agent-card` (`625–636`), and `.phase-body` (`647–651`); retain `.phase-top` (`638–645`), `.phase-artifacts` (`653–658`), and `.art-chip-*` (`660–710`).
    - `948–962`: remove `.phase-summary-row,` (`957`) from `@media (prefers-reduced-motion: reduce)`.
  - **HTML (`~1181–1452`):**
    - `1181–1187`: replace the 5 `#tabsNav` buttons with 3 peer tabs:
      - `#tabBtnWork` (`data-tab="work"`, `aria-selected="true"`, `aria-controls="tab-work"`, `aria-describedby="tabDescWork"`, `tabindex="0"`, `title="You want to know what to do next, in plain words, and start it."`, `<span class="tab-label">⚡ Work</span>`)
      - `#tabBtnQueue` (`data-tab="queue"`, `aria-selected="false"`, `aria-controls="tab-queue"`, `aria-describedby="tabDescQueue"`, `tabindex="-1"`, `title="You want to see or change what is lined up to run."`, `<span class="tab-label">⛓️ Queue</span>` + `#queueTabCount` pill)
      - `#tabBtnProject` (`data-tab="project"`, `aria-selected="false"`, `aria-controls="tab-project"`, `aria-describedby="tabDescProject"`, `tabindex="-1"`, `title="You want to see where the work stands and how it is structured."`, `<span class="tab-label">📊 Project</span>`)
    - `1199–1242`: rename `#tab-advisor` → `#tab-work` (`aria-labelledby="tabBtnWork"`), rename `#btnGoToQueueFromAdvisor` → `#btnGoToQueueFromWork` (`1210`), wrap `#workTabHeading` (`🚀 What to do next`) with `<div class="tab-purpose" id="tabDescWork">You want to know what to do next, in plain words, and start it.</div>` directly beneath it; leave Story 8.4's `#currentFocusHero`, `#recommendationsList`, `#btnDisclosureAiNotes`, and `#btnDisclosureModelsProviders` unchanged.
    - `1245–1343`: in `#tab-queue`, replace `#queueTabHeading` text (`1249`) with `⛓️ Queued tasks` and replace the verbose `.text-caption` (`1250–1252`) with `<div class="tab-purpose" id="tabDescQueue">You want to see or change what is lined up to run.</div>`; preserve `#queueDefaultReviewSelect`, `#queueEpicPicker`, `fe214a6`'s Plan→Build split block (`1283–1309`), all 7 execution buttons, `#queueActiveSpotlight`, `#queueListHeaderTitle`, and `#queueItemsList`.
    - `1346–1392`: rename `#tab-progress` → `#tab-project` (`aria-labelledby="tabBtnProject"`), update `#projectTabHeading` (`1349`) to `📈 Line up your tickets with the code` with `<div class="tab-purpose" id="tabDescProject">You want to see where the work stands and how it is structured.</div>` directly beneath it; default `#btnReconcileTrackers` (`1354`) to `class="btn"` (toggling `btn-primary` only on drift per `RD-5`); update Phases heading (`1371`) to `🏛️ Phases` and remove `#btnExpandAllPhases` / `#btnCollapseAllPhases` (`1372–1375`); update Epics heading (`1380`) to `📦 Epics and tickets`.
    - `1394–1417`: remove `#tab-catalog` completely (`#skillSearch`, `#skillPhaseFilter`, `#catalogTabHeading`, `#skillsCatalogList`, `#agentsCatalogList`) per `OQ-9`.
    - `1419–1451`: remove `#tab-artifacts` wrapper and move `#artifactPreviewCard` (remove inline `border-color: var(--accent)` and change `#previewFileName` inline `color: var(--accent)` → `color: var(--text-primary)` per `RD-5`) and the Changed Files `.section-card` (rename heading to `🕒 Recently changed files`, drop `id="artifactsTabHeading"`) into `#tab-project` directly after `#epicsList`.
  - **JS (`~1476–1498`, `~1925–1927`, `~2104–2209`, `~2986`, `~3504–3618`, `~3798–3997`, `~4182–4215`, `~4297–4299`, `~4431–4442`, `~4544`):**
    - `1476–1498`: drop `expandedPhases` (`1476`), `initialPhasesExpanded` (`1477`), and `skillsCatalog`/`agentsCatalog` in `lastSectionSignatures` (`1494–1495`); initialize `activeTabId = "work"` (`1487`).
    - `1925–1927`: remove `getSkillOverrideKey` (keep `dynamicFitModel` at `1824` — still used by Work Action Window at `2346`).
    - `2104–2111, 2165`: remove `initialPhasesExpanded` auto-expand block and `renderSkillsCatalog();` call in `renderWorkspaceState`.
    - `2193–2209`: narrow `getActiveTabHeading()` `headingIdMap` to `{ work: "workTabHeading", queue: "queueTabHeading", project: "projectTabHeading" }`.
    - `2986`: update empty-queue card copy from `<b>⚡ Next Prompts</b> / <b>📊 Phases & Epics</b>` to `<b>⚡ Work</b> / <b>📊 Project</b>` (`EXPERIENCE.md` State Patterns).
    - `3504–3618`: flatten `renderPhases(phases, force = false)` — remove `expanded` from `phaseSig`; toggle `#btnReconcileTrackers` `btn-primary` on tracker drift (`(m.reconciledStoriesCount || 0) > 0 || (m.smartOverallPct || 0) !== (m.declaredOverallPct || 0) || (m.smartDoneStories || 0) !== (m.declaredDoneStories || 0)`); render each flat `.phase-card` with `data-overlay-trigger="phase:${escapeHtml(p.id)}"`, `.phase-top` (phase name without chevron, `N files` pill, `pct% · status` pill), `.dual-bar`, `.text-caption` summary, and inline `.phase-artifacts` chips (or `"No artifacts generated in this phase yet."`); remove `[data-phase-toggle]` listeners; change `[data-art-diff]` click handler to call `loadArtifactPreview(rel, "diff")` inline inside `project` (plus guarded `document.getElementById("artifactPreviewCard")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })`) with no `switchTab("artifacts")`.
    - `3798–3997`: remove `renderSkillsCatalog`.
    - `4182–4215`: simplify `switchTab(tabId, focusBtn = false)` to canonical `["work", "queue", "project"]` (normalizing any unknown/legacy tab ID to `"work"`), closing any open overlay, syncing `.active`/`aria-selected`/roving `tabindex`/`display` on the 3 panels, and resetting `mainScroll.scrollTop = 0`.
    - `4297–4299`: wire `#btnGoToQueueFromWork` instead of `#btnGoToQueueFromAdvisor`.
    - `4431–4442`: remove `#skillSearch`, `#skillPhaseFilter`, `#btnExpandAllPhases`, and `#btnCollapseAllPhases` event listeners.
    - `4544`: remove `renderSkillsCatalog` from `window.__bmadTestHooks`.
- `tests/panel-a11y.test.mjs` (1,323 lines):
  - `218–224`: update `tabBtns` in `createStubbedA11yEnvironment` to `[tabBtnWork, tabBtnQueue, tabBtnProject]`.
  - `382–490`: update `AD-2` tab/tabpanel assertions, `switchTab` test, and 3-tab wrapping `ArrowRight`/`ArrowLeft`/`ArrowDown`/`ArrowUp`/`Home`/`End` keyboard navigation test (including `aria-describedby` → `#tabDescWork`/`#tabDescQueue`/`#tabDescProject`).
  - `584–612`: remove obsolete `AD-4` catalog skill `cat-cmd-${idx}` test and `#skillSearch`/`#skillPhaseFilter` checks (retaining Queue Plan→Build labels, Action Window labels, queue-item labels, `#storySearch`, `#storyStatusFilter`, `#artifactSearch`).
  - `789–1026`: update `LD-1` grid assertion to `repeat(3, minmax(0, 1fr))` and UX Sync tests to remove `.agent-card`, `phase-summary-row`, `skillPhaseFilter`, `skillSearch`, `skillsCatalogList`, `agentsCatalogList`, and `btnClearSkillFilters`, while asserting flat `.phase-card` + inline `.art-chip-main`/`.art-chip-open`, Epic `<button aria-expanded>`, empty `#artifactsDirectoryList`, `#btnCloseArtifactPreview`, `#btnClearStoryFilters`, and `#btnClearArtifactSearch`.
  - `1166, 1276`: remove obsolete `env.elements.get("skillPhaseFilter").value = "all";` lines in Story 8.4 tests.
  - Append a `Story 8.2` suite asserting `RD-3` plain headings + updated empty-queue copy, `RD-4` verbatim `"Use it when…"` tab tooltips/descriptions/subtitles, `OQ-9` absence of Skills/Agents UI & `switchTab("artifacts")`, `RD-9` Project consolidation (Changed Files + inspector inside `#tab-project`, flat phases), and `RD-5` Project Reconcile focal accent + neutral `#artifactPreviewCard`/`#previewFileName`.
- `tests/panel-guards.test.mjs` (2,437 lines):
  - `122–221`: allow stubbed container `innerHTML` parsing to register `[data-art-diff]` buttons for `querySelectorAll("[data-art-diff]")` so phase-chip inline diff clicks run end-to-end against the panel script.
  - `1119–1195`: remove `skillsCatalog` and `skillsCatalogList` from the section-signature diffing test.
  - Append `Story 8.2` integration tests verifying default `work` tab + `#btnGoToQueueFromWork` + unknown-tab fallback, inline phase-chip `[data-art-diff]` diff inspection staying on `project` (success + `"Failed to load artifact: ..."` error), and Story 8.3 overlay close fallback focusing `#projectTabHeading` on `project`.
- Do not touch: `scripts/*.mjs`, `hooks/*`, `tests/e2e-journeys.test.mjs`, `.zcode-plugin/plugin.json`, `../marketplace.json`, or version `0.5.4`.

## Tasks & Acceptance

**Execution (ordered by dependency):**
- [x] `assets/panel.html` (CSS & HTML shell) -- Switch `.tabs-nav` to `repeat(3, minmax(0, 1fr))`, add `.tab-purpose` (`12.5px`), pad flat `.phase-card`, drop `.agent-card`/`.phase-summary-row`/`.phase-body` (and `.phase-summary-row` in `prefers-reduced-motion`), replace the 5 tabs with `#tabBtnWork`/`#tabBtnQueue`/`#tabBtnProject` (`RD-4` `title` + `aria-describedby`), rename `#tab-advisor`→`#tab-work` and `#tab-progress`→`#tab-project`, rename `#btnGoToQueueFromAdvisor`→`#btnGoToQueueFromWork`, apply `RD-3` plain headings + `.tab-purpose` subtitles, drop `#btnExpandAllPhases`/`#btnCollapseAllPhases`/`#tab-catalog`/`#tab-artifacts`, and move `#artifactPreviewCard` (neutral border & `#previewFileName` color) + Changed Files card into `#tab-project` while preserving Story 8.3/8.4 and Queue Plan→Build markup.
- [x] `assets/panel.html` (JS behavior & cleanup) -- Set `activeTabId = "work"`, narrow `switchTab` and `getActiveTabHeading` to `work`/`queue`/`project` (normalizing unknown tab IDs to `"work"`), flatten `renderPhases` with inline `[data-art-diff]` loading in `project` (never calling `switchTab("artifacts")`), toggle `#btnReconcileTrackers` `btn-primary` on tracker drift (`RD-5`), update empty-queue copy (`Work` / `Project`), wire `#btnGoToQueueFromWork`, and remove `expandedPhases`, `initialPhasesExpanded`, `getSkillOverrideKey`, `renderSkillsCatalog`, `skillsCatalog`/`agentsCatalog` signature keys, catalog/phase-expand listeners, and `__bmadTestHooks.renderSkillsCatalog`.
- [x] `tests/panel-a11y.test.mjs` -- Update `createStubbedA11yEnvironment`, `AD-2`, `AD-4`, `LD-1`, UX Sync, and Story 8.4 test setup for the 3-tab shell and removed catalog/phase-accordion controls, and add `Story 8.2` assertions for `RD-3`, `RD-4`, `OQ-9`, `RD-9`, and `RD-5` Project focal accent.
- [x] `tests/panel-guards.test.mjs` -- Remove `skillsCatalog`/`skillsCatalogList` from the section-signature test, extend stubbed `[data-art-diff]` lookup, and add `Story 8.2` runtime tests for inline phase-chip diff inspection on `project` (success + error), default `work` / unknown-tab fallback / `#btnGoToQueueFromWork`, and Story 8.3 overlay focus restoration to `#projectTabHeading`.

**Acceptance Criteria:**
- Given the rendered panel cockpit, when inspecting the tab strip and tab panels, then exactly 3 tabs (`Work`, `Queue`, `Project`) appear in a single 3-column ARIA `tablist` with wrapping `ArrowRight`/`ArrowLeft`/`ArrowDown`/`ArrowUp`/`Home`/`End` keyboard navigation, verbatim `"Use it when…"` tooltips, accessible descriptions, and visible subtitles under each heading, `RD-3` plain task headings across all 3 tabs, and zero Skills/Agents UI elements or legacy `catalog`/`artifacts` tabs.
- Given a workspace with phases, stories, and recently changed files on the `Project` tab, when viewing phases and clicking a phase artifact chip to inspect its diff, then phases render as a flat list with inline chips (no expand/collapse accordions), the active tab remains `project`, the inline diff/content inspector opens inside `Project` (or shows `"Failed to load artifact: ..."` on error), `#btnReconcileTrackers` uses primary accent styling only when trackers disagree with smart status, and closing an overlay with no resolvable trigger restores focus to the `Project` tab heading.
- Given the existing Work current-focus hero, Work Action Window, counted disclosures, Queue Plan→Build 2-model split controls, and 5s polling/draft guards, when running `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs`, then every test suite passes with zero inline `font-size`, the Story 8.1 closed type ramp and Palette C WCAG AA contrast intact, `skillsCatalog`/`agentsCatalog` still present in backend MCP payloads, and plugin version `0.5.4` tri-synced.

## Implementation Notes

- Implemented the 3-tab Work / Queue / Project cockpit shell, RD-3 plain headings, RD-4 `"Use it when…"` tab tooltips/accessible descriptions/subtitles, OQ-9 Skills & Agents UI removal, RD-9 flat phases and inline Changed Files + diff inspector consolidation in `#tab-project`, and RD-5 Project `#btnReconcileTrackers` drift-only accent in `assets/panel.html`.
- Updated `tests/panel-a11y.test.mjs` and `tests/panel-guards.test.mjs` for 3-tab ARIA, removed catalog/phase-accordion controls, inline phase diff inspection, unknown-tab fallback, and overlay focus restoration to `#projectTabHeading`.
- Verified with `node --test tests/panel-a11y.test.mjs tests/panel-guards.test.mjs` (77/77 pass), `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` (233/233 pass; 0.5.4 tri-sync OK), and `node ../scripts/validate.mjs` (`bmad-companion v0.5.4 validated`).

## Plan Change Log

- 2026-11-26: Refreshed draft plan from baseline `06676fe` to `fe214a6ac1ee64872c54f846fc4db68c67a88225` (re-verified all line numbers after Queue Plan→Build 2-model split landed, added empty-queue copy alignment `Work`/`Project`, unknown-tab fallback, explicit `fe214a6` control preservation, and runtime `[data-art-diff]` inline diff + error guard test) and promoted to `ready-for-dev`.

## Review Triage Log

## Design Notes

- Binding each tab's `aria-describedby` to its visible `.tab-purpose` subtitle (`#tabDescWork`, `#tabDescQueue`, `#tabDescProject`) and setting `title` to the exact same `"Use it when…"` string satisfies `RD-4` without duplicate hidden DOM nodes (per W3C AccName, `aria-describedby` computes accessible descriptions even from inactive `display: none` tabpanels).
- Giving `#btnReconcileTrackers` `btn-primary` only when trackers disagree (`reconciledStoriesCount > 0` or smart vs declared mismatch) and neutralizing `#artifactPreviewCard` border + `#previewFileName` color satisfies `RD-5` ("one focal point per tab") on `Project`.
- Keeping `dynamicFitModel()` while deleting `getSkillOverrideKey()` and `renderSkillsCatalog()` preserves Story 8.4's Work Action Window fallback model resolution (`assets/panel.html:2346`).

## Verification

**Commands:**
- `node --test tests/panel-a11y.test.mjs tests/panel-guards.test.mjs` -- expected: 3-tab ARIA, `RD-3`/`RD-4`/`RD-5`/`RD-9`/`OQ-9`, overlay integration, and polling/draft guard suites pass.
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` -- expected: full suite and `0.5.4` version tri-sync pass.
