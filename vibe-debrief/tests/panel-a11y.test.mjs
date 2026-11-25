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

/**
 * Story 6.3 — read one representation out of a pre-bound dual-coded element.
 * The panel renders `<span class="xray-dual"><span class="xray-plain">…</span>
 * <span class="xray-tech">…</span></span>` once, then swaps with CSS. The Tech
 * span may nest `<span class="sym">` badges, so the closing tag is found by
 * balancing span depth instead of a non-greedy regex.
 */
function readXrayRepresentation(html, kind) {
  const text = String(html ?? "");
  const startTag = `<span class="xray-${kind}">`;
  const start = text.indexOf(startTag);
  if (start === -1) return null;
  const from = start + startTag.length;
  const tagRe = /<span\b[^>]*>|<\/span>/g;
  tagRe.lastIndex = from;
  let depth = 1;
  let match;
  while ((match = tagRe.exec(text))) {
    if (match[0] === "</span>") {
      depth -= 1;
      if (depth === 0) return text.slice(from, match.index);
    } else {
      depth += 1;
    }
  }
  return null;
}

function stripXrayTags(html) {
  return String(html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

describe("Story 4.1 & 6.1 — Panel ARIA landmarks, live regions & static markup", () => {
  it("declares landmark role='banner' on top-bar hud-header", () => {
    assert.match(
      PANEL_HTML,
      /<header[^>]*class="[^"]*top-bar[^"]*hud-header[^"]*"[^>]*role="banner"/,
      "Header must declare role='banner' landmark"
    );
  });

  it("declares role='tablist' with descriptive aria-label on 3-segment view-switcher", () => {
    assert.match(
      PANEL_HTML,
      /<nav[^>]*class="[^"]*view-switcher[^"]*"[^>]*id="tabsNav"[^>]*role="tablist"[^>]*aria-label="[^"]+"/i,
      "tabsNav must declare view-switcher class and role='tablist' with aria-label"
    );
  });

  it("declares role='tab', aria-selected, aria-controls, and roving tabindex on all 3 view-switcher tabs", () => {
    const tabExpectations = [
      { id: "tabBtnHud", tab: "hud", selected: "true", tabindex: "0", controls: "tab-hud" },
      { id: "tabBtnVisual", tab: "visual", selected: "false", tabindex: "-1", controls: "tab-visual" },
      { id: "tabBtnMemory", tab: "memory", selected: "false", tabindex: "-1", controls: "tab-memory" }
    ];

    for (const exp of tabExpectations) {
      const regex = new RegExp(
        `<button[^>]*id="${exp.id}"[^>]*role="tab"[^>]*aria-selected="${exp.selected}"[^>]*aria-controls="${exp.controls}"[^>]*tabindex="${exp.tabindex}"[^>]*data-tab="${exp.tab}"`,
        "i"
      );
      assert.match(PANEL_HTML, regex, `Tab button ${exp.id} must declare complete tab semantics`);
    }
  });

  it("declares role='tabpanel', tabindex='0', and aria-labelledby on all 3 tab sections", () => {
    const panelExpectations = [
      { id: "tab-hud", labelledby: "tabBtnHud" },
      { id: "tab-visual", labelledby: "tabBtnVisual" },
      { id: "tab-memory", labelledby: "tabBtnMemory" }
    ];

    for (const exp of panelExpectations) {
      const regex = new RegExp(
        `<section[^>]*id="${exp.id}"[^>]*role="tabpanel"[^>]*aria-labelledby="${exp.labelledby}"[^>]*tabindex="0"`,
        "i"
      );
      assert.match(PANEL_HTML, regex, `Section ${exp.id} must declare role='tabpanel' and aria-labelledby`);
    }
  });

  it("declares polite live regions with role='status' and aria-live='polite' on toast, waiting badge, and inspector", () => {
    assert.match(
      PANEL_HTML,
      /<div[^>]*id="toastBanner"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/,
      "toastBanner must declare role='status', aria-live='polite', aria-atomic='true'"
    );

    assert.match(
      PANEL_HTML,
      /<span[^>]*id="waitingBadge"[^>]*role="status"[^>]*aria-live="polite"/,
      "waitingBadge must declare role='status' and aria-live='polite'"
    );

    assert.match(
      PANEL_HTML,
      /<div[^>]*id="nodeInspectorBar"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/,
      "nodeInspectorBar must declare role='status', aria-live='polite', aria-atomic='true'"
    );
  });

  it("declares aria-pressed on toggle controls, dialog aria on gear-popover, and aria-expanded on triggers", () => {
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="btnXrayToggle"[^>]*data-mode="plain"[^>]*role="button"[^>]*aria-pressed="false"/,
      "btnXrayToggle must declare role='button' and aria-pressed"
    );
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="btnGearSettings"[^>]*aria-expanded="false"[^>]*aria-controls="gearPopover"[^>]*aria-haspopup="dialog"/,
      "btnGearSettings must declare aria-expanded, aria-controls, and aria-haspopup='dialog'"
    );
    assert.match(
      PANEL_HTML,
      /<div[^>]*id="gearPopover"[^>]*role="dialog"[^>]*aria-label="Cockpit HUD Settings"[^>]*aria-hidden="true"/,
      "gearPopover must declare role='dialog' and aria-hidden"
    );
    assert.match(
      PANEL_HTML,
      /<button[^>]*id="gearSteToggleBtn"[^>]*role="button"[^>]*aria-pressed="true"/,
      "gearSteToggleBtn must declare role='button' and aria-pressed"
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

function createPanelDomEnvironment({
  reducedMotion = false,
  failToolCalls = false,
  initTheme = "dark",
  initialPersistedState = null
} = {}) {
  const elements = new Map();
  let activeElement = null;
  let rafCalls = 0;
  let speechCancels = 0;
  const outboundMessages = [];
  const toolCalls = [];
  const canvasDrawOps = [];

  let persistedSettings = {
    themePreference: initialPersistedState?.themePreference || "auto",
    language: initialPersistedState?.language || "en",
    activePersona: initialPersistedState?.activePersona || "vibe-mentor",
    ste100Enabled: initialPersistedState?.ste100Enabled !== undefined ? initialPersistedState.ste100Enabled : true,
    preferredModel: initialPersistedState?.preferredModel || "auto-cheapest"
  };

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
    const tagRe = /<(g|div|button)\s+([^>]*class="[^"]*(?:diagram-node-group|history-item|file-badge|scene-pill|action-chip|choice-item|proof-pill|btn-promote-audit|concept-pill|stage1-drawer|popout-btn|stage1-close)[^"]*"[^>]*)>/gi;
    for (const m of html.matchAll(tagRe)) {
      // Extract the id attribute if present so the element gets registered in the global map
      const idMatch = m[2].match(/\bid="([^"]+)"/);
      const childId = idMatch ? idMatch[1] : "";
      const child = makeElement(childId, m[1]);
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
      contains(target) {
        return target === el;
      },
      addEventListener(type, fn) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(fn);
      },
      dispatchEvent(event) {
        const evt = { target: el, ...event };
        const fns = this.listeners.get(evt.type) || [];
        for (const fn of fns) {
          fn.call(this, evt);
        }
        return !evt.defaultPrevented;
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

  // Scan only real DOM markup for static ids — never the inline <script>, whose
  // template literals (e.g. data-chip-id="${...}") would otherwise register phantom
  // elements and pollute global class-based querySelectorAll fallbacks.
  const panelMarkup = PANEL_HTML.replace(/<script>[\s\S]*?<\/script>/gi, "");
  const tagMatches = panelMarkup.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi);
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

  const tabIds = ["tabBtnHud", "tabBtnVisual", "tabBtnMemory"];
  const docListeners = new Map();
  const windowListeners = new Map();
  const dispatchWindowMessage = (data) => {
    for (const fn of windowListeners.get("message") || []) fn({ data });
  };

  const buildMockPayload = () => ({
    projectName: "demo-hud-app",
    activePersona: persistedSettings.activePersona,
    ste100Enabled: persistedSettings.ste100Enabled,
    language: persistedSettings.language,
    preferredModel: persistedSettings.preferredModel,
    themePreference: persistedSettings.themePreference,
    personas: [
      { id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor", tagline: "Plain clarity" },
      { id: "visual-mapper", name: "Visual Mapper", badge: "🗺️ Visual Mapper", tagline: "Diagrams first" }
    ],
    availableModels: [
      { id: "openai/gpt-5-nano", modelId: "gpt-5-nano" },
      { id: "new-provider/gemini-4-argon", modelId: "gemini-4-argon" }
    ],
    recommendedModel:
      persistedSettings.preferredModel !== "auto-cheapest"
        ? persistedSettings.preferredModel
        : "openai/gpt-5-nano",
    lightweightGeminiModels: [{ id: "new-provider/gemini-4-argon", modelId: "gemini-4-argon" }],
    recommendedGeminiModel: "new-provider/gemini-4-argon",
    confirmedLessons: [],
    zcodeMemory: { memoryDir: "~/.zcode/cli/memories", indexContent: "" },
    history: [],
    currentDebrief: initialPersistedState?.currentDebrief || {
      id: "debrief-initial",
      responseType: "implementation",
      verdict: "Built",
      tldrHeadline: "Cockpit HUD baseline ready.",
      realWorldAnalogy: "A clear flight instrument strip.",
      touchedFiles: [],
      diagram: { title: "HUD Flow", nodes: [], edges: [] },
      proofClaims: [{ claim: "Checks run cleanly.", evidence: "node --test", status: "verified" }],
      verificationChecklist: [{ id: "chk-1", text: "Inspect HUD", source: "CLI", risk: "low", checked: false }],
      waitingOnYou: { state: "none", label: "All Clear", prompt: "Ready for next prompt.", chips: [] }
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
      getElementById: (id) => elements.get(id) || makeElement(id),
      querySelectorAll(selector) {
        if (selector === ".view-tab") return tabIds.map((id) => elements.get(id));
        if (selector === ".scene-pill") {
          return Array.from(elements.values()).filter((e) => e.classList.contains("scene-pill"));
        }
        return [];
      },
      addEventListener(type, fn) {
        if (!docListeners.has(type)) docListeners.set(type, []);
        docListeners.get(type).push(fn);
      },
      get activeElement() {
        return activeElement;
      }
    },
    getComputedStyle: () => ({ display: "inline-flex", getPropertyValue: () => "" }),
    window: {
      speechSynthesis: {
        cancel() {
          speechCancels += 1;
        }
      },
      matchMedia: (q) => ({
        matches: q.includes("prefers-reduced-motion") ? Boolean(reducedMotion) : false,
        addEventListener() {},
        removeEventListener() {}
      }),
      addEventListener(type, fn) {
        if (!windowListeners.has(type)) windowListeners.set(type, []);
        windowListeners.get(type).push(fn);
      },
      dispatchEvent(event) {
        for (const fn of windowListeners.get(event.type) || []) fn(event);
        return !event.defaultPrevented;
      },
      parent: {
        postMessage(msg) {
          outboundMessages.push(msg);
          if (msg.method === "ui/initialize" && msg.id !== undefined) {
            queueMicrotask(() =>
              dispatchWindowMessage({ jsonrpc: "2.0", id: msg.id, result: { hostContext: { theme: initTheme } } })
            );
          } else if (msg.method === "ui/message" && msg.id !== undefined) {
            queueMicrotask(() => dispatchWindowMessage({ jsonrpc: "2.0", id: msg.id, result: { ok: true } }));
          } else if (msg.method === "tools/call") {
            toolCalls.push(msg.params);
            if (failToolCalls && msg.params?.name !== "vibe_debrief_get_state") {
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  error: { code: -32000, message: "RPC timeout simulated" }
                })
              );
              return;
            }
            if (msg.params?.name === "vibe_debrief_set_persona") {
              const a = msg.params.arguments || {};
              if (a.persona) persistedSettings.activePersona = a.persona;
              if (a.ste100Enabled !== undefined) persistedSettings.ste100Enabled = Boolean(a.ste100Enabled);
              if (a.language) persistedSettings.language = a.language;
              if (a.preferredModel) persistedSettings.preferredModel = a.preferredModel;
              if (a.themePreference) persistedSettings.themePreference = a.themePreference;
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: { structuredContent: buildMockPayload() }
                })
              );
            } else if (msg.params?.name === "vibe_debrief_export_html") {
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: {
                    structuredContent: {
                      ...buildMockPayload(),
                      exportedArtifact: { fileName: "vibe-debrief-test.html", filePath: "/tmp/vibe-debrief-test.html" }
                    }
                  }
                })
              );
            } else if (msg.params?.name === "vibe_debrief_get_state") {
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: { structuredContent: buildMockPayload() }
                })
              );
            } else if (msg.params?.name === "vibe_debrief_generate_explainer") {
              // Story 6.5 — Anytime Visual: on-demand tour generation returns
              // scenes for the active debrief (mirrors mcp-server behavior).
              const base = buildMockPayload();
              queueMicrotask(() =>
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: {
                    structuredContent: {
                      ...base,
                      currentDebrief: {
                        ...base.currentDebrief,
                        complexity: { level: "complex", score: 6, reason: "Generated on demand" },
                        explainerScenes: [
                          { id: "scene-1", title: "Setup", narration: "First step.", durationSec: 5, highlightNodeIds: [] },
                          { id: "scene-2", title: "Payoff", narration: "Second step.", durationSec: 5, highlightNodeIds: [] }
                        ]
                      }
                    }
                  }
                })
              );
            }
          }
        }
      }
    }
  };

  vm.runInContext(extractInlineScript(PANEL_HTML), vm.createContext(sandbox));
  return {
    sandbox,
    elements,
    documentElement,
    body,
    canvasDrawOps,
    outboundMessages,
    toolCalls,
    getPersistedSettings: () => ({ ...persistedSettings }),
    getActiveElement: () => activeElement,
    getRafCalls: () => rafCalls,
    getSpeechCancels: () => speechCancels,
    dispatchDocumentEvent: (event) => {
      for (const fn of docListeners.get(event.type) || []) fn(event);
    },
    dispatchWindowEvent: (event) => sandbox.window.dispatchEvent(event),
    dispatchWindowMessage,
    pushState(structuredContent) {
      dispatchWindowMessage({
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: { structuredContent }
      });
    },
    async flush() {
      await new Promise((r) => setTimeout(r, 15));
    }
  };
}

