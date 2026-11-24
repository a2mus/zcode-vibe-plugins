---
title: 'Wire per-plugin gates into repo-root CI'
type: chore
ticket: ''
created: '2026-11-24'
status: built
baseline_revision: '40b33d39f7651cf79a3c1343ba0dcde99adc09f2'
route: oneshot
route_source: pinned
risk: low
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

**Problem:** The repo-root CI originally ran only `node scripts/validate.mjs`, so a push could pass while a plugin's automated test suite or version tri-sync gate was broken.

**Approach:** Ensure `.github/workflows/validate.yml` runs `node --test tests/` and `node scripts/check-version-sync.mjs` for both `bmad-companion` and `vibe-debrief` on every push to `main` and every pull request, and confirm both commands pass locally. Planning found the four gate steps already committed at `40b33d3`; this run verifies them and only wires a step if verification finds one missing or wrong.

</intent-contract>

## Implementation Notes

Planning audit (2026-11-24): `.github/workflows/validate.yml` at `HEAD` (`40b33d3`) already declares `on: push: branches: [main]` and `pull_request`, then runs `node scripts/validate.mjs`, followed by four steps: test + version sync for `bmad-companion` and for `vibe-debrief`, each with `working-directory` set to the plugin folder. `scripts/validate.mjs` itself only validates marketplace metadata, JSON, script syntax, and panel script parseability; it is intentionally unchanged because the gate steps live in the workflow. No code change is expected from this run.

Implementation (2026-11-24): baseline `40b33d39f7651cf79a3c1343ba0dcde99adc09f2`. No source or workflow file was changed — the four gate steps already match the intent at the baseline. Decision: leave `scripts/validate.mjs` untouched; adding test execution inside it would run the suites twice in CI and blur its syntax-only role, while `validate.yml` already makes a failing gate fail the job. Files touched: none (this plan artifact is the only new file). Surprise: the `vibe-debrief` suite grew from 189 to 197 tests between planning evidence and verification (the 189 figure came from the pre-commit working tree); all 197 pass. Verification results: `bmad-companion` 62/62 tests, version sync OK at 0.5.3; `vibe-debrief` 197/197 tests, version sync OK at 0.3.0; repo-root `scripts/validate.mjs` validated `bmad-companion` v0.5.3, `vibe-debrief` v0.3.0, and `project-colors` v0.1.0, exit 0. Manual check confirmed the workflow triggers on push to `main` and on pull requests, and the gate steps follow the marketplace validation step.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd bmad-companion && node --test tests/` -- expected: 62 tests pass, exit 0
- `cd bmad-companion && node scripts/check-version-sync.mjs` -- expected: OK, all 3 versions match 0.5.3
- `cd vibe-debrief && node --test tests/` -- expected: 197 tests pass, exit 0
- `cd vibe-debrief && node scripts/check-version-sync.mjs` -- expected: OK, all 4 locations synced to 0.3.0
- `node scripts/validate.mjs` (repo root) -- expected: all marketplace plugins validated, exit 0

**Manual checks:**
- `.github/workflows/validate.yml` contains the four gate steps with the correct `working-directory`, after the marketplace validation step, and triggers on push to `main` and on pull requests.

## Auto Run Result

- Status: built
- Summary: The requested repo-root CI gate wiring was already present at the baseline, so this run verified it instead of re-implementing. `.github/workflows/validate.yml` runs `node scripts/validate.mjs`, then `node --test tests/` and `node scripts/check-version-sync.mjs` for `bmad-companion` and for `vibe-debrief`, on push to `main` and on pull requests. No source or workflow file changed.
- Files changed: `_bmad-output/initiative-bmad-companion/plan-repo-root-ci-per-plugin-gates.md` (new run record only).
- Review: none, no lenses launched (pinned by the invocation).
- Verification performed: `bmad-companion` 62/62 tests and version sync OK at 0.5.3; `vibe-debrief` 197/197 tests and version sync OK at 0.3.0; repo-root `scripts/validate.mjs` validated all three marketplace plugins, exit 0. Manual inspection confirmed the workflow triggers and step order.
- Residual risks: the gate's failure path (a red test or version mismatch failing the job) follows each script's non-zero exit; the version-sync mismatch path is covered by fixture tests, but GitHub Actions itself was not executed from this offline run. Low risk.
