import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { describe, it } from "node:test";
import { createContext, runInContext } from "node:vm";

import {
  applySte100Polish,
  assessWorkflowComplexity,
  buildDefaultDiagram,
  buildDefaultVerificationData,
  buildExplainerScenesIfComplex,
  buildFullPanelState,
  buildPlainTextScript,
  classifyFileRole,
  computeSte100Metrics,
  confirmAndSaveLessonToZCodeMemory,
  detectResponseType,
  discoverLightweightGeminiModels,
  ensureDebriefEnriched,
  generateStandaloneHtmlArtifact,
  loadPersistedState,
  normalizeChoices,
  normalizeConcepts,
  normalizeHeuristicConfidence,
  normalizeMicroBlocks,
  normalizeVerdict,
  normalizeWaitingOnYou,
  normalizeXray,
  savePersistedState,
  saveStandaloneHtmlArtifact,
  synthesizeHeuristicDebrief
} from "../scripts/debrief-engine.mjs";
import {
  ENGINE_PATH,
  REPO_ROOT,
  buildPanelStateFixture,
  contrastRatio,
  createTempFixture,
  createTempHome,
  createTempWorkspace,
  extractInlineScript,
  extractStyleContent,
  memoryDirectoryFor,
  parseCssBlockVars,
  readJsonFile,
  resolveCssAliases,
  withEnv,
  withZCodeHomeDir,
  workspaceSlug
} from "./helpers.mjs";

// ============================================================================
// R1: STE-80 polish and metrics
// ============================================================================

describe("STE-80 readability engine", () => {
  it("replaces jargon with short plain verbs", () => {
    const polished = applySte100Polish(
      "  we utilize this to commence the migration in order to facilitate speed.  "
    );
    assert.equal(polished, "We use this to start the migration to help speed.");
  });

  it("collapses extra spaces and capitalizes the first letter", () => {
    assert.equal(applySte100Polish("  basically,   the   server   starts.  "), "The server starts.");
  });

  it("returns an empty string for empty and non-text input", () => {
    assert.equal(applySte100Polish(""), "");
    assert.equal(applySte100Polish("   "), "");
    assert.equal(applySte100Polish(null), "");
    assert.equal(applySte100Polish(undefined), "");
  });

  it("keeps file names and technical tokens intact", () => {
    assert.equal(
      applySte100Polish("the `auth-service.mjs` module failed."),
      "The `auth-service.mjs` module failed."
    );
  });

  it("returns safe defaults when no debrief is supplied", () => {
    assert.deepEqual(computeSte100Metrics(null), {
      score: 85,
      avgSentenceWords: 12,
      longSentenceCount: 0,
      totalWords: 20,
      estimatedReadSeconds: 15,
      grade: "STE-80"
    });
  });

  it("scores short active prose as STE-80", () => {
    const metrics = computeSte100Metrics({
      responseType: "implementation",
      tldrHeadline: "We add one panel view.",
      realWorldAnalogy: "Think of a clear dashboard.",
      implementationReport: {
        objective: "Add one panel view.",
        planAndWhy: "Keep it simple.",
        result: "The view works.",
        consequences: "No breaking change."
      }
    });

    assert.ok(metrics.score >= 80);
    assert.equal(metrics.grade, "STE-80");
    assert.equal(metrics.longSentenceCount, 0);
    assert.ok(metrics.avgSentenceWords <= 20);
    assert.ok(metrics.totalWords > 0);
    assert.ok(metrics.estimatedReadSeconds >= 15);
  });

  it("scores long jargon-heavy prose as Dense", () => {
    const denseSentence =
      "We utilize commence terminate facilitate leverage subsequently additionally furthermore moreover the migration configuration to orchestrate the end to end state machine pipeline with extra words that make this sentence very long indeed and keep going until it is definitely over the limit for readability and clarity in every possible way for all readers.";
    const metrics = computeSte100Metrics({
      responseType: "bug",
      tldrHeadline: denseSentence,
      realWorldAnalogy: denseSentence,
      bugReport: {
        cause: denseSentence,
        plan: denseSentence,
        successSummary: denseSentence,
        consequences: denseSentence
      }
    });

    assert.ok(metrics.score < 65);
    assert.equal(metrics.grade, "Dense");
    assert.ok(metrics.longSentenceCount >= 1);
    assert.ok(metrics.estimatedReadSeconds > 15);
  });

  it("reads bugReport text for bug turns and implementationReport text otherwise", () => {
    const jargon = "We utilize commence terminate facilitate leverage subsequently additionally furthermore moreover.";
    const base = { tldrHeadline: "Fix one bug.", realWorldAnalogy: "Picture a wire." };
    const bugMetrics = computeSte100Metrics({
      ...base,
      responseType: "bug",
      bugReport: { cause: jargon, plan: jargon, successSummary: jargon, consequences: jargon }
    });
    const implementationMetrics = computeSte100Metrics({
      ...base,
      responseType: "implementation",
      implementationReport: {
        objective: "We add one view.",
        planAndWhy: "We use one file.",
        result: "It works well.",
        consequences: "No impact here."
      }
    });

    assert.ok(bugMetrics.totalWords > 0);
    assert.ok(implementationMetrics.totalWords > 0);
    assert.ok(bugMetrics.score < implementationMetrics.score);
  });
});

// ============================================================================
// R1: File-role and risk classification
// ============================================================================

describe("classifyFileRole", () => {
  const cases = [
    ["src/panel.test.mjs", "Test / Verification", "low"],
    ["test/debrief-engine.test.mjs", "Test / Verification", "low"],
    ["assets/panel.html", "Visual UI / View", "medium"],
    ["src/view.tsx", "Visual UI / View", "medium"],
    ["src/widget.jsx", "Visual UI / View", "medium"],
    ["scripts/mcp-server.mjs", "Core Logic / Service", "high"],
    ["src/auth-service.mjs", "Core Logic / Service", "high"],
    ["src/state-store.mjs", "State / ViewModel", "medium"],
    ["src/engine.mjs", "Core Logic / Service", "medium"],
    ["config/settings.json", "Config / Docs", "low"],
    ["docs/README.md", "Config / Docs", "low"],
    ["assets/logo.svg", "Project File", "low"]
  ];

  for (const [filePath, expectedRole, expectedRisk] of cases) {
    it(`classifies ${filePath} as ${expectedRole}`, () => {
      const classified = classifyFileRole(filePath);
      assert.equal(classified.path, filePath);
      assert.equal(classified.role, expectedRole);
      assert.equal(classified.risk, expectedRisk);
      assert.ok(classified.shortName.length > 0);
      assert.ok(classified.icon.length > 0);
      assert.ok(classified.color.length > 0);
      assert.ok(classified.intent.length > 0);
    });
  }

  it("normalizes Windows separators before classifying", () => {
    const classified = classifyFileRole("C:\\repo\\src\\auth-service.mjs");
    assert.equal(classified.path, "C:/repo/src/auth-service.mjs");
    assert.equal(classified.shortName, "auth-service.mjs");
    assert.equal(classified.role, "Core Logic / Service");
    assert.equal(classified.risk, "high");
  });
});

// ============================================================================
// R1: Complexity gate
// ============================================================================

describe("assessWorkflowComplexity", () => {
  it("treats an empty turn as simple", () => {
    assert.deepEqual(assessWorkflowComplexity({}), {
      level: "simple",
      score: 0,
      reason: "Single-concept turn"
    });
  });

  it("keeps a focused change simple", () => {
    const complexity = assessWorkflowComplexity({
      touchedFiles: ["src/a.mjs", "src/b.mjs"]
    });
    assert.equal(complexity.level, "simple");
    assert.equal(complexity.score, 0);
    assert.equal(complexity.reason, "Focused 2-file change");
  });

  it("marks five files across five layers with a critical path as complex", () => {
    const complexity = assessWorkflowComplexity({
      touchedFiles: [
        "src/panel.html",
        "src/auth-server.mjs",
        "src/store.mjs",
        "test/panel.test.mjs",
        "config/app.json"
      ]
    });
    assert.equal(complexity.level, "complex");
    assert.equal(complexity.score, 7);
    assert.match(complexity.reason, /5 files changed/);
    assert.match(complexity.reason, /5 architectural layers/);
  });

  it("marks branching diagrams as complex", () => {
    const complexity = assessWorkflowComplexity({
      touchedFiles: ["src/a.html", "src/b.mjs"],
      diagram: {
        nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
        edges: [
          { from: "a", to: "b" },
          { from: "a", to: "c" },
          { from: "b", to: "c" }
        ]
      }
    });
    assert.equal(complexity.level, "complex");
    assert.equal(complexity.score, 4);
    assert.match(complexity.reason, /multi-branch data flow/);
  });

  it("keeps a single critical-path file simple but flags the risk", () => {
    const complexity = assessWorkflowComplexity({
      touchedFiles: ["src/auth-server.mjs"]
    });
    assert.equal(complexity.level, "simple");
    assert.equal(complexity.score, 1);
    assert.equal(complexity.reason, "critical-path file touched");
  });

  it("adds one point for architecture language without crossing the gate", () => {
    const complexity = assessWorkflowComplexity({
      touchedFiles: ["src/a.mjs", "src/b.mjs", "src/c.mjs"],
      userPrompt: "architecture"
    });
    assert.equal(complexity.level, "simple");
    assert.equal(complexity.score, 3);
    assert.equal(complexity.reason, "3 files changed");
  });

  it("adds one point for very long assistant context", () => {
    const complexity = assessWorkflowComplexity({
      assistantMessage: "x".repeat(2300)
    });
    assert.equal(complexity.level, "simple");
    assert.equal(complexity.score, 1);
    assert.equal(complexity.reason, "multi-step architecture");
  });

  it("honors an explicit complex or simple override", () => {
    assert.deepEqual(assessWorkflowComplexity({ complexityOverride: "complex" }), {
      level: "complex",
      score: 6,
      reason: "Marked complex for animated walkthrough"
    });
    assert.deepEqual(assessWorkflowComplexity({ complexityOverride: "simple" }), {
      level: "simple",
      score: 1,
      reason: "Marked simple"
    });
  });

  it("accepts already-classified file objects", () => {
    const complexity = assessWorkflowComplexity({
      touchedFiles: [classifyFileRole("src/auth-server.mjs")]
    });
    assert.equal(complexity.level, "simple");
    assert.equal(complexity.score, 1);
    assert.equal(complexity.reason, "critical-path file touched");
  });
});

