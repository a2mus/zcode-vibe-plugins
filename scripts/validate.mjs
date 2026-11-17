import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, "..");

function readJson(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new Error(`Invalid JSON in ${label} (${filePath}): ${err.message}`);
  }
}

export function validateMarketplace(repoRoot = REPO_ROOT) {
  const marketplacePath = join(repoRoot, "marketplace.json");
  const marketplace = readJson(marketplacePath, "marketplace.json");

  if (!marketplace.name || !Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    throw new Error("marketplace.json must define 'name' and a non-empty 'plugins' array");
  }

  const results = [];

  for (const entry of marketplace.plugins) {
    const pluginDir = resolve(repoRoot, entry.source || `./${entry.name}`);
    if (!existsSync(pluginDir)) {
      throw new Error(`Plugin directory missing for '${entry.name}': ${pluginDir}`);
    }

    const pluginJsonPath = join(pluginDir, ".zcode-plugin", "plugin.json");
    const pluginJson = readJson(pluginJsonPath, `${entry.name} plugin.json`);

    if (pluginJson.name !== entry.name) {
      throw new Error(`Name mismatch for '${entry.name}': plugin.json has '${pluginJson.name}'`);
    }
    if (pluginJson.version !== entry.version) {
      throw new Error(
        `Version mismatch for '${entry.name}': marketplace.json has '${entry.version}', plugin.json has '${pluginJson.version}'`
      );
    }

    const mcpPath = join(pluginDir, ".mcp.json");
    if (existsSync(mcpPath)) {
      readJson(mcpPath, `${entry.name} .mcp.json`);
    }

    const hooksPath = join(pluginDir, "hooks", "hooks.json");
    if (existsSync(hooksPath)) {
      readJson(hooksPath, `${entry.name} hooks.json`);
    }

    const scriptsDir = join(pluginDir, "scripts");
    if (existsSync(scriptsDir)) {
      for (const file of readdirSync(scriptsDir)) {
        if (file.endsWith(".mjs") || file.endsWith(".js")) {
          const scriptPath = join(scriptsDir, file);
          execFileSync(process.execPath, ["--check", scriptPath], { stdio: "pipe" });
        }
      }
    }

    const assetsDir = join(pluginDir, "assets");
    if (existsSync(assetsDir)) {
      for (const file of readdirSync(assetsDir)) {
        if (file.endsWith(".html")) {
          const htmlPath = join(assetsDir, file);
          const html = readFileSync(htmlPath, "utf8");
          const scriptMatches = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
          for (const m of scriptMatches) {
            if (m[1].trim()) {
              new Function(m[1]);
            }
          }
        }
      }
    }

    results.push({ name: entry.name, version: entry.version, status: "ok" });
  }

  return results;
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    const results = validateMarketplace();
    for (const r of results) {
      console.log(`✓ ${r.name} v${r.version} validated`);
    }
  } catch (err) {
    console.error(`✗ Validation failed: ${err.message}`);
    process.exit(1);
  }
}
