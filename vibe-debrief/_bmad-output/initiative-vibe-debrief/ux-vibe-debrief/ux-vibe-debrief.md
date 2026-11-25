---
type: ux
title: vibe-debrief UX Specifications
status: final
updated: 2026-11-25
---

# Vibe Debrief — UX Specification Hub

Canonical UX contracts for **Vibe Debrief** (`ui://vibe-debrief/panel.html` + offline HTML exports), unifying the shipped `v0.3.0` hardening baseline (`R8`–`R12`: theme parity, ARIA/keyboard/reduced-motion, atomic state, view/flow ergonomics) and the shipped **Cockpit HUD (`v0.4.0`, `R13`–`R18`)** architecture.

## Spines & Artifacts

- **Visual Identity & Token Contract:** [DESIGN.md](./DESIGN.md) — owns colors, typography, spacing, shapes, elevation, contrast floor, 6-view spatial matrix, and component visual anatomy.
- **Experience & Behavioral Contract:** [EXPERIENCE.md](./EXPERIENCE.md) — owns information architecture, cross-view transitions, voice & tone (`STE-80`), component behavior, state patterns, accessibility floor, and named-protagonist journeys (`UJ-1`–`UJ-5`).
- **Chronological Decision Log:** [.memlog.md](./.memlog.md) — append-only record of UX decisions, overrides, and assumptions.
- **Visual Composition Baseline:** [mockups/cockpit-hud.html](./mockups/cockpit-hud.html) — interactive prototype reference (`hud-header`, 4-row prototype `gear-popover`, `radar-card`, `choice-grid`, `svg-stage`, `concept-pill` + `stage1-drawer`, `stage2-popout`, and `missing-banner`). **Spines (`DESIGN.md` and `EXPERIENCE.md`) win on any conflict with mockups.**
- **UX Audit & Sync Plans:**
  - [plan-ux-audit-views-flows-ergonomics.md](../tickets/epic-panel-a11y/tickets/plan-ux-audit-views-flows-ergonomics.md) (`v0.3.0` view/flow ergonomics audit)
  - [plan-ux-enhance-views-flows-ergonomics.md](../tickets/epic-panel-a11y/tickets/plan-ux-enhance-views-flows-ergonomics.md) (`v0.3.0` contrast, unmatched chip toggle & focus ergonomics)
  - [plan-ux-sync-views-flows-consistency.md](../tickets/epic-cockpit-hud-core/tickets/plan-ux-sync-views-flows-consistency.md) (`v0.3.0` → Cockpit HUD spine & token sync)
  - [plan-ux-audit-v0.4.0-panel-exports.md](../tickets/epic-cockpit-hud-core/tickets/plan-ux-audit-v0.4.0-panel-exports.md) (`v0.4.0` panel & offline export contrast, keyboard & fallback audit)

## Application Views Summary

| View / Surface | Trigger | Envelope | Primary Purpose & Empty / Fallback State |
| --- | --- | --- | --- |
| `HUD` (Default) | Panel open / `view-switcher` | `320–460px` sidebar | `snapshot-banner` (when inspecting history) + inline `missing-banner` (on fallback, copy-path link & `×`/`Escape` dismiss), `10s Radar` (`What Just Happened` + clickable `complexityPill` + collapsible `analogy-box` + 5-state `Waiting On You`) or `minimal-strip`, plus composable `microBlocks` (`unclear`, `choices`, `concepts` + `<100ms` `stage1-drawer`, 5-grammar `svg-stage` + `touchedFilesStrip` + `powerup-dock`, `proof-audit`, `lessons`). Cold open seeds `createWelcomeDebrief`; empty nodes clear `#nodeInspectorBar` & `#touchedFilesStrip`. |
| `Visual` (Curator Tour) | `view-switcher`, `complexityPill`, or `[Animate]` | `320–460px` sidebar | Anytime `600×250` theme-resolved `<canvas>` walkthrough with transport controls (`aria-pressed` synced), Web Speech voice toggle, `scene-pill` keyboard navigation, and copyable plain-text `script-box`. Renders `"Minimal turn — no tour generated"` (minimal) or `"No tour generated yet — anytime playback is one click away"` (non-minimal) + `Generate Quick Tour` / `Return to HUD` CTAs on empty-scene turns. |
| `Memory & History` | `view-switcher` | `320–460px` sidebar | Confirmed Lesson Bank (`<= 50`), active `MEMORY.md` directory & live index preview, and 15-turn `history-item` replay list (`.active-snapshot` highlight). Shows plain-language empty copy when no lessons or prior turns exist; unwritable `~/.zcode` falls back to `<workspaceRoot>/.zcode/memory/`. |
| `Settings & Export` | `gear-btn` (`gear-popover`) | `235px` floating popover | 6-row popover: `Surface Theme` (`Auto` / `Dark HUD` / `Field Desk Light`), `Language`, `Persona`, `Clarity Guard` (`STE-80`), `Model` (`Auto-Cheapest` or user override), and `Export HTML`. `Escape` or outside click closes and restores focus to `gear-btn`. |
| `Stage 2 Pop-Out` | `Deep Dive & Pop Out ↗` / `powerup-dock` | Main ZCode stage (`>= 740px`) | Routes Diagram Spec via `ui/message` to `excalidraw` / `visualize` / `vectorcraft` / `designcraft`, or falls back automatically to the 3-column Built-in Standalone HTML Explainer + persistent inline `missing-banner`. |
| `Standalone HTML Export` | `Export HTML` / Stage 2 fallback | Offline browser (`<= 960px`) | Zero-dependency offline `.html` artifact with `10s Radar`, local `X-Ray`, `@media (prefers-color-scheme: light)` parity, `unclear-box` on low confidence/raw quotes, `460px` viewBox 5-grammar SVG + `#fileChips` (matched & unmatched toggle with focus preservation), `aria-pressed` playback buttons, `880×230` Canvas tour with `#explainerScenePills` keyboard nav, checks, and Stage 2 fallback cards. |

