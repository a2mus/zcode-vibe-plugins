import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { discoverLightweightGeminiModels, resolveZCodeMemoryDirectory } from "../scripts/debrief-engine.mjs";
import {
  createTempFixture,
  createTempHome,
  createTempWorkspace,
  parseJsonLines,
  runHookRunner,
  runMcpServer,
  runNodeProcess,
  splitLines,
  toJsonLines,
  withEnv,
  withZCodeHomeDir,
  workspaceSlug
} from "./helpers.mjs";

describe("temp-workspace fixtures", () => {
  it("creates and removes an isolated workspace", () => {
    const workspace = createTempWorkspace({
      files: { "src/app.mjs": "export const value = 1;\n" }
    });

    try {
      assert.ok(existsSync(workspace.root));
      assert.equal(workspace.read("src/app.mjs"), "export const value = 1;\n");
      assert.equal(
        workspace.statePath,
        join(workspace.root, ".zcode", "vibe-debrief-state.json")
      );
      workspace.write("nested/deep/file.txt", "ready");
      assert.equal(workspace.exists("nested/deep/file.txt"), true);
    } finally {
      workspace.cleanup();
    }

    assert.equal(existsSync(workspace.root), false);
  });

  it("keeps separate workspaces isolated", () => {
    const first = createTempWorkspace();
    const second = createTempWorkspace();

    try {
      assert.notEqual(first.root, second.root);
      first.write("only-first.txt", "one");
      assert.equal(first.exists("only-first.txt"), true);
      assert.equal(second.exists("only-first.txt"), false);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });

  it("creates a temp home with ZCode v2 and memory roots", () => {
    const home = createTempHome({
      providerConfig: { config: { providerConfigRules: { providerRules: [] } } }
    });

    try {
      assert.equal(home.env.ZCODE_HOME_DIR, home.root);
      assert.ok(existsSync(home.zcodeV2Dir));
      assert.ok(existsSync(home.memoryProjectsRoot));
      assert.ok(existsSync(home.path(".zcode", "v2", "provider_config.json")));
    } finally {
      home.cleanup();
    }
  });
});

describe("environment isolation", () => {
  it("restores previous env values after withEnv", async () => {
    const key = "VIBE_DEBRIEF_TEST_ENV";
    const hadKey = key in process.env;
    const previous = process.env[key];
    delete process.env[key];

    try {
      await withEnv({ [key]: "first" }, async () => {
        assert.equal(process.env[key], "first");
      });
      assert.equal(key in process.env, false);

      process.env[key] = "original";
      await withEnv({ [key]: "second" }, async () => {
        assert.equal(process.env[key], "second");
      });
      assert.equal(process.env[key], "original");
    } finally {
      if (hadKey) {
        process.env[key] = previous;
      } else {
        delete process.env[key];
      }
    }
  });

  it("routes memory resolution through ZCODE_HOME_DIR", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      const memoryDir = await withZCodeHomeDir(home, () =>
        resolveZCodeMemoryDirectory(workspace.root)
      );
      const slug = workspaceSlug(workspace.root);

      assert.equal(memoryDir, join(home.memoryProjectsRoot, slug, "memory"));
      assert.ok(existsSync(memoryDir));
    } finally {
      cleanup();
    }
  });

  it("routes lightweight model discovery through ZCODE_HOME_DIR", async () => {
    const home = createTempHome({
      providerConfig: {
        config: {
          providerConfigRules: {
            providerRules: [
              {
                providerId: "new-provider",
                providerName: "New Provider",
                enabled: true,
                config: { modelOrder: ["gemini-4-argon", "gpt-5"] }
              }
            ]
          }
        }
      }
    });

    try {
      const models = await withZCodeHomeDir(home, () => discoverLightweightGeminiModels());

      assert.deepEqual(
        models.map((model) => model.id),
        ["new-provider/gemini-4-argon"]
      );
      assert.equal(models[0].score, 10);
    } finally {
      home.cleanup();
    }
  });
});

describe("JSON line helpers", () => {
  it("builds and parses newline-delimited JSON", () => {
    assert.equal(toJsonLines([{ a: 1 }, { b: 2 }]), '{"a":1}\n{"b":2}\n');
    assert.equal(toJsonLines([]), "");
    assert.deepEqual(parseJsonLines('{"a":1}\n\n{"b":2}\n'), [{ a: 1 }, { b: 2 }]);
    assert.deepEqual(splitLines("a\r\nb\n\n"), ["a", "b"]);
  });

  it("reports the offending line when JSON parsing fails", () => {
    assert.throws(() => parseJsonLines("not json", "hook stdout"), /hook stdout line 1/);
  });
});

describe("spawned-process stdio runners", () => {
  it("captures stdin, stdout and stderr from a Node child", async () => {
    const result = await runNodeProcess({
      args: [
        "-e",
        'const fs = require("node:fs"); const input = fs.readFileSync(0, "utf8"); process.stdout.write(JSON.stringify({ input }) + "\\n"); process.stderr.write("warn\\n");'
      ],
      input: "hello\n"
    });

    assert.equal(result.exitCode, 0);
    assert.deepEqual(parseJsonLines(result.stdout), [{ input: "hello\n" }]);
    assert.equal(result.stderrLines[0], "warn");
  });

  it("reports a non-zero child exit code", async () => {
    const result = await runNodeProcess({ args: ["-e", "process.exit(7)"] });
    assert.equal(result.exitCode, 7);
  });

  it("kills a child that exceeds the timeout", async () => {
    await assert.rejects(
      runNodeProcess({ args: ["-e", "setTimeout(() => {}, 5000)"], timeoutMs: 500 }),
      /timed out/
    );
  });

  it("round-trips initialize, ping and tools/list through the MCP server", async () => {
    const result = await runMcpServer({
      messages: [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-11-25" }
        },
        { jsonrpc: "2.0", id: 2, method: "ping", params: {} },
        { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }
      ]
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");

    const frames = parseJsonLines(result.stdout, "MCP stdout");
    assert.equal(frames.length, 3);
    assert.equal(frames[0].id, 1);
    assert.equal(frames[0].result.serverInfo.name, "vibe-debrief");
    assert.deepEqual(frames[1].result, {});
    assert.equal(frames[2].result.tools.length, 8);
  });

  it("emits one JSON line from a hook lifecycle run", async () => {
    const { workspace, home, cleanup } = createTempFixture();

    try {
      const result = await runHookRunner("session-start", {}, {
        cwd: workspace.root,
        env: { ...home.env, ZCODE_PROJECT_DIR: workspace.root }
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.stderr, "");
      const lines = parseJsonLines(result.stdout, "hook stdout");
      assert.equal(lines.length, 1);
      assert.match(lines[0].additionalContext, /Vibe Debrief/);
    } finally {
      cleanup();
    }
  });
});