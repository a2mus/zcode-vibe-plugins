# BMAD Companion (`bmad-companion`)

A global ZCode workspace companion plugin for the [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) that docks in the **right-side panel** (`ui://bmad-companion/panel.html`) and acts as an intelligent co-pilot across all 4 BMAD phases in **any workspace**.

## Key Capabilities

1. **Global Right-Side Panel Workspace Surface (`ui.surfaces`)**:
   - Opens in ZCode's right-side panel (`BMAD Companion`) for the active workspace session (`cwd: "${CLAUDE_PROJECT_DIR}"`).
   - Synchronizes automatically after every prompt result.
2. **Recommended AI Model per Prompt & Auto-New-Session Launch**:
   - Discovers your configured ZCode models (`~/.zcode/v2/provider_config.json`) and pairs every recommended `/bmad-<skill> "<prompt>"` with the optimal model tier:
     - **🧠 Deep Reasoning & Architecture** (`claude-opus-5-5-high` / `claude-opus-4-6-thinking`) for `/bmad-architecture`, `/bmad-prd`, `/bmad-code-review`, `/bmad-retrospective`.
     - **🎨 UX & Visual Systems** (`gemini-4-hydrogen-xhigh`) for `/bmad-ux`, `/bmad-brainstorming`, `/bmad-agent-ux-designer`.
     - **💻 Agentic Coding & TDD** (`claude-sonnet-5-5-high`) for `/bmad-build`, `/bmad-qa-generate-e2e-tests`, `/bmad-testarch-atdd`.
     - **⚡ Fast Planning & Synthesis** (`gemini-4-argon-high`) for `/bmad-sprint-planning`, `/bmad-project-context`, `/bmad-walkthrough`.
   - Clicking **🚀 Launch in New Session** copies the `/bmad-<skill> "<prompt>"` command, directly opens a new ZCode conversation (`Ctrl/Cmd+N`), and pre-pastes the chosen prompt into the composer without running anything in the current session.
3. **Post-Prompt AI Advisor (Never Bare Skill Names)**:
   - Hooks into `UserPromptSubmit`, `PostToolUse`, `Stop`, and `SessionStart` to analyze what just happened after each prompt result and advise full `/bmad-<skill> "<contextual prompt>"` commands.
4. **Smart Artifact + AI Progress Visualization & Tracker Reconciliation**:
   - Reconciles static tracker status against actual story plans, retrospectives, implementation reports, test results, and git commits to display both **Static Tracker Progress** and **Smart AI-Reconciled Progress**.
   - **One-Click Tracker Reconciliation**: Provides the `bmad_reconcile_trackers` tool and an interactive **⚡ Reconcile Trackers with Reality** button in the panel. Independently supports:
     - **BMAD v6**: Updates `sprint-status.yaml` / `sprint-status.yml` keys to match proven delivery, updates timestamps and summary headers, and creates `.bak` backups.
     - **BMAD v7**: Synchronizes `tickets.toml` entries and epic markdown frontmatters to reflect true progress.
     - Saves an audit ledger of all modifications in `.zcode/bmad-companion/reconciliation-log.json`.

## Validation

Automated verification gate for any change (zero dependencies, Node 18+):

```bash
node --test tests/
node scripts/check-version-sync.mjs
```

- `node --test tests/` — full suite with Node's built-in test runner (~5s): engine scanner smoke, shared helpers, hook stdout isolation, MCP stdio transport (`initialize` / `tools/list` / `resources/read`), model catalog, task-queue handoff, and the version tri-sync CLI (against the live repo and fixtures).
- `node scripts/check-version-sync.mjs` — verifies the version tri-sync across `.zcode-plugin/plugin.json`, `../marketplace.json`, and `serverInfo.version` in `scripts/mcp-server.mjs`. Exits 0 when synced, 1 with details on mismatch.

The repository CI workflow (`../.github/workflows/validate.yml`) validates marketplace↔plugin sync and script syntax only — it does not run the suite or the version gate. Run both locally before pushing.

Deeper packaging check (requires the `zcode` CLI on `PATH`):

```bash
zcode plugins validate .
```
