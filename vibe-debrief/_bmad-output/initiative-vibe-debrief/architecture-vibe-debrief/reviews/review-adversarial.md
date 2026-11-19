---
name: 'review-adversarial'
target: '../architecture-vibe-debrief.md'
reviewer: 'Adversarial Divergence Reviewer'
gate: 'BMad Architecture Reviewer Gate'
cross_checked:
  - '../../ux-vibe-debrief/DESIGN.md'
  - '../../ux-vibe-debrief/EXPERIENCE.md'
  - '../../ux-vibe-debrief/mockups/cockpit-hud.html'
  - '../../../../scripts/mcp-server.mjs'
  - '../../../../scripts/debrief-engine.mjs'
  - '../../../../scripts/hook-runner.mjs'
date: '2026-11-19'
verdict: 'CHANGES_REQUIRED'
findings_count:
  critical: 2
  high: 2
  medium: 1
  low: 0
---

# Adversarial Divergence Review — `architecture-vibe-debrief.md` (Cockpit HUD vNext)

**Target Spine:** `architecture-vibe-debrief.md` (`v0.2.0` baseline, `v0.3.0` hardening, `v0.4.0` Cockpit HUD vNext; `AD-1`–`AD-17` + `OQ-5` Schema Seed)
**Verdict:** **CHANGES_REQUIRED (2 Critical, 2 High, 1 Medium)**

Attacking the updated spine at the unit boundaries between **Core Engine (`scripts/debrief-engine.mjs`)**, **MCP Transport (`scripts/mcp-server.mjs`)**, **Hook Runner (`scripts/hook-runner.mjs`)**, and **Panel UI (`assets/panel.html`)** reveals **5 concrete divergence pairs** where two developer stories obey every `AD-1`–`AD-17` rule to the letter yet build incompatibly due to clashing shared-data shapes, dual entity ownership, or rejected MCP tool schemas.

---

## Findings Summary

| ID | Severity | Boundary | Failure Mode | Target ADs to Tighten |
| --- | --- | --- | --- | --- |
| **F-1** | **CRITICAL** | Panel `gear-popover` ↔ MCP `vibe_debrief_set_persona` ↔ Hook `state` | `language` & `preferredModel` rejected by `additionalProperties: false` or clobbered on next `renderPanelState`; `theme` race with `host-context-changed` | `AD-5`, `AD-9`, `AD-10`, `AD-13` |
| **F-2** | **CRITICAL** | Agent / Clarify `vibe_debrief_publish` ↔ MCP `inputSchema` & `handleToolCall` | `v0.4.0` fields (`verdict`, `xray`, `waitingOnYou`, `diagramSpec`, `concepts`, `choices`, 5 grammars) rejected by schema or stripped before `ensureDebriefEnriched` | `AD-5`, `AD-14`, `AD-15`, `AD-16`, `AD-17` |
| **F-3** | **HIGH** | Engine `ensureDebriefEnriched` ↔ Panel `renderMicroBlocks` & `choice-grid` | `microBlocks` `string[]` vs. `MicroBlock[]` object clash; `choice-grid` missing top-level `choices: ChoiceItem[]` & `tradeOffs: [{ label, pct }]` schema distinct from `waitingOnYou.chips` | `AD-15`, `AD-16`, `OQ-5` |
| **F-4** | **HIGH** | Panel Stage 2 Fallback ↔ MCP `vibe_debrief_export_html` ↔ `AD-10` Render | `vibe_debrief_export_html` schema rejects `{ conceptSlug, targetPlugin }`; `renderPanelState` wipes `missing-banner`; `ConceptItem` missing `stage2` 3-card deep explanation & `microVisualSpec.type` enum | `AD-10`, `AD-17`, `OQ-5` |
| **F-5** | **MEDIUM** | Engine Builders ↔ Panel / HTML Renderers (`diagramSpec`, `xray`, `minimalMode`) | `lane`/`branch` mismatch & cross-lane auto-edges in `"before-after"`; `.sym` HTML vs. `escapeHtml()` clash; `minimalMode` hiding `unclear-box` on short vague replies | `AD-6`, `AD-12`, `AD-13`, `AD-14`, `AD-15` |

---

## Detailed Adversarial Pair Constructions

### F-1: `[CRITICAL]` Panel Settings Mutation & Ownership Split (`gear-popover` `language`, `preferredModel`, `theme` vs. `vibe_debrief_set_persona` & `AD-9` / `AD-10` / `AD-13`)

