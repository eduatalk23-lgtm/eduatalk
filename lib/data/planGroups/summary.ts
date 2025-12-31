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

  // 2. 플랜 개수 및 완료 상태 조회 (배치)
  const [planCountsResult, planCompletionResult, planStatusResult] = await Promise.all([
    // 플랜 개수 조회
    supabase
      .from("student_plan")
      .select("plan_group_id")
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds),
    // 플랜 완료 상태 조회
    supabase
      .from("student_plan")
      .select(
        "plan_group_id, planned_end_page_or_time, completed_amount"
      )
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds)
      .not("plan_group_id", "is", null),
    // 플랜 상태별 개수 조회
    supabase
      .from("student_plan")
      .select("plan_group_id, status")
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds)
      .not("plan_group_id", "is", null),
  ]);

  // 3. 통계 계산
  const planCountsMap = new Map<string, number>();
  (planCountsResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      planCountsMap.set(
        plan.plan_group_id,
        (planCountsMap.get(plan.plan_group_id) || 0) + 1
      );
    }
  });

  const completionMap = new Map<
    string,
    { completedCount: number; totalCount: number; isCompleted: boolean }
  >();

  // 상태별 개수 계산
  const statusBreakdownMap = new Map<
    string,
    { pending: number; inProgress: number; completed: number }
  >();
  (planStatusResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      const breakdown = statusBreakdownMap.get(plan.plan_group_id) || {
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
      statusBreakdownMap.set(plan.plan_group_id, breakdown);
    }
  });

  // plan_group_id별로 그룹화
  const plansByGroup = new Map<
    string,
    Array<{ planned_end: number | null; completed: number | null }>
  >();

  (planCompletionResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      const groupPlans = plansByGroup.get(plan.plan_group_id) || [];
      groupPlans.push({
        planned_end: plan.planned_end_page_or_time ?? null,
        completed: plan.completed_amount ?? null,
      });
      plansByGroup.set(plan.plan_group_id, groupPlans);
    }
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
    adHocCount: 0,
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

    // 2. ad_hoc_plans에서 연결된 플랜 개수 조회
    const { count: adHocCount, error: adHocError } = await supabase
      .from("ad_hoc_plans")
      .select("*", { count: "exact", head: true })
      .eq("plan_group_id", planGroupId);

    if (adHocError) {
      logActionError(
        { domain: "data", action: "getPlanGroupContentSummary" },
        adHocError,
        { context: "ad_hoc_plans 조회 오류" }
      );
    }

    // 3. 콘텐츠 유형별 개수 집계
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
      adHocCount: adHocCount ?? 0,
      totalContentCount: (planContents?.length ?? 0) + (adHocCount ?? 0),
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
      adHocCount: 0,
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

    // 2. ad_hoc_plans 일괄 조회 (plan_group_id별 개수)
    const { data: adHocCounts, error: adHocError } = await supabase
      .from("ad_hoc_plans")
      .select("plan_group_id")
      .in("plan_group_id", planGroupIds);

    if (adHocError) {
      logActionError(
        { domain: "data", action: "getPlanGroupContentSummaries" },
        adHocError,
        { context: "ad_hoc_plans 조회 오류" }
      );
    }

    // 3. ad_hoc_plans 개수 집계
    const adHocCountMap = new Map<string, number>();
    for (const item of adHocCounts || []) {
      if (item.plan_group_id) {
        adHocCountMap.set(
          item.plan_group_id,
          (adHocCountMap.get(item.plan_group_id) ?? 0) + 1
        );
      }
    }

    // 4. plan_contents 집계
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

    // 5. ad_hoc 개수 및 총 개수 계산
    for (const [id, summary] of summaryMap) {
      summary.adHocCount = adHocCountMap.get(id) ?? 0;
      summary.totalContentCount =
        summary.bookCount +
        summary.lectureCount +
        summary.customCount +
        summary.adHocCount;
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
