---
title: '4-tier model scorer + enabled-model resolution'
type: story
ticket: 2
container: epic-hooks-model-router
created: '2026-11-25'
status: done
baseline_revision: 'e717dfe'
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

**Problem:** Story 6.2 (`epic-hooks-model-router#2`) hardens `discoverConfiguredModels`, `scoreModelForBmadProfile`, and `recommendModelForBmadSkill` in `scripts/bmad-engine.mjs` to resolve enabled models from `state.json -> hostModels` (`ListModels`) or `~/.zcode/v2/provider_config.json`, exclude `enabled === false` / `disabledReason`, score models against the 4-tier `modelProfile` (`deep-reasoning`, `creative-ux`, `agentic-coding`, `planning-fast`), and return the top `providerId/modelId`, tier label, and rationale (`R5`, parent `R18`, `A-4`).

**Approach:**
1. Merge live `hostModels` with disk `provider_config.json` in `discoverConfiguredModels` (`scripts/bmad-engine.mjs`), filtering out models with `enabled === false` or non-empty `disabledReason`.
2. Score candidate models across the four BMAD model profiles (`deep-reasoning`, `creative-ux`, `agentic-coding`, `planning-fast`) in `scoreModelForBmadProfile` and return the top-ranked `providerId/modelId`, tier label, cost tier, and rationale in `recommendModelForBmadSkill`.
3. Verify enabled-model filtering, catalog merging, queue-health penalties, and profile scoring in `tests/model-catalog.test.mjs`.

</intent-contract>

## Implementation Notes

- `scripts/bmad-engine.mjs`: `discoverConfiguredModels`, `mergeHostModelCatalogs`, `applyModelHealthFromQueue`, `scoreModelForBmadProfile`, and `recommendModelForBmadSkill`.
- `tests/model-catalog.test.mjs`: Automated unit and integration tests covering cost tiers, host model catalog merge, rate-limit health penalties, and profile-specific model selection.

## Verification

- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` — passed.
