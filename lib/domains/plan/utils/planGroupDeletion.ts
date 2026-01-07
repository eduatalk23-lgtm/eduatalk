/**
 * 플랜 그룹 삭제 유틸리티
 *
 * 플랜 그룹과 관련 데이터를 삭제하는 공통 로직을 제공합니다.
 * 중복 코드를 제거하고 일관된 삭제 패턴을 유지합니다.
 *
 * @module lib/domains/plan/utils/planGroupDeletion
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

export interface DeletePlanGroupCascadeOptions {
  /** 학생 ID (필수) */
  studentId: string;
  /** Hard delete 여부 (기본값: false, soft delete) */
  hardDelete?: boolean;
  /** plan_exclusions 삭제 여부 (기본값: false, 전역 관리이므로 삭제하지 않음) */
  deleteExclusions?: boolean;
}

export interface DeletePlanGroupCascadeResult {
  success: boolean;
  error?: string;
}

/**
 * 플랜 그룹과 관련 데이터를 캐스케이드 삭제
 *
 * 삭제 순서:
 * 1. student_plan 삭제 (hard delete)
 * 2. plan_contents 삭제 (hard delete)
 * 3. plan_exclusions 삭제 (옵션, 기본값: false)
 * 4. plan_groups 삭제 (hard delete 또는 soft delete)
 *
 * @param groupId 플랜 그룹 ID
 * @param options 삭제 옵션
 * @returns 삭제 결과
 */
export async function deletePlanGroupCascade(
  groupId: string,
  options: DeletePlanGroupCascadeOptions
): Promise<DeletePlanGroupCascadeResult> {
  const { studentId, hardDelete = false, deleteExclusions = false } = options;
  const supabase = await createSupabaseServerClient();

  try {
    // 1. student_plan 삭제 (hard delete)
    const { error: deletePlansError } = await supabase
      .from("student_plan")
      .delete()
      .eq("plan_group_id", groupId)
      .eq("student_id", studentId);

    if (deletePlansError) {
      logActionError(
        { domain: "plan", action: "deletePlanGroupCascade" },
        deletePlansError,
        { groupId, step: "deletePlans" }
      );
      return {
        success: false,
        error: `플랜 삭제 실패: ${deletePlansError.message}`,
      };
    }

    // 2. plan_contents 삭제 (hard delete)
    const { error: deleteContentsError } = await supabase
      .from("plan_contents")
      .delete()
      .eq("plan_group_id", groupId);

    if (deleteContentsError) {
      logActionError(
        { domain: "plan", action: "deletePlanGroupCascade" },
        deleteContentsError,
        { groupId, step: "deleteContents" }
      );
      return {
        success: false,
        error: `플랜 콘텐츠 삭제 실패: ${deleteContentsError.message}`,
      };
    }

    // 3. plan_exclusions 삭제 (옵션, 기본값: false)
    if (deleteExclusions) {
      const { error: deleteExclusionsError } = await supabase
        .from("plan_exclusions")
        .delete()
        .eq("plan_group_id", groupId);

      if (deleteExclusionsError) {
        logActionError(
          { domain: "plan", action: "deletePlanGroupCascade" },
          deleteExclusionsError,
          { groupId, step: "deleteExclusions" }
        );
        // exclusions 삭제 실패해도 계속 진행 (경고만)
      }
    }

    // 4. plan_groups 삭제 (hard delete 또는 soft delete)
    if (hardDelete) {
      const { error: deleteGroupError } = await supabase
        .from("plan_groups")
        .delete()
        .eq("id", groupId)
        .eq("student_id", studentId);

      if (deleteGroupError) {
        logActionError(
          { domain: "plan", action: "deletePlanGroupCascade" },
          deleteGroupError,
          { groupId, step: "deleteGroup" }
        );
        return {
          success: false,
          error: `플랜 그룹 삭제 실패: ${deleteGroupError.message}`,
        };
      }
    } else {
      // Soft delete
      const { error: updateGroupError } = await supabase
        .from("plan_groups")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", groupId)
        .eq("student_id", studentId)
        .is("deleted_at", null);

      if (updateGroupError) {
        logActionError(
          { domain: "plan", action: "deletePlanGroupCascade" },
          updateGroupError,
          { groupId, step: "softDeleteGroup" }
        );
        return {
          success: false,
          error: `플랜 그룹 삭제 실패: ${updateGroupError.message}`,
        };
      }
    }

    return {
      success: true,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "deletePlanGroupCascade" },
      error,
      { groupId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

