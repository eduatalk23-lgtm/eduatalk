"use server";

// ============================================
// α5 Interview — llm_v1 꼬꼬무 생성 action (Sprint 3, 2026-04-20)
//
// standard tier 단일 호출 — 꼬꼬무 1개는 가벼운 태스크.
// 실패 시 호출자가 rule_v1 로 graceful fallback.
// 비용 추정: input ~1K / output ~200 → Gemini Flash 기준 $0.001/call
// ============================================

import { generateTextWithRateLimit, type ModelTier } from "../ai-client";
import { withRetry } from "../retry";
import { estimateCost } from "@/lib/domains/plan/llm/client";
import {
  INTERVIEW_FOLLOWUP_SYSTEM_PROMPT,
  buildInterviewFollowupUserPrompt,
  parseFollowupResponse,
  type FollowupPromptInput,
  type FollowupLlmResult,
} from "../prompts/interviewFollowupPrompt";

export interface FollowupLlmSuccess {
  readonly success: true;
  readonly data: FollowupLlmResult;
  readonly modelName?: string;
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
  readonly elapsedMs: number;
  readonly tier: ModelTier;
  readonly costUsd: number | null;
}

export interface FollowupLlmFailure {
  readonly success: false;
  readonly error: string;
  readonly tierAttempts: readonly ModelTier[];
}

async function callFollowupLlm(
  input: FollowupPromptInput,
  tier: ModelTier,
): Promise<{
  content: string;
  modelName?: string;
  usage?: { inputTokens: number; outputTokens: number };
}> {
  const userPrompt = buildInterviewFollowupUserPrompt(input);
  const result = await withRetry(
    () =>
      generateTextWithRateLimit({
        system: INTERVIEW_FOLLOWUP_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: tier,
        temperature: 0.6,
        maxTokens: 800,
        responseFormat: "json",
      }),
    { label: `generateInterviewFollowup:${tier}` },
  );
  if (!result.content) throw new Error("AI 응답이 비어있습니다.");
  return {
    content: result.content,
    ...(result.modelId ? { modelName: result.modelId } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
  };
}

/**
 * depth=nextDepth 꼬꼬무 1개 생성.
 * standard(Flash) 1회 → 실패 시 advanced(Pro) fallback.
 */
export async function generateInterviewFollowup(
  input: FollowupPromptInput,
  options?: { tierPreference?: "auto" | "standard_only" },
): Promise<FollowupLlmSuccess | FollowupLlmFailure> {
  const startMs = Date.now();
  const pref = options?.tierPreference ?? "auto";
  const tiers: ModelTier[] =
    pref === "standard_only" ? ["standard"] : ["standard", "advanced"];

  const tierAttempts: ModelTier[] = [];
  let lastError: unknown = null;

  for (const tier of tiers) {
    tierAttempts.push(tier);
    try {
      const { content, modelName, usage } = await callFollowupLlm(input, tier);
      const parsed = parseFollowupResponse(content);
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
