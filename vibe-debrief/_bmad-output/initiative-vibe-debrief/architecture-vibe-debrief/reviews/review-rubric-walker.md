---
type: architecture-spine-review
target: ../architecture-vibe-debrief.md
reviewer: rubric-walker
date: 2026-11-18
verdict: PASS
---

# Architecture Spine Review — vibe-debrief (Cockpit HUD vNext & v0.3.0 Hardening)

**Target:** `D:\Developpement\Projets\Zcode plugins\vibe-debrief\_bmad-output\initiative-vibe-debrief\architecture-vibe-debrief\architecture-vibe-debrief.md`  
**Inputs Checked:**
- `D:\Developpement\Projets\Zcode plugins\vibe-debrief\_bmad-output\initiative-vibe-debrief\initiative-vibe-debrief.md` (`R1`–`R12`, `C1`–`C7`)
- `D:\Developpement\Projets\Zcode plugins\vibe-debrief\_bmad-output\initiative-vibe-debrief\ux-vibe-debrief\DESIGN.md`
- `D:\Developpement\Projets\Zcode plugins\vibe-debrief\_bmad-output\initiative-vibe-debrief\ux-vibe-debrief\EXPERIENCE.md` (`OQ-5`)
- `D:\Developpement\Projets\Zcode plugins\vibe-debrief\AGENTS.md`
- Brownfield verification against `scripts/debrief-engine.mjs`, `scripts/mcp-server.mjs`, `scripts/hook-runner.mjs`, and `assets/panel.html`

**Verdict:** **PASS**

The updated architecture spine resolves every finding from the prior review (`AD-5` atomic temp-file + `renameSync` persistence, `AD-6` shared Dark HUD / Field Desk Light CSS token contract, `AD-8` automated 4-file version-sync gate, `AD-9` explicit tool/message enumeration, `AD-13` turn-handoff & model-agnostic Clarify contract) while cleanly extending `AD-14`..`AD-17` and the `OQ-5` schema seed for Cockpit HUD vNext. Three non-blocking implementation watchpoints (`medium`/`low`) are recorded below for epic/story refinement.

---

## Good-Spine Checklist Evaluation

### 1. Fixes the real divergence points for the level below (epics/stories) and misses none
**PASS.**

All cross-cutting divergence vectors across both the `v0.3.0` hardening wave (`R8`–`R12`) and the `v0.4.0` Cockpit HUD vNext wave (`OQ-5`, `AD-14`–`AD-17`) are locked:
- **Layer & transport boundaries (`AD-1`–`AD-4`):** One file per runtime layer, downward-only imports (`mcp-server` and `hook-runner` -> `debrief-engine`), strict `stdout` framing isolation, and zero external dependencies (`node:` built-ins only).
- **Concurrency & schema evolution (`AD-5`):** Atomic sibling temp-file (`vibe-debrief-state.<pid>.<timestamp>.tmp`) + `renameSync` prevents cross-process torn reads/writes between MCP and Hook invocations (`R9`), and `ensureDebriefEnriched` guarantees additive in-memory normalization of `v0.2.0`/`v0.3.0` snapshots into the `v0.4.0` Cockpit HUD schema (`OQ-5`).
- **Dual-surface theme & diagram parity (`AD-6`, `AD-14`):** Both `assets/panel.html` and `generateStandaloneHtmlArtifact` consume the same CSS custom property tokens from `DESIGN.md` (`getComputedStyle(document.documentElement)`) and render the same 5-grammar `diagramSpec` (sync-aliased with `debrief.diagram`).
- **Client-side X-Ray & transient state isolation (`AD-10`, `AD-15`):** Pre-packaged `xray.plain` and `xray.tech` payloads guarantee `< 16ms` local DOM toggles with zero RPC/LLM calls, and `renderPanelState` separates server-owned `panelState` from 8 transient UI state flags.
- **Host messaging & Stage 2 fallback (`AD-9`, `AD-16`, `AD-17`):** All quick-reply chips (`waitingOnYou`), `Clarify`/`Distill` triggers, and Stage 2 visual plugin pop-outs (`excalidraw`, `visualize`, `vectorcraft`, `designcraft`) route through `ui/message`, with a mandatory zero-LLM fallback to `vibe_debrief_export_html` + `missing-banner` whenever a target plugin is not installed.

### 2. Every AD's Rule is enforceable and actually prevents its stated divergence
**PASS (with 2 non-blocking story-level watchpoints).**

Every AD from `AD-1` through `AD-17` states a concrete, testable Rule that directly prevents its stated divergence:
- `AD-1`–`AD-4`, `AD-6`, `AD-8` are statically verifiable via `node --test` and `scripts/check-version-sync.mjs`.
- `AD-5` now enforces atomic temp-file + `renameSync` writes (`<= 50ms` budget `C6`), directly preventing multi-process state corruption (`R9`).
- `AD-10` enforces semantic ARIA roles, `tabindex="0"`, keyboard handlers, and `prefers-reduced-motion: reduce` (`R11`).
- `AD-11` and `AD-13` enforce never-crash hook execution, `agentPublishedThisTurn` preservation, `heuristicConfidence < 0.55` honest `unclear-box` fallback, and dynamic cheapest-model discovery (`discoverCheapestEnabledModels`).

