import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  buildEffectiveTaskPrompt,
  buildTaskQueueView,
  generateQueueWorkflowFiles,
  loadPersistedState,
  manageBmadTaskQueue,
  savePersistedState,
  scanBmadWorkspace
} from "../scripts/bmad-engine.mjs";
import {
  assertStrictJsonRpcStdout,
  createTempWorkspaceTracker,
  readJsonFile,
  runMcpServer
} from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

describe("Epic 5 Story 5.1: Queue lifecycle tracer (add -> start-task -> complete-task -> get)", () => {
  it("drives add -> start-task -> complete-task -> get through queued -> running -> done with state persisted via savePersistedState", () => {
    const ws = workspaces.seed();

    // 1. ADD
    const addResult = manageBmadTaskQueue(ws.root, {
      action: "add",
      item: {
        id: "task-tracer-1",
        title: "Story 5.1: Queue lifecycle tracer",
        prompt: '/bmad-build-auto "Implement ticket 5.1 queue tracer"',
        model: "new-provider/claude-sonnet-5-5-high",
        reviewMode: "none"
      }
    });

    assert.equal(addResult.action, "add");
    assert.equal(addResult.taskQueue.status, "idle");
    assert.equal(addResult.taskQueue.counts.total, 1);
    assert.equal(addResult.taskQueue.counts.queued, 1);
    assert.equal(addResult.taskQueue.counts.running, 0);
    assert.equal(addResult.taskQueue.counts.done, 0);
    assert.equal(addResult.taskQueue.counts.progressPct, 0);
    assert.equal(addResult.taskQueue.activeTaskId, null);
    assert.equal(addResult.taskQueue.activeTask, null);
    assert.equal(addResult.taskQueue.nextQueuedTask?.id, "task-tracer-1");

    const queuedItem = addResult.taskQueue.items[0];
    assert.equal(queuedItem.id, "task-tracer-1");
    assert.equal(queuedItem.title, "Story 5.1: Queue lifecycle tracer");
    assert.equal(queuedItem.status, "queued");
    assert.equal(queuedItem.model, "new-provider/claude-sonnet-5-5-high");
    assert.equal(queuedItem.modelShort, "claude-sonnet-5-5-high");
    assert.equal(queuedItem.reviewMode, "none");
    assert.equal(queuedItem.startedAt, null);
    assert.equal(queuedItem.completedAt, null);
    assert.equal(queuedItem.resultSummary, null);

    // Verify persisted state after add
    const persistedAfterAdd = readJsonFile(ws.statePath);
    assert.equal(persistedAfterAdd.taskQueue.items.length, 1);
    assert.equal(persistedAfterAdd.taskQueue.items[0].id, "task-tracer-1");
    assert.equal(persistedAfterAdd.taskQueue.items[0].status, "queued");
    assert.equal(persistedAfterAdd.taskQueue.activeTaskId, null);

    // 2. START-TASK
    const startResult = manageBmadTaskQueue(ws.root, {
      action: "start-task",
      taskId: "task-tracer-1",
      sessionId: "session-tracer-001"
    });

    assert.equal(startResult.action, "start-task");
    assert.equal(startResult.taskQueue.status, "running");
    assert.equal(startResult.taskQueue.counts.total, 1);
    assert.equal(startResult.taskQueue.counts.queued, 0);
    assert.equal(startResult.taskQueue.counts.running, 1);
    assert.equal(startResult.taskQueue.counts.done, 0);
    assert.equal(startResult.taskQueue.activeTaskId, "task-tracer-1");
    assert.equal(startResult.taskQueue.activeTask?.id, "task-tracer-1");
    assert.equal(startResult.taskQueue.activeTask?.status, "running");
    assert.equal(startResult.taskQueue.activeTask?.sessionId, "session-tracer-001");
    assert.ok(typeof startResult.taskQueue.activeTask?.startedAt === "string");
    assert.equal(startResult.taskQueue.nextQueuedTask, null);

    // Verify persisted state after start-task
    const persistedAfterStart = readJsonFile(ws.statePath);
    assert.equal(persistedAfterStart.taskQueue.activeTaskId, "task-tracer-1");
    assert.equal(persistedAfterStart.taskQueue.items[0].status, "running");
    assert.equal(persistedAfterStart.taskQueue.items[0].sessionId, "session-tracer-001");
    assert.ok(typeof persistedAfterStart.taskQueue.items[0].startedAt === "string");

    // 3. COMPLETE-TASK
    const completeResult = manageBmadTaskQueue(ws.root, {
      action: "complete-task",
      taskId: "task-tracer-1",
      summary: "Lifecycle tracer verified: queued -> running -> done"
    });

    assert.equal(completeResult.action, "complete-task");
    assert.equal(completeResult.taskQueue.status, "completed");
    assert.equal(completeResult.taskQueue.counts.total, 1);
    assert.equal(completeResult.taskQueue.counts.queued, 0);
    assert.equal(completeResult.taskQueue.counts.running, 0);
    assert.equal(completeResult.taskQueue.counts.done, 1);
    assert.equal(completeResult.taskQueue.counts.progressPct, 100);
    assert.equal(completeResult.taskQueue.activeTaskId, null);
    assert.equal(completeResult.taskQueue.activeTask, null);

    const doneItem = completeResult.taskQueue.items[0];
    assert.equal(doneItem.status, "done");
    assert.equal(doneItem.resultSummary, "Lifecycle tracer verified: queued -> running -> done");
    assert.ok(typeof doneItem.completedAt === "string");

    // Verify persisted state after complete-task
    const persistedAfterComplete = readJsonFile(ws.statePath);
    assert.equal(persistedAfterComplete.taskQueue.status, "completed");
    assert.equal(persistedAfterComplete.taskQueue.activeTaskId, null);
    assert.equal(persistedAfterComplete.taskQueue.items[0].status, "done");
    assert.equal(
      persistedAfterComplete.taskQueue.items[0].resultSummary,
      "Lifecycle tracer verified: queued -> running -> done"
    );
    assert.ok(typeof persistedAfterComplete.taskQueue.items[0].completedAt === "string");

    // 4. GET
    const getExplicit = manageBmadTaskQueue(ws.root, { action: "get" });
    assert.equal(getExplicit.action, "get");
    assert.equal(getExplicit.taskQueue.status, "completed");
    assert.equal(getExplicit.taskQueue.counts.done, 1);
    assert.equal(getExplicit.taskQueue.counts.progressPct, 100);
    assert.equal(getExplicit.taskQueue.items[0].status, "done");

    // Default action without options also returns the persisted queue view
    const getDefault = manageBmadTaskQueue(ws.root);
    assert.equal(getDefault.action, "get");
    assert.equal(getDefault.taskQueue.status, "completed");
    assert.equal(getDefault.taskQueue.items[0].id, "task-tracer-1");
    assert.equal(getDefault.taskQueue.items[0].status, "done");

    // Fresh workspace scan directly reads persisted state and renders matching view
    const freshScan = scanBmadWorkspace(ws.root);
    assert.equal(freshScan.taskQueue.status, "completed");
    assert.equal(freshScan.taskQueue.counts.done, 1);
    assert.equal(freshScan.taskQueue.counts.progressPct, 100);
    assert.equal(freshScan.taskQueue.items[0].id, "task-tracer-1");
    assert.equal(freshScan.taskQueue.items[0].status, "done");
  });

  it("drives a multi-task lifecycle and keeps subsequent tasks queued while running task 1", () => {
    const ws = workspaces.seed();

    // Add two tasks via options.items
    const added = manageBmadTaskQueue(ws.root, {
      action: "add",
      items: [
        {
          id: "step-1",
          title: "Step 1: Setup infrastructure",
          prompt: '/bmad-build-auto "Setup infrastructure"',
          model: "new-provider/gemini-4-argon-high",
          reviewMode: "quick"
        },
        {
          id: "step-2",
          title: "Step 2: Implement core logic",
          prompt: '/bmad-build-auto "Implement core logic"',
          model: "new-provider/claude-sonnet-5-5-high",
          reviewMode: "thorough"
        }
      ]
    });

    assert.equal(added.taskQueue.counts.total, 2);
    assert.equal(added.taskQueue.counts.queued, 2);
    assert.equal(added.taskQueue.counts.running, 0);
    assert.equal(added.taskQueue.counts.done, 0);
    assert.equal(added.taskQueue.nextQueuedTask?.id, "step-1");

    // Start task 1
    const started1 = manageBmadTaskQueue(ws.root, { action: "start-task", taskId: "step-1" });
    assert.equal(started1.taskQueue.status, "running");
    assert.equal(started1.taskQueue.activeTaskId, "step-1");
    assert.equal(started1.taskQueue.counts.running, 1);
    assert.equal(started1.taskQueue.counts.queued, 1);
    assert.equal(started1.taskQueue.nextQueuedTask?.id, "step-2");

    // Complete task 1 - queue must stay 'running' because step-2 is still queued
    const completed1 = manageBmadTaskQueue(ws.root, { action: "complete-task", taskId: "step-1" });
    assert.equal(completed1.taskQueue.status, "running");
    assert.equal(completed1.taskQueue.activeTaskId, null);
    assert.equal(completed1.taskQueue.counts.done, 1);
    assert.equal(completed1.taskQueue.counts.queued, 1);
    assert.equal(completed1.taskQueue.counts.progressPct, 50);
    assert.equal(completed1.taskQueue.items.find((i) => i.id === "step-1").status, "done");
    assert.equal(completed1.taskQueue.items.find((i) => i.id === "step-2").status, "queued");
    assert.equal(completed1.taskQueue.nextQueuedTask?.id, "step-2");

    // Verify disk state intermediate checkpoint
    const diskState = loadPersistedState(ws.root);
    assert.equal(diskState.taskQueue.items.find((i) => i.id === "step-1").status, "done");
    assert.equal(diskState.taskQueue.items.find((i) => i.id === "step-2").status, "queued");

    // Start task 2 using nextQueuedTask auto-selection (omitting taskId)
    const started2 = manageBmadTaskQueue(ws.root, { action: "start-task" });
    assert.equal(started2.taskQueue.activeTaskId, "step-2");
    assert.equal(started2.taskQueue.counts.running, 1);
    assert.equal(started2.taskQueue.counts.queued, 0);

    // Complete task 2 using activeTaskId auto-selection (omitting taskId)
    const completed2 = manageBmadTaskQueue(ws.root, { action: "complete-task" });
    assert.equal(completed2.taskQueue.status, "completed");
    assert.equal(completed2.taskQueue.counts.total, 2);
    assert.equal(completed2.taskQueue.counts.done, 2);
    assert.equal(completed2.taskQueue.counts.queued, 0);
    assert.equal(completed2.taskQueue.counts.progressPct, 100);
    assert.equal(completed2.taskQueue.activeTaskId, null);

    // Get returns both completed
    const getRes = manageBmadTaskQueue(ws.root, { action: "get" });
    assert.ok(getRes.taskQueue.items.every((it) => it.status === "done"));
  });

  it("synchronizes storyOverrides on start-task and complete-task when overrideKey is present", () => {
    const ws = workspaces.seed();

    // Add a task tied to a workspace story via overrideKey
    manageBmadTaskQueue(ws.root, {
      action: "add",
      item: {
        id: "task-story-sync",
        title: "Seed Fixture Story Implementation",
        prompt: '/bmad-build-auto "Implement ticket 1.1"',
        overrideKey: "epic-core#1",
        storyId: 1
      }
    });

    // On start-task, storyOverrides must be updated to in-progress
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: "task-story-sync" });
    const stateInFlight = loadPersistedState(ws.root);
    assert.ok(stateInFlight.storyOverrides["epic-core#1"]);
    assert.equal(stateInFlight.storyOverrides["epic-core#1"].status, "in-progress");
    assert.ok(stateInFlight.storyOverrides["epic-core#1"].reason.includes("Task Queue"));

    // On complete-task, storyOverrides must be updated to done
    manageBmadTaskQueue(ws.root, {
      action: "complete-task",
      taskId: "task-story-sync",
      storyStatus: "done",
      summary: "Verified 1.1 with passing tests"
    });
    const stateDone = loadPersistedState(ws.root);
    assert.equal(stateDone.storyOverrides["epic-core#1"].status, "done");
    assert.equal(stateDone.storyOverrides["epic-core#1"].reason, "Verified 1.1 with passing tests");
    assert.ok(typeof stateDone.storyOverrides["epic-core#1"].updatedAt === "string");
  });

  it("buildTaskQueueView computes counts, effectivePrompt, modelShort, and handles empty raw queue gracefully", () => {
    // Empty raw queue returns safe default idle view
    const emptyView = buildTaskQueueView(null, [], []);
    assert.equal(emptyView.status, "idle");
    assert.equal(emptyView.executionMode, "dynamic-workflow");
    assert.equal(emptyView.defaultReviewMode, "none");
    assert.equal(emptyView.activeTaskId, null);
    assert.equal(emptyView.activeTask, null);
    assert.equal(emptyView.nextQueuedTask, null);
    assert.deepEqual(emptyView.items, []);
    assert.deepEqual(emptyView.counts, {
      total: 0,
      running: 0,
      queued: 0,
      done: 0,
      failed: 0,
      progressPct: 0
    });

    // View with queued item compiles effectivePrompt and modelShort
    const populatedView = buildTaskQueueView(
      {
        status: "idle",
        executionMode: "separate-sessions",
        defaultReviewMode: "quick",
        items: [
          {
            id: "q-1",
            title: "Task 1",
            prompt: '/bmad-build-auto "Task 1 work"',
            model: "provider-xyz/deep-reasoner-pro",
            reviewMode: "quick",
            status: "queued"
          }
        ]
      },
      [],
      [{ id: "provider-xyz/deep-reasoner-pro", current: true }]
    );

    assert.equal(populatedView.items.length, 1);
    assert.equal(populatedView.items[0].modelShort, "deep-reasoner-pro");
    assert.ok(
      populatedView.items[0].effectivePrompt.includes("single self-review pass"),
      "quick reviewMode must shape prompt with quick review instructions"
    );
    assert.equal(populatedView.counts.total, 1);
    assert.equal(populatedView.counts.queued, 1);
  });

  it("supports top-level options in add action for caller ergonomics", () => {
    const ws = workspaces.seed();

    const result = manageBmadTaskQueue(ws.root, {
      action: "add",
      id: "direct-add-1",
      title: "Direct Task",
      prompt: '/bmad-build-auto "Direct task prompt"',
      model: "new-provider/model-ergonomic"
    });

    assert.equal(result.taskQueue.items.length, 1);
    assert.equal(result.taskQueue.items[0].id, "direct-add-1");
    assert.equal(result.taskQueue.items[0].title, "Direct Task");
    assert.equal(result.taskQueue.items[0].status, "queued");

    const onDisk = loadPersistedState(ws.root);
    assert.equal(onDisk.taskQueue.items[0].id, "direct-add-1");
  });
});

