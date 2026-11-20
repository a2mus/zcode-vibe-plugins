import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(TESTS_DIR, "..");
export const ENGINE_PATH = join(REPO_ROOT, "scripts", "bmad-engine.mjs");
export const MCP_SERVER_PATH = join(REPO_ROOT, "scripts", "mcp-server.mjs");
export const HOOK_RUNNER_PATH = join(REPO_ROOT, "scripts", "hook-runner.mjs");
export const PANEL_HTML_PATH = join(REPO_ROOT, "assets", "panel.html");
export const CHECK_VERSION_SYNC_PATH = join(REPO_ROOT, "scripts", "check-version-sync.mjs");

/**
 * Create a disposable temp workspace with file helpers and rmSync cleanup.
 */
export function createTempWorkspace({ prefix = "bmad-companion-ws-", files = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const workspace = {
    root,
    statePath: join(root, ".zcode", "bmad-companion", "state.json"),
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
    },
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
 * Seed a temp workspace with realistic _bmad-output/ artifacts:
 * planning docs, v6 sprint-status.yaml, v7 initiative + tickets.toml, and story plans.
 */
export function seedBmadWorkspace(
  workspace,
  {
    initiativeSlug = "initiative-demo",
    epicSlug = "epic-core",
    sprintStatus = true,
    includePlanningArtifacts = true,
    includeStoryPlans = true
  } = {}
) {
  if (includePlanningArtifacts) {
    workspace.write(
      "_bmad-output/planning-artifacts/prd-demo/prd-demo.md",
      `---\ntitle: Demo PRD\nstatus: approved\n---\n\n# Product Requirements\n`
    );
    workspace.write(
      "_bmad-output/planning-artifacts/architecture-demo/architecture-demo.md",
      `---\ntitle: Demo Architecture\nstatus: approved\n---\n\n# Architecture\n`
    );
  }

  if (sprintStatus) {
    workspace.write(
      "_bmad-output/implementation-artifacts/sprint-status.yaml",
      [
        "development_status:",
        "  epic-1: in-progress",
        "  1-1-seed-fixture: backlog",
        "  1-2-verify-scan: in-progress"
      ].join("\n") + "\n"
    );
  }

  const initBase = `_bmad-output/${initiativeSlug}`;
  const epicBase = `${initBase}/tickets/${epicSlug}`;

  workspace.write(
    `${initBase}/${initiativeSlug}.md`,
    `---\ntitle: Demo Initiative\nstatus: in-progress\ncreated: 2026-11-20\n---\n\n# Demo Initiative\n`
  );

  workspace.write(
    `${initBase}/tickets/tickets.toml`,
    [
      "[[epic]]",
      "id = 1",
      `slug = "${epicSlug}"`,
      'title = "Core Verification Epic"',
      'covers = ["R1"]'
    ].join("\n") + "\n"
  );

  workspace.write(
    `${epicBase}/${epicSlug}.md`,
    `---\ntype: epic\ntitle: Core Verification Epic\nstatus: in-progress\n---\n\n# Core Verification Epic\n`
  );

  workspace.write(
    `${epicBase}/tickets/tickets.toml`,
    [
      "[[entry]]",
      "id = 1",
      'v6_key = "1-1-seed-fixture"',
      'title = "Seed Fixture Story"',
      'status = "backlog"',
      'description = "Seed a disposable workspace fixture."',
      'verify = "Run node --test tests/"',
      'covers = ["R1"]',
      "",
      "[[entry]]",
      "id = 2",
      'v6_key = "1-2-verify-scan"',
      'title = "Verify Scan Story"',
      'status = "in-progress"',
      'description = "Assert ScanResult keys."',
      'verify = "Check metrics/phases/epics/artifacts"',
      'covers = ["R1"]'
    ].join("\n") + "\n"
  );

  if (includeStoryPlans) {
    workspace.write(
      `${epicBase}/tickets/story-seed-fixture-plan.md`,
      [
        "---",
        'title: "Seed Fixture Story"',
        "ticket: 1",
        "status: done",
        "---",
        "",
        "## Intent",
        "Seeded story plan proving built status reconciliation."
      ].join("\n") + "\n"
    );
    workspace.write(
      `${epicBase}/tickets/story-verify-scan-plan.md`,
      [
        "---",
        'title: "Verify Scan Story"',
        "ticket: 2",
        "status: in-progress",
        "---",
        "",
        "## Intent",
        "In-progress story plan."
      ].join("\n") + "\n"
    );
  }

  return workspace;
}

/**
 * Split text into lines, stripping at most one trailing newline without hiding
 * intermediate or extra trailing blank lines.
 */
export function splitLines(text = "") {
  if (!text) return [];
  const normalized = String(text).replace(/\r?\n$/, "");
  return normalized.split(/\r?\n/);
}

/**
 * Serialize an array (or single item) of JSON-RPC messages or raw lines into
 * LF-delimited JSON-lines input suitable for stdio transport.
 */
export function toJsonLines(messages = []) {
  const list = Array.isArray(messages) ? messages : [messages];
  if (list.length === 0) return "";
  return list.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n") + "\n";
}

/**
 * Parse LF/CRLF-delimited JSON lines from stdout, throwing a diagnostic Error
 * if any line (including a blank line) is not valid JSON.
 */
export function parseJsonLines(text = "") {
  const lines = splitLines(text);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      const preview = line.length > 160 ? `${line.slice(0, 160)}...` : line;
      throw new Error(`Invalid JSON on stdout line ${index + 1}: ${err.message} (line=${JSON.stringify(preview)})`);
    }
  });
}

