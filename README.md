# ZCode Vibe Plugins (`a2mus/zcode-vibe-plugins`)

A community ZCode plugin marketplace featuring two workspace-agnostic **right-side panel plugins** designed for visual clarity, high-ROI workflow navigation, and cost-aware AI model routing:

1. **🧭 BMAD Companion (`bmad-companion` · `v0.5.2`)** — Interactive 4-phase BMAD-METHOD lifecycle tracker, smart AI vs. static tracker reconciliation (`sprint-status.yaml` & `tickets.toml`), newest-first git diff artifact inspector, contextual `/bmad-*` prompt generator, and dynamic cost-aware model router.
2. **⚡ Vibe Debrief — Comprehension-First ELI5 Panel (`vibe-debrief` · `v0.2.0`)** — Translates the last AI turn into scannable visual cards using **80% ASD-STE100 clarity**, always-on **interactive SVG diagrams**, inline **proof & uncertainty checks**, **standalone HTML export**, **complex-only 3b1b animated explainers**, and **1-click saving of confirmed lessons** directly into ZCode's persistent `MEMORY.md`.

---

## 📦 Quick Install in ZCode

1. Open **Plugin Marketplace → Add (`+`) → Add Plugin Marketplace**.
2. Enter the GitHub repository:
   ```text
   a2mus/zcode-vibe-plugins
   ```
   *(or `https://github.com/a2mus/zcode-vibe-plugins.git`)*
3. Open **Personal → `a2mus-zcode-plugins`** and click **Install** on either or both plugins.
4. Open a **new task** to activate the right-side panels, slash commands, and hooks across all your workspaces.

> **Prerequisite:** Node.js (`node`) must be available on your system `PATH` for the local stdio MCP servers and lifecycle hooks.

---

## 🧭 1. BMAD Companion (`bmad-companion` · `v0.5.2`)

A global right-side panel for projects using **BMAD-METHOD** (v6 YAML and/or v7 TOML trackers), or any repository initializing structured AI-assisted planning:

- **Smart AI vs. Static Progress**: Cross-checks `sprint-status.yaml` and `tickets.toml` against story plans, retrospectives, and implementation reports.
- **Two-Way Tracker Reconciliation (`bmad_reconcile_trackers`)**: Preview diffs and sync verified story statuses back to static tracker files with automatic `.bak` backups.
- **Contextual Prompts + Auto New-Session Launch**: Generates editable `/bmad-* "..."` commands tailored to your project and opens a clean new ZCode session with an appropriately sized model (respecting active `ListModels` / subscription & provider state).
- **Cost-Aware Dynamic Model Routing**:
  - **Lightweight / Fast tasks** (`/bmad-help`, `/bmad-sprint-planning`, `/bmad-walkthrough`, `/bmad-project-context`) → routes to fast, cost-effective **Gemini Argon / Flash** models.
  - **UX & Visual Systems** (`/bmad-ux`, `/bmad-brainstorming`) → routes to **Gemini Hydrogen**.
  - **Agentic TDD & Builds** (`/bmad-build`, `/bmad-qa-generate-e2e-tests`) → routes to coding models.
  - **Deep Architecture & Multi-Lens Review** (`/bmad-architecture`, `/bmad-code-review`) → routes to high-reasoning flagship models.
- **Artifacts Inspector**: Collapsible 4-phase lifecycle explorer and newest-first artifact list with inline Git diff & content previews.

### Slash Commands & Skills
- `/bmad-companion` — Open and refresh the BMAD Companion panel for the active workspace.

---

## ⚡ 2. Vibe Debrief — Comprehension-First ELI5 Panel (`vibe-debrief` · `v0.2.0`)

Built for **visual learners** and **vibe-coders juggling multiple projects** who want clear perspective without reading walls of compiler or framework jargon:

- **80% ASD-STE100 Clarity (`STE-80` Toggle & Readability Meter)**: Keeps sentences short, active, and plain-verb at the human-reading boundary (`📖 ~30s · STE-80`) without constraining the coding agent mid-task.
- **Always-On Interactive SVG Diagram & Risk File Legend**: Every turn renders a clickable node-and-arrow SVG architecture/flow diagram using real component & file names, numbered edges (`① → ② → ③`), and a Node Inspector.
- **Adaptive Visual Storyboard**:
  - **🐛 Bug / Error Fix Mode**:
    1. 🔴 **What Was the Cause?**
    2. 🛠️ **What Was the Plan to Fix It?**
    3. ✅ **Did It Succeed?** *(YES / PARTIAL / NOT YET banner + inline `proofClaims`)*
    4. 🌊 **Consequences & What to Double-Check** *(Least-Certain Audit + interactive Verification Checklist)*
    5. 🧠 **Lessons Learned**
  - **🚀 Implementation Mode**:
    1. 🎯 **Purpose / Objective of the Implementation**
    2. 🧭 **Plan / Suggested Resolution & Why**
    3. 🏆 **Result of the Implementation** *(role-tagged file badges + inline `proofClaims`)*
    4. 🌊 **Consequences & What to Double-Check** *(Least-Certain Audit + interactive Verification Checklist)*
    5. 🧠 **Lessons Learned**
- **On-Demand Standalone HTML Export (`🌐 HTML` / `vibe_debrief_export_html`)**: Generates a self-contained, zero-dependency HTML explainer page under `.zcode/vibe-debrief-artifacts/`.
- **Complex-Only 3b1b Animated Explainer (`🎬 Explainer` / `vibe_debrief_generate_explainer`)**: Automatically unlocks on multi-file / multi-layer workflows with a Canvas blueprint player, optional Web Speech voiceover, and plain-text narration script.
- **4 Explainer Personas**: `🧑‍💻 Vibe Mentor`, `🎨 Visual Mapper`, `⚡ Indie Founder`, and `🧸 Pure ELI5`.
- **1-Click ZCode Memory Persistence**: Confirm any Lesson Learned (or promote a Card 4 check) in 1 click to write `<slug>.md` and update your workspace's `MEMORY.md` index automatically.
- **Cost-Aware Gemini Smart Refresh**: Includes a lightweight **⚡ Gemini Model Picker** (e.g., `gemini-4-argon` / `gemini-3.8-flash`) that delegates `✨ AI Explain` refreshes to a background Gemini session without burning expensive flagship tokens.

### Slash Commands & Skills
- `/vibe-debrief` — Simplify the last AI response and publish it to the Vibe Debrief panel.
- `/eli5` — Explain the last response with a visual, zero-jargon vibe-coder persona.

---

## 🔒 Privacy & Local-First Design

- Both plugins run **100% locally** via stdio MCP servers (`node`) and store per-workspace UI state only inside your local workspace `.zcode/` directory (or your local `~/.zcode/cli/memories/` directory when you confirm a lesson).
- Model discovery reads only your local ZCode configuration metadata (`~/.zcode/v2/`) to list enabled model IDs—no credentials, API keys, or code leave your machine through these plugins.
- Optional hook synthesis (`BMAD_COMPANION_OPENAI_KEY` / `VIBE_DEBRIEF_OPENAI_KEY`) is **disabled by default** unless you explicitly configure an environment key.

---

## 📄 License

Released under the [MIT License](LICENSE).
