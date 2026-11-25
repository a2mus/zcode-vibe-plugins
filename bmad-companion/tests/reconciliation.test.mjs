import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  reconcileWorkspaceTrackers,
  savePersistedState,
  scanBmadWorkspace
} from "../scripts/bmad-engine.mjs";
import {
  assertStrictJsonRpcStdout,
  createTempWorkspaceTracker,
  readJsonFile,
  runMcpServer,
  seedDualMetricWorkspace
} from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

describe("dual-progress scan tracer (Epic 3 Story 3.1)", () => {
  it("seeds a temp workspace with v6 YAML + v7 TOML + story plans + passing test report", () => {
    const ws = workspaces.seedDualMetric();

    // Verify v6 artifact
    assert.ok(
      ws.exists("_bmad-output/implementation-artifacts/sprint-status.yaml"),
      "expected v6 sprint-status.yaml"
    );

    // Verify v7 artifacts
    assert.ok(
      ws.exists("_bmad-output/initiative-demo/tickets/tickets.toml"),
      "expected v7 root tickets.toml"
    );
    assert.ok(
      ws.exists("_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml"),
      "expected v7 epic tickets.toml"
    );

    // Verify story plans
    assert.ok(
      ws.exists("_bmad-output/initiative-demo/tickets/epic-core/tickets/story-seed-fixture-plan.md"),
      "expected completed story plan"
    );
    assert.ok(
      ws.exists("_bmad-output/initiative-demo/tickets/epic-core/tickets/story-verify-scan-plan.md"),
      "expected in-progress story plan"
    );

    // Verify passing test report
    assert.ok(
      ws.exists("_bmad-output/implementation-artifacts/report-test-suite.md"),
      "expected passing test report artifact"
    );
    const reportText = ws.read("_bmad-output/implementation-artifacts/report-test-suite.md");
    assert.match(reportText, /Total:\s*10,\s*Passed:\s*10,\s*Failed:\s*0/);
  });

  it("proves scanBmadWorkspace returns both declared* and smart* metric sets on seeded v6+v7 fixture", () => {
    const ws = workspaces.seedDualMetric();
    const result = scanBmadWorkspace(ws.root);

    // Both declared* and smart* metric sets must be present and correctly typed
    assert.equal(typeof result.metrics, "object");
    assert.equal(typeof result.metrics.declaredDoneStories, "number");
    assert.equal(typeof result.metrics.declaredOverallPct, "number");
    assert.equal(typeof result.metrics.smartDoneStories, "number");
    assert.equal(typeof result.metrics.smartOverallPct, "number");
    assert.equal(typeof result.metrics.reconciledStoriesCount, "number");

    // Exact metric counts for the dual-metric fixture
    assert.equal(result.metrics.totalStories, 3);
    assert.equal(result.metrics.totalEpics, 2);
    assert.equal(result.metrics.declaredDoneStories, 1);
    assert.equal(result.metrics.declaredOverallPct, 33);
    assert.equal(result.metrics.smartDoneStories, 2);
    assert.equal(result.metrics.smartOverallPct, 67);
    assert.equal(result.metrics.reconciledStoriesCount, 2);

    // Smart progress exceeds static tracker progress due to verified evidence
    assert.ok(
      result.metrics.smartDoneStories > result.metrics.declaredDoneStories,
      "smart done stories must exceed declared done stories"
    );
    assert.ok(
      result.metrics.smartOverallPct > result.metrics.declaredOverallPct,
      "smart overall percentage must exceed declared overall percentage"
    );
    assert.ok(
      result.metrics.reconciledStoriesCount > 0,
      "reconciledStoriesCount must reflect AI-reconciled stories"
    );
  });

  it("asserts a non-empty smartReason for evidence-upgraded stories on the seeded v6+v7 fixture", () => {
    const ws = workspaces.seedDualMetric();
    const result = scanBmadWorkspace(ws.root);

    // Find the epic-core stories
    const coreEpic = result.epics.find((e) => e.slug === "epic-core");
    assert.ok(coreEpic, "expected epic-core to be present");

    const upgradedStory = coreEpic.stories.find((s) => s.id === "1.1");
    assert.ok(upgradedStory, "expected story 1.1 to be present");

    // Verify declared vs smart status divergence on upgraded story
    assert.equal(upgradedStory.declaredStatus, "backlog");
    assert.equal(upgradedStory.smartStatus, "done");
    assert.equal(upgradedStory.aiReconciled, true);

    // Verify non-empty smartReason contract
    assert.equal(typeof upgradedStory.smartReason, "string");
    assert.ok(upgradedStory.smartReason.length > 0, "smartReason must be non-empty");
    assert.equal(upgradedStory.smartReason, upgradedStory.smartEvidence);
    assert.match(
      upgradedStory.smartReason,
      /story plan/i,
      "smartReason should cite the story plan evidence"
    );

    // Verify non-upgraded story keeps null smartReason
    const inProgressStory = coreEpic.stories.find((s) => s.id === "1.2");
    assert.ok(inProgressStory, "expected story 1.2 to be present");
    assert.equal(inProgressStory.declaredStatus, "in-progress");
    assert.equal(inProgressStory.smartStatus, "in-progress");
    assert.equal(inProgressStory.aiReconciled, false);
    assert.equal(inProgressStory.smartReason, null);

    // Verify standalone implementation report story carries non-empty smartReason
    const reportEpic = result.epics.find((e) => e.slug.includes("report-test-suite"));
    assert.ok(reportEpic, "expected report-test-suite epic to be present");
    const impStory = reportEpic.stories.find((s) => s.id === "IMP.1");
    assert.ok(impStory, "expected IMP.1 delivery story");
    assert.equal(impStory.smartStatus, "done");
    assert.equal(impStory.aiReconciled, true);
    assert.equal(typeof impStory.smartReason, "string");
    assert.ok(impStory.smartReason.length > 0, "impStory smartReason must be non-empty");
    assert.match(impStory.smartReason, /implementation report/i);
  });

  it("computes dual metrics and non-empty smartReason on v6 sprint-status fallback workspace", () => {
    const ws = workspaces.create({
      files: {
        "_bmad-output/implementation-artifacts/sprint-status.yaml": [
          "development_status:",
          "  epic-1: in-progress",
          "  1-1-story-alpha: backlog",
          "  1-2-story-beta: ready-for-dev"
        ].join("\n") + "\n",
        "_bmad-output/implementation-artifacts/1-1-story-alpha.md": [
          "---",
          "title: Story Alpha",
          "status: done",
          "---",
          "",
          "# Story Alpha"
        ].join("\n") + "\n"
      }
    });

    const result = scanBmadWorkspace(ws.root);

    assert.equal(result.metrics.declaredDoneStories, 0);
    assert.equal(result.metrics.declaredOverallPct, 0);
    assert.equal(result.metrics.smartDoneStories, 1);
    assert.equal(result.metrics.smartOverallPct, 50);
    assert.equal(result.metrics.reconciledStoriesCount, 1);

    const epic = result.epics[0];
    const story1 = epic.stories.find((s) => s.key === "1-1-story-alpha");
    assert.ok(story1);
    assert.equal(story1.declaredStatus, "backlog");
    assert.equal(story1.smartStatus, "done");
    assert.equal(story1.aiReconciled, true);
    assert.equal(typeof story1.smartReason, "string");
    assert.ok(story1.smartReason.length > 0);
    assert.match(story1.smartReason, /Story file .* indicates 'done'/i);
  });

  it("hands off dual-metric fixture with customizable report name to Stories 2-3", () => {
    const ws = workspaces.create();
    seedDualMetricWorkspace(ws, { testReportName: "rapport-verification.md" });

    assert.ok(ws.exists("_bmad-output/implementation-artifacts/rapport-verification.md"));
    const result = scanBmadWorkspace(ws.root);

    assert.equal(result.metrics.totalStories, 3);
    assert.equal(result.metrics.smartDoneStories, 2);
    assert.equal(result.metrics.declaredDoneStories, 1);
    assert.ok(result.artifacts.some((a) => a.name === "rapport-verification.md"));
  });

  it("matches plan-<id>-*.md to entry.id without false-matching digits inside earlier plan filenames or emitting duplicate plan-derived stories", () => {
    const ws = workspaces.create({
      files: {
        "_bmad-output/initiative-dedupe/initiative-dedupe.md": "---\ntitle: Dedupe\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-dedupe/tickets/tickets.toml": [
          "[[epic]]",
          "id = 4",
          'slug = "epic-panel-polling-safety"',
          'title = "Panel Polling Safety"',
          "",
          "[[epic]]",
          "id = 5",
          'slug = "epic-execution-queue"',
          'title = "Execution Queue"',
          "",
          "[[epic]]",
          "id = 6",
          'slug = "epic-hooks-model-router"',
          'title = "Hooks & Model Router"'
        ].join("\n") + "\n",
        "_bmad-output/initiative-dedupe/plan-repo-root-ci-per-plugin-gates-2.md": [
          "---",
          "title: 'Wire per-plugin gates into repo-root CI'",
          "ticket: ''",
          "status: built",
          "---"
        ].join("\n") + "\n",
        "_bmad-output/initiative-dedupe/tickets/epic-panel-polling-safety/tickets/tickets.toml": [
          "[[entry]]",
          "id = 3",
          'title = "Accessibility floor: close AD-1-AD-5"',
          "",
          "[[entry]]",
          "id = 5",
          'title = "Refactor sweep"'
        ].join("\n") + "\n",
        "_bmad-output/initiative-dedupe/tickets/epic-panel-polling-safety/tickets/plan-3-accessibility-floor-close-ad-1-ad-5.md": [
          "---",
          "title: 'Accessibility floor: close AD-1-AD-5'",
          "ticket: 3",
          "container: epic-panel-polling-safety",
          "status: done",
          "---"
        ].join("\n") + "\n",
        "_bmad-output/initiative-dedupe/tickets/epic-panel-polling-safety/tickets/plan-5-refactor-sweep.md": [
          "---",
          "title: 'Refactor sweep'",
          "ticket: 5",
          "container: epic-panel-polling-safety",
          "status: done",
          "---"
        ].join("\n") + "\n",
        "_bmad-output/initiative-dedupe/tickets/epic-execution-queue/tickets/tickets.toml": [
          "[[entry]]",
          "id = 2",
          'title = "14-action queue contract"',
          "",
          "[[entry]]",
          "id = 4",
          'title = "Dual execution engine generation"'
        ].join("\n") + "\n",
        "_bmad-output/initiative-dedupe/tickets/epic-execution-queue/tickets/plan-2-14-action-queue-contract.md": [
          "---",
          "title: '14-action queue contract'",
          "ticket: 2",
          "container: epic-execution-queue",
          "status: done",
          "---"
        ].join("\n") + "\n",
        "_bmad-output/initiative-dedupe/tickets/epic-execution-queue/tickets/plan-4-dual-execution-engine-generation.md": [
          "---",
          "title: 'Dual execution engine generation'",
          "ticket: 4",
          "container: epic-execution-queue",
          "status: done",
          "---"
        ].join("\n") + "\n",
        "_bmad-output/initiative-dedupe/tickets/epic-hooks-model-router/tickets/tickets.toml": [
          "[[entry]]",
          "id = 2",
          'title = "4-tier model scorer"'
        ].join("\n") + "\n"
      }
    });

    const scan = scanBmadWorkspace(ws.root);
    const epic4 = scan.epics.find((e) => e.slug === "epic-panel-polling-safety");
    const epic5 = scan.epics.find((e) => e.slug === "epic-execution-queue");
    const epic6 = scan.epics.find((e) => e.slug === "epic-hooks-model-router");

    assert.equal(epic4.stories.length, 2, "epic-panel-polling-safety must not emit duplicate plan-5 entry");
    assert.ok(
      epic4.stories.find((s) => s.id === "4.5")?.planPath?.endsWith("plan-5-refactor-sweep.md"),
      "story 4.5 must match plan-5-refactor-sweep.md instead of plan-3-accessibility-floor-close-ad-1-ad-5.md"
    );

    assert.equal(epic5.stories.length, 2, "epic-execution-queue must not emit duplicate plan-4 entry");
    assert.ok(
      epic5.stories.find((s) => s.id === "5.4")?.planPath?.endsWith("plan-4-dual-execution-engine-generation.md"),
      "story 5.4 must match plan-4-dual-execution-engine-generation.md instead of plan-2-14-action-queue-contract.md"
    );

    const story62 = epic6.stories.find((s) => s.id === "6.2");
    assert.equal(story62.planPath, null, "story 6.2 must not match unrelated initiative CI plan ending in -2.md");
    assert.equal(story62.smartStatus, "backlog");
  });
});

