import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { execFileSync, spawn } from "node:child_process";

export const BMAD_PHASES = [
  {
    id: "1-analysis",
    order: 1,
    name: "Phase 1 · Analysis & Ideation",
    shortName: "1. Analysis",
    description: "Explore the problem space, validate product concepts, research domain constraints, and establish repository agent instructions.",
    keySkills: ["bmad-product-brief", "bmad-brainstorming", "bmad-prfaq", "bmad-deep-recon", "bmad-forge-idea", "bmad-project-context"]
  },
  {
    id: "2-planning",
    order: 2,
    name: "Phase 2 · Planning & UX Design",
    shortName: "2. Planning & UX",
    description: "Define functional & non-functional requirements in a PRD or Spec, and capture visual design (DESIGN.md) and interaction flows (EXPERIENCE.md).",
    keySkills: ["bmad-prd", "bmad-ux", "bmad-spec", "bmad-correct-course"]
  },
  {
    id: "3-solutioning",
    order: 3,
    name: "Phase 3 · Solutioning & Architecture",
    shortName: "3. Solutioning",
    description: "Record technical architecture decisions, decompose requirements into epics and stories with acceptance criteria, and run sprint readiness gates.",
    keySkills: ["bmad-architecture", "bmad-create-epics-and-stories", "bmad-sprint-planning", "bmad-testarch-test-design", "bmad-testarch-framework", "bmad-testarch-ci"]
  },
  {
    id: "4-implementation",
    order: 4,
    name: "Phase 4 · Implementation, QA & Ship",
    shortName: "4. Implementation",
    description: "Execute story builds with red-green-refactor discipline, run multi-lens code reviews, automate E2E/ATDD tests, and capture epic retrospectives.",
    keySkills: ["bmad-build", "bmad-code-review", "bmad-walkthrough", "bmad-qa-generate-e2e-tests", "bmad-retrospective", "bmad-testarch-atdd", "bmad-testarch-automate", "bmad-review"]
  }
];

export const BMAD_SKILLS_CATALOG = [
  {
    skill: "bmad-help",
    displayName: "BMad Help & Next Step Advisor",
    code: "BH",
    module: "Core",
    phase: "anytime",
    modelProfile: "planning-fast",
    precededBy: [],
    followedBy: [],
    description: "Analyze current project state and recommend the exact next BMAD workflow or skill to run.",
    promptTemplate: (ctx) =>
      ctx.totalStories > 0
        ? `/bmad-help "Analyze the current state of ${ctx.projectName} (${ctx.completedStories}/${ctx.totalStories} stories complete, focus: ${ctx.activeFocus}) and advise the next BMAD workflow"`
        : `/bmad-help "Analyze the ${ctx.projectName} repository (${ctx.techStack}) and recommend the first BMAD-METHOD workflow to initialize planning and context"`
  },
  {
    skill: "bmad-project-context",
    displayName: "Project Context & AGENTS.md Setup",
    code: "PC",
    module: "BMad Method",
    phase: "1-analysis",
    modelProfile: "planning-fast",
    precededBy: [],
    followedBy: ["bmad-product-brief", "bmad-prd"],
    description: "Set up, refresh, or audit repository instructions (AGENTS.md / CONTEXT.md), verified build commands, conventions, and known pitfalls.",
    promptTemplate: (ctx) => `/bmad-project-context "Audit and refresh AGENTS.md and project context for ${ctx.projectName} (${ctx.techStack}) with verified build/test commands and architectural conventions"`
  },
  {
    skill: "bmad-product-brief",
    displayName: "Create or Update Product Brief",
    code: "CB",
    module: "BMad Method",
    phase: "1-analysis",
    modelProfile: "planning-fast",
    precededBy: ["bmad-brainstorming"],
    followedBy: ["bmad-prd"],
    description: "Guided discovery that captures product vision, target users, value proposition, and scope boundaries in a Product Brief.",
    promptTemplate: (ctx) => `/bmad-product-brief "Create or update the product brief for ${ctx.projectName} covering target users, core value proposition, and scope boundaries"`
  },
  {
    skill: "bmad-brainstorming",
    displayName: "Guided Brainstorming Session",
    code: "BP",
    module: "BMad Method",
    phase: "1-analysis",
    modelProfile: "creative-ux",
    precededBy: [],
    followedBy: ["bmad-product-brief", "bmad-spec"],
    description: "Structured ideation session using creative techniques to explore new features, UX workflows, or product differentiators.",
    promptTemplate: (ctx) => `/bmad-brainstorming "Brainstorm high-impact workflow improvements and next-phase capabilities for ${ctx.projectName}"`
  },
  {
    skill: "bmad-prfaq",
    displayName: "Amazon Working Backwards PRFAQ",
    code: "WB",
    module: "BMad Method",
    phase: "1-analysis",
    modelProfile: "deep-reasoning",
    precededBy: [],
    followedBy: ["bmad-prd"],
    description: "Write the finished product press release and stakeholder FAQ first to stress-test a new product initiative.",
    promptTemplate: (ctx) => `/bmad-prfaq "Run a Working Backwards PRFAQ challenge for the next major release of ${ctx.projectName}"`
  },
  {
    skill: "bmad-deep-recon",
    displayName: "Deep Domain & Technical Recon",
    code: "RS",
    module: "Core",
    phase: "1-analysis",
    modelProfile: "deep-reasoning",
    precededBy: [],
    followedBy: ["bmad-prd", "bmad-architecture"],
    description: "Conduct market, domain, technical, or competitive research with cited sources to ground product and architecture decisions.",
    promptTemplate: (ctx) => `/bmad-deep-recon "Run technical and domain research for ${ctx.projectName} focusing on ${ctx.activeFocus}"`
  },
  {
    skill: "bmad-forge-idea",
    displayName: "Forge & Stress-Test Idea",
    code: "FI",
    module: "Core",
    phase: "1-analysis",
    modelProfile: "deep-reasoning",
    precededBy: [],
    followedBy: ["bmad-spec", "bmad-build"],
    description: "Pressure-test an idea from multiple persona perspectives until it is ready for specification or implementation.",
    promptTemplate: (ctx) => `/bmad-forge-idea "Pressure-test our approach to ${ctx.activeFocus} in ${ctx.projectName} before committing to implementation"`
  },
  {
    skill: "bmad-prd",
    displayName: "Create, Edit & Validate PRD",
    code: "PRD",
    module: "BMad Method",
    phase: "2-planning",
    modelProfile: "deep-reasoning",
    precededBy: ["bmad-product-brief"],
    followedBy: ["bmad-ux", "bmad-architecture"],
    description: "Create a new PRD, update functional requirements when plans evolve, or validate an existing PRD against BMAD quality gates.",
    promptTemplate: (ctx) =>
      ctx.hasPrd
        ? `/bmad-prd "Validate and update the PRD for ${ctx.projectName} so all functional requirements and success metrics match current delivery"`
        : `/bmad-prd "Create a comprehensive Product Requirements Document (PRD) for ${ctx.projectName} (${ctx.techStack})"`
  },
  {
    skill: "bmad-ux",
    displayName: "Create or Enhance UX Design",
    code: "CU",
    module: "BMad Method",
    phase: "2-planning",
    modelProfile: "creative-ux",
    precededBy: ["bmad-prd"],
    followedBy: ["bmad-architecture", "bmad-build"],
    description: "Capture or refine UX design specifications into DESIGN.md (visual system) and EXPERIENCE.md (interaction flows and states).",
    promptTemplate: (ctx) => `/bmad-ux "Enhance the UI/UX design specifications (DESIGN.md and EXPERIENCE.md) of ${ctx.projectName} focusing on ${ctx.uxFocus}"`
  },
  {
    skill: "bmad-spec",
    displayName: "Distill or Validate Concise Spec",
    code: "SPC",
    module: "BMad Method",
    phase: "2-planning",
    modelProfile: "deep-reasoning",
    precededBy: [],
    followedBy: ["bmad-architecture", "bmad-create-epics-and-stories"],
    description: "Condense notes, briefs, or requirements into a sharp SPEC.md and companion artifacts, or validate an existing spec.",
    promptTemplate: (ctx) => `/bmad-spec "Distill and validate the specification for ${ctx.activeFocus} in ${ctx.projectName}"`
  },
  {
    skill: "bmad-architecture",
    displayName: "Technical Architecture Spine",
    code: "CA",
    module: "BMad Method",
    phase: "3-solutioning",
    modelProfile: "deep-reasoning",
    precededBy: ["bmad-prd", "bmad-ux"],
    followedBy: ["bmad-create-epics-and-stories"],
    description: "Record or update the technical architecture decisions that keep layers, data access, UI patterns, and epics consistent.",
    promptTemplate: (ctx) =>
      ctx.hasArch
        ? `/bmad-architecture "Review and update the technical architecture document of ${ctx.projectName} for consistency with ${ctx.activeFocus}"`
        : `/bmad-architecture "Create the technical architecture spine for ${ctx.projectName} (${ctx.techStack}) covering layers, data flow, and conventions"`
  },
  {
    skill: "bmad-create-epics-and-stories",
    displayName: "Create Epics & User Stories",
    code: "CE",
    module: "BMad Method",
    phase: "3-solutioning",
    modelProfile: "deep-reasoning",
    precededBy: ["bmad-architecture"],
    followedBy: ["bmad-sprint-planning"],
    description: "Decompose PRD requirements and architecture decisions into ordered epics and testable user stories with acceptance criteria.",
    promptTemplate: (ctx) => `/bmad-create-epics-and-stories "Break down the requirements and architecture of ${ctx.projectName} into ordered epics and user stories with acceptance criteria"`
  },
  {
    skill: "bmad-sprint-planning",
    displayName: "Sprint Planning & Readiness Check",
    code: "SP",
    module: "BMad Method",
    phase: "3-solutioning",
    modelProfile: "planning-fast",
    precededBy: ["bmad-create-epics-and-stories"],
    followedBy: ["bmad-build"],
    description: "Check planning completeness (PASS/CONCERNS/FAIL), summarize sprint progress, and synchronize or repair sprint tracking artifacts.",
    promptTemplate: (ctx) => `/bmad-sprint-planning "Summarize sprint progress for ${ctx.projectName}, reconcile tracker statuses with delivered code and artifacts, and identify the next priority action"`
  },
  {
    skill: "bmad-build",
    displayName: "Build Story or Feature",
    code: "BD",
    module: "BMad Method",
    phase: "4-implementation",
    modelProfile: "agentic-coding",
    precededBy: ["bmad-sprint-planning"],
    followedBy: ["bmad-code-review", "bmad-qa-generate-e2e-tests"],
    description: "Standard BMAD implementation flow: clarify intent, create story plan, implement with tests, self-review, and present results.",
    promptTemplate: (ctx) => `/bmad-build "${ctx.nextStoryPrompt}"`
  },
  {
    skill: "bmad-code-review",
    displayName: "Multi-Lens Code Review",
    code: "CR",
    module: "BMad Method",
    phase: "4-implementation",
    modelProfile: "deep-reasoning",
    precededBy: ["bmad-build"],
    followedBy: ["bmad-retrospective", "bmad-walkthrough"],
    description: "Run independent code review lenses in parallel (adversarial critique, edge cases, verification gaps, architecture compliance) and triage findings.",
    promptTemplate: (ctx) => `/bmad-code-review "Review the latest implementation changes in ${ctx.projectName} (${ctx.activeFocus}) for defects, edge cases, and architectural compliance"`
  },
  {
    skill: "bmad-review",
    displayName: "Artifact & Diff Multi-Lens Review",
    code: "RV",
    module: "Core",
    phase: "4-implementation",
    modelProfile: "deep-reasoning",
    precededBy: [],
    followedBy: [],
    description: "Review any diff, branch, PRD, spec, story plan, or architecture document using adversarial critique, edge-case, and verification lenses.",
    promptTemplate: (ctx) => `/bmad-review "Run a thorough multi-lens review on ${ctx.activeFocus} in ${ctx.projectName} and report triaged findings"`
  },
  {
    skill: "bmad-walkthrough",
    displayName: "Human Review Walkthrough",
    code: "WT",
    module: "BMad Method",
    phase: "4-implementation",
    modelProfile: "planning-fast",
    precededBy: ["bmad-build"],
    followedBy: [],
    description: "Guided walkthrough of a recent change from purpose and architecture down to key files and manual verification steps.",
    promptTemplate: (ctx) => `/bmad-walkthrough "Walk me through the recent changes in ${ctx.projectName} (${ctx.activeFocus}) and how to verify them"`
  },
  {
    skill: "bmad-qa-generate-e2e-tests",
    displayName: "Generate Automated QA & E2E Tests",
    code: "QA",
    module: "BMad Method",
    phase: "4-implementation",
    modelProfile: "agentic-coding",
    precededBy: ["bmad-build"],
    followedBy: ["bmad-retrospective"],
    description: "Generate automated integration, API, and end-to-end verification tests for implemented stories and workflows.",
    promptTemplate: (ctx) => `/bmad-qa-generate-e2e-tests "Create automated QA and E2E verification tests for ${ctx.activeFocus} in ${ctx.projectName}"`
  },
  {
    skill: "bmad-retrospective",
    displayName: "Epic Retrospective & Acceptance",
    code: "ER",
    module: "BMad Method",
    phase: "4-implementation",
    modelProfile: "deep-reasoning",
    precededBy: ["bmad-code-review"],
    followedBy: [],
    description: "Review a completed epic against its spec, stories, diffs, commits, and test results to produce an evidence-backed retrospective.",
    promptTemplate: (ctx) => `/bmad-retrospective "${ctx.retroPrompt}"`
  },
  {
    skill: "bmad-correct-course",
    displayName: "Mid-Sprint Course Correction",
    code: "CC",
    module: "BMad Method",
    phase: "2-planning",
    modelProfile: "deep-reasoning",
    precededBy: [],
    followedBy: ["bmad-sprint-planning"],
    description: "Assess a significant scope, UX, or technical change during execution and produce a coordinated change proposal across PRD, UX, and epics.",
    promptTemplate: (ctx) => `/bmad-correct-course "Assess the impact of recent changes on ${ctx.projectName}'s PRD, architecture, and remaining stories"`
  },
  {
    skill: "bmad-party-mode",
    displayName: "Multi-Agent Party Mode Roundtable",
    code: "PM",
    module: "Core",
    phase: "anytime",
    modelProfile: "deep-reasoning",
    precededBy: [],
    followedBy: [],
    description: "Convene multiple BMAD specialist personas (John PM, Winston Architect, Sally UX, Amelia Dev, Murat QA) for a collaborative roundtable.",
    promptTemplate: (ctx) => `/bmad-party-mode "Convene Winston (Architect), Sally (UX), Amelia (Dev), and Murat (Test Architect) to align on ${ctx.activeFocus} in ${ctx.projectName}"`
  },
  {
    skill: "bmad-advanced-elicitation",
    displayName: "Advanced Elicitation Critique",
    code: "AE",
    module: "Core",
    phase: "anytime",
    modelProfile: "deep-reasoning",
    precededBy: [],
    followedBy: [],
    description: "Push a draft, plan, or design past its first version using Pre-Mortem, First Principles, Red Team, or Socratic questioning.",
    promptTemplate: (ctx) => `/bmad-advanced-elicitation "Apply Pre-Mortem and Red Team analysis to our current plan for ${ctx.activeFocus}"`
  },
  {
    skill: "bmad-testarch-test-design",
    displayName: "TEA Risk-Based Test Design",
    code: "TD",
    module: "Test Architecture",
    phase: "3-solutioning",
    modelProfile: "deep-reasoning",
    precededBy: ["bmad-architecture"],
    followedBy: ["bmad-testarch-atdd"],
    description: "Create a risk-based system or epic test strategy identifying P0/P1 risks and verification boundaries.",
    promptTemplate: (ctx) => `/bmad-testarch-test-design "Create a risk-based test plan for ${ctx.activeFocus} in ${ctx.projectName}"`
  },
  {
    skill: "bmad-testarch-atdd",
    displayName: "TEA Acceptance Test-Driven Dev (ATDD)",
    code: "AT",
    module: "Test Architecture",
    phase: "4-implementation",
    modelProfile: "agentic-coding",
    precededBy: ["bmad-testarch-test-design"],
    followedBy: ["bmad-build"],
    description: "Generate failing red-phase acceptance test scaffolds from story acceptance criteria before writing production code.",
    promptTemplate: (ctx) => `/bmad-testarch-atdd "Generate acceptance test scaffolds for ${ctx.nextStoryTitle} in ${ctx.projectName}"`
  },
  {
    skill: "bmad-testarch-trace",
    displayName: "TEA Requirements Traceability & Gate",
    code: "TR",
    module: "Test Architecture",
    phase: "4-implementation",
    modelProfile: "deep-reasoning",
    precededBy: ["bmad-code-review"],
    followedBy: ["bmad-retrospective"],
    description: "Generate a requirements-to-tests traceability matrix and release quality gate decision.",
    promptTemplate: (ctx) => `/bmad-testarch-trace "Generate a traceability matrix mapping requirements to unit and E2E tests in ${ctx.projectName}"`
  },
  {
    skill: "bmad-testarch-nfr",
    displayName: "TEA Non-Functional Requirements Audit",
    code: "NR",
    module: "Test Architecture",
    phase: "4-implementation",
    modelProfile: "deep-reasoning",
    precededBy: ["bmad-build"],
    followedBy: [],
    description: "Audit evidence for performance, security, reliability, and maintainability non-functional requirements.",
    promptTemplate: (ctx) => `/bmad-testarch-nfr "Audit non-functional requirements (performance, security, reliability, and UX accessibility) in ${ctx.projectName}"`
  }
];

export const BMAD_AGENTS_CATALOG = [
  { skill: "bmad-agent-pm", name: "John", title: "Product Manager", icon: "📋", module: "bmm", modelProfile: "deep-reasoning", focus: "PRD, Jobs-to-be-Done, prioritization, and scope validation" },
  { skill: "bmad-agent-architect", name: "Winston", title: "System Architect", icon: "🏗️", module: "bmm", modelProfile: "deep-reasoning", focus: "System architecture, boundaries, data models, and technical trade-offs" },
  { skill: "bmad-agent-ux-designer", name: "Sally", title: "UX Designer", icon: "🎨", module: "bmm", modelProfile: "creative-ux", focus: "DESIGN.md, EXPERIENCE.md, interaction flows, and UI accessibility" },
  { skill: "bmad-agent-dev", name: "Amelia", title: "Senior Software Engineer", icon: "💻", module: "bmm", modelProfile: "agentic-coding", focus: "TDD story implementation, clean builds, and defect resolution" },
  { skill: "bmad-agent-analyst", name: "Mary", title: "Business Analyst", icon: "📊", module: "bmm", modelProfile: "planning-fast", focus: "Domain rules, business requirements, and stakeholder analysis" },
  { skill: "bmad-tea", name: "Murat", title: "Master Test Architect", icon: "🧪", module: "tea", modelProfile: "deep-reasoning", focus: "Risk-based test strategy, ATDD, regression gates, and traceability" }
];

function safeReadText(filePath, maxBytes = 120000) {
  try {
    if (!existsSync(filePath)) return "";
    const st = statSync(filePath);
    if (!st.isFile()) return "";
    const content = readFileSync(filePath, "utf8");
    return content.length > maxBytes ? content.slice(0, maxBytes) : content;
  } catch {
    return "";
  }
}

// Shared tool-error text extraction so every surfaced error has one shape.
export function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

function findRuntimeBuiltinConfigPath() {
  const v2RuntimeDir = join(homedir(), ".zcode", "v2", "runtime", "provider");
  const candidates = [];
  function walkRuntime(dir, depth = 0) {
    if (depth > 4 || !existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkRuntime(full, depth + 1);
        else if (entry.isFile() && entry.name === "zcode-builtin.json") {
          candidates.push({ full, mtimeMs: statSync(full).mtimeMs });
        }
      }
    } catch {}
  }
  walkRuntime(v2RuntimeDir, 0);
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (candidates.length > 0) return candidates[0].full;

  const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  const bundledCandidates = [
    join(localAppData, "Programs", "ZCode", "resources", "config", "provider", "zcode-builtin.json"),
    "/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json",
    "/opt/ZCode/resources/config/provider/zcode-builtin.json"
  ];
  for (const candidate of bundledCandidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function classifyModelCostTier(modelId) {
  const id = String(modelId || "").toLowerCase();
  if (/(?:^|[-_.])(?:flash|lite|mini|haiku|air|argon|oss)(?:$|[-_.])/.test(id)) {
    return "economy";
  }
  if (/(?:^|[-_.])(?:opus|xhigh|thinking|pro|max)(?:$|[-_.])/.test(id)) {
    return "premium";
  }
  return "standard";
}

function normalizeHostModelEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (entry.id) return entry;
  const pid = String(entry.providerId || "").trim();
  const mid = String(entry.modelId || "").trim();
  if (!pid || !mid) return null;
  return { ...entry, id: `${pid}/${mid}` };
}

/**
 * Keep a complete model catalog when an advisor update carries only a subset.
 * Incoming lists that are at least as large as the stored one replace it;
 * smaller lists merge by id so a partial ListModels read never hides models.
 */
export function mergeHostModelCatalogs(existing = [], incoming = []) {
  const base = (Array.isArray(existing) ? existing : []).map(normalizeHostModelEntry).filter(Boolean);
  const next = (Array.isArray(incoming) ? incoming : []).map(normalizeHostModelEntry).filter(Boolean);
  if (next.length >= base.length) return next;
  const byId = new Map(base.map((m) => [m.id, m]));
  for (const model of next) {
    byId.set(model.id, { ...(byId.get(model.id) || {}), ...model });
  }
  return [...byId.values()];
}

export function applyModelHealthFromQueue(models = [], queueItems = [], now = Date.now()) {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const latest = new Map();
  for (const item of Array.isArray(queueItems) ? queueItems : []) {
    if (!item || item.status !== "failed") continue;
    const summary = String(item.resultSummary || "");
    if (!/rate.?limit|\b429\b|quota/i.test(summary)) continue;
    const timestamp = Date.parse(item.completedAt || item.startedAt || "") || 0;
    if (timestamp < cutoff) continue;
    const modelId = String(item.model || "");
    if (!modelId) continue;
    if (!latest.has(modelId) || latest.get(modelId) < timestamp) {
      latest.set(modelId, timestamp);
    }
  }
  for (const model of Array.isArray(models) ? models : []) {
    if (!model || !latest.has(model.id)) continue;
    model.rateLimited = true;
    model.rateLimitedAt = new Date(latest.get(model.id)).toISOString();
  }
  return models;
}

