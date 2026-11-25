# Colour options - BMAD Companion readability pass (2026-11-25)

Three calmer candidates measured on 2026-11-25. **The owner chose Option C — Warm charcoal**, and its values are now the tokens in `DESIGN.md` (not as-built until the build step). Options A and B are kept here as the record of what was not chosen.

How to read this file:
- Every ratio below is measured with the project's own contrast function (`tests/helpers.mjs`, `contrastRatio`), compositing each soft fill over its card surface before measuring - the same method as the contrast table in `DESIGN.md`.
- The standard is 4.5:1 for text and 3:1 for focus borders and non-text cues.
- Light and dark are given for each candidate, because both themes must pass.
- Surfaces, borders, ink and semantic roles use the same role names as the current `DESIGN.md` frontmatter, so a pick is a value swap, not a new structure.

---

## Option A - Muted

Same GitHub-dark canvas and the same five status roles, but every colour is dusty instead of vivid, the white text is softened, and the primary button becomes a deeper steel blue.

### Dark - 36 pairs checked, 0 below standard

| Token | Value | Soft fill |
|---|---|---|
| bg-primary | `#0d1117` | - |
| bg-secondary | `#161b22` | - |
| bg-tertiary | `#1f2630` | - |
| border | `#30363d` | - |
| border-subtle | `#21262d` | - |
| text-primary | `#c9d1d9` | - |
| text-secondary | `#9198a1` | - |
| text-muted | `#848d97` | - |
| accent | `#6ca6d6` | 8% same hue |
| success | `#6fb083` | 10% same hue |
| warning | `#c9a457` | 10% same hue |
| purple | `#a99bd1` | 8% same hue |
| danger | `#e0838c` | 8% same hue |
| on-primary | `#ffffff` | - |
| primary-gradient-start | `#3a6a99` | - |
| primary-gradient-end | `#3f74a6` | - |
| brand-gradient-start | `#3a6a99` | - |
| brand-gradient-end | `#7568a8` | - |

| Pair | Ratio | Needs | |
|---|---|---|---|
| text-primary on bg-primary | 12.26 | 4.5:1 | pass |
| text-primary on bg-secondary | 11.21 | 4.5:1 | pass |
| text-primary on bg-tertiary | 9.87 | 4.5:1 | pass |
| text-secondary on bg-primary | 6.50 | 4.5:1 | pass |
| text-secondary on bg-secondary | 5.94 | 4.5:1 | pass |
| text-secondary on bg-tertiary | 5.23 | 4.5:1 | pass |
| text-muted on bg-primary | 5.62 | 4.5:1 | pass |
| text-muted on bg-secondary | 5.14 | 4.5:1 | pass |
| text-muted on bg-tertiary | 4.53 | 4.5:1 | pass |
| accent on bg-primary (command text) | 7.27 | 4.5:1 | pass |
| accent on bg-secondary (active tab) | 6.64 | 4.5:1 | pass |
| pill accent on accent-soft over bg-secondary | 5.88 | 4.5:1 | pass |
| success as text on bg-primary | 7.40 | 4.5:1 | pass |
| success as text on bg-secondary | 6.77 | 4.5:1 | pass |
| success diff-line text on 16% wash over bg-primary | 5.81 | 4.5:1 | pass |
| warning as text on bg-primary | 8.05 | 4.5:1 | pass |
| warning as text on bg-secondary | 7.36 | 4.5:1 | pass |
| purple as text on bg-primary | 7.48 | 4.5:1 | pass |
| purple as text on bg-secondary | 6.83 | 4.5:1 | pass |
| danger as text on bg-primary | 7.02 | 4.5:1 | pass |
| danger as text on bg-secondary | 6.42 | 4.5:1 | pass |
| danger diff-line text on 16% wash over bg-primary | 5.59 | 4.5:1 | pass |
| pill success on success-soft over bg-secondary | 5.76 | 4.5:1 | pass |
| success text on success-soft over bg-primary | 6.43 | 4.5:1 | pass |
| pill warning on warning-soft over bg-secondary | 6.22 | 4.5:1 | pass |
| warning text on warning-soft over bg-primary | 6.95 | 4.5:1 | pass |
| pill purple on purple-soft over bg-secondary | 6.03 | 4.5:1 | pass |
| purple text on purple-soft over bg-primary | 6.72 | 4.5:1 | pass |
| pill danger on danger-soft over bg-secondary | 5.75 | 4.5:1 | pass |
| danger text on danger-soft over bg-primary | 6.37 | 4.5:1 | pass |
| on-primary on primary-gradient-start | 5.67 | 4.5:1 | pass |
| on-primary on primary-gradient-end | 4.93 | 4.5:1 | pass |
| on-primary on brand-gradient-start | 5.67 | 4.5:1 | pass |
| on-primary on brand-gradient-end | 4.88 | 4.5:1 | pass |
| focus border accent against bg-secondary (non-text) | 6.64 | 3:1 | pass |
| focus border purple against bg-secondary (non-text) | 6.83 | 3:1 | pass |

