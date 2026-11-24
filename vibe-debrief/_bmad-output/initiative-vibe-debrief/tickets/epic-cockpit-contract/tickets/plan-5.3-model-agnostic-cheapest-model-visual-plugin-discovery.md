---
title: 'Model-agnostic cheapest model & visual plugin discovery'
type: feature
ticket: 3
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R3, R5]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/epic-cockpit-contract.md'
---

# Build Ticket 5.3 — Model-Agnostic Cheapest Model & Visual Plugin Discovery

## Intent

Completes Story 5.3 (`epic-cockpit-contract` Story 3, R3 / R5, AD-5 / AD-13 / AD-17):
Builds on Story 5.1's `buildFullPanelState` envelope and Story 5.2's `scripts/debrief-engine.mjs` edits to add `discoverCheapestEnabledModels` (retaining `discoverLightweightGeminiModels` as a backward-compatible export alias) across enabled `~/.zcode/v2/` providers with `"active-session"` fallback and `discoverInstalledVisualPlugins` inspecting `~/.zcode/cli/plugins/`, `.mcp.json`, and project skills. Hands off `availableModels`, `recommendedModel`, and `installedVisualPlugins` to Stories 5.4–5.5 and Epics 6–7.

## Implementation Details

- `scripts/debrief-engine.mjs`:
  - `createDefaultState(workspaceRoot)`:
    - Added default OQ-5 settings `language: "en"`, `preferredModel: "auto-cheapest"`, and `themePreference: "auto"`.
  - `discoverCheapestEnabledModels(options = {})`:
    - Inspects `~/.zcode/v2/{provider_config,setting,credentials}.json` (honoring `ZCODE_HOME_DIR` and optional `{ homeDir }`) across enabled subscriptions and personal/API providers.
    - Filters out disabled, hidden, or keyless API-key providers, disabled individual model rules, non-text/media/embedding/audio/moderation models, and heavy flagship reasoning models (`opus`, `sonnet`, `gpt-5`, `gpt-4-turbo`, `o1-pro`, `o3-pro`, `deepseek-reasoner`).
    - Ranks fast/cheapest models across all enabled providers (Gemini `argon`/`flash`/`hydrogen`, OpenAI `nano`/`mini`, Anthropic `haiku`, Z.AI `glm-*-flash`/`air`, Alibaba/Qwen `turbo`/`flash`, DeepSeek `deepseek-chat`, etc.) descending by `score`.
  - Exported `discoverLightweightGeminiModels = discoverCheapestEnabledModels` as a backward-compatible alias.
  - `discoverInstalledVisualPlugins(workspaceOrOptions = "")`:
    - Inspects `~/.zcode/cli/plugins/` (`installed_plugins.json`, `plugins.json`, direct plugin folders, `cache/`, `marketplaces/`, `.zcode-plugin/plugin.json` / `plugin.json` manifests, plugin `.mcp.json`, and plugin `skills/`), workspace/home `.mcp.json` server keys, and project/home skills (`skills/`, `.zcode/skills/`, `.agents/skills/`).
    - Maps the official ZCode `design` plugin bundle (or `plugin_design` server) to both `"vectorcraft"` and `"designcraft"`, and skill-based `visualize` (`0.1.2+`) to `"visualize"`, without false-matching `"designcraft"` or non-visual skills (`bmad-agent-ux-designer`).
    - Skips explicitly disabled plugins/servers (`enabled: false` or `disabled: true`) and returns a deduplicated array in canonical order `["excalidraw", "visualize", "vectorcraft", "designcraft"]` (or `[]` when absent).
  - `buildFullPanelState(workspaceRoot)`:
    - Populates `availableModels` (top 8 from `discoverCheapestEnabledModels()`), `recommendedModel` (`state.preferredModel` override when not `"auto-cheapest"`, else `cheapestModels[0]?.id || "active-session"`), `installedVisualPlugins` (`discoverInstalledVisualPlugins(workspaceRoot)`), `language`, `preferredModel`, and `themePreference`, while preserving `recommendedGeminiModel` (fallback `"new-provider/gemini-3.8-flash"`) and `lightweightGeminiModels` for `v0.2.0`/`v0.3.0` callers.

- `tests/debrief-engine.test.mjs`:
  - Added suite `Story 5.3 — Model-agnostic cheapest model & visual plugin discovery` (6 tests):
    1. Confirms `discoverLightweightGeminiModels` is a backward-compatible alias of `discoverCheapestEnabledModels`.
    2. Ranks fast/cheapest models across enabled multi-provider configs (subscriptions, OpenAI, Alibaba, Z.AI) while filtering flagship, media/embedding, and disabled models/providers.
    3. Degrades cleanly to `recommendedModel: "active-session"`, `availableModels: []`, and `installedVisualPlugins: []` when no provider or plugin configs exist (preserving `recommendedGeminiModel: "new-provider/gemini-3.8-flash"`).
    4. Populates `availableModels`, `recommendedModel`, and persisted `preferredModel`/`language`/`themePreference` overrides in `buildFullPanelState`.
    5. Discovers installed visual plugins from `~/.zcode/cli/plugins/` cache, `installed_plugins.json`, `visualize` skill, and `design` bundle mapping (`vectorcraft` + `designcraft`).
    6. Discovers visual plugins from workspace `.mcp.json` and project `skills/` while ignoring disabled entries, malformed JSON, and non-visual skills.

## Verification (Executed 2026-11-24)

- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --test tests/ && node scripts/check-version-sync.mjs` — exits 0 (195 tests across 35 suites, 195 pass, 0 fail, 0 skipped; all 4 version locations synced to `0.3.0`).
