---
type: architecture-spine-review
target: ../architecture-vibe-debrief.md
reviewer: rubric-walker
date: 2026-11-17
verdict: CONDITIONAL PASS
---

# Architecture Spine Review — vibe-debrief

**Target:** `D:\Developpement\Projets\Zcode plugins\vibe-debrief\_bmad-output\initiative-vibe-debrief\architecture-vibe-debrief\architecture-vibe-debrief.md`  
**Inputs Checked:**
- `D:\Developpement\Projets\Zcode plugins\vibe-debrief\AGENTS.md`
- `D:\Developpement\Projets\Zcode plugins\vibe-debrief\_bmad-output\planning-artifacts\prd-vibe-debrief.md`
- Brownfield verification against `.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs`, `scripts/debrief-engine.mjs`, and `assets/panel.html`

**Verdict:** **CONDITIONAL PASS**

The spine is clean, strongly grounded in the brownfield codebase, and achieves 100% traceability across `FR-1`–`FR-28` and `RULE-1`–`RULE-6`. Two targeted fixes are needed before locking: (1) align `AD-5` so it does not claim to prevent multi-process concurrent write corruption via an unlocked `writeFileSync`, and (2) close minor divergence gaps around turn-handoff state (`agentPublishedThisTurn`) and shared SVG/Canvas theme tokens across `panel.html` and `generateStandaloneHtmlArtifact`.

---

## Checklist Evaluation

### 1. Does it fix the real divergence points for the level below and miss none?
**Mostly Yes — 2 minor gaps.**

`AD-1` through `AD-12` cover the primary divergence points across the four runtime layers (`debrief-engine.mjs`, `mcp-server.mjs`, `hook-runner.mjs`, `panel.html`): layer separation, unidirectional imports, stdout framing isolation, zero external dependencies, centralized persistence, CSP/XSS safety, reading-boundary clarity, 4-file version sync, `postMessage` bridge, single UI render entry point, never-crash hooks, and complexity gating.

**Missed or under-specified divergence points:**
- **Turn-handoff coordination (`agentPublishedThisTurn`):** Both `vibe_debrief_publish` (`mcp-server.mjs`) and `UserPromptSubmit`/`Stop` (`hook-runner.mjs`) coordinate via `state.agentPublishedThisTurn`. It appears in Consistency Conventions and the Capability Map (`FR-3`, `FR-10`, `FR-12`), but lacks an explicit invariant/AD. If a future tool or hook forgets to set or clear it, `Stop` silently overwrites an agent-published debrief.
- **Cross-process state race:** `mcp-server.mjs` and `hook-runner.mjs` run as separate OS processes and both mutate `.zcode/vibe-debrief-state.json`. See item 2 below.

### 2. Is every AD's Rule enforceable and does it actually prevent its stated divergence?
**No — 1 concrete gap in `AD-5`, plus 2 minor precision notes.**

- **Gap (`AD-5 — Engine Owns All Persistent State`):** `AD-5` states *"Prevents: Split persistence logic; concurrent state corruption from multiple writers."* Centralizing I/O in `debrief-engine.mjs` prevents split persistence logic, **but does not prevent concurrent state corruption from multiple writers**. `mcp-server.mjs` and `hook-runner.mjs` are separate OS processes that both run `loadPersistedState` → merge → `savePersistedState` (`writeFileSync` in `debrief-engine.mjs:70`) with no file lock or atomic temp-file rename. Either narrow `AD-5`'s "Prevents" claim to split persistence/schema drift, or add atomic write-and-rename / lock semantics to the Rule.
- **Manual enforcement (`AD-8 — 4-File Version Sync`):** The Rule is clear, but enforcement relies on manual discipline until `OQ-4` (`scripts/check-version-sync.mjs`) is implemented in `v0.3.0`.
- **Precision (`AD-9 — Panel–Host Communication Protocol`):** Line 144 specifies `tools/call (6 tool names)`. Listing the 6 panel-called tools (`get_state`, `set_persona`, `toggle_check`, `export_html`, `generate_explainer`, `confirm_lesson`) vs. the 2 agent-only tools (`open`, `publish`) would remove ambiguity.
- All other ADs (`AD-1`–`AD-4`, `AD-6`, `AD-7`, `AD-10`–`AD-12`) are concrete, verifiable (e.g., `grep`/AST-checkable for `AD-3`, `AD-4`, `AD-6`), and directly prevent their stated divergences.

