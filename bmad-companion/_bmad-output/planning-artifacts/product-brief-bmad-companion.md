---
title: "BMAD Companion — Product Brief"
template: brief
version: 1.0.0
status: draft
created: "2026-11-17"
updated: "2026-11-17"
---

# BMAD Companion — Product Brief

## Table of Contents

- [Executive Summary](#executive-summary) — product thesis, 4-phase lifecycle orchestration, architectural pillars
- [Problem Statement](#problem-statement) — context switching fatigue, blind agent prompting, tracker divergence, session context degradation
- [Solution](#solution) — right-side MCP App cockpit, post-prompt advisor, dynamic model scorer, smart tracker reconciler, automated session launcher
- [What Makes It Different](#what-makes-it-different) — comparison table against manual BMAD CLI, raw markdown trackers, traditional PM tools, and heavy plugins
- [Who It Serves](#who-it-serves) — solo vibe-coders, structured software engineers/tech leads, multi-agent orchestrators
- [Success Criteria](#success-criteria) — verifiable technical contracts and checkable user outcomes
- [Scope](#scope) — v0.5.2 MVP boundary vs. deferred post-v0.5.2 roadmap
- [Vision](#vision) — 2–3 year evolutionary trajectory toward autonomous agentic sprint orchestration
- [Assumptions](#assumptions) — explicit assumptions tagged for validation
- [Open Questions](#open-questions) — unresolved product and workflow trade-offs

---

## Executive Summary

**BMAD Companion (`v0.5.2`)** is a zero-dependency ZCode workspace companion plugin (`ui://bmad-companion/panel.html`) designed to guide, accelerate, and automate the [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) lifecycle directly within the developer's IDE. Doffing the friction of manual skill memorization and tracking file drift, it docks permanently in ZCode's right-side panel surface (`surface: "bmad-companion"`), actively observing turns via lifecycle hooks (`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`) and an MCP stdio server (`scripts/mcp-server.mjs`).

The core thesis of BMAD Companion is that **AI-native software engineering requires continuous ambient orchestration, not isolated slash commands**. While BMAD-METHOD establishes an industry-leading standard for disciplined agile delivery across 4 distinct phases (1. Analysis & Ideation, 2. Planning & UX, 3. Solutioning & Architecture, 4. Implementation, QA & Ship), developers frequently stumble over:
1. Knowing *which* skill to invoke next and *how* to formulate a high-yield contextual prompt;
2. Misallocating LLM compute tiers (spending expensive reasoning tokens on simple updates or assigning low-reasoning models to complex architectures);
3. Allowing static tracking artifacts (`sprint-status.yaml`, `tickets.toml`) to drift away from actual codebase commits, tests, and story plans;
4. Degraded agent performance caused by running sequential multi-step tasks inside a single bloated context window.

BMAD Companion resolves these friction points through five architectural pillars:
- **Zero-Dependency Native Node ESM Engine (`scripts/bmad-engine.mjs`):** Blazing-fast workspace scanner and tracker reconciler utilizing purely Node.js built-ins (`node:fs`, `node:path`, `node:child_process`), with zero external `npm` overhead.
- **Dynamic Multi-Tier Model Scorer:** Live discovery of configured host models (`~/.zcode/v2/provider_config.json` and `ListModels`), pairing every recommended skill with the optimal capability profile (Deep Reasoning, UX/Visual, Agentic Coding, Fast Planning).
- **Post-Prompt Contextual Advisor (Never Bare Skills):** Eliminates prompt guesswork by generating fully formulated `/bmad-<skill> "<contextual prompt>"` commands tailored to repository state, active focus, and previous turn outputs.
- **Smart Tracker Reconciler with Safety Guarantees:** Heuristic and AI-driven cross-referencing between static status files (`sprint-status.yaml`, `tickets.toml`) and codebase reality (story files, test reports, retrospectives), featuring one-click auto-reconciliation, automatic `.bak` backups, and an audit trail in `.zcode/bmad-companion/reconciliation-log.json`.
- **Automated New-Session Launcher (`bmad_prepare_new_session`):** Enforces BMAD clean-session discipline by automatically copying the recommended prompt, opening a fresh ZCode conversation (`Ctrl/Cmd+N`), and pasting the command ready for immediate execution.

---

## Problem Statement

As AI coding assistants transition from interactive auto-complete to autonomous multi-step software development agents, the primary bottleneck shifts from *generating code* to *orchestrating agent workflows and preserving architectural integrity*. 

In BMAD-METHOD environments, developers face five compounding operational friction points:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE ORCHESTRATION GAP                           │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Bare Prompt Syndrome  │ Developers run `/bmad-build` or `/bmad-ux`  │
│                          │ without project context, yielding generic,  │
│                          │ poorly targeted agent outputs.              │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 2. Compute Misallocation │ Using expensive Opus/Sonnet on quick checks │
│                          │ or cheap Flash models on deep architecture  │
│                          │ spine designs and security reviews.         │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 3. Static Tracker Drift  │ `sprint-status.yaml` or `tickets.toml` lag  │
│                          │ behind implemented files and passed tests,  │
│                          │ creating phantom backlog items.             │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 4. Context Window Bloat  │ Chaining multiple BMAD phases in one chat   │
│                          │ session degrades reasoning and causes       │
│                          │ hallucinated implementation plans.          │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 5. Spatial Blindness     │ Lack of ambient visibility into which phase │
│                          │ the repo is in, what epics remain, or what  │
│                          │ artifacts were recently generated.          │
└──────────────────────────┴─────────────────────────────────────────────┘
```

1. **Bare Prompt Syndrome & Prompt Guesswork:** BMAD provides 30+ specialized skills and agent personas. When left on their own, developers frequently emit bare skill invocations (e.g., bare `/bmad-ux` or `/bmad-build`) or spend several minutes crafting repetitive contextual framing. Without automated repository context injection, agents produce shallow, unfocused deliverables.
2. **Compute Misallocation & Provider Fragmentation:** Modern AI developers configure multiple providers (Anthropic, Google Gemini, OpenAI, Groq, OpenRouter). Selecting the right model for each BMAD phase is unintuitive. A deep architecture design or red-team code review requires heavy reasoning tokens (`claude-opus-5-5-high`), whereas sprint status synchronization or project context audits need rapid, lightweight synthesis (`gemini-4-argon-high`). Without intelligent model routing, developers either overspend budget or underpower critical tasks.
3. **Static Tracker Divergence ("Sprint Drift"):** In both BMAD v6 (`sprint-status.yaml`) and BMAD v7 (`tickets.toml` + `initiative-*/`), developers must manually flip story keys from `in-progress` to `done`. When engineers ship code under pressure, documentation lags. Story files exist, unit tests pass, and retrospectives are signed off, yet the static tracker still marks stories as `backlog` or `ready-for-dev`. This desynchronization confuses agents who rely on the tracker to determine the next task.
4. **Single-Thread Session Context Degradation:** High-quality BMAD execution demands clean context windows. Attempting to draft a PRD, write an architecture spine, decompose epics, and implement 4 stories in a single conversation saturates the LLM context, introduces noise, and causes memory hallucinations. Yet, opening a new tab, copying instructions, and formulating the next prompt manually introduces high cognitive drag.
5. **Spatial Disorientation Across 4 Phases:** Chat-based interfaces are purely chronological. Developers lack ambient awareness of where their repository stands within the broader BMAD 4-phase lifecycle, which stories have verified test proof, and which artifacts need review.

---

## Solution

BMAD Companion provides a persistent, right-side cockpit (`ui://bmad-companion/panel.html`) seamlessly wired to ZCode via the MCP Apps JSON-RPC bridge and 4 lifecycle hooks.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BMAD COMPANION COCKPIT                          │
├────────────────────────────────────────────────────────────────────────┤
│  ⚡ Next Prompts      📊 Phases & Epics     🧭 Catalog     🗂️ Artifacts │
├────────────────────────────────────────────────────────────────────────┤
│  🎯 Post-Prompt AI Turn Advisor                                        │
│  "Epic 2 (Authentication) Story 2.1 implemented with 14 unit tests."   │
│                                                                        │
│  Recommended Next Step:                                                │
│  ▶ /bmad-code-review "Review auth token rotation and cookie security"  │
│    Model: claude-opus-5-5-high (Deep Reasoning & Security Audit)       │
│    [🚀 Launch in New Session]  [📋 Copy Command]                       │
├────────────────────────────────────────────────────────────────────────┤
│  📈 Dual Progress Tracking                                             │
│  Static Tracker:  45% (9/20 stories)                                   │
│  Smart AI State:  65% (13/20 stories verified via tests/story plans)   │
│  [⚡ Reconcile Trackers with Reality] (Auto-updates sprint-status.yaml)│
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Ambient Right-Side Surface (`ui.surfaces`)
Integrated as a native ZCode session surface (`ui://bmad-companion/panel.html`), BMAD Companion is always visible on the right side of the screen without taking over the active conversation. It automatically polls the engine state every 5 seconds while visible, guarded against form-input interruptions (`isUserInteractingWithForm` and `userEditedPrompts`).

### 2. Intelligent Next Prompt Advisor (Never Bare Skills)
After each assistant turn, the `Stop` hook and `bmad_update_advisor` analyze what changed. Instead of generic suggestions, it presents 1–3 ranked recommendations where each recommendation consists of:
- **Skill identifier:** e.g., `/bmad-code-review`, `/bmad-qa-generate-e2e-tests`.
- **Full contextual prompt:** Quoted, repo-specific prompt incorporating touched files, failing tests, or active sprint goals.
- **Dynamically recommended model:** Extracted from active host providers, matched to the skill's capability requirements, with an explicit explanation for the recommendation.

### 3. Dynamic Model Capability Router
The engine discovers all configured models from `~/.zcode/v2/provider_config.json` and live host tools (`ListModels`). It categorizes them into 4 tailored operational tiers:
- **🧠 Deep Reasoning & Architecture:** (Opus 5.5, Opus 4.6 Thinking) for `/bmad-architecture`, `/bmad-prd`, `/bmad-code-review`, `/bmad-retrospective`.
- **🎨 UX & Visual Systems:** (Gemini Hydrogen/Pro, Sonnet) for `/bmad-ux`, `/bmad-brainstorming`, `/bmad-agent-ux-designer`.
- **💻 Agentic Coding & TDD:** (Sonnet 5.5, Sonnet 4.6) for `/bmad-build`, `/bmad-qa-generate-e2e-tests`, `/bmad-testarch-atdd`.
- **⚡ Fast Planning & Synthesis:** (Gemini 4 Argon, Flash 2.5) for `/bmad-sprint-planning`, `/bmad-project-context`, `/bmad-walkthrough`.

### 4. Smart Artifact Verification & One-Click Tracker Reconciliation
The engine inspects both BMAD v6 (`sprint-status.yaml`, `epics.md`, `implementation-artifacts/`) and BMAD v7 (`tickets.toml`, `initiative-*/`, `epic-*/`, `story-*-plan.md`) structures. It cross-checks static statuses against actual evidence:
- Story plan files marked `done` or `review`.
- Test reports containing passing/failing suites.
- Retrospective files signed off.
- Recent Git commit logs touching the module.

When static files lag behind code reality, the panel highlights the gap (**Static Progress: 40% vs. Smart Progress: 60%**). Clicking **⚡ Reconcile Trackers with Reality** (or calling `bmad_reconcile_trackers`) updates `sprint-status.yaml` or `tickets.toml`, creates a timestamped `.bak` backup, and commits an audit entry to `.zcode/bmad-companion/reconciliation-log.json`.

### 5. Automated "Launch in New Session" Engine (`bmad_prepare_new_session`)
To maintain prompt hygiene and prevent context exhaustion, clicking **🚀 Launch in New Session** automates the entire transition:
- Encodes the full command into the system clipboard.
- Triggers OS-level automation (Windows PowerShell SendKeys, macOS AppleScript, Linux xdotool) to press `Ctrl/Cmd+N` (opening a clean ZCode session) and `Ctrl/Cmd+V` (pre-pasting the contextual prompt into the composer).
- The user can inspect the prompt, make adjustments, and press Enter with a clean context window.

---

## What Makes It Different

| Capability | Manual BMAD CLI (`npx skills`) | Raw Markdown Trackers | Traditional PM (Jira/Linear) | BMAD Companion (`v0.5.2`) |
| :--- | :--- | :--- | :--- | :--- |
| **Workspace Integration** | Terminal CLI commands outside IDE | Static text files in repo | Browser tab separate from editor | **Native right-side IDE cockpit (`ui://bmad-companion/panel.html`)** |
| **Prompt Synthesis** | Bare skill prompts typed manually | None | None | **Context-aware `/bmad-* "<prompt>"` generation after every turn** |
| **Model Matching** | Manual model selection by user | None | None | **Dynamic 4-tier model routing based on live host providers** |
| **Tracker Synchronization** | Manual YAML/TOML hand-editing | Manual manual text editing | API webhooks or manual ticket dragging | **Smart AI reconciliation with 1-click auto-sync & `.bak` safety** |
| **Session Isolation** | Developer manually copies prompt & opens tab | None | None | **Automated `Ctrl/Cmd+N` + `Ctrl/Cmd+V` new-session launcher** |
| **Dependency Footprint** | External Node/NPM dependencies | Zero dependencies | Heavy web application / Electron | **Zero external dependencies (Node ESM built-ins only)** |
| **Security & Privacy** | Depends on package installations | Local files | Cloud-hosted proprietary data | **100% local, CSP-confined (`unsafeEval: false`), path-confined** |

---

## Who It Serves

### Persona 1: The Solo Vibe-Coder & Indie Hacker
- **Profile:** Fast-moving developer using AI coding assistants to ship full-stack web/mobile applications from scratch.
- **Pain Point:** Frequently loses track of which BMAD phase they are in, burns through expensive model credits on trivial tasks, and forgets the syntax for advanced BMAD workflows.
- **Value Realized:** Real-time visual clarity in the right-side panel, instant pre-formulated next prompts, dynamic model allocation to save tokens, and 1-click clean session launches.

### Persona 2: The Structured Software Engineer & Tech Lead
- **Profile:** Senior engineer building production-grade software using BMAD-METHOD to enforce architectural boundaries, comprehensive PRDs, and rigorous TDD.
- **Pain Point:** Sprints drift because junior developers or coding agents fail to update `sprint-status.yaml` or `tickets.toml` after implementing code. Reviewing and reconciling files by hand wastes hours.
- **Value Realized:** Smart AI status reconciliation that detects when story files and tests pass, automated audit trails in `reconciliation-log.json`, and instant detection of failing test reports.

### Persona 3: The Multi-Agent Orchestrator
- **Profile:** Power user coordinating specialized agent roles (Analyst, Architect, UX Designer, Dev, QA, Security Reviewer) across complex multi-repo initiatives.
- **Pain Point:** High cognitive load when switching personas and formulating prompts with the right artifact references and constraints.
- **Value Realized:** Instant access to the 30+ BMAD skills catalog, automatic phase transitions, and persistent tracking of artifacts across all 4 delivery phases.

---

## Success Criteria

Success is evaluated across verifiable technical invariants and concrete user experience outcomes:

### Verifiable Technical Invariants
1. **Zero External Dependencies:** Verified that `package.json` contains no external npm libraries. All modules (`bmad-engine.mjs`, `mcp-server.mjs`, `hook-runner.mjs`) strictly use Node.js built-ins (`node:fs`, `node:path`, `node:child_process`, `node:os`).
2. **Strict CSP & Evaluator Safety:** Panel UI (`assets/panel.html`) loads cleanly under ZCode MCP App CSP (`unsafeEval: false`), with no external CDN assets, unescaped HTML injection, or unauthorized postMessage protocols.
3. **Flawless Tracker Reconciliation:** `bmad_reconcile_trackers` updates `sprint-status.yaml` and `tickets.toml` with 100% syntactic validity, preserving existing file comments and structure while generating `.bak` backups before write.
4. **Resilient 5-Second Polling:** Panel state polling does not disrupt user typing, drop form focus, or cause UI flickering while users edit prompts or inspect artifacts.
5. **Path Confinement:** All file access via `bmad_inspect_artifact` and `bmad_open_artifact_file` strictly enforces workspace root confinement, rejecting any path traversal (`../`) attempts.

### Measurable User Outcomes
1. **Zero Bare Skill Recommendations:** 100% of generated next steps adhere to `/bmad-<skill> "<contextual prompt>"` format, eliminating user prompt drafting friction.
2. **Sub-5-Second Workflow Transitions:** From the moment an assistant turn finishes, the user can review the recommended prompt, click **Launch in New Session**, and begin the next phase in a clean window in under 5 seconds.
3. **Elimination of Tracker Drift:** Discrepancy between static tracker progress and actual delivered code drops to zero with one-click reconciliation.
4. **Cost-Optimal Model Allocation:** 100% of recommended tasks route to the most cost-effective capable tier (e.g., fast synthesis on Gemini Argon, deep architecture on Claude Opus).

---

## Scope

### In-Scope (`v0.5.2` MVP Boundary)

```
┌────────────────────────────────────────────────────────────────────────┐
│                         v0.5.2 MVP ARCHITECTURE                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Core Engine (scripts/bmad-engine.mjs)                               │
│    - Workspace artifact scanner (depth-limited walk of _bmad-output)   │
│    - BMAD v6 YAML and v7 TOML parser & reconciler                      │
│    - Model capability discovery and recommendation engine              │
│    - Heuristic test report and defect ledger analyzer                  │
│    - Safe persisted state (.zcode/bmad-companion/state.json)           │
├────────────────────────────────────────────────────────────────────────┤
│ 2. MCP Stdio Server (scripts/mcp-server.mjs)                           │
│    - 8 standard tools: bmad_open_companion, bmad_get_state,           │
│      bmad_update_advisor, bmad_recommend_next, bmad_reconcile_trackers,│
│      bmad_prepare_new_session, bmad_open_artifact_file,                │
│      bmad_inspect_artifact                                             │
│    - UI surface registration (ui://bmad-companion/panel.html)         │
│    - Multi-platform OS session launcher (Win32, Darwin, Linux)         │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Lifecycle Hooks (scripts/hook-runner.mjs & hooks/hooks.json)        │
│    - SessionStart: Initial state scan and model sync                   │
│    - UserPromptSubmit: Clear stale turn advisories                     │
│    - PostToolUse: Capture touched files and edits                      │
│    - Stop: Heuristic turn analysis + optional LLM turn synthesis       │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Single-File UI Cockpit (assets/panel.html)                          │
│    - 4 core tabs: Next Prompts, Phases & Epics, Catalog, Artifacts     │
│    - Light and dark theme auto-detection                               │
│    - JSON-RPC postMessage bridge with host                             │
│    - Interactive 1-click reconciliation and launch buttons             │
└────────────────────────────────────────────────────────────────────────┘
```

### Out-of-Scope (Deferred to Post-v0.5.2 Roadmap)
- **External Multi-IDE Ports:** Porting the surface outside ZCode (e.g., standard VS Code Webview or Cursor extension) is deferred until ZCode MCP App specifications stabilize.
- **Direct Git Commit/Push Automation:** The plugin inspects Git status and detects modified/untracked files, but will not automatically create commits, switch branches, or push to remotes without explicit user instruction.
- **External Package Dependencies:** Rejecting all npm dependencies (e.g., js-yaml, toml, react) to preserve zero-install velocity, instant startup, and zero security vulnerability surface.
- **Cloud Analytics or Telemetry:** No user data, prompts, or workspace paths are transmitted to external telemetry servers. All state resides locally in `.zcode/bmad-companion/`.

---

## Vision

Over the next 2–3 years, BMAD Companion will evolve from an **interactive co-pilot** into an **autonomous agentic sprint orchestrator**:

```
             EVOLUTIONARY TRAJECTORY (2026 - 2028)
             
 [v0.5.2 MVP]            [v1.0 Milestone]            [v2.0 Autonomous]
 ────────────            ────────────────            ─────────────────
 Ambient Cockpit   ───▶  Multi-Agent Dispatch  ───▶  Autonomous Sprint
 - Live panel            - Background subagents      - Auto-story build
 - Smart reconciliation  - Multi-lens code review    - Self-healing tests
 - Model advisor         - Vibe Debrief sync         - Branch/PR manager
```

1. **Autonomous Self-Driving Sprint Mode:** Rather than requiring manual "Launch in New Session" clicks for each story, BMAD Companion will coordinate with ZCode subagents (`subagent_type: "general-purpose"`) to build stories sequentially, automatically verifying tests, executing multi-lens code reviews, and updating `tickets.toml` in the background.
2. **Unified Cognitive Cockpit (Pairing with Vibe Debrief):** Deep integration with sibling plugin `vibe-debrief` (`ui://vibe-debrief/panel.html`) to present a unified dual-screen experience: BMAD Companion tracking high-level agile delivery on the right, while Vibe Debrief provides 80% STE-100 visual architecture diagrams and proof claims on the left.
3. **Semantic Architectural Drift Prevention:** Integration of AST parsing and semantic embeddings to alert developers in real-time when an implementation change violates architectural rules laid down in `ARCHITECTURE-SPINE.md` or `DESIGN.md`.

---

## Assumptions

- **A1 — ZCode MCP Surface Availability:** Assumes the host environment supports the `ui.surfaces` declaration and passes parent postMessage JSON-RPC calls (`ui/initialize`, `tools/call`) correctly to `assets/panel.html`.
- **A2 — OS-Level Clipboard & Key Automation:** Assumes standard OS scripting utilities (`powershell.exe` on Windows, `osascript` on macOS, `xdotool`/`wl-copy` on Linux) are accessible without elevated administrative restrictions for automated session launch.
- **A3 — BMAD Directory Conventions:** Assumes target workspaces adhere to standard BMAD directory naming (`_bmad-output/`, `docs/`, `sprint-status.yaml`, `tickets.toml`, `initiative-*/`).
- **A4 — Local Provider Configuration Format:** Assumes host model definitions conform to `~/.zcode/v2/provider_config.json` schema or can be supplied dynamically via `ListModels`.

---

## Open Questions

- **Q1 — Cross-Session Persistence Boundaries:** Should `.zcode/bmad-companion/state.json` track historical turns across different git branches, or reset whenever the developer switches branches?
- **Q2 — Non-Interactive / Headless CI Execution:** Should BMAD Companion provide a standalone CLI command (`node scripts/bmad-engine.mjs --reconcile`) for automated CI pipeline verification of tracker status?
- **Q3 — Configurable Model Routing Rules:** Should teams be able to define custom model routing rules (e.g., strictly force local Ollama models for story builds, reserving Claude Opus for architecture) via a `.zcode/bmad-companion/config.json` override?
