import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import vm from "node:vm";

import { generateStandaloneHtmlArtifact } from "../scripts/debrief-engine.mjs";
import {
  buildPanelStateFixture,
  extractInlineScript,
  extractStyleContent,
  parseCssBlockVars,
  resolveCssAliases
} from "./helpers.mjs";

// ============================================================================
// Story 6.6 — Standalone HTML export parity for Cockpit HUD & 5 grammars (R7).
//
// "Opening" an exported file offline here means: write the artifact to a temp
// directory, read the bytes back from disk, parse the static body markup into
// a minimal DOM, and execute the inline <script> inside a node:vm sandbox that
// exposes NO network APIs (no fetch, no XHR, no sendBeacon). Every export
// interaction (X-Ray toggle, microBlocks, scene pills, diagram inspector) is
// therefore proven to run locally against file contents only.
// ============================================================================

const GRAMMARS = ["sequence", "flow-diff", "subway-map", "before-after", "decision-tree"];

const GRAMMAR_NODE_FIXTURES = {
  sequence: [
    { id: "s1", label: "User", techLabel: "cli prompt", sublabel: "Prompt", role: "Input", risk: "low" },
    { id: "s2", label: "Panel", techLabel: "panel.html", sublabel: "HUD", role: "Visual UI / View", risk: "low" },
    { id: "s3", label: "Engine", techLabel: "debrief-engine.mjs", sublabel: "Core", role: "Core Logic / Service", risk: "medium" },
    { id: "s4", label: "Export", techLabel: "artifact.html", sublabel: "Offline file", role: "Output", risk: "low" }
  ],
  "flow-diff": [
    { id: "f1", label: "Hook", techLabel: "hook-runner.mjs", sublabel: "In", role: "Input", risk: "low" },
    { id: "f2", label: "Classify", techLabel: "classifyFileRole()", sublabel: "Diff", role: "Core Logic / Service", risk: "low" },
    { id: "f3", label: "Synthesize", techLabel: "synthesizeHeuristicDebrief", sublabel: "Change", role: "Core Logic / Service", risk: "medium" },
    { id: "f4", label: "Polish", techLabel: "applySte100Polish", sublabel: "STE-80", role: "Core Logic / Service", risk: "low" },
    { id: "f5", label: "Persist", techLabel: "savePersistedState", sublabel: "Out", role: "State / ViewModel", risk: "medium" }
  ],
  "subway-map": [
    { id: "m1", label: "Radar", techLabel: "radar-card", sublabel: "10s summary", role: "Visual UI / View", risk: "low", lane: "hud" },
    { id: "m2", label: "XRay", techLabel: "xray-toggle", sublabel: "Plain Tech swap", role: "Visual UI / View", risk: "low", lane: "hud" },
    { id: "m3", label: "Chips", techLabel: "action-chip", sublabel: "Waiting states", role: "State / ViewModel", risk: "medium", lane: "blocks" },
    { id: "m4", label: "Proof", techLabel: "proof-pill", sublabel: "Pills", role: "Output", risk: "low", lane: "blocks" }
  ],
  "before-after": [
    { id: "b1", label: "Stacked header", sublabel: "v0.3 rows", role: "Visual UI / View", risk: "medium", lane: "before" },
    { id: "b2", label: "Scrolled pills", sublabel: "Legacy", role: "Visual UI / View", risk: "low", lane: "before" },
    { id: "b3", label: "1-strip HUD", techLabel: "hud-header", sublabel: "Epic 6", role: "Visual UI / View", risk: "low", lane: "after" },
    { id: "b4", label: "Radar card", techLabel: "radar-card", sublabel: "10s", role: "Visual UI / View", risk: "low", lane: "after" }
  ],
  "decision-tree": [
    { id: "d0", label: "Pick export mode", techLabel: "exportMode()", sublabel: "Decision", role: "Decision", risk: "low", branch: "root" },
    { id: "d1", label: "Panel only", sublabel: "Live view", role: "Choice", risk: "low", branch: "yes" },
    { id: "d2", label: "HTML export", sublabel: "Offline file", role: "Choice", risk: "low", branch: "no" },
    { id: "d3", label: "Both", sublabel: "Stage 1/2", role: "Choice", risk: "medium", branch: "no" }
  ]
};

