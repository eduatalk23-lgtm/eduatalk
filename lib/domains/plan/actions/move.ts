"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";

// ============================================
// Types
// ============================================

export type ContainerType = "daily" | "weekly" | "unfinished";

export type ActionResult = {
  success: boolean;
  error?: string;
};

export type MovePlanResult = ActionResult & {
  planId?: string;
  newDate?: string;
};

export type MovePlansResult = ActionResult & {
  movedCount?: number;
  failedIds?: string[];
};

export type ReorderResult = ActionResult & {
  reorderedCount?: number;
};

// ============================================
// Exclusion Date Validation
// ============================================

/**
 * 특정 날짜가 제외일인지 확인
 * @param supabase Supabase 클라이언트
 * @param planGroupId 플랜 그룹 ID
 * @param date 확인할 날짜 (YYYY-MM-DD)
 * @returns 제외일 여부 및 사유
 */
async function checkExclusionDate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planGroupId: string,
  date: string
): Promise<{ isExclusion: boolean; reason?: string; exclusionType?: string }> {
  const { data: exclusion } = await supabase
    .from("plan_exclusions")
    .select("exclusion_type, reason")
    .eq("plan_group_id", planGroupId)
    .eq("exclusion_date", date)
    .single();

  if (exclusion) {
    return {
      isExclusion: true,
      reason: exclusion.reason || undefined,
      exclusionType: exclusion.exclusion_type,
    };
  }

  return { isExclusion: false };
}

// ============================================
// Time Conflict Detection
// ============================================

/**
 * 시간대 겹침 여부 확인
 */
function checkTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const aStart = toMinutes(startA);
  const aEnd = toMinutes(endA);
  const bStart = toMinutes(startB);
  const bEnd = toMinutes(endB);

  // 겹치지 않는 경우: A가 B보다 완전히 앞이거나 완전히 뒤
  return !(aEnd <= bStart || aStart >= bEnd);
}

/**
 * 시간 충돌 확인
 */
async function checkTimeConflict(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludePlanId?: string
): Promise<{ hasConflict: boolean; conflictingPlan?: { title: string; startTime: string; endTime: string } }> {
  // student_plan에서 충돌 확인
  const { data: studentPlans } = await supabase
    .from("student_plan")
    .select("id, content_title, start_time, end_time")
    .eq("plan_date", date)
    .eq("student_id", studentId)
    .not("start_time", "is", null)
    .not("end_time", "is", null);

  if (studentPlans) {
    for (const plan of studentPlans) {
      if (excludePlanId && plan.id === excludePlanId) continue;
      if (plan.start_time && plan.end_time) {
        if (checkTimeOverlap(startTime, endTime, plan.start_time, plan.end_time)) {
          return {
            hasConflict: true,
            conflictingPlan: {
              title: plan.content_title || "플랜",
              startTime: plan.start_time,
              endTime: plan.end_time,
            },
          };
        }
      }
    }
  }

  // ad_hoc_plans에서 충돌 확인
  const { data: adHocPlans } = await supabase
    .from("ad_hoc_plans")
    .select("id, title, start_time, end_time")
    .eq("plan_date", date)
    .eq("student_id", studentId)
    .not("start_time", "is", null)
    .not("end_time", "is", null);

  if (adHocPlans) {
    for (const plan of adHocPlans) {
      if (excludePlanId && plan.id === excludePlanId) continue;
      if (plan.start_time && plan.end_time) {
        if (checkTimeOverlap(startTime, endTime, plan.start_time, plan.end_time)) {
          return {
            hasConflict: true,
            conflictingPlan: {
              title: plan.title || "플랜",
              startTime: plan.start_time,
              endTime: plan.end_time,
            },
          };
        }
      }
    }
  }

  return { hasConflict: false };
}

// ============================================
// Single Plan Movement
// ============================================

/**
 * 단일 플랜을 새로운 날짜로 이동
 * @param planId 플랜 ID
 * @param newDate 새로운 날짜 (YYYY-MM-DD)
 * @param options 옵션 (시간 유지 여부)
 */
