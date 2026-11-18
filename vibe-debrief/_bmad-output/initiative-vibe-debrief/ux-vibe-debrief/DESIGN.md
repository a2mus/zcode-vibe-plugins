---
name: Vibe Debrief
description: Zero-dependency ZCode right-side Cockpit HUD (MCP App) and standalone HTML explainer combining 10-second situational radar, X-Ray STE-80 dual coding, multi-grammar SVG diagrams, and 2-stage concept deep dives.
status: final
updated: 2026-11-18
colors:
  # Dark HUD defaults (:root in assets/panel.html & mockups/cockpit-hud.html)
  bg-app: '#090d13'
  bg-surface: '#101620'
  bg-panel: '#121924'
  bg-card: '#182130'
  bg-card-hover: '#1e293b'
  bg-elevated: '#0d131c'
  border: '#94a3b824'
  border-strong: '#94a3b847'
  border-subtle: '#1e2738'
  text-primary: '#e7edf6'
  text-secondary: '#9aa9be'
  text-muted: '#69788e'
  text-on-accent: '#06121e'
  text-on-warn: '#140d00'
  accent: '#38bdf8'
  accent-soft: '#38bdf824'
  accent-border: '#38bdf85c'
  ok: '#34d399'
  ok-soft: '#34d39921'
  ok-subtle: '#34d3990d'
  ok-border: '#34d3995c'
  warn: '#fbbf24'
  warn-soft: '#fbbf2424'
  warn-border: '#fbbf2461'
  risk: '#fb7185'
  risk-soft: '#fb718524'
  risk-border: '#fb718561'
  purple: '#a78bfa'
  purple-soft: '#a78bfa24'
  purple-border: '#a78bfa59'
  teal: '#2dd4bf'
  teal-soft: '#2dd4bf24'
  teal-border: '#2dd4bf59'
  # Field Desk Light overrides (body.theme-light / html[data-theme="light"])
  bg-app-light: '#efeae0'
  bg-surface-light: '#f7f4ec'
  bg-panel-light: '#fbf9f4'
  bg-card-light: '#ffffff'
  bg-card-hover-light: '#f3efe6'
  bg-elevated-light: '#f1ece1'
  border-light: '#1e293b1f'
  border-strong-light: '#1e293b3d'
  border-subtle-light: '#e2dcd0'
  text-primary-light: '#17202e'
  text-secondary-light: '#4c5a6d'
  text-muted-light: '#768396'
  accent-light: '#0284c7'
  accent-soft-light: '#0284c71a'
  accent-border-light: '#0284c757'
  ok-light: '#059669'
  ok-soft-light: '#0596691a'
  ok-border-light: '#05966957'
  warn-light: '#b45309'
  warn-soft-light: '#d977061f'
  warn-border-light: '#d977065c'
  risk-light: '#be123c'
  risk-soft-light: '#e11d481a'
  risk-border-light: '#e11d4857'
  purple-light: '#6d28d9'
  purple-soft-light: '#6d28d91a'
  purple-border-light: '#6d28d94d'
  teal-light: '#0d9488'
  teal-soft-light: '#0d94881a'
  teal-border-light: '#0d94884d'
  # Fixed media & external canvas stages
  brand-sky: '#0ea5e9'
  brand-indigo: '#6366f1'
  explainer-stage-bg: '#070b12'
  excalidraw-stage-bg: '#faf8f2'
  excalidraw-ink: '#1e293b'
  grid-dot: '#94a3b81f'
  grid-dot-light: '#1e293b1f'
  canvas-grid-line: '#38bdf814'
  telemetry-pill-bg: '#0c111ad6'
  white: '#ffffff'
typography:
  brand-title:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 13px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  radar-headline:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 12.8px
    fontWeight: '600'
    lineHeight: '1.48'
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.45'
  block-body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.48'
  stage2-title:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 15px
    fontWeight: '700'
    lineHeight: '1.3'
  control:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 11.5px
    fontWeight: '600'
    lineHeight: '1.3'
  pill:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.2'
  eyebrow:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 10px
    fontWeight: '700'
    lineHeight: '1.25'
    letterSpacing: 0.08em
  micro:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 10px
    fontWeight: '600'
    lineHeight: '1.2'
  code:
    fontFamily: '"JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.45'
  code-chip:
    fontFamily: '"JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    fontSize: 11px
    fontWeight: '600'
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
  xs: 5px
  sm: 7px
  md: 10px
  lg: 14px
  shell: 16px
  full: 999px
