---
name: Vibe Debrief
status: final
sources:
  - ../../../planning-artifacts/prd-vibe-debrief.md
  - ../../../planning-artifacts/product-brief-vibe-debrief.md
  - ../../../../assets/panel.html
updated: 2026-11-17
---

# Vibe Debrief — Experience Spine

> Information architecture, interaction, state, accessibility, and user journey contract for Vibe Debrief (`assets/panel.html` + `generateStandaloneHtmlArtifact`). Visual tokens, typography, and component appearance live in [DESIGN.md](./DESIGN.md).

## Foundation

Dual-surface developer comprehension tool embedded in ZCode:
1. **Primary surface:** ZCode right-side MCP App panel iframe (`ui://vibe-debrief/panel.html`, MIME `text/html;profile=mcp-app`, `_meta["zcode/csp"].unsafeEval: false`), communicating exclusively via `window.parent.postMessage` JSON-RPC 2.0 (`PROTOCOL_VERSION = "2026-01-26"`).
2. **Secondary surface:** On-demand standalone offline HTML export (`vibe-debrief-<timestamp>.html`) opened in any desktop browser with zero external assets.

No third-party UI framework (shadcn/MUI/Tailwind) is used; all layout, SVG diagrams, and `<canvas>` animations are bespoke vanilla HTML/CSS/JS. [DESIGN.md](./DESIGN.md) owns all visual tokens (`{colors.*}`, `{typography.*}`, `{rounded.*}`, `{spacing.*}`, `{components.*}`). Dark mode (`:root`) is the default; light mode (`body.theme-light`) syncs dynamically with the ZCode host via `ui/initialize` and `ui/notifications/host-context-changed`.

Core governing invariant — **Reading-Boundary Principle (`RULE-1`):** The coding agent reasons and edits freely mid-task; comprehension formatting (`STE-80`, diagram synthesis, verification defaults) applies strictly at publish/debrief time (`vibe_debrief_publish`, `Stop` hook, or `MEMORY.md` write).

## Information Architecture

| Surface | Reached From | Purpose |
| --- | --- | --- |
| `📊 Debrief` (`#tab-storyboard`) | Panel default open / Tab 1 | Hero TL;DR + Analogy, always-on interactive SVG diagram (`1–6` nodes) + Node Inspector, dual 4-card narrative (`Bug` vs `Implementation`), inline `Proof & Claims`, Card 4 `Uncertainty Audit` + `Quick Verify Checklist`, and Section 5 `Lessons Learned` (`➕ Add Lesson`). |
| `🎬 Explainer` (`#tab-explainer`) | Tab 2 (visible only when `complexity.level === "complex"` and `explainerScenes.length > 0`) or clicking `#complexityPill` (`🧩 Complex · ▶ Explainer`) | Complexity-gated (`score >= 4`) 3b1b-inspired `<canvas>` walkthrough (`4–6` scenes), playback transport, Web Speech voiceover toggle, and copyable plain-text verification script (`buildPlainTextScript`). |
| `🧠 Memory` (`#tab-memory`) | Tab 3 (`🧠 Memory (<count>)`) | Confirmed Lesson Bank (`confirmedLessons`, capped at 50), workspace memory directory path, and live read-only preview of ZCode's `MEMORY.md` index. |
| `🕒 History` (`#tab-history`) | Tab 4 (`🕒 History`) | Bounded list of up to 15 recent turn debriefs (`history`); clicking any entry loads that snapshot into `#tab-storyboard`. |
| Standalone HTML Export | Header `🌐 HTML` button (`vibe_debrief_export_html`) | Self-contained offline `.html` snapshot containing TL;DR, analogy, interactive SVG diagram + Node Inspector, 4 cards, oversight checkboxes, and (if complex) Canvas player + plain-text script. |

**Navigation & Visibility Rules:**
- Top bar (`{components.top-bar}`) and tab bar (`{components.tabs-nav}`) remain pinned while `<main class="content-area">` scrolls vertically.
- Switching away from `🎬 Explainer` immediately stops Canvas playback (`stopExplainerPlayback`) and cancels active `window.speechSynthesis`.
- No modal dialogs or nested drawers exist; Lesson creation (`#customLessonForm`) expands inline inside Section 5.
- **Surface Closure:** Every PRD journey (`UJ-1`..`UJ-4`) lands cleanly across these 5 surfaces; multi-turn chat (`✨ AI Explain`) delegates back to the ZCode host chat via `ui/message` rather than adding an in-panel chat surface.

