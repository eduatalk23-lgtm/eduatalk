/**
 * 플랜 연결 상태 계산 훅
 * 같은 plan_number를 가진 플랜들의 연결 상태를 계산합니다.
 */

import { useMemo } from "react";
import type { PlanWithContent } from "../_types/plan";

export interface PlanConnectionState {
  isConnected: boolean;
  isFirst: boolean;
  isLast: boolean;
  isMiddle: boolean;
}

const DEFAULT_CONNECTION_STATE: PlanConnectionState = {
  isConnected: false,
  isFirst: false,
  isLast: false,
  isMiddle: false,
};

export type GetPlanConnectionStateFn = (date: string, planId: string) => PlanConnectionState;

/**
 * 같은 plan_number를 가진 플랜들의 연결 상태를 계산하는 훅
 *
 * @param plansByDate 날짜별로 그룹화된 플랜 맵
 * @returns 특정 날짜와 플랜 ID로 연결 상태를 조회하는 함수
 */
export function usePlanConnectionState(
  plansByDate: Map<string, PlanWithContent[]>
): GetPlanConnectionStateFn {
  return useMemo(() => {
    const connectionMap = new Map<string, PlanConnectionState>();

    // 날짜별로 그룹화
    plansByDate.forEach((dayPlans, date) => {
      // 같은 plan_number를 가진 플랜들을 그룹화
      const planNumberGroups = new Map<number | null, PlanWithContent[]>();

      dayPlans.forEach((plan) => {
        const planNumber = plan.plan_number ?? null;
        if (!planNumberGroups.has(planNumber)) {
          planNumberGroups.set(planNumber, []);
        }
        planNumberGroups.get(planNumber)!.push(plan);
      });

      // 각 그룹에서 2개 이상인 경우 연결 상태 계산
      planNumberGroups.forEach((groupPlans, planNumber) => {
        if (groupPlans.length >= 2 && planNumber !== null) {
          // block_index 순으로 정렬
          const sortedPlans = [...groupPlans].sort((a, b) => a.block_index - b.block_index);

          sortedPlans.forEach((plan, index) => {
            const isFirst = index === 0;
            const isLast = index === sortedPlans.length - 1;
            const isMiddle = !isFirst && !isLast;

            connectionMap.set(`${date}-${plan.id}`, {
              isConnected: true,
              isFirst,
              isLast,
              isMiddle,
            });
          });
        }
      });
    });

    return (date: string, planId: string): PlanConnectionState => {
      return connectionMap.get(`${date}-${planId}`) ?? DEFAULT_CONNECTION_STATE;
    };
  }, [plansByDate]);
}