describe("Epic 5 Story 5.2: 14-action queue contract + per-task model/reviewMode/executionMode", () => {
  it("supports per-task model, reviewMode (none|quick|thorough), and update-item without mutating queue defaults", () => {
    const ws = workspaces.seed();

    // 1. add with heterogeneous per-task models and reviewModes
    const added = manageBmadTaskQueue(ws.root, {
      action: "add",
      items: [
        {
          id: "t-none",
          title: "Task None",
          prompt: '/bmad-build-auto "Task None"',
          model: "provider-a/economy-model",
          reviewMode: "none"
        },
        {
          id: "t-quick",
          title: "Task Quick",
          prompt: '/bmad-build-auto "Task Quick"',
          model: "provider-b/standard-model",
          reviewMode: "quick"
        },
        {
          id: "t-thorough",
          title: "Task Thorough",
          prompt: '/bmad-build-auto "Task Thorough"',
          model: "provider-c/premium-model",
          reviewMode: "thorough"
        }
      ]
    });

    assert.equal(added.action, "add");
    assert.equal(added.taskQueue.defaultReviewMode, "none");
    assert.equal(added.taskQueue.executionMode, "dynamic-workflow");
    assert.deepEqual(
      added.taskQueue.items.map((it) => [it.id, it.model, it.reviewMode]),
      [
        ["t-none", "provider-a/economy-model", "none"],
        ["t-quick", "provider-b/standard-model", "quick"],
        ["t-thorough", "provider-c/premium-model", "thorough"]
      ]
    );

    // 2. update-item updates a single task's model, reviewMode, prompt, and status without altering defaultReviewMode
    const updated = manageBmadTaskQueue(ws.root, {
      action: "update-item",
      taskId: "t-none",
      model: "provider-d/updated-model",
      reviewMode: "thorough",
      prompt: '/bmad-build-auto "Updated Task None"',
      status: "skipped"
    });

    assert.equal(updated.action, "update-item");
    assert.equal(updated.taskQueue.defaultReviewMode, "none", "update-item must not mutate queue defaultReviewMode");
    const updatedItem = updated.taskQueue.items.find((it) => it.id === "t-none");
    assert.equal(updatedItem.model, "provider-d/updated-model");
    assert.equal(updatedItem.modelShort, "updated-model");
    assert.equal(updatedItem.reviewMode, "thorough");
    assert.equal(updatedItem.prompt, '/bmad-build-auto "Updated Task None"');
    assert.equal(updatedItem.status, "skipped");

    // Resetting skipped/done item back to queued via update-item works
    const requeued = manageBmadTaskQueue(ws.root, {
      action: "update-item",
      taskId: "t-none",
      status: "queued"
    });
    assert.equal(requeued.taskQueue.items.find((it) => it.id === "t-none").status, "queued");
  });

  it("handles set-review-mode with applyToAll true vs false and skips done items", () => {
    const ws = workspaces.seed();

    manageBmadTaskQueue(ws.root, {
      action: "add",
      items: [
        { id: "rev-1", title: "One", prompt: '/bmad-build-auto "One"', reviewMode: "none" },
        { id: "rev-2", title: "Two", prompt: '/bmad-build-auto "Two"', reviewMode: "quick" },
        { id: "rev-3", title: "Three", prompt: '/bmad-build-auto "Three"', reviewMode: "none" }
      ]
    });

    // Complete rev-1 so we can verify done tasks retain their historical reviewMode
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: "rev-1" });
    manageBmadTaskQueue(ws.root, { action: "complete-task", taskId: "rev-1" });

    // applyToAll: false changes only defaultReviewMode, leaving queued tasks untouched
    const defaultOnly = manageBmadTaskQueue(ws.root, {
      action: "set-review-mode",
      reviewMode: "thorough",
      applyToAll: false
    });
    assert.equal(defaultOnly.action, "set-review-mode");
    assert.equal(defaultOnly.taskQueue.defaultReviewMode, "thorough");
    assert.equal(defaultOnly.taskQueue.items.find((it) => it.id === "rev-2").reviewMode, "quick");
    assert.equal(defaultOnly.taskQueue.items.find((it) => it.id === "rev-3").reviewMode, "none");

    // applyToAll: true updates every non-done task (and preserves done task rev-1)
    const appliedAll = manageBmadTaskQueue(ws.root, {
      action: "set-review-mode",
      reviewMode: "quick",
      applyToAll: true
    });
    assert.equal(appliedAll.taskQueue.defaultReviewMode, "quick");
    assert.equal(appliedAll.taskQueue.items.find((it) => it.id === "rev-1").reviewMode, "none");
    assert.equal(appliedAll.taskQueue.items.find((it) => it.id === "rev-2").reviewMode, "quick");
    assert.equal(appliedAll.taskQueue.items.find((it) => it.id === "rev-3").reviewMode, "quick");

    // Invalid reviewMode is ignored without clobbering current defaultReviewMode
    const invalidIgnored = manageBmadTaskQueue(ws.root, {
      action: "set-review-mode",
      reviewMode: "invalid-mode",
      applyToAll: true
    });
    assert.equal(invalidIgnored.taskQueue.defaultReviewMode, "quick");
    assert.equal(invalidIgnored.taskQueue.items.find((it) => it.id === "rev-2").reviewMode, "quick");
  });

  it("handles set-execution-mode (dynamic-workflow | separate-sessions) and add-epic with includeDone", () => {
    const ws = workspaces.seed(); // Story 1 is smartStatus=done, Story 2 is smartStatus=in-progress

    // 1. set-execution-mode switches to separate-sessions and preserves across invalid values
    const execSep = manageBmadTaskQueue(ws.root, {
      action: "set-execution-mode",
      executionMode: "separate-sessions"
    });
    assert.equal(execSep.action, "set-execution-mode");
    assert.equal(execSep.taskQueue.executionMode, "separate-sessions");

    const execInvalid = manageBmadTaskQueue(ws.root, {
      action: "set-execution-mode",
      executionMode: "bogus-mode"
    });
    assert.equal(execInvalid.taskQueue.executionMode, "separate-sessions");

    // 2. add-epic with includeDone: false queues only open stories (Story 1.2)
    const epicOpenOnly = manageBmadTaskQueue(ws.root, {
      action: "add-epic",
      epicSlug: "epic-core",
      includeDone: false,
      model: "new-provider/epic-model"
    });
    assert.equal(epicOpenOnly.action, "add-epic");
    assert.equal(epicOpenOnly.taskQueue.items.length, 1);
    assert.equal(epicOpenOnly.taskQueue.items[0].storyId, "1.2");
    assert.equal(epicOpenOnly.taskQueue.items[0].model, "new-provider/epic-model");
    assert.equal(epicOpenOnly.taskQueue.items[0].status, "queued");

    // 3. add-epic with includeDone: true enqueues done stories too as queued
    const epicWithDone = manageBmadTaskQueue(ws.root, {
      action: "add-epic",
      epicSlug: "epic-core",
      includeDone: true,
      reviewMode: "quick"
    });
    assert.equal(epicWithDone.taskQueue.items.length, 2);
    const story1Item = epicWithDone.taskQueue.items.find((it) => it.storyId === "1.1");
    const story2Item = epicWithDone.taskQueue.items.find((it) => it.storyId === "1.2");
    assert.ok(story1Item, "includeDone: true must enqueue Story 1.1");
    assert.ok(story2Item, "includeDone: true must keep Story 1.2");
    assert.equal(story1Item.status, "queued", "explicitly force-queued done story must remain queued");
    assert.equal(story1Item.reviewMode, "quick");

    // Switch back to dynamic-workflow
    const execDwf = manageBmadTaskQueue(ws.root, {
      action: "set-execution-mode",
      executionMode: "dynamic-workflow"
    });
    assert.equal(execDwf.taskQueue.executionMode, "dynamic-workflow");
  });

  it("handles reorder (up/down + boundaries), remove, clear (onlyCompleted vs all), start-queue, pause-queue, and generate-workflow", () => {
    const ws = workspaces.seed();

    manageBmadTaskQueue(ws.root, {
      action: "add",
      items: [
        { id: "q-1", title: "First", prompt: '/bmad-build-auto "First"' },
        { id: "q-2", title: "Second", prompt: '/bmad-build-auto "Second"' },
        { id: "q-3", title: "Third", prompt: '/bmad-build-auto "Third"' }
      ]
    });

    // Reorder: move q-3 up -> [q-1, q-3, q-2]
    const moveUp = manageBmadTaskQueue(ws.root, { action: "reorder", taskId: "q-3", direction: "up" });
    assert.equal(moveUp.action, "reorder");
    assert.deepEqual(
      moveUp.taskQueue.items.map((it) => [it.id, it.order]),
      [
        ["q-1", 1],
        ["q-3", 2],
        ["q-2", 3]
      ]
    );

    // Reorder: move q-1 down -> [q-3, q-1, q-2]
    const moveDown = manageBmadTaskQueue(ws.root, { action: "reorder", taskId: "q-1", direction: "down" });
    assert.deepEqual(
      moveDown.taskQueue.items.map((it) => it.id),
      ["q-3", "q-1", "q-2"]
    );

    // Boundary no-ops: moving first up or last down does not change order
    const topNoop = manageBmadTaskQueue(ws.root, { action: "reorder", taskId: "q-3", direction: "up" });
    const botNoop = manageBmadTaskQueue(ws.root, { action: "reorder", taskId: "q-2", direction: "down" });
    assert.deepEqual(topNoop.taskQueue.items.map((it) => it.id), ["q-3", "q-1", "q-2"]);
    assert.deepEqual(botNoop.taskQueue.items.map((it) => it.id), ["q-3", "q-1", "q-2"]);

    // generate-workflow writes .dwf.ts and step-updater without changing idle status
    const genRes = manageBmadTaskQueue(ws.root, { action: "generate-workflow" });
    assert.equal(genRes.action, "generate-workflow");
    assert.equal(genRes.taskQueue.status, "idle");
    assert.ok(genRes.generatedWorkflow);
    assert.equal(genRes.generatedWorkflow.tasksCount, 3);
    assert.equal(ws.exists(".zcode/workflows/bmad-task-queue.dwf.ts"), true);
    assert.equal(ws.exists(".zcode/bmad-companion/queue-step-updater.mjs"), true);

    // start-queue engages queue (running) and returns generatedWorkflow without claiming a task
    const startedQueue = manageBmadTaskQueue(ws.root, { action: "start-queue" });
    assert.equal(startedQueue.action, "start-queue");
    assert.equal(startedQueue.taskQueue.status, "running");
    assert.equal(startedQueue.taskQueue.activeTaskId, null);
    assert.ok(startedQueue.generatedWorkflow);

    // start-task claims q-3, then pause-queue resets q-3 back to queued and pauses queue
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: "q-3" });
    const paused = manageBmadTaskQueue(ws.root, { action: "pause-queue" });
    assert.equal(paused.action, "pause-queue");
    assert.equal(paused.taskQueue.status, "paused");
    assert.equal(paused.taskQueue.activeTaskId, null);
    assert.equal(paused.taskQueue.counts.running, 0);
    assert.equal(paused.taskQueue.counts.queued, 3);
    assert.equal(paused.taskQueue.items.find((it) => it.id === "q-3").status, "queued");

    // remove drops q-1; if active task is removed, activeTaskId clears
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: "q-1" });
    const removedActive = manageBmadTaskQueue(ws.root, { action: "remove", taskId: "q-1" });
    assert.equal(removedActive.action, "remove");
    assert.equal(removedActive.taskQueue.activeTaskId, null);
    assert.deepEqual(removedActive.taskQueue.items.map((it) => it.id), ["q-3", "q-2"]);

    // Complete q-3, then clear with onlyCompleted: true leaves q-2
    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: "q-3" });
    manageBmadTaskQueue(ws.root, { action: "complete-task", taskId: "q-3" });
    const clearedDone = manageBmadTaskQueue(ws.root, { action: "clear", onlyCompleted: true });
    assert.equal(clearedDone.action, "clear");
    assert.deepEqual(clearedDone.taskQueue.items.map((it) => it.id), ["q-2"]);

    // clear with onlyCompleted: false empties the queue and resets status to idle
    const clearedAll = manageBmadTaskQueue(ws.root, { action: "clear", onlyCompleted: false });
    assert.equal(clearedAll.action, "clear");
    assert.equal(clearedAll.taskQueue.status, "idle");
    assert.equal(clearedAll.taskQueue.activeTaskId, null);
    assert.deepEqual(clearedAll.taskQueue.items, []);

    // get confirms persisted empty idle queue
    const finalGet = manageBmadTaskQueue(ws.root, { action: "get" });
    assert.equal(finalGet.action, "get");
    assert.equal(finalGet.taskQueue.status, "idle");
    assert.equal(finalGet.taskQueue.items.length, 0);
  });
});

