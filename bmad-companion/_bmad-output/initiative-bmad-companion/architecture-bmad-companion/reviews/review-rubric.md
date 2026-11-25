---
title: Architecture Spine Rubric Review — bmad-companion
reviewed_artifact: _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
reviewed_updated: '2026-11-25'
review_date: '2026-11-25'
verdict: REVISE BEFORE FREEZE
---

# Architecture Rubric Review — bmad-companion

**Overall Verdict:** **REVISE BEFORE FREEZE** (0 Critical, 4 High, 2 Medium, 4 Low)

The 2026-11-25 amendments (`AD-3`, `AD-9`, `AD-10`, `AD-14`, `AD-16`) and new decisions (`AD-17`, `AD-18`) make strong, well-scoped architectural calls: closing `OQ-6` against verified ZCode Desktop behavior, unifying Focus View (`RD-7`) and Work Action Window (`RD-9`) under one in-iframe overlay controller with no cloned DOM IDs, adding an overlay clause and `Escape` precedence to the polling guard, preserving `skillsCatalog`/`agentsCatalog` in `bmad_get_state`, and designing an offline deterministic 3-conversation focus hero grouped by `sessionId`.

However, the spine is not yet ready to freeze from `draft` to `final`. Four High-severity gaps remain across two fronts: (1) cross-unit contract holes and one direct rule contradiction inside the 2026-11-25 amendments (`AD-18`/`AD-14`/`AD-3`, `AD-8` vs `RD-9` plain-language Work cards, and `AD-17`/`AD-10` overlay action/keying contracts), and (2) stale v0.5.2 statements and diagrams that contradict the shipped v0.5.4 codebase (OS automation ownership, Stop LLM egress diagram, `check-version-sync.mjs` enforcement, and `SCAN_LIMITS` / `OQ-C` / `OQ-H` / `tests/` drift).

---

## Good-Spine Checklist Scorecard

| Rubric Criterion | Rating | Summary |
| --- | --- | --- |
| 1. Fixes real divergence points for the level below and misses none | **Needs Revision** | Core overlay/polling/ring-buffer risks are caught, but `AD-18` omits `bmad_update_advisor` schema & `sessionId` correlation, `AD-10` misses `selectedRecIndices` index-keying, `AD-17` omits canonical `targetType`/`targetKey` mapping, and `AD-8`/`AD-18` omit Work card plain-language sourcing. |
| 2. Every AD's Rule is enforceable and prevents its stated divergence | **Needs Revision** | Most ADs are crisp, but `AD-10` contradicts `AD-17` + `EXPERIENCE.md` on `"Add to Queue"` reconciling in place vs tab-jumping; `AD-14` claims `check-version-sync.mjs` enforces panel versions when it does not; `AD-18` leaves merge ownership, staleness timestamp, and AI-override jargon rejection unenforceable. |
| 3. Nothing under Deferred could let two units diverge | **Pass (with wording fix)** | All deferred items (`OQ-1`, `OQ-2`, `OQ-3`, AST checker, event bus, non-ZCode ports, visual tokens, model roster) are cleanly fenced. Only `OQ-2`'s note `"no CI infrastructure exists yet"` is factually stale against `../.github/workflows/validate.yml`. |
| 4. Ratifies rather than contradicts the brownfield codebase | **Needs Revision** | Multiple sections still describe v0.5.2 rather than shipped v0.5.4: OS automation moved to `bmad-engine.mjs:4464-4611`, Stop LLM egress belongs to `hook-runner.mjs:71` (not `mcp-server.mjs`), `SCAN_LIMITS` already landed (`OQ-C` partially closed), `OQ-H` is closed, 16 `tests/` files exist, and dozens of line citations are broken. |
| 5. No quiet requirement from EXPERIENCE.md (RD-7, RD-9, OQ-6) was dropped | **Needs Revision** | `OQ-6` is cleanly closed. Two quiet requirements were dropped or clipped: `RD-9`'s "Work speaks human" rule applies to Work next-action cards (not only the hero), and `RD-7`'s interactive-descendant click guard ("buttons, tabs and status labels keep their normal click") and full 8-target focusable surface list (including reconciliation diffs & active-task spotlight) are unspecified. |
| 6. Every dimension the altitude owns is decided, deferred, or an open question | **Pass (with gaps above)** | Paradigm, state, contracts, security/confinement, SLOs, UI concurrency/overlay, verification, and operational envelope are all addressed at the right altitude once the High/Medium gaps above are closed. |

