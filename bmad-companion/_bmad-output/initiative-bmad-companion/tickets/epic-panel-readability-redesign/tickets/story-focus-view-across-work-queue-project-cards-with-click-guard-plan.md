---
title: 'Story 8.5 — Focus View across Work, Queue & Project cards with click guard & live sync'
type: feature
ticket: '5'
created: '2026-11-26'
status: done
baseline_revision: 'fe214a6ac1ee64872c54f846fc4db68c67a88225'
route: full
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
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stories 8.2–8.4 delivered the 3-tab Work/Queue/Project shell, the unified in-iframe modal overlay controller (`AD-17`), `data-overlay-trigger` markers across cards/sections, and the Work Action Window (`recommendation`), but clicking cards/rows/sections on Queue (`queue-item`, `active-spotlight`), Work (`insights`), and Project (`epic`, `story`, `phase`, `artifact`, `reconciliation-diff`) does not yet open Focus View (`RD-7`), six target types still fall through to a generic one-line fallback in `renderOverlayContent`, Queue Focus View renders the task prompt read-only instead of editable via `update-item`, and `runReconciliation` does not retain its result for `reconciliation-diff` Focus View.

**Approach:** Wire unified click listeners (enforcing the `AD-17` §3 interactive-descendant click guard and nested-card stop-propagation) plus native `⤢` Expand buttons across all 8 Focus View targets (`queue-item`, `active-spotlight`, `insights`, `epic`, `story`, `phase`, `artifact`, `reconciliation-diff`) in `assets/panel.html`, build dedicated overlay-ramp (`16 / 15 / 14.5 / 13.5px`) templates with `overlay-*` non-duplicating DOM IDs and live model/review/prompt sync backed by `AD-10` explicit-action reconciliation (`pendingWorkspaceState = null` + `reconcileActiveOverlay`), and prove every target type, click guard, and live-sync round-trip in `tests/panel-guards.test.mjs`.

## Boundaries & Constraints

