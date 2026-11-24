#!/usr/bin/env node
/**
 * check-version-sync.mjs — zero-dependency 4-file version sync gate (Story 4.3).
 *
 * Verifies that every plugin version location declares the exact same semver:
 *   1. .zcode-plugin/plugin.json   -> "version"
 *   2. scripts/mcp-server.mjs      -> serverInfo.version (initialize response)
 *   3. assets/panel.html           -> appInfo.version (ui/initialize handshake)
 *   4. scripts/hook-runner.mjs     -> SessionStart banner "[Vibe Debrief vX.Y.Z ...]"
 *
 * Usage:
 *   node scripts/check-version-sync.mjs            # all four must agree
 *   node scripts/check-version-sync.mjs 0.3.0      # all four must equal 0.3.0
 *
 * Exits 0 when synced, 1 on any mismatch or unreadable location.
 * Pure helpers are exported so the node:test suite can exercise drift cases
 * without touching the real files. This script is a CLI gate, not part of the
 * MCP/hook transport: it may write to stdout/stderr freely.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * The four canonical version locations (AGENTS.md §5 "Version Synchronization").
 * Each extractor receives the file text and returns the declared version string
 * or null when the declaration cannot be found.
 */
export const VERSION_LOCATIONS = [
  {
    id: "plugin-manifest",
    file: join(".zcode-plugin", "plugin.json"),
    label: '.zcode-plugin/plugin.json "version"',
    extract(text) {
      const manifest = JSON.parse(text);
      return typeof manifest.version === "string" ? manifest.version : null;
    }
  },
  {
    id: "mcp-server-info",
    file: join("scripts", "mcp-server.mjs"),
    label: "scripts/mcp-server.mjs serverInfo.version",
    extract(text) {
      const match = text.match(/serverInfo:\s*\{[^}]*?version:\s*"([^"]+)"/);
      return match ? match[1] : null;
    }
  },
  {
    id: "panel-app-info",
    file: join("assets", "panel.html"),
    label: "assets/panel.html appInfo.version",
    extract(text) {
      const match = text.match(/appInfo:\s*\{[^}]*?version:\s*"([^"]+)"/);
      return match ? match[1] : null;
    }
  },
  {
    id: "hook-banner",
    file: join("scripts", "hook-runner.mjs"),
    label: "scripts/hook-runner.mjs SessionStart banner",
    extract(text) {
      const match = text.match(/\[Vibe Debrief v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
      return match ? match[1] : null;
    }
  }
];

/** Read every version location from disk. Never throws; errors become entries. */
export function collectVersionDeclarations(repoRoot = REPO_ROOT) {
  return VERSION_LOCATIONS.map((location) => {
    const filePath = join(repoRoot, location.file);
    try {
      const version = location.extract(readFileSync(filePath, "utf8"));
      return {
        id: location.id,
        file: location.file,
        label: location.label,
        version,
        error: version === null ? "version declaration not found" : null
      };
    } catch (error) {
      return {
        id: location.id,
        file: location.file,
        label: location.label,
        version: null,
        error: error.message
      };
    }
  });
}

/**
 * Pure comparison over declaration entries ({ label, version, error }).
 * Returns { ok, version, problems[] }. When expectedVersion is given, every
 * location must equal it; otherwise all locations must simply agree.
 */
export function compareVersionDeclarations(declarations, expectedVersion = null) {
  const problems = [];

  if (expectedVersion !== null && !SEMVER_PATTERN.test(expectedVersion)) {
    problems.push(`expected version "${expectedVersion}" is not a valid semver string`);
  }

  for (const entry of declarations) {
    if (entry.error) {
      problems.push(`${entry.label}: ${entry.error}`);
    } else if (entry.version === null || !SEMVER_PATTERN.test(entry.version)) {
      problems.push(`${entry.label}: missing or invalid semver declaration (${entry.version})`);
    }
  }

  const versions = declarations
    .map((entry) => entry.version)
    .filter((version) => typeof version === "string" && SEMVER_PATTERN.test(version));
  const unique = [...new Set(versions)];

  if (problems.length === 0 && unique.length > 1) {
    problems.push(`version drift detected: ${unique.join(" vs ")}`);
  }

  if (problems.length === 0 && expectedVersion !== null && unique[0] !== expectedVersion) {
    problems.push(`all locations declare ${unique[0]}, expected ${expectedVersion}`);
  }

  return {
    ok: problems.length === 0,
    version: unique.length === 1 ? unique[0] : null,
    problems
  };
}

/** Convenience: collect from disk and compare in one call. */
export function checkVersionSync({ repoRoot = REPO_ROOT, expectedVersion = null } = {}) {
  const declarations = collectVersionDeclarations(repoRoot);
  const result = compareVersionDeclarations(declarations, expectedVersion);
  return { ...result, declarations };
}

function main() {
  const expectedVersion = process.argv[2] ?? null;
  const { ok, version, problems, declarations } = checkVersionSync({ expectedVersion });

  for (const entry of declarations) {
    const declared = entry.version ?? `<unreadable: ${entry.error}>`;
    process.stdout.write(`${entry.label} -> ${declared}\n`);
  }

  if (ok) {
    process.stdout.write(
      `OK: all ${declarations.length} version locations synced to ${version}\n`
    );
    process.exit(0);
  }

  for (const problem of problems) {
    process.stderr.write(`FAIL: ${problem}\n`);
  }
  process.exit(1);
}

// Run only when invoked directly (node scripts/check-version-sync.mjs),
// never when imported by the test suite.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
