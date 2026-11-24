---
title: 'Client-side X-Ray Plain (STE-80) <-> Tech instant toggle'
type: feature
ticket: 3
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R3]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/epic-cockpit-hud-core.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 6.3 — Client-Side X-Ray Plain (STE-80) ↔ Tech Instant Toggle

## Intent

Completes Story 6.3 (`epic-cockpit-hud-core` Story 3, R3, C8): turns the
`xray-toggle` into a CSS-only swap between pre-bound `Plain` (`STE-80`) and
`Tech` (`.sym` symbols, paths, commands, exit codes, raw proof lines)
representations across `radar-card` and Story 6.2 `microBlocks` (headline,
waiting prompt, chips, choices, proof pills/details). The toggle now writes one
attribute (`#appShell[data-xray-mode]`) and never re-renders, issues an RPC, or
calls an LLM. Raw X-Ray strings are escaped with `escapeHtml()` **before** any
`.sym` badge wrapping (C8). The dual-coding helpers are exported from
`scripts/debrief-engine.mjs` so Story 6.4 (SVG inspector) and Story 6.6
(standalone HTML export) reuse the same markup contract.

## Implementation Details

- `assets/panel.html`:
  - Added the `.xray-dual` / `.xray-plain` / `.xray-tech` CSS contract: Plain is
    shown and Tech hidden by default; `.app-shell[data-xray-mode="tech"]`
    reverses both. Generalized the `.sym` badge style (mono, accent wash,
    `overflow-wrap: anywhere`) beyond the headline, and moved the Field Desk
    Light `.sym` contrast override onto the shared class.
  - Added the Story 6.3 helpers `escapeRegExp`, `collectXrayTokens(debrief)`
    (OQ-5 `xray.tech` symbols/paths/commands/exit codes + `touchedFiles`,
    de-duplicated, >= 2 chars), `renderPlainXrayHtml`, `renderTechXrayHtml`
    (escape first, then wrap already-escaped tokens via a split pass that cannot
    re-match inside badge markup), `buildDualCodedMarkup` (optional `rootClass`),
    and `bindDualCoded(el, opts)`. Removed the old sequential-replace
    `formatEscapedWithSym`.
  - `renderRadarCard` now pre-binds the `Plain`/`Tech` headline pair (both
    clipped to `<= 14` words). `renderWaitingStrip` dual-codes
    `#waitingPromptText` (`waiting.techPrompt` when present) and every
    `action-chip` label (`chip.techLabel`). `renderChoiceGrid` dual-codes the
    choice title and `plainSubtext`/`techSubtext` subtext. `renderProofPills`
    dual-codes pill claims (Tech uses `xray.tech.proofLines[idx]` or
    `claim · evidence`) and `proof-detail` (Tech appends the raw evidence).
  - `#btnXrayToggle` click handler reduced to flipping `uiState.xrayMode` and
    calling `syncXrayControls()` — no `renderRadarCard()` re-render, so the swap
    is CSS-only with zero RPC and transient UI state is untouched.
- `scripts/debrief-engine.mjs`:
  - Added exported `collectXrayTechTokens(debrief)`, `renderXrayTechHtml(text,
    tokens, { maxWords })`, and `buildXrayDualCodedMarkup({ plain, tech, tokens,
    maxWords })` using the same escape-then-badge rule (`clipXrayHeadline` caps
    at `maxWords` when requested).
  - `generateStandaloneHtmlArtifact` now emits the hero `<h1>` with both
    representations pre-bound, sets `<body data-xray-mode="plain">`, and ships
    the `.xray-dual` swap rules plus the `.sym` badge style, so Story 6.6 only
    needs the local toggle button.
- `tests/panel-a11y.test.mjs`:
  - Added `readXrayRepresentation()` / `stripXrayTags()` helpers (span-depth
    balanced, so nested `.sym` badges are read correctly).
  - Added the `Story 6.3` suite (4 tests): CSS-only swap contract + CSP safety,
    dual-coded coverage of headline/prompt/chip/choice/proof pill/proof detail,
    C8 XSS escaping on every surface, and the `< 16ms` / zero-RPC / no-re-render
    toggle (including same-turn refresh keeping the active mode).
  - Migrated the two headline assertions that read `textContent` (history
    snapshot restore, `<= 14`-word radar headline) to the new plain/Tech spans.
- `tests/debrief-engine.test.mjs`:
  - Added the `Story 6.3` suite (4 tests) for token collection, C8 escaping,
    Plain fallback, and the pre-bound export headline + `body[data-xray-mode]`.

## Verification (Executed 2026-11-24)

- `node --test tests/` — exits 0 (`219` tests across `39` suites: `219` pass,
  `0` fail; Node v26.12.1). This is the ask's named verification command and it
  succeeded unquoted on this Node version.
- `node --test "tests/*.test.mjs"` — exits 0 (`219` pass, `0` fail; quoted-glob
  project gate).
- `node scripts/check-version-sync.mjs` — exits 0 (all 4 version locations
  synced to `0.3.0`).
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs
  && node --check scripts/hook-runner.mjs && node --check
  scripts/check-version-sync.mjs` — exits 0.
- Inline panel `<script>` parsed with `node:vm` `new vm.Script(...)` — OK.
- `node ../scripts/validate.mjs` — exits 0 (bmad-companion `0.5.3`,
  vibe-debrief `0.3.0`, project-colors `0.1.0` validated).
- Headless Chrome (`--headless=new --allow-file-access-from-files
  --disable-web-security`) against `assets/panel.html` behind a mock MCP host at
  `320px` and `380px`:
  - Plain: `.xray-plain` computed `display: inline`, `.xray-tech` `display:
    none`; visible headline `Guard the retry path.`
  - Tech (after 5 clicks): `.xray-plain` `display: none`, `.xray-tech`
    `display: inline`; visible headline `Guard retryWebhook in src/webhook.mjs`;
    choice subtext `retryWebhook maxAttempts=3`; chip
    `node --test tests/webhook.test.mjs`; proof pill `retryWebhook returns 200
    after 3 tries (node --test tests/webhook.test.mjs)`.
  - Swap timing across 5 toggles: `max 0ms` (below `performance.now()`
    resolution), well inside the `< 16ms` budget.
  - RPC delta across the 5 toggles: `total 0`, `tools/call 0`, `ui/message 0`.
  - `overflowX: false` at both widths.
- Exported artifact (`generateStandaloneHtmlArtifact`) loaded in headless
  Chrome: `<body data-xray-mode="plain">` shows only `Guard the retry path.`;
  flipping the attribute shows only `Guard retryWebhook in src/webhook.mjs`
  (no duplicated headline text), with 2 `.sym` badges pre-bound.

## Notes / Handoff

- `collectXrayTokens` / `renderTechXrayHtml` / `buildDualCodedMarkup` are the
  Story 6.4 (SVG node inspector symbol detail) and Story 6.6 (export toggle)
  entry points; the panel keeps local mirrors because it stays self-contained.
- Tech fallbacks are never fabricated: when a payload omits `techPrompt`,
  `techLabel`, `techSubtext`, or `proofLines`, Tech shows the escaped Plain
  text (with `.sym` badges on known tokens). `waitingOnYou.techPrompt` is read
  if a future OQ-5 revision provides it.