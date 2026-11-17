import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectWorkspaceArtifact,
  openWorkspaceArtifactExternally,
  reconcileWorkspaceTrackers,
  savePersistedState,
  scanBmadWorkspace
} from "./bmad-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const PANEL_HTML_PATH = join(PLUGIN_ROOT, "assets", "panel.html");
const PANEL_URI = "ui://bmad-companion/panel.html";
const SURFACE_ID = "bmad-companion";
const HTML_MIME = "text/html;profile=mcp-app";

function runCommandAsync(command, args, { env = process.env, stdinText = null, timeoutMs = 8000 } = {}) {
  return new Promise((resolvePromise) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      env,
      windowsHide: true,
      stdio: [stdinText !== null ? "pipe" : "ignore", "pipe", "pipe"]
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {}
      resolvePromise({ ok: false, code: null, stdout, stderr: stderr || "timeout" });
    }, timeoutMs);

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ ok: false, code: null, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ ok: code === 0, code, stdout, stderr });
    });
    if (stdinText !== null && child.stdin) {
      child.stdin.write(stdinText, "utf8");
      child.stdin.end();
    }
  });
}

async function openNewConversationWithPrompt(promptText, openDirectly = true) {
  const text = String(promptText || "");
  if (!text) {
    return { copied: false, openedDirectly: false, pasted: false, method: "none", error: "empty_prompt" };
  }

  if (process.platform === "win32") {
    const psScript = [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$raw = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:BMAD_PROMPT_B64))",
      "[System.Windows.Forms.Clipboard]::SetDataObject($raw, $true, 5, 50)",
      "if ($env:BMAD_OPEN_DIRECTLY -eq '1') {",
      "  Start-Sleep -Milliseconds 75",
      "  [System.Windows.Forms.SendKeys]::SendWait('^n')",
      "  Start-Sleep -Milliseconds 500",
      "  [System.Windows.Forms.SendKeys]::SendWait('^v')",
      "}"
    ].join("; ");

    const res = await runCommandAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-Command", psScript],
      {
        env: {
          ...process.env,
          BMAD_PROMPT_B64: Buffer.from(text, "utf8").toString("base64"),
          BMAD_OPEN_DIRECTLY: openDirectly ? "1" : "0"
        },
        timeoutMs: 8000
      }
    );
    if (res.ok) {
      return {
        copied: true,
        openedDirectly: Boolean(openDirectly),
        pasted: Boolean(openDirectly),
        method: openDirectly ? "win32-sendkeys-ctrl-n-v" : "win32-clipboard"
      };
    }
    return {
      copied: false,
      openedDirectly: false,
      pasted: false,
      method: "win32-failed",
      error: res.stderr.trim() || `exit_${res.code}`
    };
  }

  if (process.platform === "darwin") {
    const copyRes = await runCommandAsync("pbcopy", [], { stdinText: text, timeoutMs: 3000 });
    if (!copyRes.ok) {
      return { copied: false, openedDirectly: false, pasted: false, method: "darwin-pbcopy-failed", error: copyRes.stderr.trim() };
    }
    if (!openDirectly) {
      return { copied: true, openedDirectly: false, pasted: false, method: "darwin-clipboard" };
    }
    const osaRes = await runCommandAsync(
      "osascript",
      [
        "-e", 'tell application "System Events" to keystroke "n" using command down',
        "-e", "delay 0.5",
        "-e", 'tell application "System Events" to keystroke "v" using command down'
      ],
      { timeoutMs: 6000 }
    );
    return {
      copied: true,
      openedDirectly: osaRes.ok,
      pasted: osaRes.ok,
      method: osaRes.ok ? "darwin-osascript-cmd-n-v" : "darwin-clipboard-only",
      ...(osaRes.ok ? {} : { error: osaRes.stderr.trim() })
    };
  }

  // Linux best-effort clipboard + xdotool
  let copied = false;
  for (const [cmd, args] of [
    ["wl-copy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["xsel", ["--clipboard", "--input"]]
  ]) {
    const r = await runCommandAsync(cmd, args, { stdinText: text, timeoutMs: 2500 });
    if (r.ok) {
      copied = true;
      break;
    }
  }
  if (!copied || !openDirectly) {
    return { copied, openedDirectly: false, pasted: false, method: copied ? "linux-clipboard" : "linux-unsupported" };
  }
  const nRes = await runCommandAsync("xdotool", ["key", "--clearmodifiers", "ctrl+n"], { timeoutMs: 2500 });
  if (!nRes.ok) {
    return { copied: true, openedDirectly: false, pasted: false, method: "linux-clipboard-only", error: nRes.stderr.trim() };
  }
  await new Promise((r) => setTimeout(r, 500));
  const vRes = await runCommandAsync("xdotool", ["key", "--clearmodifiers", "ctrl+v"], { timeoutMs: 2500 });
  return {
    copied: true,
    openedDirectly: true,
    pasted: vRes.ok,
    method: vRes.ok ? "linux-xdotool-ctrl-n-v" : "linux-xdotool-ctrl-n-only"
  };
}

