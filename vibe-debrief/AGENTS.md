# AGENTS.md — Vibe Debrief (`v0.2.0`)

Repository context and engineering guardrails for AI agents working on **vibe-debrief**, a zero-dependency ZCode right-side panel plugin (`ui://vibe-debrief/panel.html`) implementing Karpathy's 4-rung comprehension framework (80% ASD-STE100 clarity, always-on SVG diagrams, inline proof/uncertainty oversight, standalone HTML export, complex-only 3b1b Canvas explainers, and ZCode `MEMORY.md` persistence).

---

## 1. Tech Stack & Runtime

- **Runtime:** Node.js ES Modules (`.mjs` files using `node:` built-in imports; tested on Node.js `v26.12.1`).
- **Dependencies:** **Zero external npm dependencies** (no `package.json` or `node_modules`). Keep it dependency-free unless explicitly approved.
- **UI:** Vanilla HTML/CSS/JS single-file MCP App (`assets/panel.html`) using inline SVG diagrams, HTML5 `<canvas>` 2D animations, and optional Web Speech API (`window.speechSynthesis`).
- **Plugin Surface:** ZCode plugin manifest (`.zcode-plugin/plugin.json`), stdio MCP server (`.mcp.json`), lifecycle hooks (`hooks/hooks.json`), slash commands (`commands/`), and skills (`skills/`).

---

## 2. Repository Layout

| Path | Responsibility |
| --- | --- |
| `.zcode-plugin/plugin.json` | Plugin metadata (`name`, `version`, `description_i18n`), component paths, and right-side UI surface (`id: "vibe-debrief"`, `resourceUri: "ui://vibe-debrief/panel.html"`). |
| `.mcp.json` | Registers the `vibe-debrief` stdio MCP server (`node "${CLAUDE_PLUGIN_ROOT}/scripts/mcp-server.mjs"`). |
| `hooks/hooks.json` | Wires `SessionStart`, `UserPromptSubmit`, `PostToolUse` (`Edit\|Write\|Bash`), and `Stop` hooks to `scripts/hook-runner.mjs`. |
| `scripts/debrief-engine.mjs` | Core domain logic: state persistence, STE-80 polish & metrics, file role/risk classification, complexity gating, SVG diagram synthesis, verification defaults, Rung 4 explainer scenes, standalone HTML export, ZCode Memory sync, and lightweight Gemini model discovery. |
| `scripts/mcp-server.mjs` | JSON-RPC 2.0 stdio MCP server exposing 8 `vibe_debrief_*` tools and the `ui://vibe-debrief/panel.html` resource. |
| `scripts/hook-runner.mjs` | CLI hook entrypoint handling `session-start`, `user-prompt`, `post-tool`, and `stop` lifecycle events via `stdin`/`stdout` JSON. |
| `assets/panel.html` | Self-contained MCP App right-side panel UI (`postMessage` JSON-RPC 2.0 bridge, Bug/Implementation views, SVG inspector, Canvas explainer player, Memory & History tabs). |
| `commands/eli5.md`, `commands/vibe-debrief.md` | Slash command definitions (`/eli5`, `/vibe-debrief`). |
| `skills/eli5/SKILL.md`, `skills/vibe-debrief/SKILL.md` | Skill instructions guiding agents on when and how to invoke `vibe_debrief_*` tools. |

---

## 3. Verified Build, Syntax & Smoke-Test Commands

There is no bundler or compiler, and `package.json` is intentionally absent. The zero-dependency `node:test` suite uses only `node:` built-ins. Verify every edit to `.mjs` files or MCP/hook wiring with the following commands:

```bash
# 1. Run the zero-dependency test suite (engine units, fixtures, MCP/hook transport)
node --test tests/

# 2. Verify ES module syntax across all backend scripts (verified: exits 0)
node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs

# 3. Smoke-test MCP server JSON-RPC handshake, tool registration, and UI resource (verified)
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25"}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n{"jsonrpc":"2.0","id":3,"method":"resources/list","params":{}}\n' | node scripts/mcp-server.mjs

# 4. Smoke-test lifecycle hook runner in session-start mode (verified)
echo '{}' | node scripts/hook-runner.mjs session-start
```

---

## 4. Architectural Boundaries

Maintain strict separation between the four runtime layers:

1. **Core Engine (`scripts/debrief-engine.mjs`)**
   - Owns all pure transformations, file I/O, state schemas, HTML artifact generation, and ZCode Memory writing.
   - Must **never** read `stdin`, write to `stdout` (breaks MCP JSON-RPC or hook JSON output), or depend on MCP transport details.
