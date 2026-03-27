"use server";

/**
 * AI 맥락 인식 주제 추천 서버 액션 (DB 축적형)
 *
 * 1차: DB에서 축적된 주제 조회 (AI 호출 없음)
 * 2차: forceNew=true → Gemini 호출 → DB에 영구 저장 → 기존+신규 반환
 * 3차: 할당량 초과 → DB fallback
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
import { suggestedTopicsSchema } from "../types";
import type { SuggestedTopicsOutput } from "../types";
import {
  SUGGEST_TOPICS_SYSTEM_PROMPT,
  buildSuggestTopicPrompt,
} from "../prompts/suggest-topics";
import {
  findSuggestedTopics,
  saveSuggestedTopics,
  incrementTopicUsedCount,
} from "../../repository";
import type { SuggestedTopic } from "../../types";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";

const LOG_CTX = { domain: "guide", action: "suggestTopics" };

/** 축적된 주제 조회 (DB만, AI 호출 없음) */
export async function fetchSuggestedTopicsAction(input: {
  guideType?: string;
  subjectName?: string;
  careerField?: string;
  curriculumYear?: number;
  targetMajor?: string;
  limit?: number;
}): Promise<ActionResponse<SuggestedTopic[]>> {
  try {
    await requireAdminOrConsultant();
    const data = await findSuggestedTopics(input);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError(LOG_CTX, error, input);
    return createErrorResponse("축적된 주제를 불러올 수 없습니다.");
  }
}

/** AI 새 주제 생성 + DB 저장 + 기존 포함 반환 */
export async function suggestTopicsAction(input: {
  guideType: string;
  subject?: string;
  careerField?: string;
  targetMajor?: string;
  curriculumYear?: number;
  subjectGroup?: string;
  majorUnit?: string;
  minorUnit?: string;
  existingTitles?: string[];
  /** AI 모델 티어 (fast=Flash, advanced=Pro) — 기본 fast */
  modelTier?: "fast" | "standard" | "advanced";
}): Promise<ActionResponse<SuggestedTopicsOutput>> {
  try {
    await requireAdminOrConsultant();

    // 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      // fallback: DB에서 기존 주제 반환
      const cached = await findSuggestedTopics({
        guideType: input.guideType,
        subjectName: input.subject,
        careerField: input.careerField,
      });
      if (cached.length > 0) {
        return createSuccessResponse({
          topics: cached.map((t) => ({
            title: t.title,
            reason: t.reason ?? "",
            relatedSubjects: t.related_subjects,
            difficulty: (t.difficulty_level ?? "intermediate") as "basic" | "intermediate" | "advanced",
          })),
        });
      }
      return createErrorResponse(
        "일일 AI 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      );
    }

    // 기존 축적 주제 제목 (중복 회피용)
    const existing = await findSuggestedTopics({
      guideType: input.guideType,
      subjectName: input.subject,
      careerField: input.careerField,
      limit: 10,
    });
    const allExistingTitles = [
      ...(input.existingTitles ?? []),
      ...existing.map((t) => t.title),
    ]
      .map((t) => t.slice(0, 80))
      .slice(0, 10);

    // 프롬프트 조립 (기존 제목을 중복 회피로 전달)
    const userPrompt = buildSuggestTopicPrompt({
      ...input,
      existingTitles: allExistingTitles,
    });

    // Gemini 호출
    const tier = input.modelTier ?? "fast";
    const { object: result, modelId } = await generateObjectWithRateLimit({
      system: SUGGEST_TOPICS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      schema: zodSchema(suggestedTopicsSchema),
      modelTier: tier,
      temperature: 0.7,
      maxTokens: tier === "advanced" ? 4096 : 2048,
    });

    // DB에 영구 저장 (중복 무시)
    try {
      const tenantCtx = await getTenantContext();
      const user = await getCachedAuthUser();
      const tenantId = tenantCtx?.tenantId ?? null;
      const userId = user?.id;

      await saveSuggestedTopics(
        result.topics.map((t) => ({
          tenantId,
          guideType: input.guideType,
          subjectName: input.subject,
          careerField: input.careerField,
          curriculumYear: input.curriculumYear,
          targetMajor: input.targetMajor,
          subjectGroup: input.subjectGroup,
          majorUnit: input.majorUnit,
          minorUnit: input.minorUnit,
          title: t.title,
          reason: t.reason,
          relatedSubjects: t.relatedSubjects,
          difficultyLevel: t.difficulty,
          aiModelVersion: modelId,
          createdBy: userId,
        })),
      );
    } catch (saveError) {
      console.error("[suggestTopics] DB 저장 실패:", saveError);
    }

    return createSuccessResponse(result);
  } catch (error) {
    logActionError(LOG_CTX, error, input);
    return createErrorResponse("AI 주제 추천에 실패했습니다.");
  }
}

/** 주제 사용 횟수 증가 */
export async function incrementTopicUsedCountAction(
  topicId: string,
): Promise<ActionResponse<void>> {
  try {
    await requireAdminOrConsultant();
    await incrementTopicUsedCount(topicId);
    return createSuccessResponse(undefined);
  } catch (error) {
    logActionError(LOG_CTX, error, { topicId });
    return createErrorResponse("사용 횟수 업데이트 실패");
  }
}
