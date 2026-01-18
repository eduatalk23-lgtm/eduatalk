"use server";

/**
 * AI 콘텐츠 추천 서버 액션
 *
 * Claude API를 사용하여 학생에게 최적의 학습 콘텐츠를 추천합니다.
 * 관리자가 학생 플랜을 생성할 때 사용됩니다.
 *
 * @module recommendContent
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logActionDebug, logActionError } from "@/lib/utils/serverActionLogger";
import {
  llmRecommendationCache,
  createCacheKey,
} from "@/lib/cache/memoryCache";

import { createMessage, extractJSON, estimateCost, type GroundingMetadata } from "../client";
import { getWebSearchContentService } from "../services/webSearchContentService";
import {
  CONTENT_RECOMMENDATION_SYSTEM_PROMPT,
  buildContentRecommendationPrompt,
  estimateContentRecommendationTokens,
  type ContentRecommendationRequest,
  type ContentRecommendationResponse,
} from "../prompts/contentRecommendation";

import type { ModelTier } from "../types";

import {
  loadStudentProfile,
  loadScoreInfo,
  loadLearningPattern,
  loadOwnedContents,
  loadCandidateContents,
} from "../loaders";

// ============================================
// 타입 정의
// ============================================

export interface RecommendContentInput {
  /** 학생 ID */
  studentId: string;
  /** 추천할 과목 카테고리 (없으면 전체) */
  subjectCategories?: string[];
  /** 추천 개수 (기본값: 5) */
  maxRecommendations?: number;
  /** 추천 포커스 */
  focusArea?: "weak_subjects" | "all_subjects" | "exam_prep";
  /** 추가 지시사항 */
  additionalInstructions?: string;
  /** 모델 티어 (기본값: fast - 비용 효율적) */
  modelTier?: ModelTier;
  /** 웹 검색 활성화 여부 (Gemini Grounding) */
  enableWebSearch?: boolean;
  /** 웹 검색 설정 */
  webSearchConfig?: {
    /** 검색 모드 - dynamic: 필요시 검색, always: 항상 검색 */
    mode?: "dynamic" | "always";
    /** 동적 검색 임계값 (0.0 - 1.0) */
    dynamicThreshold?: number;
    /** 검색 결과를 DB에 저장할지 여부 */
    saveResults?: boolean;
  };
}

export interface RecommendContentResult {
  success: boolean;
  data?: {
    recommendations: ContentRecommendationResponse["recommendations"];
    summary: ContentRecommendationResponse["summary"];
    insights: ContentRecommendationResponse["insights"];
    cost: {
      inputTokens: number;
      outputTokens: number;
      estimatedUSD: number;
    };
    /** 웹 검색 결과 (grounding 활성화 시) */
    webSearchResults?: {
      searchQueries: string[];
      resultsCount: number;
      savedCount?: number;
    };
  };
  error?: string;
}

// ============================================
// 메인 액션
// ============================================

/**
 * Claude API를 사용하여 학생에게 최적의 학습 콘텐츠를 추천합니다
 *
 * 처리 과정:
 * 1. 학생 프로필 및 성적 데이터 로드
 * 2. 학습 패턴 및 보유 콘텐츠 조회
 * 3. 추천 후보 콘텐츠 조회
 * 4. LLM 요청 빌드
 * 5. Claude API 호출 (fast 모델 사용 권장)
 * 6. 응답 파싱 및 검증
 * 7. 추천 결과 반환
 *
 * @param {RecommendContentInput} input - 추천 입력
 * @returns {Promise<RecommendContentResult>} 추천 결과
 *
 * @example
 * ```typescript
 * // 관리자 페이지에서 호출
 * const result = await recommendContentWithAI({
 *   studentId: 'student-uuid',
 *   maxRecommendations: 5,
 *   focusArea: 'weak_subjects',
 * });
 *
 * if (result.success) {
 *   result.data.recommendations.forEach((rec) => {
 *     console.log(`${rec.priority}. ${rec.title} - ${rec.reason}`);
 *   });
 * }
 * ```
 */
