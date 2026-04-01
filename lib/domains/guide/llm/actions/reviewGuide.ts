"use server";

// ============================================
// C3 — AI 가이드 품질 리뷰 Server Action (fire-and-forget)
//
// 패턴:
//   1. 인증 + 가이드 존재 확인
//   2. status를 "ai_reviewing"으로 즉시 업데이트
//   3. 즉시 성공 반환 (reviewResult 없이)
//   4. executeGuideReview()를 fire-and-forget (.catch())
//   5. 내부에서 createSupabaseAdminClient() 사용 (request context 만료 방지)
//   6. 성공: review 결과 + status 업데이트 / 실패: status="draft"로 복원
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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

// ============================================
// 퍼블릭 Server Action — 즉시 반환
// ============================================

export async function reviewGuideAction(
  guideId: string,
): Promise<ActionResponse<{ guideId: string }>> {
  try {
    await requireAdminOrConsultant();

    const guide = await findGuideById(guideId);
    if (!guide) {
      return createErrorResponse("가이드를 찾을 수 없습니다.");
    }

    if (!guide.content) {
      return createErrorResponse("가이드 본문이 없습니다.");
    }

    // 상태를 ai_reviewing으로 전환 후 즉시 반환
    await updateGuide(guideId, { status: "ai_reviewing" });

    // fire-and-forget — request context 만료 후에도 계속 실행
    executeGuideReview(guideId).catch((err) => {
      logActionError(
        { ...LOG_CTX, action: "executeGuideReview" },
        err,
        { guideId },
      );
    });

    return createSuccessResponse({ guideId });
  } catch (error) {
    logActionError(LOG_CTX, error, { guideId });
    return createErrorResponse("AI 리뷰 요청에 실패했습니다.");
  }
}

// ============================================
// 내부: 백그라운드 실행 함수
// createSupabaseAdminClient() 사용 (request context 만료 방지)
// ============================================

async function executeGuideReview(guideId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  try {
    // 가이드 재로드 (admin client로)
    const guide = await findGuideById(guideId);
    if (!guide || !guide.content) {
      await admin
        .from("exploration_guides")
        .update({ status: "draft" })
        .eq("id", guideId);
      return;
    }

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
        abortSignal: AbortSignal.timeout(55_000),
      });
      review = result.object as GuideReviewOutput;
      modelId = `claude:claude-sonnet-4-20250514`;
    } catch (claudeError) {
      // Claude 실패 → Gemini fallback
      logActionWarn(LOG_CTX, "Claude 리뷰 실패 → Gemini fallback", {
        error:
          claudeError instanceof Error
            ? claudeError.message
            : String(claudeError),
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
    await admin
      .from("exploration_guides")
      .update({
        status,
        quality_score: score,
        quality_tier: tier,
        review_result: {
          dimensions: review.dimensions,
          feedback: review.feedback,
          strengths: review.strengths,
          reviewedAt: new Date().toISOString(),
          modelId,
        },
      })
      .eq("id", guideId);
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "executeGuideReview" },
      error,
      { guideId },
    );

    // 리뷰 실패 시 status="draft"로 복원
    try {
      await admin
        .from("exploration_guides")
        .update({ status: "draft" })
        .eq("id", guideId);
    } catch (updateError) {
      logActionError(
        { ...LOG_CTX, action: "executeGuideReview.failUpdate" },
        updateError,
        { guideId },
      );
    }
  }
}
