import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

import {
  PANEL_HTML_PATH,
  buildDebriefFixture,
  contrastRatio,
  extractInlineScript,
  extractStyleContent,
  parseCssBlockVars,
  resolveCssAliases
} from "./helpers.mjs";

const PANEL_HTML = readFileSync(PANEL_HTML_PATH, "utf8");

function extractFunctionSource(source, fnName) {
  const marker = `function ${fnName}(`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `Expected ${fnName}() in panel.html script`);
  let depth = 0;
  let inBody = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      inBody = true;
    } else if (ch === "}") {
      depth -= 1;
      if (inBody && depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  assert.fail(`Could not find closing brace for ${fnName}()`);
}

function createPanelTestHarness({
  initTheme = "dark",
  omitInitTheme = false,
  debrief = buildDebriefFixture(),
  emptyComputedStyles = false
} = {}) {
  const styleText = extractStyleContent(PANEL_HTML);
  const darkVars = resolveCssAliases(parseCssBlockVars(styleText, /:root\s*\{([\s\S]*?)\}/));
  const lightVars = resolveCssAliases({
    ...darkVars,
    ...parseCssBlockVars(styleText, /body\.theme-light,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\}/)
  });

  const elements = new Map();
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

  function makeElement(id, tagName = "div") {
    const attrs = new Map();
    const el = {
      id,
      tagName,
      style: {},
      value: "",
      checked: false,
      textContent: "",
      _innerHTML: "",
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
      addEventListener(type, fn) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(fn);
      },
      querySelectorAll() {
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
    "tabBtnExplainer",
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
    "memoryIndexPreviewBox",
    "confirmedLessonsBankList",
    "historyListContainer",
    "btnRefresh",
    "btnExportHtml",
    "btnAskAiExplain",
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
  const canvasOps = [];
  const recordingCtx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      canvasOps.push({ op: "stroke", style: this.strokeStyle });
    },
    fill() {
      canvasOps.push({ op: "fill", style: this.fillStyle });
    },
    arc() {},
    rect() {},
    roundRect() {},
    fillText(text) {
      canvasOps.push({ op: "fillText", style: this.fillStyle, text: String(text) });
    },
    fillRect() {
      canvasOps.push({ op: "fillRect", style: this.fillStyle });
    }
  };
  explainerCanvas.getContext = () => recordingCtx;

  const windowListeners = new Map();
  const outboundMessages = [];
  let currentDebrief = debrief;

  const panelStatePayload = () => ({
    projectName: "demo-app",
    activePersona: "vibe-mentor",
    ste100Enabled: true,
    personas: [
      { id: "vibe-mentor", name: "Vibe Mentor", badge: "Vibe-Coder Buddy", tagline: "Plain clarity" }
    ],
    lightweightGeminiModels: [{ id: "new-provider/gemini-3.8-flash", modelId: "gemini-3.8-flash" }],
    recommendedGeminiModel: "new-provider/gemini-3.8-flash",
    confirmedLessons: [],
    zcodeMemory: { memoryDir: "~/.zcode/cli/memories", indexContent: "" },
    history: [],
    currentDebrief
  });

  const dispatchWindowMessage = (data) => {
    const listeners = windowListeners.get("message") || [];
    for (const fn of listeners) {
      fn({ data });
    }
  };

  const sandbox = {
    console: { warn() {}, error() {}, log() {} },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    navigator: { clipboard: { writeText: async () => {} } },
    document: {
      documentElement,
      body,
      getElementById(id) {
        return elements.get(id) || makeElement(id);
      },
      querySelectorAll() {
        return [];
      }
    },
    getComputedStyle(targetEl) {
      if (emptyComputedStyles) {
        return { getPropertyValue: () => "" };
      }
      const isLight =
        (targetEl === body && body.classList.contains("theme-light")) ||
        (targetEl === documentElement && documentElement.getAttribute("data-theme") === "light") ||
        body.classList.contains("theme-light") ||
        documentElement.getAttribute("data-theme") === "light";
      const table = isLight ? lightVars : darkVars;
      return {
        getPropertyValue(prop) {
          return table[prop] || "";
        }
      };
    },
    window: null
  };

  sandbox.window = {
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(fn);
    },
    parent: {
      postMessage(msg) {
        outboundMessages.push(msg);
        if (msg.method === "ui/initialize" && msg.id !== undefined) {
          const result = omitInitTheme
            ? { capabilities: {} }
            : { hostContext: { theme: initTheme } };
          queueMicrotask(() => dispatchWindowMessage({ jsonrpc: "2.0", id: msg.id, result }));
        } else if (msg.method === "tools/call" && msg.params?.name === "vibe_debrief_get_state") {
          queueMicrotask(() =>
            dispatchWindowMessage({
              jsonrpc: "2.0",
              id: msg.id,
              result: { structuredContent: panelStatePayload() }
            })
          );
        }
      }
    },
    speechSynthesis: { cancel() {} }
  };

  const scriptSource = extractInlineScript(PANEL_HTML);
  vm.runInNewContext(scriptSource, sandbox, { filename: "panel-inline.js" });

  return {
    body,
    documentElement,
    diagramSvg: elements.get("diagramSvg"),
    canvasOps,
    outboundMessages,
    notifyHostTheme(theme) {
      dispatchWindowMessage({
        jsonrpc: "2.0",
        method: "ui/notifications/host-context-changed",
        params: { theme }
      });
    },
    pushDebrief(nextDebrief) {
      currentDebrief = nextDebrief;
      dispatchWindowMessage({
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: { structuredContent: panelStatePayload() }
      });
    },
    async flush() {
      await new Promise((r) => setTimeout(r, 15));
    }
  };
}