**Watchpoints for epic/story authors:**
1. **[MEDIUM] Transitional contract between `R5`/`R8` (`v0.3.0`) and `AD-12` (`v0.4.0`) on `complexity.level` & `explainerScenes`:**
   - Brownfield `assessWorkflowComplexity` (`scripts/debrief-engine.mjs:366`) returns `level: "complex" | "simple"`, and `R5` / `buildExplainerScenesIfComplex` gates `explainerScenes` to `level === "complex"` (returning `[]` on simple turns).
   - `AD-12` introduces 3 levels (`"minimal"` | `"focused"` | `"complex"`) and pre-synthesizes deterministic `explainerScenes` on every non-minimal turn so `Visual` and `[Animate]` work without complexity lockout.
   - **Mitigation for stories:** To ensure `v0.3.0` (`R8`) regression tests and `v0.4.0` (`AD-12`) coexist cleanly regardless of release slicing, keep `buildExplainerScenesIfComplex(debrief, complexity, force = false)` behavior unchanged for direct unit tests, drive the tiny-turn UI collapse from the boolean `debrief.minimalMode` field (already in the `OQ-5` JSON seed), and treat `"simple"` and `"focused"` as compatible non-complex synonyms in tests.
2. **[LOW] MCP tool `inputSchema` widening in `scripts/mcp-server.mjs`:**
   - Brownfield `TOOLS` definitions in `scripts/mcp-server.mjs` enforce `additionalProperties: false` on all 8 tools.
   - `AD-17` passes `{ conceptSlug, targetPlugin }` to `vibe_debrief_export_html` (currently `properties: {}` at `scripts/mcp-server.mjs:450`), `gear-popover` (`AD-7`, `AD-13`) updates `language` and `preferredModel` (via `vibe_debrief_set_persona`), and `vibe_debrief_publish` accepts optional `OQ-5` fields (`verdict`, `waitingOnYou`, `diagramSpec`, `xray`, `concepts`, `microBlocks`). Stories implementing `AD-14`–`AD-17` must add these optional properties to `TOOLS[*].inputSchema.properties`.

### 3. Nothing under Deferred could let two units built independently diverge
**PASS.**

All four previously deferred items that carried cross-unit divergence risk (`R8` `node:test` suite, `R9` atomic state writes, `R10` shared light-theme tokens, `R11` ARIA/keyboard, `R12` automated version sync) have been promoted into active ADs (`AD-5`, `AD-6`, `AD-8`, `AD-10`) and `Structural Seed`. The remaining four `Deferred` entries (`OQ-1` PO telemetry metric pick, `v0.3.0` vs `v0.4.0` release train sequencing, `COULD` enhancements, and single-user desktop deployment) carry zero cross-unit architectural divergence risk.

### 4. AD-1..AD-13 IDs remained stable while AD-14..AD-17 extend the spine for Cockpit HUD vNext
**PASS.**

- `AD-1` through `AD-12` retain their exact original numbering and domain scopes.
- `AD-13` occupies the turn-handoff / model-agnostic clarification slot.
- `AD-14` (`Declarative Multi-Grammar Diagram Spec`), `AD-15` (`Dual-Coded X-Ray Payload & Composable Micro-Blocks`), `AD-16` (`5-State Waiting-On-You Radar & ui/message Action Dispatch`), and `AD-17` (`Two-Stage Concept Deep Dive Bridge & Mandatory Missing-Plugin HTML Fallback`) extend the spine for Cockpit HUD vNext without renumbering any upstream reference in `initiative-vibe-debrief.md`.

### 5. Ratifies rather than contradicts the brownfield codebase
**PASS (with 1 low-severity brownfield alignment note).**

The spine accurately ratifies:
- `scripts/debrief-engine.mjs`: All 21 existing functions/constants, file classification heuristics, STE-80 scoring (`40–99`, `STE-80` / `Clear` / `Dense`), collection caps (`15`/`15`/`50`), `ensureDebriefEnriched` pipeline, HTML payload `<` escaping (`\u003c`), ZCode memory path resolution (`~/.zcode/cli/memories/projects/<slug>/memory/` -> `<workspaceRoot>/.zcode/memory/`), and `~/.zcode/v2/` model discovery.
- `scripts/mcp-server.mjs`: All 8 `vibe_debrief_*` tools, `protocolVersion: "2025-11-25"`, `ui://vibe-debrief/panel.html`, MIME `text/html;profile=mcp-app`, and `_meta["zcode/csp"].unsafeEval: false`.
- `scripts/hook-runner.mjs`: All 4 lifecycle modes (`session-start`, `user-prompt`, `post-tool`, `stop`), `readStdinJson()`, `agentPublishedThisTurn` check, `synthesizeHeuristicDebrief`, and `tryOptionalAiDebriefSynthesis` (`AbortSignal.timeout(4500)`).
- `assets/panel.html`: `PROTOCOL_VERSION = "2026-01-26"`, `15,000ms` `pendingRequests` timeout, `renderPanelState`, `applyHostTheme`, and `window.speechSynthesis`.

