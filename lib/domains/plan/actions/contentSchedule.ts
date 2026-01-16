"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";
import type { StudentPlan, PlanContent } from "@/lib/domains/plan/types";
import { logActionWarn } from "@/lib/logging/actionLogger";

// ============================================
// Types
// ============================================

export type ActionResult = {
  success: boolean;
  error?: string;
};

export type ContentScheduleUpdate = {
  startDate?: string;
  endDate?: string;
  pageRange?: { start: number; end: number };
  redistributeRemaining?: boolean;
};

export type ContentAddInput = {
  type: "book" | "lecture" | "custom";
  contentId?: string;
  masterContentId?: string;
  customTitle?: string;
  pageRange?: { start: number; end: number };
  distributionMode: "append" | "redistribute";
};

export type ContentProgress = {
  contentId: string;
  totalPlans: number;
  completedPlans: number;
  pendingPlans: number;
  inProgressPlans: number;
  progressPercent: number;
  totalPages: number;
  completedPages: number;
};

/**
 * 분량 재배분 옵션
 */
export type RedistributeVolumeOptions = {
  /** 재배분 전략 */
  strategy: "same_subject" | "all_contents" | "to_adhoc";
  /** 삭제된 콘텐츠의 미완료 분량만 재배분 (기본값: true) */
  onlyRemaining?: boolean;
};

/**
 * 재배분 결과
 */
export type RedistributeResult = {
  success: boolean;
  error?: string;
  /** 재배분된 총 분량 */
  redistributedVolume?: number;
  /** 재배분 대상 콘텐츠 수 */
  affectedContents?: number;
  /** 생성된 일회성 플랜 수 (to_adhoc 전략 시) */
  createdAdHocPlans?: number;
};

// ============================================
// Content-based Plan Queries
// ============================================

