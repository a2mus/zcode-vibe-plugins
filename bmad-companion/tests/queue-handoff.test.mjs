import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import {
  buildTaskSessionLaunchInstructions,
  generateQueueWorkflowFiles,
  loadPersistedState,
  manageBmadTaskQueue,
  savePersistedState,
  scanBmadWorkspace,
  updateAdvisorState
} from "../scripts/bmad-engine.mjs";
import {
  assertSingleJsonObjectStdout,
  createTempWorkspaceTracker,
  readJsonFile,
  runHookRunner
} from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

function addTwoTasks(ws, executionMode = "separate-sessions") {
  return manageBmadTaskQueue(ws.root, {
    action: "add",
    executionMode,
    splitPlanBuild: false,
    items: [
      {
        title: "Story 2.1: Atomic tracer",
        prompt: '/bmad-build-auto "Implement ticket 2.1 atomic tracer"',
        model: "new-provider/model-a",
        reviewMode: "none"
      },
      {
        title: "Story 2.2: Race suite",
        prompt: '/bmad-build-auto "Implement ticket 2.2 race suite"',
        model: "new-provider/model-b",
        reviewMode: "none"
      }
    ]
  });
}

describe("bmad-companion queue handoff chain", () => {
  it("keeps the next task queued until start-task claims it with a sessionId", () => {
    const ws = workspaces.seed();
    const added = addTwoTasks(ws);
    const [first, second] = added.taskQueue.items;

    const engaged = manageBmadTaskQueue(ws.root, {
      action: "start-queue",
      executionMode: "separate-sessions"
    });
    assert.equal(engaged.taskQueue.status, "running");
    assert.equal(engaged.taskQueue.activeTaskId, null);
    assert.ok(
      engaged.taskQueue.items.every((it) => it.status === "queued"),
      "start-queue must not claim a task before a session exists"
    );

    const claimed = manageBmadTaskQueue(ws.root, {
      action: "start-task",
      taskId: first.id,
      sessionId: "sess_unit_1"
    });
    assert.equal(claimed.taskQueue.activeTask?.id, first.id);
    assert.equal(claimed.taskQueue.activeTask?.sessionId, "sess_unit_1");

    const completed = manageBmadTaskQueue(ws.root, {
      action: "complete-task",
      taskId: first.id,
      storyStatus: "done",
      summary: "Task one done"
    });
    assert.equal(completed.taskQueue.items.find((it) => it.id === first.id).status, "done");
    assert.equal(
      completed.taskQueue.items.find((it) => it.id === second.id).status,
      "queued",
      "complete-task must not promote the next task to running"
    );
    assert.equal(completed.taskQueue.activeTaskId, null);
    assert.equal(completed.taskQueue.status, "running");
    assert.equal(completed.taskQueue.nextQueuedTask?.id, second.id);

    const persisted = loadPersistedState(ws.root);
    assert.equal(persisted.taskQueue.items.find((it) => it.id === second.id).status, "queued");
  });

  it("separate-sessions plan starts only the first task and hands off by sessionId", () => {
    const ws = workspaces.seed();
    const added = addTwoTasks(ws);
    const [first, second] = added.taskQueue.items;

    const workflow = generateQueueWorkflowFiles(ws.root, added.taskQueue);
    const prompt = workflow.separateSessionsPrompt;

    assert.ok(prompt.includes(first.model), "must carry the first task model");
    assert.ok(prompt.includes("CreateSession"), "must create the first task session");
    assert.ok(prompt.includes("sessionId"), "must record the created session id");
    assert.ok(prompt.includes("start-task"), "must claim the task via start-task");
    assert.ok(prompt.includes("Do not call WaitSessions"), "must not wait in a long-lived turn");
    assert.equal(
      prompt.includes(second.id),
      false,
      "later tasks must be launched by the chain, not by the first prompt"
    );

    const single = buildTaskSessionLaunchInstructions(first);
    assert.ok(single.includes(JSON.stringify(first.effectivePrompt)));
    assert.ok(single.includes(JSON.stringify(first.id)));
  });

  it("Stop hook completes the active task and hands off to the next queued task", async () => {
    const ws = workspaces.seed();
    const added = addTwoTasks(ws);
    const [first, second] = added.taskQueue.items;

    manageBmadTaskQueue(ws.root, { action: "start-queue", executionMode: "separate-sessions" });
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: first.id, sessionId: "sess_unit_1" });
    savePersistedState(ws.root, { lastUserPrompt: first.effectivePrompt });

    const res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Implemented the atomic tracer and verified the suite." },
      env: { CLAUDE_SESSION_ID: "sess_unit_1" }
    });
    const frame = assertSingleJsonObjectStdout(res);
    assert.equal(frame.decision, "block", "stop hook must request continuation");
    assert.ok(String(frame.reason).includes("queue continuation"));
    assert.ok(String(frame.reason).includes(second.id), "continuation must target the next task");
    assert.ok(String(frame.reason).includes(second.model), "continuation must keep the next task model");
    assert.ok(String(frame.reason).includes("CreateSession"));
    assert.ok(String(frame.reason).includes("sessionId"));

    const state = readJsonFile(ws.statePath);
    assert.equal(state.taskQueue.items.find((it) => it.id === first.id).status, "done");
    assert.equal(state.taskQueue.items.find((it) => it.id === second.id).status, "queued");
    assert.equal(state.taskQueue.activeTaskId, null);
  });

  it("Stop hook ignores a task owned by another session", async () => {
    const ws = workspaces.seed();
    const added = addTwoTasks(ws);
    const [first] = added.taskQueue.items;

    manageBmadTaskQueue(ws.root, { action: "start-queue", executionMode: "separate-sessions" });
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: first.id, sessionId: "sess_owner" });
    savePersistedState(ws.root, { lastUserPrompt: first.effectivePrompt });

    const res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Unrelated turn in a sibling session." },
      env: { CLAUDE_SESSION_ID: "sess_intruder" }
    });
    const frame = assertSingleJsonObjectStdout(res);
    assert.deepEqual(frame, {}, "a non-owning session must not complete or advance the task");

    const state = readJsonFile(ws.statePath);
    assert.equal(
      state.taskQueue.items.find((it) => it.id === first.id).status,
      "running",
      "the owning task must stay running"
    );
  });

  it("Stop hook does not hand off a dynamic-workflow queue", async () => {
    const ws = workspaces.seed();
    const added = addTwoTasks(ws, "dynamic-workflow");
    const [first, second] = added.taskQueue.items;

    manageBmadTaskQueue(ws.root, { action: "start-queue", executionMode: "dynamic-workflow" });
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: first.id });
    savePersistedState(ws.root, { lastUserPrompt: first.effectivePrompt });

    const res = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Implemented the atomic tracer." }
    });
    const frame = assertSingleJsonObjectStdout(res);
    assert.deepEqual(frame, {}, "dynamic-workflow queues must not start session handoffs");

    const state = readJsonFile(ws.statePath);
    assert.equal(state.taskQueue.items.find((it) => it.id === second.id).status, "queued");
  });

  it("queue-step-updater finish clears stale advisor override and refreshes Next Prompts", () => {
    const ws = workspaces.seed();
    const added = addTwoTasks(ws, "dynamic-workflow");
    const [first, second] = added.taskQueue.items;

    savePersistedState(ws.root, {
      agentAdvisorOverride: {
        headline: "Outdated pre-workflow headline",
        turnSummary: "Outdated pre-workflow summary",
        recommendations: [
          {
            skill: "/bmad-build",
            fullCommand: '/bmad-build "Implement ticket 2.1 atomic tracer"',
            title: "Story 2.1: Atomic tracer",
            rationale: "Old pre-workflow recommendation",
            recommendedModel: "new-provider/model-a",
            phase: "4-implementation",
            priority: "high"
          },
          {
            skill: "/bmad-build",
            fullCommand: '/bmad-build "Implement ticket 2.2 race suite"',
            title: "Story 2.2: Race suite",
            rationale: "Second pre-workflow recommendation",
            recommendedModel: "new-provider/model-b",
            phase: "4-implementation",
            priority: "medium"
          }
        ],
        updatedAt: "2026-11-23T10:00:00.000Z"
      }
    });

    const wf = generateQueueWorkflowFiles(ws.root, added.taskQueue);

    // Mid-workflow: completing task 1 prunes task 1's recommendation while keeping task 2
    execFileSync(process.execPath, [wf.updaterRelPath, "start", first.id, ""], { cwd: ws.root });
    execFileSync(process.execPath, [wf.updaterRelPath, "done", first.id, "", "Task 1 verified"], { cwd: ws.root });
    const midState = loadPersistedState(ws.root);
    assert.equal(midState.agentAdvisorOverride.recommendations.length, 1);
    assert.equal(midState.agentAdvisorOverride.recommendations[0].title, "Story 2.2: Race suite");

    // Simulate task 2 still running when finish runs (e.g. partial or final finish step)
    execFileSync(process.execPath, [wf.updaterRelPath, "start", second.id, ""], { cwd: ws.root });
    execFileSync(process.execPath, [wf.updaterRelPath, "finish"], { cwd: ws.root });

    const finalState = loadPersistedState(ws.root);
    assert.equal(finalState.taskQueue.status, "completed");
    assert.equal(finalState.taskQueue.activeTaskId, null);
    assert.equal(finalState.agentAdvisorOverride, null, "finish must clear stale pre-workflow advisor override");
    assert.ok(finalState.lastWorkflowCompletedAt, "finish must stamp lastWorkflowCompletedAt");

    const scan = scanBmadWorkspace(ws.root);
    assert.notEqual(scan.turnAnalysis.aiSummaryHeadline, "Outdated pre-workflow headline");
    assert.ok(
      !scan.recommendations.some((r) => r.title === "Story 2.1: Atomic tracer"),
      "Next Prompts must not keep outdated pre-workflow recommendations"
    );
  });

  it("ignores stale pre-workflow advisor overrides on scan and accepts fresh advisor updates afterward", () => {
    const ws = workspaces.seed();
    ws.write(
      "_bmad-output/initiative-demo/initiative-demo.md",
      "---\ntitle: Demo\nstatus: in-progress\n---\n"
    );
    ws.write(
      "_bmad-output/initiative-demo/tickets.toml",
      '[[epic]]\nid = 2\nslug = "epic-two"\ntitle = "Epic Two"\n'
    );
    ws.write(
      "_bmad-output/initiative-demo/epic-two/epic-two.md",
      "---\ntitle: Epic Two\nstatus: in-progress\n---\n"
    );
    ws.write(
      "_bmad-output/initiative-demo/epic-two/tickets.toml",
      [
        "[[entry]]",
        "id = 1",
        'title = "Done Story"',
        'status = "done"',
        "",
        "[[entry]]",
        "id = 2",
        'title = "Next Open Story"',
        'status = "backlog"'
      ].join("\n")
    );

    // Pre-workflow override persisted before a completed queue
    savePersistedState(ws.root, {
      agentAdvisorOverride: {
        headline: "Yesterday headline",
        turnSummary: "Yesterday summary",
        recommendations: [
          {
            skill: "/bmad-build",
            fullCommand: '/bmad-build "Implement Story 2.1 Done Story"',
            title: "Start Epic 2 Story 2.1",
            rationale: "Stale recommendation for already-done story",
            recommendedModel: "new-provider/model-a"
          }
        ],
        updatedAt: "2026-11-23T22:00:00.000Z"
      },
      taskQueue: {
        status: "completed",
        executionMode: "dynamic-workflow",
        defaultReviewMode: "none",
        activeTaskId: null,
        workflowPath: ".zcode/workflows/bmad-task-queue.dwf.ts",
        updatedAt: "2026-11-24T12:00:00.000Z",
        items: []
      }
    });

    const staleScan = scanBmadWorkspace(ws.root);
    assert.notEqual(staleScan.turnAnalysis.aiSummaryHeadline, "Yesterday headline");
    assert.ok(
      !staleScan.recommendations.some((r) => r.title === "Start Epic 2 Story 2.1"),
      "completed workflow timestamp must invalidate older advisor recommendations"
    );
    assert.ok(
      staleScan.recommendations.some((r) => r.fullCommand.includes("2.2")),
      "fresh workspace scan should recommend the next open story (2.2)"
    );

    // Pushing a fresh advisor update AFTER the workflow completed must be honored,
    // while still filtering any recommendation for an already-done story (2.1).
    const freshScan = updateAdvisorState(ws.root, {
      headline: "Post-workflow fresh headline",
      turnSummary: "Post-workflow fresh summary",
      recommendations: [
        {
          skill: "/bmad-build",
          fullCommand: '/bmad-build "Complete Story 2.1 Done Story"',
          title: "Stale Story 2.1",
          recommendedModel: "new-provider/model-a"
        },
        {
          skill: "/bmad-build",
          fullCommand: '/bmad-build "Complete Story 2.2 Next Open Story"',
          title: "Fresh Story 2.2",
          recommendedModel: "new-provider/model-b"
        }
      ]
    });

    assert.equal(freshScan.turnAnalysis.aiSummaryHeadline, "Post-workflow fresh headline");
    assert.equal(freshScan.turnAnalysis.lastAssistantSummary, "Post-workflow fresh summary");
    assert.ok(!freshScan.recommendations.some((r) => r.title === "Stale Story 2.1"));
    assert.equal(freshScan.recommendations[0].title, "Fresh Story 2.2");
  });

  it("manageBmadTaskQueue complete-task prunes finished recommendations and clears stale override on queue completion", () => {
    const ws = workspaces.seed();
    const added = addTwoTasks(ws, "separate-sessions");
    const [first, second] = added.taskQueue.items;

    savePersistedState(ws.root, {
      agentAdvisorOverride: {
        headline: "Pre-queue headline",
        turnSummary: "Pre-queue summary",
        recommendations: [
          {
            skill: "/bmad-build",
            fullCommand: '/bmad-build "Implement ticket 2.1 atomic tracer"',
            title: "Story 2.1: Atomic tracer",
            recommendedModel: "new-provider/model-a"
          },
          {
            skill: "/bmad-build",
            fullCommand: '/bmad-build "Implement ticket 2.2 race suite"',
            title: "Story 2.2: Race suite",
            recommendedModel: "new-provider/model-b"
          }
        ],
        updatedAt: "2026-11-23T10:00:00.000Z"
      }
    });

    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: first.id });
    const afterFirst = manageBmadTaskQueue(ws.root, {
      action: "complete-task",
      taskId: first.id,
      summary: "Done 2.1"
    });
    assert.ok(
      !afterFirst.scan.recommendations.some((r) => r.title === "Story 2.1: Atomic tracer"),
      "completing task 1 must immediately drop its recommendation"
    );
    assert.ok(
      afterFirst.scan.recommendations.some((r) => r.title === "Story 2.2: Race suite"),
      "remaining queued recommendation stays visible until completed"
    );

    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: second.id });
    const afterSecond = manageBmadTaskQueue(ws.root, {
      action: "complete-task",
      taskId: second.id,
      summary: "Done 2.2"
    });
    assert.equal(afterSecond.taskQueue.status, "completed");
    assert.equal(loadPersistedState(ws.root).agentAdvisorOverride, null);
    assert.notEqual(afterSecond.scan.turnAnalysis.aiSummaryHeadline, "Pre-queue headline");
  });

  it("retry-failed resets one or all failed tasks to queued, clears failure metadata, and regenerates the workflow", () => {
    const ws = workspaces.seed();
    const added = addTwoTasks(ws, "dynamic-workflow");
    const [first, second] = added.taskQueue.items;

    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: first.id, sessionId: "sess_fail_1" });
    manageBmadTaskQueue(ws.root, {
      action: "complete-task",
      taskId: first.id,
      failed: true,
      summary: "Version drift caused validation exit 1"
    });
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: second.id, sessionId: "sess_fail_2" });
    const bothFailed = manageBmadTaskQueue(ws.root, {
      action: "complete-task",
      taskId: second.id,
      failed: true,
      summary: "Timeout during test run"
    });
    assert.equal(bothFailed.taskQueue.counts.failed, 2);
    assert.equal(bothFailed.taskQueue.counts.queued, 0);

    // Single-task retry leaves the other failed task intact
    const retriedOne = manageBmadTaskQueue(ws.root, { action: "retry-failed", taskId: first.id });
    assert.equal(retriedOne.taskQueue.counts.failed, 1);
    assert.equal(retriedOne.taskQueue.counts.queued, 1);
    assert.equal(retriedOne.taskQueue.status, "idle");
    const resetFirst = retriedOne.taskQueue.items.find((it) => it.id === first.id);
    assert.equal(resetFirst.status, "queued");
    assert.equal(resetFirst.resultSummary, null);
    assert.equal(resetFirst.completedAt, null);
    assert.equal(resetFirst.sessionId, null);
    assert.ok(retriedOne.generatedWorkflow, "retrying a failed task regenerates the queue workflow");

    // Bulk retry resets all remaining failed tasks
    const retriedAll = manageBmadTaskQueue(ws.root, { action: "retry-failed" });
    assert.equal(retriedAll.taskQueue.counts.failed, 0);
    assert.equal(retriedAll.taskQueue.counts.queued, 2);
    const resetSecond = retriedAll.taskQueue.items.find((it) => it.id === second.id);
    assert.equal(resetSecond.status, "queued");
    assert.equal(resetSecond.resultSummary, null);
  });

  it("chains Plan (Planner model) -> Stop hook ('in-progress') -> Build (Coder model) -> Stop hook ('done') without storyId collision", async () => {
    const ws = workspaces.seed();
    const added = manageBmadTaskQueue(ws.root, {
      action: "add-epic",
      epicSlug: "epic-core",
      includeDone: false,
      executionMode: "separate-sessions",
      plannerModel: "new-provider/claude-opus-5-5-high",
      builderModel: "new-provider/claude-sonnet-5-5-high"
    });
    assert.equal(added.taskQueue.items.length, 2);
    const [planTask, buildTask] = added.taskQueue.items;

    // 1. UserPromptSubmit with Build prompt must NOT auto-start the queued Plan task despite shared storyId
    const wrongPromptRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      env: { CLAUDE_SESSION_ID: "sess_wrong" },
      payload: { prompt: buildTask.effectivePrompt }
    });
    assertSingleJsonObjectStdout(wrongPromptRes);
    const stateAfterBuildPrompt = loadPersistedState(ws.root);
    assert.equal(stateAfterBuildPrompt.taskQueue.items[0].status, "queued", "build prompt must not claim plan task");
    assert.equal(stateAfterBuildPrompt.taskQueue.items[1].status, "running", "build prompt claims build task only");

    // Reset buildTask back to queued and test the true Plan -> Build handoff sequence
    manageBmadTaskQueue(ws.root, { action: "update-item", taskId: buildTask.id, status: "queued" });
    manageBmadTaskQueue(ws.root, { action: "start-queue", executionMode: "separate-sessions" });

    const upPlanRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      env: { CLAUDE_SESSION_ID: "sess_planner_1" },
      payload: { prompt: planTask.effectivePrompt }
    });
    assertSingleJsonObjectStdout(upPlanRes);
    assert.equal(loadPersistedState(ws.root).taskQueue.activeTaskId, planTask.id);

    const stopPlanRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      env: { CLAUDE_SESSION_ID: "sess_planner_1" },
      payload: { last_assistant_message: "Wrote ready-for-dev plan and halted." }
    });
    const planStopFrame = assertSingleJsonObjectStdout(stopPlanRes);
    assert.equal(planStopFrame.decision, "block");
    assert.ok(planStopFrame.reason.includes(buildTask.id));
    assert.ok(planStopFrame.reason.includes("new-provider/claude-sonnet-5-5-high"));

    const midState = loadPersistedState(ws.root);
    assert.equal(midState.storyOverrides[planTask.overrideKey]?.status, "in-progress", "completing Plan step must leave story in-progress");

    // 2. Now run Build session and finish it -> marks story done and completes queue
    const upBuildRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      env: { CLAUDE_SESSION_ID: "sess_builder_1" },
      payload: { prompt: buildTask.effectivePrompt }
    });
    assertSingleJsonObjectStdout(upBuildRes);
    assert.equal(loadPersistedState(ws.root).taskQueue.activeTaskId, buildTask.id);

    const stopBuildRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      env: { CLAUDE_SESSION_ID: "sess_builder_1" },
      payload: { last_assistant_message: "Implemented and verified Story 1.2." }
    });
    const buildStopFrame = assertSingleJsonObjectStdout(stopBuildRes);
    assert.deepEqual(buildStopFrame, {});

    const finalState = loadPersistedState(ws.root);
    assert.equal(finalState.taskQueue.status, "completed");
    assert.equal(finalState.storyOverrides[buildTask.overrideKey]?.status, "done");
  });
});