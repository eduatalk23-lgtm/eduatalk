"use server";

/**
 * M2 Layer 2: AI 버전 비교 맥락 분석 Server Action
 *
 * 두 가이드 버전의 diff를 AI에 전달하여 변경 맥락을 분석합니다.
 * Gemini fast 모델 사용 (빠른 응답 우선).
 *
 * @module lib/domains/guide/llm/actions/analyzeVersionDiff
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { generateObjectWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { zodSchema } from "ai";
import { findGuideById } from "../../repository";
import { versionAnalysisSchema, type VersionAnalysisOutput } from "../types";
import {
  buildVersionComparisonSystemPrompt,
  buildVersionComparisonUserPrompt,
} from "../prompts/version-comparison";

const LOG_CTX = { domain: "guide", action: "analyzeVersionDiff" };

/**
 * 두 가이드 버전의 변경사항을 AI로 분석합니다.
 *
 * @param guideIdA 버전 A의 guide ID
 * @param guideIdB 버전 B의 guide ID
 * @returns AI 분석 결과 (맥락 설명, 개선점, 퇴보 위험, 다음 편집 제안)
 */
export async function analyzeVersionDiffAction(
  guideIdA: string,
  guideIdB: string,
): Promise<ActionResponse<VersionAnalysisOutput>> {
  try {
    await requireAdminOrConsultant();

    // Gemini 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return createErrorResponse("AI 할당량이 초과되었습니다. 잠시 후 다시 시도하세요.");
    }

    // 두 버전 병렬 조회
    const [guideA, guideB] = await Promise.all([
      findGuideById(guideIdA),
      findGuideById(guideIdB),
    ]);

    if (!guideA || !guideB) {
      return createErrorResponse("비교할 버전을 찾을 수 없습니다.");
    }

    // Layer 1 diff 계산
    const { compareVersions } = await import("../../utils/versionDiff");
    const [older, newer] =
      guideA.version <= guideB.version
        ? [guideA, guideB]
        : [guideB, guideA];
    const diff = compareVersions(older, newer);

    // 변경 없는 경우 AI 호출 불필요
    if (
      diff.stats.addedSections === 0 &&
      diff.stats.removedSections === 0 &&
      diff.stats.modifiedSections === 0
    ) {
      return createSuccessResponse({
        changeNarrative: "두 버전 간 콘텐츠 변경이 없습니다.",
        improvementAreas: [],
        regressionRisks: [],
        suggestedNextEdits: [],
        overallVerdict: "lateral" as const,
      });
    }

    // AI 분석 호출 (Gemini fast)
    const systemPrompt = buildVersionComparisonSystemPrompt();
    const userPrompt = buildVersionComparisonUserPrompt(diff);

    const result = await generateObjectWithRateLimit({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      schema: zodSchema(versionAnalysisSchema),
      modelTier: "fast",
      temperature: 0.3,
      maxTokens: 2048,
    });

    return createSuccessResponse(result.object);
  } catch (error) {
    logActionError(LOG_CTX, error, { guideIdA, guideIdB });

    const errMsg =
      error instanceof Error ? error.message : "AI 분석에 실패했습니다.";

    // Rate limit 에러 특화 메시지
    if (errMsg.includes("429") || errMsg.includes("rate")) {
      return createErrorResponse("AI 요청 제한에 도달했습니다. 잠시 후 다시 시도하세요.");
    }

    return createErrorResponse("AI 분석에 실패했습니다.");
  }
}
