/**
 * 타임라인 슬롯 처리 로직을 통합한 유틸리티
 * MonthView, WeekView, DayView에서 공통으로 사용하는 타임라인 슬롯 처리 로직을 추출
 */

import { buildTimelineSlots, timeToMinutes, type TimelineSlot } from "../_utils/timelineUtils";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule, DailyScheduleInfo } from "@/lib/types/plan";

export interface TimelineSlotsResult {
  timelineSlots: TimelineSlot[];
  sortedSlots: TimelineSlot[];
  filteredSlots: TimelineSlot[];
}

/**
 * 타임라인 슬롯을 생성하고 정렬/필터링하는 함수
 * 
 * @param dateStr 날짜 문자열 (YYYY-MM-DD)
 * @param dailySchedule 일일 스케줄 정보
 * @param plans 해당 날짜의 플랜 목록
 * @param academySchedules 해당 날짜의 학원 일정 목록
 * @param exclusions 해당 날짜의 제외일 목록
 * @param showOnlyStudyTime 학습시간만 표시할지 여부
 * @returns 타임라인 슬롯 정보
 */
export function getTimelineSlots(
  dateStr: string,
  dailySchedule: DailyScheduleInfo | null | undefined,
  plans: PlanWithContent[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[],
  showOnlyStudyTime: boolean = false
): TimelineSlotsResult {
  // 타임라인 슬롯 생성
  const timelineSlots = buildTimelineSlots(
    dateStr,
    dailySchedule,
    plans,
    academySchedules,
    exclusions
  );

  // 시간 순서대로 정렬 (start 시간 기준)
  const sortedSlots = [...timelineSlots].sort((a, b) => {
    const aStart = timeToMinutes(a.start);
    const bStart = timeToMinutes(b.start);
    return aStart - bStart;
  });

  // showOnlyStudyTime 필터링
  const filteredSlots = showOnlyStudyTime
    ? sortedSlots.filter((slot) => slot.type === "학습시간")
    : sortedSlots;

  return {
    timelineSlots,
    sortedSlots,
    filteredSlots,
  };
}

/**
 * 타임라인 슬롯을 생성하고 정렬/필터링하는 훅 (메모이제이션 포함)
 * 컴포넌트 최상위 레벨에서 사용할 때 사용
 * 
 * @deprecated getTimelineSlots 함수를 사용하세요. 훅이 필요한 경우 useMemo로 감싸서 사용하세요.
 */
export function useTimelineSlots(
  dateStr: string,
  dailySchedule: DailyScheduleInfo | null | undefined,
  plans: PlanWithContent[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[],
  showOnlyStudyTime: boolean = false
): TimelineSlotsResult {
  return getTimelineSlots(
    dateStr,
    dailySchedule,
    plans,
    academySchedules,
    exclusions,
    showOnlyStudyTime
  );
}

