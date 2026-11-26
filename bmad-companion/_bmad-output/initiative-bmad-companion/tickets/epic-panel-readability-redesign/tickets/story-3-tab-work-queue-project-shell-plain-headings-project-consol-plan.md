---
title: 'Story 8.2 — 3-tab Work / Queue / Project shell, plain headings & Project consolidation'
type: feature
ticket: '2'
created: '2026-11-26'
status: draft
baseline_revision: '06676fed3c72534ae20c0255bc67a85cc8429fa4'
route: full
route_source: auto
risk: high
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
  - _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Although Palette C tokens (8.1) and the unified overlay + Work hero (8.3–8.4) already landed, `assets/panel.html` still ships 5 tabs, jargon-heavy Queue/Project headings, missing `"Use it when…"` tab cues, Skills/Agents UI lists, collapsible phase accordions jumping to an `artifacts` tab, and obsolete 5-tab/catalog test checks.

**Approach:** Consolidate `assets/panel.html` onto the 3-tab ARIA cockpit (`work`, `queue`, `project`) with plain headings (`RD-3`) and `"Use it when…"` cues (`RD-4`), remove Skills/Agents UI (`OQ-9`), flatten phases (`RD-9`) with inline diff inspection inside `project` (`AD-17` §1), move Changed Files + inspector into `project`, focus Project's accent on Reconcile when trackers disagree (`RD-5`), and update `tests/panel-a11y.test.mjs` and `tests/panel-guards.test.mjs`.

## Boundaries & Constraints

**Always:**
- Ratified tab IDs `work`, `queue`, `project` (`#tabBtnWork`/`#tab-work`, `#tabBtnQueue`/`#tab-queue`, `#tabBtnProject`/`#tab-project`) in a `repeat(3, minmax(0, 1fr))` ARIA `tablist` with wrapping arrow/`Home`/`End` keys (`EXPERIENCE AD-2`, `AD-17` §1).
- `RD-3` plain headings and `RD-4` `"Use it when…"` copy verbatim from `EXPERIENCE.md` on tab `title`, `aria-describedby`, and `.tab-purpose` under each tab heading.
- Preserve `#workTabHeading`, `#queueTabHeading`, `#projectTabHeading`, `data-overlay-trigger` hooks, Stories 8.3/8.4 overlay and Work-hero features, 5s polling/draft guards, `escapeHtml()`, `unsafeEval: false`, and zero inline `font-size`.
- Keep `skillsCatalog`/`agentsCatalog` untouched in backend MCP payloads (`AD-14`).

**Never:**
- Never call `switchTab("artifacts")` or render `#tab-catalog`, `#tab-artifacts`, `#skillsCatalogList`, or `#agentsCatalogList`.
- Never touch `scripts/*.mjs`, `hooks/*`, upstream skills, or version `0.5.4`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tab keys | `ArrowRight`/`ArrowLeft`/`Home`/`End` | Cycles `work` ↔ `queue` ↔ `project` with wrap & roving `tabindex` | Skip missing tab |
| Phase chip diff | Click `[data-art-diff]` in phase card | Stays on `project`; `#artifactPreviewCard` loads diff inline | `"Failed to load artifact: ..."` |
| Empty/miss files | `artifacts=[]` or search miss | `.empty-state-card` in `project`; `✕ Clear Search` focuses `#artifactSearch` | Guard `focus?.()` |
| Tracker drift (`RD-5`) | `reconciledStoriesCount > 0` or pct gap | `#btnReconcileTrackers` uses `btn-primary` only on drift; `.btn` when synced | Default `.btn` |

</frozen-after-approval>

## Code Map