describe("smart evidence evaluator rules (Epic 3 Story 3.2)", () => {
  it("upgrades smartStatus to done via storyOverrides done, and respects non-done overrides", () => {
    const ws = workspaces.seedDualMetric();

    // Persist a storyOverride with status: done
    savePersistedState(ws.root, {
      storyOverrides: {
        "epic-core#2": {
          status: "done",
          reason: "Manually verified by QA lead in pre-release testing"
        }
      }
    });

    const result = scanBmadWorkspace(ws.root);
    const coreEpic = result.epics.find((e) => e.slug === "epic-core");
    assert.ok(coreEpic);

    // Story 1.2 was declared in-progress; override upgrades it to done
    const overriddenStory = coreEpic.stories.find((s) => s.id === "1.2");
    assert.ok(overriddenStory);
    assert.equal(overriddenStory.declaredStatus, "in-progress");
    assert.equal(overriddenStory.smartStatus, "done");
    assert.equal(overriddenStory.aiReconciled, true);
    assert.equal(overriddenStory.smartReason, "Manually verified by QA lead in pre-release testing");

    // Story 1.1 was declared backlog; plan upgraded it to done
    const planStory = coreEpic.stories.find((s) => s.id === "1.1");
    assert.equal(planStory.smartStatus, "done");

    // All 3 stories (1.1, 1.2, IMP.1) are now smart done
    assert.equal(result.metrics.smartDoneStories, 3);
    assert.equal(result.metrics.smartOverallPct, 100);

    // Now test a non-done override: status: in-progress holds status
    const ws2 = workspaces.create({
      files: {
        "_bmad-output/initiative-test/initiative-test.md": "---\ntitle: Test\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-test/tickets/tickets.toml": '[[epic]]\nid = 1\nslug = "epic-sub"\ntitle = "Sub"\n',
        "_bmad-output/initiative-test/tickets/epic-sub/epic-sub.md": "---\ntype: epic\ntitle: Sub\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-test/tickets/epic-sub/tickets/tickets.toml": [
          "[[entry]]",
          "id = 1",
          'title = "Override In-Progress Story"',
          'status = "backlog"'
        ].join("\n") + "\n"
      }
    });

    savePersistedState(ws2.root, {
      storyOverrides: {
        "epic-sub#1": {
          status: "in-progress",
          reason: "Dev started work early"
        }
      }
    });

    const result2 = scanBmadWorkspace(ws2.root);
    const subEpic = result2.epics.find((e) => e.slug === "epic-sub");
    const st2 = subEpic.stories.find((s) => s.id === "1.1");
    assert.equal(st2.declaredStatus, "backlog");
    assert.equal(st2.smartStatus, "in-progress");
    assert.equal(st2.aiReconciled, true);
    assert.equal(result2.metrics.smartDoneStories, 0);
  });

  it("upgrades smartStatus to done on story plan status done, completed, or shipped", () => {
    const ws = workspaces.create({
      files: {
        "_bmad-output/initiative-plan/initiative-plan.md": "---\ntitle: Plans\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-plan/tickets/tickets.toml": '[[epic]]\nid = 1\nslug = "epic-plans"\ntitle = "Plans Epic"\n',
        "_bmad-output/initiative-plan/tickets/epic-plans/epic-plans.md": "---\ntype: epic\ntitle: Plans Epic\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-plan/tickets/epic-plans/tickets/tickets.toml": [
          "[[entry]]",
          "id = 1",
          'title = "Done Plan Story"',
          'status = "backlog"',
          "",
          "[[entry]]",
          "id = 2",
          'title = "Completed Plan Story"',
          'status = "backlog"',
          "",
          "[[entry]]",
          "id = 3",
          'title = "Shipped Plan Story"',
          'status = "backlog"',
          "",
          "[[entry]]",
          "id = 4",
          'title = "In-Progress Plan Story"',
          'status = "backlog"'
        ].join("\n") + "\n",
        "_bmad-output/initiative-plan/tickets/epic-plans/tickets/plan-1-1-done.md": "---\nticket: 1\nstatus: done\n---\n",
        "_bmad-output/initiative-plan/tickets/epic-plans/tickets/plan-1-2-completed.md": "---\nticket: 2\nstatus: completed\n---\n",
        "_bmad-output/initiative-plan/tickets/epic-plans/tickets/plan-1-3-shipped.md": "---\nticket: 3\nstatus: shipped\n---\n",
        "_bmad-output/initiative-plan/tickets/epic-plans/tickets/plan-1-4-inprogress.md": "---\nticket: 4\nstatus: in-progress\n---\n"
      }
    });

    const result = scanBmadWorkspace(ws.root);
    const epic = result.epics.find((e) => e.slug === "epic-plans");
    assert.ok(epic);

    // Plan with 'done' upgrades to done
    const s1 = epic.stories.find((s) => s.id === "1.1");
    assert.equal(s1.declaredStatus, "backlog");
    assert.equal(s1.smartStatus, "done");
    assert.equal(s1.aiReconciled, true);
    assert.match(s1.smartReason, /confirms 'done'/i);

    // Plan with 'completed' upgrades to done
    const s2 = epic.stories.find((s) => s.id === "1.2");
    assert.equal(s2.declaredStatus, "backlog");
    assert.equal(s2.smartStatus, "done");
    assert.equal(s2.aiReconciled, true);
    assert.match(s2.smartReason, /confirms 'completed'/i);

    // Plan with 'shipped' upgrades to done
    const s3 = epic.stories.find((s) => s.id === "1.3");
    assert.equal(s3.declaredStatus, "backlog");
    assert.equal(s3.smartStatus, "done");
    assert.equal(s3.aiReconciled, true);
    assert.match(s3.smartReason, /confirms 'shipped'/i);

    // Plan with 'in-progress' stays declared-only (backlog)
    const s4 = epic.stories.find((s) => s.id === "1.4");
    assert.equal(s4.declaredStatus, "backlog");
    assert.equal(s4.smartStatus, "backlog");
    assert.equal(s4.aiReconciled, false);
    assert.equal(s4.smartReason, null);

    // Total smart done = 3 out of 4 (75%)
    assert.equal(result.metrics.smartDoneStories, 3);
    assert.equal(result.metrics.declaredDoneStories, 0);
    assert.equal(result.metrics.smartOverallPct, 75);
  });

  it("upgrades smartStatus to done on passing test report (failCount === 0)", () => {
    // 1. Standalone passing report
    const ws = workspaces.create({
      files: {
        "_bmad-output/implementation-artifacts/report-clean-tests.md": [
          "# Test Report Clean",
          "",
          "Total: 15, Passed: 15, Failed: 0",
          "",
          "All tests green."
        ].join("\n") + "\n"
      }
    });

    const result = scanBmadWorkspace(ws.root);
    assert.equal(result.metrics.smartDoneStories, 1);
    const impStory = result.epics[0].stories.find((s) => s.id === "IMP.1");
    assert.ok(impStory);
    assert.equal(impStory.smartStatus, "done");
    assert.equal(impStory.aiReconciled, true);
    assert.match(impStory.smartReason, /report-clean-tests\.md/i);

    // 2. Story-matched passing test report
    const ws2 = workspaces.create({
      files: {
        "_bmad-output/initiative-rep/initiative-rep.md": "---\ntitle: Rep\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-rep/tickets/tickets.toml": '[[epic]]\nid = 1\nslug = "epic-rep"\ntitle = "Rep Epic"\n',
        "_bmad-output/initiative-rep/tickets/epic-rep/epic-rep.md": "---\ntype: epic\ntitle: Rep Epic\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-rep/tickets/epic-rep/tickets/tickets.toml": [
          "[[entry]]",
          "id = 1",
          'v6_key = "1-1-story-pass"',
          'title = "Story with Test Report"',
          'status = "backlog"'
        ].join("\n") + "\n",
        "_bmad-output/implementation-artifacts/report-1-1-story-pass.md": [
          "---",
          "failCount: 0",
          "passCount: 12",
          "---",
          "# Test Report for 1.1",
          "",
          "Total: 12, Passed: 12, Failed: 0"
        ].join("\n") + "\n"
      }
    });

    const result2 = scanBmadWorkspace(ws2.root);
    const repEpic = result2.epics.find((e) => e.slug === "epic-rep");
    const storyPass = repEpic.stories.find((s) => s.id === "1.1");
    assert.ok(storyPass);
    assert.equal(storyPass.declaredStatus, "backlog");
    assert.equal(storyPass.smartStatus, "done");
    assert.equal(storyPass.aiReconciled, true);
    assert.match(storyPass.smartReason, /report-1-1-story-pass\.md/i);
  });

  it("upgrades smartStatus to done on completed epic retrospective", () => {
    const ws = workspaces.create({
      files: {
        "_bmad-output/initiative-retro/initiative-retro.md": "---\ntitle: Retro\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-retro/tickets/tickets.toml": '[[epic]]\nid = 1\nslug = "epic-retro"\ntitle = "Retro Epic"\n',
        "_bmad-output/initiative-retro/tickets/epic-retro/epic-retro.md": "---\ntype: epic\ntitle: Retro Epic\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-retro/tickets/epic-retro/tickets/tickets.toml": [
          "[[entry]]",
          "id = 1",
          'title = "Lagging Tracker Story 1"',
          'status = "in-progress"',
          "",
          "[[entry]]",
          "id = 2",
          'title = "Lagging Tracker Story 2"',
          'status = "backlog"'
        ].join("\n") + "\n",
        "_bmad-output/initiative-retro/tickets/epic-retro/epic-retro-retrospective.md": [
          "---",
          "type: retrospective",
          "epic: epic-retro",
          "status: done",
          "---",
          "",
          "# Epic Retro Retrospective",
          "All acceptance criteria delivered and verified."
        ].join("\n") + "\n"
      }
    });

    const result = scanBmadWorkspace(ws.root);
    const epic = result.epics.find((e) => e.slug === "epic-retro");
    assert.ok(epic);
    assert.equal(epic.hasRetrospective, true);

    // Both lagging tracker stories upgrade to done due to completed retrospective
    const st1 = epic.stories.find((s) => s.id === "1.1");
    assert.equal(st1.declaredStatus, "in-progress");
    assert.equal(st1.smartStatus, "done");
    assert.equal(st1.aiReconciled, true);
    assert.match(st1.smartReason, /completed retrospective/i);

    const st2 = epic.stories.find((s) => s.id === "1.2");
    assert.equal(st2.declaredStatus, "backlog");
    assert.equal(st2.smartStatus, "done");
    assert.equal(st2.aiReconciled, true);
    assert.match(st2.smartReason, /completed retrospective/i);

    assert.equal(result.metrics.declaredDoneStories, 0);
    assert.equal(result.metrics.smartDoneStories, 2);
    assert.equal(result.metrics.smartOverallPct, 100);
  });

  it("holds status at in-progress/review and emits a high-priority remediation recommendation on failCount > 0 (C12)", () => {
    const ws = workspaces.create({
      files: {
        "_bmad-output/implementation-artifacts/report-failing-suite.md": [
          "# Test Execution Report: Regression Suite",
          "",
          "Total: 10, Passed: 7, Failed: 3",
          "",
          "Failures in SmokeTests and AuthTests.",
          "",
          "### SmokeTests",
          "Assertion failed on token refresh."
        ].join("\n") + "\n"
      }
    });

    const result = scanBmadWorkspace(ws.root);

    // Report story must NOT be upgraded to done
    const failEpic = result.epics.find((e) => e.slug.includes("report-failing-suite"));
    assert.ok(failEpic);
    assert.equal(failEpic.smartStatus, "review");
    assert.equal(failEpic.declaredStatus, "in-progress");

    const failStory = failEpic.stories.find((s) => s.id === "IMP.1");
    assert.ok(failStory);
    assert.equal(failStory.declaredStatus, "in-progress");
    assert.equal(failStory.smartStatus, "review");
    assert.notEqual(failStory.smartStatus, "done");
    assert.equal(failStory.aiReconciled, true);
    assert.match(failStory.smartReason, /3 test failure\(s\)/i);

    // Metrics reflect 0 done stories
    assert.equal(result.metrics.smartDoneStories, 0);
    assert.equal(result.metrics.reviewStories, 1);

    // High-priority remediation recommendation must be emitted
    const remediationRec = result.recommendations.find(
      (r) => r.badge === "Remediation" || /remediat/i.test(r.title || "")
    );
    assert.ok(remediationRec, "expected high-priority remediation recommendation to be emitted");
    assert.equal(remediationRec.priority, "high");
    assert.equal(remediationRec.skill, "/bmad-build");
    assert.match(remediationRec.title, /Remediate Test Failures/i);
    assert.match(remediationRec.fullCommand, /\/bmad-build\s+"Remediate 3 failing test\(s\)/i);
    assert.match(remediationRec.rationale, /3 test failure\(s\)/i);

    // Smart insight warning must also be present
    const testWarning = result.smartInsights.find((i) => i.type === "test-health");
    assert.ok(testWarning);
    assert.equal(testWarning.severity, "warning");
    assert.match(testWarning.title, /3 Test Failure/i);
  });

  it("unverified story stays declared-only without evidence", () => {
    const ws = workspaces.create({
      files: {
        "_bmad-output/initiative-unverified/initiative-unverified.md": "---\ntitle: Unverified\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-unverified/tickets/tickets.toml": '[[epic]]\nid = 1\nslug = "epic-unverified"\ntitle = "Unverified Epic"\n',
        "_bmad-output/initiative-unverified/tickets/epic-unverified/epic-unverified.md": "---\ntype: epic\ntitle: Unverified Epic\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-unverified/tickets/epic-unverified/tickets/tickets.toml": [
          "[[entry]]",
          "id = 1",
          'title = "Backlog Story Without Plan"',
          'status = "backlog"',
          "",
          "[[entry]]",
          "id = 2",
          'title = "Ready Story Without Plan"',
          'status = "ready-for-dev"',
          "",
          "[[entry]]",
          "id = 3",
          'title = "In-Progress Story With In-Progress Plan"',
          'status = "in-progress"'
        ].join("\n") + "\n",
        "_bmad-output/initiative-unverified/tickets/epic-unverified/tickets/plan-1-3-inprogress.md": "---\nticket: 3\nstatus: in-progress\n---\n"
      }
    });

    const result = scanBmadWorkspace(ws.root);
    const epic = result.epics.find((e) => e.slug === "epic-unverified");
    assert.ok(epic);

    // Story 1.1: backlog without plan stays declared-only
    const s1 = epic.stories.find((s) => s.id === "1.1");
    assert.equal(s1.declaredStatus, "backlog");
    assert.equal(s1.smartStatus, "backlog");
    assert.equal(s1.aiReconciled, false);
    assert.equal(s1.smartReason, null);

    // Story 1.2: ready-for-dev stays declared-only
    const s2 = epic.stories.find((s) => s.id === "1.2");
    assert.equal(s2.declaredStatus, "ready");
    assert.equal(s2.smartStatus, "ready");
    assert.equal(s2.aiReconciled, false);
    assert.equal(s2.smartReason, null);

    // Story 1.3: in-progress stays declared-only
    const s3 = epic.stories.find((s) => s.id === "1.3");
    assert.equal(s3.declaredStatus, "in-progress");
    assert.equal(s3.smartStatus, "in-progress");
    assert.equal(s3.aiReconciled, false);
    assert.equal(s3.smartReason, null);

    // Zero smart done stories
    assert.equal(result.metrics.smartDoneStories, 0);
    assert.equal(result.metrics.declaredDoneStories, 0);
    assert.equal(result.metrics.reconciledStoriesCount, 0);
    assert.equal(result.metrics.smartOverallPct, 0);
  });
});

describe("non-destructive reconcile + .bak + audit ledger (Epic 3 Story 3.3)", () => {
  it("dryRun: true simulates reconciliation and leaves disk completely untouched", () => {
    const ws = workspaces.seedDualMetric();

    const yamlRel = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const epicTomlRel = "_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml";
    const rootTomlRel = "_bmad-output/initiative-demo/tickets/tickets.toml";

    const yamlBefore = ws.read(yamlRel);
    const epicTomlBefore = ws.read(epicTomlRel);
    const rootTomlBefore = ws.read(rootTomlRel);

    assert.equal(ws.exists(".zcode"), false, "fresh dual-metric workspace should not have .zcode yet");

    const dryResult = reconcileWorkspaceTrackers(ws.root, { dryRun: true });

    assert.equal(dryResult.dryRun, true);
    assert.equal(dryResult.target, "all");
    assert.equal(dryResult.changesCount, 2);
    assert.deepEqual(dryResult.updatedFiles.sort(), [epicTomlRel, yamlRel].sort());
    assert.equal(dryResult.before.declaredOverallPct, 33);
    assert.equal(dryResult.before.smartOverallPct, 67);
    assert.equal(dryResult.after.declaredOverallPct, 33);
    assert.equal(dryResult.after.smartOverallPct, 67);

    // Disk must remain completely untouched
    assert.equal(ws.read(yamlRel), yamlBefore);
    assert.equal(ws.read(epicTomlRel), epicTomlBefore);
    assert.equal(ws.read(rootTomlRel), rootTomlBefore);
    assert.equal(ws.exists(`${yamlRel}.bak`), false);
    assert.equal(ws.exists(`${epicTomlRel}.bak`), false);
    assert.equal(ws.exists(`${rootTomlRel}.bak`), false);
    assert.equal(ws.exists(".zcode/bmad-companion/reconciliation-log.json"), false);
    assert.equal(ws.exists(".zcode/bmad-companion/state.json"), false);
    assert.equal(ws.exists(".zcode"), false, "dryRun must not even create .zcode directory");
  });

  it("live reconcile creates a .bak per modified file, updates trackers without duplicate keys, and appends audit records", () => {
    const ws = workspaces.seedDualMetric();

    const yamlRel = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const epicTomlRel = "_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml";
    const rootTomlRel = "_bmad-output/initiative-demo/tickets/tickets.toml";

    const yamlOriginal = ws.read(yamlRel);
    const epicTomlOriginal = ws.read(epicTomlRel);

    const liveResult = reconcileWorkspaceTrackers(ws.root, { dryRun: false });

    assert.equal(liveResult.dryRun, false);
    assert.equal(liveResult.changesCount, 2);
    assert.deepEqual(liveResult.updatedFiles.sort(), [epicTomlRel, yamlRel].sort());
    assert.equal(liveResult.before.declaredDoneStories, 1);
    assert.equal(liveResult.before.declaredOverallPct, 33);
    assert.equal(liveResult.after.declaredDoneStories, 2);
    assert.equal(liveResult.after.declaredOverallPct, 67);
    assert.equal(liveResult.after.smartOverallPct, 67);

    // .bak created for each modified file, matching original byte-for-byte
    assert.equal(ws.exists(`${yamlRel}.bak`), true);
    assert.equal(ws.read(`${yamlRel}.bak`), yamlOriginal);
    assert.equal(ws.exists(`${epicTomlRel}.bak`), true);
    assert.equal(ws.read(`${epicTomlRel}.bak`), epicTomlOriginal);

    // Unmodified root tickets.toml must not have a .bak
    assert.equal(ws.exists(`${rootTomlRel}.bak`), false);

    // Updated TOML must not duplicate status lines in [[entry]]
    const updatedToml = ws.read(epicTomlRel);
    const entry1Block = updatedToml.split("[[entry]]")[1];
    const statusMatches = entry1Block.match(/^\s*status\s*=/gm) || [];
    assert.equal(statusMatches.length, 1, "must update status in place without duplicating status line");
    assert.match(entry1Block, /status = "done"/);

    // Audit ledger created with 1 entry
    const logRel = ".zcode/bmad-companion/reconciliation-log.json";
    assert.equal(ws.exists(logRel), true);
    const logAfterFirst = readJsonFile(ws.path(logRel));
    assert.equal(Array.isArray(logAfterFirst), true);
    assert.equal(logAfterFirst.length, 1);
    assert.equal(logAfterFirst[0].dryRun, false);
    assert.equal(logAfterFirst[0].target, "all");
    assert.equal(logAfterFirst[0].backup, true);
    assert.equal(logAfterFirst[0].changesCount, 2);
    assert.deepEqual(logAfterFirst[0].updatedFiles.sort(), [epicTomlRel, yamlRel].sort());
    assert.equal(logAfterFirst[0].changes.length, 2);
    assert.equal(logAfterFirst[0].changes.find((c) => c.type === "v7-tickets").oldStatus, "backlog");

    // Second live reconcile after story 1.2 plan completes -> appends second entry to audit ledger
    ws.write(
      "_bmad-output/initiative-demo/tickets/epic-core/tickets/story-verify-scan-plan.md",
      "---\ntitle: \"Verify Scan Story\"\nticket: 2\nstatus: done\n---\n"
    );
    const secondResult = reconcileWorkspaceTrackers(ws.root, { dryRun: false });
    assert.equal(secondResult.changesCount, 3); // 1-2-verify-scan (yaml + toml) + epic-1 (yaml)
    assert.equal(secondResult.after.declaredDoneStories, 3);
    assert.equal(secondResult.after.declaredOverallPct, 100);

    const logAfterSecond = readJsonFile(ws.path(logRel));
    assert.equal(logAfterSecond.length, 2, "second live reconcile must append a new audit entry");
    assert.equal(logAfterSecond[0].changesCount, 3);
    assert.equal(logAfterSecond[1].changesCount, 2);
  });

  it("preserves comments, indentation, and unrelated keys while updating summary header counters in place", () => {
    const v6OnlyWs = workspaces.create({
      files: {
        "_bmad-output/implementation-artifacts/sprint-status.yaml": [
          "# Sprint Status Tracker",
          "# Completed Stories: 0 of 3",
          "# Remaining Backlog: 3 stories",
          "# Progress: 0% (0/3 stories)",
          "generated: 2026-11-20",
          "last_updated: 2026-11-20 09:00 # preserve header comment",
          "project: keep-unrelated-project",
          "completed_stories: 0",
          "remaining_stories: 3",
          "progress_pct: 0",
          "",
          "development_status:",
          "  # Epic 1 stories",
          "  epic-1: in-progress # epic comment",
          "  1-1-alpha: backlog # keep inline alpha comment",
          "    1-2-indented: backlog # custom 4-space indent",
          "  1-3-gamma: ready-for-dev # unverified ready-for-dev stays untouched",
          "  custom_unrelated_key: custom-value",
          "",
          "notes: keep-bottom-key"
        ].join("\n") + "\n",
        "_bmad-output/implementation-artifacts/1-1-alpha.md": "---\nstatus: done\n---\n",
        "_bmad-output/implementation-artifacts/1-2-indented.md": "---\nstatus: done\n---\n"
      }
    });

    const v6Res = reconcileWorkspaceTrackers(v6OnlyWs.root);
    assert.equal(v6Res.changesCount, 2);

    const updatedYaml = v6OnlyWs.read("_bmad-output/implementation-artifacts/sprint-status.yaml");
    // Header counters updated in place
    assert.match(updatedYaml, /^# Sprint Status Tracker$/m);
    assert.match(updatedYaml, /^# Completed Stories: 2 of 3 \(Reconciled by BMAD Companion\)$/m);
    assert.match(updatedYaml, /^# Remaining Backlog: 1 stories$/m);
    assert.match(updatedYaml, /^# Progress: 67% \(2\/3 stories\)$/m);
    assert.match(updatedYaml, /^completed_stories: 2$/m);
    assert.match(updatedYaml, /^remaining_stories: 1$/m);
    assert.match(updatedYaml, /^progress_pct: 67$/m);
    assert.match(updatedYaml, /^last_updated: \d{4}-\d{2}-\d{2} \d{2}:\d{2} # preserve header comment$/m);

    // Comments, indentation, and unrelated keys preserved
    assert.match(updatedYaml, /^generated: 2026-11-20$/m);
    assert.match(updatedYaml, /^project: keep-unrelated-project$/m);
    assert.match(updatedYaml, /^  # Epic 1 stories$/m);
    assert.match(updatedYaml, /^  epic-1: in-progress # epic comment$/m);
    assert.match(updatedYaml, /^  1-1-alpha: done # keep inline alpha comment$/m);
    assert.match(updatedYaml, /^    1-2-indented: done # custom 4-space indent$/m);
    assert.match(updatedYaml, /^  1-3-gamma: ready-for-dev # unverified ready-for-dev stays untouched$/m);
    assert.match(updatedYaml, /^  custom_unrelated_key: custom-value$/m);
    assert.match(updatedYaml, /^notes: keep-bottom-key$/m);

    // Now test v7 tickets.toml without v6_key: comments, header counters, unrelated keys preserved
    const v7Ws = workspaces.create({
      files: {
        "_bmad-output/initiative-preserve/initiative-preserve.md": "---\ntitle: Preserve\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-preserve/tickets/tickets.toml": '[[epic]]\nid = 1\nslug = "epic-preserve"\ntitle = "Preserve Epic"\n',
        "_bmad-output/initiative-preserve/tickets/epic-preserve/epic-preserve.md": "---\ntype: epic\ntitle: Preserve Epic\nstatus: in-progress\n---\n",
        "_bmad-output/initiative-preserve/tickets/epic-preserve/tickets/tickets.toml": [
          "# Epic Preserve Ticket Ledger",
          "# Completed Stories: 0 of 2",
          "# Remaining Backlog: 2 stories",
          "",
          "[[entry]]",
          "id = 1",
          'title = "Alpha Story"',
          'status = "backlog" # keep toml inline comment',
          'priority_tier = "P0"',
          "",
          "[[entry]]",
          "id = 2",
          'title = "Beta Story"',
          'status = "in-progress" # still active',
          'owner = "maya"'
        ].join("\n") + "\n",
        "_bmad-output/initiative-preserve/tickets/epic-preserve/tickets/plan-1-1-alpha.md": "---\nticket: 1\nstatus: done\n---\n"
      }
    });
    const v7Res = reconcileWorkspaceTrackers(v7Ws.root, { target: "v7-tickets" });
    assert.equal(v7Res.changesCount, 1);

    const updatedToml = v7Ws.read("_bmad-output/initiative-preserve/tickets/epic-preserve/tickets/tickets.toml");
    assert.match(updatedToml, /^# Epic Preserve Ticket Ledger$/m);
    assert.match(updatedToml, /^# Completed Stories: 1 of 2 \(Reconciled by BMAD Companion\)$/m);
    assert.match(updatedToml, /^# Remaining Backlog: 1 stories$/m);
    assert.match(updatedToml, /^status = "done" # keep toml inline comment$/m);
    assert.match(updatedToml, /^priority_tier = "P0"$/m);
    assert.match(updatedToml, /^status = "in-progress" # still active$/m);
    assert.match(updatedToml, /^owner = "maya"$/m);
  });

  it("backup: false skips .bak creation while still updating trackers and audit ledger", () => {
    const ws = workspaces.seedDualMetric();

    const yamlRel = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const epicTomlRel = "_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml";

    const res = reconcileWorkspaceTrackers(ws.root, { dryRun: false, backup: false });

    assert.equal(res.dryRun, false);
    assert.equal(res.changesCount, 2);
    assert.equal(ws.exists(`${yamlRel}.bak`), false, "backup: false must skip YAML .bak");
    assert.equal(ws.exists(`${epicTomlRel}.bak`), false, "backup: false must skip TOML .bak");
    assert.equal(res.after.declaredDoneStories, 2);
    assert.equal(res.after.declaredOverallPct, 67);

    const log = readJsonFile(ws.path(".zcode/bmad-companion/reconciliation-log.json"));
    assert.equal(log.length, 1);
    assert.equal(log[0].backup, false);
    assert.equal(log[0].changesCount, 2);
  });
});

const RECONCILE_RESULT_KEYS = [
  "reconciledAt",
  "dryRun",
  "target",
  "changesCount",
  "updatedFiles",
  "changes",
  "before",
  "after",
  "newScan"
];

function assertReconcileResultShape(result, { dryRun = false, target = "all" } = {}) {
  for (const key of RECONCILE_RESULT_KEYS) {
    assert.ok(key in result, `ReconcileResult missing key "${key}"`);
  }
  assert.equal(typeof result.reconciledAt, "string");
  assert.ok(!Number.isNaN(Date.parse(result.reconciledAt)), "reconciledAt must be an ISO timestamp");
  assert.equal(typeof result.dryRun, "boolean");
  assert.equal(result.dryRun, dryRun);
  assert.equal(typeof result.target, "string");
  assert.equal(result.target, target);
  assert.equal(typeof result.changesCount, "number");
  assert.equal(result.changesCount, result.changes.length);
  assert.ok(Array.isArray(result.updatedFiles));
  assert.ok(Array.isArray(result.changes));

  for (const metricSet of [result.before, result.after]) {
    assert.equal(typeof metricSet, "object");
    assert.equal(typeof metricSet.declaredOverallPct, "number");
    assert.equal(typeof metricSet.smartOverallPct, "number");
    assert.equal(typeof metricSet.declaredDoneStories, "number");
    assert.equal(typeof metricSet.smartDoneStories, "number");
  }

  assert.equal(typeof result.newScan, "object");
  assert.ok(result.newScan !== null);
  assert.ok(Array.isArray(result.newScan.epics));
  assert.equal(typeof result.newScan.metrics, "object");
}

function toolCall(id, name, args = {}) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

describe("reconcile MCP tool contract (Epic 3 Story 3.4)", () => {
  it("returns the flat ReconcileResult shape and Markdown content from bmad_reconcile_trackers over MCP stdio", async () => {
    const ws = workspaces.seedDualMetric();

    const yamlRel = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const tomlRel = "_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml";
    const yamlBefore = ws.read(yamlRel);
    const tomlBefore = ws.read(tomlRel);

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_reconcile_trackers", { dryRun: true, target: "all" })
      ]
    });

    assertStrictJsonRpcStdout(res);
    assert.equal(res.responses.length, 1);
    const frame = res.responses[0];
    assert.equal(frame.id, 1);
    assert.ok(!frame.result.isError, "tool call must not flag isError");
    assert.equal(frame.result.content[0].type, "text");
    assert.match(frame.result.content[0].text, /^# \[DRY RUN\] BMAD Tracker Reconciliation/);
    assert.match(frame.result.content[0].text, /- \*\*Target:\*\* `all`/);
    assert.match(frame.result.content[0].text, /- \*\*Updated Files:\*\* 2 file\(s\)/);
    assert.match(frame.result.content[0].text, /- \*\*Total Status Keys Reconciled:\*\* 2/);

    const structured = frame.result.structuredContent;
    assertReconcileResultShape(structured, { dryRun: true, target: "all" });
    assert.equal(structured.changesCount, 2);
    assert.deepEqual(structured.updatedFiles.sort(), [tomlRel, yamlRel].sort());
    assert.equal(structured.before.declaredOverallPct, 33);
    assert.equal(structured.before.smartOverallPct, 67);
    assert.equal(structured.after.declaredOverallPct, 33);
    assert.equal(structured.after.smartOverallPct, 67);

    // dryRun: true leaves disk untouched
    assert.equal(ws.read(yamlRel), yamlBefore);
    assert.equal(ws.read(tomlRel), tomlBefore);
    assert.equal(ws.exists(`${yamlRel}.bak`), false);
    assert.equal(ws.exists(`${tomlRel}.bak`), false);
    assert.equal(ws.exists(".zcode"), false);
  });

  it("target: 'v6-yaml' modifies only v6 sprint-status.yaml and leaves v7 tickets.toml untouched", async () => {
    const ws = workspaces.seedDualMetric();

    const yamlRel = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const tomlRel = "_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml";
    const yamlBefore = ws.read(yamlRel);
    const tomlBefore = ws.read(tomlRel);

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_reconcile_trackers", { target: "v6-yaml", backup: true })
      ]
    });

    assertStrictJsonRpcStdout(res);
    const frame = res.responses[0];
    assert.ok(!frame.result.isError);
    assert.match(frame.result.content[0].text, /^# BMAD Tracker Reconciliation/);
    assert.match(frame.result.content[0].text, /- \*\*Target:\*\* `v6-yaml`/);

    const structured = frame.result.structuredContent;
    assertReconcileResultShape(structured, { dryRun: false, target: "v6-yaml" });
    assert.equal(structured.target, "v6-yaml");
    assert.equal(structured.changesCount, 1);
    assert.deepEqual(structured.updatedFiles, [yamlRel]);
    assert.ok(structured.changes.every((c) => c.type === "v6-yaml"));
    assert.equal(structured.changes[0].key, "1-1-seed-fixture");
    assert.equal(structured.changes[0].oldStatus, "backlog");
    assert.equal(structured.changes[0].newStatus, "done");

    // sprint-status.yaml was modified and has .bak
    assert.notEqual(ws.read(yamlRel), yamlBefore);
    assert.match(ws.read(yamlRel), /1-1-seed-fixture: done/);
    assert.equal(ws.exists(`${yamlRel}.bak`), true);
    assert.equal(ws.read(`${yamlRel}.bak`), yamlBefore);

    // tickets.toml was NOT touched at all and has NO .bak
    assert.equal(ws.read(tomlRel), tomlBefore);
    assert.equal(ws.exists(`${tomlRel}.bak`), false);
  });

  it("target: 'v7-tickets' modifies only v7 tickets.toml and leaves v6 sprint-status.yaml untouched", async () => {
    const ws = workspaces.seedDualMetric();

    const yamlRel = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const tomlRel = "_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml";
    const yamlBefore = ws.read(yamlRel);
    const tomlBefore = ws.read(tomlRel);

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_reconcile_trackers", { target: "v7-tickets", backup: true })
      ]
    });

    assertStrictJsonRpcStdout(res);
    const frame = res.responses[0];
    assert.ok(!frame.result.isError);
    assert.match(frame.result.content[0].text, /^# BMAD Tracker Reconciliation/);
    assert.match(frame.result.content[0].text, /- \*\*Target:\*\* `v7-tickets`/);

    const structured = frame.result.structuredContent;
    assertReconcileResultShape(structured, { dryRun: false, target: "v7-tickets" });
    assert.equal(structured.target, "v7-tickets");
    assert.equal(structured.changesCount, 1);
    assert.deepEqual(structured.updatedFiles, [tomlRel]);
    assert.ok(structured.changes.every((c) => c.type === "v7-tickets"));
    assert.equal(structured.changes[0].key, "1-1-seed-fixture");
    assert.equal(structured.changes[0].oldStatus, "backlog");
    assert.equal(structured.changes[0].newStatus, "done");

    // tickets.toml was modified and has .bak
    assert.notEqual(ws.read(tomlRel), tomlBefore);
    assert.match(ws.read(tomlRel), /status = "done"/);
    assert.equal(ws.exists(`${tomlRel}.bak`), true);
    assert.equal(ws.read(`${tomlRel}.bak`), tomlBefore);

    // sprint-status.yaml was NOT touched at all and has NO .bak
    assert.equal(ws.read(yamlRel), yamlBefore);
    assert.equal(ws.exists(`${yamlRel}.bak`), false);
  });

  it("target: 'all' (default) modifies both tracker families and honors backup: false", async () => {
    const ws = workspaces.seedDualMetric();

    const yamlRel = "_bmad-output/implementation-artifacts/sprint-status.yaml";
    const tomlRel = "_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml";
    const yamlBefore = ws.read(yamlRel);
    const tomlBefore = ws.read(tomlRel);

    // Calling bmad_reconcile_trackers with backup: false and omitting target (defaults to "all")
    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_reconcile_trackers", { backup: false })
      ]
    });

    assertStrictJsonRpcStdout(res);
    const frame = res.responses[0];
    assert.ok(!frame.result.isError);

    const structured = frame.result.structuredContent;
    assertReconcileResultShape(structured, { dryRun: false, target: "all" });
    assert.equal(structured.target, "all");
    assert.equal(structured.changesCount, 2);
    assert.deepEqual(structured.updatedFiles.sort(), [tomlRel, yamlRel].sort());
    assert.equal(structured.after.declaredDoneStories, 2);
    assert.equal(structured.after.declaredOverallPct, 67);

    // Both files updated on disk
    assert.notEqual(ws.read(yamlRel), yamlBefore);
    assert.notEqual(ws.read(tomlRel), tomlBefore);

    // backup: false -> neither .bak file created
    assert.equal(ws.exists(`${yamlRel}.bak`), false);
    assert.equal(ws.exists(`${tomlRel}.bak`), false);

    // Audit ledger records backup: false
    const log = readJsonFile(ws.path(".zcode/bmad-companion/reconciliation-log.json"));
    assert.equal(log.length, 1);
    assert.equal(log[0].target, "all");
    assert.equal(log[0].backup, false);
    assert.equal(log[0].changesCount, 2);
  });

  it("rejects invalid target with an informative error over MCP stdio", async () => {
    const ws = workspaces.seedDualMetric();

    const res = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_reconcile_trackers", { target: "invalid-target" })
      ]
    });

    assertStrictJsonRpcStdout(res);
    const frame = res.responses[0];
    assert.equal(frame.id, 1);
    assert.equal(frame.result.isError, true);
    assert.equal(frame.result.content[0].type, "text");
    assert.match(
      frame.result.content[0].text,
      /Invalid target 'invalid-target': must be one of 'all', 'v6-yaml', 'v7-tickets'/i
    );
  });
});


