/**
 * 플랜 시간 배치 유틸리티
 * Step7의 TimeSlotsWithPlans 로직을 서버 액션에서 사용하기 위한 함수
 *
 * @see docs/refactoring/timeline_strategy.md
 */

import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";
import { calculateContentDuration } from "@/lib/plan/contentDuration";

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
 * 콘텐츠 메타데이터 (소요시간 계산용)
 */
export type ContentDurationInfo = {
  content_type: ContentType;
  content_id: string;
  total_pages?: number | null;
  duration?: number | null; // 전체 강의 시간 (fallback용)
  total_page_or_time?: number | null;
  episodes?: Array<{
    episode_number: number;
    duration: number | null; // 회차별 소요시간 (분)
  }> | null; // 강의 episode별 duration 정보
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
export function calculatePlanEstimatedTime(
  plan: PlanEstimateInput,
  contentDurationMap: Map<string, ContentDurationInfo>,
  dayType?: string
): number {
  if (
    plan.planned_start_page_or_time === null ||
    plan.planned_end_page_or_time === null ||
    !plan.content_id
  ) {
    const baseTime = 60; // 기본값 1시간
    // 복습일이면 소요시간 단축 (학습일 대비 50%로 단축)
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  const durationInfo = contentDurationMap.get(plan.content_id);
  
  if (!durationInfo) {
    // duration 정보가 없으면 기본값 반환
    const amount = plan.planned_end_page_or_time - plan.planned_start_page_or_time;
    const baseTime = amount > 0 ? (plan.content_type === "lecture" ? amount * 30 : amount * 2) : 60;
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

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