### Light - 36 pairs checked, 0 below standard

| Token | Value | Soft fill |
|---|---|---|
| bg-primary | `#ffffff` | - |
| bg-secondary | `#f6f8fa` | - |
| bg-tertiary | `#eaeef2` | - |
| border | `#d0d7de` | - |
| border-subtle | `#e5e9f0` | - |
| text-primary | `#24292f` | - |
| text-secondary | `#59636e` | - |
| text-muted | `#636c76` | - |
| accent | `#31699f` | 10% same hue |
| success | `#26683d` | 10% same hue |
| warning | `#7d5a10` | 10% same hue |
| purple | `#6a55a8` | 10% same hue |
| danger | `#a33a43` | 10% same hue |
| on-primary | `#ffffff` | - |
| primary-gradient-start | `#31699f` | - |
| primary-gradient-end | `#2a5f93` | - |
| brand-gradient-start | `#31699f` | - |
| brand-gradient-end | `#6a55a8` | - |

| Pair | Ratio | Needs | |
|---|---|---|---|
| text-primary on bg-primary | 14.65 | 4.5:1 | pass |
| text-primary on bg-secondary | 13.76 | 4.5:1 | pass |
| text-primary on bg-tertiary | 12.57 | 4.5:1 | pass |
| text-secondary on bg-primary | 6.11 | 4.5:1 | pass |
| text-secondary on bg-secondary | 5.74 | 4.5:1 | pass |
| text-secondary on bg-tertiary | 5.24 | 4.5:1 | pass |
| text-muted on bg-primary | 5.33 | 4.5:1 | pass |
| text-muted on bg-secondary | 5.01 | 4.5:1 | pass |
| text-muted on bg-tertiary | 4.57 | 4.5:1 | pass |
| accent on bg-primary (command text) | 5.75 | 4.5:1 | pass |
| accent on bg-secondary (active tab) | 5.40 | 4.5:1 | pass |
| pill accent on accent-soft over bg-secondary | 4.73 | 4.5:1 | pass |
| success as text on bg-primary | 6.71 | 4.5:1 | pass |
| success as text on bg-secondary | 6.30 | 4.5:1 | pass |
| success diff-line text on 16% wash over bg-primary | 5.29 | 4.5:1 | pass |
| warning as text on bg-primary | 6.28 | 4.5:1 | pass |
| warning as text on bg-secondary | 5.90 | 4.5:1 | pass |
| purple as text on bg-primary | 6.04 | 4.5:1 | pass |
| purple as text on bg-secondary | 5.67 | 4.5:1 | pass |
| danger as text on bg-primary | 6.47 | 4.5:1 | pass |
| danger as text on bg-secondary | 6.08 | 4.5:1 | pass |
| danger diff-line text on 16% wash over bg-primary | 5.04 | 4.5:1 | pass |
| pill success on success-soft over bg-secondary | 5.47 | 4.5:1 | pass |
| success text on success-soft over bg-primary | 5.80 | 4.5:1 | pass |
| pill warning on warning-soft over bg-secondary | 5.13 | 4.5:1 | pass |
| warning text on warning-soft over bg-primary | 5.47 | 4.5:1 | pass |
| pill purple on purple-soft over bg-secondary | 4.96 | 4.5:1 | pass |
| purple text on purple-soft over bg-primary | 5.25 | 4.5:1 | pass |
| pill danger on danger-soft over bg-secondary | 5.24 | 4.5:1 | pass |
| danger text on danger-soft over bg-primary | 5.55 | 4.5:1 | pass |
| on-primary on primary-gradient-start | 5.75 | 4.5:1 | pass |
| on-primary on primary-gradient-end | 6.65 | 4.5:1 | pass |
| on-primary on brand-gradient-start | 5.75 | 4.5:1 | pass |
| on-primary on brand-gradient-end | 6.04 | 4.5:1 | pass |
| focus border accent against bg-secondary (non-text) | 5.40 | 3:1 | pass |
| focus border purple against bg-secondary (non-text) | 5.67 | 3:1 | pass |

