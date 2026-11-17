---
title: "Vibe Debrief — Product Requirements Document (PRD)"
template: prd
version: 1.1.0
status: draft
created: "2026-11-17"
updated: "2026-11-17"
---

# Vibe Debrief — Product Requirements Document (PRD)

## Table of Contents

- [Document purpose](#document-purpose) — readers, inputs, altitude, omitted template sections
- [Vision](#vision) — reading-boundary principle and 4-rung comprehension framework
- [Users and journeys](#users-and-journeys) — target builders, non-users, and `UJ-1`–`UJ-4`
- [Glossary](#glossary) — canonical domain nouns and relationships
- [Features and requirements](#features-and-requirements) — `FR-1`–`FR-28` across 8 MCP tools, 4 hooks, STE-80, SVG diagrams, complex-only 3b1b explainer, HTML export, and `MEMORY.md`
- [Rules](#rules) — `RULE-1`–`RULE-6` product-wide invariants
- [Non-goals](#non-goals) — explicit product exclusions
- [MVP scope](#mvp-scope) — `v0.2.0` baseline vs. `v0.3.0+` deferred scope
- [Success metrics](#success-metrics) — `SM-1`–`SM-5` with targets and counter-metrics
- [Quality and constraints](#quality-and-constraints) — latency, resilience, and verification thresholds
- [AI behavior and evaluation](#ai-behavior-and-evaluation) — reading boundary, model routing, fallbacks
- [API contract and versioning](#api-contract-and-versioning) — MCP JSON-RPC, hooks, 4-file version sync
- [Assumptions](#assumptions) — unconfirmed inferences awaiting validation
- [Open questions](#open-questions) — `OQ-1`–`OQ-4` with owners, timing, and blocked gates

## Document purpose

This PRD defines the functional, quality, and contract requirements for **Vibe Debrief (`v0.2.0` baseline through `v0.3.0` readiness)** so product, UX, architecture, and implementation agents build from one verifiable spec. It derives from [product-brief-vibe-debrief.md](_bmad-output/planning-artifacts/product-brief-vibe-debrief.md), [AGENTS.md](AGENTS.md), and the implemented plugin surface (`.zcode-plugin/plugin.json`, `.mcp.json`, `hooks/hooks.json`, `scripts/*.mjs`, `assets/panel.html`) at initiative altitude. Template sections unrelated to a local, zero-dependency desktop plugin (hardware, consumer migration, regulated PII compliance, multi-team rollout) are omitted.

## Vision

AI coding assistants modify multiple files faster than human developers can audit raw diffs or markdown walls. When builders skip verification because summaries take too long to read, unverified assumptions become silent regressions and recurring bugs repeat across sessions.

**Vibe Debrief** turns ZCode's right-side panel (`ui://vibe-debrief/panel.html`) into a fast comprehension cockpit governed by the **Reading-Boundary Principle**: the coding agent reasons and edits freely mid-task, and comprehension constraints apply only when publishing the turn's debrief. Each turn distills into 80% Simplified Technical English (`STE-80`), an always-on interactive SVG diagram of touched files, inline proof vs. uncertainty audits inside a 4-card narrative, on-demand standalone HTML export, complexity-gated 3b1b Canvas walkthroughs, and one-click `MEMORY.md` persistence.

## Users and journeys

### Target users & boundary

- **Primary — Multi-Project Vibe-Coders & Visual Learners in ZCode:** Solo builders switching rapidly across repos who rely on AI agents to write code and need a sub-minute spatial and causal check before the next prompt.
- **Secondary — Indie Founders & Technical Leads:** Builders balancing shipping speed with risk checks on critical paths (`auth`, `payment`, `server`, `hook`) and durable cross-session guardrails.
- **Non-users:** Developers seeking an inline code-diff editor in the sidebar, non-ZCode IDEs, or teams requiring hosted multi-user dashboards.

### Journeys

- **UJ-1. Maya isolates a bug fix without reading a stack trace.** Maya, an indie developer juggling three ZCode repos, asks why her webhook server returns `500`. The agent patches two files and calls `vibe_debrief_publish` (`responseType: "bug"`). In the right-side panel, the SVG diagram highlights the high-risk `server` node, Card 1 states the root cause in active plain English, Card 3 shows `Bash exit 0` proof, and Card 4 flags an untested retry path. Maya toggles the Card 4 check (`vibe_debrief_toggle_check`), promotes the retry guard to `MEMORY.md`, and moves on. *(Realizes `FR-3`, `FR-5`, `FR-14`, `FR-18`–`FR-21`, `FR-27`.)*
- **UJ-2. Leo steps through a multi-layer feature with the complex explainer.** Leo, a visual learner building an auth flow across UI, state, and service layers, finishes a 4-file turn. Because `assessWorkflowComplexity` scores `>= 4`, the `🎬 Explainer` tab appears next to `📊 Debrief`. Leo plays the 4-scene Canvas animation while reading the plain-text narration script below to verify each claim, then exports a standalone `.html` snapshot (`vibe_debrief_export_html`) for PR notes. Edge case: on Leo's next 1-file CSS tweak (`score < 4`), `explainerScenes` stays empty and the Explainer tab hides unless triggered on demand. *(Realizes `FR-6`, `FR-7`, `FR-22`–`FR-26`.)*
- **UJ-3. Sam triggers a cost-aware refresh when the agent skips publishing.** Sam finishes a turn where the agent replied in chat without calling `vibe_debrief_publish`. The `Stop` hook writes a heuristic fallback debrief so the panel stays current. Wanting sharper clarity, Sam selects `gemini-4-argon` and clicks `✨ AI Explain`, sending `[Vibe Debrief — Deep Refresh]` via `ui/message`. The `UserPromptSubmit` hook directs the host to delegate the debrief pass to that lightweight Gemini model via `CreateSession` instead of spending flagship reasoning tokens. *(Realizes `FR-10`, `FR-12`, `FR-13`, `RULE-6`.)*
- **UJ-4. Nora locks a rule across sessions.** Nora reviews a Lesson Learned in Section 5 (or adds one via `➕ Add Lesson`) and clicks `Confirm & Save`. `vibe_debrief_confirm_lesson` writes `<slug>.md` with YAML frontmatter under `~/.zcode/cli/memories/projects/<slug>/memory/` and updates `MEMORY.md`, immediately visible in the `🧠 Memory` tab. *(Realizes `FR-8`, `FR-27`–`FR-28`.)*

## Glossary

| Term | Definition & Relationships |
| --- | --- |
| **Debrief** | Turn comprehension snapshot (`bug` or `implementation`) holding TL;DR, analogy, `Diagram`, 4 cards, `Proof Claims`, `Uncertainty Audit`, `Verification Checklist`, optional `Explainer Scenes`, and `Lessons Learned`. Stored in `currentDebrief` and up to 15 `history` entries. |
| **Reading Boundary** | Invariant separating unconstrained mid-task coding from formatted comprehension output at `vibe_debrief_publish` or `Stop`. |
| **STE-80** | 80% ASD-STE100 readability engine: active voice, plain verbs, `<= 22` target words/sentence, scored `40–99` (`>= 80` = `STE-80`). |
| **Diagram** | Interactive SVG graph (`architecture`, `sequence`, `state-flow`, `cause-effect`) with `1–6` real-named nodes, risk metadata, and numbered edges (`1..N`). Present on 100% of debriefs. |
| **Proof Claim** | Ground-truth assertion (`1–3` in Card 3) pairing a claim with tool/file evidence and status (`verified`, `inferred`, `unverified`). |
| **Uncertainty Audit** | Epistemic warning (`1–3` in Card 4) naming where the explanation or diagram is least certain, with `riskLevel` (`low`, `medium`, `high`). |
| **Verification Checklist** | Interactive human checks (`1–4` in Card 4), persisted on toggle and promotable to `Lessons Learned`. |
| **Complexity Gate** | `assessWorkflowComplexity` score from files, layers, branching/nodes, high-risk files, and text signals; activates Rung 4 only when `score >= 4` (`complex`). |
| **Explainer Scene** | Timed Canvas step (`4–6` scenes on complex turns) with `highlightNodeIds`, callout, optional Web Speech narration, and plain-text verification script. |
| **Lesson Learned** | Reusable rule (`title`, `summary`, `why`, `howToApply`, `memoryType: feedback | project`) saved as `<slug>.md` and indexed in `MEMORY.md`. |
| **Persona** | Explanation voice (`vibe-mentor`, `visual-mapper`, `indie-founder`, `eli5-storyteller`) shaping tone without altering facts or diagram topology. |
| **Standalone HTML Artifact** | Offline, zero-dependency `.html` export of a `Debrief` saved outside the panel. |

## Features and requirements

### Feature 1 — 8-Tool MCP Server & Right-Side Panel Surface

Exposes Vibe Debrief over stdio JSON-RPC 2.0 (`scripts/mcp-server.mjs`) and serves `ui://vibe-debrief/panel.html` (`assets/panel.html`). Realizes `UJ-1`–`UJ-4`.

- **FR-1 (`vibe_debrief_open`):** An agent or host can open the panel via `vibe_debrief_open` with optional `persona` and `responseType` overrides, persisting changes and returning Markdown plus `structuredContent`.
- **FR-2 (`vibe_debrief_get_state`):** The panel or agent can read hydrated workspace state via `vibe_debrief_get_state` (`currentDebrief`, `personas`, `recommendedGeminiModel`, `lightweightGeminiModels`, `history`, `confirmedLessons`, `zcodeMemory`, `plainTextScript`), seeding a welcome debrief when no state file exists.
- **FR-3 (`vibe_debrief_publish`):** An agent can publish a debrief via `vibe_debrief_publish` (requiring `responseType` and `tldrHeadline`), applying `STE-80` polish when enabled, guaranteeing a `diagram`, evaluating `assessWorkflowComplexity`, filling default verification data when omitted, gating `explainerScenes` to `complex` turns, prepending to `history` (max 15), and setting `agentPublishedThisTurn: true`.
- **FR-4 (`vibe_debrief_set_persona`):** A user or agent can switch `persona`, `responseType`, or `ste100Enabled` via `vibe_debrief_set_persona` and receive refreshed `structuredContent`.
- **FR-5 (`vibe_debrief_toggle_check`):** A user can toggle any Card 4 checklist item by `checkId` via `vibe_debrief_toggle_check` and persist `checked` to disk.
- **FR-6 (`vibe_debrief_export_html`):** A user or agent can export the current debrief to a standalone `.html` file via `vibe_debrief_export_html`, returning path, filename, and byte size.
- **FR-7 (`vibe_debrief_generate_explainer`):** A user or agent can force on-demand animated explainer synthesis via `vibe_debrief_generate_explainer`, promoting complexity to `complex` and storing 4 scenes plus plain-text script.
- **FR-8 (`vibe_debrief_confirm_lesson`):** A user or agent can confirm a lesson via `vibe_debrief_confirm_lesson` (requiring `title` and `summary`), writing `<slug>.md`, updating `MEMORY.md`, marking the lesson confirmed, and storing up to 50 `confirmedLessons`.
- **FR-8a (Panel Bridge & Theme Sync):** `assets/panel.html` renders Bug vs. Implementation cards, SVG diagram, Node Inspector, conditional Explainer tab, Memory tab, and History tab; communicates via `window.parent.postMessage` JSON-RPC 2.0 (`ui/initialize`, `tools/call`, `ui/message`); and responds to `ui/notifications/host-context-changed` (`light`/`dark`) and `ui/notifications/tool-result`. *Out of scope:* inline diff editing or multi-turn chat inside the panel.

### Feature 2 — 4-Event Lifecycle Hook Pipeline

Synchronizes panel state automatically across ZCode turn events (`hooks/hooks.json`, `scripts/hook-runner.mjs`). Realizes `UJ-1`, `UJ-3`.

- **FR-9 (`SessionStart`):** `hook-runner.mjs session-start` emits `{ additionalContext }` stating the active persona, `STE-80` state, Reading-Boundary Principle, top discovered lightweight Gemini model, and `vibe_debrief_publish` / `vibe_debrief_confirm_lesson` rules.
- **FR-10 (`UserPromptSubmit`):** `hook-runner.mjs user-prompt` clears `recentTouchedFiles`, `lastCommandExitZero`, and `agentPublishedThisTurn`, saves `lastUserPrompt` (max 4,000 chars), and—on `[Vibe Debrief — Deep Refresh]`—injects mandatory delegation to the chosen lightweight Gemini model via `CreateSession`.
- **FR-11 (`PostToolUse` `Edit|Write|Bash`):** `hook-runner.mjs post-tool` records workspace-relative touched files (max 15) and sets `lastCommandExitZero` (`false` on error/failure/exception output without `0 error`, else `true`).
- **FR-12 (`Stop` Turn Preservation & Heuristic Fallback):** On turn stop, if `agentPublishedThisTurn` is `true`, `hook-runner.mjs stop` preserves the published `currentDebrief`, updates `lastAssistantMessage` and `turnCount`, and clears the flag; otherwise it runs `synthesizeHeuristicDebrief`.
- **FR-13 (`Stop` Optional AI Synthesis):** If `VIBE_DEBRIEF_OPENAI_KEY` or `OPENAI_API_KEY` is set and the agent skipped publishing, `stop` queries `VIBE_DEBRIEF_OPENAI_BASE_URL` (default `https://api.openai.com/v1`, model `VIBE_DEBRIEF_MODEL` default `gemini-2.5-flash`) with a `4500ms` timeout, falling back silently to heuristic synthesis on error or timeout.

### Feature 3 — STE-80 Clarity & Persona Engine

Enforces readable summaries at the reading boundary (`scripts/debrief-engine.mjs`). Realizes `UJ-1`, `UJ-3`.

- **FR-14 (`applySte100Polish`):** When enabled, replaces verbose phrasing (`utilize` → `use`, `in order to` → `to`, `subsequently` → `then`, filler prefixes), collapses whitespace, and capitalizes sentence starts across debrief prose and lessons.
- **FR-15 (`computeSte100Metrics`):** Computes `score` (`40–99`), `avgSentenceWords`, `longSentenceCount` (`> 25` words), `totalWords`, `estimatedReadSeconds`, and `grade` (`STE-80` `>= 80`, `Clear` `65–79`, `Dense` `< 65`).
- **FR-16 (Four Personas):** Supports switching among `vibe-mentor`, `visual-mapper`, `indie-founder`, and `eli5-storyteller`, updating panel subtitles and analogy tone.
- **FR-17 (Dual 4-Card Views):** Bug turns display Cause, Fix Plan, Did It Succeed? (`yes` | `partial` | `no`), and Consequences; Implementation turns display Objective & Why It Matters, Plan & Why This Way, Result & Evidence, and Consequences; both share Section 5 (Lessons Learned).

### Feature 4 — Always-On Interactive SVG Diagram & Fused Epistemic Oversight

Provides spatial context and explicit proof vs. uncertainty separation on every turn. Realizes `UJ-1`, `UJ-2`.

- **FR-18 (Always-On Diagram Synthesis):** `buildDefaultDiagram` guarantees a connected `diagram` on 100% of debriefs: normalizing explicit nodes/edges (max 6 nodes, auto-linking sequential edges if omitted), else synthesizing from `>= 2` touched files, else converting `visualFlow` steps.
- **FR-19 (File Role & Risk Classification):** `classifyFileRole` maps each file to role, icon, intent, and risk (`high` for `auth`/`migrat`/`payment`/`security`/`hook`/`server`; `medium` for UI/state/core files; `low` for tests/config/docs).
- **FR-20 (Interactive Node Inspector):** Clicking any SVG node or file chip displays its role, risk level, and file path in the Node Inspector bar.
- **FR-21 (Fused Proof, Uncertainty & Checklist):** Card 3 embeds up to 3 `proofClaims`; Card 4 embeds up to 3 `uncertaintyAudit` items and up to 4 `verificationChecklist` items (seeded by `buildDefaultVerificationData` if omitted), each promotable to a Lesson Learned in one click.

### Feature 5 — Complex-Only 3b1b Animated Explainer

Activates animated Canvas walkthroughs strictly when workflow complexity warrants them. Realizes `UJ-2`.

- **FR-22 (Complexity Gate):** `assessWorkflowComplexity` scores changed files (`>= 3` → `+2`, `>= 5` → `+3`), distinct layers (`>= 2` → `+2`, `>= 3` → `+3`), branching or `>= 5` nodes (`+2`), critical-path files (`+1`), and architectural keywords/length (`+1`). Turns with `score < 4` emit `explainerScenes: []` unless overridden via `complexityOverride: "complex"` or `vibe_debrief_generate_explainer`.
- **FR-23 (Canvas Player & Controls):** When `explainerScenes` is non-empty, `assets/panel.html` shows the `🎬 Explainer` tab with HTML5 `<canvas>` animation, Play/Pause, Prev/Next, speed (`0.85x`–`1.5x`), scene pills, and optional Web Speech voiceover.
- **FR-24 (Plain-Text Verification Script):** Both the Explainer tab and standalone HTML render `buildPlainTextScript(scenes)` with clipboard copy so users verify narration claims in plain text.

### Feature 6 — Standalone Discardable HTML Export

Produces portable offline explainers without altering project source code. Realizes `UJ-2`.

- **FR-25 (Self-Contained HTML Artifact):** `generateStandaloneHtmlArtifact` generates a single offline HTML document containing TL;DR, analogy, interactive SVG diagram + Node Inspector, 4 cards, proof/uncertainty audit, interactive checkboxes, and—when complex—Canvas player and plain-text script.
- **FR-26 (Output Path & Safe Escaping):** `saveStandaloneHtmlArtifact` writes `vibe-debrief-<timestamp>.html` to `ZCODE_VISUALIZATION_DIR` if set, else `<workspaceRoot>/.zcode/vibe-debrief-artifacts/`, escaping HTML with `escapeHtml()` and `<` inside JSON payloads as `\u003c`.

### Feature 7 — ZCode `MEMORY.md` Persistence & History Loop

Persists verified rules into ZCode's native memory directory. Realizes `UJ-4`.

- **FR-27 (Memory Resolution & Write):** `resolveZCodeMemoryDirectory` resolves `~/.zcode/cli/memories/projects/<matched-slug>/memory/` (falling back to `<workspaceRoot>/.zcode/memory/` if unwritable), writes `<slug>.md` with YAML frontmatter plus `**Why:**` and `**How to apply:**`, and idempotently updates `MEMORY.md`.
- **FR-28 (Bounded State & Tabs):** `.zcode/vibe-debrief-state.json` caps `history` at 15, `recentTouchedFiles` at 15, and `confirmedLessons` at 50; `🧠 Memory` and `🕒 History` tabs inspect live `MEMORY.md` content and past turns.

## Rules

- **RULE-1 (Reading-Boundary Principle):** Never constrain agent reasoning or coding mid-task; enforce `STE-80` only at `vibe_debrief_publish`, `Stop` synthesis, or memory persistence.
- **RULE-2 (Zero External Dependencies & ESM):** Backend scripts use Node.js `.mjs` with `node:` built-ins only (no `package.json` or `npm` packages); `assets/panel.html` and HTML exports load zero external scripts, styles, or fonts.
- **RULE-3 (CSP & XSS Safety):** `assets/panel.html` enforces `_meta["zcode/csp"].unsafeEval: false` with no `eval`, `new Function`, or inline `onclick=`; all dynamic HTML/SVG strings use `escapeHtml()`, and embedded JSON escapes `<` as `\u003c`.
- **RULE-4 (Stdout Isolation):** `mcp-server.mjs` and `hook-runner.mjs` reserve `stdout` strictly for JSON-RPC 2.0 or single-line hook JSON; `debrief-engine.mjs` never reads `stdin` or writes `stdout`.
- **RULE-5 (4-File Version Sync):** Every version bump updates `.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs` (`serverInfo.version`), `assets/panel.html` (`appInfo.version`), and `scripts/hook-runner.mjs` (`additionalContext`) together.
- **RULE-6 (Cost-Aware Gemini Delegation):** `[Vibe Debrief — Deep Refresh]` selects enabled lightweight Gemini models from `~/.zcode/v2/` (`discoverLightweightGeminiModels`, fallback `new-provider/gemini-3.8-flash`) via `CreateSession` instead of flagship models.

## Non-goals

- **Inline Diff Editing:** No file editing, hunk staging, or IDE diff replacement inside the panel.
- **Always-On Video Clutter:** Simple 1–2 file turns never auto-generate Canvas animations.
- **In-Panel Multi-Turn Chat:** Follow-up AI requests dispatch via `ui/message` to the host ZCode session.
- **Multi-IDE / Hosted SaaS:** No non-ZCode IDE adapters, cloud backends, or multi-user telemetry.

## MVP scope

### In Scope (`v0.2.0` Baseline)

- Four decoupled layers (`debrief-engine.mjs`, `mcp-server.mjs`, `hook-runner.mjs`, `panel.html`) implementing all 8 MCP tools, 4 lifecycle hooks, `STE-80` engine, 4 personas, always-on SVG diagrams, fused proof/uncertainty/checklist cards, standalone HTML export, complex-only 3b1b Canvas explainer, `MEMORY.md` sync, and `/vibe-debrief` + `/eli5` commands/skills.

### Deferred Beyond `v0.2.0` (`v0.3.0+`)

- **Zero-Dependency `node --test` Suite:** Unit tests for `debrief-engine.mjs` (`OQ-2`).
- **Cross-Turn Architecture Diff Maps & Live CI Calibration:** Multi-turn boundary drift graphs and binding `proofClaims` directly to structured test runner outputs.
- **Team Onboarding Handbooks:** Bundling `MEMORY.md` lessons and exported HTML artifacts for repository handoffs.

## Success metrics

| ID | Metric | Current Baseline | Target | Validates | Counter-Metric |
| --- | --- | --- | --- | --- | --- |
| **SM-1** | **Diagram & Oversight Coverage** | `v0.2.0` smoke checks pass (`node --check`, MCP handshake) | 100% of `publish` & `Stop` turns yield valid `diagram`, `proofClaims`, `uncertaintyAudit`, `verificationChecklist` with 0 stdout corruptions | `FR-3`, `FR-12`, `FR-18`, `FR-21` | `Stop` hook latency (`<= 50ms` heuristic; `<= 4500ms` AI) |
| **SM-2** | **Complexity Gate Precision** | `score >= 4` gate implemented | 0% of simple single-file turns auto-render `explainerScenes`; 100% of `score >= 4` multi-file/layer turns unlock Explainer tab | `FR-22`, `FR-23` | On-demand `generate_explainer` rate (spikes signal under-triggering) |
| **SM-3** | **Readability Compliance** | `[ASSUMPTION: Real-turn STE-80 median unmeasured]` | `>= 85%` of published debriefs score `>= 80` (`STE-80`, `<= 22` avg words/sentence) | `FR-14`, `FR-15` | Follow-up clarifying prompts from over-truncated detail |
| **SM-4** | **Human Review Speed** | `[ASSUMPTION: 20-min manual diff baseline unmeasured]` | Builders audit multi-file turn impact and Card 4 checks in `<= 60s` | `FR-17`, `FR-20`, `FR-21` | Post-approval regression rate |
| **SM-5** | **Memory & Cost Discipline** | `[ASSUMPTION: Telemetry not collected]` | `>= 1` `MEMORY.md` lesson confirmed per recurring bug class; `100%` of `AI Explain` refreshes route to lightweight Gemini models | `FR-8`, `FR-10`, `FR-27`, `RULE-6` | `MEMORY.md` bloat (concise 1-line index only; max 50 records) |

## Quality and constraints

- **Timeout Bounds:** Panel RPC requests enforce `15,000ms` timeout; optional `Stop` AI synthesis enforces `AbortSignal.timeout(4500)` (`FR-13`).
- **Storage Resilience:** Missing `.zcode/vibe-debrief-state.json` initializes to `createWelcomeDebrief`; read-only workspaces ignore write failures cleanly; unwritable `~/.zcode/cli/memories` falls back to `<workspaceRoot>/.zcode/memory/` (`FR-2`, `FR-27`).
- **Verification Gate:** Every `.mjs` edit must pass `node --check`, MCP stdio `initialize`/`tools/list`/`resources/list` handshake, and `hook-runner.mjs session-start` execution (`RULE-2`, `RULE-4`).

## AI behavior and evaluation

- **Reading-Boundary Discipline (`RULE-1`):** Agents never omit technical precision while coding; `STE-80` applies strictly at `vibe_debrief_publish` and hook synthesis.
- **Evidence-Backed Proof:** `proofClaims` marked `verified` must cite observed tool or file results; unrun tests belong in `uncertaintyAudit` (`FR-21`).
- **Fallbacks:** When `VIBE_DEBRIEF_OPENAI_KEY` and `OPENAI_API_KEY` are absent, or when the `4500ms` request fails, `hook-runner.mjs stop` falls back to `synthesizeHeuristicDebrief`. When `~/.zcode/v2/` yields no enabled Gemini model, `discoverLightweightGeminiModels` defaults to `new-provider/gemini-3.8-flash` (`FR-10`, `FR-13`, `RULE-6`).

## API contract and versioning

- **MCP JSON-RPC (`scripts/mcp-server.mjs`):** Stdio JSON-RPC 2.0 (`protocolVersion: "2025-11-25"`) supporting `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, and `resources/read`. All 8 tools bind `_meta.ui.surface: "vibe-debrief"` and `resourceUri: "ui://vibe-debrief/panel.html"` (`text/html;profile=mcp-app`, `unsafeEval: false`).
- **Workspace Precedence:** `ZCODE_WORKSPACE_ROOT` → `ZCODE_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()` (`hook-runner.mjs` checks `payload.cwd` first).
- **Hook Contract (`hooks/hooks.json`):** `SessionStart`, `UserPromptSubmit`, `PostToolUse` (`Edit|Write|Bash`), and `Stop` invoke `hook-runner.mjs` and emit `{}` or `{ additionalContext }`.
- **Versioning:** SemVer (`0.2.0`) synchronized across 4 files (`RULE-5`); additive state/payload fields remain backward-compatible via `ensureDebriefEnriched` and `createDefaultState`.

## Assumptions

- **Target review speed (`SM-4`):** The `<= 60s` target and 2-minute vs. 20-minute framing reflect design intent, not measured user benchmarks.
- **Host capabilities:** Assumes ZCode provides MCP App `postMessage` (`2026-01-26`), `ui/message`, `ZCODE_VISUALIZATION_DIR` or `.zcode/`, and `~/.zcode/v2/` provider configs.
- **Heuristic sufficiency (`FR-12`):** Assumes `synthesizeHeuristicDebrief` + `buildDefaultDiagram` give adequate baseline structure when `vibe_debrief_publish` and `VIBE_DEBRIEF_OPENAI_KEY` are skipped.
- **Readability feasibility (`SM-3`):** Assumes `>= 85%` of real-turn debriefs can reach `STE-80` (`score >= 80`) without losing critical technical identifiers.

## Open questions

| ID | Question | Owner | Needed By | Blocks |
| --- | --- | --- | --- | --- |
| **OQ-1** | Which behavioral signal should gate `v0.3.0`: checklist interaction rate, `MEMORY.md` confirmation rate, or reduced repeat-bug rate? | Product Owner | Before `v0.3.0` planning | `SM-4`, `SM-5` |
| **OQ-2** | Should `v0.3.0` add a zero-dependency `node --test` suite (`tests/*.test.mjs`) for `debrief-engine.mjs` while keeping zero `npm` dependencies? | Tech Lead / Architect | Before `v0.3.0` epics | `RULE-2`, `FR-14`–`FR-28` regression gates |
| **OQ-3** | Should `Stop` hook optional AI synthesis (`VIBE_DEBRIEF_OPENAI_KEY`) remain alongside `vibe_debrief_publish` + `CreateSession` delegation, or be deprecated? | Tech Lead / Product Owner | `v0.3.0` architecture | `FR-13`, `RULE-6` |
| **OQ-4** | Should `v0.3.0` add an automated check enforcing the 4-file version sync (`RULE-5`)? | Tech Lead | `v0.3.0` release | `RULE-5` |
