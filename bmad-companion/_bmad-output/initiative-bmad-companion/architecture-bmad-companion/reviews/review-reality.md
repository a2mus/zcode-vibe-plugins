---
type: architecture-review
lens: reality-check
target: _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
reviewed: '2026-11-25'
verdict: REVISE_BEFORE_FINALIZING
---

# Architecture Reality-Check Review — `bmad-companion`

**Verdict:** **REVISE BEFORE FINALIZING** (0 Critical, 4 High, 5 Medium, 3 Low)

The core architectural invariants (`AD-1`–`AD-16`), plugin version (`0.5.4`), zero-dependency ESM runtime, 182/182 passing `node:test` suite, and the newly added `RD-7`/`RD-9`/`OQ-6` target decisions (`AD-17`, `AD-18`, amended `AD-9`/`AD-10`) are sound in direction. However, the 2026-11-25 spine update only partially refreshed the original 2026-11-19 (`v0.5.2`) baseline: module ownership for OS automation and LLM egress is wrong in prose and diagrams, the `bmad_queue_manage` contract omits the 15th shipped action (`retry-failed`), 5 of 8 Open Questions (and most of `OQ-C`) were already resolved in `v0.5.3–v0.5.4`, dozens of `file:line` pointers still point to `v0.5.2` offsets (four are out of range of `mcp-server.mjs`), and several target `RD-7`/`RD-9` clauses are attached to existing `v0.5.4` line pointers as if already shipped.

---

## Findings

### High

#### H-1 — OS clipboard/keystroke automation ownership is inverted (`mcp-server.mjs` vs. `bmad-engine.mjs`)
- **Spine claims:** `scripts/mcp-server.mjs` owns OS clipboard/keystroke automation in five places: Design Paradigm table (line 35), `AD-2` flowchart (`Mcp --> OS`, line 65), `AD-15` (`mcp-server:66-169`, `mcp-server:95, 130, 148-162`, `mcp-server:76, 92`, line 144), Structural Seed (line 209), and Capability Map `R4` (`mcp-server:66-169, 676-705`, line 279).
- **Verified repo reality:** `runCommandAsync`, `openNewConversationWithPrompt`, and `prepareNewSession` live in `scripts/bmad-engine.mjs:4373-4611`. `scripts/mcp-server.mjs` imports `prepareNewSession` from `./bmad-engine.mjs` (line 10) and delegates `bmad_prepare_new_session` directly at `mcp-server.mjs:531-541`.
- **Related detail in `AD-15`:** macOS `pbcopy` uses a `3000ms` timeout (`bmad-engine.mjs:4525`) while `osascript` uses `6000ms` (`bmad-engine.mjs:4543`); `AD-15` states only `6000ms darwin`. Also `AD-15` cites `panel:1206-1238` (actually `assets/panel.html:1422-1454`) and `engine:2345-2353` for external open timeout (actually `bmad-engine.mjs:2933, 2935-2967`).
- **Fix:** Move the `OS` arrow in `AD-2` from `Mcp` to `Engine`, update Design Paradigm / Structural Seed / `AD-15` / `R4`, and note that imperative OS/git subprocesses in `bmad-engine.mjs` are isolated behind injectable `deps` (`deps.runCommand`, `deps.execFileSync`).

#### H-2 — `bmad_queue_manage` tool contract states 14 actions; shipped runtime exposes 15 actions (`retry-failed`)
- **Spine claims:** `AD-11` (line 120) states `manageBmadTaskQueue` exposes "exactly the 14 actions of R9"; Capability Map `R9` (line 284) says `queue manage (14 actions)`.
- **Verified repo reality:** Both `scripts/mcp-server.mjs:371-387` (`TOOLS` inputSchema `action.enum`) and `scripts/bmad-engine.mjs:3382-3398` (`VALID_QUEUE_ACTIONS`) expose **15 actions**, including `"retry-failed"` (`bmad-engine.mjs:4132-4152`, wired to `#btnRetryFailedQueue` in `assets/panel.html:1095`). The schema also accepts `title` and `status` (`mcp-server.mjs:447-455`) for `update-item`.
- **Fix:** Update `AD-11` and `R9` to 15 actions (explicitly noting `"retry-failed"` and syncing PRD `FR-9` as follow-up drift if desired).

