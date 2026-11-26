---
name: BMAD Companion
status: final
sources:
  - ../prd-bmad-companion/prd-bmad-companion.md
  - ../../../assets/panel.html
  - ../../../AGENTS.md
updated: 2026-11-26
---

# BMAD Companion — Experience Spine

> Information architecture, behavior, state, interaction, accessibility, and journey contract for the right-side cockpit (three tabs since 2026-11-25; Story 8.1 `9a3e18b` already shipped Palette C tokens, `--on-primary`, `4px`/`50%` radii, and the closed larger type ramp in `assets/panel.html`, while `RD-3`, `RD-4`, `RD-5` focal accent, `RD-7`, `RD-8`, and `RD-9` remain open for Stories 8.2–8.5) (`assets/panel.html`, served as `ui://bmad-companion/panel.html`). Visual tokens and component appearance live in [DESIGN.md](./DESIGN.md); this spine cross-references them as `{path.to.token}`. Spines win on any conflict with mocks or the as-built file. Code pointers were re-verified line by line against `assets/panel.html` after Story 8.1 (`9a3e18b`) on 2026-11-26. Requirement ids (`FR-*`, `RULE-*`, `SM-*`, `UJ-*`) cite the [PRD](../prd-bmad-companion/prd-bmad-companion.md).

## Foundation

Single-surface desktop: a ZCode right-side MCP App iframe (`surface: "bmad-companion"`, MIME `text/html;profile=mcp-app`, CSP `unsafeEval: false`). No UI framework — bespoke vanilla HTML/CSS/JS, zero npm dependencies (RULE-1), zero external assets (RULE-7). [DESIGN.md](./DESIGN.md) is the visual identity reference; this spine is the experience.

The panel never touches disk or the OS directly. Every effect routes through the MCP stdio server (`scripts/mcp-server.mjs`, 9 tools) over the `window.parent.postMessage` JSON-RPC 2.0 bridge (`PROTOCOL_VERSION = "2026-01-26"`, `panel.html:1263`). `window.zcode` is banned (PRD Non-goal 2). The bridge methods used are `ui/initialize`, `tools/call`, `ui/message`, `ui/update-model-context`, plus inbound `ui/notifications/host-context-changed` (theme) and `ui/notifications/tool-result` (live state). RPC calls time out at 15000ms (`panel.html:1361`).

Dark is the default surface; light applies when the host reports `theme: "light"` at `ui/initialize` or via `host-context-changed` (`applyHostTheme`, `panel.html:1371-1377, 1400-1405, 1429-1431`). There is no in-panel theme toggle — the host owns theme.

**The panel recedes behind the conversation (owner direction, 2026-11-25).** The panel follows the system theme, as it already does. Like ZCode's own side panels, it must stay one step greyer than the conversation so the conversation keeps the focus: in dark mode the conversation is deep dark and the panel is a little grey; in light mode the conversation is the brightest surface and the panel is a light grey. Story 8.1 shipped the Palette C surface tokens; Story 8.8's live host-theme check confirms the panel canvas against ZCode's real conversation surface in both themes.

The cockpit's governing promise: **live state never costs the user their place.** The panel polls `bmad_get_state` every 5s while visible, yet a user mid-edit in a prompt textarea or model dropdown must never lose focus, cursor, keystrokes, or edits (FR-12…FR-14, RULE-9, SM-2). The [Live Polling & Form-Focus Guards](#live-polling--form-focus-guards) section is the contract that makes this true.

A second promise was added by the owner's direction of 2026-11-25: **the panel is calm and readable.** Each tab has one focal point, headings say the task in plain words, and any element the user clicks can come into focus at a larger size. The [Readability & Focus](#readability--focus) section is that contract. Its structure follows the owner's own three-tab design (Information Architecture). `OQ-6` was closed against ZCode Desktop on 2026-11-25 (Architecture `AD-9` & `AD-17`): right-side panes already run in `displayMode: "fullscreen"` with no host-managed wider popup, so Focus View (`RD-7`) and the Work Action Window (`RD-9`) render inside `assets/panel.html` via one unified in-iframe modal overlay controller.

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

Tab order is fixed: `work`, `queue`, `project` (ratified in Architecture `AD-17` §1: `work` replaces `advisor`; `queue` is unchanged; `project` replaces `progress`, `catalog`, and `artifacts`). The as-built order and ids prior to Story 8.2 are `advisor`, `queue`, `progress`, `catalog`, `artifacts` (`panel.html:1024-1030`). `switchTab` toggles `.active`, `aria-selected`, roving `tabindex`, `display:block/none` across the `role="tabpanel"` sections, resets `mainScroll.scrollTop = 0`, and (under `AD-17`) closes any open overlay (`panel.html:3124-3141`). The tab strip is a single-row 3-column grid (`repeat(3, minmax(0, 1fr))`; as-built 5 columns prior to Story 8.2, `panel.html:241-249`).

Cross-tab jumps: "Add to Queue" from an action window jumps to `queue` (as-built: `panel.html:3212, 3216`, closing the overlay via `switchTab("queue")` per `AD-17`); the live-queue banner's "View Queue" (`#bannerBtnOpenQueue`) jumps to `queue` (`panel.html:1890`). Because `switchTab` resets scroll to top, cross-tab jumps always reveal the Queue controls immediately.

