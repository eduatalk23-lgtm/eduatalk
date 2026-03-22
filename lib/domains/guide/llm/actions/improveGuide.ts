"use server";

/**
 * AI 리뷰 기반 가이드 개선 서버 액션
 * 리뷰 피드백을 반영하여 새 버전을 생성한다.
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { generateObjectWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { zodSchema } from "ai";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  findGuideById,
  createNewVersion,
  upsertGuideContent,
  updateGuide,
} from "../../repository";
import { generatedGuideSchema } from "../types";
import type { GeneratedGuideOutput } from "../types";
import {
  IMPROVE_SYSTEM_PROMPT,
  buildImproveUserPrompt,
} from "../prompts/improve-guide";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";

const LOG_CTX = { domain: "guide", action: "improveGuide" };

export async function improveGuideAction(
  guideId: string,
): Promise<
  ActionResponse<{ guideId: string; preview: GeneratedGuideOutput }>
> {
  try {
    await requireAdminOrConsultant();

    // 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return createErrorResponse(
        "일일 AI 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      );
    }

    // 가이드 로드
    const guide = await findGuideById(guideId);
    if (!guide) {
      return createErrorResponse("가이드를 찾을 수 없습니다.");
    }
    if (!guide.content) {
      return createErrorResponse("가이드 본문이 없습니다.");
    }
    if (!guide.review_result) {
      return createErrorResponse(
        "AI 리뷰 결과가 없습니다. 먼저 AI 리뷰를 실행해주세요.",
      );
    }

    // #9: user ID 검증
    const user = await getCachedAuthUser();
    if (!user?.id) {
      return createErrorResponse("사용자 정보를 확인할 수 없습니다.");
    }

    // 개선 프롬프트 조립 (#6: qualityScore null 처리)
    const userPrompt = buildImproveUserPrompt({
      title: guide.title,
      guideType: guide.guide_type,
      motivation: guide.content.motivation ?? "",
      theorySections: guide.content.theory_sections.map((s) => ({
        title: s.title,
        content: s.content,
      })),
      reflection: guide.content.reflection ?? "",
      impression: guide.content.impression ?? "",
      summary: guide.content.summary ?? "",
      followUp: guide.content.follow_up ?? "",
      bookDescription: guide.content.book_description ?? undefined,
      setekExamples: guide.content.setek_examples,
      reviewResult: {
        dimensions: guide.review_result.dimensions,
        feedback: guide.review_result.feedback,
        strengths: guide.review_result.strengths,
      },
      qualityScore: guide.quality_score,
    });

    // Gemini 호출 (개선 생성)
    const { object: improved } = await generateObjectWithRateLimit({
      system: IMPROVE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      schema: zodSchema(generatedGuideSchema),
      modelTier: "fast",
      temperature: 0.35,
      maxTokens: 16384,
    });

    // #7: 개선 결과 검증
    if (!improved.motivation || improved.theorySections.length === 0) {
      return createErrorResponse(
        "AI가 개선된 콘텐츠를 생성하지 못했습니다. 다시 시도해주세요.",
      );
    }

    // 새 버전 생성
    const newGuide = await createNewVersion(guideId, user.id);

    // 개선된 콘텐츠 저장
    await upsertGuideContent(newGuide.id, {
      motivation: improved.motivation,
      theorySections: improved.theorySections.map((s) => ({
        ...s,
        content_format: "html" as const,
      })),
      reflection: improved.reflection,
      impression: improved.impression,
      summary: improved.summary,
      followUp: improved.followUp,
      bookDescription: improved.bookDescription,
      relatedPapers: improved.relatedPapers,
      // 세특 예시는 원본 보존
      setekExamples: guide.content.setek_examples,
      contentSections: improved.sections?.map((s) => ({
        key: s.key,
        label: s.label,
        content: s.content,
        content_format: "html" as const,
        items: s.items,
        order: s.order,
      })),
    });

    // #2: 새 버전 메타 초기화 (리뷰 상속 방지 + 버전 트리 정보)
    await updateGuide(newGuide.id, {
      status: "draft",
      sourceType: "ai_improve",
      qualityScore: undefined,
      qualityTier: "ai_draft",
      reviewResult: null,
      versionMessage: `AI 리뷰 피드백 반영 개선 (${guide.quality_score ?? 0}점 → 개선)`,
    });

    return createSuccessResponse({
      guideId: newGuide.id,
      preview: improved,
    });
  } catch (error) {
    logActionError(LOG_CTX, error, { guideId });
    return createErrorResponse("AI 개선에 실패했습니다.");
  }
}