#### H-3 — Open Questions drift register is mostly obsolete (5 of 8 OQs already resolved; `OQ-C` almost fully closed)
- **Spine claims:** Lines 321–330 (plus inline callouts in `AD-7`, `AD-8`, `AD-9`, `AD-14`, Stack, and Capability Map) keep `OQ-A` through `OQ-H` open as unresolved PRD-vs-code drift.
- **Verified repo reality:**
  - **`OQ-A` (RESOLVED):** `_bmad-output/planning-artifacts/prd-bmad-companion/prd-bmad-companion.md:254` was already updated on 2026-11-23 to document echo behavior with server fallback `"2025-11-25"` and panel `"2026-01-26"`. `"2024-11-05"` does not appear anywhere in the PRD.
  - **`OQ-B` (RESOLVED):** `prd-bmad-companion.md:136, 259-269` was already aligned to the shipped `structuredContent` shapes for `recommend_next`, `reconcile_trackers`, `queue_manage`, `inspect_artifact`, and `lastLaunchedSession`. `preparedSession` no longer exists in the PRD.
  - **`OQ-C` (MOSTLY CLOSED):** `SCAN_LIMITS = Object.freeze({ maxDepth: 4, heuristicReadBytes: 30000, gitTimeoutMs: 2500 })` (`bmad-engine.mjs:376-380`) is already shipped and enforced by `tests/artifact-discovery.test.mjs`: `scanBmadWorkspace` walks `_bmad-output` and `docs` at `SCAN_LIMITS.maxDepth` (4) (`bmad-engine.mjs:1612-1613`), `safeReadText` defaults to `30000` bytes (`bmad-engine.mjs:383`), `inspectWorkspaceArtifact` and report scans read `30000` bytes (`bmad-engine.mjs:1560, 2014, 2369, 2876`), and every git subprocess routes through `runGitCapture` at `2500ms` (`bmad-engine.mjs:1295-1305, 2881, 2896`). The only remaining reads/walks exceeding C10 are non-scan paths: `reconcileWorkspaceTrackers` (`walkFiles(workspaceRoot, workspaceRoot, 6)` at line 3037 and `safeReadText(..., 500000)` at lines 3053 & 3161 so full tracker rewrites are not truncated) and `~/.zcode/v2/*.json` config reads (`200KB–500KB` at lines 518–521). `AD-7` line 96 ("Current call sites exceed these (walk depth 6/5, reads up to 120KB, git 3000–4000ms)") is out of date.
  - **`OQ-D` (RESOLVED):** `prd-bmad-companion.md:138` already specifies `"up to 7"` (matching `bmad-engine.mjs:2823`), and `prd-bmad-companion.md:92, 170, 244` already use `agentic-coding` (matching `bmad-engine.mjs:971, 988, 996`).
  - **`OQ-G` (RESOLVED):** `prd-bmad-companion.md:131, 255` already specifies `_meta: { "zcode/csp": { unsafeEval: false } }`. `_meta.ui.csp` does not appear in the PRD.
  - **`OQ-H` (RESOLVED):** `assets/panel.html:3319-3324` (`isPanelVisible()`) already checks both `document.hidden` and `document.visibilityState !== "visible"`, contradicting `OQ-H` (which still cites stale `panel:2811`) and already reflected in `AD-10` line 114.
  - **Genuinely still open:** Only **`OQ-E`** (`hooks/hooks.json:27` `"Edit|Write|Bash"` vs `prd-bmad-companion.md:173` `Write, Edit, MultiEdit`) and **`OQ-F`** (`bmad-engine.mjs:3342-3345` passing `storyOverrides: {}` to `savePersistedState` at `bmad-engine.mjs:1427-1435`, which still merges keys rather than clearing them).