**Always:**
- Use the canonical `AD-17` §4 `targetType` / `targetKey` mappings: `queue-item` → `item.id`, `active-spotlight` → `taskQueue.activeTask.id`, `insights` → `"insights"`, `epic` → `String(epic.id)`, `story` → `story.overrideKey || String(story.id)`, `phase` → `phase.id`, `artifact` → `artifact.relPath`, `reconciliation-diff` → `"reconciliation-diff"` (preserving `recommendation` → `rec:<skill>:<title>`).
- Render all Focus View content inside `#overlayLayer` (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="overlayTitle"`) using `overlay-*` non-duplicating DOM IDs, overlay type classes (`--overlay-title-size`, `--overlay-body-size`, `--overlay-command-size`, `--overlay-meta-size`), Palette C CSS variables, zero inline `font-size`, and `escapeHtml()` on every dynamic string (`AD-9`, `RD-1`, `RD-6`).
- Enforce `isInteractiveDescendantClick` (`button, a, input, select, textarea, label, [role="tab"], .status-pill, .pill`) on every clickable card/row/section so child controls keep their normal click, and stop propagation on nested `.story-row` clicks inside `.epic-box` so clicking a story never triggers the parent epic overlay.
- Clear `pendingWorkspaceState = null` before every explicit mutating action inside Focus View so `renderWorkspaceState` updates the underlying tab and calls `reconcileActiveOverlay(freshState)` in place (or closes cleanly with toast `"That item is no longer available"` and tab-heading focus fallback when the target vanishes; suppress that toast on intentional in-overlay removal or completing an `active-spotlight` task).
- Preserve `class="phase-card"`, `#reconciliationDiffCard`, `#artifactPreviewCard`, Story 8.1 closed type ramp + Palette C contrast, Story 8.2 3-tab ARIA shell, Story 8.3 polling/Escape/focus-trap guards, Story 8.4 Work hero/Action Window/disclosures, and Queue Plan→Build 2-model split controls.

**Never:**
- Never clone or duplicate background DOM IDs (`#q-model-*`, `#q-review-*`, `#artifactPreviewContent`, `#diffCardContent`) inside `#overlayBody`, or stack a second overlay on top of `#overlayLayer`.
- Never modify `scripts/*.mjs`, `hooks/*`, `.zcode-plugin/plugin.json`, `../marketplace.json`, `tests/e2e-journeys.test.mjs`, upstream skills, or the synced version `0.5.4` (backend `bmad_queue_manage` `update-item` already supports `model`, `reviewMode`, and `prompt` at `scripts/bmad-engine.mjs:4727-4729`).
- Never introduce inline `font-size`, `.style.fontSize`, external assets, `eval()`, or `window.zcode`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Card click vs interactive child | Click card body vs click child `<button>`, `<select>`, `<input>`, `<label>`, `<a>`, `.pill`, `.status-pill` on any of the 8 targets | Card click opens `#overlayLayer` with `kind: "focus"` and canonical `targetType`/`targetKey`; interactive child click runs its native action and leaves `isOverlayOpen() === false` | Escape special chars in `triggerSelector` attribute matching so `querySelector` never throws |
| Nested card click (`story` inside `epic`) | Click `.story-row` body (non-interactive area) inside expanded `.epic-box` | Opens `story` Focus View (`story:<overrideKey || id>`) and stops propagation so parent `epic` overlay does not supersede it | Missing story/epic closes overlay gracefully on reconcile |
| Explicit `⤢` Expand button | Click native `[data-focus-expand]` button on any of the 8 targets (including `artifact` rows where `.art-row-btn` covers row text) | Stops propagation and opens Focus View with `triggerEl` set to the clicked button; closing restores focus to that button (or `triggerSelector` → active tab heading) | Falls back to `focusActiveTabHeading()` if trigger disconnected |
| Queue live model/review/prompt edit | Edit `#overlay-q-model`, `#overlay-q-review`, or `#overlay-q-prompt` + `#overlay-q-save-prompt` in `queue-item` or `active-spotlight` Focus View | Clears `pendingWorkspaceState`, dispatches `bmad_queue_manage({ action: "update-item", taskId, ... })`, updates underlying Queue card, reconciles overlay in place, and preserves unsaved prompt draft in `userEditedPrompts` (`queue:<id>`) across polls and close/reopen | Empty prompt on Save shows warning toast and skips RPC; RPC failure surfaces error toast without losing draft |
| Story Focus View live model/prompt edit | Edit `#overlay-story-cmd` or `#overlay-story-model` in `story` Focus View, then close or click `#overlay-story-queue` | Draft persists in `userEditedPrompts`/`userSelectedModels` (`story:<key>`); closing or queuing syncs the updated model pill and prompt onto the underlying Project `.story-row` and survives polls | Reconciles queue status pill in place after `Queue Story` |
| Artifact Focus View async load & toggle | Open `artifact` Focus View (cold or cached `loadedArtifactData`); toggle Diff/Content; click Open/Review | Shows cached diff/content immediately or loads via `bmad_inspect_artifact`, updates `#overlay-art-preview` and underlying `#artifactPreviewCard` mode (`aria-pressed`), and keeps focus intact | Tool error renders `"Failed to load artifact: <message>"` in `#overlay-art-preview` |
| Reconciliation Diff Focus View | Run Dry Run or Live Reconcile (`runReconciliation`), then open `reconciliation-diff` Focus View; trigger Preview/Apply inside overlay | Persists `lastReconciliationDiff` and renders every `file`/`key`/`oldStatus → newStatus`/`reason` entry at overlay sizes; in-overlay Preview/Apply clears stash and reconciles overlay live | `#btnCloseDiff` clears `lastReconciliationDiff`; `state.reconciliationDiff === null` closes overlay with missing-item toast |
| Active Spotlight completed in Focus View | Click `#overlay-q-done` while `active-spotlight` Focus View is open | Dispatches `complete-task` (`in-progress` for `plan`, `done` otherwise), closes overlay when `activeTask` clears without overwriting completion toast with `"That item is no longer available"`, and focuses `#queueTabHeading` | Reset suppression flag if `manageQueue` returns null |

</intent-contract>

## Code Map

- `assets/panel.html` (4,235 lines in working tree over `fe214a6ac1ee64872c54f846fc4db68c67a88225`) — the sole product file:
  - **CSS (`~918-931`, `~1059-1116`):** Add hover/cursor rules for focusable `[data-overlay-trigger]` surfaces, `.focus-expand-btn` (compact button riding `.btn` at `12.5px`), and overlay list/row helpers (`.overlay-list`, `.overlay-item-row`, `.overlay-actions-row`) using only Palette C tokens and `--overlay-*-size` variables (zero inline `font-size`, zero new off-ramp sizes). Add any transitioned selector to `@media (prefers-reduced-motion: reduce)` (`918-931`).
  - **HTML (`~1188-1192`, `~1332-1338`, `~1366-1372`):** Add `tabindex="-1"` to `#insightsCard` (`1188`) and `#reconciliationDiffCard` (`1332`); add native `⤢` Expand buttons (`[data-focus-expand="insights:insights"]`, `[data-focus-expand="reconciliation-diff:reconciliation-diff"]`, and `#btnExpandArtifactPreview` in `#artifactPreviewCard` header).
  - **State & Edit Helpers (`~1411-1436`, `~1820-1837`):** Add `let lastReconciliationDiff = null;`. Guard `wireUserEditTracking` (`1820-1837`) with `cmdId ? document.getElementById(cmdId) : null` and `selectId ? document.getElementById(selectId) : null` so single-field callers (like Queue prompt) never look up `null`.
  - **Focus Trigger Binder & Selector Safety (`~2095-2114`, `~2487-2570`):** Add `escapeAttrValue(val)` for safe `[data-overlay-trigger="..."]` selector quoting, and reusable `bindFocusTriggers(rootEl)` that binds guarded `click` listeners on `[data-overlay-trigger]` (skipping `recommendation:*`, ignoring `isInteractiveDescendantClick` and nested `[data-overlay-trigger]` descendants, stopping propagation) and `click` listeners on `[data-focus-expand]` buttons. In `closeOverlay` (`2545-2568`), also call `renderEpics()` when `currentState && !pendingWorkspaceState` so Story Focus View edits immediately repaint underlying Project rows, and fall back `triggerSelector` cleanly when restoring focus.
  - **Target Resolution & Dedicated Overlay Templates (`~2188-2485`):**
    - Update `resolveOverlayTarget` (`2227-2234`) so `reconciliation-diff` reads `state.reconciliationDiff ?? lastReconciliationDiff` (still returning `null` when `state.reconciliationDiff === null`) and `insights` returns `{ insights, turnAnalysis }` (returning `null` when `state.smartInsights === null`).
    - Upgrade `queue-item` / `active-spotlight` (`2374-2473`) to replace the read-only `#overlay-q-prompt` `<div>` with an associated `<label class="cmd-label" for="overlay-q-prompt">` + editable `<textarea class="cmd-textarea" id="overlay-q-prompt">` tracked in `userEditedPrompts` (`queue:<id>`), optional read-only `#overlay-q-effective-prompt` when gate-shaped text differs, `#overlay-q-save-prompt` (`💾 Save Prompt` → `manageQueue({ action: "update-item", taskId, prompt })`), unsaved-prompt commit on `#overlay-q-launch`, and `suppressNextOverlayMissingToast` on `active-spotlight` `#overlay-q-done`.
    - Add dedicated templates in `renderOverlayContent` (replacing the generic fallback at `2475-2484`) for `insights`, `phase`, `epic`, `story` (with editable `#overlay-story-cmd` + `#overlay-story-model` synced via `userEditedPrompts`/`userSelectedModels` key `story:<key>`, `#overlay-story-queue`, `#overlay-story-launch`), `artifact` (async `bmad_inspect_artifact` / cached `loadedArtifactData`, Diff/Content `aria-pressed` toggles, Open File, Review), and `reconciliation-diff` (diff list + Preview/Reconcile actions).
  - **Tab Renderers & Live Sync (`~2863-3067`, `~3461-3798`, `~3800-3880`, `~4114-4140`, `~4170-4229`):**
    - Add `tabindex="-1"` and compact `⤢` `[data-focus-expand]` buttons to `.queue-active-spotlight` (`2874`), `.queue-item-card` (`2925`), `.phase-card` (`3482` — keeping exact `class="phase-card"`), `.story-row` (`3575`), `.epic-box` (`3609`), and artifact `.insight-item` (`3737`).
    - Call `bindFocusTriggers` on `#insightsCard`, `#reconciliationDiffCard`, `#queueActiveSpotlight`, `#queueItemsList`, `#phasesList`, `#epicsList`, and `#artifactsDirectoryList`.
    - In `renderEpics` (`3521-3697`): resolve per-story drafts (`story:<key>`) via `resolveUserPrompt`/`resolveUserModel`, include story draft digest in `epicSig`, and display updated model pill + queue/launch payload on the underlying story row.
    - In `loadArtifactPreview` (`3800-3835`) & `renderArtifactInspectorCard` (`3775-3798`): sync loaded content/diff/error into `#overlay-art-preview` when `activeOverlay?.targetType === "artifact"` matches `relPath`.
    - In `runReconciliation` (`3837-3880`) & `#btnCloseDiff` (`4116-4118`): persist/clear `lastReconciliationDiff` and reconcile `reconciliation-diff` overlay if open.
    - Expose `resolveOverlayTarget` and `getLastReconciliationDiff` on `window.__bmadTestHooks` (`4170-4228`).
- `tests/panel-guards.test.mjs` (2,604 lines) — primary verification file:
  - Enhance `createStubbedDomEnvironment` (`28-250`, `321-460`) so `innerHTML` registers `[data-overlay-trigger]`, `[data-focus-expand]`, `[data-overlay-art-focus]`, `[data-overlay-art-open]`, and `[data-overlay-story-key]` for container `querySelectorAll`, reuses existing `id`-keyed elements instead of duplicating them, supports comma-separated selector matching + `parentElement` traversal in `closest()`, and mocks `bmad_reconcile_trackers` + `bmad_open_artifact_file`.
  - Add a `Story 8.5` suite testing all 8 canonical Focus View target types, overlay type classes, interactive-descendant + nested-card click guarding, `⤢` Expand buttons + focus restore, Queue model/review/prompt live sync + poll safety, Story prompt/model draft sync back to `.story-row`, Artifact async load/error/toggle sync, and Reconciliation Diff persistence/apply sync.
- `tests/panel-a11y.test.mjs` (1,453 lines) — regression gate (do not relax any existing Palette C, closed-ramp, zero inline `font-size`, 3-tab ARIA, or Story 8.2/8.4 assertion).
- Do not touch: `scripts/*.mjs`, `hooks/*`, `.zcode-plugin/plugin.json`, `../marketplace.json`, `tests/e2e-journeys.test.mjs`.

## Tasks & Acceptance

**Execution (ordered by dependency):**
- [x] `assets/panel.html` (CSS, HTML triggers & `bindFocusTriggers` foundation) -- Add Palette C hover/focus-expand/overlay-list CSS (inside closed ramp + `prefers-reduced-motion`), add `tabindex="-1"` and `⤢` `[data-focus-expand]` controls to static/rendered containers (`#insightsCard`, `#reconciliationDiffCard`, `#artifactPreviewCard`, `.queue-active-spotlight`, `.queue-item-card`, `.phase-card`, `.epic-box`, `.story-row`, artifact `.insight-item`) while preserving `class="phase-card"` and existing IDs, guard `wireUserEditTracking` against null IDs, add `escapeAttrValue` and `bindFocusTriggers` (enforcing `isInteractiveDescendantClick` and nested-trigger guard), and bind static containers (`#insightsCard`, `#reconciliationDiffCard`, `#btnExpandArtifactPreview`) -- establishes click & keyboard-button entry into Focus View across all three tabs without breaking interactive child clicks.
- [x] `assets/panel.html` (Dedicated Focus View templates & live sync) -- Track `lastReconciliationDiff`, update `resolveOverlayTarget` (`insights`, `reconciliation-diff`), upgrade `queue-item`/`active-spotlight` with editable `#overlay-q-prompt` (`queue:<id>` draft + `#overlay-q-save-prompt` `update-item` + `active-spotlight` done-toast guard), implement dedicated overlay-ramp templates for `insights`, `phase`, `epic`, `story` (`story:<key>` editable prompt/model synced to `renderEpics()` & `closeOverlay()`), `artifact` (synced with `loadArtifactPreview`/`renderArtifactInspectorCard`), and `reconciliation-diff` (synced with `runReconciliation`), call `bindFocusTriggers` in each tab renderer, and expose `resolveOverlayTarget`/`getLastReconciliationDiff` on `__bmadTestHooks` -- fulfills RD-7 Focus View and AD-10 live reconciliation for all 8 target types.
- [x] `tests/panel-guards.test.mjs` (Stubbed DOM & Story 8.5 verification suite) -- Extend `createStubbedDomEnvironment` for `[data-overlay-trigger]`/`[data-focus-expand]`/`closest()` multi-selector traversal and `bmad_reconcile_trackers` mocking, and add comprehensive Story 8.5 tests covering all 8 canonical `targetType`/`targetKey` openings at overlay type sizes, interactive-descendant + nested-story click guards, live Queue model/review/prompt edits + Story draft sync surviving polls and close, Artifact async diff/content/error sync, and Reconciliation Diff Focus View -- deterministically verifies Story 8.5 and all I/O matrix edge cases.

**Acceptance Criteria:**
- Given rendered Work (`AI notes` disclosure expanded), Queue (active spotlight + queued/failed items), and Project (reconciliation diff, flat phases, expanded epic with stories, recently changed files) tabs, when clicking each focusable card/row/section body or its `⤢` Expand button, then `#overlayLayer` (`role="dialog"`, `aria-modal="true"`) opens with the canonical `targetType`/`targetKey` detail view at overlay reading type sizes (`16 / 15 / 14.5 / 13.5px`) using exclusively `overlay-*` non-duplicating DOM IDs, traps `Tab` focus, and restores focus cleanly on close.
- Given any focusable card/row/section across Work, Queue, and Project, when clicking an interactive child control (button, tab, status pill, `.pill`, checkbox/input, select, textarea, label, link) or clicking a nested story row inside an epic box, then interactive child controls perform only their normal action without opening Focus View, and clicking a story row opens only the `story` Focus View without triggering the parent `epic` Focus View.
- Given an open `queue-item`, `active-spotlight`, `story`, `artifact`, or `reconciliation-diff` Focus View while 5-second background polls arrive, when editing a task's model, review mode, or prompt (or a story's prompt/model, toggling artifact diff/content, or running reconcile preview/apply), then background polls remain stashed without disrupting the overlay, explicit actions clear stale stashed state and immediately sync changes to both the underlying tab card and the open Focus View, and saved or drafted edits survive overlay close and subsequent polls.
- Given the completed implementation, when running `node --test tests/panel-guards.test.mjs`, `node --test tests/panel-a11y.test.mjs`, and `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs`, then every test passes with zero inline `font-size`, intact Palette C WCAG AA contrast and closed type ramp, and version `0.5.4` tri-synced.