**Minor brownfield note:**
- **[LOW] Workspace root env var precedence in `scripts/hook-runner.mjs`:** Consistency Conventions (line 358) specifies `ZCODE_WORKSPACE_ROOT` -> `ZCODE_PROJECT_DIR` -> `CLAUDE_PROJECT_DIR` -> `process.cwd()` (with `payload.cwd` first in `hook-runner.mjs`). In brownfield `scripts/hook-runner.mjs:96-101`, `ZCODE_WORKSPACE_ROOT` is currently omitted between `payload.cwd` and `process.env.ZCODE_PROJECT_DIR`. Adding `process.env.ZCODE_WORKSPACE_ROOT` in `hook-runner.mjs` during the test/hardening wave will make both entrypoints 100% identical.

### 6. Covers every requirement in the initiative ticket (`R1`-`R12`, `C1`-`C7`) and UX spines (`OQ-5`)
**PASS — 100% traceability.**

- **Frontmatter `binds:` (line 11):** Explicitly binds `R1`–`R12`, `C1`–`C7`, `FR-1`–`FR-28` (including `FR-8a`), `RULE-1`–`RULE-6`, and `OQ-5`.
- **Capability -> Architecture Map (lines 497–527):** Maps every requirement (`R1`–`R12`, `FR-1`–`FR-28`, `FR-8a`, `OQ-5`) to concrete files, functions, and governing ADs.
- **Canonical Data Contracts (`OQ-5` Schema Seed, lines 253–343):** Provides a concrete, copy-ready JSON contract for `panelState` and `currentDebrief` covering `verdict`, `minimalMode`, `heuristicConfidence`, `rawQuote`, `xray` (`plain` + `tech`), `waitingOnYou` (with `chips`), `diagramSpec` (5 grammars, `viewBoxWidth: 460`), `microBlocks` (`string[]` block keys), and `concepts` (`stage1` + `stage2Prompt`).

### 7. Every dimension the altitude owns (including operational/environmental envelope) is decided, deferred, or an open question
**PASS.**

- **Runtime & dependency envelope:** Node.js `>= 20` ESM (`node:test`, built-in `fetch`), zero npm packages, single-file MCP App iframe (`unsafeEval: false`).
- **Performance & concurrency budget:** Stop hook heuristic synthesis `<= 50ms` (`< 20ms` nominal, `C6`), atomic state write via temp-file + `renameSync` (`R9`), client-side X-Ray flip `< 16ms`, Stage 1 concept drawer `< 100ms`, optional AI synthesis timeout `4,500ms`, panel RPC timeout `15,000ms`.
- **Failure & degradation envelope:** Read-only workspaces degrade silently; missing/corrupt state file seeds `createWelcomeDebrief`; unwritable `~/.zcode/cli/memories` falls back to `<workspaceRoot>/.zcode/memory/`; low heuristic confidence (`< 0.55`) renders `unclear-box` with model-agnostic `Clarify`; missing external Stage 2 visual plugins automatically fall back to the built-in Standalone HTML Explainer + `missing-banner`.
- **Deployment & release sequencing:** Explicitly addressed in `Deferred`.

---

## Summary of Findings

| ID | Severity | Location | Finding & Recommendation |
| --- | --- | --- | --- |
| **F-1** | **Medium** | `AD-12` vs. `R5`/`R8` (`scripts/debrief-engine.mjs:366, 713`) | `AD-12` evolves `assessWorkflowComplexity` to `"minimal" \| "focused" \| "complex"` and synthesizes `explainerScenes` on every non-minimal turn, whereas `R5`/`R8` (`v0.3.0`) tests `level: "simple" \| "complex"` and gates `explainerScenes` on `level === "complex"`. Keep `buildExplainerScenesIfComplex` intact for `R8` unit tests and drive tiny-turn collapse from `debrief.minimalMode` so `v0.3.0` and `v0.4.0` tests do not conflict. |
| **F-2** | **Low** | `AD-15`, `AD-17` vs. `scripts/mcp-server.mjs:193-504` | Brownfield `TOOLS` schemas specify `additionalProperties: false` (`vibe_debrief_export_html` currently has `properties: {}`). Stories implementing `AD-14`–`AD-17` must widen `inputSchema.properties` on `vibe_debrief_export_html` (`conceptSlug`, `targetPlugin`), `vibe_debrief_set_persona` (`language`, `preferredModel`), and `vibe_debrief_publish` (optional `OQ-5` fields). |
| **F-3** | **Low** | Consistency Conventions (line 358) vs. `scripts/hook-runner.mjs:96-101` | Consistency Conventions states workspace root resolves `ZCODE_WORKSPACE_ROOT` -> `ZCODE_PROJECT_DIR` -> `CLAUDE_PROJECT_DIR` -> `process.cwd()` (after `payload.cwd` in `hook-runner.mjs`), but brownfield `hook-runner.mjs` currently omits `process.env.ZCODE_WORKSPACE_ROOT`. Add `process.env.ZCODE_WORKSPACE_ROOT` to `hook-runner.mjs` during `R8` transport tests. |
