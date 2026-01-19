"use server";

/**
 * 서비스 기반 플랜 생성 함수
 *
 * 기존 generatePlansRefactored.ts의 god function을 서비스 레이어로 분리한 버전입니다.
 * ContentResolutionService, PlanPayloadBuilder, PlanValidationService, PlanPersistenceService를
 * 사용하여 책임을 분리합니다.
 *
 * @module lib/domains/plan/actions/plan-groups/generatePlansWithServices
 */

import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { acquirePlanGroupLock } from "@/lib/utils/planGroupLock";
import { PlanStatus } from "@/lib/types/plan";
import {
  getPlanGroupWithDetailsByRole,
  getStudentIdForPlanGroup,
  getSupabaseClientForStudent,
  shouldBypassStatusCheck,
  verifyPlanGroupAccess,
} from "@/lib/auth/planGroupAuth";
import { ensureAdminClient } from "@/lib/supabase/clientSelector";
import {
  getBlockSetForPlanGroup,
  getBlockSetErrorMessage,
} from "@/lib/plan/blocks";
import { isDummyContent } from "@/lib/utils/planUtils";
import { calculateAvailableDates } from "@/lib/scheduler/utils/scheduleCalculator";
import { generatePlansFromGroup } from "@/lib/plan/scheduler";
import { extractScheduleMaps } from "@/lib/plan/planDataLoader";
import { getMergedSchedulerSettings } from "@/lib/data/schedulerSettings";
import { PlanGroupError } from "@/lib/errors/planGroupErrors";
import { getSchedulerOptionsWithTimeSettings } from "@/lib/utils/schedulerOptions";
import {
  calculateVirtualTimeline,
  generateVirtualPlanItems,
  filterVirtualSlots,
  type DailyScheduleInfo,
} from "@/lib/plan/virtualSchedulePreview";
import type { ContentSlot } from "@/lib/types/content-selection";
import { revalidatePlanCache } from "@/lib/domains/plan/utils/cacheInvalidation";
import { logPlansBatchCreated } from "@/lib/domains/admin-plan/actions/planEvent";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { buildPlanCreationHints } from "@/lib/query/keys";