## Implementation Notes

- Implemented RD-7 Focus View CSS, `tabindex="-1"`, and `⤢` `[data-focus-expand]` triggers across Work (`#insightsCard`), Queue (`.queue-active-spotlight`, `.queue-item-card`), and Project (`.phase-card`, `.epic-box`, `.story-row`, artifact `.insight-item`, `#artifactPreviewCard`, `#reconciliationDiffCard`) in `assets/panel.html`.
- Added `escapeAttrValue`, `bindFocusTriggers` (with `isInteractiveDescendantClick` and nested-trigger guard), `lastReconciliationDiff`, null-safe `wireUserEditTracking`, and dedicated `overlay-*` Focus View templates with AD-10 live sync across `queue-item`, `active-spotlight`, `insights`, `phase`, `epic`, `story`, `artifact`, and `reconciliation-diff`.
- Upgraded `tests/panel-guards.test.mjs` stubbed DOM and added the Story 8.5 suite (6 tests); verified `node --test tests/panel-guards.test.mjs` (41/41 pass), `node --test tests/panel-a11y.test.mjs` (42/42 pass), `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` (239/239 pass, version `0.5.4`), and `node ../scripts/validate.mjs`.

## Plan Change Log

## Review Triage Log

## Design Notes

- **Non-intrusive hover & selector safety:** Styling focusable surfaces via `[data-overlay-trigger]` avoids altering `class="phase-card"` (which `tests/panel-a11y.test.mjs:901` asserts verbatim) while signaling clickability across all three tabs.
- **Draft key namespaces:** Reusing `userEditedPrompts`/`userSelectedModels` with disjoint prefixes (`rec:<skill>:<title>`, `queue:<id>`, `story:<overrideKey || id>`) keeps one AD-10 draft store across Work, Queue, and Project without key collisions.
- **Nested-card isolation:** Stopping propagation in `bindFocusTriggers` after checking `e.target.closest("[data-overlay-trigger]") === el` guarantees a `.story-row` click inside `.epic-box` opens `story` cleanly in both real browsers and stubbed DOM tests.

## Verification

**Commands:**
- `node --test tests/panel-guards.test.mjs` -- expected: all existing guard tests plus Story 8.5 Focus View, click-guard, and live-sync tests pass.
- `node --test tests/panel-a11y.test.mjs` -- expected: Palette C contrast, closed type ramp, zero inline `font-size`, 3-tab ARIA, and Story 8.2/8.4 tests remain green.
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` -- expected: full suite and `0.5.4` version tri-sync pass cleanly.
