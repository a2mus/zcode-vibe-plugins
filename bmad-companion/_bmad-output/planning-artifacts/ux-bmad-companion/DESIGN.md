---
name: BMAD Companion
description: Visual identity for the zero-dependency ZCode right-side BMAD cockpit (assets/panel.html, v0.5.4; bumping to 0.6.0 in Story 8.8) — Palette C (warm charcoal) dark/light token system, 4px/50% radii (RD-2), closed larger type ramp (RD-1/RD-6) shipped in Story 8.1 (9a3e18b), unified in-iframe overlay (RD-7/AD-17, Story 8.3), Work hero/Action Window/counted disclosures/first-action focal accent (RD-8/RD-5, Story 8.4), Queue Plan→Build 2-model split controls (fe214a6), 3-tab Work/Queue/Project shell + plain headings + Project consolidation (RD-3/RD-4/RD-9, Story 8.2), and Focus View across Work/Queue/Project + Queue/Project RD-5 focal tightening + narrow-dock grid ergonomics (Story 8.5 + post-8.5 UX audit); emoji stay the icons.
status: final
updated: 2026-11-26
sources:
  - ../../../assets/panel.html
  - ../prd-bmad-companion/prd-bmad-companion.md
colors:
  # Dark is the default surface (:root in assets/panel.html:9-42).
  # Palette C - Warm charcoal, chosen by the owner on 2026-11-25 and shipped in Story 8.1 (commit 9a3e18b).
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
  # Light overrides (body.theme-light in assets/panel.html:45-69), applied by applyHostTheme().
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
  on-primary: '#ffffff' # white label on primary buttons, the brand badge, and chip-open hover; shipped as --on-primary in Story 8.1 (panel.html:29, 120, 196, 682)
  primary-gradient-start: '#35687f'
  primary-gradient-end: '#3a728b' # .btn-primary gradient terminus (panel.html:194-208)
  primary-gradient-start-light: '#28627c'
  primary-gradient-end-light: '#225468'
  brand-gradient-start: '#35687f'
  brand-gradient-end: '#7d6aa0'
  brand-gradient-start-light: '#28627c'
  brand-gradient-end-light: '#6b5a9c'
  queue-live-mix: 'linear-gradient(135deg, color-mix(in srgb, {colors.accent} 14%, transparent), color-mix(in srgb, {colors.purple} 14%, transparent))' # .live-queue-banner (panel.html:885)
  queue-active-mix: 'linear-gradient(135deg, {colors.success-soft}, {colors.bg-secondary})' # .queue-item-card.is-active & .queue-active-spotlight
  queue-failed-mix: 'linear-gradient(135deg, {colors.danger-soft}, {colors.bg-secondary})' # .queue-item-card.is-failed
  pulse-glow-mix: 'color-mix(in srgb, {colors.success} 70%, transparent)' # .pulse-dot shadow (panel.html:901)
  diff-add-bg: 'color-mix(in srgb, {colors.success} 16%, transparent)' # .diff-add (panel.html:727)
  diff-del-bg: 'color-mix(in srgb, {colors.danger} 16%, transparent)' # .diff-del (panel.html:732)
