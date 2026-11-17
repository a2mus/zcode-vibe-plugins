import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySte100Polish,
  assessWorkflowComplexity,
  buildDefaultDiagram,
  buildDefaultVerificationData,
  buildExplainerScenesForDebrief,
  buildExplainerScenesIfComplex,
  buildFullPanelState,
  classifyFileRole,
  computeSte100Metrics,
  confirmAndSaveLessonToZCodeMemory,
  loadPersistedState,
  PERSONAS,
  savePersistedState,
  saveStandaloneHtmlArtifact
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
  const metrics = d.ste100Metrics || {};
  const complexity = d.complexity || { level: "simple" };

  const lines = [
    `# Vibe Debrief (${isBug ? "🐛 Bug / Error Fix" : "🚀 Implementation"}) — ${personaObj.badge}`,
    ``,
    `> **TL;DR:** ${d.tldrHeadline || "Visual summary ready."}`,
    `> **💡 Picture It Like This:** ${d.realWorldAnalogy || ""}`,
    `> **📖 Clarity:** \`${metrics.grade || "STE-80"} (${metrics.score || 85}%)\` · ~${metrics.estimatedReadSeconds || 30}s read · **Complexity:** \`${complexity.level}\``,
    ``
  ];

  const diagram = d.diagram;
  if (diagram && Array.isArray(diagram.nodes) && diagram.nodes.length > 0) {
    lines.push(`## 🗺️ Diagram: ${diagram.title || "Flow"} (${diagram.diagramType || "architecture"})`);
    const nodeMap = new Map(diagram.nodes.map((n) => [n.id, n]));
    if (Array.isArray(diagram.edges) && diagram.edges.length > 0) {
      for (const e of diagram.edges) {
        const fromLabel = nodeMap.get(e.from)?.label || e.from;
        const toLabel = nodeMap.get(e.to)?.label || e.to;
        lines.push(`${e.stepNumber}. **${fromLabel}** → **${toLabel}** *(${e.label || "flows to"})*`);
      }
    } else {
      lines.push(diagram.nodes.map((n) => `**${n.label}**`).join(" → "));
    }
    lines.push(``);
  }

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
      `**Status:** \`${(b.succeeded || "yes").toUpperCase()}\` — ${b.successSummary || "N/A"}`
    );
  } else {
    const imp = d.implementationReport || {};
    lines.push(
      `## 1. 🎯 Objective & Why It Matters`,
      `${imp.objective || "N/A"}`,
      ``,
      `## 2. 🧭 Plan & Why This Way`,
      `${imp.planAndWhy || "N/A"}`,
      ``,
      `## 3. 🏆 Result`,
      `${imp.result || "N/A"}`
    );
  }

  if (Array.isArray(d.proofClaims) && d.proofClaims.length > 0) {
    lines.push(``, `**Proof & Claims:**`);
    for (const p of d.proofClaims) {
      lines.push(`- ${p.status === "verified" ? "✅" : p.status === "unverified" ? "❌" : "ℹ️"} ${p.claim} *(${p.evidence})*`);
    }
  }
  lines.push(``);

  const consequencesText = isBug ? d.bugReport?.consequences : d.implementationReport?.consequences;
  lines.push(`## 4. 🌊 Consequences & What to Double-Check`, `${consequencesText || "N/A"}`);

  if (Array.isArray(d.uncertaintyAudit) && d.uncertaintyAudit.length > 0) {
    lines.push(``, `**⚠️ Least Certain / Watch Out:**`);
    for (const u of d.uncertaintyAudit) {
      lines.push(`- \`${String(u.riskLevel || "medium").toUpperCase()}\` **${u.area}:** ${u.reason}`);
    }
  }

  if (Array.isArray(d.verificationChecklist) && d.verificationChecklist.length > 0) {
    lines.push(``, `**☑️ Quick Verify Checklist:**`);
    for (const c of d.verificationChecklist) {
      lines.push(`- [${c.checked ? "x" : " "}] ${c.text} *(${c.source})*`);
    }
  }
  lines.push(``);

  const lessons = Array.isArray(d.lessonsLearned) ? d.lessonsLearned : [];
  if (lessons.length > 0) {
    lines.push(`## 5. 🧠 Lessons Learned (Confirm → ZCode Memory)`);
    for (const l of lessons) {
      lines.push(
        `- **${l.title}** ${l.confirmed ? "✅ *(Saved to ZCode Memory)*" : "⏳ *(Click Confirm in Panel to Save)*"}\n  - ${l.summary}\n  - **Why:** ${l.why}\n  - **How to apply:** ${l.howToApply}`
      );
    }
  }

  return lines.join("\n");
}

