---
name: BMAD Companion
description: Visual identity for the zero-dependency ZCode right-side BMAD cockpit (assets/panel.html, v0.5.4) — a dense, GitHub-Primer-aligned dark/light token system for the 3-tab MCP App panel (as-built v0.5.4 has 5) — Palette C (warm charcoal) and a larger type ramp were adopted in the readability pass of 2026-11-25 and are open until built; emoji stay the icons.
status: final
updated: 2026-11-25
sources:
  - ../../../assets/panel.html
  - ../prd-bmad-companion/prd-bmad-companion.md
colors:
  # Dark is the default surface (:root in assets/panel.html:8-35).
  # Palette C - Warm charcoal, chosen by the owner on 2026-11-25. Not as-built: v0.5.4 still ships the previous GitHub palette (see Colors).
  # Soft fills are the tint of their own hue at the stated alpha, expressed as 8-digit hex (alpha rounded to 1/255).
  bg-primary: '#1b1b1e'
  bg-secondary: '#242428'
  bg-tertiary: '#2e2e33'
  bg-elevated: '#35353b' # defined, reserved - not yet consumed by any rule
  border: '#3d3d44'
  border-subtle: '#2c2c31'
  text-primary: '#d6d3cd'
  text-secondary: '#a3a09a'
  text-muted: '#9e9b95'
  accent: '#74a9c9'
  accent-soft: '#74a9c914' # 8% same hue
  success: '#86b98a'
  success-soft: '#86b98a14' # 8% same hue
  warning: '#cfae62'
  warning-soft: '#cfae6214' # 8% same hue
  purple: '#b3a4d6'
  purple-soft: '#b3a4d614' # 8% same hue
  danger: '#d98890'
  danger-soft: '#d9889014' # 8% same hue
  # Light overrides (body.theme-light in assets/panel.html:37-61), applied by applyHostTheme().
  bg-primary-light: '#fbf9f6'
  bg-secondary-light: '#f4f1ed'
  bg-tertiary-light: '#e9e5df'
  bg-elevated-light: '#ffffff'
  border-light: '#d9d3ca'
  border-subtle-light: '#e6e1da'
  text-primary-light: '#2b2926'
  text-secondary-light: '#5c5852'
  text-muted-light: '#67625b'
  accent-light: '#28627c'
  accent-soft-light: '#28627c1a' # 10% same hue
  success-light: '#2a663c'
  success-soft-light: '#2a663c14' # 8% same hue
  warning-light: '#7d5f22'
  warning-soft-light: '#7d5f2214' # 8% same hue
  purple-light: '#6b5a9c'
  purple-soft-light: '#6b5a9c14' # 8% same hue
  danger-light: '#a4444d'
  danger-soft-light: '#a4444d14' # 8% same hue
  # Derived semantic tints (computed via CSS custom properties + color-mix() in panel.html)
  on-primary: '#ffffff' # white label on primary buttons, the brand badge and the chip-open hover; RD-2 open - no CSS variable exists yet (literal whites at panel.html:112, 177, 643)
  primary-gradient-start: '#35687f'
  primary-gradient-end: '#3a728b' # .btn-primary gradient terminus (panel.html:174-178)
  primary-gradient-start-light: '#28627c'
  primary-gradient-end-light: '#225468'
  brand-gradient-start: '#35687f'
  brand-gradient-end: '#7d6aa0'
  brand-gradient-start-light: '#28627c'
  brand-gradient-end-light: '#6b5a9c'
  queue-live-mix: 'linear-gradient(135deg, color-mix(in srgb, {colors.accent} 14%, transparent), color-mix(in srgb, {colors.purple} 14%, transparent))' # .live-queue-banner (panel.html:844)
  queue-active-mix: 'linear-gradient(135deg, {colors.success-soft}, {colors.bg-secondary})' # .queue-item-card.is-active & .queue-active-spotlight
  queue-failed-mix: 'linear-gradient(135deg, {colors.danger-soft}, {colors.bg-secondary})' # .queue-item-card.is-failed
  pulse-glow-mix: 'color-mix(in srgb, {colors.success} 70%, transparent)' # .pulse-dot shadow (panel.html:856)
  diff-add-bg: 'color-mix(in srgb, {colors.success} 16%, transparent)' # .diff-add (panel.html:687)
  diff-del-bg: 'color-mix(in srgb, {colors.danger} 16%, transparent)' # .diff-del (panel.html:692)
typography:
  # System stacks only — zero webfonts, zero CDN (RULE-7). panel.html:33-34.
  # Closed ramp - these roles (plus the overlay roles and the component exceptions) are the only sizes allowed.
  # Values are the readability-pass targets decided with the owner on 2026-11-25; each comment keeps the v0.5.4 value. RD-1 and RD-6: open until built.
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 14px # was 12.5px
    lineHeight: '1.5' # was 1.45
  brand-title:
    fontSize: 14px # was 13px
    fontWeight: '700'
  section-title:
    fontSize: 14px # was 12.5px
    fontWeight: '700'
  story-title:
    fontSize: 13px # was 11.8px
    fontWeight: '600'
  control: # .btn, .tab-btn
    fontSize: 12.5px # was 11.5px
    fontWeight: '600'
  command: # .cmd-textarea — editable /bmad-<skill> "prompt"
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 13.5px # was 11.5px
    lineHeight: '1.45' # was 1.4
  mono-meta: # .model-select, .progress-numbers, .artifact-preview, paths
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 12.5px # was 11px
  pill:
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 12px # was 10.5px
    fontWeight: '600'
  label-caps: # .cmd-label
    fontSize: 12px # was 10.5px
    fontWeight: '600'
    letterSpacing: 0.04em
  caption: # .rec-rationale, .brand-subtitle, secondary prose
    fontSize: 12.5px # was 11px
  micro: # .model-reason, .story-evidence, queue meta
    fontSize: 12px # was 10.8px
  overlay-title: # RD-7 - focus view heading (the owner's "come into focus" view)
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 16px
    fontWeight: '700'
  overlay-body: # RD-7 - prose inside the focus view and the action window
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 15px
    lineHeight: '1.55'
  overlay-command: # RD-7 - editable command inside the focus view and the action window
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 14.5px
    lineHeight: '1.5'
  overlay-meta: # RD-7 - model ids, paths and counts inside the focus view and the action window
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 13.5px
rounded:
  DEFAULT: 8px # --radius: section/rec/phase/epic cards (panel.html:32)
  sm: 4px # .story-evidence; .cmd-textarea focus outline (RD-2 open - as-built 3px at panel.html:464)
  md: 5px # .tab-btn, .model-select, .art-chip-group
  lg: 6px # .btn, .search-input, .progress-strip, .model-bar, .cmd-editor-wrap, .reconciliation-diff-card, .artifact-preview, .insight-item, .brand-badge
  queue-card: 7px # .queue-item-card
  diff-line: 2px # .diff-line
  full: 999px # .pill, .dual-bar, .bar-smart
  circle: 50% # round status dots only, on equal width and height (.pulse-dot, panel.html:856-865) - RD-2
