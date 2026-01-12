/**
 * 플랜 그룹 복원 관련 데이터 접근 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import type {
  PlanGroupBackup,
  PlanGroupBackupData,
  DeletedPlanGroupInfo,
  RestorePlanGroupResult,
  GetDeletedPlanGroupsOptions,
} from "./types";

/**
 * 삭제된 플랜 그룹 목록 조회
 */
export async function getDeletedPlanGroups(
  options: GetDeletedPlanGroupsOptions
): Promise<DeletedPlanGroupInfo[]> {
  const { studentId, tenantId, offset = 0, limit = 50, includeRestored = false } = options;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_group_backups")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (!includeRestored) {
    query = query.is("restored_at", null);
  }

  const { data, error } = await query;

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups/restore] getDeletedPlanGroups",
    });
    return [];
  }

  if (!data) {
    return [];
  }

  return data.map((backup) => {
    const backupData = backup.backup_data as PlanGroupBackupData;
    return {
      id: backup.id,
      planGroupId: backup.plan_group_id,
      name: backupData.plan_group?.name || null,
      planPurpose: backupData.plan_group?.plan_purpose || null,
      periodStart: backupData.plan_group?.period_start || "",
      periodEnd: backupData.plan_group?.period_end || "",
      status: backupData.plan_group?.status || "draft",
      deletedAt: backup.created_at || new Date().toISOString(),
      planCount: backupData.plans?.length || 0,
      contentCount: backupData.contents?.length || 0,
      isRestored: backup.restored_at !== null,
    };
  });
}

/**
 * 삭제된 플랜 그룹 상세 조회
 */
export async function getDeletedPlanGroupDetails(
  backupId: string,
  studentId: string
): Promise<PlanGroupBackup | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("plan_group_backups")
    .select("*")
    .eq("id", backupId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups/restore] getDeletedPlanGroupDetails",
    });
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    plan_group_id: data.plan_group_id,
    student_id: data.student_id,
    tenant_id: data.tenant_id,
    backup_data: data.backup_data as PlanGroupBackupData,
    deleted_by: data.deleted_by,
    created_at: data.created_at || new Date().toISOString(),
    restored_at: data.restored_at,
    restored_by: data.restored_by,
  };
}

/**
 * 관리자용 삭제된 플랜 그룹 상세 조회
 */
export async function getDeletedPlanGroupDetailsForAdmin(
  backupId: string,
  studentId: string
): Promise<PlanGroupBackup | null> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    console.error("[data/planGroups/restore] Admin client unavailable");
    return null;
  }

  const { data, error } = await supabase
    .from("plan_group_backups")
    .select("*")
    .eq("id", backupId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups/restore] getDeletedPlanGroupDetailsForAdmin",
    });
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    plan_group_id: data.plan_group_id,
    student_id: data.student_id,
    tenant_id: data.tenant_id,
    backup_data: data.backup_data as PlanGroupBackupData,
    deleted_by: data.deleted_by,
    created_at: data.created_at || new Date().toISOString(),
    restored_at: data.restored_at,
    restored_by: data.restored_by,
  };
}

/**
 * 플랜 그룹 복원 실행
 */
