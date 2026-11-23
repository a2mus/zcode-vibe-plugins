import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { checkVersionSync } from "../scripts/check-version-sync.mjs";
import {
  CHECK_VERSION_SYNC_PATH,
  REPO_ROOT,
  createTempWorkspaceTracker,
  runNodeProcess,
  runNodeSyntaxCheck
} from "./helpers.mjs";

const workspaces = createTempWorkspaceTracker(afterEach);

function seedVersionFixture({
  pluginName = "bmad-companion",
  pluginVersion = "0.5.3",
  marketplaceVersion = "0.5.3",
  marketplacePlugins = null,
  mcpServerVersion = "0.5.3",
  omitPluginJson = false,
  omitMarketplaceJson = false,
  omitMcpServer = false,
  invalidPluginJson = false,
  invalidMcpServer = false
} = {}) {
  const ws = workspaces.create({ prefix: "bmad-version-sync-ws-" });

  if (!omitMarketplaceJson) {
    ws.write(
      "marketplace.json",
      JSON.stringify(
        {
          name: "test-marketplace",
          plugins:
            marketplacePlugins || [
              {
                name: pluginName,
                source: "./plugin",
                version: marketplaceVersion
              }
            ]
        },
        null,
        2
      )
    );
  }

  if (!omitPluginJson) {
    ws.write(
      "plugin/.zcode-plugin/plugin.json",
      invalidPluginJson
        ? "{ invalid json"
        : JSON.stringify(
            {
              name: pluginName,
              version: pluginVersion
            },
            null,
            2
          )
    );
  }

  if (!omitMcpServer) {
    ws.write(
      "plugin/scripts/mcp-server.mjs",
      invalidMcpServer
        ? "// no serverInfo block here\nexport const x = 1;\n"
        : [
            'import { createInterface } from "node:readline";',
            "const info = {",
            "  serverInfo: {",
            '    name: "bmad-companion",',
            `    version: "${mcpServerVersion}"`,
            "  }",
            "};"
          ].join("\n") + "\n"
    );
  }

  return {
    workspace: ws,
    pluginRoot: ws.path("plugin")
  };
}