spacing:
  '1': 2px
  '2': 4px
  '3': 6px
  '4': 8px
  '5': 10px
  '6': 12px
  '7': 24px
  card-padding: 10px 11px # .section-card, .rec-card
  scroll-padding: 10px 12px 24px # .main-scroll
  top-bar-padding: 10px 12px 8px # .top-bar
  tab-gap: 2px # .tabs-nav grid gap
  action-gap: 6px # .rec-actions, .filter-bar, header button clusters
components:
  button-default:
    background: '{colors.bg-tertiary}'
    foreground: '{colors.text-primary}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    padding: 4px 8px
    typography: '{typography.control}'
    hover-border: '{colors.accent}'
    hover-background: '{colors.accent-soft}'
  button-primary:
    background: 'linear-gradient(135deg, {colors.primary-gradient-start}, {colors.primary-gradient-end})'
    foreground: '{colors.on-primary}'
    border: '{colors.primary-gradient-start}'
    radius: '{rounded.lg}'
    hover-opacity: '0.93'
  button-purple:
    background: '{colors.purple-soft}'
    foreground: '{colors.text-primary}'
    border: '{colors.purple}'
    radius: '{rounded.lg}'
  tab-button:
    foreground: '{colors.text-secondary}'
    background: transparent
    radius: '{rounded.md}'
    padding: 6px 3px
    font-size: 12px # was 11px
    font-weight: '600'
    hover-foreground: '{colors.text-primary}'
    hover-background: '{colors.bg-tertiary}'
  tab-button-active:
    foreground: '{colors.accent}'
    background: '{colors.accent-soft}'
  pill-accent:
    background: '{colors.accent-soft}'
    foreground: '{colors.accent}'
    radius: '{rounded.full}'
    padding: 1.5px 6px
    typography: '{typography.pill}'
  pill-success:
    background: '{colors.success-soft}'
    foreground: '{colors.success}'
    radius: '{rounded.full}'
  pill-warning:
    background: '{colors.warning-soft}'
    foreground: '{colors.warning}'
    radius: '{rounded.full}'
  pill-purple:
    background: '{colors.purple-soft}'
    foreground: '{colors.purple}'
    radius: '{rounded.full}'
  pill-danger:
    background: '{colors.danger-soft}'
    foreground: '{colors.danger}'
    radius: '{rounded.full}'
  section-card:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: '{spacing.card-padding}'
    margin-bottom: '{spacing.5}'
  rec-card:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: '{spacing.card-padding}'
    margin-bottom: 9px
    hover-border: '{colors.accent}'
  cmd-editor:
    background: '{colors.bg-primary}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    padding: 7px 8px
  cmd-textarea:
    foreground: '{colors.accent}'
    typography: '{typography.command}'
    min-height: 38px
    resize: vertical
    focus-outline: '2px solid {colors.accent}'
    focus-radius: '{rounded.sm}' # RD-2 open - as-built 3px
  model-select:
    background: '{colors.bg-secondary}'
    foreground: '{colors.text-primary}'
    border: '{colors.border}'
    focus-border: '{colors.purple}'
    radius: '{rounded.md}'
    typography: '{typography.mono-meta}'
    min-width: 150px
  search-input:
    background: '{colors.bg-secondary}'
    foreground: '{colors.text-primary}'
    border: '{colors.border}'
    focus-border: '{colors.accent}'
    radius: '{rounded.lg}'
    font-size: 12.5px
  progress-strip:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.lg}'
    padding: 7px 9px
  dual-bar:
    track: '{colors.bg-tertiary}'
    fill: 'linear-gradient(90deg, {colors.accent}, {colors.success})'
    height: 7px
    radius: '{rounded.full}'
    transition: width 0.3s ease
  brand-badge:
    background: 'linear-gradient(135deg, {colors.brand-gradient-start}, {colors.brand-gradient-end})'
    foreground: '{colors.on-primary}'
    size: 26px
    radius: '{rounded.lg}'
    font-weight: '700'
    font-size: 12.5px
  turn-box:
    background: '{colors.bg-primary}'
    border-left: '3px solid {colors.purple}'
    radius: '0 {rounded.lg} {rounded.lg} 0'
    padding: 8px 10px
  toast-banner:
    background: '{colors.success-soft}'
    foreground: '{colors.success}'
    border-bottom: '{colors.border}'
    error-background: '{colors.danger-soft}'
    error-foreground: '{colors.danger}'
    error-border-bottom: '{colors.danger}'
    warning-background: '{colors.warning-soft}'
    warning-foreground: '{colors.warning}'
    warning-border-bottom: '{colors.warning}'
    padding: 6px 12px
    typography: '{typography.control}'
  live-queue-banner:
    background: '{colors.queue-live-mix}'
    border-bottom: '{colors.accent}'
    padding: 7px 11px
  queue-item-card:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.queue-card}'
    padding: 9px 10px
    active-border: '{colors.success}'
    active-background: '{colors.queue-active-mix}'
    done-opacity: '0.78'
    done-border: '{colors.border-subtle}'
    failed-border: '{colors.danger}'
    failed-background: '{colors.queue-failed-mix}'
  queue-active-spotlight:
    background: '{colors.queue-active-mix}'
    border: '{colors.success}'
    radius: '{rounded.DEFAULT}'
    padding: '{spacing.card-padding}'
    prompt-inset-background: '{colors.bg-primary}'
    prompt-inset-border: '{colors.border-subtle}'
    prompt-inset-radius: '{rounded.md}'
  agent-card:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 9px 11px
  empty-state-card:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 14px 12px
    foreground: '{colors.text-secondary}'
  queue-checkbox:
    size: 14px
    accent-color: '{colors.accent}'
    cursor: pointer
  reconciliation-diff-card:
    background: '{colors.bg-primary}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    padding: 8px 10px
    typography: '{typography.mono-meta}'
    max-height: 220px
  pulse-dot:
    background: '{colors.success}'
    glow: '{colors.pulse-glow-mix}'
    size: 8px
    animation: pulseGlow 1.6s infinite
  phase-card:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    summary-hover: '{colors.bg-tertiary}'
    body-background: '{colors.bg-primary}'
    body-border-top: '{colors.border-subtle}'
  epic-box:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    stories-background: '{colors.bg-primary}'
    stories-border-top: '{colors.border-subtle}'
  story-evidence:
    foreground: '{colors.purple}'
    background: '{colors.purple-soft}'
    radius: '{rounded.sm}'
    padding: 3px 6px
    typography: '{typography.caption}'
  art-chip:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.md}'
    typography: '{typography.pill}'
    hover-border: '{colors.accent}'
    open-hover-background: '{colors.accent}'
    open-hover-foreground: '{colors.on-primary}'
  artifact-preview:
    background: '{colors.bg-primary}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    padding: 8px 10px
    typography: '{typography.mono-meta}'
    max-height: 360px
    white-space: pre-wrap
  diff-add:
    background: '{colors.diff-add-bg}'
    foreground: '{colors.success}'
  diff-del:
    background: '{colors.diff-del-bg}'
    foreground: '{colors.danger}'
  diff-hunk:
    foreground: '{colors.accent}'
    font-weight: '600'
  diff-meta:
    foreground: '{colors.purple}'
  insight-item:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.lg}'
    padding: 7px 9px
  section-overlay: # RD-7 (open, user-requested) - the focus view (section expand overlay); behavioral rules in EXPERIENCE.md
    backdrop: 'color-mix(in srgb, {colors.bg-primary} 72%, transparent)' # [ASSUMPTION]
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 14px 16px # [ASSUMPTION]
    title-typography: '{typography.overlay-title}'
    body-typography: '{typography.overlay-body}'
    meta-typography: '{typography.overlay-meta}'
    trigger: '{components.button-default}' # the small Expand control in each section header
  action-dialog: # RD-9 - the owner's Work tab: selecting a next action opens a window with its details and prompt
    backdrop: 'color-mix(in srgb, {colors.bg-primary} 72%, transparent)' # [ASSUMPTION]
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 16px 18px # [ASSUMPTION]
    title-typography: '{typography.overlay-title}'
    body-typography: '{typography.overlay-body}'
    command-typography: '{typography.overlay-command}'
    meta-typography: '{typography.overlay-meta}'
  focus-hero: # RD-9 - the owner's Work tab: the companion's plain-language reading of the current focus
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 12px # [ASSUMPTION]
    text-typography: '{typography.overlay-body}'
    source-typography: '{typography.caption}'
