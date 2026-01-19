/**
 * Planner 기반 스케줄러
 *
 * Phase 2: 플랜 시스템 통합 - 스케줄러 리팩토링
 *
 * 여러 단일 콘텐츠 PlanGroup을 Planner 단위로 조율하여 플랜 생성
 *
 * @module lib/plan/schedulerPlanner
 */

import type {
  PlannerWithSchedulerOptions,
  SingleContentPlanGroup,
  ContentInfoWithPlanGroup,
  PlanExclusionInfo,
  BlockInfo,
  GeneratePlansOptions,
  ScheduledPlanWithGroup,
  SchedulerResult,
} from "@/lib/types/plan/scheduler";
import type { AcademySchedule } from "@/lib/types/plan/domain";
import type { ContentType, ExclusionType } from "@/lib/types/common";
import type {
  ScheduledPlan,
  DateAvailableTimeRanges,
  DateTimeSlots,
  ContentDurationMap,
} from "./scheduler";
import {
  toContentInfoWithPlanGroup,
  buildPlanGroupIdMap,
} from "@/lib/types/plan/scheduler";
import {
  planGroupToVirtualPlanner,
  planContentsToSingleContentGroups,
  stripPlanGroupId,
} from "./adapters/legacyAdapter";
import type { LegacyPlanContent } from "@/lib/types/plan/scheduler";
import type { PlanGroup } from "@/lib/types/plan/domain";

// DateAvailableTimeRanges, DateTimeSlots, ContentDurationMap은
// ./scheduler에서 import

// ============================================
// 메인 함수
// ============================================

/**
 * Planner 단위로 플랜 생성
 *
 * 여러 SingleContentPlanGroup을 함께 조율하여 효율적인 플랜 생성
 *
 * @param planner - Planner 정보 (schedulerOptions 포함)
 * @param planGroups - 단일 콘텐츠 PlanGroup 배열
 * @param exclusions - 제외일 목록
 * @param academySchedules - 학원 일정 목록
 * @param blocks - 학습 블록 정보
 * @param options - 플랜 생성 옵션
 * @returns 스케줄러 결과
 */
export async function generatePlansFromPlanner(
  planner: PlannerWithSchedulerOptions,
  planGroups: SingleContentPlanGroup[],
  exclusions: PlanExclusionInfo[],
  academySchedules: AcademySchedule[],
  blocks: BlockInfo[],
  options?: {
    contentSubjects?: Map<string, { subject?: string | null; subject_category?: string | null }>;
    riskIndexMap?: Map<string, { riskScore: number }>;
    dateAvailableTimeRanges?: DateAvailableTimeRanges;
    dateTimeSlots?: DateTimeSlots;
    contentDurationMap?: ContentDurationMap;
    contentChapterMap?: Map<string, string | null>;
    generateOptions?: GeneratePlansOptions;
  }
): Promise<SchedulerResult> {
  // 1. 입력 검증
  if (!planGroups || planGroups.length === 0) {
    return {
      success: false,
      plans: [],
      errors: ["플랜 그룹이 없습니다."],
    };
  }

  // 모든 planGroup이 단일 콘텐츠 모드인지 확인
  for (const pg of planGroups) {
    if (!pg.isSingleContent) {
      return {
        success: false,
        plans: [],
        errors: [`플랜 그룹 ${pg.id}가 단일 콘텐츠 모드가 아닙니다.`],
      };
    }
  }

  // 2. ContentInfo 변환
  const contentInfos = planGroups.map((pg) => toContentInfoWithPlanGroup(pg));

  // 3. plan_group_id 매핑 빌드
  const planGroupIdMap = buildPlanGroupIdMap(planGroups);

  // 4. 기존 generatePlansFromGroup 호출을 위한 가상 PlanGroup 생성
  // (내부적으로 기존 로직 재사용)
  const virtualPlanGroup = createVirtualPlanGroup(planner, planGroups);
  const virtualContents = createVirtualContents(contentInfos, planner.tenantId);

  // 5. 기존 스케줄러 호출 (동적 import로 순환 참조 방지)
  const { generatePlansFromGroup } = await import("./scheduler");

  try {
    const result = await generatePlansFromGroup(
      virtualPlanGroup,
      virtualContents,
      exclusions.map((e, idx) => ({
        id: `virtual-exclusion-${idx}`,
        tenant_id: planner.tenantId,
        student_id: planner.studentId,
        plan_group_id: null,
        exclusion_date: e.exclusionDate,
        exclusion_type: e.exclusionType as ExclusionType,
        reason: e.reason ?? null,
        created_at: new Date().toISOString(),
      })),
      academySchedules,
      blocks.map((b, idx) => {
        const [startH, startM] = b.startTime.split(":").map(Number);
        const [endH, endM] = b.endTime.split(":").map(Number);
        const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        return {
          id: `virtual-block-${idx}`,
          day_of_week: b.dayOfWeek,
          block_index: idx,
          start_time: b.startTime,
          end_time: b.endTime,
          duration_minutes: durationMinutes,
        };
      }),
      options?.contentSubjects,
      options?.riskIndexMap,
      options?.dateAvailableTimeRanges,
      options?.dateTimeSlots,
      options?.contentDurationMap,
      options?.contentChapterMap,
      undefined, // periodStart
      undefined, // periodEnd
      undefined, // existingPlans
      options?.generateOptions
    );

    // 6. 결과에 plan_group_id 추가
    const plansWithGroupId: ScheduledPlanWithGroup[] = result.plans.map((plan) => ({
      ...plan,
      planGroupId: planGroupIdMap.get(plan.content_id),
    }));

    // 7. 통계 계산
    const stats = calculateStats(plansWithGroupId, blocks);

    return {
      success: true,
      plans: plansWithGroupId,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      plans: [],
      errors: [error instanceof Error ? error.message : "플랜 생성 중 오류 발생"],
    };
  }
}