describe("DESIGN.md CSS custom properties & legacy aliases", () => {
  const styleText = extractStyleContent(PANEL_HTML);
  const darkVars = parseCssBlockVars(styleText, /:root\s*\{([\s\S]*?)\}/);
  const lightVars = parseCssBlockVars(
    styleText,
    /body\.theme-light,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\}/
  );

  it("defines every DESIGN.md Dark HUD token in :root", () => {
    const expectedDark = {
      "--bg-app": "#090d13",
      "--bg-surface": "#101620",
      "--bg-panel": "#121924",
      "--bg-card": "#182130",
      "--bg-card-hover": "#1e293b",
      "--bg-elevated": "#0d131c",
      "--border": "rgba(148, 163, 184, 0.14)",
      "--border-strong": "rgba(148, 163, 184, 0.28)",
      "--border-subtle": "#1e2738",
      "--text-primary": "#e7edf6",
      "--text-secondary": "#9aa9be",
      "--text-muted": "#69788e",
      "--text-on-accent": "#06121e",
      "--text-on-warn": "#140d00",
      "--accent": "#38bdf8",
      "--accent-soft": "rgba(56, 189, 248, 0.14)",
      "--accent-border": "rgba(56, 189, 248, 0.36)",
      "--ok": "#34d399",
      "--ok-soft": "rgba(52, 211, 153, 0.13)",
      "--ok-subtle": "rgba(52, 211, 153, 0.05)",
      "--ok-border": "rgba(52, 211, 153, 0.36)",
      "--warn": "#fbbf24",
      "--warn-soft": "rgba(251, 191, 36, 0.14)",
      "--warn-border": "rgba(251, 191, 36, 0.38)",
      "--risk": "#fb7185",
      "--risk-soft": "rgba(251, 113, 133, 0.14)",
      "--risk-border": "rgba(251, 113, 133, 0.38)",
      "--purple": "#a78bfa",
      "--purple-soft": "rgba(167, 139, 250, 0.14)",
      "--purple-border": "rgba(167, 139, 250, 0.35)",
      "--teal": "#2dd4bf",
      "--teal-soft": "rgba(45, 212, 191, 0.14)",
      "--teal-border": "rgba(45, 212, 191, 0.35)",
      "--brand-sky": "#0ea5e9",
      "--brand-indigo": "#6366f1",
      "--explainer-stage-bg": "#070b12",
      "--excalidraw-stage-bg": "#faf8f2",
      "--excalidraw-ink": "#1e293b",
      "--grid-dot": "rgba(148, 163, 184, 0.12)",
      "--canvas-grid-line": "rgba(56, 189, 248, 0.08)",
      "--telemetry-pill-bg": "rgba(12, 17, 26, 0.84)",
      "--white": "#ffffff"
    };
    for (const [token, expected] of Object.entries(expectedDark)) {
      assert.equal(darkVars[token], expected, `Dark HUD token ${token} mismatch`);
    }
  });

  it("defines every DESIGN.md Field Desk Light token on body.theme-light and html[data-theme='light']", () => {
    const expectedLight = {
      "--bg-app": "#efeae0",
      "--bg-surface": "#f7f4ec",
      "--bg-panel": "#fbf9f4",
      "--bg-card": "#ffffff",
      "--bg-card-hover": "#f3efe6",
      "--bg-elevated": "#f1ece1",
      "--border": "rgba(30, 41, 59, 0.12)",
      "--border-strong": "rgba(30, 41, 59, 0.24)",
      "--border-subtle": "#e2dcd0",
      "--text-primary": "#17202e",
      "--text-secondary": "#4c5a6d",
      "--text-muted": "#768396",
      "--text-on-warn": "#ffffff",
      "--accent": "#0284c7",
      "--accent-soft": "rgba(2, 132, 199, 0.1)",
      "--accent-border": "rgba(2, 132, 199, 0.34)",
      "--ok": "#059669",
      "--ok-soft": "rgba(5, 150, 105, 0.1)",
      "--ok-border": "rgba(5, 150, 105, 0.34)",
      "--warn": "#b45309",
      "--warn-soft": "rgba(217, 119, 6, 0.12)",
      "--warn-border": "rgba(217, 119, 6, 0.36)",
      "--risk": "#be123c",
      "--risk-soft": "rgba(225, 29, 72, 0.1)",
      "--risk-border": "rgba(225, 29, 72, 0.34)",
      "--purple": "#6d28d9",
      "--purple-soft": "rgba(109, 40, 217, 0.1)",
      "--purple-border": "rgba(109, 40, 217, 0.3)",
      "--teal": "#0d9488",
      "--teal-soft": "rgba(13, 148, 136, 0.1)",
      "--teal-border": "rgba(13, 148, 136, 0.3)",
      "--grid-dot": "rgba(30, 41, 59, 0.12)"
    };
    for (const [token, expected] of Object.entries(expectedLight)) {
      assert.equal(lightVars[token], expected, `Field Desk Light token ${token} mismatch`);
    }
  });

  it("preserves legacy CSS variable aliases mapped to DESIGN.md tokens in both themes", () => {
    const legacyTokens = [
      "--bg-primary",
      "--bg-secondary",
      "--bg-tertiary",
      "--success",
      "--success-soft",
      "--warning",
      "--warning-soft",
      "--danger",
      "--danger-soft"
    ];
    const resolvedDark = resolveCssAliases(darkVars);
    const resolvedLight = resolveCssAliases(lightVars);

    for (const alias of legacyTokens) {
      assert.ok(darkVars[alias], `:root must keep legacy alias ${alias}`);
      assert.ok(lightVars[alias], `light theme block must re-evaluate legacy alias ${alias}`);
    }
    assert.equal(resolvedDark["--bg-primary"], "#090d13");
    assert.equal(resolvedDark["--bg-secondary"], "#182130");
    assert.equal(resolvedDark["--bg-tertiary"], "#1e293b");
    assert.equal(resolvedDark["--success"], "#34d399");
    assert.equal(resolvedDark["--warning"], "#fbbf24");
    assert.equal(resolvedDark["--danger"], "#fb7185");

    assert.equal(resolvedLight["--bg-primary"], "#efeae0");
    assert.equal(resolvedLight["--bg-secondary"], "#ffffff");
    assert.equal(resolvedLight["--bg-tertiary"], "#f3efe6");
    assert.equal(resolvedLight["--success"], "#059669");
    assert.equal(resolvedLight["--warning"], "#b45309");
    assert.equal(resolvedLight["--danger"], "#be123c");
  });

  it("removes hardcoded #0b0f17 and #070b12 from CSS component rules", () => {
    const rulesAfterLightBlock = styleText.slice(styleText.indexOf("box-sizing: border-box"));
    assert.equal(rulesAfterLightBlock.includes("#0b0f17"), false, "CSS rules must use tokens instead of #0b0f17");
    assert.equal(rulesAfterLightBlock.includes("#070b12"), false, "CSS rules must use --explainer-stage-bg instead of #070b12");
  });

  it("satisfies WCAG 2.1 AA contrast floors (>= 4.5:1 text, >= 3:1 strokes/accents) in both themes", () => {
    const resolvedDark = resolveCssAliases(darkVars);
    const resolvedLight = resolveCssAliases(lightVars);

    for (const [label, palette] of [
      ["Dark HUD", resolvedDark],
      ["Field Desk Light", resolvedLight]
    ]) {
      const surfaces = ["--bg-app", "--bg-surface", "--bg-panel", "--bg-card", "--bg-elevated"];
      for (const bgToken of surfaces) {
        for (const textToken of ["--text-primary", "--text-secondary"]) {
          const ratio = contrastRatio(palette[textToken], palette[bgToken]);
          assert.ok(
            ratio >= 4.5,
            `${label} ${textToken} (${palette[textToken]}) on ${bgToken} (${palette[bgToken]}) contrast ${ratio.toFixed(2)} < 4.5`
          );
        }
        for (const strokeToken of ["--accent", "--ok", "--warn", "--risk", "--purple", "--teal"]) {
          const ratio = contrastRatio(palette[strokeToken], palette[bgToken]);
          assert.ok(
            ratio >= 3.0,
            `${label} ${strokeToken} (${palette[strokeToken]}) on ${bgToken} (${palette[bgToken]}) contrast ${ratio.toFixed(2)} < 3.0`
          );
        }
      }
      const onAccentRatio = contrastRatio(palette["--text-on-accent"], palette["--accent"]);
      assert.ok(
        onAccentRatio >= 4.5,
        `${label} --text-on-accent (${palette["--text-on-accent"]}) on --accent (${palette["--accent"]}) contrast ${onAccentRatio.toFixed(2)} < 4.5`
      );
      const onWarnRatio = contrastRatio(palette["--text-on-warn"], palette["--warn"]);
      assert.ok(
        onWarnRatio >= 4.5,
        `${label} --text-on-warn (${palette["--text-on-warn"]}) on --warn (${palette["--warn"]}) contrast ${onWarnRatio.toFixed(2)} < 4.5`
      );
    }
  });
});

