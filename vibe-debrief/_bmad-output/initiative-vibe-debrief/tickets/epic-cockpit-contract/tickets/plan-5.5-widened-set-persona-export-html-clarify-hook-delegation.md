---
title: 'Widened set_persona, export_html & Clarify hook delegation'
type: feature
ticket: 5
created: '2026-11-25'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R3, R5]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/epic-cockpit-contract.md'
---

# Build Ticket 5.5 — Widened set_persona, export_html & Clarify Hook Delegation

## Intent

Completes Story 5.5 (`epic-cockpit-contract` Story 5, R3 / R5, AD-5 / AD-13 / AD-17 / OQ-5):
Builds on Story 5.3's model/plugin discovery and Story 5.4's minimalMode/confidence fields to widen `vibe_debrief_set_persona` (`language`, `preferredModel`, `themePreference`) and `vibe_debrief_export_html` (`conceptSlug`, `targetPlugin`) in `scripts/mcp-server.mjs`, intercept `[Vibe Debrief — Clarify]` and `[Vibe Debrief — Deep Refresh]` in `scripts/hook-runner.mjs` using `discoverCheapestEnabledModels()` for model-agnostic `CreateSession` / active-session delegation without hardcoded Argon, and add optional OQ-5 publish hints to `skills/vibe-debrief/SKILL.md` and `skills/eli5/SKILL.md`.

## Implementation Details

- `scripts/hook-runner.mjs`:
  - Imported `discoverCheapestEnabledModels` from `./debrief-engine.mjs`.
  - Updated `session-start` hook mode to resolve the preferred or cheapest candidate dynamically via `discoverCheapestEnabledModels()` and `state.preferredModel`.
  - Updated `user-prompt` hook mode to intercept `[Vibe Debrief — Clarify]` prompts, dynamically resolving the delegation model (`prompt` override, `state.preferredModel`, top result from `discoverCheapestEnabledModels()`, or `"active-session"` fallback) without hardcoded Argon, emitting single-line protocol-compliant JSON with cost-aware `CreateSession` delegation instructions.
  - Updated `[Vibe Debrief — Deep Refresh]` to also leverage `discoverCheapestEnabledModels()`.

- `skills/vibe-debrief/SKILL.md` & `skills/eli5/SKILL.md`:
  - Added "Optional OQ-5 Cockpit HUD Publish Hints (v0.4.0+)" sections covering additive OQ-5 fields: `verdict`, `waitingOnYou` (with `chips` and `allowInlineReply`), `choices` (with `tradeOffs`), dual-coded `xray` (`plain` / `tech`), 5-grammar `diagramSpec`, `concepts` pills (with `stage1` and `stage2`), `microBlocks` order, and honesty metrics (`heuristicConfidence`, `rawQuote`).
  - Preserved complete backward compatibility with v0.2.0.

- `tests/transports-and-sync.test.mjs`:
  - Added unit test verifying `user-prompt` intercepts `[Vibe Debrief — Clarify]` and emits cost-aware `CreateSession` instructions with dynamically discovered cheapest model (`openai/gpt-5-nano`) without hardcoding Argon.
  - Added unit test verifying `user-prompt` Clarify falls back cleanly to active session when no model is configured.
  - Added unit test verifying both `skills/vibe-debrief/SKILL.md` and `skills/eli5/SKILL.md` exist and document optional OQ-5 publish hints while maintaining v0.2.0 compatibility.

## Verification (Executed 2026-11-25)

- `node --check scripts/*.mjs` → exit 0.
- `node --test "tests/*.test.mjs"` → 272 tests across 50 suites pass, 0 fail, exit 0 (~10.5s).
- `node scripts/check-version-sync.mjs` → OK: all 4 version locations synced to 0.4.0 (exit 0).
- `node ../scripts/validate.mjs` → all plugins validated, exit 0.

## Re-verification (Queue Task #6 deterministic code review, 2026-11-25)

Oneshot route, review=none: direct read-through of `scripts/mcp-server.mjs` (set_persona 959-1012, export_html 1032-1052), `scripts/hook-runner.mjs` (Clarify 146-174, Deep Refresh 176-197), and `scripts/debrief-engine.mjs` (Stage 2 fallback 1925-1964, discoverCheapestEnabledModels 3257-3389) found no edge-case or architectural-compliance defects; all dynamic export strings are `escapeHtml`-escaped and `payloadJson` escapes `<` as `\u003c` (debrief-engine.mjs:1897-1902).

- `node --check scripts/*.mjs` → exit 0.
- `node --test "tests/*.test.mjs"` → 274 tests across 50 suites pass, 0 fail, exit 0 (~10.6s). (+2 vs. the original 272 come from concurrent uncommitted UX test edits in `tests/export-parity.test.mjs` / `tests/panel-a11y.test.mjs`, not from story 5.5.)
- `node scripts/check-version-sync.mjs` → OK: all 4 version locations synced to 0.4.0 (exit 0).
- `node ../scripts/validate.mjs` → bmad-companion v0.5.4, vibe-debrief v0.4.0, project-colors v0.1.0 validated, exit 0.

Minor non-blocking observation: `discoverCheapestEnabledModels` reads provider JSON with unbounded `readFileSync` (debrief-engine.mjs:3267-3273), unlike bmad-companion's bounded reads; low risk (local config, try/catch guarded).
