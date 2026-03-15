"use server";

/**
 * Admin Dock 서버 액션
 *
 * DailyDock에서 사용하는 플랜 조작 액션들입니다.
 * 기존 컴포넌트에서 직접 Supabase를 호출하던 로직을 Server Action으로 분리했습니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/utils/serverActionLogger";
import type { PlanStatus } from "@/lib/types/plan";

// ============================================
// 타입 정의
// ============================================

export type ContainerType = "daily";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface DeletePlanResult extends ActionResult {
}

export interface UpdatePlanStatusInput {
  planId: string;
  status: PlanStatus;
  /** React Query 등 클라이언트 캐시로 관리할 때 true로 설정하면 revalidatePath 호출 생략 */
  skipRevalidation?: boolean;
  /** 반복 이벤트 인스턴스 날짜 (YYYY-MM-DD). 제공 시 개별 인스턴스만 완료 처리 */
  instanceDate?: string;
}

export interface DeletePlanInput {
  planId: string;
  /** React Query 등 클라이언트 캐시로 관리할 때 true로 설정하면 revalidatePath 호출 생략 */
  skipRevalidation?: boolean;
}

export interface MovePlanToContainerInput {
  planId: string;
  targetContainer: ContainerType;
  /** daily로 이동할 때 설정할 날짜 (YYYY-MM-DD) */
  targetDate?: string;
  /** React Query 등 클라이언트 캐시로 관리할 때 true로 설정하면 revalidatePath 호출 생략 */
  skipRevalidation?: boolean;
}

export interface UpdatePlanRangeInput {
  planId: string;
  startValue: number;
  endValue: number;
  /** React Query 등 클라이언트 캐시로 관리할 때 true로 설정하면 revalidatePath 호출 생략 */
  skipRevalidation?: boolean;
}

// ============================================
// 권한 검증 헬퍼
// ============================================

/**
 * 관리자 권한 확인
 */
function isAdmin(user: { role: string }): boolean {
  return user.role === "admin" || user.role === "superadmin";
}

/**
 * 플랜 소유권 검증 (학생인 경우 본인 플랜만 조작 가능)
 * @returns studentId를 함께 반환하여 캐시 무효화에 활용
 */
async function verifyPlanAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planId: string,
  user: { userId: string; role: string }
): Promise<{ allowed: boolean; error?: string; studentId?: string }> {
  // 플랜 조회 (studentId는 캐시 무효화에 필요하므로 항상 조회)
  const { data: plan } = await supabase
    .from("student_plan")
    .select("student_id")
    .eq("id", planId)
    .single();

  if (!plan) {
    return { allowed: false, error: "플랜을 찾을 수 없습니다." };
  }

  // 관리자는 모든 플랜에 접근 가능
  if (isAdmin(user)) {
    return { allowed: true, studentId: plan.student_id };
  }

  // 학생인 경우 본인 플랜인지 확인
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", user.userId)
    .single();

  if (!student) {
    return { allowed: false, error: "학생 정보를 찾을 수 없습니다." };
  }

  if (plan.student_id !== student.id) {
    return { allowed: false, error: "이 플랜에 대한 권한이 없습니다." };
  }

  return { allowed: true, studentId: plan.student_id };
}

// ============================================
// 플랜 상태 변경 (Calendar Event 경로)
// ============================================

import { updatePlanStatus as updateCalendarEventStatus } from "@/lib/domains/calendar/actions/calendarEventActions";

/**
 * 플랜 상태를 변경합니다.
 * Calendar Event 경로: calendar_events.status + event_study_data.done 업데이트
 */
export async function updatePlanStatus(
  input: UpdatePlanStatusInput
): Promise<ActionResult> {
  const { planId, status, skipRevalidation = false, instanceDate } = input;
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const result = await updateCalendarEventStatus({ planId, status, instanceDate });
    if (!result.success) {
      return { success: false, error: result.error ?? "상태 변경에 실패했습니다." };
    }

    if (!skipRevalidation) {
      revalidatePath("/today");
      revalidatePath("/plan");
    }

    return { success: true };
  } catch (error) {
    logActionError(
      "dock.updatePlanStatus",
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );
    return { success: false, error: "예기치 않은 오류가 발생했습니다." };
  }
}

/**
 * 플랜 완료 상태를 토글합니다.
 * @param skipRevalidation React Query 등 클라이언트 캐시로 관리할 때 true
 */
export async function togglePlanComplete(
  planId: string,
  isCurrentlyCompleted: boolean,
  skipRevalidation: boolean = false,
  instanceDate?: string,
): Promise<ActionResult> {
  const newStatus: PlanStatus = isCurrentlyCompleted ? "pending" : "completed";
  return updatePlanStatus({ planId, status: newStatus, skipRevalidation, instanceDate });
}

// ============================================
// 플랜 삭제
// ============================================

/**
 * 플랜을 삭제합니다 (soft delete: is_active = false).
 */