describe("Epic 5 Story 5.3: Review-mode prompt shaping (none/quick/thorough)", () => {
  it("compiles effectivePrompt per reviewMode (none: oneshot+deterministic, quick: oneshot+self-review, thorough: multi-lens gate)", () => {
    // 1. none: oneshot + deterministic verification only
    const promptNone = buildEffectiveTaskPrompt({
      prompt: '/bmad-build "Implement user authentication with bcrypt and unit tests"',
      reviewMode: "none"
    });
    assert.ok(promptNone.startsWith('/bmad-build-auto "Implement user authentication with bcrypt and unit tests'));
    assert.ok(promptNone.includes("(route: oneshot, review: none — skip review lenses, run deterministic verification commands only)"));
    assert.ok(promptNone.includes("oneshot"));
    assert.ok(promptNone.includes("deterministic verification commands only"));
    assert.equal(promptNone.includes("self-review"), false);
    assert.equal(promptNone.includes("multi-lens"), false);
    assert.equal(promptNone.endsWith('"'), true);

    // 2. quick: oneshot + single self-review pass
    const promptQuick = buildEffectiveTaskPrompt({
      prompt: '/bmad-build "Implement user authentication with bcrypt and unit tests"',
      reviewMode: "quick"
    });
    assert.ok(promptQuick.startsWith('/bmad-build-auto "Implement user authentication with bcrypt and unit tests'));
    assert.ok(promptQuick.includes("(route: oneshot, review: quick — single self-review pass)"));
    assert.ok(promptQuick.includes("oneshot"));
    assert.ok(promptQuick.includes("single self-review pass"));
    assert.ok(promptQuick.includes("self-review"));
    assert.equal(promptQuick.includes("multi-lens"), false);
    assert.equal(promptQuick.endsWith('"'), true);

    // 3. thorough: multi-lens BMAD code review gate
    const promptThorough = buildEffectiveTaskPrompt({
      prompt: '/bmad-build "Implement user authentication with bcrypt and unit tests"',
      reviewMode: "thorough"
    });
    assert.ok(promptThorough.startsWith('/bmad-build-auto "Implement user authentication with bcrypt and unit tests'));
    assert.ok(promptThorough.includes("(route: full, review: thorough — multi-lens BMAD code review gate)"));
    assert.ok(promptThorough.includes("full"));
    assert.ok(promptThorough.includes("multi-lens BMAD code review gate"));
    assert.ok(promptThorough.includes("multi-lens"));
    assert.equal(promptThorough.includes("review: none"), false);
    assert.equal(promptThorough.endsWith('"'), true);
  });

  it("guarantees no mode leaks review instructions into a none task when switching from thorough or quick", () => {
    // A task prompt originally shaped in thorough mode
    const thoroughPrompt = '/bmad-build-auto "Implement database migration (route: full, review: thorough — multi-lens BMAD code review gate)"';

    // Transitioning to reviewMode: "none" must strip all thorough/multi-lens instructions
    const noneFromThorough = buildEffectiveTaskPrompt({
      prompt: thoroughPrompt,
      reviewMode: "none"
    });

    assert.equal(
      noneFromThorough,
      '/bmad-build-auto "Implement database migration (route: oneshot, review: none — skip review lenses, run deterministic verification commands only)"'
    );
    // Explicit leak checks: zero review instructions in none task
    assert.equal(noneFromThorough.includes("thorough"), false, "must not leak 'thorough'");
    assert.equal(noneFromThorough.includes("multi-lens"), false, "must not leak 'multi-lens'");
    assert.equal(noneFromThorough.includes("self-review"), false, "must not leak 'self-review'");
    assert.equal(noneFromThorough.includes("review: quick"), false, "must not leak 'review: quick'");
    assert.equal(noneFromThorough.includes("review: thorough"), false, "must not leak 'review: thorough'");
    assert.equal(noneFromThorough.includes("full route"), false, "must not leak 'full route'");

    // A task prompt originally shaped in quick mode
    const quickPrompt = '/bmad-build-auto "Implement database migration (route: oneshot, review: quick — single self-review pass)"';

    // Transitioning to reviewMode: "none" must strip all quick/self-review instructions
    const noneFromQuick = buildEffectiveTaskPrompt({
      prompt: quickPrompt,
      reviewMode: "none"
    });

    assert.equal(
      noneFromQuick,
      '/bmad-build-auto "Implement database migration (route: oneshot, review: none — skip review lenses, run deterministic verification commands only)"'
    );
    assert.equal(noneFromQuick.includes("quick"), false, "must not leak 'quick'");
    assert.equal(noneFromQuick.includes("self-review"), false, "must not leak 'self-review'");

    // Stacked/corrupted prompt with multiple leftover route hints and policies
    const stackedPrompt = '/bmad-build "Implement database migration (route: full, review: thorough — multi-lens BMAD code review gate) [Execution Policy: full route] (route: oneshot, review: quick — single self-review pass)"';
    const noneFromStacked = buildEffectiveTaskPrompt({
      prompt: stackedPrompt,
      reviewMode: "none"
    });

    assert.equal(
      noneFromStacked,
      '/bmad-build-auto "Implement database migration (route: oneshot, review: none — skip review lenses, run deterministic verification commands only)"'
    );

    // Idempotency: repeated calls produce identical results without duplicating or nesting
    const firstPass = buildEffectiveTaskPrompt({ prompt: '/bmad-build "Fix auth"', reviewMode: "none" });
    const secondPass = buildEffectiveTaskPrompt({ prompt: firstPass, reviewMode: "none" });
    const thirdPass = buildEffectiveTaskPrompt({ prompt: secondPass, reviewMode: "none" });
    assert.equal(secondPass, firstPass);
    assert.equal(thirdPass, firstPass);

    const firstQuick = buildEffectiveTaskPrompt({ prompt: '/bmad-build "Fix auth"', reviewMode: "quick" });
    const secondQuick = buildEffectiveTaskPrompt({ prompt: firstQuick, reviewMode: "quick" });
    assert.equal(secondQuick, firstQuick);

    const firstThorough = buildEffectiveTaskPrompt({ prompt: '/bmad-build "Fix auth"', reviewMode: "thorough" });
    const secondThorough = buildEffectiveTaskPrompt({ prompt: firstThorough, reviewMode: "thorough" });
    assert.equal(secondThorough, firstThorough);
  });

  it("shapes non-build skills with [Execution Policy: ...] without leaking into none tasks", () => {
    const customPrompt = '/bmad-agent-dev "Refactor state manager"';

    const customNone = buildEffectiveTaskPrompt({ prompt: customPrompt, reviewMode: "none" });
    assert.equal(
      customNone,
      '/bmad-agent-dev "Refactor state manager" [Execution Policy: oneshot route, skip multi-lens LLM review, verify via deterministic tests only]'
    );

    const customQuick = buildEffectiveTaskPrompt({ prompt: customPrompt, reviewMode: "quick" });
    assert.equal(
      customQuick,
      '/bmad-agent-dev "Refactor state manager" [Execution Policy: oneshot route, single self-review pass, verify via deterministic tests]'
    );

    const customThorough = buildEffectiveTaskPrompt({ prompt: customPrompt, reviewMode: "thorough" });
    assert.equal(
      customThorough,
      '/bmad-agent-dev "Refactor state manager" [Execution Policy: full route, multi-lens BMAD code review gate]'
    );

    // Transitioning non-build task from thorough to none strips policy and prevents leakage
    const switchedBack = buildEffectiveTaskPrompt({ prompt: customThorough, reviewMode: "none" });
    assert.equal(switchedBack, customNone);
    assert.equal(switchedBack.includes("review gate"), false);
    assert.equal(switchedBack.includes("full route"), false);
  });

  it("handles edge cases: unquoted prompts, title containing 'review', empty/missing fields, and string callers", () => {
    // Unquoted prompt
    const unquoted = buildEffectiveTaskPrompt({
      prompt: "/bmad-build-auto Implement ticket 5.3 in epic-queue",
      reviewMode: "none"
    });
    assert.equal(
      unquoted,
      "/bmad-build-auto Implement ticket 5.3 in epic-queue (route: oneshot, review: none — skip review lenses, run deterministic verification commands only)"
    );

    // Story title containing the word 'review' and parentheses must not have title stripped
    const titleWithReview = '/bmad-build-auto "Story 5.3: Review-mode prompt shaping (none/quick/thorough)"';
    const shapedWithReviewTitle = buildEffectiveTaskPrompt({
      prompt: titleWithReview,
      reviewMode: "quick"
    });
    assert.ok(shapedWithReviewTitle.includes("Story 5.3: Review-mode prompt shaping (none/quick/thorough)"));
    assert.ok(shapedWithReviewTitle.includes("(route: oneshot, review: quick — single self-review pass)"));

    // String caller
    const fromString = buildEffectiveTaskPrompt('/bmad-build "Direct string call"', "thorough");
    assert.equal(
      fromString,
      '/bmad-build-auto "Direct string call (route: full, review: thorough — multi-lens BMAD code review gate)"'
    );

    // Empty or missing prompts
    assert.equal(buildEffectiveTaskPrompt({}), "");
    assert.equal(buildEffectiveTaskPrompt(null), "");
    assert.equal(buildEffectiveTaskPrompt(""), "");

    // Invalid reviewMode falls back to defaultReviewMode if valid, else 'none'
    const fallbackDefault = buildEffectiveTaskPrompt(
      { prompt: '/bmad-build "Fallback test"', reviewMode: "invalid-mode" },
      "quick"
    );
    assert.ok(fallbackDefault.includes("review: quick"));

    const fallbackNone = buildEffectiveTaskPrompt(
      { prompt: '/bmad-build "Fallback test"', reviewMode: "unknown" },
      "also-unknown"
    );
    assert.ok(fallbackNone.includes("review: none"));
  });

  it("integrates prompt shaping with queue operations: add-epic, set-review-mode (applyToAll), and update-item", () => {
    const ws = workspaces.seed();

    // 1. Add epic with reviewMode: 'thorough'
    const addedEpic = manageBmadTaskQueue(ws.root, {
      action: "add-epic",
      epicSlug: "epic-core",
      reviewMode: "thorough",
      includeDone: true
    });

    assert.ok(addedEpic.taskQueue.items.length > 0);
    for (const item of addedEpic.taskQueue.items) {
      assert.equal(item.reviewMode, "thorough");
      assert.ok(
        item.effectivePrompt.includes("multi-lens BMAD code review gate"),
        `Item ${item.id} must compile thorough effectivePrompt`
      );
    }

    // 2. set-review-mode to 'none' with applyToAll: true -> all items update with 0 review leaks
    const setNone = manageBmadTaskQueue(ws.root, {
      action: "set-review-mode",
      reviewMode: "none",
      applyToAll: true
    });

    assert.equal(setNone.taskQueue.defaultReviewMode, "none");
    for (const item of setNone.taskQueue.items) {
      assert.equal(item.reviewMode, "none");
      assert.ok(
        item.effectivePrompt.includes("(route: oneshot, review: none — skip review lenses, run deterministic verification commands only)"),
        `Item ${item.id} must compile none effectivePrompt`
      );
      assert.equal(item.effectivePrompt.includes("multi-lens"), false, `Item ${item.id} must not leak multi-lens`);
      assert.equal(item.effectivePrompt.includes("thorough"), false, `Item ${item.id} must not leak thorough`);
      assert.equal(item.effectivePrompt.includes("self-review"), false, `Item ${item.id} must not leak self-review`);
    }

    // 3. update-item targeted update to 'quick'
    const firstItemId = setNone.taskQueue.items[0].id;
    const updatedQuick = manageBmadTaskQueue(ws.root, {
      action: "update-item",
      taskId: firstItemId,
      reviewMode: "quick"
    });

    const targetItemQuick = updatedQuick.taskQueue.items.find((it) => it.id === firstItemId);
    assert.equal(targetItemQuick.reviewMode, "quick");
    assert.ok(targetItemQuick.effectivePrompt.includes("single self-review pass"));
    assert.equal(targetItemQuick.effectivePrompt.includes("multi-lens"), false);

    // 4. update-item targeted update back to 'none' confirms zero leftover review instructions
    const updatedBackNone = manageBmadTaskQueue(ws.root, {
      action: "update-item",
      taskId: firstItemId,
      reviewMode: "none"
    });

    const targetItemNone = updatedBackNone.taskQueue.items.find((it) => it.id === firstItemId);
    assert.equal(targetItemNone.reviewMode, "none");
    assert.ok(targetItemNone.effectivePrompt.includes("review: none — skip review lenses, run deterministic verification commands only"));
    assert.equal(targetItemNone.effectivePrompt.includes("self-review"), false);
    assert.equal(targetItemNone.effectivePrompt.includes("quick"), false);
  });
});

