import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import {
  openWorkspaceArtifactExternally,
  prepareNewSession,
  scanBmadWorkspace
} from "../scripts/bmad-engine.mjs";
import {
  PANEL_HTML_PATH,
  assertSingleJsonObjectStdout,
  assertStrictJsonRpcStdout,
  createTempWorkspaceTracker,
  extractInlineScript,
  readJsonFile,
  runHookRunner,
  runMcpServer
} from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

const PANEL_HTML = readFileSync(PANEL_HTML_PATH, "utf8");
const CONTEXTUAL_PROMPT_RE = /^\/bmad-[a-z0-9-]+\s+".+"$/;

const E2E_HOST_MODELS = [
  {
    id: "new-provider/claude-opus-5-5-high",
    modelId: "claude-opus-5-5-high",
    providerId: "new-provider",
    providerLabel: "New Provider",
    current: true
  },
  {
    id: "new-provider/claude-sonnet-5-5-high",
    modelId: "claude-sonnet-5-5-high",
    providerId: "new-provider",
    providerLabel: "New Provider"
  },
  {
    id: "new-provider/gemini-4-argon-high",
    modelId: "gemini-4-argon-high",
    providerId: "new-provider",
    providerLabel: "New Provider"
  },
  {
    id: "new-provider/gemini-4-hydrogen-xhigh",
    modelId: "gemini-4-hydrogen-xhigh",
    providerId: "new-provider",
    providerLabel: "New Provider"
  }
];

function toolCall(id, name, args = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args }
  };
}

function assertContextualRecommendations(recommendations, availableModels) {
  assert.ok(Array.isArray(recommendations) && recommendations.length > 0, "expected non-empty recommendations");
  const knownIds = new Set(availableModels.map((m) => m.id));
  for (const rec of recommendations) {
    assert.match(rec.fullCommand, CONTEXTUAL_PROMPT_RE, `SM-1: invalid contextual command ${rec.fullCommand}`);
    assert.ok(rec.recommendedModel, `SM-1: missing recommendedModel on ${rec.id}`);
    assert.match(rec.recommendedModel.modelId, /^[^/]+\/.+$/, "SM-1: modelId must be providerId/modelId");
    assert.ok(knownIds.has(rec.recommendedModel.modelId), `SM-1: ${rec.recommendedModel.modelId} must be available`);
  }
}

