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
        for (const fn of [...(listeners.get(evt.type) || [])]) fn(evt);
        return !evt.defaultPrevented;
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

    Object.defineProperty(el, "innerHTML", {
      get() {
        return innerHtmlVal;
      },
      set(v) {
        innerHtmlVal = String(v ?? "");
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

  const tabBtns = [
    elements.get("tabBtnAdvisor"),
    elements.get("tabBtnQueue"),
    elements.get("tabBtnProgress"),
    elements.get("tabBtnCatalog"),
    elements.get("tabBtnArtifacts")
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
        return [];
      },
      querySelector: (sel) => {
        if (sel === ".tabs-nav" || sel === "#tabsNav") return elements.get("tabsNav");
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

    it("declares role='tab', aria-selected, aria-controls, and roving tabindex on all 5 tabs", () => {
      const tabs = [
        { id: "tabBtnAdvisor", tab: "advisor", selected: "true", tabindex: "0", controls: "tab-advisor" },
        { id: "tabBtnQueue", tab: "queue", selected: "false", tabindex: "-1", controls: "tab-queue" },
        { id: "tabBtnProgress", tab: "progress", selected: "false", tabindex: "-1", controls: "tab-progress" },
        { id: "tabBtnCatalog", tab: "catalog", selected: "false", tabindex: "-1", controls: "tab-catalog" },
        { id: "tabBtnArtifacts", tab: "artifacts", selected: "false", tabindex: "-1", controls: "tab-artifacts" }
      ];

      for (const t of tabs) {
        const regex = new RegExp(
          `<button[^>]*id="${t.id}"[^>]*role="tab"[^>]*aria-selected="${t.selected}"[^>]*aria-controls="${t.controls}"[^>]*tabindex="${t.tabindex}"[^>]*data-tab="${t.tab}"`,
          "i"
        );
        assert.match(PANEL_HTML, regex, `Tab button ${t.id} must declare complete ARIA tab semantics`);
      }
    });

    it("declares role='tabpanel', tabindex='0', and aria-labelledby on all 5 sections", () => {
      const sections = [
        { id: "tab-advisor", labelledby: "tabBtnAdvisor" },
        { id: "tab-queue", labelledby: "tabBtnQueue" },
        { id: "tab-progress", labelledby: "tabBtnProgress" },
        { id: "tab-catalog", labelledby: "tabBtnCatalog" },
        { id: "tab-artifacts", labelledby: "tabBtnArtifacts" }
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

      const advisorBtn = env.elements.get("tabBtnAdvisor");
      const queueBtn = env.elements.get("tabBtnQueue");
      const advisorPanel = env.elements.get("tab-advisor");
      const queuePanel = env.elements.get("tab-queue");

      assert.equal(advisorBtn.getAttribute("aria-selected"), "true");
      assert.equal(advisorBtn.getAttribute("tabindex"), "0");
      assert.equal(queueBtn.getAttribute("aria-selected"), "false");
      assert.equal(queueBtn.getAttribute("tabindex"), "-1");

      hooks.switchTab("queue");

      assert.equal(advisorBtn.getAttribute("aria-selected"), "false");
      assert.equal(advisorBtn.getAttribute("tabindex"), "-1");
      assert.equal(queueBtn.getAttribute("aria-selected"), "true");
      assert.equal(queueBtn.getAttribute("tabindex"), "0");
      assert.equal(advisorPanel.style.display, "none");
      assert.equal(queuePanel.style.display, "block");
    });

    it("navigates tabs with ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, and End keys (with wrap)", () => {
      const env = createStubbedA11yEnvironment();
      const hooks = env.getTestHooks();
      const { tabBtns } = env;

      // Focus first tab (advisor)
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

      // ArrowDown -> Progress
      hooks.handleTabKeydown({ key: "ArrowDown", currentTarget: tabBtns[1], preventDefault: () => {} });
      assert.equal(tabBtns[2].getAttribute("aria-selected"), "true", "Progress tab should be selected");

      // End -> Artifacts (last tab, index 4)
      hooks.handleTabKeydown({ key: "End", currentTarget: tabBtns[2], preventDefault: () => {} });
      assert.equal(tabBtns[4].getAttribute("aria-selected"), "true", "Artifacts tab should be selected");

      // ArrowRight wraps to Advisor (index 0)
      hooks.handleTabKeydown({ key: "ArrowRight", currentTarget: tabBtns[4], preventDefault: () => {} });
      assert.equal(tabBtns[0].getAttribute("aria-selected"), "true", "Should wrap back to Advisor tab");

      // ArrowLeft wraps to Artifacts (index 4)
      hooks.handleTabKeydown({ key: "ArrowLeft", currentTarget: tabBtns[0], preventDefault: () => {} });
      assert.equal(tabBtns[4].getAttribute("aria-selected"), "true", "Should wrap back to Artifacts tab");

      // ArrowUp -> Catalog (index 3)
      hooks.handleTabKeydown({ key: "ArrowUp", currentTarget: tabBtns[4], preventDefault: () => {} });
      assert.equal(tabBtns[3].getAttribute("aria-selected"), "true", "Catalog tab should be selected");

      // Home -> Advisor (index 0)
      hooks.handleTabKeydown({ key: "Home", currentTarget: tabBtns[3], preventDefault: () => {} });
      assert.equal(tabBtns[0].getAttribute("aria-selected"), "true", "Home must navigate to first tab");
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

    it("associates catalog skill command textarea with <label class='cmd-label'> via for/id", () => {
      assert.match(
        PANEL_HTML,
        /<label\s+class="cmd-label"\s+for="cat-cmd-\$\{idx\}">[\s\S]*?<\/label>\s*<textarea\s+class="cmd-textarea"\s+id="cat-cmd-\$\{idx\}"/i,
        "Catalog cmd-textarea must be preceded by an associated label with for/id"
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
      assert.match(PANEL_HTML, /<input[^>]*id="skillSearch"[^>]*aria-label="[^"]+"/);
      assert.match(PANEL_HTML, /<select[^>]*id="skillPhaseFilter"[^>]*aria-label="[^"]+"/);
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

  describe("UX Design Sync: LD-1 single-row 5-tab layout, semantic toasts & view consistency", () => {
    const styleText = extractStyleContent(PANEL_HTML);

    it("LD-1: lays out all 5 tabs in a single 5-column grid row without orphan wrapping", () => {
      assert.match(
        styleText,
        /\.tabs-nav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/,
        ".tabs-nav must use repeat(5, minmax(0, 1fr)) so all 5 tabs fit in one row"
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

    it("renders padded .agent-card rows, keyboard-accessible Phase/Epic <button aria-expanded> toggles, empty states, and artifact close button", () => {
      assert.match(
        styleText,
        /\.agent-card\s*\{[\s\S]*?padding:\s*9px\s+11px/,
        ".agent-card must define 9px 11px padding"
      );
      assert.match(
        PANEL_HTML,
        /<button[^>]*id="btnCloseArtifactPreview"/,
        "Artifact preview card must expose #btnCloseArtifactPreview"
      );

      const env = createStubbedA11yEnvironment();
      env.elements.get("storyStatusFilter").value = "all";
      env.elements.get("skillPhaseFilter").value = "all";
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
        skillsCatalog: [],
        agentsCatalog: [
          {
            skill: "bmad-agent-ux-designer",
            icon: "🎨",
            name: "Sally",
            title: "UX Designer",
            focus: "Experience & visual systems"
          }
        ],
        artifacts: []
      });

      const phasesHtml = env.elements.get("phasesList").innerHTML;
      assert.match(phasesHtml, /<button[^>]*class="phase-summary-row"[^>]*aria-expanded="true"/);
      assert.match(phasesHtml, /<button[^>]*class="art-chip-main"/);
      assert.match(phasesHtml, /<button[^>]*class="art-chip-open"/);

      const epicsHtml = env.elements.get("epicsList").innerHTML;
      assert.match(epicsHtml, /<button[^>]*class="epic-toggle-btn"[^>]*aria-expanded="true"/);

      const skillsHtml = env.elements.get("skillsCatalogList").innerHTML;
      assert.match(skillsHtml, /class="empty-state-card"/);

      const agentsHtml = env.elements.get("agentsCatalogList").innerHTML;
      assert.match(agentsHtml, /class="agent-card"/);

      const artsHtml = env.elements.get("artifactsDirectoryList").innerHTML;
      assert.match(artsHtml, /class="empty-state-card"/);

      // Closing artifact preview hides card
      const previewCard = env.elements.get("artifactPreviewCard");
      previewCard.style.display = "block";
      env.elements.get("btnCloseArtifactPreview").dispatchEvent({ type: "click" });
      assert.equal(previewCard.style.display, "none");
    });

    it("refines progressbar ARIA, paused queue controls, honest Queue Epic states, agent search filtering, and filter-clear buttons", () => {
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
      env.elements.get("skillPhaseFilter").value = "all";

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
        skillsCatalog: [
          { skill: "bmad-ux", displayName: "UX Design", description: "Design UX", module: "bmm", phase: "2-planning", contextualCommand: "/bmad-ux \"x\"" }
        ],
        agentsCatalog: [
          { skill: "bmad-agent-ux-designer", icon: "🎨", name: "Sally", title: "UX Designer", focus: "Experience" },
          { skill: "bmad-agent-dev", icon: "💻", name: "Amelia", title: "Developer", focus: "Implementation" }
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

      // #skillSearch filters agents too ("sally" keeps Sally and excludes Amelia)
      env.elements.get("skillSearch").value = "sally";
      hooks.renderSkillsCatalog(true);
      const agentsFilteredHtml = env.elements.get("agentsCatalogList").innerHTML;
      assert.match(agentsFilteredHtml, /Sally/);
      assert.doesNotMatch(agentsFilteredHtml, /Amelia/);
      assert.match(env.elements.get("skillsCatalogList").innerHTML, /id="btnClearSkillFilters"/);

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
      env.elements.get("skillPhaseFilter").value = "all";
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
      env.elements.get("skillPhaseFilter").value = "all";
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
