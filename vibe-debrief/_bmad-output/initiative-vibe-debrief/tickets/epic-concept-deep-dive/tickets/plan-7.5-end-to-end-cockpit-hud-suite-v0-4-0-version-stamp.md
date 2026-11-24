---
id: 5
ticket: 5
type: story
title: "End-to-end Cockpit HUD suite & v0.4.0 4-file version stamp"
status: done
epic: epic-concept-deep-dive
created: '2026-11-24'
route: oneshot
route_source: queue
review: none
risk: high
covers: [R4]
after: ["1.3", "1.4", "4.3", "5.6", 1, 2, 3, 4]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-concept-deep-dive/epic-concept-deep-dive.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/DESIGN.md'
  - '_bmad-output/initiative-vibe-debrief/ux-vibe-debrief/EXPERIENCE.md'
---

# Build Ticket 7.5 — End-to-End Cockpit HUD Suite & v0.4.0 4-File Version Stamp

## Intent

Completes Story 7.5 (`epic-concept-deep-dive` Story 5, R4):
Verifies `UJ-1`–`UJ-4` end-to-end across the real MCP stdio server (`scripts/mcp-server.mjs`), hook lifecycle runner (`scripts/hook-runner.mjs`), Core Engine (`scripts/debrief-engine.mjs`), panel UI (`assets/panel.html`), and offline standalone HTML export, confirms `v0.2.0`/`v0.3.0` snapshot backward compatibility, and stamps `0.4.0` atomically across all four canonical version locations (plus `../marketplace.json`).

## Implementation Details

- `tests/cockpit-e2e.test.mjs` (new, 5 end-to-end tests):
  - **UJ-1**: Publishes a bug fix over real stdio MCP (`FlowDiff`, `Waiting On You: Verify / Run` action chip, `X-Ray` dual-coding, `verificationChecklist`), mounts `assets/panel.html` backed by spawned `mcp-server.mjs`, verifies `< 16ms` zero-RPC `X-Ray` Plain/Tech flip, keyboard `Enter` node inspection + toggle-off, `ui/message` action-chip dispatch, and `vibe_debrief_toggle_check` disk persistence.
  - **UJ-2**: Seeds `~/.zcode/cli/plugins/installed_plugins.json` with `visualize` (leaving `vectorcraft` uninstalled), exercises hybrid `Choice` + `Sequence` SVG + `< 100ms` zero-RPC Stage 1 drawer + Stage 2 installed `ui/message` dispatch + Stage 2 missing-plugin `vibe_debrief_export_html` fallback with simulated immediate `ui/notifications/tool-result` push (`AD-10`, `AD-17`), verifies the exported 3-column Stage 2 HTML artifact on disk and offline in `vm`, verifies `Install vectorcraft` `ui/message` CTA, and exercises `Minimal Mode` expand + `Anytime Visual` `vibe_debrief_generate_explainer`.
  - **UJ-3**: Seeds `ZCODE_HOME_DIR/.zcode/v2/provider_config.json` with non-Argon models (`openai/gpt-5-nano`, `anthropic/claude-haiku-4-5`), runs real `hook-runner.mjs` (`user-prompt` -> failed Bash `post-tool` -> `stop`), confirms `heuristicConfidence < 0.55` surfaces `unclear-box`, verifies `[Vibe Debrief — Clarify]` dispatches via `ui/message` with dynamically resolved cheapest model, and exercises `Reply` `inline-reply-box`.
  - **UJ-4**: Promotes an `audit-row` (`💡→Rule`) into `lesson-form`, persists via real MCP `vibe_debrief_confirm_lesson` to `ZCODE_HOME_DIR/.zcode/cli/memories/projects/<slug>/memory/MEMORY.md`, verifies `Memory & History` lesson bank + `MEMORY.md` preview + snapshot replay (`snapshot-banner` + `Return to Latest`).
  - **v0.2.0 / v0.3.0 Backward-Compatibility**: Loads pre-OQ-5 `v0.2.0` and `v0.3.0` `.zcode/vibe-debrief-state.json` snapshots through real MCP `vibe_debrief_get_state` into `assets/panel.html`, verifies 5-grammar mapping, `Memory & History` replay, and standalone HTML export offline.
- `v0.4.0` 4-file atomic version stamp (+ `../marketplace.json`):
  - `.zcode-plugin/plugin.json`: `"version": "0.4.0"`
  - `scripts/mcp-server.mjs`: `serverInfo.version: "0.4.0"`
  - `assets/panel.html`: `appInfo.version: "0.4.0"`
  - `scripts/hook-runner.mjs`: SessionStart banner `[Vibe Debrief v0.4.0 ...]`
  - `../marketplace.json`: `vibe-debrief` `"version": "0.4.0"`
- Updated version assertions from `0.3.0` to `0.4.0` in `tests/transports-and-sync.test.mjs` and `tests/panel-a11y.test.mjs`.

## Verification (Executed 2026-11-24)

- `node --check scripts/*.mjs tests/*.mjs` → exit 0.
- `node --test tests/` → 269 tests across 50 suites: 269 pass, 0 fail, exit 0.
- `node --test "tests/*.test.mjs"` → 269 tests across 50 suites: 269 pass, 0 fail, exit 0.
- `node scripts/check-version-sync.mjs` and `node scripts/check-version-sync.mjs 0.4.0` → `OK: all 4 version locations synced to 0.4.0`, exit 0.
- `node ../scripts/validate.mjs` → `✓ vibe-debrief v0.4.0 validated`, exit 0.
