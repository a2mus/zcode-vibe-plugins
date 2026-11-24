---
name: BMAD Companion
description: Visual identity for the zero-dependency ZCode right-side BMAD cockpit (assets/panel.html, v0.5.3) — a dense, GitHub-Primer-aligned dark/light token system for the 5-tab MCP App panel.
status: final
updated: 2026-11-24
sources:
  - ../../../assets/panel.html
  - ../prd-bmad-companion/prd-bmad-companion.md
colors:
  # Dark is the default surface (:root in assets/panel.html:8-31).
  # Soft fills are the CSS rgba() values expressed as 8-digit hex (alpha rounded to 1/255).
  bg-primary: '#0d1117'
  bg-secondary: '#161b22'
  bg-tertiary: '#1f2630'
  bg-elevated: '#212834' # defined, reserved — not yet consumed by any rule
  border: '#30363d'
  border-subtle: '#21262d'
  text-primary: '#e6edf3'
  text-secondary: '#9198a1'
  text-muted: '#848d97'
  accent: '#388bfd'
  accent-soft: '#388bfd14' # rgba(56,139,253,0.08)
  success: '#3fb950'
  success-soft: '#3fb9501a' # rgba(63,185,80,0.10)
  warning: '#d29922'
  warning-soft: '#d299221a' # rgba(210,153,34,0.10)
  purple: '#a371f7'
  purple-soft: '#a371f714' # rgba(163,113,247,0.08)
  danger: '#f85149'
  danger-soft: '#f8514914' # rgba(248,81,73,0.08)
  # Light overrides (body.theme-light in assets/panel.html:33-53), applied by applyHostTheme().
  bg-primary-light: '#ffffff'
  bg-secondary-light: '#f6f8fa'
  bg-tertiary-light: '#eaeef2'
  bg-elevated-light: '#ffffff'
  border-light: '#d0d7de'
  border-subtle-light: '#e5e9f0'
  text-primary-light: '#1f2328'
  text-secondary-light: '#59636e'
  text-muted-light: '#636c76'
  accent-light: '#0757b6'
  accent-soft-light: '#0757b61a' # rgba(7,87,182,0.10)
  success-light: '#13712d'
  success-soft-light: '#13712d1a' # rgba(19,113,45,0.10)
  warning-light: '#7d4e00'
  warning-soft-light: '#7d4e001a' # rgba(125,78,0,0.10)
  purple-light: '#7445c7'
  purple-soft-light: '#7445c71a' # rgba(116,69,199,0.10)
  danger-light: '#bd1d28'
  danger-soft-light: '#bd1d281a' # rgba(189,29,40,0.10)
  # Fixed literals shared by both themes (currently hard-coded in panel.html; tokenized here).
  on-primary: '#ffffff'
  primary-gradient-start: '#1f6feb'
  primary-gradient-end: '#2563eb' # .btn-primary gradient terminus (panel.html:175)
  primary-gradient-start-light: '#0757b6'
  brand-gradient-start: '#1f6feb'
  brand-gradient-end: '#8957e5'
  brand-gradient-start-light: '#0757b6'
  brand-gradient-end-light: '#7445c7'
  queue-live-blue: '#3b82f624' # .live-queue-banner gradient start, rgba(59,130,246,0.14)
  queue-live-violet: '#8b5cf624' # .live-queue-banner gradient end, rgba(139,92,246,0.14)
  queue-active-tint: '#10b9811a' # .queue-item-card.is-active gradient start, rgba(16,185,129,0.1)
  spotlight-active-tint: '#10b9811f' # #queueActiveSpotlight gradient start, rgba(16,185,129,0.12)
  pulse-emerald: '#10b981' # .pulse-dot glow color (panel.html:714-727)
  pulse-emerald-glow: '#10b981b3' # .pulse-dot shadow alpha, rgba(16,185,129,0.7)
  diff-add-bg: '#3fb95029' # .diff-add, rgba(63,185,80,0.16)
  diff-del-bg: '#f8514929' # .diff-del, rgba(248,81,73,0.16)