---

# BMAD Companion — Design Spine

> Visual identity contract for `assets/panel.html` (v0.5.4), the right-side BMAD cockpit served as `ui://bmad-companion/panel.html`. Tokens are the target contract: Palette C and a larger type ramp, decided with the owner in the readability pass of 2026-11-25 — the as-built v0.5.4 file still carries the previous values, tracked as open `RD` items until built. Dark is the default (`:root`); light applies through `body.theme-light`. Behavioral contract lives in [EXPERIENCE.md](./EXPERIENCE.md); this spine wins on any visual conflict with mocks or the as-built file. Code pointers in both spines were re-verified line by line against `assets/panel.html` as of commit `206e242` on 2026-11-25; they drift whenever that file is edited.

## Brand & Style

BMAD Companion is an ambient command cockpit, not a destination app. It lives in ZCode's right-side dock beside an active agent session and answers one question at a glance: *what is the next BMAD move, and which model should run it?* The aesthetic is **instrument-panel density**: a warm charcoal canvas, monospace metadata, pill-shaped status telemetry, and a single muted teal-blue accent that means "interactive / launchable." Color is information, never decoration — green is verified delivery, amber is review/modified, purple is AI/model intelligence, red is high-priority or failed.

The posture is calm utility. No hero imagery, no marketing whitespace, no gamification. Surfaces are tight cards stacked in one scrolling column; every card carries a verb (Launch, Queue, Reconcile, Diff, Open). The brand mark is a 26px "BM" badge on an accent→purple gradient — the only place the two brand hues meet as a fill, while `#projectTitle` stamps `BMAD Companion v0.5.4` (`panel.html:1696`). Light mode is the warm off-white counterpart of the same palette for users whose host theme is light; it is not a separate brand.

The system is bespoke vanilla CSS with zero dependencies (RULE-1) and zero external assets (RULE-7). There is no component library to inherit from; this DESIGN.md is the whole visual contract.

