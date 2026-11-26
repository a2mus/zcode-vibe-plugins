---
type: epic
title: 3-conversation focus hero, plain-language Work copy & legacy drift closure
parent: initiative-bmad-companion
covers: [R24, R25, R26]
sources:
  - _bmad-output/initiative-bmad-companion/initiative-bmad-companion.md
  - _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
companions:
  - _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
after: [epic-dual-progress-reconciliation, epic-execution-queue, epic-hooks-model-router]
status: done
refined: true
risk: high
---

# 3-conversation focus hero, plain-language Work copy & legacy drift closure

## Description

Builds on Epics 3, 5, and 6 in `scripts/bmad-engine.mjs`, `scripts/hook-runner.mjs`, `scripts/mcp-server.mjs`, and `hooks/hooks.json` to deliver the `AD-18` rolling 3-conversation memory and deterministic jargon-free focus hero (`turnAnalysis.currentFocus`), `AD-8` plain-language `plainTitle`/`plainSummary` recommendation fields (keeping `skillsCatalog`/`agentsCatalog` intact per `AD-14`), and closes the three open legacy drift items (`OQ-C`, `OQ-E`, `OQ-F`). Hands off the frozen `currentFocus` and plain-copy `ScanResult` payload to `epic-panel-readability-redesign` (`Epic 8`).

## Outcome

The panel's Work tab receives a reliable, jargon-free 1–2 sentence reading of the last three conversations and plain-language next-action copy without breaking any existing `0.5.x` MCP clients, while the legacy walk-depth, `PostToolUse` matcher, and override-clear defects are permanently closed.

## Requirements

1. **R1 (parent R24)**: `state.json` adds a rolling 3-conversation `recentConversations` ring buffer (capped at 3 entries, newest first, keyed/deduplicated by `sessionId` with field-preserving upsert so partial hook updates never blank non-empty snippets) merged exclusively via `savePersistedState` (`AD-3`), populated by `hook-runner.mjs` (`UserPromptSubmit` / `Stop`) within the ≤350ms deterministic hook budget (`AD-13`), while `bmad_update_advisor` accepts optional additive `focusSummary` and `sessionId` inputs without creating fallback entries when `sessionId` is omitted (`AD-14`, `AD-18`).
2. **R2 (parent R25)**: `bmad-engine.mjs` computes deterministic jargon-free `turnAnalysis.currentFocus` (`{ text, basisLabel, conversationCount, source }` with closed `source` enum `"advisor-override" | "stop-synthesis" | "deterministic"`, a jargon filter stripping/rejecting `/bmad-*`, phase codes, and tracker filenames on both deterministic and AI `focusSummary` overrides, same-turn-safe override freshness expiring only on a newer conversation/prompt, `basisLabel: "Current focus"`, and accurate `conversationCount` for 0–3 chats) plus additive `plainTitle` and `plainSummary` fields on every recommendation (`AD-8`), while `bmad_get_state` preserves `skillsCatalog` and `agentsCatalog` in `structuredContent` (`AD-14`).
3. **R3 (parent R26)**: Close the three remaining legacy drift items: align the legacy depth-6 walk call site in `reconcileWorkspaceTrackers` to `SCAN_LIMITS.maxDepth` (depth 4, noted as `walkDepth` in `OQ-C`), set `hooks/hooks.json` `PostToolUse` matcher to `"Write|Edit|MultiEdit"` matching parent `R21` (`OQ-E`), and add explicit key-clear/replace support in `savePersistedState` so `reconcileWorkspaceTrackers` clears reconciled `storyOverrides` keys cleanly (`OQ-F`).

## Constraints

- **C1, C3, C4, C10, C11, C12, C13** (parent `C1`, `C3`, `C4`, `C10`, `C11`, `C12`, `C13`): zero npm dependencies (`AD-1`); workspace-confined paths only (`AD-6`, no reading ZCode host-private session stores); all `state.json` writes via `savePersistedState` (`AD-3`); deterministic hooks ≤350ms p95 and optional `Stop` LLM bounded by `AbortSignal.timeout(4500)` (`AD-5`, `AD-13`); additive `0.5.x` MCP schema changes only (`AD-14`).

