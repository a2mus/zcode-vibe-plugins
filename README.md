# ZCode Vibe Plugins (`a2mus/zcode-vibe-plugins`)

A community ZCode plugin marketplace featuring two workspace-agnostic **right-side panel plugins** designed for visual clarity, high-ROI workflow navigation, and cost-aware AI model routing:

1. **🧭 BMAD Companion (`bmad-companion`)** — Interactive 4-phase BMAD-METHOD lifecycle tracker, smart AI vs. static tracker reconciliation (`sprint-status.yaml` & `tickets.toml`), git diff artifact inspector, contextual `/bmad-*` prompt generator, and cost-aware model router.
2. **⚡ Vibe Debrief — Visual ELI5 Panel (`vibe-debrief`)** — Translates the last AI turn into scannable visual cards for visual learners and multi-project vibe-coders, with persona switching and 1-click saving of confirmed lessons directly into ZCode's persistent `MEMORY.md`.

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

## 🧭 1. BMAD Companion (`bmad-companion`)

A global right-side panel for projects using **BMAD-METHOD** (v6 YAML and/or v7 TOML trackers), or any repository initializing structured AI-assisted planning:

- **Smart AI vs. Static Progress**: Cross-checks `sprint-status.yaml` and `tickets.toml` against story plans, retrospectives, and implementation reports.
- **Two-Way Tracker Reconciliation (`bmad_reconcile_trackers`)**: Preview diffs and sync verified story statuses back to static tracker files with automatic `.bak` backups.
- **Contextual Prompts + Auto New-Session Launch**: Generates editable `/bmad-* "..."` commands tailored to your project and opens a clean new ZCode session with an appropriately sized model.
- **Cost-Aware Dynamic Model Routing**:
  - **Lightweight / Fast tasks** (`/bmad-help`, `/bmad-sprint-planning`, `/bmad-walkthrough`, `/bmad-project-context`) → routes to fast, cost-effective **Gemini Argon / Flash** models.
  - **UX & Visual Systems** (`/bmad-ux`, `/bmad-brainstorming`) → routes to **Gemini Hydrogen**.
  - **Agentic TDD & Builds** (`/bmad-build`, `/bmad-qa-generate-e2e-tests`) → routes to coding models.
  - **Deep Architecture & Multi-Lens Review** (`/bmad-architecture`, `/bmad-code-review`) → routes to high-reasoning flagship models.
- **Artifacts Inspector**: Collapsible 4-phase lifecycle explorer and newest-first artifact list with inline Git diff & content previews.

### Slash Commands & Skills
- `/bmad-companion` — Open and refresh the BMAD Companion panel for the active workspace.

---

## ⚡ 2. Vibe Debrief — Visual ELI5 Panel (`vibe-debrief`)

Built for **visual learners** and **vibe-coders juggling multiple projects** who want clear perspective without reading walls of compiler or framework jargon:

- **Adaptive Visual Storyboard**:
  - **🐛 Bug / Error Fix Mode**:
    1. 🔴 **What Was the Cause?**
    2. 🛠️ **What Was the Plan to Fix It?**
    3. ✅ **Did It Succeed?** *(YES / PARTIAL / NOT YET visual banner)*
    4. 🌊 **Consequences of This Fix**
    5. 🧠 **Lessons Learned**
  - **🚀 Implementation Mode**:
    1. 🎯 **Purpose / Objective of the Implementation**
    2. 🧭 **Plan / Suggested Resolution & Why**
    3. 🏆 **Result of the Implementation** *(with role-tagged touched file badges)*
    4. 🌊 **Consequences & 🧠 Lessons Learned**
- **4-Step Visual Cause-to-Outcome Map** & **💡 Picture It Like This** real-world analogy box.
- **4 Explainer Personas**: `🧑‍💻 Vibe Mentor`, `🎨 Visual Mapper`, `⚡ Indie Founder`, and `🧸 Pure ELI5`.
- **1-Click ZCode Memory Persistence**: Click **`📌 Confirm & Save to ZCode Memory`** on any lesson (or add your own) to write `<slug>.md` and update your workspace's `MEMORY.md` index automatically.
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