describe("Story 4.1 — Interactive ARIA state updates & keyboard navigation", () => {
  it("updates aria-selected, roving tabindex, and panel visibility when switchTab is invoked", () => {
    const { elements } = createPanelDomEnvironment();

    const hudBtn = elements.get("tabBtnHud");
    const memoryBtn = elements.get("tabBtnMemory");
    const hudPanel = elements.get("tab-hud");
    const memoryPanel = elements.get("tab-memory");

    assert.equal(hudBtn.getAttribute("aria-selected"), "true");
    assert.equal(hudBtn.getAttribute("tabindex"), "0");
    assert.equal(memoryBtn.getAttribute("aria-selected"), "false");
    assert.equal(memoryBtn.getAttribute("tabindex"), "-1");

    const clickListeners = memoryBtn.listeners.get("click") || [];
    assert.ok(clickListeners.length > 0, "Memory & History tab must have click listener");
    clickListeners[0]();

    assert.equal(hudBtn.getAttribute("aria-selected"), "false");
    assert.equal(hudBtn.getAttribute("tabindex"), "-1");
    assert.equal(memoryBtn.getAttribute("aria-selected"), "true");
    assert.equal(memoryBtn.getAttribute("tabindex"), "0");
    assert.equal(memoryPanel.style.display, "block");
    assert.equal(hudPanel.style.display, "none");
  });

  it("navigates 3-segment view-switcher tabs with ArrowRight, ArrowLeft, Home, and End (wrapping around)", () => {
    const { elements } = createPanelDomEnvironment();

    const tabsNav = elements.get("tabsNav");
    const keydownListeners = tabsNav.listeners.get("keydown") || [];
    assert.ok(keydownListeners.length > 0, "tabsNav must have keydown listener");
    const onKeydown = keydownListeners[0];

    const hudBtn = elements.get("tabBtnHud");
    const visualBtn = elements.get("tabBtnVisual");
    const memoryBtn = elements.get("tabBtnMemory");

    hudBtn.focus();
    let defaultPrevented = false;
    onKeydown({
      key: "ArrowRight",
      preventDefault: () => {
        defaultPrevented = true;
      }
    });

    assert.ok(defaultPrevented, "ArrowRight must preventDefault");
    assert.equal(visualBtn.getAttribute("aria-selected"), "true");
    assert.equal(visualBtn.getAttribute("tabindex"), "0");
    assert.equal(hudBtn.getAttribute("aria-selected"), "false");

    onKeydown({ key: "ArrowRight", preventDefault: () => {} });
    assert.equal(memoryBtn.getAttribute("aria-selected"), "true");

    onKeydown({ key: "ArrowRight", preventDefault: () => {} });
    assert.equal(hudBtn.getAttribute("aria-selected"), "true");

    onKeydown({ key: "ArrowLeft", preventDefault: () => {} });
    assert.equal(memoryBtn.getAttribute("aria-selected"), "true");

    onKeydown({ key: "Home", preventDefault: () => {} });
    assert.equal(hudBtn.getAttribute("aria-selected"), "true");

    onKeydown({ key: "End", preventDefault: () => {} });
    assert.equal(memoryBtn.getAttribute("aria-selected"), "true");
  });

  it("updates aria-pressed on xray-toggle and gear STE-80 toggle", () => {
    const { elements } = createPanelDomEnvironment();

    const xrayBtn = elements.get("btnXrayToggle");
    const steBtn = elements.get("gearSteToggleBtn");

    assert.equal(xrayBtn.getAttribute("aria-pressed"), "false");
    assert.equal(xrayBtn.getAttribute("data-mode"), "plain");

    xrayBtn.dispatchEvent({ type: "click" });
    assert.equal(xrayBtn.getAttribute("aria-pressed"), "true");
    assert.equal(xrayBtn.getAttribute("data-mode"), "tech");

    xrayBtn.dispatchEvent({ type: "click" });
    assert.equal(xrayBtn.getAttribute("aria-pressed"), "false");
    assert.equal(xrayBtn.getAttribute("data-mode"), "plain");

    assert.ok(steBtn.hasAttribute("aria-pressed"));
  });

  it("dismisses inline custom lesson form and restores focus on Escape key", () => {
    const { elements, getActiveElement, dispatchWindowEvent } = createPanelDomEnvironment();

    const toggleBtn = elements.get("btnToggleCustomLesson");
    const form = elements.get("customLessonForm");
    const titleInput = elements.get("customLessonTitle");

    form.style.display = "none";
    assert.equal(toggleBtn.getAttribute("aria-expanded"), "false");

    const toggleClick = toggleBtn.listeners.get("click") || [];
    assert.ok(toggleClick.length > 0, "Toggle button must have click listener");
    toggleClick[0]();

    assert.equal(form.style.display, "block");
    assert.equal(toggleBtn.getAttribute("aria-expanded"), "true");
    assert.equal(getActiveElement(), titleInput, "Focus should move to first form input on open");

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
    const { elements } = createPanelDomEnvironment();

    const playBtn = elements.get("btnExplainerPlay");
    const voiceBtn = elements.get("btnExplainerVoice");

    assert.equal(playBtn.getAttribute("aria-pressed"), "false");
    assert.equal(voiceBtn.getAttribute("aria-pressed"), "false");

    const playClick = playBtn.listeners.get("click") || [];
    assert.ok(playClick.length > 0, "Play button must have click listener");
    playClick[0]();
    assert.equal(playBtn.getAttribute("aria-pressed"), "true");

    playClick[0]();
    assert.equal(playBtn.getAttribute("aria-pressed"), "false");

    const voiceClick = voiceBtn.listeners.get("click") || [];
    assert.ok(voiceClick.length > 0, "Voice button must have click listener");
    voiceClick[0]();
    assert.equal(voiceBtn.getAttribute("aria-pressed"), "true");

    voiceClick[0]();
    assert.equal(voiceBtn.getAttribute("aria-pressed"), "false");
  });

  it("navigates explainer scene pills with ArrowRight, ArrowLeft, Home, and End", () => {
    const { elements, dispatchWindowMessage } = createPanelDomEnvironment();

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

  it("updates polite live regions on toast display and node inspector updates", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();

    const toastBanner = env.elements.get("toastBanner");
    const toastText = env.elements.get("toastText");
    const inspector = env.elements.get("nodeInspectorBar");

    assert.equal(toastBanner.getAttribute("role"), "status");
    assert.equal(toastBanner.getAttribute("aria-live"), "polite");
    assert.equal(inspector.getAttribute("role"), "status");
    assert.equal(inspector.getAttribute("aria-live"), "polite");

    const exportBtn = env.elements.get("gearExportHtmlBtn");
    await exportBtn.listeners.get("click")[0]();

    assert.ok(toastBanner.classList.contains("visible"), "Toast banner should be visible after HTML export");
    assert.ok(toastBanner.classList.contains("toast-ok"), "Successful export should use toast-ok variant");
    assert.match(toastText.textContent, /Saved vibe-debrief-test\.html/i, "Toast text should announce export in live region");
  });
});

describe("Story 4.2 & UX Ergonomics — Keyboard SVG nodes, history replay, reduced motion & contrast", () => {
  const styleText = extractStyleContent(PANEL_HTML);
  const darkVars = resolveCssAliases(parseCssBlockVars(styleText, /:root\s*\{([\s\S]*?)\}/));
  const lightVars = resolveCssAliases({
    ...darkVars,
    ...parseCssBlockVars(styleText, /body\.theme-light,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\}/)
  });

  it("ensures .btn-primary satisfies WCAG AA >= 4.5:1 contrast and interactive controls carry aria-labels", () => {
    const primaryBgDark = darkVars["--accent"];
    const primaryFgDark = darkVars["--text-on-accent"];
    const primaryBgLight = lightVars["--accent"];
    const primaryFgLight = lightVars["--text-on-accent"];

    assert.match(styleText, /\.btn-primary\s*\{[^}]*background:\s*var\(--accent\)[^}]*color:\s*var\(--text-on-accent\)/s);
    assert.ok(contrastRatio(primaryFgDark, primaryBgDark) >= 4.5, "Dark .btn-primary must meet >= 4.5:1");
    assert.ok(contrastRatio(primaryFgLight, primaryBgLight) >= 4.5, "Light .btn-primary must meet >= 4.5:1");

    for (const id of [
      "btnDistill",
      "btnXrayToggle",
      "btnGearSettings",
      "gearThemeSelect",
      "gearLanguageSelect",
      "gearPersonaSelect",
      "gearSteToggleBtn",
      "gearModelSelect",
      "gearExportHtmlBtn",
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

    const env = createPanelDomEnvironment({ reducedMotion: true });
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
    const env = createPanelDomEnvironment();
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

    nodes[0].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    assert.ok(inspector.classList.contains("has-selection"));
    assert.match(inspector.innerHTML, /Security/);
    assert.match(inspector.innerHTML, /src\/auth\.mjs/);

    nodes = svg.querySelectorAll(".diagram-node-group");
    assert.equal(nodes[0].getAttribute("aria-pressed"), "true");

    nodes[0].dispatchEvent({ type: "keydown", key: " ", preventDefault() {} });
    assert.equal(inspector.classList.contains("has-selection"), false);
    nodes = svg.querySelectorAll(".diagram-node-group");
    assert.equal(nodes[0].getAttribute("aria-pressed"), "false");
  });

  it("supports keyboard loading of history snapshots and 1-click Return to Latest restoration", () => {
    const env = createPanelDomEnvironment();
    const liveDebrief = {
      id: "turn-live",
      responseType: "implementation",
      createdAt: "2026-11-23T12:00:00.000Z",
      tldrHeadline: "Latest live turn.",
      diagram: { nodes: [], edges: [] }
    };
    const pastDebrief = {
      id: "turn-past",
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

    items[0].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    const snapshotBanner = env.elements.get("historySnapshotBanner");
    assert.equal(snapshotBanner.style.display, "flex");
    assert.equal(
      readXrayRepresentation(env.elements.get("tldrHeadline").innerHTML, "plain"),
      "Previous bug turn."
    );
    assert.equal(env.getActiveElement(), env.elements.get("btnReturnLatest"));

    env.elements.get("btnReturnLatest").dispatchEvent({ type: "click" });
    assert.equal(snapshotBanner.style.display, "none");
    assert.equal(
      readXrayRepresentation(env.elements.get("tldrHeadline").innerHTML, "plain"),
      "Latest live turn."
    );
    assert.equal(env.getActiveElement(), env.elements.get("tabBtnHud"));
  });

  it("opens Visual tab on Enter/Space from complexityPill and surfaces RPC errors + missing field focus", async () => {
    const env = createPanelDomEnvironment({ failToolCalls: true });
    await env.flush();

    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        id: "turn-complex-1",
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
    assert.equal(env.elements.get("tab-visual").style.display, "block");

    env.elements.get("btnToggleCustomLesson").dispatchEvent({ type: "click" });
    env.elements.get("customLessonTitle").value = "";
    env.elements.get("btnSaveCustomLesson").dispatchEvent({ type: "click" });
    assert.equal(env.getActiveElement(), env.elements.get("customLessonTitle"));
    assert.match(env.elements.get("toastText").textContent, /title/i);
    assert.ok(env.elements.get("toastBanner").classList.contains("toast-warn"));

    const steBtn = env.elements.get("gearSteToggleBtn");
    steBtn.dispatchEvent({ type: "click" });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(steBtn.disabled, false);
    assert.equal(steBtn.hasAttribute("aria-busy"), false);
    assert.match(env.elements.get("toastText").textContent, /Could not toggle STE-80/i);
    assert.ok(env.elements.get("toastBanner").classList.contains("toast-risk"));
  });

  it("resets stale nodeInspectorBar & file chips across turns and honors Field Desk Light button/banner contrast", () => {
    assert.match(styleText, /body\.theme-light \.btn-success[\s\S]*color:\s*var\(--text-primary\)/);
    assert.match(styleText, /body\.theme-light \.status-banner[\s\S]*color:\s*var\(--text-primary\)/);
    assert.match(styleText, /\.toast-banner\.toast-warn/);
    assert.match(styleText, /\.toast-banner\.toast-risk/);

    const env = createPanelDomEnvironment();
    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        id: "turn-1",
        responseType: "implementation",
        tldrHeadline: "Turn 1",
        touchedFiles: [{ path: "src/a.mjs", shortName: "a.mjs", role: "Logic", risk: "medium", icon: "📄" }],
        diagram: {
          title: "Flow 1",
          nodes: [{ id: "n1", label: "Node A", role: "Logic", risk: "medium", file: "src/a.mjs" }],
          edges: []
        }
      }
    });

    const svg = env.elements.get("diagramSvg");
    const inspector = env.elements.get("nodeInspectorBar");
    svg.querySelectorAll(".diagram-node-group")[0].dispatchEvent({ type: "click" });
    assert.ok(inspector.classList.contains("has-selection"));
    assert.match(inspector.innerHTML, /Node A/);

    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        id: "turn-2",
        responseType: "implementation",
        tldrHeadline: "Turn 2",
        touchedFiles: [],
        diagram: { title: "Flow 2", nodes: [], edges: [] }
      }
    });

    assert.equal(inspector.classList.contains("has-selection"), false);
    assert.equal(inspector.innerHTML.includes("Node A"), false);
    assert.equal(env.elements.get("touchedFilesStrip").innerHTML, "");

    env.elements.get("btnToggleCustomLesson").dispatchEvent({ type: "click" });
    let stopped = false;
    env.elements.get("customLessonForm").dispatchEvent({
      type: "keydown",
      key: "Escape",
      preventDefault() {},
      stopPropagation() {
        stopped = true;
      }
    });
    assert.equal(stopped, true);
    assert.equal(env.elements.get("customLessonForm").style.display, "none");
  });

  it("enforces Field Desk Light semantic wash contrast, unmatched file-chip toggle, and Visual empty-tour prompt", () => {
    for (const selector of [
      "body\\.theme-light \\.view-tab\\.active",
      "body\\.theme-light \\.pill-impl",
      "body\\.theme-light \\.pill-success",
      "body\\.theme-light \\.xray-toggle\\[data-mode=\"tech\"\\]",
      "body\\.theme-light \\.distill-btn"
    ]) {
      assert.match(styleText, new RegExp(`${selector}[\\s\\S]*color:\\s*var\\(--text-primary\\)`));
    }

    const env = createPanelDomEnvironment();
    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        id: "turn-complex",
        responseType: "implementation",
        tldrHeadline: "Complex turn",
        realWorldAnalogy: "",
        complexity: { level: "complex", reason: "Multi-layer" },
        touchedFiles: [
          { path: "src/node.mjs", shortName: "node.mjs", role: "Logic", risk: "medium", icon: "📄" },
          { path: "docs/notes.md", shortName: "notes.md", role: "Docs", risk: "low", icon: "📝" }
        ],
        diagram: {
          title: "Flow",
          nodes: [{ id: "n1", label: "Node A", role: "Logic", risk: "medium", file: "src/node.mjs" }],
          edges: []
        },
        explainerScenes: [{ title: "Scene 1", narration: "Walkthrough step." }]
      }
    });

    assert.equal(env.elements.get("analogyBox").style.display, "none");

    const svg = env.elements.get("diagramSvg");
    const strip = env.elements.get("touchedFilesStrip");
    const inspector = env.elements.get("nodeInspectorBar");
    svg.querySelectorAll(".diagram-node-group")[0].dispatchEvent({ type: "click" });
    assert.equal(svg.querySelectorAll(".diagram-node-group")[0].getAttribute("aria-pressed"), "true");

    strip.querySelectorAll(".file-badge")[1].dispatchEvent({ type: "click" });
    assert.equal(svg.querySelectorAll(".diagram-node-group")[0].getAttribute("aria-pressed"), "false");
    assert.equal(strip.querySelectorAll(".file-badge")[1].getAttribute("aria-pressed"), "true");
    assert.match(inspector.innerHTML, /docs\/notes\.md/);

    strip.querySelectorAll(".file-badge")[1].dispatchEvent({ type: "click" });
    assert.equal(strip.querySelectorAll(".file-badge")[1].getAttribute("aria-pressed"), "false");
    assert.equal(inspector.classList.contains("has-selection"), false);

    // Open Visual tab on complex turn, then push a simple turn -> Visual stays open showing empty-tour prompt
    env.elements.get("tabBtnVisual").dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("tab-visual").style.display, "block");
    assert.equal(env.elements.get("explainerStageWrap").style.display, "block");

    env.pushState({
      projectName: "ux-test",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        id: "turn-simple",
        responseType: "implementation",
        tldrHeadline: "Simple turn",
        realWorldAnalogy: "A clear sign.",
        complexity: { level: "simple", reason: "Single step" },
        touchedFiles: [],
        diagram: { title: "Simple", nodes: [], edges: [] },
        explainerScenes: []
      }
    });

    assert.equal(env.elements.get("tab-visual").style.display, "block");
    assert.equal(env.elements.get("explainerStageWrap").style.display, "none");
    assert.equal(env.elements.get("visualEmptyPrompt").style.display, "flex");
    assert.equal(env.elements.get("analogyBox").style.display, "block");
  });
});

