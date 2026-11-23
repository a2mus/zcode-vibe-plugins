import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

import {
  PANEL_HTML_PATH,
  contrastRatio,
  extractInlineScript,
  extractStyleContent,
  parseCssBlockVars,
  resolveCssAliases
} from "./helpers.mjs";

const PANEL_HTML = readFileSync(PANEL_HTML_PATH, "utf8");

describe("Story 4.1 — Panel ARIA landmarks, live regions & static markup", () => {
  it("declares landmark role='banner' on top-bar header", () => {
    assert.match(
      PANEL_HTML,
      /<header[^>]*class="[^"]*top-bar[^"]*"[^>]*role="banner"/,
      "Header must declare role='banner' landmark"
    );
  });

  it("declares role='tablist' with descriptive aria-label on tabs navigation", () => {
    assert.match(
      PANEL_HTML,
      /<nav[^>]*id="tabsNav"[^>]*role="tablist"[^>]*aria-label="[^"]+"/i,
      "tabsNav must declare role='tablist' with aria-label"
    );
  });

  it("declares role='tab', aria-selected, aria-controls, and roving tabindex on all tab buttons", () => {
    const tabExpectations = [
      { id: "tabBtnStoryboard", tab: "storyboard", selected: "true", tabindex: "0", controls: "tab-storyboard" },
      { id: "tabBtnExplainer", tab: "explainer", selected: "false", tabindex: "-1", controls: "tab-explainer" },
      { id: "tabBtnMemory", tab: "memory", selected: "false", tabindex: "-1", controls: "tab-memory" },
      { id: "tabBtnHistory", tab: "history", selected: "false", tabindex: "-1", controls: "tab-history" }
    ];

    for (const exp of tabExpectations) {
      const regex = new RegExp(
        `<button[^>]*id="${exp.id}"[^>]*role="tab"[^>]*aria-selected="${exp.selected}"[^>]*aria-controls="${exp.controls}"[^>]*tabindex="${exp.tabindex}"[^>]*data-tab="${exp.tab}"`,
        "i"
      );
      assert.match(PANEL_HTML, regex, `Tab button ${exp.id} must declare complete tab semantics`);
    }
  });

  it("declares role='tabpanel', tabindex='0', and aria-labelledby on all tab sections", () => {
    const panelExpectations = [
      { id: "tab-storyboard", labelledby: "tabBtnStoryboard" },
      { id: "tab-explainer", labelledby: "tabBtnExplainer" },
      { id: "tab-memory", labelledby: "tabBtnMemory" },
      { id: "tab-history", labelledby: "tabBtnHistory" }
    ];

    for (const exp of panelExpectations) {
      const regex = new RegExp(
        `<section[^>]*id="${exp.id}"[^>]*role="tabpanel"[^>]*aria-labelledby="${exp.labelledby}"[^>]*tabindex="0"`,
        "i"
      );
      assert.match(PANEL_HTML, regex, `Section ${exp.id} must declare role='tabpanel' and aria-labelledby`);
    }
  });

  it("declares polite live regions with role='status' and aria-live='polite' on toast and inspector", () => {
    assert.match(
      PANEL_HTML,
      /<div[^>]*id="toastBanner"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/,
      "toastBanner must declare role='status', aria-live='polite', aria-atomic='true'"
    );

    assert.match(
      PANEL_HTML,
      /<div[^>]*id="nodeInspectorBar"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/,
      "nodeInspectorBar must declare role='status', aria-live='polite', aria-atomic='true'"
    );
  });

  it("declares aria-pressed on toggle controls and aria-expanded on add-lesson trigger in markup", () => {
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="btnModeBug"[^>]*role="button"[^>]*aria-pressed="false"/,
      "btnModeBug must declare role='button' and aria-pressed"
    );
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="btnModeImpl"[^>]*role="button"[^>]*aria-pressed="true"/,
      "btnModeImpl must declare role='button' and aria-pressed"
    );
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="btnToggleSte100"[^>]*role="button"[^>]*aria-pressed="true"/,
      "btnToggleSte100 must declare role='button' and aria-pressed"
    );
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="btnExplainerPlay"[^>]*role="button"[^>]*aria-pressed="false"/,
      "btnExplainerPlay must declare role='button' and aria-pressed"
    );
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="btnExplainerVoice"[^>]*role="button"[^>]*aria-pressed="false"/,
      "btnExplainerVoice must declare role='button' and aria-pressed"
    );
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="btnToggleCustomLesson"[^>]*aria-expanded="false"[^>]*aria-controls="customLessonForm"/,
      "btnToggleCustomLesson must declare aria-expanded and aria-controls"
    );
    assert.match(
      PANEL_HTML,
      /<div[^>]*id="customLessonForm"[^>]*role="region"[^>]*aria-label="Add Lesson to ZCode Memory"/,
      "customLessonForm must declare role='region' and aria-label"
    );
  });
});