function assertParseableWorkflowTs(tsSource) {
  const wrappedTs = `async function __workflowMain() {\n${tsSource}\n}`;
  let jsWrapped;
  if (typeof nodeModule.stripTypeScriptTypes === "function") {
    jsWrapped = nodeModule.stripTypeScriptTypes(wrappedTs, { mode: "strip" });
  } else {
    jsWrapped = wrappedTs
      .replace(/interface\s+\w+\s*\{[\s\S]*?\n\}/g, "")
      .replace(/\.ask<\w+>/g, ".ask")
      .replace(/:\s*(?:Finding\[\]|string\[\]|WorkflowReport)\b/g, "");
  }
  assert.doesNotThrow(() => {
    new Function(jsWrapped);
  }, "generated .dwf.ts must parse as valid TypeScript/JS");
}

function assertConfinedToWorkspace(workspaceRoot, targetPath) {
  const rootResolved = resolve(workspaceRoot);
  const fullResolved = resolve(targetPath);
  const rel = relative(rootResolved, fullResolved).replace(/\\/g, "/");
  assert.ok(
    rel && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel),
    `Expected ${targetPath} to stay inside ${workspaceRoot}, got relative=${rel}`
  );
}

describe("Epic 5 Story 5.4: Dual execution engine generation (.dwf.ts + step-updater / CreateSession plan)", () => {
  it("emits parseable .dwf.ts + queue-step-updater.mjs under workspaceRoot preserving per-task model and reviewMode", () => {
    const ws = workspaces.seed();

    manageBmadTaskQueue(ws.root, {
      action: "add",
      executionMode: "dynamic-workflow",
      items: [
        {
          id: "t-done",
          title: "Already Completed Task",
          prompt: '/bmad-build-auto "Already done"',
          model: "provider-z/unused-model",
          reviewMode: "none"
        },
        {
          id: "t-skip",
          title: "Skipped Task",
          prompt: '/bmad-build-auto "Skipped work"',
          model: "provider-z/skipped-model",
          reviewMode: "none"
        },
        {
          id: "t-1",
          title: "Story 5.4A: Fast implementation",
          prompt: '/bmad-build "Implement fast path with `quotes` and ${literal}"',
          model: "provider-a/argon-fast",
          reviewMode: "none",
          storyId: "5.4A",
          overrideKey: "epic-execution-queue#4",
          verifyCommand: "node --test tests/execution-queue.test.mjs"
        },
        {
          id: "t-2",
          title: "Story 5.4B: Quick review task",
          prompt: '/bmad-build "Implement quick-reviewed path"',
          model: "provider-b/sonnet-standard",
          reviewMode: "quick",
          storyId: "5.4B"
        },
        {
          id: "t-3",
          title: "Story 5.4C: Thorough review task",
          prompt: '/bmad-build "Implement security-sensitive path"',
          model: "provider-a/argon-fast",
          reviewMode: "thorough",
          storyId: "5.4C"
        }
      ]
    });

    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: "t-done" });
    manageBmadTaskQueue(ws.root, { action: "complete-task", taskId: "t-done" });
    manageBmadTaskQueue(ws.root, { action: "update-item", taskId: "t-skip", status: "skipped" });

    const genRes = manageBmadTaskQueue(ws.root, {
      action: "generate-workflow",
      executionMode: "dynamic-workflow"
    });

    const wf = genRes.generatedWorkflow;
    assert.ok(wf, "generate-workflow must return generatedWorkflow");
    assert.equal(wf.executionMode, "dynamic-workflow");
    assert.equal(wf.tasksCount, 3, "done and skipped tasks must be omitted when runnable tasks exist");
    assert.equal(wf.workflowRelPath, ".zcode/workflows/bmad-task-queue.dwf.ts");
    assert.equal(wf.updaterRelPath, ".zcode/bmad-companion/queue-step-updater.mjs");
    assertConfinedToWorkspace(ws.root, wf.workflowFullPath);
    assertConfinedToWorkspace(ws.root, wf.updaterFullPath);
    assert.ok(wf.workflowLaunchPrompt.includes("CreateWorkflow"));
    assert.ok(wf.workflowLaunchPrompt.includes(".zcode/workflows/bmad-task-queue.dwf.ts"));
    assert.equal(wf.executionPrompt, wf.workflowLaunchPrompt);

    // Check .dwf.ts parseability and per-task model/reviewMode fidelity
    const dwfSource = readFileSync(wf.workflowFullPath, "utf8");
    assertParseableWorkflowTs(dwfSource);

    // Models are deduplicated into compile-time model("...") declarations
    assert.ok(dwfSource.includes('const model_1 = model("provider-a/argon-fast");'));
    assert.ok(dwfSource.includes('const model_2 = model("provider-b/sonnet-standard");'));
    assert.equal(dwfSource.includes("provider-z/unused-model"), false);
    assert.equal(dwfSource.includes("provider-z/skipped-model"), false);

    // Each runnable task carries its own model variable, reviewMode policy, and shaped effectivePrompt
    assert.ok(dwfSource.includes("model: model_1,"));
    assert.ok(dwfSource.includes("model: model_2,"));
    assert.ok(dwfSource.includes('reviewMode: "none"'));
    assert.ok(dwfSource.includes('reviewMode: "quick"'));
    assert.ok(dwfSource.includes('reviewMode: "thorough"'));
    assert.ok(dwfSource.includes("route=oneshot, review=none"));
    assert.ok(dwfSource.includes("route=oneshot, review=quick"));
    assert.ok(dwfSource.includes("route=full, review=thorough"));
    assert.ok(dwfSource.includes("deterministic verification commands only"));
    assert.ok(dwfSource.includes("single self-review pass"));
    assert.ok(dwfSource.includes("multi-lens BMAD code review gate"));

    // Verify queue-step-updater.mjs passes node --check and mutates state cleanly
    execFileSync(process.execPath, ["--check", wf.updaterFullPath], { cwd: ws.root });
    execFileSync(process.execPath, [wf.updaterRelPath, "start", "t-1", "epic-execution-queue#4"], { cwd: ws.root });
    const midState = loadPersistedState(ws.root);
    assert.equal(midState.taskQueue.activeTaskId, "t-1");
    assert.equal(midState.storyOverrides["epic-execution-queue#4"].status, "in-progress");

    execFileSync(process.execPath, [wf.updaterRelPath, "fail", "t-2", "", "Test failure on task 2"], { cwd: ws.root });
    const failedState = loadPersistedState(ws.root);
    assert.equal(failedState.taskQueue.status, "paused");
    assert.equal(failedState.taskQueue.items.find((it) => it.id === "t-2").status, "failed");
    assert.equal(failedState.taskQueue.items.find((it) => it.id === "t-2").resultSummary, "Test failure on task 2");
  });

  it("emits a CreateSession + WaitSessions-aware handoff plan for separate-sessions on start-queue and set-execution-mode", () => {
    const ws = workspaces.seed();

    manageBmadTaskQueue(ws.root, {
      action: "add",
      items: [
        {
          id: "sep-done",
          title: "Done First",
          prompt: '/bmad-build-auto "Already done"',
          model: "provider-a/done-model",
          reviewMode: "none"
        },
        {
          id: "sep-next",
          title: "Next Runnable Task",
          prompt: '/bmad-build "Build API endpoint"',
          model: "provider-b/claude-sonnet-5-5-high",
          reviewMode: "thorough"
        },
        {
          id: "sep-later",
          title: "Later Task",
          prompt: '/bmad-build "Build UI view"',
          model: "provider-c/gemini-4-argon-high",
          reviewMode: "quick"
        }
      ]
    });

    manageBmadTaskQueue(ws.root, { action: "start-task", taskId: "sep-done" });
    manageBmadTaskQueue(ws.root, { action: "complete-task", taskId: "sep-done" });

    // Switching executionMode regenerates the workflow plan immediately
    const switched = manageBmadTaskQueue(ws.root, {
      action: "set-execution-mode",
      executionMode: "separate-sessions"
    });
    assert.equal(switched.taskQueue.executionMode, "separate-sessions");
    assert.equal(switched.generatedWorkflow?.executionMode, "separate-sessions");

    const started = manageBmadTaskQueue(ws.root, {
      action: "start-queue",
      executionMode: "separate-sessions"
    });
    const wf = started.generatedWorkflow;
    assert.ok(wf);
    assert.equal(wf.executionMode, "separate-sessions");
    assert.equal(wf.tasksCount, 2);
    assertConfinedToWorkspace(ws.root, wf.workflowFullPath);
    assertConfinedToWorkspace(ws.root, wf.updaterFullPath);

    const plan = wf.separateSessionsPrompt;
    assert.equal(wf.executionPrompt, plan);
    assert.ok(plan.includes("CreateSession"), "plan must instruct calling CreateSession");
    assert.ok(plan.includes("WaitSessions"), "plan must explicitly state the WaitSessions rule");
    assert.ok(plan.includes("start-task"), "plan must instruct claiming the task via start-task");
    assert.ok(plan.includes("sessionId"), "plan must record sessionId");
    assert.ok(plan.includes("provider-b/claude-sonnet-5-5-high"), "plan must preserve first runnable task model");
    assert.ok(plan.includes("sep-next"), "plan must target the first runnable task");
    assert.ok(plan.includes("multi-lens BMAD code review gate"), "plan must carry shaped effectivePrompt for first task reviewMode");
    assert.equal(plan.includes("sep-done"), false, "completed task must not be re-launched");
    assert.equal(plan.includes("sep-later"), false, "later tasks must wait for Stop-hook handoff");
  });

  it("enforces workspaceRoot confinement and normalizes direct/empty generateQueueWorkflowFiles calls", () => {
    const ws = workspaces.seed();

    // Direct call with minimal item (no precomputed effectivePrompt/modelShort) and empty queue
    const direct = generateQueueWorkflowFiles(ws.root, {
      executionMode: "dynamic-workflow",
      defaultReviewMode: "quick",
      items: [
        {
          id: "direct-1",
          title: "Direct Call Task",
          prompt: '/bmad-build "Direct workflow item"',
          model: "provider-x/model-direct"
        }
      ]
    });
    assert.equal(direct.tasksCount, 1);
    const directDwf = readFileSync(direct.workflowFullPath, "utf8");
    assertParseableWorkflowTs(directDwf);
    assert.ok(directDwf.includes('const model_1 = model("provider-x/model-direct");'));
    assert.ok(directDwf.includes('reviewMode: "quick"'));
    assert.ok(directDwf.includes("single self-review pass"));

    const emptyGen = generateQueueWorkflowFiles(ws.root, { items: [] });
    assert.equal(emptyGen.tasksCount, 0);
    assert.equal(emptyGen.separateSessionsPrompt, "");
    assertParseableWorkflowTs(readFileSync(emptyGen.workflowFullPath, "utf8"));

    // Invalid / missing workspaceRoot is rejected
    assert.throws(() => generateQueueWorkflowFiles("", { items: [] }), /Workspace root/i);
    assert.throws(
      () => generateQueueWorkflowFiles(join(ws.root, "nonexistent-dir"), { items: [] }),
      /Workspace root/i
    );

    // Symlink escape inside .zcode/workflows is rejected
    const outsideWs = workspaces.seed();
    const outsideFile = join(outsideWs.root, "escape-target.ts");
    writeFileSync(outsideFile, "// outside", "utf8");
    const symlinkWs = workspaces.seed();
    mkdirSync(join(symlinkWs.root, ".zcode", "workflows"), { recursive: true });
    let symlinkCreated = false;
    try {
      symlinkSync(outsideFile, join(symlinkWs.root, ".zcode", "workflows", "bmad-task-queue.dwf.ts"));
      symlinkCreated = true;
    } catch {
      // Unprivileged Windows environments without Developer Mode may forbid file symlinks
    }
    if (symlinkCreated) {
      assert.throws(
        () => generateQueueWorkflowFiles(symlinkWs.root, { items: [] }),
        /symlink|workspace root/i
      );
    }
  });
});

