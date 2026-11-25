---
name: BMAD Companion
status: final
sources:
  - ../prd-bmad-companion/prd-bmad-companion.md
  - ../../../assets/panel.html
  - ../../../AGENTS.md
updated: 2026-11-25
---

# BMAD Companion — Experience Spine

> Information architecture, behavior, state, interaction, accessibility, and journey contract for the 5-tab right-side cockpit (`assets/panel.html`, served as `ui://bmad-companion/panel.html`). Visual tokens and component appearance live in [DESIGN.md](./DESIGN.md); this spine cross-references them as `{path.to.token}`. Spines win on any conflict with mocks or the as-built file. Requirement ids (`FR-*`, `RULE-*`, `SM-*`, `UJ-*`) cite the [PRD](../prd-bmad-companion/prd-bmad-companion.md).

## Foundation

Single-surface desktop: a ZCode right-side MCP App iframe (`surface: "bmad-companion"`, MIME `text/html;profile=mcp-app`, CSP `unsafeEval: false`). No UI framework — bespoke vanilla HTML/CSS/JS, zero npm dependencies (RULE-1), zero external assets (RULE-7). [DESIGN.md](./DESIGN.md) is the visual identity reference; this spine is the experience.

The panel never touches disk or the OS directly. Every effect routes through the MCP stdio server (`scripts/mcp-server.mjs`, 9 tools) over the `window.parent.postMessage` JSON-RPC 2.0 bridge (`PROTOCOL_VERSION = "2026-01-26"`, panel.html:1210). `window.zcode` is banned (PRD Non-goal 2). The bridge methods used are `ui/initialize`, `tools/call`, `ui/message`, `ui/update-model-context`, plus inbound `ui/notifications/host-context-changed` (theme) and `ui/notifications/tool-result` (live state). RPC calls time out at 15000ms (panel.html:1308).

Dark is the default surface; light applies when the host reports `theme: "light"` at `ui/initialize` or via `host-context-changed` (`applyHostTheme`, panel.html:1318-1324, 1347-1352, 1376-1378). There is no in-panel theme toggle — the host owns theme.

The cockpit's governing promise: **live state never costs the user their place.** The panel polls `bmad_get_state` every 5s while visible, yet a user mid-edit in a prompt textarea or model dropdown must never lose focus, cursor, keystrokes, or edits (FR-12…FR-14, RULE-9, SM-2). The [Live Polling & Form-Focus Guards](#live-polling--form-focus-guards) section is the contract that makes this true.

## Information Architecture

One scrolling column, five tabs, one visible at a time. Global chrome (top bar + progress strip + banners) persists across tabs.

| Surface | Reached from | Purpose |
|---|---|---|
| **⚡ Next Prompts** (`tab-advisor`, default) | Panel open / tab strip | Post-turn AI state, provider badges, ranked editable `/bmad-<skill> "<prompt>"` recommendations with per-rec model selects and Launch/Queue/Run-Here/Attach/Copy actions, multi-select queueing, and cross-check insights. |
| **⛓️ Queue** (`tab-queue`) | Tab strip (live count pill) / `⛓️ Open Queue` / `⛓️ View Queue` / after adding checked recs | Multi-task execution ledger: default review gate, epic quick-enqueue, run via `.dwf.ts` workflow or Separate Sessions (Auto-Chain), active-task spotlight, per-task model/review selects, reorder/activate/done/launch/remove. |
| **📊 Phases & Epics** (`tab-progress`) | Tab strip | Static-vs-Smart reconciliation card (Preview Diff / Reconcile), 4-phase BMAD lifecycle cards with artifact chips, and a filterable epic/story explorer with per-story Queue/New-Session actions. |
| **🧭 Skills & Agents** (`tab-catalog`) | Tab strip | Searchable, phase-filtered catalog of `/bmad-*` skills (editable command + model + Launch/Queue/Run-Here/Copy) and specialist agent rows (New Session). |
| **🗂️ Artifacts** (`tab-artifacts`) | Tab strip / artifact chip in Phases | Newest-modified-first artifact directory (search, git-status badges, Diff/Open) and an inspector card (Git Diff ↔ Content toggle, Open File, Review). |
| **Global chrome** | Always | Top bar (brand, AI Audit, Sync), Smart-vs-Static progress strip, live-queue banner, toast banner. |

