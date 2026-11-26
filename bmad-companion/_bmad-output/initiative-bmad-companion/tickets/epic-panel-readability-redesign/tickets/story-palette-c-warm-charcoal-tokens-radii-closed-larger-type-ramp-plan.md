---
title: 'Story 8.1 — Palette C warm charcoal tokens, radii & closed larger type ramp'
type: feature
ticket: '1'
created: '2026-11-26'
status: done
baseline_revision: 35b8f800b02aef93a1800e33df38b66013f0dcc8
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `assets/panel.html` still ships the bright GitHub palette, a 3px command-editor focus radius, and 16 ad-hoc font sizes down to 10px. The owner found the panel cluttered, too bright, and hard to read; the chosen remedy — DESIGN.md's Palette C warm-charcoal tokens, the `4px`/`50%` radii rules, and the closed larger type ramp (RD-1/RD-2/RD-5/RD-6) — exists only on paper. This tracer story lays the styled token foundation for the rest of the readability epic.

**Approach:** Swap the `:root` and `body.theme-light` custom-property blocks to the DESIGN.md `colors:` frontmatter verbatim, add the missing `--on-primary` variable, normalize radii, and re-express every font size through the closed role ramp (14px body, nothing below 12px, 16/15/14.5/13.5px overlay roles defined and reserved) with zero inline `font-size` anywhere. Update `tests/panel-a11y.test.mjs` for the new tokens and add closed-ramp guards. Epic 7's frozen engine payload is consumed later by Stories 4–5 and is not touched here.

## Boundaries & Constraints

**Always:**
- Copy DESIGN.md frontmatter `colors:` values verbatim (both themes); soft fills as 8-digit hex per the spine.
- Route every color through a `--token`; replace the 3 literal whites (`.brand-badge`, `.btn-primary`, `.art-chip-open:hover`) with `var(--on-primary)`.
- Keep WCAG AA: ≥4.5:1 essential text, ≥3:1 focus, both themes (DESIGN measured table validates the Palette C values).
- Apply all sizes through classes from the closed set {16, 15, 14.5, 14, 13.5, 13, 12.5, 12}px; keep role weights/tracking per DESIGN Typography.
- Preserve the 5s polling guard, `isUserInteractingWithForm`/`userEditedPrompts` contracts, element IDs, ARIA semantics, the `window.parent.postMessage` bridge, and `applyHostTheme` (dark default; light only via `body.theme-light`).

**Never:**
- No tab restructure, 3-tab shell, overlay controller, or focus hero — Stories 2–5 own those; the panel stays 5-tab.
- No changes to `scripts/*`, `hooks/`, or the Epic 7 `turnAnalysis.currentFocus`/plain-copy payload.
- No version bump — 0.6.0 tri-sync lands in Story 8.
- No consuming `--bg-elevated` (reserved), no new hex/rgba literals outside the two token blocks, no inline `style="font-size"` or JS-assigned `fontSize`.
- No changes to where `var(--accent)` is applied. **RD-5 decision (owner, 2026-11-26): inventory + defer** — this story only records the current per-tab accent inventory (for Stories 2/4, which own the real focal assignment); no accent-application changes.
- No restyling beyond the token swap + size remap.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dark default | Panel loads with no host theme | `:root` Palette C warm charcoal everywhere | No error expected |
| Light theme | Host sends `theme: "light"` | Light Palette C tokens; `--on-primary` white still ≥4.5:1 on both gradients | No error expected |
| Soft fills | `-soft` tokens composited over card surfaces | CD-2 ratios match DESIGN measured table (≥4.5:1) | Tests parse 8-digit hex |
| Derived mixes | `color-mix()` diff washes, live banner, pulse glow | Derive from new hues automatically — no literals to touch | No error expected |

</frozen-after-approval>

## Code Map

