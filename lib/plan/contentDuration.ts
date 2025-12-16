/**
 * 콘텐츠 소요시간 계산 통합 함수
 * 
 * 플랜 생성 및 스케줄링에서 사용하는 콘텐츠 소요시간 계산 로직을 통합 제공합니다.
 * - 강의: episode별 duration 합산 (있으면), 없으면 전체 duration / 전체 회차 * 배정 회차
 * - 책: 페이지 수 * (60 / pagesPerHour)
 * - 커스텀: total_page_or_time >= 100이면 페이지로 간주, 아니면 시간으로 간주
 * - 복습일: 학습일 대비 50% 단축
 */

import type { ContentDurationInfo, EpisodeInfo } from "@/lib/types/plan-generation";
import {
  hasValidEpisodes as hasValidEpisodesTypeGuard,
} from "@/lib/types/plan-generation";
import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";

// ============================================
// 상수 정의
// ============================================

/**
 * 기본 소요시간 상수 (분 단위)
 */
const DEFAULT_BASE_TIME_MINUTES = 60; // 1시간

/**
 * 강의 회차당 기본 소요시간 (분 단위)
 */
const DEFAULT_EPISODE_DURATION_MINUTES = 30;

/**
 * 복습일 소요시간 비율 (기본값)
 */
const DEFAULT_REVIEW_TIME_RATIO = 0.5; // 50%

/**
 * 페이지당 기본 소요시간 (분 단위)
 */
const DEFAULT_MINUTES_PER_PAGE = 60 / defaultRangeRecommendationConfig.pagesPerHour;

/**
 * 난이도별 페이지당 소요시간 (분 단위)
 */
const PAGE_DURATION_BY_DIFFICULTY: Readonly<Record<string, number>> = {
  기초: 4,   // 페이지당 4분
  기본: 6,   // 페이지당 6분 (현재 기본값)
  심화: 8,   // 페이지당 8분
  최상: 10,  // 페이지당 10분
} as const;

/**
 * 커스텀 콘텐츠 페이지/시간 구분 기준값
 */
const CUSTOM_CONTENT_PAGE_THRESHOLD = 100;

/**
 * 콘텐츠 소요시간 계산
 * 
 * @param content - 콘텐츠 정보 (content_type, content_id, start_range, end_range)
 * @param durationInfo - 콘텐츠 소요시간 정보 (episode 정보 포함)
 * @param dayType - 일 유형 ('학습일' | '복습일' 등, 선택사항)
 * @param reviewTimeRatio - 복습일 소요시간 비율 (기본값: 0.5 = 50%, 설정값이 있으면 사용)
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
/**
 * Episode Map을 생성하는 헬퍼 함수
 * TypeScript 2025 모범 사례: Map 생성 최적화 및 타입 안전성 강화
 */
function createEpisodeMap(episodes: EpisodeInfo[]): Map<number, number> {
  const episodeMap = new Map<number, number>();
  
  // 유효한 duration만 Map에 추가 (null 체크 및 양수 검증)
  for (const ep of episodes) {
    if (
      ep.duration !== null &&
      ep.duration !== undefined &&
      ep.duration > 0 &&
      ep.episode_number > 0
    ) {
      episodeMap.set(ep.episode_number, ep.duration);
    }
  }
  
  return episodeMap;
}