spacing:
  '1': 4px
  '2': 6px
  '3': 8px
  '4': 10px
  '5': 12px
  '6': 16px
  header-padding: '10px 12px'
  hud-padding: 12px
  card-padding: '10px 11px'
  radar-padding: '11px 12px'
  block-gap: 11px
  diagram-viewbox-width: 460px
  stage1-canvas-height: 104px
  stage2-canvas-height: 270px
  canvas-width: 600px
  canvas-height: 250px
components:
  hud-header:
    background: '{colors.bg-surface}'
    borderBottom: '{colors.border}'
    padding: '{spacing.header-padding}'
    typography: '{typography.brand-title}'
  xray-toggle:
    background: '{colors.bg-card}'
    border: '{colors.border-strong}'
    foreground: '{colors.text-secondary}'
    activeBackground: '{colors.accent-soft}'
    activeBorder: '{colors.accent-border}'
    activeForeground: '{colors.accent}'
    radius: '{rounded.full}'
    typography: '{typography.pill}'
  gear-popover:
    background: '{colors.bg-card}'
    border: '{colors.border-strong}'
    chipBackground: '{colors.bg-elevated}'
    chipBorder: '{colors.border}'
    radius: '{rounded.md}'
    width: 235px
    typography: '{typography.control}'
  view-switcher:
    background: '{colors.bg-elevated}'
    border: '{colors.border}'
    activeBackground: '{colors.bg-card}'
    activeForeground: '{colors.text-primary}'
    inactiveForeground: '{colors.text-secondary}'
    radius: '{rounded.md}'
    buttonRadius: '{rounded.sm}'
    typography: '{typography.control}'
  radar-card:
    background: '{colors.bg-card}'
    border: '{colors.border}'
    symbolBackground: '{colors.accent-soft}'
    symbolBorder: '{colors.accent-border}'
    symbolForeground: '{colors.accent}'
    radius: '{rounded.md}'
    padding: '{spacing.radar-padding}'
    headlineTypography: '{typography.radar-headline}'
  waiting-badge:
    radius: '{rounded.full}'
    typography: '{typography.pill}'
    choiceBackground: '{colors.warn-soft}'
    choiceForeground: '{colors.warn}'
    choiceBorder: '{colors.warn-border}'
    actionBackground: '{colors.accent-soft}'
    actionForeground: '{colors.accent}'
    actionBorder: '{colors.accent-border}'
    replyBackground: '{colors.purple-soft}'
    replyForeground: '{colors.purple}'
    replyBorder: '{colors.purple-border}'
    blockedBackground: '{colors.risk-soft}'
    blockedForeground: '{colors.risk}'
    blockedBorder: '{colors.risk-border}'
    noneBackground: '{colors.ok-soft}'
    noneForeground: '{colors.ok}'
    noneBorder: '{colors.ok-border}'
  action-chip:
    background: '{colors.bg-elevated}'
    border: '{colors.border-strong}'
    foreground: '{colors.text-primary}'
    primaryBackground: '{colors.accent-soft}'
    primaryBorder: '{colors.accent-border}'
    primaryForeground: '{colors.accent}'
    selectedBackground: '{colors.ok-soft}'
    selectedBorder: '{colors.ok-border}'
    selectedForeground: '{colors.ok}'
    radius: '{rounded.sm}'
    typography: '{typography.control}'
  inline-reply-box:
    inputBackground: '{colors.bg-elevated}'
    inputBorder: '{colors.border-strong}'
    submitBackground: '{colors.accent}'
    submitForeground: '{colors.text-on-accent}'
    radius: '{rounded.xs}'
    typography: '{typography.control}'
  minimal-strip:
    background: '{colors.bg-card}'
    border: '{colors.ok-border}'
    badgeBackground: '{colors.ok-soft}'
    badgeForeground: '{colors.ok}'
    radius: '{rounded.md}'
    typography: '{typography.control}'
  choice-grid:
    gap: '{spacing.2}'
    itemBackground: '{colors.bg-elevated}'
    itemHoverBackground: '{colors.bg-card-hover}'
    itemBorder: '{colors.border}'
    itemHoverBorder: '{colors.accent-border}'
    itemPickedBackground: '{colors.ok-soft}'
    itemPickedBorder: '{colors.ok-border}'
    keyBackground: '{colors.bg-card}'
    barTrack: '{colors.border}'
    barFill: '{colors.accent}'
    radius: '{rounded.md}'
    typography: '{typography.block-body}'
  svg-stage:
    background: '{colors.bg-elevated}'
    border: '{colors.border}'
    radius: '{rounded.md}'
    padding: '{spacing.2}'
    nodeFill: '{colors.bg-card}'
    nodeSelectedFill: '{colors.accent-soft}'
    nodeRiskStroke: '{colors.risk}'
    nodeWarnStroke: '{colors.warn}'
    nodeActiveStroke: '{colors.accent}'
    nodeOkStroke: '{colors.ok}'
    edgeStroke: '{colors.accent}'
    typography: '{typography.code-chip}'
  powerup-dock:
    background: '{colors.bg-elevated}'
    border: '{colors.border}'
    activeBackground: '{colors.accent-soft}'
    activeBorder: '{colors.accent-border}'
    activeForeground: '{colors.accent}'
    radius: '{rounded.sm}'
    typography: '{typography.micro}'
  proof-pill:
    background: '{colors.bg-elevated}'
    border: '{colors.border}'
    okBackground: '{colors.ok-soft}'
    okBorder: '{colors.ok-border}'
    okForeground: '{colors.ok}'
    riskBackground: '{colors.risk-soft}'
    riskBorder: '{colors.risk-border}'
    riskForeground: '{colors.risk}'
    infoForeground: '{colors.text-secondary}'
    detailBackground: '{colors.bg-elevated}'
    radius: '{rounded.sm}'
    typography: '{typography.pill}'
  audit-row:
    background: '{colors.bg-elevated}'
    border: '{colors.border}'
    promoteBackground: '{colors.warn-soft}'
    promoteBorder: '{colors.warn-border}'
    promoteForeground: '{colors.warn}'
    checkAccent: '{colors.ok}'
    checkDoneColor: '{colors.text-muted}'
    radius: '{rounded.sm}'
    typography: '{typography.block-body}'
  concept-pill:
    background: '{colors.bg-elevated}'
    border: '{colors.border-strong}'
    foreground: '{colors.text-primary}'
    activeBackground: '{colors.accent-soft}'
    activeBorder: '{colors.accent-border}'
    activeForeground: '{colors.accent}'
    radius: '{rounded.full}'
    typography: '{typography.control}'
  stage1-drawer:
    background: '{colors.bg-elevated}'
    border: '{colors.accent-border}'
    analogyBackground: '{colors.bg-card}'
    analogyBorder: '{colors.accent}'
    canvasBackground: '{colors.bg-panel}'
    ctaBackground: '{colors.accent}'
    ctaForeground: '{colors.text-on-accent}'
    targetTagBackground: '{colors.purple-soft}'
    targetTagForeground: '{colors.purple}'
    targetTagBorder: '{colors.purple-border}'
    radius: '{rounded.md}'
    typography: '{typography.block-body}'
  stage2-popout:
    background: '{colors.bg-surface}'
    headerBackground: '{colors.bg-card}'
    border: '{colors.border-strong}'
    viewportBackground: '{colors.bg-elevated}'
    excalidrawBackground: '{colors.excalidraw-stage-bg}'
    excalidrawInk: '{colors.excalidraw-ink}'
    gridDot: '{colors.grid-dot}'
    telemetryBackground: '{colors.telemetry-pill-bg}'
    radius: '{rounded.shell}'
    titleTypography: '{typography.stage2-title}'
  missing-banner:
    background: '{colors.warn-soft}'
    border: '{colors.warn-border}'
    foreground: '{colors.text-primary}'
    highlightForeground: '{colors.warn}'
    ctaBackground: '{colors.warn}'
    ctaForeground: '{colors.text-on-warn}'
    radius: '{rounded.md}'
    typography: '{typography.block-body}'
  unclear-box:
    background: '{colors.warn-soft}'
    border: '{colors.warn-border}'
    titleForeground: '{colors.warn}'
    quoteBackground: '{colors.bg-elevated}'
    radius: '{rounded.md}'
    typography: '{typography.block-body}'
  explainer-stage:
    background: '{colors.explainer-stage-bg}'
    border: '{colors.border-strong}'
    gridColor: '{colors.canvas-grid-line}'
    pulseColor: '{colors.accent}'
    radius: '{rounded.md}'
    titleTypography: '{typography.canvas-title}'
    nodeTypography: '{typography.canvas-node}'
  lesson-card:
    background: '{colors.bg-elevated}'
    border: '{colors.border}'
    confirmedBackground: '{colors.ok-subtle}'
    confirmedBorder: '{colors.ok-border}'
    radius: '{rounded.md}'
    typography: '{typography.block-body}'
  lesson-form:
    background: '{colors.bg-elevated}'
    border: '{colors.border-strong}'
    inputBackground: '{colors.bg-card}'
    focusBorder: '{colors.accent}'
    radius: '{rounded.md}'
    typography: '{typography.block-body}'
  memory-code-box:
    background: '{colors.bg-elevated}'
    border: '{colors.border}'
    radius: '{rounded.md}'
    typography: '{typography.code}'
  history-item:
    background: '{colors.bg-card}'
    border: '{colors.border}'
    hoverBorder: '{colors.accent-border}'
    radius: '{rounded.md}'
    typography: '{typography.control}'
  hud-toast:
    background: '{colors.ok-soft}'
    border: '{colors.ok-border}'
    foreground: '{colors.ok}'
    radius: '{rounded.sm}'
    typography: '{typography.control}'