typography:
  # System stacks only — zero webfonts, zero CDN (RULE-7). panel.html:40-41.
  # Closed ramp - these roles (plus the overlay roles and the 12px/12.5px component exceptions) are the only sizes allowed.
  # Base panel roles + 4 overlay CSS variables shipped in Story 8.1 (9a3e18b); overlay variables are consumed by .focus-hero (Story 8.4) and #overlayLayer (Stories 8.3-8.5).
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
  control: # .btn (tabs use 12px per components.tab-button)
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
  label-caps: # .cmd-label (AD-4 pinned) and collapsed .label-caps form labels
    fontSize: 12px # was 10.5px
    fontWeight: '600'
    letterSpacing: 0.04em
  caption: # .rec-rationale, .brand-subtitle, .story-evidence, .text-caption, secondary prose
    fontSize: 12.5px # was 11px
  micro: # .model-reason, .text-micro, queue meta
    fontSize: 12px # was 10.8px
  overlay-title: # RD-7/RD-9 - --overlay-title-size (panel.html:35, consumed at 1082)
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 16px
    fontWeight: '700'
  overlay-body: # RD-7/RD-9 - --overlay-body-size (panel.html:36, consumed at 458, 1092)
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 15px
    lineHeight: '1.55'
  overlay-command: # RD-7/RD-9 - --overlay-command-size (panel.html:37, consumed at 1101)
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 14.5px
    lineHeight: '1.5'
  overlay-meta: # RD-7/RD-9 - --overlay-meta-size (panel.html:38, consumed at 1107, 1113)
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 13.5px
rounded:
  DEFAULT: 8px # --radius: section/rec/phase/epic/overlay cards (panel.html:39)
  sm: 4px # .story-evidence, .art-row-btn; .cmd-textarea focus outline (shipped in Story 8.1 at panel.html:539)
  md: 5px # .tab-btn, .model-select, .art-chip-group, .queue-prompt-inset, .queue-failure-box
  lg: 6px # .btn, .search-input, .progress-strip, .model-bar, .cmd-editor-wrap, .reconciliation-diff-card, .artifact-preview, .insight-item, .brand-badge, split-config box
  queue-card: 7px # .queue-item-card
  diff-line: 2px # .diff-line
  full: 999px # .pill, .dual-bar, .bar-smart
  circle: 50% # round status dots only, on equal width and height (.pulse-dot, panel.html:895-904) - RD-2 built
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
    disabled-opacity: '0.52'
    disabled-cursor: not-allowed
  button-primary:
    background: 'linear-gradient(135deg, {colors.primary-gradient-start}, {colors.primary-gradient-end})'
    foreground: '{colors.on-primary}'
    border: '{colors.primary-gradient-start}'
    radius: '{rounded.lg}'
    hover-opacity: '0.93'
    disabled-opacity: '0.52'
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
  tab-purpose: # RD-4 built in Story 8.2 (panel.html:268-272)
    foreground: '{colors.text-secondary}'
    font-size: 12.5px
    margin-top: 2px
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
    focal-border: '{colors.accent}' # .rec-card.is-focal (RD-5 Work focal card, Story 8.4)
    hover-border: '{colors.accent}'
    focus-visible-border: '{colors.accent}' # Enter/Space keyboard activation (panel.html:442-445)
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
    focus-radius: '{rounded.sm}' # RD-2 built in Story 8.1 (panel.html:472)
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
  split-config-box: # Queue Plan->Build 2-model auto-split panel (fe214a6, panel.html:1346-1372)
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.lg}'
    padding: 8px 10px
    models-grid: minmax(0, 1fr) minmax(0, 1fr)
  agent-card: # retired & removed in Story 8.2 (OQ-9); preserved for historical reference
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
  phase-card: # flattened in Story 8.2 (RD-9, panel.html:605-628)
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 9px 11px
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
    inspecting-border: '{colors.accent}'
    inspecting-background: '{colors.accent-soft}'
  section-overlay: # RD-7 (Focus View) - unified in-iframe overlay controller (AD-17, Stories 8.3 & 8.5)
    backdrop: 'color-mix(in srgb, {colors.bg-primary} 72%, transparent)'
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 14px 16px
    title-typography: '{typography.overlay-title}'
    body-typography: '{typography.overlay-body}'
    meta-typography: '{typography.overlay-meta}'
    select-foreground: '{colors.text-primary}' # .overlay-card .model-select (panel.html:1121-1125)
    trigger: '{components.button-default}' # clicking focusable cards/rows/sections (plus ⤢ .focus-expand-btn trigger)
  action-dialog: # RD-9 (Work Action Window) - shares unified in-iframe overlay controller (AD-17, Stories 8.3-8.4)
    backdrop: 'color-mix(in srgb, {colors.bg-primary} 72%, transparent)'
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 16px 18px
    title-typography: '{typography.overlay-title}'
    body-typography: '{typography.overlay-body}'
    command-typography: '{typography.overlay-command}'
    meta-typography: '{typography.overlay-meta}'
  focus-hero: # RD-9/AD-18 - Work tab current-focus hero (Story 8.4, panel.html:448-468)
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: 12px
    text-typography: '{typography.overlay-body}'
    source-typography: '{typography.caption}'
---

# BMAD Companion — Design Spine