Canonical tab names map to as-built labels: "Execution Queue" → **⛓️ Queue**; "Catalog" → **🧭 Skills & Agents**. Tab order is fixed: advisor, queue, progress, catalog, artifacts (`panel.html:971-977`). `switchTab` toggles `.active`, `aria-selected`, roving `tabindex`, `display:block/none` across the five `role="tabpanel"` sections, and resets `mainScroll.scrollTop = 0` (`panel.html:2985-3002`). The tab strip uses a single-row 5-column grid (`repeat(5, minmax(0, 1fr))`), closing DESIGN.md **LD-1**.

Cross-tab jumps: an artifact chip in Phases calls `switchTab("artifacts")` then loads its diff (`panel.html:2469-2475`); "Add Checked to Queue" and "Open Queue" jump to `queue` (`panel.html:3071, 3075`); the live-queue banner's "View Queue" (`#bannerBtnOpenQueue`) jumps to `queue` (`panel.html:1837`). Because `switchTab` resets scroll to top, cross-tab jumps always reveal `#artifactPreviewCard` or the Queue controls immediately.

→ No mockups are promoted in this run; surfaces are specified by the tables below. Spines win on conflict.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in [DESIGN.md](./DESIGN.md#brand--style). The panel speaks in **short verb-first action labels with an emoji prefix**, honest fallbacks, and numeric telemetry. It never invents success.

| Do (as-built voice) | Don't |
|---|---|
| `🚀 Launch in New Session` / `➕ Add to Queue` / `💬 Run Here` / `📎 Attach` / `📋 Copy` | Bare skill names (`/bmad-ux`) without a contextual prompt (RULE-2) |
| `📋 Prompt copied! Press Ctrl+N then Ctrl+V (Model: …)` when OS automation is blocked | Claiming a session opened when it did not |
| `✓ All tracker files are already 100% synchronized with code reality! No changes needed.` | A generic "Success" toast with no counts |
| `Smart AI Progress (60% vs 30% static tracker)` | Hiding the static-vs-smart gap behind one number |
| `Your BMAD Execution Queue is Empty` + how to fill it | A blank list with no next step |
| `❌ Queue action failed: <message>` / `❌ Reconciliation error: <message>` | Swallowing errors silently |
| Counts and ids: `3/10 stories`, `Story 2.1`, `review=none` | Vague qualifiers ("some", "several") |

Every recommendation renders as `/bmad-<skill> "<workspace-specific prompt>"` paired with a `providerId/modelId` (RULE-2, SM-1). Toasts auto-dismiss after 4000ms (`panel.html:1501`), always name the model or the next manual step, and shift to semantic error (`.is-error`, `role="alert"`, `aria-live="assertive"` — triggered only on explicit error/failure prefixes or `error:`/`failed to` phrasing, not recovery toasts referencing failed tasks) or warning (`.is-warning`) styling when appropriate.

## Component Patterns

Behavioral. Visual specs live in [DESIGN.md.Components](./DESIGN.md#components).

| Component | Use | Behavioral rules |
|---|---|---|
| **Recommendation card** (`{components.rec-card}`) | Next Prompts | Editable `{components.cmd-textarea}` command + `{components.model-select}` model. Edits persist in `userEditedPrompts`/`userSelectedModels` keyed `rec:<skill>:<title>` while the server base is unchanged (FR-14). `{components.queue-checkbox}` adds to a multi-select set; `☑️ Select All` toggles to `☐ Deselect All` when all are checked, and `➕ Add Checked (N) to Queue` displays the live selection count before enqueuing all checked with their chosen models and jumping to Queue. Actions read the *live* textarea/select values, not the server base. Five actions: Add to Queue (or "↻ Update in Queue" / "↻ Re-queue" if already queued/done), Launch in New Session, Run Here, Attach, Copy. |
| **Model select** (`{components.model-select}`) | Next Prompts, Queue, Skills & Agents | Options grouped into `<optgroup>` sections by `providerName` (`panel.html:1603-1635`). Each `<option>` shows `🤖 <modelId> · <N>k · $/$$/$$$` with `· ⛔ rate-limited` (sorted to the bottom of its provider group) and `★ Recommended` on the top-scored model. |
| **Catalog skill card** | Skills & Agents | Same editable command/model pattern keyed `skill:<skill>` (including the associated `<label class="cmd-label">` header row); shows preceded/followed workflow breadcrumbs and actions Add to Queue / Launch in New Session / Run Here / Copy. Search + phase filter re-render via signature diff; empty matches render an `.empty-state-card`. |
| **Agent row** | Skills & Agents | Uses `.agent-card` (`padding: 9px 11px`) with one "🚀 New Session" action launching a greeting prompt addressed to the agent by name/title/focus with its scored model. |
| **Queue control bar** | Queue | Default review gate select (`none`/`quick`/`thorough`, applies to all on change), epic quick-enqueue picker + `➕ Queue Epic`, and seven execution controls: `⚡ Run Queue via ZCode Workflow (.dwf.ts)`, `🚀 Run Queue in Separate Sessions (Auto-Chain)` (starts only the first queued task with `CreateSession` + `start-task` + `sessionId`, then the `Stop` hook auto-chains subsequent tasks), `✓ Complete Active & Continue` (marks active/first-queued done and auto-continues if queued items remain), `⏸ Pause`, `↻ Retry Failed (N)` (visible whenever failed items exist), `🧹 Clear Done`, `🗑️ Clear All`. |
| **Queue item card** (`{components.queue-item-card}`) | Queue | Per-task model select and review-gate select (`none`/`quick`/`thorough`) commit immediately via `bmad_queue_manage({action:"update-item"})`. Reorder via ↑/↓ buttons (no drag). "🟢 Set Active" (shown when not active/failed) → `start-task`; "↻ Retry / Re-queue" (shown on failed items) → `retry-failed`; "✓ Mark Done" (disabled once done) → `complete-task` with `storyStatus:"done"` (advances queue + reconciles story); "🚀 New Session" → `start-task` then launch; "✕" (with `aria-label`) → `remove`. Status pill: ⏳ IN QUEUE #n / 🟢 ACTIVE (pulse) / ✓ DONE / ✗ FAILED (with `⚠️ Failure:` diagnostic box). |
| **Active-task spotlight** (`{components.queue-active-spotlight}`) | Queue | Renders only when `taskQueue.activeTask` exists: pulse dot, model + review pills, title, and the shaped `effectivePrompt` in a mono `.queue-prompt-inset`. |
| **Phase card** (`{components.phase-card}`) | Phases & Epics | Native `<button type="button" class="phase-summary-row" aria-expanded>` toggles expand/collapse (`expandedPhases` Set). First render auto-expands incomplete phases (`panel.html:1662-1669`). Body lists `<button>` artifact chips: main label → jump to Artifacts diff; `↗` → open externally. Expand All / Collapse All buttons. |
| **Epic box / story row** (`{components.epic-box}`) | Phases & Epics | Native `<button type="button" class="epic-toggle-btn" aria-expanded>` toggles expand (`expandedEpics`) beside the sibling `➕ Queue Epic` button; first render auto-expands up to 2 open epics (`panel.html:1670-1675`). Search/status filter forces expansion of matches. Story row shows smart status pill, ✨ AI badge + evidence when reconciled, recommended-model pill, and Queue Story / New Session actions. Done stories offer `/bmad-code-review`; open stories offer `/bmad-build-auto` with the story's verify command. "➕ Queue Epic" enqueues all open stories in build order. |
| **Reconciliation card & diff** (`{components.reconciliation-diff-card}`) | Phases & Epics | "🔍 Preview Diff" → `bmad_reconcile_trackers({dryRun:true})`; "⚡ Reconcile Trackers with Reality" → `{dryRun:false, target:"all", backup:true}`. Result renders `#reconciliationDiffCard` (`.reconciliation-diff-card`) listing `key: oldStatus → newStatus` + reason per change; live run then re-renders state. ✕ Close hides the card. |
| **Artifact row + inspector** (`{components.artifact-preview}`) | Artifacts | Directory sorted strictly by `mtimeMs` descending; search filters path/name/kind/phase/gitStatus (empty matches show `.empty-state-card`). Keyboard-operable `<button class="art-row-btn">` (underlined path hover cue) or "🔀 Diff" → `bmad_inspect_artifact` then inspector card. Inspector toggles Git Diff ↔ Content (active toggle gets `{components.button-purple}` and `aria-pressed="true"`), "↗ Open File" → `bmad_open_artifact_file`, "🚀 Review" → launches `/bmad-review "<artifact>"` in a new session, and "✕ Close" dismisses the inspector. |
| **Progress strip** (`{components.progress-strip}`) | Global | Headline always shows smart % vs static %; mono numbers `done/total (pct)`; `{components.dual-bar}` width animates to smart %. |
| **Live-queue banner** (`{components.live-queue-banner}`) | Global | Visible whenever `taskQueue.items.length > 0`; shows active (`pill-success`), paused (`⏸ PAUSED`, `pill-warning`), queued (`pill-accent`), complete (`pill-success`), or failed (`pill-danger`) pill, embedded 4px progress bar, `✓ Done & Continue` (when active, completes + continues in current `executionMode`), `▶ Continue Queue` / `⚡ Run Workflow` (when queued items wait), or `↻ Retry Failed` (when failed items exist), and `⛓️ View Queue` (`panel.html:1781-1853`). |
| **Toast** (`{components.toast-banner}`) | Global | `showToast(msg)` sets text, applies `.is-error` (`role="alert"`, `aria-live="assertive"`) or `.is-warning` (`⚠️`/`ℹ️`) or default success (`role="status"`, `aria-live="polite"`), adds `.visible`, and auto-hides after 4000ms (`panel.html:1488-1504`); successive toasts reset the timer. |
| **Provider state bar** | Next Prompts | Pills for active providers (model counts), subscription selections, and a runtime-synced vs dynamic-config badge; signature-diffed (`panel.html:1682-1698`). |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | Global | Subtitle "Scanning workspace BMAD artifacts…"; turn box "Analyzing workspace state…"; progress 0/0. `initMcpApp` → `ui/initialize` → first `refreshState`. |
| RPC / scan failure | Global | Subtitle becomes "Ready · Click Sync or run bmad_open_companion" (`panel.html:1651-1653`). No crash, no blank panel. |
| No recommendations | Next Prompts | `.empty-state-card`: "No recommendations yet. Click ↻ Sync to analyze workspace." |
| Empty queue | Queue | Centered `.empty-state-card`: "Your BMAD Execution Queue is Empty" + how to enqueue from Next Prompts / Phases. |
| No story matches / no epics | Phases & Epics | `.empty-state-card`: distinguishes empty workspace ("No epics or stories found yet…") from filter miss ("No matching stories found…"). |
| No catalog / artifact matches | Skills & Agents / Artifacts | `.empty-state-card` explaining how to clear search/phase filters or generate artifacts. |
| Phase with no artifacts | Phases & Epics | "No artifacts generated in this phase yet." |
| Artifact loading | Artifacts inspector | "Loading artifact diff & content…" then diff/content; failure → "Failed to load artifact: <message>". |
| Reconciliation dry-run | Phases & Epics | Diff card titled "🔍 Dry Run Preview (N keys across M file(s))"; **no disk writes** (RULE-8). |
| Reconciliation live | Phases & Epics | "✅ Reconciled N keys across M file(s)!" + success toast; `.bak` backups written before mutation (RULE-8, FR-11); state re-rendered. |
| Nothing to reconcile | Phases & Epics | "✓ All tracker files are already 100% synchronized…". |
| Queue idle / running / paused / completed | Queue + global | Status badge `IDLE/RUNNING/PAUSED/COMPLETED · done/total Done · queued Queued`; running shows pulse + live banner; paused shows `⏸ PAUSED` (`pill-warning`) in live banner; completed shows `✓ QUEUE COMPLETE` or `⚠️ QUEUE FINISHED (N FAILED)` with `↻ Retry Failed`. |
| Task queued/running/done/failed | Queue item | ⏳ / 🟢 (pulse, `.is-active`) / ✓ (`.is-done`, dimmed) / ✗ (`.is-failed`, danger border + `⚠️ Failure:` detail + `↻ Retry / Re-queue`) pills. |
| Rate-limited model | Model select | Tagged `· ⛔ rate-limited`, sorted to the bottom of its provider `<optgroup>`, and skipped by auto-scoring when a healthy alternative exists (`panel.html:1617-1631`). |
| OS launch blocked | Global toast | Clipboard fallback: "📋 Prompt copied! Press Ctrl+N then Ctrl+V" (FR-4 graceful degradation). |
| Background poll while editing | Any tab | State stashed in `pendingWorkspaceState`; **no re-render** until focus leaves (see Guards). |
| Hidden panel | Global | 5s interval skips (`document.hidden`); resumes on visibility. |
| Host theme change | Global | `body.theme-light` added/removed; tokens swap instantly, no reload. |

## Live Polling & Form-Focus Guards

The product-specific contract that realizes FR-12…FR-14, RULE-9, and SM-2 (**0 dropped keystrokes / focus losses / lost edits**; deferred flush ≤100ms). All references are `assets/panel.html`.

**Poll loop.** `setInterval(…, 5000)` fires only when `!document.hidden` and `document.visibilityState === "visible"`, calling `refreshState({isBackground:true})` (`panel.html:3207-3218`). `refreshState` is serialized by an `isRefreshing` lock — overlapping polls return immediately (`panel.html:1637-1657`). Each poll calls `bmad_get_state({refresh:true})`.

**Guard predicate.** `isUserInteractingWithForm()` returns true when either (a) `Date.now() < selectOpenUntil`, or (b) `document.activeElement` is a `TEXTAREA` or `INPUT` (`panel.html:1239-1243`). A focused `SELECT` is covered by the time window, not the tag check.

**Select window (`selectOpenUntil`).** Set to `now + 15000ms` on `pointerdown` on any `select` (capture) and on `Space`/`Enter`/`ArrowDown`/`ArrowUp` while a select is focused (`panel.html:1252-1272`). Cleared to 0 on `Escape`, `Tab`, `change`, or `focusout` of a select. The 15s window keeps a dropdown "open" for guard purposes even though the native popup may close sooner.

**Suppression + stash.** While guarded:
- A background poll skips the fetch entirely if the guard is already true at entry (`panel.html:1640`); if the guard becomes true mid-flight, the result is stashed in `pendingWorkspaceState` instead of rendered (`panel.html:1645-1646`).
- An inbound `ui/notifications/tool-result` carrying `structuredContent.metrics` is stashed when guarded, rendered when not; a tool-result *without* metrics triggers a background refresh (`panel.html:1354-1364`).

**Flush.** `flushPendingState()` renders the stashed state only if the guard has cleared, then nulls the stash (`panel.html:1245-1250`). Triggers: `focusout` of SELECT/TEXTAREA/INPUT → `setTimeout(flush, 50)`; select `change` / `Escape` / `Tab` → `setTimeout(flush, 0)` (`panel.html:1265-1298`). The 50ms focusout delay is within the ≤100ms SM-2 budget.

**Edit preservation.** `userEditedPrompts` and `userSelectedModels` (Maps) store `{base, value}` keyed `rec:<skill>:<title>` or `skill:<skill>` (`panel.html:1572-1601`). On render, `resolveUserPrompt` returns the user's value while `base === serverCmd`, and **drops** the edit when the server base changes (`panel.html:1581-1586`). `resolveUserModel` likewise drops when the base model changes or the chosen model is no longer in `availableModels` (`panel.html:1588-1601`). This is why a poll that returns the *same* recommendation never clobbers an in-progress edit, but a genuinely new recommendation resets it.

**Signature diffing.** `lastSectionSignatures` holds a JSON signature per section — `providerBar`, `recommendations`, `insights`, `phases`, `epics`, `skillsCatalog`, `agentsCatalog`, `artifacts`, `taskQueue` (`panel.html:1224-1234`). Each render function calls `sectionNeedsRender()` (`panel.html:1514-1518`) and returns early when unchanged, so `innerHTML` is only replaced when data actually differs. The recommendations signature includes checked indices and queue item status so checkbox toggles and queue changes refresh correctly.

**Guard scope (important).** The guard governs *background* updates (polls + unsolicited tool-result notifications). Responses to **explicit user actions** (`manageQueue`, reconciliation, artifact load) render immediately via `renderWorkspaceState` even if a control is focused (`panel.html:1731-1743`) — the user asked for that change, so the re-render is expected. Changing a queue select, for example, commits then re-renders the queue list.

**Invariants.** Never replace `innerHTML` unconditionally on a poll; never drop `userEditedPrompts`/`userSelectedModels`/`lastSectionSignatures` when touching UI state (AGENTS.md); never render a stashed payload while the guard is true.

## Interaction Primitives

- **Click & keyboard to act.** Every interactive target — including tabs, Phase/Epic accordion toggles (`<button type="button" aria-expanded>`), artifact chips, and directory rows (`<button class="art-row-btn">`) — is a native button or form control. Sibling actions sit beside Epic toggles without nesting interactive elements.
- **Keyboard.** Native `Tab` traversal across buttons/inputs/selects/textareas; native `Enter`/`Space` activation; ARIA `tablist` arrow-key (`ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End`) navigation with wrapping across all 5 tabs (`panel.html:3004-3039`). Select keyboard navigation extends the guard window; `Escape`/`Tab` commit and flush. **No global cross-panel hotkeys** are defined as-built (no command palette) — tracked as an optional enhancement, not a regression.
- **Reorder without drag.** Queue ordering uses ↑/↓ buttons (`reorder`), never drag-and-drop (`panel.html:2002-2004, 2043-2051`).
- **Editing.** Command textareas resize vertically; edits are local until an action reads them. Model selects commit on `change`.
- **Search/filter.** Text inputs re-render their list on `input`; status/phase selects on `change` (`panel.html:3161-3165`). Filtering is client-side over the current state.
- **Launch semantics.** "Launch in New Session" pre-pastes into a *fresh* session and never auto-submits in the current one (SM-4 counter-metric: zero unconfirmed auto-submissions). "Run Here" sends to the current session via `ui/message`; "Attach" adds context via `ui/update-model-context`; "Copy" uses `navigator.clipboard` with an `execCommand` fallback (`panel.html:1474-1485`).
- **Banned everywhere:** `eval()` / `window.zcode` / external CDNs (RULE-7); unconditional poll re-render (DEC-3); silent tracker mutation during a scan (DEC-4); bare skill-name recommendations (RULE-2); auto-submitting a launched prompt; infinite scroll; drag-to-reorder.

## Accessibility Floor

Behavioral. Visual contrast lives in [DESIGN.md.Colors](./DESIGN.md#colors) (measured ratios + closed debt CD-1…CD-5).

**Contract.**
- WCAG 2.2 AA: essential text ≥4.5:1, focus indicators ≥3:1, both themes (DESIGN.md contrast table).
- Every interactive element keyboard-operable via native `<button>`/`<input>`/`<select>`/`<textarea>`; `Tab` order follows reading order; a visible focus indicator on every focusable control.
- Status conveyed by text + color, never color alone (pills carry words; diff carries +/− semantics via line content; toasts shift icon + semantic color + ARIA live priority).
- Live updates (toasts, queue status, progress) announced to assistive tech.
- Motion respects `prefers-reduced-motion`.

**Verified implementation (AD-1…AD-6 closed in `assets/panel.html` & `tests/panel-a11y.test.mjs`):**
- **AD-1 — Visible textarea & control focus.** `.cmd-textarea:focus` and `:focus-visible` declare `2px solid var(--accent)` outline plus `.cmd-editor-wrap:focus-within` border highlight (`panel.html:460-469`); `.model-select` and `.search-input` pair border swaps with `1px` box-shadow rings on `:focus-visible`.
- **AD-2 — Full ARIA tab & landmark semantics.** `<header role="banner">`, `<main role="main">`, `<nav id="tabsNav" role="tablist">`, `<button role="tab" aria-selected aria-controls>` with roving `tabindex` (`0`/`-1`) + `handleTabKeydown` arrow/Home/End navigation, `<section role="tabpanel" aria-labelledby tabindex="0">`, `aria-pressed` on inspector Diff/Content mode toggles, plus `<button aria-expanded>` on Phase & Epic accordions (`panel.html:941-1203, 2403-2595, 2985-3039`).
- **AD-3 — Announced toasts.** `#toastBanner` declares `role="status" aria-live="polite" aria-atomic="true"`, switching to `role="alert" aria-live="assertive"` on errors (`panel.html:983, 1488-1504`).
- **AD-4 — Associated labels.** `<label for="queueDefaultReviewSelect">`, `<label for="queueEpicPicker">`, `<label class="cmd-label" for="rec-cmd-${idx}">`, `<label class="cmd-label" for="cat-cmd-${idx}">`, `<label for="q-model-${idx}">`, `<label for="q-review-${idx}">`, and `aria-label` on filter controls and icon-only remove buttons (`panel.html:1039-1200, 1974-2015, 2201, 2701`).
- **AD-5 — Reduced motion.** `@media (prefers-reduced-motion: reduce)` disables `.pulse-dot` animation/box-shadow and transitions on `.bar-smart`, `.btn`, and `.queue-item-card` (`panel.html:863-874`).
- **AD-6 — Contrast debt.** Closed: DESIGN.md CD-1…CD-5 closed to full WCAG AA (essential text ≥4.5:1, focus indicators ≥3:1 in both themes).

## Responsive & Platform

Single surface, fluid narrow column. No breakpoints; the panel adapts by truncation (`text-overflow:ellipsis` on titles/paths) and `flex-wrap:wrap` on action/filter rows, not by reflowing into different layouts. `ui/initialize` declares `availableDisplayModes: ["inline","fullscreen"]` (`panel.html:1371-1373`); the layout is column-first in both.

Platform-specific behavior is confined to **clean-session launch** (`bmad_prepare_new_session`, FR-4): win32 PowerShell `SendKeys` `^n`+`^v`, darwin `pbcopy`+`osascript`, linux `wl-copy`/`xclip`/`xsel`+`xdotool`. When synthetic keystrokes are blocked, the panel falls back to clipboard copy with an instructional toast (A-2). Artifact "Open File" uses `cmd /c start` / `open` / `xdg-open` under workspace path confinement (RULE-3). Theme follows the host on every platform.

## Inspiration & Anti-patterns

- **Lifted from GitHub Primer:** the entire dark/light primitive palette (`#0d1117`/`#161b22`/`#30363d`/`#388bfd`… and their light inverses) so the cockpit reads as native developer tooling. Semantic pill vocabulary (success/warning/danger/purple) mirrors Primer labels.
- **Lifted from IDE instrument panels:** dense mono metadata, inset command editors, status pills, and a single accent for "launchable." Telemetry over decoration.
- **Lifted from the sibling Vibe Debrief cockpit:** the host-driven dark/light token swap and the "spines win on conflict" discipline.
- **Rejected — `window.zcode` bridge:** the panel uses only the MCP Apps `postMessage` JSON-RPC bridge (PRD Non-goal 2).
- **Rejected — unconditional `innerHTML` re-render / WebSocket push:** 5s polling + form guards + signature diffing instead (DEC-3). A live socket would still need the same focus guards; polling is simpler and zero-dependency.
- **Rejected — silent tracker mutation during scans:** Smart progress is computed in memory; disk writes happen only on explicit Reconcile with `.bak` backups (DEC-4, RULE-8).
- **Rejected — gamification:** no streaks, badges-for-points, or celebratory animation. The pulse dot means "a task is literally running," not achievement.
- **Rejected — auto-submit:** launching pre-pastes a prompt; the user presses send (SM-4).

## Key Flows

Journeys mirror the PRD's `UJ-1`…`UJ-4` and named protagonists verbatim, plus `UJ-5` closing surface coverage for Skills & Agents.

### Flow 1 — UJ-1: Alex edits a prompt mid-poll and launches a clean session (Alex, solo vibe-coder, just finished a Product Brief)

1. The `Stop` hook updates state; the panel's Next Prompts tab shows three recommendations, top one `/bmad-prd "Create the comprehensive Product Requirements Document…"` paired with `new-provider/claude-opus-5-5-high`.
2. Alex clicks the command `{components.cmd-textarea}` to add a constraint, then opens the provider-grouped `{components.model-select}` (checking cost tier `$`/`$$`/`$$$` and avoiding any `⛔ rate-limited` entry).
3. While Alex types, the 5s timer fires `bmad_get_state`. `isUserInteractingWithForm()` sees the focused textarea (and the select window), so the poll stashes `pendingWorkspaceState` — **no re-render, cursor intact**.
4. Alex blurs the control; `focusout` schedules `flushPendingState()` (50ms), which renders the stashed state. Because the server base command is unchanged, `resolveUserPrompt` keeps Alex's edited text and chosen model.
5. **Climax:** Alex clicks **🚀 Launch in New Session**. `bmad_prepare_new_session` copies the *edited* prompt, dispatches `Ctrl/Cmd+N` + `Ctrl/Cmd+V`, and a fresh ZCode session opens with Alex's exact command pre-pasted — the edit survived every poll, and nothing ran in the old session.

Failure: OS keystrokes blocked → toast "📋 Prompt copied! Press Ctrl+N then Ctrl+V (Model: …)"; the edit is still on the clipboard.

### Flow 2 — UJ-2: Maya reconciles drifting trackers (Maya, tech lead, three stories secretly done)

1. Maya opens Phases & Epics. The strip reads **Smart AI Progress 60% (6/10)** vs **static tracker 30% (3/10)**; three stories show ✨ AI badges with evidence.
2. She clicks **🔍 Preview Diff** → `bmad_reconcile_trackers({dryRun:true})`. `{components.reconciliation-diff-card}` lists `key: in-progress → done` with reasons; **no files touched** (RULE-8).
3. Satisfied, she clicks **⚡ Reconcile Trackers with Reality** → `{dryRun:false, backup:true}`.
4. **Climax:** The engine writes `sprint-status.yaml.bak` and `tickets.toml.bak`, updates statuses + header counters in place (comments preserved), appends to `reconciliation-log.json`, and both progress bars align to **60%**. Toast: "✅ Reconciled N keys across M file(s)!" — the tracker now matches the code, with a rollback path.

Failure: reconciliation error → "❌ Reconciliation error: <message>"; trackers untouched, `.bak` intact.

### Flow 3 — UJ-3: Devon queues an epic with token-saving gates (Devon, multi-agent orchestrator, sprint kickoff)

1. In Queue, Devon picks `epic-auth` in the epic picker and clicks **➕ Queue Epic** → `add-epic` enqueues all open stories in build order.
2. He sets the default review gate to `quick`, overrides routine stories to `none` and the token-rotation story to `thorough`, and assigns `new-provider/claude-sonnet-5-5-high` per task.
3. He chooses either **⚡ Run Queue via ZCode Workflow (.dwf.ts)** (`start-queue` compiles `.zcode/workflows/bmad-task-queue.dwf.ts` + `queue-step-updater.mjs` and sends `/workflow …`) or **🚀 Run Queue in Separate Sessions (Auto-Chain)** (`start-queue` starts only the first task with `CreateSession` + `start-task` + `sessionId`, and each finished session's `Stop` hook hands off to the next queued task).
4. **Climax:** The live-queue banner appears with a pulsing 🟢 dot; `{components.queue-active-spotlight}` shows the running story, its model, and `review=none`. As hooks or `✓ Done & Continue` / `✓ Complete Active & Continue` fire, tasks transition ⏳ → 🟢 → ✓ and story completion auto-updates in Phases & Epics — Devon watches the epic drain without babysitting each session.

Failure: empty queue → "⚠️ Queue is empty! Add tasks or an epic first."; a failed task shows ✗ FAILED and holds the queue for review (`▶ Continue Queue` / `⚡ Run Workflow` resumes once cleared).

### Flow 4 — UJ-4: Maya inspects an artifact's live diff (Maya, after an agent edited the PRD)

1. Maya opens Artifacts; the directory is sorted newest-first, the PRD row badged `M Modified`.
2. She clicks **🔀 Diff** → `bmad_inspect_artifact` loads the inspector card with the working-tree `git diff` (green additions, red deletions, accent hunks).
3. She toggles **📄 Content** to read the full preview, then back to diff.
4. **Climax:** She clicks **↗ Open File** → `bmad_open_artifact_file` launches the PRD in her desktop editor under workspace confinement (RULE-3) — from a glance at the panel to editing the real file in two clicks, no path hunting.

Failure: path outside `workspaceRoot` is rejected; load error → "Failed to load artifact: <message>" in the inspector.

### Flow 5 — UJ-5: Alex browses Skills & Agents for an ad-hoc UX or specialist check (Alex, between sprint tasks)

1. Alex opens **🧭 Skills & Agents** (`tab-catalog`), types `ux` into `#skillSearch`, and filters `#skillPhaseFilter` to `2-planning`.
2. The catalog narrows to `/bmad-ux` with its `← preceded · → followed` workflow breadcrumb, editable command `{components.cmd-textarea}`, and provider-grouped `{components.model-select}` pre-scored to the top `creative-ux` model.
3. **Climax:** Alex edits the prompt or scrolls to **👥 Specialist BMAD Agents** and clicks **🚀 New Session** on Sally (`UX Designer`), opening a clean ZCode session with the contextual prompt pre-pasted and no disruption to the current chat.

Failure: filter returns zero skills → empty skills list while specialist agent rows remain reachable below; OS launch blocked falls back to clipboard + instructional toast.
