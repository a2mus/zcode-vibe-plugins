---
title: '4-file version sync verifier (check-version-sync.mjs) & v0.3.0 release stamp'
type: feature
ticket: 3
created: '2026-11-23'
status: done
route: oneshot
route_source: queue
review: none
risk: medium
covers: [R3]
context:
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-panel-a11y/epic-panel-a11y.md'
---

# Build Ticket 4.3 — 4-File Version Sync Verifier & v0.3.0 Release Stamp

## Intent

Completes Story 4.3 (`epic-panel-a11y` R3): create zero-dependency `scripts/check-version-sync.mjs` verifying that `.zcode-plugin/plugin.json` (`version`), `scripts/mcp-server.mjs` (`serverInfo.version`), `assets/panel.html` (`appInfo.version`), and `scripts/hook-runner.mjs` (SessionStart banner) all declare the exact same semver, wire it into `node --test tests/`, and stamp all four version locations to `0.3.0`. Hands off the `v0.3.0` release baseline and the version-sync gate to Epics 5–7.

## Implementation Notes

- `scripts/check-version-sync.mjs` (new, zero-dependency CLI gate)
  - `VERSION_LOCATIONS` defines the four canonical locations with per-file extractors: JSON `version` for the manifest, `serverInfo: { ... version: "..." }` regex for the MCP server, `appInfo: { ... version: "..." }` regex for the panel, and `[Vibe Debrief vX.Y.Z ...]` banner regex for the hook runner.
  - Exports pure helpers `collectVersionDeclarations(repoRoot)`, `compareVersionDeclarations(declarations, expectedVersion)`, and `checkVersionSync({ repoRoot, expectedVersion })` so the test suite exercises drift/missing/unreadable cases without touching real files.
  - CLI: `node scripts/check-version-sync.mjs [expectedVersion]` prints each location's declared version, exits 0 when all four agree (and match the optional expected version), exits 1 with `FAIL:` lines on stderr otherwise. Validates semver shape (`X.Y.Z` with optional prerelease/build suffixes).
  - Runs `main()` only when invoked directly, never when imported by tests.
- `v0.3.0` release stamp (all four locations, atomic per C4):
  - `.zcode-plugin/plugin.json` — `"version": "0.3.0"`.
  - `scripts/mcp-server.mjs` — `serverInfo.version: "0.3.0"` in the `initialize` response.
  - `assets/panel.html` — `appInfo.version: "0.3.0"` in the `ui/initialize` handshake.
  - `scripts/hook-runner.mjs` — SessionStart banner `[Vibe Debrief v0.3.0 ...]`.
- `tests/transports-and-sync.test.mjs`
  - New `4-file version sync gate` describe (6 tests): all four locations declare `0.3.0`; release gate passes at `0.3.0`; CLI exits 0 with clean stderr and the synced summary; drift detection when one location disagrees; failure on unreadable/missing declaration; rejection of a mismatched expected version.
  - Updated the two SessionStart banner assertions (`Vibe Debrief v0\.2\.0` -> `v0\.3\.0`) to follow the stamp.

## Verification (executed 2026-11-23)

- `node scripts/check-version-sync.mjs` and `node scripts/check-version-sync.mjs 0.3.0` — exit 0; all 4 locations report `0.3.0` (`OK: all 4 version locations synced to 0.3.0`).
- `node --test tests/` — 173 tests across 32 suites, 173 pass, 0 fail, 0 skipped.
- `node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs` — exits 0.
- MCP stdio smoke (`initialize` / `tools/list` / `resources/list`) — 3 JSON-RPC frames, `serverInfo` `{"name":"vibe-debrief","version":"0.3.0"}`, 8 tools, 1 resource.
- Hook runner smoke (`echo '{}' | node scripts/hook-runner.mjs session-start`) — single JSON line, banner `[Vibe Debrief v0.3.0 (Karpathy Comprehension Panel) Active — Persona: Vibe Mentor ...]`.