- **Fix:** Retire `OQ-A`, `OQ-B`, `OQ-D`, `OQ-G`, `OQ-H` as closed; update `AD-7` / narrow or close `OQ-C` to the intentional `reconcileWorkspaceTrackers` walk depth 6 / 500KB full-file read; keep `OQ-E` and `OQ-F` open with updated line pointers.

#### H-4 — Widespread stale `v0.5.2` `file:line` pointers (including 4 out-of-range pointers in `mcp-server.mjs`)
- **Root cause:** Between `v0.5.2` and `v0.5.4`, file sizes shifted dramatically: `scripts/bmad-engine.mjs` grew from 3218 to **4613 lines**, `scripts/mcp-server.mjs` shrank from 963 to **787 lines**, `scripts/hook-runner.mjs` grew from 224 to **324 lines**, and `assets/panel.html` grew from 2820 to **3378 lines**.
- **Out-of-range pointers (exceed file length of `scripts/mcp-server.mjs` = 787 lines):**
  - `mcp-server:875` (Capability Map `C6`, line 304) → actual `serverInfo.version` is `mcp-server.mjs:699-702`.
  - `mcp-server:868` (`OQ-A`, line 323) → actual `initialize` `protocolVersion` fallback is `mcp-server.mjs:694`.
  - `mcp-server:920, 946` (`OQ-G`, line 329) → actual `zcode/csp` blocks are `mcp-server.mjs:738, 764`.
- **Selected mismatched pointers across ADs and Capability Map (verified against current HEAD):**

