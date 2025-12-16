/**
 * 플랜 분할 유틸리티
 * 
 * 강의 콘텐츠의 큰 범위를 episode별로 분할하는 함수 제공
 */

import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type { PlanTimeInput } from "@/lib/plan/assignPlanTimes";
import type { ContentDurationInfo } from "@/lib/types/plan-generation";

/**
 * 강의 플랜을 episode별로 분할
 * 
 * 큰 범위(예: 2~23)를 개별 episode(2~2, 3~3, ...)로 분할하여
 * 각 episode의 실제 duration을 정확히 반영할 수 있도록 합니다.
 * 
 * @param plan - 분할할 플랜
 * @param contentDurationMap - 콘텐츠 duration 정보 맵
 * @returns 분할된 플랜 배열 (분할 불필요 시 원본 플랜 1개 반환)
 * 
 * @example
 * ```typescript
 * const plan: ScheduledPlan = {
 *   plan_date: "2025-01-01",
 *   block_index: 1,
 *   content_type: "lecture",
 *   content_id: "lecture-123",
 *   planned_start_page_or_time: 2,
 *   planned_end_page_or_time: 5,
 *   chapter: null,
 *   is_reschedulable: true,
 * };
 * 
 * const splitPlans = splitPlanByEpisodes(plan, contentDurationMap);
 * // 결과: [
 * //   { ...plan, planned_start_page_or_time: 2, planned_end_page_or_time: 2 },
 * //   { ...plan, planned_start_page_or_time: 3, planned_end_page_or_time: 3 },
 * //   { ...plan, planned_start_page_or_time: 4, planned_end_page_or_time: 4 },
 * //   { ...plan, planned_start_page_or_time: 5, planned_end_page_or_time: 5 },
 * // ]
 * ```
 */
export function splitPlanByEpisodes(
  plan: ScheduledPlan,
  contentDurationMap: Map<string, ContentDurationInfo>
): ScheduledPlan[] {
  // 강의가 아니면 분할 불필요
  if (plan.content_type !== "lecture") {
    return [plan];
  }

  const durationInfo = contentDurationMap.get(plan.content_id);

  // Episode 정보가 없으면 분할 불필요
  if (
    !durationInfo?.episodes ||
    !Array.isArray(durationInfo.episodes) ||
    durationInfo.episodes.length === 0
  ) {
    return [plan];
  }

  const start = plan.planned_start_page_or_time;
  const end = plan.planned_end_page_or_time;

  // 범위가 1개 episode면 분할 불필요
  if (start === end) {
    return [plan];
  }

  // Episode별로 플랜 분할
  const splitPlans: ScheduledPlan[] = [];
  for (let i = start; i <= end; i++) {
    splitPlans.push({
      ...plan,
      planned_start_page_or_time: i,
      planned_end_page_or_time: i,
    });
  }

  return splitPlans;
}

/**
 * PlanTimeInput을 episode별로 분할
 * 
 * generatePlansRefactored.ts에서 사용하는 PlanTimeInput 타입을 위한 분할 함수
 * 
 * @param plan - 분할할 플랜 (PlanTimeInput)
 * @param contentDurationMap - 콘텐츠 duration 정보 맵
 * @returns 분할된 플랜 배열 (분할 불필요 시 원본 플랜 1개 반환)
 */
export function splitPlanTimeInputByEpisodes(
  plan: PlanTimeInput,
  contentDurationMap: Map<string, ContentDurationInfo>
): PlanTimeInput[] {
  // 강의가 아니면 분할 불필요
  if (plan.content_type !== "lecture") {
    return [plan];
  }

  const durationInfo = contentDurationMap.get(plan.content_id);

  // Episode 정보가 없으면 분할 불필요
  if (
    !durationInfo?.episodes ||
    !Array.isArray(durationInfo.episodes) ||
    durationInfo.episodes.length === 0
  ) {
    return [plan];
  }

  const start = plan.planned_start_page_or_time;
  const end = plan.planned_end_page_or_time;

  // 범위가 1개 episode면 분할 불필요
  if (start === end) {
    return [plan];
  }

  // Episode별로 플랜 분할
  const splitPlans: PlanTimeInput[] = [];
  for (let i = start; i <= end; i++) {
    splitPlans.push({
      ...plan,
      planned_start_page_or_time: i,
      planned_end_page_or_time: i,
      // Pre-calculated time은 분할 후 재계산 필요
      _precalculated_start: null,
      _precalculated_end: null,
    });
  }

  return splitPlans;
}

