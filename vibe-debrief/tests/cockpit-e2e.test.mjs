import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import vm from "node:vm";

import { savePersistedState } from "../scripts/debrief-engine.mjs";
import {
  PANEL_HTML_PATH,
  createTempFixture,
  extractInlineScript,
  memoryDirectoryFor,
  readJsonFile,
  runHookRunner,
  runMcpServer
} from "./helpers.mjs";

const PANEL_HTML = readFileSync(PANEL_HTML_PATH, "utf8");

function mcpEnv(workspace, home, extra = {}) {
  return {
    ...home.env,
    ZCODE_WORKSPACE_ROOT: workspace.root,
    ZCODE_PROJECT_DIR: workspace.root,
    ...extra
  };
}

/**
 * Call a real MCP tool on the spawned scripts/mcp-server.mjs stdio server
 * against the isolated temp workspace & home.
 */
async function callRealMcpTool(name, args, { workspace, home, env = {} }) {
  const res = await runMcpServer({
    messages: [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args }
      }
    ],
    cwd: workspace.root,
    env: mcpEnv(workspace, home, env)
  });

  assert.equal(res.exitCode, 0, `MCP ${name} failed: ${res.stderr}`);
  assert.equal(res.stderr, "", `MCP ${name} wrote unexpected stderr: ${res.stderr}`);
  const lines = res.stdout.trim().split("\n");
  assert.equal(lines.length, 1, `MCP ${name} must emit 1 JSON-RPC frame`);
  const frame = JSON.parse(lines[0]);
  assert.equal(frame.jsonrpc, "2.0");
  assert.equal(frame.id, 1);
  assert.equal(frame.result?.isError, undefined, `MCP ${name} tool error: ${JSON.stringify(frame.result)}`);
  return frame.result;
}

/**
 * End-to-end Cockpit HUD harness: runs the real assets/panel.html inline script
 * in a lightweight DOM + postMessage bridge backed by real spawned scripts/mcp-server.mjs
 * processes reading and writing the isolated temp workspace & ZCODE_HOME_DIR.
 */
