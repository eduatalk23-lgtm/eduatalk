"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export type PlanType = "student_plan";

// ============================================
// 타입 정의
// ============================================

/**
 * student_plan과 plan_groups 조인 결과 타입
 */
type StudentPlanWithPlanGroup = {
  id: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  student_id: string;
  content_title: string | null;
  plan_group_id: string | null;
  version: number | null;
  plan_groups: {
    student_id: string;
  } | { student_id: string }[] | null;
};

/**
 * student_plan (버전만)과 plan_groups 조인 결과 타입
 */
type StudentPlanVersionWithPlanGroup = {
  id: string;
  version: number | null;
  plan_groups: {
    student_id: string;
  } | { student_id: string }[] | null;
};

export interface DragDropResult {
  success: boolean;
  error?: string;
  planId?: string;
  newDate?: string;
  newStartTime?: string;
}

/**
 * 특정 날짜가 제외일인지 확인
 */
async function checkExclusionDate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planGroupId: string,
  date: string
): Promise<{ isExclusion: boolean; reason?: string }> {
  // plan_group → student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", planGroupId)
    .maybeSingle();

  if (!group?.student_id) return { isExclusion: false };

  // calendar_events에서 제외일 확인
  const { data: exclusion } = await supabase
    .from("calendar_events")
    .select("event_subtype, title")
    .eq("student_id", group.student_id)
    .eq("is_exclusion", true)
    .eq("is_all_day", true)
    .eq("start_date", date)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (exclusion) {
    return {
      isExclusion: true,
      reason: exclusion.title || undefined,
    };
  }

  return { isExclusion: false };
}

/**
 * 달력 드래그앤드롭으로 플랜 날짜/시간 변경
 */
export async function rescheduleOnDrop(
  planId: string,
  planType: PlanType,
  newDate: string,
  newStartTime?: string
): Promise<DragDropResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    if (planType === "student_plan") {
      // 기존 플랜 조회 (plan_group_id, version 포함)
      // Phase 2.2: Optimistic Locking을 위해 version 필드도 조회
      const { data: existingPlan, error: fetchError } = await supabase
        .from("student_plan")
        .select("id, plan_date, start_time, end_time, student_id, content_title, plan_group_id, version, plan_groups!inner(student_id)")
        .eq("id", planId)
        .single();

      if (fetchError || !existingPlan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 권한 확인
      const isAdmin = user.role === "admin" || user.role === "superadmin";
      const planWithGroup = existingPlan as StudentPlanWithPlanGroup;
      const planGroups = planWithGroup.plan_groups;
      const groupStudentId = Array.isArray(planGroups) ? planGroups[0]?.student_id : planGroups?.student_id;
      const isOwner = groupStudentId === user.userId;
      if (!isAdmin && !isOwner) {
        return { success: false, error: "권한이 없습니다." };
      }

      // 제외일 검증
      if (existingPlan.plan_group_id && newDate !== existingPlan.plan_date) {
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

      // 이동할 시간 계산
      let newEndTime: string | undefined;
      if (newStartTime && existingPlan.start_time && existingPlan.end_time) {
        const [startH, startM] = existingPlan.start_time.split(":").map(Number);
        const [endH, endM] = existingPlan.end_time.split(":").map(Number);
        const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        const [newH, newM] = newStartTime.split(":").map(Number);
        const newEndMinutes = newH * 60 + newM + durationMinutes;
        const newEndH = Math.floor(newEndMinutes / 60) % 24;
        const newEndM = newEndMinutes % 60;
        newEndTime = `${String(newEndH).padStart(2, "0")}:${String(newEndM).padStart(2, "0")}`;
      }

      // 업데이트 데이터 구성
      // Phase 2.2: Optimistic Locking - 버전 증가
      const currentVersion = existingPlan.version ?? 1;
      const updateData: Record<string, unknown> = {
        plan_date: newDate,
        updated_at: new Date().toISOString(),
        version: currentVersion + 1,
      };

      // 시간이 제공된 경우 설정
      if (newStartTime) {
        updateData.start_time = newStartTime;
        if (newEndTime) {
          updateData.end_time = newEndTime;
        }
      }

      // Optimistic Locking: 버전 체크와 함께 업데이트
      const { data: updatedPlan, error: updateError } = await supabase
        .from("student_plan")
        .update(updateData)
        .eq("id", planId)
        .eq("version", currentVersion)
        .select("id")
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // 버전 불일치로 업데이트 실패 (다른 요청이 먼저 수정함)
      if (!updatedPlan) {
        return {
          success: false,
          error: "플랜이 이미 수정되었습니다. 새로고침 후 다시 시도해주세요.",
        };
      }
    }

    revalidatePath("/plan/calendar");
    revalidatePath("/today");

    return { success: true, planId, newDate, newStartTime };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 시간 블록 리사이즈로 시간 변경
 */
export async function resizePlanDuration(
  planId: string,
  planType: PlanType,
  newStartTime: string,
  newEndTime: string
): Promise<DragDropResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();
    const isAdmin = user.role === "admin" || user.role === "superadmin";

    if (planType === "student_plan") {
      // student_plan: plan_groups.student_id로 소유자 확인
      // Phase 2.2: Optimistic Locking을 위해 version 필드도 조회
      const { data: existingPlan, error: fetchError } = await supabase
        .from("student_plan")
        .select("id, version, plan_groups!inner(student_id)")
        .eq("id", planId)
        .single();

      if (fetchError || !existingPlan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 권한 확인
      // 권한 확인
      const planWithGroup = existingPlan as StudentPlanVersionWithPlanGroup;
      const planGroups = planWithGroup.plan_groups;
      const groupStudentId = Array.isArray(planGroups) ? planGroups[0]?.student_id : planGroups?.student_id;
      const isOwner = groupStudentId === user.userId;
      if (!isAdmin && !isOwner) {
        return { success: false, error: "권한이 없습니다." };
      }

      // 업데이트
      // Phase 2.2: Optimistic Locking - 버전 체크와 함께 업데이트
      const currentVersion = existingPlan.version ?? 1;
      const { data: updatedPlan, error: updateError } = await supabase
        .from("student_plan")
        .update({
          start_time: newStartTime,
          end_time: newEndTime,
          updated_at: new Date().toISOString(),
          version: currentVersion + 1,
        })
        .eq("id", planId)
        .eq("version", currentVersion)
        .select("id")
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // 버전 불일치로 업데이트 실패 (다른 요청이 먼저 수정함)
      if (!updatedPlan) {
        return {
          success: false,
          error: "플랜이 이미 수정되었습니다. 새로고침 후 다시 시도해주세요.",
        };
      }
    }

    revalidatePath("/plan/calendar");
    revalidatePath("/today");

    return { success: true, planId, newStartTime };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
