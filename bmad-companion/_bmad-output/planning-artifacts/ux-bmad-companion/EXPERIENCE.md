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

> Information architecture, behavior, state, interaction, accessibility, and journey contract for the right-side cockpit (three tabs since 2026-11-25; the as-built v0.5.4 has five, RD-9) (`assets/panel.html`, served as `ui://bmad-companion/panel.html`). Visual tokens and component appearance live in [DESIGN.md](./DESIGN.md); this spine cross-references them as `{path.to.token}`. Spines win on any conflict with mocks or the as-built file. Code pointers were re-verified line by line against `assets/panel.html` as of commit `206e242` on 2026-11-25. Requirement ids (`FR-*`, `RULE-*`, `SM-*`, `UJ-*`) cite the [PRD](../prd-bmad-companion/prd-bmad-companion.md).

## Foundation

Single-surface desktop: a ZCode right-side MCP App iframe (`surface: "bmad-companion"`, MIME `text/html;profile=mcp-app`, CSP `unsafeEval: false`). No UI framework — bespoke vanilla HTML/CSS/JS, zero npm dependencies (RULE-1), zero external assets (RULE-7). [DESIGN.md](./DESIGN.md) is the visual identity reference; this spine is the experience.

The panel never touches disk or the OS directly. Every effect routes through the MCP stdio server (`scripts/mcp-server.mjs`, 9 tools) over the `window.parent.postMessage` JSON-RPC 2.0 bridge (`PROTOCOL_VERSION = "2026-01-26"`, panel.html:1229). `window.zcode` is banned (PRD Non-goal 2). The bridge methods used are `ui/initialize`, `tools/call`, `ui/message`, `ui/update-model-context`, plus inbound `ui/notifications/host-context-changed` (theme) and `ui/notifications/tool-result` (live state). RPC calls time out at 15000ms (panel.html:1327).

Dark is the default surface; light applies when the host reports `theme: "light"` at `ui/initialize` or via `host-context-changed` (`applyHostTheme`, panel.html:1337-1343, 1366-1371, 1395-1396). There is no in-panel theme toggle — the host owns theme.

**The panel recedes behind the conversation (owner direction, 2026-11-25).** The panel follows the system theme, as it already does. Like ZCode's own side panels, it must stay one step greyer than the conversation so the conversation keeps the focus: in dark mode the conversation is deep dark and the panel is a little grey; in light mode the conversation is the brightest surface and the panel is a light grey. The build step checks the panel canvas against ZCode's real conversation surface.

The cockpit's governing promise: **live state never costs the user their place.** The panel polls `bmad_get_state` every 5s while visible, yet a user mid-edit in a prompt textarea or model dropdown must never lose focus, cursor, keystrokes, or edits (FR-12…FR-14, RULE-9, SM-2). The [Live Polling & Form-Focus Guards](#live-polling--form-focus-guards) section is the contract that makes this true.

A second promise was added by the owner's direction of 2026-11-25: **the panel is calm and readable.** Each tab has one focal point, headings say the task in plain words, and any element the user clicks can come into focus at a larger size. The [Readability & Focus](#readability--focus) section is that contract. Its structure follows the owner's own three-tab design (Information Architecture); only the host fullscreen question (`OQ-6`) remains open for the architecture step in [ux-bmad-companion.md](./ux-bmad-companion.md).

## Information Architecture

One scrolling column, three tabs, one visible at a time. Global chrome (top bar + progress strip + banners) persists across tabs. The structure is the owner's own design, given on 2026-11-25 in the owner's words: three tabs named **Work**, **Queue** and **Project**, each with one job. It is `RD-9`, open until built — the as-built v0.5.4 still has five tabs.

| Tab | What it holds | Use it when… |
|---|---|---|
| **Work** (default) | A hero that explains the current focus in plain everyday words, the next appropriate actions at a high level (selecting one opens the action window with its details and prompt), and two collapsed disclosures at the bottom: **AI notes (N)** and **Models and providers (N)**. | You want to know what to do next, in plain words, and start it. |
| **Queue** | The queued tasks with their current options: model, review level, order, and the run controls. | You want to see or change what is lined up to run. |
| **Project** | How BMAD organizes the work: reconciliation, phases, epics and tickets, plus the recently changed files list and its diff viewer. | You want to see where the work stands and how it is structured. |
| **Global chrome** | Always: top bar (brand, AI Audit, Sync), Smart-vs-Static progress strip, live-queue banner, toast banner. | — |

**Work speaks human (owner direction).** The companion's role in Work is to communicate with the user in clean human language that hides the complexity of BMAD: no skill ids, phase codes or tracker terms on this tab. The technical wording lives in Project and inside each action's window.

**Everything can come into focus (owner direction, `RD-7`).** Each UI element in the panel, when clicked, can come into focus with a bigger font size and more details. The section expand overlay is that focus view. Decided by the owner on 2026-11-25: cards, rows and sections open it (next actions, queued tasks, epics, stories, phases and files); buttons, tabs and status labels keep their normal click.

**Removed and placed (OQ-9, decided 2026-11-25).** The owner removed both the full skills list and the specialist agents list from the panel: the companion proposes the next actions and picks the right specialist automatically in Work, with no manual catalogue to browse. Placed on 2026-11-25: the recently changed files list (and its diff viewer) lives inside **Project**, while **AI notes (N)** and **Models and providers (N)** live collapsed by default on **Work**.

Tab order is fixed: work, queue, project. Tab ids are `[ASSUMPTION]`: `work` replaces `advisor`; `queue` is unchanged; `project` replaces `progress`, `catalog` and `artifacts` as the third tab. The as-built order and ids are advisor, queue, progress, catalog, artifacts (`panel.html:990-996`). `switchTab` toggles `.active`, `aria-selected`, roving `tabindex`, `display:block/none` across the `role="tabpanel"` sections, and resets `mainScroll.scrollTop = 0` (`panel.html:3090-3107`). The tab strip is a single-row 3-column grid (`repeat(3, minmax(0, 1fr))`; as-built 5 columns, `panel.html:233-241`).

Cross-tab jumps: "Add to Queue" from an action window jumps to `queue` (as-built: `panel.html:3178, 3182`); the live-queue banner's "View Queue" (`#bannerBtnOpenQueue`) jumps to `queue` (`panel.html:1856`). Because `switchTab` resets scroll to top, cross-tab jumps always reveal the Queue controls immediately.

