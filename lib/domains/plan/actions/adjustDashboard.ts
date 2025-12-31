"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { revalidatePath } from "next/cache";

// ============================================
// Types
// ============================================

// Supabase 쿼리 결과 타입 (relations 포함)
type PlanContentWithRelation = {
  id: string;
  content_id: string;
  content_title?: string | null;
  is_paused?: boolean | null;
  custom_study_days?: number[] | null;
  contents: {
    name?: string | null;
    type?: "book" | "lecture" | "custom" | null;
    subject?: string | null;
  } | null;
};

type PlanGroupWithContents = {
  id: string;
  student_id: string;
  weekdays?: number[] | null;
  scheduler_options?: Record<string, unknown> | null;
  plan_contents: PlanContentWithRelation[];
};

type PlanWithPlanGroups = {
  id: string;
  plan_date?: string | null;
  content_id?: string | null;
  plan_group_id?: string | null;
  status?: string | null;
  plan_groups: {
    student_id: string;
  };
};

type PlanContentWithPlanGroups = {
  id: string;
  content_id: string;
  plan_groups: {
    student_id: string;
  };
};

export type DashboardPlan = {
  id: string;
  planDate: string;
  contentId: string;
  contentTitle: string;
  contentType: "book" | "lecture" | "custom";
  subject: string | null;
  rangeStart: number;
  rangeEnd: number;
  estimatedMinutes: number;
  status: "pending" | "in_progress" | "completed";
  containerType: "daily" | "weekly" | "unfinished";
  planGroupId: string;
  displayOrder: number;
  color: string;
};

export type DashboardContent = {
  id: string;
  contentId: string;
  contentTitle: string;
  contentType: "book" | "lecture" | "custom";
  subject: string | null;
  totalPlans: number;
  completedPlans: number;
  progressPercent: number;
  isPaused: boolean;
  color: string;
  planGroupId: string;
  weekdays: number[];
};

export type DashboardData = {
  plans: Record<string, DashboardPlan[]>; // date -> plans
  contents: DashboardContent[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  conflicts: ConflictInfo[];
  recommendations: RecommendationInfo[];
};

export type ConflictInfo = {
  date: string;
  type: "overload" | "time_conflict";
  message: string;
  involvedPlanIds: string[];
  totalMinutes: number;
  recommendedMaxMinutes: number;
};

export type RecommendationInfo = {
  type: "balance" | "move" | "split";
  message: string;
  fromDate?: string;
  toDate?: string;
  planIds?: string[];
};

// 콘텐츠 색상 팔레트
const CONTENT_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
];

// ============================================
// Get Dashboard Data
// ============================================