---

## Detailed Findings (Tiered)

### High Findings

#### H-1 — AD-18 / AD-14 / AD-3: Underspecified `recentConversations` & `focusSummary` cross-unit contract
- **Rubric criteria:** Fixes real divergence points; Enforceable rules
- **Where:** `architecture-bmad-companion.md` lines 72 (`AD-3`), 138 (`AD-14`), 173 (`AD-18`); brownfield `scripts/mcp-server.mjs:124-214`, `scripts/bmad-engine.mjs:1427-1455, 1479-1537`, `scripts/hook-runner.mjs:71-124, 141-156, 204-292`
- **Issue:** Four cross-unit divergence points remain open between `bmad-engine.mjs`, `mcp-server.mjs`, and `hook-runner.mjs`:
  1. **`bmad_update_advisor` schema lock:** `TOOLS[2]` (`bmad_update_advisor`) declares `additionalProperties: false` (`scripts/mcp-server.mjs:213`) and accepts only `headline`, `turnSummary`, `recommendations`, `hostModels`, and `storyStatusUpdates`. `AD-18` requires pushing `focusSummary` and populating `recentConversations` via `bmad_update_advisor`, yet neither `AD-14` nor `AD-18` binds the additive schema fields (`focusSummary`, optional `sessionId` / `promptSnippet` / `outcomeSnippet`).
  2. **Cross-process `sessionId` correlation gap:** `hook-runner.mjs:306` reads `CLAUDE_SESSION_ID || ZCODE_SESSION_ID`, while `mcp-server.mjs` is a long-lived stdio server that does not read any session env var today. If `hook-runner.mjs` writes a `recentConversations` entry keyed by `sessionId`, and `bmad_update_advisor` writes an entry for the same turn without a `sessionId` (falling back to a dated turn entry), one chat will occupy two of the three slots and evict an earlier conversation.
  3. **Merge ownership & staleness timestamp:** `AD-3` states `recentConversations` is preserved when omitted and capped at 3 / deduplicated by `sessionId` per `AD-18`, but does not specify whether `savePersistedState` itself performs the upsert-dedup-cap merge (e.g., via an explicit upsert helper or gateway merge rule) or whether each caller (`UserPromptSubmit`, `Stop`, `updateAdvisorState`) re-implements array manipulation. Likewise, `AD-18` says `focusSummary` expires "whenever a newer conversation finishes after `override.updatedAt`", but entry schema only lists `updatedAt` (touched by both `UserPromptSubmit` and `Stop`) — leaving ambiguous whether starting a prompt immediately expires `focusSummary` or only a `Stop`-recorded completion timestamp (e.g., `finishedAt` / `lastTurnAnalyzedAt`) does.
  4. **Enforcing "zero BMAD jargon" on AI overrides:** `AD-18` guarantees plain language with zero BMAD jargon on `turnAnalysis.currentFocus.text`, yet allows AI-written `focusSummary` (from `bmad_update_advisor` or `Stop` LLM synthesis, whose prompt at `hook-runner.mjs:82` does not yet request `focusSummary`) to override `text` without specifying an engine-side jargon gate (reject/fallback to deterministic if `/bmad-*`, phase codes, or tracker terms appear).
