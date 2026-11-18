# Intent Doc: Vibe Debrief — Cockpit HUD, Interactive Diagrams & Cross-Plugin Deep Dives

**Status:** Converged Intent Specification  
**Target Surface:** ZCode right-side panel (`ui://vibe-debrief/panel.html`, ~320–460px iframe, zero-dependency `.mjs` + single-file HTML/CSS/JS)  
**Downstream Consumers:** `bmad-ux`, `bmad-agent-architect`, `bmad-agent-po`, `bmad-agent-pm`

---

## 1. Product Intent & User Goal

Transform Vibe Debrief from a dense, prose-heavy, 4-row-header vertical scroll into a **Cockpit HUD** that gives developers instant situational awareness and on-demand visual depth:

1. **<10-Second Comprehension:** Distill any AI response (code edits, debugging, architecture Q&A, plans, CLI errors, comparisons) into 1-line truth, verification trust signals, and scannable spatial structure.
2. **Explicit "Waiting On You" Radar:** Surface whether the AI needs anything from the user right now (decisions, inputs, actions, unblockers) with clickable quick-reply triggers.
3. **Clickable Concept Deep Dives:** Let users click any technical term, pattern, or architecture concept inside a response for an immediate plain-language micro-visual, then optionally escalate to a full interactive diagram.
4. **80% ASD-STE100 in Project/Conversation Language:** Apply short, active, plain sentences (~80% STE-100 clarity) written in the active project/conversation language, while keeping exact symbols, file paths, and commands intact behind an instant X-Ray toggle.

---

## 2. Converged Architecture & UX Blueprint (Cockpit HUD vNext)

### 2.1 Cockpit HUD 1-Strip Header
- Collapse the current multi-row header (mode switcher, persona chips, STE toggle, model/action pills) into **one compact command strip**:
  - Primary **Distill / Refresh** action + **X-Ray toggle** (`Plain` <-> `Tech`) + **Lens / Settings popover** (persona, clarity depth, model preference, HTML export, memory) + compact **View/Tab switcher** (`HUD` | `Visual` | `Memory & History`).
- Reserve ~85% of the above-the-fold 320–360px viewport for signal, not chrome.

### 2.2 10s Radar (Top Hero Zone)
Always visible above the fold unless Minimal Mode applies:
- **What Happened:** 1 crisp verdict pill (`Solved` / `Built` / `Explained` / `Blocked` / `Planned`), 1 plain-language headline (<=14 words), and a compact **Confidence / Verification strip** (verified tests vs. assumptions/unverified claims) so risk is immediate.
- **Waiting On You (5 Explicit States):**
  1. `Choice` — AI proposed options; render clickable option chips that dispatch the chosen reply.
  2. `Action` — User must run a command, test, approval, or manual step.
  3. `Reply` — AI asked a question or needs clarification/confirmation.
  4. `Blocked` — Execution stalled on missing info, credentials, or failing precondition.
  5. `None` — Turn complete; no user input required (quiet/calm indicator).
- Clicking any Choice/Reply/Action chip sends a structured prompt/response back to ZCode chat via `ui/message`.

### 2.3 X-Ray Toggle (`Plain (STE-80)` <-> `Technical (Code Reality)`)
- **Plain Mode (Default):** 80% ASD-STE100 phrasing (short sentences, active voice, plain verbs) generated in the **user's project/conversation language**, pairing plain action labels with subtle symbol badges.
- **Technical Mode (X-Ray Flip):** Reveals exact file paths, function/symbol names, command outputs, and raw proof lines in-place without re-querying an LLM (pre-structured dual-coded payload).
- **Zero-Trust-Gap:** Simplified claims remain linked to exact source files/commands via expandable proof/nuance chips.

### 2.4 Composable Micro-Blocks & Adaptive Visual Centerpiece
- Replace rigid single-template switching (`Bug` vs `Implementation` 4-card prose walls) with **Composable Micro-Blocks** assembled to match the response's actual intents:
  - *Verdict/TL;DR*, *Interactive Map (SVG)*, *Proof & Risks*, *Trade-off / Comparison Matrix*, *Step Recipe*, *Choice Strip*, *Next Check*.
- **Diagram-First Synthesis:** Derive scannable bullets directly from a unified declarative **Diagram Spec** (nodes, edges, groups, proof/risk badges) supporting adaptive grammars (`Sequence`, `Flow / FlowDiff`, `Subway Layer Map`, `Before/After Split`, `Decision Tree`) and inline kinetic SVG pulse + on-demand Canvas step walkthroughs.
- **Visual Power-Up Dock:** Compact strip below the SVG preview (`[SVG]` `[Excalidraw]` `[Interactive Gen UI]` `[VectorCraft]` `[Animate]`) showing only relevant/available visual surfaces.

### 2.5 Two-Stage Concept Deep Dive
Clickable **Concept Pills** (auto-detected technical terms, protocols, patterns, or architectural components mentioned in the response) trigger a progressive two-stage flow:
- **Stage 1 — Instant Inline Micro-Deep-Dive (<100ms, inside panel):**
  - Slides open an inline card/drawer containing an STE-80 plain definition/analogy in the conversation language + a compressed 3-node SVG or micro-loop animation.
  - Zero external plugin startup cost; includes a single **`Go Deeper & Pop Out`** CTA bar.
