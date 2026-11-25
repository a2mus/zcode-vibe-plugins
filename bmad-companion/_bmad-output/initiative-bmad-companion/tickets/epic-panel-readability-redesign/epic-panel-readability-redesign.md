---
type: epic
title: 3-tab Work/Queue/Project readability redesign, Palette C & unified overlay
parent: initiative-bmad-companion
covers: [R27, R28, R29, R30]
sources:
  - _bmad-output/initiative-bmad-companion/initiative-bmad-companion.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
  - _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
companions:
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
  - _bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md
after: [epic-panel-polling-safety, epic-focus-hero-engine]
refined: true
risk: high
---

# 3-tab Work/Queue/Project readability redesign, Palette C & unified overlay

## Description

Builds on Epic 4's 5s polling-guard/accessibility baseline and Epic 7's frozen `turnAnalysis.currentFocus` + plain-copy `ScanResult` contract to redesign `assets/panel.html` per `DESIGN.md` (`Palette C`, `RD-1`, `RD-2`, `RD-5`, `RD-6`), `EXPERIENCE.md` (`3-tab Work/Queue/Project`, `RD-3`, `RD-4`, `RD-7`, `RD-8`, `RD-9`), and Architecture Spine `AD-9`, `AD-10`, `AD-16`, `AD-17` (`OQ-6` closed). Delivers the warm charcoal palette, larger closed type ramp, 3-tab cockpit, one unified in-iframe modal overlay controller powering both the Work Action Window and Focus View, counted disclosures, and full automated + live host-theme verification.

## Outcome

Users open a calm, readable 3-tab cockpit (`Work`, `Queue`, `Project`) where **Work** greets them with a plain-language 3-conversation focus hero and high-level actions, clicking any action or card opens a larger in-panel window without dropping edits or focus during 5-second background polls, and WCAG AA contrast + ARIA semantics stay regression-tested.

## Requirements

1. **R1 (parent R27)**: `assets/panel.html` adopts Palette C warm charcoal dark/light CSS custom properties (`on-primary` variable, `4px`/`50%` radii cleanup, canvas one step softer than the ZCode conversation surface, essential text ≥4.5:1 and focus ≥3:1 in both themes), the closed larger type ramp (`14px` body, ≥`12px` panel floor, `16/15/14.5/13.5px` overlay roles, zero inline `font-size`, mapping all 9 off-ramp sizes), and one focal accent per tab (`DESIGN.md` `RD-1`, `RD-2`, `RD-5`, `RD-6`, `CD-1`–`CD-5`).
2. **R2 (parent R28)**: `assets/panel.html` consolidates the 5 tabs into 3 peer tabs (`work`, `queue`, `project`) with ARIA `tablist`/`tab`/`tabpanel` + arrow-key navigation (`EXPERIENCE AD-2`), plain task-oriented headings (`RD-3`), "Use it when…" tab purpose tooltips/accessible descriptions/subtitles (`RD-4`), removal of the Skills and Specialist Agents UI lists (`OQ-9`), placement of Recently Changed Files + diff/content inspector inside `project`, and a flat phase progress list with inline file chips in `project` (`RD-9`, `AD-17` §1).
3. **R3 (parent R29)**: `assets/panel.html` implements one unified in-iframe modal overlay controller (`activeOverlay` serving both Work Action Window and Focus View, `role="dialog"`, `aria-modal="true"`, focus trap, `triggerEl`/`triggerSelector` focus restore, `overlay-*` non-duplicating DOM IDs, interactive-descendant click guard, single capture-phase `Escape` precedence, `isOverlayOpen()` polling guard + `pendingWorkspaceState` clear on explicit overlay action + `reconcileActiveOverlay`), the Work current-focus hero (`turnAnalysis.currentFocus`, never falling back to `aiSummaryHeadline`), plain high-level next-action cards with semantic `rec:<skill>:<title>` draft preservation (`userEditedPrompts`/`userSelectedModels`, `selectedRecKeys`, unified `getRecommendationBaseModelId`), counted disclosures (`AI notes (N)`, `Models and providers (N)`, `More actions (3)` in `expandedDisclosures`), and Focus View across Queue & Project cards/rows/sections (`AD-9`, `AD-10`, `AD-17`, `OQ-6` closed, `RD-7`, `RD-8`, `RD-9`).
4. **R4 (parent R30)**: Extend `window.__bmadTestHooks`, `tests/panel-guards.test.mjs`, `tests/panel-a11y.test.mjs`, and `tests/e2e-journeys.test.mjs` (`AD-16`) to verify overlay polling-guard stash/flush, capture-phase `Escape` precedence, explicit-action `reconcileActiveOverlay`, semantic draft preservation, 3-tab ARIA/dialog/disclosure semantics, Palette C WCAG AA contrast, and Flows 1–4, 6, 7 end-to-end, paired with a live ZCode Desktop host-theme visual check (`hitl`).

## Constraints