const QUEUE_SCAN_RESULT_KEYS = [
  "scannedAt",
  "workspaceRoot",
  "projectName",
  "techStack",
  "availableModels",
  "providerState",
  "git",
  "taskQueue",
  "metrics",
  "turnAnalysis",
  "recommendations",
  "smartInsights",
  "phases",
  "artifacts",
  "initiatives",
  "epics",
  "skillsCatalog",
  "agentsCatalog"
];

function queueToolCall(id, args = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: "bmad_queue_manage", arguments: args }
  };
}

function assertQueueToolContractShape(frame, expectedAction, { expectWorkflow = false } = {}) {
  assert.ok(!frame.result?.isError, `bmad_queue_manage(${expectedAction}) must not fail`);
  assert.equal(frame.result?.content?.[0]?.type, "text");
  assert.ok(
    frame.result.content[0].text.includes(`# BMAD Companion Task Queue (${expectedAction})`),
    `Markdown summary must include action header for ${expectedAction}`
  );

  const structured = frame.result?.structuredContent;
  assert.ok(structured && typeof structured === "object", "structuredContent must be an object");
  for (const key of QUEUE_SCAN_RESULT_KEYS) {
    assert.ok(key in structured, `structuredContent missing ScanResult key '${key}'`);
  }

  assert.ok(
    structured.queueActionResult && typeof structured.queueActionResult === "object",
    "structuredContent must include queueActionResult"
  );
  assert.equal(structured.queueActionResult.action, expectedAction);
  assert.deepEqual(structured.queueActionResult.taskQueue, structured.taskQueue);

  if (expectWorkflow) {
    const wf = structured.queueActionResult.generatedWorkflow;
    assert.ok(wf && typeof wf === "object", `expected generatedWorkflow for ${expectedAction}`);
    assert.equal(typeof wf.workflowRelPath, "string");
    assert.equal(typeof wf.executionPrompt, "string");
    assert.ok(wf.executionPrompt.length > 0);
  } else {
    assert.equal(structured.queueActionResult.generatedWorkflow, null);
  }
  return structured;
}