| Spine location | Cited pointer | Actual location in repo |
| --- | --- | --- |
| `AD-1` (L47) | `parseFrontmatter engine:952`, `parseTomlBlocks engine:979`, `parseSprintStatusYaml engine:1015` | `bmad-engine.mjs:1112`, `1169`, `1205` |
| `AD-2` (L53) | `mcp-server:6-13`, `hook-runner:3-8` | `mcp-server.mjs:5-15`, `hook-runner.mjs:4-11` |
| `AD-4` (L78) | `reconcileWorkspaceTrackers engine:2366`, backup `2470-2473, 2542`, log `2562-2569` | `bmad-engine.mjs:2996`, backup `3143-3145, 3300-3302`, log `3324-3339` |
| `AD-5` (L84) | evidence `engine:1368-1383, 1596-1627`, failing `1629-1656`, `tryOptionalAiTurnSynthesis hook-runner:20` | `evaluateStorySmartStatus` `bmad-engine.mjs:1577-1607`, failing reports `1563-1572, 2060-2114, 2677-2689`, `tryOptionalAiTurnSynthesis` `hook-runner.mjs:71-124` |
| `AD-6` (L90) | confinement `engine:2251-2257, 2333-2339`, `relPath engine:1145`, `mcp-server:171-178`, `hook-runner:71-76` | `resolveWorkspaceArtifactPath` `bmad-engine.mjs:2826-2872`, `relPath` `1387`, `getWorkspaceRoot` `mcp-server.mjs:24-31`, `hook-runner.mjs:308-313` |
| `AD-7` (L96) | `walkFiles engine:1118-1154` | `bmad-engine.mjs:1360-1396` (and `SCAN_LIMITS` `376-380`) |
| `AD-8` (L102) | recs `engine:2073-2090`, profiles `854-859`, `hostModels engine:417`, `mcp-server:661`, fallback `861-869`, slice `2247` | `buildRecommendations` `bmad-engine.mjs:2593-2824` (slice `2823`), profiles `964-998`, `mergeHostModelCatalogs` `477-486` & `discoverConfiguredModels` `511-840`, `bmad_update_advisor` `mcp-server.mjs:523-529`, host-default fallback `1000-1008` |
| `AD-9` (L108) | `mcp-server:730-750` (omits `resources/read`) | `resources/list` + `resources/read` `mcp-server.mjs:729-775` |
| `AD-11` (L120) | `manageBmadTaskQueue engine:2956`, `start-task 3131-3150`, `complete-task 3151-3175`, overrides `3107-3112, 3140-3145, 3197-3208`, `hook-runner:129, 187-215` | `bmad-engine.mjs:3995`, `start-task 4219-4242`, `complete-task 4243-4316`, save `4349-4362`, `hook-runner.mjs:168-172, 248-271` |
| `AD-12` (L126) | `generateQueueWorkflowFiles engine:2739`, `buildEffectiveTaskPrompt engine:2607`, separate-sessions `engine:2955-2985`, `hook-runner:159-215` | `bmad-engine.mjs:3690`, `3502`, `3964-3970` + `buildTaskSessionLaunchInstructions 3540`, `hook-runner.mjs:204-292` |
| `AD-13` (L132) | stdout `hook-runner:97, 134, 155, 215, 219, 226-245`, touched files `150-155` | `emitHookFrame` `hook-runner.mjs:18-29, 317-323`, `handlePostTool` `181-199` |
| `AD-14` (L138) | `mcp-server:661-755` (stops before `-32601/-32602/-32603`) | `mcp-server.mjs:661-786` (errors at `773, 777, 779`) |
| Conventions (L179) | `qtask-` `engine:2990, 3024` | `bmad-engine.mjs:4044, 4083` |
| Capability Map (L276–306) | `R1–R22`, `C4`, `C6`, `C8` | Almost all pointers are `v0.5.2`: e.g. `R1/R2` `mcp-server.mjs:512-521` & `engine:1609`; `R3` `mcp-server.mjs:523-529`; `R4` `mcp-server.mjs:531-541` & `engine:4464-4611`; `R5` `mcp-server.mjs:543-564` & `engine:2996`; `R6` `mcp-server.mjs:566-602` & `engine:2593`; `R7` `engine:2874-2930`; `R8` `engine:2935-2967`; `R9` `mcp-server.mjs:363-490, 624-656` & `engine:3995`; `R12` `panel.html:3319-3330, 1656-1676`; `R13` `panel.html:1258-1317, 1373-1383`; `R14` `panel.html:1240-1253, 1537-1541, 1572-1620`; `R19–R22` `hook-runner.mjs:131-137, 141-178, 181-199, 204-292`; `C4` `engine:1427`; `C6` `mcp-server.mjs:701` & `panel.html:1389, 1697` |

- **Fix:** Either refresh every `file:line` pointer to current `v0.5.4` lines (verified above) or anchor the spine primarily on exported symbol names (with line numbers only where load-bearing) so future edits do not silently rot 50+ pointers.

---

### Medium

#### M-1 — `AD-14` falsely claims `scripts/check-version-sync.mjs` verifies `assets/panel.html` version strings; `zh-CN` descriptions have drifted
- **Spine claims (`AD-14`, line 138):** "`version` and descriptions stay synchronized across `.zcode-plugin/plugin.json`, `../marketplace.json`, and `serverInfo.version` (mcp-server:699-702); the panel's `appInfo.version` (panel:1389) and displayed title version join the sync set (verified by `scripts/check-version-sync.mjs`)."
- **Verified repo reality:**
  - `scripts/check-version-sync.mjs:19-117` checks **only 3 files**: `.zcode-plugin/plugin.json`, `../marketplace.json`, and `scripts/mcp-server.mjs` (`serverInfo.version`). Neither `check-version-sync.mjs` nor `../scripts/validate.mjs` inspects `assets/panel.html` (`appInfo.version` at line 1389 or `projectTitle` text `" · BMAD Companion v0.5.4"` at line 1697; `<title>` at line 6 has no version). The versions in `panel.html` do match `0.5.4` today, but by manual sync — not by `check-version-sync.mjs`.
  - English `description` matches identically between `.zcode-plugin/plugin.json:4` and `../marketplace.json:8`, but `description_i18n["zh-CN"]` differs between `.zcode-plugin/plugin.json:8` and `../marketplace.json:14`.
