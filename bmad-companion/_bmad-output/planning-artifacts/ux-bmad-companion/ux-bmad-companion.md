---
title: BMAD Companion — UX Run
status: final
created: 2026-11-19
updated: 2026-11-26
slug: bmad-companion
sources:
  - ../prd-bmad-companion/prd-bmad-companion.md
  - ../../../assets/panel.html
---

# BMAD Companion — UX Run

UX & visual systems specification for the `bmad-companion` right-side cockpit (`v0.5.4`; bumping to `v0.6.0` in Story 8.8), distilled from the PRD (`FR-1`…`FR-22`, `RULE-1`…`RULE-10`, `UJ-1`…`UJ-4`) and `assets/panel.html`. A readability pass was decided with the owner on 2026-11-25, and synchronized on 2026-11-26 with Story 8.1 (`9a3e18b`), Epic 7 (`35b8f80`), Epic 8 (`epic-panel-readability-redesign.md`), and Architecture Spine (`AD-9` `OQ-6` closed, `AD-10`, `AD-17`, `AD-18`).

- [DESIGN.md](./DESIGN.md) — visual identity spine: light/dark CSS tokens (Palette C — Warm charcoal, shipped in Story 8.1), typography (closed larger ramp shipped in Story 8.1; 4 overlay variables reserved), spacing, shapes (`4px`/`50%` radii shipped in Story 8.1), layout anatomy, component visual specs, and measured WCAG AA contrast.
- [EXPERIENCE.md](./EXPERIENCE.md) — experience spine: three-tab information architecture (Work, Queue, Project) with a "Use it when…" line per tab, voice, component behavior, state patterns, the 5s polling form-focus + overlay guard contract, interaction primitives, accessibility floor, and key flows (Flows 1–4, 6, 7).

Spines win on any conflict with mocks or the as-built implementation.

## What the pass changes

The owner's direction, in the owner's words: the interface feels cluttered and hard to read, the colors are too bright and the user does not know what to focus on, the font is small, and it is unclear when to use each tab.

| Item | What changes | Decided by | State |
|---|---|---|---|
| `RD-1` | Type ramp closed; nine off-ramp sizes mapped to documented roles; zero inline `font-size` across 48 sites | Owner (cleanup scope) | Built in Story 8.1 (`9a3e18b`) |
| `RD-2` | `--on-primary` variable routes white labels; `4px` focus radius and `50%` dot radius join the scale | Owner (cleanup scope) | Built in Story 8.1 (`9a3e18b`) |
| `RD-3` | Headings say the task in plain words; on Work they also hide BMAD terms | Owner (direction); wording `[ASSUMPTION]` | Work heading (`🚀 What to do next`) & `🔍 AI notes` built in Story 8.4; Queue/Project headings open until Story 8.2 |
| `RD-4` | Every tab states its job ("Use it when…") as tooltip, accessible description, and once under the open tab's heading | Owner | Open until Story 8.2 |
| `RD-5` | Palette C — Warm charcoal replaces the GitHub palette; one focal accent per tab | Owner | Tokens built in Story 8.1 (`9a3e18b`); Work first-card focal accent built in Story 8.4; Queue/Project focal accent open until Stories 8.2 & 8.5 |
| `RD-6` | Full text rise: normal text 14px, nothing below 12px; overlay roles defined at 16 / 15 / 14.5 / 13.5px | Owner | Base ramp + overlay CSS vars built in Story 8.1 (`9a3e18b`); overlay sizes consumed in Stories 8.3–8.4; Queue/Project Focus View open until Story 8.5 |
| `RD-7` | Cards, rows and sections open the unified in-iframe Focus View (`AD-17`) with bigger text and more details; buttons, tabs and status labels keep their normal click | Owner | Unified controller built in Story 8.3; Work Action Window built in Story 8.4; Queue & Project Focus View wiring open until Story 8.5 |
| `RD-8` | Three blocks collapse by default behind counted disclosures (`expandedDisclosures`): AI notes and Models & providers on Work; More actions in cards / action window | Owner | Built in Story 8.4 |
| `RD-9` | Five tabs become three (`work`, `queue`, `project`): Work (focus hero from Epic 7 `AD-18`, next actions + Action Window, collapsed disclosures), Queue, Project (includes changed files & flat phases); skills & specialist agents removed from UI | Owner | Engine payload built in Epic 7 (`35b8f80`); Work hero + Action Window built in Story 8.4; 3-tab shell & Project consolidation open until Story 8.2 |
| Icons | Emoji stay the icon system | Owner (single-color icons shown and not chosen) | No change |
| Theme | The panel follows the system theme and sits one step greyer than the conversation, so the conversation keeps the focus | Owner (direction) | Palette C built in Story 8.1 (`9a3e18b`); live ZCode host check in Story 8.8 (`hitl`) |

