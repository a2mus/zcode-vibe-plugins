<!-- bmad:context -->
<!-- Verified 2026-11-24 against a013a2a. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## vibe-debrief

Comprehension-first ZCode right-side panel plugin (`ui://vibe-debrief/panel.html`) implementing Karpathy's 4-rung framework (STE-80 clarity, always-on interactive SVG diagrams, inline proof/uncertainty oversight, standalone HTML export, complex-only Canvas explainers, and ZCode `MEMORY.md` persistence). Zero-dependency Node ESM (`scripts/*.mjs`) paired with a self-contained HTML/CSS/JS panel (`assets/panel.html`). Lives inside `a2mus-zcode-plugins` alongside `../marketplace.json` and sibling `../bmad-companion/`, with planning and UX specs under `_bmad-output/`.

## Policy

- Never hand-edit `.agents/skills/`, `.zcode/skills/`, or `skills-lock.json` — these are upstream BMAD-METHOD skills; plugin-owned skills belong in `skills/eli5/` and `skills/vibe-debrief/`.
- Keep semver synchronized across all 4 internal locations checked by `scripts/check-version-sync.mjs` (`.zcode-plugin/plugin.json`, `scripts/mcp-server.mjs` `serverInfo.version`, `assets/panel.html` `appInfo.version`, and `scripts/hook-runner.mjs` `SessionStart` banner) plus `../marketplace.json` when releasing updates.
- Never commit runtime state or exported artifacts under `.zcode/` (`.zcode/vibe-debrief-state.json`, `.zcode/vibe-debrief-artifacts/`); `.zcode/` is excluded by `../.gitignore`.

## Where things are

- Core domain engine (state persistence, STE-80 polish, diagram synthesis, complexity gate, HTML export, ZCode Memory sync, Gemini discovery): `scripts/debrief-engine.mjs`
- MCP stdio server (`8` `vibe_debrief_*` tools, `ui://vibe-debrief/panel.html` resource) & plugin wiring: `scripts/mcp-server.mjs`, `.zcode-plugin/plugin.json`, `hooks/hooks.json`, `.mcp.json`
- Lifecycle hook runner (`session-start`, `user-prompt`, `post-tool`, `stop`): `scripts/hook-runner.mjs`
- Right-side panel UI (`postMessage` MCP App bridge): `assets/panel.html`
- Plugin skills & commands: `skills/eli5/SKILL.md`, `skills/vibe-debrief/SKILL.md`, `commands/eli5.md`, `commands/vibe-debrief.md`
- UX theme-token contract (Dark HUD & Field Desk Light) referenced by UI/export parity tests: `_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md`

## Running and verifying

- Target Node 20+ ESM (`node:*` built-ins only; CI runs Node 22) — never add `package.json` or external npm dependencies.
- Run the automated verification gate before declaring any change complete: `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` (built-in `node:test` runner, ~3–4s total; `tests/transports-and-sync.test.mjs` covers MCP stdio and all 4 hook lifecycle modes, replacing manual pipe smoke-tests). Keep the glob quoted: Node 22 treats `--test` arguments as glob patterns, so a bare `tests/` directory argument fails immediately with `MODULE_NOT_FOUND`.
- Repo-root CI (`../.github/workflows/validate.yml`) runs `node scripts/validate.mjs` (marketplace↔plugin version sync, JSON validity, `node --check` on scripts, inline panel `<script>` parseability), then `node --test "tests/*.test.mjs"` and `node scripts/check-version-sync.mjs` for both `../bmad-companion/` and this plugin.

## Conventions that differ from defaults

- Keep `scripts/debrief-engine.mjs` pure with respect to stdio — never read `stdin` or write to `stdout`; in `scripts/mcp-server.mjs` and `scripts/hook-runner.mjs`, reserve `stdout` strictly for JSON-RPC 2.0 frames or a single lifecycle JSON line (`{}` or `{ additionalContext }`), never `console.log`.
- Resolve workspace root in `scripts/mcp-server.mjs` in order `ZCODE_WORKSPACE_ROOT` → `ZCODE_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()`, and serve `assets/panel.html` as `text/html;profile=mcp-app` with `_meta["zcode/csp"].unsafeEval: false`.
- Use the MCP Apps `window.parent.postMessage` JSON-RPC 2.0 bridge in `assets/panel.html`, never `window.zcode`; keep the panel 100% self-contained (zero external `<script>`, `<link>`, or fetches) and free of `eval`, `new Function`, or inline `onclick=` attributes.
- Route all `.zcode/vibe-debrief-state.json` writes through `savePersistedState` (atomic sibling `.tmp` + `renameSync` with Windows `EPERM`/`EACCES` retry, bounding `history` at 15, `recentTouchedFiles` at 15, `confirmedLessons` at 50); preserve `state.agentPublishedThisTurn` in `stop` hooks so heuristic/AI fallback never overwrites an agent-published debrief.
- Apply STE-80 clarity (`applySte100Polish`, <= 22 words/sentence) only at the debrief/hook synthesis boundary, never mid-task; always produce a `diagram` (`buildDefaultDiagram`, max 6 nodes), and gate `explainerScenes` to `assessWorkflowComplexity` `level === "complex"` (score >= 4) unless explicitly overridden.
- Escape dynamic strings with `escapeHtml()` before DOM/SVG/HTML interpolation, and escape `<` as `\u003c` inside embedded `payloadJson` in `generateStandaloneHtmlArtifact`; honor `ZCODE_VISUALIZATION_DIR` for exports (default `<workspaceRoot>/.zcode/vibe-debrief-artifacts/vibe-debrief-<timestamp>.html`).
- Persist ZCode Memory lessons via `confirmAndSaveLessonToZCodeMemory` under `~/.zcode/cli/memories/projects/<matched-workspace-slug>/memory/` (falling back to `<workspaceRoot>/.zcode/memory/`); honor `ZCODE_HOME_DIR` in tests so memory and `discoverLightweightGeminiModels` (`~/.zcode/v2/{provider_config,setting,credentials}.json`, fallback `new-provider/gemini-3.8-flash`) stay isolated from live `~/.zcode`.
- Optional Stop-hook AI synthesis (`tryOptionalAiDebriefSynthesis`) runs only when `VIBE_DEBRIEF_OPENAI_KEY` or `OPENAI_API_KEY` is set (`VIBE_DEBRIEF_OPENAI_BASE_URL` default `https://api.openai.com/v1`, `VIBE_DEBRIEF_MODEL` default `gemini-2.5-flash`, 4500ms timeout) and must fall back cleanly to `synthesizeHeuristicDebrief`.

<!-- /bmad:context -->
