"use server";

// ============================================
// Phase 4b Sprint 4 (2026-04-19): tier_plan 수렴 LLM-judge 액션
//
// L4-D coherence-checker 패턴: Flash 1회 호출, temperature 0.1, maxTokens 1024.
// 호출 실패 시 호출부에서 non-fatal 처리 (skipped_judge_error 로 fallback).
// ============================================

import { zodSchema } from "ai";
import { generateObjectWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import {
  TIER_PLAN_JUDGE_SYSTEM_PROMPT,
  buildTierPlanJudgeUserPrompt,
  tierPlanJudgeResponseSchema,
  isConvergedVerdict,
  type TierPlanJudgeInput,
  type TierPlanJudgeResponse,
} from "../prompts/tierPlanConvergenceJudge";

export interface TierPlanJudgeSuccess {
  success: true;
  data: TierPlanJudgeResponse;
  /** verdict 에서 파생된 boolean — 호출부 편의용. */
  converged: boolean;
  modelName?: string;
  usage?: { inputTokens: number; outputTokens: number };
  elapsedMs: number;
}

export interface TierPlanJudgeFailure {
  success: false;
  error: string;
  elapsedMs: number;
}

/**
 * 두 tier_plan 의 컨설팅 가치 동등성을 LLM-judge 로 판정.
 *
 * 입력은 현 plan (A) + 제안 plan (B) + 학생 진로 컨텍스트.
 * 출력은 verdict 3-class + reasoning + deltaCategories.
 *
 * 실패(LLM 에러, 타임아웃) 시 success=false 반환. 호출부에서 telemetry 기록 후
 * non-fatal 처리하여 파이프라인 진행 유지 권장.
 */
export async function judgeTierPlanConvergence(
  input: TierPlanJudgeInput,
): Promise<TierPlanJudgeSuccess | TierPlanJudgeFailure> {
  const startMs = Date.now();
  const userPrompt = buildTierPlanJudgeUserPrompt(input);

  try {
    const result = await withRetry(
      () =>
        generateObjectWithRateLimit({
          system: TIER_PLAN_JUDGE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          schema: zodSchema(tierPlanJudgeResponseSchema),
          modelTier: "fast",
          temperature: 0.1,
          maxTokens: 1024,
          timeoutMs: 60_000,
        }),
      { label: "judgeTierPlanConvergence:fast" },
    );

    const data = result.object as TierPlanJudgeResponse;
    return {
      success: true,
      data,
      converged: isConvergedVerdict(data.verdict),
      ...(result.modelId ? { modelName: result.modelId } : {}),
      ...(result.usage ? { usage: result.usage } : {}),
      elapsedMs: Date.now() - startMs,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - startMs,
    };
  }
}
