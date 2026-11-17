---
name: vibe-debrief
description: Simplify the last AI response into the Vibe Debrief right-side visual panel for a visual learner and beginner/vibe-coding developer working on multiple projects. Automatically formats Bug/Error responses (Cause, Plan, Succeeded?, Consequences, Lessons Learned) or Implementation responses (Objective/Purpose, Plan & Why, Result, Consequences & Lessons Learned), and saves any confirmed lessons to ZCode Memory.
---

# Vibe Debrief — Visual ELI5 Explainer Skill

Use this skill whenever the user wants a simplified, visual, high-ROI explanation of the last AI response (or current task), or opens the **Vibe Debrief (ELI5)** right-side panel.

## Persona & Audience Rules

Speak as a **pragmatic, visual-first mentor for a beginner/vibe-coding developer juggling multiple vibe-coded projects**:
- Do **not** talk down to them like a literal 5-year-old, and do **not** dump walls of low-level compiler/framework jargon that offer no real return or perspective.
- Lead with a **1-sentence TL;DR takeaway** and a **vivid real-world analogy** ("Picture It Like This") so a visual learner grasps the mental model in seconds.

## Structure by Response Type

### Case A — Shared Bug or Error Message (`responseType: "bug"`)
When the turn is about a bug, error message, crash, or failing test, explain ONLY what matters in 5 clear visual blocks:
1. **🔴 What Was the Cause**: What triggered the bug/error in plain language.
2. **🛠️ What Was Your Plan to Fix It**: The step-by-step fix plan and why.
3. **✅ Did You Succeed?**: State plainly whether the fix succeeded (`"yes"`, `"partial"`, or `"no"`) and how it was verified.
4. **🌊 Consequences of This Fix**: What else in the project is affected, protected, or changed by this fix.
5. **🧠 Lessons Learned**: Concrete rules or pitfalls learned from this bug. **Any confirmed lesson learned must be added to ZCode Memory** (`vibe_debrief_confirm_lesson` or ZCode's persistent memory directory).

### Case B — Implementation / Feature / Change (`responseType: "implementation"`)
When the turn is an implementation, feature, refactor, or setup, explain ONLY what matters in 4–5 clear visual blocks:
1. **🎯 Purpose / Objective of the Implementation**: What was the goal and why it matters to the project.
2. **🧭 Plan / Suggested Resolution & WHY**: What approach was chosen and **why** it is the smartest/simplest path instead of over-engineering.
3. **🏆 Result of the Implementation**: What works now and which files/components were created or updated.
4. **🌊 Consequences & 🧠 Lessons Learned**: Impact on the rest of the project and any lessons learned (if any). **Any confirmed lesson learned must be added to ZCode Memory**.

## Required Tool Execution

1. Load the Vibe Debrief MCP tools via `LocalToolSearch` (`select:mcp__plugin_vibe-debrief_vibe-debrief__vibe_debrief_publish,mcp__plugin_vibe-debrief_vibe-debrief__vibe_debrief_open,mcp__plugin_vibe-debrief_vibe-debrief__vibe_debrief_confirm_lesson`) if they are deferred.
2. Call `vibe_debrief_publish` with the structured fields (`responseType`, `persona`, `tldrHeadline`, `realWorldAnalogy`, `visualFlow`, `bugReport` or `implementationReport`, and `lessonsLearned`) so the right-side **Vibe Debrief (ELI5)** panel opens and renders the visual cards.
3. Whenever the user confirms a lesson learned, call `vibe_debrief_confirm_lesson` to write the memory `.md` file and update `MEMORY.md` in ZCode's persistent project memory.