---

## Option B - Quiet

Neutral first: grey does the everyday work, one dusty blue marks anything you can act on, and status words sit in grey chips with only a small coloured dot.

### Dark - 35 pairs checked, 0 below standard

| Token | Value | Soft fill |
|---|---|---|
| bg-primary | `#0d1117` | - |
| bg-secondary | `#161b22` | - |
| bg-tertiary | `#1f2630` | - |
| border | `#30363d` | - |
| border-subtle | `#21262d` | - |
| text-primary | `#c9d1d9` | - |
| text-secondary | `#9198a1` | - |
| text-muted | `#848d97` | - |
| accent | `#74a5d1` | 8% same hue |
| success | `#5a9a6e` | grey chip, coloured dot |
| warning | `#a88a3e` | grey chip, coloured dot |
| purple | `#8f82bd` | grey chip, coloured dot |
| danger | `#d07a83` | grey chip, coloured dot |
| on-primary | `#ffffff` | - |
| primary-gradient-start | `#3f74a6` | - |
| primary-gradient-end | `#3f74a6` | - |
| brand-gradient-start | `#3f74a6` | - |
| brand-gradient-end | `#7568a8` | - |

| Pair | Ratio | Needs | |
|---|---|---|---|
| text-primary on bg-primary | 12.26 | 4.5:1 | pass |
| text-primary on bg-secondary | 11.21 | 4.5:1 | pass |
| text-primary on bg-tertiary | 9.87 | 4.5:1 | pass |
| text-secondary on bg-primary | 6.50 | 4.5:1 | pass |
| text-secondary on bg-secondary | 5.94 | 4.5:1 | pass |
| text-secondary on bg-tertiary | 5.23 | 4.5:1 | pass |
| text-muted on bg-primary | 5.62 | 4.5:1 | pass |
| text-muted on bg-secondary | 5.14 | 4.5:1 | pass |
| text-muted on bg-tertiary | 4.53 | 4.5:1 | pass |
| accent on bg-primary (command text) | 7.25 | 4.5:1 | pass |
| accent on bg-secondary (active tab) | 6.63 | 4.5:1 | pass |
| pill accent on accent-soft over bg-secondary | 5.85 | 4.5:1 | pass |
| success as text on bg-primary | 5.66 | 4.5:1 | pass |
| success as text on bg-secondary | 5.17 | 4.5:1 | pass |
| success diff-line text on 16% wash over bg-primary | 4.63 | 4.5:1 | pass |
| warning as text on bg-primary | 5.74 | 4.5:1 | pass |
| warning as text on bg-secondary | 5.25 | 4.5:1 | pass |
| purple as text on bg-primary | 5.49 | 4.5:1 | pass |
| purple as text on bg-secondary | 5.02 | 4.5:1 | pass |
| danger as text on bg-primary | 6.12 | 4.5:1 | pass |
| danger as text on bg-secondary | 5.60 | 4.5:1 | pass |
| danger diff-line text on 16% wash over bg-primary | 4.97 | 4.5:1 | pass |
| status word (text-primary) on neutral chip bg-tertiary | 9.87 | 4.5:1 | pass |
| status word (text-primary) on neutral chip over bg-primary | 12.26 | 4.5:1 | pass |
| status dot accent against chip bg-tertiary (non-text) | 5.84 | 3:1 | pass |
| status dot success against chip bg-tertiary (non-text) | 4.56 | 3:1 | pass |
| status dot warning against chip bg-tertiary (non-text) | 4.62 | 3:1 | pass |
| status dot purple against chip bg-tertiary (non-text) | 4.42 | 3:1 | pass |
| status dot danger against chip bg-tertiary (non-text) | 4.93 | 3:1 | pass |
| on-primary on primary-gradient-start | 4.93 | 4.5:1 | pass |
| on-primary on primary-gradient-end | 4.93 | 4.5:1 | pass |
| on-primary on brand-gradient-start | 4.93 | 4.5:1 | pass |
| on-primary on brand-gradient-end | 4.88 | 4.5:1 | pass |
| focus border accent against bg-secondary (non-text) | 6.63 | 3:1 | pass |
| focus border purple against bg-secondary (non-text) | 5.02 | 3:1 | pass |

