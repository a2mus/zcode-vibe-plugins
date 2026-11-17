import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFullPanelState,
  classifyFileRole,
  confirmAndSaveLessonToZCodeMemory,
  loadPersistedState,
  PERSONAS,
  savePersistedState
} from "./debrief-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const PANEL_HTML_PATH = join(PLUGIN_ROOT, "assets", "panel.html");
const PANEL_URI = "ui://vibe-debrief/panel.html";
const SURFACE_ID = "vibe-debrief";
const HTML_MIME = "text/html;profile=mcp-app";

function getWorkspaceRoot() {
  return resolve(
    process.env.ZCODE_WORKSPACE_ROOT ||
      process.env.ZCODE_PROJECT_DIR ||
      process.env.CLAUDE_PROJECT_DIR ||
      process.cwd()
  );
}

function formatDebriefMarkdown(panelState) {
  const d = panelState.currentDebrief || {};
  const personaObj = PERSONAS.find((p) => p.id === (d.persona || panelState.activePersona)) || PERSONAS[0];
  const isBug = d.responseType === "bug";

  const lines = [
    `# Vibe Debrief (${isBug ? "🐛 Bug / Error Fix" : "🚀 Implementation"}) — ${personaObj.badge}`,
    ``,
    `> **TL;DR:** ${d.tldrHeadline || "Visual summary ready."}`,
    `> **💡 Real-World Analogy:** ${d.realWorldAnalogy || ""}`,
    ``
  ];

  if (isBug) {
    const b = d.bugReport || {};
    lines.push(
      `## 1. 🔴 What Was the Cause?`,
      `${b.cause || "N/A"}`,
      ``,
      `## 2. 🛠️ What Was the Plan to Fix It?`,
      `${b.plan || "N/A"}`,
      ``,
      `## 3. ✅ Did It Succeed?`,
      `**Status:** \`${(b.succeeded || "yes").toUpperCase()}\` — ${b.successSummary || "N/A"}`,
      ``,
      `## 4. 🌊 Consequences of This Fix`,
      `${b.consequences || "N/A"}`,
      ``
    );
  } else {
    const imp = d.implementationReport || {};
    lines.push(
      `## 1. 🎯 Purpose / Objective of the Implementation`,
      `${imp.objective || "N/A"}`,
      ``,
      `## 2. 🧭 Plan / Suggested Resolution & Why`,
      `${imp.planAndWhy || "N/A"}`,
      ``,
      `## 3. 🏆 Result of the Implementation`,
      `${imp.result || "N/A"}`,
      ``,
      `## 4. 🌊 Consequences of This Implementation`,
      `${imp.consequences || "N/A"}`,
      ``
    );
  }

  const lessons = Array.isArray(d.lessonsLearned) ? d.lessonsLearned : [];
  if (lessons.length > 0) {
    lines.push(`## 5. 🧠 Lessons Learned (Confirm to Save to ZCode Memory)`);
    for (const l of lessons) {
      lines.push(
        `- **${l.title}** ${l.confirmed ? "✅ *(Saved to ZCode Memory)*" : "⏳ *(Click Confirm in Panel to Save to ZCode Memory)*"}\n  - ${l.summary}\n  - **Why:** ${l.why}\n  - **How to apply:** ${l.howToApply}`
      );
    }
  }

  return lines.join("\n");
}

