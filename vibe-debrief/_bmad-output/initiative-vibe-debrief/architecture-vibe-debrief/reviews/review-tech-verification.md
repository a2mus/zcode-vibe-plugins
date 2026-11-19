# Architecture Gate Review — Tech Verification Lens

- **Target Artifact:** `D:\Developpement\Projets\Zcode plugins\vibe-debrief\_bmad-output\initiative-vibe-debrief\architecture-vibe-debrief\architecture-vibe-debrief.md`
- **Baseline Verified Against:** `AGENTS.md`, `.zcode-plugin/plugin.json`, `.mcp.json`, `hooks/hooks.json`, `scripts/debrief-engine.mjs`, `scripts/mcp-server.mjs`, `scripts/hook-runner.mjs`, `assets/panel.html`, and live ZCode host plugin environment (`~/.zcode/cli/plugins/cache/`)
- **Reviewer Role:** Tech Verification Reviewer
- **Date:** 2026-11-18
- **Verdict:** **PASS WITH MINOR NOTES** (0 Critical, 0 High, 2 Medium, 3 Low)

---

## 1. Stack, Protocol & Runtime Verification Summary

| Committed Technology / Decision | Architecture Claim | Brownfield / Environment Reality | Status |
| --- | --- | --- | --- |
| **Node.js ESM Runtime (`Stack`, `AD-4`)** | Node.js `>= 20` (`node:test` stable, `node:assert/strict`, `node:child_process`, built-in `fetch`, `AbortSignal.timeout(4500)`); tested on `v26.12.1` | Confirmed in `AGENTS.md` (`v26.12.1`) and `scripts/hook-runner.mjs:58,81` (`fetch`, `AbortSignal.timeout(4500)`). Note: previous review's `Node >= 20` recommendation is now reflected in `Stack` line 365. | Verified |
| **Zero External Dependencies (`AD-4`)** | No `package.json`, no `node_modules`, zero external `<script>`/`<link>`/CDN in `panel.html` and HTML artifacts | Confirmed: repository has no `package.json` or `node_modules`; `assets/panel.html` and `generateStandaloneHtmlArtifact` in `scripts/debrief-engine.mjs` are 100% self-contained. | Verified |
| **MCP Stdio Protocol (`AD-1`, `Stack`)** | `protocolVersion: "2025-11-25"`, JSON-RPC 2.0 over `stdin`/`stdout`, 8 tools, 1 resource (`ui://vibe-debrief/panel.html`, `text/html;profile=mcp-app`, `_meta["zcode/csp"].unsafeEval: false`) | Confirmed in `scripts/mcp-server.mjs:25-27, 135-505, 873, 924-954`. | Verified |
| **MCP App Iframe Bridge (`AD-9`, `Stack`)** | `PROTOCOL_VERSION = "2026-01-26"` via `window.parent.postMessage`, `15,000ms` timeout, `ui/initialize`, `ui/notifications/initialized`, `tools/call`, `ui/message`, `host-context-changed`, `tool-result` | Confirmed in `assets/panel.html:1166, 1183-1244, 2160, 2211-2228`. | Verified |
| **Browser Built-In APIs (`Stack`)** | Inline SVG, HTML5 `<canvas>` 2D (`roundRect` with `rect` fallback), Web Speech API (`window.speechSynthesis`, `SpeechSynthesisUtterance`), Clipboard API (`navigator.clipboard.writeText`) | Confirmed in `assets/panel.html:1750-1834, 2119-2127` (`ctx.roundRect` fallback at line 1829). | Verified |
| **4-File Version Synchronization (`AD-8`)** | `.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs`, `assets/panel.html`, `scripts/hook-runner.mjs` | Confirmed all 4 locations currently at `0.2.0` (`plugin.json:3`, `mcp-server.mjs:880`, `panel.html:2214`, `hook-runner.mjs:109`). | Verified |
| **ZCode Config & Memory Paths (`AD-5`)** | `~/.zcode/v2/{provider_config,setting,credentials}.json` and `~/.zcode/cli/memories/projects/<slug>/memory/MEMORY.md` | Confirmed in `scripts/debrief-engine.mjs:1315-1350, 1475-1555`. | Verified |
| **External Visual Plugins (`AD-5`, `AD-17`)** | `excalidraw`, `visualize`, `vectorcraft`, `designcraft` discovered under `~/.zcode/cli/plugins/` | Confirmed in live ZCode environment (`excalidraw 0.3.4`, `visualize 0.1.2`, and `design 0.7.2` providing `vectorcraft`/`designcraft` MCP tools). See `[MEDIUM-1]` for packaging detail. | Verified with note |