export async function getDashboardData(
  planGroupId: string,
  options?: {
    weekOffset?: number; // 0 = 이번 주, 1 = 다음 주, -1 = 지난 주
    weeksToShow?: number; // 표시할 주 수 (기본: 2)
  }
): Promise<{
  success: boolean;
  data?: DashboardData;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const tenantContext = await getTenantContext();
    const supabase = await createSupabaseServerClient();

    const weekOffset = options?.weekOffset ?? 0;
    const weeksToShow = options?.weeksToShow ?? 2;

    // 날짜 범위 계산
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfRange = new Date(startOfWeek);
    endOfRange.setDate(startOfWeek.getDate() + weeksToShow * 7 - 1);

    const startDate = startOfWeek.toISOString().split("T")[0];
    const endDate = endOfRange.toISOString().split("T")[0];

    // 플랜 그룹 확인
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("*, plan_contents(*, contents(*))")
      .eq("id", planGroupId)
      .eq("student_id", user.userId)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "Plan group not found" };
    }

    // 플랜 조회
    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select(`
        id,
        plan_date,
        content_id,
        content_title,
        content_type,
        planned_start_page_or_time,
        planned_end_page_or_time,
        estimated_duration_minutes,
        status,
        container_type,
        plan_group_id,
        display_order
      `)
      .eq("plan_group_id", planGroupId)
      .eq("is_active", true)
      .gte("plan_date", startDate)
      .lte("plan_date", endDate)
      .order("plan_date", { ascending: true })
      .order("display_order", { ascending: true });

    if (plansError) {
      return { success: false, error: plansError.message };
    }

    // 콘텐츠 정보 정리
    const contentMap = new Map<string, DashboardContent>();
    const typedPlanGroup = planGroup as unknown as PlanGroupWithContents;
    const planContents = typedPlanGroup.plan_contents || [];

    planContents.forEach((pc, index: number) => {
      const content = pc.contents;
      const contentId = pc.content_id;

      contentMap.set(contentId, {
        id: pc.id,
        contentId,
        contentTitle: content?.name || pc.content_title || "Unknown",
        contentType: content?.type || "book",
        subject: content?.subject || null,
        totalPlans: 0,
        completedPlans: 0,
        progressPercent: 0,
        isPaused: pc.is_paused || false,
        color: CONTENT_COLORS[index % CONTENT_COLORS.length],
        planGroupId,
        weekdays: pc.custom_study_days || typedPlanGroup.weekdays || [1, 2, 3, 4, 5],
      });
    });

    // 플랜을 날짜별로 그룹화
    const plansByDate: Record<string, DashboardPlan[]> = {};
    const planCounts = new Map<string, { total: number; completed: number }>();

    for (const plan of plans || []) {
      const date = plan.plan_date;
      if (!plansByDate[date]) {
        plansByDate[date] = [];
      }

      const contentId = plan.content_id;
      const contentInfo = contentMap.get(contentId);

      plansByDate[date].push({
        id: plan.id,
        planDate: date,
        contentId,
        contentTitle: plan.content_title || "Unknown",
        contentType: (plan.content_type as "book" | "lecture" | "custom") || "book",
        subject: contentInfo?.subject || null,
        rangeStart: plan.planned_start_page_or_time || 0,
        rangeEnd: plan.planned_end_page_or_time || 0,
        estimatedMinutes: plan.estimated_duration_minutes || 30,
        status: plan.status as "pending" | "in_progress" | "completed",
        containerType: (plan.container_type as "daily" | "weekly" | "unfinished") || "daily",
        planGroupId: plan.plan_group_id,
        displayOrder: plan.display_order || 0,
        color: contentInfo?.color || CONTENT_COLORS[0],
      });

      // 콘텐츠별 통계 업데이트
      const counts = planCounts.get(contentId) || { total: 0, completed: 0 };
      counts.total++;
      if (plan.status === "completed") {
        counts.completed++;
      }
      planCounts.set(contentId, counts);
    }

    // 콘텐츠 진행률 계산
    for (const [contentId, counts] of planCounts) {
      const content = contentMap.get(contentId);
      if (content) {
        content.totalPlans = counts.total;
        content.completedPlans = counts.completed;
        content.progressPercent = counts.total > 0
          ? Math.round((counts.completed / counts.total) * 100)
          : 0;
      }
    }

    // 충돌 감지
    const conflicts: ConflictInfo[] = [];
    const recommendedMaxMinutes = 180; // 3시간

    for (const [date, datePlans] of Object.entries(plansByDate)) {
      const totalMinutes = datePlans.reduce((sum, p) => sum + p.estimatedMinutes, 0);

      if (totalMinutes > recommendedMaxMinutes) {
        conflicts.push({
          date,
          type: "overload",
          message: `${date}: 총 ${Math.round(totalMinutes / 60)}시간 ${totalMinutes % 60}분으로 권장치(${Math.round(recommendedMaxMinutes / 60)}시간)를 초과합니다.`,
          involvedPlanIds: datePlans.map((p) => p.id),
          totalMinutes,
          recommendedMaxMinutes,
        });
      }
    }

    // 추천 생성
    const recommendations: RecommendationInfo[] = [];

    // 학습량 불균형 체크
    const datesWithPlans = Object.keys(plansByDate);
    if (datesWithPlans.length > 0) {
      const minutesByDate = datesWithPlans.map((d) => ({
        date: d,
        minutes: plansByDate[d].reduce((sum, p) => sum + p.estimatedMinutes, 0),
      }));

      const avgMinutes = minutesByDate.reduce((sum, d) => sum + d.minutes, 0) / minutesByDate.length;
      const overloadDays = minutesByDate.filter((d) => d.minutes > avgMinutes * 1.5);
      const lightDays = minutesByDate.filter((d) => d.minutes < avgMinutes * 0.5);

      if (overloadDays.length > 0 && lightDays.length > 0) {
        recommendations.push({
          type: "balance",
          message: `일부 날짜의 학습량이 불균형합니다. 학습량이 많은 날에서 적은 날로 플랜을 이동해보세요.`,
          fromDate: overloadDays[0].date,
          toDate: lightDays[0].date,
        });
      }
    }

    return {
      success: true,
      data: {
        plans: plansByDate,
        contents: Array.from(contentMap.values()),
        dateRange: { startDate, endDate },
        conflicts,
        recommendations,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Move Plan to Different Date
// ============================================

export async function movePlanToDate(
  planId: string,
  newDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 확인
    const { data: plan, error: fetchError } = await supabase
      .from("student_plan")
      .select("*, plan_groups!inner(student_id)")
      .eq("id", planId)
      .single();

    if (fetchError || !plan) {
      return { success: false, error: "Plan not found" };
    }

    // 권한 확인
    const typedPlan = plan as unknown as PlanWithPlanGroups;
    if (typedPlan.plan_groups?.student_id !== user.userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 날짜 변경
    const { error: updateError } = await supabase
      .from("student_plan")
      .update({
        plan_date: newDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/plan/adjust");
    revalidatePath("/today");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Swap Plans
// ============================================

export async function swapPlans(
  planId1: string,
  planId2: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 두 플랜 조회
    const { data: plans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, plan_date, plan_groups!inner(student_id)")
      .in("id", [planId1, planId2]);

    if (fetchError || !plans || plans.length !== 2) {
      return { success: false, error: "Plans not found" };
    }

    // 권한 확인
    const typedPlans = plans as unknown as PlanWithPlanGroups[];
    const allOwned = typedPlans.every((p) => p.plan_groups?.student_id === user.userId);
    if (!allOwned) {
      return { success: false, error: "Unauthorized" };
    }

    const plan1 = plans.find((p) => p.id === planId1);
    const plan2 = plans.find((p) => p.id === planId2);

    if (!plan1 || !plan2) {
      return { success: false, error: "Plans not found" };
    }

    // 날짜 교환
    const { error: update1Error } = await supabase
      .from("student_plan")
      .update({ plan_date: plan2.plan_date, updated_at: new Date().toISOString() })
      .eq("id", planId1);

    if (update1Error) {
      return { success: false, error: update1Error.message };
    }

    const { error: update2Error } = await supabase
      .from("student_plan")
      .update({ plan_date: plan1.plan_date, updated_at: new Date().toISOString() })
      .eq("id", planId2);

    if (update2Error) {
      return { success: false, error: update2Error.message };
    }

    revalidatePath("/plan/adjust");
    revalidatePath("/today");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Auto Balance Plans
// ============================================

export async function autoBalancePlans(
  planGroupId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    maxMinutesPerDay?: number;
  }
): Promise<{ success: boolean; movedPlans?: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();
    const maxMinutes = options?.maxMinutesPerDay ?? 180;

    // 날짜 범위 설정
    const today = new Date();
    const startDate = options?.startDate ?? today.toISOString().split("T")[0];
    const endDateObj = new Date(today);
    endDateObj.setDate(today.getDate() + 14); // 2주
    const endDate = options?.endDate ?? endDateObj.toISOString().split("T")[0];

    // 플랜 그룹 확인 및 학습 요일 조회
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("weekdays, student_id")
      .eq("id", planGroupId)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "Plan group not found" };
    }

    if (planGroup.student_id !== user.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const weekdays = planGroup.weekdays || [1, 2, 3, 4, 5];

    // 해당 기간의 모든 플랜 조회
    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select("*")
      .eq("plan_group_id", planGroupId)
      .eq("is_active", true)
      .gte("plan_date", startDate)
      .lte("plan_date", endDate)
      .in("status", ["pending"])
      .order("plan_date", { ascending: true });

    if (plansError) {
      return { success: false, error: plansError.message };
    }

    if (!plans || plans.length === 0) {
      return { success: true, movedPlans: 0 };
    }

    // 날짜별 플랜 그룹화
    const plansByDate: Record<string, typeof plans> = {};
    for (const plan of plans) {
      const date = plan.plan_date;
      if (!plansByDate[date]) {
        plansByDate[date] = [];
      }
      plansByDate[date].push(plan);
    }

    // 과부하 날짜 찾기 및 재배치
    let movedCount = 0;
    const availableDates: string[] = [];

    // 가용 날짜 생성
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    while (currentDate <= end) {
      if (weekdays.includes(currentDate.getDay())) {
        availableDates.push(currentDate.toISOString().split("T")[0]);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (const date of Object.keys(plansByDate).sort()) {
      const datePlans = plansByDate[date];
      const totalMinutes = datePlans.reduce(
        (sum, p) => sum + (p.estimated_duration_minutes || 30),
        0
      );

      if (totalMinutes > maxMinutes) {
        // 초과분을 다른 날로 이동
        let excessMinutes = totalMinutes - maxMinutes;

        for (let i = datePlans.length - 1; i >= 0 && excessMinutes > 0; i--) {
          const plan = datePlans[i];
          const planMinutes = plan.estimated_duration_minutes || 30;

          // 가용한 날짜 중 여유가 있는 날 찾기
          for (const targetDate of availableDates) {
            if (targetDate <= date) continue;

            const targetPlans = plansByDate[targetDate] || [];
            const targetMinutes = targetPlans.reduce(
              (sum, p) => sum + (p.estimated_duration_minutes || 30),
              0
            );

            if (targetMinutes + planMinutes <= maxMinutes) {
              // 이동
              await supabase
                .from("student_plan")
                .update({
                  plan_date: targetDate,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", plan.id);

              movedCount++;
              excessMinutes -= planMinutes;

              // 로컬 상태 업데이트
              if (!plansByDate[targetDate]) {
                plansByDate[targetDate] = [];
              }
              plansByDate[targetDate].push({ ...plan, plan_date: targetDate });
              datePlans.splice(i, 1);

              break;
            }
          }
        }
      }
    }

    revalidatePath("/plan/adjust");
    revalidatePath("/today");

    return { success: true, movedPlans: movedCount };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Toggle Content Pause
// ============================================

export async function toggleContentPause(
  planContentId: string,
  isPaused: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 콘텐츠 확인 및 권한 검사
    const { data: planContent, error: fetchError } = await supabase
      .from("plan_contents")
      .select("*, plan_groups!inner(student_id)")
      .eq("id", planContentId)
      .single();

    if (fetchError || !planContent) {
      return { success: false, error: "Plan content not found" };
    }

    const typedPlanContent = planContent as unknown as PlanContentWithPlanGroups;
    if (typedPlanContent.plan_groups?.student_id !== user.userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 일시정지 상태 변경
    const { error: updateError } = await supabase
      .from("plan_contents")
      .update({
        is_paused: isPaused,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planContentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/plan/adjust");
    revalidatePath("/today");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Move Multiple Plans to Date
// ============================================

export async function moveMultiplePlansToDate(
  planIds: string[],
  newDate: string
): Promise<{ success: boolean; movedCount?: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (planIds.length === 0) {
      return { success: false, error: "No plans selected" };
    }

    const supabase = await createSupabaseServerClient();

    // 과거 날짜 체크
    const today = new Date().toISOString().split("T")[0];
    if (newDate < today) {
      return { success: false, error: "Cannot move to past date" };
    }

    // 플랜들 확인 및 권한 검사
    const { data: plans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, status, plan_groups!inner(student_id)")
      .in("id", planIds);

    if (fetchError || !plans || plans.length === 0) {
      return { success: false, error: "Plans not found" };
    }

    // 권한 확인 및 이동 가능 여부 체크
    const typedPlans = plans as unknown as PlanWithPlanGroups[];
    const validPlanIds = typedPlans
      .filter((p) =>
        p.plan_groups?.student_id === user.userId &&
        p.status === "pending"
      )
      .map((p) => p.id);

    if (validPlanIds.length === 0) {
      return { success: false, error: "No movable plans found" };
    }

    // 일괄 이동
    const { error: updateError } = await supabase
      .from("student_plan")
      .update({
        plan_date: newDate,
        updated_at: new Date().toISOString(),
      })
      .in("id", validPlanIds);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/plan/adjust");
    revalidatePath("/today");

    return { success: true, movedCount: validPlanIds.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Delete Multiple Plans
// ============================================

export async function deleteMultiplePlans(
  planIds: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (planIds.length === 0) {
      return { success: false, error: "No plans selected" };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜들 확인 및 권한 검사
    const { data: plans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, status, plan_groups!inner(student_id)")
      .in("id", planIds);

    if (fetchError || !plans || plans.length === 0) {
      return { success: false, error: "Plans not found" };
    }

    // 권한 확인 및 삭제 가능 여부 체크 (완료된 플랜 제외)
    const typedPlans = plans as unknown as PlanWithPlanGroups[];
    const validPlanIds = typedPlans
      .filter((p) =>
        p.plan_groups?.student_id === user.userId &&
        p.status !== "completed"
      )
      .map((p) => p.id);

    if (validPlanIds.length === 0) {
      return { success: false, error: "No deletable plans found" };
    }

    // 일괄 소프트 삭제
    const { error: updateError } = await supabase
      .from("student_plan")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", validPlanIds);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/plan/adjust");
    revalidatePath("/today");

    return { success: true, deletedCount: validPlanIds.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Delete Plan
// ============================================

export async function deletePlan(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 확인 및 권한 검사
    const { data: plan, error: fetchError } = await supabase
      .from("student_plan")
      .select("*, plan_groups!inner(student_id)")
      .eq("id", planId)
      .single();

    if (fetchError || !plan) {
      return { success: false, error: "Plan not found" };
    }

    const typedPlan = plan as unknown as PlanWithPlanGroups;
    if (typedPlan.plan_groups?.student_id !== user.userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 완료된 플랜은 삭제 불가
    if (plan.status === "completed") {
      return { success: false, error: "Cannot delete completed plan" };
    }

    // 소프트 삭제 (is_active = false)
    const { error: updateError } = await supabase
      .from("student_plan")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/plan/adjust");
    revalidatePath("/today");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
