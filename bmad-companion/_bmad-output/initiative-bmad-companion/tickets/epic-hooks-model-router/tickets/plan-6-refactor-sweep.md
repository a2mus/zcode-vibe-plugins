---
title: 'Refactor sweep'
type: chore
ticket: 6
container: epic-hooks-model-router
created: '2026-11-25'
status: done
baseline_revision: 'abac6ecbcc3678c2878d8abca66131a4ada2bf53'
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

**Problem:** After Stories 6.1-6.5 (tickets 1-5), the hook/scorer/discovery lane carried copy-paste duplication across `scripts/hook-runner.mjs` and `scripts/bmad-engine.mjs`:
1. `hook-runner.mjs` dispatched its four modes through an `if (mode === ...) { ... return; }` chain with six separate `process.stdout.write` sites (four `"{}\n"` literals plus the session-start and stop frames) and an unguarded `main().catch` fallback, so the one-JSON-line stdout contract (R19-R22, asserted by `tests/hook-stdout-isolation.test.mjs`) relied on every branch remembering to write exactly once.
2. The queue-orchestrator exclusion regex `/Execute the active @bmad-companion Task Queue|bmad-task-queue\.dwf\.ts/i` was inlined twice (user-prompt auto-start, stop auto-complete), the `` `\b(?:ticket|story)\s+<id>\b` `` story-reference regex was constructed inline twice, and the prompt-match predicate (`item.prompt` prefix-includes OR storyId reference) was duplicated between the two handlers with only the prefix length differing (45 for auto-start R20, 40 for auto-complete R22).
3. The SessionStart `additionalContext` block (banner, Smart Progress metrics, provider counts, top-3 recommendations, companion guidance) was assembled inline in the hook instead of next to the scan shape that feeds it, and the C12 LLM-synthesis budget `AbortSignal.timeout(4500)` was a bare magic number.
4. `discoverConfiguredModels` repeated the bounded `existsSync ? JSON.parse(safeReadText(path, N) || "{}") : {}` config read four times (and `detectWorkspaceProfile` a fifth time for `package.json`); `resolveModelCapabilities` carried the identical rule-overlay block (enabled flag, properties merge with one-level-deep `inputFormat`, reasoning-level values) twice (builtin-regex pass and personal-rules pass); the `pid.startsWith("account:")` kind/plan ternary pair appeared twice in the runtime-overlay lane; `recommendModelForBmadSkill` repeated the `(m.costTier || classifyModelCostTier(m.modelId))` fallback four times.
5. Git subprocess handling was open-coded five times with identical `{ encoding: "utf8", timeout: <3000|4000>, stdio: ["ignore","pipe","ignore"] }` option blocks and per-call try/catch (three in `runGitInfo`, two in `inspectWorkspaceArtifact`), and `openWorkspaceArtifactExternally` inlined `timeout: 3000` three times — no named timeout budgets anywhere.

Stories 6.1-6.5 left no plan-file `deferred:` entries (tracked via runtime storyOverrides only), so scope was set from the ticket's three cleanup clauses: deduplicate hook dispatch/scorer/discovery helpers, normalize additionalContext assembly and timeout handling, tighten stdout isolation. No new behavior.

