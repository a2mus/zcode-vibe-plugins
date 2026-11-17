---
name: 'review-adversarial'
target: '../architecture-vibe-debrief.md'
reviewer: 'Adversarial Architecture Reviewer'
date: '2026-11-17'
verdict: 'CONDITIONAL PASS'
---

# Adversarial Architecture Review — `vibe-debrief`

**Target Spine:** `architecture-vibe-debrief.md` (`v0.2.0`)
**Verdict:** **CONDITIONAL PASS**

The 4-layer unidirectional architecture (AD-1, AD-2), stdout isolation (AD-3), zero-dependency constraint (AD-4), and reading-boundary principle (AD-7) form a clean structural foundation. However, attacking the spine at unit boundaries reveals **7 concrete collision scenarios** where two developers or epics can each obey every AD and Consistency Convention to the letter yet produce incompatible, data-corrupting, or runtime-breaking implementations.

These holes must be closed by tightening existing ADs and adding missing invariants before parallel feature work proceeds.

---

## Findings Summary

| ID | Collision Area | Violated / Missing Governance | Severity |
| --- | --- | --- | --- |
| **F-1** | Concurrent multi-process state corruption (`mcp-server` vs `hook-runner`) | AD-5 claims concurrency safety without locking, atomic writes, or patch-level merge | **High** |
| **F-2** | Split `Debrief` assembly & mutation across MCP, Hook, and Engine | AD-5 governs file I/O, not domain object construction or state-patch boundaries | **High** |
| **F-3** | State schema drift between Engine, Hook, and Panel (`vibe-debrief-state.json` & `PanelState`) | AD-1 assigns schema ownership to Engine without a versioned schema or normalizer contract | **High** |
| **F-4** | `renderPanelState(state)` transient UI state clobbering & partial-state ambiguity | AD-10 names one entry point but omits state-merge, error-state, and transient-UI boundaries | **Medium** |
| **F-5** | Error shape divergence (`isError` without `structuredContent`, silent Hook failures) | Consistency Conventions define MCP/Hook error shapes independently of Panel consumers | **Medium** |
| **F-6** | Hook mode naming, `hooks.json` matcher collisions, and tool-catalog drift | Consistency Conventions omit hook CLI modes, matcher uniqueness, and tool-list sync | **Medium** |
| **F-7** | Turn-lifecycle race on `agentPublishedThisTurn` (`Stop` vs `UserPromptSubmit` vs `CreateSession`) | AD-7 & AD-11 lack turn-correlation IDs (`turnId`) | **Medium** |

---

## Detailed Adversarial Scenarios

### F-1: Concurrent Multi-Process State Corruption (AD-5)

**The Spine Claim:**
AD-5 states: *"Prevents: Split persistence logic; concurrent state corruption from multiple writers."* Consistency Conventions state: *"Engine: read-modify-write via `loadPersistedState` -> merge patch -> `savePersistedState`. Always merges; never replaces the full state object."*

**The Collision Scenario:**
`mcp-server.mjs` runs as a long-lived stdio server, while `hook-runner.mjs` is spawned as a separate OS process on every `UserPromptSubmit`, `PostToolUse`, and `Stop` event.
- **Unit A (MCP Tool):** User clicks a checklist item (`vibe_debrief_toggle_check`) or switches persona (`vibe_debrief_set_persona`). `mcp-server.mjs` calls `loadPersistedState(root)` at $t_0$, mutates `currentDebrief.verificationChecklist`, and calls `savePersistedState(root, { currentDebrief })` at $t_2$.
- **Unit B (Hook Runner):** Simultaneously, ZCode fires `PostToolUse` (updating `recentTouchedFiles`) or `Stop` (updating `turnCount` and `lastAssistantMessage`). `hook-runner.mjs` calls `loadPersistedState(root)` at $t_1$ and `savePersistedState(root, ...)` at $t_3$.

Both units obey AD-5 to the letter (neither performs direct file I/O; both go through `savePersistedState`). Yet three failures occur:
1. **Lost Update (TOCTOU):** Unit B's read at $t_1$ predates Unit A's write at $t_2$, so Unit B's write at $t_3$ silently erases Unit A's checklist toggle or persona change.
2. **Torn JSON -> Full State Reset:** `savePersistedState` writes directly to `vibe-debrief-state.json` without write-to-temp + atomic `renameSync` or an advisory lockfile. A reader hitting a partial write fails `JSON.parse` and silently falls back to `createDefaultState()`, wiping `history`, `confirmedLessons`, and `turnCount`.
3. **Shallow-Merge Clobbering:** `savePersistedState` performs a shallow spread (`{ ...current, ...patch }`). Two tools/hooks patching different sub-fields of `currentDebrief` overwrite each other's nested changes.

