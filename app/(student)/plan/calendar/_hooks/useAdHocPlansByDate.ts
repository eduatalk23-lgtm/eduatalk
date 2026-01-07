/**
 * Ad-hoc 플랜 날짜별 그룹화 훅
 */

import { useMemo } from "react";
import type { AdHocPlanForCalendar } from "../_components/PlanCalendarView";

/**
 * Ad-hoc 플랜들을 날짜별로 그룹화하는 훅
 *
 * @param adHocPlans Ad-hoc 플랜 배열
 * @returns 날짜별로 그룹화된 Ad-hoc 플랜 맵
 */
export function useAdHocPlansByDate(
  adHocPlans: AdHocPlanForCalendar[]
): Map<string, AdHocPlanForCalendar[]> {
  return useMemo(() => {
    const map = new Map<string, AdHocPlanForCalendar[]>();

    adHocPlans.forEach((plan) => {
      const dateStr = plan.plan_date;
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(plan);
    });

    return map;
  }, [adHocPlans]);
}