**Tab purpose — RD-4 (decided 2026-11-25; open until built).** The owner reported that it was unclear when to use ⚡ Next Prompts, 📊 Phases & Epics and 🧭 Skills & Agents. The three-tab structure answers it with one job per tab, stated in the "Use it when…" column, which is the single source: wherever a purpose cue appears, it repeats that sentence. Decided by the owner on 2026-11-25: each tab carries the sentence as its tooltip and accessible description, and the open tab shows it once more, directly under its heading.

**The current-focus text (decided by the owner, 2026-11-25).** The companion writes it: one or two plain sentences, based on the last three conversations, saying what was done and what matters now. It is the hero of Work; see Component Patterns.
Palette impressions are promoted to `mockups/` and listed in [ux-bmad-companion.md](./ux-bmad-companion.md#mock-coverage). They show mood only. No screen mock-up is promoted: the two made for an earlier draft showed a layout the owner did not choose and were removed. Spines win on conflict.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in [DESIGN.md](./DESIGN.md#brand--style). The panel speaks in **short verb-first action labels with an emoji prefix**, honest fallbacks, and numeric telemetry. The owner chose to keep emoji as the icon system on 2026-11-25, after seeing single-color drawn icons as a live rendering. It never invents success.

**Headings say the task — RD-3 (decided 2026-11-25; open until built).** A heading states what you do there, in plain words, with no internal jargon and no bracketed instructions. On Work the wording also hides BMAD terms (owner direction). As-built, headings name features instead. Headings for the three-tab structure, all `[ASSUMPTION]` wording; each keeps its emoji prefix, because the owner chose to keep emoji as the icon system:

| Tab | As-built heading it replaces (`panel.html`) | New heading |
|---|---|---|
| Work | 🚀 Next BMAD Prompts (Select Multiple to Queue or Launch Directly) (1026) | 🚀 What to do next |
| Work (collapsed) | 🔍 Smart Artifact + AI Cross-Check Insights (1037) | 🔍 AI notes |
| Queue | ⛓️ Multi-Task Execution Queue & Per-Task Model Orchestrator (1048) | ⛓️ Queued tasks |
| Queue | 📋 Queued & Completed Tasks (0) (1110) | (the same list, below the controls) |
| Project | 📈 Static Tracker vs. Smart AI Reconciliation (1120) | 📈 Line up your tickets with the code |
| Project | 🏛️ 4-Phase BMAD-METHOD Lifecycle (1142) | 🏛️ Phases |
| Project | 📦 Epics & Stories Progress Explorer (1151) | 📦 Epics and tickets |
| Removed (owner, 2026-11-25) | 🛠️ Contextual BMAD Skills Launcher (New Session + Model) (1180) | (no heading: the skills list leaves the panel) |
| Removed (owner, 2026-11-25) | 👥 Specialist BMAD Agents (1185) | (no heading: removed with the skills list) |
| Project | 🕒 Workspace BMAD Artifacts (Ordered by Last Modified) (1211) | 🕒 Recently changed files |

The as-built column is what ships today.

| Do (as-built voice) | Don't |
|---|---|
| `🚀 Launch in New Session` / `➕ Add to Queue` / `💬 Run Here` / `📎 Attach` / `📋 Copy` | Bare skill names (`/bmad-ux`) without a contextual prompt (RULE-2) |
| `📋 Prompt copied! Press Ctrl+N then Ctrl+V (Model: …)` when OS automation is blocked | Claiming a session opened when it did not |
| `✓ All tracker files are already 100% synchronized with code reality! No changes needed.` | A generic "Success" toast with no counts |
| `Smart AI Progress (60% vs 30% static tracker)` | Hiding the static-vs-smart gap behind one number |
| `Your BMAD Execution Queue is Empty` + how to fill it | A blank list with no next step |
| `❌ Queue action failed: <message>` / `❌ Reconciliation error: <message>` | Swallowing errors silently |
| Counts and ids: `3/10 stories`, `Story 2.1`, `review=none` | Vague qualifiers ("some", "several") |

Every recommendation renders as `/bmad-<skill> "<workspace-specific prompt>"` paired with a `providerId/modelId` (RULE-2, SM-1). Toasts auto-dismiss after 4000ms (`panel.html:1520`), always name the model or the next manual step, and shift to semantic error (`.is-error`, `role="alert"`, `aria-live="assertive"` — triggered only on explicit error/failure prefixes or `error:`/`failed to` phrasing, not recovery toasts referencing failed tasks) or warning (`.is-warning`) styling when appropriate.

## Component Patterns

Behavioral. Visual specs live in [DESIGN.md.Components](./DESIGN.md#components).

| Component | Use | Behavioral rules |
|---|---|---|
| **Recommendation card** (`{components.rec-card}`) | Work | Editable `{components.cmd-textarea}` command + `{components.model-select}` model. Edits persist in `userEditedPrompts`/`userSelectedModels` keyed `rec:<skill>:<title>` while the server base is unchanged (FR-14). `{components.queue-checkbox}` adds to a multi-select set; `☑️ Select All` toggles to `☐ Deselect All` when all are checked, and `➕ Add Checked (N) to Queue` displays the live selection count before enqueuing all checked with their chosen models and jumping to Queue. Actions read the *live* textarea/select values, not the server base. Five actions: Add to Queue (or "↻ Update in Queue" / "↻ Re-queue" if already queued/done), Launch in New Session, Run Here, Attach, Copy. Decided 2026-11-25 (RD-8 — open, not as-built): only Launch in New Session and Add to Queue stay immediately visible; Run Here, Attach and Copy move behind a **More actions (3)** disclosure (`[ASSUMPTION]` label). In Work (owner direction, RD-9) the card becomes a high-level action: a plain title and a one-line reason, without jargon; selecting it opens the **action window**. |
| **Action window** (`{components.action-dialog}`) | Work (RD-9 — open; owner direction) | Opens when the user selects a next action. It shows the action's details and its prompt. `[ASSUMPTION]` on content: a plain title, a short "why now" in everyday words, the editable `{components.cmd-textarea}` prompt with the `{components.model-select}`, Launch in New Session and Add to Queue as primary actions, **More actions (3)** for Run Here, Attach and Copy, and a small "Technical details" line naming the skill and phase for those who want them. It is a modal dialog: `role="dialog"`, `aria-modal="true"`, focus moves in on open, ✕ or `Escape` closes it, and focus returns to the action that opened it. Edits made inside are the same stored values as today's card (`userEditedPrompts` / `userSelectedModels`). |
| **Current-focus hero** (`{components.focus-hero}`) | Work (RD-9 — open; owner direction) | The first thing on Work. The companion writes it after each step: one or two plain sentences, based on the last three conversations, saying what was done and what matters now, with no BMAD terms. A small line under it reads `"Current focus"` (decided by the owner on 2026-11-25, replacing `"Based on your last three conversations"`; the conversation count remains tracked in state). The next actions are listed below it. `[ASSUMPTION]` Its text updates with the rest of the panel state, behind the same polling guard. |
| **Model select** (`{components.model-select}`) | Work, Queue | Options grouped into `<optgroup>` sections by `providerName` (`panel.html:1622-1654`). Each `<option>` shows `🤖 <modelId> · <N>k · $/$$/$$$` with `· ⛔ rate-limited` (sorted to the bottom of its provider group) and `★ Recommended` on the top-scored model. |
| **Catalog skill card** | Removed (owner, 2026-11-25) | Kept here as the as-built record. Same editable command/model pattern keyed `skill:<skill>` (including the associated `<label class="cmd-label">` header row); shows preceded/followed workflow breadcrumbs and actions Add to Queue / Launch in New Session / Run Here / Copy. Search + phase filter re-render via signature diff; empty matches render an `.empty-state-card`. |
| **Agent row** | Removed (owner, 2026-11-25) | Kept here as the as-built record (removed with the skills list; the companion picks the right specialist automatically in Work). Used `.agent-card` (`padding: 9px 11px`) with one "🚀 New Session" action launching a greeting prompt addressed to the agent by name/title/focus with its scored model. |
| **Queue control bar** | Queue | Default review gate select (`none`/`quick`/`thorough`, applies to all on change), epic quick-enqueue picker + `➕ Queue Epic`, and seven execution controls: `⚡ Run Queue via ZCode Workflow (.dwf.ts)`, `🚀 Run Queue in Separate Sessions (Auto-Chain)` (starts only the first queued task with `CreateSession` + `start-task` + `sessionId`, then the `Stop` hook auto-chains subsequent tasks), `✓ Complete Active & Continue` (marks active/first-queued done and auto-continues if queued items remain), `⏸ Pause`, `↻ Retry Failed (N)` (visible whenever failed items exist), `🧹 Clear Done`, `🗑️ Clear All`. |
| **Queue item card** (`{components.queue-item-card}`) | Queue | Per-task model select and review-gate select (`none`/`quick`/`thorough`) commit immediately via `bmad_queue_manage({action:"update-item"})`. Reorder via ↑/↓ buttons (no drag). "🟢 Set Active" (shown when not active/failed) → `start-task`; "↻ Retry / Re-queue" (shown on failed items) → `retry-failed`; "✓ Mark Done" (disabled once done) → `complete-task` with `storyStatus:"done"` (advances queue + reconciles story); "🚀 New Session" → `start-task` then launch; "✕" (with `aria-label`) → `remove`. Status pill: ⏳ IN QUEUE #n / 🟢 ACTIVE (pulse) / ✓ DONE / ✗ FAILED (with `⚠️ Failure:` diagnostic box). |
| **Active-task spotlight** (`{components.queue-active-spotlight}`) | Queue | Renders only when `taskQueue.activeTask` exists: pulse dot, model + review pills, title, and the shaped `effectivePrompt` in a mono `.queue-prompt-inset`. |
| **Phase progress list** (as-built `{components.phase-card}`) | Project | Under RD-9 (`[ASSUMPTION]`, open until built) Project shows a compact flat list (not behind an accordion): phase name, done state and percentage, with each phase's file chips inline below it. The as-built card is different (`panel.html:2415-2529`): a native `<button type="button" class="phase-summary-row" aria-expanded>` toggles expand/collapse (`expandedPhases` Set). First render auto-expands incomplete phases (`panel.html:1681-1688`). Its body lists `<button>` artifact chips: main label → jump to the Artifacts diff (as-built; under RD-9 both phase chips and the changed-files inspector live in Project); `↗` → open externally. Expand All / Collapse All buttons. |
| **Epic box / story row** (`{components.epic-box}`) | Project | Native `<button type="button" class="epic-toggle-btn" aria-expanded>` toggles expand (`expandedEpics`) beside the sibling `➕ Queue Epic` button; first render auto-expands up to 2 open epics (`panel.html:1689-1694`). Search/status filter forces expansion of matches. Story row shows smart status pill, ✨ AI badge + evidence when reconciled, recommended-model pill, and Queue Story / New Session actions. Done stories offer `/bmad-code-review`; open stories offer `/bmad-build-auto` with the story's verify command. "➕ Queue Epic" enqueues all open stories in build order. |
| **Files by phase** (as-built: the phase cards' chip lists) | Project | Under RD-9 (`[ASSUMPTION]`, open until built) each phase's file chips live here, under the phase's name and done state. A chip loads its diff in the inspector in Project; `↗` opens externally. As-built the chips sit in the phase cards and call `switchTab("artifacts")` first (`panel.html:2513-2519`). |
| **Reconciliation card & diff** (`{components.reconciliation-diff-card}`) | Project | "🔍 Preview Diff" → `bmad_reconcile_trackers({dryRun:true})`; "⚡ Reconcile Trackers with Reality" → `{dryRun:false, target:"all", backup:true}`. Result renders `#reconciliationDiffCard` (`.reconciliation-diff-card`) listing `key: oldStatus → newStatus` + reason per change; live run then re-renders state. ✕ Close hides the card. |
| **File row + inspector** (`{components.artifact-preview}`) | Project (decided 2026-11-25) | As-built: the Artifacts tab; placed in **Project** under RD-9. Directory sorted strictly by `mtimeMs` descending; search filters path/name/kind/phase/gitStatus (empty matches show `.empty-state-card`). Keyboard-operable `<button class="art-row-btn">` (underlined path hover cue) or "🔀 Diff" → `bmad_inspect_artifact` then inspector card. Inspector toggles Git Diff ↔ Content (active toggle gets `{components.button-purple}` and `aria-pressed="true"`), "↗ Open File" → `bmad_open_artifact_file`, "🚀 Review" → launches `/bmad-review "<artifact>"` in a new session, and "✕ Close" dismisses the inspector. |
| **Progress strip** (`{components.progress-strip}`) | Global | Headline always shows smart % vs static %; mono numbers `done/total (pct)`; `{components.dual-bar}` width animates to smart %. |
| **Live-queue banner** (`{components.live-queue-banner}`) | Global | Visible whenever `taskQueue.items.length > 0`; shows active (`pill-success`), paused (`⏸ PAUSED`, `pill-warning`), queued (`pill-accent`), complete (`pill-success`), or failed (`pill-danger`) pill, embedded 4px progress bar, `✓ Done & Continue` (when active, completes + continues in current `executionMode`), `▶ Continue Queue` / `⚡ Run Workflow` (when queued items wait), or `↻ Retry Failed` (when failed items exist), and `⛓️ View Queue` (`panel.html:1802-1856`). |
| **Toast** (`{components.toast-banner}`) | Global | `showToast(msg)` sets text, applies `.is-error` (`role="alert"`, `aria-live="assertive"`) or `.is-warning` (`⚠️`/`ℹ️`) or default success (`role="status"`, `aria-live="polite"`), adds `.visible`, and auto-hides after 4000ms (`panel.html:1507-1521`); successive toasts reset the timer. |
| **AI notes disclosure** (turn-analysis box + cross-check insights) | Work (collapsed; decided 2026-11-25) | Decided 2026-11-25 (RD-8, OQ-9 — open, not as-built): placed on **Work**, collapsed by default behind an **AI notes (N)** disclosure (`[ASSUMPTION]` label), where N is the number of insights, so new notes are noticeable without crowding the focal actions. |
| **Provider state bar** | Work (collapsed; decided 2026-11-25) | Pills for active providers (model counts), subscription selections, and a runtime-synced vs dynamic-config badge; signature-diffed (`panel.html:1701-1716`). Decided 2026-11-25 (RD-8, OQ-9 — open, not as-built): placed on **Work**, collapsed by default behind a **Models and providers (N)** disclosure (`[ASSUMPTION]` label), where N is the number of active providers. |
| **Disclosure header** (Models and providers, AI notes, More actions) | Work, action window (RD-8 — open) | RD-8 — open, not as-built. A native `<button aria-expanded>` in the weight of a default button, collapsed by default, its label ending in a count so hidden content stays noticeable. `[ASSUMPTION]` Stays open for the session in memory, like the phase and epic accordions; not persisted across panel reloads. |
| **Section expand overlay** (`{components.section-overlay}`) | Every tab (RD-7 — open, user-requested) | Every focusable card, row and section — next actions, queued tasks and the active-task spotlight, epics, stories, phases, files and reconciliation diffs — opens the focus view when clicked (or via its **⤢ Expand** button), while buttons, tabs and status labels keep their normal click. Open: the section renders over a dimmed backdrop at the overlay type roles (`16 / 15 / 14.5 / 13.5px`), the main scroll is locked, focus moves to the overlay heading, and the dialog is announced (`role="dialog"`, `aria-modal="true"`, labeled by the section heading). Inside, controls stay live: edits made in an overlay command box or model select write directly to the same stored values (`userEditedPrompts` / `userSelectedModels`), never a copy. Close: ✕ or `Escape`; focus returns to the element that opened it, and the card underneath shows any changes. `[ASSUMPTION]` Only one overlay is open at a time, and switching tabs closes it. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | Global | Subtitle "Scanning workspace BMAD artifacts…"; turn box "Analyzing workspace state…"; progress 0/0. `initMcpApp` → `ui/initialize` → first `refreshState`. |
| RPC / scan failure | Global | Subtitle becomes "Ready · Click Sync or run bmad_open_companion" (`panel.html:1670-1673`). No crash, no blank panel. |
| No recommendations | Work | `.empty-state-card`: "No recommendations yet. Click ↻ Sync to analyze workspace." |
| Empty queue | Queue | Centered `.empty-state-card`: "Your BMAD Execution Queue is Empty" + how to enqueue from Work / Project. |
| No story matches / no epics | Project | `.empty-state-card`: distinguishes empty workspace ("No epics or stories found yet…") from filter miss ("No matching stories found…"). |
| No file matches | Project | `.empty-state-card` explaining how to clear search/phase filters or generate artifacts. |
| Phase with no files | Project | "No artifacts generated in this phase yet." |
| File loading | Project | "Loading artifact diff & content…" then diff/content; failure → "Failed to load artifact: <message>". |
| Reconciliation dry-run | Project | Diff card titled "🔍 Dry Run Preview (N keys across M file(s))"; **no disk writes** (RULE-8). |
| Reconciliation live | Project | "✅ Reconciled N keys across M file(s)!" + success toast; `.bak` backups written before mutation (RULE-8, FR-11); state re-rendered. |
| Nothing to reconcile | Project | "✓ All tracker files are already 100% synchronized…". |
| Queue idle / running / paused / completed | Queue + global | Status badge `IDLE/RUNNING/PAUSED/COMPLETED · done/total Done · queued Queued`; running shows pulse + live banner; paused shows `⏸ PAUSED` (`pill-warning`) in live banner; completed shows `✓ QUEUE COMPLETE` or `⚠️ QUEUE FINISHED (N FAILED)` with `↻ Retry Failed`. |
| Task queued/running/done/failed | Queue item | ⏳ / 🟢 (pulse, `.is-active`) / ✓ (`.is-done`, dimmed) / ✗ (`.is-failed`, danger border + `⚠️ Failure:` detail + `↻ Retry / Re-queue`) pills. |
| Rate-limited model | Model select | Tagged `· ⛔ rate-limited`, sorted to the bottom of its provider `<optgroup>`, and skipped by auto-scoring when a healthy alternative exists (`panel.html:1640-1652`). |
| OS launch blocked | Global toast | Clipboard fallback: "📋 Prompt copied! Press Ctrl+N then Ctrl+V" (FR-4 graceful degradation). |
| Background poll while editing | Any tab | State stashed in `pendingWorkspaceState`; **no re-render** until focus leaves (see Guards). |
| Hidden panel | Global | 5s interval skips (`document.hidden`); resumes on visibility. |
| Host theme change | Global | `body.theme-light` added/removed; tokens swap instantly, no reload. |
| Section overlay closed | Any view | Default. Each expandable section shows **⤢ Expand** in its header (RD-7 — open). |
| Section overlay open | Any view (RD-7 — open) | Backdrop dims the panel; one section at reading size; main scroll locked; focus inside; ✕ and `Escape` close. |
| Background poll while the overlay is open | Any view (RD-7 — open) | Treated as "user is interacting": state is stashed in `pendingWorkspaceState` and **the open section is never replaced** from a background update. |
| Section gone while its overlay is open | Any view (RD-7 — open) | `[ASSUMPTION]` The overlay closes with the toast "That item is no longer available" and focus returns to the heading of the tab. |
| Disclosure collapsed | Work, action window (RD-8 — open) | Default for the three decided blocks: models and providers, AI notes, more actions. Each header shows a count. |
| Disclosure expanded | Work, action window (RD-8 — open) | `[ASSUMPTION]` Stays open for the session, in memory, like the phase and epic accordions; not persisted across panel reloads (the panel has no settings storage). |

## Live Polling & Form-Focus Guards

The product-specific contract that realizes FR-12…FR-14, RULE-9, and SM-2 (**0 dropped keystrokes / focus losses / lost edits**; deferred flush ≤100ms). All references are `assets/panel.html`.

**Poll loop.** `setInterval(…, 5000)` fires only when `!document.hidden` and `document.visibilityState === "visible"`, calling `refreshState({isBackground:true})` (`panel.html:3326-3330`). `refreshState` is serialized by an `isRefreshing` lock — overlapping polls return immediately (`panel.html:1656-1676`). Each poll calls `bmad_get_state({refresh:true})`.

**Guard predicate.** `isUserInteractingWithForm()` returns true when either (a) `Date.now() < selectOpenUntil`, or (b) `document.activeElement` is a `TEXTAREA` or `INPUT` (`panel.html:1258-1262`). A focused `SELECT` is covered by the time window, not the tag check.

**Overlay (RD-7 — open, not as-built).** When the section expand overlay ships, an open overlay must count as interacting — a third clause in the guard predicate — because a background re-render would otherwise replace the very section the user is reading.

**Select window (`selectOpenUntil`).** Set to `now + 15000ms` on `pointerdown` on any `select` (capture) and on `Space`/`Enter`/`ArrowDown`/`ArrowUp` while a select is focused (`panel.html:1271-1297`). Cleared to 0 on `Escape`, `Tab`, `change`, or `focusout` of a select. The 15s window keeps a dropdown "open" for guard purposes even though the native popup may close sooner.

**Suppression + stash.** While guarded:
- A background poll skips the fetch entirely if the guard is already true at entry (`panel.html:1659`); if the guard becomes true mid-flight, the result is stashed in `pendingWorkspaceState` instead of rendered (`panel.html:1664-1665`).
- An inbound `ui/notifications/tool-result` carrying `structuredContent.metrics` is stashed when guarded, rendered when not; a tool-result *without* metrics triggers a background refresh (`panel.html:1373-1383`).

**Flush.** `flushPendingState()` renders the stashed state only if the guard has cleared, then nulls the stash (`panel.html:1264-1269`). Triggers: `focusout` of SELECT/TEXTAREA/INPUT → `setTimeout(flush, 50)`; select `change` / `Escape` / `Tab` → `setTimeout(flush, 0)` (`panel.html:1285-1317`). The 50ms focusout delay is within the ≤100ms SM-2 budget.

**Edit preservation.** `userEditedPrompts` and `userSelectedModels` (Maps) store `{base, value}` keyed `rec:<skill>:<title>` or `skill:<skill>` (`panel.html:1240-1241, 1572-1585`). On render, `resolveUserPrompt` returns the user's value while `base === serverCmd`, and **drops** the edit when the server base changes (`panel.html:1600-1605`). `resolveUserModel` likewise drops when the base model changes or the chosen model is no longer in `availableModels` (`panel.html:1607-1620`). This is why a poll that returns the *same* recommendation never clobbers an in-progress edit, but a genuinely new recommendation resets it.

**Signature diffing.** `lastSectionSignatures` holds a JSON signature per section — `providerBar`, `recommendations`, `insights`, `phases`, `epics`, `skillsCatalog`, `agentsCatalog`, `artifacts`, `taskQueue` (`panel.html:1243-1253`). Each render function calls `sectionNeedsRender()` (`panel.html:1537-1541`) and returns early when unchanged, so `innerHTML` is only replaced when data actually differs. The recommendations signature includes checked indices and queue item status so checkbox toggles and queue changes refresh correctly.

**Guard scope (important).** The guard governs *background* updates (polls + unsolicited tool-result notifications). Responses to **explicit user actions** (`manageQueue`, reconciliation, artifact load) render immediately via `renderWorkspaceState` even if a control is focused (`panel.html:1753-1765`) — the user asked for that change, so the re-render is expected. Changing a queue select, for example, commits then re-renders the queue list.

**Invariants.** Never replace `innerHTML` unconditionally on a poll; never drop `userEditedPrompts`/`userSelectedModels`/`lastSectionSignatures` when touching UI state (AGENTS.md); never render a stashed payload while the guard is true. Never replace the content of an open section overlay from a background update (RD-7).

## Readability & Focus

Added 2026-11-25 from the owner's direction: the interface feels cluttered, its colors are too bright, nothing tells the user where to focus, and the text is small. Its principles are binding, and its structure follows the owner's own three-tab design (Work, Queue, Project). Visual counterparts live in [DESIGN.md](./DESIGN.md): Colors (Palette C), Typography (closed ramp, base size) and Components (icons, tabs, disclosures, section expand overlay, action window, focus hero).

**Principles (binding).**
1. **One focal point per tab.** Exactly one element in the active tab carries the accent; everything else is ink and surface.
2. **Nothing competes with the focal point.** `[ASSUMPTION]` At most two semantic hues are visible inside any one card, and status is always written in words.
3. **Headings say the task.** Plain words, no jargon (RD-3; table in Voice and Tone).
4. **Every tab states its job.** In the "Use it when…" wording of the IA table (RD-4).
5. **Anything can come into focus.** Any element the user clicks can open in the focus view, with bigger text and more details (RD-7: cards, rows and sections, decided by the owner).

**Focal point per tab `[ASSUMPTION]`** — to be confirmed:

| Tab | The one element that carries the accent | Everything else |
|---|---|---|
| **Work** | The first next action under the hero | The hero itself, the other actions |
| **Queue** | The active task (spotlight) | Control bar, queued and done items |
| **Project** | The Reconcile action when trackers disagree; otherwise nothing | Phases, epics and tickets |

**Clutter — RD-8 (decided 2026-11-25; open until built).** The owner chose three blocks to hide by default: the provider state bar, the AI turn-analysis box with the cross-check insights, and the secondary card actions (Run Here, Attach, Copy). Each moves behind a disclosure whose label carries a count, so nothing hides silently; the rules are in Component Patterns. Two other candidates were offered and not chosen, so they stay as they are: the seven queue execution buttons, and the per-item model and review selects.

**Base text size — RD-6 (decided by the owner 2026-11-25; open until built).** The full rise: normal text goes from 12.5px to 14px, nothing inside the panel stays below 12px, and the focus view adds one more step for reading (16 / 15 / 14.5 / 13.5px). The focus view was the owner's idea; the owner then chose the full rise over a moderate one. Values live in DESIGN.md → Typography.

## Interaction Primitives

- **Click & keyboard to act.** Every interactive target — including tabs, disclosure headers (RD-8), the as-built Phase/Epic accordion toggles (`<button type="button" aria-expanded>`), artifact chips, and directory rows (`<button class="art-row-btn">`) — is a native button or form control. Sibling actions sit beside Epic toggles without nesting interactive elements.
- **Keyboard.** Native `Tab` traversal across buttons/inputs/selects/textareas; native `Enter`/`Space` activation; ARIA `tablist` arrow-key (`ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End`) navigation with wrapping across all tabs (as-built five,`panel.html:3109-3134`). Select keyboard navigation extends the guard window; `Escape`/`Tab` commit and flush. **No global cross-panel hotkeys** are defined as-built (no command palette) — tracked as an optional enhancement, not a regression.
- **Expand a section (RD-7 — open).** Clicking a focusable card/row or its **⤢ Expand** button opens the Section expand overlay; ✕ or `Escape` closes it; focus moves to the overlay heading on open and returns to the element that opened it on close; `Tab` stays inside the overlay while it is open.
- **Reorder without drag.** Queue ordering uses ↑/↓ buttons (`reorder`), never drag-and-drop (`panel.html:2036-2037, 2077-2085`).
- **Editing.** Command textareas resize vertically; edits are local until an action reads them. Model selects commit on `change`.
- **Search/filter.** Text inputs re-render their list on `input`; status/phase selects on `change` (`panel.html:3272-3276`). Filtering is client-side over the current state.
- **Launch semantics.** "Launch in New Session" pre-pastes into a *fresh* session and never auto-submits in the current one (SM-4 counter-metric: zero unconfirmed auto-submissions). "Run Here" sends to the current session via `ui/message`; "Attach" adds context via `ui/update-model-context`; "Copy" uses `navigator.clipboard` with an `execCommand` fallback (`panel.html:1493-1504`).
- **Banned everywhere:** `eval()` / `window.zcode` / external CDNs (RULE-7); unconditional poll re-render (DEC-3); silent tracker mutation during a scan (DEC-4); bare skill-name recommendations (RULE-2); auto-submitting a launched prompt; infinite scroll; drag-to-reorder.

## Accessibility Floor

Behavioral. Visual contrast lives in [DESIGN.md.Colors](./DESIGN.md#colors) (measured ratios + closed debt CD-1…CD-5).

**Contract.**
- WCAG 2.2 AA: essential text ≥4.5:1, focus indicators ≥3:1, both themes (DESIGN.md contrast table).
- Every interactive element keyboard-operable via native `<button>`/`<input>`/`<select>`/`<textarea>`; `Tab` order follows reading order; a visible focus indicator on every focusable control.
- Status conveyed by text + color, never color alone (pills carry words; diff carries +/− semantics via line content; toasts shift icon + semantic color + ARIA live priority).
- Live updates (toasts, queue status, progress) announced to assistive tech.
- Motion respects `prefers-reduced-motion`.
- Any overlay dialog (section expand overlay, RD-7 — open): `role="dialog"`, `aria-modal="true"`, labeled by its section heading, focus moved in on open and returned on close, `Escape` closes.
- The action window (RD-9 — open): the same dialog rules, labeled by the action's title; focus moves in on open and returns on close; `Escape` closes.
- Every disclosure that hides content by default (RD-8 — open): a native button with `aria-expanded`, a visible count in its label, and the same visual weight whether open or closed.
- Each tab's purpose sentence is its accessible description, so the cue is never visual-only (RD-4 — open).
- When the tab count changes from five to three (RD-9), the AD-2 tab semantics are re-verified on the new tablist before the change ships.

**Verified implementation (AD-1…AD-6 closed in `assets/panel.html` & `tests/panel-a11y.test.mjs`):**
- **AD-1 — Visible textarea & control focus.** `.cmd-textarea:focus` and `:focus-visible` declare `2px solid var(--accent)` outline plus `.cmd-editor-wrap:focus-within` border highlight (`panel.html:460-469`); `.model-select` and `.search-input` pair border swaps with `1px` box-shadow rings on `:focus-visible`.
- **AD-2 — Full ARIA tab & landmark semantics.** `<header role="banner">`, `<main role="main">`, `<nav id="tabsNav" role="tablist">`, `<button role="tab" aria-selected aria-controls>` with roving `tabindex` (`0`/`-1`) + `handleTabKeydown` arrow/Home/End navigation, `<section role="tabpanel" aria-labelledby tabindex="0">`, `aria-pressed` on inspector Diff/Content mode toggles, plus `<button aria-expanded>` on Phase & Epic accordions (`panel.html:960-1223, 2415-2706, 3090-3134`).
- **AD-3 — Announced toasts.** `#toastBanner` declares `role="status" aria-live="polite" aria-atomic="true"`, switching to `role="alert" aria-live="assertive"` on errors (`panel.html:1002, 1507-1521`).
- **AD-4 — Associated labels.** `<label for="queueDefaultReviewSelect">`, `<label for="queueEpicPicker">`, `<label class="cmd-label" for="rec-cmd-${idx}">`, `<label class="cmd-label" for="cat-cmd-${idx}">`, `<label for="q-model-${idx}">`, `<label for="q-review-${idx}">`, and `aria-label` on filter controls and icon-only remove buttons (`panel.html:1056-1218, 2008-2015, 2236, 2775`).
- **AD-5 — Reduced motion.** `@media (prefers-reduced-motion: reduce)` disables `.pulse-dot` animation/box-shadow and transitions on `.bar-smart`, `.btn`, and `.queue-item-card` (`panel.html:879-893`).
- **AD-6 — Contrast debt.** Closed: DESIGN.md CD-1…CD-5 closed to full WCAG AA (essential text ≥4.5:1, focus indicators ≥3:1 in both themes).

**Open against this contract — found in the audit of 2026-11-25, not selected for this update (parked in [ux-bmad-companion.md](./ux-bmad-companion.md#parked-findings)):**
- The "queue status announced" clause above is met only for toasts: the toast banner is the panel's single live region, so a task finishing, failing, or the next one starting is silent for assistive technology.
- Keyboard focus is not restored after an explicit-action re-render: the file's only focus call serves the tab strip, so after a queue action the focused button is destroyed and focus drops to the document.
- The failed-scan subtitle reads "Ready · Click Sync or run bmad_open_companion", which conflicts with the Voice rule "It never invents success".

## Responsive & Platform

Single surface, fluid narrow column. No breakpoints; the panel adapts by truncation (`text-overflow:ellipsis` on titles/paths) and `flex-wrap:wrap` on action/filter rows, not by reflowing into different layouts. `ui/initialize` declares `availableDisplayModes: ["inline","fullscreen"]` (`panel.html:1390-1392`); the layout is column-first in both. Nothing in the panel requests that mode as-built; whether ZCode can present the panel larger — which would give the section expand overlay more room — is an open question for architecture (OQ-6).

Platform-specific behavior is confined to **clean-session launch** (`bmad_prepare_new_session`, FR-4): win32 PowerShell `SendKeys` `^n`+`^v`, darwin `pbcopy`+`osascript`, linux `wl-copy`/`xclip`/`xsel`+`xdotool`. When synthetic keystrokes are blocked, the panel falls back to clipboard copy with an instructional toast (A-2). Artifact "Open File" uses `cmd /c start` / `open` / `xdg-open` under workspace path confinement (RULE-3). Theme follows the host on every platform.

## Inspiration & Anti-patterns

- **Lifted from GitHub Primer (until v0.5.4):** the entire dark/light primitive palette (`#0d1117`/`#161b22`/`#30363d`/`#388bfd`… and their light inverses) so the cockpit reads as native developer tooling. Superseded on 2026-11-25 by Palette C — Warm charcoal, chosen by the owner because the Primer colors felt too bright. Semantic pill vocabulary (success/warning/danger/purple) mirrors Primer labels.
- **Lifted from IDE instrument panels:** dense mono metadata, inset command editors, status pills, and a single accent for "launchable." Telemetry over decoration.
- **Lifted from the sibling Vibe Debrief cockpit:** the host-driven dark/light token swap and the "spines win on conflict" discipline.
- **Rejected — `window.zcode` bridge:** the panel uses only the MCP Apps `postMessage` JSON-RPC bridge (PRD Non-goal 2).
- **Rejected — unconditional `innerHTML` re-render / WebSocket push:** 5s polling + form guards + signature diffing instead (DEC-3). A live socket would still need the same focus guards; polling is simpler and zero-dependency.
- **Rejected — silent tracker mutation during scans:** Smart progress is computed in memory; disk writes happen only on explicit Reconcile with `.bak` backups (DEC-4, RULE-8).
- **Rejected — gamification:** no streaks, badges-for-points, or celebratory animation. The pulse dot means "a task is literally running," not achievement.
- **Rejected — auto-submit:** launching pre-pastes a prompt; the user presses send (SM-4).
- **Rejected by the owner (2026-11-25):** vivid colors competing for attention, and a view in which every block is visible at once — the panel must read calm, with one focal point. Palette options A (Muted) and B (Quiet) were not chosen.
- **Decided by the owner (2026-11-25):** merge and reorder the tabs so that each has one useful purpose (RD-9). The owner then designed the structure: Work, Queue, Project.
- **Rejected by the owner (2026-11-25):** single-color drawn icons in place of emoji, shown as a live rendering; the four-tab layout the facilitator had drafted; every other offered tab layout.

## Key Flows

Journeys mirror the PRD's `UJ-1`…`UJ-4` and named protagonists verbatim; `UJ-5` (Flow 5) was withdrawn on 2026-11-25 along with the skills and specialist agents lists and is kept below as the as-built record. Flows 6 and 7 were added on 2026-11-25 from the owner's readability direction. Tab names in every flow follow the owner's three-tab structure (RD-9).

### Flow 1 — UJ-1: Alex edits a prompt mid-poll and launches a clean session (Alex, solo vibe-coder, just finished a Product Brief)

1. The `Stop` hook updates state; the panel's Work tab lists three next actions under its hero, top one `/bmad-prd "Create the comprehensive Product Requirements Document…"` paired with `new-provider/claude-opus-5-5-high`.
2. Alex selects the top action. The **action window** opens with its details and its prompt. Alex edits the `{components.cmd-textarea}` prompt to add a constraint, then opens the provider-grouped `{components.model-select}` (checking cost tier `$`/`$$`/`$$$` and avoiding any `⛔ rate-limited` entry).
3. While Alex types, the 5s timer fires `bmad_get_state`. `isUserInteractingWithForm()` sees the focused textarea (and the select window), so the poll stashes `pendingWorkspaceState` — **no re-render, cursor intact**.
4. Alex blurs the control; `focusout` schedules `flushPendingState()` (50ms), which renders the stashed state. Because the server base command is unchanged, `resolveUserPrompt` keeps Alex's edited text and chosen model.
5. **Climax:** Alex clicks **🚀 Launch in New Session**. `bmad_prepare_new_session` copies the *edited* prompt, dispatches `Ctrl/Cmd+N` + `Ctrl/Cmd+V`, and a fresh ZCode session opens with Alex's exact command pre-pasted — the edit survived every poll, and nothing ran in the old session.

Failure: OS keystrokes blocked → toast "📋 Prompt copied! Press Ctrl+N then Ctrl+V (Model: …)"; the edit is still on the clipboard.

### Flow 2 — UJ-2: Maya reconciles drifting trackers (Maya, tech lead, three stories secretly done)

1. Maya opens Project. The strip reads **Smart AI Progress 60% (6/10)** vs **static tracker 30% (3/10)**; three stories show ✨ AI badges with evidence.
2. She clicks **🔍 Preview Diff** → `bmad_reconcile_trackers({dryRun:true})`. `{components.reconciliation-diff-card}` lists `key: in-progress → done` with reasons; **no files touched** (RULE-8).
3. Satisfied, she clicks **⚡ Reconcile Trackers with Reality** → `{dryRun:false, backup:true}`.
4. **Climax:** The engine writes `sprint-status.yaml.bak` and `tickets.toml.bak`, updates statuses + header counters in place (comments preserved), appends to `reconciliation-log.json`, and both progress bars align to **60%**. Toast: "✅ Reconciled N keys across M file(s)!" — the tracker now matches the code, with a rollback path.

Failure: reconciliation error → "❌ Reconciliation error: <message>"; trackers untouched, `.bak` intact.

### Flow 3 — UJ-3: Devon queues an epic with token-saving gates (Devon, multi-agent orchestrator, sprint kickoff)

1. In Queue, Devon picks `epic-auth` in the epic picker and clicks **➕ Queue Epic** → `add-epic` enqueues all open stories in build order.
2. He sets the default review gate to `quick`, overrides routine stories to `none` and the token-rotation story to `thorough`, and assigns `new-provider/claude-sonnet-5-5-high` per task.
3. He chooses either **⚡ Run Queue via ZCode Workflow (.dwf.ts)** (`start-queue` compiles `.zcode/workflows/bmad-task-queue.dwf.ts` + `queue-step-updater.mjs` and sends `/workflow …`) or **🚀 Run Queue in Separate Sessions (Auto-Chain)** (`start-queue` starts only the first task with `CreateSession` + `start-task` + `sessionId`, and each finished session's `Stop` hook hands off to the next queued task).
4. **Climax:** The live-queue banner appears with a pulsing 🟢 dot; `{components.queue-active-spotlight}` shows the running story, its model, and `review=none`. As hooks or `✓ Done & Continue` / `✓ Complete Active & Continue` fire, tasks transition ⏳ → 🟢 → ✓ and story completion auto-updates in Project — Devon watches the epic drain without babysitting each session.

Failure: empty queue → "⚠️ Queue is empty! Add tasks or an epic first."; a failed task shows ✗ FAILED and holds the queue for review (`▶ Continue Queue` / `⚡ Run Workflow` resumes once cleared).

### Flow 4 — UJ-4: Maya inspects an artifact's live diff (Maya, after an agent edited the PRD)

1. Maya opens **Project** and scrolls to **🕒 Recently changed files**; the directory is sorted newest-first, the PRD row badged `M Modified`.
2. She clicks **🔀 Diff** → `bmad_inspect_artifact` loads the inspector card with the working-tree `git diff` (green additions, red deletions, accent hunks).
3. She toggles **📄 Content** to read the full preview, then back to diff.
4. **Climax:** She clicks **↗ Open File** → `bmad_open_artifact_file` launches the PRD in her desktop editor under workspace confinement (RULE-3) — from a glance at the panel to editing the real file in two clicks, no path hunting.

Failure: path outside `workspaceRoot` is rejected; load error → "Failed to load artifact: <message>" in the inspector.

### Flow 5 — UJ-5: Alex runs a skill from the catalogue (Alex, between sprint tasks; withdrawn 2026-11-25 with the skills and specialist agents lists, kept as the as-built record)

1. Alex opens the skill list, types `ux` into the search box, and filters the phase to `2-planning`.
2. The catalog narrows to `/bmad-ux` with its `← preceded · → followed` workflow breadcrumb, editable command `{components.cmd-textarea}`, and provider-grouped `{components.model-select}` pre-scored to the top `creative-ux` model.
3. **Climax:** Alex edits the prompt or scrolls to **Ask a specialist** and clicks **New Session** on Sally (`UX Designer`), opening a clean ZCode session with the contextual prompt pre-pasted and no disruption to the current chat.
Failure: filter returns zero skills → empty skills list while specialist agent rows remain reachable below; OS launch blocked falls back to clipboard + instructional toast.

### Flow 6 — Alex reads a long queued prompt at a comfortable size (Alex, late evening, eyes tired; added 2026-11-25)

1. In **Queue**, Alex sees a queued task card whose inset prompt sits in 12.5px mono (`{typography.mono-meta}`). Alex squints and wants more room to read its full prompt and model details.
2. Alex clicks the task card (or presses **⤢ Expand**). `{components.section-overlay}` opens over a dimmed backdrop at reading size; focus lands on its heading and the dialog is announced.
3. The same item now reads at the overlay sizes — 16px heading, 15px prose, 14.5px mono prompt, 13.5px metadata.
4. The 5s poll fires while the focus view is open. An open overlay counts as interacting, so the result is stashed in `pendingWorkspaceState` — **the text under Alex's eyes does not jump or re-render**.
5. **Climax:** Alex reads the full prompt comfortably, adjusts the task's model, and presses `Escape`. The overlay closes, focus returns to the card that opened it, and the queued card already reflects the updated model — the focus view worked against the live item, so nothing was lost.
6. The stashed poll flushes cleanly once the overlay closes.

Failure: the task disappears from a fresh scan while the overlay is open → the overlay closes with the toast "That item is no longer available" and focus returns to the heading of the tab (`[ASSUMPTION]`).

### Flow 7 — Alex, new to the panel, understands what to do next (Alex, first week with BMAD Companion; added 2026-11-25)

1. Alex opens the panel. **Work** is active. Its hero says, in one or two everyday sentences drawn from the last three conversations, what the current focus is, with no BMAD terms, and lists the next actions below.
2. Alex selects the first action. The **action window** opens with its details and its prompt; Alex reads why it matters now, adjusts the prompt, and launches it.
3. Later Alex wants to see what is lined up. **Queue** shows the queued tasks with their current options. Then **Project** shows how the work is organized in phases, epics and tickets.
4. **Climax:** Alex moved from "what should I do next" to a running prompt without meeting a skill id, a phase code or a tracker term on the way.

Failure: a screen-reader user gets each tab's purpose sentence as its accessible description, so the cue is never visual-only.