describe("Story 6.1 — 1-strip Cockpit HUD header, gear-popover, 10s Radar & transient state", () => {
  const styleText = extractStyleContent(PANEL_HTML);

  it("renders a 1-strip hud-header without stacked mode/persona rows and declares 320px wrap guard", () => {
    assert.equal(PANEL_HTML.includes("mode-switcher-row"), false, "Stacked mode-switcher-row must be removed");
    assert.equal(PANEL_HTML.includes("persona-row"), false, "Stacked persona-row must be removed");
    assert.match(styleText, /@media\s*\(max-width:\s*340px\)/);
    assert.match(styleText, /\.gear-popover\s*\{[^}]*width:\s*235px/s);
    assert.match(PANEL_HTML, /version:\s*"0\.4\.0"/);
  });

  it("opens/closes gear-popover via button, outside click, and Escape with focus restoration", () => {
    const env = createPanelDomEnvironment();
    const gearBtn = env.elements.get("btnGearSettings");
    const popover = env.elements.get("gearPopover");

    assert.equal(gearBtn.getAttribute("aria-expanded"), "false");
    assert.equal(popover.getAttribute("aria-hidden"), "true");

    gearBtn.dispatchEvent({ type: "click" });
    assert.ok(popover.classList.contains("open"));
    assert.equal(gearBtn.getAttribute("aria-expanded"), "true");
    assert.equal(popover.getAttribute("aria-hidden"), "false");

    // Outside document click closes popover
    env.dispatchDocumentEvent({ type: "click", target: env.body });
    assert.equal(popover.classList.contains("open"), false);
    assert.equal(gearBtn.getAttribute("aria-expanded"), "false");

    // Re-open then press Escape inside popover -> closes and restores focus to gearBtn
    gearBtn.dispatchEvent({ type: "click" });
    assert.ok(popover.classList.contains("open"));
    let stopped = false;
    popover.dispatchEvent({
      type: "keydown",
      key: "Escape",
      preventDefault() {},
      stopPropagation() {
        stopped = true;
      }
    });
    assert.equal(stopped, true);
    assert.equal(popover.classList.contains("open"), false);
    assert.equal(popover.getAttribute("aria-hidden"), "true");
    assert.equal(env.getActiveElement(), gearBtn);
  });

  it("persists all 5 gear-popover settings across panel reload via vibe_debrief_set_persona", async () => {
    const env1 = createPanelDomEnvironment({ initTheme: "dark" });
    await env1.flush();

    const themeSel = env1.elements.get("gearThemeSelect");
    themeSel.value = "light";
    await themeSel.listeners.get("change")[0]({ target: themeSel });

    const langSel = env1.elements.get("gearLanguageSelect");
    langSel.value = "fr";
    await langSel.listeners.get("change")[0]({ target: langSel });

    const personaSel = env1.elements.get("gearPersonaSelect");
    personaSel.value = "visual-mapper";
    await personaSel.listeners.get("change")[0]({ target: personaSel });

    const steBtn = env1.elements.get("gearSteToggleBtn");
    await steBtn.listeners.get("click")[0]();

    const modelSel = env1.elements.get("gearModelSelect");
    modelSel.value = "openai/gpt-5-nano";
    await modelSel.listeners.get("change")[0]({ target: modelSel });

    const saved = env1.getPersistedSettings();
    assert.deepEqual(saved, {
      themePreference: "light",
      language: "fr",
      activePersona: "visual-mapper",
      ste100Enabled: false,
      preferredModel: "openai/gpt-5-nano"
    });

    // Simulate reload with persisted state while host reports dark theme -> light preference wins
    const env2 = createPanelDomEnvironment({
      initTheme: "dark",
      initialPersistedState: saved
    });
    await env2.flush();

    assert.equal(env2.body.classList.contains("theme-light"), true);
    assert.equal(env2.documentElement.getAttribute("data-theme"), "light");
    assert.equal(env2.elements.get("gearThemeSelect").value, "light");
    assert.equal(env2.elements.get("gearLanguageSelect").value, "fr");
    assert.equal(env2.elements.get("gearPersonaSelect").value, "visual-mapper");
    assert.equal(env2.elements.get("gearSteToggleBtn").getAttribute("aria-pressed"), "false");
    assert.equal(env2.elements.get("gearModelSelect").value, "openai/gpt-5-nano");
  });

  it("renders 10s radar-card (verdict, <=14-word headline, verification counts) and dispatches Distill via ui/message", async () => {
    const env = createPanelDomEnvironment({
      initialPersistedState: {
        preferredModel: "openai/gpt-5-nano",
        currentDebrief: {
          id: "debrief-radar-1",
          responseType: "bug",
          verdict: "Solved",
          tldrHeadline: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.",
          proofClaims: [
            { claim: "Unit tests pass", evidence: "node --test", status: "verified" },
            { claim: "Smoke check pending", evidence: "Not run", status: "unverified" }
          ],
          verificationChecklist: [
            { id: "c1", text: "Check logs", source: "CLI", risk: "low", checked: false }
          ],
          waitingOnYou: {
            state: "action",
            label: "Verify / Run",
            prompt: "Run smoke test now."
          },
          diagram: { nodes: [], edges: [] }
        }
      }
    });
    await env.flush();

    assert.equal(env.elements.get("radarVerdictPill").textContent, "Solved");
    // Story 6.3: both pre-bound representations must honor the <= 14-word rule.
    const headlineHtml = env.elements.get("tldrHeadline").innerHTML;
    for (const kind of ["plain", "tech"]) {
      const words = stripXrayTags(readXrayRepresentation(headlineHtml, kind)).split(/\s+/).filter(Boolean);
      assert.ok(words.length <= 14, `Radar ${kind} headline must be <= 14 words, got ${words.length}`);
    }
    assert.equal(env.elements.get("radarVerifyCount").textContent, "1 verified · 1 unverified");
    assert.equal(env.elements.get("waitingBadgeText").textContent, "Verify / Run");
    assert.ok(env.elements.get("waitingBadge").classList.contains("action"));

    const distillBtn = env.elements.get("btnDistill");
    await distillBtn.listeners.get("click")[0]();

    const uiMsg = env.outboundMessages.find((m) => m.method === "ui/message");
    assert.ok(uiMsg, "Distill must send ui/message RPC");
    assert.match(uiMsg.params.content[0].text, /\[Vibe Debrief — Deep Refresh\]/);
    assert.match(uiMsg.params.content[0].text, /openai\/gpt-5-nano/);
  });

  it("stops canvas playback and speechSynthesis when switching away from Visual, and preserves transient state on same-turn updates", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();

    const complexState = {
      projectName: "demo-hud-app",
      activePersona: "vibe-mentor",
      ste100Enabled: true,
      language: "en",
      preferredModel: "auto-cheapest",
      themePreference: "auto",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        id: "turn-same-1",
        responseType: "implementation",
        complexity: { level: "complex", reason: "Multi-layer" },
        tldrHeadline: "Same turn transient check.",
        diagram: {
          nodes: [
            { id: "n1", label: "Router", role: "API", risk: "medium", file: "src/router.mjs" }
          ],
          edges: []
        },
        explainerScenes: [{ title: "Scene 1", narration: "Walkthrough." }]
      }
    };
    env.pushState(complexState);

    // Set transient states: X-Ray -> tech, node n1 selected, gearPopover open, switch to Visual and play
    env.elements.get("btnXrayToggle").dispatchEvent({ type: "click" });
    env.elements.get("diagramSvg").querySelectorAll(".diagram-node-group")[0].dispatchEvent({ type: "click" });
    env.elements.get("btnGearSettings").dispatchEvent({ type: "click" });
    env.elements.get("tabBtnVisual").dispatchEvent({ type: "click" });
    env.elements.get("btnExplainerPlay").dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("btnExplainerPlay").getAttribute("aria-pressed"), "true");

    // Switching away from Visual stops playback and cancels speechSynthesis
    const cancelsBefore = env.getSpeechCancels();
    env.elements.get("tabBtnHud").dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("btnExplainerPlay").getAttribute("aria-pressed"), "false");
    assert.ok(env.getSpeechCancels() > cancelsBefore, "Leaving Visual must cancel speechSynthesis");

    // Re-push same turn ID -> transient UI state must be preserved
    env.pushState({ ...complexState, ste100Enabled: false });
    assert.equal(env.elements.get("btnXrayToggle").getAttribute("data-mode"), "tech");
    assert.ok(env.elements.get("nodeInspectorBar").classList.contains("has-selection"));
    assert.ok(env.elements.get("gearPopover").classList.contains("open"));
    assert.equal(env.elements.get("tab-hud").style.display, "block");
  });
});

