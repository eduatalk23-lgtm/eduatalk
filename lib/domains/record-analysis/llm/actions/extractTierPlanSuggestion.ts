"use server";

// ============================================
// Phase 4b: tier_plan refinement LLM 액션
//
// Synthesis 완료 직후 호출. 현 main_exploration.tier_plan + Synthesis 결과를
// 입력으로 받아 개정된 tier_plan 을 LLM 으로 제안.
// 1차: Flash → 실패 시 2차: Pro fallback (generateMainExplorationSeed 와 동일 패턴).
//
// 호출자가 결과를 jaccard 비교 → 임계치 미만이면 신규 main_exploration row 생성.
// ============================================

import { generateTextWithRateLimit, type ModelTier } from "../ai-client";
import { withRetry } from "../retry";
import {
  TIER_PLAN_REFINEMENT_SYSTEM_PROMPT,
  buildTierPlanRefinementUserPrompt,
  parseTierPlanRefinementResponse,
  type TierPlanRefinementInput,
} from "../prompts/tierPlanRefinement";
import type { MainExplorationSeedResult } from "../prompts/mainExplorationSeed";

export interface TierPlanSuggestionSuccess {
  success: true;
  data: MainExplorationSeedResult;
  modelName?: string;
  usage?: { inputTokens: number; outputTokens: number };
  elapsedMs: number;
}

export interface TierPlanSuggestionFailure {
  success: false;
  error: string;
}

async function callRefinementLlm(
  input: TierPlanRefinementInput,
  tier: ModelTier,
): Promise<{
  content: string;
  modelName?: string;
  usage?: { inputTokens: number; outputTokens: number };
}> {
  const userPrompt = buildTierPlanRefinementUserPrompt(input);
  const result = await withRetry(
    () =>
      generateTextWithRateLimit({
        system: TIER_PLAN_REFINEMENT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: tier,
        temperature: 0.3,
        maxTokens: 2400,
        responseFormat: "json",
      }),
    { label: `extractTierPlanSuggestion:${tier}` },
  );
  if (!result.content) throw new Error("AI 응답이 비어있습니다.");
  return {
    content: result.content,
    ...(result.modelId ? { modelName: result.modelId } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
  };
}

export async function extractTierPlanSuggestion(
  input: TierPlanRefinementInput,
): Promise<TierPlanSuggestionSuccess | TierPlanSuggestionFailure> {
  const startMs = Date.now();

  const tryTier = async (tier: ModelTier) => {
    const { content, modelName, usage } = await callRefinementLlm(input, tier);
    const parsed = parseTierPlanRefinementResponse(content);
    return { parsed, modelName, usage };
  };

  try {
    const { parsed, modelName, usage } = await tryTier("fast");
    return {
      success: true,
      data: parsed,
      ...(modelName ? { modelName } : {}),
      ...(usage ? { usage } : {}),
      elapsedMs: Date.now() - startMs,
    };
  } catch (flashErr) {
    try {
      const { parsed, modelName, usage } = await tryTier("standard");
      return {
        success: true,
        data: parsed,
        ...(modelName ? { modelName } : {}),
        ...(usage ? { usage } : {}),
        elapsedMs: Date.now() - startMs,
      };
    } catch (proErr) {
      return {
        success: false,
        error: `Flash: ${flashErr instanceof Error ? flashErr.message : String(flashErr)} | Pro: ${proErr instanceof Error ? proErr.message : String(proErr)}`,
      };
    }
  }
}
