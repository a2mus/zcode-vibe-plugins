---
type: epic
title: 5s polling safety, accessibility & contrast parity
parent: initiative-bmad-companion
covers: [R12, R13, R14]
sources:
  - _bmad-output/initiative-bmad-companion/initiative-bmad-companion.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
companions:
  - _bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md
after: [epic-mcp-surface]
refined: true
risk: high
---

# 5s polling safety, accessibility & contrast parity

## Description

Builds on Epic 2's frozen `ScanResult`/polling payload contract (`2.1`) to harden the panel's visibility-gated 5s poll, form-interaction guard stash/flush, and edit preservation + signature diffing (`FR-12`–`FR-14`), and to close the tracked UX accessibility deviations `AD-1`–`AD-5` and contrast debt `CD-1`–`CD-5` in `assets/panel.html`. Touches only `panel.html`, so it runs beside Epics 3 and 5.

## Outcome

Alex edits a recommended prompt while 5s background polling runs with zero dropped keystrokes, focus losses, or lost edits (`SM-2`), and the panel becomes keyboard/assistive-tech operable with WCAG AA contrast in both light and dark themes.

## Requirements

1. **R1 (parent R12)**: The panel polls `bmad_get_state({ refresh: true })` every `5000ms` only when `document.visibilityState === "visible"`, serialized by an `isRefreshing` lock so overlapping polls return immediately.
2. **R2 (parent R13)**: While focus is inside `<textarea>`/`<input>` or within `15000ms` of opening/navigating a `<select>` (`isUserInteractingWithForm()`), the panel suppresses background poll and `ui/notifications/tool-result` re-renders, stashes payloads in `pendingWorkspaceState`, and flushes via `flushPendingState()` on `focusout`/`change`/`Escape`/`Tab` (≤100ms).
3. **R3 (parent R14)**: The panel preserves `userEditedPrompts`/`userSelectedModels` across polls whenever the server base command/model is unchanged (dropping edits only when the base changes or a chosen model leaves `availableModels`), and compares `lastSectionSignatures` before replacing any tab container's `innerHTML`.
4. **R4** (EXPERIENCE.md Accessibility Floor `AD-1`–`AD-5`): Close the tracked accessibility deviations — visible `.cmd-textarea` focus ring (≥3:1), ARIA `tablist`/`tab`/`tabpanel` + arrow-key navigation, `#toastBanner` `aria-live` (polite/assertive), associated queue/editor `<label>`s, and `prefers-reduced-motion` gating of `.pulse-dot`.
5. **R5** (DESIGN.md Colors `CD-1`–`CD-5`): Close the measured contrast debt so essential text ≥4.5:1 and focus indicators ≥3:1 in both light and dark themes (muted ink, pill text, dark primary/badge white).

## Constraints

- **C1, C7, C9** (parent `C1`, `C7`, `C9`): panel stays self-contained under `csp.unsafeEval: false` with zero CDN/`eval()` and `escapeHtml()` on all dynamic content; background polling skips when `isRefreshing`/hidden/`isUserInteractingWithForm()` and stashes mid-flight results; never replace `innerHTML` unconditionally on a poll nor drop the guard/edit/signature maps.

## Done when

1. A guarded background poll stashes `pendingWorkspaceState` and flushes on `focusout`/`change` ≤100ms with zero lost edits, and an unchanged-base poll never clobbers an in-progress edit (`SM-2`).
2. `lastSectionSignatures` skips `innerHTML` replacement for unchanged sections; explicit user actions still render immediately.
3. `AD-1`–`AD-5` are closed: textarea focus ring, ARIA tab pattern + arrow keys, announced toasts, associated labels, and reduced-motion pulse gating verified.
4. `CD-1`–`CD-5` meet WCAG AA (essential text ≥4.5:1, focus ≥3:1) in both themes per the DESIGN.md measured-contrast method.

## Boundaries

- Belongs to siblings: engine/MCP/hook behavior (Epics 2, 3, 5, 6). This epic touches only `assets/panel.html` and its guard/a11y/contrast tests.
- Guard scope: the guard governs background updates only; responses to explicit user actions (`manageQueue`, reconciliation, artifact load) render immediately even when a control is focused (EXPERIENCE.md).
- Must not change: `window.parent.postMessage` bridge (no `window.zcode`); the guard/edit/signature maps (`AGENTS.md`); upstream skills (`C5`).

## References

- parent — `_bmad-output/initiative-bmad-companion/initiative-bmad-companion.md`, Requirements `R12`–`R14`, Constraints `C1`, `C7`, `C9`
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/EXPERIENCE.md`, Live Polling & Form-Focus Guards, Accessibility Floor (`AD-1`–`AD-6`), Interaction Primitives, Key Flows (Flow 1 — UJ-1)
- design — `_bmad-output/planning-artifacts/ux-bmad-companion/DESIGN.md`, Colors (measured contrast `CD-1`–`CD-5`), Components
- prd — `_bmad-output/planning-artifacts/prd-bmad-companion/prd-bmad-companion.md`, Feature 3 (`FR-12`–`FR-14`), `RULE-7`, `RULE-9`, `SM-2`, `DEC-3`

## Notes

- Decision: 2026-11-19 — Tracer bullet is Story 1 (poll-loop guard tracer), proving the thinnest visible-gated poll → guard → stash → flush path before Story 2 hardens edit preservation/signatures and Stories 3–4 close a11y/contrast debt.
- Assumption: guard logic is verified with a stubbed-document `node:test` harness (zero-dep, no jsdom) exercising `isUserInteractingWithForm`/`flushPendingState`/`resolveUserPrompt`/signature diffing, plus a `web-gui-tester` checklist for the rendered panel; settles at refinement.
- Risk reason (`high`): the panel is inline JS under strict CSP; regressions silently drop user edits or focus during 5s polling (`SM-2`), and a11y/contrast changes must hold in both themes.
- Waits on epic-mcp-surface because: needs the frozen `ScanResult`/polling payload contract (`2.1`) the panel renders.
- Layer files: `assets/panel.html`, `tests/panel-guards.test.mjs`.
