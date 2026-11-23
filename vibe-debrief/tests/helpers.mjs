import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(TESTS_DIR, "..");
export const ENGINE_PATH = join(REPO_ROOT, "scripts", "debrief-engine.mjs");
export const MCP_SERVER_PATH = join(REPO_ROOT, "scripts", "mcp-server.mjs");
export const HOOK_RUNNER_PATH = join(REPO_ROOT, "scripts", "hook-runner.mjs");
export const PANEL_HTML_PATH = join(REPO_ROOT, "assets", "panel.html");

function createTempRoot(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function createFileTools(root) {
  return {
    path(...segments) {
      return join(root, ...segments);
    },
    write(relativePath, content = "") {
      const target = join(root, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
      return target;
    },
    read(relativePath) {
      return readFileSync(join(root, relativePath), "utf8");
    },
    exists(relativePath) {
      return existsSync(join(root, relativePath));
    }
  };
}

/**
 * Create a disposable workspace with its own .zcode state directory.
 * Call cleanup() in afterEach/after so no temp files survive a test run.
 */
export function createTempWorkspace({ prefix = "vibe-debrief-ws-", files = {} } = {}) {
  const root = createTempRoot(prefix);
  const tools = createFileTools(root);
  const workspace = {
    root,
    ...tools,
    statePath: join(root, ".zcode", "vibe-debrief-state.json"),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    }
  };
  for (const [relativePath, content] of Object.entries(files)) {
    workspace.write(relativePath, content);
  }
  return workspace;
}

/**
 * Create a disposable home directory for ZCODE_HOME_DIR tests.
 * providerConfig / setting / credentials are written to <home>/.zcode/v2/.
 */
export function createTempHome({
  prefix = "vibe-debrief-home-",
  fixtures = {},
  providerConfig = null,
  setting = null,
  credentials = null
} = {}) {
  const root = createTempRoot(prefix);
  const tools = createFileTools(root);
  const zcodeV2Dir = join(root, ".zcode", "v2");
  const memoryProjectsRoot = join(root, ".zcode", "cli", "memories", "projects");
  mkdirSync(zcodeV2Dir, { recursive: true });
  mkdirSync(memoryProjectsRoot, { recursive: true });

  const home = {
    root,
    ...tools,
    env: { ZCODE_HOME_DIR: root },
    zcodeV2Dir,
    memoryProjectsRoot,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    }
  };

  for (const [relativePath, content] of Object.entries(fixtures)) {
    home.write(relativePath, content);
  }
  if (providerConfig !== null) {
    home.write(".zcode/v2/provider_config.json", JSON.stringify(providerConfig, null, 2));
  }
  if (setting !== null) {
    home.write(".zcode/v2/setting.json", JSON.stringify(setting, null, 2));
  }
  if (credentials !== null) {
    home.write(".zcode/v2/credentials.json", JSON.stringify(credentials, null, 2));
  }
  return home;
}

/**
 * Create one disposable workspace and home pair. Tests that touch both the
 * workspace state file and ZCode home data (memory, model discovery) use this
 * so a single cleanup() removes both roots in a fixed order.
 */
export function createTempFixture({
  workspace: workspaceOptions = {},
  home: homeOptions = {}
} = {}) {
  const workspace = createTempWorkspace(workspaceOptions);
  const home = createTempHome(homeOptions);
  return {
    workspace,
    home,
    cleanup() {
      workspace.cleanup();
      home.cleanup();
    }
  };
}

/**
 * Normalize a workspace path the same way resolveZCodeMemoryDirectory() does,
 * so tests can predict the isolated memory directory without duplicating rules.
 */