typography:
  # System stacks only — zero webfonts, zero CDN (RULE-7). panel.html:29-30.
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 12.5px
    lineHeight: '1.45'
  brand-title:
    fontSize: 13px
    fontWeight: '700'
  section-title:
    fontSize: 12.5px
    fontWeight: '700'
  story-title:
    fontSize: 11.8px
    fontWeight: '600'
  control: # .btn, .tab-btn
    fontSize: 11.5px
    fontWeight: '600'
  command: # .cmd-textarea — editable /bmad-<skill> "prompt"
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 11.5px
    lineHeight: '1.4'
  mono-meta: # .model-select, .progress-numbers, .artifact-preview, paths
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 11px
  pill:
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 10.5px
    fontWeight: '600'
  label-caps: # .cmd-label
    fontSize: 10.5px
    fontWeight: '600'
    letterSpacing: 0.04em
  caption: # .rec-rationale, .brand-subtitle, secondary prose
    fontSize: 11px
  micro: # .model-reason, .story-evidence, queue meta
    fontSize: 10.8px
rounded:
  DEFAULT: 8px # --radius: section/rec/phase/epic cards (panel.html:28)
  sm: 4px # .story-evidence
  md: 5px # .tab-btn, .model-select, .art-chip-group
  lg: 6px # .btn, .search-input, .progress-strip, .model-bar, .cmd-editor-wrap, .artifact-preview, .insight-item, .brand-badge
  queue-card: 7px # .queue-item-card
  diff-line: 2px # .diff-line
  full: 999px # .pill, .dual-bar, .bar-smart
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
    padding: 6px 4px
    typography: '{typography.control}'
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
    font-size: 12px
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
    font-size: 12px
  turn-box:
    background: '{colors.bg-primary}'
    border-left: '3px solid {colors.purple}'
    radius: '0 {rounded.lg} {rounded.lg} 0'
    padding: 8px 10px
  toast-banner:
    background: '{colors.success-soft}'
    foreground: '{colors.success}'
    border-bottom: '{colors.border}'
    padding: 6px 12px
    typography: '{typography.control}'
  live-queue-banner:
    background: 'linear-gradient(135deg, {colors.queue-live-blue}, {colors.queue-live-violet})'
    border-bottom: '{colors.accent}'
    padding: 7px 11px
  queue-item-card:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.queue-card}'
    padding: 9px 10px
    active-border: '{colors.success}'
    active-background: 'linear-gradient(135deg, {colors.queue-active-tint}, {colors.bg-secondary})'
    done-opacity: '0.78'
    done-border: '{colors.border-subtle}'
  queue-active-spotlight:
    background: 'linear-gradient(135deg, {colors.spotlight-active-tint}, {colors.bg-secondary})'
    border: '{colors.success}'
    radius: '{rounded.DEFAULT}'
    padding: '{spacing.card-padding}'
    prompt-inset-background: '{colors.bg-primary}'
    prompt-inset-border: '{colors.border-subtle}'
    prompt-inset-radius: '{rounded.md}'
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
    glow: '{colors.pulse-emerald-glow}'
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
---

# BMAD Companion — Design Spine

> Visual identity contract for `assets/panel.html` (v0.5.3), the right-side BMAD cockpit served as `ui://bmad-companion/panel.html`. Tokens mirror the CSS custom properties in `:root` (dark, default) and `body.theme-light` (light). Behavioral contract lives in [EXPERIENCE.md](./EXPERIENCE.md); this spine wins on any visual conflict with mocks or the as-built file.

## Brand & Style

BMAD Companion is an ambient command cockpit, not a destination app. It lives in ZCode's right-side dock beside an active agent session and answers one question at a glance: *what is the next BMAD move, and which model should run it?* The aesthetic is **instrument-panel density**: a dark GitHub-like canvas, monospace metadata, pill-shaped status telemetry, and a single blue accent that means "interactive / launchable." Color is information, never decoration — green is verified delivery, amber is review/modified, purple is AI/model intelligence, red is high-priority or failed.

