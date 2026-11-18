---
name: Vibe Debrief
status: final
sources:
  - ../../../planning-artifacts/prd-vibe-debrief.md
  - ../initiative-vibe-debrief.md
  - ../brainstorm-ui-ux-diagram-plugins/brainstorm-ui-ux-diagram-plugins.md
  - ./mockups/cockpit-hud.html
  - ../../../../assets/panel.html
updated: 2026-11-18
---

# Vibe Debrief — Experience Spine

> Information architecture, interaction, state, accessibility, and user journey contract for Vibe Debrief (`assets/panel.html` + `generateStandaloneHtmlArtifact`), evolved to **Cockpit HUD vNext (target `v0.4.0`)** while maintaining backward compatibility with `v0.2.0` (`R1`–`R7`) and `v0.3.0` hardening (`R8`–`R12`). Visual tokens and component appearance live in [DESIGN.md](./DESIGN.md).

## Foundation

Multi-surface developer comprehension system embedded in ZCode:
1. **Primary surface — ZCode Right-Side Cockpit HUD:** Isolated MCP App iframe (`ui://vibe-debrief/panel.html`, MIME `text/html;profile=mcp-app`, `_meta["zcode/csp"].unsafeEval: false`), communicating exclusively via `window.parent.postMessage` JSON-RPC 2.0 (`PROTOCOL_VERSION = "2026-01-26"`). Optimized for `320–460px` width.
2. **Pop-Out Stage — Stage 2 External Visual Surface:** Full-canvas visual deep dives launched on the main ZCode workspace via `ui/message` / workspace spec handoff (`excalidraw`, `visualize` Gen UI, `vectorcraft` / `designcraft`), with mandatory built-in HTML fallback when the target plugin is absent.
3. **Offline surface — Standalone HTML Export:** On-demand self-contained `.html` artifact (`vibe-debrief-<timestamp>.html`) readable in any desktop browser with zero external assets.

No third-party UI framework is used; all layout, multi-grammar SVGs, and `<canvas>` animations are bespoke vanilla HTML/CSS/JS. [DESIGN.md](./DESIGN.md) owns all visual tokens (`{colors.*}`, `{typography.*}`, `{rounded.*}`, `{spacing.*}`, `{components.*}`). Dark HUD (`:root`) is the default; **Field Desk Light** (`body.theme-light` / `html[data-theme="light"]`) syncs dynamically with the ZCode host via `ui/initialize` and `ui/notifications/host-context-changed`.

Core governing invariants:
- **Reading-Boundary Principle (`RULE-1`):** The coding agent reasons and edits freely mid-task; comprehension formatting (`STE-80`, diagram synthesis, dual-coded X-Ray payload, verification defaults) runs strictly at debrief/publish time (`vibe_debrief_publish`, `Stop` hook, or `MEMORY.md` write).
- **Zero-Cost Default:** Deterministic heuristic/skeleton extraction (`<20ms`) handles normal turns without extra LLM spend; external plugins and fast/cheapest-model clarification run only on explicit click or low-confidence fallback.
- **Strict Iframe Isolation (`RULE-3`):** Because the MCP App iframe cannot invoke external plugins' MCP tools directly, every quick-reply and Stage 2 pop-out routes through `ui/message` delegation or Vibe Debrief's own MCP `tools/call`.

## Information Architecture

| Surface | Reached From | Purpose |
| --- | --- | --- |
| `HUD` (Default View) | Panel open / `{components.view-switcher}` | `{components.radar-card}` (`What Just Happened` + `Waiting On You` 5-state radar) or `{components.minimal-strip}`, followed by dynamically composed Micro-Blocks (`Choice Strip`, `Interactive Map SVG` + `powerup-dock`, `Proof & Risk` + `Checklist`, `Concept Pills` + `stage1-drawer`, `Lessons`). |
| `Visual` (Curator Tour) | `{components.view-switcher}` or `[Animate]` in `{components.powerup-dock}` | Anytime-accessible `{components.explainer-stage}` (`600×250` 2D `<canvas>` step walkthrough), transport controls, Web Speech toggle, and copyable plain-text verification script (`buildPlainTextScript`). Replaces rigid `score >= 4` lockout. |
| `Memory & History` | `{components.view-switcher}` or `{components.gear-popover}` | Confirmed Lesson Bank (`confirmedLessons` up to 50) + live `MEMORY.md` preview + bounded 15-turn `history-item` list (clicking any turn loads that snapshot into `HUD`). |
| `Settings & Export` (`{components.gear-popover}`) | Gear icon in `{components.hud-header}` | Compact popover holding Surface Theme toggle, Project/Conversation Language, Persona lens, `STE-80` status, Model selector / Auto-cheapest preference, and `Export HTML`. |
| `Stage 2 Pop-Out` | `Deep Dive & Pop Out ↗` in `{components.stage1-drawer}` or `{components.powerup-dock}` | Main-stage interactive whiteboard (`excalidraw`), live simulation (`visualize`), or schematic (`vectorcraft`/`designcraft`). Always falls back to the built-in Standalone HTML Explainer + `{components.missing-banner}` when un-installed. |
| `Standalone HTML Export` | `Export HTML` in `{components.gear-popover}` or Stage 2 fallback | Self-contained offline `.html` snapshot with `10s Radar`, interactive SVG + Node Inspector, X-Ray Plain/Tech toggle, checklist toggles, and Canvas tour. |

