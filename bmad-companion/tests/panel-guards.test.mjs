import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

import { PANEL_HTML_PATH, extractInlineScript } from "./helpers.mjs";
import { containsBmadJargon } from "../scripts/bmad-engine.mjs";

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
      isConnected: true,
      disabled: false,
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
        for (const fn of [...(listeners.get(evt.type) || [])]) fn(evt);
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
            if (attr[1] === "style") {
              const dispMatch = attr[2].match(/(?:^|;)\s*display\s*:\s*([^;]+)/i);
              if (dispMatch) childEl.style.display = dispMatch[1].trim();
            }
          }
        }
        for (const textMatch of innerHtmlVal.matchAll(/<([a-z0-9-]+)\s+[^>]*id="([^"]+)"[^>]*>([^<]*)<\/\1>/gi)) {
          const targetEl = elements.get(textMatch[2]);
          if (targetEl && targetEl.tagName !== "TEXTAREA") {
            targetEl.textContent = textMatch[3]
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, "&")
              .trim();
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
        // Detach previously rendered trigger elements inside this container before registering fresh ones
        if (el._renderedTriggerKeys) {
          for (const oldKey of el._renderedTriggerKeys) {
            const prevTrig = elements.get(oldKey);
            if (prevTrig) prevTrig.isConnected = false;
            elements.delete(oldKey);
          }
        }
        el._renderedTriggerKeys = [];
        for (const trigMatch of innerHtmlVal.matchAll(/<([a-z0-9-]+)\s+([^>]*data-overlay-trigger="([^"]+)"[^>]*)>/gi)) {
          const trigKey = `trigger:${trigMatch[3]}`;
          const trigEl = makeElement("", trigMatch[1]);
          trigEl.isConnected = true;
          for (const attr of trigMatch[2].matchAll(/([a-z0-9-]+)="([^"]*)"/gi)) {
            trigEl.setAttribute(attr[1], attr[2]);
            if (attr[1] === "class") {
              attr[2].split(/\s+/).filter(Boolean).forEach((c) => trigEl.classList.add(c));
            }
          }
          elements.set(trigKey, trigEl);
          el._renderedTriggerKeys.push(trigKey);
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
      querySelector: (sel) => {
        if (!sel || typeof sel !== "string") return null;
        if (sel.startsWith("#")) {
          const byId = elements.get(sel.slice(1));
          return byId && byId.isConnected !== false ? byId : null;
        }
        const trigMatch = sel.match(/^\[data-overlay-trigger="([^"]+)"\]$/);
        if (trigMatch) {
          const trig = elements.get(`trigger:${trigMatch[1]}`);
          if (trig && trig.isConnected !== false) return trig;
          for (const candidate of elements.values()) {
            if (
              candidate &&
              candidate.isConnected !== false &&
              typeof candidate.getAttribute === "function" &&
              candidate.getAttribute("data-overlay-trigger") === trigMatch[1]
            ) {
              return candidate;
            }
          }
        }
        return null;
      },
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
            } else if (msg.params?.name === "bmad_queue_manage") {
              queueMicrotask(() => {
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: { structuredContent: sandbox.window.__bmadTestHooks?.getCurrentState?.() || buildSampleState() }
                });
              });
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