/**
 * 플랜 그룹 내 특정 콘텐츠의 플랜 목록 조회
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 */
export async function getPlansForContent(
  planGroupId: string,
  contentId: string
): Promise<{ success: boolean; data?: StudentPlan[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("student_plan")
      .select("*")
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .eq("is_active", true)
      .order("plan_date", { ascending: true })
      .order("sequence", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as StudentPlan[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 콘텐츠별 진행률 조회
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 */
export async function getContentProgress(
  planGroupId: string,
  contentId: string
): Promise<{ success: boolean; data?: ContentProgress; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 해당 콘텐츠의 플랜들 조회
    const { data: plans, error } = await supabase
      .from("student_plan")
      .select(
        "id, status, planned_start_page_or_time, planned_end_page_or_time, completed_amount"
      )
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .eq("is_active", true);

    if (error) {
      return { success: false, error: error.message };
    }

    const totalPlans = plans?.length ?? 0;
    const completedPlans =
      plans?.filter((p) => p.status === "completed").length ?? 0;
    const pendingPlans =
      plans?.filter((p) => p.status === "pending").length ?? 0;
    const inProgressPlans =
      plans?.filter((p) => p.status === "in_progress").length ?? 0;

    // 총 페이지 및 완료 페이지 계산
    let totalPages = 0;
    let completedPages = 0;

    for (const plan of plans ?? []) {
      const planPages =
        (plan.planned_end_page_or_time ?? 0) -
        (plan.planned_start_page_or_time ?? 0);
      totalPages += planPages;

      if (plan.status === "completed") {
        completedPages += planPages;
      } else if (plan.completed_amount) {
        completedPages += plan.completed_amount;
      }
    }

    const progressPercent =
      totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;

    return {
      success: true,
      data: {
        contentId,
        totalPlans,
        completedPlans,
        pendingPlans,
        inProgressPlans,
        progressPercent,
        totalPages,
        completedPages,
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
// Content Schedule Updates
// ============================================

/**
 * 콘텐츠 일정 수정 (범위, 날짜)
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 * @param updates 업데이트 내용
 */
export async function updateContentSchedule(
  planGroupId: string,
  contentId: string,
  updates: ContentScheduleUpdate
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const isAdmin = user.role === "admin" || user.role === "superadmin";
    if (!isAdmin) {
      return { success: false, error: "Admin access required" };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 정보 조회
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("id, student_id, tenant_id")
      .eq("id", planGroupId)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "Plan group not found" };
    }

    // plan_contents에서 해당 콘텐츠 조회
    const { data: planContent, error: contentError } = await supabase
      .from("plan_contents")
      .select("*")
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .single();

    if (contentError || !planContent) {
      return { success: false, error: "Content not found in plan group" };
    }

    // 페이지 범위 업데이트가 있는 경우
    if (updates.pageRange) {
      const { error: updateError } = await supabase
        .from("plan_contents")
        .update({
          start_range: updates.pageRange.start,
          end_range: updates.pageRange.end,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planContent.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    // 날짜 범위 업데이트가 있는 경우 - 해당 콘텐츠의 플랜들의 날짜 재배치
    if (updates.startDate || updates.endDate) {
      const { data: plans, error: plansError } = await supabase
        .from("student_plan")
        .select("*")
        .eq("plan_group_id", planGroupId)
        .eq("content_id", contentId)
        .eq("is_active", true)
        .order("plan_date", { ascending: true });

      if (plansError) {
        return { success: false, error: plansError.message };
      }

      if (plans && plans.length > 0 && updates.startDate && updates.endDate) {
        // 기간 내에 플랜 재배치 (균등 분배)
        const startDate = new Date(updates.startDate);
        const endDate = new Date(updates.endDate);
        const totalDays = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        const plansPerDay = Math.ceil(plans.length / totalDays);

        let currentDayIndex = 0;
        let plansOnCurrentDay = 0;

        for (const plan of plans) {
          const newDate = new Date(startDate);
          newDate.setDate(startDate.getDate() + currentDayIndex);
          const newDateStr = newDate.toISOString().split("T")[0];

          const { error: updateError } = await supabase
            .from("student_plan")
            .update({
              plan_date: newDateStr,
              updated_at: new Date().toISOString(),
            })
            .eq("id", plan.id);

          if (updateError) {
            logActionWarn(
              { domain: "plan", action: "updateContentSchedule" },
              "Failed to update plan date",
              { planId: plan.id, error: updateError.message }
            );
          }

          plansOnCurrentDay++;
          if (plansOnCurrentDay >= plansPerDay && currentDayIndex < totalDays - 1) {
            currentDayIndex++;
            plansOnCurrentDay = 0;
          }
        }
      }
    }

    revalidatePath(`/admin/students/${planGroup.student_id}/plans`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Content Reordering
// ============================================

/**
 * 플랜 그룹 내 콘텐츠 순서 변경
 * @param planGroupId 플랜 그룹 ID
 * @param contentOrder 콘텐츠 ID 배열 (새로운 순서대로)
 */
export async function reorderContents(
  planGroupId: string,
  contentOrder: string[]
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const isAdmin = user.role === "admin" || user.role === "superadmin";
    if (!isAdmin) {
      return { success: false, error: "Admin access required" };
    }

    const supabase = await createSupabaseServerClient();

    // 순서 업데이트
    for (let i = 0; i < contentOrder.length; i++) {
      const { error } = await supabase
        .from("plan_contents")
        .update({
          display_order: i + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("plan_group_id", planGroupId)
        .eq("content_id", contentOrder[i]);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    // 플랜 그룹 정보 조회 (revalidate용)
    const { data: planGroup } = await supabase
      .from("plan_groups")
      .select("student_id")
      .eq("id", planGroupId)
      .single();

    if (planGroup) {
      revalidatePath(`/admin/students/${planGroup.student_id}/plans`);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Add/Remove Content
// ============================================

/**
 * 기존 플랜 그룹에 새 콘텐츠 추가
 * @param planGroupId 플랜 그룹 ID
 * @param content 추가할 콘텐츠 정보
 */
export async function addContentToGroup(
  planGroupId: string,
  content: ContentAddInput
): Promise<ActionResult & { contentId?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const isAdmin = user.role === "admin" || user.role === "superadmin";
    if (!isAdmin) {
      return { success: false, error: "Admin access required" };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 정보 조회
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("id, student_id, tenant_id")
      .eq("id", planGroupId)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "Plan group not found" };
    }

    // 현재 최대 display_order 조회
    const { data: existingContents } = await supabase
      .from("plan_contents")
      .select("display_order")
      .eq("plan_group_id", planGroupId)
      .order("display_order", { ascending: false })
      .limit(1);

    const maxOrder = existingContents?.[0]?.display_order ?? 0;

    // 콘텐츠 ID 결정
    const contentId = content.contentId || crypto.randomUUID();

    // plan_contents에 추가
    const { error: insertError } = await supabase.from("plan_contents").insert({
      tenant_id: planGroup.tenant_id,
      plan_group_id: planGroupId,
      content_type: content.type,
      content_id: contentId,
      master_content_id: content.masterContentId || null,
      start_range: content.pageRange?.start ?? 1,
      end_range: content.pageRange?.end ?? 100,
      display_order: maxOrder + 1,
    });

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    revalidatePath(`/admin/students/${planGroup.student_id}/plans`);

    return { success: true, contentId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 삭제된 콘텐츠의 분량을 다른 콘텐츠에 재배분
 * @param planGroupId 플랜 그룹 ID
 * @param deletedContentInfo 삭제된 콘텐츠 정보
 * @param options 재배분 옵션
 */
async function redistributeVolumeFromDeleted(
  planGroupId: string,
  deletedContentInfo: {
    contentId: string;
    subject: string | null;
    remainingVolume: number;
    rangeUnit: string;
  },
  options: RedistributeVolumeOptions
): Promise<RedistributeResult> {
  const supabase = await createSupabaseServerClient();

  const { strategy, onlyRemaining = true } = options;

  if (deletedContentInfo.remainingVolume <= 0) {
    return {
      success: true,
      redistributedVolume: 0,
      affectedContents: 0,
    };
  }

  // 일회성 플랜으로 변환하는 전략
  if (strategy === "to_adhoc") {
    // plan_groups에서 student_id 조회
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("student_id, tenant_id")
      .eq("id", planGroupId)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "Plan group not found" };
    }

    // 일회성 플랜 생성
    const { error: adhocError } = await supabase.from("ad_hoc_plans").insert({
      tenant_id: planGroup.tenant_id,
      student_id: planGroup.student_id,
      title: `미완료 분량 (${deletedContentInfo.remainingVolume}${deletedContentInfo.rangeUnit})`,
      description: `삭제된 콘텐츠의 남은 분량입니다.`,
      plan_date: new Date().toISOString().split("T")[0],
      container_type: "weekly",
      status: "pending",
      priority: 2,
    });

    if (adhocError) {
      return { success: false, error: adhocError.message };
    }

    return {
      success: true,
      redistributedVolume: deletedContentInfo.remainingVolume,
      affectedContents: 0,
      createdAdHocPlans: 1,
    };
  }

  // 다른 콘텐츠에 분배하는 전략
  const query = supabase
    .from("plan_contents")
    .select("id, content_id, start_range, end_range")
    .eq("plan_group_id", planGroupId)
    .neq("content_id", deletedContentInfo.contentId);

  if (strategy === "same_subject" && deletedContentInfo.subject) {
    // 같은 과목의 콘텐츠만 필터 (master_content를 통해 subject 조회 필요)
    // 현재는 단순히 모든 콘텐츠에 분배
  }

  const { data: targetContents, error: contentsError } = await query;

  if (contentsError) {
    return { success: false, error: contentsError.message };
  }

  if (!targetContents || targetContents.length === 0) {
    // 대상 콘텐츠가 없으면 일회성 플랜으로 전환
    return redistributeVolumeFromDeleted(planGroupId, deletedContentInfo, {
      ...options,
      strategy: "to_adhoc",
    });
  }

  // 균등 분배
  const volumePerContent = Math.ceil(
    deletedContentInfo.remainingVolume / targetContents.length
  );

  let affectedCount = 0;
  for (const content of targetContents) {
    const newEndRange = (content.end_range ?? 0) + volumePerContent;

    const { error: updateError } = await supabase
      .from("plan_contents")
      .update({
        end_range: newEndRange,
        updated_at: new Date().toISOString(),
      })
      .eq("id", content.id);

    if (!updateError) {
      affectedCount++;
    }
  }

  return {
    success: true,
    redistributedVolume: deletedContentInfo.remainingVolume,
    affectedContents: affectedCount,
  };
}

/**
 * 플랜 그룹에서 콘텐츠 제거
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 * @param options 옵션 (분량 재배분 여부 및 전략)
 */
export async function removeContentFromGroup(
  planGroupId: string,
  contentId: string,
  options?: {
    redistributeVolume?: boolean;
    redistributeOptions?: RedistributeVolumeOptions;
  }
): Promise<ActionResult & { deletedPlansCount?: number; redistributeResult?: RedistributeResult }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const isAdmin = user.role === "admin" || user.role === "superadmin";
    if (!isAdmin) {
      return { success: false, error: "Admin access required" };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 정보 조회
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("id, student_id")
      .eq("id", planGroupId)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "Plan group not found" };
    }

    // 재배분을 위해 삭제 전 콘텐츠 정보 조회
    let contentInfo: {
      contentId: string;
      subject: string | null;
      remainingVolume: number;
      rangeUnit: string;
    } | null = null;

    if (options?.redistributeVolume) {
      // plan_contents 정보 조회
      const { data: planContent } = await supabase
        .from("plan_contents")
        .select("content_id, start_range, end_range, content_type, master_content_id")
        .eq("plan_group_id", planGroupId)
        .eq("content_id", contentId)
        .single();

      // 미완료 플랜 분량 계산
      const { data: incompletePlans } = await supabase
        .from("student_plan")
        .select("page_range_start, page_range_end")
        .eq("plan_group_id", planGroupId)
        .eq("content_id", contentId)
        .eq("is_active", true)
        .neq("status", "completed");

      const remainingVolume = incompletePlans?.reduce((sum, plan) => {
        return sum + ((plan.page_range_end ?? 0) - (plan.page_range_start ?? 0) + 1);
      }, 0) ?? 0;

      // master_content에서 subject 조회 (book 또는 lecture)
      let subject: string | null = null;
      if (planContent?.master_content_id) {
        if (planContent.content_type === "book") {
          const { data: masterBook } = await supabase
            .from("master_books")
            .select("subject")
            .eq("id", planContent.master_content_id)
            .single();
          subject = masterBook?.subject ?? null;
        } else if (planContent.content_type === "lecture") {
          const { data: masterLecture } = await supabase
            .from("master_lectures")
            .select("subject")
            .eq("id", planContent.master_content_id)
            .single();
          subject = masterLecture?.subject ?? null;
        }
      }

      contentInfo = {
        contentId,
        subject,
        remainingVolume,
        rangeUnit: planContent?.content_type === "lecture" ? "강" : "p",
      };
    }

    // 해당 콘텐츠의 플랜들 삭제 (soft delete)
    const { data: deletedPlans, error: plansError } = await supabase
      .from("student_plan")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .select("id");

    if (plansError) {
      return { success: false, error: plansError.message };
    }

    // plan_contents에서 삭제
    const { error: contentError } = await supabase
      .from("plan_contents")
      .delete()
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId);

    if (contentError) {
      return { success: false, error: contentError.message };
    }

    // 분량 재배분 로직 (옵션)
    let redistributeResult: RedistributeResult | undefined;
    if (options?.redistributeVolume && contentInfo) {
      const redistributeOptions = options.redistributeOptions ?? {
        strategy: "all_contents",
        onlyRemaining: true,
      };
      redistributeResult = await redistributeVolumeFromDeleted(
        planGroupId,
        contentInfo,
        redistributeOptions
      );
    }

    revalidatePath(`/admin/students/${planGroup.student_id}/plans`);

    return {
      success: true,
      deletedPlansCount: deletedPlans?.length ?? 0,
      redistributeResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Get All Contents for Plan Group
// ============================================

/**
 * 플랜 그룹의 모든 콘텐츠 목록 조회
 * @param planGroupId 플랜 그룹 ID
 */
export async function getContentsForPlanGroup(
  planGroupId: string
): Promise<{ success: boolean; data?: PlanContent[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("plan_contents")
      .select("*")
      .eq("plan_group_id", planGroupId)
      .order("display_order", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PlanContent[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Content-based Schedule Overview
// ============================================

/**
 * 콘텐츠별 스케줄 요약 정보
 */
export type ContentScheduleSummary = {
  contentId: string;
  contentTitle: string;
  contentType: "book" | "lecture" | "custom";
  subject: string | null;
  subjectCategory: string | null;
  // 범위 정보
  totalRange: number;
  startRange: number;
  endRange: number;
  rangeUnit: string;
  // 일정 정보
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  studyDays: number;
  // 분량 정보
  dailyAverage: number;
  // 진행률
  totalPlans: number;
  completedPlans: number;
  progressPercent: number;
  // 일별 플랜 배치
  dailyPlans: Array<{
    date: string;
    startPage: number;
    endPage: number;
    volume: number;
    status: "pending" | "in_progress" | "completed" | "skipped";
  }>;
  // 학습 요일 (0-6)
  studyWeekdays: number[];
};

/**
 * 플랜 그룹의 콘텐츠별 스케줄 요약 조회
 * @param planGroupId 플랜 그룹 ID
 */
export async function getContentScheduleOverview(
  planGroupId: string
): Promise<{
  success: boolean;
  data?: {
    contents: ContentScheduleSummary[];
    totalPlans: number;
    totalCompletedPlans: number;
    overallProgress: number;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 1. 플랜 그룹 정보 조회
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("id, period_start, period_end, student_id")
      .eq("id", planGroupId)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "Plan group not found" };
    }

    // 2. 플랜 콘텐츠 목록 조회
    const { data: planContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select("*")
      .eq("plan_group_id", planGroupId)
      .order("display_order", { ascending: true });

    if (contentsError) {
      return { success: false, error: contentsError.message };
    }

    if (!planContents || planContents.length === 0) {
      return {
        success: true,
        data: {
          contents: [],
          totalPlans: 0,
          totalCompletedPlans: 0,
          overallProgress: 0,
        },
      };
    }

    // 3. 모든 플랜 조회
    const { data: allPlans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        "id, content_id, plan_date, status, planned_start_page_or_time, planned_end_page_or_time, completed_amount"
      )
      .eq("plan_group_id", planGroupId)
      .eq("is_active", true)
      .order("plan_date", { ascending: true });

    if (plansError) {
      return { success: false, error: plansError.message };
    }

    // 4. 콘텐츠별로 그룹화
    const contentPlansMap = new Map<string, typeof allPlans>();
    for (const plan of allPlans ?? []) {
      const contentId = plan.content_id;
      if (!contentPlansMap.has(contentId)) {
        contentPlansMap.set(contentId, []);
      }
      contentPlansMap.get(contentId)!.push(plan);
    }

    // 5. 콘텐츠별 요약 생성
    const contentSummaries: ContentScheduleSummary[] = [];

    for (const content of planContents) {
      const contentPlans = contentPlansMap.get(content.content_id) ?? [];

      // 날짜 범위 계산
      const dates = contentPlans.map((p) => p.plan_date).filter(Boolean).sort();
      const startDate = dates[0] ?? null;
      const endDate = dates[dates.length - 1] ?? null;

      // 학습 요일 추출
      const weekdaysSet = new Set<number>();
      for (const plan of contentPlans) {
        if (plan.plan_date) {
          const dayOfWeek = new Date(plan.plan_date).getDay();
          weekdaysSet.add(dayOfWeek);
        }
      }
      const studyWeekdays = Array.from(weekdaysSet).sort((a, b) => a - b);

      // 진행률 계산
      const completedPlans = contentPlans.filter(
        (p) => p.status === "completed"
      ).length;
      const progressPercent =
        contentPlans.length > 0
          ? Math.round((completedPlans / contentPlans.length) * 100)
          : 0;

      // 범위 계산
      const startRange = content.start_range ?? 1;
      const endRange = content.end_range ?? 100;
      const totalRange = endRange - startRange + 1;

      // 일일 평균 계산
      const dailyAverage =
        contentPlans.length > 0
          ? Math.round(totalRange / contentPlans.length)
          : 0;

      // 총 일수 계산
      const totalDays =
        startDate && endDate
          ? Math.ceil(
              (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            ) + 1
          : 0;

      // 일별 플랜 배치
      const dailyPlans = contentPlans.map((plan) => ({
        date: plan.plan_date ?? "",
        startPage: plan.planned_start_page_or_time ?? 0,
        endPage: plan.planned_end_page_or_time ?? 0,
        volume:
          (plan.planned_end_page_or_time ?? 0) -
          (plan.planned_start_page_or_time ?? 0),
        status: (plan.status as "pending" | "in_progress" | "completed" | "skipped") ?? "pending",
      }));

      // 범위 단위 결정
      const rangeUnit = content.content_type === "lecture" ? "강" : "쪽";

      contentSummaries.push({
        contentId: content.content_id,
        contentTitle: content.title ?? `콘텐츠 ${content.content_id.slice(0, 8)}`,
        contentType: (content.content_type as "book" | "lecture" | "custom") ?? "book",
        subject: content.subject ?? null,
        subjectCategory: content.subject_category ?? null,
        totalRange,
        startRange,
        endRange,
        rangeUnit,
        startDate,
        endDate,
        totalDays,
        studyDays: contentPlans.length,
        dailyAverage,
        totalPlans: contentPlans.length,
        completedPlans,
        progressPercent,
        dailyPlans,
        studyWeekdays,
      });
    }

    // 6. 전체 통계 계산
    const totalPlans = allPlans?.length ?? 0;
    const totalCompletedPlans =
      allPlans?.filter((p) => p.status === "completed").length ?? 0;
    const overallProgress =
      totalPlans > 0 ? Math.round((totalCompletedPlans / totalPlans) * 100) : 0;

    return {
      success: true,
      data: {
        contents: contentSummaries,
        totalPlans,
        totalCompletedPlans,
        overallProgress,
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
// Weekly Schedule Overview for Timeline Preview
// ============================================

/**
 * 주간 스케줄 오버뷰 타입
 */
export type WeeklyScheduleOverview = {
  /** 콘텐츠별 요일 배치 */
  contentSchedules: Array<{
    contentId: string;
    contentTitle: string;
    contentType: "book" | "lecture" | "custom";
    subject: string | null;
    /** 요일별 분량 (0=일, 1=월, ..., 6=토) */
    weekdayVolumes: Record<number, number>;
    /** 요일별 예상 시간 (분) */
    weekdayMinutes: Record<number, number>;
    /** 콘텐츠 색상 (UI용) */
    color: string;
    /** 신규 콘텐츠 여부 */
    isNew?: boolean;
  }>;
  /** 요일별 총 분량 */
  dailyTotals: Record<number, { volume: number; minutes: number }>;
  /** 과부하 경고 */
  warnings: Array<{
    weekday: number;
    type: "overload" | "imbalance";
    message: string;
    totalMinutes: number;
  }>;
  /** 권장 최대 일일 학습 시간 (분) */
  recommendedMaxMinutes: number;
};

const CONTENT_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#84CC16", // lime
];

/**
 * 플랜 그룹의 주간 스케줄 오버뷰 조회
 * 콘텐츠 추가 시 기존 배치 상태를 시각화하기 위한 API
 * @param planGroupId 플랜 그룹 ID
 * @param newContentPreview 새로 추가할 콘텐츠 미리보기 (선택)
 * @param maxMinutesPerDay 일일 최대 학습 시간 기준 (기본: 240분 = 4시간)
 */
export async function getWeeklyScheduleOverview(
  planGroupId: string,
  newContentPreview?: {
    contentTitle: string;
    contentType: "book" | "lecture" | "custom";
    subject: string | null;
    weekdays: number[];
    estimatedMinutesPerDay: number;
    totalVolume: number;
  },
  maxMinutesPerDay = 240
): Promise<{
  success: boolean;
  data?: WeeklyScheduleOverview;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 1. 플랜 그룹의 모든 콘텐츠 조회
    const { data: planContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select(
        "content_id, content_type, title, subject, start_range, end_range, individual_schedule"
      )
      .eq("plan_group_id", planGroupId)
      .order("display_order", { ascending: true });

    if (contentsError) {
      return { success: false, error: contentsError.message };
    }

    // 2. 모든 플랜 조회하여 요일별 분량 계산
    const { data: allPlans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        "content_id, plan_date, planned_start_page_or_time, planned_end_page_or_time, estimated_minutes"
      )
      .eq("plan_group_id", planGroupId)
      .eq("is_active", true);

    if (plansError) {
      return { success: false, error: plansError.message };
    }

    // 3. 콘텐츠별 요일 분량 맵 생성
    const contentWeekdayMap = new Map<
      string,
      { volumes: Record<number, number>; minutes: Record<number, number> }
    >();

    for (const plan of allPlans ?? []) {
      if (!plan.plan_date) continue;

      const contentId = plan.content_id;
      const weekday = new Date(plan.plan_date).getDay();
      const volume =
        (plan.planned_end_page_or_time ?? 0) -
        (plan.planned_start_page_or_time ?? 0);
      const minutes = plan.estimated_minutes ?? 30;

      if (!contentWeekdayMap.has(contentId)) {
        contentWeekdayMap.set(contentId, {
          volumes: {},
          minutes: {},
        });
      }

      const entry = contentWeekdayMap.get(contentId)!;
      entry.volumes[weekday] = (entry.volumes[weekday] ?? 0) + volume;
      entry.minutes[weekday] = (entry.minutes[weekday] ?? 0) + minutes;
    }

    // 4. 콘텐츠 스케줄 배열 생성
    const contentSchedules: WeeklyScheduleOverview["contentSchedules"] = [];

    for (let i = 0; i < (planContents?.length ?? 0); i++) {
      const content = planContents![i];
      const weekdayData = contentWeekdayMap.get(content.content_id);

      // 요일별 평균 계산 (같은 요일에 여러 플랜이 있을 수 있음)
      const weekdayCounts: Record<number, number> = {};
      for (const plan of allPlans ?? []) {
        if (plan.content_id === content.content_id && plan.plan_date) {
          const weekday = new Date(plan.plan_date).getDay();
          weekdayCounts[weekday] = (weekdayCounts[weekday] ?? 0) + 1;
        }
      }

      const avgVolumes: Record<number, number> = {};
      const avgMinutes: Record<number, number> = {};

      if (weekdayData) {
        for (const [wd, vol] of Object.entries(weekdayData.volumes)) {
          const count = weekdayCounts[Number(wd)] ?? 1;
          avgVolumes[Number(wd)] = Math.round(vol / count);
        }
        for (const [wd, min] of Object.entries(weekdayData.minutes)) {
          const count = weekdayCounts[Number(wd)] ?? 1;
          avgMinutes[Number(wd)] = Math.round(min / count);
        }
      }

      contentSchedules.push({
        contentId: content.content_id,
        contentTitle: content.title ?? `콘텐츠 ${i + 1}`,
        contentType: (content.content_type as "book" | "lecture" | "custom") ?? "book",
        subject: content.subject ?? null,
        weekdayVolumes: avgVolumes,
        weekdayMinutes: avgMinutes,
        color: CONTENT_COLORS[i % CONTENT_COLORS.length],
      });
    }

    // 5. 새 콘텐츠 미리보기 추가
    if (newContentPreview) {
      const newWeekdayVolumes: Record<number, number> = {};
      const newWeekdayMinutes: Record<number, number> = {};
      const volumePerDay = Math.ceil(
        newContentPreview.totalVolume / newContentPreview.weekdays.length
      );

      for (const wd of newContentPreview.weekdays) {
        newWeekdayVolumes[wd] = volumePerDay;
        newWeekdayMinutes[wd] = newContentPreview.estimatedMinutesPerDay;
      }

      contentSchedules.push({
        contentId: "preview-new",
        contentTitle: newContentPreview.contentTitle,
        contentType: newContentPreview.contentType,
        subject: newContentPreview.subject,
        weekdayVolumes: newWeekdayVolumes,
        weekdayMinutes: newWeekdayMinutes,
        color: CONTENT_COLORS[contentSchedules.length % CONTENT_COLORS.length],
        isNew: true,
      });
    }

    // 6. 요일별 총량 계산
    const dailyTotals: Record<number, { volume: number; minutes: number }> = {};
    for (let wd = 0; wd <= 6; wd++) {
      let totalVolume = 0;
      let totalMinutes = 0;

      for (const cs of contentSchedules) {
        totalVolume += cs.weekdayVolumes[wd] ?? 0;
        totalMinutes += cs.weekdayMinutes[wd] ?? 0;
      }

      dailyTotals[wd] = { volume: totalVolume, minutes: totalMinutes };
    }

    // 7. 과부하 경고 생성
    const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
    const warnings: WeeklyScheduleOverview["warnings"] = [];

    for (let wd = 0; wd <= 6; wd++) {
      const { minutes } = dailyTotals[wd];
      if (minutes > maxMinutesPerDay) {
        warnings.push({
          weekday: wd,
          type: "overload",
          message: `${WEEKDAY_NAMES[wd]}요일 학습량이 ${Math.round(minutes / 60)}시간으로 과부하입니다.`,
          totalMinutes: minutes,
        });
      }
    }

    // 불균형 감지 (최대-최소 차이가 2배 이상)
    const activeDays = Object.values(dailyTotals).filter((d) => d.minutes > 0);
    if (activeDays.length >= 2) {
      const maxDay = Math.max(...activeDays.map((d) => d.minutes));
      const minDay = Math.min(...activeDays.map((d) => d.minutes));
      if (maxDay > minDay * 2) {
        warnings.push({
          weekday: -1,
          type: "imbalance",
          message: "요일별 학습량 편차가 큽니다. 균등 분배를 권장합니다.",
          totalMinutes: maxDay - minDay,
        });
      }
    }

    return {
      success: true,
      data: {
        contentSchedules,
        dailyTotals,
        warnings,
        recommendedMaxMinutes: maxMinutesPerDay,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