The posture is calm utility. No hero imagery, no marketing whitespace, no gamification. Surfaces are tight cards stacked in one scrolling column; every card carries a verb (Launch, Queue, Reconcile, Diff, Open). The brand mark is a 26px "BM" badge on an accent→purple gradient — the only place the two brand hues meet as a fill, while `#projectTitle` stamps `BMAD Companion v0.5.3` (`panel.html:1412`). Light mode is a faithful GitHub-light inversion for users whose host theme is light; it is not a separate brand.

The system is bespoke vanilla CSS with zero dependencies (RULE-1) and zero external assets (RULE-7). There is no component library to inherit from; this DESIGN.md is the whole visual contract.

## Colors

The palette is the GitHub Primer dark/light primitive set, adopted wholesale so the panel reads as native to a developer's existing tooling. Dark is the default (`:root`); light applies when the host sends `theme: "light"` (`applyHostTheme`, panel.html:1121-1127).

- **Surfaces** — `{colors.bg-primary}` is the canvas and the "inset" tone (command editors, previews, expanded card bodies). `{colors.bg-secondary}` is the card/chrome tone (top bar, cards, tab strip). `{colors.bg-tertiary}` is the hover/track tone (button fills, progress tracks, row hovers). `{colors.bg-elevated}` is defined in both themes but currently unused — reserved for future popovers; do not consume it without a component spec.
- **Ink** — `{colors.text-primary}` for titles and essential labels; `{colors.text-secondary}` for rationale, subtitles, and meta prose; `{colors.text-muted}` for uppercase micro-labels and tertiary hints only (see contrast deviations below).
- **Accent blue** (`{colors.accent}`) — the interactive hue: active tab, editable command text, primary buttons, links/paths, focus borders on search, hover borders, and the start of the progress gradient. It means "you can act here."
- **Success green** (`{colors.success}`) — verified delivery: done stories, committed artifacts, active/running queue tasks, reconciliation success, toast banner. Never used for "selected."
- **Warning amber** (`{colors.warning}`) — attention without failure: in-review stories, modified-but-uncommitted artifacts.
- **Purple** (`{colors.purple}`) — the AI/model hue: recommended-model pills, tier badges, AI-reconciled evidence, turn-analysis box, untracked artifacts, queue count. It marks machine intelligence, not human action.
- **Danger red** (`{colors.danger}`) — high-priority recommendations, failed tasks, destructive remove (✕), and the "old status" side of a reconciliation diff.
- **Soft fills** (`*-soft`) — each semantic hue at 8–10% alpha, used *only* as the background of its own pill/badge or the active-tab wash. A soft fill never carries a different hue's text.
- **Fixed literals** — `{colors.on-primary}` white on primary/badge fills; `{colors.primary-gradient-start}` and `{colors.primary-gradient-end}` driving `.btn-primary` gradient; `{colors.brand-gradient-start}` and `{colors.brand-gradient-end}` driving `.brand-badge` gradient; `{colors.queue-live-blue}`/`{colors.queue-live-violet}` tint the live-queue banner; `{colors.queue-active-tint}`/`{colors.spotlight-active-tint}` wash active queue cards and the active-task spotlight; `{colors.pulse-emerald}`/`{colors.pulse-emerald-glow}` drive the running-task glow; `{colors.diff-add-bg}`/`{colors.diff-del-bg}` are the diff line washes. These are hard-coded in panel.html today and are tokenized here so future edits route through variables.

### Measured contrast (WCAG 2.x relative luminance)

Audited 2026-11-24 against the updated WCAG AA compliant token values with a deterministic Node script (composite soft fills over their card surface, then compute ratio). AA normal text requires **4.5:1**; non-text focus indicators require **3:1**. All panel text is small (< 18.66px bold), so the large-text 3:1 allowance never applies.

