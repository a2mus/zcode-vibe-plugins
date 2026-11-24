---
title: '5-state Waiting On You chips, inline reply & composable microBlocks'
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
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/epic-cockpit-hud-core.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 6.2 — 5-State Waiting On You Chips, Inline Reply & Composable microBlocks

## Intent

Completes Story 6.2 (`epic-cockpit-hud-core` Story 2, R2): builds on Story 6.1's 1-strip
shell and `radar-card` to render all 5 `waitingOnYou` states (`Choice`, `Action`, `Reply`,
`Blocked`, `None`) with `action-chip` quick replies and an `inline-reply-box` dispatching via
`ui/message`, plus a composable `microBlocks` orchestrator (`choice-grid` with `choice-item`
`messagePrompt` dispatch and `34x4px` trade-off bars, `proof-pill` with expandable
`proof-detail`, `audit-row` rule promotion, `lessons`, and `Memory & History`) that renders
hybrid replies without truncating to a single Bug/Build template. Hands off the `microBlocks`
slot registry and the shared `sendUiMessage` `ui/message` helper to Stories 6.3, 6.5, and Epic 7.

## Implementation Details

- `assets/panel.html`:
  - Added the shared `sendUiMessage(text, { okToast, riskToast, busyEl, busyLabel })` helper
    (one-click `ui/message` dispatch with busy state + toast); refactored `Distill` to reuse it.
  - Added `renderWaitingStrip(debrief)` rendering the 5-state radar footer: semantic
    `wait-badge`, wrapping `action-chip` quick replies (`.primary` / `.selected` + `aria-pressed`),
    default `Yes`/`No` chips for `Reply`, and an `inline-reply-box` (`#inlineReplyInput` +
    `#btnSendInlineReply`, wired for click and `Enter`) shown only for `Reply` with
    `allowInlineReply`. Chip/reply dispatch marks selection and toasts; `None` renders a quiet
    `All Clear` badge with no chips.
  - Added the `MICRO_BLOCK_SLOTS` registry (`unclear`, `choices`, `diagram`, `proof-audit`,
    `concepts`, `lessons`) and `renderMicroBlocks(debrief)` orchestrator driven by
    `debrief.microBlocks` (with an engine-mirroring fallback for raw debriefs). It toggles the
    `choices`, `diagram`, `proof-audit`, and `lessons` blocks plus the narrative storyboard in one
    scroll; `unclear` (6.5) and `concepts` (epic-concept-deep-dive) are registered reserved slots.
  - Added `renderChoiceGrid` (`choice-item` cards with `20x20px` `choice-key`, plain/tech subtext,
    `34x4px` `tbar-track`/`tbar-fill` trade-off bars, `.picked` state, `messagePrompt` dispatch) and
    `renderProofPills` (`ok`/`risk`/`info` pills toggling monospace `proof-detail` via
    `uiState.expandedProofIds`, with `aria-expanded`/`aria-controls` and keyboard focus parity).
  - Added transient `uiState.selectedChoiceId` (reset on turn change, preserved on same-turn
    refresh) and new component CSS (Dark HUD + Field Desk Light semantic-wash overrides).
- `tests/panel-a11y.test.mjs`:
  - Added a `Story 6.2` suite (9 tests): static markup/CSP + `34x4px` bar contract, all 5 waiting
    states, action-chip `ui/message` dispatch + selection, `choice-grid` trade-off bars +
    `messagePrompt` dispatch, inline reply submit/`Enter`, `proof-pill` expand/collapse + keyboard
    focus, hybrid multi-block composition vs minimal block list, `audit-row` rule promotion, and
    XSS escaping of dynamic chip/choice labels.
  - Harness correctness fixes: the static-id scan now ignores the inline `<script>` (template
    literals previously registered phantom elements), and `parseRenderedChildren` recognizes
    `action-chip`, `choice-item`, `proof-pill`, and `btn-promote-audit`.

## Verification (Executed 2026-11-24)

- `node --test tests/` — exits 0 (`211` tests across `37` suites: `211` pass, `0` fail; Node v26.12.1).
- `node --test "tests/*.test.mjs"` — exits 0 (`211` pass, `0` fail; quoted-glob project gate).
- `node scripts/check-version-sync.mjs` — exits 0 (all 4 version locations synced to `0.3.0`).
- `node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --check scripts/check-version-sync.mjs` — exits 0.
- `node ../scripts/validate.mjs` — exits 0 (repo-root marketplace/JSON/inline-script validation).
- Headless Chrome (`--headless=new --allow-file-access-from-files`) hybrid-turn inspection of
  `assets/panel.html` behind a mock MCP host:
  - `320px` / `380px` / `460px`: `overflowX: false` at every width (no truncation).
  - Hybrid composition: `choices`, `diagram`, `proof-audit`, `lessons`, and `implStoryboard` all
    visible together; `2` choice-items, `2` proof-pills, `2` action-chips, `3` trade-off bars.
  - Dispatches: choice-item click and action-chip click each sent `ui/message`
    (`"Proceed with Option A: SSE"`).
  - All 5 waiting states: `choice` (2 chips), `action` (1 chip), `reply` (2 default chips +
    `inline-reply-box` `flex`), `blocked` (1 chip), `none` (0 chips, reply hidden), each with the
    correct `wait-badge` class and label.
