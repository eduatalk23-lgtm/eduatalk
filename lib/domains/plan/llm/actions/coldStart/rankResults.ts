/**
 * Task 5: 결과 정렬 및 필터링
 *
 * 이 파일은 파싱된 콘텐츠를 사용자 조건에 맞게 정렬하고 필터링합니다.
 *
 * 📥 INPUT:  파싱된 콘텐츠 목록 (Task 4의 결과)
 * 📤 OUTPUT: 정렬/필터링된 추천 목록 (RecommendationItem[])
 *
 * 점수 계산 (100점 만점):
 * - 콘텐츠 타입 일치: +30점
 * - 목차 완성도 (2개 이상): +25점
 * - totalRange 유효: +20점
 * - 제목 키워드 매칭: +15점
 * - 메타 정보 존재: +10점
 */

import type {
  ParsedContentItem,
  UserPreferences,
  ValidatedColdStartInput,
  RankResultsResult,
  RecommendationItem,
} from "./types";

/**
 * 파싱된 결과를 점수화하고 정렬/필터링합니다.
 *
 * @param items - 파싱된 콘텐츠 목록
 * @param preferences - 사용자 선호도 설정
 * @param input - 검증된 입력값 (키워드 매칭에 사용)
 * @returns 정렬된 추천 결과
 *
 * @example
 * const result = rankAndFilterResults(
 *   parsedItems,
 *   { contentType: "book", maxResults: 5 },
 *   validatedInput
 * );
 *
 * console.log(result.recommendations[0].rank); // 1
 * console.log(result.recommendations[0].matchScore); // 85
 */
export function rankAndFilterResults(
  items: ParsedContentItem[],
  preferences: UserPreferences,
  input: ValidatedColdStartInput
): RankResultsResult {
  const totalFound = items.length;

  // ────────────────────────────────────────────────────────────────────
  // 1단계: 빈 배열 처리
  // ────────────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return {
      success: true,
      recommendations: [],
      totalFound: 0,
      filtered: 0,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // 2단계: 콘텐츠 타입 필터링
  // ────────────────────────────────────────────────────────────────────

  let filteredItems = items;

  if (preferences.contentType) {
    filteredItems = items.filter(
      (item) => item.contentType === preferences.contentType
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // 3단계: 점수 계산 및 정렬
  // ────────────────────────────────────────────────────────────────────

  const scoredItems = filteredItems.map((item) => ({
    item,
    score: calculateMatchScore(item, preferences, input),
  }));

  // 점수 높은 순 정렬, 동점 시 제목 알파벳 순
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.item.title.localeCompare(b.item.title, "ko");
  });

  // ────────────────────────────────────────────────────────────────────
  // 4단계: 최대 결과 수 제한
  // ────────────────────────────────────────────────────────────────────

  const maxResults = preferences.maxResults ?? 5;
  const limitedItems = scoredItems.slice(0, maxResults);

  // ────────────────────────────────────────────────────────────────────
  // 5단계: RecommendationItem으로 변환
  // ────────────────────────────────────────────────────────────────────

  const recommendations: RecommendationItem[] = limitedItems.map(
    ({ item, score }, index) => ({
      ...item,
      rank: index + 1,
      matchScore: score,
      reason: generateReason(score),
    })
  );

  return {
    success: true,
    recommendations,
    totalFound,
    filtered: recommendations.length,
  };
}

// ============================================================================
// 내부 헬퍼 함수들
// ============================================================================

/**
 * 아이템의 매칭 점수를 계산합니다.
 *
 * 점수 기준 (100점 만점):
 * - 콘텐츠 타입 일치: +30점
 * - 목차 완성도 (2개 이상): +25점
 * - totalRange 유효: +20점
 * - 제목 키워드 매칭: +15점
 * - 메타 정보 존재: +10점
 *
 * @param item - 파싱된 콘텐츠 아이템
 * @param preferences - 사용자 선호도
 * @param input - 검증된 입력값
 * @returns 0-100 사이의 점수
 */
function calculateMatchScore(
  item: ParsedContentItem,
  preferences: UserPreferences,
  input: ValidatedColdStartInput
): number {
  let score = 0;

  // ────────────────────────────────────────────────────────────────────
  // 1. 콘텐츠 타입 일치: +30점
  // ────────────────────────────────────────────────────────────────────

  // 사용자가 선호 타입을 지정했고, 그 타입과 일치하면 +30점
  // 선호 타입이 없으면 입력된 contentType과 비교
  const preferredType = preferences.contentType ?? input.contentType;
  if (preferredType && item.contentType === preferredType) {
    score += 30;
  } else if (!preferredType) {
    // 선호도가 없으면 기본 점수 부여
    score += 15;
  }

  // ────────────────────────────────────────────────────────────────────
  // 2. 목차 완성도: +25점
  // ────────────────────────────────────────────────────────────────────

  if (item.chapters.length >= 2) {
    score += 25;
  } else if (item.chapters.length === 1) {
    // 1개의 챕터라도 있으면 부분 점수
    score += 10;
  }

  // ────────────────────────────────────────────────────────────────────
  // 3. totalRange 유효: +20점
  // ────────────────────────────────────────────────────────────────────

  if (item.totalRange > 0) {
    score += 20;
  }

  // ────────────────────────────────────────────────────────────────────
  // 4. 제목 키워드 매칭: +15점
  // ────────────────────────────────────────────────────────────────────

  const titleLower = item.title.toLowerCase();
  const subjectCategoryLower = input.subjectCategory.toLowerCase();

  // subject 또는 subjectCategory가 제목에 포함되어 있으면 +15점
  if (input.subject && titleLower.includes(input.subject.toLowerCase())) {
    score += 15;
  } else if (titleLower.includes(subjectCategoryLower)) {
    score += 15;
  }

  // ────────────────────────────────────────────────────────────────────
  // 5. 메타 정보 존재: +10점
  // ────────────────────────────────────────────────────────────────────

  if (item.author || item.publisher) {
    score += 10;
  }

  // 점수 상한 제한
  return Math.min(score, 100);
}

/**
 * 점수에 따른 추천 이유를 생성합니다.
 *
 * @param score - 매칭 점수 (0-100)
 * @returns 추천 이유 메시지
 */
function generateReason(score: number): string {
  if (score >= 90) {
    return "추천 조건에 가장 적합한 콘텐츠입니다";
  }

  if (score >= 70) {
    return "교과 및 난이도가 일치합니다";
  }

  if (score >= 50) {
    return "관련 콘텐츠입니다";
  }

  return "참고용 콘텐츠입니다";
}
