---
title: 'Epic 7: 3-conversation focus hero, plain-language Work copy & legacy drift closure (stories 7.1-7.4)'
type: feature
ticket: ''
created: '2026-11-25'
status: built
baseline_revision: 'b44a9fa6c11d3c5a9b6f86a223baa0922250f423'
route: full
route_source: auto
risk: high
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md'
warnings: [multiple-goals, oversized]
deferred:
  - summary: >-
      Recommendation cap is 7 in buildRecommendations while AD-8/OQ-D architecture text says 6.
    evidence: |-
      Pre-existing drift confirmed at the buildRecommendations return (recs.slice(0, 7)); predates Epic 7 and was left untouched by this work. Needs a PO decision to align the code or the architecture text; not an Epic 7 regression.
    location: >-
      scripts/bmad-engine.mjs (buildRecommendations cap)
    severity: low
---

<intent-contract>

## Intent

**Problem:** The companion only remembers the single latest turn, the Work-facing copy is full of BMAD jargon, and three legacy drift defects remain (reconcile walks depth 6, PostToolUse matcher includes Bash instead of MultiEdit, reconcile's `storyOverrides: {}` clear is a silent no-op).

**Approach:** Execute Epic 7 stories 7.1→7.4 in order: (7.1) rolling 3-conversation `recentConversations` ring buffer merged via `savePersistedState`, hook snippet capture, additive `focusSummary`/`sessionId` on `bmad_update_advisor`; (7.2) deterministic jargon-free `turnAnalysis.currentFocus` + `plainTitle`/`plainSummary` on every recommendation; (7.3) close OQ-C/OQ-E/OQ-F; (7.4) refactor sweep. Engine/hook/MCP/tests only — the frozen payload hands off to Epic 8, which owns all panel changes.

## Boundaries & Constraints

**Always:** zero npm deps, Node 18+ ESM `node:*` only; every state.json write via `savePersistedState` (AD-3); hooks emit exactly one JSON stdout line and swallow errors to `{}` (AD-13); deterministic hooks ≤350ms (test-enforced on spawned Stop), Stop LLM bounded by `AbortSignal.timeout(4500)`; additive 0.5.x schema changes only (AD-14) — keep `title`/`rationale`/`skill`/`phase`, `overrideKey` format, `skillsCatalog`/`agentsCatalog` in `bmad_get_state`, `SCAN_RESULT_KEYS` top-level set; workspace-confined data only (no host session-store reads); preserve `.bak` backup behavior in reconcile.

**Never:** touch `assets/panel.html`, panel tests, upstream skills, or version strings (no bump — release sync is Epic 8.8); no new unbounded walk/read/git call; no fallback conversation entries when `sessionId` is absent; no jargon (`/bmad-*`, phase codes, tracker filenames) in `currentFocus.text`, `plainTitle`, `plainSummary`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ring-buffer upsert | `savePersistedState` partial `recentConversations:[{sessionId:"s2",promptSnippet:"new"}]`, existing s2 entry has outcomeSnippet | s2 moves to index 0, outcomeSnippet preserved, array capped 3 newest-first, dedup by sessionId | No error expected |
| Partial/omitted buffer | partial omits `recentConversations`, or entry omits snippets | existing array untouched; existing non-empty snippets never blanked | No error expected |
| Hook capture | user-prompt then stop with sessionId (env or `payload.session_id`) | entry gains promptSnippet ≤300 chars, then outcomeSnippet ≤400 + completedAt + touchedCount; stdout stays one `{}` line; ≤350ms | missing sessionId → skip conversation capture only, other state writes proceed |
| Advisor focus override | `bmad_update_advisor {focusSummary, sessionId?}` | override stored with updatedAt+source; entry upserted only when sessionId present; no sessionId → zero new entries | jargon-laden focusSummary → rejected at scan, deterministic fallback |
| Override freshness | Stop completes same session seconds after advisor update; later a different session completes / newer prompt starts | same-turn override survives; expires only on different-session completedAt > updatedAt or lastUserPromptAt > updatedAt (plus existing workflow/queue staleness) | invalid updatedAt → treated per existing isAdvisorOverrideStale |
| currentFocus | 0-3 recorded conversations, with/without fresh override | `{text, basisLabel:"Current focus", conversationCount:0..3, source}` closed enum `advisor-override\|stop-synthesis\|deterministic`; text 1-2 plain jargon-free sentences | empty buffer → deterministic text from last prompt/assistant or ready-state sentence |
| Plain rec copy | any recommendation incl. onboarding/AI-override recs | every rec carries non-empty jargon-free plainTitle/plainSummary; original fields unchanged | No error expected |
| Reconcile clear (OQ-F) | live reconcile with changes; state has reconciled + unrelated override keys | reconciled keys removed via explicit replace; unrelated keys and all other partial-merge callers preserved | dryRun → zero state/tracker writes |
| Walk depth (OQ-C) | tracker at depth 5 vs depth 4 | depth-4 tracker reconciled; depth-5 untouched (SCAN_LIMITS.maxDepth) | No error expected |

</intent-contract>

## Code Map

- `scripts/bmad-engine.mjs` (4612 lines) — `SCAN_LIMITS` 376-380 (`maxDepth:4`); `loadPersistedState` 1406-1425 (add `recentConversations:[]` default); `savePersistedState` 1427-1455 (special cases storyOverrides 1432-1435 / taskQueue 1436-1441; add recentConversations merge + third `options` param for explicit replace); `updateAdvisorState` 1479-1537 (advisor partial-merge 1506-1522, single save 1529-1534 — slot focusSummary/sessionId here); scan return 2424-2466, `turnAnalysis` 2446-2457 (add `currentFocus`), `activeAdvisorOverride` staleness gate 2422; `isAdvisorOverrideStale` 2511-2530 (extend with conversation/prompt freshness for focus); `summarizeAssistantTurn` 2558-2571 / `buildTurnHeadline` 2573-2591 (new jargon-filter + currentFocus + plain-copy helpers sit beside these); `buildRecommendations` 2593-2824, inner `addRec` funnel 2609-2626 (attach plainTitle/plainSummary here — covers all 8 emission sites incl. onboarding early return); `reconcileWorkspaceTrackers` 2996-3371: depth-6 walk call site **3037** (OQ-C), changes entries carry `key` (v6 key or `epicSlug#id` overrideKey, see 3087/3262/3275, changeKey 3248), audit+clear block 3324-3346 (OQ-F no-op clear at 3342-3345), `.bak` writes 3143-3146/3300-3303 (preserve).
- `scripts/hook-runner.mjs` (323 lines) — `emitHookFrame` 19 single stdout point; `handleUserPrompt` 141-178 (save at 151-155 = promptSnippet capture slot; prompt cap 4000 at 150); `handleStop` 204-292 (save at 217-221 = outcomeSnippet/completedAt/touchedCount slot; LLM synthesis 275-289 writes agentAdvisorOverride); `tryOptionalAiTurnSynthesis` 71-124 (4500ms AbortSignal; extend response with optional focusSummary); sessionId env-only at 305-307 (`CLAUDE_SESSION_ID || ZCODE_SESSION_ID`; add `payload.session_id` fallback for capture).
- `scripts/mcp-server.mjs` — `bmad_update_advisor` schema 123-224, `additionalProperties:false` at 213 (add optional `focusSummary`/`sessionId` string props); handler 523-529 delegates to engine; `bmad_get_state` 512-521 returns full scan (catalogs already present — regression-assert only); serverInfo.version 0.5.4 at 699-702 (do not change).
- `hooks/hooks.json` — PostToolUse matcher line 27 `"Edit|Write|Bash"` → `"Write|Edit|MultiEdit"` (OQ-E).
- `tests/helpers.mjs` — reuse `createTempWorkspace`/`createTempWorkspaceTracker`, `runHookRunner` (strips session/API-key env unless overridden), `runMcpServer`, `assertSingleJsonObjectStdout`, `readJsonFile`.
- `tests/hooks-router.test.mjs` — spawn-based hook tests; only 350ms assertion at 87-101 (keep green); stub LLM server helper at 20. `tests/mcp-surface.test.mjs` — `SCAN_RESULT_KEYS` 27-46, advisor suite 301+. `tests/reconciliation.test.mjs` — direct engine imports, `seedDualMetric` fixtures, reconcile suites 662+/927+. `tests/hook-stdout-isolation.test.mjs` — one-line stdout per mode.
- Do not change: generated `queue-step-updater.mjs` template (engine ~3701-3770) — its read-modify-write preserves unknown keys, so `recentConversations` is safe there.

## Tasks & Acceptance

**Execution (story order 7.1 → 7.2 → 7.3 → 7.4):**
- [x] `scripts/bmad-engine.mjs` — 7.1: `recentConversations` default + field-preserving upsert/dedup/cap-3 merge in `savePersistedState`; `updateAdvisorState` accepts `focusSummary`/`sessionId` (override fields `focusSummary`, `focusSummarySource:"advisor-override"`, optional `focusSummarySessionId`, reuse `updatedAt`; upsert conversation entry only when sessionId present).
- [x] `scripts/hook-runner.mjs` — 7.1: capture promptSnippet (≤300) on user-prompt and outcomeSnippet (≤400) + `completedAt` + `touchedCount` (= recentTouchedFiles length) on Stop, keyed by env sessionId with `payload.session_id` fallback; skip capture when no sessionId; keep deterministic path ≤350ms and stdout single-line.
- [x] `scripts/mcp-server.mjs` — 7.1: additive optional `focusSummary`/`sessionId` string schema fields on `bmad_update_advisor`.
- [x] `tests/hooks-router.test.mjs`, `tests/mcp-surface.test.mjs`, `tests/hook-stdout-isolation.test.mjs` — 7.1: ring-buffer merge/cap/dedup/preservation, hook capture bounds + budget + stdout, advisor schema acceptance + no-fallback-entry regression.
- [x] `scripts/bmad-engine.mjs` — 7.2: shared jargon filter (strip/reject `/bmad-*`, phase codes, tracker filenames) + `buildCurrentFocus` helper; `turnAnalysis.currentFocus` with closed source enum, `basisLabel:"Current focus"`, honest `conversationCount`; same-turn-safe freshness (different-session completedAt or newer lastUserPromptAt expires; extend `isAdvisorOverrideStale` or a focus-specific gate); Stop LLM optional focusSummary persisted with source `stop-synthesis` (hook-runner); `plainTitle`/`plainSummary` via `addRec`.
- [x] `tests/hooks-router.test.mjs`, `tests/mcp-surface.test.mjs` — 7.2: jargon rejection/fallback, freshness (same-turn survives, next-turn expires), 0-3 counts, plain copy on every rec, catalogs retained.
- [x] `scripts/bmad-engine.mjs` — 7.3: OQ-C line 3037 → `SCAN_LIMITS.maxDepth`; OQ-F `savePersistedState(workspaceRoot, partial, options)` with `options.replaceKeys` (listed top-level keys replace wholesale); reconcile clears only reconciled override keys (map `changes[].key` → story overrideKeys) via replace, preserving unrelated keys.
- [x] `hooks/hooks.json` — 7.3: OQ-E matcher `"Write|Edit|MultiEdit"`.
- [x] `tests/reconciliation.test.mjs`, `tests/hooks-router.test.mjs`, `tests/hook-stdout-isolation.test.mjs` — 7.3: depth-4-vs-5 fixture, explicit clear + unrelated-key preservation, matcher assertion, stdout isolation unchanged.
- [x] `scripts/*.mjs`, `tests/*.test.mjs` — 7.4: refactor sweep only — deduplicate snippet/jargon helpers into single sources, normalize gateway merge/clear paths, tighten AD-18/AD-8/OQ assertions; scope from deferred findings; no new behavior.

**Acceptance Criteria:**
- Given a temp workspace with 3 recorded conversations, when a 4th session's hook fires, then the oldest entry is evicted, the newest is index 0, and no duplicate sessionId exists.
- Given a fresh jargon-free advisor focusSummary written mid-turn, when Stop fires seconds later for the same session, then currentFocus.source is `advisor-override` with the override text; when a different session later completes, then source falls back to `deterministic`.
- Given any scan (empty workspace, onboarding, active epic, AI override), when recommendations are returned, then every rec has non-empty jargon-free plainTitle/plainSummary and unchanged title/rationale/skill/phase, and bmad_get_state structuredContent still contains skillsCatalog/agentsCatalog.
- Given state with reconciled and unrelated storyOverrides keys, when live reconcile runs with changes, then only reconciled keys are cleared, unrelated keys survive, and a subsequent plain partial merge still preserves keys.
- Given the full suite, when `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` runs, then all tests pass and versions stay synced at 0.5.4.

## Implementation Notes

- Implemented by coding subagent (full route). First launch died in a host runtime crash with zero edits; a fresh relaunch completed all four stories. Parent verified the full staged diff and re-ran the gate: 198 tests pass, version tri-sync OK at 0.5.4.
- **OQ-C judgment call (accepted after code verification):** the scanner itself walks `_bmad-output/` and `docs/` from their own roots at `SCAN_LIMITS.maxDepth` (engine `scanBmadWorkspace`, lines 1697-1698). Reconcile now mirrors that exact envelope — root@4 + `_bmad-output`@4 + `docs`@4, deduplicated — instead of a literal single root@4 walk, which would have left the standard v7 tracker layout (5 levels below root) unreconciled and broken 8 existing tests. Every walk call passes `SCAN_LIMITS.maxDepth`; the depth-4-reconciled/depth-5-untouched boundary is proven under the scanner's depth convention.
- Freshness gate lives in `isAdvisorOverrideStale`: an override carrying `focusSummary` additionally expires on a newer `lastUserPromptAt` or a different-session `completedAt`; overrides without `focusSummary` keep the legacy workflow/queue staleness behavior unchanged.
- Parent added one test during the Matrix Test Audit: same-session newer-prompt expiration branch (hooks-router, Story 7.2 suite) — the existing freshness test only exercised the different-session branch directly.
- Observation (out of scope, left untouched): AD-8/OQ-D text says the recommendation cap is 6, but `buildRecommendations` slices 7 — pre-existing drift for a future PO decision, not an Epic 7 regression.

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 8 findings — high 1, medium 3, low 3, false 0, maybe-false 1
- findings:
  - `[high]` `[patch]` Unbound focusSummary (no sessionId) expired by its own session's Stop — verified at isAdvisorOverrideStale: focusSessionId "" differs from every real sessionId, so same-turn completedAt > updatedAt killed the fresh summary, violating AD-18 same-turn safety on a documented optional path — fixed: completion-expiry loop skipped when focusSummarySessionId absent (newer-prompt/workflow/queue expiry kept); regression test added (unbound survives same-session Stop, newer prompt still expires).
  - `[medium]` `[patch]` Replacement focusSummary without sessionId inherited the previous focusSummarySessionId via the existingOverride spread — verified in updateAdvisorState; the mcp-surface test codified the inheritance — fixed: focusSummarySessionId explicitly set to focusSessionId || null on every focusSummary write; test assertion updated to expect the cleared binding.
  - `[maybe-false]` `[reject]` Multi-entry recentConversations partial stored in reverse order — the merge is sequential upsert (each entry moves to index 0); AD-3/AD-18 define the stored array as newest-first, not the partial input order, and no production writer passes multi-entry partials (the only test caller seeds oldest-first and passes) — rejected: if true only low (latent, no active caller); would be settled by an explicit AD-3 decision on multi-entry partial input ordering.
  - `[low]` `[patch]` CONVERSATION_LIMITS comment overstated cap re-enforcement (existing entries spread verbatim, only incoming fields capped) — verified; fixed: comment now states incoming fields are capped while existing non-empty snippets are preserved.
  - `[medium]` `[patch]` AD-18 "1-2 sentences" unenforced on currentFocus.text (override path any count; deterministic path could join multi-sentence outcome + prompt) — verified in buildCurrentFocus — fixed: firstTwoSentences helper caps both paths after jargon validation; tests added for 3-sentence override and multi-sentence deterministic case.
  - `[medium]` `[patch]` Token-stripping left ungrammatical plain copy ("Use with a concrete prompt…", "… . quality gate requires…") and artifact filenames in plainTitle — verified against rationale sources (engine 2908/2964 pre-patch) — fixed: plainSentencesFrom drops whole jargon-bearing sentences and filename parentheticals for recommendation copy only; currentFocus snippet stripping unchanged; tests assert grammatical remainders for both cited rationales.
  - `[low]` `[patch]` OQ-C comment claimed "identical reachable file set" while reconcile also walks the workspace root at depth 4 (scanner walks only _bmad-output/docs) — verified; behavior matches the accepted judgment call — fixed: comment now describes artifact-tree parity plus the bounded root walk.
  - `[low]` `[defer]` Recommendation cap 7 in buildRecommendations vs AD-8/OQ-D text saying 6 — pre-existing drift, unchanged by Epic 7, already noted in Implementation Notes — deferred for a PO decision (align code or architecture text).

## Design Notes

- **focusSummary rides on `agentAdvisorOverride`** (additive fields) so existing workflow/queue staleness applies automatically; `focusSummarySource` distinguishes the closed enum's `advisor-override` vs `stop-synthesis`. No new top-level state key.
- **OQ-F reading:** epic wording "clears reconciled storyOverrides keys" governs — clear only keys actually reconciled (safer than the legacy call site's blanket `{}` intent, which would drop non-reconciled evidence e.g. under `target:"v6-yaml"`). Gateway gains generic `options.replaceKeys`; reconcile computes remaining overrides and replaces. Other callers keep default merge semantics.
- **Deterministic focus text:** derive 1-2 plain sentences from recentConversations snippets (what was done + what matters now), jargon-stripped; with an empty buffer fall back to last prompt/assistant summary or a plain ready-state sentence. Never reuse `buildTurnHeadline` strings (jargon-heavy) and never fall back to `aiSummaryHeadline`.
- **Snippet bounds are hard caps** applied at capture (300/400 chars) and honored by the merge (never overwrite non-empty with empty).

## Verification

**Commands:**
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — expected: all green, versions synced (keep glob quoted).
- `node --test tests/hooks-router.test.mjs tests/mcp-surface.test.mjs` — expected: 7.1/7.2 behaviors incl. ≤350ms Stop budget.
- `node --test tests/reconciliation.test.mjs tests/hooks-router.test.mjs tests/hook-stdout-isolation.test.mjs` — expected: OQ-C/E/F closed, stdout isolation intact.
- `node --check scripts/bmad-engine.mjs && node --check scripts/hook-runner.mjs && node --check scripts/mcp-server.mjs` — expected: syntax OK.

## Auto Run Result

**Summary:** Epic 7 (stories 7.1-7.4) implemented and reviewed: rolling 3-conversation `recentConversations` memory merged through `savePersistedState` with hook snippet capture (≤350ms, single-line stdout), additive `focusSummary`/`sessionId` on `bmad_update_advisor`, deterministic jargon-free `turnAnalysis.currentFocus` ("Current focus", closed source enum, same-turn-safe freshness, 2-sentence cap), `plainTitle`/`plainSummary` on every recommendation (catalogs retained), and OQ-C/OQ-E/OQ-F closed (bounded reconcile walk, `Write|Edit|MultiEdit` matcher, explicit selective override clear). Frozen payload ready for Epic 8. No panel, upstream-skill, or version changes (stays 0.5.4).

**Files changed:**
- `scripts/bmad-engine.mjs` — conversation buffer merge + gateway replace option, advisor focus fields, freshness gate, jargon filter + currentFocus + plain-copy helpers, bounded reconcile walk + selective override clear.
- `scripts/hook-runner.mjs` — bounded prompt/outcome snippet capture (env sessionId with payload.session_id fallback), Stop LLM focusSummary as stop-synthesis.
- `scripts/mcp-server.mjs` — additive optional focusSummary/sessionId advisor schema fields.
- `hooks/hooks.json` — PostToolUse matcher `Write|Edit|MultiEdit` (OQ-E).
- `tests/hooks-router.test.mjs`, `tests/mcp-surface.test.mjs`, `tests/reconciliation.test.mjs`, `tests/hook-stdout-isolation.test.mjs` — Epic 7 regression coverage (buffer, capture, freshness, jargon, plain copy, OQ-C/E/F).
- `_bmad-output/initiative-bmad-companion/plan-7-focus-hero-engine.md` — this plan.

**Review findings breakdown (quick lens, 8 findings):** 6 patches applied (1 high: unbound focusSummary same-turn expiry; 3 medium: binding inheritance, 2-sentence cap, grammatical plain copy; 2 low: two inaccurate comments). 1 deferred (low, pre-existing recommendation cap 7 vs AD-8 text 6 — PO decision). 1 rejected (maybe-false multi-entry partial ordering: if true only low, no production multi-entry writer; would be settled by an explicit AD-3 input-order decision).

**Follow-up review recommended: true.** Patched counts by verdict: high 1, medium 3, low 2. Specific unverified risk: the unbound-focus freshness path and the sentence-filtered plain copy are new logic verified only by targeted regression tests; their interaction with queue/workflow staleness and AI-override recommendation copy across a full live host turn (real Stop timing, real advisor calls) has not been exercised end-to-end.

**Verification performed:** `node --test "tests/*.test.mjs"` — 201 pass / 0 fail (182 pre-existing + 19 new, run twice: after implementation and after review patches); `node scripts/check-version-sync.mjs` — OK, all 3 versions 0.5.4; `node --check` on all three scripts — OK. Matrix Test Audit: all 9 I/O matrix rows covered by tests that ran and passed (parent added the same-session newer-prompt freshness test during the audit). Full staged diff read and judged by the parent, including the accepted OQ-C walk-envelope judgment call.

**Residual risks:** multi-entry `recentConversations` partial input order is unspecified (sequential-upsert semantics; all current writers pass single entries); recommendation cap drift deferred; Epic 8 must render `currentFocus` and never fall back to `aiSummaryHeadline` (panel unchanged here by design).
