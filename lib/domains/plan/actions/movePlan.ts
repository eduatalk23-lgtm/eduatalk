"use server";

/**
 * 플랜 이동 서버 액션
 *
 * 매트릭스 뷰에서 드래그앤드롭으로 플랜을 이동할 때 사용됩니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";

// ============================================
// 타입 정의
// ============================================

export interface MovePlanInput {
  /** 플랜 ID */
  planId: string;
  /** 플랜 타입 */
  planType: "student_plan" | "ad_hoc_plan";
  /** 이동할 날짜 (YYYY-MM-DD) */
  targetDate: string;
  /** 이동할 시간 슬롯 ID (optional) */
  targetSlotId?: string;
  /** 이동할 시작 시간 (HH:mm, optional) */
  targetStartTime?: string;
  /** 이동할 종료 시간 (HH:mm, optional) */
  targetEndTime?: string;
}

export interface MovePlanResult {
  success: boolean;
  error?: string;
  data?: {
    planId: string;
    newDate: string;
    newStartTime?: string;
    newEndTime?: string;
  };
}

// ============================================
// 유효성 검증
// ============================================

/**
 * 이동 대상 날짜가 유효한지 확인
 */
function validateTargetDate(targetDate: string): { valid: boolean; error?: string } {
  const target = new Date(targetDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 과거 날짜로는 이동 불가 (당일은 허용)
  if (target < today) {
    return { valid: false, error: "과거 날짜로는 플랜을 이동할 수 없습니다." };
  }

  return { valid: true };
}

/**
 * 플랜 소유권 확인
 */
async function validatePlanOwnership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planId: string,
  planType: "student_plan" | "ad_hoc_plan",
  userId: string
): Promise<{ valid: boolean; error?: string; plan?: Record<string, unknown> }> {
  const table = planType === "student_plan" ? "student_plan" : "ad_hoc_plans";
  const studentIdColumn = planType === "student_plan" ? "student_id" : "student_id";

  const { data: plan, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", planId)
    .eq(studentIdColumn, userId)
    .single();

  if (error || !plan) {
    return { valid: false, error: "플랜을 찾을 수 없거나 접근 권한이 없습니다." };
  }

  return { valid: true, plan };
}

/**
 * 플랜 상태 확인 (완료된 플랜은 이동 불가)
 */
function validatePlanStatus(plan: Record<string, unknown>): { valid: boolean; error?: string } {
  const status = plan.status as string;
  const progress = plan.progress as number | null;

  // 완료된 플랜은 이동 불가
  if (status === "completed" || (progress !== null && progress >= 100)) {
    return { valid: false, error: "완료된 플랜은 이동할 수 없습니다." };
  }

  // 진행 중인 플랜은 이동 불가
  if (status === "in_progress") {
    return { valid: false, error: "진행 중인 플랜은 이동할 수 없습니다." };
  }

  return { valid: true };
}

/**
 * 시간 충돌 확인
 */
async function checkTimeConflict(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  planId: string,
  planType: "student_plan" | "ad_hoc_plan",
  targetDate: string,
  targetStartTime?: string,
  targetEndTime?: string
): Promise<{ hasConflict: boolean; conflictingPlan?: string }> {
  // 시간이 지정되지 않은 경우 충돌 검사 생략
  if (!targetStartTime || !targetEndTime) {
    return { hasConflict: false };
  }

  // student_plan 충돌 확인
  const { data: studentPlans } = await supabase
    .from("student_plan")
    .select("id, title, start_time, end_time")
    .eq("student_id", userId)
    .eq("plan_date", targetDate)
    .neq("id", planType === "student_plan" ? planId : "")
    .not("status", "eq", "cancelled");

  // ad_hoc_plans 충돌 확인
  const { data: adHocPlans } = await supabase
    .from("ad_hoc_plans")
    .select("id, title, start_time, end_time")
    .eq("student_id", userId)
    .eq("plan_date", targetDate)
    .neq("id", planType === "ad_hoc_plan" ? planId : "")
    .not("status", "eq", "cancelled");

  const allPlans = [...(studentPlans || []), ...(adHocPlans || [])];

  for (const plan of allPlans) {
    const planStart = plan.start_time;
    const planEnd = plan.end_time;

    if (!planStart || !planEnd) continue;

    // 시간 겹침 확인
    if (targetStartTime < planEnd && targetEndTime > planStart) {
      return { hasConflict: true, conflictingPlan: plan.title || plan.id };
    }
  }

  return { hasConflict: false };
}

// ============================================
// 메인 액션
// ============================================

/**
 * 플랜을 다른 날짜/시간으로 이동
 */
export async function movePlan(input: MovePlanInput): Promise<MovePlanResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const { planId, planType, targetDate, targetStartTime, targetEndTime } = input;

  try {
    // 1. 날짜 유효성 확인
    const dateValidation = validateTargetDate(targetDate);
    if (!dateValidation.valid) {
      return { success: false, error: dateValidation.error };
    }

    // 2. 플랜 소유권 확인
    const ownershipValidation = await validatePlanOwnership(
      supabase,
      planId,
      planType,
      user.userId
    );
    if (!ownershipValidation.valid) {
      return { success: false, error: ownershipValidation.error };
    }

    // 3. 플랜 상태 확인
    const statusValidation = validatePlanStatus(ownershipValidation.plan!);
    if (!statusValidation.valid) {
      return { success: false, error: statusValidation.error };
    }

    // 4. 시간 충돌 확인
    const conflictCheck = await checkTimeConflict(
      supabase,
      user.userId,
      planId,
      planType,
      targetDate,
      targetStartTime,
      targetEndTime
    );
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        error: `해당 시간에 이미 다른 플랜(${conflictCheck.conflictingPlan})이 있습니다.`,
      };
    }

    // 5. 플랜 업데이트
    const table = planType === "student_plan" ? "student_plan" : "ad_hoc_plans";
    const updateData: Record<string, unknown> = {
      plan_date: targetDate,
      updated_at: new Date().toISOString(),
    };

    if (targetStartTime) {
      updateData.start_time = targetStartTime;
    }
    if (targetEndTime) {
      updateData.end_time = targetEndTime;
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(updateData)
      .eq("id", planId);

    if (updateError) {
      console.error("Move plan error:", updateError);
      return { success: false, error: "플랜 이동에 실패했습니다." };
    }

    // 6. 캐시 무효화
    revalidatePath("/plan/calendar");
    revalidatePath("/today");

    return {
      success: true,
      data: {
        planId,
        newDate: targetDate,
        newStartTime: targetStartTime,
        newEndTime: targetEndTime,
      },
    };
  } catch (error) {
    console.error("Move plan error:", error);
    return { success: false, error: "예기치 않은 오류가 발생했습니다." };
  }
}

/**
 * 여러 플랜을 한번에 이동 (배치 처리)
 */
export async function movePlans(
  inputs: MovePlanInput[]
): Promise<{ success: boolean; results: MovePlanResult[] }> {
  const results: MovePlanResult[] = [];
  let allSuccess = true;

  for (const input of inputs) {
    const result = await movePlan(input);
    results.push(result);
    if (!result.success) {
      allSuccess = false;
    }
  }

  return { success: allSuccess, results };
}
