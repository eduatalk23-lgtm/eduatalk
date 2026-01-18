/**
 * 콜드 스타트 파이프라인 통합
 *
 * 이 파일은 콜드 스타트 추천의 전체 5단계 파이프라인을 통합합니다.
 *
 * 파이프라인 흐름:
 * Task 1: validateColdStartInput(input)
 *     ↓ 실패 시 → { success: false, failedAt: "validation" }
 * Task 2: buildSearchQuery(validatedInput)
 *     ↓ (항상 성공)
 * Task 3: executeWebSearch(query) 또는 getMockSearchResult(query)
 *     ↓ 실패 시 → { success: false, failedAt: "search" }
 * Task 4: parseSearchResults(rawContent)
 *     ↓ 실패 시 → { success: false, failedAt: "parse" }
 * Task 5: rankAndFilterResults(items, preferences, validatedInput)
 *     ↓ (항상 성공)
 * 성공 → { success: true, recommendations, stats }
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
 */

import type {
  ColdStartRawInput,
  UserPreferences,
  ColdStartPipelineResult,
} from "./types";

import { validateColdStartInput } from "./validateInput";
import { buildSearchQuery } from "./buildQuery";
import { executeWebSearch, getMockSearchResult } from "./executeSearch";
import { parseSearchResults } from "./parseResults";
import { rankAndFilterResults } from "./rankResults";

/**
 * 파이프라인 옵션
 */
export interface ColdStartPipelineOptions {
  /** 사용자 선호도 (필터링/정렬에 사용) */
  preferences?: UserPreferences;

  /** Mock 모드 사용 여부 (기본: false) */
  useMock?: boolean;
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
  const { preferences = {}, useMock = false } = options ?? {};

  // ────────────────────────────────────────────────────────────────────
  // Task 1: 입력 검증
  // ────────────────────────────────────────────────────────────────────

  const validationResult = validateColdStartInput(input);

  if (!validationResult.success) {
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

  if (!searchResult.success) {
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

  if (!parseResult.success) {
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
  // 최종 결과 반환
  // ────────────────────────────────────────────────────────────────────

  return {
    success: true,
    recommendations: rankResult.recommendations,
    stats: {
      totalFound: rankResult.totalFound,
      filtered: rankResult.filtered,
      searchQuery: searchQuery.query,
    },
  };
}
