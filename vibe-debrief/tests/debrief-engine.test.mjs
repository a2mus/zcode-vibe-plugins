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
  generateStandaloneHtmlArtifact,
  loadPersistedState,
  savePersistedState,
  saveStandaloneHtmlArtifact,
  synthesizeHeuristicDebrief
} from "../scripts/debrief-engine.mjs";
import {
  ENGINE_PATH,
  REPO_ROOT,
  buildPanelStateFixture,
  createTempFixture,
  createTempHome,
  createTempWorkspace,
  memoryDirectoryFor,
  readJsonFile,
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

function renderArtifactScript(artifactHtml) {
  const scriptMatch = artifactHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, "artifact must contain one inline script");

  const elements = new Map();
  const createElement = (id) => ({
    id,
    innerHTML: "",
    textContent: "",
    className: "",
    style: {},
    appendChild() {},
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    getAttribute() {
      return null;
    },
    getContext() {
      return null;
    }
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
    createElement() {
      return { className: "", textContent: "", onclick: null };
    }
  };

  runInContext(scriptMatch[1], createContext({ document }));
  return elements;
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
    const elements = renderArtifactScript(html);
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