export async function restorePlanGroup(
  backupId: string,
  studentId: string,
  restoredBy: string
): Promise<RestorePlanGroupResult> {
  const supabase = await createSupabaseServerClient();

  // 1. 백업 데이터 조회
  const backup = await getDeletedPlanGroupDetails(backupId, studentId);

  if (!backup) {
    return { success: false, error: "백업을 찾을 수 없습니다." };
  }

  if (backup.restored_at) {
    return { success: false, error: "이미 복원된 플랜 그룹입니다." };
  }

  const backupData = backup.backup_data;

  // 2. 플랜 그룹 복원 (deleted_at = null)
  const { error: restoreGroupError } = await supabase
    .from("plan_groups")
    .update({
      deleted_at: null,
      status: "draft", // 복원 시 draft 상태로
      updated_at: new Date().toISOString(),
    })
    .eq("id", backup.plan_group_id)
    .eq("student_id", studentId);

  if (restoreGroupError) {
    handleQueryError(restoreGroupError, {
      context: "[data/planGroups/restore] restorePlanGroup - restoreGroup",
    });
    return { success: false, error: "플랜 그룹 복원에 실패했습니다." };
  }

  // 3. student_plan 복원 (백업에서 재생성)
  let restoredPlansCount = 0;

  if (backupData.plans && backupData.plans.length > 0) {
    const plansToInsert = backupData.plans.map((p) => ({
      student_id: studentId,
      tenant_id: backup.tenant_id,
      plan_group_id: backup.plan_group_id,
      plan_date: p.plan_date,
      block_index: p.block_index ?? 0,
      content_type: p.content_type,
      content_id: p.content_id,
      chapter: p.chapter,
      planned_start_page_or_time: p.planned_start_page_or_time,
      planned_end_page_or_time: p.planned_end_page_or_time,
      completed_amount: p.completed_amount,
      is_reschedulable: p.is_reschedulable ?? true,
      start_time: p.start_time,
      end_time: p.end_time,
      is_active: true,
      status: p.status === "completed" ? "completed" : "pending",
    }));

    const { error: insertPlansError, data: insertedPlans } = await supabase
      .from("student_plan")
      .insert(plansToInsert)
      .select("id");

    if (insertPlansError) {
      handleQueryError(insertPlansError, {
        context: "[data/planGroups/restore] restorePlanGroup - insertPlans",
      });

      // 롤백: 플랜 그룹 다시 삭제
      await supabase
        .from("plan_groups")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", backup.plan_group_id);

      return { success: false, error: "플랜 복원에 실패했습니다." };
    }

    restoredPlansCount = insertedPlans?.length || 0;
  }

  // 4. 백업 복원 완료 표시
  const { error: markRestoredError } = await supabase
    .from("plan_group_backups")
    .update({
      restored_at: new Date().toISOString(),
      restored_by: restoredBy,
    })
    .eq("id", backupId);

  if (markRestoredError) {
    handleQueryError(markRestoredError, {
      context: "[data/planGroups/restore] restorePlanGroup - markRestored",
    });
    // 복원은 성공했으므로 에러로 처리하지 않음
  }

  return {
    success: true,
    groupId: backup.plan_group_id,
    restoredPlansCount,
  };
}

/**
 * 관리자용 플랜 그룹 복원 실행
 */
