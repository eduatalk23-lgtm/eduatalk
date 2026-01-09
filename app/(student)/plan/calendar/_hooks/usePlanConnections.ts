/**
 * 플랜 연결 그룹화 훅
 * 같은 plan_number 또는 content_id + sequence 조합을 가진 플랜들을 그룹화합니다.
 */

import { useMemo } from "react";
import type { PlanWithContent } from "../_types/plan";

export type PlanConnection = {
  planIds: string[];
  groupKey: string;
};

export type UsePlanConnectionsResult = {
  planConnections: PlanConnection[];
  connectedPlanIds: Set<string>;
};

/**
 * 플랜 연결 그룹화 훅
 *
 * @param plans 전체 플랜 목록
 * @returns planConnections: 2개 이상 연결된 플랜 그룹, connectedPlanIds: 연결된 플랜 ID Set
 */
export function usePlanConnections(plans: PlanWithContent[]): UsePlanConnectionsResult {
  const planConnections = useMemo(() => {
    const connectionMap = new Map<string, PlanConnection>();

    plans.forEach((plan) => {
      // 그룹 키 생성: plan_number가 있으면 사용, 없으면 content_id + sequence 조합
      const groupKey =
        plan.plan_number !== null && plan.plan_number !== undefined
          ? `plan_number_${plan.plan_number}`
          : plan.sequence !== null && plan.sequence !== undefined
            ? `content_${plan.content_id}_seq_${plan.sequence}`
            : null;

      if (!groupKey) return;

      if (!connectionMap.has(groupKey)) {
        connectionMap.set(groupKey, {
          planIds: [],
          groupKey,
        });
      }

      connectionMap.get(groupKey)!.planIds.push(plan.id);
    });

    // 2개 이상의 플랜이 있는 그룹만 반환
    return Array.from(connectionMap.values()).filter(
      (conn) => conn.planIds.length >= 2
    );
  }, [plans]);

  // 연결된 플랜 ID Set 생성 (빠른 조회를 위해)
  const connectedPlanIds = useMemo(() => {
    const ids = new Set<string>();
    planConnections.forEach((conn) => {
      conn.planIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [planConnections]);

  return { planConnections, connectedPlanIds };
}
