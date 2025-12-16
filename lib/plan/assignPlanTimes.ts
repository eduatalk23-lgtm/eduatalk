/**
 * 플랜 시간 배치 유틸리티
 * Step7의 TimeSlotsWithPlans 로직을 서버 액션에서 사용하기 위한 함수
 *
 * @see docs/refactoring/timeline_strategy.md
 */

import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";
import { calculateContentDuration } from "@/lib/plan/contentDuration";
import type { ContentDurationInfo } from "@/lib/types/plan-generation";

// Re-export time utility functions for convenience
export { timeToMinutes, minutesToTime };

// ============================================
// 입력 타입 정의
// ============================================

/**
 * 콘텐츠 유형
 */
export type ContentType = "book" | "lecture" | "custom";

/**
 * 플랜 시간 배치 입력 플랜 타입
 */
export type PlanTimeInput = {
  content_id: string;
  content_type: ContentType;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter?: string | null;
  block_index?: number;
};

/**
 * 학습 시간 슬롯
 */
export type StudyTimeSlot = {
  start: string; // HH:mm
  end: string; // HH:mm
};

/**
 * 플랜 예상 소요시간 계산 입력 타입
 */
export type PlanEstimateInput = {
  content_type: ContentType;
  content_id?: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
};

// ============================================
// 출력 타입 정의
// ============================================

/**
 * 플랜의 예상 소요시간 계산 (분 단위)
 * 통합 함수를 사용하도록 변경
 *
 * @param plan - 플랜 정보 (content_type, 범위)
 * @param contentDurationMap - 콘텐츠 메타데이터 맵 (content_id → 정보)
 * @param dayType - 일 유형 ('학습일' | '복습일' 등)
 * @returns 예상 소요시간 (분)
 */
/**
 * 기본 소요시간 상수 (분 단위)
 */
const DEFAULT_BASE_TIME_MINUTES = 60; // 1시간

/**
 * 강의 회차당 기본 소요시간 (분 단위)
 */
const DEFAULT_EPISODE_DURATION_MINUTES = 30;

/**
 * 페이지당 기본 소요시간 (분 단위)
 */
const DEFAULT_PAGE_DURATION_MINUTES = 2;

/**
 * 복습일 소요시간 비율 (기본값)
 */
const DEFAULT_REVIEW_TIME_RATIO = 0.5; // 50%

/**
 * duration 정보가 없는 경우 기본값을 계산하는 헬퍼 함수
 */
function calculateDefaultDuration(
  content_type: ContentType,
  amount: number,
  dayType?: string
): number {
  const baseTime =
    amount > 0
      ? content_type === "lecture"
        ? amount * DEFAULT_EPISODE_DURATION_MINUTES
        : amount * DEFAULT_PAGE_DURATION_MINUTES
      : DEFAULT_BASE_TIME_MINUTES;
  
  return dayType === "복습일" ? Math.round(baseTime * DEFAULT_REVIEW_TIME_RATIO) : baseTime;
}

export function calculatePlanEstimatedTime(
  plan: PlanEstimateInput,
  contentDurationMap: Map<string, ContentDurationInfo>,
  dayType?: string
): number {
  // 입력 검증
  if (
    plan.planned_start_page_or_time === null ||
    plan.planned_end_page_or_time === null ||
    !plan.content_id
  ) {
    return dayType === "복습일"
      ? Math.round(DEFAULT_BASE_TIME_MINUTES * DEFAULT_REVIEW_TIME_RATIO)
      : DEFAULT_BASE_TIME_MINUTES;
  }

  const durationInfo = contentDurationMap.get(plan.content_id);
  
  // duration 정보가 없으면 기본값 반환
  if (!durationInfo) {
    const amount = plan.planned_end_page_or_time - plan.planned_start_page_or_time;
    return calculateDefaultDuration(plan.content_type, amount, dayType);
  }

  // 통합 함수 사용
  return calculateContentDuration(
    {
      content_type: plan.content_type,
      content_id: plan.content_id,
      start_range: plan.planned_start_page_or_time,
      end_range: plan.planned_end_page_or_time,
    },
    durationInfo,
    dayType
  );
}