| Pair | Dark | Light | AA 4.5:1 |
|---|---|---|---|
| text-primary / bg-primary | 16.02 | 15.80 | ✅ both |
| text-primary / bg-secondary | 14.64 | 14.84 | ✅ both |
| text-secondary / bg-primary | 6.50 | 6.11 | ✅ both |
| text-secondary / bg-secondary | 5.94 | 5.74 | ✅ both |
| text-muted / bg-primary | 5.62 | 5.33 | ✅ both |
| text-muted / bg-secondary | 5.14 | 5.01 | ✅ both |
| accent / bg-primary (command text) | 5.66 | 6.89 | ✅ both |
| accent / bg-secondary (active tab) | 5.17 | 6.47 | ✅ both |
| success / bg-secondary | 6.81 | 5.75 | ✅ both |
| warning / bg-secondary | 6.85 | 6.66 | ✅ both |
| purple / bg-secondary | 5.16 | 5.77 | ✅ both |
| danger / bg-secondary | 5.16 | 5.85 | ✅ both |
| on-primary / primary-gradient-start | 4.63 | 6.89 | ✅ both |
| on-primary / primary-gradient-end | 5.17 | 5.17 | ✅ both |
| on-primary / brand-gradient-end (purple) | 4.61 | 6.14 | ✅ both |
| pill accent on accent-soft / bg-secondary | 4.67 | 5.56 | ✅ both |
| pill success on success-soft / bg-secondary | 5.83 | 5.01 | ✅ both |
| pill warning on warning-soft / bg-secondary | 5.86 | 5.75 | ✅ both |
| pill purple on purple-soft / bg-secondary | 4.67 | 5.00 | ✅ both |
| pill danger on danger-soft / bg-secondary | 4.77 | 4.96 | ✅ both |
| border / bg-primary (decorative) | 1.55 | 1.45 | n/a — decoration only |
| model-select focus border (purple) / bg-secondary | 5.16 | 5.77 | ✅ ≥3:1 both |
| search-input focus border (accent) / bg-secondary | 5.17 | 6.47 | ✅ ≥3:1 both |

**Contract.** Essential text (titles, labels, rationale, command text, status words) must reach ≥4.5:1 on the surface it actually sits on, in both themes. Focus indicators must reach ≥3:1. Body and secondary ink, the four semantic hues on card surfaces, and both focus borders already meet this.

**Contrast debt closure (CD-1–CD-5 resolved to full WCAG AA, verified 2026-11-24):**
- **CD-1 — `text-muted`** closed: tuned to `#848d97` (dark) and `#636c76` (light). All surfaces now achieve ≥4.5:1 (dark: 5.62 on `bg-primary`, 5.14 on `bg-secondary`, 4.53 on `bg-tertiary`; light: 5.33 on `bg-primary`, 5.01 on `bg-secondary`, 4.57 on `bg-tertiary`).
- **CD-2 — Pill text on soft fills** closed: tuned soft fills to 8–10% alpha and balanced semantic hues so all five pills achieve ≥4.5:1 in both themes (dark: accent 4.67, success 5.83, warning 5.86, purple 4.67, danger 4.77; light: accent 5.56, success 5.01, warning 5.75, purple 5.00, danger 4.96).
- **CD-3 — Dark primary button gradient** closed: tokenized `--primary-gradient-start` (`#1f6feb` dark, `#0757b6` light) and `--primary-gradient-end` (`#2563eb`), ensuring white text achieves ≥4.5:1 across the full gradient in both themes (dark: 4.63:1 start, 5.17:1 end; light: 6.89:1 start, 5.17:1 end).
- **CD-4 — Dark brand badge gradient** closed: tokenized `--brand-gradient-start` (`#1f6feb` dark, `#0757b6` light) and `--brand-gradient-end` (`#8957e5` dark, `#7445c7` light), ensuring white "BM" glyph achieves ≥4.5:1 across both themes (dark: 4.63:1 start, 4.61:1 end; light: 6.89:1 start, 6.14:1 end).
- **CD-5 — Borders** confirmed: borders are ~1.4–1.6:1 and serve as purely decorative separators; interactive controls are distinguishable by fill tone (`bg-tertiary` for buttons, `bg-secondary` for inputs), and focus indicators reach ≥3:1 (search border ≥5.17:1, model-select border ≥5.16:1, textarea focus ring ≥4.55:1).

## Typography

