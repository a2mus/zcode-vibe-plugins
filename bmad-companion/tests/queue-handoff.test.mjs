import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildTaskSessionLaunchInstructions,
  generateQueueWorkflowFiles,
  loadPersistedState,
  manageBmadTaskQueue,
  savePersistedState
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
});