export async function movePlanToDate(
  planId: string,
  newDate: string,
  options?: { keepTime?: boolean }
): Promise<MovePlanResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 기존 플랜 조회 (plan_group_id 포함)
    const { data: existingPlan, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, plan_date, start_time, end_time, student_id, plan_group_id")
      .eq("id", planId)
      .single();

    if (fetchError || !existingPlan) {
      return { success: false, error: "Plan not found" };
    }

    // 권한 확인 (관리자 또는 해당 학생)
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const isOwner = existingPlan.student_id === user.userId;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    // 제외일 검증
    if (existingPlan.plan_group_id) {
      const exclusionCheck = await checkExclusionDate(
        supabase,
        existingPlan.plan_group_id,
        newDate
      );
      if (exclusionCheck.isExclusion) {
        const reason = exclusionCheck.reason
          ? ` (${exclusionCheck.reason})`
          : "";
        return {
          success: false,
          error: `해당 날짜는 제외일입니다${reason}`,
        };
      }
    }

    // 시간 충돌 검증 (시간을 유지하는 경우)
    if (options?.keepTime && existingPlan.start_time && existingPlan.end_time) {
      const conflictCheck = await checkTimeConflict(
        supabase,
        existingPlan.student_id,
        newDate,
        existingPlan.start_time,
        existingPlan.end_time,
        planId
      );
      if (conflictCheck.hasConflict && conflictCheck.conflictingPlan) {
        return {
          success: false,
          error: `시간 충돌: "${conflictCheck.conflictingPlan.title}" (${conflictCheck.conflictingPlan.startTime} ~ ${conflictCheck.conflictingPlan.endTime})`,
        };
      }
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {
      plan_date: newDate,
      updated_at: new Date().toISOString(),
    };

    // 시간을 유지하지 않는 경우 초기화
    if (!options?.keepTime) {
      updateData.start_time = null;
      updateData.end_time = null;
    }

    const { error: updateError } = await supabase
      .from("student_plan")
      .update(updateData)
      .eq("id", planId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/admin/students/${existingPlan.student_id}/plans`);
    revalidatePath("/today");

    return { success: true, planId, newDate };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Bulk Plan Movement
// ============================================

/**
 * 여러 플랜을 새로운 날짜로 일괄 이동
 * @param planIds 플랜 ID 배열
 * @param newDate 새로운 날짜 (YYYY-MM-DD)
 */
export async function movePlansToDate(
  planIds: string[],
  newDate: string
): Promise<MovePlansResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (planIds.length === 0) {
      return { success: false, error: "No plans to move" };
    }

    const supabase = await createSupabaseServerClient();

    // 권한 확인을 위해 플랜들 조회 (plan_group_id 포함)
    const { data: plans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, student_id, plan_group_id")
      .in("id", planIds);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // 권한 확인 (관리자가 아니면 자신의 플랜만 이동 가능)
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    if (!isAdmin) {
      const unauthorizedPlans = plans?.filter(
        (p) => p.student_id !== user.userId
      );
      if (unauthorizedPlans && unauthorizedPlans.length > 0) {
        return { success: false, error: "Permission denied for some plans" };
      }
    }

    // 제외일 검증 (각 플랜의 plan_group_id별로)
    const planGroupIds = [...new Set(plans?.map((p) => p.plan_group_id).filter(Boolean) || [])];
    for (const planGroupId of planGroupIds) {
      const exclusionCheck = await checkExclusionDate(supabase, planGroupId as string, newDate);
      if (exclusionCheck.isExclusion) {
        const reason = exclusionCheck.reason ? ` (${exclusionCheck.reason})` : "";
        return {
          success: false,
          error: `해당 날짜는 제외일입니다${reason}`,
        };
      }
    }

    const validPlanIds = plans?.map((p) => p.id) || [];
    const failedIds = planIds.filter((id) => !validPlanIds.includes(id));

    if (validPlanIds.length === 0) {
      return { success: false, error: "No valid plans to move", failedIds };
    }

    // 일괄 업데이트
    const { error: updateError } = await supabase
      .from("student_plan")
      .update({
        plan_date: newDate,
        start_time: null,
        end_time: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", validPlanIds);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 학생별로 revalidate
    const studentIds = [...new Set(plans?.map((p) => p.student_id) || [])];
    for (const studentId of studentIds) {
      revalidatePath(`/admin/students/${studentId}/plans`);
    }
    revalidatePath("/today");

    return {
      success: true,
      movedCount: validPlanIds.length,
      failedIds: failedIds.length > 0 ? failedIds : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Plan Reordering
// ============================================

/**
 * 같은 날짜 내에서 플랜 순서 변경
 * @param planIds 플랜 ID 배열 (새로운 순서대로)
 * @param newOrder 새로운 sequence 값 배열 (planIds와 1:1 매핑)
 */
export async function reorderPlans(
  planIds: string[],
  newOrder: number[]
): Promise<ReorderResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (planIds.length !== newOrder.length) {
      return { success: false, error: "planIds and newOrder must have same length" };
    }

    if (planIds.length === 0) {
      return { success: false, error: "No plans to reorder" };
    }

    const supabase = await createSupabaseServerClient();

    // 권한 확인
    const { data: plans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, student_id, plan_date")
      .in("id", planIds);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const isAdmin = user.role === "admin" || user.role === "superadmin";
    if (!isAdmin) {
      const unauthorizedPlans = plans?.filter(
        (p) => p.student_id !== user.userId
      );
      if (unauthorizedPlans && unauthorizedPlans.length > 0) {
        return { success: false, error: "Permission denied" };
      }
    }

    // 같은 날짜인지 확인
    const dates = [...new Set(plans?.map((p) => p.plan_date) || [])];
    if (dates.length > 1) {
      return { success: false, error: "All plans must be on the same date" };
    }

    // 순서 업데이트 (개별 업데이트 필요)
    for (let i = 0; i < planIds.length; i++) {
      const { error: updateError } = await supabase
        .from("student_plan")
        .update({
          sequence: newOrder[i],
          updated_at: new Date().toISOString(),
        })
        .eq("id", planIds[i]);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    // 학생별로 revalidate
    const studentIds = [...new Set(plans?.map((p) => p.student_id) || [])];
    for (const studentId of studentIds) {
      revalidatePath(`/admin/students/${studentId}/plans`);
    }
    revalidatePath("/today");

    return { success: true, reorderedCount: planIds.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Container Movement
// ============================================

/**
 * 플랜의 컨테이너 타입 변경 (날짜 지정 가능)
 * @param planId 플랜 ID
 * @param container 새로운 컨테이너 타입
 * @param targetDate 대상 날짜 (optional)
 */
export async function movePlanToContainer(
  planId: string,
  container: ContainerType,
  targetDate?: string
): Promise<MovePlanResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 기존 플랜 조회 (plan_group_id 포함)
    const { data: existingPlan, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, student_id, plan_date, plan_group_id")
      .eq("id", planId)
      .single();

    if (fetchError || !existingPlan) {
      return { success: false, error: "Plan not found" };
    }

    // 권한 확인
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const isOwner = existingPlan.student_id === user.userId;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    // 날짜 결정
    const newDate = targetDate || existingPlan.plan_date;

    // 제외일 검증 (날짜가 변경되는 경우)
    if (targetDate && existingPlan.plan_group_id) {
      const exclusionCheck = await checkExclusionDate(
        supabase,
        existingPlan.plan_group_id,
        newDate
      );
      if (exclusionCheck.isExclusion) {
        const reason = exclusionCheck.reason ? ` (${exclusionCheck.reason})` : "";
        return {
          success: false,
          error: `해당 날짜는 제외일입니다${reason}`,
        };
      }
    }

    const { error: updateError } = await supabase
      .from("student_plan")
      .update({
        container_type: container,
        plan_date: newDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/admin/students/${existingPlan.student_id}/plans`);
    revalidatePath("/today");

    return { success: true, planId, newDate };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Drag and Drop Handler
// ============================================

export type DropTarget = {
  container: ContainerType;
  date?: string;
  position?: number;
};

/**
 * 드래그 앤 드롭 처리 통합 함수
 * @param planId 플랜 ID
 * @param dropTarget 드롭 대상 정보
 */
export async function handlePlanDrop(
  planId: string,
  dropTarget: DropTarget
): Promise<MovePlanResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 기존 플랜 조회 (plan_group_id 포함)
    const { data: existingPlan, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, student_id, plan_date, sequence, plan_group_id")
      .eq("id", planId)
      .single();

    if (fetchError || !existingPlan) {
      return { success: false, error: "Plan not found" };
    }

    // 권한 확인
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const isOwner = existingPlan.student_id === user.userId;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    // 날짜 및 컨테이너 결정
    const newDate = dropTarget.date || existingPlan.plan_date;
    const today = new Date().toISOString().split("T")[0];

    // unfinished 컨테이너는 과거 날짜의 미완료 플랜만 해당
    // daily 컨테이너는 오늘 날짜
    // weekly 컨테이너는 이번 주 날짜
    let finalDate = newDate;
    if (dropTarget.container === "daily" && !dropTarget.date) {
      finalDate = today;
    }

    // 제외일 검증 (날짜가 변경되는 경우)
    if (finalDate !== existingPlan.plan_date && existingPlan.plan_group_id) {
      const exclusionCheck = await checkExclusionDate(
        supabase,
        existingPlan.plan_group_id,
        finalDate
      );
      if (exclusionCheck.isExclusion) {
        const reason = exclusionCheck.reason ? ` (${exclusionCheck.reason})` : "";
        return {
          success: false,
          error: `해당 날짜는 제외일입니다${reason}`,
        };
      }
    }

    const updateData: Record<string, unknown> = {
      container_type: dropTarget.container,
      plan_date: finalDate,
      updated_at: new Date().toISOString(),
    };

    // 위치가 지정된 경우 sequence 업데이트
    if (dropTarget.position !== undefined) {
      updateData.sequence = dropTarget.position;
    }

    const { error: updateError } = await supabase
      .from("student_plan")
      .update(updateData)
      .eq("id", planId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/admin/students/${existingPlan.student_id}/plans`);
    revalidatePath("/today");

    return { success: true, planId, newDate: finalDate };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Ad-hoc Plan Movement
// ============================================

/**
 * 단발성 플랜(Ad-hoc) 이동
 * @param planId Ad-hoc 플랜 ID
 * @param newDate 새로운 날짜
 * @param container 새로운 컨테이너 (optional)
 */
export async function moveAdHocPlan(
  planId: string,
  newDate: string,
  container?: ContainerType
): Promise<MovePlanResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createSupabaseServerClient();

    // 기존 플랜 조회 (plan_group_id 포함)
    const { data: existingPlan, error: fetchError } = await supabase
      .from("ad_hoc_plans")
      .select("id, student_id, container_type, plan_group_id")
      .eq("id", planId)
      .single();

    if (fetchError || !existingPlan) {
      return { success: false, error: "Ad-hoc plan not found" };
    }

    // 권한 확인
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const isOwner = existingPlan.student_id === user.userId;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    // 제외일 검증
    if (existingPlan.plan_group_id) {
      const exclusionCheck = await checkExclusionDate(
        supabase,
        existingPlan.plan_group_id,
        newDate
      );
      if (exclusionCheck.isExclusion) {
        const reason = exclusionCheck.reason ? ` (${exclusionCheck.reason})` : "";
        return {
          success: false,
          error: `해당 날짜는 제외일입니다${reason}`,
        };
      }
    }

    const updateData: Record<string, unknown> = {
      plan_date: newDate,
      updated_at: new Date().toISOString(),
    };

    if (container) {
      updateData.container_type = container;
    }

    const { error: updateError } = await supabase
      .from("ad_hoc_plans")
      .update(updateData)
      .eq("id", planId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/admin/students/${existingPlan.student_id}/plans`);
    revalidatePath("/today");

    return { success: true, planId, newDate };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