function parseAttributes(rawAttrs = "") {
  const map = new Map();
  for (const m of rawAttrs.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

/**
 * Zero-eval DOM harness for assets/panel.html wired to real MCP stdio tool calls
 * for bmad_get_state and an injectable prepareNewSession bridge for UJ-1 launch.
 */
function createLivePanelHarness({ workspaceRoot, onPrepareNewSession }) {
  const elements = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  const outboundMessages = [];
  const intervalCallbacks = [];
  const scheduledTimers = [];
  const pendingStateResolvers = [];

  let nextTimerId = 1;
  let activeElement = null;
  let isHidden = false;
  let visibilityState = "visible";
  let autoRespondGetState = true;
  let lastMcpState = null;

  function makeElement(id, tagName = "div") {
    const existing = elements.get(id);
    if (existing) {
      if (tagName !== "div" && existing.tagName === "DIV") {
        existing.tagName = tagName.toUpperCase();
      }
      return existing;
    }

    const listeners = new Map();
    const classSet = new Set();
    const attributes = new Map();
    let innerHtmlVal = "";
    let textContentVal = "";
    let valVal = "";
    let innerHtmlSetCount = 0;
    let actionButtons = [];
    let checkboxes = [];

    const el = {
      id,
      tagName: tagName.toUpperCase(),
      style: { width: "", display: "" },
      listeners,
      attributes,
      checked: false,
      classList: {
        add(...cls) {
          cls.forEach((c) => classSet.add(c));
        },
        remove(...cls) {
          cls.forEach((c) => classSet.delete(c));
        },
        contains(c) {
          return classSet.has(c);
        },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) classSet.add(c);
            else classSet.delete(c);
            return force;
          }
          if (classSet.has(c)) {
            classSet.delete(c);
            return false;
          }
          classSet.add(c);
          return true;
        }
      },
      setAttribute(k, v) {
        attributes.set(k, String(v));
      },
      getAttribute(k) {
        return attributes.has(k) ? attributes.get(k) : null;
      },
      hasAttribute(k) {
        return attributes.has(k);
      },
      removeAttribute(k) {
        attributes.delete(k);
      },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        const arr = listeners.get(type);
        if (arr) {
          const idx = arr.indexOf(fn);
          if (idx !== -1) arr.splice(idx, 1);
        }
      },
      dispatchEvent(evt) {
        evt.target = evt.target || el;
        evt.currentTarget = el;
        for (const fn of listeners.get(evt.type) || []) fn(evt);
        if (evt.type === "input" || evt.type === "change" || evt.type === "pointerdown" || evt.type === "keydown") {
          dispatchDocumentEvent(evt);
        }
        return !evt.defaultPrevented;
      },
      closest(sel) {
        const targetTag = sel.toUpperCase();
        if (this.tagName === targetTag) return this;
        return null;
      },
      focus() {
        activeElement = el;
        el.dispatchEvent({ type: "focus", target: el });
      },
      blur() {
        if (activeElement === el) {
          activeElement = null;
        }
        dispatchDocumentEvent({ type: "focusout", target: el });
      },
      appendChild(child) {
        return child;
      },
      querySelectorAll(selector) {
        if (selector === "button[data-action]") return actionButtons;
        if (selector === "[data-rec-cb]") return checkboxes;
        return [];
      },
      querySelector() {
        return null;
      }
    };

    Object.defineProperty(el, "value", {
      get() {
        return valVal;
      },
      set(v) {
        valVal = String(v ?? "");
      }
    });

    Object.defineProperty(el, "innerHtmlSetCount", {
      get() {
        return innerHtmlSetCount;
      },
      set(v) {
        innerHtmlSetCount = v;
      }
    });

    Object.defineProperty(el, "innerHTML", {
      get() {
        return innerHtmlVal;
      },
      set(v) {
        innerHtmlVal = String(v ?? "");
        innerHtmlSetCount++;
        actionButtons = [];
        checkboxes = [];

        for (const match of innerHtmlVal.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi)) {
          const childEl = elements.get(match[3]) || makeElement(match[3], match[1]);
          childEl.tagName = match[1].toUpperCase();
          for (const [k, val] of parseAttributes(match[2])) {
            childEl.setAttribute(k, val);
            if (k === "class") {
              val.split(/\s+/).filter(Boolean).forEach((c) => childEl.classList.add(c));
            }
          }
        }
        for (const taMatch of innerHtmlVal.matchAll(/<textarea\s+[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/gi)) {
          const taEl = elements.get(taMatch[1]) || makeElement(taMatch[1], "TEXTAREA");
          taEl.tagName = "TEXTAREA";
          taEl.value = taMatch[2]
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&");
        }
        for (const selMatch of innerHtmlVal.matchAll(/<select\s+[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)) {
          const selEl = elements.get(selMatch[1]) || makeElement(selMatch[1], "SELECT");
          selEl.tagName = "SELECT";
          const optMatch = selMatch[2].match(/<option\s+[^>]*value="([^"]*)"[^>]*selected/i);
          if (optMatch) {
            selEl.value = optMatch[1];
          }
        }
        for (const btnMatch of innerHtmlVal.matchAll(/<button\s+([^>]*data-action="([^"]+)"[^>]*)>/gi)) {
          const btn = makeElement("", "BUTTON");
          for (const [k, val] of parseAttributes(btnMatch[1])) {
            btn.setAttribute(k, val);
          }
          actionButtons.push(btn);
        }
        for (const cbMatch of innerHtmlVal.matchAll(/<input\s+([^>]*data-rec-cb="([^"]+)"[^>]*)>/gi)) {
          const cb = makeElement("", "INPUT");
          for (const [k, val] of parseAttributes(cbMatch[1])) {
            cb.setAttribute(k, val);
          }
          checkboxes.push(cb);
        }
      }
    });

    Object.defineProperty(el, "textContent", {
      get() {
        return textContentVal;
      },
      set(v) {
        textContentVal = String(v ?? "");
      }
    });

    if (id) elements.set(id, el);
    return el;
  }

  const documentElement = makeElement("__html__", "html");
  const body = makeElement("__body__", "body");

  const panelMarkup = PANEL_HTML.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "");
  for (const match of panelMarkup.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi)) {
    const el = elements.get(match[3]) || makeElement(match[3], match[1]);
    for (const [k, val] of parseAttributes(match[2])) {
      el.setAttribute(k, val);
      if (k === "class") {
        val.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
      }
    }
  }

  function dispatchDocumentEvent(event) {
    for (const fn of documentListeners.get(event.type) || []) {
      fn(event);
    }
  }

  function dispatchWindowMessage(data) {
    for (const fn of windowListeners.get("message") || []) {
      fn({ data });
    }
  }

  async function fetchRealMcpState() {
    const mcpRes = await runMcpServer({
      workspaceRoot,
      requests: [toolCall(1, "bmad_get_state", { refresh: true })]
    });
    assertStrictJsonRpcStdout(mcpRes);
    const state = mcpRes.responses[0].result.structuredContent;
    lastMcpState = state;
    return state;
  }

  const sandbox = {
    console: { warn() {}, error() {}, log() {} },
    setTimeout: (fn, delay = 0) => {
      const id = nextTimerId++;
      scheduledTimers.push({ id, fn, delay });
      return id;
    },
    clearTimeout: (id) => {
      const idx = scheduledTimers.findIndex((t) => t.id === id);
      if (idx !== -1) scheduledTimers.splice(idx, 1);
    },
    setInterval: (fn, delay = 5000) => {
      intervalCallbacks.push({ fn, delay });
      return intervalCallbacks.length;
    },
    clearInterval: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: () => {},
    navigator: {
      clipboard: {
        writeText: async () => {}
      }
    },
    document: {
      documentElement,
      body,
      getElementById: (id) => elements.get(id) || makeElement(id, "div"),
      createElement: (tag) => makeElement(`elem_${Math.random().toString(36).slice(2)}`, tag),
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: (type, fn) => {
        if (!documentListeners.has(type)) documentListeners.set(type, []);
        documentListeners.get(type).push(fn);
      },
      removeEventListener: (type, fn) => {
        const arr = documentListeners.get(type);
        if (arr) {
          const idx = arr.indexOf(fn);
          if (idx !== -1) arr.splice(idx, 1);
        }
      },
      get activeElement() {
        return activeElement;
      },
      set activeElement(el) {
        activeElement = el;
      },
      get hidden() {
        return isHidden;
      },
      set hidden(val) {
        isHidden = Boolean(val);
      },
      get visibilityState() {
        return visibilityState;
      },
      set visibilityState(val) {
        visibilityState = String(val);
      }
    },
    window: {
      addEventListener: (type, fn) => {
        if (!windowListeners.has(type)) windowListeners.set(type, []);
        windowListeners.get(type).push(fn);
      },
      removeEventListener: (type, fn) => {
        const arr = windowListeners.get(type);
        if (arr) {
          const idx = arr.indexOf(fn);
          if (idx !== -1) arr.splice(idx, 1);
        }
      },
      dispatchEvent: (event) => {
        for (const fn of windowListeners.get(event.type) || []) fn(event);
        return !event.defaultPrevented;
      },
      parent: {
        postMessage(msg) {
          outboundMessages.push(msg);
          if (msg.method === "ui/initialize" && msg.id !== undefined) {
            queueMicrotask(() => {
              dispatchWindowMessage({
                jsonrpc: "2.0",
                id: msg.id,
                result: { hostContext: { theme: "dark" } }
              });
            });
          } else if (msg.method === "tools/call") {
            const toolName = msg.params?.name;
            if (toolName === "bmad_get_state") {
              if (autoRespondGetState) {
                fetchRealMcpState().then((state) => {
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: { structuredContent: state }
                  });
                });
              } else {
                pendingStateResolvers.push(async (overrideState) => {
                  const state = overrideState || (await fetchRealMcpState());
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: { structuredContent: state }
                  });
                });
              }
            } else if (toolName === "bmad_prepare_new_session") {
              Promise.resolve(onPrepareNewSession(msg.params?.arguments || {})).then((structuredContent) => {
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: { structuredContent }
                });
              });
            }
          }
        }
      }
    }
  };

  const scriptContent = extractInlineScript(PANEL_HTML);
  vm.runInContext(scriptContent, vm.createContext(sandbox));

  return {
    elements,
    intervalCallbacks,
    scheduledTimers,
    pendingStateResolvers,
    getLastMcpState: () => lastMcpState,
    setAutoRespondGetState: (val) => {
      autoRespondGetState = Boolean(val);
    },
    async resolveNextGetState(overrideState) {
      const resolver = pendingStateResolvers.shift();
      assert.ok(resolver, "expected a pending bmad_get_state request");
      await resolver(overrideState);
    },
    dispatchWindowMessage,
    flushTimers() {
      const toRun = scheduledTimers.splice(0, scheduledTimers.length);
      toRun.sort((a, b) => a.delay - b.delay);
      for (const t of toRun) t.fn();
    },
    async waitForCondition(predicate, timeoutMs = 4000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((r) => setTimeout(r, 15));
      }
      throw new Error("Timed out waiting for condition in panel harness");
    },
    getTestHooks: () => sandbox.window.__bmadTestHooks
  };
}

