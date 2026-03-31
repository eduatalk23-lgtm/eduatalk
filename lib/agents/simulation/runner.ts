// ============================================
// AI×AI 시뮬레이션 러너
// 시나리오 실행 → 에이전트 응답 → 평가 → 케이스/교정 저장
// ============================================

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { JUDGE_SYSTEM_PROMPT, CROSS_JUDGE_SYSTEM_PROMPT, buildEvaluationUserPrompt } from "../evaluation/prompts";
import type { EvaluationResult } from "../evaluation/prompts";
import type {
  SimulationScenario,
  SimulationResult,
  ClaudePromptItem,
  ClaudeResponseItem,
  CrossComparisonItem,
} from "./types";

const LOG_CTX = { domain: "agent", action: "simulation" };
const AGENT_MODEL = "gemini-2.5-flash";
const EVALUATOR_MODEL = "gemini-3.1-pro-preview";

// ── 교차 모드 모델명 (Gemini) ──
const CROSS_GEMINI_AGENT = "gemini-3.1-pro-preview";
const CROSS_GEMINI_EVALUATOR = "gemini-3.1-pro-preview";

/** 교차 평가 4항목 가중 평균 재계산 (tool_efficiency 제외) */
function recalcOverall(scores: Record<string, number>): number {
  const d = scores.diagnosis_accuracy ?? 0;
  const s = scores.strategy_realism ?? 0;
  const sc = scores.student_consideration ?? 0;
  const m = scores.missed_points ?? 0;
  return Math.round((d * 0.35 + s * 0.30 + sc * 0.25 + m * 0.10) * 10) / 10;
}

/**
 * 단일 시나리오 실행 (기존 single 모드).
 */
