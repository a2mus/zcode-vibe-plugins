import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

export const PERSONAS = [
  {
    id: "vibe-mentor",
    name: "Vibe Mentor",
    badge: "🧑‍💻 Vibe-Coder Buddy",
    tagline: "Pragmatic dev friend juggling multiple vibe-coded projects — zero academic fluff, high ROI perspective.",
    analogyPrefix: "Think of your app like a fast-moving indie studio:"
  },
  {
    id: "visual-mapper",
    name: "Visual Mapper",
    badge: "🎨 Visual Thinker",
    tagline: "Explains through spatial boxes, cause-effect pipelines, and concrete before/after mental pictures.",
    analogyPrefix: "Picture this as a visual pipeline on a whiteboard:"
  },
  {
    id: "indie-founder",
    name: "Indie Founder",
    badge: "⚡ Ship & Scale",
    tagline: "Focuses on what was broken or needed, why this fix/feature is the fastest safe path, and product impact.",
    analogyPrefix: "From a product builder's perspective:"
  },
  {
    id: "eli5-storyteller",
    name: "Pure ELI5",
    badge: "🧸 Everyday Analogy",
    tagline: "Explains complex code mechanics using simple real-world stories anyone can grasp in 10 seconds.",
    analogyPrefix: "Imagine a busy coffee shop kitchen:"
  }
];

function getStateFilePath(workspaceRoot) {
  return join(workspaceRoot, ".zcode", "vibe-debrief-state.json");
}

const STATE_COLLECTION_LIMITS = Object.freeze({
  history: 15,
  recentTouchedFiles: 15,
  confirmedLessons: 50
});

/**
 * Enforce the documented collection caps at the persistence boundary.
 * history and confirmedLessons are newest-first, so keep the head.
 * recentTouchedFiles is append-ordered, so keep the tail.
 * Non-array values are treated as empty so corrupt state degrades cleanly.
 */
function boundStateCollections(state) {
  const history = Array.isArray(state.history) ? state.history : [];
  const recentTouchedFiles = Array.isArray(state.recentTouchedFiles)
    ? state.recentTouchedFiles
    : [];
  const confirmedLessons = Array.isArray(state.confirmedLessons)
    ? state.confirmedLessons
    : [];
  return {
    ...state,
    history: history.slice(0, STATE_COLLECTION_LIMITS.history),
    recentTouchedFiles: recentTouchedFiles.slice(-STATE_COLLECTION_LIMITS.recentTouchedFiles),
    confirmedLessons: confirmedLessons.slice(0, STATE_COLLECTION_LIMITS.confirmedLessons)
  };
}

/**
 * Resolve the ZCode home directory. Tests set ZCODE_HOME_DIR to a temp folder so
 * memory and model-discovery reads never touch the developer's live ~/.zcode.
 * The override is read per call, so concurrent test files stay isolated.
 */
function getZCodeHomeDir() {
  const override = String(process.env.ZCODE_HOME_DIR || "").trim();
  return override || homedir();
}

export function loadPersistedState(workspaceRoot) {
  const path = getStateFilePath(workspaceRoot);
  try {
    if (!existsSync(path)) {
      return createDefaultState(workspaceRoot);
    }
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const merged = {
      ...createDefaultState(workspaceRoot),
      ...raw
    };
    if (merged.currentDebrief) {
      merged.currentDebrief = ensureDebriefEnriched(merged.currentDebrief, merged);
    }
    return boundStateCollections(merged);
  } catch {
    return createDefaultState(workspaceRoot);
  }
}

let stateWriteSeq = 0;

function sleepSyncMs(ms) {
  if (!(ms > 0)) return;
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      // bounded spin fallback when SharedArrayBuffer is unavailable
    }
  }
}

function buildSiblingTempPath(targetPath) {
  stateWriteSeq = (stateWriteSeq + 1) % 1_000_000_000;
  return join(
    dirname(targetPath),
    `vibe-debrief-state.${process.pid}.${Date.now()}-${stateWriteSeq}.tmp`
  );
}

const DEFAULT_STATE_FS_OPS = Object.freeze({
  mkdirSync,
  writeFileSync,
  renameSync,
  unlinkSync
});

function isWindowsTransientRenameError(error) {
  return error?.code === "EPERM" || error?.code === "EACCES";
}

function isRenameFallbackError(error) {
  return error?.code === "EXDEV";
}

/**
 * Write serialized state JSON to a uniquely named sibling temp file and
 * atomically replace targetPath via renameSync. Retries transient Windows
 * EPERM/EACCES locks briefly, falls back to direct write only on EXDEV,
 * preserves prior state on persistent EPERM/EACCES instead of tearing via
 * non-atomic overwrite, and always removes the temp file when rename does not
 * complete.
 */
function atomicWriteStateFileSync(targetPath, serialized, options = {}) {
  const fsOps = { ...DEFAULT_STATE_FS_OPS, ...(options.fs || {}) };
  const sleepFn = typeof options.sleepSync === "function" ? options.sleepSync : sleepSyncMs;
  const retryDelaysMs = Array.isArray(options.retryDelaysMs)
    ? options.retryDelaysMs
    : [2, 5, 10, 15, 25, 40];
  const tempPath = buildSiblingTempPath(targetPath);
  let renamed = false;

  try {
    fsOps.mkdirSync(dirname(targetPath), { recursive: true });
    fsOps.writeFileSync(tempPath, serialized, "utf8");

    try {
      fsOps.renameSync(tempPath, targetPath);
      renamed = true;
    } catch (renameErr) {
      if (isWindowsTransientRenameError(renameErr)) {
        for (const delayMs of retryDelaysMs) {
          sleepFn(delayMs);
          try {
            fsOps.renameSync(tempPath, targetPath);
            renamed = true;
            break;
          } catch (retryErr) {
            renameErr = retryErr;
            if (!isWindowsTransientRenameError(retryErr)) {
              break;
            }
          }
        }
      }

      if (!renamed) {
        if (isRenameFallbackError(renameErr)) {
          fsOps.writeFileSync(targetPath, serialized, "utf8");
        } else {
          throw renameErr;
        }
      }
    }
  } finally {
    if (!renamed) {
      try {
        fsOps.unlinkSync(tempPath);
      } catch {
        // ignore cleanup errors if temp file was never created or already removed
      }
    }
  }
}

export function savePersistedState(workspaceRoot, patch, options = {}) {
  const path = getStateFilePath(workspaceRoot);
  const current = loadPersistedState(workspaceRoot);
  const next = boundStateCollections({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  });
  try {
    atomicWriteStateFileSync(path, JSON.stringify(next, null, 2), options);
  } catch {
    // ignore read-only workspace errors
  }
  return next;
}

function createDefaultState(workspaceRoot) {
  const projectName = basename(workspaceRoot || process.cwd());
  return {
    projectName,
    workspaceRoot,
    activePersona: "vibe-mentor",
    ste100Enabled: true,
    turnCount: 0,
    lastUserPrompt: "",
    lastAssistantMessage: "",
    recentTouchedFiles: [],
    lastCommandExitZero: null,
    lastCommandSummary: "",
    currentDebrief: createWelcomeDebrief(projectName, "vibe-mentor"),
    history: [],
    confirmedLessons: [],
    updatedAt: new Date().toISOString()
  };
}

