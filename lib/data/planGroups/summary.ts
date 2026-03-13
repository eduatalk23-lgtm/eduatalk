/**
 * 플랜 그룹 통계 및 요약 관련 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import type { PlanGroup } from "./types";
import type { PlanGroupFilters, PlanGroupStats, PlanGroupContentSummary } from "./types";
import { getPlanGroupsForStudent } from "./core";

/**
 * 학생의 플랜 그룹 목록을 통계와 함께 조회
 */
export async function getPlanGroupsWithStats(
  filters: PlanGroupFilters
): Promise<Array<PlanGroup & PlanGroupStats>> {
  const supabase = await createSupabaseServerClient();

  // 1. 플랜 그룹 조회
  const groups = await getPlanGroupsForStudent(filters);

  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((g) => g.id);
  const studentId = filters.studentId;

  // 2. 플랜 통계 단일 쿼리로 조회 (3쿼리 → 1쿼리 통합)
  const { data: allPlans } = await supabase
    .from("student_plan")
    .select("plan_group_id, planned_end_page_or_time, completed_amount, status")
    .eq("student_id", studentId)
    .in("plan_group_id", groupIds)
    .not("plan_group_id", "is", null);

  // 3. 통계 계산 (메모리 내 단일 순회)
  const planCountsMap = new Map<string, number>();
  const completionMap = new Map<
    string,
    { completedCount: number; totalCount: number; isCompleted: boolean }
  >();
  const statusBreakdownMap = new Map<
    string,
    { pending: number; inProgress: number; completed: number }
  >();
  const plansByGroup = new Map<
    string,
    Array<{ planned_end: number | null; completed: number | null }>
  >();

  (allPlans || []).forEach((plan) => {
    if (!plan.plan_group_id) return;
    const gid = plan.plan_group_id;

    // 플랜 개수
    planCountsMap.set(gid, (planCountsMap.get(gid) || 0) + 1);

    // 상태별 개수
    const breakdown = statusBreakdownMap.get(gid) || {
      pending: 0,
      inProgress: 0,
      completed: 0,
    };
    if (plan.status === "pending") {
      breakdown.pending++;
    } else if (plan.status === "in_progress") {
      breakdown.inProgress++;
    } else if (plan.status === "completed") {
      breakdown.completed++;
    }
    statusBreakdownMap.set(gid, breakdown);

    // 완료 상태 데이터 수집
    const groupPlans = plansByGroup.get(gid) || [];
    groupPlans.push({
      planned_end: plan.planned_end_page_or_time ?? null,
      completed: plan.completed_amount ?? null,
    });
    plansByGroup.set(gid, groupPlans);
  });

  // 완료 상태 계산
  plansByGroup.forEach((groupPlans, groupId) => {
    const totalCount = groupPlans.length;
    let completedCount = 0;

    groupPlans.forEach((plan) => {
      if (
        plan.planned_end !== null &&
        plan.completed !== null &&
        plan.completed >= plan.planned_end
      ) {
        completedCount++;
      }
    });

    const isCompleted =
      totalCount > 0 &&
      completedCount === totalCount &&
      groupPlans.every((plan) => {
        if (plan.planned_end === null) return false;
        return plan.completed !== null && plan.completed >= plan.planned_end;
      });

    completionMap.set(groupId, {
      completedCount,
      totalCount,
      isCompleted,
    });
  });

  // 4. 결과 병합
  return groups.map((group) => {
    const planCount = planCountsMap.get(group.id) || 0;
    const completion = completionMap.get(group.id) || {
      completedCount: 0,
      totalCount: planCount,
      isCompleted: false,
    };

    // 완료 상태 표시 (실제 완료되었고 현재 상태가 completed가 아니면 표시용으로 completed)
    let displayStatus = group.status;
    if (
      completion.isCompleted &&
      group.status !== "completed" &&
      group.status !== "cancelled"
    ) {
      displayStatus = "completed";
    }

    const statusBreakdown = statusBreakdownMap.get(group.id) || {
      pending: 0,
      inProgress: 0,
      completed: 0,
    };

    return {
      ...group,
      status: displayStatus as typeof group.status,
      planCount,
      completedCount: completion.completedCount,
      totalCount: completion.totalCount,
      isCompleted: completion.isCompleted,
      statusBreakdown,
    };
  });
}