---

# Vibe Debrief — Design Specification (`DESIGN.md`)

> Visual identity and token contract for `assets/panel.html` (`ui://vibe-debrief/panel.html`) and standalone offline HTML exports (`generateStandaloneHtmlArtifact`), evolved to **Cockpit HUD vNext (target `v0.4.0`)** while preserving `v0.3.0` theme-parity and CSP hardening (`R10`, `R11`). Behavioral rules, IA, and journeys live in [EXPERIENCE.md](./EXPERIENCE.md).

## Brand & Style

Vibe Debrief is a **10-second developer cockpit HUD** built for ZCode's narrow right-side panel (`320–460px`). Its aesthetic posture balances two complementary moods:
1. **Night-Watch Telemetry (Default Dark HUD):** Deep obsidian slate surfaces (`#090d13` → `#182130`) with hairline translucent borders, subtle dot-matrix diagram backdrops, and crisp electric-sky (`{colors.accent}`) callouts so signal cuts through immediately.
2. **Field Desk Light (Synced Light Theme):** Warm archival paper surfaces (`#efeae0` → `#fbf9f4` → `#ffffff`) tuned for daylight reading without sterile glare, paired with darkened ink-grade semantic accents (`#0284c7`, `#059669`, `#b45309`, `#be123c`).