// ============================================================================
// R1: Always-on diagram synthesis
// ============================================================================

describe("buildDefaultDiagram", () => {
  it("caps explicit diagrams at six nodes and sanitizes risk/status", () => {
    const explicitNodes = Array.from({ length: 8 }, (_, index) => ({
      id: `n${index + 1}`,
      label: `Node ${index + 1} ${"x".repeat(40)}`,
      risk: index === 0 ? "bogus" : "high",
      status: index === 0 ? "bogus" : "active"
    }));
    const diagram = buildDefaultDiagram(
      { responseType: "bug" },
      { nodes: explicitNodes, edges: [] }
    );

    assert.equal(diagram.nodes.length, 6);
    assert.equal(diagram.nodes[0].risk, "low");
    assert.equal(diagram.nodes[0].status, "done");
    assert.equal(diagram.nodes[1].risk, "high");
    assert.equal(diagram.nodes[1].status, "active");
    assert.equal(diagram.nodes[0].label.length, 32);
    assert.equal(diagram.diagramType, "cause-effect");

    assert.equal(diagram.edges.length, 5);
    assert.deepEqual(
      diagram.edges.map((edge) => edge.stepNumber),
      [1, 2, 3, 4, 5]
    );
    for (const edge of diagram.edges) {
      assert.ok(diagram.nodes.some((node) => node.id === edge.from));
      assert.ok(diagram.nodes.some((node) => node.id === edge.to));
    }
  });

  it("drops explicit edges that point at removed nodes", () => {
    const diagram = buildDefaultDiagram(
      { responseType: "implementation" },
      {
        nodes: [{ id: "a" }, { id: "b" }],
        edges: [
          { from: "a", to: "b" },
          { from: "a", to: "missing" },
          { from: "missing", to: "b" }
        ]
      }
    );

    assert.equal(diagram.edges.length, 1);
    assert.equal(diagram.edges[0].from, "a");
    assert.equal(diagram.edges[0].to, "b");
  });

  it("synthesizes nodes from touched files with sequential edges", () => {
    const touchedFiles = [
      "src/panel.test.mjs",
      "scripts/mcp-server.mjs",
      "src/store.mjs",
      "config/app.json",
      "src/engine.mjs"
    ].map(classifyFileRole);
    const diagram = buildDefaultDiagram({
      responseType: "implementation",
      touchedFiles
    });

    assert.equal(diagram.diagramType, "architecture");
    assert.equal(diagram.nodes.length, 5);
    assert.equal(diagram.nodes[0].id, "n-trigger");
    assert.equal(diagram.nodes[0].label, "User Goal");
    assert.deepEqual(
      diagram.nodes.slice(1).map((node) => node.label),
      ["panel.test.mjs", "mcp-server.mjs", "store.mjs", "app.json"]
    );
    assert.deepEqual(
      diagram.nodes.slice(1).map((node) => node.file),
      ["src/panel.test.mjs", "scripts/mcp-server.mjs", "src/store.mjs", "config/app.json"]
    );
    assert.equal(diagram.nodes.at(-1).status, "active");

    assert.equal(diagram.edges.length, 4);
    assert.deepEqual(
      diagram.edges.map((edge) => edge.stepNumber),
      [1, 2, 3, 4]
    );
    assert.equal(diagram.edges[0].label, "Updates");
    assert.equal(diagram.edges.at(-1).label, "Produces");
  });

  it("appends a blocked outcome node for bug turns without tests", () => {
    const touchedFiles = ["src/auth-server.mjs", "src/store.mjs"].map(classifyFileRole);
    const diagram = buildDefaultDiagram({
      responseType: "bug",
      bugReport: { succeeded: "no" },
      touchedFiles
    });

    assert.equal(diagram.diagramType, "cause-effect");
    assert.equal(diagram.nodes.length, 4);
    const outcome = diagram.nodes.at(-1);
    assert.equal(outcome.label, "Blocked");
    assert.equal(outcome.risk, "high");
    assert.equal(outcome.status, "warning");
  });

  it("caps visualFlow fallbacks at five nodes with sequential edges", () => {
    const visualFlow = Array.from({ length: 6 }, (_, index) => ({
      step: String(index + 1),
      title: `Step ${index + 1}`,
      subtitle: `Detail ${index + 1}`,
      status: index === 0 ? "warning" : "done"
    }));
    const diagram = buildDefaultDiagram({ responseType: "bug", visualFlow });

    assert.equal(diagram.nodes.length, 5);
    assert.equal(diagram.nodes[0].risk, "high");
    assert.equal(diagram.edges.length, 4);
    assert.equal(diagram.title, "Cause-to-Fix Flow Diagram");
  });

  it("always produces a diagram for a missing debrief", () => {
    const diagram = buildDefaultDiagram(null);

    assert.equal(diagram.diagramType, "state-flow");
    assert.equal(diagram.title, "Implementation Flow Diagram");
    assert.equal(diagram.nodes.length, 4);
    assert.equal(diagram.edges.length, 3);
  });

  it("uses the single touched file name in fallback diagrams", () => {
    const diagram = buildDefaultDiagram({
      responseType: "implementation",
      touchedFiles: [classifyFileRole("scripts/debrief-engine.mjs")]
    });

    assert.equal(diagram.nodes[1].label, "debrief-engine.mjs");
    assert.equal(diagram.nodes[1].file, "scripts/debrief-engine.mjs");
  });
});

// ============================================================================
// R1: Verification defaults, proof claims and uncertainty audit
// ============================================================================

describe("buildDefaultVerificationData", () => {
  it("marks a clean command as verified evidence", () => {
    const verification = buildDefaultVerificationData(
      { responseType: "implementation" },
      ["src/a.mjs"],
      true
    );

    assert.equal(verification.proofClaims[0].claim, "Latest shell command completed cleanly");
    assert.equal(verification.proofClaims[0].status, "verified");
    assert.equal(verification.proofClaims[1].claim, "Updated 1 workspace file(s)");
    assert.ok(verification.verificationChecklist.every((item) => item.id !== "chk-run-smoke"));
    assert.equal(verification.uncertaintyAudit[0].area, "Edge-case inputs");
  });

  it("keeps a failed bug turn unverified with high-risk audit entries", () => {
    const verification = buildDefaultVerificationData(
      { responseType: "bug" },
      ["src/auth-server.mjs"],
      false
    );

    assert.equal(verification.proofClaims[0].status, "unverified");
    assert.equal(verification.uncertaintyAudit[0].riskLevel, "high");
    assert.ok(
      verification.uncertaintyAudit.some((item) => item.area.includes("Critical-path file"))
    );
    assert.ok(
      verification.verificationChecklist.some(
        (item) => item.id === "chk-run-smoke" && item.risk === "high"
      )
    );
  });

  it("marks no-file turns as inferred and asks for a manual check", () => {
    const verification = buildDefaultVerificationData(
      { responseType: "implementation" },
      [],
      null
    );

    assert.equal(verification.proofClaims[0].status, "inferred");
    assert.equal(verification.uncertaintyAudit[0].riskLevel, "medium");
    assert.ok(verification.verificationChecklist.some((item) => item.id === "chk-confirm-claim"));
  });

  it("cites test coverage and drops the cross-file warning", () => {
    const verification = buildDefaultVerificationData(
      { responseType: "implementation" },
      ["src/panel.test.mjs", "src/store.mjs"],
      true
    );

    assert.ok(
      verification.proofClaims.some((claim) => claim.claim.includes("Test/spec coverage"))
    );
    assert.ok(
      !verification.uncertaintyAudit.some((item) => item.area === "Cross-file integration")
    );
  });

  it("caps every list at three entries", () => {
    const touchedFiles = Array.from(
      { length: 6 },
      (_, index) => `src/auth-server-${index}.mjs`
    );
    const verification = buildDefaultVerificationData(
      { responseType: "bug" },
      touchedFiles,
      false
    );

    assert.ok(verification.proofClaims.length <= 3);
    assert.ok(verification.uncertaintyAudit.length <= 3);
    assert.ok(verification.verificationChecklist.length <= 3);
  });
});

// ============================================================================
// R1: Complex-only explainer scenes and plain-text script
// ============================================================================

describe("explainer scene gate", () => {
  const bugDebrief = {
    responseType: "bug",
    tldrHeadline: "We utilize a cache.",
    realWorldAnalogy: "Think of a fridge.",
    bugReport: {
      cause: "The token was undefined.",
      plan: "Patch the token.",
      successSummary: "The fix holds.",
      consequences: "No side effects."
    },
    uncertaintyAudit: [{ area: "Edge cases", reason: "Check empty input." }],
    visualFlow: [
      { step: "1", title: "Root Cause", status: "done" },
      { step: "2", title: "Fix", status: "done" },
      { step: "3", title: "Verify", status: "done" },
      { step: "4", title: "Save", status: "active" }
    ]
  };

  it("returns no scenes for simple turns", () => {
    assert.deepEqual(buildExplainerScenesIfComplex(bugDebrief, { level: "simple" }), []);
  });

  it("returns no scenes when complexity is missing", () => {
    assert.deepEqual(buildExplainerScenesIfComplex(bugDebrief, null), []);
  });

  it("returns four scenes for complex turns", () => {
    const scenes = buildExplainerScenesIfComplex(bugDebrief, { level: "complex" });

    assert.equal(scenes.length, 4);
    assert.deepEqual(
      scenes.map((scene) => scene.id),
      ["scene-1", "scene-2", "scene-3", "scene-4"]
    );
    assert.deepEqual(
      scenes.map((scene) => scene.durationSec),
      [7, 8, 7, 7]
    );
    assert.deepEqual(
      scenes.map((scene) => scene.visualType),
      ["highlight-start", "pulse-flow", "highlight-end", "audit-warning"]
    );
    assert.equal(scenes[0].callout, "We use a cache.");
    assert.equal(scenes[0].title, "1. The Trigger & Root Cause");
    assert.equal(scenes[2].callout, "Status: YES");
    assert.equal(scenes[3].callout, "Edge cases");
    assert.equal(scenes[0].highlightNodeIds.length, 1);
    assert.ok(scenes[3].highlightNodeIds.length > 1);
    assert.match(scenes[3].narration, /Check empty input/);
  });

  it("forces scenes when the caller explicitly asks", () => {
    const scenes = buildExplainerScenesIfComplex(bugDebrief, { level: "simple" }, true);
    assert.equal(scenes.length, 4);
  });

  it("builds a readable plain-text script", () => {
    const scenes = buildExplainerScenesIfComplex(bugDebrief, { level: "complex" });
    const script = buildPlainTextScript(scenes);

    assert.match(script, /\[Scene 1 · 7s\] 1\. The Trigger & Root Cause/);
    assert.match(script, /\[Scene 2 · 8s\] 2\. The Fix Strategy/);
    assert.match(script, /The token was undefined\./);
    assert.match(script, /No side effects\. Watch out for: Check empty input\./);
    assert.equal(buildPlainTextScript([]), "");
    assert.equal(buildPlainTextScript(null), "");
  });
});

