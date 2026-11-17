import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { REPO_ROOT } from "./validate.mjs";

const RUNTIME_ENTRIES = [
  ".mcp.json",
  ".zcode-plugin",
  "README.md",
  "assets",
  "commands",
  "hooks",
  "scripts",
  "skills"
];

function getInstalledTargets(filterPlugin) {
  const marketplace = JSON.parse(readFileSync(join(REPO_ROOT, "marketplace.json"), "utf8"));
  const installedPath = join(homedir(), ".zcode", "cli", "plugins", "installed_plugins.json");
  if (!existsSync(installedPath)) {
    throw new Error(`ZCode installed_plugins.json not found at ${installedPath}`);
  }
  const installed = JSON.parse(readFileSync(installedPath, "utf8"));
  const targets = [];

  for (const entry of marketplace.plugins) {
    if (filterPlugin && entry.name !== filterPlugin) continue;
    const record = (installed.plugins || []).find(
      (p) => p.name === entry.name && p.marketplace === marketplace.name
    );
    if (!record || !record.installPath) {
      console.warn(`! Skipping '${entry.name}': not currently installed from '${marketplace.name}'`);
      continue;
    }
    targets.push({
      name: entry.name,
      sourceDir: resolve(REPO_ROOT, entry.source || `./${entry.name}`),
      installPath: record.installPath
    });
  }

  return targets;
}

export function syncPluginToLocalCache(target) {
  if (!existsSync(target.installPath)) {
    mkdirSync(target.installPath, { recursive: true });
  }
  let copiedCount = 0;
  for (const rel of RUNTIME_ENTRIES) {
    const src = join(target.sourceDir, rel);
    const dst = join(target.installPath, rel);
    if (!existsSync(src)) continue;
    rmSync(dst, { recursive: true, force: true });
    cpSync(src, dst, { recursive: true });
    copiedCount += 1;
  }
  console.log(`✓ Synced ${target.name} (${copiedCount} entries) -> ${target.installPath}`);
}

const args = process.argv.slice(2);
const watchMode = args.includes("--watch");
const pluginArg = args.find((a) => !a.startsWith("-")) || null;

const targets = getInstalledTargets(pluginArg);
if (targets.length === 0) {
  console.error("No matching installed plugins found to sync.");
  process.exit(1);
}

for (const target of targets) {
  syncPluginToLocalCache(target);
}

if (watchMode) {
  console.log("👀 Watching for plugin changes (Ctrl+C to stop)...");
  for (const target of targets) {
    let timer = null;
    for (const rel of RUNTIME_ENTRIES) {
      const watchPath = join(target.sourceDir, rel);
      if (!existsSync(watchPath)) continue;
      watch(watchPath, { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            syncPluginToLocalCache(target);
          } catch (err) {
            console.error(`✗ Sync failed for ${target.name}: ${err.message}`);
          }
        }, 250);
      });
    }
  }
}