## Done when

1. `recentConversations` deduplicates by `sessionId`, preserves existing snippets on partial updates, caps at 3 entries, and never creates fallback slots from `bmad_update_advisor` calls lacking `sessionId`.
2. `turnAnalysis.currentFocus` returns plain everyday sentences with zero BMAD jargon, respects same-turn-safe override freshness, emits `"Current focus"` with accurate `conversationCount`, and recommendations include `plainTitle`/`plainSummary` while `bmad_get_state` keeps `skillsCatalog` and `agentsCatalog`.
3. `reconcileWorkspaceTrackers` walks within `SCAN_LIMITS.maxDepth` (`4`) and clears reconciled `storyOverrides` explicitly through `savePersistedState`, and `hooks/hooks.json` `PostToolUse` matcher is `"Write|Edit|MultiEdit"` (`OQ-C`, `OQ-E`, `OQ-F` closed).
4. `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` runs green with automated coverage for `R1`–`R3`.

## Boundaries

- Belongs to sibling `epic-panel-readability-redesign` (`Epic 8`): all HTML/CSS/JS changes inside `assets/panel.html` and panel guard/a11y tests. This epic touches only `scripts/bmad-engine.mjs`, `scripts/hook-runner.mjs`, `scripts/mcp-server.mjs`, `hooks/hooks.json`, and engine/hook/MCP tests.
- Must not change: existing `R1`–`R23` tool contracts, `overrideKey` format, `skillsCatalog`/`agentsCatalog` presence in `bmad_get_state`, hook single-line stdout isolation, or upstream skills (`C5`).

## References

- parent — `_bmad-output/initiative-bmad-companion/initiative-bmad-companion.md`, Requirements `R24`–`R26`, Constraints `C1`, `C3`, `C4`, `C10`–`C13`
- architecture — `_bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md`, `AD-3`, `AD-5`, `AD-8`, `AD-13`, `AD-14`, `AD-18`, Open Questions `OQ-C`, `OQ-E`, `OQ-F`
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md`, Information Architecture ("Work speaks human", "The current-focus text"), Component Patterns (`Current-focus hero`)

## Notes

- Decision: 2026-11-25 — Tracer bullet is Story 1 (`recentConversations` ring buffer + hook capture + `bmad_update_advisor` schema), proving the `AD-3`/`AD-18` state path across `bmad-engine.mjs`, `hook-runner.mjs`, and `mcp-server.mjs` before Story 2 adds deterministic `currentFocus` synthesis + `plainTitle`/`plainSummary`, Story 3 closes `OQ-C`/`OQ-E`/`OQ-F`, and Story 4 runs the refactor sweep.
- Decision: 2026-11-25 — Folded `OQ-C`, `OQ-E`, and `OQ-F` into this epic per user confirmation so `bmad-engine.mjs`, `hook-runner.mjs`, and `hooks/hooks.json` are hardened in one wave before `Epic 8` starts.
- Decision: 2026-11-25 — Settled `OQ-E` (`PostToolUse` matcher = `"Write|Edit|MultiEdit"`) and focus card label (`basisLabel: "Current focus"`, aligned with `AD-18` and `EXPERIENCE.md` while keeping accurate `conversationCount`) per owner picks.
- Risk reason (`high`): `savePersistedState` merge/clear semantics (`AD-3`, `OQ-F`) and hook capture (`AD-13`) affect every workspace state mutation and `Stop` turn budget; regressions could blank snippets, break `storyOverrides` preservation, or slow hooks past 350ms.
- Waits on epic-dual-progress-reconciliation, epic-execution-queue, epic-hooks-model-router because: builds directly on the reconciled `bmad-engine.mjs`, `hook-runner.mjs`, and `mcp-server.mjs` lanes delivered in Wave 1.
- Layer files: `scripts/bmad-engine.mjs`, `scripts/hook-runner.mjs`, `scripts/mcp-server.mjs`, `hooks/hooks.json`, `tests/hooks-router.test.mjs`, `tests/mcp-surface.test.mjs`, `tests/reconciliation.test.mjs`.