Two system stacks, no webfonts (RULE-7). `{typography.body}` (12.5px / 1.45) is the default voice — deliberately smaller than a consumer app because the panel is a dense telemetry dock read at arm's length beside code. The ramp is compressed: titles barely rise above body (13px brand, 12.5px section), and hierarchy comes from **weight (700/600) and hue**, not size.

- **Sans roles** — `body` for prose; `brand-title`/`section-title` at 700 for headings; `story-title` at 600; `control` (11.5px/600) for every button and tab; `caption` (11px) for rationale and subtitles; `micro` (10.8px) for model reasons and queue meta; `label-caps` (10.5px/600, uppercase, 0.04em tracking) for the "CONTEXTUAL BMAD SKILL + PROMPT" editor labels.
- **Mono roles** — `{typography.command}` (11.5px) renders the editable `/bmad-<skill> "<prompt>"` in `{colors.accent}`; `{typography.mono-meta}` (11px) renders model selects (including `<optgroup>` provider headers and compact `· <N>k` context / `· $/$$/$$$` cost / `· ⛔ rate-limited` / `★ Recommended` tags, `panel.html:1347-1368`), progress numbers, artifact paths, and previews; `{typography.pill}` (10.5px/600) renders every status pill. Monospace is the signal for "machine-readable token" — commands, model ids, paths, counts.

Rules: never set body prose in mono; never set a command or path in sans; never introduce a size above 13px (no display type — this is an instrument, not a landing page); keep emoji prefixes on action labels (they are the icon system) but always pair them with a text verb.

## Layout & Spacing

Single fluid column inside `.app-shell` (`display:flex; flex-direction:column; height:100vh; overflow:hidden`). Three fixed bands stack above one scrolling region:

1. **Top bar** (`.top-bar`, padding `{spacing.top-bar-padding}`) — brand row (badge + titles left, AI Audit / Sync right) over the progress strip.
2. **Tab strip** (`.tabs-nav`) — `display:grid; grid-template-columns:repeat(4,1fr); gap:{spacing.tab-gap}; padding:4px 8px`.
3. **Banner zone** — live-queue banner and toast banner, each `display:none` until `.visible`.
4. **Main scroll** (`.main-scroll`, `flex:1; overflow-y:auto; padding:{spacing.scroll-padding}`) — the active tab's view (`tab-advisor`, `tab-queue`, `tab-progress`, `tab-catalog`, or `tab-artifacts`).

The spacing scale is a dense 2px-based micro-ramp (`{spacing.1}`–`{spacing.7}` = 2/4/6/8/10/12/24). Cards use `{spacing.card-padding}` (10px 11px) and stack with 8–10px bottom margins; action clusters use `{spacing.action-gap}` (6px) and `flex-wrap:wrap` so buttons reflow rather than overflow in a narrow dock. Two internal form grids exist inside Queue: the top control grid (`1fr 1fr`, `panel.html:857`) and per-item model/review controls (`1.4fr 1fr`, `panel.html:1668`). There are **no breakpoints** — the panel is always a narrow right-side column; long titles and paths truncate with `text-overflow:ellipsis`, and multi-button rows wrap.

**Five-tab contract.** The cockpit has exactly five peer views in this order: **⚡ Next Prompts** (`advisor`, default), **⛓️ Queue** (`queue`, with a live count pill), **📊 Phases & Epics** (`progress`), **🧭 Skills & Agents** (`catalog`), **🗂️ Artifacts** (`artifacts`). Only one tab section is visible at a time (`switchTab`, `panel.html:2660-2668`).

**Layout deviation (as-built, tracked).** `.tabs-nav` declares `repeat(4, 1fr)` but renders **five** buttons (`panel.html:222, 791-797`), so the fifth tab (Artifacts) wraps onto a second row at every width. The contract is a single row of five equal columns; the grid should become `repeat(5, 1fr)` (or `repeat(auto-fit, minmax(0,1fr))`). Tracked as **LD-1**; until fixed, the wrap is the observed behavior, not the intended design.

## Elevation & Depth

