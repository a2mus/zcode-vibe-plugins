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
  const pendingInspectArtifactResolutions = [];
  const pendingReconcileResolutions = [];
  const pendingOpenArtifactResolutions = [];
  const intervalCallbacks = [];
  const scheduledTimers = [];

  let nextTimerId = 1;
  let activeElement = null;
  let isHidden = initialOptions.hidden ?? false;
  let visibilityState = initialOptions.visibilityState ?? "visible";
  let autoRespondGetState = initialOptions.autoRespondGetState ?? true;
  let queueManageHandler = initialOptions.queueManageHandler ?? null;

  const VOID_TAGS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
  ]);

  function unescapeAttr(v) {
    return String(v || "").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  function splitSelectorList(sel) {
    const parts = [];
    let cur = "";
    let bracketDepth = 0;
    let quoteChar = "";
    for (let i = 0; i < sel.length; i++) {
      const ch = sel[i];
      if (quoteChar) {
        cur += ch;
        if (ch === quoteChar && sel[i - 1] !== "\\") quoteChar = "";
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteChar = ch;
        cur += ch;
        continue;
      }
      if (ch === "[") bracketDepth++;
      else if (ch === "]" && bracketDepth > 0) bracketDepth--;
      else if (ch === "," && bracketDepth === 0) {
        if (cur.trim()) parts.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  function matchesSingleSelector(node, rawSel) {
    if (!node || !rawSel) return false;
    let sel = rawSel.trim();
    if (!sel) return false;

    const notClauses = [];
    sel = sel.replace(/:not\(([^)]+)\)/g, (_, inner) => {
      notClauses.push(inner.trim());
      return "";
    });
    for (const nc of notClauses) {
      if (matchesSingleSelector(node, nc)) return false;
    }

    let rest = sel.trim();
    const tagMatch = rest.match(/^([a-z0-9-]+)/i);
    if (tagMatch) {
      if (node.tagName !== tagMatch[1].toUpperCase()) return false;
      rest = rest.slice(tagMatch[1].length);
    }

    while (rest.length > 0) {
      if (rest[0] === "#") {
        const m = rest.match(/^#([a-z0-9_-]+)/i);
        if (!m || node.id !== m[1]) return false;
        rest = rest.slice(m[0].length);
      } else if (rest[0] === ".") {
        const m = rest.match(/^\.([a-z0-9_-]+)/i);
        if (!m || !node.classList?.contains(m[1])) return false;
        rest = rest.slice(m[0].length);
      } else if (rest[0] === "[") {
        const eqMatch = rest.match(/^\[([a-z0-9_-]+)="((?:\\.|[^"\\])*)"\]/i) ||
          rest.match(/^\[([a-z0-9_-]+)='((?:\\.|[^'\\])*)'\]/i);
        if (eqMatch) {
          const expected = unescapeAttr(eqMatch[2]);
          if (node.getAttribute?.(eqMatch[1]) !== expected) return false;
          rest = rest.slice(eqMatch[0].length);
          continue;
        }
        const bareEqMatch = rest.match(/^\[([a-z0-9_-]+)=([^\]]+)\]/i);
        if (bareEqMatch) {
          if (node.getAttribute?.(bareEqMatch[1]) !== bareEqMatch[2].trim()) return false;
          rest = rest.slice(bareEqMatch[0].length);
          continue;
        }
        const presMatch = rest.match(/^\[([a-z0-9_-]+)\]/i);
        if (presMatch) {
          const attrName = presMatch[1];
          if (attrName === "disabled") {
            if (!node.disabled && !node.hasAttribute?.("disabled")) return false;
          } else if (!node.hasAttribute?.(attrName)) {
            return false;
          }
          rest = rest.slice(presMatch[0].length);
          continue;
        }
        return false;
      } else {
        return false;
      }
    }
    return true;
  }

  function matchesSelector(node, sel) {
    if (!node || !sel || typeof sel !== "string") return false;
    return splitSelectorList(sel).some((part) => matchesSingleSelector(node, part));
  }

  function decodeHtmlEntities(s) {
    return String(s || "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  }

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
      checked: false,
      parentElement: null,
      _children: [],
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
        if (k === "disabled") el.disabled = true;
      },
      getAttribute(k) {
        return attributes.has(k) ? attributes.get(k) : null;
      },
      hasAttribute(k) {
        return attributes.has(k);
      },
      removeAttribute(k) {
        attributes.delete(k);
        if (k === "disabled") el.disabled = false;
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
        let stopped = false;
        if (typeof evt.stopPropagation !== "function") {
          evt.stopPropagation = () => {
            stopped = true;
          };
        } else {
          const origStop = evt.stopPropagation;
          evt.stopPropagation = () => {
            stopped = true;
            origStop();
          };
        }
        let cur = el;
        while (cur) {
          evt.currentTarget = cur;
          for (const fn of [...(cur.listeners.get(evt.type) || [])]) fn(evt);
          if (!evt.bubbles || stopped) break;
          cur = cur.parentElement;
        }
        return !evt.defaultPrevented;
      },
      closest(sel) {
        let cur = this;
        while (cur) {
          if (matchesSelector(cur, sel)) return cur;
          cur = cur.parentElement;
        }
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
        if (child) {
          child.parentElement = el;
          el._children.push(child);
        }
        return child;
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (node) => {
          for (const child of node._children || []) {
            if (matchesSelector(child, sel)) out.push(child);
            walk(child);
          }
        };
        walk(el);
        return out;
      },
      querySelector(sel) {
        const list = el.querySelectorAll(sel);
        return list.length ? list[0] : null;
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

        const detachTree = (node) => {
          for (const c of node._children || []) {
            if (!c.id) c.isConnected = false;
            c.parentElement = null;
            detachTree(c);
          }
          node._children = [];
        };
        detachTree(el);

        if (el._renderedTriggerKeys) {
          for (const oldKey of el._renderedTriggerKeys) {
            const prevTrig = elements.get(oldKey);
            if (prevTrig && !prevTrig.id) prevTrig.isConnected = false;
            elements.delete(oldKey);
          }
        }
        el._renderedTriggerKeys = [];

        const stack = [el];
        const cleanMarkup = innerHtmlVal.replace(/<!--[\s\S]*?-->/g, "");
        for (const tagMatch of cleanMarkup.matchAll(/<(\/?)([a-z0-9-]+)([^>]*)>/gi)) {
          const isClosing = tagMatch[1] === "/";
          const tagNameRaw = tagMatch[2];
          const tagUpper = tagNameRaw.toUpperCase();
          const attrStr = tagMatch[3] || "";

          if (isClosing) {
            for (let i = stack.length - 1; i >= 1; i--) {
              if (stack[i].tagName === tagUpper) {
                stack.length = i;
                break;
              }
            }
            continue;
          }

          const idMatch = attrStr.match(/\bid="([^"]+)"/i);
          const nodeId = idMatch ? idMatch[1] : "";
          const childEl = nodeId ? (elements.get(nodeId) || makeElement(nodeId, tagNameRaw)) : makeElement("", tagNameRaw);
          childEl.tagName = tagUpper;
          childEl.isConnected = true;
          childEl._children = [];

          if (nodeId) {
            classSetClear(childEl, attrStr);
          }
          childEl.disabled = /\bdisabled\b/i.test(attrStr);
          if (/\bchecked\b/i.test(attrStr)) childEl.checked = true;

          for (const attr of attrStr.matchAll(/([a-z0-9-]+)="([^"]*)"/gi)) {
            const attrName = attr[1];
            const attrVal = decodeHtmlEntities(attr[2]);
            childEl.setAttribute(attrName, attrVal);
            if (attrName === "class") {
              attrVal.split(/\s+/).filter(Boolean).forEach((c) => childEl.classList.add(c));
            }
            if (attrName === "style") {
              const dispMatch = attrVal.match(/(?:^|;)\s*display\s*:\s*([^;]+)/i);
              if (dispMatch) childEl.style.display = dispMatch[1].trim();
            }
          }

          const parent = stack[stack.length - 1];
          childEl.parentElement = parent;
          parent._children.push(childEl);

          const trigVal = childEl.getAttribute("data-overlay-trigger");
          if (trigVal !== null) {
            const trigKey = `trigger:${trigVal}`;
            elements.set(trigKey, childEl);
            el._renderedTriggerKeys.push(trigKey);
          }
          const expVal = childEl.getAttribute("data-focus-expand");
          if (expVal !== null) {
            const expKey = `expand:${expVal}`;
            elements.set(expKey, childEl);
            el._renderedTriggerKeys.push(expKey);
          }

          const selfClosing = attrStr.trim().endsWith("/") || VOID_TAGS.has(tagNameRaw.toLowerCase());
          if (!selfClosing) {
            stack.push(childEl);
          }
        }

        for (const textMatch of innerHtmlVal.matchAll(/<([a-z0-9-]+)\s+[^>]*id="([^"]+)"[^>]*>([^<]*)<\/\1>/gi)) {
          const targetEl = elements.get(textMatch[2]);
          if (targetEl && targetEl.tagName !== "TEXTAREA") {
            targetEl.textContent = decodeHtmlEntities(textMatch[3]).trim();
          }
        }
        for (const taMatch of innerHtmlVal.matchAll(/<textarea\s+[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/gi)) {
          const taEl = elements.get(taMatch[1]) || makeElement(taMatch[1], "TEXTAREA");
          taEl.tagName = "TEXTAREA";
          taEl.value = decodeHtmlEntities(taMatch[2]);
        }
        for (const selMatch of innerHtmlVal.matchAll(/<select\s+[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)) {
          const selEl = elements.get(selMatch[1]) || makeElement(selMatch[1], "SELECT");
          selEl.tagName = "SELECT";
          const optMatch = selMatch[2].match(/<option\s+[^>]*value="([^"]*)"[^>]*selected/i);
          if (optMatch) {
            selEl.value = decodeHtmlEntities(optMatch[1]);
          }
        }
      }
    });

    function classSetClear(target, attrStr) {
      if (/\bclass="/i.test(attrStr)) {
        for (const cls of [...classSetFor(target)]) {
          target.classList.remove(cls);
        }
      }
    }

    function classSetFor(target) {
      return (target.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    }

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

  // Pre-seed elements with IDs and parent/child structure from panel markup
  const panelMarkup = PANEL_HTML.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "");
  const bodyMatch = panelMarkup.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    body.innerHTML = bodyMatch[1];
  } else {
    for (const match of panelMarkup.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi)) {
      const el = elements.get(match[3]) || makeElement(match[3], match[1]);
      for (const attr of match[2].matchAll(/([a-z0-9-]+)="([^"]*)"/gi)) {
        el.setAttribute(attr[1], attr[2]);
        if (attr[1] === "class") {
          attr[2].split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
        }
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
      querySelectorAll: (sel) => body.querySelectorAll(sel),
      querySelector: (sel) => {
        if (!sel || typeof sel !== "string") return null;
        if (sel.startsWith("#")) {
          const byId = elements.get(sel.slice(1));
          return byId && byId.isConnected !== false ? byId : null;
        }
        const trigMatch = sel.match(/^\[data-overlay-trigger="((?:\\.|[^"\\])*)"\]$/);
        if (trigMatch) {
          const val = unescapeAttr(trigMatch[1]);
          const trig = elements.get(`trigger:${val}`);
          if (trig && trig.isConnected !== false) return trig;
          for (const candidate of elements.values()) {
            if (
              candidate &&
              candidate.isConnected !== false &&
              typeof candidate.getAttribute === "function" &&
              candidate.getAttribute("data-overlay-trigger") === val
            ) {
              return candidate;
            }
          }
        }
        const expMatch = sel.match(/^\[data-focus-expand="((?:\\.|[^"\\])*)"\]$/);
        if (expMatch) {
          const val = unescapeAttr(expMatch[1]);
          const exp = elements.get(`expand:${val}`);
          if (exp && exp.isConnected !== false) return exp;
        }
        return body.querySelector(sel);
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
                if (typeof queueManageHandler === "function") {
                  try {
                    const nextState = queueManageHandler(msg.params.arguments);
                    dispatchWindowMessage({
                      jsonrpc: "2.0",
                      id: msg.id,
                      result: { structuredContent: nextState }
                    });
                  } catch (err) {
                    dispatchWindowMessage({
                      jsonrpc: "2.0",
                      id: msg.id,
                      error: { message: err?.message || String(err) }
                    });
                  }
                  return;
                }
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: { structuredContent: sandbox.window.__bmadTestHooks?.getCurrentState?.() || buildSampleState() }
                });
              });
            } else if (msg.params?.name === "bmad_inspect_artifact") {
              pendingInspectArtifactResolutions.push({
                resolve: (structuredContent) =>
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: { structuredContent }
                  }),
                reject: (message) =>
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    error: { message }
                  })
              });
            } else if (msg.params?.name === "bmad_reconcile_trackers") {
              pendingReconcileResolutions.push({
                resolve: (structuredContent) =>
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: { structuredContent }
                  }),
                reject: (message) =>
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    error: { message }
                  })
              });
            } else if (msg.params?.name === "bmad_open_artifact_file") {
              pendingOpenArtifactResolutions.push({
                resolve: (structuredContent) =>
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: { structuredContent }
                  }),
                reject: (message) =>
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    id: msg.id,
                    error: { message }
                  })
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
    pendingInspectArtifactResolutions,
    pendingReconcileResolutions,
    pendingOpenArtifactResolutions,
    buildSampleState,
    dispatchDocumentEvent,
    dispatchWindowMessage,
    setQueueManageHandler: (fn) => {
      queueManageHandler = fn;
    },
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
    resolveNextInspectArtifact(structuredContent) {
      const entry = pendingInspectArtifactResolutions.shift();
      assert.ok(entry, "No pending bmad_inspect_artifact call to resolve");
      entry.resolve(structuredContent);
    },
    rejectNextInspectArtifact(message) {
      const entry = pendingInspectArtifactResolutions.shift();
      assert.ok(entry, "No pending bmad_inspect_artifact call to reject");
      entry.reject(message);
    },
    resolveNextReconcile(structuredContent) {
      const entry = pendingReconcileResolutions.shift();
      assert.ok(entry, "No pending bmad_reconcile_trackers call to resolve");
      entry.resolve(structuredContent);
    },
    rejectNextReconcile(message) {
      const entry = pendingReconcileResolutions.shift();
      assert.ok(entry, "No pending bmad_reconcile_trackers call to reject");
      entry.reject(message);
    },
    resolveNextOpenArtifact(structuredContent) {
      const entry = pendingOpenArtifactResolutions.shift();
      assert.ok(entry, "No pending bmad_open_artifact_file call to resolve");
      entry.resolve(structuredContent);
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
    const artsList = env.elements.get("artifactsDirectoryList");
    const provBar = env.elements.get("providerStateBar");

    const recsCount1 = recsList.innerHtmlSetCount;
    const insightsCount1 = insightsList.innerHtmlSetCount;
    const phasesCount1 = phasesList.innerHtmlSetCount;
    const epicsCount1 = epicsList.innerHtmlSetCount;
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

  it("renders Queue Plan/Build controls & pills, dispatches set-split-config, and preserves in-progress status when marking a Plan step done", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    hooks.switchTab("queue");

    hooks.renderWorkspaceState(
      env.buildSampleState({
        availableModels: [
          { id: "prov/opus-planner", modelId: "opus-planner", providerName: "Prov" },
          { id: "prov/sonnet-coder", modelId: "sonnet-coder", providerName: "Prov" }
        ],
        taskQueue: {
          status: "idle",
          executionMode: "separate-sessions",
          defaultReviewMode: "none",
          splitPlanBuild: true,
          plannerModel: "prov/opus-planner",
          builderModel: "prov/sonnet-coder",
          effectivePlannerModel: "prov/opus-planner",
          effectiveBuilderModel: "prov/sonnet-coder",
          activeTask: null,
          nextQueuedTask: {
            id: "q-1-plan",
            title: "Plan: Story 1.1",
            taskPhase: "plan",
            status: "queued"
          },
          counts: { total: 2, running: 0, queued: 2, done: 0, failed: 0, progressPct: 0 },
          items: [
            {
              id: "q-1-plan",
              title: "Plan: Story 1.1",
              taskPhase: "plan",
              status: "queued",
              model: "prov/opus-planner",
              modelShort: "opus-planner",
              reviewMode: "none",
              effectivePrompt: '/bmad-build-auto "Plan ticket 1.1. Halt after planning."',
              storyId: "1.1",
              overrideKey: "epic-core#1"
            },
            {
              id: "q-1-build",
              title: "Build: Story 1.1",
              taskPhase: "build",
              status: "queued",
              model: "prov/sonnet-coder",
              modelShort: "sonnet-coder",
              reviewMode: "none",
              effectivePrompt: '/bmad-build-auto "Implement ticket 1.1"',
              storyId: "1.1",
              overrideKey: "epic-core#1"
            }
          ]
        }
      })
    );

    const queueListHtml = env.elements.get("queueItemsList").innerHTML;
    assert.match(queueListHtml, /🧠 PLAN/);
    assert.match(queueListHtml, /💻 BUILD/);
    assert.equal(env.elements.get("queueSplitPlanBuildToggle").checked, true);
    assert.equal(env.elements.get("queueSplitStatusPill").textContent, "ON · 2 Models");
    assert.equal(env.elements.get("queuePlannerModelSelect").value, "prov/opus-planner");
    assert.equal(env.elements.get("queueBuilderModelSelect").value, "prov/sonnet-coder");

    // Toggle split OFF -> dispatches bmad_queue_manage set-split-config
    const toggle = env.elements.get("queueSplitPlanBuildToggle");
    toggle.checked = false;
    toggle.dispatchEvent({ type: "change", target: toggle });
    await env.flushMicrotasks();
    const splitCalls = env.toolCalls.filter(
      (c) => c.params?.name === "bmad_queue_manage" && c.params?.arguments?.action === "set-split-config"
    );
    assert.ok(splitCalls.length >= 1);
    assert.equal(splitCalls[0].params.arguments.splitPlanBuild, false);

    // Changing planner model dispatches set-split-config with applyToExisting: true
    const plannerSel = env.elements.get("queuePlannerModelSelect");
    plannerSel.value = "prov/opus-planner";
    plannerSel.dispatchEvent({ type: "change", target: plannerSel });
    await env.flushMicrotasks();
    const modelSplitCall = env.toolCalls.filter(
      (c) =>
        c.params?.name === "bmad_queue_manage" &&
        c.params?.arguments?.action === "set-split-config" &&
        c.params?.arguments?.plannerModel === "prov/opus-planner"
    );
    assert.equal(modelSplitCall.length, 1);
    assert.equal(modelSplitCall[0].params.arguments.applyToExisting, true);

    // Clicking Complete Active & Continue while nextQueuedTask is a Plan step sends storyStatus: "in-progress"
    env.elements.get("btnCompleteActiveTask").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    const completeCalls = env.toolCalls.filter(
      (c) => c.params?.name === "bmad_queue_manage" && c.params?.arguments?.action === "complete-task"
    );
    const lastComplete = completeCalls[completeCalls.length - 1];
    assert.equal(lastComplete.params.arguments.taskId, "q-1-plan");
    assert.equal(lastComplete.params.arguments.storyStatus, "in-progress");
  });
});