export function discoverConfiguredModels(persistedHostModels = null) {
  const zcodeV2Dir = join(homedir(), ".zcode", "v2");
  const providerCfgPath = join(zcodeV2Dir, "provider_config.json");
  const settingPath = join(zcodeV2Dir, "setting.json");
  const credentialsPath = join(zcodeV2Dir, "credentials.json");
  const builtinPath = findRuntimeBuiltinConfigPath();

  const personalCfg = existsSync(providerCfgPath)
    ? JSON.parse(safeReadText(providerCfgPath, 400000) || "{}")
    : {};
  const settingCfg = existsSync(settingPath)
    ? JSON.parse(safeReadText(settingPath, 200000) || "{}")
    : {};
  const credsCfg = existsSync(credentialsPath)
    ? JSON.parse(safeReadText(credentialsPath, 200000) || "{}")
    : {};
  const builtinCfg = builtinPath
    ? JSON.parse(safeReadText(builtinPath, 500000) || "{}")
    : {};

  // 1. Collect builtin regex model rules (for capability enrichment: contextWindow, reasoningLevels, supportsImage, etc.)
  const builtinRegexRules = builtinCfg?.config?.modelConfigRules?.modelRules || [];
  const builtinProviderModelRules = builtinCfg?.config?.modelConfigRules?.builtinProviderModelRules || [];
  const personalModelRules = [
    ...(personalCfg?.config?.modelConfigRules?.providerModelRules || []),
    ...(personalCfg?.config?.modelConfigRules?.manualProviderModelRules || [])
  ];

  function resolveModelCapabilities(providerId, modelId) {
    let enabled = true;
    let properties = {
      contextWindow: 128000,
      inputFormat: { supportsText: true, supportsImage: false, supportsVideo: false, supportsPdf: false },
      supportsToolCall: true,
      supportsJsonSchemaOutput: false,
      supportsNativeWebSearch: false
    };
    let reasoningLevels = ["disabled", "enabled"];

    // Apply builtin regex rules in order
    for (const r of builtinRegexRules) {
      if (!r?.modelMatch) continue;
      try {
        const re = new RegExp(`^(?:${r.modelMatch})$`, "i");
        if (re.test(modelId)) {
          if (typeof r.config?.enabled === "boolean") enabled = r.config.enabled;
          if (r.config?.properties) {
            properties = {
              ...properties,
              ...r.config.properties,
              inputFormat: {
                ...properties.inputFormat,
                ...(r.config.properties.inputFormat || {})
              }
            };
          }
          if (Array.isArray(r.config?.optionSpecs?.reasoningLevel?.values)) {
            reasoningLevels = [...r.config.optionSpecs.reasoningLevel.values];
          }
        }
      } catch {}
    }

    // Apply builtin provider-specific model rules
    for (const r of builtinProviderModelRules) {
      if (r.providerId === providerId && r.modelId === modelId) {
        if (typeof r.config?.enabled === "boolean") enabled = r.config.enabled;
      }
    }

    // Overlay user's personal model rules from provider_config.json
    for (const r of personalModelRules) {
      if (r.providerId === providerId && r.modelId === modelId) {
        if (typeof r.config?.enabled === "boolean") enabled = r.config.enabled;
        if (r.config?.properties) {
          properties = {
            ...properties,
            ...r.config.properties,
            inputFormat: {
              ...properties.inputFormat,
              ...(r.config.properties.inputFormat || {})
            }
          };
        }
        if (Array.isArray(r.config?.optionSpecs?.reasoningLevel?.values)) {
          reasoningLevels = [...r.config.optionSpecs.reasoningLevel.values];
        }
      }
    }

    return {
      enabled,
      contextWindow: properties.contextWindow || 128000,
      supportsImage: Boolean(properties.inputFormat?.supportsImage),
      supportsVideo: Boolean(properties.inputFormat?.supportsVideo),
      supportsPdf: Boolean(properties.inputFormat?.supportsPdf),
      supportsNativeWebSearch: Boolean(properties.supportsNativeWebSearch),
      supportsJsonSchemaOutput: Boolean(properties.supportsJsonSchemaOutput),
      supportsToolCall: properties.supportsToolCall !== false,
      reasoningLevels,
      defaultReasoningLevel: reasoningLevels.at(-1) || "enabled"
    };
  }

  const discovered = [];
  const seen = new Set();

  function registerCandidate({
    providerId,
    providerName,
    providerKind,
    subscriptionPlan,
    modelId,
    caps,
    isCurrent = false
  }) {
    const fullId = `${providerId}/${modelId}`;
    if (!providerId || !modelId || seen.has(fullId) || !caps.enabled) return;
    seen.add(fullId);
    discovered.push({
      id: fullId,
      providerId,
      providerName: providerName || providerId,
      providerKind, // "personal" | "subscription" | "host-runtime"
      subscriptionPlan: subscriptionPlan || null,
      modelId,
      label: `${modelId} · ${providerName || providerId}`,
      costTier: classifyModelCostTier(modelId),
      contextWindow: caps.contextWindow,
      supportsImage: caps.supportsImage,
      supportsVideo: caps.supportsVideo,
      supportsPdf: caps.supportsPdf,
      supportsNativeWebSearch: caps.supportsNativeWebSearch,
      supportsJsonSchemaOutput: caps.supportsJsonSchemaOutput,
      reasoningLevels: caps.reasoningLevels,
      defaultReasoningLevel: caps.defaultReasoningLevel,
      current: isCurrent,
      orderIndex: discovered.length
    });
  }

  const familySelections = settingCfg?.providerFamilyConnectionSelections || {};
  const hasZaiAuth = Boolean(credsCfg["oauth:zai:access_token"] || credsCfg["zcodejwttoken"]);
  const hasBigmodelAuth = Boolean(credsCfg["oauth:bigmodel:access_token"]);

  // 2. Evaluate active Subscription / Account providers based on credentials.json + setting.json
  const personalProviderRules = personalCfg?.config?.providerConfigRules?.providerRules || [];
  const personalProviderMap = new Map(personalProviderRules.map((p) => [p.providerId, p]));
  const providerOrder = personalCfg?.config?.providerOrder || [];

  const activeProvidersSummary = [];
  const personalProviderConfiguredCount = personalProviderRules.filter(
    (pr) => pr.enabled !== false && pr.config?.enabled !== false && pr.config?.visibility !== "hidden" &&
      (pr.config?.access?.type !== "api-key" || String(pr.config?.access?.apiKey || "").trim())
  ).length;

  const builtinProviders = builtinCfg?.config?.providerConfigRules?.providerRules || [];
  for (const bp of builtinProviders) {
    const pid = bp.providerId;
    const access = bp.config?.access || {};
    if (access.type !== "zhipu-account") continue;

    const family = access.accountType; // "zai" | "bigmodel"
    const mode = access.mode; // "individual-coding-plan" | "team-coding-plan" | "start-plan" | ...
    const isAuthenticated = family === "zai" ? hasZaiAuth : family === "bigmodel" ? hasBigmodelAuth : false;
    const selectedMode = familySelections?.[family]?.kind;

    const personalOverride = personalProviderMap.get(pid);
    if (personalOverride && (personalOverride.enabled === false || personalOverride.config?.enabled === false)) {
      continue;
    }

    const planMatches = selectedMode ? selectedMode === mode : mode === "start-plan";
    if (!isAuthenticated || !planMatches) continue;

    const hasCodingPlanEntitlement = Object.keys(credsCfg).some(
      (k) => k.startsWith("project-key-location:") && k.includes(`%22${family}%22`)
    );
    const explicitlyInProviderOrder = providerOrder.includes(pid);
    if ((mode === "individual-coding-plan" || mode === "team-coding-plan") && !hasCodingPlanEntitlement) {
      continue;
    }
    if (personalProviderConfiguredCount > 0 && providerOrder.length > 0 && !explicitlyInProviderOrder && mode === "start-plan") {
      continue;
    }

    const modelIds = bp.config?.builtinModelIds || [];
    let addedCount = 0;
    for (const mid of modelIds) {
      const caps = resolveModelCapabilities(pid, mid);
      const beforeLen = discovered.length;
      registerCandidate({
        providerId: pid,
        providerName: bp.providerName || pid,
        providerKind: "subscription",
        subscriptionPlan: mode,
        modelId: mid,
        caps
      });
      if (discovered.length > beforeLen) addedCount++;
    }
    if (addedCount > 0) {
      activeProvidersSummary.push({
        providerId: pid,
        providerName: bp.providerName || pid,
        kind: "subscription",
        plan: mode,
        modelCount: addedCount
      });
    }
  }

  // 3. Evaluate active Personal / Custom Providers in providerOrder
  const orderedPersonalRules = [
    ...providerOrder.map((id) => personalProviderMap.get(id)).filter(Boolean),
    ...personalProviderRules.filter((p) => !providerOrder.includes(p.providerId))
  ];

  for (const pr of orderedPersonalRules) {
    const pid = pr.providerId;
    const pConfig = pr.config || {};
    if (pr.enabled === false || pConfig.enabled === false || pConfig.visibility === "hidden") {
      continue;
    }
    if (pConfig.access?.type === "api-key" && !String(pConfig.access?.apiKey || "").trim()) {
      continue;
    }

    const rawModelIds = [
      ...(pConfig.modelOrder || []),
      ...(pConfig.personalModelIds || []),
      ...(pConfig.builtinModelIds || []),
      ...personalModelRules.filter((m) => m.providerId === pid).map((m) => m.modelId)
    ];
    const uniqueModelIds = [...new Set(rawModelIds)];

    let addedCount = 0;
    for (const mid of uniqueModelIds) {
      const caps = resolveModelCapabilities(pid, mid);
      const beforeLen = discovered.length;
      registerCandidate({
        providerId: pid,
        providerName: pr.providerName || pid,
        providerKind: "personal",
        subscriptionPlan: pConfig.group || "custom-provider",
        modelId: mid,
        caps
      });
      if (discovered.length > beforeLen) addedCount++;
    }
    if (addedCount > 0) {
      activeProvidersSummary.push({
        providerId: pid,
        providerName: pr.providerName || pid,
        kind: "personal",
        plan: pConfig.group || "api-key",
        modelCount: addedCount
      });
    }
  }

  // 4. Overlay the live host catalog. Live entries override matching disk models
  //    (including explicit disabledReason exclusions), while a partial advisor
  //    update still preserves unrelated models that disk discovery already found.
  const allRuntimeEntries = (Array.isArray(persistedHostModels) ? persistedHostModels : [])
    .map((hm) => {
      const normalized = normalizeHostModelEntry(hm);
      if (!normalized) return null;
      const pid = normalized.providerId || String(normalized.id).split("/")[0];
      const mid = normalized.modelId || String(normalized.id).split("/").slice(1).join("/");
      if (!pid || !mid) return null;
      return { ...normalized, id: `${pid}/${mid}`, providerId: pid, modelId: mid };
    })
    .filter(Boolean);

  const disabledRuntimeIds = new Set(
    allRuntimeEntries.filter((hm) => hm.disabledReason).map((hm) => hm.id)
  );
  let runtimeDisabledCount = 0;
  if (disabledRuntimeIds.size > 0) {
    for (let i = discovered.length - 1; i >= 0; i--) {
      if (disabledRuntimeIds.has(discovered[i].id)) {
        const removed = discovered.splice(i, 1)[0];
        seen.delete(removed.id);
        runtimeDisabledCount += 1;
        const row = activeProvidersSummary.find((p) => p.providerId === removed.providerId);
        if (row) row.modelCount = Math.max(0, row.modelCount - 1);
      }
    }
    for (let i = activeProvidersSummary.length - 1; i >= 0; i--) {
      if (activeProvidersSummary[i].modelCount <= 0) {
        activeProvidersSummary.splice(i, 1);
      }
    }
  }

  const runtimeModels = allRuntimeEntries.filter((hm) => !hm.disabledReason);
  let runtimeMerged = 0;
  const runtimeAddedCounts = new Map();

  for (const hm of runtimeModels) {
    const pid = hm.providerId;
    const mid = hm.modelId;
    const fullId = hm.id;
    const baseCaps = resolveModelCapabilities(pid, mid);
    const runtimeCaps = {
      ...baseCaps,
      enabled: true,
      contextWindow: hm.contextWindow || baseCaps.contextWindow,
      reasoningLevels:
        Array.isArray(hm.reasoningLevels) && hm.reasoningLevels.length > 0
          ? hm.reasoningLevels
          : baseCaps.reasoningLevels,
      defaultReasoningLevel: hm.defaultReasoningLevel || baseCaps.defaultReasoningLevel
    };
    const existing = discovered.find((m) => m.id === fullId);
    if (existing) {
      existing.contextWindow = runtimeCaps.contextWindow;
      existing.reasoningLevels = runtimeCaps.reasoningLevels;
      existing.defaultReasoningLevel = runtimeCaps.defaultReasoningLevel;
      if (hm.providerLabel) {
        existing.providerName = hm.providerLabel;
        existing.label = `${existing.modelId} · ${hm.providerLabel}`;
        const row = activeProvidersSummary.find((p) => p.providerId === pid);
        if (row) row.providerName = hm.providerLabel;
      }
      existing.costTier = classifyModelCostTier(mid);
      if (typeof hm.current === "boolean") existing.current = hm.current;
      runtimeMerged += 1;
    } else {
      const beforeLen = discovered.length;
      registerCandidate({
        providerId: pid,
        providerName: hm.providerLabel || pid,
        providerKind: pid.startsWith("account:") ? "subscription" : "personal",
        subscriptionPlan: pid.startsWith("account:") ? pid.replace(/^account:/, "") : "runtime",
        modelId: mid,
        caps: runtimeCaps,
        isCurrent: Boolean(hm.current)
      });
      if (discovered.length > beforeLen) {
        runtimeMerged += 1;
        runtimeAddedCounts.set(pid, (runtimeAddedCounts.get(pid) || 0) + 1);
      }
    }
  }

  for (const [pid, count] of runtimeAddedCounts) {
    const row = activeProvidersSummary.find((p) => p.providerId === pid);
    if (row) {
      row.modelCount += count;
    } else {
      const sample = runtimeModels.find((hm) => hm.providerId === pid);
      activeProvidersSummary.push({
        providerId: pid,
        providerName: sample?.providerLabel || pid,
        kind: pid.startsWith("account:") ? "subscription" : "personal",
        plan: pid.startsWith("account:") ? pid.replace(/^account:/, "") : "runtime",
        modelCount: count
      });
    }
  }

  return {
    models: discovered,
    providerState: {
      activeProviders: activeProvidersSummary,
      subscriptionSelections: familySelections,
      hasZaiAuth,
      hasBigmodelAuth,
      syncedFromRuntime: runtimeMerged > 0 || runtimeDisabledCount > 0
    }
  };
}

export function scoreModelForBmadProfile(model, profile) {
  const idLower = String(model.modelId || "").toLowerCase();
  const levels = model.reasoningLevels || [];
  const ctxWin = Number(model.contextWindow || 128000);

  // 1. Dynamic Reasoning Capability Score (from optionSpecs.reasoningLevel + generic capability tokens)
  let reasoningScore = 0;
  if (levels.includes("max") || levels.includes("xhigh")) reasoningScore += 5;
  else if (levels.includes("high")) reasoningScore += 3.5;
  else if (levels.includes("enabled")) reasoningScore += 2;

  if (/(?:^|[-_.])(?:xhigh|max|thinking|reasoner|r1|o1|o3|pro|opus)(?:$|[-_.])/i.test(idLower)) {
    reasoningScore += 4;
  } else if (/(?:^|[-_.])(?:high|sonnet|hydrogen|plus)(?:$|[-_.])/i.test(idLower)) {
    reasoningScore += 2.5;
  } else if (/(?:^|[-_.])(?:medium|argon|turbo)(?:$|[-_.])/i.test(idLower)) {
    reasoningScore += 1;
  }
  if (/(?:^|[-_.])(?:low|lite|nano|mini|air)(?:$|[-_.])/i.test(idLower)) {
    reasoningScore -= 2.5;
  }
  if (/image/i.test(idLower) && ctxWin < 100000) {
    reasoningScore -= 4;
  }

  // 2. Context Window Score (normalized 0..4)
  const contextScore = Math.min(4, Math.log2(Math.max(16384, ctxWin) / 16384) * 0.65);

  // 3. Multimodal & Visual Score
  let visualScore = 0;
  if (model.supportsImage) visualScore += 3;
  if (model.supportsPdf) visualScore += 1.5;
  if (model.supportsVideo) visualScore += 1;
  if (model.supportsNativeWebSearch) visualScore += 1.5;
  if (/(?:^|[-_.])(?:vl|vision|omni|hydrogen|opus|sonnet)(?:$|[-_.])/i.test(idLower)) {
    visualScore += 1.5;
  }

  // 4. Agentic Coding & Structured Execution Score
  let codingScore = 0;
  if (model.supportsJsonSchemaOutput) codingScore += 2.5;
  if (model.supportsToolCall !== false) codingScore += 1.5;
  if (/(?:^|[-_.])(?:codex|code|sonnet|opus|argon|deepseek|qwen|glm-5\.3)(?:$|[-_.])/i.test(idLower)) {
    codingScore += 2.5;
  }
  if (/(?:^|[-_.])(?:high)(?:$|[-_.])/i.test(idLower)) {
    codingScore += 1.5;
  }
  if (/(?:^|[-_.])(?:low|lite|image)(?:$|[-_.])/i.test(idLower)) {
    codingScore -= 2.5;
  }

  // 5. Speed & Throughput Score
  let speedScore = 0;
  if (/(?:^|[-_.])(?:flash|turbo|argon|mini|haiku|air|lite)(?:$|[-_.])/i.test(idLower)) {
    speedScore += 4.5;
  }
  if (/gemini/i.test(idLower) && /(?:flash|argon|lite)/i.test(idLower)) {
    speedScore += 3.5;
  }
  if (/(?:^|[-_.])(?:high|medium)(?:$|[-_.])/i.test(idLower) && !/opus|sonnet|xhigh/i.test(idLower)) {
    speedScore += 1.0;
  }
  if (/image/i.test(idLower) && ctxWin < 100000) {
    speedScore -= 5;
  }

  // 6. Cost-Efficiency Score (avoids spending expensive Opus/Sonnet/xhigh models on simple tasks)
  let costEfficiencyScore = 0;
  if (/gemini/i.test(idLower) && /(?:flash|argon)/i.test(idLower)) {
    costEfficiencyScore += 5.0;
    if (/(?:^|[-_.])(?:argon|flash)(?:$|[-_.])/i.test(idLower) && !/(?:xhigh|high|lite)/i.test(idLower)) {
      costEfficiencyScore += 1.5; // sweet-spot standard Gemini Argon / Flash
    }
  } else if (/(?:flash|mini|haiku|air|lite)/i.test(idLower)) {
    costEfficiencyScore += 3.0;
  }
  if (/(?:opus|xhigh|max|thinking|(?:^|[-_.])pro(?:$|[-_.]))/i.test(idLower)) {
    costEfficiencyScore -= 6.0;
  } else if (/sonnet/i.test(idLower)) {
    costEfficiencyScore -= 4.0;
  }

  // Slight tie-breaker preference for current model or earlier provider order
  const orderBonus = Math.max(0, 1 - (model.orderIndex || 0) * 0.02) + (model.current ? 0.4 : 0);

  if (profile === "deep-reasoning") {
    return reasoningScore * 3.0 + contextScore * 2.0 + (model.supportsJsonSchemaOutput ? 2 : 0) + costEfficiencyScore * 1.2 + orderBonus;
  }
  if (profile === "creative-ux") {
    const geminiUxBonus = /gemini/i.test(idLower) && /hydrogen/i.test(idLower) ? 6.0 : 0;
    return visualScore * 3.0 + geminiUxBonus + reasoningScore * 1.6 + contextScore * 1.5 + costEfficiencyScore * 1.6 + orderBonus;
  }
  if (profile === "agentic-coding") {
    const balancedCodingBonus = /sonnet|codex/i.test(idLower) ? 2.5 : 0;
    return codingScore * 3.0 + balancedCodingBonus + reasoningScore * 1.6 + contextScore * 1.5 + speedScore * 0.9 + costEfficiencyScore * 2.0 + orderBonus;
  }
  // "planning-fast": simple, synthesis, planning, triage, and walkthrough tasks — prefer fast cost-effective Gemini Flash/Argon
  return costEfficiencyScore * 3.2 + speedScore * 2.5 + contextScore * 1.2 + orderBonus;
}

export function recommendModelForBmadSkill(skillName, availableModels, customProfile) {
  const cleanSkill = String(skillName || "").replace(/^\//, "").toLowerCase();
  const catalogEntry = BMAD_SKILLS_CATALOG.find((s) => s.skill === cleanSkill);
  const profile =
    customProfile ||
    catalogEntry?.modelProfile ||
    (/ux|design|brainstorm/i.test(cleanSkill)
      ? "creative-ux"
      : /build|qa|atdd|automate|dev/i.test(cleanSkill)
        ? "agentic-coding"
        : /arch|prd|review|retro|correct|party|elicit|prfaq|trace|nfr/i.test(cleanSkill)
          ? "deep-reasoning"
          : "planning-fast");

  const tierMeta = {
    "deep-reasoning": "🧠 Deep Reasoning & Architecture",
    "creative-ux": "🎨 UX & Visual Systems",
    "agentic-coding": "💻 Agentic Coding & TDD",
    "planning-fast": "⚡ Fast Planning & Synthesis"
  };

  if (!Array.isArray(availableModels) || availableModels.length === 0) {
    return {
      modelId: "",
      shortName: "host-default",
      providerName: "Default Provider",
      tier: tierMeta[profile] || "🤖 Dynamic Model",
      reason: "Uses your active ZCode session default model (no enabled provider rules detected on disk)."
    };
  }

  const healthy = availableModels.filter((m) => !m.rateLimited);
  const rankingPool = healthy.length > 0 ? healthy : availableModels;
  const ranked = [...rankingPool]
    .map((m) => ({
      model: m,
      score: scoreModelForBmadProfile(m, profile)
    }))
    .sort((a, b) => b.score - a.score);

  const picked = ranked[0].model;
  // Economy guard: when a premium model barely leads, prefer a cheaper model
  // within 10% of its score. Deep reasoning still gets a strong, balanced pick.
  const topScore = ranked[0].score;
  let finalPick = picked;
  if (profile === "deep-reasoning") {
    // Keep deep work on a balanced (standard-cost) model when one is close.
    // Avoid downgrading architecture or review work to a budget model.
    const balanced = ranked.find(
      (r) => (r.model.costTier || classifyModelCostTier(r.model.modelId)) === "standard" && r.score >= topScore * 0.9
    );
    if (balanced) finalPick = balanced.model;
  } else if ((picked.costTier || classifyModelCostTier(picked.modelId)) === "premium") {
    const cheaper = ranked.find(
      (r) => (r.model.costTier || classifyModelCostTier(r.model.modelId)) !== "premium" && r.score >= topScore * 0.9
    );
    if (cheaper) finalPick = cheaper.model;
  }
  const ctxK = Math.round((finalPick.contextWindow || 128000) / 1000);
  const capBadges = [
    `${ctxK}k ctx`,
    finalPick.reasoningLevels?.length > 2 ? `reasoning: ${finalPick.defaultReasoningLevel}` : null,
    finalPick.supportsImage ? "vision" : null,
    finalPick.supportsNativeWebSearch ? "web-search" : null
  ]
    .filter(Boolean)
    .join(", ");

  const costTier = finalPick.costTier || classifyModelCostTier(finalPick.modelId);
  const sourceDesc =
    finalPick.providerKind === "subscription"
      ? `active '${finalPick.providerName}' subscription`
      : `active '${finalPick.providerName}' provider`;

  return {
    modelId: finalPick.id,
    shortName: finalPick.modelId,
    providerName: finalPick.providerName,
    providerKind: finalPick.providerKind,
    costTier,
    tier: tierMeta[profile] || "🤖 Dynamic Fit",
    reason: `Dynamically ranked #1 among ${availableModels.length} available models from ${sourceDesc} (${capBadges}, ${costTier} cost) for ${cleanSkill || profile}.`
  };
}

function detectWorkspaceProfile(workspaceRoot) {
  let projectName = basename(workspaceRoot);
  const stacks = [];

  try {
    const rootEntries = existsSync(workspaceRoot) ? readdirSync(workspaceRoot) : [];
    const slnFile = rootEntries.find((f) => f.endsWith(".sln") || f.endsWith(".slnx"));
    if (slnFile) {
      stacks.push(".NET / C#");
      if (!projectName || projectName === ".") projectName = slnFile.replace(/\.slnx?$/i, "");
    }
    if (rootEntries.includes("package.json")) {
      const pkg = JSON.parse(safeReadText(join(workspaceRoot, "package.json")) || "{}");
      if (pkg.name && projectName === basename(workspaceRoot)) {
        projectName = pkg.name.replace(/^@[^/]+\//, "");
      }
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.react || deps.next || deps.vue || deps.svelte) stacks.push("Web / TypeScript / JS");
      else stacks.push("Node.js / JS");
    }
    if (rootEntries.includes("pyproject.toml") || rootEntries.includes("requirements.txt")) {
      stacks.push("Python");
    }
    if (rootEntries.includes("Cargo.toml")) {
      stacks.push("Rust");
    }
    if (rootEntries.includes("go.mod")) {
      stacks.push("Go");
    }
    if (rootEntries.includes("pom.xml") || rootEntries.includes("build.gradle") || rootEntries.includes("build.gradle.kts")) {
      stacks.push("Java / JVM");
    }
  } catch {}

  const configToml = safeReadText(join(workspaceRoot, "_bmad", "config.toml"));
  const projMatch = /project_name\s*=\s*"([^"]+)"/.exec(configToml);
  if (projMatch) projectName = projMatch[1];

  const bmmYaml = safeReadText(join(workspaceRoot, "_bmad", "bmm", "config.yaml"));
  const yamlProjMatch = /project_name:\s*["']?([^"'\r\n]+)["']?/.exec(bmmYaml);
  if (!projMatch && yamlProjMatch) projectName = yamlProjMatch[1].trim();

  return {
    projectName,
    techStack: stacks.length > 0 ? stacks.join(" · ") : "Software Project"
  };
}

