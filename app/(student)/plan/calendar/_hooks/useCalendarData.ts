/**
 * 날짜별 데이터 그룹화 로직을 통합한 커스텀 훅
 * MonthView, WeekView에서 공통으로 사용하는 데이터 그룹화 로직을 추출
 */

import { useMemo } from "react";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";

export interface UseCalendarDataResult {
  plansByDate: Map<string, PlanWithContent[]>;
  exclusionsByDate: Map<string, PlanExclusion[]>;
  academySchedulesByDate: Map<string, AcademySchedule[]>;
}

/**
 * 날짜별 데이터를 그룹화하는 훅
 * 
 * @param plans 플랜 목록
 * @param exclusions 제외일 목록
 * @param academySchedules 학원 일정 목록
 * @param dates 그룹화할 날짜 배열 (선택, 없으면 전체 데이터만 그룹화)
 * @returns 날짜별로 그룹화된 데이터 맵들
 */
export function useCalendarData(
  plans: PlanWithContent[],
  exclusions: PlanExclusion[],
  academySchedules: AcademySchedule[],
  dates?: Date[]
): UseCalendarDataResult {
  // 날짜별 플랜 그룹화
  const plansByDate = useMemo(() => {
    const map = new Map<string, PlanWithContent[]>();
    plans.forEach((plan) => {
      const date = plan.plan_date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(plan);
    });
    return map;
  }, [plans]);

  // 날짜별 제외일 그룹화
  const exclusionsByDate = useMemo(() => {
    const map = new Map<string, PlanExclusion[]>();
    exclusions.forEach((exclusion) => {
      const date = exclusion.exclusion_date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(exclusion);
    });
    return map;
  }, [exclusions]);

  // 날짜별 학원일정 그룹화 (요일 기반)
  const academySchedulesByDate = useMemo(() => {
    const map = new Map<string, AcademySchedule[]>();
    
    // dates가 제공된 경우 해당 날짜들만 처리
    const targetDates = dates || [];
    
    targetDates.forEach((date) => {
      const dateStr = formatDateString(date);
      const dayOfWeek = date.getDay();
      // 요일이 일치하는 학원일정 찾기 (0=일요일, 1=월요일, ...)
      const daySchedules = academySchedules.filter(
        (schedule) => schedule.day_of_week === dayOfWeek
      );
      if (daySchedules.length > 0) {
        map.set(dateStr, daySchedules);
      }
    });
    
    return map;
  }, [academySchedules, dates]);

  return {
    plansByDate,
    exclusionsByDate,
    academySchedulesByDate,
  };
}