describe("Epic 8 Story 8.2: 3-tab Work / Queue / Project navigation, inline phase diff & overlay focus fallback", () => {
  it("defaults to 'work' tab, routes #btnGoToQueueFromWork to 'queue', and normalizes unknown/legacy tab IDs to 'work'", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    assert.equal(hooks.getActiveTabId(), "work", "Initial active tab must be 'work'");

    env.elements.get("btnGoToQueueFromWork").dispatchEvent({ type: "click" });
    assert.equal(hooks.getActiveTabId(), "queue", "#btnGoToQueueFromWork must navigate to 'queue'");
    assert.equal(env.elements.get("tab-queue").style.display, "block");
    assert.equal(env.elements.get("tab-work").style.display, "none");

    for (const legacyOrUnknown of ["artifacts", "catalog", "advisor", "progress", "nonexistent-tab"]) {
      hooks.switchTab(legacyOrUnknown);
      assert.equal(hooks.getActiveTabId(), "work", `Unknown/legacy tab '${legacyOrUnknown}' must normalize to 'work'`);
      assert.equal(env.elements.get("tab-work").style.display, "block");
      assert.equal(env.elements.get("tab-queue").style.display, "none");
      assert.equal(env.elements.get("tab-project").style.display, "none");
    }
  });

  it("inspects phase artifact [data-art-diff] chips inline inside 'project' (success + error fallback) without switching tabs", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    hooks.switchTab("project");
    assert.equal(hooks.getActiveTabId(), "project");

    hooks.renderWorkspaceState(
      env.buildSampleState({
        phases: [
          {
            id: "2-planning",
            name: "Phase 2 · Planning",
            progressPct: 60,
            status: "in-progress",
            summary: "UX specifications",
            artifacts: [
              {
                relPath: "docs/ux.md",
                name: "ux.md",
                displayLabel: "ux.md",
                mtimeMs: 1700000000000
              }
            ]
          }
        ],
        artifacts: [
          {
            relPath: "docs/ux.md",
            name: "ux.md",
            kind: "ux",
            phaseId: "2-planning",
            phaseName: "Planning",
            gitStatus: "modified",
            mtimeMs: 1700000000000
          }
        ]
      })
    );

    const previewCard = env.elements.get("artifactPreviewCard");
    let scrolledIntoView = 0;
    previewCard.scrollIntoView = () => {
      scrolledIntoView++;
    };

    const phasesList = env.elements.get("phasesList");
    const diffBtns = phasesList.querySelectorAll("[data-art-diff]");
    assert.equal(diffBtns.length, 1, "Phase chip [data-art-diff] button must be rendered");

    // 1. Click diff chip -> stays on 'project', shows preview card, calls bmad_inspect_artifact
    diffBtns[0].dispatchEvent({ type: "click", stopPropagation() {} });
    assert.equal(hooks.getActiveTabId(), "project", "Clicking phase artifact chip must stay on 'project'");
    assert.equal(previewCard.style.display, "block");
    assert.equal(env.elements.get("previewFileName").textContent, "docs/ux.md");
    assert.equal(scrolledIntoView, 1);

    const inspectCall = env.toolCalls.filter((c) => c.params?.name === "bmad_inspect_artifact").pop();
    assert.equal(inspectCall?.params?.arguments?.relPath, "docs/ux.md");

    env.resolveNextInspectArtifact({
      relPath: "docs/ux.md",
      mtimeMs: 1700000000000,
      diffSource: "Git Diff",
      diff: "@@ -1,1 +1,2 @@\n+Added line\n-Removed line",
      preview: "Full content"
    });
    await env.flushMicrotasks();

    assert.equal(hooks.getActiveTabId(), "project");
    assert.match(env.elements.get("artifactPreviewContent").innerHTML, /diff-add/);
    assert.match(env.elements.get("artifactPreviewContent").innerHTML, /diff-del/);

    // 2. Tool error renders "Failed to load artifact: <message>" in #artifactPreviewContent while staying on 'project'
    diffBtns[0].dispatchEvent({ type: "click", stopPropagation() {} });
    env.rejectNextInspectArtifact("Access denied outside root");
    await env.flushMicrotasks();

    assert.equal(hooks.getActiveTabId(), "project");
    assert.equal(
      env.elements.get("artifactPreviewContent").textContent,
      "Failed to load artifact: Access denied outside root"
    );
  });

  it("restores focus to #projectTabHeading when closing an overlay on 'project' whose trigger is detached and unmatched", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    hooks.switchTab("project");
    const detachedTrigger = env.makeElement("detached-phase-trigger", "DIV");
    detachedTrigger.isConnected = false;

    hooks.openOverlay({
      kind: "focus",
      targetType: "phase",
      targetKey: "missing-phase-id",
      triggerEl: detachedTrigger,
      triggerSelector: '[data-overlay-trigger="phase:missing-phase-id"]'
    });
    assert.equal(hooks.isOverlayOpen(), true);

    hooks.closeOverlay();
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(
      env.getActiveElement()?.id,
      "projectTabHeading",
      "Closing overlay on 'project' with unresolvable trigger must restore focus to #projectTabHeading"
    );
  });
});