**Readability pass (2026-11-25).** The owner found the panel cluttered and hard to read, its colors too bright, and nothing telling the eye where to start. One rule follows and binds every tab: **one focal point per tab** — the single most important action or card carries the accent, and everything else stays in ink and surface tones. Decided by the owner: Palette C (Colors), three blocks that collapse by default (EXPERIENCE.md → Component Patterns), a larger type ramp (Typography), three tabs named Work, Queue and Project, and emoji kept as the icon system. All of it stays open until built. `[ASSUMPTION]` At most two semantic hues are visible inside any one card, and every status is written in words as well as color.

## Colors

The palette is **Palette C — Warm charcoal**, chosen by the owner on 2026-11-25 from three measured options. It grew out of the GitHub Primer set the panel shipped with until v0.5.4 and keeps that set's discipline: a small number of roles, each with one meaning. Dark is the default (`:root`); light applies when the host sends `theme: "light"` (`applyHostTheme`, panel.html:1337-1343).

- **Surfaces** — `{colors.bg-primary}` is the canvas and the "inset" tone (command editors, previews, expanded card bodies). The canvas sits one step greyer than the host conversation so the conversation keeps the focus (owner direction, 2026-11-25): a deep dark conversation and a little grey for the panel in dark mode, the reverse in light mode. The build step checks it against ZCode's own conversation surface. `{colors.bg-secondary}` is the card/chrome tone (top bar, cards, tab strip). `{colors.bg-tertiary}` is the hover/track tone (button fills, progress tracks, row hovers). `{colors.bg-elevated}` is defined in both themes but currently unused — reserved for future popovers; do not consume it without a component spec.
- **Ink** — `{colors.text-primary}` for titles and essential labels; `{colors.text-secondary}` for rationale, subtitles, and meta prose; `{colors.text-muted}` for uppercase micro-labels and tertiary hints only (see contrast table below).
- **Accent blue** (`{colors.accent}`) — the interactive hue: active tab, editable command text, primary buttons, links/paths, focus borders on search, hover borders, and the start of the progress gradient. It means "you can act here."
- **Success green** (`{colors.success}`) — verified delivery: done stories, committed artifacts, active/running queue tasks, reconciliation success, toast banner. Never used for "selected."
- **Warning amber** (`{colors.warning}`) — attention without failure: in-review stories, modified-but-uncommitted artifacts, warning toasts (`.toast-banner.is-warning`).
- **Purple** (`{colors.purple}`) — the AI/model hue: recommended-model pills, tier badges, AI-reconciled evidence, turn-analysis box, untracked artifacts, queue count. It marks machine intelligence, not human action.
- **Danger red** (`{colors.danger}`) — high-priority recommendations, failed tasks (`.queue-item-card.is-failed`), error toasts (`.toast-banner.is-error`), destructive remove (✕), and the "old status" side of a reconciliation diff.
- **Soft fills** (`*-soft`) — each semantic hue at 8–10% alpha, used *only* as the background of its own pill/badge, toast variant, or active-tab wash. A soft fill never carries a different hue's text.
- **Derived mixes & gradients** — `{colors.on-primary}` white on primary/badge fills; `{colors.primary-gradient-start}`/`{colors.primary-gradient-end}` driving `.btn-primary` gradient; `{colors.brand-gradient-start}`/`{colors.brand-gradient-end}` driving `.brand-badge` gradient; `{colors.queue-live-mix}`, `{colors.queue-active-mix}`, `{colors.queue-failed-mix}`, `{colors.pulse-glow-mix}`, and `{colors.diff-add-bg}`/`{colors.diff-del-bg}` all route through CSS custom properties (`var(--accent)`, `var(--purple)`, `var(--success)`, `var(--danger)`, `color-mix()`).

### Measured contrast (WCAG 2.x relative luminance)

Measured with a deterministic Node script (composite soft fills over their card surface, then compute ratio): first audited on 2026-11-24 for the GitHub palette, re-measured on 2026-11-25 for Palette C. AA normal text requires **4.5:1**; non-text focus indicators require **3:1**. All panel text is small (< 18.66px bold), so the large-text 3:1 allowance never applies.

| Pair | Dark | Light | AA 4.5:1 |
|---|---|---|---|
| text-primary / bg-primary | 11.50 | 13.80 | ✅ both |
| text-primary / bg-secondary | 10.35 | 12.88 | ✅ both |
| text-secondary / bg-primary | 6.59 | 6.72 | ✅ both |
| text-secondary / bg-secondary | 5.93 | 6.27 | ✅ both |
| text-muted / bg-primary | 6.20 | 5.75 | ✅ both |
| text-muted / bg-secondary | 5.58 | 5.37 | ✅ both |
| accent / bg-primary (command text) | 6.76 | 6.39 | ✅ both |
| accent / bg-secondary (active tab) | 6.08 | 5.96 | ✅ both |
| success / bg-secondary | 6.86 | 6.09 | ✅ both |
| warning / bg-secondary | 7.28 | 5.28 | ✅ both |
| purple / bg-secondary | 6.77 | 5.23 | ✅ both |
| danger / bg-secondary | 5.80 | 5.31 | ✅ both |
| on-primary / primary-gradient-start | 6.11 | 6.71 | ✅ both |
| on-primary / primary-gradient-end | 5.30 | 8.28 | ✅ both |
| on-primary / brand-gradient-end (purple) | 4.73 | 5.89 | ✅ both |
| pill accent on accent-soft / bg-secondary | 5.31 | 5.20 | ✅ both |
| pill success on success-soft / bg-secondary | 5.93 | 5.44 | ✅ both |
| pill warning on warning-soft / bg-secondary | 6.26 | 4.74 | ✅ both |
| pill purple on purple-soft / bg-secondary | 5.88 | 4.72 | ✅ both |
| pill danger on danger-soft / bg-secondary | 5.12 | 4.75 | ✅ both |
| border / bg-primary (decorative) | 1.60 | 1.42 | n/a — decoration only |
| model-select focus border (purple) / bg-secondary | 6.77 | 5.23 | ✅ ≥3:1 both |
| search-input focus border (accent) / bg-secondary | 6.08 | 5.96 | ✅ ≥3:1 both |

