---
title: 'Read-only tool contract tracer (open_companion -> get_state -> recommend_next)'
type: feature
ticket: 1
created: '2026-11-24'
status: built
baseline_revision: '23c9b4b40c51fb210da7d008305dbb094d591983'
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

**Problem:** No automated test pins the shipped `ScanResult` contract returned by `bmad_open_companion`, `bmad_get_state`, and `bmad_recommend_next` over the spawned MCP stdio server, so Stories 2-4 and Epics 3-5 have nothing frozen to build on.

**Approach:** Add `tests/mcp-surface.test.mjs`, reusing the Epic 1 `runMcpServer` and temp-workspace helpers, that drives the three read-only tools through `tools/call` and asserts the ratified (OQ-A/OQ-G/OQ-B/OQ-D) shipped shapes: full `ScanResult` keys, shipped `{ recommendations, matchingSkills }`, at most 7 recommendations, and 100% `/bmad-<skill> "<prompt>"` regex with `providerId/modelId` pairing. No runtime `scripts/*.mjs` change.

</intent-contract>

## Implementation Notes

Oneshot: the ticket is a test-only tracer over already-shipped behavior, so a single new test file proves it without runtime changes.

- Ratified contracts encoded (not the older PRD wording): `initialize` echoes the client `protocolVersion` (OQ-A), shipped `{ recommendations, matchingSkills }` shape for `bmad_recommend_next` (OQ-B), up to 7 recommendations and up to 12 `matchingSkills` (OQ-D), `recommendedModel.modelId` is the `providerId/modelId` pair.
- Fixtures seed `hostModels` in `.zcode/bmad-companion/state.json` (a persisted-state fixture, no mutator tool call) because the isolated test HOME has no `provider_config.json`, so without it every model is the `host-default` placeholder with an empty `modelId`.

## Verification

**Commands:**
- `node --test tests/ && node scripts/check-version-sync.mjs` -- expected: exit code 0, all tests pass including `tests/mcp-surface.test.mjs`.

## Auto Run Result

- **Summary:** Added `tests/mcp-surface.test.mjs`, which drives `bmad_open_companion`, `bmad_get_state`, and `bmad_recommend_next` through the spawned MCP stdio server and freezes the shipped `ScanResult` contract (all 18 top-level keys, 11 metric keys, 4 phases, epic/story `overrideKey`s, artifacts, idle `taskQueue`, seeded `availableModels`). Every recommendation and skills-catalog command is asserted against the `/bmad-<skill> "<prompt>"` regex with a `providerId/modelId` pair. No runtime `scripts/*.mjs` file changed.
- **Files changed:**
  - `tests/mcp-surface.test.mjs` — 5 `node:test` cases covering the full ScanResult shape, the SM-1 recommendation contract, the shipped `{ recommendations, matchingSkills }` shape with topic filtering (OQ-B, OQ-D), focus persistence and `get_state` read-only behavior, and `initialize` protocol-version echo (OQ-A).
  - `_bmad-output/initiative-bmad-companion/tickets/epic-mcp-surface/tickets/story-read-only-tool-contract-tracer-open-companion-get-state-reco-plan.md` — this plan and run summary.
- **Review:** none, no lenses launched (pinned).
- **Verification performed:**
  - `node --check tests/mcp-surface.test.mjs` — passed.
  - `node --test tests/` — passed (54/54 tests, 0 failures).
  - `node scripts/check-version-sync.mjs` — passed (all 3 versions match, 0.5.3).
- **Residual risks:**
  - The tests need a seeded `hostModels` catalog in `state.json`; with no catalog, recommendations carry the `host-default` placeholder and an empty `modelId`, so the `providerId/modelId` guarantee only holds when models are discoverable.
  - `bmad_recommend_next` with a `topic` persists `lastUserPrompt`, which adds a recommendation; the test therefore asserts the `<= 7` bound rather than an exact count.