### 3. Is anything under Deferred that could let two units diverge?
**Mostly No — 1 watchpoint.**

- **Light-theme parity for SVG/Canvas:** Deferred to `v0.3.0` UX. However, *two* units render SVG diagrams and Canvas explainers independently: `assets/panel.html` and `scripts/debrief-engine.mjs` (`generateStandaloneHtmlArtifact`). Deferring light-theme parity without a shared theme-token contract risks palette divergence if either unit is styled independently.
- **Other deferred items (`AD-13` `node --test` suite, `OQ-3` Hook AI synthesis disposition, `OQ-4` automated version-sync check, ARIA/keyboard/reduced-motion, Deployment/environments):** None of these allow architectural divergence between units; `AD-4` already constrains `AD-13` to `node:test`.

### 4. Is named tech verified-current?
**Yes.**

All stack entries match `AGENTS.md` and the live codebase:
- Node.js ESM `>= 18` (built-in `fetch`, `node:test`), tested on `v26.12.1`.
- MCP Protocol `"2025-11-25"` (matches `scripts/mcp-server.mjs`).
- MCP App Protocol `"2026-01-26"` (matches `assets/panel.html:1166`).
- Built-in browser APIs (HTML5 Canvas 2D, Web Speech API) and ZCode Plugin Manifest `v0.2.0` (`.zcode-plugin/plugin.json`).
- Gemini model defaults (`gemini-2.5-flash`, fallback `new-provider/gemini-3.8-flash`) match `AGENTS.md` and PRD.

### 5. Does it ratify rather than contradict the brownfield codebase (`AGENTS.md`)?
**Yes.**

Every invariant in `AGENTS.md` is ratified: 4-file layer split, zero external dependencies, stdout isolation, `unsafeEval: false`, `escapeHtml()` + `\u003c` JSON escaping, 4-file version sync, workspace root precedence, ZCode memory directory fallback, collection caps (`15`/`15`/`50`), complexity gate (`>= 4`), `4500ms` AI timeout, and the Reading-Boundary Principle. The `21` exports cited in `Structural Seed` for `scripts/debrief-engine.mjs` also match the actual codebase. (`tests/debrief-engine.test.mjs` is properly tagged `[ASSUMPTION] v0.3.0`.)

### 6. Does the Capability → Architecture Map cover every requirement in the PRD (`FR-1`..`FR-28`, `RULE-1`..`RULE-6`)?
**Yes — 100% coverage in the map table.**

Every requirement in `prd-vibe-debrief.md` (`FR-1` through `FR-28`, including `FR-8a`, and `RULE-1` through `RULE-6`) is mapped to its runtime layer(s)/function(s) and governing AD(s).  
*(Minor nit: `FR-8a` is present in the Capability → Architecture Map table but omitted from the YAML frontmatter `binds:` list.)*

### 7. Is every dimension the initiative altitude owns decided, deferred, or an open question?
**Yes — with one minor observability note.**

- **Deployment & environments:** Explicitly addressed under `Deferred` (single-user ZCode desktop plugin; no CI/CD or multi-user infra).
- **Infra / provider strategy:** Decided across `System Context`, `AD-4`, `AD-11`, and `Deferred (OQ-3)` (ZCode Host, optional OpenAI-compatible `Stop` synthesis with `4500ms` timeout + heuristic fallback, and `CreateSession` lightweight Gemini delegation).
- **Operations:** Health check (`ping`), graceful degradation (`AD-11`), and storage fallbacks are covered. Only `stderr` diagnostic logging conventions (when silent `catch` blocks should log to `stderr` vs. stay silent) are left implicit.

---

## Recommended Adjustments

1. **Fix `AD-5`:** Either narrow *"Prevents"* to *"Split persistence logic and uncoordinated schema mutations"* or specify atomic write (`writeFileSync` to temp + `renameSync`) / lockfile protection so the Rule actually prevents multi-process write races.
2. **Add turn-handoff invariant:** Document the `agentPublishedThisTurn` lifecycle contract (set by `vibe_debrief_publish`, respected by `Stop`, cleared by `UserPromptSubmit`/`Stop`) as an explicit invariant or Consistency Convention rule.
3. **Minor cleanups:** Add `FR-8a` to frontmatter `binds`, name the 6 panel-invoked tools in `AD-9`, and note in `Deferred` (Light-theme parity) that `panel.html` and `generateStandaloneHtmlArtifact` must share theme tokens when implemented.