- **Stage 2 — Full Visual Pop-Out (External Plugin or Built-In Fallback):**
  - Routes a deep explanation + structured Diagram Spec / curated prompt to the best **installed external ZCode visual plugin** on the main stage (never crammed inside the 360px sidebar):
    - Editable architecture/whiteboard -> `excalidraw` (`create_diagram`)
    - Interactive simulation / algorithm / sliders / chart -> `visualize` (Gen UI)
    - Polished vector graphic / poster -> `vectorcraft` / `designcraft`
  - **Missing-Plugin Rule (Mandatory):** If the target external plugin is absent/unavailable, **always** (1) generate and open the **built-in standalone HTML interactive explainer fallback**, and (2) display a non-blocking **install suggestion** naming the missing plugin/tool so the user knows how to unlock richer canvases.

---

## 3. Edge-Case & Cost Guardrails

1. **Hybrid Multi-Intent Replies:** Responses combining multiple shapes (e.g., explanation + error trace + next-step choices) compose multiple Micro-Blocks in one view rather than forcing a single exclusive Bug/Build/Concept template.
2. **Tiny-Turn Minimal Mode:** Short acknowledgments, single-line answers, or trivial edits collapse into a compact 1-line **Minimal Mode** strip (suppressing empty diagram frames, empty risk cards, and deep-dive docks) with an optional manual `Expand` trigger.
3. **Zero-Cost Default + Honest Model-Agnostic Clarify Fallback:**
   - Hook/skeleton extraction remains deterministic and free (<20ms) by default; external visual plugins only run on explicit user click or high-complexity opt-in.
   - When heuristic parsing or confidence is low, surface an honest uncertainty indicator with a **`Clarify (Fast/Cheapest Model)`** action that dynamically selects the **cheapest enabled model** (e.g., via provider/settings discovery) or the **user's active/selected model**—never hardcode a single model name like Argon.
4. **CSP `unsafeEval: false` & Iframe Isolation (`ui/message` Bridge):**
   - `assets/panel.html` runs under strict MCP App CSP (`unsafeEval: false`, zero external `<script>`/`<link>`/fetches, no `eval`, `new Function`, or inline `onclick=`).
   - Because the iframe cannot invoke another plugin's MCP tools directly, all cross-plugin handoffs (`excalidraw`, `visualize`, `vectorcraft`, etc.) and Waiting-On-You quick replies **must** route via `window.parent.postMessage` JSON-RPC 2.0 (`ui/message` delegation or workspace spec handoff + `tools/call` to Vibe Debrief's own MCP server).
   - Escape all dynamic HTML/SVG strings and embedded JSON (`\u003c` in standalone HTML exports).
5. **Language-Agnostic STE-80 + Symbol Integrity:** Enforce structural STE-80 rules (short <=22-word sentences, active voice, one idea per bullet) in whatever language the project/user speaks, while never translating or mutating code identifiers, CLI flags, or file paths in Technical/X-Ray data.

---

## 4. MoSCoW Scope & Priority Table

| Priority | Scope Item | Key Acceptance Anchor |
| --- | --- | --- |
| **MUST** | **Cockpit HUD 1-Strip Header** | Single compact top bar + settings/lens popover; frees >=45px vertical space. |
| **MUST** | **10s Radar (What Happened + Waiting On You)** | Headline + verification confidence strip + 5 explicit waiting states (`Choice`, `Action`, `Reply`, `Blocked`, `None`) with clickable `ui/message` chips. |
| **MUST** | **X-Ray Toggle (`Plain STE-80` <-> `Technical`)** | 80% ASD-STE100 in project/conversation language; dual-coded symbol/path reveal with zero extra LLM call. |
| **MUST** | **Composable Micro-Blocks** | Multi-intent responses retain all parts (explanation + error + choices) without single-template truncation. |
| **MUST** | **Two-Stage Concept Deep Dive** | Stage 1 inline <100ms STE-80 card + 3-node SVG -> Stage 2 external plugin pop-out (`excalidraw`, `visualize`, `vectorcraft`) with mandatory built-in HTML fallback + missing-plugin install prompt. |
| **MUST** | **CSP & `ui/message` Guardrails** | Strict `unsafeEval: false` compliance; all external plugin triggers and quick-replies routed via `ui/message` / own MCP `tools/call`. |
| **SHOULD** | **Tiny-Turn Minimal Mode** | Trivial/short turns auto-collapse to a 1-line compact strip without empty diagram/card noise. |
| **SHOULD** | **Model-Agnostic Clarify Fallback** | Honest low-confidence fallback button routing to the cheapest enabled model or user-selected active model (no hardcoded Argon). |
| **SHOULD** | **Multi-Grammar Native SVG Engine** | Declarative Diagram Spec rendering Sequence, FlowDiff, Before/After Split, Subway Layer Map, or Decision Tree inside `panel.html`. |
| **SHOULD** | **Anytime Inline Animation & Curator Tour** | Subtle inline SVG kinetic flow + clickable Canvas step-by-step walkthrough unlocked on demand without rigid complexity lockouts. |
| **COULD** | **Sprint Reel Deck Export** | Multi-turn History selection exported to `presentations` / `deckcraft` briefing deck. |
| **COULD** | **Compare Exhibits History Diff** | Side-by-side / overlay diagram diff comparing system topology between two past turns. |
| **COULD** | **Visual Memory Thumbnails** | Attach compact SVG snapshots to confirmed `MEMORY.md` lessons. |
| **WON'T (This Time)** | **Full Inline Whiteboard Editor in 360px Panel** | Do not embed Excalidraw/Figma-style editing inside the narrow sidebar; always pop out. |
| **WON'T (This Time)** | **3D Blender Spatial Scene Bridge** | Experimental 3D scene generation deferred out of this release. |