function createWelcomeDebrief(projectName, personaId) {
  const base = {
    id: "welcome-debrief",
    createdAt: new Date().toISOString(),
    responseType: "implementation",
    persona: personaId || "vibe-mentor",
    tldrHeadline: `Vibe Debrief turns AI replies in ${projectName} into 80% STE-100 summaries, live diagrams, and verified checks.`,
    realWorldAnalogy:
      "Think of this panel as your cockpit dashboard: you see the route diagram, check what is verified vs. uncertain, and save key lessons to memory.",
    visualFlow: [
      { step: "1", icon: "💬", title: "Your Prompt", subtitle: "Bug or Feature Goal", status: "done" },
      { step: "2", icon: "⚙️", title: "AI Action", subtitle: "Edits & Checks", status: "done" },
      { step: "3", icon: "🗺️", title: "Diagram & STE-80", subtitle: "Clarity + Audit", status: "active" },
      { step: "4", icon: "🧠", title: "ZCode Memory", subtitle: "Save Confirmed Rules", status: "pending" }
    ],
    diagram: {
      diagramType: "architecture",
      title: "Comprehension Pipeline at the Reading Boundary",
      nodes: [
        { id: "n1", label: "Your Prompt", sublabel: "Bug or Feature", role: "Input", file: "", risk: "low", status: "done" },
        { id: "n2", label: "Coding Agent", sublabel: "Reasons freely", role: "Core Logic / Service", file: "", risk: "medium", status: "done" },
        { id: "n3", label: "Debrief Diagram", sublabel: "STE-80 + Proof", role: "Visual UI / View", file: "", risk: "low", status: "active" },
        { id: "n4", label: "ZCode Memory", sublabel: "Confirmed Lessons", role: "State / ViewModel", file: "MEMORY.md", risk: "low", status: "pending" }
      ],
      edges: [
        { from: "n1", to: "n2", stepNumber: 1, label: "Execute task", risk: "low" },
        { from: "n2", to: "n3", stepNumber: 2, label: "Simplify & diagram", risk: "medium" },
        { from: "n3", to: "n4", stepNumber: 3, label: "Confirm rule", risk: "low" }
      ]
    },
    bugReport: {
      cause:
        "When you share an error, this card strips stack-trace noise and states the exact root cause in active plain English.",
      plan:
        "Shows the targeted fix strategy before you dig into file diffs.",
      succeeded: "yes",
      successSummary:
        "Shows whether the fix succeeded (Verified, Partial, or Needs Fix) backed by actual command and file checks.",
      consequences:
        "Lists side-effects, risky spots to double-check, and quick human verification steps."
    },
    implementationReport: {
      objective:
        `Give you high-ROI oversight on every turn in ${projectName} so you review changes in 2 minutes instead of 20.`,
      planAndWhy:
        "We keep the coding agent unconstrained while it works, then apply STE-80 prose, an interactive SVG diagram, and verification checks at the reading boundary.",
      result:
        "Every turn renders a live node-and-arrow diagram, inline proof badges, and checkable verification items. Complex workflows also unlock an animated 3b1b-style explainer.",
      consequences:
        "Simple turns stay lightweight with zero video clutter. Confirmed takeaways persist directly into ZCode MEMORY.md."
    },
    proofClaims: [
      { claim: "Diagrams render on every bug and implementation turn", evidence: "Unified SVG Diagram Renderer", status: "verified" },
      { claim: "Confirmed lessons persist across sessions", evidence: "ZCode MEMORY.md sync", status: "verified" }
    ],
    uncertaintyAudit: [
      { area: "First turn baseline", reason: "No code changes run yet in this sample card — run a prompt to inspect real files.", riskLevel: "low" }
    ],
    verificationChecklist: [
      { id: "chk-welcome-1", text: "Click any node in the diagram above to inspect its role and risk", source: "SVG Diagram", risk: "low", checked: false },
      { id: "chk-welcome-2", text: "Confirm a useful takeaway below to save it to MEMORY.md", source: "ZCode Memory", risk: "low", checked: false }
    ],
    lessonsLearned: [
      {
        id: "sample-lesson-1",
        slug: "vibe-debrief-memory-loop",
        title: "Save verified pitfalls and patterns into ZCode Memory",
        summary:
          "Click 'Confirm & Save to ZCode Memory' on any real lesson so ZCode avoids repeating mistakes across sessions.",
        why: "Multi-project vibe coding moves fast when project rules stick automatically.",
        howToApply:
          "Review Section 4 checks after a turn, promote or confirm key rules, and keep MEMORY.md concise.",
        memoryType: "feedback",
        confirmed: false
      }
    ],
    touchedFiles: [],
    complexity: { level: "simple", score: 1, reason: "Welcome overview (1 single view)" },
    explainerScenes: []
  };
  base.ste100Metrics = computeSte100Metrics(base);
  return base;
}

// ============================================================================
// RUNG 1: ASD-STE100 ("80% Simplified Technical English") Engine
// ============================================================================

const STE_REPLACEMENTS = [
  [/\butilize(s|d|ing)?\b/gi, (_, s) => `use${s === "d" ? "d" : s === "ing" ? "ing" : s === "s" ? "s" : ""}`],
  [/\bcommence(s|d|ing)?\b/gi, (_, s) => `start${s === "d" ? "ed" : s === "ing" ? "ing" : s === "s" ? "s" : ""}`],
  [/\bterminate(s|d|ing)?\b/gi, (_, s) => `stop${s === "d" ? "ped" : s === "ing" ? "ping" : s === "s" ? "s" : ""}`],
  [/\bfacilitate(s|d|ing)?\b/gi, (_, s) => `help${s === "d" ? "ed" : s === "ing" ? "ing" : s === "s" ? "s" : ""}`],
  [/\bleverage(s|d|ing)?\b/gi, (_, s) => `use${s === "d" ? "d" : s === "ing" ? "ing" : s === "s" ? "s" : ""}`],
  [/\bsubsequently\b/gi, "then"],
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bat this point in time\b/gi, "now"],
  [/\bprior to\b/gi, "before"],
  [/\bapproximately\b/gi, "about"],
  [/\badditionally,\s*/gi, "Also, "],
  [/\bfurthermore,\s*/gi, "Also, "],
  [/\bmoreover,\s*/gi, "Also, "],
  [/\bit appears that\s+/gi, ""],
  [/\bbasically,\s*/gi, ""],
  [/\bessentially,\s*/gi, ""],
  [/\bin general,\s*/gi, ""]
];

export function applySte100Polish(text) {
  let out = String(text || "").trim();
  if (!out) return "";
  for (const [rx, replacement] of STE_REPLACEMENTS) {
    out = out.replace(rx, replacement);
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  if (out.length > 0) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

export function computeSte100Metrics(debrief) {
  if (!debrief) {
    return { score: 85, avgSentenceWords: 12, longSentenceCount: 0, totalWords: 20, estimatedReadSeconds: 15, grade: "STE-80" };
  }
  const isBug = debrief.responseType === "bug";
  const chunks = [
    debrief.tldrHeadline,
    debrief.realWorldAnalogy,
    ...(isBug
      ? [debrief.bugReport?.cause, debrief.bugReport?.plan, debrief.bugReport?.successSummary, debrief.bugReport?.consequences]
      : [
          debrief.implementationReport?.objective,
          debrief.implementationReport?.planAndWhy,
          debrief.implementationReport?.result,
          debrief.implementationReport?.consequences
        ])
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());

  const fullText = chunks.join(" ");
  const sentences = fullText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const wordList = fullText.split(/\s+/).filter(Boolean);
  const totalWords = wordList.length;
  const sentenceWordCounts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const avgSentenceWords = sentenceWordCounts.length
    ? Math.round((sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length) * 10) / 10
    : 12;
  const longSentenceCount = sentenceWordCounts.filter((c) => c > 25).length;
  const passiveMatches = (fullText.match(/\b(was|were|is|are|been)\s+\w+ed\b/gi) || []).length;
  const jargonMatches = (fullText.match(/\b(utilize|commence|terminate|facilitate|leverage|subsequently|additionally|furthermore|moreover)\b/gi) || []).length;

  let score = 96;
  if (avgSentenceWords > 20) score -= Math.min(22, Math.round((avgSentenceWords - 20) * 2.2));
  score -= longSentenceCount * 5;
  score -= Math.min(12, passiveMatches * 2);
  score -= Math.min(15, jargonMatches * 5);
  score = Math.max(40, Math.min(99, score));

  const estimatedReadSeconds = Math.max(15, Math.round(totalWords / 3.3));
  const grade = score >= 80 ? "STE-80" : score >= 65 ? "Clear" : "Dense";

  return {
    score,
    avgSentenceWords,
    longSentenceCount,
    totalWords,
    estimatedReadSeconds,
    grade
  };
}

// ============================================================================
// File Role, Risk & Intent Classification
// ============================================================================

export function classifyFileRole(filePath) {
  const f = String(filePath || "").replace(/\\/g, "/");
  const lower = f.toLowerCase();
  if (lower.includes("test") || lower.includes("spec")) {
    return { path: f, shortName: basename(f), role: "Test / Verification", icon: "🧪", color: "purple", risk: "low", intent: "Verify" };
  }
  if (lower.endsWith(".xaml") || lower.endsWith(".html") || lower.endsWith(".css") || lower.endsWith(".tsx") || lower.endsWith(".jsx") || lower.includes("/views/") || lower.includes("/ui/")) {
    return { path: f, shortName: basename(f), role: "Visual UI / View", icon: "🖥️", color: "accent", risk: "medium", intent: "UI Surface" };
  }
  if (lower.includes("auth") || lower.includes("migrat") || lower.includes("payment") || lower.includes("security") || lower.includes("hook") || lower.includes("server")) {
    return { path: f, shortName: basename(f), role: "Core Logic / Service", icon: "⚙️", color: "danger", risk: "high", intent: "Critical Path" };
  }
  if (lower.includes("viewmodel") || lower.includes("controller") || lower.includes("store") || lower.includes("state")) {
    return { path: f, shortName: basename(f), role: "State / ViewModel", icon: "🎛️", color: "warning", risk: "medium", intent: "State Flow" };
  }
  if (lower.includes("service") || lower.includes("engine") || lower.endsWith(".cs") || lower.endsWith(".mjs") || lower.endsWith(".ts") || lower.endsWith(".py")) {
    return { path: f, shortName: basename(f), role: "Core Logic / Service", icon: "⚙️", color: "success", risk: "medium", intent: "Core Logic" };
  }
  if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".toml") || lower.endsWith(".md")) {
    return { path: f, shortName: basename(f), role: "Config / Docs", icon: "📋", color: "muted", risk: "low", intent: "Config / Docs" };
  }
  return { path: f, shortName: basename(f), role: "Project File", icon: "📄", color: "accent", risk: "low", intent: "Support" };
}

