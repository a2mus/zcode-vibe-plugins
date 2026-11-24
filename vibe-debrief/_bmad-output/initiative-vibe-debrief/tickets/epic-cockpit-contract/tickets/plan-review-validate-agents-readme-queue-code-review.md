---
title: 'Code review of recent changes in validate.yml, AGENTS.md, and README.md'
type: review
ticket: review-validate-agents-readme
created: '2026-11-24'
status: done
route: oneshot
route_source: queue
review: none
risk: low
covers: [R8, R12]
context:
  - '../.github/workflows/validate.yml'
  - 'AGENTS.md'
  - 'README.md'
  - '../README.md'
  - '_bmad-output/initiative-vibe-debrief/tickets/epic-cockpit-contract/tickets/plan-review-4.3-5.1-combined-queue-code-review.md'
---

# Queue Review — Recent Changes in `validate.yml`, `AGENTS.md`, and `README.md`

## Scope

BMAD Queue Task #4: review recent changes across `../.github/workflows/validate.yml`, `AGENTS.md`,
and `README.md` (plus cross-checking repo-root `../README.md` and `../scripts/validate.mjs`) for
edge cases, architectural compliance, and verification gaps. Route: oneshot, deterministic tests
only (no nested LLM review).

## Findings

### 1. Version drift found & fixed (`README.md`)

- **Defect (fixed):** `README.md:1` still declared `# Vibe Debrief (\`v0.2.0\`)` even though the
  plugin was stamped and released as `0.3.0` across all 4 internal version locations
  (`.zcode-plugin/plugin.json:3`, `scripts/mcp-server.mjs`, `assets/panel.html`,
  `scripts/hook-runner.mjs:109`) and `../marketplace.json:20`. Updated `README.md:1` to `v0.3.0`.
- **Advisory (out of plugin directory, not modified):** Marketplace root `../README.md:5-6,26,45`
  still displays `bmad-companion · v0.5.2` (canonical `0.5.3` in `../marketplace.json:7`) and
  `vibe-debrief · v0.2.0` (canonical `0.3.0` in `../marketplace.json:20`). Sync on the next
  marketplace release commit.

### 2. CI workflow (`../.github/workflows/validate.yml`) — PASS with advisory notes

- All 5 CI steps (`node scripts/validate.mjs`, `bmad-companion` tests + version sync,
  `vibe-debrief` tests + version sync) run cleanly on Node 22+ and transitively enforce all 5
  `vibe-debrief` version locations (`marketplace.json` ↔ `.zcode-plugin/plugin.json` via
  `../scripts/validate.mjs:42-46` plus the 4 internal locations via
  `scripts/check-version-sync.mjs:34-71`).
- **Verification gap (uncommitted CI gate):** `../.github/workflows/validate.yml:18-29` is still
  uncommitted in the working tree; pushes/PRs against `HEAD` (`9361055`) only run
  `node scripts/validate.mjs` until committed.
- **Advisory notes (non-blocking):**
  - `validate.yml` omits an explicit `permissions: { contents: read }` block (least-privilege
    hardening).
  - `../scripts/validate.mjs:74-79` validates inline panel `<script>` blocks via `new Function()`,
    which assumes classic scripts (satisfied by both current panels, would reject
    `<script type="module">` if adopted later).
  - Both plugin test suites run sequentially in one job, so a `bmad-companion` failure short-circuits
    `vibe-debrief` test output in that run.

### 3. Project context (`AGENTS.md`) — PASS with minor doc-drift notes

- Refreshed on `2026-11-24` against commit `a013a2a` inside `<!-- bmad:context -->` markers.
- Verified every architectural and policy claim against the codebase:
  - Zero-dependency ESM (`node:*` only), 8 `vibe_debrief_*` MCP tools (`scripts/mcp-server.mjs`),
    and stdio-pure `scripts/debrief-engine.mjs` (zero `console.log`, `process.stdin`, or
    `process.stdout` references).
  - Workspace root resolution order (`ZCODE_WORKSPACE_ROOT` → `ZCODE_PROJECT_DIR` →
    `CLAUDE_PROJECT_DIR` → `process.cwd()`), MIME `text/html;profile=mcp-app`, CSP
    `unsafeEval: false`, `<` → `\u003c` export escaping, `ZCODE_VISUALIZATION_DIR`, `ZCODE_HOME_DIR`,
    and `.zcode/` gitignore exclusion (`../.gitignore:3`).
  - CI pipeline description (`AGENTS.md:27`) matches working-tree `../.github/workflows/validate.yml:16-29`.
- **Advisory notes (non-blocking):**
  - `scripts/check-version-sync.mjs:30` still references `AGENTS.md §5 "Version Synchronization"`,
    whereas the refreshed `AGENTS.md` moved that rule under `## Policy` (`AGENTS.md:11`). Candidate
    for Story 5.6 refactor sweep.
  - `AGENTS.md:2` is anchored to `a013a2a` (before uncommitted Story 5.2 5-grammar `diagramSpec`
    normalizer changes); refresh via `bmad-project-context` after Story 5.2+ lands.

## Verification Evidence (run 2026-11-24 after `README.md` fix, exit 0)

Exact command executed from `vibe-debrief/`:

```bash
node --check scripts/check-version-sync.mjs && node --check scripts/debrief-engine.mjs && node --check scripts/mcp-server.mjs && node --check scripts/hook-runner.mjs && node --test tests/ && node scripts/check-version-sync.mjs && node ../scripts/validate.mjs && (cd ../bmad-companion && node --test tests/ && node scripts/check-version-sync.mjs)
```

Observed results:

- `node --check scripts/{check-version-sync,debrief-engine,mcp-server,hook-runner}.mjs` → exit 0.
- `vibe-debrief` `node --test tests/` → 189 tests, 34 suites, 189 pass, 0 fail, 0 skipped (~3.15s).
- `vibe-debrief` `node scripts/check-version-sync.mjs` → `OK: all 4 version locations synced to 0.3.0`.
- `node ../scripts/validate.mjs` → `✓ bmad-companion v0.5.3 validated`, `✓ vibe-debrief v0.3.0 validated`, `✓ project-colors v0.1.0 validated`.
- `bmad-companion` `node --test tests/` → 62 tests, 15 suites, 62 pass, 0 fail, 0 skipped (~5.95s).
- `bmad-companion` `node scripts/check-version-sync.mjs` → `[check-version-sync] OK: all 3 versions match (0.5.3)`.

## Outcome

Passed. Fixed stale `v0.2.0` → `v0.3.0` version header in `README.md:1`, confirmed `validate.yml`
and `AGENTS.md` architectural compliance against live code and all deterministic verification gates,
and logged non-blocking follow-ups (commit `validate.yml`, sync root `../README.md` badges, update
`check-version-sync.mjs:30` section pointer in Story 5.6).
