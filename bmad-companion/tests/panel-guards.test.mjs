import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

import { PANEL_HTML_PATH, extractInlineScript } from "./helpers.mjs";

const PANEL_HTML = readFileSync(PANEL_HTML_PATH, "utf8");

function createStubbedDomEnvironment(initialOptions = {}) {
  const elements = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  const outboundMessages = [];
  const toolCalls = [];
  const pendingToolResolutions = [];
  const intervalCallbacks = [];
  const scheduledTimers = [];

  let nextTimerId = 1;
  let activeElement = null;
  let isHidden = initialOptions.hidden ?? false;
  let visibilityState = initialOptions.visibilityState ?? "visible";
  let autoRespondGetState = initialOptions.autoRespondGetState ?? true;

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

    const el = {
      id,
      tagName: tagName.toUpperCase(),
      style: { width: "", display: "" },
      listeners,
      attributes,
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
      querySelectorAll() {
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

    let innerHtmlSetCount = 0;

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
        for (const match of innerHtmlVal.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi)) {
          const childEl = elements.get(match[3]) || makeElement(match[3], match[1]);
          childEl.tagName = match[1].toUpperCase();
          for (const attr of match[2].matchAll(/([a-z0-9-]+)="([^"]*)"/gi)) {
            childEl.setAttribute(attr[1], attr[2]);
            if (attr[1] === "class") {
              attr[2].split(/\s+/).filter(Boolean).forEach((c) => childEl.classList.add(c));
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

  // Pre-seed elements with IDs from panel markup
  const panelMarkup = PANEL_HTML.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "");
  for (const match of panelMarkup.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi)) {
    const el = elements.get(match[3]) || makeElement(match[3], match[1]);
    for (const attr of match[2].matchAll(/([a-z0-9-]+)="([^"]*)"/gi)) {
      el.setAttribute(attr[1], attr[2]);
      if (attr[1] === "class") {
        attr[2].split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
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

  function buildSampleState(overrides = {}) {
    return {
      projectName: "Test Project",
      techStack: "Node ESM",
      metrics: {
        totalEpics: 4,
        totalStories: 20,
        smartDoneStories: 5,
        smartOverallPct: 25
      },
      git: { branch: "main" },
      providerState: {},
      phases: [],
      epics: [],
      recommendations: [],
      ...overrides
    };
  }

  const sandbox = {
    console: { warn() {}, error() {}, log() {} },
    setTimeout: (fn, delay = 0) => {
      const id = nextTimerId++;
      scheduledTimers.push({ id, fn, delay, due: Date.now() + delay });
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
            toolCalls.push(msg);
            if (msg.params?.name === "bmad_get_state") {
              if (autoRespondGetState) {
                queueMicrotask(() => {
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: { structuredContent: buildSampleState() }
                  });
                });
              } else {
                pendingToolResolutions.push((result = buildSampleState()) => {
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: { structuredContent: result }
                  });
                });
              }
            }
          }
        }
      }
    }
  };

  // Run panel inline script inside vm context
  const scriptContent = extractInlineScript(PANEL_HTML);
  vm.runInContext(scriptContent, vm.createContext(sandbox));

  return {
    sandbox,
    elements,
    makeElement,
    toolCalls,
    outboundMessages,
    intervalCallbacks,
    scheduledTimers,
    pendingToolResolutions,
    buildSampleState,
    dispatchDocumentEvent,
    dispatchWindowMessage,
    getActiveElement: () => activeElement,
    setActiveElement: (el) => {
      activeElement = el;
    },
    setHidden: (val) => {
      isHidden = Boolean(val);
    },
    setVisibilityState: (val) => {
      visibilityState = String(val);
    },
    setAutoRespondGetState: (val) => {
      autoRespondGetState = Boolean(val);
    },
    resolveNextGetState(state = buildSampleState()) {
      const resolver = pendingToolResolutions.shift();
      assert.ok(resolver, "No pending bmad_get_state call to resolve");
      resolver(state);
    },
    flushTimers() {
      const toRun = scheduledTimers.splice(0, scheduledTimers.length);
      toRun.sort((a, b) => a.delay - b.delay);
      for (const t of toRun) {
        t.fn();
      }
    },
    async flushMicrotasks() {
      await new Promise((resolve) => setTimeout(resolve, 10));
    },
    getTestHooks() {
      return sandbox.window.__bmadTestHooks;
    }
  };
}

