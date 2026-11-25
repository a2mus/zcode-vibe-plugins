# Adversarial Architecture Review — `bmad-companion` Spine (RD-7 / RD-9 / OQ-6 Delta)

- **Target:** `_bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md`
- **Cross-checked against live runtime:** `assets/panel.html`, `scripts/bmad-engine.mjs`, `scripts/hook-runner.mjs`, `scripts/mcp-server.mjs`, `tests/panel-guards.test.mjs`
- **Focus ADs attacked:** `AD-3`, `AD-9`, `AD-10`, `AD-14`, `AD-17`, `AD-18` (and interaction with `AD-16`)
- **Date:** 2026-11-25
- **Overall Verdict:** **REVISE BEFORE IMPLEMENTATION (2 Critical, 2 High, 1 Medium incompatibility pairs)**

The spine closes OQ-6 cleanly and establishes the right high-level boundaries (in-iframe unified overlay, single state gateway, deterministic primary focus hero). However, when decomposed one level down into parallel epic/story units, **five concrete contract seams** allow two independently compliant stories — each obeying every AD to the letter — to produce broken runtime behavior: self-expiring focus summaries, history truncation/slot duplication, stale poll rollback over explicit mutations, double-action Escape closing overlays on the first keypress, detached focus targets, silent model-draft wipeouts, and broken R23 panel tests.

---

## Incompatibility Pair 1 — [CRITICAL] `AD-3` + `AD-14` + `AD-18`: `recentConversations` merge/upsert contract, missing `sessionId` in `bmad_update_advisor`, and self-expiring `focusSummary` race

### Compliant Story Pair

- **Story 1A (Core State Gateway & Focus Hero in `scripts/bmad-engine.mjs` — obeys AD-3, AD-14, AD-18):**
  - Extends `savePersistedState` (`scripts/bmad-engine.mjs:1427-1455`) to preserve `recentConversations` when omitted and, when `partial.recentConversations` is supplied, deduplicate by `sessionId`, sort newest-first, and cap at 3 entries (array-replace + normalize, matching how `recentTouchedFiles` is written).
  - Extends `isAdvisorOverrideStale` (`scripts/bmad-engine.mjs:2511-2530`) to expire `agentAdvisorOverride.focusSummary` (or the whole `agentAdvisorOverride`) whenever `recentConversations[0].updatedAt > override.updatedAt`, because `recentConversations` entries only have one timestamp (`updatedAt`) and `agentAdvisorOverride` has no `sessionId`.
  - Updates `updateAdvisorState` (`scripts/bmad-engine.mjs:1479-1537`) to accept `args.focusSummary` and append/write a `recentConversations` entry when invoked.
- **Story 1B (Hook Capture & MCP Surface in `scripts/hook-runner.mjs` + `scripts/mcp-server.mjs` — obeys AD-3, AD-14, AD-18):**
  - Assumes `savePersistedState` performs key-level upsert by `sessionId` (analogous to `storyOverrides` in AD-3). In `handleUserPrompt` (`scripts/hook-runner.mjs:141-178`), calls `savePersistedState(root, { recentConversations: [{ sessionId, updatedAt, promptSnippet, outcomeSnippet: "", touchedCount: 0 }] })`. In `handleStop` (`scripts/hook-runner.mjs:204-292`), calls `savePersistedState(root, { recentConversations: [{ sessionId, updatedAt, promptSnippet: state.lastUserPrompt.slice(0, 300), outcomeSnippet, touchedCount }] })`.
  - In `scripts/mcp-server.mjs`, leaves `bmad_update_advisor` running in the long-lived stdio server (where no per-conversation `CLAUDE_SESSION_ID` env var exists) and keeps `additionalProperties: false` (`scripts/mcp-server.mjs:213`). When `updateAdvisorState` populates `recentConversations`, it falls back to a dated turn entry (`legacy/missing sessionId falls back to a dated turn entry` per AD-18).
  - Keeps `hook-runner.mjs:280`'s gate (`if (aiSynth && Array.isArray(aiSynth.recommendations) && aiSynth.recommendations.length > 0)`) around writing `agentAdvisorOverride`.

### Why They Build Incompatibly

