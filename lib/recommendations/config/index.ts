/**
 * 추천 시스템 설정 모듈 통합 export
 */

export type {
  RangeRecommendationConfig,
  RecommendationConfig,
} from "./types";

export {
  defaultRecommendationConfig,
  defaultRangeRecommendationConfig,
} from "./defaultConfig";

export {
  getRangeRecommendationConfig,
  updateRangeRecommendationConfig,
  resetRangeRecommendationConfig,
} from "./configManager";