describe("Story 6.2 — 5-state Waiting On You chips, inline reply & composable microBlocks", () => {
  const styleText = extractStyleContent(PANEL_HTML);

  async function renderDebrief(debriefOverrides) {
    const env = createPanelDomEnvironment({
      initialPersistedState: {
        currentDebrief: {
          id: "debrief-62",
          responseType: "implementation",
          verdict: "Built",
          tldrHeadline: "Hybrid turn ready.",
          diagram: { title: "Flow", nodes: [], edges: [] },
          ...debriefOverrides
        }
      }
    });
    await env.flush();
    return env;
  }

  it("declares waiting chips group, inline reply box, micro-block slots and 34x4px trade-off bars", () => {
    assert.match(PANEL_HTML, /<div[^>]*class="wait-chips"[^>]*id="waitingChipsRow"[^>]*role="group"/);
    assert.match(PANEL_HTML, /<div[^>]*class="inline-reply-box"[^>]*id="inlineReplyBox"/);
    assert.match(PANEL_HTML, /id="inlineReplyInput"/);
    assert.match(PANEL_HTML, /id="btnSendInlineReply"/);
    for (const slot of ["microBlockChoices", "microBlockProofAudit", "microBlockDiagram", "microBlockLessons", "microBlockUnclear", "microBlockConcepts"]) {
      assert.ok(PANEL_HTML.includes(`id="${slot}"`), `Missing micro-block slot ${slot}`);
    }
    assert.match(styleText, /\.tbar-track\s*\{[^}]*width:\s*34px[^}]*height:\s*4px/s);
    assert.match(styleText, /\.choice-key\s*\{[^}]*width:\s*20px[^}]*height:\s*20px/s);
    assert.equal(/onclick\s*=/.test(PANEL_HTML), false, "No inline onclick handlers (CSP unsafeEval:false)");
  });

  it("renders all 5 waiting states with correct badge, chips and inline-reply visibility", async () => {
    const cases = [
      {
        state: "choice",
        waiting: { state: "choice", label: "Pick a Choice", prompt: "Choose an option.", chips: [
          { id: "choice-A", key: "A", label: "Option A", messagePrompt: "Go A", primary: true },
          { id: "choice-B", key: "B", label: "Option B", messagePrompt: "Go B", primary: false }
        ] },
        badge: "choice", chips: 2, reply: "none"
      },
      {
        state: "action",
        waiting: { state: "action", label: "Verify / Run", prompt: "Run the test.", chips: [
          { id: "act-1", key: "1", label: "Run webhook retry test", messagePrompt: "Run the test", primary: true }
        ] },
        badge: "action", chips: 1, reply: "none"
      },
      {
        state: "reply",
        waiting: { state: "reply", label: "Answer Question", prompt: "Clarify?", allowInlineReply: true, chips: [] },
        badge: "reply", chips: 2, reply: "flex"
      },
      {
        state: "blocked",
        waiting: { state: "blocked", label: "Blocked", prompt: "Missing token.", chips: [
          { id: "act-unblock", key: "1", label: "Provide API token", messagePrompt: "Here is the token", primary: true }
        ] },
        badge: "blocked", chips: 1, reply: "none"
      },
      {
        state: "none",
        waiting: { state: "none", label: "All Clear", prompt: "Ready.", chips: [] },
        badge: "none", chips: 0, reply: "none"
      }
    ];

    for (const c of cases) {
      const env = await renderDebrief({ waitingOnYou: c.waiting });
      const badge = env.elements.get("waitingBadge");
      assert.ok(badge.classList.contains(c.badge), `State ${c.state} must apply badge class ${c.badge}`);
      assert.equal(env.elements.get("waitingBadgeText").textContent, c.waiting.label);
      const chipsRow = env.elements.get("waitingChipsRow");
      const chipEls = chipsRow.querySelectorAll(".action-chip");
      assert.equal(chipEls.length, c.chips, `State ${c.state} must render ${c.chips} chips`);
      assert.equal(chipsRow.style.display, c.chips ? "flex" : "none");
      assert.equal(env.elements.get("inlineReplyBox").style.display, c.reply, `State ${c.state} reply box display`);
    }
  });

  it("dispatches action chip via ui/message and marks .selected + aria-pressed + toast", async () => {
    const env = await renderDebrief({
      waitingOnYou: {
        state: "action", label: "Verify / Run", prompt: "Run it.",
        chips: [{ id: "act-run", key: "1", label: "Run webhook retry test", messagePrompt: "Run the webhook retry test now.", primary: true }]
      }
    });
    const chip = env.elements.get("waitingChipsRow").querySelectorAll(".action-chip")[0];
    chip.dispatchEvent({ type: "click" });
    await env.flush();

    const uiMsg = env.outboundMessages.find((m) => m.method === "ui/message");
    assert.ok(uiMsg, "Action chip must dispatch ui/message");
    assert.equal(uiMsg.params.role, "user");
    assert.equal(uiMsg.params.content[0].text, "Run the webhook retry test now.");
    assert.ok(chip.classList.contains("selected"));
    assert.equal(chip.getAttribute("aria-pressed"), "true");
    assert.match(env.elements.get("toastText").textContent, /Sent/);
  });

  it("renders choice-grid with trade-off bars and dispatches choice messagePrompt via ui/message", async () => {
    const env = await renderDebrief({
      microBlocks: ["choices", "diagram", "proof-audit", "lessons"],
      choices: [
        { id: "choice-A", key: "A", title: "Use SSE stream", plainSubtext: "Server pushes updates.", techSubtext: "EventSource API", messagePrompt: "Let's proceed with Option A: Use SSE stream", tradeOffs: [{ label: "Speed", score: 80 }, { label: "Cost", score: 40 }] },
        { id: "choice-B", key: "B", title: "Poll hourly", plainSubtext: "Simple cron.", messagePrompt: "Let's proceed with Option B: Poll hourly", tradeOffs: [] }
      ],
      waitingOnYou: { state: "choice", label: "Pick a Choice", prompt: "Choose.", chips: [] }
    });
    assert.equal(env.elements.get("microBlockChoices").style.display, "flex");
    const items = env.elements.get("choiceGrid").querySelectorAll(".choice-item");
    assert.equal(items.length, 2);
    assert.match(env.elements.get("choiceGrid").innerHTML, /tbar-fill" style="width:80%"/);
    assert.match(env.elements.get("choiceGrid").innerHTML, /tbar-fill" style="width:40%"/);

    items[0].dispatchEvent({ type: "click" });
    await env.flush();
    const uiMsg = env.outboundMessages.find((m) => m.method === "ui/message");
    assert.ok(uiMsg, "choice-item must dispatch ui/message");
    assert.equal(uiMsg.params.content[0].text, "Let's proceed with Option A: Use SSE stream");
    assert.ok(items[0].classList.contains("picked"));
    assert.equal(items[0].getAttribute("aria-pressed"), "true");
    assert.equal(env.elements.get("choicePickedPill").textContent, "Selected: A");
  });

  it("sends inline reply text via ui/message on submit and Enter, then clears the input", async () => {
    const env = await renderDebrief({
      waitingOnYou: { state: "reply", label: "Answer Question", prompt: "Clarify?", allowInlineReply: true, chips: [] }
    });
    const input = env.elements.get("inlineReplyInput");
    const sendBtn = env.elements.get("btnSendInlineReply");
    assert.equal(env.elements.get("inlineReplyBox").style.display, "flex");

    input.value = "Yes, use the cache";
    sendBtn.dispatchEvent({ type: "click" });
    await env.flush();
    let uiMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    assert.ok(uiMsg, "Inline reply submit must dispatch ui/message");
    assert.equal(uiMsg.params.content[0].text, "Yes, use the cache");
    assert.equal(input.value, "");

    input.value = "No thanks";
    input.dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    await env.flush();
    uiMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    assert.equal(uiMsg.params.content[0].text, "No thanks");
    assert.equal(input.value, "");
  });

  it("expands/collapses proof-detail from proof-pill with aria-expanded and keyboard focus parity", async () => {
    const env = await renderDebrief({
      microBlocks: ["proof-audit"],
      proofClaims: [
        { claim: "Tests pass", evidence: "node --test", detail: "assert.equal(retry(), true)", status: "verified" },
        { claim: "Smoke pending", evidence: "Not run", status: "unverified" }
      ]
    });
    const pills = env.elements.get("proofPillRow").querySelectorAll(".proof-pill");
    assert.equal(pills.length, 2);
    assert.ok(pills[0].classList.contains("ok"));
    assert.ok(pills[1].classList.contains("risk"));
    assert.equal(pills[0].getAttribute("aria-expanded"), "false");
    assert.equal(/proof-detail open/.test(env.elements.get("proofDetailList").innerHTML), false);

    pills[0].dispatchEvent({ type: "click" });
    await env.flush();
    let updated = env.elements.get("proofPillRow").querySelectorAll(".proof-pill");
    assert.equal(updated[0].getAttribute("aria-expanded"), "true");
    assert.match(env.elements.get("proofDetailList").innerHTML, /proof-detail open" id="proofDetail-0"/);
    assert.match(env.elements.get("proofDetailList").innerHTML, /assert\.equal\(retry\(\), true\)/);

    // Keyboard Enter on second pill opens it and restores focus
    updated[1].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    await env.flush();
    updated = env.elements.get("proofPillRow").querySelectorAll(".proof-pill");
    assert.equal(updated[1].getAttribute("aria-expanded"), "true");
    assert.equal(env.getActiveElement(), updated[1]);

    // Toggle first pill closed again
    updated[0].dispatchEvent({ type: "click" });
    await env.flush();
    updated = env.elements.get("proofPillRow").querySelectorAll(".proof-pill");
    assert.equal(updated[0].getAttribute("aria-expanded"), "false");
  });

  it("composes multiple micro-blocks for a hybrid turn without truncating, and honors a minimal block list", async () => {
    const hybrid = await renderDebrief({
      microBlocks: ["choices", "diagram", "proof-audit", "lessons"],
      choices: [{ id: "choice-A", key: "A", title: "Path A", messagePrompt: "Go A", tradeOffs: [] }],
      proofClaims: [{ claim: "Build passes", evidence: "node --check", status: "verified" }],
      lessonsLearned: [{ id: "l1", title: "Guard tokens", summary: "Check before use.", confirmed: false }],
      diagram: { title: "Hybrid", nodes: [{ id: "n1", label: "Router", role: "API", risk: "low" }], edges: [] },
      waitingOnYou: { state: "choice", label: "Pick a Choice", prompt: "Choose.", chips: [] }
    });
    assert.equal(hybrid.elements.get("microBlockChoices").style.display, "flex");
    assert.equal(hybrid.elements.get("microBlockDiagram").style.display, "block");
    assert.equal(hybrid.elements.get("microBlockProofAudit").style.display, "flex");
    assert.equal(hybrid.elements.get("microBlockLessons").style.display, "block");
    assert.ok(hybrid.elements.get("choiceGrid").querySelectorAll(".choice-item").length >= 1);
    assert.ok(hybrid.elements.get("proofPillRow").querySelectorAll(".proof-pill").length >= 1);
    assert.equal(hybrid.elements.get("implStoryboardSection").style.display, "block");

    const minimal = await renderDebrief({
      microBlocks: ["diagram"],
      choices: [{ id: "choice-A", key: "A", title: "Path A", messagePrompt: "Go A", tradeOffs: [] }],
      proofClaims: [{ claim: "Build passes", evidence: "node --check", status: "verified" }],
      lessonsLearned: [{ id: "l1", title: "Guard tokens", summary: "Check.", confirmed: false }]
    });
    assert.equal(minimal.elements.get("microBlockDiagram").style.display, "block");
    assert.equal(minimal.elements.get("microBlockChoices").style.display, "none");
    assert.equal(minimal.elements.get("microBlockProofAudit").style.display, "none");
    assert.equal(minimal.elements.get("microBlockLessons").style.display, "none");
    assert.equal(minimal.elements.get("implStoryboardSection").style.display, "none");
  });

  it("promotes an audit-row to a prefilled lesson-form under the proof-audit block", async () => {
    const env = await renderDebrief({
      microBlocks: ["proof-audit"],
      uncertaintyAudit: [{ area: "Atomic writes", reason: "Missing temp-rename.", riskLevel: "high" }]
    });
    const promoteBtn = env.elements.get("implOversightBlock").querySelectorAll(".btn-promote-audit")[0];
    assert.ok(promoteBtn, "audit-row must expose a 💡→Rule promote button");
    promoteBtn.dispatchEvent({ type: "click" });
    await env.flush();
    assert.equal(env.elements.get("customLessonTitle").value, "Double-check Atomic writes");
    assert.equal(env.elements.get("customLessonSummary").value, "Missing temp-rename.");
    assert.equal(env.elements.get("customLessonForm").style.display, "block");
  });

  it("escapes dynamic chip and choice labels (no raw HTML injection)", async () => {
    const env = await renderDebrief({
      microBlocks: ["choices"],
      choices: [{ id: "choice-X", key: "X", title: '<img src=x onerror=alert(1)>', plainSubtext: '<script>alert(2)</script>', messagePrompt: "Go X", tradeOffs: [] }],
      waitingOnYou: { state: "choice", label: "Pick", prompt: "Choose.", chips: [
        { id: "chip-X", key: "X", label: '<svg onload=alert(3)>', messagePrompt: "Go X", primary: true }
      ] }
    });
    const choiceHtml = env.elements.get("choiceGrid").innerHTML;
    const chipHtml = env.elements.get("waitingChipsRow").innerHTML;
    assert.equal(choiceHtml.includes("<img"), false);
    assert.equal(choiceHtml.includes("<script>"), false);
    assert.match(choiceHtml, /&lt;img/);
    assert.equal(chipHtml.includes("<svg"), false);
    assert.match(chipHtml, /&lt;svg/);
  });
});

describe("Story 6.3 — Client-side X-Ray Plain (STE-80) <-> Tech instant toggle", () => {
  const styleText = extractStyleContent(PANEL_HTML);

  const XRAY_PAYLOAD = {
    plain: { headline: "Guard the retry path." },
    tech: {
      headline: "Guard retryWebhook in src/webhook.mjs",
      symbols: ["retryWebhook"],
      paths: ["src/webhook.mjs"],
      commands: ["node --test tests/webhook.test.mjs"],
      exitCodes: [0],
      proofLines: ["retryWebhook returns 200 after 3 tries (node --test tests/webhook.test.mjs)"]
    }
  };

  async function renderXrayDebrief(debriefOverrides = {}) {
    const env = createPanelDomEnvironment({
      initialPersistedState: {
        currentDebrief: {
          id: "debrief-63",
          responseType: "implementation",
          verdict: "Built",
          tldrHeadline: "Guard the retry path.",
          xray: XRAY_PAYLOAD,
          touchedFiles: [
            { path: "src/webhook.mjs", shortName: "webhook.mjs", role: "HTTP", risk: "medium", icon: "📄" }
          ],
          proofClaims: [
            {
              claim: "Retry test passes",
              evidence: "node --test tests/webhook.test.mjs",
              detail: "assert.equal(attempts, 3)",
              status: "verified"
            }
          ],
          choices: [
            {
              id: "choice-A",
              key: "A",
              title: "Keep the retry loop",
              plainSubtext: "The agent tries again on failure.",
              techSubtext: "retryWebhook maxAttempts=3",
              messagePrompt: "Keep the retry loop",
              tradeOffs: []
            }
          ],
          waitingOnYou: {
            state: "action",
            label: "Verify / Run",
            prompt: "Run the retry test.",
            techPrompt: "Run node --test tests/webhook.test.mjs (exit 0)",
            chips: [
              {
                id: "chip-1",
                key: "1",
                label: "Run the retry test",
                techLabel: "node --test tests/webhook.test.mjs",
                messagePrompt: "Run the retry test now.",
                primary: true
              }
            ]
          },
          diagram: { title: "Flow", nodes: [], edges: [] },
          ...debriefOverrides
        }
      }
    });
    await env.flush();
    return env;
  }

  it("declares the CSS-only swap contract on a CSP-safe dual-coded shell", () => {
    assert.match(PANEL_HTML, /<div class="app-shell" id="appShell" data-xray-mode="plain">/);
    assert.match(
      styleText,
      /\.xray-dual > \.xray-tech\s*\{[^}]*display:\s*none/s,
      "Tech representation must be hidden in Plain mode"
    );
    assert.match(
      styleText,
      /\.app-shell\[data-xray-mode="tech"\] \.xray-dual > \.xray-plain\s*\{[^}]*display:\s*none/s,
      "Plain representation must be hidden in Tech mode"
    );
    assert.match(
      styleText,
      /\.app-shell\[data-xray-mode="tech"\] \.xray-dual > \.xray-tech\s*\{[^}]*display:\s*inline/s,
      "Tech representation must render in Tech mode"
    );
    assert.match(styleText, /\.sym\s*\{[^}]*font-family:\s*var\(--font-mono\)[^}]*\}/s);
    assert.equal(/onclick\s*=/.test(PANEL_HTML), false, "No inline onclick handlers (CSP unsafeEval:false)");
    assert.equal(
      /new Function|eval\(/.test(extractInlineScript(PANEL_HTML)),
      false,
      "X-Ray helpers must stay CSP-safe (no eval / new Function)"
    );
  });

  it("pre-binds Plain and Tech for headline, prompt, chips, choices and proof lines", async () => {
    const env = await renderXrayDebrief();

    const headlineHtml = env.elements.get("tldrHeadline").innerHTML;
    assert.equal(readXrayRepresentation(headlineHtml, "plain"), "Guard the retry path.");
    const headlineTech = readXrayRepresentation(headlineHtml, "tech");
    assert.match(headlineTech, /<span class="sym">retryWebhook<\/span>/);
    assert.match(headlineTech, /<span class="sym">src\/webhook\.mjs<\/span>/);

    const promptHtml = env.elements.get("waitingPromptText").innerHTML;
    assert.equal(readXrayRepresentation(promptHtml, "plain"), "Run the retry test.");
    assert.match(
      readXrayRepresentation(promptHtml, "tech"),
      /<span class="sym">node --test tests\/webhook\.test\.mjs<\/span>/
    );

    const chipsHtml = env.elements.get("waitingChipsRow").innerHTML;
    assert.equal(readXrayRepresentation(chipsHtml, "plain"), "Run the retry test");
    assert.match(
      readXrayRepresentation(chipsHtml, "tech"),
      /<span class="sym">node --test tests\/webhook\.test\.mjs<\/span>/
    );

    const choicesHtml = env.elements.get("choiceGrid").innerHTML;
    assert.equal(readXrayRepresentation(choicesHtml, "plain"), "Keep the retry loop");
    const subHtml = choicesHtml.slice(choicesHtml.indexOf('class="xray-dual choice-sub"'));
    assert.equal(readXrayRepresentation(subHtml, "plain"), "The agent tries again on failure.");
    assert.match(
      readXrayRepresentation(subHtml, "tech"),
      /<span class="sym">retryWebhook<\/span> maxAttempts=3/
    );

    const pillsHtml = env.elements.get("proofPillRow").innerHTML;
    assert.equal(readXrayRepresentation(pillsHtml, "plain"), "Retry test passes");
    assert.match(
      readXrayRepresentation(pillsHtml, "tech"),
      /<span class="sym">retryWebhook<\/span> returns 200 after 3 tries/
    );

    const detailHtml = env.elements.get("proofDetailList").innerHTML;
    assert.match(readXrayRepresentation(detailHtml, "plain"), /assert\.equal\(attempts, 3\)/);
    assert.equal(
      readXrayRepresentation(detailHtml, "plain"),
      "assert.equal(attempts, 3)",
      "Plain proof detail must stay free of technical evidence"
    );
    assert.match(
      readXrayRepresentation(detailHtml, "tech"),
      /assert\.equal\(attempts, 3\) · <span class="sym">node --test tests\/webhook\.test\.mjs<\/span>/
    );
  });

  it("escapes raw X-Ray text before wrapping .sym badges (C8)", async () => {
    const HOSTILE_TEXT = `<img src=x onerror="alert('plain')">`;
    const HOSTILE_TOKEN = `</span><script>alert('tech')</script>`;
    const env = await renderXrayDebrief({
      xray: {
        plain: { headline: `Plain ${HOSTILE_TEXT}` },
        tech: {
          headline: `Tech ${HOSTILE_TOKEN} src/webhook.mjs`,
          symbols: [HOSTILE_TOKEN],
          paths: ["src/webhook.mjs"]
        }
      },
      choices: [
        {
          id: "choice-X",
          key: "X",
          title: `<img src=x onerror="alert('choice')">`,
          plainSubtext: "",
          techSubtext: HOSTILE_TOKEN,
          messagePrompt: "Go X",
          tradeOffs: []
        }
      ],
      waitingOnYou: {
        state: "action",
        label: "Verify / Run",
        prompt: "Run it.",
        techPrompt: `Run ${HOSTILE_TEXT}`,
        chips: [
          {
            id: "chip-X",
            key: "X",
            label: `<svg onload="alert('chip')">`,
            techLabel: HOSTILE_TOKEN,
            messagePrompt: "Go X",
            primary: true
          }
        ]
      },
      proofClaims: [
        {
          claim: `<img src=x onerror="alert('claim')">`,
          evidence: `node --test ${HOSTILE_TOKEN}`,
          detail: HOSTILE_TEXT,
          status: "verified"
        }
      ]
    });

    const surfaces = {
      headline: env.elements.get("tldrHeadline").innerHTML,
      prompt: env.elements.get("waitingPromptText").innerHTML,
      chips: env.elements.get("waitingChipsRow").innerHTML,
      choices: env.elements.get("choiceGrid").innerHTML,
      pills: env.elements.get("proofPillRow").innerHTML,
      details: env.elements.get("proofDetailList").innerHTML
    };
    for (const [name, html] of Object.entries(surfaces)) {
      assert.equal(/<img\b/i.test(html), false, `${name} leaked a raw <img> tag`);
      assert.equal(/<svg\b/i.test(html), false, `${name} leaked a raw <svg> tag`);
      assert.equal(/<script\b/i.test(html), false, `${name} leaked a raw <script> tag`);
    }

    const headlineHtml = surfaces.headline;
    assert.match(headlineHtml, /&lt;img src=x onerror=&quot;alert\('plain'\)&quot;&gt;/);
    assert.match(
      headlineHtml,
      /<span class="sym">&lt;\/span&gt;&lt;script&gt;alert\('tech'\)&lt;\/script&gt;<\/span>/,
      "Hostile token must be escaped inside the .sym badge"
    );
    assert.match(headlineHtml, /<span class="sym">src\/webhook\.mjs<\/span>/);
  });

  it("swaps Plain <-> Tech in < 16ms with zero RPC calls and no re-render", async () => {
    const env = await renderXrayDebrief();
    const shell = env.elements.get("appShell");
    const btn = env.elements.get("btnXrayToggle");
    const headline = env.elements.get("tldrHeadline");
    const htmlBefore = headline.innerHTML;
    const rpcBefore = env.outboundMessages.length;
    const toolCallsBefore = env.toolCalls.length;

    assert.equal(shell.getAttribute("data-xray-mode"), "plain");
    assert.equal(btn.getAttribute("data-mode"), "plain");

    // Warm the handler once so the measured swap is the steady-state cost.
    btn.dispatchEvent({ type: "click" });
    assert.equal(shell.getAttribute("data-xray-mode"), "tech");
    btn.dispatchEvent({ type: "click" });
    assert.equal(shell.getAttribute("data-xray-mode"), "plain");

    const startedAt = process.hrtime.bigint();
    btn.dispatchEvent({ type: "click" });
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    assert.ok(elapsedMs < 16, `X-Ray swap must stay under 16ms, took ${elapsedMs.toFixed(3)}ms`);
    assert.equal(shell.getAttribute("data-xray-mode"), "tech");
    assert.equal(btn.getAttribute("data-mode"), "tech");
    assert.equal(btn.getAttribute("aria-pressed"), "true");
    assert.match(btn.textContent, /Tech/);
    assert.equal(env.outboundMessages.length, rpcBefore, "X-Ray toggle must not send any RPC/LLM request");
    assert.equal(env.toolCalls.length, toolCallsBefore, "X-Ray toggle must not call any MCP tool");
    assert.equal(
      headline.innerHTML,
      htmlBefore,
      "Both representations stay pre-bound; the toggle must not re-render"
    );

    // A same-turn refresh keeps the active mode and re-binds both spans.
    env.pushState({
      projectName: "demo-hud-app",
      activePersona: "vibe-mentor",
      ste100Enabled: true,
      language: "en",
      preferredModel: "auto-cheapest",
      themePreference: "auto",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        id: "debrief-63",
        responseType: "implementation",
        verdict: "Built",
        tldrHeadline: "Same turn refresh keeps Tech.",
        diagram: { nodes: [], edges: [] }
      }
    });
    assert.equal(shell.getAttribute("data-xray-mode"), "tech");
    assert.equal(btn.getAttribute("data-mode"), "tech");
    const refreshed = env.elements.get("tldrHeadline").innerHTML;
    assert.match(refreshed, /class="xray-plain"/);
    assert.match(refreshed, /class="xray-tech"/);
  });
});

