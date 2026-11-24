---
title: 'Combined code review of Stories 3.2, 4.1 & 4.2 (theme parity + panel accessibility)'
type: review
ticket: review-3.2-4.1-4.2
created: '2026-11-23'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R1, R2]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-panel-a11y/epic-panel-a11y.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-theme-parity/tickets/plan-3.2-canvas-standalone-html-theme-parity.md'
---

# Queue Review — Combined Changes for Stories 3.2, 4.1, 4.2

## Scope

Reviewed the Story 3.2 / 4.1 / 4.2 changes (commit `799747a`, plus the uncommitted 4.3 version
stamp touching the same files) across `assets/panel.html`, `scripts/debrief-engine.mjs`,
`tests/theme-parity.test.mjs`, and `tests/panel-a11y.test.mjs` for edge cases, CSP safety, and
verification gaps. Route: oneshot, deterministic tests only (no nested LLM review).

## Findings

### CSP safety — PASS

- Zero `eval(` / `new Function` / inline event-handler attributes (`onclick=` etc.) / external
  `<script src>` / `<link>` / `fetch(` / `XMLHttpRequest` / `javascript:` URIs in `assets/panel.html`
  (grep counts: 0/0/0). Compliant with `unsafeEval: false`.
- All dynamic SVG/HTML interpolation is `escapeHtml()`-protected, including new `aria-label`
  attributes on diagram nodes, history rows, and the standalone artifact (`assets/panel.html`
  diagram/history renderers; `scripts/debrief-engine.mjs:1382-1388` `esc()` escapes `&` first).
- Embedded export JSON keeps `<` escaped as `\u003c` (`scripts/debrief-engine.mjs:1214`).

### Edge cases — PASS (3 minor, non-blocking notes)

1. `btnRefresh` shows the "🔄 Synced" toast before the await resolves; a subsequent failure toast
   replaces it (`refreshState({silent:false})`). Optimistic-message nit only.
2. Escape dismissal of the lesson form is bound twice (form-level + window-level listener);
   `setCustomLessonFormVisible(false)` is idempotent, so harmless.
3. Standalone artifact `resolveTokens()` returns empty strings if `getComputedStyle` throws; the
   artifact embeds its own `<style>` tokens so this is practically unreachable, and Canvas
   ignores invalid `fillStyle` assignments (keeps last value).
- Busy-state buttons cannot stick disabled: every RPC rejects after a 15 s timeout
  (`assets/panel.html:1371-1376`) and all handlers re-enable in `finally`.
- Reduced motion: rAF pulse loops are skipped, but scene advancement still redraws a static
  highlighted frame per scene via `advanceSceneLoop` → `renderExplainerTab` → `drawExplainerFrame`
  (`assets/panel.html:2425-2435`), matching the 4.2 contract. Theme-change re-render wired in both
  panel and exported artifact.

### Verification gaps — none material

- `tests/panel-a11y.test.mjs` (1255 lines) executes the real panel inline script via
  `vm.runInContext` (`tests/panel-a11y.test.mjs:521-523,1040`) against a hand-rolled DOM stub —
  behavior (tab roving tabindex, arrow-key nav, aria-pressed updates, Escape + focus restore,
  SVG-node Enter/Space toggle-off, history snapshot + Return to Latest, reduced-motion) is
  exercised against shipped code, not reimplementations.
- `tests/theme-parity.test.mjs` covers token contracts, WCAG contrast floors (>=4.5:1 text,
  >=3:1 accents), CSP static safety, live host-theme sync, Canvas parity, and XSS escaping;
  it also runs the real panel script in a vm (`tests/theme-parity.test.mjs:321-322`).
- Engine-side 3.2 parity (standalone artifact Dark HUD + Field Desk Light palettes, runtime
  `prefers-color-scheme` re-render) is covered in `tests/debrief-engine.test.mjs:1167-1275`.
- Known limitation (accepted, zero-dependency constraint): DOM stub fidelity is partial; no
  real-browser/AT testing is automated.

## Verification Evidence (all run 2026-11-23, exit 0)

- `node --test tests/` → 173 tests, 173 pass, 0 fail (32 suites).
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs` → exit 0.
- MCP smoke (`initialize` + `tools/list` + `resources/list` piped to `node scripts/mcp-server.mjs`)
  → 3 frames, `serverInfo.version 0.3.0`, 8 tools, `ui://vibe-debrief/panel.html` served.
- Hook smoke (`echo '{}' | node scripts/hook-runner.mjs session-start`) → v0.3.0 banner, exit 0.
- `node scripts/check-version-sync.mjs` → all 4 version locations synced to 0.3.0, exit 0.

## Outcome

No code changes required; findings are advisory only. Stories 3.2, 4.1, 4.2 (and the uncommitted
4.3 stamp) are approved from a code-review standpoint.