describe("Epic 8 Story 8.3: Unified in-iframe overlay controller, polling guard & semantic draft store (AD-10 / AD-17)", () => {
  it("declares the single AD-17 modal overlay layer (<div role='dialog' aria-modal='true' aria-labelledby='overlayTitle'>) and exposes overlay & draft hooks", async () => {
    assert.match(
      PANEL_HTML,
      /<div[^>]*id="overlayLayer"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="overlayTitle"/,
      "assets/panel.html must declare the single AD-17 modal overlay layer with role='dialog' and aria-modal='true'"
    );

    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    assert.equal(typeof hooks.isOverlayOpen, "function");
    assert.equal(typeof hooks.openOverlay, "function");
    assert.equal(typeof hooks.closeOverlay, "function");
    assert.equal(typeof hooks.reconcileActiveOverlay, "function");
    assert.equal(typeof hooks.getActiveOverlay, "function");
    assert.equal(typeof hooks.getOverlayFocusableElements, "function");
    assert.equal(typeof hooks.isInteractiveDescendantClick, "function");
    assert.equal(typeof hooks.getRecOverrideKey, "function");
    assert.equal(typeof hooks.getRecommendationBaseModelId, "function");
    assert.equal(typeof hooks.getSelectedRecKeys, "function");
    assert.equal(typeof hooks.getExpandedDisclosures, "function");
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(hooks.getActiveOverlay(), null);
  });

  it("treats isOverlayOpen() as the 3rd clause in isUserInteractingWithForm(), stashes background polls/notifications while open, and flushes on close (AD-10)", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();

    const sampleRec = {
      title: "Build Overlay Controller",
      skill: "/bmad-build",
      phase: "4-implementation",
      priority: "high",
      rationale: "Implement unified overlay",
      fullCommand: '/bmad-build "Implement unified overlay"',
      recommendedModel: { modelId: "model-a", tier: "Dynamic Fit", reason: "Best fit" }
    };

    env.resolveNextGetState(
      env.buildSampleState({
        projectName: "Overlay Guard Project",
        recommendations: [sampleRec]
      })
    );
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const recKey = hooks.getRecOverrideKey(sampleRec);
    const triggerBtn = env.makeElement("trigger-action-card", "BUTTON");

    // Open the Action Window overlay
    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey,
      triggerEl: triggerBtn
    });

    assert.equal(hooks.isOverlayOpen(), true, "Overlay must be open");
    // Initial focus is on #overlayCloseBtn (a BUTTON, not TEXTAREA/INPUT, and selectOpenUntil is 0),
    // proving the 3rd clause (isOverlayOpen()) activates isUserInteractingWithForm().
    assert.equal(env.getActiveElement()?.id, "overlayCloseBtn", "Focus moves inside overlay on open");
    assert.equal(hooks.isUserInteractingWithForm(), true, "isOverlayOpen() must activate isUserInteractingWithForm()");
    assert.ok(env.elements.get("mainScroll").classList.contains("scroll-locked"), "Main scroll locks while overlay is open");

    // Render uses overlay-* non-duplicating DOM IDs
    const overlayBodyHtml = env.elements.get("overlayBody").innerHTML;
    assert.match(overlayBodyHtml, /id="overlay-rec-cmd"/, "Overlay must use overlay-* namespaced IDs");
    assert.match(overlayBodyHtml, /id="overlay-rec-model"/, "Overlay must use overlay-* namespaced IDs");
    assert.doesNotMatch(overlayBodyHtml, /id="rec-cmd-0"|id="rec-model-0"/, "Overlay must never duplicate background DOM IDs");

    // Background poll entry while overlay is already open skips RPC fetch
    const callsBeforePoll = env.toolCalls.length;
    await hooks.refreshState({ isBackground: true });
    assert.equal(env.toolCalls.length, callsBeforePoll, "Background poll skips fetch while overlay is open");

    // Inbound tool-result notification while overlay is open stashes into pendingWorkspaceState without re-rendering
    const stashedState = env.buildSampleState({
      projectName: "Polled While Overlay Open",
      recommendations: [sampleRec]
    });
    env.dispatchWindowMessage({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: stashedState }
    });

    assert.deepEqual(hooks.getPendingWorkspaceState(), stashedState, "Inbound update stashes while overlay is open");
    assert.match(env.elements.get("projectTitle").textContent, /Overlay Guard Project/, "DOM must not update while overlay is open");

    // Closing overlay clears activeOverlay, restores focus to triggerEl, and flushes stashed state immediately (0ms)
    hooks.closeOverlay();
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(hooks.getActiveOverlay(), null);
    assert.equal(hooks.isUserInteractingWithForm(), false);
    assert.equal(hooks.getPendingWorkspaceState(), null, "closeOverlay() must flush pendingWorkspaceState immediately");
    assert.match(env.elements.get("projectTitle").textContent, /Polled While Overlay Open/, "Flushed state rendered on overlay close");
    assert.equal(env.getActiveElement(), triggerBtn, "Focus restored to connected triggerEl on close");
    assert.equal(env.elements.get("mainScroll").classList.contains("scroll-locked"), false, "Main scroll unlocked on close");
  });

  it("enforces single capture-phase Escape precedence: closes open <select> first while keeping overlay open, then closes overlay on second Escape (even from TEXTAREA)", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const sampleRec = {
      title: "Escape Precedence Task",
      skill: "/bmad-build",
      phase: "4-implementation",
      priority: "high",
      rationale: "Test Escape precedence",
      fullCommand: '/bmad-build "Test Escape"',
      recommendedModel: { modelId: "model-1" }
    };
    hooks.renderWorkspaceState(env.buildSampleState({ recommendations: [sampleRec] }));

    const recKey = hooks.getRecOverrideKey(sampleRec);
    const triggerEl = env.makeElement("rec-trigger", "BUTTON");
    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey,
      triggerEl
    });

    // User opens the model <select> inside the overlay (pointerdown sets 15000ms selectOpenUntil)
    const overlaySelect = env.elements.get("overlay-rec-model");
    assert.ok(overlaySelect, "overlay-rec-model exists");
    overlaySelect.focus();
    env.dispatchDocumentEvent({ type: "pointerdown", target: overlaySelect });
    assert.ok(hooks.getSelectOpenUntil() > Date.now(), "selectOpenUntil is active");

    // Stash a background update while overlay + select are open
    const stashedState = env.buildSampleState({
      projectName: "Flushed After Second Escape",
      recommendations: [sampleRec]
    });
    hooks.setPendingWorkspaceState(stashedState);

    // 1st Escape: closes the open <select> only (clears selectOpenUntil = 0), stops propagation, keeps overlay open
    let propagationStopped1 = false;
    env.dispatchDocumentEvent({
      type: "keydown",
      key: "Escape",
      stopPropagation: () => {
        propagationStopped1 = true;
      }
    });
    env.flushTimers();
    await env.flushMicrotasks();

    assert.equal(hooks.getSelectOpenUntil(), 0, "1st Escape must clear selectOpenUntil");
    assert.equal(propagationStopped1, true, "1st Escape must stop propagation");
    assert.equal(hooks.isOverlayOpen(), true, "Overlay must remain open after 1st Escape closes select");
    assert.deepEqual(hooks.getPendingWorkspaceState(), stashedState, "Pending state stays stashed while overlay remains open");

    // User now focuses the prompt TEXTAREA inside the overlay and presses Escape (2nd Escape, no open select)
    const overlayTa = env.elements.get("overlay-rec-cmd");
    overlayTa.focus();
    assert.equal(env.getActiveElement(), overlayTa);

    env.dispatchDocumentEvent({
      type: "keydown",
      key: "Escape",
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    env.flushTimers();
    await env.flushMicrotasks();

    assert.equal(hooks.isOverlayOpen(), false, "2nd Escape must close overlay even when focused inside TEXTAREA");
    assert.equal(env.getActiveElement(), triggerEl, "2nd Escape must restore focus to triggerEl");
    assert.equal(hooks.getPendingWorkspaceState(), null, "2nd Escape must flush stashed state on overlay close");
    assert.match(env.elements.get("projectTitle").textContent, /Flushed After Second Escape/);
  });

  it("traps Tab and Shift+Tab inside the open overlay and restores focus via triggerEl -> triggerSelector -> active tab heading fallback", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const sampleRec = {
      title: "Focus Trap Story",
      skill: "/bmad-build",
      phase: "4-implementation",
      priority: "high",
      rationale: "Trap focus",
      fullCommand: '/bmad-build "Trap focus"',
      recommendedModel: { modelId: "model-1" }
    };
    hooks.renderWorkspaceState(env.buildSampleState({ recommendations: [sampleRec] }));

    const recKey = hooks.getRecOverrideKey(sampleRec);
    const detachedTrigger = env.makeElement("detached-trigger", "BUTTON");

    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey,
      triggerEl: detachedTrigger,
      triggerSelector: `[data-overlay-trigger="recommendation:${recKey}"]`
    });

    const focusables = hooks.getOverlayFocusableElements();
    assert.ok(focusables.length >= 4, "Overlay must expose ordered focusable controls");
    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];

    // Focus is initially on firstEl (#overlayCloseBtn); Shift+Tab wraps to lastEl
    assert.equal(env.getActiveElement(), firstEl);
    let shiftTabPrevented = false;
    env.dispatchDocumentEvent({
      type: "keydown",
      key: "Tab",
      shiftKey: true,
      preventDefault: () => {
        shiftTabPrevented = true;
      }
    });
    assert.equal(shiftTabPrevented, true, "Shift+Tab at first focusable must preventDefault");
    assert.equal(env.getActiveElement(), lastEl, "Shift+Tab wraps focus to last focusable element in overlay");

    // Tab at lastEl wraps back to firstEl
    let tabPrevented = false;
    env.dispatchDocumentEvent({
      type: "keydown",
      key: "Tab",
      shiftKey: false,
      preventDefault: () => {
        tabPrevented = true;
      }
    });
    assert.equal(tabPrevented, true, "Tab at last focusable must preventDefault");
    assert.equal(env.getActiveElement(), firstEl, "Tab wraps focus back to first focusable element in overlay");

    // Simulate triggerEl detachment (e.g. after background container re-render) -> must fall back to triggerSelector
    detachedTrigger.isConnected = false;
    hooks.closeOverlay();
    const queriedCard = env.sandbox.document.querySelector(`[data-overlay-trigger="recommendation:${recKey}"]`);
    assert.ok(queriedCard, "triggerSelector resolves re-rendered recommendation card");
    assert.equal(env.getActiveElement(), queriedCard, "Focus must fall back to document.querySelector(triggerSelector) when triggerEl is detached");

    // Now re-open with a non-matching triggerSelector and detached triggerEl -> must fall back to active tab heading
    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey,
      triggerEl: detachedTrigger,
      triggerSelector: '[data-overlay-trigger="recommendation:non-existent"]'
    });
    hooks.closeOverlay();
    assert.equal(
      env.getActiveElement(),
      env.elements.get("workTabHeading"),
      "Focus must fall back to active tab heading when both triggerEl and triggerSelector are unavailable"
    );
  });

  it("clears stale pendingWorkspaceState on explicit overlay actions, reconciles active overlay in place, or closes with missing-item toast + tab-heading focus", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    hooks.switchTab("queue");

    const initialQueueState = env.buildSampleState({
      projectName: "Fresh State v1",
      availableModels: [
        { id: "prov/model-1", modelId: "model-1", providerName: "Prov" },
        { id: "prov/model-2", modelId: "model-2", providerName: "Prov" }
      ],
      taskQueue: {
        status: "idle",
        executionMode: "dynamic-workflow",
        defaultReviewMode: "none",
        counts: { total: 1, running: 0, queued: 1, done: 0, failed: 0, progressPct: 0 },
        items: [
          {
            id: "qtask-1",
            title: "Story 8.3 Task",
            status: "queued",
            model: "prov/model-1",
            modelShort: "model-1",
            reviewMode: "none",
            effectivePrompt: '/bmad-build-auto "Story 8.3"'
          }
        ]
      }
    });
    hooks.renderWorkspaceState(initialQueueState);

    const originalCard = env.sandbox.document.querySelector('[data-overlay-trigger="queue-item:qtask-1"]');
    assert.ok(originalCard, "Initial queue card trigger registered");

    hooks.openOverlay({
      kind: "focus",
      targetType: "queue-item",
      targetKey: "qtask-1",
      triggerEl: originalCard
    });
    assert.equal(hooks.isOverlayOpen(), true);

    // 1. A background poll stashes an older state S_stale while the overlay is open
    const stalePollState = env.buildSampleState({
      projectName: "Stale Poll State (Must Not Roll Back)",
      taskQueue: initialQueueState.taskQueue
    });
    hooks.setPendingWorkspaceState(stalePollState);
    assert.ok(hooks.getPendingWorkspaceState(), "Stale poll stashed");

    // Focus the intra-overlay model select (#overlay-q-model) before an explicit mutation arrives
    const overlayModelSel = env.elements.get("overlay-q-model");
    overlayModelSel.focus();
    assert.equal(env.getActiveElement()?.id, "overlay-q-model");

    // 2. Explicit same-tab action renders newer state S_fresh (model updated to prov/model-2)
    const freshActionState = env.buildSampleState({
      projectName: "Explicit Action Fresh State v2",
      availableModels: initialQueueState.availableModels,
      taskQueue: {
        ...initialQueueState.taskQueue,
        items: [
          {
            ...initialQueueState.taskQueue.items[0],
            model: "prov/model-2",
            modelShort: "model-2"
          }
        ]
      }
    });
    hooks.renderWorkspaceState(freshActionState);

    // pendingWorkspaceState MUST have been cleared so closing the overlay won't roll back to stalePollState
    assert.equal(
      hooks.getPendingWorkspaceState(),
      null,
      "Explicit renderWorkspaceState must clear stale pendingWorkspaceState"
    );
    assert.equal(hooks.isOverlayOpen(), true, "Overlay stays open across same-tab explicit reconciliation");
    assert.equal(
      env.elements.get("overlay-q-model").value,
      "prov/model-2",
      "reconcileActiveOverlay must update overlay controls in place"
    );
    assert.equal(
      env.getActiveElement()?.id,
      "overlay-q-model",
      "reconcileActiveOverlay must preserve intra-overlay focus by overlay-* ID"
    );
    assert.equal(
      originalCard.isConnected,
      false,
      "Re-rendering queueItemsList detaches the original triggerEl reference"
    );

    // 3. Now simulate an explicit action or scan where qtask-1 is removed
    const itemRemovedState = env.buildSampleState({
      projectName: "Item Removed State v3",
      taskQueue: {
        ...initialQueueState.taskQueue,
        counts: { total: 0, running: 0, queued: 0, done: 0, failed: 0, progressPct: 0 },
        items: []
      }
    });
    hooks.renderWorkspaceState(itemRemovedState);

    assert.equal(hooks.isOverlayOpen(), false, "reconcileActiveOverlay must close overlay when target item disappears");
    assert.equal(
      env.elements.get("toastText").textContent,
      "That item is no longer available",
      "Missing item reconciliation must announce 'That item is no longer available'"
    );
    assert.equal(
      env.getActiveElement(),
      env.elements.get("queueTabHeading"),
      "Missing item reconciliation must return focus to the active tab heading"
    );
  });

  it("preserves semantic rec:<skill>:<title> drafts across overlay close/reopen, unifies getRecommendationBaseModelId, and batch-queues via selectedRecKeys (AD-10)", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    // Note: sampleRec intentionally omits recommendedModel to prove getRecommendationBaseModelId
    // supplies the same fallback model base across card render, Action Window, and batch enqueue.
    const sampleRec1 = {
      title: "Story 8.3 Draft Persistence",
      skill: "/bmad-build",
      phase: "4-implementation",
      priority: "high",
      rationale: "Keep drafts across overlay close/reopen",
      fullCommand: '/bmad-build "Original server prompt 1"'
    };
    const sampleRec2 = {
      title: "Story 8.4 Follow-up",
      skill: "/bmad-ux",
      phase: "2-planning",
      priority: "medium",
      rationale: "Second task",
      fullCommand: '/bmad-ux "Original server prompt 2"',
      recommendedModel: { modelId: "prov/model-default", tier: "Dynamic Fit", reason: "Default" }
    };
    const availableModels = [
      { id: "prov/model-default", modelId: "model-default", providerName: "Prov", current: true },
      { id: "prov/model-custom", modelId: "model-custom", providerName: "Prov" }
    ];

    hooks.renderWorkspaceState(
      env.buildSampleState({
        recommendations: [sampleRec1, sampleRec2],
        availableModels
      })
    );

    const recKey1 = hooks.getRecOverrideKey(sampleRec1);
    assert.equal(recKey1, "rec:/bmad-build:Story 8.3 Draft Persistence", "Semantic key never falls back to DOM index");
    assert.equal(
      hooks.getRecommendationBaseModelId(sampleRec1),
      "prov/model-default",
      "getRecommendationBaseModelId resolves fallback model identically when recommendedModel is omitted"
    );

    // Open Action Window for sampleRec1 and edit prompt + model inside overlay
    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey1
    });

    const overlayTa = env.elements.get("overlay-rec-cmd");
    const overlaySel = env.elements.get("overlay-rec-model");
    overlayTa.value = '/bmad-build "Edited inside Action Window"';
    overlayTa.dispatchEvent({ type: "input" });
    overlaySel.value = "prov/model-custom";
    overlaySel.dispatchEvent({ type: "change" });

    // Close overlay -> drafts must persist in Maps and sync to underlying Work card
    hooks.closeOverlay();
    assert.equal(
      hooks.resolveUserPrompt(recKey1, sampleRec1.fullCommand),
      '/bmad-build "Edited inside Action Window"'
    );
    assert.equal(
      hooks.resolveUserModel(recKey1, hooks.getRecommendationBaseModelId(sampleRec1)),
      "prov/model-custom"
    );
    assert.equal(
      env.elements.get("rec-cmd-0").value,
      '/bmad-build "Edited inside Action Window"',
      "Underlying Work card textarea reflects draft edited in Action Window after close"
    );
    assert.equal(
      env.elements.get("rec-model-0").value,
      "prov/model-custom",
      "Underlying Work card model select reflects model chosen in Action Window after close"
    );

    // Reopen Action Window -> edited prompt and model survive close/reopen
    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey1
    });
    assert.equal(env.elements.get("overlay-rec-cmd").value, '/bmad-build "Edited inside Action Window"');
    assert.equal(env.elements.get("overlay-rec-model").value, "prov/model-custom");
    hooks.closeOverlay();

    // Select via selectedRecKeys (even if recommendations reorder on a poll) and batch enqueue
    const selectedKeys = hooks.getSelectedRecKeys();
    selectedKeys.add(recKey1);

    // Reorder recommendations in a fresh render (sampleRec2 first, sampleRec1 second)
    hooks.renderWorkspaceState(
      env.buildSampleState({
        recommendations: [sampleRec2, sampleRec1],
        availableModels
      })
    );
    assert.equal(selectedKeys.has(recKey1), true, "selectedRecKeys survives recommendation reorder");

    const callsBeforeBatch = env.toolCalls.length;
    env.elements.get("btnQueueSelectedRecs").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();

    const addQueueCall = env.toolCalls.slice(callsBeforeBatch).find((c) => c.params?.name === "bmad_queue_manage");
    assert.ok(addQueueCall, "btnQueueSelectedRecs must call bmad_queue_manage");
    assert.equal(addQueueCall.params.arguments.action, "add");
    assert.equal(addQueueCall.params.arguments.items.length, 1);
    assert.equal(addQueueCall.params.arguments.items[0].title, "Story 8.3 Draft Persistence");
    assert.equal(addQueueCall.params.arguments.items[0].prompt, '/bmad-build "Edited inside Action Window"');
    assert.equal(
      addQueueCall.params.arguments.items[0].model,
      "prov/model-custom",
      "Batch enqueue must preserve user-selected model via unified getRecommendationBaseModelId + resolveUserModel"
    );
  });

  it("guards focusable card clicks against interactive descendants and closes overlay on switchTab (AD-17)", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const cardEl = env.makeElement("focusable-card", "DIV");
    const childBtn = env.makeElement("child-btn", "BUTTON");
    const childSelect = env.makeElement("child-select", "SELECT");
    const childPill = env.makeElement("child-pill", "SPAN");
    childPill.classList.add("status-pill");
    const childTab = env.makeElement("child-tab", "DIV");
    childTab.setAttribute("role", "tab");

    assert.equal(hooks.isInteractiveDescendantClick({ target: cardEl }, cardEl), false, "Clicking card container itself is not an interactive descendant");
    assert.equal(hooks.isInteractiveDescendantClick({ target: childBtn }, cardEl), true, "Button click must be ignored by card focus listener");
    assert.equal(hooks.isInteractiveDescendantClick({ target: childSelect }, cardEl), true, "Select click must be ignored by card focus listener");
    assert.equal(hooks.isInteractiveDescendantClick({ target: childPill }, cardEl), true, "Status pill click must be ignored by card focus listener");
    assert.equal(hooks.isInteractiveDescendantClick({ target: childTab }, cardEl), true, "[role=tab] click must be ignored by card focus listener");

    // Open overlay and verify switchTab closes it
    hooks.openOverlay({
      kind: "focus",
      targetType: "insights",
      targetKey: "insights"
    });
    assert.equal(hooks.isOverlayOpen(), true);
    hooks.switchTab("queue");
    assert.equal(hooks.isOverlayOpen(), false, "switchTab() must close any open overlay");
  });
});