function seedAuthEpicWorkspace({ includeExtraBacklogStories = 3 } = {}) {
  const ws = workspaces.seed({
    epicSlug: "epic-auth",
    includeStoryPlans: false,
    includePassingTestReport: false,
    sprintStatus: false
  });

  const entries = [
    [
      "[[entry]]",
      "id = 1",
      'v6_key = "1-1-seed-auth"',
      'title = "Auth Schema Baseline"',
      'status = "done"',
      'description = "Initial auth schema."',
      'verify = "Run node --test tests/"',
      'covers = ["R1"]'
    ].join("\n")
  ];

  const storiesMeta = [
    { id: 2, key: "1-2-session-config", title: "Session Config Setup" },
    { id: 3, key: "1-3-middleware-guard", title: "Middleware Auth Guard" },
    { id: 4, key: "1-4-token-rotation", title: "Critical Token Rotation" }
  ];

  for (let i = 0; i < includeExtraBacklogStories; i++) {
    const s = storiesMeta[i];
    entries.push(
      [
        "[[entry]]",
        `id = ${s.id}`,
        `v6_key = "${s.key}"`,
        `title = "${s.title}"`,
        'status = "backlog"',
        `description = "Implement ${s.title} for epic-auth."`,
        'verify = "Run node --test tests/"',
        'covers = ["R1"]'
      ].join("\n")
    );
  }

  ws.write("_bmad-output/initiative-demo/tickets/epic-auth/tickets/tickets.toml", entries.join("\n\n") + "\n");
  ws.write(
    "_bmad-output/initiative-demo/tickets/tickets.toml",
    [
      "[[epic]]",
      "id = 1",
      'slug = "epic-auth"',
      'title = "Authentication & Security"',
      'covers = ["R1"]'
    ].join("\n") + "\n"
  );
  ws.write(
    "_bmad-output/initiative-demo/tickets/epic-auth/epic-auth.md",
    "---\ntype: epic\ntitle: Authentication & Security\nstatus: in-progress\n---\n\n# Authentication & Security\n"
  );

  return ws;
}