1. **History truncation OR snippet clobber:** AD-3 states *"additive `recentConversations` array (capped at 3 entries, newest first, deduplicated by `sessionId` per AD-18) preserved when omitted"* without stating whether `partial.recentConversations` is a **full replacement array** or an **upsert delta** (or a separate gateway helper like `upsertRecentConversation`). If Story 1A replaces on provide while Story 1B passes a 1-element delta, every hook turn wipes out the prior 2 conversations (`conversationCount` stuck at `1` forever). Even if both implement upsert, AD-3/AD-18 omit **field-level merge rules**: on turn 2 of the same session, `UserPromptSubmit` passing `outcomeSnippet: ""` wipes out the session's previous outcome, while `Stop` reading global `state.lastUserPrompt` can cross-contaminate Session A's prompt onto Session B's entry if two sessions overlap.
2. **Same-conversation slot duplication & false `basisLabel`:** Within one conversation (`sessionId = "sess-1"`), `UserPromptSubmit`/`Stop` writes under `"sess-1"`, while `bmad_update_advisor` (inside long-lived `mcp-server.mjs`, which has no `sessionId` input parameter) writes a synthetic dated-turn entry (`"turn-2026-11-25T..."`). One real conversation now consumes **2 of the 3 rolling slots**, evicting an actual older conversation and inflating `basisLabel` to `"Based on your last 2 conversations"` after a single chat.
3. **Self-invalidating `focusSummary` race on the same turn:**
   - At `T = 10:00:01`, the agent calls `bmad_update_advisor({ focusSummary: "..." })` → `agentAdvisorOverride.updatedAt = 10:00:01`.
   - At `T = 10:00:02` (1 second later, same turn), the turn ends and fires `Stop` → `recentConversations[0].updatedAt = 10:00:02 > override.updatedAt`.
   - Story 1A's staleness check immediately marks `focusSummary` (or the entire `agentAdvisorOverride`, also discarding `recommendations`) as stale! Because `recentConversations` has no `completedAt` distinct from `updatedAt` and `agentAdvisorOverride` has no `sessionId` (nor a separate `focusSummaryUpdatedAt`), the engine cannot distinguish *"the same turn finished 1s after `bmad_update_advisor`"* from *"a newer conversation finished"*.
4. **Strict JSON Schema rejection & silent drop of `focusSummary`:** `bmad_update_advisor` declares `additionalProperties: false` (`scripts/mcp-server.mjs:213`), `updateAdvisorState` only updates `agentAdvisorOverride` when `hasHeadline || hasTurnSummary || hasRecommendations` (`scripts/bmad-engine.mjs:1506-1510`), and `hook-runner.mjs:280` only persists `Stop` LLM output when `recommendations.length > 0`. Neither AD-14 nor AD-18 specifies the exact additive `bmad_update_advisor` input properties (`focusSummary`, optional `sessionId`) or independent persistence when `recommendations` is omitted.

### Spine Fix Required

- **AD-3:** Specify explicit upsert semantics (e.g., dedicated `recentConversationUpdate` patch field or explicit upsert-by-`sessionId` merge rule inside `savePersistedState` that preserves non-empty `promptSnippet`/`outcomeSnippet` when omitted/empty on partial updates, and never allows full-array replacement to drop prior entries accidentally).
- **AD-18 + AD-14:**
  1. Remove `bmad_update_advisor` as an independent `recentConversations` creator, OR add optional `sessionId` to `bmad_update_advisor`'s `inputSchema` and specify that calls without `sessionId` update the most recent active entry (within a recency window) rather than spawning a second synthetic slot.
  2. Add `completedAt` (stamped only on `Stop`) to `recentConversations` entries, add optional `focusSummary` + `sessionId` to `bmad_update_advisor` (`additionalProperties: false` schema) and `agentAdvisorOverride`, and specify exact staleness scope: `focusSummary` expires independently of `recommendations`, and only when a conversation with a **different `sessionId`** completes (`completedAt > override.updatedAt`) or a **subsequent turn** starts (`lastUserPromptAt > override.updatedAt`) and completes after `override.updatedAt` (preventing same-turn `Stop` self-invalidation).

---