describe("renderInteractiveDiagram & CSP static safety", () => {
  const scriptText = extractInlineScript(PANEL_HTML);
  const diagramFnSource = extractFunctionSource(scriptText, "renderInteractiveDiagram");

  it("contains zero hardcoded dark-only hex or rgba literals in renderInteractiveDiagram", () => {
    const forbidden = [
      "#0b0f17",
      "#131a26",
      "#f0f6fc",
      "#9ba7b8",
      "#38bdf8",
      "#fb7185",
      "#fbbf24",
      "#34d399",
      "rgba(56,189,248"
    ];
    for (const literal of forbidden) {
      assert.equal(
        diagramFnSource.includes(literal),
        false,
        `renderInteractiveDiagram must not hardcode ${literal}`
      );
    }
    assert.ok(
      diagramFnSource.includes("resolveThemeTokens()"),
      "renderInteractiveDiagram must resolve theme tokens dynamically"
    );
  });

  it("stays compliant with unsafeEval: false and zero inline event handlers", () => {
    assert.equal(/\son(?:click|change|input|submit)\s*=\s*["']/i.test(PANEL_HTML), false);
    assert.equal(/\beval\s*\(/.test(PANEL_HTML), false);
    assert.equal(/\bnew\s+Function\b/.test(PANEL_HTML), false);
  });
});

const multiRiskDebrief = buildDebriefFixture({
    diagram: {
      diagramType: "architecture",
      title: "Theme Parity Diagram",
      nodes: [
        { id: "n1", label: "Safe Node", sublabel: "Verified", role: "Input", risk: "low", status: "done" },
        { id: "n2", label: "Active Node", sublabel: "In flight", role: "Logic", risk: "low", status: "active" },
        { id: "n3", label: "Warn Node", sublabel: "Medium risk", role: "State", risk: "medium", status: "done" },
        { id: "n4", label: "Danger Node", sublabel: "High risk", role: "Auth", risk: "high", status: "done" }
      ],
      edges: [
        { from: "n1", to: "n2", stepNumber: 1, label: "Step 1", risk: "low" },
        { from: "n2", to: "n3", stepNumber: 2, label: "Step 2", risk: "medium" },
        { from: "n3", to: "n4", stepNumber: 3, label: "Step 3", risk: "high" }
      ]
    }
});

const complexExplainerDebrief = buildDebriefFixture({
  ...multiRiskDebrief,
  complexity: { level: "complex", score: 5, reason: "Multi-file theme flow" },
  explainerScenes: [
    {
      title: "Trace the flow",
      narration: "Follow the accent pulse across the nodes.",
      durationSec: 7,
      highlightNodeIds: ["n2", "n4"],
      visualType: "audit-warning",
      callout: "Watch the highlighted node."
    },
    {
      title: "Verify the result",
      narration: "Check the proof before shipping.",
      durationSec: 7,
      highlightNodeIds: ["n4"],
      visualType: "flow"
    }
  ]
});

describe("Live host theme sync & SVG diagram parity", () => {
  it("initializes with hostContext.theme='light' and renders Field Desk Light SVG tokens", async () => {
    const harness = createPanelTestHarness({ initTheme: "light", debrief: multiRiskDebrief });
    await harness.flush();

    assert.equal(harness.body.classList.contains("theme-light"), true);
    assert.equal(harness.documentElement.getAttribute("data-theme"), "light");

    const svg = harness.diagramSvg.innerHTML;
    // Light tokens present
    assert.ok(svg.includes("#0284c7"), "Light accent #0284c7 must appear in arrow/active node");
    assert.ok(svg.includes("#059669"), "Light ok #059669 must appear in low-risk node");
    assert.ok(svg.includes("#b45309"), "Light warn #b45309 must appear in medium-risk node/edge");
    assert.ok(svg.includes("#be123c"), "Light risk #be123c must appear in high-risk node/edge");
    assert.ok(svg.includes("#ffffff"), "Light card fill #ffffff must appear in nodes");
    assert.ok(svg.includes("#efeae0"), "Light bgApp #efeae0 must appear in step badge circle");
    assert.ok(svg.includes("#17202e"), "Light textPrimary #17202e must appear in labels");
    assert.ok(svg.includes("#4c5a6d"), "Light textSecondary #4c5a6d must appear in sublabels");

    // Dark-only literals absent
    for (const darkHex of ["#131a26", "#0b0f17", "#f0f6fc", "#9ba7b8", "#38bdf8", "#fb7185", "#fbbf24", "#34d399"]) {
      assert.equal(svg.includes(darkHex), false, `Dark-only literal ${darkHex} leaked into light SVG`);
    }
  });

  it("defaults safely to dark when ui/initialize omits hostContext.theme", async () => {
    const harness = createPanelTestHarness({ omitInitTheme: true, debrief: multiRiskDebrief });
    await harness.flush();

    assert.equal(harness.body.classList.contains("theme-light"), false);
    assert.equal(harness.documentElement.getAttribute("data-theme"), "dark");

    const svg = harness.diagramSvg.innerHTML;
    assert.ok(svg.includes("#38bdf8"));
    assert.ok(svg.includes("#182130"));
    assert.ok(svg.includes("#e7edf6"));
  });

  it("re-renders #diagramSvg immediately on ui/notifications/host-context-changed light <-> dark toggles", async () => {
    const harness = createPanelTestHarness({ initTheme: "dark", debrief: multiRiskDebrief });
    await harness.flush();

    assert.equal(harness.documentElement.getAttribute("data-theme"), "dark");
    assert.ok(harness.diagramSvg.innerHTML.includes("#182130"));

    harness.notifyHostTheme("light");
    assert.equal(harness.body.classList.contains("theme-light"), true);
    assert.equal(harness.documentElement.getAttribute("data-theme"), "light");
    assert.ok(harness.diagramSvg.innerHTML.includes("#ffffff"));
    assert.ok(harness.diagramSvg.innerHTML.includes("#0284c7"));
    assert.equal(harness.diagramSvg.innerHTML.includes("#182130"), false);

    harness.notifyHostTheme("dark");
    assert.equal(harness.body.classList.contains("theme-light"), false);
    assert.equal(harness.documentElement.getAttribute("data-theme"), "dark");
    assert.ok(harness.diagramSvg.innerHTML.includes("#182130"));
    assert.ok(harness.diagramSvg.innerHTML.includes("#38bdf8"));
    assert.equal(harness.diagramSvg.innerHTML.includes("#0284c7"), false);
  });

  it("safely skips diagram re-render when host-context-changed fires before state loads", () => {
    const harness = createPanelTestHarness({ initTheme: "dark", debrief: multiRiskDebrief });
    assert.doesNotThrow(() => harness.notifyHostTheme("light"));
    assert.equal(harness.body.classList.contains("theme-light"), true);
    assert.equal(harness.documentElement.getAttribute("data-theme"), "light");
  });

  it("renders empty diagram placeholder using resolved textSecondary token under both themes", async () => {
    const emptyDebrief = buildDebriefFixture({
      diagram: { diagramType: "architecture", title: "Empty", nodes: [], edges: [] }
    });
    const harness = createPanelTestHarness({ initTheme: "light", debrief: emptyDebrief });
    await harness.flush();

    assert.ok(harness.diagramSvg.innerHTML.includes('fill="#4c5a6d"'));
    assert.equal(harness.diagramSvg.innerHTML.includes("#9ba7b8"), false);

    harness.notifyHostTheme("dark");
    assert.ok(harness.diagramSvg.innerHTML.includes('fill="#9aa9be"'));
    assert.equal(harness.diagramSvg.innerHTML.includes("#9ba7b8"), false);
  });

  it("falls back to DESIGN.md theme tokens when getComputedStyle returns empty values", async () => {
    const harness = createPanelTestHarness({
      initTheme: "light",
      debrief: multiRiskDebrief,
      emptyComputedStyles: true
    });
    await harness.flush();

    assert.ok(harness.diagramSvg.innerHTML.includes("#0284c7"));
    assert.ok(harness.diagramSvg.innerHTML.includes("#ffffff"));

    harness.notifyHostTheme("dark");
    assert.ok(harness.diagramSvg.innerHTML.includes("#38bdf8"));
    assert.ok(harness.diagramSvg.innerHTML.includes("#182130"));
  });

  it("escapes dynamic SVG labels, sublabels, ids, and edge steps against XSS", async () => {
    const hostileDebrief = buildDebriefFixture({
      diagram: {
        diagramType: "architecture",
        title: "XSS Test",
        nodes: [
          {
            id: 'n1" onclick="alert(1)',
            label: "<script>alert(1)</script>",
            sublabel: '"><img src=x>',
            role: "Input",
            risk: "unknown",
            status: "unknown"
          }
        ],
        edges: []
      }
    });
    const harness = createPanelTestHarness({ initTheme: "light", debrief: hostileDebrief });
    await harness.flush();

    const svg = harness.diagramSvg.innerHTML;
    assert.equal(svg.includes("<script>"), false);
    assert.equal(svg.includes("<img"), false);
    assert.ok(svg.includes("&lt;script&gt;"));
    assert.ok(svg.includes("&quot;"));
    // Unknown risk/status defaults cleanly to ok (#059669 in light mode)
    assert.ok(svg.includes("#059669"));
  });
});

describe("Canvas explainer theme parity (drawExplainerFrame)", () => {
  const scriptText = extractInlineScript(PANEL_HTML);
  const drawFnSource = extractFunctionSource(scriptText, "drawExplainerFrame");
  const opStyles = (ops) => ops.map((o) => o.style);

  it("contains zero hardcoded dark-only literals and resolves theme tokens", () => {
    const forbidden = [
      "#0b0f17",
      "#131a26",
      "#f0f6fc",
      "#9ba7b8",
      "#38bdf8",
      "#fb7185",
      "#fbbf24",
      "#34d399",
      "#2a354b",
      "#1c2536",
      "rgba(56, 189, 248"
    ];
    for (const literal of forbidden) {
      assert.equal(drawFnSource.includes(literal), false, `drawExplainerFrame must not hardcode ${literal}`);
    }
    assert.ok(drawFnSource.includes("resolveThemeTokens()"), "drawExplainerFrame must resolve theme tokens");
  });

  it("draws the Dark HUD stage, grid, nodes, and text under the dark theme", async () => {
    const harness = createPanelTestHarness({ initTheme: "dark", debrief: complexExplainerDebrief });
    await harness.flush();

    const styles = opStyles(harness.canvasOps);
    assert.ok(harness.canvasOps.length > 0, "explainer canvas must draw on state load");
    for (const expected of [
      "#070b12", // explainer stage background
      "rgba(56, 189, 248, 0.08)", // blueprint grid line
      "#182130", // bgCard node fill
      "rgba(56, 189, 248, 0.14)", // accentSoft active node fill
      "rgba(148, 163, 184, 0.28)", // borderStrong edges/inactive strokes
      "#e7edf6", // textPrimary labels
      "#9aa9be", // textSecondary sublabels
      "#38bdf8", // accent pulse/callout/timeline
      "#fbbf24", // warn title + medium risk
      "#fb7185", // risk high node + audit-warning active stroke
      "#34d399", // ok low risk
      "#1e293b" // bgCardHover timeline track
    ]) {
      assert.ok(styles.includes(expected), `Dark canvas draw must use token ${expected}`);
    }
    for (const lightOnly of ["#0284c7", "#ffffff", "#17202e", "#4c5a6d", "#f1ece1", "#be123c", "#b45309", "#059669"]) {
      assert.equal(styles.includes(lightOnly), false, `Light-only token ${lightOnly} leaked into dark canvas`);
    }
  });

  it("draws the Field Desk Light stage, grid, nodes, and text under the light theme", async () => {
    const harness = createPanelTestHarness({ initTheme: "light", debrief: complexExplainerDebrief });
    await harness.flush();

    const styles = opStyles(harness.canvasOps);
    assert.ok(harness.canvasOps.length > 0, "explainer canvas must draw on state load");
    for (const expected of [
      "#f1ece1", // light explainer stage (bg-elevated-light)
      "rgba(2, 132, 199, 0.08)", // light blueprint grid line
      "#ffffff", // bgCard node fill
      "rgba(2, 132, 199, 0.1)", // accentSoft active node fill
      "rgba(30, 41, 59, 0.24)", // borderStrong edges/inactive strokes
      "#17202e", // textPrimary labels
      "#4c5a6d", // textSecondary sublabels
      "#0284c7", // accent pulse/callout/timeline
      "#b45309", // warn title + medium risk
      "#be123c", // risk high node + audit-warning active stroke
      "#059669", // ok low risk
      "#f3efe6" // bgCardHover timeline track
    ]) {
      assert.ok(styles.includes(expected), `Light canvas draw must use token ${expected}`);
    }
    for (const darkOnly of ["#070b12", "#131a26", "#182130", "#e7edf6", "#9ba7b8", "#38bdf8", "#fb7185", "#fbbf24", "#34d399"]) {
      assert.equal(styles.includes(darkOnly), false, `Dark-only literal ${darkOnly} leaked into light canvas`);
    }
  });

  it("re-draws the explainer canvas immediately on host-context-changed light <-> dark toggles", async () => {
    const harness = createPanelTestHarness({ initTheme: "dark", debrief: complexExplainerDebrief });
    await harness.flush();

    let mark = harness.canvasOps.length;
    harness.notifyHostTheme("light");
    let fresh = opStyles(harness.canvasOps.slice(mark));
    assert.ok(fresh.length > 0, "theme toggle must re-draw the canvas");
    assert.ok(fresh.includes("#f1ece1") && fresh.includes("#0284c7") && fresh.includes("#ffffff"));
    assert.equal(fresh.includes("#070b12"), false);
    assert.equal(fresh.includes("#38bdf8"), false);

    mark = harness.canvasOps.length;
    harness.notifyHostTheme("dark");
    fresh = opStyles(harness.canvasOps.slice(mark));
    assert.ok(fresh.includes("#070b12") && fresh.includes("#38bdf8") && fresh.includes("#182130"));
    assert.equal(fresh.includes("#f1ece1"), false);
    assert.equal(fresh.includes("#0284c7"), false);
  });

  it("falls back to DESIGN.md canvas tokens when getComputedStyle returns empty values", async () => {
    const harness = createPanelTestHarness({
      initTheme: "light",
      debrief: complexExplainerDebrief,
      emptyComputedStyles: true
    });
    await harness.flush();

    const styles = opStyles(harness.canvasOps);
    assert.ok(styles.includes("#f1ece1"), "light stage fallback must apply");
    assert.ok(styles.includes("#0284c7"), "light accent fallback must apply");
    assert.ok(styles.includes("rgba(2, 132, 199, 0.08)"), "light grid fallback must apply");
  });
});