describe("Epic 8 Story 8.4: Work tab current-focus hero, Action Window & RD-8 counted disclosures (AD-18 / RD-8 / RD-9)", () => {
  it("renders turnAnalysis.currentFocus in the Work hero with the 'Current focus' label and never falls back to aiSummaryHeadline (AD-18)", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    // 1. State with turnAnalysis.currentFocus populated alongside a jargon-heavy aiSummaryHeadline
    hooks.renderWorkspaceState(
      env.buildSampleState({
        turnAnalysis: {
          turnCount: 4,
          aiSummaryHeadline:
            "Last turn touched sprint-status.yaml and tickets.toml — run /bmad-sprint-planning in 4-implementation.",
          currentFocus: {
            text: "You finished the unified overlay controller and verified focus restoration. Next up is wiring the Work tab hero and disclosures.",
            basisLabel: "Current focus",
            conversationCount: 3,
            source: "advisor-override"
          }
        }
      })
    );

    const heroEl = env.elements.get("currentFocusHero");
    const textEl = env.elements.get("currentFocusText");
    const basisEl = env.elements.get("currentFocusBasis");

    assert.equal(
      textEl.textContent,
      "You finished the unified overlay controller and verified focus restoration. Next up is wiring the Work tab hero and disclosures."
    );
    assert.equal(basisEl.textContent, "Current focus");
    assert.equal(heroEl.getAttribute("data-focus-source"), "advisor-override");
    assert.equal(heroEl.getAttribute("data-conversation-count"), "3");
    assert.equal(containsBmadJargon(textEl.textContent), false, "Hero text must contain zero BMAD jargon");
    assert.doesNotMatch(textEl.textContent, /sprint-status\.yaml|\/bmad-/, "Hero must not render aiSummaryHeadline");

    // 2. When currentFocus is omitted or empty, hero falls back to plain ready-state copy — NEVER aiSummaryHeadline
    hooks.renderWorkspaceState(
      env.buildSampleState({
        turnAnalysis: {
          turnCount: 5,
          aiSummaryHeadline: "Should never appear in Work hero: /bmad-build epic-auth#2 in sprint-status.yaml",
          currentFocus: null
        }
      })
    );

    assert.doesNotMatch(
      textEl.textContent,
      /Should never appear|\/bmad-build|sprint-status\.yaml/,
      "Work hero must never fall back to turnAnalysis.aiSummaryHeadline"
    );
    assert.equal(containsBmadJargon(textEl.textContent), false);
    assert.equal(basisEl.textContent, "Current focus");
  });

  it("renders simplified plain-language next-action cards on Work without BMAD jargon, applies RD-5 focal accent to first card only, and supports batch selectedRecKeys", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const recs = [
      {
        title: "Build Story 8.4 (/bmad-build) in 4-implementation",
        plainTitle: "Complete the Work tab focus hero and action window",
        rationale: "Update tickets.toml and sprint-status.yaml for epic-panel#4",
        plainSummary: "Render the focus summary at the top of Work and open details in the action window.",
        skill: "/bmad-build",
        phase: "4-implementation",
        priority: "high",
        fullCommand: '/bmad-build "Complete Story 8.4"',
        recommendedModel: { modelId: "prov/claude-sonnet", tier: "💻 Agentic Coding", reason: "Best coding fit" }
      },
      {
        // Intentionally omit plainTitle/plainSummary to verify client-side jargon stripping fallback
        title: "Run /bmad-code-review on 4-implementation changes in tickets.toml",
        rationale: "Verify epic-panel#4 and sprint-status.yaml before release.",
        skill: "/bmad-code-review",
        phase: "4-implementation",
        priority: "medium",
        fullCommand: '/bmad-code-review "Review Story 8.4"',
        recommendedModel: { modelId: "prov/gemini-hydrogen", tier: "🧠 Deep Reasoning", reason: "Review fit" }
      }
    ];

    hooks.renderWorkspaceState(
      env.buildSampleState({
        recommendations: recs,
        availableModels: [
          { id: "prov/claude-sonnet", modelId: "claude-sonnet", providerName: "Prov" },
          { id: "prov/gemini-hydrogen", modelId: "gemini-hydrogen", providerName: "Prov" }
        ]
      })
    );

    const recsHtml = env.elements.get("recommendationsList").innerHTML;
    const visibleWorkCardsText = recsHtml.replace(/<[^>]+>/g, " ");
    assert.equal(
      containsBmadJargon(visibleWorkCardsText),
      false,
      "Work recommendationsList visible text must contain zero BMAD jargon (/bmad-*, phase codes, tracker filenames, override keys)"
    );
    assert.equal(
      containsBmadJargon(env.elements.get("rec-title-1").textContent),
      false,
      "Fallback title when plainTitle is omitted must strip BMAD jargon"
    );
    assert.equal(
      containsBmadJargon(env.elements.get("rec-summary-1").textContent),
      false,
      "Fallback summary when plainSummary is omitted must strip BMAD jargon"
    );
    assert.match(recsHtml, /Complete the Work tab focus hero and action window/);
    assert.match(recsHtml, /Render the focus summary at the top of Work/);

    // RD-5 focal point: first card carries .is-focal and .btn-primary, second card does not
    const card0 = env.elements.get("rec-card-0");
    const card1 = env.elements.get("rec-card-1");
    const launch0 = env.elements.get("rec-launch-0");
    const launch1 = env.elements.get("rec-launch-1");
    assert.equal(card0.classList.contains("is-focal"), true, "First next-action card must carry .is-focal");
    assert.equal(card1.classList.contains("is-focal"), false, "Second next-action card must not carry .is-focal");
    assert.equal(launch0.classList.contains("btn-primary"), true, "First card Launch button carries btn-primary");
    assert.equal(launch1.classList.contains("btn-primary"), false, "Second card Launch button uses default button weight");

    // Batch checkbox selection updates selectedRecKeys and button labels
    const cb0 = env.elements.get("rec-cb-0");
    cb0.checked = true;
    cb0.dispatchEvent({ type: "change" });
    assert.equal(hooks.getSelectedRecKeys().has(hooks.getRecOverrideKey(recs[0])), true);
    assert.equal(env.elements.get("btnQueueSelectedRecs").textContent, "➕ Add Checked (1) to Queue");
    assert.equal(env.elements.get("btnSelectAllRecs").textContent, "☑️ Select All");

    // Select All selects both, then Deselect All clears both
    env.elements.get("btnSelectAllRecs").dispatchEvent({ type: "click" });
    assert.equal(hooks.getSelectedRecKeys().size, 2);
    assert.equal(env.elements.get("btnSelectAllRecs").textContent, "☐ Deselect All");
    assert.equal(env.elements.get("btnQueueSelectedRecs").textContent, "➕ Add Checked (2) to Queue");
  });

  it("opens the Work Action Window on card click (ignoring interactive descendants), syncs prompt/model drafts across 5s polls, and supports Launch, Add to Queue, More actions (3), and Technical details (RD-9)", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const sampleRec = {
      title: "Build Story 8.4 (/bmad-build)",
      plainTitle: "Build the Work current-focus hero and action window",
      rationale: "Implement Story 8.4 in tickets.toml",
      plainSummary: "Connect the current focus summary and action dialog on Work.",
      skill: "/bmad-build",
      phase: "4-implementation",
      priority: "high",
      fullCommand: '/bmad-build "Implement Story 8.4"',
      recommendedModel: { modelId: "prov/model-1", tier: "💻 Agentic Coding", reason: "Top coding model" }
    };
    const availableModels = [
      { id: "prov/model-1", modelId: "model-1", providerName: "Prov", current: true },
      { id: "prov/model-2", modelId: "model-2", providerName: "Prov" }
    ];

    hooks.renderWorkspaceState(
      env.buildSampleState({
        projectName: "Action Window Test",
        recommendations: [sampleRec],
        availableModels
      })
    );

    const card0 = env.elements.get("rec-card-0");
    const cb0 = env.elements.get("rec-cb-0");
    const moreBtn0 = env.elements.get("rec-more-actions-0");

    // 1. Clicking interactive descendants (checkbox or More actions button) on the card does NOT open the Action Window
    card0.dispatchEvent({ type: "click", target: cb0 });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking checkbox must not open Action Window");
    card0.dispatchEvent({ type: "click", target: moreBtn0 });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking disclosure button must not open Action Window");

    // 2. Clicking the card itself (or title/summary) opens the Work Action Window inside the unified overlay
    card0.dispatchEvent({ type: "click", target: card0 });
    assert.equal(hooks.isOverlayOpen(), true, "Clicking action card must open the Work Action Window");
    assert.equal(hooks.getActiveOverlay()?.kind, "action");
    assert.equal(hooks.getActiveOverlay()?.targetType, "recommendation");
    assert.equal(hooks.getActiveOverlay()?.targetKey, hooks.getRecOverrideKey(sampleRec));

    assert.equal(env.elements.get("overlayTitle").textContent, "Build the Work current-focus hero and action window");
    assert.equal(
      env.elements.get("overlay-rec-summary").textContent,
      "Connect the current focus summary and action dialog on Work."
    );
    assert.equal(
      env.elements.get("overlay-tech-details").textContent,
      "Technical details: /bmad-build · 4-implementation"
    );

    // 3. Edit prompt and model inside the Action Window while a background poll arrives
    const overlayTa = env.elements.get("overlay-rec-cmd");
    const overlaySel = env.elements.get("overlay-rec-model");
    overlayTa.value = '/bmad-build "Implement Story 8.4 with extra verification"';
    overlayTa.dispatchEvent({ type: "input" });
    overlaySel.value = "prov/model-2";
    overlaySel.dispatchEvent({ type: "change" });

    // Inbound poll while Action Window is open stashes without clobbering edits
    env.dispatchWindowMessage({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: {
        structuredContent: env.buildSampleState({
          projectName: "Polled During Action Window",
          recommendations: [sampleRec],
          availableModels
        })
      }
    });
    assert.ok(hooks.getPendingWorkspaceState(), "Background update must stash while Action Window is open");
    assert.equal(env.elements.get("overlay-rec-cmd").value, '/bmad-build "Implement Story 8.4 with extra verification"');
    assert.equal(env.elements.get("overlay-rec-model").value, "prov/model-2");

    // 4. Toggle More actions (3) disclosure inside the Action Window
    const overlayMoreBtn = env.elements.get("overlay-btn-more-actions");
    assert.equal(overlayMoreBtn.getAttribute("aria-expanded"), "false");
    assert.equal(env.elements.get("overlay-more-actions-body").style.display, "none");

    overlayMoreBtn.dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("overlay-btn-more-actions").getAttribute("aria-expanded"), "true");
    assert.equal(env.elements.get("overlay-more-actions-body").style.display, "flex");
    assert.equal(hooks.getExpandedDisclosures().has("more-actions"), true);

    // 5. Close Action Window -> flushes stashed poll, preserves drafts, updates card model pill & Customized badge
    hooks.closeOverlay();
    assert.equal(hooks.isOverlayOpen(), false);
    assert.match(env.elements.get("projectTitle").textContent, /Polled During Action Window/);
    assert.match(env.elements.get("rec-model-pill-0").textContent, /model-2/);
    assert.match(env.elements.get("recommendationsList").innerHTML, /✎ Customized/);

    // 6. Reopen Action Window and click Add to Queue -> clears pendingWorkspaceState, enqueues edited draft, jumps to Queue
    card0.dispatchEvent({ type: "click", target: card0 });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(env.elements.get("overlay-rec-cmd").value, '/bmad-build "Implement Story 8.4 with extra verification"');
    assert.equal(env.elements.get("overlay-rec-model").value, "prov/model-2");

    const callsBeforeQueue = env.toolCalls.length;
    env.elements.get("overlay-btn-queue").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();

    const queueCall = env.toolCalls.slice(callsBeforeQueue).find((c) => c.params?.name === "bmad_queue_manage");
    assert.ok(queueCall, "overlay-btn-queue must invoke bmad_queue_manage");
    assert.equal(queueCall.params.arguments.items[0].prompt, '/bmad-build "Implement Story 8.4 with extra verification"');
    assert.equal(queueCall.params.arguments.items[0].model, "prov/model-2");
    assert.equal(hooks.getActiveTabId(), "queue", "Add to Queue from Action Window must jump to queue tab");
    assert.equal(hooks.isOverlayOpen(), false, "Jumping to queue tab must close the Action Window");
  });

  it("persists collapsed-by-default AI notes (N), Models and providers (N), and More actions (3) disclosures in expandedDisclosures with live counts across poll renders (RD-8)", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    hooks.renderWorkspaceState(
      env.buildSampleState({
        smartInsights: [{ title: "Insight A", detail: "Detail A", severity: "info" }],
        providerState: {
          activeProviders: [
            { providerName: "Z.AI", modelCount: 3, kind: "sub" },
            { providerName: "Antigravity", modelCount: 10, kind: "api" }
          ]
        },
        recommendations: [
          {
            title: "Task 1",
            plainTitle: "First plain task",
            plainSummary: "First summary",
            skill: "/bmad-build",
            phase: "4-implementation",
            fullCommand: '/bmad-build "Task 1"'
          }
        ]
      })
    );

    const aiBtn = env.elements.get("btnDisclosureAiNotes");
    const aiBody = env.elements.get("disclosureBodyAiNotes");
    const modBtn = env.elements.get("btnDisclosureModelsProviders");
    const modBody = env.elements.get("disclosureBodyModelsProviders");
    const moreBtn = env.elements.get("rec-more-actions-0");

    // Collapsed by default
    assert.equal(aiBtn.getAttribute("aria-expanded"), "false");
    assert.equal(aiBody.style.display, "none");
    assert.match(aiBtn.textContent, /AI notes \(1\)$/);

    assert.equal(modBtn.getAttribute("aria-expanded"), "false");
    assert.equal(modBody.style.display, "none");
    assert.match(modBtn.textContent, /Models and providers \(2\)$/);

    assert.equal(moreBtn.getAttribute("aria-expanded"), "false");
    assert.match(moreBtn.textContent, /More actions \(3\)/);

    // Expand AI notes and More actions, keep Models and providers collapsed
    aiBtn.dispatchEvent({ type: "click" });
    moreBtn.dispatchEvent({ type: "click" });

    assert.equal(aiBtn.getAttribute("aria-expanded"), "true");
    assert.equal(aiBody.style.display, "block");
    assert.equal(env.elements.get("rec-more-actions-0").getAttribute("aria-expanded"), "true");
    assert.equal(env.elements.get("rec-more-body-0").style.display, "flex");

    // Subsequent poll updates insight count (1 -> 2) and provider count (2 -> 3) while preserving expandedDisclosures
    hooks.renderWorkspaceState(
      env.buildSampleState({
        smartInsights: [
          { title: "Insight A", detail: "Detail A", severity: "info" },
          { title: "Insight B", detail: "Detail B", severity: "success" }
        ],
        providerState: {
          activeProviders: [
            { providerName: "Z.AI", modelCount: 3, kind: "sub" },
            { providerName: "Antigravity", modelCount: 10, kind: "api" },
            { providerName: "Alibaba", modelCount: 5, kind: "sub" }
          ]
        },
        recommendations: [
          {
            title: "Task 1",
            plainTitle: "First plain task",
            plainSummary: "First summary",
            skill: "/bmad-build",
            phase: "4-implementation",
            fullCommand: '/bmad-build "Task 1"'
          }
        ]
      })
    );

    assert.equal(aiBtn.getAttribute("aria-expanded"), "true", "AI notes expansion persists across poll render");
    assert.equal(aiBody.style.display, "block");
    assert.match(aiBtn.textContent, /AI notes \(2\)$/, "AI notes count updates live on poll render");

    assert.equal(modBtn.getAttribute("aria-expanded"), "false", "Models and providers stays collapsed across poll render");
    assert.equal(modBody.style.display, "none");
    assert.match(modBtn.textContent, /Models and providers \(3\)$/, "Models and providers count updates live on poll render");

    assert.equal(env.elements.get("rec-more-actions-0").getAttribute("aria-expanded"), "true", "More actions expansion persists across poll render");
    assert.equal(env.elements.get("rec-more-body-0").style.display, "flex");
  });

  it("supports Enter/Space keyboard activation on Work action cards, hides collapsed overlay focusables, shows queue resultSummary in Focus View, and keeps remove toast/focus clean", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const sampleRec = {
      title: "Keyboard Card",
      plainTitle: "Run keyboard check",
      plainSummary: "Open Action Window with Enter or Space.",
      skill: "/bmad-ux",
      phase: "2-planning",
      fullCommand: '/bmad-ux "Check keyboard"'
    };

    const failedTask = {
      id: "qtask-fail-1",
      title: "Failed Task",
      skill: "/bmad-build",
      prompt: '/bmad-build "Story 1"',
      effectivePrompt: '/bmad-build "Story 1"',
      model: "prov/model-a",
      reviewMode: "none",
      status: "failed",
      resultSummary: "Exit code 1: unit test failed"
    };

    hooks.renderWorkspaceState(
      env.buildSampleState({
        recommendations: [sampleRec],
        taskQueue: {
          status: "paused",
          executionMode: "dynamic-workflow",
          defaultReviewMode: "none",
          counts: { total: 1, running: 0, queued: 0, done: 0, failed: 1, progressPct: 0 },
          items: [failedTask]
        }
      })
    );

    const card0 = env.elements.get("rec-card-0");
    // 1. Pressing Enter on a child button does not open the card's Action Window
    card0.dispatchEvent({ type: "keydown", key: "Enter", target: env.elements.get("rec-launch-0"), preventDefault: () => {} });
    assert.equal(hooks.isOverlayOpen(), false);

    // 2. Pressing Enter on the card itself opens the Action Window
    let prevented = false;
    card0.dispatchEvent({ type: "keydown", key: "Enter", target: card0, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.targetType, "recommendation");

    // 3. While More actions (3) is collapsed, hidden buttons are excluded even if overlayLayer.querySelectorAll returns them
    const hiddenBtn = env.elements.get("overlay-btn-run-here");
    const moreBody = env.elements.get("overlay-more-actions-body");
    moreBody.style.display = "none";
    hiddenBtn.style.display = "none";
    const overlayLayer = env.elements.get("overlayLayer");
    const origQsa = overlayLayer.querySelectorAll;
    overlayLayer.querySelectorAll = () => [
      env.elements.get("overlayCloseBtn"),
      env.elements.get("overlay-rec-cmd"),
      env.elements.get("overlay-btn-more-actions"),
      hiddenBtn
    ];
    const visibleFocusables = hooks.getOverlayFocusableElements().map((el) => el.id);
    assert.equal(visibleFocusables.includes("overlay-btn-run-here"), false);
    overlayLayer.querySelectorAll = origQsa;

    hooks.closeOverlay();
    assert.equal(hooks.isOverlayOpen(), false);

    // 4. Queue Focus View displays failure resultSummary and reconciles focus safely when retry removes #overlay-q-retry
    hooks.openOverlay({
      kind: "focus",
      targetType: "queue-item",
      targetKey: failedTask.id,
      triggerEl: env.elements.get("queueTabHeading")
    });
    assert.match(env.elements.get("overlay-q-result").textContent, /Exit code 1: unit test failed/);

    const retryBtn = env.elements.get("overlay-q-retry");
    retryBtn.focus();
    const queuedVersion = { ...failedTask, status: "queued", resultSummary: "" };
    hooks.reconcileActiveOverlay(
      env.buildSampleState({
        recommendations: [sampleRec],
        taskQueue: {
          status: "idle",
          executionMode: "dynamic-workflow",
          defaultReviewMode: "none",
          counts: { total: 1, running: 0, queued: 1, done: 0, failed: 0, progressPct: 0 },
          items: [queuedVersion]
        }
      })
    );
    assert.equal(hooks.isOverlayOpen(), true);
    assert.ok(
      env.getActiveElement()?.id?.startsWith("overlay"),
      "Focus must stay inside overlay after #overlay-q-retry is removed by reconciliation"
    );

    // 5. Removing task from inside Queue Focus View preserves the removal toast instead of overwriting it
    env.elements.get("overlay-q-remove").dispatchEvent({ type: "click" });
    hooks.setCurrentState(
      env.buildSampleState({
        recommendations: [sampleRec],
        taskQueue: {
          status: "idle",
          executionMode: "dynamic-workflow",
          defaultReviewMode: "none",
          counts: { total: 0, running: 0, queued: 0, done: 0, failed: 0, progressPct: 0 },
          items: []
        }
      })
    );
    await env.flushMicrotasks();
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(env.elements.get("toastText").textContent, "🗑️ Removed task from queue");
  });
});


