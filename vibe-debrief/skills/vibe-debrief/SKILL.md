---
name: vibe-debrief
description: Simplify the last AI response into the Vibe Debrief right-side panel using 80% ASD-STE100 clarity, an always-on interactive SVG diagram, inline proof & uncertainty checks, standalone HTML export, complex-only animated explainer scenes, and ZCode Memory persistence.
---

# Vibe Debrief — Karpathy Comprehension Panel Skill (v0.2.0)

Use this skill whenever the user wants a high-ROI, scannable comprehension pass of the last AI response or opens the **Vibe Debrief (ELI5)** right-side panel.

## Core Principles (Reading-Boundary Pass)
1. **80% ASD-STE100 Clarity:** Keep sentences short (<= 22 words), use active voice, pick plain verbs (`use` not `utilize`), focus each card on one topic, and skip academic filler.
2. **Always Include a Diagram:** Every single `vibe_debrief_publish` call (`bug` or `implementation`) must supply a `diagram` with real file/component names on nodes and numbered edges (`stepNumber: 1..N`).
3. **Fused Oversight Inside Cards 3 & 4:**
   - **Card 3 (`Did It Succeed?` / `Result`)**: Pair the outcome with `proofClaims` (concrete evidence from tests, commands, or edited files).
   - **Card 4 (`Consequences & What to Double-Check`)**: Pair ripple effects with `uncertaintyAudit` (1–3 least-certain assumptions) and `verificationChecklist` (1–3 quick checks).
4. **Complex-Only Animation (`explainerScenes`):** Only generate `explainerScenes` when the workflow is genuinely **complex** (multi-file `>= 3`, multi-layer `>= 2`, or branching data flow). Keep simple turns fast and uncluttered.

## Structure by Response Type

### Case A — Bug / Error Fix (`responseType: "bug"`)
1. **🔴 1. What Was the Cause?** — Plain-language root cause.
2. **🛠️ 2. Fix Plan** — Targeted fix strategy.
3. **✅ 3. Did It Succeed?** — `"yes" | "partial" | "no"` + inline `proofClaims`.
4. **🌊 4. Consequences & What to Double-Check** — Ripple effects + `uncertaintyAudit` + `verificationChecklist`.
5. **🧠 5. Lessons Learned** — Save confirmed rules to ZCode Memory (`vibe_debrief_confirm_lesson`).

### Case B — Implementation (`responseType: "implementation"`)
1. **🎯 1. Objective & Why It Matters** — Clear goal and product value.
2. **🧭 2. Plan & Why This Way** — Chosen path and why it beats over-engineering.
3. **🏆 3. Result & Evidence** — What works now + inline `proofClaims`.
4. **🌊 4. Consequences & What to Double-Check** — Trade-offs + `uncertaintyAudit` + `verificationChecklist`.
5. **🧠 5. Lessons Learned** — Save confirmed rules to ZCode Memory.

## Required Tool Execution
1. Load Vibe Debrief MCP tools via `LocalToolSearch` (`select:mcp__plugin_vibe-debrief_vibe-debrief__vibe_debrief_publish,mcp__plugin_vibe-debrief_vibe-debrief__vibe_debrief_open,mcp__plugin_vibe-debrief_vibe-debrief__vibe_debrief_confirm_lesson,mcp__plugin_vibe-debrief_vibe-debrief__vibe_debrief_export_html`) if deferred.
2. Call `vibe_debrief_publish` with `responseType`, `persona`, `tldrHeadline`, `realWorldAnalogy`, `diagram`, `bugReport`/`implementationReport`, `proofClaims`, `uncertaintyAudit`, `verificationChecklist`, `lessonsLearned`, and `explainerScenes` (complex workflows only).
3. Call `vibe_debrief_confirm_lesson` whenever a lesson is confirmed to write `<slug>.md` and update `MEMORY.md`.
4. Call `vibe_debrief_export_html` if the user asks for a standalone shareable HTML explainer file.