> Visual identity contract for `assets/panel.html` (v0.5.4; bumping to v0.6.0 in Story 8.8), the right-side BMAD cockpit served as `ui://bmad-companion/panel.html`. **Stories 8.1–8.5 and the Queue Plan→Build 2-model split (`fe214a6`) are now built in `assets/panel.html`:** Palette C dark/light tokens, `--on-primary`, `4px`/`50%` radii (`RD-2`), and the closed larger type ramp (`RD-1`/`RD-6`) from Story 8.1 (`9a3e18b`); the unified in-iframe modal overlay (`AD-17`) from Story 8.3 (`06676fe`); the Work current-focus hero, Action Window, first-card focal accent, and counted disclosures (`RD-8`, `AD-18`) from Story 8.4 (`06676fe`); the Plan→Build 2-model split box (`fe214a6`); the 3-tab Work/Queue/Project shell, plain headings (`RD-3`), `"Use it when…"` tab cues (`RD-4`), Skills/Agents UI removal (`OQ-9`), flat Project phases + inline Changed Files consolidation (`RD-9`), and Project drift-only Reconcile focal accent (`RD-5`) from Story 8.2; and Focus View across Work/Queue/Project cards with interactive-descendant click guard, `⤢` Expand buttons, and live sync (`RD-7`) from Story 8.5, plus Queue/Project `RD-5` focal-accent tightening and narrow-dock grid/wrap hardening from the post-8.5 UX audit. Remaining for **Stories 8.6–8.8**: AD-16 contrast/ARIA test finalization (Story 8.6), refactor sweep (Story 8.7), and Closing E2E journeys + 0.6.0 release sync + live ZCode theme check (Story 8.8). Dark is the default (`:root`); light applies through `body.theme-light`. Behavioral contract lives in [EXPERIENCE.md](./EXPERIENCE.md); this spine wins on any visual conflict with mocks or the as-built file. Code pointers in both spines were re-verified line by line against `assets/panel.html` on 2026-11-26; they drift whenever that file is edited.

## Brand & Style

BMAD Companion is an ambient command cockpit, not a destination app. It lives in ZCode's right-side dock beside an active agent session and answers one question at a glance: *what is the next BMAD move, and which model should run it?* The aesthetic is **instrument-panel density**: a warm charcoal canvas, monospace metadata, pill-shaped status telemetry, and a single muted teal-blue accent that means "interactive / launchable." Color is information, never decoration — green is verified delivery, amber is review/modified, purple is AI/model intelligence, red is high-priority or failed.

The posture is calm utility. No hero imagery, no marketing whitespace, no gamification. Surfaces are tight cards stacked in one scrolling column; every card carries a verb (Launch, Queue, Reconcile, Diff, Open). The brand mark is a 26px "BM" badge on an accent→purple gradient — the only place the two brand hues meet as a fill, while `#projectTitle` stamps `BMAD Companion v0.5.4` (`panel.html:2042-2043`, bumping to `v0.6.0` in Story 8.8). Light mode is the warm off-white counterpart of the same palette for users whose host theme is light; it is not a separate brand.

The system is bespoke vanilla CSS with zero dependencies (RULE-1) and zero external assets (RULE-7). There is no component library to inherit from; this DESIGN.md is the whole visual contract.

**Readability pass (2026-11-25, built across Stories 8.1–8.5).** The owner found the panel cluttered and hard to read, its colors too bright, and nothing telling the eye where to start. One rule follows and binds every tab: **one focal point per tab** — the single most important action or card carries the accent, and everything else stays in ink and surface tones. Story 8.1 (`9a3e18b`) delivered Palette C, `--on-primary` + `4px`/`50%` radii (`RD-2`), and the larger closed type ramp (`RD-1`/`RD-6`); Story 8.3 (`06676fe`) delivered the unified overlay controller (`AD-17`); Story 8.4 (`06676fe`) delivered the Work current-focus hero, Action Window, first-card focal accent (`RD-5`), and the three default-collapsed counted disclosures (`RD-8`); Story 8.2 delivered the 3-tab Work/Queue/Project shell (`RD-9`), plain headings (`RD-3`), `"Use it when…"` tab cues (`RD-4`), and Project drift-only Reconcile focal accent (`RD-5`); and Story 8.5 + the post-8.5 UX audit delivered Queue & Project Focus View click wiring + per-target detail views (`RD-7`) and Queue/Project `RD-5` focal-accent tightening. Emoji stay the icon system. `[ASSUMPTION]` At most two semantic hues are visible inside any one card, and every status is written in words as well as color.

## Colors

The palette is **Palette C — Warm charcoal**, chosen by the owner on 2026-11-25 from three measured options and shipped in Story 8.1 (`9a3e18b`). It grew out of the GitHub Primer set the panel shipped with until v0.5.4 and keeps that set's discipline: a small number of roles, each with one meaning. Dark is the default (`:root`, `panel.html:9-42`); light applies when the host sends `theme: "light"` (`applyHostTheme`, `panel.html:1549-1555`).

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

