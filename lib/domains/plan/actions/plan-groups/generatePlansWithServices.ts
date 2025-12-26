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
import { calculateAvailableDates } from "@/lib/scheduler/calculateAvailableDates";
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

// 서비스 임포트
import {
  ContentResolutionService,
  PlanPayloadBuilder,
  PlanValidationService,
  PlanPersistenceService,
  type PlanServiceContext,
  type GeneratePlanPayload,
} from "@/lib/domains/plan/services";

// ============================================
// 헬퍼 함수
// ============================================

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
): Promise<{ count: number; warnings?: string[] }> {
  // ============================================
  // 1. 인증 및 컨텍스트 설정
  // ============================================
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

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
    group.scheduler_options as Record<string, unknown>
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
  // 6. 스케줄러 호출 (플랜 생성)
  // ============================================
  let scheduledPlans: import("@/lib/plan/scheduler").ScheduledPlan[];
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

    scheduledPlans = await generatePlansFromGroup(
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
      resolution.chapterMap
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
  // 12. 결과 반환
  // ============================================
  return {
    count: insertResult.insertedCount,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  };
}

// ============================================
// Export
// ============================================

export const generatePlansWithServicesAction = withErrorHandling(
  _generatePlansWithServices
);

export { _generatePlansWithServices };