**The Spine Claim:**
- `OQ-5` Schema Seed places `"language": "en"` and `"preferredModel": "auto-cheapest"` inside server-owned `panelState`.
- `AD-7` requires `STE-80` prose in the active language (`language` tag in `panelState`), and `AD-13` requires `UserPromptSubmit` in `hook-runner.mjs` to delegate `[Vibe Debrief — Clarify]` to `state.preferredModel || recommendedModel`.
- `EXPERIENCE.md` (`gear-popover`, lines 38, 65) requires `gear-popover` to toggle Surface Theme, Project/Conversation Language, Persona lens, `STE-80` status, and Model selection.
- `AD-1` and `AD-9` restrict the MCP surface to 8 tools (6 callable from `panel.html`), where `vibe_debrief_set_persona` is the sole settings mutation tool.

**The Adversarial Pair:**
- **Unit A (Panel UI Builder — `assets/panel.html`):** Obeys `AD-9` and `EXPERIENCE.md`. When the user changes Language, Model, or Theme in `gear-popover`, Unit A either:
  1. Dispatches `tools/call` `vibe_debrief_set_persona` with `{ persona, ste100Enabled, language: "fr", preferredModel: "new-provider/gemini-3.8-flash", theme: "light" }`, **or**
  2. Stores `language`, `preferredModel`, and `theme` in local panel variables.
- **Unit B (MCP Server & Hook Runner Builder — `scripts/mcp-server.mjs` + `scripts/hook-runner.mjs`):** Obeys `AD-1`, `AD-5`, `AD-7`, and `AD-13`. Unit B keeps `vibe_debrief_set_persona`'s `inputSchema` at `properties: { persona, responseType, ste100Enabled }, additionalProperties: false` (`scripts/mcp-server.mjs:391–405`), persists only `activePersona` and `ste100Enabled` via `savePersistedState`, and reads `state.preferredModel` and `state.language` from `vibe-debrief-state.json` inside `hook-runner.mjs`.

**Why They Fail Together:**
1. **Schema Rejection / Silent Drop:** If Unit A passes `language` or `preferredModel` to `vibe_debrief_set_persona`, MCP rejects the call (`additionalProperties: false`) or `handleToolCall` ignores both keys.
2. **Dual Ownership & Immediate Reset:** If Unit A mutates `language` and `preferredModel` locally in `panel.html`, `vibe-debrief-state.json` on disk is never updated. On the very next `renderPanelState(state)` call (`AD-10`), `panelState.language` (`"en"`) and `panelState.preferredModel` (`"auto-cheapest"`) overwrite the user's `gear-popover` selection, and `hook-runner.mjs` (`AD-13`) never sees `state.preferredModel` or `state.language`.
3. **Theme Override Clobbering:** `AD-10` enumerates panel-owned transient UI state (`activeView`, `xrayMode`, `selectedNodeId`, `activeConceptSlug`, `gearPopoverOpen`, `minimalModeExpanded`, `selectedWaitingChipId`, `playerState`) but omits manual theme selection (`themeMode`: `"auto" | "dark" | "light"`), so `ui/notifications/host-context-changed` (`AD-9`) and `gear-popover` Surface Theme clicks overwrite each other unpredictably.

**Required Spine Fix (Tighten `AD-5`, `AD-9`, `AD-10`):**
- Specify in `AD-5` and `AD-9` that `vibe_debrief_set_persona` (retaining its tool name to preserve the 8-tool MCP contract) expands its `inputSchema` and handler to accept `{ persona?, responseType?, ste100Enabled?, language?, preferredModel? }`, persists them to `vibe-debrief-state.json` via `savePersistedState`, and re-enriches `currentDebrief`.
- Add `themeMode` (`"host-auto" | "dark" | "light"`) to `AD-10` transient UI state (or persisted `panelState`), specifying that `host-context-changed` updates theme when `themeMode === "host-auto"` while manual `gear-popover` clicks pin `"dark"` or `"light"`.

---

### F-2: `[CRITICAL]` `vibe_debrief_publish` Input Schema Lockout & Field-Stripping vs. `ensureDebriefEnriched` (`AD-13`–`AD-17`)

**The Spine Claim:**
- `AD-13`–`AD-17` and the Capability Map (`R1 / FR-3 vibe_debrief_publish`) route published debriefs through `MCP (handleToolCall) -> Engine (ensureDebriefEnriched: diagramSpec, xray, waitingOnYou, concepts, microBlocks, STE-80)`.
- `AD-14` states `diagramSpec` is *"kept sync-aliased with `debrief.diagram` so `v0.2.0`/`v0.3.0` callers and tests reading `debrief.diagram.nodes`/`edges` continue to work unchanged"*.