**RD-5 — Built across Stories 8.1, 8.2, 8.4, and post-8.5 UX audit.** The Palette C tokens in this file ship in `assets/panel.html:9-69` (with `--on-primary` routing `.brand-badge`, `.btn-primary`, and `.art-chip-open:hover` at `120, 196, 682`, verified by `tests/panel-a11y.test.mjs`). Work gives `.is-focal` + `.btn-primary` solely to the first next-action card (`#rec-card-0` / `#rec-launch-0`, Story 8.4, `panel.html:3844, 3858`); Project gives `.btn-primary` to `#btnReconcileTrackers` only when trackers disagree (`hasTrackerDrift`, Story 8.2, `panel.html:4128`) while keeping per-story `New Session` buttons neutral `.btn` (`panel.html:4302`) and `#artifactPreviewCard` border / `#previewFileName` neutral (`panel.html:1458-1461`); and Queue keeps per-row `Retry`/`New Session` buttons neutral `.btn` (`panel.html:3649, 3657`), gating `.btn-primary` exclusively on `#btnRunQueueWorkflow` when queued items wait without an active task, or `#btnRetryFailedQueue` when only failed items remain (`panel.html:3527-3540`), letting `.queue-active-spotlight` carry the active focus while running. Historical v0.5.4 GitHub Primer values superseded by Palette C:

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

- **Sans roles** — `body` for prose; `brand-title`/`section-title` at 700 for headings; `story-title` at 600; `control` (12.5px/600) for every button; tabs are 12px (`{components.tab-button}`); `caption` (12.5px) for rationale, subtitles, and `story-evidence` (`{components.story-evidence}` resolves any conflict with `micro`); `micro` (12px) for model reasons and queue meta; `label-caps` (12px/600, uppercase, 0.04em tracking) for `.cmd-label` (pinned by AD-4 tests) and `.label-caps` form labels.
- **Mono roles** — `{typography.command}` (13.5px) renders the editable `/bmad-<skill> "<prompt>"` inside the Action Window (`panel.html:1098-1103`) in `{colors.accent}`; `{typography.mono-meta}` (12.5px) renders model selects (including `<optgroup>` provider headers and compact `· <N>k` context / `· $/$$/$$$` cost / `· ⛔ rate-limited` / `★ Recommended` tags, `panel.html:1900-1913`), progress numbers, artifact paths, and previews; `{typography.pill}` (12px/600) renders every status pill. Monospace is the signal for "machine-readable token" — commands, model ids, paths, counts.

Rules: never set body prose in mono; never set a command or path in sans; never introduce a size above 14px inside ordinary panel-column prose (no display type — this is an instrument, not a landing page); the Current Focus hero (`{components.focus-hero}` at `15px`), the Focus View (`{components.section-overlay}`), and the Action Window (`{components.action-dialog}`) are the surfaces allowed larger reading type (RD-7, RD-9); keep emoji prefixes on action labels (they are the icon system; the owner chose to keep them on 2026-11-25 when single-color drawn icons were offered) but always pair them with a text verb.

### Closed ramp — RD-1 (built) and base size — RD-6 (built)

**RD-1 (built in Story 8.1, `9a3e18b`).** The roles above plus the 12.5px exception of `{components.brand-badge}` and `{components.search-input}` and 12px `{components.tab-button}` are the only sizes allowed, applied through CSS selectors and role utility classes (`.text-caption`, `.text-micro`, `.text-mono-meta`, `.label-caps` at `panel.html:1013-1036`) — zero inline `style="font-size"` or JS-assigned `fontSize` (enforced by `tests/panel-a11y.test.mjs`). Historical mapping of the 9 off-ramp sizes that Story 8.1 eliminated across 48 inline sites:

| As-built (pre-8.1) | Where (`panel.html` pre-8.1) | It is a… | Mapped to (Story 8.1) |
|---|---|---|---|
| 10px | queue item labels (2008, 2014) | form label | `{typography.label-caps}` (`.label-caps`) |
| 10px | queue item buttons (2036–2049), ✕ Close (1135) | button | `{typography.control}` (`.btn`) |
| 10px | reconciliation key / reason (3068, 3070) | machine token | `{typography.mono-meta}` (`.reconciliation-diff-content`) |
| 10.2px | ➕ Queue Epic button (2630) | button | `{typography.control}` (`.btn`) |
| 10.3px | live-banner buttons (1841–1848) | button | `{typography.control}` (`.btn`) |
| 10.6px | artifact row meta (2950) | secondary meta | `{typography.micro}` (`.text-micro`) |
| 10.7px | failure / outcome line (2029–2030) | secondary meta | `{typography.micro}` (`.text-micro`) |
| 11.2px | live-queue banner text (849) | prose | `{typography.caption}` (`.live-queue-banner`) |
| 11.3px | `.turn-summary` (390), `.empty-state-card` (945), phase note (2473) | prose | `{typography.caption}` (`.text-caption`) |
| 11.3px | artifact row path (2947) | machine token | `{typography.mono-meta}` (`.text-mono-meta`) |
| 12px | empty-queue title (1971), epic title (2622) | heading | `{typography.section-title}` (`.section-title`; empty-queue heading adds `justify-content:center` at `panel.html:2005`) |
| 12.2px | active-task spotlight title (1954) | heading | `{typography.section-title}` (`.section-title`) |

