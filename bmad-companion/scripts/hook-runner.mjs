import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { format } from "node:util";
import {
  CONVERSATION_LIMITS,
  buildSessionStartContext,
  buildTaskSessionLaunchInstructions,
  loadPersistedState,
  manageBmadTaskQueue,
  savePersistedState,
  scanBmadWorkspace
} from "./bmad-engine.mjs";

// --- Stdout isolation -------------------------------------------------------
// A hook speaks exactly one JSON line on stdout. emitHookFrame is the single
// write point and is guarded so no code path (handler, fallback, or error
// recovery) can produce a second line, and the console loggers are redirected
// to stderr so accidental library logging can never corrupt the frame.
let frameEmitted = false;
function emitHookFrame(frame) {
  if (frameEmitted) return;
  frameEmitted = true;
  process.stdout.write(JSON.stringify(frame || {}) + "\n");
}

for (const level of ["log", "info", "debug"]) {
  console[level] = (...args) => {
    process.stderr.write(format(...args) + "\n");
  };
}

// --- Shared hook vocabulary --------------------------------------------------
// C12: optional Stop-hook LLM synthesis is bounded by AbortSignal.timeout(4500)
// with silent fallback inside the <=4800ms Stop budget.
const AI_SYNTHESIS_TIMEOUT_MS = 4500;

// Queue-orchestrator prompts must never auto-start or auto-complete queue
// items (shared by the user-prompt and stop handlers).
const QUEUE_ORCHESTRATOR_PROMPT_RE = /Execute the active @bmad-companion Task Queue|bmad-task-queue\.dwf\.ts/i;

// Prompt-prefix match lengths differ per handler contract: auto-start (R20)
// compares 45 chars, auto-complete (R22) compares 40.
const AUTO_START_PROMPT_PREFIX_LEN = 45;
const AUTO_COMPLETE_PROMPT_PREFIX_LEN = 40;

// AD-18: bounded conversation snippet capture — whitespace-normalized and
// hard-capped at capture time (the gateway merge re-enforces the same caps).
function captureSnippet(text, maxChars) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, maxChars);
}

// `\b(?:ticket|story) <id>\b` reference matcher for a queue item's storyId.
function buildStoryRefRegex(storyId) {
  return new RegExp(`\\b(?:ticket|story)\\s+${String(storyId).replace(/\./g, "\\.")}\\b`, "i");
}

// Prompt-match predicate shared by the user-prompt auto-start scan and the
// stop auto-complete check: prefix-includes on the item prompt (or shaped
// effectivePrompt), or a ticket/story reference to the item's storyId,
// disambiguating Plan vs Build steps when both share a storyId.
const PROMPT_IS_PLAN_RE =
  /\bHalt after planning\.?|planning step only|^\s*\/bmad-build(?:-auto)?\s+"Plan(?::|\s+ticket|\s+story)/i;

function taskItemMatchesPrompt(item, promptText, prefixLen) {
  const promptIsPlan = PROMPT_IS_PLAN_RE.test(promptText);
  if (item.taskPhase === "plan" && !promptIsPlan) return false;
  if (item.taskPhase === "build" && promptIsPlan) return false;
  return Boolean(
    (item.prompt && promptText.includes(item.prompt.slice(0, prefixLen))) ||
      (item.effectivePrompt && promptText.includes(item.effectivePrompt.slice(0, prefixLen))) ||
      (item.storyId && buildStoryRefRegex(item.storyId).test(promptText))
  );
}