export async function restorePlanGroupForAdmin(
  backupId: string,
  studentId: string,
  restoredBy: string
): Promise<RestorePlanGroupResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    console.error("[data/planGroups/restore] Admin client unavailable");
    return { success: false, error: "관리자 클라이언트를 사용할 수 없습니다." };
  }

  // 1. 백업 데이터 조회
  const backup = await getDeletedPlanGroupDetailsForAdmin(backupId, studentId);

  if (!backup) {
    return { success: false, error: "백업을 찾을 수 없습니다." };
  }

  if (backup.restored_at) {
    return { success: false, error: "이미 복원된 플랜 그룹입니다." };
  }

  const backupData = backup.backup_data;

  // 2. 플랜 그룹 복원 (deleted_at = null)
  const { error: restoreGroupError } = await supabase
    .from("plan_groups")
    .update({
      deleted_at: null,
      status: "draft", // 복원 시 draft 상태로
      updated_at: new Date().toISOString(),
    })
    .eq("id", backup.plan_group_id);

  if (restoreGroupError) {
    handleQueryError(restoreGroupError, {
      context: "[data/planGroups/restore] restorePlanGroupForAdmin - restoreGroup",
    });
    return { success: false, error: "플랜 그룹 복원에 실패했습니다." };
  }

  // 3. student_plan 복원 (백업에서 재생성)
  let restoredPlansCount = 0;

  if (backupData.plans && backupData.plans.length > 0) {
    const plansToInsert = backupData.plans.map((p) => ({
      student_id: studentId,
      tenant_id: backup.tenant_id,
      plan_group_id: backup.plan_group_id,
      plan_date: p.plan_date,
      block_index: p.block_index ?? 0,
      content_type: p.content_type,
      content_id: p.content_id,
      chapter: p.chapter,
      planned_start_page_or_time: p.planned_start_page_or_time,
      planned_end_page_or_time: p.planned_end_page_or_time,
      completed_amount: p.completed_amount,
      is_reschedulable: p.is_reschedulable ?? true,
      start_time: p.start_time,
      end_time: p.end_time,
      is_active: true,
      status: p.status === "completed" ? "completed" : "pending",
    }));

    const { error: insertPlansError, data: insertedPlans } = await supabase
      .from("student_plan")
      .insert(plansToInsert)
      .select("id");

    if (insertPlansError) {
      handleQueryError(insertPlansError, {
        context: "[data/planGroups/restore] restorePlanGroupForAdmin - insertPlans",
      });

      // 롤백: 플랜 그룹 다시 삭제
      await supabase
        .from("plan_groups")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", backup.plan_group_id);

      return { success: false, error: "플랜 복원에 실패했습니다." };
    }

    restoredPlansCount = insertedPlans?.length || 0;
  }

  // 4. 백업 복원 완료 표시
  const { error: markRestoredError } = await supabase
    .from("plan_group_backups")
    .update({
      restored_at: new Date().toISOString(),
      restored_by: restoredBy,
    })
    .eq("id", backupId);

  if (markRestoredError) {
    handleQueryError(markRestoredError, {
      context: "[data/planGroups/restore] restorePlanGroupForAdmin - markRestored",
    });
  }

  return {
    success: true,
    groupId: backup.plan_group_id,
    restoredPlansCount,
  };
}

/**
 * 백업 영구 삭제 (관리자용)
 */
export async function permanentlyDeleteBackup(
  backupId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    console.error("[data/planGroups/restore] Admin client unavailable");
    return { success: false, error: "관리자 클라이언트를 사용할 수 없습니다." };
  }

  const { error } = await supabase
    .from("plan_group_backups")
    .delete()
    .eq("id", backupId)
    .eq("student_id", studentId);

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups/restore] permanentlyDeleteBackup",
    });
    return { success: false, error: "백업 삭제에 실패했습니다." };
  }

  return { success: true };
}

/**
 * 관리자용 삭제된 플랜 그룹 목록 조회
 */
export async function getDeletedPlanGroupsForAdmin(
  options: GetDeletedPlanGroupsOptions
): Promise<DeletedPlanGroupInfo[]> {
  const { studentId, tenantId, offset = 0, limit = 50, includeRestored = false } = options;
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    console.error("[data/planGroups/restore] Admin client unavailable");
    return [];
  }

  let query = supabase
    .from("plan_group_backups")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (!includeRestored) {
    query = query.is("restored_at", null);
  }

  const { data, error } = await query;

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups/restore] getDeletedPlanGroupsForAdmin",
    });
    return [];
  }

  if (!data) {
    return [];
  }

  return data.map((backup) => {
    const backupData = backup.backup_data as PlanGroupBackupData;
    return {
      id: backup.id,
      planGroupId: backup.plan_group_id,
      name: backupData.plan_group?.name || null,
      planPurpose: backupData.plan_group?.plan_purpose || null,
      periodStart: backupData.plan_group?.period_start || "",
      periodEnd: backupData.plan_group?.period_end || "",
      status: backupData.plan_group?.status || "draft",
      deletedAt: backup.created_at || new Date().toISOString(),
      planCount: backupData.plans?.length || 0,
      contentCount: backupData.contents?.length || 0,
      isRestored: backup.restored_at !== null,
    };
  });
}
