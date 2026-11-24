---
title: 'OQ-5 schema enrichment & publish pass-through tracer'
type: feature
ticket: 1
created: '2026-11-23'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R1]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/epic-cockpit-contract.md'
---

# Build Ticket 5.1 — OQ-5 Schema Enrichment & Publish Pass-Through Tracer

## Intent

Completes Story 5.1 (`epic-cockpit-contract` Story 1, R1):
Builds on Epics 1-4 baselines (1.3, 1.4, 2.1, 2.2, 3.2, 4.3) to add `ensureDebriefEnriched` additive OQ-5 fields (`verdict`, `waitingOnYou`, `choices`, raw text `xray`, `diagramSpec` alias, `microBlocks`, `concepts <= 6`, `minimalMode`, `heuristicConfidence`, `rawQuote`) and widen `vibe_debrief_publish` in `scripts/mcp-server.mjs` while keeping `v0.2.0`/`v0.3.0` snapshots valid. Hands off the frozen OQ-5 debrief core shape to stories 5.2–5.5 and Epics 6–7.

## Implementation Details

- `scripts/debrief-engine.mjs`:
  - Exported `ensureDebriefEnriched(debrief, state = {})` and normalizer helpers (`normalizeVerdict`, `normalizeWaitingOnYou`, `normalizeChoices`, `normalizeXray`, `normalizeConcepts`, `normalizeMicroBlocks`, `normalizeHeuristicConfidence`, `slugify`).
  - Additive OQ-5 normalization:
    - `verdict`: `"Solved"` | `"Built"` | `"Explained"` | `"Blocked"` | `"Planned"` with deterministic defaults (`"Blocked"` on `bugReport.succeeded === "no"`, `"Solved"` on bug fix, `"Built"` on implementation).
    - `waitingOnYou`: 5-state status badge and action chips (`"choice"`, `"action"`, `"reply"`, `"blocked"`, `"none"`) bounded at `chips <= 4`.
    - `choices`: Array of architectural options with keys, titles, plain/tech subtexts, prompts, and `tradeOffs` scores.
    - `xray`: Raw unescaped dual-coded strings for `plain` (`headline`, `summaryBullets`) and `tech` (`headline`, `summaryBullets`, `symbols`, `paths`, `commands`, `exitCodes`, `proofLines`).
    - `diagramSpec`: Aliased and synchronized with `diagram` (`grammar`, `diagramType`, `title`, `techTitle`, `viewBoxWidth: 460`, `groups`, `nodes <= 6`, `edges`).
    - `buildDefaultDiagram` preserves `techLabel`, `lane`, `branch` on nodes and `techLabel`, `animated` on edges.
    - `microBlocks`: Ordered array from `["unclear", "choices", "diagram", "proof-audit", "concepts", "lessons"]`.
    - `concepts`: ConceptItem list with Stage 1 definitions/analogies/micro-visuals and Stage 2 prompts, bounded at `concepts <= 6`.
    - `minimalMode`: Boolean flag.
    - `heuristicConfidence`: Float clamped to `0.0–1.0`.
    - `rawQuote`: Raw excerpt clamped to `<= 280` characters.
    - `proofClaims`: Preserves optional `detail` snippet.
  - `createWelcomeDebrief` wraps return value in `ensureDebriefEnriched`.

- `scripts/mcp-server.mjs`:
  - Widened `vibe_debrief_publish` `inputSchema.properties` with optional OQ-5 properties: `verdict`, `minimalMode`, `heuristicConfidence`, `rawQuote`, `xray`, `waitingOnYou`, `choices`, `diagramSpec`, `microBlocks`, `concepts`, and `proofClaims.items.properties.detail`.
  - Expanded `diagram` and `diagramSpec` schemas to accept all 8 grammars/types (`architecture`, `sequence`, `state-flow`, `cause-effect`, `flow-diff`, `subway-map`, `before-after`, `decision-tree`), `groups`, node `techLabel`/`lane`/`branch`, and edge `techLabel`/`animated`.
  - Updated `handleToolCall` for `vibe_debrief_publish` to pass all OQ-5 fields into `draftDebrief` and delegate full normalization to `ensureDebriefEnriched(draftDebrief, state)`.

- `tests/debrief-engine.test.mjs`:
  - Added unit test suite `Story 5.1 — OQ-5 schema enrichment & normalizers` (5 tests):
    1. Upgrades a legacy v0.2.0 snapshot without OQ-5 fields into a valid OQ-5 debrief.
    2. Upgrades a v0.2.0 state fixture cleanly in `buildFullPanelState`.
    3. Enforces bounded collections on OQ-5 fields (`concepts <= 6`, `waitingOnYou.chips <= 4`, `diagramSpec.nodes <= 6`, `rawQuote <= 280`).
    4. Preserves and normalizes caller-supplied OQ-5 fields.
    5. Derives deterministic defaults for bug failures and choice waiting states.

- `tests/transports-and-sync.test.mjs`:
  - Added integration test `Story 5.1 — round-trips widened vibe_debrief_publish with all OQ-5 fields over stdio MCP` verifying end-to-end JSON-RPC round-trip, persistence to `state.json`, and state retrieval via `vibe_debrief_get_state`.

## Verification (Executed 2026-11-23)

- `node --test tests/` — 179 tests across 33 suites, 179 pass, 0 fail, 0 skipped (~3.7s).
- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` — exits 0.
- `node scripts/check-version-sync.mjs` — exits 0; all 4 locations declare `0.3.0`.
- MCP stdio handshake & tools list — exits 0 with protocol-clean stdout.
- Lifecycle hook runner smoke test — exits 0 with single protocol line.
