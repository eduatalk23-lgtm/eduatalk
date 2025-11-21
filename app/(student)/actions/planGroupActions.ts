"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  createPlanGroup,
  updatePlanGroup,
  deletePlanGroup,
  getPlanGroupById,
  getPlanGroupWithDetails,
  createPlanContents,
  createPlanExclusions,
  createAcademySchedules,
  getAcademySchedules,
  createStudentExclusions,
  createStudentAcademySchedules,
  getStudentExclusions,
  getStudentAcademySchedules,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";
import {
  PlanGroupCreationData,
  AcademySchedule,
  PlanStatus,
} from "@/lib/types/plan";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import {
  assignPlanTimes,
  type PlanTimeSegment,
} from "@/lib/plan/assignPlanTimes";

/**
 * plan_purpose 값을 데이터베이스 스키마에 맞게 변환
 * "모의고사(수능)" -> "수능"
 */
function normalizePlanPurpose(
  purpose: string | null | undefined
): string | null {
  if (!purpose) return null;
  if (purpose === "모의고사(수능)") return "수능";
  return purpose;
}

/**
 * 플랜 그룹 생성 (JSON 데이터)
 */
async function _createPlanGroup(
  data: PlanGroupCreationData
): Promise<{ groupId: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  // 검증
  const validation = PlanValidator.validateCreation(data);
  if (!validation.valid) {
    throw new AppError(
      validation.errors.join(", ") || "입력값을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 플랜 그룹 생성
  // time_settings를 scheduler_options에 병합
  const mergedSchedulerOptions = data.scheduler_options || {};
  if (data.time_settings) {
    Object.assign(mergedSchedulerOptions, data.time_settings);
  }

  const groupResult = await createPlanGroup({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    name: data.name || null,
    plan_purpose: normalizePlanPurpose(data.plan_purpose),
    scheduler_type: data.scheduler_type,
    scheduler_options:
      Object.keys(mergedSchedulerOptions).length > 0
        ? mergedSchedulerOptions
        : null,
    period_start: data.period_start,
    period_end: data.period_end,
    target_date: data.target_date || null,
    block_set_id: data.block_set_id || null,
    status: "draft",
  });

  if (!groupResult.success || !groupResult.groupId) {
    throw new AppError(
      groupResult.error || "플랜 그룹 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const groupId = groupResult.groupId;

  // 마스터 콘텐츠 ID를 그대로 저장 (복사는 플랜 생성 시에만 수행)
  // 이렇게 하면 불러올 때 마스터 콘텐츠로 올바르게 인식할 수 있음
  const processedContents = data.contents.map((c) => ({
    content_type: c.content_type,
    content_id: c.content_id, // 마스터 콘텐츠 ID 그대로 저장
    start_range: c.start_range,
    end_range: c.end_range,
    display_order: c.display_order ?? 0,
  }));

  // 관련 데이터 일괄 생성
  // 제외일은 플랜 그룹별 관리, 학원 일정은 학생별 전역 관리
  const [contentsResult, exclusionsResult, schedulesResult] = await Promise.all(
    [
      createPlanContents(groupId, tenantContext.tenantId, processedContents),
      createPlanExclusions(
        groupId,
        tenantContext.tenantId,
        data.exclusions.map((e) => ({
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type,
          reason: e.reason || null,
        }))
      ),
      createStudentAcademySchedules(
        user.userId,
        tenantContext.tenantId,
        data.academy_schedules.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name || null,
          subject: s.subject || null,
        }))
      ),
    ]
  );

  // 하나라도 실패하면 롤백 (간단한 구현)
  if (!contentsResult.success) {
    await deletePlanGroup(groupId, user.userId);
    throw new AppError(
      contentsResult.error || "플랜 콘텐츠 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  if (!exclusionsResult.success) {
    await deletePlanGroup(groupId, user.userId);
    throw new AppError(
      exclusionsResult.error || "플랜 제외일 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  if (!schedulesResult.success) {
    await deletePlanGroup(groupId, user.userId);
    throw new AppError(
      schedulesResult.error || "학원 일정 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/plan");
  return { groupId };
}

export const createPlanGroupAction = withErrorHandling(_createPlanGroup);

/**
 * 플랜 그룹 임시저장 (draft 상태로 저장, 검증 완화)
 */
async function _savePlanGroupDraft(
  data: PlanGroupCreationData
): Promise<{ groupId: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  // 최소 검증만 수행 (이름만 필수)
  if (!data.name || data.name.trim() === "") {
    throw new AppError(
      "플랜 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 플랜 그룹 생성 (draft 상태)
  // time_settings를 scheduler_options에 병합
  const mergedSchedulerOptions = data.scheduler_options || {};
  if (data.time_settings) {
    Object.assign(mergedSchedulerOptions, data.time_settings);
  }

  const groupResult = await createPlanGroup({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    name: data.name || null,
    plan_purpose: normalizePlanPurpose(data.plan_purpose),
    scheduler_type: data.scheduler_type || null,
    scheduler_options:
      Object.keys(mergedSchedulerOptions).length > 0
        ? mergedSchedulerOptions
        : null,
    period_start: data.period_start || new Date().toISOString().slice(0, 10),
    period_end:
      data.period_end ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    target_date: data.target_date || null,
    block_set_id: data.block_set_id || null,
    status: "draft",
  });

  if (!groupResult.success || !groupResult.groupId) {
    throw new AppError(
      groupResult.error || "플랜 그룹 임시저장에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const groupId = groupResult.groupId;

  // 관련 데이터 생성 (있을 경우만)
  if (data.contents && data.contents.length > 0) {
    await createPlanContents(
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
  }

  // 제외일은 플랜 그룹별 관리
  if (data.exclusions && data.exclusions.length > 0) {
    await createPlanExclusions(
      groupId,
      tenantContext.tenantId,
      data.exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type,
        reason: e.reason || null,
      }))
    );
  }

  if (data.academy_schedules && data.academy_schedules.length > 0) {
    await createStudentAcademySchedules(
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
  }

  revalidatePath("/plan");
  return { groupId };
}

export const savePlanGroupDraftAction = withErrorHandling(_savePlanGroupDraft);

/**
 * 플랜 그룹 임시저장 업데이트 (기존 draft 플랜 수정)
 */
async function _updatePlanGroupDraft(
  groupId: string,
  data: Partial<PlanGroupCreationData>
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
    data.time_settings !== undefined
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
 * 플랜 그룹 상태 업데이트
 */
async function _updatePlanGroupStatus(
  groupId: string,
  status: string
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

  // 상태 전이 검증
  const statusValidation = PlanValidator.validateStatusTransition(
    group.status as any,
    status as any
  );
  if (!statusValidation.valid) {
    throw new AppError(
      statusValidation.errors.join(", ") || "상태 전이가 불가능합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 활성화 시 다른 활성 플랜 그룹 비활성화 (1개만 활성 가능)
  if (status === "active") {
    // 현재 활성 상태인 다른 플랜 그룹 조회
    const { data: activeGroups, error: activeGroupsError } = await supabase
      .from("plan_groups")
      .select("id")
      .eq("student_id", user.userId)
      .eq("status", "active")
      .neq("id", groupId)
      .is("deleted_at", null);

    if (activeGroupsError) {
      console.error(
        "[planGroupActions] 활성 플랜 그룹 조회 실패",
        activeGroupsError
      );
    } else if (activeGroups && activeGroups.length > 0) {
      // 다른 활성 플랜 그룹들을 "saved" 상태로 변경
      const activeGroupIds = activeGroups.map((g) => g.id);
      const { error: deactivateError } = await supabase
        .from("plan_groups")
        .update({ status: "saved" })
        .in("id", activeGroupIds);

      if (deactivateError) {
        console.error(
          "[planGroupActions] 다른 활성 플랜 그룹 비활성화 실패",
          deactivateError
        );
        // 비활성화 실패해도 계속 진행 (경고만)
      } else {
        console.log(
          `[planGroupActions] ${activeGroupIds.length}개의 활성 플랜 그룹을 비활성화했습니다.`
        );
      }
    }
  }

  // 상태 업데이트
  const result = await updatePlanGroup(groupId, user.userId, { status });
  if (!result.success) {
    throw new AppError(
      result.error || "플랜 그룹 상태 업데이트에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/plan");
  revalidatePath(`/plan/group/${groupId}`);
}

export const updatePlanGroupStatus = withErrorHandling(_updatePlanGroupStatus);

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

/**
 * 플랜 그룹 복사
 */
async function _copyPlanGroup(groupId: string): Promise<{ groupId: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  const supabase = await createSupabaseServerClient();

  // 원본 플랜 그룹 조회
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

  // 새 플랜 그룹 생성 (이름에 "복사본" 추가)
  const newGroupResult = await createPlanGroup({
    tenant_id: tenantContext.tenantId,
    student_id: user.userId,
    name: `${group.name || "플랜 그룹"} (복사본)`,
    plan_purpose: group.plan_purpose,
    scheduler_type: group.scheduler_type,
    scheduler_options: (group as any).scheduler_options || null,
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date,
    block_set_id: group.block_set_id,
    status: "draft",
  });

  if (!newGroupResult.success || !newGroupResult.groupId) {
    throw new AppError(
      newGroupResult.error || "플랜 그룹 복사에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const newGroupId = newGroupResult.groupId;

  // 콘텐츠 복사
  if (contents && contents.length > 0) {
    await createPlanContents(
      newGroupId,
      tenantContext.tenantId,
      contents.map((c) => ({
        content_type: c.content_type,
        content_id: c.content_id,
        start_range: c.start_range,
        end_range: c.end_range,
        display_order: c.display_order,
      }))
    );
  }

  // 제외일 복사 (학생별 전역 관리)
  // 원본 플랜 그룹의 기간에 해당하는 제외일만 복사
  if (exclusions && exclusions.length > 0) {
    const periodStart = new Date(group.period_start);
    const periodEnd = new Date(group.period_end);

    const filteredExclusions = exclusions.filter((e) => {
      const exclusionDate = new Date(e.exclusion_date);
      return exclusionDate >= periodStart && exclusionDate <= periodEnd;
    });

    if (filteredExclusions.length > 0) {
      await createPlanExclusions(
        newGroupId,
        tenantContext.tenantId,
        filteredExclusions.map((e) => ({
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type,
          reason: e.reason,
        }))
      );
    }
  }

  // 학원 일정 복사는 하지 않음 (학생별 전역 관리이므로 복사할 필요 없음)
  // 대신 편집 페이지에서 시간 관리 데이터를 반영할 수 있는 버튼 제공

  revalidatePath("/plan");
  revalidatePath(`/plan/group/${newGroupId}`);

  return { groupId: newGroupId };
}

export const copyPlanGroupAction = withErrorHandling(_copyPlanGroup);

/**
 * 시간 관리 데이터 반영 (제외일)
 */
async function _syncTimeManagementExclusions(
  groupId: string,
  periodStart: string,
  periodEnd: string
): Promise<{
  count: number;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
  }>;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  const supabase = await createSupabaseServerClient();

  // 플랜 그룹 조회
  const group = await getPlanGroupById(
    groupId,
    user.userId,
    tenantContext.tenantId
  );
  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생의 모든 제외일 조회 (시간 관리에 등록된 모든 제외일)
  const allExclusions = await getStudentExclusions(
    user.userId,
    tenantContext.tenantId
  );

  // 기간에 해당하는 제외일 필터링
  const periodStartDate = new Date(periodStart);
  periodStartDate.setHours(0, 0, 0, 0);
  const periodEndDate = new Date(periodEnd);
  periodEndDate.setHours(23, 59, 59, 999);

  const filteredExclusions = allExclusions.filter((e) => {
    const exclusionDate = new Date(e.exclusion_date);
    exclusionDate.setHours(0, 0, 0, 0);
    return exclusionDate >= periodStartDate && exclusionDate <= periodEndDate;
  });

  // 최신 제외일 데이터 반환 (클라이언트에서 상태 업데이트용)
  revalidatePath(`/plan/group/${groupId}/edit`);
  return {
    count: filteredExclusions.length,
    exclusions: filteredExclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as
        | "휴가"
        | "개인사정"
        | "휴일지정"
        | "기타",
      reason: e.reason || undefined,
    })),
  };
}

export const syncTimeManagementExclusionsAction = withErrorHandling(
  _syncTimeManagementExclusions
);

/**
 * 시간 관리 데이터 반영 (학원일정)
 */
async function _syncTimeManagementAcademySchedules(groupId: string): Promise<{
  count: number;
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
  }>;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  const supabase = await createSupabaseServerClient();

  // 플랜 그룹 조회
  const group = await getPlanGroupById(
    groupId,
    user.userId,
    tenantContext.tenantId
  );
  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생의 모든 학원일정 조회 (시간 관리에 등록된 모든 학원일정)
  const allAcademySchedules = await getStudentAcademySchedules(
    user.userId,
    tenantContext.tenantId
  );

  // 최신 학원일정 데이터 반환 (클라이언트에서 상태 업데이트용)
  revalidatePath(`/plan/group/${groupId}/edit`);
  return {
    count: allAcademySchedules.length,
    academySchedules: allAcademySchedules.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      academy_name: s.academy_name || undefined,
      subject: s.subject || undefined,
    })),
  };
}

export const syncTimeManagementAcademySchedulesAction = withErrorHandling(
  _syncTimeManagementAcademySchedules
);

/**
 * 플랜 그룹 삭제
 */
async function _deletePlanGroup(groupId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

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

  // 상태별 삭제 권한 체크
  if (!PlanStatusManager.canDelete(group.status as any)) {
    throw new AppError(
      `${group.status} 상태에서는 플랜 그룹을 삭제할 수 없습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 백업 정보 수집 (관리자/운영자용)
  try {
    // 1. 플랜 목록 조회
    const { data: plans } = await supabase
      .from("student_plan")
      .select("*")
      .eq("plan_group_id", groupId)
      .eq("student_id", user.userId);

    // 2. 플랜 진행률 조회
    const planIds = plans?.map((p) => p.id) || [];
    const { data: progressData } =
      planIds.length > 0
        ? await supabase
            .from("student_content_progress")
            .select("*")
            .in("plan_id", planIds)
        : { data: null };

    // 3. 백업 데이터 구성
    const backupData = {
      plan_group: {
        id: group.id,
        name: group.name,
        plan_purpose: group.plan_purpose,
        scheduler_type: group.scheduler_type,
        scheduler_options: (group as any).scheduler_options || null,
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

    // 4. 백업 데이터 저장 (향후 백업 테이블에 저장하거나 로그로 기록)
    // TODO: 백업 테이블 생성 시 아래 주석 해제
    /*
    const { error: backupError } = await supabase
      .from("plan_group_backups")
      .insert({
        plan_group_id: groupId,
        student_id: user.userId,
        tenant_id: group.tenant_id,
        backup_data: backupData,
        created_at: new Date().toISOString(),
      });

    if (backupError) {
      console.error("[planGroupActions] 백업 데이터 저장 실패", backupError);
      // 백업 실패해도 삭제는 진행
    }
    */

    // 임시: 백업 데이터를 콘솔에 기록 (운영 환경에서는 로그 시스템 사용)
    console.log(
      "[planGroupActions] 플랜 그룹 삭제 백업 데이터:",
      JSON.stringify(backupData, null, 2)
    );
  } catch (backupError) {
    console.error("[planGroupActions] 백업 정보 수집 실패", backupError);
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
    console.error("[planGroupActions] 플랜 삭제 실패", deletePlansError);
    // 플랜 삭제 실패해도 플랜 그룹 삭제는 완료됨 (경고만)
  } else {
    console.log(
      `[planGroupActions] 플랜 그룹 ${groupId}의 관련 플랜이 삭제되었습니다.`
    );
  }

  revalidatePath("/plan");
  // redirect는 클라이언트에서 처리 (Dialog에서 router.push 호출)
}

export const deletePlanGroupAction = withErrorHandling(_deletePlanGroup);

/**
 * 플랜 그룹에서 개별 플랜 생성
 */
async function _generatePlansFromGroup(
  groupId: string
): Promise<{ count: number }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  const supabase = await createSupabaseServerClient();

  // 1. 플랜 그룹 및 관련 데이터 조회
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

  // 2. 상태 확인
  if (group.status !== "saved" && group.status !== "active") {
    throw new AppError(
      "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 생성할 수 있습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 3. Step 2.5에서 계산된 스케줄 결과 사용 (블록 세트 대신)
  // calculateAvailableDates를 호출하여 각 날짜별 available_time_ranges를 블록으로 사용
  const { calculateAvailableDates } = await import(
    "@/lib/scheduler/calculateAvailableDates"
  );

  // 블록 세트에서 기본 블록 정보 가져오기 (calculateAvailableDates에 전달하기 위해)
  let baseBlocks: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }> = [];

  if (group.block_set_id) {
    const { data: blockSet } = await supabase
      .from("student_block_sets")
      .select("id, name, student_id")
      .eq("id", group.block_set_id)
      .maybeSingle();

    if (blockSet) {
      const blockSetOwnerId = blockSet.student_id;
      const { data: blockRows } = await supabase
        .from("student_block_schedule")
        .select("day_of_week, start_time, end_time")
        .eq("block_set_id", group.block_set_id)
        .eq("student_id", blockSetOwnerId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blockRows && blockRows.length > 0) {
        baseBlocks = blockRows.map((b) => ({
          day_of_week: b.day_of_week || 0,
          start_time: b.start_time || "00:00",
          end_time: b.end_time || "00:00",
        }));
      }
    }
  }

  if (baseBlocks.length === 0) {
    // 기본 블록 세트 사용
    const { data: student } = await supabase
      .from("students")
      .select("active_block_set_id")
      .eq("id", user.userId)
      .maybeSingle();

    if (student?.active_block_set_id) {
      const { data: blockRows } = await supabase
        .from("student_block_schedule")
        .select("day_of_week, start_time, end_time")
        .eq("block_set_id", student.active_block_set_id)
        .eq("student_id", user.userId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blockRows) {
        baseBlocks = blockRows.map((b) => ({
          day_of_week: b.day_of_week || 0,
          start_time: b.start_time || "00:00",
          end_time: b.end_time || "00:00",
        }));
      }
    }
  }

  if (baseBlocks.length === 0) {
    throw new AppError(
      "블록 세트가 설정되지 않았거나, 활성 블록 세트에 등록된 블록이 없습니다. 블록 세트를 설정하고 블록을 추가해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // schedulerOptions 변수 선언 (나중에 사용하기 위해)
  const schedulerOptions = (group.scheduler_options as any) || {};

  // calculateAvailableDates 호출하여 Step 2.5 스케줄 결과 가져오기
  const scheduleResult = calculateAvailableDates(
    group.period_start,
    group.period_end,
    baseBlocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
    exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as
        | "휴가"
        | "개인사정"
        | "휴일지정"
        | "기타",
      reason: e.reason || undefined,
    })),
    academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: group.scheduler_type as "1730_timetable" | "자동스케줄러",
      scheduler_options: schedulerOptions || null,
      use_self_study_with_blocks: true, // 블록이 있어도 자율학습 시간 포함
      enable_self_study_for_holidays:
        schedulerOptions.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days:
        schedulerOptions.enable_self_study_for_study_days === true,
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      camp_self_study_hours: schedulerOptions.camp_self_study_hours,
      designated_holiday_hours: schedulerOptions.designated_holiday_hours,
    }
  );

  // Step 2.5 스케줄 결과에서 날짜별 사용 가능 시간 범위 및 타임라인 추출
  const dateAvailableTimeRanges = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  const dateTimeSlots = new Map<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
  >();

  // 날짜별 메타데이터 매핑 (day_type, week_number)
  const dateMetadataMap = new Map<
    string,
    {
      day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
      week_number: number | null;
    }
  >();

  // 주차별 날짜 목록 (일차 계산용)
  const weekDatesMap = new Map<number, string[]>();

  scheduleResult.daily_schedule.forEach((daily) => {
    if (daily.day_type === "학습일" && daily.available_time_ranges.length > 0) {
      dateAvailableTimeRanges.set(
        daily.date,
        daily.available_time_ranges.map((range) => ({
          start: range.start,
          end: range.end,
        }))
      );
    }

    // time_slots 정보도 저장 (Step 7에서 타임라인 표시용)
    if (daily.time_slots && daily.time_slots.length > 0) {
      dateTimeSlots.set(
        daily.date,
        daily.time_slots.map((slot) => ({
          type: slot.type,
          start: slot.start,
          end: slot.end,
          label: slot.label,
        }))
      );
    }

    // 날짜별 메타데이터 저장
    dateMetadataMap.set(daily.date, {
      day_type: daily.day_type || null,
      week_number: daily.week_number || null,
    });

    // 주차별 날짜 목록 구성 (일차 계산용)
    if (daily.week_number) {
      if (!weekDatesMap.has(daily.week_number)) {
        weekDatesMap.set(daily.week_number, []);
      }
      // 제외일이 아닌 날짜만 주차에 포함 (1730 Timetable의 경우)
      if (
        daily.day_type &&
        daily.day_type !== "휴가" &&
        daily.day_type !== "개인일정" &&
        daily.day_type !== "지정휴일"
      ) {
        weekDatesMap.get(daily.week_number)!.push(daily.date);
      }
    }
  });

  // 주차별 날짜 목록 정렬 (날짜 순)
  weekDatesMap.forEach((dates, week) => {
    dates.sort();
  });

  if (dateAvailableTimeRanges.size === 0) {
    throw new AppError(
      "학습 가능한 날짜가 없습니다. 기간, 제외일, 학원일정을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 기존 방식 호환성을 위한 빈 블록 배열 (실제로는 사용하지 않음, dateAvailableTimeRanges 사용)
  const blockInfos: Array<{
    id: string;
    day_of_week: number;
    block_index: number;
    start_time: string;
    end_time: string;
    duration_minutes: number;
  }> = [];

  // 5. 마스터 콘텐츠를 학생 콘텐츠로 복사 (플랜 생성 시점에만 수행)
  // content_id 매핑: 마스터 콘텐츠 ID -> 학생 콘텐츠 ID
  const contentIdMap = new Map<string, string>();

  for (const content of contents) {
    let studentContentId = content.content_id;

    // 먼저 이미 학생 콘텐츠로 등록되어 있는지 확인
    if (content.content_type === "book") {
      // 이미 학생 교재로 등록되어 있는지 확인 (master_content_id로)
      const { data: existingStudentBook } = await supabase
        .from("books")
        .select("id")
        .eq("student_id", user.userId)
        .eq("master_content_id", content.content_id)
        .maybeSingle();

      if (existingStudentBook) {
        // 이미 복사된 교재가 있으면 기존 ID 사용
        studentContentId = existingStudentBook.id;
        contentIdMap.set(content.content_id, studentContentId);
        continue;
      }

      // 마스터 콘텐츠인지 확인
      const { data: masterBook } = await supabase
        .from("master_books")
        .select("id")
        .eq("id", content.content_id)
        .maybeSingle();

      if (masterBook) {
        // 마스터 교재를 학생 교재로 복사
        try {
          const { bookId } = await copyMasterBookToStudent(
            content.content_id,
            user.userId,
            tenantContext.tenantId
          );
          studentContentId = bookId;
          contentIdMap.set(content.content_id, studentContentId);
        } catch (error) {
          console.error(
            `[planGroupActions] 마스터 교재 복사 실패: ${content.content_id}`,
            error
          );
          // 복사 실패 시 원본 ID 사용
        }
      }
    } else if (content.content_type === "lecture") {
      // 이미 학생 강의로 등록되어 있는지 확인 (master_content_id로)
      const { data: existingStudentLecture } = await supabase
        .from("lectures")
        .select("id")
        .eq("student_id", user.userId)
        .eq("master_content_id", content.content_id)
        .maybeSingle();

      if (existingStudentLecture) {
        // 이미 복사된 강의가 있으면 기존 ID 사용
        studentContentId = existingStudentLecture.id;
        contentIdMap.set(content.content_id, studentContentId);
        continue;
      }

      // 마스터 콘텐츠인지 확인
      const { data: masterLecture } = await supabase
        .from("master_lectures")
        .select("id")
        .eq("id", content.content_id)
        .maybeSingle();

      if (masterLecture) {
        // 마스터 강의를 학생 강의로 복사
        try {
          const { lectureId } = await copyMasterLectureToStudent(
            content.content_id,
            user.userId,
            tenantContext.tenantId
          );
          studentContentId = lectureId;
          contentIdMap.set(content.content_id, studentContentId);
        } catch (error) {
          console.error(
            `[planGroupActions] 마스터 강의 복사 실패: ${content.content_id}`,
            error
          );
          // 복사 실패 시 원본 ID 사용
        }
      }
    }
  }

  // 6. 콘텐츠 메타데이터 정보 조회 (전략과목/취약과목 로직용 + denormalization용)
  const contentMetadataMap = new Map<
    string,
    {
      title?: string | null;
      subject?: string | null;
      subject_category?: string | null;
      category?: string | null;
    }
  >();

  for (const content of contents) {
    const finalContentId =
      contentIdMap.get(content.content_id) || content.content_id;

    if (content.content_type === "book") {
      const { data: book } = await supabase
        .from("books")
        .select("title, subject, subject_category, content_category")
        .eq("id", finalContentId)
        .eq("student_id", user.userId)
        .maybeSingle();

      if (book) {
        contentMetadataMap.set(content.content_id, {
          title: book.title || null,
          subject: book.subject || null,
          subject_category: book.subject_category || null,
          category: book.content_category || null,
        });
      } else {
        // 마스터 교재 조회
        const { data: masterBook } = await supabase
          .from("master_books")
          .select("title, subject, subject_category, content_category")
          .eq("id", content.content_id)
          .maybeSingle();

        if (masterBook) {
          contentMetadataMap.set(content.content_id, {
            title: masterBook.title || null,
            subject: masterBook.subject || null,
            subject_category: masterBook.subject_category || null,
            category: masterBook.content_category || null,
          });
        }
      }
    } else if (content.content_type === "lecture") {
      const { data: lecture } = await supabase
        .from("lectures")
        .select("title, subject, subject_category, content_category")
        .eq("id", finalContentId)
        .eq("student_id", user.userId)
        .maybeSingle();

      if (lecture) {
        contentMetadataMap.set(content.content_id, {
          title: lecture.title || null,
          subject: lecture.subject || null,
          subject_category: lecture.subject_category || null,
          category: lecture.content_category || null,
        });
      } else {
        // 마스터 강의 조회
        const { data: masterLecture } = await supabase
          .from("master_lectures")
          .select("title, subject, subject_category, content_category")
          .eq("id", content.content_id)
          .maybeSingle();

        if (masterLecture) {
          contentMetadataMap.set(content.content_id, {
            title: masterLecture.title || null,
            subject: masterLecture.subject || null,
            subject_category: masterLecture.subject_category || null,
            category: masterLecture.content_category || null,
          });
        }
      }
    } else if (content.content_type === "custom") {
      // 커스텀 콘텐츠 조회
      const { data: customContent } = await supabase
        .from("student_custom_contents")
        .select("title, subject, subject_category, content_category")
        .eq("id", finalContentId)
        .eq("student_id", user.userId)
        .maybeSingle();

      if (customContent) {
        contentMetadataMap.set(content.content_id, {
          title: customContent.title || null,
          subject: customContent.subject || null,
          subject_category: customContent.subject_category || null,
          category: customContent.content_category || null,
        });
      }
    }
  }

  // 하위 호환성을 위한 contentSubjects Map (기존 코드에서 사용 중)
  const contentSubjects = new Map<
    string,
    { subject?: string | null; subject_category?: string | null }
  >();
  contentMetadataMap.forEach((metadata, contentId) => {
    contentSubjects.set(contentId, {
      subject: metadata.subject,
      subject_category: metadata.subject_category,
    });
  });

  // 7. Risk Index 조회 (취약과목 로직용)
  let riskIndexMap: Map<string, { riskScore: number }> | undefined;
  // schedulerOptions는 위에서 이미 선언되었으므로 재사용
  const weakSubjectFocus =
    schedulerOptions?.weak_subject_focus === "high" ||
    schedulerOptions?.weak_subject_focus === true;

  if (weakSubjectFocus) {
    try {
      const { getRiskIndexBySubject } = await import(
        "@/lib/scheduler/scoreLoader"
      );
      const riskMap = await getRiskIndexBySubject(user.userId);

      // Map<string, RiskIndex> -> Map<string, { riskScore: number }> 변환
      riskIndexMap = new Map();
      riskMap.forEach((riskIndex, subject) => {
        riskIndexMap!.set(subject.toLowerCase().trim(), {
          riskScore: riskIndex.riskScore || 0,
        });
      });
    } catch (error) {
      console.error("[planGroupActions] Risk Index 조회 실패", error);
      // Risk Index 조회 실패해도 계속 진행
    }
  }

  // 8. 콘텐츠 소요시간 정보 조회
  const contentDurationMap = new Map<
    string,
    {
      content_type: "book" | "lecture" | "custom";
      content_id: string;
      total_pages?: number | null;
      duration?: number | null;
      total_page_or_time?: number | null;
    }
  >();

  // 더미 UUID에 대한 기본값 추가 (비학습 항목 및 자율학습용)
  const DUMMY_NON_LEARNING_CONTENT_ID = "00000000-0000-0000-0000-000000000000";
  const DUMMY_SELF_STUDY_CONTENT_ID = "00000000-0000-0000-0000-000000000001";

  contentDurationMap.set(DUMMY_NON_LEARNING_CONTENT_ID, {
    content_type: "custom",
    content_id: DUMMY_NON_LEARNING_CONTENT_ID,
    total_page_or_time: 0,
  });

  contentDurationMap.set(DUMMY_SELF_STUDY_CONTENT_ID, {
    content_type: "custom",
    content_id: DUMMY_SELF_STUDY_CONTENT_ID,
    total_page_or_time: 0,
  });

  for (const content of contents) {
    const finalContentId =
      contentIdMap.get(content.content_id) || content.content_id;

    if (content.content_type === "book") {
      // 학생 교재 조회
      const { data: studentBook } = await supabase
        .from("books")
        .select("id, total_pages, master_content_id")
        .eq("id", finalContentId)
        .eq("student_id", user.userId)
        .maybeSingle();

      if (studentBook?.total_pages) {
        contentDurationMap.set(content.content_id, {
          content_type: "book",
          content_id: content.content_id,
          total_pages: studentBook.total_pages,
        });
      } else if (studentBook?.master_content_id) {
        // 마스터 교재 조회
        const { data: masterBook } = await supabase
          .from("master_books")
          .select("id, total_pages")
          .eq("id", studentBook.master_content_id)
          .maybeSingle();

        if (masterBook?.total_pages) {
          contentDurationMap.set(content.content_id, {
            content_type: "book",
            content_id: content.content_id,
            total_pages: masterBook.total_pages,
          });
        }
      }
    } else if (content.content_type === "lecture") {
      // 학생 강의 조회
      const { data: studentLecture } = await supabase
        .from("lectures")
        .select("id, duration, master_content_id")
        .eq("id", finalContentId)
        .eq("student_id", user.userId)
        .maybeSingle();

      if (studentLecture?.duration) {
        contentDurationMap.set(content.content_id, {
          content_type: "lecture",
          content_id: content.content_id,
          duration: studentLecture.duration,
        });
      } else if (studentLecture?.master_content_id) {
        // 마스터 강의 조회
        const { data: masterLecture } = await supabase
          .from("master_lectures")
          .select("id, total_duration")
          .eq("id", studentLecture.master_content_id)
          .maybeSingle();

        if (masterLecture?.total_duration) {
          contentDurationMap.set(content.content_id, {
            content_type: "lecture",
            content_id: content.content_id,
            duration: masterLecture.total_duration,
          });
        }
      }
    } else if (content.content_type === "custom") {
      // 더미 UUID는 이미 처리했으므로 스킵
      if (
        finalContentId === DUMMY_NON_LEARNING_CONTENT_ID ||
        finalContentId === DUMMY_SELF_STUDY_CONTENT_ID ||
        content.content_id === DUMMY_NON_LEARNING_CONTENT_ID ||
        content.content_id === DUMMY_SELF_STUDY_CONTENT_ID
      ) {
        continue;
      }

      // 커스텀 콘텐츠 조회
      const { data: customContent } = await supabase
        .from("student_custom_contents")
        .select("id, total_page_or_time")
        .eq("id", finalContentId)
        .eq("student_id", user.userId)
        .maybeSingle();

      if (customContent?.total_page_or_time) {
        contentDurationMap.set(content.content_id, {
          content_type: "custom",
          content_id: content.content_id,
          total_page_or_time: customContent.total_page_or_time,
        });
      } else if (!customContent) {
        // 더미 UUID인 경우는 에러 발생하지 않음 (더미 content 생성 실패해도 계속 진행)
        // 일반 custom content가 존재하지 않으면 에러 발생
        if (
          finalContentId !== DUMMY_NON_LEARNING_CONTENT_ID &&
          finalContentId !== DUMMY_SELF_STUDY_CONTENT_ID &&
          content.content_id !== DUMMY_NON_LEARNING_CONTENT_ID &&
          content.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
        ) {
          throw new AppError(
            `Referenced custom content (${finalContentId}) does not exist`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
        // 더미 UUID인 경우는 contentDurationMap에 이미 기본값이 있으므로 스킵
      }
    }
  }

  // 9. 스케줄러로 플랜 생성 (Step 2.5 스케줄 결과 및 콘텐츠 소요시간 정보 전달)
  const { generatePlansFromGroup } = await import("@/lib/plan/scheduler");
  const scheduledPlans = generatePlansFromGroup(
    group,
    contents,
    exclusions,
    academySchedules,
    blockInfos,
    contentSubjects,
    riskIndexMap,
    dateAvailableTimeRanges,
    dateTimeSlots,
    contentDurationMap
  );

  if (scheduledPlans.length === 0) {
    throw new AppError(
      "생성된 플랜이 없습니다. 기간, 제외일, 블록 설정을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 7. 기존 플랜 삭제 (해당 플랜 그룹의 기존 플랜)
  // 삭제 전에 해당 플랜 그룹의 플랜이 있는지 확인
  const { data: existingPlans, error: checkError } = await supabase
    .from("student_plan")
    .select("id, plan_date, block_index")
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId);

  if (checkError) {
    console.error("[planGroupActions] 기존 플랜 조회 실패", checkError);
  }

  // 기존 플랜 삭제
  const { error: deleteError } = await supabase
    .from("student_plan")
    .delete()
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId);

  if (deleteError) {
    throw new AppError(
      `기존 플랜 삭제 중 오류가 발생했습니다: ${deleteError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: deleteError }
    );
  }

  // 삭제 확인 (디버깅용)
  if (existingPlans && existingPlans.length > 0) {
    console.log(
      `[planGroupActions] ${existingPlans.length}개의 기존 플랜 삭제 완료`
    );

    // 삭제 확인: 실제로 삭제되었는지 재확인
    const { data: verifyPlans, error: verifyError } = await supabase
      .from("student_plan")
      .select("id")
      .eq("plan_group_id", groupId)
      .eq("student_id", user.userId)
      .limit(1);

    if (verifyError) {
      console.error("[planGroupActions] 삭제 확인 실패", verifyError);
    } else if (verifyPlans && verifyPlans.length > 0) {
      console.warn(
        `[planGroupActions] 경고: ${verifyPlans.length}개의 플랜이 아직 남아있습니다. 재삭제 시도...`
      );
      // 재삭제 시도
      await supabase
        .from("student_plan")
        .delete()
        .eq("plan_group_id", groupId)
        .eq("student_id", user.userId);
    }
  }

  // 8. 콘텐츠 메타데이터 조회 함수 (단원명, 강의명 등)
  const getContentChapter = async (
    contentType: string,
    contentId: string,
    pageOrTime: number
  ): Promise<string | null> => {
    // 더미 UUID는 chapter 조회 스킵
    if (
      contentId === DUMMY_NON_LEARNING_CONTENT_ID ||
      contentId === DUMMY_SELF_STUDY_CONTENT_ID
    ) {
      return null;
    }

    try {
      if (contentType === "book") {
        // 학생 교재 상세 정보 조회
        const { data: studentBookDetail } = await supabase
          .from("student_book_details")
          .select("major_unit, minor_unit")
          .eq("book_id", contentId)
          .lte("page_number", pageOrTime)
          .order("page_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (studentBookDetail?.major_unit || studentBookDetail?.minor_unit) {
          if (studentBookDetail.major_unit && studentBookDetail.minor_unit) {
            return `${studentBookDetail.major_unit} - ${studentBookDetail.minor_unit}`;
          }
          return (
            studentBookDetail.major_unit || studentBookDetail.minor_unit || null
          );
        }

        // 마스터 교재 상세 정보 조회 (학생 교재에 없을 경우)
        const { data: book } = await supabase
          .from("books")
          .select("master_content_id")
          .eq("id", contentId)
          .eq("student_id", user.userId)
          .maybeSingle();

        if (book?.master_content_id) {
          const { data: masterBookDetail } = await supabase
            .from("book_details")
            .select("major_unit, minor_unit")
            .eq("book_id", book.master_content_id)
            .lte("page_number", pageOrTime)
            .order("page_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (masterBookDetail?.major_unit || masterBookDetail?.minor_unit) {
            if (masterBookDetail.major_unit && masterBookDetail.minor_unit) {
              return `${masterBookDetail.major_unit} - ${masterBookDetail.minor_unit}`;
            }
            return (
              masterBookDetail.major_unit || masterBookDetail.minor_unit || null
            );
          }
        }
      } else if (contentType === "lecture") {
        // 강의의 경우 회차 정보 표시
        return `${pageOrTime}강`;
      }
    } catch (error) {
      console.error(
        `[planGroupActions] 콘텐츠 메타데이터 조회 실패: ${contentId}`,
        error
      );
    }
    return null;
  };

  // 9. 기존 플랜 조회 (다른 플랜 그룹 포함) - block_index 조정을 위해
  const planDates = Array.from(new Set(scheduledPlans.map((p) => p.plan_date)));

  const { data: existingPlansForDates, error: existingPlansError } =
    await supabase
      .from("student_plan")
      .select("plan_date, block_index")
      .eq("student_id", user.userId)
      .in("plan_date", planDates);

  if (existingPlansError) {
    console.error("[planGroupActions] 기존 플랜 조회 실패", existingPlansError);
  }

  // 날짜별로 사용 중인 block_index 집합 생성 (O(n) 한 번만)
  const usedBlockIndicesByDate = new Map<string, Set<number>>();
  if (existingPlansForDates) {
    existingPlansForDates.forEach((plan) => {
      if (
        plan.plan_date &&
        plan.block_index !== null &&
        plan.block_index !== undefined
      ) {
        if (!usedBlockIndicesByDate.has(plan.plan_date)) {
          usedBlockIndicesByDate.set(plan.plan_date, new Set());
        }
        usedBlockIndicesByDate.get(plan.plan_date)!.add(plan.block_index);
      }
    });
  }

  // 10. 날짜별로 플랜 그룹화 (효율적인 block_index 조정을 위해)
  const plansByDate = new Map<string, typeof scheduledPlans>();
  scheduledPlans.forEach((plan) => {
    if (!plansByDate.has(plan.plan_date)) {
      plansByDate.set(plan.plan_date, []);
    }
    plansByDate.get(plan.plan_date)!.push(plan);
  });

  // 11. 날짜별로 block_index 조정 및 chapter 조회 배치 처리
  const planPayloads: Array<{
    tenant_id: string;
    student_id: string;
    plan_group_id: string;
    plan_date: string;
    block_index: number;
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    is_reschedulable: boolean;
    // Denormalized 필드 (조회 성능 향상)
    content_title: string | null;
    content_subject: string | null;
    content_subject_category: string | null;
    content_category: string | null;
    // 시간 정보 (플랜 생성 시 계산된 시간)
    start_time: string | null;
    end_time: string | null;
    // 날짜 유형 및 주차 정보
    day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
    week: number | null;
    day: number | null;
    // 상태뱃지 정보
    is_partial: boolean;
    is_continued: boolean;
    // 플랜 번호 (같은 논리적 플랜은 같은 번호)
    plan_number: number | null;
  }> = [];

  // 플랜 번호 부여를 위한 매핑 (논리적 플랜 키 -> 플랜 번호)
  // 같은 논리적 플랜 식별 키: plan_date + content_id + planned_start_page_or_time + planned_end_page_or_time
  const planNumberMap = new Map<string, number>();
  let nextPlanNumber = 1;

  // 날짜별로 순차 처리 (assignPlanTimes를 사용하여 정확한 시간 계산)
  for (const [date, datePlans] of plansByDate.entries()) {
    const usedIndices = usedBlockIndicesByDate.get(date) || new Set<number>();
    let nextBlockIndex = 1; // 날짜별로 시작 block_index

    // 해당 날짜의 time_slots에서 "학습시간" 슬롯만 필터링 및 정렬
    const timeSlotsForDate = dateTimeSlots.get(date) || [];
    const studyTimeSlots = timeSlotsForDate
      .filter((slot) => slot.type === "학습시간")
      .map((slot) => ({ start: slot.start, end: slot.end }))
      .sort((a, b) => {
        // 시간 순으로 정렬
        const aStart = a.start.split(":").map(Number);
        const bStart = b.start.split(":").map(Number);
        const aMinutes = aStart[0] * 60 + aStart[1];
        const bMinutes = bStart[0] * 60 + bStart[1];
        return aMinutes - bMinutes;
      });

    // 날짜별 메타데이터 가져오기
    const dateMetadata = dateMetadataMap.get(date) || {
      day_type: null,
      week_number: null,
    };
    const dayType = dateMetadata.day_type || "학습일";

    // 해당 날짜의 총 학습시간 계산 (scheduleResult에서 가져오기)
    const dailySchedule = scheduleResult.daily_schedule.find(
      (d) => d.date === date
    );
    const totalStudyHours = dailySchedule?.study_hours || 0;

    // assignPlanTimes를 사용하여 플랜 시간 배치 (쪼개진 플랜 처리 포함)
    // 먼저 플랜을 준비 (마스터 콘텐츠 ID를 학생 콘텐츠 ID로 변환)
    const plansForAssign = datePlans.map((plan) => {
      const finalContentId =
        contentIdMap.get(plan.content_id) || plan.content_id;
      return {
        content_id: finalContentId,
        content_type: plan.content_type,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        chapter: plan.chapter || null,
        block_index: plan.block_index,
      };
    });

    // assignPlanTimes 호출하여 시간 세그먼트 계산
    const timeSegments = assignPlanTimes(
      plansForAssign,
      studyTimeSlots,
      contentDurationMap,
      dayType,
      totalStudyHours
    );

    // 각 세그먼트마다 별도의 레코드 생성
    for (const segment of timeSegments) {
      // 기존 플랜과 겹치지 않는 block_index 찾기
      while (usedIndices.has(nextBlockIndex)) {
        nextBlockIndex++;
      }

      // 조정된 block_index를 사용 중인 목록에 추가
      usedIndices.add(nextBlockIndex);
      usedBlockIndicesByDate.set(date, usedIndices);

      // 콘텐츠 메타데이터 조회 (denormalized 필드용)
      const originalContentId =
        datePlans.find(
          (p) =>
            p.content_id === segment.plan.content_id ||
            contentIdMap.get(p.content_id) === segment.plan.content_id
        )?.content_id || segment.plan.content_id;
      const metadata = contentMetadataMap.get(originalContentId) || {};

      // 주차별 일차(day) 계산
      let weekDay: number | null = null;
      if (dateMetadata.week_number) {
        if (group.scheduler_type === "1730_timetable") {
          // 1730 Timetable: 같은 주차의 날짜 목록에서 순서 계산
          const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
          const dayIndex = weekDates.indexOf(date);
          if (dayIndex >= 0) {
            weekDay = dayIndex + 1;
          }
        } else {
          // 자동 스케줄러: 간단한 계산 (period_start 기준 7일 단위)
          const start = new Date(group.period_start);
          const current = new Date(date);
          start.setHours(0, 0, 0, 0);
          current.setHours(0, 0, 0, 0);
          const diffTime = current.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          weekDay = (diffDays % 7) + 1;
        }
      }

      // 플랜 번호 부여 (같은 논리적 플랜은 같은 번호)
      // 논리적 플랜 식별 키: date + content_id + planned_start_page_or_time + planned_end_page_or_time
      const planKey = `${date}:${segment.plan.content_id}:${segment.plan.planned_start_page_or_time}:${segment.plan.planned_end_page_or_time}`;
      let planNumber: number | null = null;

      if (planNumberMap.has(planKey)) {
        // 이미 존재하는 논리적 플랜이면 같은 번호 사용
        planNumber = planNumberMap.get(planKey)!;
      } else {
        // 새로운 논리적 플랜이면 새 번호 부여
        planNumber = nextPlanNumber;
        planNumberMap.set(planKey, planNumber);
        nextPlanNumber++;
      }

      // 원본 플랜에서 is_reschedulable 가져오기
      const originalPlan = datePlans.find(
        (p) =>
          p.content_id === segment.plan.content_id ||
          contentIdMap.get(p.content_id) === segment.plan.content_id
      );

      // chapter 정보가 없으면 나중에 배치로 조회 (지금은 null로 설정)
      planPayloads.push({
        tenant_id: tenantContext.tenantId,
        student_id: user.userId,
        plan_group_id: groupId,
        plan_date: date,
        block_index: nextBlockIndex,
        content_type: segment.plan.content_type,
        content_id: segment.plan.content_id,
        chapter: segment.plan.chapter || null, // 나중에 배치로 채움
        planned_start_page_or_time: segment.plan.planned_start_page_or_time,
        planned_end_page_or_time: segment.plan.planned_end_page_or_time,
        is_reschedulable: originalPlan?.is_reschedulable ?? true,
        // Denormalized 필드
        content_title: metadata.title || null,
        content_subject: metadata.subject || null,
        content_subject_category: metadata.subject_category || null,
        content_category: metadata.category || null,
        // 시간 정보 (assignPlanTimes에서 계산된 정확한 시간)
        start_time: segment.start,
        end_time: segment.end,
        // 날짜 유형 및 주차 정보
        day_type: dateMetadata.day_type,
        week: dateMetadata.week_number,
        day: weekDay,
        // 상태뱃지 정보 (assignPlanTimes에서 계산)
        is_partial: segment.isPartial,
        is_continued: segment.isContinued,
        // 플랜 번호
        plan_number: planNumber,
      });

      nextBlockIndex++;
    }

    // 비학습 항목 저장 (학원일정, 이동시간, 점심시간)
    // time_slots에서 "학습시간"이 아닌 슬롯들을 플랜으로 저장
    const nonStudySlots = timeSlotsForDate.filter(
      (slot) => slot.type !== "학습시간"
    );

    for (const slot of nonStudySlots) {
      // 기존 플랜과 겹치지 않는 block_index 찾기
      while (usedIndices.has(nextBlockIndex)) {
        nextBlockIndex++;
      }

      // 조정된 block_index를 사용 중인 목록에 추가
      usedIndices.add(nextBlockIndex);
      usedBlockIndicesByDate.set(date, usedIndices);

      // content_type 결정
      let contentType: "book" | "lecture" | "custom" = "custom";
      let contentTitle: string;
      let contentSubject: string | null = null;
      let contentSubjectCategory: string | null = null;

      // 비학습 항목을 위한 더미 custom content ID (모든 비학습 항목이 공유)
      const DUMMY_NON_LEARNING_CONTENT_ID =
        "00000000-0000-0000-0000-000000000000";

      // 더미 custom content가 존재하는지 확인하고, 없으면 생성 (첫 번째 슬롯에서만)
      // 주의: content_type은 스키마 제약 조건에 따라 'book', 'lecture', 'custom' 중 하나여야 함
      if (nonStudySlots.indexOf(slot) === 0) {
        const { data: existingDummyContent } = await supabase
          .from("student_custom_contents")
          .select("id")
          .eq("id", DUMMY_NON_LEARNING_CONTENT_ID)
          .eq("student_id", user.userId)
          .maybeSingle();

        if (!existingDummyContent) {
          // 더미 custom content 생성 시도
          // content_type을 'custom'으로 설정 (스키마에서 허용하는 값)
          const { error: createError } = await supabase
            .from("student_custom_contents")
            .insert({
              id: DUMMY_NON_LEARNING_CONTENT_ID,
              tenant_id: tenantContext.tenantId,
              student_id: user.userId,
              title: "비학습 항목",
              total_page_or_time: 0,
              content_type: "custom",
            });

          if (createError) {
            // 생성 실패 시 경고만 출력 (더미 content는 선택사항)
            // contentDurationMap에 이미 기본값이 있으므로 플랜 생성은 계속 진행
            console.warn(
              "[planGroupActions] 더미 custom content 생성 실패 (무시됨):",
              createError.message
            );
          }
        }
      }

      if (slot.type === "학원일정") {
        contentTitle = slot.label || "학원일정";
        // 학원일정 정보에서 과목 정보 가져오기
        const dailySchedule = scheduleResult.daily_schedule.find(
          (d) => d.date === date
        );
        if (
          dailySchedule?.academy_schedules &&
          dailySchedule.academy_schedules.length > 0
        ) {
          // 같은 시간대의 학원일정 찾기
          const matchingAcademy = dailySchedule.academy_schedules.find(
            (academy) =>
              academy.start_time === slot.start && academy.end_time === slot.end
          );
          if (matchingAcademy) {
            contentTitle = matchingAcademy.academy_name || "학원일정";
            if (matchingAcademy.subject) {
              contentSubject = matchingAcademy.subject;
            }
          }
        }
      } else if (slot.type === "이동시간") {
        contentTitle = "이동시간";
      } else if (slot.type === "점심시간") {
        contentTitle = "점심시간";
      } else {
        contentTitle = slot.label || slot.type;
      }

      // 주차별 일차(day) 계산 (위에서 이미 계산된 값 재사용)
      let weekDay: number | null = null;
      if (dateMetadata.week_number) {
        if (group.scheduler_type === "1730_timetable") {
          const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
          const dayIndex = weekDates.indexOf(date);
          if (dayIndex >= 0) {
            weekDay = dayIndex + 1;
          }
        } else {
          const start = new Date(group.period_start);
          const current = new Date(date);
          start.setHours(0, 0, 0, 0);
          current.setHours(0, 0, 0, 0);
          const diffTime = current.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          weekDay = (diffDays % 7) + 1;
        }
      }

      planPayloads.push({
        tenant_id: tenantContext.tenantId,
        student_id: user.userId,
        plan_group_id: groupId,
        plan_date: date,
        block_index: nextBlockIndex,
        content_type: contentType,
        content_id: DUMMY_NON_LEARNING_CONTENT_ID, // 비학습 항목은 더미 UUID 사용
        chapter: null,
        planned_start_page_or_time: 0, // 비학습 항목은 페이지/시간 없음
        planned_end_page_or_time: 0,
        is_reschedulable: false, // 비학습 항목은 재조정 불가
        // Denormalized 필드
        content_title: contentTitle,
        content_subject: contentSubject,
        content_subject_category: contentSubjectCategory,
        content_category: slot.type, // 슬롯 타입을 category로 저장
        // 시간 정보
        start_time: slot.start,
        end_time: slot.end,
        // 날짜 유형 및 주차 정보
        day_type: dateMetadata.day_type,
        week: dateMetadata.week_number,
        day: weekDay,
        // 상태뱃지 정보 (비학습 항목은 없음)
        is_partial: false,
        is_continued: false,
        // 플랜 번호 (비학습 항목은 null)
        plan_number: null,
      });

      nextBlockIndex++;
    }

    // 지정휴일의 경우 배정된 학습시간을 자율학습으로 저장
    // enable_self_study_for_holidays가 true일 때만 자율학습 시간 배정
    const enableSelfStudyForHolidays =
      schedulerOptions.enable_self_study_for_holidays === true;
    if (
      dateMetadata.day_type === "지정휴일" &&
      studyTimeSlots.length > 0 &&
      enableSelfStudyForHolidays
    ) {
      // 자율학습을 위한 더미 custom content ID
      const DUMMY_SELF_STUDY_CONTENT_ID =
        "00000000-0000-0000-0000-000000000001";

      // 더미 custom content가 존재하는지 확인하고, 없으면 생성
      const { data: existingSelfStudyContent } = await supabase
        .from("student_custom_contents")
        .select("id")
        .eq("id", DUMMY_SELF_STUDY_CONTENT_ID)
        .eq("student_id", user.userId)
        .maybeSingle();

      if (!existingSelfStudyContent) {
        // 더미 custom content 생성 시도
        // content_type을 'custom'으로 설정 (스키마에서 허용하는 값)
        const { error: createError } = await supabase
          .from("student_custom_contents")
          .insert({
            id: DUMMY_SELF_STUDY_CONTENT_ID,
            tenant_id: tenantContext.tenantId,
            student_id: user.userId,
            title: "자율학습",
            total_page_or_time: 0,
            content_type: "custom",
          });

        if (createError) {
          // 생성 실패 시 경고만 출력 (더미 content는 선택사항)
          // contentDurationMap에 이미 기본값이 있으므로 플랜 생성은 계속 진행
          console.warn(
            "[planGroupActions] 더미 자율학습 custom content 생성 실패 (무시됨):",
            createError.message
          );
        }
      }

      // 지정휴일의 모든 학습시간 슬롯을 자율학습으로 저장
      for (const studySlot of studyTimeSlots) {
        // 기존 플랜과 겹치지 않는 block_index 찾기
        while (usedIndices.has(nextBlockIndex)) {
          nextBlockIndex++;
        }

        // 조정된 block_index를 사용 중인 목록에 추가
        usedIndices.add(nextBlockIndex);
        usedBlockIndicesByDate.set(date, usedIndices);

        // 주차별 일차(day) 계산
        let weekDay: number | null = null;
        if (dateMetadata.week_number) {
          if (group.scheduler_type === "1730_timetable") {
            const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
            const dayIndex = weekDates.indexOf(date);
            if (dayIndex >= 0) {
              weekDay = dayIndex + 1;
            }
          } else {
            const start = new Date(group.period_start);
            const current = new Date(date);
            start.setHours(0, 0, 0, 0);
            current.setHours(0, 0, 0, 0);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            weekDay = (diffDays % 7) + 1;
          }
        }

        planPayloads.push({
          tenant_id: tenantContext.tenantId,
          student_id: user.userId,
          plan_group_id: groupId,
          plan_date: date,
          block_index: nextBlockIndex,
          content_type: "custom", // 자율학습은 custom 타입
          content_id: DUMMY_SELF_STUDY_CONTENT_ID, // 자율학습은 더미 UUID 사용
          chapter: null,
          planned_start_page_or_time: 0, // 자율학습은 페이지/시간 없음
          planned_end_page_or_time: 0,
          is_reschedulable: false, // 자율학습은 재조정 불가
          // Denormalized 필드
          content_title: "자율학습",
          content_subject: null,
          content_subject_category: null,
          content_category: "자율학습",
          // 시간 정보 (배정된 학습시간)
          start_time: studySlot.start,
          end_time: studySlot.end,
          // 날짜 유형 및 주차 정보
          day_type: dateMetadata.day_type,
          week: dateMetadata.week_number,
          day: weekDay,
          // 상태뱃지 정보 (자율학습은 없음)
          is_partial: false,
          is_continued: false,
          // 플랜 번호 (자율학습은 null)
          plan_number: null,
        });

        nextBlockIndex++;
      }
    }
  }

  // 12. chapter 정보가 없는 플랜들에 대해 배치로 조회 (중복 제거)
  // 더미 UUID는 chapter 조회 스킵 (비학습 항목 및 자율학습)
  const plansNeedingChapter = planPayloads.filter(
    (p) =>
      !p.chapter &&
      p.content_id !== DUMMY_NON_LEARNING_CONTENT_ID &&
      p.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
  );
  if (plansNeedingChapter.length > 0) {
    // 같은 content_id + page_or_time 조합에 대해 중복 조회 방지
    const chapterCache = new Map<string, string | null>();

    await Promise.all(
      plansNeedingChapter.map(async (planPayload) => {
        const cacheKey = `${planPayload.content_type}:${planPayload.content_id}:${planPayload.planned_start_page_or_time}`;

        if (chapterCache.has(cacheKey)) {
          planPayload.chapter = chapterCache.get(cacheKey) ?? null;
          return;
        }

        const chapter = await getContentChapter(
          planPayload.content_type,
          planPayload.content_id,
          planPayload.planned_start_page_or_time
        );

        chapterCache.set(cacheKey, chapter);
        planPayload.chapter = chapter;
      })
    );
  }

  // 13. 최종 중복 체크 (안전장치)
  const planKeys = new Set<string>();
  const duplicatePlans: Array<{ plan_date: string; block_index: number }> = [];

  planPayloads.forEach((plan) => {
    const key = `${plan.student_id}:${plan.plan_date}:${plan.block_index}`;
    if (planKeys.has(key)) {
      duplicatePlans.push({
        plan_date: plan.plan_date,
        block_index: plan.block_index,
      });
    } else {
      planKeys.add(key);
    }
  });

  if (duplicatePlans.length > 0) {
    console.error(
      "[planGroupActions] 생성하려는 플랜 중 중복 발견:",
      duplicatePlans
    );
    throw new AppError(
      `플랜 생성 중 중복이 발견되었습니다. 같은 날짜와 블록에 여러 플랜이 배정되었습니다. (${duplicatePlans.length}개 중복)`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 플랜 일괄 생성
  // 더미 UUID를 사용하는 플랜과 일반 플랜을 분리하여 처리
  const regularPlans = planPayloads.filter(
    (p) =>
      p.content_id !== DUMMY_NON_LEARNING_CONTENT_ID &&
      p.content_id !== DUMMY_SELF_STUDY_CONTENT_ID
  );
  const dummyPlans = planPayloads.filter(
    (p) =>
      p.content_id === DUMMY_NON_LEARNING_CONTENT_ID ||
      p.content_id === DUMMY_SELF_STUDY_CONTENT_ID
  );

  // 일반 플랜 먼저 저장
  if (regularPlans.length > 0) {
    const { error: insertError } = await supabase
      .from("student_plan")
      .insert(regularPlans);

    if (insertError) {
      console.error("[planGroupActions] 일반 플랜 생성 실패", insertError);

      // 중복 키 에러인 경우 더 자세한 정보 제공
      if (insertError.code === "23505") {
        // 중복된 플랜 찾기
        const duplicateKey = insertError.message.match(/Key \(([^)]+)\)/)?.[1];
        console.error("[planGroupActions] 중복 키:", duplicateKey);

        // 중복된 플랜 조회
        const { data: duplicatePlanData } = await supabase
          .from("student_plan")
          .select("id, plan_date, block_index, plan_group_id")
          .eq("student_id", user.userId)
          .limit(10);

        if (duplicatePlanData) {
          console.error(
            "[planGroupActions] 현재 존재하는 플랜 (일부):",
            duplicatePlanData
          );
        }

        throw new AppError(
          `플랜 생성 중 중복 키 오류가 발생했습니다. 같은 날짜와 블록에 이미 플랜이 존재합니다. (키: ${duplicateKey}) 다른 플랜 그룹의 플랜과 충돌할 수 있습니다.`,
          ErrorCode.DATABASE_ERROR,
          500,
          true,
          {
            supabaseError: insertError,
            duplicateKey,
            existingPlans: duplicatePlanData,
          }
        );
      }

      throw new AppError(
        insertError.message || "플랜 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { supabaseError: insertError }
      );
    }
  }

  // 더미 UUID를 사용하는 플랜 저장 (에러 발생해도 무시)
  if (dummyPlans.length > 0) {
    const { error: dummyInsertError } = await supabase
      .from("student_plan")
      .insert(dummyPlans);

    if (dummyInsertError) {
      // 더미 UUID 관련 에러는 무시 (데이터베이스 트리거/함수에서 검증 실패해도 계속 진행)
      if (
        dummyInsertError.code === "P0001" &&
        dummyInsertError.message?.includes("Referenced custom content")
      ) {
        console.warn(
          "[planGroupActions] 더미 UUID 플랜 저장 실패 (무시됨):",
          dummyInsertError.message
        );
        // 더미 content 생성이 실패했어도 플랜은 저장 시도 (외래 키 제약 조건이 없을 수 있음)
      } else {
        // 다른 에러는 로그만 남기고 계속 진행 (비학습 항목은 선택사항)
        console.warn(
          "[planGroupActions] 더미 UUID 플랜 저장 실패 (무시됨):",
          dummyInsertError.message
        );
      }
    }
  }

  // 14. dailySchedule을 plan_groups에 저장 (캐싱)
  // scheduleResult.daily_schedule을 JSONB로 저장하여 매번 계산하지 않도록 개선
  const dailyScheduleForStorage = scheduleResult.daily_schedule.map(
    (daily) => ({
      date: daily.date,
      day_type: daily.day_type,
      study_hours: daily.study_hours,
      time_slots: daily.time_slots,
      exclusion: daily.exclusion,
      academy_schedules: daily.academy_schedules,
    })
  );

  const { error: updateScheduleError } = await supabase
    .from("plan_groups")
    .update({ daily_schedule: dailyScheduleForStorage })
    .eq("id", groupId)
    .eq("student_id", user.userId);

  if (updateScheduleError) {
    console.error(
      "[planGroupActions] dailySchedule 저장 실패",
      updateScheduleError
    );
    // 저장 실패해도 플랜 생성은 성공했으므로 계속 진행
  }

  // 15. 플랜 생성 완료 시 자동으로 saved 상태로 변경
  // draft 상태에서 플랜이 생성되면 saved 상태로 변경
  if ((group.status as PlanStatus) === "draft") {
    try {
      await updatePlanGroupStatus(groupId, "saved");
    } catch (error) {
      // 상태 변경 실패는 경고만 (이미 saved 상태일 수 있음)
      console.warn("[planGroupActions] 플랜 그룹 상태 변경 실패:", error);
    }
  }

  // revalidatePath는 Step 7에서 결과를 확인한 후에 실행되도록 제거
  // Step 7에서 완료 버튼을 눌렀을 때만 리다이렉트하도록 함
  // revalidatePath("/plan");
  // revalidatePath(`/plan/group/${groupId}`);

  return { count: scheduledPlans.length };
}

export const generatePlansFromGroupAction = withErrorHandling(
  _generatePlansFromGroup
);

/**
 * 플랜 생성 전 미리보기 (실제 저장하지 않고 플랜 데이터만 반환)
 */
async function _previewPlansFromGroup(groupId: string): Promise<{
  plans: Array<{
    plan_date: string;
    block_index: number;
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    content_title: string | null;
    content_subject: string | null;
    content_subject_category: string | null;
    content_category: string | null;
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    chapter: string | null;
    start_time: string | null;
    end_time: string | null;
  }>;
}> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      throw new AppError(
        "로그인이 필요합니다.",
        ErrorCode.UNAUTHORIZED,
        401,
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

    const supabase = await createSupabaseServerClient();

    // 1. 플랜 그룹 및 관련 데이터 조회
    const result = await getPlanGroupWithDetails(groupId, user.userId);
    const group = result.group;
    const contents = result.contents || [];
    const exclusions = result.exclusions || [];
    const academySchedules = result.academySchedules || [];

    if (!group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 2. 상태 확인
    if (group.status !== "saved" && group.status !== "active") {
      throw new AppError(
        "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 미리볼 수 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // exclusions와 academySchedules가 배열인지 확인 (이중 체크)
    const safeExclusions = Array.isArray(exclusions) ? exclusions : [];
    const safeAcademySchedules = Array.isArray(academySchedules)
      ? academySchedules
      : [];

    // 3. Step 2.5에서 계산된 스케줄 결과 사용
    const { calculateAvailableDates } = await import(
      "@/lib/scheduler/calculateAvailableDates"
    );

    // 블록 세트에서 기본 블록 정보 가져오기
    let baseBlocks: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];

    if (group.block_set_id) {
      const { data: blockSet } = await supabase
        .from("student_block_sets")
        .select("id, name, student_id")
        .eq("id", group.block_set_id)
        .maybeSingle();

      if (blockSet) {
        const blockSetOwnerId = blockSet.student_id;
        const { data: blockRows } = await supabase
          .from("student_block_schedule")
          .select("day_of_week, start_time, end_time")
          .eq("block_set_id", group.block_set_id)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (blockRows && blockRows.length > 0) {
          baseBlocks = blockRows.map((row) => ({
            day_of_week: row.day_of_week,
            start_time: row.start_time,
            end_time: row.end_time,
          }));
        }
      }
    }

    // Step 2.5 스케줄 결과 가져오기
    const scheduleResult = calculateAvailableDates(
      group.period_start,
      group.period_end,
      baseBlocks.map((b) => ({
        day_of_week: b.day_of_week,
        start_time: b.start_time,
        end_time: b.end_time,
      })),
      safeExclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type as
          | "휴가"
          | "개인사정"
          | "휴일지정"
          | "기타",
        reason: e.reason || undefined,
      })),
      safeAcademySchedules.map((a) => ({
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
        academy_name: a.academy_name || undefined,
        subject: a.subject || undefined,
        travel_time: a.travel_time || undefined,
      })),
      {
        scheduler_type: group.scheduler_type || "1730_timetable",
        scheduler_options: (group.scheduler_options as any) || null,
        use_self_study_with_blocks: true, // 블록이 있어도 자율학습 시간 포함
        enable_self_study_for_holidays:
          (group.scheduler_options as any)?.enable_self_study_for_holidays ===
          true,
        enable_self_study_for_study_days:
          (group.scheduler_options as any)?.enable_self_study_for_study_days ===
          true,
        lunch_time: (group.scheduler_options as any)?.lunch_time,
        camp_study_hours: (group.scheduler_options as any)?.camp_study_hours,
        camp_self_study_hours: (group.scheduler_options as any)
          ?.camp_self_study_hours,
        designated_holiday_hours: (group.scheduler_options as any)
          ?.designated_holiday_hours,
      }
    );

    // dateTimeSlots, dateMetadataMap, weekDatesMap 추출
    const dateTimeSlots = new Map<
      string,
      Array<{
        type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
        start: string;
        end: string;
        label?: string;
      }>
    >();

    // 날짜별 메타데이터 매핑 (day_type, week_number)
    const dateMetadataMap = new Map<
      string,
      {
        day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
        week_number: number | null;
      }
    >();

    // 주차별 날짜 목록 (일차 계산용)
    const weekDatesMap = new Map<number, string[]>();

    scheduleResult.daily_schedule.forEach((daily) => {
      if (daily.time_slots && daily.time_slots.length > 0) {
        dateTimeSlots.set(
          daily.date,
          daily.time_slots.map((slot) => ({
            type: slot.type,
            start: slot.start,
            end: slot.end,
            label: slot.label,
          }))
        );
      }

      // 날짜별 메타데이터 저장
      dateMetadataMap.set(daily.date, {
        day_type: daily.day_type || null,
        week_number: daily.week_number || null,
      });

      // 주차별 날짜 목록 구성 (일차 계산용)
      if (daily.week_number) {
        if (!weekDatesMap.has(daily.week_number)) {
          weekDatesMap.set(daily.week_number, []);
        }
        // 제외일이 아닌 날짜만 주차에 포함 (1730 Timetable의 경우)
        if (
          daily.day_type &&
          daily.day_type !== "휴가" &&
          daily.day_type !== "개인일정" &&
          daily.day_type !== "지정휴일"
        ) {
          weekDatesMap.get(daily.week_number)!.push(daily.date);
        }
      }
    });

    // 주차별 날짜 목록 정렬 (날짜 순)
    weekDatesMap.forEach((dates, week) => {
      dates.sort();
    });

    // 4. 마스터 콘텐츠를 학생 콘텐츠로 매핑 (미리보기에서는 기존 복사본 확인만)
    // content_id 매핑: 마스터 콘텐츠 ID -> 학생 콘텐츠 ID
    const contentIdMap = new Map<string, string>();

    for (const content of contents) {
      let studentContentId = content.content_id;

      try {
        // 마스터 콘텐츠인지 확인하고 기존 복사본이 있는지 확인
        if (content.content_type === "book") {
          const { data: masterBook } = await supabase
            .from("master_books")
            .select("id")
            .eq("id", content.content_id)
            .maybeSingle();

          if (masterBook) {
            // 이미 복사된 학생 교재가 있는지 확인
            const { data: existingBook } = await supabase
              .from("books")
              .select("id")
              .eq("student_id", user.userId)
              .eq("master_content_id", content.content_id)
              .maybeSingle();

            if (existingBook) {
              studentContentId = existingBook.id;
            }
            // 미리보기에서는 복사하지 않고 기존 ID 사용
            contentIdMap.set(content.content_id, studentContentId);
          } else {
            contentIdMap.set(content.content_id, content.content_id);
          }
        } else if (content.content_type === "lecture") {
          const { data: masterLecture } = await supabase
            .from("master_lectures")
            .select("id")
            .eq("id", content.content_id)
            .maybeSingle();

          if (masterLecture) {
            // 이미 복사된 학생 강의가 있는지 확인
            const { data: existingLecture } = await supabase
              .from("lectures")
              .select("id")
              .eq("student_id", user.userId)
              .eq("master_content_id", content.content_id)
              .maybeSingle();

            if (existingLecture) {
              studentContentId = existingLecture.id;
            }
            contentIdMap.set(content.content_id, studentContentId);
          } else {
            contentIdMap.set(content.content_id, content.content_id);
          }
        } else {
          contentIdMap.set(content.content_id, content.content_id);
        }
      } catch (error) {
        console.error(
          `[planGroupActions] 마스터 콘텐츠 확인 실패: ${content.content_id}`,
          error
        );
        // 에러 발생 시 원본 ID 사용
        contentIdMap.set(content.content_id, content.content_id);
      }
    }

    // 5. 콘텐츠 소요시간 정보 조회
    const contentDurationMap = new Map<
      string,
      {
        content_type: "book" | "lecture" | "custom";
        content_id: string;
        total_pages?: number | null;
        duration?: number | null;
        total_page_or_time?: number | null;
      }
    >();

    // 더미 UUID에 대한 기본값 추가 (비학습 항목 및 자율학습용)
    const DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW =
      "00000000-0000-0000-0000-000000000000";
    const DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW =
      "00000000-0000-0000-0000-000000000001";

    contentDurationMap.set(DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW, {
      content_type: "custom",
      content_id: DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW,
      total_page_or_time: 0,
    });

    contentDurationMap.set(DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW, {
      content_type: "custom",
      content_id: DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW,
      total_page_or_time: 0,
    });

    for (const content of contents) {
      const finalContentId =
        contentIdMap.get(content.content_id) || content.content_id;

      if (content.content_type === "book") {
        // 학생 교재 조회
        const { data: studentBook } = await supabase
          .from("books")
          .select("id, total_pages, master_content_id")
          .eq("id", finalContentId)
          .eq("student_id", user.userId)
          .maybeSingle();

        if (studentBook?.total_pages) {
          contentDurationMap.set(content.content_id, {
            content_type: "book",
            content_id: content.content_id,
            total_pages: studentBook.total_pages,
          });
        } else if (studentBook?.master_content_id) {
          // 마스터 교재 조회
          const { data: masterBook } = await supabase
            .from("master_books")
            .select("id, total_pages")
            .eq("id", studentBook.master_content_id)
            .maybeSingle();

          if (masterBook?.total_pages) {
            contentDurationMap.set(content.content_id, {
              content_type: "book",
              content_id: content.content_id,
              total_pages: masterBook.total_pages,
            });
          }
        }
      } else if (content.content_type === "lecture") {
        // 학생 강의 조회
        const { data: studentLecture } = await supabase
          .from("lectures")
          .select("id, duration, master_content_id")
          .eq("id", finalContentId)
          .eq("student_id", user.userId)
          .maybeSingle();

        if (studentLecture?.duration) {
          contentDurationMap.set(content.content_id, {
            content_type: "lecture",
            content_id: content.content_id,
            duration: studentLecture.duration,
          });
        } else if (studentLecture?.master_content_id) {
          // 마스터 강의 조회
          const { data: masterLecture } = await supabase
            .from("master_lectures")
            .select("id, total_duration")
            .eq("id", studentLecture.master_content_id)
            .maybeSingle();

          if (masterLecture?.total_duration) {
            contentDurationMap.set(content.content_id, {
              content_type: "lecture",
              content_id: content.content_id,
              duration: masterLecture.total_duration,
            });
          }
        }
      } else if (content.content_type === "custom") {
        // 더미 UUID는 이미 처리했으므로 스킵
        if (
          finalContentId === DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW ||
          finalContentId === DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW ||
          content.content_id === DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW ||
          content.content_id === DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW
        ) {
          continue;
        }

        // 커스텀 콘텐츠 조회
        const { data: customContent } = await supabase
          .from("student_custom_contents")
          .select("id, total_page_or_time")
          .eq("id", finalContentId)
          .eq("student_id", user.userId)
          .maybeSingle();

        if (customContent?.total_page_or_time) {
          contentDurationMap.set(content.content_id, {
            content_type: "custom",
            content_id: content.content_id,
            total_page_or_time: customContent.total_page_or_time,
          });
        } else if (!customContent) {
          // 더미 UUID인 경우는 에러 발생하지 않음 (더미 content 생성 실패해도 계속 진행)
          // 일반 custom content가 존재하지 않으면 에러 발생
          if (
            finalContentId !== DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW &&
            finalContentId !== DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW &&
            content.content_id !== DUMMY_NON_LEARNING_CONTENT_ID_PREVIEW &&
            content.content_id !== DUMMY_SELF_STUDY_CONTENT_ID_PREVIEW
          ) {
            throw new AppError(
              `Referenced custom content (${finalContentId}) does not exist`,
              ErrorCode.VALIDATION_ERROR,
              400,
              true
            );
          }
          // 더미 UUID인 경우는 contentDurationMap에 이미 기본값이 있으므로 스킵
        }
      }
    }

    // 6. dateAvailableTimeRanges 추출
    const dateAvailableTimeRanges = new Map<
      string,
      Array<{ start: string; end: string }>
    >();
    scheduleResult.daily_schedule.forEach((daily) => {
      if (
        daily.day_type === "학습일" &&
        daily.available_time_ranges.length > 0
      ) {
        dateAvailableTimeRanges.set(
          daily.date,
          daily.available_time_ranges.map((range) => ({
            start: range.start,
            end: range.end,
          }))
        );
      }
    });

    // 7. 스케줄러 호출 (플랜 생성)
    const { generatePlansFromGroup } = await import("@/lib/plan/scheduler");

    const scheduledPlans = generatePlansFromGroup(
      group,
      contents,
      safeExclusions,
      safeAcademySchedules,
      [], // blocks는 사용하지 않음 (dateAvailableTimeRanges 사용)
      undefined, // contentSubjects
      undefined, // riskIndexMap
      dateAvailableTimeRanges, // dateAvailableTimeRanges 추가
      dateTimeSlots,
      contentDurationMap
    );

    // 8. 콘텐츠 메타데이터 정보 조회 (denormalization용)
    const contentMetadataMap = new Map<
      string,
      {
        title?: string | null;
        subject?: string | null;
        subject_category?: string | null;
        category?: string | null;
      }
    >();

    for (const content of contents) {
      const finalContentId =
        contentIdMap.get(content.content_id) || content.content_id;

      if (content.content_type === "book") {
        const { data: book } = await supabase
          .from("books")
          .select("title, subject, subject_category, content_category")
          .eq("id", finalContentId)
          .eq("student_id", user.userId)
          .maybeSingle();

        if (book) {
          contentMetadataMap.set(content.content_id, {
            title: book.title || null,
            subject: book.subject || null,
            subject_category: book.subject_category || null,
            category: book.content_category || null,
          });
        } else {
          // 마스터 교재 조회
          const { data: masterBook } = await supabase
            .from("master_books")
            .select("title, subject, subject_category, content_category")
            .eq("id", content.content_id)
            .maybeSingle();

          if (masterBook) {
            contentMetadataMap.set(content.content_id, {
              title: masterBook.title || null,
              subject: masterBook.subject || null,
              subject_category: masterBook.subject_category || null,
              category: masterBook.content_category || null,
            });
          }
        }
      } else if (content.content_type === "lecture") {
        const { data: lecture } = await supabase
          .from("lectures")
          .select("title, subject, subject_category, content_category")
          .eq("id", finalContentId)
          .eq("student_id", user.userId)
          .maybeSingle();

        if (lecture) {
          contentMetadataMap.set(content.content_id, {
            title: lecture.title || null,
            subject: lecture.subject || null,
            subject_category: lecture.subject_category || null,
            category: lecture.content_category || null,
          });
        } else {
          // 마스터 강의 조회
          const { data: masterLecture } = await supabase
            .from("master_lectures")
            .select("title, subject, subject_category, content_category")
            .eq("id", content.content_id)
            .maybeSingle();

          if (masterLecture) {
            contentMetadataMap.set(content.content_id, {
              title: masterLecture.title || null,
              subject: masterLecture.subject || null,
              subject_category: masterLecture.subject_category || null,
              category: masterLecture.content_category || null,
            });
          }
        }
      } else if (content.content_type === "custom") {
        // 커스텀 콘텐츠 조회
        const { data: customContent } = await supabase
          .from("student_custom_contents")
          .select("title, subject, subject_category, content_category")
          .eq("id", finalContentId)
          .eq("student_id", user.userId)
          .maybeSingle();

        if (customContent) {
          contentMetadataMap.set(content.content_id, {
            title: customContent.title || null,
            subject: customContent.subject || null,
            subject_category: customContent.subject_category || null,
            category: customContent.content_category || null,
          });
        }
      }
    }

    // 플랜 미리보기 데이터 생성 (실제 저장하지 않음)
    const previewPlans: Array<{
      plan_date: string;
      block_index: number;
      content_type: "book" | "lecture" | "custom";
      content_id: string;
      content_title: string | null;
      content_subject: string | null;
      content_subject_category: string | null;
      content_category: string | null;
      planned_start_page_or_time: number;
      planned_end_page_or_time: number;
      chapter: string | null;
      start_time: string | null;
      end_time: string | null;
      day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
      week: number | null;
      day: number | null;
      is_partial: boolean;
      is_continued: boolean;
      plan_number: number | null;
    }> = [];

    // 플랜 번호 부여를 위한 매핑 (논리적 플랜 키 -> 플랜 번호)
    const previewPlanNumberMap = new Map<string, number>();
    let previewNextPlanNumber = 1;

    // 날짜별로 그룹화
    const plansByDate = new Map<string, typeof scheduledPlans>();
    scheduledPlans.forEach((plan) => {
      if (!plansByDate.has(plan.plan_date)) {
        plansByDate.set(plan.plan_date, []);
      }
      plansByDate.get(plan.plan_date)!.push(plan);
    });

    // 각 날짜별로 처리 (assignPlanTimes를 사용하여 정확한 시간 계산)
    for (const [date, datePlans] of plansByDate.entries()) {
      // 해당 날짜의 time_slots에서 "학습시간" 슬롯만 필터링 및 정렬
      const timeSlotsForDate = dateTimeSlots.get(date) || [];
      const studyTimeSlots = timeSlotsForDate
        .filter((slot) => slot.type === "학습시간")
        .map((slot) => ({ start: slot.start, end: slot.end }))
        .sort((a, b) => {
          const aStart = a.start.split(":").map(Number);
          const bStart = b.start.split(":").map(Number);
          const aMinutes = aStart[0] * 60 + aStart[1];
          const bMinutes = bStart[0] * 60 + bStart[1];
          return aMinutes - bMinutes;
        });

      // 날짜별 메타데이터 가져오기
      const dateMetadata = dateMetadataMap.get(date) || {
        day_type: null,
        week_number: null,
      };
      const dayType = dateMetadata.day_type || "학습일";

      // 해당 날짜의 총 학습시간 계산
      const dailySchedule = scheduleResult.daily_schedule.find(
        (d) => d.date === date
      );
      const totalStudyHours = dailySchedule?.study_hours || 0;

      // assignPlanTimes를 사용하여 플랜 시간 배치 (쪼개진 플랜 처리 포함)
      const plansForAssign = datePlans.map((plan) => {
        const finalContentId =
          contentIdMap.get(plan.content_id) || plan.content_id;
        return {
          content_id: finalContentId,
          content_type: plan.content_type,
          planned_start_page_or_time: plan.planned_start_page_or_time,
          planned_end_page_or_time: plan.planned_end_page_or_time,
          chapter: plan.chapter || null,
          block_index: plan.block_index,
        };
      });

      // assignPlanTimes 호출하여 시간 세그먼트 계산
      const timeSegments = assignPlanTimes(
        plansForAssign,
        studyTimeSlots,
        contentDurationMap,
        dayType,
        totalStudyHours
      );

      let blockIndex = 1;

      // 각 세그먼트마다 별도의 레코드 생성
      for (const segment of timeSegments) {
        // 콘텐츠 메타데이터 조회
        const originalContentId =
          datePlans.find(
            (p) =>
              p.content_id === segment.plan.content_id ||
              contentIdMap.get(p.content_id) === segment.plan.content_id
          )?.content_id || segment.plan.content_id;
        const metadata = contentMetadataMap.get(originalContentId) || {};

        // 주차별 일차(day) 계산
        let weekDay: number | null = null;
        if (dateMetadata.week_number) {
          if (group.scheduler_type === "1730_timetable") {
            const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
            const dayIndex = weekDates.indexOf(date);
            if (dayIndex >= 0) {
              weekDay = dayIndex + 1;
            }
          } else {
            const start = new Date(group.period_start);
            const current = new Date(date);
            start.setHours(0, 0, 0, 0);
            current.setHours(0, 0, 0, 0);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            weekDay = (diffDays % 7) + 1;
          }
        }

        // 플랜 번호 부여 (같은 논리적 플랜은 같은 번호)
        const planKey = `${date}:${segment.plan.content_id}:${segment.plan.planned_start_page_or_time}:${segment.plan.planned_end_page_or_time}`;
        let planNumber: number | null = null;

        if (previewPlanNumberMap.has(planKey)) {
          planNumber = previewPlanNumberMap.get(planKey)!;
        } else {
          planNumber = previewNextPlanNumber;
          previewPlanNumberMap.set(planKey, planNumber);
          previewNextPlanNumber++;
        }

        previewPlans.push({
          plan_date: date,
          block_index: blockIndex,
          content_type: segment.plan.content_type,
          content_id: segment.plan.content_id,
          content_title: metadata?.title || null,
          content_subject: metadata?.subject || null,
          content_subject_category: metadata?.subject_category || null,
          content_category: metadata?.category || null,
          planned_start_page_or_time: segment.plan.planned_start_page_or_time,
          planned_end_page_or_time: segment.plan.planned_end_page_or_time,
          chapter: segment.plan.chapter || null,
          start_time: segment.start,
          end_time: segment.end,
          day_type: dateMetadata.day_type,
          week: dateMetadata.week_number,
          day: weekDay,
          is_partial: segment.isPartial,
          is_continued: segment.isContinued,
          plan_number: planNumber,
        });

        blockIndex++;
      }

      // 비학습 항목 저장 (학원일정, 이동시간, 점심시간, 자율학습)
      // 자율학습은 일반 학습일/복습일의 경우 time_slots에 포함되므로 여기서도 처리
      const nonStudySlots = timeSlotsForDate.filter(
        (slot) => slot.type !== "학습시간"
      );

      for (const slot of nonStudySlots) {
        let contentTitle: string;
        let contentSubject: string | null = null;

        if (slot.type === "학원일정") {
          contentTitle = slot.label || "학원일정";
          const dailySchedule = scheduleResult.daily_schedule.find(
            (d) => d.date === date
          );
          if (
            dailySchedule?.academy_schedules &&
            dailySchedule.academy_schedules.length > 0
          ) {
            const matchingAcademy = dailySchedule.academy_schedules.find(
              (academy) =>
                academy.start_time === slot.start &&
                academy.end_time === slot.end
            );
            if (matchingAcademy) {
              contentTitle = matchingAcademy.academy_name || "학원일정";
              if (matchingAcademy.subject) {
                contentSubject = matchingAcademy.subject;
              }
            }
          }
        } else if (slot.type === "이동시간") {
          contentTitle = "이동시간";
        } else if (slot.type === "점심시간") {
          contentTitle = "점심시간";
        } else {
          contentTitle = slot.label || slot.type;
        }

        // 주차별 일차(day) 계산
        let weekDay: number | null = null;
        if (dateMetadata.week_number) {
          if (group.scheduler_type === "1730_timetable") {
            const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
            const dayIndex = weekDates.indexOf(date);
            if (dayIndex >= 0) {
              weekDay = dayIndex + 1;
            }
          } else {
            const start = new Date(group.period_start);
            const current = new Date(date);
            start.setHours(0, 0, 0, 0);
            current.setHours(0, 0, 0, 0);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            weekDay = (diffDays % 7) + 1;
          }
        }

        previewPlans.push({
          plan_date: date,
          block_index: blockIndex,
          content_type: "custom",
          content_id: "00000000-0000-0000-0000-000000000000", // 비학습 항목은 더미 UUID 사용
          content_title: contentTitle,
          content_subject: contentSubject,
          content_subject_category: null,
          content_category: slot.type,
          planned_start_page_or_time: 0,
          planned_end_page_or_time: 0,
          chapter: null,
          start_time: slot.start,
          end_time: slot.end,
          day_type: dateMetadata.day_type,
          week: dateMetadata.week_number,
          day: weekDay,
          is_partial: false,
          is_continued: false,
          plan_number: null,
        });

        blockIndex++;
      }

      // 지정휴일의 경우 배정된 학습시간을 자율학습으로 저장
      // enable_self_study_for_holidays가 true일 때만 자율학습 시간 배정
      const schedulerOptionsPreview = (group.scheduler_options as any) || {};
      const enableSelfStudyForHolidaysPreview =
        schedulerOptionsPreview.enable_self_study_for_holidays === true;
      if (
        dateMetadata.day_type === "지정휴일" &&
        studyTimeSlots.length > 0 &&
        enableSelfStudyForHolidaysPreview
      ) {
        for (const studySlot of studyTimeSlots) {
          // 주차별 일차(day) 계산
          let weekDay: number | null = null;
          if (dateMetadata.week_number) {
            if (group.scheduler_type === "1730_timetable") {
              const weekDates =
                weekDatesMap.get(dateMetadata.week_number) || [];
              const dayIndex = weekDates.indexOf(date);
              if (dayIndex >= 0) {
                weekDay = dayIndex + 1;
              }
            } else {
              const start = new Date(group.period_start);
              const current = new Date(date);
              start.setHours(0, 0, 0, 0);
              current.setHours(0, 0, 0, 0);
              const diffTime = current.getTime() - start.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              weekDay = (diffDays % 7) + 1;
            }
          }

          previewPlans.push({
            plan_date: date,
            block_index: blockIndex,
            content_type: "custom",
            content_id: "00000000-0000-0000-0000-000000000000", // 자율학습은 더미 UUID 사용
            content_title: "자율학습",
            content_subject: null,
            content_subject_category: null,
            content_category: "자율학습",
            planned_start_page_or_time: 0,
            planned_end_page_or_time: 0,
            chapter: null,
            start_time: studySlot.start,
            end_time: studySlot.end,
            day_type: dateMetadata.day_type,
            week: dateMetadata.week_number,
            day: weekDay,
            is_partial: false,
            is_continued: false,
            plan_number: null,
          });

          blockIndex++;
        }
      }
    }

    return { plans: previewPlans };
  } catch (error) {
    console.error("[planGroupActions] 플랜 미리보기 실패:", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      error instanceof Error ? error.message : "플랜 미리보기에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }
}

export const previewPlansFromGroupAction = withErrorHandling(
  _previewPlansFromGroup
);

/**
 * 플랜 그룹의 플랜 목록 조회
 */
async function _getPlansByGroupId(groupId: string): Promise<{
  plans: Array<{
    id: string;
    plan_date: string;
    block_index: number | null;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
    is_reschedulable: boolean;
  }>;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_plan")
    .select(
      "id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,is_reschedulable"
    )
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (error) {
    console.error("[planGroupActions] 플랜 조회 실패", error);
    throw new AppError(
      error.message || "플랜 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return {
    plans: (data || []).map((plan) => ({
      id: plan.id,
      plan_date: plan.plan_date || "",
      block_index: plan.block_index,
      content_type: plan.content_type || "",
      content_id: plan.content_id || "",
      chapter: plan.chapter,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      completed_amount: plan.completed_amount,
      is_reschedulable: plan.is_reschedulable || false,
    })),
  };
}

export const getPlansByGroupIdAction = withErrorHandling(_getPlansByGroupId);

/**
 * 플랜 그룹의 스케줄 결과 데이터 조회 (표 형식 변환용)
 */
async function _getScheduleResultData(groupId: string): Promise<{
  plans: Array<{
    id: string;
    plan_date: string;
    block_index: number | null;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
  }>;
  periodStart: string;
  periodEnd: string | null;
  schedulerType: string | null;
  schedulerOptions: any;
  contents: Array<{
    id: string;
    title: string;
    subject?: string | null;
    subject_category?: string | null;
    total_pages?: number | null;
    duration?: number | null;
    total_page_or_time?: number | null;
  }>;
  blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    block_index: number;
  }>;
  dateTimeSlots: Record<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
  >;
  dailySchedule: Array<{
    date: string;
    day_type: string;
    study_hours: number;
    time_slots?: Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>;
    exclusion?: {
      exclusion_type: string;
      reason?: string;
    } | null;
    academy_schedules?: Array<{
      academy_name?: string;
      subject?: string;
      start_time: string;
      end_time: string;
    }>;
  }>;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // tenantId 조회
  const tenantContext = await getTenantContext();
  const tenantId = tenantContext?.tenantId || null;

  // 1. 플랜 그룹 정보 조회 (daily_schedule 포함)
  const { data: group, error: groupError } = await supabase
    .from("plan_groups")
    .select(
      "period_start, period_end, block_set_id, scheduler_type, scheduler_options, daily_schedule"
    )
    .eq("id", groupId)
    .eq("student_id", user.userId)
    .maybeSingle();

  if (groupError) {
    console.error("[planGroupActions] 플랜 그룹 조회 오류:", groupError);
    throw new AppError(
      `플랜 그룹 정보를 조회할 수 없습니다: ${groupError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: groupError }
    );
  }

  if (!group) {
    console.error("[planGroupActions] 플랜 그룹을 찾을 수 없음:", {
      groupId,
      userId: user.userId,
    });
    throw new AppError(
      "플랜 그룹 정보를 조회할 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 2. 플랜 데이터 조회
  const { data: plans, error: plansError } = await supabase
    .from("student_plan")
    .select(
      "id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount"
    )
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (plansError) {
    throw new AppError(
      plansError.message || "플랜 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: plansError }
    );
  }

  // 3. 콘텐츠 데이터 조회 (총량/duration 정보 포함)
  const contentIds = new Set((plans || []).map((p) => p.content_id));
  const contentsMap = new Map<
    string,
    {
      id: string;
      title: string;
      subject?: string | null;
      subject_category?: string | null;
      total_pages?: number | null; // 책의 경우
      duration?: number | null; // 강의의 경우
      total_page_or_time?: number | null; // 커스텀의 경우
    }
  >();

  // 책 조회
  const bookPlans = (plans || []).filter((p) => p.content_type === "book");
  const bookIds = Array.from(new Set(bookPlans.map((p) => p.content_id)));

  if (bookIds.length > 0) {
    const { data: books } = await supabase
      .from("books")
      .select("id, title, subject, subject_category, total_pages")
      .in("id", bookIds)
      .eq("student_id", user.userId);

    books?.forEach((book) => {
      contentsMap.set(book.id, {
        id: book.id,
        title: book.title || "",
        subject: book.subject || null,
        subject_category: book.subject_category || null,
        total_pages: book.total_pages || null,
      });
    });

    // 마스터 책 조회 (학생 책에 없는 경우)
    const foundBookIds = new Set(books?.map((b) => b.id) || []);
    const missingBookIds = bookIds.filter((id) => !foundBookIds.has(id));

    if (missingBookIds.length > 0) {
      const { data: masterBooks } = await supabase
        .from("master_books")
        .select("id, title, subject, subject_category, total_pages")
        .in("id", missingBookIds);

      masterBooks?.forEach((book) => {
        contentsMap.set(book.id, {
          id: book.id,
          title: book.title || "",
          subject: book.subject || null,
          subject_category: book.subject_category || null,
          total_pages: book.total_pages || null,
        });
      });
    }
  }

  // 강의 조회
  const lecturePlans = (plans || []).filter(
    (p) => p.content_type === "lecture"
  );
  const lectureIds = Array.from(new Set(lecturePlans.map((p) => p.content_id)));

  if (lectureIds.length > 0) {
    const { data: lectures } = await supabase
      .from("lectures")
      .select("id, title, subject, subject_category, duration")
      .in("id", lectureIds)
      .eq("student_id", user.userId);

    lectures?.forEach((lecture) => {
      contentsMap.set(lecture.id, {
        id: lecture.id,
        title: lecture.title || "",
        subject: lecture.subject || null,
        subject_category: lecture.subject_category || null,
        duration: lecture.duration || null,
      });
    });

    // 마스터 강의 조회 (학생 강의에 없는 경우)
    const foundLectureIds = new Set(lectures?.map((l) => l.id) || []);
    const missingLectureIds = lectureIds.filter(
      (id) => !foundLectureIds.has(id)
    );

    if (missingLectureIds.length > 0) {
      const { data: masterLectures } = await supabase
        .from("master_lectures")
        .select("id, title, subject, subject_category, total_duration")
        .in("id", missingLectureIds);

      masterLectures?.forEach((lecture) => {
        contentsMap.set(lecture.id, {
          id: lecture.id,
          title: lecture.title || "",
          subject: lecture.subject || null,
          subject_category: lecture.subject_category || null,
          duration: lecture.total_duration || null, // 마스터 강의는 total_duration
        });
      });
    }
  }

  // 커스텀 콘텐츠 조회
  const customPlans = (plans || []).filter((p) => p.content_type === "custom");
  const customIds = Array.from(new Set(customPlans.map((p) => p.content_id)));

  if (customIds.length > 0) {
    const { data: customContents } = await supabase
      .from("student_custom_contents")
      .select("id, title, subject, subject_category, total_page_or_time")
      .in("id", customIds)
      .eq("student_id", user.userId);

    customContents?.forEach((custom) => {
      contentsMap.set(custom.id, {
        id: custom.id,
        title: custom.title || "",
        subject: custom.subject || null,
        subject_category: custom.subject_category || null,
        total_page_or_time: custom.total_page_or_time || null,
      });
    });
  }

  // 4. 블록 데이터 조회 (플랜 생성 시와 동일한 방식으로 block_index 재할당)
  let blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    block_index: number;
  }> = [];

  if (group.block_set_id) {
    const { data: blockData } = await supabase
      .from("student_block_schedule")
      .select("id, day_of_week, start_time, end_time, block_index")
      .eq("block_set_id", group.block_set_id)
      .eq("student_id", user.userId);

    if (blockData && blockData.length > 0) {
      // day_of_week별로 그룹화하여 block_index 재할당 (플랜 생성 시와 동일)
      const blocksByDay = new Map<number, typeof blockData>();
      blockData.forEach((b) => {
        const day = b.day_of_week;
        if (!blocksByDay.has(day)) {
          blocksByDay.set(day, []);
        }
        blocksByDay.get(day)!.push(b);
      });

      blocks = Array.from(blocksByDay.entries()).flatMap(([day, dayBlocks]) => {
        // 같은 day_of_week 내에서 start_time으로 정렬
        const sorted = [...dayBlocks].sort((a, b) => {
          const aTime = timeToMinutes(a.start_time);
          const bTime = timeToMinutes(b.start_time);
          return aTime - bTime;
        });

        return sorted.map((b, index) => ({
          id: b.id,
          day_of_week: day,
          block_index: index + 1, // 같은 day_of_week 내에서 1부터 시작
          start_time: b.start_time,
          end_time: b.end_time,
        }));
      });
    }
  }

  // 5. Step 2.5 스케줄 결과 조회 (time_slots 정보 포함)
  // 저장된 dailySchedule이 있으면 사용, 없으면 계산
  let dailySchedule: Array<{
    date: string;
    day_type: string;
    study_hours: number;
    time_slots?: Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>;
    exclusion?: {
      exclusion_type: string;
      reason?: string;
    } | null;
    academy_schedules?: Array<{
      academy_name?: string;
      subject?: string;
      start_time: string;
      end_time: string;
    }>;
  }> = [];

  /**
   * 저장된 daily_schedule 유효성 검증 함수
   * @param storedSchedule 저장된 daily_schedule 배열
   * @param periodStart 기간 시작일
   * @param periodEnd 기간 종료일
   * @returns 유효성 여부
   */
  const isValidDailySchedule = (
    storedSchedule: any[],
    periodStart: string | null,
    periodEnd: string | null
  ): boolean => {
    if (
      !storedSchedule ||
      !Array.isArray(storedSchedule) ||
      storedSchedule.length === 0
    ) {
      return false;
    }

    // 기간 확인: 저장된 스케줄의 날짜 범위가 현재 기간과 일치하는지 확인
    if (periodStart && periodEnd) {
      const scheduleDates = storedSchedule.map((d) => d.date).sort();
      const firstDate = scheduleDates[0];
      const lastDate = scheduleDates[scheduleDates.length - 1];

      if (firstDate !== periodStart || lastDate !== periodEnd) {
        console.log("[planGroupActions] 저장된 daily_schedule 기간 불일치:", {
          stored: { first: firstDate, last: lastDate },
          expected: { first: periodStart, last: periodEnd },
        });
        return false;
      }
    }

    // 기본 구조 확인: 각 항목에 필수 필드가 있는지 확인
    const hasRequiredFields = storedSchedule.every(
      (d) => d.date && d.day_type !== undefined && d.study_hours !== undefined
    );

    if (!hasRequiredFields) {
      console.log("[planGroupActions] 저장된 daily_schedule 필수 필드 누락");
      return false;
    }

    return true;
  };

  /**
   * 재계산 필요 여부 판단 함수
   * @param group 플랜 그룹 정보
   * @returns 재계산 필요 여부와 사용 가능한 저장된 daily_schedule
   */
  const shouldRecalculateDailySchedule = (group: {
    daily_schedule: any;
    period_start: string | null;
    period_end: string | null;
  }): {
    shouldRecalculate: boolean;
    storedSchedule: typeof dailySchedule | null;
  } => {
    // 저장된 daily_schedule이 없으면 재계산 필요
    if (
      !group.daily_schedule ||
      !Array.isArray(group.daily_schedule) ||
      group.daily_schedule.length === 0
    ) {
      console.log(
        "[planGroupActions] 저장된 daily_schedule이 없어 재계산 필요"
      );
      return { shouldRecalculate: true, storedSchedule: null };
    }

    // 유효성 검증
    const isValid = isValidDailySchedule(
      group.daily_schedule,
      group.period_start,
      group.period_end
    );

    if (isValid) {
      // 저장된 데이터 사용
      console.log(
        "[planGroupActions] 저장된 daily_schedule 사용:",
        group.daily_schedule.length,
        "일"
      );
      return {
        shouldRecalculate: false,
        storedSchedule: group.daily_schedule as typeof dailySchedule,
      };
    } else {
      // 유효하지 않으면 재계산
      console.log(
        "[planGroupActions] 저장된 daily_schedule이 유효하지 않아 재계산"
      );
      return { shouldRecalculate: true, storedSchedule: null };
    }
  };

  // 재계산 필요 여부 판단
  const { shouldRecalculate, storedSchedule } =
    shouldRecalculateDailySchedule(group);

  if (!shouldRecalculate && storedSchedule) {
    // 저장된 데이터 사용
    dailySchedule = storedSchedule;
  } else {
    // 재계산 필요
    // 저장된 데이터가 없으면 계산
    const { calculateAvailableDates } = await import(
      "@/lib/scheduler/calculateAvailableDates"
    );

    // 제외일 및 학원 일정 조회 (getPlanGroupWithDetails 사용 - 일관성 유지)
    let exclusions: Array<{
      exclusion_date: string;
      exclusion_type: string;
      reason?: string | null;
    }> = [];
    let academySchedules: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      academy_name?: string | null;
      subject?: string | null;
      travel_time?: number | null;
    }> = [];

    try {
      const result = await getPlanGroupWithDetails(
        groupId,
        user.userId,
        tenantId
      );
      exclusions = result.exclusions || [];
      academySchedules = result.academySchedules || [];
    } catch (error) {
      console.error(
        "[planGroupActions] 제외일/학원일정 조회 실패, 폴백 로직 사용:",
        error
      );

      // 폴백: 저장된 daily_schedule에서 exclusion 정보 추출
      if (group.daily_schedule && Array.isArray(group.daily_schedule)) {
        exclusions = group.daily_schedule
          .filter((d) => d.exclusion)
          .map((d) => ({
            exclusion_date: d.date,
            exclusion_type: d.exclusion!.exclusion_type,
            reason: d.exclusion!.reason || null,
          }));
        console.log(
          "[planGroupActions] 저장된 daily_schedule에서 제외일 정보 추출:",
          exclusions.length,
          "개"
        );
      }

      // 학원 일정은 별도 조회 시도
      try {
        const { data: academyData } = await supabase
          .from("student_academy_schedules")
          .select(
            "day_of_week, start_time, end_time, academy_name, subject, travel_time"
          )
          .eq("student_id", user.userId);

        if (academyData) {
          academySchedules = academyData;
        }
      } catch (academyError) {
        console.error(
          "[planGroupActions] 학원 일정 조회 실패 (무시됨):",
          academyError
        );
      }
    }

    // 기간 필터링 (제외일만)
    const filteredExclusions = (exclusions || []).filter((e) => {
      if (!group.period_start || !group.period_end) return true;
      return (
        e.exclusion_date >= group.period_start &&
        e.exclusion_date <= group.period_end
      );
    });

    // 블록 세트에서 기본 블록 정보 가져오기
    let baseBlocks: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];

    if (group.block_set_id) {
      const { data: blockSet } = await supabase
        .from("student_block_sets")
        .select("id, name, student_id")
        .eq("id", group.block_set_id)
        .maybeSingle();

      if (blockSet) {
        const blockSetOwnerId = blockSet.student_id;
        const { data: blockRows } = await supabase
          .from("student_block_schedule")
          .select("day_of_week, start_time, end_time")
          .eq("block_set_id", group.block_set_id)
          .eq("student_id", blockSetOwnerId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (blockRows && blockRows.length > 0) {
          baseBlocks = blockRows.map((b) => ({
            day_of_week: b.day_of_week || 0,
            start_time: b.start_time || "00:00",
            end_time: b.end_time || "00:00",
          }));
        }
      }
    }

    if (baseBlocks.length > 0 && group.period_start && group.period_end) {
      try {
        const scheduleResult = calculateAvailableDates(
          group.period_start,
          group.period_end,
          baseBlocks.map((b) => ({
            day_of_week: b.day_of_week,
            start_time: b.start_time,
            end_time: b.end_time,
          })),
          filteredExclusions.map((e) => ({
            exclusion_date: e.exclusion_date,
            exclusion_type: e.exclusion_type as
              | "휴가"
              | "개인사정"
              | "휴일지정"
              | "기타",
            reason: e.reason || undefined,
          })),
          (academySchedules || []).map((a) => ({
            day_of_week: a.day_of_week,
            start_time: a.start_time,
            end_time: a.end_time,
            academy_name: a.academy_name || undefined,
            subject: a.subject || undefined,
            travel_time: a.travel_time || undefined,
          })),
          (() => {
            const options = {
              scheduler_type: (group.scheduler_type || "자동스케줄러") as
                | "1730_timetable"
                | "자동스케줄러",
              scheduler_options: group.scheduler_options || null,
              use_self_study_with_blocks: true, // 블록이 있어도 자율학습 시간 포함
              enable_self_study_for_holidays:
                (group.scheduler_options as any)
                  ?.enable_self_study_for_holidays === true,
              enable_self_study_for_study_days:
                (group.scheduler_options as any)
                  ?.enable_self_study_for_study_days === true,
              lunch_time: (group.scheduler_options as any)?.lunch_time,
              camp_study_hours: (group.scheduler_options as any)
                ?.camp_study_hours,
              camp_self_study_hours: (group.scheduler_options as any)
                ?.camp_self_study_hours,
              designated_holiday_hours: (group.scheduler_options as any)
                ?.designated_holiday_hours,
            };

            // 디버깅: 전달된 옵션 확인
            console.log("[planGroupActions] calculateAvailableDates 옵션:", {
              enable_self_study_for_holidays:
                options.enable_self_study_for_holidays,
              enable_self_study_for_study_days:
                options.enable_self_study_for_study_days,
              camp_self_study_hours: options.camp_self_study_hours,
              designated_holiday_hours: options.designated_holiday_hours,
              use_self_study_with_blocks: options.use_self_study_with_blocks,
            });

            return options;
          })()
        );

        // daily_schedule 전체 정보 저장 (Step 2.5와 동일한 구조)
        dailySchedule = scheduleResult.daily_schedule.map((daily) => ({
          date: daily.date,
          day_type: daily.day_type,
          study_hours: daily.study_hours,
          time_slots: daily.time_slots, // 자율학습 시간이 포함된 time_slots
          exclusion: daily.exclusion,
          academy_schedules: daily.academy_schedules,
        }));

        // 디버깅: 자율학습 시간이 포함된 날짜 확인
        const selfStudyDays = dailySchedule.filter(
          (d) =>
            d.time_slots?.some((slot) => slot.type === "자율학습") ||
            (d.day_type === "지정휴일" && d.study_hours > 0)
        );

        console.log("[planGroupActions] daily_schedule 분석:", {
          총_날짜수: dailySchedule.length,
          자율학습_포함_날짜수: selfStudyDays.length,
          지정휴일_수: dailySchedule.filter((d) => d.day_type === "지정휴일")
            .length,
          학습일_수: dailySchedule.filter((d) => d.day_type === "학습일")
            .length,
          복습일_수: dailySchedule.filter((d) => d.day_type === "복습일")
            .length,
          time_slots_있는_날짜수: dailySchedule.filter(
            (d) => d.time_slots && d.time_slots.length > 0
          ).length,
        });

        if (selfStudyDays.length > 0) {
          console.log(
            "[planGroupActions] 자율학습 시간이 포함된 날짜:",
            selfStudyDays.length,
            "일"
          );
          selfStudyDays.forEach((d) => {
            const selfStudySlots =
              d.time_slots?.filter((slot) => slot.type === "자율학습") || [];
            console.log(
              `  - ${d.date} (${d.day_type}): 자율학습 슬롯 ${selfStudySlots.length}개`,
              selfStudySlots
            );
          });
        } else {
          console.warn(
            "[planGroupActions] ⚠️ 자율학습 시간이 포함된 날짜가 없습니다!"
          );
          console.log(
            "[planGroupActions] time_slots 샘플 (첫 3개 날짜):",
            dailySchedule.slice(0, 3).map((d) => ({
              date: d.date,
              day_type: d.day_type,
              time_slots_count: d.time_slots?.length || 0,
              time_slots_types: d.time_slots?.map((s) => s.type) || [],
            }))
          );
        }

        // 계산한 결과를 저장 (다음 조회 시 사용)
        const { error: updateScheduleError } = await supabase
          .from("plan_groups")
          .update({ daily_schedule: dailySchedule })
          .eq("id", groupId)
          .eq("student_id", user.userId);

        if (updateScheduleError) {
          console.error(
            "[planGroupActions] dailySchedule 저장 실패",
            updateScheduleError
          );
          // 저장 실패해도 계속 진행
        }
      } catch (error) {
        console.error("[planGroupActions] daily_schedule 조회 실패", error);
        // daily_schedule 조회 실패해도 계속 진행
      }
    }
  }

  // dateTimeSlots 생성 (dailySchedule의 time_slots를 날짜별로 매핑)
  const dateTimeSlots: Record<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
  > = {};

  dailySchedule.forEach((daily) => {
    if (daily.time_slots && daily.time_slots.length > 0) {
      dateTimeSlots[daily.date] = daily.time_slots;
    }
  });

  return {
    plans: (plans || []).map((p) => ({
      id: p.id,
      plan_date: p.plan_date || "",
      block_index: p.block_index,
      content_type: p.content_type || "",
      content_id: p.content_id || "",
      chapter: p.chapter,
      planned_start_page_or_time: p.planned_start_page_or_time,
      planned_end_page_or_time: p.planned_end_page_or_time,
      completed_amount: p.completed_amount,
    })),
    periodStart: group.period_start || "",
    periodEnd: group.period_end || "",
    schedulerType: group.scheduler_type || null,
    schedulerOptions: group.scheduler_options || null,
    contents: Array.from(contentsMap.values()),
    blocks,
    dateTimeSlots, // 날짜별 time_slots 매핑
    dailySchedule, // Step 2.5와 동일한 daily_schedule 구조
  };
}

export const getScheduleResultDataAction = withErrorHandling(
  _getScheduleResultData
);

/**
 * 시간 문자열을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 플랜 그룹 제외일 추가
 */
async function _addPlanExclusion(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  const exclusionDate = formData.get("exclusion_date");
  const exclusionType = formData.get("exclusion_type");
  const reason = formData.get("reason");
  const planGroupId = formData.get("plan_group_id");

  if (!exclusionDate || typeof exclusionDate !== "string") {
    throw new AppError(
      "제외일을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!exclusionType || typeof exclusionType !== "string") {
    throw new AppError(
      "제외 유형을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // plan_group_id가 제공되지 않으면 활성 플랜 그룹 찾기
  let targetGroupId =
    planGroupId && typeof planGroupId === "string" ? planGroupId : null;

  if (!targetGroupId) {
    const supabase = await createSupabaseServerClient();
    const { data: activeGroup } = await supabase
      .from("plan_groups")
      .select("id")
      .eq("student_id", user.userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (activeGroup) {
      targetGroupId = activeGroup.id;
    } else {
      // 활성 플랜 그룹이 없으면 가장 최근 draft 또는 saved 플랜 그룹 사용
      const { data: recentGroup } = await supabase
        .from("plan_groups")
        .select("id")
        .eq("student_id", user.userId)
        .in("status", ["draft", "saved"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentGroup) {
        targetGroupId = recentGroup.id;
      } else {
        throw new AppError(
          "제외일을 추가하려면 먼저 플랜 그룹을 생성해주세요.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }
  }

  if (!targetGroupId) {
    throw new AppError(
      "제외일을 추가하려면 먼저 플랜 그룹을 생성해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 플랜 그룹별로 제외일 추가
  const result = await createPlanExclusions(
    targetGroupId,
    tenantContext.tenantId,
    [
      {
        exclusion_date: exclusionDate,
        exclusion_type: exclusionType,
        reason: reason && typeof reason === "string" ? reason.trim() : null,
      },
    ]
  );

  if (!result.success) {
    throw new AppError(
      result.error || "제외일 추가에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const addPlanExclusion = withErrorHandling(_addPlanExclusion);

/**
 * 플랜 그룹 제외일 삭제
 */
async function _deletePlanExclusion(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const exclusionId = formData.get("exclusion_id");

  if (!exclusionId || typeof exclusionId !== "string") {
    throw new AppError(
      "제외일 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 제외일 소유권 확인 (student_id 기반)
  const { data: exclusion, error: fetchError } = await supabase
    .from("plan_exclusions")
    .select("student_id")
    .eq("id", exclusionId)
    .single();

  if (fetchError || !exclusion) {
    throw new AppError(
      "제외일을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생 소유권 확인
  if (exclusion.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  const { error } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("id", exclusionId);

  if (error) {
    throw new AppError(
      error.message || "제외일 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const deletePlanExclusion = withErrorHandling(_deletePlanExclusion);

/**
 * 플랜 그룹 학원 일정 추가
 */
async function _addAcademySchedule(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  const dayOfWeek = formData.get("day_of_week");
  const startTime = formData.get("start_time");
  const endTime = formData.get("end_time");
  const academyName = formData.get("academy_name");
  const subject = formData.get("subject");

  if (!dayOfWeek || typeof dayOfWeek !== "string") {
    throw new AppError(
      "요일을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!startTime || typeof startTime !== "string") {
    throw new AppError(
      "시작 시간을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!endTime || typeof endTime !== "string") {
    throw new AppError(
      "종료 시간을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!academyName || typeof academyName !== "string" || !academyName.trim()) {
    throw new AppError(
      "학원 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    throw new AppError(
      "과목을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const day = Number.parseInt(dayOfWeek, 10);
  if (Number.isNaN(day) || day < 0 || day > 6) {
    throw new AppError(
      "올바른 요일을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (startTime >= endTime) {
    throw new AppError(
      "종료 시간은 시작 시간보다 늦어야 합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 학생별 전역 관리로 변경 (플랜 그룹과 분리)
  const result = await createStudentAcademySchedules(
    user.userId,
    tenantContext.tenantId,
    [
      {
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        academy_name:
          academyName && typeof academyName === "string"
            ? academyName.trim()
            : null,
        subject: subject && typeof subject === "string" ? subject.trim() : null,
      },
    ]
  );

  if (!result.success) {
    throw new AppError(
      result.error || "학원 일정 추가에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const addAcademySchedule = withErrorHandling(_addAcademySchedule);

/**
 * 플랜 그룹 학원 일정 수정
 */
async function _updateAcademySchedule(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const scheduleId = formData.get("schedule_id");
  const dayOfWeek = formData.get("day_of_week");
  const startTime = formData.get("start_time");
  const endTime = formData.get("end_time");
  const academyName = formData.get("academy_name");
  const subject = formData.get("subject");

  if (!scheduleId || typeof scheduleId !== "string") {
    throw new AppError(
      "학원 일정 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!dayOfWeek || typeof dayOfWeek !== "string") {
    throw new AppError(
      "요일을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!startTime || typeof startTime !== "string") {
    throw new AppError(
      "시작 시간을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!endTime || typeof endTime !== "string") {
    throw new AppError(
      "종료 시간을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!academyName || typeof academyName !== "string" || !academyName.trim()) {
    throw new AppError(
      "학원 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    throw new AppError(
      "과목을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const day = Number.parseInt(dayOfWeek, 10);
  if (Number.isNaN(day) || day < 0 || day > 6) {
    throw new AppError(
      "올바른 요일을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (startTime >= endTime) {
    throw new AppError(
      "종료 시간은 시작 시간보다 늦어야 합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 학원 일정 소유권 확인 (student_id 기반)
  const { data: schedule, error: fetchError } = await supabase
    .from("academy_schedules")
    .select("student_id,tenant_id")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) {
    throw new AppError(
      "학원 일정을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생 소유권 확인
  if (schedule.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  // academy_name으로 academy 찾기 또는 생성
  const trimmedAcademyName = academyName.trim();
  const { data: existingAcademy } = await supabase
    .from("academies")
    .select("id")
    .eq("student_id", schedule.student_id)
    .eq("name", trimmedAcademyName)
    .maybeSingle();

  let academyId: string;

  if (existingAcademy) {
    academyId = existingAcademy.id;
  } else {
    // 새 academy 생성
    const { data: newAcademy, error: academyError } = await supabase
      .from("academies")
      .insert({
        student_id: schedule.student_id,
        tenant_id: schedule.tenant_id,
        name: trimmedAcademyName,
        travel_time: 60, // 기본값
      })
      .select("id")
      .single();

    if (academyError || !newAcademy) {
      throw new AppError(
        academyError?.message || "학원 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { supabaseError: academyError }
      );
    }

    academyId = newAcademy.id;
  }

  const { error } = await supabase
    .from("academy_schedules")
    .update({
      academy_id: academyId,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      academy_name: trimmedAcademyName, // 하위 호환성
      subject: subject.trim(),
    })
    .eq("id", scheduleId);

  if (error) {
    throw new AppError(
      error.message || "학원 일정 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const updateAcademySchedule = withErrorHandling(_updateAcademySchedule);

/**
 * 플랜 그룹 학원 일정 삭제
 */
async function _deleteAcademySchedule(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const scheduleId = formData.get("schedule_id");

  if (!scheduleId || typeof scheduleId !== "string") {
    throw new AppError(
      "학원 일정 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 학원 일정 소유권 확인 (student_id 기반)
  const { data: schedule, error: fetchError } = await supabase
    .from("academy_schedules")
    .select("student_id")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) {
    throw new AppError(
      "학원 일정을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생 소유권 확인
  if (schedule.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  const { error } = await supabase
    .from("academy_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) {
    throw new AppError(
      error.message || "학원 일정 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const deleteAcademySchedule = withErrorHandling(_deleteAcademySchedule);

/**
 * 플랜 그룹 학원 일정 조회
 */
async function _getAcademySchedules(
  planGroupId: string
): Promise<AcademySchedule[]> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const tenantContext = await getTenantContext();

  // 플랜 그룹 소유권 확인 (학원 일정은 학생별 전역 관리이지만, 플랜 그룹 소유권은 확인)
  const group = await getPlanGroupById(
    planGroupId,
    user.userId,
    tenantContext?.tenantId || null
  );
  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생별 전역 학원 일정 조회
  const schedules = await getStudentAcademySchedules(
    user.userId,
    tenantContext?.tenantId || null
  );
  return schedules;
}

export const getAcademySchedulesAction =
  withErrorHandling(_getAcademySchedules);

/**
 * 학원 생성
 */
async function _createAcademy(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
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

  const name = formData.get("name");
  const travelTime = formData.get("travel_time");

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new AppError(
      "학원 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const travelTimeNum = travelTime
    ? Number.parseInt(String(travelTime), 10)
    : 60;
  if (Number.isNaN(travelTimeNum) || travelTimeNum < 0) {
    throw new AppError(
      "이동시간은 0 이상의 숫자여야 합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 중복 체크: 같은 이름의 학원이 이미 있는지 확인
  const { data: existingAcademy } = await supabase
    .from("academies")
    .select("id")
    .eq("student_id", user.userId)
    .eq("name", name.trim())
    .maybeSingle();

  if (existingAcademy) {
    throw new AppError(
      "이미 같은 이름의 학원이 등록되어 있습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const { error } = await supabase.from("academies").insert({
    student_id: user.userId,
    tenant_id: tenantContext.tenantId,
    name: name.trim(),
    travel_time: travelTimeNum,
  });

  if (error) {
    throw new AppError(
      error.message || "학원 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const createAcademy = withErrorHandling(_createAcademy);

/**
 * 학원 수정
 */
async function _updateAcademy(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const academyId = formData.get("academy_id");
  const name = formData.get("name");
  const travelTime = formData.get("travel_time");

  if (!academyId || typeof academyId !== "string") {
    throw new AppError(
      "학원 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new AppError(
      "학원 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const travelTimeNum = travelTime
    ? Number.parseInt(String(travelTime), 10)
    : 60;
  if (Number.isNaN(travelTimeNum) || travelTimeNum < 0) {
    throw new AppError(
      "이동시간은 0 이상의 숫자여야 합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 학원 소유권 확인
  const { data: academy, error: fetchError } = await supabase
    .from("academies")
    .select("student_id")
    .eq("id", academyId)
    .single();

  if (fetchError || !academy) {
    throw new AppError(
      "학원을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (academy.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  // 이름 중복 체크 (자기 자신 제외)
  const { data: existingAcademy } = await supabase
    .from("academies")
    .select("id")
    .eq("student_id", user.userId)
    .eq("name", name.trim())
    .neq("id", academyId)
    .maybeSingle();

  if (existingAcademy) {
    throw new AppError(
      "이미 같은 이름의 학원이 등록되어 있습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const { error } = await supabase
    .from("academies")
    .update({
      name: name.trim(),
      travel_time: travelTimeNum,
    })
    .eq("id", academyId);

  if (error) {
    throw new AppError(
      error.message || "학원 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const updateAcademy = withErrorHandling(_updateAcademy);

/**
 * 학원 삭제
 */
async function _deleteAcademy(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const academyId = formData.get("academy_id");

  if (!academyId || typeof academyId !== "string") {
    throw new AppError(
      "학원 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 학원 소유권 확인
  const { data: academy, error: fetchError } = await supabase
    .from("academies")
    .select("student_id")
    .eq("id", academyId)
    .single();

  if (fetchError || !academy) {
    throw new AppError(
      "학원을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (academy.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  // CASCADE로 academy_schedules도 함께 삭제됨
  const { error } = await supabase
    .from("academies")
    .delete()
    .eq("id", academyId);

  if (error) {
    throw new AppError(
      error.message || "학원 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const deleteAcademy = withErrorHandling(_deleteAcademy);

/**
 * 활성 상태인 다른 플랜 그룹 조회
 */
async function _getActivePlanGroups(
  excludeGroupId?: string
): Promise<Array<{ id: string; name: string | null }>> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_groups")
    .select("id, name")
    .eq("student_id", user.userId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (excludeGroupId) {
    query = query.neq("id", excludeGroupId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      "활성 플랜 그룹 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return data || [];
}

export const getActivePlanGroups = withErrorHandling(_getActivePlanGroups);