const TOOLS = [
  {
    name: "vibe_debrief_open",
    description:
      "Open the Vibe Debrief (Visual ELI5) right-side panel to simplify the last AI response using STE-80 clarity, an always-on interactive SVG diagram, proof & uncertainty checks, and ZCode Memory saving.",
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
      "Get the current Vibe Debrief right-side panel state, including the latest STE-80 breakdown, SVG diagram, proof & uncertainty audit, verification checklist, complex explainer scenes, turn history, and ZCode Memory lessons.",
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
      "Publish a simplified, visual debrief of the last AI response into the right-side Vibe Debrief panel using 80% ASD-STE100 clarity (short active sentences, plain verbs, zero fluff), an always-on node-and-arrow diagram, ground-truth proof & uncertainty audit, and animated explainer scenes for complex workflows only.",
    inputSchema: {
      type: "object",
      properties: {
        responseType: {
          type: "string",
          enum: ["bug", "implementation"],
          description: "Choose 'bug' for shared bugs/errors, or 'implementation' for features/changes/refactors."
        },
        persona: {
          type: "string",
          enum: ["vibe-mentor", "visual-mapper", "indie-founder", "eli5-storyteller"],
          description: "Persona tone for the explanation (default: vibe-mentor)."
        },
        ste100Mode: {
          type: "boolean",
          description: "Apply 80% ASD-STE100 clarity tightening (default: true)."
        },
        tldrHeadline: {
          type: "string",
          description: "1 short active sentence (<= 22 words) summarizing the takeaway in plain language."
        },
        realWorldAnalogy: {
          type: "string",
          description: "1–2 crisp sentences offering a concrete everyday analogy."
        },
        diagram: {
          type: "object",
          description: "Required on every response: structured node-and-arrow diagram using real component/file names and numbered edges.",
          properties: {
            diagramType: { type: "string", enum: ["architecture", "sequence", "state-flow", "cause-effect"] },
            title: { type: "string" },
            nodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  sublabel: { type: "string" },
                  role: { type: "string" },
                  file: { type: "string" },
                  risk: { type: "string", enum: ["low", "medium", "high"] },
                  status: { type: "string", enum: ["done", "active", "pending", "warning"] }
                },
                required: ["id", "label"]
              }
            },
            edges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string" },
                  to: { type: "string" },
                  stepNumber: { type: "number" },
                  label: { type: "string" },
                  risk: { type: "string", enum: ["low", "medium", "high"] }
                },
                required: ["from", "to"]
              }
            }
          }
        },
        visualFlow: {
          type: "array",
          description: "Optional fallback 3–4 step sequence if diagram is omitted.",
          items: {
            type: "object",
            properties: {
              step: { type: "string" },
              icon: { type: "string" },
              title: { type: "string" },
              subtitle: { type: "string" },
              status: { type: "string", enum: ["done", "active", "pending", "warning"] }
            },
            required: ["title", "subtitle"]
          }
        },
        bugReport: {
          type: "object",
          description: "Required when responseType='bug'. Write in concise STE-80 active voice.",
          properties: {
            cause: { type: "string" },
            plan: { type: "string" },
            succeeded: { type: "string", enum: ["yes", "partial", "no"] },
            successSummary: { type: "string" },
            consequences: { type: "string" }
          }
        },
        implementationReport: {
          type: "object",
          description: "Required when responseType='implementation'. Write in concise STE-80 active voice.",
          properties: {
            objective: { type: "string" },
            planAndWhy: { type: "string" },
            result: { type: "string" },
            consequences: { type: "string" }
          }
        },
        proofClaims: {
          type: "array",
          description: "Top 1–3 concrete claims paired with evidence (merged into Card 3).",
          items: {
            type: "object",
            properties: {
              claim: { type: "string" },
              evidence: { type: "string" },
              status: { type: "string", enum: ["verified", "inferred", "unverified"] }
            },
            required: ["claim", "evidence"]
          }
        },
        uncertaintyAudit: {
          type: "array",
          description: "1–3 areas where this diagram or explanation is least certain (merged into Card 4).",
          items: {
            type: "object",
            properties: {
              area: { type: "string" },
              reason: { type: "string" },
              riskLevel: { type: "string", enum: ["low", "medium", "high"] }
            },
            required: ["area", "reason"]
          }
        },
        verificationChecklist: {
          type: "array",
          description: "1–3 human verification checks for the user (merged into Card 4).",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              source: { type: "string" },
              risk: { type: "string", enum: ["low", "medium", "high"] },
              checked: { type: "boolean" }
            },
            required: ["text"]
          }
        },
        complexityOverride: {
          type: "string",
          enum: ["simple", "complex"],
          description: "Optional complexity override. Animation scenes are only kept for complex workflows."
        },
        explainerScenes: {
          type: "array",
          description: "Only provide for COMPLEX workflows (multi-file, multi-layer, or branching). 4–6 timed animated walkthrough scenes.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              durationSec: { type: "number" },
              title: { type: "string" },
              visualType: { type: "string", enum: ["highlight-start", "pulse-flow", "highlight-end", "audit-warning"] },
              highlightNodeIds: { type: "array", items: { type: "string" } },
              callout: { type: "string" },
              narration: { type: "string" }
            },
            required: ["title", "narration"]
          }
        },
        lessonsLearned: {
          type: "array",
          description: "Lessons learned from this turn. Confirmed lessons save to ZCode Memory.",
          items: {
            type: "object",
            properties: {
              slug: { type: "string" },
              title: { type: "string" },
              summary: { type: "string" },
              why: { type: "string" },
              howToApply: { type: "string" },
              memoryType: { type: "string", enum: ["feedback", "project"] },
              confirmed: { type: "boolean" }
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
      "Switch the active persona, view mode (bug vs implementation), or STE-80 clarity toggle in the Vibe Debrief panel.",
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
        },
        ste100Enabled: {
          type: "boolean"
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
    name: "vibe_debrief_toggle_check",
    description:
      "Toggle a verification checklist item in Card 4 (or update STE-80 clarity setting) and persist to workspace state.",
    inputSchema: {
      type: "object",
      properties: {
        checkId: {
          type: "string",
          description: "The verificationChecklist item ID to toggle."
        },
        checked: {
          type: "boolean",
          description: "Explicit checked state; toggles current value if omitted."
        }
      },
      required: ["checkId"],
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
  },
  {
    name: "vibe_debrief_export_html",
    description:
      "Generate and save a standalone, zero-dependency discardable HTML explainer artifact for the current debrief (includes STE-80 summary, interactive SVG diagram, checklist, and complex explainer player if applicable).",
    inputSchema: {
      type: "object",
      properties: {},
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
  },
  {
    name: "vibe_debrief_generate_explainer",
    description:
      "On-demand trigger to synthesize animated 3b1b-style explainer scenes and plain-text narration script for the active debrief.",
    inputSchema: {
      type: "object",
      properties: {},
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
  },
  {
    name: "vibe_debrief_confirm_lesson",
    description:
      "Confirm a Lesson Learned and save it permanently to ZCode's project memory directory (<slug>.md + MEMORY.md index).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        slug: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        why: { type: "string" },
        howToApply: { type: "string" },
        memoryType: { type: "string", enum: ["feedback", "project"] }
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
    const ste100Enabled = args.ste100Mode !== undefined ? Boolean(args.ste100Mode) : state.ste100Enabled !== false;
    const polish = (txt) => (ste100Enabled ? applySte100Polish(txt) : String(txt || "").trim());
    const touchedFiles = (state.recentTouchedFiles || []).map(classifyFileRole);

    const defaultFlow =
      responseType === "bug"
        ? [
            { step: "1", icon: "🔴", title: "Root Cause", subtitle: "Pinpointed trigger", status: "done" },
            { step: "2", icon: "🛠️", title: "Fix Plan", subtitle: "Targeted fix", status: "done" },
            {
              step: "3",
              icon: args.bugReport?.succeeded === "no" ? "❌" : args.bugReport?.succeeded === "partial" ? "⚠️" : "✅",
              title: args.bugReport?.succeeded === "no" ? "Not Fixed Yet" : args.bugReport?.succeeded === "partial" ? "Partial Fix" : "Fix Succeeded",
              subtitle: "Outcome checked",
              status: args.bugReport?.succeeded === "no" ? "warning" : "done"
            },
            { step: "4", icon: "🧠", title: "Verify & Save", subtitle: "Audit + Memory", status: "active" }
          ]
        : [
            { step: "1", icon: "🎯", title: "Objective", subtitle: "Clear purpose", status: "done" },
            { step: "2", icon: "🧭", title: "Plan & Why", subtitle: "Pragmatic path", status: "done" },
            { step: "3", icon: "🏆", title: "Result", subtitle: "Working delivery", status: "done" },
            { step: "4", icon: "🌊", title: "Verify & Save", subtitle: "Audit + Memory", status: "active" }
          ];

    const normalizedLessons = (Array.isArray(args.lessonsLearned) ? args.lessonsLearned : []).map((l, idx) => ({
      id: `lesson-${Date.now()}-${idx}`,
      slug: l.slug || `vibe-lesson-${idx + 1}`,
      title: polish(l.title || "Key Takeaway"),
      summary: polish(l.summary || l.title || ""),
      why: polish(l.why || "Prevents repeat issues and keeps multi-project vibe coding fast."),
      howToApply: polish(l.howToApply || "Apply this rule when working on similar code."),
      memoryType: l.memoryType === "project" ? "project" : "feedback",
      confirmed: Boolean(l.confirmed)
    }));

    const draftDebrief = {
      id: `debrief-${Date.now()}`,
      createdAt: new Date().toISOString(),
      responseType,
      persona: activePersona,
      tldrHeadline: polish(args.tldrHeadline || "Visual summary of the last response."),
      realWorldAnalogy: polish(
        args.realWorldAnalogy ||
          "Think of this change like upgrading a key connector on your workbench — cleaner flow and fewer moving parts."
      ),
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
        cause: polish(args.bugReport?.cause || state.currentDebrief?.bugReport?.cause || "See implementation view or run on a bug turn."),
        plan: polish(args.bugReport?.plan || state.currentDebrief?.bugReport?.plan || "Targeted fix plan."),
        succeeded: args.bugReport?.succeeded || "yes",
        successSummary: polish(
          args.bugReport?.successSummary ||
            (args.bugReport?.succeeded === "no"
              ? "Fix did not succeed yet — check blocker details."
              : args.bugReport?.succeeded === "partial"
              ? "Partially fixed — needs verification."
              : "Yes — Fix applied and verified.")
        ),
        consequences: polish(
          args.bugReport?.consequences ||
            state.currentDebrief?.bugReport?.consequences ||
            "Fixes the error cleanly without breaking neighboring features."
        )
      },
      implementationReport: {
        objective: polish(
          args.implementationReport?.objective ||
            state.currentDebrief?.implementationReport?.objective ||
            args.tldrHeadline
        ),
        planAndWhy: polish(
          args.implementationReport?.planAndWhy ||
            state.currentDebrief?.implementationReport?.planAndWhy ||
            "Chose the most direct approach with high ROI and low complexity."
        ),
        result: polish(
          args.implementationReport?.result ||
            state.currentDebrief?.implementationReport?.result ||
            "Implementation complete and wired."
        ),
        consequences: polish(
          args.implementationReport?.consequences ||
            state.currentDebrief?.implementationReport?.consequences ||
            "Ready to use immediately with minimal maintenance overhead."
        )
      },
      lessonsLearned: normalizedLessons,
      touchedFiles
    };

    // Always build a real node-and-arrow diagram for EVERY response
    const diagram = buildDefaultDiagram(draftDebrief, args.diagram);
    const hasExplicitScenes = Array.isArray(args.explainerScenes) && args.explainerScenes.length > 0;
    const complexity = assessWorkflowComplexity({
      touchedFiles,
      diagram,
      assistantMessage: state.lastAssistantMessage || "",
      userPrompt: state.lastUserPrompt || "",
      complexityOverride: args.complexityOverride || (hasExplicitScenes ? "complex" : null)
    });

    const defaults = buildDefaultVerificationData(draftDebrief, touchedFiles, state.lastCommandExitZero ?? null);
    const proofClaims =
      Array.isArray(args.proofClaims) && args.proofClaims.length > 0
        ? args.proofClaims.slice(0, 3).map((p) => ({
            claim: polish(p.claim),
            evidence: String(p.evidence || "Verified"),
            status: ["verified", "inferred", "unverified"].includes(p.status) ? p.status : "verified"
          }))
        : defaults.proofClaims;

    const uncertaintyAudit =
      Array.isArray(args.uncertaintyAudit) && args.uncertaintyAudit.length > 0
        ? args.uncertaintyAudit.slice(0, 3).map((u) => ({
            area: String(u.area || "Assumption"),
            reason: polish(u.reason || ""),
            riskLevel: ["low", "medium", "high"].includes(u.riskLevel) ? u.riskLevel : "medium"
          }))
        : defaults.uncertaintyAudit;

    const verificationChecklist =
      Array.isArray(args.verificationChecklist) && args.verificationChecklist.length > 0
        ? args.verificationChecklist.slice(0, 4).map((c, idx) => ({
            id: c.id || `chk-${Date.now()}-${idx}`,
            text: polish(c.text),
            source: String(c.source || "Manual check"),
            risk: ["low", "medium", "high"].includes(c.risk) ? c.risk : "low",
            checked: Boolean(c.checked)
          }))
        : defaults.verificationChecklist;

    // Gate animated explainer scenes strictly to complex workflows
    let explainerScenes = [];
    if (complexity.level === "complex") {
      explainerScenes = hasExplicitScenes
        ? args.explainerScenes.map((s, idx) => ({
            id: s.id || `scene-${idx + 1}`,
            durationSec: Number(s.durationSec || 7),
            title: String(s.title || `Scene ${idx + 1}`),
            visualType: s.visualType || "pulse-flow",
            highlightNodeIds: Array.isArray(s.highlightNodeIds) ? s.highlightNodeIds : [],
            callout: polish(s.callout || ""),
            narration: polish(s.narration || "")
          }))
        : buildExplainerScenesIfComplex({ ...draftDebrief, diagram, uncertaintyAudit }, complexity, false);
    }

    const newDebrief = {
      ...draftDebrief,
      diagram,
      complexity,
      proofClaims,
      uncertaintyAudit,
      verificationChecklist,
      explainerScenes
    };
    newDebrief.ste100Metrics = computeSte100Metrics(newDebrief);

    const prevHistory = Array.isArray(state.history) ? state.history : [];
    savePersistedState(workspaceRoot, {
      activePersona,
      ste100Enabled,
      currentDebrief: newDebrief,
      history: [newDebrief, ...prevHistory].slice(0, 15),
      agentPublishedThisTurn: true
    });

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
    const ste100Enabled = args.ste100Enabled !== undefined ? Boolean(args.ste100Enabled) : state.ste100Enabled !== false;
    const currentDebrief = state.currentDebrief
      ? {
          ...state.currentDebrief,
          persona: activePersona,
          responseType: args.responseType || state.currentDebrief.responseType
        }
      : undefined;

    savePersistedState(workspaceRoot, {
      activePersona,
      ste100Enabled,
      ...(currentDebrief ? { currentDebrief } : {})
    });

    const panelState = buildFullPanelState(workspaceRoot);
    return {
      content: [{ type: "text", text: `Updated Vibe Debrief settings (persona: ${activePersona}, STE-80: ${ste100Enabled ? "on" : "off"}).` }],
      structuredContent: panelState
    };
  }

  if (name === "vibe_debrief_toggle_check") {
    const state = loadPersistedState(workspaceRoot);
    const cur = state.currentDebrief;
    if (cur && Array.isArray(cur.verificationChecklist)) {
      const updatedChecklist = cur.verificationChecklist.map((c) =>
        c.id === args.checkId ? { ...c, checked: args.checked !== undefined ? Boolean(args.checked) : !c.checked } : c
      );
      savePersistedState(workspaceRoot, {
        currentDebrief: { ...cur, verificationChecklist: updatedChecklist }
      });
    }
    const panelState = buildFullPanelState(workspaceRoot);
    return {
      content: [{ type: "text", text: `Updated verification check (${args.checkId}).` }],
      structuredContent: panelState
    };
  }

  if (name === "vibe_debrief_export_html") {
    const panelState = buildFullPanelState(workspaceRoot);
    const artifact = saveStandaloneHtmlArtifact(workspaceRoot, panelState);
    return {
      content: [
        {
          type: "text",
          text: `🌐 Exported standalone interactive HTML explainer:\n- [${artifact.fileName}](${artifact.filePath}) (${Math.round(artifact.bytes / 1024)} KB)`
        }
      ],
      structuredContent: {
        ...panelState,
        exportedArtifact: artifact
      }
    };
  }

  if (name === "vibe_debrief_generate_explainer") {
    const state = loadPersistedState(workspaceRoot);
    const cur = state.currentDebrief;
    if (cur) {
      const scenes = buildExplainerScenesForDebrief(cur);
      savePersistedState(workspaceRoot, {
        currentDebrief: {
          ...cur,
          complexity: { ...(cur.complexity || {}), level: "complex", reason: cur.complexity?.reason || "Generated on demand" },
          explainerScenes: scenes
        }
      });
    }
    const panelState = buildFullPanelState(workspaceRoot);
    return {
      content: [{ type: "text", text: `🎬 Generated ${panelState.currentDebrief?.explainerScenes?.length || 0} animated explainer scenes.` }],
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
          version: "0.2.0"
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