describe("Story 6.4 — 5-grammar inline SVG stage, kinetic dash-flow & powerup-dock", () => {
  const styleText = extractStyleContent(PANEL_HTML);
  const scriptText = extractInlineScript(PANEL_HTML);

  it("declares .dash-flow kinetic CSS, reduced-motion override, and 5-button powerup-dock", () => {
    assert.match(styleText, /\.dash-flow\s*\{[^}]*stroke-dasharray:\s*5\s+4[^}]*animation:\s*flowDash/s);
    assert.match(styleText, /@keyframes\s+flowDash/s);
    assert.match(styleText, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.dash-flow\s*\{[^}]*animation:\s*none/s);
    assert.match(PANEL_HTML, /<div[^>]*class="powerup-dock"[^>]*id="powerupDock"[^>]*role="group"/);
    for (const id of [
      "btnPowerupSvg",
      "btnPowerupExcalidraw",
      "btnPowerupVisualize",
      "btnPowerupVectorcraft",
      "btnPowerupAnimate"
    ]) {
      assert.ok(PANEL_HTML.includes(`id="${id}"`), `Missing powerup-dock button #${id}`);
    }
    assert.equal(PANEL_HTML.includes("pan-zoom") || PANEL_HTML.includes("zoomIn"), false, "Zero pan/zoom inside sidebar SVG");
    assert.equal(/onclick\s*=/.test(PANEL_HTML), false, "No inline onclick handlers (CSP unsafeEval:false)");
    assert.equal(/new Function|eval\(/.test(scriptText), false, "No dynamic eval");
  });

  it("renders all 5 diagramSpec grammars with viewBox 460, <= 6 nodes, kinetic dash-flow & lane-safe before-after", async () => {
    const grammars = [
      {
        name: "sequence",
        pill: "Sequence",
        diagramSpec: {
          grammar: "sequence",
          title: "SSE Stream Sequence",
          nodes: [
            { id: "n1", label: "HUD", role: "Client", risk: "low", status: "done" },
            { id: "n2", label: "MCP", role: "Server", risk: "medium", status: "active" },
            { id: "n3", label: "Hook", role: "Stop", risk: "low", status: "done" },
            { id: "n4", label: "Engine", role: "Core", risk: "high", status: "warning" },
            { id: "n5", label: "State", role: "Disk", risk: "low", status: "done" },
            { id: "n6", label: "Memory", role: "Rule", risk: "low", status: "done" },
            { id: "n7", label: "Overflow", role: "Extra", risk: "low", status: "done" }
          ],
          edges: [
            { from: "n1", to: "n2", stepNumber: 1, label: "Subscribe", risk: "low" },
            { from: "n2", to: "n4", stepNumber: 2, label: "Enrich", risk: "high" }
          ]
        }
      },
      {
        name: "flow-diff",
        pill: "FlowDiff",
        diagramSpec: {
          grammar: "flow-diff",
          title: "Retry Guard Diff",
          nodes: [
            { id: "n1", label: "Incoming", role: "Trigger", risk: "low", status: "done" },
            { id: "n2", label: "Guard", role: "Patch", risk: "high", status: "active" },
            { id: "n3", label: "Test", role: "Verify", risk: "low", status: "done" }
          ],
          edges: [
            { from: "n1", to: "n2", stepNumber: 1, label: "Check", risk: "high" },
            { from: "n2", to: "n3", stepNumber: 2, label: "Pass", risk: "low" }
          ]
        }
      },
      {
        name: "subway-map",
        pill: "Subway Map",
        diagramSpec: {
          grammar: "subway-map",
          title: "Layered Architecture",
          groups: [
            { id: "g-ui", label: "UI Layer", lane: "ui" },
            { id: "g-core", label: "Core Layer", lane: "core" }
          ],
          nodes: [
            { id: "n1", label: "Panel", role: "UI", lane: "ui", risk: "low", status: "done" },
            { id: "n2", label: "Server", role: "Transport", lane: "core", risk: "medium", status: "active" },
            { id: "n3", label: "Engine", role: "Store", lane: "core", risk: "low", status: "done" }
          ],
          edges: [
            { from: "n1", to: "n2", stepNumber: 1, risk: "low" },
            { from: "n2", to: "n3", stepNumber: 2, risk: "medium" }
          ]
        }
      },
      {
        name: "before-after",
        pill: "Before → After",
        diagramSpec: {
          grammar: "before-after",
          title: "Race Fix Split",
          nodes: [
            { id: "b1", label: "Hook Write", lane: "before", risk: "high", status: "warning" },
            { id: "b2", label: "Clobber", lane: "before", risk: "high", status: "warning" },
            { id: "a1", label: "Temp File", lane: "after", risk: "low", status: "done" },
            { id: "a2", label: "Atomic Rename", lane: "after", risk: "low", status: "active" }
          ],
          edges: [
            { from: "b1", to: "b2", stepNumber: 1, risk: "high" },
            { from: "b2", to: "a1", stepNumber: 2, risk: "high" },
            { from: "a1", to: "a2", stepNumber: 3, risk: "low" }
          ]
        }
      },
      {
        name: "decision-tree",
        pill: "Decision Tree",
        choices: [
          { id: "cA", key: "A", title: "SSE", messagePrompt: "Use SSE", tradeOffs: [] },
          { id: "cB", key: "B", title: "Poll", messagePrompt: "Use Poll", tradeOffs: [] }
        ],
        diagramSpec: {
          grammar: "subway-map",
          title: "Pick Transport",
          nodes: [
            { id: "r1", label: "Choose Sync", branch: "root", risk: "low", status: "active" },
            { id: "oA", label: "Option A: SSE", branch: "A", risk: "low", status: "done" },
            { id: "oB", label: "Option B: Poll", branch: "B", risk: "medium", status: "pending" }
          ],
          edges: [
            { from: "r1", to: "oA", stepNumber: 1, risk: "low" },
            { from: "r1", to: "oB", stepNumber: 2, risk: "medium" }
          ]
        }
      }
    ];

    for (const g of grammars) {
      const env = createPanelDomEnvironment({
        initialPersistedState: {
          currentDebrief: {
            id: `debrief-${g.name}`,
            responseType: "implementation",
            tldrHeadline: `Render ${g.name}.`,
            choices: g.choices || [],
            diagramSpec: g.diagramSpec,
            diagram: g.diagramSpec
          }
        }
      });
      await env.flush();

      const svg = env.elements.get("diagramSvg");
      const viewBox = svg.getAttribute("viewBox") || "";
      assert.match(viewBox, /^0 0 460 \d+$/, `${g.name} must use fixed viewBoxWidth 460`);
      assert.equal(svg.getAttribute("data-grammar"), g.name, `data-grammar must equal ${g.name}`);
      assert.equal(env.elements.get("diagramGrammarPill").textContent, g.pill);
      const renderedNodes = svg.querySelectorAll(".diagram-node-group");
      assert.ok(renderedNodes.length >= 1 && renderedNodes.length <= 6, `${g.name} must cap nodes <= 6 (got ${renderedNodes.length})`);
      assert.match(svg.innerHTML, /class="dash-flow"/, `${g.name} must render kinetic .dash-flow edges`);

      if (g.name === "before-after") {
        // Explicit cross-lane edge b2 -> a1 must be dropped: only 2 edges (b1->b2 step 1, a1->a2 step 3) render
        const edgeLines = svg.innerHTML.match(/class="dash-flow"/g) || [];
        assert.equal(edgeLines.length, 2, "before-after must never draw a cross-lane bridge between before and after");
        assert.match(svg.innerHTML, />BEFORE</);
        assert.match(svg.innerHTML, />AFTER</);
      }
    }
  });

  it("wires X-Ray dual-coding inside nodeInspectorBar & SVG nodes with C8 escaping and keyboard toggle-off", async () => {
    const HOSTILE = `<img src=x onerror="alert(1)">`;
    const env = createPanelDomEnvironment({
      initialPersistedState: {
        currentDebrief: {
          id: "debrief-64-xray",
          responseType: "bug",
          tldrHeadline: "Inspect X-Ray node.",
          xray: {
            plain: { headline: "Inspect X-Ray node." },
            tech: {
              headline: "Inspect retryWebhook in src/webhook.mjs",
              symbols: ["retryWebhook", HOSTILE],
              paths: ["src/webhook.mjs"]
            }
          },
          diagramSpec: {
            grammar: "flow-diff",
            title: "Retry Flow",
            techTitle: "retryWebhook() FlowDiff",
            nodes: [
              {
                id: "n1",
                label: "Retry Guard",
                techLabel: `retryWebhook ${HOSTILE}`,
                sublabel: "Max 3 tries",
                role: "API Guard",
                file: "src/webhook.mjs",
                risk: "high",
                status: "active"
              },
              {
                id: "n2",
                label: "Tests",
                techLabel: "tests/webhook.test.mjs",
                role: "Verify",
                file: "tests/webhook.test.mjs",
                risk: "low",
                status: "done"
              }
            ],
            edges: [{ from: "n1", to: "n2", stepNumber: 1, risk: "low" }]
          }
        }
      }
    });
    await env.flush();

    const svg = env.elements.get("diagramSvg");
    const inspector = env.elements.get("nodeInspectorBar");
    assert.equal(/<img\b/i.test(svg.innerHTML), false, "Hostile techLabel must be escaped in SVG");
    assert.match(svg.innerHTML, /class="xray-dual"/, "Node with distinct techLabel must embed dual-coded spans");

    // Keyboard Enter selects node 0 and shows dual-coded Plain + Tech (.sym) in nodeInspectorBar
    svg.querySelectorAll(".diagram-node-group")[0].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    assert.ok(inspector.classList.contains("has-selection"));
    assert.equal(/<img\b/i.test(inspector.innerHTML), false, "Hostile techLabel must be escaped in inspector");
    assert.equal(readXrayRepresentation(inspector.innerHTML, "plain"), "Retry Guard");
    const techInspector = readXrayRepresentation(inspector.innerHTML, "tech");
    assert.match(techInspector, /<span class="sym">retryWebhook<\/span>/);
    assert.match(inspector.innerHTML, /src\/webhook\.mjs/);

    // Flip X-Ray -> Tech without re-rendering SVG
    const svgBefore = svg.innerHTML;
    env.elements.get("btnXrayToggle").dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("appShell").getAttribute("data-xray-mode"), "tech");
    assert.equal(svg.innerHTML, svgBefore);

    // Keyboard Space toggles inspection off and keeps focus on the node
    const node0 = svg.querySelectorAll(".diagram-node-group")[0];
    node0.dispatchEvent({ type: "keydown", key: " ", preventDefault() {} });
    assert.equal(inspector.classList.contains("has-selection"), false);
    assert.equal(env.elements.get("appShell").getAttribute("data-xray-mode"), "tech");
  });

  it("wires powerup-dock triggers ([SVG], [Animate] with complex pulse, and installed/missing external plugins)", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();

    env.pushState({
      projectName: "demo-hud-app",
      activePersona: "vibe-mentor",
      personas: [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }],
      ste100Enabled: true,
      installedVisualPlugins: ["excalidraw"],
      confirmedLessons: [],
      history: [],
      currentDebrief: {
        id: "turn-powerup-1",
        responseType: "implementation",
        complexity: { level: "complex", reason: "Multi-layer flow" },
        tldrHeadline: "Complex powerup test.",
        diagramSpec: {
          grammar: "sequence",
          title: "Powerup Flow",
          nodes: [
            { id: "n1", label: "Step 1", role: "API", risk: "low", status: "done" },
            { id: "n2", label: "Step 2", role: "Store", risk: "medium", status: "active" }
          ],
          edges: [{ from: "n1", to: "n2", stepNumber: 1, risk: "low" }]
        },
        explainerScenes: [{ title: "Scene 1", narration: "Walkthrough." }]
      }
    });

    const animateBtn = env.elements.get("btnPowerupAnimate");
    assert.ok(animateBtn.classList.contains("complex-pulse"), "Complex turns must highlight [Animate]");

    // Clicking installed external plugin (excalidraw) sends ui/message with diagramSpec
    env.elements.get("btnPowerupExcalidraw").dispatchEvent({ type: "click" });
    await env.flush();
    const uiMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    assert.ok(uiMsg, "Installed powerup plugin must dispatch ui/message");
    assert.match(uiMsg.params.content[0].text, /excalidraw/);
    assert.match(uiMsg.params.content[0].text, /Powerup Flow/);
    assert.ok(env.elements.get("toastBanner").classList.contains("toast-ok"));

    // Clicking missing plugin (vectorcraft) warns cleanly without throwing
    env.elements.get("btnPowerupVectorcraft").dispatchEvent({ type: "click" });
    await env.flush();
    assert.ok(env.elements.get("toastBanner").classList.contains("toast-warn"));
    assert.match(env.elements.get("toastText").textContent, /not installed/i);

    // Clicking [Animate] opens Visual tab and moves focus to Play button
    animateBtn.dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("tab-visual").style.display, "block");
    assert.equal(env.getActiveElement(), env.elements.get("btnExplainerPlay"));
  });
});


