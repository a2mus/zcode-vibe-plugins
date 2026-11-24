---
title: 'Refactor sweep'
type: chore
ticket: 5
container: epic-panel-polling-safety
created: '2026-11-24'
status: done
baseline_revision: '3c50d56f79836df6604b0515bc0a6998d16241f8'
route: oneshot
route_source: pinned
risk: low
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** After Stories 1-4 the panel script in `assets/panel.html` carried cleanup debt: (1) the render-guard preamble (`if (typeof force !== "boolean") force = false;` + a hand-rolled `lastSectionSignatures` compare/assign) was copy-pasted across 7 render functions in two divergent idioms (early-return vs wrapping-if, the latter used twice in `renderSkillsCatalog`), plus a third inline variant for the provider bar inside `renderWorkspaceState`; (2) small guard/render helpers were duplicated — manual `String(el.tagName || "").toUpperCase()` extraction at 5 sites, the `userEditedPrompts`/`userSelectedModels` listener-wiring block twice (recommendations + skills catalog), the `x ? x.split("/").pop() : "host-default"` short-name expression at 4 sites, the "🤖 Dynamic Fit" default-model literal twice, the complete-task-then-continue-queue flow twice, the copy-with-toast pair twice, the filter-input read 3 times, and the `getElementById` cmd/model editor-read pattern at 6 sites with subtle trim differences; (3) theme-token usage was inconsistent — 8 hardcoded off-palette `rgba(...)` colors (Tailwind emerald/red/blue/violet) frozen at dark-theme values in CSS rules and JS-rendered inline styles despite `--success`/`--danger`/`--accent`/`--purple`/`*-soft` tokens existing in both themes; and (4) `escapeHtml` coverage had gaps — server-provided numeric fields (`p.modelCount`, queue `counts.*`, `counts.progressPct`, all `metrics` breakdown numbers, `p.progressPct`, `artCount`, `epic.smartProgressPct`/`declaredProgressPct`) were interpolated raw into `innerHTML` templates. All Story 1-4 plan files record `deferred: []`, so the sweep scope is exactly the ticket's three named items — no deferred review findings were outstanding.