export async function runSimulationScenario(
  scenario: SimulationScenario,
  tenantId: string | null,
): Promise<SimulationResult> {
  const startTime = Date.now();
  const { studentProfile: sp, consultantQuestion } = scenario;

  logActionDebug(LOG_CTX, `시나리오 실행: ${scenario.id} (${scenario.category})`);

  // ── 1. 에이전트 응답 생성 ──
  const agentSystemPrompt = buildAgentPrompt(sp);
  let agentResponse: string;
  try {
    const result = await geminiRateLimiter.execute(async () => {
      return generateText({
        model: google(AGENT_MODEL),
        system: agentSystemPrompt,
        prompt: consultantQuestion,
        maxTokens: 4096,
        temperature: 0.3,
      });
    });
    geminiQuotaTracker.recordRequest();
    agentResponse = result.text;
  } catch (error) {
    return {
      scenarioId: scenario.id,
      agentResponse: "",
      toolCalls: [],
      thinkingSteps: [],
      evaluation: null,
      durationMs: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // ── 2. 평가자 AI 평가 ──
  let evaluation: EvaluationResult | null = null;
  try {
    const profileText = [
      `이름: ${sp.name}`,
      `학년: ${sp.grade}학년`,
      `학교: ${sp.schoolName} (${sp.schoolCategory})`,
      `희망전공: ${sp.targetMajor}`,
      `내신: ${sp.gpa}`,
      `강점: ${sp.strengths.join(", ")}`,
      `약점: ${sp.weaknesses.join(", ")}`,
      `상황: ${sp.context}`,
    ].join("\n");

    const transcript = `[컨설턴트 질문] ${consultantQuestion}\n\n[AI 응답] ${agentResponse}`;
    const evalPrompt = buildEvaluationUserPrompt(profileText, transcript);

    const evalResult = await geminiRateLimiter.execute(async () => {
      return generateText({
        model: google(EVALUATOR_MODEL),
        system: JUDGE_SYSTEM_PROMPT,
        prompt: evalPrompt,
        maxTokens: 2048,
        temperature: 0.3,
      });
    });
    geminiQuotaTracker.recordRequest();

    const jsonMatch = evalResult.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      evaluation = JSON.parse(jsonMatch[0]) as EvaluationResult;
    }
  } catch (error) {
    logActionError(LOG_CTX, error instanceof Error ? error : new Error(String(error)));
  }

  // ── 3. 결과 기반 지식 저장 ──
  if (evaluation && tenantId) {
    const overall = evaluation.scores?.overall ?? 0;

    if (overall >= 3.5) {
      await saveCaseFromSimulation(tenantId, sp, agentResponse, evaluation);
    }

    if (overall < 3.0 && evaluation.expertAlternative) {
      await saveCorrectionFromSimulation(tenantId, agentResponse, evaluation);
    }
  }

  return {
    scenarioId: scenario.id,
    agentResponse: agentResponse.slice(0, 2000),
    toolCalls: [],
    thinkingSteps: [],
    evaluation,
    durationMs: Date.now() - startTime,
    success: true,
  };
}

// ============================================
// 교차 시뮬레이션 Phase 1: Gemini 실행 + Claude 프롬프트 생성
// ============================================

/**
 * Phase 1 — Gemini로 상담 실행 + Claude에게 넘길 프롬프트 생성.
 *
 * 반환값:
 * - geminiResults: Gemini 에이전트의 응답 + Gemini 평가자의 평가 (Claude 응답용)
 * - claudePrompts: Claude Code에게 전달할 프롬프트 목록
 */
export async function runCrossPhaseGemini(
  scenarios: SimulationScenario[],
  delayMs: number,
  onProgress?: (i: number, total: number, scenarioId: string, result: SimulationResult) => void,
): Promise<{
  geminiResults: SimulationResult[];
  claudePrompts: ClaudePromptItem[];
}> {
  const geminiResults: SimulationResult[] = [];
  const claudePrompts: ClaudePromptItem[] = [];

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const { studentProfile: sp, consultantQuestion } = scenario;
    const startTime = Date.now();

    // 1. Gemini가 상담 응답 생성
    let geminiResponse = "";
    let success = true;
    let error: string | undefined;

    try {
      const result = await geminiRateLimiter.execute(async () =>
        generateText({
          model: google(CROSS_GEMINI_AGENT),
          system: buildAgentPrompt(sp),
          prompt: consultantQuestion,
          maxTokens: 4096,
          temperature: 0.3,
        }),
      );
      geminiQuotaTracker.recordRequest();
      geminiResponse = result.text;
    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : String(e);
    }

    const simResult: SimulationResult = {
      scenarioId: scenario.id,
      agentResponse: geminiResponse.slice(0, 2000),
      toolCalls: [],
      thinkingSteps: [],
      evaluation: null, // Claude가 평가할 예정
      durationMs: Date.now() - startTime,
      success,
      error,
    };
    geminiResults.push(simResult);

    // 2. Claude용 프롬프트 구성
    if (success) {
      const profileText = [
        `이름: ${sp.name}`, `학년: ${sp.grade}학년`,
        `학교: ${sp.schoolName} (${sp.schoolCategory})`,
        `희망전공: ${sp.targetMajor}`, `내신: ${sp.gpa}`,
        `강점: ${sp.strengths.join(", ")}`, `약점: ${sp.weaknesses.join(", ")}`,
        `상황: ${sp.context}`,
      ].join("\n");

      const transcript = `[컨설턴트 질문] ${consultantQuestion}\n\n[AI 응답] ${geminiResponse}`;
      const evalUserPrompt = buildEvaluationUserPrompt(profileText, transcript);

      claudePrompts.push({
        scenarioId: scenario.id,
        category: scenario.category,
        agentPrompt: {
          system: buildAgentPrompt(sp),
          user: consultantQuestion,
        },
        evaluatorPrompt: {
          system: CROSS_JUDGE_SYSTEM_PROMPT,
          user: evalUserPrompt,
        },
        geminiAgentResponse: geminiResponse.slice(0, 2000),
      });
    }

    onProgress?.(i, scenarios.length, scenario.id, simResult);

    if (i < scenarios.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { geminiResults, claudePrompts };
}

// ============================================
// 교차 시뮬레이션 Phase 3: Gemini가 Claude 응답 평가 + 비교
// ============================================

/**
 * Phase 3 — Claude 응답을 Gemini가 평가하고 최종 비교표 생성.
 */
export async function runCrossPhaseCompare(
  scenarios: SimulationScenario[],
  geminiResults: SimulationResult[],
  claudeResponses: ClaudeResponseItem[],
  delayMs: number,
  onProgress?: (i: number, total: number, scenarioId: string) => void,
): Promise<CrossComparisonItem[]> {
  const comparisons: CrossComparisonItem[] = [];

  for (let i = 0; i < claudeResponses.length; i++) {
    const cr = claudeResponses[i];
    const scenario = scenarios.find((s) => s.id === cr.scenarioId);
    const geminiResult = geminiResults.find((r) => r.scenarioId === cr.scenarioId);
    if (!scenario || !geminiResult) continue;

    const { studentProfile: sp, consultantQuestion } = scenario;

    // Gemini가 Claude 응답 평가
    let geminiEvalOfClaude: EvaluationResult | null = null;
    try {
      const profileText = [
        `이름: ${sp.name}`, `학년: ${sp.grade}학년`,
        `학교: ${sp.schoolName} (${sp.schoolCategory})`,
        `희망전공: ${sp.targetMajor}`, `내신: ${sp.gpa}`,
        `강점: ${sp.strengths.join(", ")}`, `약점: ${sp.weaknesses.join(", ")}`,
        `상황: ${sp.context}`,
      ].join("\n");

      const transcript = `[컨설턴트 질문] ${consultantQuestion}\n\n[AI 응답] ${cr.agentResponse}`;
      const evalPrompt = buildEvaluationUserPrompt(profileText, transcript);

      const evalResult = await geminiRateLimiter.execute(async () =>
        generateText({
          model: google(CROSS_GEMINI_EVALUATOR),
          system: CROSS_JUDGE_SYSTEM_PROMPT,
          prompt: evalPrompt,
          maxTokens: 2048,
          temperature: 0.3,
        }),
      );
      geminiQuotaTracker.recordRequest();

      const jsonMatch = evalResult.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        geminiEvalOfClaude = JSON.parse(jsonMatch[0]) as EvaluationResult;
      }
    } catch (error) {
      logActionError(LOG_CTX, error instanceof Error ? error : new Error(String(error)));
    }

    // 4항목 가중 평균으로 재계산 (tool_efficiency 제외)
    const geminiScore = cr.evaluation?.scores
      ? recalcOverall(cr.evaluation.scores)
      : 0; // Claude가 Gemini를 평가
    const claudeScore = geminiEvalOfClaude?.scores
      ? recalcOverall(geminiEvalOfClaude.scores)
      : 0; // Gemini가 Claude를 평가
    const delta = geminiScore - claudeScore;

    comparisons.push({
      scenarioId: cr.scenarioId,
      category: scenario.category,
      gemini: {
        agentResponse: geminiResult.agentResponse,
        evaluatedBy: "claude",
        score: geminiScore,
      },
      claude: {
        agentResponse: cr.agentResponse,
        evaluatedBy: "gemini",
        score: claudeScore,
      },
      scoreDelta: delta,
      winner: delta > 0.2 ? "gemini" : delta < -0.2 ? "claude" : "tie",
    });

    onProgress?.(i, claudeResponses.length, cr.scenarioId);

    if (i < claudeResponses.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return comparisons;
}

// ============================================
// 공용 유틸
// ============================================

export function buildAgentPrompt(sp: SimulationScenario["studentProfile"]): string {
  return `당신은 대입 컨설팅 AI 어시스턴트입니다. 컨설턴트가 학생의 생기부를 분석하고 전략을 수립하는 것을 도와줍니다.

## 현재 학생 정보
- 이름: ${sp.name}
- 학년: ${sp.grade}학년
- 학교: ${sp.schoolName} (${sp.schoolCategory === "general" ? "일반고" : sp.schoolCategory === "autonomous_private" ? "자사고" : sp.schoolCategory === "science" ? "과학고" : sp.schoolCategory === "foreign_lang" ? "외고" : "국제고"})
- 희망전공: ${sp.targetMajor}
- 교육과정: ${sp.curriculumRevision}
- 내신: ${sp.gpa}
- 강점: ${sp.strengths.join(", ")}
- 약점: ${sp.weaknesses.join(", ")}
- 상황: ${sp.context}

## 규칙
1. 한국어로 응답
2. 구체적 근거 기반 분석
3. 학생의 학년, 학교유형, 성적대를 반영한 맞춤 전략
4. 현실적이고 실행 가능한 조언`;
}

// ============================================
// 결과 저장
// ============================================

async function saveCaseFromSimulation(
  tenantId: string,
  sp: SimulationScenario["studentProfile"],
  agentResponse: string,
  evaluation: EvaluationResult,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/consulting_cases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        student_grade: sp.grade,
        school_category: sp.schoolCategory,
        target_major: sp.targetMajor,
        curriculum_revision: sp.curriculumRevision,
        diagnosis_summary: agentResponse.slice(0, 2000),
        strategy_summary: evaluation.feedback ?? "",
        key_insights: evaluation.missedPointsDetail?.length
          ? [`평가 점수: ${evaluation.scores.overall}`, ...evaluation.missedPointsDetail.slice(0, 3)]
          : [`평가 점수: ${evaluation.scores.overall}`],
      }),
    });
    logActionDebug(LOG_CTX, "시뮬레이션 케이스 저장 완료");
  } catch (e) {
    logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
  }
}

