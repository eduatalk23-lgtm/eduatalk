/**
 * 재조정 강제 정리 Server Actions
 * 
 * 비정상 상태의 재조정을 정리하고 복구합니다.
 * 
 * @module app/(admin)/actions/reschedule/cleanup
 */

"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

// ============================================
// 타입 정의
// ============================================

/**
 * 정리 결과
 */
export interface CleanupResult {
  success: boolean;
  cleanedPlans: number;
  restoredPlans: number;
  error?: string;
}

/**
 * 복구 결과
 */
export interface RecoveryResult {
  success: boolean;
  recoveredLogs: number;
  error?: string;
}

// ============================================
// 정리 함수
// ============================================

/**
 * 비정상 상태 플랜 정리
 * 
 * is_active=false이고 replaced_by가 없는 고아 플랜을 정리합니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @returns 정리 결과
 */
async function _cleanupOrphanedPlans(
  groupId: string
): Promise<CleanupResult> {
  return (async () => {
    const { role } = await getCurrentUserRole();
    if (!isAdminRole(role)) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const tenantContext = await requireTenantContext();
    const supabase = await createSupabaseServerClient();

    // 비정상 상태 플랜 조회
    // is_active=false이고 version_group_id가 있지만 활성 버전이 없는 경우
    const { data: orphanedPlans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, version_group_id")
      .eq("plan_group_id", groupId)
      .eq("is_active", false)
      .not("version_group_id", "is", null);

    if (fetchError) {
      throw new AppError(
        `플랜 조회 실패: ${fetchError.message}`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    if (!orphanedPlans || orphanedPlans.length === 0) {
      return {
        success: true,
        cleanedPlans: 0,
        restoredPlans: 0,
      };
    }

    // version_group_id별로 그룹화하여 활성 버전이 있는지 확인
    const versionGroups = new Set(
      orphanedPlans.map((p) => p.version_group_id).filter(Boolean)
    );

    let cleanedCount = 0;
    let restoredCount = 0;

    for (const versionGroupId of versionGroups) {
      // 활성 버전 확인
      const { data: activePlan } = await supabase
        .from("student_plan")
        .select("id")
        .eq("version_group_id", versionGroupId)
        .eq("is_active", true)
        .maybeSingle();

      if (activePlan) {
        // 활성 버전이 있으면 고아 플랜 삭제
        const orphanedIds = orphanedPlans
          .filter((p) => p.version_group_id === versionGroupId)
          .map((p) => p.id);

        const { error: deleteError } = await supabase
          .from("student_plan")
          .delete()
          .in("id", orphanedIds);

        if (!deleteError) {
          cleanedCount += orphanedIds.length;
        }
      } else {
        // 활성 버전이 없으면 가장 최신 버전을 활성화
        const { data: latestPlan } = await supabase
          .from("student_plan")
          .select("id")
          .eq("version_group_id", versionGroupId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestPlan) {
          const { error: restoreError } = await supabase
            .from("student_plan")
            .update({ is_active: true })
            .eq("id", latestPlan.id);

          if (!restoreError) {
            restoredCount++;
          }
        }
      }
    }

    return {
      success: true,
      cleanedPlans: cleanedCount,
      restoredPlans: restoredCount,
    };
  })();
}

export const cleanupOrphanedPlans = withErrorHandling(_cleanupOrphanedPlans);

/**
 * 실패한 재조정 복구
 * 
 * status='failed'인 재조정 로그를 복구합니다.
 * 
 * @param rescheduleLogId 재조정 로그 ID
 * @returns 복구 결과
 */
async function _recoverFailedReschedule(
  rescheduleLogId: string
): Promise<RecoveryResult> {
  return (async () => {
    const { role } = await getCurrentUserRole();
    if (!isAdminRole(role)) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const tenantContext = await requireTenantContext();
    const supabase = await createSupabaseServerClient();

    // 실패한 재조정 로그 조회
    const { data: log, error: logError } = await supabase
      .from("reschedule_log")
      .select("*")
      .eq("id", rescheduleLogId)
      .eq("status", "failed")
      .single();

    if (logError || !log) {
      throw new AppError(
        "실패한 재조정 로그를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // TODO: 실제 복구 로직 구현
    // 1. plan_history에서 백업된 플랜 복원
    // 2. 재조정 로그 상태 업데이트
    // 3. 관련 플랜 정리

    // 임시로 상태만 업데이트
    const { error: updateError } = await supabase
      .from("reschedule_log")
      .update({ status: "pending" }) // 재시도 가능하도록 pending으로 변경
      .eq("id", rescheduleLogId);

    if (updateError) {
      throw new AppError(
        `로그 상태 업데이트 실패: ${updateError.message}`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return {
      success: true,
      recoveredLogs: 1,
    };
  })();
}

export const recoverFailedReschedule = withErrorHandling(_recoverFailedReschedule);

