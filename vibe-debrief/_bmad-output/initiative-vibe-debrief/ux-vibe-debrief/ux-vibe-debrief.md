---
type: ux
title: vibe-debrief UX Specifications
status: final
updated: 2026-11-23
---

# Vibe Debrief — UX Specification Hub

Canonical UX contracts for **Vibe Debrief** (`ui://vibe-debrief/panel.html` + offline HTML exports), bridging the shipped `v0.3.0` hardening baseline (`R8`–`R12`: theme parity, ARIA/keyboard/reduced-motion, atomic state) and the **Cockpit HUD vNext (`v0.4.0`, `R13`–`R18`)** architecture.

## Spines & Artifacts

- **Visual Identity & Token Contract:** [DESIGN.md](./DESIGN.md) — owns colors, typography, spacing, shapes, elevation, contrast floor, and component visual anatomy.
- **Experience & Behavioral Contract:** [EXPERIENCE.md](./EXPERIENCE.md) — owns information architecture, view transitions, voice & tone (`STE-80`), component behavior, state patterns, accessibility floor, and named-protagonist journeys.
- **Chronological Decision Log:** [.memlog.md](./.memlog.md) — append-only record of UX decisions, overrides, and assumptions.
- **Visual Composition Baseline:** [mockups/cockpit-hud.html](./mockups/cockpit-hud.html) — interactive prototype reference (`hud-header`, `radar-card`, `choice-grid`, `svg-stage`, `stage1-drawer`, `stage2-popout`, `missing-banner`). **Spines (`DESIGN.md` and `EXPERIENCE.md`) win on any conflict with mockups.**

## Application Views Summary

| View / Surface | Trigger | Primary Purpose |
| --- | --- | --- |
| `HUD` (Default) | Panel open / `view-switcher` | `snapshot-banner` (when inspecting history), inline `missing-banner` (on fallback), `10s Radar` (`What Just Happened` + 5-state `Waiting On You`) or `minimal-strip`, plus composable `microBlocks` (`unclear`, `choices`, 5-grammar `svg-stage` + `powerup-dock`, `proof-audit`, `concepts` + `<100ms` `stage1-drawer`, `lessons`). |
| `Visual` (Curator Tour) | `view-switcher` or `[Animate]` | Anytime `600×250` theme-resolved `<canvas>` walkthrough with transport controls, Web Speech voice toggle, `scene-pill` keyboard navigation, copyable plain-text `script-box`, and clean empty-tour prompt on minimal turns. |
| `Memory & History` | `view-switcher` | Confirmed Lesson Bank (`<= 50`), active `MEMORY.md` directory & live index preview, and 15-turn `history-item` replay list. |
| `Settings & Export` | `gear-btn` (`gear-popover`) | 6-row popover: `Surface Theme` (`Auto` / `Dark HUD` / `Field Desk Light`), `Language`, `Persona`, `Clarity Guard` (`STE-80`), `Model` (`Auto-Cheapest` or user override), and `Export HTML`. |
| `Stage 2 Pop-Out` | `Deep Dive & Pop Out ↗` / `powerup-dock` | Routes Diagram Spec via `ui/message` to `excalidraw` / `visualize` / `vectorcraft` / `designcraft`, or falls back automatically to the 3-column Built-in Standalone HTML Explainer + `missing-banner`. |
| `Standalone HTML Export` | `Export HTML` / Stage 2 fallback | Zero-dependency offline `.html` artifact with local `X-Ray`, `@media (prefers-color-scheme: light)` parity, interactive SVG, checks, Canvas tour, and Stage 2 fallback cards. |

## Key User Flows (`UJ-1`–`UJ-5`)

1. **`UJ-1` — Maya (10s Bug Isolation & Action):** Scans `radar-card`, flips `X-Ray: Plain ↔ Tech`, inspects high-risk SVG node, triggers `Run webhook retry test` via `ui/message`, promotes warning to `MEMORY.md`, or uses `unclear-box` → `Clarify`.
2. **`UJ-2` — Leo (Multi-Intent Diagram & Two-Stage Concept Deep Dive):** Opens `<100ms` inline `stage1-drawer` from `concept-pill`, pops out to installed `visualize` or triggers automatic `vibe_debrief_export_html` 3-column HTML fallback + persistent `missing-banner` when `vectorcraft` is absent.
3. **`UJ-3` — Sam (Zero-Cost Default & Model-Agnostic Clarify):** Relies on `<20ms` deterministic turns at zero token cost; on low-confidence turns, `Clarify` dynamically picks the cheapest enabled provider or active session model without hardcoded model names.
4. **`UJ-4` — Nora (Cross-Session Guardrails in `MEMORY.md`):** Promotes an `audit-row` (`💡→Rule`) or adds a custom rule in `lesson-form`, persisting `<slug>.md` + `MEMORY.md` and verifying in `Memory & History`.
5. **`UJ-5` — Priya (Curator Tour, Verification Script & Offline Handoff):** Steps through `Visual` tour, cross-checks `script-box`, exports offline HTML for daylight Field Desk Light review, or replays past turns with `snapshot-banner` → `Return to Latest`.

## Visual System & Parity Contract

- **Dual Themes:** Dark-first **Night-Watch Telemetry** (`#090d13` → `#182130`, sky `#38bdf8`) paired with **Field Desk Light** (`#efeae0` → `#ffffff`, ink sky `#0284c7`, `#f1ece1` canvas stage), synchronized via `host-context-changed` and `@media (prefers-color-scheme: light)`.
- **Accessibility & Safety Floor (`R10`, `R11`, `C3`):** `>= 4.5:1` text contrast (`text-muted` restricted to non-essential eyebrows/timestamps/strikethroughs), `>= 3:1` focus rings & strokes, full keyboard operability, `prefers-reduced-motion: reduce`, zero external assets, and `unsafeEval: false`.