/**
 * Read and parse a UTF-8 JSON file.
 */
export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

/**
 * Spawn a Node ESM process with bounded timeout, isolated stdio pipes, and
 * EPIPE-safe stdin writing.
 */
export function runNodeProcess(
  scriptPath,
  { args = [], cwd = REPO_ROOT, env = {}, stdin = "", keepStdinOpen = false, timeoutMs = 5000 } = {}
) {
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let timedOut = false;
    let stdout = "";
    let stderr = "";

    const mergedEnv = Object.fromEntries(
      Object.entries({ ...process.env, ...env }).filter(([, value]) => value !== undefined)
    );

    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env: mergedEnv,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const cleanupStreams = () => {
      try {
        child.stdin?.destroy();
      } catch {}
      try {
        child.stdout?.destroy();
      } catch {}
      try {
        child.stderr?.destroy();
      } catch {}
    };

    const rejectTimeout = () => {
      if (settled) return;
      settled = true;
      cleanupStreams();
      const err = new Error(
        `Process timed out after ${timeoutMs}ms (${scriptPath})\nstdout: ${stdout || "<empty>"}\nstderr: ${stderr || "<empty>"}`
      );
      err.code = "ETIMEDOUT";
      err.stdout = stdout;
      err.stderr = stderr;
      rejectPromise(err);
    };

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (settled || timedOut) return;
            timedOut = true;
            try {
              child.stdin?.destroy();
            } catch {}
            try {
              child.kill("SIGKILL");
            } catch {
              try {
                child.kill();
              } catch {}
            }
            // Wait for OS process termination so cwd/file locks are released before rejecting.
            const killTimer = setTimeout(rejectTimeout, 500);
            killTimer.unref?.();
            child.once("close", () => {
              clearTimeout(killTimer);
              rejectTimeout();
            });
          }, timeoutMs)
        : null;

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    // Guard against EPIPE / ERR_STREAM_DESTROYED if child exits before stdin completes.
    child.stdin?.on("error", (err) => {
      if (err && (err.code === "EPIPE" || err.code === "ERR_STREAM_DESTROYED")) return;
    });

    child.on("error", (err) => {
      if (settled || timedOut) return;
      settled = true;
      clearTimer();
      cleanupStreams();
      rejectPromise(err);
    });

    child.on("close", (code, signal) => {
      if (settled || timedOut) return;
      settled = true;
      clearTimer();
      resolvePromise({
        ok: code === 0,
        code,
        signal,
        stdout,
        stderr
      });
    });

    if (child.stdin) {
      if (stdin !== undefined && stdin !== null) {
        const payload = Buffer.isBuffer(stdin) ? stdin : String(stdin);
        if (payload.length > 0 && !child.stdin.destroyed && child.stdin.writable) {
          try {
            child.stdin.write(payload, "utf8");
          } catch {}
        }
      }
      if (!keepStdinOpen && stdin !== null && !child.stdin.destroyed) {
        try {
          child.stdin.end();
        } catch {}
      }
    }
  });
}

/**
 * Spawn scripts/mcp-server.mjs against an isolated workspace root, send
 * JSON-RPC requests over stdio, and return parsed stdout frames alongside raw streams.
 */
export async function runMcpServer({
  workspaceRoot,
  cwd,
  requests = [],
  stdin,
  env = {},
  keepStdinOpen = false,
  timeoutMs = 5000
} = {}) {
  const isolatedRoot = resolve(workspaceRoot || cwd || tmpdir());
  const resolvedCwd = resolve(cwd || isolatedRoot);
  const input = stdin !== undefined ? stdin : toJsonLines(requests);

  const result = await runNodeProcess(MCP_SERVER_PATH, {
    cwd: resolvedCwd,
    env: {
      ZCODE_WORKSPACE_ROOT: isolatedRoot,
      ZCODE_PROJECT_DIR: isolatedRoot,
      CLAUDE_PROJECT_DIR: isolatedRoot,
      ...env
    },
    stdin: input,
    keepStdinOpen,
    timeoutMs
  });

  const lines = splitLines(result.stdout);
  let responses = [];
  let parseError = null;
  try {
    responses = parseJsonLines(result.stdout);
  } catch (err) {
    parseError = err;
  }

  return {
    ...result,
    lines,
    responses,
    parseError
  };
}
