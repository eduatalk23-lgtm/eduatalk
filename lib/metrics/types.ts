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
 */
export type WeekRangeOptions = {
  weekStart: Date;
  weekEnd: Date;
};

/**
 * 날짜 기반 옵션
 */
export type DateBasedOptions = {
  todayDate: string | Date;
};

/**
 * 기본 메트릭 옵션
 */
export type BaseMetricsOptions = {
  studentId: string;
};

/**
 * 주간 메트릭 옵션
 */
export type WeeklyMetricsOptions = BaseMetricsOptions & WeekRangeOptions;

/**
 * 날짜 기반 메트릭 옵션
 */
export type DateBasedMetricsOptions = BaseMetricsOptions & DateBasedOptions;

/**
 * 메트릭 함수 표준 시그니처
 */
export type MetricsFunction<T, TOptions extends BaseMetricsOptions> = (
  supabase: SupabaseServerClient,
  options: TOptions
) => Promise<MetricsResult<T>>;

