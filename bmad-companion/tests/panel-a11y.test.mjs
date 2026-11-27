import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

import {
  PANEL_HTML_PATH,
  compositeColor,
  contrastRatio,
  extractInlineScript,
  extractStyleContent
} from "./helpers.mjs";

const PANEL_HTML = readFileSync(PANEL_HTML_PATH, "utf8");

/**
 * Read a custom property's value from the first CSS scope matching scopePattern.
 */
function extractCssVar(css, scopePattern, varName) {
  const scopeMatch = css.match(scopePattern);
  assert.ok(scopeMatch, `Scope matching ${scopePattern} must exist in CSS`);
  const varRegex = new RegExp(`${varName}:\\s*([^;]+);`);
  const varMatch = scopeMatch[0].match(varRegex);
  assert.ok(varMatch, `CSS variable ${varName} must exist in scope`);
  return varMatch[1].trim();
}

/**
 * Parse a color token that is either rgba(r, g, b, a) or #RRGGBBAA (8-digit hex,
 * the soft-fill format of the Palette C token blocks) into { hex, alpha }.
 */
function parseRgba(tokenStr) {
  const rgbaMatch = tokenStr.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
  if (rgbaMatch) {
    const hex = "#" + [1, 2, 3].map((i) => Number(rgbaMatch[i]).toString(16).padStart(2, "0")).join("");
    return { hex, alpha: parseFloat(rgbaMatch[4]) };
  }
  const hexAlphaMatch = tokenStr.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/);
  assert.ok(hexAlphaMatch, `Must be rgba(...) or #RRGGBBAA: ${tokenStr}`);
  return {
    hex: `#${hexAlphaMatch[1].toLowerCase()}`,
    alpha: parseInt(hexAlphaMatch[2], 16) / 255
  };
}