**The Adversarial Pair:**
- **Unit A (Engine Enricher & Clarify Prompt Builder — `scripts/debrief-engine.mjs` + `scripts/hook-runner.mjs` + `skills/*/SKILL.md`):** Obeys `AD-13`–`AD-17` by instructing agents and `[Vibe Debrief — Clarify]` / `[Vibe Debrief — Deep Refresh]` sub-sessions to pass `verdict`, `xray`, `waitingOnYou`, `choices`, `diagramSpec` (or `diagram` with `grammar`: `"sequence" | "flow-diff" | "subway-map" | "before-after" | "decision-tree"`), `concepts`, and `microBlocks` to `vibe_debrief_publish`, and implements `ensureDebriefEnriched(debrief, state)` to preserve any caller-supplied `v0.4.0` fields before synthesizing missing ones.
- **Unit B (MCP Server Builder — `scripts/mcp-server.mjs`):** Obeys `AD-1` and `AD-14` by keeping `vibe_debrief_publish` `inputSchema` with `additionalProperties: false` and `diagram.diagramType: { enum: ["architecture", "sequence", "state-flow", "cause-effect"] }` (`scripts/mcp-server.mjs:222, 374`), and constructs `draftDebrief` in `handleToolCall("vibe_debrief_publish")` (`scripts/mcp-server.mjs:578–640`) by copying only legacy `v0.2.0` keys before invoking `ensureDebriefEnriched`.

**Why They Fail Together:**
- Any agent or Clarify sub-session that passes `verdict`, `xray`, `waitingOnYou`, `diagramSpec`, `concepts`, `choices`, or a 5-grammar value (`"flow-diff"`, `"subway-map"`, `"before-after"`, `"decision-tree"`) to `vibe_debrief_publish` either fails MCP input schema validation (`additionalProperties: false` / `diagramType` enum) or has every `v0.4.0` field silently stripped when `handleToolCall` builds `draftDebrief`—degrading every agent-published turn to fallback heuristics.

**Required Spine Fix (Tighten `AD-5`, `AD-14`, `AD-15`):**
- Explicitly require `vibe_debrief_publish` in `scripts/mcp-server.mjs` to accept optional `v0.4.0` fields (`verdict`, `xray`, `waitingOnYou`, `choices`, `diagramSpec`, `concepts`, `microBlocks`, `heuristicConfidence`, `minimalMode`) in `inputSchema`, expand `diagram.diagramType` / `diagram.grammar` to accept all 5 grammars alongside the 4 legacy types, and delegate full `Debrief` construction (`publishDebrief(workspaceRoot, args)`) to `debrief-engine.mjs` so no fields are dropped at the MCP transport boundary.

---

### F-3: `[HIGH]` `microBlocks` Type Clash (`string[]` vs. `MicroBlock[]`), Orphaned `"choices"` (`choice-grid`) Data Source, and `waitingOnYou.chips` Dual-Ownership (`AD-15`, `AD-16`, `OQ-5`)

**The Spine Claim:**
- `AD-15` states: *"`ensureDebriefEnriched` produces an ordered `microBlocks: MicroBlock[]` list matching the turn's actual intents: Allowed block types: `"choices"` (`choice-grid`), `"diagram"` (`svg-stage` + `powerup-dock`), `"proof-audit"`, `"concepts"`, `"lessons"`, and `"unclear"`."*
- `OQ-5` Schema Seed (line 325) shows: `"microBlocks": ["diagram", "proof-audit", "concepts", "lessons"]` (a `string[]`), and omits any top-level `choices` key on `currentDebrief`.
- `AD-16` defines `waitingOnYou.chips` as `array of { id, key, label, techLabel, messagePrompt, primary, tradeOffs } (max 4 chips)`.

**The Adversarial Pair:**
- **Unit A (Engine Builder — `scripts/debrief-engine.mjs`):**
  1. Follows the `OQ-5` JSON Seed and emits `microBlocks` as a `string[]` of block IDs (`["choices", "diagram", "proof-audit"]`).
  2. Follows `AD-16` by encoding options inside `currentDebrief.waitingOnYou.chips` (`{ id, key, label, techLabel, messagePrompt, primary, tradeOffs }`) without emitting a top-level `currentDebrief.choices` array.
