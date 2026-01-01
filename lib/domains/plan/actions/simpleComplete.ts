"use server";

/**
 * 간단 완료 처리 서버 액션
 *
 * 타이머 없이 체크박스만으로 플랜을 완료할 수 있는 기능을 제공합니다.
 * 기존 타이머 기반 완료와 병존합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";
import { parseStudentPermissions } from "@/lib/types/plan/completion";

// ============================================
// 타입 정의
// ============================================

export interface SimpleCompleteInput {
  planId: string;
  note?: string;
}

export interface SimpleCompleteResult {
  success: boolean;
  completedAt?: string;
  error?: string;
}

// ============================================
// 일반 플랜 간단 완료
// ============================================

/**
 * 일반 플랜을 간단 완료 처리합니다.
 *
 * @param input - 완료 처리 입력
 * @returns 완료 결과
 */
export async function simpleCompletePlan(
  input: SimpleCompleteInput
): Promise<SimpleCompleteResult> {
  const { planId, note } = input;
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 플랜 조회 및 권한 검사
    const { data: plan, error: planError } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        student_id,
        plan_group_id,
        status,
        simple_completion,
        plan_groups(student_permissions)
      `
      )
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return { success: false, error: "Plan not found" };
    }

    // 이미 완료된 경우
    if (plan.status === "completed" || plan.simple_completion) {
      return { success: false, error: "Plan already completed" };
    }

    // 학생의 경우 권한 검사
    if (user.role === "student") {
      // 본인 플랜인지 확인
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.userId)
        .single();

      if (!student || plan.student_id !== student.id) {
        return { success: false, error: "Permission denied" };
      }

      // 완료 권한 확인
      const planGroup = plan.plan_groups as unknown as { student_permissions: unknown } | null;
      if (planGroup?.student_permissions) {
        const permissions = parseStudentPermissions(planGroup.student_permissions);
        if (!permissions.canComplete) {
          return { success: false, error: "Completion not allowed" };
        }
      }
    }

    const now = new Date().toISOString();

    // 간단 완료 처리
    const { error: updateError } = await supabase
      .from("student_plan")
      .update({
        status: "completed",
        simple_completion: true,
        simple_completed_at: now,
        memo: note || null,
        updated_at: now,
      })
      .eq("id", planId);

    if (updateError) {
      console.error("Simple complete error:", updateError);
      return { success: false, error: "Failed to complete" };
    }

    // 캐시 무효화
    revalidatePath("/today");
    revalidatePath("/plan");
    if (plan.plan_group_id) {
      revalidatePath(`/plan/group/${plan.plan_group_id}`);
    }

    return { success: true, completedAt: now };
  } catch (error) {
    console.error("Simple complete error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * 간단 완료를 취소합니다. (관리자 전용)
 *
 * @param planId - 플랜 ID
 * @returns 취소 결과
 */
export async function undoSimpleComplete(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin only" };
  }

  try {
    const { error } = await supabase
      .from("student_plan")
      .update({
        status: "pending",
        simple_completion: false,
        simple_completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .eq("simple_completion", true); // 간단 완료만 취소 가능

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/today");
    revalidatePath("/plan");

    return { success: true };
  } catch (error) {
    console.error("Undo simple complete error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

// ============================================
// Ad-hoc 플랜 간단 완료
// ============================================

/**
 * Ad-hoc 플랜을 간단 완료 처리합니다.
 *
 * @param input - 완료 처리 입력
 * @returns 완료 결과
 */
export async function simpleCompleteAdHocPlan(
  input: SimpleCompleteInput
): Promise<SimpleCompleteResult> {
  const { planId, note } = input;
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 플랜 조회
    const { data: plan, error: planError } = await supabase
      .from("ad_hoc_plans")
      .select("id, student_id, status, simple_completion")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return { success: false, error: "Plan not found" };
    }

    // 이미 완료된 경우
    if (plan.status === "completed" || plan.simple_completion) {
      return { success: false, error: "Plan already completed" };
    }

    // 학생의 경우 본인 플랜인지 확인
    if (user.role === "student") {
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.userId)
        .single();

      if (!student || plan.student_id !== student.id) {
        return { success: false, error: "Permission denied" };
      }
    }

    const now = new Date().toISOString();

    // 간단 완료 처리
    const { error: updateError } = await supabase
      .from("ad_hoc_plans")
      .update({
        status: "completed",
        simple_completion: true,
        simple_completed_at: now,
        memo: note || null,
        updated_at: now,
      })
      .eq("id", planId);

    if (updateError) {
      console.error("Simple complete ad-hoc error:", updateError);
      return { success: false, error: "Failed to complete" };
    }

    revalidatePath("/today");

    return { success: true, completedAt: now };
  } catch (error) {
    console.error("Simple complete ad-hoc error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Ad-hoc 플랜 간단 완료를 취소합니다. (관리자 전용)
 *
 * @param planId - 플랜 ID
 * @returns 취소 결과
 */
export async function undoSimpleCompleteAdHoc(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin only" };
  }

  try {
    const { error } = await supabase
      .from("ad_hoc_plans")
      .update({
        status: "pending",
        simple_completion: false,
        simple_completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .eq("simple_completion", true);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/today");

    return { success: true };
  } catch (error) {
    console.error("Undo simple complete ad-hoc error:", error);
    return { success: false, error: "Unexpected error" };
  }
}

// ============================================
// 배치 완료 처리
// ============================================

/**
 * 여러 플랜을 한 번에 간단 완료 처리합니다.
 *
 * @param planIds - 플랜 ID 배열
 * @returns 완료 결과
 */
export async function batchSimpleComplete(
  planIds: string[]
): Promise<{ success: boolean; completedCount: number; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, completedCount: 0, error: "Unauthorized" };
  }

  if (planIds.length === 0) {
    return { success: true, completedCount: 0 };
  }

  try {
    const now = new Date().toISOString();

    // 학생의 경우 본인 플랜만 완료 가능
    let query = supabase
      .from("student_plan")
      .update({
        status: "completed",
        simple_completion: true,
        simple_completed_at: now,
        updated_at: now,
      })
      .in("id", planIds)
      .neq("status", "completed")
      .eq("simple_completion", false);

    if (user.role === "student") {
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.userId)
        .single();

      if (!student) {
        return { success: false, completedCount: 0, error: "Student not found" };
      }

      query = query.eq("student_id", student.id);
    }

    const { error, count } = await query.select("id");

    if (error) {
      return { success: false, completedCount: 0, error: error.message };
    }

    revalidatePath("/today");
    revalidatePath("/plan");

    return { success: true, completedCount: count || 0 };
  } catch (error) {
    console.error("Batch simple complete error:", error);
    return { success: false, completedCount: 0, error: "Unexpected error" };
  }
}