export async function recommendContentWithAI(
  input: RecommendContentInput
): Promise<RecommendContentResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 관리자 권한 확인 (선택적)
  // const role = await getCurrentUserRole();
  // if (role !== "admin" && role !== "consultant") {
  //   return { success: false, error: "권한이 없습니다." };
  // }

  // 캐시 확인 (1일 TTL)
  const cachedData = await getCachedRecommendations(
    input.studentId,
    input.focusArea
  );
  if (cachedData) {
    logActionDebug("recommendContent", "캐시 히트");
    return { success: true, data: cachedData };
  }

  try {
    // 1. 학생 프로필 로드
    const studentProfile = await loadStudentProfile(supabase, input.studentId);
    if (!studentProfile) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    // 2. 관련 데이터 병렬 로드
    const [scores, learningPattern, ownedContents, candidateContents] = await Promise.all([
      loadScoreInfo(supabase, input.studentId),
      loadLearningPattern(supabase, input.studentId),
      loadOwnedContents(supabase, input.studentId),
      loadCandidateContents(supabase, input.subjectCategories, 50),
    ]);

    if (candidateContents.length === 0) {
      return { success: false, error: "추천 가능한 콘텐츠가 없습니다." };
    }

    // 3. 이미 보유한 콘텐츠 제외
    const ownedIds = new Set(ownedContents.map((c) => c.id));
    const filteredCandidates = candidateContents.filter((c) => !ownedIds.has(c.id));

    if (filteredCandidates.length === 0) {
      return { success: false, error: "추천할 새로운 콘텐츠가 없습니다." };
    }

    // 4. LLM 요청 빌드
    const llmRequest: ContentRecommendationRequest = {
      student: studentProfile,
      scores,
      learningPattern,
      ownedContents,
      candidateContents: filteredCandidates.slice(0, 30), // 최대 30개로 제한
      maxRecommendations: input.maxRecommendations || 5,
      focusArea: input.focusArea,
      additionalInstructions: input.additionalInstructions,
    };

    // 5. 토큰 추정 로깅
    const tokenEstimate = estimateContentRecommendationTokens(llmRequest);
    logActionDebug("recommendContent", `예상 토큰: ${tokenEstimate.totalTokens}`);

    // 6. LLM 호출 (기본: fast 모델 - 비용 효율적)
    const modelTier = input.modelTier || "fast";
    const userPrompt = buildContentRecommendationPrompt(llmRequest);

    // Grounding 설정 (웹 검색)
    const groundingConfig = input.enableWebSearch
      ? {
          enabled: true,
          mode: input.webSearchConfig?.mode || ("dynamic" as const),
          dynamicThreshold: input.webSearchConfig?.dynamicThreshold,
        }
      : undefined;

    const result = await createMessage({
      system: CONTENT_RECOMMENDATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
      grounding: groundingConfig,
    });

    // 6-1. 웹 검색 결과 처리
    let webSearchResults:
      | {
          searchQueries: string[];
          resultsCount: number;
          savedCount?: number;
        }
      | undefined;

    if (result.groundingMetadata && result.groundingMetadata.webResults.length > 0) {
      logActionDebug(
        "recommendContent",
        `웹 검색 결과: ${result.groundingMetadata.webResults.length}건, 검색어: ${result.groundingMetadata.searchQueries.join(", ")}`
      );

      webSearchResults = {
        searchQueries: result.groundingMetadata.searchQueries,
        resultsCount: result.groundingMetadata.webResults.length,
      };

      // DB 저장 옵션이 활성화된 경우 - tenantId 조회 필요
      if (input.webSearchConfig?.saveResults) {
        // 학생의 tenant_id 조회
        const { data: studentData } = await supabase
          .from("students")
          .select("tenant_id")
          .eq("id", input.studentId)
          .single();

        if (studentData?.tenant_id) {
          const webContentService = getWebSearchContentService();

          // Grounding 메타데이터를 콘텐츠로 변환
          const webContents = webContentService.transformToContent(result.groundingMetadata, {
            tenantId: studentData.tenant_id,
            // 추천 과목 카테고리 기반
            subject: input.subjectCategories?.[0],
          });

          if (webContents.length > 0) {
            const saveResult = await webContentService.saveToDatabase(webContents, studentData.tenant_id);
            webSearchResults.savedCount = saveResult.savedCount;

            logActionDebug(
              "recommendContent",
              `웹 콘텐츠 저장: ${saveResult.savedCount}건 저장, ${saveResult.duplicateCount}건 중복`
            );
          }
        }
      }
    }

    // 7. 응답 파싱
    const parsed = extractJSON<ContentRecommendationResponse>(result.content);

    if (!parsed || !parsed.recommendations) {
      logActionError("recommendContent", `파싱 실패: ${result.content.substring(0, 500)}`);
      return { success: false, error: "추천 결과 파싱에 실패했습니다." };
    }

    // 8. 추천 결과 검증 (contentId가 유효한지 확인)
    const validContentIds = new Set(filteredCandidates.map((c) => c.id));
    const validRecommendations = parsed.recommendations.filter((rec) =>
      validContentIds.has(rec.contentId)
    );

    if (validRecommendations.length === 0) {
      return { success: false, error: "유효한 추천 결과가 없습니다." };
    }

    // 9. 비용 계산
    const estimatedCost = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      modelTier
    );

    // 10. 결과 데이터 구성
    const resultData = {
      recommendations: validRecommendations,
      summary: {
        ...parsed.summary,
        totalRecommended: validRecommendations.length,
      },
      insights: parsed.insights,
      cost: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedUSD: estimatedCost,
      },
      webSearchResults,
    };

    // 11. 캐시 저장 (1일 TTL)
    await cacheRecommendations(input.studentId, input.focusArea, resultData);
    logActionDebug("recommendContent", "결과 캐시 저장 완료");

    return {
      success: true,
      data: resultData,
    };
  } catch (error) {
    logActionError("recommendContent", `오류: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천 생성 중 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 추천 결과 캐싱
// ============================================

// 추천 결과를 1일 캐싱 (LRU 메모리 캐시 사용)
// lib/cache/memoryCache.ts의 llmRecommendationCache 인스턴스 활용

/**
 * 캐시된 추천 결과 조회
 * 1일 TTL 메모리 캐시 사용
 */
export async function getCachedRecommendations(
  studentId: string,
  focusArea?: string
): Promise<RecommendContentResult["data"] | null> {
  const cacheKey = createCacheKey(
    "content-recommendation",
    studentId,
    focusArea ?? "all"
  );
  const cached = llmRecommendationCache.get(cacheKey);
  return cached as RecommendContentResult["data"] | null;
}

/**
 * 추천 결과 캐시 저장
 * 1일 TTL 메모리 캐시 사용
 */
export async function cacheRecommendations(
  studentId: string,
  focusArea: string | undefined,
  data: RecommendContentResult["data"]
): Promise<void> {
  const cacheKey = createCacheKey(
    "content-recommendation",
    studentId,
    focusArea ?? "all"
  );
  llmRecommendationCache.set(cacheKey, data);
}
