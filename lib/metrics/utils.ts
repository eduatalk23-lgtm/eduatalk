/**
 * Metrics 모듈 공통 유틸리티 함수
 */

import { logActionError } from "@/lib/utils/serverActionLogger";

/**
 * Date 객체를 YYYY-MM-DD 형식의 문자열로 변환
 * 
 * @param date - 변환할 Date 객체
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 * 
 * @example
 * ```typescript
 * const dateStr = toDateString(new Date('2025-01-15'));
 * // '2025-01-15'
 * ```
 */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 문자열 또는 Date 객체를 YYYY-MM-DD 형식의 문자열로 변환
 * 
 * @param date - 변환할 날짜 (Date 객체 또는 YYYY-MM-DD 형식 문자열)
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 * 
 * @example
 * ```typescript
 * const dateStr1 = normalizeDateString(new Date('2025-01-15'));
 * const dateStr2 = normalizeDateString('2025-01-15');
 * // 둘 다 '2025-01-15'
 * ```
 */
export function normalizeDateString(date: string | Date): string {
  if (typeof date === "string") {
    return date;
  }
  return toDateString(date);
}

/**
 * 주간 범위 계산
 * 
 * 오늘 날짜를 기준으로 이번 주의 시작일과 종료일을 계산합니다.
 * 주의 시작은 월요일, 종료는 일요일입니다.
 * 
 * @param today - 기준 날짜 (Date 객체 또는 YYYY-MM-DD 형식 문자열)
 * @returns 주간 시작일과 종료일
 * 
 * @example
 * ```typescript
 * const { weekStart, weekEnd } = calculateWeekRange(new Date('2025-01-15'));
 * // 2025-01-13(월) ~ 2025-01-19(일)
 * ```
 */
export function calculateWeekRange(today: string | Date): {
  weekStart: Date;
  weekEnd: Date;
} {
  const todayDate = typeof today === "string" ? new Date(today) : today;
  todayDate.setHours(0, 0, 0, 0);

  // 월요일을 주의 시작으로 설정
  const dayOfWeek = todayDate.getDay(); // 0(일) ~ 6(토)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 -6, 그 외는 1-dayOfWeek

  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() + mondayOffset);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // 일요일까지

  return { weekStart, weekEnd };
}

/**
 * 에러를 MetricsResult 형식으로 변환
 * 
 * @param error - 발생한 에러
 * @param context - 에러 발생 컨텍스트 (함수명 등)
 * @param defaultValue - 에러 발생 시 반환할 기본값
 * @returns MetricsResult 형식의 에러 결과
 * 
 * @example
 * ```typescript
 * try {
 *   // ...
 * } catch (error) {
 *   return handleMetricsError(error, '[metrics/getPlanCompletion]', {
 *     totalPlans: 0,
 *     completedPlans: 0,
 *     completionRate: 0,
 *   });
 * }
 * ```
 */
export function handleMetricsError<T>(
  error: unknown,
  context: string,
  defaultValue: T
): { success: false; error: string; code?: string; details?: unknown } {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const errorCode = error instanceof Error ? error.name : "UnknownError";
  
  logActionError("metrics.handleMetricsError", `${context} 실패: ${errorMessage}`);

  return {
    success: false,
    error: errorMessage,
    code: errorCode,
    details: error,
  };
}

/**
 * 에러 처리 래퍼 함수
 * 
 * 비동기 함수를 실행하고 에러 발생 시 자동으로 MetricsResult 형식으로 변환합니다.
 * 
 * @param fn - 실행할 비동기 함수
 * @param context - 에러 발생 컨텍스트
 * @param defaultValue - 에러 발생 시 반환할 기본값
 * @returns MetricsResult 형식의 결과
 * 
 * @example
 * ```typescript
 * return await withMetricsErrorHandling(
 *   async () => {
 *     // 메트릭 계산 로직
 *     return { totalPlans: 10, completedPlans: 8, completionRate: 80 };
 *   },
 *   '[metrics/getPlanCompletion]',
 *   { totalPlans: 0, completedPlans: 0, completionRate: 0 }
 * );
 * ```
 */
export async function withMetricsErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  defaultValue: T
): Promise<
  | { success: true; data: T }
  | { success: false; error: string; code?: string; details?: unknown }
> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return handleMetricsError(error, context, defaultValue);
  }
}

/**
 * null 또는 undefined 체크 후 기본값 반환
 * 
 * @param value - 체크할 값
 * @param defaultValue - null/undefined일 때 반환할 기본값
 * @returns 값이 null/undefined가 아니면 원래 값, 아니면 기본값
 * 
 * @example
 * ```typescript
 * const plans = nullToDefault(planRows, []);
 * // planRows가 null이면 [] 반환
 * ```
 */
export function nullToDefault<T>(value: T | null | undefined, defaultValue: T): T {
  return value ?? defaultValue;
}

/**
 * 배열이 null이거나 비어있는지 확인
 * 
 * @param arr - 확인할 배열
 * @returns 배열이 null이거나 비어있으면 true
 * 
 * @example
 * ```typescript
 * if (isEmptyArray(planRows)) {
 *   return { totalPlans: 0, completedPlans: 0, completionRate: 0 };
 * }
 * ```
 */
export function isEmptyArray<T>(arr: T[] | null | undefined): arr is null | undefined {
  return !arr || arr.length === 0;
}

/**
 * 타입 가드: 값이 null이 아니고 undefined도 아님을 확인
 * 
 * @param value - 확인할 값
 * @returns 값이 null/undefined가 아니면 true
 * 
 * @example
 * ```typescript
 * const rows = await safeQueryArray<Row>(...);
 * const validRows = rows.filter(isNotNull);
 * ```
 */
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * 타입 가드: 문자열이 null이 아니고 비어있지 않음을 확인
 * 
 * @param value - 확인할 문자열
 * @returns 문자열이 유효하면 true
 * 
 * @example
 * ```typescript
 * const validEvents = historyRows
 *   .filter(row => isNotNullString(row.event_type))
 *   .map(row => row.event_type);
 * ```
 */
export function isNotNullString(
  value: string | null | undefined
): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * 타입 가드: 숫자가 null이 아니고 유효한 숫자임을 확인
 * 
 * @param value - 확인할 숫자
 * @returns 숫자가 유효하면 true
 * 
 * @example
 * ```typescript
 * const validScores = scores
 *   .filter(score => isNotNullNumber(score.risk_score))
 *   .map(score => score.risk_score);
 * ```
 */
export function isNotNullNumber(
  value: number | null | undefined
): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * 안전한 배열 필터링: null/undefined 제거
 * 
 * @param arr - 필터링할 배열
 * @returns null/undefined가 제거된 배열
 * 
 * @example
 * ```typescript
 * const validRows = filterNotNull(rows);
 * ```
 */
export function filterNotNull<T>(
  arr: Array<T | null | undefined>
): T[] {
  return arr.filter(isNotNull) as T[];
}