Story 8.1 also collapsed the three legacy label styles (`.cmd-label`, Queue control bar labels, and Queue item labels) onto `{typography.label-caps}` (`.cmd-label` kept alongside `.label-caps` because `AD-4` tests pin `.cmd-label`).

**RD-6 (built in Stories 8.1 & 8.3–8.4).** Every panel size ships at 14px normal text with a 12px floor (`tests/panel-a11y.test.mjs` asserts the closed set `{16, 15, 14.5, 14, 13.5, 13, 12.5, 12}px` and zero below 12px). The four overlay sizes (`--overlay-title-size: 16px`, `--overlay-body-size: 15px`, `--overlay-command-size: 14.5px`, `--overlay-meta-size: 13.5px` at `panel.html:35-38`) are actively consumed by `.focus-hero-text` (`458`) and `#overlayLayer` (`1082-1113`), with Queue/Project Focus View views completing in Story 8.5.

## Layout & Spacing

Single fluid column inside `.app-shell` (`display:flex; flex-direction:column; height:100vh; overflow:hidden`). Three fixed bands stack above one scrolling region, plus the fixed modal overlay layer:

1. **Top bar** (`.top-bar`, padding `{spacing.top-bar-padding}`) — brand row (badge + titles left, AI Audit / Sync right) over the progress strip (`panel.html:1212-1240`).
2. **Tab strip** (`.tabs-nav`) — `display:grid; grid-template-columns:repeat(3, minmax(0, 1fr))` (`panel.html:258-266`); `gap:{spacing.tab-gap}; padding:4px 6px`.
3. **Banner zone** — live-queue banner and toast banner (`panel.html:1248-1254`), each `display:none` until `.visible`.
4. **Main scroll** (`.main-scroll`, `flex:1; overflow-y:auto; padding:{spacing.scroll-padding}`) — the active tab's section (`#tab-work`, `#tab-queue`, `#tab-project` per Architecture `AD-17` §1, `panel.html:1258-1489`).
5. **Focus view & action window** (unified in-iframe overlay layer `#overlayLayer`, `RD-7`/`RD-9`/`AD-17`, `panel.html:1051-1180, 1493-1501`) — while open, `position: fixed; inset: 0` fills the panel viewport (`<div role="dialog" aria-modal="true" aria-labelledby="overlayTitle">`): a dimmed backdrop over one `{components.section-overlay}` or `{components.action-dialog}` card with `overlay-*` non-duplicating DOM IDs, `.main-scroll.scroll-locked` beneath it. It is the only nested scroll region in the panel.

The spacing scale is a dense 2px-based micro-ramp (`{spacing.1}`–`{spacing.7}` = 2/4/6/8/10/12/24). Cards use `{spacing.card-padding}` (10px 11px) and stack with 8–10px bottom margins; action clusters use `{spacing.action-gap}` (6px) and `flex-wrap:wrap` so buttons reflow rather than overflow in a narrow dock. Narrow-width wrapping (`overflow-wrap: anywhere`) protects `#toastText`, `.focus-hero-text`, `.rec-title`, `.rec-rationale`, `.overlay-title`, `.overlay-body-text`, `.overlay-meta-text`, `.overlay-item-row-title`, `.story-title`, `.story-evidence`, `.insight-title`, `.insight-detail`, `.artifact-preview`, `.reconciliation-diff-content`, `#previewFileName`, queue titles, and failure/outcome notes (`panel.html:340, 462, 492, 499, 718, 836, 845, 865, 872, 882, 989, 996, 1094, 1102, 1117, 1181, 1461, 3605`). Three internal 2-column form grids exist inside Queue using `minmax(0, ...)` tracks and `min-width: 0` on `.model-select` so narrow docks never overflow horizontally: `.queue-controls-grid` (`minmax(0, 1fr) minmax(0, 1fr)`, `panel.html:1191-1208, 1320, 1354`) and `.queue-item-controls-grid` (`minmax(0, 1.4fr) minmax(0, 1fr)`, `panel.html:1197-1208, 2576, 3615`). There are **no breakpoints** — the panel is always a narrow right-side column; long titles and paths truncate with `text-overflow:ellipsis`, and multi-button rows wrap.

