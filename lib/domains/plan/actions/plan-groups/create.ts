"use server";

import { revalidatePath } from "next/cache";
import { logActionSuccess, logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
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
import {
  deletePlanContentsByGroupId,
  deleteExclusionsByGroupId,
  deleteAcademySchedulesByGroupId,
  deleteStudentPlansByGroupId,
  deletePlanGroupItemsByGroupId,
  checkPlanPeriodOverlap,
} from "@/lib/domains/plan/repository";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";
import { PlanGroupCreationData } from "@/lib/types/plan";
import { normalizePlanPurpose, findExistingDraftPlanGroup } from "./utils";
import { mergeTimeSettingsSafely, mergeStudyReviewCycle } from "@/lib/utils/schedulerOptionsMerge";
import { updatePlanGroupDraftAction } from "./update";
import { validateAllocations } from "@/lib/utils/subjectAllocation";
import { buildAllocationFromSlots } from "@/lib/plan/virtualSchedulePreview";
import {
  getHigherPriorityExclusionType,
} from "@/lib/utils/exclusionHierarchy";
import { DAYS_PER_WEEK, MILLISECONDS_PER_DAY } from "@/lib/utils/time";

/**
 * 플랜 그룹 생성 실패 시 관련 데이터를 모두 롤백합니다.
 * 삭제 순서 (자식 → 부모): student_plan → plan_group_items → contents → exclusions → academy_schedules → plan_group
 *
 * CASCADE DELETE가 설정되어 있지만, soft delete 시에는 수동 정리가 필요합니다.
 */
async function rollbackPlanGroupCreation(
  groupId: string,
  studentId: string
): Promise<void> {
  logActionDebug(
    { domain: "plan", action: "rollbackPlanGroupCreation" },
    "플랜 그룹 롤백 시작",
    { groupId, studentId }
  );

  try {
    // 1. 모든 자식 테이블 데이터 삭제 (병렬 처리, 개별 에러 처리)
    const deleteResults = await Promise.allSettled([
      deleteStudentPlansByGroupId(groupId, studentId),
      deletePlanGroupItemsByGroupId(groupId),
      deletePlanContentsByGroupId(groupId),
      deleteExclusionsByGroupId(groupId),
      deleteAcademySchedulesByGroupId(groupId),
    ]);

    // 삭제 결과 로깅
    const tableNames = ["student_plan", "plan_group_items", "plan_contents", "plan_exclusions", "academy_schedules"];
    deleteResults.forEach((result, index) => {
      if (result.status === "rejected") {
        logActionError(
          { domain: "plan", action: "rollbackPlanGroupCreation" },
          result.reason,
          { table: tableNames[index], groupId }
        );
      }
    });

    // 2. plan_group 삭제 (soft delete)
    await deletePlanGroup(groupId, studentId);
    logActionSuccess(
      { domain: "plan", action: "rollbackPlanGroupCreation" },
      { groupId }
    );
  } catch (error) {
    logActionError(
      { domain: "plan", action: "rollbackPlanGroupCreation" },
      error,
      { groupId, studentId }
    );
    // 롤백 실패는 무시하고 원래 에러를 전파
  }
}

/**
 * 원자적 플랜 그룹 생성을 위한 RPC 호출 헬퍼
 *
 * 이 함수는 Supabase RPC를 통해 plan_groups, plan_contents, plan_exclusions,
 * academy_schedules를 하나의 트랜잭션 내에서 생성합니다.
 * 어떤 단계에서든 실패하면 전체 트랜잭션이 자동으로 롤백됩니다.
 */
interface AtomicCreateResult {
  success: boolean;
  groupId?: string;
  error?: string;
  errorCode?: string;
}

interface PlanGroupAtomicInput {
  name: string | null;
  plan_purpose: string | null;
  scheduler_type: string | null;
  scheduler_options: Record<string, unknown> | null;
  period_start: string;
  period_end: string;
  target_date: string | null;
  block_set_id: string | null;
  status: string;
  subject_constraints: Record<string, unknown> | null;
  additional_period_reallocation: Record<string, unknown> | null;
  non_study_time_blocks: Record<string, unknown>[] | null;
  daily_schedule: Record<string, unknown>[] | null;
  plan_type: string | null;
  camp_template_id: string | null;
  camp_invitation_id: string | null;
  use_slot_mode: boolean;
  content_slots: Record<string, unknown>[] | null;
}

interface ContentInput {
  content_type: string;
  content_id: string;
  master_content_id: string | null;
  start_range: number | null;
  end_range: number | null;
  display_order: number;
}

interface ExclusionInput {
  exclusion_date: string;
  exclusion_type: string;
  reason: string | null;
}

interface ScheduleInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name: string | null;
  subject: string | null;
  travel_time: number;
  source: string;
  is_locked: boolean;
}

