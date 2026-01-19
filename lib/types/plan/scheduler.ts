/**
 * 스케줄러 관련 타입 정의
 *
 * Phase 2: 플랜 시스템 통합 - 스케줄러 리팩토링
 * Planner 단위로 여러 PlanGroup을 조율하기 위한 타입 정의
 *
 * @module lib/types/plan/scheduler
 */

import type {
  SchedulerType,
  SchedulerOptions,
  PlanGroup,
  TimeRange,
  NonStudyTimeBlock,
  StudyHours,
  SelfStudyHours,
} from "./domain";
import type { ScheduledPlan } from "@/lib/plan/scheduler";

// ============================================
// Planner 관련 타입
// ============================================

/**
 * Planner + SchedulerOptions 통합 타입
 *
 * 스케줄러가 Planner 단위로 여러 PlanGroup을 조율할 때 사용
 */
export interface PlannerWithSchedulerOptions {
  id: string;
  tenantId: string;
  studentId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  defaultSchedulerType: SchedulerType;
  /**
   * 스케줄러 조율 옵션
   * - subject_allocations: 과목별 전략/취약 배정
   * - content_allocations: 콘텐츠별 배정 설정
   */
  schedulerOptions: SchedulerOptions;
  /** 학습 시간 설정 (PlanGroup.study_hours와 동일) */
  studyHours: StudyHours | null;
  /** 자율학습 시간 설정 (PlanGroup.self_study_hours와 동일) */
  selfStudyHours: SelfStudyHours | null;
  /** 점심 시간 설정 (Planner.lunch_time과 동일) */
  lunchTime: TimeRange | null;
  blockSetId: string | null;
  nonStudyTimeBlocks?: NonStudyTimeBlock[] | null;
}

// ============================================
// 단일 콘텐츠 PlanGroup 타입
// ============================================

/**
 * 단일 콘텐츠 PlanGroup
 *
 * is_single_content = true인 PlanGroup
 * content_* 필드가 필수로 채워져 있음을 보장
 */
export interface SingleContentPlanGroup {
  id: string;
  tenantId: string;
  studentId: string;
  plannerId: string;
  name: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  // 단일 콘텐츠 필드 (필수)
  contentType: string;
  contentId: string;
  masterContentId?: string | null;
  startRange: number;
  endRange: number;
  startDetailId?: string | null;
  endDetailId?: string | null;
  // 학습 유형
  studyType?: "strategy" | "weakness" | null;
  strategyDaysPerWeek?: number | null;
  // 플래그
  isSingleContent: true;
}

/**
 * PlanGroup → SingleContentPlanGroup 타입 가드
 */
export function isSingleContentPlanGroup(
  planGroup: PlanGroup
): planGroup is PlanGroup & {
  content_type: string;
  content_id: string;
  start_range: number;
  end_range: number;
  is_single_content: true;
} {
  return (
    planGroup.is_single_content === true &&
    planGroup.content_type != null &&
    planGroup.content_id != null &&
    planGroup.start_range != null &&
    planGroup.end_range != null
  );
}

// ============================================
// 스케줄러 내부 타입
// ============================================

/**
 * 스케줄러 내부 입력 파라미터
 *
 * generatePlansInternal 함수에서 사용
 */
export interface InternalGenerateParams {
  periodStart: string;
  periodEnd: string;
  schedulerType: SchedulerType;
  schedulerOptions: SchedulerOptions;
  contents: ContentInfoWithPlanGroup[];
  exclusions: PlanExclusionInfo[];
  blocks: BlockInfo[];
  options?: GeneratePlansOptions;
  /**
   * content_id → plan_group_id 매핑
   * 결과 ScheduledPlan에 plan_group_id를 설정하기 위해 사용
   */
  planGroupIdMap?: Map<string, string>;
}

/**
 * 확장된 ContentInfo (plan_group_id 포함)
 */
export interface ContentInfoWithPlanGroup {
  contentId: string;
  contentType: string;
  masterContentId?: string | null;
  startRange: number;
  endRange: number;
  startDetailId?: string | null;
  endDetailId?: string | null;
  /**
   * 이 콘텐츠가 속한 PlanGroup ID
   */
  planGroupId: string;
  /**
   * 학습 유형 (전략/취약)
   */
  studyType?: "strategy" | "weakness" | null;
  /**
   * 전략 과목 주당 학습일 (2-4)
   */
  strategyDaysPerWeek?: number | null;
  /**
   * 과목명 (subject_allocations 매칭용)
   */
  subjectName?: string | null;
}