2. **MCP Transport Layer (`scripts/mcp-server.mjs`)**
   - Handles line-delimited JSON-RPC 2.0 over `stdin`/`stdout` (`initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, `resources/read`).
   - **Never** write debug logs (`console.log`) to `stdout`; `stdout` is strictly reserved for JSON-RPC frames.
   - Resolves workspace root in order: `ZCODE_WORKSPACE_ROOT` → `ZCODE_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()`.
   - Serves `assets/panel.html` with MIME `text/html;profile=mcp-app` and `_meta["zcode/csp"].unsafeEval: false`.
3. **Hook Runner (`scripts/hook-runner.mjs`)**
   - Reads hook JSON from `stdin` (fd `0`) and emits a single JSON line (`{}` or `{ additionalContext }`) to `stdout`.
   - Respects `state.agentPublishedThisTurn`: when the agent already called `vibe_debrief_publish` during the turn, `stop` only updates `lastAssistantMessage` and `turnCount` without overwriting the published debrief.
   - Optional AI synthesis (`tryOptionalAiDebriefSynthesis`) only runs if `VIBE_DEBRIEF_OPENAI_KEY` or `OPENAI_API_KEY` is set and uses a `4500ms` timeout (`AbortSignal.timeout(4500)`), falling back cleanly to `synthesizeHeuristicDebrief`.
4. **Panel UI (`assets/panel.html`)**
   - Runs inside an MCP App host iframe; communicates exclusively via `window.parent.postMessage` JSON-RPC 2.0 (`ui/initialize`, `ui/notifications/initialized`, `tools/call`, `ui/message`, and incoming `ui/notifications/host-context-changed`, `ui/notifications/tool-result`).
   - Must remain 100% self-contained (zero external `<script>`, `<link>`, or network fetches) and compliant with `unsafeEval: false` (no `eval`, `new Function`, or inline `onclick=` attributes).

---

## 5. Coding Conventions & Domain Contracts

- **ESM & Imports:** Always use `.mjs` files and explicit `node:` prefixes (`node:fs`, `node:path`, `node:os`, `node:readline`, `node:url`).
- **Reading-Boundary Principle:** Do not constrain agent reasoning or coding mid-task. Apply STE-80 clarity (`applySte100Polish`, `<= 22` words/sentence, active voice, plain verbs) only when synthesizing/publishing the debrief (`vibe_debrief_publish` or `stop` hook).
- **Always-On Diagram Contract:** Every debrief must produce a `diagram` (`buildDefaultDiagram`). Nodes are capped at 6; edges are auto-synthesized sequentially if omitted.
- **Complexity Gate (`assessWorkflowComplexity`):** Rung 4 `explainerScenes` are strictly gated to `complexity.level === "complex"` (score `>= 4` from multi-file `>= 3`, multi-layer `>= 2`, branching/5+ nodes, high-risk file, or architectural complexity), unless explicitly overridden via `complexityOverride: "complex"` or `vibe_debrief_generate_explainer`.
- **XSS & Embedded JSON Safety:** Always escape dynamic strings with `escapeHtml()` before DOM/SVG/HTML string interpolation. In `generateStandaloneHtmlArtifact`, escape `<` as `\u003c` inside embedded JSON (`payloadJson`).
- **Version Synchronization:** When bumping the plugin version, update all four locations together:
  - `.zcode-plugin/plugin.json` (`version`)
  - `scripts/mcp-server.mjs` (`serverInfo.version`)
  - `assets/panel.html` (`appInfo.version`)
  - `scripts/hook-runner.mjs` (`additionalContext` banner string)

---

## 6. Persistence & Environment Variables

- **Workspace Panel State:** `<workspaceRoot>/.zcode/vibe-debrief-state.json` (caps `history` at 15, `recentTouchedFiles` at 15, `confirmedLessons` at 50).
- **Standalone HTML Exports:** Written to `process.env.ZCODE_VISUALIZATION_DIR` if set, otherwise `<workspaceRoot>/.zcode/vibe-debrief-artifacts/vibe-debrief-<timestamp>.html`.
- **ZCode Project Memory:** `confirmAndSaveLessonToZCodeMemory` writes `<slug>.md` (YAML frontmatter + `**Why:**` + `**How to apply:**`) and updates `MEMORY.md` under `~/.zcode/cli/memories/projects/<matched-workspace-slug>/memory/` (falling back to `<workspaceRoot>/.zcode/memory/` if home memory is unwritable).
- **Optional Hook AI Synthesis Env Vars:**
  - `VIBE_DEBRIEF_OPENAI_KEY` or `OPENAI_API_KEY`
  - `VIBE_DEBRIEF_OPENAI_BASE_URL` (default `https://api.openai.com/v1`)
  - `VIBE_DEBRIEF_MODEL` (default `gemini-2.5-flash`)
- **Lightweight Model Discovery:** `discoverLightweightGeminiModels` reads `~/.zcode/v2/{provider_config,setting,credentials}.json` to rank enabled Gemini Flash/Argon models and falls back to `new-provider/gemini-3.8-flash` if unavailable.
