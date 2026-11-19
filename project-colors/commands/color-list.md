---
description: List current project color assignments
---

Show the current project color assignments.

Arguments: $ARGUMENTS (ignored unless a project name is given, in which case show only that
project's entry).

Follow the `project-colors` skill of this plugin:

1. Read `~/.zcode/project-colors/registry.json`. If it does not exist, say so and suggest
   `/color-set` or `/color-dashboard`.
2. Print a Markdown table with columns: project, marker (emoji), color, hex, swatch (a block of
   the hex color using a colored square character, e.g. `🟦`, next to the hex).
3. Suggest `/color-dashboard` to see projects with their subtasks color-coded.