export function workspaceSlug(workspaceRoot) {
  return basename(workspaceRoot).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

/** Predict the home-backed memory directory for a temp workspace. */
export function memoryDirectoryFor(home, workspaceRoot) {
  return join(home.memoryProjectsRoot, workspaceSlug(workspaceRoot), "memory");
}

/**
 * Build a complete debrief fixture. Override only the fields the test exercises;
 * ensureDebriefEnriched() fills any remaining diagram/proof defaults.
 */
export function buildDebriefFixture(overrides = {}) {
  return {
    id: "fixture-debrief",
    createdAt: "2026-01-01T00:00:00.000Z",
    responseType: "implementation",
    persona: "vibe-mentor",
    tldrHeadline: "Add one safe panel view.",
    realWorldAnalogy: "Think of a clear dashboard.",
    implementationReport: {
      objective: "Add one panel view.",
      planAndWhy: "Keep the change small.",
      result: "The view renders.",
      consequences: "No breaking change."
    },
    bugReport: {
      cause: "The token was undefined.",
      plan: "Guard the token.",
      succeeded: "yes",
      successSummary: "The fix holds.",
      consequences: "No side effects."
    },
    proofClaims: [
      { claim: "Tests pass.", evidence: "node --test tests/", status: "verified" }
    ],
    uncertaintyAudit: [
      { area: "Edge cases", reason: "Check empty input.", riskLevel: "medium" }
    ],
    verificationChecklist: [
      { id: "chk-fixture-1", text: "Run the suite.", source: "CLI", risk: "low", checked: false }
    ],
    visualFlow: [
      { step: "1", title: "Objective", subtitle: "Goal", status: "done" },
      { step: "2", title: "Build", subtitle: "Change", status: "done" },
      { step: "3", title: "Verify", subtitle: "Check", status: "done" },
      { step: "4", title: "Ship", subtitle: "Result", status: "active" }
    ],
    diagram: {
      diagramType: "architecture",
      title: "Fixture Flow",
      nodes: [
        {
          id: "n1",
          label: "Input",
          sublabel: "Prompt",
          role: "Input",
          file: "",
          risk: "low",
          status: "done"
        },
        {
          id: "n2",
          label: "Engine",
          sublabel: "Transform",
          role: "Core Logic / Service",
          file: "scripts/debrief-engine.mjs",
          risk: "medium",
          status: "active"
        }
      ],
      edges: [{ from: "n1", to: "n2", stepNumber: 1, label: "Feeds", risk: "low" }]
    },
    touchedFiles: [],
    complexity: { level: "simple", score: 1, reason: "Fixture turn" },
    explainerScenes: [],
    ...overrides
  };
}

/**
 * Build a panel-state fixture for HTML export tests. Pass `debrief` to replace
 * the debrief fields; all other keys override the top-level panel state.
 */
export function buildPanelStateFixture({ debrief = {}, ...overrides } = {}) {
  return {
    projectName: "demo-app",
    activePersona: "vibe-mentor",
    ste100Enabled: true,
    turnCount: 1,
    currentDebrief: buildDebriefFixture(debrief),
    ...overrides
  };
}

/**
 * Set env vars for the duration of fn(), then restore the previous values.
 * Always await fn() so restoration cannot race async work. Tests in one file
 * run serially by default; do not enable concurrency for env-mutating cases.
 */
export async function withEnv(overrides, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, { present: key in process.env, value: process.env[key] });
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, snapshot] of previous) {
      if (snapshot.present) {
        process.env[key] = snapshot.value;
      } else {
        delete process.env[key];
      }
    }
  }
}

/** Point ZCODE_HOME_DIR at a temp home for the duration of fn(). */
export function withZCodeHomeDir(homeOrPath, fn) {
  const root = typeof homeOrPath === "string" ? homeOrPath : homeOrPath.root;
  return withEnv({ ZCODE_HOME_DIR: root }, fn);
}

/** Extract the first <style> block body from a self-contained HTML asset. */
export function extractStyleContent(html) {
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(match, "HTML asset must contain a <style> block");
  return match[1];
}

/** Extract the first inline <script> block body from a self-contained HTML asset. */
export function extractInlineScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, "HTML asset must contain an inline <script> block");
  return match[1];
}

/**
 * Parse every `--token: value;` declaration inside the first CSS block matching
 * selectorPattern (capture group 1 must be the block body). Handles both
 * one-per-line and compact multi-declaration lines.
 */
