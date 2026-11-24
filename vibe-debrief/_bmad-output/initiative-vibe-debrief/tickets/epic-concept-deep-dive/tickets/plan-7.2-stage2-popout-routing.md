---
id: 2
type: story
title: "Stage 2 Pop-Out routing for installed external visual plugins"
status: done
epic: epic-concept-deep-dive
covers: [R2]
after: [1, "5.3", "6.2", "6.4"]
risk: medium
---

# Story 7.2: Stage 2 Pop-Out routing for installed external visual plugins

## What was delivered

Enhanced `triggerStage2Powerup` in `assets/panel.html` to accept an optional `conceptSlug` parameter. When routing from a stage1-drawer Deep Dive & Pop Out click, the function looks up the concept's `stage2` data (howItWorks, keyTradeOff, inYourCodebase) and `stage2Prompt` and includes them in the structured `ui/message` JSON payload alongside the `diagramSpec`. When routing from powerup-dock clicks (conceptSlug: null), only the diagramSpec is included (backward-compatible).

Wired the `btnOpenStage2` click handler in `renderConceptsBlock` to call `triggerStage2Powerup` with the concept's slug and target plugin.

The `ui/message` payload now carries a `source: "vibe-debrief-stage2-popout"` marker, `targetPlugin`, `conceptSlug`, `diagramSpec`, and optionally `stage2` and `stage2Prompt` when a concept is active.

For uninstalled plugins, sets `uiState.missingPluginFallback` with `targetPlugin` and `conceptSlug` and shows a `hud-toast` warning.

## Files changed

- `assets/panel.html` — Enhanced `triggerStage2Powerup` (added conceptSlug param, stage2 enrichment, structured JSON payload); wired `btnOpenStage2` click handler in `renderConceptsBlock`.
- `tests/panel-a11y.test.mjs` — Added `popout-btn` and `stage1-close` to `parseRenderedChildren` regex, added id extraction for dynamic elements, added Story 7.2 test suite (4 tests covering installed, uninstalled, concept vs dock routing, and structured payload validation).

## Verification

`node --test tests/` — 245 tests, 45 suites, all pass (0 failures).