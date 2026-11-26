import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  errorMessage,
  inspectWorkspaceArtifact,
  manageBmadTaskQueue,
  openWorkspaceArtifactExternally,
  prepareNewSession,
  reconcileWorkspaceTrackers,
  savePersistedState,
  scanBmadWorkspace,
  updateAdvisorState
} from "./bmad-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const PANEL_HTML_PATH = join(PLUGIN_ROOT, "assets", "panel.html");
const PANEL_URI = "ui://bmad-companion/panel.html";
const SURFACE_ID = "bmad-companion";
const HTML_MIME = "text/html;profile=mcp-app";

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
  const q = scan.taskQueue;
  const queueLines =
    q && q.items && q.items.length > 0
      ? [
          ``,
          `## Active & Queued BMAD Tasks (${q.counts.done}/${q.counts.total} complete · Status: ${q.status.toUpperCase()} · Mode: ${q.executionMode} · Review: ${q.defaultReviewMode})`,
          q.activeTask
            ? `- 🟢 **ACTIVE TASK:** **${q.activeTask.title}** — Model: \`${q.activeTask.model}\` · Review: \`${q.activeTask.reviewMode}\`\n  - Prompt: \`${q.activeTask.effectivePrompt}\``
            : `- ⏸ **Active Task:** None currently running`,
          ...q.items
            .filter((it) => it.status === "queued")
            .map(
              (it, i) =>
                `- ⏳ **In Queue #${i + 1}:** **${it.title}** — Model: \`${it.model}\` · Review: \`${it.reviewMode}\``
            )
        ]
      : [];
  const lines = [
    `# BMAD Companion — ${scan.projectName} (${scan.techStack})`,
    ``,
    `- **Smart AI Progress:** ${m.smartDoneStories}/${m.totalStories} stories complete (**${m.smartOverallPct}%**) across **${m.totalEpics} epics**`,
    `- **Static Tracker Progress:** ${m.declaredDoneStories}/${m.totalStories} stories (**${m.declaredOverallPct}%**) · **${m.reconciledStoriesCount} stories smart-reconciled**`,
    `- **Current Breakdown:** ${m.smartDoneStories} Done · ${m.reviewStories} In Review · ${m.inProgressStories} In Progress · ${m.backlogStories} Backlog`,
    `- **Latest Turn Insight:** ${scan.turnAnalysis.aiSummaryHeadline}`,
    ...queueLines,
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
        focusSummary: {
          type: "string",
          description:
            "Optional 1-2 plain everyday sentences describing the current focus (what was just done and what matters now). Must be jargon-free: no /bmad-* commands, phase codes, or tracker filenames — jargon-laden text is rejected at scan time in favor of a deterministic fallback."
        },
        sessionId: {
          type: "string",
          description:
            "Optional current conversation session id. When provided, the focus summary is bound to that conversation and its entry is upserted in the rolling 3-conversation memory; when omitted, no conversation entry is created."
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
          description:
            "Optional live model catalog entries from ListModels. Pass the full list when available; partial lists merge with the stored catalog so no accessible model is hidden.",
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
          default: false,
          description: "If true, simulates the reconciliation and returns changes without writing files to disk."
        },
        target: {
          type: "string",
          enum: ["all", "v6-yaml", "v7-tickets"],
          default: "all",
          description: "Choose which tracker files to reconcile: all (default), v6-yaml, or v7-tickets."
        },
        backup: {
          type: "boolean",
          default: true,
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
  },
  {
    name: "bmad_queue_manage",
    description:
      "Manage the BMAD Companion Multi-Task Execution Queue: add tasks or entire epics with per-task AI models and configurable review modes (none/quick/thorough), reorder/remove tasks, mark tasks active or completed (auto-advancing the queue and updating story completion in the panel), and generate an executable ZCode Dynamic Workflow (.dwf.ts) or Separate-Sessions execution plan.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "get",
            "add",
            "add-epic",
            "update-item",
            "retry-failed",
            "set-review-mode",
            "set-execution-mode",
            "set-split-config",
            "reorder",
            "remove",
            "clear",
            "start-queue",
            "start-task",
            "complete-task",
            "pause-queue",
            "generate-workflow"
          ],
          description: "Queue operation to perform."
        },
        items: {
          type: "array",
          description: "Tasks to add when action='add'.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              skill: { type: "string" },
              prompt: { type: "string" },
              model: { type: "string", description: "Selected model ID (providerId/modelId) for this task." },
              reviewMode: { type: "string", enum: ["none", "quick", "thorough"] },
              taskPhase: { type: "string", enum: ["plan", "build"], description: "Optional explicit phase tag ('plan' or 'build') when bypassing automatic split." },
              storyId: { type: "string" },
              overrideKey: { type: "string" },
              epicSlug: { type: "string" },
              verifyCommand: { type: "string" }
            }
          }
        },
        epicSlug: {
          type: "string",
          description: "Epic slug or ID when action='add-epic' (enqueues all incomplete stories in the epic)."
        },
        includeDone: {
          type: "boolean",
          description: "If true with action='add-epic', also enqueue stories already marked done."
        },
        taskId: {
          type: "string",
          description: "Target task ID for update-item, reorder, remove, start-task, or complete-task."
        },
        sessionId: {
          type: "string",
          description: "When action='start-task', the ZCode session id launched for this task (records the queue-to-session link so the Stop-hook handoff can continue the chain)."
        },
        model: {
          type: "string",
          description: "Model ID (providerId/modelId) when updating a task or queueing an epic."
        },
        reviewMode: {
          type: "string",
          enum: ["none", "quick", "thorough"],
          description: "Review mode: 'none' (oneshot + deterministic tests only, lowest token cost), 'quick' (oneshot + 1 quick review), or 'thorough' (full multi-lens review)."
        },
        applyToAll: {
          type: "boolean",
          description: "When action='set-review-mode', apply the new reviewMode to all queued items (default true)."
        },
        splitPlanBuild: {
          type: "boolean",
          description: "When true (default), automatically split queued build tasks/stories into interleaved Plan (Planner model) and Build (Coder model) steps."
        },
        plannerModel: {
          type: "string",
          description: "Default Planner model ID (providerId/modelId) for auto-split Plan steps, or empty string for Auto (Deep Reasoning)."
        },
        builderModel: {
          type: "string",
          description: "Default Coder/Builder model ID (providerId/modelId) for auto-split Build steps, or empty string for Auto (Agentic Coding)."
        },
        applyToExisting: {
          type: "boolean",
          description: "When action='set-split-config', update existing queued Plan/Build items with the new Planner/Builder model (default true)."
        },
        executionMode: {
          type: "string",
          enum: ["dynamic-workflow", "separate-sessions"],
          description: "Execution engine for running the queue: 'dynamic-workflow' (.dwf.ts via CreateWorkflow) or 'separate-sessions' (CreateSession handoff chain — each finished task session starts the next with its own model)."
        },
        prompt: {
          type: "string",
          description: "Updated prompt string when action='update-item' or top-level add."
        },
        title: {
          type: "string",
          description: "Updated title string when action='update-item' or top-level add."
        },
        status: {
          type: "string",
          enum: ["queued", "running", "done", "failed", "skipped"],
          description: "Updated task status when action='update-item'."
        },
        direction: {
          type: "string",
          enum: ["up", "down"],
          description: "Move task up or down when action='reorder'."
        },
        onlyCompleted: {
          type: "boolean",
          description: "When action='clear', only remove completed tasks if true."
        },
        failed: {
          type: "boolean",
          description: "When action='complete-task', mark the task as failed instead of done."
        },
        storyStatus: {
          type: "string",
          enum: ["done", "review", "in-progress", "backlog"],
          description: "When action='complete-task', status to record on the linked story (default 'done')."
        },
        summary: {
          type: "string",
          description: "Outcome summary when completing a task."
        }
      },
      required: ["action"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    _meta: {
      ui: {
        resourceUri: PANEL_URI,
        surface: SURFACE_ID,
        visibility: ["model", "app"]
      }
    }
  }
];

