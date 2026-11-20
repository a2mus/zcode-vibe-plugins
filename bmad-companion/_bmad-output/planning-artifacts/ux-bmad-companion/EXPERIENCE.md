---
name: BMAD Companion
status: final
sources:
  - ../prd-bmad-companion/prd-bmad-companion.md
  - ../../../assets/panel.html
  - ../../../AGENTS.md
updated: 2026-11-19
---

# BMAD Companion — Experience Spine

> Information architecture, behavior, state, interaction, accessibility, and journey contract for the 5-tab right-side cockpit (`assets/panel.html`, served as `ui://bmad-companion/panel.html`). Visual tokens and component appearance live in [DESIGN.md](./DESIGN.md); this spine cross-references them as `{path.to.token}`. Spines win on any conflict with mocks or the as-built file. Requirement ids (`FR-*`, `RULE-*`, `SM-*`, `UJ-*`) cite the [PRD](../prd-bmad-companion/prd-bmad-companion.md).

## Foundation

Single-surface desktop: a ZCode right-side MCP App iframe (`surface: "bmad-companion"`, MIME `text/html;profile=mcp-app`, CSP `unsafeEval: false`). No UI framework — bespoke vanilla HTML/CSS/JS, zero npm dependencies (RULE-1), zero external assets (RULE-7). [DESIGN.md](./DESIGN.md) is the visual identity reference; this spine is the experience.

The panel never touches disk or the OS directly. Every effect routes through the MCP stdio server (`scripts/mcp-server.mjs`, 9 tools) over the `window.parent.postMessage` JSON-RPC 2.0 bridge (`PROTOCOL_VERSION = "2026-01-26"`, panel.html:1025). `window.zcode` is banned (PRD Non-goal 2). The bridge methods used are `ui/initialize`, `tools/call`, `ui/message`, `ui/update-model-context`, plus inbound `ui/notifications/host-context-changed` (theme) and `ui/notifications/tool-result` (live state). RPC calls time out at 15000ms (panel.html:1106-1111).

Dark is the default surface; light applies when the host reports `theme: "light"` at `ui/initialize` or via `host-context-changed` (`applyHostTheme`, panel.html:1121-1127, 1150-1155, 1179-1181). There is no in-panel theme toggle — the host owns theme.

The cockpit's governing promise: **live state never costs the user their place.** The panel polls `bmad_get_state` every 5s while visible, yet a user mid-edit in a prompt textarea or model dropdown must never lose focus, cursor, keystrokes, or edits (FR-12…FR-14, RULE-9, SM-2). The [Live Polling & Form-Focus Guards](#live-polling--form-focus-guards) section is the contract that makes this true.

## Information Architecture

One scrolling column, five tabs, one visible at a time. Global chrome (top bar + progress strip + banners) persists across tabs.

| Surface | Reached from | Purpose |
|---|---|---|
| **⚡ Next Prompts** (`tab-advisor`, default) | Panel open / tab strip | Post-turn AI state, provider badges, ranked editable `/bmad-<skill> "<prompt>"` recommendations with per-rec model selects and Launch/Queue/Run-Here/Attach/Copy actions, multi-select queueing, and cross-check insights. |
| **⛓️ Queue** (`tab-queue`) | Tab strip (live count pill) / "Open Queue" / after adding tasks | Multi-task execution ledger: default review gate, epic quick-enqueue, run via `.dwf.ts` workflow or separate sessions, active-task spotlight, per-task model/review selects, reorder/activate/done/launch/remove. |
| **📊 Phases & Epics** (`tab-progress`) | Tab strip | Static-vs-Smart reconciliation card (Preview Diff / Reconcile), 4-phase BMAD lifecycle cards with artifact chips, and a filterable epic/story explorer with per-story Queue/New-Session actions. |
| **🧭 Skills & Agents** (`tab-catalog`) | Tab strip | Searchable, phase-filtered catalog of `/bmad-*` skills (editable command + model + Launch/Queue/Run-Here/Copy) and specialist agent rows (New Session). |
| **🗂️ Artifacts** (`tab-artifacts`) | Tab strip / artifact chip in Phases | Newest-modified-first artifact directory (search, git-status badges, Diff/Open) and an inspector card (Git Diff ↔ Content toggle, Open File, Review). |
| **Global chrome** | Always | Top bar (brand, AI Audit, Sync), Smart-vs-Static progress strip, live-queue banner, toast banner. |

