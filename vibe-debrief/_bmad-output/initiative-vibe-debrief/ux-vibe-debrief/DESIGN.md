---
name: Vibe Debrief
description: Zero-dependency ZCode right-side comprehension panel (MCP App) and standalone HTML explainer implementing Karpathy's 4-rung comprehension framework.
status: final
updated: 2026-11-17
colors:
  # Dark mode defaults (:root in assets/panel.html)
  bg-primary: '#0b0f17'
  bg-secondary: '#131a26'
  bg-tertiary: '#1c2536'
  bg-elevated: '#182030'
  border: '#2a354b'
  border-subtle: '#1e2738'
  text-primary: '#f0f6fc'
  text-secondary: '#9ba7b8'
  text-muted: '#697586'
  accent: '#38bdf8'
  accent-soft: '#38bdf824'
  success: '#34d399'
  success-soft: '#34d39924'
  success-subtle: '#34d3990d'
  warning: '#fbbf24'
  warning-soft: '#fbbf2426'
  purple: '#a78bfa'
  purple-soft: '#a78bfa26'
  danger: '#fb7185'
  danger-soft: '#fb718526'
  teal: '#2dd4bf'
  teal-soft: '#2dd4bf24'
  # Light mode overrides (body.theme-light in assets/panel.html)
  bg-primary-light: '#f8fafc'
  bg-secondary-light: '#ffffff'
  bg-tertiary-light: '#f1f5f9'
  bg-elevated-light: '#ffffff'
  border-light: '#cbd5e1'
  border-subtle-light: '#e2e8f0'
  text-primary-light: '#0f172a'
  text-secondary-light: '#475569'
  text-muted-light: '#64748b'
  accent-light: '#0284c7'
  accent-soft-light: '#0284c71a'
  success-light: '#059669'
  success-soft-light: '#0596691a'
  warning-light: '#d97706'
  warning-soft-light: '#d977061f'
  purple-light: '#7c3aed'
  purple-soft-light: '#7c3aed1a'
  danger-light: '#e11d48'
  danger-soft-light: '#e11d481a'
  teal-light: '#0d9488'
  teal-soft-light: '#0d94881a'
  # Brand gradients & fixed media stage surfaces
  brand-sky: '#0ea5e9'
  brand-indigo: '#6366f1'
  explainer-stage-bg: '#070b12'
  canvas-grid-line: '#38bdf814'
  white: '#ffffff'
typography:
  brand-badge:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 14px
    fontWeight: '800'
    lineHeight: '1.2'
  brand-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 13.5px
    fontWeight: '800'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  hero-tldr:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 14px
    fontWeight: '800'
    lineHeight: '1.4'
  story-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 12.5px
    fontWeight: '800'
    lineHeight: '1.35'
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  story-body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 12.6px
    fontWeight: '400'
    lineHeight: '1.5'
  tab-label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 11.5px
    fontWeight: '700'
    lineHeight: '1.3'
  control:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.3'
  kicker:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 10.5px
    fontWeight: '800'
    lineHeight: '1.3'
    letterSpacing: 0.05em
  pill:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 10.5px
    fontWeight: '700'
    lineHeight: '1.2'
  micro:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif'
    fontSize: 9.8px
    fontWeight: '600'
    lineHeight: '1.2'
  code:
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.45'
  code-chip:
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 10.8px
    fontWeight: '500'
    lineHeight: '1.3'
  canvas-title:
    fontFamily: 'sans-serif'
    fontSize: 13px
    fontWeight: '700'
    lineHeight: '1.2'
  canvas-node:
    fontFamily: 'sans-serif'
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  xs: 6px
  sm: 7px
  md: 8px
  lg: 9px
  DEFAULT: 10px
  full: 999px
spacing:
  '1': 3px
  '2': 4px
  '3': 6px
  '4': 8px
  '5': 10px
  '6': 12px
  topbar-padding: '10px 12px 8px'
  panel-padding: 12px
  card-padding: '11px 13px'
  card-gap: 10px
  diagram-viewbox-width: 460px
  diagram-node-height: 58px
  canvas-width: 600px
  canvas-height: 250px