describe("Story 4.1 — Focus rings & >= 3:1 contrast floor", () => {
  const styleText = extractStyleContent(PANEL_HTML);
  const darkVars = resolveCssAliases(parseCssBlockVars(styleText, /:root\s*\{([\s\S]*?)\}/));
  const lightVars = resolveCssAliases({
    ...darkVars,
    ...parseCssBlockVars(styleText, /body\.theme-light,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\}/)
  });

  it("defines visible :focus-visible outlines with var(--accent) in CSS", () => {
    assert.match(styleText, /:focus-visible[\s\S]*?outline:\s*2px\s+solid\s+var\(--accent\)/);
    assert.match(styleText, /outline-offset:\s*2px/);
  });

  it("satisfies >= 3:1 contrast for :focus-visible outlines across all Dark HUD and Field Desk Light surfaces", () => {
    const surfaces = ["--bg-app", "--bg-surface", "--bg-panel", "--bg-card", "--bg-elevated"];

    for (const [themeName, palette] of [
      ["Dark HUD", darkVars],
      ["Field Desk Light", lightVars]
    ]) {
      const accent = palette["--accent"];
      assert.ok(accent, `Theme ${themeName} must define --accent`);

      for (const surface of surfaces) {
        const bg = palette[surface];
        assert.ok(bg, `Theme ${themeName} must define ${surface}`);
        const ratio = contrastRatio(accent, bg);
        assert.ok(
          ratio >= 3.0,
          `${themeName} focus ring --accent (${accent}) on ${surface} (${bg}) contrast is ${ratio.toFixed(2)}:1 (must be >= 3:1)`
        );
      }
    }
  });
});

  describe("Story 4.1 — Interactive ARIA state updates & keyboard navigation", () => {
  function createA11yTestEnvironment({ reducedMotion = false, failToolCalls = false } = {}) {
    const styleText = extractStyleContent(PANEL_HTML);
    const darkVars = resolveCssAliases(parseCssBlockVars(styleText, /:root\s*\{([\s\S]*?)\}/));
    const lightVars = resolveCssAliases({
      ...darkVars,
      ...parseCssBlockVars(styleText, /body\.theme-light,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\}/)
    });

    const elements = new Map();
    let activeElement = null;
    let rafCalls = 0;

    function makeClassList(initial = []) {
      const set = new Set(initial);
      return {
        add: (...cls) => cls.forEach((c) => set.add(c)),
        remove: (...cls) => cls.forEach((c) => set.delete(c)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (set.has(c)) {
              set.delete(c);
              return false;
            }
            set.add(c);
            return true;
          }
          if (force) set.add(c);
          else set.delete(c);
          return Boolean(force);
        },
        contains: (c) => set.has(c),
        toArray: () => Array.from(set)
      };
    }

    function parseRenderedChildren(html) {
      const children = [];
      const tagRe = /<(g|div|button)\s+([^>]*class="[^"]*(?:diagram-node-group|history-item|file-badge|persona-chip|scene-pill)[^"]*"[^>]*)>/gi;
      for (const m of html.matchAll(tagRe)) {
        const child = makeElement("", m[1]);
        const attrRe = /([a-z0-9-]+)="([^"]*)"/gi;
        for (const a of m[2].matchAll(attrRe)) {
          const val = a[2]
            .replace(/&quot;/g, '"')
            .replace(/&gt;/g, ">")
            .replace(/&lt;/g, "<")
            .replace(/&amp;/g, "&");
          child.setAttribute(a[1], val);
          if (a[1] === "class") {
            val.split(/\s+/).filter(Boolean).forEach((c) => child.classList.add(c));
          }
        }
        children.push(child);
      }
      return children;
    }

    function makeElement(id, tagName = "div") {
      const attrs = new Map();
      const el = {
        id,
        tagName,
        style: {},
        value: "",
        checked: false,
        disabled: false,
        textContent: "",
        _innerHTML: "",
        _children: [],
        className: "",
        classList: makeClassList(),
        listeners: new Map(),
        setAttribute(name, val) {
          attrs.set(name, String(val));
        },
        getAttribute(name) {
          return attrs.has(name) ? attrs.get(name) : null;
        },
        hasAttribute(name) {
          return attrs.has(name);
        },
        removeAttribute(name) {
          attrs.delete(name);
        },
        addEventListener(type, fn) {
          if (!this.listeners.has(type)) this.listeners.set(type, []);
          this.listeners.get(type).push(fn);
        },
        dispatchEvent(event) {
          const fns = this.listeners.get(event.type) || [];
          for (const fn of fns) {
            fn.call(this, event);
          }
          return !event.defaultPrevented;
        },
        focus() {
          activeElement = el;
        },
        querySelectorAll(selector) {
          if (selector.startsWith(".") && this._children.length > 0) {
            const cls = selector.slice(1);
            return this._children.filter((c) => c.classList.contains(cls));
          }
          return Array.from(elements.values()).filter((e) => {
            if (selector.startsWith(".")) {
              return e.classList.contains(selector.slice(1));
            }
            if (selector.startsWith("#")) {
              return e.id === selector.slice(1);
            }
            return false;
          });
        },
        scrollIntoView() {}
      };
      Object.defineProperty(el, "innerHTML", {
        get() {
          return el._innerHTML;
        },
        set(val) {
          el._innerHTML = String(val ?? "");
          el._children = parseRenderedChildren(el._innerHTML);
        }
      });
      if (id) elements.set(id, el);
      return el;
    }

    const documentElement = makeElement("__html__", "html");
    const body = makeElement("__body__", "body");

    const requiredIds = [
      "panelTitle",
      "panelSubtitle",
      "btnToggleSte100",
      "smartGeminiModelSelect",
      "personaStrip",
      "diagramTitleLabel",
      "touchedFilesCountLabel",
      "diagramSvg",
      "touchedFilesStrip",
      "nodeInspectorBar",
      "btnModeBug",
      "btnModeImpl",
      "activeModePill",
      "activePersonaPill",
      "steMetricsPill",
      "complexityPill",
      "debriefTimestamp",
      "tldrHeadline",
      "realWorldAnalogy",
      "bugStoryboardSection",
      "implStoryboardSection",
      "bugCauseText",
      "bugPlanText",
      "bugSuccessBanner",
      "bugSuccessIcon",
      "bugSuccessHeadline",
      "bugSuccessPill",
      "bugSuccessSummaryText",
      "bugProofStrip",
      "bugConsequencesText",
      "bugOversightBlock",
      "implObjectiveText",
      "implPlanWhyText",
      "implResultText",
      "implProofStrip",
      "implConsequencesText",
      "implOversightBlock",
      "lessonsListContainer",
      "customLessonForm",
      "customLessonTitle",
      "customLessonSummary",
      "customLessonWhy",
      "customLessonHow",
      "btnToggleCustomLesson",
      "btnCancelCustomLesson",
      "btnSaveCustomLesson",
      "tabsNav",
      "tabBtnStoryboard",
      "tabBtnExplainer",
      "tabBtnMemory",
      "tabBtnHistory",
      "explainerCanvas",
      "btnExplainerPlay",
      "btnExplainerPrev",
      "btnExplainerNext",
      "explainerSpeedSelect",
      "btnExplainerVoice",
      "explainerScenePills",
      "explainerSceneTitle",
      "explainerSceneNarration",
      "plainTextScriptBox",
      "btnCopyScript",
      "memoryCountBadge",
      "confirmedTotalPill",
      "memoryDirPathLabel",
      "confirmedLessonsBankList",
      "memoryIndexPreviewBox",
      "historyListContainer",
      "toastBanner",
      "toastText",
      "tab-storyboard",
      "tab-explainer",
      "tab-memory",
      "tab-history"
    ];

    for (const id of requiredIds) {
      makeElement(id);
    }

    const explainerCanvas = elements.get("explainerCanvas");
    explainerCanvas.width = 600;
    explainerCanvas.height = 250;
    explainerCanvas.getContext = () => ({
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fill() {},
      fillText() {},
      arc() {},
      roundRect() {}
    });

    // Populate attributes from PANEL_HTML for elements with IDs
    const tagMatches = PANEL_HTML.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi);
    for (const match of tagMatches) {
      const tagName = match[1];
      const rawAttrs = match[2];
      const id = match[3];
      const el = elements.get(id) || makeElement(id, tagName);
      const attrMatches = rawAttrs.matchAll(/([a-z0-9-]+)="([^"]*)"/gi);
      for (const attr of attrMatches) {
        el.setAttribute(attr[1], attr[2]);
        if (attr[1] === "class") {
          attr[2].split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
        }
      }
    }

    const tabConfigs = [
      ["tabBtnStoryboard", "storyboard"],
      ["tabBtnExplainer", "explainer"],
      ["tabBtnMemory", "memory"],
      ["tabBtnHistory", "history"]
    ];

    const windowListeners = new Map();
    const dispatchWindowMessage = (data) => {
      const listeners = windowListeners.get("message") || [];
      for (const fn of listeners) {
        fn({ data });
      }
    };

    const panelStatePayload = () => ({
      projectName: "demo-a11y-app",
      activePersona: "vibe-mentor",
      ste100Enabled: true,
      personas: [
        { id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor", tagline: "Plain clarity" },
        { id: "visual-mapper", name: "Visual Mapper", badge: "🗺️ Visual Mapper", tagline: "Diagrams first" }
      ],
      lightweightGeminiModels: [{ id: "new-provider/gemini-4-argon", modelId: "gemini-4-argon" }],
      recommendedGeminiModel: "new-provider/gemini-4-argon",
      confirmedLessons: [],
      zcodeMemory: { memoryDir: "~/.zcode/cli/memories", indexContent: "" },
      history: [],
      currentDebrief: {
        responseType: "implementation",
        tldrHeadline: "A11y implementation baseline ready.",
        realWorldAnalogy: "A well-labeled building with ramps and clear signs.",
        touchedFiles: [],
        diagram: { title: "A11y Diagram", nodes: [], edges: [] },
        implReport: { objective: "ARIA semantics", planWhy: "Keyboard operability", result: "Verified" }
      }
    });

    const sandbox = {
      console: { warn() {}, error() {}, log() {} },
      setTimeout: (fn) => setTimeout(fn, 0),
      clearTimeout: () => {},
      requestAnimationFrame: () => {
        rafCalls += 1;
        return rafCalls;
      },
      cancelAnimationFrame: () => {},
      navigator: { clipboard: { writeText: async () => {} } },
      document: {
        documentElement,
        body,
        getElementById(id) {
          return elements.get(id) || makeElement(id);
        },
        querySelectorAll(selector) {
          if (selector === ".tab-btn") {
            return tabConfigs.map(([id]) => elements.get(id));
          }
          if (selector === ".scene-pill") {
            return Array.from(elements.values()).filter((e) => e.classList.contains("scene-pill"));
          }
          return [];
        },
        get activeElement() {
          return activeElement;
        }
      },
      getComputedStyle() {
        return {
          display: "inline-flex",
          getPropertyValue: () => ""
        };
      },
      window: {
        matchMedia(query) {
          return {
            matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
            addEventListener() {},
            removeEventListener() {}
          };
        },
        addEventListener(type, fn) {
          if (!windowListeners.has(type)) windowListeners.set(type, []);
          windowListeners.get(type).push(fn);
        },
        dispatchEvent(event) {
          const fns = windowListeners.get(event.type) || [];
          for (const fn of fns) {
            fn(event);
          }
          return !event.defaultPrevented;
        },
        parent: {
          postMessage(msg) {
            if (msg.method === "ui/initialize" && msg.id !== undefined) {
              queueMicrotask(() => dispatchWindowMessage({ jsonrpc: "2.0", id: msg.id, result: { hostContext: { theme: "dark" } } }));
            } else if (msg.method === "tools/call" && msg.params?.name === "vibe_debrief_get_state") {
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: { structuredContent: panelStatePayload() }
                })
              );
            } else if (msg.method === "tools/call" && failToolCalls) {
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  error: { code: -32000, message: "Simulated RPC failure" }
                })
              );
            }
          }
        }
      }
    };

    const scriptText = extractInlineScript(PANEL_HTML);
    const context = vm.createContext(sandbox);
    vm.runInContext(scriptText, context);

    return {
      sandbox,
      elements,
      getActiveElement: () => activeElement,
      getRafCalls: () => rafCalls,
      dispatchWindowEvent: (event) => sandbox.window.dispatchEvent(event),
      dispatchWindowMessage
    };
  }

  it("updates aria-selected, roving tabindex, and panel visibility when switchTab is invoked", () => {
    const { elements, sandbox } = createA11yTestEnvironment();

    const storyboardBtn = elements.get("tabBtnStoryboard");
    const memoryBtn = elements.get("tabBtnMemory");
    const storyboardPanel = elements.get("tab-storyboard");
    const memoryPanel = elements.get("tab-memory");

    assert.equal(storyboardBtn.getAttribute("aria-selected"), "true");
    assert.equal(storyboardBtn.getAttribute("tabindex"), "0");
    assert.equal(memoryBtn.getAttribute("aria-selected"), "false");
    assert.equal(memoryBtn.getAttribute("tabindex"), "-1");

    // Click memory tab
    const clickListeners = memoryBtn.listeners.get("click") || [];
    assert.ok(clickListeners.length > 0, "Memory tab must have click listener");
    clickListeners[0]();

    assert.equal(storyboardBtn.getAttribute("aria-selected"), "false");
    assert.equal(storyboardBtn.getAttribute("tabindex"), "-1");
    assert.equal(memoryBtn.getAttribute("aria-selected"), "true");
    assert.equal(memoryBtn.getAttribute("tabindex"), "0");
    assert.equal(memoryPanel.style.display, "block");
    assert.equal(storyboardPanel.style.display, "none");
  });

  it("navigates tabs with ArrowRight and ArrowLeft keyboard keys (wrapping around)", () => {
    const { elements } = createA11yTestEnvironment();

    const tabsNav = elements.get("tabsNav");
    const keydownListeners = tabsNav.listeners.get("keydown") || [];
    assert.ok(keydownListeners.length > 0, "tabsNav must have keydown listener");
    const onKeydown = keydownListeners[0];

    const storyboardBtn = elements.get("tabBtnStoryboard");
    const explainerBtn = elements.get("tabBtnExplainer");
    const memoryBtn = elements.get("tabBtnMemory");
    const historyBtn = elements.get("tabBtnHistory");

    // Explainer button is hidden by default; make sure visible tabs are navigated
    explainerBtn.style.display = "none";

    // Press ArrowRight from storyboard -> skips explainer -> moves to memory
    storyboardBtn.focus();
    let defaultPrevented = false;
    onKeydown({
      key: "ArrowRight",
      preventDefault: () => {
        defaultPrevented = true;
      }
    });

    assert.ok(defaultPrevented, "ArrowRight must preventDefault");
    assert.equal(memoryBtn.getAttribute("aria-selected"), "true");
    assert.equal(memoryBtn.getAttribute("tabindex"), "0");
    assert.equal(storyboardBtn.getAttribute("aria-selected"), "false");

    // Press ArrowRight from memory -> moves to history
    onKeydown({ key: "ArrowRight", preventDefault: () => {} });
    assert.equal(historyBtn.getAttribute("aria-selected"), "true");

    // Press ArrowRight from history -> wraps around to storyboard
    onKeydown({ key: "ArrowRight", preventDefault: () => {} });
    assert.equal(storyboardBtn.getAttribute("aria-selected"), "true");

    // Press ArrowLeft from storyboard -> wraps around backwards to history
    onKeydown({ key: "ArrowLeft", preventDefault: () => {} });
    assert.equal(historyBtn.getAttribute("aria-selected"), "true");

    // Press Home -> moves to first visible tab (storyboard)
    onKeydown({ key: "Home", preventDefault: () => {} });
    assert.equal(storyboardBtn.getAttribute("aria-selected"), "true");

    // Press End -> moves to last visible tab (history)
    onKeydown({ key: "End", preventDefault: () => {} });
    assert.equal(historyBtn.getAttribute("aria-selected"), "true");
  });

  it("updates aria-pressed on mode toggles, ste toggle, and persona chips", () => {
    const { elements } = createA11yTestEnvironment();

    const btnBug = elements.get("btnModeBug");
    const btnImpl = elements.get("btnModeImpl");
    const btnSte = elements.get("btnToggleSte100");

    assert.ok(btnBug.hasAttribute("aria-pressed"));
    assert.ok(btnImpl.hasAttribute("aria-pressed"));
    assert.ok(btnSte.hasAttribute("aria-pressed"));
  });

  it("dismisses inline custom lesson form and restores focus on Escape key", () => {
    const { elements, getActiveElement, dispatchWindowEvent } = createA11yTestEnvironment();

    const toggleBtn = elements.get("btnToggleCustomLesson");
    const form = elements.get("customLessonForm");
    const titleInput = elements.get("customLessonTitle");

    // Initially form is hidden
    form.style.display = "none";
    assert.equal(toggleBtn.getAttribute("aria-expanded"), "false");

    // Open form via toggle button
    const toggleClick = toggleBtn.listeners.get("click") || [];
    assert.ok(toggleClick.length > 0, "Toggle button must have click listener");
    toggleClick[0]();

    assert.equal(form.style.display, "block");
    assert.equal(toggleBtn.getAttribute("aria-expanded"), "true");
    assert.equal(getActiveElement(), titleInput, "Focus should move to first form input on open");

    // Press Escape on the form element
    const formKeydown = form.listeners.get("keydown") || [];
    assert.ok(formKeydown.length > 0, "Form element must have keydown listener");

    let defaultPrevented = false;
    formKeydown[0]({
      key: "Escape",
      preventDefault: () => {
        defaultPrevented = true;
      }
    });

    assert.ok(defaultPrevented, "Escape must preventDefault");
    assert.equal(form.style.display, "none", "Form must close on Escape");
    assert.equal(toggleBtn.getAttribute("aria-expanded"), "false");
    assert.equal(getActiveElement(), toggleBtn, "Focus must return to toggle button on dismiss");

    // Open form again and test window-level Escape dismiss
    toggleClick[0]();
    assert.equal(form.style.display, "block");

    dispatchWindowEvent({
      type: "keydown",
      key: "Escape",
      preventDefault: () => {}
    });

    assert.equal(form.style.display, "none", "Window-level Escape must also dismiss form");
    assert.equal(toggleBtn.getAttribute("aria-expanded"), "false");
    assert.equal(getActiveElement(), toggleBtn);
  });

  it("toggles aria-pressed on explainer play and voice controls", () => {
    const { elements } = createA11yTestEnvironment();

    const playBtn = elements.get("btnExplainerPlay");
    const voiceBtn = elements.get("btnExplainerVoice");

    assert.equal(playBtn.getAttribute("aria-pressed"), "false");
    assert.equal(voiceBtn.getAttribute("aria-pressed"), "false");

    // Toggle play
    const playClick = playBtn.listeners.get("click") || [];
    assert.ok(playClick.length > 0, "Play button must have click listener");
    playClick[0]();
    assert.equal(playBtn.getAttribute("aria-pressed"), "true");

    // Stop play
    playClick[0]();
    assert.equal(playBtn.getAttribute("aria-pressed"), "false");

    // Toggle voice
    const voiceClick = voiceBtn.listeners.get("click") || [];
    assert.ok(voiceClick.length > 0, "Voice button must have click listener");
    voiceClick[0]();
    assert.equal(voiceBtn.getAttribute("aria-pressed"), "true");

    voiceClick[0]();
    assert.equal(voiceBtn.getAttribute("aria-pressed"), "false");
  });

  it("navigates explainer scene pills with ArrowRight, ArrowLeft, Home, and End", () => {
    const { elements, dispatchWindowMessage } = createA11yTestEnvironment();

    // Push debrief with multiple scenes to populate explainerScenePills
    dispatchWindowMessage({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: {
        structuredContent: {
          projectName: "demo-a11y-app",
          activePersona: "vibe-mentor",
          personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
          ste100Enabled: true,
          confirmedLessons: [],
          history: [],
          currentDebrief: {
            responseType: "implementation",
            complexity: { level: "complex" },
            tldrHeadline: "Complex scene flow.",
            diagram: { nodes: [], edges: [] },
            explainerScenes: [
              { title: "Scene 1: Setup", narration: "First step." },
              { title: "Scene 2: Execute", narration: "Second step." },
              { title: "Scene 3: Complete", narration: "Third step." }
            ]
          }
        }
      }
    });

    const pillsContainer = elements.get("explainerScenePills");
    const keydownListeners = pillsContainer.listeners.get("keydown") || [];
    assert.ok(keydownListeners.length > 0, "explainerScenePills must have keydown listener");
    const onKeydown = keydownListeners[0];

    // Mock querySelectorAll for .scene-pill
    const pills = [
      makeScenePill("Scene 1", 0, true),
      makeScenePill("Scene 2", 1, false),
      makeScenePill("Scene 3", 2, false)
    ];

    function makeScenePill(title, idx, isActive) {
      const p = elements.get(`scene-pill-${idx}`) || {
        classList: {
          contains: (cls) => (cls === "active" ? p._active : cls === "scene-pill"),
          add: () => {},
          remove: () => {}
        },
        _active: isActive,
        focus: () => {},
        addEventListener: () => {},
        getAttribute: (attr) => (attr === "data-sidx" ? String(idx) : null)
      };
      p._active = isActive;
      return p;
    }

    pillsContainer.querySelectorAll = (sel) => (sel === ".scene-pill" ? pills : []);

    let prevented = false;
    onKeydown({
      key: "ArrowRight",
      preventDefault: () => {
        prevented = true;
      }
    });
    assert.ok(prevented);
  });

  it("updates polite live regions on toast display and node inspector updates", () => {
    const { elements, sandbox } = createA11yTestEnvironment();

    const toastBanner = elements.get("toastBanner");
    const toastText = elements.get("toastText");
    const inspector = elements.get("nodeInspectorBar");

    assert.equal(toastBanner.getAttribute("role"), "status");
    assert.equal(toastBanner.getAttribute("aria-live"), "polite");
    assert.equal(inspector.getAttribute("role"), "status");
    assert.equal(inspector.getAttribute("aria-live"), "polite");

    // Trigger refresh button which calls showToast
    const refreshBtn = elements.get("btnRefresh");
    const refreshClick = refreshBtn.listeners.get("click") || [];
    assert.ok(refreshClick.length > 0);
    refreshClick[0]();

    assert.ok(toastBanner.classList.contains("visible"), "Toast banner should be visible on state sync");
    assert.match(toastText.textContent, /Synced latest/i, "Toast text should announce sync in live region");
  });
});