- `assets/panel.html`:
  - CSS (`~258–303`, `~599–658`, `~948–962`): `.tabs-nav` `repeat(3, minmax(0, 1fr))`; drop `.agent-card`, `.phase-summary-row`, `.phase-body`, and `.phase-summary-row` in `prefers-reduced-motion`; add `.tab-purpose` (`12.5px` caption); pad flat `.phase-card` (`9px 11px`).
  - HTML (`~1181–1424`): replace 5 `#tabsNav` buttons with `#tabBtnWork`, `#tabBtnQueue`, `#tabBtnProject` (`RD-4` `title` + `aria-describedby` → `#tabDescWork`, `#tabDescQueue`, `#tabDescProject`); rename `#tab-advisor` → `#tab-work`, `#tab-progress` → `#tab-project`, `#btnGoToQueueFromAdvisor` → `#btnGoToQueueFromWork`; add `.tab-purpose` + `RD-3` headings (`🚀 What to do next`, `⛓️ Queued tasks`, `📈 Line up your tickets with the code`, `🏛️ Phases`, `📦 Epics and tickets`, `🕒 Recently changed files`); drop `#btnExpandAllPhases`, `#btnCollapseAllPhases`, `#tab-catalog`, `#tab-artifacts`; move `#artifactPreviewCard` + `#artifactsDirectoryList` card into `#tab-project` (neutral border `var(--border)` and title `var(--text-primary)`).
  - JS (`~1448–1470`, `~2066–2179`, `~2830–2832`, `~3407–3516`, `~3696–3895`, `~4080–4113`, `~4296–4414`): `activeTabId = "work"`; drop `expandedPhases`, `initialPhasesExpanded`, `skillsCatalog`/`agentsCatalog` signatures, `getSkillOverrideKey`, `renderSkillsCatalog`, catalog/phase-expand listeners, and `__bmadTestHooks.renderSkillsCatalog`; flatten `renderPhases` with inline `[data-art-diff]` diff loading in `project`; toggle `#btnReconcileTrackers` `btn-primary` per `RD-5`; limit `switchTab` & `getActiveTabHeading` to `work`/`queue`/`project`.
- `tests/panel-a11y.test.mjs`: update stub (`tabBtnWork`/`Queue`/`Project`), `AD-2`, `AD-4`, `LD-1` (`repeat(3, ...)`), and UX Sync; add `RD-3`, `RD-4`, `OQ-9`, `RD-9` flat phases, and inline chip-diff checks.
- `tests/panel-guards.test.mjs`: drop `skillsCatalog`/`skillsCatalogList` from signature test (`~1119–1190`); check `projectTabHeading` overlay fallback.
- Do not touch: `tests/e2e-journeys.test.mjs`, `scripts/*.mjs`, `hooks/*`, or version `0.5.4`.

## Tasks & Acceptance

**Execution:**
- [ ] `assets/panel.html` -- Convert tablist CSS/HTML to 3 tabs (`work`, `queue`, `project`) with `RD-3` headings, `RD-4` cues, and remove catalog/artifacts sections -- delivers 3-tab shell (`RD-9`, `OQ-9`).
- [ ] `assets/panel.html` -- Move Changed Files + inspector into `#tab-project`, flatten `#phasesList` (`RD-9`) with inline diff inspection (`AD-17` §1), apply `RD-5` Reconcile accent, and strip dead catalog/accordion JS -- preserves Stories 8.3/8.4.
- [ ] `tests/panel-a11y.test.mjs` -- Update `AD-2`/`AD-4`/`LD-1`/UX Sync for 3 tabs and add `RD-3`/`RD-4`/`OQ-9`/`RD-9` coverage -- restores ARIA checks.
- [ ] `tests/panel-guards.test.mjs` -- Drop `skillsCatalog` from signature test and verify `projectTabHeading` fallback -- keeps guard coverage green.

**Acceptance Criteria:**
- Given the rendered panel, when inspecting tabs and headings, then 3 tabs (`work`, `queue`, `project`) form a single-row ARIA `tablist` with wrapping keyboard nav, `"Use it when…"` cues, `RD-3` headings, and zero Skills/Agents UI elements.
- Given phases and changed files, when clicking a phase file chip in `project`, then the active tab stays `project` and the inline inspector loads the diff while phases stay flat without accordions.
- Given `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs`, when executed, then all tests pass with zero inline `font-size`, closed ramp intact, and version `0.5.4` synced.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- Binding `aria-describedby` to each tab's visible `.tab-purpose` subtitle (`#tabDescWork`, `#tabDescQueue`, `#tabDescProject`) and setting `title` to the same `"Use it when…"` text avoids duplicate hidden nodes.
- Giving `#btnReconcileTrackers` `btn-primary` only on drift and keeping `#artifactPreviewCard` neutral enforces `RD-5` on `project`.

## Verification

**Commands:**
- `node --test tests/panel-a11y.test.mjs tests/panel-guards.test.mjs` -- expected: 3-tab ARIA, `RD-3`/`RD-4`/`RD-9`/`OQ-9`, and guard suites pass.
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` -- expected: full suite and `0.5.4` version sync pass.
