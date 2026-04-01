"use server";

// ============================================
// C3 — AI 가이드 품질 리뷰 Server Action
// Claude Sonnet 4 우선, Gemini fallback
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { generateObjectWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
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

    const guide = await findGuideById(guideId);
    if (!guide) {
      return createErrorResponse("가이드를 찾을 수 없습니다.");
    }

    if (!guide.content) {
      return createErrorResponse("가이드 본문이 없습니다.");
    }

    // 상태를 ai_reviewing으로 전환
    await updateGuide(guideId, { status: "ai_reviewing" });

    const systemPrompt = buildReviewSystemPrompt(guide.guide_type as GuideType);
    const userPrompt = buildReviewUserPrompt(guide);

    // Claude 우선 리뷰
    let review: GuideReviewOutput;
    let modelId: string;

    try {
      const result = await generateObject({
        model: anthropic("claude-sonnet-4-20250514"),
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        schema: zodSchema(guideReviewSchema),
        maxOutputTokens: 8192,
        temperature: 0.2,
      });
      review = result.object as GuideReviewOutput;
      modelId = `claude:claude-sonnet-4-20250514`;
    } catch (claudeError) {
      // Claude 실패 → Gemini fallback
      logActionWarn(LOG_CTX, "Claude 리뷰 실패 → Gemini fallback", {
        error: claudeError instanceof Error ? claudeError.message : String(claudeError),
      });

      // Gemini 할당량 확인
      const quota = geminiQuotaTracker.getQuotaStatus();
      if (quota.isExceeded) {
        throw new Error("Claude 리뷰 실패 + Gemini 할당량 초과");
      }

      const geminiResult = await generateObjectWithRateLimit({
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        schema: zodSchema(guideReviewSchema),
        modelTier: "advanced",
        temperature: 0.2,
        maxTokens: 8192,
      });
      review = geminiResult.object;
      modelId = `gemini:${geminiResult.modelId} (fallback)`;
    }

    const score = Number(review.overallScore);
    const tier = scoreToQualityTier(score);
    const status = scoreToStatus(score);

    // 리뷰 결과 저장
    await updateGuide(guideId, {
      status,
      qualityScore: score,
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
      score,
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