describe("Epic 5 Story 5.5: Queue MCP tool contract + storyOverrides sync", () => {
  it("returns the documented ScanResult + queueActionResult shape across MCP stdio lifecycle and syncs storyOverrides on complete-task", async () => {
    const ws = workspaces.seed();

    const mcpRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        queueToolCall(1, { action: "add-epic", epicSlug: "epic-core", includeDone: false }),
        queueToolCall(2, { action: "start-queue", executionMode: "dynamic-workflow" }),
        queueToolCall(3, { action: "start-task", taskId: "qtask-epic-core-1-2", sessionId: "sess-mcp-55" }),
        queueToolCall(4, {
          action: "complete-task",
          taskId: "qtask-epic-core-1-2",
          storyStatus: "done",
          summary: "Implemented and verified Story 1.2 via MCP queue tool"
        }),
        queueToolCall(5, { action: "get" })
      ]
    });

    assertStrictJsonRpcStdout(mcpRes);
    assert.equal(mcpRes.responses.length, 5);

    const added = assertQueueToolContractShape(mcpRes.responses[0], "add-epic", { expectWorkflow: true });
    assert.equal(added.taskQueue.items.length, 1);
    assert.equal(added.taskQueue.items[0].id, "qtask-epic-core-1-2");
    assert.equal(added.taskQueue.items[0].overrideKey, "epic-core#2");
    assert.equal(added.metrics.smartDoneStories, 1);

    const startedQueue = assertQueueToolContractShape(mcpRes.responses[1], "start-queue", { expectWorkflow: true });
    assert.equal(startedQueue.taskQueue.status, "running");
    assert.equal(startedQueue.queueActionResult.generatedWorkflow.executionMode, "dynamic-workflow");
    assert.match(mcpRes.responses[1].result.content[0].text, /Generated Dynamic Workflow/);

    const startedTask = assertQueueToolContractShape(mcpRes.responses[2], "start-task", { expectWorkflow: false });
    assert.equal(startedTask.taskQueue.activeTaskId, "qtask-epic-core-1-2");
    assert.equal(startedTask.taskQueue.activeTask?.sessionId, "sess-mcp-55");
    assert.equal(
      startedTask.epics[0].stories.find((s) => s.overrideKey === "epic-core#2").smartStatus,
      "in-progress"
    );

    const completedTask = assertQueueToolContractShape(mcpRes.responses[3], "complete-task", { expectWorkflow: false });
    assert.equal(completedTask.taskQueue.status, "completed");
    assert.equal(completedTask.taskQueue.counts.done, 1);
    assert.equal(completedTask.taskQueue.items[0].status, "done");
    // SM-5: taskQueue and storyOverrides agree immediately in the returned ScanResult + persisted state
    const syncedStory = completedTask.epics[0].stories.find((s) => s.overrideKey === "epic-core#2");
    assert.equal(syncedStory.smartStatus, "done");
    assert.equal(syncedStory.smartReason, "Implemented and verified Story 1.2 via MCP queue tool");
    assert.equal(completedTask.metrics.smartDoneStories, 2);
    assert.equal(completedTask.metrics.smartOverallPct, 100);

    const got = assertQueueToolContractShape(mcpRes.responses[4], "get", { expectWorkflow: false });
    assert.equal(got.taskQueue.status, "completed");
    assert.equal(got.metrics.smartDoneStories, 2);

    const persisted = readJsonFile(ws.statePath);
    assert.equal(persisted.taskQueue.items[0].status, "done");
    assert.equal(persisted.storyOverrides["epic-core#2"].status, "done");
    assert.equal(
      persisted.storyOverrides["epic-core#2"].reason,
      "Implemented and verified Story 1.2 via MCP queue tool"
    );
    assert.ok(!Number.isNaN(Date.parse(persisted.storyOverrides["epic-core#2"].updatedAt)));
  });

  it("supports separate-sessions plan output, non-done storyStatus sync, and failed complete-task sync over MCP stdio", async () => {
    const ws = workspaces.seed();

    const mcpRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        queueToolCall(1, {
          action: "add",
          items: [
            {
              id: "task-review-gate",
              title: "Story 1.2: Review Gate",
              prompt: '/bmad-build-auto "Implement Story 1.2"',
              overrideKey: "epic-core#2",
              storyId: "2",
              epicSlug: "epic-core"
            }
          ]
        }),
        queueToolCall(2, { action: "set-execution-mode", executionMode: "separate-sessions" }),
        queueToolCall(3, { action: "start-task", taskId: "task-review-gate" }),
        queueToolCall(4, {
          action: "complete-task",
          taskId: "task-review-gate",
          storyStatus: "review",
          summary: "Ready for human review"
        }),
        queueToolCall(5, { action: "update-item", taskId: "task-review-gate", status: "queued" }),
        queueToolCall(6, { action: "start-task", taskId: "task-review-gate" }),
        queueToolCall(7, {
          action: "complete-task",
          taskId: "task-review-gate",
          failed: true,
          summary: "Unit suite failed"
        })
      ]
    });

    assertStrictJsonRpcStdout(mcpRes);
    assert.equal(mcpRes.responses.length, 7);

    const sepPlan = assertQueueToolContractShape(mcpRes.responses[1], "set-execution-mode", { expectWorkflow: true });
    assert.equal(sepPlan.queueActionResult.generatedWorkflow.executionMode, "separate-sessions");
    assert.ok(sepPlan.queueActionResult.generatedWorkflow.separateSessionsPrompt.includes("CreateSession"));
    assert.match(mcpRes.responses[1].result.content[0].text, /Separate-Sessions Launch Plan/);

    const reviewDone = assertQueueToolContractShape(mcpRes.responses[3], "complete-task", { expectWorkflow: false });
    assert.equal(reviewDone.taskQueue.items[0].status, "done");
    assert.equal(
      reviewDone.epics[0].stories.find((s) => s.overrideKey === "epic-core#2").smartStatus,
      "review"
    );

    const failedTask = assertQueueToolContractShape(mcpRes.responses[6], "complete-task", { expectWorkflow: false });
    assert.equal(failedTask.taskQueue.items[0].status, "failed");
    assert.match(mcpRes.responses[6].result.content[0].text, /1 failed/);
    const storyAfterFail = failedTask.epics[0].stories.find((s) => s.overrideKey === "epic-core#2");
    assert.equal(storyAfterFail.smartStatus, "in-progress");
    assert.equal(storyAfterFail.smartReason, "Unit suite failed");

    const persisted = readJsonFile(ws.statePath);
    assert.equal(persisted.storyOverrides["epic-core#2"].status, "in-progress");
    assert.equal(persisted.storyOverrides["epic-core#2"].reason, "Unit suite failed");
  });

  it("rejects invalid action and invalid storyStatus with isError without crashing or corrupting state", async () => {
    const ws = workspaces.seed();

    const mcpRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        queueToolCall(1, { action: "add-epic", epicSlug: "epic-core", includeDone: false }),
        queueToolCall(2, { action: "start-task", taskId: "qtask-epic-core-1-2" }),
        queueToolCall(3, { action: "bogus-action" }),
        queueToolCall(4, { action: "complete-task", taskId: "qtask-epic-core-1-2", storyStatus: "invalid-status" }),
        queueToolCall(5, { action: "complete-task", taskId: "nonexistent-task" }),
        queueToolCall(6, { action: "get" })
      ]
    });

    assertStrictJsonRpcStdout(mcpRes);
    assert.equal(mcpRes.responses.length, 6);

    assert.equal(mcpRes.responses[2].result?.isError, true);
    assert.match(mcpRes.responses[2].result?.content?.[0]?.text || "", /Invalid queue action/i);

    assert.equal(mcpRes.responses[3].result?.isError, true);
    assert.match(mcpRes.responses[3].result?.content?.[0]?.text || "", /Invalid storyStatus/i);

    // Nonexistent taskId must not corrupt running task or falsely mark queue completed
    const afterMissing = assertQueueToolContractShape(mcpRes.responses[4], "complete-task", { expectWorkflow: false });
    assert.equal(afterMissing.taskQueue.status, "running");
    assert.equal(afterMissing.taskQueue.activeTaskId, "qtask-epic-core-1-2");

    // Server stayed alive and persisted state remained consistent
    const afterGet = assertQueueToolContractShape(mcpRes.responses[5], "get", { expectWorkflow: false });
    assert.equal(afterGet.taskQueue.items[0].status, "running");
  });
});


