"use server";

// ============================================
// Phase 1 Auto-Bootstrap: main_exploration seed 생성 액션
//
// target_major 만으로 초안 생성 (k=0 학생도 동작).
// 1차: Flash → 실패 시 2차: Pro fallback.
// k≥1 세특 요약 주입은 Phase 3 에서 추가.
// ============================================

import { generateTextWithRateLimit, type ModelTier } from "../ai-client";
import { withRetry } from "../retry";
import {
  MAIN_EXPLORATION_SEED_SYSTEM_PROMPT,
  buildMainExplorationSeedUserPrompt,
  parseMainExplorationSeedResponse,
  type MainExplorationSeedInput,
  type MainExplorationSeedResult,
} from "../prompts/mainExplorationSeed";

export interface MainExplorationSeedSuccess {
  success: true;
  data: MainExplorationSeedResult;
  modelName?: string;
  usage?: { inputTokens: number; outputTokens: number };
  elapsedMs: number;
}

export interface MainExplorationSeedFailure {
  success: false;
  error: string;
}

async function callSeedLlm(
  input: MainExplorationSeedInput,
  tier: ModelTier,
): Promise<{ content: string; modelName?: string; usage?: { inputTokens: number; outputTokens: number } }> {
  const userPrompt = buildMainExplorationSeedUserPrompt(input);
  const result = await withRetry(
    () =>
      generateTextWithRateLimit({
        system: MAIN_EXPLORATION_SEED_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: tier,
        temperature: 0.4,
        maxTokens: 2400,
        responseFormat: "json",
      }),
    { label: `generateMainExplorationSeed:${tier}` },
  );
  if (!result.content) throw new Error("AI 응답이 비어있습니다.");
  return {
    content: result.content,
    ...(result.modelId ? { modelName: result.modelId } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
  };
}

export async function generateMainExplorationSeed(
  input: MainExplorationSeedInput,
): Promise<MainExplorationSeedSuccess | MainExplorationSeedFailure> {
  const startMs = Date.now();

  const tryTier = async (tier: ModelTier) => {
    const { content, modelName, usage } = await callSeedLlm(input, tier);
    const parsed = parseMainExplorationSeedResponse(content);
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