describe("Closing end-to-end suite (Story 6.7 — UJ-1..UJ-4 & SM-1..SM-5)", () => {
  it("parses assets/panel.html inline script cleanly under zero-eval strict JS (C7)", () => {
    const inlineScript = extractInlineScript(PANEL_HTML);
    assert.doesNotThrow(() => new Function(inlineScript), "panel inline script must parse cleanly without eval");
  });

  it("UJ-1 (SM-1, SM-2, SM-4): edit mid-poll + clean-session launch across hooks, MCP stdio, and panel", async () => {
    const ws = workspaces.create();
    ws.write(
      "_bmad-output/planning-artifacts/product-brief-e2e.md",
      "---\ntitle: E2E Product Brief\nstatus: complete\n---\n\n# Product Brief\n\nComplete product brief ready for PRD.\n"
    );

    // 1. Push live hostModels via bmad_update_advisor over real MCP stdio and check bmad_recommend_next (SM-1).
    const setupRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_update_advisor", {
          hostModels: E2E_HOST_MODELS
        }),
        toolCall(2, "bmad_recommend_next", { topic: "prd" })
      ]
    });
    assertStrictJsonRpcStdout(setupRes);
    const advisorState = setupRes.responses[0].result.structuredContent;
    const recNext = setupRes.responses[1].result.structuredContent;
    assertContextualRecommendations(advisorState.recommendations, advisorState.availableModels);
    assertContextualRecommendations(recNext.recommendations, advisorState.availableModels);

    // 2. Run SessionStart + Stop hooks with strict single-JSON-line stdout isolation.
    const sessionStartRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "session-start",
      payload: {}
    });
    const sessionStartFrame = assertSingleJsonObjectStdout(sessionStartRes);
    assert.match(sessionStartFrame.additionalContext, /Smart Progress:/);
    assert.match(sessionStartFrame.additionalContext, /\/bmad-[a-z0-9-]+\s+".+"/);

    const stopRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      payload: { last_assistant_message: "Finished the product brief." }
    });
    assertSingleJsonObjectStdout(stopRes);

    // 3. Spin up the live panel wired to real MCP stdio (bmad_get_state) + mocked OS SendKeys (bmad_prepare_new_session).
    const sendKeysCalls = [];
    const prepareCalls = [];
    const panel = createLivePanelHarness({
      workspaceRoot: ws.root,
      onPrepareNewSession: async (args) => {
        const startedAt = Date.now();
        const res = await prepareNewSession(ws.root, args, {
          platform: "win32",
          runCommand: async (command, cmdArgs, opts) => {
            sendKeysCalls.push({ command, cmdArgs, opts });
            return {
              ok: true,
              code: 0,
              timedOut: false,
              stdout: "BMAD_CLIPBOARD_OK\r\nBMAD_SENDKEYS_OK\r\n",
              stderr: ""
            };
          }
        });
        prepareCalls.push({ res, elapsedMs: Date.now() - startedAt });
        return res;
      }
    });

    await panel.waitForCondition(() => panel.getLastMcpState() !== null && panel.elements.get("rec-cmd-0"));
    const hooks = panel.getTestHooks();
    const initialScan = panel.getLastMcpState();
    assertContextualRecommendations(initialScan.recommendations, initialScan.availableModels);

    // 4. Focus rec-cmd-0 textarea, edit prompt, and trigger a mid-flight 5s background poll (SM-2).
    const recListEl = panel.elements.get("recommendationsList");
    const cmdTa = panel.elements.get("rec-cmd-0");
    const modelSel = panel.elements.get("rec-model-0");
    assert.ok(cmdTa && modelSel, "panel must render rec-cmd-0 and rec-model-0");

    panel.setAutoRespondGetState(false);
    const pollInterval = panel.intervalCallbacks.find((c) => c.delay === 5000);
    assert.ok(pollInterval, "5000ms background poll interval must be registered");

    // Start a mid-flight background poll first, then focus + edit before it resolves.
    pollInterval.fn();
    assert.equal(hooks.getIsRefreshing(), true, "background poll must enter isRefreshing lock");

    const editedPrompt = `${cmdTa.value.replace(/"$/, "")} --constraint "Keep zero npm deps"`;
    const finalizedPrompt = `${editedPrompt}"`;
    const rendersBeforeFocus = recListEl.innerHtmlSetCount;

    cmdTa.focus();
    cmdTa.value = finalizedPrompt;
    cmdTa.dispatchEvent({ type: "input", target: cmdTa });
    assert.equal(hooks.isUserInteractingWithForm(), true, "SM-2: form guard must activate while textarea is focused");

    // Resolve the in-flight MCP poll while user is actively typing.
    await panel.resolveNextGetState();
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(hooks.getPendingWorkspaceState(), "SM-2: background poll payload must stash in pendingWorkspaceState");
    assert.equal(
      recListEl.innerHtmlSetCount,
      rendersBeforeFocus,
      "SM-2: DOM must not re-render while textarea has focus"
    );
    assert.equal(cmdTa.value, finalizedPrompt, "SM-2: active textarea edit must never be overwritten");

    // Also test an inbound tool-result notification while focused.
    panel.dispatchWindowMessage({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: initialScan }
    });
    assert.equal(recListEl.innerHtmlSetCount, rendersBeforeFocus, "SM-2: tool-result must stash while focused");

    // Blur textarea -> deferred flush <= 100ms, preserving userEditedPrompts.
    cmdTa.blur();
    assert.equal(hooks.isUserInteractingWithForm(), false, "SM-2: form guard must clear after blur");
    const flushTimer = panel.scheduledTimers.find((t) => t.delay <= 100);
    assert.ok(flushTimer, "SM-2: deferred flush timer must schedule within <= 100ms");
    panel.flushTimers();
    assert.equal(hooks.getPendingWorkspaceState(), null, "SM-2: pendingWorkspaceState must flush after focusout");
    assert.equal(panel.elements.get("rec-cmd-0").value, finalizedPrompt, "SM-2: userEditedPrompts preserved after flush");

    // Open model dropdown and change model mid-poll window; guard activates for 15000ms on pointerdown.
    const chosenModel = "new-provider/claude-sonnet-5-5-high";
    const selectEl = panel.elements.get("rec-model-0");
    selectEl.dispatchEvent({ type: "pointerdown", target: selectEl });
    assert.equal(hooks.isUserInteractingWithForm(), true, "SM-2: select pointerdown activates 15000ms guard");
    selectEl.value = chosenModel;
    selectEl.dispatchEvent({ type: "change", target: selectEl });
    panel.flushTimers();
    assert.equal(panel.elements.get("rec-model-0").value, chosenModel, "SM-2: userSelectedModels preserved");

    // 5. Click the rendered Launch in New Session button (SM-4).
    const launchBtn = recListEl
      .querySelectorAll("button[data-action]")
      .find((b) => b.getAttribute("data-action") === "launch-new-rec" && b.getAttribute("data-idx") === "0");
    assert.ok(launchBtn, "Launch in New Session button must be rendered");

    const launchStartMs = Date.now();
    await launchBtn.dispatchEvent({ type: "click", target: launchBtn });
    await panel.waitForCondition(() => prepareCalls.length === 1);
    const launchElapsedMs = Date.now() - launchStartMs;

    assert.ok(launchElapsedMs < 5000, `SM-4: clean-session launch took ${launchElapsedMs}ms, must be < 5000ms`);
    assert.equal(sendKeysCalls.length, 1);
    assert.equal(sendKeysCalls[0].opts.env.BMAD_OPEN_DIRECTLY, "1");
    assert.equal(sendKeysCalls[0].opts.env.BMAD_PROMPT_B64, Buffer.from(finalizedPrompt, "utf8").toString("base64"));
    const psScript = sendKeysCalls[0].cmdArgs.join(" ");
    assert.equal(/\{enter\}|return/i.test(psScript), false, "SM-4: single-launch must never auto-submit");

    const launchOutcome = prepareCalls[0].res;
    assert.equal(launchOutcome.copied, true);
    assert.equal(launchOutcome.openedDirectly, true);
    assert.equal(launchOutcome.pasted, true);
    await panel.waitForCondition(() =>
      /New conversation opened & prompt pasted/.test(panel.elements.get("toastText")?.textContent || "")
    );
    assert.match(panel.elements.get("toastText").textContent, /New conversation opened & prompt pasted/);

    const persistedAfterPanelLaunch = readJsonFile(ws.statePath);
    assert.equal(persistedAfterPanelLaunch.lastLaunchedSession.prompt, finalizedPrompt);
    assert.equal(persistedAfterPanelLaunch.lastLaunchedSession.model, chosenModel);

    // 6. Also prove bmad_prepare_new_session works over real spawned MCP stdio (openDirectly: false avoids OS focus hijack).
    const stdioLaunchStart = Date.now();
    const stdioLaunchRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_prepare_new_session", {
          prompt: finalizedPrompt,
          model: chosenModel,
          skill: "/bmad-prd",
          title: "Create PRD",
          openDirectly: false
        })
      ]
    });
    const stdioElapsed = Date.now() - stdioLaunchStart;
    assertStrictJsonRpcStdout(stdioLaunchRes);
    assert.ok(stdioElapsed < 5000, `SM-4: MCP stdio prepare_new_session took ${stdioElapsed}ms`);
    assert.equal(stdioLaunchRes.responses[0].result.structuredContent.prompt, finalizedPrompt);
    assert.equal(stdioLaunchRes.responses[0].result.structuredContent.model, chosenModel);
  });

  it("UJ-2 (SM-3): dual progress detection + dryRun + safe reconcile with .bak and audit ledger", async () => {
    const ws = workspaces.seedDualMetric();

    // Enrich v6 sprint-status.yaml with summary headers, comments, indentation, and an unrelated key.
    const originalYaml = [
      "# Sprint Status Header",
      "# Completed Stories: 0 of 2",
      "# Remaining Backlog: 2 stories",
      "# Progress: 0% (0/2 stories)",
      "",
      "development_status:",
      "  epic-1: in-progress  # Core epic",
      "  1-1-seed-fixture: backlog  # Has done story plan",
      "  1-2-verify-scan: in-progress  # Active",
      "  unrelated-config-key: keep-me"
    ].join("\n") + "\n";
    ws.write("_bmad-output/implementation-artifacts/sprint-status.yaml", originalYaml);
    const originalToml = ws.read("_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml");

    // 1. Initial scan over MCP stdio shows lag between static and smart progress.
    const preRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_get_state", { refresh: true }),
        toolCall(2, "bmad_reconcile_trackers", { dryRun: true })
      ]
    });
    assertStrictJsonRpcStdout(preRes);

    const preScan = preRes.responses[0].result.structuredContent;
    const dryRunResult = preRes.responses[1].result.structuredContent;

    assert.ok(
      preScan.metrics.smartDoneStories > preScan.metrics.declaredDoneStories,
      "UJ-2: smartDoneStories must exceed declaredDoneStories before reconcile"
    );
    assert.ok(
      preScan.metrics.smartOverallPct > preScan.metrics.declaredOverallPct,
      "UJ-2: smartOverallPct must exceed declaredOverallPct before reconcile"
    );
    assert.ok(preScan.metrics.reconciledStoriesCount > 0, "UJ-2: reconciledStoriesCount > 0");
    const upgraded = preScan.epics[0].stories.find((s) => s.id === "1.1");
    assert.equal(upgraded.smartStatus, "done");
    assert.ok(upgraded.smartReason && upgraded.smartReason.length > 0, "UJ-2: upgraded story must carry smartReason");

    assert.equal(dryRunResult.dryRun, true);
    assert.ok(dryRunResult.changesCount > 0, "dryRun must preview pending tracker changes");
    assert.equal(ws.exists("_bmad-output/implementation-artifacts/sprint-status.yaml.bak"), false);
    assert.equal(ws.read("_bmad-output/implementation-artifacts/sprint-status.yaml"), originalYaml);

    // 2. Live reconcile over MCP stdio (backup: true).
    const liveRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_reconcile_trackers", { dryRun: false, target: "all", backup: true }),
        toolCall(2, "bmad_get_state", { refresh: true })
      ]
    });
    assertStrictJsonRpcStdout(liveRes);

    const recResult = liveRes.responses[0].result.structuredContent;
    const postScan = liveRes.responses[1].result.structuredContent;

    assert.equal(recResult.dryRun, false);
    assert.ok(recResult.changesCount > 0);
    assert.equal(recResult.after.declaredDoneStories, recResult.after.smartDoneStories);
    assert.equal(recResult.after.declaredOverallPct, recResult.after.smartOverallPct);

    // SM-3: 100% .bak creation preserving pre-reconcile content byte-for-byte.
    assert.equal(ws.exists("_bmad-output/implementation-artifacts/sprint-status.yaml.bak"), true, "SM-3: v6 .bak must exist");
    assert.equal(
      ws.read("_bmad-output/implementation-artifacts/sprint-status.yaml.bak"),
      originalYaml,
      "SM-3: v6 .bak must preserve original YAML byte-for-byte"
    );
    assert.equal(
      ws.exists("_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml.bak"),
      true,
      "SM-3: v7 .bak must exist"
    );
    assert.equal(
      ws.read("_bmad-output/initiative-demo/tickets/epic-core/tickets/tickets.toml.bak"),
      originalToml,
      "SM-3: v7 .bak must preserve original TOML byte-for-byte"
    );

    // SM-3: comments, indentation, unrelated keys preserved; header counters updated; syntactically valid on re-scan.
    const reconciledYaml = ws.read("_bmad-output/implementation-artifacts/sprint-status.yaml");
    assert.match(reconciledYaml, /# Sprint Status Header/);
    assert.match(reconciledYaml, /# Completed Stories: \d+ of \d+ \(Reconciled by BMAD Companion\)/);
    assert.match(reconciledYaml, /  1-1-seed-fixture: done/);
    assert.match(reconciledYaml, /  unrelated-config-key: keep-me/);

    const log = readJsonFile(ws.path(".zcode/bmad-companion/reconciliation-log.json"));
    assert.ok(Array.isArray(log) && log.length >= 1, "UJ-2: reconciliation-log.json must record audit entry");
    assert.equal(log[log.length - 1].changesCount, recResult.changesCount);

    // Post-reconcile scan aligns static and smart progress (reconciled story now declared done).
    assert.equal(postScan.metrics.declaredOverallPct, postScan.metrics.smartOverallPct);
    assert.equal(postScan.metrics.declaredDoneStories, postScan.metrics.smartDoneStories);
    assert.ok(postScan.metrics.reconciledStoriesCount < preScan.metrics.reconciledStoriesCount);
    const postUpgraded = postScan.epics[0].stories.find((s) => s.id === "1.1");
    assert.equal(postUpgraded.declaredStatus, "done");
    assert.equal(postUpgraded.aiReconciled, false);
    assert.doesNotThrow(() => scanBmadWorkspace(ws.root), "SM-3: reconciled trackers must remain valid on re-scan");
  });

  it("UJ-3 (SM-5): queue epic + review gates (none/quick/thorough) + workflow + hook auto-advance", async () => {
    const ws = seedAuthEpicWorkspace({ includeExtraBacklogStories: 3 });
    // Push live hostModels via MCP advisor first so models resolve cleanly.
    const initRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_update_advisor", { hostModels: E2E_HOST_MODELS }),
        toolCall(2, "bmad_queue_manage", {
          action: "add-epic",
          epicSlug: "epic-auth",
          includeDone: false
        })
      ]
    });
    assertStrictJsonRpcStdout(initRes);

    const addedQueue = initRes.responses[1].result.structuredContent.queueActionResult.taskQueue;
    assert.equal(addedQueue.items.length, 3, "add-epic with includeDone:false must queue only the 3 pending stories");
    const [tNone, tQuick, tThorough] = addedQueue.items;

    // Assign per-task models and all 3 reviewModes (none, quick, thorough), compile dynamic-workflow.
    const wfRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_queue_manage", {
          action: "update-item",
          taskId: tNone.id,
          model: "new-provider/gemini-4-argon-high",
          reviewMode: "none"
        }),
        toolCall(2, "bmad_queue_manage", {
          action: "update-item",
          taskId: tQuick.id,
          model: "new-provider/claude-sonnet-5-5-high",
          reviewMode: "quick"
        }),
        toolCall(3, "bmad_queue_manage", {
          action: "update-item",
          taskId: tThorough.id,
          model: "new-provider/claude-opus-5-5-high",
          reviewMode: "thorough"
        }),
        toolCall(4, "bmad_queue_manage", {
          action: "start-queue",
          executionMode: "dynamic-workflow"
        })
      ]
    });
    assertStrictJsonRpcStdout(wfRes);

    const startWfPayload = wfRes.responses[3].result.structuredContent.queueActionResult;
    const wfQueue = startWfPayload.taskQueue;
    const generated = startWfPayload.generatedWorkflow;

    // SM-5: 100% adherence to reviewMode (none, quick, thorough) in effectivePrompts.
    const qNone = wfQueue.items.find((i) => i.id === tNone.id);
    const qQuick = wfQueue.items.find((i) => i.id === tQuick.id);
    const qThorough = wfQueue.items.find((i) => i.id === tThorough.id);

    assert.match(qNone.effectivePrompt, /review:\s*none/i);
    assert.equal(/multi-lens|bmad-code-review|self-review/i.test(qNone.effectivePrompt), false, "SM-5: none must not leak review gate");
    assert.match(qQuick.effectivePrompt, /review:\s*quick|self-review/i);
    assert.match(qThorough.effectivePrompt, /review:\s*thorough|multi-lens/i);

    assert.equal(ws.exists(".zcode/workflows/bmad-task-queue.dwf.ts"), true, "UJ-3: .dwf.ts must be generated");
    assert.equal(ws.exists(".zcode/bmad-companion/queue-step-updater.mjs"), true, "UJ-3: step updater must be generated");
    assert.equal(generated.tasksCount, 3);

    const dwfText = ws.read(".zcode/workflows/bmad-task-queue.dwf.ts");
    assert.match(dwfText, /new-provider\/gemini-4-argon-high/);
    assert.match(dwfText, /new-provider\/claude-sonnet-5-5-high/);
    assert.match(dwfText, /new-provider\/claude-opus-5-5-high/);

    // Switch to separate-sessions mode and drive UserPromptSubmit -> PostToolUse -> Stop hooks.
    const sepRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_queue_manage", {
          action: "start-queue",
          executionMode: "separate-sessions"
        })
      ]
    });
    assertStrictJsonRpcStdout(sepRes);
    const sepWf = sepRes.responses[0].result.structuredContent.queueActionResult.generatedWorkflow;
    assert.match(sepWf.separateSessionsPrompt, /CreateSession/);
    assert.match(sepWf.separateSessionsPrompt, /start-task/);

    const sessionId = "sess_uj3_task1";
    const upRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "user-prompt",
      env: { ZCODE_SESSION_ID: sessionId },
      payload: { prompt: qNone.effectivePrompt }
    });
    assertSingleJsonObjectStdout(upRes);

    const postRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "post-tool",
      env: { ZCODE_SESSION_ID: sessionId },
      payload: { tool_name: "Write", tool_input: { file_path: ws.path("src/auth/session-config.mjs") } }
    });
    assertSingleJsonObjectStdout(postRes);

    const stopRes = await runHookRunner({
      workspaceRoot: ws.root,
      mode: "stop",
      env: { ZCODE_SESSION_ID: sessionId },
      payload: { last_assistant_message: "Completed Session Config Setup with passing tests." }
    });
    const stopFrame = assertSingleJsonObjectStdout(stopRes);
    assert.equal(stopFrame.decision, "block", "Stop hook must hand off separate-sessions queue to task 2");
    assert.match(stopFrame.reason, new RegExp(qQuick.id));

    // SM-5 counter-metric: 100% state sync between taskQueue and storyOverrides.
    const postHookState = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [toolCall(1, "bmad_get_state", { refresh: true })]
    });
    assertStrictJsonRpcStdout(postHookState);
    const scanAfter = postHookState.responses[0].result.structuredContent;
    const persistedAfter = readJsonFile(ws.statePath);

    const doneItem = scanAfter.taskQueue.items.find((i) => i.id === qNone.id);
    assert.equal(doneItem.status, "done");
    assert.equal(persistedAfter.storyOverrides[qNone.overrideKey]?.status, "done", "SM-5: storyOverrides must sync with completed task");
    assert.deepEqual(persistedAfter.recentTouchedFiles, ["src/auth/session-config.mjs"]);
    assert.equal(scanAfter.taskQueue.counts.done, 1);
    assert.equal(scanAfter.taskQueue.counts.queued, 2);
  });

  it("UJ-4 (R7, R8, R17, C3): artifact inspect/open diff with workspace confinement", async () => {
    const ws = workspaces.seed();
    const prdRel = "_bmad-output/planning-artifacts/prd-demo/prd-demo.md";
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: "E2E Tester",
      GIT_AUTHOR_EMAIL: "e2e@example.com",
      GIT_COMMITTER_NAME: "E2E Tester",
      GIT_COMMITTER_EMAIL: "e2e@example.com"
    };
    const runGit = (args) => execFileSync("git", ["-C", ws.root, ...args], { env: gitEnv, stdio: "pipe" });

    runGit(["init"]);
    runGit(["add", "."]);
    runGit(["commit", "-m", "Initial seeded workspace"]);

    // Modify PRD artifact in working tree to produce a real git diff vs HEAD.
    ws.write(
      prdRel,
      "---\ntitle: Demo PRD\nstatus: review\n---\n\n# Product Requirements\n\n- Added E2E UJ-4 requirement.\n"
    );

    const mcpRes = await runMcpServer({
      workspaceRoot: ws.root,
      requests: [
        toolCall(1, "bmad_get_state", { refresh: true }),
        toolCall(2, "bmad_inspect_artifact", { relPath: prdRel }),
        toolCall(3, "bmad_inspect_artifact", { relPath: "../outside-secret.md" }),
        toolCall(4, "bmad_open_artifact_file", { relPath: "../outside-secret.md" })
      ]
    });
    assertStrictJsonRpcStdout(mcpRes);

    const scan = mcpRes.responses[0].result.structuredContent;
    const prdArtifact = scan.artifacts.find((a) => a.relPath === prdRel);
    assert.ok(prdArtifact, "UJ-4: scanner must discover modified PRD artifact with normalized / path");
    assert.ok(scan.artifacts.every((a) => !a.relPath.includes("\\")), "C3: all artifact relPaths use /");

    const inspected = mcpRes.responses[1].result.structuredContent;
    assert.equal(inspected.relPath, prdRel);
    assert.equal(inspected.diffSource, "Working tree diff vs HEAD");
    assert.match(inspected.diff, /\+- Added E2E UJ-4 requirement\./);
    assert.deepEqual(inspected.meta, { title: "Demo PRD", status: "review" });
    assert.match(inspected.preview, /Added E2E UJ-4 requirement/);

    // C3: path traversal escapes rejected on both inspect and open.
    assert.equal(mcpRes.responses[2].result.isError, true);
    assert.equal(mcpRes.responses[2].result.content[0].text, "Artifact path must stay within the workspace root.");
    assert.equal(mcpRes.responses[3].result.isError, true);
    assert.equal(mcpRes.responses[3].result.content[0].text, "Artifact path must stay within the workspace root.");

    // Open in editor via injectable launcher (avoids spawning desktop editor windows during tests).
    const execCalls = [];
    const opened = openWorkspaceArtifactExternally(ws.root, prdRel, {
      platform: "linux",
      execFileSync: (cmd, args, opts) => {
        execCalls.push({ cmd, args, opts });
      }
    });
    assert.equal(opened.opened, true);
    assert.equal(opened.relPath, prdRel);
    assert.equal(execCalls.length, 1);
    assert.equal(execCalls[0].cmd, "xdg-open");
    assert.equal(execCalls[0].args[0], ws.path(prdRel));
  });
});