components:
  top-bar:
    background: '{colors.bg-secondary}'
    borderBottom: '{colors.border}'
    padding: '{spacing.topbar-padding}'
  brand-badge:
    backgroundGradient: '{colors.accent} -> {colors.purple}'
    foreground: '{colors.bg-primary}'
    radius: '{rounded.md}'
    typography: '{typography.brand-badge}'
  model-select:
    background: '{colors.bg-tertiary}'
    foreground: '{colors.text-primary}'
    border: '{colors.border}'
    radius: '{rounded.sm}'
    maxWidth: 118px
    typography: '{typography.control}'
  button-primary:
    backgroundGradient: '{colors.brand-sky} -> {colors.brand-indigo}'
    border: '{colors.accent}'
    foreground: '{colors.white}'
    radius: '{rounded.sm}'
    typography: '{typography.control}'
  button-secondary:
    background: '{colors.bg-tertiary}'
    foreground: '{colors.text-primary}'
    border: '{colors.border}'
    hoverBackground: '{colors.accent-soft}'
    hoverBorder: '{colors.accent}'
    radius: '{rounded.sm}'
    typography: '{typography.control}'
  button-success:
    background: '{colors.success-soft}'
    foreground: '{colors.success}'
    border: '{colors.success}'
    hoverForeground: '{colors.bg-primary}'
    radius: '{rounded.sm}'
    typography: '{typography.control}'
  mode-switcher:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.lg}'
    padding: '{spacing.1}'
    activeBugBackground: '{colors.danger-soft}'
    activeBugForeground: '{colors.danger}'
    activeImplBackground: '{colors.accent-soft}'
    activeImplForeground: '{colors.accent}'
    buttonRadius: '{rounded.xs}'
    typography: '{typography.tab-label}'
  persona-chip:
    background: '{colors.bg-tertiary}'
    foreground: '{colors.text-secondary}'
    border: '{colors.border}'
    activeBackground: '{colors.purple-soft}'
    activeBorder: '{colors.purple}'
    activeForeground: '{colors.text-primary}'
    radius: '{rounded.full}'
    typography: '{typography.pill}'
  ste-toggle-chip:
    background: '{colors.bg-tertiary}'
    foreground: '{colors.text-secondary}'
    border: '{colors.border}'
    activeBackground: '{colors.teal-soft}'
    activeBorder: '{colors.teal}'
    activeForeground: '{colors.teal}'
    radius: '{rounded.full}'
    typography: '{typography.pill}'
  tabs-nav:
    background: '{colors.bg-secondary}'
    borderBottom: '{colors.border}'
    activeColor: '{colors.accent}'
    inactiveColor: '{colors.text-secondary}'
    typography: '{typography.tab-label}'
  toast-banner:
    background: '{colors.success-soft}'
    border: '{colors.success}'
    foreground: '{colors.text-primary}'
    radius: '{rounded.md}'
    typography: '{typography.control}'
  hero-card:
    backgroundGradient: '{colors.bg-secondary} -> {colors.bg-tertiary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: '{spacing.6}'
    titleTypography: '{typography.hero-tldr}'
  pill-badge:
    radius: '{rounded.full}'
    typography: '{typography.pill}'
    bugBackground: '{colors.danger-soft}'
    bugForeground: '{colors.danger}'
    implBackground: '{colors.accent-soft}'
    implForeground: '{colors.accent}'
    personaBackground: '{colors.purple-soft}'
    personaForeground: '{colors.purple}'
    successBackground: '{colors.success-soft}'
    successForeground: '{colors.success}'
    warningBackground: '{colors.warning-soft}'
    warningForeground: '{colors.warning}'
    tealBackground: '{colors.teal-soft}'
    tealForeground: '{colors.teal}'
  analogy-box:
    background: '{colors.bg-primary}'
    accentBorder: '{colors.warning}'
    radius: '{rounded.sm}'
    kickerTypography: '{typography.kicker}'
    bodyTypography: '{typography.body}'
  diagram-card:
    background: '{colors.bg-secondary}'
    stageBackground: '{colors.bg-primary}'
    stageBorder: '{colors.border-subtle}'
    radius: '{rounded.DEFAULT}'
    stageRadius: '{rounded.md}'
    kickerTypography: '{typography.kicker}'
  diagram-node:
    fill: '{colors.bg-secondary}'
    selectedFill: '{colors.accent-soft}'
    highRiskStroke: '{colors.danger}'
    mediumRiskStroke: '{colors.warning}'
    activeStroke: '{colors.accent}'
    defaultStroke: '{colors.success}'
    radius: '{rounded.md}'
    height: '{spacing.diagram-node-height}'
    typography: '{typography.control}'
  diagram-edge:
    defaultStroke: '{colors.accent}'
    mediumRiskStroke: '{colors.warning}'
    highRiskStroke: '{colors.danger}'
    badgeFill: '{colors.bg-primary}'
    badgeRadius: 8.5px
    typography: '{typography.micro}'
  file-badge:
    background: '{colors.bg-tertiary}'
    border: '{colors.border}'
    highRiskBorder: '{colors.danger}'
    mediumRiskBorder: '{colors.warning}'
    selectedBackground: '{colors.accent-soft}'
    selectedBorder: '{colors.accent}'
    radius: '{rounded.xs}'
    typography: '{typography.code-chip}'
  node-inspector:
    background: '{colors.bg-primary}'
    border: '{colors.border}'
    radius: '{rounded.sm}'
    typography: '{typography.control}'
  story-card:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.DEFAULT}'
    padding: '{spacing.card-padding}'
    titleTypography: '{typography.story-title}'
    bodyTypography: '{typography.story-body}'
    causeAccent: '{colors.danger}'
    planAccent: '{colors.accent}'
    whyAccent: '{colors.purple}'
    resultAccent: '{colors.success}'
    consequencesAccent: '{colors.teal}'
    lessonsAccent: '{colors.warning}'
  status-banner:
    yesBackground: '{colors.success-soft}'
    yesBorder: '{colors.success}'
    partialBackground: '{colors.warning-soft}'
    partialBorder: '{colors.warning}'
    noBackground: '{colors.danger-soft}'
    noBorder: '{colors.danger}'
    radius: '{rounded.md}'
    typography: '{typography.story-title}'
  proof-item:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.xs}'
    evidenceTypography: '{typography.code-chip}'
  audit-row:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.xs}'
    typography: '{typography.body}'
  check-row:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    accentColor: '{colors.success}'
    doneTextColor: '{colors.text-muted}'
    radius: '{rounded.xs}'
    typography: '{typography.body}'
  promote-button:
    background: '{colors.warning-soft}'
    foreground: '{colors.warning}'
    border: '{colors.warning}'
    radius: '{rounded.xs}'
    typography: '{typography.micro}'
  lesson-card:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    confirmedBackground: '{colors.success-subtle}'
    confirmedBorder: '{colors.success}'
    radius: '{rounded.md}'
    titleTypography: '{typography.story-title}'
  lesson-form:
    background: '{colors.bg-primary}'
    border: '{colors.border}'
    inputBackground: '{colors.bg-secondary}'
    focusBorder: '{colors.accent}'
    radius: '{rounded.md}'
    typography: '{typography.body}'
  explainer-stage:
    background: '{colors.explainer-stage-bg}'
    border: '{colors.border}'
    gridColor: '{colors.canvas-grid-line}'
    pulseColor: '{colors.accent}'
    radius: '{rounded.DEFAULT}'
    titleTypography: '{typography.canvas-title}'
    nodeTypography: '{typography.canvas-node}'
  explainer-controls:
    gap: '{spacing.3}'
    buttonSpec: '{components.button-secondary}'
    primarySpec: '{components.button-primary}'
  scene-pill:
    background: '{colors.bg-tertiary}'
    foreground: '{colors.text-secondary}'
    border: '{colors.border}'
    activeBackground: '{colors.accent-soft}'
    activeBorder: '{colors.accent}'
    activeForeground: '{colors.accent}'
    radius: '{rounded.full}'
    typography: '{typography.control}'
  explainer-caption:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    radius: '{rounded.md}'
    kickerTypography: '{typography.kicker}'
    bodyTypography: '{typography.body}'
  script-box:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.md}'
    typography: '{typography.code}'
  memory-code-box:
    background: '{colors.bg-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.md}'
    typography: '{typography.code}'
  history-item:
    background: '{colors.bg-secondary}'
    border: '{colors.border}'
    hoverBorder: '{colors.accent}'
    radius: '{rounded.md}'
    typography: '{typography.story-title}'
