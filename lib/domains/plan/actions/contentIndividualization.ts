"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";

// ============================================
// Types
// ============================================

export type ActionResult = {
  success: boolean;
  error?: string;
};

export type Priority = "high" | "normal" | "low";

/**
 * 콘텐츠별 독립 스케줄 설정
 * 각 콘텐츠가 플래너 기본값과 다른 스케줄을 가질 수 있음
 */
export type IndividualSchedule = {
  // 기존 필드
  startDate: string;
  endDate: string;
  studyDays?: number[]; // 0-6 (일-토)
  dailyAmount?: number;
  customRules?: Record<string, unknown>;

  // === 확장된 7단계 위저드 옵션 ===
  /** 학습 유형 (strategy: 전략과목, weakness: 취약과목, review: 복습) */
  studyType?: "strategy" | "weakness" | "review";
  /** 전략과목 주당 학습일 (2-5일) */
  strategyDaysPerWeek?: number;
  /** 복습 활성화 여부 */
  reviewEnabled?: boolean;
  /** 복습 주기 (일 단위) */
  reviewCycleInDays?: number;
  /** 선호 블록 ID */
  preferredBlockId?: string;
  /** 일일 학습 시간 (분) */
  dailyMinutes?: number;
  /** 추정 콘텐츠당 소요시간 (분) */
  estimatedMinutesPerUnit?: number;
  /** 콘텐츠 범위 단위 (page, episode, chapter 등) */
  rangeUnit?: string;
  /** 템플릿 설정 상속 여부 */
  inheritFromTemplate?: boolean;
};

export type ContentProgress = {
  contentId: string;
  planGroupId: string;
  totalPlans: number;
  completedPlans: number;
  pendingPlans: number;
  inProgressPlans: number;
  progressPercent: number;
  totalAmount: number;
  completedAmount: number;
  isPaused: boolean;
  pausedUntil: string | null;
  priority: Priority;
};

// ============================================
// Schedule Individualization
// ============================================

/**
 * 콘텐츠별 스케줄 분리 (개별화)
 * 플랜 그룹 내 특정 콘텐츠의 스케줄을 개별적으로 설정
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 * @param newSchedule 새로운 스케줄 설정
 */