**Contract.** Essential text (titles, labels, rationale, command text, status words) must reach ≥4.5:1 on the surface it actually sits on, in both themes. Focus indicators must reach ≥3:1. Body and secondary ink, the four semantic hues on card surfaces, and both focus borders already meet this.

**Contrast debt closure (CD-1–CD-5), re-measured for Palette C on 2026-11-25.** The five debts were first closed on 2026-11-24 against the GitHub palette that still ships in v0.5.4. The values below are those of the tokens in this file.
- **CD-1 — `text-muted`** closed: `#9e9b95` (dark) and `#67625b` (light) reach 6.20 on `bg-primary`, 5.58 on `bg-secondary` and 4.87 on `bg-tertiary` in dark; 5.75, 5.37 and 4.82 in light.
- **CD-2 — Pill text on soft fills** closed: each soft fill is its pill's own hue at 8% (dark) and 8–10% (light); pill text reaches accent 5.31, success 5.93, warning 6.26, purple 5.88, danger 5.12 in dark; accent 5.20, success 5.44, warning 4.74, purple 4.72, danger 4.75 in light.
- **CD-3 — Primary button gradient** closed: `primary-gradient-start` `#35687f` and `primary-gradient-end` `#3a728b`; the white label reaches 6.11 at the start and 5.30 at the end in dark (6.71 and 8.28 in light).
- **CD-4 — Brand badge gradient** closed: `brand-gradient-start` `#35687f` and `brand-gradient-end` `#7d6aa0`; the white "BM" glyph reaches 6.11 at the start and 4.73 at the end in dark (6.71 and 5.89 in light).
- **CD-5 — Borders** confirmed: borders are a 1.60:1 decorative separator on `bg-primary` (1.42:1 in light); interactive controls stay distinguishable by fill tone (`bg-tertiary` for buttons, `bg-secondary` for inputs), and focus indicators reach ≥3:1 (search border 6.08:1, model-select border 6.77:1, textarea focus ring 6.76:1).

### Palette C — Warm charcoal (chosen 2026-11-25)

The owner's direction was that the previous colors were too bright and competed for attention. Three candidates were measured on 2026-11-25 with the same method as the table above — 214 pairings across the three, none below standard, in both themes — and the owner chose **C**. Full tables for all three remain in [`.working/color-options.md`](./.working/color-options.md).

| Option | Register | Status pills | Outcome |
|---|---|---|---|
| A — Muted | Same GitHub canvas and the same five status roles, every color dusty instead of vivid, softer white text, deeper steel-blue primary button | Dusty colored text on its own pale tint | Not chosen |
| B — Quiet | Gray does the everyday work; one dusty blue marks anything you can act on | Gray chip with the status word in ink and one small colored dot | Not chosen |
| **C — Warm charcoal** | Warmer charcoal canvas instead of navy-black, warm off-white text, sage / gold / lilac / coral accents, muted teal-blue for anything you can act on | Dusty colored text on its own pale tint | **Chosen** |

Impressions of the three options, left to right A, B, C (approximate colors, simplified layout, no text): [dark](./mockups/palette-options-dark.jpg), [light](./mockups/palette-options-light.jpg). They show mood only — the measured tokens in the frontmatter win. Spines win on conflict.

**RD-5 — open until built.** The tokens in this file are Palette C. The as-built `assets/panel.html` (v0.5.4) still ships the previous GitHub palette, and nothing in the panel changes until the build step. The previous values, for that step:

| Token | Dark (v0.5.4) | Light (v0.5.4) |
|---|---|---|
| bg-primary | `#0d1117` | `#ffffff` |
| bg-secondary | `#161b22` | `#f6f8fa` |
| bg-tertiary | `#1f2630` | `#eaeef2` |
| bg-elevated | `#212834` | `#ffffff` |
| border | `#30363d` | `#d0d7de` |
| border-subtle | `#21262d` | `#e5e9f0` |
| text-primary | `#e6edf3` | `#1f2328` |
| text-secondary | `#9198a1` | `#59636e` |
| text-muted | `#848d97` | `#636c76` |
| accent | `#388bfd` | `#0757b6` |
| success | `#3fb950` | `#13712d` |
| warning | `#d29922` | `#7d4e00` |
| purple | `#a371f7` | `#7445c7` |
| danger | `#f85149` | `#bd1d28` |
| primary-gradient | `#1f6feb` to `#2563eb` | `#0757b6` to `#2563eb` |
| brand-gradient | `#1f6feb` to `#8957e5` | `#0757b6` to `#7445c7` |

Why the old pills looked bright: a status word in its own color, sitting on a tinted chip of the same color, needs a fairly bright color to reach 4.5:1. Palette C keeps that chip style, so its hues are dusty and warm rather than dim; only Option B would have removed the effect, by putting status words in neutral ink.

## Typography

Two system stacks, no webfonts (RULE-7). `{typography.body}` (14px / 1.5) is the default voice — still compact, because the panel is a narrow dock read beside code, but larger than the 12.5px of v0.5.4, which the owner found too small; nothing inside the panel column is smaller than 12px. The ramp is compressed: titles barely rise above body (14px brand, 14px section), and hierarchy comes from **weight (700/600) and hue**, not size.

- **Sans roles** — `body` for prose; `brand-title`/`section-title` at 700 for headings; `story-title` at 600; `control` (12.5px/600) for every button; tabs are 12px; `caption` (12.5px) for rationale and subtitles; `micro` (12px) for model reasons and queue meta; `label-caps` (12px/600, uppercase, 0.04em tracking) for the "CONTEXTUAL BMAD SKILL + PROMPT" editor labels.
- **Mono roles** — `{typography.command}` (13.5px) renders the editable `/bmad-<skill> "<prompt>"` in `{colors.accent}`; `{typography.mono-meta}` (12.5px) renders model selects (including `<optgroup>` provider headers and compact `· <N>k` context / `· $/$$/$$$` cost / `· ⛔ rate-limited` / `★ Recommended` tags, `panel.html:1622-1654`), progress numbers, artifact paths, and previews; `{typography.pill}` (12px/600) renders every status pill. Monospace is the signal for "machine-readable token" — commands, model ids, paths, counts.