function createStubbedA11yEnvironment() {
  const elements = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  let activeElement = null;

  const VOID_TAGS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
  ]);

  function unescapeAttr(v) {
    return String(v || "").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  function decodeHtmlEntities(s) {
    return String(s || "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
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
        const eqMatch =
          rest.match(/^\[([a-z0-9_-]+)="((?:\\.|[^"\\])*)"\]/i) ||
          rest.match(/^\[([a-z0-9_-]+)='((?:\\.|[^'\\])*)'\]/i);
        if (eqMatch) {
          if (node.getAttribute?.(eqMatch[1]) !== unescapeAttr(eqMatch[2])) return false;
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
        evt.currentTarget = el;
        for (const fn of [...(listeners.get(evt.type) || [])]) fn(evt);
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
      appendChild(child) {
        if (child) {
          child.parentElement = el;
          el._children.push(child);
        }
        return child;
      },
      focus() {
        activeElement = el;
        el.dispatchEvent({ type: "focus", target: el });
      },
      blur() {
        if (activeElement === el) {
          activeElement = null;
        }
        for (const fn of documentListeners.get("focusout") || []) {
          fn({ type: "focusout", target: el });
        }
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

    Object.defineProperty(el, "innerHTML", {
      get() {
        return innerHtmlVal;
      },
      set(v) {
        innerHtmlVal = String(v ?? "");
        for (const c of el._children || []) {
          if (!c.id) c.isConnected = false;
          c.parentElement = null;
        }
        el._children = [];

        if (el._renderedTriggerKeys) {
          for (const oldKey of el._renderedTriggerKeys) {
            const prev = elements.get(oldKey);
            if (prev && !prev.id) prev.isConnected = false;
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
          if (nodeId && /\bclass="/i.test(attrStr)) {
            for (const cls of (childEl.getAttribute("class") || "").split(/\s+/).filter(Boolean)) {
              childEl.classList.remove(cls);
            }
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

  const tabBtns = [
    elements.get("tabBtnWork"),
    elements.get("tabBtnQueue"),
    elements.get("tabBtnProject")
  ].filter(Boolean);

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: () => {},
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    JSON,
    Map,
    Set,
    navigator: {
      clipboard: {
        writeText: async () => {}
      }
    },
    document: {
      documentElement,
      body,
      hidden: false,
      visibilityState: "visible",
      activeElement: null,
      getElementById: (id) => elements.get(id) || makeElement(id, "div"),
      createElement: (tag) => makeElement(`elem_${Math.random().toString(36).slice(2)}`, tag),
      querySelectorAll: (sel) => {
        if (sel === ".tab-btn") return tabBtns;
        return body.querySelectorAll(sel);
      },
      querySelector: (sel) => {
        if (sel === ".tabs-nav" || sel === "#tabsNav") return elements.get("tabsNav");
        if (sel && sel.startsWith("#")) {
          const byId = elements.get(sel.slice(1));
          return byId && byId.isConnected !== false ? byId : null;
        }
        const trigMatch = sel && sel.match(/^\[data-overlay-trigger="((?:\\.|[^"\\])*)"\]$/);
        if (trigMatch) {
          const trig = elements.get(`trigger:${unescapeAttr(trigMatch[1])}`);
          if (trig && trig.isConnected !== false) return trig;
        }
        const expMatch = sel && sel.match(/^\[data-focus-expand="((?:\\.|[^"\\])*)"\]$/);
        if (expMatch) {
          const exp = elements.get(`expand:${unescapeAttr(expMatch[1])}`);
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
      parent: {
        postMessage: () => {}
      }
    }
  };

  Object.defineProperty(sandbox.document, "activeElement", {
    get() {
      return activeElement;
    },
    set(v) {
      activeElement = v;
    }
  });

  const scriptContent = extractInlineScript(PANEL_HTML);
  vm.runInContext(scriptContent, vm.createContext(sandbox));

  return {
    sandbox,
    elements,
    makeElement,
    tabBtns,
    getActiveElement: () => activeElement,
    getTestHooks: () => sandbox.window.__bmadTestHooks
  };
}

describe("Story 4.3: Accessibility floor — close AD-1 through AD-5", () => {
  const styleText = extractStyleContent(PANEL_HTML);

  describe("AD-1: Visible .cmd-textarea focus ring (>= 3:1 contrast)", () => {
    it("defines visible :focus and :focus-visible outlines on .cmd-textarea and container border swap", () => {
      assert.match(
        styleText,
        /\.cmd-textarea:focus[\s\S]*?outline:\s*2px\s+solid\s+var\(--accent\)/,
        ".cmd-textarea:focus must specify a 2px solid var(--accent) outline"
      );
      assert.match(
        styleText,
        /\.cmd-editor-wrap:focus-within[\s\S]*?border-color:\s*var\(--accent\)/,
        ".cmd-editor-wrap:focus-within must highlight border with var(--accent)"
      );
      assert.match(
        styleText,
        /:focus-visible[\s\S]*?outline:\s*2px\s+solid\s+var\(--accent\)/,
        "global :focus-visible must provide 2px solid var(--accent)"
      );
    });

    it("verifies >= 3:1 focus ring contrast across all dark and light theme background surfaces", () => {
      const scopes = [
        { name: "Dark", pattern: /:root\s*\{[\s\S]*?\}/ },
        { name: "Light", pattern: /body\.theme-light\s*\{[\s\S]*?\}/ }
      ];
      const surfaceVars = ["--bg-primary", "--bg-secondary", "--bg-tertiary"];

      for (const { name, pattern } of scopes) {
        const accent = extractCssVar(styleText, pattern, "--accent");
        for (const surfaceVar of surfaceVars) {
          const surface = extractCssVar(styleText, pattern, surfaceVar);
          const ratio = contrastRatio(accent, surface);
          assert.ok(
            ratio >= 3.0,
            `${name} theme focus ring (${accent}) on ${surfaceVar} (${surface}) contrast is ${ratio.toFixed(2)}:1 (must be >= 3:1)`
          );
        }
      }
    });
  });

  describe("AD-2: ARIA role=tablist/tab/tabpanel + aria-selected + arrow-key navigation", () => {
    it("declares landmark role='banner' on top-bar and role='main' on main-scroll", () => {
      assert.match(
        PANEL_HTML,
        /<header[^>]*class="[^"]*top-bar[^"]*"[^>]*role="banner"/,
        "Header must declare role='banner' landmark"
      );
      assert.match(
        PANEL_HTML,
        /<main[^>]*class="[^"]*main-scroll[^"]*"[^>]*role="main"/,
        "Main must declare role='main' landmark"
      );
    });

    it("declares role='tablist' with aria-label on navigation container", () => {
      assert.match(
        PANEL_HTML,
        /<nav[^>]*id="tabsNav"[^>]*role="tablist"[^>]*aria-label="[^"]+"/i,
        "tabsNav must declare role='tablist' with descriptive aria-label"
      );
    });

    it("declares role='tab', aria-selected, aria-controls, aria-describedby, and roving tabindex on all 3 tabs", () => {
      const tabs = [
        { id: "tabBtnWork", tab: "work", selected: "true", tabindex: "0", controls: "tab-work", describedby: "tabDescWork" },
        { id: "tabBtnQueue", tab: "queue", selected: "false", tabindex: "-1", controls: "tab-queue", describedby: "tabDescQueue" },
        { id: "tabBtnProject", tab: "project", selected: "false", tabindex: "-1", controls: "tab-project", describedby: "tabDescProject" }
      ];

      for (const t of tabs) {
        const regex = new RegExp(
          `<button[^>]*id="${t.id}"[^>]*role="tab"[^>]*aria-selected="${t.selected}"[^>]*aria-controls="${t.controls}"[^>]*aria-describedby="${t.describedby}"[^>]*tabindex="${t.tabindex}"[^>]*data-tab="${t.tab}"`,
          "i"
        );
        assert.match(PANEL_HTML, regex, `Tab button ${t.id} must declare complete ARIA tab semantics`);
      }
    });

    it("declares role='tabpanel', tabindex='0', and aria-labelledby on all 3 sections", () => {
      const sections = [
        { id: "tab-work", labelledby: "tabBtnWork" },
        { id: "tab-queue", labelledby: "tabBtnQueue" },
        { id: "tab-project", labelledby: "tabBtnProject" }
      ];

      for (const s of sections) {
        const regex = new RegExp(
          `<section[^>]*id="${s.id}"[^>]*role="tabpanel"[^>]*aria-labelledby="${s.labelledby}"[^>]*tabindex="0"`,
          "i"
        );
        assert.match(PANEL_HTML, regex, `Section ${s.id} must declare role='tabpanel', tabindex='0', and aria-labelledby`);
      }
    });

    it("switches tab semantics, roving tabindex, and panel visibility on switchTab()", () => {
      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();

      const workBtn = env.elements.get("tabBtnWork");
      const queueBtn = env.elements.get("tabBtnQueue");
      const projectBtn = env.elements.get("tabBtnProject");
      const workPanel = env.elements.get("tab-work");
      const queuePanel = env.elements.get("tab-queue");
      const projectPanel = env.elements.get("tab-project");

      assert.equal(workBtn.getAttribute("aria-selected"), "true");
      assert.equal(workBtn.getAttribute("tabindex"), "0");
      assert.equal(queueBtn.getAttribute("aria-selected"), "false");
      assert.equal(queueBtn.getAttribute("tabindex"), "-1");
      assert.equal(projectBtn.getAttribute("aria-selected"), "false");
      assert.equal(projectBtn.getAttribute("tabindex"), "-1");

      hooks.switchTab("queue");

      assert.equal(workBtn.getAttribute("aria-selected"), "false");
      assert.equal(workBtn.getAttribute("tabindex"), "-1");
      assert.equal(queueBtn.getAttribute("aria-selected"), "true");
      assert.equal(queueBtn.getAttribute("tabindex"), "0");
      assert.equal(workPanel.style.display, "none");
      assert.equal(queuePanel.style.display, "block");
      assert.equal(projectPanel.style.display, "none");
    });

    it("navigates tabs with ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, and End keys (with wrap)", () => {
      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const { tabBtns } = env;

      assert.equal(tabBtns.length, 3, "Must expose exactly 3 tab buttons (work, queue, project)");

      // Focus first tab (work)
      tabBtns[0].focus();
      assert.equal(env.getActiveElement(), tabBtns[0]);

      // ArrowRight -> Queue
      let prevented = false;
      hooks.handleTabKeydown({
        key: "ArrowRight",
        currentTarget: tabBtns[0],
        preventDefault: () => {
          prevented = true;
        }
      });
      assert.ok(prevented, "ArrowRight must prevent default");
      assert.equal(tabBtns[1].getAttribute("aria-selected"), "true", "Queue tab should be selected");
      assert.equal(tabBtns[1].getAttribute("tabindex"), "0");
      assert.equal(tabBtns[0].getAttribute("aria-selected"), "false");
      assert.equal(tabBtns[0].getAttribute("tabindex"), "-1");

      // ArrowDown -> Project (index 2)
      hooks.handleTabKeydown({ key: "ArrowDown", currentTarget: tabBtns[1], preventDefault: () => {} });
      assert.equal(tabBtns[2].getAttribute("aria-selected"), "true", "Project tab should be selected");

      // ArrowRight wraps to Work (index 0)
      hooks.handleTabKeydown({ key: "ArrowRight", currentTarget: tabBtns[2], preventDefault: () => {} });
      assert.equal(tabBtns[0].getAttribute("aria-selected"), "true", "Should wrap back to Work tab");

      // ArrowLeft wraps to Project (index 2)
      hooks.handleTabKeydown({ key: "ArrowLeft", currentTarget: tabBtns[0], preventDefault: () => {} });
      assert.equal(tabBtns[2].getAttribute("aria-selected"), "true", "Should wrap back to Project tab");

      // ArrowUp -> Queue (index 1)
      hooks.handleTabKeydown({ key: "ArrowUp", currentTarget: tabBtns[2], preventDefault: () => {} });
      assert.equal(tabBtns[1].getAttribute("aria-selected"), "true", "Queue tab should be selected");

      // Home -> Work (index 0)
      hooks.handleTabKeydown({ key: "Home", currentTarget: tabBtns[1], preventDefault: () => {} });
      assert.equal(tabBtns[0].getAttribute("aria-selected"), "true", "Home must navigate to first tab");

      // End -> Project (index 2)
      hooks.handleTabKeydown({ key: "End", currentTarget: tabBtns[0], preventDefault: () => {} });
      assert.equal(tabBtns[2].getAttribute("aria-selected"), "true", "End must navigate to last tab");
    });
  });

  describe("AD-3: #toastBanner role=status/aria-live (polite, errors assertive)", () => {
    it("declares role='status', aria-live='polite', and aria-atomic='true' in initial markup", () => {
      assert.match(
        PANEL_HTML,
        /<div[^>]*id="toastBanner"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/,
        "toastBanner must declare role='status', aria-live='polite', aria-atomic='true'"
      );
    });

    it("announces normal status messages with polite priority", () => {
      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const banner = env.elements.get("toastBanner");
      const txt = env.elements.get("toastText");

      hooks.showToast("🚀 Opening new conversation [claude-sonnet]…");
      assert.equal(banner.getAttribute("aria-live"), "polite");
      assert.equal(banner.getAttribute("role"), "status");
      assert.equal(txt.textContent, "🚀 Opening new conversation [claude-sonnet]…");
      assert.ok(banner.classList.contains("visible"));
    });

    it("announces error messages with assertive priority and alert role", () => {
      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const banner = env.elements.get("toastBanner");
      const txt = env.elements.get("toastText");

      // Test error with prefix ❌
      hooks.showToast("❌ Reconciliation error: merge conflict in tickets.toml");
      assert.equal(banner.getAttribute("aria-live"), "assertive");
      assert.equal(banner.getAttribute("role"), "alert");
      assert.equal(txt.textContent, "❌ Reconciliation error: merge conflict in tickets.toml");

      // Test error with 'Failed' keyword
      hooks.showToast("Failed to open file: access denied");
      assert.equal(banner.getAttribute("aria-live"), "assertive");
      assert.equal(banner.getAttribute("role"), "alert");

      // Test subsequent polite message resets live priority back to polite
      hooks.showToast("📋 Prompt copied to clipboard");
      assert.equal(banner.getAttribute("aria-live"), "polite");
      assert.equal(banner.getAttribute("role"), "status");
    });
  });

  describe("AD-4: Associated queue/editor labels (for/id)", () => {
    it("associates queue tab review-gate and epic-picker <label>s with controls via for/id", () => {
      assert.match(
        PANEL_HTML,
        /<label[^>]*for="queueDefaultReviewSelect"[^>]*>[\s\S]*?<\/label>\s*<select[^>]*id="queueDefaultReviewSelect"/,
        "queueDefaultReviewSelect must have an explicitly associated label via for/id"
      );

      assert.match(
        PANEL_HTML,
        /<label[^>]*for="queueEpicPicker"[^>]*>[\s\S]*?<\/label>[\s\S]*?<select[^>]*id="queueEpicPicker"/,
        "queueEpicPicker must have an explicitly associated label via for/id"
      );

      assert.match(
        PANEL_HTML,
        /<label[^>]*for="queueSplitPlanBuildToggle"[^>]*>[\s\S]*?<input[^>]*id="queueSplitPlanBuildToggle"/,
        "queueSplitPlanBuildToggle must be wrapped in an associated label via for/id"
      );

      assert.match(
        PANEL_HTML,
        /<label[^>]*for="queuePlannerModelSelect"[^>]*>[\s\S]*?<\/label>\s*<select[^>]*id="queuePlannerModelSelect"/,
        "queuePlannerModelSelect must have an explicitly associated label via for/id"
      );

      assert.match(
        PANEL_HTML,
        /<label[^>]*for="queueBuilderModelSelect"[^>]*>[\s\S]*?<\/label>\s*<select[^>]*id="queueBuilderModelSelect"/,
        "queueBuilderModelSelect must have an explicitly associated label via for/id"
      );
    });

    it("associates recommendation Action Window command textarea and model select with <label> via for/id (RD-9)", () => {
      assert.match(
        PANEL_HTML,
        /<label\s+class="cmd-label"\s+for="overlay-rec-cmd">[\s\S]*?<\/label>\s*<textarea\s+class="cmd-textarea"\s+id="overlay-rec-cmd"/i,
        "Work Action Window cmd-textarea (#overlay-rec-cmd) must be preceded by an associated label with for/id"
      );
      assert.match(
        PANEL_HTML,
        /<label\s+class="label-caps"\s+for="overlay-rec-model"[^>]*>[\s\S]*?<\/label>\s*<select\s+class="model-select"\s+id="overlay-rec-model"/i,
        "Work Action Window model-select (#overlay-rec-model) must be preceded by an associated label with for/id"
      );
    });

    it("associates per-task queue assigned model and review gate <label>s with controls via for/id", () => {
      assert.match(
        PANEL_HTML,
        /<label\s+for="q-model-\$\{idx\}"[^>]*>Assigned AI Model for this Task:<\/label>\s*<select\s+class="model-select"\s+id="q-model-\$\{idx\}"/i,
        "Queue task item assigned model select must have associated label with for/id"
      );

      assert.match(
        PANEL_HTML,
        /<label\s+for="q-review-\$\{idx\}"[^>]*>Review & Token Gate:<\/label>\s*<select\s+class="model-select"\s+id="q-review-\$\{idx\}"/i,
        "Queue task item review gate select must have associated label with for/id"
      );
    });

    it("provides accessible aria-label attributes on filter inputs and selects", () => {
      assert.match(PANEL_HTML, /<input[^>]*id="storySearch"[^>]*aria-label="[^"]+"/);
      assert.match(PANEL_HTML, /<select[^>]*id="storyStatusFilter"[^>]*aria-label="[^"]+"/);
      assert.match(PANEL_HTML, /<input[^>]*id="artifactSearch"[^>]*aria-label="[^"]+"/);
    });
  });

  describe("AD-5: prefers-reduced-motion gating of .pulse-dot", () => {
    it("disables .pulse-dot animation and box-shadow under prefers-reduced-motion: reduce", () => {
      assert.match(
        styleText,
        /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\.pulse-dot\s*\{[\s\S]*?animation:\s*none[\s\S]*?box-shadow:\s*none[\s\S]*?\}/,
        "CSS must disable animation and box-shadow on .pulse-dot in @media (prefers-reduced-motion: reduce)"
      );
    });

      it("disables transitions on animated elements under reduced motion", () => {
        assert.match(
          styleText,
          /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?transition:\s*none/,
          "Reduced motion media query must disable transitions on UI elements"
        );
      });
    });
  });

  describe("Story 4.4: Contrast debt — close CD-1 through CD-5 to WCAG AA", () => {
    const styleText = extractStyleContent(PANEL_HTML);

    describe("CD-1: text-muted meets WCAG AA (>= 4.5:1) in both themes", () => {
      it("confirms dark --text-muted reaches >= 4.5:1 across dark surfaces", () => {
        const rootScope = /:root\s*\{[\s\S]*?\}/;
        const darkMuted = extractCssVar(styleText, rootScope, "--text-muted");
        const darkSurfaces = ["--bg-primary", "--bg-secondary", "--bg-tertiary"].map((v) =>
          extractCssVar(styleText, rootScope, v)
        );
        for (const bg of darkSurfaces) {
          const ratio = contrastRatio(darkMuted, bg);
          assert.ok(
            ratio >= 4.5,
            `Dark --text-muted (${darkMuted}) on ${bg} contrast is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
        }
      });

      it("confirms light --text-muted reaches >= 4.5:1 across light surfaces", () => {
        const lightScope = /body\.theme-light\s*\{[\s\S]*?\}/;
        const lightMuted = extractCssVar(styleText, lightScope, "--text-muted");
        const lightSurfaces = ["--bg-primary", "--bg-secondary", "--bg-tertiary"].map((v) =>
          extractCssVar(styleText, lightScope, v)
        );
        for (const bg of lightSurfaces) {
          const ratio = contrastRatio(lightMuted, bg);
          assert.ok(
            ratio >= 4.5,
            `Light --text-muted (${lightMuted}) on ${bg} contrast is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
        }
      });
    });

    describe("CD-2: Pill text on soft fills meets WCAG AA (>= 4.5:1) in both themes", () => {
      it("confirms all dark semantic pills reach >= 4.5:1 on card background (--bg-secondary)", () => {
        const rootScope = /:root\s*\{[\s\S]*?\}/;
        const bgSec = extractCssVar(styleText, rootScope, "--bg-secondary");
        const hues = ["accent", "success", "warning", "purple", "danger"];

        for (const hue of hues) {
          const textHex = extractCssVar(styleText, rootScope, `--${hue}`);
          const softRgba = extractCssVar(styleText, rootScope, `--${hue}-soft`);
          const { hex: softHex, alpha } = parseRgba(softRgba);
          const effectiveBg = compositeColor(softHex, alpha, bgSec);
          const ratio = contrastRatio(textHex, effectiveBg);
          assert.ok(
            ratio >= 4.5,
            `Dark pill ${hue} (${textHex}) on soft fill (${softRgba} over ${bgSec} = ${effectiveBg}) contrast is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
        }
      });

      it("confirms all light semantic pills reach >= 4.5:1 on card background (--bg-secondary)", () => {
        const lightScope = /body\.theme-light\s*\{[\s\S]*?\}/;
        const bgSec = extractCssVar(styleText, lightScope, "--bg-secondary");
        const hues = ["accent", "success", "warning", "purple", "danger"];

        for (const hue of hues) {
          const textHex = extractCssVar(styleText, lightScope, `--${hue}`);
          const softRgba = extractCssVar(styleText, lightScope, `--${hue}-soft`);
          const { hex: softHex, alpha } = parseRgba(softRgba);
          const effectiveBg = compositeColor(softHex, alpha, bgSec);
          const ratio = contrastRatio(textHex, effectiveBg);
          assert.ok(
            ratio >= 4.5,
            `Light pill ${hue} (${textHex}) on soft fill (${softRgba} over ${bgSec} = ${effectiveBg}) contrast is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
        }
      });
    });

    describe("CD-3: Primary button gradient meets WCAG AA (>= 4.5:1) in both themes", () => {
      it("confirms white label meets >= 4.5:1 across the full .btn-primary gradient in dark and light themes", () => {
        const white = "#ffffff";
        const scopes = [
          { name: "dark", pattern: /:root\s*\{[\s\S]*?\}/ },
          { name: "light", pattern: /body\.theme-light\s*\{[\s\S]*?\}/ }
        ];

        for (const { name, pattern } of scopes) {
          const gradStart = extractCssVar(styleText, pattern, "--primary-gradient-start");
          const gradEnd = extractCssVar(styleText, pattern, "--primary-gradient-end");

          const startRatio = contrastRatio(white, gradStart);
          const endRatio = contrastRatio(white, gradEnd);

          assert.ok(
            startRatio >= 4.5,
            `${name} .btn-primary gradient start (${gradStart}) white contrast is ${startRatio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
          assert.ok(
            endRatio >= 4.5,
            `${name} .btn-primary gradient end (${gradEnd}) white contrast is ${endRatio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
        }
      });
    });

    describe("CD-4: Brand badge gradient meets WCAG AA (>= 4.5:1) in both themes", () => {
      it("confirms white badge text meets >= 4.5:1 across the full .brand-badge gradient in dark and light themes", () => {
        const white = "#ffffff";
        const scopes = [
          { name: "dark", pattern: /:root\s*\{[\s\S]*?\}/ },
          { name: "light", pattern: /body\.theme-light\s*\{[\s\S]*?\}/ }
        ];

        for (const { name, pattern } of scopes) {
          const gradStart = extractCssVar(styleText, pattern, "--brand-gradient-start");
          const gradEnd = extractCssVar(styleText, pattern, "--brand-gradient-end");

          const startRatio = contrastRatio(white, gradStart);
          const endRatio = contrastRatio(white, gradEnd);

          assert.ok(
            startRatio >= 4.5,
            `${name} .brand-badge gradient start (${gradStart}) white contrast is ${startRatio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
          assert.ok(
            endRatio >= 4.5,
            `${name} .brand-badge gradient end (${gradEnd}) white contrast is ${endRatio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
        }
      });
    });

    describe("CD-5: Focus indicators reach >= 3:1 in both themes and borders remain decorative", () => {
      it("verifies interactive focus borders reach >= 3:1 in both dark and light themes", () => {
        const scopes = [
          { name: "dark", pattern: /:root\s*\{[\s\S]*?\}/ },
          { name: "light", pattern: /body\.theme-light\s*\{[\s\S]*?\}/ }
        ];

        for (const { name, pattern } of scopes) {
          const bgSec = extractCssVar(styleText, pattern, "--bg-secondary");
          const accent = extractCssVar(styleText, pattern, "--accent");
          const purple = extractCssVar(styleText, pattern, "--purple");

          const accentRatio = contrastRatio(accent, bgSec);
          const purpleRatio = contrastRatio(purple, bgSec);

          assert.ok(
            accentRatio >= 3.0,
            `${name} search-input / active focus indicator (${accent}) on ${bgSec} contrast is ${accentRatio.toFixed(2)}:1 (must be >= 3:1)`
          );
          assert.ok(
            purpleRatio >= 3.0,
            `${name} model-select focus indicator (${purple}) on ${bgSec} contrast is ${purpleRatio.toFixed(2)}:1 (must be >= 3:1)`
          );
        }
      });
    });
  });

  describe("UX Design Sync: LD-1 single-row 3-tab layout, semantic toasts & view consistency", () => {
    const styleText = extractStyleContent(PANEL_HTML);

    it("LD-1: lays out all 3 tabs in a single 3-column grid row without orphan wrapping", () => {
      assert.match(
        styleText,
        /\.tabs-nav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
        ".tabs-nav must use repeat(3, minmax(0, 1fr)) so all 3 tabs fit in one row"
      );
      assert.match(
        styleText,
        /\.tab-label\s*\{[\s\S]*?text-overflow:\s*ellipsis/,
        ".tab-label must truncate cleanly with ellipsis inside narrow docks"
      );
    });

    it("applies semantic .is-error and .is-warning toast styling alongside ARIA live priority", () => {
      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const banner = env.elements.get("toastBanner");

      hooks.showToast("❌ Reconciliation error: conflict");
      assert.ok(banner.classList.contains("is-error"), "Error toast must set .is-error");
      assert.ok(!banner.classList.contains("is-warning"), "Error toast must not set .is-warning");

      hooks.showToast("⚠️ Queue is empty! Add tasks first.");
      assert.ok(!banner.classList.contains("is-error"), "Warning toast must clear .is-error");
      assert.ok(banner.classList.contains("is-warning"), "Warning toast must set .is-warning");

      hooks.showToast("✓ All synced!");
      assert.ok(!banner.classList.contains("is-error"), "Success toast must clear .is-error");
      assert.ok(!banner.classList.contains("is-warning"), "Success toast must clear .is-warning");

      hooks.showToast("↻ Reset 2 failed task(s) to Queued — pick a model or click Run Queue to retry.");
      assert.ok(!banner.classList.contains("is-error"), "Recovery toast mentioning failed tasks must not set .is-error");
      assert.equal(banner.getAttribute("aria-live"), "polite");
      assert.equal(banner.getAttribute("role"), "status");
    });

    it("renders paused queue banner state, reconciliation diff class, aria-pressed inspector toggles, and resets scroll on tab switch", () => {
      assert.match(
        PANEL_HTML,
        /<div[^>]*id="reconciliationDiffCard"[^>]*class="reconciliation-diff-card"/,
        "Reconciliation diff card must use .reconciliation-diff-card class"
      );
      assert.match(
        PANEL_HTML,
        /<button[^>]*id="btnToggleDiffMode"[^>]*aria-pressed="true"/,
        "Inspector Diff toggle must declare aria-pressed"
      );
      assert.match(
        PANEL_HTML,
        /<button[^>]*id="btnToggleContentMode"[^>]*aria-pressed="false"/,
        "Inspector Content toggle must declare aria-pressed"
      );

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const mainScroll = env.elements.get("mainScroll");
      mainScroll.scrollTop = 240;
      hooks.switchTab("queue");
      assert.equal(mainScroll.scrollTop, 0, "switchTab must reset mainScroll.scrollTop to 0");

      hooks.renderWorkspaceState({
        projectName: "Queue Banner Test",
        metrics: { totalEpics: 0, totalStories: 0, smartDoneStories: 0, smartOverallPct: 0 },
        taskQueue: {
          status: "paused",
          executionMode: "separate-sessions",
          defaultReviewMode: "none",
          counts: { total: 2, running: 0, queued: 2, done: 0, failed: 0, progressPct: 0 },
          items: [{ id: "t1", title: "Task 1", status: "queued", model: "m", modelShort: "m", reviewMode: "none", effectivePrompt: "/bmad-build \"x\"" }]
        }
      });
      const bannerHtml = env.elements.get("liveQueueBannerContent").innerHTML;
      assert.match(bannerHtml, /pill-warning[^>]*>⏸ PAUSED \(2\)/, "Paused queue banner must render pill-warning ⏸ PAUSED badge");
    });

    it("renders padded flat .phase-card rows, keyboard-accessible Epic <button aria-expanded> toggles, empty states, and artifact close button", () => {
      assert.match(
        styleText,
        /\.phase-card\s*\{[\s\S]*?padding:\s*9px\s+11px/,
        ".phase-card must define 9px 11px padding"
      );
      assert.match(
        PANEL_HTML,
        /<button[^>]*id="btnCloseArtifactPreview"/,
        "Artifact preview card must expose #btnCloseArtifactPreview"
      );

      const env = createStubbedA11yEnvironment();
      env.elements.get("storyStatusFilter").value = "all";
      const hooks = env.getTestHooks();
      hooks.renderWorkspaceState({
        projectName: "UX Sync Test",
        metrics: { totalEpics: 1, totalStories: 1, smartDoneStories: 0, smartOverallPct: 0 },
        phases: [
          {
            id: "2-planning",
            name: "Phase 2 · Planning",
            progressPct: 50,
            status: "in-progress",
            summary: "UX specs",
            artifacts: [{ relPath: "docs/ux.md", name: "ux.md", mtimeMs: Date.now() }]
          }
        ],
        epics: [
          {
            id: "epic-ux",
            slug: "epic-ux",
            number: 1,
            title: "UX Polish",
            smartProgressPct: 0,
            declaredProgressPct: 0,
            stories: []
          }
        ],
        artifacts: []
      });

      const phasesHtml = env.elements.get("phasesList").innerHTML;
      assert.match(phasesHtml, /class="phase-card"[^>]*data-overlay-trigger="phase:2-planning"/);
      assert.doesNotMatch(phasesHtml, /phase-summary-row/);
      assert.match(phasesHtml, /<button[^>]*class="art-chip-main"/);
      assert.match(phasesHtml, /<button[^>]*class="art-chip-open"/);

      const epicsHtml = env.elements.get("epicsList").innerHTML;
      assert.match(epicsHtml, /<button[^>]*class="epic-toggle-btn"[^>]*aria-expanded="true"/);

      const artsHtml = env.elements.get("artifactsDirectoryList").innerHTML;
      assert.match(artsHtml, /class="empty-state-card"/);

      // Closing artifact preview hides card
      const previewCard = env.elements.get("artifactPreviewCard");
      previewCard.style.display = "block";
      env.elements.get("btnCloseArtifactPreview").dispatchEvent({ type: "click" });
      assert.equal(previewCard.style.display, "none");
    });

    it("refines progressbar ARIA, paused queue controls, honest Queue Epic states, and filter-clear buttons", () => {
      assert.match(
        PANEL_HTML,
        /<div[^>]*id="progressBarTrack"[^>]*role="progressbar"[^>]*aria-labelledby="progressHeadline"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"/,
        "Global progress bar track must declare role='progressbar' and ARIA bounds"
      );
      assert.match(
        styleText,
        /\.art-chip-group\s*\{[\s\S]*?max-width:\s*100%/,
        ".art-chip-group must bound max-width: 100% for narrow docks"
      );
      assert.match(
        styleText,
        /\.phase-top\s*\{[\s\S]*?flex-wrap:\s*wrap/,
        ".phase-top must wrap cleanly inside narrow docks"
      );

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      env.elements.get("storyStatusFilter").value = "all";

      hooks.renderWorkspaceState({
        projectName: "Ergonomics Test",
        metrics: { totalEpics: 1, totalStories: 2, smartDoneStories: 1, smartOverallPct: 50, declaredOverallPct: 50 },
        taskQueue: {
          status: "paused",
          executionMode: "separate-sessions",
          defaultReviewMode: "none",
          counts: { total: 1, running: 0, queued: 1, done: 0, failed: 0, progressPct: 0 },
          items: [{ id: "t1", title: "Task 1", status: "queued", model: "p/m", modelShort: "m", reviewMode: "none", effectivePrompt: "/bmad-build \"x\"" }]
        },
        epics: [
          {
            id: "epic-done",
            slug: "epic-done",
            number: 1,
            title: "Completed Epic",
            smartProgressPct: 100,
            declaredProgressPct: 100,
            stories: [{ id: "1.1", title: "Done Story", smartStatus: "done", declaredStatus: "done", overrideKey: "epic-done#1" }]
          }
        ],
        artifacts: [
          { relPath: "_bmad-output/prd.md", name: "prd.md", kind: "prd", phaseId: "2-planning", phaseName: "Planning", gitStatus: "committed", mtimeMs: Date.now() }
        ]
      });

      assert.equal(env.elements.get("progressBarTrack").getAttribute("aria-valuenow"), "50");
      assert.match(env.elements.get("queueStatusBadge").className || env.elements.get("queueStatusBadge").getAttribute("class"), /pill-warning/);
      assert.equal(env.elements.get("btnPauseQueue").disabled, true);
      assert.equal(env.elements.get("btnPauseQueue").textContent, "⏸ Paused");

      // Completed epic must show disabled ✓ All Done instead of Queue Epic (1)
      const epicsHtml = env.elements.get("epicsList").innerHTML;
      assert.match(epicsHtml, /disabled[^>]*>[\s\S]*?✓ All Done/);

      // Story filter miss includes #btnClearStoryFilters
      env.elements.get("storySearch").value = "no-such-story-xyz";
      hooks.renderEpics(true);
      assert.match(env.elements.get("epicsList").innerHTML, /id="btnClearStoryFilters"/);

      // Artifact filter miss includes #btnClearArtifactSearch
      env.elements.get("artifactSearch").value = "missing-artifact-xyz";
      hooks.renderArtifactsDirectory(true);
      assert.match(env.elements.get("artifactsDirectoryList").innerHTML, /id="btnClearArtifactSearch"/);
    });
  });

  describe("Story 8.1: Palette C warm charcoal tokens, radii & closed larger type ramp", () => {
    const styleText = extractStyleContent(PANEL_HTML);

    it("ships the Palette C token blocks with --on-primary and reserved overlay type roles", () => {
      const rootScope = /:root\s*\{[\s\S]*?\}/;
      const lightScope = /body\.theme-light\s*\{[\s\S]*?\}/;

      // Palette C dark values (DESIGN.md colors frontmatter, verbatim).
      assert.equal(extractCssVar(styleText, rootScope, "--bg-primary"), "#1b1b1e");
      assert.equal(extractCssVar(styleText, rootScope, "--accent"), "#74a9c9");
      assert.equal(extractCssVar(styleText, rootScope, "--on-primary"), "#ffffff");

      // Palette C light values (no light --on-primary override: white passes both gradient sets).
      assert.equal(extractCssVar(styleText, lightScope, "--bg-primary"), "#fbf9f6");
      assert.equal(extractCssVar(styleText, lightScope, "--accent"), "#28627c");
      const lightBlock = styleText.match(lightScope);
      assert.ok(lightBlock, "body.theme-light scope must exist");
      assert.ok(
        !lightBlock[0].includes("--on-primary"),
        "body.theme-light must not override --on-primary (white passes both gradient sets)"
      );

      // Soft fills ride the spine alphas as 8-digit hex (dark 8%, light accent 10% / rest 8%).
      assert.equal(extractCssVar(styleText, rootScope, "--accent-soft"), "#74a9c914");
      assert.equal(extractCssVar(styleText, lightScope, "--accent-soft"), "#28627c1a");

      // RD-1/RD-6/RD-7: the four reserved overlay roles complete the closed ramp (consumed by Story 3+).
      assert.match(styleText, /--overlay-title-size:\s*16px/);
      assert.match(styleText, /--overlay-body-size:\s*15px/);
      assert.match(styleText, /--overlay-command-size:\s*14\.5px/);
      assert.match(styleText, /--overlay-meta-size:\s*13\.5px/);
    });

    it("routes the brand badge, primary button and chip-open hover labels through var(--on-primary)", () => {
      assert.match(
        styleText,
        /\.brand-badge\s*\{[^}]*?color:\s*var\(--on-primary\)/,
        ".brand-badge must use var(--on-primary) instead of a literal white"
      );
      assert.match(
        styleText,
        /\.btn-primary\s*\{[^}]*?color:\s*var\(--on-primary\)/,
        ".btn-primary must use var(--on-primary) instead of a literal white"
      );
      assert.match(
        styleText,
        /\.art-chip-open:hover\s*\{[^}]*?color:\s*var\(--on-primary\)/,
        ".art-chip-open:hover must use var(--on-primary) instead of a literal white"
      );
    });

    it("rounds the .cmd-textarea focus outline at 4px (RD-2 rounded.sm)", () => {
      assert.match(
        styleText,
        /\.cmd-textarea:focus,\s*\n\s*\.cmd-textarea:focus-visible\s*\{[\s\S]*?border-radius:\s*4px/,
        ".cmd-textarea focus outline must use the 4px rounded.sm radius (was 3px)"
      );
    });

    it("keeps every CSS font-size inside the closed ramp {16, 15, 14.5, 14, 13.5, 13, 12.5, 12}px with nothing below 12px (RD-1/RD-6)", () => {
      const allowed = new Set([16, 15, 14.5, 14, 13.5, 13, 12.5, 12]);
      const seen = new Map();
      for (const match of styleText.matchAll(/font-size\s*:\s*([\d.]+)px/g)) {
        const value = Number.parseFloat(match[1]);
        seen.set(value, (seen.get(value) || 0) + 1);
        assert.ok(
          allowed.has(value),
          `font-size ${value}px is outside the closed ramp (allowed: 16, 15, 14.5, 14, 13.5, 13, 12.5, 12)`
        );
        assert.ok(value >= 12, `font-size ${value}px is below the 12px panel floor (RD-6)`);
      }
      assert.ok(seen.size > 0, "style block must declare ramp font sizes");
    });

    it("contains zero inline font-size styles and no JS-assigned fontSize (RD-1)", () => {
      assert.doesNotMatch(
        PANEL_HTML,
        /style="[^"]*font-size/i,
        "no style attribute may set font-size; sizes ride the closed ramp through classes"
      );
      assert.doesNotMatch(
        extractInlineScript(PANEL_HTML),
        /\.style\.fontSize\s*=/,
        "no inline script may assign .style.fontSize"
      );
    });
  });

  describe("Story 8.4: Work tab current-focus hero, Action Window & RD-8 counted disclosures", () => {
    const styleText = extractStyleContent(PANEL_HTML);

    it("declares the Work current-focus hero, plain '🚀 What to do next' heading, and RD-5 focal-card styling", () => {
      assert.match(
        PANEL_HTML,
        /<div[^>]*class="[^"]*focus-hero[^"]*"[^>]*id="currentFocusHero"/,
        "Work tab must render #currentFocusHero at the top"
      );
      assert.match(
        PANEL_HTML,
        /<div[^>]*class="[^"]*focus-hero-text[^"]*"[^>]*id="currentFocusText"/,
        "Work hero must declare #currentFocusText"
      );
      assert.match(
        PANEL_HTML,
        /<div[^>]*class="[^"]*focus-hero-basis[^"]*"[^>]*id="currentFocusBasis"[^>]*>Current focus<\/div>/,
        "Work hero must declare #currentFocusBasis with owner-preferred 'Current focus' label"
      );
      assert.match(
        PANEL_HTML,
        /<div[^>]*id="workTabHeading"[^>]*>🚀 What to do next<\/div>/,
        "Work tab heading must read '🚀 What to do next' (RD-3)"
      );
      assert.match(
        styleText,
        /\.focus-hero-text\s*\{[\s\S]*?font-size:\s*var\(--overlay-body-size\)/,
        ".focus-hero-text must use var(--overlay-body-size) (15px)"
      );
      assert.match(
        styleText,
        /\.rec-card\.is-focal\s*\{[\s\S]*?border-color:\s*var\(--accent\)/,
        "RD-5 focal point rule: .rec-card.is-focal must highlight the first next action card with var(--accent)"
      );
    });

    it("renders collapsed-by-default RD-8 disclosures (AI notes (N), Models and providers (N), More actions (3)) as native buttons with aria-expanded and live counts", () => {
      assert.match(
        PANEL_HTML,
        /<button[^>]*id="btnDisclosureAiNotes"[^>]*data-disclosure="ai-notes"[^>]*aria-expanded="false"[^>]*aria-controls="disclosureBodyAiNotes"/,
        "AI notes disclosure must be a native button with aria-expanded='false' by default"
      );
      assert.match(
        PANEL_HTML,
        /<button[^>]*id="btnDisclosureModelsProviders"[^>]*data-disclosure="models-providers"[^>]*aria-expanded="false"[^>]*aria-controls="disclosureBodyModelsProviders"/,
        "Models and providers disclosure must be a native button with aria-expanded='false' by default"
      );

      const env = createStubbedA11yEnvironment();
      env.elements.get("storyStatusFilter").value = "all";
      const hooks = env.getTestHooks();

      hooks.renderWorkspaceState({
        projectName: "Work Disclosure Test",
        metrics: { totalEpics: 1, totalStories: 4, smartDoneStories: 2, smartOverallPct: 50, declaredOverallPct: 50 },
        turnAnalysis: {
          aiSummaryHeadline: "Legacy /bmad-build headline with sprint-status.yaml jargon",
          currentFocus: {
            text: "You updated the palette tokens and verified contrast in both themes. Next up is simplifying the Work tab actions.",
            basisLabel: "Current focus",
            conversationCount: 3,
            source: "deterministic"
          }
        },
        providerState: {
          activeProviders: [
            { providerName: "Provider One", modelCount: 4, kind: "api" },
            { providerName: "Provider Two", modelCount: 2, kind: "sub" }
          ]
        },
        smartInsights: [
          { title: "Insight 1", detail: "Detail 1", severity: "info" },
          { title: "Insight 2", detail: "Detail 2", severity: "success" },
          { title: "Insight 3", detail: "Detail 3", severity: "warning" }
        ],
        recommendations: [
          {
            title: "Build Story 8.4 (/bmad-build)",
            plainTitle: "Finish the Work tab focus hero and action window",
            rationale: "Update tickets.toml in 4-implementation",
            plainSummary: "Render the focus summary and let each next step open in a clean action window.",
            skill: "/bmad-build",
            phase: "4-implementation",
            priority: "high",
            fullCommand: '/bmad-build "Complete Story 8.4"',
            recommendedModel: { modelId: "prov/model-a", tier: "💻 Agentic Coding", reason: "Best fit" }
          },
          {
            title: "Review UX (/bmad-ux)",
            plainTitle: "Check visual consistency across views",
            rationale: "Check 2-planning docs",
            plainSummary: "Confirm colors and spacing stay calm across all tabs.",
            skill: "/bmad-ux",
            phase: "2-planning",
            priority: "medium",
            fullCommand: '/bmad-ux "Review UX"',
            recommendedModel: { modelId: "prov/model-b", tier: "🎨 UX", reason: "UX fit" }
          }
        ]
      });

      // 1. Current-focus hero renders currentFocus.text + 'Current focus' label, never aiSummaryHeadline
      assert.equal(
        env.elements.get("currentFocusText").textContent,
        "You updated the palette tokens and verified contrast in both themes. Next up is simplifying the Work tab actions."
      );
      assert.equal(env.elements.get("currentFocusBasis").textContent, "Current focus");
      assert.equal(env.elements.get("currentFocusHero").getAttribute("data-conversation-count"), "3");

      // 2. All 3 disclosures start collapsed (aria-expanded='false') with live counts
      const aiNotesBtn = env.elements.get("btnDisclosureAiNotes");
      const aiNotesBody = env.elements.get("disclosureBodyAiNotes");
      const modelsBtn = env.elements.get("btnDisclosureModelsProviders");
      const modelsBody = env.elements.get("disclosureBodyModelsProviders");
      const moreBtn = env.elements.get("rec-more-actions-0");
      const moreBody = env.elements.get("rec-more-body-0");

      assert.equal(aiNotesBtn.getAttribute("aria-expanded"), "false");
      assert.match(aiNotesBtn.textContent, /AI notes \(3\)$/);
      assert.equal(aiNotesBody.style.display, "none");

      assert.equal(modelsBtn.getAttribute("aria-expanded"), "false");
      assert.match(modelsBtn.textContent, /Models and providers \(2\)$/);
      assert.equal(modelsBody.style.display, "none");

      assert.equal(moreBtn.getAttribute("aria-expanded"), "false");
      assert.match(moreBtn.textContent, /More actions \(3\)/);
      assert.equal(moreBody.style.display, "none");

      // 3. Toggle each disclosure -> aria-expanded='true', body visible, persisted in expandedDisclosures
      aiNotesBtn.dispatchEvent({ type: "click" });
      assert.equal(aiNotesBtn.getAttribute("aria-expanded"), "true");
      assert.equal(aiNotesBody.style.display, "block");
      assert.equal(hooks.getExpandedDisclosures().has("ai-notes"), true);

      modelsBtn.dispatchEvent({ type: "click" });
      assert.equal(modelsBtn.getAttribute("aria-expanded"), "true");
      assert.equal(modelsBody.style.display, "block");
      assert.equal(hooks.getExpandedDisclosures().has("models-providers"), true);

      moreBtn.dispatchEvent({ type: "click" });
      assert.equal(env.elements.get("rec-more-actions-0").getAttribute("aria-expanded"), "true");
      assert.equal(hooks.getExpandedDisclosures().has("more-actions"), true);
    });

    it("preserves focus on More actions button when toggled, restores focus to search inputs on filter clear, and keeps disabled/overlay-select contrast rules", () => {
      assert.match(
        styleText,
        /\.btn:disabled\s*\{[\s\S]*?cursor:\s*not-allowed/,
        "Disabled buttons must style cursor: not-allowed"
      );
      assert.match(
        styleText,
        /\.overlay-card\s+\.model-select\s*\{[\s\S]*?color:\s*var\(--text-primary\)/,
        "Overlay model selects must keep crisp --text-primary ink"
      );

      const env = createStubbedA11yEnvironment();
      env.elements.get("storyStatusFilter").value = "all";
      const hooks = env.getTestHooks();

      hooks.renderWorkspaceState({
        projectName: "Ergonomics Test",
        metrics: { totalEpics: 1, totalStories: 1, smartDoneStories: 0, smartOverallPct: 0, declaredOverallPct: 0 },
        epics: [{ id: "1", number: 1, slug: "epic-one", title: "Epic One", stories: [{ id: "1.1", title: "Alpha", smartStatus: "backlog" }] }],
        artifacts: [{ relPath: "docs/readme.md", name: "readme.md", kind: "doc", phaseName: "Planning", gitStatus: "committed", mtimeMs: 1000 }],
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
      });

      const moreBtn = env.elements.get("rec-more-actions-0");
      moreBtn.focus();
      moreBtn.dispatchEvent({ type: "click" });
      assert.equal(
        env.getActiveElement()?.id,
        "rec-more-actions-0",
        "Toggling More actions (3) on a Work card must preserve focus on #rec-more-actions-0"
      );

      env.elements.get("storySearch").value = "missing-story-xyz";
      hooks.renderEpics(true);
      env.elements.get("btnClearStoryFilters").dispatchEvent({ type: "click" });
      assert.equal(
        env.getActiveElement()?.id,
        "storySearch",
        "Clearing story filters must restore focus to #storySearch"
      );

      env.elements.get("artifactSearch").value = "missing-artifact-xyz";
      hooks.renderArtifactsDirectory(true);
      env.elements.get("btnClearArtifactSearch").dispatchEvent({ type: "click" });
      assert.equal(
        env.getActiveElement()?.id,
        "artifactSearch",
        "Clearing artifact search must restore focus to #artifactSearch"
      );
    });
  });

  describe("Story 8.2: 3-tab Work / Queue / Project shell, plain headings & Project consolidation", () => {
    const styleText = extractStyleContent(PANEL_HTML);

    it("RD-3: uses plain task headings across Work, Queue, and Project and updated empty-queue copy", () => {
      assert.match(PANEL_HTML, /<div[^>]*id="workTabHeading"[^>]*>🚀 What to do next<\/div>/);
      assert.match(PANEL_HTML, /<div[^>]*id="queueTabHeading"[^>]*>⛓️ Queued tasks<\/div>/);
      assert.match(PANEL_HTML, /<div[^>]*id="projectTabHeading"[^>]*>📈 Line up your tickets with the code<\/div>/);
      assert.match(PANEL_HTML, /<div[^>]*class="section-title"[^>]*>🏛️ Phases<\/div>/);
      assert.match(PANEL_HTML, /<div[^>]*class="section-title"[^>]*>📦 Epics and tickets<\/div>/);
      assert.match(PANEL_HTML, /<div[^>]*class="section-title"[^>]*>🕒 Recently changed files<\/div>/);

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      hooks.renderWorkspaceState({
        projectName: "Empty Queue Copy Test",
        metrics: { totalEpics: 0, totalStories: 0, smartDoneStories: 0, smartOverallPct: 0, declaredOverallPct: 0 },
        taskQueue: {
          status: "idle",
          executionMode: "dynamic-workflow",
          defaultReviewMode: "none",
          counts: { total: 0, running: 0, queued: 0, done: 0, failed: 0, progressPct: 0 },
          items: []
        }
      });
      const emptyQueueHtml = env.elements.get("queueItemsList").innerHTML;
      assert.match(emptyQueueHtml, /<b>⚡ Work<\/b> \/ <b>📊 Project<\/b>/);
      assert.doesNotMatch(emptyQueueHtml, /Next Prompts|Phases & Epics/);
    });

    it("RD-4: provides verbatim 'Use it when…' copy on tab title, aria-describedby, and visible .tab-purpose subtitles", () => {
      const expected = [
        {
          btnId: "tabBtnWork",
          descId: "tabDescWork",
          text: "You want to know what to do next, in plain words, and start it."
        },
        {
          btnId: "tabBtnQueue",
          descId: "tabDescQueue",
          text: "You want to see or change what is lined up to run."
        },
        {
          btnId: "tabBtnProject",
          descId: "tabDescProject",
          text: "You want to see where the work stands and how it is structured."
        }
      ];

      assert.match(styleText, /\.tab-purpose\s*\{[\s\S]*?font-size:\s*12\.5px/);

      for (const item of expected) {
        assert.match(
          PANEL_HTML,
          new RegExp(`<button[^>]*id="${item.btnId}"[^>]*aria-describedby="${item.descId}"[^>]*title="${item.text}"`),
          `${item.btnId} must carry verbatim RD-4 title and aria-describedby`
        );
        assert.match(
          PANEL_HTML,
          new RegExp(`<div[^>]*class="tab-purpose"[^>]*id="${item.descId}"[^>]*>${item.text}<\\/div>`),
          `${item.descId} must render verbatim RD-4 subtitle under tab heading`
        );
      }
    });

    it("OQ-9: removes legacy 5-tab/catalog/agent markup and switchTab('artifacts') calls from panel.html", () => {
      const forbiddenTokens = [
        'switchTab("artifacts"',
        "switchTab('artifacts'",
        "tab-advisor",
        "tab-progress",
        "tab-catalog",
        "tab-artifacts",
        "tabBtnAdvisor",
        "tabBtnProgress",
        "tabBtnCatalog",
        "tabBtnArtifacts",
        "skillsCatalogList",
        "agentsCatalogList",
        "skillSearch",
        "skillPhaseFilter",
        "btnExpandAllPhases",
        "btnCollapseAllPhases",
        "agent-card",
        "phase-summary-row"
      ];
      for (const tok of forbiddenTokens) {
        assert.equal(PANEL_HTML.includes(tok), false, `panel.html must not contain legacy token ${tok}`);
      }
    });

    it("RD-9: consolidates flat phases, empty phase message, and Changed Files + inspector inside #tab-project", () => {
      const projectMatch = PANEL_HTML.match(/<section[^>]*id="tab-project"[\s\S]*?<\/section>/);
      assert.ok(projectMatch, "#tab-project section must exist");
      const projectSection = projectMatch[0];
      assert.match(projectSection, /id="phasesList"/);
      assert.match(projectSection, /id="epicsList"/);
      assert.match(projectSection, /id="artifactPreviewCard"/);
      assert.match(projectSection, /id="artifactsDirectoryList"/);

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      hooks.renderWorkspaceState({
        projectName: "Empty Phase Test",
        metrics: { totalEpics: 0, totalStories: 0, smartDoneStories: 0, smartOverallPct: 0, declaredOverallPct: 0 },
        phases: [
          {
            id: "1-analysis",
            name: "Phase 1 · Analysis",
            progressPct: 0,
            status: "pending",
            summary: "Product brief",
            artifacts: []
          }
        ]
      });
      assert.match(env.elements.get("phasesList").innerHTML, /No artifacts generated in this phase yet\./);
    });

    it("RD-5: toggles btn-primary on #btnReconcileTrackers only when trackers disagree and keeps inspector neutral", () => {
      assert.match(
        PANEL_HTML,
        /<div[^>]*id="artifactPreviewCard"[^>]*style="display:\s*none;"/,
        "#artifactPreviewCard must not carry inline accent border-color"
      );
      assert.match(
        PANEL_HTML,
        /<div[^>]*id="previewFileName"[^>]*color:\s*var\(--text-primary\)/,
        "#previewFileName must use neutral var(--text-primary)"
      );
      assert.match(
        PANEL_HTML,
        /<button[^>]*class="btn"[^>]*id="btnReconcileTrackers"/,
        "#btnReconcileTrackers must default to plain .btn in initial markup"
      );

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const recBtn = env.elements.get("btnReconcileTrackers");

      // Missing metrics default to synced (no btn-primary)
      hooks.renderWorkspaceState({ projectName: "Missing Metrics", metrics: {} });
      assert.equal(recBtn.classList.contains("btn-primary"), false);

      // Drift by reconciledStoriesCount > 0 -> btn-primary added
      hooks.renderWorkspaceState({
        projectName: "Drift Count",
        metrics: { reconciledStoriesCount: 2, smartOverallPct: 50, declaredOverallPct: 50, smartDoneStories: 2, declaredDoneStories: 2 }
      });
      assert.equal(recBtn.classList.contains("btn-primary"), true);

      // Synchronized again -> btn-primary removed
      hooks.renderWorkspaceState({
        projectName: "Synced",
        metrics: { reconciledStoriesCount: 0, smartOverallPct: 50, declaredOverallPct: 50, smartDoneStories: 2, declaredDoneStories: 2 }
      });
      assert.equal(recBtn.classList.contains("btn-primary"), false);

      // Drift by smartOverallPct !== declaredOverallPct -> btn-primary added
      hooks.renderWorkspaceState({
        projectName: "Drift Pct",
        metrics: { reconciledStoriesCount: 0, smartOverallPct: 75, declaredOverallPct: 50, smartDoneStories: 2, declaredDoneStories: 2 }
      });
      assert.equal(recBtn.classList.contains("btn-primary"), true);

      // Drift by smartDoneStories !== declaredDoneStories -> btn-primary added
      hooks.renderWorkspaceState({
        projectName: "Drift Done",
        metrics: { reconciledStoriesCount: 0, smartOverallPct: 50, declaredOverallPct: 50, smartDoneStories: 3, declaredDoneStories: 2 }
      });
      assert.equal(recBtn.classList.contains("btn-primary"), true);
    });

    it("UX Audit: enforces narrow-dock grid wrapping, RD-5 Queue/Project single focal accent, and inline dismiss focus restoration", () => {
      assert.match(
        styleText,
        /\.queue-controls-grid\s*\{[\s\S]*?minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/,
        ".queue-controls-grid must use minmax(0, 1fr) columns to avoid narrow-dock horizontal overflow"
      );
      assert.match(
        styleText,
        /\.queue-item-controls-grid\s*\{[\s\S]*?minmax\(0,\s*1\.4fr\)\s+minmax\(0,\s*1fr\)/,
        ".queue-item-controls-grid must use minmax(0, ...) columns"
      );
      assert.match(
        styleText,
        /\.queue-controls-grid\s+\.model-select,\s*\n\s*\.queue-item-controls-grid\s+\.model-select\s*\{[\s\S]*?min-width:\s*0/,
        "Grid-child .model-select must override min-width: 0"
      );
      for (const cls of [".overlay-body-text", ".overlay-meta-text", ".artifact-preview", ".reconciliation-diff-content", ".story-title"]) {
        const re = new RegExp(`\\${cls}\\s*\\{[^}]*?overflow-wrap:\\s*anywhere`);
        assert.match(styleText, re, `${cls} must wrap long unbroken tokens via overflow-wrap: anywhere`);
      }

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const runBtn = env.elements.get("btnRunQueueWorkflow");
      const retryBtn = env.elements.get("btnRetryFailedQueue");

      // 1. Empty queue -> neither Run nor Retry carries btn-primary
      hooks.renderWorkspaceState({
        projectName: "Queue Focal",
        metrics: { totalEpics: 1, totalStories: 1, smartDoneStories: 1, smartOverallPct: 100, declaredOverallPct: 100 },
        epics: [
          {
            id: "1",
            number: 1,
            slug: "e1",
            title: "Done Epic",
            smartProgressPct: 100,
            declaredProgressPct: 100,
            stories: [{ id: "1.1", title: "Done Story", smartStatus: "done", overrideKey: "e1#1" }]
          }
        ],
        taskQueue: {
          status: "idle",
          executionMode: "separate-sessions",
          counts: { total: 0, running: 0, queued: 0, done: 0, failed: 0, progressPct: 0 },
          items: []
        }
      });
      assert.equal(runBtn.classList.contains("btn-primary"), false);
      assert.equal(retryBtn.classList.contains("btn-primary"), false);
      // Per-story New Session button uses neutral .btn so Project keeps #btnReconcileTrackers as sole focal accent
      assert.doesNotMatch(env.elements.get("epicsList").innerHTML, /class="btn btn-primary"[^>]*data-story-prompt/);

      // 2. Queued items waiting -> #btnRunQueueWorkflow carries btn-primary; per-row buttons do not
      hooks.renderWorkspaceState({
        projectName: "Queue Focal Queued",
        metrics: { totalEpics: 0, totalStories: 0, smartDoneStories: 0, smartOverallPct: 0, declaredOverallPct: 0 },
        taskQueue: {
          status: "idle",
          executionMode: "separate-sessions",
          counts: { total: 1, running: 0, queued: 1, done: 0, failed: 0, progressPct: 0 },
          items: [{ id: "t1", title: "Queued", status: "queued", model: "p/m", reviewMode: "none", effectivePrompt: '/bmad-build "x"' }]
        }
      });
      assert.equal(runBtn.classList.contains("btn-primary"), true);
      assert.equal(retryBtn.classList.contains("btn-primary"), false);
      assert.doesNotMatch(env.elements.get("queueItemsList").innerHTML, /btn-primary/);

      // 3. Active task running -> spotlight carries focus, Run button drops btn-primary
      hooks.renderWorkspaceState({
        projectName: "Queue Focal Running",
        metrics: { totalEpics: 0, totalStories: 0, smartDoneStories: 0, smartOverallPct: 0, declaredOverallPct: 0 },
        taskQueue: {
          status: "running",
          executionMode: "separate-sessions",
          activeTask: { id: "t1", title: "Running", status: "running", model: "p/m", reviewMode: "none", effectivePrompt: '/bmad-build "x"' },
          counts: { total: 2, running: 1, queued: 1, done: 0, failed: 0, progressPct: 0 },
          items: [{ id: "t1", title: "Running", status: "running", model: "p/m", reviewMode: "none", effectivePrompt: '/bmad-build "x"' }]
        }
      });
      assert.equal(runBtn.classList.contains("btn-primary"), false);

      // 4. Failed only -> #btnRetryFailedQueue carries btn-primary
      hooks.renderWorkspaceState({
        projectName: "Queue Focal Failed",
        metrics: { totalEpics: 0, totalStories: 0, smartDoneStories: 0, smartOverallPct: 0, declaredOverallPct: 0 },
        taskQueue: {
          status: "completed",
          executionMode: "separate-sessions",
          counts: { total: 1, running: 0, queued: 0, done: 0, failed: 1, progressPct: 0 },
          items: [{ id: "t1", title: "Failed", status: "failed", model: "p/m", reviewMode: "none", effectivePrompt: '/bmad-build "x"' }]
        }
      });
      assert.equal(runBtn.classList.contains("btn-primary"), false);
      assert.equal(retryBtn.classList.contains("btn-primary"), true);

      // 5. Closing inline reconciliation diff & artifact preview restores focus cleanly
      env.elements.get("reconciliationDiffCard").style.display = "block";
      env.elements.get("btnCloseDiff").dispatchEvent({ type: "click" });
      assert.equal(env.getActiveElement()?.id, "btnPreviewReconcile");

      env.elements.get("artifactPreviewCard").style.display = "block";
      env.elements.get("btnCloseArtifactPreview").dispatchEvent({ type: "click" });
      assert.equal(env.getActiveElement()?.id, "artifactSearch");
    });
  });

  describe("Story 8.6: Finalized AD-16 3-tab ARIA, dialog/disclosure attributes, interactive-descendant guard & complete Palette C WCAG contrast suite", () => {
    const styleText = extractStyleContent(PANEL_HTML);

    it("enforces exact 3-tab / 3-tabpanel cardinality, bidirectional ARIA linkage, rendered switchTab('project'/'work'), and keyboard focus transfer", () => {
      const tabMatches = [...PANEL_HTML.matchAll(/<button\b([^>]*\brole="tab"[^>]*)>/gi)];
      const panelMatches = [...PANEL_HTML.matchAll(/<section\b([^>]*\brole="tabpanel"[^>]*)>/gi)];

      assert.equal(tabMatches.length, 3, "Panel must expose exactly 3 role='tab' buttons");
      assert.equal(panelMatches.length, 3, "Panel must expose exactly 3 role='tabpanel' sections");

      const parsedTabs = tabMatches.map((m) => {
        const attrs = m[1];
        return {
          id: attrs.match(/\bid="([^"]+)"/i)?.[1],
          controls: attrs.match(/\baria-controls="([^"]+)"/i)?.[1],
          describedby: attrs.match(/\baria-describedby="([^"]+)"/i)?.[1],
          dataTab: attrs.match(/\bdata-tab="([^"]+)"/i)?.[1]
        };
      });
      const parsedPanels = panelMatches.map((m) => {
        const attrs = m[1];
        return {
          id: attrs.match(/\bid="([^"]+)"/i)?.[1],
          labelledby: attrs.match(/\baria-labelledby="([^"]+)"/i)?.[1]
        };
      });

      assert.deepEqual(
        parsedTabs.map((t) => t.dataTab),
        ["work", "queue", "project"]
      );

      for (const tab of parsedTabs) {
        assert.ok(tab.id && tab.controls && tab.describedby, `Tab ${tab.id} must have id, aria-controls, aria-describedby`);
        const matchedPanel = parsedPanels.find((p) => p.id === tab.controls);
        assert.ok(matchedPanel, `Tab ${tab.id} aria-controls="${tab.controls}" must match a tabpanel`);
        assert.equal(
          matchedPanel.labelledby,
          tab.id,
          `Tabpanel ${matchedPanel.id} aria-labelledby must point back to ${tab.id}`
        );
        assert.match(
          PANEL_HTML,
          new RegExp(`<div[^>]*class="tab-purpose"[^>]*id="${tab.describedby}"`, "i"),
          `aria-describedby="${tab.describedby}" must reference a .tab-purpose subtitle`
        );
      }

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const workBtn = env.elements.get("tabBtnWork");
      const queueBtn = env.elements.get("tabBtnQueue");
      const projectBtn = env.elements.get("tabBtnProject");
      const workPanel = env.elements.get("tab-work");
      const queuePanel = env.elements.get("tab-queue");
      const projectPanel = env.elements.get("tab-project");

      // Switch to project and verify ARIA + display
      hooks.switchTab("project");
      assert.equal(workBtn.getAttribute("aria-selected"), "false");
      assert.equal(workBtn.getAttribute("tabindex"), "-1");
      assert.equal(queueBtn.getAttribute("aria-selected"), "false");
      assert.equal(queueBtn.getAttribute("tabindex"), "-1");
      assert.equal(projectBtn.getAttribute("aria-selected"), "true");
      assert.equal(projectBtn.getAttribute("tabindex"), "0");
      assert.equal(workPanel.style.display, "none");
      assert.equal(queuePanel.style.display, "none");
      assert.equal(projectPanel.style.display, "block");

      // Switch back to work and verify ARIA + display
      hooks.switchTab("work");
      assert.equal(workBtn.getAttribute("aria-selected"), "true");
      assert.equal(workBtn.getAttribute("tabindex"), "0");
      assert.equal(projectBtn.getAttribute("aria-selected"), "false");
      assert.equal(projectBtn.getAttribute("tabindex"), "-1");
      assert.equal(workPanel.style.display, "block");
      assert.equal(projectPanel.style.display, "none");

      // Keyboard navigation transfers actual focus (document.activeElement) across all 3 tabs
      workBtn.focus();
      assert.equal(env.getActiveElement(), workBtn);

      hooks.handleTabKeydown({ key: "ArrowRight", currentTarget: workBtn, preventDefault: () => {} });
      assert.equal(env.getActiveElement(), queueBtn, "ArrowRight must move DOM focus to #tabBtnQueue");

      hooks.handleTabKeydown({ key: "ArrowRight", currentTarget: queueBtn, preventDefault: () => {} });
      assert.equal(env.getActiveElement(), projectBtn, "ArrowRight must move DOM focus to #tabBtnProject");

      hooks.handleTabKeydown({ key: "Home", currentTarget: projectBtn, preventDefault: () => {} });
      assert.equal(env.getActiveElement(), workBtn, "Home must move DOM focus to #tabBtnWork");

      hooks.handleTabKeydown({ key: "End", currentTarget: workBtn, preventDefault: () => {} });
      assert.equal(env.getActiveElement(), projectBtn, "End must move DOM focus to #tabBtnProject");
    });

    it("verifies static + rendered #overlayLayer dialog ARIA, overlay <label for> associations, ⤢ aria-labels, and RD-8 disclosure collapse round-trips with neutral .btn weight", () => {
      // Static dialog + close button + expand aria-label checks
      assert.match(
        PANEL_HTML,
        /<div[^>]*id="overlayLayer"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="overlayTitle"[^>]*aria-hidden="true"[^>]*style="display:\s*none;"/i
      );
      assert.match(PANEL_HTML, /<div[^>]*id="overlayTitle"[^>]*>Focus View<\/div>/);
      assert.match(PANEL_HTML, /<button[^>]*id="overlayCloseBtn"[^>]*aria-label="Close overlay"/);
      assert.match(PANEL_HTML, /<button[^>]*id="btnExpandInsights"[^>]*aria-label="Expand AI notes in Focus View"/);
      assert.match(PANEL_HTML, /<button[^>]*id="btnExpandReconciliationDiff"[^>]*aria-label="Expand reconciliation diff in Focus View"/);
      assert.match(PANEL_HTML, /<button[^>]*id="btnExpandArtifactPreview"[^>]*aria-label="Expand artifact preview in Focus View"/);

      // Static overlay label associations for Queue and Story Focus Views
      for (const id of ["overlay-q-model", "overlay-q-review", "overlay-q-prompt", "overlay-story-cmd", "overlay-story-model"]) {
        assert.match(
          PANEL_HTML,
          new RegExp(`<label[^>]*for="${id}"[^>]*>[\\s\\S]*?<\\/label>[\\s\\S]*?id="${id}"`, "i"),
          `Overlay control #${id} must have an associated <label for="${id}">`
        );
      }

      // RD-8: disclosure buttons never escalate visual weight on aria-expanded="true"
      assert.doesNotMatch(
        styleText,
        /\.disclosure-btn\[aria-expanded="true"\][^}]*?(?:btn-primary|background:\s*var\(--accent\)|font-weight:\s*700)/i,
        "RD-8 disclosure buttons must keep constant default .btn visual weight when expanded"
      );

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      env.elements.get("storyStatusFilter").value = "all";

      hooks.renderWorkspaceState({
        projectName: "Dialog & Disclosure A11y",
        metrics: { totalEpics: 1, totalStories: 1, smartDoneStories: 0, smartOverallPct: 0, declaredOverallPct: 0 },
        availableModels: [{ id: "prov/model-a", modelId: "model-a", providerName: "Prov", current: true }],
        smartInsights: [{ title: "Insight 1", detail: "Detail 1", severity: "info" }],
        providerState: { activeProviders: [{ providerName: "Prov", modelCount: 1, kind: "api" }] },
        phases: [
          {
            id: "4-implementation",
            name: "Phase 4 · Implementation",
            progressPct: 50,
            status: "in-progress",
            artifacts: [{ relPath: "docs/spec.md", name: "spec.md", mtimeMs: 1000 }]
          }
        ],
        epics: [
          {
            id: "epic-8",
            slug: "epic-8",
            number: 8,
            title: "Panel Redesign",
            smartProgressPct: 50,
            declaredProgressPct: 50,
            stories: [
              {
                id: "8.6",
                title: "Test Suite",
                smartStatus: "in-progress",
                overrideKey: "epic-8#6",
                recommendedModel: { modelId: "prov/model-a" }
              }
            ]
          }
        ],
        artifacts: [{ relPath: "docs/spec.md", name: "spec.md", kind: "spec", phaseName: "Implementation", mtimeMs: 1000 }],
        recommendations: [
          {
            title: "Task 1",
            plainTitle: "First task",
            plainSummary: "Summary",
            skill: "/bmad-build",
            phase: "4-implementation",
            fullCommand: '/bmad-build "Task 1"',
            recommendedModel: { modelId: "prov/model-a" }
          }
        ],
        taskQueue: {
          status: "running",
          executionMode: "separate-sessions",
          defaultReviewMode: "none",
          activeTask: {
            id: "q-act",
            title: "Active Task",
            status: "running",
            model: "prov/model-a",
            reviewMode: "none",
            effectivePrompt: '/bmad-build "Active"'
          },
          counts: { total: 2, running: 1, queued: 1, done: 0, failed: 0, progressPct: 0 },
          items: [
            {
              id: "q-act",
              title: "Active Task",
              status: "running",
              model: "prov/model-a",
              reviewMode: "none",
              effectivePrompt: '/bmad-build "Active"'
            },
            {
              id: "q-queued",
              title: "Queued Task",
              status: "queued",
              model: "prov/model-a",
              reviewMode: "none",
              effectivePrompt: '/bmad-build "Queued"'
            }
          ]
        }
      });

      // Rendered ⤢ expand buttons all carry descriptive Focus View aria-labels
      const renderedExpandBtns = env.sandbox.document.querySelectorAll(".focus-expand-btn");
      assert.ok(renderedExpandBtns.length >= 8, "All rendered Focus View targets must include .focus-expand-btn");
      for (const btn of renderedExpandBtns) {
        const label = btn.getAttribute("aria-label") || "";
        assert.match(label, /Focus View/i, `Expand button ${btn.id || btn.getAttribute("data-focus-expand")} must describe Focus View in aria-label`);
      }

      // Rendered #overlayLayer dialog aria-hidden lifecycle & Queue Focus View <label for> associations
      const overlayLayer = env.elements.get("overlayLayer");
      const overlayBody = env.elements.get("overlayBody");
      assert.equal(overlayLayer.getAttribute("aria-hidden"), "true");

      hooks.openOverlay({ kind: "focus", targetType: "queue-item", targetKey: "q-queued" });
      assert.equal(overlayLayer.getAttribute("aria-hidden"), "false");
      for (const qControlId of ["overlay-q-model", "overlay-q-review", "overlay-q-prompt"]) {
        assert.ok(overlayBody.querySelector(`label[for="${qControlId}"]`), `Rendered Queue overlay must contain <label for="${qControlId}">`);
        assert.ok(overlayBody.querySelector(`#${qControlId}`), `Rendered Queue overlay must contain #${qControlId}`);
      }
      hooks.closeOverlay();
      assert.equal(overlayLayer.getAttribute("aria-hidden"), "true");

      // Rendered Story Focus View <label for> associations
      hooks.openOverlay({ kind: "focus", targetType: "story", targetKey: "epic-8#6" });
      assert.equal(overlayLayer.getAttribute("aria-hidden"), "false");
      for (const sControlId of ["overlay-story-cmd", "overlay-story-model"]) {
        assert.ok(overlayBody.querySelector(`label[for="${sControlId}"]`), `Rendered Story overlay must contain <label for="${sControlId}">`);
        assert.ok(overlayBody.querySelector(`#${sControlId}`), `Rendered Story overlay must contain #${sControlId}`);
      }
      hooks.closeOverlay();
      assert.equal(overlayLayer.getAttribute("aria-hidden"), "true");

      // RD-8 disclosure collapse round-trip (false -> true -> false) + aria-controls + neutral .btn weight
      const disclosureSpecs = [
        { btnId: "btnDisclosureAiNotes", bodyId: "disclosureBodyAiNotes", key: "ai-notes", openDisplay: "block" },
        { btnId: "btnDisclosureModelsProviders", bodyId: "disclosureBodyModelsProviders", key: "models-providers", openDisplay: "block" },
        { btnId: "rec-more-actions-0", bodyId: "rec-more-body-0", key: "more-actions", openDisplay: "flex" }
      ];

      for (const spec of disclosureSpecs) {
        const btn = env.elements.get(spec.btnId);
        const body = env.elements.get(spec.bodyId);
        assert.equal(btn.getAttribute("aria-controls"), spec.bodyId, `#${spec.btnId} aria-controls must target #${spec.bodyId}`);
        assert.equal(btn.getAttribute("aria-expanded"), "false");
        assert.equal(body.style.display, "none");
        assert.equal(btn.classList.contains("btn"), true);
        assert.equal(btn.classList.contains("btn-primary"), false);
        assert.equal(btn.classList.contains("btn-purple"), false);

        // Expand
        btn.dispatchEvent({ type: "click" });
        const btnOpen = env.elements.get(spec.btnId);
        const bodyOpen = env.elements.get(spec.bodyId);
        assert.equal(btnOpen.getAttribute("aria-expanded"), "true");
        assert.equal(bodyOpen.style.display, spec.openDisplay);
        assert.equal(hooks.getExpandedDisclosures().has(spec.key), true);
        assert.equal(btnOpen.classList.contains("btn-primary"), false);
        assert.equal(btnOpen.classList.contains("btn-purple"), false);

        // Collapse
        btnOpen.dispatchEvent({ type: "click" });
        const btnClosed = env.elements.get(spec.btnId);
        const bodyClosed = env.elements.get(spec.bodyId);
        assert.equal(btnClosed.getAttribute("aria-expanded"), "false");
        assert.equal(bodyClosed.style.display, "none");
        assert.equal(hooks.getExpandedDisclosures().has(spec.key), false);
        assert.equal(btnClosed.classList.contains("btn-primary"), false);
        assert.equal(btnClosed.classList.contains("btn-purple"), false);
      }
    });

    it("verifies static + rendered AD-17 §3 interactive-descendant click guard across direct and nested targets", () => {
      const scriptText = extractInlineScript(PANEL_HTML);
      assert.match(
        scriptText,
        /INTERACTIVE_DESCENDANT_SELECTOR\s*=\s*['"]button,\s*a,\s*input,\s*select,\s*textarea,\s*label,\s*\[role="tab"\],\s*\.status-pill,\s*\.pill['"]/,
        "INTERACTIVE_DESCENDANT_SELECTOR must enumerate all AD-17 §3 interactive descendant selectors"
      );
      assert.match(
        scriptText,
        /function bindFocusTriggers[\s\S]*?if\s*\(isInteractiveDescendantClick\(e,\s*el\)\)\s*return;/,
        "bindFocusTriggers must enforce isInteractiveDescendantClick(e, el)"
      );

      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const container = env.makeElement("a11y-card", "DIV");
      const plain = env.makeElement("a11y-plain", "SPAN");
      container.appendChild(plain);

      assert.equal(hooks.isInteractiveDescendantClick({ target: container }, container), false);
      assert.equal(hooks.isInteractiveDescendantClick({ target: plain }, container), false);

      for (const [label, tag, attrs] of [
        ["button", "BUTTON", {}],
        ["a", "A", {}],
        ["input", "INPUT", {}],
        ["select", "SELECT", {}],
        ["textarea", "TEXTAREA", {}],
        ["label", "LABEL", {}],
        ["[role=tab]", "DIV", { role: "tab" }],
        [".status-pill", "SPAN", { class: "status-pill" }],
        [".pill", "SPAN", { class: "pill" }]
      ]) {
        const parent = env.makeElement(`a11y-int-${label}`, tag);
        if (attrs.role) parent.setAttribute("role", attrs.role);
        if (attrs.class) parent.classList.add(attrs.class);
        const child = env.makeElement(`a11y-nested-${label}`, "SPAN");
        parent.appendChild(child);
        container.appendChild(parent);

        assert.equal(hooks.isInteractiveDescendantClick({ target: parent }, container), true, `Direct ${label} must be guarded`);
        assert.equal(hooks.isInteractiveDescendantClick({ target: child }, container), true, `Nested span inside ${label} must be guarded`);
      }
    });

    it("verifies complete Palette C dark/light token fidelity and deterministic WCAG 2.1 contrast across every surface, pill, gradient, diff wash, and focus ring", () => {
      const rootScope = /:root\s*\{[\s\S]*?\}/;
      const lightScope = /body\.theme-light\s*\{[\s\S]*?\}/;

      const expectedDarkTokens = {
        "--bg-primary": "#1b1b1e",
        "--bg-secondary": "#242428",
        "--bg-tertiary": "#2e2e33",
        "--bg-elevated": "#35353b",
        "--border": "#3d3d44",
        "--border-subtle": "#2c2c31",
        "--text-primary": "#d6d3cd",
        "--text-secondary": "#a3a09a",
        "--text-muted": "#9e9b95",
        "--accent": "#74a9c9",
        "--accent-soft": "#74a9c914",
        "--success": "#86b98a",
        "--success-soft": "#86b98a14",
        "--warning": "#cfae62",
        "--warning-soft": "#cfae6214",
        "--purple": "#b3a4d6",
        "--purple-soft": "#b3a4d614",
        "--danger": "#d98890",
        "--danger-soft": "#d9889014",
        "--on-primary": "#ffffff",
        "--primary-gradient-start": "#35687f",
        "--primary-gradient-end": "#3a728b",
        "--brand-gradient-start": "#35687f",
        "--brand-gradient-end": "#7d6aa0"
      };

      const expectedLightTokens = {
        "--bg-primary": "#fbf9f6",
        "--bg-secondary": "#f4f1ed",
        "--bg-tertiary": "#e9e5df",
        "--bg-elevated": "#ffffff",
        "--border": "#d9d3ca",
        "--border-subtle": "#e6e1da",
        "--text-primary": "#2b2926",
        "--text-secondary": "#5c5852",
        "--text-muted": "#67625b",
        "--accent": "#28627c",
        "--accent-soft": "#28627c1a",
        "--success": "#2a663c",
        "--success-soft": "#2a663c14",
        "--warning": "#7d5f22",
        "--warning-soft": "#7d5f2214",
        "--purple": "#6b5a9c",
        "--purple-soft": "#6b5a9c14",
        "--danger": "#a4444d",
        "--danger-soft": "#a4444d14",
        "--primary-gradient-start": "#28627c",
        "--primary-gradient-end": "#225468",
        "--brand-gradient-start": "#28627c",
        "--brand-gradient-end": "#6b5a9c"
      };

      // 1. Assert full Palette C token completeness
      for (const [k, expected] of Object.entries(expectedDarkTokens)) {
        assert.equal(extractCssVar(styleText, rootScope, k), expected, `Dark token ${k} must match DESIGN.md Palette C`);
      }
      for (const [k, expected] of Object.entries(expectedLightTokens)) {
        assert.equal(extractCssVar(styleText, lightScope, k), expected, `Light token ${k} must match DESIGN.md Palette C`);
      }

      // Verify diff wash CSS rules use 16% color-mix over transparent
      assert.match(styleText, /\.diff-add\s*\{[\s\S]*?color-mix\(in srgb,\s*var\(--success\)\s*16%,\s*transparent\)/);
      assert.match(styleText, /\.diff-del\s*\{[\s\S]*?color-mix\(in srgb,\s*var\(--danger\)\s*16%,\s*transparent\)/);

      // Extract --on-primary dynamically from :root (never hardcoded)
      const onPrimary = extractCssVar(styleText, rootScope, "--on-primary");

      const themes = [
        { name: "dark", scope: rootScope },
        { name: "light", scope: lightScope }
      ];
      const surfaces = ["--bg-primary", "--bg-secondary", "--bg-tertiary"];
      const inkTokens = ["--text-primary", "--text-secondary", "--text-muted"];
      const semanticHues = ["accent", "success", "warning", "purple", "danger"];
      const gradientStops = [
        "--primary-gradient-start",
        "--primary-gradient-end",
        "--brand-gradient-start",
        "--brand-gradient-end"
      ];

      for (const { name, scope } of themes) {
        const bgPrimary = extractCssVar(styleText, scope, "--bg-primary");
        const bgSecondary = extractCssVar(styleText, scope, "--bg-secondary");
        const bgTertiary = extractCssVar(styleText, scope, "--bg-tertiary");
        const border = extractCssVar(styleText, scope, "--border");

        // Distinct surface hierarchy
        assert.notEqual(bgPrimary, bgSecondary, `${name} bg-primary and bg-secondary must be distinct`);
        assert.notEqual(bgSecondary, bgTertiary, `${name} bg-secondary and bg-tertiary must be distinct`);

        // All 3 ink tokens on all 3 surfaces >= 4.5:1
        for (const inkVar of inkTokens) {
          const inkHex = extractCssVar(styleText, scope, inkVar);
          for (const surfVar of surfaces) {
            const surfHex = extractCssVar(styleText, scope, surfVar);
            const ratio = contrastRatio(inkHex, surfHex);
            assert.ok(
              ratio >= 4.5,
              `${name} ${inkVar} (${inkHex}) / ${surfVar} (${surfHex}) = ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
            );
          }
        }

        // All 5 semantic hues directly on bg-primary and bg-secondary >= 4.5:1
        for (const hue of semanticHues) {
          const hueHex = extractCssVar(styleText, scope, `--${hue}`);
          for (const surfVar of ["--bg-primary", "--bg-secondary"]) {
            const surfHex = extractCssVar(styleText, scope, surfVar);
            const ratio = contrastRatio(hueHex, surfHex);
            assert.ok(
              ratio >= 4.5,
              `${name} --${hue} (${hueHex}) / ${surfVar} (${surfHex}) = ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
            );
          }

          // All 5 semantic pills on *-soft composited over both bg-secondary and bg-primary >= 4.5:1
          const softToken = extractCssVar(styleText, scope, `--${hue}-soft`);
          const { hex: softHex, alpha } = parseRgba(softToken);
          for (const surfVar of ["--bg-secondary", "--bg-primary"]) {
            const surfHex = extractCssVar(styleText, scope, surfVar);
            const compBg = compositeColor(softHex, alpha, surfHex);
            const ratio = contrastRatio(hueHex, compBg);
            assert.ok(
              ratio >= 4.5,
              `${name} pill --${hue} (${hueHex}) on --${hue}-soft (${softToken}) over ${surfVar} (${surfHex} -> ${compBg}) = ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
            );
          }
        }

        // Dynamic --on-primary on all 4 gradient stops >= 4.5:1
        for (const gradVar of gradientStops) {
          const gradHex = extractCssVar(styleText, scope, gradVar);
          const ratio = contrastRatio(onPrimary, gradHex);
          assert.ok(
            ratio >= 4.5,
            `${name} --on-primary (${onPrimary}) / ${gradVar} (${gradHex}) = ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
        }

        // .diff-add (16% success) and .diff-del (16% danger) over bg-primary >= 4.5:1
        for (const [cls, hue] of [
          [".diff-add", "success"],
          [".diff-del", "danger"]
        ]) {
          const hueHex = extractCssVar(styleText, scope, `--${hue}`);
          const diffBg = compositeColor(hueHex, 0.16, bgPrimary);
          const ratio = contrastRatio(hueHex, diffBg);
          assert.ok(
            ratio >= 4.5,
            `${name} ${cls} (--${hue} ${hueHex} on 16% wash over ${bgPrimary} = ${diffBg}) = ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
          );
        }

        // Focus indicators: --accent and --purple across all 3 surfaces >= 3.0:1
        for (const focusVar of ["--accent", "--purple"]) {
          const focusHex = extractCssVar(styleText, scope, focusVar);
          for (const surfVar of surfaces) {
            const surfHex = extractCssVar(styleText, scope, surfVar);
            const ratio = contrastRatio(focusHex, surfHex);
            assert.ok(
              ratio >= 3.0,
              `${name} focus ${focusVar} (${focusHex}) / ${surfVar} (${surfHex}) = ${ratio.toFixed(2)}:1 (must be >= 3.0:1)`
            );
          }
        }

        // Decorative border stays < 3.0:1 against bg-primary
        const borderRatio = contrastRatio(border, bgPrimary);
        assert.ok(
          borderRatio < 3.0,
          `${name} decorative --border (${border}) / --bg-primary (${bgPrimary}) = ${borderRatio.toFixed(2)}:1 (expected < 3.0:1 decorative)`
        );
      }
    });
  });

