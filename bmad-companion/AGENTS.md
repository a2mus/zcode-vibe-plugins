<!-- bmad:context -->
<!-- Verified 2026-11-17 against fd5cad6. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## bmad-companion

Global ZCode companion plugin for BMAD-METHOD, providing a right-side workspace panel, lifecycle hooks, and an MCP stdio server. Zero-dependency Node ESM (`scripts/*.mjs`) paired with a self-contained HTML/CSS/JS panel (`assets/panel.html`). Lives as a plugin package inside `a2mus-zcode-plugins` alongside `../marketplace.json` and sibling `../vibe-debrief/`.

## Policy

- Never hand-edit `.agents/skills/`, `.zcode/skills/`, or `skills-lock.json` — these are upstream BMAD-METHOD skills managed via `npx skills`; plugin-owned skills belong in `skills/bmad-companion/`.
- Keep `version` and descriptions synchronized across `.zcode-plugin/plugin.json`, `../marketplace.json`, and `serverInfo.version` in `scripts/mcp-server.mjs` when releasing updates.
- Never commit runtime files under `.zcode/bmad-companion/` (`state.json`, `reconciliation-log.json`) or `*.bak` tracker backups; both are excluded by `../.gitignore`.

## Where things are

- Shared workspace scanner, model scorer, and tracker reconciler: `scripts/bmad-engine.mjs` (imported by both `scripts/mcp-server.mjs` and `scripts/hook-runner.mjs`)
- MCP stdio server and 8 tool handlers: `scripts/mcp-server.mjs`; plugin wiring: `.zcode-plugin/plugin.json`, `hooks/hooks.json`, `.mcp.json`
- Right-side panel UI: `assets/panel.html` (served as `ui://bmad-companion/panel.html`)
- Plugin skill and slash command: `skills/bmad-companion/SKILL.md`, `commands/bmad-companion.md`

## Running and verifying

- Target Node 18+ ESM (`node:*` built-ins only, verified on `v26.12.1`) — do not add `package.json` or external npm dependencies.
- Verify script syntax with `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs`; there is no automated test suite or linter.
- `README.md` documents `zcode plugins validate .`, which fails if the `zcode` CLI is not on `PATH`; smoke-test `scripts/mcp-server.mjs` over stdio JSON-RPC (`initialize`, `tools/list`, `resources/read`) when changing MCP handlers.

## Conventions that differ from defaults

- Use the MCP Apps `window.parent.postMessage` JSON-RPC bridge (`ui/initialize`, `tools/call`) in `assets/panel.html`, never `window.zcode`, and keep all UI code inline under CSP `unsafeEval: false`.
- Preserve `isUserInteractingWithForm` and `userEditedPrompts` guards in `assets/panel.html` when touching UI state, because the panel polls `bmad_get_state` every 5s while visible.
- Keep `scripts/bmad-engine.mjs` parsers (`parseFrontmatter`, `parseTomlBlocks`, `parseSprintStatusYaml`) dependency-free, and preserve `.bak` backup creation in `reconcileWorkspaceTrackers` unless `backup: false` is passed.
- Pass live `ListModels` entries via `bmad_update_advisor` (`hostModels` supplements disk discovery; partial lists merge so accessible models are never hidden), and format every recommendation as `/bmad-<skill> "<contextual prompt>"` with a `providerId/modelId` — never emit bare skill names.
- Route all `.zcode/bmad-companion/state.json` writes through `savePersistedState`, and enforce `workspaceRoot` path confinement with `/` normalization on artifact paths.

<!-- /bmad:context -->