Code pointers in both spines were re-verified against `assets/panel.html` after Story 8.1 (`9a3e18b`) on 2026-11-26, and Palette C contrast ratios (`CD-1`–`CD-5`, lowest text pairing 4.72:1) plus Story 8.1 ramp/radius/on-primary guards are continuously enforced by `tests/panel-a11y.test.mjs`.

## Handed off to architecture

All UX and architecture host-capability questions for this pass are settled:

| # | Question | Resolution |
|---|---|---|
| OQ-6 | Can ZCode present the panel larger? | **Closed (2026-11-25, Architecture `AD-9` & `AD-17`)** — verified against ZCode Desktop that right-side MCP App panes already run in `displayMode: "fullscreen"` with no host-managed wider popup; Focus View (`RD-7`) and Work Action Window (`RD-9`) render inside `assets/panel.html` via one unified in-iframe overlay controller. |

## Still marked as assumptions in the spines

- The content layout inside the Action Window (`action-dialog`): plain title, short "why now", editable prompt with its model, Launch / Add to Queue, More actions (`Run Here` / `Attach` / `Copy`), and one line of technical details.
- The plain wording of the headings (`RD-3`) and the exact focal-point accent assignment per tab (`RD-5`, deferred to Stories 8.2 & 8.4).
- The overlay's exact backdrop opacity and padding values (`14px 16px` / `16px 18px`).
- At most two semantic hues visible inside any single card.

*(Previously assumed items now ratified in Architecture Spine `AD-10` / `AD-17` / `AD-18` and Epic 7: tab IDs `work`/`queue`/`project`, single-overlay + `switchTab` close + missing-item toast/focus fallback, and polling-guarded `currentFocus` updates.)*

## Earlier decisions this pass touches

- "Never introduce a size above 13px" — the limit is now 14px in the panel column (built in Story 8.1), and the unified overlay is the surface allowed larger reading type (`16 / 15 / 14.5 / 13.5px`).
- "No nested scroll regions without a spine update" — the unified overlay (`AD-17`) is that update.
- "Five tabs, one visible section" (`LD-1`) — the target contract is three tabs (`work`, `queue`, `project`; `RD-9`, Story 8.2).
- The GitHub Primer palette shipped until v0.5.4 — replaced in Story 8.1 (`9a3e18b`) by Palette C; the previous values are kept in DESIGN.md → Colors as historical reference.
- "Keep emoji prefixes … they are the icon system" — confirmed by the owner; unchanged.
- "No mockups are promoted in this run" — two palette impressions are in `mockups/`.

## Mock coverage

| Surface | Mock-up | Shows |
|---|---|---|
| Palette | [palette-options-dark.jpg](./mockups/palette-options-dark.jpg), [palette-options-light.jpg](./mockups/palette-options-light.jpg) | Options A, B and C, left to right; C was chosen |
| All screens | None | Two key-screen images made for an earlier draft showed a layout the owner did not choose and were removed |

The palette impressions were rendered with the image tool: approximate colors, simplified layout, no text. The spines win on conflict.

## Parked findings

Found in the audit of 2026-11-25 and offered to the owner; not selected for this pass. Recorded so they are not lost.
- No confirmation or undo on Clear All, Clear Done and per-task remove (`panel.html:2158-2165`, `3281`, `3285`).
- Keyboard focus drops after explicit non-overlay queue actions; the file's only focus call serves the tab strip (`panel.html:3131-3132`) (overlay actions in Stories 8.3–8.5 restore/reconcile focus per `AD-17`).
- Every toast disappears after 4 seconds, including errors and multi-step instructions (`panel.html:1554`).
- The failed-scan subtitle says "Ready" (`panel.html:1705-1706`), against the voice rule "It never invents success".
- Queue changes are not announced to assistive technology; the toast banner is the only live region (`panel.html:1036`).
- No behavior for narrow panel widths (by design today; the sibling Vibe Debrief has guards for 320–460px).

## Working files

- `.memlog.md` — the decision log for this pass (append-only).
- `.working/color-options.md` — the three measured palette candidates, dark and light, with every pairing; C was chosen.