function grammarDebrief(grammar) {
  return {
    responseType: "implementation",
    tldrHeadline: "Export parity turn for the grammar.",
    xray: {
      plain: { headline: "Export keeps the HUD look offline." },
      tech: {
        headline: "panel.html and debrief-engine.mjs share the export contract.",
        symbols: ["panel.html"],
        paths: ["scripts/debrief-engine.mjs"],
        commands: ["node --test tests/export-parity.test.mjs"],
        exitCodes: [0],
        proofLines: ["node --test tests/export-parity.test.mjs (exit 0)"]
      }
    },
    diagramSpec: {
      grammar,
      title: `${grammar} export flow`,
      nodes: GRAMMAR_NODE_FIXTURES[grammar],
      edges: [],
      ...(grammar === "subway-map"
        ? {
            groups: [
              { id: "hud", label: "Cockpit HUD", lane: "hud" },
              { id: "blocks", label: "Micro Blocks", lane: "blocks" }
            ]
          }
        : {})
    },
    choices:
      grammar === "decision-tree"
        ? [
            {
              id: "choice-a",
              key: "A",
              title: "Ship the offline export",
              plainSubtext: "Works without network.",
              techSubtext: "Zero fetch calls.",
              messagePrompt: "Ship the offline export.",
              tradeOffs: [{ label: "Clarity", score: 90 }]
            },
            {
              id: "choice-b",
              key: "B",
              title: "Panel-only view",
              plainSubtext: "Live updates.",
              techSubtext: "Needs the MCP bridge.",
              messagePrompt: "Keep panel only.",
              tradeOffs: [{ label: "Clarity", score: 45 }]
            }
          ]
        : [],
    waitingOnYou: {
      state: "choice",
      label: "Pick a Choice",
      prompt: "Pick one export mode to proceed.",
      chips: [
        { id: "wait-yes", key: "1", label: "Yes", messagePrompt: "Yes, ship it.", primary: true },
        { id: "wait-no", key: "2", label: "No", messagePrompt: "No, wait." }
      ]
    },
    proofClaims: [
      { claim: "Export tests pass.", evidence: "node --test", status: "verified" },
      { claim: "Old claim unproven.", evidence: "none", status: "unverified" }
    ],
    uncertaintyAudit: [{ area: "Grammar parity", reason: "Check each grammar offline.", riskLevel: "medium" }],
    complexity: { level: "complex", score: 5, reason: "Multi-block export turn" },
    explainerScenes: [
      { title: "Trace the export", narration: "Follow the flow from panel to file.", highlightNodeIds: ["s3"], durationSec: 7 },
      { title: "Verify offline", narration: "Open the file with the network off.", highlightNodeIds: [], durationSec: 7 }
    ],
    lessonsLearned: [{ title: "Escape before export", summary: "Escape raw text before any markup interpolation." }]
  };
}

function buildGrammarArtifact(grammar) {
  return generateStandaloneHtmlArtifact(buildPanelStateFixture({ debrief: grammarDebrief(grammar) }));
}

