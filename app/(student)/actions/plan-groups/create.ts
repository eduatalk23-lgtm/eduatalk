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
import { normalizePlanPurpose, findExistingDraftPlanGroup } from "./utils";
import { mergeTimeSettingsSafely, mergeStudyReviewCycle } from "@/lib/utils/schedulerOptionsMerge";
import { PlanGroupError, PlanGroupErrorCodes, ErrorUserMessages } from "@/lib/errors/planGroupErrors";
import { updatePlanGroupDraftAction } from "./update";

/**
 * 플랜 그룹을 생성하는 내부 함수입니다.
 *
 * 이 함수는 다음 작업을 수행합니다:
 * 1. 사용자 인증 및 테넌트 컨텍스트 확인
 * 2. 입력 데이터 검증 (PlanValidator 사용)
 * 3. time_settings를 scheduler_options에 안전하게 병합 (보호 필드 보호)
 * 4. study_review_cycle을 scheduler_options에 병합
 * 5. 플랜 그룹 생성
 * 6. 플랜 콘텐츠, 제외일, 학원 일정 생성
 * 7. 실패 시 롤백 처리
 *
 * @param data 플랜 그룹 생성 데이터
 * @param options 옵션 객체
 * @param options.skipContentValidation 콘텐츠 검증 건너뛰기 (캠프 모드에서 Step 3 제출 시 사용)
 * @returns 생성된 플랜 그룹 ID
 * @throws AppError - 검증 실패 또는 데이터베이스 오류 시
 *
 * @example
 * ```typescript
 * const result = await _createPlanGroup({
 *   name: "2025년 1학기 학습 계획",
 *   plan_purpose: "내신대비",
 *   scheduler_type: "1730_timetable",
 *   period_start: "2025-01-01",
 *   period_end: "2025-06-30",
 *   // ... 기타 필드
 * });
 * console.log("생성된 플랜 그룹 ID:", result.groupId);
 * ```
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
  // time_settings를 scheduler_options에 안전하게 병합 (보호 필드 자동 보호)
  let mergedSchedulerOptions = mergeTimeSettingsSafely(
    data.scheduler_options || {},
    data.time_settings
  );

  // study_review_cycle을 scheduler_options에 병합
  mergedSchedulerOptions = mergeStudyReviewCycle(
    mergedSchedulerOptions,
    data.study_review_cycle
  );

  // daily_schedule 검증 (time_slots 포함 여부 확인)
  if (data.daily_schedule && Array.isArray(data.daily_schedule)) {
    const missingTimeSlots = data.daily_schedule.filter(
      (day) => !day.time_slots || day.time_slots.length === 0
    );

    if (missingTimeSlots.length > 0) {
      const missingDates = missingTimeSlots.map((d) => d.date);
      throw new PlanGroupError(
        `daily_schedule에 time_slots가 없는 날짜가 있습니다: ${missingDates.join(", ")}`,
        PlanGroupErrorCodes.SCHEDULE_CALCULATION_FAILED,
        ErrorUserMessages[PlanGroupErrorCodes.SCHEDULE_CALCULATION_FAILED],
        false,
        {
          missingDates,
          totalDays: data.daily_schedule.length,
          missingCount: missingTimeSlots.length,
        }
      );
    }
  }

  // 기존 draft 확인 (중복 생성 방지)
  // draftGroupId가 없어도 동일한 이름의 draft가 있으면 업데이트
  const supabase = await createSupabaseServerClient();
  const existingGroup = await findExistingDraftPlanGroup(
    supabase,
    user.userId,
    data.name || null,
    data.camp_invitation_id || null
  );

  // 기존 draft가 있으면 업데이트
  if (existingGroup) {
    await updatePlanGroupDraftAction(existingGroup.id, data);
    revalidatePath("/plan");
    return { groupId: existingGroup.id };
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

/**
 * 플랜 그룹 생성을 위한 Server Action입니다.
 *
 * `withErrorHandling`으로 래핑되어 있어 에러가 자동으로 로깅되고 처리됩니다.
 * 개발 환경에서만 입력 데이터를 로깅합니다.
 *
 * @param data 플랜 그룹 생성 데이터
 * @param options 옵션 객체
 * @param options.skipContentValidation 콘텐츠 검증 건너뛰기 (캠프 모드에서 Step 3 제출 시 사용)
 * @returns 생성된 플랜 그룹 ID 또는 에러 정보
 *
 * @example
 * ```typescript
 * // 클라이언트 컴포넌트에서 사용
 * const result = await createPlanGroupAction({
 *   name: "2025년 1학기 학습 계획",
 *   // ... 기타 필드
 * });
 * if (result.success) {
 *   router.push(`/plan/${result.groupId}`);
 * }
 * ```
 */
export const createPlanGroupAction = withErrorHandling(
  async (
    data: PlanGroupCreationData,
    options?: {
      skipContentValidation?: boolean;
    }
  ) => {
    // 입력 데이터 로깅 (개발 환경에서만, 민감 정보 제외)
    if (process.env.NODE_ENV === "development") {
      console.log("[createPlanGroupAction] 플랜 그룹 생성 시작:", {
        name: data.name,
        plan_purpose: data.plan_purpose,
        scheduler_type: data.scheduler_type,
        period_start: data.period_start,
        period_end: data.period_end,
        block_set_id: data.block_set_id,
        contents_count: data.contents?.length || 0,
        exclusions_count: data.exclusions?.length || 0,
        academy_schedules_count: data.academy_schedules?.length || 0,
        skipContentValidation: options?.skipContentValidation,
      });
    }

    return await _createPlanGroup(data, options);
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

  // 기존 draft 확인 (중복 생성 방지)
  // camp_invitation_id가 있든 없든 동일한 이름의 draft가 있으면 업데이트
  const supabase = await createSupabaseServerClient();
  const existingGroup = await findExistingDraftPlanGroup(
    supabase,
    user.userId,
    data.name,
    data.camp_invitation_id || null
  );

  // 기존 draft가 있으면 업데이트
  if (existingGroup) {
    await updatePlanGroupDraftAction(existingGroup.id, data);
    revalidatePath("/plan");
    return { groupId: existingGroup.id };
  }

  // 플랜 그룹 생성 (draft 상태)
  // time_settings를 scheduler_options에 안전하게 병합 (보호 필드 자동 보호)
  let mergedSchedulerOptions = mergeTimeSettingsSafely(
    data.scheduler_options || {},
    data.time_settings
  );

  // study_review_cycle을 scheduler_options에 병합
  mergedSchedulerOptions = mergeStudyReviewCycle(
    mergedSchedulerOptions,
    data.study_review_cycle
  );

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
    scheduler_options: group.scheduler_options ?? null,
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date,
    block_set_id: group.block_set_id,
    status: "draft",
    subject_constraints: group.subject_constraints ?? null,
    additional_period_reallocation: group.additional_period_reallocation ?? null,
    non_study_time_blocks: group.non_study_time_blocks ?? null,
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

