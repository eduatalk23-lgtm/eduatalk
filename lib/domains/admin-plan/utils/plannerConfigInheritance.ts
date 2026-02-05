/**
 * 플래너 설정 상속 유틸리티
 *
 * 플래너에서 플랜 그룹으로 설정을 상속할 때 사용되는 함수들입니다.
 * 중복 코드를 제거하고 일관된 기본값 처리를 보장합니다.
 *
 * @module lib/domains/admin-plan/utils/plannerConfigInheritance
 */

import {
  SCHEDULER_DEFAULTS,
  type TimeRange,
  type SchedulerOptions,
} from "../constants/schedulerDefaults";

// ============================================
// 비학습시간 블록 타입
// ============================================

export interface NonStudyTimeBlock {
  type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "기타";
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  day_of_week?: number[]; // 0-6, 없으면 매일
  specific_dates?: string[]; // 특정 날짜 지정 (YYYY-MM-DD)
  description?: string;
}

// ============================================
// lunch_time → non_study_time_blocks 통합 헬퍼
// ============================================

/**
 * lunch_time을 non_study_time_blocks에 통합
 *
 * 우선순위:
 * 1. non_study_time_blocks에 "점심식사"가 이미 있으면 그대로 반환
 * 2. 없으면 lunch_time을 "점심식사" 블록으로 추가
 *
 * @param lunchTime 레거시 lunch_time 필드
 * @param nonStudyTimeBlocks 기존 non_study_time_blocks 배열
 * @returns 통합된 non_study_time_blocks 배열
 */
export function mergeLunchTimeIntoNonStudyBlocks(
  lunchTime: TimeRange | null | undefined,
  nonStudyTimeBlocks: unknown[] | null | undefined
): NonStudyTimeBlock[] {
  const blocks = (nonStudyTimeBlocks || []) as NonStudyTimeBlock[];

  // non_study_time_blocks에 "점심식사"가 이미 있으면 그대로 반환
  const hasLunchBlock = blocks.some((block) => block.type === "점심식사");
  if (hasLunchBlock) {
    return blocks;
  }

  // lunch_time이 있으면 "점심식사" 블록으로 추가
  if (lunchTime?.start && lunchTime?.end) {
    return [
      ...blocks,
      {
        type: "점심식사" as const,
        start_time: lunchTime.start,
        end_time: lunchTime.end,
        // day_of_week 없음 = 매일 적용
      },
    ];
  }

  // 둘 다 없으면 기본 점심시간 추가
  return [
    ...blocks,
    {
      type: "점심식사" as const,
      start_time: SCHEDULER_DEFAULTS.LUNCH_TIME.start,
      end_time: SCHEDULER_DEFAULTS.LUNCH_TIME.end,
    },
  ];
}

/**
 * non_study_time_blocks에서 점심시간 추출
 *
 * @param nonStudyTimeBlocks non_study_time_blocks 배열
 * @returns 점심시간 TimeRange 또는 null
 */
export function extractLunchTimeFromBlocks(
  nonStudyTimeBlocks: unknown[] | null | undefined
): TimeRange | null {
  const blocks = (nonStudyTimeBlocks || []) as NonStudyTimeBlock[];
  const lunchBlock = blocks.find((block) => block.type === "점심식사");

  if (lunchBlock) {
    return {
      start: lunchBlock.start_time,
      end: lunchBlock.end_time,
    };
  }

  return null;
}

// ============================================
// 플래너 설정 인터페이스
// ============================================

/**
 * 플래너 설정 (DB snake_case 형식)
 *
 * Supabase에서 직접 조회한 플래너 데이터 형식
 */
export interface PlannerConfigRaw {
  study_hours: TimeRange | null;
  self_study_hours: TimeRange | null;
  /** @deprecated non_study_time_blocks의 "점심식사" 타입으로 통합됨 */
  lunch_time: TimeRange | null;
  default_scheduler_type: string | null;
  default_scheduler_options: Record<string, unknown> | null;
  block_set_id: string | null;
  non_study_time_blocks: unknown[] | null;
}

/**
 * 플래너 설정 (앱 camelCase 형식)
 *
 * Planner 인터페이스와 호환되는 형식
 */
export interface PlannerConfigCamel {
  studyHours: TimeRange | null;
  selfStudyHours: TimeRange | null;
  /** @deprecated non_study_time_blocks의 "점심식사" 타입으로 통합됨 */
  lunchTime: TimeRange | null;
  defaultSchedulerType: string | null;
  defaultSchedulerOptions: Record<string, unknown> | null;
  blockSetId: string | null;
  nonStudyTimeBlocks: unknown[] | null;
}

