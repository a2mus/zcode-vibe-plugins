---
description: Open the BMAD Companion right-side panel, audit BMAD-METHOD phase/epic/story progress with AI, reconcile static v6/v7 trackers with code reality, and generate contextual /bmad-* "<prompt>" recommendations with recommended AI models
---

1. Call the `bmad_open_companion` MCP tool to open the **BMAD Companion** right-side panel for the current workspace and inspect the scanned BMAD artifacts, smart progress, and configured models.
2. Perform a smart AI cross-check between the static BMAD trackers and actual codebase/artifact evidence (such as story plans, epic retrospectives, implementation reports, and recent commits).
3. If tracker files lag behind verified code reality, call `bmad_reconcile_trackers` to synchronize them, or highlight the reconciliation action to the user.
4. Call `bmad_update_advisor` to update the right-side panel with your AI turn summary and 3–5 concrete next BMAD skill + contextual prompt suggestions (always formatted as `/bmad-<skill> "<specific contextual prompt>"`, never a bare `/bmad-<skill>`) along with a `recommendedModel` (`providerId/modelId`) and `modelReason` for each.
5. Present a concise summary in chat highlighting the current BMAD phase & epic progress, reconciliation status, and the top recommended `/bmad-<skill> "<prompt>"` commands + recommended models that the user can launch directly in a new session from the right-side panel.