→ Visual composition reference: [mockups/cockpit-hud.html](./mockups/cockpit-hud.html) (covers `hud-header`, `radar-card`, `stage1-drawer`, `stage2-popout`, and `missing-banner`). **Spines (`DESIGN.md` and `EXPERIENCE.md`) win on any conflict with mockups.**

## Voice and Tone

All published debrief copy follows **80% ASD-STE100 (`STE-80`)** structural rules in the **active project or conversation language** (English, French, etc.) when Plain mode is active: short active sentences (`<= 22` words target, `<= 14` words for Radar headlines), plain verbs (`utilize` → `use`, `subsequently` → `then`), one idea per bullet, and zero filler. Switching `{components.xray-toggle}` to `Tech` reveals exact symbol names, file paths, and CLI commands without mutating or translating code identifiers.

| Do (Cockpit Microcopy) | Don't |
| --- | --- |
| `Solved · Fixed webhook retry loop in 2 files.` | `Awesome! Everything passed without any issues! 🎉` |
| `Waiting On You: Pick a Choice` | `Please review the options generated by the AI assistant below.` |
| `Minimal Mode · Verified — 1 file formatting edit.` | Rendering an empty 4-card layout + empty SVG box for a typo fix. |
| `Unclear Reply — Honest Fallback. Ask a fast model to clarify or inspect raw text.` | Guessing or fabricating verification claims when confidence is low. |
| `Plugin not installed — Install excalidraw for live editing, or use this Built-in HTML Explainer.` | Silently failing or throwing a raw MCP tool-not-found error. |
| `Confirmed rules save directly to ZCode's MEMORY.md for future sessions.` | `Click here to persist long-term episodic agentic vector memory.` |

## Component Patterns