/**
 * 플랜 그룹 생성용 설정 (DB snake_case 형식)
 *
 * plan_groups 테이블에 삽입할 때 사용되는 형식
 *
 * NOTE: lunch_time은 하위 호환성을 위해 유지되지만,
 * 실제 점심시간은 non_study_time_blocks의 "점심식사" 타입에서 추출됩니다.
 */
export interface PlanGroupCreationConfig {
  study_hours: TimeRange;
  self_study_hours: TimeRange;
  /** @deprecated non_study_time_blocks의 "점심식사"에서 추출됨. 하위 호환성 유지용. */
  lunch_time: TimeRange;
  scheduler_type: string;
  scheduler_options: SchedulerOptions;
  block_set_id: string | null;
  /** 통합된 비학습시간 블록 (점심식사 포함) */
  non_study_time_blocks: NonStudyTimeBlock[] | null;
}

/**
 * 플래너 설정을 플랜 그룹 생성용 설정으로 변환 (Raw DB 형식)
 *
 * Supabase에서 조회한 플래너 데이터를 플랜 그룹 생성에 필요한 형식으로 변환합니다.
 * 누락된 값은 SCHEDULER_DEFAULTS에서 기본값을 사용합니다.
 *
 * @param planner - Supabase에서 조회한 플래너 데이터 (snake_case)
 * @returns 플랜 그룹 생성용 설정
 *
 * @example
 * ```typescript
 * const { data: planner } = await supabase
 *   .from("planners")
 *   .select("study_hours, self_study_hours, ...")
 *   .single();
 *
 * const config = inheritPlannerConfigFromRaw(planner);
 * await supabase.from("plan_groups").insert({ ...config, ... });
 * ```
 */
export function inheritPlannerConfigFromRaw(
  planner: PlannerConfigRaw
): PlanGroupCreationConfig {
  // lunch_time을 non_study_time_blocks에 통합
  const mergedBlocks = mergeLunchTimeIntoNonStudyBlocks(
    planner.lunch_time,
    planner.non_study_time_blocks
  );

  // 하위 호환성을 위해 lunch_time 필드도 설정 (non_study_time_blocks에서 추출)
  const lunchTime =
    extractLunchTimeFromBlocks(mergedBlocks) ?? SCHEDULER_DEFAULTS.LUNCH_TIME;

  return {
    study_hours: planner.study_hours ?? SCHEDULER_DEFAULTS.STUDY_HOURS,
    self_study_hours:
      planner.self_study_hours ?? SCHEDULER_DEFAULTS.SELF_STUDY_HOURS,
    lunch_time: lunchTime,
    scheduler_type:
      planner.default_scheduler_type ?? SCHEDULER_DEFAULTS.TYPE,
    scheduler_options:
      (planner.default_scheduler_options as SchedulerOptions) ??
      SCHEDULER_DEFAULTS.OPTIONS,
    block_set_id: planner.block_set_id ?? null,
    non_study_time_blocks: mergedBlocks,
  };
}

/**
 * 플래너 설정을 플랜 그룹 생성용 설정으로 변환 (Camel 형식)
 *
 * Planner 인터페이스 형식의 데이터를 플랜 그룹 생성에 필요한 형식으로 변환합니다.
 * 누락된 값은 SCHEDULER_DEFAULTS에서 기본값을 사용합니다.
 *
 * @param planner - Planner 인터페이스 형식의 데이터 (camelCase)
 * @returns 플랜 그룹 생성용 설정
 *
 * @example
 * ```typescript
 * const planner = await getPlanner(plannerId);
 * const config = inheritPlannerConfig(planner);
 * await supabase.from("plan_groups").insert({ ...config, ... });
 * ```
 */
export function inheritPlannerConfig(
  planner: PlannerConfigCamel
): PlanGroupCreationConfig {
  // lunch_time을 non_study_time_blocks에 통합
  const mergedBlocks = mergeLunchTimeIntoNonStudyBlocks(
    planner.lunchTime,
    planner.nonStudyTimeBlocks
  );

  // 하위 호환성을 위해 lunch_time 필드도 설정 (non_study_time_blocks에서 추출)
  const lunchTime =
    extractLunchTimeFromBlocks(mergedBlocks) ?? SCHEDULER_DEFAULTS.LUNCH_TIME;

  return {
    study_hours: planner.studyHours ?? SCHEDULER_DEFAULTS.STUDY_HOURS,
    self_study_hours:
      planner.selfStudyHours ?? SCHEDULER_DEFAULTS.SELF_STUDY_HOURS,
    lunch_time: lunchTime,
    scheduler_type:
      planner.defaultSchedulerType ?? SCHEDULER_DEFAULTS.TYPE,
    scheduler_options:
      (planner.defaultSchedulerOptions as SchedulerOptions) ??
      SCHEDULER_DEFAULTS.OPTIONS,
    block_set_id: planner.blockSetId ?? null,
    non_study_time_blocks: mergedBlocks,
  };
}
