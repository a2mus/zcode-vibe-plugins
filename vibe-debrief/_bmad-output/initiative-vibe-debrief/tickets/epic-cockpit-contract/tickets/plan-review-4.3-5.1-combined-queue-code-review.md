---
title: 'Combined code review of Stories 4.3 & 5.1 (version tri-sync gate + OQ-5 schema enrichment) and the uncommitted 5.2 normalizer delta'
type: review
ticket: review-4.3-5.1
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R1, R2]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/epic-cockpit-contract.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/tickets/plan-5.1-oq-5-schema-enrichment-publish-pass-through-tracer.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-panel-a11y/tickets/plan-4.3-4-file-version-sync-verifier-v0-3-0-release-stamp.md'
---

# Queue Review — Combined Changes for Stories 4.3 & 5.1 (Pre-Commit)

## Scope

Queue Task #2: review the Story 4.3 / 5.1 changes across `scripts/check-version-sync.mjs`,
`scripts/debrief-engine.mjs`, `scripts/mcp-server.mjs`, `assets/panel.html`, and `tests/` for edge
cases and backward compatibility before commit. Route: oneshot, deterministic tests only (no nested
LLM review).

Scope reality (verified via `git status` / `git log` on 2026-11-24):

- Story 4.3 (version tri-sync gate) and Story 5.1 (OQ-5 enrichment, widened `vibe_debrief_publish`)
  are already committed in `23c9b4b`; `scripts/check-version-sync.mjs`, `scripts/mcp-server.mjs`,
  and `assets/panel.html` carry no uncommitted diff.
- The uncommitted vibe-debrief delta that rewrites the 5.1 `diagramSpec` pipeline is Story 5.2
  (`plan-5.2-5-grammar-diagram-spec-normalizer-lane-safe-edge-synthesis.md`, already
  `status: done`): `scripts/debrief-engine.mjs` (5-grammar normalizer, lane-safe edge synthesis,
  `ensureDebriefEnriched` refactor), `tests/debrief-engine.test.mjs` (+7 tests), and a
  docs-only `AGENTS.md` bmad-project-context refresh. All three were reviewed here as the
  "before commit" surface, alongside the committed 4.3/5.1 code they build on.

## Findings

### Backward compatibility — PASS

- Legacy `diagramType` values map deterministically into the 5-grammar set
  (`sequence -> sequence`, `state-flow -> flow-diff`, `cause-effect -> before-after`,
  `architecture -> subway-map`, unknown -> `subway-map`) — `scripts/debrief-engine.mjs:713-736`;
  covered by the "maps legacy diagramType deterministically" test including an end-to-end v0.2.0
  `cause-effect` upgrade.
- `scripts/mcp-server.mjs:318-324,381-387` publish schemas accept all 8 legacy+OQ-5 grammar/type
  values, so old callers and persisted v0.2.0/v0.3.0 snapshots remain schema-valid; the normalized
  5-grammar output is a strict subset.
- `assets/panel.html` is grammar-agnostic: it renders `diagram.title/nodes/edges` only
  (`assets/panel.html:1765-1777,2296-2297`) against a fixed `viewBox="0 0 460 190"`, so renaming
  grammars cannot break rendering, and pinning `viewBoxWidth: 460` matches the panel constant.
- `diagramSpec` stays value-synchronized with `debrief.diagram` (shared `nodes`/`edges` array
  references via `Object.assign`), preserving the 5.1 alias contract for v0.2.0/v0.3.0 consumers.
- `scripts/check-version-sync.mjs` never throws on collect (unreadable locations become error
  entries), validates semver incl. prerelease/build, is import-guarded for the test suite, and the
  CLI exits 0/1 correctly (exercised by the "4-file version sync gate" suite).
- Intentional behavior change (per AD-14/OQ-5, asserted by tests): caller-supplied `viewBoxWidth`
  is now pinned to 460 instead of honored as in 5.1.

### Edge cases — 2 defects found, fixed in this review (hardening)

1. Prototype-chain leak in grammar resolution: `LEGACY_GRAMMAR_MAP[rawType]` was an unguarded
   lookup, so `diagramType: "constructor"` (or `"toString"`, `"__proto__"`, ...) resolved
   `grammar`/`diagramType` to a function/object instead of a string — empirically confirmed before
   the fix, and `JSON.stringify` silently dropped both keys from persisted state, violating the
   AD-14 "always one of 5 grammar strings" guarantee. Fixed with `Object.hasOwn` guards
   (`scripts/debrief-engine.mjs:731-736`).
2. `synthesizeLaneSafeEdges` output lacked the `animated` key, so the direct-synthesis path
   (e.g. alternating before/after lanes whose naive chain is fully cross-lane-dropped) escaped the
   plan-5.2 "guarantees `animated: boolean` on every edge" claim. Fixed by emitting
   `animated: false` in the chain helper (`scripts/debrief-engine.mjs:745-752`).

Regression tests added: `tests/debrief-engine.test.mjs:2419-2437` (hostile prototype keys resolve
to `subway-map` strings and survive JSON round-trip) and `tests/debrief-engine.test.mjs:2438-2475`
(`animated` boolean on synthesized edges, incl. the alternating-lane resynthesis path through
`ensureDebriefEnriched`).

### Advisory notes (non-blocking, no change made)

- Node `id` fallback (`n${idx+1}`) can collide with an explicit id on another node; the `nodeById`
  map keeps the last one. Pre-existing pattern shared with `buildDefaultDiagram`; renderer impact
  cosmetic at worst.
- `scripts/hook-runner.mjs:47` additionalContext guidance still lists the legacy 4 diagram types;
  harmless because the normalizer maps them, but a candidate for the Story 5.5/5.6 sweep.
- Duplicate explicit edges and self-loops are preserved by the normalizer (only dangling and
  cross-lane edges are dropped); acceptable for current renderers.

## Verification Evidence (all run 2026-11-24, exit 0)

- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` → exit 0.
- `node --test tests/` → 189 tests, 34 suites, 189 pass, 0 fail, 0 skipped (~3.4s), including the 2
  new review-hardening regression tests.
- `node scripts/check-version-sync.mjs` → all 4 locations synced to 0.3.0, exit 0.
- Repo-root `node scripts/validate.mjs` → bmad-companion v0.5.3, vibe-debrief v0.3.0,
  project-colors v0.1.0 all validated, exit 0.

## Outcome

Approved for commit. Two edge-case defects in the uncommitted Story 5.2 normalizer were found,
fixed, and regression-tested in this review; Story 4.3 and Story 5.1 committed state and all
consumers (MCP schema, panel, hook, export) verified backward compatible with the 5-grammar output.
