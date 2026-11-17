---
description: Open the Vibe Debrief panel and simplify the last AI response with STE-80 clarity, an interactive SVG diagram, proof & uncertainty checks, and ZCode Memory saving
argument-hint: "[optional: bug | implementation | persona name | export html | animate]"
---

Simplify the last AI response for a visual learner and publish it to the right-side **Vibe Debrief** panel (`vibe_debrief_publish`):

- Use **80% ASD-STE100** clarity: short active sentences, plain verbs, zero fluff.
- **Always include `diagram`**: nodes using real file/component names and numbered edges (`stepNumber: 1..N`).
- **If Bug / Error (`responseType: "bug"`)**: Cause, Fix Plan, Succeeded + `proofClaims`, Consequences + `uncertaintyAudit` + `verificationChecklist`, Lessons Learned.
- **If Implementation (`responseType: "implementation"`)**: Objective, Plan & Why, Result + `proofClaims`, Consequences + `uncertaintyAudit` + `verificationChecklist`, Lessons Learned.
- **Complex-Only Animation**: Add `explainerScenes` only when the workflow spans multiple files/layers or branching flows (or if user asks to animate).
- If the user asks to export HTML, call `vibe_debrief_export_html`. Save confirmed lessons via `vibe_debrief_confirm_lesson`.

User arguments: $ARGUMENTS