describe("Epic 4 Story 4.1: Poll-loop guard tracer (visible-gated 5s poll + isRefreshing + stash/flush)", () => {
  it("exposes test hooks on window under strict zero-eval inline execution", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();
    assert.ok(hooks, "window.__bmadTestHooks must be exposed");
    assert.equal(typeof hooks.isUserInteractingWithForm, "function");
    assert.equal(typeof hooks.flushPendingState, "function");
    assert.equal(typeof hooks.refreshState, "function");
    assert.equal(typeof hooks.isPanelVisible, "function");
    assert.equal(typeof hooks.getIsRefreshing, "function");
    assert.equal(typeof hooks.getPendingWorkspaceState, "function");
  });

  it("skips poll callback when document is hidden or visibilityState is hidden", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const pollInterval = env.intervalCallbacks.find((c) => c.delay === 5000);
    assert.ok(pollInterval, "5000ms poll interval must be registered");

    const initialToolCallsCount = env.toolCalls.length;

    // 1. When hidden = true
    env.setHidden(true);
    env.setVisibilityState("visible");
    assert.equal(hooks.isPanelVisible(), false, "isPanelVisible must be false when hidden is true");
    pollInterval.fn();
    await env.flushMicrotasks();
    assert.equal(env.toolCalls.length, initialToolCallsCount, "Poll must skip when document.hidden is true");

    // 2. When visibilityState = 'hidden'
    env.setHidden(false);
    env.setVisibilityState("hidden");
    assert.equal(hooks.isPanelVisible(), false, "isPanelVisible must be false when visibilityState is 'hidden'");
    pollInterval.fn();
    await env.flushMicrotasks();
    assert.equal(env.toolCalls.length, initialToolCallsCount, "Poll must skip when visibilityState is 'hidden'");

    // 3. When visible and not hidden
    env.setHidden(false);
    env.setVisibilityState("visible");
    assert.equal(hooks.isPanelVisible(), true, "isPanelVisible must be true when visible");
    pollInterval.fn();
    await env.flushMicrotasks();
    assert.equal(
      env.toolCalls.length,
      initialToolCallsCount + 1,
      "Poll must dispatch bmad_get_state when document is visible"
    );
  });

  it("serializes concurrent polls under the isRefreshing lock (overlapping polls return immediately)", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();

    // Initial tool call from initMcpApp is pending
    const initialCalls = env.toolCalls.length;
    assert.equal(initialCalls, 1, "initMcpApp dispatches initial bmad_get_state");
    assert.equal(hooks.getIsRefreshing(), true, "isRefreshing must be true while initial call is pending");

    // Attempt second poll while first is pending
    hooks.refreshState({ isBackground: true });
    assert.equal(
      env.toolCalls.length,
      initialCalls,
      "Second poll must return immediately without dispatching another RPC call"
    );

    // Resolve the first call
    env.resolveNextGetState();
    await env.flushMicrotasks();

    assert.equal(hooks.getIsRefreshing(), false, "isRefreshing must reset to false after resolution");

    // Now a subsequent poll is permitted
    hooks.refreshState({ isBackground: true });
    assert.equal(env.toolCalls.length, initialCalls + 1, "Subsequent poll must proceed once lock is released");
    assert.equal(hooks.getIsRefreshing(), true, "isRefreshing must be set to true for new poll");

    // Attempt concurrent overlapping poll
    hooks.refreshState({ isBackground: true });
    assert.equal(
      env.toolCalls.length,
      initialCalls + 1,
      "Overlapping poll must return immediately under isRefreshing lock"
    );

    // Resolve the second call
    env.resolveNextGetState();
    await env.flushMicrotasks();
    assert.equal(hooks.getIsRefreshing(), false, "isRefreshing must reset to false");
  });

  it("stashes mid-flight background poll during textarea interaction and flushes on focusout <=100ms", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();
    // Resolve initial call
    env.resolveNextGetState(env.buildSampleState({ projectName: "Base Project" }));
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const titleEl = env.elements.get("projectTitle");
    assert.match(titleEl.textContent, /Base Project/, "Initial title rendered");

    // Trigger background poll
    hooks.refreshState({ isBackground: true });
    assert.equal(hooks.getIsRefreshing(), true, "Background poll in flight");

    // User starts typing in a command textarea mid-flight
    const textarea = env.makeElement("cmd-ta", "TEXTAREA");
    textarea.value = "my in-progress prompt edit";
    textarea.focus();

    assert.equal(hooks.isUserInteractingWithForm(), true, "Guard must be active during textarea focus");

    // Mid-flight poll resolves with updated project title
    const nextState = env.buildSampleState({ projectName: "Server Updated Project" });
    env.resolveNextGetState(nextState);
    await env.flushMicrotasks();

    // Verify stashing behavior: pendingWorkspaceState is saved, but titleEl was NOT updated
    assert.deepEqual(
      hooks.getPendingWorkspaceState(),
      nextState,
      "Result must be stashed in pendingWorkspaceState"
    );
    assert.match(titleEl.textContent, /Base Project/, "DOM must NOT be updated while textarea is focused");

    // User blurs the textarea (triggers focusout)
    textarea.blur();
    assert.equal(hooks.isUserInteractingWithForm(), false, "Guard must clear once activeElement is not form element");

    // Check timer scheduled for <=100ms (50ms focusout debounce)
    const flushTimer = env.scheduledTimers.find((t) => t.delay <= 100);
    assert.ok(flushTimer, "Flush timer must be scheduled <=100ms (50ms focusout delay)");
    assert.equal(flushTimer.delay, 50, "Focusout debounce is 50ms");

    // Advance timer to trigger flush
    env.flushTimers();
    await env.flushMicrotasks();

    // Verify flush behavior: pendingWorkspaceState is cleared and DOM is updated
    assert.equal(hooks.getPendingWorkspaceState(), null, "pendingWorkspaceState must be null after flush");
    assert.match(
      titleEl.textContent,
      /Server Updated Project/,
      "DOM must be updated with stashed state after focusout flush"
    );
  });

  it("stashes inbound tool-result notification while input is focused and flushes on focusout", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const input = env.makeElement("filter-input", "INPUT");
    input.focus();

    assert.equal(hooks.isUserInteractingWithForm(), true, "Guard is active on INPUT focus");

    const notifiedState = env.buildSampleState({ projectName: "Notified State" });
    env.dispatchWindowMessage({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: notifiedState }
    });

    assert.deepEqual(
      hooks.getPendingWorkspaceState(),
      notifiedState,
      "tool-result must be stashed while input is focused"
    );

    const titleEl = env.elements.get("projectTitle");
    assert.doesNotMatch(titleEl.textContent, /Notified State/);

    // Blur input
    input.blur();
    env.flushTimers();
    await env.flushMicrotasks();

    assert.equal(hooks.getPendingWorkspaceState(), null, "pendingWorkspaceState cleared after flush");
    assert.match(titleEl.textContent, /Notified State/, "DOM updated after flush on input blur");
  });

  it("guards during 15000ms select window on pointerdown and flushes immediately on select change, Escape, or Tab", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const select = env.makeElement("modelSelect", "SELECT");

    // 1. Pointerdown on select sets 15000ms selectOpenUntil window
    env.dispatchDocumentEvent({ type: "pointerdown", target: select });
    assert.ok(hooks.getSelectOpenUntil() > Date.now(), "selectOpenUntil set to future timestamp on pointerdown");
    assert.equal(hooks.isUserInteractingWithForm(), true, "Guard active during select window");

    // Stash state during select window
    const selectState1 = env.buildSampleState({ projectName: "Select State 1" });
    hooks.setPendingWorkspaceState(selectState1);

    // Change event on select clears selectOpenUntil and flushes immediately (delay 0)
    env.dispatchDocumentEvent({ type: "change", target: select });
    assert.equal(hooks.getSelectOpenUntil(), 0, "selectOpenUntil cleared on select change");

    env.flushTimers();
    await env.flushMicrotasks();
    assert.equal(hooks.getPendingWorkspaceState(), null, "Stash flushed on select change");
    assert.match(env.elements.get("projectTitle").textContent, /Select State 1/);

    // 2. Keydown Escape on focused select clears window and flushes
    select.focus();
    env.dispatchDocumentEvent({ type: "pointerdown", target: select });
    assert.ok(hooks.getSelectOpenUntil() > Date.now());

    const selectState2 = env.buildSampleState({ projectName: "Select State 2" });
    hooks.setPendingWorkspaceState(selectState2);

    env.dispatchDocumentEvent({ type: "keydown", key: "Escape" });
    assert.equal(hooks.getSelectOpenUntil(), 0, "selectOpenUntil cleared on select Escape");

    env.flushTimers();
    await env.flushMicrotasks();
    assert.equal(hooks.getPendingWorkspaceState(), null, "Stash flushed on select Escape");
    assert.match(env.elements.get("projectTitle").textContent, /Select State 2/);

    // 3. Keydown Tab on focused select clears window and flushes
    env.dispatchDocumentEvent({ type: "pointerdown", target: select });
    assert.ok(hooks.getSelectOpenUntil() > Date.now());

    const selectState3 = env.buildSampleState({ projectName: "Select State 3" });
    hooks.setPendingWorkspaceState(selectState3);

    env.dispatchDocumentEvent({ type: "keydown", key: "Tab" });
    assert.equal(hooks.getSelectOpenUntil(), 0, "selectOpenUntil cleared on select Tab");

    env.flushTimers();
    await env.flushMicrotasks();
    assert.equal(hooks.getPendingWorkspaceState(), null, "Stash flushed on select Tab");
    assert.match(env.elements.get("projectTitle").textContent, /Select State 3/);
  });

  it("skips fetch when user is already interacting with form, but allows explicit sync to render", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const textarea = env.makeElement("prompt-ta", "TEXTAREA");
    textarea.focus();

    const callsBefore = env.toolCalls.length;

    // Background poll entry while already interacting skips RPC fetch entirely
    await hooks.refreshState({ isBackground: true });
    assert.equal(env.toolCalls.length, callsBefore, "Background poll skips fetch when user is already typing");

    // Explicit sync (isBackground: false) proceeds even while form is focused
    await hooks.refreshState({ isBackground: false });
    await env.flushMicrotasks();
    assert.equal(env.toolCalls.length, callsBefore + 1, "Explicit sync proceeds even while form is focused");
  });

  it("preserves user edits across background poll stashes with zero lost edits (SM-2)", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();

    const initialRecs = [
      {
        skill: "/bmad-build",
        headline: "Build Story 1",
        recommendedModel: { modelId: "test-model" },
        userSelectableModels: [{ modelId: "test-model", label: "Test Model" }],
        customPromptText: "original command"
      }
    ];

    env.resolveNextGetState(env.buildSampleState({ recommendations: initialRecs }));
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();

    // User edits the recommendation prompt
    const userPromptMap = hooks.getUserEditedPrompts();
    const recKey = "rec:/bmad-build:Build Story 1";
    userPromptMap.set(recKey, { base: "original command", value: "Alex edited prompt text" });

    // Background poll triggers mid-flight
    hooks.refreshState({ isBackground: true });
    assert.equal(hooks.getIsRefreshing(), true);

    // Focus textarea mid-flight and edit
    const ta = env.makeElement("rec-cmd-0", "TEXTAREA");
    ta.value = "Alex edited prompt text";
    ta.focus();

    // Background poll returns with same base command
    env.resolveNextGetState(
      env.buildSampleState({
        recommendations: [
          {
            skill: "/bmad-build",
            headline: "Build Story 1",
            recommendedModel: { modelId: "test-model" },
            userSelectableModels: [{ modelId: "test-model", label: "Test Model" }],
            customPromptText: "original command"
          }
        ]
      })
    );
    await env.flushMicrotasks();

    // Stashed while editing
    assert.ok(hooks.getPendingWorkspaceState(), "State is stashed");
    assert.equal(userPromptMap.get(recKey).value, "Alex edited prompt text", "User edit preserved in map");

    // Blur textarea and flush
    ta.blur();
    env.flushTimers();
    await env.flushMicrotasks();

    assert.equal(hooks.getPendingWorkspaceState(), null, "State flushed");
    assert.equal(
      userPromptMap.get(recKey).value,
      "Alex edited prompt text",
      "User edit remains intact with zero lost edits after flush"
    );
  });

  it("blurs active textarea and flushes pending state on Escape keydown", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const ta = env.makeElement("escape-ta", "TEXTAREA");
    ta.focus();

    assert.equal(env.getActiveElement(), ta);
    assert.equal(hooks.isUserInteractingWithForm(), true);

    const stashedState = env.buildSampleState({ projectName: "Escape Flush Project" });
    hooks.setPendingWorkspaceState(stashedState);

    let blurCalled = false;
    const origBlur = ta.blur;
    ta.blur = () => {
      blurCalled = true;
      origBlur();
    };

    env.dispatchDocumentEvent({ type: "keydown", key: "Escape" });
    assert.equal(blurCalled, true, "Escape must blur active textarea");
    assert.equal(hooks.isUserInteractingWithForm(), false);

    env.flushTimers();
    await env.flushMicrotasks();

    assert.equal(hooks.getPendingWorkspaceState(), null, "Pending state must be flushed on Escape");
    assert.match(env.elements.get("projectTitle").textContent, /Escape Flush Project/);
  });

  it("extends selectOpenUntil on SELECT navigation keys (Space, Enter, ArrowDown, ArrowUp)", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const select = env.makeElement("navSelect", "SELECT");
    select.focus();

    for (const key of [" ", "Enter", "ArrowDown", "ArrowUp"]) {
      hooks.setSelectOpenUntil(0);
      assert.equal(hooks.getSelectOpenUntil(), 0);

      env.dispatchDocumentEvent({ type: "keydown", key });
      assert.ok(
        hooks.getSelectOpenUntil() > Date.now(),
        `selectOpenUntil must be extended to future timestamp on '${key}' key`
      );
    }
  });

  it("suppresses flushPendingState when user interaction remains active", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const input = env.makeElement("persistent-input", "INPUT");
    input.focus();

    const stashed = env.buildSampleState({ projectName: "Unflushed State" });
    hooks.setPendingWorkspaceState(stashed);

    // Call flushPendingState while still focused
    hooks.flushPendingState();

    assert.deepEqual(
      hooks.getPendingWorkspaceState(),
      stashed,
      "pendingWorkspaceState must NOT be cleared or rendered while input is focused"
    );
    assert.doesNotMatch(env.elements.get("projectTitle").textContent, /Unflushed State/);
  });

  it("recovers isRefreshing lock when bmad_get_state RPC fails", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();

    // Resolve initial call
    env.resolveNextGetState();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    assert.equal(hooks.getIsRefreshing(), false);

    // Start background poll
    hooks.refreshState({ isBackground: true });
    assert.equal(hooks.getIsRefreshing(), true);

    // Reject RPC call
    const lastMsg = env.toolCalls[env.toolCalls.length - 1];
    env.dispatchWindowMessage({
      jsonrpc: "2.0",
      id: lastMsg.id,
      error: { code: -32000, message: "Workspace read failure" }
    });
    await env.flushMicrotasks();

    assert.equal(hooks.getIsRefreshing(), false, "isRefreshing must reset to false even after RPC error");
    assert.match(
      env.elements.get("projectSubtitle").textContent,
      /Ready · Click Sync/,
      "Subtitle must reflect fallback readiness on error"
    );
  });
});