/**
 * 단일 플랜 그룹의 콘텐츠 요약 조회
 */
export async function getPlanGroupContentSummary(
  planGroupId: string
): Promise<PlanGroupContentSummary> {
  const supabase = await createSupabaseServerClient();

  // 기본 응답
  const defaultSummary: PlanGroupContentSummary = {
    bookCount: 0,
    lectureCount: 0,
    customCount: 0,
    totalContentCount: 0,
    contentNames: [],
  };

  try {
    // 1. plan_contents에서 콘텐츠 유형별 개수 및 이름 조회
    const { data: planContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select("content_type, content_name")
      .eq("plan_group_id", planGroupId)
      .order("display_order", { ascending: true });

    if (contentsError) {
      logActionError(
        { domain: "data", action: "getPlanGroupContentSummary" },
        contentsError,
        { context: "plan_contents 조회 오류" }
      );
      return defaultSummary;
    }

    // 2. 콘텐츠 유형별 개수 집계
    let bookCount = 0;
    let lectureCount = 0;
    let customCount = 0;
    const contentNames: string[] = [];

    for (const content of planContents || []) {
      switch (content.content_type) {
        case "book":
          bookCount++;
          break;
        case "lecture":
          lectureCount++;
          break;
        case "custom":
          customCount++;
          break;
      }

      // 콘텐츠 이름 수집 (최대 4개)
      if (content.content_name && contentNames.length < 4) {
        contentNames.push(content.content_name);
      }
    }

    return {
      bookCount,
      lectureCount,
      customCount,
        totalContentCount: planContents?.length ?? 0,
      contentNames,
    };
  } catch (error) {
    logActionError(
      { domain: "data", action: "getPlanGroupContentSummary" },
      error instanceof Error ? error : new Error(String(error))
    );
    return defaultSummary;
  }
}

/**
 * 여러 플랜 그룹의 콘텐츠 요약 일괄 조회
 */
export async function getPlanGroupContentSummaries(
  planGroupIds: string[]
): Promise<Map<string, PlanGroupContentSummary>> {
  const supabase = await createSupabaseServerClient();
  const summaryMap = new Map<string, PlanGroupContentSummary>();

  if (planGroupIds.length === 0) {
    return summaryMap;
  }

  // 기본값 초기화
  for (const id of planGroupIds) {
    summaryMap.set(id, {
      bookCount: 0,
      lectureCount: 0,
      customCount: 0,
        totalContentCount: 0,
      contentNames: [],
    });
  }

  try {
    // 1. plan_contents 일괄 조회
    const { data: planContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select("plan_group_id, content_type, content_name")
      .in("plan_group_id", planGroupIds)
      .order("display_order", { ascending: true });

    if (contentsError) {
      logActionError(
        { domain: "data", action: "getPlanGroupContentSummaries" },
        contentsError,
        { context: "plan_contents 조회 오류" }
      );
    }

    // 2. plan_contents 집계
    for (const content of planContents || []) {
      const summary = summaryMap.get(content.plan_group_id);
      if (!summary) continue;

      switch (content.content_type) {
        case "book":
          summary.bookCount++;
          break;
        case "lecture":
          summary.lectureCount++;
          break;
        case "custom":
          summary.customCount++;
          break;
      }

      if (content.content_name && summary.contentNames.length < 4) {
        summary.contentNames.push(content.content_name);
      }
    }

    // 3. 총 개수 계산
    for (const [, summary] of summaryMap) {
      summary.totalContentCount =
        summary.bookCount +
        summary.lectureCount +
        summary.customCount;
    }

    return summaryMap;
  } catch (error) {
    logActionError(
      { domain: "data", action: "getPlanGroupContentSummaries" },
      error instanceof Error ? error : new Error(String(error))
    );
    return summaryMap;
  }
}