Behavioral rules for every component defined in [DESIGN.md](./DESIGN.md#components):

| Component | Surface | Behavioral Rules |
| --- | --- | --- |
| `hud-header` | Global | Single pinned strip showing brand icon/title, workspace context, `Distill` refresh button, `xray-toggle`, `gear-btn`, and `view-switcher`; truncates workspace label cleanly without wrapping buttons off-screen. |
| `xray-toggle` | Global header | Instant client-side flip between `Plain` (`STE-80` in project/conversation language) and `Tech` (reveals exact paths, symbol chips `.sym`, exit codes, raw proof lines) using pre-structured dual-coded state — **zero LLM call**. |
| `gear-popover` | Global header | Opens/closes on `gear-btn` click, outside click, or `Escape`. Hosts Theme, Language, Persona (`vibe-mentor`, `visual-mapper`, `indie-founder`, `eli5-storyteller`), `STE-80` status, Model selection (auto-cheapest or user override), and `Export HTML` (`vibe_debrief_export_html`). |
| `view-switcher` | Global header | Switches active view (`HUD`, `Visual`, `Memory & History`); switching away from `Visual` stops `<canvas>` playback and cancels `window.speechSynthesis`. |
| `radar-card` | HUD | Always top-of-fold unless `minimal-strip` applies. Displays `WHAT JUST HAPPENED` verdict pill (`Solved`, `Built`, `Explained`, `Blocked`, `Planned`), <=14-word headline, verification confidence summary (`verified` vs `unverified` count), and `WAITING ON YOU` strip. |
| `waiting-badge`, `action-chip`, `inline-reply-box` | HUD (`radar-card`) | Renders one of 5 explicit states: `Choice` (option chips), `Action` (run test / approve step chips), `Reply` (`inline-reply-box` + quick-yes/no chips), `Blocked` (missing precondition / unblocker chip), or `None` (`All Clear` quiet badge). Clicking any chip dispatches a structured reply via `ui/message` and marks `.selected` + toast. |
| `minimal-strip` | HUD | Triggered automatically on trivial/short turns (acknowledgments, 1-line answers, single-line formatting edits); suppresses empty diagram/risk blocks and offers a 1-click `Expand` toggle. |
| `choice-grid` & `choice-item` | HUD (Composed) | Composed when the agent proposes architectural or next-step options; shows `A`/`B`/`C` key, concise summary, trade-off meter bars, and clicking dispatches the selected option via `ui/message`. |
| `svg-stage` | HUD (Composed) | Declarative **Diagram Spec** renders the best-fit grammar (`Sequence`, `FlowDiff`, `Subway Layer Map`, `Before/After Split`, `Decision Tree`; max 6 primary nodes, numbered edges `1..N`) with subtle `.dash-flow` edge motion. Clicking a node or linked file chip updates the node inspector (`role`, `risk`, `path`). Pan/zoom is banned inside the narrow panel. |
| `powerup-dock` | HUD (Below SVG) | Shows context-relevant visual triggers (`[SVG]`, `[Excalidraw]`, `[Interactive Gen UI]`, `[VectorCraft]`, `[Animate]`). `[Animate]` switches to `Visual` curator tour on demand; external buttons route through Stage 2 pop-out logic. |
| `proof-pill` & `audit-row` | HUD (Composed) | `proof-pill` (`ok` / `risk` / `info`) toggles an inline monospace `proof-detail` snippet; unrun tests are banned from `ok`. `audit-row` pairs risk flags (`💡→Rule` opens `lesson-form` prefilled) with interactive `check-row` checkboxes (`vibe_debrief_toggle_check`). |
| `concept-pill` & `stage1-drawer` | HUD (Composed) | Auto-detected technical terms render as clickable pills. Clicking opens `stage1-drawer` in `<100ms` with target plugin badge, `STE-80` definition + analogy in conversation language, `104px` micro-loop `<canvas>` or 3-node SVG, and `Deep Dive & Pop Out ↗` CTA. Clicking the active pill again collapses the drawer. |
| `stage2-popout` & `missing-banner` | Main Stage / External | Dispatches structured Diagram Spec + prompt via `ui/message` to installed target (`excalidraw`, `visualize`, `vectorcraft`, `designcraft`). If target plugin is missing/unavailable, **always** opens the Built-in Standalone HTML Explainer fallback and renders `missing-banner` with a 1-click `Install <plugin>` suggestion (`SuggestPluginInstall` / chat prompt). |
| `unclear-box` | HUD (Fallback) | Shown when heuristic parsing has low confidence (`score < threshold` or ambiguous prose); displays honest uncertainty notice, raw quote snippet, `Clarify (Fast / Cheapest Model)` action (dynamically resolves cheapest enabled model or user-selected model — never hardcodes Argon), and `Show Raw Reply` toggle. |
| `explainer-stage` | Visual | `600×250` `<canvas>` curator tour with `▶`/`⏸`, `⏮`/`⏭`, speed (`0.85x`–`1.5x`), `🔇 Voice Off`/`🔊 Voice On` (`window.speechSynthesis`), scene pills, and copyable plain-text `script-box`. Accessible anytime via `Visual` or `[Animate]` without complexity lockout. |
| `lesson-card`, `lesson-form`, `memory-code-box` | HUD / Memory & History | Lesson cards show title, summary, `Why` / `How to apply`, and `Confirm & Save` (`vibe_debrief_confirm_lesson`) writing `<slug>.md` + `MEMORY.md`. `➕ Add Lesson` opens inline `lesson-form` and validates non-empty title + summary. |
| `history-item` & `hud-toast` | Memory & History / Global | Lists up to 15 turn snapshots; clicking swaps `currentDebrief` locally, stops playback, and switches to `HUD`. `hud-toast` displays transient feedback for `4500ms`. |

## State Patterns

| State | Surface | Treatment |
| --- | --- | --- |
| Cold open / no state file | HUD | `vibe_debrief_get_state` seeds `createWelcomeDebrief` so `radar-card`, starter SVG map, and starter check render immediately (never blank). |
| Agent skipped `vibe_debrief_publish` | HUD | `Stop` hook synthesizes heuristic debrief (`<=50ms`, `C6`), populating `radar-card`, `Waiting On You` state, and Diagram Spec cleanly. |
| Tiny / trivial turn | HUD | Collapses into `minimal-strip` (`Minimal Mode · Verified`), hiding empty SVG, proof, and concept docks; `Expand` button reveals full Micro-Blocks on demand. |
| Multi-intent hybrid reply | HUD | Composes multiple Micro-Blocks in one scroll (e.g., `radar-card` + `svg-stage` + `proof-pill` row + `choice-grid` + `concept-pill` row) without truncating to a single Bug/Build template. |
| Low-confidence / unclear turn | HUD | Replaces speculative synthesis with `unclear-box` + raw quote + `Clarify (Fast / Cheapest Model)` button (resolving cheapest enabled model dynamically via `discoverLightweightGeminiModels` / host active model). |
| Stage 1 Concept active | HUD | Renders inline `stage1-drawer` directly beneath `concept-pill` strip (`<100ms`); zero external plugin calls until user clicks `Deep Dive & Pop Out ↗`. |
| Stage 2 target plugin installed | Stage 2 Pop-Out | Sends Diagram Spec + prompt via `ui/message` to `excalidraw` / `visualize` / `vectorcraft`; HUD shows confirmation toast (`Sent to <Plugin>`). |
| Stage 2 target plugin missing | Stage 2 Pop-Out | Mandatory fallback: opens Built-in Standalone HTML Explainer and displays `missing-banner` naming the missing plugin + `Install <plugin>` trigger. |
| RPC loading / `15,000ms` timeout | Global | Triggers (`Clarify`, `Export HTML`, `Confirm & Save`, `Pop Out`) show busy/disabled state while in-flight and toast an actionable retry error if RPC fails or times out (`15,000ms`). |
| Unwritable `~/.zcode/cli/memories` | Memory & History | Engine falls back to `<workspaceRoot>/.zcode/memory/`; `Memory & History` displays the active fallback path. |
| Empty memory or history | Memory & History | Shows concise plain-language empty copy (`No lessons confirmed yet.` / `No previous turns recorded yet.`). |
| Light / dark host switch | Global | `host-context-changed` toggles Dark HUD vs Field Desk Light immediately; SVG and `<canvas>` re-read resolved CSS custom properties for full parity (`R10`). |
| Offline / post-session review | Standalone HTML | Exported `.html` runs 100% self-contained in any browser with local X-Ray toggle, SVG inspector, checklist toggles, and Canvas tour. |

## Interaction Primitives

- **Instant X-Ray Dual-Coding:** Switching `Plain` ↔ `Tech` swaps pre-rendered plain `STE-80` labels and technical symbol/path overlays in `<16ms` with zero network/LLM round-trip.
- **One-Click `ui/message` Dispatch:** `Waiting On You` `action-chip`s, `choice-item`s, `Clarify`, and `Stage 2 Pop-Out` send structured prompts back to the ZCode host chat via `window.parent.postMessage`.
- **Two-Stage Progressive Disclosure:** Concept Pills open `<100ms` inline Stage 1 first; Stage 2 external plugins only launch on explicit `Deep Dive & Pop Out ↗` click.
- **Audio + Plain-Text Pairing:** `🔊 Voice On` speaks scene narrations via `window.speechSynthesis` (never auto-plays); `script-box` always provides the verifiable plain-text script.
- **Keyboard Navigation (`R11`):** Standard `Tab` order matches visual reading order; `Enter`/`Space` activate SVG nodes, concept pills, choice cards, proof pills, and history items; `ArrowLeft`/`ArrowRight` step through `view-switcher` and scene pills; `Escape` closes `gear-popover`, `stage1-drawer`, or `lesson-form`.
- **Explicitly banned patterns:** Full inline whiteboard editing inside the `320–460px` sidebar (always pop out to Stage 2), multi-row header chrome, in-panel multi-turn chat threads, full-file diff walls, pan/zoom canvas controls, auto-playing audio, and `eval`/`new Function`/inline `onclick=` (`unsafeEval: false`).

## Accessibility Floor

Behavioral parity floor (`R11`; visual contrast targets live in [DESIGN.md](./DESIGN.md#colors)):
- **Semantic Landmarks & Live Regions:** `role="tablist"` / `role="tab"` + `aria-selected` on `view-switcher`; `role="dialog"` / `aria-expanded` on `gear-popover` and `stage1-drawer`; `role="status"` + `aria-live="polite"` on `hud-toast` and `Waiting On You` state updates.
- **Full Keyboard Operability:** Every SVG `<g class="svg-node">`, `concept-pill`, `choice-item`, `proof-pill`, and `history-item` has `tabindex="0"`, `role="button"`, `Enter`/`Space` handlers, and a `>= 3:1` `:focus-visible` outline (`{colors.accent}` / `{colors.accent-light}`).
- **Reduced Motion (`prefers-reduced-motion: reduce`):** Disables `.dash-flow` SVG stroke animation, `stage1-drawer` slide transitions, and continuous Canvas pulse `requestAnimationFrame` loops — rendering crisp static highlighted frames instead.
- **Color-Blind & Plain-Text Safety:** Never encode waiting states, risk, or verification by color alone — always pair hue with text labels and icons (`Choice`, `Blocked`, `✅`, `❌`, `high`/`medium`/`low`), and pair visual tours with `script-box`.

## Responsive & Platform

- **Sidebar Envelope (`320–460px`, `100vh`):** Pinned `hud-header` + `view-switcher`; vertically scrolling HUD body. Below `340px` width, `hud-header` wraps `xray-toggle` + `gear-btn` cleanly onto a compact sub-line without clipping.
- **Fluid Spatial Canvases:** `svg-stage` (`460px` viewBox) and `explainer-stage` (`600×250` logical canvas) scale proportionally (`width: 100%; height: auto`) across narrow sidebars.
- **Main Stage & Browser Pop-Out:** Stage 2 visual plugins (`excalidraw`, `visualize`, `vectorcraft`) and Standalone HTML exports use full workspace/desktop viewport width (`>= 740px` renders side-by-side cards and interactive toolbars).

## Key Flows

### UJ-1 — Maya: 10-Second Bug Isolation & `Action` Verification
*Protagonist:* Maya, an indie developer juggling three ZCode repos. *Goal:* Verify a webhook `500` fix in 10 seconds, run the required test action, and guard against repeats.

1. Maya asks ZCode why her webhook returns `500`. The agent patches two files and calls `vibe_debrief_publish` (or the `Stop` hook synthesizes the debrief).
2. `HUD` updates immediately: `radar-card` shows `Solved · Fixed retry guard in webhook handler` (`1 verified`, `1 check left`) and `Waiting On You: Verify / Run` (`Action` state) with an `action-chip` (`Run webhook retry test`).
3. **Climax beat:** Maya flips `X-Ray: Plain ↔ Tech` to see exact symbol badges (`retryWebhook`, `src/webhook.mjs`), clicks the rose high-risk node in `svg-stage` (`FlowDiff` grammar) to confirm the change path, and clicks the `Run webhook retry test` chip — dispatching the test command straight to ZCode chat via `ui/message`.
4. Maya expands the amber `audit-row`, clicks `💡→Rule` to save a regression guardrail into `MEMORY.md`, and checks off the verification row.
- **Failure / fallback path:** If the turn was ambiguous or heuristic parsing had low confidence, `unclear-box` surfaces the raw snippet and lets Maya click `Clarify (Fast / Cheapest Model)` instead of trusting a guess.

### UJ-2 — Leo: Multi-Intent Diagram & Two-Stage Concept Deep Dive (With Missing-Plugin Fallback)
*Protagonist:* Leo, a visual learner reviewing an auth architecture change that uses Server-Sent Events (`SSE`) and a new cache boundary. *Goal:* Grasp `SSE` in seconds inside the sidebar, then open a full interactive diagram.

1. The agent returns a hybrid reply (architecture explanation + option `A`/`B` choice + 4-file map). `HUD` composes `radar-card` (`Pick a Choice`), `choice-grid`, `svg-stage` (`Sequence` grammar), and `concept-pill` chips (`SSE Stream`, `Token Bucket`).
2. Leo clicks `SSE Stream` in `concept-pill`s.
3. **Climax beat (Stage 1 → Stage 2):** In `<100ms`, `stage1-drawer` opens inline with a 2-sentence `STE-80` explanation, an analogy, and a live `104px` stream loop canvas. Satisfied he needs the full picture, Leo clicks `Deep Dive & Pop Out ↗`.
4. ZCode routes the structured Diagram Spec to `visualize` (Gen UI) on the main stage. On Leo's second click for `Token Bucket` (targeting `vectorcraft`, which Leo hasn't installed), Vibe Debrief **automatically** opens the Built-in Standalone HTML Explainer and displays `missing-banner`: *"Plugin not installed — Install `vectorcraft` for precision editing, or use this Built-in HTML Explainer."*
- **Tiny-turn edge case:** On Leo's next 1-line CSS spacing tweak, `HUD` collapses into `minimal-strip` (`Minimal Mode · Verified`) with zero visual clutter.

### UJ-3 — Sam: Cost-Aware Clarification Without Hardcoded Models
*Protagonist:* Sam, a cost-conscious builder watching token spend. *Goal:* Keep routine turns zero-cost while still clarifying rare ambiguous outputs with the cheapest enabled model.

1. Across five clean edits, Vibe Debrief runs deterministic `<20ms` extraction at zero token cost; Sam scans `radar-card` (`None · All Clear`) and moves on.
2. On turn 6, the agent leaves an unstructured multi-paragraph answer with no test run. `HUD` detects low confidence and renders `unclear-box` with a raw quote preview.
3. **Climax beat:** Sam clicks `Clarify (Fast / Cheapest Model)`. Vibe Debrief dynamically inspects enabled host models (falling back to Sam's active selection if needed — never hardcoding one model name) and sends a Reading-Boundary delegation prompt via `ui/message`.
4. The refreshed turn lands with crisp `STE-80` bullets, `Waiting On You: Answer Question` (`Reply` state), and an `inline-reply-box` where Sam sends a 3-word answer.
- **Failure / fallback path:** If `ui/message` times out (`15,000ms`), `hud-toast` alerts Sam to retry while keeping the raw quote readable in `unclear-box`.

### UJ-4 — Nora: Cross-Session Guardrail Persistence to `MEMORY.md`
*Protagonist:* Nora, a technical lead preventing repeat AI mistakes across sessions. *Goal:* Promote a risky pattern into ZCode's native memory and verify it in `Memory & History`.

1. Reviewing a `Proof & Risk` block, Nora clicks `💡→Rule` on a flagged `risk` audit item (`Missing atomic write temp-rename`).
2. **Climax beat:** `lesson-form` expands inline pre-filled with title and summary; Nora adds a `How to apply` line and clicks `Confirm & Save`. `vibe_debrief_confirm_lesson` writes `<slug>.md` with YAML frontmatter under `~/.zcode/cli/memories/projects/<slug>/memory/`, updates `MEMORY.md` idempotently, and toasts confirmation.
3. Nora switches `{components.view-switcher}` to `Memory & History` to verify the saved rule in `memory-code-box` alongside recent turn snapshots.
- **Failure / fallback path:** Empty title or summary blocks RPC and shows a warning toast; unwritable home memory falls back to `<workspaceRoot>/.zcode/memory/` and shows the active path.

## Open Questions & Unvalidated Assumptions

- **`OQ-1` (Primary `v0.3.0` validation signal):** Gate release readiness on checklist toggle rate (`vibe_debrief_toggle_check`) vs `MEMORY.md` confirmation rate (PO pick: checklist interaction rate).
- **`OQ-2` / `OQ-4` (`v0.3.0` engineering gates):** Zero-dependency `node:test` suite covering engine + transports + `scripts/check-version-sync.mjs` across all 4 version locations.
- **`OQ-3` (Hook AI synthesis vs `CreateSession`):** Keep optional `Stop` hook synthesis alongside `CreateSession` delegation.
- **`OQ-5` (Cockpit HUD `vNext` schema bridge):** Define the declarative `Diagram Spec` + dual-coded `X-Ray` (`plain` / `tech` + `waitingOnYou` + `concepts`) payload contract in `scripts/debrief-engine.mjs` so `v0.4.0` remains backward-compatible with `v0.2.0`/`v0.3.0` state snapshots (`vibe-debrief-state.json`).
- **Unvalidated UX `[ASSUMPTION]`s:** `<10s` `radar-card` scan speed vs `<=60s` full audit speed, `Field Desk Light` eyebrow contrast (`#768396` on `#ffffff` / `#fbf9f4`) under WCAG AA, `Clarify` cheapest-model discovery accuracy across non-Gemini providers, and `Minimal Mode` trigger threshold tuning so hybrid replies never auto-collapse accidentally.
