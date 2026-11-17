import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { REPO_ROOT, validateMarketplace } from "./validate.mjs";

const RUNTIME_PATHS = [
  ".mcp.json",
  ".zcode-plugin",
  "README.md",
  "assets",
  "commands",
  "hooks",
  "scripts",
  "skills"
];

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const positional = [];
  let customMessage = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--message" && argv[i + 1]) {
      customMessage = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith("--")) {
      positional.push(argv[i]);
    }
  }
  return {
    pluginName: positional[0],
    bumpArg: positional[1] || "patch",
    push: flags.has("--push"),
    dryRun: flags.has("--dry-run"),
    noCommit: flags.has("--no-commit"),
    customMessage
  };
}

function computeNextVersion(current, bumpArg) {
  if (/^\d+\.\d+\.\d+$/.test(bumpArg)) {
    return bumpArg;
  }
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(current || "").trim());
  if (!m) {
    throw new Error(`Invalid current version '${current}'`);
  }
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (bumpArg === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpArg === "minor") {
    minor += 1;
    patch = 0;
  } else if (bumpArg === "patch") {
    patch += 1;
  } else {
    throw new Error(`Unsupported bump '${bumpArg}'. Use patch, minor, major, or X.Y.Z`);
  }
  return `${major}.${minor}.${patch}`;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceTextIfPresent(filePath, replacer, dryRun) {
  if (!existsSync(filePath)) return false;
  const before = readFileSync(filePath, "utf8");
  const after = replacer(before);
  if (after === before) return false;
  if (!dryRun) {
    writeFileSync(filePath, after, "utf8");
  }
  return true;
}

function runGit(args) {
  return execFileSync("git", ["-C", REPO_ROOT, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.pluginName) {
  console.error("Usage: node scripts/release.mjs <plugin-name> [patch|minor|major|X.Y.Z] [--push] [--dry-run] [--no-commit] [--message \"...\"]");
  process.exit(1);
}

const marketplacePath = join(REPO_ROOT, "marketplace.json");
const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
const pluginEntry = (marketplace.plugins || []).find((p) => p.name === opts.pluginName);
if (!pluginEntry) {
  console.error(`Plugin '${opts.pluginName}' not found in marketplace.json`);
  process.exit(1);
}

const pluginDir = resolve(REPO_ROOT, pluginEntry.source || `./${opts.pluginName}`);
const pluginJsonPath = join(pluginDir, ".zcode-plugin", "plugin.json");
const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf8"));

const oldVersion = pluginJson.version;
const newVersion = computeNextVersion(oldVersion, opts.bumpArg);
const oldEsc = escapeRegExp(oldVersion);

console.log(`Releasing ${opts.pluginName}: ${oldVersion} -> ${newVersion}${opts.dryRun ? " (dry-run)" : ""}`);

const touched = [];

pluginEntry.version = newVersion;
if (!opts.dryRun) {
  writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n", "utf8");
}
touched.push("marketplace.json");

pluginJson.version = newVersion;
if (!opts.dryRun) {
  writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + "\n", "utf8");
}
touched.push(`${opts.pluginName}/.zcode-plugin/plugin.json`);

if (
  replaceTextIfPresent(
    join(pluginDir, "scripts", "mcp-server.mjs"),
    (s) => s.replace(new RegExp(`(version:\\s*")${oldEsc}(")`), `$1${newVersion}$2`),
    opts.dryRun
  )
) {
  touched.push(`${opts.pluginName}/scripts/mcp-server.mjs`);
}

if (
  replaceTextIfPresent(
    join(pluginDir, "assets", "panel.html"),
    (s) =>
      s
        .replace(new RegExp(`(appInfo:\\s*\\{[^}]*version:\\s*")${oldEsc}(")`, "g"), `$1${newVersion}$2`)
        .replace(new RegExp(`(v)${oldEsc}(\\b)`, "g"), `$1${newVersion}$2`),
    opts.dryRun
  )
) {
  touched.push(`${opts.pluginName}/assets/panel.html`);
}

if (
  replaceTextIfPresent(
    join(REPO_ROOT, "README.md"),
    (s) =>
      s.replace(
        new RegExp(`(\`${escapeRegExp(opts.pluginName)}\`\\s*·\\s*\`v)${oldEsc}(\`)`, "g"),
        `$1${newVersion}$2`
      ),
    opts.dryRun
  )
) {
  touched.push("README.md");
}

console.log("Updated files:", touched.join(", "));

if (opts.dryRun) {
  console.log("Dry-run complete. No files written.");
  process.exit(0);
}

const validated = validateMarketplace(REPO_ROOT);
for (const v of validated) {
  console.log(`✓ Validated ${v.name} v${v.version}`);
}

if (!opts.noCommit) {
  const stagePaths = ["marketplace.json", "README.md"];
  for (const rel of RUNTIME_PATHS) {
    const abs = join(pluginDir, rel);
    if (existsSync(abs)) {
      stagePaths.push(`${opts.pluginName}/${rel}`);
    }
  }
  runGit(["add", "--", ...stagePaths]);
  const statusOut = runGit(["diff", "--cached", "--name-only"]);
  if (!statusOut) {
    console.log("Nothing staged to commit.");
    process.exit(0);
  }
  const msg = opts.customMessage || `release(${opts.pluginName}): v${newVersion}`;
  runGit(["commit", "-m", msg]);
  console.log(`✓ Committed: ${msg}`);

  if (opts.push) {
    const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]) || "main";
    runGit(["push", "origin", branch]);
    console.log(`✓ Pushed to origin/${branch}`);
  } else {
    console.log("Next: run 'git push origin main' (or pass --push) and refresh your marketplace in ZCode.");
  }
}