**Approach:**
1. Tighten stdout isolation in `hook-runner.mjs`: a single guarded `emitHookFrame(frame)` write point (`frameEmitted` flag makes a second line impossible on any path), `console.log/info/debug` redirected to stderr via `node:util.format` so accidental library logging can never corrupt the frame, and every handler now *returns* its frame instead of writing it.
2. Normalize hook dispatch: replace the if-chain with a `HOOK_HANDLERS` map (`session-start`/`user-prompt`/`post-tool`/`stop` → `handleSessionStart`/`handleUserPrompt`/`handlePostTool`/`handleStop`), each taking `{ payload, workspaceRoot, currentSessionId }`; unknown modes fall back to a `{}` frame with no state side effects, and `main().catch` emits `{}` only when nothing was emitted yet.
3. Deduplicate the hook matchers into shared vocabulary: `QUEUE_ORCHESTRATOR_PROMPT_RE`, `buildStoryRefRegex(storyId)`, and `taskItemMatchesPrompt(item, promptText, prefixLen)` with named per-contract prefix lengths `AUTO_START_PROMPT_PREFIX_LEN = 45` / `AUTO_COMPLETE_PROMPT_PREFIX_LEN = 40` (both preserved exactly).
4. Normalize additionalContext assembly: move the SessionStart block byte-identically into a new engine export `buildSessionStartContext(scan)` placed directly after `scanBmadWorkspace`, so the hook only scans and emits; normalize the synthesis timeout as `AI_SYNTHESIS_TIMEOUT_MS = 4500` (C12).
5. Deduplicate discovery/scorer helpers in `bmad-engine.mjs`: module-level `readJsonConfig(filePath, maxBytes)` (five former inline copies), local `applyRuleConfig(rule)` inside `resolveModelCapabilities` (two former overlay copies; the builtin-provider rules loop deliberately stays enabled-flag-only), local `runtimeProviderMeta(pid)` (two former `account:` ternary pairs), module-level `costTierOf(model)` (four former fallback copies).
6. Normalize timeout handling: named budgets `GIT_METADATA_TIMEOUT_MS = 3000`, `GIT_CAPTURE_TIMEOUT_MS = 4000`, `OPEN_EXTERNAL_TIMEOUT_MS = 3000` (values unchanged), and a single `runGitCapture(workspaceRoot, args, timeoutMs)` primitive (bounded, stdout-only, `""` on any failure/timeout) replacing the five open-coded execFileSync blocks.

</intent-contract>

## Implementation Notes

- **`scripts/hook-runner.mjs`:**
  - New structure: stdout-isolation block (`emitHookFrame` + console→stderr redirect) → shared hook vocabulary (`AI_SYNTHESIS_TIMEOUT_MS`, `QUEUE_ORCHESTRATOR_PROMPT_RE`, prefix-length constants, `buildStoryRefRegex`, `taskItemMatchesPrompt`) → `readStdinJson` → `tryOptionalAiTurnSynthesis` (unused `workspaceRoot` parameter dropped; sole call site updated) → four handlers → `HOOK_HANDLERS` dispatch map → `main()`.
  - Handler bodies are semantically byte-identical to the former branch bodies, including load/save ordering (user-prompt reloads state *after* the prompt save before queue matching; stop reads `state.taskQueue` from the pre-save load), the `ownsTask` session check, the separate-sessions `decision: "block"` handoff frame, and the silent-fallback AI synthesis with `agentAdvisorOverride` persistence.
  - `emitHookFrame(frame || {})` serializes exactly as before: `JSON.stringify(...) + "\n"`; the former `"{}\n"` literals are `emitHookFrame({})`.
  - Workspace-root resolution (`payload.cwd || ZCODE_PROJECT_DIR || CLAUDE_PROJECT_DIR || cwd`) deliberately NOT unified with `mcp-server.mjs#getWorkspaceRoot` (different chain by design: `ZCODE_WORKSPACE_ROOT` first, no payload) — unifying would change hook behavior; `mcp-server.mjs` is outside this ticket's file scope and untouched.