export function calculateContentDuration(
  content: {
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
  },
  durationInfo: ContentDurationInfo,
  dayType?: "학습일" | "복습일" | string,
  reviewTimeRatio?: number
): number {
  const amount = content.end_range - content.start_range;
  
  // 범위가 유효하지 않은 경우 기본값 반환
  if (amount <= 0) {
    return dayType === "복습일"
      ? Math.round(DEFAULT_BASE_TIME_MINUTES * DEFAULT_REVIEW_TIME_RATIO)
      : DEFAULT_BASE_TIME_MINUTES;
  }

  let baseTime = 0;

  if (content.content_type === "lecture") {
    // 강의: episode별 duration 합산 (있으면), 없으면 전체 duration / 전체 회차 * 배정 회차
    if (hasValidEpisodesTypeGuard(durationInfo.episodes)) {
      // Episode Map 생성 (최적화: 한 번만 생성)
      const episodeMap = createEpisodeMap(durationInfo.episodes);
      
      let totalDuration = 0;
      let episodesWithDuration = 0;
      let episodesWithoutDuration = 0;
      
      // 범위 내 episode별 duration 합산
      for (let i = content.start_range; i <= content.end_range; i++) {
        const episodeDuration = episodeMap.get(i);
        if (episodeDuration !== null && episodeDuration !== undefined && episodeDuration > 0) {
          totalDuration += episodeDuration;
          episodesWithDuration++;
        } else {
          // Episode 정보가 없는 경우 기본값 사용
          totalDuration += DEFAULT_EPISODE_DURATION_MINUTES;
          episodesWithoutDuration++;
        }
      }
      
      // Episode 정보 사용 로깅 (개발 환경에서만)
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[calculateContentDuration] 강의 episode별 duration 합산:`,
          {
            content_id: content.content_id,
            range: `${content.start_range}~${content.end_range}`,
            total_episodes_in_range: content.end_range - content.start_range + 1,
            episodes_with_duration: episodesWithDuration,
            episodes_without_duration: episodesWithoutDuration,
            calculated_duration: totalDuration,
          }
        );
      }
      
      baseTime = totalDuration;
    } else if (durationInfo.duration !== null && durationInfo.duration !== undefined && durationInfo.duration > 0) {
      // Episode 정보가 없으면 전체 duration / 전체 회차 * 배정 회차
      // total_episodes가 있으면 정확한 계산 가능
      if (
        durationInfo.total_episodes !== null &&
        durationInfo.total_episodes !== undefined &&
        durationInfo.total_episodes > 0
      ) {
        const avgDurationPerEpisode = durationInfo.duration / durationInfo.total_episodes;
        baseTime = Math.round(avgDurationPerEpisode * amount);
      } else {
        // total_episodes가 없으면 기본값: 회차당 30분
        baseTime = amount * DEFAULT_EPISODE_DURATION_MINUTES;
      }
    } else {
      // duration 정보가 없으면 기본값: 회차당 30분
      baseTime = amount * DEFAULT_EPISODE_DURATION_MINUTES;
    }
  } else if (content.content_type === "book") {
    // 책: 난이도별 페이지당 소요시간 적용
    const difficultyLevel = durationInfo.difficulty_level;
    
    // 난이도별 페이지당 소요시간 (분)
    const minutesPerPage =
      difficultyLevel && difficultyLevel in PAGE_DURATION_BY_DIFFICULTY
        ? PAGE_DURATION_BY_DIFFICULTY[difficultyLevel]
        : DEFAULT_MINUTES_PER_PAGE;
    
    baseTime = Math.round(amount * minutesPerPage);
  } else {
    // 커스텀: total_page_or_time >= 100이면 페이지로 간주, 아니면 시간으로 간주
    if (
      durationInfo.total_page_or_time !== null &&
      durationInfo.total_page_or_time !== undefined
    ) {
      if (durationInfo.total_page_or_time >= CUSTOM_CONTENT_PAGE_THRESHOLD) {
        // 페이지로 간주
        baseTime = Math.round(amount * DEFAULT_MINUTES_PER_PAGE);
      } else {
        // 시간(분)으로 간주: 전체 시간을 전체 범위로 나눈 값 * 배정된 범위
        // 전체 범위는 알 수 없으므로, 기본값으로 페이지당 시간 사용
        const calculatedTime = Math.round(
          (durationInfo.total_page_or_time / amount) * amount
        );
        
        // 계산 결과가 유효하지 않으면 기본값 사용
        baseTime =
          calculatedTime > 0 ? calculatedTime : Math.round(amount * DEFAULT_MINUTES_PER_PAGE);
      }
    } else {
      // 정보가 없으면 기본값: 페이지당 시간
      baseTime = Math.round(amount * DEFAULT_MINUTES_PER_PAGE);
    }
  }

  // 복습일이면 소요시간 단축 (설정값 또는 기본값 50% 사용)
  if (dayType === "복습일") {
    const ratio = reviewTimeRatio ?? DEFAULT_REVIEW_TIME_RATIO;
    return Math.round(baseTime * ratio);
  }

  return baseTime;
}