// ============================================================================
// R1: Response-type detection
// ============================================================================

describe("detectResponseType", () => {
  it("detects bug turns from error language", () => {
    assert.equal(detectResponseType("Fix the TypeError crash in auth", ""), "bug");
    assert.equal(detectResponseType("why is it broken", ""), "bug");
    assert.equal(
      detectResponseType("", "This failed with a TypeError exception and a stack trace."),
      "bug"
    );
  });

  it("detects implementation turns from build language", () => {
    assert.equal(detectResponseType("Implement a new panel feature", ""), "implementation");
    assert.equal(detectResponseType("", ""), "implementation");
    assert.equal(
      detectResponseType("Create a bug tracker panel feature", "Done"),
      "implementation"
    );
  });
});

// ============================================================================
// R1: Heuristic debrief synthesis
// ============================================================================

describe("synthesizeHeuristicDebrief", () => {
  it("builds a complete simple bug debrief", () => {
    const debrief = synthesizeHeuristicDebrief({
      workspaceRoot: "D:/tmp/demo-app",
      userPrompt: "Fix the TypeError crash",
      assistantMessage:
        "Root cause: the token was undefined. We patched scripts/auth-service.mjs and verified the fix.",
      touchedFiles: ["scripts/auth-service.mjs"],
      lastCommandExitZero: true
    });

    assert.equal(debrief.responseType, "bug");
    assert.equal(debrief.touchedFiles.length, 1);
    assert.equal(debrief.touchedFiles[0].role, "Core Logic / Service");
    assert.equal(debrief.touchedFiles[0].risk, "high");
    assert.equal(debrief.bugReport.succeeded, "yes");
    assert.ok(debrief.bugReport.cause.length > 0);
    assert.equal(debrief.visualFlow.length, 4);
    assert.equal(debrief.diagram.nodes.length, 4);
    assert.equal(debrief.diagram.edges.length, debrief.diagram.nodes.length - 1);
    assert.equal(debrief.complexity.level, "simple");
    assert.deepEqual(debrief.explainerScenes, []);
    assert.equal(debrief.ste100Metrics.grade, "STE-80");
    assert.ok(debrief.proofClaims.some((claim) => claim.claim.includes("completed cleanly")));
    assert.equal(debrief.lessonsLearned.length, 1);
    assert.equal(debrief.lessonsLearned[0].memoryType, "feedback");
    assert.equal(debrief.lessonsLearned[0].confirmed, false);
  });

  it("builds a complex implementation debrief with explainer scenes", () => {
    const debrief = synthesizeHeuristicDebrief({
      workspaceRoot: "D:/tmp/demo-app",
      userPrompt: "Add a new panel feature",
      assistantMessage: "We implemented the panel feature and the build succeeded.",
      touchedFiles: [
        "assets/panel.html",
        "scripts/debrief-engine.mjs",
        "tests/debrief-engine.test.mjs"
      ],
      lastCommandExitZero: true
    });

    assert.equal(debrief.responseType, "implementation");
    assert.equal(debrief.complexity.level, "complex");
    assert.equal(debrief.explainerScenes.length, 4);
    assert.equal(debrief.lessonsLearned[0].memoryType, "project");
    assert.equal(debrief.visualFlow.length, 4);
    assert.equal(debrief.diagram.nodes.length, 4);
    assert.equal(debrief.diagram.edges.length, 3);
  });

  it("honors a forced response type", () => {
    const debrief = synthesizeHeuristicDebrief({
      workspaceRoot: "D:/tmp/demo-app",
      userPrompt: "Fix the crash",
      assistantMessage: "We fixed the crash.",
      forcedType: "implementation"
    });

    assert.equal(debrief.responseType, "implementation");
    assert.ok(debrief.implementationReport.objective.length > 0);
  });

  it("keeps jargon when STE-80 polish is disabled", () => {
    const raw = synthesizeHeuristicDebrief({
      workspaceRoot: "D:/tmp/demo-app",
      userPrompt: "Implement a feature",
      assistantMessage: "We utilize the cache layer for speed.",
      forcedType: "implementation",
      ste100Enabled: false
    });
    const polished = synthesizeHeuristicDebrief({
      workspaceRoot: "D:/tmp/demo-app",
      userPrompt: "Implement a feature",
      assistantMessage: "We utilize the cache layer for speed.",
      forcedType: "implementation",
      ste100Enabled: true
    });

    assert.match(raw.tldrHeadline, /utilize/);
    assert.match(polished.tldrHeadline, /use the cache/);
  });

  it("marks a failed turn as not succeeded", () => {
    const debrief = synthesizeHeuristicDebrief({
      workspaceRoot: "D:/tmp/demo-app",
      userPrompt: "Fix the crash",
      assistantMessage: "The build failed and we could not load the module.",
      forcedType: "bug"
    });

    assert.equal(debrief.bugReport.succeeded, "no");
  });
});

// ============================================================================
// R2: Workspace state persistence, seeding and collection bounds
// ============================================================================

describe("workspace state persistence", () => {
  it("seeds a welcome debrief when no state file exists", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-state-" });

    try {
      const state = loadPersistedState(workspace.root);

      assert.equal(state.projectName, basename(workspace.root));
      assert.equal(state.workspaceRoot, workspace.root);
      assert.equal(state.activePersona, "vibe-mentor");
      assert.equal(state.ste100Enabled, true);
      assert.equal(state.turnCount, 0);
      assert.deepEqual(state.history, []);
      assert.deepEqual(state.recentTouchedFiles, []);
      assert.deepEqual(state.confirmedLessons, []);
      assert.equal(state.currentDebrief.id, "welcome-debrief");
      assert.ok(state.currentDebrief.diagram.nodes.length > 0);
      assert.ok(state.currentDebrief.diagram.edges.length > 0);
      assert.equal(workspace.exists(".zcode/vibe-debrief-state.json"), false);
    } finally {
      workspace.cleanup();
    }
  });

  it("seeds a welcome debrief when the state file is corrupt", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-state-" });

    try {
      workspace.write(".zcode/vibe-debrief-state.json", "{ this is not json");
      const state = loadPersistedState(workspace.root);

      assert.equal(state.currentDebrief.id, "welcome-debrief");
      assert.equal(state.projectName, basename(workspace.root));
      assert.deepEqual(state.history, []);
    } finally {
      workspace.cleanup();
    }
  });

  it("merges partial state over defaults and enriches the debrief", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-state-" });

    try {
      workspace.write(
        ".zcode/vibe-debrief-state.json",
        JSON.stringify({
          activePersona: "indie-founder",
          turnCount: 4,
          currentDebrief: {
            responseType: "bug",
            tldrHeadline: "Fix the crash.",
            realWorldAnalogy: "Think of a loose wire."
          }
        })
      );

      const state = loadPersistedState(workspace.root);

      assert.equal(state.activePersona, "indie-founder");
      assert.equal(state.turnCount, 4);
      assert.equal(state.projectName, basename(workspace.root));
      assert.equal(state.currentDebrief.responseType, "bug");
      assert.ok(state.currentDebrief.diagram.nodes.length > 0);
      assert.ok(state.currentDebrief.proofClaims.length > 0);
      assert.ok(state.currentDebrief.verificationChecklist.length > 0);
      assert.ok(state.currentDebrief.ste100Metrics.score > 0);
    } finally {
      workspace.cleanup();
    }
  });

  it("saves a merged patch with a fresh updatedAt timestamp", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-state-" });

    try {
      const saved = savePersistedState(workspace.root, {
        turnCount: 2,
        lastUserPrompt: "Ship the panel"
      });

      assert.equal(saved.turnCount, 2);
      assert.equal(saved.lastUserPrompt, "Ship the panel");
      assert.equal(saved.currentDebrief.id, "welcome-debrief");
      assert.match(saved.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const onDisk = readJsonFile(workspace.statePath);
      assert.deepEqual(onDisk, saved);
      assert.equal(loadPersistedState(workspace.root).turnCount, 2);
    } finally {
      workspace.cleanup();
    }
  });

  it("bounds persisted history, recent files and lessons to 15/15/50", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-state-" });

    try {
      const history = Array.from({ length: 20 }, (_, index) => ({ id: `h-${index}` }));
      const recentTouchedFiles = Array.from(
        { length: 20 },
        (_, index) => `src/f-${index}.mjs`
      );
      const confirmedLessons = Array.from({ length: 60 }, (_, index) => ({
        slug: `lesson-${index}`
      }));

      savePersistedState(workspace.root, { history, recentTouchedFiles, confirmedLessons });
      const onDisk = readJsonFile(workspace.statePath);

      assert.equal(onDisk.history.length, 15);
      assert.deepEqual(
        onDisk.history.map((entry) => entry.id),
        history.slice(0, 15).map((entry) => entry.id)
      );
      assert.equal(onDisk.recentTouchedFiles.length, 15);
      assert.deepEqual(onDisk.recentTouchedFiles, recentTouchedFiles.slice(-15));
      assert.equal(onDisk.confirmedLessons.length, 50);
      assert.equal(onDisk.confirmedLessons[0].slug, "lesson-0");
      assert.equal(onDisk.confirmedLessons.at(-1).slug, "lesson-49");
    } finally {
      workspace.cleanup();
    }
  });

  it("clamps oversized and non-array collections when loading corrupt state", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-state-" });

    try {
      workspace.write(
        ".zcode/vibe-debrief-state.json",
        JSON.stringify({
          history: Array.from({ length: 30 }, (_, index) => ({ id: `h-${index}` })),
          recentTouchedFiles: Array.from({ length: 30 }, (_, index) => `f-${index}.mjs`),
          confirmedLessons: Array.from({ length: 80 }, (_, index) => ({
            slug: `lesson-${index}`
          }))
        })
      );

      let state = loadPersistedState(workspace.root);
      assert.equal(state.history.length, 15);
      assert.equal(state.recentTouchedFiles.length, 15);
      assert.equal(state.recentTouchedFiles[0], "f-15.mjs");
      assert.equal(state.confirmedLessons.length, 50);

      workspace.write(
        ".zcode/vibe-debrief-state.json",
        JSON.stringify({
          history: "not-an-array",
          recentTouchedFiles: { bogus: true },
          confirmedLessons: null
        })
      );

      state = loadPersistedState(workspace.root);
      assert.deepEqual(state.history, []);
      assert.deepEqual(state.recentTouchedFiles, []);
      assert.deepEqual(state.confirmedLessons, []);
    } finally {
      workspace.cleanup();
    }
  });
});

