# Input Reconciliation Review — `architecture-vibe-debrief.md`

- **Reviewed Artifact:** `_bmad-output/initiative-vibe-debrief/architecture-vibe-debrief/architecture-vibe-debrief.md` (`updated: 2026-11-18`)
- **Compared Against:**
  1. `_bmad-output/initiative-vibe-debrief/initiative-vibe-debrief.md` (`R1`–`R12`, `C1`–`C7`, Boundaries, Notes)
  2. `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md` (Cockpit HUD vNext tokens, Field Desk Light parity, 25 component contracts)
  3. `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md` (Cockpit HUD vNext IA, 5-state `Waiting On You`, `X-Ray` toggle, 5-grammar SVG, Two-Stage Concept Deep Dive, mandatory missing-plugin HTML fallback, model-agnostic `Clarify`, Tiny-Turn Minimal Mode, anytime Curator Tour, `OQ-5`)
  4. `_bmad-output/initiative-vibe-debrief/brainstorm-ui-ux-diagram-plugins/brainstorm-ui-ux-diagram-plugins.md` (`MUST` / `SHOULD` / `COULD` / `WON'T` scope)
- **Verdict:** **PASS WITH MINOR RECONCILIATION FIXES** (`0` Critical, `0` High, `3` Medium, `2` Low)

---

## 1. Executive Summary

The updated architecture spine (`AD-1`–`AD-17`, `OQ-5` schema seed, C4/data-flow diagrams, and Capability Map) successfully lands the vast majority of requirements across all four input documents, cleanly bridging the `v0.2.0` baseline (`R1`–`R7`), the `v0.3.0` hardening wave (`R8`–`R12`, `C1`–`C7`), and the `v0.4.0` Cockpit HUD vNext design (`DESIGN.md`, `EXPERIENCE.md`, and `brainstorm-ui-ux-diagram-plugins.md`).

However, five details from the UX and brainstorm inputs were either subtly weakened or left underspecified at the schema/RPC boundary. None block the 4-layer architecture paradigm, but resolving them in the spine will prevent rework during implementation.

---

## 2. Prioritized Findings

### Finding 1 — `[MEDIUM]` Stage 2 Built-In HTML Fallback & `ConceptItem` Schema Omit 3-Column Deep Explanation Data, Display Path, and `"designcraft"` Target
- **Sources:** `DESIGN.md` (`stage2-popout` & `missing-banner`, line 508), `EXPERIENCE.md` (`Information Architecture` line 39, `Component Patterns` line 75, `UJ-2` line 139), `brainstorm-ui-ux-diagram-plugins.md` (§2.5 lines 55–59) vs. `architecture-vibe-debrief.md` (`AD-17`, `OQ-5` Schema Seed lines 246–250, 326–339).
- **What Did Not Land / Was Weakened:**
  1. **Missing Stage 2 zero-LLM explanation fields:** `DESIGN.md` specifies that `stage2-popout` and the built-in HTML fallback render a 3-column deep explanation grid (`How It Works`, `Key Trade-off`, `In Your Codebase`) alongside a `270px+` canvas and floating `{colors.telemetry-pill-bg}` telemetry bar. `AD-17` requires the missing-plugin HTML fallback to run at **zero LLM cost**, yet `ConceptItem` in `AD-17` and `OQ-5` only carries `stage1: { definition, analogy, microVisualSpec }` and `stage2Prompt` — omitting `stage2: { howItWorks, keyTradeOff, inYourCodebase, telemetrySummary }`.
  2. **How the fallback artifact opens:** `AD-17` states that `panel.html` calls `vibe_debrief_export_html` (`tools/call` with `{ conceptSlug, targetPlugin }`) "to generate and open the Built-in Standalone HTML Explainer". In `v0.2.0`, `vibe_debrief_export_html` only writes a file to disk and returns its path. The spine should specify how the generated fallback is opened/surfaced to the user (e.g., returning `artifactPath` + opening/linking it or rendering the Stage 2 fallback view + `missing-banner` immediately).
  3. **`"designcraft"` omitted in `AD-17` union:** `AD-5` (line 109) and `AD-9` (line 151) include `"designcraft"` alongside `"excalidraw"`, `"visualize"`, and `"vectorcraft"` (matching `EXPERIENCE.md` line 75 and `brainstorm` §2.5 line 58), but `AD-17` (line 246 & 249) narrows `targetPlugin` to `"excalidraw" | "visualize" | "vectorcraft"`.
- **Remediation:** Add `stage2: { howItWorks, keyTradeOff, inYourCodebase }` to `ConceptItem` in `AD-17`/`OQ-5`, include `"designcraft"` in `targetPlugin`, and clarify in `AD-17` how `generateStandaloneHtmlArtifact` and `panel.html` render/open the Stage 2 fallback and `missing-banner`.

---

