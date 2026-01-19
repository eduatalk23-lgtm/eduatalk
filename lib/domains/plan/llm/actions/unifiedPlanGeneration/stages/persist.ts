/**
 * Stage 6: DB 저장
 *
 * 생성된 플랜을 데이터베이스에 저장합니다.
 * - PlanGroup 생성
 * - ScheduledPlan들을 student_plans 테이블에 저장
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type {
  ValidatedPlanInput,
  ValidationResult,
  ContentResolutionResult,
  PersistenceResult,
  PlanGroupInfo,
  StageResult,
} from "../types";

/**
 * Plan Group을 생성합니다.
 */
async function createPlanGroup(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: ValidatedPlanInput
): Promise<{ id: string } | null> {
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
    })
    .select("id")
    .single();

  if (error) {
    console.error("Plan group creation failed:", error);
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
  studentId: string
): Promise<string[]> {
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
    console.error("Plan contents creation failed:", error);
    return [];
  }

  return contentRecords.map((r) => r.id);
}

/**
 * Student Plans를 생성합니다.
 */
async function createStudentPlans(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planGroupId: string,
  plans: ScheduledPlan[],
  tenantId: string,
  studentId: string
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
  }));

  const { error } = await supabase.from("student_plans").insert(planRecords);

  if (error) {
    console.error("Student plans creation failed:", error);
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
  studentId: string
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
    console.error("Plan exclusions creation failed:", error);
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
  // DryRun 모드인 경우 저장하지 않음
  if (input.generationOptions.dryRun) {
    return {
      success: false,
      error: "DryRun 모드에서는 저장이 비활성화됩니다",
      details: { dryRun: true },
    };
  }

  const supabase = await createSupabaseServerClient();

  // 1. Plan Group 생성
  const planGroup = await createPlanGroup(supabase, input);
  if (!planGroup) {
    return {
      success: false,
      error: "플랜 그룹 생성에 실패했습니다",
    };
  }

  // 2. Plan Contents 생성
  const savedContentIds = await createPlanContents(
    supabase,
    planGroup.id,
    contentResolution.items,
    input.tenantId,
    input.studentId
  );

  // 3. Student Plans 생성
  const savedPlanCount = await createStudentPlans(
    supabase,
    planGroup.id,
    validationResult.plans,
    input.tenantId,
    input.studentId
  );

  if (savedPlanCount === 0) {
    // 롤백: 플랜 그룹 삭제
    await supabase.from("plan_groups").delete().eq("id", planGroup.id);
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
    input.studentId
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
