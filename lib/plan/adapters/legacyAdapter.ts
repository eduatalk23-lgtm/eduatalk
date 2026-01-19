/**
 * 레거시 스케줄러 어댑터
 *
 * Phase 2: 플랜 시스템 통합 - 하위 호환성
 *
 * 기존 generatePlansFromGroup 호출부가 새로운 Planner 기반 스케줄러와
 * 호환되도록 하는 어댑터 패턴 구현
 *
 * @module lib/plan/adapters/legacyAdapter
 */

import type { PlanGroup, SchedulerOptions } from "@/lib/types/plan/domain";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type {
  PlannerWithSchedulerOptions,
  SingleContentPlanGroup,
  ContentInfoWithPlanGroup,
  LegacyPlanContent,
  BlockInfo,
  PlanExclusionInfo,
  ScheduledPlanWithGroup,
} from "@/lib/types/plan/scheduler";

// ============================================
// 변환 함수
// ============================================

/**
 * PlanGroup을 가상 Planner로 변환
 *
 * 기존 PlanGroup + PlanContent[] 구조를 새로운 Planner 구조로 변환
 */
export function planGroupToVirtualPlanner(
  planGroup: PlanGroup
): PlannerWithSchedulerOptions {
  return {
    id: `virtual-planner-${planGroup.id}`,
    tenantId: planGroup.tenant_id,
    studentId: planGroup.student_id,
    name: planGroup.name || "Virtual Planner",
    periodStart: planGroup.period_start,
    periodEnd: planGroup.period_end,
    defaultSchedulerType: planGroup.scheduler_type || "1730_timetable",
    schedulerOptions: (planGroup.scheduler_options as SchedulerOptions) || {},
    studyHours: planGroup.study_hours || null,
    selfStudyHours: planGroup.self_study_hours || null,
    lunchTime: planGroup.lunch_time || null,
    blockSetId: planGroup.block_set_id,
    nonStudyTimeBlocks: planGroup.non_study_time_blocks,
  };
}

/**
 * PlanContent[]를 SingleContentPlanGroup[]으로 변환
 *
 * 각 PlanContent를 개별 SingleContentPlanGroup으로 변환
 */
export function planContentsToSingleContentGroups(
  planGroup: PlanGroup,
  contents: LegacyPlanContent[]
): SingleContentPlanGroup[] {
  return contents.map((content, index) => ({
    id: `virtual-group-${planGroup.id}-${index}`,
    tenantId: planGroup.tenant_id,
    studentId: planGroup.student_id,
    plannerId: `virtual-planner-${planGroup.id}`,
    name: `${planGroup.name || "플랜"} - 콘텐츠 ${index + 1}`,
    periodStart: planGroup.period_start,
    periodEnd: planGroup.period_end,
    status: planGroup.status,
    contentType: content.contentType,
    contentId: content.contentId,
    masterContentId: content.masterContentId,
    startRange: content.startRange,
    endRange: content.endRange,
    startDetailId: content.startDetailId,
    endDetailId: content.endDetailId,
    studyType: null,
    strategyDaysPerWeek: null,
    isSingleContent: true as const,
  }));
}

/**
 * SingleContentPlanGroup[]을 ContentInfoWithPlanGroup[]으로 변환
 */
export function singleContentGroupsToContentInfos(
  planGroups: SingleContentPlanGroup[]
): ContentInfoWithPlanGroup[] {
  return planGroups.map((pg) => ({
    contentId: pg.contentId,
    contentType: pg.contentType,
    masterContentId: pg.masterContentId,
    startRange: pg.startRange,
    endRange: pg.endRange,
    startDetailId: pg.startDetailId,
    endDetailId: pg.endDetailId,
    planGroupId: pg.id,
    studyType: pg.studyType,
    strategyDaysPerWeek: pg.strategyDaysPerWeek,
  }));
}

/**
 * ScheduledPlanWithGroup[]에서 plan_group_id 제거
 *
 * 기존 호출부 호환성을 위해 plan_group_id 필드 제거
 */
export function stripPlanGroupId(
  plans: ScheduledPlanWithGroup[]
): ScheduledPlan[] {
  return plans.map((plan) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { planGroupId, ...rest } = plan;
    return rest as ScheduledPlan;
  });
}

// ============================================
// 역변환 함수 (새 구조 → 레거시)
// ============================================