async function saveCorrectionFromSimulation(
  tenantId: string,
  agentResponse: string,
  evaluation: EvaluationResult,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const { data: session } = await supabase
    .from("agent_sessions")
    .insert({
      tenant_id: tenantId,
      user_id: "00000000-0000-0000-0000-000000000000",
      student_id: null as unknown as string,
      model_id: "simulation",
      total_steps: 0,
      duration_ms: 0,
      stop_reason: "simulation",
    })
    .select("id")
    .single();

  if (!session) return;

  try {
    await supabase.from("agent_corrections").insert({
      tenant_id: tenantId,
      session_id: session.id,
      message_index: 0,
      original_response: agentResponse.slice(0, 2000),
      correction_text: evaluation.expertAlternative?.slice(0, 2000) ?? "",
      correction_type: "strategic",
      context_summary: evaluation.feedback?.slice(0, 500) ?? null,
      created_by: "00000000-0000-0000-0000-000000000000",
    });
    logActionDebug(LOG_CTX, "시뮬레이션 교정 저장 완료");
  } catch (e) {
    logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
  }
}

// ============================================
// 교차 시뮬레이션 우수 응답 DB 저장
// ============================================

/**
 * 교차 비교 결과에서 양쪽 모두 3.5점 이상인 응답을 consulting_cases에 저장.
 * 단일 모델 편향 없이 다양한 학습 데이터를 확보하는 것이 목적.
 */