Canonical tab names map to as-built labels: "Execution Queue" → **⛓️ Queue**; "Catalog" → **🧭 Skills & Agents**. Tab order is fixed: advisor, queue, progress, catalog, artifacts (panel.html:792-796). `switchTab` toggles `.active` on the button and `display:block/none` on the five sections (panel.html:2642-2650). The tab strip currently wraps the fifth tab to a second row (DESIGN.md **LD-1**); the IA contract is still five peer tabs.

Cross-tab jumps: an artifact chip in Phases calls `switchTab("artifacts")` then loads its diff (panel.html:2116-2123); "Add Checked to Queue" and "Open Queue" jump to `queue` (panel.html:2690, 2693-2695); the live-queue banner's "Open Queue" jumps to `queue` (panel.html:1531).

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

Every recommendation renders as `/bmad-<skill> "<workspace-specific prompt>"` paired with a `providerId/modelId` (RULE-2, SM-1). Toasts auto-dismiss after 4000ms (panel.html:1297) and always name the model or the next manual step.

## Component Patterns

Behavioral. Visual specs live in [DESIGN.md.Components](./DESIGN.md#components).

| Component | Use | Behavioral rules |
|---|---|---|
| **Recommendation card** (`{components.rec-card}`) | Next Prompts | Editable `{components.cmd-textarea}` command + `{components.model-select}` model. Edits persist in `userEditedPrompts`/`userSelectedModels` keyed `rec:<skill>:<title>` while the server base is unchanged (FR-14). Checkbox adds to a multi-select set; "Add Checked to Queue" enqueues all checked with their chosen models then jumps to Queue. Actions read the *live* textarea/select values, not the server base. Five actions: Add to Queue (or "↻ Update in Queue" if already queued), Launch in New Session, Run Here, Attach, Copy. |
| **Catalog skill card** | Skills & Agents | Same editable command/model pattern keyed `skill:<skill>`; actions Add to Queue / Launch / Run Here / Copy. Search + phase filter re-render via signature diff. |
| **Agent row** | Skills & Agents | One "🚀 New Session" action launching a greeting prompt addressed to the agent by name/title/focus. |
| **Queue item card** (`{components.queue-item-card}`) | Queue | Per-task model select and review-gate select (`none`/`quick`/`thorough`) commit immediately via `bmad_queue_manage({action:"update-item"})`. Reorder via ↑/↓ buttons (no drag). "🟢 Set Active" → `start-task`; "✓ Mark Done" → `complete-task` with `storyStatus:"done"` (advances queue + reconciles story); "🚀 New Session" → `start-task` then launch; "✕" → `remove`. Status pill: ⏳ IN QUEUE #n / 🟢 ACTIVE (pulse) / ✓ DONE / ✗ FAILED. |
| **Active-task spotlight** | Queue | Renders only when `taskQueue.activeTask` exists: pulse dot, model + review pills, title, and the shaped `effectivePrompt` in a mono inset. |
| **Phase card** (`{components.phase-card}`) | Phases & Epics | Click summary to expand/collapse (`expandedPhases` Set). First render auto-expands incomplete phases (panel.html:1382-1389). Body lists artifact chips: main label → jump to Artifacts diff; `↗` → open externally. Expand All / Collapse All buttons. |
| **Epic box / story row** (`{components.epic-box}`) | Phases & Epics | Click summary to expand (`expandedEpics`); first render auto-expands up to 2 open epics (panel.html:1390-1395). Search/status filter forces expansion of matches. Story row shows smart status pill, ✨ AI badge + evidence when reconciled, recommended-model pill, and Queue Story / New Session actions. Done stories offer `/bmad-code-review`; open stories offer `/bmad-build-auto` with the story's verify command. "➕ Queue Epic" enqueues all open stories in build order. |
| **Reconciliation card** | Phases & Epics | "🔍 Preview Diff" → `bmad_reconcile_trackers({dryRun:true})`; "⚡ Reconcile Trackers with Reality" → `{dryRun:false, target:"all", backup:true}`. Result renders a diff card listing `key: oldStatus → newStatus` + reason per change; live run then re-renders state. ✕ Close hides the card. |
| **Artifact row + inspector** (`{components.artifact-preview}`) | Artifacts | Directory sorted strictly by `mtimeMs` descending; search filters path/name/kind/phase/gitStatus. Row click or "🔀 Diff" → `bmad_inspect_artifact` then inspector card. Inspector toggles Git Diff ↔ Content (active toggle gets `{components.button-purple}`), "↗ Open File" → `bmad_open_artifact_file`, "🚀 Review" → launches `/bmad-review "<artifact>"` in a new session. |
| **Progress strip** (`{components.progress-strip}`) | Global | Headline always shows smart % vs static %; mono numbers `done/total (pct)`; `{components.dual-bar}` width animates to smart %. |
| **Live-queue banner** (`{components.live-queue-banner}`) | Global | Visible when a task is running or queued; shows 🟢 Running title + model + review, or next-up; "Open Queue" jumps to the tab. |
| **Toast** (`{components.toast-banner}`) | Global | `showToast(msg)` sets text, adds `.visible`, auto-hides after 4000ms; successive toasts reset the timer. |
| **Provider state bar** | Next Prompts | Pills for active providers (model counts), subscription selections, and a runtime-synced vs dynamic-config badge; signature-diffed. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | Global | Subtitle "Scanning workspace BMAD artifacts…"; turn box "Analyzing workspace state…"; progress 0/0. `initMcpApp` → `ui/initialize` → first `refreshState`. |
| RPC / scan failure | Global | Subtitle becomes "Ready · Click Sync or run bmad_open_companion" (panel.html:1372-1373). No crash, no blank panel. |
| No recommendations | Next Prompts | "No recommendations yet. Click Sync to analyze workspace." |
| Empty queue | Queue | Centered card: "Your BMAD Execution Queue is Empty" + how to enqueue from Next Prompts / Phases. |
| No story matches | Phases & Epics | "No matching stories found." |
| Phase with no artifacts | Phases & Epics | "No artifacts generated in this phase yet." |
| Artifact loading | Artifacts inspector | "Loading artifact diff & content…" then diff/content; failure → "Failed to load artifact: <message>". |
| Reconciliation dry-run | Phases & Epics | Diff card titled "🔍 Dry Run Preview (N keys across M file(s))"; **no disk writes** (RULE-8). |
| Reconciliation live | Phases & Epics | "✅ Reconciled N keys across M file(s)!" + success toast; `.bak` backups written before mutation (RULE-8, FR-11); state re-rendered. |
| Nothing to reconcile | Phases & Epics | "✓ All tracker files are already 100% synchronized…". |
| Queue idle / running / paused | Queue + global | Status badge `IDLE/RUNNING/PAUSED · done/total · queued`; running shows pulse + live banner. |
| Task queued/running/done/failed | Queue item | ⏳ / 🟢 (pulse, `.is-active`) / ✓ (`.is-done`, dimmed) / ✗ pills. |
| OS launch blocked | Global toast | Clipboard fallback: "📋 Prompt copied! Press Ctrl+N then Ctrl+V" (FR-4 graceful degradation). |
| Background poll while editing | Any tab | State stashed in `pendingWorkspaceState`; **no re-render** until focus leaves (see Guards). |
| Hidden panel | Global | 5s interval skips (`document.hidden`); resumes on visibility. |
| Host theme change | Global | `body.theme-light` added/removed; tokens swap instantly, no reload. |

## Live Polling & Form-Focus Guards

The product-specific contract that realizes FR-12…FR-14, RULE-9, and SM-2 (**0 dropped keystrokes / focus losses / lost edits**; deferred flush ≤100ms). All references are `assets/panel.html`.

**Poll loop.** `setInterval(…, 5000)` fires only when `!document.hidden`, calling `refreshState({isBackground:true})` (panel.html:2810-2814). `refreshState` is serialized by an `isRefreshing` lock — overlapping polls return immediately (panel.html:1357-1377). Each poll calls `bmad_get_state({refresh:true})`.

**Guard predicate.** `isUserInteractingWithForm()` returns true when either (a) `Date.now() < selectOpenUntil`, or (b) `document.activeElement` is a `TEXTAREA` or `INPUT` (panel.html:1054-1060). A focused `SELECT` is covered by the time window, not the tag check.

**Select window (`selectOpenUntil`).** Set to `now + 15000ms` on `pointerdown` on any `select` (capture) and on `Space`/`Enter`/`ArrowDown`/`ArrowUp` while a select is focused (panel.html:1069-1085). Cleared to 0 on `Escape`, `Tab`, `change`, or `focusout` of a select. The 15s window keeps a dropdown "open" for guard purposes even though the native popup may close sooner.

**Suppression + stash.** While guarded:
- A background poll skips the fetch entirely if the guard is already true at entry (panel.html:1360); if the guard becomes true mid-flight, the result is stashed in `pendingWorkspaceState` instead of rendered (panel.html:1365-1366).
- An inbound `ui/notifications/tool-result` carrying `structuredContent.metrics` is stashed when guarded, rendered when not; a tool-result *without* metrics triggers a background refresh (panel.html:1157-1167).

**Flush.** `flushPendingState()` renders the stashed state only if the guard has cleared, then nulls the stash (panel.html:1062-1067). Triggers: `focusout` of SELECT/TEXTAREA/INPUT → `setTimeout(flush, 50)`; select `change` / `Escape` / `Tab` → `setTimeout(flush, 0)` (panel.html:1087-1101). The 50ms focusout delay is within the ≤100ms SM-2 budget.

**Edit preservation.** `userEditedPrompts` and `userSelectedModels` (Maps) store `{base, value}` keyed `rec:<skill>:<title>` or `skill:<skill>` (panel.html:1308-1314, 1888-1895, 2378-2386). On render, `resolveUserPrompt` returns the user's value while `base === serverCmd`, and **drops** the edit when the server base changes (panel.html:1316-1321). `resolveUserModel` likewise drops when the base model changes or the chosen model is no longer in `availableModels` (panel.html:1323-1335). This is why a poll that returns the *same* recommendation never clobbers an in-progress edit, but a genuinely new recommendation resets it.

**Signature diffing.** `lastSectionSignatures` holds a JSON signature per section — `providerBar`, `recommendations`, `insights`, `phases`, `epics`, `skillsCatalog`, `agentsCatalog`, `artifacts`, `taskQueue` (panel.html:1039-1049). Each render function compares its signature and returns early when unchanged, so `innerHTML` is only replaced when data actually differs (e.g. panel.html:1790-1793, 1580-1581, 2035-2036, 2146-2147, 2500-2501). The recommendations signature includes checked indices and queue item status so checkbox toggles and queue changes refresh correctly.

**Guard scope (important).** The guard governs *background* updates (polls + unsolicited tool-result notifications). Responses to **explicit user actions** (`manageQueue`, reconciliation, artifact load) render immediately via `renderWorkspaceState` even if a control is focused (panel.html:1454-1466, 2629-2635) — the user asked for that change, so the re-render is expected. Changing a queue select, for example, commits then re-renders the queue list.

**Invariants.** Never replace `innerHTML` unconditionally on a poll; never drop `userEditedPrompts`/`userSelectedModels`/`lastSectionSignatures` when touching UI state (AGENTS.md); never render a stashed payload while the guard is true.

## Interaction Primitives

- **Click to act.** Every action is a labeled button; tabs, expand/collapse summaries, artifact chips, and directory rows are click targets. Nested actions `stopPropagation` so a story button doesn't also toggle its epic (panel.html:2257-2300).
- **Keyboard.** Native `Tab` traversal across buttons/inputs/selects/textareas; native `Enter`/`Space` activation. Select keyboard navigation extends the guard window; `Escape`/`Tab` commit and flush. **No global keyboard shortcuts** are defined as-built (no tab hotkeys, no command palette) — tracked as an enhancement, not a regression.
- **Reorder without drag.** Queue ordering uses ↑/↓ buttons (`reorder`), never drag-and-drop (panel.html:1674-1675, 1709-1717).
- **Editing.** Command textareas resize vertically; edits are local until an action reads them. Model selects commit on `change`.
- **Search/filter.** Text inputs re-render their list on `input`; status/phase selects on `change` (panel.html:2769-2773). Filtering is client-side over the current state.
- **Launch semantics.** "Launch in New Session" pre-pastes into a *fresh* session and never auto-submits in the current one (SM-4 counter-metric: zero unconfirmed auto-submissions). "Run Here" sends to the current session via `ui/message`; "Attach" adds context via `ui/update-model-context`; "Copy" uses `navigator.clipboard` with an `execCommand` fallback (panel.html:1277-1288).
- **Banned everywhere:** `eval()` / `window.zcode` / external CDNs (RULE-7); unconditional poll re-render (DEC-3); silent tracker mutation during a scan (DEC-4); bare skill-name recommendations (RULE-2); auto-submitting a launched prompt; infinite scroll; drag-to-reorder.

## Accessibility Floor

Behavioral. Visual contrast lives in [DESIGN.md.Colors](./DESIGN.md#colors) (measured ratios + tracked deviations CD-1…CD-5).

**Contract.**
- WCAG 2.2 AA intent: essential text ≥4.5:1, focus indicators ≥3:1, both themes (DESIGN.md contrast table).
- Every interactive element keyboard-operable; `Tab` order follows reading order; a visible focus indicator on every focusable control.
- Status conveyed by text + color, never color alone (pills carry words; diff carries +/− semantics via line content).
- Live updates (toasts, queue status, progress) announced to assistive tech.
- Motion respects `prefers-reduced-motion`.

**As-built strengths.** Buttons, inputs, selects, and textareas are native elements (keyboard-operable by default). Model-select and search-input show focus via a purple/accent border swap measured at ≥3:1 in both themes (DESIGN.md). Recommendation checkboxes are wrapped in a `<label>` with the title text (panel.html:1824-1827). Status pills and git badges always include text.

**As-built deviations (tracked — close before claiming AA):**
- **AD-1 — Invisible textarea focus.** `.cmd-textarea` sets `outline:none` with no replacement focus style (panel.html:419); the primary editing surface shows no focus ring. Contract: add a visible focus border/ring (≥3:1). (`.model-select` and `.search-input` also set `outline:none` but *do* provide a focus border swap — acceptable.)
- **AD-2 — No tab semantics.** The tab strip uses plain `<button>`s with no `role="tablist"`/`role="tab"`/`aria-selected`, and sections have no `role="tabpanel"` (zero `aria-*`/`role` attributes in the file). Contract: add ARIA tab pattern + arrow-key navigation.
- **AD-3 — Toasts not announced.** `#toastBanner` has no `role="status"`/`aria-live`; screen readers miss launch/copy/error feedback. Contract: `aria-live="polite"` (errors `assertive`).
- **AD-4 — Unassociated labels.** The Queue tab's review-gate and epic-picker `<label>`s (panel.html:859, 869) lack `for`/`id` wrapping; command-editor labels are decorative divs. Contract: associate labels with their controls.
- **AD-5 — Motion not gated.** `.pulse-dot` animates infinitely with no `prefers-reduced-motion` fallback (panel.html:719-729). Contract: disable the pulse under reduced motion.
- **AD-6 — Contrast debt.** DESIGN.md CD-1…CD-4 (muted ink, pill text, dark primary/badge white) remain below AA in places.

## Responsive & Platform

Single surface, fluid narrow column. No breakpoints; the panel adapts by truncation (`text-overflow:ellipsis` on titles/paths) and `flex-wrap:wrap` on action/filter rows, not by reflowing into different layouts. `ui/initialize` declares `availableDisplayModes: ["inline","fullscreen"]` (panel.html:1174-1176); the layout is column-first in both.

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

Journeys mirror the PRD's `UJ-1`…`UJ-4` and named protagonists verbatim.

### Flow 1 — UJ-1: Alex edits a prompt mid-poll and launches a clean session (Alex, solo vibe-coder, just finished a Product Brief)

1. The `Stop` hook updates state; the panel's Next Prompts tab shows three recommendations, top one `/bmad-prd "Create the comprehensive Product Requirements Document…"` paired with `new-provider/claude-opus-5-5-high`.
2. Alex clicks the command `{components.cmd-textarea}` to add a constraint, then opens the model `{components.model-select}`.
3. While Alex types, the 5s timer fires `bmad_get_state`. `isUserInteractingWithForm()` sees the focused textarea (and the select window), so the poll stashes `pendingWorkspaceState` — **no re-render, cursor intact**.
4. Alex blurs the control; `focusout` schedules `flushPendingState()` (50ms), which renders the stashed state. Because the server base command is unchanged, `resolveUserPrompt` keeps Alex's edited text and chosen model.
5. **Climax:** Alex clicks **🚀 Launch in New Session**. `bmad_prepare_new_session` copies the *edited* prompt, dispatches `Ctrl/Cmd+N` + `Ctrl/Cmd+V`, and a fresh ZCode session opens with Alex's exact command pre-pasted — the edit survived every poll, and nothing ran in the old session.

Failure: OS keystrokes blocked → toast "📋 Prompt copied! Press Ctrl+N then Ctrl+V (Model: …)"; the edit is still on the clipboard.

### Flow 2 — UJ-2: Maya reconciles drifting trackers (Maya, tech lead, three stories secretly done)

1. Maya opens Phases & Epics. The strip reads **Smart AI Progress 60% (6/10)** vs **static tracker 30% (3/10)**; three stories show ✨ AI badges with evidence.
2. She clicks **🔍 Preview Diff** → `bmad_reconcile_trackers({dryRun:true})`. The diff card lists `key: in-progress → done` with reasons; **no files touched** (RULE-8).
3. Satisfied, she clicks **⚡ Reconcile Trackers with Reality** → `{dryRun:false, backup:true}`.
4. **Climax:** The engine writes `sprint-status.yaml.bak` and `tickets.toml.bak`, updates statuses + header counters in place (comments preserved), appends to `reconciliation-log.json`, and both progress bars align to **60%**. Toast: "✅ Reconciled N keys across M file(s)!" — the tracker now matches the code, with a rollback path.

Failure: reconciliation error → "❌ Reconciliation error: <message>"; trackers untouched, `.bak` intact.

### Flow 3 — UJ-3: Devon queues an epic with token-saving gates (Devon, multi-agent orchestrator, sprint kickoff)

1. In Queue, Devon picks `epic-auth` in the epic picker and clicks **➕ Queue Epic** → `add-epic` enqueues all open stories in build order.
2. He sets the default review gate to `quick`, overrides routine stories to `none` and the token-rotation story to `thorough`, and assigns `new-provider/claude-sonnet-5-5-high` per task.
3. He clicks **⚡ Run Queue via ZCode Workflow (.dwf.ts)** → `start-queue` compiles `.zcode/workflows/bmad-task-queue.dwf.ts` + `queue-step-updater.mjs` and sends the launch prompt to the session.
4. **Climax:** The live-queue banner appears with a pulsing 🟢 dot; the active-task spotlight shows the running story, its model, and `review=none`. As hooks fire, tasks transition ⏳ → 🟢 → ✓ and story completion auto-updates in Phases & Epics — Devon watches the epic drain without babysitting each session.

Failure: empty queue → "⚠️ Queue is empty! Add tasks or an epic first."; a failed task shows ✗ FAILED and holds the queue for review.

### Flow 4 — UJ-4: Maya inspects an artifact's live diff (Maya, after an agent edited the PRD)

1. Maya opens Artifacts; the directory is sorted newest-first, the PRD row badged `M Modified`.
2. She clicks **🔀 Diff** → `bmad_inspect_artifact` loads the inspector card with the working-tree `git diff` (green additions, red deletions, accent hunks).
3. She toggles **📄 Content** to read the full preview, then back to diff.
4. **Climax:** She clicks **↗ Open File** → `bmad_open_artifact_file` launches the PRD in her desktop editor under workspace confinement (RULE-3) — from a glance at the panel to editing the real file in two clicks, no path hunting.

Failure: path outside `workspaceRoot` is rejected; load error → "Failed to load artifact: <message>" in the inspector.
