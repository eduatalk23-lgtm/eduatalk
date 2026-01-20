/**
 * Stage 6: DB 저장
 *
 * 생성된 플랜을 데이터베이스에 저장합니다.
 * - PlanGroup 생성 (플래너 연계)
 * - ScheduledPlan들을 student_plans 테이블에 저장
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePlannerForPipeline } from "@/lib/domains/plan/actions/planners/autoCreate";
import {
  logActionError,
  logActionWarn,
  logActionDebug,
  type ActionContext,
} from "@/lib/logging/actionLogger";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type {
  ValidatedPlanInput,
  ValidationResult,
  ContentResolutionResult,
  PersistenceResult,
  PlanGroupInfo,
  StageResult,
  ResolvedContentItem,
} from "../types";

// 로깅 컨텍스트 생성 헬퍼
function createPersistContext(
  tenantId?: string,
  studentId?: string
): ActionContext {
  return {
    domain: "plan",
    action: "unifiedPlanGeneration.persist",
    tenantId,
    userId: studentId,
  };
}

/**
 * Plan Group 생성 옵션
 */
interface CreatePlanGroupOptions {
  plannerId: string | null;
  creationMode: "unified" | "unified_batch";
  isSingleContent: boolean;
  singleContent?: ResolvedContentItem;
}

/**
 * Plan Group을 생성합니다.
 */
async function createPlanGroup(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: ValidatedPlanInput,
  options: CreatePlanGroupOptions,
  ctx: ActionContext
): Promise<{ id: string } | null> {
  const { plannerId, creationMode, isSingleContent, singleContent } = options;

  const { data, error } = await supabase
    .from("plan_groups")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      student_id: input.studentId,
      name: input.planName,
      plan_purpose: input.planPurpose,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: "active",
      scheduler_type: "1730_timetable",
      scheduler_options: {
        study_days: input.timetableSettings.studyDays,
        review_days: input.timetableSettings.reviewDays,
        student_level: input.timetableSettings.studentLevel,
      },

      // Phase 3: 플래너 연계 필드
      planner_id: plannerId,
      creation_mode: creationMode,
      is_single_content: isSingleContent,

      // 단일 콘텐츠 정보 (is_single_content = true인 경우)
      content_type: isSingleContent && singleContent ? singleContent.contentType : null,
      content_id: isSingleContent && singleContent ? singleContent.id : null,
      start_range: isSingleContent && singleContent ? singleContent.startRange : null,
      end_range: isSingleContent && singleContent ? singleContent.endRange : null,
    })
    .select("id")
    .single();

  if (error) {
    logActionError(ctx, error, {
      step: "createPlanGroup",
      planName: input.planName,
      studentId: input.studentId,
    });
    return null;
  }

  return data;
}

/**
 * Plan Contents를 생성합니다.
 */
async function createPlanContents(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planGroupId: string,
  contents: ContentResolutionResult["items"],
  tenantId: string,
  studentId: string,
  ctx: ActionContext
): Promise<{ success: boolean; ids: string[] }> {
  const contentRecords = contents.map((content, index) => ({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    student_id: studentId,
    plan_group_id: planGroupId,
    content_type: content.contentType,
    content_id: content.id,
    master_content_id: null,
    start_range: content.startRange,
    end_range: content.endRange,
    display_order: index,
  }));

  const { error } = await supabase.from("plan_contents").insert(contentRecords);

  if (error) {
    logActionError(ctx, error, {
      step: "createPlanContents",
      planGroupId,
      contentCount: contents.length,
    });
    return { success: false, ids: [] };
  }

  return { success: true, ids: contentRecords.map((r) => r.id) };
}

/**
 * Student Plans를 생성합니다.
 */
async function createStudentPlans(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planGroupId: string,
  plans: ScheduledPlan[],
  tenantId: string,
  studentId: string,
  ctx: ActionContext
): Promise<number> {
  const planRecords = plans.map((plan) => ({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    student_id: studentId,
    plan_group_id: planGroupId,
    plan_date: plan.plan_date,
    block_index: plan.block_index,
    content_type: plan.content_type,
    content_id: plan.content_id,
    planned_start_page_or_time: plan.planned_start_page_or_time,
    planned_end_page_or_time: plan.planned_end_page_or_time,
    start_time: plan.start_time ?? null,
    end_time: plan.end_time ?? null,
    is_reschedulable: plan.is_reschedulable,
    status: "pending",
    cycle_day_number: plan.cycle_day_number ?? null,
    date_type: plan.date_type ?? null,
    // Unified 파이프라인은 항상 실제 콘텐츠 기반 (Virtual Content 미지원)
    is_virtual: false,
  }));

  const { error } = await supabase.from("student_plans").insert(planRecords);

  if (error) {
    logActionError(ctx, error, {
      step: "createStudentPlans",
      planGroupId,
      planCount: plans.length,
    });
    return 0;
  }

  return planRecords.length;
}

/**
 * Plan Exclusions를 생성합니다.
 */
async function createPlanExclusions(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  exclusions: ValidatedPlanInput["exclusions"],
  tenantId: string,
  studentId: string,
  ctx: ActionContext
): Promise<void> {
  if (exclusions.length === 0) return;

  const exclusionRecords = exclusions.map((e) => ({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    student_id: studentId,
    plan_group_id: null,
    exclusion_date: e.date,
    exclusion_type: "personal",
    reason: e.reason ?? null,
  }));

  const { error } = await supabase
    .from("plan_exclusions")
    .insert(exclusionRecords);

  if (error) {
    // Exclusion 실패는 전체 트랜잭션을 중단하지 않음 (비필수 데이터)
    logActionWarn(ctx, "Plan exclusions creation failed (non-critical)", {
      step: "createPlanExclusions",
      exclusionCount: exclusions.length,
      error: error.message,
    });
  }
}

