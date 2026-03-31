// ============================================
// 에이전트 세션 로거 — fire-and-forget
// agent_sessions + agent_step_traces 일괄 INSERT
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "session-log" };
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

/** tool_input/tool_output 최대 크기 (4KB) */
const MAX_JSON_SIZE = 4096;
/** text_content/reasoning 최대 크기 (8KB) */
const MAX_TEXT_SIZE = 8192;

export interface StepTrace {
  stepIndex: number;
  stepType: "tool-call" | "text" | "think";
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  textContent?: string;
  reasoning?: string;
  durationMs?: number;
}

export interface AgentSessionParams {
  sessionId: string;
  tenantId: string;
  userId: string;
  studentId: string;
  modelId: string;
  systemPromptHash?: string;
  totalSteps: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  stopReason?: string;
  error?: string;
  stepTraces: StepTrace[];
}

function truncateJson(value: unknown, maxSize: number): unknown {
  if (value === undefined || value === null) return null;
  const str = JSON.stringify(value);
  if (str.length <= maxSize) return value;
  return { _truncated: true, _originalSize: str.length };
}

function truncateText(text: string | undefined, maxSize: number): string | null {
  if (!text) return null;
  if (text.length <= maxSize) return text;
  return text.slice(0, maxSize - 30) + `\n[... ${text.length - maxSize + 30}자 생략]`;
}

/**
 * 세션 + 스텝 트레이스 일괄 저장 (fire-and-forget).
 * Supabase REST API 직접 호출 — 타입 생성 불필요.
 */
export async function logAgentSession(params: AgentSessionParams): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    logActionDebug(LOG_CTX, "Supabase 환경변수 미설정, 세션 로그 건너뜀");
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: "return=minimal",
  };

  // 1. agent_sessions INSERT
  const sessionPayload = JSON.stringify({
    id: params.sessionId,
    tenant_id: params.tenantId,
    user_id: params.userId,
    student_id: params.studentId,
    model_id: params.modelId,
    system_prompt_hash: params.systemPromptHash ?? null,
    total_steps: params.totalSteps,
    total_input_tokens: params.totalInputTokens,
    total_output_tokens: params.totalOutputTokens,
    duration_ms: params.durationMs,
    stop_reason: params.stopReason ?? null,
    error: params.error ?? null,
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${url}/rest/v1/agent_sessions`, {
        method: "POST",
        headers,
        body: sessionPayload,
      });
      if (res.ok) break;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * (attempt + 1)));
        continue;
      }
      logActionDebug(LOG_CTX, `세션 저장 실패 (${attempt + 1}회): ${res.status}`);
      return; // 세션 저장 실패 시 traces도 건너뜀
    } catch (e) {
      if (attempt >= MAX_RETRIES) {
        logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
        return;
      }
    }
  }

  // 2. agent_step_traces 일괄 INSERT (세션 저장 성공 후)
  if (params.stepTraces.length === 0) return;

  const traceRows = params.stepTraces.map((t) => ({
    session_id: params.sessionId,
    step_index: t.stepIndex,
    step_type: t.stepType,
    tool_name: t.toolName ?? null,
    tool_input: truncateJson(t.toolInput, MAX_JSON_SIZE),
    tool_output: truncateJson(t.toolOutput, MAX_JSON_SIZE),
    text_content: truncateText(t.textContent, MAX_TEXT_SIZE),
    reasoning: truncateText(t.reasoning, MAX_TEXT_SIZE),
    duration_ms: t.durationMs ?? null,
  }));

  try {
    const res = await fetch(`${url}/rest/v1/agent_step_traces`, {
      method: "POST",
      headers,
      body: JSON.stringify(traceRows),
    });
    if (!res.ok) {
      logActionDebug(LOG_CTX, `트레이스 저장 실패: ${res.status}`);
    }
  } catch (e) {
    logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * 시스템 프롬프트 해시 생성 (SHA-256).
 * 프롬프트 버전 추적용 — 동일 프롬프트면 동일 해시.
 */
export async function hashSystemPrompt(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
