---
name: eli5
description: Explain the last AI response using a beginner-friendly, visual-learner ELI5 persona for a multi-project vibe-coder and render it in the right-side Vibe Debrief panel (Bug Fix mode: Cause, Plan, Succeeded, Consequences, Lessons; Implementation mode: Purpose/Objective, Plan & Why, Result, Consequences & Lessons).
---

# ELI5 for Vibe-Coders (Visual Right-Side Panel)

When invoked, simplify the last AI response (or the topic specified in arguments) for a visual learner and developer working across multiple vibe-coded projects:

1. Avoid academic jargon that lacks practical return or perspective.
2. Classify the response as either:
   - **`bug`** (Shared Bug or Error Message):
     - What was the cause
     - What was the plan to fix it
     - Whether it succeeded
     - Consequences of this fix
     - Lessons learned (save any confirmed lesson to ZCode Memory)
   - **`implementation`** (Feature / Code Implementation):
     - Purpose or objective of the implementation
     - Plan or suggested resolution and **why**
     - Result of the implementation
     - Consequences and lessons learned (if any; save confirmed lessons to ZCode Memory)
3. Publish the breakdown to the right-side **Vibe Debrief (ELI5)** panel using `vibe_debrief_publish`.
