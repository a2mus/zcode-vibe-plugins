---
id: 3
type: story
title: "Mandatory 3-column Stage 2 HTML fallback & persistent missing-banner"
status: done
epic: epic-concept-deep-dive
covers: [R3]
after: [1, 2, "5.5", "6.6"]
risk: high
---

# Story 7.3: Mandatory 3-column Stage 2 HTML fallback & persistent missing-banner

## What was delivered

Implemented the AD-17 mandatory missing-plugin fallback end-to-end:

- **Engine** (`scripts/debrief-engine.mjs`): `generateStandaloneHtmlArtifact(panelState, options)` now accepts `{ conceptSlug, targetPlugin }`. When a valid `targetPlugin` is passed it renders a `stage2-popout` section: `stage2-header` (concept label or headline + plugin target-tag), amber `missing-banner` with an `Install <plugin>` CTA (offline note reveal, zero RPC), floating `telemetry-pill` (verdict · verified counts · read time · STE-80 score), and the 3-column `stage2-deep-card` grid (`How It Works`, `Key Trade-off`, `In Your Codebase`). Content comes from the matched concept's `stage2`; when `conceptSlug` is null or unmatched, new exported helper `buildStage2FallbackColumns` synthesizes the columns from the debrief's plan/consequences/result + touched files (bug mode maps `bugReport`), never leaving a column empty. `saveStandaloneHtmlArtifact` passes the options through. DESIGN.md tokens added to both export themes (`--text-on-warn`, `--telemetry-pill-bg:#0c111ad6`, `--grid-dot`).
- **MCP server** (`scripts/mcp-server.mjs`): `vibe_debrief_export_html` inputSchema widened with optional `conceptSlug` (string) and `targetPlugin` (enum of the 4 visual plugins); handler forwards them to the engine and echoes them in `structuredContent.exportedArtifact`.
- **Panel** (`assets/panel.html`): the missing branch of `triggerStage2Powerup` now sets transient `missingPluginFallback`, renders the new inline `missing-banner` (`#missingPluginBanner`, `role="status"` + `aria-live="polite"`, placed after the snapshot banner per DESIGN.md HUD layout), and immediately calls `vibe_debrief_export_html` with `{ conceptSlug, targetPlugin }`. On the tool response it stores `artifactPath`/`artifactFileName` and re-renders the banner with a clickable artifact link (copies the local path) and a 1-click `Install <plugin>` `ui/message` CTA. `renderMissingBanner()` runs on every `renderPanelState`, so the banner + Install CTA survive same-turn `tool-result` pushes (AD-10); only a new debrief id resets it. Dismiss button and Escape (after the stage1-drawer priority chain) hide it. Guarded stale-response update prevents a late export from reviving a reset fallback.

## Files changed

- `scripts/debrief-engine.mjs` — `buildStage2FallbackColumns` (new export), `generateStandaloneHtmlArtifact` options + stage2-popout markup/CSS/offline Install handler, `saveStandaloneHtmlArtifact` options pass-through.
- `scripts/mcp-server.mjs` — `vibe_debrief_export_html` schema + handler widened for `{ conceptSlug, targetPlugin }`.
- `assets/panel.html` — static `missing-banner` DOM + CSS, `renderMissingBanner`, missing-branch export call in `triggerStage2Powerup`, Install/link/dismiss wiring, Escape dismissal, `renderPanelState` hook.
- `tests/export-parity.test.mjs` — Story 7.3 suite (6 tests): matched-concept grid, null-slug synthesis, unmatched slug, backward compat, XSS escaping, offline Install CTA interaction with zero network/eval.
- `tests/debrief-engine.test.mjs` — `buildStage2FallbackColumns` unit tests (4) + `saveStandaloneHtmlArtifact` options pass-through test.
- `tests/transports-and-sync.test.mjs` — real stdio MCP round-trip: `export_html({ conceptSlug, targetPlugin })` writes the 3-column artifact; null-slug synthesis path.
- `tests/panel-a11y.test.mjs` — Story 7.3 suite (7 tests): export call args, banner visibility, **survival across two same-turn tool-result pushes (AD-10 high-risk check)**, new-turn reset, Install CTA ui/message, dismiss + Escape, powerup-dock null-slug routing, static ARIA markup.

## Verification

- `node --test tests/` — 264 tests, 49 suites, all pass (0 failures), exit 0 (Node v26.12.1).
- `node scripts/check-version-sync.mjs` — OK, all 4 locations synced to 0.3.0 (v0.4.0 stamp belongs to Story 7.5).
- `node --check` on all three scripts and repo-root `node scripts/validate.mjs` — pass.
- The uninstalled-plugin Deep Dive & Pop Out flow (export call → 3-column HTML → banner + Install CTA surviving tool-result pushes) is verified deterministically by the panel DOM suite and the real-stdio MCP round-trip test; a live ZCode host click was not performed in this session.
