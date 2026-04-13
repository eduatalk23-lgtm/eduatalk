"use server";

// ============================================
// H2 / L3-B: Interest Consistency Narrative 액션
// 학생당 1회 LLM 호출 (P0 profileCard 빌드 시점)
// ============================================

import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import {
  INTEREST_CONSISTENCY_SYSTEM_PROMPT,
  buildInterestConsistencyUserPrompt,
  parseInterestConsistencyResponse,
} from "../prompts/interestConsistency";
import type {
  InterestConsistencyInput,
  InterestConsistencyResult,
} from "../types";
import { isInterestConsistencyInputInsufficient } from "./extractInterestConsistency.helpers";

export interface ExtractInterestConsistencyResponse {
  success: true;
  data: InterestConsistencyResult;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ExtractInterestConsistencyError {
  success: false;
  error: string;
}

export async function extractInterestConsistency(
  input: InterestConsistencyInput,
): Promise<ExtractInterestConsistencyResponse | ExtractInterestConsistencyError> {
  const startMs = Date.now();

  if (input.priorSchoolYears.length === 0) {
    return { success: false, error: "이전 학년 데이터가 없습니다." };
  }
  if (isInterestConsistencyInputInsufficient(input)) {
    return { success: false, error: "서사 생성에 필요한 신호가 부족합니다." };
  }

  const userPrompt = buildInterestConsistencyUserPrompt(input);
  const validThemeIds = new Set(input.themes.map((t) => t.id));

  try {
    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system: INTEREST_CONSISTENCY_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: "standard",
          temperature: 0.4,
          maxTokens: 600,
          responseFormat: "json",
        }),
      { label: "extractInterestConsistency" },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    const parsed = parseInterestConsistencyResponse(result.content, validThemeIds);
    if (!parsed) {
      return { success: false, error: "응답 파싱 실패" };
    }

    return {
      success: true,
      data: { ...parsed, elapsedMs: Date.now() - startMs },
      ...(result.usage ? { usage: result.usage } : {}),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
