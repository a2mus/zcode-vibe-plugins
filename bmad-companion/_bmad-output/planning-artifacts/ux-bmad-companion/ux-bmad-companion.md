---
title: BMAD Companion — UX Run
status: final
created: 2026-11-19
updated: 2026-11-25
slug: bmad-companion
sources:
  - ../prd-bmad-companion/prd-bmad-companion.md
  - ../../../assets/panel.html
---

# BMAD Companion — UX Run

UX & visual systems specification for the `bmad-companion` right-side cockpit (`v0.5.4`), distilled from the PRD (`FR-1`…`FR-22`, `RULE-1`…`RULE-10`, `UJ-1`…`UJ-4`) and the as-built `assets/panel.html`. A readability pass was decided with the owner on 2026-11-25. Everything it changes in the panel is tracked as an open `RD` item; the panel code itself was not touched.

- [DESIGN.md](./DESIGN.md) — visual identity spine: light/dark CSS tokens (Palette C — Warm charcoal), typography, spacing, shapes, layout anatomy, component visual specs, and measured WCAG AA contrast.
- [EXPERIENCE.md](./EXPERIENCE.md) — experience spine: three-tab information architecture (Work, Queue, Project) with a "Use it when…" line per tab, voice, component behavior, state patterns, the 5s polling form-focus guard contract, interaction primitives, accessibility floor, and key flows.

Spines win on any conflict with mocks or the as-built implementation.

## What the pass changes

The owner's direction, in the owner's words: the interface feels cluttered and hard to read, the colors are too bright and the user does not know what to focus on, the font is small, and it is unclear when to use each tab. Scope: documents only.

| Item | What changes | Decided by | State |
|---|---|---|---|
| `RD-1` | Type ramp closed; nine off-ramp sizes mapped to documented roles | Owner (cleanup scope) | Open until built |
| `RD-2` | `on-primary` becomes a real variable; the 3px and 50% radii join the scale | Owner (cleanup scope) | Open until built |
| `RD-3` | Headings say the task in plain words; on Work they also hide BMAD terms | Owner (direction); wording `[ASSUMPTION]` | Open until built |
| `RD-4` | Every tab states its job ("Use it when…") as tooltip, accessible description, and once under the open tab's heading | Owner | Open until built |
| `RD-5` | Palette C — Warm charcoal replaces the GitHub palette | Owner | Open until built |
| `RD-6` | Full text rise: normal text 14px, nothing below 12px; the focus view reads at 16 / 15 / 14.5 / 13.5px | Owner | Open until built |
| `RD-7` | Cards, rows and sections open the focus view with bigger text and more details; buttons, tabs and status labels keep their normal click | Owner | Open until built |
| `RD-8` | Three blocks collapse by default behind counted disclosures: AI notes and Models & providers on Work; More actions in cards / action window | Owner | Open until built |
| `RD-9` | Five tabs become three: Work (focus hero from last 3 conversations, next actions + action window, collapsed disclosures), Queue, Project (includes changed files); skills & specialist agents removed | Owner | Open until built |
| Icons | Emoji stay the icon system | Owner (single-color icons shown and not chosen) | No change |
| Theme | The panel follows the system theme and sits one step greyer than the conversation, so the conversation keeps the focus | Owner (direction) | Open until built |

The pass also re-verified all 62 code pointers in both spines against `assets/panel.html` as of commit `206e242`, and re-measured the contrast table for Palette C (lowest text pairing 4.72:1).

## Handed off to architecture

All UX decisions are closed. One host-capability question remains for the architecture step:

| # | Question | What it decides |
|---|---|---|
| OQ-6 | Can ZCode present the panel larger? (architecture) | How much room the focus view gets |

## Still marked as assumptions in the spines

- Tab ids `work`, `queue`, `project`.
- The content of the action window: a plain title, a short "why now", the editable prompt with its model, Launch / Add to Queue, More actions (Run Here / Attach / Copy), and one line of technical details.
- The focus view's edge cases: one at a time; a tab switch closes it; if its section disappears, it closes with a toast.
- The plain wording of the headings, and the focal point per tab.
- The action window's backdrop and padding values.
- The current-focus hero updates with the rest of the panel state behind the 5s polling guard.

## Earlier decisions this pass touches

- "Never introduce a size above 13px" — the limit is now 14px, and the focus view is the one surface allowed larger reading type.
- "No nested scroll regions without a spine update" — the focus view is that update.
- "Five tabs, one visible section" (`LD-1`) — the contract is now three tabs (`RD-9`).
- The GitHub Primer palette shipped until v0.5.4 — replaced in the tokens by Palette C; the previous values are kept in DESIGN.md → Colors for the build step.
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
- No confirmation or undo on Clear All, Clear Done and per-task remove (`panel.html:2124-2131`, `3248`, `3252`).
- Keyboard focus drops after queue actions; the file's only focus call serves the tab strip (`panel.html:3097-3098`).
- Every toast disappears after 4 seconds, including errors and multi-step instructions (`panel.html:1520`).
- The failed-scan subtitle says "Ready" (`panel.html:1670-1673`), against the voice rule "It never invents success".
- Queue changes are not announced to assistive technology; the toast banner is the only live region (`panel.html:1002`).
- No behavior for narrow panel widths (by design today; the sibling Vibe Debrief has guards for 320–460px).

## Working files

- `.memlog.md` — the decision log for this pass (append-only).
- `.working/color-options.md` — the three measured palette candidates, dark and light, with every pairing; C was chosen.