// ============================================================================
// R2: Standalone HTML export escaping and output routing
// ============================================================================

const HOSTILE_TAG = '<img src=x onerror="alert(1)">';
const HOSTILE_NODE_TAG = "<img src=x>";

function parseArtifactPalettes(artifactHtml) {
  const styleText = extractStyleContent(artifactHtml);
  // Merge RAW tables before resolving so var() aliases re-evaluate per palette.
  const darkRaw = parseCssBlockVars(styleText, /:root\s*\{([\s\S]*?)\}/);
  const lightRaw = parseCssBlockVars(
    styleText,
    /@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*\{([\s\S]*?)\}/
  );
  return {
    dark: resolveCssAliases(darkRaw),
    light: resolveCssAliases({ ...darkRaw, ...lightRaw })
  };
}

function renderArtifactScript(artifactHtml, { theme = "dark", emptyComputedStyles = false } = {}) {
  const scriptSource = extractInlineScript(artifactHtml);
  const { dark, light } = parseArtifactPalettes(artifactHtml);
  let currentTable = theme === "light" ? light : dark;

  const elements = new Map();
  const canvasOps = [];
  const recordingCtx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      canvasOps.push({ op: "stroke", style: this.strokeStyle });
    },
    fill() {
      canvasOps.push({ op: "fill", style: this.fillStyle });
    },
    arc() {},
    rect() {},
    roundRect() {},
    fillText(text) {
      canvasOps.push({ op: "fillText", style: this.fillStyle, text: String(text) });
    },
    fillRect() {
      canvasOps.push({ op: "fillRect", style: this.fillStyle });
    }
  };
  let activeEl = null;
  const makeClassList = () => {
    const set = new Set();
    return {
      add: (...cls) => cls.forEach((c) => set.add(c)),
      remove: (...cls) => cls.forEach((c) => set.delete(c)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (set.has(c)) {
            set.delete(c);
            return false;
          }
          set.add(c);
          return true;
        }
        if (force) set.add(c);
        else set.delete(c);
        return Boolean(force);
      },
      contains: (c) => set.has(c)
    };
  };
  const parseDnodes = (html) => {
    const list = [];
    for (const m of String(html || "").matchAll(/<g\s+([^>]*class="[^"]*dnode[^"]*"[^>]*)>/gi)) {
      const node = createElement("");
      for (const a of m[1].matchAll(/([a-z0-9-]+)="([^"]*)"/gi)) {
        node.setAttribute(a[1], a[2].replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
      }
      list.push(node);
    }
    return list;
  };
  const createElement = (id) => {
    const attrs = new Map();
    const listeners = new Map();
    let _innerHTML = "";
    let _children = [];
    const appended = [];
    const el = {
      id,
      textContent: "",
      className: "",
      classList: makeClassList(),
      style: {},
      appended,
      listeners,
      appendChild(child) {
        appended.push(child);
      },
      setAttribute(name, val) {
        attrs.set(name, String(val));
      },
      getAttribute(name) {
        return attrs.has(name) ? attrs.get(name) : null;
      },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      dispatchEvent(ev) {
        for (const fn of listeners.get(ev.type) || []) fn.call(el, ev);
      },
      focus() {
        activeEl = el;
      },
      querySelectorAll(sel) {
        if (sel === ".dnode") return _children;
        return [];
      },
      getContext() {
        return id === "sceneCanvas" ? recordingCtx : null;
      }
    };
    Object.defineProperty(el, "innerHTML", {
      get: () => _innerHTML,
      set: (val) => {
        _innerHTML = String(val ?? "");
        if (_innerHTML === "") appended.length = 0;
        _children = parseDnodes(_innerHTML);
      }
    });
    return el;
  };
  const documentElement = { getAttribute: () => null };
  const document = {
    documentElement,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
    createElement() {
      return createElement("");
    }
  };

  const mediaListeners = [];
  const sandbox = {
    document,
    getComputedStyle() {
      return {
        getPropertyValue(prop) {
          return emptyComputedStyles ? "" : currentTable[prop] || "";
        }
      };
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    window: {
      matchMedia(query) {
        return {
          matches: theme === "light" && query.includes("light"),
          addEventListener(_type, fn) {
            mediaListeners.push(fn);
          },
          addListener(fn) {
            mediaListeners.push(fn);
          }
        };
      }
    }
  };

  runInContext(scriptSource, createContext(sandbox));
  return {
    elements,
    canvasOps,
    getActiveElement: () => activeEl,
    setTheme(nextTheme) {
      currentTable = nextTheme === "light" ? light : dark;
    },
    fireMediaChange() {
      for (const fn of mediaListeners) fn({ matches: currentTable === light });
    }
  };
}