**Approach:** Cleanup only, no new behavior: route all 9 section guards through one `sectionNeedsRender(sectionKey, signature, force)` helper (which also subsumes the non-boolean `force` normalization, so event objects passed by `addEventListener` wiring behave exactly as before); extract `tagOf`, `shortModelName`, `dynamicFitModel`, `readFilterValue`, `readCmdEditor` (with an explicit `trim` flag preserving each site's exact trim semantics), `readModelEditor`, `wireUserEditTracking`, `copyWithToast`, and `completeTaskAndContinue`; replace every hardcoded `rgba()` tint with either the matching `*-soft` token or `color-mix(in srgb, var(--token) N%, transparent)` preserving the original alpha exactly; and wrap every server/state-derived interpolation that lands in an `innerHTML` template in `escapeHtml`. Invariant after the sweep: every `${...}` inside an `innerHTML` template is either `escapeHtml(...)`-wrapped, a trusted pre-escaped HTML fragment, a static-string ternary, or a locally computed number (loop index / `.length`); everything else unescaped is a `textContent` assignment, toast message, JSON signature key, or filter haystack.

</intent-contract>

## Implementation Notes

- **`assets/panel.html` — deduplicated render/guard helpers:**
  - New `sectionNeedsRender(sectionKey, signature, force)` — single signature compare/record point for all 9 sections (`providerBar`, `taskQueue`, `recommendations`, `insights`, `phases`, `epics`, `skillsCatalog`, `agentsCatalog`, `artifacts`). Replaces the 7 per-function `typeof force !== "boolean"` normalizations (now 0 copies) and both guard idioms; `force !== true` reproduces the old normalized semantics exactly (Event objects from `addEventListener("input", renderEpics)` etc. still do not force).
  - New `tagOf(el)` — replaces 5 manual `String(el.tagName || "").toUpperCase()` extractions (`isUserInteractingWithForm`, `pointerdown`, `keydown`, `change`, `focusout`); the null-element early return in `isUserInteractingWithForm` is subsumed (`tagOf(null) === ""`).
  - New `wireUserEditTracking(key, serverCmd, serverModelId, cmdId, selectId)` — the `userEditedPrompts.set` / `userSelectedModels.set` listener blocks now exist exactly once (verified: the only two `.set(` writes are inside this helper); used by `renderRecommendations` and `renderSkillsCatalog`.
  - New `shortModelName(modelId)` — replaces the 4 duplicated `x ? x.split("/").pop() : "host-default"` expressions (`launchPromptInNewSession`, `dynamicFitModel`, story rows, agent cards) and the option-synthesis split in `buildModelSelectOptions`. The two toast sites (`sel.value.split("/").pop()`, `(chosenModel || "").split("/").pop()`) intentionally keep their bare `.pop()` because their empty-string output differs from the `"host-default"` fallback — changing them would alter toast text (new behavior).
  - New `dynamicFitModel()` — single source for the `{ modelId, shortName, tier: "🤖 Dynamic Fit", reason }` default previously duplicated (with divergent key sets) in `renderRecommendations` and `renderSkillsCatalog`; "Dynamic Fit" literal now appears exactly once.
  - New `readCmdEditor(cmdId, fallbackCmd, trim)` + `readModelEditor(selectId, fallbackModelId)` — replace 6 duplicated `getElementById` + ternary editor-read blocks (rec action buttons, `btnQueueSelectedRecs`, cat-queue/cat-launch/cat-send/cat-copy) with per-site `trim` flags preserving the exact original semantics (cat-launch/cat-send/cat-copy did not trim; rec/queue sites did).
  - New `completeTaskAndContinue(taskId, toastMessage, fallbackMode)` — unifies the duplicated complete-active-task-then-relaunch flow (`bannerBtnCompleteActive` and `btnCompleteActiveTask`); the per-item `data-q-done` handler stays separate (deliberately no continuation logic).
  - New `copyWithToast(cmd)` and `readFilterValue(id)` — dedupe the copy+toast pair (2 sites) and the filter-input lowercase-trim read (3 sites; `readFilterValue` uses `?.value` so it covers both the plain and optional-chaining originals).
- **`assets/panel.html` — normalized theme-token usage (0 hardcoded `rgba()`/hex colors remain in any JS-rendered markup; CSS tints now derive from tokens):**
  - `.diff-add` / `.diff-del` backgrounds → `color-mix(in srgb, var(--success|danger) 16%, transparent)` (pixel-identical in dark theme, where the old rgba values were exactly the dark tokens; light theme now follows its own tokens instead of frozen dark hues).
  - `.live-queue-banner` gradient → `color-mix(... var(--accent) 14% ...), color-mix(... var(--purple) 14% ...)` (was off-palette Tailwind blue/violet).
  - `.pulse-dot` box-shadow + `@keyframes pulseGlow` → `color-mix(in srgb, var(--success) 70%, transparent)` / `transparent` (was Tailwind emerald, mismatched with the dot's own `var(--success)` background); the `prefers-reduced-motion` block asserted by AD-5 tests is untouched.
  - `.queue-item-card.is-active` / `.is-failed` gradients → `var(--success-soft)` / `var(--danger-soft)`.
  - JS spotlight card gradient → `var(--success-soft)` (now consistent with `.is-active`); JS failure box → `background: var(--danger-soft)` (dead rgba fallback dropped — the token is defined in both themes) and `border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent)` (alpha preserved, hue tokenized).
- **`assets/panel.html` — tightened escapeHtml coverage (every server/state-derived value reaching `innerHTML` is now escaped):**
  - Provider bar: `p.modelCount`. Queue banner: `counts.failed`/`counts.queued` in `statusLabel`, `counts.done`/`counts.failed`/`counts.total`/`counts.queued` in the summary pills and text, `counts.progressPct` in the `bar-smart` width style. Phases: all 8 metrics-breakdown numbers (`smartDoneStories`, `reviewStories`, `inProgressStories`, `backlogStories`, `declaredDoneStories`, `totalStories`, `declaredOverallPct`, `smartOverallPct`), `artCount` (2 sites), `p.progressPct` (pill + width style). Epics: `epic.smartProgressPct` / `epic.declaredProgressPct` in the status pill.
  - Deliberately unescaped (documented invariant): local loop indices and `.length` counts (numbers by construction — several `rec-cmd-${idx}`/`cat-cmd-${idx}`/`q-model-${idx}` source forms are pinned by AD-4 regex assertions in `tests/panel-a11y.test.mjs`), `textContent`/toast assignments, `JSON.stringify` signature keys, filter haystacks, static-string ternaries, and trusted fragments already built with escaping inside (`statusLabel`, `qBadge`, `stPill`, `statusPill`, `sPill`, `statusBadge`, `chips`, `bodyHtml`, `storiesHtml`, `buildModelSelectOptions(...)`).
- **No behavior changes:** all extraction sites preserve exact expressions (including trim/no-trim and empty-string toast semantics); `window.__bmadTestHooks` surface unchanged; guard timing (`setTimeout(flushPendingState, 0/50)`), the `isRefreshing` lock, and the visibility-gated 5s poll untouched.

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --test tests/` — passed (136/136 tests, 0 failures; run both before the sweep as a green baseline and after the sweep).
- `node --test "tests/*.test.mjs"` — passed (136/136).
- `node scripts/check-version-sync.mjs` — passed (`[check-version-sync] OK: all 3 versions match (0.5.3)`).
- `node ../scripts/validate.mjs` — passed (`bmad-companion v0.5.3 validated`, incl. inline panel-script parseability).
- Dedup/escape greps on `assets/panel.html` — confirmed: `typeof force !== "boolean"` → 0 copies; manual `tagName` extraction → only inside `tagOf`; `lastSectionSignatures.` writes → 0 outside `sectionNeedsRender` (bracket-key writes only in the helper); "Dynamic Fit" → 1 literal; `userEditedPrompts.set`/`userSelectedModels.set` → only inside `wireUserEditTracking`; hardcoded `rgba()`/hex colors in the script section → 0. Full `${...}` interpolation audit of every `innerHTML` template: all server/state-derived values escaped; remaining unescaped hits triaged as textContent/toast/JSON-key/haystack/static-ternary/trusted-fragment/local-number (invariant recorded in Implementation Notes).

## Auto Run Result

- **Summary:** Completed the Epic 4 refactor sweep of `assets/panel.html` with zero behavior change: unified all 9 section render guards behind one `sectionNeedsRender` signature helper (removing 7 copied force-normalization preambles), extracted 9 shared render/guard helpers (`tagOf`, `shortModelName`, `dynamicFitModel`, `readFilterValue`, `readCmdEditor`, `readModelEditor`, `wireUserEditTracking`, `copyWithToast`, `completeTaskAndContinue`) eliminating every duplicated helper body, normalized all 10 hardcoded off-token `rgba()` colors in CSS and JS-rendered markup to `var(--*-soft)` tokens or alpha-preserving `color-mix()` on theme tokens, and closed the `escapeHtml` gaps on all server-derived numeric interpolations reaching `innerHTML`. Full suite green (136/136), version sync and repo validation pass; dedup and escape-audit greps recorded as evidence.
- **Files changed:**
  - `assets/panel.html`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-panel-polling-safety/tickets/plan-5-refactor-sweep.md`
- **Review:** none, no lenses launched (pinned).