Depth is **tonal layering plus 1px borders**, never shadow. The surface ramp `bg-primary → bg-secondary → bg-tertiary` reads as inset → card → hover; expanded card bodies drop back to `bg-primary` to feel "inside" their `bg-secondary` parent. The only `box-shadow` in the system is the `.pulse-dot` running-task glow (`{colors.pulse-emerald-glow}`, 1.6s loop) — a literal "live" signal, not hierarchy.

Gradients are reserved for four brand/live moments: the brand badge (accent→purple), the primary button (accent→`{colors.primary-gradient-end}`), the progress fill (accent→success, left-to-right = momentum toward done), and the live-queue banner/active-task wash (`{colors.queue-live-blue}`→`{colors.queue-live-violet}` / `{colors.queue-active-tint}` / `{colors.spotlight-active-tint}`). Everywhere else, fills are flat. Do not add drop shadows, glows, or gradients to ordinary cards.

## Shapes

Corner radii encode component class, not size:

- `{rounded.DEFAULT}` (8px, the `--radius` token) — all primary cards: section, recommendation, phase, epic, active-task spotlight.
- `{rounded.lg}` (6px) — controls and inset panels: buttons, inputs, selects' wrappers, progress strip, model bar, command editor, reconciliation diff card, artifact preview, insight item, brand badge.
- `{rounded.md}` (5px) — tab buttons, model selects, artifact chips.
- `{rounded.queue-card}` (7px) — queue item cards (a deliberate half-step between control and card).
- `{rounded.sm}` (4px) — story evidence tags; `{rounded.diff-line}` (2px) — diff line washes.
- `{rounded.full}` (999px) — pills and progress bars only. Pills are the sole fully-rounded surfaces; cards and buttons never go pill.

The logic: tighter corners on machine tokens (chips, diff lines), softer corners on human-facing cards, full rounds only on telemetry pills. Keep it.

## Components