**Tab contract (RD-9 — built in Story 8.2).** The cockpit has three peer tabs in a single row, in this order: **Work** (default, `#tabBtnWork`/`#tab-work`), **Queue** (`#tabBtnQueue`/`#tab-queue`), **Project** (`#tabBtnProject`/`#tab-project`) — each tab with one job (EXPERIENCE.md → Information Architecture). The strip is a 3-column grid (`repeat(3, minmax(0, 1fr))`, `panel.html:258-266, 1242-1246`). Only one tab section is visible at a time (`switchTab`, `panel.html:4657-4681`; unknown or legacy tab IDs such as `"artifacts"` normalize safely to `"work"`). Both the full skills list and the specialist agents list were removed from the panel UI in Story 8.2 (while `skillsCatalog`/`agentsCatalog` stay in `bmad_get_state` per `AD-14`).

## Elevation & Depth

Depth is **tonal layering plus 1px borders**, never shadow. The surface ramp `bg-primary → bg-secondary → bg-tertiary` reads as inset → card → hover; expanded card bodies drop back to `bg-primary` to feel "inside" their `bg-secondary` parent. The only `box-shadow`s in the system are the `.pulse-dot` running-task glow (`{colors.pulse-glow-mix}`, 1.6s loop — a literal "live" signal, not hierarchy) and subtle `1px` `:focus-visible` control rings on `.model-select` and `.search-input`.

Gradients are reserved for five brand/live moments: the brand badge (accent→purple), the primary button (accent→`{colors.primary-gradient-end}`), the progress fill (accent→success, left-to-right = momentum toward done), the live-queue banner/active-task wash (`{colors.queue-live-mix}` / `{colors.queue-active-mix}`), and failed-task state cards (`{colors.queue-failed-mix}`). Everywhere else, fills are flat. Do not add drop shadows, glows, or gradients to ordinary cards.

## Shapes

Corner radii encode component class, not size:

- `{rounded.DEFAULT}` (8px, the `--radius` token, `panel.html:39`) — all primary cards: section, recommendation, phase, epic, active-task spotlight.
- `{rounded.lg}` (6px) — controls and inset panels: buttons, inputs, selects' wrappers, progress strip, model bar, command editor, Queue Plan→Build split config box, reconciliation diff card, artifact preview, insight item, brand badge.
- `{rounded.md}` (5px) — tab buttons, model selects, artifact chips, queue prompt/failure inset boxes.
- `{rounded.queue-card}` (7px) — queue item cards (a deliberate half-step between control and card).
- `{rounded.sm}` (4px) — story evidence tags, artifact row buttons, and the command-editor focus outline (**built in Story 8.1**, `panel.html:535-540`); `{rounded.diff-line}` (2px) — diff line washes.
- `{rounded.full}` (999px) — pills and progress bars only. Pills are the sole fully-rounded surfaces; cards and buttons never go pill.
- `{rounded.circle}` (50%) — round status dots only, always on an element with equal width and height (`.pulse-dot`, `panel.html:895-904`).

The logic: tighter corners on machine tokens (chips, diff lines), softer corners on human-facing cards, full rounds only on telemetry pills. Keep it.

## Components