---

# Vibe Debrief — Design Specification (`DESIGN.md`)

> Visual identity and token contract for `assets/panel.html` (`ui://vibe-debrief/panel.html`) and standalone offline HTML exports (`generateStandaloneHtmlArtifact`). Behavioral rules, IA, and journeys live in [EXPERIENCE.md](./EXPERIENCE.md).

## Brand & Style

Vibe Debrief is a **technical comprehension cockpit** built for vibe-coders working in ZCode's narrow right-side panel. Its aesthetic posture is **clarity-first developer telemetry**: dark slate surfaces inspired by terminal and IDE canvases, crisp hairline borders instead of heavy drop shadows, high-signal color coding reserved exclusively for risk and causal roles, and compact typography designed to be scanned in 30–60 seconds without wall-of-text fatigue.

Two hard engineering constraints shape every visual decision:
1. **Zero external dependencies:** All styles, inline SVGs, and `<canvas>` visuals render with system UI fonts and pure CSS/SVG/2D Canvas — zero external CSS frameworks, icon fonts, or CDNs.
2. **CSP `unsafeEval: false` & host-theme sync:** The panel runs in an isolated MCP App iframe (`text/html;profile=mcp-app`) and switches dynamically between dark (default `:root`) and light (`body.theme-light`) via host context notifications.

