"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  updatePlanGroup,
  getPlanGroupById,
  createPlanContents,
  createPlanExclusions,
  createStudentAcademySchedules,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";
import { PlanGroupCreationData } from "@/lib/types/plan";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { normalizePlanPurpose } from "./utils";

/**
 * 플랜 그룹 임시저장 업데이트 (기존 draft 플랜 수정)
 */
async function _updatePlanGroupDraft(
  groupId: string,
  data: Partial<PlanGroupCreationData>
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    console.error("[planGroupActions] getCurrentUser가 null 반환 (updatePlanGroupDraft)");
    throw new AppError(
      "로그인이 필요합니다. 세션이 만료되었거나 사용자 정보를 찾을 수 없습니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }
  if (user.role !== "student") {
    console.error("[planGroupActions] 학생이 아닌 사용자 접근 시도 (updatePlanGroupDraft)", {
      userId: user.userId,
      role: user.role,
    });
    throw new AppError(
      "학생 권한이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      403,
      true
    );
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 기존 그룹 조회
  const group = await getPlanGroupById(groupId, user.userId);
  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 수정 권한 확인 (draft 또는 saved 상태에서 수정 가능)
  if (!PlanStatusManager.canEdit(group.status as any)) {
    throw new AppError(
      `${group.status} 상태에서는 플랜 그룹을 수정할 수 없습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // saved 상태라면 draft로 변경 (수정 후 다시 saved로 변경 가능)
  if (group.status === "saved") {
    const statusUpdateResult = await updatePlanGroup(groupId, user.userId, {
      status: "draft",
    });
    if (!statusUpdateResult.success) {
      throw new AppError(
        statusUpdateResult.error || "플랜 그룹 상태 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  // 플랜 그룹 메타데이터 업데이트
  // time_settings를 scheduler_options에 병합
  let mergedSchedulerOptions = data.scheduler_options || {};
  if (data.time_settings) {
    mergedSchedulerOptions = {
      ...mergedSchedulerOptions,
      ...data.time_settings,
    };
  }

  if (
    data.name !== undefined ||
    data.plan_purpose !== undefined ||
    data.scheduler_type !== undefined ||
    data.scheduler_options !== undefined ||
    data.time_settings !== undefined ||
    data.daily_schedule !== undefined ||
    data.subject_constraints !== undefined ||
    data.additional_period_reallocation !== undefined ||
    data.non_study_time_blocks !== undefined
  ) {
    const updateResult = await updatePlanGroup(groupId, user.userId, {
      name: data.name || null,
      plan_purpose: normalizePlanPurpose(data.plan_purpose),
      scheduler_type: data.scheduler_type || null,
      scheduler_options:
        Object.keys(mergedSchedulerOptions).length > 0
          ? mergedSchedulerOptions
          : null,
      period_start: data.period_start,
      period_end: data.period_end,
      target_date: data.target_date || null,
      block_set_id: data.block_set_id || null,
      daily_schedule: data.daily_schedule || null,
      subject_constraints: data.subject_constraints || null,
      additional_period_reallocation: data.additional_period_reallocation || null,
      non_study_time_blocks: data.non_study_time_blocks || null,
    });

    if (!updateResult.success) {
      throw new AppError(
        updateResult.error || "플랜 그룹 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  // 콘텐츠 업데이트 (기존 삭제 후 재생성)
  if (data.contents !== undefined) {
    const supabase = await createSupabaseServerClient();
    const { error: deleteError } = await supabase
      .from("plan_contents")
      .delete()
      .eq("plan_group_id", groupId);

    if (deleteError) {
      throw new AppError(
        `기존 콘텐츠 삭제 실패: ${deleteError.message}`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    if (data.contents.length > 0) {
      const contentsResult = await createPlanContents(
        groupId,
        tenantContext.tenantId,
        data.contents.map((c) => ({
          content_type: c.content_type,
          content_id: c.content_id,
          start_range: c.start_range,
          end_range: c.end_range,
          display_order: c.display_order ?? 0,
        }))
      );

      if (!contentsResult.success) {
        throw new AppError(
          contentsResult.error || "콘텐츠 업데이트에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }
  }

  // 제외일 업데이트 (플랜 그룹별 관리)
  // 플랜 그룹의 기존 제외일을 삭제하고 새로운 제외일로 교체
  if (data.exclusions !== undefined) {
    const supabase = await createSupabaseServerClient();

    // 플랜 그룹의 기존 제외일 삭제
    const deleteQuery = supabase
      .from("plan_exclusions")
      .delete()
      .eq("plan_group_id", groupId);

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error("[planGroupActions] 기존 제외일 삭제 실패", deleteError);
      // 삭제 실패해도 계속 진행 (경고만)
    }

    // 새로운 제외일 추가
    if (data.exclusions.length > 0) {
      const exclusionsResult = await createPlanExclusions(
        groupId,
        tenantContext.tenantId,
        data.exclusions.map((e) => ({
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type,
          reason: e.reason || null,
        }))
      );

      if (!exclusionsResult.success) {
        throw new AppError(
          exclusionsResult.error || "제외일 업데이트에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }
  }

  // 학원 일정 업데이트 (학생별 전역 관리)
  // 플랜 그룹 수정 시, 기존 학원 일정을 모두 삭제하고 새로운 학원 일정으로 교체
  // (학원 일정은 요일 기반이므로 플랜 그룹별로 구분할 수 없음)
  if (data.academy_schedules !== undefined) {
    const supabase = await createSupabaseServerClient();

    // 기존 학원 일정 모두 삭제
    const deleteQuery = supabase
      .from("academy_schedules")
      .delete()
      .eq("student_id", user.userId);

    if (tenantContext.tenantId) {
      deleteQuery.eq("tenant_id", tenantContext.tenantId);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error("[planGroupActions] 기존 학원 일정 삭제 실패", deleteError);
      // 삭제 실패해도 계속 진행 (경고만)
    }

    // 새로운 학원 일정 추가
    if (data.academy_schedules.length > 0) {
      const schedulesResult = await createStudentAcademySchedules(
        user.userId,
        tenantContext.tenantId,
        data.academy_schedules.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name || null,
          subject: s.subject || null,
        }))
      );

      if (!schedulesResult.success) {
        throw new AppError(
          schedulesResult.error || "학원 일정 업데이트에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }
  }

  revalidatePath("/plan");
  revalidatePath(`/plan/new-group?draft=${groupId}`);
}

export const updatePlanGroupDraftAction = withErrorHandling(
  _updatePlanGroupDraft
);

/**
 * 플랜 그룹 업데이트
 */
async function _updatePlanGroup(
  groupId: string,
  updates: {
    name?: string | null;
    plan_purpose?: string | null;
    scheduler_type?: string | null;
    scheduler_options?: any | null;
    period_start?: string;
    period_end?: string;
    target_date?: string | null;
    block_set_id?: string | null;
  }
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  // 기존 그룹 조회
  const group = await getPlanGroupById(groupId, user.userId);
  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 상태별 수정 권한 체크
  if (!PlanStatusManager.canEdit(group.status as any)) {
    throw new AppError(
      `${group.status} 상태에서는 플랜 그룹을 수정할 수 없습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 기간 검증 (period_start, period_end가 모두 업데이트되는 경우)
  if (updates.period_start && updates.period_end) {
    const periodValidation = PlanValidator.validatePeriod(
      updates.period_start,
      updates.period_end
    );
    if (!periodValidation.valid) {
      throw new AppError(
        periodValidation.errors.join(", ") || "기간을 확인해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // 업데이트
  const result = await updatePlanGroup(groupId, user.userId, updates);
  if (!result.success) {
    throw new AppError(
      result.error || "플랜 그룹 업데이트에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/plan");
  revalidatePath(`/plan/group/${groupId}`);
}

export const updatePlanGroupAction = withErrorHandling(_updatePlanGroup);

