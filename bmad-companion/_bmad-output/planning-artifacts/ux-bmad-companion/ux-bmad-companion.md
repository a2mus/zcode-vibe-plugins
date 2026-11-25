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

UX & visual systems specification for the `bmad-companion` right-side cockpit (`v0.5.4`), distilled from the PRD (`FR-1`…`FR-22`, `RULE-1`…`RULE-10`, `UJ-1`…`UJ-4`) and the synchronized `assets/panel.html`. All tracked UX deviations (`AD-1`…`AD-6`, `CD-1`…`CD-5`, `LD-1`) are closed and verified by `tests/panel-a11y.test.mjs` and `tests/panel-guards.test.mjs`.

- [DESIGN.md](./DESIGN.md) — visual identity spine: light/dark CSS tokens, typography, spacing, shapes, 5-view single-row layout anatomy, component visual specs, and measured WCAG AA contrast (`CD-1`…`CD-5` and `LD-1` closed).
- [EXPERIENCE.md](./EXPERIENCE.md) — experience spine: 5-tab information architecture, voice, component behavior (including provider-grouped `<optgroup>` model selects, Stop-hook Auto-Chain queue controls, and failed-task recovery), state patterns, the 5s polling form-focus guard contract, interaction primitives, verified accessibility floor (`AD-1`…`AD-6` closed), and key flows `UJ-1`…`UJ-5`.

Spines win on any conflict with mocks or the as-built implementation.
