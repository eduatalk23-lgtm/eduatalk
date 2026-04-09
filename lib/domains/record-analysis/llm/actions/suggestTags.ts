"use server";

// ============================================
// AI 역량 태그 제안 Server Action
// Phase 5.5a — Gemini fast로 세특/창체 분석
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { SYSTEM_PROMPT, buildUserPrompt, parseResponse } from "../prompts/competencyTagging";
import type { SuggestTagsInput, SuggestTagsResult } from "../types";

const LOG_CTX = { domain: "record-analysis", action: "suggestTags" };

export async function suggestCompetencyTags(
  input: SuggestTagsInput,
): Promise<{ success: true; data: SuggestTagsResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (!input.content || input.content.trim().length < 20) {
      return { success: false, error: "분석할 텍스트가 너무 짧습니다 (20자 이상 필요)." };
    }

    const userPrompt = buildUserPrompt(input);

    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "fast",
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: "json",
      }),
      { label: "suggestTags" },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다. 다시 시도해주세요." };
    }

    const parsed = parseResponse(result.content);

    if (parsed.suggestions.length === 0) {
      return {
        success: true,
        data: { suggestions: [], summary: "해당 텍스트에서 명확한 역량 근거를 찾지 못했습니다." },
      };
    }

    return { success: true, data: parsed };
  } catch (error) {
    return handleLlmActionError(error, "역량 태그 분석", LOG_CTX);
  }
}