// 서비스 임포트 (lib/plan/shared로 통합됨)
import {
  ContentResolutionServiceWithContext as ContentResolutionService,
  PlanPersistenceServiceWithContext as PlanPersistenceService,
  type PlanServiceContext,
} from "@/lib/plan/shared";
// PlanPayloadBuilder, PlanValidationService, GeneratePlanPayload는
// 동일 모듈에서 import하여 타입 호환성 유지
import {
  PlanPayloadBuilder,
  PlanValidationService,
  type GeneratePlanPayload,
} from "@/lib/domains/plan/services";
import {
  AvailabilityAwarePlacementService,
  type PlanToPlace,
  type DockedPlanInfo,
} from "@/lib/domains/plan/services/AvailabilityAwarePlacementService";
import type { ExistingPlan } from "@/lib/domains/plan/services/AvailabilityService";
import type { ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 기존 플랜 조회 (다른 플랜 그룹의 플랜)
 * 충돌 방지를 위해 동일 학생의 동일 기간 내 플랜을 조회
 */
async function fetchExistingPlans(
  supabaseClient: ReturnType<typeof createSupabaseServerClient> extends Promise<infer T> ? T : never,
  studentId: string,
  periodStart: string,
  periodEnd: string,
  excludePlanGroupId: string
): Promise<ExistingPlan[]> {
  const { data, error } = await supabaseClient
    .from("student_plan")
    .select(`
      id,
      plan_date,
      start_time,
      end_time,
      content_type,
      content_id,
      content_title,
      plan_group_id,
      status
    `)
    .eq("student_id", studentId)
    .gte("plan_date", periodStart)
    .lte("plan_date", periodEnd)
    .neq("plan_group_id", excludePlanGroupId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    console.error("[fetchExistingPlans] 기존 플랜 조회 실패:", error);
    return [];
  }

  return (data || []).map((p) => ({
    id: p.id,
    plan_date: p.plan_date,
    start_time: p.start_time,
    end_time: p.end_time,
    content_type: p.content_type as "book" | "lecture" | "custom",
    content_id: p.content_id,
    content_title: p.content_title ?? undefined,
    plan_group_id: p.plan_group_id,
    status: p.status ?? undefined,
  }));
}

/**
 * 플랜 생성 서비스 컨텍스트 생성
 */
function createServiceContext(
  queryClient: PlanServiceContext["queryClient"],
  masterQueryClient: PlanServiceContext["masterQueryClient"],
  studentId: string,
  tenantId: string,
  groupId: string,
  isCampMode: boolean
): PlanServiceContext {
  return {
    queryClient,
    masterQueryClient,
    studentId,
    tenantId,
    groupId,
    isCampMode,
  };
}

// ============================================
// 메인 함수
// ============================================

/**
 * 서비스 기반 플랜 생성 함수
 *
 * 기존 _generatePlansFromGroupRefactored 함수를 서비스 레이어로 리팩토링한 버전입니다.
 * 각 단계가 명확히 분리되어 있어 유지보수와 테스트가 용이합니다.
 */
async function _generatePlansWithServices(
  groupId: string
): Promise<{
  count: number;
  warnings?: string[];
  dockedPlans?: DockedPlanInfo[];
  dockedCount?: number;
}> {
  // ============================================
  // 1. 인증 및 컨텍스트 설정
  // ============================================
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  // ============================================
  // 0. 동시성 제어: 플랜 그룹 락 획득
  // Phase 2.1: 동일 플랜 그룹에 대한 동시 생성 요청 방지
  // ============================================
  const lockAcquired = await acquirePlanGroupLock(supabase, groupId);
  if (!lockAcquired) {
    throw new AppError(
      "플랜 생성이 이미 진행 중입니다. 잠시 후 다시 시도해주세요.",
      ErrorCode.DATABASE_ERROR, // CONCURRENT_OPERATION이 없으면 DATABASE_ERROR 사용
      409,
      true
    );
  }

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsByRole(
      groupId,
      access.user.userId,
      access.role,
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

  // 학생 ID 및 상태 검증
  const studentId = getStudentIdForPlanGroup(
    group,
    access.user.userId,
    access.role
  );

  const bypassStatusCheck = shouldBypassStatusCheck(
    access.role,
    group.plan_type ?? null
  );

  if (!bypassStatusCheck) {
    if (group.status !== "saved" && group.status !== "active") {
      throw new AppError(
        "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 생성할 수 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // ============================================
  // 2. 블록 세트 및 스케줄러 설정
  // ============================================
  const baseBlocks = await getBlockSetForPlanGroup(
    group,
    studentId,
    access.user.userId,
    access.role,
    tenantContext.tenantId
  );

  if (baseBlocks.length === 0) {
    const errorMessage = getBlockSetErrorMessage(group, false);
    throw new AppError(errorMessage, ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const mergedSettings = await getMergedSchedulerSettings(
    group.tenant_id,
    group.camp_template_id,
    (group.scheduler_options as Record<string, unknown> | null) ?? null
  );

  const schedulerOptions = {
    study_days: mergedSettings.study_review_ratio.study_days,
    review_days: mergedSettings.study_review_ratio.review_days,
    weak_subject_focus: mergedSettings.weak_subject_focus,
    review_scope: mergedSettings.review_scope,
    lunch_time: mergedSettings.lunch_time,
    camp_study_hours: mergedSettings.study_hours,
    self_study_hours: mergedSettings.self_study_hours,
  };

  const groupSchedulerOptions = getSchedulerOptionsWithTimeSettings(group);

  // ============================================
  // 3. 스케줄 계산
  // ============================================
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
      scheduler_type: "1730_timetable",
      scheduler_options: schedulerOptions || null,
      use_self_study_with_blocks: true,
      enable_self_study_for_holidays:
        groupSchedulerOptions?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days:
        groupSchedulerOptions?.enable_self_study_for_study_days === true,
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      camp_self_study_hours: schedulerOptions.self_study_hours,
      designated_holiday_hours: groupSchedulerOptions?.designated_holiday_hours,
      non_study_time_blocks: group.non_study_time_blocks || undefined,
    }
  );

  // 스케줄 맵 추출
  const { dateTimeSlots, dateMetadataMap, weekDatesMap } =
    extractScheduleMaps(scheduleResult);

  // dateAvailableTimeRanges 추출
  const dateAvailableTimeRanges = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  scheduleResult.daily_schedule.forEach((daily) => {
    if (
      (daily.day_type === "학습일" || daily.day_type === "복습일") &&
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

  // ============================================
  // 4. 서비스 컨텍스트 설정
  // ============================================
  const isAdminOrConsultant =
    access.role === "admin" || access.role === "consultant";
  const queryClient = await getSupabaseClientForStudent(
    studentId,
    access.user.userId,
    access.role
  );
  const masterQueryClient = isAdminOrConsultant
    ? ensureAdminClient()
    : supabase;

  if (!queryClient || !masterQueryClient) {
    throw new AppError(
      "Supabase 클라이언트를 생성할 수 없습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  const tenantId = group.tenant_id || tenantContext.tenantId;
  if (!tenantId) {
    throw new AppError(
      "테넌트 ID를 찾을 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const isCampMode = !!group.camp_template_id;
  const ctx = createServiceContext(
    queryClient,
    masterQueryClient,
    studentId,
    tenantId,
    groupId,
    isCampMode
  );

  // ============================================
  // 5. 콘텐츠 해석 (ContentResolutionService)
  // ============================================
  const contentResolution = new ContentResolutionService(ctx);
  const resolution = await contentResolution.resolveContents(contents);

  // 콘텐츠 해석 결과 검증
  const validation = new PlanValidationService();
  const contentValidation = validation.validateContentResolution(resolution);

  // 경고 수집
  const allWarnings: string[] = [];
  contentValidation.warnings.forEach((w) => allWarnings.push(w.message));

  // 치명적 에러 시 중단
  if (!contentValidation.isValid) {
    throw new AppError(
      contentValidation.errors.map((e) => e.message).join(", "),
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // ============================================
  // 5.5. 기존 플랜 조회 (스케줄러 호출 전!)
  // Phase 2: 시간 슬롯 충돌 방지 - 스케줄러가 기존 플랜을 고려하도록 함
  // ============================================
  const existingPlans = await fetchExistingPlans(
    supabase,
    studentId,
    group.period_start,
    group.period_end,
    groupId
  );

  // ExistingPlanInfo 형식으로 변환 (스케줄러 요구 타입)
  const existingPlanInfos: ExistingPlanInfo[] = existingPlans
    .filter((p) => p.start_time && p.end_time) // 시간 정보 있는 플랜만
    .map((p) => ({
      date: p.plan_date,
      start_time: p.start_time!,
      end_time: p.end_time!,
    }));

  logActionDebug(
    { domain: "plan", action: "generatePlansWithServices" },
    `기존 플랜 ${existingPlanInfos.length}개 발견, 스케줄러에 전달`
  );

  // ============================================
  // 6. 스케줄러 호출 (플랜 생성)
  // ============================================
  let scheduledPlans: import("@/lib/plan/scheduler").ScheduledPlan[];
  let overlapValidation: import("@/lib/scheduler/types").OverlapValidationResult | undefined;
  try {
    // contents의 content_id를 변환하여 스케줄러에 전달
    const transformedContents = contents
      .filter((c) => {
        if (isDummyContent(c.content_id)) return true;
        return resolution.contentIdMap.has(c.content_id);
      })
      .map((c) => ({
        ...c,
        content_id: resolution.contentIdMap.get(c.content_id) || c.content_id,
      }));

    if (transformedContents.length === 0) {
      throw new AppError(
        "플랜 생성에 실패했습니다. 모든 콘텐츠가 매핑되지 않았습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const generateResult = await generatePlansFromGroup(
      group,
      transformedContents,
      exclusions,
      academySchedules,
      [],
      undefined,
      undefined,
      dateAvailableTimeRanges,
      dateTimeSlots,
      resolution.durationMap,
      resolution.chapterMap,
      undefined,           // periodStart
      undefined,           // periodEnd
      existingPlanInfos,   // Phase 2: 기존 플랜 정보 전달 (시간 충돌 방지)
      { autoAdjustOverlaps: true }  // Phase 4: 시간 충돌 자동 조정
    );
    scheduledPlans = generateResult.plans;
    overlapValidation = generateResult.overlapValidation;

    logActionDebug(
      { domain: "plan", action: "generatePlansWithServices" },
      `스케줄러 출력: ${scheduledPlans.length}개 플랜 생성`,
      overlapValidation?.hasOverlaps ? { overlapsCount: overlapValidation.overlaps.length } : undefined
    );
  } catch (error) {
    if (error instanceof PlanGroupError) {
      throw new AppError(
        error.userMessage || error.message,
        ErrorCode.BUSINESS_LOGIC_ERROR,
        400,
        true,
        {
          originalError: error.message,
          failureReason: error.failureReason,
          code: error.code,
        }
      );
    }
    throw error;
  }

  if (scheduledPlans.length === 0) {
    throw new AppError(
      "일정에 맞는 플랜을 생성할 수 없습니다. 기간과 콘텐츠 양을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // ============================================
  // 6.5. 추가 폴백 처리: 자율학습 시간 및 dock 배치 (Phase 2)
  // 스케줄러가 기존 플랜을 고려하여 배치했지만, 학습 시간이 부족한 경우
  // 자율학습 시간으로 넘치거나 dock에 배치될 수 있음
  // ============================================
  let dockedPlansInfo: DockedPlanInfo[] = [];

  // 기존 플랜이 있거나 미배치 플랜이 있는 경우 폴백 처리
  const unplacedPlans = scheduledPlans.filter((p) => !p.start_time || !p.end_time);

  if (existingPlans.length > 0 || unplacedPlans.length > 0) {
    logActionDebug(
      { domain: "plan", action: "generatePlansWithServices" },
      `폴백 처리 시작 - 기존 플랜: ${existingPlans.length}개, 미배치 플랜: ${unplacedPlans.length}개`
    );

    // 스케줄러 결과를 PlanToPlace 형식으로 변환
    // 참고: PlanContent 타입에는 title 필드가 없어서 content_id를 기본값으로 사용
    const plansToPlace: PlanToPlace[] = scheduledPlans.map((plan) => {
      // start_time, end_time에서 소요시간 계산 (분 단위)
      let estimatedDuration = 30; // 기본값 30분
      if (plan.start_time && plan.end_time) {
        const [startH, startM] = plan.start_time.split(":").map(Number);
        const [endH, endM] = plan.end_time.split(":").map(Number);
        estimatedDuration = (endH * 60 + endM) - (startH * 60 + startM);
        if (estimatedDuration <= 0) estimatedDuration = 30; // 음수면 기본값
      }

      return {
        contentId: plan.content_id,
        contentType: plan.content_type as "book" | "lecture" | "custom",
        contentTitle: plan.content_id, // TODO: 추후 content 메타데이터에서 title 조회 추가
        planDate: plan.plan_date,
        startTime: plan.start_time ?? null,
        endTime: plan.end_time ?? null,
        estimatedDuration,
        priority: plan.subject_type === "strategy" ? 1 : 2, // 전략 과목 우선
        subjectType: plan.subject_type as "strategy" | "weakness" | null,
      };
    });

    // 시간 설정 추출 (TimeSettings의 필드명 사용)
    const studyHours = groupSchedulerOptions?.camp_study_hours ?? schedulerOptions.camp_study_hours ?? null;
    const selfStudyHours = groupSchedulerOptions?.camp_self_study_hours ?? schedulerOptions.self_study_hours ?? null;

    // 폴백 배치 서비스 실행
    const placementService = new AvailabilityAwarePlacementService();
    const placementResult = placementService.placeWithFallback({
      plansToPlace,
      existingPlans,
      dailySchedule: scheduleResult.daily_schedule,
      studyHours,
      selfStudyHours,
      strategy: "best-fit",
      periodStart: group.period_start,
      periodEnd: group.period_end,
    });

    logActionDebug(
      { domain: "plan", action: "generatePlansWithServices" },
      "배치 결과",
      {
        studyHours: placementResult.summary.placedInStudyHours,
        selfStudy: placementResult.summary.placedInSelfStudyHours,
        docked: placementResult.summary.dockedCount,
      }
    );

    // 배치 결과 반영 - scheduledPlans 업데이트
    const placedPlansMap = new Map<string, { startTime: string; endTime: string; wasRelocated: boolean }>();

    // 학습 시간 및 자율학습 시간 배치 플랜 수집
    for (const placed of [...placementResult.studyHoursPlans, ...placementResult.selfStudyPlans]) {
      const key = `${placed.planDate}:${placed.contentId}`;
      placedPlansMap.set(key, {
        startTime: placed.startTime,
        endTime: placed.endTime,
        wasRelocated: placed.wasRelocated,
      });
    }

    // dock으로 이동할 플랜의 날짜:콘텐츠ID Set
    const dockedPlanKeys = new Set(
      placementResult.dockedPlans.map((d) => `${d.planDate}:${d.contentId}`)
    );

    // scheduledPlans 업데이트
    scheduledPlans = scheduledPlans.map((plan) => {
      const key = `${plan.plan_date}:${plan.content_id}`;
      const placedInfo = placedPlansMap.get(key);

      if (placedInfo) {
        // 재배치된 시간으로 업데이트
        return {
          ...plan,
          start_time: placedInfo.startTime,
          end_time: placedInfo.endTime,
        };
      }

      // dock으로 이동할 플랜은 시간 슬롯 제거 (dock 처리는 dockedPlansInfo에서 별도 관리)
      if (dockedPlanKeys.has(key)) {
        return {
          ...plan,
          start_time: undefined,
          end_time: undefined,
        };
      }

      return plan;
    });

    // dock 플랜 정보 저장
    dockedPlansInfo = placementResult.dockedPlans;

    // 충돌 관련 경고 추가
    if (placementResult.conflicts.length > 0) {
      placementResult.conflicts.forEach((conflict) => {
        allWarnings.push(`[시간 충돌] ${conflict.contentTitle}: ${conflict.reason}`);
      });
    }

    if (placementResult.summary.dockedCount > 0) {
      allWarnings.push(
        `${placementResult.summary.dockedCount}개 플랜이 시간 부족으로 '미완료 플랜' dock에 배치되었습니다.`
      );
    }
  }

  // ============================================
  // 7. 플랜 페이로드 빌드 (PlanPayloadBuilder)
  // ============================================
  const payloadBuilder = new PlanPayloadBuilder(ctx);
  const buildResult = payloadBuilder.buildPayloads(
    scheduledPlans,
    resolution,
    scheduleResult,
    dateTimeSlots,
    dateMetadataMap,
    weekDatesMap
  );

  buildResult.warnings.forEach((w) => allWarnings.push(w));

  // ============================================
  // 8. 가상 플랜 생성 (슬롯 모드)
  // ============================================
  const useSlotMode = group.use_slot_mode === true;
  const contentSlots = (group.content_slots as ContentSlot[] | null) || [];
  const planPayloads = [...buildResult.payloads];

  if (useSlotMode && contentSlots.length > 0) {
    const virtualSlots = filterVirtualSlots(contentSlots);

    if (virtualSlots.length > 0) {
      const dailyScheduleInfos: DailyScheduleInfo[] =
        scheduleResult.daily_schedule
          .filter(
            (d) => d.day_type === "학습일" || d.day_type === "복습일"
          )
          .map((d) => ({
            date: d.date,
            day_type: d.day_type as "학습일" | "복습일",
            study_hours: d.study_hours,
            week_number: d.week_number ?? undefined,
          }));

      const virtualTimelineResult = calculateVirtualTimeline(
        virtualSlots,
        dailyScheduleInfos
      );

      virtualTimelineResult.warnings.forEach((w) => allWarnings.push(w));

      const virtualPlanRecords = generateVirtualPlanItems(
        virtualTimelineResult.plans,
        virtualSlots,
        { tenantId, studentId, planGroupId: groupId }
      );

      // 가상 플랜을 페이로드에 추가
      for (const virtualRecord of virtualPlanRecords) {
        planPayloads.push({
          plan_group_id: virtualRecord.plan_group_id,
          student_id: virtualRecord.student_id,
          tenant_id: virtualRecord.tenant_id,
          plan_date: virtualRecord.plan_date,
          block_index: virtualRecord.block_index,
          content_type: virtualRecord.content_type,
          content_id: virtualRecord.content_id,
          planned_start_page_or_time: virtualRecord.planned_start_page_or_time,
          planned_end_page_or_time: virtualRecord.planned_end_page_or_time,
          chapter: virtualRecord.chapter ?? null,
          start_time: virtualRecord.start_time,
          end_time: virtualRecord.end_time,
          day_type: virtualRecord.day_type,
          week: virtualRecord.week,
          day: virtualRecord.day,
          is_partial: false,
          is_continued: false,
          is_reschedulable: false,
          content_title: null,
          content_subject: null,
          content_subject_category: virtualRecord.virtual_subject_category,
          content_category: null,
          sequence: null,
          plan_number: null,
          is_virtual: virtualRecord.is_virtual,
          slot_index: virtualRecord.slot_index,
          virtual_subject_category: virtualRecord.virtual_subject_category,
          virtual_description: virtualRecord.virtual_description,
        } as GeneratePlanPayload);
      }
    }
  }

  // ============================================
  // 9. 페이로드 검증 (PlanValidationService)
  // ============================================
  const payloadValidation = validation.validatePayloads(planPayloads);
  payloadValidation.warnings.forEach((w) => allWarnings.push(w.message));

  if (!payloadValidation.isValid) {
    throw new AppError(
      payloadValidation.errors.map((e) => e.message).join(", "),
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 콘텐츠 존재 여부 검증
  const contentExistence = await validation.validateContentExistence(
    planPayloads,
    queryClient,
    studentId
  );
  contentExistence.warnings.forEach((w) => allWarnings.push(w.message));

  if (!contentExistence.isValid) {
    throw new AppError(
      contentExistence.errors.map((e) => e.message).join(", "),
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // ============================================
  // 10. 플랜 저장 (PlanPersistenceService)
  // ============================================
  const persistence = new PlanPersistenceService(ctx);

  // 기존 플랜 삭제
  await persistence.deleteExistingPlans();

  // 플랜 삽입
  const insertResult = await persistence.insertPlans(planPayloads);

  // 삽입 결과 검증
  const insertValidation = validation.validateInsertResult(
    planPayloads,
    insertResult
  );
  insertValidation.warnings.forEach((w) => allWarnings.push(w.message));

  if (!insertValidation.isValid) {
    throw new AppError(
      insertValidation.errors.map((e) => e.message).join(", "),
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // ============================================
  // 11. 플랜 그룹 상태 업데이트
  // ============================================
  if ((group.status as PlanStatus) === "draft") {
    await persistence.updatePlanGroupStatus("saved", insertResult.insertedIds);
  }

  // ============================================
  // 12. 캐시 무효화
  // ============================================
  revalidatePlanCache({
    groupId,
    studentId,
    includeCalendar: true,
  });

  // ============================================
  // 13. 이벤트 로깅 (비동기, 실패해도 플랜 생성에 영향 없음)
  // ============================================
  logPlansBatchCreated(
    tenantId,
    studentId,
    groupId,
    {
      total_plans: insertResult.insertedCount,
      period_start: group.period_start ?? "",
      period_end: group.period_end ?? "",
      creation_mode: group.creation_mode ?? "wizard",
      plan_ids: insertResult.insertedIds,
    },
    studentId,
    "student"
  ).catch((err) => {
    logActionError(
      { domain: "plan", action: "generatePlansWithServices" },
      err,
      { groupId, step: "event_logging" }
    );
  });

  // ============================================
  // 14. 결과 반환
  // ============================================
  return {
    count: insertResult.insertedCount,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
    // dock에 배치된 플랜 정보 (Phase 2: 시간 충돌 방지)
    dockedPlans: dockedPlansInfo.length > 0 ? dockedPlansInfo : undefined,
    dockedCount: dockedPlansInfo.length,
    // React Query 캐시 무효화 힌트
    ...buildPlanCreationHints({ studentId, groupId }),
  };
}

// ============================================
// Export
// ============================================

export const generatePlansWithServicesAction = withErrorHandling(
  _generatePlansWithServices
);

export { _generatePlansWithServices };
