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

## Optional OQ-5 Cockpit HUD Publish Hints (v0.4.0+)
All OQ-5 fields are optional and backward-compatible with v0.2.0. When publishing via `vibe_debrief_publish`, you can supply additive fields for the Cockpit HUD:
- `verdict`: `"Solved" | "Built" | "Explained" | "Blocked" | "Planned"`
- `waitingOnYou`: `{ state: "choice"|"action"|"reply"|"blocked"|"none", label, prompt, allowInlineReply, chips }`
- `choices`: `[{ id, key, title, plainSubtext, techSubtext, messagePrompt, picked, tradeOffs: [{ label, score }] }]`
- `xray`: `{ plain: { headline, summaryBullets }, tech: { headline, summaryBullets, symbols, paths, commands } }`
- `diagramSpec`: 5 grammars (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`) with `viewBoxWidth: 460` and `<= 6` nodes
- `concepts`: up to 6 concept pills with `stage1` definitions and `stage2` deep dive cards
- `heuristicConfidence` & `rawQuote`: honesty metrics (low confidence `< 0.55` reveals the `unclear-box`)