- **Fix:** State accurately that `check-version-sync.mjs` currently verifies the 3-file set (and track adding `panel.html:1389,1697` to `check-version-sync.mjs` if intended), and note `description_i18n["zh-CN"]` drift or clarify that English `description` is the synced field.

#### M-2 — Deployment diagram attaches optional LLM egress to `mcp-server.mjs` instead of `hook-runner.mjs`
- **Spine claims (line 252):** `Server -.->|"optional Stop synthesis only"| LLM["OpenAI-compatible API (env key, 4500ms)"]`.
- **Verified repo reality:** `tryOptionalAiTurnSynthesis` (`hook-runner.mjs:71-124`, invoked from `handleStop` at `hook-runner.mjs:275-289`) runs in `Runner` (`scripts/hook-runner.mjs`), never in `Server` (`scripts/mcp-server.mjs`).
- **Fix:** Change `Server -.->` to `Runner -.->` at line 252.

#### M-3 — `AD-8` misstates `hostModels` precedence as "overrides disk" instead of overlay/merge
- **Spine claims (`AD-8`, line 102):** "`state.json -> hostModels` pushed from live `ListModels` via `bmad_update_advisor` overrides disk `~/.zcode/v2/provider_config.json`."
- **Verified repo reality:** `discoverConfiguredModels` (`bmad-engine.mjs:511-840`, specifically lines 754–840) **overlays/merges** `persistedHostModels` on top of disk discovery (`provider_config.json`, `setting.json`, `credentials.json`, `zcode-builtin.json`): live entries update matching IDs and prune entries with `disabledReason`, while unrelated disk-discovered models remain available. `updateAdvisorState` also merges incoming arrays via `mergeHostModelCatalogs` (`bmad-engine.mjs:477-486, 1526`) so partial `ListModels` pushes never hide existing models (as documented in `AGENTS.md` and `skills/bmad-companion/SKILL.md:18`).
- **Fix:** Reword `AD-8` to state that `hostModels` overlays/merges onto disk discovery (with `disabledReason` exclusions overriding disk entries) and partial lists merge rather than replace.

#### M-4 — Blurred line between shipped `v0.5.4` code and unbuilt `RD-7`/`RD-9` target architecture, plus two `AD-18` contract gaps
- **Blurred pointers:**
  - `AD-3` (line 72) lists `recentConversations` inline under `savePersistedState (engine:1427)`, even though `bmad-engine.mjs:1406-1455` does not implement `recentConversations` yet.
  - `AD-10` (line 114) cites `(panel:1258-1262)` immediately after clause `(c) an overlay is open (isOverlayOpen(), AD-17)` and `(panel:1264-1317)` after `overlay close (0ms)`. In reality, `assets/panel.html` has no overlay controller, no `isOverlayOpen()`, and still reads `readCmdEditor`/`readModelEditor` from DOM IDs (`panel.html:2296-2297`) rather than `resolveUserPrompt`/`resolveUserModel`.
- **Two `AD-18` contract gaps that will bite implementation:**
  1. `bmad_update_advisor` (`scripts/mcp-server.mjs:213`) sets `additionalProperties: false`. Adding `focusSummary` (and any `sessionId`) requires an explicit additive schema update to `scripts/mcp-server.mjs` (allowed under `AD-14` `0.5.x`, but currently unmentioned in `AD-18`).
  2. `AD-18` specifies that `recentConversations` is deduplicated by `sessionId` when populated by `UserPromptSubmit`/`Stop` **and** `bmad_update_advisor`. While `hook-runner.mjs:305-307` reads `process.env.CLAUDE_SESSION_ID || process.env.ZCODE_SESSION_ID || ""`, `scripts/mcp-server.mjs` is a long-lived stdio server that neither reads a session env var nor accepts a `sessionId` parameter on `bmad_update_advisor`. Specify how `bmad_update_advisor` supplies or resolves `sessionId` (e.g., optional additive `sessionId` input, or updating the latest entry when omitted).
