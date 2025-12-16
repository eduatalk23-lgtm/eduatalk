/**
 * 콘텐츠 소요시간 계산 통합 함수
 * 
 * 플랜 생성 및 스케줄링에서 사용하는 콘텐츠 소요시간 계산 로직을 통합 제공합니다.
 * - 강의: episode별 duration 합산 (있으면), 없으면 전체 duration / 전체 회차 * 배정 회차
 * - 책: 페이지 수 * (60 / pagesPerHour)
 * - 커스텀: total_page_or_time >= 100이면 페이지로 간주, 아니면 시간으로 간주
 * - 복습일: 학습일 대비 50% 단축
 */

import type { ContentDurationInfo } from "@/lib/types/plan-generation";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";

/**
 * 콘텐츠 소요시간 계산
 * 
 * @param content - 콘텐츠 정보 (content_type, content_id, start_range, end_range)
 * @param durationInfo - 콘텐츠 소요시간 정보 (episode 정보 포함)
 * @param dayType - 일 유형 ('학습일' | '복습일' 등, 선택사항)
 * @returns 예상 소요시간 (분 단위)
 * 
 * @example
 * ```typescript
 * const duration = calculateContentDuration(
 *   { content_type: "lecture", content_id: "123", start_range: 1, end_range: 5 },
 *   { content_type: "lecture", content_id: "123", episodes: [{ episode_number: 1, duration: 30 }, ...] },
 *   "학습일"
 * );
 * ```
 */
export function calculateContentDuration(
  content: {
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
  },
  durationInfo: ContentDurationInfo,
  dayType?: "학습일" | "복습일" | string
): number {
  const amount = content.end_range - content.start_range;
  
  // 범위가 유효하지 않은 경우 기본값 반환
  if (amount <= 0) {
    const baseTime = 60; // 기본값 1시간
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  let baseTime = 0;

  if (content.content_type === "lecture") {
    // 강의: episode별 duration 합산 (있으면), 없으면 전체 duration / 전체 회차 * 배정 회차
    if (durationInfo.episodes && durationInfo.episodes.length > 0) {
      // Episode별 duration 합산
      const episodeMap = new Map(
        durationInfo.episodes.map((ep) => [ep.episode_number, ep.duration])
      );
      
      let totalDuration = 0;
      for (let i = content.start_range; i <= content.end_range; i++) {
        const episodeDuration = episodeMap.get(i);
        if (episodeDuration !== null && episodeDuration !== undefined) {
          totalDuration += episodeDuration;
        } else {
          // Episode 정보가 없는 경우 기본값 사용 (회차당 30분)
          totalDuration += 30;
        }
      }
      
      baseTime = totalDuration;
    } else if (durationInfo.duration && durationInfo.duration > 0) {
      // Episode 정보가 없으면 전체 duration / 전체 회차 * 배정 회차
      // 전체 회차 수는 알 수 없으므로, duration을 그대로 사용하거나
      // 기본값으로 회차당 30분 사용
      // TODO: 전체 회차 수를 조회하여 정확한 계산 필요
      baseTime = Math.round((durationInfo.duration / amount) * amount);
      
      // duration이 전체 강의 시간이 아닐 수 있으므로, 더 안전한 방법 사용
      // 기본값: 회차당 30분
      if (baseTime <= 0) {
        baseTime = amount * 30;
      }
    } else {
      // duration 정보가 없으면 기본값: 회차당 30분
      baseTime = amount * 30;
    }
  } else if (content.content_type === "book") {
    // 책: 페이지 수 * (60 / pagesPerHour)
    const pagesPerHour = defaultRangeRecommendationConfig.pagesPerHour;
    const minutesPerPage = 60 / pagesPerHour;
    baseTime = Math.round(amount * minutesPerPage);
  } else {
    // 커스텀: total_page_or_time >= 100이면 페이지로 간주, 아니면 시간으로 간주
    if (durationInfo.total_page_or_time) {
      // total_page_or_time이 100 이상이면 페이지로 간주, 아니면 시간(분)으로 간주
      if (durationInfo.total_page_or_time >= 100) {
        // 페이지로 간주: 페이지당 2분
        const pagesPerHour = defaultRangeRecommendationConfig.pagesPerHour;
        const minutesPerPage = 60 / pagesPerHour;
        baseTime = Math.round(amount * minutesPerPage);
      } else {
        // 시간(분)으로 간주: 전체 시간을 전체 범위로 나눈 값 * 배정된 범위
        // 전체 범위는 알 수 없으므로, total_page_or_time을 그대로 사용하거나
        // 기본값으로 페이지당 2분 사용
        baseTime = Math.round((durationInfo.total_page_or_time / amount) * amount);
        
        // 계산 결과가 이상하면 기본값 사용
        if (baseTime <= 0) {
          const pagesPerHour = defaultRangeRecommendationConfig.pagesPerHour;
          const minutesPerPage = 60 / pagesPerHour;
          baseTime = Math.round(amount * minutesPerPage);
        }
      }
    } else {
      // 정보가 없으면 기본값: 페이지당 2분
      const pagesPerHour = defaultRangeRecommendationConfig.pagesPerHour;
      const minutesPerPage = 60 / pagesPerHour;
      baseTime = Math.round(amount * minutesPerPage);
    }
  }

  // 복습일이면 소요시간 단축 (학습일 대비 50%로 단축)
  if (dayType === "복습일") {
    return Math.round(baseTime * 0.5);
  }

  return baseTime;
}