**Required Spine Fix (Tighten AD-5):**
- Mandate **atomic writes** (`writeFileSync` to `.zcode/vibe-debrief-state.json.tmp.<pid>` + `renameSync`) and **advisory file locking** (or bounded retry lockfile `.zcode/vibe-debrief-state.lock` with stale-lock TTL) inside `savePersistedState`.
- Replace raw `savePersistedState(root, patch)` calls with **intent-specific atomic mutators** in Engine (e.g., `updateStateAtomically(root, (current) => patch)`) so the read-modify-write happens *inside* the lock rather than across caller boundaries.

---

### F-2: Conflicting State Mutation Patterns Across New MCP Tools & Hooks (AD-5, AD-1)

**The Spine Claim:**
AD-5 forbids MCP and Hook from performing direct file I/O, and AD-1 assigns "pure domain logic, state schemas" to Engine. However, AD-5 does not forbid MCP or Hook from constructing `currentDebrief`, `history`, or `lessonsLearned` objects and passing them to `savePersistedState`.

**The Collision Scenario:**
- **Developer A** adds a new MCP tool (e.g., `vibe_debrief_pin_note` or `vibe_debrief_publish` extension) in `mcp-server.mjs`. Obeying AD-5, they call `loadPersistedState(root)`, construct/mutate `draftDebrief` and `history` inside `mcp-server.mjs` (matching the existing pattern in `vibe_debrief_publish`), and pass `{ currentDebrief, history }` to `savePersistedState`.
- **Developer B** adds a new feature in `hook-runner.mjs` (or a second MCP tool) that also mutates `currentDebrief` or `history`, using slightly different defaults, `history` cap/dedup rules, or `ste100Polish` application order.

Both developers obey AD-1, AD-2, AD-5, and AD-7 to the letter. Yet `mcp-server.mjs` and `hook-runner.mjs` now have two diverging domain-object builders, causing `history` entries, `id` formats, or `ste100Metrics` to differ depending on whether a debrief came from MCP or Hook.

**Required Spine Fix (Tighten AD-5 & AD-1):**
- Prohibit `mcp-server.mjs` and `hook-runner.mjs` from constructing or mutating persisted domain entities (`currentDebrief`, `history`, `confirmedLessons`, `recentTouchedFiles`) directly.
- Require all state mutations to flow through **Engine domain commands** (e.g., `publishDebrief(root, input)`, `recordTouchedFiles(root, files, cmdStatus)`, `toggleVerificationCheck(root, checkId)`), leaving MCP and Hook as thin argument-validation/transport adapters.

---

### F-3: State Schema Drift Between Engine, Persisted JSON, and Panel UI (AD-1, AD-10)

**The Spine Claim:**
AD-1 states Engine owns "state schemas", and Consistency Conventions specify `camelCase` keys and ID formats. However, the spine defines **no canonical `PanelState` / `Debrief` schema**, no `schemaVersion` field in `vibe-debrief-state.json`, and no runtime normalizer contract.

**The Collision Scenario:**
- **Unit A (Engine / Hook epic):** Evolves `Debrief` (e.g., renames `explainerScenes[].narration` to `caption`, adds required `complexity.factors[]`, or changes `proofClaims[].status` enum) and updates `buildFullPanelState` / `synthesizeHeuristicDebrief`.
- **Unit B (Panel UI epic):** Builds a new Panel feature against the previously observed `PanelState` shape (reading `scene.narration`, `d.complexity.level`, or `state.personas`).

Both units obey every AD and use `camelCase` keys. Yet:
1. `panel.html` receives `undefined` for renamed/missing fields and throws inside `renderPanelState`, crashing the entire panel.
2. Existing workspaces with a `v0.2.0` `.zcode/vibe-debrief-state.json` load stale `currentDebrief` and `history` objects that bypass new defaults unless every nested field is normalized on load.

