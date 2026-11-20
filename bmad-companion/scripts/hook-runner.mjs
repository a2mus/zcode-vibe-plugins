import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  buildTaskSessionLaunchInstructions,
  loadPersistedState,
  manageBmadTaskQueue,
  savePersistedState,
  scanBmadWorkspace
} from "./bmad-engine.mjs";

function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function tryOptionalAiTurnSynthesis(workspaceRoot, promptText, assistantText, scan) {
  const apiKey = process.env.BMAD_COMPANION_OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || (!promptText && !assistantText)) return null;
  try {
    const baseUrl = (process.env.BMAD_COMPANION_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.BMAD_COMPANION_MODEL || "gemini-2.5-flash";
    const sys = [
      "You are the BMAD-METHOD AI Companion for a software workspace.",
      "Given the latest user prompt, assistant response, available models, and BMAD workspace metrics, return strict JSON with:",
      '{ "headline": "1-sentence insight", "turnSummary": "1-2 sentence summary of what just happened", "recommendations": [ { "skill": "/bmad-ux", "fullCommand": "/bmad-ux \\"concrete contextual prompt for this project\\"", "title": "Short title", "rationale": "Why this next", "recommendedModel": "providerId/modelId", "modelReason": "Why this model fits best", "phase": "2-planning", "priority": "high" } ] }',
      "Every fullCommand MUST include both the /bmad-* skill and a specific double-quoted prompt tailored to the project."
    ].join("\n");

    const userMsg = JSON.stringify({
      project: scan.projectName,
      metrics: scan.metrics,
      availableModels: (scan.availableModels || []).map((m) => m.id),
      lastUserPrompt: String(promptText || "").slice(0, 1200),
      lastAssistantMessage: String(assistantText || "").slice(0, 2000)
    });

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg }
        ],
        temperature: 0.2
      }),
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main() {
  const mode = process.argv[2] || "session-start";
  const payload = readStdinJson();
  const currentSessionId = String(
    process.env.CLAUDE_SESSION_ID || process.env.ZCODE_SESSION_ID || ""
  );
  const workspaceRoot = resolve(
    payload.cwd ||
      process.env.ZCODE_PROJECT_DIR ||
      process.env.CLAUDE_PROJECT_DIR ||
      process.cwd()
  );

  if (mode === "session-start") {
    const scan = scanBmadWorkspace(workspaceRoot);
    savePersistedState(workspaceRoot, {
      lastSessionStartAt: new Date().toISOString()
    });
    const topRecs = scan.recommendations
      .slice(0, 3)
      .map((r) => `- \`${r.fullCommand}\` [Recommended Model: \`${r.recommendedModel?.modelId}\` — ${r.recommendedModel?.tier}] (${r.title})`)
      .join("\n");

    const additionalContext = [
      `[BMAD Companion Active for ${scan.projectName} (${scan.techStack})]`,
      `Smart Progress: ${scan.metrics.smartDoneStories}/${scan.metrics.totalStories} stories complete (${scan.metrics.smartOverallPct}% smart vs ${scan.metrics.declaredOverallPct}% static tracker; ${scan.metrics.reconciledStoriesCount} stories AI-reconciled across ${scan.metrics.totalEpics} epics).`,
      `Active Providers & Models: ${scan.availableModels.length} enabled models across ${(scan.providerState?.activeProviders || []).map((p) => `${p.providerName} (${p.modelCount})`).join(", ") || "host defaults"}.`,
      `Recommended Next BMAD Prompts & Models:\n${topRecs}`,
      `Companion Guidance:`,
      `1. Whenever advising the user on BMAD-METHOD or after completing a meaningful task, always provide concrete contextual prompts (e.g., \`/bmad-ux "Enhance the UI/UX of ..."\`, never a bare \`/bmad-ux\`) along with a dynamically chosen model from \`ListModels\` (respecting active provider state & subscription), and call \`bmad_update_advisor\` (passing \`hostModels\` when \`ListModels\` is inspected) or \`bmad_open_companion\` when updating the right-side BMAD Companion panel.`
    ].join("\n");

    process.stdout.write(JSON.stringify({ additionalContext }) + "\n");
    return;
  }

  if (mode === "user-prompt") {
    let promptText = payload.prompt || payload.user_prompt || "";
    if (!promptText && payload.transcript_path) {
      try {
        const lines = readFileSync(payload.transcript_path, "utf8").trim().split(/\r?\n/);
        const last = JSON.parse(lines[lines.length - 1] || "{}");
        promptText = last?.message?.content?.[0]?.text || "";
      } catch {}
    }
    const cleanPrompt = String(promptText || "").slice(0, 4000);
    savePersistedState(workspaceRoot, {
      lastUserPrompt: cleanPrompt,
      lastUserPromptAt: new Date().toISOString(),
      recentTouchedFiles: []
    });

    // If this prompt matches a queued task (and is not the queue orchestrator command itself), mark it active
    try {
      const state = loadPersistedState(workspaceRoot);
      const qItems = state.taskQueue?.items || [];
      if (qItems.length > 0 && !/Execute the active @bmad-companion Task Queue|bmad-task-queue\.dwf\.ts/i.test(cleanPrompt)) {
        const matched = qItems.find(
          (it) =>
            it.status === "queued" &&
            ((it.prompt && cleanPrompt.includes(it.prompt.slice(0, 45))) ||
              (it.storyId && new RegExp(`\\b(?:ticket|story)\\s+${String(it.storyId).replace(".", "\\.")}\\b`, "i").test(cleanPrompt)))
        );
        if (matched) {
          manageBmadTaskQueue(workspaceRoot, {
            action: "start-task",
            taskId: matched.id,
            ...(currentSessionId ? { sessionId: currentSessionId } : {})
          });
        }
      }
    } catch {}

    process.stdout.write("{}\n");
    return;
  }

  if (mode === "post-tool") {
    const state = loadPersistedState(workspaceRoot);
    const touched = new Set(state.recentTouchedFiles || []);
    const fileCandidate =
      payload?.tool_input?.file_path ||
      payload?.tool_input?.path ||
      payload?.toolInput?.file_path ||
      "";
    if (fileCandidate) {
      try {
        const rel = relative(workspaceRoot, resolve(workspaceRoot, fileCandidate)).replace(/\\/g, "/");
        if (!rel.startsWith("..")) touched.add(rel);
      } catch {}
    }
    savePersistedState(workspaceRoot, {
      recentTouchedFiles: [...touched].slice(-15)
    });
    process.stdout.write("{}\n");
    return;
  }

  if (mode === "stop") {
    const state = loadPersistedState(workspaceRoot);
    const assistantMsg = String(payload.last_assistant_message || payload.responseText || "").slice(0, 6000);
    const nextTurnCount = (state.turnCount || 0) + 1;

    savePersistedState(workspaceRoot, {
      lastAssistantMessage: assistantMsg,
      lastTurnAnalyzedAt: new Date().toISOString(),
      turnCount: nextTurnCount
    });

    // Auto-complete active queued task when a single-task session finishes,
    // then hand off to the next task so the queue continues automatically.
    let stopFrame = {};
    try {
      const q = state.taskQueue;
      const lastPrompt = String(state.lastUserPrompt || "");
      if (
        q &&
        q.activeTaskId &&
        Array.isArray(q.items) &&
        !/Execute the active @bmad-companion Task Queue|bmad-task-queue\.dwf\.ts/i.test(lastPrompt)
      ) {
        const activeItem = q.items.find((it) => it.id === q.activeTaskId && it.status === "running");
        const ownsTask =
          !activeItem?.sessionId ||
          !currentSessionId ||
          String(activeItem.sessionId) === currentSessionId;
        if (
          activeItem &&
          ownsTask &&
          ((activeItem.prompt && lastPrompt.includes(activeItem.prompt.slice(0, 40))) ||
            (activeItem.storyId &&
              new RegExp(`\\b(?:ticket|story)\\s+${String(activeItem.storyId).replace(".", "\\.")}\\b`, "i").test(lastPrompt)))
        ) {
          const completed = manageBmadTaskQueue(workspaceRoot, {
            action: "complete-task",
            taskId: activeItem.id,
            storyStatus: "done",
            summary: assistantMsg ? assistantMsg.replace(/\s+/g, " ").slice(0, 140) : "Completed in session"
          });
          const updatedQueue = completed?.taskQueue;
          if (
            updatedQueue &&
            updatedQueue.executionMode === "separate-sessions" &&
            updatedQueue.status === "running" &&
            updatedQueue.nextQueuedTask
          ) {
            stopFrame = {
              decision: "block",
              reason: [
                `BMAD Companion queue continuation: "${activeItem.title}" is complete. ${updatedQueue.counts.queued} task(s) remain queued.`,
                "Start the next task now; the bmad-companion Stop hook continues the chain after every finished task.",
                buildTaskSessionLaunchInstructions(updatedQueue.nextQueuedTask)
              ].join("\n")
            };
          }
        }
      }
    } catch {}

    const scan = scanBmadWorkspace(workspaceRoot);
    const aiSynth = await tryOptionalAiTurnSynthesis(
      workspaceRoot,
      state.lastUserPrompt,
      assistantMsg,
      scan
    );
    if (aiSynth && Array.isArray(aiSynth.recommendations) && aiSynth.recommendations.length > 0) {
      savePersistedState(workspaceRoot, {
        agentAdvisorOverride: {
          headline: aiSynth.headline,
          turnSummary: aiSynth.turnSummary,
          recommendations: aiSynth.recommendations,
          updatedAt: new Date().toISOString()
        }
      });
    }

    process.stdout.write(JSON.stringify(stopFrame) + "\n");
    return;
  }

  process.stdout.write("{}\n");
}

main().catch(() => {
  process.stdout.write("{}\n");
});
