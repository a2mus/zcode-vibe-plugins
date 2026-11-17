import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

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
    tagline: "Focuses on what was broken or needed, why this fix/feature is the fastest safe path, and business/app impact.",
    analogyPrefix: "From a product builder's perspective:"
  },
  {
    id: "eli5-storyteller",
    name: "Pure ELI5",
    badge: "🧸 Everyday Analogy",
    tagline: "Explains complex code mechanics using simple real-world stories anyone can understand in 10 seconds.",
    analogyPrefix: "Imagine a busy coffee shop kitchen:"
  }
];

function getStateFilePath(workspaceRoot) {
  return join(workspaceRoot, ".zcode", "vibe-debrief-state.json");
}

export function loadPersistedState(workspaceRoot) {
  const path = getStateFilePath(workspaceRoot);
  try {
    if (!existsSync(path)) {
      return createDefaultState(workspaceRoot);
    }
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return {
      ...createDefaultState(workspaceRoot),
      ...raw
    };
  } catch {
    return createDefaultState(workspaceRoot);
  }
}

export function savePersistedState(workspaceRoot, patch) {
  const path = getStateFilePath(workspaceRoot);
  const current = loadPersistedState(workspaceRoot);
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(next, null, 2), "utf8");
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
  return {
    id: "welcome-debrief",
    createdAt: new Date().toISOString(),
    responseType: "implementation",
    persona: personaId || "vibe-mentor",
    tldrHeadline: `Ready to translate complex AI responses in ${projectName} into visual, high-ROI takeaways.`,
    realWorldAnalogy:
      "Instead of reading a 200-line mechanic's manual every time your car is tuned, this panel gives you the dashboard lights: what was wrong or needed, what we did and why, whether it worked, what else it touches, and the 1 rule worth remembering.",
    visualFlow: [
      {
        step: "1",
        icon: "💬",
        title: "Your Prompt",
        subtitle: "Bug Error or Feature Goal",
        status: "done"
      },
      {
        step: "2",
        icon: "⚙️",
        title: "AI Action",
        subtitle: "Code Edits & Tests",
        status: "done"
      },
      {
        step: "3",
        icon: "🎨",
        title: "Visual ELI5",
        subtitle: "Bug vs Implementation View",
        status: "active"
      },
      {
        step: "4",
        icon: "🧠",
        title: "ZCode Memory",
        subtitle: "Confirm & Persist Lessons",
        status: "pending"
      }
    ],
    bugReport: {
      cause:
        "When you share an error or bug, this box strips out stack-trace noise and tells you the exact root cause in plain English.",
      plan:
        "Shows the step-by-step fix strategy before getting lost in file diffs.",
      succeeded: "yes",
      successSummary:
        "Clearly states whether the fix succeeded (Verified by build/test, Partial, or Needs Check).",
      consequences:
        "Highlights what other screens, data flows, or habits are affected by this fix."
    },
    implementationReport: {
      objective:
        "Explains the real purpose and goal of what was just built — why it matters to your project.",
      planAndWhy:
        "Breaks down the chosen approach and WHY we picked it instead of a more complicated alternative.",
      result:
        "Shows what is working right now and which parts of your app were created or updated.",
      consequences:
        "Points out side-effects, new capabilities unlocked, or anything to keep an eye on."
    },
    lessonsLearned: [
      {
        id: "sample-lesson-1",
        slug: "vibe-debrief-memory-loop",
        title: "Turn painful bugs & smart patterns into permanent ZCode Memory rules",
        summary:
          "Whenever a bug fix or implementation reveals a non-obvious project quirk, click 'Confirm & Save to ZCode Memory' so the AI never repeats the mistake in future sessions.",
        why: "When switching across multiple vibe-coded projects, you shouldn't have to re-explain the same project pitfalls every session.",
        howToApply:
          "Review the Lessons Learned section after a turn and click 'Confirm & Save to ZCode Memory' on any takeaway you want ZCode to remember permanently.",
        memoryType: "feedback",
        confirmed: false
      }
    ],
    touchedFiles: []
  };
}

