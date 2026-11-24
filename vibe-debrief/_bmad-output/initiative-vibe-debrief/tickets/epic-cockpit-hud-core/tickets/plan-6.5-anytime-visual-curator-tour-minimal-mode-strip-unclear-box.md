---
title: 'Anytime Visual curator tour, Minimal Mode strip & unclear-box'
type: feature
ticket: 5
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R5, R6]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-hud-core/epic-cockpit-hud-core.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 6.5 — Anytime Visual Curator Tour, Minimal Mode Strip & Unclear-Box

## Intent

Completes Story 6.5 (`epic-cockpit-hud-core` Story 5, R5 + R6):
Builds on Story 6.2's microBlocks orchestrator / `sendUiMessage` dispatch, Story 6.3's dual-coded X-Ray binding helpers, Story 6.4's `powerup-dock`, and Epic 5's OQ-5 payload fields (`minimalMode`, `heuristicConfidence`, `rawQuote`, `microBlocks: ["unclear", …]`) to (1) keep `Visual` (`explainer-stage`) and `[Animate]` unlocked on every non-minimal turn with `[Animate]` pulsing on complex turns (from 6.4), (2) collapse trivial high-confidence turns to a 1-line `minimal-strip` (`Minimal Mode · Verified`) with a 1-click `Expand`/`Collapse` override, and (3) render the low-confidence `unclear-box` (raw quote <= 280 chars as text, `Show Raw Reply` toggle, `Clarify (Fast / Cheapest Model)` `ui/message` dispatch) instead of collapsing or fabricating verified claims.

## Implementation Details

- `assets/panel.html`:
  - CSS: added `.minimal-strip` / `.minimal-badge` / `.minimal-label` / `.minimal-expand` (DESIGN.md tokens: `--bg-card`, `--ok-border`, `--ok-soft`, `--ok`), `.micro-block.unclear-box` (`--warn-soft`, `--warn-border`), `.unclear-title` (`--warn`), `.unclear-notice` (`--text-primary` per the Field Desk Light Semantic Wash Rule), `.raw-quote` / `.raw-reply-box` (mono, `--bg-elevated`), `.unclear-actions`, and solid amber `.btn-warn` (`--warn` bg + `--text-on-warn`, auto-swapping `#140d00` dark / `#ffffff` light). Token-only — zero hardcoded hex in new rules.
  - Markup: added `#minimalStrip` (`role="status"` `aria-live="polite"`, badge `✅ Minimal Mode · Verified`, dual-coded `#minimalStripLabel`, `#btnMinimalExpand` with `aria-expanded` + `aria-controls="radarCard"`) above `#radarCard`; replaced the reserved `#microBlockUnclear` slot with the full unclear-box (`#unclearConfidencePill`, `#unclearNotice`, `<pre id="unclearRawQuote">`, `#btnClarifyFast`, `#btnShowRawReply` with `aria-expanded`/`aria-controls`, `<pre id="unclearRawReplyBox">`); added `id="visualEmptyTitle"` to the Visual empty-prompt heading. No inline `onclick=`, no `eval`/`new Function`.
  - JS: added `resolveMinimalMode(debrief)` — R6 hard override (`heuristicConfidence < 0.55` or any `rawQuote` → never minimal), explicit `minimalMode: true` force, welcome-debrief guard, and the documented Tiny-Turn auto-trigger fallback (waitingOnYou explicitly `none`, 0–1 low-risk files, `complexity.score <= 1`, 0 choices, 0 scenes, no unverified proofClaims per C9). A default `minimalMode: false` from `ensureDebriefEnriched` is treated as "no opinion" so the observable gate still fires (see Notes).
  - Added `renderMinimalStrip(debrief)` (toggles strip/radar visibility, binds the dual-coded label via Story 6.3 `bindDualCoded`, syncs `Expand`/`Collapse` + `aria-expanded`; returns the collapsed flag), `renderUnclearBox(debrief)` (confidence pill, 280-char quote clamp written via `textContent` only), and `syncRawReplyVisibility()` (reveals `state.lastAssistantMessage` verbatim via `textContent`, zero RPC).
  - Updated `renderActiveDebrief` to compute the collapsed flag first; `renderMicroBlocks(debrief, { collapsed })` now hides every slot + both storyboards while collapsed and renders the `unclear` slot when active; `resolveMicroBlocks` fallback now mirrors engine `normalizeMicroBlocks` (`unclear` pushed when `heuristicConfidence < 0.55` or `rawQuote` present).
  - Updated `renderExplainerTab` (null-safe debrief; empty-state title now honest: `Minimal turn — no tour generated` on minimal turns vs `No tour generated yet — anytime playback is one click away` on non-minimal turns; `Generate Quick Tour` via `vibe_debrief_generate_explainer` unchanged, Visual tab never locked).
  - Wiring (all `addEventListener`, static elements): `#btnMinimalExpand` toggles `uiState.minimalModeExpanded` and re-renders via `renderPanelState(currentState, { fromHistory: viewingHistoryIdx !== null })` keeping focus on the button; `#btnShowRawReply` toggles `uiState.showRawReply` client-side only; `#btnClarifyFast` dispatches a self-contained `[Vibe Debrief — Clarify]` `ui/message` mirroring the Distill delegation — resolves the model dynamically (`preferredModel` → `recommendedModel` → `availableModels[0]` → `recommendedGeminiModel` → `active-session`, never hardcodes a model name), embeds confidence %, the <= 280-char raw quote, last user prompt (<= 600) and last AI response (<= 2200), instructs an honest `vibe_debrief_publish` (never fabricate verified claims), with busy state + ok/risk toasts via `sendUiMessage`.