describe("standalone HTML export escaping", () => {
  function buildHostileArtifact() {
    return generateStandaloneHtmlArtifact(
      buildPanelStateFixture({
        projectName: `Demo ${HOSTILE_TAG}`,
        debrief: {
          responseType: "bug",
          tldrHeadline: `Headline ${HOSTILE_TAG}`,
          realWorldAnalogy: `Analogy ${HOSTILE_TAG}`,
          bugReport: {
            cause: `Cause ${HOSTILE_TAG}`,
            plan: `Plan ${HOSTILE_TAG}`,
            succeeded: "no",
            successSummary: `Summary ${HOSTILE_TAG}`,
            consequences: `Consequences ${HOSTILE_TAG}`
          },
          proofClaims: [
            { claim: `Claim ${HOSTILE_TAG}`, evidence: `Evidence ${HOSTILE_TAG}`, status: "verified" }
          ],
          uncertaintyAudit: [
            { area: `Area ${HOSTILE_TAG}`, reason: `Reason ${HOSTILE_TAG}`, riskLevel: "high" }
          ],
          verificationChecklist: [
            {
              id: "chk-hostile",
              text: `Check ${HOSTILE_TAG}`,
              source: `Source ${HOSTILE_TAG}`,
              risk: "low",
              checked: false
            }
          ],
          diagram: {
            diagramType: "cause-effect",
            title: `Diagram ${HOSTILE_TAG}`,
            nodes: [
              {
                id: `node-${HOSTILE_NODE_TAG}`,
                label: HOSTILE_NODE_TAG,
                sublabel: `Sub ${HOSTILE_NODE_TAG}`,
                role: `Role ${HOSTILE_NODE_TAG}`,
                file: "</script><script>alert(1)</script>",
                risk: "high",
                status: "active"
              },
              {
                id: "n2",
                label: "Second",
                sublabel: "Step",
                role: "Core Logic / Service",
                file: "",
                risk: "low",
                status: "done"
              }
            ],
            edges: []
          },
          touchedFiles: [classifyFileRole(`src/${HOSTILE_NODE_TAG}.mjs`)],
          complexity: { level: "simple", score: 1, reason: "Hostile fixture" },
          explainerScenes: []
        }
      })
    );
  }

  it("escapes hostile text in headings, cards, proof and checklist markup", () => {
    const html = buildHostileArtifact();

    assert.match(html, /^<!doctype html>/);
    assert.equal(/<img\b/i.test(html), false);
    assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
    assert.equal(html.includes("</script><script>alert(1)</script>"), false);
  });

  it("escapes ampersands before angle brackets", () => {
    const html = generateStandaloneHtmlArtifact(
      buildPanelStateFixture({
        debrief: { tldrHeadline: "Fish & <chips>" }
      })
    );

    assert.ok(html.includes("Fish &amp; &lt;chips&gt;"));
  });

  it("escapes diagram nodes before the client script writes SVG innerHTML", () => {
    const html = buildHostileArtifact();
    const { elements } = renderArtifactScript(html);
    const svg = elements.get("diagramSvg");

    assert.ok(svg, "SVG target must exist");
    assert.equal(/<img\b/i.test(svg.innerHTML), false);
    assert.ok(svg.innerHTML.includes("&lt;img src=x&gt;"));
    assert.ok(svg.innerHTML.includes('data-id="node-&lt;img src=x&gt;"'));
    assert.ok(svg.innerHTML.includes("Role &lt;img src=x&gt;"));
  });

  it("escapes '<' in the embedded JSON script payload", () => {
    const html = buildHostileArtifact();
    const dataLine = html.split("\n").find((line) => line.includes("var DATA ="));

    assert.ok(dataLine, "artifact must embed a DATA payload");
    assert.equal(dataLine.includes("<"), false);
    assert.ok(dataLine.includes("\\u003c/script"));
  });

  it("stays self-contained and free of dynamic evaluation", () => {
    const html = buildHostileArtifact();

    assert.equal(/<script[^>]+src=/i.test(html), false);
    assert.equal(/<link\b/i.test(html), false);
    assert.equal(/https?:\/\//.test(html), false);
    assert.equal(html.includes("new Function"), false);
    assert.equal(html.includes("eval("), false);
  });
});

describe("standalone HTML export theme parity", () => {
  function buildThemedArtifact() {
    return generateStandaloneHtmlArtifact(
      buildPanelStateFixture({
        debrief: {
          complexity: { level: "complex", score: 5, reason: "Multi-file theme flow" },
          explainerScenes: [
            {
              title: "Trace the flow",
              narration: "Follow the accent pulse across the nodes.",
              durationSec: 7,
              highlightNodeIds: ["n2", "n4"],
              callout: "Watch the highlighted node."
            },
            { title: "Verify", narration: "Check the proof.", durationSec: 7, highlightNodeIds: [] }
          ],
          diagram: {
            diagramType: "architecture",
            title: "Themed Flow",
            nodes: [
              { id: "n1", label: "Safe", sublabel: "Verified", role: "Input", risk: "low", status: "done" },
              { id: "n2", label: "Active", sublabel: "In flight", role: "Logic", risk: "low", status: "active" },
              { id: "n3", label: "Warn", sublabel: "Medium risk", role: "State", risk: "medium", status: "done" },
              { id: "n4", label: "Danger", sublabel: "High risk", role: "Auth", risk: "high", status: "done" }
            ],
            edges: [
              { from: "n1", to: "n2", stepNumber: 1, label: "Step 1", risk: "low" },
              { from: "n2", to: "n3", stepNumber: 2, label: "Step 2", risk: "medium" },
              { from: "n3", to: "n4", stepNumber: 3, label: "Step 3", risk: "high" }
            ]
          }
        }
      })
    );
  }

  const DARK_ONLY = ["#0b0f17", "#131a26", "#182030", "#f0f6fc", "#9ba7b8", "#38bdf8", "#fb7185", "#fbbf24", "#34d399", "#2a354b"];
  const LIGHT_ONLY = ["#efeae0", "#ffffff", "#17202e", "#4c5a6d", "#0284c7", "#be123c", "#b45309", "#059669", "#f1ece1"];

  it("embeds Dark HUD :root and @media (prefers-color-scheme: light) Field Desk Light palettes", () => {
    const { dark, light } = parseArtifactPalettes(buildThemedArtifact());
    const expectedDark = {
      "--bg-app": "#090d13",
      "--bg-panel": "#121924",
      "--bg-card": "#182130",
      "--text-primary": "#e7edf6",
      "--text-secondary": "#9aa9be",
      "--accent": "#38bdf8",
      "--ok": "#34d399",
      "--warn": "#fbbf24",
      "--risk": "#fb7185",
      "--explainer-stage-bg": "#070b12",
      "--canvas-grid-line": "rgba(56,189,248,0.08)"
    };
    const expectedLight = {
      "--bg-app": "#efeae0",
      "--bg-panel": "#fbf9f4",
      "--bg-card": "#ffffff",
      "--text-primary": "#17202e",
      "--text-secondary": "#4c5a6d",
      "--accent": "#0284c7",
      "--ok": "#059669",
      "--warn": "#b45309",
      "--risk": "#be123c",
      "--explainer-stage-bg": "#f1ece1",
      "--canvas-grid-line": "rgba(2,132,199,0.08)"
    };
    for (const [token, expected] of Object.entries(expectedDark)) {
      assert.equal(dark[token], expected, `export Dark HUD token ${token} mismatch`);
    }
    for (const [token, expected] of Object.entries(expectedLight)) {
      assert.equal(light[token], expected, `export Field Desk Light token ${token} mismatch`);
    }
    // Legacy artifact aliases resolve against the active palette in both themes.
    assert.equal(dark["--bg"], "#090d13");
    assert.equal(dark["--card"], "#182130");
    assert.equal(dark["--bad"], "#fb7185");
    assert.equal(light["--bg"], "#efeae0");
    assert.equal(light["--card"], "#ffffff");
    assert.equal(light["--bad"], "#be123c");
  });

  it("meets WCAG 2.1 AA contrast floors in both export palettes", () => {
    const { dark, light } = parseArtifactPalettes(buildThemedArtifact());
    for (const [label, palette] of [["Dark HUD", dark], ["Field Desk Light", light]]) {
      for (const bgToken of ["--bg-app", "--bg-surface", "--bg-panel", "--bg-card", "--bg-elevated"]) {
        for (const textToken of ["--text-primary", "--text-secondary"]) {
          const ratio = contrastRatio(palette[textToken], palette[bgToken]);
          assert.ok(ratio >= 4.5, `${label} ${textToken} on ${bgToken} contrast ${ratio.toFixed(2)} < 4.5`);
        }
        for (const strokeToken of ["--accent", "--ok", "--warn", "--risk", "--purple", "--teal"]) {
          const ratio = contrastRatio(palette[strokeToken], palette[bgToken]);
          assert.ok(ratio >= 3.0, `${label} ${strokeToken} on ${bgToken} contrast ${ratio.toFixed(2)} < 3.0`);
        }
      }
    }
  });

  it("keeps the inline script free of hardcoded dark-only color literals", () => {
    const scriptSource = extractInlineScript(buildThemedArtifact());
    for (const literal of [...DARK_ONLY, "#070b12", "rgba(56,189,248"]) {
      assert.equal(scriptSource.includes(literal), false, `artifact script must not hardcode ${literal}`);
    }
    assert.ok(scriptSource.includes("getComputedStyle(document.documentElement)"), "artifact must resolve CSS tokens");
    assert.ok(scriptSource.includes("prefers-color-scheme: light"), "artifact must listen for OS light-mode changes");
  });

  it("renders the export SVG from resolved Dark HUD tokens under dark mode", () => {
    const { elements } = renderArtifactScript(buildThemedArtifact(), { theme: "dark" });
    const svg = elements.get("diagramSvg").innerHTML;
    for (const expected of ["#38bdf8", "#182130", "#121924", "#e7edf6", "#9aa9be", "#fb7185", "#fbbf24", "#34d399"]) {
      assert.ok(svg.includes(expected), `dark export SVG must use token ${expected}`);
    }
    for (const literal of LIGHT_ONLY) {
      assert.equal(svg.includes(literal), false, `light-only token ${literal} leaked into dark export SVG`);
    }
  });

  it("renders the export SVG from resolved Field Desk Light tokens under light mode", () => {
    const { elements } = renderArtifactScript(buildThemedArtifact(), { theme: "light" });
    const svg = elements.get("diagramSvg").innerHTML;
    for (const expected of ["#0284c7", "#ffffff", "#fbf9f4", "#17202e", "#4c5a6d", "#be123c", "#b45309", "#059669"]) {
      assert.ok(svg.includes(expected), `light export SVG must use token ${expected}`);
    }
    for (const literal of DARK_ONLY) {
      assert.equal(svg.includes(literal), false, `dark-only literal ${literal} leaked into light export SVG`);
    }
  });

  it("draws the export Canvas explainer from resolved tokens in both themes", () => {
    const darkRun = renderArtifactScript(buildThemedArtifact(), { theme: "dark" });
    const darkStyles = darkRun.canvasOps.map((o) => o.style);
    assert.ok(darkRun.canvasOps.length > 0, "export canvas must draw when scenes exist");
    for (const expected of ["#070b12", "rgba(56,189,248,0.08)", "#182130", "#e7edf6", "#9aa9be", "#38bdf8", "#fbbf24"]) {
      assert.ok(darkStyles.includes(expected), `dark export canvas must use token ${expected}`);
    }

    const lightRun = renderArtifactScript(buildThemedArtifact(), { theme: "light" });
    const lightStyles = lightRun.canvasOps.map((o) => o.style);
    for (const expected of ["#f1ece1", "rgba(2,132,199,0.08)", "#ffffff", "#17202e", "#4c5a6d", "#0284c7", "#b45309"]) {
      assert.ok(lightStyles.includes(expected), `light export canvas must use token ${expected}`);
    }
    for (const literal of ["#070b12", "#131a26", "#182130", "#f0f6fc", "#9ba7b8", "#38bdf8", "#fbbf24"]) {
      assert.equal(lightStyles.includes(literal), false, `dark-only literal ${literal} leaked into light export canvas`);
    }
  });

  it("re-renders SVG and Canvas when prefers-color-scheme changes at runtime", () => {
    const run = renderArtifactScript(buildThemedArtifact(), { theme: "dark" });
    const svg = run.elements.get("diagramSvg");
    assert.ok(svg.innerHTML.includes("#38bdf8"));

    const mark = run.canvasOps.length;
    run.setTheme("light");
    run.fireMediaChange();
    assert.ok(svg.innerHTML.includes("#0284c7"), "SVG must re-render with light tokens");
    assert.ok(svg.innerHTML.includes("#ffffff"));
    assert.equal(svg.innerHTML.includes("#38bdf8"), false);

    const freshStyles = run.canvasOps.slice(mark).map((o) => o.style);
    assert.ok(freshStyles.length > 0, "media change must re-draw the canvas");
    assert.ok(freshStyles.includes("#f1ece1"), "canvas must re-draw with the light stage token");
    assert.ok(freshStyles.includes("#0284c7"));
  });

  it("includes keyboard-operable SVG nodes, focus-visible styles, and prefers-reduced-motion in standalone HTML", () => {
    const html = buildThemedArtifact();
    assert.match(html, /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\)/i);
    assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
    assert.match(html, /id="nodeInspector"[^>]*role="status"[^>]*aria-live="polite"/i);

    const run = renderArtifactScript(html, { theme: "dark" });
    const svgEl = run.elements.get("diagramSvg");
    const inspector = run.elements.get("nodeInspector");
    assert.match(svgEl.innerHTML, /class="dnode"[^>]*tabindex="0"[^>]*role="button"[^>]*aria-pressed="false"[^>]*aria-label="/i);

    // Keyboard Enter activates node, updates inspector & aria-pressed, and Space toggles off while keeping focus
    let nodes = svgEl.querySelectorAll(".dnode");
    nodes[0].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    assert.equal(inspector.classList.contains("has-selection"), true);
    assert.match(inspector.textContent, /Safe/);
    nodes = svgEl.querySelectorAll(".dnode");
    assert.equal(nodes[0].getAttribute("aria-pressed"), "true");
    assert.equal(run.getActiveElement()?.getAttribute("data-id"), "n1");

    nodes[0].dispatchEvent({ type: "keydown", key: " ", preventDefault() {} });
    assert.equal(inspector.classList.contains("has-selection"), false);
    nodes = svgEl.querySelectorAll(".dnode");
    assert.equal(nodes[0].getAttribute("aria-pressed"), "false");

    // Play/Pause toggle aria-pressed cleanly
    const playBtn = run.elements.get("btnPlayScene");
    const pauseBtn = run.elements.get("btnPauseScene");
    playBtn.dispatchEvent({ type: "click" });
    assert.equal(playBtn.getAttribute("aria-pressed"), "true");
    assert.equal(pauseBtn.getAttribute("aria-pressed"), "false");
    pauseBtn.dispatchEvent({ type: "click" });
    assert.equal(playBtn.getAttribute("aria-pressed"), "false");
    assert.equal(pauseBtn.getAttribute("aria-pressed"), "true");
  });
});

describe("saveStandaloneHtmlArtifact", () => {
  it("writes a timestamped file under the workspace artifact directory", async () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-export-" });

    try {
      const result = await withEnv({ ZCODE_VISUALIZATION_DIR: null }, () =>
        saveStandaloneHtmlArtifact(workspace.root, buildPanelStateFixture())
      );

      const expectedDir = join(workspace.root, ".zcode", "vibe-debrief-artifacts");
      assert.equal(dirname(result.filePath), expectedDir);
      assert.match(result.fileName, /^vibe-debrief-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.html$/);
      assert.ok(existsSync(result.filePath));

      const html = readFileSync(result.filePath, "utf8");
      assert.ok(html.startsWith("<!doctype html>"));
      assert.equal(result.bytes, Buffer.byteLength(html, "utf8"));
    } finally {
      workspace.cleanup();
    }
  });

  it("honors ZCODE_VISUALIZATION_DIR for the export target", async () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-export-" });
    const output = createTempWorkspace({ prefix: "vibe-debrief-output-" });

    try {
      const result = await withEnv({ ZCODE_VISUALIZATION_DIR: output.root }, () =>
        saveStandaloneHtmlArtifact(workspace.root, buildPanelStateFixture())
      );

      assert.equal(dirname(result.filePath), output.root);
      assert.ok(existsSync(result.filePath));
      assert.equal(workspace.exists(".zcode/vibe-debrief-artifacts"), false);
    } finally {
      workspace.cleanup();
      output.cleanup();
    }
  });
});