- **`scripts/bmad-engine.mjs`:**
  - `readJsonConfig` sits next to `safeReadText`; malformed JSON still throws to the caller's own error handling exactly as the inline copies did (relevant for `detectWorkspaceProfile`'s outer try/catch, which skips remaining stack detection on a corrupt `package.json` — unchanged).
  - `applyRuleConfig` closes over `enabled`/`properties`/`reasoningLevels`; the builtin-regex pass keeps its per-rule `try/catch` around `new RegExp(...)` construction.
  - `runGitCapture` returns raw stdout (callers keep their exact `.trim()`/split semantics: branch `.trim() || "main"`, status/log parsed from raw output, artifact diffs `.trim()`ed); failure/timeout returns `""`, matching the former swallowed-catch outcomes (`info.branch` stays `"main"`, status/log parse to empty, diff falls through to the synthetic new-file diff).
  - New export `buildSessionStartContext(scan)` — additive, consumed only by `hook-runner.mjs`; strings byte-identical to the former inline assembly (pinned by `tests/hook-stdout-isolation.test.mjs` banner + Smart Progress assertions).
  - Deliberately not deduplicated: `walkFiles` vs `findRuntimeBuiltinConfigPath.walkRuntime` (different filters/depth bookkeeping — unifying would change discovery behavior); `normalizeComparablePrompt`-based `recommendationMatchesCompletedItem` vs the hooks' prefix-includes `taskItemMatchesPrompt` (different matching contracts: normalized equality vs 45/40-char prefix includes); the generated `queue-step-updater.mjs` source string (must stay self-contained).
  - No behavior change: ScanResult shape, model ranking/economy-guard outcomes, provider summary rows, git info/artifact diffs, and all hook frames/state writes are untouched.
- **Dedup audit (grep, post-sweep):** each former duplicate now resolves to exactly one definition — orchestrator regex 1×, story-ref regex builder 1×, `execFileSync("git"` 1× (inside `runGitCapture`), inline `timeout: 3000`/`timeout: 4000` literals 0×, `costTier || classifyModelCostTier` 1× (inside `costTierOf`), `JSON.parse(safeReadText` 1× (inside `readJsonConfig`), `startsWith("account:")` 1× (inside `runtimeProviderMeta`), `Smart Progress:` 1× (inside `buildSessionStartContext`), `process.stdout.write` in hook-runner 1× (inside `emitHookFrame`); `grep -c "function <name>("` = 1 for all nine new/shared helpers.
- No test changes were needed — the sweep is behavior-preserving and the existing 156 tests (including hook-stdout-isolation, execution-queue, queue-handoff, model-catalog, reconciliation, MCP-surface/transport, and engine-smoke suites) pin the preserved behavior.
- Commit-path anomaly (recorded for the tracker reconcile): a concurrent queue task's whole-tree auto-commits landed this sweep's code inside `672e2b1` (engine edits 1-8) and `e03514f` (engine readJsonConfig promotion + hook-runner rewrite) under vibe-debrief-worded messages; `git diff HEAD -- scripts/bmad-engine.mjs scripts/hook-runner.mjs` is empty, so HEAD carries exactly the verified state.

## Verification

**Commands (executed on win32, Node v22+ built-in test runner, from `bmad-companion/`):**
- `node --test "tests/*.test.mjs"` — passed (156/156 tests, 0 failures, 40 suites) after the final edit; also passed at the mid-sweep checkpoint.
- `node scripts/check-version-sync.mjs` — passed (`[check-version-sync] OK: all 3 versions match (0.5.3)`).
- `node --test tests/hook-stdout-isolation.test.mjs` — passed standalone (8/8): every hook mode (session-start, user-prompt, post-tool, stop), malformed stdin, unknown mode, and the four-mode lifecycle each emit exactly one JSON stdout line with empty stderr.
- `node ../scripts/validate.mjs` — passed (`bmad-companion v0.5.3`, `vibe-debrief v0.4.0`, `project-colors v0.1.0` validated).
- `node --check scripts/bmad-engine.mjs` / `node --check scripts/hook-runner.mjs` — passed after each rewrite stage.

**Story verify clause:** "Run `node --test tests/` green and confirm no duplicated hook/scorer helper remains and every hook still emits a single JSON stdout line." — suite green (156/156 via the AGENTS.md-quoted glob form), duplication audit above shows every helper defined exactly once, and the stdout-isolation harness proves the one-JSON-line contract for all four hooks plus both fallback paths.
