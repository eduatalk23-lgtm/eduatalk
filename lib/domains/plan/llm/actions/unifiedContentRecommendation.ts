"use server";

/**
 * 통합 콘텐츠 추천 서버 액션
 *
 * 학생 데이터 유무에 따라 적절한 추천 전략을 자동 선택합니다:
 * 1. 캐시: 기존 저장된 콘텐츠 활용
 * 2. 추천: 학생 데이터 기반 AI 추천 (recommendContent)
 * 3. 콜드 스타트: 웹 검색 기반 추천 (coldStartPipeline)
 *
 * @module unifiedContentRecommendation
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logActionDebug, logActionError } from "@/lib/utils/serverActionLogger";

import { getWebSearchContentService } from "../services/webSearchContentService";
import type {
  FindExistingContentOptions,
  ExistingContentItem,
} from "../services/webSearchContentService";

import {
  runColdStartPipeline,
  type ColdStartPipelineResult,
  type RecommendationItem,
} from "./coldStart";

import type { ChapterInfo } from "../services/contentStructureUtils";

// ============================================
// 타입 정의
// ============================================

/**
 * 통합 추천 입력
 */
export interface UnifiedRecommendInput {
  /** 학생 ID (선택 - 콜드 스타트 시 불필요) */
  studentId?: string;

  /** 테넌트 ID */
  tenantId: string;

  /** 교과 (필수) - 수학, 영어 등 */
  subjectCategory: string;

  /** 과목 (선택) - 미적분, 영어독해 등 */
  subject?: string;

  /** 난이도 (선택) - 개념, 기본, 심화 */
  difficultyLevel?: string;

  /** 콘텐츠 타입 */
  contentType?: "book" | "lecture" | "all";

  /** 최대 결과 개수 (기본: 5) */
  maxResults?: number;

  /** 캐시 사용 여부 (기본: true) */
  useCache?: boolean;

  /** 강제 콜드 스타트 (기본: false) */
  forceColdStart?: boolean;

  /** 결과 DB 저장 여부 (기본: true) */
  saveResults?: boolean;
}

/**
 * 추천된 콘텐츠 아이템
 */
export interface RecommendedContent {
  /** 콘텐츠 ID (master_books/lectures) */
  id: string;

  /** 제목 */
  title: string;

  /** 콘텐츠 타입 */
  contentType: "book" | "lecture";

  /** 총 범위 (페이지 수 또는 에피소드 수) */
  totalRange: number | null;

  /** 챕터/에피소드 목록 */
  chapters?: ChapterInfo[];

  /** 저자/강사 */
  author?: string;

  /** 출판사/플랫폼 */
  publisher?: string;

  /** 난이도 */
  difficultyLevel?: string;

  /** 일치도 점수 (0-100) */
  matchScore?: number;

  /** 추천 이유 */
  reason?: string;

  /** 데이터 출처 */
  source: "cache" | "recommend" | "cold_start";
}

/**
 * 추천 전략
 */
export type RecommendationStrategy = "cache" | "recommend" | "coldStart";

/**
 * 통합 추천 결과
 */
export interface UnifiedRecommendResult {
  success: boolean;

  /** 사용된 전략 */
  strategy?: RecommendationStrategy;

  /** 추천 결과 */
  recommendations?: RecommendedContent[];

  /** 통계 */
  stats?: {
    fromCache: number;
    fromWebSearch: number;
    newlySaved: number;
  };

  /** 에러 메시지 */
  error?: string;
}

// ============================================
// 내부 헬퍼 함수
// ============================================

/**
 * 학생 데이터 가용성 확인
 */
async function checkStudentDataAvailability(
  studentId: string
): Promise<{ hasScores: boolean; hasLearningHistory: boolean }> {
  const supabase = await createSupabaseServerClient();

  // 성적 데이터 확인
  const { count: scoreCount } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  // 학습 이력 확인 (완료된 플랜)
  const { count: historyCount } = await supabase
    .from("student_plans")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("is_completed", true);

  return {
    hasScores: (scoreCount ?? 0) > 0,
    hasLearningHistory: (historyCount ?? 0) > 0,
  };
}

/**
 * ExistingContentItem을 RecommendedContent로 변환
 */
function mapExistingToRecommended(
  item: ExistingContentItem
): RecommendedContent {
  return {
    id: item.id,
    title: item.title,
    contentType: item.contentType,
    totalRange: item.totalRange,
    difficultyLevel: item.difficultyLevel ?? undefined,
    source: "cache",
  };
}

/**
 * RecommendationItem(콜드 스타트)을 RecommendedContent로 변환
 */
