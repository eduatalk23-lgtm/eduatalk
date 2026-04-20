"use server";

// ============================================
// α5 Interview — llm_v1 답변 분석 action (Sprint 3, 2026-04-20)
//
// 답변 분석은 reasoning 밀도가 요구되어 advanced(Pro) 1차.
// 실패 시 standard(Flash) fallback 후에도 실패하면 호출자가 rule_v1 로 graceful.
//
// 비용 추정: input ~3K / output ~700 → Gemini Pro 기준 $0.02/call
// ============================================

import { generateTextWithRateLimit, type ModelTier } from "../ai-client";
import { withRetry } from "../retry";
import { estimateCost } from "@/lib/domains/plan/llm/client";
import {
  INTERVIEW_ANSWER_ANALYSIS_SYSTEM_PROMPT,
  buildAnswerAnalysisUserPrompt,
  parseAnswerAnalysisResponse,
  type AnswerAnalysisPromptInput,
  type AnswerAnalysisLlmResult,
} from "../prompts/interviewAnswerAnalysisPrompt";

export interface AnswerAnalysisLlmSuccess {
  readonly success: true;
  readonly data: AnswerAnalysisLlmResult;
  readonly modelName?: string;
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
  readonly elapsedMs: number;
  readonly tier: ModelTier;
  readonly costUsd: number | null;
}

export interface AnswerAnalysisLlmFailure {
  readonly success: false;
  readonly error: string;
  readonly tierAttempts: readonly ModelTier[];
}

async function callAnswerAnalysisLlm(
  input: AnswerAnalysisPromptInput,
  tier: ModelTier,
): Promise<{
  content: string;
  modelName?: string;
  usage?: { inputTokens: number; outputTokens: number };
}> {
  const userPrompt = buildAnswerAnalysisUserPrompt(input);
  const result = await withRetry(
    () =>
      generateTextWithRateLimit({
        system: INTERVIEW_ANSWER_ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: tier,
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: "json",
      }),
    { label: `analyzeInterviewAnswer:${tier}` },
  );
  if (!result.content) throw new Error("AI 응답이 비어있습니다.");
  return {
    content: result.content,
    ...(result.modelId ? { modelName: result.modelId } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
  };
}

/**
 * 답변 분석. advanced 1차 → standard fallback. 둘 다 실패면 failure 반환.
 *
 * tierPreference:
 *   - 'auto' (기본): advanced → standard
 *   - 'standard_first': standard → advanced (저비용 우선)
 *   - 'advanced_only': advanced 1회
 */
export async function analyzeInterviewAnswer(
  input: AnswerAnalysisPromptInput,
  options?: {
    tierPreference?: "auto" | "standard_first" | "advanced_only";
  },
): Promise<AnswerAnalysisLlmSuccess | AnswerAnalysisLlmFailure> {
  const startMs = Date.now();
  const pref = options?.tierPreference ?? "auto";
  const tiers: ModelTier[] =
    pref === "advanced_only"
      ? ["advanced"]
      : pref === "standard_first"
        ? ["standard", "advanced"]
        : ["advanced", "standard"];

  const tierAttempts: ModelTier[] = [];
  let lastError: unknown = null;

  for (const tier of tiers) {
    tierAttempts.push(tier);
    try {
      const { content, modelName, usage } = await callAnswerAnalysisLlm(input, tier);
      const parsed = parseAnswerAnalysisResponse(content);
      const costUsd = usage
        ? estimateCost(usage.inputTokens, usage.outputTokens, tier)
        : null;
      return {
        success: true,
        data: parsed,
        ...(modelName ? { modelName } : {}),
        ...(usage ? { usage } : {}),
        elapsedMs: Date.now() - startMs,
        tier,
        costUsd,
      };
    } catch (err) {
      lastError = err;
    }
  }

  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  return {
    success: false,
    error: errorMsg,
    tierAttempts,
  };
}
