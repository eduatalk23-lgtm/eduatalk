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
  RecommendationMetadata,
  RecommendationReason,
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
      reason: generateReason(score, item),
      recommendationMetadata: buildRecommendationMetadata(item, score, input),
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
 * 점수와 콘텐츠 정보에 따른 추천 이유를 생성합니다.
 *
 * @param score - 매칭 점수 (0-100)
 * @param item - 파싱된 콘텐츠 아이템
 * @returns 추천 이유 메시지
 */
function generateReason(score: number, item: ParsedContentItem): string {
  // AI가 제공한 추천 이유가 있으면 첫 번째 이유 사용
  if (item.recommendationReasons && item.recommendationReasons.length > 0) {
    return item.recommendationReasons[0];
  }

  // 점수 기반 기본 메시지
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

/**
 * 추천 메타데이터를 생성합니다.
 *
 * AI 검색 결과와 점수 정보를 조합하여 DB 저장용 메타데이터를 생성합니다.
 *
 * @param item - 파싱된 콘텐츠 아이템
 * @param score - 매칭 점수
 * @param input - 검증된 입력값
 * @returns 추천 메타데이터
 */
function buildRecommendationMetadata(
  item: ParsedContentItem,
  score: number,
  input: ValidatedColdStartInput
): RecommendationMetadata {
  // 추천 이유 목록 생성
  const reasons: RecommendationReason[] = [];

  // AI가 제공한 추천 이유 추가
  if (item.recommendationReasons && item.recommendationReasons.length > 0) {
    item.recommendationReasons.forEach((reasonText, index) => {
      reasons.push({
        category: inferReasonCategory(reasonText),
        text: reasonText,
        confidence: Math.max(0.5, 1 - index * 0.1), // 첫 번째가 가장 신뢰도 높음
      });
    });
  }

  // 점수 기반 추가 이유
  if (item.chapters.length >= 2) {
    reasons.push({
      category: "structure",
      text: "체계적인 목차 구성으로 학습 계획 수립에 용이",
      confidence: 0.8,
    });
  }

  if (item.reviewSummary?.averageRating && item.reviewSummary.averageRating >= 4.0) {
    reasons.push({
      category: "popularity",
      text: `평균 평점 ${item.reviewSummary.averageRating}점의 높은 만족도`,
      confidence: 0.9,
    });
  }

  // 추천 요약 생성
  const summary = generateRecommendationSummary(item, score, input);

  // 대상 학생 목록
  const targetStudents = item.targetStudents && item.targetStudents.length > 0
    ? item.targetStudents
    : inferTargetStudents(input);

  // 데이터 소스 목록
  const sources: string[] = ["웹 검색"];
  if (item.reviewSummary?.averageRating) {
    sources.push("온라인 리뷰");
  }

  return {
    recommendation: {
      score,
      summary,
      reasons,
      targetStudents,
    },
    reviews: item.reviewSummary,
    characteristics: {
      strengths: item.strengths,
      weaknesses: item.weaknesses,
    },
    meta: {
      collectedAt: new Date().toISOString(),
      sources,
      reliability: calculateReliability(item),
    },
  };
}

/**
 * 추천 이유 텍스트에서 카테고리를 추론합니다.
 */
function inferReasonCategory(reasonText: string): RecommendationReason["category"] {
  const lowerText = reasonText.toLowerCase();

  // 품질 관련 키워드
  if (
    lowerText.includes("설명") ||
    lowerText.includes("이해") ||
    lowerText.includes("쉬") ||
    lowerText.includes("명확")
  ) {
    return "quality";
  }

  // 인기/평판 관련 키워드
  if (
    lowerText.includes("인기") ||
    lowerText.includes("평점") ||
    lowerText.includes("후기") ||
    lowerText.includes("추천")
  ) {
    return "popularity";
  }

  // 구조 관련 키워드
  if (
    lowerText.includes("목차") ||
    lowerText.includes("구성") ||
    lowerText.includes("체계") ||
    lowerText.includes("단계")
  ) {
    return "structure";
  }

  // 적합성 관련 키워드 (기본값)
  return "suitability";
}

/**
 * 추천 요약 메시지를 생성합니다.
 */
function generateRecommendationSummary(
  item: ParsedContentItem,
  score: number,
  input: ValidatedColdStartInput
): string {
  const parts: string[] = [];

  // 과목 정보
  const subjectInfo = input.subject || input.subjectCategory;
  parts.push(subjectInfo);

  // 난이도 정보
  if (input.difficulty) {
    parts.push(input.difficulty);
  }

  // 콘텐츠 타입
  const typeLabel = item.contentType === "book" ? "학습서" : "강의";
  parts.push(typeLabel);

  // 점수 기반 수식어
  if (score >= 90) {
    return `${parts.join(" ")}에 최적화된 콘텐츠`;
  } else if (score >= 70) {
    return `${parts.join(" ")} 학습에 적합한 콘텐츠`;
  } else {
    return `${parts.join(" ")} 관련 콘텐츠`;
  }
}

/**
 * 입력 조건에서 대상 학생을 추론합니다.
 */
function inferTargetStudents(input: ValidatedColdStartInput): string[] {
  const targets: string[] = [];

  // 난이도 기반 추론
  switch (input.difficulty) {
    case "개념":
      targets.push("기초가 부족한 학생");
      targets.push("개념 정리가 필요한 학생");
      break;
    case "기본":
      targets.push("내신 준비생");
      targets.push("기본기를 다지려는 학생");
      break;
    case "심화":
      targets.push("수능 준비생");
      targets.push("상위권 목표 학생");
      break;
    default:
      targets.push(`${input.subjectCategory} 학습자`);
  }

  return targets;
}

/**
 * 데이터 신뢰도를 계산합니다.
 */
function calculateReliability(item: ParsedContentItem): number {
  let reliability = 0.5; // 기본값

  // 리뷰 정보가 있으면 신뢰도 증가
  if (item.reviewSummary) {
    reliability += 0.2;

    // 리뷰 수가 많으면 추가 증가
    if (item.reviewSummary.reviewCount && item.reviewSummary.reviewCount >= 100) {
      reliability += 0.1;
    }
  }

  // 추천 이유가 상세하면 신뢰도 증가
  if (item.recommendationReasons && item.recommendationReasons.length >= 3) {
    reliability += 0.1;
  }

  // 장단점이 있으면 신뢰도 증가
  if (item.strengths && item.strengths.length > 0) {
    reliability += 0.05;
  }
  if (item.weaknesses && item.weaknesses.length > 0) {
    reliability += 0.05;
  }

  return Math.min(reliability, 1.0);
}