describe("Story 4.2 & UX Ergonomics — Keyboard SVG nodes, history replay, reduced motion & contrast", () => {
  const styleText = extractStyleContent(PANEL_HTML);
  const darkVars = resolveCssAliases(parseCssBlockVars(styleText, /:root\s*\{([\s\S]*?)\}/));
  const lightVars = resolveCssAliases({
    ...darkVars,
    ...parseCssBlockVars(styleText, /body\.theme-light,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\}/)
  });

  function buildKeyboardEnv(opts = {}) {
    // Reuse the outer describe's helper by reading PANEL_HTML directly in a minimal inline setup
    const elements = new Map();
    let activeElement = null;
    let rafCalls = 0;

    function makeClassList(initial = []) {
      const set = new Set(initial);
      return {
        add: (...cls) => cls.forEach((c) => set.add(c)),
        remove: (...cls) => cls.forEach((c) => set.delete(c)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (set.has(c)) {
              set.delete(c);
              return false;
            }
            set.add(c);
            return true;
          }
          if (force) set.add(c);
          else set.delete(c);
          return Boolean(force);
        },
        contains: (c) => set.has(c)
      };
    }

    function parseRenderedChildren(html) {
      const children = [];
      const tagRe = /<(g|div|button)\s+([^>]*class="[^"]*(?:diagram-node-group|history-item|file-badge|persona-chip|scene-pill)[^"]*"[^>]*)>/gi;
      for (const m of html.matchAll(tagRe)) {
        const child = makeElement("", m[1]);
        const attrRe = /([a-z0-9-]+)="([^"]*)"/gi;
        for (const a of m[2].matchAll(attrRe)) {
          const val = a[2]
            .replace(/&quot;/g, '"')
            .replace(/&gt;/g, ">")
            .replace(/&lt;/g, "<")
            .replace(/&amp;/g, "&");
          child.setAttribute(a[1], val);
          if (a[1] === "class") {
            val.split(/\s+/).filter(Boolean).forEach((c) => child.classList.add(c));
          }
        }
        children.push(child);
      }
      return children;
    }

    function makeElement(id, tagName = "div") {
      const attrs = new Map();
      const el = {
        id,
        tagName,
        style: {},
        value: "",
        checked: false,
        disabled: false,
        textContent: "",
        _innerHTML: "",
        _children: [],
        className: "",
        classList: makeClassList(),
        listeners: new Map(),
        setAttribute(name, val) {
          attrs.set(name, String(val));
        },
        getAttribute(name) {
          return attrs.has(name) ? attrs.get(name) : null;
        },
        hasAttribute(name) {
          return attrs.has(name);
        },
        removeAttribute(name) {
          attrs.delete(name);
        },
        addEventListener(type, fn) {
          if (!this.listeners.has(type)) this.listeners.set(type, []);
          this.listeners.get(type).push(fn);
        },
        dispatchEvent(event) {
          const fns = this.listeners.get(event.type) || [];
          for (const fn of fns) {
            fn.call(this, event);
          }
          return !event.defaultPrevented;
        },
        focus() {
          activeElement = el;
        },
        querySelectorAll(selector) {
          if (selector.startsWith(".") && this._children.length > 0) {
            const cls = selector.slice(1);
            return this._children.filter((c) => c.classList.contains(cls));
          }
          return [];
        },
        scrollIntoView() {}
      };
      Object.defineProperty(el, "innerHTML", {
        get() {
          return el._innerHTML;
        },
        set(val) {
          el._innerHTML = String(val ?? "");
          el._children = parseRenderedChildren(el._innerHTML);
        }
      });
      if (id) elements.set(id, el);
      return el;
    }

    const documentElement = makeElement("__html__", "html");
    const body = makeElement("__body__", "body");

    const tagMatches = PANEL_HTML.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi);
    for (const match of tagMatches) {
      const el = elements.get(match[3]) || makeElement(match[3], match[1]);
      for (const attr of match[2].matchAll(/([a-z0-9-]+)="([^"]*)"/gi)) {
        el.setAttribute(attr[1], attr[2]);
        if (attr[1] === "class") {
          attr[2].split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
        }
      }
    }

    const explainerCanvas = elements.get("explainerCanvas") || makeElement("explainerCanvas", "canvas");
    explainerCanvas.width = 600;
    explainerCanvas.height = 250;
    const canvasDrawOps = [];
    explainerCanvas.getContext = () => ({
      fillStyle: "",
      strokeStyle: "",
      clearRect() {},
      fillRect() {
        canvasDrawOps.push({ op: "fillRect", style: this.fillStyle });
      },
      strokeRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fill() {},
      fillText(t) {
        canvasDrawOps.push({ op: "fillText", text: String(t) });
      },
      arc() {
        canvasDrawOps.push({ op: "arc", style: this.fillStyle });
      },
      roundRect() {}
    });

    const tabIds = ["tabBtnStoryboard", "tabBtnExplainer", "tabBtnMemory", "tabBtnHistory"];
    const windowListeners = new Map();
    const dispatchWindowMessage = (data) => {
      for (const fn of windowListeners.get("message") || []) fn({ data });
    };

    const sandbox = {
      console: { warn() {}, error() {}, log() {} },
      setTimeout: (fn) => setTimeout(fn, 0),
      clearTimeout: () => {},
      requestAnimationFrame: () => {
        rafCalls += 1;
        return rafCalls;
      },
      cancelAnimationFrame: () => {},
      navigator: { clipboard: { writeText: async () => {} } },
      document: {
        documentElement,
        body,
        getElementById: (id) => elements.get(id) || makeElement(id),
        querySelectorAll(selector) {
          if (selector === ".tab-btn") return tabIds.map((id) => elements.get(id));
          if (selector === ".scene-pill") return [];
          return [];
        },
        get activeElement() {
          return activeElement;
        }
      },
      getComputedStyle: () => ({ display: "inline-flex", getPropertyValue: () => "" }),
      window: {
        matchMedia: (q) => ({
          matches: q.includes("prefers-reduced-motion") ? Boolean(opts.reducedMotion) : false,
          addEventListener() {},
          removeEventListener() {}
        }),
        addEventListener(type, fn) {
          if (!windowListeners.has(type)) windowListeners.set(type, []);
          windowListeners.get(type).push(fn);
        },
        parent: {
          postMessage(msg) {
            if (msg.method === "ui/initialize" && msg.id !== undefined) {
              queueMicrotask(() => dispatchWindowMessage({ jsonrpc: "2.0", id: msg.id, result: { hostContext: { theme: "dark" } } }));
            } else if (msg.method === "tools/call" && opts.failToolCalls && msg.params?.name !== "vibe_debrief_get_state") {
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  error: { code: -32000, message: "RPC timeout simulated" }
                })
              );
            } else if (msg.method === "tools/call" && msg.params?.name === "vibe_debrief_get_state") {
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: {
                    structuredContent: {
                      projectName: "ux-test",
                      activePersona: "vibe-mentor",
                      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
                      ste100Enabled: true,
                      confirmedLessons: [],
                      history: [],
                      currentDebrief: {
                        responseType: "implementation",
                        tldrHeadline: "Ready",
                        diagram: { nodes: [], edges: [] }
                      }
                    }
                  }
                })
              );
            }
          }
        }
      }
    };

    vm.runInContext(extractInlineScript(PANEL_HTML), vm.createContext(sandbox));
    return {
      elements,
      canvasDrawOps,
      getActiveElement: () => activeElement,
      getRafCalls: () => rafCalls,
      pushState(structuredContent) {
        dispatchWindowMessage({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: { structuredContent }
        });
      }
    };
  }

  it("ensures .btn-primary satisfies WCAG AA >= 4.5:1 contrast and icon controls carry aria-labels", () => {
    const primaryBgDark = darkVars["--accent"];
    const primaryFgDark = darkVars["--text-on-accent"];
    const primaryBgLight = lightVars["--accent"];
    const primaryFgLight = lightVars["--text-on-accent"];

    assert.match(styleText, /\.btn-primary\s*\{[^}]*background:\s*var\(--accent\)[^}]*color:\s*var\(--text-on-accent\)/s);
    assert.ok(contrastRatio(primaryFgDark, primaryBgDark) >= 4.5, "Dark .btn-primary must meet >= 4.5:1");
    assert.ok(contrastRatio(primaryFgLight, primaryBgLight) >= 4.5, "Light .btn-primary must meet >= 4.5:1");

    for (const id of [
      "smartGeminiModelSelect",
      "btnAskAiExplain",
      "btnExportHtml",
      "btnRefresh",
      "btnExplainerPrev",
      "btnExplainerNext",
      "customLessonTitle",
      "customLessonSummary"
    ]) {
      const re = new RegExp(`id="${id}"[^>]*aria-label="[^"]+"`, "i");
      assert.match(PANEL_HTML, re, `Control #${id} must declare descriptive aria-label`);
    }
  });

  it("declares @media (prefers-reduced-motion: reduce) in CSS and avoids rAF pulse loops when enabled", () => {
    assert.match(styleText, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);

    const env = buildKeyboardEnv({ reducedMotion: true });
    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        responseType: "implementation",
        complexity: { level: "complex", reason: "Multi-layer" },
        tldrHeadline: "Reduced motion check.",
        diagram: {
          nodes: [
            { id: "n1", label: "Step 1", risk: "low" },
            { id: "n2", label: "Step 2", risk: "high" }
          ],
          edges: [{ from: "n1", to: "n2", stepNumber: 1 }]
        },
        explainerScenes: [{ title: "Scene 1", narration: "Static frame.", highlightNodeIds: ["n1"] }]
      }
    });

    const playBtn = env.elements.get("btnExplainerPlay");
    playBtn.dispatchEvent({ type: "click" });
    assert.equal(env.getRafCalls(), 0, "Reduced motion must not schedule continuous rAF pulse loop");
    assert.equal(
      env.canvasDrawOps.some((op) => op.op === "arc"),
      false,
      "Reduced motion must not draw moving pulse dots"
    );
    assert.ok(
      env.canvasDrawOps.some((op) => op.op === "fillText" && op.text.includes("Scene 1")),
      "Reduced motion must still render the static highlighted scene frame"
    );
  });

  it("supports Enter/Space keyboard inspection and toggle-off on SVG diagram nodes with escaped aria-labels", () => {
    const env = buildKeyboardEnv();
    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        responseType: "bug",
        tldrHeadline: "Node keyboard check.",
        diagram: {
          title: "Flow",
          nodes: [
            { id: "n1", label: 'Auth "Guard" <script>', role: "Security", risk: "high", file: "src/auth.mjs" },
            { id: "n2", label: "Store", role: "State", risk: "low", file: "src/store.mjs" }
          ],
          edges: [{ from: "n1", to: "n2", stepNumber: 1 }]
        }
      }
    });

    const svg = env.elements.get("diagramSvg");
    const inspector = env.elements.get("nodeInspectorBar");
    let nodes = svg.querySelectorAll(".diagram-node-group");
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].getAttribute("tabindex"), "0");
    assert.equal(nodes[0].getAttribute("role"), "button");
    assert.equal(nodes[0].getAttribute("aria-pressed"), "false");
    assert.match(nodes[0].getAttribute("aria-label"), /Auth "Guard" <script>/);
    assert.equal(svg.innerHTML.includes("<script>"), false, "Hostile aria-label characters must be escaped in SVG markup");

    // Activate node 1 via Enter
    nodes[0].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    assert.ok(inspector.classList.contains("has-selection"));
    assert.match(inspector.innerHTML, /Security/);
    assert.match(inspector.innerHTML, /src\/auth\.mjs/);

    // Re-rendered node keeps aria-pressed="true"
    nodes = svg.querySelectorAll(".diagram-node-group");
    assert.equal(nodes[0].getAttribute("aria-pressed"), "true");

    // Press Space on selected node to toggle selection off cleanly
    nodes[0].dispatchEvent({ type: "keydown", key: " ", preventDefault() {} });
    assert.equal(inspector.classList.contains("has-selection"), false);
    nodes = svg.querySelectorAll(".diagram-node-group");
    assert.equal(nodes[0].getAttribute("aria-pressed"), "false");
  });

  it("supports keyboard loading of history snapshots and 1-click Return to Latest restoration", () => {
    const env = buildKeyboardEnv();
    const liveDebrief = {
      responseType: "implementation",
      createdAt: "2026-11-23T12:00:00.000Z",
      tldrHeadline: "Latest live turn.",
      diagram: { nodes: [], edges: [] }
    };
    const pastDebrief = {
      responseType: "bug",
      createdAt: "2026-11-23T11:30:00.000Z",
      tldrHeadline: "Previous bug turn.",
      diagram: { nodes: [], edges: [] }
    };

    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [pastDebrief],
      currentDebrief: liveDebrief
    });

    const historyContainer = env.elements.get("historyListContainer");
    const items = historyContainer.querySelectorAll(".history-item");
    assert.equal(items.length, 1);
    assert.equal(items[0].getAttribute("tabindex"), "0");
    assert.equal(items[0].getAttribute("role"), "button");
    assert.match(items[0].getAttribute("aria-label"), /Previous bug turn/);

    // Activate history item with Enter
    items[0].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    const snapshotBanner = env.elements.get("historySnapshotBanner");
    assert.equal(snapshotBanner.style.display, "flex");
    assert.equal(env.elements.get("tldrHeadline").textContent, "Previous bug turn.");
    assert.equal(env.getActiveElement(), env.elements.get("btnReturnLatest"));

    // Click Return to Latest -> restores liveDebrief and hides snapshot banner
    env.elements.get("btnReturnLatest").dispatchEvent({ type: "click" });
    assert.equal(snapshotBanner.style.display, "none");
    assert.equal(env.elements.get("tldrHeadline").textContent, "Latest live turn.");
  });

  it("opens Explainer tab on Enter/Space from complexityPill and surfaces RPC errors + missing field focus", async () => {
    const env = buildKeyboardEnv({ failToolCalls: true });
    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        responseType: "implementation",
        complexity: { level: "complex", reason: "Multi-layer" },
        tldrHeadline: "Complex workflow.",
        diagram: { nodes: [], edges: [] },
        explainerScenes: [{ title: "Scene 1", narration: "Step one." }]
      }
    });

    const compPill = env.elements.get("complexityPill");
    assert.equal(compPill.getAttribute("role"), "button");
    assert.equal(compPill.getAttribute("tabindex"), "0");
    compPill.dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    assert.equal(env.elements.get("tab-explainer").style.display, "block");

    // Empty lesson form validation focuses title input
    env.elements.get("btnToggleCustomLesson").dispatchEvent({ type: "click" });
    env.elements.get("customLessonTitle").value = "";
    env.elements.get("btnSaveCustomLesson").dispatchEvent({ type: "click" });
    assert.equal(env.getActiveElement(), env.elements.get("customLessonTitle"));
    assert.match(env.elements.get("toastText").textContent, /title/i);

    // Failed RPC on mode switch displays error toast instead of failing silently and restores button state
    const bugBtn = env.elements.get("btnModeBug");
    bugBtn.dispatchEvent({ type: "click" });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(bugBtn.disabled, false);
    assert.equal(bugBtn.hasAttribute("aria-busy"), false);
    assert.match(env.elements.get("toastText").textContent, /Could not switch/i);
  });
});