- **Unit B (Panel UI Builder — `assets/panel.html`):**
  1. Follows `AD-15` prose (`microBlocks: MicroBlock[]`) and expects objects `{ type: "choices", items: [...] }`.
  2. Follows `DESIGN.md` (`{components.action-chip}` vs. `{components.choice-grid}`), `EXPERIENCE.md` (lines 68, 70), and `cockpit-hud.html` (lines 1793–1815, 2228–2263): renders `waitingOnYou.chips` as compact 1-line `action-chip` pills inside `radar-card`, and renders the `"choices"` Micro-Block (`choice-grid`) from `currentDebrief.choices` expecting `{ key, title, plainSummary, techSummary, tradeOffs: [{ label, pct }], messagePrompt }`.

**Why They Fail Together:**
1. **Array Element Clash:** `renderMicroBlocks` fails immediately if Unit A emits string literals (`"diagram"`) while Unit B reads `block.type`.
2. **Missing `choice-grid` Schema & Semantic Collision with `waitingOnYou.chips`:**
   - In `"action"`, `"reply"`, or `"blocked"` states, `waitingOnYou.chips` holds quick-action pills (`Run webhook retry test`, `Show diff`) that are not architectural options for `choice-grid`.
   - When `choice-grid` renders (`DESIGN.md` line 503, `cockpit-hud.html:2236–2260`), each card requires a `20×20px` key (`A`/`B`/`1`/`2`), a bold `title`, a separate dual-coded `plain` vs. `tech` subtext description, and `34×4px` percentage meter bars (`tradeOffs: Array<{ label: string, pct: number }>` where `pct` is `0..100`). `AD-16`'s `waitingOnYou.chips` only defines `label`, `techLabel`, and an untyped `tradeOffs` field—leaving `title` vs. subtext and the `tradeOffs` object shape undefined.

**Required Spine Fix (Tighten `AD-15`, `AD-16`, and `OQ-5` Schema Seed):**
- Define `microBlocks` in `AD-15` as an ordered array of block-type string literals: `Array<"choices" | "diagram" | "proof-audit" | "concepts" | "lessons" | "unclear">`.
- Add top-level `choices: ChoiceItem[]` to `Debrief` in `AD-15` and `OQ-5`:
  `{ id: string, key: string, title: string, plainSummary: string, techSummary: string, messagePrompt: string, primary?: boolean, tradeOffs: Array<{ label: string, pct: number }> }[]`.
- Clarify in `AD-16` that `waitingOnYou.chips` are compact `radar-card` action triggers (`{ id, key, label, techLabel, messagePrompt, primary }`), and when `waitingOnYou.state === "choice"`, clicking either a `waitingOnYou` chip or its matching `choice-grid` card selects the same `key`/`id` and dispatches `messagePrompt` via `ui/message`.

---

### F-4: `[HIGH]` Stage 2 Missing-Plugin Fallback Contract Gap (`vibe_debrief_export_html` Args, Missing `stage2` Deep-Dive Fields on `ConceptItem`, and `AD-10` Render Clobbering)

**The Spine Claim:**
- `AD-17` Step 3 states: *"If missing / unavailable (Mandatory Fallback): `panel.html` immediately invokes `vibe_debrief_export_html` (`tools/call` with `{ conceptSlug, targetPlugin }`) to generate and open the Built-in Standalone HTML Explainer at zero LLM cost, and renders `missing-banner` naming `targetPlugin` with a 1-click `Install <targetPlugin>` CTA."*
- `EXPERIENCE.md` (lines 39, 72) allows triggering Stage 2 pop-out from **either** `Deep Dive & Pop Out ↗` in `stage1-drawer` (concept-scoped) **or** external plugin buttons in `powerup-dock` beneath `svg-stage` (diagram-scoped, where no concept drawer is open).
- `DESIGN.md` (line 508) specifies that `stage2-popout` / HTML fallback renders *"3-column deep explanation cards (`How It Works`, `Key Trade-off`, `In Your Codebase`). Missing plugins render an amber `missing-banner` + `Install <plugin>` CTA above the built-in HTML fallback."*