describe("Story 6.5 — Anytime Visual curator tour, Minimal Mode strip & unclear-box", () => {
  const styleText = extractStyleContent(PANEL_HTML);

  const PERSONAS = [{ id: "vibe-mentor", name: "Vibe Mentor", badge: "🧑‍💻 Vibe Mentor" }];

  function trivialTurn(overrides = {}) {
    return {
      id: "turn-minimal-65",
      responseType: "implementation",
      verdict: "Built",
      tldrHeadline: "Fixed one typo in README.",
      touchedFiles: [{ path: "README.md", shortName: "README.md", role: "Docs", risk: "low", icon: "📝" }],
      complexity: { level: "simple", score: 1, reason: "Single-concept turn" },
      waitingOnYou: { state: "none", label: "All Clear", prompt: "Ready for next prompt.", chips: [] },
      choices: [],
      explainerScenes: [],
      proofClaims: [{ claim: "Spellcheck clean", evidence: "manual read", status: "verified" }],
      ...overrides
    };
  }

  function statePayload(debrief, overrides = {}) {
    return {
      projectName: "demo-hud-app",
      activePersona: "vibe-mentor",
      personas: PERSONAS,
      ste100Enabled: true,
      preferredModel: "auto-cheapest",
      availableModels: [
        { id: "openai/gpt-5-nano", modelId: "gpt-5-nano" },
        { id: "new-provider/gemini-4-argon", modelId: "gemini-4-argon" }
      ],
      recommendedModel: "openai/gpt-5-nano",
      lightweightGeminiModels: [{ id: "new-provider/gemini-4-argon", modelId: "gemini-4-argon" }],
      recommendedGeminiModel: "new-provider/gemini-4-argon",
      confirmedLessons: [],
      zcodeMemory: { memoryDir: "~/.zcode/cli/memories", indexContent: "" },
      history: [],
      currentDebrief: debrief,
      ...overrides
    };
  }

  it("declares minimal-strip + unclear-box markup, ARIA wiring, and token-only CSS", () => {
    assert.match(PANEL_HTML, /<div[^>]*class="minimal-strip"[^>]*id="minimalStrip"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.ok(PANEL_HTML.includes("Minimal Mode · Verified"), "minimal-strip must show the Minimal Mode · Verified badge");
    assert.match(PANEL_HTML, /<button[^>]*id="btnMinimalExpand"[^>]*aria-expanded="false"[^>]*aria-controls="radarCard"/);
    assert.match(PANEL_HTML, /<div[^>]*class="micro-block unclear-box"[^>]*id="microBlockUnclear"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.match(PANEL_HTML, /<pre[^>]*class="raw-quote"[^>]*id="unclearRawQuote"/);
    assert.match(PANEL_HTML, /<button[^>]*id="btnClarifyFast"[^>]*type="button"/);
    assert.ok(PANEL_HTML.includes("Clarify (Fast / Cheapest Model)"), "unclear-box must expose the Clarify CTA");
    assert.match(PANEL_HTML, /<button[^>]*id="btnShowRawReply"[^>]*aria-expanded="false"[^>]*aria-controls="unclearRawReplyBox"/);
    assert.match(PANEL_HTML, /<pre[^>]*class="raw-reply-box"[^>]*id="unclearRawReplyBox"/);

    // DESIGN.md token contract: minimal-strip (ok-border/ok-soft) & unclear-box (warn tokens)
    assert.match(styleText, /\.minimal-strip\s*\{[^}]*var\(--ok-border\)/s);
    assert.match(styleText, /\.minimal-badge\s*\{[^}]*var\(--ok-soft\)[^}]*var\(--ok\)/s);
    assert.match(styleText, /\.micro-block\.unclear-box\s*\{[^}]*var\(--warn-soft\)[^}]*var\(--warn-border\)/s);
    assert.match(styleText, /\.btn-warn\s*\{[^}]*var\(--warn\)[^}]*var\(--text-on-warn\)/s);
    assert.match(styleText, /\.raw-quote[\s\S]*?var\(--bg-elevated\)/);
    assert.equal(/onclick\s*=/.test(PANEL_HTML), false, "No inline onclick handlers (CSP unsafeEval:false)");
  });

  it("collapses a trivial high-confidence turn to minimal-strip and restores the full HUD via 1-click Expand", async () => {
    const env = createPanelDomEnvironment({
      initialPersistedState: { currentDebrief: trivialTurn() }
    });
    await env.flush();

    // Collapsed: strip visible, radar + every micro-block hidden (R5)
    assert.equal(env.elements.get("minimalStrip").style.display, "flex");
    assert.equal(env.elements.get("radarCard").style.display, "none");
    for (const slot of ["microBlockDiagram", "microBlockProofAudit", "microBlockLessons", "microBlockChoices", "microBlockUnclear", "microBlockConcepts"]) {
      assert.equal(env.elements.get(slot).style.display, "none", `${slot} must hide while collapsed`);
    }
    assert.equal(env.elements.get("implStoryboardSection").style.display, "none");
    assert.equal(env.elements.get("bugStoryboardSection").style.display, "none");

    const expandBtn = env.elements.get("btnMinimalExpand");
    assert.equal(expandBtn.textContent, "Expand");
    assert.equal(expandBtn.getAttribute("aria-expanded"), "false");

    // Strip label is dual-coded (Story 6.3 X-Ray contract) with the headline
    const labelHtml = env.elements.get("minimalStripLabel").innerHTML;
    assert.match(labelHtml, /class="xray-dual"/);
    assert.equal(readXrayRepresentation(labelHtml, "plain"), "Fixed one typo in README.");

    // 1-click Expand override reveals the full HUD without a new turn
    expandBtn.dispatchEvent({ type: "click" });
    await env.flush();
    assert.equal(env.elements.get("minimalStrip").style.display, "flex");
    assert.equal(env.elements.get("radarCard").style.display, "");
    assert.equal(env.elements.get("microBlockDiagram").style.display, "block");
    assert.equal(env.elements.get("microBlockProofAudit").style.display, "flex");
    assert.equal(env.elements.get("implStoryboardSection").style.display, "block");
    assert.equal(expandBtn.textContent, "Collapse");
    assert.equal(expandBtn.getAttribute("aria-expanded"), "true");
    assert.equal(env.getActiveElement(), env.elements.get("btnMinimalExpand"), "Focus must stay on the toggle for keyboard users");

    // Collapse back
    expandBtn.dispatchEvent({ type: "click" });
    await env.flush();
    assert.equal(env.elements.get("radarCard").style.display, "none");
    assert.equal(expandBtn.textContent, "Expand");
  });

  it("auto-triggers the Tiny-Turn gate on raw payloads and refuses collapse on risky, unverified, or low-confidence signals", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();

    // A. Raw trivial payload (no explicit minimalMode) still collapses
    env.pushState(statePayload(trivialTurn({ id: "raw-trivial", minimalMode: undefined, touchedFiles: [] })));
    await env.flush();
    assert.equal(env.elements.get("minimalStrip").style.display, "flex", "trivial raw turn must collapse");
    assert.equal(env.elements.get("radarCard").style.display, "none");

    // B. Unverified proof claim blocks the "Verified" badge (C9)
    env.pushState(statePayload(trivialTurn({
      id: "raw-unverified",
      proofClaims: [{ claim: "Tests pass", evidence: "Not run yet", status: "unverified" }]
    })));
    await env.flush();
    assert.equal(env.elements.get("minimalStrip").style.display, "none");
    assert.equal(env.elements.get("radarCard").style.display, "");

    // C. Complex score blocks collapse
    env.pushState(statePayload(trivialTurn({
      id: "raw-complex",
      complexity: { level: "complex", score: 5, reason: "Multi-layer flow" }
    })));
    await env.flush();
    assert.equal(env.elements.get("minimalStrip").style.display, "none");

    // D. Missing explicit waitingOnYou (unenriched payload) never auto-collapses
    env.pushState(statePayload(trivialTurn({ id: "raw-no-waiting", waitingOnYou: undefined })));
    await env.flush();
    assert.equal(env.elements.get("minimalStrip").style.display, "none");

    // E. Two touched files exceed the 0-1 file gate
    env.pushState(statePayload(trivialTurn({
      id: "raw-two-files",
      touchedFiles: [
        { path: "src/a.mjs", shortName: "a.mjs", role: "Logic", risk: "low" },
        { path: "src/b.mjs", shortName: "b.mjs", role: "Logic", risk: "low" }
      ]
    })));
    await env.flush();
    assert.equal(env.elements.get("minimalStrip").style.display, "none");

    // F. R6 beats an explicit minimalMode:true — low confidence never collapses
    env.pushState(statePayload(trivialTurn({
      id: "raw-lowconf-minimal",
      minimalMode: true,
      heuristicConfidence: 0.4,
      rawQuote: "Something ambiguous happened."
    })));
    await env.flush();
    assert.equal(env.elements.get("minimalStrip").style.display, "none", "confidence < 0.55 must force minimalMode off (R6)");
    assert.equal(env.elements.get("microBlockUnclear").style.display, "flex", "low confidence must surface the unclear-box");
  });

  it("keeps Visual unlocked on non-minimal turns: anytime empty prompt, Generate Quick Tour playback, and honest minimal copy", async () => {
    const simpleNonMinimal = {
      id: "turn-simple-nonminimal",
      responseType: "implementation",
      tldrHeadline: "Refactored two config helpers.",
      touchedFiles: [
        { path: "src/a.mjs", shortName: "a.mjs", role: "Logic", risk: "low" },
        { path: "src/b.mjs", shortName: "b.mjs", role: "Logic", risk: "low" }
      ],
      complexity: { level: "simple", score: 2, reason: "Focused 2-file change" },
      waitingOnYou: { state: "none", label: "All Clear", prompt: "Ready.", chips: [] },
      choices: [],
      explainerScenes: [],
      proofClaims: [{ claim: "node --check clean", evidence: "node --check", status: "verified" }]
    };

    const env = createPanelDomEnvironment({ initialPersistedState: { currentDebrief: simpleNonMinimal } });
    await env.flush();

    // Non-minimal: no strip, radar visible, Visual tab never locked (R5)
    assert.equal(env.elements.get("minimalStrip").style.display, "none");
    assert.equal(env.elements.get("radarCard").style.display, "");
    assert.equal(env.elements.get("tabBtnVisual").disabled, false);
    assert.equal(env.elements.get("btnPowerupAnimate").disabled, false);

    env.elements.get("tabBtnVisual").dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("tab-visual").style.display, "block");
    assert.equal(env.elements.get("visualEmptyPrompt").style.display, "flex");
    assert.equal(env.elements.get("explainerStageWrap").style.display, "none");
    assert.match(env.elements.get("visualEmptyTitle").textContent, /No tour generated yet/, "non-minimal empty state must not claim Minimal turn");

    // Anytime unlock: Generate Quick Tour synthesizes scenes and enables playback
    env.elements.get("btnGenerateQuickTour").dispatchEvent({ type: "click" });
    await env.flush();
    const tourCall = env.toolCalls.find((c) => c.name === "vibe_debrief_generate_explainer");
    assert.ok(tourCall, "Generate Quick Tour must call vibe_debrief_generate_explainer");
    assert.equal(env.elements.get("visualEmptyPrompt").style.display, "none");
    assert.equal(env.elements.get("explainerStageWrap").style.display, "block");
    const pills = env.elements.get("explainerScenePills").querySelectorAll(".scene-pill");
    assert.equal(pills.length, 2, "generated tour must render both scene pills");

    // Playback works (Play -> Pause state sync, then stop to keep timers quiet)
    const playBtn = env.elements.get("btnExplainerPlay");
    playBtn.dispatchEvent({ type: "click" });
    assert.equal(playBtn.getAttribute("aria-pressed"), "true");
    assert.equal(playBtn.textContent, "⏸ Pause");
    playBtn.dispatchEvent({ type: "click" });
    assert.equal(playBtn.getAttribute("aria-pressed"), "false");
    assert.equal(playBtn.textContent, "▶ Play");

    // Minimal turn copy: Visual stays accessible and says "Minimal turn"
    const minimalEnv = createPanelDomEnvironment({ initialPersistedState: { currentDebrief: trivialTurn() } });
    await minimalEnv.flush();
    assert.equal(minimalEnv.elements.get("minimalStrip").style.display, "flex");
    minimalEnv.elements.get("tabBtnVisual").dispatchEvent({ type: "click" });
    assert.equal(minimalEnv.elements.get("tab-visual").style.display, "block", "Visual is never locked, even on minimal turns");
    assert.match(minimalEnv.elements.get("visualEmptyTitle").textContent, /Minimal turn — no tour generated/);
    assert.equal(minimalEnv.elements.get("btnGenerateQuickTour").disabled, false);
  });

  it("renders unclear-box on low-confidence Stop turns: raw quote <= 280 chars as text, Show Raw Reply toggle, no fabricated claims", async () => {
    const HOSTILE = `<img src=x onerror="alert(1)">`;
    const longQuote = `${HOSTILE} ${"rambling word ".repeat(40)}`;
    assert.ok(longQuote.length > 280, "fixture quote must exceed the 280-char cap");

    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(statePayload(trivialTurn({
      id: "turn-unclear-65",
      tldrHeadline: "Unclear multi-paragraph answer.",
      minimalMode: true,
      heuristicConfidence: 0.42,
      rawQuote: longQuote,
      proofClaims: []
    }), {
      lastUserPrompt: "Explain the deploy script.",
      lastAssistantMessage: "RAW REPLY BODY — multi-paragraph unstructured answer that the heuristic parser could not map."
    }));
    await env.flush();

    // unclear-box shown INSTEAD of minimal-strip (R6)
    assert.equal(env.elements.get("microBlockUnclear").style.display, "flex");
    assert.equal(env.elements.get("minimalStrip").style.display, "none");
    assert.equal(env.elements.get("radarCard").style.display, "");
    assert.equal(env.elements.get("unclearConfidencePill").textContent, "Confidence 42%");

    // Raw quote: clamped to 280 chars and written as text (never markup)
    const quoteEl = env.elements.get("unclearRawQuote");
    assert.equal(quoteEl.style.display, "block");
    assert.equal(quoteEl.textContent.length, 280, "rawQuote must be capped at 280 chars");
    assert.ok(quoteEl.textContent.startsWith(HOSTILE), "hostile text must survive verbatim as text");
    assert.equal(quoteEl.innerHTML, "", "quote must be set via textContent, never innerHTML (C8/C1)");

    // Show Raw Reply toggle (client-side only, zero RPC)
    const rawBox = env.elements.get("unclearRawReplyBox");
    const rawBtn = env.elements.get("btnShowRawReply");
    assert.equal(rawBox.style.display, "none");
    assert.equal(rawBtn.textContent, "Show Raw Reply");
    assert.equal(rawBtn.getAttribute("aria-expanded"), "false");
    const rpcBefore = env.outboundMessages.length;

    rawBtn.dispatchEvent({ type: "click" });
    assert.equal(rawBox.style.display, "block");
    assert.equal(rawBox.textContent, "RAW REPLY BODY — multi-paragraph unstructured answer that the heuristic parser could not map.");
    assert.equal(rawBox.innerHTML, "", "raw reply must be set via textContent");
    assert.equal(rawBtn.textContent, "Hide Raw Reply");
    assert.equal(rawBtn.getAttribute("aria-expanded"), "true");
    assert.equal(env.outboundMessages.length, rpcBefore, "Show Raw Reply must not trigger any RPC");

    rawBtn.dispatchEvent({ type: "click" });
    assert.equal(rawBox.style.display, "none");
    assert.equal(rawBtn.getAttribute("aria-expanded"), "false");
  });

  it("dispatches [Vibe Debrief — Clarify] via ui/message with the dynamically resolved cheapest model", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(statePayload(trivialTurn({
      id: "turn-clarify-65",
      tldrHeadline: "Unclear multi-paragraph answer.",
      heuristicConfidence: 0.42,
      rawQuote: "The output might be fine but the parser stalled midway.",
      proofClaims: []
    }), {
      lastUserPrompt: "Explain the deploy script.",
      lastAssistantMessage: "RAW REPLY BODY that needs clarification."
    }));
    await env.flush();
    assert.equal(env.elements.get("microBlockUnclear").style.display, "flex");

    const clarifyBtn = env.elements.get("btnClarifyFast");
    clarifyBtn.dispatchEvent({ type: "click" });
    await env.flush();

    const uiMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    assert.ok(uiMsg, "Clarify must dispatch a ui/message");
    assert.equal(uiMsg.params.role, "user");
    const text = uiMsg.params.content[0].text;
    assert.match(text, /^\[Vibe Debrief — Clarify\]/);
    assert.match(text, /vibe_debrief_publish/, "Clarify must instruct the model to republish an honest debrief");
    assert.match(text, /heuristic confidence 42%/);
    assert.ok(text.includes("openai/gpt-5-nano"), "must resolve the cheapest enabled model dynamically");
    assert.equal(text.includes("gemini-4-argon"), false, "must never hardcode a single fallback model");
    assert.ok(text.includes("The output might be fine"), "delegated prompt must carry the raw quote");
    assert.ok(text.includes("RAW REPLY BODY"), "delegated prompt must carry the last AI response");
    assert.ok(env.elements.get("toastBanner").classList.contains("toast-ok"));
    assert.equal(clarifyBtn.disabled, false, "busy state must clear after dispatch");
  });

  it("surfaces the unclear-box for raw payloads via the microBlocks fallback (rawQuote without explicit microBlocks)", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(statePayload({
      id: "turn-fallback-unclear",
      responseType: "implementation",
      tldrHeadline: "Answered with a quotable caveat.",
      rawQuote: "Quoted caveat from the reply.",
      touchedFiles: [],
      waitingOnYou: { state: "none", label: "All Clear", prompt: "Ready.", chips: [] },
      proofClaims: [{ claim: "Reviewed", evidence: "self-check", status: "verified" }]
    }));
    await env.flush();

    // rawQuote alone (confidence defaults high) must still surface the unclear-box,
    // mirroring engine normalizeMicroBlocks; and the turn must not collapse.
    assert.equal(env.elements.get("microBlockUnclear").style.display, "flex");
    assert.equal(env.elements.get("minimalStrip").style.display, "none");
    assert.equal(env.elements.get("unclearRawQuote").textContent, "Quoted caveat from the reply.");
    assert.equal(env.elements.get("unclearConfidencePill").textContent, "Unclear");
  });
});