- **Recommended fix:**
  - Specify in `AD-3` + `AD-18` that `savePersistedState` (or a single engine helper invoked through `savePersistedState`) owns `recentConversations` upsert/dedup/cap, preserving prior `outcomeSnippet` on `UserPromptSubmit` updates within the same `sessionId`.
  - Specify the exact additive `bmad_update_advisor` inputs (`focusSummary`, optional `sessionId`) in `AD-14`/`AD-18`, and define how `bmad_update_advisor` correlates with the latest active `sessionId` (explicit `args.sessionId` or updating the newest open session entry rather than minting a duplicate dated entry).
  - Add a dedicated completion timestamp (`finishedAt` on `recentConversations` entries, stamped on `Stop`, or compare against `lastTurnAnalyzedAt` / latest `Stop` entry) for `focusSummary` staleness, and require an engine-side jargon validation check on AI `focusSummary` overrides (falling back to deterministic `text` on violation).

#### H-2 — RD-9 quiet requirement dropped in AD-8 / AD-18: Work next-action cards plain-language contract
- **Rubric criteria:** No quiet requirement from EXPERIENCE.md dropped; Fixes real divergence points; AD-2 compliance
- **Where:** `EXPERIENCE.md` lines 40, 94–95, 315–318; `architecture-bmad-companion.md` lines 102 (`AD-8`), 173 (`AD-18`); brownfield `scripts/bmad-engine.mjs:2660-2775`
- **Issue:** `EXPERIENCE.md` (`RD-9`, binding owner direction) requires the **entire Work tab** — not only the Current-Focus Hero — to speak plain human language with zero BMAD jargon: *"no skill ids, phase codes or tracker terms on this tab. The technical wording lives in Project and inside each action's window."* Specifically, Work recommendation cards show *"a plain title and a one-line reason, without jargon; selecting it opens the action window."*
  In the brownfield engine (`scripts/bmad-engine.mjs:2684-2770`), `scan.recommendations[]` emits `title` and `rationale` saturated with BMAD terms (`"Use /bmad-ux..."`, `"Run Multi-Lens BMAD Code Review..."`, `"BMAD-METHOD recommends running /bmad-code-review..."`, `"Phase 1 discovery..."`, `"completing stories or reconciling trackers"`, `"Story 2.1 in '...' is currently marked 'in-progress'"`).
  Because `AD-18` only covers `turnAnalysis.currentFocus`, and `AD-8` leaves `recommendations[]` untouched, downstream Work-tab stories will either (a) ship jargon on Work cards (violating `RD-9`) or (b) add regex/text-rewriting rules inside `assets/panel.html` (violating `AD-2`).