## Colors

Vibe Debrief is **dark-first** (`:root` defines dark surfaces) with a complete light-theme override table (`body.theme-light`). Every color carries semantic meaning rather than decoration:

| Role | Dark Token | Light Token | Purpose & Boundary |
| --- | --- | --- | --- |
| Primary canvas | `{colors.bg-primary}` (`#0b0f17`) | `{colors.bg-primary-light}` (`#f8fafc`) | App shell background, diagram stage, inset evidence/audit rows, code boxes. |
| Card surface | `{colors.bg-secondary}` (`#131a26`) | `{colors.bg-secondary-light}` (`#ffffff`) | Top bar, tab strip, story cards, SVG nodes, history items. |
| Control surface | `{colors.bg-tertiary}` (`#1c2536`) | `{colors.bg-tertiary-light}` (`#f1f5f9`) | Secondary buttons, model selector, persona/file chips, hero gradient stop. |
| Elevated surface | `{colors.bg-elevated}` (`#182030`) | `{colors.bg-elevated-light}` (`#ffffff`) | Reserved token for floating/elevated containers (currently unused in `panel.html` CSS). |
| Hairline borders | `{colors.border}` (`#2a354b`) / `{colors.border-subtle}` (`#1e2738`) | `{colors.border-light}` (`#cbd5e1`) / `{colors.border-subtle-light}` (`#e2e8f0`) | Card separation (`border`) and inset sub-row dividers (`border-subtle`). |
| Text hierarchy | `{colors.text-primary}` (`#f0f6fc`), `{colors.text-secondary}` (`#9ba7b8`), `{colors.text-muted}` (`#697586`) | `{colors.text-primary-light}` (`#0f172a`), `{colors.text-secondary-light}` (`#475569`), `{colors.text-muted-light}` (`#64748b`) | Headline/body, metadata/tabs, timestamps/completed checks. |
| Sky accent (Implementation / Active) | `{colors.accent}` (`#38bdf8`) / `{colors.accent-soft}` | `{colors.accent-light}` (`#0284c7`) / `{colors.accent-soft-light}` | Active tab underline, Implementation mode, selected diagram node, interactive focus. |
| Emerald (Verified / Success) | `{colors.success}` (`#34d399`) / `{colors.success-soft}` | `{colors.success-light}` (`#059669`) / `{colors.success-soft-light}` | Result cards, `yes` status banner, confirmed lessons, low-risk nodes, toast banner. |
| Amber (Warning / Watch / Lessons) | `{colors.warning}` (`#fbbf24`) / `{colors.warning-soft}` | `{colors.warning-light}` (`#d97706`) / `{colors.warning-soft-light}` | Analogy left border, medium-risk nodes/edges, `partial` status, `💡→Rule` promote chip, Section 5 lessons. |
| Rose (Bug / High Risk) | `{colors.danger}` (`#fb7185`) / `{colors.danger-soft}` | `{colors.danger-light}` (`#e11d48`) / `{colors.danger-soft-light}` | Bug mode active toggle, Card 1 Root Cause accent, `no` status, `high` risk files/nodes (`auth`, `server`, `payment`, `hook`). |
| Violet (Persona / Why) | `{colors.purple}` (`#a78bfa`) / `{colors.purple-soft}` | `{colors.purple-light}` (`#7c3aed`) / `{colors.purple-soft-light}` | Active persona chip, Implementation Card 2 *Plan & Why* accent, brand badge gradient stop. |
| Teal (Consequences / STE-80) | `{colors.teal}` (`#2dd4bf`) / `{colors.teal-soft}` | `{colors.teal-light}` (`#0d9488`) / `{colors.teal-soft-light}` | Active `STE-80` clarity chip, Card 4 *Consequences & Oversight* accent. |
| Brand gradient & Stage | `{colors.brand-sky}` (`#0ea5e9`), `{colors.brand-indigo}` (`#6366f1`), `{colors.explainer-stage-bg}` (`#070b12`) | Same (dark cinema stage) | Primary CTA (`✨ AI Explain`, `▶ Play`) and 3b1b-inspired blueprint `<canvas>` backdrop. |

