"use server";

import { revalidatePath } from "next/cache";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import {
  updatePlanGroup,
  getPlanGroupById,
  getPlanGroupWithDetailsForAdmin,
  createPlanContents,
  createPlanExclusions,
  createPlanAcademySchedules,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";
import type {
  PlanGroupCreationData,
  PlanGroup,
  SchedulerOptions,
  PlanStatus,
} from "@/lib/types/plan";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { normalizePlanPurpose } from "./utils";
import { validateAllocations } from "@/lib/utils/subjectAllocation";
import { buildAllocationFromSlots } from "@/lib/plan/virtualSchedulePreview";
import { logActionError, logActionWarn, logActionDebug } from "@/lib/logging/actionLogger";

/**
 * 플랜 그룹 임시저장 업데이트 (기존 draft 플랜 수정)
 * 
 * 학생 또는 관리자/컨설턴트 권한을 허용합니다.
 * 관리자 모드일 때는 다른 학생의 플랜 그룹을 수정할 수 있습니다.
 */
async function _updatePlanGroupDraft(
  groupId: string,
  data: Partial<PlanGroupCreationData>
): Promise<void> {
  // 권한 확인: 학생 또는 관리자/컨설턴트
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const isAdmin = currentUser.role === "admin" || currentUser.role === "consultant";
  let studentId: string;
  let userId: string;

  if (isAdmin) {
    // 관리자 모드: 권한 확인 및 플랜 그룹에서 student_id 조회
    await requireAdminOrConsultant();
    userId = currentUser.userId;

    // 플랜 그룹 조회하여 student_id 확인
    const tenantContext = await requireTenantContext();
    const result = await getPlanGroupWithDetailsForAdmin(
      groupId,
      tenantContext.tenantId
    );

    if (!result.group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    studentId = result.group.student_id;
  } else {
    // 학생 모드: 현재 사용자가 학생
    const studentAuth = await requireStudentAuth();
    studentId = studentAuth.userId;
    userId = studentAuth.userId;
  }

  const tenantContext = await requireTenantContext();

  // 기존 그룹 조회 (tenantId 포함하여 조회)
  let group = await getPlanGroupById(groupId, studentId, tenantContext.tenantId);
  
  // 캠프 플랜 그룹인 경우 camp_invitation_id로 재시도
  if (!group && data.camp_invitation_id) {
    const supabase = await createSupabaseServerClient();
    const query = supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
      )
      .eq("id", groupId)
      .eq("camp_invitation_id", data.camp_invitation_id)
      .eq("student_id", studentId)
      .is("deleted_at", null);

    const { data: campGroup, error: campError } = await query.maybeSingle();

    if (!campError && campGroup) {
      group = campGroup as PlanGroup;
    }
  }
  
  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 수정 권한 확인 (draft 또는 saved 상태에서 수정 가능)
  if (!PlanStatusManager.canEdit(group.status as PlanStatus)) {
    throw new AppError(
      `${group.status} 상태에서는 플랜 그룹을 수정할 수 없습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // saved 상태라면 draft로 변경 (수정 후 다시 saved로 변경 가능)
  if (group.status === "saved") {
    const statusUpdateResult = await updatePlanGroup(groupId, studentId, {
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
  let mergedSchedulerOptions: SchedulerOptions = (data.scheduler_options as SchedulerOptions) || {};
  
  // template_block_set_id 보호 (캠프 모드에서 중요)
  const templateBlockSetId = "template_block_set_id" in mergedSchedulerOptions
    ? (mergedSchedulerOptions.template_block_set_id as string | undefined)
    : undefined;
  
  if (data.time_settings) {
    mergedSchedulerOptions = {
      ...mergedSchedulerOptions,
      ...data.time_settings,
    };
    
    // template_block_set_id가 덮어씌워졌는지 확인하고 복원
    if (templateBlockSetId && !("template_block_set_id" in mergedSchedulerOptions)) {
      logActionWarn(
        { domain: "plan", action: "_updatePlanGroupDraft" },
        "template_block_set_id가 time_settings 병합 시 덮어씌워짐, 복원",
        { groupId, template_block_set_id: templateBlockSetId }
      );
      mergedSchedulerOptions = {
        ...mergedSchedulerOptions,
        template_block_set_id: templateBlockSetId,
      } as SchedulerOptions;
    }
  }

  // Dual Write: 슬롯 모드일 때 content_slots에서 subject_allocations 자동 생성
  if (data.use_slot_mode && data.content_slots && data.content_slots.length > 0) {
    const generatedAllocations = buildAllocationFromSlots(data.content_slots);
    if (generatedAllocations.length > 0) {
      // 기존 subject_allocations가 없거나 빈 배열이면 생성된 것으로 교체
      if (!mergedSchedulerOptions.subject_allocations || mergedSchedulerOptions.subject_allocations.length === 0) {
        mergedSchedulerOptions = {
          ...mergedSchedulerOptions,
          subject_allocations: generatedAllocations,
        } as SchedulerOptions;
        logActionDebug(
          { domain: "plan", action: "_updatePlanGroupDraft" },
          "Dual Write: content_slots에서 subject_allocations 자동 생성",
          { groupId, slotCount: data.content_slots.length, allocationCount: generatedAllocations.length }
        );
      }
    }
  }

  // subject_allocations와 content_allocations 검증
  const subjectAllocations = mergedSchedulerOptions.subject_allocations;
  const contentAllocations = mergedSchedulerOptions.content_allocations;
  if (subjectAllocations || contentAllocations) {
    const validation = validateAllocations(contentAllocations, subjectAllocations);
    if (!validation.valid) {
      logActionWarn(
        { domain: "plan", action: "_updatePlanGroupDraft" },
        "전략과목/취약과목 설정 검증 실패",
        { groupId, errors: validation.errors, subjectAllocations, contentAllocations }
      );
      // 검증 실패 시에도 계속 진행하되, 경고만 출력
    }
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
    data.non_study_time_blocks !== undefined ||
    data.use_slot_mode !== undefined ||
    data.content_slots !== undefined
  ) {
    const updateResult = await updatePlanGroup(groupId, studentId, {
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
      // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
      use_slot_mode: data.use_slot_mode ?? false,
      content_slots: data.content_slots || null,
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
          start_detail_id: c.start_detail_id ?? null,
          end_detail_id: c.end_detail_id ?? null,
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
      logActionError(
        { domain: "plan", action: "_updatePlanGroupDraft" },
        deleteError,
        { groupId, operation: "기존 제외일 삭제 실패" }
      );
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
        // 중복 에러인 경우 VALIDATION_ERROR로 처리
        const isDuplicateError = exclusionsResult.error?.includes("중복된 제외일");
        throw new AppError(
          exclusionsResult.error || "제외일 업데이트에 실패했습니다.",
          isDuplicateError ? ErrorCode.VALIDATION_ERROR : ErrorCode.DATABASE_ERROR,
          isDuplicateError ? 400 : 500,
          true
        );
      }
    }
  }

  // 학원 일정 업데이트 (플랜 그룹별 관리)
  // Phase 2: 플랜 그룹별로 독립적으로 관리되며, 플랜 그룹 간 중복 허용
  if (data.academy_schedules !== undefined) {
    const supabase = await createSupabaseServerClient();

    // 기존 학원 일정 삭제 (현재 플랜 그룹만)
    const deleteQuery = supabase
      .from("academy_schedules")
      .delete()
      .eq("plan_group_id", groupId); // 플랜 그룹별 삭제

    if (tenantContext.tenantId) {
      deleteQuery.eq("tenant_id", tenantContext.tenantId);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      logActionError(
        { domain: "plan", action: "_updatePlanGroupDraft" },
        deleteError,
        { groupId, operation: "기존 학원 일정 삭제 실패" }
      );
      // 삭제 실패해도 계속 진행 (경고만)
    }

    // 새로운 학원 일정 추가 (현재 플랜 그룹에만)
    if (data.academy_schedules.length > 0) {
      const schedulesResult = await createPlanAcademySchedules(
        groupId,
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
    scheduler_options?: SchedulerOptions | null;
    period_start?: string;
    period_end?: string;
    target_date?: string | null;
    block_set_id?: string | null;
  }
): Promise<void> {
  const user = await requireStudentAuth();

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
  if (!PlanStatusManager.canEdit(group.status as PlanStatus)) {
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