### Light - 35 pairs checked, 0 below standard

| Token | Value | Soft fill |
|---|---|---|
| bg-primary | `#ffffff` | - |
| bg-secondary | `#f6f8fa` | - |
| bg-tertiary | `#eaeef2` | - |
| border | `#d0d7de` | - |
| border-subtle | `#e5e9f0` | - |
| text-primary | `#24292f` | - |
| text-secondary | `#59636e` | - |
| text-muted | `#636c76` | - |
| accent | `#31699f` | 10% same hue |
| success | `#2a6a40` | grey chip, coloured dot |
| warning | `#7d5e1c` | grey chip, coloured dot |
| purple | `#6a5c9e` | grey chip, coloured dot |
| danger | `#a84850` | grey chip, coloured dot |
| on-primary | `#ffffff` | - |
| primary-gradient-start | `#31699f` | - |
| primary-gradient-end | `#2a5f93` | - |
| brand-gradient-start | `#31699f` | - |
| brand-gradient-end | `#6a5c9e` | - |

| Pair | Ratio | Needs | |
|---|---|---|---|
| text-primary on bg-primary | 14.65 | 4.5:1 | pass |
| text-primary on bg-secondary | 13.76 | 4.5:1 | pass |
| text-primary on bg-tertiary | 12.57 | 4.5:1 | pass |
| text-secondary on bg-primary | 6.11 | 4.5:1 | pass |
| text-secondary on bg-secondary | 5.74 | 4.5:1 | pass |
| text-secondary on bg-tertiary | 5.24 | 4.5:1 | pass |
| text-muted on bg-primary | 5.33 | 4.5:1 | pass |
| text-muted on bg-secondary | 5.01 | 4.5:1 | pass |
| text-muted on bg-tertiary | 4.57 | 4.5:1 | pass |
| accent on bg-primary (command text) | 5.75 | 4.5:1 | pass |
| accent on bg-secondary (active tab) | 5.40 | 4.5:1 | pass |
| pill accent on accent-soft over bg-secondary | 4.73 | 4.5:1 | pass |
| success as text on bg-primary | 6.49 | 4.5:1 | pass |
| success as text on bg-secondary | 6.10 | 4.5:1 | pass |
| success diff-line text on 16% wash over bg-primary | 5.13 | 4.5:1 | pass |
| warning as text on bg-primary | 6.02 | 4.5:1 | pass |
| warning as text on bg-secondary | 5.65 | 4.5:1 | pass |
| purple as text on bg-primary | 5.77 | 4.5:1 | pass |
| purple as text on bg-secondary | 5.42 | 4.5:1 | pass |
| danger as text on bg-primary | 5.66 | 4.5:1 | pass |
| danger as text on bg-secondary | 5.32 | 4.5:1 | pass |
| danger diff-line text on 16% wash over bg-primary | 4.51 | 4.5:1 | pass |
| status word (text-primary) on neutral chip bg-tertiary | 12.57 | 4.5:1 | pass |
| status word (text-primary) on neutral chip over bg-primary | 14.65 | 4.5:1 | pass |
| status dot accent against chip bg-tertiary (non-text) | 4.93 | 3:1 | pass |
| status dot success against chip bg-tertiary (non-text) | 5.57 | 3:1 | pass |
| status dot warning against chip bg-tertiary (non-text) | 5.16 | 3:1 | pass |
| status dot purple against chip bg-tertiary (non-text) | 4.95 | 3:1 | pass |
| status dot danger against chip bg-tertiary (non-text) | 4.86 | 3:1 | pass |
| on-primary on primary-gradient-start | 5.75 | 4.5:1 | pass |
| on-primary on primary-gradient-end | 6.65 | 4.5:1 | pass |
| on-primary on brand-gradient-start | 5.75 | 4.5:1 | pass |
| on-primary on brand-gradient-end | 5.77 | 4.5:1 | pass |
| focus border accent against bg-secondary (non-text) | 5.40 | 3:1 | pass |
| focus border purple against bg-secondary (non-text) | 5.42 | 3:1 | pass |