describe("Epic 8 Story 8.5: Focus View across Work, Queue & Project cards with click guard & live sync (RD-7 / AD-10 / AD-17)", () => {
  function buildRichFocusState(env) {
    return env.buildSampleState({
      projectName: "Focus View Project",
      availableModels: [
        { id: "prov/model-a", modelId: "model-a", providerName: "Prov", current: true },
        { id: "prov/model-b", modelId: "model-b", providerName: "Prov" }
      ],
      turnAnalysis: {
        turnCount: 7,
        aiSummaryHeadline: "Turn 7 analyzed workspace artifacts",
        lastAssistantSummary: "Ready for Story 8.5 verification.",
        currentFocus: {
          text: "Focus View is ready across Work, Queue, and Project.",
          basisLabel: "Current focus",
          conversationCount: 2,
          source: "deterministic"
        }
      },
      smartInsights: [
        { title: "Tracker Sync", detail: "1 story ready for review", severity: "warning" },
        { title: "Tests Green", detail: "All 35 guard checks pass", severity: "success" }
      ],
      phases: [
        {
          id: "4-implementation",
          name: "Phase 4 · Implementation",
          progressPct: 75,
          status: "in-progress",
          summary: "Building panel Focus View.",
          artifacts: [
            { relPath: "docs/plan-8-5.md", name: "plan-8-5.md", displayLabel: "plan-8-5.md", mtimeMs: 1700000000000 }
          ]
        }
      ],
      epics: [
        {
          id: "epic-8",
          slug: "epic-panel-readability-redesign",
          number: 8,
          title: "Panel Readability Redesign",
          smartProgressPct: 80,
          declaredProgressPct: 60,
          hasRetrospective: false,
          stories: [
            {
              id: "8.5",
              title: "Focus View across cards",
              description: "Wire all 8 Focus View targets with click guard.",
              verify: "node --test tests/panel-guards.test.mjs",
              smartStatus: "in-progress",
              declaredStatus: "ready-for-dev",
              aiReconciled: true,
              smartReason: "Panel markup updated",
              overrideKey: "epic-panel-readability-redesign#5",
              recommendedModel: { modelId: "prov/model-a", shortName: "model-a", tier: "💻 Coding", reason: "Fastest coding model" }
            }
          ]
        }
      ],
      artifacts: [
        {
          relPath: "docs/plan-8-5.md",
          name: "plan-8-5.md",
          kind: "plan",
          phaseId: "4-implementation",
          phaseName: "Implementation",
          gitStatus: "modified",
          mtimeMs: 1700000000000
        }
      ],
      taskQueue: {
        status: "running",
        executionMode: "separate-sessions",
        defaultReviewMode: "none",
        activeTask: {
          id: "q-active-1",
          title: "Active Spotlight Task",
          taskPhase: "build",
          skill: "/bmad-build-auto",
          status: "running",
          model: "prov/model-a",
          modelShort: "model-a",
          reviewMode: "quick",
          prompt: '/bmad-build-auto "Build spotlight task"',
          effectivePrompt: '/bmad-build-auto "Build spotlight task (gate: quick)"'
        },
        counts: { total: 2, running: 1, queued: 1, done: 0, failed: 0, progressPct: 0 },
        items: [
          {
            id: "q-active-1",
            title: "Active Spotlight Task",
            taskPhase: "build",
            skill: "/bmad-build-auto",
            status: "running",
            model: "prov/model-a",
            modelShort: "model-a",
            reviewMode: "quick",
            prompt: '/bmad-build-auto "Build spotlight task"',
            effectivePrompt: '/bmad-build-auto "Build spotlight task (gate: quick)"'
          },
          {
            id: "q-item-2",
            title: "Queued Followup Task",
            taskPhase: "plan",
            skill: "/bmad-build-auto",
            status: "queued",
            model: "prov/model-a",
            modelShort: "model-a",
            reviewMode: "none",
            prompt: '/bmad-build-auto "Plan followup task"',
            effectivePrompt: '/bmad-build-auto "Plan followup task (halt after planning)"'
          }
        ]
      }
    });
  }

  it("opens all 8 canonical Focus View targetTypes via card clicks and ⤢ Expand buttons using overlay-* IDs and restores focus on close", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const state = buildRichFocusState(env);
    hooks.renderWorkspaceState(state);

    // 1. Work: insights via #insightsCard body & #btnExpandInsights
    const insightsCard = env.elements.get("insightsCard");
    insightsCard.dispatchEvent({ type: "click", target: insightsCard });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.kind, "focus");
    assert.equal(hooks.getActiveOverlay()?.targetType, "insights");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "insights");
    assert.match(env.elements.get("overlayBody").innerHTML, /id="overlay-insights-turn"/);
    assert.match(env.elements.get("overlayBody").innerHTML, /id="overlay-insights-list"/);
    assert.match(env.elements.get("overlayBody").innerHTML, /Tracker Sync/);
    hooks.closeOverlay();
    assert.equal(env.getActiveElement(), insightsCard, "Closing insights Focus View restores focus to #insightsCard");

    const expandInsightsBtn = env.elements.get("btnExpandInsights");
    expandInsightsBtn.dispatchEvent({ type: "click", target: expandInsightsBtn, bubbles: true });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.targetType, "insights");
    hooks.closeOverlay();
    assert.equal(env.getActiveElement(), expandInsightsBtn, "Closing from ⤢ restores focus to #btnExpandInsights");

    // 2. Queue: active-spotlight via card & ⤢ button
    hooks.switchTab("queue");
    const spotlightCard = env.sandbox.document.querySelector('[data-overlay-trigger="active-spotlight:q-active-1"]');
    assert.ok(spotlightCard, "active-spotlight card trigger must be rendered");
    spotlightCard.dispatchEvent({ type: "click", target: spotlightCard });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.targetType, "active-spotlight");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "q-active-1");
    assert.match(env.elements.get("overlayBody").innerHTML, /id="overlay-q-prompt"/);
    assert.match(env.elements.get("overlayBody").innerHTML, /id="overlay-q-effective-prompt"/);
    hooks.closeOverlay();
    assert.equal(env.getActiveElement(), spotlightCard);

    // 3. Queue: queue-item via card & ⤢ button, zero background ID duplication
    const qCard = env.sandbox.document.querySelector('[data-overlay-trigger="queue-item:q-item-2"]');
    const qExpandBtn = env.sandbox.document.querySelector('[data-focus-expand="queue-item:q-item-2"]');
    assert.ok(qCard && qExpandBtn, "queue-item card and ⤢ button must be rendered");
    qExpandBtn.dispatchEvent({ type: "click", target: qExpandBtn, bubbles: true });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.targetType, "queue-item");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "q-item-2");
    const qOverlayHtml = env.elements.get("overlayBody").innerHTML;
    assert.match(qOverlayHtml, /id="overlay-q-model"/);
    assert.match(qOverlayHtml, /id="overlay-q-review"/);
    assert.match(qOverlayHtml, /id="overlay-q-prompt"/);
    assert.doesNotMatch(qOverlayHtml, /id="q-model-|id="q-review-/);
    hooks.closeOverlay();
    assert.equal(env.getActiveElement(), qExpandBtn);

    // 4. Project: phase
    hooks.switchTab("project");
    const phaseCard = env.sandbox.document.querySelector('[data-overlay-trigger="phase:4-implementation"]');
    assert.ok(phaseCard, "phase card trigger must be rendered");
    phaseCard.dispatchEvent({ type: "click", target: phaseCard });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.targetType, "phase");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "4-implementation");
    assert.match(env.elements.get("overlayBody").innerHTML, /id="overlay-phase-artifacts"/);
    hooks.closeOverlay();
    assert.equal(env.getActiveElement(), phaseCard);

    // 5. Project: epic (and drill-down into story)
    const epicBox = env.sandbox.document.querySelector('[data-overlay-trigger="epic:epic-8"]');
    assert.ok(epicBox, "epic-box trigger must be rendered");
    epicBox.dispatchEvent({ type: "click", target: epicBox });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.targetType, "epic");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "epic-8");
    const epicBodyHtml = env.elements.get("overlayBody").innerHTML;
    assert.match(epicBodyHtml, /id="overlay-epic-queue-all"/);
    assert.match(epicBodyHtml, /id="overlay-epic-stories"/);
    const drillStoryBtn = env.elements.get("overlay-epic-story-0");
    drillStoryBtn.dispatchEvent({ type: "click", target: drillStoryBtn });
    assert.equal(hooks.getActiveOverlay()?.targetType, "story");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "epic-panel-readability-redesign#5");
    hooks.closeOverlay();

    // 6. Project: story via ⤢ button
    const storyExpand = env.sandbox.document.querySelector('[data-focus-expand="story:epic-panel-readability-redesign#5"]');
    assert.ok(storyExpand, "story ⤢ button must be rendered");
    storyExpand.dispatchEvent({ type: "click", target: storyExpand, bubbles: true });
    assert.equal(hooks.getActiveOverlay()?.targetType, "story");
    assert.match(env.elements.get("overlayBody").innerHTML, /id="overlay-story-cmd"/);
    assert.match(env.elements.get("overlayBody").innerHTML, /id="overlay-story-model"/);
    hooks.closeOverlay();
    assert.equal(env.getActiveElement(), storyExpand);

    // 7. Project: artifact via ⤢ button (cold load) and #btnExpandArtifactPreview
    const artExpand = env.sandbox.document.querySelector('[data-focus-expand="artifact:docs/plan-8-5.md"]');
    assert.ok(artExpand, "artifact ⤢ button must be rendered");
    artExpand.dispatchEvent({ type: "click", target: artExpand, bubbles: true });
    assert.equal(hooks.getActiveOverlay()?.targetType, "artifact");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "docs/plan-8-5.md");
    assert.doesNotMatch(env.elements.get("overlayBody").innerHTML, /id="artifactPreviewContent"/);
    env.resolveNextInspectArtifact({
      relPath: "docs/plan-8-5.md",
      mtimeMs: 1700000000000,
      diffSource: "Git Diff",
      diff: "+Story 8.5 line",
      preview: "Plan 8.5 full content"
    });
    await env.flushMicrotasks();
    assert.match(env.elements.get("overlay-art-preview").innerHTML, /Story 8\.5 line/);
    hooks.closeOverlay();
    assert.equal(
      env.getActiveElement()?.getAttribute?.("data-focus-expand"),
      "artifact:docs/plan-8-5.md",
      "Closing artifact Focus View after re-render falls back via triggerSelector to the fresh ⤢ button"
    );

    // #btnExpandArtifactPreview opens cached artifact immediately
    const previewExpand = env.elements.get("btnExpandArtifactPreview");
    previewExpand.dispatchEvent({ type: "click", target: previewExpand });
    assert.equal(hooks.getActiveOverlay()?.targetType, "artifact");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "docs/plan-8-5.md");
    hooks.closeOverlay();
    assert.equal(env.getActiveElement(), previewExpand);

    // 8. Project: reconciliation-diff via #reconciliationDiffCard & #btnExpandReconciliationDiff
    const diffCard = env.elements.get("reconciliationDiffCard");
    diffCard.dispatchEvent({ type: "click", target: diffCard });
    assert.equal(hooks.getActiveOverlay()?.targetType, "reconciliation-diff");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "reconciliation-diff");
    assert.doesNotMatch(env.elements.get("overlayBody").innerHTML, /id="diffCardContent"/);
    hooks.closeOverlay();
    assert.equal(env.getActiveElement(), diffCard);

    // Verify overlay type ramp rules in PANEL_HTML
    assert.match(PANEL_HTML, /\.overlay-title[\s\S]*?font-size:\s*var\(--overlay-title-size\)/);
    assert.match(PANEL_HTML, /\.overlay-body-text[\s\S]*?font-size:\s*var\(--overlay-body-size\)/);
    assert.match(PANEL_HTML, /\.overlay-command-text[\s\S]*?font-size:\s*var\(--overlay-command-size\)/);
    assert.match(PANEL_HTML, /\.overlay-meta-text[\s\S]*?font-size:\s*var\(--overlay-meta-size\)/);
  });

  it("enforces interactive-descendant click guard across all Focus View targets and stops nested story-row clicks from opening epic Focus View", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();
    hooks.renderWorkspaceState(buildRichFocusState(env));

    // 1. Insights card interactive children (.pill) do not open Focus View
    const insightsCard = env.elements.get("insightsCard");
    const turnBadge = env.elements.get("turnBadge");
    insightsCard.dispatchEvent({ type: "click", target: turnBadge });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking .pill inside #insightsCard must not open Focus View");

    // 2. Queue item interactive children (<select>, <button>, .pill) keep normal clicks
    hooks.switchTab("queue");
    const qCard = env.sandbox.document.querySelector('[data-overlay-trigger="queue-item:q-item-2"]');
    const qSelect = env.elements.get("q-model-1");
    qCard.dispatchEvent({ type: "click", target: qSelect });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking <select> inside queue card must not open Focus View");

    const qDoneBtn = qCard.querySelector('[data-q-done="q-item-2"]');
    assert.ok(qDoneBtn);
    qDoneBtn.dispatchEvent({ type: "click", target: qDoneBtn, bubbles: true });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking Mark Done button inside queue card must not open Focus View");

    // 3. Phase card artifact chip button does not open phase Focus View
    hooks.switchTab("project");
    const phaseCard = env.sandbox.document.querySelector('[data-overlay-trigger="phase:4-implementation"]');
    const artDiffChip = phaseCard.querySelector('[data-art-diff="docs/plan-8-5.md"]');
    assert.ok(artDiffChip);
    artDiffChip.dispatchEvent({ type: "click", target: artDiffChip, bubbles: true });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking phase artifact chip must not open phase Focus View");

    // 4. Artifact row .art-row-btn and 🔀 Diff button do not open artifact Focus View
    const artRow = env.sandbox.document.querySelector('[data-overlay-trigger="artifact:docs/plan-8-5.md"]');
    const artRowBtn = artRow.querySelector(".art-row-btn");
    assert.ok(artRowBtn);
    artRowBtn.dispatchEvent({ type: "click", target: artRowBtn, bubbles: true });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking .art-row-btn must preview inline without opening Focus View");

    // 5. Reconciliation diff #btnCloseDiff does not open reconciliation-diff Focus View
    const diffCard = env.elements.get("reconciliationDiffCard");
    const closeDiffBtn = env.elements.get("btnCloseDiff");
    closeDiffBtn.dispatchEvent({ type: "click", target: closeDiffBtn, bubbles: true });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking #btnCloseDiff must close inline diff without opening Focus View");

    // 6. Epic toggle button and Queue Epic button do not open epic Focus View
    const epicBox = env.sandbox.document.querySelector('[data-overlay-trigger="epic:epic-8"]');
    const epicToggle = epicBox.querySelector('[data-epic-toggle="epic-8"]');
    assert.ok(epicToggle);
    epicBox.dispatchEvent({ type: "click", target: epicToggle });
    assert.equal(hooks.isOverlayOpen(), false, "Clicking .epic-toggle-btn must not open epic Focus View");

    // 7. Nested .story-row inside .epic-box opens ONLY story Focus View even when bubbling
    const storyRow = env.sandbox.document.querySelector('[data-overlay-trigger="story:epic-panel-readability-redesign#5"]');
    assert.ok(storyRow);
    storyRow.dispatchEvent({ type: "click", target: storyRow, bubbles: true });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.targetType, "story", "Nested .story-row click must open story Focus View");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "epic-panel-readability-redesign#5");
    hooks.closeOverlay();

    // Even if epicBox directly receives an event whose target is storyRow, nested-trigger guard ignores it
    epicBox.dispatchEvent({ type: "click", target: storyRow });
    assert.equal(hooks.isOverlayOpen(), false, "Parent .epic-box must ignore clicks whose closest trigger is nested .story-row");

    // 8. Special characters (quotes) in targetKey do not throw during closeOverlay triggerSelector lookup
    hooks.openOverlay({
      kind: "focus",
      targetType: "story",
      targetKey: 'quoted"key\\test',
      triggerEl: null
    });
    assert.doesNotThrow(() => hooks.closeOverlay());
  });

  it("syncs live Queue model, review, and prompt edits via update-item across polls, guards empty/error Save, and suppresses missing toast when completing active-spotlight", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    let liveState = buildRichFocusState(env);
    let failNextQueueManage = false;

    env.setQueueManageHandler((args) => {
      if (failNextQueueManage) {
        failNextQueueManage = false;
        throw new Error("Simulated queue write failure");
      }
      const nextItems = (liveState.taskQueue.items || []).map((it) => {
        if (it.id !== args.taskId) return it;
        if (args.action === "update-item") {
          return {
            ...it,
            ...(args.model ? { model: args.model, modelShort: args.model.split("/").pop() } : {}),
            ...(args.reviewMode ? { reviewMode: args.reviewMode } : {}),
            ...(args.prompt ? { prompt: args.prompt, effectivePrompt: args.prompt + " [synced]" } : {})
          };
        }
        if (args.action === "complete-task") {
          return { ...it, status: "done" };
        }
        return it;
      });
      const nextActive =
        args.action === "complete-task" && liveState.taskQueue.activeTask?.id === args.taskId
          ? null
          : nextItems.find((i) => i.id === liveState.taskQueue.activeTask?.id) || null;
      liveState = {
        ...liveState,
        taskQueue: {
          ...liveState.taskQueue,
          activeTask: nextActive,
          items: nextItems
        }
      };
      return liveState;
    });

    hooks.switchTab("queue");
    hooks.renderWorkspaceState(liveState);

    // Open queue-item Focus View
    const qCard = env.sandbox.document.querySelector('[data-overlay-trigger="queue-item:q-item-2"]');
    qCard.dispatchEvent({ type: "click", target: qCard });
    assert.equal(hooks.getActiveOverlay()?.targetType, "queue-item");

    // 1. Live model & review update clears stale pendingWorkspaceState, updates underlying card & overlay
    hooks.setPendingWorkspaceState(env.buildSampleState({ projectName: "Stale Poll Must Clear" }));
    const modelSel = env.elements.get("overlay-q-model");
    modelSel.value = "prov/model-b";
    modelSel.dispatchEvent({ type: "change" });
    await env.flushMicrotasks();

    assert.equal(hooks.getPendingWorkspaceState(), null);
    assert.equal(env.elements.get("q-model-1").value, "prov/model-b", "Underlying queue card model updated");
    assert.equal(env.elements.get("overlay-q-model").value, "prov/model-b", "Open overlay model reconciled");

    const revSel = env.elements.get("overlay-q-review");
    revSel.value = "thorough";
    revSel.dispatchEvent({ type: "change" });
    await env.flushMicrotasks();
    assert.equal(env.elements.get("q-review-1").value, "thorough", "Underlying queue card review gate updated");
    assert.equal(env.elements.get("overlay-q-review").value, "thorough", "Open overlay review gate reconciled");

    // 2. Empty prompt on Save shows warning toast and skips RPC
    const promptTa = env.elements.get("overlay-q-prompt");
    promptTa.value = "   ";
    promptTa.dispatchEvent({ type: "input" });
    const callsBeforeEmpty = env.toolCalls.length;
    env.elements.get("overlay-q-save-prompt").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    assert.equal(env.toolCalls.length, callsBeforeEmpty, "Empty prompt must skip bmad_queue_manage RPC");
    assert.match(env.elements.get("toastText").textContent, /empty/i);

    // 3. Edit prompt -> survives poll & close/reopen, RPC error preserves draft
    promptTa.value = '/bmad-build-auto "Updated queued prompt v2"';
    promptTa.dispatchEvent({ type: "input" });
    assert.equal(hooks.getUserEditedPrompts().get("queue:q-item-2")?.value, '/bmad-build-auto "Updated queued prompt v2"');

    // Close & reopen -> draft survives
    hooks.closeOverlay();
    const qCard2 = env.sandbox.document.querySelector('[data-overlay-trigger="queue-item:q-item-2"]');
    qCard2.dispatchEvent({ type: "click", target: qCard2 });
    assert.equal(env.elements.get("overlay-q-prompt").value, '/bmad-build-auto "Updated queued prompt v2"');

    // RPC error keeps draft & shows error toast
    failNextQueueManage = true;
    env.elements.get("overlay-q-save-prompt").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    assert.match(env.elements.get("toastText").textContent, /Queue action failed/);
    assert.equal(hooks.getUserEditedPrompts().get("queue:q-item-2")?.value, '/bmad-build-auto "Updated queued prompt v2"');

    // Save successfully -> clears pendingWorkspaceState, updates underlying card & overlay
    hooks.setPendingWorkspaceState(env.buildSampleState({ projectName: "Stale Poll 2" }));
    env.elements.get("overlay-q-save-prompt").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    assert.equal(hooks.getPendingWorkspaceState(), null);
    assert.match(env.elements.get("queueItemsList").innerHTML, /Updated queued prompt v2(?:&quot;|") \[synced\]/);
    assert.equal(env.elements.get("overlay-q-prompt").value, '/bmad-build-auto "Updated queued prompt v2"');

    // 4. Unsaved prompt draft commits before New Session launch
    const promptTaAgain = env.elements.get("overlay-q-prompt");
    promptTaAgain.value = '/bmad-build-auto "Launch-committed prompt v3"';
    promptTaAgain.dispatchEvent({ type: "input" });
    const callsBeforeLaunch = env.toolCalls.length;
    env.elements.get("overlay-q-launch").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    const postLaunchCalls = env.toolCalls.slice(callsBeforeLaunch);
    const commitCall = postLaunchCalls.find(
      (c) => c.params?.name === "bmad_queue_manage" && c.params?.arguments?.action === "update-item"
    );
    const prepCall = postLaunchCalls.find((c) => c.params?.name === "bmad_prepare_new_session");
    assert.equal(commitCall?.params?.arguments?.prompt, '/bmad-build-auto "Launch-committed prompt v3"');
    assert.match(prepCall?.params?.arguments?.prompt || "", /Launch-committed prompt v3/);
    hooks.closeOverlay();

    // 5. Completing active-spotlight from Focus View closes overlay without "That item is no longer available" toast
    const spotlightCard = env.sandbox.document.querySelector('[data-overlay-trigger="active-spotlight:q-active-1"]');
    spotlightCard.dispatchEvent({ type: "click", target: spotlightCard });
    assert.equal(hooks.getActiveOverlay()?.targetType, "active-spotlight");

    // First verify failed complete-task resets suppression flag
    failNextQueueManage = true;
    env.elements.get("overlay-q-done").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    assert.equal(hooks.isOverlayOpen(), true);

    // Now succeed -> activeTask clears -> closes cleanly with completion toast & focuses #queueTabHeading
    env.elements.get("overlay-q-done").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(env.elements.get("toastText").textContent, "✓ Task marked Done & next task promoted");
    assert.equal(env.getActiveElement(), env.elements.get("queueTabHeading"));
  });

  it("syncs Story Focus View prompt/model drafts to underlying .story-row on close and reconciles Queue Story", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    let state = buildRichFocusState(env);
    env.setQueueManageHandler((args) => {
      if (args.action === "add" && Array.isArray(args.items)) {
        const added = args.items.map((x, idx) => ({
          id: `added-${idx}`,
          ...x,
          status: "queued",
          effectivePrompt: x.prompt
        }));
        state = {
          ...state,
          taskQueue: {
            ...state.taskQueue,
            items: [...state.taskQueue.items, ...added]
          }
        };
      }
      return state;
    });

    hooks.switchTab("project");
    hooks.renderWorkspaceState(state);

    const storyRow = env.sandbox.document.querySelector('[data-overlay-trigger="story:epic-panel-readability-redesign#5"]');
    storyRow.dispatchEvent({ type: "click", target: storyRow, bubbles: true });
    assert.equal(hooks.getActiveOverlay()?.targetType, "story");

    const storyCmd = env.elements.get("overlay-story-cmd");
    const storyModel = env.elements.get("overlay-story-model");
    storyCmd.value = '/bmad-build-auto "Custom story 8.5 prompt"';
    storyCmd.dispatchEvent({ type: "input" });
    storyModel.value = "prov/model-b";
    storyModel.dispatchEvent({ type: "change" });

    // Background poll stashes while open; close flushes and repaints underlying story row
    hooks.closeOverlay();
    const epicsHtmlAfterClose = env.elements.get("epicsList").innerHTML;
    assert.match(epicsHtmlAfterClose, /🤖 model-b/, "Underlying story row model pill reflects Story Focus View edit");
    assert.match(epicsHtmlAfterClose, /✎ Customized/, "Underlying story row shows Customized badge");
    assert.match(epicsHtmlAfterClose, /Custom story 8\.5 prompt/, "Underlying story row button prompt reflects draft");

    // Reopen story Focus View, verify draft persists, and Queue Story reconciles in place
    const storyRow2 = env.sandbox.document.querySelector('[data-overlay-trigger="story:epic-panel-readability-redesign#5"]');
    storyRow2.dispatchEvent({ type: "click", target: storyRow2, bubbles: true });
    assert.equal(env.elements.get("overlay-story-cmd").value, '/bmad-build-auto "Custom story 8.5 prompt"');
    assert.equal(env.elements.get("overlay-story-model").value, "prov/model-b");

    env.elements.get("overlay-story-queue").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    assert.equal(hooks.isOverlayOpen(), true, "Queue Story keeps Story Focus View open and reconciles in place");
    assert.match(env.elements.get("epicsList").innerHTML, /⏳ Queued/, "Underlying story row shows Queued pill");
    assert.equal(env.elements.get("overlay-story-queue").textContent, "↻ Update in Queue");
  });

  it("syncs Artifact Focus View async load, Diff/Content toggles, and error fallback without losing intra-overlay focus", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    hooks.switchTab("project");
    hooks.renderWorkspaceState(buildRichFocusState(env));

    const artExpand = env.sandbox.document.querySelector('[data-focus-expand="artifact:docs/plan-8-5.md"]');
    artExpand.dispatchEvent({ type: "click", target: artExpand, bubbles: true });
    assert.equal(hooks.getActiveOverlay()?.targetType, "artifact");
    assert.equal(env.elements.get("overlay-art-preview").textContent, "Loading artifact diff & content…");

    // Focus #overlay-art-content-btn while loading and resolve inspect
    const contentBtn = env.elements.get("overlay-art-content-btn");
    contentBtn.focus();

    env.resolveNextInspectArtifact({
      relPath: "docs/plan-8-5.md",
      mtimeMs: 1700000000000,
      diffSource: "Git Diff",
      diff: "+Added line in plan",
      preview: "Full plan markdown content"
    });
    await env.flushMicrotasks();

    assert.equal(env.getActiveElement(), contentBtn, "Async load keeps intra-overlay focus intact");
    assert.match(env.elements.get("overlay-art-preview").innerHTML, /diff-add/);
    assert.match(env.elements.get("artifactPreviewContent").innerHTML, /diff-add/);

    // Toggle to Content -> updates both overlay and background inspector aria-pressed & text
    contentBtn.dispatchEvent({ type: "click" });
    assert.equal(contentBtn.getAttribute("aria-pressed"), "true");
    assert.equal(env.elements.get("overlay-art-diff-btn").getAttribute("aria-pressed"), "false");
    assert.equal(env.elements.get("btnToggleContentMode").getAttribute("aria-pressed"), "true");
    assert.equal(env.elements.get("overlay-art-preview").textContent, "Full plan markdown content");
    assert.equal(env.elements.get("artifactPreviewContent").textContent, "Full plan markdown content");

    // Error path when cold-opening another artifact
    hooks.closeOverlay();
    hooks.renderWorkspaceState(
      env.buildSampleState({
        artifacts: [{ relPath: "docs/missing.md", name: "missing.md", kind: "doc", phaseName: "Planning", mtimeMs: 1000 }]
      })
    );
    const missingExpand = env.sandbox.document.querySelector('[data-focus-expand="artifact:docs/missing.md"]');
    missingExpand.dispatchEvent({ type: "click", target: missingExpand, bubbles: true });
    env.rejectNextInspectArtifact("File not found");
    await env.flushMicrotasks();

    assert.equal(env.elements.get("overlay-art-preview").textContent, "Failed to load artifact: File not found");
  });

  it("persists Reconciliation Diff across preview/apply, reconciles overlay live, clears on #btnCloseDiff, and handles null reconciliationDiff", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const baseState = buildRichFocusState(env);
    hooks.switchTab("project");
    hooks.renderWorkspaceState(baseState);

    // 1. Dry run persists lastReconciliationDiff and renders in Focus View
    env.elements.get("btnPreviewReconcile").dispatchEvent({ type: "click" });
    env.resolveNextReconcile({
      changesCount: 1,
      updatedFiles: ["tickets.toml"],
      changes: [
        {
          file: "tickets.toml",
          key: "epic-panel-readability-redesign#5",
          oldStatus: "ready-for-dev",
          newStatus: "done",
          reason: "All Focus View tests verified"
        }
      ]
    });
    await env.flushMicrotasks();

    assert.equal(hooks.getLastReconciliationDiff()?.dryRun, true);
    const expandDiffBtn = env.elements.get("btnExpandReconciliationDiff");
    expandDiffBtn.dispatchEvent({ type: "click", target: expandDiffBtn, bubbles: true });
    assert.equal(hooks.getActiveOverlay()?.targetType, "reconciliation-diff");
    const diffBodyHtml = env.elements.get("overlayBody").innerHTML;
    assert.match(diffBodyHtml, /tickets\.toml/);
    assert.match(diffBodyHtml, /ready-for-dev/);
    assert.match(diffBodyHtml, /All Focus View tests verified/);

    // 2. Apply inside overlay clears pendingWorkspaceState and reconciles live
    hooks.setPendingWorkspaceState(env.buildSampleState({ projectName: "Stale Poll" }));
    env.elements.get("overlay-diff-apply").dispatchEvent({ type: "click" });
    env.resolveNextReconcile({
      changesCount: 1,
      updatedFiles: ["tickets.toml"],
      changes: [
        {
          file: "tickets.toml",
          key: "epic-panel-readability-redesign#5",
          oldStatus: "ready-for-dev",
          newStatus: "done",
          reason: "Applied to disk"
        }
      ],
      newScan: { ...baseState, projectName: "Reconciled Live Scan" }
    });
    await env.flushMicrotasks();

    assert.equal(hooks.getPendingWorkspaceState(), null);
    assert.equal(hooks.getLastReconciliationDiff()?.dryRun, false);
    assert.equal(hooks.isOverlayOpen(), true);
    assert.match(env.elements.get("overlayTitle").textContent, /Reconciled 1 keys/);
    assert.match(env.elements.get("overlayBody").innerHTML, /Applied to disk/);

    // 3. reconciliationDiff: null closes overlay with missing-item toast + #projectTabHeading focus
    hooks.reconcileActiveOverlay({ ...baseState, reconciliationDiff: null });
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(env.elements.get("toastText").textContent, "That item is no longer available");
    assert.equal(env.getActiveElement(), env.elements.get("projectTabHeading"));

    // 4. #btnCloseDiff clears lastReconciliationDiff and restores focus to #btnPreviewReconcile
    assert.ok(hooks.getLastReconciliationDiff(), "lastReconciliationDiff is populated before close");
    env.elements.get("btnCloseDiff").dispatchEvent({ type: "click" });
    assert.equal(hooks.getLastReconciliationDiff(), null, "#btnCloseDiff must clear lastReconciliationDiff");
    assert.equal(env.getActiveElement(), env.elements.get("btnPreviewReconcile"));
  });

  it("supports Focus View drill-down Back navigation, empty-prompt guard, stale artifact cache reset, and done-story review skill queuing", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const state = buildRichFocusState(env);
    state.epics[0].stories.push({
      id: "8.1",
      title: "Done Palette Story",
      description: "Completed story",
      smartStatus: "done",
      declaredStatus: "done",
      overrideKey: "epic-panel-readability-redesign#1",
      recommendedModel: { modelId: "prov/model-a", shortName: "model-a" }
    });
    state.recommendations = [
      {
        title: "Guard Test Rec",
        plainTitle: "Test empty guard",
        plainSummary: "Summary",
        skill: "/bmad-ux",
        phase: "2-planning",
        fullCommand: '/bmad-ux "Initial"'
      }
    ];

    hooks.switchTab("project");
    hooks.renderWorkspaceState(state);

    // 1. Epic -> Story drill-down -> <- Back returns to Epic
    const epicBox = env.sandbox.document.querySelector('[data-overlay-trigger="epic:epic-8"]');
    epicBox.dispatchEvent({ type: "click", target: epicBox });
    assert.equal(hooks.getActiveOverlay()?.targetType, "epic");
    env.elements.get("overlay-epic-story-0").dispatchEvent({ type: "click" });
    assert.equal(hooks.getActiveOverlay()?.targetType, "story");
    const backBtn = env.elements.get("overlay-back-btn");
    assert.ok(backBtn, "Drilled-down Story Focus View must render ← Back button");
    backBtn.dispatchEvent({ type: "click" });
    assert.equal(hooks.getActiveOverlay()?.targetType, "epic");
    hooks.closeOverlay();

    // 2. Phase -> Artifact drill-down -> <- Back returns to Phase
    const phaseCard = env.sandbox.document.querySelector('[data-overlay-trigger="phase:4-implementation"]');
    phaseCard.dispatchEvent({ type: "click", target: phaseCard });
    assert.equal(hooks.getActiveOverlay()?.targetType, "phase");
    env.elements.get("overlay-phase-art-diff-0").dispatchEvent({ type: "click" });
    assert.equal(hooks.getActiveOverlay()?.targetType, "artifact");
    env.resolveNextInspectArtifact({
      relPath: "docs/plan-8-5.md",
      mtimeMs: 1700000000000,
      diffSource: "Git Diff",
      diff: "+Line",
      preview: "Plan 8.5 content"
    });
    await env.flushMicrotasks();
    env.elements.get("overlay-back-btn").dispatchEvent({ type: "click" });
    assert.equal(hooks.getActiveOverlay()?.targetType, "phase");
    hooks.closeOverlay();

    // 3. Switching to a second artifact that fails to load clears stale loadedArtifactData from the first artifact
    hooks.renderWorkspaceState({
      ...state,
      artifacts: [
        ...state.artifacts,
        { relPath: "docs/broken.md", name: "broken.md", kind: "doc", phaseName: "Planning", mtimeMs: 100 }
      ]
    });
    const brokenExpand = env.sandbox.document.querySelector('[data-focus-expand="artifact:docs/broken.md"]');
    brokenExpand.dispatchEvent({ type: "click", target: brokenExpand, bubbles: true });
    env.rejectNextInspectArtifact("Disk read failed");
    await env.flushMicrotasks();
    assert.equal(env.elements.get("overlay-art-preview").textContent, "Failed to load artifact: Disk read failed");
    hooks.closeOverlay();
    // Clicking Content mode on failed card must not render previous Plan 8.5 content
    env.elements.get("btnToggleContentMode").dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("artifactPreviewContent").textContent, "Failed to load artifact: Disk read failed");

    // 4. Done story queued from Project row uses /bmad-code-review skill
    const callsBeforeQueueStory = env.toolCalls.length;
    const doneStoryQueueBtn = env.sandbox.document.querySelector('[data-queue-story-id="8.1"]');
    assert.ok(doneStoryQueueBtn);
    doneStoryQueueBtn.dispatchEvent({ type: "click", stopPropagation() {} });
    await env.flushMicrotasks();
    const queueStoryCall = env.toolCalls.slice(callsBeforeQueueStory).find((c) => c.params?.name === "bmad_queue_manage");
    assert.equal(queueStoryCall?.params?.arguments?.items?.[0]?.skill, "/bmad-code-review");

    // 5. Empty prompt guard in Work Action Window prevents RPC on empty textarea
    hooks.switchTab("work");
    const recCard = env.elements.get("rec-card-0");
    recCard.dispatchEvent({ type: "click", target: recCard });
    const recTa = env.elements.get("overlay-rec-cmd");
    recTa.value = "   ";
    recTa.dispatchEvent({ type: "input" });
    const callsBeforeEmptyAction = env.toolCalls.length;
    env.elements.get("overlay-btn-queue").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    assert.equal(env.toolCalls.length, callsBeforeEmptyAction);
    assert.match(env.elements.get("toastText").textContent, /empty/i);
    hooks.closeOverlay();
  });
});