/**
 * Planner + SingleContentPlanGroup[]을 레거시 구조로 변환
 *
 * 새로운 구조로 생성된 데이터를 기존 PlanGroup + PlanContent[] 구조로 변환
 * (레거시 UI/API 호환성용)
 */
export function plannerToLegacyStructure(
  planner: PlannerWithSchedulerOptions,
  planGroups: SingleContentPlanGroup[]
): {
  planGroup: PlanGroup;
  contents: LegacyPlanContent[];
} {
  // 첫 번째 PlanGroup을 기준으로 레거시 PlanGroup 생성
  const basePlanGroup = planGroups[0];

  const planGroup: PlanGroup = {
    id: basePlanGroup?.id || planner.id,
    tenant_id: planner.tenantId,
    student_id: planner.studentId,
    name: planner.name,
    plan_purpose: null,
    scheduler_type: planner.defaultSchedulerType,
    scheduler_options: planner.schedulerOptions,
    period_start: planner.periodStart,
    period_end: planner.periodEnd,
    target_date: null,
    block_set_id: planner.blockSetId,
    planner_id: planner.id,
    status: "active",
    deleted_at: null,
    study_hours: planner.studyHours,
    self_study_hours: planner.selfStudyHours,
    lunch_time: planner.lunchTime,
    non_study_time_blocks: planner.nonStudyTimeBlocks,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const contents: LegacyPlanContent[] = planGroups.map((pg, index) => ({
    id: pg.id,
    planGroupId: planGroup.id,
    contentType: pg.contentType,
    contentId: pg.contentId,
    masterContentId: pg.masterContentId,
    startRange: pg.startRange,
    endRange: pg.endRange,
    startDetailId: pg.startDetailId,
    endDetailId: pg.endDetailId,
    displayOrder: index,
  }));

  return { planGroup, contents };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * DB 형식 PlanContent를 LegacyPlanContent로 변환
 */
export function dbPlanContentToLegacy(dbContent: {
  id: string;
  plan_group_id: string;
  content_type: string;
  content_id: string;
  master_content_id?: string | null;
  start_range: number;
  end_range: number;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
  display_order: number;
}): LegacyPlanContent {
  return {
    id: dbContent.id,
    planGroupId: dbContent.plan_group_id,
    contentType: dbContent.content_type,
    contentId: dbContent.content_id,
    masterContentId: dbContent.master_content_id,
    startRange: dbContent.start_range,
    endRange: dbContent.end_range,
    startDetailId: dbContent.start_detail_id,
    endDetailId: dbContent.end_detail_id,
    displayOrder: dbContent.display_order,
  };
}

/**
 * DB 형식 BlockInfo를 변환
 */
export function dbBlockToBlockInfo(dbBlock: {
  day_of_week: number;
  start_time: string;
  end_time: string;
}): BlockInfo {
  return {
    dayOfWeek: dbBlock.day_of_week,
    startTime: dbBlock.start_time,
    endTime: dbBlock.end_time,
  };
}

/**
 * DB 형식 Exclusion을 변환
 */
export function dbExclusionToPlanExclusionInfo(dbExclusion: {
  exclusion_date: string;
  exclusion_type: string;
  reason?: string | null;
}): PlanExclusionInfo {
  return {
    exclusionDate: dbExclusion.exclusion_date,
    exclusionType: dbExclusion.exclusion_type,
    reason: dbExclusion.reason,
  };
}

// ============================================
// 타입 가드
// ============================================

/**
 * Planner 기반 입력인지 확인
 */
export function isPlannerBasedInput(input: unknown): input is {
  planner: PlannerWithSchedulerOptions;
  planGroups: SingleContentPlanGroup[];
} {
  return (
    typeof input === "object" &&
    input !== null &&
    "planner" in input &&
    "planGroups" in input &&
    Array.isArray((input as { planGroups: unknown }).planGroups)
  );
}

/**
 * 레거시 PlanGroup 기반 입력인지 확인
 */
export function isLegacyPlanGroupInput(input: unknown): input is {
  planGroup: PlanGroup;
  contents: LegacyPlanContent[];
} {
  return (
    typeof input === "object" &&
    input !== null &&
    "planGroup" in input &&
    "contents" in input &&
    Array.isArray((input as { contents: unknown }).contents)
  );
}