Rules: never set body prose in mono; never set a command or path in sans; never introduce a size above 14px inside the panel column (no display type — this is an instrument, not a landing page); the focus view (`{components.section-overlay}`) and the action window (`{components.action-dialog}`) are the surfaces allowed larger reading type (RD-7, RD-9); keep emoji prefixes on action labels (they are the icon system; the owner chose to keep them on 2026-11-25 when single-color drawn icons were offered) but always pair them with a text verb.

### Closed ramp — RD-1 (open) and base size — RD-6 (decided 2026-11-25, open until built)

**RD-1.** The seven roles above plus the 12.5px exception of `{components.brand-badge}` and `{components.search-input}` are the only sizes allowed, and they are applied through classes — never an inline `style="font-size"`. The as-built file uses **16 distinct sizes**; nine of them are not ramp roles. Each maps to one role, chosen by what the element *is* rather than by rounding:

| As-built | Where (`panel.html`) | It is a… | Maps to |
|---|---|---|---|
| 10px | queue item labels (2008, 2014) | form label | `{typography.label-caps}` |
| 10px | queue item buttons (2036–2049), ✕ Close (1135) | button | `{typography.control}` |
| 10px | reconciliation key / reason (3068, 3070) | machine token | `{typography.mono-meta}` |
| 10.2px | ➕ Queue Epic button (2630) | button | `{typography.control}` |
| 10.3px | live-banner buttons (1841–1848) | button | `{typography.control}` |
| 10.6px | artifact row meta (2950) | secondary meta | `{typography.micro}` |
| 10.7px | failure / outcome line (2029–2030) | secondary meta | `{typography.micro}` |
| 11.2px | live-queue banner text (849) | prose | `{typography.caption}` |
| 11.3px | `.turn-summary` (390), `.empty-state-card` (945), phase note (2473) | prose | `{typography.caption}` |
| 11.3px | artifact row path (2947) | machine token | `{typography.mono-meta}` |
| 12px | empty-queue title (1971), epic title (2622) | heading | `{typography.section-title}` |
| 12.2px | active-task spotlight title (1954) | heading | `{typography.section-title}` |

As-built also carries three different label styles: uppercase `{typography.label-caps}` on the picks and the catalogue, 10.5px plain labels on the Queue control bar (1058, 1068) and 10px plain labels on queue items (2008, 2014). They all become `{typography.label-caps}`.

**RD-6 — decided by the owner on 2026-11-25 (open until built).** The owner found the text small, suggested reading sections at a larger size on demand, and then chose the full rise: every default size grows to normal text 14px with nothing below 12px inside the panel, and the focus view adds one more step for reading. It is a value change to the roles, not a new role, so the mapping above keeps holding. The as-built file still uses the v0.5.4 sizes.

## Layout & Spacing

Single fluid column inside `.app-shell` (`display:flex; flex-direction:column; height:100vh; overflow:hidden`). Three fixed bands stack above one scrolling region:

1. **Top bar** (`.top-bar`, padding `{spacing.top-bar-padding}`) — brand row (badge + titles left, AI Audit / Sync right) over the progress strip.
2. **Tab strip** (`.tabs-nav`) — `display:grid; grid-template-columns:repeat(3, minmax(0, 1fr))` (as-built five, `panel.html:233-241`); `gap:{spacing.tab-gap}; padding:4px 6px`.
3. **Banner zone** — live-queue banner and toast banner, each `display:none` until `.visible`.
4. **Main scroll** (`.main-scroll`, `flex:1; overflow-y:auto; padding:{spacing.scroll-padding}`) — the active tab's section (as-built ids `tab-advisor`, `tab-queue`, `tab-progress`, `tab-catalog`, `tab-artifacts`; target ids `work`, `queue`, `project`, `[ASSUMPTION]`).

5. **Focus view & action window** (overlay layer, RD-7, RD-9 — open) — while open, `position: fixed; inset: 0` fills the panel viewport: a dimmed backdrop over one `{components.section-overlay}` or `{components.action-dialog}` card, the main scroll locked beneath it. It is the only nested scroll region in the panel.

The spacing scale is a dense 2px-based micro-ramp (`{spacing.1}`–`{spacing.7}` = 2/4/6/8/10/12/24). Cards use `{spacing.card-padding}` (10px 11px) and stack with 8–10px bottom margins; action clusters use `{spacing.action-gap}` (6px) and `flex-wrap:wrap` so buttons reflow rather than overflow in a narrow dock. Two internal form grids exist inside Queue: the top control grid (`1fr 1fr`, `panel.html:1056`) and per-item model/review controls (`1.4fr 1fr`, `panel.html:2006`). There are **no breakpoints** — the panel is always a narrow right-side column; long titles and paths truncate with `text-overflow:ellipsis`, and multi-button rows wrap.

**Tab contract (RD-9 — open until built; LD-1 closed for the as-built five).** The cockpit has three peer tabs in a single row, in this order: **Work** (default), **Queue**, **Project** — the owner's own structure, each tab with one job (EXPERIENCE.md → Information Architecture). The strip is a 3-column grid (`repeat(3, minmax(0, 1fr))`). The as-built v0.5.4 has five tabs in a 5-column grid (`panel.html:233-241`): Next Prompts, Queue, Phases & Epics, Skills & Agents, Artifacts. Only one tab section is visible at a time (`switchTab`, `panel.html:3090-3107`). Both the full skills list and the specialist agents list are removed from the panel by the owner's decisions of 2026-11-25.

## Elevation & Depth