describe("Epic 8 Story 8.6: Finalized AD-16 overlay lifecycle, Escape/Tab, reconcile, selectedRecKeys, baseModel & interactive-descendant guard suite", () => {
  it("handles #overlayCloseBtn click, #overlayLayer backdrop vs #overlayCard click, aria-hidden transitions, single non-stacking replacement, and closed closeOverlay() no-op", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const overlayLayer = env.elements.get("overlayLayer");
    const overlayCard = env.elements.get("overlayCard");
    const overlayCloseBtn = env.elements.get("overlayCloseBtn");
    const overlayBody = env.elements.get("overlayBody");
    const overlayTitle = env.elements.get("overlayTitle");

    // Initial closed state + safe no-op closeOverlay()
    assert.equal(overlayLayer.getAttribute("aria-hidden"), "true");
    assert.equal(overlayLayer.style.display, "none");
    assert.doesNotThrow(() => hooks.closeOverlay());
    assert.equal(hooks.isOverlayOpen(), false);

    hooks.renderWorkspaceState(
      env.buildSampleState({
        projectName: "Base Lifecycle Project",
        smartInsights: [{ title: "Insight 1", detail: "Detail 1", severity: "info" }],
        taskQueue: {
          status: "idle",
          executionMode: "separate-sessions",
          defaultReviewMode: "none",
          counts: { total: 1, running: 0, queued: 1, done: 0, failed: 0, progressPct: 0 },
          items: [
            {
              id: "q-replace-1",
              title: "Replacement Queue Item",
              status: "queued",
              model: "prov/model-a",
              reviewMode: "none",
              effectivePrompt: '/bmad-build "Replace"'
            }
          ]
        }
      })
    );

    const insightsTrigger = env.elements.get("insightsCard");
    hooks.openOverlay({
      kind: "focus",
      targetType: "insights",
      targetKey: "insights",
      triggerEl: insightsTrigger
    });

    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(overlayLayer.getAttribute("aria-hidden"), "false");
    assert.equal(overlayLayer.classList.contains("visible"), true);
    assert.equal(overlayLayer.style.display, "flex");
    assert.ok(overlayBody.innerHTML.length > 0, "#overlayBody must render content when open");

    // Clicking inside #overlayCard does NOT close the overlay (bubbles to #overlayLayer, target !== overlayLayer)
    overlayCard.dispatchEvent({ type: "click", target: overlayCard, bubbles: true });
    assert.equal(hooks.isOverlayOpen(), true, "Clicking #overlayCard must keep overlay open");

    // Single non-stacking replacement: opening queue-item while insights is open replaces activeOverlay in place
    const queueTrigger = env.makeElement("queue-replace-trigger", "BUTTON");
    hooks.openOverlay({
      kind: "focus",
      targetType: "queue-item",
      targetKey: "q-replace-1",
      triggerEl: queueTrigger
    });
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(hooks.getActiveOverlay()?.targetType, "queue-item");
    assert.equal(hooks.getActiveOverlay()?.targetKey, "q-replace-1");
    assert.equal(overlayTitle.textContent, "Replacement Queue Item");

    // Stash state, then close via #overlayCloseBtn click -> aria-hidden="true", clears #overlayBody, restores focus, flushes stash
    const stashedAfterBtn = env.buildSampleState({ projectName: "Flushed Via CloseBtn" });
    hooks.setPendingWorkspaceState(stashedAfterBtn);
    overlayCloseBtn.dispatchEvent({ type: "click", target: overlayCloseBtn });

    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(overlayLayer.getAttribute("aria-hidden"), "true");
    assert.equal(overlayLayer.classList.contains("visible"), false);
    assert.equal(overlayLayer.style.display, "none");
    assert.equal(overlayBody.innerHTML, "");
    assert.equal(env.getActiveElement(), queueTrigger);
    assert.equal(hooks.getPendingWorkspaceState(), null);
    assert.match(env.elements.get("projectTitle").textContent, /Flushed Via CloseBtn/);

    // Reopen and close via #overlayLayer backdrop click (target === overlayLayer)
    hooks.openOverlay({
      kind: "focus",
      targetType: "insights",
      targetKey: "insights",
      triggerEl: insightsTrigger
    });
    const stashedAfterBackdrop = env.buildSampleState({ projectName: "Flushed Via Backdrop" });
    hooks.setPendingWorkspaceState(stashedAfterBackdrop);
    overlayLayer.dispatchEvent({ type: "click", target: overlayLayer });

    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(overlayLayer.getAttribute("aria-hidden"), "true");
    assert.equal(overlayLayer.style.display, "none");
    assert.equal(overlayBody.innerHTML, "");
    assert.equal(env.getActiveElement(), insightsTrigger);
    assert.equal(hooks.getPendingWorkspaceState(), null);
    assert.match(env.elements.get("projectTitle").textContent, /Flushed Via Backdrop/);
  });

  it("stashes mid-flight background refreshState started before openOverlay() and flushes immediately on close", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();

    env.resolveNextGetState(env.buildSampleState({ projectName: "Initial Before Midflight" }));
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const bgPromise = hooks.refreshState({ isBackground: true });
    assert.equal(hooks.getIsRefreshing(), true);

    // User opens overlay before the background bmad_get_state call resolves
    const triggerEl = env.elements.get("insightsCard");
    hooks.openOverlay({
      kind: "focus",
      targetType: "insights",
      targetKey: "insights",
      triggerEl
    });
    assert.equal(hooks.isOverlayOpen(), true);

    const midflightState = env.buildSampleState({ projectName: "Midflight Poll While Overlay Open" });
    env.resolveNextGetState(midflightState);
    await bgPromise;
    await env.flushMicrotasks();

    assert.equal(hooks.getIsRefreshing(), false, "isRefreshing lock must reset after mid-flight resolution");
    assert.deepEqual(
      hooks.getPendingWorkspaceState(),
      midflightState,
      "Mid-flight background poll resolving while overlay is open must stash into pendingWorkspaceState"
    );
    assert.match(
      env.elements.get("projectTitle").textContent,
      /Initial Before Midflight/,
      "Background DOM must not update while overlay is open"
    );

    hooks.closeOverlay();
    assert.equal(hooks.getPendingWorkspaceState(), null);
    assert.match(
      env.elements.get("projectTitle").textContent,
      /Midflight Poll While Overlay Open/,
      "Stashed mid-flight state must flush immediately on closeOverlay()"
    );
  });

  it("handles Escape from focused INPUT and non-form button inside overlay, and clears selectOpenUntil on Tab while preserving overlay Tab trap", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const sampleRec = {
      title: "Escape And Tab Edge Cases",
      skill: "/bmad-build",
      phase: "4-implementation",
      fullCommand: '/bmad-build "Edge cases"',
      recommendedModel: { modelId: "prov/model-a" }
    };
    hooks.renderWorkspaceState(env.buildSampleState({ projectName: "Base Escape Tab", recommendations: [sampleRec] }));

    const recKey = hooks.getRecOverrideKey(sampleRec);
    const triggerEl = env.makeElement("edge-trigger", "BUTTON");

    // (a) Escape from a focused INPUT inside an open overlay blurs input, closes overlay, flushes stash, restores focus
    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey,
      triggerEl
    });
    const overlayInput = env.makeElement("overlay-edge-input", "INPUT");
    env.elements.get("overlayBody").appendChild(overlayInput);
    overlayInput.focus();
    let inputBlurred = false;
    const origInputBlur = overlayInput.blur;
    overlayInput.blur = () => {
      inputBlurred = true;
      origInputBlur();
    };
    hooks.setPendingWorkspaceState(
      env.buildSampleState({ projectName: "Flushed After Input Escape", recommendations: [sampleRec] })
    );

    env.dispatchDocumentEvent({
      type: "keydown",
      key: "Escape",
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.equal(inputBlurred, true, "Escape inside overlay must blur focused INPUT");
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(env.getActiveElement(), triggerEl);
    assert.equal(hooks.getPendingWorkspaceState(), null);
    assert.match(env.elements.get("projectTitle").textContent, /Flushed After Input Escape/);

    // (b) Escape from a non-form button (#overlayCloseBtn) closes overlay and flushes stash
    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey,
      triggerEl
    });
    env.elements.get("overlayCloseBtn").focus();
    assert.equal(env.getActiveElement()?.id, "overlayCloseBtn");
    hooks.setPendingWorkspaceState(
      env.buildSampleState({ projectName: "Flushed After Button Escape", recommendations: [sampleRec] })
    );

    env.dispatchDocumentEvent({
      type: "keydown",
      key: "Escape",
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(env.getActiveElement(), triggerEl);
    assert.equal(hooks.getPendingWorkspaceState(), null);
    assert.match(env.elements.get("projectTitle").textContent, /Flushed After Button Escape/);

    // (c) Tab with selectOpenUntil > Date.now() clears selectOpenUntil = 0 AND still traps Tab inside overlay
    hooks.openOverlay({
      kind: "action",
      targetType: "recommendation",
      targetKey: recKey,
      triggerEl
    });
    const focusables = hooks.getOverlayFocusableElements();
    assert.ok(focusables.length >= 2);
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];

    const overlaySelect = env.elements.get("overlay-rec-model");
    env.dispatchDocumentEvent({ type: "pointerdown", target: overlaySelect });
    assert.ok(hooks.getSelectOpenUntil() > Date.now());

    // Position focus on lastFocusable and press Tab -> clears selectOpenUntil AND wraps to firstFocusable
    lastFocusable.focus();
    let tabPrevented = false;
    env.dispatchDocumentEvent({
      type: "keydown",
      key: "Tab",
      shiftKey: false,
      preventDefault: () => {
        tabPrevented = true;
      }
    });
    assert.equal(hooks.getSelectOpenUntil(), 0, "Tab must clear selectOpenUntil");
    assert.equal(tabPrevented, true, "Tab must still trap focus inside overlay after clearing selectOpenUntil");
    assert.equal(env.getActiveElement(), firstFocusable, "Tab at last focusable must wrap to first focusable");
    hooks.closeOverlay();
  });

  it("handles reconcileActiveOverlay closed no-op, disabled-element focus fallback, and explicit refreshState({ isBackground: false }) reconciliation", async () => {
    const env = createStubbedDomEnvironment({ autoRespondGetState: false });
    await env.flushMicrotasks();

    const hooks = env.getTestHooks();
    const initialQueue = {
      status: "idle",
      executionMode: "separate-sessions",
      defaultReviewMode: "none",
      counts: { total: 1, running: 0, queued: 1, done: 0, failed: 0, progressPct: 0 },
      items: [
        {
          id: "q-rec-1",
          title: "Reconcile Edge Task",
          status: "queued",
          model: "prov/model-a",
          reviewMode: "none",
          effectivePrompt: '/bmad-build "Reconcile"'
        }
      ]
    };

    const initialState = env.buildSampleState({
      projectName: "Reconcile Base",
      availableModels: [
        { id: "prov/model-a", modelId: "model-a", providerName: "Prov" },
        { id: "prov/model-b", modelId: "model-b", providerName: "Prov" }
      ],
      taskQueue: initialQueue
    });
    env.resolveNextGetState(initialState);
    await env.flushMicrotasks();

    // (a) reconcileActiveOverlay when closed is a false no-op
    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(hooks.reconcileActiveOverlay(initialState), false);

    // (b) Disabled previously-focused control (#overlay-q-done becomes disabled when status turns "done") falls back to enabled overlay focusable
    hooks.switchTab("queue");
    hooks.openOverlay({
      kind: "focus",
      targetType: "queue-item",
      targetKey: "q-rec-1",
      triggerEl: env.elements.get("queueTabHeading")
    });
    const doneBtn = env.elements.get("overlay-q-done");
    assert.equal(doneBtn.disabled, false);
    doneBtn.focus();
    assert.equal(env.getActiveElement()?.id, "overlay-q-done");

    const doneState = env.buildSampleState({
      ...initialState,
      taskQueue: {
        ...initialQueue,
        counts: { total: 1, running: 0, queued: 0, done: 1, failed: 0, progressPct: 100 },
        items: [{ ...initialQueue.items[0], status: "done" }]
      }
    });
    const reconciled = hooks.reconcileActiveOverlay(doneState);
    assert.equal(reconciled, true);
    assert.equal(env.elements.get("overlay-q-done").disabled, true);
    const activeAfterReconcile = env.getActiveElement();
    assert.ok(activeAfterReconcile, "Focus must land on a valid control after previously focused button becomes disabled");
    assert.notEqual(activeAfterReconcile.id, "overlay-q-done", "Focus must NOT stay on disabled #overlay-q-done");
    assert.equal(activeAfterReconcile.disabled, false, "Fallback focus target must be enabled");

    // (c) Explicit refreshState({ isBackground: false }) while overlay is open clears stale pendingWorkspaceState and reconciles in place, then closes on removal
    hooks.setPendingWorkspaceState(env.buildSampleState({ projectName: "Stale Poll Should Clear" }));
    const explicitPromise1 = hooks.refreshState({ isBackground: false });
    const updatedViaExplicit = env.buildSampleState({
      ...doneState,
      projectName: "Explicit Sync Updated",
      taskQueue: {
        ...doneState.taskQueue,
        items: [{ ...doneState.taskQueue.items[0], model: "prov/model-b" }]
      }
    });
    env.resolveNextGetState(updatedViaExplicit);
    await explicitPromise1;
    await env.flushMicrotasks();

    assert.equal(hooks.getPendingWorkspaceState(), null, "Explicit refreshState must clear stale pendingWorkspaceState");
    assert.equal(hooks.isOverlayOpen(), true);
    assert.equal(env.elements.get("overlay-q-model").value, "prov/model-b");

    // Explicit refreshState where item is removed closes overlay with toast + #queueTabHeading focus
    const explicitPromise2 = hooks.refreshState({ isBackground: false });
    env.resolveNextGetState(
      env.buildSampleState({
        ...updatedViaExplicit,
        taskQueue: {
          ...updatedViaExplicit.taskQueue,
          counts: { total: 0, running: 0, queued: 0, done: 0, failed: 0, progressPct: 0 },
          items: []
        }
      })
    );
    await explicitPromise2;
    await env.flushMicrotasks();

    assert.equal(hooks.isOverlayOpen(), false);
    assert.equal(env.elements.get("toastText").textContent, "That item is no longer available");
    assert.equal(env.getActiveElement(), env.elements.get("queueTabHeading"));
  });

  it("prunes disappeared keys from selectedRecKeys, clears on batch enqueue, guards empty selection, and toggles Select All / Deselect All", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const rec1 = {
      title: "Keep Me",
      plainTitle: "Keep this task",
      skill: "/bmad-build",
      phase: "4-implementation",
      fullCommand: '/bmad-build "Keep"',
      recommendedModel: { modelId: "prov/model-a" }
    };
    const rec2 = {
      title: "Drop Me Next Poll",
      plainTitle: "Drop this task",
      skill: "/bmad-ux",
      phase: "2-planning",
      fullCommand: '/bmad-ux "Drop"',
      recommendedModel: { modelId: "prov/model-b" }
    };
    const availableModels = [
      { id: "prov/model-a", modelId: "model-a", providerName: "Prov" },
      { id: "prov/model-b", modelId: "model-b", providerName: "Prov" }
    ];

    hooks.renderWorkspaceState(env.buildSampleState({ recommendations: [rec1, rec2], availableModels }));

    // Select All -> Deselect All round-trip
    const selectAllBtn = env.elements.get("btnSelectAllRecs");
    const queueSelectedBtn = env.elements.get("btnQueueSelectedRecs");
    selectAllBtn.dispatchEvent({ type: "click" });
    assert.equal(hooks.getSelectedRecKeys().size, 2);
    assert.equal(selectAllBtn.textContent, "☐ Deselect All");
    assert.equal(queueSelectedBtn.textContent, "➕ Add Checked (2) to Queue");

    selectAllBtn.dispatchEvent({ type: "click" });
    assert.equal(hooks.getSelectedRecKeys().size, 0);
    assert.equal(selectAllBtn.textContent, "☑️ Select All");
    assert.equal(queueSelectedBtn.textContent, "➕ Add Checked to Queue");

    // Empty-selection click shows warning toast and skips RPC
    const callsBeforeEmpty = env.toolCalls.length;
    queueSelectedBtn.dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    assert.equal(env.toolCalls.length, callsBeforeEmpty, "Empty selection must not invoke bmad_queue_manage");
    assert.equal(env.elements.get("toastBanner").classList.contains("is-warning"), true);
    assert.match(env.elements.get("toastText").textContent, /Check one or more recommended tasks first/);

    // Check both recs, then drop rec2 on next poll -> selectedRecKeys prunes disappeared rec2 key
    selectAllBtn.dispatchEvent({ type: "click" });
    assert.equal(hooks.getSelectedRecKeys().size, 2);

    hooks.renderWorkspaceState(env.buildSampleState({ recommendations: [rec1], availableModels }));
    assert.equal(hooks.getSelectedRecKeys().size, 1, "Disappeared recommendation key must be pruned from selectedRecKeys");
    assert.equal(hooks.getSelectedRecKeys().has(hooks.getRecOverrideKey(rec1)), true);
    assert.equal(hooks.getSelectedRecKeys().has(hooks.getRecOverrideKey(rec2)), false);
    assert.equal(queueSelectedBtn.textContent, "➕ Add Checked (1) to Queue");

    // Batch enqueue remaining rec -> clears selectedRecKeys and switches to queue
    const callsBeforeEnqueue = env.toolCalls.length;
    queueSelectedBtn.dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    const batchCall = env.toolCalls.slice(callsBeforeEnqueue).find((c) => c.params?.name === "bmad_queue_manage");
    assert.ok(batchCall, "Batch enqueue must call bmad_queue_manage");
    assert.equal(batchCall.params.arguments.items.length, 1);
    assert.equal(hooks.getSelectedRecKeys().size, 0, "selectedRecKeys must clear after successful batch enqueue");
    assert.equal(hooks.getActiveTabId(), "queue");
  });

  it("resolves all 5 tiers of getRecommendationBaseModelId consistently across card render, Action Window, card action, and batch enqueue", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    // Tier 5: empty availableModels + null / omitted rec -> ""
    hooks.setCurrentState(env.buildSampleState({ availableModels: [] }));
    assert.equal(hooks.getRecommendationBaseModelId(null), "");
    assert.equal(hooks.getRecommendationBaseModelId({ title: "No model" }), "");

    // Tier 4: omitted recommendedModel with non-current models -> first model ID
    hooks.setCurrentState(
      env.buildSampleState({
        availableModels: [
          { id: "prov/first-model", modelId: "first-model" },
          { id: "prov/second-model", modelId: "second-model" }
        ]
      })
    );
    assert.equal(hooks.getRecommendationBaseModelId({ title: "Tier 4" }), "prov/first-model");

    // Tier 3: omitted recommendedModel with a { current: true } model -> current model ID
    hooks.setCurrentState(
      env.buildSampleState({
        availableModels: [
          { id: "prov/first-model", modelId: "first-model" },
          { id: "prov/current-model", modelId: "current-model", current: true }
        ]
      })
    );
    assert.equal(hooks.getRecommendationBaseModelId({ title: "Tier 3" }), "prov/current-model");

    // Tier 2: string recommendedModel
    assert.equal(
      hooks.getRecommendationBaseModelId({ title: "Tier 2", recommendedModel: "prov/string-model" }),
      "prov/string-model"
    );

    // Tier 1: object recommendedModel.modelId
    assert.equal(
      hooks.getRecommendationBaseModelId({ title: "Tier 1", recommendedModel: { modelId: "prov/object-model" } }),
      "prov/object-model"
    );

    // Cross-consumer consistency when recommendedModel is omitted (Tier 3)
    const omittedRec = {
      title: "Omitted Model Consistency",
      plainTitle: "Omitted model consistency check",
      skill: "/bmad-build",
      phase: "4-implementation",
      fullCommand: '/bmad-build "Consistency"'
    };
    const models = [
      { id: "prov/first-model", modelId: "first-model", providerName: "Prov" },
      { id: "prov/current-model", modelId: "current-model", providerName: "Prov", current: true }
    ];
    hooks.renderWorkspaceState(env.buildSampleState({ recommendations: [omittedRec], availableModels: models }));

    assert.match(env.elements.get("rec-model-pill-0").textContent, /current-model/);

    // Edit model in Action Window to prov/first-model and close
    env.elements.get("rec-card-0").dispatchEvent({ type: "click", target: env.elements.get("rec-card-0") });
    const overlayModel = env.elements.get("overlay-rec-model");
    assert.equal(overlayModel.value, "prov/current-model", "Action Window must start on same Tier 3 base model");
    overlayModel.value = "prov/first-model";
    overlayModel.dispatchEvent({ type: "change" });
    hooks.closeOverlay();

    // Card Add to Queue uses user-selected model (not clobbered by base mismatch)
    const callsBeforeCardQueue = env.toolCalls.length;
    env.elements.get("rec-queue-0").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    const cardQueueCall = env.toolCalls.slice(callsBeforeCardQueue).find((c) => c.params?.name === "bmad_queue_manage");
    assert.equal(cardQueueCall?.params?.arguments?.items?.[0]?.model, "prov/first-model");

    // Batch enqueue also uses user-selected model
    hooks.getSelectedRecKeys().add(hooks.getRecOverrideKey(omittedRec));
    const callsBeforeBatch = env.toolCalls.length;
    env.elements.get("btnQueueSelectedRecs").dispatchEvent({ type: "click" });
    await env.flushMicrotasks();
    const batchCall = env.toolCalls.slice(callsBeforeBatch).find((c) => c.params?.name === "bmad_queue_manage");
    assert.equal(batchCall?.params?.arguments?.items?.[0]?.model, "prov/first-model");
  });

  it("verifies full AD-17 §3 interactive-descendant matrix directly and via nested closest() children", async () => {
    const env = createStubbedDomEnvironment();
    await env.flushMicrotasks();
    const hooks = env.getTestHooks();

    const container = env.makeElement("matrix-container", "DIV");
    const nonInteractiveDiv = env.makeElement("plain-div", "DIV");
    const nonInteractiveSpan = env.makeElement("plain-span", "SPAN");
    container.appendChild(nonInteractiveDiv);
    nonInteractiveDiv.appendChild(nonInteractiveSpan);

    assert.equal(hooks.isInteractiveDescendantClick(null, container), false);
    assert.equal(hooks.isInteractiveDescendantClick({}, container), false);
    assert.equal(hooks.isInteractiveDescendantClick({ target: container }, container), false);
    assert.equal(hooks.isInteractiveDescendantClick({ target: nonInteractiveDiv }, container), false);
    assert.equal(hooks.isInteractiveDescendantClick({ target: nonInteractiveSpan }, container), false);
    assert.equal(hooks.isInteractiveDescendantClick({ target: { tagName: "SPAN" } }, container), false);

    const interactiveSpecs = [
      { label: "BUTTON", tag: "BUTTON" },
      { label: "A", tag: "A" },
      { label: "INPUT", tag: "INPUT" },
      { label: "SELECT", tag: "SELECT" },
      { label: "TEXTAREA", tag: "TEXTAREA" },
      { label: "LABEL", tag: "LABEL" },
      { label: "[role=tab]", tag: "DIV", role: "tab" },
      { label: ".status-pill", tag: "SPAN", cls: "status-pill" },
      { label: ".pill", tag: "SPAN", cls: "pill" }
    ];

    for (const spec of interactiveSpecs) {
      const interactiveEl = env.makeElement(`int-${spec.label}`, spec.tag);
      if (spec.role) interactiveEl.setAttribute("role", spec.role);
      if (spec.cls) interactiveEl.classList.add(spec.cls);
      const nestedChild = env.makeElement(`nested-${spec.label}`, "SPAN");
      interactiveEl.appendChild(nestedChild);
      container.appendChild(interactiveEl);

      assert.equal(
        hooks.isInteractiveDescendantClick({ target: interactiveEl }, container),
        true,
        `Direct ${spec.label} click must be guarded`
      );
      assert.equal(
        hooks.isInteractiveDescendantClick({ target: nestedChild }, container),
        true,
        `Nested child inside ${spec.label} must be guarded via closest()`
      );
    }
  });
});