export async function saveCrossBestCases(
  comparisons: CrossComparisonItem[],
  scenarios: SimulationScenario[],
  tenantId: string,
): Promise<{ saved: number; skipped: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { saved: 0, skipped: comparisons.length };

  const THRESHOLD = 3.5;
  let saved = 0;
  let skipped = 0;

  for (const c of comparisons) {
    const scenario = scenarios.find((s) => s.id === c.scenarioId);
    if (!scenario) { skipped++; continue; }
    const sp = scenario.studentProfile;

    const candidates: Array<{ model: string; response: string; score: number }> = [];

    if (c.gemini.score >= THRESHOLD) {
      candidates.push({ model: "gemini-3.1-pro", response: c.gemini.agentResponse, score: c.gemini.score });
    }
    if (c.claude.score >= THRESHOLD) {
      candidates.push({ model: "claude-code", response: c.claude.agentResponse, score: c.claude.score });
    }

    if (candidates.length === 0) { skipped++; continue; }

    for (const cand of candidates) {
      try {
        await fetch(`${url}/rest/v1/consulting_cases`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            student_grade: sp.grade,
            school_category: sp.schoolCategory,
            target_major: sp.targetMajor,
            curriculum_revision: sp.curriculumRevision,
            diagnosis_summary: cand.response.slice(0, 2000),
            strategy_summary: `[교차시뮬레이션] ${cand.model} 응답 (교차 평가 ${cand.score.toFixed(1)}점)`,
            key_insights: [
              `모델: ${cand.model}`,
              `교차 평가 점수: ${cand.score.toFixed(1)} / 5.0`,
              `시나리오: ${c.scenarioId} (${c.category})`,
            ],
          }),
        });
        saved++;
      } catch (e) {
        logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
        skipped++;
      }
    }
  }

  logActionDebug(LOG_CTX, `교차 시뮬레이션 우수 케이스 저장: ${saved}건 저장, ${skipped}건 건너뜀`);
  return { saved, skipped };
}
