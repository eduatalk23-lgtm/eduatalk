"use server";

import { revalidatePath } from "next/cache";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { deletePlanGroup, getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { getSchedulerOptionsWithTimeSettings } from "@/lib/utils/schedulerOptions";
import type { PlanStatus } from "@/lib/types/plan";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 플랜 그룹 삭제
 */
async function _deletePlanGroup(groupId: string): Promise<void> {
  const user = await requireStudentAuth();

  const supabase = await createSupabaseServerClient();

  // 기존 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetails(groupId, user.userId);

  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 캠프 플랜 삭제 불가 체크
  if (group.plan_type === "camp" && group.camp_invitation_id) {
    throw new AppError(
      "캠프 프로그램 플랜은 삭제할 수 없습니다. 캠프 참여 메뉴에서 관리해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 상태별 삭제 권한 체크
  const planStatus: PlanStatus = (group.status || "draft") as PlanStatus;
  if (!PlanStatusManager.canDelete(planStatus)) {
    throw new AppError(
      `${planStatus} 상태에서는 플랜 그룹을 삭제할 수 없습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 백업 정보 수집 (관리자/운영자용)
  try {
    // 1. 플랜 목록 조회
    const plansQuery = supabase
      .from("student_plan")
      .select("*")
      .eq("plan_group_id", groupId)
      .eq("student_id", user.userId);

    // 병렬로 쿼리 실행
    const [{ data: plans }] = await Promise.all([plansQuery]);

    // 2. 플랜 진행률 조회 (플랜이 있는 경우에만)
    const planIds = plans?.map((p) => p.id) || [];
    const progressQuery =
      planIds.length > 0
        ? supabase
            .from("student_content_progress")
            .select("*")
            .in("plan_id", planIds)
        : Promise.resolve({ data: null, error: null });

    const { data: progressData } = await progressQuery;

    // 3. 백업 데이터 구성
    const groupSchedulerOptions = getSchedulerOptionsWithTimeSettings(group);
    const backupData = {
      plan_group: {
        id: group.id,
        name: group.name,
        plan_purpose: group.plan_purpose,
        scheduler_type: group.scheduler_type,
        scheduler_options: groupSchedulerOptions || null,
        period_start: group.period_start,
        period_end: group.period_end,
        target_date: group.target_date,
        block_set_id: group.block_set_id,
        status: group.status,
        created_at: group.created_at,
        updated_at: group.updated_at,
      },
      contents: contents.map((c) => ({
        content_type: c.content_type,
        content_id: c.content_id,
        start_range: c.start_range,
        end_range: c.end_range,
        display_order: c.display_order,
      })),
      exclusions: exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type,
        reason: e.reason,
      })),
      academy_schedules: academySchedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        academy_name: s.academy_name,
        subject: s.subject,
      })),
      plans:
        plans?.map((p) => ({
          plan_date: p.plan_date,
          block_index: p.block_index,
          content_type: p.content_type,
          content_id: p.content_id,
          chapter: p.chapter,
          planned_start_page_or_time: p.planned_start_page_or_time,
          planned_end_page_or_time: p.planned_end_page_or_time,
          completed_amount: p.completed_amount,
          is_reschedulable: p.is_reschedulable,
          start_time: p.start_time,
          end_time: p.end_time,
        })) || [],
      progress: progressData || [],
      deleted_at: new Date().toISOString(),
      deleted_by: user.userId,
    };

    // 4. 백업 데이터 저장
    const { error: backupError } = await supabase
      .from("plan_group_backups")
      .insert({
        plan_group_id: groupId,
        student_id: user.userId,
        tenant_id: group.tenant_id,
        backup_data: backupData,
        deleted_by: user.userId,
        created_at: new Date().toISOString(),
      });

    if (backupError) {
      logActionError(
        { domain: "plan", action: "deletePlanGroup" },
        backupError,
        { groupId, step: "backupStorage" }
      );
      // 백업 실패 시 삭제 중단 (데이터 보호 우선)
      throw new AppError(
        "플랜 그룹 백업 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

  } catch (backupError) {
    logActionError(
      { domain: "plan", action: "deletePlanGroup" },
      backupError,
      { groupId, step: "backupCollection" }
    );
    // 백업 실패해도 삭제는 진행
  }

  // Soft Delete
  // 주의: 블록 세트, 교재, 강의는 삭제되지 않음 (참조만 있음)
  // 학원 일정과 제외일은 plan_group_id로 묶여있지만,
  // 옵션 2(학생별 전역 관리)로 개선 예정이므로 현재는 그대로 유지
  const result = await deletePlanGroup(groupId, user.userId);
  if (!result.success) {
    throw new AppError(
      result.error || "플랜 그룹 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 플랜 그룹 삭제 시 관련 플랜도 함께 삭제 (Soft Delete)
  // student_plan 테이블에 deleted_at 컬럼이 있다면 soft delete, 없다면 hard delete
  const { error: deletePlansError } = await supabase
    .from("student_plan")
    .delete() // hard delete (플랜은 플랜 그룹과 함께 삭제)
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId);

  if (deletePlansError) {
    logActionError(
      { domain: "plan", action: "deletePlanGroup" },
      deletePlansError,
      { groupId, step: "deletePlans" }
    );
    // 플랜 삭제 실패해도 플랜 그룹 삭제는 완료됨 (경고만)
  }

  // ad_hoc_plans 삭제 (DB CASCADE 백업용 - 명시적 삭제)
  // plan_group_id FK에 CASCADE가 설정되어 있지만, 명시적으로도 삭제 시도
  const { error: deleteAdHocError } = await supabase
    .from("ad_hoc_plans")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteAdHocError) {
    logActionError(
      { domain: "plan", action: "deletePlanGroup" },
      deleteAdHocError,
      { groupId, step: "deleteAdHocPlans" }
    );
    // ad_hoc_plans 삭제 실패해도 플랜 그룹 삭제는 완료됨 (경고만)
  }

  revalidatePath("/plan");
  // redirect는 클라이언트에서 처리 (Dialog에서 router.push 호출)
}

export const deletePlanGroupAction = withErrorHandling(_deletePlanGroup);