describe("Story 7.1 — Concept pills & <100ms Stage 1 inline micro-drawer tracer", () => {
  const sampleConcepts = [
    {
      slug: "sse-stream",
      label: "SSE Stream",
      techSymbol: "EventSource",
      targetPlugin: "visualize",
      stage1: {
        definition: "Server pushes live text chunks over one HTTP connection.",
        analogy: "Like a radio broadcast you tune into once.",
        microVisualSpec: { type: "loop-3node", nodes: ["Client", "Stream", "Chunk"] }
      }
    },
    {
      slug: "token-bucket",
      label: "Token Bucket",
      techSymbol: "rateLimiter.consume()",
      targetPlugin: "excalidraw",
      stage1: {
        definition: "A fixed-size bucket refills tokens at a steady rate.",
        analogy: "Like arcade coins that refill one per second.",
        microVisualSpec: { type: "pipeline-3node", nodes: ["Request", "Bucket", "Allow"] }
      }
    },
    {
      slug: "css-xray-swap",
      label: "CSS X-Ray Swap",
      techSymbol: "data-xray-mode",
      targetPlugin: "vectorcraft",
      stage1: {
        definition: "Toggle Plain and Tech spans in CSS without re-rendering.",
        analogy: "Like flipping transparent overlays on one map.",
        microVisualSpec: { type: "split-compare", nodes: ["Plain", "Tech", "Zero RPC"] }
      }
    }
  ];

  const stateWithConcepts = (concepts = sampleConcepts, overrides = {}) => ({
    activePersona: "vibe-mentor",
    language: "en",
    currentDebrief: {
      id: "turn-concepts-71",
      responseType: "implementation",
      tldrHeadline: "Added streaming rate limiter with X-Ray toggle.",
      touchedFiles: [{ path: "scripts/stream.mjs", shortName: "stream.mjs", role: "Logic", risk: "low" }],
      complexity: { level: "simple", score: 2, reason: "Focused turn" },
      waitingOnYou: { state: "none", label: "All Clear", prompt: "Ready.", chips: [] },
      proofClaims: [{ claim: "Tests pass", evidence: "node --test", status: "verified" }],
      microBlocks: ["diagram", "proof-audit", "concepts"],
      concepts,
      ...overrides
    }
  });

  it("caps concept-pills at <= 6, opens stage1-drawer in < 100ms with zero RPCs, and renders all 3 micro-visual types", async () => {
    const eightConcepts = Array.from({ length: 8 }, (_, idx) => ({
      slug: `concept-${idx + 1}`,
      label: `Concept ${idx + 1}`,
      techSymbol: `sym_${idx + 1}()`,
      targetPlugin: idx % 2 === 0 ? "visualize" : "excalidraw",
      stage1: {
        definition: `Short definition ${idx + 1}.`,
        analogy: `Analogy ${idx + 1}.`,
        microVisualSpec: {
          type: idx === 0 ? "loop-3node" : idx === 1 ? "pipeline-3node" : "split-compare",
          nodes: ["Step A", "Step B", "Step C"]
        }
      }
    }));

    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(stateWithConcepts(eightConcepts));
    await env.flush();

    const block = env.elements.get("microBlockConcepts");
    assert.equal(block.style.display, "flex");
    const pills = block.querySelectorAll(".concept-pill");
    assert.equal(pills.length, 6, "concept-pills must be capped at <= 6");
    assert.equal(pills[0].getAttribute("aria-pressed"), "false");
    assert.equal(pills[0].getAttribute("aria-expanded"), "false");
    assert.equal(block.innerHTML.includes('id="stage1Drawer"'), false);

    const rpcBefore = env.outboundMessages.length + env.toolCalls.length;
    const t0 = performance.now();
    pills[0].dispatchEvent({ type: "click" });
    const elapsedMs = performance.now() - t0;

    assert.ok(elapsedMs < 100, `stage1-drawer must open in < 100ms (took ${elapsedMs.toFixed(2)}ms)`);
    assert.equal(env.outboundMessages.length + env.toolCalls.length, rpcBefore, "opening stage1-drawer must emit zero RPCs");

    assert.ok(block.innerHTML.includes('id="stage1Drawer"'), "stage1-drawer must render inline");
    assert.ok(block.innerHTML.includes("Interactive Gen UI"), "must render target-tag label");
    assert.ok(block.innerHTML.includes("Short definition 1."), "must render STE-80 definition");
    assert.ok(block.innerHTML.includes("Analogy 1."), "must render analogy box");
    assert.ok(block.innerHTML.includes("Deep Dive &amp; Pop Out ↗"), "must render Stage 2 CTA");

    assert.ok(block.innerHTML.includes('id="stage1MicroSvg"'), "must render 104px micro-visual SVG");
    assert.ok(block.innerHTML.includes('height="104"'));
    assert.ok(block.innerHTML.includes('data-micro-type="loop-3node"'));

    // Switch to pipeline-3node and split-compare
    block.querySelectorAll(".concept-pill")[1].dispatchEvent({ type: "click" });
    assert.ok(block.innerHTML.includes('data-micro-type="pipeline-3node"'));
    block.querySelectorAll(".concept-pill")[2].dispatchEvent({ type: "click" });
    assert.ok(block.innerHTML.includes('data-micro-type="split-compare"'));
    assert.equal(env.outboundMessages.length + env.toolCalls.length, rpcBefore, "switching concept-pills must emit zero RPCs");
  });

  it("collapses stage1-drawer on re-click, close button, and Escape with focus restoration, and preserves activeConceptSlug across same-turn updates", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(stateWithConcepts());
    await env.flush();

    const block = env.elements.get("microBlockConcepts");
    const firstPill = block.querySelectorAll(".concept-pill")[0];
    firstPill.dispatchEvent({ type: "click" });
    assert.ok(block.innerHTML.includes('id="stage1Drawer"'));
    assert.equal(block.querySelectorAll(".concept-pill")[0].getAttribute("aria-expanded"), "true");

    // Same-turn re-render preserves activeConceptSlug
    env.pushState(stateWithConcepts());
    await env.flush();
    assert.ok(block.innerHTML.includes('id="stage1Drawer"'), "same-turn re-render must preserve open stage1-drawer");

    // Re-click active pill collapses cleanly and keeps keyboard focus on the pill
    block.querySelectorAll(".concept-pill")[0].dispatchEvent({ type: "click" });
    assert.equal(block.innerHTML.includes('id="stage1Drawer"'), false, "re-clicking active pill must collapse stage1-drawer");
    assert.equal(
      env.getActiveElement()?.getAttribute("data-concept-slug"),
      "sse-stream",
      "toggling a concept-pill must preserve focus on the toggled pill"
    );

    // Open again and press Escape -> collapses and restores focus to active concept-pill
    block.querySelectorAll(".concept-pill")[1].dispatchEvent({ type: "click" });
    assert.ok(block.innerHTML.includes('id="stage1Drawer"'));
    env.dispatchWindowEvent({ type: "keydown", key: "Escape", preventDefault() {} });
    assert.equal(block.innerHTML.includes('id="stage1Drawer"'), false, "Escape must collapse stage1-drawer");
    assert.equal(
      env.getActiveElement()?.getAttribute("data-concept-slug"),
      "token-bucket",
      "Escape must restore focus to the invoking concept-pill"
    );

    // New turn resets activeConceptSlug
    block.querySelectorAll(".concept-pill")[0].dispatchEvent({ type: "click" });
    assert.ok(block.innerHTML.includes('id="stage1Drawer"'));
    env.pushState(stateWithConcepts(sampleConcepts, { id: "turn-concepts-71-next" }));
    await env.flush();
    assert.equal(block.innerHTML.includes('id="stage1Drawer"'), false, "new turn must reset activeConceptSlug");
  });

  it("reveals techSymbol in X-Ray Tech mode and escapes hostile concept strings", async () => {
    const hostileConcepts = [
      {
        slug: "xss-concept",
        label: "<img src=x onerror=alert(1)>",
        techSymbol: "<script>alert(2)</script>",
        targetPlugin: "visualize",
        stage1: {
          definition: "Plain <b>def</b>.",
          analogy: "Analogy <i>safe</i>.",
          microVisualSpec: { type: "pipeline-3node", nodes: ["<A>", "<B>", "<C>"] }
        }
      }
    ];

    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(stateWithConcepts(hostileConcepts));
    await env.flush();

    const block = env.elements.get("microBlockConcepts");
    block.querySelectorAll(".concept-pill")[0].dispatchEvent({ type: "click" });

    assert.ok(block.innerHTML.includes('id="stage1Drawer"'));
    assert.equal(block.innerHTML.includes("<img src=x"), false, "label must be escaped");
    assert.equal(block.innerHTML.includes("<script>alert(2)"), false, "techSymbol must be escaped");
    assert.ok(block.innerHTML.includes("&lt;script&gt;alert(2)&lt;/script&gt;"), "escaped techSymbol must appear in X-Ray tech span");

    env.elements.get("btnXrayToggle").dispatchEvent({ type: "click" });
    assert.equal(env.elements.get("appShell").getAttribute("data-xray-mode"), "tech");
  });
});