function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function tryOptionalAiTurnSynthesis(promptText, assistantText, scanOrFactory) {
  const apiKey = String(process.env.BMAD_COMPANION_OPENAI_KEY || process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey || (!promptText && !assistantText)) return null;
  try {
    const timeoutSignal = AbortSignal.timeout(AI_SYNTHESIS_TIMEOUT_MS);
    const scan = typeof scanOrFactory === "function" ? scanOrFactory() : scanOrFactory;
    const baseUrl = (process.env.BMAD_COMPANION_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.BMAD_COMPANION_MODEL || "gemini-2.5-flash";
    const sys = [
      "You are the BMAD-METHOD AI Companion for a software workspace.",
      "Given the latest user prompt, assistant response, available models, and BMAD workspace metrics, return strict JSON with:",
      '{ "headline": "1-sentence insight", "turnSummary": "1-2 sentence summary of what just happened", "focusSummary": "optional 1-2 plain everyday sentences on what was just done and what matters now", "recommendations": [ { "skill": "/bmad-ux", "fullCommand": "/bmad-ux \\"concrete contextual prompt for this project\\"", "title": "Short title", "rationale": "Why this next", "recommendedModel": "providerId/modelId", "modelReason": "Why this model fits best", "phase": "2-planning", "priority": "high" } ] }',
      "Every fullCommand MUST include both the /bmad-* skill and a specific double-quoted prompt tailored to the project.",
      "focusSummary MUST be plain human language: no /bmad-* commands, no phase codes, no tracker filenames, no BMAD jargon."
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
      signal: timeoutSignal
    });
    if (!res.ok) {
      try {
        await res.body?.cancel?.();
      } catch {}
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// --- Hook handlers ------------------------------------------------------------
// Every handler returns its stdout frame; none writes to stdout directly.

// SessionStart (R19): scan the workspace, stamp the session, and inject the
// smart-progress/provider/recommendation context (assembled by the engine).
function handleSessionStart({ workspaceRoot }) {
  const scan = scanBmadWorkspace(workspaceRoot);
  savePersistedState(workspaceRoot, {
    lastSessionStartAt: new Date().toISOString()
  });
  return { additionalContext: buildSessionStartContext(scan) };
}

// UserPromptSubmit (R20): store the prompt, reset touched files, capture the
// conversation's promptSnippet (AD-18), and auto start-task a matching queued task.
function handleUserPrompt({ payload, workspaceRoot, currentSessionId, captureSessionId }) {
  let promptText = payload.prompt || payload.user_prompt || "";
  if (!promptText && payload.transcript_path) {
    try {
      const lines = readFileSync(payload.transcript_path, "utf8").trim().split(/\r?\n/);
      const last = JSON.parse(lines[lines.length - 1] || "{}");
      promptText = last?.message?.content?.[0]?.text || "";
    } catch {}
  }
  const cleanPrompt = String(promptText || "").slice(0, 4000);
  const promptAt = new Date().toISOString();
  savePersistedState(workspaceRoot, {
    lastUserPrompt: cleanPrompt,
    lastUserPromptAt: promptAt,
    recentTouchedFiles: [],
    // AD-18: record this conversation's prompt snippet only when a sessionId
    // is known (env first, payload.session_id fallback) — no fallback entries.
    ...(captureSessionId
      ? {
          recentConversations: [
            {
              sessionId: captureSessionId,
              updatedAt: promptAt,
              promptSnippet: captureSnippet(cleanPrompt, CONVERSATION_LIMITS.promptSnippetChars)
            }
          ]
        }
      : {})
  });

  // If this prompt matches a queued task (and is not the queue orchestrator command itself), mark it active
  try {
    const state = loadPersistedState(workspaceRoot);
    const qItems = state.taskQueue?.items || [];
    if (qItems.length > 0 && !QUEUE_ORCHESTRATOR_PROMPT_RE.test(cleanPrompt)) {
      const matched = qItems.find(
        (it) =>
          it.status === "queued" &&
          taskItemMatchesPrompt(it, cleanPrompt, AUTO_START_PROMPT_PREFIX_LEN)
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

  return {};
}

// PostToolUse (R21): record up to 15 workspace-relative touched paths.
function handlePostTool({ payload, workspaceRoot }) {
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
  return {};
}

// Stop (R22): count the turn, store the assistant message, capture the
// conversation's outcomeSnippet/completedAt/touchedCount (AD-18), auto-complete
// a running single-session task (with queue handoff), and optionally run the
// bounded LLM turn synthesis.
async function handleStop({ payload, workspaceRoot, currentSessionId, captureSessionId }) {
  const state = loadPersistedState(workspaceRoot);
  let rawAssistantMsg = payload.last_assistant_message || payload.responseText || "";
  if (!rawAssistantMsg && payload.transcript_path) {
    try {
      const lines = readFileSync(payload.transcript_path, "utf8").trim().split(/\r?\n/);
      const last = JSON.parse(lines[lines.length - 1] || "{}");
      rawAssistantMsg = last?.message?.content?.[0]?.text || "";
    } catch {}
  }
  const assistantMsg = String(rawAssistantMsg || "").slice(0, 6000);
  const nextTurnCount = (state.turnCount || 0) + 1;
  const stopAt = new Date().toISOString();

  savePersistedState(workspaceRoot, {
    lastAssistantMessage: assistantMsg,
    lastTurnAnalyzedAt: stopAt,
    turnCount: nextTurnCount,
    // AD-18: stamp this conversation's outcome only when a sessionId is known.
    // An empty outcomeSnippet never blanks a previously recorded snippet
    // (field-preserving gateway merge).
    ...(captureSessionId
      ? {
          recentConversations: [
            {
              sessionId: captureSessionId,
              updatedAt: stopAt,
              completedAt: stopAt,
              outcomeSnippet: captureSnippet(assistantMsg, CONVERSATION_LIMITS.outcomeSnippetChars),
              touchedCount: (state.recentTouchedFiles || []).length
            }
          ]
        }
      : {})
  });

  // Auto-complete active queued task when a single-task session finishes,
  // then hand off to the next task so the queue continues automatically.
  let stopFrame = {};
  let completedScan = null;
  try {
    const q = state.taskQueue;
    const lastPrompt = String(state.lastUserPrompt || "");
    if (
      q &&
      Array.isArray(q.items) &&
      !QUEUE_ORCHESTRATOR_PROMPT_RE.test(lastPrompt)
    ) {
      const activeItem =
        (q.activeTaskId && q.items.find((it) => it.id === q.activeTaskId && it.status === "running")) ||
        (!q.activeTaskId && q.items.find((it) => it.status === "running")) ||
        null;
      const ownsTask =
        !activeItem?.sessionId ||
        !currentSessionId ||
        String(activeItem.sessionId) === currentSessionId;
      if (
        activeItem &&
        ownsTask &&
        taskItemMatchesPrompt(activeItem, lastPrompt, AUTO_COMPLETE_PROMPT_PREFIX_LEN)
      ) {
        const isPlanStep = activeItem.taskPhase === "plan";
        const completed = manageBmadTaskQueue(workspaceRoot, {
          action: "complete-task",
          taskId: activeItem.id,
          storyStatus: isPlanStep ? "in-progress" : "done",
          summary: assistantMsg ? assistantMsg.replace(/\s+/g, " ").slice(0, 140) : "Completed in session"
        });
        completedScan = completed?.scan || null;
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

  const aiSynth = await tryOptionalAiTurnSynthesis(
    state.lastUserPrompt,
    assistantMsg,
    () => completedScan || scanBmadWorkspace(workspaceRoot)
  );
  if (aiSynth && Array.isArray(aiSynth.recommendations) && aiSynth.recommendations.length > 0) {
    // AD-18: an optional plain-language focusSummary rides on the same override
    // with source "stop-synthesis"; the engine jargon-validates it at scan time.
    const synthFocus = typeof aiSynth.focusSummary === "string" ? aiSynth.focusSummary.trim() : "";
    savePersistedState(workspaceRoot, {
      agentAdvisorOverride: {
        headline: aiSynth.headline,
        turnSummary: aiSynth.turnSummary,
        recommendations: aiSynth.recommendations,
        ...(synthFocus
          ? {
              focusSummary: synthFocus,
              focusSummarySource: "stop-synthesis",
              ...(captureSessionId ? { focusSummarySessionId: captureSessionId } : {})
            }
          : {}),
        updatedAt: new Date().toISOString()
      }
    });
  }

  return stopFrame;
}

// Mode dispatch table (function declarations hoist above this map).
const HOOK_HANDLERS = {
  "session-start": handleSessionStart,
  "user-prompt": handleUserPrompt,
  "post-tool": handlePostTool,
  stop: handleStop
};

async function main() {
  const mode = process.argv[2] || "session-start";
  const payload = readStdinJson();
  const currentSessionId = String(
    process.env.CLAUDE_SESSION_ID || process.env.ZCODE_SESSION_ID || ""
  );
  // AD-18: conversation capture accepts payload.session_id as a fallback when
  // no env sessionId is present. Queue ownership checks keep using the
  // env-only currentSessionId so sibling-session semantics are unchanged.
  const captureSessionId = currentSessionId || String(payload.session_id || "");
  const workspaceRoot = resolve(
    payload.cwd ||
      process.env.ZCODE_PROJECT_DIR ||
      process.env.CLAUDE_PROJECT_DIR ||
      process.cwd()
  );

  // Unknown modes fall back to a no-op {} frame without state side effects.
  const handler = HOOK_HANDLERS[mode];
  const frame = handler ? await handler({ payload, workspaceRoot, currentSessionId, captureSessionId }) : {};
  emitHookFrame(frame);
}

main().catch(() => {
  emitHookFrame({});
});