// ============================================================================
// R2: ZCode Memory lesson persistence and workspace fallback
// ============================================================================

describe("ZCode Memory lesson persistence", () => {
  it("writes a slug memory file, MEMORY.md pointer and confirmed state", async () => {
    const { workspace, home, cleanup } = createTempFixture({
      workspace: { prefix: "vibe-debrief-memory-ws-" },
      home: { prefix: "vibe-debrief-memory-home-" }
    });

    try {
      const record = await withZCodeHomeDir(home, () =>
        confirmAndSaveLessonToZCodeMemory(workspace.root, {
          title: "We utilize cached tokens",
          summary: "We utilize the cache before network calls.",
          why: "It avoids repeated failures.",
          howToApply: "Check the cache first.",
          memoryType: "project",
          slug: "Cache First Rule"
        })
      );

      const expectedDir = memoryDirectoryFor(home, workspace.root);
      assert.equal(record.slug, "cache-first-rule");
      assert.equal(record.memoryType, "project");
      assert.equal(dirname(record.savedMemoryPath), expectedDir);
      assert.equal(record.memoryIndexPath, join(expectedDir, "MEMORY.md"));

      const memoryFile = readFileSync(record.savedMemoryPath, "utf8");
      assert.match(memoryFile, /^---\nname: cache-first-rule\n/);
      assert.match(memoryFile, /metadata:\n {2}type: project/);
      assert.match(memoryFile, /\*\*Why:\*\* It avoids repeated failures\./);
      assert.match(memoryFile, /\*\*How to apply:\*\* Check the cache first\./);
      assert.match(memoryFile, /We use the cache before network calls\./);

      const index = readFileSync(record.memoryIndexPath, "utf8");
      assert.match(
        index,
        /- \[We use cached tokens\]\(cache-first-rule\.md\) — We use the cache before network calls\./
      );

      const state = loadPersistedState(workspace.root);
      assert.equal(state.confirmedLessons.length, 1);
      assert.equal(state.confirmedLessons[0].slug, "cache-first-rule");
      assert.equal(state.confirmedLessons[0].memoryType, "project");
      const lesson = state.currentDebrief.lessonsLearned.find(
        (entry) => entry.slug === "cache-first-rule"
      );
      assert.ok(lesson);
      assert.equal(lesson.confirmed, true);
      assert.equal(lesson.savedMemoryPath, record.savedMemoryPath);
    } finally {
      cleanup();
    }
  });

  it("keeps one MEMORY.md pointer and one state record when confirming twice", async () => {
    const { workspace, home, cleanup } = createTempFixture({
      workspace: { prefix: "vibe-debrief-memory-ws-" },
      home: { prefix: "vibe-debrief-memory-home-" }
    });

    try {
      const lesson = {
        title: "Guard the token",
        summary: "Guard the token before use.",
        slug: "guard-the-token",
        memoryType: "feedback"
      };

      const first = await withZCodeHomeDir(home, () =>
        confirmAndSaveLessonToZCodeMemory(workspace.root, lesson)
      );
      const second = await withZCodeHomeDir(home, () =>
        confirmAndSaveLessonToZCodeMemory(workspace.root, {
          ...lesson,
          summary: "Guard the token before every use."
        })
      );

      assert.equal(second.savedMemoryPath, first.savedMemoryPath);
      const index = readFileSync(second.memoryIndexPath, "utf8");
      const pointers = index
        .split(/\r?\n/)
        .filter((line) => line.includes("(guard-the-token.md)"));
      assert.equal(pointers.length, 1);
      assert.match(pointers[0], /Guard the token before every use\./);

      const state = loadPersistedState(workspace.root);
      assert.equal(
        state.confirmedLessons.filter((entry) => entry.slug === "guard-the-token").length,
        1
      );
      assert.equal(
        state.currentDebrief.lessonsLearned.filter(
          (entry) => entry.slug === "guard-the-token"
        ).length,
        1
      );
    } finally {
      cleanup();
    }
  });

  it("normalizes unknown memory types to feedback", async () => {
    const { workspace, home, cleanup } = createTempFixture({
      workspace: { prefix: "vibe-debrief-memory-ws-" },
      home: { prefix: "vibe-debrief-memory-home-" }
    });

    try {
      const record = await withZCodeHomeDir(home, () =>
        confirmAndSaveLessonToZCodeMemory(workspace.root, {
          title: "Unknown memory type",
          summary: "Keep the default memory type.",
          slug: "unknown-type",
          memoryType: "mystery"
        })
      );

      assert.equal(record.memoryType, "feedback");
      assert.match(readFileSync(record.savedMemoryPath, "utf8"), /metadata:\n {2}type: feedback/);
    } finally {
      cleanup();
    }
  });

  it("reuses an existing project memory directory matched by slug prefix", async () => {
    const { workspace, home, cleanup } = createTempFixture({
      workspace: { prefix: "vibe-debrief-memory-ws-" },
      home: { prefix: "vibe-debrief-memory-home-" }
    });

    try {
      const existingMemoryDir = join(
        home.memoryProjectsRoot,
        `${workspaceSlug(workspace.root)}-legacy`,
        "memory"
      );
      mkdirSync(existingMemoryDir, { recursive: true });

      const record = await withZCodeHomeDir(home, () =>
        confirmAndSaveLessonToZCodeMemory(workspace.root, {
          title: "Reuse the matched project",
          summary: "Write into the matched memory folder.",
          slug: "matched-project"
        })
      );

      assert.equal(dirname(record.savedMemoryPath), existingMemoryDir);
      assert.ok(existsSync(join(existingMemoryDir, "matched-project.md")));
    } finally {
      cleanup();
    }
  });

  it("falls back to the workspace memory directory when the home root is unusable", async () => {
    const { workspace, home, cleanup } = createTempFixture({
      workspace: { prefix: "vibe-debrief-memory-ws-" },
      home: { prefix: "vibe-debrief-memory-home-" }
    });

    try {
      rmSync(home.memoryProjectsRoot, { recursive: true, force: true });
      writeFileSync(home.memoryProjectsRoot, "blocked", "utf8");

      const record = await withZCodeHomeDir(home, () =>
        confirmAndSaveLessonToZCodeMemory(workspace.root, {
          title: "Workspace fallback lesson",
          summary: "Write into the workspace memory folder.",
          slug: "workspace-fallback"
        })
      );

      const fallbackDir = join(workspace.root, ".zcode", "memory");
      assert.equal(dirname(record.savedMemoryPath), fallbackDir);
      assert.equal(record.memoryIndexPath, join(fallbackDir, "MEMORY.md"));
      assert.ok(existsSync(join(fallbackDir, "workspace-fallback.md")));
      assert.match(readFileSync(join(fallbackDir, "MEMORY.md"), "utf8"), /workspace-fallback\.md/);
    } finally {
      cleanup();
    }
  });
});

// ============================================================================
// R2: Lightweight Gemini model discovery against fixture config directories
// ============================================================================