- **Fix:** Clearly tag `RD-7`/`RD-9`/`AD-17`/`AD-18` clauses as `[TARGET — RD-7/RD-9]` separate from `v0.5.4` line pointers, and document the `bmad_update_advisor` schema addition (`focusSummary?`, `sessionId?`).

#### M-5 — Internal contradictions on already-built `tests/` and existing CI workflow
- **Spine claims:**
  - Capability Map `R23` (line 298) says `tests/ (to build)`, contradicting Structural Seed (line 215) `tests/ # R23 node:test suite (built & green)`.
  - Deferred `OQ-2` (line 336) says `no CI infrastructure exists yet; AD-16 suite is the local gate until then`, contradicting Consistency Conventions (line 184) and the repo.
- **Verified repo reality:** `tests/` contains 15 `*.test.mjs` files plus `helpers.mjs`, and `node --test "tests/*.test.mjs"` passes **182/182 tests across 44 suites**. Repo-root CI already exists at `../.github/workflows/validate.yml`, running `node scripts/validate.mjs`, `node --test "tests/*.test.mjs"`, and `node scripts/check-version-sync.mjs` on Node 22.
- **Fix:** Update `R23` row to `tests/ (15 suites, 182 tests passing)` and revise Deferred `OQ-2` to note that repo-root CI exists (`../.github/workflows/validate.yml`), while a standalone `--verify-trackers` CLI flag remains deferred to `v0.6.0`.

---

### Low

#### L-1 — `OQ-6` host display-mode closure lacks a pinned host version or reproducible check in-repo
- **Spine claims (`AD-9:108`, `Stack:194`, `Open Questions:319`):** Marks `OQ-6` closed ("verified against ZCode Desktop host: side-pane surfaces already run in `displayMode: 'fullscreen'` ... requesting `'fullscreen'` is a no-op and requesting `'inline'` closes the side pane").
- **Verified repo reality:** The repo itself does not contain a verification note or test for `ui/request-display-mode` (the assertion comes solely from `.memlog.md:45`), and the Stack table (line 194) leaves ZCode Desktop unpinned (`host-managed`). The claim is consistent with existing plugin metadata (`assets/panel.html:1391` sends `availableDisplayModes: ["inline", "fullscreen"]`; `scripts/mcp-server.mjs:97, 222, 294` sets `"openai/ui": { preferredModelDisplayMode: "fullscreen" }`).
- **Fix:** Record the verified ZCode Desktop build/version and verification method alongside the `2026-11-25` closure note so future host upgrades can re-check it.

#### L-2 — `AD-13` omits `ZCODE_SESSION_ID` fallback
- **Spine claims (`AD-13`, line 132):** Says `Stop` matches the task's `sessionId` against `CLAUDE_SESSION_ID`.
- **Verified repo reality:** `scripts/hook-runner.mjs:305-307` resolves `process.env.CLAUDE_SESSION_ID || process.env.ZCODE_SESSION_ID || ""`.
- **Fix:** Mention both `CLAUDE_SESSION_ID` and `ZCODE_SESSION_ID` in `AD-13` (and `AD-18`).