**The Adversarial Pair:**
- **Unit A (Engine & MCP Server Builder — `scripts/debrief-engine.mjs` + `scripts/mcp-server.mjs`):**
  1. Keeps `vibe_debrief_export_html` `inputSchema` at `properties: {}, additionalProperties: false` (`scripts/mcp-server.mjs:446–450`), or requires `{ conceptSlug: string, targetPlugin: string }`.
  2. Emits `ConceptItem` with only the fields shown in `AD-17` / `OQ-5` (`{ slug, label, techSymbol, targetPlugin: "excalidraw" | "visualize" | "vectorcraft", stage1: { definition, analogy, microVisualSpec: { type: "loop-3node", nodes } }, stage2Prompt }`).
  3. Returns `structuredContent: { ...panelState, exportedArtifact: { filePath, fileName, bytes } }`.
- **Unit B (Panel UI Builder — `assets/panel.html`):**
  1. Calls `vibe_debrief_export_html` with `{ conceptSlug: "idempotent-retry", targetPlugin: "vectorcraft" }` from `stage1-drawer`, `{ conceptSlug: null, targetPlugin: "excalidraw" }` from `powerup-dock`, and `{}` from `gear-popover`.
  2. Obeys `AD-10` (*"All tool results and `tool-result` notifications converge through `renderPanelState`"*) by passing `result.structuredContent` to `renderPanelState(state)`.
  3. Expects `ConceptItem` to contain the 3 Stage 2 deep-explanation fields (`How It Works`, `Key Trade-off`, `In Your Codebase` from `DESIGN.md:508` / `cockpit-hud.html:1536–1549`) and switches Stage 1 `<canvas>` rendering on `microVisualSpec.type` (`"stream" | "lock" | "dedupe" | "race"` from `cockpit-hud.html` vs. `"loop-3node"` in `OQ-5`).

**Why They Fail Together:**
1. **`vibe_debrief_export_html` Schema Rejection:** `additionalProperties: false` with empty `properties: {}` rejects `{ conceptSlug, targetPlugin }`; conversely, making `conceptSlug` required breaks `powerup-dock` diagram pop-outs (`conceptSlug: null`) and `gear-popover` manual exports (`{}`).
2. **`AD-10` Immediately Erases `missing-banner`:** Because `panel.html` runs inside a sandboxed MCP App iframe (`AD-9`), it cannot directly open a local OS `file:///...` path in an external browser window. When `vibe_debrief_export_html` returns `structuredContent` and `AD-10` invokes `renderPanelState(result.structuredContent)`, `AD-10`'s transient state list has no `missingPluginFallback` (`{ targetPlugin, conceptSlug, exportedArtifact }`) property—so `renderPanelState` overwrites the HUD DOM and destroys `missing-banner`!
3. **Missing `ConceptItem.stage2` Cards & Enum Drift:** Neither `AD-17` nor `OQ-5` includes `stage2: { howItWorks, tradeOff, inYourCodebase }` on `ConceptItem`, leaving `generateStandaloneHtmlArtifact` and `stage2-popout` with no data for the 3 deep-explanation cards required by `DESIGN.md:508`. Furthermore, `AD-5` and `AD-9` include `"designcraft"` in `installedVisualPlugins`, whereas `AD-17` omits `"designcraft"` from `targetPlugin`, and `stage1.microVisualSpec.type` is unenumerated.

**Required Spine Fix (Tighten `AD-10`, `AD-17`, and `OQ-5` Schema Seed):**
- In `AD-17`: Define `vibe_debrief_export_html` `inputSchema` with optional `{ conceptSlug?: string | null, targetPlugin?: "excalidraw" | "visualize" | "vectorcraft" | "designcraft" | null, reason?: "manual" | "missing-plugin-fallback" }`. Pass these options to `saveStandaloneHtmlArtifact(workspaceRoot, panelState, options)` so the exported `.html` embeds the `missing-banner` and Stage 2 deep-dive cards, and return `exportedArtifact: { filePath, fileName, bytes, conceptSlug, targetPlugin, reason }`.
- In `AD-17` & `OQ-5`: Extend `ConceptItem` with:
  - `targetPlugin: "excalidraw" | "visualize" | "vectorcraft" | "designcraft"`
  - `stage1.microVisualSpec: { type: "loop-3node" | "stream" | "lock" | "dedupe" | "race", nodes: string[] }`
  - `stage2: { howItWorks: string, tradeOff: string, inYourCodebase: string }`
- In `AD-10`: Add `missingPluginFallback` (`{ targetPlugin, conceptSlug, exportedArtifact } | null`, reset when `currentDebrief.id` changes or user dismisses) to panel transient UI state so `renderPanelState` renders and preserves `missing-banner` + fallback artifact controls across re-renders.

---