- **C1, C2, C7, C9, C13** (parent `C1`, `C2`, `C7`, `C9`, `C13`): zero external dependencies or CDN (`AD-1`); self-contained inline HTML/CSS/JS under `csp.unsafeEval: false` with `escapeHtml()` on all dynamic text and `window.parent.postMessage` JSON-RPC only (`AD-9`, no `window.zcode` and no host `ui/request-display-mode` popup requests per `OQ-6` closed); preserve 5s visibility-gated polling non-interference and draft maps (`AD-10`); keep contextual `/bmad-<skill> "<prompt>"` + `providerId/modelId` formatting inside Action Window/Queue (`AD-8`); keep `appInfo.version` and title version synced (`AD-14`).

## Done when

1. Palette C dark/light tokens and the closed `14px`+ / overlay `16/15/14.5/13.5px` type ramp ship with zero inline `font-size` rules and verified WCAG AA contrast in both themes.
2. The 3-tab `work`/`queue`/`project` shell passes ARIA `tablist`/`tab`/`tabpanel` and arrow-key checks with Skills/Agents lists removed and Changed Files + flat phases working inside `project`.
3. Work displays the plain-language current-focus hero, simplified action cards opening the Work Action Window, and the three collapsed-by-default disclosures; Focus View opens on Queue & Project cards/rows/sections with live draft/queue sync, focus trapping/restoration, and zero lost keystrokes or clobbered edits during 5s polling.
4. `node --test "tests/*.test.mjs" && node scripts/check-version-sync.mjs` runs green with full coverage of `R4`, plugin version `0.6.0` is synced across manifest, marketplace, server, and panel header, the repo-root validator passes, and a person confirms the rendered panel sits one step softer than the ZCode conversation surface in both light and dark themes.

## Boundaries

- Belongs to sibling `epic-focus-hero-engine` (`Epic 7`): engine/hook/MCP changes (`recentConversations`, `turnAnalysis.currentFocus`, `plainTitle`/`plainSummary`, `bmad_update_advisor` schema, `OQ-C`/`OQ-E`/`OQ-F`). This epic touches only `assets/panel.html` and panel/E2E tests.
- Must not change: `window.parent.postMessage` bridge (`no window.zcode`), `userEditedPrompts`/`userSelectedModels` preservation contract, `skillsCatalog`/`agentsCatalog` in `bmad_get_state` (`AD-14`), emoji icons (`DESIGN.md`), or upstream skills (`C5`).

## References

- parent — `_bmad-output/initiative-bmad-companion/initiative-bmad-companion.md`, Requirements `R27`–`R30`, Constraints `C1`, `C2`, `C7`, `C9`, `C13`
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md`, Colors (`Palette C`, `CD-1`–`CD-5`, `RD-5`), Typography (`RD-1`, `RD-6`), Shapes (`RD-2`), Components (`section-overlay`, `action-dialog`, `focus-hero`, `Disclosure header`)
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md`, Information Architecture (`3-tab Work/Queue/Project`, `RD-4`, `RD-9`), Voice (`RD-3`), Component Patterns (`RD-7`, `RD-8`), Live Polling & Form-Focus Guards, Accessibility Floor (`AD-1`–`AD-6`), Key Flows (Flows 1–4, 6, 7)
- architecture — `_bmad-output/initiative-bmad-companion/architecture-bmad-companion/architecture-bmad-companion.md`, `AD-8`, `AD-9` (`OQ-6` closed), `AD-10`, `AD-14`, `AD-16`, `AD-17`, `AD-18`

## Notes

- Decision: 2026-11-25 — Tracer bullet is Story 1 (`Palette C tokens, radii & larger type ramp`), proving the visual token & typography swap inside `assets/panel.html` before Story 2 restructures the 3-tab shell, Story 3 builds the unified overlay controller & guard/draft state machine, Stories 4–5 wire Work and Focus View content, Story 6 updates automated guard/a11y tests, Story 7 runs the refactor sweep, and Story 8 runs the closing E2E + `0.6.0` release sync + live host-theme check (`hitl`).
- Decision: 2026-11-25 — Focus card phrasing uses `"Current focus"` per owner pick (aligned in `EXPERIENCE.md` and `AD-18` `basisLabel`, replacing the earlier `"Based on your last three conversations"` wording while keeping `conversationCount` tracked in `turnAnalysis.currentFocus`).
- Assumption: UX spine open assumptions (exact plain-wording polish on headings, focal-point accent assignment per tab, and overlay backdrop/padding fine-tuning) stay within `DESIGN.md`/`EXPERIENCE.md` rules and are settled during Stories 1, 2, 4, and 8.
- Risk reason (`high`): `assets/panel.html` is a single self-contained CSP-restricted file where tab consolidation, overlay focus trapping, and capture-phase `Escape` handling interact directly with the 5s polling guard (`SM-2`); removing old 5-tab IDs also requires careful test updates.
- Waits on epic-panel-polling-safety, epic-focus-hero-engine because: preserves Epic 4's hardened 5s guard/a11y foundation and consumes Epic 7's `turnAnalysis.currentFocus` + `plainTitle`/`plainSummary` `ScanResult` payload.
- Layer files: `assets/panel.html`, `tests/panel-guards.test.mjs`, `tests/panel-a11y.test.mjs`, `tests/e2e-journeys.test.mjs`.