## Cross-View Transitions & Ergonomic Invariants

- **Same-Turn Preservation vs. Cross-Turn Reset:** Same-turn refreshes preserve `selectedNodeId`, `selectedFilePath`, open `stage1-drawer`, `expandedProofIds`, `showRawReply`, `minimalModeExpanded`, `selectedWaitingChipId`, `selectedChoiceId`, `xrayMode`, and `missingPluginFallback`; when the active debrief changes across turns (`lastRenderedDebriefId`), transient per-turn state and `playerState` reset cleanly and empty diagrams clear stale inspector/file-chip state.
- **History Snapshot Replay Loop:** Selecting a `history-item` in `Memory & History` switches to `HUD` and pins `snapshot-banner`; `Return to Latest` restores the live snapshot (or awaits `refreshState`) and returns focus to the `HUD` tab button.
- **Honest Sync & Overlay Hygiene:** `Distill` / `Sync` awaits completion before issuing a `toast-ok` confirmation (or `toast-risk` on failure); `Escape` inside `gear-popover`, `stage1-drawer`, or `lesson-form` stops propagation and restores focus to its opener (`gear-btn`, active `concept-pill`, or `➕ Add Lesson`); promoting `💡→Rule` clears stale `why` / `howToApply` fields first.

## Key User Flows (`UJ-1`–`UJ-5`)

1. **`UJ-1` — Maya (10s Bug Isolation & Action):** Scans `radar-card`, flips `X-Ray: Plain ↔ Tech`, inspects high-risk SVG node or file chip, triggers `Run webhook retry test` via `ui/message`, promotes warning to `MEMORY.md`, or uses `unclear-box` → `Clarify`.
2. **`UJ-2` — Leo (Multi-Intent Diagram & Two-Stage Concept Deep Dive):** Opens `<100ms` inline `stage1-drawer` from `concept-pill` (with `Escape`/`×`/re-click focus return), pops out to installed `visualize` or triggers automatic `vibe_debrief_export_html` 3-column HTML fallback + persistent `missing-banner` when `vectorcraft` is absent.
3. **`UJ-3` — Sam (Zero-Cost Default & Model-Agnostic Clarify):** Relies on `<20ms` deterministic turns at zero token cost; on low-confidence turns, `Clarify` dynamically picks the cheapest enabled provider or active session model without hardcoded model names.
4. **`UJ-4` — Nora (Cross-Session Guardrails in `MEMORY.md`):** Promotes an `audit-row` (`💡→Rule`, clearing stale optional drafts) or adds a custom rule in `lesson-form` (with missing-field focus + `Escape` focus return), persisting `<slug>.md` + `MEMORY.md` and verifying in `Memory & History`.
5. **`UJ-5` — Priya (Curator Tour, Verification Script & Offline Handoff):** Steps through `Visual` tour, cross-checks `script-box`, exports offline HTML for daylight Field Desk Light review (including `#explainerScenePills` keyboard nav and `unclear-box` parity), or replays past turns with `snapshot-banner` → `Return to Latest`.

## Visual System & Parity Contract

- **Dual Themes:** Dark-first **Night-Watch Telemetry** (`#090d13` → `#182130`, sky `#38bdf8`) paired with **Field Desk Light** (`#efeae0` → `#ffffff`, ink sky `#0284c7`, `#f1ece1` canvas stage), synchronized via `host-context-changed` and `@media (prefers-color-scheme: light)`.
- **Field Desk Light Semantic Wash Rule:** Soft-filled semantic banners, toasts, active pills/tabs/buttons, and confirmation controls (`hud-toast`, `status-banner`, `btn-success`, `missing-banner`, `snapshot-banner`, `distill-btn`, `xray-toggle[data-mode="tech"]`, `pop-chip[aria-pressed="true"]`, `view-tab.active`, `action-chip.primary`/`.selected`, `proof-pill.ok`/`.risk`, `powerup-btn.active`/`.complex-pulse`, `minimal-badge`, `unclear-title`, `missing-artifact-link`, `lesson-form-title`, `wait-badge`, `sym`, `scene-pill.active`, `choice-item.picked`) use `{colors.text-primary}` (`#17202e`, `>= 13.3:1`) for small copy, and solid amber CTAs use `{colors.text-on-warn-light}` (`#ffffff`, `5.02:1` on `#b45309`).
- **Accessibility & Safety Floor (`R10`, `R11`, `C3`):** `>= 4.5:1` text contrast (`text-muted` restricted to non-essential eyebrows/timestamps/strikethroughs), `>= 3:1` focus rings & strokes (`2.4px` SVG hover/focus stroke in panel, `2.6px` in offline HTML exports), full keyboard operability (including matched & unmatched file chips and `concept-pill` focus preservation) across panel + HTML export, `prefers-reduced-motion: reduce`, zero external assets, and `unsafeEval: false`.