**CSS `rgba()` equivalence:** Soft tint tokens in `assets/panel.html` use `rgba()` over the base hue (e.g., `rgba(56, 189, 248, 0.14)` for `{colors.accent-soft}`); hex equivalents in frontmatter represent the exact alpha channel.

**Contrast & Light-Mode Parity Gap (`[ASSUMPTION]`):**
- **Target contrast floor:** Load-bearing text (`{colors.text-primary}` on `{colors.bg-secondary}`, `{colors.text-secondary}` on `{colors.bg-secondary}`) targets WCAG 2.1 AA (`>= 4.5:1` for body text, `>= 3:1` for node strokes and focus indicators).
- **Known implementation delta:** In `assets/panel.html` v0.2.0, SVG diagram nodes/edges (`#131a26`, `#0b0f17`, `#9ba7b8`) and `.explainer-stage` (`#070b12`) hardcode dark-theme hexes instead of reading `body.theme-light` CSS variables; `{colors.text-muted}` (`#697586` on `#131a26`) sits near `3.5:1` and should be lightened or restricted to non-essential timestamps / completed strikethroughs (`[ASSUMPTION]` for v0.3.0 contrast audit).

## Typography

Vibe Debrief uses two native system font stacks to preserve zero-dependency startup speed and crisp code legibility:
- **UI Sans (`--font-sans`):** `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif`
- **Code & Evidence Mono (`--font-mono`):** `"Cascadia Code", "JetBrains Mono", Consolas, monospace`

**Type Ramp:**
- **Hero TL;DR (`{typography.hero-tldr}`):** `14px` / `800` / `1.4` — single-sentence summary at the top of the panel.
- **Brand Badge & Title (`{typography.brand-badge}`, `{typography.brand-title}`):** `14px` / `800` and `13.5px` / `800` (`-0.01em` tracking).
- **Body & Story Prose (`{typography.body}`, `{typography.story-body}`):** `13px` base (`1.5` line-height) and `12.6px` inside cards (`white-space: pre-line` for multi-line STE-80 bullets).
- **Card Headers (`{typography.story-title}`):** `12.5px` / `800` — numbered step titles (`1.`–`5.`).
- **Tab & Mode Controls (`{typography.tab-label}`, `{typography.control}`):** `11.5px` / `700` for navigation; `11px` / `600` for compact header buttons and transport controls.
- **Kickers & Pills (`{typography.kicker}`, `{typography.pill}`):** `10.5px` / `800` uppercase (`0.04em`–`0.05em` tracking) for section labels; `10.5px` / `700` for status pills.
- **Monospace Evidence (`{typography.code}`, `{typography.code-chip}`):** `11px` for `MEMORY.md` and plain-text narration script; `10.8px` for file badges and `10.3px` for `proofClaims` evidence paths.

## Layout & Spacing

The panel is engineered for a **narrow vertical ZCode sidebar** (`flex-direction: column; height: 100vh; overflow: hidden;`):

- **Pinned Chrome (`flex-shrink: 0`):**
  1. `{components.top-bar}` (`padding: {spacing.topbar-padding}`) holds 3 stacked rows: Brand + Action buttons, 2-column equal Mode Switcher (`grid-template-columns: 1fr 1fr; gap: {spacing.3}`), and horizontal scrolling Persona Strip + `STE-80` chip.
  2. `{components.tabs-nav}` (`padding: 0 10px; gap: {spacing.2}`) pins the 4 tab triggers immediately below the header.
