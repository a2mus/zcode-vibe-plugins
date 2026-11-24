---
title: '5-grammar diagramSpec normalizer & lane-safe edge synthesis'
type: feature
ticket: 2
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R2]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/epic-cockpit-contract.md'
---

# Build Ticket 5.2 — 5-Grammar diagramSpec Normalizer & Lane-Safe Edge Synthesis

## Intent

Completes Story 5.2 (`epic-cockpit-contract` Story 2, R2 / AD-14):
Builds on Story 5.1's `diagramSpec` alias in `scripts/debrief-engine.mjs` to support all 5 grammars (`sequence`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`; `viewBoxWidth` 460, `<= 6` nodes, deterministic 4-to-5 mapping) with lane-safe `before-after` edge synthesis that never bridges before-lane to after-lane nodes. Hands off normalized `diagramSpec` output to stories 5.3–5.4 and Epic 6.

## Implementation Details

- `scripts/debrief-engine.mjs`:
  - New section "Story 5.2 (AD-14): 5-Grammar diagramSpec Normalizer & Lane-Safe Edge Synthesis" after `buildDefaultDiagram`:
    - Exported `VALID_DIAGRAM_GRAMMARS` (frozen 5-grammar list) and internal `LEGACY_GRAMMAR_MAP` (`sequence -> sequence`, `state-flow -> flow-diff`, `cause-effect -> before-after`, `architecture -> subway-map`).
    - Exported `resolveDiagramGrammar(diagram, choices)`: deterministic mapping — `choices.length >= 2` or explicit `decision-tree` wins first; explicit OQ-5 grammar kept; legacy `diagramType`/`grammar` mapped; default `subway-map`.
    - Exported `synthesizeLaneSafeEdges(nodes, grammar)`: sequential chain synthesis; for `before-after`, chains stay inside the `before` lane and the `after` lane (unlabeled nodes chain separately) with no cross-lane bridge.
    - Exported `normalizeDiagramSpec(diagram, { choices })`: resolves grammar, mirrors it into `diagramType`, pins `viewBoxWidth: 460`, caps/sanitizes `nodes <= 6` (preserving `techLabel`, `lane`, `branch`), normalizes `groups` to `{ id, label, lane }`, filters edges to surviving nodes, drops explicit cross-lane edges in `before-after`, auto-synthesizes lane-safe edges when omitted, renumbers `stepNumber 1..N`, and guarantees `animated: boolean` on every edge.
  - `ensureDebriefEnriched` now computes `choices` before diagram processing, preserves explicit spec metadata on node-less specs, and delegates to `normalizeDiagramSpec`; `diagramSpec` stays sync-aliased with `debrief.diagram` (mirrored fields via `Object.assign`). `buildDefaultDiagram` legacy output shape is unchanged for v0.2.0/v0.3.0 callers.

- `tests/debrief-engine.test.mjs`:
  - Added suite `Story 5.2 — 5-grammar diagramSpec normalizer & lane-safe edges` (9 tests):
    1. All 5 grammars normalize with `<= 6` nodes, `viewBoxWidth` 460, sequential numbered edges, `animated` booleans, and `diagram`/`diagramSpec` field mirroring.
    2. Deterministic 4-to-5 legacy `diagramType` mapping (incl. omitted default) plus end-to-end legacy upgrade through `ensureDebriefEnriched`.
    3. `choices >= 2` or explicit `decision-tree` forces `decision-tree`; a single choice does not.
    4. Lane-safe `before-after` auto-synthesis (helper + end-to-end): intra-lane chains only, no before→after bridge.
    5. Explicit cross-lane edges dropped in `before-after` and remaining edges renumbered.
    6. Non-`before-after` grammars keep full sequential chains even with lanes.
    7. `viewBoxWidth` pinned to 460; `groups`, `techLabel`, `lane`, `branch`, `animated` normalized/preserved.
    8. Hostile prototype-chain `diagramType`/`grammar` keys (`constructor`, `toString`, `__proto__`, etc.) resolve to `"subway-map"` strings and survive JSON state persistence round-trip (`Object.hasOwn` guard).
    9. Auto-synthesized lane-safe edges carry `animated: false` boolean (including alternating-lane resynthesis through `ensureDebriefEnriched`).

## Verification (Executed 2026-11-24)

- `node --test tests/` — 189 tests across 34 suites, 189 pass, 0 fail, 0 skipped (~3.1s).
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs` — exits 0.
- `node scripts/check-version-sync.mjs` — exits 0; all 4 locations declare `0.3.0`.