/**
 * Stage 6: DB 저장
 *
 * @param input - 검증된 입력 데이터
 * @param validationResult - 검증 결과
 * @param contentResolution - 콘텐츠 해결 결과
 * @returns 저장 결과 또는 에러
 */
export async function persist(
  input: ValidatedPlanInput,
  validationResult: ValidationResult,
  contentResolution: ContentResolutionResult
): Promise<StageResult<PersistenceResult>> {
  // 로깅 컨텍스트 생성
  const ctx = createPersistContext(input.tenantId, input.studentId);

  // DryRun 모드인 경우 저장하지 않음
  if (input.generationOptions.dryRun) {
    logActionDebug(ctx, "DryRun 모드 - DB 저장 스킵", {
      planName: input.planName,
    });
    return {
      success: false,
      error: "DryRun 모드에서는 저장이 비활성화됩니다",
      details: { dryRun: true },
    };
  }

  const supabase = await createSupabaseServerClient();

  // Phase 3: 플래너 확보 (공통 유틸리티 사용)
  const plannerResult = await ensurePlannerForPipeline({
    existingPlannerId: input.plannerId,
    studentId: input.studentId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    validationMode: input.plannerValidationMode ?? "auto_create",
  });

  // strict 모드에서 플래너 없으면 실패
  if (!plannerResult.success) {
    return {
      success: false,
      error: plannerResult.error || "플래너 확보에 실패했습니다",
    };
  }

  // 로깅
  if (plannerResult.isNew) {
    logActionDebug(ctx, "플래너 자동 생성 성공", {
      plannerId: plannerResult.plannerId,
      isNew: true,
    });
  } else if (plannerResult.hasWarning) {
    logActionWarn(ctx, "플래너 없이 계속 진행 (warn 모드)", {
      step: "ensurePlanner",
      validationMode: input.plannerValidationMode,
    });
  }

  const effectivePlannerId = plannerResult.plannerId;

  // 단일 콘텐츠 여부 판단
  const isSingleContent = contentResolution.items.length === 1;
  const singleContent = isSingleContent ? contentResolution.items[0] : undefined;
  const creationMode = input.creationMode ?? "unified";

  // 1. Plan Group 생성 (플래너 연계)
  const planGroup = await createPlanGroup(supabase, input, {
    plannerId: effectivePlannerId,
    creationMode,
    isSingleContent,
    singleContent,
  }, ctx);

  if (!planGroup) {
    return {
      success: false,
      error: "플랜 그룹 생성에 실패했습니다",
    };
  }

  // 롤백 헬퍼 함수
  const rollbackPlanGroup = async (reason: string) => {
    logActionWarn(ctx, `롤백 실행: ${reason}`, { planGroupId: planGroup.id });
    // CASCADE DELETE로 plan_contents도 함께 삭제됨
    await supabase.from("plan_groups").delete().eq("id", planGroup.id);
  };

  // 2. Plan Contents 생성 (다중 콘텐츠인 경우에만 - 레거시 호환)
  // P3-3: 레거시 데이터 경고 개선
  let savedContentIds: string[] = [];
  if (!isSingleContent && contentResolution.items.length > 1) {
    logActionWarn(ctx, "[레거시] plan_contents 테이블 사용 - 다중 콘텐츠 모드", {
      planGroupId: planGroup.id,
      contentCount: contentResolution.items.length,
      legacyInfo: {
        reason: "다중 콘텐츠 Plan Group은 plan_contents 조인 테이블 사용",
        impact: "쿼리 복잡도 증가, 플래너 통합 제한",
        newApproach: "단일 콘텐츠 모드(is_single_content: true)는 plan_groups 테이블에 직접 저장",
      },
    });
    const contentResult = await createPlanContents(
      supabase,
      planGroup.id,
      contentResolution.items,
      input.tenantId,
      input.studentId,
      ctx
    );

    if (!contentResult.success) {
      // Plan Contents 실패 시 롤백
      await rollbackPlanGroup("plan_contents 생성 실패");
      return {
        success: false,
        error: "플랜 콘텐츠 저장에 실패했습니다",
      };
    }
    savedContentIds = contentResult.ids;
  }

  // 3. Student Plans 생성
  const savedPlanCount = await createStudentPlans(
    supabase,
    planGroup.id,
    validationResult.plans,
    input.tenantId,
    input.studentId,
    ctx
  );

  if (savedPlanCount === 0) {
    // Student Plans 실패 시 롤백
    await rollbackPlanGroup("student_plans 생성 실패");
    return {
      success: false,
      error: "학습 플랜 저장에 실패했습니다",
    };
  }

  // 4. Plan Exclusions 생성 (실패해도 전체 트랜잭션 실패 처리 안 함)
  await createPlanExclusions(
    supabase,
    input.exclusions,
    input.tenantId,
    input.studentId,
    ctx
  );

  // 5. 결과 반환
  const totalDays = calculateDaysBetween(input.periodStart, input.periodEnd);

  const planGroupInfo: PlanGroupInfo = {
    id: planGroup.id,
    name: input.planName,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalDays,
    planCount: savedPlanCount,
  };

  const result: PersistenceResult = {
    planGroup: planGroupInfo,
    savedPlanCount,
    savedContentIds,
  };

  return { success: true, data: result };
}

/**
 * 두 날짜 사이의 일수를 계산합니다.
 */
function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}