Visual chrome stays razor-thin: a single compact top strip replaces stacked control bars, freeing ~85% of the above-the-fold panel for situational radar, kinetic SVG topology, proof chips, and clickable concepts.

Two hard engineering constraints govern every visual choice:
1. **Zero external dependencies:** All styles, inline SVGs, and `<canvas>` visuals render with system UI/mono fonts and pure CSS/SVG/2D Canvas — zero external CSS frameworks, icon fonts, or CDNs.
2. **CSP `unsafeEval: false` & host-theme sync:** The panel runs in an isolated MCP App iframe (`text/html;profile=mcp-app`) and switches dynamically between dark (`:root`) and Field Desk Light (`body.theme-light` / `html[data-theme="light"]`) via host context notifications.

## Colors

Vibe Debrief is **dark-first** with a complete **Field Desk Light** override table. Alpha tints (`-soft`, `-border`, dot grids) use `rgba()` in CSS and 8-digit hex equivalents in frontmatter.

| Role | Dark HUD Token | Field Desk Light Token | Purpose & Boundary |
| --- | --- | --- | --- |
| App / shell canvas | `{colors.bg-app}` (`#090d13`), `{colors.bg-panel}` (`#121924`) | `{colors.bg-app-light}` (`#efeae0`), `{colors.bg-panel-light}` (`#fbf9f4`) | Outer viewport, panel container, Stage 1 inline canvas wrap. |
| Header & Stage 2 chrome | `{colors.bg-surface}` (`#101620`) | `{colors.bg-surface-light}` (`#f7f4ec`) | Pinned 1-strip header, Stage 2 external pop-out frame. |
| Card & interactive tile | `{colors.bg-card}` (`#182130`), `{colors.bg-card-hover}` (`#1e293b`) | `{colors.bg-card-light}` (`#ffffff`), `{colors.bg-card-hover-light}` (`#f3efe6`) | `radar-card`, composable micro-blocks, `gear-popover`, SVG nodes. |
| Inset / elevated well | `{colors.bg-elevated}` (`#0d131c`) | `{colors.bg-elevated-light}` (`#f1ece1`) | Segmented track, SVG/diagram stage, `action-chip`, `stage1-drawer`, `proof-detail`. |
| Translucent hairline borders | `{colors.border}` (`rgba(148,163,184,0.14)`), `{colors.border-strong}` (`0.28`) | `{colors.border-light}` (`rgba(30,41,59,0.12)`), `{colors.border-strong-light}` (`0.24`) | Card containment (`border`) and clickable chip/popover edges (`border-strong`). |
| Text hierarchy | `{colors.text-primary}` (`#e7edf6`), `{colors.text-secondary}` (`#9aa9be`), `{colors.text-muted}` (`#69788e`) | `{colors.text-primary-light}` (`#17202e`), `{colors.text-secondary-light}` (`#4c5a6d`), `{colors.text-muted-light}` (`#768396`) | Primary headlines/claims, descriptions, uppercase eyebrows/timestamps. |
| Sky accent (`Tech` / Active / Flow) | `{colors.accent}` (`#38bdf8`), `{colors.accent-soft}`, `{colors.accent-border}` | `{colors.accent-light}` (`#0284c7`), `{colors.accent-soft-light}`, `{colors.accent-border-light}` | X-Ray `Tech` active state, symbol pills, SVG flow arrows, `Action` waiting state, primary CTA (`{colors.text-on-accent}` `#06121e` text). |
| Emerald (`Verified` / `None` / `Confirmed`) | `{colors.ok}` (`#34d399`), `{colors.ok-soft}`, `{colors.ok-border}` | `{colors.ok-light}` (`#059669`), `{colors.ok-soft-light}`, `{colors.ok-border-light}` | `ok` proof pills, `All Clear` waiting badge, `Minimal Mode` badge, picked choice, confirmed `MEMORY.md` lessons, `hud-toast`. |
| Amber (`Choice` / `Unclear` / `Missing Plugin`) | `{colors.warn}` (`#fbbf24`), `{colors.warn-soft}`, `{colors.warn-border}` | `{colors.warn-light}` (`#b45309`), `{colors.warn-soft-light}`, `{colors.warn-border-light}` | `Pick a Choice` waiting badge, `unclear-box`, `missing-banner` + install CTA (`{colors.text-on-warn}` `#140d00` text), `💡→Rule` promote pill. |
| Rose (`Blocked` / `High Risk`) | `{colors.risk}` (`#fb7185`), `{colors.risk-soft}`, `{colors.risk-border}` | `{colors.risk-light}` (`#be123c`), `{colors.risk-soft-light}`, `{colors.risk-border-light}` | `Blocked` waiting badge, high-risk SVG nodes, unverified/failing `proof-pill.risk`. |
| Violet (`Reply` / `Target Tag`) | `{colors.purple}` (`#a78bfa`), `{colors.purple-soft}`, `{colors.purple-border}` | `{colors.purple-light}` (`#6d28d9`), `{colors.purple-soft-light}`, `{colors.purple-border-light}` | `Answer Question` waiting badge, Stage 1 target plugin tag (`Excalidraw`, `Visualize`, `VectorCraft`). |
| Teal (`STE-80` Clarity Guard) | `{colors.teal}` (`#2dd4bf`), `{colors.teal-soft}`, `{colors.teal-border}` | `{colors.teal-light}` (`#0d9488`), `{colors.teal-soft-light}`, `{colors.teal-border-light}` | `STE-80 Active` clarity status indicator and language badge. |
| Special canvas stages | `{colors.explainer-stage-bg}` (`#070b12`), `{colors.excalidraw-stage-bg}` (`#faf8f2`), `{colors.telemetry-pill-bg}` | `{colors.excalidraw-stage-bg}` (`#faf8f2`) / `{colors.bg-elevated-light}` | 3b1b blueprint stage (`#070b12`), Excalidraw warm whiteboard surface (`#faf8f2` with `{colors.excalidraw-ink}`), Stage 2 floating telemetry pill. |