function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return {};
  const meta = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    const commentIdx = val.indexOf(" #");
    if (commentIdx >= 0) val = val.slice(0, commentIdx).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else if (val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    }
    meta[key] = val;
  }
  return meta;
}

function stripTomlInlineComment(rawVal) {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let bracketDepth = 0;
  for (let i = 0; i < rawVal.length; i++) {
    const ch = rawVal[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inDouble && ch === "\\") {
      escaped = true;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
    } else if (!inDouble && ch === "'") {
      inSingle = !inSingle;
    } else if (!inSingle && !inDouble) {
      if (ch === "[") bracketDepth++;
      else if (ch === "]" && bracketDepth > 0) bracketDepth--;
      else if (ch === "#" && bracketDepth === 0) {
        return rawVal.slice(0, i).trim();
      }
    }
  }
  return rawVal.trim();
}

function parseTomlBlocks(tomlText, blockTag) {
  const blocks = [];
  const headerRegex = new RegExp(`^\\[\\[${blockTag}\\]\\]\\s*(?:#.*)?$`, "gm");
  const matches = [...tomlText.matchAll(headerRegex)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : tomlText.length;
    const chunk = tomlText.slice(start, end);
    const item = {};
    for (const rawLine of chunk.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const k = line.slice(0, eq).trim();
      let v = stripTomlInlineComment(line.slice(eq + 1).trim());
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      } else if (v.startsWith("[") && v.endsWith("]")) {
        v = v
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
      } else if (/^\d+$/.test(v)) {
        v = Number(v);
      } else if (v === "true" || v === "false") {
        v = v === "true";
      }
      item[k] = v;
    }
    blocks.push(item);
  }
  return blocks;
}

function parseSprintStatusYaml(yamlText) {
  const statusMap = {};
  let inDevStatus = false;
  for (const rawLine of yamlText.split(/\r?\n/)) {
    if (/^development_status:\s*$/.test(rawLine.trim())) {
      inDevStatus = true;
      continue;
    }
    if (!inDevStatus) continue;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cleanLine = trimmed.replace(/\s+#.*$/, "");
    const colonIdx = cleanLine.indexOf(":");
    if (colonIdx > 0) {
      const k = cleanLine.slice(0, colonIdx).trim();
      const v = cleanLine.slice(colonIdx + 1).trim();
      if (k && v) {
        statusMap[k] = v;
      }
    }
  }
  return statusMap;
}

function parseEpicsMarkdown(epicsMdText) {
  const epicTitles = {};
  const storyDetails = {};
  const epicHeaderRegex = /^##\s+Epic\s+(\d+)\s*[:—-]\s*(.+)$/gm;
  for (const m of epicsMdText.matchAll(epicHeaderRegex)) {
    epicTitles[m[1]] = m[2].trim();
  }
  const storyHeaderRegex = /^###\s+Story\s+(\d+)\.(\d+)\s*[:—-]\s*(.+)$/gm;
  for (const m of epicsMdText.matchAll(storyHeaderRegex)) {
    storyDetails[`${m[1]}-${m[2]}`] = {
      epicNum: Number(m[1]),
      storyNum: Number(m[2]),
      title: m[3].trim()
    };
  }
  return { epicTitles, storyDetails };
}

function normalizeStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (["done", "complete", "completed", "passed", "verified", "closed", "shipped", "built"].includes(s)) return "done";
  if (["in-review", "review", "testing", "qa"].includes(s)) return "review";
  if (["in-progress", "active", "doing", "started", "wip"].includes(s)) return "in-progress";
  if (["ready-for-dev", "ready"].includes(s)) return "ready";
  return "backlog";
}

export function parseTestReportSummary(text) {
  const fm = parseFrontmatter(text);
  const testSummaryMatch = /Total\s*:\s*(\d+)\s*,\s*Passed\s*:\s*(\d+)\s*,\s*Failed\s*:\s*(\d+)/i.exec(text);
  let failed = 0;
  let passed = 0;
  let total = 0;
  let found = false;

  if (fm && (fm.failCount !== undefined || fm.failed !== undefined)) {
    failed = Number(fm.failCount !== undefined ? fm.failCount : fm.failed) || 0;
    passed = Number(fm.passCount !== undefined ? fm.passCount : fm.passed) || 0;
    total = Number(fm.totalCount !== undefined ? fm.totalCount : (fm.total || (passed + failed))) || 0;
    found = true;
  } else if (testSummaryMatch) {
    total = Number(testSummaryMatch[1]);
    passed = Number(testSummaryMatch[2]);
    failed = Number(testSummaryMatch[3]);
    found = true;
  } else {
    const failMatch = /\bfailCount\s*[:=]\s*(\d+)/i.exec(text) || /\bfailed\s*[:=]\s*(\d+)/i.exec(text);
    if (failMatch) {
      failed = Number(failMatch[1]);
      found = true;
    }
    const passMatch = /\bpassCount\s*[:=]\s*(\d+)/i.exec(text) || /\bpassed\s*[:=]\s*(\d+)/i.exec(text);
    if (passMatch) {
      passed = Number(passMatch[1]);
    }
    total = passed + failed;
  }
  let failingSuiteName = "";
  if (failed > 0 && testSummaryMatch) {
    const suiteMatch = /([A-Za-z0-9_]+Tests)\b/.exec(text.slice(testSummaryMatch.index, testSummaryMatch.index + 500));
    if (suiteMatch) failingSuiteName = suiteMatch[1];
  }
  return { found, total, passed, failed, failingSuiteName };
}

function runGitInfo(workspaceRoot) {
  const info = {
    branch: "main",
    modifiedFiles: [],
    deletedBmadConfigFiles: 0,
    untrackedFiles: [],
    recentCommits: []
  };
  try {
    info.branch =
      execFileSync("git", ["-C", workspaceRoot, "rev-parse", "--abbrev-ref", "HEAD"], {
        encoding: "utf8",
        timeout: 3000,
        stdio: ["ignore", "pipe", "ignore"]
      }).trim() || "main";
  } catch {}
  try {
    const statusOut = execFileSync("git", ["-C", workspaceRoot, "status", "--porcelain"], {
      encoding: "utf8",
      timeout: 4000,
      stdio: ["ignore", "pipe", "ignore"]
    });
    for (const line of statusOut.split(/\r?\n/).filter(Boolean)) {
      const code = line.slice(0, 2);
      const file = line.slice(3).trim();
      if (code.includes("D") && file.startsWith("_bmad/")) {
        info.deletedBmadConfigFiles++;
      } else if (code === "??") {
        info.untrackedFiles.push(file);
      } else {
        info.modifiedFiles.push({ status: code.trim(), path: file });
      }
    }
  } catch {}
  try {
    const logOut = execFileSync("git", ["-C", workspaceRoot, "log", "-n", "12", "--oneline"], {
      encoding: "utf8",
      timeout: 4000,
      stdio: ["ignore", "pipe", "ignore"]
    });
    info.recentCommits = logOut
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const sp = line.indexOf(" ");
        return sp > 0 ? { sha: line.slice(0, sp), subject: line.slice(sp + 1) } : { sha: line, subject: "" };
      });
  } catch {}
  return info;
}

function walkFiles(dir, rootDir, maxDepth = 4, depth = 0, out = []) {
  if (depth > maxDepth || !existsSync(dir)) return out;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (
      entry.name.startsWith(".git") ||
      entry.name === "node_modules" ||
      entry.name === "bin" ||
      entry.name === "obj" ||
      entry.name === "plugins"
    ) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, rootDir, maxDepth, depth + 1, out);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if ([".md", ".toml", ".yaml", ".yml", ".csv", ".json"].includes(ext)) {
        const st = statSync(full);
        out.push({
          name: entry.name,
          relPath: relative(rootDir, full).replace(/\\/g, "/"),
          fullPath: full,
          size: st.size,
          mtimeMs: st.mtimeMs
        });
      }
    }
  }
  return out;
}

export function getStateFilePath(workspaceRoot, { ensureDir = true } = {}) {
  const dir = join(workspaceRoot, ".zcode", "bmad-companion");
  if (ensureDir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, "state.json");
}

export function loadPersistedState(workspaceRoot) {
  const file = getStateFilePath(workspaceRoot, { ensureDir: false });
  try {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, "utf8"));
    }
  } catch {}
  return {
    lastUserPrompt: "",
    lastUserPromptAt: null,
    lastAssistantMessage: "",
    lastTurnAnalyzedAt: null,
    recentTouchedFiles: [],
    turnCount: 0,
    agentAdvisorOverride: null,
    storyOverrides: {},
    lastLaunchedSession: null,
    taskQueue: createDefaultTaskQueueState()
  };
}

export function savePersistedState(workspaceRoot, partial) {
  const current = loadPersistedState(workspaceRoot);
  const merged = {
    ...current,
    ...partial,
    storyOverrides: {
      ...(current.storyOverrides || {}),
      ...(partial.storyOverrides || {})
    },
    taskQueue: partial.taskQueue
      ? {
          ...(current.taskQueue || {}),
          ...partial.taskQueue
        }
      : current.taskQueue || createDefaultTaskQueueState(),
    updatedAt: new Date().toISOString()
  };
  const file = getStateFilePath(workspaceRoot, { ensureDir: true });
  const json = JSON.stringify(merged, null, 2);
  const tmpFile = `${file}.tmp.${process.pid}.${Date.now()}`;
  try {
    writeFileSync(tmpFile, json, "utf8");
    renameSync(tmpFile, file);
  } catch {
    try { unlinkSync(tmpFile); } catch {}
    writeFileSync(file, json, "utf8");
  }
  return merged;
}

