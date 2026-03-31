// ============================================
// LLM-as-Judge 평가 파이프라인
// 세션 트레이스 조회 → 대화 재구성 → 평가 → DB 저장
// ============================================

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import {
  JUDGE_SYSTEM_PROMPT,
  buildEvaluationUserPrompt,
  type EvaluationResult,
} from "./prompts";

const LOG_CTX = { domain: "agent", action: "evaluation" };
const EVALUATOR_MODEL = "gemini-3.1-pro-preview";

interface SessionForEval {
  id: string;
  student_id: string;
  total_steps: number;
  created_at: string;
  students: {
    name: string;
    grade: number | null;
    school_name: string | null;
    target_major: string | null;
    curriculum_revision: string | null;
  } | null;
}

interface StepTraceRow {
  step_index: number;
  step_type: string;
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_output: Record<string, unknown> | null;
  text_content: string | null;
  reasoning: string | null;
}

/**
 * 특정 날짜의 평가 대상 세션 조회.
 * 5스텝 이상 + 미평가 세션만 반환.
 */
export async function getSessionsForEvaluation(
  date: string,
  limit: number,
): Promise<SessionForEval[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  const startOfDay = `${date}T00:00:00+09:00`;
  const endOfDay = `${date}T23:59:59+09:00`;

  const { data } = await supabase
    .from("agent_sessions")
    .select(`
      id, student_id, total_steps, created_at,
      students!inner(name, grade, school_name, target_major, curriculum_revision)
    `)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .gte("total_steps", 5)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  // 이미 평가된 세션 제외
  const { data: evaluated } = await supabase
    .from("agent_evaluations")
    .select("session_id")
    .in("session_id", data.map((s) => s.id));

  const evaluatedIds = new Set((evaluated ?? []).map((e) => e.session_id));
  return (data as unknown as SessionForEval[]).filter((s) => !evaluatedIds.has(s.id));
}

/**
 * 세션 트레이스를 대화 형식으로 재구성
 */
async function reconstructConversation(sessionId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return "";

  const { data: traces } = await supabase
    .from("agent_step_traces")
    .select("step_index, step_type, tool_name, tool_input, tool_output, text_content, reasoning")
    .eq("session_id", sessionId)
    .order("step_index", { ascending: true });

  if (!traces || traces.length === 0) return "";

  const lines: string[] = [];
  for (const t of traces as StepTraceRow[]) {
    if (t.step_type === "think" && t.reasoning) {
      lines.push(`[내부 추론] ${t.reasoning}`);
    } else if (t.step_type === "tool-call" && t.tool_name) {
      const input = t.tool_input ? JSON.stringify(t.tool_input).slice(0, 500) : "";
      const output = t.tool_output ? JSON.stringify(t.tool_output).slice(0, 500) : "";
      lines.push(`[도구 호출: ${t.tool_name}] 입력: ${input}`);
      lines.push(`[도구 결과: ${t.tool_name}] 출력: ${output}`);
    } else if (t.step_type === "text" && t.text_content) {
      lines.push(`[AI 응답] ${t.text_content}`);
    }
  }

  return lines.join("\n\n");
}

/**
 * 단일 세션 평가 실행
 */
export async function evaluateSession(session: SessionForEval): Promise<EvaluationResult | null> {
  logActionDebug(LOG_CTX, `세션 평가 시작: ${session.id}`);

  const conversation = await reconstructConversation(session.id);
  if (!conversation || conversation.length < 100) {
    logActionDebug(LOG_CTX, `대화 내역 부족, 건너뜀: ${session.id}`);
    return null;
  }

  const student = session.students;
  const profileLines = [
    student?.name ? `이름: ${student.name}` : "이름: 미상",
    student?.grade ? `학년: ${student.grade}학년` : "학년: 미상",
    student?.school_name ? `학교: ${student.school_name}` : "",
    student?.target_major ? `희망전공: ${student.target_major}` : "",
    student?.curriculum_revision ? `교육과정: ${student.curriculum_revision}` : "",
  ].filter(Boolean).join("\n");

  const userPrompt = buildEvaluationUserPrompt(profileLines, conversation);

  try {
    const { text } = await geminiRateLimiter.execute(async () => {
      return generateText({
        model: google(EVALUATOR_MODEL),
        system: JUDGE_SYSTEM_PROMPT,
        prompt: userPrompt,
        maxTokens: 2048,
        temperature: 0.3,
      });
    });
    geminiQuotaTracker.recordRequest();

    // JSON 파싱 (```json ... ``` 블록 처리)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logActionError(LOG_CTX, `JSON 파싱 실패: ${session.id}`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as EvaluationResult;
    return parsed;
  } catch (error) {
    logActionError(LOG_CTX, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * 평가 결과 DB 저장
 */
export async function saveEvaluation(
  sessionId: string,
  result: EvaluationResult,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("agent_evaluations")
    .insert({
      session_id: sessionId,
      evaluator_model: EVALUATOR_MODEL,
      scores: result.scores,
      feedback: result.feedback,
      missed_points_detail: result.missedPointsDetail ?? [],
      expert_alternative: result.expertAlternative,
    });

  if (error) {
    logActionError(LOG_CTX, error.message);
    return false;
  }

  logActionDebug(LOG_CTX, `평가 저장 완료: ${sessionId}, overall=${result.scores.overall}`);

  // 자동 교정 피드백 루프: 낮은 점수 → agent_corrections 자동 저장
  if (result.scores.overall < 3.0 && result.missedPointsDetail?.length) {
    await autoCreateCorrection(sessionId, result).catch(() => {
      // fire-and-forget — 교정 저장 실패가 평가를 막지 않음
    });
  }

  return true;
}

/**
 * 평가 결과에서 교정 피드백을 자동 추출하여 agent_corrections에 저장.
 * overall < 3.0인 경우 missedPointsDetail을 교정 데이터로 변환.
 */
async function autoCreateCorrection(
  sessionId: string,
  result: EvaluationResult,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  // 세션의 tenant_id 조회
  const { data: session } = await supabase
    .from("agent_sessions")
    .select("tenant_id")
    .eq("id", sessionId)
    .single();

  if (!session?.tenant_id) return;

  const correctionText = result.missedPointsDetail.join("\n");
  const contextSummary = result.feedback?.slice(0, 500) ?? null;

  const { error } = await supabase.from("agent_corrections").insert({
    tenant_id: session.tenant_id,
    session_id: sessionId,
    message_index: 0,
    original_response: result.expertAlternative?.slice(0, 2000) ?? "",
    correction_text: correctionText.slice(0, 2000),
    correction_type: "strategic",
    context_summary: contextSummary,
    created_by: "00000000-0000-0000-0000-000000000000", // 자동 시스템
  });

  if (error) {
    logActionError(LOG_CTX, `자동 교정 저장 실패: ${error.message}`);
    return;
  }

  // 교정 임베딩도 즉시 생성 (fire-and-forget)
  try {
    const { embedPendingCorrections } = await import("../memory/embedding-service");
    await embedPendingCorrections(1);
    logActionDebug(LOG_CTX, `자동 교정 저장+임베딩 완료: ${sessionId}`);
  } catch {
    logActionDebug(LOG_CTX, `자동 교정 저장 완료 (임베딩 대기): ${sessionId}`);
  }
}
