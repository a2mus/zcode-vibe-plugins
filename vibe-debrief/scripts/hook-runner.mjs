import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  classifyFileRole,
  discoverLightweightGeminiModels,
  loadPersistedState,
  PERSONAS,
  savePersistedState,
  synthesizeHeuristicDebrief
} from "./debrief-engine.mjs";

function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function tryOptionalAiDebriefSynthesis(workspaceRoot, promptText, assistantText, touchedFiles, personaId) {
  const apiKey = process.env.VIBE_DEBRIEF_OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || (!promptText && !assistantText)) return null;
  try {
    const baseUrl = (process.env.VIBE_DEBRIEF_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.VIBE_DEBRIEF_MODEL || "gemini-2.5-flash";
    const persona = PERSONAS.find((p) => p.id === personaId) || PERSONAS[0];

    const sys = [
      `You are the Vibe Debrief Visual ELI5 Explainer acting as persona "${persona.name}" (${persona.tagline}).`,
      "Your user is a visual learner and beginner/vibe-coding developer working on multiple projects who does not want dense technical jargon without real ROI or perspective.",
      "Classify the turn as either 'bug' (shared bug or error message) or 'implementation' (feature, change, setup, refactor).",
      "Return strict JSON with:",
      "{",
      '  "responseType": "bug" | "implementation",',
      '  "tldrHeadline": "1-sentence crystal-clear takeaway",',
      '  "realWorldAnalogy": "A vivid, everyday visual analogy explaining what just happened",',
      '  "bugReport": { "cause": "Plain-English root cause", "plan": "What was the plan to fix it", "succeeded": "yes" | "partial" | "no", "successSummary": "Did it succeed and how we know", "consequences": "Consequences / side-effects of this fix" },',
      '  "implementationReport": { "objective": "Purpose or objective of the implementation", "planAndWhy": "What was the plan/suggested resolution and WHY this way", "result": "Result of the implementation", "consequences": "Consequences and impact of this implementation" },',
      '  "lessonsLearned": [ { "slug": "short-kebab-slug", "title": "1-line lesson rule", "summary": "Plain explanation of the lesson", "why": "Why this matters across vibe-coded projects", "howToApply": "How to apply this next time", "memoryType": "feedback" | "project" } ]',
      "}"
    ].join("\n");

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
          {
            role: "user",
            content: JSON.stringify({
              persona: persona.id,
              touchedFiles,
              userPrompt: String(promptText || "").slice(0, 1500),
              assistantResponse: String(assistantText || "").slice(0, 3000)
            })
          }
        ],
        temperature: 0.25
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
    const state = loadPersistedState(workspaceRoot);
    const persona = PERSONAS.find((p) => p.id === state.activePersona) || PERSONAS[0];
    const lightGemini = discoverLightweightGeminiModels()[0]?.id || "new-provider/gemini-3.8-flash";

    const additionalContext = [
      `[Vibe Debrief (Visual ELI5 Panel) Active — Persona: ${persona.name} (${persona.badge})]`,
      `Mission: Simplify responses for a visual learner & multi-project vibe-coder who wants clear perspective and ROI without walls of complex jargon.`,
      `Cost-Aware Smart Action Rule: Preferred lightweight Gemini model for ELI5 smart actions is \`${lightGemini}\`. Never spend expensive flagship models (\`opus\` / \`sonnet\`) on simple Vibe Debrief refresh/summarization tasks when \`CreateSession\` can delegate them to \`${lightGemini}\`.`,
      `- After answering a bug/error or completing an implementation (or whenever asked to simplify / explain), call \`vibe_debrief_publish\` (or \`vibe_debrief_open\`) to update the right-side Vibe Debrief panel:`,
      `  1. If the turn is about a **Shared Bug or Error Message** (\`responseType: "bug"\`): clearly state (a) What was the cause, (b) What was your plan to fix it, (c) Whether you succeeded, (d) What are the consequences of this fix, and (e) Lessons learned.`,
      `  2. If the turn is an **Implementation** (\`responseType: "implementation"\`): clearly state (a) Purpose / objective of the implementation, (b) Plan or suggested resolution and WHY, (c) Result of the implementation, and (d) Consequences & lessons learned (if any).`,
      `- Memory Rule: Whenever the user confirms a Lesson Learned (either in chat or via the panel's 'Confirm & Save to ZCode Memory' button), persist it to ZCode Memory via \`vibe_debrief_confirm_lesson\` (which writes the memory file and updates \`MEMORY.md\`).`
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
      recentTouchedFiles: [],
      lastCommandExitZero: null,
      agentPublishedThisTurn: false
    });

    if (String(promptText || "").includes("[Vibe Debrief — Deep Refresh]")) {
      const state = loadPersistedState(workspaceRoot);
      const lightGemini = discoverLightweightGeminiModels()[0]?.id || "new-provider/gemini-3.8-flash";
      const additionalContext = [
        "MANDATORY COST-AWARE ACTION FOR [Vibe Debrief — Deep Refresh]:",
        "The user clicked 'AI Explain' in the right-side Vibe Debrief panel.",
        `To avoid spending an expensive model on a simple ELI5 simplification task, delegate the debrief generation to the lightweight Gemini model specified in the message (default: \`${lightGemini}\`) via a background \`CreateSession\` call (DO NOT call \`OpenSession\`, so it does not steal focus from this session):`,
        "1. If the current session is already running on a lightweight Gemini Flash/Argon model, call `vibe_debrief_publish` directly.",
        `2. Otherwise, load \`ListProjects\` and \`CreateSession\` via \`LocalToolSearch\` (\`select:ListProjects,CreateSession\`), call \`ListProjects\`, and call \`CreateSession({ project, model: "<chosen-gemini-model>", prompt })\` passing the last turn context (${String(state.lastUserPrompt || "").slice(0, 300)}) and instructing that lightweight Gemini session to call \`vibe_debrief_publish\` (via \`LocalToolSearch\`) with the simplified ELI5 breakdown.`
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
    let lastCommandExitZero = state.lastCommandExitZero;
    if (payload?.tool_name === "Bash" || payload?.toolName === "Bash") {
      const out = JSON.stringify(payload?.tool_response || payload?.toolResponse || "");
      if (/error|failed|exception/i.test(out) && !/0 error/i.test(out)) {
        lastCommandExitZero = false;
      } else {
        lastCommandExitZero = true;
      }
    }
    savePersistedState(workspaceRoot, {
      recentTouchedFiles: [...touched].slice(-15),
      lastCommandExitZero
    });
    process.stdout.write("{}\n");
    return;
  }

  if (mode === "stop") {
    const state = loadPersistedState(workspaceRoot);
    const assistantMsg = String(payload.last_assistant_message || payload.responseText || "").slice(0, 8000);
    const nextTurnCount = (state.turnCount || 0) + 1;

    // If the agent already explicitly published a rich debrief during this turn, keep it!
    if (state.agentPublishedThisTurn && state.currentDebrief) {
      savePersistedState(workspaceRoot, {
        lastAssistantMessage: assistantMsg,
        turnCount: nextTurnCount,
        agentPublishedThisTurn: false
      });
      process.stdout.write("{}\n");
      return;
    }

    const heuristic = synthesizeHeuristicDebrief({
      workspaceRoot,
      userPrompt: state.lastUserPrompt,
      assistantMessage: assistantMsg,
      touchedFiles: state.recentTouchedFiles || [],
      lastCommandExitZero: state.lastCommandExitZero,
      persona: state.activePersona || "vibe-mentor"
    });

    const aiSynth = await tryOptionalAiDebriefSynthesis(
      workspaceRoot,
      state.lastUserPrompt,
      assistantMsg,
      state.recentTouchedFiles || [],
      state.activePersona || "vibe-mentor"
    );

    const finalDebrief = aiSynth
      ? {
          ...heuristic,
          responseType: aiSynth.responseType === "bug" ? "bug" : aiSynth.responseType === "implementation" ? "implementation" : heuristic.responseType,
          tldrHeadline: aiSynth.tldrHeadline || heuristic.tldrHeadline,
          realWorldAnalogy: aiSynth.realWorldAnalogy || heuristic.realWorldAnalogy,
          bugReport: {
            ...heuristic.bugReport,
            ...(aiSynth.bugReport || {})
          },
          implementationReport: {
            ...heuristic.implementationReport,
            ...(aiSynth.implementationReport || {})
          },
          lessonsLearned:
            Array.isArray(aiSynth.lessonsLearned) && aiSynth.lessonsLearned.length > 0
              ? aiSynth.lessonsLearned.map((l, idx) => ({
                  id: `lesson-${Date.now()}-${idx}`,
                  slug: l.slug || `lesson-${idx + 1}`,
                  title: l.title || "Key Takeaway",
                  summary: l.summary || l.title || "",
                  why: l.why || "Saves debugging time across vibe-coded projects.",
                  howToApply: l.howToApply || "Apply in future turns.",
                  memoryType: l.memoryType === "project" ? "project" : "feedback",
                  confirmed: false
                }))
              : heuristic.lessonsLearned,
          touchedFiles: (state.recentTouchedFiles || []).map(classifyFileRole)
        }
      : heuristic;

    const prevHistory = Array.isArray(state.history) ? state.history : [];
    savePersistedState(workspaceRoot, {
      lastAssistantMessage: assistantMsg,
      turnCount: nextTurnCount,
      currentDebrief: finalDebrief,
      history: [finalDebrief, ...prevHistory.filter((h) => h.id !== finalDebrief.id)].slice(0, 15)
    });

    process.stdout.write("{}\n");
    return;
  }

  process.stdout.write("{}\n");
}

main();