## Incompatibility Pair 2 — [CRITICAL] `AD-10` + `AD-17`: Capture-vs-bubble `Escape`/`selectOpenUntil` race, stale `pendingWorkspaceState` rollback, and detached `triggerEl` after explicit overlay mutations

### Compliant Story Pair

- **Story 2A (Unified Overlay Controller & Focus View in `assets/panel.html` — obeys AD-17, AD-10):**
  - Implements the `<div role="dialog" aria-modal="true" aria-labelledby="overlayTitle">` layer and stores `activeOverlay = { kind, targetType, targetKey, triggerEl }`.
  - Attaches an overlay `keydown` listener (on the dialog element or `document` in bubble phase) that implements AD-10's Escape precedence: `if (Date.now() < selectOpenUntil) { selectOpenUntil = 0; return; } closeOverlay();`.
  - On `closeOverlay()`, restores focus via `if (triggerEl && typeof triggerEl.focus === "function") triggerEl.focus(); else focusActiveTabHeading();` and calls `flushPendingState()`.
  - Implements `reconcileActiveOverlay(state)` to refresh the open overlay in place or close it with toast `"That item is no longer available"` when the item disappears.
- **Story 2B (Polling Guard & Explicit Mutation Flow in `assets/panel.html` — obeys AD-10):**
  - Keeps the existing capture-phase `document.addEventListener("keydown", ..., true)` (`assets/panel.html:1280-1297`), which clears `selectOpenUntil = 0` on `Escape` when `activeElement` is `SELECT` and blurs `TEXTAREA`/`INPUT` on `Escape`, scheduling `setTimeout(flushPendingState, 0)`.
  - Adds `if (isOverlayOpen()) return true;` to `isUserInteractingWithForm()` (`assets/panel.html:1258-1262`).
  - Keeps `manageQueue()` (`assets/panel.html:1753-1765`) and `renderWorkspaceState(state)` (`assets/panel.html:1678-1742`) executing immediately on explicit user actions (e.g., changing a queue item's model/review mode or clicking Mark Done / Add to Queue inside an overlay), re-rendering underlying tab sections via `innerHTML = ...` (`assets/panel.html:1991, 2196`) without touching `pendingWorkspaceState`.

### Why They Build Incompatibly

1. **First `Escape` on an open `<select>` closes the entire overlay:** When a user opens a `<select>` inside the overlay (`selectOpenUntil = Date.now() + 15000`) and presses `Escape`, Story 2B's capture-phase listener (`assets/panel.html:1280-1287`) runs **before** Story 2A's bubble/dialog listener and sets `selectOpenUntil = 0`. In the very same `keydown` dispatch, Story 2A then evaluates `Date.now() < selectOpenUntil` → `false` → **closes the whole overlay on the first `Escape`**, directly violating AD-10's Escape precedence. Similarly, pressing `Escape` inside a focused `<textarea>` inside the overlay triggers Story 2B's `active.blur()` + `setTimeout(flushPendingState, 0)` while Story 2A synchronously closes and flushes, racing focus restoration and `focusout` timers.
2. **Stale `pendingWorkspaceState` rolls back newer explicit overlay mutations on close:**
   - At `T = 1s`, a 5s poll arrives while the overlay is open → `refreshState` (`assets/panel.html:1664-1665`) stashes snapshot `S1` in `pendingWorkspaceState`.
   - At `T = 2s`, the user clicks "Mark Done" or changes a model inside the overlay → `manageQueue()` calls `renderWorkspaceState(S2)` (`assets/panel.html:1758`), rendering newer state `S2` and reconciling the overlay. Because `renderWorkspaceState` does not clear `pendingWorkspaceState`, **`pendingWorkspaceState` still holds stale `S1`**.
   - At `T = 3s`, the user closes the overlay → `closeOverlay()` calls `flushPendingState()` → **`renderWorkspaceState(S1)` silently overwrites newer state `S2` with stale `S1`** until the next 5s poll!
3. **Detached `triggerEl` and unowned `reconcileActiveOverlay` call boundary:**
   - Every explicit mutation from inside an overlay re-renders the underlying tab via `container.innerHTML = ...`, immediately detaching `activeOverlay.triggerEl` (`triggerEl.isConnected === false`). If Story 2A uses the panel's existing pattern (`typeof el.focus === "function"`, `assets/panel.html:3097`), `.focus()` silently no-ops on the detached node and focus falls to `<body>`. Even with an `.isConnected` check, focus jumps to the tab heading on *every* post-mutation close instead of returning to the re-rendered card because AD-17 mandates a raw DOM reference (`triggerEl`) rather than a fallback semantic selector.
   - Neither AD-10 nor AD-17 states **who owns calling `reconcileActiveOverlay(state)`**: if Story 2A assumes `renderWorkspaceState` calls it while Story 2B assumes overlay action handlers call it, server-mutated overlays never reconcile; if both call it, the overlay re-renders twice per click and wipes out active focus inside the overlay (e.g., after changing a `<select>` in Queue Focus View).

### Spine Fix Required

- **AD-10:**
  1. Require a **single unified `keydown` capture dispatcher** (replacing split overlay vs. form `Escape` handlers) so `Escape` precedence (`selectOpenUntil` → overlay close → input blur) is evaluated atomically in one branch.
  2. Mandate that any authoritative `renderWorkspaceState(next)` call (explicit user mutation or foreground refresh) **clears `pendingWorkspaceState = null`** (or drops any stashed state with `scannedAt <= next.scannedAt`) so closing an overlay can never roll back to an older poll.
- **AD-17:**
  1. Declare `renderWorkspaceState(state)` as the **single hook point** that invokes `reconcileActiveOverlay(state)` when `activeOverlay !== null` (and specifies preserving intra-overlay focus by `overlay-*` element ID when reconciling in place).
  2. Require `triggerEl` restoration to check `triggerEl?.isConnected`, falling back first to a semantic re-query (`[data-overlay-trigger="<targetType>:<targetKey>"]`) on the re-rendered tab, and only then to the active tab heading.

---

## Incompatibility Pair 3 — [HIGH] `AD-10` + `AD-17`: Unspecified `targetType`/`targetKey` schema, `lastSectionSignatures` blind to draft Maps, `resolveUserModel` base mismatch, and non-unique `rec:<skill>:<title>` keys

### Compliant Story Pair

- **Story 3A (Work Compact Cards, Batch Queue & Section Signatures in `assets/panel.html` — obeys AD-10, RD-9):**
  - Replaces inline `<textarea>`/`<select>` on Work recommendation cards with compact action cards + checkboxes, keeping `lastSectionSignatures.recommendations` hashing `{ recs, models, queueItems, checked }` (`assets/panel.html:2183-2189`) and keeping `selectedRecIndices` (`assets/panel.html:1242`) + `getRecOverrideKey(r, idx)` (`assets/panel.html:1592`).
  - Updates `btnQueueSelectedRecs` (`assets/panel.html:3156-3179`) to stop calling `readCmdEditor`/`readModelEditor` on unmounted DOM IDs and instead call `resolveUserPrompt(recKey, rec.fullCommand || "")` and `resolveUserModel(recKey, rec.recommendedModel?.modelId || "")` (matching existing `assets/panel.html:2297, 3170`).
  - Card click handlers open overlays with `openOverlay({ kind: "action", targetType: "rec", targetKey: getRecOverrideKey(r, idx), triggerEl })`, plus `"queue-item"` / `"story"` / `"insight"` / `"artifact"` for other cards.
- **Story 3B (Work Action Window & Focus View Renderers in `assets/panel.html` — obeys AD-17, AD-10):**
  - Renders Work Action Window fields under `#overlay-rec-cmd` and `#overlay-rec-model` (`overlay-*` IDs per AD-17), writing every edit into `userEditedPrompts`/`userSelectedModels` using `base = (rec.recommendedModel || dynamicFitModel()).modelId || ""` (matching existing `assets/panel.html:2204-2209, 2286`).
  - Dispatches overlay rendering and `reconcileActiveOverlay(state)` via a `switch (activeOverlay.targetType)` expecting `"recommendation" | "queue" | "epic-story" | "smart-insight" | "artifact"` and matching items by `targetKey`.

### Why They Build Incompatibly

1. **Missing `targetType` / `targetKey` canonical table (and keyless `smartInsights`):** AD-17 specifies `activeOverlay = { kind, targetType, targetKey, triggerEl }` but defines zero canonical values for `targetType` or `targetKey`. Stories 3A and 3B can legally pick incompatible strings (`"rec"` vs `"recommendation"`, `"story"` vs `"epic-story"`). Worse, **`smartInsights` entries (`scripts/bmad-engine.mjs:2353-2386`) have no `id` field** (`{ type, severity, title, detail }` only), so two stories invent conflicting keys (`insight:${idx}` vs `insight:${type}:${title}`), causing `reconcileActiveOverlay` to misfire `"That item is no longer available"`.
2. **Stale compact Work card behind Action Window (`lastSectionSignatures` blind spot):** Because `recSig` (`assets/panel.html:2183`) only hashes server `recs` + `availableModels` + `queueItems` + `checked` — not `userEditedPrompts`/`userSelectedModels` — editing a prompt or model inside the Work Action Window leaves the underlying Work card displaying the old server model pill and stale `"In Queue"` badge even after the Action Window closes. Conversely, if Story 3A adds draft Maps to `recSig` while Story 3B calls `renderRecommendations()` on every `input` keystroke, `recommendationsList.innerHTML` is rebuilt on every character typed, detaching `triggerEl` mid-typing.
3. **Silent model-draft wipeout on `base` mismatch:** When a recommendation omits `recommendedModel`, Story 3B records `base = dynamicFitModel().modelId` (e.g. `"anthropic/claude-sonnet"`), while Story 3A's batch enqueue calls `resolveUserModel(recKey, rec.recommendedModel?.modelId || "")`. Because `entry.base !== ""`, `resolveUserModel` (`assets/panel.html:1610-1612`) **deletes the user's chosen model and falls back to `""`** right at enqueue time!
4. **Index fallback & duplicate-key collision in `rec:<skill>:<title>`:** Existing `getRecOverrideKey(r, idx)` (`assets/panel.html:1592-1594`) falls back to DOM `idx` when `skill` or `title` is empty, and collides whenever two recommendations share `(skill, title)`. Meanwhile `selectedRecIndices` (`assets/panel.html:1242`) remains integer-indexed, so a background reorder between checkbox tick and batch enqueue enqueues the wrong recommendation.

### Spine Fix Required

- **AD-17:** Publish a closed `targetType` + `targetKey` canonical table covering every overlayable entity (`recommendation` → semantic rec key, `queue-item` → `item.id`, `story` → `story.overrideKey`, `artifact` → `artifact.relPath`, `insight` → deterministic `${type}:${title}`, `focus-hero` → `"current-focus"` if focusable, or explicitly non-focusable).
- **AD-10:**
  1. Require a **single shared helper** `getServerModelBase(rec)` used by *both* draft writers and `resolveUserModel` readers (Action Window, compact cards, batch enqueue) so `base` can never diverge.
  2. Require batch selection (`selectedRecKeys`) to use the same collision-free semantic key as `userEditedPrompts`/`userSelectedModels` (with deterministic disambiguator if `(skill, title)` repeats, never bare DOM index), and require Work card signatures (`recSig`) to include a deterministic digest of resolved drafts while re-rendering Work cards on **overlay close** (not per-keystroke).

---

## Incompatibility Pair 4 — [HIGH] `AD-9` + `AD-14` + `AD-16`: 5-to-3 tab consolidation (RD-9) vs. `switchTab`, `window.__bmadTestHooks`, `availableDisplayModes`, and stubbed-DOM focus-trap harness

### Compliant Story Pair

- **Story 4A (3-Tab Readability Refactor in `assets/panel.html` — obeys RD-9, AD-9, AD-14, AD-17):**
  - Consolidates the 5 tabs (`advisor`, `queue`, `progress`, `catalog`, `artifacts`) into the 3 RD-9 tabs (`work`, `queue`, `project`), removing `#tab-catalog`, `#skillsCatalogList`, `#agentsCatalogList`, `#skillSearch`, `#skillPhaseFilter`, and `renderSkillsCatalog` from the panel while keeping backend `skillsCatalog`/`agentsCatalog` untouched (obeying AD-14).
  - Updates `switchTab` (`assets/panel.html:3090-3107`) to accept only `["work", "queue", "project"]`, removes `skillsCatalog`/`agentsCatalog` from `lastSectionSignatures` (`assets/panel.html:1243-1253`), and stops sending `"inline"` in `availableDisplayModes` (`assets/panel.html:1391`) since AD-9 notes requesting `"inline"` closes the side pane.
  - Implements AD-17 `Tab` focus trapping using `overlayEl.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")` and sets `inert` on `<main>`.
- **Story 4B (MCP Surface & R23 Verification Harness in `scripts/mcp-server.mjs` + `tests/panel-guards.test.mjs` + `tests/panel-a11y.test.mjs` — obeys AD-9, AD-14, AD-16):**
  - Keeps existing R23 tests invoking `window.__bmadTestHooks` (`assets/panel.html:3333-3370`) — including `switchTab("advisor" | "progress" | "artifacts")`, `renderSkillsCatalog`, and `lastSectionSignatures` keys — plus the minimal stubbed DOM (`tests/panel-guards.test.mjs:119`, where `querySelectorAll()` always returns `[]`).
  - Leaves `renderPhases` artifact-chip clicks (`assets/panel.html:2517`) calling `switchTab("artifacts")` and leaves `_meta["openai/ui"]: { preferredModelDisplayMode: "fullscreen" }` (`scripts/mcp-server.mjs:97, 222, 294`) and `availableDisplayModes: ["inline", "fullscreen"]` checked by handshake tests.

### Why They Build Incompatibly

1. **Silent tab-switch no-ops & broken R23 tests:** No AD defines the canonical 3-tab IDs (`work | queue | project` vs. retaining `advisor | queue | progress`) or the compatibility contract for `window.__bmadTestHooks`. Story 4A deletes `tab-artifacts` and `renderSkillsCatalog`, breaking `renderPhases`'s artifact-chip navigation (`switchTab("artifacts")` at `assets/panel.html:2517`) and failing Story 4B's existing `panel-guards.test.mjs` / `panel-a11y.test.mjs` suites.
2. **Untestable focus trap in AD-16's stubbed-DOM harness:** AD-16 mandates testing overlay guards via the existing stubbed-document harness (no jsdom), where `el.querySelectorAll()` returns `[]` (`tests/panel-guards.test.mjs:119-120`). Story 4A's real-DOM `Tab` focus trap cannot be verified (or throws if reading properties on stub nodes without `inert`/focusable lists) unless AD-16/AD-17 specify the overlay test-hook surface and minimal stubbed-DOM contract.
3. **Contradictory `availableDisplayModes` handshake:** AD-9 says *"requesting `'inline'` closes the side pane"* yet `assets/panel.html:1391` still advertises `availableDisplayModes: ["inline", "fullscreen"]` and `scripts/mcp-server.mjs:97, 222, 294` still emits `"openai/ui": { preferredModelDisplayMode: "fullscreen" }`. Without an explicit rule on which capability list to advertise, Story 4A and Story 4B diverge on the `ui/initialize` handshake contract.

### Spine Fix Required

- **AD-9 / AD-14 / AD-16:**
  1. Fix the canonical 3-tab IDs (`work | queue | project`), require internal callers (like phase artifact chips) to navigate to `project` (or open Artifact Focus View directly), and declare `window.__bmadTestHooks` as the internal R23 test seam updated in lockstep with `panel.html` (listing the required overlay hooks: `openOverlay`, `closeOverlay`, `getActiveOverlay`, `isOverlayOpen`).
  2. Clarify in AD-9 whether `ui/initialize` stays `["inline", "fullscreen"]` (host-compatible) or narrows to `["fullscreen"]`, and that `ui/request-display-mode` is never called by the panel.

---

## Incompatibility Pair 5 — [MEDIUM] `AD-18` + `AD-14` + `AD-17`: Unenumerated `currentFocus.source`, unsanitized AI `focusSummary` jargon leak, and undefined hero overlay/fallback contract

### Compliant Story Pair

- **Story 5A (Engine Focus Hero Builder in `scripts/bmad-engine.mjs` — obeys AD-18, AD-14):**
  - Emits `turnAnalysis.currentFocus = { text, basisLabel, conversationCount, source }` using `source: "deterministic" | "advisor-override" | "stop-synthesis"`.
  - Strips BMAD jargon only in the deterministic template generator; when `agentAdvisorOverride.focusSummary` is fresh, passes `override.focusSummary` straight through to `currentFocus.text` assuming the caller obeyed AD-18's plain-language rule.
  - Keeps `turnAnalysis.aiSummaryHeadline` and `turnAnalysis.lastAssistantSummary` populated with BMAD terms for backward compatibility (AD-14).
- **Story 5B (Panel Focus Hero Renderer in `assets/panel.html` — obeys AD-18, AD-10, AD-17):**
  - Renders the Work hero from `state.turnAnalysis.currentFocus`, styling an AI badge when `currentFocus.source === "ai"` (mismatching Story 5A's `"advisor-override"` / `"stop-synthesis"`).
  - Falls back to `turn.aiSummaryHeadline` (`assets/panel.html:1730-1731`) if `currentFocus?.text` is empty, leaking BMAD jargon back into the hero on fresh/legacy payloads.
  - Renders the hero via direct `textContent` assignment (`assets/panel.html:1730-1733`) without a signature guard, and either makes the hero open Focus View with `targetType: "focus-hero", targetKey: "current-focus"` or treats it as non-focusable.

### Why They Build Incompatibly

1. **Enum mismatch on `currentFocus.source`:** AD-18 names the field `source` in `{ text, basisLabel, conversationCount, source }` without enumerating its allowed values, so engine and panel silently disagree (`"advisor-override"` vs `"ai"`).
2. **Zero-jargon invariant bypassed by AI override or legacy fallback:** Any external agent passing `/bmad-build` or `sprint-status.yaml` in `bmad_update_advisor({ focusSummary })` injects raw BMAD jargon directly into the hero unless the engine enforces a deterministic jargon filter/rejection gate on *both* deterministic and AI-override `text`, and unless the panel's fallback string is also plain-language (never `turn.aiSummaryHeadline`).

### Spine Fix Required

- **AD-18:**
  1. Enumerate `currentFocus.source` explicitly: `"workspace" | "conversations" | "ai-override"` (or `"deterministic" | "ai"`).
  2. Require the engine to enforce the zero-jargon invariant (`!/\/bmad-[a-z0-9-]+|\b(sprint-status\.yaml|tickets\.toml|epic-\d+|phase\s+[1-4])\b/i`) on `focusSummary` overrides as well (rejecting/falling back to deterministic text on violation), and require the panel hero fallback to be plain-language rather than `turnAnalysis.aiSummaryHeadline`.

---

## Summary Patch Checklist for `architecture-bmad-companion.md`

| Priority | AD(s) | Minimal Contract Addition Needed |
| --- | --- | --- |
| **Critical** | AD-3, AD-14, AD-18 | Define `recentConversations` upsert + field-preserve merge semantics in `savePersistedState`; add `completedAt` to entries; resolve `bmad_update_advisor` `sessionId` + `focusSummary` schema (`additionalProperties: false`); make `focusSummary` staleness scope independent of `recommendations` and immune to same-turn `Stop`. |
| **Critical** | AD-10, AD-17 | Require a single unified `keydown` capture dispatcher for `Escape` precedence; require `renderWorkspaceState` to clear stale `pendingWorkspaceState` and be the sole caller of `reconcileActiveOverlay`; require semantic fallback selector for `triggerEl` focus restoration after tab `innerHTML` re-render. |
| **High** | AD-10, AD-17 | Publish the closed `targetType`/`targetKey` table (including deterministic `insight` key); unify `getServerModelBase(rec)` across writers and readers; move batch selection off integer `selectedRecIndices` to collision-free semantic keys; include draft-Map digest in Work `recSig` and re-render Work cards on overlay close (not per-keystroke). |
| **High** | AD-9, AD-14, AD-16 | Fix canonical 3-tab IDs (`work | queue | project`), artifact-chip navigation target, `ui/initialize` `availableDisplayModes` value, and required overlay hooks in `window.__bmadTestHooks` for the stubbed-DOM R23 harness. |
| **Medium** | AD-18 | Enumerate `turnAnalysis.currentFocus.source`, enforce zero-jargon validation on AI `focusSummary` overrides in the engine, and forbid panel hero fallback to `turnAnalysis.aiSummaryHeadline`. |