async function createPlanGroupAtomic(
  tenantId: string,
  studentId: string,
  planGroup: PlanGroupAtomicInput,
  contents: ContentInput[],
  exclusions: ExclusionInput[],
  schedules: ScheduleInput[]
): Promise<AtomicCreateResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_plan_group_atomic", {
    p_tenant_id: tenantId,
    p_student_id: studentId,
    p_plan_group: planGroup,
    p_contents: contents,
    p_exclusions: exclusions,
    p_schedules: schedules,
  });

  if (error) {
    logActionError(
      { domain: "plan", action: "createPlanGroupAtomic" },
      error,
      { tenantId, studentId, errorCode: error.code }
    );
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
    };
  }

  // RPC 결과 파싱 (JSONB 반환)
  const result = data as { success: boolean; group_id?: string; error?: string; error_code?: string };

  if (!result.success) {
    logActionError(
      { domain: "plan", action: "createPlanGroupAtomic" },
      result.error,
      { tenantId, studentId, errorCode: result.error_code }
    );
    return {
      success: false,
      error: result.error || "원자적 플랜 그룹 생성에 실패했습니다.",
      errorCode: result.error_code,
    };
  }

  logActionSuccess(
    { domain: "plan", action: "createPlanGroupAtomic" },
    { groupId: result.group_id, tenantId, studentId }
  );
  return {
    success: true,
    groupId: result.group_id,
  };
}

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
 * @param options.studentId 관리자 모드에서 지정하는 student_id
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
    studentId?: string | null; // 관리자 모드에서 직접 지정하는 student_id
  }
): Promise<{ groupId: string }> {
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

  let studentId: string;
  let userId: string;

  // 관리자/컨설턴트 권한 확인
  const isAdmin = currentUser.role === "admin" || currentUser.role === "consultant";
  
  if (isAdmin) {
    // 관리자 모드: student_id를 옵션에서 가져오거나 에러
    await requireAdminOrConsultant();
    userId = currentUser.userId;

    if (options?.studentId) {
      studentId = options.studentId;
    } else {
      throw new AppError(
        "관리자 모드에서는 student_id가 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  } else {
    // 학생 모드: 현재 사용자가 학생
    const studentAuth = await requireStudentAuth();
    studentId = studentAuth.userId;
    userId = studentAuth.userId;
  }

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

  // Dual Write: 슬롯 모드일 때 content_slots에서 subject_allocations 자동 생성
  if (data.use_slot_mode && data.content_slots && data.content_slots.length > 0) {
    const generatedAllocations = buildAllocationFromSlots(data.content_slots);
    if (generatedAllocations.length > 0) {
      // 기존 subject_allocations가 없거나 빈 배열이면 생성된 것으로 교체
      if (!mergedSchedulerOptions.subject_allocations || mergedSchedulerOptions.subject_allocations.length === 0) {
        mergedSchedulerOptions = {
          ...mergedSchedulerOptions,
          subject_allocations: generatedAllocations,
        };
        logActionDebug(
          { domain: "plan", action: "createPlanGroup", userId: studentId },
          "Dual Write: content_slots에서 subject_allocations 자동 생성",
          { slotCount: data.content_slots.length, allocationCount: generatedAllocations.length }
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
      logActionDebug(
        { domain: "plan", action: "createPlanGroup", userId: studentId },
        "전략과목/취약과목 설정 검증 실패 (계속 진행)",
        { errors: validation.errors, subjectAllocations, contentAllocations }
      );
    }
  }

  // daily_schedule 검증 (time_slots 포함 여부 확인)
  // 제외일이 있는 날짜(휴가, 개인일정)는 time_slots가 빈 배열이어도 허용
  if (data.daily_schedule && Array.isArray(data.daily_schedule)) {
    const missingTimeSlots = data.daily_schedule.filter((day) => {
      // time_slots가 없거나 빈 배열인 경우
      if (!day.time_slots || day.time_slots.length === 0) {
        // 제외일이 있는 날짜는 빈 배열 허용
        const isExclusionDay =
          day.day_type === "휴가" ||
          day.day_type === "개인일정" ||
          day.day_type === "지정휴일";
        
        // 제외일이 아닌 날짜만 에러로 처리
        return !isExclusionDay;
      }
      return false;
    });

    if (missingTimeSlots.length > 0) {
      const missingDates = missingTimeSlots.map((d) => d.date);
      throw new AppError(
        `daily_schedule에 time_slots가 없는 날짜가 있습니다: ${missingDates.join(", ")}`,
        ErrorCode.VALIDATION_ERROR,
        400,
        true,
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
  // 캠프 모드인 경우 camp_invitation_id로 먼저 확인
  const supabase = await createSupabaseServerClient();
  
  // 캠프 모드인 경우 camp_invitation_id로 기존 플랜 그룹 확인
  if (data.camp_invitation_id) {
    const { data: existingCampGroup, error: campGroupError } = await supabase
      .from("plan_groups")
      .select("id, status")
      .eq("camp_invitation_id", data.camp_invitation_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (campGroupError && campGroupError.code !== "PGRST116") {
      logActionDebug(
        { domain: "plan", action: "createPlanGroup", userId: studentId },
        "캠프 플랜 그룹 확인 중 에러 (무시하고 계속 진행)",
        { error: campGroupError }
      );
    } else if (existingCampGroup) {
      // 기존 캠프 플랜 그룹이 있으면 업데이트
      await updatePlanGroupDraftAction(existingCampGroup.id, data);
      revalidatePath("/plan");
      return { groupId: existingCampGroup.id };
    }
  }

  // 일반 모드 또는 캠프 모드에서 기존 그룹이 없는 경우
  const existingGroup = await findExistingDraftPlanGroup(
    supabase,
    studentId, // student_id로 조회
    data.name || null,
    data.camp_invitation_id || null
  );

  // 기존 draft가 있으면 업데이트
  if (existingGroup) {
    await updatePlanGroupDraftAction(existingGroup.id, data);
    revalidatePath("/plan");
    return { groupId: existingGroup.id };
  }

  // 플랜 기간 중복 검증 (활성/진행 중인 플랜과 겹치는지 확인)
  const overlapResult = await checkPlanPeriodOverlap(
    studentId,
    data.period_start,
    data.period_end
  );

  if (overlapResult.hasOverlap) {
    const overlappingNames = overlapResult.overlappingPlans
      .map((p) => p.name || "이름 없음")
      .join(", ");
    throw new AppError(
      `선택한 기간이 기존 플랜과 겹칩니다: ${overlappingNames}`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 학생 콘텐츠의 master_content_id 조회 (배치 조회) - RPC 호출 전에 준비
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
      .eq("student_id", studentId);
    books?.forEach((book) => {
      masterContentIdMap.set(book.id, book.master_content_id || null);
    });
  }

  if (lectureIds.length > 0) {
    const { data: lectures } = await supabase
      .from("lectures")
      .select("id, master_content_id")
      .in("id", lectureIds)
      .eq("student_id", studentId);
    lectures?.forEach((lecture) => {
      masterContentIdMap.set(lecture.id, lecture.master_content_id || null);
    });
  }

  // 마스터 콘텐츠 ID를 그대로 저장 (복사는 플랜 생성 시에만 수행)
  const processedContents = data.contents.map((c) => ({
    content_type: c.content_type,
    content_id: c.content_id,
    master_content_id: c.master_content_id ?? (masterContentIdMap.get(c.content_id) || null),
    start_range: c.start_range ?? null,
    end_range: c.end_range ?? null,
    display_order: c.display_order ?? 0,
  }));

  // 제외일 위계 기반 중복 제거 (캠프 모드)
  let processedExclusions = data.exclusions;
  const isCampMode = data.plan_type === "camp";

  if (isCampMode && data.exclusions && data.exclusions.length > 0) {
    const exclusionMap = new Map<string, typeof data.exclusions[0]>();

    for (const exclusion of data.exclusions) {
      const existing = exclusionMap.get(exclusion.exclusion_date);

      if (existing) {
        const higherType = getHigherPriorityExclusionType(
          exclusion.exclusion_type,
          existing.exclusion_type
        );
        if (higherType === exclusion.exclusion_type) {
          exclusionMap.set(exclusion.exclusion_date, exclusion);
        }
      } else {
        exclusionMap.set(exclusion.exclusion_date, exclusion);
      }
    }

    processedExclusions = Array.from(exclusionMap.values());
  }

  // 제외일 및 학원 일정 데이터 준비
  const exclusionsData = processedExclusions.map((e) => ({
    exclusion_date: e.exclusion_date,
    exclusion_type: e.exclusion_type,
    reason: e.reason || null,
  }));

  const schedulesData = data.academy_schedules.map((s) => ({
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    academy_name: s.academy_name || null,
    subject: s.subject || null,
    travel_time: s.travel_time ?? 0,
    source: s.source ?? "student",
    is_locked: s.is_locked ?? false,
  }));

  // 플랜 그룹 데이터 준비
  const planGroupData: PlanGroupAtomicInput = {
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
    plan_type: data.plan_type || null,
    camp_template_id: data.camp_template_id || null,
    camp_invitation_id: data.camp_invitation_id || null,
    use_slot_mode: data.use_slot_mode ?? false,
    content_slots: data.content_slots || null,
  };

  // 원자적 플랜 그룹 생성 (plan_groups + plan_contents + plan_exclusions + academy_schedules)
  // 하나의 트랜잭션 내에서 모든 테이블에 데이터 삽입, 실패 시 자동 롤백
  const atomicResult = await createPlanGroupAtomic(
    tenantContext.tenantId,
    studentId,
    planGroupData,
    processedContents,
    exclusionsData,
    schedulesData
  );

  if (!atomicResult.success || !atomicResult.groupId) {
    // Unique violation (23505): 동시 요청으로 인한 중복 생성 시도
    // 기존 draft를 찾아서 업데이트
    if (atomicResult.errorCode === "23505") {
      const retryExistingGroup = await findExistingDraftPlanGroup(
        supabase,
        studentId,
        data.name || null,
        data.camp_invitation_id || null
      );
      if (retryExistingGroup) {
        await updatePlanGroupDraftAction(retryExistingGroup.id, data);
        revalidatePath("/plan");
        return { groupId: retryExistingGroup.id };
      }
    }

    throw new AppError(
      atomicResult.error || "플랜 그룹 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const groupId = atomicResult.groupId;

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
      studentId?: string | null; // 관리자 모드에서 직접 지정하는 student_id
    }
  ) => {
    return await _createPlanGroup(data, options);
  }
);

/**
 * 플랜 그룹 임시저장 (draft 상태로 저장, 검증 완화)
 * 
 * 학생 또는 관리자 권한을 허용합니다.
 * 관리자 모드일 때는 기존 그룹에서 student_id를 가져옵니다.
 */
async function _savePlanGroupDraft(
  data: PlanGroupCreationData,
  options?: {
    draftGroupId?: string | null; // 기존 그룹 ID (관리자 모드에서 student_id 조회용)
    studentId?: string | null; // 관리자 모드에서 직접 지정하는 student_id
  }
): Promise<{ groupId: string }> {
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

  let studentId: string;
  let userId: string;

  // 관리자/컨설턴트 권한 확인
  const isAdmin = currentUser.role === "admin" || currentUser.role === "consultant";
  
  if (isAdmin) {
    // 관리자 모드: student_id를 옵션에서 가져오거나 기존 그룹에서 조회
    await requireAdminOrConsultant();
    userId = currentUser.userId;

    if (options?.studentId) {
      studentId = options.studentId;
    } else if (options?.draftGroupId) {
      // 기존 그룹에서 student_id 조회
      const supabase = await createSupabaseServerClient();
      const { data: existingGroup } = await supabase
        .from("plan_groups")
        .select("student_id")
        .eq("id", options.draftGroupId)
        .maybeSingle();

      if (!existingGroup?.student_id) {
        throw new AppError(
          "학생 ID를 찾을 수 없습니다. 기존 그룹이 없거나 학생 정보가 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      studentId = existingGroup.student_id;
    } else {
      throw new AppError(
        "관리자 모드에서는 student_id 또는 draftGroupId가 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  } else {
    // 학생 모드: 현재 사용자가 학생
    const studentAuth = await requireStudentAuth();
    studentId = studentAuth.userId;
    userId = studentAuth.userId;
  }

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
    studentId, // student_id로 조회
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
    student_id: studentId, // 관리자 모드에서는 지정된 student_id 사용
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
      formatDateString(new Date(Date.now() + DAYS_PER_WEEK * MILLISECONDS_PER_DAY)),
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
    // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
    use_slot_mode: data.use_slot_mode ?? false,
    content_slots: data.content_slots || null,
  });

  if (!groupResult.success || !groupResult.groupId) {
    // Unique violation (23505): 동시 요청으로 인한 중복 생성 시도
    // 기존 draft를 찾아서 업데이트
    if (groupResult.errorCode === "23505") {
      const retryExistingGroup = await findExistingDraftPlanGroup(
        supabase,
        studentId,
        data.name,
        data.camp_invitation_id || null
      );
      if (retryExistingGroup) {
        await updatePlanGroupDraftAction(retryExistingGroup.id, data);
        revalidatePath("/plan");
        return { groupId: retryExistingGroup.id };
      }
    }

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
  // 캠프 모드: 위계 기반 중복 제거
  if (data.exclusions && data.exclusions.length > 0) {
    let processedExclusions = data.exclusions;
    const isCampMode = data.plan_type === "camp";
    
    if (isCampMode) {
      const exclusionMap = new Map<string, typeof data.exclusions[0]>();
      
      for (const exclusion of data.exclusions) {
        const existing = exclusionMap.get(exclusion.exclusion_date);
        
        if (existing) {
          // 같은 날짜에 이미 제외일이 있으면 위계 비교
          const higherType = getHigherPriorityExclusionType(
            exclusion.exclusion_type,
            existing.exclusion_type
          );
          
          // 더 높은 위계의 제외일로 교체
          if (higherType === exclusion.exclusion_type) {
            exclusionMap.set(exclusion.exclusion_date, exclusion);
          }
        } else {
          exclusionMap.set(exclusion.exclusion_date, exclusion);
        }
      }
      
      processedExclusions = Array.from(exclusionMap.values());
    }

    const exclusionsResult = await createPlanExclusions(
      groupId,
      tenantContext.tenantId,
      processedExclusions.map((e) => ({
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

export const savePlanGroupDraftAction = withErrorHandling(
  async (
    data: PlanGroupCreationData,
    options?: {
      draftGroupId?: string | null;
      studentId?: string | null;
    }
  ) => {
    return await _savePlanGroupDraft(data, options);
  }
);

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

/**
 * 캘린더만 저장을 위한 입력 타입
 * PlanGroupCreationData에서 필수 필드를 선택적으로 변경
 */
type CalendarOnlyPlanGroupInput = {
  name: string;
  plan_purpose?: string | null;
  scheduler_type?: string | null;
  scheduler_options?: PlanGroupCreationData["scheduler_options"];
  time_settings?: PlanGroupCreationData["time_settings"];
  period_start: string;
  period_end: string;
  target_date?: string | null;
  block_set_id?: string | null;
  exclusions?: PlanGroupCreationData["exclusions"];
  academy_schedules?: PlanGroupCreationData["academy_schedules"];
  study_review_cycle?: PlanGroupCreationData["study_review_cycle"];
  subject_constraints?: PlanGroupCreationData["subject_constraints"];
  additional_period_reallocation?: PlanGroupCreationData["additional_period_reallocation"];
  non_study_time_blocks?: PlanGroupCreationData["non_study_time_blocks"];
  daily_schedule?: PlanGroupCreationData["daily_schedule"];
  plan_type?: PlanGroupCreationData["plan_type"];
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  use_slot_mode?: boolean;
};

/**
 * 캘린더만 저장 (콘텐츠 없이 일정만 생성)
 * Step 3에서 조기 종료 시 호출됩니다.
 *
 * 주요 특징:
 * - 콘텐츠 없이 일정(캘린더)만 생성
 * - status는 'active' (draft가 아님)
 * - is_calendar_only: true
 * - content_status: 'pending' (나중에 콘텐츠 추가 가능)
 *
 * @param data - 플랜 그룹 생성 데이터 (Step 1-3의 데이터)
 * @returns 생성된 플랜 그룹 ID
 */
async function _saveCalendarOnlyPlanGroup(
  data: CalendarOnlyPlanGroupInput
): Promise<{ groupId: string }> {
  // 권한 확인: 학생만 가능
  const studentAuth = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  // 최소 검증 (이름만 필수)
  if (!data.name || data.name.trim() === "") {
    throw new AppError(
      "플랜 이름을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 기간 검증
  if (!data.period_start || !data.period_end) {
    throw new AppError(
      "학습 기간을 설정해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // time_settings를 scheduler_options에 안전하게 병합
  let mergedSchedulerOptions = mergeTimeSettingsSafely(
    data.scheduler_options || {},
    data.time_settings
  );

  // study_review_cycle을 scheduler_options에 병합
  mergedSchedulerOptions = mergeStudyReviewCycle(
    mergedSchedulerOptions,
    data.study_review_cycle
  );

  // 플랜 그룹 생성 (active 상태, 캘린더 전용)
  const groupResult = await createPlanGroup({
    tenant_id: tenantContext.tenantId,
    student_id: studentAuth.userId,
    name: data.name,
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
    status: "draft", // 캘린더 전용은 draft로 생성, 콘텐츠 추가 후 active로 변경
    subject_constraints: data.subject_constraints || null,
    additional_period_reallocation: data.additional_period_reallocation || null,
    non_study_time_blocks: data.non_study_time_blocks || null,
    daily_schedule: data.daily_schedule || null,
    plan_type: data.plan_type || null,
    camp_template_id: data.camp_template_id || null,
    camp_invitation_id: data.camp_invitation_id || null,
    use_slot_mode: data.use_slot_mode ?? false,
    content_slots: null, // 캘린더 전용이므로 콘텐츠 슬롯 없음
    // 캘린더 전용 설정
    is_calendar_only: true,
    content_status: "pending",
    schedule_generated_at: new Date().toISOString(),
  });

  if (!groupResult.success || !groupResult.groupId) {
    throw new AppError(
      groupResult.error || "캘린더 저장에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const groupId = groupResult.groupId;

  // 제외일 저장 (있을 경우만)
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
      // 실패해도 그룹은 생성되었으므로 경고만 로깅
      logActionDebug(
        { domain: "plan", action: "saveCalendarOnlyPlanGroup" },
        "제외일 저장 실패",
        { error: exclusionsResult.error }
      );
    }
  }

  // 학원 일정 저장 (있을 경우만)
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
  revalidatePath(`/plan/group/${groupId}`);

  return { groupId };
}

export const saveCalendarOnlyPlanGroupAction = withErrorHandling(_saveCalendarOnlyPlanGroup);

