"use server";

// ============================================
// α4 Proposal Engine — llm_v1 LLM action (Sprint 3 scaffold, 2026-04-20)
//
// Sprint 2 rule_v1 위에 얹는 LLM 엔진. standard 모델 1차 → advanced fallback.
// Perception triggered + StudentState + Gap + rule_v1 seed → 3~5개 제안.
//
// **주의**: 이 함수는 실제 LLM 호출을 수행합니다. 비용 발생.
// 호출자는 feature flag 또는 explicit engine='llm_v1' 로 게이팅 필수.
// ============================================

import { generateTextWithRateLimit, type ModelTier } from "../ai-client";
import { withRetry } from "../retry";
import { estimateCost } from "@/lib/domains/plan/llm/client";
import {
  PROPOSAL_SYSTEM_PROMPT,
  buildProposalUserPrompt,
  parseProposalResponse,
  type ProposalPromptInput,
  type ProposalLlmResult,
} from "../prompts/proposalPrompt";

export interface ProposalLlmSuccess {
  readonly success: true;
  readonly data: ProposalLlmResult;
  readonly modelName?: string;
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
  readonly elapsedMs: number;
  readonly tier: ModelTier;
  /** usage + tier 기반 estimatedCost. usage 미제공 시 null. */
  readonly costUsd: number | null;
}

export interface ProposalLlmFailure {
  readonly success: false;
  readonly error: string;
  readonly tierAttempts: readonly ModelTier[];
}

async function callProposalLlm(
  input: ProposalPromptInput,
  tier: ModelTier,
): Promise<{
  content: string;
  modelName?: string;
  usage?: { inputTokens: number; outputTokens: number };
}> {
  const userPrompt = buildProposalUserPrompt(input);
  const result = await withRetry(
    () =>
      generateTextWithRateLimit({
        system: PROPOSAL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: tier,
        temperature: 0.4,
        maxTokens: 3200,
        responseFormat: "json",
      }),
    { label: `generateProposal:${tier}` },
  );
  if (!result.content) throw new Error("AI 응답이 비어있습니다.");
  return {
    content: result.content,
    ...(result.modelId ? { modelName: result.modelId } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
  };
}

/**
 * Proposal Engine llm_v1 엔진.
 *
 * 1차 standard tier → 실패 시 advanced tier fallback.
 * 둘 다 실패하면 failure 반환. 호출자가 rule_v1 로 polyfill 권장.
 *
 * tierPreference:
 *   - 'auto' (기본): standard → advanced
 *   - 'standard_only': advanced 폴백 없이 1회
 *   - 'advanced_first': advanced → standard (품질 우선, 비용 고려)
 */
export async function generateProposal(
  input: ProposalPromptInput,
  options?: { tierPreference?: "auto" | "standard_only" | "advanced_first" },
): Promise<ProposalLlmSuccess | ProposalLlmFailure> {
  const startMs = Date.now();
  const pref = options?.tierPreference ?? "auto";
  const tiers: ModelTier[] =
    pref === "standard_only"
      ? ["standard"]
      : pref === "advanced_first"
        ? ["advanced", "standard"]
        : ["standard", "advanced"];

  const tierAttempts: ModelTier[] = [];
  let lastError: unknown = null;

  for (const tier of tiers) {
    tierAttempts.push(tier);
    try {
      const { content, modelName, usage } = await callProposalLlm(input, tier);
      const parsed = parseProposalResponse(content);
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
      // 다음 tier 로 fallback
    }
  }

  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  return {
    success: false,
    error: errorMsg,
    tierAttempts,
  };
}