function mapColdStartToRecommended(
  item: RecommendationItem,
  savedId?: string
): RecommendedContent {
  return {
    id: savedId ?? `temp-${item.rank}`,
    title: item.title,
    contentType: item.contentType,
    totalRange: item.totalRange,
    chapters: item.chapters,
    author: item.author,
    publisher: item.publisher,
    matchScore: item.matchScore,
    reason: item.reason,
    source: "cold_start",
  };
}

// ============================================
// 메인 액션
// ============================================

/**
 * 통합 콘텐츠 추천을 실행합니다.
 *
 * 처리 과정:
 * 1. 입력 검증
 * 2. 캐시 확인 (useCache=true인 경우)
 * 3. 학생 데이터 확인 (studentId 제공 시)
 * 4. 전략 선택 (cache/recommend/coldStart)
 * 5. 추천 실행
 * 6. 결과 DB 저장 (saveResults=true인 경우)
 * 7. 통합 결과 반환
 *
 * @param input - 추천 입력
 * @returns 추천 결과
 *
 * @example
 * ```typescript
 * // 기본 사용 (자동 전략 선택)
 * const result = await getUnifiedContentRecommendation({
 *   tenantId: 'tenant-uuid',
 *   subjectCategory: '수학',
 *   maxResults: 5,
 * });
 *
 * // 강제 콜드 스타트
 * const result = await getUnifiedContentRecommendation({
 *   tenantId: 'tenant-uuid',
 *   subjectCategory: '수학',
 *   subject: '미적분',
 *   forceColdStart: true,
 * });
 * ```
 */