- `assets/panel.html` (3,377 lines) — the only product file.
  - `:root` L8–35 and `body.theme-light` L37–61: swap all 22 color tokens per theme to DESIGN.md values; add `--on-primary: #ffffff` (no light override — white passes both gradient sets); soft-fill alphas change to the spine values (dark all 8%, light accent 10% / rest 8%).
  - Literal whites L112 (`.brand-badge`), L177 (`.btn-primary`), L643 (`.art-chip-open:hover`) → `var(--on-primary)`.
  - `.cmd-textarea:focus` L464: `3px` → `4px` (RD-2 `rounded.sm`); `.pulse-dot` L860 already the sole `50%` — leave.
  - Font sizes: 30 CSS declarations (L75–L945) re-pointed to their ramp role values per DESIGN Typography (body 12.5→14px & line-height 1.5; `.brand-title` 13→14; `.pill` 10.5→12; `.cmd-textarea` 11.5→command 13.5; `.model-select` 11→mono-meta 12.5; `.rec-title` 12.5→story-title 13; the rest by role).
  - 48 inline `style="font-size:…"` sites (L1028–L3070) → remove the inline style and apply the role via existing or new semantic classes, per DESIGN's RD-1 mapping table.
  - Define the 4 overlay roles (16/15/14.5/13.5px) as reserved custom properties or utility classes — closed ramp complete; consumed by Story 3+.
  - Do not touch: `applyHostTheme` L1337–1343, `switchTab` L3090, polling/draft guards, tab structure (5 tabs stay), `color-mix()` derivations.
- `tests/panel-a11y.test.mjs` — update for Palette C:
  - AD-1 L284–316 (hard-coded dark/light accent + 6 surface hexes) and CD-1 L590–613 (hard-coded surfaces) → read values via the existing `extractCssVar` helper.
  - `parseRgba` L582 (strict `rgba(...)`) → also accept `#RRGGBBAA` (soft fills become 8-digit hex). CD-2/3/4/5 recompute from tokens automatically.
  - Add: closed-ramp assertion (every CSS `font-size` in the file ∈ {16, 15, 14.5, 14, 13.5, 13, 12.5, 12}px, none below 12px) and zero-inline-font-size assertion (no `style="…font-size…"` and no `.style.fontSize` in the HTML source).
- `tests/helpers.mjs` — `relativeLuminance` / `contrastRatio` / `compositeColor` (L36–59) reused as-is.
- `tests/panel-guards.test.mjs`, `tests/e2e-journeys.test.mjs` — zero color/font assertions; expected green unchanged.
- `scripts/bmad-engine.mjs` et al. — Epic 7 frozen payload; do not touch.

## Tasks & Acceptance

**Execution:**
- [ ] `assets/panel.html` — swap both token blocks to DESIGN.md Palette C verbatim, add `--on-primary`, replace the 3 literal whites, fix the 3px→4px focus radius (RD-2).
- [ ] `assets/panel.html` — re-point the 30 CSS font-size declarations to their closed-ramp role values; define the 4 reserved overlay sizes (RD-1/RD-6).
- [ ] `assets/panel.html` — remove all 48 inline font-size styles and apply roles via classes, including collapsing the three label styles to `label-caps` (RD-1 mapping table).
- [ ] `assets/panel.html` — record the per-tab accent inventory in Implementation Notes (RD-5 decision: inventory + defer; no accent-application changes).
- [ ] `tests/panel-a11y.test.mjs` — token extraction for AD-1/CD-1, hex-alpha parsing, new closed-ramp + zero-inline-size assertions.

**Acceptance Criteria:**
- Given the updated panel, when `node --test tests/panel-a11y.test.mjs` runs, then all suites pass: every dark/light pair checked reaches ≥4.5:1 text and ≥3:1 focus, and the new ramp/inline assertions hold.
- Given the HTML source, when scanned, then zero inline `font-size` styles remain and every CSS `font-size` belongs to the closed set with none below 12px.
- Given the full gate, when `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` runs, then all suites pass with version still tri-synced at 0.5.4.

## Implementation Notes

### RD-5 accent inventory (decision: inventory + defer — no accent-application changes in this story)

Current per-tab `var(--accent)` applications, recorded for Stories 2/4 which own the real focal assignment. "Chrome" applications span every tab.

