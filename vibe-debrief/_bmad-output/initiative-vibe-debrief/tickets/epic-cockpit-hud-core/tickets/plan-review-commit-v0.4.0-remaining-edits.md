---
title: 'Review & Commit: Remaining Uncommitted v0.4.0 UX Specs, Trackers & Export/Panel Tests'
type: review
ticket: review-commit-v0.4.0-remaining-edits
created: '2026-11-25'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R10, R11]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/tickets/plan-ux-audit-v0.4.0-panel-exports.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/tickets/plan-ux-refine-sync-views-flows-v0.4.0.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/tickets/plan-5.5-widened-set-persona-export-html-clarify-hook-delegation.md'
  - 'tests/export-parity.test.mjs'
  - 'tests/panel-a11y.test.mjs'
---

# BMAD Queue Task #1 — Review & Commit Remaining Uncommitted v0.4.0 UX & Test Edits

## Intent

Oneshot route, review=none: direct deterministic review of the remaining uncommitted vibe-debrief working-tree edits (UX spines & mockup, 7 epic `tickets.toml` trackers, plan-5.5 re-verification note, export/panel test additions, and the two untracked UX queue plans), then commit and push so v0.4.0 is release-ready.

## Review Findings

- **Trackers:** all 29 stories across the 7 epic `tickets.toml` files now carry `status = "done"` (29/29, matching the Wave 2 reconciliation at HEAD); no `planned`/`built` stragglers remain.
- **Test edits assert already-shipped code** (commits `1b9196a`, `e03514f`), not new behavior: export `#explainerScenePills` keyboard nav + roving tabindex (`scripts/debrief-engine.mjs:2352,2895`), Field Desk Light semantic-wash overrides (`assets/panel.html:1654-1661`), low-confidence `unclear-box` export with XSS escaping, and `concept-pill` focus preservation. Doc claims spot-checked: `diagram-node-group` (8 occurrences in `assets/panel.html`), 2.6px export focus stroke (`scripts/debrief-engine.mjs:2136`).
- **UX spine/mockup edits are documentation-only sync** to the shipped Cockpit HUD (header padding `8px 12px`, export canvas `880×230`, 460px viewBox export SVG, expanded semantic-wash selector list, dual empty-tour prompts, cross-turn reset list). No code, dependency, CSP, or stdio-policy changes; versions remain 0.4.0 in all 4 locations + marketplace.
- **Carried non-blocking observation** (from plan-5.5 re-verification): `discoverCheapestEnabledModels` uses unbounded `readFileSync` for local provider JSON (`scripts/debrief-engine.mjs:3267-3273`), try/catch-guarded; low risk, deferred.
- Historical note: plan-5.5's earlier validate log records `bmad-companion v0.5.3`; the marketplace has since released v0.5.4 (`2ef7728`). Historical entry left untouched.

## Verification (executed 2026-11-25, Node v26.12.1)

- `for f in scripts/*.mjs; do node --check "$f"; done` → exit 0 (syntax OK).
- `node --test "tests/*.test.mjs"` → 274 tests across 50 suites: 274 pass, 0 fail, 0 skipped (~10.6s), exit 0.
- `node scripts/check-version-sync.mjs` → OK: all 4 version locations synced to 0.4.0, exit 0.
- `node ../scripts/validate.mjs` → bmad-companion v0.5.4, vibe-debrief v0.4.0, project-colors v0.1.0 validated, exit 0.
- Repo-CI mirror for the sibling plugin: `node --test "../bmad-companion/tests/*.test.mjs"` → 175/175 pass (43 suites); `node ../bmad-companion/scripts/check-version-sync.mjs` → OK (0.5.4).

## Scope Note

bmad-companion working-tree edits (its own queue tasks' plans, engine/panel changes, and tests) were reviewed only to the extent of the repo-wide validate/test gate and left uncommitted — they are outside Task #1's vibe-debrief v0.4.0 scope.