---

## Option C - Warm charcoal

A warmer charcoal canvas instead of navy-black, warm off-white text, and soft sage, gold, lilac and coral accents.

### Dark - 36 pairs checked, 0 below standard

| Token | Value | Soft fill |
|---|---|---|
| bg-primary | `#1b1b1e` | - |
| bg-secondary | `#242428` | - |
| bg-tertiary | `#2e2e33` | - |
| border | `#3d3d44` | - |
| border-subtle | `#2c2c31` | - |
| text-primary | `#d6d3cd` | - |
| text-secondary | `#a3a09a` | - |
| text-muted | `#9e9b95` | - |
| accent | `#74a9c9` | 8% same hue |
| success | `#86b98a` | 8% same hue |
| warning | `#cfae62` | 8% same hue |
| purple | `#b3a4d6` | 8% same hue |
| danger | `#d98890` | 8% same hue |
| on-primary | `#ffffff` | - |
| primary-gradient-start | `#35687f` | - |
| primary-gradient-end | `#3a728b` | - |
| brand-gradient-start | `#35687f` | - |
| brand-gradient-end | `#7d6aa0` | - |

| Pair | Ratio | Needs | |
|---|---|---|---|
| text-primary on bg-primary | 11.50 | 4.5:1 | pass |
| text-primary on bg-secondary | 10.35 | 4.5:1 | pass |
| text-primary on bg-tertiary | 9.04 | 4.5:1 | pass |
| text-secondary on bg-primary | 6.59 | 4.5:1 | pass |
| text-secondary on bg-secondary | 5.93 | 4.5:1 | pass |
| text-secondary on bg-tertiary | 5.18 | 4.5:1 | pass |
| text-muted on bg-primary | 6.20 | 4.5:1 | pass |
| text-muted on bg-secondary | 5.58 | 4.5:1 | pass |
| text-muted on bg-tertiary | 4.87 | 4.5:1 | pass |
| accent on bg-primary (command text) | 6.76 | 4.5:1 | pass |
| accent on bg-secondary (active tab) | 6.08 | 4.5:1 | pass |
| pill accent on accent-soft over bg-secondary | 5.31 | 4.5:1 | pass |
| success as text on bg-primary | 7.63 | 4.5:1 | pass |
| success as text on bg-secondary | 6.86 | 4.5:1 | pass |
| success diff-line text on 16% wash over bg-primary | 5.69 | 4.5:1 | pass |
| warning as text on bg-primary | 8.09 | 4.5:1 | pass |
| warning as text on bg-secondary | 7.28 | 4.5:1 | pass |
| purple as text on bg-primary | 7.53 | 4.5:1 | pass |
| purple as text on bg-secondary | 6.77 | 4.5:1 | pass |
| danger as text on bg-primary | 6.44 | 4.5:1 | pass |
| danger as text on bg-secondary | 5.80 | 4.5:1 | pass |
| danger diff-line text on 16% wash over bg-primary | 4.99 | 4.5:1 | pass |
| pill success on success-soft over bg-secondary | 5.93 | 4.5:1 | pass |
| success text on success-soft over bg-primary | 6.62 | 4.5:1 | pass |
| pill warning on warning-soft over bg-secondary | 6.26 | 4.5:1 | pass |
| warning text on warning-soft over bg-primary | 7.02 | 4.5:1 | pass |
| pill purple on purple-soft over bg-secondary | 5.88 | 4.5:1 | pass |
| purple text on purple-soft over bg-primary | 6.56 | 4.5:1 | pass |
| pill danger on danger-soft over bg-secondary | 5.12 | 4.5:1 | pass |
| danger text on danger-soft over bg-primary | 5.71 | 4.5:1 | pass |
| on-primary on primary-gradient-start | 6.11 | 4.5:1 | pass |
| on-primary on primary-gradient-end | 5.30 | 4.5:1 | pass |
| on-primary on brand-gradient-start | 6.11 | 4.5:1 | pass |
| on-primary on brand-gradient-end | 4.73 | 4.5:1 | pass |
| focus border accent against bg-secondary (non-text) | 6.08 | 3:1 | pass |
| focus border purple against bg-secondary (non-text) | 6.77 | 3:1 | pass |