**Tab purpose — RD-4 (decided 2026-11-25; open until Story 8.2).** The owner reported that it was unclear when to use ⚡ Next Prompts, 📊 Phases & Epics and 🧭 Skills & Agents. The three-tab structure answers it with one job per tab, stated in the "Use it when…" column, which is the single source: wherever a purpose cue appears, it repeats that sentence. Decided by the owner on 2026-11-25: each tab carries the sentence as its tooltip and accessible description, and the open tab shows it once more, directly under its heading.

**The current-focus text (decided 2026-11-25; engine shipped in Epic 7 `35b8f80`).** The engine synthesizes `turnAnalysis.currentFocus` (`{ text, basisLabel: "Current focus", conversationCount, source }`) from the rolling 3-conversation buffer (`recentConversations`) or fresh advisor/Stop overrides with a deterministic jargon filter (`AD-18`), saying in 1–2 plain sentences what was done and what matters now. Story 8.4 renders it as the hero of Work; see Component Patterns.
Palette impressions are promoted to `mockups/` and listed in [ux-bmad-companion.md](./ux-bmad-companion.md#mock-coverage). They show mood only. No screen mock-up is promoted: the two made for an earlier draft showed a layout the owner did not choose and were removed. Spines win on conflict.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in [DESIGN.md](./DESIGN.md#brand--style). The panel speaks in **short verb-first action labels with an emoji prefix**, honest fallbacks, and numeric telemetry. The owner chose to keep emoji as the icon system on 2026-11-25, after seeing single-color drawn icons as a live rendering. It never invents success.

**Headings say the task — RD-3 (decided 2026-11-25; open until built).** A heading states what you do there, in plain words, with no internal jargon and no bracketed instructions. On Work the wording also hides BMAD terms (owner direction). As-built, headings name features instead. Headings for the three-tab structure, all `[ASSUMPTION]` wording; each keeps its emoji prefix, because the owner chose to keep emoji as the icon system:

| Tab | As-built heading it replaces (`panel.html`) | New heading |
|---|---|---|
| Work | 🚀 Next BMAD Prompts (Select Multiple to Queue or Launch Directly) (1060) | 🚀 What to do next |
| Work (collapsed) | 🔍 Smart Artifact + AI Cross-Check Insights (1071) | 🔍 AI notes |
| Queue | ⛓️ Multi-Task Execution Queue & Per-Task Model Orchestrator (1082) | ⛓️ Queued tasks |
| Queue | 📋 Queued & Completed Tasks (0) (1144) | (the same list, below the controls) |
| Project | 📈 Static Tracker vs. Smart AI Reconciliation (1154) | 📈 Line up your tickets with the code |
| Project | 🏛️ 4-Phase BMAD-METHOD Lifecycle (1176) | 🏛️ Phases |
| Project | 📦 Epics & Stories Progress Explorer (1185) | 📦 Epics and tickets |
| Removed (Story 8.2) | 🛠️ Contextual BMAD Skills Launcher (New Session + Model) (1214) | (no heading: the skills list leaves the panel) |
| Removed (Story 8.2) | 👥 Specialist BMAD Agents (1219) | (no heading: removed with the skills list) |
| Project | 🕒 Workspace BMAD Artifacts (Ordered by Last Modified) (1245) | 🕒 Recently changed files |

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

Every recommendation renders as `/bmad-<skill> "<workspace-specific prompt>"` paired with a `providerId/modelId` (RULE-2, SM-1). Toasts auto-dismiss after 4000ms (`panel.html:1554`), always name the model or the next manual step, and shift to semantic error (`.is-error`, `role="alert"`, `aria-live="assertive"` — triggered only on explicit error/failure prefixes or `error:`/`failed to` phrasing, not recovery toasts referencing failed tasks) or warning (`.is-warning`) styling when appropriate.

## Component Patterns

Behavioral. Visual specs live in [DESIGN.md.Components](./DESIGN.md#components).

| Component | Use | Behavioral rules |
|---|---|---|
| **Recommendation card** (`{components.rec-card}`) | Work | Editable `{components.cmd-textarea}` command + `{components.model-select}` model. Edits persist in `userEditedPrompts`/`userSelectedModels` keyed `rec:<skill>:<title>` (shared across Work cards, Action Window, and Focus View, using shared `getRecommendationBaseModelId(rec)` per `AD-10`) while the server base is unchanged (FR-14). `{components.queue-checkbox}` adds to a semantic `selectedRecKeys` `Set<recKey>` (`AD-10`, replacing index-based tracking); `☑️ Select All` toggles to `☐ Deselect All` when all are checked, and `➕ Add Checked (N) to Queue` displays the live selection count before enqueuing all checked via `resolveUserPrompt`/`resolveUserModel` and jumping to Queue. Five actions: Add to Queue (or "↻ Update in Queue" / "↻ Re-queue" if already queued/done), Launch in New Session, Run Here, Attach, Copy. Under `RD-8` (Story 8.4): only Launch in New Session and Add to Queue stay immediately visible; Run Here, Attach and Copy move behind a **More actions (3)** disclosure (`expandedDisclosures` key `more-actions`). In Work (`RD-9`, Story 8.4) the compact card renders `plainTitle` and `plainSummary` (delivered in Epic 7 `AD-8` without BMAD jargon); clicking it opens the **action window** (`activeOverlay = { kind: "action", targetType: "recommendation", targetKey: recKey }`). |
| **Action window** (`{components.action-dialog}`) | Work (RD-9, Stories 8.3–8.4) | Opens inside the single unified in-iframe overlay controller (`AD-17`, `<div role="dialog" aria-modal="true" aria-labelledby="overlayTitle">`) using `overlay-*` non-duplicating DOM IDs when the user selects a next action. Content: plain title (`plainTitle`), short "why now" (`plainSummary` / `rationale`), editable `{components.cmd-textarea}` + `{components.model-select}` bound to `userEditedPrompts`/`userSelectedModels`, primary **Launch in New Session** and **Add to Queue** (tab-jumping via `switchTab("queue")`, which clears `pendingWorkspaceState = null` and closes the overlay), **More actions (3)** (`expandedDisclosures` `more-actions`) for Run Here, Attach, and Copy, plus a small "Technical details" line naming `skill` and `phase`. Focus moves in on open, `✕` or capture-phase `Escape` closes it, and focus restores via `triggerEl` → `triggerSelector` → active tab heading (`AD-17`). |
| **Current-focus hero** (`{components.focus-hero}`) | Work (RD-9/AD-18; engine built in Epic 7, panel Story 8.4) | The first thing on Work. Renders `turnAnalysis.currentFocus.text` (1–2 plain jargon-free sentences from `recentConversations` or fresh advisor/Stop override, never falling back to `aiSummaryHeadline`) and below it `turnAnalysis.currentFocus.basisLabel` reading `"Current focus"` (decided 2026-11-25, while `conversationCount` `0..3` stays tracked in state). The next actions list below it. Updates with workspace state behind the 5s polling guard (`AD-10`). |
| **Model select** (`{components.model-select}`) | Work, Queue | Options grouped into `<optgroup>` sections by `providerName` (`panel.html:1656-1688`). Each `<option>` shows `🤖 <modelId> · <N>k · $/$$/$$$` with `· ⛔ rate-limited` (sorted to the bottom of its provider group) and `★ Recommended` on the top-scored model. |
| **Catalog skill card** | Removed in Story 8.2 (`OQ-9`) | Kept here as the as-built record (`panel.html:2765-2849`). Same editable command/model pattern keyed `skill:<skill>` (including the associated `<label class="cmd-label">` header row); shows preceded/followed workflow breadcrumbs and actions Add to Queue / Launch in New Session / Run Here / Copy. `skillsCatalog` stays in `bmad_get_state` (`AD-14`). |
| **Agent row** | Removed in Story 8.2 (`OQ-9`) | Kept here as the as-built record (`panel.html:2906-2940`; `agentsCatalog` stays in `bmad_get_state` per `AD-14`). Used `.agent-card` (`padding: 9px 11px`) with one "🚀 New Session" action launching a greeting prompt addressed to the agent by name/title/focus with its scored model. |
| **Queue control bar** | Queue | Default review gate select (`none`/`quick`/`thorough`, applies to all on change), epic quick-enqueue picker + `➕ Queue Epic`, and seven execution controls: `⚡ Run Queue via ZCode Workflow (.dwf.ts)`, `🚀 Run Queue in Separate Sessions (Auto-Chain)` (starts only the first queued task with `CreateSession` + `start-task` + `sessionId`, then the `Stop` hook auto-chains subsequent tasks), `✓ Complete Active & Continue` (marks active/first-queued done and auto-continues if queued items remain), `⏸ Pause`, `↻ Retry Failed (N)` (visible whenever failed items exist), `🧹 Clear Done`, `🗑️ Clear All`. |
| **Queue item card** (`{components.queue-item-card}`) | Queue | Per-task model select and review-gate select (`none`/`quick`/`thorough`) commit immediately via `bmad_queue_manage({action:"update-item"})`. Reorder via ↑/↓ buttons (no drag). "🟢 Set Active" (shown when not active/failed) → `start-task`; "↻ Retry / Re-queue" (shown on failed items) → `retry-failed`; "✓ Mark Done" (disabled once done) → `complete-task` with `storyStatus:"done"` (advances queue + reconciles story); "🚀 New Session" → `start-task` then launch; "✕" (with `aria-label`) → `remove`. Status pill: ⏳ IN QUEUE #n / 🟢 ACTIVE (pulse) / ✓ DONE / ✗ FAILED (with `⚠️ Failure:` diagnostic box). |
| **Active-task spotlight** (`{components.queue-active-spotlight}`) | Queue | Renders only when `taskQueue.activeTask` exists: pulse dot, model + review pills, title, and the shaped `effectivePrompt` in a mono `.queue-prompt-inset`. |
| **Phase progress list** (as-built `{components.phase-card}`) | Project | Under `RD-9` (Story 8.2) Project shows a compact flat list (not behind an accordion): phase name, done state and percentage, with each phase's file chips inline below it. As-built prior to Story 8.2 (`panel.html:2449-2563`, `initialPhasesExpanded` at `1715-1722`): a native `<button type="button" class="phase-summary-row" aria-expanded>` toggles expand/collapse (`expandedPhases` Set), auto-expanding incomplete phases on first render, with Expand All / Collapse All buttons. Artifact chips inspect diffs inline inside `project` under `RD-9`/`AD-17` §1 rather than calling `switchTab("artifacts")`. |
| **Epic box / story row** (`{components.epic-box}`) | Project | Native `<button type="button" class="epic-toggle-btn" aria-expanded>` toggles expand (`expandedEpics`) beside the sibling `➕ Queue Epic` button; first render auto-expands up to 2 open epics (`panel.html:1723-1728`). Search/status filter forces expansion of matches. Story row shows smart status pill, ✨ AI badge + evidence when reconciled, recommended-model pill, and Queue Story / New Session actions. Done stories offer `/bmad-code-review`; open stories offer `/bmad-build-auto` with the story's verify command. "➕ Queue Epic" enqueues all open stories in build order. |
| **Files by phase** (as-built: the phase cards' chip lists) | Project | Under `RD-9` (Story 8.2) each phase's file chips live inline under the phase's name and done state. A chip loads its diff in the inspector inline in `project` (`AD-17` §1); `↗` opens externally. As-built prior to Story 8.2 calls `switchTab("artifacts")` first (`panel.html:2547-2555`). |
| **Reconciliation card & diff** (`{components.reconciliation-diff-card}`) | Project | "🔍 Preview Diff" → `bmad_reconcile_trackers({dryRun:true})`; "⚡ Reconcile Trackers with Reality" → `{dryRun:false, target:"all", backup:true}`. Result renders `#reconciliationDiffCard` (`.reconciliation-diff-card`) listing `key: oldStatus → newStatus` + reason per change; live run then re-renders state. ✕ Close hides the card. |
| **File row + inspector** (`{components.artifact-preview}`) | Project (Story 8.2) | As-built: the Artifacts tab (`panel.html:2942-3045`); placed in **Project** under `RD-9` (Story 8.2). Directory sorted strictly by `mtimeMs` descending; search filters path/name/kind/phase/gitStatus (empty matches show `.empty-state-card`). Keyboard-operable `<button class="art-row-btn">` (underlined path hover cue) or "🔀 Diff" → `bmad_inspect_artifact` then inspector card. Inspector toggles Git Diff ↔ Content (active toggle gets `{components.button-purple}` and `aria-pressed="true"`), "↗ Open File" → `bmad_open_artifact_file`, "🚀 Review" → launches `/bmad-review "<artifact>"` in a new session, and "✕ Close" dismisses the inspector. |
| **Progress strip** (`{components.progress-strip}`) | Global | Headline always shows smart % vs static %; mono numbers `done/total (pct)`; `{components.dual-bar}` width animates to smart %. |
| **Live-queue banner** (`{components.live-queue-banner}`) | Global | Visible whenever `taskQueue.items.length > 0`; shows active (`pill-success`), paused (`⏸ PAUSED`, `pill-warning`), queued (`pill-accent`), complete (`pill-success`), or failed (`pill-danger`) pill, embedded 4px progress bar, `✓ Done & Continue` (when active, completes + continues in current `executionMode`), `▶ Continue Queue` / `⚡ Run Workflow` (when queued items wait), or `↻ Retry Failed` (when failed items exist), and `⛓️ View Queue` (`panel.html:1813-1904`). |
| **Toast** (`{components.toast-banner}`) | Global | `showToast(msg)` sets text, applies `.is-error` (`role="alert"`, `aria-live="assertive"`) or `.is-warning` (`⚠️`/`ℹ️`) or default success (`role="status"`, `aria-live="polite"`), adds `.visible`, and auto-hides after 4000ms (`panel.html:1541-1555`); successive toasts reset the timer. |
| **AI notes disclosure** (turn-analysis box + cross-check insights) | Work (collapsed; Story 8.4) | Decided 2026-11-25 (`RD-8`, `OQ-9` — Story 8.4): placed on **Work**, collapsed by default behind an **AI notes (N)** disclosure (`expandedDisclosures` key `ai-notes`, `[ASSUMPTION]` label), where N is the number of insights, so new notes are noticeable without crowding the focal actions. |
| **Provider state bar** | Work (collapsed; Story 8.4) | Pills for active providers (model counts), subscription selections, and a runtime-synced vs dynamic-config badge; signature-diffed (`panel.html:1735-1751`). Decided 2026-11-25 (`RD-8`, `OQ-9` — Story 8.4): placed on **Work**, collapsed by default behind a **Models and providers (N)** disclosure (`expandedDisclosures` key `models-providers`, `[ASSUMPTION]` label), where N is the number of active providers. |
| **Disclosure header** (Models and providers, AI notes, More actions) | Work, action window (RD-8, Story 8.4) | Native `<button aria-expanded>` in the weight of a default button, collapsed by default, its label ending in a count so hidden content stays noticeable. Open/closed state persists in memory in the single `expandedDisclosures` Set (`AD-17` §1: `ai-notes`, `models-providers`, `more-actions`) across poll renders; not persisted across panel reloads. |
| **Section expand overlay** (`{components.section-overlay}`) | Every tab (RD-7, Stories 8.3 & 8.5) | Focusable cards, rows, and sections — queue items (`queue-item`), active spotlight (`active-spotlight`), epics (`epic`), stories (`story`), phases (`phase`), changed files (`artifact`), reconciliation diffs (`reconciliation-diff`), and AI notes (`insights`) (`AD-17` §4) — open Focus View when clicked (or via **⤢ Expand**). Interactive-descendant click guard (`AD-17` §3): clicks inside `button, a, input, select, textarea, label, [role="tab"], .status-pill` keep their normal click. Mounted inside the single unified in-iframe overlay controller (`AD-17`, `<div role="dialog" aria-modal="true" aria-labelledby="overlayTitle">`) at the overlay type roles (`16 / 15 / 14.5 / 13.5px` CSS variables shipped in Story 8.1) using `overlay-*` non-duplicating DOM IDs; main scroll locks, focus moves inside and traps `Tab`. Controls inside stay live: edits sync to `userEditedPrompts`/`userSelectedModels`, and explicit same-tab actions clear `pendingWorkspaceState = null` and call `reconcileActiveOverlay(freshState)` (`AD-10`). Close via `✕`, capture-phase `Escape`, backdrop, or `switchTab()`: restores focus (`triggerEl` → `triggerSelector` → active tab heading) and flushes stashed state. At most one overlay is open at a time. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | Global | Subtitle "Scanning workspace BMAD artifacts…"; turn box "Analyzing workspace state…"; progress 0/0. `initMcpApp` → `ui/initialize` → first `refreshState`. |
| RPC / scan failure | Global | Subtitle becomes "Ready · Click Sync or run bmad_open_companion" (`panel.html:1705-1706`). No crash, no blank panel. |
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
| Section overlay closed | Any view | Default. Each expandable section shows **⤢ Expand** in its header (`RD-7`, Stories 8.3 & 8.5). |
| Section overlay open | Any view (`RD-7`, Stories 8.3 & 8.5) | Backdrop dims the panel; one section at reading size (`overlay-*` DOM IDs); main scroll locked; focus trapped inside; `✕`, backdrop, `switchTab`, or capture-phase `Escape` closes. |
| Background poll while the overlay is open | Any view (`RD-7`, `AD-10`) | Treated as "user is interacting" (`isOverlayOpen()`): state is stashed in `pendingWorkspaceState` and **the open section is never replaced** from a background update. |
| Section gone while its overlay is open | Any view (`RD-7`, `AD-10`) | `reconcileActiveOverlay(freshState)` closes the overlay with the toast `"That item is no longer available"` and returns focus to the heading of the active tab. |
| Disclosure collapsed | Work, action window (`RD-8`, Story 8.4) | Default for the three decided blocks: `Models and providers (N)`, `AI notes (N)`, `More actions (3)`. Each header shows a count. |
| Disclosure expanded | Work, action window (`RD-8`, `AD-17`) | Stays open for the session in memory inside `expandedDisclosures`, like the phase and epic accordions; not persisted across panel reloads (the panel has no settings storage). |

## Live Polling & Form-Focus Guards

The product-specific contract that realizes FR-12…FR-14, RULE-9, and SM-2 (**0 dropped keystrokes / focus losses / lost edits**; deferred flush ≤100ms). All references are `assets/panel.html`.

**Poll loop.** `setInterval(…, 5000)` fires only when `!document.hidden` and `document.visibilityState === "visible"`, calling `refreshState({isBackground:true})` (`panel.html:3353-3364`). `refreshState` is serialized by an `isRefreshing` lock — overlapping polls return immediately (`panel.html:1690-1710`). Each poll calls `bmad_get_state({refresh:true})`.

**Guard predicate.** `isUserInteractingWithForm()` returns true when any of three clauses holds: (a) `Date.now() < selectOpenUntil`, (b) `document.activeElement` is a `TEXTAREA` or `INPUT` (`panel.html:1292-1296`), or (c) **target `RD-7`/`RD-9` (`AD-10`, Story 8.3): an overlay is open (`isOverlayOpen()`)**. A focused `SELECT` is covered by the time window, not the tag check.

**Select window (`selectOpenUntil`).** Set to `now + 15000ms` on `pointerdown` on any `select` (capture) and on `Space`/`Enter`/`ArrowDown`/`ArrowUp` while a select is focused (`panel.html:1305-1331`). Cleared to 0 on `Escape`, `Tab`, `change`, or `focusout` of a select. The 15s window keeps a dropdown "open" for guard purposes even though the native popup may close sooner.

**Single capture-phase `Escape` precedence (`AD-10`, Story 8.3).** One capture-phase `keydown` listener (`panel.html:1314`) owns `Escape` precedence: (1) if `Date.now() < selectOpenUntil`, clear `selectOpenUntil = 0`, stop propagation, and keep any open overlay open; (2) else if `isOverlayOpen()`, close the overlay immediately (even when focused inside a `TEXTAREA`/`INPUT`), restoring focus and calling `flushPendingState()`; (3) else run non-overlay `Escape` behavior (`blur()` + flush).

**Suppression + stash.** While guarded:
- A background poll skips the fetch entirely if the guard is already true at entry (`panel.html:1693`); if the guard becomes true mid-flight, the result is stashed in `pendingWorkspaceState` instead of rendered (`panel.html:1698-1699`).
- An inbound `ui/notifications/tool-result` carrying `structuredContent.metrics` is stashed when guarded, rendered when not; a tool-result *without* metrics triggers a background refresh (`panel.html:1407-1417`).

**Flush.** `flushPendingState()` renders the stashed state only if the guard has cleared, then nulls the stash (`panel.html:1298-1303`). Triggers: `focusout` of SELECT/TEXTAREA/INPUT → `setTimeout(flush, 50)`; select `change` / `Escape` / `Tab` → `setTimeout(flush, 0)` (`panel.html:1319-1351`); overlay close → `0ms` (`AD-10`). The 50ms focusout delay is within the ≤100ms SM-2 budget.

**Edit preservation.** `userEditedPrompts` and `userSelectedModels` (Maps) store `{base, value}` keyed by canonical semantic key `rec:<skill>:<title>` or `skill:<skill>` (`panel.html:1274-1275, 1606-1654`). Under `AD-10` (Story 8.3), one shared `getRecommendationBaseModelId(rec)` supplies the base model ID identically across Work card render, Action Window, and batch enqueue, and batch selection uses `selectedRecKeys` (`Set<recKey>`). On render, `resolveUserPrompt` returns the user's value while `base === serverCmd`, and **drops** the edit when the server base changes (`panel.html:1634-1639`). `resolveUserModel` likewise drops when the base model changes or the chosen model is no longer in `availableModels` (`panel.html:1641-1654`). This is why a poll that returns the *same* recommendation never clobbers an in-progress edit, but a genuinely new recommendation resets it.

**Signature diffing.** `lastSectionSignatures` holds a JSON signature per section — `providerBar`, `recommendations`, `insights`, `phases`, `epics`, `skillsCatalog`, `agentsCatalog`, `artifacts`, `taskQueue` (`panel.html:1277-1287`; `skillsCatalog`/`agentsCatalog` retire from UI in Story 8.2). Each render function calls `sectionNeedsRender()` (`panel.html:1571-1575`) and returns early when unchanged, so `innerHTML` is only replaced when data actually differs. The recommendations signature includes selected keys/draft overrides and queue item status so checkbox toggles, saved edits, and queue changes refresh correctly.

**Guard scope (important).** The guard governs *background* updates (polls + unsolicited tool-result notifications). Responses to **explicit user actions** (`manageQueue`, reconciliation, artifact load) render immediately via `renderWorkspaceState` even if a control is focused (`panel.html:1787-1799`). Explicit actions triggered from inside an open overlay MUST clear `pendingWorkspaceState = null` before `renderWorkspaceState(freshState)` and call `reconcileActiveOverlay(freshState)` (or `switchTab()` on tab jumps) (`AD-10`).

**Invariants.** Never replace `innerHTML` unconditionally on a poll; never drop `userEditedPrompts`/`userSelectedModels`/`lastSectionSignatures` when touching UI state (AGENTS.md); never render a stashed payload while the guard is true. Never replace the content of an open section overlay from a background update (`RD-7`, `AD-10`).

## Readability & Focus

Added 2026-11-25 from the owner's direction: the interface feels cluttered, its colors are too bright, nothing tells the user where to focus, and the text is small. Its principles are binding, and its structure follows the owner's own three-tab design (Work, Queue, Project). Story 8.1 (`9a3e18b`) already shipped Palette C and the 14px/12px-floor closed type ramp (`RD-1`, `RD-2`, `RD-6`) and recorded the per-tab `var(--accent)` inventory; Stories 8.2–8.5 deliver the 3-tab structure (`RD-9`), plain headings/cues (`RD-3`, `RD-4`), focal-point assignment (`RD-5` focal rule), Focus View (`RD-7`), and counted disclosures (`RD-8`). Visual counterparts live in [DESIGN.md](./DESIGN.md).

**Principles (binding).**
1. **One focal point per tab.** Exactly one element in the active tab carries the accent; everything else is ink and surface.
2. **Nothing competes with the focal point.** `[ASSUMPTION]` At most two semantic hues are visible inside any one card, and status is always written in words.
3. **Headings say the task.** Plain words, no jargon (RD-3; table in Voice and Tone).
4. **Every tab states its job.** In the "Use it when…" wording of the IA table (RD-4).
5. **Anything can come into focus.** Any element the user clicks can open in the focus view, with bigger text and more details (RD-7: cards, rows and sections, decided by the owner).

**Focal point per tab `[ASSUMPTION]`** — deferred from Story 8.1 (`RD-5` inventory recorded) to Stories 8.2 & 8.4:

| Tab | The one element that carries the accent | Everything else |
|---|---|---|
| **Work** | The first next action under the hero | The hero itself, the other actions |
| **Queue** | The active task (spotlight) | Control bar, queued and done items |
| **Project** | The Reconcile action when trackers disagree; otherwise nothing | Phases, epics and tickets |

**Clutter — RD-8 (decided 2026-11-25; open until Story 8.4).** The owner chose three blocks to hide by default: the provider state bar, the AI turn-analysis box with the cross-check insights, and the secondary card actions (Run Here, Attach, Copy). Each moves behind a disclosure whose label carries a count (`Models and providers (N)`, `AI notes (N)`, `More actions (3)`), persisted in `expandedDisclosures`; two other candidates were offered and not chosen, so they stay as they are: the seven queue execution buttons, and the per-item model and review selects.

**Base text size — RD-6 (base ramp built in Story 8.1, `9a3e18b`; overlay sizes consumed in Stories 8.3–8.5).** Normal text ships at 14px with nothing below 12px inside the panel, and the focus view adds one more step for reading (`16 / 15 / 14.5 / 13.5px` CSS variables defined at `panel.html:35-38`). Values live in DESIGN.md → Typography.

## Interaction Primitives

- **Click & keyboard to act.** Every interactive target — including tabs, disclosure headers (`RD-8`), the as-built Phase/Epic accordion toggles (`<button type="button" aria-expanded>`), artifact chips, and directory rows (`<button class="art-row-btn">`) — is a native button or form control. Sibling actions sit beside Epic toggles without nesting interactive elements.
- **Keyboard.** Native `Tab` traversal across buttons/inputs/selects/textareas; native `Enter`/`Space` activation; ARIA `tablist` arrow-key (`ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End`) navigation with wrapping across all tabs (as-built five prior to Story 8.2, `panel.html:3143-3178`). Select keyboard navigation extends the guard window; `Escape`/`Tab` commit and flush. **No global cross-panel hotkeys** are defined as-built (no command palette) — tracked as an optional enhancement, not a regression.
- **Expand a section (`RD-7`, Stories 8.3 & 8.5).** Clicking a focusable card/row (guarded against interactive descendants per `AD-17` §3) or its **⤢ Expand** button opens the unified in-iframe overlay; `✕`, backdrop, `switchTab`, or capture-phase `Escape` closes it; focus moves inside on open and restores (`triggerEl` → `triggerSelector` → active tab heading) on close; `Tab` stays trapped inside the overlay while open.
- **Reorder without drag.** Queue ordering uses ↑/↓ buttons (`reorder`), never drag-and-drop (`panel.html:2070-2071, 2111-2119`).
- **Editing.** Command textareas resize vertically; edits are local until an action reads them. Model selects commit on `change`.
- **Search/filter.** Text inputs re-render their list on `input`; status/phase selects on `change` (`panel.html:3306-3310`). Filtering is client-side over the current state.
- **Launch semantics.** "Launch in New Session" pre-pastes into a *fresh* session and never auto-submits in the current one (SM-4 counter-metric: zero unconfirmed auto-submissions). "Run Here" sends to the current session via `ui/message`; "Attach" adds context via `ui/update-model-context`; "Copy" uses `navigator.clipboard` with an `execCommand` fallback (`panel.html:1490-1538`).
- **Banned everywhere:** `eval()` / `window.zcode` / external CDNs (RULE-7); unconditional poll re-render (DEC-3); silent tracker mutation during a scan (DEC-4); bare skill-name recommendations (RULE-2); auto-submitting a launched prompt; infinite scroll; drag-to-reorder.

## Accessibility Floor

Behavioral. Visual contrast lives in [DESIGN.md.Colors](./DESIGN.md#colors) (measured ratios + closed debt CD-1…CD-5).

**Contract.**
- WCAG 2.2 AA: essential text ≥4.5:1, focus indicators ≥3:1, both themes (DESIGN.md contrast table).
- Every interactive element keyboard-operable via native `<button>`/`<input>`/`<select>`/`<textarea>`; `Tab` order follows reading order; a visible focus indicator on every focusable control.
- Status conveyed by text + color, never color alone (pills carry words; diff carries +/− semantics via line content; toasts shift icon + semantic color + ARIA live priority).
- Live updates (toasts, queue status, progress) announced to assistive tech.
- Motion respects `prefers-reduced-motion`.
- Any overlay dialog (section expand overlay, `RD-7`; action window, `RD-9`; unified in `AD-17`): `role="dialog"`, `aria-modal="true"`, `aria-labelledby="overlayTitle"`, `overlay-*` non-duplicating DOM IDs, focus moved in and trapped on open, focus restored on close, capture-phase `Escape` closes.
- Every disclosure that hides content by default (`RD-8`, Story 8.4): a native button with `aria-expanded`, a visible count in its label, and the same visual weight whether open or closed.
- Each tab's purpose sentence is its accessible description, so the cue is never visual-only (`RD-4`, Story 8.2).
- When the tab count changes from five to three (`RD-9`, Story 8.2), the `AD-2` tab semantics are re-verified on the new `work`/`queue`/`project` tablist before the change ships.

**Verified implementation (`AD-1`…`AD-6` + Story 8.1 ramp/radius guards in `assets/panel.html` & `tests/panel-a11y.test.mjs`):**
- **AD-1 — Visible textarea & control focus.** `.cmd-textarea:focus` and `:focus-visible` declare `2px solid var(--accent)` outline with `border-radius: 4px` (RD-2 built in Story 8.1) plus `.cmd-editor-wrap:focus-within` border highlight (`panel.html:468-477`); `.model-select` and `.search-input` pair border swaps with `1px` box-shadow rings on `:focus-visible`.
- **AD-2 — Full ARIA tab & landmark semantics.** `<header role="banner">`, `<main role="main">`, `<nav id="tabsNav" role="tablist">`, `<button role="tab" aria-selected aria-controls>` with roving `tabindex` (`0`/`-1`) + `handleTabKeydown` arrow/Home/End navigation, `<section role="tabpanel" aria-labelledby tabindex="0">`, `aria-pressed` on inspector Diff/Content mode toggles, plus `<button aria-expanded>` on Phase & Epic accordions (`panel.html:994-1257, 2520-2655, 3124-3178`).
- **AD-3 — Announced toasts.** `#toastBanner` declares `role="status" aria-live="polite" aria-atomic="true"`, switching to `role="alert" aria-live="assertive"` on errors (`panel.html:1036, 1541-1555`).
- **AD-4 — Associated labels.** `<label for="queueDefaultReviewSelect">`, `<label for="queueEpicPicker">`, `<label class="cmd-label" for="rec-cmd-${idx}">`, `<label class="cmd-label" for="cat-cmd-${idx}">`, `<label for="q-model-${idx}">`, `<label for="q-review-${idx}">`, and `aria-label` on filter controls and icon-only remove buttons (`panel.html:1092-1252, 2042-2049, 2270-2279, 2809`).
- **AD-5 — Reduced motion.** `@media (prefers-reduced-motion: reduce)` disables `.pulse-dot` animation/box-shadow and transitions on `.bar-smart`, `.btn`, `.rec-card`, `.phase-summary-row`, `.epic-toggle-btn`, and `.queue-item-card` (`panel.html:887-901`).
- **AD-6 — Contrast debt & Story 8.1 ramp.** Closed: DESIGN.md `CD-1`…`CD-5` closed to full WCAG AA (essential text ≥4.5:1, focus indicators ≥3:1 in both themes) against live Palette C tokens (`#RRGGBBAA` soft fills, `--on-primary` routing, 4px focus radius, closed ramp `{16, 15, 14.5, 14, 13.5, 13, 12.5, 12}px`, zero inline `font-size`).

**Open against this contract — found in the audit of 2026-11-25, not selected for this update (parked in [ux-bmad-companion.md](./ux-bmad-companion.md#parked-findings)):**
- The "queue status announced" clause above is met only for toasts: the toast banner is the panel's single live region, so a task finishing, failing, or the next one starting is silent for assistive technology.
- Keyboard focus is not restored after an explicit-action re-render outside the overlay: the file's only focus call serves the tab strip (`panel.html:3131-3132`), so after a non-overlay queue action the focused button is destroyed and focus drops to the document. (Overlay actions in Stories 8.3–8.5 restore focus or reconcile in place per `AD-17`.)
- The failed-scan subtitle reads "Ready · Click Sync or run bmad_open_companion", which conflicts with the Voice rule "It never invents success".

## Responsive & Platform

Single surface, fluid narrow column. No breakpoints; the panel adapts by truncation (`text-overflow:ellipsis` on titles/paths) and `flex-wrap:wrap` on action/filter rows, not by reflowing into different layouts. `ui/initialize` declares `availableDisplayModes: ["inline","fullscreen"]` (`panel.html:1424-1426`); the layout is column-first in both. `OQ-6` was closed against ZCode Desktop on 2026-11-25 (`AD-9`): right-side MCP App panes already run in `displayMode: "fullscreen"` and no wider host modal exists, so the unified overlay (`AD-17`) renders inside `assets/panel.html`.

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

1. The `Stop` hook updates state; the panel's Work tab lists three next actions under its hero, top one `/bmad-prd "Create the comprehensive Product Requirements Document…"` paired with `new-provider/claude-opus-5-5-high` (displayed in Work via `plainTitle`/`plainSummary`).
2. Alex selects the top action. The **action window** opens inside the unified overlay (`AD-17`, `overlay-*` DOM IDs) with its details and its prompt. Alex edits the `{components.cmd-textarea}` prompt to add a constraint, then opens the provider-grouped `{components.model-select}` (checking cost tier `$`/`$$`/`$$$` and avoiding any `⛔ rate-limited` entry).
3. While Alex types, the 5s timer fires `bmad_get_state`. `isUserInteractingWithForm()` sees the focused textarea, the select window, and `isOverlayOpen()`, so the poll stashes `pendingWorkspaceState` — **no re-render, cursor intact**.
4. Alex blurs the control or closes the overlay (with capture-phase `Escape` closing an open `<select>` first before closing the overlay on a second `Escape`, `AD-10`); `flushPendingState()` renders the stashed state. Because the server base command is unchanged and the shared `getRecommendationBaseModelId` helper matches, `resolveUserPrompt`/`resolveUserModel` keep Alex's edited text and chosen model across Work cards and Action Window re-opens.
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
2. Alex clicks the task card (or presses **⤢ Expand**; interactive child buttons/selects/pills keep their normal clicks via `AD-17` §3). `{components.section-overlay}` opens inside the unified overlay (`overlay-*` DOM IDs) over a dimmed backdrop at reading size; focus lands inside and the dialog is announced.
3. The same item now reads at the overlay sizes — 16px heading, 15px prose, 14.5px mono prompt, 13.5px metadata (`--overlay-*-size` shipped in Story 8.1).
4. The 5s poll fires while the focus view is open. `isOverlayOpen()` counts as interacting (`AD-10`), so the result is stashed in `pendingWorkspaceState` — **the text under Alex's eyes does not jump or re-render**.
5. **Climax:** Alex reads the full prompt comfortably, adjusts the task's model (the explicit action clears `pendingWorkspaceState = null`, updates the Queue card, and reconciles the overlay in place via `reconcileActiveOverlay`), and presses capture-phase `Escape`. The overlay closes, focus restores (`triggerEl` → `triggerSelector` → Queue heading), and the queued card already reflects the updated model.
6. Any stashed poll flushes cleanly once the overlay closes.

Failure: the task disappears from a fresh scan while the overlay is open → `reconcileActiveOverlay` closes the overlay with the toast `"That item is no longer available"` and returns focus to the heading of the tab.

### Flow 7 — Alex, new to the panel, understands what to do next (Alex, first week with BMAD Companion; added 2026-11-25)

1. Alex opens the panel. **Work** is active. Its hero renders `turnAnalysis.currentFocus` (`text` in 1–2 plain sentences drawn from up to 3 recent conversations with no BMAD terms, captioned `"Current focus"` per `AD-18`), and lists the next actions below (`plainTitle` / `plainSummary` per `AD-8`).
2. Alex selects the first action. The **action window** opens inside the unified overlay with its details and its prompt; Alex reads why it matters now, adjusts the prompt, and launches it.
3. Later Alex wants to see what is lined up. **Queue** shows the queued tasks with their current options. Then **Project** shows how the work is organized in phases, epics and tickets, plus recently changed files and diffs inline.
4. **Climax:** Alex moved from "what should I do next" to a running prompt without meeting a skill id, a phase code or a tracker term on the way.

Failure: a screen-reader user gets each tab's purpose sentence as its accessible description, so the cue is never visual-only.