// ---------------------------------------------------------------------------
// Minimal offline DOM: parses the static artifact markup, then executes the
// inline script in a vm sandbox with no network globals.
// ---------------------------------------------------------------------------
function unescapeEntities(text) {
  return String(text)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

const VOID_TAGS = new Set(["meta", "link", "input", "br", "hr", "img"]);

function parseMarkupInto(parent, markup) {
  const stack = [parent];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  let lastIndex = 0;
  let match;
  while ((match = tagRe.exec(markup)) !== null) {
    const text = markup.slice(lastIndex, match.index);
    if (text.trim()) stack[stack.length - 1].appendText(text);
    lastIndex = tagRe.lastIndex;
    const [full, tagName, attrText, selfClose] = match;
    if (full.startsWith("</")) {
      const closeIdx = stack.map((el) => el.tagName).lastIndexOf(tagName);
      if (closeIdx > 0) stack.length = closeIdx;
      continue;
    }
    const el = parent.ownerDocument.createElement(tagName);
    for (const attr of attrText.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
      el.setAttribute(attr[1], unescapeEntities(attr[2] ?? ""));
    }
    stack[stack.length - 1].appendChild(el);
    if (!selfClose && !VOID_TAGS.has(tagName)) stack.push(el);
  }
  const trailing = markup.slice(lastIndex);
  if (trailing.trim()) stack[stack.length - 1].appendText(trailing);
}

function makeClassList(el) {
  const set = new Set();
  const sync = () => {
    const arr = Array.from(set);
    el._className = arr.join(" ");
  };
  return {
    add: (...cls) => {
      cls.forEach((c) => set.add(c));
      sync();
    },
    remove: (...cls) => {
      cls.forEach((c) => set.delete(c));
      sync();
    },
    toggle: (c, force) => {
      if (force === undefined) {
        if (set.has(c)) set.delete(c);
        else set.add(c);
      } else if (force) set.add(c);
      else set.delete(c);
      sync();
      return set.has(c);
    },
    contains: (c) => set.has(c),
    toArray: () => Array.from(set)
  };
}

function createMiniDomDocument() {
  const elements = new Map();
  let activeEl = null;
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

  const doc = {
    _elements: elements,
    canvasOps,
    getActiveElement: () => activeEl,
    getElementById(id) {
      if (elements.has(id)) return elements.get(id);
      const found = walk(documentElement, (el) => el.id === id ? el : null);
      if (found) {
        elements.set(id, found);
        return found;
      }
      const created = doc.createElement("div");
      created.id = id;
      elements.set(id, created);
      return created;
    },
    createElement(tagName = "div") {
      const el = {
        tagName: String(tagName).toLowerCase(),
        id: "",
        ownerDocument: null,
        _className: "",
        _text: "",
        _children: [],
        _rawInnerHtml: "",
        style: {},
        listeners: new Map(),
        classList: null
      };
      el.classList = makeClassList(el);
      Object.defineProperty(el, "className", {
        get: () => el._className,
        set: (val) => {
          el._className = String(val ?? "");
          const list = el._className.split(/\s+/).filter(Boolean);
          el.classList.remove(...el.classList.toArray().filter((c) => !list.includes(c)));
          el.classList.add(...list.filter((c) => !el.classList.contains(c)));
        }
      });
      Object.defineProperty(el, "innerHTML", {
        get: () => el._rawInnerHtml,
        set: (val) => {
          el._rawInnerHtml = String(val ?? "");
          el._children = [];
          el._text = "";
          if (el.ownerDocument) parseMarkupInto(el, el._rawInnerHtml);
        }
      });
      Object.defineProperty(el, "textContent", {
        get: () =>
          el._text +
          el._children
            .map((c) => c.textContent)
            .join(""),
        set: (val) => {
          el._text = String(val ?? "");
          el._children = [];
          el._rawInnerHtml = escapeMinimal(el._text);
        }
      });
      el.setAttribute = (name, val) => {
        el._attrs.set(name, String(val));
        if (name === "class") el.className = String(val);
        if (name === "id") el.id = String(val);
      };
      el.getAttribute = (name) => (el._attrs.has(name) ? el._attrs.get(name) : null);
      el.removeAttribute = (name) => {
        el._attrs.delete(name);
      };
      el.hasAttribute = (name) => el._attrs.has(name);
      el._attrs = new Map();
      el.appendChild = (child) => {
        el._children.push(child);
        return child;
      };
      el.appendText = (text) => {
        el._text += unescapeEntities(text);
      };
      el.addEventListener = (type, fn) => {
        if (!el.listeners.has(type)) el.listeners.set(type, []);
        el.listeners.get(type).push(fn);
      };
      el.dispatchEvent = (ev) => {
        const evt = { target: el, preventDefault() {}, ...ev };
        for (const fn of el.listeners.get(ev.type) || []) fn.call(el, evt);
      };
      el.focus = () => {
        activeEl = el;
      };
      el.querySelectorAll = (selector) => walkAll(el, selector);
      el.getContext = () => (el.id === "sceneCanvas" ? recordingCtx : null);
      return el;
    }
  };
  el_ownerDocument_fixup();

  function el_ownerDocument_fixup() {
    const origCreate = doc.createElement.bind(doc);
    doc.createElement = (tagName) => {
      const el = origCreate(tagName);
      el.ownerDocument = doc;
      return el;
    };
  }

  const documentElement = doc.createElement("html");
  const body = doc.createElement("body");
  documentElement.appendChild(body);
  doc.documentElement = documentElement;
  doc.body = body;
  elements.set("__html__", documentElement);
  elements.set("__body__", body);

  function walk(root, visit) {
    for (const child of root._children) {
      const found = visit(child) || walk(child, visit);
      if (found) return found;
    }
    return null;
  }

  function walkAll(root, selector) {
    const out = [];
    const wantsClass = selector.startsWith(".");
    const wantsId = selector.startsWith("#");
    const plain = wantsClass ? selector.slice(1) : wantsId ? selector.slice(1) : selector.toLowerCase();
    (function descend(el) {
      for (const child of el._children) {
        if (wantsClass && child.classList.contains(plain)) out.push(child);
        else if (wantsId && child.id === plain) out.push(child);
        else if (!wantsClass && !wantsId && child.tagName === plain) out.push(child);
        descend(child);
      }
    })(root);
    return out;
  }

  return { doc, documentElement, body, canvasOps, getActiveElement: () => activeEl };
}

function escapeMinimal(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * "Open" an exported artifact offline: parse its static markup and run the
 * inline script in a vm sandbox that deliberately exposes no network APIs.
 */
function openArtifactOffline(artifactHtml, { theme = "dark" } = {}) {
  const scriptSource = extractInlineScript(artifactHtml);
  const styleText = extractStyleContent(artifactHtml);
  const darkRaw = parseCssBlockVars(styleText, /:root\s*\{([\s\S]*?)\}/);
  const lightRaw = parseCssBlockVars(
    styleText,
    /@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*\{([\s\S]*?)\}/
  );
  const dark = resolveCssAliases(darkRaw);
  const light = resolveCssAliases({ ...darkRaw, ...lightRaw });
  let currentTable = theme === "light" ? light : dark;

  const { doc, body, canvasOps, getActiveElement } = createMiniDomDocument();

  // Parse the static body markup (script tag stripped) into the mini DOM and
  // carry the opening <body> attributes (data-xray-mode) onto the body node.
  const bodyMatch = artifactHtml.match(/<body([^>]*)>([\s\S]*)<\/body>/);
  assert.ok(bodyMatch, "artifact must have a <body>");
  for (const attr of bodyMatch[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
    body.setAttribute(attr[1], unescapeEntities(attr[2] ?? ""));
  }
  const staticBodyHtml = bodyMatch[2].replace(/<script>[\s\S]*?<\/script>/, "");
  parseMarkupInto(body, staticBodyHtml);

  const mediaListeners = [];
  const sandbox = {
    document: doc,
    getComputedStyle() {
      return {
        getPropertyValue(prop) {
          return currentTable[prop] || "";
        }
      };
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    window: {
      matchMedia(query) {
        return {
          matches: theme === "light" && query.includes("light"),
          addEventListener(_type, fn) {
            mediaListeners.push(fn);
          },
          addListener(fn) {
            mediaListeners.push(fn);
          }
        };
      }
    }
  };
  vm.runInContext(scriptSource, vm.createContext(sandbox));

  return {
    doc,
    body,
    canvasOps,
    getActiveElement,
    elements: doc._elements,
    getElementById: (id) => doc.getElementById(id),
    setTheme(nextTheme) {
      currentTable = nextTheme === "light" ? light : dark;
      theme = nextTheme;
    },
    fireMediaChange() {
      for (const fn of mediaListeners) fn({ matches: currentTable === light });
    }
  };
}

/** Write artifacts to disk, then read the bytes back — a real file open. */
function exportGrammarArtifactsToDisk() {
  const dir = mkdtempSync(join(tmpdir(), "vibe-debrief-6-6-"));
  const files = {};
  for (const grammar of GRAMMARS) {
    const html = buildGrammarArtifact(grammar);
    const filePath = join(dir, `export-${grammar}.html`);
    writeFileSync(filePath, html, "utf8");
    files[grammar] = { filePath, html: readFileSync(filePath, "utf8") };
  }
  return { dir, files };
}

describe("Story 6.6 — standalone HTML export parity (5 grammars, offline)", () => {
  it("writes the 5 grammar exports to disk, then opens each offline with a local X-Ray toggle and zero network", () => {
    const { dir, files } = exportGrammarArtifactsToDisk();
    try {
      for (const grammar of GRAMMARS) {
        const { filePath, html } = files[grammar];

        // Offline contract on the file bytes: no external URLs, no external
        // script/link, no dynamic evaluation, no network APIs in the script.
        assert.equal(/https?:\/\//.test(html), false, `${grammar} export must have zero external URLs`);
        assert.equal(/<script[^>]+src=/i.test(html), false, `${grammar} export must not load external scripts`);
        assert.equal(/<link\b/i.test(html), false, `${grammar} export must not load external stylesheets`);
        const scriptSource = extractInlineScript(html);
        assert.equal(scriptSource.includes("fetch("), false, `${grammar} script must not call fetch`);
        assert.equal(/XMLHttpRequest|sendBeacon/i.test(scriptSource), false, `${grammar} script must not use XHR/sendBeacon`);
        assert.equal(html.includes("eval("), false);
        assert.equal(html.includes("new Function"), false);

        // Open the file offline (vm sandbox has no network globals at all).
        const run = openArtifactOffline(html);
        const toggle = run.getElementById("btnXrayToggle");
        assert.ok(toggle, `${grammar} export must contain the X-Ray toggle button`);
        assert.equal(toggle.getAttribute("aria-pressed"), "false");
        assert.equal(run.body.getAttribute("data-xray-mode"), "plain");

        toggle.dispatchEvent({ type: "click" });
        assert.equal(run.body.getAttribute("data-xray-mode"), "tech", `${filePath}: toggle must switch body to tech mode`);
        assert.equal(toggle.getAttribute("data-mode"), "tech");
        assert.equal(toggle.getAttribute("aria-pressed"), "true");
        assert.match(toggle.textContent, /Tech/);

        toggle.dispatchEvent({ type: "click" });
        assert.equal(run.body.getAttribute("data-xray-mode"), "plain");
        assert.equal(toggle.getAttribute("aria-pressed"), "false");
        assert.match(toggle.textContent, /Plain/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders each grammar with a 460-wide viewBox, dash-flow kinetic edges, and grammar-specific structure", () => {
    const { dir, files } = exportGrammarArtifactsToDisk();
    try {
      for (const grammar of GRAMMARS) {
        const run = openArtifactOffline(files[grammar].html);
        const svg = run.getElementById("diagramSvg");
        const markup = svg.innerHTML;

        // 5-grammar diagramSpec contract: viewBoxWidth 460, <= 6 nodes, edges.
        assert.match(
          svg.getAttribute("viewBox") || "",
          new RegExp(`^0 0 460 \\d+$`),
          `${grammar} export SVG must keep the 460-wide viewBox`
        );
        const dnodeCount = svg.querySelectorAll(".dnode").length;
        assert.ok(dnodeCount >= 1 && dnodeCount <= 6, `${grammar} export must render 1..6 nodes`);
        assert.match(markup, /class="dash-flow"/, `${grammar} export edges must be kinetic dash-flow`);
        assert.match(markup, /url\(#vd-arrow/, `${grammar} export edges must use token arrow markers`);

        // Dual-coded SVG node titles (Plain <-> Tech tspan contract).
        assert.match(
          markup,
          /<text class="xray-dual"[^>]*><tspan class="xray-plain">[^<]+<\/tspan><tspan class="xray-tech">[^<]+<\/tspan><\/text>/,
          `${grammar} export node titles must be dual-coded`
        );

        // Grammar-specific structure (ported panel geometry).
        if (grammar === "sequence") {
          assert.match(markup, /stroke-dasharray="3 3"/, "sequence must draw dashed actor lifelines");
        } else if (grammar === "before-after") {
          assert.match(markup, />BEFORE</, "before-after must label the before lane");
          assert.match(markup, />AFTER</, "before-after must label the after lane");
          assert.doesNotMatch(
            markup,
            /<line [^>]*data-lane-bridge/,
            "before-after must never bridge the lanes (AD-14)"
          );
        } else if (grammar === "decision-tree") {
          assert.equal(dnodeCount, 4, "decision-tree must render root + 3 branch leaves");
          const rootBox = markup.match(/<g class="dnode"[^>]*data-id="d0"/);
          assert.ok(rootBox, "decision-tree must render the root node");
        } else if (grammar === "subway-map") {
          assert.match(markup, /r="3\.8"/, "subway-map must draw station dots");
          assert.match(
            markup,
            />COCKPIT HUD<|>MICRO BLOCKS</,
            "subway-map must label grouped layer tracks"
          );
        } else if (grammar === "flow-diff") {
          assert.match(markup, /width="3\.5"/, "flow-diff must draw left-accent bars");
        }

        // Keyboard node inspector still works in the grammar builder.
        // (renderDiagram() re-renders on selection, so re-query afterwards.)
        const firstNode = svg.querySelectorAll(".dnode")[0];
        firstNode.dispatchEvent({ type: "keydown", key: "Enter" });
        const inspector = run.getElementById("nodeInspector");
        assert.equal(inspector.classList.contains("has-selection"), true, `${grammar} Enter must select the node`);
        const nodesAfter = svg.querySelectorAll(".dnode");
        assert.equal(nodesAfter[0].getAttribute("aria-pressed"), "true");
        assert.equal(
          run.getActiveElement()?.getAttribute("data-id"),
          nodesAfter[0].getAttribute("data-id"),
          `${grammar} keyboard selection must focus the selected node`
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("re-styles SVG and Canvas with Field Desk Light tokens when prefers-color-scheme flips at runtime", () => {
    const { dir, files } = exportGrammarArtifactsToDisk();
    try {
      for (const grammar of GRAMMARS) {
        const run = openArtifactOffline(files[grammar].html, { theme: "dark" });
        const svg = run.getElementById("diagramSvg");
        assert.ok(svg.innerHTML.includes("#38bdf8"), `${grammar} dark SVG must use the accent token`);

        const mark = run.canvasOps.length;
        run.setTheme("light");
        run.fireMediaChange();

        assert.ok(svg.innerHTML.includes("#0284c7"), `${grammar} light SVG must re-render with the light accent`);
        assert.ok(svg.innerHTML.includes("#ffffff"), `${grammar} light SVG must use the light card fill`);
        assert.equal(svg.innerHTML.includes("#38bdf8"), false, `${grammar} light SVG must not leak the dark accent`);
        assert.equal(svg.innerHTML.includes("#182130"), false, `${grammar} light SVG must not leak the dark card fill`);

        const freshOps = run.canvasOps.slice(mark).map((o) => o.style);
        assert.ok(freshOps.length > 0, `${grammar} media change must re-draw the Canvas tour`);
        assert.ok(freshOps.includes("#f1ece1"), `${grammar} canvas must re-draw with the light stage token`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the embedded DATA payload JSON-valid with \\u003c escaping on hostile input", () => {
    const hostileTag = '<img src=x onerror="alert(1)">';
    const html = generateStandaloneHtmlArtifact(
      buildPanelStateFixture({
        debrief: {
          tldrHeadline: `Headline ${hostileTag}`,
          diagramSpec: {
            grammar: "flow-diff",
            title: "Hostile export",
            nodes: [
              { id: `node-${hostileTag}`, label: hostileTag, techLabel: "tech", sublabel: "Sub", role: "Role", risk: "high" },
              { id: "safe", label: "Safe", role: "Logic", risk: "low" }
            ],
            edges: []
          },
          waitingOnYou: {
            state: "reply",
            prompt: `Reply ${hostileTag}`,
            chips: [{ id: `chip-${hostileTag}`, label: "Yes", messagePrompt: "Yes." }]
          }
        }
      })
    );

    const dataLine = html.split("\n").find((line) => line.includes("var DATA ="));
    assert.ok(dataLine, "artifact must embed a DATA payload");
    assert.equal(dataLine.includes("<"), false, "DATA payload must escape every < as \\u003c");
    const payload = JSON.parse(dataLine.trim().replace(/^var DATA = /, "").replace(/;$/, ""));
    assert.equal(payload.diagram.grammar, "flow-diff");
    assert.equal(payload.waiting.state, "reply");

    // The escaped payload still parses and renders offline without injection.
    assert.equal(/<img\b/i.test(html), false, "hostile markup must never appear unescaped in the artifact file");
    const run = openArtifactOffline(html);
    const svg = run.getElementById("diagramSvg");
    assert.equal(/<img\b/i.test(svg.innerHTML), false, "hostile node markup must stay escaped in the SVG");
    assert.ok(
      svg.innerHTML.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"),
      "hostile node label must render escaped inside the SVG markup"
    );
    // The offline waiting chip still binds and reports its prompt safely.
    const chips = run.getElementById("waitingChipsRow").querySelectorAll(".action-chip");
    assert.equal(chips.length, 1, "hostile chip id must still render one offline chip");
    chips[0].dispatchEvent({ type: "click" });
    assert.equal(chips[0].classList.contains("selected"), true);
    assert.match(run.getElementById("waitOfflineNote").textContent, /Yes\./);
  });

  it("microBlocks work locally offline: choice pick, proof pill expand, waiting chip note, scene pill jump", () => {
    const html = buildGrammarArtifact("decision-tree");
    const run = openArtifactOffline(html);

    // 10s Radar statics: verdict, verification counts, waiting badge.
    assert.equal(run.getElementById("radarVerdictPill").textContent, "Built");
    assert.match(run.getElementById("radarVerifyCount").textContent, /1 verified · 1 unverified/);
    assert.ok(run.getElementById("radarWaitingStrip"));
    assert.match(run.body.textContent, /Pick a Choice/);

    // Choice grid: local pick (no chat dispatch offline).
    const choices = run.getElementById("choiceGrid").querySelectorAll(".choice-item");
    assert.equal(choices.length, 2, "decision-tree fixture must render the 2 choices");
    assert.ok(
      run.getElementById("choiceGrid").querySelectorAll(".tbar-track").length >= 2,
      "choice grid must render 34x4px trade-off bars"
    );
    choices[0].dispatchEvent({ type: "click" });
    assert.equal(choices[0].classList.contains("picked"), true, "clicked choice must be picked locally");
    assert.equal(choices[0].getAttribute("aria-pressed"), "true");
    assert.equal(choices[1].getAttribute("aria-pressed"), "false");
    assert.match(run.getElementById("choicePickedPill").textContent, /Selected: A/);
    assert.equal(run.getElementById("choicePickedPill").hasAttribute("hidden"), false);

    // Proof pills: expand/collapse the proof-detail locally.
    const pill = run.getElementById("proofPillRow").querySelectorAll(".proof-pill")[0];
    const detail = run.getElementById("proofDetail-0");
    assert.equal(detail.classList.contains("open"), false);
    pill.dispatchEvent({ type: "click" });
    assert.equal(detail.classList.contains("open"), true);
    assert.equal(pill.getAttribute("aria-expanded"), "true");
    pill.dispatchEvent({ type: "click" });
    assert.equal(detail.classList.contains("open"), false);
    assert.equal(pill.getAttribute("aria-expanded"), "false");

    // Waiting chips: local selection + honest offline note with the prompt.
    const chips = run.getElementById("waitingChipsRow").querySelectorAll(".action-chip");
    assert.equal(chips.length, 2);
    chips[0].dispatchEvent({ type: "click" });
    assert.equal(chips[0].classList.contains("selected"), true);
    assert.equal(chips[0].getAttribute("aria-pressed"), "true");
    assert.equal(chips[1].getAttribute("aria-pressed"), "false");
    const note = run.getElementById("waitOfflineNote");
    assert.equal(note.hasAttribute("hidden"), false);
    assert.match(note.textContent, /Offline export — send this reply from the live panel: Yes, ship it\./);

    // Canvas tour scene pills: jump to scene 2 and sync the active pill.
    const pills = run.getElementById("explainerScenePills").querySelectorAll(".scene-pill");
    assert.equal(pills.length, 2);
    assert.equal(pills[0].classList.contains("active"), true);
    pills[1].dispatchEvent({ type: "click" });
    assert.equal(pills[1].classList.contains("active"), true, "clicked scene pill must become active");
    assert.equal(pills[0].classList.contains("active"), false);
    assert.equal(pills[1].getAttribute("aria-pressed"), "true");
    assert.match(run.getElementById("sceneCaption").textContent, /Open the file with the network off\./);

    // Play/Pause buttons keep aria-pressed parity.
    const play = run.getElementById("btnPlayScene");
    const pause = run.getElementById("btnPauseScene");
    play.dispatchEvent({ type: "click" });
    assert.equal(play.getAttribute("aria-pressed"), "true");
    assert.equal(pause.getAttribute("aria-pressed"), "false");
    pause.dispatchEvent({ type: "click" });
    assert.equal(play.getAttribute("aria-pressed"), "false");
    assert.equal(pause.getAttribute("aria-pressed"), "true");
  });

  it("shares the X-Ray CSS-only swap contract with the panel (body[data-xray-mode] rules + pre-bound spans)", () => {
    const html = buildGrammarArtifact("sequence");
    assert.match(html, /<body data-xray-mode="plain">/);
    assert.match(html, /\.xray-dual > \.xray-plain \{ display:inline; \}/);
    assert.match(html, /\.xray-dual > \.xray-tech \{ display:none; \}/);
    assert.match(html, /body\[data-xray-mode="tech"\] \.xray-dual > \.xray-plain \{ display:none; \}/);
    assert.match(html, /body\[data-xray-mode="tech"\] \.xray-dual > \.xray-tech \{ display:inline; \}/);
    // Every dual-coded pair is pre-bound before the toggle (no re-render).
    const plainSpans = (html.match(/class="xray-plain"/g) || []).length;
    const techSpans = (html.match(/class="xray-tech"/g) || []).length;
    assert.ok(plainSpans >= 5, "export must pre-bind multiple xray-plain representations");
    assert.equal(techSpans, plainSpans, "every xray-plain must have a matching xray-tech");
    // Kinetic dash-flow animation exists and reduced motion disables it.
    assert.match(html, /@keyframes flowDash/);
    assert.match(html, /\.dash-flow \{ stroke-dasharray:5 4; animation:flowDash 1\.4s linear infinite; \}/);
    assert.match(html, /@media \(prefers-reduced-motion: reduce\)[^}]*animation:none !important/);
  });
});

// ============================================================================
// Story 7.3 — Mandatory 3-column Stage 2 HTML fallback & missing-banner (AD-17).
// export_html({ conceptSlug, targetPlugin }) must render the stage2-popout grid
// (How It Works / Key Trade-off / In Your Codebase), floating telemetry pill,
// and amber missing-banner with an Install CTA — fully offline.
// ============================================================================

describe("Story 7.3 — Stage 2 missing-plugin HTML fallback export", () => {
  const stage2Concepts = [
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
      stage2Prompt: "Diagram the SSE request lifecycle."
    }
  ];

  function stage2Artifact(options, debriefOverrides = {}) {
    return generateStandaloneHtmlArtifact(
      buildPanelStateFixture({
        debrief: {
          concepts: stage2Concepts,
          touchedFiles: ["scripts/debrief-engine.mjs"],
          ...debriefOverrides
        }
      }),
      options
    );
  }

  it("renders the 3-column stage2-popout grid from the matched concept stage2 with missing-banner, Install CTA, and telemetry pill", () => {
    const html = stage2Artifact({ conceptSlug: "sse-stream", targetPlugin: "visualize" });

    assert.match(html, /id="stage2Popout"/);
    assert.match(html, /class="stage2-popout"/);
    assert.match(html, /<h3>How It Works<\/h3>/);
    assert.match(html, /<h3>Key Trade-off<\/h3>/);
    assert.match(html, /<h3>In Your Codebase<\/h3>/);
    assert.match(html, /Client opens EventSource, server keeps connection open, writes SSE frames\./);
    assert.match(html, /Simplicity vs bidirectional\./);
    assert.match(html, /Look for EventSource constructor calls in frontend code\./);
    assert.match(html, /SSE Stream/);
    assert.match(html, /Interactive Gen UI/);

    // missing-banner + Install CTA + floating telemetry pill
    assert.match(html, /id="missingBanner"/);
    assert.match(html, /class="missing-banner"/);
    assert.match(html, /is not installed/);
    assert.match(html, /id="btnInstallPluginExport"[^>]*>Install visualize<\/button>/);
    assert.match(html, /id="stage2TelemetryPill"/);
    assert.match(html, /class="telemetry-pill"/);
    assert.match(html, /--telemetry-pill-bg:#0c111ad6/);
  });

  it("synthesizes the 3 columns from the debrief plan/result/consequences when conceptSlug is null", () => {
    const html = stage2Artifact({ conceptSlug: null, targetPlugin: "excalidraw" });

    assert.match(html, /id="stage2Popout"/);
    // buildDebriefFixture implementationReport drives the synthesized columns.
    assert.match(html, /<div class="stage2-deep-card how"><h3>How It Works<\/h3><div>Keep the change small\.<\/div><\/div>/);
    assert.match(html, /<div class="stage2-deep-card trade"><h3>Key Trade-off<\/h3><div>No breaking change\.<\/div><\/div>/);
    assert.match(html, /scripts\/debrief-engine\.mjs/);
    assert.match(html, /The view renders\./);
    // Concept stage2 copy must NOT leak into the null-slug fallback.
    assert.equal(html.includes("Client opens EventSource"), false);
    assert.match(html, /Install excalidraw/);
  });

  it("falls back to debrief synthesis when conceptSlug does not match any concept", () => {
    const html = stage2Artifact({ conceptSlug: "no-such-concept", targetPlugin: "vectorcraft" });
    assert.match(html, /id="stage2Popout"/);
    assert.match(html, /Keep the change small\./);
    assert.equal(html.includes("Client opens EventSource"), false);
  });

  it("keeps the plain export unchanged when no targetPlugin is passed (backward compatibility)", () => {
    const html = stage2Artifact({});
    assert.equal(html.includes('id="stage2Popout"'), false);
    assert.equal(html.includes('id="missingBanner"'), false);
    assert.equal(html.includes('class="stage2-deep-card'), false);
  });

  it("escapes hostile concept stage2 strings before HTML interpolation", () => {
    const html = generateStandaloneHtmlArtifact(
      buildPanelStateFixture({
        debrief: {
          concepts: [
            {
              slug: "xss",
              label: "<img src=x onerror=alert(1)>",
              targetPlugin: "designcraft",
              stage2: {
                howItWorks: "<script>alert(1)</script>",
                keyTradeOff: "\"><svg onload=alert(2)>",
                inYourCodebase: "safe"
              }
            }
          ]
        }
      }),
      { conceptSlug: "xss", targetPlugin: "designcraft" }
    );
    assert.equal(html.includes("<script>alert(1)</script>"), false);
    assert.equal(html.includes("<img src=x"), false);
    assert.equal(html.includes("<svg onload=alert(2)>"), false);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  it("opens offline: Install CTA reveals the local note with zero network and zero eval", () => {
    const html = stage2Artifact({ conceptSlug: "sse-stream", targetPlugin: "visualize" });

    assert.equal(/https?:\/\//.test(html), false, "fallback export must have zero external URLs");
    assert.equal(/<script[^>]+src=/i.test(html), false);
    assert.equal(/<link\b/i.test(html), false);
    assert.equal(html.includes("eval("), false);
    assert.equal(html.includes("new Function"), false);
    const scriptSource = extractInlineScript(html);
    assert.equal(scriptSource.includes("fetch("), false);
    assert.equal(/XMLHttpRequest|sendBeacon/i.test(scriptSource), false);

    const run = openArtifactOffline(html);
    const installBtn = run.getElementById("btnInstallPluginExport");
    assert.ok(installBtn, "offline artifact must contain the Install CTA");
    const note = run.getElementById("installOfflineNote");
    assert.ok(note, "offline artifact must contain the install note");
    assert.ok(note.hasAttribute("hidden"), "note starts hidden");

    installBtn.dispatchEvent({ type: "click" });
    assert.equal(note.hasAttribute("hidden"), false, "Install CTA must reveal the offline note locally");

    // The 3-column grid and telemetry pill survive the offline DOM parse.
    assert.ok(run.getElementById("stage2Popout"));
    assert.ok(run.getElementById("missingBanner"));
    assert.ok(run.getElementById("stage2TelemetryPill"));
    assert.equal(run.body.querySelectorAll(".stage2-deep-card").length, 3);
  });
});
