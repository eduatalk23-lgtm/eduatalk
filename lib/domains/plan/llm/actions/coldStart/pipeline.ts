/**
 * 콜드 스타트 파이프라인 통합
 *
 * 이 파일은 콜드 스타트 추천의 전체 5단계 파이프라인을 통합합니다.
 *
 * 파이프라인 흐름:
 * Task 1: validateColdStartInputAsync(input) - DB 기반 교과/과목 검증
 *     ↓ 실패 시 → { success: false, failedAt: "validation" }
 * Task 2: buildSearchQuery(validatedInput)
 *     ↓ (항상 성공)
 * Task 3: executeWebSearch(query) 또는 getMockSearchResult(query)
 *     ↓ 실패 시 → { success: false, failedAt: "search" }
 * Task 4: parseSearchResults(rawContent)
 *     ↓ 실패 시 → { success: false, failedAt: "parse" }
 * Task 5: rankAndFilterResults(items, preferences, validatedInput)
 *     ↓ (항상 성공)
 * Task 6: (선택) saveRecommendationsToMasterContent(recommendations)
 *     ↓ 실패 시 → 경고만 (파이프라인은 계속 성공)
 * 성공 → { success: true, recommendations, stats, persistence? }
 *
 * @example
 * // 기본 사용법
 * const result = await runColdStartPipeline({
 *   subjectCategory: "수학",
 *   subject: "미적분",
 *   difficulty: "개념",
 *   contentType: "book"
 * });
 *
 * if (result.success) {
 *   console.log(result.recommendations);
 * } else {
 *   console.error(`${result.failedAt}에서 실패: ${result.error}`);
 * }
 *
 * @example
 * // Mock 모드 (API 호출 없이 테스트)
 * const result = await runColdStartPipeline(
 *   { subjectCategory: "수학" },
 *   { useMock: true }
 * );
 *
 * @example
 * // DB 저장 모드
 * const result = await runColdStartPipeline(
 *   { subjectCategory: "수학", subject: "미적분" },
 *   {
 *     saveToDb: true,
 *     tenantId: null,  // 공유 카탈로그
 *   }
 * );
 *
 * if (result.success && result.persistence) {
 *   console.log(`새로 저장: ${result.persistence.newlySaved}개`);
 *   console.log(`중복 스킵: ${result.persistence.duplicatesSkipped}개`);
 * }
 */

import type {
  ColdStartRawInput,
  UserPreferences,
  ColdStartPipelineResult,
  PersistenceStats,
} from "./types";

import { validateColdStartInputAsync } from "./validateInput";
import { buildSearchQuery } from "./buildQuery";
import { executeWebSearch, getMockSearchResult } from "./executeSearch";
import { parseSearchResults } from "./parseResults";
import { rankAndFilterResults } from "./rankResults";
import { saveRecommendationsToMasterContent } from "./persistence";
import { MetricsBuilder, logRecommendationError } from "../../metrics";
import { logActionWarn } from "@/lib/utils/serverActionLogger";
import { getWebSearchContentService } from "../../services";

/**
 * Rate limit 관련 에러인지 확인
 */
function isRateLimitError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes("429") ||
    lowerError.includes("quota") ||
    lowerError.includes("rate limit") ||
    lowerError.includes("한도") ||
    lowerError.includes("too many requests")
  );
}

/**
 * 파이프라인 옵션
 */
export interface ColdStartPipelineOptions {
  /** 사용자 선호도 (필터링/정렬에 사용) */
  preferences?: UserPreferences;

  /** Mock 모드 사용 여부 (기본: false) */
  useMock?: boolean;

  /** DB 저장 여부 (기본: false) */
  saveToDb?: boolean;

  /** 테넌트 ID (null = 공유 카탈로그) */
  tenantId?: string | null;

  /** Rate limit 시 DB 캐시 fallback 사용 (기본: true) */
  enableFallback?: boolean;
}

/**
 * 콜드 스타트 추천 파이프라인을 실행합니다.
 *
 * 학생 데이터가 없는 상태에서 교과/과목/난이도를 입력받아
 * 웹 검색을 통해 적절한 학습 콘텐츠를 추천합니다.
 *
 * @param input - 사용자가 입력한 검색 조건
 * @param options - 파이프라인 옵션
 * @returns 파이프라인 실행 결과
 *
 * @example
 * // 성공 케이스
 * const result = await runColdStartPipeline({
 *   subjectCategory: "수학",
 *   subject: "미적분",
 *   difficulty: "개념",
 *   contentType: "book"
 * });
 *
 * if (result.success) {
 *   result.recommendations.forEach(rec => {
 *     console.log(`${rec.rank}. ${rec.title} (점수: ${rec.matchScore})`);
 *   });
 * }
 *
 * @example
 * // 실패 케이스 처리
 * const result = await runColdStartPipeline({ subjectCategory: "" });
 *
 * if (!result.success) {
 *   switch (result.failedAt) {
 *     case "validation":
 *       console.error("입력값이 올바르지 않습니다");
 *       break;
 *     case "search":
 *       console.error("검색에 실패했습니다");
 *       break;
 *     case "parse":
 *       console.error("검색 결과를 처리하지 못했습니다");
 *       break;
 *   }
 * }
 */