- **Scrollable Body (`flex: 1; overflow-y: auto; padding: {spacing.panel-padding}`):** Renders one active tab view at a time with `10px`–`11px` vertical rhythm (`{spacing.card-gap}`).
- **Truncation & Overflow Guardrails:** `.brand-left` sets `min-width: 0` with `text-overflow: ellipsis` on title/subtitle; `{components.model-select}` caps width at `118px`; `.persona-strip` scrolls horizontally (`overflow-x: auto`) rather than wrapping into multiple rows.
- **SVG Adaptive Serpentine Grid:** Inside `viewBox="0 0 {spacing.diagram-viewbox-width} H"`, `cols` adapts to node count (`1–2` nodes → `1–2` columns, `3–4` nodes → `2` columns, `5–6` nodes → `3` columns) with odd rows reversing column direction (`serpentine`) so arrows stay short and readable at narrow sidebar widths.

## Elevation & Depth

Vibe Debrief avoids heavy drop shadows to keep dense technical cards calm and legible:
- **Flat Tonal Layering:** Depth comes from stepping surface values (`{colors.bg-primary}` inset wells inside `{colors.bg-secondary}` cards over `{colors.bg-primary}` shell), reinforced by `1px solid` borders (`{colors.border}` and `{colors.border-subtle}`).
- **Semantic Left-Edge Bars:** Story cards use a `4px solid` left border (`.story-card`) to anchor reading order by role without introducing colored card backgrounds.
- **Single Decorative Shadow:** Only `{components.brand-badge}` carries a subtle glow (`0 2px 8px rgba(56, 189, 248, 0.25)`) to distinguish the plugin mark in the top-left corner.

## Shapes

Corners follow a tight, technical **6px–10px** hierarchy (`{rounded.*}`), reserving full pills (`{rounded.full}`) exclusively for clickable chips and status badges:
- `{rounded.DEFAULT}` (`10px`): Primary cards (`hero-card`, `diagram-card`, `story-card`, `explainer-stage`).
- `{rounded.lg}` (`9px`): Segmented `mode-switcher` track.
- `{rounded.md}` (`8px`): Inner stages (`diagram-card` stage, SVG node `<rect>`, `brand-badge`, `status-banner`, `toast-banner`, `lesson-card`, `history-item`, `script-box`, `memory-code-box`).
- `{rounded.sm}` (`7px`): Action buttons (`btn`), `model-select`, `analogy-box`, `node-inspector`.
- `{rounded.xs}` (`6px`): Segmented `mode-btn`, `file-badge`, `audit-row`, `check-row`, `proof-item`, `promote-button`.
- `{rounded.full}` (`999px`): `pill-badge`, `persona-chip`, `ste-toggle-chip`, `scene-pill`.

## Components

