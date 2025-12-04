/**
 * 추천 시스템 설정 타입 정의
 */

/**
 * 범위 추천 설정
 */
export type RangeRecommendationConfig = {
  /** 교재: 1시간당 페이지 수 */
  pagesPerHour: number;
  /** 강의: 1시간당 회차 수 */
  episodesPerHour: number;
};

/**
 * 전체 추천 시스템 설정
 * 향후 확장 가능 (contentRecommendation, batchRecommendation 등)
 */
export type RecommendationConfig = {
  rangeRecommendation: RangeRecommendationConfig;
  // 향후 확장:
  // contentRecommendation?: ContentRecommendationConfig;
  // batchRecommendation?: BatchRecommendationConfig;
};

