"use server";

// ============================================
// C3 — AI 가이드 품질 리뷰 Server Action
// ============================================

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
import { findGuideById, updateGuide } from "../../repository";
import {
  guideReviewSchema,
  scoreToQualityTier,
  scoreToStatus,
  type GuideReviewOutput,
} from "../types";
import { buildReviewSystemPrompt, buildReviewUserPrompt } from "../prompts/review";
import type { QualityTier, GuideStatus, GuideType } from "../../types";

const LOG_CTX = { domain: "guide", action: "reviewGuide" };

export interface ReviewResult {
  score: number;
  tier: QualityTier;
  status: GuideStatus;
  review: GuideReviewOutput;
}

export async function reviewGuideAction(
  guideId: string,
): Promise<ActionResponse<ReviewResult>> {
  try {
    await requireAdminOrConsultant();

    // 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return createErrorResponse(
        "오늘의 AI 사용 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      );
    }

    const guide = await findGuideById(guideId);
    if (!guide) {
      return createErrorResponse("가이드를 찾을 수 없습니다.");
    }

    if (!guide.content) {
      return createErrorResponse("가이드 본문이 없습니다.");
    }

    // 상태를 ai_reviewing으로 전환
    await updateGuide(guideId, { status: "ai_reviewing" });

    // AI 리뷰 실행
    const { object: review, modelId } = await generateObjectWithRateLimit({
      system: buildReviewSystemPrompt(guide.guide_type as GuideType),
      messages: [{ role: "user", content: buildReviewUserPrompt(guide) }],
      schema: zodSchema(guideReviewSchema),
      modelTier: "fast",
      temperature: 0.2,
      maxTokens: 4096,
    });

    const tier = scoreToQualityTier(review.overallScore);
    const status = scoreToStatus(review.overallScore);

    // 리뷰 결과 저장 (세부 점수 + 피드백 포함)
    await updateGuide(guideId, {
      status,
      qualityScore: review.overallScore,
      qualityTier: tier,
      reviewResult: {
        dimensions: review.dimensions,
        feedback: review.feedback,
        strengths: review.strengths,
        reviewedAt: new Date().toISOString(),
        modelId,
      },
    });

    return createSuccessResponse({
      score: review.overallScore,
      tier,
      status,
      review,
    });
  } catch (error) {
    logActionError(LOG_CTX, error, { guideId });

    // 리뷰 실패 시 상태 복원
    try {
      await updateGuide(guideId, { status: "draft" });
    } catch {
      // 복원 실패는 무시
    }

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return createErrorResponse(
        "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
      );
    }

    return createErrorResponse("AI 리뷰에 실패했습니다.");
  }
}