describe("discoverLightweightGeminiModels", () => {
  it("ranks lightweight Gemini models, filters others and dedupes ids", async () => {
    const home = createTempHome({
      prefix: "vibe-debrief-models-home-",
      providerConfig: {
        config: {
          providerConfigRules: {
            providerRules: [
              {
                providerId: "new-provider",
                providerName: "New Provider",
                enabled: true,
                config: {
                  modelOrder: [
                    "gemini-4-argon",
                    "gemini-4-argon-high",
                    "gemini-4-argon-lite",
                    "gemini-4-image",
                    "gpt-5",
                    "gemini-4-argon"
                  ],
                  personalModelIds: ["gemini-4-argon", "gemini-3.8-flash"]
                }
              }
            ]
          }
        }
      }
    });

    try {
      const models = await withZCodeHomeDir(home, () => discoverLightweightGeminiModels());

      assert.deepEqual(
        models.map((model) => model.id),
        [
          "new-provider/gemini-4-argon",
          "new-provider/gemini-3.8-flash",
          "new-provider/gemini-4-argon-high",
          "new-provider/gemini-4-argon-lite"
        ]
      );
      assert.deepEqual(
        models.map((model) => model.score),
        [10, 10, 5, 2]
      );
      assert.equal(models[0].providerName, "New Provider");
    } finally {
      home.cleanup();
    }
  });

  it("skips disabled, hidden and keyless API providers", async () => {
    const home = createTempHome({
      prefix: "vibe-debrief-models-home-",
      providerConfig: {
        config: {
          providerConfigRules: {
            providerRules: [
              {
                providerId: "disabled",
                providerName: "Disabled",
                enabled: false,
                config: { modelOrder: ["gemini-4-argon"] }
              },
              {
                providerId: "hidden",
                providerName: "Hidden",
                config: { visibility: "hidden", modelOrder: ["gemini-4-argon"] }
              },
              {
                providerId: "keyless",
                providerName: "Keyless",
                config: {
                  access: { type: "api-key", apiKey: "   " },
                  modelOrder: ["gemini-4-argon"]
                }
              },
              {
                providerId: "keyed",
                providerName: "Keyed",
                config: {
                  access: { type: "api-key", apiKey: "sk-test" },
                  modelOrder: ["gemini-4-argon"]
                }
              },
              {
                providerId: "visible",
                providerName: "Visible",
                config: { modelOrder: ["gemini-3.8-flash"] }
              }
            ]
          }
        }
      }
    });

    try {
      const models = await withZCodeHomeDir(home, () => discoverLightweightGeminiModels());

      assert.deepEqual(
        models.map((model) => model.id),
        ["keyed/gemini-4-argon", "visible/gemini-3.8-flash"]
      );
    } finally {
      home.cleanup();
    }
  });

  it("discovers enabled account subscription models from credentials", async () => {
    const home = createTempHome({
      prefix: "vibe-debrief-models-home-",
      setting: {
        subscriptions: [
          { id: "sub-1", name: "Plan A", enabled: true },
          { id: "sub-2", name: "Plan B", enabled: false }
        ]
      },
      credentials: {
        subscriptionInfo: {
          "sub-1": {
            models: ["gemini-4-argon", { id: "gemini-3.8-flash" }, "gpt-5", "gemini-image-1"]
          },
          "sub-2": { models: ["gemini-4-argon"] }
        }
      }
    });

    try {
      const models = await withZCodeHomeDir(home, () => discoverLightweightGeminiModels());

      assert.deepEqual(
        models.map((model) => model.id),
        ["account:sub-1/gemini-4-argon", "account:sub-1/gemini-3.8-flash"]
      );
      assert.equal(models[0].providerName, "Plan A");
    } finally {
      home.cleanup();
    }
  });

  it("returns an empty list for malformed config files", async () => {
    const home = createTempHome({
      prefix: "vibe-debrief-models-home-",
      fixtures: {
        ".zcode/v2/provider_config.json": "{ broken json",
        ".zcode/v2/setting.json": "[]",
        ".zcode/v2/credentials.json": "not json"
      }
    });

    try {
      const models = await withZCodeHomeDir(home, () => discoverLightweightGeminiModels());
      assert.deepEqual(models, []);
    } finally {
      home.cleanup();
    }
  });

  it("keeps the documented default recommended model when no model is discoverable", async () => {
    const { workspace, home, cleanup } = createTempFixture({
      workspace: { prefix: "vibe-debrief-models-ws-" },
      home: { prefix: "vibe-debrief-models-home-" }
    });

    try {
      const panelState = await withZCodeHomeDir(home, () => buildFullPanelState(workspace.root));

      assert.deepEqual(panelState.lightweightGeminiModels, []);
      assert.equal(panelState.recommendedGeminiModel, "new-provider/gemini-3.8-flash");
      assert.ok(existsSync(join(panelState.zcodeMemory.memoryDir, "MEMORY.md")) === false);
    } finally {
      cleanup();
    }
  });
});

// ============================================================================
// Story 5.1: OQ-5 additive schema enrichment & normalizers (R1 / R13)
// ============================================================================