export async function splitContentSchedule(
  planGroupId: string,
  contentId: string,
  newSchedule: IndividualSchedule
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

    // 플랜 그룹 및 콘텐츠 확인
    const { data: planContent, error: fetchError } = await supabase
      .from("plan_contents")
      .select("*, plan_groups!inner(student_id)")
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .single();

    if (fetchError || !planContent) {
      return { success: false, error: "Content not found in plan group" };
    }

    // individual_schedule 업데이트
    const { error: updateError } = await supabase
      .from("plan_contents")
      .update({
        individual_schedule: newSchedule,
        custom_study_days: newSchedule.studyDays || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planContent.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 해당 콘텐츠의 플랜들 재배치
    if (newSchedule.startDate && newSchedule.endDate) {
      const { data: plans } = await supabase
        .from("student_plan")
        .select("*")
        .eq("plan_group_id", planGroupId)
        .eq("content_id", contentId)
        .eq("is_active", true)
        .in("status", ["pending"])
        .order("plan_date", { ascending: true });

      if (plans && plans.length > 0) {
        const studyDays = newSchedule.studyDays || [1, 2, 3, 4, 5]; // 기본: 월-금
        const startDate = new Date(newSchedule.startDate);
        const endDate = new Date(newSchedule.endDate);

        // 학습 가능한 날짜 목록 생성
        const availableDates: string[] = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          if (studyDays.includes(currentDate.getDay())) {
            availableDates.push(currentDate.toISOString().split("T")[0]);
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // 플랜들을 가용 날짜에 균등 배치
        const plansPerDay = Math.ceil(plans.length / availableDates.length);
        let dateIndex = 0;
        let plansOnDate = 0;

        for (const plan of plans) {
          if (dateIndex >= availableDates.length) {
            dateIndex = availableDates.length - 1;
          }

          await supabase
            .from("student_plan")
            .update({
              plan_date: availableDates[dateIndex],
              updated_at: new Date().toISOString(),
            })
            .eq("id", plan.id);

          plansOnDate++;
          if (plansOnDate >= plansPerDay && dateIndex < availableDates.length - 1) {
            dateIndex++;
            plansOnDate = 0;
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentId = (planContent as any).plan_groups?.student_id;
    revalidatePath(`/admin/students/${studentId}/plans`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Pause/Resume Content
// ============================================

/**
 * 콘텐츠 일시 중지
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 * @param pauseUntil 중지 종료일 (optional)
 */
export async function pauseContent(
  planGroupId: string,
  contentId: string,
  pauseUntil?: string
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

    // plan_contents 업데이트
    const { data: planContent, error: fetchError } = await supabase
      .from("plan_contents")
      .select("id, plan_groups!inner(student_id)")
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .single();

    if (fetchError || !planContent) {
      return { success: false, error: "Content not found" };
    }

    const { error: updateError } = await supabase
      .from("plan_contents")
      .update({
        is_paused: true,
        paused_until: pauseUntil || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planContent.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 해당 콘텐츠의 미완료 플랜들을 unfinished 컨테이너로 이동
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("student_plan")
      .update({
        container_type: "unfinished",
        updated_at: new Date().toISOString(),
      })
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .eq("is_active", true)
      .in("status", ["pending", "in_progress"])
      .gte("plan_date", today);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentId = (planContent as any).plan_groups?.student_id;
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath("/today");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 콘텐츠 재개
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 */
export async function resumeContent(
  planGroupId: string,
  contentId: string
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

    const { data: planContent, error: fetchError } = await supabase
      .from("plan_contents")
      .select("id, plan_groups!inner(student_id)")
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .single();

    if (fetchError || !planContent) {
      return { success: false, error: "Content not found" };
    }

    const { error: updateError } = await supabase
      .from("plan_contents")
      .update({
        is_paused: false,
        paused_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planContent.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentId = (planContent as any).plan_groups?.student_id;
    revalidatePath(`/admin/students/${studentId}/plans`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Priority Management
// ============================================

/**
 * 콘텐츠 우선순위 변경
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 * @param priority 새로운 우선순위
 */
export async function setContentPriority(
  planGroupId: string,
  contentId: string,
  priority: Priority
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

    const { data: planContent, error: fetchError } = await supabase
      .from("plan_contents")
      .select("id, plan_groups!inner(student_id)")
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .single();

    if (fetchError || !planContent) {
      return { success: false, error: "Content not found" };
    }

    const { error: updateError } = await supabase
      .from("plan_contents")
      .update({
        priority,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planContent.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentId = (planContent as any).plan_groups?.student_id;
    revalidatePath(`/admin/students/${studentId}/plans`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Progress Tracking
// ============================================

/**
 * 콘텐츠별 상세 진행률 조회
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID
 */
export async function getContentDetailedProgress(
  planGroupId: string,
  contentId: string
): Promise<{ success: boolean; data?: ContentProgress; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // plan_contents 정보 조회
    const { data: planContent, error: contentError } = await supabase
      .from("plan_contents")
      .select("*")
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .single();

    if (contentError || !planContent) {
      return { success: false, error: "Content not found" };
    }

    // 해당 콘텐츠의 플랜들 조회
    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        "id, status, planned_start_page_or_time, planned_end_page_or_time, completed_amount"
      )
      .eq("plan_group_id", planGroupId)
      .eq("content_id", contentId)
      .eq("is_active", true);

    if (plansError) {
      return { success: false, error: plansError.message };
    }

    const totalPlans = plans?.length ?? 0;
    const completedPlans =
      plans?.filter((p) => p.status === "completed").length ?? 0;
    const pendingPlans =
      plans?.filter((p) => p.status === "pending").length ?? 0;
    const inProgressPlans =
      plans?.filter((p) => p.status === "in_progress").length ?? 0;

    // 총 분량 및 완료 분량 계산
    let totalAmount = 0;
    let completedAmount = 0;

    for (const plan of plans ?? []) {
      const planAmount =
        (plan.planned_end_page_or_time ?? 0) -
        (plan.planned_start_page_or_time ?? 0);
      totalAmount += planAmount;

      if (plan.status === "completed") {
        completedAmount += planAmount;
      } else if (plan.completed_amount) {
        completedAmount += plan.completed_amount;
      }
    }

    const progressPercent =
      totalAmount > 0 ? Math.round((completedAmount / totalAmount) * 100) : 0;

    return {
      success: true,
      data: {
        contentId,
        planGroupId,
        totalPlans,
        completedPlans,
        pendingPlans,
        inProgressPlans,
        progressPercent,
        totalAmount,
        completedAmount,
        isPaused: planContent.is_paused ?? false,
        pausedUntil: planContent.paused_until ?? null,
        priority: (planContent.priority as Priority) ?? "normal",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 플랜 그룹 내 모든 콘텐츠의 진행률 조회
 * @param planGroupId 플랜 그룹 ID
 */
export async function getAllContentsProgress(
  planGroupId: string
): Promise<{ success: boolean; data?: ContentProgress[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 모든 콘텐츠 조회
    const { data: planContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select("content_id, is_paused, paused_until, priority")
      .eq("plan_group_id", planGroupId)
      .order("display_order", { ascending: true });

    if (contentsError) {
      return { success: false, error: contentsError.message };
    }

    const progressList: ContentProgress[] = [];

    for (const content of planContents ?? []) {
      const result = await getContentDetailedProgress(
        planGroupId,
        content.content_id
      );
      if (result.success && result.data) {
        progressList.push(result.data);
      }
    }

    return { success: true, data: progressList };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