const STORY_OVERRIDE_KEY_RE = /^[^#\s]+#[^#\s]+$/;
const ALLOWED_STORY_STATUS_INPUTS = new Set([
  "done",
  "complete",
  "completed",
  "passed",
  "verified",
  "closed",
  "in-review",
  "review",
  "testing",
  "qa",
  "in-progress",
  "active",
  "doing",
  "started",
  "wip",
  "ready-for-dev",
  "ready",
  "backlog"
]);

export function updateAdvisorState(workspaceRoot, args = {}) {
  const now = new Date().toISOString();
  const current = loadPersistedState(workspaceRoot);

  const storyOverrides = {};
  if (Array.isArray(args.storyStatusUpdates)) {
    for (const item of args.storyStatusUpdates) {
      const overrideKey = String(item?.overrideKey || "").trim();
      const rawStatus = String(item?.status || "").toLowerCase().trim();
      if (!STORY_OVERRIDE_KEY_RE.test(overrideKey) || !ALLOWED_STORY_STATUS_INPUTS.has(rawStatus)) {
        continue;
      }
      if (
        overrideKey.startsWith("__proto__#") ||
        overrideKey.startsWith("constructor#") ||
        overrideKey.startsWith("prototype#")
      ) {
        continue;
      }
      storyOverrides[overrideKey] = {
        status: normalizeStatus(rawStatus),
        reason: item.reason || "Verified by ZCode AI Companion",
        updatedAt: now
      };
    }
  }

  const hasHeadline = typeof args.headline === "string" && args.headline.trim().length > 0;
  const hasTurnSummary = typeof args.turnSummary === "string" && args.turnSummary.trim().length > 0;
  const hasRecommendations = Array.isArray(args.recommendations);
  let nextAdvisorOverride;
  if (hasHeadline || hasTurnSummary || hasRecommendations) {
    const existingOverride =
      current.agentAdvisorOverride && typeof current.agentAdvisorOverride === "object"
        ? current.agentAdvisorOverride
        : {};
    nextAdvisorOverride = {
      ...existingOverride,
      ...(hasHeadline ? { headline: args.headline } : {}),
      ...(hasTurnSummary ? { turnSummary: args.turnSummary } : {}),
      ...(hasRecommendations ? { recommendations: args.recommendations } : {}),
      updatedAt: now
    };
  }

  let hostModels = null;
  if (Array.isArray(args.hostModels)) {
    hostModels = mergeHostModelCatalogs(current.hostModels || [], args.hostModels);
  }

  savePersistedState(workspaceRoot, {
    ...(nextAdvisorOverride ? { agentAdvisorOverride: nextAdvisorOverride } : {}),
    storyOverrides,
    ...(hostModels !== null ? { hostModels } : {}),
    lastTurnAnalyzedAt: now
  });

  return scanBmadWorkspace(workspaceRoot);
}

// ---------------------------------------------------------------------------
// Shared story-evidence helpers (Story 3.5 refactor sweep).
// Both scan paths — v7 tickets.toml entries and v6 sprint-status.yaml keys —
// resolve a story's implementation report and evaluate its smart status with
// the exact same deterministic evidence rules (C12), so the logic lives once.
// ---------------------------------------------------------------------------

function matchStoryImplementationReport(implReportFiles, storyRef, trackers) {
  const { v6Key, epicNum, storyNum, containerSuffix } = storyRef;
  const reportCandidate =
    implReportFiles.find((rf) => {
      if (rf.name.includes(v6Key) || rf.name.includes(`story-${epicNum}-${storyNum}`) || rf.name.includes(`plan-${epicNum}-${storyNum}`)) {
        return true;
      }
      const fm = parseFrontmatter(safeReadText(rf.fullPath, 1500));
      return (
        (fm.ticket !== undefined && Number(fm.ticket) === Number(storyNum) && (!fm.container || String(fm.container).endsWith(containerSuffix))) ||
        fm.v6_key === v6Key ||
        fm.story === `${epicNum}.${storyNum}`
      );
    }) || null;
  const reportSummary = reportCandidate ? parseTestReportSummary(safeReadText(reportCandidate.fullPath, 40000)) : null;
  if (reportCandidate) {
    trackers.matchedReportFiles.add(`${reportCandidate.dir}::${reportCandidate.name}`);
    if (reportSummary && reportSummary.failed > 0) {
      trackers.failingReports.push({
        name: reportCandidate.name,
        relPath: reportCandidate.relPath,
        failedTestsCount: reportSummary.failed,
        passedTestsCount: reportSummary.passed,
        totalTestsCount: reportSummary.total,
        failingSuiteName: reportSummary.failingSuiteName
      });
    }
  }
  return { reportCandidate, reportSummary };
}

function evaluateStorySmartStatus({ declaredStatus, override, planEvidence, reportCandidate, reportSummary, retroEvidence }) {
  if (override) {
    const smartStatus = normalizeStatus(override.status);
    return {
      smartStatus,
      smartEvidence: override.reason || "Updated by BMAD AI Companion",
      aiReconciled: smartStatus !== declaredStatus
    };
  }
  if (declaredStatus !== "done" && planEvidence) {
    return { smartStatus: "done", smartEvidence: planEvidence, aiReconciled: true };
  }
  if (reportCandidate && reportSummary && reportSummary.found && reportSummary.failed === 0) {
    return {
      smartStatus: "done",
      smartEvidence: `Passing implementation report (${reportCandidate.name}) confirms 0 test failures.`,
      aiReconciled: declaredStatus !== "done"
    };
  }
  if (reportCandidate && reportSummary && reportSummary.failed > 0) {
    return {
      smartStatus: "review",
      smartEvidence: `Implementation report (${reportCandidate.name}) detected ${reportSummary.failed} test failure(s).`,
      aiReconciled: true
    };
  }
  if (declaredStatus !== "done" && retroEvidence) {
    return { smartStatus: "done", smartEvidence: retroEvidence, aiReconciled: true };
  }
  return { smartStatus: declaredStatus, smartEvidence: null, aiReconciled: false };
}

export function scanBmadWorkspace(workspaceRoot) {
  const bmadOutputDir = join(workspaceRoot, "_bmad-output");
  const docsDir = join(workspaceRoot, "docs");
  const outputFiles = walkFiles(bmadOutputDir, workspaceRoot, 6);
  const docFiles = walkFiles(docsDir, workspaceRoot, 3);
  const git = runGitInfo(workspaceRoot);
  const persisted = loadPersistedState(workspaceRoot);
  const { projectName, techStack } = detectWorkspaceProfile(workspaceRoot);
  const { models: availableModels, providerState } = discoverConfiguredModels(persisted.hostModels || null);
  applyModelHealthFromQueue(availableModels, persisted.taskQueue?.items);

  const allDiscoveredFiles = [...outputFiles, ...docFiles];
  const sprintStatusFile = allDiscoveredFiles.find((f) => f.name === "sprint-status.yaml" || f.name === "sprint-status.yml");
  const sprintStatusMap = sprintStatusFile ? parseSprintStatusYaml(safeReadText(sprintStatusFile.fullPath)) : {};

  const epicsMdFile = allDiscoveredFiles.find((f) => f.name === "epics.md");
  const parsedEpicsMd = epicsMdFile ? parseEpicsMarkdown(safeReadText(epicsMdFile.fullPath)) : { epicTitles: {}, storyDetails: {} };

  const implReportFiles = outputFiles.filter(
    (f) => f.relPath.includes("implementation-artifacts/") && /^(?:rapport-|report-|implementation-)/i.test(f.name) && f.name.endsWith(".md")
  );
  const defectLedgerFiles = outputFiles.filter(
    (f) =>
      (f.name.includes("journal-defauts") || f.name.includes("defect") || f.name === "deferred-work.md") &&
      f.name.endsWith(".md")
  );

  const initiatives = [];
  const epics = [];
  const allStories = [];
  const matchedReportFiles = new Set();
  const failingReports = [];

  // 1. Parse BMAD v7 initiative-* directories if present
  const initiativeDirs = existsSync(bmadOutputDir)
    ? readdirSync(bmadOutputDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith("initiative-"))
    : [];

  for (const initDir of initiativeDirs) {
    const initPath = join(bmadOutputDir, initDir.name);
    const initMdPath = join(initPath, `${initDir.name}.md`);
    const initMd = safeReadText(initMdPath);
    const initMeta = parseFrontmatter(initMd);
    const nestedTicketsDir = join(initPath, "tickets");
    const initTicketsTomlPath = existsSync(join(nestedTicketsDir, "tickets.toml"))
      ? join(nestedTicketsDir, "tickets.toml")
      : join(initPath, "tickets.toml");
    const initTicketsToml = safeReadText(initTicketsTomlPath);
    const tomlEpics = parseTomlBlocks(initTicketsToml, "epic");

    const initObj = {
      id: initDir.name,
      title: initMeta.title || initDir.name,
      status: normalizeStatus(initMeta.status || "in-progress"),
      rawStatus: initMeta.status || "in-progress",
      created: initMeta.created || "",
      relPath: relative(workspaceRoot, initMdPath).replace(/\\/g, "/"),
      epicIds: []
    };

    const subEntries = readdirSync(initPath, { withFileTypes: true });
    const nestedEntries = existsSync(nestedTicketsDir)
      ? readdirSync(nestedTicketsDir, { withFileTypes: true })
      : [];
    const epicDirs = [
      ...subEntries.filter((e) => e.isDirectory() && e.name.startsWith("epic-")),
      ...nestedEntries.filter((e) => e.isDirectory() && e.name.startsWith("epic-"))
    ];

    if (tomlEpics.length > 0 || epicDirs.length > 0) {
      const seenSlugs = new Set();
      const orderedEpicSpecs = [];
      for (const te of tomlEpics) {
        seenSlugs.add(te.slug);
        orderedEpicSpecs.push({
          num: te.id,
          slug: te.slug,
          title: te.title || te.slug,
          covers: Array.isArray(te.covers) ? te.covers : []
        });
      }
      for (const ed of epicDirs) {
        if (!seenSlugs.has(ed.name)) {
          seenSlugs.add(ed.name);
          orderedEpicSpecs.push({
            num: orderedEpicSpecs.length + 1,
            slug: ed.name,
            title: ed.name.replace(/^epic-/, "").replace(/-/g, " "),
            covers: []
          });
        }
      }

      const initPlanFiles = subEntries
        .filter((e) => e.isFile() && (e.name.startsWith("plan-") || e.name.startsWith("story-")) && e.name.endsWith(".md"))
        .map((e) => ({ dir: initPath, name: e.name }));

      for (const spec of orderedEpicSpecs) {
        const epicFolder = existsSync(join(nestedTicketsDir, spec.slug))
          ? join(nestedTicketsDir, spec.slug)
          : join(initPath, spec.slug);
        const epicMdFile = join(epicFolder, `${spec.slug}.md`);
        const epicMd = safeReadText(epicMdFile);
        const epicMeta = parseFrontmatter(epicMd);
        const retroInFolder = existsSync(epicFolder)
          ? readdirSync(epicFolder).find((n) => n.endsWith("-retrospective.md"))
          : null;
        const retroInInit = subEntries.find(
          (e) => e.isFile() && e.name.endsWith("-retrospective.md") && spec.slug.includes(e.name.replace("-retrospective.md", ""))
        );
        const hasRetrospective = Boolean(retroInFolder || retroInInit);

        const epicTicketsPath = existsSync(join(epicFolder, "tickets", "tickets.toml"))
          ? join(epicFolder, "tickets", "tickets.toml")
          : join(epicFolder, "tickets.toml");
        const epicTickets = safeReadText(epicTicketsPath);
        const tomlEntries = parseTomlBlocks(epicTickets, "entry");
        const epicTicketsDir = join(epicFolder, "tickets");
        const folderPlanFiles = [
          ...(existsSync(epicFolder)
            ? readdirSync(epicFolder)
                .filter((n) => (n.startsWith("story-") || n.startsWith("plan-")) && n.endsWith(".md"))
                .map((n) => ({ dir: epicFolder, name: n }))
            : []),
          ...(existsSync(epicTicketsDir)
            ? readdirSync(epicTicketsDir)
                .filter((n) => (n.startsWith("story-") || n.startsWith("plan-")) && n.endsWith(".md"))
                .map((n) => ({ dir: epicTicketsDir, name: n }))
            : [])
        ];
        const storyPlanCandidates = [...folderPlanFiles, ...initPlanFiles];

        const epicStories = [];
        const matchedPlanFiles = new Set();

        for (const entry of tomlEntries) {
          const v6Key = entry.v6_key || `${spec.num}-${entry.id}`;
          const trackerRaw = entry.status || sprintStatusMap[v6Key] || "backlog";
          const declaredStatus = normalizeStatus(trackerRaw);

          const planCandidate = storyPlanCandidates.find((pf) => {
            const text = safeReadText(join(pf.dir, pf.name), 1500);
            const fm = parseFrontmatter(text);
            const containerStr = String(fm.container || "");
            const matchesContainer = !containerStr || containerStr.endsWith(spec.slug);
            return (
              (matchesContainer && Number(fm.ticket) === Number(entry.id)) ||
              pf.name.startsWith(`plan-${spec.num}-${entry.id}-`) ||
              (v6Key && pf.name.includes(v6Key.slice(2, 16)))
            );
          });
          if (planCandidate) matchedPlanFiles.add(`${planCandidate.dir}::${planCandidate.name}`);

          const planMeta = planCandidate ? parseFrontmatter(safeReadText(join(planCandidate.dir, planCandidate.name), 2000)) : {};
          const planStatus = planMeta.status ? normalizeStatus(planMeta.status) : null;

          const { reportCandidate, reportSummary } = matchStoryImplementationReport(
            implReportFiles,
            { v6Key, epicNum: spec.num, storyNum: entry.id, containerSuffix: spec.slug },
            { matchedReportFiles, failingReports }
          );

          const overrideKey = `${spec.slug}#${entry.id}`;
          const retroEvidence = hasRetrospective
            ? normalizeStatus(epicMeta.status) === "done"
              ? `Marked '${trackerRaw}' in tracker, but parent epic is 'done' with completed retrospective.`
              : `Marked '${trackerRaw}' in tracker, but parent epic has completed retrospective.`
            : null;
          const { smartStatus, smartEvidence, aiReconciled } = evaluateStorySmartStatus({
            declaredStatus,
            override: persisted.storyOverrides ? persisted.storyOverrides[overrideKey] : null,
            planEvidence: planStatus === "done" ? `Story plan (${planCandidate.name}) confirms '${planMeta.status}'.` : null,
            reportCandidate,
            reportSummary,
            retroEvidence
          });

          const targetSkill = smartStatus === "done" ? "/bmad-code-review" : "/bmad-build-auto";
          const storyObj = {
            id: `${spec.num}.${entry.id}`,
            key: v6Key,
            overrideKey,
            epicSlug: spec.slug,
            epicTitle: epicMeta.title || spec.title,
            title: entry.title || v6Key,
            description: entry.description || "",
            verify: entry.verify || "",
            covers: Array.isArray(entry.covers) ? entry.covers : entry.covers ? [entry.covers] : [],
            declaredStatus,
            smartStatus,
            aiReconciled,
            smartEvidence,
            smartReason: smartEvidence,
            planPath: planCandidate ? relative(workspaceRoot, join(planCandidate.dir, planCandidate.name)).replace(/\\/g, "/") : null,
            recommendedModel: recommendModelForBmadSkill(targetSkill, availableModels)
          };
          epicStories.push(storyObj);
          allStories.push(storyObj);
        }

        for (const pf of folderPlanFiles) {
          if (matchedPlanFiles.has(`${pf.dir}::${pf.name}`)) continue;
          const fm = parseFrontmatter(safeReadText(join(pf.dir, pf.name), 2000));
          const st = normalizeStatus(fm.status || "done");
          const targetSkill = st === "done" ? "/bmad-code-review" : "/bmad-build-auto";
          const storyObj = {
            id: `${spec.num}.${epicStories.length + 1}`,
            key: pf.name.replace(/\.md$/, ""),
            overrideKey: `${spec.slug}#${pf.name}`,
            epicSlug: spec.slug,
            epicTitle: epicMeta.title || spec.title,
            title: fm.title || pf.name.replace(/^story-|^plan-|-plan\.md$|\.md$/g, "").replace(/-/g, " "),
            description: "",
            verify: "",
            covers: [],
            declaredStatus: st,
            smartStatus: st,
            aiReconciled: false,
            smartEvidence: null,
            smartReason: null,
            planPath: relative(workspaceRoot, join(pf.dir, pf.name)).replace(/\\/g, "/"),
            recommendedModel: recommendModelForBmadSkill(targetSkill, availableModels)
          };
          epicStories.push(storyObj);
          allStories.push(storyObj);
        }

        const doneDeclared = epicStories.filter((s) => s.declaredStatus === "done").length;
        const doneSmart = epicStories.filter((s) => s.smartStatus === "done").length;
        const total = epicStories.length || 1;
        const epicDeclaredStatus = normalizeStatus(sprintStatusMap[`epic-${spec.num}`] || epicMeta.status || "in-progress");
        const epicSmartStatus =
          doneSmart === epicStories.length && epicStories.length > 0
            ? "done"
            : normalizeStatus(epicMeta.status || epicDeclaredStatus);

        const epicObj = {
          id: `epic-${spec.num}`,
          number: spec.num,
          slug: spec.slug,
          initiativeId: initObj.id,
          title: epicMeta.title || spec.title,
          declaredStatus: epicDeclaredStatus,
          smartStatus: epicSmartStatus,
          covers: Array.isArray(epicMeta.covers) ? epicMeta.covers : spec.covers,
          hasRetrospective,
          relPath: existsSync(epicMdFile) ? relative(workspaceRoot, epicMdFile).replace(/\\/g, "/") : null,
          declaredProgressPct: Math.round((doneDeclared / total) * 100),
          smartProgressPct: Math.round((doneSmart / total) * 100),
          stories: epicStories
        };
        epics.push(epicObj);
        initObj.epicIds.push(epicObj.id);
      }
    }

    const directRetros = subEntries.filter((e) => e.isFile() && /^epic-\d+.*-retrospective\.md$/.test(e.name));
    if (tomlEpics.length === 0 && epicDirs.length === 0 && directRetros.length > 0) {
      for (const retroEntry of directRetros) {
        const retroPath = join(initPath, retroEntry.name);
        const retroText = safeReadText(retroPath, 8000);
        const headingMatch = /^#\s+(.+)$/m.exec(retroText);
        const slug = retroEntry.name.replace(/-retrospective\.md$/, "");
        const numMatch = /epic-(\d+(?:-\d+)?)/.exec(slug);
        const labelNum = numMatch ? numMatch[1] : String(epics.length + 1);
        const storyObj = {
          id: `${labelNum}.1`,
          key: `${slug}-delivery`,
          overrideKey: `${slug}#1`,
          epicSlug: slug,
          epicTitle: headingMatch ? headingMatch[1] : slug,
          title: headingMatch ? headingMatch[1] : `Delivery & Retrospective (${slug})`,
          description: "Verified via completed BMAD retrospective artifact and git history.",
          verify: "All unit and integration tests passing.",
          covers: [],
          declaredStatus: "done",
          smartStatus: "done",
          aiReconciled: true,
          smartEvidence: `Confirmed via ${retroEntry.name} in ${initDir.name}.`,
          smartReason: `Confirmed via ${retroEntry.name} in ${initDir.name}.`,
          planPath: relative(workspaceRoot, retroPath).replace(/\\/g, "/"),
          recommendedModel: recommendModelForBmadSkill("/bmad-code-review", availableModels)
        };
        allStories.push(storyObj);
        const epicObj = {
          id: slug,
          number: labelNum,
          slug,
          initiativeId: initObj.id,
          title: headingMatch ? headingMatch[1] : slug,
          declaredStatus: "done",
          smartStatus: "done",
          covers: [],
          hasRetrospective: true,
          relPath: relative(workspaceRoot, retroPath).replace(/\\/g, "/"),
          declaredProgressPct: 100,
          smartProgressPct: 100,
          stories: [storyObj]
        };
        epics.push(epicObj);
        initObj.epicIds.push(epicObj.id);
      }
    }

    initiatives.push(initObj);
  }

  // 2. Fallback for standard BMAD v6 workspaces (sprint-status.yaml / epics.md without initiative-* folders)
  if (epics.length === 0 && Object.keys(sprintStatusMap).length > 0) {
    const epicGroups = new Map();
    for (const [key, rawVal] of Object.entries(sprintStatusMap)) {
      if (key.endsWith("-retrospective")) continue;
      const epicMatch = /^epic-(\d+)$/.exec(key);
      if (epicMatch) {
        const num = epicMatch[1];
        if (!epicGroups.has(num)) {
          epicGroups.set(num, { num, rawStatus: rawVal, stories: [] });
        } else {
          epicGroups.get(num).rawStatus = rawVal;
        }
        continue;
      }
      const storyMatch = /^(\d+)-(\d+)-(.+)$/.exec(key);
      if (storyMatch) {
        const [, eNum, sNum, slugPart] = storyMatch;
        if (!epicGroups.has(eNum)) {
          epicGroups.set(eNum, { num: eNum, rawStatus: "in-progress", stories: [] });
        }
        const mdDetail = parsedEpicsMd.storyDetails[`${eNum}-${sNum}`];
        const storyFile = allDiscoveredFiles.find((f) => f.name.includes(key) && f.name.endsWith(".md"));
        const fm = storyFile ? parseFrontmatter(safeReadText(storyFile.fullPath, 2000)) : {};
        const declaredStatus = normalizeStatus(rawVal);
        const fileStatus = fm.status ? normalizeStatus(fm.status) : null;
        const overrideKey = `epic-${eNum}#${sNum}`;

        const { reportCandidate, reportSummary } = matchStoryImplementationReport(
          implReportFiles,
          { v6Key: key, epicNum: eNum, storyNum: sNum, containerSuffix: `epic-${eNum}` },
          { matchedReportFiles, failingReports }
        );

        const hasRetroForEpic = sprintStatusMap[`epic-${eNum}-retrospective`] === "done";
        const { smartStatus, smartEvidence, aiReconciled } = evaluateStorySmartStatus({
          declaredStatus,
          override: persisted.storyOverrides ? persisted.storyOverrides[overrideKey] : null,
          planEvidence: fileStatus === "done" ? `Story file (${storyFile?.name}) indicates '${fm.status}'.` : null,
          reportCandidate,
          reportSummary,
          retroEvidence: hasRetroForEpic ? `Parent epic has completed retrospective in sprint status.` : null
        });
        const targetSkill = smartStatus === "done" ? "/bmad-code-review" : "/bmad-build";

        const storyObj = {
          id: `${eNum}.${sNum}`,
          key,
          overrideKey,
          epicSlug: `epic-${eNum}`,
          epicTitle: parsedEpicsMd.epicTitles[eNum] || `Epic ${eNum}`,
          title: mdDetail?.title || fm.title || slugPart.replace(/-/g, " "),
          description: "",
          verify: "",
          covers: [],
          declaredStatus,
          smartStatus,
          aiReconciled,
          smartEvidence,
          smartReason: smartEvidence,
          planPath: storyFile ? storyFile.relPath : null,
          recommendedModel: recommendModelForBmadSkill(targetSkill, availableModels)
        };
        epicGroups.get(eNum).stories.push(storyObj);
        allStories.push(storyObj);
      }
    }

    for (const [num, grp] of epicGroups.entries()) {
      const doneDec = grp.stories.filter((s) => s.declaredStatus === "done").length;
      const doneSm = grp.stories.filter((s) => s.smartStatus === "done").length;
      const tot = grp.stories.length || 1;
      const hasRetro = sprintStatusMap[`epic-${num}-retrospective`] === "done";
      epics.push({
        id: `epic-${num}`,
        number: Number(num),
        slug: `epic-${num}`,
        initiativeId: "bmad-v6-sprint",
        title: parsedEpicsMd.epicTitles[num] || `Epic ${num}`,
        declaredStatus: normalizeStatus(grp.rawStatus),
        smartStatus: doneSm === grp.stories.length && grp.stories.length > 0 ? "done" : normalizeStatus(grp.rawStatus),
        covers: [],
        hasRetrospective: hasRetro,
        relPath: sprintStatusFile ? sprintStatusFile.relPath : null,
        declaredProgressPct: Math.round((doneDec / tot) * 100),
        smartProgressPct: Math.round((doneSm / tot) * 100),
        stories: grp.stories
      });
    }
  }

  // 3. Dynamically surface standalone implementation reports in _bmad-output/implementation-artifacts
  const smartInsights = [];
  for (const repFile of implReportFiles) {
    if (matchedReportFiles.has(`${repFile.dir}::${repFile.name}`)) continue;

    const repText = safeReadText(repFile.fullPath, 40000);
    const titleMatch = /^#\s+(.+)$/m.exec(repText);
    const reportTitle = titleMatch ? titleMatch[1].trim() : repFile.name.replace(/\.md$/, "");

    const summary = parseTestReportSummary(repText);
    const failedTestsCount = summary.failed;
    const passedTestsCount = summary.passed;
    const totalTestsCount = summary.total;
    const failingSuiteName = summary.failingSuiteName;

    if (failedTestsCount === 0) {
      const repStory = {
        id: `IMP.1`,
        key: `${repFile.name}-delivery`,
        overrideKey: `${repFile.name}#1`,
        epicSlug: `epic-${repFile.name.replace(/\.md$/, "")}`,
        epicTitle: reportTitle,
        title: `Implementation & Delivery: ${reportTitle}`,
        description: summary.found
          ? `Verified build and test baseline (${passedTestsCount}/${totalTestsCount} tests passing).`
          : `Documented in ${repFile.relPath}.`,
        verify: "Clean build with 0 errors and 0 warnings.",
        covers: [],
        declaredStatus: "done",
        smartStatus: "done",
        aiReconciled: true,
        smartEvidence: `Verified via implementation report ${repFile.relPath}.`,
        smartReason: `Verified via implementation report ${repFile.relPath}.`,
        planPath: repFile.relPath,
        recommendedModel: recommendModelForBmadSkill("/bmad-code-review", availableModels)
      };
      allStories.push(repStory);
      epics.push({
        id: `epic-${repFile.name.replace(/\.md$/, "")}`,
        number: "IMP",
        slug: `epic-${repFile.name.replace(/\.md$/, "")}`,
        initiativeId: initiatives[0]?.id || "workspace",
        title: reportTitle,
        declaredStatus: "done",
        smartStatus: "done",
        covers: [],
        hasRetrospective: false,
        relPath: repFile.relPath,
        declaredProgressPct: 100,
        smartProgressPct: 100,
        stories: [repStory]
      });
    } else {
      const failTitle = failingSuiteName
        ? `Resolve ${failedTestsCount} failing test(s) in ${failingSuiteName} (${passedTestsCount}/${totalTestsCount} passing)`
        : `Resolve ${failedTestsCount} failing test(s) reported in ${repFile.name}`;
      const failReason = `Smart AI scan of ${repFile.name} detected ${failedTestsCount} test failure(s)${failingSuiteName ? ` in ${failingSuiteName}` : ""}.`;
      const repStory = {
        id: `IMP.1`,
        key: `${repFile.name}-delivery`,
        overrideKey: `${repFile.name}#1`,
        epicSlug: `epic-${repFile.name.replace(/\.md$/, "")}`,
        epicTitle: reportTitle,
        title: failTitle,
        description: `Implementation report ${repFile.name} recorded ${failedTestsCount} test failure(s) (${passedTestsCount}/${totalTestsCount} passing).`,
        verify: "Full test suite passes at 100%.",
        covers: [],
        declaredStatus: "in-progress",
        smartStatus: "review",
        aiReconciled: true,
        smartEvidence: failReason,
        smartReason: failReason,
        planPath: repFile.relPath,
        recommendedModel: recommendModelForBmadSkill("/bmad-build", availableModels)
      };
      allStories.push(repStory);
      epics.push({
        id: `epic-${repFile.name.replace(/\.md$/, "")}`,
        number: "IMP",
        slug: `epic-${repFile.name.replace(/\.md$/, "")}`,
        initiativeId: initiatives[0]?.id || "workspace",
        title: reportTitle,
        declaredStatus: "in-progress",
        smartStatus: "review",
        covers: [],
        hasRetrospective: false,
        relPath: repFile.relPath,
        declaredProgressPct: 0,
        smartProgressPct: 0,
        stories: [repStory]
      });

      smartInsights.push({
        type: "test-health",
        severity: "warning",
        title: `${failedTestsCount} Test Failure(s) Noted in ${repFile.name}${failingSuiteName ? ` (${failingSuiteName})` : ""}`,
        detail: `${repFile.relPath} reports ${passedTestsCount}/${totalTestsCount} tests passing and ${failedTestsCount} failure(s)${failingSuiteName ? ` in ${failingSuiteName}` : ""}.`
      });

      failingReports.push({
        name: repFile.name,
        relPath: repFile.relPath,
        failedTestsCount,
        passedTestsCount,
        totalTestsCount,
        failingSuiteName
      });
    }
  }

  // Categorize key artifacts across the 4 BMAD phases & build master last-modified artifact list
  const phaseArtifacts = {
    "1-analysis": [],
    "2-planning": [],
    "3-solutioning": [],
    "4-implementation": []
  };

  const modifiedPathsSet = new Set((git.modifiedFiles || []).map((m) => m.path.replace(/\\/g, "/")));
  const untrackedPathsSet = new Set((git.untrackedFiles || []).map((u) => u.replace(/\\/g, "/")));

  function fileGitStatus(relPath) {
    const norm = relPath.replace(/\\/g, "/");
    if (modifiedPathsSet.has(norm)) return "modified";
    for (const u of untrackedPathsSet) {
      if (norm === u || norm.startsWith(u.replace(/\/$/, "") + "/")) return "untracked";
    }
    return "committed";
  }

  const rootContextCandidates = [];
  for (const rootDoc of ["AGENTS.md", "CONTEXT.md"]) {
    const full = join(workspaceRoot, rootDoc);
    if (existsSync(full)) {
      try {
        const st = statSync(full);
        rootContextCandidates.push({
          name: rootDoc,
          relPath: rootDoc,
          fullPath: full,
          size: st.size,
          mtimeMs: st.mtimeMs
        });
      } catch {}
    }
  }

  const combinedArtifactFiles = [...rootContextCandidates, ...allDiscoveredFiles];
  const seenRelPaths = new Set();
  const nameCounts = new Map();
  for (const f of combinedArtifactFiles) {
    nameCounts.set(f.name, (nameCounts.get(f.name) || 0) + 1);
  }

  const phaseShortNameById = Object.fromEntries(BMAD_PHASES.map((p) => [p.id, p.shortName]));
  const allArtifactsSorted = [];

  for (const f of combinedArtifactFiles) {
    if (seenRelPaths.has(f.relPath)) continue;
    seenRelPaths.add(f.relPath);

    const lower = f.relPath.toLowerCase();
    let phaseId = null;
    let kind = "Artifact";

    if (f.name === "AGENTS.md") {
      phaseId = "1-analysis";
      kind = "Project Context";
    } else if (f.name === "CONTEXT.md") {
      phaseId = "1-analysis";
      kind = "Domain Context";
    } else if (lower.includes("product-brief") || lower.includes("brainstorm") || lower.includes("prfaq") || lower.includes("recon")) {
      phaseId = "1-analysis";
      kind = "Product Brief / Discovery";
    } else if (
      lower.includes("/prd") ||
      lower.includes("initiative-") ||
      lower.includes("design.md") ||
      lower.includes("experience.md") ||
      lower.includes("ux-") ||
      lower.includes("spec") ||
      lower.includes("plan-refonte")
    ) {
      phaseId = "2-planning";
      kind = lower.includes("ux") || lower.includes("design") || lower.includes("experience") ? "UX Design" : "PRD / Specification";
    } else if (
      lower.includes("architecture") ||
      lower.includes("tickets.toml") ||
      lower.includes("epics.md") ||
      lower.includes("epic-") ||
      lower.includes("sprint-status")
    ) {
      phaseId = "3-solutioning";
      kind = lower.includes("arch") ? "Architecture" : "Epics & Sprint Plan";
    } else if (
      lower.includes("rapport-") ||
      lower.includes("report-") ||
      lower.includes("journal-defauts") ||
      lower.includes("retrospective") ||
      lower.includes("deferred-work") ||
      lower.includes("plan-") ||
      lower.includes("story-")
    ) {
      phaseId = "4-implementation";
      kind = lower.includes("retro") ? "Retrospective" : lower.includes("story-") || lower.includes("plan-") ? "Story Plan" : "Implementation / QA";
    }

    if (!phaseId) continue;

    const parts = f.relPath.split("/");
    const parentFolder = parts.length > 1 ? parts[parts.length - 2] : "";
    const displayLabel =
      (nameCounts.get(f.name) || 0) > 1 && parentFolder
        ? `${parentFolder}/${f.name}`
        : f.name;

    const artItem = {
      name: f.name,
      displayLabel,
      relPath: f.relPath,
      kind,
      phaseId,
      phaseName: phaseShortNameById[phaseId] || phaseId,
      size: f.size || 0,
      mtimeMs: f.mtimeMs || 0,
      lastModifiedIso: f.mtimeMs ? new Date(f.mtimeMs).toISOString() : null,
      gitStatus: fileGitStatus(f.relPath)
    };

    phaseArtifacts[phaseId].push(artItem);
    allArtifactsSorted.push(artItem);
  }

  for (const pid of Object.keys(phaseArtifacts)) {
    phaseArtifacts[pid].sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  }
  allArtifactsSorted.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));

  const totalStories = allStories.length;
  const declaredDoneStories = allStories.filter((s) => s.declaredStatus === "done").length;
  const smartDoneStories = allStories.filter((s) => s.smartStatus === "done").length;
  const reviewStories = allStories.filter((s) => s.smartStatus === "review").length;
  const inProgressStories = allStories.filter((s) => s.smartStatus === "in-progress").length;
  const backlogStories = allStories.filter((s) => s.smartStatus === "backlog" || s.smartStatus === "ready").length;
  const reconciledStoriesCount = allStories.filter((s) => s.aiReconciled).length;

  const declaredOverallPct = totalStories > 0 ? Math.round((declaredDoneStories / totalStories) * 100) : 0;
  const smartOverallPct = totalStories > 0 ? Math.round((smartDoneStories / totalStories) * 100) : 0;

  const hasPrd = phaseArtifacts["2-planning"].some((a) => a.kind.includes("PRD"));
  const hasUx = phaseArtifacts["2-planning"].some((a) => a.kind.includes("UX"));
  const hasArch = phaseArtifacts["3-solutioning"].some((a) => a.kind.includes("Architecture"));

  const phases = BMAD_PHASES.map((p) => {
    const arts = phaseArtifacts[p.id] || [];
    let progressPct = 0;
    let status = "pending";
    let summary = "";

    if (p.id === "1-analysis") {
      progressPct = arts.length >= 2 ? 100 : arts.length === 1 ? 60 : 15;
      status = progressPct === 100 ? "done" : "in-progress";
      summary =
        arts.length > 0
          ? `${arts.length} discovery & context artifact(s) active (${arts.slice(0, 3).map((a) => a.name).join(", ")}).`
          : "No Product Brief or AGENTS.md found yet — start Phase 1 with /bmad-project-context or /bmad-product-brief.";
    } else if (p.id === "2-planning") {
      progressPct = hasPrd && hasUx ? 100 : hasPrd || hasUx ? 70 : 10;
      status = progressPct === 100 ? "done" : progressPct >= 50 ? "in-progress" : "pending";
      summary =
        hasPrd && hasUx
          ? "PRD and UX Design artifacts (DESIGN.md / EXPERIENCE.md) verified."
          : hasPrd
            ? "PRD present; UX design specification (/bmad-ux) recommended."
            : "No PRD or Spec detected yet — run /bmad-prd or /bmad-spec.";
    } else if (p.id === "3-solutioning") {
      const hasEpics = epics.length > 0;
      progressPct = hasArch && hasEpics ? 100 : hasArch || hasEpics ? 65 : 10;
      status = progressPct === 100 ? "done" : progressPct >= 50 ? "in-progress" : "pending";
      summary =
        epics.length > 0
          ? `${epics.length} epics and ${totalStories} stories structured across workspace trackers.`
          : "No epics or sprint tracker found yet — run /bmad-architecture and /bmad-create-epics-and-stories.";
    } else if (p.id === "4-implementation") {
      progressPct = totalStories > 0 ? smartOverallPct : 0;
      status = totalStories === 0 ? "pending" : smartOverallPct >= 95 && reviewStories === 0 ? "done" : "in-progress";
      summary =
        totalStories > 0
          ? `${smartDoneStories}/${totalStories} stories verified (${reconciledStoriesCount} AI-reconciled from plans, reports & retrospectives).`
          : "Awaiting epic/story breakdown before starting Phase 4 implementation.";
    }

    return {
      ...p,
      progressPct,
      status,
      summary,
      artifacts: arts.slice(0, 20),
      totalArtifactsCount: arts.length
    };
  });

  const pendingOrReviewStory =
    allStories.find((s) => s.smartStatus === "review" || s.smartStatus === "in-progress") ||
    allStories.find((s) => s.smartStatus !== "done") ||
    allStories[allStories.length - 1];

  const epicMissingRetro = epics.find((e) => e.smartStatus === "done" && !e.hasRetrospective);
  const uxArtifactNames = phaseArtifacts["2-planning"]
    .filter((a) => a.kind.includes("UX"))
    .map((a) => a.name)
    .slice(0, 3);

  const templateContext = {
    projectName,
    techStack,
    totalStories,
    completedStories: smartDoneStories,
    hasPrd,
    hasUx,
    hasArch,
    activeFocus:
      git.modifiedFiles.length > 0
        ? `recent changes in ${git.modifiedFiles.slice(0, 3).map((m) => basename(m.path)).join(", ")}`
        : pendingOrReviewStory
          ? `${pendingOrReviewStory.id} (${pendingOrReviewStory.title})`
          : git.recentCommits[0]?.subject
            ? git.recentCommits[0].subject
            : `${projectName} (${techStack})`,
    uxFocus:
      uxArtifactNames.length > 0
        ? `application views, user flows, and visual consistency with ${uxArtifactNames.join(" & ")}`
        : `core user workflows, visual hierarchy, and accessibility for ${projectName} (${techStack})`,
    nextStoryTitle: pendingOrReviewStory ? `${pendingOrReviewStory.id} (${pendingOrReviewStory.title})` : "next priority feature",
    nextStoryPrompt: pendingOrReviewStory
      ? `Complete and verify story ${pendingOrReviewStory.id} (${pendingOrReviewStory.title}): ${pendingOrReviewStory.verify || pendingOrReviewStory.description || "satisfy all acceptance criteria and unit tests"}`
      : `Implement the next priority story or feature in ${projectName} with automated unit and integration tests`,
    retroPrompt: epicMissingRetro
      ? `Run an evidence-backed retrospective for ${epicMissingRetro.title} (${epicMissingRetro.slug}) and record lessons learned`
      : `Run a retrospective on recent completed epics in ${projectName} and synthesize action items`
  };

  if (reconciledStoriesCount > 0) {
    smartInsights.unshift({
      type: "reconciliation",
      severity: "info",
      title: `Smart AI Progress Reconciliation (+${Math.max(0, smartDoneStories - declaredDoneStories)} stories verified)`,
      detail: `Static tracker reported ${declaredDoneStories}/${totalStories} stories done (${declaredOverallPct}%), while cross-checking story plans, retrospectives, and implementation reports confirms ${smartDoneStories}/${totalStories} stories (${smartOverallPct}%) delivered.`
    });
  }
  if (git.deletedBmadConfigFiles > 0) {
    smartInsights.push({
      type: "workspace-hygiene",
      severity: "warning",
      title: `${git.deletedBmadConfigFiles} Deleted _bmad/ Files in Working Tree`,
      detail: "git status shows uncommitted deletions under _bmad/. Restore them with git checkout -- _bmad or commit the migration cleanup intentionally."
    });
  }
  for (const df of defectLedgerFiles) {
    const dfText = safeReadText(df.fullPath, 30000);
    const matches = dfText.match(/^##\s+(?:Défaut|Defect|Bug)\s+\d+/gim) || [];
    if (matches.length > 0) {
      smartInsights.push({
        type: "defect-ledger",
        severity: "success",
        title: `${matches.length} Defect Entries Tracked in ${df.name}`,
        detail: `${df.relPath} documents ${matches.length} triaged defect entries and their verification status.`
      });
    }
  }
  if (totalStories === 0 && outputFiles.length === 0) {
    smartInsights.push({
      type: "onboarding",
      severity: "info",
      title: `BMAD Onboarding Ready for ${projectName} (${techStack})`,
      detail: "No _bmad-output artifacts detected yet in this workspace. Use the recommended Phase 1 & Phase 2 prompts above to initialize project context, Product Brief, PRD, and UX specs."
    });
  }

  const recommendations = buildRecommendations({
    projectName,
    techStack,
    persisted,
    epics,
    allStories,
    templateContext,
    hasPrd,
    hasUx,
    hasArch,
    availableModels,
    failingReports
  });

  const skillsWithPrompts = BMAD_SKILLS_CATALOG.map((s) => ({
    skill: s.skill,
    displayName: s.displayName,
    code: s.code,
    module: s.module,
    phase: s.phase,
    precededBy: s.precededBy,
    followedBy: s.followedBy,
    description: s.description,
    contextualCommand: s.promptTemplate(templateContext),
    recommendedModel: recommendModelForBmadSkill(s.skill, availableModels, s.modelProfile)
  }));

  const agentsWithModels = BMAD_AGENTS_CATALOG.map((a) => ({
    ...a,
    recommendedModel: recommendModelForBmadSkill(a.skill, availableModels, a.modelProfile)
  }));

  const taskQueue = buildTaskQueueView(persisted.taskQueue, allStories, availableModels);
  const activeAdvisorOverride = isAdvisorOverrideStale(persisted) ? null : persisted.agentAdvisorOverride;

  return {
    scannedAt: new Date().toISOString(),
    workspaceRoot,
    projectName,
    techStack,
    availableModels,
    providerState,
    git,
    taskQueue,
    metrics: {
      totalEpics: epics.length,
      completedEpics: epics.filter((e) => e.smartStatus === "done").length,
      totalStories,
      declaredDoneStories,
      smartDoneStories,
      reviewStories,
      inProgressStories,
      backlogStories,
      reconciledStoriesCount,
      declaredOverallPct,
      smartOverallPct
    },
    turnAnalysis: {
      turnCount: persisted.turnCount || 0,
      lastUserPrompt: persisted.lastUserPrompt || "",
      lastUserPromptAt: persisted.lastUserPromptAt || null,
      lastAssistantSummary: summarizeAssistantTurn(persisted.lastAssistantMessage, persisted.lastUserPrompt, activeAdvisorOverride),
      lastTurnAnalyzedAt: persisted.lastTurnAnalyzedAt || null,
      recentTouchedFiles: persisted.recentTouchedFiles || [],
      lastLaunchedSession: persisted.lastLaunchedSession || null,
      aiSummaryHeadline:
        activeAdvisorOverride?.headline ||
        buildTurnHeadline(persisted.lastUserPrompt, persisted.lastAssistantMessage, projectName, smartOverallPct, totalStories)
    },
    recommendations,
    smartInsights,
    phases,
    artifacts: allArtifactsSorted,
    initiatives,
    epics,
    skillsCatalog: skillsWithPrompts,
    agentsCatalog: agentsWithModels
  };
}