/**
 * 플랜 시간 배치 결과 (출력)
 */
export type PlanTimeSegment = {
  /** 원본 플랜 정보 */
  plan: PlanTimeInput;
  /** 배치된 시작 시간 (HH:mm) */
  start: string;
  /** 배치된 종료 시간 (HH:mm) */
  end: string;
  /** 일부만 배치됨 (다음 슬롯에 계속) */
  isPartial: boolean;
  /** 이전 슬롯에서 이어서 배치됨 */
  isContinued: boolean;
  /** 원래 예상 소요시간 (분) */
  originalEstimatedTime: number;
};

/**
 * 플랜을 학습시간 슬롯에 배치
 *
 * Step7의 TimeSlotsWithPlans 로직과 동일
 *
 * @param plans - 배치할 플랜 목록
 * @param studyTimeSlots - 학습 가능 시간 슬롯
 * @param contentDurationMap - 콘텐츠 메타데이터 맵
 * @param dayType - 일 유형 ('학습일' | '복습일' 등)
 * @param totalStudyHours - 총 학습 가능 시간 (시간 단위)
 * @returns 시간이 배치된 플랜 세그먼트 배열
 *
 * @example
 * ```typescript
 * const segments = assignPlanTimes(
 *   plans,
 *   [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
 *   contentDurationMap,
 *   "학습일",
 *   8
 * );
 * ```
 */