Every visual component defined in `assets/panel.html` (paired with behavioral contracts in [EXPERIENCE.md](./EXPERIENCE.md#component-patterns)):

| Component | Token Spec | Visual Anatomy & States |
| --- | --- | --- |
| `top-bar` | `{components.top-bar}` | Full-width pinned header with `8px`–`10px` vertical spacing and bottom hairline `{colors.border}`. |
| `brand-badge` | `{components.brand-badge}` | `26×26px` rounded square (`{rounded.md}`) with `VD` monogram over 135° `{colors.accent}` → `{colors.purple}` gradient. |
| `model-select` | `{components.model-select}` | Compact `<select>` (`max-width: 118px`, ellipsis) displaying lightweight Gemini models (`⚡ <slug>`). |
| `button-primary` / `button-secondary` / `button-success` | `{components.button-primary}`, `{components.button-secondary}`, `{components.button-success}` | `5px 8px` compact buttons (`7px` radius). Primary uses sky-to-indigo gradient (`✨ AI Explain`, `▶ Play`); secondary shifts to `{colors.accent-soft}` on hover; success uses emerald soft tint (`Confirm & Save`). |
| `mode-switcher` | `{components.mode-switcher}` | Inset 2-column track (`{colors.bg-primary}`). Active Bug pill tints `{colors.danger-soft}` / `{colors.danger}`; active Implementation pill tints `{colors.accent-soft}` / `{colors.accent}`. |
| `persona-chip` & `ste-toggle-chip` | `{components.persona-chip}`, `{components.ste-toggle-chip}` | Scrollable `999px` pills. Active persona tints `{colors.purple-soft}`; active `STE-80` chip tints `{colors.teal-soft}`. |
| `tabs-nav` | `{components.tabs-nav}` | Horizontal tab bar with `2px solid` bottom indicator (`{colors.accent}` when active). `🎬 Explainer` tab is hidden unless complex. |
| `toast-banner` | `{components.toast-banner}` | Full-width inline banner above tabs content (`{colors.success-soft}` fill, `{colors.success}` border), hidden by default (`.visible`). |
| `hero-card` & `pill-badge` | `{components.hero-card}`, `{components.pill-badge}` | Gradient card (`160deg`) hosting mode/complexity/STE-80/persona pills, right-aligned timestamp, bold `14px` TL;DR, and `analogy-box`. |
| `analogy-box` | `{components.analogy-box}` | Inset `{colors.bg-primary}` block with `3px solid {colors.warning}` left bar and uppercase `💡 Picture It Like This` kicker. |
| `diagram-card`, `diagram-node`, `diagram-edge` | `{components.diagram-card}`, `{components.diagram-node}`, `{components.diagram-edge}` | Inset SVG stage (`460px` viewBox). Nodes (`rx="8"`, `h="58"`) encode risk via `1.5px` stroke (`2.4px` + `{colors.accent-soft}` fill when selected); edges carry `r="8.5"` numbered step circles. |
| `file-badge` & `node-inspector` | `{components.file-badge}`, `{components.node-inspector}` | Monospace file chips with role icon + risk border; dashed `node-inspector` footer bar displays selected node/file role, risk, and path. |
| `story-card` & `status-banner` | `{components.story-card}`, `{components.status-banner}` | Cards `1`–`5` with `4px` semantic left bar (`cause`, `plan`, `why`, `result`, `consequences`, `lessons`). Card 3 Bug mode shows full-width `status-banner` (`yes` emerald, `partial` amber, `no` rose). |
| `proof-item` | `{components.proof-item}` | Inset evidence row (`verified` ✅ / `unverified` ❌ / `inferred` ℹ️) with claim label and monospace source line. |
| `audit-row`, `check-row`, `promote-button` | `{components.audit-row}`, `{components.check-row}`, `{components.promote-button}` | Card 4 oversight sub-blocks: `audit-row` pairs risk pill + `💡→Rule` promote button; `check-row` pairs emerald-accent checkbox with strikethrough on completion. |
| `lesson-card` & `lesson-form` | `{components.lesson-card}`, `{components.lesson-form}` | Section 5 list items (emerald border + soft green wash when `.confirmed`) plus collapsible inline form (`lesson-form`) with `54px` min-height textarea. |
| `explainer-stage`, `explainer-controls`, `scene-pill`, `explainer-caption`, `script-box` | `{components.explainer-stage}`, `{components.explainer-controls}`, `{components.scene-pill}`, `{components.explainer-caption}`, `{components.script-box}` | Dark `#070b12` `600×250` `<canvas>` stage with `30px` blueprint grid, bottom progress bar, transport row (`▶`/`⏸`, `⏮`, `⏭`, speed `<select>`, voice toggle), horizontal scene pills, caption card, and monospace `script-box`. |
| `memory-code-box` & `history-item` | `{components.memory-code-box}`, `{components.history-item}` | `260px` max-height scrollable monospace `MEMORY.md` preview (`word-break: break-word`) and clickable `history-item` cards with accent hover border. |

## Do's and Don'ts

- **Do** keep all color meaning semantic: rose (`{colors.danger}`) means Bug or High Risk, amber (`{colors.warning}`) means Watch Out / Analogy / Lesson, emerald (`{colors.success}`) means Verified / Confirmed, sky (`{colors.accent}`) means Implementation / Active Selection.
- **Do** reserve pill shapes (`{rounded.full}`) for compact tags, persona chips, and scene selectors so rectangular cards stay scannable.
- **Do** bind both SVG diagram colors and `<canvas>` stage tokens to theme variables in future updates so `body.theme-light` achieves full visual parity (`[ASSUMPTION]` for v0.3.0).
- **Don't** introduce external fonts, CDN CSS/JS, inline `onclick=` attributes, or `eval` (violates `RULE-2` zero-dependency and `RULE-3` `unsafeEval: false`).
- **Don't** add heavy box shadows, decorative gradients on body cards, or more than 6 nodes in the SVG diagram.
- **Don't** display full-file code diffs or multi-turn chat bubbles inside the right-side panel.