## Voice and Tone

All published debrief copy follows **80% ASD-STE100 (`STE-80`)** rules when `{components.ste-toggle-chip}` is ON (`applySte100Polish`): short active sentences (`<= 22` words target, flagging `> 25` words), plain verbs (`utilize` → `use`, `in order to` → `to`, `subsequently` → `then`), and zero filler. Selectable personas (`Vibe Mentor`, `Visual Mapper`, `Indie Founder`, `Pure ELI5`) shift panel subtitle and analogy flavor without altering facts, proof claims, or diagram topology.

| Do (Panel Microcopy) | Don't |
| --- | --- |
| `Loading visual debrief…` | `Please wait while our AI synthesizes your code comprehension artifacts!` |
| `YES — Fix Succeeded & Verified` | `Awesome! Everything passed without any issues! 🎉` |
| `PARTIAL — Applied, Needs Verification` | `Fix applied.` (hiding unverified status) |
| `NOT YET — Needs Additional Fix` | `Error occurred.` |
| `Confirmed rules save directly to ZCode's persistent MEMORY.md for future sessions.` | `Click here to persist long-term episodic agentic vector memory.` |
| `Polished visuals can feel convincing even when wrong — scan the plain-text script below to verify facts quickly.` | `Watch the animation to understand everything!` |
| `⚠️ Please enter a title and summary for the lesson.` | `Validation Error: Required fields missing.` |

## Component Patterns