**Contrast & Theme Parity Floor (`R10`):**
- Load-bearing body text (`{colors.text-primary}` / `{colors.text-secondary}` on `{colors.bg-card}`) targets WCAG 2.1 AA (`>= 4.5:1`), and interactive strokes/focus rings target `>= 3:1` in both Dark HUD and Field Desk Light.
- **v0.3.0 → vNext Parity Rule:** SVG nodes, SVG edge labels, and inline `<canvas>` frames read resolved CSS custom properties (`getComputedStyle(document.documentElement)`) rather than hardcoded dark hexes, guaranteeing crisp legibility under `body.theme-light` and standalone `prefers-color-scheme: light` exports. `{colors.text-muted}` (`#69788e` dark / `#768396` light) is reserved strictly for non-essential uppercase eyebrows and completed strikethroughs (`[ASSUMPTION]` verify light-mode eyebrow contrast during v0.3.0 audit).

## Typography

Two native font stacks ensure zero-latency rendering and crisp identifier legibility across Plain (`STE-80`) and Technical (`X-Ray`) modes:
- **UI Sans (`--font-sans`):** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Code & X-Ray Mono (`--font-mono`):** `"JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

**Type Ramp:**
- **Stage 2 Header (`{typography.stage2-title}`):** `15px` / `700` / `1.3` — popped-out visual canvas title.
- **Brand Title (`{typography.brand-title}`):** `13px` / `700` / `1.3` (`-0.01em` tracking).
- **10s Radar Headline (`{typography.radar-headline}`):** `12.8px` / `600` / `1.48` — concise 1-sentence summary with inline `{typography.code-chip}` symbol pills.
- **Body & Micro-Block Copy (`{typography.body}`, `{typography.block-body}`):** `13px` shell base (`1.45`); `12px` / `1.48` inside choices, Stage 1 drawer, missing-plugin banner, and audit rows.
- **Controls & Pills (`{typography.control}`, `{typography.pill}`):** `11.5px` / `600` for action chips, tabs, and popover controls; `11px` / `700` for waiting badges, X-Ray pill, and proof pills.
- **Eyebrows & Micro (`{typography.eyebrow}`, `{typography.micro}`):** `10px` / `700` uppercase (`0.08em` tracking) for block kickers (`WHAT JUST HAPPENED`, `WAITING ON YOU`); `10px` / `600` for trade-off bars and power-up dock tags.
- **Monospace Evidence (`{typography.code}`, `{typography.code-chip}`):** `11px` for `proof-detail`, raw unclear quote, `MEMORY.md` preview, and inline symbol tags.

## Layout & Spacing

Designed for a **narrow vertical ZCode sidebar (`320–460px`, default prototype `380px`)** with optional Stage 2 external pop-out on the main workspace canvas:

- **1-Strip Pinned Header (`{components.hud-header}`):** Single row (`padding: {spacing.header-padding}`) containing Brand mark + `Distill` trigger on the left, `xray-toggle` + `gear-btn` on the right, and a compact `view-switcher` (`HUD` | `Visual` | `Memory & History`) immediately beneath or integrated inline on wide panels — keeping >=85% of the initial viewport free for the 10s Radar and Visual Centerpiece.
- **Scrollable HUD Body (`padding: {spacing.hud-padding}; gap: {spacing.block-gap}`):** Stacks `radar-card` (or `minimal-strip`) followed by composed Micro-Blocks (`11px` vertical rhythm, `{spacing.card-padding}` internal padding).
- **Gear Popover (`{components.gear-popover}`):** Anchored `top: 46px; right: 10px; width: 235px` above the HUD body so theme, language, persona, model preference, and HTML export never clutter the header strip.
- **SVG Multi-Grammar Stage (`viewBox="0 0 {spacing.diagram-viewbox-width} H"`):** Scales fluidly (`width: 100%; height: auto`) with grammar-appropriate layouts (`Sequence`, `FlowDiff`, `Subway Layer Map`, `Before/After Split`, `Decision Tree`) capped at 6 primary nodes so labels remain readable at `320px`.
- **Stage 1 vs Stage 2 Spatial Boundary:** Stage 1 inline micro-visuals stay bounded at `height: {spacing.stage1-canvas-height}` (`104px`) inside the panel; Stage 2 full interactive canvases (`height: {spacing.stage2-canvas-height}` `270px+` viewport + deep explanation grid) always pop out onto the main ZCode stage or a standalone browser window.

## Elevation & Depth

Depth comes from **tonal surface stepping + crisp `1px` borders** rather than heavy shadows:
- **Flat Tonal Hierarchy:** `bg-app` → `bg-surface` → `bg-panel` → `bg-card` → `bg-elevated` wells, separated by `{colors.border}` and `{colors.border-strong}`.
- **Subtle Dot-Matrix Texture:** Diagram and Stage 2 viewports use a `1px` radial dot grid (`18px × 18px`, `{colors.grid-dot}`) to visually separate spatial canvases from prose blocks.
- **Restrained Floating Shadows:** Only the HUD shell frame (`0 18px 48px rgba(0,0,0,0.45)` dark / `0 12px 32px rgba(30,41,59,0.10)` light) and `gear-popover` (`0 12px 32px rgba(0,0,0,0.55)`) carry elevation shadows so floating controls clearly detach from cards beneath them.

## Shapes

A crisp **5px–16px** geometric scale (`{rounded.*}`):
- `{rounded.shell}` (`16px`): Outer HUD panel shell and Stage 2 external frame.
- `{rounded.lg}` (`14px`): Large Stage 2 viewport / outer workspace cards.
- `{rounded.md}` (`10px`): `radar-card`, composable `.micro-block`, `gear-popover`, `svg-stage`, `stage1-drawer`, `missing-banner`, `lesson-card`, `history-item`.
- `{rounded.sm}` (`7px`): `action-chip`, `proof-pill`, `popout-btn`, `stage1-canvas-wrap`, `powerup-dock` buttons, `view-switcher` segments.
- `{rounded.xs}` (`5px`): `choice-key` badges, inline symbol `.sym` tags, `inline-reply-box` controls.
- `{rounded.full}` (`999px`): `xray-toggle`, `waiting-badge`, `concept-pill`, `target-tag`, status pills.

## Components

Every visual component in the Cockpit HUD contract (paired with behavioral contracts in [EXPERIENCE.md](./EXPERIENCE.md#component-patterns)):

| Component | Token Spec | Visual Anatomy & States |
| --- | --- | --- |
| `hud-header` | `{components.hud-header}` | Single compact top bar (`10px 12px`) with brand clock/spark icon, workspace title, and right-aligned control cluster. |
| `xray-toggle` | `{components.xray-toggle}` | `999px` pill displaying `X-Ray: Plain ↔ Tech`; shifts to `{colors.accent-soft}` fill and `{colors.accent-border}` stroke when `data-mode="tech"`. |
| `gear-popover` | `{components.gear-popover}` | `235px` floating menu triggered by `28×28px` gear icon; stacks compact key/chip rows (`Surface Theme`, `Language`, `Persona`, `Clarity Guard`, `Model`, `Export HTML`). |
| `view-switcher` | `{components.view-switcher}` | Compact segmented strip (`HUD` \| `Visual` \| `Memory & History`) tucked cleanly inside or directly below the header without multi-row chip bloat. |
| `radar-card` | `{components.radar-card}` | Top hero card pairing `WHAT JUST HAPPENED` eyebrow, verdict pill, <=14-word headline (with inline `.sym` code badges in Tech mode), confidence strip, and dashed-top `WAITING ON YOU` footer. |
| `waiting-badge` & `action-chip` | `{components.waiting-badge}`, `{components.action-chip}` | Semantic pill with `6px` status dot (`Choice` amber, `Action` sky, `Reply` violet, `Blocked` rose, `None` emerald) + wrapping `action-chip` quick-reply buttons (`.primary`, `.selected`). |
| `inline-reply-box` | `{components.inline-reply-box}` | Single-line input + accent submit button appearing inside `radar-card` when state is `Reply`. |
| `minimal-strip` | `{components.minimal-strip}` | Collapsed 1-line bar (`{colors.ok-border}`) for trivial turns showing verified badge, 1-line label, and `Expand` link. |
| `choice-grid` & `choice-item` | `{components.choice-grid}` | Vertical stack of selectable cards; each has `20×20px` monospace key (`A`/`B`), bold title, subtext, optional `34×4px` trade-off bars, and emerald `.picked` state. |
| `svg-stage` | `{components.svg-stage}` | Inset `1px`-bordered diagram stage (`460px` viewBox) with risk-coded nodes, numbered edges, kinetic `.dash-flow` dashed pulse (`stroke-dashoffset` animation), and click-to-inspect footer bar. |
| `powerup-dock` | `{components.powerup-dock}` | Compact pill row beneath `svg-stage` (`[SVG]`, `[Excalidraw]`, `[Interactive Gen UI]`, `[VectorCraft]`, `[Animate]`) highlighting active surface and installed status. |
| `proof-pill` & `audit-row` | `{components.proof-pill}`, `{components.audit-row}` | Compact inline badges (`ok` emerald, `risk` rose, `info` neutral) toggling monospace `proof-detail` drawer, paired with `audit-row` (`💡→Rule` promote pill + emerald verification checkboxes). |
| `concept-pill` & `stage1-drawer` | `{components.concept-pill}`, `{components.stage1-drawer}` | Wrapping `999px` technical term pills; active pill opens `{colors.accent-border}` inline drawer with target-plugin `target-tag`, STE-80 explanation, left-accented analogy box, `104px` micro-canvas, and full-width `Deep Dive & Pop Out ↗` CTA. |
| `stage2-popout` & `missing-banner` | `{components.stage2-popout}`, `{components.missing-banner}` | Main-stage visual shell with toolbar, `270px+` dot-grid or Excalidraw `#faf8f2` canvas, floating `{colors.telemetry-pill-bg}` telemetry bar, and 3-column deep explanation cards (`How It Works`, `Key Trade-off`, `In Your Codebase`). Missing plugins render an amber `missing-banner` + `Install <plugin>` CTA above the built-in HTML fallback. |
| `unclear-box` | `{components.unclear-box}` | Amber-bordered fallback card showing honest uncertainty notice, monospace `raw-quote` snippet, and `Clarify (Fast / Cheapest Model)` + `Show Raw Reply` buttons. |
| `explainer-stage` | `{components.explainer-stage}` | `600×250` dark blueprint `<canvas>` curator tour (`30px` grid, `▶`/`⏸`, `⏮`/`⏭`, speed, voice toggle, scene pills, and copyable `script-box`), unlockable anytime via `[Animate]`. |
| `lesson-card`, `lesson-form`, `memory-code-box` | `{components.lesson-card}`, `{components.lesson-form}`, `{components.memory-code-box}` | Rule cards (emerald wash when confirmed in `MEMORY.md`), inline `➕ Add Lesson` form (`54px` textarea), and scrollable monospace `MEMORY.md` preview. |
| `history-item` & `hud-toast` | `{components.history-item}`, `{components.hud-toast}` | Clickable turn snapshot rows (verdict/mode pill, timestamp, TL;DR) and transient bottom-docked emerald confirmation toast. |

## Do's and Don'ts

- **Do** preserve semantic color discipline: emerald (`{colors.ok}`) = verified/clear/saved, amber (`{colors.warn}`) = choice/unclear/missing-plugin/rule-promote, rose (`{colors.risk}`) = blocked/high-risk, sky (`{colors.accent}`) = active/technical X-Ray/flow, violet (`{colors.purple}`) = reply/external plugin target.
- **Do** bind SVG, inline `<canvas>`, and standalone exports to resolved CSS variables so Dark HUD and Field Desk Light achieve full contrast parity (`R10`).
- **Do** keep the 320–460px sidebar visually uncluttered — pop full interactive whiteboards, simulations, and vector graphics out to Stage 2 rather than shrinking controls into unreadable scrollbars.
- **Don't** stack multi-row headers, persona chip bars, or full-file code diffs inside the top chrome.
- **Don't** introduce external fonts, CDN CSS/JS, inline `onclick=` attributes, or `eval` (`unsafeEval: false` / `C3`).
- **Don't** hide unverified claims behind celebratory green styling or exceed 6 primary nodes in the inline SVG diagram.