function getWorkspaceRoot() {
  return resolve(
    process.env.ZCODE_WORKSPACE_ROOT ||
      process.env.ZCODE_PROJECT_DIR ||
      process.env.CLAUDE_PROJECT_DIR ||
      process.cwd()
  );
}

function formatStateMarkdown(scan) {
  const m = scan.metrics;
  const lines = [
    `# BMAD Companion — ${scan.projectName} (${scan.techStack})`,
    ``,
    `- **Smart AI Progress:** ${m.smartDoneStories}/${m.totalStories} stories complete (**${m.smartOverallPct}%**) across **${m.totalEpics} epics**`,
    `- **Static Tracker Progress:** ${m.declaredDoneStories}/${m.totalStories} stories (**${m.declaredOverallPct}%**) · **${m.reconciledStoriesCount} stories smart-reconciled**`,
    `- **Current Breakdown:** ${m.smartDoneStories} Done · ${m.reviewStories} In Review · ${m.inProgressStories} In Progress · ${m.backlogStories} Backlog`,
    `- **Latest Turn Insight:** ${scan.turnAnalysis.aiSummaryHeadline}`,
    ``,
    `## Top Recommended Next BMAD Prompts & Models`,
    ...scan.recommendations.slice(0, 5).map(
      (r, idx) =>
        `${idx + 1}. **${r.title}** (${r.phase})\n   - Command: \`${r.fullCommand}\`\n   - Recommended Model: \`${r.recommendedModel?.modelId}\` (${r.recommendedModel?.tier} — ${r.recommendedModel?.reason})\n   - Why: ${r.rationale}`
    ),
    ``,
    `## 4-Phase BMAD Lifecycle`,
    ...scan.phases.map(
      (p) => `- **${p.name}**: ${p.progressPct}% (${p.status}) — ${p.summary}`
    )
  ];
  return lines.join("\n");
}

