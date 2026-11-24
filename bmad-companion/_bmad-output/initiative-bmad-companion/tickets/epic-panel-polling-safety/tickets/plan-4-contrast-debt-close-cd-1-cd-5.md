---
title: 'Contrast debt: close CD-1-CD-5 to WCAG AA'
type: feature
ticket: 4
container: epic-panel-polling-safety
created: '2026-11-24'
status: done
baseline_revision: '3c50d56f79836df6604b0515bc0a6998d16241f8'
route: oneshot
route_source: pinned
risk: medium
review: none
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `DESIGN.md` tracked contrast debt deviations `CD-1` through `CD-5` where token pairs failed WCAG 2.1 AA normal text contrast (>= 4.5:1) or non-text focus indicator contrast (>= 3:1):
- **CD-1 (`text-muted`):** Fell below 4.5:1 on dark surfaces (4.12:1 on `bg-primary`, 3.77:1 on `bg-secondary`) and light `bg-secondary` (4.27:1).
- **CD-2 (Pill text on soft fills):** Failed 4.5:1 for accent (4.28 dark / 4.26 light), purple (4.22 dark / 4.15 light), danger (4.39 dark / 4.31 light), and light success (4.19) and warning (3.94) due to insufficient alpha and text luminance separation over composite card backgrounds.
- **CD-3 (Dark primary button gradient):** White label on `.btn-primary` sat on a gradient whose accent start `#388bfd` was 3.34:1 in dark theme (the `#2563eb` end passed at 5.17:1).
- **CD-4 (Dark brand badge gradient):** White "BM" glyph sat on a gradient whose purple end `#a371f7` was 3.35:1 and accent start was 3.34:1 in dark theme.
- **CD-5 (Borders):** Decorative separator borders (~1.4–1.6:1) confirmed non-essential with fill-based control distinction and interactive focus indicators verified >= 3:1 in both themes.

**Approach:**
1. **CD-1 (`text-muted`):**
   - Dark `--text-muted`: updated from `#6e7681` to `#848d97` (Primer dark muted ink). Re-measured contrast: 5.62:1 on `#0d1117`, 5.14:1 on `#161b22`, 4.53:1 on `#1f2630` (all >= 4.5:1).
   - Light `--text-muted`: updated from `#6e7781` to `#636c76` (Primer light muted ink). Re-measured contrast: 5.33:1 on `#ffffff`, 5.01:1 on `#f6f8fa`, 4.57:1 on `#eaeef2` (all >= 4.5:1).
2. **CD-2 (Pill text on soft fills):**
   - Dark theme soft fills: adjusted alphas to 0.08–0.10 (`--accent-soft: rgba(56,139,253,0.08)`, `--success-soft: rgba(63,185,80,0.10)`, `--warning-soft: rgba(210,153,34,0.10)`, `--purple-soft: rgba(163,113,247,0.08)`, `--danger-soft: rgba(248,81,73,0.08)`). Re-measured: accent 4.67:1, success 5.83:1, warning 5.86:1, purple 4.67:1, danger 4.77:1 (all >= 4.5:1).
   - Light theme semantic tokens: tuned to Primer accessible tones (`--accent: #0757b6`, `--success: #13712d`, `--warning: #7d4e00`, `--purple: #7445c7`, `--danger: #bd1d28`) with 0.10 soft fills. Re-measured: accent 5.56:1, success 5.01:1, warning 5.75:1, purple 5.00:1, danger 4.96:1 (all >= 4.5:1).
3. **CD-3 (Primary button gradient):**
   - Tokenized `--primary-gradient-start` (`#1f6feb` dark, `#0757b6` light) and `--primary-gradient-end` (`#2563eb` both).
   - Re-measured white label contrast: dark start 4.63:1, end 5.17:1; light start 6.89:1, end 5.17:1 (all >= 4.5:1).
4. **CD-4 (Brand badge gradient):**
   - Tokenized `--brand-gradient-start` (`#1f6feb` dark, `#0757b6` light) and `--brand-gradient-end` (`#8957e5` dark, `#7445c7` light).
   - Re-measured white text contrast: dark start 4.63:1, end 4.61:1; light start 6.89:1, end 6.14:1 (all >= 4.5:1).
5. **CD-5 (Focus indicators & decorative borders):**
   - Verified focus borders: search-input focus border reaches 5.17:1 dark / 6.47:1 light (>= 3:1); model-select focus border reaches 5.16:1 dark / 5.77:1 light (>= 3:1); `.cmd-textarea` focus outline reaches 5.66:1 dark / 6.89:1 light (>= 3:1).
   - Separator borders verified non-essential for control boundary identification.

</intent-contract>

## Implementation Notes

- **`assets/panel.html`:**
  - `:root`: updated `--text-muted: #848d97`, adjusted `*-soft` alphas to 0.08–0.10, added `--primary-gradient-start: #1f6feb`, `--primary-gradient-end: #2563eb`, `--brand-gradient-start: #1f6feb`, and `--brand-gradient-end: #8957e5`.
  - `body.theme-light`: updated `--text-muted: #636c76`, `--accent: #0757b6`, `--success: #13712d`, `--warning: #7d4e00`, `--purple: #7445c7`, `--danger: #bd1d28` with 0.10 soft fills, added `--primary-gradient-start: #0757b6`, `--primary-gradient-end: #2563eb`, `--brand-gradient-start: #0757b6`, and `--brand-gradient-end: #7445c7`.
  - `.brand-badge`: updated gradient to `linear-gradient(135deg, var(--brand-gradient-start), var(--brand-gradient-end))`.
  - `.btn-primary`: updated gradient to `linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end))` and border to `var(--primary-gradient-start)`.
- **`_bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md`:**
  - Synchronized frontmatter tokens for dark and light palettes and component mappings.
  - Re-measured and updated the relative-luminance contrast audit table with 2026-11-24 audit results.
  - Documented contrast debt closure (CD-1 through CD-5) to full WCAG AA.
- **`tests/helpers.mjs`:**
  - Added reusable `compositeColor(fgHex, alpha, bgHex)` for deterministic alpha compositing over background surfaces.
- **`tests/panel-a11y.test.mjs`:**
  - Added comprehensive `Story 4.4: Contrast debt — close CD-1 through CD-5 to WCAG AA` suite with 7 dedicated tests covering CD-1 muted ink, CD-2 all 5 semantic pills, CD-3 primary button gradient start/end, CD-4 brand badge gradient start/end, and CD-5 focus indicators.

## Verification

- `node --test tests/panel-a11y.test.mjs`: all 25 tests passing (0 failures).
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs`: all 136 tests passing and version sync verified (0.5.3).
- `node ../scripts/validate.mjs`: all plugin validations passed cleanly across bmad-companion, vibe-debrief, and project-colors.