**Required Spine Fix (New AD — Canonical `PanelState` Schema & Migration):**
- Define a `schemaVersion` integer on `vibe-debrief-state.json` and `PanelState` (with an Engine `migrateAndNormalizeState(raw)` step inside `loadPersistedState`).
- Document the canonical `PanelState` and `Debrief` contract (required top-level keys, nested array shapes, enum values) in the spine or a referenced schema module in `debrief-engine.mjs` that both `buildFullPanelState` and `panel.html` treat as immutable contract.

---

### F-4: `renderPanelState(state)` Call-Site & Transient UI State Divergence (AD-9, AD-10)

**The Spine Claim:**
AD-10 states: *"`panel.html` has exactly one render entry point: `renderPanelState(state)`. All tool results and host notifications converge through it. It dispatches to `renderActiveDebrief`, `renderExplainerTab`, `renderMemoryBank`, `renderHistoryList`. No component updates itself independently."*

**The Collision Scenario:**
AD-10 mandates the single entry point `renderPanelState(state)` without specifying:
1. Whether `state` must always be a complete `PanelState` or may be a partial state object.
2. How **transient UI state** (active tab, `inspectedNodeId`, Canvas `currentSceneIndex` / `isPlaying`, speech synthesis state, scroll position) is preserved across `renderPanelState(state)` calls.

- **Developer A** builds an interactive feature (e.g., node inspector or tab switcher) that relies on `uiState` staying intact when background `tools/call` responses arrive via `ui/notifications/tool-result`.
- **Developer B** implements a new panel action (e.g., `vibe_debrief_toggle_check` or a new filter/tag tool) that calls `renderPanelState(result.structuredContent)` or passes a partial `{ currentDebrief }` object to `renderPanelState`.

Both obey AD-10 to the letter. Yet Developer B's call either wipes `panel.html` sub-views (when passing a partial state) or resets Developer A's active tab, closes the node inspector, and halts Canvas playback on every background tool result.

**Required Spine Fix (Tighten AD-10):**
- Specify that `renderPanelState(panelState)` **only** accepts a complete `PanelState` (never a partial patch, never an error object).
- Partition `panel.html` state explicitly into **Server State** (`panelState`, replaced atomically by `renderPanelState`) and **Transient UI State** (`uiState`: active tab, `inspectedNodeId`, `explainerPlayback`, preserved across `renderPanelState` unless `panelState.currentDebrief.id` changes).
- Require `renderPanelState` to wrap each of its 4 sub-renderers in isolated `try/catch` blocks so a schema mismatch in one tab does not blank the entire panel.

---

### F-5: Error Shape Divergence Between MCP, Hook, and Panel (AD-9, AD-11, Consistency Conventions)

**The Spine Claim:**
Consistency Conventions define:
- MCP tool errors: `{ isError: true, content: [{ type: "text", text }] }` (no `structuredContent`).
- JSON-RPC protocol errors: `-32601`, `-32602`, `-32603`.
- Hook: *"never throws — catches everything, falls back to `{}` or `null`."*

**The Collision Scenario:**
1. **MCP -> Panel Error Mismatch:** Developer A adds a new MCP tool that catches an Engine exception and returns `{ isError: true, content: [{ type: "text", text: "Export failed" }] }` per Consistency Conventions. Developer B writes a Panel `callTool` handler that forwards `res.structuredContent || res` to `renderPanelState(...)`. Because `isError: true` omits `structuredContent`, `renderPanelState` receives `{ isError: true, content: [...] }`, fails to find `currentDebrief`, and corrupts or blanks the UI instead of showing a non-destructive error banner.
2. **Hook Diagnostic Channel Gap:** AD-11 and AD-3 forbid writing errors to `stdout` in `hook-runner.mjs`, but the spine specifies **no diagnostic channel** for caught hook errors. Developer A logs to `process.stderr.write`, Developer B swallows errors silently, and Developer C puts an error notice into `additionalContext` (injecting internal failure text into the LLM prompt).

**Required Spine Fix (Tighten AD-9, AD-11, Consistency Conventions):**
- **Panel Error Gate:** Mandate that `panel.html`'s `callTool` / `tool-result` dispatcher checks `res.isError` and `rpcError` *before* `renderPanelState(state)`, routing errors to a dedicated non-destructive `showPanelNotice(text, "error")` without touching `panelState`.
- **Hook Diagnostics Convention:** Standardize caught hook errors to `process.stderr.write("[vibe-debrief:hook] ...\n")` (never `stdout`, never `additionalContext`).

---