- `tests/panel-a11y.test.mjs`:
  - Stub harness: added a `vibe_debrief_generate_explainer` branch responding with 2 generated scenes (mirrors `scripts/mcp-server.mjs` behavior) so the Anytime-tour flow is testable end to end.
  - Added `Story 6.5 — Anytime Visual curator tour, Minimal Mode strip & unclear-box` suite (7 tests): static markup/ARIA/token-CSS contract; trivial-turn collapse + 1-click Expand/Collapse with focus retention and dual-coded strip label; Tiny-Turn auto-trigger + 5 refusal cases (unverified proof C9, complex score, missing explicit `waitingOnYou`, 2 files, R6 low-confidence beating explicit `minimalMode: true`); Visual unlocked on non-minimal turns with honest empty-state copy, Quick Tour generation → 2 scene pills → Play/Pause `aria-pressed` sync, and minimal-turn `Minimal turn — no tour generated` copy; unclear-box on low-confidence Stop turns (280-char clamp, hostile `<img onerror>` quote kept as text with empty `innerHTML`, Show Raw Reply toggle with zero RPC); Clarify `ui/message` dispatch (tag, dynamic cheapest model `openai/gpt-5-nano`, no hardcoded argon, `vibe_debrief_publish` instruction, quote + raw reply carried, toast-ok, busy cleared); raw-payload `rawQuote`-only fallback surfacing the unclear-box without collapse.

## Verification (Executed 2026-11-24)

- `node --test tests/` — exits 0 (`231` tests across `41` suites: `231` pass, `0` fail; +7 Story 6.5 tests over the 224 at Story 6.4).
- `node scripts/check-version-sync.mjs` — exits 0 (`0.3.0` synced across all 4 locations).
- `node ../scripts/validate.mjs` — exits 0 (`bmad-companion`, `vibe-debrief`, `project-colors` validated, inline panel script parseable).
- Headless Chrome (`--headless=new --allow-file-access-from-files --virtual-time-budget=20000 --dump-dom`) drove the real `assets/panel.html` in an iframe against a mocked MCP Apps bridge — **34/34 PASS, 0 FAIL** covering exactly the ticket's three turns:
  - trivial turn → `minimal-strip` flex with `✅ Minimal Mode · Verified` badge, radar/diagram/storyboards hidden, `Expand` reveals radar (flex) + diagram (block) with `aria-expanded="true"` and label `Collapse`, collapse-back works;
  - non-minimal simple turn → no strip, `Visual` tab + `[Animate]` enabled, empty-state copy `🎬 No tour generated yet — anytime playback is one click away`, `Generate Quick Tour` → stage block + 2 scene pills → Play sets `aria-pressed="true"` / `⏸ Pause`;
  - low-confidence turn (`heuristicConfidence: 0.42`, `minimalMode: true`, hostile > 280-char `rawQuote`) → strip suppressed (R6 override), unclear-box flex, `Confidence 42%` pill, quote clamped to exactly 280 chars with `<img onerror>` inert as text, Show Raw Reply reveals `state.lastAssistantMessage`, Clarify dispatched one `ui/message` starting `[Vibe Debrief — Clarify]` with dynamic model `openai/gpt-5-nano` (no argon), `vibe_debrief_publish` instruction and quote carried;
  - light-theme spot check: strip `rgb(255,255,255)` (`--bg-card` light), unclear-box `rgba(217,119,6,0.12)` (`--warn-soft` light).

## Notes / Handoff

- Dependency-gap findings (pre-existing, out of 6.5 scope): Epic 5 Story 5.4's engine-side 4-condition `minimalMode` auto-gate is not implemented (`ensureDebriefEnriched` passes `minimalMode` through, defaulting `false`), and Story 5.5's `[Vibe Debrief — Clarify]` interception is absent from `scripts/hook-runner.mjs` (only `[Vibe Debrief — Deep Refresh]` is intercepted; no `plan-5.4`/`plan-5.5` ticket files exist). The panel compensates within its boundary: the documented Tiny-Turn auto-trigger runs client-side (mirroring the existing `resolveMicroBlocks` fallback pattern), and the Clarify `ui/message` is a self-contained delegation prompt that works without the hook intercept. If 5.4/5.5 land later, explicit `minimalMode: true` and the hook's `additionalContext` are honored as-is — no panel change needed.
- `minimal-strip` and `unclear-box` are mutually exclusive by construction (`rawQuote` or confidence < 0.55 veto the collapse), satisfying R6's "instead of collapsing to minimal-strip or fabricating verified claims".
- Handoff to Story 6.6 (standalone HTML export parity): mirror `resolveMinimalMode`, the `minimal-strip` markup, and the `unclear-box` (quote via text-equivalent escaping) inside `generateStandaloneHtmlArtifact`; the new CSS rules are token-only, so the export's `@media (prefers-color-scheme: light)` block already carries the right values. Epic 7 inherits the Clarify delegation prompt shape and the anytime `Generate Quick Tour` flow.