export async function deletePlan(input: DeletePlanInput): Promise<DeletePlanResult> {
  const { planId, skipRevalidation = false } = input;
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 권한 검증
  const access = await verifyPlanAccess(supabase, planId, user);
  if (!access.allowed) {
    return { success: false, error: access.error };
  }

  try {
    // soft delete
    const { error } = await supabase
      .from("student_plan")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);

    if (error) {
      logActionError("dock.deletePlan", `삭제 실패: ${error.message}`);
      return { success: false, error: "삭제에 실패했습니다." };
    }

    // 캐시 무효화 - React Query로 관리하는 경우 생략 가능
    if (!skipRevalidation) {
      if (access.studentId) {
        revalidatePath(`/admin/students/${access.studentId}`);
      }
      revalidatePath("/today");
      revalidatePath("/plan");
    }

    return { success: true };
  } catch (error) {
    logActionError(
      "dock.deletePlan",
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );
    return { success: false, error: "예기치 않은 오류가 발생했습니다." };
  }
}

// ============================================
// 컨테이너 이동
// ============================================

/**
 * 플랜을 다른 컨테이너(daily/weekly/unfinished)로 이동합니다.
 */
export async function movePlanToContainer(
  input: MovePlanToContainerInput
): Promise<ActionResult> {
  const { planId, targetContainer, targetDate, skipRevalidation = false } = input;
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 권한 검증
  const access = await verifyPlanAccess(supabase, planId, user);
  if (!access.allowed) {
    return { success: false, error: access.error };
  }

  try {
    const now = new Date().toISOString();

    // sequence 할당을 위해 현재 플랜 정보 조회
    let newSequence: number | undefined;
    {
      // 현재 플랜의 student_id, plan_date 조회
      const { data: plan } = await supabase
        .from("student_plan")
        .select("student_id, plan_date")
        .eq("id", planId)
        .single();

      if (!plan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 이동할 날짜 결정 (targetDate가 있으면 그 날짜, 없으면 기존 plan_date)
      const effectiveDate = targetDate ?? plan.plan_date;

      // 대상 컨테이너의 현재 최대 sequence 조회
      const { data: maxSeqData } = await supabase
        .from("student_plan")
        .select("sequence")
        .eq("student_id", plan.student_id)
        .eq("plan_date", effectiveDate)
        .eq("container_type", targetContainer)
        .eq("is_active", true)
        .order("sequence", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      newSequence = (maxSeqData?.sequence ?? 0) + 1;
    }

    const updateData: Record<string, unknown> = {
      container_type: targetContainer,
      updated_at: now,
    };

    // daily로 이동할 때 날짜 설정
    if (targetContainer === "daily" && targetDate) {
      updateData.plan_date = targetDate;
    }

    // sequence 할당
    if (newSequence !== undefined) {
      updateData.sequence = newSequence;
    }

    const { error } = await supabase
      .from("student_plan")
      .update(updateData)
      .eq("id", planId);

    if (error) {
      logActionError("dock.movePlanToContainer", `이동 실패: ${error.message}`);
      return { success: false, error: "이동에 실패했습니다." };
    }

    // 캐시 무효화 - React Query로 관리하는 경우 생략 가능
    if (!skipRevalidation) {
      if (access.studentId) {
        revalidatePath(`/admin/students/${access.studentId}`);
      }
      revalidatePath("/today");
      revalidatePath("/plan");
    }

    return { success: true };
  } catch (error) {
    logActionError(
      "dock.movePlanToContainer",
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );
    return { success: false, error: "예기치 않은 오류가 발생했습니다." };
  }
}

// ============================================
// 범위 업데이트
// ============================================

/**
 * 플랜의 학습 범위를 업데이트합니다.
 */
export async function updatePlanRange(
  input: UpdatePlanRangeInput
): Promise<ActionResult> {
  const { planId, startValue, endValue, skipRevalidation = false } = input;
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 권한 검증
  const access = await verifyPlanAccess(supabase, planId, user);
  if (!access.allowed) {
    return { success: false, error: access.error };
  }

  // 유효성 검사
  if (startValue > endValue) {
    return { success: false, error: "시작 값이 종료 값보다 클 수 없습니다." };
  }

  try {
    const { error } = await supabase
      .from("student_plan")
      .update({
        planned_start_page_or_time: startValue,
        planned_end_page_or_time: endValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);

    if (error) {
      logActionError("dock.updatePlanRange", `범위 업데이트 실패: ${error.message}`);
      return { success: false, error: "범위 업데이트에 실패했습니다." };
    }

    // 캐시 무효화 - React Query로 관리하는 경우 생략 가능
    if (!skipRevalidation) {
      if (access.studentId) {
        revalidatePath(`/admin/students/${access.studentId}`);
      }
      revalidatePath("/today");
      revalidatePath("/plan");
    }

    return { success: true };
  } catch (error) {
    logActionError(
      "dock.updatePlanRange",
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );
    return { success: false, error: "예기치 않은 오류가 발생했습니다." };
  }
}

// ============================================
// 배치 작업
// ============================================

/**
 * 여러 플랜을 한번에 삭제합니다. (관리자 전용)
 */
export async function deletePlans(
  planIds: string[]
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, deletedCount: 0, error: "로그인이 필요합니다." };
  }

  // 배치 작업은 관리자만 가능
  if (!isAdmin(user)) {
    return { success: false, deletedCount: 0, error: "관리자 권한이 필요합니다." };
  }

  if (planIds.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  try {
    // student_id 조회 (캐시 무효화용)
    const { data: plansData } = await supabase
      .from("student_plan")
      .select("student_id")
      .in("id", planIds);

    const studentIds = [...new Set(plansData?.map((p) => p.student_id) ?? [])];

    // soft delete
    const { error } = await supabase
      .from("student_plan")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", planIds);

    if (error) {
      logActionError("dock.deletePlans", `배치 삭제 실패: ${error.message}`);
      return { success: false, deletedCount: 0, error: "삭제에 실패했습니다." };
    }

    // 캐시 무효화 - 관련 학생 경로만 무효화
    for (const studentId of studentIds) {
      revalidatePath(`/admin/students/${studentId}`);
    }
    revalidatePath("/today");
    revalidatePath("/plan");

    return { success: true, deletedCount: planIds.length };
  } catch (error) {
    logActionError(
      "dock.deletePlans",
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );
    return { success: false, deletedCount: 0, error: "예기치 않은 오류가 발생했습니다." };
  }
}

/**
 * 여러 플랜을 다른 컨테이너로 이동합니다. (관리자 전용)
 */
export async function movePlansToContainer(
  planIds: string[],
  targetContainer: ContainerType,
  targetDate?: string
): Promise<{ success: boolean; movedCount: number; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, movedCount: 0, error: "로그인이 필요합니다." };
  }

  // 배치 작업은 관리자만 가능
  if (!isAdmin(user)) {
    return { success: false, movedCount: 0, error: "관리자 권한이 필요합니다." };
  }

  if (planIds.length === 0) {
    return { success: true, movedCount: 0 };
  }

  try {
    const now = new Date().toISOString();

    // 플랜 정보 조회 (student_id, plan_date 그룹별로 sequence 계산 필요)
    const { data: plans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, student_id, plan_date")
      .in("id", planIds);

    if (fetchError || !plans) {
      logActionError("dock.movePlansToContainer", `플랜 조회 실패: ${fetchError?.message}`);
      return { success: false, movedCount: 0, error: "플랜 조회에 실패했습니다." };
    }

    // 각 플랜에 대해 개별적으로 sequence를 할당하며 업데이트
    // (동일 student_id/plan_date 그룹 내에서 순차적으로 sequence 할당)
    const sequenceCache = new Map<string, number>(); // "student_id:date:container" -> nextSequence

    for (const plan of plans) {
      const effectiveDate = targetDate ?? plan.plan_date;
      const cacheKey = `${plan.student_id}:${effectiveDate}:${targetContainer}`;

      // 캐시에 없으면 현재 최대 sequence 조회
      if (!sequenceCache.has(cacheKey)) {
        const { data: maxSeqData } = await supabase
          .from("student_plan")
          .select("sequence")
          .eq("student_id", plan.student_id)
          .eq("plan_date", effectiveDate)
          .eq("container_type", targetContainer)
          .eq("is_active", true)
          .order("sequence", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        sequenceCache.set(cacheKey, (maxSeqData?.sequence ?? 0) + 1);
      }

      const newSequence = sequenceCache.get(cacheKey)!;
      sequenceCache.set(cacheKey, newSequence + 1);

      const updateData: Record<string, unknown> = {
        container_type: targetContainer,
        sequence: newSequence,
        updated_at: now,
      };

      if (targetContainer === "daily" && targetDate) {
        updateData.plan_date = targetDate;
      }

      const { error } = await supabase
        .from("student_plan")
        .update(updateData)
        .eq("id", plan.id);

      if (error) {
        logActionError("dock.movePlansToContainer", `배치 이동 중 실패: ${error.message}`);
        // 일부 실패해도 계속 진행
      }
    }

    // 캐시 무효화 - 관련 학생 경로만 무효화
    const studentIds = [...new Set(plans.map((p) => p.student_id))];
    for (const studentId of studentIds) {
      revalidatePath(`/admin/students/${studentId}`);
    }
    revalidatePath("/today");
    revalidatePath("/plan");

    return { success: true, movedCount: planIds.length };
  } catch (error) {
    logActionError(
      "dock.movePlansToContainer",
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );
    return { success: false, movedCount: 0, error: "예기치 않은 오류가 발생했습니다." };
  }
}

// ============================================
// Undo 복원 액션
// ============================================

/**
 * soft-deleted student_plan을 복원합니다.
 */
export async function restoreStudentPlan(planId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  if (!isAdmin(user)) {
    return { success: false, error: "관리자 권한이 필요합니다." };
  }

  try {
    const { error } = await supabase
      .from("student_plan")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", planId);

    if (error) {
      logActionError("dock.restoreStudentPlan", `복원 실패: ${error.message}`);
      return { success: false, error: "플랜 복원에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    logActionError(
      "dock.restoreStudentPlan",
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );
    return { success: false, error: "예기치 않은 오류가 발생했습니다." };
  }
}

