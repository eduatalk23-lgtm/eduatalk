"use server";

// ============================================
// AI 보완전략 제안 Server Action
// Phase 7 — Gemini Grounding (웹 검색) 활용
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { SYSTEM_PROMPT, buildUserPrompt, parseResponse } from "../prompts/strategyRecommend";
import type { SuggestStrategiesInput, SuggestStrategiesResult } from "../types";

const LOG_CTX = { domain: "student-record", action: "suggestStrategies" };

export async function suggestStrategies(
  input: SuggestStrategiesInput,
): Promise<{ success: true; data: SuggestStrategiesResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (input.weaknesses.length === 0 && input.weakCompetencies.length === 0 && (!input.rubricWeaknesses || input.rubricWeaknesses.length === 0)) {
      return { success: false, error: "진단 약점이나 부족 역량 데이터가 없습니다. 먼저 종합 진단을 실행해주세요." };
    }

    const userPrompt = buildUserPrompt(input);

    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "fast",
        temperature: 0.4,
        maxTokens: 3000,
        grounding: { enabled: true, mode: "dynamic", dynamicThreshold: 0.3 },
      }),
      { label: "suggestStrategies" },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다. 다시 시도해주세요." };
    }

    // Grounding 웹 검색 출처 추출
    const sourceUrls = result.groundingMetadata?.webResults
      ?.map((r) => r.url)
      .filter(Boolean) as string[] | undefined;

    const parsed = parseResponse(result.content, sourceUrls);

    if (parsed.suggestions.length === 0) {
      return {
        success: true,
        data: { suggestions: [], summary: "현재 진단 데이터로는 구체적인 보완전략을 도출하기 어렵습니다." },
      };
    }

    return { success: true, data: parsed };
  } catch (error) {
    return handleLlmActionError(error, "보완전략 제안", LOG_CTX);
  }
}