export async function getUnifiedContentRecommendation(
  input: UnifiedRecommendInput
): Promise<UnifiedRecommendResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 기본값 설정
  const {
    tenantId,
    subjectCategory,
    subject,
    difficultyLevel,
    contentType = "all",
    maxResults = 5,
    useCache = true,
    forceColdStart = false,
    saveResults = true,
    studentId,
  } = input;

  // 필수 입력 검증
  if (!tenantId) {
    return { success: false, error: "테넌트 ID가 필요합니다." };
  }

  if (!subjectCategory) {
    return { success: false, error: "교과를 선택해주세요." };
  }

  try {
    const webContentService = getWebSearchContentService();
    const stats = {
      fromCache: 0,
      fromWebSearch: 0,
      newlySaved: 0,
    };

    // ────────────────────────────────────────────────────────────────────
    // Step 1: 캐시 확인 (기존 저장된 콘텐츠)
    // ────────────────────────────────────────────────────────────────────

    if (useCache && !forceColdStart) {
      logActionDebug("unifiedRecommend", "캐시 확인 중...");

      const cacheOptions: FindExistingContentOptions = {
        subjectCategory,
        subject,
        difficulty: difficultyLevel,
        contentType: contentType === "all" ? undefined : contentType,
        hasStructure: true, // 구조 정보 있는 것만
        includeSharedCatalog: true,
        limit: maxResults,
      };

      const existingContent = await webContentService.findExistingWebContent(
        tenantId,
        cacheOptions
      );

      if (existingContent.length >= maxResults) {
        logActionDebug(
          "unifiedRecommend",
          `캐시 히트: ${existingContent.length}개`
        );

        stats.fromCache = existingContent.length;

        return {
          success: true,
          strategy: "cache",
          recommendations: existingContent.map(mapExistingToRecommended),
          stats,
        };
      }

      // 일부 캐시 결과가 있으면 부족분만 추가 검색
      if (existingContent.length > 0) {
        stats.fromCache = existingContent.length;
        logActionDebug(
          "unifiedRecommend",
          `부분 캐시 히트: ${existingContent.length}개 (추가 검색 필요)`
        );
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // Step 2: 전략 선택
    // ────────────────────────────────────────────────────────────────────

    let strategy: RecommendationStrategy = "coldStart";

    if (!forceColdStart && studentId) {
      const dataAvailability = await checkStudentDataAvailability(studentId);

      if (dataAvailability.hasScores && dataAvailability.hasLearningHistory) {
        // 충분한 데이터 → 기존 추천 시스템 사용 가능
        // TODO: recommendContentWithAI 연동 (현재는 콜드 스타트로 fallback)
        logActionDebug(
          "unifiedRecommend",
          "학생 데이터 있음 (현재 콜드 스타트로 처리)"
        );
        strategy = "coldStart";
      } else {
        logActionDebug("unifiedRecommend", "학생 데이터 부족 → 콜드 스타트");
        strategy = "coldStart";
      }
    } else if (forceColdStart) {
      logActionDebug("unifiedRecommend", "강제 콜드 스타트 모드");
      strategy = "coldStart";
    } else {
      logActionDebug("unifiedRecommend", "학생 ID 없음 → 콜드 스타트");
      strategy = "coldStart";
    }

    // ────────────────────────────────────────────────────────────────────
    // Step 3: 콜드 스타트 실행
    // ────────────────────────────────────────────────────────────────────

    const neededCount = maxResults - stats.fromCache;

    const coldStartResult = await runColdStartPipeline(
      {
        subjectCategory,
        subject,
        difficulty: difficultyLevel,
        contentType: contentType === "all" ? undefined : contentType,
      },
      {
        preferences: {
          maxResults: neededCount,
          contentType: contentType === "all" ? undefined : contentType,
        },
        saveToDb: saveResults,
        tenantId: saveResults ? null : undefined, // 공유 카탈로그에 저장
      }
    );

    if (!coldStartResult.success) {
      logActionError(
        "unifiedRecommend",
        `콜드 스타트 실패: ${coldStartResult.error} (at ${coldStartResult.failedAt})`
      );

      // 캐시 결과라도 반환
      if (stats.fromCache > 0) {
        const existingContent = await webContentService.findExistingWebContent(
          tenantId,
          {
            subjectCategory,
            subject,
            difficulty: difficultyLevel,
            hasStructure: true,
            includeSharedCatalog: true,
            limit: maxResults,
          }
        );

        return {
          success: true,
          strategy: "cache",
          recommendations: existingContent.map(mapExistingToRecommended),
          stats,
        };
      }

      return {
        success: false,
        error: coldStartResult.error,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // Step 4: 결과 변환 및 반환
    // ────────────────────────────────────────────────────────────────────

    stats.fromWebSearch = coldStartResult.recommendations.length;

    if (coldStartResult.persistence) {
      stats.newlySaved = coldStartResult.persistence.newlySaved;
    }

    // 저장된 ID와 매핑
    const savedIds = coldStartResult.persistence?.savedIds ?? [];

    const recommendations: RecommendedContent[] =
      coldStartResult.recommendations.map((item, index) =>
        mapColdStartToRecommended(item, savedIds[index])
      );

    // 캐시 결과와 병합 (캐시 우선)
    if (stats.fromCache > 0) {
      const existingContent = await webContentService.findExistingWebContent(
        tenantId,
        {
          subjectCategory,
          subject,
          difficulty: difficultyLevel,
          hasStructure: true,
          includeSharedCatalog: true,
          limit: stats.fromCache,
        }
      );

      const cachedRecommendations = existingContent.map(mapExistingToRecommended);
      recommendations.unshift(...cachedRecommendations);
    }

    logActionDebug(
      "unifiedRecommend",
      `완료: ${recommendations.length}개 (캐시: ${stats.fromCache}, 웹검색: ${stats.fromWebSearch}, 저장: ${stats.newlySaved})`
    );

    return {
      success: true,
      strategy,
      recommendations: recommendations.slice(0, maxResults),
      stats,
    };
  } catch (error) {
    logActionError(
      "unifiedRecommend",
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "콘텐츠 추천 중 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 헬퍼 함수 (UI 통합용) - Server Action이므로 async 필수
// ============================================

/**
 * 콜드 스타트 사용 가능 여부 확인
 *
 * @param plannerId - 플래너 ID
 * @param tenantId - 테넌트 ID
 * @param subjectCategory - 교과
 * @returns 사용 가능 여부 및 사유
 */
export async function canUseColdStart(
  plannerId: string | undefined,
  tenantId: string | undefined,
  subjectCategory: string | undefined
): Promise<{ allowed: boolean; reason?: string }> {
  if (!plannerId) {
    return { allowed: false, reason: "플래너를 먼저 선택해주세요" };
  }

  if (!tenantId) {
    return { allowed: false, reason: "테넌트 정보가 없습니다" };
  }

  if (!subjectCategory) {
    return { allowed: false, reason: "교과를 선택해주세요" };
  }

  return { allowed: true };
}

/**
 * 추천 결과를 plan_contents 형식으로 변환
 * Server Action 파일이므로 async 함수로 선언
 *
 * @param recommendation - 추천 콘텐츠
 * @returns PlanContent 호환 객체
 */
export async function convertToPlanContent(recommendation: RecommendedContent): Promise<{
  content_id: string;
  content_type: "book" | "lecture";
  master_content_id: string;
  start_range: number;
  end_range: number;
  is_auto_recommended: boolean;
  recommendation_source: string;
  recommendation_reason?: string;
  recommendation_metadata?: Record<string, unknown>;
}> {
  return {
    content_id: recommendation.id,
    content_type: recommendation.contentType,
    master_content_id: recommendation.id, // 콜드 스타트 콘텐츠는 자기 자신
    start_range: 1,
    end_range: recommendation.totalRange || 1,
    is_auto_recommended: true,
    recommendation_source: recommendation.source,
    recommendation_reason: recommendation.reason,
    recommendation_metadata: {
      matchScore: recommendation.matchScore,
      chapters: recommendation.chapters,
      author: recommendation.author,
      publisher: recommendation.publisher,
    },
  };
}