### F-6: Hook Mode Naming, `hooks.json` Matcher Collisions, and Tool-Catalog Drift (AD-1, AD-9, Consistency Conventions)

**The Spine Claim:**
Consistency Conventions specify `snake_case` with `vibe_debrief_` prefix for MCP tool names, `camelCase` for Engine exports/state keys, and `{purpose}.mjs` for backend files. However, the spine does **not** govern:
- `hook-runner.mjs` CLI mode naming (`session-start`, `user-prompt`, `post-tool`, `stop` are `kebab-case`).
- `hooks/hooks.json` multiple-entry ordering or matcher deduplication.
- Synchronization between `mcp-server.mjs` (`tools/list`) and `panel.html` (which AD-9 notes calls *"6 tool names"*).

**The Collision Scenario:**
- **Developer A** adds a new hook event in `hooks/hooks.json` (e.g., `PreCompact` or a second `Stop` hook) using `camelCase` mode `preCompact` or `snake_case` `pre_compact`, or registers a second `Stop` handler without coordinating with the existing `stop` handler — causing `turnCount` to double-increment and `agentPublishedThisTurn` to be cleared by the first handler before the second runs.
- **Developer B** adds a new panel-callable MCP tool `vibe_debrief_delete_lesson` in `mcp-server.mjs` and `panel.html`, while Developer C adds `vibe_debrief_lesson_delete` in `skills/*/SKILL.md` — or calls it from `panel.html` without updating `panel.html`'s tool-call wrapper/allowlist.

**Required Spine Fix (Extend Consistency Conventions & AD-1):**
- Add **Hook CLI modes**: `kebab-case` matching ZCode event name (`session-start`, `user-prompt`, `post-tool`, `stop`), **one** `hooks.json` entry per lifecycle event.
- Designate `mcp-server.mjs` `TOOLS` definition as the single source of truth for tool names/schemas, and align AD-9's tool-call list (`6` panel-callable tools vs `8` total) explicitly in the spine.

---

### F-7: Turn-Lifecycle Race on `agentPublishedThisTurn` (AD-7, AD-11, Debrief Data Flow)

**The Spine Claim:**
The Debrief Data Flow and `AGENTS.md` rely on a boolean flag `agentPublishedThisTurn` (set by `vibe_debrief_publish`, cleared by `Stop`) to prevent the `Stop` hook from overwriting an agent-published debrief.

**The Collision Scenario:**
- **Unit A (`UserPromptSubmit` / `CreateSession` Deep Refresh):** User clicks `✨ AI Explain` (`ui/message` -> `CreateSession` -> `vibe_debrief_publish`), or starts a new prompt while a previous turn's `Stop` hook is still running its 4500ms `tryOptionalAiDebriefSynthesis` request.
- **Unit B (`Stop` hook):** `Stop` fires on an aborted turn, a subagent turn, or finishes its 4500ms AI request *after* the next turn's `UserPromptSubmit` or `vibe_debrief_publish` has already run.

Because `agentPublishedThisTurn` is an un-scoped boolean rather than a turn-correlated ID, Unit B either overwrites the newer `vibe_debrief_publish` debrief with stale heuristic output, or clears `agentPublishedThisTurn` prematurely so the next `Stop` overwrites it.

**Required Spine Fix (Tighten AD-7 / State Contract):**
- Replace the bare boolean `agentPublishedThisTurn` with `lastPublishedTurnId` (or `activeTurnId` minted on `UserPromptSubmit` and checked atomically by `Stop` before writing `currentDebrief`).

---

## Recommended AD Checklist Before Next Epic

1. **Tighten AD-5:** Add atomic temp+rename writes, advisory lockfile, and Engine-owned domain mutators (no raw `currentDebrief`/`history` construction in MCP or Hook).
2. **Add AD-14 (Canonical `PanelState` Schema & Migration):** Version `vibe-debrief-state.json` (`schemaVersion`) and normalize on `loadPersistedState`.
3. **Tighten AD-10:** Separate `panelState` from `uiState`, require complete `PanelState` inputs, and isolate sub-renderers with `try/catch`.
4. **Tighten AD-9 & AD-11:** Guard `renderPanelState` against `isError: true` / `rpcError` payloads; standardize Hook error logging to `stderr`.
5. **Extend Consistency Conventions:** Specify `kebab-case` hook modes, one-entry-per-event in `hooks.json`, and `turnId` correlation for `Stop` vs `vibe_debrief_publish`.
