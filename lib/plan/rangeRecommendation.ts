/**
 * 학습 범위 추천 로직
 * 
 * 스케줄 정보를 기반으로 각 콘텐츠에 대한 적정 학습 범위를 계산합니다.
 */

import type { RangeRecommendationConfig } from "@/lib/recommendations/config/types";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";

export type ScheduleSummary = {
  total_study_days: number;
  total_study_hours: number;
};

export type ContentInfo = {
  content_id: string;
  content_type: "book" | "lecture";
  total_amount: number; // 교재: 총 페이지 수, 강의: 총 회차 수
};

export type RecommendedRange = {
  start: number;
  end: number;
  reason: string;
};

export type RangeRecommendationResult = {
  ranges: Map<string, RecommendedRange>;
  unavailableReasons: Map<string, string>;
};

/**
 * 범위 추천이 불가능한 이유를 반환
 */
export function getUnavailableReason(
  scheduleSummary: ScheduleSummary | null | undefined,
  totalAmount: number | null | undefined
): string | null {
  if (!scheduleSummary) {
    return "스케줄 정보 없음";
  }

  const { total_study_days, total_study_hours } = scheduleSummary;
  if (total_study_days === 0 || total_study_hours === 0) {
    return "스케줄 정보 없음";
  }

  if (totalAmount === null || totalAmount === undefined) {
    return "총량 정보 없음";
  }

  if (totalAmount <= 0) {
    return "총량 정보 오류";
  }

  return null;
}

/**
 * 콘텐츠 목록에 대한 학습 범위 추천 계산
 * 
 * @param scheduleSummary 스케줄 요약 정보
 * @param contents 콘텐츠 정보 목록
 * @param options 선택적 설정 옵션
 * @param options.config 직접 제공된 범위 추천 설정 (우선순위 1)
 * @param options.tenantId 테넌트 ID (설정을 DB에서 조회할 때 사용)
 * @returns 추천 범위 및 불가능한 이유
 */
export async function calculateRecommendedRanges(
  scheduleSummary: ScheduleSummary | null | undefined,
  contents: ContentInfo[],
  options?: {
    config?: Partial<RangeRecommendationConfig>;
    tenantId?: string | null;
  }
): Promise<RangeRecommendationResult> {
  const ranges = new Map<string, RecommendedRange>();
  const unavailableReasons = new Map<string, string>();

  // 스케줄 정보 검증
  if (!scheduleSummary) {
    contents.forEach((content) => {
      unavailableReasons.set(content.content_id, "스케줄 정보 없음");
    });
    return { ranges, unavailableReasons };
  }

  const { total_study_days, total_study_hours } = scheduleSummary;
  if (total_study_days === 0 || total_study_hours === 0) {
    contents.forEach((content) => {
      unavailableReasons.set(content.content_id, "스케줄 정보 없음");
    });
    return { ranges, unavailableReasons };
  }

  // 전체 콘텐츠 개수
  const totalContents = contents.length;
  if (totalContents === 0) {
    return { ranges, unavailableReasons };
  }

  // 설정 결정: 직접 제공된 config → DB에서 조회 → 기본값
  let config: RangeRecommendationConfig;
  if (options?.config) {
    // 직접 제공된 config와 기본값을 병합
    config = {
      ...defaultRangeRecommendationConfig,
      ...options.config,
    };
  } else if (options?.tenantId !== undefined) {
    // tenantId가 제공되었으면 DB에서 조회 시도
    const { getRangeRecommendationConfig } = await import(
      "@/lib/recommendations/config/configManager"
    );
    config = await getRangeRecommendationConfig(options.tenantId);
  } else {
    // 옵션이 없으면 기본값 사용 (기존 동작 유지)
    config = defaultRangeRecommendationConfig;
  }

  // 일일 평균 학습 시간 계산
  const avgDailyHours = total_study_hours / total_study_days;

  // 각 콘텐츠에 할당할 일일 학습량 계산
  // 예: 9개 콘텐츠, 하루 3시간 → 각 콘텐츠당 약 20분
  const hoursPerContentPerDay = avgDailyHours / totalContents;

  // 각 콘텐츠별 추천 범위 계산
  for (const content of contents) {
    const unavailableReason = getUnavailableReason(
      scheduleSummary,
      content.total_amount
    );

    if (unavailableReason) {
      unavailableReasons.set(content.content_id, unavailableReason);
      continue;
    }

    if (content.content_type === "book") {
      // 교재: 일일 학습량을 페이지로 환산
      const pagesPerHour = config.pagesPerHour;
      const dailyPages = Math.round(hoursPerContentPerDay * pagesPerHour);
      const recommendedEnd = Math.min(
        dailyPages * total_study_days,
        content.total_amount
      );

      ranges.set(content.content_id, {
        start: 1,
        end: recommendedEnd,
        reason: `${totalContents}개 콘텐츠 분배, 일일 ${dailyPages}페이지 × ${total_study_days}일`,
      });
    } else if (content.content_type === "lecture") {
      // 강의: 일일 학습량을 회차로 환산
      const episodesPerHour = config.episodesPerHour;
      const dailyEpisodes = Math.round(
        hoursPerContentPerDay * episodesPerHour
      );
      const recommendedEnd = Math.min(
        dailyEpisodes * total_study_days,
        content.total_amount
      );

      ranges.set(content.content_id, {
        start: 1,
        end: recommendedEnd,
        reason: `${totalContents}개 콘텐츠 분배, 일일 ${dailyEpisodes}회차 × ${total_study_days}일`,
      });
    } else {
      unavailableReasons.set(content.content_id, "지원하지 않는 콘텐츠 타입");
    }
  }

  return { ranges, unavailableReasons };
}