Visual specs below; token values live in the frontmatter `components` map. Behavioral rules live in [EXPERIENCE.md](./EXPERIENCE.md#component-patterns).

- **Buttons** — three variants. `{components.button-default}`: tertiary fill, 1px border, 6px radius; hover swaps border to accent and fill to accent-soft; disabled dims to `opacity: 0.52` with `cursor: not-allowed` and neutral hover (`panel.html:182-191`). `{components.button-primary}`: `{colors.primary-gradient-start}` to `{colors.primary-gradient-end}` gradient, `{colors.on-primary}` label, accent border; hover drops opacity to 0.93 (the gradient does not change); disabled dims to `0.52` (`panel.html:193-208`). `{components.button-purple}`: purple-soft fill, purple border, primary-ink label — the "AI/queue" secondary action. All buttons are `{typography.control}` with a 4px icon gap and an emoji prefix.
- **Tabs** — `{components.tab-button}` ghost buttons arranged in a 3-column single row (`repeat(3, minmax(0, 1fr))`, `panel.html:258-266, 1242-1246`) with `.tab-label` ellipsis truncation; each tab's purpose sentence is its `title` and `aria-describedby` target (`#tabDescWork`, `#tabDescQueue`, `#tabDescProject`), and the open tab displays `{components.tab-purpose}` (`12.5px` `{colors.text-secondary}`) directly beneath its heading (`RD-4`, Story 8.2). Active state is accent text on accent-soft wash (no underline, no border). The Queue tab carries a `{components.pill-purple}` count that never truncates. The purpose sentences are specified in the IA table of [EXPERIENCE.md](./EXPERIENCE.md#information-architecture).
- **Pills** — `{components.pill-accent}` / `-success` / `-warning` / `-purple` / `-danger`: semantic text on its own soft fill, 999px radius, 12px mono/600, 1.5px×6px padding. Status vocabulary is fixed (see Colors).
- **Cards** — `{components.section-card}`, `{components.rec-card}`, and `{components.empty-state-card}` share the 8px/secondary/bordered anatomy. On Work, `{components.rec-card}` uses `cursor: pointer`, `9px` stack gap, `border-color: {colors.accent}` on `:hover` / `:focus-visible`, and `.rec-card.is-focal` on the first action card (`idx === 0`, `RD-5` Story 8.4, `panel.html:428-445`). `{components.phase-card}` renders a flat padded card (`padding: 9px 11px`, Story 8.2 `RD-9`, `panel.html:605-628`) with inline `.phase-artifacts` chips. `{components.epic-box}` renders a native `<button>` toggle header (tertiary hover) over an inset `bg-primary` body separated by a subtle top border. Under `RD-9` the phase list, epic box, and changed-files inspector all live in Project. `{components.agent-card}` was retired and removed from `assets/panel.html` alongside the skills list in Story 8.2 (`OQ-9`).
- **Queue checkbox** — `{components.queue-checkbox}` (`.queue-cb`, `panel.html:1010-1016`): 14px square native checkbox with `accent-color: {colors.accent}` inside recommendation card headers (batch queueing) and the Queue Plan→Build split toggle.
- **Command editor** — `{components.cmd-editor}` inset panel wrapping a `{components.cmd-textarea}` inside the Work Action Window (`panel.html:502-544, 2461-2467`): accent-colored mono command text, transparent fill, no border, vertical resize, 38px min-height, and a `2px solid var(--accent)` focus/focus-visible outline rounded at `{rounded.sm}` (`4px`, built in Story 8.1) paired with `.cmd-editor-wrap:focus-within` border highlight and an associated `<label class="cmd-label" for="overlay-rec-cmd">` header.
- **Model bar / select** — `{components.model-select}` mono select on secondary fill (`panel.html:566-590`); focus swaps the border to purple (≥3:1) with a 1px purple focus ring. Inside `#overlayCard`, `.overlay-card .model-select` scales to `{typography.overlay-meta}` (`13.5px`) while preserving `{colors.text-primary}` contrast (`panel.html:1121-1125`). Options are grouped by provider via `<optgroup>` with context-window (`· <N>k`), cost-tier (`· $/$$/$$$`), `· ⛔ rate-limited` (sorted last in each group), and `★ Recommended` suffixes (`panel.html:1983-2015`). A `{components.pill-purple}` tier badge and a `{typography.overlay-meta}` reason line accompany it inside the Action Window.
- **Plan → Build split box** (`{components.split-config-box}`) — added in `fe214a6` (`panel.html:1346-1372`) inside Queue's top control card: an inset `bg-primary` / `border-subtle` / `6px`-radius container holding `#queueSplitPlanBuildToggle`, `#queueSplitStatusPill` (`pill-purple` when `ON · 2 Models`, `pill-accent` when `OFF · Single Step`), and a `minmax(0, 1fr) minmax(0, 1fr)` `.queue-controls-grid` for `#queuePlannerModelSelect` and `#queueBuilderModelSelect`.
- **Progress strip** — `{components.progress-strip}` inset panel: a 600-weight headline ("Smart AI Progress (X% vs Y% static tracker)"), mono numbers right, and a `{components.dual-bar}` 7px gradient fill animating width over 0.3s.
- **Turn box** — `{components.turn-box}` with a 3px purple left rule marking AI turn analysis inside the collapsed `AI notes (N)` disclosure.
- **Banners** — `{components.toast-banner}` (default success-soft/success, `.is-error` danger-soft/danger with `role="alert"`, `.is-warning` warning-soft/warning, 4s auto-dismiss, `#toastText` `overflow-wrap: anywhere`) and `{components.live-queue-banner}` (`{colors.queue-live-mix}`, accent bottom border, embedded 4px progress bar) with a `{components.pulse-dot}`.
- **Queue active spotlight & item card** — `{components.queue-active-spotlight}` renders above the queue list while a task is running using `{colors.success}` border and `{colors.queue-active-mix}` over an inset mono `.queue-prompt-inset` block (`panel.html:963-980, 3550-3580`). `{components.queue-item-card}` uses 7px radius; `.is-active` swaps border to success over `{colors.queue-active-mix}`; `.is-done` drops opacity to 0.78 and border to subtle; `.is-failed` swaps border to danger over `{colors.queue-failed-mix}`. Both carry optional `🧠 PLAN` (`pill-purple`) / `💻 BUILD` (`pill-accent`) phase pills alongside status, position, and story pills (`panel.html:3550-3665`).
- **Reconciliation diff card** — `{components.reconciliation-diff-card}` (`.reconciliation-diff-card` / `.reconciliation-diff-content`, `panel.html:705-719, 1427-1436`): inset `bg-primary` container with 220px scroll cap listing per-key `oldStatus` (`{colors.danger}`) → `newStatus` (`{colors.success}`) transitions and reasons.
- **Artifact chip** — `{components.art-chip}` split chip inside flat Project phase cards: main label (inspects diff inline inside `#tab-project` on click per `RD-9`/`AD-17`) + a bordered `↗` open segment that fills accent with `--on-primary` glyph on hover.
- **Artifact preview / diff** — `{components.artifact-preview}` mono pre-wrap inset inside `#tab-project` (`panel.html:872-885, 1458-1474`), 360px max-height scroll, neutral card border (`{colors.border}`) and `#previewFileName` in `{colors.text-primary}` (`RD-5` Story 8.2). Diff lines: `{components.diff-add}` green wash, `{components.diff-del}` red wash, `{components.diff-hunk}` accent/600, `{components.diff-meta}` purple.
- **Story evidence** — `{components.story-evidence}` purple-on-purple-soft tag for AI reconciliation proof.
- **Insight item** — `{components.insight-item}` inset bordered row for cross-check insights and Recently Changed Files entries (`is-inspecting` highlights the currently inspected file with accent border + `accent-soft` wash, `panel.html:856-859`).
- **Section expand overlay** (`{components.section-overlay}`) — RD-7, built across Stories 8.3 & 8.5 (`insights`, `queue-item`, `active-spotlight`, `phase`, `epic`, `story`, `artifact`, `reconciliation-diff`, plus `recommendation`). Rendered inside `#overlayLayer` (`AD-17`, `<div role="dialog" aria-modal="true" aria-labelledby="overlayTitle">`, `panel.html:1051-1180, 1493-1501`) using `overlay-*` non-duplicating DOM IDs: one card over a `72%` dimmed `bg-primary` backdrop, 8px radius, `bg-secondary` fill, border, `14px 16px` padding, a `{typography.overlay-title}` heading with the ✕ control at its right, then the section's content at `{typography.overlay-body}` / `{typography.overlay-command}` / `{typography.overlay-meta}` (with `.overlay-card .model-select` in `{colors.text-primary}` and `← Back` drill-down navigation on `epic → story` and `phase → artifact`). No shadow, no gradient; the backdrop alone separates it from the panel.
- **Disclosure header** (`AI notes (N)`, `Models and providers (N)` on Work; `More actions (3)` on cards/Action Window) — RD-8, built in Story 8.4 (`panel.html:471-477, 1277-1305, 2480`): a native button in the weight of `{components.button-default}` (`font-weight: 600`) with `aria-expanded`, its label ending in a live count; the same visual weight whether open or closed.
- **Action window** (`{components.action-dialog}`) — RD-9, built in Stories 8.3–8.4 (`panel.html:1076-1078, 2437-2565`): shares `#overlayLayer` (`AD-17`, `overlay-*` DOM IDs) with `16px 18px` padding over the dimmed backdrop: a `{typography.overlay-title}` heading with the ✕ control, the action's details (`plainSummary` / why now) in `{typography.overlay-body}`, the editable prompt in `{typography.overlay-command}`, the model in `{typography.overlay-meta}`, primary action buttons + `More actions (3)` disclosure, and a subtle Technical details line.
- **Current-focus hero** (`{components.focus-hero}`) — RD-9/AD-18, built in Story 8.4 (`panel.html:448-468, 1259-1262`, consuming Epic 7 `35b8f80`): one card at the top of Work (`padding: 12px`) rendering `turnAnalysis.currentFocus.text` (`{typography.overlay-body}` in `{colors.text-primary}`), and under it one `{typography.caption}` line in `{colors.text-secondary}` reading `turnAnalysis.currentFocus.basisLabel` (`"Current focus"`). No accent of its own: the hero explains, and the first next action carries the accent.

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
