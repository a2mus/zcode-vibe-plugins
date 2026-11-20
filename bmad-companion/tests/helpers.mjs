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
