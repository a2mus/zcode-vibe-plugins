---
name: project-colors
description: Assign a distinct color to every project and color-code each project's subtasks (sessions) in a dashboard panel, markdown overviews, and chat summaries. Use when the user mentions project colors, color-coding projects or subtasks, or wants to tell projects apart visually.
---

# Project Colors

ZCode's native interface has no per-project color setting, and plugins cannot restyle the app's own
sidebar or chat. This skill provides the closest capability: a persistent per-project color
registry, a color-coded dashboard of all projects with their subtasks (sessions), and emoji color
markers the agent reuses in later summaries and todos.

## Color registry

- File: `~/.zcode/project-colors/registry.json`. Create the directory when missing. Keep the file
  outside any plugin directory so plugin updates never lose assignments.
- Schema:

```json
{
  "version": 1,
  "projects": {
    "Project Name": { "color": "blue", "hex": "#3b82f6", "emoji": "🔵" }
  }
}
```

- Project names are the names the ZCode project/session tools report. Keys are exact; compare
  case-sensitively but resolve user input case-insensitively.
- Colors persist forever until changed. Never silently reassign an existing entry.

## Palette

| name    | hex       | emoji | tint (background) |
|---------|-----------|-------|-------------------|
| red     | `#ef4444` | 🔴    | `#ef444414`       |
| orange  | `#f97316` | 🟠    | `#f9731614`       |
| amber   | `#f59e0b` | 🟡    | `#f59e0b14`       |
| green   | `#22c55e` | 🟢    | `#22c55e14`       |
| blue    | `#3b82f6` | 🔵    | `#3b82f614`       |
| purple  | `#a855f7` | 🟣    | `#a855f714`       |
| bronze  | `#b45309` | 🟤    | `#b4530914`       |
| slate   | `#475569` | ⚫    | `#47556914`       |
| gray    | `#9ca3af` | ⚪    | `#9ca3af14`       |

- Accept palette names case-insensitively, or a `#rrggbb` hex value (store the hex as given; pick
  the visually nearest palette emoji for its marker).
- Auto-assign rule: when a view covers projects that have no entry, sort those project names
  alphabetically and give each the first palette color unused by existing entries, cycling from
  the start of the palette when all nine are taken. Save the registry immediately, then report
  which colors were auto-assigned so the user can change them.

## Color-coded dashboard

1. Read the registry; create it if missing.
2. Gather projects and their subtasks: load the deferred tools with LocalToolSearch query
   `select:ListProjects,ListSessions`, then call both. Group sessions under their project. A
   project's subtasks are its sessions (title plus status: archived, pinned, or active). If a
   tool fails or the session list is empty, still render the projects with a "no subtasks found"
   note.
3. Auto-assign colors to uncovered projects per the rule above and save the registry.
4. Load the `visualize` skill before writing any HTML, then follow it: generate one
   self-contained HTML file named `project-colors-dashboard.html` in the session's visualization
   directory (from the environment section), and reference it as a Markdown link.
5. If the session has no visualization directory (no inline rendering), print the markdown
   overview below instead; with inline rendering, keep the reply to a one-line summary so the
   data is not duplicated.

Dashboard requirements: one card per project; a header strip in the project's hex color with the
project name and a subtask-count badge; each subtask row starts with a dot in the project's hex
color; unassigned-color legend at the bottom; readable in both light and dark mode; no external
assets.

## Markdown overview

Print this alongside the dashboard (emoji bullets mark the project's color):

```
🔵 draft-405b02d7 — 3 subtasks
   • 🔵 Fix login flow (active)
   • 🔵 Add API tests (pinned)
🟠 my-website — 1 subtask
   • 🟠 Redesign homepage (active)
```

## Color discipline (ongoing)

Once registry entries exist, prefix project names with their emoji whenever this skill is active
and the agent lists projects, writes todos about them, or summarizes cross-project work. This is
the only "appearance" effect available to a plugin: native UI colors stay global (light/dark
theme only).