describe("Story 7.2 — Stage 2 Pop-Out routing for installed external visual plugins", () => {
  const sampleConcepts72 = [
    {
      slug: "sse-stream",
      label: "SSE Stream",
      techSymbol: "EventSource",
      targetPlugin: "visualize",
      stage1: {
        definition: "Server pushes live text chunks over one HTTP connection.",
        analogy: "Like a radio broadcast you tune into once.",
        microVisualSpec: { type: "loop-3node", nodes: ["Client", "Stream", "Chunk"] }
      },
      stage2: {
        howItWorks: "Client opens EventSource, server keeps connection open, writes SSE frames.",
        keyTradeOff: "Simplicity vs bidirectional. SSE is simpler than WebSockets but one-directional.",
        inYourCodebase: "Look for EventSource constructor calls in frontend code."
      },
      stage2Prompt: "Diagram the SSE request lifecycle and frame dispatch."
    },
    {
      slug: "token-bucket",
      label: "Token Bucket",
      techSymbol: "rateLimiter.consume()",
      targetPlugin: "excalidraw",
      stage1: {
        definition: "A fixed-size bucket refills tokens at a steady rate.",
        analogy: "Like arcade coins that refill one per second.",
        microVisualSpec: { type: "pipeline-3node", nodes: ["Request", "Bucket", "Allow"] }
      },
      stage2: {
        howItWorks: "Tokens refill at configurable rate up to max capacity; each request consumes one.",
        keyTradeOff: "Burst tolerance vs steady rate. Large bucket allows bursts but reduces rate control.",
        inYourCodebase: "Search for leaky bucket or TokenBucket class in util/rate-limiter."
      },
      stage2Prompt: "Create an interactive simulation of token bucket refill and consumption."
    }
  ];

  function stateWithConcepts72(overrides = {}, topOverrides = {}) {
    return {
      activePersona: "vibe-mentor",
      language: "en",
      installedVisualPlugins: ["visualize", "excalidraw"],
      ...topOverrides,
      currentDebrief: {
        id: "turn-concepts-72",
        responseType: "implementation",
        tldrHeadline: "Built SSE rate limiter with token bucket.",
        diagramSpec: {
          grammar: "sequence",
          title: "SSE Rate Limit Flow",
          nodes: [
            { id: "n1", label: "Client", role: "API", risk: "low", status: "done" },
            { id: "n2", label: "SSE Server", role: "Core", risk: "medium", status: "active" },
            { id: "n3", label: "Bucket", role: "Guard", risk: "medium", status: "active" }
          ],
          edges: [
            { from: "n1", to: "n2", stepNumber: 1, label: "Connect", risk: "low" },
            { from: "n2", to: "n3", stepNumber: 2, label: "Consume", risk: "medium" }
          ]
        },
        microBlocks: ["diagram", "concepts"],
        concepts: sampleConcepts72,
        ...overrides
      }
    };
  }

  it("Deep Dive & Pop Out click emits ui/message with stage2 summary and stage2Prompt when plugin is installed", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(stateWithConcepts72());
    await env.flush();

    const block = env.elements.get("microBlockConcepts");
    assert.equal(block.style.display, "flex");

    // Click the first concept-pill to open stage1-drawer
    const pills = block.querySelectorAll(".concept-pill");
    assert.ok(pills.length >= 2);
    pills[0].dispatchEvent({ type: "click" });
    await env.flush();

    assert.ok(block.innerHTML.includes('id="stage1Drawer"'), "stage1-drawer must open");

    // Click Deep Dive & Pop Out button
    const popoutBtn = env.elements.get("btnOpenStage2");
    assert.ok(popoutBtn, "btnOpenStage2 must exist in stage1-drawer");
    assert.equal(popoutBtn.getAttribute("data-concept-slug"), "sse-stream");
    assert.equal(popoutBtn.getAttribute("data-target-plugin"), "visualize");

    popoutBtn.dispatchEvent({ type: "click" });
    await env.flush();

    // Verify ui/message was dispatched
    const uiMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    assert.ok(uiMsg, "Deep Dive & Pop Out must dispatch ui/message");
    const msgText = uiMsg.params.content[0].text;
    assert.match(msgText, /visualize/);
    assert.match(msgText, /stage2/);
    assert.match(msgText, /howItWorks/);
    assert.match(msgText, /keyTradeOff/);
    assert.match(msgText, /inYourCodebase/);
    assert.match(msgText, /stage2Prompt/);
    assert.match(msgText, /SSE Stream/);

    // Verify hud-toast confirmation
    assert.ok(env.elements.get("toastBanner").classList.contains("toast-ok"), "hud-toast must show ok confirmation");
    assert.match(env.elements.get("toastText").textContent, /Sent to/);
  });

  it("resolves concept stage2 data correctly when routing from stage1-drawer vs null for powerup-dock", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(stateWithConcepts72());
    await env.flush();

    const block = env.elements.get("microBlockConcepts");

    // Test: concept-specific routing (from stage1-drawer)
    const pills = block.querySelectorAll(".concept-pill");
    pills[1].dispatchEvent({ type: "click" }); // token-bucket -> targetPlugin: excalidraw
    await env.flush();

    const popoutBtn = env.elements.get("btnOpenStage2");
    popoutBtn.dispatchEvent({ type: "click" });
    await env.flush();

    const conceptMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    assert.match(conceptMsg.params.content[0].text, /excalidraw/);
    assert.match(conceptMsg.params.content[0].text, /Token Bucket/);
    // Must contain enriched stage2 from the concept
    assert.match(conceptMsg.params.content[0].text, /Burst tolerance/);

    // Test: powerup-dock click (conceptSlug: null — diagram-only routing)
    env.outboundMessages.length = 0;
    env.elements.get("btnPowerupExcalidraw").dispatchEvent({ type: "click" });
    await env.flush();

    const dockMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    assert.ok(dockMsg, "powerup-dock click must dispatch ui/message");
    assert.match(dockMsg.params.content[0].text, /excalidraw/);
    assert.match(dockMsg.params.content[0].text, /SSE Rate Limit Flow/);
    // Powerup-dock click should NOT include stage2 from concepts (conceptSlug is null)
  });

  it("shows warning toast when Deep Dive & Pop Out targets an uninstalled plugin", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(stateWithConcepts72({}, { installedVisualPlugins: [] }));
    await env.flush();

    const block = env.elements.get("microBlockConcepts");
    block.querySelectorAll(".concept-pill")[0].dispatchEvent({ type: "click" });
    await env.flush();

    // Verify no ui/message was dispatched before clicking popout
    const msgCountBefore = env.outboundMessages.filter((m) => m.method === "ui/message").length;

    const popoutBtn = env.elements.get("btnOpenStage2");
    popoutBtn.dispatchEvent({ type: "click" });
    await env.flush();

    // Must show warn toast, not ok toast
    assert.ok(env.elements.get("toastBanner").classList.contains("toast-warn"), "uninstalled plugin must show warn toast");
    assert.match(env.elements.get("toastText").textContent, /not installed/i);

    // Must NOT dispatch ui/message (plugin is not installed)
    const msgsAfter = env.outboundMessages.filter((m) => m.method === "ui/message");
    assert.equal(msgsAfter.length, msgCountBefore, "uninstalled plugin must not dispatch ui/message");
  });

  it("ui/message payload includes structured JSON with diagramSpec, stage2, and conceptSlug for installed plugins", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(stateWithConcepts72());
    await env.flush();

    const block = env.elements.get("microBlockConcepts");
    block.querySelectorAll(".concept-pill")[0].dispatchEvent({ type: "click" });
    await env.flush();

    env.elements.get("btnOpenStage2").dispatchEvent({ type: "click" });
    await env.flush();

    const msg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    const text = msg.params.content[0].text;

    // Extract the JSON payload from the message
    const jsonMatch = text.match(/\{[\s\S]*"source":\s*"vibe-debrief-stage2-popout"[\s\S]*\}/);
    assert.ok(jsonMatch, "must contain structured JSON payload with source marker");
    const payload = JSON.parse(jsonMatch[0]);

    assert.equal(payload.source, "vibe-debrief-stage2-popout");
    assert.equal(payload.targetPlugin, "visualize");
    assert.equal(payload.conceptSlug, "sse-stream");
    assert.ok(payload.diagramSpec, "must include diagramSpec");
    assert.ok(payload.diagramSpec.nodes.length <= 6);
    assert.ok(payload.stage2, "must include stage2 data");
    assert.equal(payload.stage2.howItWorks, sampleConcepts72[0].stage2.howItWorks);
    assert.equal(payload.stage2.keyTradeOff, sampleConcepts72[0].stage2.keyTradeOff);
    assert.equal(payload.stage2.inYourCodebase, sampleConcepts72[0].stage2.inYourCodebase);
    assert.equal(payload.stage2Prompt, sampleConcepts72[0].stage2Prompt);
  });
});

describe("Story 7.3 — mandatory Stage 2 HTML fallback & persistent missing-banner", () => {
  const concepts73 = [
    {
      slug: "sse-stream",
      label: "SSE Stream",
      techSymbol: "EventSource",
      targetPlugin: "visualize",
      stage1: {
        definition: "Server pushes live text chunks over one HTTP connection.",
        analogy: "Like a radio broadcast you tune into once.",
        microVisualSpec: { type: "loop-3node", nodes: ["Client", "Stream", "Chunk"] }
      },
      stage2: {
        howItWorks: "Client opens EventSource and the server writes SSE frames.",
        keyTradeOff: "SSE is simpler than WebSockets but one-directional.",
        inYourCodebase: "Look for EventSource constructor calls."
      },
      stage2Prompt: "Diagram the SSE request lifecycle."
    }
  ];

  function state73(debriefOverrides = {}, topOverrides = {}) {
    return {
      activePersona: "vibe-mentor",
      language: "en",
      installedVisualPlugins: [],
      ...topOverrides,
      currentDebrief: {
        id: "turn-concepts-73",
        responseType: "implementation",
        tldrHeadline: "Built SSE rate limiter.",
        diagramSpec: {
          grammar: "sequence",
          title: "SSE Flow",
          nodes: [
            { id: "n1", label: "Client", role: "API", risk: "low", status: "done" },
            { id: "n2", label: "SSE Server", role: "Core", risk: "medium", status: "active" }
          ],
          edges: [{ from: "n1", to: "n2", stepNumber: 1, label: "Connect", risk: "low" }]
        },
        microBlocks: ["diagram", "concepts"],
        concepts: concepts73,
        ...debriefOverrides
      }
    };
  }

  async function openMissingFallbackViaDrawer(env) {
    env.pushState(state73());
    await env.flush();
    const block = env.elements.get("microBlockConcepts");
    block.querySelectorAll(".concept-pill")[0].dispatchEvent({ type: "click" });
    await env.flush();
    env.elements.get("btnOpenStage2").dispatchEvent({ type: "click" });
    await env.flush();
  }

  it("Deep Dive & Pop Out on an uninstalled plugin calls export_html with { conceptSlug, targetPlugin } and shows the missing-banner", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    await openMissingFallbackViaDrawer(env);

    const exportCall = env.toolCalls.find((c) => c.name === "vibe_debrief_export_html");
    assert.ok(exportCall, "missing plugin must trigger vibe_debrief_export_html");
    assert.equal(exportCall.arguments.conceptSlug, "sse-stream");
    assert.equal(exportCall.arguments.targetPlugin, "visualize");

    const banner = env.elements.get("missingPluginBanner");
    assert.equal(banner.style.display, "flex", "missing-banner must be visible");
    assert.ok(banner.classList.contains("visible"));
    assert.match(env.elements.get("missingBannerText").textContent, /not installed/);
    assert.match(env.elements.get("missingBannerText").textContent, /fallback ready/);

    const link = env.elements.get("missingArtifactLink");
    assert.equal(link.style.display, "inline");
    assert.equal(link.getAttribute("href"), "/tmp/vibe-debrief-test.html");
    assert.equal(link.textContent, "vibe-debrief-test.html");

    const installBtn = env.elements.get("btnInstallMissingPlugin");
    assert.equal(installBtn.textContent, "Install visualize");
    assert.equal(installBtn.getAttribute("aria-label"), "Install visualize plugin");

    assert.ok(env.elements.get("toastBanner").classList.contains("toast-warn"));
    assert.match(env.elements.get("toastText").textContent, /not installed/i);
  });

  it("missing-banner + artifact link + Install CTA survive accompanying tool-result pushes (AD-10)", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    await openMissingFallbackViaDrawer(env);

    // The export tool-result push re-renders the SAME debrief (same id).
    env.pushState(state73());
    await env.flush();
    env.pushState(state73({ tldrHeadline: "Built SSE rate limiter (updated)." }));
    await env.flush();

    const banner = env.elements.get("missingPluginBanner");
    assert.equal(banner.style.display, "flex", "missing-banner must survive same-turn tool-result pushes");
    assert.ok(banner.classList.contains("visible"));
    assert.equal(env.elements.get("missingArtifactLink").getAttribute("href"), "/tmp/vibe-debrief-test.html");
    assert.equal(env.elements.get("btnInstallMissingPlugin").textContent, "Install visualize");
    assert.match(env.elements.get("missingBannerText").textContent, /fallback ready/);
  });

  it("a new debrief id resets the missing-banner (turn-scoped transient state)", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    await openMissingFallbackViaDrawer(env);
    assert.equal(env.elements.get("missingPluginBanner").style.display, "flex");

    env.pushState(state73({ id: "turn-next-73" }));
    await env.flush();

    assert.equal(env.elements.get("missingPluginBanner").style.display, "none");
    assert.equal(env.elements.get("missingPluginBanner").classList.contains("visible"), false);
  });

  it("Install CTA dispatches a 1-click ui/message install request", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    await openMissingFallbackViaDrawer(env);

    env.elements.get("btnInstallMissingPlugin").dispatchEvent({ type: "click" });
    await env.flush();

    const msg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
    assert.ok(msg, "Install CTA must dispatch ui/message");
    assert.match(msg.params.content[0].text, /Install Plugin/);
    assert.match(msg.params.content[0].text, /visualize/);
    assert.ok(env.elements.get("toastBanner").classList.contains("toast-ok"));
    assert.match(env.elements.get("toastText").textContent, /Install request sent/);
  });

  it("dismiss button and Escape hide the missing-banner", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    await openMissingFallbackViaDrawer(env);

    env.elements.get("btnDismissMissingBanner").dispatchEvent({ type: "click" });
    await env.flush();
    assert.equal(env.elements.get("missingPluginBanner").style.display, "none");

    // Re-trigger via powerup-dock (conceptSlug null). The stage1-drawer is still
    // open, so the first Escape closes the drawer (priority chain) and the
    // second Escape dismisses the missing-banner.
    env.elements.get("btnPowerupVisualize").dispatchEvent({ type: "click" });
    await env.flush();
    assert.equal(env.elements.get("missingPluginBanner").style.display, "flex");

    env.dispatchWindowEvent({ type: "keydown", key: "Escape", preventDefault() {} });
    await env.flush();
    env.dispatchWindowEvent({ type: "keydown", key: "Escape", preventDefault() {} });
    await env.flush();
    assert.equal(env.elements.get("missingPluginBanner").style.display, "none");
  });

  it("powerup-dock click on an uninstalled plugin exports with conceptSlug null", async () => {
    const env = createPanelDomEnvironment();
    await env.flush();
    env.pushState(state73());
    await env.flush();

    env.elements.get("btnPowerupExcalidraw").dispatchEvent({ type: "click" });
    await env.flush();

    const exportCall = env.toolCalls.find((c) => c.name === "vibe_debrief_export_html");
    assert.ok(exportCall);
    assert.equal(exportCall.arguments.conceptSlug, null);
    assert.equal(exportCall.arguments.targetPlugin, "excalidraw");
    assert.equal(env.elements.get("btnInstallMissingPlugin").textContent, "Install excalidraw");
    assert.equal(env.elements.get("missingPluginBanner").style.display, "flex");
  });

  it("missing-banner declares role='status' and aria-live='polite' in static markup", () => {
    assert.match(
      PANEL_HTML,
      /<div[^>]*class="missing-banner"[^>]*id="missingPluginBanner"[^>]*role="status"[^>]*aria-live="polite"/
    );
  });

  it("applies Field Desk Light semantic wash ink overrides to minimal-badge, unclear-title, missing-artifact-link, and lesson-form-title", () => {
    for (const selector of [".minimal-badge", ".unclear-title", ".missing-artifact-link", ".lesson-form-title"]) {
      assert.match(
        PANEL_HTML,
        new RegExp(`body\\.theme-light\\s+\\${selector}[\\s\\S]*?color:\\s*var\\(--text-primary\\)`),
        `Field Desk Light must override ${selector} to var(--text-primary) for >= 4.5:1 contrast`
      );
    }
  });
});
