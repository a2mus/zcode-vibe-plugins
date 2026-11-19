---
description: Show every project and its subtasks, each project in its own color
---

Generate the color-coded project dashboard.

Optional arguments: $ARGUMENTS — pass `auto` to auto-assign colors to all unassigned projects
without confirmation; anything else is treated as a color override for the current project.

Follow the `project-colors` skill of this plugin:

1. Read `~/.zcode/project-colors/registry.json` (create if missing).
2. Load the deferred tools with LocalToolSearch query `select:ListProjects,ListSessions` and call
   both. Treat each project's sessions as its subtasks (title + status). Continue with whatever
   data arrives; note failures instead of stopping.
3. Auto-assign colors to projects without an entry (alphabetical order, first unused palette
   color), save the registry, and list the new assignments in the reply.
4. Load the `visualize` skill, then generate `project-colors-dashboard.html` in the session's
   visualization directory per the skill's dashboard requirements, and link it as Markdown.
5. If no inline rendering is available, print the markdown overview from the skill instead;
   otherwise keep the reply to a one-line summary.