- **Chrome (all tabs):** global `:focus-visible` 2px accent outline; `.btn:hover` accent border + accent-soft fill; `.tab-btn.active` accent text on accent-soft wash; `.bar-smart` gradient starts at accent (top-bar progress strip, phase rows, banner mini-bar); `.live-queue-banner` accent bottom border over the accent/purple 14% mix; `.queue-cb` accent-color checkboxes.
- **Advisor (Next Prompts):** `.cmd-textarea` accent command text + focus ring, `.cmd-editor-wrap:focus-within` accent border, `.rec-card:hover` accent border, `pill-accent` on medium-priority badge and "✓ In Queue" qBadge.
- **Queue:** `#queueStatusBadge` pill-accent when idle/queued, queue item "⏳ IN QUEUE #n" pill-accent, spotlight "review: …" pill-accent, banner "⏳ QUEUED"/counts pill-accent + btn-primary banner buttons.
- **Progress (Phases & Epics):** "⚙ In Progress" metrics pill-accent, epic "% Smart" pill-accent, story-id mono span colored accent, `.diff-hunk` accent, `.art-chip-*` hover/open accent, Reconcile btn-primary, `.search-input:focus` accent border/ring.
- **Catalog (Skills & Agents):** "/skill" pill-accent chip per card, `.cmd-textarea` accent command text, `.rec-card:hover` accent border, "✓ In Queue" pill-accent, `.search-input:focus` accent.
- **Artifacts:** strongest accent presence — `#artifactPreviewCard` accent border + `#previewFileName` accent mono title, `.art-row-path` accent text, `.art-chip-group`/`.art-chip-main`/`.art-chip-open` hover accent fill, `#artifactCountBadge` pill-accent, Review btn-primary, `.insight-item.is-inspecting` accent border+fill.

Observation for Stories 2/4: Progress and Artifacts each show four-plus simultaneous accent applications; no tab currently has a single unambiguous focal accent.

### Size-role map — decisions for sites the code map left to "the rest by role"

Mapped by what the element is (DESIGN Typography): `.brand-badge` → 12.5px component exception; `.brand-subtitle`, `.progress-strip-top`, `.turn-box`, `.insight-detail`, `.phase note`, agent focus, artifacts help, empty-queue body → `caption` (12.5px); `.tab-btn` → tabs 12px per `{components.tab-button}`; `.progress-numbers`, `.reconciliation-diff-content`, `.artifact-preview`, `.queue-prompt-inset` → `mono-meta` (12.5px); `.story-evidence` → `caption` per `{components.story-evidence}` (the `micro` comment listing it conflicts; the component reference wins); `.insight-title` → `story-title` (13px/600); `.art-chip-group` → `pill` (12px) per `{components.art-chip}`; `.rec-title` → `story-title` per the code map. New role utilities for dynamic markup: `.text-caption`, `.text-micro`, `.text-mono-meta`, `.label-caps` (the collapsed form-label style; `.cmd-label` kept as-is — AD-4 tests pin its class name). Weight changes limited to role adoption: `.rec-title` and `.insight-title` 700→600 (story-title role), queue item title span 700→600.

## Plan Change Log

## Review Triage Log

- Quick lens, pass 1 (2026-11-26): 2 findings — 2 patch, 0 false, 0 maybe-false, 0 deferred.
- Finding "empty-queue heading loses centering" (assets/panel.html renderQueue ~L2005): verdict `low` → patch. Verified real: `.section-title` is `display:flex`, so inside `.empty-state-card` (`text-align:center`) the heading's anonymous flex item aligns flex-start — the heading renders left-aligned where the old inline div inherited centering. Cosmetic, one-line inline fix (`justify-content:center`), caused by this change.
- Finding "on-primary routing assertions cannot pin their selector" (tests/panel-a11y.test.mjs ~L1013–1029): verdict `low` → patch. Verified real: `[\s\S]*?` crosses `}` boundaries, so each assertion can be satisfied by a later rule's `color: var(--on-primary)` (e.g. `.brand-badge`'s check by `.btn-primary`'s declaration) and would not fail if any one of the three selectors dropped the route. Developer-facing guard weakness; smallest fix is tightening the regex to stay inside the rule block (`[^}]*?`). Caused by this change (new test).

## Design Notes

- Size-role map is "what the element is", not rounding — DESIGN.md → Typography → Closed ramp table is authoritative for the 48 inline sites.
- Mechanism: extend existing semantic selectors where they exist; add a minimal set of role classes only where none exists. Keep mono for machine tokens (commands, model ids, paths, counts), sans for prose.
- Overlay sizes land as definitions only — no overlay component yet; treat like the already-reserved `--bg-elevated`.

## Verification

**Commands:**
- `node --test tests/panel-a11y.test.mjs` -- expected: all suites green including the new closed-ramp and zero-inline-size assertions.
- `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` -- expected: full suite green, 0.5.4 tri-sync intact.