---

## 2. Findings

### [MEDIUM-1] External Visual Plugin Packaging & Skill-vs-MCP Distinction (`AD-5`, `AD-17`)
- **Location:** `architecture-vibe-debrief.md` (`AD-5` line 109, `AD-17` lines 246–250)
- **Evidence:** `AD-5` specifies that `discoverInstalledVisualPlugins` inspects `~/.zcode/cli/plugins/` and project skills to return `installedVisualPlugins: string[]` (`"excalidraw"`, `"visualize"`, `"vectorcraft"`, `"designcraft"`). Reality-checking against the live ZCode plugin cache (`~/.zcode/cli/plugins/cache/zcode-plugins-official/`) shows two structural nuances:
  1. `excalidraw` (`zcode-plugins-official/excalidraw/0.3.4`) and `visualize` (`zcode-plugins-official/visualize/0.1.2`) are top-level plugin folders, whereas `vectorcraft` and `designcraft` MCP servers (`mcp__plugin_vectorcraft_vectorcraft__*`, `mcp__plugin_designcraft_designcraft__*`) are bundled inside the official `design` plugin (`zcode-plugins-official/design/0.7.2`) or as standalone plugin entries.
  2. `visualize` is a skill-only plugin (`skills/visualize/SKILL.md`, no MCP server), whereas `excalidraw`, `vectorcraft`, and `designcraft` expose MCP servers.
- **Impact:** If `discoverInstalledVisualPlugins` only matches top-level plugin folder names against `["excalidraw", "visualize", "vectorcraft", "designcraft"]`, it will miss `vectorcraft` and `designcraft` when installed via the official `design` plugin.
- **Fix / Build Guidance:** Ensure `discoverInstalledVisualPlugins` in `scripts/debrief-engine.mjs` checks top-level plugin directory names, maps the official `design` plugin (or `.mcp.json` server keys) to `"vectorcraft"` and `"designcraft"`, and formats `stage2Prompt` in `AD-17` so the host agent can invoke either the `visualize` skill or the `excalidraw`/`vectorcraft` MCP tools via `ui/message`.

### [MEDIUM-2] Workspace Root Env Var Resolution Asymmetry in `hook-runner.mjs` (`Consistency Conventions`, `AD-5`)
- **Location:** `architecture-vibe-debrief.md` (`Consistency Conventions` line 358) vs. `scripts/hook-runner.mjs:96-101`
- **Evidence:** The architecture states workspace root resolves in order `ZCODE_WORKSPACE_ROOT → ZCODE_PROJECT_DIR → CLAUDE_PROJECT_DIR → process.cwd() (hook-runner.mjs checks payload.cwd first)`. In the brownfield repository, `scripts/mcp-server.mjs:31-35` checks `process.env.ZCODE_WORKSPACE_ROOT`, but `scripts/hook-runner.mjs:96-101` currently resolves `payload.cwd || process.env.ZCODE_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd()` (omitting `process.env.ZCODE_WORKSPACE_ROOT`).
- **Impact:** If a hook is invoked without `payload.cwd` in an environment where only `ZCODE_WORKSPACE_ROOT` is set, `hook-runner.mjs` and `mcp-server.mjs` could read/write different `.zcode/vibe-debrief-state.json` paths.
- **Fix / Build Guidance:** Add `process.env.ZCODE_WORKSPACE_ROOT` immediately after `payload.cwd` in `scripts/hook-runner.mjs`.

