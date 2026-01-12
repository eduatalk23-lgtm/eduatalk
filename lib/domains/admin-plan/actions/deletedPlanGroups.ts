"use server";

/**
 * 플랜 그룹 복원 관련 Server Actions (관리자용)
 */

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  getDeletedPlanGroupsForAdmin,
  getDeletedPlanGroupDetailsForAdmin,
  restorePlanGroupForAdmin,
  permanentlyDeleteBackup,
} from "@/lib/data/planGroups/restore";
import { createPlanEvent } from "./planEvent";
import type { AdminPlanResponse } from "../types";
import type {
  DeletedPlanGroupInfo,
  PlanGroupBackup,
} from "@/lib/data/planGroups/types";

// =============================================
// 타입 정의
// =============================================

export interface DeletedPlanGroupsResult {
  planGroups: DeletedPlanGroupInfo[];
  totalCount: number;
  hasMore: boolean;
}

export interface GetDeletedPlanGroupsOptions {
  offset?: number;
  limit?: number;
  includeRestored?: boolean;
}

export interface RestorePlanGroupResult {
  groupId: string;
  restoredPlansCount: number;
}

const DEFAULT_LIMIT = 20;

// =============================================
// 관리자용 Server Actions
// =============================================

/**
 * 삭제된 플랜 그룹 목록 조회 (관리자용)
 */
export async function getDeletedPlanGroupsAdmin(
  studentId: string,
  options: GetDeletedPlanGroupsOptions = {}
): Promise<AdminPlanResponse<DeletedPlanGroupsResult>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });

    const { offset = 0, limit = DEFAULT_LIMIT, includeRestored = false } = options;

    const deletedGroups = await getDeletedPlanGroupsForAdmin({
      studentId,
      tenantId: tenantId || undefined,
      offset,
      limit: limit + 1, // hasMore 체크를 위해 1개 더 조회
      includeRestored,
    });

    const hasMore = deletedGroups.length > limit;
    const planGroups = hasMore ? deletedGroups.slice(0, limit) : deletedGroups;

    return {
      success: true,
      data: {
        planGroups,
        totalCount: planGroups.length, // 정확한 total count가 필요하면 별도 count 쿼리 필요
        hasMore,
      },
    };
  } catch (error) {
    logActionError(
      { domain: "admin-plan", action: "getDeletedPlanGroupsAdmin" },
      error,
      { studentId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "삭제된 플랜 그룹 조회 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 삭제된 플랜 그룹 상세 조회 (관리자용)
 */
export async function getDeletedPlanGroupDetailsAdmin(
  backupId: string,
  studentId: string
): Promise<AdminPlanResponse<PlanGroupBackup>> {
  try {
    await requireAdminOrConsultant({ requireTenant: true });

    if (!backupId) {
      return { success: false, error: "백업 ID가 필요합니다." };
    }

    const backup = await getDeletedPlanGroupDetailsForAdmin(backupId, studentId);

    if (!backup) {
      return { success: false, error: "백업을 찾을 수 없습니다." };
    }

    return {
      success: true,
      data: backup,
    };
  } catch (error) {
    logActionError(
      { domain: "admin-plan", action: "getDeletedPlanGroupDetailsAdmin" },
      error,
      { backupId, studentId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "백업 상세 정보 조회 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 플랜 그룹 복원 (관리자용)
 */
export async function restorePlanGroupAdmin(
  backupId: string,
  studentId: string
): Promise<AdminPlanResponse<RestorePlanGroupResult>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });

    if (!backupId) {
      return { success: false, error: "백업 ID가 필요합니다." };
    }

    const result = await restorePlanGroupForAdmin(backupId, studentId, userId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "플랜 그룹 복원에 실패했습니다.",
      };
    }

    // 이벤트 로깅
    if (tenantId && result.groupId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: "plan_group_updated",
        event_category: "plan_group",
        actor_type: "admin",
        actor_id: userId,
        payload: {
          action: "restore",
          backup_id: backupId,
          group_id: result.groupId,
          restored_plans_count: result.restoredPlansCount,
        },
      });
    }

    // 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath("/today");
    revalidatePath("/plan");

    return {
      success: true,
      data: {
        groupId: result.groupId!,
        restoredPlansCount: result.restoredPlansCount || 0,
      },
    };
  } catch (error) {
    logActionError(
      { domain: "admin-plan", action: "restorePlanGroupAdmin" },
      error,
      { backupId, studentId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "플랜 그룹 복원 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 플랜 그룹 백업 영구 삭제 (관리자용)
 */
export async function permanentlyDeletePlanGroupBackup(
  backupId: string,
  studentId: string
): Promise<AdminPlanResponse<void>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });

    if (!backupId) {
      return { success: false, error: "백업 ID가 필요합니다." };
    }

    // 삭제 전 백업 정보 조회 (로깅용)
    const backup = await getDeletedPlanGroupDetailsForAdmin(backupId, studentId);

    const result = await permanentlyDeleteBackup(backupId, studentId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "백업 삭제에 실패했습니다.",
      };
    }

    // 이벤트 로깅
    if (tenantId && backup) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: "plan_group_deleted",
        event_category: "plan_group",
        actor_type: "admin",
        actor_id: userId,
        payload: {
          action: "permanent_delete_backup",
          backup_id: backupId,
          group_id: backup.plan_group_id,
          group_name: backup.backup_data?.plan_group?.name,
        },
      });
    }

    // 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "admin-plan", action: "permanentlyDeletePlanGroupBackup" },
      error,
      { backupId, studentId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "백업 영구 삭제 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 플랜 그룹 백업 일괄 복원 (관리자용)
 */
export async function bulkRestorePlanGroups(
  backupIds: string[],
  studentId: string
): Promise<AdminPlanResponse<{ restoredCount: number; failedCount: number }>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });

    if (backupIds.length === 0) {
      return { success: false, error: "복원할 백업을 선택해주세요." };
    }

    let restoredCount = 0;
    let failedCount = 0;
    const restoredGroupIds: string[] = [];

    for (const backupId of backupIds) {
      const result = await restorePlanGroupForAdmin(backupId, studentId, userId);
      if (result.success && result.groupId) {
        restoredCount++;
        restoredGroupIds.push(result.groupId);
      } else {
        failedCount++;
      }
    }

    // 이벤트 로깅
    if (tenantId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: "bulk_update",
        event_category: "plan_group",
        actor_type: "admin",
        actor_id: userId,
        payload: {
          action: "bulk_restore",
          backup_ids: backupIds,
          restored_group_ids: restoredGroupIds,
          restored_count: restoredCount,
          failed_count: failedCount,
        },
      });
    }

    // 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath("/today");
    revalidatePath("/plan");

    return {
      success: true,
      data: {
        restoredCount,
        failedCount,
      },
    };
  } catch (error) {
    logActionError(
      { domain: "admin-plan", action: "bulkRestorePlanGroups" },
      error,
      { backupIds, studentId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "일괄 복원 중 오류가 발생했습니다.",
    };
  }
}
