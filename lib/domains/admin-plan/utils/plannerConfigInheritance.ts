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

/**
 * 플래너 설정 (DB snake_case 형식)
 *
 * Supabase에서 직접 조회한 플래너 데이터 형식
 */
export interface PlannerConfigRaw {
  study_hours: TimeRange | null;
  self_study_hours: TimeRange | null;
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
 */
export interface PlanGroupCreationConfig {
  study_hours: TimeRange;
  self_study_hours: TimeRange;
  lunch_time: TimeRange;
  scheduler_type: string;
  scheduler_options: SchedulerOptions;
  block_set_id: string | null;
  non_study_time_blocks: unknown[] | null;
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
  return {
    study_hours: planner.study_hours ?? SCHEDULER_DEFAULTS.STUDY_HOURS,
    self_study_hours:
      planner.self_study_hours ?? SCHEDULER_DEFAULTS.SELF_STUDY_HOURS,
    lunch_time: planner.lunch_time ?? SCHEDULER_DEFAULTS.LUNCH_TIME,
    scheduler_type:
      planner.default_scheduler_type ?? SCHEDULER_DEFAULTS.TYPE,
    scheduler_options:
      (planner.default_scheduler_options as SchedulerOptions) ??
      SCHEDULER_DEFAULTS.OPTIONS,
    block_set_id: planner.block_set_id ?? null,
    non_study_time_blocks: planner.non_study_time_blocks ?? null,
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
  return {
    study_hours: planner.studyHours ?? SCHEDULER_DEFAULTS.STUDY_HOURS,
    self_study_hours:
      planner.selfStudyHours ?? SCHEDULER_DEFAULTS.SELF_STUDY_HOURS,
    lunch_time: planner.lunchTime ?? SCHEDULER_DEFAULTS.LUNCH_TIME,
    scheduler_type:
      planner.defaultSchedulerType ?? SCHEDULER_DEFAULTS.TYPE,
    scheduler_options:
      (planner.defaultSchedulerOptions as SchedulerOptions) ??
      SCHEDULER_DEFAULTS.OPTIONS,
    block_set_id: planner.blockSetId ?? null,
    non_study_time_blocks: planner.nonStudyTimeBlocks ?? null,
  };
}