### [LOW-1] MCP Tool `inputSchema` Strictness (`additionalProperties: false`) vs. Additive `v0.4.0` Arguments (`AD-14`–`AD-17`)
- **Location:** `architecture-vibe-debrief.md` (`AD-17` line 250, `Capability → Architecture Map` lines 501, 504) vs. `scripts/mcp-server.mjs:193-375, 445-450`
- **Evidence:** `AD-17` specifies that `panel.html` calls `vibe_debrief_export_html` with `{ conceptSlug, targetPlugin }` on a missing-plugin fallback, and `AD-12`/`AD-14`–`AD-17` add `diagramSpec`, `xray`, `waitingOnYou`, `concepts`, `microBlocks`, `verdict`, and `"minimal" | "focused" | "complex"` complexity levels to `vibe_debrief_publish`. Currently, `TOOLS` in `scripts/mcp-server.mjs` enforces `additionalProperties: false` on every tool schema (`vibe_debrief_export_html` has `properties: {}`).
- **Impact:** Any client or agent passing the new `v0.4.0` properties before `TOOLS` schemas in `scripts/mcp-server.mjs` are expanded will be rejected by MCP schema validation.
- **Fix / Build Guidance:** Expand `TOOLS` `inputSchema` definitions in `scripts/mcp-server.mjs` in lockstep with `ensureDebriefEnriched` and `AD-17` (`{ conceptSlug, targetPlugin }` on `vibe_debrief_export_html`, and additive vNext fields on `vibe_debrief_publish`).

### [LOW-2] Brownfield Hardcoded Dark Hexes in Inline SVG and Canvas Renderers (`AD-6`, `R10`)
- **Location:** `architecture-vibe-debrief.md` (`AD-6` line 122) vs. `assets/panel.html:1394-1450, 1803-1865` and `scripts/debrief-engine.mjs:1095, 1211-1280`
- **Evidence:** `AD-6` mandates that `panel.html` and `generateStandaloneHtmlArtifact` share CSS custom property tokens for Dark HUD and Field Desk Light and resolve SVG/Canvas colors dynamically rather than hardcoding dark hexes. Reality-checking the brownfield files confirms that `panel.html` currently has `body.theme-light` CSS variables (lines 35–57) but hardcodes `#131a26`, `#0b0f17`, `#f0f6fc`, `#9ba7b8` inside `renderInteractiveDiagram` (lines 1429–1449), and `generateStandaloneHtmlArtifact` in `debrief-engine.mjs` lacks a light theme block entirely.
- **Impact:** Directly validates `R10` and `AD-6`; builders must refactor both renderers rather than assuming `panel.html` already honors `body.theme-light` inside `<svg>` and `<canvas>`.
- **Fix / Build Guidance:** Use CSS variables (`var(--*)`) on inline SVG attributes and `getComputedStyle(document.documentElement)` token reads inside Canvas 2D draw loops in both `assets/panel.html` and `scripts/debrief-engine.mjs`.

### [LOW-3] Residual Gemini-Specific Defaults in Canonical Schema Seed & Static HTML (`AD-5`, `AD-13`)
- **Location:** `architecture-vibe-debrief.md` (`Canonical Data Contracts` lines 265–268) vs. `assets/panel.html:897` and `scripts/debrief-engine.mjs:1475-1561`
- **Evidence:** `AD-13` mandates model-agnostic discovery (`discoverCheapestEnabledModels()`) so non-Gemini users never hit hardcoded `gemini-4-argon` or `new-provider/gemini-3.8-flash` failures. The brownfield `assets/panel.html:897` hardcodes `<option value="new-provider/gemini-4-argon">` in static markup, and `scripts/debrief-engine.mjs:1561` falls back to `"new-provider/gemini-3.8-flash"`. The architecture's Canonical Data Contract example (lines 265–266) retains both `recommendedGeminiModel` (for backward compatibility) and `recommendedModel`.
- **Impact:** If no providers are discovered in `~/.zcode/v2/`, falling back to the literal string `"new-provider/gemini-3.8-flash"` on a non-Gemini setup would violate `AD-13` (`RULE-6`).
- **Fix / Build Guidance:** When `discoverCheapestEnabledModels()` finds no enabled provider models in `~/.zcode/v2/`, `recommendedModel` should default to `"active-session"` (instructing `UserPromptSubmit` / `panel.html` to run `vibe_debrief_publish` in the current session rather than calling `CreateSession` with an unconfigured model ID).
