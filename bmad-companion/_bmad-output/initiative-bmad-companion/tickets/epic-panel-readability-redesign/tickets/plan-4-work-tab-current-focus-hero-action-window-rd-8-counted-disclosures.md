---
title: 'Story 8.4 — Work tab current-focus hero, Action Window & RD-8 counted disclosures'
type: feature
ticket: 4
container: epic-panel-readability-redesign
created: '2026-11-26'
status: done
baseline_revision: '9a3e18b'
route: oneshot
route_source: pinned
risk: medium
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 8.4 requires the Work tab in `assets/panel.html` to greet users with a plain-language current-focus hero (`turnAnalysis.currentFocus`, captioned `"Current focus"` and never falling back to `aiSummaryHeadline` per `AD-18`), present simplified plain-language next-action cards (`plainTitle`/`plainSummary` without BMAD jargon, with `.is-focal` accent on the first next action per `RD-5` and batch `selectedRecKeys`), open the Work Action Window inside Story 8.3's unified overlay controller on card click (`RD-9`), and collapse `AI notes (N)`, `Models and providers (N)`, and `More actions (3)` by default behind counted disclosures persisted in `expandedDisclosures` (`RD-8`).

**Approach:**
1. **Work Current-Focus Hero (`AD-18`, `RD-9`, `assets/panel.html`):**
   - Added `#currentFocusHero` (`.focus-hero`) at the top of the Work tab with `#currentFocusText` (`.focus-hero-text` at `--overlay-body-size: 15px`) and `#currentFocusBasis` (`.focus-hero-basis` reading `"Current focus"`), styled with Palette C tokens and no competing accent.
   - Implemented `renderCurrentFocusHero(turn)` to render `turnAnalysis.currentFocus.text` and `turnAnalysis.currentFocus.basisLabel` (`"Current focus"`), stamping `data-focus-source` and `data-conversation-count` and falling back to a plain ready-state sentence when `currentFocus` is absent — never falling back to `turnAnalysis.aiSummaryHeadline`.
2. **Simplified Plain-Language Next-Action Cards & Work Action Window (`AD-8`, `AD-10`, `AD-17`, `RD-5`, `RD-9`, `assets/panel.html`):**
   - Updated `#workTabHeading` to `🚀 What to do next` (`RD-3`) and implemented `stripPanelBmadJargon`, `getPlainRecTitle`, and `getPlainRecSummary` so Work recommendation cards render `plainTitle` and `plainSummary` with zero BMAD jargon (`/bmad-*`, phase codes, tracker filenames, override keys).
   - Applied `.rec-card.is-focal` and `.btn-primary` only to the first next-action card (`idx === 0`, `RD-5`), wired batch `selectedRecKeys` selection (`#btnSelectAllRecs` and `#btnQueueSelectedRecs`), and wired `.rec-card` clicks (guarded by `isInteractiveDescendantClick`) to open the Work Action Window inside `#overlayLayer`.
   - Updated the Work Action Window (`renderOverlayContent` for `targetType === "recommendation"`) with associated `<label class="cmd-label" for="overlay-rec-cmd">` and `<label class="label-caps" for="overlay-rec-model">`, `bindSingleListener` event binding, primary `🚀 Launch in New Session` and `➕ Add to Queue` (clearing `pendingWorkspaceState` and jumping to `queue`), `More actions (3)` disclosure (`#overlay-btn-more-actions`), and `#overlay-tech-details` (`Technical details: <skill> · <phase>`).
3. **Counted Disclosures Persisted in `expandedDisclosures` (`RD-8`, `assets/panel.html`):**
   - Placed `AI notes (N)` (`#btnDisclosureAiNotes`, `data-disclosure="ai-notes"`, `N = smartInsights.length`) and `Models and providers (N)` (`#btnDisclosureModelsProviders`, `data-disclosure="models-providers"`, `N = providerState.activeProviders.length`) collapsed by default (`aria-expanded="false"`) at the bottom of Work, alongside `More actions (3)` (`data-disclosure="more-actions"`).
   - Implemented `syncWorkDisclosures(state)` and `toggleDisclosure(key)` so open/closed state persists in `expandedDisclosures` across 5s poll renders with live count updates.
4. **Verification (`tests/panel-guards.test.mjs`, `tests/panel-a11y.test.mjs`):**
   - Updated `AD-4` recommendation label assertions in `tests/panel-a11y.test.mjs` for `#overlay-rec-cmd` / `#overlay-rec-model` and added Story 8.4 suites in both `tests/panel-a11y.test.mjs` and `tests/panel-guards.test.mjs`.

</intent-contract>

## Verification

- `node --test tests/panel-guards.test.mjs tests/panel-a11y.test.mjs` — 67/67 tests passing across 19 suites.
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — 219/219 tests passing across 53 suites; version sync OK (`0.5.4`).
