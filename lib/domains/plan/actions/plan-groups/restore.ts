"use server";

/**
 * 플랜 그룹 복원 Server Actions (학생용)
 */

import { revalidatePath } from "next/cache";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  getDeletedPlanGroups,
  getDeletedPlanGroupDetails,
  restorePlanGroup,
} from "@/lib/data/planGroups/restore";
import type {
  DeletedPlanGroupInfo,
  RestorePlanGroupResult,
  PlanGroupBackup,
} from "@/lib/data/planGroups/types";

// =============================================
// 타입 정의
// =============================================

export type GetDeletedPlanGroupsResult = {
  success: boolean;
  data?: DeletedPlanGroupInfo[];
  error?: string;
};

export type RestorePlanGroupActionResult = {
  success: boolean;
  groupId?: string;
  restoredPlansCount?: number;
  error?: string;
};

export type GetDeletedPlanGroupDetailsResult = {
  success: boolean;
  data?: PlanGroupBackup;
  error?: string;
};

// =============================================
// 학생용 Server Actions
// =============================================

/**
 * 삭제된 플랜 그룹 목록 조회 (학생용)
 */
async function _getDeletedPlanGroupsAction(options?: {
  offset?: number;
  limit?: number;
  includeRestored?: boolean;
}): Promise<GetDeletedPlanGroupsResult> {
  const user = await requireStudentAuth();

  try {
    const deletedGroups = await getDeletedPlanGroups({
      studentId: user.userId,
      offset: options?.offset,
      limit: options?.limit,
      includeRestored: options?.includeRestored,
    });

    return {
      success: true,
      data: deletedGroups,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "getDeletedPlanGroupsAction" },
      error,
      { userId: user.userId }
    );
    return {
      success: false,
      error: "삭제된 플랜 그룹 목록을 불러오는 데 실패했습니다.",
    };
  }
}

export const getDeletedPlanGroupsAction = withErrorHandling(_getDeletedPlanGroupsAction);

/**
 * 삭제된 플랜 그룹 상세 조회 (학생용)
 */
async function _getDeletedPlanGroupDetailsAction(
  backupId: string
): Promise<GetDeletedPlanGroupDetailsResult> {
  const user = await requireStudentAuth();

  if (!backupId) {
    throw new AppError(
      "백업 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  try {
    const backup = await getDeletedPlanGroupDetails(backupId, user.userId);

    if (!backup) {
      return {
        success: false,
        error: "백업을 찾을 수 없습니다.",
      };
    }

    return {
      success: true,
      data: backup,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "getDeletedPlanGroupDetailsAction" },
      error,
      { userId: user.userId, backupId }
    );
    return {
      success: false,
      error: "백업 상세 정보를 불러오는 데 실패했습니다.",
    };
  }
}

export const getDeletedPlanGroupDetailsAction = withErrorHandling(
  _getDeletedPlanGroupDetailsAction
);

/**
 * 플랜 그룹 복원 실행 (학생용)
 */
async function _restorePlanGroupAction(
  backupId: string
): Promise<RestorePlanGroupActionResult> {
  const user = await requireStudentAuth();

  if (!backupId) {
    throw new AppError(
      "백업 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  try {
    const result: RestorePlanGroupResult = await restorePlanGroup(
      backupId,
      user.userId,
      user.userId
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "플랜 그룹 복원에 실패했습니다.",
      };
    }

    // 캐시 무효화
    revalidatePath("/plan");
    revalidatePath(`/plan/group/${result.groupId}`);

    return {
      success: true,
      groupId: result.groupId,
      restoredPlansCount: result.restoredPlansCount,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "restorePlanGroupAction" },
      error,
      { userId: user.userId, backupId }
    );
    return {
      success: false,
      error: "플랜 그룹 복원 중 오류가 발생했습니다.",
    };
  }
}

export const restorePlanGroupAction = withErrorHandling(_restorePlanGroupAction);