#### L-3 — Tool `readOnlyHint` nuance on `bmad_open_companion` / `bmad_recommend_next`, and frontmatter status
- **Verified repo reality:**
  - `bmad_open_companion` (`mcp-server.mjs:90`) and `bmad_recommend_next` (`mcp-server.mjs:311`) declare `annotations: { readOnlyHint: true }`, yet both write `lastUserPrompt` via `savePersistedState` when optional `args.focus` (`mcp-server.mjs:513-518`) or `args.topic` (`mcp-server.mjs:567-572`) is supplied. They do remain read-only on tracker files (`AD-4` holds), but mutate `state.json`.
  - Stories emit both `smartEvidence` and `smartReason` (`bmad-engine.mjs:1802-1803, 1889-1890, 1976-1977`); `AD-5` names `smartEvidence` while PRD `FR-10` names `smartReason` (both are present, so no runtime mismatch).
  - Frontmatter line 8 is `status: draft` (appropriate while these review items remain open; update to `final` once resolved).

---

## Verified Accurate (Confirmed Against Repo & Environment)

- **Version & build gate:** `.zcode-plugin/plugin.json` (`0.5.4`), `../marketplace.json` (`0.5.4`), `scripts/mcp-server.mjs:701` (`0.5.4`), and `assets/panel.html:1389,1697` (`0.5.4`) all match; `node scripts/check-version-sync.mjs` exits `0`.
- **Test suite:** `node --test "tests/*.test.mjs"` runs green with **182/182 tests passing** across **44 suites** (zero failures).
- **Zero-dependency runtime & toolchain versions:** No `package.json` at plugin root; `node:*` built-ins only; verified `Node v26.12.1`, `Python 3.14.10`, `uv 0.13.8`, and `_bmad/` directory present.
- **9 MCP tools:** All 9 tool names in `scripts/mcp-server.mjs` (`TOOLS` lines 75–491) match the spine (`bmad_open_companion`, `bmad_get_state`, `bmad_update_advisor`, `bmad_prepare_new_session`, `bmad_reconcile_trackers`, `bmad_recommend_next`, `bmad_inspect_artifact`, `bmad_open_artifact_file`, `bmad_queue_manage`).
- **Core invariants verified in code:**
  - `AD-2` import direction: `mcp-server.mjs` and `hook-runner.mjs` import only from `bmad-engine.mjs`; `bmad-engine.mjs` imports no adapter.
  - `AD-3` atomic tmp-file + rename persistence in `savePersistedState` (`bmad-engine.mjs:1427-1455`) and `loadPersistedState` (`1406-1425`).
  - `AD-4` read-only scan, `.bak` backup before edit, `reconciliation-log.json` newest-first capped at 20 (`bmad-engine.mjs:3324-3339`).
  - `AD-5` deterministic evidence gating (`evaluateStorySmartStatus`, `bmad-engine.mjs:1577-1607`) and `AbortSignal.timeout(4500)` Stop LLM synthesis (`hook-runner.mjs:34, 71-124`).
  - `AD-6` workspace path confinement including symlink `realpathSync` check (`resolveWorkspaceArtifactPath`, `bmad-engine.mjs:2826-2872`) and `/` normalization.
  - `AD-9` `window.parent.postMessage` bridge, zero `window.zcode`, `escapeHtml` (`panel.html:1523-1529`), `text/html;profile=mcp-app`, `zcode/csp: { unsafeEval: false }`.
  - `AD-11` single running task invariant and atomic `storyOverrides` sync in `manageBmadTaskQueue`.
  - `AD-12` standalone `.zcode/workflows/bmad-task-queue.dwf.ts` + `.zcode/bmad-companion/queue-step-updater.mjs` and `separate-sessions` `CreateSession` + Stop-hook continuation directive (`{ decision: "block", reason }`).
  - `AD-13` single-line stdout isolation via `emitHookFrame` + console redirection to `stderr` (`hook-runner.mjs:18-29`), 15-file `recentTouchedFiles` cap, 4000/6000 prompt/message caps.
  - **UX cross-references:** `EXPERIENCE.md` defines `AD-1–AD-6`, `RD-7`, `RD-9`, `OQ-6`; `DESIGN.md` defines `CD-1–CD-5` and `Palette C`.