- **Recommended fix:** Extend `AD-8` (or `AD-18`) to require `bmad-engine.mjs` to emit additive, jargon-free display fields on each recommendation (e.g., `plainTitle` and `plainReason`, keeping `title`/`rationale`/`skill`/`phase`/`fullCommand` intact for `AD-14` backward compatibility and the Action Window's "Technical details" line), with the same deterministic jargon-free guarantee tested under `AD-16`.

#### H-3 — AD-10 & AD-17: Contradiction on "Add to Queue" inside overlay, missing batch-selection keying, and incomplete RD-7 overlay target/click contract
- **Rubric criteria:** Enforceable rules; Fixes real divergence points; No quiet requirement from EXPERIENCE.md dropped
- **Where:** `architecture-bmad-companion.md` lines 114 (`AD-10`), 156–167 (`AD-17`); `EXPERIENCE.md` lines 42, 48, 94–95, 114, 196–198; brownfield `assets/panel.html:1242, 2165-2280, 3148-3179`
- **Issue:** Three concrete flaws in the `AD-10` / `AD-17` overlay & draft contract:
  1. **Direct rule contradiction:** `AD-10` (line 114) cites `"Add to Queue"` as an example of an explicit action triggered inside an open overlay that *"reconcile[s] the open overlay in place"*. However, `EXPERIENCE.md:48` mandates that `"Add to Queue"` from the Action Window jumps to `queue` (`switchTab("queue")`), and `AD-17` mandates that switching tabs closes any open overlay. Those two rules cannot both be true.
  2. **Index-keyed batch selection left behind:** `AD-10` rightly mandates semantic keying (`rec:<skill>:<title>`) for `userEditedPrompts`/`userSelectedModels` and forbids DOM lookup of unmounted cards. However, brownfield batch selection uses `selectedRecIndices = new Set()` keyed by numeric array index (`assets/panel.html:1242, 2220, 3151, 3163`). If a background poll reorders or removes a recommendation between checking boxes and clicking `Add Checked (N) to Queue`, index-keyed selection silently enqueues the wrong recommendation.
  3. **Missing `RD-7` target vocabulary and interactive-descendant click guard:** `AD-17` defines `activeOverlay = { kind, targetType, targetKey, triggerEl }` but does not fix the `targetType` / `targetKey` vocabulary across all 8 focusable `RD-7` surfaces named in `EXPERIENCE.md:114` (next actions, queued tasks, active-task spotlight, epics, stories, phases, files, and reconciliation diffs — plus section-level `⤢ Expand`). Nor does `AD-17` bind `RD-7`'s explicit interactive-descendant guard (*"buttons, tabs and status labels keep their normal click"*) without violating `EXPERIENCE.md` Accessibility Floor (no nested interactive elements). Without this rule, Work/Queue/Project stories can diverge on key resolution and accidentally swallow button/select/checkbox clicks inside cards.
- **Recommended fix:**
  - Remove `"Add to Queue"` from `AD-10`'s reconcile-in-place examples and state explicitly: actions that trigger a cross-tab jump (e.g., Action Window `"Add to Queue"` → `switchTab("queue")`) close the overlay via `switchTab` and flush pending state; in-tab mutations (queue model/review change, Mark Done, retry, diff toggle) reconcile the open overlay in place.
  - Extend `AD-10` to require Work batch selection (`selectedRecKeys`) to use the same semantic key (`rec:<skill>:<title>`) rather than numeric index.
  - Fix the canonical `targetType` → `targetKey` table in `AD-17` (`action`/`rec` → `rec:<skill>:<title>`, `queue-item` → `item.id`, `queue-spotlight` → `activeTask.id`, `epic` → `epic.slug`, `story` → `story.overrideKey`, `phase` → `phase.id`, `artifact` → `artifact.relPath`, `reconciliation-diff` → `"reconciliation-diff"`, `section` → `<sectionId>`) and bind the card click-delegation guard (ignore clicks originating inside `button, a, input, select, textarea, label, [role="tab"], .pill`, paired with a native `⤢ Expand` button for keyboard activation).

#### H-4 — Material brownfield contradictions against shipped v0.5.4 code (Paradigm, AD-2, AD-14, AD-15, Topology)
- **Rubric criteria:** Ratifies rather than contradicts the brownfield codebase; Enforceable rules
- **Where:** `architecture-bmad-companion.md` lines 35, 65, 138, 144, 191, 252, 279; brownfield `scripts/mcp-server.mjs:1-15, 531-541`, `scripts/bmad-engine.mjs:2935-2995, 4464-4611`, `scripts/hook-runner.mjs:71-124`, `scripts/check-version-sync.mjs:10-117`
- **Issue:** Three architectural assertions directly contradict the shipped v0.5.4 codebase:
  1. **OS automation ownership inverted:** The Paradigm table (line 35), `AD-2` Mermaid diagram (line 65: `Mcp --> OS`), `AD-15` (line 144: `mcp-server:66-169`), and Capability Map (line 279) all place OS clipboard/keystroke automation inside `scripts/mcp-server.mjs`. In shipped v0.5.4, `mcp-server.mjs` has **zero** OS process execution; `prepareNewSession` and `openNewConversationWithPrompt` live in `scripts/bmad-engine.mjs:4464-4611` (alongside `openWorkspaceArtifactExternally` at `2935`), and `mcp-server.mjs:10` simply delegates to `bmad-engine.mjs`.
  2. **Stop-hook LLM egress misattributed in diagram:** The Deployment topology diagram (line 252) draws `Server -.->|"optional Stop synthesis only"| LLM`. In fact, `mcp-server.mjs` makes zero network calls (`fetch` does not appear in `mcp-server.mjs` or `bmad-engine.mjs`); `scripts/hook-runner.mjs:71-124` (`Runner`) is the sole egress point, matching `AD-5`.
  3. **False enforcement claim on panel version sync (`AD-14`):** `AD-14` (line 138) claims *"the panel's `appInfo.version` (panel:1389) and displayed title version join the sync set (verified by `scripts/check-version-sync.mjs`)"*. In reality, `scripts/check-version-sync.mjs:19-117` checks **only** `.zcode-plugin/plugin.json`, `../marketplace.json`, and `scripts/mcp-server.mjs` (`serverInfo.version`) — it never reads `assets/panel.html`. A version bump relying on `check-version-sync.mjs` will silently leave `panel.html` out of sync.
- **Recommended fix:**
  - Update the Paradigm table, `AD-2` diagram (`Engine --> OS`), `AD-15` citations (`bmad-engine.mjs:4464-4611`), and Capability Map to ratify `bmad-engine.mjs` as the OS-automation home (or explicitly open a refactor task if moving it back to `mcp-server.mjs` is intended — ratifying shipped code is cleaner given `openWorkspaceArtifactExternally` already lives in `bmad-engine.mjs`).
  - Fix the Deployment topology edge from `Server -.-> LLM` to `Runner -.-> LLM`.
  - Either mark panel version enforcement in `check-version-sync.mjs` as a required epic task (currently unenforced gap) or add a tracked OQ so `AD-14` does not falsely assert it is already verified.

---

### Medium Findings

#### M-1 — Stale v0.5.2 drift register, self-contradicting status statements, and broken line citations
- **Rubric criteria:** Ratifies rather than contradicts the brownfield codebase
- **Where:** `architecture-bmad-companion.md` lines 47, 78, 84, 90, 96, 102, 120, 126, 132, 138, 144, 215, 276–305, 323–336
- **Issue:** The 2026-11-25 revision updated selected citations in `AD-3`, `AD-9`, `AD-10`, and `AD-14`, but left the bulk of the spine describing v0.5.2 state that v0.5.4 hardening already superseded:
  - **`AD-7` & `OQ-C`:** Claim scan depth 6/5, 120KB reads, and 3000–4000ms git timeouts are still unfixed. In v0.5.4, `SCAN_LIMITS = { maxDepth: 4, heuristicReadBytes: 30000, gitTimeoutMs: 2500 }` (`bmad-engine.mjs:376-380`) is already wired across `scanBmadWorkspace` (`1612-1613`), `safeReadText` (`383`), reports (`1560, 2014`), inspect (`2876`), and git calls (`1295-1296`). Only `reconcileWorkspaceTrackers` still uses `walkFiles(..., 6)` (`3037`) and `500000`-byte full-file tracker reads (`3053, 3161`).
  - **`OQ-H`:** Still listed open against `panel:2811` (`!document.hidden` only), contradicting both `AD-10` (line 114) and shipped `assets/panel.html:3319-3324` (`isPanelVisible()` already checks both `!document.hidden` and `visibilityState === "visible"`).
  - **Self-contradictions on `tests/` and CI:** Capability Map (line 298) says `R23 verification suite | tests/ (to build)` while Structural Seed (line 215) says `tests/ # R23 node:test suite (built & green)` (16 test files are shipped). Deferred `OQ-2` (line 336) says `"no CI infrastructure exists yet"` contradicting Consistency Conventions (line 184), which cites `../.github/workflows/validate.yml`.
  - **Broken line citations:** Dozens of citations point past EOF or to wrong functions (e.g., `mcp-server:868, 875, 920, 946` in a 786-line file; `hook-runner:20, 71-76, 97, 134, 155, 187-215` in a refactored 323-line file; `engine:952, 979, 1015, 1193, 2366, 2956` in a 4612-line file; `panel:1050-1101, 1173, 1398, 2810-2814`).
- **Recommended fix:** Narrow `OQ-C` to the remaining `reconcileWorkspaceTrackers` walk depth 6 (and clarify that full-file tracker reads for lossless rewriting are distinct from heuristic scan caps), close `OQ-H`, update Capability Map line 298 and Deferred `OQ-2` wording, and refresh or remove brittle line-number citations in favor of function/symbol names (keeping line numbers only where explicitly verified against current HEAD).

#### M-2 — RD-9 3-tab migration & test-harness contract missing from AD-16 / AD-17
- **Rubric criteria:** Fixes real divergence points; No quiet requirement from EXPERIENCE.md dropped
- **Where:** `architecture-bmad-companion.md` lines 150 (`AD-16`), 156 (`AD-17`), 212; `EXPERIENCE.md` lines 46, 105, 113, 143, 219; brownfield `assets/panel.html:990-996, 1243-1253, 2513-2519, 3333-3370`, `tests/panel-a11y.test.mjs`, `tests/panel-guards.test.mjs`
- **Issue:** Moving from 5 tabs (`advisor`, `queue`, `progress`, `catalog`, `artifacts`) to 3 tabs (`work`, `queue`, `project`) affects cross-cutting contracts shared by `assets/panel.html` and the existing `tests/` suite:
  - `EXPERIENCE.md:46` still marks tab IDs `work`, `queue`, `project` as `[ASSUMPTION]` and `EXPERIENCE.md:219` mandates re-verifying EXPERIENCE AD-2 tab semantics on the 3-tab tablist.
  - `assets/panel.html:3333-3370` exposes `window.__bmadTestHooks` (consumed by `tests/panel-guards.test.mjs` and `tests/panel-a11y.test.mjs`), which exports `renderSkillsCatalog` and relies on `lastSectionSignatures` keys.
  - `RD-8` introduces three in-memory session disclosures (`AI notes (N)`, `Models and providers (N)` on Work; `More actions (3)` inside the Action Window overlay) whose open/closed state must survive background re-renders without resetting on poll flush.
  - Phase file chips (`EXPERIENCE.md:105`) previously called `switchTab("artifacts")` (`panel.html:2513-2519`); under `RD-9` they stay in `project` and open the Project diff inspector directly.
- **Recommended fix:** Ratify the 3 tab IDs (`work`, `queue`, `project`) in `AD-17` (or a short `AD-10`/`AD-17` clause), require in-memory `RD-8` disclosure state to survive `renderWorkspaceState` re-renders (like `expandedPhases`/`expandedEpics`), and state in `AD-16` that the `window.__bmadTestHooks` seam + `panel-a11y.test.mjs` / `panel-guards.test.mjs` must be updated in lockstep with the 3-tab and overlay migration (covering 3-tab ARIA, `RD-4` accessible descriptions, `RD-7`/`RD-9` dialog semantics, and `AD-18` jargon-free hero/cards).

---

### Low Findings

#### L-1 — AD-17 initial focus target slightly looser than EXPERIENCE.md
- **Where:** `architecture-bmad-companion.md` line 156 (`AD-17`); `EXPERIENCE.md` lines 114, 198, 215, 305
- **Issue:** `EXPERIENCE.md` specifically requires focus to move **to the overlay heading** on open (`#overlayTitle`, requiring `tabindex="-1"`). `AD-17` says only *"moving focus inside on open"*. Tightening `AD-17` to specify `#overlayTitle` (`tabindex="-1"`) prevents accessibility test drift between `EXPERIENCE.md` and `tests/panel-a11y.test.mjs`.

#### L-2 — AD-10 Escape handler unification with existing capture-phase listener
- **Where:** `architecture-bmad-companion.md` line 114 (`AD-10`); `assets/panel.html:1280-1297`
- **Issue:** `assets/panel.html:1291-1296` already registers a capture-phase `keydown` listener that blurs `TEXTAREA`/`INPUT` on `Escape` and schedules `setTimeout(flushPendingState, 0)`. If an epic adds a separate bubble-phase overlay `Escape` listener, `flushPendingState` and `triggerEl.focus()` can race (if `flushPendingState` re-renders the tab before `triggerEl` is re-focused or detached). Note in `AD-10` that the overlay `Escape` precedence must live inside the single unified capture-phase `keydown` handler so `closeOverlay()` restores focus and flushes in deterministic order.

#### L-3 — AD-13 session env var & Windows cross-drive confinement parity
- **Where:** `architecture-bmad-companion.md` lines 90 (`AD-6`), 132 (`AD-13`); `scripts/hook-runner.mjs:191-192, 306`
- **Issue:** `AD-13` names only `CLAUDE_SESSION_ID`, whereas `scripts/hook-runner.mjs:306` checks `process.env.CLAUDE_SESSION_ID || process.env.ZCODE_SESSION_ID || ""`. Ratifying both env vars (and noting whether `payload.session_id` is also accepted) strengthens `AD-13` and `AD-18`. Separately, `hook-runner.mjs:191-192` guards `recentTouchedFiles` with `!rel.startsWith("..")` without `!isAbsolute(rel)` (unlike `bmad-engine.mjs:3034`), which fails to confine cross-drive paths on Windows (`D:\repo` vs `C:\other`). Adding `!isAbsolute(rel)` aligns `hook-runner.mjs` with `AD-6`.

#### L-4 — Frontmatter status and visual walkthrough artifact
- **Where:** `architecture-bmad-companion.md` line 8
- **Issue:** Frontmatter remains `status: draft` (appropriate while under review); flip to `final` once `H-1`–`H-4` and `M-1`–`M-2` are resolved and re-verified.

---

## Amendment-by-Amendment Assessment (2026-11-25 Pass)

| Decision | Verdict | Key Note |
| --- | --- | --- |
| **AD-3** (amended) | **Revise** | Adding `recentConversations` is right, but needs explicit upsert/dedup/cap ownership in the gateway (H-1). |
| **AD-9** (amended) | **Strong / Pass** | `OQ-6` closure against verified ZCode Desktop behavior is crisp, evidence-backed, and prevents wasted `ui/request-display-mode` work. |
| **AD-10** (amended) | **Revise** | 3rd guard clause, `Escape` precedence, and semantic draft Maps are strong; fix `"Add to Queue"` reconcile-in-place contradiction, add semantic keying for `selectedRecKeys`, and note capture-phase `keydown` unification (H-3, L-2). |
| **AD-14** (amended) | **Revise** | Retaining `skillsCatalog`/`agentsCatalog` under `RD-9` is a critical save; fix false claim that `check-version-sync.mjs` checks `panel.html` and declare additive `bmad_update_advisor` fields for `AD-18` (H-1, H-4). |
| **AD-16** (amended) | **Revise** | Good inclusion of quoted glob and overlay-guard/draft-preservation tests; align with existing 16-file `tests/` baseline and 3-tab `__bmadTestHooks` / `RD-4`/`RD-7`/`RD-9`/`AD-18` test updates (M-1, M-2). |
| **AD-17** (new) | **Revise** | Excellent unified controller + non-duplicating `overlay-*` ID rule; add canonical `targetType`/`targetKey` table, `RD-7` interactive-descendant click guard, 3-tab ID ratification, and `#overlayTitle` focus target (H-3, M-2, L-1). |
| **AD-18** (new) | **Revise** | Strong ring-buffer design, offline determinism, and honest `basisLabel`; close `bmad_update_advisor` schema + `sessionId` correlation, staleness timestamp, AI-override jargon gate, and Work next-action card plain-language sourcing (H-1, H-2). |
