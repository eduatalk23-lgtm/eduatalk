/**
 * 추천 시스템 기본 설정 값
 * 현재 하드코딩된 값과 동일하게 설정하여 기존 기능에 영향을 주지 않음
 */

import { RecommendationConfig } from "./types";

/**
 * 기본 추천 시스템 설정
 */
export const defaultRecommendationConfig: RecommendationConfig = {
  rangeRecommendation: {
    pagesPerHour: 10, // 현재 하드코딩 값: lib/plan/rangeRecommendation.ts 113줄
    episodesPerHour: 1, // 현재 하드코딩 값: lib/plan/rangeRecommendation.ts 127줄
  },
};

/**
 * 기본 범위 추천 설정
 */
export const defaultRangeRecommendationConfig = defaultRecommendationConfig.rangeRecommendation;

