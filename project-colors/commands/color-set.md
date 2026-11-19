---
description: Assign a color to a project (e.g. "/color-set my-project blue")
---

Assign or change one project's color.

Arguments: $ARGUMENTS

Accepted forms:
- `<project name> <color>` — explicit target, e.g. `my-website purple`
- `<color>` only — use the current project (take its name from the environment's primary working
  directory; ask if ambiguous)
- Empty — ask for both project and color

Follow the `project-colors` skill of this plugin:

1. Resolve the project name and the color (palette name case-insensitively, or `#rrggbb` hex).
   Match an existing registry key case-insensitively; do not create near-duplicate keys.
2. Read `~/.zcode/project-colors/registry.json`, set the entry (`color`, `hex`, `emoji`), save.
3. Confirm in one line with a swatch, e.g.
   `🔵 **blue** `#3b82f6` → project **my-website**`. Show the old color if one was replaced.
4. Offer to regenerate the color-coded dashboard with `/color-dashboard`.