Depth is **tonal layering plus 1px borders**, never shadow. The surface ramp `bg-primary → bg-secondary → bg-tertiary` reads as inset → card → hover; expanded card bodies drop back to `bg-primary` to feel "inside" their `bg-secondary` parent. The only `box-shadow`s in the system are the `.pulse-dot` running-task glow (`{colors.pulse-glow-mix}`, 1.6s loop — a literal "live" signal, not hierarchy) and subtle `1px` `:focus-visible` control rings on `.model-select` and `.search-input`.

Gradients are reserved for five brand/live moments: the brand badge (accent→purple), the primary button (accent→`{colors.primary-gradient-end}`), the progress fill (accent→success, left-to-right = momentum toward done), the live-queue banner/active-task wash (`{colors.queue-live-mix}` / `{colors.queue-active-mix}`), and failed-task state cards (`{colors.queue-failed-mix}`). Everywhere else, fills are flat. Do not add drop shadows, glows, or gradients to ordinary cards.

## Shapes

Corner radii encode component class, not size:

- `{rounded.DEFAULT}` (8px, the `--radius` token, `panel.html:32`) — all primary cards: section, recommendation, phase, epic, active-task spotlight.
- `{rounded.lg}` (6px) — controls and inset panels: buttons, inputs, selects' wrappers, progress strip, model bar, command editor, reconciliation diff card, artifact preview, insight item, brand badge.
- `{rounded.md}` (5px) — tab buttons, model selects, artifact chips.
- `{rounded.queue-card}` (7px) — queue item cards (a deliberate half-step between control and card).
- `{rounded.sm}` (4px) — story evidence tags and the command-editor focus outline (RD-2 open — as-built 3px, `panel.html:460-465`); `{rounded.diff-line}` (2px) — diff line washes.
- `{rounded.full}` (999px) — pills and progress bars only. Pills are the sole fully-rounded surfaces; cards and buttons never go pill.
- `{rounded.circle}` (50%) — round status dots only, always on an element with equal width and height (`.pulse-dot`). Documented here for the first time (RD-2).

The logic: tighter corners on machine tokens (chips, diff lines), softer corners on human-facing cards, full rounds only on telemetry pills. Keep it.

## Components

