---
title: "Vibe Debrief — Product Brief"
template: brief
version: 1.1.0
status: draft
created: "2026-11-17"
updated: "2026-11-17"
---

# Vibe Debrief — Product Brief

## Table of Contents

- [Executive summary](#executive-summary) — product thesis, 4-rung comprehension framework, reading-boundary model
- [Problem](#problem) — wall-of-text review fatigue, unverified AI claims, lost cross-session lessons
- [Solution](#solution) — right-side MCP App panel, Bug vs. Implementation cards, STE-80 + SVG + Memory loop
- [What makes it different](#what-makes-it-different) — reading-boundary principle, complexity-gated animation, zero dependencies
- [Who it serves](#who-it-serves) — multi-project vibe-coders, visual learners, solo indie builders
- [Success criteria](#success-criteria) — verifiable v0.2.0 technical gates and checkable user outcomes
- [Scope](#scope) — v0.2.0 MVP boundary vs. deferred capabilities
- [Vision](#vision) — grounded 2–3 year evolution for AI-assisted comprehension
- [Assumptions](#assumptions) — unconfirmed inferences tagged for user confirmation
- [Open questions](#open-questions) — unresolved product and validation calls

## Executive summary

**Vibe Debrief (`v0.2.0`)** is a zero-dependency ZCode right-side panel plugin (`ui://vibe-debrief/panel.html`) that turns dense AI coding responses into scannable, visually grounded comprehension briefs. Built around Andrej Karpathy's 4-rung comprehension framework, it pairs 80% Simplified Technical English (`STE-80`), an always-on interactive SVG architecture diagram, inline proof and uncertainty audits, standalone HTML export, complexity-gated animated walkthroughs, and one-click persistence into ZCode's `MEMORY.md`.

AI coding agents ship changes across multiple files faster than humans can read long markdown walls or raw stack traces. When developers rubber-stamp opaque diffs, silent bugs recur across sessions and project architecture drifts out of the builder's mental model. Vibe Debrief solves this at the **human-reading boundary**: the coding agent reasons and edits without constraint mid-task, and only the final debrief is distilled into a structured visual cockpit.

The `v0.2.0` MVP is already architected across four decoupled layers—core engine (`scripts/debrief-engine.mjs`), stdio MCP server with 8 tools (`scripts/mcp-server.mjs`), 4 lifecycle hooks (`scripts/hook-runner.mjs`), and a CSP-safe single-file UI (`assets/panel.html`). This brief defines the target users, problem boundary, differentiation, and tight scope needed to validate and evolve the plugin from a working `v0.2.0` release into a reliable daily oversight companion.

## Problem

Fast-moving developers using AI coding assistants often juggle several projects or unfamiliar stacks at once. Every nontrivial turn produces long prose explanations, multi-file edits, and terminal logs that create three compounding costs:

1. **Comprehension bottleneck ("wall-of-text fatigue"):** Reading dense markdown summaries and nested diffs after every prompt slows momentum. Visual thinkers struggle to reconstruct which component changed, why that path was chosen, and how data flows across layers.
2. **Epistemic blind spots:** AI summaries frequently blend verified facts (a command exited `0`) with unverified guesses (an untested edge case). Without explicit separation between proof and uncertainty, developers either trust risky edits blindly or waste time re-auditing every line.
3. **Amnesia across sessions:** Hard-won debugging discoveries and architectural guardrails stay buried in scrolled chat transcripts instead of becoming durable project rules, causing the agent to repeat the same mistakes in later sessions.

*Evidence note:* This problem framing is derived from `AGENTS.md`, `README.md`, and the implemented `v0.2.0` architecture (`scripts/debrief-engine.mjs`). Direct user-interview data and quantified baseline review times are not yet recorded in the repository (see [Assumptions](#assumptions) and [Open questions](#open-questions)).

## Solution

Vibe Debrief embeds a persistent **Vibe Debrief (ELI5)** panel alongside the ZCode chat, automatically updating after turns via lifecycle hooks (`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`) or explicit `vibe_debrief_publish` calls. It transforms each response into a consistent, low-clutter visual debrief:

- **Rung 1 — STE-80 Prose & Persona Lens:** Tightens explanations at the reading boundary (`applySte100Polish`, targeting `<= 22` words per sentence, active voice, plain verbs) with a live readability badge (`STE-80`, estimated reading seconds) and four selectable personas (`Vibe Mentor`, `Visual Mapper`, `Indie Founder`, `Pure ELI5`).
- **Rung 2 — Always-On Interactive SVG Diagram & Fused Oversight:** Every Bug Fix (`responseType: "bug"`) and Implementation (`responseType: "implementation"`) turn renders a node-and-arrow SVG diagram (capped at 6 nodes) using real file names, risk colors, and a click-to-inspect Node Inspector. Epistemic safety is fused directly into the 4-card flow: Card 3 embeds `proofClaims` backed by tool/file evidence, while Card 4 embeds `uncertaintyAudit` and an interactive `verificationChecklist`.
- **Rung 3 — On-Demand Standalone HTML Export:** Exports a self-contained, zero-dependency `.html` explainer artifact (via `vibe_debrief_export_html`) for offline sharing, archiving, or deep inspection.
- **Rung 4 — Complex-Only 3b1b Canvas Explainer:** `assessWorkflowComplexity` gates animated HTML5 `<canvas>` walkthrough scenes (and plain-text narration script / optional Web Speech voiceover) strictly to multi-file, multi-layer, or branching workflows (`score >= 4`), keeping simple turns fast and uncluttered.
- **Closed Memory Loop:** Any Lesson Learned—or promoted Card 4 checklist item—saves in one click (`vibe_debrief_confirm_lesson`) as a structured `<slug>.md` file indexed in ZCode's `MEMORY.md`.

## What makes it different

| Alternative | Limitation | Vibe Debrief Advantage |
| --- | --- | --- |
| **Raw AI chat summaries** | Unbounded prose, mixed facts/guesses, no spatial diagram | **Reading-Boundary Principle:** Agent codes freely; panel enforces STE-80 + SVG + separated proof vs. uncertainty |
| **Git diff / IDE file tree** | Shows *what* lines changed, not *why*, *how* layers connect, or what stayed untested | **4-Card Causal Narrative + Risk Legend:** Maps touched files to roles (`UI`, `State`, `Core`, `Test`) and risk levels |
| **Always-on video / heavy explainer tools** | Slow, noisy, and distracting on small 1-file fixes | **Strict Complexity Gate:** Rung 4 Canvas animation activates only when `complexity.level === "complex"` (or explicitly triggered) |
| **Heavy external web apps / npm plugins** | Dependency bloat, CSP friction, slow startup, extra API spend | **Zero-Dependency & Cost-Aware:** Pure Node.js `.mjs` + vanilla HTML/SVG/Canvas (`unsafeEval: false`), plus lightweight Gemini Flash/Argon discovery for smart refresh |

## Who it serves

- **Primary — Multi-Project Vibe-Coders & Visual Learners in ZCode:** Solo builders and engineers switching rapidly between repositories who rely on AI agents to write most code, but need a 30-second spatial and causal check before accepting changes or moving on.
- **Secondary — Indie Founders & Technical Leads Reviewing AI Changes:** Builders prioritizing shipping speed with high-ROI safety checks—verifying critical-path files (`auth`, `payment`, `server`, `hook`), tracking what still lacks test coverage, and locking recurring rules into `MEMORY.md`.

## Success criteria

Success combines **verifiable technical contracts** (grounded in `AGENTS.md`) with **user comprehension outcomes** (to be validated with real ZCode users):

1. **100% Diagram & Audit Coverage:** Every `vibe_debrief_publish` and `Stop` hook turn produces a connected `diagram`, `proofClaims`, `uncertaintyAudit`, and `verificationChecklist` without crashing MCP stdio framing (`node --check` and MCP handshake pass cleanly).
2. **Noise-Free Complexity Gating:** Single-file/simple turns (`complexity.score < 4`) omit `explainerScenes`, reserving Canvas animation for multi-file (`>= 3`), multi-layer (`>= 2`), or branching workflows.
3. **Zero-Dependency & CSP Compliance:** Zero external `npm` packages; `assets/panel.html` and exported HTML artifacts operate offline with `unsafeEval: false` and safe HTML/JSON escaping.
4. **Cost-Aware Smart Refresh:** `[Vibe Debrief — Deep Refresh]` actions discover and delegate to lightweight Gemini Flash/Argon models rather than flagship reasoning models.
5. **Adoption & Review Speed (Target Outcome — Unverified):** Builders review a multi-file turn via the panel in under 60 seconds, maintain `STE-80` readability (`score >= 80`), and confirm recurring lessons into `MEMORY.md`.

## Scope

### In Scope (`v0.2.0` MVP)

- **Core Engine (`scripts/debrief-engine.mjs`):** State persistence (`.zcode/vibe-debrief-state.json`), STE-80 polish & readability metrics, file role/risk classification, complexity gating, SVG diagram synthesis, Rung 4 scene builder, standalone HTML export, `MEMORY.md` sync, and lightweight Gemini model discovery.
- **MCP Transport (`scripts/mcp-server.mjs`):** Stdio JSON-RPC 2.0 server exposing `ui://vibe-debrief/panel.html` and 8 tools (`vibe_debrief_open`, `vibe_debrief_get_state`, `vibe_debrief_publish`, `vibe_debrief_set_persona`, `vibe_debrief_toggle_check`, `vibe_debrief_export_html`, `vibe_debrief_generate_explainer`, `vibe_debrief_confirm_lesson`).
- **Lifecycle Hooks (`scripts/hook-runner.mjs` & `hooks/hooks.json`):** `SessionStart`, `UserPromptSubmit`, `PostToolUse` (`Edit|Write|Bash`), and `Stop` (heuristic synthesis + optional 4500ms OpenAI-compatible AI synthesis).
- **Self-Contained Panel UI (`assets/panel.html`):** Light/dark theme support, Bug vs. Implementation views, interactive SVG diagram + Node Inspector, inline proof & uncertainty checklist, Canvas explainer player with Web Speech & narration script, History tab, and Memory tab.
- **Slash Commands & Skills:** `/vibe-debrief` and `/eli5` commands and skill definitions.

### Out of Scope (Deferred Beyond `v0.2.0`)

- External `npm` dependencies, bundlers, or remote CDN assets.
- Multi-IDE adapters outside the ZCode MCP App surface (`ui://vibe-debrief/panel.html`) and ZCode `MEMORY.md` convention.
- Automated unit/E2E test runner suite (currently verified via syntax checks and stdio/hook smoke tests per `AGENTS.md`).
- Multi-user cloud collaboration, hosted dashboards, or inline code-editing/diff-patching from inside the panel.
- Bidirectional multi-turn chat inside the panel (interactions use `ui/message` prompts back to the host session).

## Vision

Over the next 2–3 years, Vibe Debrief can evolve from a single-turn comprehension cockpit into an **epistemic safety layer for AI-native software engineering**:

- **Cross-Turn Architecture Diff Maps:** Show how the current turn's SVG component graph shifts the repository's longer-term module boundaries over a full feature or sprint.
- **Live Test-Signal Calibration:** Automatically cross-check AI claims against verified `node --test` / CI / linter outputs so `proofClaims` never rely on prose assertions.
- **Portable Team & Repo Handbooks:** Turn confirmed `MEMORY.md` lessons and exported HTML artifacts into living, visual onboarding walkthroughs for anyone picking up an AI-built codebase.

*(Settled out: `## The ask` — this brief documents an open-source ZCode plugin already implemented at `v0.2.0` rather than pitching external sponsor funding.)*

## Assumptions

- **Target review speed:** The 30–60 second target review time and 2-minute vs. 20-minute framing (referenced in welcome copy) reflect design intent rather than measured user-study benchmarks.
- **Single-developer ZCode workflow:** Assumes the primary user operates inside ZCode with MCP App right-side panels and local `~/.zcode/cli/memories/projects/` storage enabled.
- **Heuristic fallback sufficiency:** Assumes `synthesizeHeuristicDebrief` + `buildDefaultDiagram` provide useful baseline diagrams when the coding agent skips calling `vibe_debrief_publish` and `VIBE_DEBRIEF_OPENAI_KEY` is unset.

## Open questions

1. **Primary validation metric:** Which concrete user signal should gate `v0.3.0`—checklist interaction rate, `MEMORY.md` lesson confirmation rate, or reduced repeat-bug rate across sessions?
2. **Automated test investment:** Given `AGENTS.md` notes the absence of `package.json` and automated tests, should `v0.3.0` add a zero-dependency `node --test` suite for `debrief-engine.mjs` (STE-80 scoring, complexity gating, XSS escaping, and memory writes)?
3. **Hook AI synthesis vs. agent publishing:** Should the `Stop` hook keep optional `VIBE_DEBRIEF_OPENAI_KEY` synthesis, or rely exclusively on agent-side `vibe_debrief_publish` + lightweight `CreateSession` delegation?
