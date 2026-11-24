---
status: blocked
---

# BMad Build Auto Result

Status: blocked
Blocking condition: dirty working tree

## Details

- Repo root: `D:/Developpement/Projets/Zcode plugins` (branch `main`)
- After `git add --refresh -- .`: 17 dirty paths (15 modified, 2 untracked) spanning both plugins and repo-root `.github/workflows/validate.yml`.
- The requested work appears to already exist **uncommitted** in `.github/workflows/validate.yml`: steps for `node --test tests/` and `node scripts/check-version-sync.mjs` in both `bmad-companion` and `vibe-debrief`.
- Committed `HEAD` workflow runs only `node scripts/validate.mjs`, so the gates would still fail to run on a push until that working-tree change is committed.
- Build Auto requires a clean tree to establish a baseline and refuses to implement on top of unrelated pending changes.