### Finding 2 — `[MEDIUM]` `gear-popover` Settings Persistence Path (`language`, `preferredModel`, `ste100Enabled`) and `themeOverride` State Are Unspecified
- **Sources:** `DESIGN.md` (`gear-popover` line 497), `EXPERIENCE.md` (`Settings & Export` line 38, `gear-popover` line 65), `initiative-vibe-debrief.md` (`Boundaries` line 67) vs. `architecture-vibe-debrief.md` (`AD-9` line 148, `AD-10` lines 162–170, `OQ-5` lines 261–264).
- **What Did Not Land / Was Weakened:**
  1. `DESIGN.md` and `EXPERIENCE.md` specify six controls inside `gear-popover`: `Surface Theme`, `Language`, `Persona`, `Clarity Guard` (`STE-80`), `Model` selector (`auto-cheapest` or user override), and `Export HTML`.
  2. `OQ-5` places `activePersona`, `ste100Enabled`, `language`, and `preferredModel` inside persisted `panelState` (and `AD-7`/`AD-13` require `hook-runner.mjs` to read `state.language` and `state.preferredModel` from `vibe-debrief-state.json`). However, `AD-9` and the Capability Map only list the existing 8 MCP tools without specifying which tool persists `language` and `preferredModel` changes from `gear-popover` (e.g., extending `vibe_debrief_set_persona` input parameters to accept `{ persona?, ste100Enabled?, language?, preferredModel? }`).
  3. Per `initiative-vibe-debrief.md` (`Touch point: ZCode host theme context — consumed, never set, by the panel`), the `Surface Theme` toggle in `gear-popover` acts as a local panel override (`"auto" | "dark" | "light"`), but `themeOverride` is missing from the panel-owned transient UI state list in `AD-10`.
- **Remediation:** Specify in `AD-5`/`AD-9` (and the `FR-4` row of the Capability Map) that `vibe_debrief_set_persona` accepts optional `{ persona, ste100Enabled, language, preferredModel }` settings patches, and add `themeOverride` (`"auto" | "dark" | "light"`) to `AD-10` transient UI state.

---

### Finding 3 — `[MEDIUM]` Incomplete `OQ-5` Schema Seed & `AD-10` Transient State for `proof-pill`, `choice-grid` Trade-Off Bars, `lesson-form`, and `xray.tech`
- **Sources:** `DESIGN.md` (`choice-grid` line 502, `proof-pill` & `audit-row` line 505, `unclear-box` line 509, `lesson-form` line 511), `EXPERIENCE.md` (`Component Patterns` lines 70, 73, 76, 78, `Interaction Primitives` line 105), `brainstorm-ui-ux-diagram-plugins.md` (§2.3–2.4) vs. `architecture-vibe-debrief.md` (`AD-10`, `AD-15`, `OQ-5` Schema Seed).
- **What Did Not Land / Was Weakened:**
  1. **`microBlocks` type mismatch & missing block payloads in `OQ-5` seed:** `AD-15` line 224 defines `microBlocks: MicroBlock[]`, whereas the `OQ-5` JSON seed (line 325) shows `"microBlocks": ["diagram", "proof-audit", "concepts", "lessons"]` (`string[]` of block keys) without showing the enriched schema for:
     - `proof-pill` items (`status: "ok" | "risk" | "info"`, `label`, `techLabel`, and expandable monospace `detail` snippet per `DESIGN.md` line 505 / `EXPERIENCE.md` line 73).
     - `choice-grid` items (`subtext` and `34×4px` `tradeOffs: [{ label, score }]` meter bars per `DESIGN.md` line 502 / `EXPERIENCE.md` line 70; `AD-16` mentions `tradeOffs` in prose on line 237 but omits it from the `OQ-5` JSON example).
     - `xray.tech` fields promised in `AD-15` prose (`summaryBullets`, `exitCodes`, `proofLines`) which are absent from `xray.tech` in the `OQ-5` JSON example (lines 284–289).
  2. **Transient UI state gaps in `AD-10`:** `EXPERIENCE.md` requires inline toggles for `proof-detail` drawers (`proof-pill` click), `Show Raw Reply` (`unclear-box`), and `lesson-form` (`💡→Rule` prefill / `➕ Add Lesson`, closable via `Escape`). None of `expandedProofIds`, `showRawReply`, or `lessonFormState` (`{ open, title, summary, why, howToApply }`) appear in `AD-10`'s transient UI state list, risking user input loss if a background `tool-result` triggers `renderPanelState`.
- **Remediation:** Clarify in `AD-15`/`OQ-5` that `microBlocks` is an ordered array of block-type keys backed by typed fields on `Debrief` (including `proofClaims[].detail`, `waitingOnYou.chips[].subtext`/`tradeOffs`, and `xray.tech.summaryBullets`/`exitCodes`/`proofLines`), and add `expandedProofIds`, `showRawReply`, and `lessonFormState` to `AD-10`.

