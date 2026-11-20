---
name: bmad-companion
description: Open and drive the global BMAD Companion right-side panel for any workspace. Use when the user wants to visualize BMAD-METHOD progress across phases, epics, and stories, onboard a project into BMAD, reconcile BMAD artifacts with codebase reality using AI, or launch recommended next /bmad-* skill + prompt commands in a new session with a recommended AI model.
---

# BMAD Companion (Global Right-Side Panel, Model Advisor & New-Session Launcher)

The **BMAD Companion** plugin provides a live right-side panel (`ui://bmad-companion/panel.html`, surface `bmad-companion`) coupled with automatic lifecycle hooks (`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`) and MCP tools that adapt dynamically to **any workspace**.

## Core Principles

1. **Never suggest bare BMAD skill names**:
   - Do **not** suggest just `/bmad-ux` or `/bmad-build`.
   - Always format every recommendation with a concrete, workspace-specific quoted prompt AND a dynamically selected AI model (`providerId/modelId`) from `ListModels` that matches the user's active providers, subscription state, and capability requirements:
     - `/bmad-ux "Enhance the UI/UX of <project> by refining key user workflows and aligning DESIGN.md and EXPERIENCE.md"` — pick the highest-ranked vision/design-capable enabled model
     - `/bmad-code-review "Review the recent implementation changes in <module> for edge cases, architectural boundaries, and test coverage"` — pick the highest-ranked deep-reasoning enabled model
     - `/bmad-build "Implement and verify story <id> (<title>) with unit and integration tests"` — pick the highest-ranked coding/tool-capable enabled model
   - Whenever you inspect `ListModels`, pass the live `models` array in `bmad_update_advisor({ ..., hostModels: models })` so the companion panel stays synchronized with the host's live provider and subscription state.
2. **Direct New-Conversation Launch with Pre-Pasted Prompt**:
   - In BMAD-METHOD, each workflow step runs best in a **fresh conversation**.
   - Clicking **🚀 Launch in New Session** in the BMAD Companion panel directly opens a new ZCode conversation (`Ctrl/Cmd+N`) and pre-pastes the chosen `/bmad-<skill> "<prompt>"` into the composer without executing anything inside the current session.
3. **Smart Artifact + AI Progress Verification & Tracker Reconciliation**:
   - Always report both **Static Tracker Progress** and **Smart AI-Reconciled Progress**, explaining the evidence behind each reconciled story or epic.
   - When the static tracking files (v6 `sprint-status.yaml` or v7 `tickets.toml`) lag behind the verified code/artifact reality, invoke `bmad_reconcile_trackers` (or guide the user to click **⚡ Reconcile Trackers with Reality** in the panel).
   - The reconciliation updates `sprint-status.yaml` (including header timestamps and completion counters) and/or `tickets.toml`, creates `.bak` backups, and records an audit trail in `.zcode/bmad-companion/reconciliation-log.json`.

## Workflow & MCP Tools

1. **Open the Right-Side Panel (`bmad_open_companion`)**:
   - Call `bmad_open_companion` whenever the user asks to open the BMAD Companion, inspect BMAD project progress, or get next-step BMAD guidance.
2. **Reconcile Trackers with Reality (`bmad_reconcile_trackers`)**:
   - Call `bmad_reconcile_trackers` with `{ dryRun: boolean, target: "all" | "v6-yaml" | "v7-tickets", backup: boolean }` to synchronize static files with real delivery.
3. **Push Post-Prompt Recommendations (`bmad_update_advisor`)**:
   - Call `bmad_update_advisor` with `headline`, `turnSummary`, `recommendations` (including `skill`, `fullCommand`, `recommendedModel`, `modelReason`, `title`, `rationale`, `phase`, `priority`), and optional `storyStatusUpdates`.
4. **Multi-Task Execution Queue & Per-Task Model Orchestrator (`bmad_queue_manage`)**:
   - Users can select multiple recommended prompts, stories, or an entire epic in the BMAD Companion panel, assign a specific AI model (`providerId/modelId`) and token-saving review gate (`reviewMode: "none" | "quick" | "thorough"`) to each task, and run the queue automatically via either:
     - **ZCode Dynamic Workflow (`.dwf.ts`)**: `bmad_queue_manage({ action: "start-queue", executionMode: "dynamic-workflow" })` compiles `.zcode/workflows/bmad-task-queue.dwf.ts` and `.zcode/bmad-companion/queue-step-updater.mjs`, which runs each task in an isolated `agent()` with its chosen `model("...")` and updates `.zcode/bmad-companion/state.json` live via `world.run` before and after every task.
     - **Separate Sessions Auto-Chain (`CreateSession` + Stop-hook handoff)**: `bmad_queue_manage({ action: "start-queue", executionMode: "separate-sessions" })` starts the first queued task in a dedicated ZCode conversation with `CreateSession({ project, model, prompt })`, records its `sessionId` via `bmad_queue_manage({ action: "start-task", taskId, sessionId })`, and ends the launching turn. When that task session stops, the bmad-companion `Stop` hook completes the task and returns a continuation directive (`{ decision: "block", reason }`) that starts the next task session with its own model — so the queue keeps running automatically without a long-lived orchestrator turn or `WaitSessions`. The next task stays `queued` until `start-task` claims it, and the panel live-updates the **🟢 Active Task** and **⏳ In-Queue Tasks**.

