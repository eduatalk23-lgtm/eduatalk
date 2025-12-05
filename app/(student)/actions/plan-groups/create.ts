"use server";

import { revalidatePath } from "next/cache";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { formatDateString } from "@/lib/date/calendarUtils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createPlanGroup,
  deletePlanGroup,
  getPlanGroupWithDetails,
  createPlanContents,
  createPlanExclusions,
  createPlanAcademySchedules,
} from "@/lib/data/planGroups";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";
import { PlanGroupCreationData } from "@/lib/types/plan";
import { normalizePlanPurpose } from "./utils";

/**
 * 플랜 그룹 생성 (JSON 데이터)
 */
async function _createPlanGroup(
  data: PlanGroupCreationData,
  options?: {
    skipContentValidation?: boolean; // 캠프 모드에서 Step 3 제출 시 콘텐츠 검증 건너뛰기
  }
): Promise<{ groupId: string }> {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  // 검증
  const validation = PlanValidator.validateCreation(data, options);
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
  
  // template_block_set_id 보호 (캠프 모드에서 중요)
  const templateBlockSetId = (mergedSchedulerOptions as any).template_block_set_id;
  
  if (data.time_settings) {
    Object.assign(mergedSchedulerOptions, data.time_settings);
    
    // template_block_set_id가 덮어씌워졌는지 확인하고 복원
    if (templateBlockSetId && !(mergedSchedulerOptions as any).template_block_set_id) {
      console.warn("[_createPlanGroup] template_block_set_id가 time_settings 병합 시 덮어씌워짐, 복원:", {
        template_block_set_id: templateBlockSetId,
      });
      (mergedSchedulerOptions as any).template_block_set_id = templateBlockSetId;
    }
  }
  
  // 최종 확인
  if ((mergedSchedulerOptions as any).template_block_set_id) {
    console.log("[_createPlanGroup] 최종 mergedSchedulerOptions에 template_block_set_id 보존됨:", {
      template_block_set_id: (mergedSchedulerOptions as any).template_block_set_id,
    });
  }

  // study_review_cycle을 scheduler_options에 병합
  if (data.study_review_cycle) {
    mergedSchedulerOptions.study_days = data.study_review_cycle.study_days;
    mergedSchedulerOptions.review_days = data.study_review_cycle.review_days;
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
    subject_constraints: data.subject_constraints || null,
    additional_period_reallocation: data.additional_period_reallocation || null,
    non_study_time_blocks: data.non_study_time_blocks || null,
    daily_schedule: data.daily_schedule || null,
    // 캠프 관련 필드
    plan_type: data.plan_type || null,
    camp_template_id: data.camp_template_id || null,
    camp_invitation_id: data.camp_invitation_id || null,
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

  // 학생 콘텐츠의 master_content_id 조회 (배치 조회)
  const supabase = await createSupabaseServerClient();
  const masterContentIdMap = new Map<string, string | null>();
  const bookIds = data.contents
    .filter((c) => c.content_type === "book")
    .map((c) => c.content_id);
  const lectureIds = data.contents
    .filter((c) => c.content_type === "lecture")
    .map((c) => c.content_id);

  if (bookIds.length > 0) {
    const { data: books } = await supabase
      .from("books")
      .select("id, master_content_id")
      .in("id", bookIds)
      .eq("student_id", user.userId);
    books?.forEach((book) => {
      masterContentIdMap.set(book.id, book.master_content_id || null);
    });
  }

  if (lectureIds.length > 0) {
    const { data: lectures } = await supabase
      .from("lectures")
      .select("id, master_content_id")
      .in("id", lectureIds)
      .eq("student_id", user.userId);
    lectures?.forEach((lecture) => {
      masterContentIdMap.set(lecture.id, lecture.master_content_id || null);
    });
  }

  // 마스터 콘텐츠 ID를 그대로 저장 (복사는 플랜 생성 시에만 수행)
  // 이렇게 하면 불러올 때 마스터 콘텐츠로 올바르게 인식할 수 있음
  const processedContents = data.contents.map((c) => ({
    content_type: c.content_type,
    content_id: c.content_id, // 마스터 콘텐츠 ID 그대로 저장
    // 이미 설정된 master_content_id가 있으면 우선 사용 (planGroupDataSync에서 설정)
    // 없으면 학생 콘텐츠의 master_content_id 조회
    master_content_id: c.master_content_id ?? (masterContentIdMap.get(c.content_id) || null),
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
      createPlanAcademySchedules(
        groupId,
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

export const createPlanGroupAction = withErrorHandling(
  async (
    data: PlanGroupCreationData,
    options?: {
      skipContentValidation?: boolean;
    }
  ) => {
    return _createPlanGroup(data, options);
  }
);

/**
 * 플랜 그룹 임시저장 (draft 상태로 저장, 검증 완화)
 */
async function _savePlanGroupDraft(
  data: PlanGroupCreationData
): Promise<{ groupId: string }> {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  // 최소 검증만 수행 (이름만 필수)
  if (!data.name || data.name.trim() === "") {
    throw new AppError(
      "플랜 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // camp_invitation_id가 있는 경우, 기존 draft를 먼저 확인
  // 자동저장 시 중복 생성 방지
  if (data.camp_invitation_id) {
    const supabase = await createSupabaseServerClient();
    const { data: existingGroup, error: checkError } = await supabase
      .from("plan_groups")
      .select("id, status")
      .eq("camp_invitation_id", data.camp_invitation_id)
      .eq("student_id", user.userId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116은 "multiple rows" 에러인데, 이는 이미 처리됨 (limit(1) 사용)
      console.error("[savePlanGroupDraft] 기존 플랜 그룹 확인 중 에러:", checkError);
      // 에러가 있어도 계속 진행 (새로 생성 시도)
    }

    // 기존 draft가 있으면 업데이트
    if (existingGroup && existingGroup.status === "draft") {
      const { updatePlanGroupDraftAction } = await import("./update");
      await updatePlanGroupDraftAction(existingGroup.id, data);
      revalidatePath("/plan");
      return { groupId: existingGroup.id };
    }
  }

  // 플랜 그룹 생성 (draft 상태)
  // time_settings를 scheduler_options에 병합
  const mergedSchedulerOptions = data.scheduler_options || {};
  if (data.time_settings) {
    Object.assign(mergedSchedulerOptions, data.time_settings);
  }

  // study_review_cycle을 scheduler_options에 병합
  if (data.study_review_cycle) {
    mergedSchedulerOptions.study_days = data.study_review_cycle.study_days;
    mergedSchedulerOptions.review_days = data.study_review_cycle.review_days;
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
    period_start: data.period_start || formatDateString(new Date()),
    period_end:
      data.period_end ||
      formatDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    target_date: data.target_date || null,
    block_set_id: data.block_set_id || null,
    status: "draft",
    subject_constraints: data.subject_constraints || null,
    additional_period_reallocation: data.additional_period_reallocation || null,
    non_study_time_blocks: data.non_study_time_blocks || null,
    daily_schedule: data.daily_schedule || null,
    // 캠프 관련 필드
    plan_type: data.plan_type || null,
    camp_template_id: data.camp_template_id || null,
    camp_invitation_id: data.camp_invitation_id || null,
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
      const isDuplicateError = exclusionsResult.error?.includes("이미 등록된 제외일");
      throw new AppError(
        exclusionsResult.error || "제외일 저장에 실패했습니다.",
        isDuplicateError ? ErrorCode.VALIDATION_ERROR : ErrorCode.DATABASE_ERROR,
        isDuplicateError ? 400 : 500,
        true
      );
    }
  }

  if (data.academy_schedules && data.academy_schedules.length > 0) {
    await createPlanAcademySchedules(
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
  }

  revalidatePath("/plan");
  return { groupId };
}

export const savePlanGroupDraftAction = withErrorHandling(_savePlanGroupDraft);

/**
 * 플랜 그룹 복사
 */
async function _copyPlanGroup(groupId: string): Promise<{ groupId: string }> {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

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
    subject_constraints: (group as any).subject_constraints || null,
    additional_period_reallocation: (group as any).additional_period_reallocation || null,
    non_study_time_blocks: (group as any).non_study_time_blocks || null,
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

