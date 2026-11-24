---
title: 'Wire per-plugin gates into repo-root CI'
type: chore
ticket: ''
created: '2026-11-24'
status: built
baseline_revision: '2de794524456865aa44ce7791cef2ff3647b5449'
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

**Problem:** The repo-root CI declares the per-plugin gates, but every push fails before any test runs. The test step invokes `node --test tests/`; Node 22's test runner treats arguments as glob patterns, not directories, so it tries to execute the `tests` directory as a file, dies in under a second, and the remaining gates are skipped. The last two pushes to `main` (`40b33d3`, `2de7945`) are red for this reason, not because of a test regression.

**Approach:** Replace `node --test tests/` with the Node-expanded glob `node --test "tests/*.test.mjs"` in both plugin gate steps, and update the doc references that repeat the old command. Keep `scripts/validate.mjs` as the syntax/marketplace gate and do not fold test execution into it. Verify every gate locally on the CI's Node 22 line.

</intent-contract>

## Implementation Notes

Oneshot route: the work is a handful of one-line command substitutions in one workflow and three doc files; the existing suites verify it, so no new design or test surface is needed.

Planning audit (2026-11-24, baseline `2de7945`):

- `.github/workflows/validate.yml` already declares `on: push: branches: [main]` plus `pull_request`, runs `node scripts/validate.mjs`, then four steps: test + version sync for `bmad-companion` and for `vibe-debrief`, each with `working-directory` set to the plugin folder. Only the two `run:` lines for the test steps are wrong.
- CI evidence (public API, runs 45436170259 and 45438252308): `validate` succeeds, then "Test bmad-companion" fails with step duration 0 s; every later step is skipped. So the gate is wired but has never executed a test on the pinned runtime.
- Root cause reproduced locally with the official Node 22.11.0 binary: `node --test tests` and `node --test tests/` both fail in ~50 ms with `MODULE_NOT_FOUND` for the `tests` directory path, while `node --test "tests/*.test.mjs"` runs 62/62. Node 22 docs describe `--test` arguments as glob patterns only. Node 26 accepts the directory form, which is why the suite looked green locally.
- Same pattern for `vibe-debrief`: 6 flat `tests/*.test.mjs` files; `node --test "tests/*.test.mjs"` runs 197/197 under Node 22.11, and `scripts/check-version-sync.mjs` reports all 4 locations at 0.3.0 under the same binary.
- `scripts/validate.mjs` is 100 lines and only validates marketplace metadata, JSON, script syntax, and inline panel-script parseability; it is intentionally unchanged.
- Doc references to the old command: `bmad-companion/AGENTS.md` (2), `bmad-companion/README.md` (3), `vibe-debrief/AGENTS.md` (2). The `_bmad-output/` history files are records of past runs and stay untouched.

Implementation (2026-11-24, baseline `2de794524456865aa44ce7791cef2ff3647b5449`):

- `.github/workflows/validate.yml` -- both test steps now run `node --test "tests/*.test.mjs"`; step names, order, `working-directory`, triggers, and the version-sync steps are unchanged.
- `bmad-companion/AGENTS.md`, `bmad-companion/README.md`, `vibe-debrief/AGENTS.md` -- command references updated, with a one-sentence note that the glob must stay quoted because Node 22 parses `--test` arguments as globs.
- Decision: keep `scripts/validate.mjs` untouched. It is the marketplace/JSON/syntax gate; folding test execution into it would run the suites twice and blur its role, while the workflow already fails the job on a red gate.
- Decision: fix the command rather than bump `node-version` in the workflow. The pinned Node 22 line is intentional; the invocation was the defect.
- Surprise: the earlier plan `plan-repo-root-ci-per-plugin-gates.md` (status `built`) declared this wiring verified, but its evidence came from a Node 26 local run; CI has been red on every push since the gates landed. Reproduced the exact failure with an official Node 22.11.0 binary before changing anything.
- Verification (Node 26.12.1): `bmad-companion` 62/62 tests and version sync OK at 0.5.3; `vibe-debrief` 197/197 tests and version sync OK at 0.3.0; repo-root `scripts/validate.mjs` validated all three marketplace plugins, exit 0.
- Verification (Node 22.11.0, CI line): `bmad-companion` 62/62 and version sync OK; `vibe-debrief` 197/197 and version sync OK. The old form (`node --test tests/`) fails on the same binary in ~50 ms with `MODULE_NOT_FOUND`, so the new form is the fix.
- Test fixtures that quote the old command as sample evidence text (`tests/helpers.mjs`, `vibe-debrief/tests/*.test.mjs`) were left as-is; they are data, not invocations.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd bmad-companion && node --test "tests/*.test.mjs"` -- expected: 62 tests pass, exit 0
- `cd bmad-companion && node scripts/check-version-sync.mjs` -- expected: OK, all 3 versions match 0.5.3
- `cd vibe-debrief && node --test "tests/*.test.mjs"` -- expected: 197 tests pass, exit 0
- `cd vibe-debrief && node scripts/check-version-sync.mjs` -- expected: OK, all 4 locations synced to 0.3.0
- `node scripts/validate.mjs` (repo root) -- expected: three marketplace plugins validated, exit 0
- Repeat both test steps with a Node 22 binary -- expected: same pass counts, proving the CI runtime accepts the new command form

**Manual checks:**
- `.github/workflows/validate.yml` still triggers on push to `main` and on pull requests, keeps the gate step order, and both test steps use the quoted glob.
- No remaining `node --test tests/` reference in tracked plugin docs or workflows.

## Auto Run Result

- Status: built
- Summary: The per-plugin gates were wired but could never pass: `node --test tests/` is a directory argument, and the pinned Node 22 test runner accepts only glob patterns, so the step died in under a second and every push was red. Both test steps now run `node --test "tests/*.test.mjs"`, and the command is updated in the two plugin `AGENTS.md` files and the bmad-companion `README.md` with a note to keep the glob quoted.
- Files changed:
  - `.github/workflows/validate.yml` -- both plugin test steps use the Node 22-compatible quoted glob; triggers, order, and version-sync steps unchanged.
  - `bmad-companion/AGENTS.md` -- verification and CI command references updated.
  - `bmad-companion/README.md` -- validation gate instructions updated.
  - `vibe-debrief/AGENTS.md` -- verification and CI command references updated.
  - `bmad-companion/_bmad-output/initiative-bmad-companion/plan-repo-root-ci-per-plugin-gates-2.md` -- this run record.
- Review: none, no lenses launched (pinned by the invocation).
- Verification performed: `bmad-companion` 62/62 tests and version sync OK at 0.5.3 on Node 26.12.1 and on Node 22.11.0; `vibe-debrief` 197/197 tests and version sync OK at 0.3.0 on both; repo-root `scripts/validate.mjs` validated all three marketplace plugins, exit 0. The old command form was reproduced failing on Node 22.11.0 in ~50 ms, confirming the cause. Workflow triggers and step order were inspected manually.
- Residual risks: CI uses the latest Node 22.x while local proof used 22.11.0; the documented glob behavior is unchanged across the v22 line. A Linux-only test failure unrelated to the invocation cannot be fully excluded until the next push runs the job, since this run does not push. GitHub also reports an unrelated Node 20 deprecation for `actions/checkout@v4` / `actions/setup-node@v4` (forced onto Node 24); consider bumping them later. The two `AGENTS.md` edits sit inside `bmad:context` blocks, so a stale `bmad-project-context` refresh could reintroduce the old command; the workflow remains the source of truth.