### Light - 36 pairs checked, 0 below standard

| Token | Value | Soft fill |
|---|---|---|
| bg-primary | `#fbf9f6` | - |
| bg-secondary | `#f4f1ed` | - |
| bg-tertiary | `#e9e5df` | - |
| border | `#d9d3ca` | - |
| border-subtle | `#e6e1da` | - |
| text-primary | `#2b2926` | - |
| text-secondary | `#5c5852` | - |
| text-muted | `#67625b` | - |
| accent | `#28627c` | 10% same hue |
| success | `#2a663c` | 8% same hue |
| warning | `#7d5f22` | 8% same hue |
| purple | `#6b5a9c` | 8% same hue |
| danger | `#a4444d` | 8% same hue |
| on-primary | `#ffffff` | - |
| primary-gradient-start | `#28627c` | - |
| primary-gradient-end | `#225468` | - |
| brand-gradient-start | `#28627c` | - |
| brand-gradient-end | `#6b5a9c` | - |

| Pair | Ratio | Needs | |
|---|---|---|---|
| text-primary on bg-primary | 13.80 | 4.5:1 | pass |
| text-primary on bg-secondary | 12.88 | 4.5:1 | pass |
| text-primary on bg-tertiary | 11.56 | 4.5:1 | pass |
| text-secondary on bg-primary | 6.72 | 4.5:1 | pass |
| text-secondary on bg-secondary | 6.27 | 4.5:1 | pass |
| text-secondary on bg-tertiary | 5.63 | 4.5:1 | pass |
| text-muted on bg-primary | 5.75 | 4.5:1 | pass |
| text-muted on bg-secondary | 5.37 | 4.5:1 | pass |
| text-muted on bg-tertiary | 4.82 | 4.5:1 | pass |
| accent on bg-primary (command text) | 6.39 | 4.5:1 | pass |
| accent on bg-secondary (active tab) | 5.96 | 4.5:1 | pass |
| pill accent on accent-soft over bg-secondary | 5.20 | 4.5:1 | pass |
| success as text on bg-primary | 6.52 | 4.5:1 | pass |
| success as text on bg-secondary | 6.09 | 4.5:1 | pass |
| success diff-line text on 16% wash over bg-primary | 5.14 | 4.5:1 | pass |
| warning as text on bg-primary | 5.66 | 4.5:1 | pass |
| warning as text on bg-secondary | 5.28 | 4.5:1 | pass |
| purple as text on bg-primary | 5.60 | 4.5:1 | pass |
| purple as text on bg-secondary | 5.23 | 4.5:1 | pass |
| danger as text on bg-primary | 5.69 | 4.5:1 | pass |
| danger as text on bg-secondary | 5.31 | 4.5:1 | pass |
| danger diff-line text on 16% wash over bg-primary | 4.52 | 4.5:1 | pass |
| pill success on success-soft over bg-secondary | 5.44 | 4.5:1 | pass |
| success text on success-soft over bg-primary | 5.80 | 4.5:1 | pass |
| pill warning on warning-soft over bg-secondary | 4.74 | 4.5:1 | pass |
| warning text on warning-soft over bg-primary | 5.09 | 4.5:1 | pass |
| pill purple on purple-soft over bg-secondary | 4.72 | 4.5:1 | pass |
| purple text on purple-soft over bg-primary | 5.02 | 4.5:1 | pass |
| pill danger on danger-soft over bg-secondary | 4.75 | 4.5:1 | pass |
| danger text on danger-soft over bg-primary | 5.09 | 4.5:1 | pass |
| on-primary on primary-gradient-start | 6.71 | 4.5:1 | pass |
| on-primary on primary-gradient-end | 8.28 | 4.5:1 | pass |
| on-primary on brand-gradient-start | 6.71 | 4.5:1 | pass |
| on-primary on brand-gradient-end | 5.89 | 4.5:1 | pass |
| focus border accent against bg-secondary (non-text) | 5.96 | 3:1 | pass |
| focus border purple against bg-secondary (non-text) | 5.23 | 3:1 | pass |

