import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  applySte100Polish,
  assessWorkflowComplexity,
  buildDefaultDiagram,
  buildDefaultVerificationData,
  buildExplainerScenesIfComplex,
  classifyFileRole,
  computeSte100Metrics,
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
      `You are the Vibe Debrief Explainer acting as persona "${persona.name}" (${persona.tagline}).`,
      "Apply 80% ASD-STE100 rules: short active sentences (<= 22 words), one topic per block, plain verbs, zero academic fluff.",
      "Classify the turn as 'bug' or 'implementation'.",
      "ALWAYS provide a `diagram` with real file/component names on nodes and numbered edges (stepNumber: 1..N).",
      "Provide `explainerScenes` ONLY if this is a COMPLEX multi-file or multi-layer workflow; otherwise return [].",
      "Return strict JSON with:",
      "{",
      '  "responseType": "bug" | "implementation",',
      '  "tldrHeadline": "1 short active sentence takeaway",',
      '  "realWorldAnalogy": "1-2 crisp sentences everyday visual analogy",',
      '  "diagram": { "diagramType": "sequence" | "flow-diff" | "subway-map" | "before-after" | "decision-tree", "title": "...", "nodes": [{ "id": "n1", "label": "...", "sublabel": "...", "role": "...", "file": "...", "risk": "low"|"medium"|"high", "status": "done"|"active"|"warning" }], "edges": [{ "from": "n1", "to": "n2", "stepNumber": 1, "label": "...", "risk": "low"|"medium"|"high" }] },',
      '  "bugReport": { "cause": "...", "plan": "...", "succeeded": "yes"|"partial"|"no", "successSummary": "...", "consequences": "..." },',
      '  "implementationReport": { "objective": "...", "planAndWhy": "...", "result": "...", "consequences": "..." },',
      '  "proofClaims": [{ "claim": "...", "evidence": "...", "status": "verified"|"inferred"|"unverified" }],',
      '  "uncertaintyAudit": [{ "area": "...", "reason": "Where this explanation or diagram is least certain", "riskLevel": "low"|"medium"|"high" }],',
      '  "verificationChecklist": [{ "id": "chk-1", "text": "Actionable human check", "source": "...", "risk": "low"|"medium"|"high", "checked": false }],',
      '  "explainerScenes": [{ "id": "scene-1", "durationSec": 7, "title": "...", "visualType": "highlight-start"|"pulse-flow"|"highlight-end"|"audit-warning", "highlightNodeIds": ["n1"], "callout": "...", "narration": "..." }],',
      '  "lessonsLearned": [{ "slug": "short-kebab-slug", "title": "1-line rule", "summary": "...", "why": "...", "howToApply": "...", "memoryType": "feedback"|"project" }]',
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
    const state = loadPersistedState(workspaceRoot);
    const persona = PERSONAS.find((p) => p.id === state.activePersona) || PERSONAS[0];
    const lightGemini = discoverLightweightGeminiModels()[0]?.id || "new-provider/gemini-3.8-flash";

    const additionalContext = [
      `[Vibe Debrief v0.4.0 (Karpathy Comprehension Panel) Active — Persona: ${persona.name} (${persona.badge}), STE-80: ${state.ste100Enabled !== false ? "ON" : "OFF"}]`,
      `Reading-Boundary Principle: Reason and code normally during tasks; apply comprehension formatting only when publishing to \`vibe_debrief_publish\`.`,
      `Cost-Aware Smart Action Rule: Preferred lightweight Gemini model for ELI5 smart actions is \`${lightGemini}\`. Never spend expensive flagship models (\`opus\` / \`sonnet\`) on simple Vibe Debrief refresh/summarization tasks when \`CreateSession\` can delegate them to \`${lightGemini}\`.`,
      `- After answering a bug/error or completing an implementation (or whenever asked to simplify / explain), call \`vibe_debrief_publish\` with:`,
      `  • **80% ASD-STE100 clarity**: short active sentences (<= 22 words), plain verbs, zero fluff.`,
      `  • **Always include \`diagram\`**: nodes using real file/component names + numbered edges (1..N).`,
      `  • **Bug (\`responseType: "bug"\`)** or **Implementation (\`responseType: "implementation"\`)** 4 cards + inline \`proofClaims\` (Card 3) + \`uncertaintyAudit\` & \`verificationChecklist\` (Card 4).`,
      `  • **\`explainerScenes\` ONLY for complex multi-file/multi-layer workflows** (omit for simple turns).`,
      `- Memory Rule: Whenever the user confirms a Lesson Learned (in chat or via the panel), persist it via \`vibe_debrief_confirm_lesson\`.`
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
        `Delegate the reading-boundary debrief pass to the lightweight Gemini model specified in the message (default: \`${lightGemini}\`) via a background \`CreateSession\` call (DO NOT call \`OpenSession\`):`,
        "1. If the current session is already running on a lightweight Gemini Flash/Argon model, call `vibe_debrief_publish` directly.",
        `2. Otherwise, load \`ListProjects\` and \`CreateSession\` via \`LocalToolSearch\` (\`select:ListProjects,CreateSession\`), call \`ListProjects\`, and call \`CreateSession({ project, model: "<chosen-gemini-model>", prompt })\` passing the last turn context (${String(state.lastUserPrompt || "").slice(0, 300)}) and instructing that lightweight Gemini session to call \`vibe_debrief_publish\` with 80% STE-100 clarity, an always-on \`diagram\`, \`proofClaims\`, \`uncertaintyAudit\`, \`verificationChecklist\`, and \`explainerScenes\` ONLY if the workflow is complex.`
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
    const steOn = state.ste100Enabled !== false;
    const polish = (txt) => (steOn ? applySte100Polish(txt) : String(txt || "").trim());

    if (state.agentPublishedThisTurn && state.currentDebrief) {
      savePersistedState(workspaceRoot, {
        lastAssistantMessage: assistantMsg,
        turnCount: nextTurnCount,
        agentPublishedThisTurn: false
      });
      process.stdout.write("{}\n");
      return;
    }

    const touchedRaw = state.recentTouchedFiles || [];
    const classifiedTouched = touchedRaw.map(classifyFileRole);

    const heuristic = synthesizeHeuristicDebrief({
      workspaceRoot,
      userPrompt: state.lastUserPrompt,
      assistantMessage: assistantMsg,
      touchedFiles: touchedRaw,
      lastCommandExitZero: state.lastCommandExitZero,
      persona: state.activePersona || "vibe-mentor",
      ste100Enabled: steOn
    });

    const aiSynth = await tryOptionalAiDebriefSynthesis(
      workspaceRoot,
      state.lastUserPrompt,
      assistantMsg,
      touchedRaw,
      state.activePersona || "vibe-mentor"
    );

    let finalDebrief = heuristic;
    if (aiSynth) {
      const mergedDraft = {
        ...heuristic,
        responseType: aiSynth.responseType === "bug" ? "bug" : aiSynth.responseType === "implementation" ? "implementation" : heuristic.responseType,
        tldrHeadline: polish(aiSynth.tldrHeadline || heuristic.tldrHeadline),
        realWorldAnalogy: polish(aiSynth.realWorldAnalogy || heuristic.realWorldAnalogy),
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
                title: polish(l.title || "Key Takeaway"),
                summary: polish(l.summary || l.title || ""),
                why: polish(l.why || "Saves debugging time across vibe-coded projects."),
                howToApply: polish(l.howToApply || "Apply in future turns."),
                memoryType: l.memoryType === "project" ? "project" : "feedback",
                confirmed: false
              }))
            : heuristic.lessonsLearned,
        touchedFiles: classifiedTouched
      };

      const diagram = buildDefaultDiagram(mergedDraft, aiSynth.diagram);
      const complexity = assessWorkflowComplexity({
        touchedFiles: classifiedTouched,
        diagram,
        assistantMessage: assistantMsg,
        userPrompt: state.lastUserPrompt
      });
      const verDefaults = buildDefaultVerificationData(mergedDraft, classifiedTouched, state.lastCommandExitZero);

      const proofClaims =
        Array.isArray(aiSynth.proofClaims) && aiSynth.proofClaims.length > 0
          ? aiSynth.proofClaims.slice(0, 3)
          : verDefaults.proofClaims;
      const uncertaintyAudit =
        Array.isArray(aiSynth.uncertaintyAudit) && aiSynth.uncertaintyAudit.length > 0
          ? aiSynth.uncertaintyAudit.slice(0, 3)
          : verDefaults.uncertaintyAudit;
      const verificationChecklist =
        Array.isArray(aiSynth.verificationChecklist) && aiSynth.verificationChecklist.length > 0
          ? aiSynth.verificationChecklist.slice(0, 4)
          : verDefaults.verificationChecklist;

      const explainerScenes =
        complexity.level === "complex"
          ? Array.isArray(aiSynth.explainerScenes) && aiSynth.explainerScenes.length > 0
            ? aiSynth.explainerScenes
            : buildExplainerScenesIfComplex({ ...mergedDraft, diagram, uncertaintyAudit }, complexity, false)
          : [];

      finalDebrief = {
        ...mergedDraft,
        diagram,
        complexity,
        proofClaims,
        uncertaintyAudit,
        verificationChecklist,
        explainerScenes
      };
      finalDebrief.ste100Metrics = computeSte100Metrics(finalDebrief);
    }

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
