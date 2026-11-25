---
title: "Anytime explainer gate, Tiny-Turn Minimal Mode & Stop confidence"
ticket: 4
status: done
---

# Story 5.4 — Anytime explainer gate, Tiny-Turn Minimal Mode & Stop confidence

> **Post-hoc reconciliation record** written 2026-11-25 by the Wave 2 retrospective run
> (`epic-cockpit-contract-retrospective.md`, BMAD Queue Task #4). This story shipped without a
> plan tracker: its scope landed across squash commits and was absorbed by dependent stories.
> The tracker was reconciled via `tickets.py mark epic-cockpit-contract 5.4 done` after the
> delivery evidence below was verified in-session. This is a record of what was built, not an
> original build plan.

## Intent (from tickets.toml entry 4)

Populate `explainerScenes` (< 5ms) on non-minimal turns while keeping
`buildExplainerScenesIfComplex` returning `[]` for simple turns, enforce the Tiny-Turn
`minimalMode` gate, and emit `heuristicConfidence` and `rawQuote` (<= 280 chars) within
<= 50ms Stop-hook latency. Hands off minimalMode and low-confidence signals to Story 5.5 and Epic 6.

## What landed, and where (verified 2026-11-25)

- **Explainer gate** — `buildExplainerScenesIfComplex` (`scripts/debrief-engine.mjs:1015`) returns
  `[]` for simple/null complexity; `ensureDebriefEnriched` populates scenes only for
  `complexity.level === "complex"` or explicit override (`scripts/debrief-engine.mjs:1364-1376`).
  Tests: `tests/debrief-engine.test.mjs:566-571` (simple/null → `[]`), `:600-605` (force override).
  The "Anytime" unlock for every non-minimal turn is delivered at the UI layer by Story 6.5
  (epic-cockpit-hud-core R5), per the documented complex-only scene convention in AGENTS.md.
- **Confidence & rawQuote** — `normalizeHeuristicConfidence` clamps 0–1 with derived fallbacks
  0.45/0.65/0.9 (`scripts/debrief-engine.mjs:1279-1290`); `rawQuote` sliced to 280 chars
  (`:1388`); both emitted in the enriched payload (`:1387-1417`) and passed through the widened
  MCP publish schema (`scripts/mcp-server.mjs:224`, `:925`).
- **minimalMode field** — engine-side pass-through with conservative `false` default
  (`scripts/debrief-engine.mjs:1389`); round-trip tests at `tests/transports-and-sync.test.mjs:460,588`
  and `tests/debrief-engine.test.mjs:1943-1944,2078,2194`.
- **Tiny-Turn 4-condition gate (deviation, accepted)** — computed client-side in
  `resolveMinimalMode` (`assets/panel.html:3952-3986`, landed via Story 6.5 work): all four spec
  conditions plus stronger vetoes — `heuristicConfidence < 0.55` forces non-minimal *before* an
  explicit `minimalMode: true` is honored, `rawQuote` vetoes, unverified proof claims veto (C9),
  generated scenes veto. R4's engine-side computation wording diverges from this as-built locus;
  the deviation is documented at `assets/panel.html:3943-3951` and proposed for spec
  reconciliation in the epic retrospective (Action item A1).
- **Stop-hook latency** — heuristic synthesis + atomic save held within ≤50ms (p95 and max)
  by `tests/atomic-state.test.mjs:577-667`.

## Commit attribution (squash history — no commit subject names 5.4)

- `23c9b4b` — engine `minimalMode` / `normalizeHeuristicConfidence` fields (folded into the
  v0.3.0-stamp commit; verified via `git log -S "minimalMode" -- scripts/debrief-engine.mjs`).
- `abac6ec` — panel `resolveMinimalMode` gate (verified via `git log -S "resolveMinimalMode"`).
- `40b33d3` — accompanying engine/a11y test expansion.
- Note: `git_evidence.py` tagged `2ef7728` ("release(bmad-companion): v0.5.4") as story 5.4 — a
  false match on the version substring, not evidence for this story.

## Verification (executed 2026-11-25, retrospective run)

- `node --test "tests/*.test.mjs"` → 274 tests / 50 suites / 274 pass / 0 fail.
- `node scripts/check-version-sync.mjs` → OK, 4/4 locations at 0.4.0.
- `node --check scripts/*.mjs` → pass; repo-root `node scripts/validate.mjs` → exit 0.
- Dependent stories 5.5 ("Builds on Story 4's minimalMode/confidence fields") and 6.5 completed
  and done on top of this scope.
