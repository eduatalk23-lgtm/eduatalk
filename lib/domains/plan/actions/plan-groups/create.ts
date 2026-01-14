"use server";

import { logActionSuccess, logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { logPlanGroupCreated } from "@/lib/domains/admin-plan/actions/planEvent";
import { revalidatePlanCache } from "@/lib/domains/plan/utils/cacheInvalidation";
import { resolveAuthContext, isAdminContext } from "@/lib/auth/strategies";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { formatDateString } from "@/lib/date/calendarUtils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { checkPlanPeriodOverlap } from "@/lib/domains/plan/repository";
import { AppError, ErrorCode, withErrorHandling, withErrorHandlingSafe } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";
import { PlanGroupCreationData } from "@/lib/types/plan";
import { normalizePlanPurpose, findExistingDraftPlanGroup } from "./utils";
import { buildSchedulerOptions } from "@/lib/domains/plan/utils/schedulerOptionsBuilder";
import { buildPlanCreationHints } from "@/lib/query/keys";
import { updatePlanGroupDraftAction } from "./update";
import { validateAllocations } from "@/lib/utils/subjectAllocation";
import { buildAllocationFromSlots } from "@/lib/plan/virtualSchedulePreview";
import {
  deduplicateExclusions,
  formatExclusionsForDb,
} from "@/lib/domains/plan/utils/exclusionProcessor";
import { DAYS_PER_WEEK, MILLISECONDS_PER_DAY } from "@/lib/utils/time";

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

/**
 * TimeRange 타입 (플래너/플랜 그룹 공통)
 */
interface TimeRange {
  start: string; // HH:mm format
  end: string;   // HH:mm format
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
  planner_id: string | null;
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
  // NEW: Time settings columns (inherited from planner)
  study_hours: TimeRange | null;
  self_study_hours: TimeRange | null;
  lunch_time: TimeRange | null;
  // Plan group level study type settings
  study_type: string | null;
  strategy_days_per_week: number | null;
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
  console.log("[createPlanGroupAtomic] RPC 호출 전", {
    tenantId,
    studentId,
    contentsCount: contents.length,
    contentsData: contents,
    exclusionsCount: exclusions.length,
    schedulesCount: schedules.length,
  });

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

  console.log("[createPlanGroupAtomic] RPC 결과", { result });

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
  // Strategy Pattern 기반 인증 해결
  // - 학생: 자신의 studentId 사용
  // - 관리자: options.studentId로 대상 학생 지정
  const auth = await resolveAuthContext({
    studentId: options?.studentId ?? undefined,
  });
  const studentId = auth.studentId;

  // 관리자 모드 로깅 (감사 추적)
  if (isAdminContext(auth)) {
    logActionDebug(
      { domain: "plan", action: "createPlanGroup", userId: auth.userId },
      `Admin creating plan for student`,
      { adminId: auth.userId, studentId, adminRole: auth.adminRole }
    );

    // 관리자 모드에서는 플래너 선택 필수 (플래너 우선순위 정책)
    if (!data.planner_id) {
      throw new AppError(
        "플래너를 먼저 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
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
  // scheduler_options 통합 빌드 (time_settings, study_review_cycle 병합)
  let mergedSchedulerOptions = buildSchedulerOptions({
    scheduler_options: data.scheduler_options,
    time_settings: data.time_settings,
    study_review_cycle: data.study_review_cycle,
  });

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
      revalidatePlanCache({ groupId: existingCampGroup.id, studentId });
      return { groupId: existingCampGroup.id, ...buildPlanCreationHints({ studentId, groupId: existingCampGroup.id }) };
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
    // DEBUG: 기존 draft 업데이트 흐름 추적
    console.log("[createPlanGroupAction] 기존 draft 발견, 업데이트 진행", {
      existingGroupId: existingGroup.id,
      existingGroupStatus: existingGroup.status,
      dataName: data.name,
      contentsCount: data.contents?.length ?? 0,
      contentsData: data.contents?.map(c => ({ id: c.content_id, type: c.content_type, start: c.start_range, end: c.end_range })),
    });
    await updatePlanGroupDraftAction(existingGroup.id, data);
    revalidatePlanCache({ groupId: existingGroup.id, studentId });
    return { groupId: existingGroup.id, ...buildPlanCreationHints({ studentId, groupId: existingGroup.id }) };
  }

  // 플랜 기간 중복 검증 (학생 자가 생성 시에만)
  // 관리자 모드 (planner_id 있음): 플래너 기반 필터링으로 충돌 없음 → 검증 건너뛰기
  // 학생 모드 (planner_id 없음): 기존 검증 유지 (경고 목적)
  if (!data.planner_id) {
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
  const isCampMode = data.plan_type === "camp";
  const processedExclusions = deduplicateExclusions(data.exclusions, {
    applyHierarchy: isCampMode,
  });

  // 제외일 및 학원 일정 데이터 준비
  const exclusionsData = formatExclusionsForDb(processedExclusions);

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
    planner_id: data.planner_id || null,
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
    // NEW: Time settings (inherited from planner)
    study_hours: data.study_hours || null,
    self_study_hours: data.self_study_hours || null,
    lunch_time: data.lunch_time || null,
    // Plan group level study type settings
    study_type: data.study_type || null,
    strategy_days_per_week: data.strategy_days_per_week || null,
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
        revalidatePlanCache({ groupId: retryExistingGroup.id, studentId });
        return { groupId: retryExistingGroup.id, ...buildPlanCreationHints({ studentId, groupId: retryExistingGroup.id }) };
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

  // 이벤트 로깅 (비동기, 실패해도 플랜 그룹 생성에 영향 없음)
  logPlanGroupCreated(
    tenantContext.tenantId,
    studentId,
    groupId,
    {
      name: data.name ?? "플랜 그룹",
      plan_purpose: data.plan_purpose,
      period_start: data.period_start,
      period_end: data.period_end,
      creation_mode: data.camp_template_id ? "camp" : "wizard",
      content_count: data.contents?.length ?? 0,
    },
    isAdminContext(auth) ? auth.userId : studentId,
    isAdminContext(auth) ? "admin" : "student"
  ).catch((err) => {
    logActionError(
      { domain: "plan", action: "createPlanGroup" },
      err,
      { groupId, step: "event_logging" }
    );
  });

  revalidatePlanCache({ groupId, studentId });
  return { groupId, ...buildPlanCreationHints({ studentId, groupId }) };
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
// withErrorHandlingSafe: 에러 발생 시 throw 대신 직렬화 가능한 에러 객체 반환
// 클라이언트에서 isErrorResult로 체크하여 안전하게 에러 처리
export const createPlanGroupAction = withErrorHandlingSafe(
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

  // 관리자/컨설턴트 권한 확인
  const isAdmin = currentUser.role === "admin" || currentUser.role === "consultant";
  
  if (isAdmin) {
    // 관리자 모드: student_id를 옵션에서 가져오거나 기존 그룹에서 조회
    await requireAdminOrConsultant();

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
  const supabase = await createSupabaseServerClient();
  const existingGroup = await findExistingDraftPlanGroup(
    supabase,
    studentId,
    data.name,
    data.camp_invitation_id || null
  );

  // 기존 draft가 있으면 업데이트
  if (existingGroup) {
    await updatePlanGroupDraftAction(existingGroup.id, data);
    revalidatePlanCache({ groupId: existingGroup.id, studentId });
    return { groupId: existingGroup.id };
  }

  // scheduler_options 통합 빌드 (time_settings, study_review_cycle 병합)
  const mergedSchedulerOptions = buildSchedulerOptions({
    scheduler_options: data.scheduler_options,
    time_settings: data.time_settings,
    study_review_cycle: data.study_review_cycle,
  });

  // 플랜 그룹 데이터 준비 (RPC용)
  const planGroupData: PlanGroupAtomicInput = {
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
    planner_id: data.planner_id || null,
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
    // NEW: Time settings (inherited from planner)
    study_hours: data.study_hours || null,
    self_study_hours: data.self_study_hours || null,
    lunch_time: data.lunch_time || null,
    // Plan group level study type settings
    study_type: data.study_type || null,
    strategy_days_per_week: data.strategy_days_per_week || null,
  };

  // 콘텐츠 데이터 준비
  const processedContents: ContentInput[] = data.contents?.map((c) => ({
    content_type: c.content_type,
    content_id: c.content_id,
    master_content_id: c.master_content_id ?? null,
    start_range: c.start_range ?? null,
    end_range: c.end_range ?? null,
    display_order: c.display_order ?? 0,
  })) ?? [];

  // 제외일 데이터 준비
  const isCampMode = data.plan_type === "camp";
  const processedExclusions = data.exclusions
    ? deduplicateExclusions(data.exclusions, { applyHierarchy: isCampMode })
    : [];
  const exclusionsData: ExclusionInput[] = formatExclusionsForDb(processedExclusions);

  // 학원 일정 데이터 준비
  const schedulesData: ScheduleInput[] = data.academy_schedules?.map((s) => ({
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    academy_name: s.academy_name || null,
    subject: s.subject || null,
    travel_time: s.travel_time ?? 0,
    source: s.source ?? "student",
    is_locked: s.is_locked ?? false,
  })) ?? [];

  // 원자적 플랜 그룹 생성 (트랜잭션 보장)
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
    if (atomicResult.errorCode === "23505") {
      const retryExistingGroup = await findExistingDraftPlanGroup(
        supabase,
        studentId,
        data.name,
        data.camp_invitation_id || null
      );
      if (retryExistingGroup) {
        await updatePlanGroupDraftAction(retryExistingGroup.id, data);
        revalidatePlanCache({ groupId: retryExistingGroup.id, studentId });
        return { groupId: retryExistingGroup.id };
      }
    }

    throw new AppError(
      atomicResult.error || "플랜 그룹 임시저장에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePlanCache({ groupId: atomicResult.groupId, studentId });
  return { groupId: atomicResult.groupId };
}

// withErrorHandlingSafe: 에러 발생 시 throw 대신 직렬화 가능한 에러 객체 반환
// 클라이언트에서 isErrorResult로 체크하여 안전하게 에러 처리
export const savePlanGroupDraftAction = withErrorHandlingSafe(
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
  const { group, contents, exclusions } =
    await getPlanGroupWithDetails(groupId, user.userId);

  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 플랜 그룹 데이터 준비 (RPC용)
  const planGroupData: PlanGroupAtomicInput = {
    name: `${group.name || "플랜 그룹"} (복사본)`,
    plan_purpose: group.plan_purpose,
    scheduler_type: group.scheduler_type,
    scheduler_options: group.scheduler_options ?? null,
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date,
    block_set_id: group.block_set_id,
    planner_id: group.planner_id ?? null, // 플래너 연결 유지
    status: "draft",
    subject_constraints: group.subject_constraints ?? null,
    additional_period_reallocation: group.additional_period_reallocation ?? null,
    non_study_time_blocks: group.non_study_time_blocks ?? null,
    daily_schedule: group.daily_schedule ?? null,
    plan_type: group.plan_type ?? null,
    camp_template_id: group.camp_template_id ?? null,
    camp_invitation_id: null, // 복사본은 새 캠프 초대가 아님
    use_slot_mode: group.use_slot_mode ?? false,
    content_slots: (group.content_slots as Record<string, unknown>[] | null) ?? null,
    // NEW: Time settings (복사 시 원본 설정 유지)
    study_hours: (group.study_hours as TimeRange | null) ?? null,
    self_study_hours: (group.self_study_hours as TimeRange | null) ?? null,
    lunch_time: (group.lunch_time as TimeRange | null) ?? null,
    // Plan group level study type settings (복사 시 원본 설정 유지)
    study_type: group.study_type ?? null,
    strategy_days_per_week: group.strategy_days_per_week ?? null,
  };

  // 콘텐츠 데이터 준비
  const processedContents: ContentInput[] = contents?.map((c) => ({
    content_type: c.content_type,
    content_id: c.content_id,
    master_content_id: c.master_content_id ?? null,
    start_range: c.start_range ?? null,
    end_range: c.end_range ?? null,
    display_order: c.display_order ?? 0,
  })) ?? [];

  // 제외일 복사 (원본 플랜 그룹의 기간에 해당하는 제외일만)
  const periodStart = new Date(group.period_start);
  const periodEnd = new Date(group.period_end);

  const filteredExclusions = (exclusions ?? []).filter((e) => {
    const exclusionDate = new Date(e.exclusion_date);
    return exclusionDate >= periodStart && exclusionDate <= periodEnd;
  });

  const exclusionsData: ExclusionInput[] = filteredExclusions.map((e) => ({
    exclusion_date: e.exclusion_date,
    exclusion_type: e.exclusion_type,
    reason: e.reason ?? null,
  }));

  // 학원 일정은 복사하지 않음 (학생별 전역 관리)
  const schedulesData: ScheduleInput[] = [];

  // 원자적 플랜 그룹 생성 (트랜잭션 보장)
  const atomicResult = await createPlanGroupAtomic(
    tenantContext.tenantId,
    user.userId,
    planGroupData,
    processedContents,
    exclusionsData,
    schedulesData
  );

  if (!atomicResult.success || !atomicResult.groupId) {
    throw new AppError(
      atomicResult.error || "플랜 그룹 복사에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const newGroupId = atomicResult.groupId;

  revalidatePlanCache({ groupId: newGroupId, studentId: user.userId });

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
  planner_id?: string | null;
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

  // scheduler_options 통합 빌드 (time_settings, study_review_cycle 병합)
  const mergedSchedulerOptions = buildSchedulerOptions({
    scheduler_options: data.scheduler_options,
    time_settings: data.time_settings,
    study_review_cycle: data.study_review_cycle,
  });

  // 플랜 그룹 데이터 준비 (RPC용)
  const planGroupData: PlanGroupAtomicInput = {
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
    planner_id: data.planner_id || null,
    status: "draft",
    subject_constraints: data.subject_constraints || null,
    additional_period_reallocation: data.additional_period_reallocation || null,
    non_study_time_blocks: data.non_study_time_blocks || null,
    daily_schedule: data.daily_schedule || null,
    plan_type: data.plan_type || null,
    camp_template_id: data.camp_template_id || null,
    camp_invitation_id: data.camp_invitation_id || null,
    use_slot_mode: data.use_slot_mode ?? false,
    content_slots: null, // 캘린더 전용이므로 콘텐츠 슬롯 없음
    // NEW: Time settings - 캘린더 전용에서도 시간 설정 저장
    study_hours: null,
    self_study_hours: null,
    lunch_time: null,
    // Plan group level study type settings - 캘린더 전용에서는 미사용
    study_type: null,
    strategy_days_per_week: null,
  };

  // 콘텐츠 없음 (캘린더 전용)
  const processedContents: ContentInput[] = [];

  // 제외일 데이터 준비
  const exclusionsData: ExclusionInput[] = data.exclusions?.map((e) => ({
    exclusion_date: e.exclusion_date,
    exclusion_type: e.exclusion_type,
    reason: e.reason || null,
  })) ?? [];

  // 학원 일정 데이터 준비
  const schedulesData: ScheduleInput[] = data.academy_schedules?.map((s) => ({
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    academy_name: s.academy_name || null,
    subject: s.subject || null,
    travel_time: s.travel_time ?? 0,
    source: s.source ?? "student",
    is_locked: s.is_locked ?? false,
  })) ?? [];

  // 원자적 플랜 그룹 생성 (트랜잭션 보장)
  const atomicResult = await createPlanGroupAtomic(
    tenantContext.tenantId,
    studentAuth.userId,
    planGroupData,
    processedContents,
    exclusionsData,
    schedulesData
  );

  if (!atomicResult.success || !atomicResult.groupId) {
    throw new AppError(
      atomicResult.error || "캘린더 저장에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const groupId = atomicResult.groupId;

  // 캘린더 전용 필드 업데이트 (RPC에서 지원하지 않는 필드)
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("plan_groups")
    .update({
      is_calendar_only: true,
      content_status: "pending",
      schedule_generated_at: new Date().toISOString(),
    })
    .eq("id", groupId);

  revalidatePlanCache({ groupId, studentId: studentAuth.userId });

  return { groupId };
}

export const saveCalendarOnlyPlanGroupAction = withErrorHandling(_saveCalendarOnlyPlanGroup);

