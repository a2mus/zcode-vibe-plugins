---
title: 'Advisor update + live hostModels sync + storyOverrides persistence'
type: feature
ticket: 2
container: epic-mcp-surface
created: '2026-11-24'
status: done
baseline_revision: 'a013a2af48a463b089611b9f3803d2a5684b7c9b'
route: oneshot
route_source: pinned
risk: medium
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `bmad_update_advisor` in `scripts/mcp-server.mjs` replaced `agentAdvisorOverride` wholesale on every call (clobbering omitted `headline`/`turnSummary`/`recommendations`), left disk `provider_config.json` models enabled when live `hostModels[]` marked them with `disabledReason` or omitted `id` when passing `providerId`+`modelId`, ignored `storyOverrides` in the BMAD v6 `sprint-status.yaml` scan path, accepted malformed `overrideKey`/status inputs, and lacked automated MCP contract tests.

**Approach:** Extract `updateAdvisorState(workspaceRoot, args)` in `scripts/bmad-engine.mjs` (AD-2) behind the thin `bmad_update_advisor` adapter in `scripts/mcp-server.mjs` so advisor fields merge incrementally without clobbering omitted fields, live `hostModels[]` normalize `{ providerId, modelId }` and override disk `provider_config.json` (including `disabledReason` exclusions while keeping unrelated disk models on partial sync), validated `<epic-slug>#<story-num>` `storyStatusUpdates[]` persist through `savePersistedState` (C4) and apply to both v7 and v6 scans, and advisor recommendations enforce C2 contextual-prompt and `providerId/modelId` hygiene. Pin the behavior in `tests/mcp-surface.test.mjs`.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `normalizeHostModelEntry` and updated `mergeHostModelCatalogs` so entries with `{ providerId, modelId }` normalize cleanly without altering entries that already carry `id`.
  - Hardened `discoverConfiguredModels` so live `hostModels[]` override matching disk `provider_config.json` metadata (`contextWindow`, `reasoningLevels`, `defaultReasoningLevel`, `providerLabel`, `current`), remove disk models explicitly flagged with `disabledReason`, keep unrelated disk models visible during partial updates, and set `providerState.syncedFromRuntime`.
  - Added exported `updateAdvisorState(workspaceRoot, args)` (AD-2) to merge `headline`/`turnSummary`/`recommendations`, merge `hostModels[]`, validate/normalize `<epic-slug>#<story-num>` `storyStatusUpdates[]`, persist through a single `savePersistedState` call (C4 / AD-3), and return a fresh `ScanResult`.
  - Applied `persisted.storyOverrides[overrideKey]` in the BMAD v6 `sprint-status.yaml` scan fallback so v6 workspaces honor persisted overrides identically to v7.
  - Enforced C2/SM-1 hygiene on `agentAdvisorOverride.recommendations` inside `buildRecommendations`.
- **`scripts/mcp-server.mjs`:**
  - Replaced inline advisor mutation logic in `bmad_update_advisor` with `updateAdvisorState(workspaceRoot, args)` and removed unused `loadPersistedState`/`mergeHostModelCatalogs` imports.
- **`tests/mcp-surface.test.mjs`:**
  - Added 4 `node:test` cases under `bmad_update_advisor contract (Epic 2 Story 2)` covering incremental advisor field merging, disk `provider_config.json` override + `disabledReason` exclusion + partial `hostModels[]` merge, `storyStatusUpdates[]` persistence across v7 and v6 workspaces (including key-level merge and malformed entry filtering), and C2 recommendation hygiene.

## Verification

**Commands:**
- `node --check scripts/bmad-engine.mjs && node --check scripts/mcp-server.mjs && node --check tests/mcp-surface.test.mjs` — passed (exit 0).
- `node --test tests/ && node scripts/check-version-sync.mjs` — passed (58/58 tests, 0 failures; `[check-version-sync] OK: all 3 versions match (0.5.3)`).
- `node ../scripts/validate.mjs` — passed (`bmad-companion v0.5.3 validated`).

## Auto Run Result

- **Summary:** Hardened `bmad_update_advisor` via `updateAdvisorState` in `scripts/bmad-engine.mjs` and its thin adapter in `scripts/mcp-server.mjs`, fixing advisor field merging, live `hostModels[]` disk overrides and `disabledReason` suppression, deterministic `<epic-slug>#<story-num>` `storyOverrides` persistence across v7 and v6 workspaces via `savePersistedState` (C4), and C2 recommendation hygiene, verified by 4 new MCP stdio contract tests in `tests/mcp-surface.test.mjs`.
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `scripts/mcp-server.mjs`
  - `tests/mcp-surface.test.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-mcp-surface/tickets/story-advisor-update-live-hostmodels-sync-storyoverrides-persistence-plan.md`
- **Review:** none, no lenses launched (pinned).