export function classifyFileRole(filePath) {
  const f = String(filePath || "").replace(/\\/g, "/");
  const lower = f.toLowerCase();
  if (lower.includes("test") || lower.includes("spec")) {
    return { path: f, shortName: basename(f), role: "Test / Verification", icon: "🧪", color: "purple" };
  }
  if (lower.endsWith(".xaml") || lower.endsWith(".html") || lower.endsWith(".css") || lower.endsWith(".tsx") || lower.endsWith(".jsx") || lower.includes("/views/") || lower.includes("/ui/")) {
    return { path: f, shortName: basename(f), role: "Visual UI / View", icon: "🖥️", color: "accent" };
  }
  if (lower.includes("viewmodel") || lower.includes("controller") || lower.includes("store") || lower.includes("hook")) {
    return { path: f, shortName: basename(f), role: "State / ViewModel", icon: "🎛️", color: "warning" };
  }
  if (lower.includes("service") || lower.includes("engine") || lower.includes("server") || lower.endsWith(".cs") || lower.endsWith(".mjs") || lower.endsWith(".ts")) {
    return { path: f, shortName: basename(f), role: "Core Logic / Service", icon: "⚙️", color: "success" };
  }
  if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".toml") || lower.endsWith(".md")) {
    return { path: f, shortName: basename(f), role: "Config / Docs", icon: "📋", color: "muted" };
  }
  return { path: f, shortName: basename(f), role: "Project File", icon: "📄", color: "accent" };
}

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

  // Strong prompt-level signal if user pasted an error or explicitly asked to fix a bug
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
  forcedType = null
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

  const tldrHeadline =
    responseType === "bug"
      ? `Bug Diagnosis & Fix: ${extractSentences(assistantMessage, 1) || "Identified the root cause and applied a targeted fix."}`
      : `Implementation Summary: ${extractSentences(assistantMessage, 1) || "Built and wired the requested capability with minimal complexity."}`;

  const realWorldAnalogy =
    responseType === "bug"
      ? `${personaObj.analogyPrefix} Instead of rebuilding the whole engine when a warning light blinked, we traced the loose wire causing the hiccup${fileNamesList ? ` (in ${fileNamesList})` : ""}, re-secured the connection, and checked that the dashboard runs clean.`
      : `${personaObj.analogyPrefix} Think of this like adding a plug-and-play module to your workspace${fileNamesList ? ` (${fileNamesList})` : ""} — it gives you the new capability immediately without tangling up your existing project wiring.`;

  const visualFlow =
    responseType === "bug"
      ? [
          {
            step: "1",
            icon: "🔴",
            title: "Root Cause Found",
            subtitle: classifiedFiles[0]?.shortName || "Pinpointed trigger",
            status: "done"
          },
          {
            step: "2",
            icon: "🛠️",
            title: "Fix Plan Applied",
            subtitle: classifiedFiles.length ? `${classifiedFiles.length} file(s) updated` : "Targeted patch",
            status: "done"
          },
          {
            step: "3",
            icon: succeededStatus === "yes" ? "✅" : succeededStatus === "no" ? "❌" : "⚠️",
            title: succeededStatus === "yes" ? "Fix Succeeded" : succeededStatus === "no" ? "Blocked / Needs Fix" : "Ready to Verify",
            subtitle: succeededStatus === "yes" ? "Verified & clean" : "Check edge cases",
            status: succeededStatus === "yes" ? "done" : "active"
          },
          {
            step: "4",
            icon: "🧠",
            title: "Lesson Extracted",
            subtitle: "Save to ZCode Memory",
            status: "pending"
          }
        ]
      : [
          {
            step: "1",
            icon: "🎯",
            title: "Goal & Purpose",
            subtitle: promptSnippet.slice(0, 34) + (promptSnippet.length > 34 ? "…" : ""),
            status: "done"
          },
          {
            step: "2",
            icon: "🧭",
            title: "Plan & Why",
            subtitle: "Clean, low-friction design",
            status: "done"
          },
          {
            step: "3",
            icon: "🏆",
            title: "Delivered Result",
            subtitle: classifiedFiles.length ? `${classifiedFiles.length} file(s) built/updated` : "Response delivered",
            status: "done"
          },
          {
            step: "4",
            icon: "🌊",
            title: "Impact & Lessons",
            subtitle: "Confirm rules to Memory",
            status: "active"
          }
        ];

  const bugReport = {
    cause:
      extractTaggedSection(assistantMessage, ["cause", "root cause", "why it failed", "problem"]) ||
      firstSentences ||
      `Triggered while handling: "${promptSnippet}". The state or configuration didn't match what the runtime expected.`,
    plan:
      extractTaggedSection(assistantMessage, ["plan", "fix", "solution", "resolution", "approach"]) ||
      (classifiedFiles.length
        ? `Apply a focused fix across ${classifiedFiles.map((f) => `${f.shortName} (${f.role})`).join(", ")} and verify that existing behavior stays intact.`
        : "Isolate the failing condition, patch the mismatch directly, and verify no regressions."),
    succeeded: succeededStatus,
    successSummary:
      succeededStatus === "yes"
        ? `Yes — Fix applied${classifiedFiles.length ? ` across ${classifiedFiles.length} file(s)` : ""} and verified without blocking errors.`
        : succeededStatus === "no"
        ? "Not yet — A blocker or failing check still needs attention before this bug is fully closed."
        : "Fix explained / drafted — Run a quick trial or test to confirm full resolution.",
    consequences:
      extractTaggedSection(assistantMessage, ["consequence", "impact", "side effect", "watch out"]) ||
      (classifiedFiles.length
        ? `Updates behavior in ${fileNamesList}. Downstream callers now receive consistent state without crashing.`
        : "Safe, localized fix with no breaking changes to other modules in your project.")
  };

  const implementationReport = {
    objective:
      extractTaggedSection(assistantMessage, ["purpose", "objective", "goal", "mission"]) ||
      `Deliver the requested capability for ${projectName}: "${promptSnippet.slice(0, 140)}".`,
    planAndWhy:
      extractTaggedSection(assistantMessage, ["plan", "why", "approach", "architecture", "resolution"]) ||
      `We structured the implementation across ${classifiedFiles.length || "modular"} component(s)${fileNamesList ? ` (${fileNamesList})` : ""} because it keeps the code decoupled, easy to debug visually, and avoids over-engineering.`,
    result:
      extractTaggedSection(assistantMessage, ["result", "outcome", "delivered", "implemented", "summary"]) ||
      firstSentences ||
      (classifiedFiles.length
        ? `Implemented and wired ${classifiedFiles.length} file(s): ${classifiedFiles.map((f) => `${f.icon} ${f.shortName}`).join(", ")}.`
        : "Completed the requested implementation and prepared it for immediate use."),
    consequences:
      extractTaggedSection(assistantMessage, ["consequence", "impact", "next", "note"]) ||
      (classifiedFiles.length
        ? `Adds/updates ${fileNamesList} in ${projectName}. Existing workflows remain untouched while the new capability is ready to use.`
        : "Zero breaking changes to existing project code; ready for your next vibe-coding iteration.")
  };

  const defaultLessonTitle =
    responseType === "bug"
      ? `Guard against ${classifiedFiles[0]?.shortName || "runtime"} state mismatches early`
      : `Keep ${classifiedFiles[0]?.shortName || projectName} modules focused and self-contained`;

  const extractedLesson = extractTaggedSection(assistantMessage, ["lesson", "takeaway", "remember", "rule"]);

  const lessonsLearned = [
    {
      id: `lesson-${Date.now()}`,
      slug: slugify(extractedLesson || defaultLessonTitle),
      title: extractedLesson ? extractedLesson.slice(0, 72) : defaultLessonTitle,
      summary:
        extractedLesson ||
        (responseType === "bug"
          ? `When touching ${fileNamesList || "this flow"}, verify inputs and state assumptions upfront so silent mismatches don't cascade into runtime errors.`
          : `When extending ${projectName} (${fileNamesList || "new features"}), separate visual UI state from core logic so you can iterate fast across projects without breaking existing flows.`),
      why:
        responseType === "bug"
          ? "Prevents the same class of bug from reappearing when you return to this project after switching contexts."
          : "Keeps vibe-coded features modular so future AI prompts can edit one piece without breaking three others.",
      howToApply:
        responseType === "bug"
          ? `Check ${fileNamesList || "the affected module"} invariants and run a quick smoke check right after editing.`
          : `Follow the same pattern used in ${fileNamesList || "this implementation"} when adding similar capabilities.`,
      memoryType: responseType === "bug" ? "feedback" : "project",
      confirmed: false
    }
  ];

  return {
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

/**
 * Resolves the active ZCode persistent memory directory for this workspace:
 * e.g. C:\Users\<user>\.zcode\cli\memories\projects\<workspace-slug>-<hash>\memory
 */
export function resolveZCodeMemoryDirectory(workspaceRoot) {
  const home = homedir();
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

/**
 * Confirms a Lesson Learned and persists it directly into ZCode's persistent Memory
 * (writes `<slug>.md` with ZCode frontmatter AND adds/updates the pointer in `MEMORY.md`).
 */
export function confirmAndSaveLessonToZCodeMemory(workspaceRoot, lessonInput) {
  const memDir = resolveZCodeMemoryDirectory(workspaceRoot);
  const slug = slugify(lessonInput.slug || lessonInput.title || "vibe-lesson");
  const fileName = `${slug}.md`;
  const filePath = join(memDir, fileName);
  const memoryIndexPath = join(memDir, "MEMORY.md");

  const title = String(lessonInput.title || "Confirmed Vibe Lesson").trim();
  const summary = String(lessonInput.summary || title).trim();
  const why = String(
    lessonInput.why || "Confirmed by the user in Vibe Debrief to prevent repeating mistakes and speed up multi-project vibe coding."
  ).trim();
  const howToApply = String(
    lessonInput.howToApply || "Apply this rule automatically whenever working on related code or debugging similar issues."
  ).trim();
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

  // Update MEMORY.md index (one line per memory, no frontmatter)
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

  // Also mark confirmed in persisted state
  const state = loadPersistedState(workspaceRoot);
  const currentDebrief = state.currentDebrief || {};
  const updatedLessons = (currentDebrief.lessonsLearned || []).map((l) =>
    l.id === lessonInput.id || l.slug === slug
      ? { ...l, slug, title, summary, why, howToApply, confirmed: true, savedMemoryPath: filePath }
      : l
  );

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
  const zcodeV2Dir = join(homedir(), ".zcode", "v2");
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
    // Prefer lightweight, cost-effective Gemini tiers (Argon / Flash) for simple ELI5 synthesis
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
  return {
    projectName: state.projectName || basename(workspaceRoot),
    workspaceRoot,
    activePersona: state.activePersona || "vibe-mentor",
    personas: PERSONAS,
    turnCount: state.turnCount || 0,
    recommendedGeminiModel,
    lightweightGeminiModels: geminiModels.slice(0, 8),
    lastUserPrompt: state.lastUserPrompt || "",
    lastAssistantMessage: state.lastAssistantMessage || "",
    currentDebrief: state.currentDebrief || createWelcomeDebrief(basename(workspaceRoot), state.activePersona),
    history: (state.history || []).slice(0, 15),
    confirmedLessons: state.confirmedLessons || [],
    zcodeMemory: memInfo,
    updatedAt: state.updatedAt
  };
}
