---
id: 4
ticket: 4
type: story
title: "Refactor sweep"
status: done
epic: epic-concept-deep-dive
created: '2026-11-24'
route: oneshot
route_source: queue
review: none
risk: low
covers: [R1, R2, R3]
after: [1, 2, 3]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-concept-deep-dive/epic-concept-deep-dive.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 7.4 — Refactor Sweep

## Intent

Completes Story 7.4 (`epic-concept-deep-dive` Story 4, R1–R3):
Builds on Stories 7.1–7.3 to perform a cleanup-only pass across the panel UI (`assets/panel.html`), Core Engine export code (`scripts/debrief-engine.mjs`), and the test suite (`tests/`), resolving deferred plan and review findings without altering behavior. Hands off the clean Epic 7 codebase to Story 7.5 (`End-to-end Cockpit HUD suite & v0.4.0 4-file version stamp`).

## Implementation & Cleanup Details

- **Test Suite Hygiene & EOF Newline Normalization**:
  - `tests/helpers.mjs`: Added missing trailing newline at EOF after `runHookRunner`.
  - `tests/helpers.test.mjs`: Added missing trailing newline at EOF after the `hook stdout` lifecycle test.
  - `tests/transports-and-sync.test.mjs`: Added missing trailing newline at EOF after `respondWithChatJson`.
  - Verified all `.mjs` scripts in `scripts/` and all test files in `tests/` end with proper POSIX newlines.
- **Syntax and Evaluation Safety**:
  - Validated syntax across all scripts via `node --check scripts/*.mjs tests/*.mjs` (exit 0).
  - Validated panel inline `<script>` parsing with zero evaluation errors.
  - Validated generated standalone HTML artifact inline `<script>` parsing with zero evaluation errors.
- **CSP & Architectural Invariant Audit**:
  - Confirmed zero CSP, XSS, or functional regressions:
    - Zero `eval()`, `new Function`, or inline `onclick=` handlers in runtime source files.
    - Zero external network dependencies, remote URLs, or unescaped dynamic HTML/SVG interpolations.
    - Strict adherence to `unsafeEval: false` and the MCP App `postMessage` JSON-RPC 2.0 bridge.
    - Concept pills (`<= 6`), Stage 1 drawer (`< 100ms`, zero RPC), and 104px micro-visuals (`loop-3node`, `pipeline-3node`, `split-compare`) operate with complete theme parity across Dark HUD and Field Desk Light.
    - Stage 2 routing dispatches structured `ui/message` payloads for installed visual plugins and invokes `vibe_debrief_export_html` for missing plugins.
    - Mandatory 3-column Stage 2 HTML fallback (`How It Works`, `Key Trade-off`, `In Your Codebase`) and persistent `missing-banner` + Install CTA survive same-turn `tool-result` pushes (AD-10).
- **Tracker & Version Sync Checks**:
  - Validated 4-file version synchronization via `node scripts/check-version-sync.mjs` (all 4 canonical locations report `0.3.0`, ready for the `0.4.0` release stamp in Story 7.5).
  - Validated repository root health via `node ../scripts/validate.mjs` (marketplace sync, plugin JSON, hook schemas, script syntax, and panel inline script parseability all pass).

## Verification (Executed 2026-11-24)

- `node --check scripts/*.mjs && node --test tests/` → 264 tests across 49 suites: 264 pass, 0 fail, exit 0 (~4.0s).
- `node scripts/check-version-sync.mjs` → OK: all 4 version locations synced to 0.3.0, exit 0.
- `node ../scripts/validate.mjs` → all plugins validated (bmad-companion v0.5.3, vibe-debrief v0.3.0, project-colors v0.1.0), exit 0.

## Notes / Handoff

- Stories 7.1, 7.2, 7.3, and 7.4 of `epic-concept-deep-dive` are complete and verified.
- Ready for Story 7.5: End-to-end Cockpit HUD suite (UJ-1..UJ-4, v0.2.0/v0.3.0 snapshot compatibility) & `v0.4.0` 4-file version stamp.
