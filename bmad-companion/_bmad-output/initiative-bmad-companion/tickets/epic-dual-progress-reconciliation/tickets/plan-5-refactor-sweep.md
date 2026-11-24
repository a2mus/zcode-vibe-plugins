---
title: 'Refactor sweep'
type: chore
ticket: 5
container: epic-dual-progress-reconciliation
created: '2026-11-24'
status: done
baseline_revision: '3c50d56f79836df6604b0515bc0a6998d16241f8'
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

**Problem:** After Stories 3.1-3.4 (tickets 1-4), `scanBmadWorkspace` in `scripts/bmad-engine.mjs` carried two nearly identical copies of the story-evidence machinery — one in the v7 `tickets.toml` entry loop, one in the v6 `sprint-status.yaml` key loop:
1. The implementation-report matcher (name needles `v6Key`/`story-<e>-<s>`/`plan-<e>-<s>` plus frontmatter `ticket`+`container` / `v6_key` / `story` checks) and its matched/failing-report bookkeeping were duplicated verbatim.
2. The five-branch smart-status evidence chain (override -> plan/story-file done -> passing report -> failing report -> retrospective -> declared-only) was duplicated with only the evidence message strings differing.
3. `reconcileWorkspaceTrackers` repeated the tolerant `development_status:` section-header regex inline twice, accepted an empty/non-string `workspaceRoot` (silently falling back to the process cwd via `resolve`), and surfaced raw `fs` errors without file context when a tracker, `.bak`, or audit-log write failed.

The `deferred:` lists of plans 1-4 were all empty, so scope was set from the ticket's three cleanup clauses: deduplicate parser/header-counter helpers, normalize evidence-rule branching, tighten reconciler error paths. No new behavior.

**Approach:**
1. Extract two shared single-source helpers next to `scanBmadWorkspace`: `matchStoryImplementationReport(implReportFiles, { v6Key, epicNum, storyNum, containerSuffix }, { matchedReportFiles, failingReports })` (find + parse summary + record matched/failing) and `evaluateStorySmartStatus({ declaredStatus, override, planEvidence, reportCandidate, reportSummary, retroEvidence })` (the deterministic C12 evidence chain, once). Both scan loops now call them with only their differing inputs/messages; every evidence string and rule order is byte-identical to before.
2. Hoist the duplicated tolerant section-header regex into the module constant `DEV_STATUS_SECTION_RE`, used by both the in-place status rewrite pass and the numeric header-counter pass (the stricter variant inside `parseSprintStatusYaml` is deliberately untouched to preserve scan behavior).
3. Tighten `reconcileWorkspaceTrackers` error paths: reject empty/non-string `workspaceRoot` up front, and rethrow failed YAML/TOML/`.bak`/audit-log writes as context-bearing errors (`Failed to reconcile v6 YAML tracker '<rel>': ...`) via the existing `errorMessage` helper. Existing thrown messages (`Invalid target ...`, asserted in `tests/reconciliation.test.mjs`) unchanged.

</intent-contract>

## Implementation Notes

- **`scripts/bmad-engine.mjs`:**
  - Added `matchStoryImplementationReport` and `evaluateStorySmartStatus` shared helpers (Story 3.5 refactor sweep comment block) before `scanBmadWorkspace`.
  - Replaced the duplicated report-matcher + bookkeeping + evidence chain in the v7 `tickets.toml` loop and in the v6 `sprint-status.yaml` loop with calls to the shared helpers (~110 duplicated lines removed); call sites now only build their differing `planEvidence`/`retroEvidence` strings (plan vs story-file message, epic-retro variants).
  - Added `DEV_STATUS_SECTION_RE` constant; both `development_status:` section checks in the YAML reconcile pass use it.
  - `reconcileWorkspaceTrackers`: added `workspaceRoot` type/non-empty guard; wrapped YAML write (+`.bak`), TOML write (+`.bak`), and audit-log write in try/catch rethrowing `Error` with the relative tracker path and `errorMessage(err)`.
  - No behavior change: evidence messages, rule ordering, `.bak` semantics, dryRun zero-write guarantee, audit-ledger format, and `ReconcileResult` shape are untouched. `parseFrontmatter`, `parseTomlBlocks`, `parseSprintStatusYaml`, `parseTestReportSummary`, `normalizeStatus`, `updateSummaryCommentHeaders` each remain defined exactly once (verified by grep).
- No test changes were needed — the sweep is behavior-preserving and the existing 92 tests (including the reconciliation, evidence-rule, and MCP-contract suites) pin the preserved behavior.

## Verification

**Commands (executed on win32, Node v26.12.1):**
- `node --test tests/` — passed (92/92 tests, 0 failures, 21 suites).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs` — passed (92/92 tests; `[check-version-sync] OK: all 3 versions match (0.5.3)`; `bmad-companion v0.5.3`, `vibe-debrief v0.3.0`, `project-colors v0.1.0` validated).
- Duplication audit — `grep -c "function <name>("` returns 1 for every parser/header-counter helper (`parseFrontmatter`, `parseTomlBlocks`, `parseSprintStatusYaml`, `parseTestReportSummary`, `normalizeStatus`, `updateSummaryCommentHeaders`, `stripTomlInlineComment`, `parseEpicsMarkdown`); formerly duplicated inline logic now single-sourced (`implReportFiles.find`: 1, `matchedReportFiles.add`: 1, "Passing implementation report" evidence string: 1, tolerant `development_status:` regex: 1 constant).

## Auto Run Result

- **Summary:** Completed the Story 3.5 refactor sweep: deduplicated the v7/v6 story-evidence pipelines into two shared helpers, normalized the evidence-rule branching into a single deterministic chain, single-sourced the `development_status:` header regex, and tightened reconciler error paths with a `workspaceRoot` guard and context-bearing write errors — zero behavior change, full suite green.
- **Files changed:**
  - `scripts/bmad-engine.mjs`
  - `_bmad-output/initiative-bmad-companion/tickets/epic-dual-progress-reconciliation/tickets/plan-5-refactor-sweep.md`