---

### Finding 4 — `[LOW]` `R5`/`R8` Complexity Gate Contract vs. `AD-12` Anytime Curator Tour Needs Explicit Field Reconciliation
- **Sources:** `initiative-vibe-debrief.md` (`R5` line 33, `R8` line 36), `AGENTS.md` (§5 Complexity Gate) vs. `EXPERIENCE.md` (`Visual` line 36, `explainer-stage` line 77), `brainstorm-ui-ux-diagram-plugins.md` (`SHOULD` line 91), `architecture-vibe-debrief.md` (`AD-12` lines 189–192).
- **What Did Not Land / Was Weakened:**
  - `initiative-vibe-debrief.md` (`R5`, `R8`) and `AGENTS.md` §5 define the `v0.2.0` complexity gate where `assessWorkflowComplexity` gates Rung 4 on `score >= 4`, and `R8` tests the complexity gate export.
  - `EXPERIENCE.md` and `AD-12` remove the user-facing lockout so `explainerScenes` are deterministically synthesized (`< 5ms`) on every non-minimal turn (`"focused"` and `"complex"`).
  - If `explainerScenes` is populated on `"focused"` turns (`score 1–3`), existing or `R8` complexity-gate assertions could conflict unless `AD-12` explicitly specifies that `complexity` retains `{ level: "minimal" | "focused" | "complex", score, shouldRenderExplainer: level === "complex" }` (where `shouldRenderExplainer` drives the `R8` complexity gate test and the `[Animate]` pulse badge, while `explainerScenes` is pre-populated whenever `level !== "minimal"`).
- **Remediation:** Explicitly note in `AD-12` that `complexity.shouldRenderExplainer` (`score >= 4` or `complexityOverride === "complex"`) is preserved for `R5`/`R8` backward compatibility while `explainerScenes` is populated for all non-minimal turns.

---

### Finding 5 — `[LOW]` Deterministic 4-to-5 Diagram Grammar Selection Rule & Optional `groups` Not Specified in `AD-14`
- **Sources:** `EXPERIENCE.md` (`svg-stage` line 71), `brainstorm-ui-ux-diagram-plugins.md` (§2.4 line 46, `SHOULD` line 90) vs. `architecture-vibe-debrief.md` (`AD-14` lines 211–215).
- **What Did Not Land / Was Weakened:**
  - `AD-14` states that the 4 legacy `diagramType` values (`"architecture"`, `"sequence"`, `"state-flow"`, `"cause-effect"`) map deterministically to the 5 vNext grammars (`"sequence"`, `"flow-diff"`, `"subway-map"`, `"before-after"`, `"decision-tree"`), without specifying the rule that selects the 5th grammar (e.g., how `"before-after"` vs. `"flow-diff"` vs. `"decision-tree"` is chosen when `diagramSpec.grammar` is not explicitly provided).
  - `brainstorm-ui-ux-diagram-plugins.md` §2.4 also lists `groups` in the declarative Diagram Spec (`nodes, edges, groups, proof/risk badges`) to support `Subway Layer Map` and `Before/After Split` swimlanes; `AD-14` includes optional `lane`/`branch` on `nodes` but omits top-level optional `groups` metadata (e.g., lane headers/labels).
- **Remediation:** Document the deterministic grammar selection rule in `AD-14` (e.g., `"sequence"` → `"sequence"`, `"architecture"` → `"subway-map"`, `"cause-effect"` → `"flow-diff"`, `"state-flow"` → `"before-after"`, plus `"decision-tree"` when `waitingOnYou.state === "choice"` or branching edges exist) and allow optional `groups` lane descriptors on `diagramSpec`.

---

## 3. Input Coverage Matrix

