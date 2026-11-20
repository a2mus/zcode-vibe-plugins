import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PLUGIN_ROOT = resolve(__dirname, "..");

/**
 * Validate that the plugin version is synchronized across:
 * 1. .zcode-plugin/plugin.json
 * 2. ../marketplace.json
 * 3. scripts/mcp-server.mjs
 *
 * @param {string} [pluginRoot=DEFAULT_PLUGIN_ROOT]
 * @param {object} [options={}]
 * @returns {{ synced: boolean, versions: { plugin: string|null, marketplace: string|null, mcpServer: string|null }, errors: string[] }}
 */
export function checkVersionSync(pluginRoot = DEFAULT_PLUGIN_ROOT, options = {}) {
  const resolvedRoot = resolve(pluginRoot);
  const pluginJsonPath = options.pluginJsonPath || join(resolvedRoot, ".zcode-plugin", "plugin.json");
  const marketplacePath = options.marketplacePath || resolve(resolvedRoot, "..", "marketplace.json");
  const mcpServerPath = options.mcpServerPath || join(resolvedRoot, "scripts", "mcp-server.mjs");

  const errors = [];
  let pluginVersion = null;
  let pluginName = "bmad-companion";
  let marketplaceVersion = null;
  let mcpServerVersion = null;

  // 1. .zcode-plugin/plugin.json
  if (!existsSync(pluginJsonPath)) {
    errors.push(`Missing plugin.json at ${pluginJsonPath}`);
  } else {
    try {
      const raw = readFileSync(pluginJsonPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.name && typeof parsed.name === "string" && parsed.name.trim().length > 0) {
        pluginName = parsed.name.trim();
      }
      const rawVersion = typeof parsed.version === "string" ? parsed.version.trim() : "";
      if (rawVersion.length > 0) {
        pluginVersion = rawVersion;
      } else {
        errors.push(`Missing or invalid 'version' field in ${pluginJsonPath}`);
      }
    } catch (err) {
      errors.push(`Failed to read/parse ${pluginJsonPath}: ${err.message}`);
    }
  }

  // 2. ../marketplace.json
  if (!existsSync(marketplacePath)) {
    errors.push(`Missing marketplace.json at ${marketplacePath}`);
  } else {
    try {
      const raw = readFileSync(marketplacePath, "utf8");
      const parsed = JSON.parse(raw);
      const plugins = Array.isArray(parsed.plugins) ? parsed.plugins : [];
      const entry = plugins.find((p) => p && p.name === pluginName);
      if (!entry) {
        errors.push(`Plugin '${pluginName}' not found in ${marketplacePath} plugins list`);
      } else {
        const rawVersion = typeof entry.version === "string" ? entry.version.trim() : "";
        if (rawVersion.length > 0) {
          marketplaceVersion = rawVersion;
        } else {
          errors.push(`Missing or invalid 'version' field for '${pluginName}' in ${marketplacePath}`);
        }
      }
    } catch (err) {
      errors.push(`Failed to read/parse ${marketplacePath}: ${err.message}`);
    }
  }

  // 3. scripts/mcp-server.mjs
  if (!existsSync(mcpServerPath)) {
    errors.push(`Missing mcp-server.mjs at ${mcpServerPath}`);
  } else {
    try {
      const content = readFileSync(mcpServerPath, "utf8");
      const serverInfoBlock = content.match(/serverInfo\s*:\s*\{([^}]*)\}/);
      if (serverInfoBlock) {
        const versionMatch = serverInfoBlock[1].match(/\bversion\s*:\s*["'`]?([^"'`,\s]+)["'`]?/);
        if (versionMatch) {
          mcpServerVersion = versionMatch[1].trim();
        }
      }
      if (!mcpServerVersion) {
        errors.push(`Could not extract serverInfo.version from ${mcpServerPath}`);
      }
    } catch (err) {
      errors.push(`Failed to read ${mcpServerPath}: ${err.message}`);
    }
  }

  // Version equality check
  if (pluginVersion && marketplaceVersion && mcpServerVersion) {
    if (pluginVersion !== marketplaceVersion || pluginVersion !== mcpServerVersion) {
      errors.push(
        `Version mismatch: plugin.json=${pluginVersion}, marketplace.json=${marketplaceVersion}, mcp-server.mjs=${mcpServerVersion}`
      );
    }
  }

  const synced = errors.length === 0 && Boolean(pluginVersion && marketplaceVersion && mcpServerVersion);

  return {
    synced,
    versions: {
      plugin: pluginVersion,
      marketplace: marketplaceVersion,
      mcpServer: mcpServerVersion
    },
    errors
  };
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  const targetRoot = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_PLUGIN_ROOT;
  const result = checkVersionSync(targetRoot);

  if (result.synced) {
    console.log(`[check-version-sync] OK: all 3 versions match (${result.versions.plugin})`);
    process.exit(0);
  } else {
    console.error("[check-version-sync] ERROR: version tri-sync check failed:");
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    console.error("  Versions:", JSON.stringify(result.versions));
    process.exit(1);
  }
}
