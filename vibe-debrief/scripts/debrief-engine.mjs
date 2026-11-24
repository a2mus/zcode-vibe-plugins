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
    language: "en",
    preferredModel: "auto-cheapest",
    themePreference: "auto",
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

export function createWelcomeDebrief(projectName, personaId) {
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
  return ensureDebriefEnriched(base, { projectName, activePersona: personaId });
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
      status: ["done", "active", "pending", "warning"].includes(n.status) ? n.status : "done",
      ...(n.techLabel ? { techLabel: String(n.techLabel) } : {}),
      ...(n.lane ? { lane: String(n.lane) } : {}),
      ...(n.branch ? { branch: String(n.branch) } : {})
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
            risk: ["low", "medium", "high"].includes(e.risk) ? e.risk : "low",
            ...(e.techLabel ? { techLabel: String(e.techLabel) } : {}),
            ...(e.animated !== undefined ? { animated: Boolean(e.animated) } : {})
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

    const grammar = explicitDiagram.grammar || explicitDiagram.diagramType || (isBug ? "cause-effect" : "architecture");
    const diagramType = explicitDiagram.diagramType || explicitDiagram.grammar || (isBug ? "cause-effect" : "architecture");
    const title = explicitDiagram.title || (isBug ? "Root Cause to Fix Verification" : "Component & Data Flow");
    const techTitle = explicitDiagram.techTitle || title;
    const viewBoxWidth = Number(explicitDiagram.viewBoxWidth) || 460;
    const groups = Array.isArray(explicitDiagram.groups) ? explicitDiagram.groups : [];

    return {
      grammar,
      diagramType,
      title,
      techTitle,
      viewBoxWidth,
      groups,
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

    const grammar = isBug ? "cause-effect" : "architecture";
    const title = isBug ? "Bug Cause → Patched Files → Outcome" : "Goal → Changed Components → Result";
    return {
      grammar,
      diagramType: grammar,
      title,
      techTitle: title,
      viewBoxWidth: 460,
      groups: [],
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

  const fallbackGrammar = isBug ? "cause-effect" : "state-flow";
  const fallbackTitle = isBug ? "Cause-to-Fix Flow Diagram" : "Implementation Flow Diagram";
  return {
    grammar: fallbackGrammar,
    diagramType: fallbackGrammar,
    title: fallbackTitle,
    techTitle: fallbackTitle,
    viewBoxWidth: 460,
    groups: [],
    nodes,
    edges
  };
}

// ============================================================================
// Story 5.2 (AD-14): 5-Grammar diagramSpec Normalizer & Lane-Safe Edge Synthesis
// ============================================================================

export const VALID_DIAGRAM_GRAMMARS = Object.freeze([
  "sequence",
  "flow-diff",
  "subway-map",
  "before-after",
  "decision-tree"
]);

// Deterministic 4-to-5 mapping: legacy v0.2.0/v0.3.0 diagramType -> OQ-5 grammar.
const LEGACY_GRAMMAR_MAP = Object.freeze({
  sequence: "sequence",
  "state-flow": "flow-diff",
  "cause-effect": "before-after",
  architecture: "subway-map"
});

export function resolveDiagramGrammar(diagram, choices = []) {
  const rawGrammar = String(diagram?.grammar || "");
  const rawType = String(diagram?.diagramType || "");
  // Rule 1: two or more choices (or an explicit decision-tree) always win.
  if ((Array.isArray(choices) && choices.length >= 2) || rawGrammar === "decision-tree" || rawType === "decision-tree") {
    return "decision-tree";
  }
  // Rules 2-5: an explicit OQ-5 grammar is kept; legacy types map deterministically.
  // Object.hasOwn guards against prototype-chain keys ("constructor", "toString",
  // "__proto__") so the resolved grammar is always one of the 5 valid strings.
  if (VALID_DIAGRAM_GRAMMARS.includes(rawGrammar)) return rawGrammar;
  if (VALID_DIAGRAM_GRAMMARS.includes(rawType)) return rawType;
  if (Object.hasOwn(LEGACY_GRAMMAR_MAP, rawType)) return LEGACY_GRAMMAR_MAP[rawType];
  if (Object.hasOwn(LEGACY_GRAMMAR_MAP, rawGrammar)) return LEGACY_GRAMMAR_MAP[rawGrammar];
  return "subway-map";
}

// Auto-synthesized edges chain nodes sequentially. In "before-after" grammar the
// chain stays inside each lane: the last "before" node never bridges into the
// first "after" node (AD-14 lane-safe edge synthesis).
export function synthesizeLaneSafeEdges(nodes, grammar = "sequence") {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  if (safeNodes.length < 2) return [];

  const chain = (laneNodes) =>
    laneNodes.slice(0, -1).map((node, idx) => ({
      from: node.id,
      to: laneNodes[idx + 1].id,
      label: "Flows to",
      risk: laneNodes[idx + 1].risk || "low",
      animated: false
    }));

  if (grammar === "before-after") {
    const beforeNodes = safeNodes.filter((n) => String(n.lane || "") === "before");
    const afterNodes = safeNodes.filter((n) => String(n.lane || "") === "after");
    const otherNodes = safeNodes.filter((n) => !["before", "after"].includes(String(n.lane || "")));
    return [...chain(beforeNodes), ...chain(afterNodes), ...chain(otherNodes)];
  }

  return chain(safeNodes);
}

export function normalizeDiagramSpec(diagram, { choices = [] } = {}) {
  const source = diagram && typeof diagram === "object" ? diagram : {};
  const grammar = resolveDiagramGrammar(source, choices);
  const title = String(source.title || "Component & Data Flow");
  const techTitle = String(source.techTitle || title);

  const nodes = (Array.isArray(source.nodes) ? source.nodes : []).slice(0, 6).map((n, idx) => ({
    id: String(n.id || `n${idx + 1}`),
    label: String(n.label || `Step ${idx + 1}`).slice(0, 32),
    sublabel: String(n.sublabel || "").slice(0, 40),
    role: String(n.role || "Component"),
    file: String(n.file || ""),
    risk: ["low", "medium", "high"].includes(n.risk) ? n.risk : "low",
    status: ["done", "active", "pending", "warning"].includes(n.status) ? n.status : "done",
    ...(n.techLabel ? { techLabel: String(n.techLabel) } : {}),
    ...(n.lane ? { lane: String(n.lane) } : {}),
    ...(n.branch ? { branch: String(n.branch) } : {})
  }));

  const groups = (Array.isArray(source.groups) ? source.groups : []).map((g, idx) => ({
    id: String(g?.id || `g${idx + 1}`),
    label: String(g?.label || `Group ${idx + 1}`),
    lane: String(g?.lane || "")
  }));

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let edges = (Array.isArray(source.edges) ? source.edges : [])
    .filter((e) => e && nodeById.has(String(e.from)) && nodeById.has(String(e.to)))
    .map((e) => ({
      from: String(e.from),
      to: String(e.to),
      label: String(e.label || "Flows to").slice(0, 30),
      risk: ["low", "medium", "high"].includes(e.risk) ? e.risk : "low",
      ...(e.techLabel ? { techLabel: String(e.techLabel) } : {}),
      animated: Boolean(e.animated)
    }));

  if (grammar === "before-after") {
    // Lane safety: drop any edge that bridges the before lane and the after lane.
    edges = edges.filter((e) => {
      const fromLane = nodeById.get(e.from)?.lane || "";
      const toLane = nodeById.get(e.to)?.lane || "";
      const crossesLanes =
        (fromLane === "before" && toLane === "after") || (fromLane === "after" && toLane === "before");
      return !crossesLanes;
    });
  }

  if (edges.length === 0 && nodes.length > 1) {
    edges = synthesizeLaneSafeEdges(nodes, grammar);
  }

  edges = edges.map((e, idx) => ({ ...e, stepNumber: idx + 1 }));

  return {
    grammar,
    diagramType: grammar,
    title,
    techTitle,
    viewBoxWidth: 460,
    groups,
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

export function slugify(text) {
  return String(text || "lesson")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "vibe-lesson";
}

export const VALID_VERDICTS = Object.freeze(["Solved", "Built", "Explained", "Blocked", "Planned"]);
export const VALID_WAITING_STATES = Object.freeze(["choice", "action", "reply", "blocked", "none"]);
export const VALID_MICRO_BLOCKS = Object.freeze(["unclear", "choices", "diagram", "proof-audit", "concepts", "lessons"]);
export const VALID_TARGET_PLUGINS = Object.freeze(["excalidraw", "visualize", "vectorcraft", "designcraft"]);
export const VALID_MICRO_TYPES = Object.freeze(["loop-3node", "pipeline-3node", "split-compare"]);

export function normalizeVerdict(verdict, debrief = {}) {
  if (typeof verdict === "string" && VALID_VERDICTS.includes(verdict)) {
    return verdict;
  }
  if (debrief.responseType === "bug") {
    return debrief.bugReport?.succeeded === "no" ? "Blocked" : "Solved";
  }
  return "Built";
}

export function normalizeChoices(choices) {
  if (!Array.isArray(choices)) return [];
  return choices.map((c, idx) => ({
    id: String(c.id || `choice-${c.key || idx + 1}`),
    key: String(c.key || String.fromCharCode(65 + idx)),
    title: String(c.title || `Option ${c.key || idx + 1}`),
    plainSubtext: String(c.plainSubtext || ""),
    techSubtext: String(c.techSubtext || ""),
    messagePrompt: String(c.messagePrompt || `Let's proceed with Option ${c.key || idx + 1}: ${c.title || ""}`.trim()),
    picked: Boolean(c.picked),
    tradeOffs: Array.isArray(c.tradeOffs)
      ? c.tradeOffs.map((t) => ({
          label: String(t.label || ""),
          score: Math.min(100, Math.max(0, Number(t.score) || 0))
        }))
      : []
  }));
}

const DEFAULT_WAITING_LABELS = Object.freeze({
  choice: "Pick a Choice",
  action: "Verify / Run",
  reply: "Answer Question",
  blocked: "Blocked",
  none: "All Clear"
});

export function normalizeWaitingOnYou(waitingOnYou, { choices = [], verdict = "Built", debrief = {}, state = {} } = {}) {
  let waitingState = VALID_WAITING_STATES.includes(waitingOnYou?.state)
    ? waitingOnYou.state
    : choices.length > 0
    ? "choice"
    : verdict === "Blocked"
    ? "blocked"
    : (debrief.proofClaims || []).some((p) => p.status === "unverified")
    ? "action"
    : "none";

  const label = String(waitingOnYou?.label || DEFAULT_WAITING_LABELS[waitingState] || "All Clear");
  const prompt = String(
    waitingOnYou?.prompt ||
      (waitingState === "choice"
        ? `Choose from ${choices.length} option(s) to proceed.`
        : waitingState === "blocked"
        ? debrief.bugReport?.cause || "Investigation required before next action."
        : waitingState === "action"
        ? "Verify the latest changes or run suggested checks."
        : waitingState === "reply"
        ? "Clarification requested before continuing."
        : "All changes verified. Ready for next task.")
  );
  const allowInlineReply = waitingOnYou?.allowInlineReply !== undefined
    ? Boolean(waitingOnYou.allowInlineReply)
    : waitingState === "reply";

  let chips = Array.isArray(waitingOnYou?.chips)
    ? waitingOnYou.chips.slice(0, 4).map((chip, idx) => ({
        id: String(chip.id || `act-${idx + 1}`),
        key: String(chip.key || idx + 1),
        label: String(chip.label || "Action"),
        techLabel: String(chip.techLabel || ""),
        messagePrompt: String(chip.messagePrompt || chip.label || ""),
        primary: Boolean(chip.primary)
      }))
    : [];

  if (chips.length === 0 && waitingState === "choice" && choices.length > 0) {
    chips = choices.slice(0, 4).map((c, idx) => ({
      id: `choice-${c.key || c.id}`,
      key: String(c.key || idx + 1),
      label: c.title || `Option ${c.key}`,
      techLabel: c.techSubtext || "",
      messagePrompt: c.messagePrompt || `Option ${c.key}: ${c.title}`,
      primary: idx === 0
    }));
  }

  return {
    state: waitingState,
    label,
    prompt,
    allowInlineReply,
    chips
  };
}

export function normalizeXray(xray, debrief = {}, state = {}) {
  const isBug = debrief.responseType === "bug";
  const defaultPlainBullets = isBug
    ? [debrief.bugReport?.cause, debrief.bugReport?.plan, debrief.bugReport?.successSummary].filter(Boolean)
    : [debrief.implementationReport?.objective, debrief.implementationReport?.planAndWhy, debrief.implementationReport?.result].filter(Boolean);
  if (defaultPlainBullets.length === 0) {
    defaultPlainBullets.push(debrief.realWorldAnalogy || debrief.tldrHeadline || "Ready to verify.");
  }

  const touchedFiles = Array.isArray(debrief.touchedFiles) ? debrief.touchedFiles : [];
  const defaultPaths = touchedFiles
    .map((f) => (typeof f === "string" ? f : f?.path || f?.file || f?.shortName))
    .filter(Boolean);

  const defaultSymbols = touchedFiles
    .map((f) => (typeof f === "object" ? f?.shortName : String(f).split(/[/\\]/).pop()))
    .filter(Boolean);

  const defaultTechBullets = isBug
    ? [
        debrief.bugReport?.cause ? `Root cause: ${debrief.bugReport.cause}` : "",
        debrief.bugReport?.plan ? `Fix: ${debrief.bugReport.plan}` : "",
        debrief.bugReport?.successSummary ? `Status: ${debrief.bugReport.successSummary}` : ""
      ].filter(Boolean)
    : [
        debrief.implementationReport?.objective ? `Objective: ${debrief.implementationReport.objective}` : "",
        debrief.implementationReport?.planAndWhy ? `Plan: ${debrief.implementationReport.planAndWhy}` : "",
        debrief.implementationReport?.result ? `Result: ${debrief.implementationReport.result}` : ""
      ].filter(Boolean);
  if (defaultTechBullets.length === 0) {
    defaultTechBullets.push(debrief.tldrHeadline || "Changes applied.");
  }

  const proofClaims = Array.isArray(debrief.proofClaims) ? debrief.proofClaims : [];
  const defaultProofLines = proofClaims.map((p) => `${p.claim} (${p.evidence})`);

  const plainHeadline = String(xray?.plain?.headline || debrief.tldrHeadline || "");
  const plainSummary = Array.isArray(xray?.plain?.summaryBullets)
    ? xray.plain.summaryBullets.map(String)
    : defaultPlainBullets;

  const techHeadline = String(xray?.tech?.headline || debrief.tldrHeadline || "");
  const techSummary = Array.isArray(xray?.tech?.summaryBullets)
    ? xray.tech.summaryBullets.map(String)
    : defaultTechBullets;
  const symbols = Array.isArray(xray?.tech?.symbols)
    ? xray.tech.symbols.map(String)
    : defaultSymbols;
  const paths = Array.isArray(xray?.tech?.paths)
    ? xray.tech.paths.map(String)
    : defaultPaths;
  const commands = Array.isArray(xray?.tech?.commands)
    ? xray.tech.commands.map(String)
    : [];
  const exitCodes = Array.isArray(xray?.tech?.exitCodes)
    ? xray.tech.exitCodes.map(Number)
    : state.lastCommandExitZero !== undefined && state.lastCommandExitZero !== null
    ? [state.lastCommandExitZero ? 0 : 1]
    : [];
  const proofLines = Array.isArray(xray?.tech?.proofLines)
    ? xray.tech.proofLines.map(String)
    : defaultProofLines;

  return {
    plain: {
      headline: plainHeadline,
      summaryBullets: plainSummary
    },
    tech: {
      headline: techHeadline,
      summaryBullets: techSummary,
      symbols,
      paths,
      commands,
      exitCodes,
      proofLines
    }
  };
}

export function normalizeConcepts(concepts) {
  if (!Array.isArray(concepts)) return [];
  return concepts.slice(0, 6).map((c, idx) => {
    const slug = String(c.slug || slugify(c.label || `concept-${idx + 1}`));
    const label = String(c.label || "Concept");
    const techSymbol = String(c.techSymbol || "");
    const targetPlugin = VALID_TARGET_PLUGINS.includes(c.targetPlugin) ? c.targetPlugin : "visualize";
    const microType = VALID_MICRO_TYPES.includes(c.stage1?.microVisualSpec?.type)
      ? c.stage1.microVisualSpec.type
      : "pipeline-3node";
    const microNodes = Array.isArray(c.stage1?.microVisualSpec?.nodes)
      ? c.stage1.microVisualSpec.nodes.map(String).slice(0, 3)
      : ["Input", "Process", "Output"];

    return {
      slug,
      label,
      techSymbol,
      targetPlugin,
      stage1: {
        definition: String(c.stage1?.definition || ""),
        analogy: String(c.stage1?.analogy || ""),
        microVisualSpec: {
          type: microType,
          nodes: microNodes
        }
      },
      stage2: {
        howItWorks: String(c.stage2?.howItWorks || ""),
        keyTradeOff: String(c.stage2?.keyTradeOff || ""),
        inYourCodebase: String(c.stage2?.inYourCodebase || "")
      },
      stage2Prompt: String(c.stage2Prompt || "")
    };
  });
}

export function normalizeMicroBlocks(microBlocks, context = {}) {
  if (Array.isArray(microBlocks) && microBlocks.length > 0) {
    const filtered = microBlocks.filter((b) => VALID_MICRO_BLOCKS.includes(b));
    if (filtered.length > 0) return filtered;
  }
  const blocks = [];
  if ((typeof context.heuristicConfidence === "number" && context.heuristicConfidence < 0.55) || Boolean(context.rawQuote)) {
    blocks.push("unclear");
  }
  if (Array.isArray(context.choices) && context.choices.length > 0) {
    blocks.push("choices");
  }
  blocks.push("diagram");
  blocks.push("proof-audit");
  if (Array.isArray(context.concepts) && context.concepts.length > 0) {
    blocks.push("concepts");
  }
  if (Array.isArray(context.lessonsLearned) && context.lessonsLearned.length > 0) {
    blocks.push("lessons");
  }
  return blocks;
}

export function normalizeHeuristicConfidence(confidence, debrief = {}, state = {}) {
  if (typeof confidence === "number" && !Number.isNaN(confidence)) {
    return Math.max(0, Math.min(1, confidence));
  }
  if (debrief.bugReport?.succeeded === "no" || state.lastCommandExitZero === false) {
    return 0.45;
  }
  if (debrief.bugReport?.succeeded === "partial") {
    return 0.65;
  }
  return 0.9;
}

export function ensureDebriefEnriched(debrief, state = {}) {
  if (!debrief) {
    debrief = createWelcomeDebrief(state?.projectName || "Workspace", state?.activePersona);
  }

  const touched = (Array.isArray(debrief.touchedFiles) ? debrief.touchedFiles : [])
    .slice(0, STATE_COLLECTION_LIMITS.recentTouchedFiles)
    .map((f) => (typeof f === "string" ? classifyFileRole(f) : f));

  const choices = normalizeChoices(debrief.choices);

  const rawDiagram = debrief.diagramSpec || debrief.diagram;
  const diagram = buildDefaultDiagram(debrief, rawDiagram);
  // Keep explicit spec metadata even when nodes were auto-synthesized
  // (buildDefaultDiagram ignores metadata on node-less specs).
  if (rawDiagram && typeof rawDiagram === "object") {
    if (rawDiagram.grammar) diagram.grammar = rawDiagram.grammar;
    if (rawDiagram.diagramType) diagram.diagramType = rawDiagram.diagramType;
    if (rawDiagram.title) diagram.title = rawDiagram.title;
    if (rawDiagram.techTitle) diagram.techTitle = rawDiagram.techTitle;
    if (Array.isArray(rawDiagram.groups) && rawDiagram.groups.length > 0) diagram.groups = rawDiagram.groups;
  }

  // AD-14: normalize to the 5-grammar OQ-5 spec. diagramSpec is the sync alias
  // of debrief.diagram so v0.2.0/v0.3.0 callers read the exact same object.
  const diagramSpec = normalizeDiagramSpec(diagram, { choices });
  Object.assign(diagram, diagramSpec);

  const hasExplicitScenes = Array.isArray(debrief.explainerScenes) && debrief.explainerScenes.length > 0;
  const complexity =
    debrief.complexity ||
    assessWorkflowComplexity({
      touchedFiles: touched,
      diagram,
      assistantMessage: state.lastAssistantMessage || "",
      userPrompt: state.lastUserPrompt || "",
      complexityOverride: debrief.complexityOverride || (hasExplicitScenes ? "complex" : null)
    });

  const defaults = buildDefaultVerificationData(debrief, touched, state.lastCommandExitZero ?? null);
  const proofClaims =
    Array.isArray(debrief.proofClaims) && debrief.proofClaims.length > 0
      ? debrief.proofClaims.slice(0, 3).map((p) => ({
          claim: String(p.claim || ""),
          evidence: String(p.evidence || "Verified"),
          status: ["verified", "inferred", "unverified"].includes(p.status) ? p.status : "verified",
          ...(p.detail ? { detail: String(p.detail) } : {})
        }))
      : defaults.proofClaims;

  const uncertaintyAudit =
    Array.isArray(debrief.uncertaintyAudit) && debrief.uncertaintyAudit.length > 0
      ? debrief.uncertaintyAudit.slice(0, 3).map((u) => ({
          area: String(u.area || "Assumption"),
          reason: String(u.reason || ""),
          riskLevel: ["low", "medium", "high"].includes(u.riskLevel) ? u.riskLevel : "medium"
        }))
      : defaults.uncertaintyAudit;

  const verificationChecklist =
    Array.isArray(debrief.verificationChecklist) && debrief.verificationChecklist.length > 0
      ? debrief.verificationChecklist.slice(0, 4).map((c, idx) => ({
          id: c.id || `chk-${Date.now()}-${idx}`,
          text: String(c.text || ""),
          source: String(c.source || "Manual check"),
          risk: ["low", "medium", "high"].includes(c.risk) ? c.risk : "low",
          checked: Boolean(c.checked)
        }))
      : defaults.verificationChecklist;

  let explainerScenes = [];
  if (complexity.level === "complex") {
    explainerScenes =
      hasExplicitScenes
        ? debrief.explainerScenes.map((s, idx) => ({
            id: s.id || `scene-${idx + 1}`,
            durationSec: Number(s.durationSec || 7),
            title: String(s.title || `Scene ${idx + 1}`),
            visualType: s.visualType || "pulse-flow",
            highlightNodeIds: Array.isArray(s.highlightNodeIds) ? s.highlightNodeIds : [],
            callout: String(s.callout || ""),
            narration: String(s.narration || "")
          }))
        : buildExplainerScenesIfComplex({ ...debrief, diagram, uncertaintyAudit }, complexity, false);
  }

  const verdict = normalizeVerdict(debrief.verdict, debrief);
  const waitingOnYou = normalizeWaitingOnYou(debrief.waitingOnYou, {
    choices,
    verdict,
    debrief,
    state
  });
  const xray = normalizeXray(debrief.xray, { ...debrief, touchedFiles: touched, proofClaims }, state);
  const concepts = normalizeConcepts(debrief.concepts);
  const heuristicConfidence = normalizeHeuristicConfidence(debrief.heuristicConfidence, debrief, state);
  const rawQuote = debrief.rawQuote ? String(debrief.rawQuote).slice(0, 280) : "";
  const minimalMode = debrief.minimalMode !== undefined ? Boolean(debrief.minimalMode) : false;
  const lessonsLearned = Array.isArray(debrief.lessonsLearned) ? debrief.lessonsLearned : [];
  const microBlocks = normalizeMicroBlocks(debrief.microBlocks, {
    heuristicConfidence,
    rawQuote,
    choices,
    concepts,
    lessonsLearned
  });

  const enriched = {
    ...debrief,
    touchedFiles: touched,
    diagram,
    diagramSpec,
    complexity,
    proofClaims,
    uncertaintyAudit,
    verificationChecklist,
    explainerScenes,
    verdict,
    waitingOnYou,
    choices,
    xray,
    microBlocks,
    concepts,
    minimalMode,
    heuristicConfidence,
    rawQuote
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

// ----------------------------------------------------------------------------
// Story 6.3 — X-Ray dual-coding helpers (Plain STE-80 <-> Tech).
// The panel pre-binds both representations and swaps them with CSS only; the
// standalone HTML export (Story 6.6) reuses this exact markup contract, and
// Story 6.4 reuses collectXrayTechTokens() for the SVG node inspector.
// Raw X-Ray text is escaped BEFORE any .sym badge wrapping (C8). Tokens are
// matched against the already-escaped string, so a token can never re-match
// inside badge markup that a previous pass produced.
// ----------------------------------------------------------------------------
function clipXrayHeadline(rawText, maxWords = 0) {
  const text = String(rawText ?? "").trim();
  const limit = Number(maxWords) || 0;
  if (limit <= 0) return text;
  const words = text.split(/\s+/);
  if (words.length <= limit) return text;
  return `${words.slice(0, limit).join(" ")}…`;
}

function escapeRegExpLiteral(text) {
  return String(text ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Collect the technical tokens that become .sym badges in Tech mode.
 * Sources: the OQ-5 xray.tech payload (symbols, paths, commands, exit codes)
 * plus the turn's touched files, so Tech stays useful on older payloads.
 */
export function collectXrayTechTokens(debrief = {}) {
  const source = debrief && typeof debrief === "object" ? debrief : {};
  const tech = source.xray && typeof source.xray === "object" ? source.xray.tech || {} : {};
  const tokens = [];
  for (const key of ["symbols", "paths", "commands"]) {
    if (!Array.isArray(tech[key])) continue;
    for (const value of tech[key]) tokens.push(String(value || ""));
  }
  if (Array.isArray(tech.exitCodes)) {
    for (const code of tech.exitCodes) tokens.push(`exit ${code}`);
  }
  if (Array.isArray(source.touchedFiles)) {
    for (const file of source.touchedFiles) {
      if (typeof file === "string") tokens.push(file);
      else if (file && typeof file === "object") tokens.push(file.path || file.file || file.shortName || "");
    }
  }
  return Array.from(new Set(tokens.map((token) => token.trim()).filter((token) => token.length >= 2)));
}

/**
 * Tech representation: escape the raw string first, then wrap the already
 * escaped technical tokens in <span class="sym"> badges (C8).
 */
export function renderXrayTechHtml(rawText, tokens = [], { maxWords = 0 } = {}) {
  const safe = escapeHtml(clipXrayHeadline(rawText, maxWords));
  const escapedTokens = Array.from(
    new Set(
      (Array.isArray(tokens) ? tokens : [])
        .map((token) => String(token || "").trim())
        .filter((token) => token.length >= 2)
        .map((token) => escapeHtml(token))
    )
  ).sort((a, b) => b.length - a.length);
  if (!safe || escapedTokens.length === 0) return safe;
  const pattern = new RegExp(`(${escapedTokens.map(escapeRegExpLiteral).join("|")})`, "g");
  let html = "";
  let lastIndex = 0;
  for (const match of safe.matchAll(pattern)) {
    html += safe.slice(lastIndex, match.index);
    html += `<span class="sym">${match[0]}</span>`;
    lastIndex = match.index + match[0].length;
  }
  return html + safe.slice(lastIndex);
}

/**
 * Pre-bind both representations into one markup string. `tech` falls back to
 * `plain` so Tech mode is never blank on legacy payloads. The result keeps the
 * panel's .xray-dual / .xray-plain / .xray-tech contract so the HTML export can
 * reuse the same CSS-only swap.
 */
export function buildXrayDualCodedMarkup({ plain = "", tech = "", tokens = [], maxWords = 0 } = {}) {
  const plainRaw = String(plain ?? "").trim();
  const techRaw = String(tech ?? "").trim() || plainRaw;
  return (
    `<span class="xray-dual">` +
    `<span class="xray-plain">${escapeHtml(clipXrayHeadline(plainRaw, maxWords))}</span>` +
    `<span class="xray-tech">${renderXrayTechHtml(techRaw, tokens, { maxWords })}</span>` +
    `</span>`
  );
}

const EXPORT_GRAMMAR_LABELS = Object.freeze({
  sequence: "Sequence",
  "flow-diff": "FlowDiff",
  "subway-map": "Subway Map",
  "before-after": "Before → After",
  "decision-tree": "Decision Tree"
});

const EXPORT_WAITING_ICONS = Object.freeze({
  choice: "🗳️",
  action: "⚡",
  reply: "💬",
  blocked: "⛔",
  none: "✅"
});

// Story 7.3 — display labels for the Stage 2 missing-plugin HTML fallback.
const EXPORT_PLUGIN_LABELS = Object.freeze({
  excalidraw: "Excalidraw",
  visualize: "Interactive Gen UI",
  vectorcraft: "VectorCraft",
  designcraft: "DesignCraft"
});

/**
 * Story 7.3 (AD-17) — resolve the 3-column Stage 2 deep explanation content.
 * A matched concept's `stage2` wins; when `conceptSlug` is null (powerup-dock
 * fallback) or unmatched, synthesize from the debrief's plan/result/consequences
 * summary at zero LLM cost. Every column always carries a readable sentence.
 */
export function buildStage2FallbackColumns(debrief, concept = null) {
  const d = debrief || {};
  const isBug = d.responseType === "bug";
  const report = isBug ? d.bugReport || {} : d.implementationReport || {};
  const planText = String(report.planAndWhy || report.plan || "").trim();
  const resultText = String(report.result || report.successSummary || "").trim();
  const consequencesText = String(report.consequences || "").trim();
  const auditReasons = (Array.isArray(d.uncertaintyAudit) ? d.uncertaintyAudit : [])
    .map((u) => String(u?.reason || "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  const files = (Array.isArray(d.touchedFiles) ? d.touchedFiles : [])
    .map((f) => String(f?.path || f?.file || f || "").trim())
    .filter(Boolean)
    .slice(0, 4);

  const conceptStage2 = concept?.stage2 || {};
  const howItWorks =
    String(conceptStage2.howItWorks || "").trim() ||
    planText ||
    String(d.tldrHeadline || "").trim() ||
    "This turn changed the codebase. Read the plan card below for the step-by-step flow.";
  const keyTradeOff =
    String(conceptStage2.keyTradeOff || "").trim() ||
    consequencesText ||
    auditReasons ||
    "No explicit trade-off was recorded for this turn. Check the Watch Out audit rows below.";
  const inYourCodebase =
    String(conceptStage2.inYourCodebase || "").trim() ||
    (files.length > 0
      ? `Start with these touched files: ${files.join(", ")}. ${resultText}`.trim()
      : resultText || "No files were recorded for this turn. Use the diagram below to locate the change.");

  return { howItWorks, keyTradeOff, inYourCodebase };
}

export function generateStandaloneHtmlArtifact(panelState, options = {}) {
  const d = ensureDebriefEnriched(panelState?.currentDebrief || createWelcomeDebrief(panelState?.projectName || "Workspace"), panelState);
  const isBug = d.responseType === "bug";
  const personaObj = PERSONAS.find((p) => p.id === (d.persona || panelState?.activePersona)) || PERSONAS[0];
  const metrics = d.ste100Metrics || computeSte100Metrics(d);
  const diagram = d.diagram || buildDefaultDiagram(d);
  const grammar = String(diagram.grammar || "subway-map");
  const grammarLabel = EXPORT_GRAMMAR_LABELS[grammar] || "Subway Map";
  const scenes = Array.isArray(d.explainerScenes) ? d.explainerScenes : [];
  const scriptText = buildPlainTextScript(scenes);
  const xrayTokens = collectXrayTechTokens(d);
  const choices = Array.isArray(d.choices) ? d.choices : [];
  const microBlocks = Array.isArray(d.microBlocks) ? d.microBlocks : [];
  const lessons = Array.isArray(d.lessonsLearned) ? d.lessonsLearned : [];
  const proofs = Array.isArray(d.proofClaims) ? d.proofClaims : [];
  const checks = Array.isArray(d.verificationChecklist) ? d.verificationChecklist : [];
  const verifiedCount = proofs.filter((p) => p.status === "verified").length;
  const unverifiedCount = proofs.filter((p) => p.status === "unverified").length;
  const checksLeft = checks.filter((c) => !c.checked).length;
  const verdict = d.verdict || (isBug ? "Solved" : "Built");
  const waiting = d.waitingOnYou && typeof d.waitingOnYou === "object"
    ? d.waitingOnYou
    : { state: "none", label: "All Clear", prompt: "", chips: [] };
  const waitingState = ["choice", "action", "reply", "blocked", "none"].includes(waiting.state) ? waiting.state : "none";
  const waitingChips = waitingState === "none" ? [] : Array.isArray(waiting.chips) ? waiting.chips : [];
  const techProofLines = Array.isArray(d.xray?.tech?.proofLines) ? d.xray.tech.proofLines.map(String) : [];

  // Story 6.6 — the DATA payload carries the 5-grammar diagram spec (with
  // techTitle/groups/techLabel nodes), the Canvas tour scenes, touched files,
  // and the waiting strip so every export interaction stays local: zero RPC,
  // zero external URLs. `<` stays escaped as \u003c (C8/XSS contract).
  const payloadJson = JSON.stringify({
    diagram,
    scenes,
    touchedFiles: d.touchedFiles || [],
    waiting
  }).replace(/</g, "\\u003c");

  // Dual-coded X-Ray helper — the same buildXrayDualCodedMarkup contract the
  // panel binds live (Story 6.3), pre-bound here so the export toggle is a
  // single body[data-xray-mode] attribute write.
  const dual = (plain, tech, maxWords = 0) =>
    buildXrayDualCodedMarkup({ plain, tech, tokens: xrayTokens, maxWords });

  const verdictCls =
    verdict === "Blocked" ? "bug" : verdict === "Solved" || verdict === "Built" ? "ok" : verdict === "Planned" ? "warn" : "impl";
  const verifyCls = unverifiedCount > 0 ? "bug" : checksLeft > 0 ? "warn" : "ok";
  const verifyText =
    unverifiedCount > 0
      ? `${verifiedCount} verified · ${unverifiedCount} unverified`
      : checksLeft > 0
      ? `${verifiedCount} verified · ${checksLeft} check${checksLeft === 1 ? "" : "s"} left`
      : `${verifiedCount} verified`;

  // Story 7.3 (AD-17) — mandatory missing-plugin Stage 2 HTML fallback. When
  // export_html receives { conceptSlug, targetPlugin }, render the stage2-popout
  // shell: header, amber missing-banner + Install CTA, floating telemetry pill,
  // and the 3-column deep explanation grid. Offline artifact: the Install CTA
  // reveals a local note instead of dispatching ui/message (zero RPC, C1/C3).
  const requestedPlugin = String(options?.targetPlugin || "").trim().toLowerCase();
  const stage2TargetPlugin = VALID_TARGET_PLUGINS.includes(requestedPlugin) ? requestedPlugin : null;
  let stage2Markup = "";
  if (stage2TargetPlugin) {
    const conceptSlug = options?.conceptSlug ? String(options.conceptSlug) : null;
    const concepts = Array.isArray(d.concepts) ? d.concepts : [];
    const matchedConcept = conceptSlug ? concepts.find((c) => c.slug === conceptSlug) || null : null;
    const columns = buildStage2FallbackColumns(d, matchedConcept);
    const pluginLabel = EXPORT_PLUGIN_LABELS[stage2TargetPlugin];
    const stage2Title = matchedConcept?.label || d.tldrHeadline || "Stage 2 Deep Dive";
    const stage2Cards = [
      { k: "How It Works", v: columns.howItWorks, cls: "how" },
      { k: "Key Trade-off", v: columns.keyTradeOff, cls: "trade" },
      { k: "In Your Codebase", v: columns.inYourCodebase, cls: "code" }
    ];
    stage2Markup = `
  <section class="stage2-popout" id="stage2Popout" role="region" aria-label="Stage 2 deep dive fallback for ${escapeHtml(pluginLabel)}">
    <div class="stage2-header">
      <h2 class="stage2-title">🔬 ${escapeHtml(stage2Title)}</h2>
      <span class="pill target-tag">${escapeHtml(pluginLabel)}</span>
      <span class="pill warn">Built-in HTML fallback</span>
    </div>
    <div class="missing-banner" id="missingBanner" role="status" aria-live="polite">
      <span class="missing-text">⚠️ <strong>${escapeHtml(pluginLabel)}</strong> is not installed. This 3-column explainer is your built-in Stage 2 fallback.</span>
      <button class="btn install-cta" id="btnInstallPluginExport" type="button" aria-label="Install ${escapeHtml(stage2TargetPlugin)} plugin">Install ${escapeHtml(stage2TargetPlugin)}</button>
      <span class="install-offline-note" id="installOfflineNote" hidden>Offline export — install ${escapeHtml(stage2TargetPlugin)} from the live panel or the ZCode plugin marketplace.</span>
    </div>
    <div class="stage2-stage">
      <span class="telemetry-pill" id="stage2TelemetryPill" role="status" aria-label="Export telemetry">${escapeHtml(verdict)} · ${escapeHtml(verifyText)} · 📖 ~${metrics.estimatedReadSeconds}s · STE-80 ${metrics.score}%</span>
      <div class="stage2-deep-grid">
      ${stage2Cards
        .map(
          (c) => `<div class="stage2-deep-card ${c.cls}"><h3>${escapeHtml(c.k)}</h3><div>${escapeHtml(c.v)}</div></div>`
        )
        .join("\n      ")}
      </div>
    </div>
  </section>
`;
  }

  const timestamp = d.createdAt
    ? new Date(d.createdAt).toISOString().slice(11, 16)
    : "Latest Turn";

  // Story 6.2 — Waiting On You strip (5 states). Offline export: chips select
  // locally and surface the prompt to send from the live panel; no ui/message.
  const waitingChipsMarkup = waitingChips
    .map((chip) => {
      const labelMarkup = dual(chip.label, chip.techLabel || chip.label);
      return `<button class="action-chip ${chip.primary ? "primary" : ""}" type="button" data-chip-id="${escapeHtml(chip.id)}" aria-pressed="false" title="${escapeHtml(chip.messagePrompt || chip.label)}">${labelMarkup}</button>`;
    })
    .join("\n        ");

  // Story 6.2 — composable choice-grid microBlock (34x4px trade-off bars).
  const choicesMarkup =
    microBlocks.includes("choices") && choices.length > 0
      ? choices
          .map((c) => {
            const plainSub = String(c.plainSubtext || "").trim();
            const techSub = String(c.techSubtext || "").trim() || plainSub;
            const subMarkup = plainSub || techSub ? dual(plainSub, techSub) : "";
            const barsMarkup = Array.isArray(c.tradeOffs) && c.tradeOffs.length
              ? `<div class="tradeoff-bars">${c.tradeOffs
                  .map(
                    (t) =>
                      `<span class="tbar"><span>${escapeHtml(t.label)}</span><span class="tbar-track"><span class="tbar-fill" style="width:${Math.min(100, Math.max(0, Number(t.score) || 0))}%"></span></span></span>`
                  )
                  .join("")}</div>`
              : "";
            const picked = Boolean(c.picked);
            return `<button class="choice-item ${picked ? "picked" : ""}" type="button" data-choice-id="${escapeHtml(c.id)}" data-choice-key="${escapeHtml(c.key)}" aria-pressed="${picked ? "true" : "false"}" aria-label="${escapeHtml(`Option ${c.key}: ${c.title}`)}"><span class="choice-key">${escapeHtml(c.key)}</span><span class="choice-text">${dual(c.title, c.title)}${subMarkup}${barsMarkup}</span></button>`;
          })
          .join("\n    ")
      : "";

  // Story 6.2/6.3 — proof pills (expandable proof-detail) + audit rows.
  const proofPillsMarkup = proofs
    .map((p, idx) => {
      const kind = p.status === "verified" ? "ok" : p.status === "unverified" ? "risk" : "info";
      const icon = p.status === "verified" ? "✅" : p.status === "unverified" ? "❌" : "ℹ️";
      const claimMarkup = dual(p.claim, techProofLines[idx] || (p.evidence ? `${p.claim} · ${p.evidence}` : p.claim));
      return `<button class="proof-pill ${kind}" type="button" data-proof-idx="${idx}" aria-expanded="false" aria-controls="proofDetail-${idx}" title="${escapeHtml(p.evidence || "")}">${icon} ${claimMarkup}</button>`;
    })
    .join("\n      ");

  const proofDetailsMarkup = proofs
    .map((p, idx) => {
      const plainDetail = p.detail || p.evidence || "No additional detail recorded.";
      const techDetail = [p.detail, p.evidence].filter(Boolean).join(" · ") || plainDetail;
      return `<div class="proof-detail" id="proofDetail-${idx}" role="region" aria-label="${escapeHtml(`Proof detail: ${p.claim}`)}">${dual(plainDetail, techDetail)}</div>`;
    })
    .join("\n      ");

  const auditRowsMarkup = (Array.isArray(d.uncertaintyAudit) ? d.uncertaintyAudit : [])
    .map(
      (u) =>
        `<div class="audit-row">⚠️ <strong>[${escapeHtml(String(u.riskLevel || "med").toUpperCase())}] ${escapeHtml(u.area)}:</strong> <span class="muted">${escapeHtml(u.reason)}</span></div>`
    )
    .join("\n      ");

  // Story 6.6 — lessons microBlock (static, no RPC needed offline).
  const lessonsMarkup =
    microBlocks.includes("lessons") && lessons.length > 0
      ? `<div class="box micro-block">
    <h3 style="margin:0 0 8px;">📚 Lessons Learned</h3>
    ${lessons
      .map(
        (l) =>
          `<div style="margin-bottom:8px;font-size:13px;">📖 <strong>${escapeHtml(l.title)}</strong><br><span class="muted">${escapeHtml(l.summary)}</span></div>`
      )
      .join("\n    ")}
  </div>`
      : "";

  // Story 6.5 — Canvas tour scene pills (jump to any scene, keyboard via
  // native button semantics).
  const scenePillsMarkup = scenes
    .map(
      (s, idx) =>
        `<button class="scene-pill ${idx === 0 ? "active" : ""}" type="button" data-scene-idx="${idx}" aria-pressed="${idx === 0 ? "true" : "false"}">${escapeHtml(s.title || `Scene ${idx + 1}`)}</button>`
    )
    .join("");

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
    :root {
      /* DESIGN.md Dark HUD tokens */
      --bg-app:#090d13; --bg-surface:#101620; --bg-panel:#121924; --bg-card:#182130; --bg-card-hover:#1e293b; --bg-elevated:#0d131c;
      --border:rgba(148,163,184,0.14); --border-strong:rgba(148,163,184,0.28); --border-subtle:#1e2738;
      --text-primary:#e7edf6; --text-secondary:#9aa9be; --text-muted:#69788e;
      --accent:#38bdf8; --accent-soft:rgba(56,189,248,0.14); --accent-border:rgba(56,189,248,0.36);
      --ok:#34d399; --ok-soft:rgba(52,211,153,0.13); --ok-border:rgba(52,211,153,0.36);
      --warn:#fbbf24; --warn-soft:rgba(251,191,36,0.14); --warn-border:rgba(251,191,36,0.38);
      --risk:#fb7185; --risk-soft:rgba(251,113,133,0.14); --risk-border:rgba(251,113,133,0.38);
      --purple:#a78bfa; --teal:#2dd4bf;
      --text-on-warn:#140d00; --telemetry-pill-bg:#0c111ad6; --grid-dot:#94a3b81f;
      --explainer-stage-bg:#070b12; --canvas-grid-line:rgba(56,189,248,0.08);
      /* Legacy artifact aliases mapped to DESIGN.md tokens */
      --bg:var(--bg-app); --card:var(--bg-card); --panel:var(--bg-panel); --text:var(--text-primary); --muted:var(--text-secondary); --bad:var(--risk);
    }
    @media (prefers-color-scheme: light) {
      :root {
        /* DESIGN.md Field Desk Light tokens */
        --bg-app:#efeae0; --bg-surface:#f7f4ec; --bg-panel:#fbf9f4; --bg-card:#ffffff; --bg-card-hover:#f3efe6; --bg-elevated:#f1ece1;
        --border:rgba(30,41,59,0.12); --border-strong:rgba(30,41,59,0.24); --border-subtle:#e2dcd0;
        --text-primary:#17202e; --text-secondary:#4c5a6d; --text-muted:#768396;
        --accent:#0284c7; --accent-soft:rgba(2,132,199,0.1); --accent-border:rgba(2,132,199,0.34);
        --ok:#059669; --ok-soft:rgba(5,150,105,0.1); --ok-border:rgba(5,150,105,0.34);
        --warn:#b45309; --warn-soft:rgba(217,119,6,0.12); --warn-border:rgba(217,119,6,0.36);
        --risk:#be123c; --risk-soft:rgba(225,29,72,0.1); --risk-border:rgba(225,29,72,0.34);
        --purple:#6d28d9; --teal:#0d9488;
        --text-on-warn:#ffffff; --telemetry-pill-bg:#0c111ad6; --grid-dot:rgba(30,41,59,0.12);
        --explainer-stage-bg:#f1ece1; --canvas-grid-line:rgba(2,132,199,0.08);
      }
      .pill.impl { color:var(--text-primary); background:var(--accent-soft); }
      .pill.ste { color:var(--text-primary); background:var(--ok-soft); }
      .pill.ok { color:var(--text-primary); background:var(--ok-soft); }
      .pill.warn { color:var(--text-primary); background:var(--warn-soft); }
      .script-summary { color:var(--text-primary); }
      /* Story 6.6 — Field Desk Light semantic wash: readable ink over soft
         fills for selected/primary interactive states (panel parity). */
      .action-chip.primary,
      .action-chip.selected,
      .proof-pill.ok,
      .proof-pill.risk,
      .choice-item.picked,
      .xray-toggle[data-mode="tech"],
      .scene-pill.active { color:var(--text-primary); }
    }
    * { box-sizing:border-box; }
    :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition:none !important; animation:none !important; scroll-behavior:auto !important; } }
    .dnode:hover rect, .dnode:focus-visible rect { stroke-width:2.6; }
    .script-summary { cursor:pointer; color:var(--accent); font-weight:700; }
    body { margin:0; padding:24px; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif; line-height:1.55; }
    .wrap { max-width:960px; margin:0 auto; }
    .hero { background:linear-gradient(145deg,var(--card),var(--panel)); border:1px solid var(--border); border-radius:14px; padding:20px; margin-bottom:16px; }
    .pills { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; font-size:12px; font-weight:700; }
    .pill { padding:3px 10px; border-radius:999px; border:1px solid var(--border); background:var(--bg); }
    .pill.bug { color:var(--bad); border-color:var(--risk-border); }
    .pill.impl { color:var(--accent); border-color:var(--accent-border); }
    .pill.ste { color:var(--ok); border-color:var(--ok-border); }
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
    /* Story 7.3 — Stage 2 pop-out fallback shell (DESIGN.md stage2-popout tokens) */
    .stage2-popout { background:var(--bg-surface); border:1px solid var(--border-strong); border-radius:14px; padding:16px; margin-bottom:16px; }
    .stage2-header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:10px 12px; margin-bottom:10px; }
    .stage2-title { margin:0; font-size:17px; flex:1 1 auto; }
    .pill.target-tag { background:var(--purple); color:var(--bg-app); border-color:var(--purple); }
    .missing-banner { display:flex; align-items:center; gap:10px; flex-wrap:wrap; background:var(--warn-soft); border:1px solid var(--warn-border); border-radius:10px; padding:9px 12px; margin-bottom:10px; color:var(--text-primary); font-size:13px; }
    .missing-banner .missing-text { flex:1 1 240px; }
    .missing-banner strong { color:var(--warn); }
    .install-cta { background:var(--warn); color:var(--text-on-warn); border:1px solid var(--warn-border); font-weight:700; }
    .install-offline-note { flex-basis:100%; font-size:12px; color:var(--text-secondary); }
    .stage2-stage { position:relative; background:var(--bg-elevated); background-image:radial-gradient(var(--grid-dot) 1px, transparent 1px); background-size:18px 18px; border:1px solid var(--border); border-radius:10px; padding:34px 12px 12px; min-height:270px; }
    .telemetry-pill { position:absolute; top:8px; right:10px; background:var(--telemetry-pill-bg); color:#e7edf6; border:1px solid var(--border-strong); border-radius:999px; padding:3px 10px; font-size:11px; font-weight:600; }
    .stage2-deep-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    @media (max-width:740px) { .stage2-deep-grid { grid-template-columns:1fr; } }
    .stage2-deep-card { background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px; font-size:13px; color:var(--text-secondary); }
    .stage2-deep-card h3 { margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); }
    .stage2-deep-card.how { border-top:3px solid var(--accent); }
    .stage2-deep-card.trade { border-top:3px solid var(--warn); }
    .stage2-deep-card.code { border-top:3px solid var(--ok); }
    .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    .chip { font-size:11.5px; padding:4px 9px; border-radius:6px; border:1px solid var(--border); background:var(--bg); cursor:pointer; color:var(--text); }
    .chip.high { border-color:var(--bad); }
    .chip.medium { border-color:var(--warn); }
    .chip.selected { border-color:var(--accent); background:var(--accent-soft); }
    .inspector { margin-top:10px; padding:8px 12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); font-size:12.5px; color:var(--muted); }
    .inspector.has-selection { border-color:var(--accent-border); color:var(--text-primary); }
    .chk-row { display:flex; align-items:flex-start; gap:8px; padding:6px 0; border-bottom:1px solid var(--border); cursor:pointer; }
    .chk-row:last-child { border-bottom:none; }
    .chk-row input:checked + span { text-decoration:line-through; color:var(--text-muted); }
    .btn { border:1px solid var(--border); background:var(--panel); color:var(--text); border-radius:7px; padding:6px 12px; font-weight:700; cursor:pointer; }
    .btn:hover { border-color:var(--accent); }
    pre { background:var(--bg); border:1px solid var(--border); padding:12px; border-radius:8px; white-space:pre-wrap; font-size:12.5px; color:var(--muted); }
    svg { width:100%; height:auto; display:block; }
    /* Story 6.3 — X-Ray dual-coding contract (Plain STE-80 <-> Tech).
       The panel and this export share the markup; Story 6.6 adds the local
       toggle button that flips body[data-xray-mode]. */
    .xray-dual > .xray-plain { display:inline; }
    .xray-dual > .xray-tech { display:none; }
    body[data-xray-mode="tech"] .xray-dual > .xray-plain { display:none; }
    body[data-xray-mode="tech"] .xray-dual > .xray-tech { display:inline; }
    .sym { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:0.86em; font-weight:600; padding:1px 5px; border-radius:5px; background:var(--accent-soft); color:var(--accent); border:1px solid var(--accent-border); overflow-wrap:anywhere; }
    /* Story 6.6 — 10s Radar card, local X-Ray toggle & microBlocks parity.
       All colors resolve from the Dark HUD / Field Desk Light tokens above;
       no literal palette values live here (see theme-parity assertions). */
    .radar-card { display:flex; flex-direction:column; gap:8px; }
    .radar-top { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
    .radar-badges { display:flex; flex-wrap:wrap; gap:6px; }
    .pill.ok { color:var(--ok); border-color:var(--ok-border); }
    .pill.warn { color:var(--warn); border-color:var(--warn-border); }
    .pill.grammar { color:var(--accent); border-color:var(--accent-border); }
    .xray-toggle { appearance:none; display:inline-flex; align-items:center; gap:4px; padding:4px 9px; border-radius:999px; border:1px solid var(--border-strong); background:var(--bg-card); font-family:inherit; font-size:11px; font-weight:700; color:var(--text-secondary); cursor:pointer; white-space:nowrap; }
    .xray-toggle:hover { border-color:var(--accent-border); color:var(--text-primary); }
    .xray-toggle[data-mode="tech"] { background:var(--accent-soft); border-color:var(--accent-border); color:var(--accent); }
    .radar-meta-row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .radar-time { font-size:11px; color:var(--text-muted); margin-left:auto; }
    .tldr-headline { font-size:15px; line-height:1.45; word-break:break-word; }
    .wait-strip { border-top:1px solid var(--border); padding-top:8px; display:flex; flex-direction:column; gap:6px; }
    .wait-badge { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:var(--text-primary); }
    .wait-badge.none { color:var(--ok); }
    .wait-badge.blocked { color:var(--risk); }
    .wait-badge.choice, .wait-badge.action, .wait-badge.reply { color:var(--warn); }
    .wait-prompt { font-size:12.5px; color:var(--text-secondary); }
    .wait-chips { display:flex; flex-wrap:wrap; gap:6px; }
    .action-chip { appearance:none; display:inline-flex; align-items:center; gap:5px; padding:5px 9px; border-radius:7px; font-size:11.5px; font-weight:600; border:1px solid var(--border-strong); background:var(--bg-elevated); color:var(--text-primary); cursor:pointer; word-break:break-word; }
    .action-chip:hover { border-color:var(--accent-border); background:var(--accent-soft); color:var(--accent); }
    .action-chip.primary { background:var(--accent-soft); border-color:var(--accent-border); color:var(--accent); }
    .action-chip.selected { background:var(--ok-soft); border-color:var(--ok-border); color:var(--ok); }
    .wait-offline-note { font-size:11.5px; color:var(--text-muted); font-style:italic; }
    .micro-block { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:14px; }
    .block-head { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
    .choice-grid { display:flex; flex-direction:column; gap:6px; }
    .choice-item { appearance:none; display:flex; align-items:flex-start; justify-content:space-between; gap:8px; padding:8px 9px; border-radius:8px; border:1px solid var(--border); background:var(--bg-elevated); text-align:left; cursor:pointer; color:var(--text-primary); word-break:break-word; }
    .choice-item:hover { border-color:var(--accent-border); background:var(--bg-card-hover); }
    .choice-item.picked { border-color:var(--ok-border); background:var(--ok-soft); }
    .choice-key { width:20px; height:20px; border-radius:5px; background:var(--bg-card); border:1px solid var(--border-strong); display:inline-flex; align-items:center; justify-content:center; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:11px; font-weight:700; flex-shrink:0; margin-top:1px; }
    .choice-text { flex:1; min-width:0; font-size:12px; }
    .tradeoff-bars { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
    .tbar { font-size:10px; color:var(--text-muted); display:inline-flex; align-items:center; gap:4px; }
    .tbar-track { width:34px; height:4px; border-radius:99px; background:var(--border); overflow:hidden; display:inline-block; }
    .tbar-fill { height:100%; background:var(--accent); border-radius:99px; display:block; }
    .proof-pill-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
    .proof-pill { appearance:none; display:inline-flex; align-items:center; gap:5px; padding:4px 8px; border-radius:7px; font-size:11px; font-weight:600; border:1px solid var(--border); background:var(--bg-elevated); color:var(--text-secondary); cursor:pointer; word-break:break-word; }
    .proof-pill.ok { color:var(--ok); border-color:var(--ok-border); background:var(--ok-soft); }
    .proof-pill.risk { color:var(--risk); border-color:var(--risk-border); background:var(--risk-soft); }
    .proof-pill.info { color:var(--text-secondary); }
    .proof-detail { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:11px; color:var(--text-secondary); background:var(--bg-elevated); border:1px solid var(--border); border-radius:6px; padding:6px 8px; display:none; white-space:pre-wrap; word-break:break-word; margin-bottom:6px; }
    .proof-detail.open { display:block; }
    .audit-row { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; padding:5px 8px; border-radius:6px; background:var(--bg-elevated); border:1px solid var(--border-subtle); margin-bottom:5px; font-size:11.6px; }
    .scene-pill-row { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:9px; }
    .scene-pill { appearance:none; border:1px solid var(--border); background:var(--bg-panel); color:var(--text-secondary); border-radius:6px; padding:4px 8px; font-size:11px; font-weight:600; cursor:pointer; }
    .scene-pill.active { border-color:var(--accent); background:var(--accent-soft); color:var(--text-primary); }
    .muted { color:var(--muted); }
    /* Story 6.4 — kinetic dash-flow edges (animation disabled by the global
       prefers-reduced-motion rule above). */
    .dash-flow { stroke-dasharray:5 4; animation:flowDash 1.4s linear infinite; }
    @keyframes flowDash { to { stroke-dashoffset:-18; } }
  </style>
</head>
<body data-xray-mode="plain">
<div class="wrap">
  <div class="hero radar-card" role="region" aria-label="10 second radar summary">
    <div class="radar-top">
      <div class="radar-badges">
        <span class="pill ${verdictCls}" id="radarVerdictPill">${escapeHtml(verdict)}</span>
        <span class="pill ${verifyCls}" id="radarVerifyCount">${escapeHtml(verifyText)}</span>
      </div>
      <button class="xray-toggle" id="btnXrayToggle" type="button" data-mode="plain" aria-pressed="false" aria-label="Toggle X-Ray Plain and Technical view" title="Swap Plain STE-80 and Technical symbols locally (no network)">⚡ X-Ray</button>
    </div>
    <h1 class="tldr-headline" id="tldrHeadline">${dual(
      d.xray?.plain?.headline || d.tldrHeadline,
      d.xray?.tech?.headline || d.tldrHeadline,
      14
    )}</h1>
    <div class="radar-meta-row">
      <span class="pill ${isBug ? "bug" : "impl"}" id="activeModePill">${isBug ? "🐛 BUG FIX" : "🚀 IMPLEMENTATION"}</span>
      <span class="pill">${escapeHtml(personaObj.badge)}</span>
      <span class="pill ste">📖 ~${metrics.estimatedReadSeconds}s · ${escapeHtml(metrics.grade)} (${metrics.score}%)</span>
      <span class="pill ${d.complexity?.level === "complex" ? "warn" : ""}">${d.complexity?.level === "complex" ? "🧩 Complex Workflow" : "⚡ Focused Turn"}</span>
      <span class="radar-time">${escapeHtml(timestamp)}</span>
    </div>
    <div class="analogy"><strong>💡 Picture It Like This:</strong> ${escapeHtml(d.realWorldAnalogy)}</div>
    <div class="wait-strip" id="radarWaitingStrip">
      <span class="wait-badge ${waitingState}">${EXPORT_WAITING_ICONS[waitingState]} ${escapeHtml(waiting.label || "All Clear")}</span>
      <div class="wait-prompt" id="waitingPromptText">${dual(waiting.prompt || "All changes verified. Ready for next task.", waiting.prompt || "All changes verified. Ready for next task.")}</div>
      <div class="wait-chips" id="waitingChipsRow">${waitingChipsMarkup}</div>
      <div class="wait-offline-note" id="waitOfflineNote" hidden>Offline export — send replies from the live panel.</div>
    </div>
  </div>
${stage2Markup}
  ${
    choicesMarkup
      ? `<div class="micro-block" id="microBlockChoices">
    <div class="block-head"><strong>🗳️ Waiting On You — Pick a Path</strong><span class="pill" id="choicePickedPill" hidden>Selected</span></div>
    <div class="choice-grid" id="choiceGrid">
    ${choicesMarkup}
    </div>
  </div>`
      : ""
  }

  <div class="box micro-block" id="microBlockDiagram">
    <div class="block-head">
      <strong>🗺️ ${dual(diagram.title || "Architecture & Flow Diagram", diagram.techTitle || diagram.title || "Architecture & Flow Diagram")}</strong>
      <span class="pill grammar">${escapeHtml(grammarLabel)}</span>
    </div>
    <svg id="diagramSvg" viewBox="0 0 460 190" data-grammar="${escapeHtml(grammar)}" role="group" aria-label="${escapeHtml(grammarLabel)} diagram — click or press Enter on a node to inspect it"></svg>
    <div class="chips" id="fileChips"></div>
    <div class="inspector" id="nodeInspector" role="status" aria-live="polite" aria-atomic="true">Click or press Enter on a diagram node or file chip to inspect its role and risk level.</div>
  </div>

  <div class="grid2">
    ${cardData
      .map(
        (c) => `<div class="card ${c.cls}"><h3>${escapeHtml(c.k)}</h3><div>${escapeHtml(c.v)}</div></div>`
      )
      .join("\n    ")}
  </div>

  <div class="grid2">
    <div class="box micro-block" id="microBlockProofAudit">
      <h3 style="margin:0 0 8px;">🔍 Ground-Truth Proof & Watch Out</h3>
      <div class="proof-pill-row" id="proofPillRow">
      ${proofPillsMarkup}
      </div>
      <div id="proofDetailList">
      ${proofDetailsMarkup}
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">
      ${auditRowsMarkup}
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

  ${lessonsMarkup}

  ${
    scenes.length > 0
      ? `<div class="box micro-block" id="explainerStageWrap">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <strong>🎬 ${d.complexity?.level === "complex" ? "Complex-Workflow" : "Anytime"} Animated Explainer</strong>
      <div style="display:flex;gap:6px;">
        <button class="btn" id="btnPlayScene" aria-pressed="false" aria-label="Play animated explainer">▶ Play</button>
        <button class="btn" id="btnPauseScene" aria-pressed="true" aria-label="Pause animated explainer">⏸ Pause</button>
      </div>
    </div>
    <div class="scene-pill-row" id="explainerScenePills" role="group" aria-label="Explainer scenes">${scenePillsMarkup}</div>
    <canvas id="sceneCanvas" width="880" height="230" style="width:100%;background:var(--explainer-stage-bg);border-radius:10px;border:1px solid var(--border);"></canvas>
    <div id="sceneCaption" style="margin-top:8px;font-weight:600;"></div>
    <details style="margin-top:10px;"><summary class="script-summary">📄 Plain-Text Narration Script (Verify Claims)</summary><pre>${escapeHtml(scriptText)}</pre></details>
  </div>`
      : ""
  }
</div>
<script>
(function(){
  var DATA = ${payloadJson};
  var SVG_W = 460;
  var svg = document.getElementById("diagramSvg");
  var inspector = document.getElementById("nodeInspector");
  var chipsEl = document.getElementById("fileChips");
  var nodes = DATA.diagram.nodes || [];
  var edges = DATA.diagram.edges || [];
  var groups = DATA.diagram.groups || [];
  var grammar = String(DATA.diagram.grammar || "subway-map");
  function esc(v){
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function resolveTokens(){
    var cs = null;
    try { cs = getComputedStyle(document.documentElement); } catch (e) {}
    function v(name){
      if (!cs || typeof cs.getPropertyValue !== "function") return "";
      return String(cs.getPropertyValue(name) || "").trim();
    }
    return {
      bgApp: v("--bg-app"), bgCard: v("--bg-card"), bgPanel: v("--bg-panel"), bgElevated: v("--bg-elevated"),
      border: v("--border"), borderStrong: v("--border-strong"), borderSubtle: v("--border-subtle"),
      textPrimary: v("--text-primary"), textSecondary: v("--text-secondary"), textMuted: v("--text-muted"),
      accent: v("--accent"), accentSoft: v("--accent-soft"), accentBorder: v("--accent-border"),
      ok: v("--ok"), okSoft: v("--ok-soft"), okBorder: v("--ok-border"),
      warn: v("--warn"), warnSoft: v("--warn-soft"), warnBorder: v("--warn-border"),
      risk: v("--risk"), riskSoft: v("--risk-soft"), riskBorder: v("--risk-border"),
      explainerStageBg: v("--explainer-stage-bg"), canvasGridLine: v("--canvas-grid-line")
    };
  }
  var selectedNodeId = null;
  var selectedFilePath = null;
  var defaultInspectorText = "Click or press Enter on a diagram node or file chip to inspect its role and risk level.";

  // ---- Story 6.4 / 6.6 — 5-grammar inline SVG builder (panel parity, ES5).
  // All colors resolve from CSS tokens so Dark HUD and Field Desk Light (via
  // prefers-color-scheme) restyle the export without a re-embed. Raw node and
  // edge text is escaped before interpolation (C8). ----
  function nodeRiskColor(n, T){
    if (n.risk === "high") return T.risk;
    if (n.risk === "medium") return T.warn;
    if (n.status === "active") return T.accent;
    return T.ok;
  }
  function edgeColor(e, T, fallback){
    if (e.risk === "high") return T.risk;
    if (e.risk === "medium") return T.warn;
    return fallback || T.accent;
  }
  function arrowMarkerId(e, T, fallback){
    if (e.risk === "high") return "vd-arrow-risk";
    if (e.risk === "medium") return "vd-arrow-warn";
    if (fallback === T.ok) return "vd-arrow-ok";
    return "vd-arrow";
  }
  function defsMarkup(T){
    function marker(id, fill){
      return '<marker id="' + id + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="' + esc(fill) + '" /></marker>';
    }
    return '<defs>' + marker("vd-arrow", T.accent) + marker("vd-arrow-risk", T.risk) + marker("vd-arrow-warn", T.warn) + marker("vd-arrow-ok", T.ok) + '</defs>';
  }
  function stepBadge(mx, my, stepNumber, color, T){
    return '<circle cx="' + mx + '" cy="' + my + '" r="8.5" fill="' + esc(T.bgApp) + '" stroke="' + esc(color) + '" stroke-width="1.5" />' +
      '<text x="' + mx + '" y="' + (my + 3.5) + '" text-anchor="middle" fill="' + esc(T.textPrimary) + '" font-size="9.5" font-weight="800">' + esc(stepNumber) + '</text>';
  }
  function nodeBox(n, p, T, isSelected, opts){
    opts = opts || {};
    var maxTitle = opts.maxTitleChars || 20;
    var maxSub = opts.maxSubChars || 24;
    var titleSize = opts.titleSize || "11";
    var riskColor = nodeRiskColor(n, T);
    var fill = isSelected ? T.accentSoft : T.bgCard;
    var strokeW = isSelected ? "2.4" : "1.5";
    var textX = p.x + (opts.accentLeftBar ? 12 : 9);
    var shortPlain = String(n.label || "").slice(0, maxTitle);
    var shortTech = String(n.techLabel || n.label || "").slice(0, maxTitle);
    var shortSub = String(n.sublabel || n.role || "").slice(0, maxSub);
    var nAria = (n.label || "Node") + " — " + (n.role || "Step") + ", risk " + String(n.risk || "low").toUpperCase() + (n.file ? ", file " + n.file : "");
    var titleMarkup = (n.techLabel && n.techLabel !== n.label)
      ? '<text class="xray-dual" x="' + textX + '" y="' + (p.y + 19) + '" fill="' + esc(T.textPrimary) + '" font-size="' + titleSize + '" font-weight="800"><tspan class="xray-plain">' + esc(shortPlain) + '</tspan><tspan class="xray-tech">' + esc(shortTech) + '</tspan></text>'
      : '<text x="' + textX + '" y="' + (p.y + 19) + '" fill="' + esc(T.textPrimary) + '" font-size="' + titleSize + '" font-weight="800">' + esc(shortPlain) + '</text>';
    var leftBarMarkup = opts.accentLeftBar
      ? '<rect x="' + (p.x + 2.5) + '" y="' + (p.y + 6) + '" width="3.5" height="' + Math.max(12, p.h - 12) + '" rx="2" fill="' + esc(riskColor) + '" />'
      : "";
    var stationDotMarkup = opts.stationDot
      ? '<circle cx="' + (p.x + p.w - 11) + '" cy="' + (p.y + 11) + '" r="3.8" fill="' + esc(T.bgApp) + '" stroke="' + esc(riskColor) + '" stroke-width="1.8" />'
      : "";
    return '<g class="dnode" tabindex="0" role="button" aria-pressed="' + (isSelected ? "true" : "false") + '" aria-label="' + esc(nAria) + '" data-id="' + esc(n.id) + '" style="cursor:pointer">' +
      '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="8" fill="' + esc(fill) + '" stroke="' + esc(riskColor) + '" stroke-width="' + strokeW + '" />' +
      leftBarMarkup + stationDotMarkup + titleMarkup +
      '<text x="' + textX + '" y="' + (p.y + 34) + '" fill="' + esc(T.textSecondary) + '" font-size="9.5">' + esc(shortSub) + '</text>' +
      '<text x="' + textX + '" y="' + (p.y + 48) + '" fill="' + esc(riskColor) + '" font-size="8.6" font-weight="700">' + esc(String(n.risk || "low").toUpperCase()) + ' · ' + esc(n.role || "") + '</text>' +
      '</g>';
  }
  function buildGrammarMarkup(T){
    // 1. SEQUENCE: actor headers along the top, dashed lifelines, step arrows.
    if (grammar === "sequence") {
      var count = nodes.length;
      var padX = 10;
      var gapX = count >= 5 ? 8 : 14;
      var seqBoxW = Math.floor((SVG_W - padX * 2 - gapX * (count - 1)) / count);
      var boxH = 54;
      var headerY = 12;
      var edgeStepY = 30;
      var seqSvgH = Math.max(122, headerY + boxH + 26 + Math.max(1, edges.length) * edgeStepY + 10);
      var lifelineEndY = seqSvgH - 10;
      var pos = {};
      var maxTitle = count >= 5 ? 10 : count === 4 ? 13 : 18;
      var maxSub = count >= 5 ? 11 : count === 4 ? 15 : 22;
      var lifelinesMarkup = "";
      var nodesMarkup = "";
      nodes.forEach(function(n, i){
        var x = padX + i * (seqBoxW + gapX);
        var cx = Math.round(x + seqBoxW / 2);
        pos[n.id] = { x: x, y: headerY, w: seqBoxW, h: boxH, cx: cx };
        lifelinesMarkup += '<line x1="' + cx + '" y1="' + (headerY + boxH) + '" x2="' + cx + '" y2="' + lifelineEndY + '" stroke="' + esc(T.borderStrong) + '" stroke-width="1.3" stroke-dasharray="3 3" />';
        nodesMarkup += nodeBox(n, pos[n.id], T, selectedNodeId === n.id, { maxTitleChars: maxTitle, maxSubChars: maxSub, titleSize: count >= 5 ? "9.8" : "10.8" });
      });
      var edgesMarkup = "";
      edges.forEach(function(e, idx){
        var a = pos[e.from], b = pos[e.to];
        if (!a || !b) return;
        var ey = headerY + boxH + 24 + idx * edgeStepY;
        var color = edgeColor(e, T);
        var marker = arrowMarkerId(e, T);
        var stepNum = e.stepNumber || idx + 1;
        if (a.cx === b.cx) {
          var lx = a.cx;
          edgesMarkup += '<path d="M ' + lx + ' ' + (ey - 8) + ' C ' + (lx + 26) + ' ' + (ey - 8) + ', ' + (lx + 26) + ' ' + (ey + 8) + ', ' + (lx + 4) + ' ' + (ey + 8) + '" fill="none" class="dash-flow" stroke="' + esc(color) + '" stroke-width="1.8" marker-end="url(#' + marker + ')" />';
          edgesMarkup += stepBadge(lx + 18, ey, stepNum, color, T);
        } else {
          var dir = b.cx > a.cx ? 1 : -1;
          var x1 = a.cx + dir * 4;
          var x2 = b.cx - dir * 6;
          var mx = Math.round((x1 + x2) / 2);
          edgesMarkup += '<line x1="' + x1 + '" y1="' + ey + '" x2="' + x2 + '" y2="' + ey + '" class="dash-flow" stroke="' + esc(color) + '" stroke-width="1.8" marker-end="url(#' + marker + ')" />';
          if (e.label) {
            edgesMarkup += '<text x="' + mx + '" y="' + (ey - 11) + '" text-anchor="middle" fill="' + esc(T.textSecondary) + '" font-size="8.6">' + esc(String(e.label).slice(0, 18)) + '</text>';
          }
          edgesMarkup += stepBadge(mx, ey, stepNum, color, T);
        }
      });
      return { svgH: seqSvgH, markup: defsMarkup(T) + lifelinesMarkup + edgesMarkup + nodesMarkup };
    }

    // 2. BEFORE-AFTER: two-lane split with the AD-14 lane-safe edge guard.
    if (grammar === "before-after") {
      var hasExplicitLanes = nodes.some(function(n){ return n.lane === "before" || n.lane === "after"; });
      var beforeNodes = hasExplicitLanes
        ? nodes.filter(function(n){ return n.lane === "before"; })
        : nodes.slice(0, Math.ceil(nodes.length / 2));
      var afterNodes = hasExplicitLanes
        ? nodes.filter(function(n){ return n.lane !== "before"; })
        : nodes.slice(Math.ceil(nodes.length / 2));
      var beforeGroup = (Array.isArray(groups) ? groups : []).find(function(g){ return g.lane === "before"; });
      var afterGroup = (Array.isArray(groups) ? groups : []).find(function(g){ return g.lane === "after"; });
      var beforeTitle = (beforeGroup && beforeGroup.label) || "BEFORE";
      var afterTitle = (afterGroup && afterGroup.label) || "AFTER";
      var laneW = 214;
      var leftX = 8;
      var rightX = 238;
      var nodeW = 194;
      var nodeH = 54;
      var startY = 34;
      var gapY = 24;
      var maxRows = Math.max(1, beforeNodes.length, afterNodes.length);
      var laneH = 34 + maxRows * nodeH + Math.max(0, maxRows - 1) * gapY + 12;
      var baSvgH = laneH + 16;
      var lanesMarkup = '<rect x="' + leftX + '" y="8" width="' + laneW + '" height="' + laneH + '" rx="10" fill="' + esc(T.riskSoft) + '" stroke="' + esc(T.riskBorder) + '" stroke-width="1.2" />' +
        '<text x="' + (leftX + 12) + '" y="24" fill="' + esc(T.risk) + '" font-size="9.5" font-weight="800">' + esc(String(beforeTitle).toUpperCase()) + '</text>' +
        '<rect x="' + rightX + '" y="8" width="' + laneW + '" height="' + laneH + '" rx="10" fill="' + esc(T.okSoft) + '" stroke="' + esc(T.okBorder) + '" stroke-width="1.2" />' +
        '<text x="' + (rightX + 12) + '" y="24" fill="' + esc(T.ok) + '" font-size="9.5" font-weight="800">' + esc(String(afterTitle).toUpperCase()) + '</text>';
      var pos = {};
      var laneOf = {};
      var nodesMarkup = "";
      beforeNodes.forEach(function(n, idx){
        var p = { x: leftX + 10, y: startY + idx * (nodeH + gapY), w: nodeW, h: nodeH };
        pos[n.id] = p;
        laneOf[n.id] = "before";
        nodesMarkup += nodeBox(n, p, T, selectedNodeId === n.id, { maxTitleChars: 23, maxSubChars: 26 });
      });
      afterNodes.forEach(function(n, idx){
        var p = { x: rightX + 10, y: startY + idx * (nodeH + gapY), w: nodeW, h: nodeH };
        pos[n.id] = p;
        laneOf[n.id] = "after";
        nodesMarkup += nodeBox(n, p, T, selectedNodeId === n.id, { maxTitleChars: 23, maxSubChars: 26 });
      });
      var edgesMarkup = "";
      edges.forEach(function(e, idx){
        var a = pos[e.from], b = pos[e.to];
        if (!a || !b) return;
        if (laneOf[e.from] !== laneOf[e.to]) return;
        var x1 = Math.round(a.x + a.w / 2);
        var y1 = a.y + a.h;
        var x2 = Math.round(b.x + b.w / 2);
        var y2 = b.y - 4;
        var mx = Math.round((x1 + x2) / 2);
        var my = Math.round((y1 + y2) / 2);
        var laneFallback = laneOf[e.from] === "after" ? T.ok : T.risk;
        var color = edgeColor(e, T, laneFallback);
        var marker = arrowMarkerId(e, T, laneFallback);
        edgesMarkup += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="dash-flow" stroke="' + esc(color) + '" stroke-width="1.8" marker-end="url(#' + marker + ')" />';
        edgesMarkup += stepBadge(mx, my, e.stepNumber || idx + 1, color, T);
      });
      return { svgH: baSvgH, markup: defsMarkup(T) + lanesMarkup + edgesMarkup + nodesMarkup };
    }

    // 3. DECISION-TREE: root decision node -> branched choice leaves.
    if (grammar === "decision-tree") {
      var rootNode = nodes.find(function(n){ return n.branch === "root"; }) || nodes[0];
      var branchNodes = nodes.filter(function(n){ return n.id !== rootNode.id; });
      var pos = {};
      var nodesMarkup = "";
      if (branchNodes.length === 0) {
        var soloPos = { x: 130, y: 16, w: 200, h: 56 };
        pos[rootNode.id] = soloPos;
        nodesMarkup += nodeBox(rootNode, soloPos, T, selectedNodeId === rootNode.id, { maxTitleChars: 24, maxSubChars: 28 });
        return { svgH: 92, markup: defsMarkup(T) + nodesMarkup };
      }
      var rootPos = { x: 135, y: 12, w: 190, h: 54 };
      pos[rootNode.id] = rootPos;
      nodesMarkup += nodeBox(rootNode, rootPos, T, selectedNodeId === rootNode.id, { maxTitleChars: 22, maxSubChars: 25 });
      var bCols = branchNodes.length <= 3 ? branchNodes.length : 3;
      var bPadX = 12;
      var bGapX = 14;
      var bW = Math.floor((SVG_W - bPadX * 2 - bGapX * (bCols - 1)) / bCols);
      var bH = 56;
      var branchStartY = 102;
      var rowGap = 28;
      branchNodes.forEach(function(n, idx){
        var row = Math.floor(idx / bCols);
        var col = idx % bCols;
        var p = { x: bPadX + col * (bW + bGapX), y: branchStartY + row * (bH + rowGap), w: bW, h: bH };
        pos[n.id] = p;
        nodesMarkup += nodeBox(n, p, T, selectedNodeId === n.id, { maxTitleChars: bCols === 3 ? 16 : 21, maxSubChars: bCols === 3 ? 18 : 24 });
      });
      var bRows = Math.ceil(branchNodes.length / bCols);
      var dtSvgH = branchStartY + bRows * bH + Math.max(0, bRows - 1) * rowGap + 14;
      var edgesMarkup = "";
      edges.forEach(function(e, idx){
        var a = pos[e.from], b = pos[e.to];
        if (!a || !b) return;
        var sx = Math.round(a.x + a.w / 2);
        var sy = a.y + a.h;
        var tx = Math.round(b.x + b.w / 2);
        var ty = b.y - 4;
        var midY = Math.round((sy + ty) / 2);
        var mx = Math.round((sx + tx) / 2);
        var color = edgeColor(e, T);
        var marker = arrowMarkerId(e, T);
        edgesMarkup += '<path d="M ' + sx + ' ' + sy + ' C ' + sx + ' ' + midY + ', ' + tx + ' ' + midY + ', ' + tx + ' ' + ty + '" fill="none" class="dash-flow" stroke="' + esc(color) + '" stroke-width="1.8" marker-end="url(#' + marker + ')" />';
        edgesMarkup += stepBadge(mx, midY, e.stepNumber || idx + 1, color, T);
      });
      return { svgH: dtSvgH, markup: defsMarkup(T) + edgesMarkup + nodesMarkup };
    }

    // 4. SUBWAY-MAP: grouped layer tracks or subway-line station nodes.
    if (grammar === "subway-map") {
      var laneNames = [];
      nodes.forEach(function(n){
        var lane = String(n.lane || "").trim();
        if (lane && laneNames.indexOf(lane) === -1) laneNames.push(lane);
      });
      var useLaneTracks = laneNames.length >= 2 || (Array.isArray(groups) && groups.length >= 2);
      var pos = {};
      var trackMarkup = "";
      var nodesMarkup = "";
      var smSvgH = 160;
      if (useLaneTracks) {
        var orderedLanes = [];
        (Array.isArray(groups) ? groups : []).forEach(function(g){
          var laneId = String((g && (g.lane || g.id)) || "").trim();
          if (laneId && orderedLanes.indexOf(laneId) === -1) orderedLanes.push(laneId);
        });
        laneNames.forEach(function(laneId){
          if (orderedLanes.indexOf(laneId) === -1) orderedLanes.push(laneId);
        });
        var laneBuckets = orderedLanes
          .map(function(laneId){
            var label = laneId;
            (Array.isArray(groups) ? groups : []).forEach(function(g){
              if (g && (g.lane === laneId || g.id === laneId) && g.label) label = g.label;
            });
            return {
              id: laneId,
              label: label,
              items: nodes.filter(function(n){ return (n.lane || orderedLanes[0]) === laneId; })
            };
          })
          .filter(function(b){ return b.items.length > 0; });
        var unplaced = nodes.filter(function(n){ return !pos[n.id] && !laneBuckets.some(function(b){ return b.items.indexOf(n) !== -1; }); });
        if (unplaced.length > 0 && laneBuckets.length > 0) {
          unplaced.forEach(function(n){ laneBuckets[laneBuckets.length - 1].items.push(n); });
        }
        var lanePad = 10;
        var laneGap = 14;
        var laneBoxH = 78;
        var cursorY = 10;
        laneBuckets.forEach(function(bucket){
          var count = bucket.items.length;
          var innerPad = 12;
          var gapX = 18;
          var boxW = Math.min(200, Math.floor((SVG_W - lanePad * 2 - innerPad * 2 - gapX * (count - 1)) / count));
          var boxH = 54;
          var railY = cursorY + 26;
          trackMarkup += '<rect x="' + lanePad + '" y="' + cursorY + '" width="' + (SVG_W - lanePad * 2) + '" height="' + laneBoxH + '" rx="9" fill="' + esc(T.bgCard) + '" fill-opacity="0.35" stroke="' + esc(T.border) + '" stroke-width="1" />';
          trackMarkup += '<text x="' + (lanePad + 10) + '" y="' + (cursorY + 13) + '" fill="' + esc(T.textMuted) + '" font-size="9" font-weight="800">' + esc(String(bucket.label).toUpperCase()) + '</text>';
          trackMarkup += '<line x1="' + (lanePad + 12) + '" y1="' + (railY + 20) + '" x2="' + (SVG_W - lanePad - 12) + '" y2="' + (railY + 20) + '" stroke="' + esc(T.borderStrong) + '" stroke-width="2.5" />';
          bucket.items.forEach(function(n, idx){
            var p = { x: lanePad + innerPad + idx * (boxW + gapX), y: cursorY + 18, w: boxW, h: boxH };
            pos[n.id] = p;
            nodesMarkup += nodeBox(n, p, T, selectedNodeId === n.id, { maxTitleChars: count >= 3 ? 16 : 22, maxSubChars: count >= 3 ? 18 : 26, stationDot: true });
          });
          cursorY += laneBoxH + laneGap;
        });
        smSvgH = cursorY;
      } else {
        var cols = nodes.length <= 2 ? nodes.length : nodes.length <= 4 ? 2 : 3;
        var rows = Math.ceil(nodes.length / cols);
        var padX = 14;
        var padY = 16;
        var gapX = 26;
        var gapY = 30;
        var boxW = Math.floor((SVG_W - padX * 2 - gapX * (cols - 1)) / cols);
        var boxH = 58;
        smSvgH = padY * 2 + rows * boxH + Math.max(0, rows - 1) * gapY;
        for (var r = 0; r < rows; r++) {
          var railY = padY + r * (boxH + gapY) + Math.round(boxH / 2);
          trackMarkup += '<line x1="' + padX + '" y1="' + railY + '" x2="' + (SVG_W - padX) + '" y2="' + railY + '" stroke="' + esc(T.borderStrong) + '" stroke-width="2.4" />';
        }
        nodes.forEach(function(n, i){
          var row = Math.floor(i / cols);
          var colInRow = i % cols;
          var col = row % 2 === 1 ? cols - 1 - colInRow : colInRow;
          var p = { x: padX + col * (boxW + gapX), y: padY + row * (boxH + gapY), w: boxW, h: boxH };
          pos[n.id] = p;
          nodesMarkup += nodeBox(n, p, T, selectedNodeId === n.id, { maxTitleChars: cols === 3 ? 16 : 22, maxSubChars: cols === 3 ? 18 : 26, stationDot: true });
        });
      }
      var edgesMarkup = "";
      edges.forEach(function(e, idx){
        var a = pos[e.from], b = pos[e.to];
        if (!a || !b) return;
        var ax = a.x + a.w / 2, ay = a.y + a.h / 2;
        var bx = b.x + b.w / 2, by = b.y + b.h / 2;
        var x1 = ax, y1 = ay, x2 = bx, y2 = by;
        if (Math.abs(ay - by) < 10) {
          x1 = bx > ax ? a.x + a.w : a.x;
          x2 = bx > ax ? b.x - 4 : b.x + b.w + 4;
        } else {
          y1 = by > ay ? a.y + a.h : a.y;
          y2 = by > ay ? b.y - 4 : b.y + b.h + 4;
        }
        var mx = Math.round((x1 + x2) / 2);
        var my = Math.round((y1 + y2) / 2);
        var color = edgeColor(e, T);
        var marker = arrowMarkerId(e, T);
        edgesMarkup += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="dash-flow" stroke="' + esc(color) + '" stroke-width="2" marker-end="url(#' + marker + ')" />';
        edgesMarkup += stepBadge(mx, my, e.stepNumber || idx + 1, color, T);
      });
      return { svgH: smSvgH, markup: defsMarkup(T) + trackMarkup + edgesMarkup + nodesMarkup };
    }

    // 5. FLOW-DIFF (default): directional left-accented diff cards.
    var cols = nodes.length <= 2 ? nodes.length : nodes.length <= 4 ? 2 : 3;
    var rows = Math.ceil(nodes.length / cols);
    var padX = 14;
    var padY = 16;
    var gapX = 26;
    var gapY = 30;
    var boxW = Math.floor((SVG_W - padX * 2 - gapX * (cols - 1)) / cols);
    var boxH = 58;
    var fdSvgH = padY * 2 + rows * boxH + Math.max(0, rows - 1) * gapY;
    var pos = {};
    var nodesMarkup = "";
    nodes.forEach(function(n, i){
      var row = Math.floor(i / cols);
      var colInRow = i % cols;
      var col = row % 2 === 1 ? cols - 1 - colInRow : colInRow;
      var p = { x: padX + col * (boxW + gapX), y: padY + row * (boxH + gapY), w: boxW, h: boxH };
      pos[n.id] = p;
      nodesMarkup += nodeBox(n, p, T, selectedNodeId === n.id, { maxTitleChars: cols === 3 ? 15 : 21, maxSubChars: cols === 3 ? 17 : 25, accentLeftBar: true });
    });
    var edgesMarkup = "";
    edges.forEach(function(e, idx){
      var a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      var ax = a.x + a.w / 2, ay = a.y + a.h / 2;
      var bx = b.x + b.w / 2, by = b.y + b.h / 2;
      var x1 = ax, y1 = ay, x2 = bx, y2 = by;
      if (Math.abs(ay - by) < 10) {
        x1 = bx > ax ? a.x + a.w : a.x;
        x2 = bx > ax ? b.x - 4 : b.x + b.w + 4;
      } else {
        y1 = by > ay ? a.y + a.h : a.y;
        y2 = by > ay ? b.y - 4 : b.y + b.h + 4;
      }
      var mx = Math.round((x1 + x2) / 2);
      var my = Math.round((y1 + y2) / 2);
      var color = edgeColor(e, T);
      var marker = arrowMarkerId(e, T);
      edgesMarkup += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="dash-flow" stroke="' + esc(color) + '" stroke-width="1.8" marker-end="url(#' + marker + ')" />';
      edgesMarkup += stepBadge(mx, my, e.stepNumber || idx + 1, color, T);
    });
    return { svgH: fdSvgH, markup: defsMarkup(T) + edgesMarkup + nodesMarkup };
  }
  function syncInspector(text, active){
    inspector.textContent = text;
    if (inspector.classList && inspector.classList.toggle) {
      inspector.classList.toggle("has-selection", Boolean(active));
    }
  }
  function renderChips(){
    chipsEl.innerHTML = "";
    (DATA.touchedFiles || []).forEach(function(f, fidx){
      var btn = document.createElement("button");
      var matched = nodes.find(function(x){ return x.file === f.path || x.label === f.shortName; });
      var isSel = Boolean((matched && selectedNodeId === matched.id) || (!matched && selectedFilePath === f.path));
      btn.className = "chip " + (f.risk || "low") + (isSel ? " selected" : "");
      btn.setAttribute("data-fidx", String(fidx));
      btn.setAttribute("aria-pressed", isSel ? "true" : "false");
      btn.textContent = (f.icon || "📄") + " " + f.shortName + " · " + (f.risk || "low").toUpperCase();
      btn.addEventListener("click", function(){
        if (matched) {
          inspectNode(matched, { toggle: true, focusChipIdx: fidx });
        } else {
          selectedNodeId = null;
          if (selectedFilePath === f.path) {
            selectedFilePath = null;
            syncInspector(defaultInspectorText, false);
          } else {
            selectedFilePath = f.path;
            syncInspector(f.path + " — " + f.role + " (" + (f.intent || f.risk) + ")", true);
          }
          renderDiagram();
          renderChips();
          if (chipsEl.querySelectorAll) {
            var targetChip = Array.prototype.find.call(chipsEl.querySelectorAll(".chip"), function(el){ return el.getAttribute("data-fidx") === String(fidx); });
            if (targetChip && typeof targetChip.focus === "function") targetChip.focus();
          }
        }
      });
      chipsEl.appendChild(btn);
    });
  }
  function inspectNode(n, opts){
    var toggle = opts && opts.toggle;
    var focusNode = opts && opts.focusNode;
    var focusChipIdx = opts && opts.focusChipIdx;
    selectedFilePath = null;
    if (toggle && selectedNodeId === n.id) {
      selectedNodeId = null;
      syncInspector(defaultInspectorText, false);
    } else {
      selectedNodeId = n.id;
      syncInspector((n.label || "") + " — Role: " + (n.role || "Step") + " · Risk: " + (n.risk || "low").toUpperCase() + (n.file ? " · File: " + n.file : ""), true);
    }
    renderDiagram();
    renderChips();
    if (focusNode) {
      var target = Array.prototype.find.call(svg.querySelectorAll(".dnode"), function(el){ return el.getAttribute("data-id") === n.id; });
      if (target && typeof target.focus === "function") target.focus();
    } else if (focusChipIdx !== undefined && focusChipIdx !== null && chipsEl.querySelectorAll) {
      var chipTarget = Array.prototype.find.call(chipsEl.querySelectorAll(".chip"), function(el){ return el.getAttribute("data-fidx") === String(focusChipIdx); });
      if (chipTarget && typeof chipTarget.focus === "function") chipTarget.focus();
    }
  }
  function renderDiagram(){
    var T = resolveTokens();
    if (!nodes.length) {
      svg.innerHTML = '<text x="230" y="105" text-anchor="middle" fill="'+T.textSecondary+'" font-size="13">Diagram pending…</text>';
      return;
    }
    var built = buildGrammarMarkup(T);
    if (svg.setAttribute) svg.setAttribute("viewBox", "0 0 " + SVG_W + " " + built.svgH);
    svg.innerHTML = built.markup;
    svg.querySelectorAll(".dnode").forEach(function(g){
      function activate(fromKb){
        var id = g.getAttribute("data-id");
        var found = nodes.find(function(x){ return x.id === id; });
        if(found) inspectNode(found, { toggle: true, focusNode: fromKb });
      }
      g.addEventListener("click", function(){ activate(false); });
      g.addEventListener("keydown", function(e){
        if(e.key === "Enter" || e.key === " "){ e.preventDefault(); activate(true); }
      });
    });
  }
  renderDiagram();
  renderChips();
  var scenes = DATA.scenes || [];
  var canvas = document.getElementById("sceneCanvas");
  var drawFrame = null;
  function reducedMotion(){
    try { return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  if(canvas && scenes.length){
    var ctx = canvas.getContext("2d"), idx = 0, playing = false, t = 0, raf = null;
    var cap = document.getElementById("sceneCaption");
    drawFrame = function(){
      var T = resolveTokens();
      var rm = reducedMotion();
      ctx.clearRect(0,0,880,230);
      ctx.fillStyle = T.explainerStageBg; ctx.fillRect(0,0,880,230);
      ctx.strokeStyle = T.canvasGridLine;
      for(var gx=0;gx<880;gx+=40){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,230); ctx.stroke(); }
      for(var gy=0;gy<230;gy+=40){ ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(880,gy); ctx.stroke(); }
      var sc = scenes[idx] || scenes[0];
      var hi = new Set(sc.highlightNodeIds || []);
      nodes.forEach(function(n, i){
        var nx = 60 + i * (760 / Math.max(1, nodes.length)), ny = 75, nw = 150, nh = 70;
        var active = hi.has(n.id);
        ctx.fillStyle = active ? T.accentSoft : T.bgCard;
        ctx.strokeStyle = active ? T.accent : T.borderStrong;
        ctx.lineWidth = active ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = T.textPrimary; ctx.font = "bold 13px sans-serif";
        ctx.fillText((n.label||"").slice(0,18), nx+12, ny+28);
        ctx.fillStyle = T.textSecondary; ctx.font = "11px sans-serif";
        ctx.fillText((n.sublabel||"").slice(0,22), nx+12, ny+48);
        if(i < nodes.length - 1 && playing && !rm){
          var pulseX = nx + nw + ((t % 60)/60) * ((760 / Math.max(1, nodes.length)) - nw);
          ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(pulseX, ny + nh/2, 4, 0, Math.PI*2); ctx.fill();
        }
      });
      ctx.fillStyle = T.warn; ctx.font = "bold 14px sans-serif";
      ctx.fillText(sc.title || "", 28, 34);
      cap.textContent = sc.narration || "";
    };
    function tick(){
      t++;
      if(playing && t % 240 === 0){ idx = (idx + 1) % scenes.length; }
      drawFrame();
      if(playing && !reducedMotion()) raf = requestAnimationFrame(tick);
    }
    drawFrame();
    var btnPlay = document.getElementById("btnPlayScene");
    var btnPause = document.getElementById("btnPauseScene");
    function syncPlaybackButtons(){
      if (btnPlay) btnPlay.setAttribute("aria-pressed", playing ? "true" : "false");
      if (btnPause) btnPause.setAttribute("aria-pressed", playing ? "false" : "true");
    }
    if (btnPlay) {
      btnPlay.addEventListener("click", function(){
        if(!playing){
          playing = true;
          syncPlaybackButtons();
          if(reducedMotion()){ drawFrame(); } else { tick(); }
        }
      });
    }
    if (btnPause) {
      btnPause.addEventListener("click", function(){
        playing = false;
        syncPlaybackButtons();
        if(raf) cancelAnimationFrame(raf);
      });
    }
    // Story 6.5/6.6 — Canvas tour scene pills: jump to any scene (the active
    // pill tracks idx; playback keeps advancing from the jumped scene).
    var pillsEl = document.getElementById("explainerScenePills");
    function syncScenePills(){
      var pills = pillsEl && pillsEl.querySelectorAll ? pillsEl.querySelectorAll(".scene-pill") : [];
      for (var si = 0; si < pills.length; si++) {
        var isOn = Number(pills[si].getAttribute("data-scene-idx")) === idx;
        pills[si].className = "scene-pill" + (isOn ? " active" : "");
        pills[si].setAttribute("aria-pressed", isOn ? "true" : "false");
      }
    }
    if (pillsEl && pillsEl.querySelectorAll) {
      var pills = pillsEl.querySelectorAll(".scene-pill");
      for (var pi = 0; pi < pills.length; pi++) {
        (function(pill){
          pill.addEventListener("click", function(){
            idx = Number(pill.getAttribute("data-scene-idx")) || 0;
            t = 0;
            syncScenePills();
            drawFrame();
          });
        })(pills[pi]);
      }
      syncScenePills();
    }
  }
  // ---- Story 6.6 — local X-Ray toggle (Plain STE-80 <-> Tech).
  // One body[data-xray-mode] attribute write swaps every pre-bound
  // .xray-plain/.xray-tech pair with CSS only: zero RPC, zero network.
  var xrayRoot = (typeof document !== "undefined" && document.body) || document.documentElement;
  var xrayBtn = document.getElementById("btnXrayToggle");
  function currentXrayMode(){
    var mode = xrayRoot && xrayRoot.getAttribute ? xrayRoot.getAttribute("data-xray-mode") : null;
    return String(mode || "plain") === "tech" ? "tech" : "plain";
  }
  function syncXrayButton(){
    if (!xrayBtn) return;
    var mode = currentXrayMode();
    xrayBtn.setAttribute("data-mode", mode);
    xrayBtn.setAttribute("aria-pressed", mode === "tech" ? "true" : "false");
    xrayBtn.textContent = mode === "tech" ? "⚡ X-Ray · Tech" : "⚡ X-Ray · Plain";
  }
  function toggleXrayMode(){
    if (xrayRoot && xrayRoot.setAttribute) {
      xrayRoot.setAttribute("data-xray-mode", currentXrayMode() === "tech" ? "plain" : "tech");
      syncXrayButton();
    }
  }
  if (xrayBtn) {
    xrayBtn.addEventListener("click", toggleXrayMode);
  }
  syncXrayButton();

  // ---- Story 6.2 offline microBlocks: local selection state only. ----
  function queryButtons(containerId, selector){
    var container = document.getElementById(containerId);
    if (!container || !container.querySelectorAll || typeof container.querySelectorAll !== "function") return [];
    return container.querySelectorAll(selector);
  }
  // Waiting chips: select locally + surface the prompt to send from the live
  // panel (offline artifacts cannot dispatch ui/message).
  var waitNote = document.getElementById("waitOfflineNote");
  var waitingPayload = (DATA.waiting && Array.isArray(DATA.waiting.chips)) ? DATA.waiting.chips : [];
  queryButtons("waitingChipsRow", ".action-chip").forEach(function(btn){
    btn.addEventListener("click", function(){
      var chipId = btn.getAttribute("data-chip-id");
      var prompt = "";
      waitingPayload.forEach(function(c){
        if (c && c.id === chipId) prompt = String(c.messagePrompt || c.label || "");
      });
      var all = queryButtons("waitingChipsRow", ".action-chip");
      for (var i = 0; i < all.length; i++) {
        var picked = all[i].getAttribute("data-chip-id") === chipId;
        all[i].className = "action-chip" + (picked ? " selected" : "");
        all[i].setAttribute("aria-pressed", picked ? "true" : "false");
      }
      if (waitNote) {
        waitNote.textContent = prompt
          ? "Offline export — send this reply from the live panel: " + prompt
          : "Offline export — send replies from the live panel.";
        if (waitNote.removeAttribute) waitNote.removeAttribute("hidden");
      }
    });
  });
  // Choice grid: mark the picked option locally (offline; no chat dispatch).
  queryButtons("choiceGrid", ".choice-item").forEach(function(btn){
    btn.addEventListener("click", function(){
      var all = queryButtons("choiceGrid", ".choice-item");
      var pickedKey = null;
      for (var i = 0; i < all.length; i++) {
        var picked = all[i] === btn;
        if (picked) pickedKey = all[i].getAttribute("data-choice-key");
        all[i].className = "choice-item" + (picked ? " picked" : "");
        all[i].setAttribute("aria-pressed", picked ? "true" : "false");
      }
      var pickedPill = document.getElementById("choicePickedPill");
      if (pickedPill) {
        pickedPill.textContent = "Selected: " + (pickedKey || "?");
        if (pickedPill.removeAttribute) pickedPill.removeAttribute("hidden");
      }
    });
  });
  // Proof pills: expand/collapse the matching proof-detail locally.
  queryButtons("proofPillRow", ".proof-pill").forEach(function(btn){
    btn.addEventListener("click", function(){
      var idxAttr = btn.getAttribute("data-proof-idx");
      var detail = document.getElementById("proofDetail-" + idxAttr);
      var open = detail && detail.classList && detail.classList.contains && detail.classList.contains("open");
      if (detail && detail.classList && detail.classList.toggle) detail.classList.toggle("open", !open);
      btn.setAttribute("aria-expanded", open ? "false" : "true");
    });
  });
  // Story 7.3 — offline Install CTA: reveal the local install note (zero RPC).
  var installBtn = document.getElementById("btnInstallPluginExport");
  if (installBtn) installBtn.addEventListener("click", function(){
    var note = document.getElementById("installOfflineNote");
    if (note && note.removeAttribute) note.removeAttribute("hidden");
  });
  function rerenderVisuals(){
    renderDiagram();
    if(drawFrame) drawFrame();
  }
  try {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    if (mq && typeof mq.addEventListener === "function") mq.addEventListener("change", rerenderVisuals);
    else if (mq && typeof mq.addListener === "function") mq.addListener(rerenderVisuals);
  } catch (e) {}
})();
</script>
</body>
</html>`;
}

export function saveStandaloneHtmlArtifact(workspaceRoot, panelState, options = {}) {
  const html = generateStandaloneHtmlArtifact(panelState, options);
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

// ============================================================================
// Story 5.3 (AD-5 / AD-13 / AD-17): Model-Agnostic Cheapest Model & Visual Plugin Discovery
// ============================================================================

export function discoverCheapestEnabledModels(options = {}) {
  const home =
    options && typeof options === "object" && options.homeDir
      ? String(options.homeDir).trim()
      : getZCodeHomeDir();
  const zcodeV2Dir = join(home, ".zcode", "v2");
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

  const personalModelRules = [
    ...(personalCfg?.config?.modelConfigRules?.providerModelRules || []),
    ...(personalCfg?.config?.modelConfigRules?.manualProviderModelRules || []),
    ...(personalCfg?.modelConfigRules?.providerModelRules || []),
    ...(personalCfg?.modelConfigRules?.manualProviderModelRules || [])
  ];
  const disabledModelKeys = new Set(
    personalModelRules
      .filter((m) => m?.enabled === false || m?.config?.enabled === false || m?.config?.visibility === "hidden")
      .map((m) => `${m.providerId}/${m.modelId || m.id}`)
  );

  const addCandidate = (providerId, rawModelId, providerName) => {
    const cleanProviderId = String(providerId || "").trim();
    const cleanModelId = String(rawModelId || "").trim();
    if (!cleanProviderId || !cleanModelId) return;
    const modelId = cleanModelId.startsWith(`${cleanProviderId}/`)
      ? cleanModelId.slice(cleanProviderId.length + 1)
      : cleanModelId;
    if (!modelId) return;

    const fullId = `${cleanProviderId}/${modelId}`;
    if (seen.has(fullId) || disabledModelKeys.has(fullId)) return;

    const low = modelId.toLowerCase();
    // Skip non-text / media / embedding / moderation models
    if (/image|imagen|veo|dall-e|audio|tts|whisper|embed|rerank|moderation/i.test(low)) return;
    // Skip heavy flagship reasoning / frontier models unless explicitly mini/nano/flash/haiku/lite
    if (
      /\b(opus|sonnet|gpt-4-turbo|o1-pro|o3-pro|deepseek-reasoner|deepseek-r1)\b/i.test(low) &&
      !/mini|nano|flash|haiku|lite|distill|[0-9]+b\b/i.test(low)
    ) {
      return;
    }

    const isCheapTier =
      /argon|flash|hydrogen|haiku|mini|nano|turbo|lite|light|fast|small|air|spark|instant|deepseek-chat|[0-9]+b\b/i.test(
        low
      );
    if (!isCheapTier) return;

    seen.add(fullId);

    let score = 0;
    if (/gemini-4-argon$/i.test(low) || /gemini-3\.8-flash$/i.test(low)) score += 10;
    else if (/nano/i.test(low) && !/lite|xhigh|high/i.test(low)) score += 9;
    else if (/argon|flash|haiku|mini/i.test(low) && !/lite|xhigh|high/i.test(low)) score += 8;
    else if (/argon-medium|flash-medium|haiku-medium|mini-medium/i.test(low)) score += 7;
    else if (/argon|flash|haiku|nano|mini/i.test(low)) score += 5;
    else if (/turbo|air|small|fast|light|instant|spark|deepseek-chat|[0-9]+b\b/i.test(low)) score += 4;
    else if (/hydrogen$/i.test(low) || /hydrogen-medium$/i.test(low)) score += 3;
    else if (/lite/i.test(low)) score += 5;
    if (/xhigh|max|lite/i.test(low)) score -= 3;
    if (score <= 0) return;

    discovered.push({
      id: fullId,
      modelId,
      providerId: cleanProviderId,
      providerName: providerName || cleanProviderId,
      score
    });
  };

  const subInfo = credsCfg?.subscriptionInfo || {};
  for (const sub of settingCfg?.subscriptions || []) {
    if (sub?.enabled === false) continue;
    const pid = `account:${sub.id}`;
    const models = subInfo?.[sub.id]?.models || sub?.models || [];
    for (const m of models) {
      if (m && typeof m === "object" && (m.enabled === false || m.disabled === true)) continue;
      const mid = typeof m === "string" ? m : m?.id || m?.modelId;
      if (mid) addCandidate(pid, mid, sub.name || sub.id);
    }
  }

  const personalProviderRules =
    personalCfg?.config?.providerConfigRules?.providerRules ||
    personalCfg?.providerConfigRules?.providerRules ||
    personalCfg?.providers ||
    [];

  for (const pr of personalProviderRules) {
    const pid = pr?.providerId || pr?.id;
    if (!pid) continue;
    const pConfig = pr.config || pr;
    if (pr.enabled === false || pConfig.enabled === false || pConfig.visibility === "hidden") continue;
    if (pConfig.access?.type === "api-key" && !String(pConfig.access?.apiKey || "").trim()) continue;
    const mids = [
      ...(pConfig.modelOrder || []),
      ...(pConfig.personalModelIds || []),
      ...(pConfig.builtinModelIds || []),
      ...(Array.isArray(pConfig.models)
        ? pConfig.models
            .filter((m) => !(m && typeof m === "object" && (m.enabled === false || m.disabled === true)))
            .map((m) => (typeof m === "string" ? m : m?.id || m?.modelId))
        : []),
      ...personalModelRules
        .filter((m) => m.providerId === pid && m?.enabled !== false && m?.config?.enabled !== false)
        .map((m) => m.modelId || m.id)
    ];
    for (const mid of mids) {
      if (mid) addCandidate(pid, mid, pr.providerName || pr.name || pid);
    }
  }

  discovered.sort((a, b) => b.score - a.score);
  return discovered;
}

// Backward-compatible export alias retained per AD-5 / R17.
export const discoverLightweightGeminiModels = discoverCheapestEnabledModels;

function resolveVisualPluginTokens(rawToken) {
  const raw = String(rawToken || "").toLowerCase().trim();
  if (!raw) return [];
  const withoutMarketplace = raw.split("@")[0].trim();
  if (!withoutMarketplace) return [];

  const matches = [];
  if (/(?:^|[/\\_:.-])excalidraw(?:$|[/\\_:.-])/.test(withoutMarketplace)) {
    matches.push("excalidraw");
  }
  if (/(?:^|[/\\_:.-])visualize(?:$|[/\\_:.-])/.test(withoutMarketplace)) {
    matches.push("visualize");
  }
  if (/(?:^|[/\\_:.-])vectorcraft(?:$|[/\\_:.-])/.test(withoutMarketplace)) {
    matches.push("vectorcraft");
  }
  if (/(?:^|[/\\_:.-])designcraft(?:$|[/\\_:.-])/.test(withoutMarketplace)) {
    matches.push("designcraft");
  }
  // Map the official ZCode "design" plugin bundle (or plugin_design server) to
  // both "vectorcraft" and "designcraft" without false-matching "designcraft" or "bmad-agent-ux-designer".
  if (
    /(?:^|[/\\:])design(?:$|[/\\:])/.test(withoutMarketplace) ||
    /^(?:mcp__)?plugin[_-]+design(?:[_-]+design)?$/.test(withoutMarketplace)
  ) {
    matches.push("vectorcraft", "designcraft");
  }
  return matches;
}

export function discoverInstalledVisualPlugins(workspaceOrOptions = "") {
  const workspaceRoot =
    typeof workspaceOrOptions === "string"
      ? workspaceOrOptions.trim()
      : String(workspaceOrOptions?.workspaceRoot || "").trim();
  const home =
    workspaceOrOptions && typeof workspaceOrOptions === "object" && workspaceOrOptions.homeDir
      ? String(workspaceOrOptions.homeDir).trim()
      : getZCodeHomeDir();

  const found = new Set();
  const disabledPluginNames = new Set();

  const readJsonSafe = (p) => {
    try {
      return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
    } catch {
      return null;
    }
  };

  const recordToken = (token) => {
    for (const target of resolveVisualPluginTokens(token)) {
      found.add(target);
    }
  };

  const inspectMcpJsonFile = (mcpPath) => {
    if (!mcpPath) return;
    const data = readJsonSafe(mcpPath);
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const serversObj =
      (data.mcpServers && typeof data.mcpServers === "object" && data.mcpServers) ||
      (data.servers && typeof data.servers === "object" && data.servers) ||
      data;
    for (const [serverKey, serverCfg] of Object.entries(serversObj)) {
      if (serverKey === "mcpServers" || serverKey === "servers") continue;
      if (serverCfg && typeof serverCfg === "object" && (serverCfg.enabled === false || serverCfg.disabled === true)) {
        continue;
      }
      recordToken(serverKey);
    }
  };

  const inspectSkillsDir = (skillsDir) => {
    if (!skillsDir) return;
    try {
      if (!existsSync(skillsDir)) return;
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          recordToken(entry.name);
        } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          recordToken(entry.name.replace(/\.md$/i, ""));
        }
      }
    } catch {
      // ignore unreadable skills directory
    }
  };

  const readPluginManifest = (dirPath) =>
    readJsonSafe(join(dirPath, ".zcode-plugin", "plugin.json")) ||
    readJsonSafe(join(dirPath, "plugin.json"));

  const isManifestDisabled = (manifest) =>
    Boolean(manifest && typeof manifest === "object" && (manifest.enabled === false || manifest.disabled === true));

  const inspectPluginDirectory = (pluginDir, dirNameHint = "") => {
    if (!pluginDir) return;
    const manifest = readPluginManifest(pluginDir);
    if (isManifestDisabled(manifest)) return;

    let subDirs = [];
    try {
      subDirs = readdirSync(pluginDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {}

    // If version subdirectories carry manifests and every manifest is disabled, skip this plugin.
    const subManifests = subDirs.map((d) => readPluginManifest(join(pluginDir, d.name))).filter(Boolean);
    if (subManifests.length > 0 && subManifests.every(isManifestDisabled)) {
      return;
    }

    if (manifest && typeof manifest === "object") {
      recordToken(manifest.name || manifest.id || dirNameHint);
    } else if (dirNameHint) {
      recordToken(dirNameHint);
    }
    inspectMcpJsonFile(join(pluginDir, ".mcp.json"));
    inspectSkillsDir(join(pluginDir, "skills"));

    for (const sub of subDirs) {
      const subPath = join(pluginDir, sub.name);
      const subManifest = readPluginManifest(subPath);
      if (isManifestDisabled(subManifest)) continue;
      if (subManifest && typeof subManifest === "object") {
        recordToken(subManifest.name || subManifest.id);
      }
      inspectMcpJsonFile(join(subPath, ".mcp.json"));
      inspectSkillsDir(join(subPath, "skills"));
    }
  };

  // 1. Inspect ~/.zcode/cli/plugins/ (installed_plugins.json, direct folders, cache/, marketplaces/)
  if (home) {
    const pluginsRoot = join(home, ".zcode", "cli", "plugins");
    try {
      if (existsSync(pluginsRoot)) {
        for (const manifestFile of ["installed_plugins.json", "plugins.json"]) {
          const parsed = readJsonSafe(join(pluginsRoot, manifestFile));
          if (!parsed) continue;
          const list = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.plugins)
            ? parsed.plugins
            : Array.isArray(parsed.installed)
            ? parsed.installed
            : typeof parsed === "object"
            ? Object.entries(parsed)
                .filter(([k]) => k !== "version")
                .map(([k, v]) => (v && typeof v === "object" ? { name: k, ...v } : k))
            : [];
          for (const item of list) {
            if (typeof item === "string") {
              recordToken(item);
              continue;
            }
            if (!item || typeof item !== "object") continue;
            const rawName = String(item.name || item.id || item.pluginId || item.source?.path || "")
              .toLowerCase()
              .split("@")[0]
              .trim();
            if (item.enabled === false || item.disabled === true) {
              if (rawName) disabledPluginNames.add(rawName);
              continue;
            }
            if (rawName) disabledPluginNames.delete(rawName);
            recordToken(item.name);
            recordToken(item.id);
            recordToken(item.pluginId);
            recordToken(item.source?.path);
          }
        }

        const scanPluginContainer = (containerDir, depth = 0) => {
          if (depth > 3) return;
          let entries = [];
          try {
            if (!existsSync(containerDir)) return;
            entries = readdirSync(containerDir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const lowerName = entry.name.toLowerCase();
            if (lowerName === "data") continue;
            const fullPath = join(containerDir, entry.name);
            if (lowerName === "cache" || lowerName === "marketplaces" || lowerName === "plugins") {
              scanPluginContainer(fullPath, depth + 1);
              continue;
            }
            if (disabledPluginNames.has(lowerName)) continue;

            const tokens = resolveVisualPluginTokens(entry.name);
            if (tokens.length > 0) {
              inspectPluginDirectory(fullPath, entry.name);
            } else {
              // Could be a marketplace container (e.g. cache/zcode-plugins-official/)
              const manifest = readPluginManifest(fullPath);
              if (manifest && !isManifestDisabled(manifest)) {
                inspectPluginDirectory(fullPath, "");
              }
              scanPluginContainer(fullPath, depth + 1);
            }
          }
        };

        scanPluginContainer(pluginsRoot, 0);
      }
    } catch {
      // ignore plugin discovery filesystem errors
    }

    inspectMcpJsonFile(join(home, ".mcp.json"));
    inspectMcpJsonFile(join(home, ".zcode", ".mcp.json"));
    inspectMcpJsonFile(join(home, ".zcode", "mcp.json"));
    inspectSkillsDir(join(home, ".zcode", "skills"));
    inspectSkillsDir(join(home, ".agents", "skills"));
  }

  // 2. Inspect workspace .mcp.json and project skills (skills/, .zcode/skills/, .agents/skills/)
  if (workspaceRoot) {
    inspectMcpJsonFile(join(workspaceRoot, ".mcp.json"));
    inspectMcpJsonFile(join(workspaceRoot, ".zcode", ".mcp.json"));
    inspectMcpJsonFile(join(workspaceRoot, ".zcode", "mcp.json"));
    inspectSkillsDir(join(workspaceRoot, "skills"));
    inspectSkillsDir(join(workspaceRoot, ".zcode", "skills"));
    inspectSkillsDir(join(workspaceRoot, ".agents", "skills"));
  }

  return VALID_TARGET_PLUGINS.filter((plugin) => found.has(plugin));
}

export function buildFullPanelState(workspaceRoot) {
  const state = loadPersistedState(workspaceRoot);
  const memInfo = listZCodeMemories(workspaceRoot);
  const cheapestModels = discoverCheapestEnabledModels();
  const availableModels = cheapestModels.slice(0, 8);
  const geminiModels = cheapestModels.filter((m) => /gemini/i.test(m.modelId || m.id));
  const recommendedGeminiModel =
    geminiModels[0]?.id || cheapestModels[0]?.id || "new-provider/gemini-3.8-flash";
  const preferredModel = String(state.preferredModel || "auto-cheapest").trim() || "auto-cheapest";
  const recommendedModel =
    preferredModel !== "auto-cheapest"
      ? preferredModel
      : cheapestModels[0]?.id || "active-session";
  const installedVisualPlugins = discoverInstalledVisualPlugins(workspaceRoot);
  const currentDebrief = ensureDebriefEnriched(
    state.currentDebrief || createWelcomeDebrief(basename(workspaceRoot), state.activePersona),
    state
  );

  return {
    projectName: state.projectName || basename(workspaceRoot),
    workspaceRoot,
    activePersona: state.activePersona || "vibe-mentor",
    ste100Enabled: state.ste100Enabled !== false,
    language: String(state.language || "en").trim() || "en",
    preferredModel,
    themePreference: ["auto", "dark", "light"].includes(state.themePreference)
      ? state.themePreference
      : "auto",
    turnCount: state.turnCount || 0,
    personas: PERSONAS,
    recommendedGeminiModel,
    lightweightGeminiModels: availableModels,
    recommendedModel,
    availableModels,
    installedVisualPlugins,
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