// Single success-result shape for every tool: text content + structuredContent.
function toolResult(text, structuredContent) {
  return {
    content: [{ type: "text", text }],
    structuredContent
  };
}

// Single error-result shape for every tool failure (no structuredContent).
function toolErrorResult(text) {
  return {
    isError: true,
    content: [{ type: "text", text }]
  };
}

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
    return toolResult(formatStateMarkdown(scan), scan);
  }

  if (name === "bmad_update_advisor") {
    const scan = updateAdvisorState(workspaceRoot, args);
    return toolResult(
      `Updated BMAD Companion advisor state.\n\n${formatStateMarkdown(scan)}`,
      scan
    );
  }

  if (name === "bmad_prepare_new_session") {
    const structured = await prepareNewSession(workspaceRoot, args);
    return toolResult(
      structured.openedDirectly && structured.pasted
        ? `Opened a new conversation with prompt pre-pasted (recommended model: ${structured.model}).`
        : structured.copied
          ? `Copied prompt to clipboard (recommended model: ${structured.model}). Press Ctrl+N (or Cmd+N) then paste into the new conversation.`
          : `Prepared new conversation prompt (recommended model: ${structured.model}).`,
      structured
    );
  }

  if (name === "bmad_reconcile_trackers") {
    const result = reconcileWorkspaceTrackers(workspaceRoot, args);
    const modeStr = result.dryRun ? "[DRY RUN] " : "";
    const lines = [
      `# ${modeStr}BMAD Tracker Reconciliation`,
      ``,
      `- **Target:** \`${result.target}\``,
      `- **Updated Files:** ${result.updatedFiles.length} file(s)`,
      `- **Total Status Keys Reconciled:** ${result.changesCount}`,
      `- **Static Tracker Progress:** ${result.before.declaredOverallPct}% (${result.before.declaredDoneStories} stories) → **${result.after.declaredOverallPct}% (${result.after.declaredDoneStories} stories)**`,
      `- **Smart AI Progress:** **${result.after.smartOverallPct}% (${result.after.smartDoneStories} stories)**`,
      ``,
      `### Reconciled Changes`,
      ...(result.changes.length === 0
        ? ["- *(No tracker files required status changes; trackers already match code reality)*"]
        : result.changes.slice(0, 15).map(
            (c) => `- \`${c.key}\` in *${c.file}*: \`${c.oldStatus}\` → **\`${c.newStatus}\`** (${c.reason})`
          )),
      ...(result.changes.length > 15 ? [`... and ${result.changes.length - 15} more changes`] : [])
    ];
    return toolResult(lines.join("\n"), result);
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
    return toolResult(lines.join("\n"), {
      recommendations: scan.recommendations,
      matchingSkills: matchingSkills.slice(0, 12)
    });
  }

  if (name === "bmad_inspect_artifact") {
    const info = inspectWorkspaceArtifact(workspaceRoot, args.relPath);
    return toolResult(
      `# Artifact: ${info.relPath}\n- Last Modified: ${info.lastModifiedIso}\n- Diff Source: ${info.diffSource}\n\n## Git Diff\n\`\`\`diff\n${info.diff}\n\`\`\`\n\n## Content Preview\n${info.preview}${info.truncated ? "\n\n...[truncated]" : ""}`,
      info
    );
  }

  if (name === "bmad_open_artifact_file") {
    const openedResult = openWorkspaceArtifactExternally(workspaceRoot, args.relPath);
    const info = inspectWorkspaceArtifact(workspaceRoot, args.relPath);
    return toolResult(
      `Opened artifact ${info.relPath} (${openedResult.opened ? "launched in desktop editor" : "preview loaded"}).\n\n## Git Diff (${info.diffSource})\n\`\`\`diff\n${info.diff}\n\`\`\``,
      {
        ...info,
        openedExternally: openedResult.opened
      }
    );
  }

  if (name === "bmad_queue_manage") {
    const res = manageBmadTaskQueue(workspaceRoot, args);
    const q = res.taskQueue;
    const wf = res.generatedWorkflow;
    const summaryLines = [
      `# BMAD Companion Task Queue (${res.action})`,
      `- **Queue Status:** ${q.status.toUpperCase()} (${q.counts.done}/${q.counts.total} complete · ${q.counts.queued} in queue · ${q.counts.running} active${q.counts.failed > 0 ? ` · ${q.counts.failed} failed` : ""})`,
      `- **Execution Mode:** \`${q.executionMode}\` · **Default Review Gate:** \`${q.defaultReviewMode}\` · **Plan → Build Split:** \`${q.splitPlanBuild ? "on" : "off"}\``,
      q.activeTask
        ? `- 🟢 **Active Task:** **${q.activeTask.title}** (\`${q.activeTask.model}\` · review: \`${q.activeTask.reviewMode}\`)`
        : `- ⏸ **Active Task:** None`,
      ...(wf
        ? q.executionMode === "separate-sessions" && wf.separateSessionsPrompt
          ? [
              `- 🚀 **Separate-Sessions Launch Plan (${wf.tasksCount} tasks):**`,
              `  - ${wf.separateSessionsPrompt.split("\n")[0]}`,
              `  - Generated Workflow Artifact: \`${wf.workflowRelPath}\``
            ]
          : [
              `- ⚡ **Generated Dynamic Workflow:** \`${wf.workflowRelPath}\` (${wf.tasksCount} tasks)`,
              `  - Workflow Launch Command: \`${wf.workflowLaunchPrompt}\``
            ]
        : [])
    ];
    return toolResult(summaryLines.join("\n"), {
      ...res.scan,
      queueActionResult: {
        action: res.action,
        taskQueue: res.taskQueue,
        generatedWorkflow: res.generatedWorkflow
      }
    });
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

async function processLine(line) {
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
          version: "0.5.4"
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
        sendResponse(id, toolErrorResult(errorMessage(err)));
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
    sendError(id, -32603, errorMessage(err));
  }
}

let lineQueue = Promise.resolve();
rl.on("line", (line) => {
  lineQueue = lineQueue.then(() => processLine(line)).catch(() => {});
});