export function assignPlanTimes(
  plans: PlanTimeInput[],
  studyTimeSlots: StudyTimeSlot[],
  contentDurationMap: Map<string, ContentDurationInfo>,
  dayType: string,
  totalStudyHours: number
): PlanTimeSegment[] {
  // 플랜 정보 준비
  const plansWithInfo = plans.map((plan) => {
    // Episode 정보 전달 확인 (개발 환경에서만, 강의 콘텐츠만)
    if (process.env.NODE_ENV === "development" && plan.content_type === "lecture") {
      const durationInfo = contentDurationMap.get(plan.content_id);
      const hasEpisodes =
        durationInfo?.episodes !== null &&
        durationInfo?.episodes !== undefined &&
        Array.isArray(durationInfo.episodes) &&
        durationInfo.episodes.length > 0;
      
      if (hasEpisodes && durationInfo.episodes) {
        const episodeCount = durationInfo.episodes.length;
        const rangeStart = plan.planned_start_page_or_time;
        const rangeEnd = plan.planned_end_page_or_time;
        const rangeEpisodes = durationInfo.episodes.filter(
          (ep) => ep.episode_number >= rangeStart && ep.episode_number <= rangeEnd
        ).length;
        
        console.log(
          `[assignPlanTimes] 강의 플랜 episode 정보 확인:`,
          {
            content_id: plan.content_id,
            range: `${rangeStart}~${rangeEnd}`,
            total_episodes: episodeCount,
            range_episodes: rangeEpisodes,
            episodes_in_range: durationInfo.episodes
              .filter((ep) => ep.episode_number >= rangeStart && ep.episode_number <= rangeEnd)
              .map((ep) => ({
                episode_number: ep.episode_number,
                duration: ep.duration,
              })),
          }
        );
      } else {
        console.warn(
          `[assignPlanTimes] 강의 플랜 episode 정보 없음:`,
          {
            content_id: plan.content_id,
            range: `${plan.planned_start_page_or_time}~${plan.planned_end_page_or_time}`,
            has_duration: !!(durationInfo?.duration && durationInfo.duration > 0),
            total_episodes: durationInfo?.total_episodes ?? null,
            episodes_array_exists: Array.isArray(durationInfo?.episodes),
            episodes_length: durationInfo?.episodes?.length ?? 0,
          }
        );
      }
    }

    const estimatedTime = calculatePlanEstimatedTime(plan, contentDurationMap, dayType);
    return {
      plan,
      originalEstimatedTime: estimatedTime,
      estimatedTime, // 배치에 사용할 시간
      remainingTime: estimatedTime, // 남은 시간 추적
      blockIndex: plan.block_index || 0,
    };
  });

  // 복습일이고 예상 소요시간이 총 학습시간보다 큰 경우 평균 시간으로 조정
  const isReviewDay = dayType === "복습일";
  const totalEstimatedTime = plansWithInfo.reduce((sum, p) => sum + p.originalEstimatedTime, 0);
  const totalStudyMinutes = totalStudyHours * 60;

  if (isReviewDay && totalEstimatedTime > totalStudyMinutes && plans.length > 0) {
    // 평균 시간 계산
    const averageTime = Math.floor(totalStudyMinutes / plans.length);
    plansWithInfo.forEach((p) => {
      p.estimatedTime = averageTime;
      p.remainingTime = averageTime;
      // originalEstimatedTime은 그대로 유지 (강조 표시용)
    });
  }

  // Best Fit 알고리즘을 위한 정렬: 소요시간 내림차순 (큰 것부터 배치)
  const sortedPlans = [...plansWithInfo].sort((a, b) => {
    // 먼저 block_index 순으로 정렬 (같은 block_index면 소요시간 내림차순)
    const blockDiff = (a.blockIndex || 0) - (b.blockIndex || 0);
    if (blockDiff !== 0) return blockDiff;
    return b.originalEstimatedTime - a.originalEstimatedTime;
  });

  // 각 학습시간 슬롯에 플랜 배치 (Best Fit 알고리즘)
  const segments: PlanTimeSegment[] = [];
  
  // 슬롯별 사용 가능한 시간 추적
  const slotAvailability: Array<{ slot: StudyTimeSlot; usedTime: number }> = studyTimeSlots.map((slot) => ({
    slot,
    usedTime: 0,
  }));

  // 각 플랜을 가장 적합한 슬롯에 배치
  for (const planInfo of sortedPlans) {
    if (planInfo.remainingTime <= 0) continue;

    // Best Fit: 남은 시간이 가장 적은 슬롯 찾기 (하지만 플랜이 들어갈 수 있어야 함)
    let bestSlotIndex = -1;
    let bestRemainingSpace = Infinity;

    for (let i = 0; i < slotAvailability.length; i++) {
      const { slot, usedTime } = slotAvailability[i];
      const slotStart = timeToMinutes(slot.start);
      const slotEnd = timeToMinutes(slot.end);
      const slotDuration = slotEnd - slotStart;
      const availableTime = slotDuration - usedTime;

      // 플랜이 들어갈 수 있고, 남은 공간이 가장 적은 슬롯 선택
      if (availableTime >= planInfo.remainingTime && availableTime < bestRemainingSpace) {
        bestSlotIndex = i;
        bestRemainingSpace = availableTime;
      }
    }

    // Best Fit 슬롯을 찾지 못한 경우, First Fit으로 폴백
    if (bestSlotIndex === -1) {
      for (let i = 0; i < slotAvailability.length; i++) {
        const { slot, usedTime } = slotAvailability[i];
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);
        const slotDuration = slotEnd - slotStart;
        const availableTime = slotDuration - usedTime;

        if (availableTime > 0) {
          bestSlotIndex = i;
          break;
        }
      }
    }

    if (bestSlotIndex >= 0) {
      const { slot, usedTime } = slotAvailability[bestSlotIndex];
      const slotStart = timeToMinutes(slot.start);
      const slotEnd = timeToMinutes(slot.end);
      const slotDuration = slotEnd - slotStart;
      const availableTime = slotDuration - usedTime;
      const timeToUse = Math.min(planInfo.remainingTime, availableTime);

      if (timeToUse > 0) {
        const wasPartial = planInfo.remainingTime < planInfo.originalEstimatedTime;
        const willBePartial = planInfo.remainingTime > timeToUse;
        const planStartTime = slotStart + usedTime;
        
        segments.push({
          plan: planInfo.plan,
          start: minutesToTime(planStartTime),
          end: minutesToTime(planStartTime + timeToUse),
          isPartial: willBePartial,
          isContinued: wasPartial,
          originalEstimatedTime: planInfo.originalEstimatedTime,
        });
        
        planInfo.remainingTime -= timeToUse;
        slotAvailability[bestSlotIndex].usedTime += timeToUse;
      }
    }
  }

  // 시간 순으로 정렬
  segments.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  return segments;
}

