/**
 * 플랜 시간 배치 유틸리티
 * Step7의 TimeSlotsWithPlans 로직을 서버 액션에서 사용하기 위한 함수
 *
 * @see docs/refactoring/timeline_strategy.md
 */

import { defaultRangeRecommendationConfig } from "@/lib/recommendations/config/defaultConfig";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";
import {
  calculateContentDuration,
  DEFAULT_BASE_TIME_MINUTES,
  DEFAULT_EPISODE_DURATION_MINUTES,
  DEFAULT_REVIEW_TIME_RATIO,
} from "@/lib/plan/contentDuration";
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
  _precalculated_start?: string | null;
  _precalculated_end?: string | null;
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
 * 페이지당 기본 소요시간 (분 단위)
 * Note: contentDuration.ts의 DEFAULT_MINUTES_PER_PAGE와 다를 수 있음
 * (난이도별 페이지당 시간은 contentDuration.ts에서 관리)
 */
const DEFAULT_PAGE_DURATION_MINUTES = 2;

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

  // Episode별 duration 기반 배정이 필요한지 확인
  // 강의 콘텐츠가 있고 episode별로 분할된 경우 (start === end)
  const hasLectureEpisodes = plansWithInfo.some(
    (p) =>
      p.plan.content_type === "lecture" &&
      p.plan.planned_start_page_or_time === p.plan.planned_end_page_or_time
  );

  if (hasLectureEpisodes) {
    // Episode별 duration 기반 시간 배정
    return assignEpisodeBasedTimes(
      plansWithInfo,
      studyTimeSlots,
      contentDurationMap,
      dayType
    );
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
    // 1. Precalculated Time Bypass (SchedulerEngine Result)
    if (planInfo.plan._precalculated_start && planInfo.plan._precalculated_end) {
      segments.push({
        plan: planInfo.plan,
        start: planInfo.plan._precalculated_start,
        end: planInfo.plan._precalculated_end,
        isPartial: false,
        isContinued: false,
        originalEstimatedTime: planInfo.originalEstimatedTime,
      });
      planInfo.remainingTime = 0;
      continue;
    }

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

/**
 * Episode Map 생성 헬퍼 함수
 * 콘텐츠의 episode 정보를 Map으로 변환하여 빠른 조회 지원
 */
function createEpisodeMap(
  episodes: Array<{ episode_number: number; duration: number | null }> | null | undefined
): Map<number, number> {
  const episodeMap = new Map<number, number>();
  if (!episodes) return episodeMap;

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

/**
 * Episode별 duration 기반 시간 배정 (개선된 버전)
 *
 * 강의 콘텐츠의 episode별 실제 duration을 반영하여
 * Best Fit 알고리즘으로 여러 슬롯에 분산 배정합니다.
 *
 * 개선 사항:
 * 1. Precalculated time이 있으면 bypass (SchedulerEngine 결과 사용)
 * 2. Best Fit 알고리즘으로 여러 슬롯에 분산 배정
 * 3. Episode별 실제 duration 직접 조회
 * 4. 학습일/복습일 고려 (복습일은 50% 단축)
 *
 * @param plansWithInfo - 플랜 정보 배열 (이미 estimatedTime 계산됨)
 * @param studyTimeSlots - 학습 시간 슬롯
 * @param contentDurationMap - 콘텐츠 duration 정보 맵
 * @param dayType - 일 유형 ('학습일' | '복습일')
 * @returns 시간이 배정된 플랜 세그먼트 배열
 */
function assignEpisodeBasedTimes(
  plansWithInfo: Array<{
    plan: PlanTimeInput;
    originalEstimatedTime: number;
    estimatedTime: number;
    remainingTime: number;
    blockIndex: number;
  }>,
  studyTimeSlots: StudyTimeSlot[],
  contentDurationMap: Map<string, ContentDurationInfo>,
  dayType: string
): PlanTimeSegment[] {
  const segments: PlanTimeSegment[] = [];

  // DEBUG: Log input plans to verify precalculated times
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[assignEpisodeBasedTimes] 입력 플랜 분석:`,
      {
        totalPlans: plansWithInfo.length,
        plansDetail: plansWithInfo.map((p) => ({
          content_id: p.plan.content_id,
          range: `${p.plan.planned_start_page_or_time}~${p.plan.planned_end_page_or_time}`,
          precalc_start: p.plan._precalculated_start,
          precalc_end: p.plan._precalculated_end,
          has_precalc: !!(p.plan._precalculated_start && p.plan._precalculated_end),
        })),
      }
    );
  }

  // 0. Precalculated time이 있는 플랜과 없는 플랜 분리
  const plansWithPrecalc: typeof plansWithInfo = [];
  const plansWithoutPrecalc: typeof plansWithInfo = [];

  for (const planInfo of plansWithInfo) {
    if (planInfo.plan._precalculated_start && planInfo.plan._precalculated_end) {
      plansWithPrecalc.push(planInfo);
    } else {
      plansWithoutPrecalc.push(planInfo);
    }
  }

  // DEBUG: Log separation results
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[assignEpisodeBasedTimes] Precalculated time 분리 결과:`,
      {
        withPrecalc: plansWithPrecalc.length,
        withoutPrecalc: plansWithoutPrecalc.length,
        precalcPlans: plansWithPrecalc.map((p) => ({
          content_id: p.plan.content_id,
          range: `${p.plan.planned_start_page_or_time}~${p.plan.planned_end_page_or_time}`,
          start: p.plan._precalculated_start,
          end: p.plan._precalculated_end,
        })),
      }
    );
  }

  // 0.1 Precalculated time이 있는 플랜은 바로 세그먼트 생성
  for (const planInfo of plansWithPrecalc) {
    segments.push({
      plan: planInfo.plan,
      start: planInfo.plan._precalculated_start!,
      end: planInfo.plan._precalculated_end!,
      isPartial: false,
      isContinued: false,
      originalEstimatedTime: planInfo.originalEstimatedTime,
    });
  }

  // 0.2 Precalculated time이 없는 플랜만 시간 계산 필요
  if (plansWithoutPrecalc.length === 0) {
    // 시간 순으로 정렬
    segments.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    return segments;
  }

  // 1. 슬롯별 사용 가능한 시간 추적 (Best Fit 알고리즘)
  // Precalculated 플랜이 사용한 시간 반영
  const slotAvailability: Array<{
    slot: StudyTimeSlot;
    usedTime: number;
    slotDuration: number;
  }> = studyTimeSlots.map((slot) => {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    return {
      slot,
      usedTime: 0,
      slotDuration: slotEnd - slotStart,
    };
  });

  // Precalculated 플랜이 사용한 슬롯 시간 업데이트
  for (const planInfo of plansWithPrecalc) {
    const planStart = timeToMinutes(planInfo.plan._precalculated_start!);
    const planEnd = timeToMinutes(planInfo.plan._precalculated_end!);

    // 해당 플랜이 속한 슬롯 찾기 및 사용 시간 업데이트
    for (const slotInfo of slotAvailability) {
      const slotStart = timeToMinutes(slotInfo.slot.start);
      const slotEnd = timeToMinutes(slotInfo.slot.end);

      // 플랜이 이 슬롯에 겹치는지 확인
      if (planStart < slotEnd && planEnd > slotStart) {
        const overlapStart = Math.max(planStart, slotStart);
        const overlapEnd = Math.min(planEnd, slotEnd);
        const overlapDuration = overlapEnd - overlapStart;
        slotInfo.usedTime += overlapDuration;
      }
    }
  }

  // 2. Episode Map 캐싱 (콘텐츠별로 한 번만 생성)
  const episodeMapCache = new Map<string, Map<number, number>>();

  // 3. Precalculated 없는 플랜을 block_index → episode 순으로 정렬
  const sortedPlans = [...plansWithoutPrecalc].sort((a, b) => {
    // 먼저 block_index 순으로 정렬
    const blockDiff = (a.blockIndex || 0) - (b.blockIndex || 0);
    if (blockDiff !== 0) return blockDiff;
    // 같은 block_index면 episode 번호 순
    return a.plan.planned_start_page_or_time - b.plan.planned_start_page_or_time;
  });

  // 4. 각 플랜(episode)별로 Best Fit 배정
  for (const planInfo of sortedPlans) {
    const { plan } = planInfo;
    const contentId = plan.content_id;
    const episodeNumber = plan.planned_start_page_or_time;

    // 4.1 Episode별 실제 duration 직접 조회
    let episodeMap = episodeMapCache.get(contentId);
    if (!episodeMap) {
      const durationInfo = contentDurationMap.get(contentId);
      episodeMap = createEpisodeMap(durationInfo?.episodes);
      episodeMapCache.set(contentId, episodeMap);
    }

    // Episode 실제 duration 조회 (없으면 기본값 30분)
    const rawEpisodeDuration = episodeMap.get(episodeNumber) ?? DEFAULT_EPISODE_DURATION_MINUTES;

    // 4.2 학습일/복습일 고려하여 duration 조정
    const episodeDuration =
      dayType === "복습일"
        ? Math.round(rawEpisodeDuration * DEFAULT_REVIEW_TIME_RATIO)
        : rawEpisodeDuration;

    // 4.3 Best Fit 알고리즘: 가장 적합한 슬롯 찾기
    // - 플랜이 완전히 들어갈 수 있는 슬롯 중 남은 공간이 가장 적은 슬롯 선택
    let bestSlotIndex = -1;
    let bestRemainingSpace = Infinity;

    for (let i = 0; i < slotAvailability.length; i++) {
      const { usedTime, slotDuration } = slotAvailability[i];
      const availableTime = slotDuration - usedTime;

      // 플랜이 완전히 들어갈 수 있고, 남은 공간이 가장 적은 슬롯 선택
      if (availableTime >= episodeDuration && availableTime < bestRemainingSpace) {
        bestSlotIndex = i;
        bestRemainingSpace = availableTime;
      }
    }

    // 4.4 Best Fit 슬롯을 찾지 못한 경우, First Fit으로 폴백 (부분 배정)
    if (bestSlotIndex === -1) {
      for (let i = 0; i < slotAvailability.length; i++) {
        const { usedTime, slotDuration } = slotAvailability[i];
        const availableTime = slotDuration - usedTime;

        if (availableTime > 0) {
          bestSlotIndex = i;
          break;
        }
      }
    }

    // 4.5 플랜 배정
    if (bestSlotIndex >= 0) {
      let remainingDuration = episodeDuration;
      let isFirstSegment = true;

      while (remainingDuration > 0 && bestSlotIndex < slotAvailability.length) {
        const slotInfo = slotAvailability[bestSlotIndex];
        const { slot, usedTime, slotDuration } = slotInfo;
        const slotStart = timeToMinutes(slot.start);
        const availableTime = slotDuration - usedTime;

        if (availableTime <= 0) {
          // 현재 슬롯이 가득 참, 다음 슬롯으로
          bestSlotIndex++;
          continue;
        }

        const timeToUse = Math.min(remainingDuration, availableTime);
        const segmentStart = slotStart + usedTime;

        segments.push({
          plan: planInfo.plan,
          start: minutesToTime(segmentStart),
          end: minutesToTime(segmentStart + timeToUse),
          isPartial: remainingDuration > timeToUse,
          isContinued: !isFirstSegment,
          originalEstimatedTime: planInfo.originalEstimatedTime,
        });

        remainingDuration -= timeToUse;
        slotAvailability[bestSlotIndex].usedTime += timeToUse;
        isFirstSegment = false;

        // 슬롯이 가득 차면 다음 슬롯으로
        if (slotAvailability[bestSlotIndex].usedTime >= slotDuration) {
          bestSlotIndex++;
        }
      }
    }
  }

  // 5. 시간 순으로 정렬
  segments.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  return segments;
}