// ============================================================================
// Complexity Gate (Gates Rung 4 Animated Explainer to Complex Workflows Only)
// ============================================================================

export function assessWorkflowComplexity({
  touchedFiles = [],
  diagram = null,
  assistantMessage = "",
  userPrompt = "",
  complexityOverride = null
} = {}) {
  if (complexityOverride === "complex" || complexityOverride === "simple") {
    return {
      level: complexityOverride,
      score: complexityOverride === "complex" ? 6 : 1,
      reason: complexityOverride === "complex" ? "Marked complex for animated walkthrough" : "Marked simple"
    };
  }

  const normalizedFiles = (touchedFiles || []).map((f) => (typeof f === "string" ? classifyFileRole(f) : f));
  const distinctLayers = new Set(normalizedFiles.map((f) => f.role));
  const highRiskCount = normalizedFiles.filter((f) => f.risk === "high").length;
  const nodeCount = Array.isArray(diagram?.nodes) ? diagram.nodes.length : 0;
  const edgeCount = Array.isArray(diagram?.edges) ? diagram.edges.length : 0;
  const hasBranching = edgeCount > Math.max(0, nodeCount - 1) && nodeCount >= 3;

  let score = 0;
  const reasons = [];

  if (normalizedFiles.length >= 5) {
    score += 3;
    reasons.push(`${normalizedFiles.length} files changed`);
  } else if (normalizedFiles.length >= 3) {
    score += 2;
    reasons.push(`${normalizedFiles.length} files changed`);
  }

  if (distinctLayers.size >= 3) {
    score += 3;
    reasons.push(`${distinctLayers.size} architectural layers`);
  } else if (distinctLayers.size >= 2) {
    score += 2;
    reasons.push(`${distinctLayers.size} layers`);
  }

  if (hasBranching || nodeCount >= 5) {
    score += 2;
    reasons.push("multi-branch data flow");
  } else if (nodeCount >= 4 && normalizedFiles.length >= 2) {
    score += 1;
  }

  if (highRiskCount >= 1) {
    score += 1;
    reasons.push("critical-path file touched");
  }

  const combinedText = `${userPrompt || ""}\n${assistantMessage || ""}`;
  if (combinedText.length > 2200 || /\b(architecture|pipeline|orchestrat|migration|state\s*machine|end-to-end|multi-step)\b/i.test(combinedText)) {
    score += 1;
    if (reasons.length === 0) reasons.push("multi-step architecture");
  }

  const level = score >= 4 ? "complex" : "simple";
  return {
    level,
    score,
    reason: reasons.length
      ? reasons.slice(0, 2).join(" + ")
      : normalizedFiles.length
      ? `Focused ${normalizedFiles.length}-file change`
      : "Single-concept turn"
  };
}

// ============================================================================
// RUNG 2: Always-On Diagram Synthesizer (Every Response Gets a Diagram)
// ============================================================================