Visual specs below; token values live in the frontmatter `components` map. Behavioral rules live in [EXPERIENCE.md](./EXPERIENCE.md#component-patterns).

- **Buttons** — three variants. `{components.button-default}`: tertiary fill, 1px border, 6px radius; hover swaps border to accent and fill to accent-soft. `{components.button-primary}`: accent→`#2563eb` gradient, white label, accent border; hover drops opacity to 0.93 (the gradient does not change). `{components.button-purple}`: purple-soft fill, purple border, primary-ink label — the "AI/queue" secondary action. All buttons are 11.5px/600 with a 4px icon gap and an emoji prefix.
- **Tabs** — `{components.tab-button}` ghost buttons; active state is accent text on accent-soft wash (no underline, no border). The Queue tab carries a `{components.pill-purple}` count.
- **Pills** — `{components.pill-accent}` / `-success` / `-warning` / `-purple` / `-danger`: semantic text on its own soft fill, 999px radius, 10.5px mono/600, 1.5px×6px padding. Status vocabulary is fixed (see Colors).
- **Cards** — `{components.section-card}` and `{components.rec-card}` share the 8px/secondary/bordered anatomy; rec-cards add an accent hover border and 9px stack gap. `{components.phase-card}` and `{components.epic-box}` add a clickable summary row (tertiary hover) over an inset `bg-primary` body separated by a subtle top border. Specialist agent rows in Skills & Agents reuse `.phase-card` as a compact flex row.
- **Queue checkbox** — `{components.queue-checkbox}` (`.queue-cb`, `panel.html:750-756`): 14px square native checkbox with `accent-color: {colors.accent}` inside recommendation card headers for batch queueing.
- **Command editor** — `{components.cmd-editor}` inset panel wrapping a `{components.cmd-textarea}`: accent-colored mono command text, transparent fill, no border, vertical resize, 38px min-height. A `{typography.label-caps}` header names the skill on Next Prompts (note: Skills & Agents omits the header row as-built, `panel.html:2368-2370`). **Focus gap:** the textarea sets `outline:none` with no replacement focus style (`panel.html:419`) — tracked as accessibility deviation AD-1 in EXPERIENCE.md.
- **Model bar / select** — `{components.model-select}` mono select on secondary fill; focus swaps the border to purple (≥3:1). Options are grouped by provider via `<optgroup>` with context-window (`· <N>k`), cost-tier (`· $/$$/$$$`), `· ⛔ rate-limited` (sorted last in each group), and `★ Recommended` suffixes (`panel.html:1347-1368`). A `{components.pill-purple}` tier badge and a `{typography.micro}` reason line accompany it on Next Prompts.
- **Progress strip** — `{components.progress-strip}` inset panel: a 600-weight headline ("Smart AI Progress (X% vs Y% static tracker)"), mono numbers right, and a `{components.dual-bar}` 7px gradient fill animating width over 0.3s.
- **Turn box** — `{components.turn-box}` with a 3px purple left rule marking AI turn analysis.
- **Banners** — `{components.toast-banner}` (success-soft wash, success text, 4s auto-dismiss) and `{components.live-queue-banner}` (blue→violet wash, accent bottom border, embedded 4px progress bar) with a `{components.pulse-dot}`.
- **Queue active spotlight & item card** — `{components.queue-active-spotlight}` renders above the queue list while a task is running using `{colors.success}` border and `{colors.spotlight-active-tint}` gradient over an inset mono `effectivePrompt` block. `{components.queue-item-card}` uses 7px radius; `.is-active` swaps border to success over `{colors.queue-active-tint}`; `.is-done` drops opacity to 0.78 and border to subtle. Status pill + position pill + story pill ride the header.
- **Reconciliation diff card** — `{components.reconciliation-diff-card}` (`panel.html:929-935`): inset `bg-primary` container with 220px scroll cap listing per-key `oldStatus` (`{colors.danger}`) → `newStatus` (`{colors.success}`) transitions and reasons.
- **Artifact chip** — `{components.art-chip}` split chip: main label (diff on click) + a bordered `↗` open segment that fills accent with white glyph on hover.
- **Artifact preview / diff** — `{components.artifact-preview}` mono pre-wrap inset, 360px max-height scroll. Diff lines: `{components.diff-add}` green wash, `{components.diff-del}` red wash, `{components.diff-hunk}` accent/600, `{components.diff-meta}` purple.
- **Story evidence** — `{components.story-evidence}` purple-on-purple-soft tag for AI reconciliation proof.
- **Insight item** — `{components.insight-item}` inset bordered row for cross-check insights and artifact directory entries.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Route every color through a `--token` (or the frontmatter map) | Add new hard-coded hex/rgba literals to panel.html |
| Keep dark as `:root` default; light only via `body.theme-light` from the host | Hard-code a theme or add a manual theme toggle that fights the host |
| Use semantic hues by meaning: green=verified, amber=review/modified, purple=AI/model, red=high-priority/failed, blue=interactive | Recolor pills decoratively or mix a hue's text onto another hue's soft fill |
| Pair every emoji icon with a text verb; keep status pills text-labeled | Convey status by color alone |
| Keep button roles consistent across all 5 views: `btn-primary` for launch/execute/reconcile, `btn-purple` for AI/queue/diff-mode, `btn` for secondary utilities | Promote destructive or secondary utility buttons to primary gradient fills |
| Show focus with the accent/purple border swap (≥3:1) | Remove `outline` without a replacement focus style (the cmd-textarea gap AD-1 is a bug, not a pattern) |
| Keep essential text ≥4.5:1 in both themes; keep CD-1…CD-5 closed to WCAG AA | Claim full WCAG AA without verified relative-luminance contrast measurements |
| Reserve gradients for badge, primary button, progress fill, live banner, and active queue cards | Add shadows, glows, or gradients to ordinary cards |
| Truncate long paths/titles with ellipsis; wrap action rows | Let content overflow the narrow dock or add horizontal scroll |
| Render all dynamic strings through `escapeHtml()`; keep CSP `unsafeEval:false`, zero CDN | Use `eval()`, `window.zcode`, external fonts/scripts, or unescaped interpolation (RULE-7) |
| Five tabs, one visible section, single scrolling column | Add a sixth tab, a sidebar, or nested scroll regions without a spine update |