function createCockpitE2eHarness({
  workspace,
  home,
  initTheme = "dark",
  pushToolResultAfterExport = false,
  reducedMotion = false
}) {
  const elements = new Map();
  let activeElement = null;
  const outboundMessages = [];
  const toolCalls = [];
  const pendingRpcPromises = [];
  const canvasDrawOps = [];

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
    const tagRe = /<(g|div|button|input)\s+([^>]*class="[^"]*(?:diagram-node-group|history-item|file-badge|scene-pill|action-chip|choice-item|proof-pill|btn-promote-audit|chk-verify-box|concept-pill|stage1-drawer|popout-btn|stage1-close)[^"]*"[^>]*)>/gi;
    for (const m of html.matchAll(tagRe)) {
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
      if (m[1].toLowerCase() === "input" && /\bchecked\b/i.test(m[2])) {
        child.checked = true;
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
          if (selector.startsWith(".")) return e.classList.contains(selector.slice(1));
          if (selector.startsWith("#")) return e.id === selector.slice(1);
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

  const panelMarkup = PANEL_HTML.replace(/<script>[\s\S]*?<\/script>/gi, "");
  for (const match of panelMarkup.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi)) {
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

  const sandbox = {
    console: { warn() {}, error() {}, log() {} },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    performance,
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
      speechSynthesis: { cancel() {} },
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
              dispatchWindowMessage({
                jsonrpc: "2.0",
                id: msg.id,
                result: { hostContext: { theme: initTheme } }
              })
            );
          } else if (msg.method === "ui/message" && msg.id !== undefined) {
            queueMicrotask(() =>
              dispatchWindowMessage({
                jsonrpc: "2.0",
                id: msg.id,
                result: { ok: true }
              })
            );
          } else if (msg.method === "tools/call" && msg.id !== undefined) {
            toolCalls.push(msg.params);
            const p = callRealMcpTool(msg.params.name, msg.params.arguments || {}, { workspace, home })
              .then((toolResult) => {
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  result: toolResult
                });
                if (
                  pushToolResultAfterExport &&
                  msg.params.name === "vibe_debrief_export_html" &&
                  toolResult?.structuredContent
                ) {
                  dispatchWindowMessage({
                    jsonrpc: "2.0",
                    method: "ui/notifications/tool-result",
                    params: { structuredContent: toolResult.structuredContent }
                  });
                }
              })
              .catch((err) => {
                dispatchWindowMessage({
                  jsonrpc: "2.0",
                  id: msg.id,
                  error: { code: -32000, message: err.message }
                });
              });
            pendingRpcPromises.push(p);
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
    outboundMessages,
    toolCalls,
    canvasDrawOps,
    getActiveElement: () => activeElement,
    dispatchWindowEvent: (event) => sandbox.window.dispatchEvent(event),
    pushToolResult(structuredContent) {
      dispatchWindowMessage({
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: { structuredContent }
      });
    },
    async settle() {
      for (let i = 0; i < 6; i++) {
        while (pendingRpcPromises.length > 0) {
          const batch = pendingRpcPromises.splice(0, pendingRpcPromises.length);
          await Promise.all(batch);
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    }
  };
}

/**
 * Evaluate a generated standalone HTML artifact offline in vm to verify zero
 * network/eval issues and inspect Stage 2 / X-Ray / SVG / Canvas behavior.
 */
function runStandaloneExportOffline(html) {
  const elements = new Map();
  const windowListeners = new Map();
  let activeElement = null;

  function makeClassList() {
    const set = new Set();
    return {
      add: (...cls) => cls.forEach((c) => set.add(c)),
      remove: (...cls) => cls.forEach((c) => set.delete(c)),
      toggle: (c, force) => (force ? set.add(c) : set.delete(c)),
      contains: (c) => set.has(c)
    };
  }

  function makeEl(id, tag = "div") {
    const attrs = new Map();
    const el = {
      id,
      tagName: tag,
      style: {},
      textContent: "",
      _innerHTML: "",
      classList: makeClassList(),
      listeners: new Map(),
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      addEventListener(t, fn) {
        if (!this.listeners.has(t)) this.listeners.set(t, []);
        this.listeners.get(t).push(fn);
      },
      dispatchEvent(evt) {
        for (const fn of this.listeners.get(evt.type) || []) fn.call(this, { target: el, ...evt });
      },
      focus() {
        activeElement = el;
      },
      appendChild(child) {
        return child;
      },
      querySelectorAll: () => []
    };
    Object.defineProperty(el, "innerHTML", {
      get: () => el._innerHTML,
      set: (v) => {
        el._innerHTML = String(v ?? "");
      }
    });
    if (id) elements.set(id, el);
    return el;
  }

  const body = makeEl("__body__", "body");
  const documentElement = makeEl("__html__", "html");
  const markup = html.replace(/<script>[\s\S]*?<\/script>/gi, "");
  for (const m of markup.matchAll(/<([a-z0-9-]+)\s+([^>]*id="([^"]+)"[^>]*)>/gi)) {
    const el = elements.get(m[3]) || makeEl(m[3], m[1]);
    for (const a of m[2].matchAll(/([a-z0-9-]+)="([^"]*)"/gi)) {
      el.setAttribute(a[1], a[2]);
    }
  }

  const canvas = elements.get("expCanvas") || makeEl("expCanvas", "canvas");
  canvas.width = 600;
  canvas.height = 220;
  canvas.getContext = () => ({
    fillStyle: "",
    strokeStyle: "",
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

  const sandbox = {
    console: { warn() {}, error() {}, log() {} },
    setTimeout,
    clearTimeout,
    document: {
      body,
      documentElement,
      createElement: (tag) => makeEl("", tag),
      getElementById: (id) => elements.get(id) || makeEl(id),
      querySelectorAll: () => [],
      get activeElement() {
        return activeElement;
      }
    },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    window: {
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      addEventListener: (t, fn) => {
        if (!windowListeners.has(t)) windowListeners.set(t, []);
        windowListeners.get(t).push(fn);
      }
    }
  };

  vm.runInContext(extractInlineScript(html), vm.createContext(sandbox));
  return { elements, body };
}

describe("Story 7.5 — End-to-end Cockpit HUD suite (UJ-1..UJ-4 & snapshot compatibility)", () => {
  it("UJ-1: 10s bug isolation, Action chip ui/message, instant <16ms X-Ray toggle, FlowDiff node inspect & check-row MCP persistence", async () => {
    const { workspace, home, cleanup } = createTempFixture();
    workspace.write("src/webhook.mjs", "export function retryWebhook() { return 200; }\n");
    workspace.write("tests/webhook.test.mjs", "import assert from 'node:assert/strict';\n");

    try {
      // 1. Agent publishes a bug fix via real stdio MCP server
      await callRealMcpTool(
        "vibe_debrief_publish",
        {
          responseType: "bug",
          persona: "vibe-mentor",
          tldrHeadline: "Fixed webhook retry loop in two files.",
          realWorldAnalogy: "Like adding a circuit breaker to stop repeated doorbell rings.",
          verdict: "Solved",
          waitingOnYou: {
            state: "action",
            label: "Verify / Run",
            prompt: "Run the webhook retry test to confirm.",
            allowInlineReply: false,
            chips: [
              {
                id: "chip-run-webhook",
                key: "1",
                label: "Run webhook retry test",
                messagePrompt: "Run `node --test tests/webhook.test.mjs` and report the result."
              }
            ]
          },
          xray: {
            plain: {
              headline: "Fixed webhook retry loop in two files.",
              summaryBullets: ["Stopped the retry loop after 3 attempts."]
            },
            tech: {
              headline: "Guarded retryWebhook() in src/webhook.mjs (exit 0).",
              summaryBullets: ["Added maxRetries <= 3 guard in retryWebhook()."],
              symbols: ["retryWebhook()"],
              paths: ["src/webhook.mjs"],
              commands: ["node --test tests/webhook.test.mjs"],
              exitCodes: [0],
              proofLines: ["node --test tests/webhook.test.mjs -> exit 0"]
            }
          },
          diagram: {
            grammar: "flow-diff",
            title: "Webhook Retry Guard",
            nodes: [
              {
                id: "n1",
                label: "Webhook",
                sublabel: "Incoming 500",
                role: "API",
                file: "src/webhook.mjs",
                risk: "high",
                status: "active"
              },
              {
                id: "n2",
                label: "Retry Test",
                sublabel: "Passes",
                role: "Test",
                file: "tests/webhook.test.mjs",
                risk: "low",
                status: "done"
              }
            ],
            edges: [{ from: "n1", to: "n2", stepNumber: 1, label: "Guards", risk: "low", animated: true }]
          },
          bugReport: {
            cause: "Retries ran without an attempt cap.",
            plan: "Cap retries at three in retryWebhook.",
            succeeded: "yes",
            successSummary: "Webhook returns 200 on recovery.",
            consequences: "Prevents duplicate delivery storms."
          },
          proofClaims: [
            {
              claim: "Retry guard passes.",
              evidence: "node --test tests/webhook.test.mjs",
              status: "verified"
            }
          ],
          uncertaintyAudit: [
            {
              area: "Timeout jitter",
              reason: "Backoff jitter was mocked in unit tests.",
              riskLevel: "medium"
            }
          ],
          verificationChecklist: [
            {
              id: "chk-uj1-1",
              text: "Verify retryWebhook stops after 3 attempts",
              source: "CLI",
              risk: "low",
              checked: false
            }
          ],
          touchedFiles: ["src/webhook.mjs", "tests/webhook.test.mjs"]
        },
        { workspace, home }
      );

      // 2. Mount real panel.html connected to real MCP server
      const env = createCockpitE2eHarness({ workspace, home });
      await env.settle();

      assert.equal(env.elements.get("radarVerdictPill").textContent, "Solved");
      assert.equal(env.elements.get("diagramSvg").getAttribute("data-grammar"), "flow-diff");
      assert.equal(env.elements.get("waitingBadgeText").textContent, "Verify / Run");

      // 3. X-Ray Plain <-> Tech instant toggle (< 16ms, zero RPCs)
      const callsBeforeXray = env.toolCalls.length;
      const t0 = performance.now();
      env.elements.get("btnXrayToggle").dispatchEvent({ type: "click" });
      const elapsedMs = performance.now() - t0;
      assert.ok(elapsedMs < 16, `X-Ray toggle took ${elapsedMs.toFixed(2)}ms (must be < 16ms)`);
      assert.equal(env.toolCalls.length, callsBeforeXray, "X-Ray toggle must trigger zero RPCs");
      assert.equal(env.elements.get("appShell").getAttribute("data-xray-mode"), "tech");
      assert.match(env.elements.get("tldrHeadline").innerHTML, /retryWebhook\(\)/);

      // 4. Keyboard node inspection & toggle-off on FlowDiff SVG node
      const nodes = env.elements.get("diagramSvg").querySelectorAll(".diagram-node-group");
      assert.equal(nodes.length, 2);
      nodes[0].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
      assert.match(env.elements.get("nodeInspectorBar").innerHTML, /src\/webhook\.mjs/);
      nodes[0].dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
      assert.equal(env.elements.get("nodeInspectorBar").innerHTML.includes("Click or press Enter on any diagram node"), true);

      // 5. Waiting On You action-chip dispatches ui/message + marks selected
      const chip = env.elements.get("waitingChipsRow").querySelectorAll(".action-chip")[0];
      assert.ok(chip, "Action chip must be rendered");
      chip.dispatchEvent({ type: "click" });
      await env.settle();
      const actionMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
      assert.ok(actionMsg, "Action chip click must dispatch ui/message");
      assert.match(actionMsg.params.content[0].text, /tests\/webhook\.test\.mjs/);
      assert.ok(env.elements.get("toastBanner").classList.contains("toast-ok"));

      // 6. Check-row toggle persists via real MCP vibe_debrief_toggle_check to disk
      const chkBox = env.elements.get("bugOversightBlock").querySelectorAll(".chk-verify-box")[0];
      assert.ok(chkBox, "Verification checkbox must be rendered");
      chkBox.checked = true;
      chkBox.dispatchEvent({ type: "change" });
      await env.settle();

      const persisted = readJsonFile(workspace.statePath);
      const savedChk = persisted.currentDebrief.verificationChecklist.find((c) => c.id === "chk-uj1-1");
      assert.equal(savedChk?.checked, true, "vibe_debrief_toggle_check must persist checked=true on disk");
    } finally {
      cleanup();
    }
  });

  it("UJ-2: Multi-intent Choice + Stage 1 <100ms drawer + Stage 2 installed ui/message & missing-plugin HTML fallback + tool-result survival + Minimal/Visual tour", async () => {
    const { workspace, home, cleanup } = createTempFixture();
    // Install ONLY `visualize`; `vectorcraft` remains uninstalled so we test both branches end-to-end.
    home.write(
      ".zcode/cli/plugins/installed_plugins.json",
      JSON.stringify({
        plugins: [
          { name: "visualize", version: "0.1.2", enabled: true }
        ]
      })
    );

    try {
      // 1. Publish hybrid multi-intent debrief with Sequence diagram, Choice, and 2 Concepts
      await callRealMcpTool(
        "vibe_debrief_publish",
        {
          responseType: "implementation",
          persona: "visual-mapper",
          tldrHeadline: "Added streaming cache boundary with two options.",
          realWorldAnalogy: "Like a live radio feed paired with a rain barrel.",
          verdict: "Built",
          waitingOnYou: {
            state: "choice",
            label: "Pick a Choice",
            prompt: "Select cache strategy A or B.",
            chips: []
          },
          choices: [
            {
              id: "opt-a",
              key: "A",
              title: "Sliding window cache",
              summary: "Simple fixed memory footprint.",
              speedScore: 4,
              safetyScore: 3,
              messagePrompt: "Proceed with Option A: Sliding window cache."
            },
            {
              id: "opt-b",
              key: "B",
              title: "Token bucket limiter",
              summary: "Smooth burst control.",
              speedScore: 3,
              safetyScore: 5,
              messagePrompt: "Proceed with Option B: Token bucket limiter."
            }
          ],
          diagram: {
            grammar: "sequence",
            title: "SSE Cache Flow",
            nodes: [
              { id: "n1", label: "Client", role: "View", risk: "low", status: "done" },
              { id: "n2", label: "SSE", role: "API", risk: "medium", status: "active" },
              { id: "n3", label: "Cache", role: "State", risk: "low", status: "done" }
            ],
            edges: [
              { from: "n1", to: "n2", stepNumber: 1, label: "Subscribe", risk: "low" },
              { from: "n2", to: "n3", stepNumber: 2, label: "Read", risk: "low" }
            ]
          },
          concepts: [
            {
              slug: "sse-stream",
              label: "SSE Stream",
              techSymbol: "EventSource",
              targetPlugin: "visualize",
              stage1: {
                definition: "Server pushes updates over one open HTTP stream.",
                analogy: "Like tuning into a live radio station.",
                microVisualSpec: { type: "loop-3node", nodes: ["Client", "Stream", "Chunk"] }
              },
              stage2: {
                howItWorks: "Client connects once via EventSource; server writes text/event-stream frames.",
                keyTradeOff: "One-way only, but far simpler than WebSockets.",
                inYourCodebase: "Handled by the SSE route and EventSource listener."
              },
              stage2Prompt: "Create an interactive SSE stream simulation."
            },
            {
              slug: "token-bucket",
              label: "Token Bucket",
              techSymbol: "RateLimiter",
              targetPlugin: "vectorcraft",
              stage1: {
                definition: "Refills request tokens at a steady rate.",
                analogy: "Like an arcade coin jar that fills every second.",
                microVisualSpec: { type: "pipeline-3node", nodes: ["Refill", "Bucket", "Gate"] }
              },
              stage2: {
                howItWorks: "Each incoming request consumes a token; empty buckets return 429.",
                keyTradeOff: "Allows short bursts while enforcing average throughput.",
                inYourCodebase: "Applied before opening new SSE client streams."
              },
              stage2Prompt: "Draw a clean vector schematic of the token bucket."
            }
          ],
          implementationReport: {
            objective: "Support live SSE updates safely.",
            planAndWhy: "Combine EventSource streaming with a rate-limit boundary.",
            result: "Hybrid stream and limiter flow ready.",
            consequences: "Requires choosing cache strategy A or B."
          }
        },
        { workspace, home }
      );

      // Enable pushToolResultAfterExport to simulate ZCode host pushing ui/notifications/tool-result
      // immediately after vibe_debrief_export_html returns (high-risk check AD-10/AD-17).
      const env = createCockpitE2eHarness({
        workspace,
        home,
        pushToolResultAfterExport: true
      });
      await env.settle();

      // Verify Choice dispatch
      const choiceBtn = env.elements.get("choiceGrid").querySelectorAll(".choice-item")[0];
      assert.ok(choiceBtn, "Choice grid item must render");
      choiceBtn.dispatchEvent({ type: "click" });
      await env.settle();
      const choiceMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
      assert.match(choiceMsg.params.content[0].text, /Option A/);

      // Stage 1: click `SSE Stream` pill -> opens inline in < 100ms with zero RPCs
      const pills = env.elements.get("microBlockConcepts").querySelectorAll(".concept-pill");
      assert.equal(pills.length, 2);
      const callsBeforeStage1 = env.toolCalls.length;
      const t0 = performance.now();
      pills[0].dispatchEvent({ type: "click" });
      const stage1Ms = performance.now() - t0;
      assert.ok(stage1Ms < 100, `Stage 1 drawer took ${stage1Ms.toFixed(2)}ms (must be < 100ms)`);
      assert.equal(env.toolCalls.length, callsBeforeStage1, "Stage 1 open must make zero RPCs");
      assert.ok(env.elements.get("microBlockConcepts").innerHTML.includes("stage1MicroSvg"));

      // Stage 2 (Installed plugin `visualize`): dispatches structured ui/message + toast-ok
      env.elements.get("btnOpenStage2").dispatchEvent({ type: "click" });
      await env.settle();
      const stage2InstalledMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
      assert.match(stage2InstalledMsg.params.content[0].text, /sse-stream/);
      assert.match(stage2InstalledMsg.params.content[0].text, /diagramSpec/);
      assert.ok(env.elements.get("toastBanner").classList.contains("toast-ok"));

      // Stage 2 (Missing plugin `vectorcraft`): triggers real MCP vibe_debrief_export_html,
      // writes Stage 2 3-column HTML to disk, survives immediate tool-result push, keeps missing-banner visible
      pills[1].dispatchEvent({ type: "click" });
      env.elements.get("btnOpenStage2").dispatchEvent({ type: "click" });
      await env.settle();

      const exportCall = env.toolCalls.find(
        (c) => c.name === "vibe_debrief_export_html" && c.arguments?.targetPlugin === "vectorcraft"
      );
      assert.ok(exportCall, "Missing plugin must invoke vibe_debrief_export_html");
      assert.equal(exportCall.arguments.conceptSlug, "token-bucket");

      const banner = env.elements.get("missingPluginBanner");
      assert.equal(banner.style.display, "flex", "missing-banner must stay visible after tool-result push");
      assert.ok(banner.classList.contains("visible"));
      const artifactHref = env.elements.get("missingArtifactLink").getAttribute("href");
      assert.ok(artifactHref && existsSync(artifactHref), `Exported HTML must exist on disk at ${artifactHref}`);

      const exportedHtml = readFileSync(artifactHref, "utf8");
      assert.match(exportedHtml, /stage2-popout/);
      assert.match(exportedHtml, /How It Works/);
      assert.match(exportedHtml, /Key Trade-off/);
      assert.match(exportedHtml, /In Your Codebase/);
      assert.match(exportedHtml, /Install vectorcraft/);
      assert.equal(/\beval\(|new Function\s*\(/.test(exportedHtml), false);

      // Run exported HTML offline in vm to verify zero runtime failures
      const offline = runStandaloneExportOffline(exportedHtml);
      assert.ok(offline.elements.get("stage2Grid") || exportedHtml.includes("stage2-deep-card"));

      // Install CTA dispatches 1-click ui/message
      env.elements.get("btnInstallMissingPlugin").dispatchEvent({ type: "click" });
      await env.settle();
      const installMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
      assert.match(installMsg.params.content[0].text, /Install Plugin/);
      assert.match(installMsg.params.content[0].text, /vectorcraft/);

      // Tiny-turn Minimal Mode + Anytime Visual Generate Quick Tour
      await callRealMcpTool(
        "vibe_debrief_publish",
        {
          responseType: "implementation",
          tldrHeadline: "Trimmed trailing space in README.",
          realWorldAnalogy: "Like wiping a smudge off glass.",
          minimalMode: true,
          waitingOnYou: { state: "none", label: "All Clear", prompt: "Done.", chips: [] },
          implementationReport: {
            objective: "Format README.",
            planAndWhy: "Remove extra whitespace.",
            result: "Clean file.",
            consequences: "No code impact."
          }
        },
        { workspace, home }
      );
      const minEnv = createCockpitE2eHarness({ workspace, home });
      await minEnv.settle();
      assert.equal(minEnv.elements.get("minimalStrip").style.display, "flex");
      minEnv.elements.get("btnMinimalExpand").dispatchEvent({ type: "click" });
      assert.notEqual(minEnv.elements.get("radarCard").style.display, "none");

      // Switch to Visual tab on minimal turn -> Anytime Visual offers Generate Quick Tour via real MCP
      minEnv.elements.get("tabBtnVisual").dispatchEvent({ type: "click" });
      assert.equal(minEnv.elements.get("visualEmptyPrompt").style.display, "flex");
      minEnv.elements.get("btnGenerateQuickTour").dispatchEvent({ type: "click" });
      await minEnv.settle();
      assert.ok(
        minEnv.toolCalls.some((c) => c.name === "vibe_debrief_generate_explainer"),
        "Generate Quick Tour must call real MCP vibe_debrief_generate_explainer"
      );
      assert.equal(minEnv.elements.get("explainerStageWrap").style.display, "block");
    } finally {
      cleanup();
    }
  });

  it("UJ-3: Cost-aware Clarification via dynamic model discovery (non-Argon) after low-confidence Stop hook & Reply inline box", async () => {
    const { workspace, home, cleanup } = createTempFixture({
      home: {
        providerConfig: {
          config: {
            providerConfigRules: {
              providerRules: [
                {
                  providerId: "anthropic",
                  providerName: "Anthropic",
                  enabled: true,
                  config: {
                    access: { type: "api-key", apiKey: "sk-ant-test" },
                    modelOrder: ["claude-opus-4-5", "claude-haiku-4-5"]
                  }
                },
                {
                  providerId: "openai",
                  providerName: "OpenAI",
                  enabled: true,
                  config: {
                    access: { type: "api-key", apiKey: "sk-openai-test" },
                    modelOrder: ["gpt-5", "gpt-5-nano"]
                  }
                }
              ]
            }
          }
        }
      }
    });

    try {
      // 1. Simulate failed command in post-tool and unstructured error reply in Stop hook
      const promptRes = await runHookRunner(
        "user-prompt",
        { prompt: "Why did the migration fail?" },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.equal(promptRes.exitCode, 0);

      const bashRes = await runHookRunner(
        "post-tool",
        { tool_name: "Bash", tool_response: { stderr: "Error: migration failed on column X" } },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.equal(bashRes.exitCode, 0);

      const stopRes = await runHookRunner(
        "stop",
        {
          last_assistant_message:
            "Well there could be several things going on in the schema migration table and maybe a lock or column mismatch occurred."
        },
        { cwd: workspace.root, env: mcpEnv(workspace, home) }
      );
      assert.equal(stopRes.exitCode, 0);

      const stateOnDisk = readJsonFile(workspace.statePath);
      assert.ok(stateOnDisk.currentDebrief.heuristicConfidence < 0.55);

      // 2. Mount panel: unclear-box renders with raw quote + cheapest non-Argon model
      const env = createCockpitE2eHarness({ workspace, home });
      await env.settle();

      assert.equal(env.elements.get("microBlockUnclear").style.display, "flex");
      assert.ok(env.elements.get("unclearRawQuote").textContent.length > 0);
      assert.ok(env.elements.get("unclearRawQuote").textContent.length <= 280);

      // Toggle Show Raw Reply
      env.elements.get("btnShowRawReply").dispatchEvent({ type: "click" });
      assert.equal(env.elements.get("unclearRawReplyBox").style.display, "block");
      assert.equal(env.elements.get("btnShowRawReply").getAttribute("aria-expanded"), "true");

      // Click Clarify -> dispatches [Vibe Debrief — Clarify] with discovered cheap model (not hardcoded Argon)
      env.elements.get("btnClarifyFast").dispatchEvent({ type: "click" });
      await env.settle();
      const clarifyMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
      assert.ok(clarifyMsg, "Clarify must dispatch ui/message");
      const clarifyText = clarifyMsg.params.content[0].text;
      assert.match(clarifyText, /^\[Vibe Debrief — Clarify\]/);
      assert.match(clarifyText, /gpt-5-nano|claude-haiku-4-5/);
      assert.equal(clarifyText.includes("gemini-4-argon"), false, "Must never hardcode Argon when another cheapest model is configured");

      // 3. Refreshed turn returns with Waiting On You: Reply (inline-reply-box)
      const clarified = await callRealMcpTool(
        "vibe_debrief_publish",
        {
          responseType: "bug",
          tldrHeadline: "Migration needs explicit column default.",
          realWorldAnalogy: "Like adding a fallback seat before boarding.",
          heuristicConfidence: 0.92,
          waitingOnYou: {
            state: "reply",
            label: "Answer Question",
            prompt: "Should the default value be 0 or null?",
            allowInlineReply: true,
            chips: []
          },
          bugReport: {
            cause: "Column X lacked a default.",
            plan: "Add default 0 or null.",
            succeeded: "partial",
            successSummary: "Awaiting user choice.",
            consequences: "Safe once default is chosen."
          }
        },
        { workspace, home }
      );
      env.pushToolResult(clarified.structuredContent);
      await env.settle();

      assert.equal(env.elements.get("inlineReplyBox").style.display, "flex");
      const input = env.elements.get("inlineReplyInput");
      input.value = "Use default 0";
      env.elements.get("btnSendInlineReply").dispatchEvent({ type: "click" });
      await env.settle();
      const replyMsg = env.outboundMessages.filter((m) => m.method === "ui/message").pop();
      assert.match(replyMsg.params.content[0].text, /Use default 0/);
      assert.equal(input.value, "");
    } finally {
      cleanup();
    }
  });

  it("UJ-4: Promotes audit item to MEMORY.md via real MCP confirm_lesson & displays in Memory & History", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      await callRealMcpTool(
        "vibe_debrief_publish",
        {
          responseType: "implementation",
          tldrHeadline: "Added atomic temp-rename state persistence.",
          realWorldAnalogy: "Like writing on a fresh sheet before swapping it in.",
          uncertaintyAudit: [
            {
              area: "Windows rename lock",
              reason: "Missing atomic write temp-rename retry on EPERM.",
              riskLevel: "high"
            }
          ],
          implementationReport: {
            objective: "Protect state writes.",
            planAndWhy: "Write sibling .tmp then renameSync.",
            result: "Atomic writes succeed.",
            consequences: "Prevents partial JSON corruption."
          }
        },
        { workspace, home }
      );

      const env = createCockpitE2eHarness({ workspace, home });
      await env.settle();

      // Promote audit-row -> prefill lesson-form -> add How to apply -> Confirm & Save
      const promoteBtn = env.elements.get("implOversightBlock").querySelectorAll(".btn-promote-audit")[0];
      assert.ok(promoteBtn, "Audit promote button must render");
      promoteBtn.dispatchEvent({ type: "click" });

      assert.equal(env.elements.get("customLessonForm").style.display, "block");
      assert.match(env.elements.get("customLessonTitle").value, /Windows rename lock/);
      env.elements.get("customLessonHow").value = "Always write to sibling .tmp and retry EPERM on Windows.";
      env.elements.get("btnSaveCustomLesson").dispatchEvent({ type: "click" });
      await env.settle();

      const memDir = memoryDirectoryFor(home, workspace.root);
      const memoryIndexPath = join(memDir, "MEMORY.md");
      assert.equal(existsSync(memoryIndexPath), true, "MEMORY.md must be written under ZCODE_HOME_DIR");
      const indexText = readFileSync(memoryIndexPath, "utf8");
      assert.match(indexText, /Windows rename lock/i);

      // Switch to Memory & History tab and verify bank + MEMORY.md preview + history snapshot replay
      env.elements.get("tabBtnMemory").dispatchEvent({ type: "click" });
      assert.match(env.elements.get("confirmedTotalPill").textContent, /^1 saved/);
      assert.match(env.elements.get("memoryIndexPreviewBox").textContent, /Windows rename lock/i);
      assert.ok(env.elements.get("confirmedLessonsBankList").innerHTML.includes("Double-check Windows rename lock"));

      const histItems = env.elements.get("historyListContainer").querySelectorAll(".history-item");
      assert.ok(histItems.length >= 1, "History snapshot list must contain the turn");
      histItems[0].dispatchEvent({ type: "click" });
      assert.equal(env.elements.get("tab-hud").style.display, "block");
      assert.equal(env.elements.get("historySnapshotBanner").style.display, "flex");
      env.elements.get("btnReturnLatest").dispatchEvent({ type: "click" });
      assert.equal(env.elements.get("historySnapshotBanner").style.display, "none");
    } finally {
      cleanup();
    }
  });

  it("Backward-compatibility: upgrades authentic v0.2.0 and v0.3.0 state snapshots end-to-end across MCP, Panel HUD, History & Export", async () => {
    for (const [label, seedState] of [
      [
        "v0.2.0",
        {
          projectName: "legacy-v020-app",
          activePersona: "vibe-mentor",
          ste100Enabled: true,
          turnCount: 3,
          currentDebrief: {
            id: "v020-current",
            createdAt: "2026-10-01T10:00:00.000Z",
            responseType: "bug",
            tldrHeadline: "Fixed null token crash.",
            realWorldAnalogy: "Like checking your ticket before boarding.",
            diagram: {
              diagramType: "cause-effect",
              title: "Auth Guard",
              nodes: [
                { id: "n1", label: "Login", role: "UI", risk: "low", status: "done" },
                { id: "n2", label: "Token", role: "Auth", risk: "high", status: "active" }
              ],
              edges: [{ from: "n1", to: "n2", stepNumber: 1, label: "Validates", risk: "medium" }]
            },
            bugReport: {
              cause: "Token was null.",
              plan: "Guard null token.",
              succeeded: "yes",
              successSummary: "Login succeeds.",
              consequences: "Safe auth check."
            },
            touchedFiles: ["src/auth.mjs"]
          },
          history: [
            {
              id: "v020-prev",
              createdAt: "2026-10-01T09:00:00.000Z",
              responseType: "implementation",
              tldrHeadline: "Created initial auth module.",
              implementationReport: {
                objective: "Create auth.",
                planAndWhy: "Modular file.",
                result: "Auth file added.",
                consequences: "Ready for guard."
              }
            }
          ]
        }
      ],
      [
        "v0.3.0",
        {
          projectName: "legacy-v030-app",
          activePersona: "visual-mapper",
          ste100Enabled: true,
          turnCount: 5,
          confirmedLessons: [
            {
              id: "l-030",
              slug: "guard-null-tokens",
              title: "Guard null tokens",
              summary: "Always validate token presence early.",
              memoryType: "feedback",
              confirmed: true
            }
          ],
          currentDebrief: {
            id: "v030-current",
            createdAt: "2026-11-10T12:00:00.000Z",
            responseType: "implementation",
            tldrHeadline: "Added theme parity across exports.",
            realWorldAnalogy: "Like matching day and night cockpit dials.",
            diagram: {
              diagramType: "architecture",
              title: "Theme Parity",
              nodes: [
                { id: "n1", label: "Tokens", role: "CSS", risk: "low", status: "done" },
                { id: "n2", label: "Export", role: "HTML", risk: "low", status: "done" }
              ],
              edges: [{ from: "n1", to: "n2", stepNumber: 1, label: "Styles", risk: "low" }]
            },
            implementationReport: {
              objective: "Support light theme.",
              planAndWhy: "Share CSS variables.",
              result: "Parity complete.",
              consequences: "Readable in daylight."
            },
            proofClaims: [{ claim: "Theme tests pass", evidence: "node --test", status: "verified" }],
            verificationChecklist: [{ id: "chk-030", text: "Check daylight contrast", source: "UI", risk: "low", checked: true }],
            ste100Metrics: { score: 92, readTimeSec: 18, grade: "STE-80" },
            explainerScenes: []
          },
          history: []
        }
      ]
    ]) {
      const { workspace, home, cleanup } = createTempFixture();
      try {
        savePersistedState(workspace.root, seedState);

        // Load via real MCP and mount into panel
        const env = createCockpitE2eHarness({ workspace, home });
        await env.settle();

        assert.equal(
          env.elements.get("panelWorkspace").textContent,
          `· ${seedState.projectName}`,
          `${label} project name must render`
        );
        assert.ok(env.elements.get("radarVerdictPill").textContent.length > 0, `${label} must synthesize OQ-5 verdict`);
        const grammar = env.elements.get("diagramSvg").getAttribute("data-grammar");
        assert.ok(
          ["sequence", "flow-diff", "subway-map", "before-after", "decision-tree"].includes(grammar),
          `${label} legacy diagramType must map to a valid 5-grammar value (got ${grammar})`
        );

        // Verify Gear -> Export HTML works cleanly on upgraded snapshot
        env.elements.get("gearExportHtmlBtn").dispatchEvent({ type: "click" });
        await env.settle();
        const exportCall = env.toolCalls.find((c) => c.name === "vibe_debrief_export_html");
        assert.ok(exportCall, `${label} Gear Export HTML must call MCP export_html`);
        const artifactsDir = workspace.path(".zcode", "vibe-debrief-artifacts");
        const artifactFiles = readdirSync(artifactsDir).filter((f) => f.endsWith(".html"));
        assert.equal(artifactFiles.length, 1, `${label} must write one exported HTML file`);
        const exportedHtml = readFileSync(join(artifactsDir, artifactFiles[0]), "utf8");
        runStandaloneExportOffline(exportedHtml);
        assert.ok(
          env.elements.get("toastBanner").classList.contains("toast-ok"),
          `${label} HTML export must succeed with toast-ok`
        );

        if (seedState.history.length > 0) {
          env.elements.get("tabBtnMemory").dispatchEvent({ type: "click" });
          const histItems = env.elements.get("historyListContainer").querySelectorAll(".history-item");
          assert.ok(histItems.length >= 1, `${label} history item must render`);
          histItems[0].dispatchEvent({ type: "click" });
          assert.equal(env.elements.get("historySnapshotBanner").style.display, "flex");
          env.elements.get("btnReturnLatest").dispatchEvent({ type: "click" });
          assert.equal(env.elements.get("historySnapshotBanner").style.display, "none");
        }
      } finally {
        cleanup();
      }
    }
  });
});
