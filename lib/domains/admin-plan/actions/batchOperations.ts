"use server";

/**
 * 배치 플랜 작업 서버 액션
 *
 * 여러 플랜에 대한 일괄 작업을 수행합니다.
 * - 일괄 날짜 이동
 * - 일괄 상태 변경
 * - 일괄 삭제
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logActionError } from "@/lib/logging/actionLogger";
import { addDays, format, parseISO } from "date-fns";
import type { AdminPlanResponse, PlanStatus } from "../types";
import { createPlanEvent } from "./planEvent";

// ============================================
// 타입 정의
// ============================================

interface BatchDateShiftInput {
  planIds: string[];
  daysToShift: number;
  studentId: string;
  tenantId: string;
}

interface BatchStatusUpdateInput {
  planIds: string[];
  status: PlanStatus;
  studentId: string;
  tenantId: string;
}

interface BatchDeleteInput {
  planIds: string[];
  studentId: string;
  tenantId: string;
}

interface BatchOperationResult {
  updatedCount?: number;
  deletedCount?: number;
  failedIds?: string[];
}

// ============================================
// 배치 날짜 이동
// ============================================

/**
 * 여러 플랜의 날짜를 일괄적으로 이동합니다.
 */
export async function batchUpdatePlanDates(
  input: BatchDateShiftInput
): Promise<AdminPlanResponse<BatchOperationResult>> {
  try {
    const { tenantId: authTenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });
    const currentUser = await getCurrentUser();

    if (authTenantId !== input.tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (input.planIds.length === 0) {
      return { success: false, error: "선택된 플랜이 없습니다." };
    }

    if (input.planIds.length > 100) {
      return { success: false, error: "한 번에 최대 100개까지 처리할 수 있습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 현재 플랜들의 날짜 조회
    const { data: plans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, plan_date")
      .in("id", input.planIds)
      .eq("student_id", input.studentId)
      .eq("is_active", true);

    if (fetchError) {
      throw fetchError;
    }

    if (!plans || plans.length === 0) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    // 각 플랜의 새 날짜 계산
    const updates = plans.map((plan) => {
      const currentDate = parseISO(plan.plan_date);
      const newDate = addDays(currentDate, input.daysToShift);
      return {
        id: plan.id,
        newDate: format(newDate, "yyyy-MM-dd"),
      };
    });

    // 일괄 업데이트 실행
    let updatedCount = 0;
    const failedIds: string[] = [];

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("student_plan")
        .update({
          plan_date: update.newDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id);

      if (updateError) {
        failedIds.push(update.id);
      } else {
        updatedCount++;
      }
    }

    // 이벤트 로깅
    await createPlanEvent({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      student_plan_id: input.planIds[0], // 대표 플랜 ID
      event_type: "bulk_update",
      event_category: "plan_item",
      actor_id: currentUser?.userId || null,
      actor_type: "admin",
      payload: {
        action: "batch_date_shifted",
        planIds: input.planIds,
        daysShifted: input.daysToShift,
        updatedCount,
        failedCount: failedIds.length,
        description: `${updatedCount}개 플랜 날짜 ${input.daysToShift > 0 ? "+" : ""}${input.daysToShift}일 이동`,
      },
    });

    return {
      success: true,
      data: { updatedCount, failedIds: failedIds.length > 0 ? failedIds : undefined },
    };
  } catch (error) {
    logActionError({ domain: "admin-plan", action: "batchUpdatePlanDates" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "날짜 이동에 실패했습니다.",
    };
  }
}

// ============================================
// 배치 상태 변경
// ============================================

/**
 * 여러 플랜의 상태를 일괄적으로 변경합니다.
 */
export async function batchUpdatePlanStatus(
  input: BatchStatusUpdateInput
): Promise<AdminPlanResponse<BatchOperationResult>> {
  try {
    const { tenantId: authTenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });
    const currentUser = await getCurrentUser();

    if (authTenantId !== input.tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (input.planIds.length === 0) {
      return { success: false, error: "선택된 플랜이 없습니다." };
    }

    if (input.planIds.length > 100) {
      return { success: false, error: "한 번에 최대 100개까지 처리할 수 있습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 일괄 업데이트
    const { data, error } = await supabase
      .from("student_plan")
      .update({
        status: input.status,
        updated_at: new Date().toISOString(),
      })
      .in("id", input.planIds)
      .eq("student_id", input.studentId)
      .eq("is_active", true)
      .select("id");

    if (error) {
      throw error;
    }

    const updatedCount = data?.length || 0;

    // 이벤트 로깅
    await createPlanEvent({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      student_plan_id: input.planIds[0],
      event_type: "bulk_update",
      event_category: "plan_item",
      actor_id: currentUser?.userId || null,
      actor_type: "admin",
      payload: {
        action: "batch_status_changed",
        planIds: input.planIds,
        newStatus: input.status,
        updatedCount,
        description: `${updatedCount}개 플랜 상태 "${input.status}"로 변경`,
      },
    });

    return {
      success: true,
      data: { updatedCount },
    };
  } catch (error) {
    logActionError({ domain: "admin-plan", action: "batchUpdatePlanStatus" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "상태 변경에 실패했습니다.",
    };
  }
}

// ============================================
// 배치 삭제
// ============================================

/**
 * 여러 플랜을 일괄적으로 삭제(비활성화)합니다.
 */
export async function batchDeletePlans(
  input: BatchDeleteInput
): Promise<AdminPlanResponse<BatchOperationResult>> {
  try {
    const { tenantId: authTenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });
    const currentUser = await getCurrentUser();

    if (authTenantId !== input.tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (input.planIds.length === 0) {
      return { success: false, error: "선택된 플랜이 없습니다." };
    }

    if (input.planIds.length > 100) {
      return { success: false, error: "한 번에 최대 100개까지 처리할 수 있습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 소프트 삭제 (is_active = false)
    const { data, error } = await supabase
      .from("student_plan")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", input.planIds)
      .eq("student_id", input.studentId)
      .eq("is_active", true)
      .select("id");

    if (error) {
      throw error;
    }

    const deletedCount = data?.length || 0;

    // 이벤트 로깅
    await createPlanEvent({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      student_plan_id: input.planIds[0],
      event_type: "bulk_update",
      event_category: "plan_item",
      actor_id: currentUser?.userId || null,
      actor_type: "admin",
      payload: {
        action: "batch_deleted",
        planIds: input.planIds,
        deletedCount,
        description: `${deletedCount}개 플랜 일괄 삭제`,
      },
    });

    return {
      success: true,
      data: { deletedCount },
    };
  } catch (error) {
    logActionError({ domain: "admin-plan", action: "batchDeletePlans" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "삭제에 실패했습니다.",
    };
  }
}