const TOOLS = [
  {
    name: "bmad_open_companion",
    description:
      "Open the BMAD Companion right-side panel for the current workspace and return the full BMAD-METHOD phase, epic, and story progress along with AI-recommended next /bmad-* skills, contextual prompts, and recommended models.",
    inputSchema: {
      type: "object",
      properties: {
        focus: {
          type: "string",
          description: "Optional focus area or recent user goal to tailor recommendations."
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    _meta: {
      ui: {
        resourceUri: PANEL_URI,
        surface: SURFACE_ID,
        visibility: ["model", "app"]
      },
      "openai/ui": { preferredModelDisplayMode: "fullscreen" }
    }
  },
  {
    name: "bmad_get_state",
    description:
      "Scan the workspace's BMAD artifacts (_bmad-output, sprint-status.yaml, tickets.toml, epics, stories, retrospectives, UX designs, and git status) and return the live state, post-prompt recommendations, and recommended models for the BMAD Companion panel.",
    inputSchema: {
      type: "object",
      properties: {
        refresh: {
          type: "boolean",
          description: "Force a fresh workspace scan."
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    _meta: {
      ui: {
        resourceUri: PANEL_URI,
        surface: SURFACE_ID,
        visibility: ["model", "app"]
      }
    }
  },
  {
    name: "bmad_update_advisor",
    description:
      "Update the BMAD Companion right-side panel with AI post-prompt analysis, tailored next /bmad-<skill> \"<prompt>\" suggestions, recommended models, and optional smart story status reconciliations.",
    inputSchema: {
      type: "object",
      properties: {
        headline: {
          type: "string",
          description: "Concise 1-sentence headline summarizing the project or turn state."
        },
        turnSummary: {
          type: "string",
          description: "Summary of what the last prompt result accomplished and what BMAD step comes next."
        },
        recommendations: {
          type: "array",
          description: "List of contextual BMAD skill + prompt + recommended model suggestions.",
          items: {
            type: "object",
            properties: {
              skill: { type: "string", description: "BMAD skill command, e.g. /bmad-ux" },
              fullCommand: {
                type: "string",
                description: "Full command with contextual quoted prompt, e.g. /bmad-ux \"Enhance the UI/UX of the application\""
              },
              title: { type: "string" },
              rationale: { type: "string" },
              recommendedModel: {
                type: "string",
                description: "Optional model ID from ListModels (format: providerId/modelId)."
              },
              modelReason: {
                type: "string",
                description: "Why this model is recommended for this prompt."
              },
              phase: {
                type: "string",
                enum: ["1-analysis", "2-planning", "3-solutioning", "4-implementation", "anytime"]
              },
              priority: {
                type: "string",
                enum: ["high", "medium", "next-step"]
              }
            },
            required: ["skill", "fullCommand", "title", "rationale"]
          }
        },
        hostModels: {
          type: "array",
          description: "Optional live model catalog entries from ListModels to synchronize dynamic model recommendations with active provider & subscription state.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              providerId: { type: "string" },
              modelId: { type: "string" },
              providerLabel: { type: "string" },
              reasoningLevels: { type: "array", items: { type: "string" } },
              defaultReasoningLevel: { type: "string" },
              contextWindow: { type: "number" },
              disabledReason: { type: "string" },
              current: { type: "boolean" }
            }
          }
        },
        storyStatusUpdates: {
          type: "array",
          description: "Optional smart AI overrides for story statuses when code/artifacts prove completion or review state.",
          items: {
            type: "object",
            properties: {
              overrideKey: {
                type: "string",
                description: "Story overrideKey from bmad_get_state, e.g. epic-slug#1"
              },
              status: {
                type: "string",
                enum: ["done", "review", "in-progress", "backlog"]
              },
              reason: {
                type: "string",
                description: "Evidence for the smart status update."
              }
            },
            required: ["overrideKey", "status"]
          }
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    _meta: {
      ui: {
        resourceUri: PANEL_URI,
        surface: SURFACE_ID,
        visibility: ["model", "app"]
      },
      "openai/ui": { preferredModelDisplayMode: "fullscreen" }
    }
  },
  {
    name: "bmad_prepare_new_session",
    description:
      "Copy a BMAD prompt to the clipboard and directly open a new ZCode conversation with the prompt pre-pasted in the composer (without running anything in the current session).",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The full /bmad-<skill> \"<prompt>\" command to pre-paste into the new conversation."
        },
        model: {
          type: "string",
          description: "The recommended model ID (providerId/modelId) for the new conversation."
        },
        skill: {
          type: "string"
        },
        title: {
          type: "string"
        },
        openDirectly: {
          type: "boolean",
          description: "If true (default), directly trigger New Task (Ctrl/Cmd+N) and paste (Ctrl/Cmd+V) into the new conversation composer."
        }
      },
      required: ["prompt", "model"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    _meta: {
      ui: {
        visibility: ["model", "app"]
      }
    }
  },
  {
    name: "bmad_reconcile_trackers",
    description:
      "Reconcile and synchronize workspace tracker files (BMAD v6 sprint-status.yaml and/or BMAD v7 tickets.toml) with Smart AI findings, updating outdated statuses to match verified codebase reality.",
    inputSchema: {
      type: "object",
      properties: {
        dryRun: {
          type: "boolean",
          description: "If true, simulates the reconciliation and returns changes without writing files to disk."
        },
        target: {
          type: "string",
          enum: ["all", "v6-yaml", "v7-tickets"],
          description: "Choose which tracker files to reconcile: all (default), v6-yaml, or v7-tickets."
        },
        backup: {
          type: "boolean",
          description: "Whether to create .bak backup copies before modifying tracker files (default true)."
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    _meta: {
      ui: {
        resourceUri: PANEL_URI,
        surface: SURFACE_ID,
        visibility: ["model", "app"]
      },
      "openai/ui": { preferredModelDisplayMode: "fullscreen" }
    }
  },
  {
    name: "bmad_recommend_next",
    description:
      "Generate contextual /bmad-<skill> \"<prompt>\" recommendations and recommended AI models for a specific focus area (e.g., ux, architecture, testing, build, review, retrospective).",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic, phase, or user goal to generate BMAD skill + prompt + model suggestions for."
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    _meta: {
      ui: {
        visibility: ["model", "app"]
      }
    }
  },
  {
    name: "bmad_inspect_artifact",
    description:
      "Read and preview a BMAD artifact and its git diff from the workspace (_bmad-output, docs, AGENTS.md, CONTEXT.md) for the companion panel or agent.",
    inputSchema: {
      type: "object",
      properties: {
        relPath: {
          type: "string",
          description: "Workspace-relative path to the BMAD artifact."
        }
      },
      required: ["relPath"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    _meta: {
      ui: {
        visibility: ["model", "app"]
      }
    }
  },
  {
    name: "bmad_open_artifact_file",
    description:
      "Open a generated BMAD artifact file in the user's desktop editor/viewer and return its git diff and content preview.",
    inputSchema: {
      type: "object",
      properties: {
        relPath: {
          type: "string",
          description: "Workspace-relative path to the BMAD artifact to open."
        }
      },
      required: ["relPath"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    _meta: {
      ui: {
        visibility: ["model", "app"]
      }
    }
  }
];

async function handleToolCall(name, args = {}) {
  const workspaceRoot = getWorkspaceRoot();

  if (name === "bmad_open_companion" || name === "bmad_get_state") {
    if (args.focus) {
      savePersistedState(workspaceRoot, {
        lastUserPrompt: String(args.focus),
        lastUserPromptAt: new Date().toISOString()
      });
    }
    const scan = scanBmadWorkspace(workspaceRoot);
    return {
      content: [{ type: "text", text: formatStateMarkdown(scan) }],
      structuredContent: scan
    };
  }

  if (name === "bmad_update_advisor") {
    const storyOverrides = {};
    if (Array.isArray(args.storyStatusUpdates)) {
      for (const item of args.storyStatusUpdates) {
        if (item?.overrideKey && item?.status) {
          storyOverrides[item.overrideKey] = {
            status: item.status,
            reason: item.reason || "Verified by ZCode AI Companion",
            updatedAt: new Date().toISOString()
          };
        }
      }
    }
    const override = {
      headline: args.headline || undefined,
      turnSummary: args.turnSummary || undefined,
      recommendations: Array.isArray(args.recommendations) ? args.recommendations : undefined,
      updatedAt: new Date().toISOString()
    };
    savePersistedState(workspaceRoot, {
      agentAdvisorOverride: override,
      storyOverrides,
      ...(Array.isArray(args.hostModels) ? { hostModels: args.hostModels } : {}),
      lastTurnAnalyzedAt: new Date().toISOString()
    });
    const scan = scanBmadWorkspace(workspaceRoot);
    return {
      content: [
        {
          type: "text",
          text: `Updated BMAD Companion advisor state.\n\n${formatStateMarkdown(scan)}`
        }
      ],
      structuredContent: scan
    };
  }

  if (name === "bmad_prepare_new_session") {
    const openDirectly = args.openDirectly !== false;
    const launchRecord = {
      prompt: String(args.prompt || ""),
      model: String(args.model || ""),
      skill: String(args.skill || ""),
      title: String(args.title || ""),
      requestedAt: new Date().toISOString()
    };
    savePersistedState(workspaceRoot, {
      lastLaunchedSession: launchRecord
    });
    const launchStatus = await openNewConversationWithPrompt(launchRecord.prompt, openDirectly);
    return {
      content: [
        {
          type: "text",
          text: launchStatus.openedDirectly && launchStatus.pasted
            ? `Opened a new conversation with prompt pre-pasted (recommended model: ${launchRecord.model}).`
            : launchStatus.copied
              ? `Copied prompt to clipboard (recommended model: ${launchRecord.model}). Press Ctrl+N (or Cmd+N) then paste into the new conversation.`
              : `Prepared new conversation prompt (recommended model: ${launchRecord.model}).`
        }
      ],
      structuredContent: {
        ...launchRecord,
        ...launchStatus
      }
    };
  }

  if (name === "bmad_reconcile_trackers") {
    const result = reconcileWorkspaceTrackers(workspaceRoot, args);
    const modeStr = result.dryRun ? "[DRY RUN] " : "";
    const lines = [
      `# ${modeStr}BMAD Tracker Reconciliation`,
      ``,
      `- **Updated Files:** ${result.updatedFiles.length} file(s)`,
      `- **Total Status Keys Reconciled:** ${result.changesCount}`,
      `- **Static Tracker Progress:** ${result.before.declaredOverallPct}% (${result.before.declaredDoneStories} stories) → **${result.after.declaredOverallPct}% (${result.after.declaredDoneStories} stories)**`,
      `- **Smart AI Progress:** **${result.after.smartOverallPct}% (${result.after.smartDoneStories} stories)**`,
      ``,
      `### Reconciled Changes`,
      ...result.changes.slice(0, 15).map(
        (c) => `- \`${c.key}\` in *${c.file}*: \`${c.oldStatus}\` → **\`${c.newStatus}\`** (${c.reason})`
      ),
      ...(result.changes.length > 15 ? [`... and ${result.changes.length - 15} more changes`] : [])
    ];
    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: result
    };
  }

  if (name === "bmad_recommend_next") {
    if (args.topic) {
      savePersistedState(workspaceRoot, {
        lastUserPrompt: String(args.topic),
        lastUserPromptAt: new Date().toISOString()
      });
    }
    const scan = scanBmadWorkspace(workspaceRoot);
    const topicLower = String(args.topic || "").toLowerCase();
    const matchingSkills = scan.skillsCatalog.filter(
      (s) =>
        !topicLower ||
        s.skill.toLowerCase().includes(topicLower) ||
        s.displayName.toLowerCase().includes(topicLower) ||
        s.description.toLowerCase().includes(topicLower) ||
        s.phase.toLowerCase().includes(topicLower)
    );
    const lines = [
      `# Contextual BMAD Skill + Prompt + Model Suggestions (${scan.projectName})`,
      ``,
      `### Priority Post-Prompt Recommendations`,
      ...scan.recommendations.map(
        (r) =>
          `- **${r.title}**: \`${r.fullCommand}\`\n  - **Recommended Model**: \`${r.recommendedModel?.modelId}\` (${r.recommendedModel?.tier})\n  - _${r.rationale}_`
      ),
      ``,
      `### Matching Catalog Skills with Tailored Prompts & Models`,
      ...matchingSkills.slice(0, 8).map(
        (s) =>
          `- **${s.displayName}** (\`${s.skill}\` · ${s.phase} · Model: \`${s.recommendedModel?.modelId}\`):\n  \`${s.contextualCommand}\``
      )
    ];
    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: {
        recommendations: scan.recommendations,
        matchingSkills: matchingSkills.slice(0, 12)
      }
    };
  }

  if (name === "bmad_inspect_artifact") {
    const info = inspectWorkspaceArtifact(workspaceRoot, args.relPath);
    return {
      content: [
        {
          type: "text",
          text: `# Artifact: ${info.relPath}\n- Last Modified: ${info.lastModifiedIso}\n- Diff Source: ${info.diffSource}\n\n## Git Diff\n\`\`\`diff\n${info.diff}\n\`\`\`\n\n## Content Preview\n${info.preview}${info.truncated ? "\n\n...[truncated]" : ""}`
        }
      ],
      structuredContent: info
    };
  }

  if (name === "bmad_open_artifact_file") {
    const openedResult = openWorkspaceArtifactExternally(workspaceRoot, args.relPath);
    const info = inspectWorkspaceArtifact(workspaceRoot, args.relPath);
    return {
      content: [
        {
          type: "text",
          text: `Opened artifact ${info.relPath} (${openedResult.opened ? "launched in desktop editor" : "preview loaded"}).\n\n## Git Diff (${info.diffSource})\n\`\`\`diff\n${info.diff}\n\`\`\``
        }
      ],
      structuredContent: {
        ...info,
        openedExternally: openedResult.opened
      }
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code, message }
    }) + "\n"
  );
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }
  if (message.id === undefined || message.id === null) {
    return;
  }

  const { id, method, params } = message;
  try {
    if (method === "initialize") {
      sendResponse(id, {
        protocolVersion: params?.protocolVersion || "2025-11-25",
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true }
        },
        serverInfo: {
          name: "bmad-companion",
          version: "0.5.1"
        }
      });
      return;
    }

    if (method === "ping") {
      sendResponse(id, {});
      return;
    }

    if (method === "tools/list") {
      sendResponse(id, { tools: TOOLS });
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const result = await handleToolCall(toolName, toolArgs);
        sendResponse(id, result);
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : String(err)
            }
          ]
        });
      }
      return;
    }

    if (method === "resources/list") {
      sendResponse(id, {
        resources: [
          {
            uri: PANEL_URI,
            name: "panel",
            title: "BMAD Companion Panel",
            mimeType: HTML_MIME,
            _meta: {
              "zcode/csp": {
                unsafeEval: false
              }
            }
          }
        ]
      });
      return;
    }

    if (method === "resources/templates/list") {
      sendResponse(id, { resourceTemplates: [] });
      return;
    }

    if (method === "resources/read") {
      const uri = params?.uri;
      if (uri === PANEL_URI) {
        const html = readFileSync(PANEL_HTML_PATH, "utf8");
        sendResponse(id, {
          contents: [
            {
              uri: PANEL_URI,
              mimeType: HTML_MIME,
              text: html,
              _meta: {
                "zcode/csp": {
                  unsafeEval: false
                }
              }
            }
          ]
        });
        return;
      }
      sendError(id, -32602, `Resource not found: ${uri}`);
      return;
    }

    sendError(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    sendError(id, -32603, err instanceof Error ? err.message : String(err));
  }
});
