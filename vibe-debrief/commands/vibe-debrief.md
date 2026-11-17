---
description: Open the Vibe Debrief (Visual ELI5) right-side panel and simplify the last AI response into visual Bug Fix or Implementation cards
argument-hint: "[optional: bug | implementation | persona name | confirm lesson]"
---

Simplify the last AI response for a visual learner and multi-project vibe-coder and publish it to the right-side **Vibe Debrief (ELI5)** panel (`vibe_debrief_publish`):

- **If the response was about a shared bug or error message (`responseType: "bug"`)**:
  1. What was the cause
  2. What was your plan to fix it
  3. Whether you succeeded
  4. What are the consequences of this fix
  5. What were the lessons learned (any confirmed lesson must be added to ZCode Memory via `vibe_debrief_confirm_lesson`)

- **If the response was an implementation (`responseType: "implementation"`)**:
  1. What was the purpose or objective of the implementation
  2. What was your plan or suggested resolution and **why**
  3. Result of the implementation
  4. Consequences and lessons learned from this implementation (if any; confirmed lessons saved to ZCode Memory)

User arguments: $ARGUMENTS