Visual specs below; token values live in the frontmatter `components` map. Behavioral rules live in [EXPERIENCE.md](./EXPERIENCE.md#component-patterns).

- **Buttons** — three variants. `{components.button-default}`: tertiary fill, 1px border, 6px radius; hover swaps border to accent and fill to accent-soft. `{components.button-primary}`: `{colors.primary-gradient-start}` to `{colors.primary-gradient-end}` gradient, white label, accent border; hover drops opacity to 0.93 (the gradient does not change). `{components.button-purple}`: purple-soft fill, purple border, primary-ink label — the "AI/queue" secondary action. All buttons are `{typography.control}` with a 4px icon gap and an emoji prefix.
- **Tabs** — `{components.tab-button}` ghost buttons arranged in a 3-column single row (`repeat(3, minmax(0, 1fr))`; as-built five, `panel.html:233-241`) with `.tab-label` ellipsis truncation; each tab's purpose sentence is its `title` and accessible description, and the open tab shows it once under its heading (RD-4, decided by the owner). Active state is accent text on accent-soft wash (no underline, no border). The Queue tab carries a `{components.pill-purple}` count that never truncates. The purpose sentences are specified in the IA table of [EXPERIENCE.md](./EXPERIENCE.md#information-architecture).
- **Pills** — `{components.pill-accent}` / `-success` / `-warning` / `-purple` / `-danger`: semantic text on its own soft fill, 999px radius, 12px mono/600, 1.5px×6px padding. Status vocabulary is fixed (see Colors).
- **Cards** — `{components.section-card}`, `{components.rec-card}`, and `{components.empty-state-card}` share the 8px/secondary/bordered anatomy; rec-cards add an accent hover border and 9px stack gap. `{components.phase-card}` (as-built accordion; compact flat list under RD-9) and `{components.epic-box}` render native `<button>` toggle headers (tertiary hover) over an inset `bg-primary` body separated by a subtle top border. Under RD-9 the phase list, epic box, and changed-files inspector all live in Project. As-built specialist agent rows use `{components.agent-card}` (`padding: 9px 11px`), retired alongside the skills list on 2026-11-25.
- **Queue checkbox** — `{components.queue-checkbox}` (`.queue-cb`, `panel.html:949-955`): 14px square native checkbox with `accent-color: {colors.accent}` inside recommendation card headers for batch queueing.
- **Command editor** — `{components.cmd-editor}` inset panel wrapping a `{components.cmd-textarea}`: accent-colored mono command text, transparent fill, no border, vertical resize, 38px min-height, and a `2px solid var(--accent)` focus/focus-visible outline paired with `.cmd-editor-wrap:focus-within` border highlight. Picks (inside the action window under RD-9) and the as-built catalogue include an associated `<label class="cmd-label">` header (`for="rec-cmd-*"` / `for="cat-cmd-*"`). The focus outline rounds at `{rounded.sm}` (RD-2 open — as-built 3px).
- **Model bar / select** — `{components.model-select}` mono select on secondary fill; focus swaps the border to purple (≥3:1) with a 1px purple focus ring. Options are grouped by provider via `<optgroup>` with context-window (`· <N>k`), cost-tier (`· $/$$/$$$`), `· ⛔ rate-limited` (sorted last in each group), and `★ Recommended` suffixes (`panel.html:1622-1654`). A `{components.pill-purple}` tier badge and a `{typography.micro}` reason line accompany it on the picks.
- **Progress strip** — `{components.progress-strip}` inset panel: a 600-weight headline ("Smart AI Progress (X% vs Y% static tracker)"), mono numbers right, and a `{components.dual-bar}` 7px gradient fill animating width over 0.3s.
- **Turn box** — `{components.turn-box}` with a 3px purple left rule marking AI turn analysis.
- **Banners** — `{components.toast-banner}` (default success-soft/success, `.is-error` danger-soft/danger with `role="alert"`, `.is-warning` warning-soft/warning, 4s auto-dismiss) and `{components.live-queue-banner}` (`{colors.queue-live-mix}`, accent bottom border, embedded 4px progress bar) with a `{components.pulse-dot}`.
- **Queue active spotlight & item card** — `{components.queue-active-spotlight}` renders above the queue list while a task is running using `{colors.success}` border and `{colors.queue-active-mix}` over an inset mono `.queue-prompt-inset` block. `{components.queue-item-card}` uses 7px radius; `.is-active` swaps border to success over `{colors.queue-active-mix}`; `.is-done` drops opacity to 0.78 and border to subtle; `.is-failed` swaps border to danger over `{colors.queue-failed-mix}`. Status pill + position pill + story pill ride the header.
- **Reconciliation diff card** — `{components.reconciliation-diff-card}` (`.reconciliation-diff-card` / `.reconciliation-diff-content`, `panel.html:665-679, 1132-1138`): inset `bg-primary` container with 220px scroll cap listing per-key `oldStatus` (`{colors.danger}`) → `newStatus` (`{colors.success}`) transitions and reasons.
- **Artifact chip** — `{components.art-chip}` split chip: main label (diff on click) + a bordered `↗` open segment that fills accent with white glyph on hover.
- **Artifact preview / diff** — `{components.artifact-preview}` mono pre-wrap inset, 360px max-height scroll. Diff lines: `{components.diff-add}` green wash, `{components.diff-del}` red wash, `{components.diff-hunk}` accent/600, `{components.diff-meta}` purple.
- **Story evidence** — `{components.story-evidence}` purple-on-purple-soft tag for AI reconciliation proof.
- **Insight item** — `{components.insight-item}` inset bordered row for cross-check insights and artifact directory entries.
- **Section expand overlay** (`{components.section-overlay}`) — RD-7, open. One card over a dimmed backdrop: 8px radius, `bg-secondary` fill, border, a `{typography.overlay-title}` heading with the ✕ control at its right, then the section's content at `{typography.overlay-body}` / `{typography.overlay-command}` / `{typography.overlay-meta}`. No shadow, no gradient; the backdrop alone separates it from the panel. Overlay sizes follow the owner's text-size choice: one step above the panel ramp.
- **Disclosure header** (Models and providers, AI notes on Work; More actions on cards/action window) — RD-8, open until built: a native button in the weight of `{components.button-default}` with `aria-expanded`, its label ending in a count; the same visual weight whether open or closed.
- **Action window** (`{components.action-dialog}`) — RD-9, open until built: the owner's Work tab. One card over a dimmed backdrop, the same anatomy as the section expand overlay: an `{typography.overlay-title}` heading with the ✕ control, the action's details in `{typography.overlay-body}`, the prompt in `{typography.overlay-command}`, the model in `{typography.overlay-meta}`, then the action buttons.
- **Current-focus hero** (`{components.focus-hero}`) — RD-9, open until built: the owner's Work tab. One card at the top of Work: `{typography.overlay-body}` text in `{colors.text-primary}`, and under it one `{typography.caption}` line in `{colors.text-secondary}` reading `"Current focus"`. No accent of its own: the hero explains, and the first next action carries the accent.

**Visual references.** Palette comparison, options A, B and C left to right, rendered with the image tool on 2026-11-25 (approximate colors, no text): [dark](./mockups/palette-options-dark.jpg), [light](./mockups/palette-options-light.jpg). No screen mock-up is promoted: the two made for an earlier draft showed a layout the owner did not choose and were removed. The tokens and tables in this file win.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Route every color through a `--token` (or the frontmatter map) | Add new hard-coded hex/rgba literals to panel.html |
| Keep dark as `:root` default; light only via `body.theme-light` from the host | Hard-code a theme or add a manual theme toggle that fights the host |
| Use semantic hues by meaning: green=verified, amber=review/modified, purple=AI/model, red=high-priority/failed, blue=interactive | Recolor pills decoratively or mix a hue's text onto another hue's soft fill |
| Pair every emoji icon with a text verb; keep status pills text-labeled | Convey status by color alone |
| Keep button roles consistent across all 3 tabs: `btn-primary` for launch/execute/reconcile, `btn-purple` for AI/queue/diff-mode, `btn` for secondary utilities | Promote destructive or secondary utility buttons to primary gradient fills |
| Show focus with the accent/purple border/outline swap (≥3:1) | Remove `outline` without a replacement focus style |
| Keep essential text ≥4.5:1 in both themes; keep CD-1…CD-5 closed to WCAG AA | Claim full WCAG AA without verified relative-luminance contrast measurements |
| Reserve gradients for badge, primary button, progress fill, live banner, and active queue cards | Add shadows, glows, or gradients to ordinary cards |
| Truncate long paths/titles with ellipsis; wrap action rows | Let content overflow the narrow dock or add horizontal scroll |
| Render all dynamic strings through `escapeHtml()`; keep CSP `unsafeEval:false`, zero CDN | Use `eval()`, `window.zcode`, external fonts/scripts, or unescaped interpolation (RULE-7) |
| Three tabs in the order Work, Queue, Project, one visible section, single scrolling column | Add a tab whose job duplicates another's, or add a sidebar or nested scroll region without a spine update |
| Use only the documented type roles, applied through classes | Set `font-size` in an inline style or invent a one-off size (RD-1) |
| Give each tab one focal point: accent on the single most important action or card, ink and surface tones for the rest | Let several saturated hues compete inside one tab (RD-5) |
| Keep headings short and plain — say the task, no jargon, no bracketed instructions | Publish feature-oriented headings such as "Multi-Task Execution Queue & Per-Task Model Orchestrator" (RD-3) |
| State every tab's job in plain words next to its name | Rely on a tab name alone to explain when to use it (RD-4) |
| Let the companion propose the next actions in plain words, and keep BMAD terms off Work | Show a browsable catalogue of skills, or skill ids and tracker terms, on Work (RD-9) |