export function parseCssBlockVars(css, selectorPattern) {
  const match = css.match(selectorPattern);
  assert.ok(match, `Expected CSS block matching ${selectorPattern}`);
  const vars = {};
  for (const decl of match[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    vars[decl[1]] = decl[2].trim();
  }
  return vars;
}

/** Resolve single-hop `var(--token)` aliases against a parsed CSS variable table. */
export function resolveCssAliases(vars) {
  const resolved = { ...vars };
  for (let pass = 0; pass < 3; pass++) {
    for (const [k, v] of Object.entries(resolved)) {
      const m = v.match(/^var\((--[a-z0-9-]+)\)$/i);
      if (m && resolved[m[1]]) {
        resolved[k] = resolved[m[1]];
      }
    }
  }
  return resolved;
}

function relativeLuminance(hex) {
  const clean = hex.replace("#", "").slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const c = parseInt(clean.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two 6-digit hex colors. */
export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function splitLines(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

/** Turn JSON-RPC message objects (or raw line strings) into stdin input. */
export function toJsonLines(messages = []) {
  const list = Array.isArray(messages) ? messages : [messages];
  if (list.length === 0) return "";
  return `${list.map((message) => (typeof message === "string" ? message : JSON.stringify(message))).join("\n")}\n`;
}

/** Parse newline-delimited JSON, failing with the offending line number. */
export function parseJsonLines(text, label = "stdout") {
  return splitLines(text).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`${label} line ${index + 1} is not valid JSON: ${JSON.stringify(line)}`);
    }
  });
}

export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

/**
 * Spawn one Node process with optional stdin, capture both streams, and return
 * exit metadata. The runner never uses a shell, so args stay untouched on Windows.
 */
export function runNodeProcess({
  args = [],
  input = "",
  cwd = REPO_ROOT,
  env = {},
  timeoutMs = 20000
} = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timer = null;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(value);
    };

    timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => finish(rejectPromise, error));
    child.on("close", (exitCode, signal) => {
      const result = {
        exitCode,
        signal,
        timedOut,
        stdout,
        stderr,
        stdoutLines: splitLines(stdout),
        stderrLines: splitLines(stderr)
      };
      if (timedOut) {
        finish(
          rejectPromise,
          new Error(
            `Process timed out after ${timeoutMs}ms: node ${args.join(" ")}\nstdout:\n${stdout}\nstderr:\n${stderr}`
          )
        );
        return;
      }
      finish(resolvePromise, result);
    });

    // The child can exit before reading stdin; ignore EPIPE for that race.
    child.stdin.on("error", () => {});
    child.stdin.end(input === undefined || input === null ? "" : String(input));
  });
}

/** Spawn the stdio MCP server and feed line-delimited JSON-RPC messages. */
export function runMcpServer({ messages = [], env = {}, cwd = REPO_ROOT, timeoutMs = 20000 } = {}) {
  return runNodeProcess({
    args: [MCP_SERVER_PATH],
    input: toJsonLines(messages),
    cwd,
    env,
    timeoutMs
  });
}

/** Spawn the hook runner for one lifecycle mode with a JSON payload on stdin. */
export function runHookRunner(
  mode = "session-start",
  payload = {},
  { env = {}, cwd = REPO_ROOT, timeoutMs = 20000 } = {}
) {
  const input = (typeof payload === "string" ? payload : JSON.stringify(payload ?? {})).replace(
    /\r?\n+$/,
    ""
  );
  return runNodeProcess({
    args: [HOOK_RUNNER_PATH, mode],
    input: `${input}\n`,
    cwd,
    env: {
      // Keep stop-mode tests hermetic: an ambient AI key would trigger a live
      // network call. Explicit per-test values still win over these defaults.
      VIBE_DEBRIEF_OPENAI_KEY: "",
      OPENAI_API_KEY: "",
      ...env
    },
    timeoutMs
  });
}