/**
 * 제외일 정보
 */
export interface PlanExclusionInfo {
  exclusionDate: string;
  exclusionType: string;
  reason?: string | null;
}

/**
 * 블록 정보
 */
export interface BlockInfo {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * 플랜 생성 옵션
 */
export interface GeneratePlansOptions {
  autoAdjustOverlaps?: boolean;
  maxEndTime?: string;
}

// ============================================
// 스케줄러 결과 타입
// ============================================

/**
 * ScheduledPlan 확장 (plan_group_id 추가)
 *
 * 단일 콘텐츠 모드에서 생성된 플랜
 */
export interface ScheduledPlanWithGroup extends ScheduledPlan {
  /**
   * 생성된 PlanGroup ID (단일 콘텐츠 모드)
   */
  planGroupId?: string;
}

/**
 * 스케줄러 결과
 */
export interface SchedulerResult {
  success: boolean;
  plans: ScheduledPlanWithGroup[];
  errors?: string[];
  warnings?: string[];
  /**
   * 통계 정보
   */
  stats?: {
    totalPlans: number;
    studyPlans: number;
    reviewPlans: number;
    additionalReviewPlans: number;
    /** 블록 활용률 (%) */
    blockUtilization: number;
  };
}

// ============================================
// 어댑터 타입
// ============================================

/**
 * 레거시 PlanContent 타입 (plan_contents 테이블)
 *
 * 하위 호환성을 위해 유지
 */
export interface LegacyPlanContent {
  id: string;
  planGroupId: string;
  contentType: string;
  contentId: string;
  masterContentId?: string | null;
  startRange: number;
  endRange: number;
  startDetailId?: string | null;
  endDetailId?: string | null;
  displayOrder: number;
}

/**
 * 레거시 어댑터 입력
 */
export interface LegacyAdapterInput {
  planGroup: PlanGroup;
  contents: LegacyPlanContent[];
  exclusions: PlanExclusionInfo[];
  blocks: BlockInfo[];
  options?: GeneratePlansOptions;
}

// ============================================
// 유틸리티 타입
// ============================================

/**
 * PlanGroup을 SingleContentPlanGroup으로 변환
 */
export function toSingleContentPlanGroup(
  planGroup: PlanGroup
): SingleContentPlanGroup | null {
  if (!isSingleContentPlanGroup(planGroup)) {
    return null;
  }

  return {
    id: planGroup.id,
    tenantId: planGroup.tenant_id,
    studentId: planGroup.student_id,
    plannerId: planGroup.planner_id!,
    name: planGroup.name,
    periodStart: planGroup.period_start,
    periodEnd: planGroup.period_end,
    status: planGroup.status,
    contentType: planGroup.content_type,
    contentId: planGroup.content_id,
    masterContentId: planGroup.master_content_id,
    startRange: planGroup.start_range,
    endRange: planGroup.end_range,
    startDetailId: planGroup.start_detail_id,
    endDetailId: planGroup.end_detail_id,
    studyType: planGroup.study_type,
    strategyDaysPerWeek: planGroup.strategy_days_per_week,
    isSingleContent: true,
  };
}

/**
 * SingleContentPlanGroup을 ContentInfoWithPlanGroup으로 변환
 */
export function toContentInfoWithPlanGroup(
  planGroup: SingleContentPlanGroup
): ContentInfoWithPlanGroup {
  return {
    contentId: planGroup.contentId,
    contentType: planGroup.contentType,
    masterContentId: planGroup.masterContentId,
    startRange: planGroup.startRange,
    endRange: planGroup.endRange,
    startDetailId: planGroup.startDetailId,
    endDetailId: planGroup.endDetailId,
    planGroupId: planGroup.id,
    studyType: planGroup.studyType,
    strategyDaysPerWeek: planGroup.strategyDaysPerWeek,
  };
}

/**
 * plan_group_id 매핑 빌드
 */
export function buildPlanGroupIdMap(
  planGroups: SingleContentPlanGroup[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const pg of planGroups) {
    map.set(pg.contentId, pg.id);
  }
  return map;
}