export function buildDefaultDiagram(debrief, explicitDiagram = null) {
  const isBug = debrief?.responseType === "bug";
  const touched = Array.isArray(debrief?.touchedFiles) ? debrief.touchedFiles : [];

  if (explicitDiagram && Array.isArray(explicitDiagram.nodes) && explicitDiagram.nodes.length > 0) {
    const nodes = explicitDiagram.nodes.slice(0, 6).map((n, idx) => ({
      id: String(n.id || `n${idx + 1}`),
      label: String(n.label || `Step ${idx + 1}`).slice(0, 32),
      sublabel: String(n.sublabel || "").slice(0, 40),
      role: String(n.role || "Component"),
      file: String(n.file || ""),
      risk: ["low", "medium", "high"].includes(n.risk) ? n.risk : "low",
      status: ["done", "active", "pending", "warning"].includes(n.status) ? n.status : "done"
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    let edges = Array.isArray(explicitDiagram.edges)
      ? explicitDiagram.edges
          .filter((e) => nodeIds.has(String(e.from)) && nodeIds.has(String(e.to)))
          .map((e, idx) => ({
            from: String(e.from),
            to: String(e.to),
            stepNumber: Number(e.stepNumber || idx + 1),
            label: String(e.label || `Step ${idx + 1}`).slice(0, 30),
            risk: ["low", "medium", "high"].includes(e.risk) ? e.risk : "low"
          }))
      : [];

    if (edges.length === 0 && nodes.length > 1) {
      edges = nodes.slice(0, -1).map((n, idx) => ({
        from: n.id,
        to: nodes[idx + 1].id,
        stepNumber: idx + 1,
        label: "Flows to",
        risk: "low"
      }));
    }

    return {
      diagramType: explicitDiagram.diagramType || (isBug ? "cause-effect" : "architecture"),
      title: explicitDiagram.title || (isBug ? "Root Cause to Fix Verification" : "Component & Data Flow"),
      nodes,
      edges
    };
  }

  // Auto-synthesize from real touched files first so nodes always carry real names
  if (touched.length >= 2) {
    const selectedFiles = touched.slice(0, 4);
    const nodes = [
      {
        id: "n-trigger",
        label: isBug ? "Error Trigger" : "User Goal",
        sublabel: isBug ? "Broken state" : "New capability",
        role: "Input",
        file: "",
        risk: isBug ? "high" : "low",
        status: isBug ? "warning" : "done"
      },
      ...selectedFiles.map((f, idx) => ({
        id: `n-file-${idx + 1}`,
        label: f.shortName || `File ${idx + 1}`,
        sublabel: f.intent || f.role || "Updated",
        role: f.role || "Project File",
        file: f.path || f.shortName || "",
        risk: f.risk || "medium",
        status: idx === selectedFiles.length - 1 ? "active" : "done"
      }))
    ];

    const hasTest = selectedFiles.some((f) => f.role === "Test / Verification");
    if (!hasTest && nodes.length < 5) {
      nodes.push({
        id: "n-outcome",
        label: isBug ? (debrief?.bugReport?.succeeded === "no" ? "Blocked" : "Fixed State") : "Verified Result",
        sublabel: isBug ? "Runtime check" : "Ready to use",
        role: "Outcome",
        file: "",
        risk: debrief?.bugReport?.succeeded === "no" ? "high" : "low",
        status: debrief?.bugReport?.succeeded === "no" ? "warning" : "done"
      });
    }

    const edges = nodes.slice(0, -1).map((node, idx) => ({
      from: node.id,
      to: nodes[idx + 1].id,
      stepNumber: idx + 1,
      label:
        idx === 0
          ? isBug
            ? "Hits"
            : "Updates"
          : idx === nodes.length - 2
          ? "Produces"
          : "Flows to",
      risk: nodes[idx + 1].risk || "low"
    }));

    return {
      diagramType: isBug ? "cause-effect" : "architecture",
      title: isBug ? "Bug Cause → Patched Files → Outcome" : "Goal → Changed Components → Result",
      nodes,
      edges
    };
  }

  // Fallback for 0 or 1 touched file: turn visualFlow (or canonical steps) into a connected SVG diagram
  const flow = Array.isArray(debrief?.visualFlow) && debrief.visualFlow.length > 0
    ? debrief.visualFlow
    : isBug
    ? [
        { step: "1", title: "Root Cause", subtitle: "Trigger isolated", status: "warning" },
        { step: "2", title: touched[0]?.shortName || "Targeted Patch", subtitle: "Fix applied", status: "done" },
        { step: "3", title: "Verify Fix", subtitle: "Outcome checked", status: "done" },
        { step: "4", title: "Ripple & Rule", subtitle: "Save lesson", status: "active" }
      ]
    : [
        { step: "1", title: "Objective", subtitle: "Core goal", status: "done" },
        { step: "2", title: touched[0]?.shortName || "Plan & Build", subtitle: "Simplest path", status: "done" },
        { step: "3", title: "Result", subtitle: "Working state", status: "done" },
        { step: "4", title: "Impact & Rule", subtitle: "Verify & save", status: "active" }
      ];

  const nodes = flow.slice(0, 5).map((step, idx) => ({
    id: `n-step-${idx + 1}`,
    label: idx === 1 && touched[0]?.shortName ? touched[0].shortName : String(step.title || `Step ${idx + 1}`).slice(0, 26),
    sublabel: String(step.subtitle || "").slice(0, 34),
    role: idx === 1 && touched[0] ? touched[0].role : "Flow Step",
    file: idx === 1 && touched[0] ? touched[0].path : "",
    risk: idx === 1 && touched[0] ? touched[0].risk : step.status === "warning" ? "high" : "low",
    status: step.status || "done"
  }));

  const edges = nodes.slice(0, -1).map((node, idx) => ({
    from: node.id,
    to: nodes[idx + 1].id,
    stepNumber: idx + 1,
    label: idx === 0 ? "Triggers" : idx === nodes.length - 2 ? "Delivers" : "Next",
    risk: nodes[idx + 1].risk || "low"
  }));

  return {
    diagramType: isBug ? "cause-effect" : "state-flow",
    title: isBug ? "Cause-to-Fix Flow Diagram" : "Implementation Flow Diagram",
    nodes,
    edges
  };
}

// ============================================================================
// Epistemic Safety: Card 3 Proof Claims & Card 4 Uncertainty / Checklist
// ============================================================================

export function buildDefaultVerificationData(debrief, touchedFiles = [], lastCommandExitZero = null) {
  const isBug = debrief?.responseType === "bug";
  const normalizedFiles = (touchedFiles || []).map((f) => (typeof f === "string" ? classifyFileRole(f) : f));
  const hasTests = normalizedFiles.some((f) => f.role === "Test / Verification");
  const hasHighRisk = normalizedFiles.some((f) => f.risk === "high");

  const proofClaims = [];
  if (lastCommandExitZero === true) {
    proofClaims.push({
      claim: "Latest shell command completed cleanly",
      evidence: "Bash exit 0",
      status: "verified"
    });
  } else if (lastCommandExitZero === false) {
    proofClaims.push({
      claim: "Latest shell command reported an error",
      evidence: "Bash error signal",
      status: "unverified"
    });
  }

  if (normalizedFiles.length > 0) {
    proofClaims.push({
      claim: `Updated ${normalizedFiles.length} workspace file(s)`,
      evidence: normalizedFiles.slice(0, 2).map((f) => f.shortName).join(", "),
      status: "verified"
    });
  } else {
    proofClaims.push({
      claim: "Response is an explanation or analysis (no files modified)",
      evidence: "0 workspace edits",
      status: "inferred"
    });
  }

  if (hasTests) {
    proofClaims.push({
      claim: "Test/spec coverage touched in this turn",
      evidence: normalizedFiles.find((f) => f.role === "Test / Verification")?.shortName || "test file",
      status: "verified"
    });
  }

  const uncertaintyAudit = [];
  if (lastCommandExitZero !== true) {
    uncertaintyAudit.push({
      area: "Runtime & test verification",
      reason: "No passing command or test run was recorded in this turn — behavior is inferred from code.",
      riskLevel: isBug ? "high" : "medium"
    });
  }
  if (hasHighRisk) {
    const risky = normalizedFiles.find((f) => f.risk === "high");
    uncertaintyAudit.push({
      area: `Critical-path file (${risky.shortName})`,
      reason: "Touches core server, auth, state, or hook wiring where silent edge cases matter.",
      riskLevel: "high"
    });
  }
  if (!hasTests && normalizedFiles.length >= 2) {
    uncertaintyAudit.push({
      area: "Cross-file integration",
      reason: `${normalizedFiles.length} files changed without an automated test update.`,
      riskLevel: "medium"
    });
  }
  if (uncertaintyAudit.length === 0) {
    uncertaintyAudit.push({
      area: "Edge-case inputs",
      reason: "Core happy path looks solid; verify unusual or empty inputs manually.",
      riskLevel: "low"
    });
  }

  const verificationChecklist = [];
  if (lastCommandExitZero !== true) {
    verificationChecklist.push({
      id: "chk-run-smoke",
      text: isBug ? "Re-run the failing action to confirm the error stays gone" : "Run a quick build or smoke test for the new behavior",
      source: "Runtime Check",
      risk: isBug ? "high" : "medium",
      checked: false
    });
  }
  if (normalizedFiles.length > 0) {
    verificationChecklist.push({
      id: "chk-inspect-node",
      text: `Spot-check changes in ${normalizedFiles[0].shortName}${normalizedFiles.length > 1 ? ` (+${normalizedFiles.length - 1} more)` : ""}`,
      source: normalizedFiles[0].shortName,
      risk: normalizedFiles[0].risk || "low",
      checked: false
    });
  } else {
    verificationChecklist.push({
      id: "chk-confirm-claim",
      text: "Check the top assumption in 'Watch Out' against your actual code",
      source: "Code Reality",
      risk: "low",
      checked: false
    });
  }

  return {
    proofClaims: proofClaims.slice(0, 3),
    uncertaintyAudit: uncertaintyAudit.slice(0, 3),
    verificationChecklist: verificationChecklist.slice(0, 3)
  };
}

// ============================================================================
// RUNG 4: Complex-Only 3b1b-Style Animated Explainer Scenes + Script
// ============================================================================

export function buildExplainerScenesForDebrief(debrief) {
  if (!debrief) return [];
  const isBug = debrief.responseType === "bug";
  const diagram = debrief.diagram || buildDefaultDiagram(debrief);
  const nodes = diagram.nodes || [];
  const nodeIds = nodes.map((n) => n.id);

  const scenes = [
    {
      id: "scene-1",
      durationSec: 7,
      title: isBug ? "1. The Trigger & Root Cause" : "1. The Goal & Architecture",
      visualType: "highlight-start",
      highlightNodeIds: nodeIds.slice(0, 1),
      callout: applySte100Polish(debrief.tldrHeadline || "Overview"),
      narration: applySte100Polish(
        isBug
          ? debrief.bugReport?.cause || debrief.tldrHeadline
          : debrief.implementationReport?.objective || debrief.tldrHeadline
      )
    },
    {
      id: "scene-2",
      durationSec: 8,
      title: isBug ? "2. The Fix Strategy" : "2. Plan & Design Choice",
      visualType: "pulse-flow",
      highlightNodeIds: nodeIds.slice(0, Math.min(3, nodeIds.length)),
      callout: applySte100Polish(debrief.realWorldAnalogy || "Step-by-step flow"),
      narration: applySte100Polish(
        isBug
          ? debrief.bugReport?.plan || "We apply a targeted patch to stop the failure."
          : debrief.implementationReport?.planAndWhy || "We chose the simplest decoupled path."
      )
    },
    {
      id: "scene-3",
      durationSec: 7,
      title: isBug ? "3. Fix Outcome & Proof" : "3. Delivered Result",
      visualType: "highlight-end",
      highlightNodeIds: nodeIds.slice(Math.max(0, nodeIds.length - 2)),
      callout: isBug ? `Status: ${(debrief.bugReport?.succeeded || "yes").toUpperCase()}` : "Working Delivery",
      narration: applySte100Polish(
        isBug
          ? debrief.bugReport?.successSummary || "Check whether the fix holds."
          : debrief.implementationReport?.result || "The new capability is active."
      )
    },
    {
      id: "scene-4",
      durationSec: 7,
      title: "4. Ripple Effects & What to Verify",
      visualType: "audit-warning",
      highlightNodeIds: nodeIds,
      callout: (debrief.uncertaintyAudit?.[0]?.area || "Verify edge cases"),
      narration: applySte100Polish(
        `${
          isBug ? debrief.bugReport?.consequences || "" : debrief.implementationReport?.consequences || ""
        } Watch out for: ${debrief.uncertaintyAudit?.[0]?.reason || "verify key inputs."}`.trim()
      )
    }
  ];

  return scenes;
}

export function buildExplainerScenesIfComplex(debrief, complexity, force = false) {
  if (!force && complexity?.level !== "complex") {
    return [];
  }
  return buildExplainerScenesForDebrief(debrief);
}

export function buildPlainTextScript(scenes = []) {
  if (!Array.isArray(scenes) || scenes.length === 0) return "";
  return scenes
    .map((s, i) => `[Scene ${i + 1} · ${s.durationSec || 7}s] ${s.title}\n${s.narration}`)
    .join("\n\n");
}

function ensureDebriefEnriched(debrief, state = {}) {
  const touched = Array.isArray(debrief.touchedFiles) ? debrief.touchedFiles : [];
  const diagram = buildDefaultDiagram(debrief, debrief.diagram);
  const complexity =
    debrief.complexity ||
    assessWorkflowComplexity({
      touchedFiles: touched,
      diagram,
      assistantMessage: state.lastAssistantMessage || "",
      userPrompt: state.lastUserPrompt || ""
    });
  const defaults = buildDefaultVerificationData(debrief, touched, state.lastCommandExitZero ?? null);
  const proofClaims = Array.isArray(debrief.proofClaims) && debrief.proofClaims.length > 0 ? debrief.proofClaims : defaults.proofClaims;
  const uncertaintyAudit =
    Array.isArray(debrief.uncertaintyAudit) && debrief.uncertaintyAudit.length > 0
      ? debrief.uncertaintyAudit
      : defaults.uncertaintyAudit;
  const verificationChecklist =
    Array.isArray(debrief.verificationChecklist) && debrief.verificationChecklist.length > 0
      ? debrief.verificationChecklist
      : defaults.verificationChecklist;
  const explainerScenes =
    Array.isArray(debrief.explainerScenes) && debrief.explainerScenes.length > 0
      ? debrief.explainerScenes
      : buildExplainerScenesIfComplex({ ...debrief, diagram, uncertaintyAudit }, complexity, false);

  const enriched = {
    ...debrief,
    diagram,
    complexity,
    proofClaims,
    uncertaintyAudit,
    verificationChecklist,
    explainerScenes
  };
  enriched.ste100Metrics = computeSte100Metrics(enriched);
  return enriched;
}

// ============================================================================
// Response Classification & Heuristic Synthesis
// ============================================================================

export function detectResponseType(userPrompt, assistantMessage) {
  const combined = `${userPrompt || ""}\n${assistantMessage || ""}`.toLowerCase();
  const bugSignals = [
    /\bbug\b/,
    /\berror\b/,
    /\bexception\b/,
    /\bstack\s*trace\b/,
    /\bcrash(ed|es|ing)?\b/,
    /\bfail(ed|s|ing|ure)?\b/,
    /\bbroken\b/,
    /\bfix(ed|ing)?\b/,
    /\bissue\b/,
    /\bregression\b/,
    /\bnullreference/,
    /\btypeerror\b/,
    /\bsyntaxerror\b/,
    /\broot\s+cause\b/,
    /\bnot\s+working\b/,
    /\bwhy\s+is\s+it\b/
  ];
  const implSignals = [
    /\bimplement(ed|ation|ing)?\b/,
    /\bcreate(d|s)?\b/,
    /\bbuild(ing)?\b/,
    /\badd(ed|ing)?\b/,
    /\bfeature\b/,
    /\bpanel\b/,
    /\bplugin\b/,
    /\brefactor(ed|ing)?\b/,
    /\bdesign(ed|ing)?\b/,
    /\bintroduce(d)?\b/
  ];

  let bugScore = 0;
  let implScore = 0;

  for (const rx of bugSignals) {
    if (rx.test(combined)) bugScore += 1;
  }
  for (const rx of implSignals) {
    if (rx.test(combined)) implScore += 1;
  }

  const promptLower = String(userPrompt || "").toLowerCase();
  if (/\b(error|exception|bug|fix|broken|crash|failed|stack\s*trace)\b/.test(promptLower) && !/\bcreate\s+a\b/.test(promptLower)) {
    bugScore += 3;
  }
  if (/\b(create|implement|add|build|design|scaffold)\b/.test(promptLower)) {
    implScore += 3;
  }

  return bugScore > implScore ? "bug" : "implementation";
}

function cleanMarkdownText(raw) {
  return String(raw || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSentences(text, maxSentences = 2) {
  const cleaned = cleanMarkdownText(text);
  if (!cleaned) return "";
  const parts = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 18 && !s.startsWith("http"));
  return parts.slice(0, maxSentences).join(" ");
}

function slugify(text) {
  return String(text || "lesson")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "vibe-lesson";
}

export function synthesizeHeuristicDebrief({
  workspaceRoot,
  userPrompt,
  assistantMessage,
  touchedFiles = [],
  lastCommandExitZero = null,
  persona = "vibe-mentor",
  forcedType = null,
  ste100Enabled = true
}) {
  const projectName = basename(workspaceRoot || process.cwd());
  const responseType = forcedType || detectResponseType(userPrompt, assistantMessage);
  const personaObj = PERSONAS.find((p) => p.id === persona) || PERSONAS[0];
  const classifiedFiles = touchedFiles.map(classifyFileRole);
  const fileNamesList = classifiedFiles.map((f) => f.shortName).slice(0, 4).join(", ");

  const firstSentences = extractSentences(assistantMessage, 2);
  const promptSnippet = extractSentences(userPrompt, 1) || "Your latest request";

  const hasTestsOrVerify =
    /\b(test(s)?\s+pass|verified|succeeded|build\s+succeeded|0\s+error|complete(d)?)\b/i.test(assistantMessage || "") ||
    lastCommandExitZero === true;
  const hasFailureSignal =
    /\b(failed|blocker|unable\s+to|error\s+occurred|could\s+not)\b/i.test(assistantMessage || "") &&
    !hasTestsOrVerify;

  const succeededStatus = hasFailureSignal ? "no" : hasTestsOrVerify || classifiedFiles.length > 0 ? "yes" : "partial";

  const polish = (txt) => (ste100Enabled ? applySte100Polish(txt) : String(txt || "").trim());

  const tldrHeadline = polish(
    responseType === "bug"
      ? `Bug Fix: ${extractSentences(assistantMessage, 1) || "Found the root cause and applied a targeted fix."}`
      : `Built: ${extractSentences(assistantMessage, 1) || "Added the requested feature with minimal complexity."}`
  );

  const realWorldAnalogy = polish(
    responseType === "bug"
      ? `${personaObj.analogyPrefix} Instead of rebuilding the whole engine for one warning light, we traced the loose wire${fileNamesList ? ` (${fileNamesList})` : ""}, fixed the link, and checked the output.`
      : `${personaObj.analogyPrefix} This adds a clean plug-in module${fileNamesList ? ` (${fileNamesList})` : ""} without tangling your existing wiring.`
  );

  const visualFlow =
    responseType === "bug"
      ? [
          { step: "1", icon: "🔴", title: "Root Cause", subtitle: classifiedFiles[0]?.shortName || "Trigger found", status: "done" },
          { step: "2", icon: "🛠️", title: "Fix Plan", subtitle: classifiedFiles.length ? `${classifiedFiles.length} file(s) patched` : "Targeted patch", status: "done" },
          {
            step: "3",
            icon: succeededStatus === "yes" ? "✅" : succeededStatus === "no" ? "❌" : "⚠️",
            title: succeededStatus === "yes" ? "Fix Succeeded" : succeededStatus === "no" ? "Needs Fix" : "Verify Fix",
            subtitle: succeededStatus === "yes" ? "Checks clean" : "Review edge cases",
            status: succeededStatus === "yes" ? "done" : "warning"
          },
          { step: "4", icon: "🧠", title: "Verify & Save", subtitle: "Audit + Memory", status: "active" }
        ]
      : [
          { step: "1", icon: "🎯", title: "Goal", subtitle: promptSnippet.slice(0, 32) + (promptSnippet.length > 32 ? "…" : ""), status: "done" },
          { step: "2", icon: "🧭", title: "Plan & Why", subtitle: "Simple, modular path", status: "done" },
          { step: "3", icon: "🏆", title: "Result", subtitle: classifiedFiles.length ? `${classifiedFiles.length} file(s) updated` : "Delivered", status: "done" },
          { step: "4", icon: "🌊", title: "Verify & Save", subtitle: "Audit + Memory", status: "active" }
        ];

  const bugReport = {
    cause: polish(
      extractTaggedSection(assistantMessage, ["cause", "root cause", "why it failed", "problem"]) ||
        firstSentences ||
        `Triggered during: "${promptSnippet}". Runtime state did not match what the code expected.`
    ),
    plan: polish(
      extractTaggedSection(assistantMessage, ["plan", "fix", "solution", "resolution", "approach"]) ||
        (classifiedFiles.length
          ? `Patch ${classifiedFiles.map((f) => `${f.shortName} (${f.role})`).join(", ")} directly and keep neighboring behavior intact.`
          : "Isolate the failing check, patch the mismatch, and test the path.")
    ),
    succeeded: succeededStatus,
    successSummary: polish(
      succeededStatus === "yes"
        ? `Yes — Applied the fix${classifiedFiles.length ? ` across ${classifiedFiles.length} file(s)` : ""} with no blocking errors.`
        : succeededStatus === "no"
        ? "Not yet — A blocker or failing check still needs attention."
        : "Patch drafted — Run a quick test to confirm the fix."
    ),
    consequences: polish(
      extractTaggedSection(assistantMessage, ["consequence", "impact", "side effect", "watch out"]) ||
        (classifiedFiles.length
          ? `Updates ${fileNamesList}. Callers now get consistent state without crashing.`
          : "Safe local fix with no breaking changes to other modules.")
    )
  };

  const implementationReport = {
    objective: polish(
      extractTaggedSection(assistantMessage, ["purpose", "objective", "goal", "mission"]) ||
        `Build the requested feature for ${projectName}: "${promptSnippet.slice(0, 140)}".`
    ),
    planAndWhy: polish(
      extractTaggedSection(assistantMessage, ["plan", "why", "approach", "architecture", "resolution"]) ||
        `Structured across ${classifiedFiles.length || "modular"} piece(s)${fileNamesList ? ` (${fileNamesList})` : ""} to stay decoupled and easy to debug.`
    ),
    result: polish(
      extractTaggedSection(assistantMessage, ["result", "outcome", "delivered", "implemented", "summary"]) ||
        firstSentences ||
        (classifiedFiles.length
          ? `Updated ${classifiedFiles.length} file(s): ${classifiedFiles.map((f) => f.shortName).join(", ")}.`
          : "Completed the requested implementation.")
    ),
    consequences: polish(
      extractTaggedSection(assistantMessage, ["consequence", "impact", "next", "note"]) ||
        (classifiedFiles.length
          ? `Touches ${fileNamesList} in ${projectName}. Existing workflows stay intact.`
          : "Zero breaking changes to existing project code.")
    )
  };

  const defaultLessonTitle =
    responseType === "bug"
      ? `Check ${classifiedFiles[0]?.shortName || "runtime"} state early`
      : `Keep ${classifiedFiles[0]?.shortName || projectName} modules focused`;

  const extractedLesson = extractTaggedSection(assistantMessage, ["lesson", "takeaway", "remember", "rule"]);

  const lessonsLearned = [
    {
      id: `lesson-${Date.now()}`,
      slug: slugify(extractedLesson || defaultLessonTitle),
      title: polish(extractedLesson ? extractedLesson.slice(0, 72) : defaultLessonTitle),
      summary: polish(
        extractedLesson ||
          (responseType === "bug"
            ? `Verify state assumptions in ${fileNamesList || "this flow"} upfront so mismatches fail fast.`
            : `Keep UI state separate from core logic in ${fileNamesList || projectName} for faster edits.`)
      ),
      why:
        responseType === "bug"
          ? "Stops the same bug class from returning across projects."
          : "Lets future AI edits change one piece without breaking others.",
      howToApply:
        responseType === "bug"
          ? `Check ${fileNamesList || "the affected module"} inputs and run a smoke test after edits.`
          : `Reuse the same pattern from ${fileNamesList || "this turn"} on similar features.`,
      memoryType: responseType === "bug" ? "feedback" : "project",
      confirmed: false
    }
  ];

  const baseDebrief = {
    id: `debrief-${Date.now()}`,
    createdAt: new Date().toISOString(),
    responseType,
    persona,
    tldrHeadline,
    realWorldAnalogy,
    visualFlow,
    bugReport,
    implementationReport,
    lessonsLearned,
    touchedFiles: classifiedFiles
  };

  return ensureDebriefEnriched(baseDebrief, {
    lastUserPrompt: userPrompt,
    lastAssistantMessage: assistantMessage,
    lastCommandExitZero
  });
}

function extractTaggedSection(text, keywords) {
  if (!text) return "";
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lower = line.toLowerCase();
    for (const kw of keywords) {
      if (
        lower.startsWith(`**${kw}`) ||
        lower.startsWith(`### ${kw}`) ||
        lower.startsWith(`## ${kw}`) ||
        lower.startsWith(`- **${kw}`) ||
        lower.startsWith(`${kw}:`)
      ) {
        const inline = line.replace(/^[-*#\s]*\*\*[^*]+\*\*[:\s-]*/i, "").replace(/^[^:]+:\s*/, "").trim();
        if (inline.length > 20) return cleanMarkdownText(inline);
        const nextLines = lines
          .slice(i + 1, i + 4)
          .map((l) => l.trim())
          .filter(Boolean)
          .join(" ");
        if (nextLines.length > 15) return cleanMarkdownText(nextLines);
      }
    }
  }
  return "";
}

// ============================================================================
// RUNG 3: Standalone Discardable HTML Artifact Generator
// ============================================================================

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateStandaloneHtmlArtifact(panelState) {
  const d = ensureDebriefEnriched(panelState?.currentDebrief || createWelcomeDebrief(panelState?.projectName || "Workspace"), panelState);
  const isBug = d.responseType === "bug";
  const personaObj = PERSONAS.find((p) => p.id === (d.persona || panelState?.activePersona)) || PERSONAS[0];
  const metrics = d.ste100Metrics || computeSte100Metrics(d);
  const diagram = d.diagram || buildDefaultDiagram(d);
  const scenes = Array.isArray(d.explainerScenes) ? d.explainerScenes : [];
  const scriptText = buildPlainTextScript(scenes);
  const payloadJson = JSON.stringify({
    diagram,
    scenes,
    touchedFiles: d.touchedFiles || []
  }).replace(/</g, "\\u003c");

  const cardData = isBug
    ? [
        { k: "1. What Was the Cause?", v: d.bugReport?.cause || "N/A", cls: "cause" },
        { k: "2. Fix Plan", v: d.bugReport?.plan || "N/A", cls: "plan" },
        { k: `3. Did It Succeed? (${String(d.bugReport?.succeeded || "yes").toUpperCase()})`, v: d.bugReport?.successSummary || "N/A", cls: "result" },
        { k: "4. Consequences", v: d.bugReport?.consequences || "N/A", cls: "impact" }
      ]
    : [
        { k: "1. Objective & Why It Matters", v: d.implementationReport?.objective || "N/A", cls: "plan" },
        { k: "2. Plan & Why This Way", v: d.implementationReport?.planAndWhy || "N/A", cls: "why" },
        { k: "3. Result", v: d.implementationReport?.result || "N/A", cls: "result" },
        { k: "4. Consequences", v: d.implementationReport?.consequences || "N/A", cls: "impact" }
      ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Vibe Debrief Artifact · ${escapeHtml(panelState?.projectName || "Workspace")}</title>
  <style>
    :root { --bg:#0b0f17; --card:#131a26; --panel:#182030; --border:#2a354b; --text:#f0f6fc; --muted:#9ba7b8; --accent:#38bdf8; --ok:#34d399; --warn:#fbbf24; --bad:#fb7185; --purple:#a78bfa; }
    * { box-sizing:border-box; }
    body { margin:0; padding:24px; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif; line-height:1.55; }
    .wrap { max-width:960px; margin:0 auto; }
    .hero { background:linear-gradient(145deg,var(--card),var(--panel)); border:1px solid var(--border); border-radius:14px; padding:20px; margin-bottom:16px; }
    .pills { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; font-size:12px; font-weight:700; }
    .pill { padding:3px 10px; border-radius:999px; border:1px solid var(--border); background:var(--bg); }
    .pill.bug { color:var(--bad); border-color:rgba(251,113,133,.4); }
    .pill.impl { color:var(--accent); border-color:rgba(56,189,248,.4); }
    .pill.ste { color:var(--ok); border-color:rgba(52,211,153,.4); }
    h1 { margin:0 0 10px; font-size:20px; }
    .analogy { border-left:3px solid var(--warn); background:var(--bg); padding:10px 14px; border-radius:8px; color:var(--muted); }
    .box { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:14px; }
    .grid2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px; margin-bottom:14px; }
    .card { background:var(--card); border:1px solid var(--border); border-left:4px solid var(--accent); border-radius:10px; padding:14px; }
    .card.cause { border-left-color:var(--bad); }
    .card.why { border-left-color:var(--purple); }
    .card.result { border-left-color:var(--ok); }
    .card.impact { border-left-color:var(--warn); }
    .card h3 { margin:0 0 8px; font-size:14px; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    .chip { font-size:11.5px; padding:4px 9px; border-radius:6px; border:1px solid var(--border); background:var(--bg); cursor:pointer; color:var(--text); }
    .chip.high { border-color:var(--bad); }
    .chip.medium { border-color:var(--warn); }
    .inspector { margin-top:10px; padding:8px 12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); font-size:12.5px; color:var(--muted); }
    .chk-row { display:flex; align-items:flex-start; gap:8px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,.05); }
    .chk-row:last-child { border-bottom:none; }
    .btn { border:1px solid var(--border); background:var(--panel); color:var(--text); border-radius:7px; padding:6px 12px; font-weight:700; cursor:pointer; }
    .btn:hover { border-color:var(--accent); }
    pre { background:var(--bg); border:1px solid var(--border); padding:12px; border-radius:8px; white-space:pre-wrap; font-size:12.5px; color:var(--muted); }
    svg { width:100%; height:auto; display:block; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="pills">
      <span class="pill ${isBug ? "bug" : "impl"}">${isBug ? "🐛 BUG / ERROR FIX" : "🚀 IMPLEMENTATION"}</span>
      <span class="pill">${escapeHtml(personaObj.badge)}</span>
      <span class="pill ste">📖 ~${metrics.estimatedReadSeconds}s · ${escapeHtml(metrics.grade)} (${metrics.score}%)</span>
      <span class="pill">${d.complexity?.level === "complex" ? "🧩 Complex Workflow" : "⚡ Focused Turn"}</span>
    </div>
    <h1>${escapeHtml(d.tldrHeadline)}</h1>
    <div class="analogy"><strong>💡 Picture It Like This:</strong> ${escapeHtml(d.realWorldAnalogy)}</div>
  </div>

  <div class="box">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <strong>🗺️ ${escapeHtml(diagram.title || "Architecture & Flow Diagram")}</strong>
      <span style="font-size:12px;color:var(--muted)">Click any node to inspect file & risk</span>
    </div>
    <svg id="diagramSvg" viewBox="0 0 880 210"></svg>
    <div class="chips" id="fileChips"></div>
    <div class="inspector" id="nodeInspector">Click a diagram node or file chip to inspect its role and risk level.</div>
  </div>

  <div class="grid2">
    ${cardData
      .map(
        (c) => `<div class="card ${c.cls}"><h3>${escapeHtml(c.k)}</h3><div>${escapeHtml(c.v)}</div></div>`
      )
      .join("\n    ")}
  </div>

  <div class="grid2">
    <div class="box">
      <h3 style="margin:0 0 8px;">🔍 Ground-Truth Proof & Watch Out</h3>
      ${(d.proofClaims || [])
        .map((p) => `<div style="margin-bottom:6px;font-size:13px;">${p.status === "verified" ? "✅" : p.status === "unverified" ? "❌" : "ℹ️"} <strong>${escapeHtml(p.claim)}</strong> <span style="color:var(--muted)">(${escapeHtml(p.evidence)})</span></div>`)
        .join("")}
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">
      ${(d.uncertaintyAudit || [])
        .map((u) => `<div style="margin-bottom:6px;font-size:13px;">⚠️ <strong>[${escapeHtml(String(u.riskLevel || "med").toUpperCase())}] ${escapeHtml(u.area)}:</strong> <span style="color:var(--muted)">${escapeHtml(u.reason)}</span></div>`)
        .join("")}
    </div>
    <div class="box">
      <h3 style="margin:0 0 8px;">☑️ Human Verification Checklist</h3>
      ${(d.verificationChecklist || [])
        .map(
          (c) => `<label class="chk-row"><input type="checkbox" ${c.checked ? "checked" : ""} /><span><strong>${escapeHtml(c.text)}</strong> <span style="color:var(--muted);font-size:12px;">(${escapeHtml(c.source)})</span></span></label>`
        )
        .join("")}
    </div>
  </div>

  ${
    scenes.length > 0
      ? `<div class="box">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <strong>🎬 Complex-Workflow Animated Explainer</strong>
      <div style="display:flex;gap:6px;">
        <button class="btn" id="btnPlayScene">▶ Play</button>
        <button class="btn" id="btnPauseScene">⏸ Pause</button>
      </div>
    </div>
    <canvas id="sceneCanvas" width="880" height="230" style="width:100%;background:#070b12;border-radius:10px;border:1px solid var(--border);"></canvas>
    <div id="sceneCaption" style="margin-top:8px;font-weight:600;"></div>
    <details style="margin-top:10px;"><summary style="cursor:pointer;color:var(--accent);font-weight:700;">📄 Plain-Text Narration Script (Verify Claims)</summary><pre>${escapeHtml(scriptText)}</pre></details>
  </div>`
      : ""
  }
</div>
<script>
(function(){
  var DATA = ${payloadJson};
  var svg = document.getElementById("diagramSvg");
  var inspector = document.getElementById("nodeInspector");
  var chipsEl = document.getElementById("fileChips");
  var nodes = DATA.diagram.nodes || [];
  var edges = DATA.diagram.edges || [];
  var cols = Math.max(1, nodes.length);
  var w = 880, pad = 24, gap = 24;
  var boxW = Math.min(185, Math.floor((w - pad*2 - gap*(cols-1)) / cols));
  var totalW = boxW * cols + gap * (cols - 1);
  var startX = Math.floor((w - totalW) / 2);
  var pos = {};
  function esc(v){
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  var html = '<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/></marker></defs>';
  nodes.forEach(function(n, i){
    pos[n.id] = { x: startX + i*(boxW+gap), y: 58, w: boxW, h: 86 };
  });
  edges.forEach(function(e){
    var a = pos[e.from], b = pos[e.to];
    if(!a || !b) return;
    var x1 = a.x + a.w, y1 = a.y + a.h/2, x2 = b.x - 4, y2 = b.y + b.h/2;
    var mx = (x1+x2)/2;
    html += '<path d="M '+x1+' '+y1+' L '+x2+' '+y2+'" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr)"/>';
    html += '<circle cx="'+mx+'" cy="'+(y1-16)+'" r="10" fill="#182030" stroke="#38bdf8"/>';
    html += '<text x="'+mx+'" y="'+(y1-12)+'" text-anchor="middle" fill="#f0f6fc" font-size="11" font-weight="700">'+esc(e.stepNumber)+'</text>';
  });
  nodes.forEach(function(n){
    var p = pos[n.id];
    var stroke = n.risk === "high" ? "#fb7185" : n.risk === "medium" ? "#fbbf24" : "#34d399";
    html += '<g class="dnode" data-id="'+esc(n.id)+'" style="cursor:pointer">';
    html += '<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="10" fill="#131a26" stroke="'+stroke+'" stroke-width="2"/>';
    html += '<text x="'+(p.x+10)+'" y="'+(p.y+26)+'" fill="#f0f6fc" font-size="12.5" font-weight="700">'+esc((n.label||"").slice(0,22))+'</text>';
    html += '<text x="'+(p.x+10)+'" y="'+(p.y+46)+'" fill="#9ba7b8" font-size="11">'+esc((n.sublabel||"").slice(0,26))+'</text>';
    html += '<text x="'+(p.x+10)+'" y="'+(p.y+68)+'" fill="'+stroke+'" font-size="10" font-weight="700">'+esc((n.risk||"low").toUpperCase())+' · '+esc(n.role||"")+'</text>';
    html += '</g>';
  });
  svg.innerHTML = html;
  function inspectNode(n){
    inspector.textContent = (n.label || "") + " — Role: " + (n.role || "Step") + " · Risk: " + (n.risk || "low").toUpperCase() + (n.file ? " · File: " + n.file : "");
  }
  svg.querySelectorAll(".dnode").forEach(function(g){
    g.addEventListener("click", function(){
      var id = g.getAttribute("data-id");
      var found = nodes.find(function(x){ return x.id === id; });
      if(found) inspectNode(found);
    });
  });
  (DATA.touchedFiles || []).forEach(function(f){
    var btn = document.createElement("button");
    btn.className = "chip " + (f.risk || "low");
    btn.textContent = (f.icon || "📄") + " " + f.shortName + " · " + (f.risk || "low").toUpperCase();
    btn.onclick = function(){ inspector.textContent = f.path + " — " + f.role + " (" + (f.intent || f.risk) + ")"; };
    chipsEl.appendChild(btn);
  });
  var scenes = DATA.scenes || [];
  var canvas = document.getElementById("sceneCanvas");
  if(canvas && scenes.length){
    var ctx = canvas.getContext("2d"), idx = 0, playing = false, t = 0, raf = null;
    var cap = document.getElementById("sceneCaption");
    function drawFrame(){
      ctx.clearRect(0,0,880,230);
      ctx.strokeStyle = "rgba(56,189,248,0.08)";
      for(var gx=0;gx<880;gx+=40){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,230); ctx.stroke(); }
      for(var gy=0;gy<230;gy+=40){ ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(880,gy); ctx.stroke(); }
      var sc = scenes[idx] || scenes[0];
      var hi = new Set(sc.highlightNodeIds || []);
      nodes.forEach(function(n, i){
        var nx = 60 + i * (760 / Math.max(1, nodes.length)), ny = 75, nw = 150, nh = 70;
        var active = hi.has(n.id);
        ctx.fillStyle = active ? "rgba(56,189,248,0.22)" : "#131a26";
        ctx.strokeStyle = active ? "#38bdf8" : "#2a354b";
        ctx.lineWidth = active ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f0f6fc"; ctx.font = "bold 13px sans-serif";
        ctx.fillText((n.label||"").slice(0,18), nx+12, ny+28);
        ctx.fillStyle = "#9ba7b8"; ctx.font = "11px sans-serif";
        ctx.fillText((n.sublabel||"").slice(0,22), nx+12, ny+48);
        if(i < nodes.length - 1){
          var pulseX = nx + nw + ((t % 60)/60) * ((760 / Math.max(1, nodes.length)) - nw);
          ctx.fillStyle = "#38bdf8"; ctx.beginPath(); ctx.arc(pulseX, ny + nh/2, 4, 0, Math.PI*2); ctx.fill();
        }
      });
      ctx.fillStyle = "#fbbf24"; ctx.font = "bold 14px sans-serif";
      ctx.fillText(sc.title || "", 28, 34);
      cap.textContent = sc.narration || "";
    }
    function tick(){
      t++;
      if(playing && t % 240 === 0){ idx = (idx + 1) % scenes.length; }
      drawFrame();
      if(playing) raf = requestAnimationFrame(tick);
    }
    drawFrame();
    document.getElementById("btnPlayScene").onclick = function(){ if(!playing){ playing = true; tick(); } };
    document.getElementById("btnPauseScene").onclick = function(){ playing = false; if(raf) cancelAnimationFrame(raf); };
  }
})();
</script>
</body>
</html>`;
}

export function saveStandaloneHtmlArtifact(workspaceRoot, panelState) {
  const html = generateStandaloneHtmlArtifact(panelState);
  const outDir = process.env.ZCODE_VISUALIZATION_DIR || join(workspaceRoot, ".zcode", "vibe-debrief-artifacts");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `vibe-debrief-${stamp}.html`;
  const filePath = join(outDir, fileName);
  writeFileSync(filePath, html, "utf8");
  return { filePath, fileName, bytes: Buffer.byteLength(html, "utf8") };
}

// ============================================================================
// ZCode Memory Persistence & Lightweight Gemini Model Discovery
// ============================================================================

export function resolveZCodeMemoryDirectory(workspaceRoot) {
  const home = getZCodeHomeDir();
  const projectsMemRoot = join(home, ".zcode", "cli", "memories", "projects");
  const wsSlug = basename(workspaceRoot || process.cwd())
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");

  try {
    if (existsSync(projectsMemRoot)) {
      const dirs = readdirSync(projectsMemRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      const exactOrPrefix = dirs.find(
        (name) => name.toLowerCase() === wsSlug || name.toLowerCase().startsWith(`${wsSlug}-`)
      );
      if (exactOrPrefix) {
        const memDir = join(projectsMemRoot, exactOrPrefix, "memory");
        mkdirSync(memDir, { recursive: true });
        return memDir;
      }
    }
  } catch {
    // fallback below
  }

  const fallbackDir = join(projectsMemRoot, wsSlug, "memory");
  try {
    mkdirSync(fallbackDir, { recursive: true });
    return fallbackDir;
  } catch {
    const localFallback = join(workspaceRoot, ".zcode", "memory");
    mkdirSync(localFallback, { recursive: true });
    return localFallback;
  }
}

export function listZCodeMemories(workspaceRoot) {
  const memDir = resolveZCodeMemoryDirectory(workspaceRoot);
  const memoryIndexPath = join(memDir, "MEMORY.md");
  let indexContent = "";
  try {
    if (existsSync(memoryIndexPath)) {
      indexContent = readFileSync(memoryIndexPath, "utf8");
    }
  } catch {}
  return {
    memoryDir: memDir,
    memoryIndexPath,
    indexContent
  };
}

export function confirmAndSaveLessonToZCodeMemory(workspaceRoot, lessonInput) {
  const memDir = resolveZCodeMemoryDirectory(workspaceRoot);
  const slug = slugify(lessonInput.slug || lessonInput.title || "vibe-lesson");
  const fileName = `${slug}.md`;
  const filePath = join(memDir, fileName);
  const memoryIndexPath = join(memDir, "MEMORY.md");

  const title = applySte100Polish(String(lessonInput.title || "Confirmed Vibe Lesson").trim());
  const summary = applySte100Polish(String(lessonInput.summary || title).trim());
  const why = applySte100Polish(
    String(
      lessonInput.why || "Prevents repeat mistakes and keeps multi-project vibe coding fast."
    ).trim()
  );
  const howToApply = applySte100Polish(
    String(
      lessonInput.howToApply || "Apply this rule automatically on related code or similar bugs."
    ).trim()
  );
  const memType = lessonInput.memoryType === "project" ? "project" : "feedback";

  const markdownFileContent = [
    "---",
    `name: ${slug}`,
    `description: ${title.replace(/:/g, " -")}`,
    "metadata:",
    `  type: ${memType}`,
    "---",
    "",
    summary,
    "",
    `**Why:** ${why}`,
    `**How to apply:** ${howToApply}`,
    ""
  ].join("\n");

  mkdirSync(memDir, { recursive: true });
  writeFileSync(filePath, markdownFileContent, "utf8");

  const pointerLine = `- [${title}](${fileName}) — ${summary.slice(0, 110)}${summary.length > 110 ? "…" : ""}`;
  let existingIndex = "";
  if (existsSync(memoryIndexPath)) {
    try {
      existingIndex = readFileSync(memoryIndexPath, "utf8");
    } catch {}
  }

  const lines = existingIndex
    .split(/\r?\n/)
    .filter((line) => !line.includes(`(${fileName})`));

  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  lines.push(pointerLine);
  writeFileSync(memoryIndexPath, lines.join("\n") + "\n", "utf8");

  const state = loadPersistedState(workspaceRoot);
  const currentDebrief = state.currentDebrief || {};
  const existingLessons = Array.isArray(currentDebrief.lessonsLearned) ? currentDebrief.lessonsLearned : [];
  let matched = false;
  const updatedLessons = existingLessons.map((l) => {
    if (l.id === lessonInput.id || l.slug === slug) {
      matched = true;
      return { ...l, slug, title, summary, why, howToApply, confirmed: true, savedMemoryPath: filePath };
    }
    return l;
  });
  if (!matched) {
    updatedLessons.unshift({
      id: lessonInput.id || `lesson-${Date.now()}`,
      slug,
      title,
      summary,
      why,
      howToApply,
      memoryType: memType,
      confirmed: true,
      savedMemoryPath: filePath
    });
  }

  const confirmedRecord = {
    id: lessonInput.id || `confirmed-${Date.now()}`,
    slug,
    title,
    summary,
    why,
    howToApply,
    memoryType: memType,
    savedMemoryPath: filePath,
    memoryIndexPath,
    confirmedAt: new Date().toISOString()
  };

  const prevConfirmed = (state.confirmedLessons || []).filter((c) => c.slug !== slug);
  savePersistedState(workspaceRoot, {
    currentDebrief: {
      ...currentDebrief,
      lessonsLearned: updatedLessons
    },
    confirmedLessons: [confirmedRecord, ...prevConfirmed].slice(0, 50)
  });

  return confirmedRecord;
}

export function discoverLightweightGeminiModels() {
  const zcodeV2Dir = join(getZCodeHomeDir(), ".zcode", "v2");
  const providerCfgPath = join(zcodeV2Dir, "provider_config.json");
  const settingPath = join(zcodeV2Dir, "setting.json");
  const credsPath = join(zcodeV2Dir, "credentials.json");

  const readJson = (p) => {
    try {
      return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
    } catch {
      return {};
    }
  };

  const personalCfg = readJson(providerCfgPath);
  const settingCfg = readJson(settingPath);
  const credsCfg = readJson(credsPath);
  const discovered = [];
  const seen = new Set();

  const addCandidate = (providerId, modelId, providerName) => {
    const fullId = `${providerId}/${modelId}`;
    if (seen.has(fullId)) return;
    if (!/gemini/i.test(modelId)) return;
    if (/image/i.test(modelId)) return;
    seen.add(fullId);

    const low = modelId.toLowerCase();
    let score = 0;
    if (/gemini-4-argon$/i.test(low) || /gemini-3\.8-flash$/i.test(low)) score += 10;
    else if (/argon|flash/i.test(low) && !/lite|xhigh|high/i.test(low)) score += 8;
    else if (/argon-medium|flash-medium/i.test(low)) score += 7;
    else if (/argon|flash/i.test(low)) score += 5;
    else if (/hydrogen$/i.test(low) || /hydrogen-medium$/i.test(low)) score += 3;
    if (/xhigh|max|lite/i.test(low)) score -= 3;

    discovered.push({
      id: fullId,
      modelId,
      providerId,
      providerName: providerName || providerId,
      score
    });
  };

  const subInfo = credsCfg?.subscriptionInfo || {};
  for (const sub of settingCfg?.subscriptions || []) {
    if (sub?.enabled === false) continue;
    const pid = `account:${sub.id}`;
    const models = subInfo?.[sub.id]?.models || [];
    for (const m of models) {
      const mid = typeof m === "string" ? m : m?.id;
      if (mid) addCandidate(pid, mid, sub.name || sub.id);
    }
  }

  const personalProviderRules = personalCfg?.config?.providerConfigRules?.providerRules || [];
  const personalModelRules = [
    ...(personalCfg?.config?.modelConfigRules?.providerModelRules || []),
    ...(personalCfg?.config?.modelConfigRules?.manualProviderModelRules || [])
  ];

  for (const pr of personalProviderRules) {
    const pid = pr.providerId;
    const pConfig = pr.config || {};
    if (pr.enabled === false || pConfig.enabled === false || pConfig.visibility === "hidden") continue;
    if (pConfig.access?.type === "api-key" && !String(pConfig.access?.apiKey || "").trim()) continue;
    const mids = [
      ...(pConfig.modelOrder || []),
      ...(pConfig.personalModelIds || []),
      ...(pConfig.builtinModelIds || []),
      ...personalModelRules.filter((m) => m.providerId === pid).map((m) => m.modelId)
    ];
    for (const mid of mids) {
      if (mid) addCandidate(pid, mid, pr.providerName || pid);
    }
  }

  discovered.sort((a, b) => b.score - a.score);
  return discovered;
}

export function buildFullPanelState(workspaceRoot) {
  const state = loadPersistedState(workspaceRoot);
  const memInfo = listZCodeMemories(workspaceRoot);
  const geminiModels = discoverLightweightGeminiModels();
  const recommendedGeminiModel = geminiModels[0]?.id || "new-provider/gemini-3.8-flash";
  const currentDebrief = ensureDebriefEnriched(
    state.currentDebrief || createWelcomeDebrief(basename(workspaceRoot), state.activePersona),
    state
  );

  return {
    projectName: state.projectName || basename(workspaceRoot),
    workspaceRoot,
    activePersona: state.activePersona || "vibe-mentor",
    ste100Enabled: state.ste100Enabled !== false,
    turnCount: state.turnCount || 0,
    personas: PERSONAS,
    recommendedGeminiModel,
    lightweightGeminiModels: geminiModels.slice(0, 8),
    lastUserPrompt: state.lastUserPrompt || "",
    lastAssistantMessage: state.lastAssistantMessage || "",
    currentDebrief,
    plainTextScript: buildPlainTextScript(currentDebrief.explainerScenes || []),
    history: (state.history || []).slice(0, 15).map((h) => ensureDebriefEnriched(h, state)),
    confirmedLessons: state.confirmedLessons || [],
    zcodeMemory: memInfo,
    updatedAt: state.updatedAt
  };
}