const TOOLS = [
  {
    name: "vibe_debrief_open",
    description:
      "Open the Vibe Debrief (Visual ELI5) right-side panel to simplify the last AI response for a visual learner and multi-project vibe-coder.",
    inputSchema: {
      type: "object",
      properties: {
        persona: {
          type: "string",
          enum: ["vibe-mentor", "visual-mapper", "indie-founder", "eli5-storyteller"],
          description: "Optional persona voice to use for the visual explanation."
        },
        responseType: {
          type: "string",
          enum: ["bug", "implementation"],
          description: "Optional override to display Bug Fix view or Implementation view."
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
    name: "vibe_debrief_get_state",
    description:
      "Get the current Vibe Debrief right-side panel state, including the latest simplified Bug or Implementation breakdown, visual flow diagram, turn history, and confirmed ZCode Memory lessons.",
    inputSchema: {
      type: "object",
      properties: {
        refresh: {
          type: "boolean",
          description: "Whether to reload the persisted state from disk."
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
    name: "vibe_debrief_publish",
    description:
      "Publish a simplified, visual ELI5 explanation of the last AI response into the right-side Vibe Debrief panel. Use responseType='bug' for shared bugs/errors (Cause, Plan, Succeeded, Consequences, Lessons Learned) or responseType='implementation' for implementations (Objective/Purpose, Plan & Why, Result, Consequences & Lessons Learned).",
    inputSchema: {
      type: "object",
      properties: {
        responseType: {
          type: "string",
          enum: ["bug", "implementation"],
          description: "Choose 'bug' if the turn was about a shared bug/error message, or 'implementation' if it built/changed a feature or setup."
        },
        persona: {
          type: "string",
          enum: ["vibe-mentor", "visual-mapper", "indie-founder", "eli5-storyteller"],
          description: "Persona tone for the explanation (default: vibe-mentor)."
        },
        tldrHeadline: {
          type: "string",
          description: "1-sentence zero-jargon headline summarizing the takeaway for a busy multi-project developer."
        },
        realWorldAnalogy: {
          type: "string",
          description: "A vivid everyday mental picture / analogy that helps a visual learner grasp the whole response in 5 seconds."
        },
        visualFlow: {
          type: "array",
          description: "3 to 4 visual flowchart steps representing the turn.",
          items: {
            type: "object",
            properties: {
              step: { type: "string" },
              icon: { type: "string", description: "Single emoji icon for the visual node" },
              title: { type: "string", description: "Short 2-4 word node title" },
              subtitle: { type: "string", description: "Short 3-6 word caption" },
              status: { type: "string", enum: ["done", "active", "pending", "warning"] }
            },
            required: ["title", "subtitle"]
          }
        },
        bugReport: {
          type: "object",
          description: "Required when responseType='bug'. Explains the bug/error fix in 4 simple parts.",
          properties: {
            cause: {
              type: "string",
              description: "What was the root cause of the bug or error message (plain language, no jargon dump)."
            },
            plan: {
              type: "string",
              description: "What was your plan to fix it."
            },
            succeeded: {
              type: "string",
              enum: ["yes", "partial", "no"],
              description: "Did the fix succeed? ('yes', 'partial', or 'no')"
            },
            successSummary: {
              type: "string",
              description: "Plain explanation of whether it succeeded and how it was verified."
            },
            consequences: {
              type: "string",
              description: "What are the consequences / ripple effects of this fix on the project."
            }
          }
        },
        implementationReport: {
          type: "object",
          description: "Required when responseType='implementation'. Explains the implementation in 4 simple parts.",
          properties: {
            objective: {
              type: "string",
              description: "What was the purpose or objective of the implementation."
            },
            planAndWhy: {
              type: "string",
              description: "What was your plan or suggested resolution AND WHY this approach was chosen."
            },
            result: {
              type: "string",
              description: "What is the concrete result of the implementation."
            },
            consequences: {
              type: "string",
              description: "What are the consequences, trade-offs, or impacts of this implementation."
            }
          }
        },
        lessonsLearned: {
          type: "array",
          description: "Lessons learned from this bug fix or implementation. Confirmed lessons are saved to ZCode Memory.",
          items: {
            type: "object",
            properties: {
              slug: {
                type: "string",
                description: "Short kebab-case slug for ZCode Memory file, e.g. 'always-check-null-session'"
              },
              title: {
                type: "string",
                description: "Concise 1-line lesson rule"
              },
              summary: {
                type: "string",
                description: "Plain-English explanation of the lesson learned"
              },
              why: {
                type: "string",
                description: "Why this lesson matters (especially across vibe-coded projects)"
              },
              howToApply: {
                type: "string",
                description: "How to apply this rule in future turns"
              },
              memoryType: {
                type: "string",
                enum: ["feedback", "project"]
              },
              confirmed: {
                type: "boolean",
                description: "If true, immediately saves this confirmed lesson into ZCode's persistent MEMORY.md."
              }
            },
            required: ["title", "summary"]
          }
        }
      },
      required: ["responseType", "tldrHeadline"],
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
    name: "vibe_debrief_set_persona",
    description:
      "Switch the active persona or view mode (bug vs implementation) in the Vibe Debrief right-side panel.",
    inputSchema: {
      type: "object",
      properties: {
        persona: {
          type: "string",
          enum: ["vibe-mentor", "visual-mapper", "indie-founder", "eli5-storyteller"]
        },
        responseType: {
          type: "string",
          enum: ["bug", "implementation"]
        }
      },
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
    name: "vibe_debrief_confirm_lesson",
    description:
      "Confirm a Lesson Learned and save it permanently to ZCode's project memory directory (<slug>.md + MEMORY.md index).",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Optional lesson ID from the current debrief."
        },
        slug: {
          type: "string",
          description: "Short kebab-case slug for the memory file."
        },
        title: {
          type: "string",
          description: "1-line title / rule of the learned lesson."
        },
        summary: {
          type: "string",
          description: "Full plain-language lesson to remember."
        },
        why: {
          type: "string",
          description: "Why this lesson matters."
        },
        howToApply: {
          type: "string",
          description: "How the AI should apply this lesson in future sessions."
        },
        memoryType: {
          type: "string",
          enum: ["feedback", "project"],
          description: "ZCode memory metadata type (default: feedback)."
        }
      },
      required: ["title", "summary"],
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

async function handleToolCall(name, args = {}) {
  const workspaceRoot = getWorkspaceRoot();

  if (name === "vibe_debrief_open" || name === "vibe_debrief_get_state") {
    const state = loadPersistedState(workspaceRoot);
    let updatedDebrief = state.currentDebrief;
    let activePersona = state.activePersona || "vibe-mentor";

    if (args.persona) {
      activePersona = args.persona;
      if (updatedDebrief) {
        updatedDebrief = { ...updatedDebrief, persona: args.persona };
      }
    }
    if (args.responseType && updatedDebrief) {
      updatedDebrief = { ...updatedDebrief, responseType: args.responseType };
    }
    if (args.persona || args.responseType) {
      savePersistedState(workspaceRoot, {
        activePersona,
        currentDebrief: updatedDebrief
      });
    }

    const panelState = buildFullPanelState(workspaceRoot);
    return {
      content: [{ type: "text", text: formatDebriefMarkdown(panelState) }],
      structuredContent: panelState
    };
  }

  if (name === "vibe_debrief_publish") {
    const state = loadPersistedState(workspaceRoot);
    const activePersona = args.persona || state.activePersona || "vibe-mentor";
    const responseType = args.responseType === "bug" ? "bug" : "implementation";
    const touchedFiles = (state.recentTouchedFiles || []).map(classifyFileRole);

    const defaultFlow =
      responseType === "bug"
        ? [
            { step: "1", icon: "🔴", title: "Root Cause", subtitle: "Pinpointed trigger", status: "done" },
            { step: "2", icon: "🛠️", title: "Fix Plan", subtitle: "Targeted resolution", status: "done" },
            {
              step: "3",
              icon: args.bugReport?.succeeded === "no" ? "❌" : args.bugReport?.succeeded === "partial" ? "⚠️" : "✅",
              title: args.bugReport?.succeeded === "no" ? "Not Fixed Yet" : args.bugReport?.succeeded === "partial" ? "Partial Fix" : "Fix Succeeded",
              subtitle: "Outcome checked",
              status: args.bugReport?.succeeded === "no" ? "warning" : "done"
            },
            { step: "4", icon: "🧠", title: "Lessons", subtitle: "Save to ZCode Memory", status: "active" }
          ]
        : [
            { step: "1", icon: "🎯", title: "Objective", subtitle: "Clear purpose", status: "done" },
            { step: "2", icon: "🧭", title: "Plan & Why", subtitle: "Pragmatic path", status: "done" },
            { step: "3", icon: "🏆", title: "Result", subtitle: "Working delivery", status: "done" },
            { step: "4", icon: "🌊", title: "Impact & Lessons", subtitle: "Save to ZCode Memory", status: "active" }
          ];

    const normalizedLessons = (Array.isArray(args.lessonsLearned) ? args.lessonsLearned : []).map((l, idx) => ({
      id: `lesson-${Date.now()}-${idx}`,
      slug: l.slug || `vibe-lesson-${idx + 1}`,
      title: l.title || "Key Takeaway",
      summary: l.summary || l.title || "",
      why: l.why || "Prevents repeating issues and keeps multi-project vibe coding fast.",
      howToApply: l.howToApply || "Apply this rule when working on similar code.",
      memoryType: l.memoryType === "project" ? "project" : "feedback",
      confirmed: Boolean(l.confirmed)
    }));

    const newDebrief = {
      id: `debrief-${Date.now()}`,
      createdAt: new Date().toISOString(),
      responseType,
      persona: activePersona,
      tldrHeadline: args.tldrHeadline || "Visual summary of the last response.",
      realWorldAnalogy:
        args.realWorldAnalogy ||
        "Think of this change like upgrading a key connector on your workbench — cleaner flow, less friction, and zero unnecessary moving parts.",
      visualFlow:
        Array.isArray(args.visualFlow) && args.visualFlow.length > 0
          ? args.visualFlow.map((node, i) => ({
              step: node.step || String(i + 1),
              icon: node.icon || "✨",
              title: node.title,
              subtitle: node.subtitle,
              status: node.status || "done"
            }))
          : defaultFlow,
      bugReport: {
        cause: args.bugReport?.cause || state.currentDebrief?.bugReport?.cause || "See implementation view or run on a bug turn.",
        plan: args.bugReport?.plan || state.currentDebrief?.bugReport?.plan || "Targeted fix plan.",
        succeeded: args.bugReport?.succeeded || "yes",
        successSummary:
          args.bugReport?.successSummary ||
          (args.bugReport?.succeeded === "no"
            ? "Fix did not succeed yet — check blocker details."
            : args.bugReport?.succeeded === "partial"
            ? "Partially fixed — needs verification."
            : "Yes — Fix applied and verified."),
        consequences:
          args.bugReport?.consequences ||
          state.currentDebrief?.bugReport?.consequences ||
          "Resolves the error cleanly without breaking neighboring features."
      },
      implementationReport: {
        objective:
          args.implementationReport?.objective ||
          state.currentDebrief?.implementationReport?.objective ||
          args.tldrHeadline,
        planAndWhy:
          args.implementationReport?.planAndWhy ||
          state.currentDebrief?.implementationReport?.planAndWhy ||
          "Chose the most direct, maintainable approach with high ROI and low complexity.",
        result:
          args.implementationReport?.result ||
          state.currentDebrief?.implementationReport?.result ||
          "Implementation complete and wired.",
        consequences:
          args.implementationReport?.consequences ||
          state.currentDebrief?.implementationReport?.consequences ||
          "Ready to use immediately with minimal maintenance overhead."
      },
      lessonsLearned: normalizedLessons,
      touchedFiles
    };

    const prevHistory = Array.isArray(state.history) ? state.history : [];
    savePersistedState(workspaceRoot, {
      activePersona,
      currentDebrief: newDebrief,
      history: [newDebrief, ...prevHistory].slice(0, 15),
      agentPublishedThisTurn: true
    });

    // Auto-persist any lessons marked confirmed: true directly into ZCode Memory
    for (const lesson of normalizedLessons) {
      if (lesson.confirmed) {
        confirmAndSaveLessonToZCodeMemory(workspaceRoot, lesson);
      }
    }

    const panelState = buildFullPanelState(workspaceRoot);
    return {
      content: [{ type: "text", text: formatDebriefMarkdown(panelState) }],
      structuredContent: panelState
    };
  }

  if (name === "vibe_debrief_set_persona") {
    const state = loadPersistedState(workspaceRoot);
    const activePersona = args.persona || state.activePersona || "vibe-mentor";
    const currentDebrief = state.currentDebrief
      ? {
          ...state.currentDebrief,
          persona: activePersona,
          responseType: args.responseType || state.currentDebrief.responseType
        }
      : undefined;

    savePersistedState(workspaceRoot, {
      activePersona,
      ...(currentDebrief ? { currentDebrief } : {})
    });

    const panelState = buildFullPanelState(workspaceRoot);
    return {
      content: [{ type: "text", text: `Updated Vibe Debrief persona to ${activePersona}.` }],
      structuredContent: panelState
    };
  }

  if (name === "vibe_debrief_confirm_lesson") {
    const record = confirmAndSaveLessonToZCodeMemory(workspaceRoot, args);
    const panelState = buildFullPanelState(workspaceRoot);
    return {
      content: [
        {
          type: "text",
          text: [
            `✅ Confirmed Lesson Learned and saved to ZCode Memory!`,
            `- **Title:** ${record.title}`,
            `- **Memory File:** \`${record.savedMemoryPath}\``,
            `- **Index Updated:** \`${record.memoryIndexPath}\``,
            `- **Summary:** ${record.summary}`,
            `- **Why:** ${record.why}`,
            `- **How to apply:** ${record.howToApply}`
          ].join("\n")
        }
      ],
      structuredContent: {
        ...panelState,
        lastSavedLesson: record
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
          name: "vibe-debrief",
          version: "0.1.0"
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
            title: "Vibe Debrief (Visual ELI5)",
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
      sendError(id, -32602, `Unknown resource URI: ${uri}`);
      return;
    }

    sendError(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    sendError(id, -32603, err instanceof Error ? err.message : String(err));
  }
});