/**
 * 레거시 호환 함수
 *
 * 기존 PlanGroup + PlanContent[] 구조를 새 구조로 변환 후 처리
 */
export async function generatePlansFromGroupLegacy(
  planGroup: PlanGroup,
  contents: LegacyPlanContent[],
  exclusions: PlanExclusionInfo[],
  academySchedules: AcademySchedule[],
  blocks: BlockInfo[],
  options?: {
    contentSubjects?: Map<string, { subject?: string | null; subject_category?: string | null }>;
    riskIndexMap?: Map<string, { riskScore: number }>;
    dateAvailableTimeRanges?: DateAvailableTimeRanges;
    dateTimeSlots?: DateTimeSlots;
    contentDurationMap?: ContentDurationMap;
    contentChapterMap?: Map<string, string | null>;
    generateOptions?: GeneratePlansOptions;
  }
): Promise<ScheduledPlan[]> {
  // 1. 레거시 구조를 새 구조로 변환
  const virtualPlanner = planGroupToVirtualPlanner(planGroup);
  const singleContentGroups = planContentsToSingleContentGroups(planGroup, contents);

  // 2. 새 함수 호출
  const result = await generatePlansFromPlanner(
    virtualPlanner,
    singleContentGroups,
    exclusions,
    academySchedules,
    blocks,
    options
  );

  if (!result.success) {
    throw new Error(result.errors?.join(", ") || "플랜 생성 실패");
  }

  // 3. plan_group_id 제거 (레거시 호환성)
  return stripPlanGroupId(result.plans);
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 가상 PlanGroup 생성 (기존 스케줄러 호출용)
 *
 * Phase 2.4: SingleContentPlanGroup[]에서 content_allocations 자동 빌드
 */
function createVirtualPlanGroup(
  planner: PlannerWithSchedulerOptions,
  planGroups: SingleContentPlanGroup[]
): PlanGroup {
  // Phase 2.4: SingleContentPlanGroup에서 content_allocations 빌드
  const contentAllocations = buildContentAllocationsFromGroups(planGroups);

  // 기존 schedulerOptions와 병합
  const mergedSchedulerOptions = {
    ...planner.schedulerOptions,
    // content_allocations: planGroups에서 빌드한 것으로 대체
    // (기존 설정보다 planGroup 설정이 우선)
    content_allocations: contentAllocations.length > 0
      ? contentAllocations
      : planner.schedulerOptions?.content_allocations,
  };

  return {
    id: `virtual-${planner.id}`,
    tenant_id: planner.tenantId,
    student_id: planner.studentId,
    name: planner.name,
    plan_purpose: null,
    scheduler_type: planner.defaultSchedulerType,
    scheduler_options: mergedSchedulerOptions,
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
}

/**
 * Phase 2.4: SingleContentPlanGroup[]에서 content_allocations 빌드
 *
 * 각 planGroup의 studyType과 strategyDaysPerWeek을 사용하여
 * SchedulerEngine이 이해할 수 있는 content_allocations 형식으로 변환
 */
function buildContentAllocationsFromGroups(
  planGroups: SingleContentPlanGroup[]
): Array<{
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number;
}> {
  return planGroups
    .filter((pg) => pg.studyType) // studyType이 설정된 것만
    .map((pg) => ({
      content_type: pg.contentType as "book" | "lecture" | "custom",
      content_id: pg.contentId,
      subject_type: pg.studyType as "strategy" | "weakness",
      weekly_days: pg.studyType === "strategy"
        ? (pg.strategyDaysPerWeek ?? 3)
        : undefined,
    }));
}

/**
 * 가상 PlanContent 생성 (기존 스케줄러 호출용)
 */
function createVirtualContents(
  contentInfos: ContentInfoWithPlanGroup[],
  tenantId: string
): Array<{
  id: string;
  tenant_id: string;
  plan_group_id: string;
  content_type: ContentType;
  content_id: string;
  master_content_id?: string | null;
  start_range: number;
  end_range: number;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}> {
  const now = new Date().toISOString();
  return contentInfos.map((ci, index) => ({
    id: `virtual-content-${ci.planGroupId}`,
    tenant_id: tenantId,
    plan_group_id: ci.planGroupId,
    content_type: ci.contentType as ContentType,
    content_id: ci.contentId,
    master_content_id: ci.masterContentId,
    start_range: ci.startRange,
    end_range: ci.endRange,
    start_detail_id: ci.startDetailId,
    end_detail_id: ci.endDetailId,
    display_order: index,
    created_at: now,
    updated_at: now,
  }));
}

/**
 * 통계 계산
 */
function calculateStats(
  plans: ScheduledPlanWithGroup[],
  blocks: BlockInfo[]
): SchedulerResult["stats"] {
  const studyPlans = plans.filter((p) => p.date_type === "study");
  const reviewPlans = plans.filter((p) => p.date_type === "review");
  // note: "additional_review"는 현재 ScheduledPlan.date_type에 포함되지 않음
  const additionalReviewPlans: ScheduledPlanWithGroup[] = [];

  // 블록 활용률 계산 (간략화)
  const totalBlockMinutes = blocks.reduce((sum, b) => {
    const [startH, startM] = b.startTime.split(":").map(Number);
    const [endH, endM] = b.endTime.split(":").map(Number);
    return sum + (endH * 60 + endM) - (startH * 60 + startM);
  }, 0);

  const totalPlanMinutes = plans.reduce((sum, p) => {
    if (!p.start_time || !p.end_time) return sum;
    const [startH, startM] = p.start_time.split(":").map(Number);
    const [endH, endM] = p.end_time.split(":").map(Number);
    return sum + (endH * 60 + endM) - (startH * 60 + startM);
  }, 0);

  const uniqueDates = new Set(plans.map((p) => p.plan_date)).size;
  const totalAvailableMinutes = totalBlockMinutes * uniqueDates;
  const blockUtilization = totalAvailableMinutes > 0
    ? Math.round((totalPlanMinutes / totalAvailableMinutes) * 100)
    : 0;

  return {
    totalPlans: plans.length,
    studyPlans: studyPlans.length,
    reviewPlans: reviewPlans.length,
    additionalReviewPlans: additionalReviewPlans.length,
    blockUtilization,
  };
}

// ============================================
// Export
// ============================================

export type {
  PlannerWithSchedulerOptions,
  SingleContentPlanGroup,
  SchedulerResult,
  ScheduledPlanWithGroup,
};