| Input Document & Section | Requirement / Concept | Architecture Spine Coverage | Status |
| --- | --- | --- | --- |
| `initiative-vibe-debrief.md` `R1`–`R7` | Shipped `v0.2.0` baseline (8 MCP tools, 4 hooks, STE-80, 6-node SVG, Canvas explainer, HTML export, `MEMORY.md` persistence) | `AD-1`–`AD-17`, Capability → Architecture Map (`FR-1`–`FR-28`) | Reconciled (note Finding 4 on `R5`) |
| `initiative-vibe-debrief.md` `R8`, `C5` | Zero-dependency `node:test` verification suite (`node --test tests/`) | `AD-1`, `AD-2`, `AD-4`, Structural Seed (`tests/*.test.mjs`), Consistency Conventions | Reconciled |
| `initiative-vibe-debrief.md` `R9`, `C6`, `C7` | Atomic state writes (`temp` + `renameSync`) within `<= 50ms` budget & bounded collections (`15`/`15`/`50`) | `AD-5`, `AD-11`, Consistency Conventions | Reconciled |
| `initiative-vibe-debrief.md` `R10` | Shared Dark HUD & Field Desk Light theme-token contract across `panel.html` and standalone HTML export | `AD-6`, Capability Map (`R10`) | Reconciled (note Finding 2 on local `themeOverride`) |
| `initiative-vibe-debrief.md` `R11` | Keyboard operability (`Tab`, `Enter`/`Space`, `ArrowLeft`/`ArrowRight`, `Escape`), ARIA landmarks/live regions, `prefers-reduced-motion` | `AD-10`, Capability Map (`R11`) | Reconciled |
| `initiative-vibe-debrief.md` `R12`, `C4` | 4-file version sync verified by `scripts/check-version-sync.mjs` | `AD-8`, Structural Seed, Capability Map (`R12`) | Reconciled |
| `initiative-vibe-debrief.md` `C1`–`C3` | Zero external deps, 4-layer separation & `stdout` isolation, CSP `unsafeEval: false` & `escapeHtml`/`\u003c` | `AD-1`–`AD-4`, `AD-6` | Reconciled |
| `DESIGN.md` Colors & Contrast | Dark HUD (`:root`), Field Desk Light (`body.theme-light`, `html[data-theme="light"]`), fixed media stages (`#070b12`, `#faf8f2`), runtime CSS variable resolution | `AD-6` | Reconciled |
| `DESIGN.md` Components (25 components) | `hud-header`, `xray-toggle`, `gear-popover`, `view-switcher`, `radar-card`, `waiting-badge`, `action-chip`, `inline-reply-box`, `minimal-strip`, `choice-grid`, `svg-stage`, `powerup-dock`, `proof-pill`, `audit-row`, `concept-pill`, `stage1-drawer`, `stage2-popout`, `missing-banner`, `unclear-box`, `explainer-stage`, `lesson-card`, `lesson-form`, `memory-code-box`, `history-item`, `hud-toast` | `AD-9`, `AD-10`, `AD-12`–`AD-17`, Capability Map | Partial gap on `stage2-popout` 3-col cards & `choice-grid` trade-off bars (Findings 1 & 3) |
| `EXPERIENCE.md` IA & 1-Strip Header | 1-strip `hud-header` + `gear-popover` + `view-switcher` (`HUD`, `Visual`, `Memory & History`) | `AD-10`, Container View | Partial gap on `gear-popover` persistence RPC (Finding 2) |
| `EXPERIENCE.md` 5-State `Waiting On You` | `choice`, `action`, `reply` (`inline-reply-box`), `blocked`, `none` + `ui/message` dispatch | `AD-9`, `AD-16`, `OQ-5` Schema Seed | Reconciled |
| `EXPERIENCE.md` `X-Ray` Dual-Coding | Instant `< 16ms` client-side `Plain` ↔ `Tech` toggle, language-agnostic STE-80 prose, verbatim `.sym` code identifiers | `AD-7`, `AD-10`, `AD-15`, `OQ-5` Schema Seed | Partial gap in `OQ-5` `xray.tech` example (Finding 3) |
| `EXPERIENCE.md` 5-Grammar SVG Stage | Declarative `diagramSpec` (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`), `<= 6` nodes, `460px` viewBox, `.dash-flow` | `AD-14`, `OQ-5` Schema Seed | Minor gap on 4-to-5 mapping rule (Finding 5) |
| `EXPERIENCE.md` Two-Stage Concept Deep Dive & Fallback | Stage 1 `< 100ms` inline drawer; Stage 2 `ui/message` pop-out + mandatory built-in HTML fallback + `missing-banner` install CTA | `AD-5`, `AD-9`, `AD-17`, `OQ-5` Schema Seed | Partial gap on Stage 2 card schema & `"designcraft"` (Finding 1) |
| `EXPERIENCE.md` Model-Agnostic `Clarify` | `unclear-box` when confidence is low + `discoverCheapestEnabledModels()` across enabled providers (no hardcoded Argon) | `AD-5`, `AD-11`, `AD-13`, `OQ-5` Schema Seed | Reconciled |
| `EXPERIENCE.md` Tiny-Turn Minimal Mode & Anytime Curator Tour | `minimal-strip` on trivial turns; deterministic `< 5ms` `explainerScenes` without `score >= 4` lockout | `AD-12` | Minor note on `R5`/`R8` `shouldRenderExplainer` flag (Finding 4) |
| `brainstorm-ui-ux-diagram-plugins.md` MoSCoW (`MUST`/`SHOULD`/`COULD`/`WON'T`) | All 6 `MUST` and 4 `SHOULD` items incorporated; 3 `COULD` items explicitly deferred; 2 `WON'T` items enforced as negative rules | `AD-9`–`AD-17`, `Deferred` table (line 534) | Reconciled |