export async function runColdStartPipeline(
  input: ColdStartRawInput,
  options?: ColdStartPipelineOptions
): Promise<ColdStartPipelineResult> {
  // 메트릭스 빌더 초기화
  const metricsBuilder = MetricsBuilder.create("coldStartPipeline")
    .setContext({ tenantId: options?.tenantId ?? undefined })
    .setRequestParams({
      subjectCategory: input.subjectCategory,
      subject: input.subject,
      contentType: input.contentType,
    });

  const {
    preferences = {},
    useMock = false,
    saveToDb = false,
    tenantId,
    enableFallback = true,
  } = options ?? {};

  // ────────────────────────────────────────────────────────────────────
  // Task 1: 입력 검증 (DB 기반, fallback: 하드코딩)
  // ────────────────────────────────────────────────────────────────────

  const validationResult = await validateColdStartInputAsync(input);

  if (!validationResult.success) {
    logRecommendationError("coldStartPipeline", validationResult.error, {
      stage: "validation",
      strategy: "coldStart",
    });

    return {
      success: false,
      error: validationResult.error,
      failedAt: "validation",
    };
  }

  const validatedInput = validationResult.validatedInput;

  // ────────────────────────────────────────────────────────────────────
  // Task 2: 검색 쿼리 생성
  // ────────────────────────────────────────────────────────────────────

  const searchQuery = buildSearchQuery(validatedInput);

  // ────────────────────────────────────────────────────────────────────
  // Task 3: 웹 검색 실행 (또는 Mock)
  // ────────────────────────────────────────────────────────────────────

  const searchResult = useMock
    ? getMockSearchResult(searchQuery)
    : await executeWebSearch(searchQuery);

  // Rate limit 발생 시 DB 캐시 fallback 시도
  if (!searchResult.success) {
    const isRateLimit = isRateLimitError(searchResult.error);

    // Rate limit이고 fallback이 활성화된 경우 DB에서 기존 콘텐츠 조회
    if (isRateLimit && enableFallback) {
      logActionWarn(
        "coldStartPipeline",
        `Rate limit 발생, DB fallback 시도: ${searchResult.error}`
      );

      const webContentService = getWebSearchContentService();
      const cachedContent = await webContentService.findExistingWebContent(
        tenantId ?? null,
        {
          subjectCategory: validatedInput.subjectCategory,
          subject: validatedInput.subject ?? undefined,
          difficulty: validatedInput.difficulty ?? undefined,
          contentType: validatedInput.contentType ?? "all",
          includeSharedCatalog: true,
          limit: 10,
        }
      );

      if (cachedContent.length > 0) {
        logActionWarn(
          "coldStartPipeline",
          `DB fallback 성공: ${cachedContent.length}개 캐시된 콘텐츠 반환`
        );

        // 캐시된 콘텐츠를 RecommendationItem 형태로 변환
        const fallbackRecommendations = cachedContent.map((item, index) => ({
          title: item.title,
          contentType: item.contentType,
          totalRange: item.totalRange ?? 0,
          author: undefined,
          publisher: undefined,
          reason: "이전에 저장된 추천 콘텐츠입니다.",
          matchScore: 70 - index * 5, // 순서대로 점수 감소
          rank: index + 1,
          chapters: [],
        }));

        // 메트릭스 로깅 (fallback 사용)
        metricsBuilder
          .setRecommendation({
            count: fallbackRecommendations.length,
            strategy: "coldStart",
            usedFallback: true,
          })
          .setWebSearch({
            enabled: !useMock,
            queriesCount: 1,
            resultsCount: 0,
            rateLimitHit: true,
          })
          .log();

        return {
          success: true,
          recommendations: fallbackRecommendations,
          stats: {
            totalFound: cachedContent.length,
            filtered: 0,
            searchQuery: searchQuery.query,
            usedFallback: true,
          },
        };
      }

      // fallback도 실패한 경우
      logActionWarn(
        "coldStartPipeline",
        "DB fallback 실패: 캐시된 콘텐츠 없음"
      );
    }

    logRecommendationError("coldStartPipeline", searchResult.error, {
      stage: "search",
      strategy: "coldStart",
    });

    return {
      success: false,
      error: searchResult.error,
      failedAt: "search",
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Task 4: 결과 파싱
  // ────────────────────────────────────────────────────────────────────

  const parseResult = parseSearchResults(searchResult.rawContent);

  // Parse 실패 시 DB fallback 시도
  if (!parseResult.success && enableFallback) {
    logActionWarn(
      "coldStartPipeline",
      `Parse 실패, DB fallback 시도: ${parseResult.error}`
    );

    const webContentService = getWebSearchContentService();
    const cachedContent = await webContentService.findExistingWebContent(
      tenantId ?? null,
      {
        subjectCategory: validatedInput.subjectCategory,
        subject: validatedInput.subject ?? undefined,
        difficulty: validatedInput.difficulty ?? undefined,
        contentType: validatedInput.contentType ?? "all",
        includeSharedCatalog: true,
        limit: 10,
      }
    );

    if (cachedContent.length > 0) {
      logActionWarn(
        "coldStartPipeline",
        `DB fallback 성공 (parse 실패 후): ${cachedContent.length}개 캐시된 콘텐츠 반환`
      );

      // 캐시된 콘텐츠를 RecommendationItem 형태로 변환
      const fallbackRecommendations = cachedContent.map((item, index) => ({
        title: item.title,
        contentType: item.contentType,
        totalRange: item.totalRange ?? 0,
        author: undefined,
        publisher: undefined,
        reason: "이전에 저장된 추천 콘텐츠입니다.",
        matchScore: 70 - index * 5, // 순서대로 점수 감소
        rank: index + 1,
        chapters: [],
      }));

      // 메트릭스 로깅 (fallback 사용)
      metricsBuilder
        .setRecommendation({
          count: fallbackRecommendations.length,
          strategy: "coldStart",
          usedFallback: true,
        })
        .setWebSearch({
          enabled: !useMock,
          queriesCount: 1,
          resultsCount: 0,
        })
        .log();

      return {
        success: true,
        recommendations: fallbackRecommendations,
        stats: {
          totalFound: cachedContent.length,
          filtered: 0,
          searchQuery: searchQuery.query,
          usedFallback: true,
          fallbackReason: "parse_failure",
        },
      };
    }

    // Parse fallback도 실패한 경우
    logActionWarn(
      "coldStartPipeline",
      "DB fallback 실패 (parse 실패 후): 캐시된 콘텐츠 없음"
    );
  }

  if (!parseResult.success) {
    logRecommendationError("coldStartPipeline", parseResult.error, {
      stage: "parse",
      strategy: "coldStart",
    });

    return {
      success: false,
      error: parseResult.error,
      failedAt: "parse",
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Task 5: 결과 정렬 및 필터링
  // ────────────────────────────────────────────────────────────────────

  const rankResult = rankAndFilterResults(
    parseResult.items,
    preferences,
    validatedInput
  );

  // ────────────────────────────────────────────────────────────────────
  // Task 6: DB 저장 (선택적)
  // ────────────────────────────────────────────────────────────────────

  let persistence: PersistenceStats | undefined;

  if (saveToDb && rankResult.recommendations.length > 0) {
    const saveResult = await saveRecommendationsToMasterContent(
      rankResult.recommendations,
      {
        tenantId: tenantId ?? null,
        subjectCategory: validatedInput.subjectCategory,
        subject: validatedInput.subject ?? undefined,
        difficultyLevel: validatedInput.difficulty ?? undefined,
      }
    );

    persistence = {
      newlySaved: saveResult.savedItems.filter((i) => i.isNew).length,
      duplicatesSkipped: saveResult.skippedDuplicates,
      savedIds: saveResult.savedItems.map((i) => i.id),
      errors: saveResult.errors,
    };

    // 새로 저장된 콘텐츠가 있으면 캐시 무효화
    if (persistence.newlySaved > 0) {
      const webContentService = getWebSearchContentService();
      webContentService.invalidateCache(
        tenantId ?? null,
        validatedInput.subjectCategory
      );
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // 최종 결과 반환
  // ────────────────────────────────────────────────────────────────────

  // 성공 메트릭스 로깅
  metricsBuilder
    .setRecommendation({
      count: rankResult.recommendations.length,
      strategy: "coldStart",
      usedFallback: false,
    })
    .setWebSearch({
      enabled: !useMock,
      queriesCount: 1,
      resultsCount: rankResult.totalFound,
      savedCount: persistence?.newlySaved,
    })
    .log();

  return {
    success: true,
    recommendations: rankResult.recommendations,
    stats: {
      totalFound: rankResult.totalFound,
      filtered: rankResult.filtered,
      searchQuery: searchQuery.query,
    },
    persistence,
  };
}