function normalizeComparablePrompt(text) {
  let str = String(text || "").trim();
  const hasQuote = str.endsWith('"');
  if (hasQuote) str = str.slice(0, -1);
  str = str
    .replace(/^\/bmad-build-auto\b/i, "/bmad-build")
    .replace(EXECUTION_POLICY_RE, "")
    .replace(ROUTE_HINT_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  return (hasQuote ? `${str}"` : str).toLowerCase();
}

function parseIsoMs(value) {
  if (!value) return Number.NaN;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function isAdvisorOverrideStale(persisted) {
  const override = persisted?.agentAdvisorOverride;
  if (!override || typeof override !== "object") return true;
  const overrideMs = parseIsoMs(override.updatedAt);
  if (!Number.isFinite(overrideMs)) return false;

  const wfCompletedMs = parseIsoMs(persisted.lastWorkflowCompletedAt);
  if (Number.isFinite(wfCompletedMs) && wfCompletedMs > overrideMs) {
    return true;
  }

  const q = persisted.taskQueue;
  if (q && typeof q === "object") {
    const queueUpdatedMs = parseIsoMs(q.updatedAt);
    if (q.status === "completed" && Number.isFinite(queueUpdatedMs) && queueUpdatedMs > overrideMs) {
      return true;
    }
  }
  return false;
}

function isRecommendationCompleted(rec, persisted, allStories = []) {
  if (!rec || typeof rec !== "object") return false;

  const queueItems = Array.isArray(persisted?.taskQueue?.items) ? persisted.taskQueue.items : [];
  for (const item of queueItems) {
    if (item?.status !== "done") continue;
    if (recommendationMatchesCompletedItem(rec, item)) {
      return true;
    }
  }

  const skill = String(rec.skill || "").trim().toLowerCase();
  if (skill === "/bmad-build" || skill === "/bmad-build-auto" || skill === "bmad-build" || skill === "bmad-build-auto") {
    const haystack = `${rec.title || ""} ${rec.fullCommand || ""}`;
    const storyMatch = /\b(?:story|ticket)\s+(\d+\.\d+)\b/i.exec(haystack);
    if (storyMatch) {
      const matched = allStories.find((s) => String(s.id) === storyMatch[1]);
      if (matched && matched.smartStatus === "done") {
        return true;
      }
    }
  }

  return false;
}

function summarizeAssistantTurn(lastAssistantMessage, lastUserPrompt, override) {
  if (override?.turnSummary) return override.turnSummary;
  if (!lastAssistantMessage && !lastUserPrompt) {
    return "Ready to analyze your next prompt result. Launching any prompt below automatically opens a new session with its recommended AI model.";
  }
  const clean = String(lastAssistantMessage || "")
    .replace(/```[\s\S]*?```/g, "[code block]")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) {
    return `Prompt active: "${String(lastUserPrompt).slice(0, 140)}". Awaiting turn completion for post-prompt analysis.`;
  }
  return clean.length > 260 ? `${clean.slice(0, 257)}...` : clean;
}

function buildTurnHeadline(lastUserPrompt, lastAssistantMessage, projectName, smartOverallPct, totalStories) {
  const combined = `${lastUserPrompt || ""} ${lastAssistantMessage || ""}`.toLowerCase();
  if (!combined.trim()) {
    if (totalStories === 0) {
      return `${projectName} has no BMAD tracker artifacts yet — ready to launch Phase 1 in a new session with a recommended model.`;
    }
    return `${projectName} is at ${smartOverallPct}% Smart BMAD completion — click Launch on any card below to start a new session with its recommended model.`;
  }
  if (/ux|ui|xaml|css|html|design|theme|layout|component|contrast/i.test(combined)) {
    return "Last turn focused on UI/UX — recommended next step is a UX specification update (/bmad-ux) or multi-lens code review (/bmad-code-review).";
  }
  if (/bug|erreur|error|fix|defaut|defect|test|fail/i.test(combined)) {
    return "Last turn addressed defects or tests — recommended next step is automated QA verification (/bmad-qa-generate-e2e-tests) or code review (/bmad-code-review).";
  }
  if (/epic|story|sprint|ticket|plan|backlog|prd|arch/i.test(combined)) {
    return "Last turn touched planning or sprint tracking — recommended next step is sprint status reconciliation (/bmad-sprint-planning) or story execution (/bmad-build).";
  }
  return `Analyzed latest prompt result for ${projectName} (${totalStories > 0 ? `${smartOverallPct}% stories complete` : "onboarding mode"}) — launch the next step in a new session below.`;
}

function buildRecommendations({
  projectName,
  techStack,
  persisted,
  epics,
  allStories,
  templateContext,
  hasPrd,
  hasUx,
  hasArch,
  availableModels,
  failingReports = []
}) {
  const recs = [];
  const seenSkills = new Set();

  function addRec(rec) {
    if (seenSkills.has(rec.skill + "::" + rec.fullCommand)) return;
    seenSkills.add(rec.skill + "::" + rec.fullCommand);
    const defaultModel = recommendModelForBmadSkill(rec.skill, availableModels);
    const recommendedModel = rec.recommendedModel
      ? {
          modelId: rec.recommendedModel.modelId || defaultModel.modelId,
          shortName: (rec.recommendedModel.modelId || defaultModel.modelId).split("/").pop(),
          tier: rec.recommendedModel.tier || defaultModel.tier,
          reason: rec.recommendedModel.reason || defaultModel.reason
        }
      : defaultModel;
    recs.push({
      id: `rec-${recs.length + 1}`,
      ...rec,
      recommendedModel
    });
  }

  // 1. Honor explicit AI Advisor override pushed via MCP tool bmad_update_advisor
  //    (skip if superseded by a completed workflow/queue, and filter out already-completed tasks/stories)
  const activeOverride = isAdvisorOverrideStale(persisted) ? null : persisted.agentAdvisorOverride;
  if (Array.isArray(activeOverride?.recommendations)) {
    const contextualCmdRe = /^\/bmad-[a-z0-9-]+\s+".+"$/;
    const providerModelRe = /^[^/\s]+\/.+$/;
    for (const r of activeOverride.recommendations) {
      if (r && r.skill && r.fullCommand) {
        if (isRecommendationCompleted(r, persisted, allStories)) {
          continue;
        }
        const cleanSkill = String(r.skill).trim().startsWith("/")
          ? String(r.skill).trim()
          : `/${String(r.skill).trim()}`;
        let fullCommand = String(r.fullCommand).trim();
        if (!fullCommand.startsWith("/") && fullCommand.startsWith("bmad-")) {
          fullCommand = `/${fullCommand}`;
        }
        if (!contextualCmdRe.test(fullCommand)) {
          const fallbackPrompt = String(
            r.title || r.rationale || `Continue ${cleanSkill} workflow for ${projectName}`
          )
            .replace(/"/g, "'")
            .trim();
          fullCommand = `${cleanSkill} "${fallbackPrompt}"`;
        }
        const validRecommendedModel =
          typeof r.recommendedModel === "string" && providerModelRe.test(r.recommendedModel.trim())
            ? r.recommendedModel.trim()
            : null;
        addRec({
          skill: cleanSkill,
          fullCommand,
          title: r.title || `AI Advisor: ${cleanSkill}`,
          rationale: r.rationale || "Synthesized by ZCode AI from the latest turn and workspace state.",
          phase: r.phase || "4-implementation",
          priority: r.priority || "high",
          badge: "AI Turn Synthesis",
          recommendedModel: validRecommendedModel
            ? {
                modelId: validRecommendedModel,
                reason: r.modelReason || `Selected by AI Advisor for ${cleanSkill}`
              }
            : undefined
        });
      }
    }
  }

  // 1b. Emit high-priority remediation recommendation on failCount > 0 (C12)
  for (const fr of failingReports) {
    const suiteLabel = fr.failingSuiteName ? ` in ${fr.failingSuiteName}` : "";
    addRec({
      skill: "/bmad-build",
      fullCommand: `/bmad-build "Remediate ${fr.failedTestsCount} failing test(s) reported in ${fr.name}${suiteLabel}: fix failing tests and restore passing baseline"`,
      title: `Remediate Test Failures: ${fr.failedTestsCount} failing test(s) in ${fr.name}`,
      rationale: `Smart AI scan detected ${fr.failedTestsCount} test failure(s) in ${fr.name}. BMAD quality gate requires 100% passing tests before completing stories or reconciling trackers.`,
      phase: "4-implementation",
      priority: "high",
      badge: "Remediation"
    });
  }

  // 2. If workspace has no BMAD stories/artifacts yet, prioritize Phase 1-3 onboarding prompts
  if (allStories.length === 0 && !hasPrd && !hasArch) {
    addRec({
      skill: "/bmad-project-context",
      fullCommand: `/bmad-project-context "Initialize or refresh AGENTS.md for ${projectName} (${techStack}) with verified build/test commands, coding conventions, and architectural boundaries"`,
      title: "Initialize Repository Agent Context (AGENTS.md)",
      rationale: "Establishing verified project instructions in AGENTS.md ensures all subsequent BMAD agents follow your repository's exact conventions.",
      phase: "1-analysis",
      priority: "high",
      badge: "Step 1 · Context"
    });
    addRec({
      skill: "/bmad-product-brief",
      fullCommand: `/bmad-product-brief "Create a Product Brief for ${projectName} capturing target users, core problem statement, value proposition, and MVP scope"`,
      title: "Capture Product Vision in a Product Brief",
      rationale: "Phase 1 discovery grounds your product goals before writing detailed functional requirements.",
      phase: "1-analysis",
      priority: "high",
      badge: "Step 2 · Brief"
    });
    addRec({
      skill: "/bmad-prd",
      fullCommand: `/bmad-prd "Create the Product Requirements Document (PRD) for ${projectName} (${techStack}) with functional requirements and measurable success criteria"`,
      title: "Author the Product Requirements Document (PRD)",
      rationale: "Defines the functional and non-functional requirements that Architecture and Epics/Stories will build from.",
      phase: "2-planning",
      priority: "medium",
      badge: "Step 3 · Planning"
    });
    addRec({
      skill: "/bmad-ux",
      fullCommand: `/bmad-ux "Create DESIGN.md and EXPERIENCE.md UX specifications for ${projectName} covering visual tokens, layout patterns, and key user journeys"`,
      title: "Design the Application UI/UX System",
      rationale: "Captures visual design and interaction specifications before implementation begins.",
      phase: "2-planning",
      priority: "medium",
      badge: "Step 4 · UX"
    });
    return recs;
  }

  // 3. Analyze the latest prompt & assistant response semantics
  const turnText = `${persisted.lastUserPrompt || ""} ${persisted.lastAssistantMessage || ""} ${(persisted.recentTouchedFiles || []).join(" ")}`.toLowerCase();

  if (/ux|ui|xaml|css|html|design|theme|fluent|layout|view|vue|contrast/i.test(turnText)) {
    addRec({
      skill: "/bmad-ux",
      fullCommand: `/bmad-ux "Enhance the UI/UX design of ${projectName} focusing on ${templateContext.uxFocus}"`,
      title: "Refine & Synchronize UX Design Specifications",
      rationale: "Your recent activity relates to UI/UX components. Use /bmad-ux with a concrete prompt to evolve DESIGN.md and EXPERIENCE.md alongside the UI views.",
      phase: "2-planning",
      priority: "high",
      badge: "Post-Prompt Match"
    });
  }

  if (/build|implement|feature|story|code|edit|write|fix|refactor/i.test(turnText) || (persisted.recentTouchedFiles || []).length > 0) {
    const touchedLabel =
      (persisted.recentTouchedFiles || []).length > 0
        ? `changes in ${(persisted.recentTouchedFiles || []).slice(0, 3).map((p) => basename(p)).join(", ")}`
        : `recent implementation in ${projectName} (${templateContext.activeFocus})`;
    addRec({
      skill: "/bmad-code-review",
      fullCommand: `/bmad-code-review "Review ${touchedLabel} for edge cases, architectural compliance, and verification gaps"`,
      title: "Run Multi-Lens BMAD Code Review on Recent Changes",
      rationale: "After code or artifact changes, BMAD-METHOD recommends running /bmad-code-review in a clean session before closing the story or starting the next epic.",
      phase: "4-implementation",
      priority: "high",
      badge: "Quality Gate"
    });
  }

  // 4. Open / Review stories
  const openStories = allStories.filter((s) => s.smartStatus !== "done");
  for (const st of openStories.slice(0, 2)) {
    addRec({
      skill: "/bmad-build",
      fullCommand: `/bmad-build "Complete and verify ${st.id} (${st.title}): ${st.description || st.verify || "ensure all acceptance criteria and automated tests pass at 100%"}"`,
      title: `${st.smartStatus === "review" ? "Resolve Review Item" : "Build Next Story"}: ${st.id} — ${st.title}`,
      rationale: st.smartEvidence || `Story ${st.id} in '${st.epicTitle}' is currently marked '${st.smartStatus}'.`,
      phase: "4-implementation",
      priority: st.smartStatus === "review" ? "high" : "medium",
      badge: st.smartStatus === "review" ? "Smart Alert" : "Next Story"
    });
  }

  // 5. Always include a concrete /bmad-ux recommendation tailored to the workspace
  addRec({
    skill: "/bmad-ux",
    fullCommand: `/bmad-ux "Enhance the UI/UX of ${projectName} by auditing ${templateContext.uxFocus} and refining interaction ergonomics"`,
    title: "Enhance Application UI/UX & Interaction Flows",
    rationale: "Guides Sally (UX Designer) to refine DESIGN.md and EXPERIENCE.md with concrete ergonomic and visual improvements.",
    phase: "2-planning",
    priority: "medium",
    badge: "UX Companion"
  });

  // 6. Sprint Planning / Tracker Reconciliation
  addRec({
    skill: "/bmad-sprint-planning",
    fullCommand: `/bmad-sprint-planning "Validate sprint status for ${projectName}, reconcile tracker statuses with delivered epics and stories, and report open risks"`,
    title: "Synchronize Sprint Status & Reconcile Trackers",
    rationale: "Reconciles static tracker entries with the smart-detected completion across epics, story plans, and git commits.",
    phase: "3-solutioning",
    priority: "medium",
    badge: "Tracker Sync"
  });

  // 7. Retrospective or Walkthrough
  const epicWithoutRetro = epics.find((e) => e.smartStatus === "done" && !e.hasRetrospective);
  if (epicWithoutRetro) {
    addRec({
      skill: "/bmad-retrospective",
      fullCommand: `/bmad-retrospective "Run an evidence-backed retrospective on ${epicWithoutRetro.title} (${epicWithoutRetro.slug}) and record lessons learned"`,
      title: `Run Retrospective for Completed Epic: ${epicWithoutRetro.title}`,
      rationale: "All stories in this epic are complete, but no *-retrospective.md artifact was found yet.",
      phase: "4-implementation",
      priority: "next-step",
      badge: "Phase Closure"
    });
  } else {
    addRec({
      skill: "/bmad-walkthrough",
      fullCommand: `/bmad-walkthrough "Walk me through the recent implementation and architecture changes in ${projectName} (${templateContext.activeFocus})"`,
      title: "Guided Walkthrough of Recent Delivery",
      rationale: "Generates a structured human-review walkthrough covering recent commits, key touchpoints, and verification steps.",
      phase: "4-implementation",
      priority: "next-step",
      badge: "Human Review"
    });
  }

  return recs.slice(0, 7);
}

export function resolveWorkspaceArtifactPath(workspaceRoot, relPath) {
  const rootResolved = resolve(workspaceRoot);
  const raw = String(relPath ?? "").trim();
  if (!raw) {
    throw new Error("Artifact path must be a non-empty workspace-relative path.");
  }
  if (raw.includes("\0")) {
    throw new Error("Artifact path must stay within the workspace root.");
  }

  const slashNormalized = raw.replace(/\\/g, "/");
  if (/^[a-zA-Z]:(?![/])/.test(slashNormalized)) {
    throw new Error("Artifact path must stay within the workspace root.");
  }

  const full = resolve(rootResolved, slashNormalized);
  const normalizedRel = relative(rootResolved, full).replace(/\\/g, "/");
  if (
    !normalizedRel ||
    normalizedRel === ".." ||
    normalizedRel.startsWith("../") ||
    isAbsolute(normalizedRel)
  ) {
    throw new Error("Artifact path must stay within the workspace root.");
  }

  if (!existsSync(full)) {
    throw new Error(`Artifact not found: ${normalizedRel}`);
  }
  const st = statSync(full);
  if (!st.isFile()) {
    throw new Error(`Artifact path must refer to a file: ${normalizedRel}`);
  }

  const rootReal = realpathSync(rootResolved);
  const fullReal = realpathSync(full);
  const realRel = relative(rootReal, fullReal).replace(/\\/g, "/");
  if (!realRel || realRel === ".." || realRel.startsWith("../") || isAbsolute(realRel)) {
    throw new Error("Artifact path must stay within the workspace root.");
  }

  return {
    relPath: normalizedRel,
    fullPath: full,
    stat: st
  };
}

export function inspectWorkspaceArtifact(workspaceRoot, relPath) {
  const { relPath: cleanRel, fullPath: full, stat: st } = resolveWorkspaceArtifactPath(workspaceRoot, relPath);
  const text = safeReadText(full, 48000);
  const meta = parseFrontmatter(text);

  // Compute Git Diff: 1) Working tree / staged diff vs HEAD, 2) Most recent commit diff, 3) Synthetic new-file diff
  let diff = "";
  let diffSource = "Working tree diff vs HEAD";
  try {
    diff = execFileSync("git", ["-C", workspaceRoot, "diff", "HEAD", "--", cleanRel], {
      encoding: "utf8",
      timeout: 4000,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {}

  if (!diff) {
    try {
      diff = execFileSync(
        "git",
        [
          "-C",
          workspaceRoot,
          "log",
          "-n",
          "1",
          "-p",
          "--format=commit %h (%cr) — %s%nAuthor: %an <%ae>%nDate:   %ad",
          "--",
          cleanRel
        ],
        {
          encoding: "utf8",
          timeout: 4000,
          stdio: ["ignore", "pipe", "ignore"]
        }
      ).trim();
      if (diff) {
        diffSource = "Last commit diff (working tree is clean)";
      }
    } catch {}
  }

  if (!diff) {
    const previewLines = text.split(/\r?\n/).slice(0, 220);
    diffSource = "Untracked / New Artifact Diff";
    diff = [
      `--- /dev/null`,
      `+++ b/${cleanRel}`,
      `@@ -0,0 +1,${previewLines.length} @@`,
      ...previewLines.map((l) => `+${l}`)
    ].join("\n");
  }

  if (diff.length > 24000) {
    diff = diff.slice(0, 24000) + "\n\n... [diff truncated]";
  }

  return {
    relPath: cleanRel,
    name: basename(full),
    size: st.size,
    mtimeMs: st.mtimeMs,
    lastModifiedIso: new Date(st.mtimeMs).toISOString(),
    meta,
    diff,
    diffSource,
    preview: text.slice(0, 12000),
    truncated: text.length > 12000
  };
}

export function openWorkspaceArtifactExternally(workspaceRoot, relPath, deps = {}) {
  const { relPath: cleanRel, fullPath: full } = resolveWorkspaceArtifactPath(workspaceRoot, relPath);
  const platform = deps.platform || process.platform;
  const runExecFileSync = deps.execFileSync || execFileSync;
  const openMethod =
    platform === "win32"
      ? "cmd /c start"
      : platform === "darwin"
        ? "open"
        : "xdg-open";
  try {
    if (platform === "win32") {
      runExecFileSync("cmd.exe", ["/c", "start", "", full], {
        timeout: 3000,
        windowsHide: true,
        stdio: "ignore"
      });
    } else if (platform === "darwin") {
      runExecFileSync("open", [full], { timeout: 3000, stdio: "ignore" });
    } else {
      runExecFileSync("xdg-open", [full], { timeout: 3000, stdio: "ignore" });
    }
    return { opened: true, relPath: cleanRel, fullPath: full, openMethod };
  } catch (err) {
    return {
      opened: false,
      relPath: cleanRel,
      fullPath: full,
      openMethod,
      error: errorMessage(err)
    };
  }
}

// Single source for the sprint-status.yaml `development_status:` section header
// match (used by both the in-place status rewrite pass and the numeric
// header-counter pass below). Deliberately more tolerant than the stricter
// variant inside parseSprintStatusYaml, whose behavior must not change here.
const DEV_STATUS_SECTION_RE = /^development_status:\s*(?:#.*)?$/;

function updateSummaryCommentHeaders(lines, doneCount, totalCount) {
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const remaining = Math.max(0, totalCount - doneCount);
  for (let j = 0; j < Math.min(25, lines.length); j++) {
    const compMatch = /^(\s*)#\s*Completed Stories:\s*\d+/i.exec(lines[j]);
    if (compMatch) {
      lines[j] = `${compMatch[1]}# Completed Stories: ${doneCount} of ${totalCount} (Reconciled by BMAD Companion)`;
      continue;
    }
    const remMatch = /^(\s*)#\s*Remaining Backlog:\s*\d+/i.exec(lines[j]);
    if (remMatch) {
      lines[j] = `${remMatch[1]}# Remaining Backlog: ${remaining} stories`;
      continue;
    }
    const pctMatch = /^(\s*)#\s*Progress:\s*\d+%/i.exec(lines[j]);
    if (pctMatch) {
      lines[j] = `${pctMatch[1]}# Progress: ${pct}% (${doneCount}/${totalCount} stories)`;
    }
  }
}

export function reconcileWorkspaceTrackers(workspaceRoot, options = {}) {
  if (!workspaceRoot || typeof workspaceRoot !== "string") {
    throw new Error("reconcileWorkspaceTrackers requires a non-empty workspaceRoot string");
  }
  const dryRun = options.dryRun === true || options.dryRun === "true";
  const makeBackup = options.backup !== false && options.backup !== "false";
  const target = options.target || "all"; // "all" | "v6-yaml" | "v7-tickets"
  if (!["all", "v6-yaml", "v7-tickets"].includes(target)) {
    throw new Error(`Invalid target '${target}': must be one of 'all', 'v6-yaml', 'v7-tickets'`);
  }
  const rootResolved = resolve(workspaceRoot);

  const initialScan = scanBmadWorkspace(workspaceRoot);
  const changes = [];
  const updatedFiles = new Set();

  const storyStatusMap = new Map();
  const storyEvidenceMap = new Map();
  const storyByOverrideKey = new Map();
  const storyByKey = new Map();
  for (const epic of initialScan.epics) {
    storyStatusMap.set(epic.id, epic.smartStatus);
    storyStatusMap.set(epic.slug, epic.smartStatus);
    for (const story of epic.stories) {
      storyStatusMap.set(story.key, story.smartStatus);
      if (story.id) storyStatusMap.set(story.id, story.smartStatus);
      if (story.overrideKey) storyByOverrideKey.set(story.overrideKey, story);
      if (story.key) storyByKey.set(story.key, story);
      const reason = story.smartReason || story.smartEvidence;
      if (reason) {
        storyEvidenceMap.set(story.key, reason);
        if (story.id) storyEvidenceMap.set(story.id, reason);
      }
    }
  }

  function isConfinedTrackerFile(filePath) {
    const rel = relative(rootResolved, resolve(filePath)).replace(/\\/g, "/");
    return Boolean(rel && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel));
  }

  const candidateFiles = walkFiles(workspaceRoot, workspaceRoot, 6).filter(
    (cf) =>
      !cf.relPath.includes("node_modules/") &&
      !cf.relPath.startsWith(".zcode/") &&
      !cf.relPath.startsWith(".test-home/") &&
      isConfinedTrackerFile(cf.fullPath)
  );

  // 1. Reconcile BMAD v6 YAML files (sprint-status.yaml / sprint-status.yml)
  if (target === "all" || target === "v6-yaml") {
    const yamlFiles = candidateFiles
      .filter((cf) => cf.name === "sprint-status.yaml" || cf.name === "sprint-status.yml")
      .map((cf) => cf.fullPath);

    for (const yPath of yamlFiles) {
      const rel = relative(workspaceRoot, yPath).replace(/\\/g, "/");
      const text = safeReadText(yPath, 500000);
      if (!text || !text.includes("development_status:")) continue;

      const eol = text.includes("\r\n") ? "\r\n" : "\n";
      const lines = text.split(/\r?\n/);
      let fileModified = false;
      const newLines = [];
      let inDevStatus = false;
      let doneCount = 0;
      let totalCount = 0;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (DEV_STATUS_SECTION_RE.test(line.trim())) {
          inDevStatus = true;
          newLines.push(line);
          continue;
        }

        if (inDevStatus) {
          if (/^[a-zA-Z0-9_-]+:/.test(line) && !line.startsWith(" ") && !line.startsWith("\t")) {
            inDevStatus = false;
          } else {
            const m = /^(\s*)([a-zA-Z0-9_.\u00C0-\u017F-]+):\s*(['"]?)([a-zA-Z0-9_-]+)\3(\s*(?:#.*)?)$/.exec(line);
            if (m) {
              const [, indent, key, quote, currentVal, comment] = m;
              const isEpicKey = /^epic-\d+/.test(key);
              const isStoryKey = !isEpicKey && !key.endsWith("-retrospective") && (/^\d+-\d+-/.test(key) || storyByKey.has(key));
              if (isStoryKey) {
                totalCount++;
              }
              const targetStatus = storyStatusMap.get(key);
              if (targetStatus && normalizeStatus(currentVal) !== targetStatus) {
                fileModified = true;
                changes.push({
                  file: rel,
                  type: "v6-yaml",
                  key,
                  oldStatus: currentVal,
                  newStatus: targetStatus,
                  reason: storyEvidenceMap.get(key) || "Code and artifact verification confirms completion"
                });
                const commentPart =
                  comment && comment.includes("#")
                    ? comment
                    : `${comment || ""} # Reconciled by BMAD Companion (${targetStatus})`;
                line = `${indent}${key}: ${quote}${targetStatus}${quote}${commentPart}`;
                if (targetStatus === "done" && isStoryKey) doneCount++;
              } else if (normalizeStatus(currentVal) === "done" && isStoryKey) {
                doneCount++;
              }
            }
          }
        }

        // Update last_updated timestamp in header
        if (!inDevStatus && /^(\s*last_updated:\s*)([^#\r\n]*?)(\s*(?:#.*)?)$/.test(line)) {
          const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
          line = line.replace(/^(\s*last_updated:\s*)([^#\r\n]*?)(\s*(?:#.*)?)$/, (_, p1, _old, p3) => `${p1}${nowStr}${p3}`);
        }

        newLines.push(line);
      }

      if (fileModified) {
        const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        const remaining = Math.max(0, totalCount - doneCount);
        updateSummaryCommentHeaders(newLines, doneCount, totalCount);

        let beforeDevStatus = true;
        for (let j = 0; j < newLines.length; j++) {
          if (DEV_STATUS_SECTION_RE.test(newLines[j].trim())) {
            beforeDevStatus = false;
            continue;
          }
          if (!beforeDevStatus) continue;
          if (/^(\s*(?:completed_stories|done_stories):\s*)\d+(\s*(?:#.*)?)$/.test(newLines[j])) {
            newLines[j] = newLines[j].replace(/^(\s*(?:completed_stories|done_stories):\s*)\d+(\s*(?:#.*)?)$/, `$1${doneCount}$2`);
          } else if (/^(\s*remaining_stories:\s*)\d+(\s*(?:#.*)?)$/.test(newLines[j])) {
            newLines[j] = newLines[j].replace(/^(\s*remaining_stories:\s*)\d+(\s*(?:#.*)?)$/, `$1${remaining}$2`);
          } else if (/^(\s*total_stories:\s*)\d+(\s*(?:#.*)?)$/.test(newLines[j])) {
            newLines[j] = newLines[j].replace(/^(\s*total_stories:\s*)\d+(\s*(?:#.*)?)$/, `$1${totalCount}$2`);
          } else if (/^(\s*progress_pct:\s*)\d+(\s*(?:#.*)?)$/.test(newLines[j])) {
            newLines[j] = newLines[j].replace(/^(\s*progress_pct:\s*)\d+(\s*(?:#.*)?)$/, `$1${pct}$2`);
          }
        }

        updatedFiles.add(rel);
        if (!dryRun) {
          try {
            if (makeBackup) {
              writeFileSync(`${yPath}.bak`, text, "utf8");
            }
            writeFileSync(yPath, newLines.join(eol), "utf8");
          } catch (err) {
            throw new Error(`Failed to reconcile v6 YAML tracker '${rel}': ${errorMessage(err)}`);
          }
        }
      }
    }
  }

  // 2. Reconcile BMAD v7 TOML files (tickets.toml)
  if (target === "all" || target === "v7-tickets") {
    const ticketsFiles = candidateFiles.filter((cf) => cf.name === "tickets.toml");

    for (const tf of ticketsFiles) {
      const rel = relative(workspaceRoot, tf.fullPath).replace(/\\/g, "/");
      const text = safeReadText(tf.fullPath, 500000);
      if (!text || !text.includes("[[entry]]")) continue;

      const eol = text.includes("\r\n") ? "\r\n" : "\n";
      const epicSlugMatch = /(?:^|\/)(epic-[^/]+)\/(?:tickets\/)?tickets\.toml$/.exec(rel);
      const epicSlug = epicSlugMatch ? epicSlugMatch[1] : null;

      let fileModified = false;
      const lines = text.split(/\r?\n/);

      // Partition into header lines and [[entry]] / [[...]] sections
      const sections = [];
      let currentSection = { kind: "header", lines: [] };
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^\[\[entry\]\]\s*(?:#.*)?$/.test(trimmed)) {
          sections.push(currentSection);
          currentSection = { kind: "entry", lines: [line] };
        } else if (/^\[\[.+\]\]\s*(?:#.*)?$/.test(trimmed)) {
          sections.push(currentSection);
          currentSection = { kind: "other", lines: [line] };
        } else {
          currentSection.lines.push(line);
        }
      }
      sections.push(currentSection);

      let doneCount = 0;
      let totalCount = 0;

      for (const sec of sections) {
        if (sec.kind !== "entry") continue;
        totalCount++;

        let entryId = null;
        let v6Key = null;
        let statusLineIdx = -1;
        let statusMatch = null;
        let anchorLineIdx = 0;
        let blockIndent = "";

        for (let idx = 1; idx < sec.lines.length; idx++) {
          const line = sec.lines[idx];
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;

          const idm = /^(\s*)id\s*=\s*(\d+)(?:\s*(?:#.*)?)$/.exec(line);
          if (idm) {
            entryId = Number(idm[2]);
            blockIndent = idm[1];
            anchorLineIdx = idx;
            continue;
          }

          const v6m = /^(\s*)v6_key\s*=\s*["']([^"']+)["'](?:\s*(?:#.*)?)$/.exec(line);
          if (v6m) {
            v6Key = v6m[2];
            if (!blockIndent) blockIndent = v6m[1];
            anchorLineIdx = idx;
            continue;
          }

          const titlem = /^(\s*)title\s*=/.exec(line);
          if (titlem) {
            if (!blockIndent) blockIndent = titlem[1];
            anchorLineIdx = idx;
          }

          const sm = /^(\s*)status\s*=\s*(["'])([^"']*)\2(\s*(?:#.*)?)$/.exec(line);
          if (sm) {
            statusLineIdx = idx;
            statusMatch = sm;
          }
        }

        const matchedStory =
          (epicSlug && entryId !== null ? storyByOverrideKey.get(`${epicSlug}#${entryId}`) : null) ||
          (v6Key ? storyByKey.get(v6Key) : null) ||
          null;

        const targetStatus = matchedStory
          ? matchedStory.smartStatus
          : v6Key
            ? storyStatusMap.get(v6Key)
            : null;

        const currentStatusRaw = statusMatch ? statusMatch[3] : null;
        const changeKey = v6Key || (matchedStory ? matchedStory.key : epicSlug && entryId !== null ? `${epicSlug}#${entryId}` : null);
        const reason =
          (matchedStory && (matchedStory.smartReason || matchedStory.smartEvidence)) ||
          (changeKey && storyEvidenceMap.get(changeKey)) ||
          "V7 tickets.toml reconciled with code reality";

        let effectiveStatus = currentStatusRaw || "backlog";

        if (targetStatus && changeKey) {
          if (statusLineIdx >= 0) {
            if (normalizeStatus(currentStatusRaw) !== targetStatus) {
              const [, indent, quote, , comment] = statusMatch;
              sec.lines[statusLineIdx] = `${indent}status = ${quote}${targetStatus}${quote}${comment || ""}`;
              fileModified = true;
              changes.push({
                file: rel,
                type: "v7-tickets",
                key: changeKey,
                oldStatus: currentStatusRaw,
                newStatus: targetStatus,
                reason
              });
              effectiveStatus = targetStatus;
            }
          } else if (targetStatus !== "backlog") {
            sec.lines.splice(anchorLineIdx + 1, 0, `${blockIndent}status = "${targetStatus}"`);
            fileModified = true;
            changes.push({
              file: rel,
              type: "v7-tickets",
              key: changeKey,
              oldStatus: "unspecified",
              newStatus: targetStatus,
              reason
            });
            effectiveStatus = targetStatus;
          }
        }

        if (normalizeStatus(effectiveStatus) === "done") {
          doneCount++;
        }
      }

      if (fileModified) {
        if (sections[0]?.kind === "header") {
          updateSummaryCommentHeaders(sections[0].lines, doneCount, totalCount);
        }
        const newLines = sections.flatMap((sec) => sec.lines);
        updatedFiles.add(rel);
        if (!dryRun) {
          try {
            if (makeBackup) {
              writeFileSync(`${tf.fullPath}.bak`, text, "utf8");
            }
            writeFileSync(tf.fullPath, newLines.join(eol), "utf8");
          } catch (err) {
            throw new Error(`Failed to reconcile v7 tickets tracker '${rel}': ${errorMessage(err)}`);
          }
        }
      }
    }
  }

  // 3. Record reconciliation audit log in .zcode/bmad-companion/reconciliation-log.json
  const reconciledAt = new Date().toISOString();
  const logEntry = {
    reconciledAt,
    dryRun,
    target,
    backup: makeBackup,
    changesCount: changes.length,
    updatedFiles: Array.from(updatedFiles),
    changes
  };

  if (!dryRun && changes.length > 0) {
    const logDir = join(workspaceRoot, ".zcode", "bmad-companion");
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, "reconciliation-log.json");

    let existingLogs = [];
    try {
      if (existsSync(logFile)) existingLogs = JSON.parse(readFileSync(logFile, "utf8"));
    } catch {}
    if (!Array.isArray(existingLogs)) existingLogs = [];
    existingLogs.unshift(logEntry);
    try {
      writeFileSync(logFile, JSON.stringify(existingLogs.slice(0, 20), null, 2), "utf8");
    } catch (err) {
      throw new Error(`Failed to append reconciliation audit log '${relative(workspaceRoot, logFile).replace(/\\/g, "/")}': ${errorMessage(err)}`);
    }

    // Clean up any temporary overrides that are now natively written into the files
    savePersistedState(workspaceRoot, {
      storyOverrides: {},
      lastReconciledAt: logEntry.reconciledAt
    });
  }

  const postScan = scanBmadWorkspace(workspaceRoot);

  return {
    reconciledAt: logEntry.reconciledAt,
    dryRun,
    target,
    changesCount: changes.length,
    updatedFiles: Array.from(updatedFiles),
    changes,
    before: {
      declaredOverallPct: initialScan.metrics.declaredOverallPct,
      smartOverallPct: initialScan.metrics.smartOverallPct,
      declaredDoneStories: initialScan.metrics.declaredDoneStories,
      smartDoneStories: initialScan.metrics.smartDoneStories
    },
    after: {
      declaredOverallPct: postScan.metrics.declaredOverallPct,
      smartOverallPct: postScan.metrics.smartOverallPct,
      declaredDoneStories: postScan.metrics.declaredDoneStories,
      smartDoneStories: postScan.metrics.smartDoneStories
    },
    newScan: postScan
  };
}

// ============================================================================
// Multi-Task Execution Queue, Per-Task Model Selector & Workflow Generator
// ============================================================================

// --- Shared queue vocabulary ------------------------------------------------
// Single source of truth for queue enums, defaults, artifact paths, and
// prompt-shaping text so the queue view builder, the workflow compiler, and
// the action dispatcher never drift apart.

const VALID_QUEUE_ACTIONS = [
  "get",
  "add",
  "add-epic",
  "update-item",
  "retry-failed",
  "set-review-mode",
  "set-execution-mode",
  "reorder",
  "remove",
  "clear",
  "start-queue",
  "start-task",
  "complete-task",
  "pause-queue",
  "generate-workflow"
];
const VALID_REVIEW_MODES = ["none", "quick", "thorough"];
const VALID_EXECUTION_MODES = ["dynamic-workflow", "separate-sessions"];
const VALID_TASK_STATUSES = ["queued", "running", "done", "failed", "skipped"];
const VALID_STORY_STATUSES = ["done", "review", "in-progress", "backlog"];

const DEFAULT_REVIEW_MODE = "none";
const DEFAULT_EXECUTION_MODE = "dynamic-workflow";
const FALLBACK_QUEUE_MODEL_ID = "new-provider/claude-sonnet-5-5-high";

// Generated queue workflow artifacts, workspace-root relative.
const QUEUE_WORKFLOW_REL_PATH = ".zcode/workflows/bmad-task-queue.dwf.ts";
const QUEUE_UPDATER_REL_PATH = ".zcode/bmad-companion/queue-step-updater.mjs";

// Actions that accept an explicit executionMode override, and actions that
// require regenerated workflow artifacts after mutating a non-empty queue.
const EXECUTION_MODE_ACTIONS = ["add", "add-epic", "set-execution-mode", "start-queue", "generate-workflow"];
const WORKFLOW_REGENERATION_ACTIONS = [
  "start-queue",
  "generate-workflow",
  "set-execution-mode",
  "add",
  "add-epic",
  "update-item",
  "retry-failed",
  "set-review-mode",
  "reorder"
];

// Prompt grammar shared by buildEffectiveTaskPrompt and normalizeComparablePrompt.
const EXECUTION_POLICY_RE = /\s*\[Execution Policy:[^\]]*\]/gi;
const ROUTE_HINT_RE = /\s*\(route:\s*(?:oneshot|full),\s*review:\s*(?:none|quick|thorough)[^)]*\)/gi;

// Prompt shaping keyed by normalized reviewMode.
const EXECUTION_POLICY_SUFFIX_BY_REVIEW_MODE = {
  none: "[Execution Policy: oneshot route, skip multi-lens LLM review, verify via deterministic tests only]",
  quick: "[Execution Policy: oneshot route, single self-review pass, verify via deterministic tests]",
  thorough: "[Execution Policy: full route, multi-lens BMAD code review gate]"
};
const ROUTE_HINT_BY_REVIEW_MODE = {
  none: " (route: oneshot, review: none — skip review lenses, run deterministic verification commands only)",
  quick: " (route: oneshot, review: quick — single self-review pass)",
  thorough: " (route: full, review: thorough — multi-lens BMAD code review gate)"
};
const REVIEW_POLICY_DESC_BY_REVIEW_MODE = {
  none: "Token-saving mode (route=oneshot, review=none): implement directly in this session without spawning nested review subagents, run deterministic tests/checks directly, and leave the repository clean.",
  quick: "Quick review mode (route=oneshot, review=quick): implement directly, run deterministic verification commands, and perform one concise self-review pass.",
  thorough: "Thorough mode (route=full, review=thorough): follow full BMAD plan, implementation, verification, and review gates."
};

function normalizeReviewMode(value, fallback = DEFAULT_REVIEW_MODE) {
  if (VALID_REVIEW_MODES.includes(value)) return value;
  return VALID_REVIEW_MODES.includes(fallback) ? fallback : DEFAULT_REVIEW_MODE;
}

function normalizeExecutionMode(value) {
  return VALID_EXECUTION_MODES.includes(value) ? value : DEFAULT_EXECUTION_MODE;
}

function resolveDefaultModelId(availableModels = []) {
  return (
    availableModels.find((m) => m.current)?.id ||
    availableModels[0]?.id ||
    FALLBACK_QUEUE_MODEL_ID
  );
}

function extractTaskPromptText(item) {
  return String(item?.prompt || item?.fullCommand || "").trim();
}

// Positional fallback id shared by the queue view builder and the workflow compiler.
function defaultQueueTaskId(idx) {
  return `qtask-${idx + 1}`;
}

// Default persisted taskQueue shape shared by loadPersistedState and
// savePersistedState (function declarations hoist; both run only after
// module evaluation, so the constants above are always initialized).
function createDefaultTaskQueueState() {
  return {
    status: "idle",
    executionMode: DEFAULT_EXECUTION_MODE,
    defaultReviewMode: DEFAULT_REVIEW_MODE,
    activeTaskId: null,
    workflowPath: null,
    updatedAt: null,
    items: []
  };
}

// True when an advisor recommendation refers to the same work as a completed
// queue item (matching normalized prompt or title). Shared by
// isRecommendationCompleted and the complete-task recommendation pruning.
function recommendationMatchesCompletedItem(rec, completedItem) {
  const recPrompt = normalizeComparablePrompt(rec?.fullCommand || rec?.prompt || "");
  const recTitle = String(rec?.title || "").trim().toLowerCase();
  const itemPrompt = normalizeComparablePrompt(completedItem?.prompt || completedItem?.effectivePrompt || "");
  const itemTitle = String(completedItem?.title || "").trim().toLowerCase();
  if (recPrompt && itemPrompt && recPrompt === itemPrompt) return true;
  if (recTitle && itemTitle && recTitle === itemTitle) return true;
  return false;
}

export function buildEffectiveTaskPrompt(item, defaultReviewMode = DEFAULT_REVIEW_MODE) {
  const basePrompt = typeof item === "string" ? item.trim() : extractTaskPromptText(item);
  const rawReviewMode = item && typeof item === "object" ? item.reviewMode : null;
  const reviewMode = normalizeReviewMode(rawReviewMode, defaultReviewMode);
  if (!basePrompt) return "";

  const isBuildSkill = /^\/bmad-build(?:-auto)?\b/i.test(basePrompt);
  if (!isBuildSkill) {
    const cleanPrompt = basePrompt
      .replace(EXECUTION_POLICY_RE, "")
      .replace(ROUTE_HINT_RE, "")
      .trim();
    return `${cleanPrompt} ${EXECUTION_POLICY_SUFFIX_BY_REVIEW_MODE[reviewMode]}`;
  }

  // Upgrade /bmad-build to /bmad-build-auto when running unattended in a queue,
  // then strip all prior route hints and execution policies inside or outside quotes.
  const normalized = basePrompt
    .replace(/^\/bmad-build\b(?!-auto)/i, "/bmad-build-auto")
    .replace(ROUTE_HINT_RE, "")
    .replace(EXECUTION_POLICY_RE, "")
    .trim();

  const routeHint = ROUTE_HINT_BY_REVIEW_MODE[reviewMode];
  if (normalized.endsWith('"')) {
    return `${normalized.slice(0, -1).trimEnd()}${routeHint}"`;
  }
  return `${normalized}${routeHint}`;
}

/**
 * Build the unattended launch instruction for one queued task in
 * separate-sessions mode. The queue runs as a handoff chain: the orchestrator
 * starts only the first task and ends its turn, and each finished task
 * session's Stop hook starts the next task with its own model. This avoids a
 * long-lived orchestrator turn that can be interrupted or left waiting on a
 * host approval prompt.
 */
export function buildTaskSessionLaunchInstructions(item) {
  const taskId = JSON.stringify(String(item?.id || ""));
  const model = JSON.stringify(String(item?.model || ""));
  const shapedPrompt = String(item?.effectivePrompt || buildEffectiveTaskPrompt(item || {}) || item?.prompt || "");
  const prompt = JSON.stringify(shapedPrompt);
  return [
    `1. Call CreateSession({ project: <the ListProjects entry for this workspace>, model: ${model}, prompt: ${prompt} }).`,
    `2. Call bmad_queue_manage({ action: "start-task", taskId: ${taskId}, sessionId: "<sessionId from the CreateSession result>" }).`,
    `3. Do not call WaitSessions and do not create sessions for later tasks. End your turn after step 2; the new task session continues the queue when it finishes.`,
    `If CreateSession fails or returns needs_attention without a sessionId, call bmad_queue_manage({ action: "complete-task", taskId: ${taskId}, failed: true, summary: "<blocker>" }) and stop with the blocker.`
  ].join("\n");
}

export function buildTaskQueueView(rawQueue, allStories = [], availableModels = []) {
  const q = rawQueue && typeof rawQueue === "object" ? rawQueue : {};
  const defaultModelId = resolveDefaultModelId(availableModels);
  const defaultReviewMode = normalizeReviewMode(q.defaultReviewMode);
  const executionMode = normalizeExecutionMode(q.executionMode);

  const storyMapByOverride = new Map();
  const storyMapByEpicAndId = new Map();
  const storyMapById = new Map();
  for (const s of allStories) {
    if (s.overrideKey) storyMapByOverride.set(s.overrideKey, s);
    if (s.epicSlug && s.id) storyMapByEpicAndId.set(`${s.epicSlug}::${String(s.id)}`, s);
    if (s.id) storyMapById.set(String(s.id), s);
  }

  const rawItems = Array.isArray(q.items) ? q.items : [];
  const items = rawItems.map((it, idx) => {
    const reviewMode = normalizeReviewMode(it.reviewMode, defaultReviewMode);
    const model = String(it.model || it.recommendedModel || defaultModelId).trim() || defaultModelId;
    const matchedStory =
      (it.overrideKey && storyMapByOverride.get(it.overrideKey)) ||
      (it.epicSlug && it.storyId && storyMapByEpicAndId.get(`${it.epicSlug}::${String(it.storyId)}`)) ||
      (it.storyId && storyMapById.get(String(it.storyId))) ||
      null;
    let status = VALID_TASK_STATUSES.includes(it.status) ? it.status : "queued";
    if (matchedStory && matchedStory.smartStatus === "done" && status === "queued" && !it.forceQueued) {
      status = "done";
    }
    const prompt = extractTaskPromptText(it);
    return {
      id: it.id || defaultQueueTaskId(idx),
      order: idx + 1,
      title: it.title || (matchedStory ? `Story ${matchedStory.id}: ${matchedStory.title}` : `Task ${idx + 1}`),
      skill: it.skill || "/bmad-build-auto",
      prompt,
      effectivePrompt: buildEffectiveTaskPrompt({ ...it, prompt, reviewMode }, defaultReviewMode),
      model,
      modelShort: model.split("/").pop(),
      reviewMode,
      status,
      storyId: it.storyId || matchedStory?.id || null,
      overrideKey: it.overrideKey || matchedStory?.overrideKey || null,
      epicSlug: it.epicSlug || matchedStory?.epicSlug || null,
      verifyCommand: it.verifyCommand || matchedStory?.verify || "",
      sessionId: it.sessionId || null,
      startedAt: it.startedAt || null,
      completedAt: it.completedAt || null,
      resultSummary: it.resultSummary || null,
      ...(it.forceQueued && status === "queued" ? { forceQueued: true } : {})
    };
  });

  const activeTask =
    items.find((it) => it.id === q.activeTaskId && it.status === "running") ||
    items.find((it) => it.status === "running") ||
    null;
  const queuedItems = items.filter((it) => it.status === "queued");
  const completedItems = items.filter((it) => it.status === "done");
  const failedItems = items.filter((it) => it.status === "failed");

  let overallStatus = q.status || "idle";
  if (activeTask) {
    overallStatus = "running";
  } else if (items.length > 0 && queuedItems.length === 0 && completedItems.length > 0) {
    overallStatus = "completed";
  } else if (items.length === 0) {
    overallStatus = "idle";
  }

  const totalCount = items.length;
  const doneCount = completedItems.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return {
    status: overallStatus,
    executionMode,
    defaultReviewMode,
    activeTaskId: activeTask ? activeTask.id : null,
    activeTask,
    nextQueuedTask: queuedItems[0] || null,
    workflowPath: q.workflowPath || QUEUE_WORKFLOW_REL_PATH,
    updatedAt: q.updatedAt || null,
    counts: {
      total: totalCount,
      running: activeTask ? 1 : 0,
      queued: queuedItems.length,
      done: doneCount,
      failed: failedItems.length,
      progressPct
    },
    items
  };
}

function resolveConfinedGeneratedPath(workspaceRoot, relPath) {
  const rawRoot = String(workspaceRoot ?? "").trim();
  if (!rawRoot || rawRoot.includes("\0")) {
    throw new Error("Workspace root must be a valid non-empty path.");
  }
  const rootResolved = resolve(rawRoot);
  if (!existsSync(rootResolved) || !statSync(rootResolved).isDirectory()) {
    throw new Error("Workspace root must refer to an existing directory.");
  }
  const cleanRel = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleanRel || cleanRel.includes("\0")) {
    throw new Error("Generated workflow path must stay within the workspace root.");
  }
  const targetFull = resolve(rootResolved, cleanRel);
  const relCheck = relative(rootResolved, targetFull).replace(/\\/g, "/");
  if (!relCheck || relCheck === ".." || relCheck.startsWith("../") || isAbsolute(relCheck)) {
    throw new Error("Generated workflow path must stay within the workspace root.");
  }
  const targetDir = dirname(targetFull);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const rootReal = realpathSync(rootResolved);
  const dirReal = realpathSync(targetDir);
  const dirRel = relative(rootReal, dirReal).replace(/\\/g, "/");
  if (dirRel === ".." || dirRel.startsWith("../") || isAbsolute(dirRel)) {
    throw new Error("Generated workflow directory escapes the workspace root.");
  }
  if (existsSync(targetFull)) {
    const lst = lstatSync(targetFull);
    if (lst.isSymbolicLink()) {
      throw new Error("Generated workflow target must not be a symlink.");
    }
    const targetReal = realpathSync(targetFull);
    const targetRealRel = relative(rootReal, targetReal).replace(/\\/g, "/");
    if (!targetRealRel || targetRealRel === ".." || targetRealRel.startsWith("../") || isAbsolute(targetRealRel)) {
      throw new Error("Generated workflow path must stay within the workspace root.");
    }
  }
  return {
    relPath: relCheck,
    fullPath: targetFull
  };
}

export function generateQueueWorkflowFiles(workspaceRoot, queueView) {
  const updaterTarget = resolveConfinedGeneratedPath(workspaceRoot, QUEUE_UPDATER_REL_PATH);
  const workflowTarget = resolveConfinedGeneratedPath(workspaceRoot, QUEUE_WORKFLOW_REL_PATH);

  const updaterRelPath = updaterTarget.relPath;
  const updaterFullPath = updaterTarget.fullPath;

  // NOTE: the generated updater must stay dependency-free inside the target
  // workspace, so its normPrompt() below intentionally mirrors
  // normalizeComparablePrompt(); keep the two in sync when the prompt grammar
  // (EXECUTION_POLICY_RE / ROUTE_HINT_RE) changes.
  const updaterCode = [
    `import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";`,
    `import { join } from "node:path";`,
    ``,
    `function normPrompt(text) {`,
    `  let str = String(text || "").trim();`,
    `  const hasQuote = str.endsWith('"');`,
    `  if (hasQuote) str = str.slice(0, -1);`,
    `  str = str`,
    `    .replace(/^\\/bmad-build-auto\\b/i, "/bmad-build")`,
    `    .replace(/\\s*\\[Execution Policy:[^\\]]*\\]/gi, "")`,
    `    .replace(/\\s*\\(route:\\s*(?:oneshot|full),\\s*review:\\s*(?:none|quick|thorough)[^)]*\\)/gi, "")`,
    `    .replace(/\\s+/g, " ")`,
    `    .trim();`,
    `  return (hasQuote ? (str + '"') : str).toLowerCase();`,
    `}`,
    ``,
    `const [, , action, taskId, overrideKey = "", summaryText = ""] = process.argv;`,
    `const stateFile = join(process.cwd(), ".zcode", "bmad-companion", "state.json");`,
    `if (existsSync(stateFile)) {`,
    `  const state = JSON.parse(readFileSync(stateFile, "utf8"));`,
    `  const q = state.taskQueue || { items: [] };`,
    `  const items = Array.isArray(q.items) ? q.items : [];`,
    `  const now = new Date().toISOString();`,
    `  const target = items.find((it) => it.id === taskId);`,
    `  if (action === "start" && target) {`,
    `    items.forEach((it) => { if (it.status === "running") it.status = "queued"; });`,
    `    target.status = "running";`,
    `    target.startedAt = now;`,
    `    q.activeTaskId = target.id;`,
    `    q.status = "running";`,
    `    if (overrideKey) {`,
    `      state.storyOverrides = state.storyOverrides || {};`,
    `      state.storyOverrides[overrideKey] = { status: "in-progress", reason: "Active in BMAD Companion Queue (" + target.title + ")", updatedAt: now };`,
    `    }`,
    `  } else if ((action === "done" || action === "fail") && target) {`,
    `    target.status = action === "done" ? "done" : "failed";`,
    `    target.completedAt = now;`,
    `    if (summaryText) target.resultSummary = summaryText;`,
    `    if (action === "done" && overrideKey) {`,
    `      state.storyOverrides = state.storyOverrides || {};`,
    `      state.storyOverrides[overrideKey] = { status: "done", reason: summaryText || ("Completed via BMAD Queue (" + target.title + ")"), updatedAt: now };`,
    `    }`,
    `    if (action === "done" && state.agentAdvisorOverride && Array.isArray(state.agentAdvisorOverride.recommendations)) {`,
    `      const targetPrompt = normPrompt(target.prompt || target.effectivePrompt || "");`,
    `      const targetTitle = String(target.title || "").trim().toLowerCase();`,
    `      state.agentAdvisorOverride.recommendations = state.agentAdvisorOverride.recommendations.filter((r) => {`,
    `        const rp = normPrompt(r?.fullCommand || r?.prompt || "");`,
    `        const rt = String(r?.title || "").trim().toLowerCase();`,
    `        if (targetPrompt && rp && rp === targetPrompt) return false;`,
    `        if (targetTitle && rt && rt === targetTitle) return false;`,
    `        return true;`,
    `      });`,
    `    }`,
    `    q.activeTaskId = null;`,
    `    if (items.some((it) => it.status === "queued")) {`,
    `      if (action === "fail") q.status = "paused";`,
    `      else if (q.status !== "paused") q.status = "running";`,
    `    } else {`,
    `      q.status = "completed";`,
    `      state.lastWorkflowCompletedAt = now;`,
    `      state.agentAdvisorOverride = null;`,
    `    }`,
    `  } else if (action === "finish") {`,
    `    items.forEach((it) => { if (it.status === "running") it.status = "done"; });`,
    `    q.activeTaskId = null;`,
    `    if (items.some((it) => it.status === "queued")) {`,
    `      q.status = "paused";`,
    `    } else if (items.length > 0) {`,
    `      q.status = "completed";`,
    `    } else {`,
    `      q.status = "idle";`,
    `    }`,
    `    state.lastWorkflowCompletedAt = now;`,
    `    const overrideMs = Date.parse(state.agentAdvisorOverride?.updatedAt || "");`,
    `    if (state.agentAdvisorOverride && (!Number.isFinite(overrideMs) || overrideMs <= Date.parse(now))) {`,
    `      state.agentAdvisorOverride = null;`,
    `    }`,
    `    if (items.length > 0) {`,
    `      const doneCount = items.filter((it) => it.status === "done").length;`,
    `      const failedCount = items.filter((it) => it.status === "failed").length;`,
    `      state.lastAssistantMessage = "BMAD Companion workflow finished: " + doneCount + " done" + (failedCount > 0 ? ", " + failedCount + " failed" : "") + " out of " + items.length + " queued task(s).";`,
    `      state.lastTurnAnalyzedAt = now;`,
    `    }`,
    `  }`,
    `  q.updatedAt = now;`,
    `  state.taskQueue = q;`,
    `  state.updatedAt = now;`,
    `  const json = JSON.stringify(state, null, 2);`,
    `  const tmpFile = stateFile + ".tmp." + process.pid + "." + Date.now();`,
    `  try {`,
    `    writeFileSync(tmpFile, json, "utf8");`,
    `    renameSync(tmpFile, stateFile);`,
    `  } catch {`,
    `    try { unlinkSync(tmpFile); } catch {}`,
    `    writeFileSync(stateFile, json, "utf8");`,
    `  }`,
    `}`
  ].join("\n");

  writeFileSync(updaterFullPath, updaterCode, "utf8");

  const executionMode = normalizeExecutionMode(queueView?.executionMode);
  const defaultReviewMode = normalizeReviewMode(queueView?.defaultReviewMode);
  const rawItems = Array.isArray(queueView?.items) ? queueView.items : [];
  const normalizedItems = rawItems.map((it, idx) => {
    const revMode = normalizeReviewMode(it?.reviewMode, defaultReviewMode);
    const model = String(it?.model || it?.recommendedModel || "").trim();
    const modelShort = String(it?.modelShort || (model ? model.split("/").pop() : "default")).trim();
    const prompt = extractTaskPromptText(it);
    const effectivePrompt = String(
      it?.effectivePrompt || buildEffectiveTaskPrompt({ ...it, prompt, reviewMode: revMode }, defaultReviewMode)
    ).trim();
    return {
      ...it,
      id: String(it?.id || defaultQueueTaskId(idx)),
      title: String(it?.title || `Task ${idx + 1}`),
      model,
      modelShort,
      reviewMode: revMode,
      prompt,
      effectivePrompt
    };
  });

  const runnableItems = normalizedItems.filter((it) => it.status !== "done" && it.status !== "skipped");
  const targetItems = runnableItems.length > 0 ? runnableItems : normalizedItems;

  // Build unique model declarations using compile-time string literals
  const uniqueModels = [...new Set(targetItems.map((it) => it.model).filter(Boolean))];
  const modelVarByModelId = new Map();
  const modelDecls = uniqueModels.map((mId, idx) => {
    const varName = `model_${idx + 1}`;
    modelVarByModelId.set(mId, varName);
    return `const ${varName} = model(${JSON.stringify(mId)});`;
  });

  const taskBlocks = targetItems.map((it, idx) => {
    const stepNum = idx + 1;
    const modelVar = modelVarByModelId.get(it.model);
    const phaseLabel = `Task ${stepNum}: ${String(it.title).replace(/["\\]/g, "").slice(0, 68)}`;
    const agentName = `Task ${stepNum} (${String(it.storyId || it.id).replace(/["\\]/g, "")})`;
    const reviewPolicyDesc = REVIEW_POLICY_DESC_BY_REVIEW_MODE[it.reviewMode];

    const askInstruction = [
      `Execute BMAD Queue Task #${stepNum}: ${it.title}`,
      `Command / Intent: ${it.effectivePrompt}`,
      it.verifyCommand ? `Verification Gate: ${it.verifyCommand}` : `Verification Gate: Run the repository's syntax and test verification commands.`,
      `Execution Policy: ${reviewPolicyDesc}`,
      `Tracker Sync (Required): After verification passes, update the repository's BMAD tracker (for BMAD v7, create or update \`plan-<ticketId>-*.md\` with \`status: done\` in the epic's \`tickets/\` folder or run \`tickets.py mark\`; for BMAD v6, set the story to \`done\` in \`sprint-status.yaml\`) so progress persists across sessions.`,
      `Return a concise structured outcome confirming what files changed and which verification command passed.`
    ].join("\n");

    return [
      `// --- Queued Task ${stepNum}: ${it.title} ---`,
      `phase(${JSON.stringify(phaseLabel)});`,
      `log(${JSON.stringify(`Starting Task ${stepNum}/${targetItems.length}: ${it.title} [${it.model}] (review: ${it.reviewMode})`)});`,
      `await world.run("node", [${JSON.stringify(updaterRelPath)}, "start", ${JSON.stringify(it.id)}, ${JSON.stringify(it.overrideKey || "")}]);`,
      `report({ taskId: ${JSON.stringify(it.id)}, title: ${JSON.stringify(it.title)}, status: "running", model: ${JSON.stringify(it.modelShort)}, reviewMode: ${JSON.stringify(it.reviewMode)}, summary: "Running in isolated subagent session..." }, "queue");`,
      `const outcome_${stepNum} = await agent(${JSON.stringify(agentName)}, {`,
      modelVar ? `  model: ${modelVar},` : ``,
      `  system: "You are a BMAD execution specialist running an isolated task from the BMAD Companion Queue. Implement the requested story or workflow task cleanly, run its verification commands, and report truthful evidence."`,
      `}).ask<TaskOutcome>(${JSON.stringify(askInstruction)});`,
      `await world.run("node", [${JSON.stringify(updaterRelPath)}, outcome_${stepNum}.passed ? "done" : "fail", ${JSON.stringify(it.id)}, ${JSON.stringify(it.overrideKey || "")}, outcome_${stepNum}.summary]);`,
      `report({ taskId: ${JSON.stringify(it.id)}, title: ${JSON.stringify(it.title)}, status: outcome_${stepNum}.passed ? "done" : "failed", model: ${JSON.stringify(it.modelShort)}, reviewMode: ${JSON.stringify(it.reviewMode)}, summary: outcome_${stepNum}.summary }, "queue");`,
      `verifiedCommands.push(outcome_${stepNum}.verificationCommand);`,
      `if (!outcome_${stepNum}.passed) {`,
      `  findings.push({`,
      `    where: outcome_${stepNum}.primaryFile || ${JSON.stringify(it.epicSlug || "workspace")},`,
      `    what: ${JSON.stringify(`Task ${stepNum} (${it.title}) reported a verification failure: `)} + outcome_${stepNum}.summary,`,
      `    evidence: outcome_${stepNum}.verificationCommand,`,
      `    status: "verified",`,
      `    severity: "high"`,
      `  });`,
      `}`,
      `summaryLines.push(${JSON.stringify(`- **${it.title}** (\`${it.model}\`, review: \`${it.reviewMode}\`): `)} + (outcome_${stepNum}.passed ? "PASSED — " : "FAILED — ") + outcome_${stepNum}.summary);`
    ]
      .filter(Boolean)
      .join("\n");
  });

  const workflowRelPath = workflowTarget.relPath;
  const workflowFullPath = workflowTarget.fullPath;

  const workflowScript = [
    `interface TaskOutcome {`,
    `  /** True if implementation and deterministic verification succeeded. */`,
    `  passed: boolean;`,
    `  /** Primary file or artifact path created or updated. */`,
    `  primaryFile: string;`,
    `  /** Exact verification command executed and its exit result. */`,
    `  verificationCommand: string;`,
    `  /** One-sentence summary of what was delivered and verified. */`,
    `  summary: string;`,
    `}`,
    `interface Finding {`,
    `  /** Workspace-relative path, with a line when it applies: "src/a.ts:42". */`,
    `  where: string;`,
    `  /** One sentence: what is wrong, or what was found. */`,
    `  what: string;`,
    `  /** What showed it: the lines read, or the command and the output that proved it. */`,
    `  evidence: string;`,
    `  /** "verified" when an independent subagent or a deterministic check confirmed it; "unconfirmed" when confirmation failed or was not attempted. */`,
    `  status: "verified" | "unconfirmed";`,
    `  /** How much it matters. Reserve "high" for data loss, a crash, or a wrong result. */`,
    `  severity: "low" | "medium" | "high";`,
    `}`,
    `interface WorkflowReport {`,
    `  /** Two or three sentences answering what the user asked for. */`,
    `  conclusion: string;`,
    `  findings: Finding[];`,
    `  /** What the run checked and how: the commands it ran, the files it covered. */`,
    `  verified: string[];`,
    `  /** What the run did not look at or could not check, and why. */`,
    `  notCovered: string[];`,
    `}`,
    ``,
    `artifact.board("queue", {`,
    `  title: "BMAD Companion Task Queue",`,
    `  key: "taskId",`,
    `  status: "status",`,
    `  columns: ["queued", "running", "done", "failed"],`,
    `  cardTitle: "title",`,
    `  detail: [`,
    `    { field: "model", label: "Model" },`,
    `    { field: "reviewMode", label: "Review" },`,
    `    { field: "summary", label: "Outcome" }`,
    `  ]`,
    `});`,
    ``,
    ...modelDecls,
    ``,
    `const findings: Finding[] = [];`,
    `const verifiedCommands: string[] = [];`,
    `const summaryLines: string[] = ["# BMAD Companion Queue Execution Report", ""];`,
    ``,
    ...targetItems.map((it) =>
      `report({ taskId: ${JSON.stringify(it.id)}, title: ${JSON.stringify(it.title)}, status: "queued", model: ${JSON.stringify(it.modelShort)}, reviewMode: ${JSON.stringify(it.reviewMode)}, summary: "Waiting in queue" }, "queue");`
    ),
    ``,
    ...taskBlocks,
    ``,
    `phase("Publish BMAD queue report and synchronize companion");`,
    `await world.run("node", [${JSON.stringify(updaterRelPath)}, "finish"]);`,
    `await artifact.markdown("report", summaryLines.join("\\n"), {`,
    `  title: "BMAD Queue Execution Summary",`,
    `  description: ${JSON.stringify(`Executed ${targetItems.length} queued BMAD task(s) with per-task models and live companion updates.`)},`,
    `  primary: true`,
    `});`,
    ``,
    `const finalReport: WorkflowReport = {`,
    `  conclusion: ${JSON.stringify(`Completed ${targetItems.length} queued BMAD task(s) and updated BMAD Companion state after every task.`)},`,
    `  findings,`,
    `  verified: verifiedCommands,`,
    `  notCovered: ["Multi-lens human review lenses when reviewMode=none was selected for token efficiency"]`,
    `};`,
    `return finalReport;`
  ].join("\n");

  writeFileSync(workflowFullPath, workflowScript, "utf8");

  const workflowLaunchPrompt = `/workflow "Run the generated BMAD Companion task queue workflow at ${workflowRelPath} using CreateWorkflow({ name: 'BMAD Companion Task Queue (${targetItems.length} tasks)', path: '${workflowRelPath}' }) so each queued task runs with its selected model and updates @bmad-companion state live at the start and end of each task."`;

  const firstTask = targetItems[0];
  const separateSessionsPrompt = firstTask
    ? [
        `Execute the @bmad-companion Task Queue (${targetItems.length} tasks) across separate ZCode sessions. Start only the first task now; each finished task session starts the next one automatically through the bmad-companion Stop hook.`,
        buildTaskSessionLaunchInstructions(firstTask)
      ].join("\n")
    : "";

  return {
    executionMode,
    workflowRelPath,
    workflowFullPath,
    updaterRelPath,
    updaterFullPath,
    tasksCount: targetItems.length,
    workflowLaunchPrompt,
    separateSessionsPrompt,
    executionPrompt: executionMode === "separate-sessions" ? separateSessionsPrompt : workflowLaunchPrompt
  };
}

function isSafeStoryOverrideKey(overrideKey) {
  return (
    typeof overrideKey === "string" &&
    STORY_OVERRIDE_KEY_RE.test(overrideKey) &&
    !overrideKey.startsWith("__proto__#") &&
    !overrideKey.startsWith("constructor#") &&
    !overrideKey.startsWith("prototype#")
  );
}

export function manageBmadTaskQueue(workspaceRoot, options = {}) {
  const rawAction = options?.action;
  const action =
    rawAction === undefined || rawAction === null || String(rawAction).trim() === ""
      ? "get"
      : String(rawAction).trim();
  if (!VALID_QUEUE_ACTIONS.includes(action)) {
    throw new Error(`Invalid queue action '${action}'. Expected one of: ${VALID_QUEUE_ACTIONS.join(", ")}.`);
  }

  const scan = scanBmadWorkspace(workspaceRoot);
  const persisted = loadPersistedState(workspaceRoot);
  const currentView = buildTaskQueueView(persisted.taskQueue, scan.epics.flatMap((e) => e.stories), scan.availableModels);

  let items = [...currentView.items];
  let status = currentView.status;
  let executionMode =
    VALID_EXECUTION_MODES.includes(options.executionMode) && EXECUTION_MODE_ACTIONS.includes(action)
      ? options.executionMode
      : currentView.executionMode;
  let defaultReviewMode = currentView.defaultReviewMode;
  let activeTaskId = currentView.activeTaskId;
  const storyOverrides = { ...(persisted.storyOverrides || {}) };
  let advisorOverrideUpdate;
  let workflowCompletedAt;

  const defaultModelId = resolveDefaultModelId(scan.availableModels);

  switch (action) {
  case "add": {
    const incoming = Array.isArray(options.items)
      ? options.items
      : options.item
        ? [options.item]
        : (options.prompt || options.title)
          ? [options]
          : [];
    for (const raw of incoming) {
      if (!raw) continue;
      const prompt = extractTaskPromptText(raw);
      const title = String(raw.title || prompt.slice(0, 60) || "BMAD Task").trim();
      const existingIdx = items.findIndex(
        (it) =>
          (raw.overrideKey && it.overrideKey === raw.overrideKey) ||
          (raw.storyId && it.storyId === raw.storyId) ||
          (prompt && it.prompt === prompt)
      );
      const revMode = normalizeReviewMode(raw.reviewMode, defaultReviewMode);
      const newItem = {
        id: raw.id || `qtask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        skill: raw.skill || "/bmad-build-auto",
        prompt,
        model: raw.model || raw.recommendedModel || defaultModelId,
        reviewMode: revMode,
        status: "queued",
        storyId: raw.storyId || null,
        overrideKey: raw.overrideKey || null,
        epicSlug: raw.epicSlug || null,
        verifyCommand: raw.verifyCommand || ""
      };
      if (existingIdx >= 0) {
        const wasDone = items[existingIdx].status === "done";
        items[existingIdx] = {
          ...items[existingIdx],
          model: newItem.model,
          reviewMode: newItem.reviewMode,
          prompt: newItem.prompt || items[existingIdx].prompt,
          status: wasDone ? "queued" : items[existingIdx].status,
          ...(wasDone ? { forceQueued: true } : {})
        };
      } else {
        items.push(newItem);
      }
    }
    if (status === "completed") status = "idle";
    break;
  }
  case "add-epic": {
    const targetEpicSlug = String(options.epicSlug || "").trim();
    const epic = scan.epics.find((e) => e.slug === targetEpicSlug || e.id === targetEpicSlug || String(e.number) === targetEpicSlug);
    if (epic) {
      const epicReviewMode = normalizeReviewMode(options.reviewMode, defaultReviewMode);
      const storiesToQueue = epic.stories.filter((s) => options.includeDone || s.smartStatus !== "done");
      for (const st of storiesToQueue) {
        const storyPrompt = `/bmad-build-auto "Implement ticket ${st.id} (${st.title}) in ${epic.slug}: ${st.verify || st.description || "satisfy all acceptance criteria and tests"}"`;
        const existingIdx = items.findIndex((it) => it.overrideKey === st.overrideKey || it.storyId === st.id);
        const entry = {
          id: `qtask-${epic.slug}-${String(st.id).replace(/\./g, "-")}`,
          title: `Story ${st.id}: ${st.title}`,
          skill: "/bmad-build-auto",
          prompt: storyPrompt,
          model: options.model || st.recommendedModel?.modelId || defaultModelId,
          reviewMode: epicReviewMode,
          status: "queued",
          storyId: st.id,
          overrideKey: st.overrideKey,
          epicSlug: epic.slug,
          verifyCommand: st.verify || "",
          ...(options.includeDone && st.smartStatus === "done" ? { forceQueued: true } : {})
        };
        if (existingIdx >= 0) {
          items[existingIdx] = { ...items[existingIdx], ...entry };
        } else {
          items.push(entry);
        }
      }
      if (status === "completed") status = "idle";
    }
    break;
  }
  case "update-item": {
    const targetId = String(options.taskId || "");
    const nextStatus = VALID_TASK_STATUSES.includes(options.status) ? options.status : null;
    const nextReviewMode = VALID_REVIEW_MODES.includes(options.reviewMode) ? options.reviewMode : null;
    items = items.map((it) => {
      if (it.id !== targetId) return it;
      const resettingToQueued = nextStatus === "queued" && (it.status === "failed" || it.status === "done");
      if (it.id === activeTaskId && nextStatus && nextStatus !== "running") {
        activeTaskId = null;
      }
      return {
        ...it,
        ...(options.model ? { model: options.model } : {}),
        ...(nextReviewMode ? { reviewMode: nextReviewMode } : {}),
        ...(options.prompt ? { prompt: options.prompt } : {}),
        ...(options.title ? { title: String(options.title).trim() } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextStatus === "queued" ? { forceQueued: true } : {}),
        ...(resettingToQueued ? { startedAt: null, completedAt: null, resultSummary: null, sessionId: null } : {})
      };
    });
    if (nextStatus === "queued" && (status === "completed" || status === "paused")) {
      status = "idle";
    }
    break;
  }
  case "retry-failed": {
    const targetId = options.taskId ? String(options.taskId).trim() : "";
    let resetCount = 0;
    items = items.map((it) => {
      const shouldReset = targetId ? it.id === targetId && it.status !== "running" : it.status === "failed";
      if (!shouldReset) return it;
      resetCount++;
      return {
        ...it,
        status: "queued",
        startedAt: null,
        completedAt: null,
        resultSummary: null,
        sessionId: null
      };
    });
    if (resetCount > 0 && (status === "completed" || status === "paused")) {
      status = "idle";
    }
    break;
  }
  case "set-review-mode": {
    if (VALID_REVIEW_MODES.includes(options.reviewMode)) {
      defaultReviewMode = options.reviewMode;
      if (options.applyToAll !== false) {
        items = items.map((it) => (it.status === "done" ? it : { ...it, reviewMode: defaultReviewMode }));
      }
    }
    break;
  }
  case "set-execution-mode": {
    if (VALID_EXECUTION_MODES.includes(options.executionMode)) {
      executionMode = options.executionMode;
    }
    break;
  }
  case "reorder": {
    const targetId = String(options.taskId || "");
    const dir = options.direction; // "up" | "down"
    const idx = items.findIndex((it) => it.id === targetId);
    if (idx >= 0) {
      const swapIdx = dir === "up" ? idx - 1 : dir === "down" ? idx + 1 : -1;
      if (swapIdx >= 0 && swapIdx < items.length) {
        const copy = [...items];
        const tmp = copy[idx];
        copy[idx] = copy[swapIdx];
        copy[swapIdx] = tmp;
        items = copy;
      }
    }
    break;
  }
  case "remove": {
    const targetId = String(options.taskId || "");
    items = items.filter((it) => it.id !== targetId);
    if (activeTaskId === targetId) {
      activeTaskId = null;
    }
    break;
  }
  case "clear": {
    if (options.onlyCompleted) {
      items = items.filter((it) => it.status !== "done");
    } else {
      items = [];
      activeTaskId = null;
      status = "idle";
    }
    break;
  }
  case "start-queue": {
    if (VALID_EXECUTION_MODES.includes(options.executionMode)) {
      executionMode = options.executionMode;
    }
    // Reset stale running items, then engage the queue without claiming a
    // task: an item becomes `running` only when start-task is called right
    // before its session is launched. Promoting an item here would fake an
    // active task that nothing is executing and wedge the resume paths.
    items = items.map((it) => (it.status === "running" ? { ...it, status: "queued" } : it));
    activeTaskId = null;
    const hasQueued = items.some((it) => it.status === "queued");
    if (hasQueued) status = "running";
    else if (items.length === 0) status = "idle";
    else if (items.every((it) => it.status === "done")) status = "completed";
    else status = "paused";
    break;
  }
  case "start-task": {
    const targetId = String(options.taskId || currentView.nextQueuedTask?.id || "");
    const now = new Date().toISOString();
    const sessionId = options.sessionId ? String(options.sessionId) : null;
    items = items.map((it) => {
      if (it.id === targetId) {
        activeTaskId = it.id;
        status = "running";
        if (isSafeStoryOverrideKey(it.overrideKey)) {
          storyOverrides[it.overrideKey] = {
            status: "in-progress",
            reason: `Currently active in BMAD Companion Task Queue (${it.title})`,
            updatedAt: now
          };
        }
        return { ...it, status: "running", startedAt: now, ...(sessionId ? { sessionId } : {}) };
      }
      if (it.status === "running") {
        return { ...it, status: "queued" };
      }
      return it;
    });
    break;
  }
  case "complete-task": {
    const targetId = String(options.taskId || activeTaskId || "");
    const outcomeStatus = options.failed ? "failed" : "done";
    const hasExplicitStoryStatus =
      options.storyStatus !== undefined &&
      options.storyStatus !== null &&
      String(options.storyStatus).trim() !== "";
    const requestedStoryStatus = hasExplicitStoryStatus ? String(options.storyStatus).trim() : null;
    if (requestedStoryStatus && !VALID_STORY_STATUSES.includes(requestedStoryStatus)) {
      throw new Error(
        `Invalid storyStatus '${requestedStoryStatus}'. Expected one of: ${VALID_STORY_STATUSES.join(", ")}.`
      );
    }
    const now = new Date().toISOString();
    let completedItem = null;
    items = items.map((it) => {
      if (it.id !== targetId) return it;
      completedItem = it;
      if (isSafeStoryOverrideKey(it.overrideKey)) {
        if (outcomeStatus === "done") {
          storyOverrides[it.overrideKey] = {
            status: requestedStoryStatus || "done",
            reason: options.summary || `Completed via BMAD Companion Task Queue (${it.title})`,
            updatedAt: now
          };
        } else {
          storyOverrides[it.overrideKey] = {
            status: requestedStoryStatus || "in-progress",
            reason: options.summary || `Failed verification in BMAD Companion Task Queue (${it.title})`,
            updatedAt: now
          };
        }
      }
      return {
        ...it,
        status: outcomeStatus,
        completedAt: now,
        resultSummary: options.summary || (outcomeStatus === "done" ? "Completed & verified" : "Failed verification")
      };
    });
    if (completedItem) {
      const hasQueued = items.some((it) => it.status === "queued");
      // Never promote the next task here: it becomes `running` only when its
      // session is launched via start-task. Keeping it `queued` makes the
      // ledger honest and lets the Stop-hook handoff or the panel resume it.
      activeTaskId = null;
      if (!hasQueued) {
        status = "completed";
        workflowCompletedAt = now;
        if (persisted.agentAdvisorOverride) {
          advisorOverrideUpdate = null;
        }
      } else {
        if (outcomeStatus === "failed") status = "paused";
        else if (status !== "paused") status = "running";
        if (
          outcomeStatus === "done" &&
          persisted.agentAdvisorOverride &&
          Array.isArray(persisted.agentAdvisorOverride.recommendations)
        ) {
          const pruned = persisted.agentAdvisorOverride.recommendations.filter(
            (r) => !recommendationMatchesCompletedItem(r, completedItem)
          );
          if (pruned.length !== persisted.agentAdvisorOverride.recommendations.length) {
            advisorOverrideUpdate = {
              ...persisted.agentAdvisorOverride,
              recommendations: pruned
            };
          }
        }
      }
    }
    break;
  }
  case "pause-queue": {
    status = "paused";
    items = items.map((it) => (it.status === "running" ? { ...it, status: "queued" } : it));
    activeTaskId = null;
    break;
  }
  default:
    // "get" only reads the queue and "generate-workflow" only regenerates
    // artifacts; neither mutates queue items here (see the regeneration block below).
    break;
  }

  const allStories = scan.epics.flatMap((e) => e.stories);
  const updatedQueueView = buildTaskQueueView(
    {
      status,
      executionMode,
      defaultReviewMode,
      activeTaskId,
      workflowPath: QUEUE_WORKFLOW_REL_PATH,
      updatedAt: new Date().toISOString(),
      items
    },
    allStories,
    scan.availableModels
  );

  let generatedWorkflow = null;
  if (updatedQueueView.items.length > 0 && WORKFLOW_REGENERATION_ACTIONS.includes(action)) {
    generatedWorkflow = generateQueueWorkflowFiles(workspaceRoot, updatedQueueView);
  }

  savePersistedState(workspaceRoot, {
    ...(advisorOverrideUpdate !== undefined ? { agentAdvisorOverride: advisorOverrideUpdate } : {}),
    ...(workflowCompletedAt ? { lastWorkflowCompletedAt: workflowCompletedAt } : {}),
    storyOverrides,
    taskQueue: {
      status: updatedQueueView.status,
      executionMode: updatedQueueView.executionMode,
      defaultReviewMode: updatedQueueView.defaultReviewMode,
      activeTaskId: updatedQueueView.activeTaskId,
      workflowPath: updatedQueueView.workflowPath,
      updatedAt: updatedQueueView.updatedAt,
      items: updatedQueueView.items
    }
  });

  const freshScan = scanBmadWorkspace(workspaceRoot);
  return {
    action,
    taskQueue: freshScan.taskQueue,
    generatedWorkflow,
    scan: freshScan
  };
}

export function runCommandAsync(command, args, { env = process.env, stdinText = null, timeoutMs = 8000 } = {}) {
  return new Promise((resolvePromise) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      env,
      windowsHide: true,
      stdio: [stdinText !== null ? "pipe" : "ignore", "pipe", "pipe"]
    });
    const destroyStreams = () => {
      try {
        child.stdin?.destroy();
      } catch {}
      try {
        child.stdout?.destroy();
      } catch {}
      try {
        child.stderr?.destroy();
      } catch {}
    };
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (settled) return;
            settled = true;
            destroyStreams();
            try {
              child.kill("SIGKILL");
            } catch {
              try {
                child.kill();
              } catch {}
            }
            const trimmedStderr = stderr.trim();
            resolvePromise({
              ok: false,
              code: null,
              timedOut: true,
              stdout,
              stderr: trimmedStderr ? `${trimmedStderr}\ntimeout` : "timeout"
            });
          }, timeoutMs)
        : null;

    child.stdin?.on("error", () => {});
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      destroyStreams();
      resolvePromise({ ok: false, code: null, timedOut: false, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolvePromise({ ok: code === 0, code, timedOut: false, stdout, stderr });
    });
    if (stdinText !== null && child.stdin) {
      try {
        child.stdin.write(stdinText, "utf8");
        child.stdin.end();
      } catch {}
    }
  });
}

// Shared failure-detail extraction for command results (stderr -> timeout -> exit code).
function commandFailureDetail(res) {
  return (res.stderr || "").trim() || (res.timedOut ? "timeout" : `exit_${res.code}`);
}

// Single launch-result shape; `error` is included only when truthy.
function launchOutcome({ copied, openedDirectly = false, pasted = false, method, error = "" }) {
  const outcome = {
    copied: Boolean(copied),
    openedDirectly: Boolean(openedDirectly),
    pasted: Boolean(pasted),
    method
  };
  if (error) outcome.error = error;
  return outcome;
}

export async function openNewConversationWithPrompt(promptText, openDirectly = true, deps = {}) {
  const text = String(promptText || "");
  if (!text.trim()) {
    return launchOutcome({ copied: false, method: "none", error: "empty_prompt" });
  }

  const platform = deps.platform || process.platform;
  const runCmd = deps.runCommand || runCommandAsync;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const baseEnv = deps.env || process.env;

  if (platform === "win32") {
    const psScript = [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$raw = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:BMAD_PROMPT_B64))",
      "[System.Windows.Forms.Clipboard]::SetDataObject($raw, $true, 5, 50)",
      "[Console]::Out.WriteLine('BMAD_CLIPBOARD_OK')",
      "[Console]::Out.Flush()",
      "if ($env:BMAD_OPEN_DIRECTLY -eq '1') {",
      "  try {",
      "    Start-Sleep -Milliseconds 75",
      "    [System.Windows.Forms.SendKeys]::SendWait('^n')",
      "    Start-Sleep -Milliseconds 500",
      "    [System.Windows.Forms.SendKeys]::SendWait('^v')",
      "  } catch {",
      "    [Console]::Error.WriteLine($_.Exception.Message)",
      "    exit 2",
      "  }",
      "}"
    ].join("; ");

    const res = await runCmd(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-Command", psScript],
      {
        env: {
          ...baseEnv,
          BMAD_PROMPT_B64: Buffer.from(text, "utf8").toString("base64"),
          BMAD_OPEN_DIRECTLY: openDirectly ? "1" : "0"
        },
        timeoutMs: 8000
      }
    );
    if (res.ok) {
      return launchOutcome({
        copied: true,
        openedDirectly: openDirectly,
        pasted: openDirectly,
        method: openDirectly ? "win32-sendkeys-ctrl-n-v" : "win32-clipboard"
      });
    }
    const copiedOk = typeof res.stdout === "string" && res.stdout.includes("BMAD_CLIPBOARD_OK");
    const errDetail = commandFailureDetail(res);
    if (copiedOk) {
      return launchOutcome({ copied: true, method: "win32-clipboard-only", error: errDetail });
    }
    return launchOutcome({ copied: false, method: "win32-failed", error: errDetail });
  }

  if (platform === "darwin") {
    const copyRes = await runCmd("pbcopy", [], { stdinText: text, timeoutMs: 3000 });
    if (!copyRes.ok) {
      return launchOutcome({
        copied: false,
        method: "darwin-pbcopy-failed",
        error: commandFailureDetail(copyRes)
      });
    }
    if (!openDirectly) {
      return launchOutcome({ copied: true, method: "darwin-clipboard" });
    }
    const osaRes = await runCmd(
      "osascript",
      [
        "-e", 'tell application "System Events" to keystroke "n" using command down',
        "-e", "delay 0.5",
        "-e", 'tell application "System Events" to keystroke "v" using command down'
      ],
      { timeoutMs: 6000 }
    );
    return launchOutcome({
      copied: true,
      openedDirectly: osaRes.ok,
      pasted: osaRes.ok,
      method: osaRes.ok ? "darwin-osascript-cmd-n-v" : "darwin-clipboard-only",
      error: osaRes.ok ? "" : commandFailureDetail(osaRes)
    });
  }

  // Linux best-effort clipboard + xdotool
  let copied = false;
  let lastClipError = "";
  for (const [cmd, args] of [
    ["wl-copy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["xsel", ["--clipboard", "--input"]]
  ]) {
    const r = await runCmd(cmd, args, { stdinText: text, timeoutMs: 2500 });
    if (r.ok) {
      copied = true;
      break;
    }
    lastClipError = commandFailureDetail(r);
  }
  if (!copied) {
    return launchOutcome({ copied: false, method: "linux-unsupported", error: lastClipError });
  }
  if (!openDirectly) {
    return launchOutcome({ copied: true, method: "linux-clipboard" });
  }
  const nRes = await runCmd("xdotool", ["key", "--clearmodifiers", "ctrl+n"], { timeoutMs: 2500 });
  if (!nRes.ok) {
    return launchOutcome({
      copied: true,
      method: "linux-clipboard-only",
      error: commandFailureDetail(nRes)
    });
  }
  await sleep(500);
  const vRes = await runCmd("xdotool", ["key", "--clearmodifiers", "ctrl+v"], { timeoutMs: 2500 });
  return launchOutcome({
    copied: true,
    openedDirectly: true,
    pasted: vRes.ok,
    method: vRes.ok ? "linux-xdotool-ctrl-n-v" : "linux-xdotool-ctrl-n-only",
    error: vRes.ok ? "" : commandFailureDetail(vRes)
  });
}

export async function prepareNewSession(workspaceRoot, args = {}, deps = {}) {
  const openDirectly = args.openDirectly !== false;
  const launchRecord = {
    prompt: String(args.prompt || ""),
    model: String(args.model || ""),
    skill: String(args.skill || ""),
    title: String(args.title || ""),
    requestedAt: new Date().toISOString()
  };
  savePersistedState(workspaceRoot, {
    lastLaunchedSession: launchRecord
  });
  const launchStatus = await openNewConversationWithPrompt(launchRecord.prompt, openDirectly, deps);
  return {
    ...launchRecord,
    ...launchStatus
  };
}