describe("bmad-companion version tri-sync gate", () => {
  it("checkVersionSync script exists and passes syntax validation", async () => {
    assert.equal(existsSync(CHECK_VERSION_SYNC_PATH), true);
    const result = await runNodeSyntaxCheck(CHECK_VERSION_SYNC_PATH);
    assert.equal(result.ok, true);
    assert.equal(result.code, 0);
  });

  describe("in-process validation against live repository", () => {
    it("reports clean sync across plugin.json, marketplace.json, and mcp-server.mjs", () => {
      const result = checkVersionSync(REPO_ROOT);

      assert.equal(result.synced, true);
      assert.deepEqual(result.errors, []);
      assert.equal(typeof result.versions.plugin, "string");
      assert.equal(result.versions.plugin, "0.5.3");
      assert.equal(result.versions.marketplace, result.versions.plugin);
      assert.equal(result.versions.mcpServer, result.versions.plugin);
    });
  });

  describe("CLI execution against live repository", () => {
    it("exits with status code 0 and logs OK message", async () => {
      const result = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [REPO_ROOT]
      });

      assert.equal(result.ok, true);
      assert.equal(result.code, 0);
      assert.match(
        result.stdout,
        /\[check-version-sync\] OK: all 3 versions match \(0\.5\.3\)/
      );
      assert.equal(result.stderr, "");
    });

    it("defaults to repo root when no CLI argument is passed", async () => {
      const result = await runNodeProcess(CHECK_VERSION_SYNC_PATH);

      assert.equal(result.ok, true);
      assert.equal(result.code, 0);
      assert.match(result.stdout, /\[check-version-sync\] OK: all 3 versions match/);
      assert.equal(result.stderr, "");
    });
  });

  describe("fixture workspace mismatch and error detection", () => {
    it("detects bumped plugin.json mismatch and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        pluginVersion: "0.5.4",
        marketplaceVersion: "0.5.3",
        mcpServerVersion: "0.5.3"
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.equal(inProcess.versions.plugin, "0.5.4");
      assert.equal(inProcess.versions.marketplace, "0.5.3");
      assert.equal(inProcess.versions.mcpServer, "0.5.3");
      assert.ok(
        inProcess.errors.some((e) => e.includes("Version mismatch")),
        "expected Version mismatch error"
      );

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /\[check-version-sync\] ERROR: version tri-sync check failed/);
      assert.match(cli.stderr, /Version mismatch/);
    });

    it("detects marketplace version mismatch and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        pluginVersion: "0.5.3",
        marketplaceVersion: "0.5.2",
        mcpServerVersion: "0.5.3"
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.equal(inProcess.versions.marketplace, "0.5.2");
      assert.ok(
        inProcess.errors.some((e) => e.includes("Version mismatch")),
        "expected Version mismatch error"
      );

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /Version mismatch/);
    });

    it("detects mcp-server.mjs version mismatch and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        pluginVersion: "0.5.3",
        marketplaceVersion: "0.5.3",
        mcpServerVersion: "0.5.2"
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.equal(inProcess.versions.mcpServer, "0.5.2");
      assert.ok(
        inProcess.errors.some((e) => e.includes("Version mismatch")),
        "expected Version mismatch error"
      );

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /Version mismatch/);
    });

    it("detects missing plugin.json and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        omitPluginJson: true
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.ok(inProcess.errors.some((e) => e.includes("Missing plugin.json")));

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /Missing plugin\.json/);
    });

    it("detects missing marketplace.json and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        omitMarketplaceJson: true
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.ok(inProcess.errors.some((e) => e.includes("Missing marketplace.json")));

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /Missing marketplace\.json/);
    });

    it("detects unparseable plugin.json and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        invalidPluginJson: true
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.ok(inProcess.errors.some((e) => e.includes("Failed to read/parse")));

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /Failed to read\/parse/);
    });

    it("detects unextractable serverInfo in mcp-server.mjs and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        invalidMcpServer: true
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.ok(inProcess.errors.some((e) => e.includes("Could not extract serverInfo.version")));

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /Could not extract serverInfo\.version/);
    });

    it("detects whitespace-only version in plugin.json and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        pluginVersion: "   "
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.ok(
        inProcess.errors.some((e) => e.includes("Missing or invalid 'version' field in")),
        "expected missing/invalid version error"
      );

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /Missing or invalid 'version' field/);
    });

    it("detects whitespace-only version in marketplace.json and exits with code 1", async () => {
      const { pluginRoot } = seedVersionFixture({
        marketplaceVersion: "   "
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, false);
      assert.ok(
        inProcess.errors.some((e) => e.includes("Missing or invalid 'version' field for")),
        "expected missing/invalid version error"
      );

      const cli = await runNodeProcess(CHECK_VERSION_SYNC_PATH, {
        args: [pluginRoot]
      });
      assert.equal(cli.ok, false);
      assert.equal(cli.code, 1);
      assert.match(cli.stderr, /Missing or invalid 'version' field/);
    });

    it("matches custom pluginName without incorrectly matching preceding bmad-companion entry", async () => {
      const { pluginRoot } = seedVersionFixture({
        pluginName: "custom-plugin",
        pluginVersion: "1.0.0",
        mcpServerVersion: "1.0.0",
        marketplacePlugins: [
          {
            name: "bmad-companion",
            source: "./bmad-companion",
            version: "0.5.3"
          },
          {
            name: "custom-plugin",
            source: "./custom-plugin",
            version: "1.0.0"
          }
        ]
      });

      const inProcess = checkVersionSync(pluginRoot);
      assert.equal(inProcess.synced, true);
      assert.deepEqual(inProcess.errors, []);
      assert.equal(inProcess.versions.plugin, "1.0.0");
      assert.equal(inProcess.versions.marketplace, "1.0.0");
      assert.equal(inProcess.versions.mcpServer, "1.0.0");
    });
  });
});
