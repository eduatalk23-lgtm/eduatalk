import type { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Metrics 모듈 공통 타입 정의
 */

/**
 * Supabase 서버 클라이언트 타입
 */
export type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * Metrics 함수 결과 타입
 * 
 * 성공 시 data를 반환하고, 실패 시 error 정보를 포함합니다.
 * 
 * @example
 * ```typescript
 * const result = await getPlanCompletion(supabase, options);
 * if (result.success) {
 *   console.log(result.data.completionRate);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export type MetricsResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; details?: unknown };

/**
 * 주간 범위 옵션
 * 
 * 주간 메트릭 조회에 사용되는 날짜 범위를 정의합니다.
 * 
 * @property weekStart - 주간 시작일 (일반적으로 월요일)
 * @property weekEnd - 주간 종료일 (일반적으로 일요일)
 */
export type WeekRangeOptions = {
  weekStart: Date;
  weekEnd: Date;
};

/**
 * 날짜 기반 옵션
 * 
 * 특정 날짜를 기준으로 메트릭을 조회할 때 사용합니다.
 * 
 * @property todayDate - 기준 날짜 (Date 객체 또는 YYYY-MM-DD 형식 문자열)
 */
export type DateBasedOptions = {
  todayDate: string | Date;
};

/**
 * 기본 메트릭 옵션
 * 
 * 모든 메트릭 함수에 공통으로 필요한 옵션입니다.
 * 
 * @property studentId - 학생 ID
 */
export type BaseMetricsOptions = {
  studentId: string;
};

/**
 * 주간 메트릭 옵션
 * 
 * 주간 범위를 사용하는 메트릭 함수에 사용됩니다.
 * 예: getPlanCompletion, getWeakSubjects, getStudyTime
 */
export type WeeklyMetricsOptions = BaseMetricsOptions & WeekRangeOptions;

/**
 * 날짜 기반 메트릭 옵션
 * 
 * 특정 날짜를 기준으로 하는 메트릭 함수에 사용됩니다.
 * 예: getHistoryPattern, getGoalStatus
 */
export type DateBasedMetricsOptions = BaseMetricsOptions & DateBasedOptions;

/**
 * 메트릭 함수 표준 시그니처
 * 
 * 모든 메트릭 함수가 따라야 하는 표준 시그니처입니다.
 * 
 * @template T - 반환할 메트릭 데이터 타입
 * @template TOptions - 함수 옵션 타입 (BaseMetricsOptions를 확장)
 * 
 * @example
 * ```typescript
 * const myMetricsFunction: MetricsFunction<MyMetrics, WeeklyMetricsOptions> = async (
 *   supabase,
 *   options
 * ) => {
 *   // 구현
 * };
 * ```
 */
export type MetricsFunction<T, TOptions extends BaseMetricsOptions> = (
  supabase: SupabaseServerClient,
  options: TOptions
) => Promise<MetricsResult<T>>;

