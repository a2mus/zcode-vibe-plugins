# Vibe Debrief (`v0.3.0`) — Comprehension-First Right-Side Panel

A ZCode right-side panel plugin built for **visual learners** and **multi-project vibe-coders**, fusing Karpathy's 4-rung comprehension framework cleanly into a single distraction-free panel:

## Unified Features

1. **Rung 1 — 80% ASD-STE100 Clarity (`STE-80` Toggle & Readability Meter):**
   - Keeps sentences short, active, and jargon-free at the **human-reading boundary** without constraining the coding agent mid-task.
   - Displays a live reading-time and clarity badge (`📖 ~30s · STE-80`).
2. **Rung 2 — Always-On Interactive SVG Diagram & Risk File Legend:**
   - **Every response** (Bug Fix or Implementation) renders an interactive node-and-arrow SVG diagram with real component/file names, role & risk colors, numbered flow arrows (`① → ② → ③`), and a click-to-inspect **Node Inspector**.
3. **Fused Oversight Inside Cards 3 & 4 (Zero Clutter):**
   - **Card 3 (`Did It Succeed?` / `Result`)**: Embeds ground-truth `proofClaims` backed by tool/command evidence.
   - **Card 4 (`Consequences & What to Double-Check`)**: Embeds Karpathy's **Least-Certain Audit** (`uncertaintyAudit`) and an interactive **Verification Checklist** (persisted in state with 1-click promotion to ZCode Memory).
4. **Rung 3 — On-Demand Standalone HTML Export (`🌐 HTML` / `vibe_debrief_export_html`):**
   - Generates a self-contained, dependency-free discardable `.html` explainer artifact under `.zcode/vibe-debrief-artifacts/`.
5. **Rung 4 — Complex-Only 3b1b Animated Explainer (`🎬 Explainer`):**
   - Automatically gated by `assessWorkflowComplexity`: simple turns stay clean and fast, while **complex multi-file / multi-layer workflows** unlock a Canvas blueprint scene player with optional Web Speech voiceover and a **plain-text narration script** for claim verification.
6. **ZCode Memory Loop (`MEMORY.md`):**
   - Confirm any Lesson Learned (or promote a Card 4 check) in 1 click to persist it into ZCode's project memory.
