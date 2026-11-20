---
title: "Hook stdout-isolation harness"
ticket: 3
status: draft
---

## Auto Run Result

Status: draft (previous run HALTed `blocked` at step-01 version-control sanity check; unblocked by user instruction on 2026-11-20 — vibe-debrief WIP committed as `20b8c2d` by its own session, halt artifact committed, tree clean).

- Ticket resolved: `tickets.py find "_bmad-output/initiative-bmad-companion/tickets/epic-verification-harness/tickets/" "3"` → ref `1.3`, "Hook stdout-isolation harness", state `planned`, `after: [1]`.
- Intent loaded: entry 3 description/verify from `tickets.toml`, epic `epic-verification-harness.md` in full, and Story 1 plan (`story-node-test-harness-temp-workspace-fixture-tracer-plan.md`, status `built`, baseline `72f7ca385cf61ea8159fb0daa9b0e0a0276a7043`) for continuity.
- Invocation intent: implement Story 3 using a `runNodeProcess` helper in `tests/helpers.mjs` (spawned-process harness for `scripts/hook-runner.mjs` across SessionStart, UserPromptSubmit, PostToolUse, Stop; each must emit exactly one JSON stdout line with `additionalContext` and zero stray output).
- Blocking condition: `git status --porcelain` at repo root `D:/Developpement/Projets/Zcode plugins` (branch `main`) is dirty after `git add --refresh -- .`:
  - ` M vibe-debrief/tests/atomic-state.test.mjs`
  - `?? vibe-debrief/_bmad-output/initiative-vibe-debrief/tickets/epic-atomic-state/tickets/story-concurrent-mcp-hook-race-stress-suite-50ms-stop-latency-chec-plan.md`
- Unblock: commit, stash, or discard the sibling `vibe-debrief` changes (both files are outside `bmad-companion/`), then re-dispatch `/bmad-build-auto "Implement Epic 1 Story 3 in _bmad-output/initiative-bmad-companion/tickets/epic-verification-harness/ using tests/helpers.mjs runNodeProcess"`.
