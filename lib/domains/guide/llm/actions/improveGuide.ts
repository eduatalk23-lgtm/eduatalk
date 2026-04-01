"use server";

/**
 * AI 리뷰 기반 가이드 개선 서버 액션 (fire-and-forget)
 *
 * 패턴:
 *   1. 입력 검증 + 인증
 *   2. 새 버전을 status="ai_improving"으로 즉시 생성
 *   3. 새 버전 ID를 즉시 반환
 *   4. executeGuideImprovement()를 fire-and-forget (.catch())
 *   5. 내부에서 createSupabaseAdminClient() 사용 (request context 만료 방지)
 *   6. 성공: status="draft" + 개선 콘텐츠 저장 / 실패: status="ai_failed"
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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatedGuideSchema } from "../types";
import type { GeneratedGuideOutput } from "../types";
import {
  buildImproveSystemPrompt,
  buildImproveUserPrompt,
} from "../prompts/improve-guide";
import { resolveContentSections } from "../../section-config";
import type { GuideType } from "../../types";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";

const LOG_CTX = { domain: "guide", action: "improveGuide" };

// ============================================
// 퍼블릭 Server Action — 즉시 반환
// ============================================

export async function improveGuideAction(
  guideId: string,
  _modelTier?: unknown, // 하위 호환 — 무시됨, 항상 advanced 사용
): Promise<ActionResponse<{ guideId: string }>> {
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

    // user ID 검증
    const user = await getCachedAuthUser();
    if (!user?.id) {
      return createErrorResponse("사용자 정보를 확인할 수 없습니다.");
    }

    // 새 버전을 "ai_improving" 상태로 즉시 생성 (placeholder)
    const newGuide = await createNewVersion(guideId, user.id);
    await updateGuide(newGuide.id, {
      status: "ai_improving",
      sourceType: "ai_improve",
      qualityTier: "ai_draft",
      reviewResult: null,
      versionMessage: `AI 리뷰 피드백 반영 개선 중... (${guide.quality_score ?? 0}점 → 개선)`,
    });

    // fire-and-forget — request context 만료 후에도 계속 실행
    executeGuideImprovement(newGuide.id, guideId, user.id).catch((err) => {
      logActionError(
        { ...LOG_CTX, action: "executeGuideImprovement" },
        err,
        { newGuideId: newGuide.id, sourceGuideId: guideId },
      );
    });

    return createSuccessResponse({ guideId: newGuide.id });
  } catch (error) {
    logActionError(LOG_CTX, error, { guideId });
    return createErrorResponse("AI 개선에 실패했습니다.");
  }
}

// ============================================
// 내부: 백그라운드 실행 함수
// createSupabaseAdminClient() 사용 (request context 만료 방지)
// ============================================

async function executeGuideImprovement(
  newGuideId: string,
  sourceGuideId: string,
  _userId: string,
): Promise<void> {
  const adminClient = createSupabaseAdminClient() ?? undefined;

  try {
    // 원본 가이드 재로드 (admin client — request context 만료 후에도 안전)
    const { findGuideByIdPublic } = await import("../../repository");
    const guide = await findGuideByIdPublic(sourceGuideId);
    if (!guide || !guide.content || !guide.review_result) {
      await adminClient!
        .from("exploration_guides")
        .update({ status: "ai_failed" })
        .eq("id", newGuideId);
      return;
    }

    // content_sections 우선 해석
    const contentSections = resolveContentSections(
      guide.guide_type as GuideType,
      guide.content,
    );

    // 개선 프롬프트 조립
    const userPrompt = buildImproveUserPrompt({
      title: guide.title,
      guideType: guide.guide_type,
      contentSections:
        contentSections.length > 0 ? contentSections : undefined,
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
        dimensions: {
          ...guide.review_result.dimensions,
          scientificAccuracy:
            guide.review_result.dimensions?.scientificAccuracy ?? 0,
        },
        feedback: guide.review_result.feedback,
        strengths: guide.review_result.strengths,
      },
      qualityScore: guide.quality_score,
    });

    // Gemini 호출 — advanced(2.5-pro) 우선, 과부하 시 fast(2.5-flash) fallback
    let improved: GeneratedGuideOutput;
    let modelId: string;
    const improveOpts = {
      system: buildImproveSystemPrompt(guide.guide_type as GuideType),
      messages: [{ role: "user" as const, content: userPrompt }],
      schema: zodSchema(generatedGuideSchema),
      temperature: 0.35,
      maxTokens: 65536,
    };

    try {
      const result = await generateObjectWithRateLimit({
        ...improveOpts,
        modelTier: "advanced",
      });
      improved = result.object;
      modelId = result.modelId;
    } catch (primaryError) {
      const msg =
        primaryError instanceof Error ? primaryError.message : "";
      if (
        msg.includes("high demand") ||
        msg.includes("429") ||
        msg.includes("overloaded")
      ) {
        const { logActionWarn } = await import("@/lib/logging/actionLogger");
        logActionWarn(LOG_CTX, "2.5-pro 과부하 → 2.5-flash fallback", {
          newGuideId,
        });
        const result = await generateObjectWithRateLimit({
          ...improveOpts,
          modelTier: "fast",
          maxTokens: 40960,
        });
        improved = result.object;
        modelId = result.modelId + " (fallback)";
      } else {
        throw primaryError;
      }
    }

    // 개선 결과 검증
    if (improved.sections.length === 0) {
      await adminClient!
        .from("exploration_guides")
        .update({ status: "ai_failed" })
        .eq("id", newGuideId);
      return;
    }

    // outline 밀도 검증 (경고 로그)
    const contentOutlines = improved.sections
      .filter((s) => s.key === "content_sections" && s.outline?.length)
      .flatMap((s) => s.outline ?? []);
    const outlineStats = {
      total: contentOutlines.length,
      depth0: contentOutlines.filter((o) => o.depth === 0).length,
      tips: contentOutlines.filter((o) => o.tip).length,
      resources: contentOutlines.filter((o) => o.resources?.length).length,
    };
    if (
      outlineStats.total < 40 ||
      outlineStats.depth0 < 5 ||
      outlineStats.tips < 6 ||
      outlineStats.resources < 5
    ) {
      const { logActionWarn } = await import("@/lib/logging/actionLogger");
      logActionWarn(
        LOG_CTX,
        `Outline 밀도 미달: total=${outlineStats.total}/40, depth0=${outlineStats.depth0}/5, tips=${outlineStats.tips}/6, resources=${outlineStats.resources}/5`,
        { newGuideId, outlineStats },
      );
    }

    // 독서탐구 도서 실존 검증
    if (improved.guideType === "reading") {
      if (!improved.bookConfidence && improved.bookTitle) {
        improved.bookConfidence = "medium";
        if (!improved.bookVerificationNote) {
          improved.bookVerificationNote =
            "AI 개선 시 confidence 미지정 — 컨설턴트 검수 필요";
        }
      }
      if (
        improved.bookConfidence === "low" ||
        improved.bookConfidence === "medium"
      ) {
        const { logActionWarn: logBookWarn } = await import(
          "@/lib/logging/actionLogger"
        );
        logBookWarn(
          LOG_CTX,
          `[improve] 도서 신뢰도 ${improved.bookConfidence}: "${improved.bookTitle}"`,
          {
            bookTitle: improved.bookTitle,
            bookConfidence: improved.bookConfidence,
            bookVerificationNote: improved.bookVerificationNote,
          },
        );
      }
    }

    // 논문 실존 검증 — confidence 기본값 + low 자동 제거
    if (improved.relatedPapers?.length) {
      for (const paper of improved.relatedPapers) {
        if (!paper.confidence) {
          paper.confidence = "medium";
          if (!paper.verificationNote) {
            paper.verificationNote =
              "AI 개선 시 confidence 미지정 — 컨설턴트 검수 필요";
          }
        }
      }
      const lowPapers = improved.relatedPapers.filter(
        (p) => p.confidence === "low",
      );
      if (lowPapers.length > 0) {
        const { logActionWarn: logPaperWarn } = await import(
          "@/lib/logging/actionLogger"
        );
        logPaperWarn(
          LOG_CTX,
          `[improve] 논문 ${lowPapers.length}건 low confidence 제거`,
          {
            removed: lowPapers.map((p) => ({
              title: p.title,
              verificationNote: p.verificationNote,
            })),
          },
        );
        improved.relatedPapers = improved.relatedPapers.filter(
          (p) => p.confidence !== "low",
        );
      }
    }

    // sections → 레거시 역변환 (하위 호환)
    const legacy = sectionsToLegacyImprove(improved.sections);

    // 개선된 콘텐츠 저장
    await upsertGuideContent(newGuideId, {
      motivation: legacy.motivation ?? improved.motivation ?? "",
      theorySections:
        legacy.theorySections.length > 0
          ? legacy.theorySections
          : (improved.theorySections ?? []).map((s) => ({
              ...s,
              content_format: "html" as const,
            })),
      reflection: legacy.reflection ?? improved.reflection ?? "",
      impression: legacy.impression ?? improved.impression ?? "",
      summary: legacy.summary ?? improved.summary ?? "",
      followUp: legacy.followUp ?? improved.followUp ?? "",
      bookDescription: legacy.bookDescription ?? improved.bookDescription,
      relatedPapers: improved.relatedPapers,
      // 세특 예시는 원본 보존
      setekExamples: guide.content.setek_examples,
      contentSections: improved.sections.map((s) => ({
        key: s.key,
        label: s.label,
        content: s.content,
        content_format: "html" as const,
        items: s.items,
        order: s.order,
        outline: s.outline,
      })),
    }, adminClient);

    // 새 버전 메타 업데이트 (status=draft, 리뷰 상속 방지)
    await admin
      .from("exploration_guides")
      .update({
        status: "draft",
        quality_score: null,
        quality_tier: "ai_draft",
        review_result: null,
        version_message: `AI 리뷰 피드백 반영 개선 (${guide.quality_score ?? 0}점 → 개선)`,
        ai_model_version: modelId,
        ai_prompt_version: "improve-v1",
      })
      .eq("id", newGuideId);
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "executeGuideImprovement" },
      error,
      { newGuideId, sourceGuideId },
    );

    // 오류 발생 시 ai_failed 상태로 업데이트
    try {
      await adminClient!
        .from("exploration_guides")
        .update({ status: "ai_failed" })
        .eq("id", newGuideId);
    } catch (updateError) {
      logActionError(
        { ...LOG_CTX, action: "executeGuideImprovement.failUpdate" },
        updateError,
        { newGuideId },
      );
    }
  }
}

// ============================================
// 내부: sections → 레거시 역변환 (improveGuide용)
// ============================================

function sectionsToLegacyImprove(
  sections: Array<{
    key: string;
    label: string;
    content: string;
    items?: string[];
    order?: number;
    outline?: import("../../types").OutlineItem[];
  }>,
) {
  const result = {
    motivation: undefined as string | undefined,
    theorySections: [] as Array<{
      order: number;
      title: string;
      content: string;
      content_format: "html";
      outline?: import("../../types").OutlineItem[];
    }>,
    reflection: undefined as string | undefined,
    impression: undefined as string | undefined,
    summary: undefined as string | undefined,
    followUp: undefined as string | undefined,
    bookDescription: undefined as string | undefined,
  };

  for (const s of sections) {
    switch (s.key) {
      case "motivation":
        result.motivation = s.content;
        break;
      case "content_sections":
        result.theorySections.push({
          order: s.order ?? result.theorySections.length + 1,
          title: s.label,
          content: s.content,
          content_format: "html",
          outline: s.outline,
        });
        break;
      case "reflection":
        result.reflection = s.content;
        break;
      case "impression":
        result.impression = s.content;
        break;
      case "summary":
        result.summary = s.content;
        break;
      case "follow_up":
        result.followUp = s.content;
        break;
      case "book_description":
        result.bookDescription = s.content;
        break;
    }
  }
  return result;
}