describe("Epic 4 Story 4.2: User edit preservation + section signature diffing regression", () => {
  it("preserves in-progress prompt and model edits during an unchanged-base poll", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();

    const sampleRec = {
      title: "Build Story 4.2",
      skill: "/bmad-build",
      phase: "4-implementation",
      priority: "high",
      rationale: "Implement story 4.2",
      fullCommand: '/bmad-build "Implement story 4.2"',
      recommendedModel: { modelId: "test-model-1", tier: "Dynamic Fit", reason: "Best fit" }
    };
    const sampleModels = [
      { id: "test-model-1", label: "Model 1", providerName: "Provider A" },
      { id: "test-model-2", label: "Model 2", providerName: "Provider A" }
    ];

    const initialState = env.buildSampleState({
      recommendations: [sampleRec],
      availableModels: sampleModels
    });

    env.resolveNextGetState(initialState);
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const recKey = "rec:/bmad-build:Build Story 4.2";

    // User edits the prompt and model selection in the DOM
    const userPromptMap = hooks.getUserEditedPrompts();
    const userModelMap = hooks.getUserSelectedModels();

    const ta = env.elements.get("rec-cmd-0");
    ta.value = '/bmad-build "Custom edited user prompt"';
    ta.dispatchEvent({ type: "input" });

    const sel = env.elements.get("rec-model-0");
    sel.value = "test-model-2";
    sel.dispatchEvent({ type: "change" });

    assert.equal(
      userPromptMap.get(recKey)?.value,
      '/bmad-build "Custom edited user prompt"',
      "input event populates userEditedPrompts"
    );
    assert.equal(
      userModelMap.get(recKey)?.value,
      "test-model-2",
      "change event populates userSelectedModels"
    );

    // An unchanged-base poll arrives from server (same fullCommand, same recommendedModel, models still valid)
    const polledState = env.buildSampleState({
      recommendations: [sampleRec],
      availableModels: sampleModels
    });

    hooks.renderWorkspaceState(polledState);

    // Prompt edit is preserved
    assert.equal(
      hooks.resolveUserPrompt(recKey, '/bmad-build "Implement story 4.2"'),
      '/bmad-build "Custom edited user prompt"',
      "resolveUserPrompt must return user edit when base matches"
    );
    assert.equal(
      userPromptMap.get(recKey)?.value,
      '/bmad-build "Custom edited user prompt"',
      "userEditedPrompts must retain entry when base matches"
    );

    // Model edit is preserved
    assert.equal(
      hooks.resolveUserModel(recKey, "test-model-1"),
      "test-model-2",
      "resolveUserModel must return user selected model when base matches"
    );
    assert.equal(
      userModelMap.get(recKey)?.value,
      "test-model-2",
      "userSelectedModels must retain entry when base matches"
    );

    // DOM reflects user-preserved values across unchanged poll
    assert.equal(ta.value, '/bmad-build "Custom edited user prompt"');
    assert.equal(sel.value, "test-model-2");

    // Explicit force-render also reflects user-preserved values
    hooks.renderRecommendations(polledState.recommendations, true);
    assert.equal(ta.value, '/bmad-build "Custom edited user prompt"');
    assert.equal(sel.value, "test-model-2");
  });

  it("drops prompt edit and resets to server command when base command changes", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const recKey = "rec:/bmad-build:Build Story 4.2";
    const userPromptMap = hooks.getUserEditedPrompts();

    userPromptMap.set(recKey, {
      base: '/bmad-build "Original server prompt"',
      value: '/bmad-build "User custom prompt"'
    });

    // Server returns an updated command (base differs)
    const newServerCmd = '/bmad-build "Updated server prompt v2"';
    const resolved = hooks.resolveUserPrompt(recKey, newServerCmd);

    assert.equal(resolved, newServerCmd, "Must reset to new server command when base changes");
    assert.equal(userPromptMap.has(recKey), false, "Must drop entry from userEditedPrompts when base changes");
  });

  it("drops model edit and resets to server model when base model changes", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const recKey = "rec:/bmad-build:Build Story 4.2";
    const userModelMap = hooks.getUserSelectedModels();

    userModelMap.set(recKey, {
      base: "test-model-1",
      value: "test-model-2"
    });

    // Server recommended model changes from test-model-1 to test-model-3
    const newServerModel = "test-model-3";
    const resolved = hooks.resolveUserModel(recKey, newServerModel);

    assert.equal(resolved, newServerModel, "Must reset to new server model when base model changes");
    assert.equal(userModelMap.has(recKey), false, "Must drop entry from userSelectedModels when base model changes");
  });

  it("drops model edit and resets to server model when chosen model leaves availableModels", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const recKey = "rec:/bmad-build:Build Story 4.2";
    const userModelMap = hooks.getUserSelectedModels();

    // User selected test-model-2 when available
    userModelMap.set(recKey, {
      base: "test-model-1",
      value: "test-model-2"
    });

    // State is updated such that test-model-2 is no longer in availableModels
    hooks.setCurrentState(
      env.buildSampleState({
        availableModels: [{ id: "test-model-1", label: "Model 1" }]
      })
    );

    // Base model is still test-model-1, but test-model-2 left availableModels
    const resolved = hooks.resolveUserModel(recKey, "test-model-1");

    assert.equal(
      resolved,
      "test-model-1",
      "Must fallback to server model when user-chosen model leaves availableModels"
    );
    assert.equal(
      userModelMap.has(recKey),
      false,
      "Must drop entry from userSelectedModels when chosen model is no longer available"
    );
  });

  it("skips innerHTML replacement when section signatures are unchanged", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const sampleState = env.buildSampleState({
      recommendations: [
        {
          title: "Build Story 1",
          skill: "/bmad-build",
          phase: "4-implementation",
          priority: "high",
          rationale: "Build first",
          fullCommand: '/bmad-build "Story 1"',
          recommendedModel: { modelId: "test-model-1" }
        }
      ],
      smartInsights: [{ title: "Sync Status", detail: "All trackers synchronized", severity: "success" }],
      phases: [{ id: "4-implementation", name: "Implementation", progressPct: 50, artifacts: [] }],
      epics: [
        {
          id: "epic-1",
          slug: "epic-1",
          number: 1,
          title: "Epic 1",
          smartProgressPct: 50,
          declaredProgressPct: 50,
          stories: [{ id: 1, title: "Story 1", smartStatus: "in-progress" }]
        }
      ],
      skillsCatalog: [
        { skill: "bmad-build", displayName: "BMAD Build", description: "Build code", phase: "4-implementation" }
      ],
      artifacts: [
        { relPath: "docs/spec.md", name: "spec.md", kind: "doc", phaseName: "Phase 1", mtimeMs: 1000 }
      ],
      taskQueue: {
        status: "idle",
        executionMode: "dynamic-workflow",
        counts: { total: 0, running: 0, queued: 0, done: 0, failed: 0, progressPct: 0 },
        items: []
      },
      providerState: { activeProviders: [{ providerName: "Provider A", modelCount: 2 }] }
    });

    // Render 1: Populates DOM and establishes baseline signatures
    hooks.renderWorkspaceState(sampleState);

    const recsList = env.elements.get("recommendationsList");
    const insightsList = env.elements.get("insightsList");
    const phasesList = env.elements.get("phasesList");
    const epicsList = env.elements.get("epicsList");
    const skillsList = env.elements.get("skillsCatalogList");
    const artsList = env.elements.get("artifactsDirectoryList");
    const provBar = env.elements.get("providerStateBar");

    const recsCount1 = recsList.innerHtmlSetCount;
    const insightsCount1 = insightsList.innerHtmlSetCount;
    const phasesCount1 = phasesList.innerHtmlSetCount;
    const epicsCount1 = epicsList.innerHtmlSetCount;
    const skillsCount1 = skillsList.innerHtmlSetCount;
    const artsCount1 = artsList.innerHtmlSetCount;
    const provCount1 = provBar.innerHtmlSetCount;

    assert.ok(recsCount1 >= 1, "Initial render sets innerHTML on recommendationsList");
    assert.ok(insightsCount1 >= 1, "Initial render sets innerHTML on insightsList");
    assert.ok(phasesCount1 >= 1, "Initial render sets innerHTML on phasesList");
    assert.ok(epicsCount1 >= 1, "Initial render sets innerHTML on epicsList");

    // Render 2: Identical state - signatures match
    hooks.renderWorkspaceState(sampleState);

    assert.equal(
      recsList.innerHtmlSetCount,
      recsCount1,
      "recommendationsList innerHTML must NOT be replaced when signature matches"
    );
    assert.equal(
      insightsList.innerHtmlSetCount,
      insightsCount1,
      "insightsList innerHTML must NOT be replaced when signature matches"
    );
    assert.equal(
      phasesList.innerHtmlSetCount,
      phasesCount1,
      "phasesList innerHTML must NOT be replaced when signature matches"
    );
    assert.equal(
      epicsList.innerHtmlSetCount,
      epicsCount1,
      "epicsList innerHTML must NOT be replaced when signature matches"
    );
    assert.equal(
      skillsList.innerHtmlSetCount,
      skillsCount1,
      "skillsCatalogList innerHTML must NOT be replaced when signature matches"
    );
    assert.equal(
      artsList.innerHtmlSetCount,
      artsCount1,
      "artifactsDirectoryList innerHTML must NOT be replaced when signature matches"
    );
    assert.equal(
      provBar.innerHtmlSetCount,
      provCount1,
      "providerStateBar innerHTML must NOT be replaced when signature matches"
    );

    // Render 3: Mutate ONLY recommendations - only recommendationsList should update
    const mutatedState = {
      ...sampleState,
      recommendations: [
        ...sampleState.recommendations,
        {
          title: "Build Story 2",
          skill: "/bmad-build",
          phase: "4-implementation",
          priority: "medium",
          rationale: "Build second",
          fullCommand: '/bmad-build "Story 2"',
          recommendedModel: { modelId: "test-model-1" }
        }
      ]
    };
    hooks.renderWorkspaceState(mutatedState);

    assert.equal(
      recsList.innerHtmlSetCount,
      recsCount1 + 1,
      "recommendationsList innerHTML must update when its data changes"
    );
    assert.equal(
      insightsList.innerHtmlSetCount,
      insightsCount1,
      "insightsList innerHTML must remain untouched when its data is unchanged"
    );
    assert.equal(
      phasesList.innerHtmlSetCount,
      phasesCount1,
      "phasesList innerHTML must remain untouched when its data is unchanged"
    );
    assert.equal(
      epicsList.innerHtmlSetCount,
      epicsCount1,
      "epicsList innerHTML must remain untouched when its data is unchanged"
    );
  });

  it("renders immediately during explicit sync (isBackground: false) while a form element is focused", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();

    // Initial state
    env.resolveNextGetState(env.buildSampleState({ projectName: "Base Project" }));
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const titleEl = env.elements.get("projectTitle");
    assert.match(titleEl.textContent, /Base Project/);

    // Focus a textarea
    const ta = env.makeElement("active-ta", "TEXTAREA");
    ta.focus();
    assert.equal(hooks.isUserInteractingWithForm(), true, "Form interaction must be active while textarea is focused");

    // Explicit sync (isBackground: false)
    hooks.refreshState({ isBackground: false });
    await env.flushMicrotasks();

    // Resolve RPC with updated title
    const nextState = env.buildSampleState({ projectName: "Explicitly Synced Project" });
    env.resolveNextGetState(nextState);
    await env.flushMicrotasks();

    // Since it was explicit, it must NOT stash into pendingWorkspaceState
    assert.equal(
      hooks.getPendingWorkspaceState(),
      null,
      "Explicit sync must not stash state into pendingWorkspaceState"
    );
    // And DOM must be updated immediately while focused
    assert.match(
      titleEl.textContent,
      /Explicitly Synced Project/,
      "DOM must update immediately on explicit sync even while textarea is focused"
    );
  });

  it("forces immediate render during explicit user action (btnSelectAllRecs) while focused", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const sampleRecs = [
      {
        title: "Task 1",
        skill: "/bmad-build",
        phase: "4-implementation",
        priority: "high",
        rationale: "Build task 1",
        fullCommand: "/bmad-build task-1",
        recommendedModel: { modelId: "test-model-1" }
      },
      {
        title: "Task 2",
        skill: "/bmad-build",
        phase: "4-implementation",
        priority: "medium",
        rationale: "Build task 2",
        fullCommand: "/bmad-build task-2",
        recommendedModel: { modelId: "test-model-1" }
      }
    ];

    hooks.renderWorkspaceState(env.buildSampleState({ recommendations: sampleRecs }));

    const recsList = env.elements.get("recommendationsList");
    const countBefore = recsList.innerHtmlSetCount;

    // User is focused on an input
    const input = env.makeElement("some-input", "INPUT");
    input.focus();
    assert.equal(hooks.isUserInteractingWithForm(), true);

    // User clicks Select All button
    const btnSelectAll = env.elements.get("btnSelectAllRecs");
    assert.ok(btnSelectAll, "btnSelectAllRecs element exists");

    btnSelectAll.dispatchEvent({ type: "click" });
    await env.flushMicrotasks();

    // innerHTML must have been set immediately via force: true
    assert.equal(
      recsList.innerHtmlSetCount,
      countBefore + 1,
      "btnSelectAllRecs click must force immediate render while form element is focused"
    );
  });
});