### F-5: `[MEDIUM]` `diagramSpec` 5-Grammar Spatial Discrimination, `xray` HTML-Escaping Clash, and `minimalMode` vs. `unclear-box` Precedence (`AD-6`, `AD-12`, `AD-13`, `AD-14`, `AD-15`)

**The Spine Claim:**
- `AD-14` specifies `nodes` have *"optional `lane` / `branch` for `subway-map`, `before-after`, and `decision-tree`"*, and `AGENTS.md` / `AD-14` state *"edges are auto-synthesized sequentially if omitted"*.
- `AD-6` requires all dynamic strings interpolated into HTML/SVG to use `escapeHtml()`. `AD-7` and `AD-15` state code identifiers are preserved inside `.sym` code badges in `xray.tech`.
- `AD-12` states: *"When `minimalMode: true` (`level === "minimal"` and `waitingOnYou.state === "none"`), `HUD` auto-collapses into `minimal-strip` (`Minimal Mode · Verified`)."* `AD-13` states: *"When `heuristicConfidence < 0.55` on a heuristic `Stop` debrief, `microBlocks` includes `"unclear"` so `HUD` renders `unclear-box`."*

**The Adversarial Pair & Clashes:**
1. **`diagramSpec` `lane` / `branch` Mismatch & Cross-Lane Auto-Edges (`AD-14`):**
   - **Unit A (Engine)** assigns `node.lane = "before" | "after"` for `"before-after"` diagrams and auto-synthesizes sequential edges `n1 -> n2 -> n3 -> n4` when `edges` is omitted.
   - **Unit B (Panel / Standalone HTML Renderer)** partitions `"before-after"` containers by checking `node.branch === "before" | "after"` (or `node.lane === 0 | 1`). Result: all nodes collapse into one side of the split view, and the auto-synthesized edge draws an illegal arrow from the `"before"` box into the `"after"` box.
2. **`xray.tech.headline` Raw `<span class="sym">` vs. `escapeHtml()` (`AD-6` vs. `AD-15`):**
   - **Unit A (Engine)** formats `xray.tech.headline` with inline `<span class="sym">retryWebhook()</span>` tags (matching `cockpit-hud.html:1789`).
   - **Unit B (Panel)** obeys `AD-6` and wraps `debrief.xray.tech.headline` in `escapeHtml()`, rendering literal `&lt;span class="sym"&gt;` markup in `radar-card` (or skips `escapeHtml()` and introduces an XSS vector).
3. **`minimalMode` Hiding `unclear-box` on Short Vague Replies (`AD-12` vs. `AD-13`):**
   - On a short, vague 1-line assistant reply with 0 touched files and no explicit question mark (e.g., *"Updated the config hook maybe check the env var before restarting"*, Scenario 4 in `cockpit-hud.html`), **Unit A (Engine)** computes `complexity.level === "minimal"`, `waitingOnYou.state === "none"`, and `heuristicConfidence: 0.31` (`< 0.55`), setting `minimalMode: true`.
   - **Unit B (Panel `renderRadarOrMinimal`)** checks `if (debrief.minimalMode && !minimalModeExpanded)` before rendering `microBlocks`, collapsing the turn into `Minimal Mode · Verified` (`minimal-strip`)—hiding `unclear-box` and falsely labeling an uncertain turn as `Verified`.

**Required Spine Fix (Tighten `AD-6`, `AD-12`, `AD-13`, `AD-14`, `AD-15`):**
- **In `AD-14`:** Standardize per-grammar node partitioning keys:
  - `"before-after"`: `lane: "before" | "after"` (and auto-edge synthesis must partition by `lane` rather than connecting `"before"` to `"after"`).
  - `"subway-map"`: `lane: string` (layer label from `classifyFileRole`).
  - `"decision-tree"`: `branch: "root" | string` (choice key `"A"`, `"B"`, etc.).
- **In `AD-6` & `AD-15`:** Mandate that all `xray.plain.*` and `xray.tech.*` strings in JSON state are **raw plain text** (never pre-wrapped in HTML `<span class="sym">`). `panel.html` and `generateStandaloneHtmlArtifact` escape text via `escapeHtml()` first and render `.sym` badges from `xray.tech.symbols` / `paths` / `commands` (or backtick-delimited `` `token` `` markers after escaping).
- **In `AD-12` & `AD-13`:** Gate `minimalMode` on `heuristicConfidence >= 0.55` (`minimalMode = (complexity.level === "minimal" && waitingOnYou.state === "none" && heuristicConfidence >= 0.55)`), guaranteeing low-confidence turns always surface `unclear-box`.