Behavioral rules for every component defined in [DESIGN.md](./DESIGN.md#components):

| Component | Surface | Behavioral Rules |
| --- | --- | --- |
| `top-bar` & `brand-badge` | Global | Displays `"Vibe Debrief · " + (projectName \|\| "Workspace")` and persona subtitle; truncates cleanly with ellipsis on narrow panels without wrapping action buttons off-screen. |
| `model-select` | Global header | Populated dynamically from `lightweightGeminiModels` (default `⚡ gemini-4-argon`, fallback `new-provider/gemini-3.8-flash`); selection controls which model `[Vibe Debrief — Deep Refresh]` requests on `✨ AI Explain`. |
| `button-primary` (`✨ AI Explain`) | Global header | Sends a Reading-Boundary delegation prompt containing `lastUserPrompt` (`0..600` chars) and `lastAssistantMessage` (`0..2200` chars) to ZCode chat via `ui/message`; shows toast feedback on send or failure. |
| `button-secondary` & `button-success` (`🌐 HTML`, `🔄`, `Confirm & Save`) | Global header / Section 5 | `🌐 HTML` calls `vibe_debrief_export_html({})` and toasts the saved filename under `.zcode/vibe-debrief-artifacts/` (or `ZCODE_VISUALIZATION_DIR`); `🔄` calls `vibe_debrief_get_state({ refresh: true })`; `button-success` triggers `vibe_debrief_confirm_lesson` in Section 5 and `#customLessonForm`. |
| `mode-switcher` | Global header | Mutually exclusive toggle between `🐛 Bug / Error Fix` (`responseType: "bug"`) and `🚀 Implementation` (`responseType: "implementation"`); calls `vibe_debrief_set_persona` and swaps Card 1–3 layouts immediately. |
| `persona-chip` | Global header | Four chips (`vibe-mentor`, `visual-mapper`, `indie-founder`, `eli5-storyteller`); single-select calls `vibe_debrief_set_persona({ persona })` and shows switch toast. |
| `ste-toggle-chip` | Global header | Toggles `ste100Enabled` (`✂️ STE-80: ON` / `OFF`) via `vibe_debrief_set_persona({ ste100Enabled })`; updates header pill and active prose filter. |
| `tabs-nav` | Global header | Switches `#tab-*` visibility; hides `#tabBtnExplainer` (`display: none`) unless `isComplex && explainerScenes.length > 0`. |
| `toast-banner` | Global | Reveals transient feedback for `4500ms` (auto-hides via timer), replacing previous toast text on rapid actions. |
| `hero-card` & `pill-badge` | Debrief | Displays mode pill, conditional `#complexityPill` (`🧩 Complex · ▶ Explainer` — clicking switches directly to `🎬 Explainer`), `STE-80` score pill (`STE-80 >= 80`, `Clear 65–79`, `Dense < 65`), persona pill, timestamp, TL;DR headline, and optional `analogy-box`. |
| `diagram-card`, `diagram-node`, `diagram-edge` | Debrief | Always renders `1–6` nodes in an adaptive `1/2/3`-column serpentine grid (`460px` viewBox) with numbered edges (`1..N`). Clicking a node sets `selectedNodeId`, re-renders highlight stroke (`2.4px`), highlights matching `file-badge`, and updates `node-inspector`. Pan/zoom is intentionally absent. |
| `file-badge` & `node-inspector` | Debrief | Clicking a `file-badge` selects its linked SVG node (or shows file role/risk directly in `node-inspector` when unlinked); clicking `#nodeInspectorBar` shows role, risk level, and workspace path. |
| `story-card` & `status-banner` | Debrief | Renders 4 mode-specific cards (`Bug`: Cause, Fix Plan, Did It Succeed? + `status-banner`, Consequences; `Implementation`: Objective & Why, Plan & Why This Way, Result & Evidence, Consequences) + shared Section 5 Lessons. |
| `proof-item` | Debrief (Card 3) | Renders `1–3` claims with status icon (`✅` `verified`, `❌` `unverified`, `ℹ️` `inferred`) and monospace tool/file evidence; unrun tests are banned from `verified` claims. |
| `audit-row` & `promote-button` | Debrief (Card 4) | Lists `1–3` uncertainty/risk areas (`low`, `medium`, `high`). Clicking `💡→Rule` (`promote-button`) opens `#customLessonForm`, pre-fills title (`Double-check <area>`) and summary (`reason`), and scrolls smoothly to the form. |
| `check-row` | Debrief (Card 4) | Interactive checkbox (`1–4` items) calling `vibe_debrief_toggle_check({ checkId, checked })`; checked labels apply `.check-done` strikethrough and persist across turns. |
| `lesson-card` & `lesson-form` | Debrief (Section 5) | Each flagged lesson shows title, summary, `Why` / `Apply` meta, status pill (`⏳ Unconfirmed` / `✅ Saved in MEMORY.md`), and `Confirm & Save` / `Re-Sync` button (`vibe_debrief_confirm_lesson`). `➕ Add Lesson` toggles inline `lesson-form`, validating non-empty title + summary before saving. |
| `explainer-stage` & `explainer-controls` | Explainer | `600×250` `<canvas>` animating active `highlightNodeIds` and pulse dots along connecting edges across `4–6` scenes. Controls: `▶ Play`/`⏸ Pause` (auto-advances per `Math.max(2500, durationSec * 1000 / speed)`), `⏮` Prev / `⏭` Next (wrap modulo, stop playback), speed (`0.85x`, `1x`, `1.25x`, `1.5x`), and `🔇 Voice Off`/`🔊 Voice On` (`window.speechSynthesis`). |
| `scene-pill` & `explainer-caption` | Explainer | Horizontal pill selector jumping directly to any scene index and updating title + caption box + `<canvas>` frame. |
| `script-box` | Explainer | Renders `buildPlainTextScript(scenes)` with `📋 Copy Script` button (`navigator.clipboard.writeText`) so users verify visual claims in plain text. |
| `memory-code-box` | Memory | Displays `confirmedLessons` bank (each with `<slug>.md` pill) above a live scrollable `<pre>` of `MEMORY.md`. |
| `history-item` | History | Lists up to 15 past turns (mode pill, optional `🧩 Complex` pill, timestamp, TL;DR); clicking swaps `currentState.currentDebrief` locally, stops explainer playback, clears `selectedNodeId`, and switches to `📊 Debrief`. |

## State Patterns

| State | Surface | Treatment |
| --- | --- | --- |
| Cold open / no state file | Debrief | `vibe_debrief_get_state` seeds `createWelcomeDebrief`, ensuring Hero, diagram, 4 cards, and starter checklist render immediately (never blank). |
| Agent skipped `vibe_debrief_publish` | Debrief | `Stop` hook synthesizes heuristic debrief (`synthesizeHeuristicDebrief`) within `<= 50ms` (or `4500ms`-bounded optional AI synthesis), keeping panel current on turn completion. |
| Empty diagram (`0` nodes) | Debrief (SVG) | Renders centered `Diagram pending…` text inside `460×120` SVG stage; `buildDefaultDiagram` prevents this on all synthesized/published turns. |
| Simple turn (`complexity.score < 4`) | Tabs / Explainer | `explainerScenes` is `[]`, `#complexityPill` and `#tabBtnExplainer` stay hidden (`display: none`). **[ASSUMPTION]** Add an explicit secondary `🎬 Generate Explainer` trigger in Hero/Header when `score < 4` so users can invoke `vibe_debrief_generate_explainer` without guessing a chat command (`SM-2`). |
| `✨ AI Explain` / `🌐 HTML` loading & error | Global / Toast | Success or failure triggers `toast-banner` (`4500ms`). **[ASSUMPTION]** Add explicit disabled/spinner state on `#btnAskAiExplain` and `#btnExportHtml` while RPC is in flight, plus visible retry toast if the `15,000ms` JSON-RPC request timeout fires. |
| Bug outcome states (`yes` / `partial` / `no`) | Debrief (Card 3) | `#bugSuccessBanner` swaps icon, border/fill (`success` / `warning` / `danger`), headline, and Card 3 pill (`Succeeded` / `Partial / Check` / `Not Yet`). |
| Empty lessons list | Debrief (Section 5) | Displays `No new lessons flagged — click ➕ Add Lesson or 💡→Rule above to save one.` |
| Custom lesson missing required fields | Debrief (`lesson-form`) | Shows warning toast `⚠️ Please enter a title and summary for the lesson.` without invoking `vibe_debrief_confirm_lesson`. |
| Unwritable `~/.zcode/cli/memories` | Memory | Engine falls back silently to `<workspaceRoot>/.zcode/memory/`; `🧠 Memory` displays the active fallback directory path. |
| Empty memory / `MEMORY.md` | Memory | Shows `No lessons confirmed in this workspace yet.` and `(MEMORY.md is currently empty)`. |
| Empty history | History | Shows `No previous turns recorded yet.` |
| Light / dark host switch | Global | `ui/notifications/host-context-changed` toggles `body.theme-light` immediately. **[ASSUMPTION]** Bind SVG node/edge colors and Canvas palette to resolved CSS variables so light mode matches `body.theme-light` contrast. |
| Offline / post-session review | Standalone HTML | Exported `.html` runs 100% self-contained in any browser; interactive SVG inspector, checklist toggles (local DOM state), and Canvas player work offline. |

## Interaction Primitives

- **Pointer-first clicks & toggles:** Single-click acts across header controls, tabs, SVG nodes, file badges, Card 4 checkboxes, `💡→Rule` promote buttons, `Confirm & Save` buttons, history rows, and Canvas transport buttons.
- **Horizontal pill scrolling:** Persona strip and scene pill row scroll horizontally when content exceeds panel width.
- **Audio + Plain-text pairing:** Enabling `🔊 Voice On` speaks scene narrations via `window.speechSynthesis` (never auto-plays on load); `script-box` always exposes the full plain-text script alongside it.
- **Host delegation (`ui/message`):** `✨ AI Explain` delegates deep refresh to the host ZCode chat session so flagship reasoning is not duplicated inside the iframe.
- **Keyboard status (`[ASSUMPTION]`):** `assets/panel.html` v0.2.0 implements zero `keydown` listeners or shortcuts; v0.3.0 should add standard tab/button keyboard activation (`Enter`/`Space` on SVG nodes and history items, `ArrowLeft`/`ArrowRight` on tabs and Explainer scene pills, `Escape` to close `#customLessonForm`).
- **Explicitly banned patterns:** Inline code-diff editing, multi-turn chat threads inside the panel, pan/zoom canvas controls, auto-playing speech narration, and `eval`/`new Function`/inline `onclick=` handlers (`unsafeEval: false`).

## Accessibility Floor

Behavioral parity floor (visual contrast targets live in [DESIGN.md](./DESIGN.md#colors)):

- **Current baseline (v0.2.0 gap):** `assets/panel.html` currently renders interactive SVG `<g class="svg-node">` elements, clickable `.history-item` `<div>` elements, and `<nav class="tabs-nav">` without `role`, `tabindex`, `aria-selected`, or `aria-live` attributes, and animates `<canvas>` regardless of OS motion preferences.
- **Target v0.3.0 floor (`[ASSUMPTION]`):**
  - Semantic landmarks & tab roles: `role="tablist"`, `role="tab"` + `aria-selected` + `aria-controls`, `role="tabpanel"` on all 4 tab sections, and `role="status"` + `aria-live="polite"` on `#toastBanner`.
  - Keyboard reachability: All SVG nodes (`<g>`), `.file-badge`, and `.history-item` controls must be focusable (`tabindex="0"`, `role="button"`) with `Enter`/`Space` activation and visible `:focus-visible` outline (`{colors.accent}`).
  - Reduced motion (`prefers-reduced-motion: reduce`): When active, Canvas explainer disables continuous pulse-dot `requestAnimationFrame` loops and renders crisp static highlighted frames per scene step.
  - Color-blind safety: Never encode risk or verification status by stroke/fill color alone — always pair with text/icon indicators (`high`/`medium`/`low` labels, `✅`/`❌`/`ℹ️` icons, `YES`/`PARTIAL`/`NO` banner copy).
  - Media alternative: `<canvas>` animation and Web Speech voiceover are always paired with the copyable plain-text `script-box` (`buildPlainTextScript`).

## Responsive & Platform

- **Host environment:** Desktop ZCode right-side sidebar iframe (constrained narrow width, full viewport height `100vh`) plus desktop web browsers for Standalone HTML exports.
- **Narrow-panel adaptation:**
  - Header truncates workspace name/subtitle with ellipsis; `model-select` caps at `118px`.
  - SVG diagram (`460px` viewBox) scales fluidly (`width: 100%; height: auto`) and switches between `1`, `2`, and `3` columns based on node count (`<= 6`).
  - Canvas (`600×250` logical resolution) scales down cleanly via `width: 100%; height: auto`.
- **Breakpoint gap (`[ASSUMPTION]`):** `assets/panel.html` currently has zero `@media` rules; on ultra-narrow sidebars (`< 340px`), the `.top-bar-row` action buttons (`model-select` + 3 buttons) can crowd the brand title — v0.3.0 should add a `< 360px` wrap rule allowing `.header-actions` to drop cleanly onto a compact sub-row if needed.

## Key Flows

### UJ-1 — Maya: Bug Isolation Without Reading a Stack Trace

*Protagonist:* Maya, an indie developer juggling three ZCode repositories. *Goal:* Diagnose a webhook `500` fix in under 60 seconds and save a regression guard.

1. Maya asks ZCode why her webhook server returns `500`. The agent patches two files, runs tests, and calls `vibe_debrief_publish` (`responseType: "bug"`).
2. `assets/panel.html` receives `ui/notifications/tool-result` and refreshes `📊 Debrief` in Bug mode (`🐛 Bug / Error Fix` active).
3. Maya scans the Hero TL;DR and Analogy box, then glances at the SVG diagram where the `server` node is bordered in rose (`{colors.danger}`, `high` risk).
4. **Climax beat:** Maya clicks the `server` SVG node; `#nodeInspectorBar` shows its role (`Server / API`), `high` risk level, and file path, while Card 1 explains the root cause in STE-80 plain English and Card 3's `#bugSuccessBanner` + `proofClaims` confirm `✅ Bash exit 0`.
5. In Card 4, Maya sees `uncertaintyAudit` flagging an untested retry path, checks off the verification checklist item (`vibe_debrief_toggle_check`), and clicks `💡→Rule` to pre-fill and save a Lesson Learned to `MEMORY.md`.
- **Failure / fallback path:** If the agent finishes without calling `vibe_debrief_publish`, the `Stop` hook triggers `synthesizeHeuristicDebrief` within `50ms` so Maya still receives a connected diagram and default verification checklist instead of a stale panel.

### UJ-2 — Leo: Complex Multi-Layer Explainer & Standalone Export

*Protagonist:* Leo, a visual learner implementing a multi-layer auth flow. *Goal:* Trace cross-layer execution visually, verify claims in plain text, and export an offline artifact for PR notes.

1. Leo completes a 4-file turn spanning UI, state, and service layers. `assessWorkflowComplexity` scores `>= 4`, generating 4 `explainerScenes`.
2. In `📊 Debrief`, the `#complexityPill` (`🧩 Complex · ▶ Explainer`) and Tab 2 (`🎬 Explainer`) unlock automatically.
3. **Climax beat:** Leo clicks `🎬 Explainer` and hits `▶ Play` on the Canvas stage, watching the pulse travel from UI → state → service nodes across scenes while scanning `script-box` below (and optionally toggling `🔊 Voice On`) to verify every claim in plain text.
4. Leo clicks `🌐 HTML` in the top bar; `vibe_debrief_export_html` writes a self-contained offline `.html` snapshot and toasts the saved path for Leo to attach to PR notes.
- **Simple-turn edge case:** On Leo's next 1-file CSS tweak (`score < 4`), `explainerScenes` stays empty and `🎬 Explainer` stays hidden to prevent clutter. If Leo still wants a walkthrough, Leo invokes `vibe_debrief_generate_explainer` (or an explicit `[ASSUMPTION]` on-demand button in Hero/Header).

### UJ-3 — Sam: Cost-Aware Deep Refresh When Agent Skips Publishing

*Protagonist:* Sam, a cost-conscious builder watching token spend. *Goal:* Upgrade a heuristic fallback debrief using a lightweight Gemini model instead of flagship reasoning tokens.

1. Sam finishes a turn where the coding agent replied in chat without calling `vibe_debrief_publish`; the `Stop` hook writes a fast heuristic debrief to `.zcode/vibe-debrief-state.json`.
2. Sam scans the panel, wants sharper STE-80 phrasing and analogy, and picks `⚡ gemini-4-argon` from `#smartGeminiModelSelect`.
3. **Climax beat:** Sam clicks `✨ AI Explain`; `panel.html` dispatches `[Vibe Debrief — Deep Refresh]` via `ui/message` to the host chat session and displays the delegation toast.
4. The `UserPromptSubmit` hook directs the host to delegate debrief synthesis to `new-provider/gemini-4-argon` via `CreateSession` and publish via `vibe_debrief_publish`, refreshing the panel automatically.
- **Failure / fallback path:** If `ui/message` is unsupported or times out, `panel.html` displays `⚠️ Could not send message to chat session.` while preserving the existing heuristic debrief on screen.

### UJ-4 — Nora: Cross-Session Guardrail Persistence to `MEMORY.md`

*Protagonist:* Nora, a technical lead preventing repeat AI mistakes across sessions. *Goal:* Persist a workspace rule into ZCode's native memory and verify it is active.

1. After reviewing Section 5 (or clicking `➕ Add Lesson`), Nora edits or confirms a lesson's title, summary, optional `Why`, and optional `How to apply`.
2. **Climax beat:** Nora clicks `Confirm & Save`; `vibe_debrief_confirm_lesson` writes `<slug>.md` with YAML frontmatter under `~/.zcode/cli/memories/projects/<slug>/memory/`, updates `MEMORY.md` idempotently, flips the card badge to `✅ Saved in MEMORY.md`, and increments the `🧠 Memory (<count>)` tab badge.
3. Nora opens `🧠 Memory` to confirm the new `<slug>.md` card and live `MEMORY.md` index entry are ready for future sessions.
- **Failure / fallback path:** If title or summary is empty, `panel.html` blocks the RPC call and toasts `⚠️ Please enter a title and summary for the lesson.`; if home memory is unwritable, the engine saves to `<workspaceRoot>/.zcode/memory/` and displays that path in `🧠 Memory`.

## Open Questions & Unvalidated Assumptions

- **`OQ-1` (Primary `v0.3.0` validation signal):** Should release readiness gate on Card 4 checklist toggle rate, `MEMORY.md` confirmation rate, or reduced repeat-bug rate across sessions?
- **`OQ-2` (Zero-dependency test suite):** Add `node --test` coverage (`tests/*.test.mjs`) for `debrief-engine.mjs` (STE-80 metrics, complexity gate, XSS escaping, memory writes).
- **`OQ-3` (Hook AI synthesis vs. `CreateSession`):** Decide whether `Stop` hook optional AI synthesis (`VIBE_DEBRIEF_OPENAI_KEY`) stays alongside `CreateSession` delegation or is deprecated.
- **`OQ-4` (4-file version sync):** Add automated validation across `.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs`, `assets/panel.html`, and `scripts/hook-runner.mjs`.
- **Unvalidated UX `[ASSUMPTION]`s:** `<= 60s` multi-file review speed target, `>= 85%` `STE-80` score without losing critical identifiers (`SM-3`), on-demand explainer discoverability when `score < 4` (`SM-2`), RPC `15,000ms` loading/timeout states, light-theme parity for SVG/Canvas, and v0.3.0 ARIA/keyboard/reduced-motion hardening.
