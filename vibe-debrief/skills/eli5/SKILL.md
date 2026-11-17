---
name: eli5
description: Explain the last AI response in the right-side Vibe Debrief panel using 80% STE-100 clarity, an always-on interactive SVG diagram, inline proof & uncertainty checks, and complex-only animated walkthrough scenes.
---

# ELI5 for Vibe-Coders (Karpathy 4-Rung Panel)

When invoked, translate the last AI response (or the topic in arguments) for a visual learner working across multiple vibe-coded projects:

1. **STE-80 Clarity:** Short active sentences (<= 22 words), plain verbs, concrete nouns, zero fluff.
2. **Always-On Diagram:** Build a `diagram` (`nodes` with real component/file names + numbered `edges`) for every response.
3. **Fused Bug or Implementation View:**
   - **`bug`**: Cause → Fix Plan → Did It Succeed? (+ `proofClaims`) → Consequences (+ `uncertaintyAudit` & `verificationChecklist`) → Lessons Learned.
   - **`implementation`**: Objective → Plan & Why → Result (+ `proofClaims`) → Consequences (+ `uncertaintyAudit` & `verificationChecklist`) → Lessons Learned.
4. **Complex-Only Animation:** Include `explainerScenes` only for complex multi-file or multi-layer workflows.
5. Publish to the right-side **Vibe Debrief** panel via `vibe_debrief_publish` and save confirmed lessons via `vibe_debrief_confirm_lesson`.
