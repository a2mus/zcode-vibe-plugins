import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  loadPersistedState,
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
      `1. Whenever advising the user on BMAD-METHOD or after completing a meaningful task, always provide concrete contextual prompts (e.g., \`/bmad-ux "Enhance the UI/UX of ..."\`, never a bare \`/bmad-ux\`) along with a dynamically chosen model from \`ListModels\` (respecting active provider state & subscription), and call \`bmad_update_advisor\` (passing \`hostModels\` when \`ListModels\` is inspected) or \`bmad_open_companion\` when updating the right-side BMAD Companion panel.`,
      `2. When you receive a \`[BMAD Companion — Auto-Launch New Session]\` request from the right-side panel, immediately load \`ListProjects\`, \`CreateSession\`, and \`OpenSession\` via \`LocalToolSearch\` (\`select:ListProjects,CreateSession,OpenSession\`), call \`ListProjects\`, call \`CreateSession({ project, model, prompt })\` (omitting \`model\` if host-default), and then call \`OpenSession({ sessionId })\` so ZCode automatically opens the new session running that prompt on the recommended model.`
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
    savePersistedState(workspaceRoot, {
      lastUserPrompt: String(promptText || "").slice(0, 4000),
      lastUserPromptAt: new Date().toISOString(),
      recentTouchedFiles: []
    });
    if (String(promptText || "").includes("[BMAD Companion — Auto-Launch New Session]")) {
      const additionalContext = [
        "MANDATORY ACTION FOR [BMAD Companion — Auto-Launch New Session]:",
        "The user clicked 'Launch in New Task' in the right-side BMAD Companion panel.",
        "Do NOT run the /bmad-* skill inside this current task.",
        "Instead, immediately execute these tool calls in order:",
        "1. Call LocalToolSearch({ query: \"select:ListProjects,CreateSession,OpenSession\", max_results: 5 }) if those tools are not loaded yet.",
        "2. Call ListProjects({}) to get the current workspace's project object.",
        "3. Call CreateSession({ project, model, prompt }) passing the exact Recommended Model ID and Initial Prompt from the message.",
        "4. Call OpenSession({ sessionId }) with the returned session.sessionId so ZCode immediately opens and focuses the new task in the same workspace."
      ].join("\n");
      process.stdout.write(JSON.stringify({ additionalContext }) + "\n");
      return;
    }
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

    process.stdout.write("{}\n");
    return;
  }

  process.stdout.write("{}\n");
}

main().catch(() => {
  process.stdout.write("{}\n");
});