describe("Story 5.1 — OQ-5 schema enrichment & normalizers", () => {
  it("upgrades a legacy v0.2.0 snapshot without OQ-5 fields into a valid OQ-5 debrief", () => {
    const legacySnapshot = {
      id: "legacy-debrief-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      responseType: "bug",
      persona: "vibe-mentor",
      tldrHeadline: "Fixed retry guard in webhook handler.",
      realWorldAnalogy: "Like a fuse protecting circuit boards.",
      bugReport: {
        cause: "Webhook handler retried infinitely on HTTP 500.",
        plan: "Add MAX_RETRIES <= 3 guard.",
        succeeded: "yes",
        successSummary: "Guard added and verified.",
        consequences: "Prevents retry loops."
      },
      touchedFiles: ["src/webhook.mjs", "test/webhook.test.mjs"]
    };

    const enriched = ensureDebriefEnriched(legacySnapshot);

    // Legacy fields intact
    assert.equal(enriched.id, "legacy-debrief-1");
    assert.equal(enriched.responseType, "bug");
    assert.equal(enriched.tldrHeadline, "Fixed retry guard in webhook handler.");
    assert.equal(enriched.bugReport.succeeded, "yes");
    assert.equal(enriched.touchedFiles.length, 2);

    // OQ-5 Additive fields populated with deterministic defaults
    assert.equal(enriched.verdict, "Solved");
    assert.equal(typeof enriched.waitingOnYou, "object");
    assert.ok(["choice", "action", "reply", "blocked", "none"].includes(enriched.waitingOnYou.state));
    assert.equal(typeof enriched.waitingOnYou.label, "string");
    assert.equal(typeof enriched.waitingOnYou.prompt, "string");
    assert.equal(typeof enriched.waitingOnYou.allowInlineReply, "boolean");
    assert.ok(Array.isArray(enriched.waitingOnYou.chips));
    assert.ok(enriched.waitingOnYou.chips.length <= 4);

    assert.ok(Array.isArray(enriched.choices));
    assert.equal(enriched.choices.length, 0);

    assert.equal(typeof enriched.xray, "object");
    assert.equal(typeof enriched.xray.plain.headline, "string");
    assert.ok(Array.isArray(enriched.xray.plain.summaryBullets));
    assert.equal(typeof enriched.xray.tech.headline, "string");
    assert.ok(Array.isArray(enriched.xray.tech.summaryBullets));
    assert.ok(Array.isArray(enriched.xray.tech.symbols));
    assert.ok(Array.isArray(enriched.xray.tech.paths));
    assert.ok(Array.isArray(enriched.xray.tech.commands));
    assert.ok(Array.isArray(enriched.xray.tech.exitCodes));
    assert.ok(Array.isArray(enriched.xray.tech.proofLines));

    // diagram and diagramSpec sync-aliased
    assert.equal(typeof enriched.diagramSpec, "object");
    assert.equal(enriched.diagramSpec.grammar, enriched.diagram.grammar);
    assert.equal(enriched.diagramSpec.diagramType, enriched.diagram.diagramType);
    assert.equal(enriched.diagramSpec.viewBoxWidth, 460);
    assert.ok(enriched.diagramSpec.nodes.length <= 6);
    assert.equal(enriched.diagram.nodes.length, enriched.diagramSpec.nodes.length);

    assert.ok(Array.isArray(enriched.microBlocks));
    assert.ok(enriched.microBlocks.includes("diagram"));
    assert.ok(enriched.microBlocks.includes("proof-audit"));

    assert.ok(Array.isArray(enriched.concepts));
    assert.ok(enriched.concepts.length <= 6);

    assert.equal(typeof enriched.minimalMode, "boolean");
    assert.equal(enriched.minimalMode, false);

    assert.equal(typeof enriched.heuristicConfidence, "number");
    assert.ok(enriched.heuristicConfidence >= 0 && enriched.heuristicConfidence <= 1);

    assert.equal(typeof enriched.rawQuote, "string");
    assert.equal(enriched.rawQuote, "");
  });

  it("upgrades a v0.2.0 state fixture cleanly in buildFullPanelState", () => {
    const workspace = createTempWorkspace({ prefix: "vibe-debrief-v020-" });

    try {
      // Write legacy v0.2.0 / v0.3.0 state JSON that completely lacks all OQ-5 fields
      workspace.write(
        ".zcode/vibe-debrief-state.json",
        JSON.stringify({
          projectName: "v020-project",
          activePersona: "vibe-mentor",
          turnCount: 2,
          currentDebrief: {
            id: "debrief-v020",
            responseType: "implementation",
            tldrHeadline: "Delivered first feature.",
            realWorldAnalogy: "Like adding a new tool to your kit.",
            implementationReport: {
              objective: "Build first feature.",
              planAndWhy: "Direct modular build.",
              result: "Feature wired and ready.",
              consequences: "No regressions."
            },
            touchedFiles: ["src/feature.mjs"]
          },
          history: [
            {
              id: "debrief-v020-hist",
              responseType: "bug",
              tldrHeadline: "Fixed startup crash.",
              bugReport: {
                cause: "Missing env var.",
                plan: "Provide default fallback.",
                succeeded: "yes",
                successSummary: "Default applied.",
                consequences: "Starts reliably."
              }
            }
          ]
        })
      );

      const panelState = buildFullPanelState(workspace.root);

      assert.equal(panelState.projectName, "v020-project");
      const current = panelState.currentDebrief;
      assert.equal(current.id, "debrief-v020");
      assert.equal(current.verdict, "Built");
      assert.equal(typeof current.waitingOnYou, "object");
      assert.ok(Array.isArray(current.waitingOnYou.chips));
      assert.ok(Array.isArray(current.choices));
      assert.equal(typeof current.xray, "object");
      assert.equal(typeof current.diagramSpec, "object");
      assert.equal(current.diagramSpec.viewBoxWidth, 460);
      assert.ok(Array.isArray(current.microBlocks));
      assert.ok(Array.isArray(current.concepts));
      assert.equal(typeof current.minimalMode, "boolean");
      assert.equal(typeof current.heuristicConfidence, "number");
      assert.equal(typeof current.rawQuote, "string");

      // History debriefs also upgraded with OQ-5 fields
      assert.equal(panelState.history.length, 1);
      const hist = panelState.history[0];
      assert.equal(hist.id, "debrief-v020-hist");
      assert.equal(hist.verdict, "Solved");
      assert.equal(typeof hist.waitingOnYou, "object");
      assert.equal(typeof hist.diagramSpec, "object");
    } finally {
      workspace.cleanup();
    }
  });

  it("enforces bounded collections on OQ-5 fields", () => {
    const oversizedConcepts = Array.from({ length: 9 }, (_, idx) => ({
      slug: `concept-${idx + 1}`,
      label: `Concept ${idx + 1}`,
      techSymbol: `sym${idx + 1}()`,
      targetPlugin: "visualize",
      stage1: { definition: "Def", analogy: "Ana" },
      stage2: { howItWorks: "Works" },
      stage2Prompt: "Prompt"
    }));

    const oversizedChips = Array.from({ length: 8 }, (_, idx) => ({
      id: `chip-${idx + 1}`,
      key: `${idx + 1}`,
      label: `Action ${idx + 1}`,
      messagePrompt: `Run ${idx + 1}`
    }));

    const oversizedNodes = Array.from({ length: 10 }, (_, idx) => ({
      id: `n${idx + 1}`,
      label: `Node ${idx + 1}`
    }));

    const enriched = ensureDebriefEnriched({
      responseType: "implementation",
      tldrHeadline: "Bounded collections test.",
      concepts: oversizedConcepts,
      waitingOnYou: {
        state: "action",
        label: "Verify / Run",
        prompt: "Run checks",
        chips: oversizedChips
      },
      diagramSpec: {
        grammar: "sequence",
        title: "Large Sequence",
        nodes: oversizedNodes,
        edges: []
      },
      rawQuote: "Q".repeat(400)
    });

    assert.equal(enriched.concepts.length, 6, "concepts must be capped at <= 6");
    assert.equal(enriched.waitingOnYou.chips.length, 4, "waitingOnYou.chips must be capped at <= 4");
    assert.equal(enriched.diagramSpec.nodes.length, 6, "diagramSpec.nodes must be capped at <= 6");
    assert.equal(enriched.diagram.nodes.length, 6, "diagram.nodes must be capped at <= 6");
    assert.equal(enriched.rawQuote.length, 280, "rawQuote must be capped at <= 280 chars");
  });

  it("preserves and normalizes caller-supplied OQ-5 fields", () => {
    const debriefInput = {
      responseType: "implementation",
      tldrHeadline: "Configured rate limiter with token bucket algorithm.",
      verdict: "Planned",
      minimalMode: true,
      heuristicConfidence: 0.88,
      rawQuote: "Rate limiter configured with capacity=100.",
      xray: {
        plain: {
          headline: "Configured rate limiter with token bucket algorithm.",
          summaryBullets: ["Tokens refill at 10/sec.", "Burst capacity set to 100."]
        },
        tech: {
          headline: "Configured TokenBucket in src/limiter.mjs.",
          summaryBullets: ["Added refillTimer and atomic decrement."],
          symbols: ["TokenBucket", "refillTimer"],
          paths: ["src/limiter.mjs"],
          commands: ["node --test test/limiter.test.mjs"],
          exitCodes: [0],
          proofLines: ["PASS test/limiter.test.mjs"]
        }
      },
      waitingOnYou: {
        state: "reply",
        label: "Answer Question",
        prompt: "Choose token bucket storage adapter.",
        allowInlineReply: true,
        chips: [
          {
            id: "act-1",
            key: "1",
            label: "Use In-Memory",
            techLabel: "MemoryAdapter",
            messagePrompt: "Use in-memory adapter."
          }
        ]
      },
      choices: [
        {
          id: "choice-1",
          key: "A",
          title: "In-Memory Adapter",
          plainSubtext: "Fastest option with zero network overhead.",
          techSubtext: "new MemoryStore()",
          messagePrompt: "Option A: In-Memory Adapter",
          picked: true,
          tradeOffs: [
            { label: "Speed", score: 95 },
            { label: "Persistence", score: 20 }
          ]
        }
      ],
      diagramSpec: {
        grammar: "flow-diff",
        title: "Rate Limiter Flow",
        techTitle: "src/limiter.mjs::TokenBucket FlowDiff",
        viewBoxWidth: 460,
        groups: [{ id: "g1", label: "Core", lane: "engine" }],
        nodes: [
          {
            id: "n1",
            label: "Client Request",
            techLabel: "req: IncomingMessage",
            sublabel: "Incoming call",
            role: "Input",
            file: "src/limiter.mjs",
            risk: "low",
            status: "done",
            lane: "engine",
            branch: "main"
          }
        ],
        edges: [
          {
            from: "n1",
            to: "n1",
            stepNumber: 1,
            label: "Check token",
            techLabel: "tryConsume()",
            risk: "low",
            animated: true
          }
        ]
      },
      microBlocks: ["unclear", "choices", "diagram", "proof-audit", "concepts", "lessons"],
      concepts: [
        {
          slug: "token-bucket",
          label: "Token Bucket",
          techSymbol: "TokenBucket.tryConsume()",
          targetPlugin: "vectorcraft",
          stage1: {
            definition: "Rate limiting algorithm that accumulates tokens over time.",
            analogy: "Like a bucket collecting drops of water under a tap.",
            microVisualSpec: {
              type: "loop-3node",
              nodes: ["Refill", "Bucket", "Consume"]
            }
          },
          stage2: {
            howItWorks: "Replenishes tokens periodically up to max burst limit.",
            keyTradeOff: "Low memory overhead vs. state persistence across restarts.",
            inYourCodebase: "Implemented in src/limiter.mjs."
          },
          stage2Prompt: "Diagram the token refill loop and consumption check."
        }
      ],
      proofClaims: [
        {
          claim: "Token bucket test passes",
          evidence: "test/limiter.test.mjs",
          detail: "assert.equal(limiter.tryConsume(1), true)",
          status: "verified"
        }
      ]
    };

    const enriched = ensureDebriefEnriched(debriefInput);

    assert.equal(enriched.verdict, "Planned");
    assert.equal(enriched.minimalMode, true);
    assert.equal(enriched.heuristicConfidence, 0.88);
    assert.equal(enriched.rawQuote, "Rate limiter configured with capacity=100.");

    assert.equal(enriched.xray.plain.headline, debriefInput.xray.plain.headline);
    assert.deepEqual(enriched.xray.plain.summaryBullets, debriefInput.xray.plain.summaryBullets);
    assert.deepEqual(enriched.xray.tech.symbols, ["TokenBucket", "refillTimer"]);
    assert.deepEqual(enriched.xray.tech.paths, ["src/limiter.mjs"]);
    assert.deepEqual(enriched.xray.tech.commands, ["node --test test/limiter.test.mjs"]);
    assert.deepEqual(enriched.xray.tech.exitCodes, [0]);

    assert.equal(enriched.waitingOnYou.state, "reply");
    assert.equal(enriched.waitingOnYou.allowInlineReply, true);
    assert.equal(enriched.waitingOnYou.chips[0].techLabel, "MemoryAdapter");

    assert.equal(enriched.choices.length, 1);
    assert.equal(enriched.choices[0].tradeOffs[0].score, 95);

    assert.equal(enriched.diagramSpec.grammar, "flow-diff");
    assert.equal(enriched.diagramSpec.techTitle, "src/limiter.mjs::TokenBucket FlowDiff");
    assert.equal(enriched.diagramSpec.nodes[0].techLabel, "req: IncomingMessage");
    assert.equal(enriched.diagramSpec.nodes[0].lane, "engine");
    assert.equal(enriched.diagramSpec.edges[0].techLabel, "tryConsume()");
    assert.equal(enriched.diagramSpec.edges[0].animated, true);

    assert.deepEqual(enriched.microBlocks, ["unclear", "choices", "diagram", "proof-audit", "concepts", "lessons"]);

    assert.equal(enriched.concepts.length, 1);
    assert.equal(enriched.concepts[0].targetPlugin, "vectorcraft");
    assert.equal(enriched.concepts[0].stage1.microVisualSpec.type, "loop-3node");

    assert.equal(enriched.proofClaims[0].detail, "assert.equal(limiter.tryConsume(1), true)");
  });

  it("derives deterministic defaults for bug failures and choice waiting states", () => {
    // Failing bug turn
    const failedBug = ensureDebriefEnriched({
      responseType: "bug",
      tldrHeadline: "Crash in auth module.",
      bugReport: {
        cause: "Token was null.",
        plan: "Add null check.",
        succeeded: "no"
      }
    });
    assert.equal(failedBug.verdict, "Blocked");
    assert.equal(failedBug.waitingOnYou.state, "blocked");
    assert.equal(failedBug.heuristicConfidence, 0.45);
    assert.ok(failedBug.microBlocks.includes("unclear"));

    // Choices without explicit waitingOnYou
    const choiceTurn = ensureDebriefEnriched({
      responseType: "implementation",
      tldrHeadline: "Proposed architectural paths.",
      choices: [
        { key: "A", title: "Option A" },
        { key: "B", title: "Option B" }
      ]
    });
    assert.equal(choiceTurn.waitingOnYou.state, "choice");
    assert.equal(choiceTurn.waitingOnYou.chips.length, 2);
    assert.equal(choiceTurn.waitingOnYou.chips[0].key, "A");
    assert.equal(choiceTurn.waitingOnYou.chips[1].key, "B");
    assert.ok(choiceTurn.microBlocks.includes("choices"));
  });
});

// ============================================================================
// AD-3 / AD-4: Dependency-free and stdout-isolated engine guarantees
// ============================================================================

describe("zero-dependency engine guarantees", () => {
  it("does not depend on package.json or node_modules", () => {
    assert.equal(existsSync(join(REPO_ROOT, "package.json")), false);
    assert.equal(existsSync(join(REPO_ROOT, "node_modules")), false);
  });

  it("imports only node: built-ins and relative modules from tests", () => {
    const testsDir = join(REPO_ROOT, "tests");
    const testFiles = readdirSync(testsDir).filter((file) => file.endsWith(".mjs"));

    for (const file of testFiles) {
      const source = readFileSync(join(testsDir, file), "utf8");
      const specifiers = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map(
        (match) => match[1]
      );
      for (const specifier of specifiers) {
        assert.ok(
          specifier.startsWith("node:") ||
            specifier.startsWith("./") ||
            specifier.startsWith("../"),
          `${file} must not import external module ${specifier}`
        );
      }
    }
  });

  it("never reads stdin or writes stdout from the Core Engine", () => {
    const engineSource = readFileSync(ENGINE_PATH, "utf8");
    assert.equal(/process\.stdout|process\.stdin|console\.log/.test(engineSource), false);
  });
});