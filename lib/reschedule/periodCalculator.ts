/**
 * 재조정 기간 계산기
 * 
 * 재조정 기간을 오늘 이후로 결정합니다.
 * 과거 날짜는 재조정 대상에서 제외하고, 오늘 다음날부터 재조정을 시작합니다.
 * 
 * @module lib/reschedule/periodCalculator
 */

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 기간
 */
export interface AdjustedPeriod {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * 기간 계산 결과
 */
export interface PeriodCalculationResult {
  period: AdjustedPeriod;
  adjustedFromToday: boolean; // 오늘 이후로 조정되었는지
  originalStart?: string;     // 원래 시작일 (조정된 경우)
  availableDays: number;      // 사용 가능한 일수
}

/**
 * 기간 계산 에러
 */
export class PeriodCalculationError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_REMAINING_PERIOD' | 'INVALID_DATE_RANGE' | 'PAST_DATE_RANGE'
  ) {
    super(message);
    this.name = 'PeriodCalculationError';
  }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 오늘 날짜 가져오기 (YYYY-MM-DD 형식)
 */
export function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * 다음날 날짜 가져오기
 */
export function getNextDayString(dateString: string): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

/**
 * 두 날짜 사이의 일수 계산
 */
export function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // 시작일, 종료일 포함
}

/**
 * 날짜 비교 (a < b)
 */
export function isDateBefore(a: string, b: string): boolean {
  return new Date(a) < new Date(b);
}

/**
 * 날짜 비교 (a <= b)
 */
export function isDateBeforeOrEqual(a: string, b: string): boolean {
  return new Date(a) <= new Date(b);
}

// ============================================
// 재조정 기간 결정 함수
// ============================================

/**
 * 재조정 기간 결정
 * 
 * 오늘 이후의 재조정 기간을 결정합니다.
 * 
 * @param dateRange 사용자가 선택한 날짜 범위 (null이면 전체 재조정)
 * @param today 오늘 날짜 (YYYY-MM-DD)
 * @param groupEnd 플랜 그룹 종료일 (YYYY-MM-DD)
 * @param includeToday 오늘 날짜 포함 여부 (기본값: false)
 * @returns 재조정 기간 (start, end)
 * @throws PeriodCalculationError 기간이 유효하지 않은 경우
 * 
 * @example
 * ```ts
 * // 전체 재조정
 * const period = getAdjustedPeriod(null, '2025-12-10', '2025-12-31');
 * // { start: '2025-12-11', end: '2025-12-31' }
 * 
 * // 날짜 범위 지정
 * const period = getAdjustedPeriod(
 *   { from: '2025-12-05', to: '2025-12-20' },
 *   '2025-12-10',
 *   '2025-12-31'
 * );
 * // { start: '2025-12-11', end: '2025-12-20' }
 * 
 * // 오늘 날짜 포함
 * const period = getAdjustedPeriod(
 *   null,
 *   '2025-12-10',
 *   '2025-12-31',
 *   true
 * );
 * // { start: '2025-12-10', end: '2025-12-31' }
 * ```
 */
export function getAdjustedPeriod(
  dateRange: { from: string; to: string } | null,
  today: string,
  groupEnd: string,
  includeToday: boolean = false
): AdjustedPeriod {
  const startDate = includeToday ? today : getNextDayString(today);
  const tomorrow = getNextDayString(today);

  // 전체 재조정 (날짜 범위 미지정)
  if (!dateRange) {
    // 오늘 이후 기간이 남아있는지 확인
    if (isDateBefore(groupEnd, startDate)) {
      throw new PeriodCalculationError(
        '재조정할 기간이 남아있지 않습니다. 플랜 그룹 종료일이 오늘 이전입니다.',
        'NO_REMAINING_PERIOD'
      );
    }

    return {
      start: startDate,
      end: groupEnd,
    };
  }

  // 날짜 범위 지정된 경우
  const { from, to } = dateRange;

  // 날짜 범위 유효성 검증
  if (isDateBefore(to, from)) {
    throw new PeriodCalculationError(
      '종료일이 시작일보다 이전입니다.',
      'INVALID_DATE_RANGE'
    );
  }

  // 선택한 범위가 모두 시작일 이전인 경우
  if (isDateBefore(to, startDate)) {
    throw new PeriodCalculationError(
      '선택한 날짜 범위에 유효한 기간이 포함되지 않았습니다.',
      'PAST_DATE_RANGE'
    );
  }

  // 시작일 조정: 시작일 이후로 설정
  const adjustedStart = isDateBefore(from, startDate) ? startDate : from;

  // 종료일: groupEnd를 초과하지 않도록 (선택사항)
  const adjustedEnd = isDateBefore(groupEnd, to) ? groupEnd : to;

  return {
    start: adjustedStart,
    end: adjustedEnd,
  };
}

/**
 * 재조정 기간 결정 (상세 결과)
 * 
 * 조정 여부와 사용 가능한 일수 등 상세 정보를 함께 반환합니다.
 * 
 * @param dateRange 사용자가 선택한 날짜 범위
 * @param today 오늘 날짜
 * @param groupEnd 플랜 그룹 종료일
 * @param includeToday 오늘 날짜 포함 여부 (기본값: false)
 * @returns 기간 계산 상세 결과
 */
export function getAdjustedPeriodWithDetails(
  dateRange: { from: string; to: string } | null,
  today: string,
  groupEnd: string,
  includeToday: boolean = false
): PeriodCalculationResult {
  const tomorrow = getNextDayString(today);
  const startDate = includeToday ? today : tomorrow;
  const period = getAdjustedPeriod(dateRange, today, groupEnd, includeToday);

  const wasAdjusted = dateRange
    ? isDateBefore(dateRange.from, startDate)
    : false;

  return {
    period,
    adjustedFromToday: wasAdjusted,
    originalStart: wasAdjusted && dateRange ? dateRange.from : undefined,
    availableDays: getDaysBetween(period.start, period.end),
  };
}

/**
 * 재조정 기간 검증
 * 
 * 지정된 날짜 범위가 유효한지 검증합니다.
 * 
 * @param dateRange 검증할 날짜 범위
 * @param today 오늘 날짜
 * @param groupEnd 플랜 그룹 종료일
 * @returns 유효성 검증 결과
 */
export function validateReschedulePeriod(
  dateRange: { from: string; to: string } | null,
  today: string,
  groupEnd: string,
  includeToday: boolean = false
): { valid: boolean; error?: string; errorCode?: PeriodCalculationError['code'] } {
  try {
    getAdjustedPeriod(dateRange, today, groupEnd, includeToday);
    return { valid: true };
  } catch (error) {
    if (error instanceof PeriodCalculationError) {
      return {
        valid: false,
        error: error.message,
        errorCode: error.code,
      };
    }
    return {
      valid: false,
      error: '알 수 없는 오류가 발생했습니다.',
    };
  }
}

/**
 * 통합된 기간 계산 함수
 * 
 * placementDateRange가 있으면 우선 사용하고,
 * 없으면 rescheduleDateRange를 기반으로 자동 계산합니다.
 * 
 * @param placementDateRange 수동으로 선택한 배치 범위
 * @param rescheduleDateRange 재조정할 플랜 범위
 * @param today 오늘 날짜
 * @param groupEnd 플랜 그룹 종료일
 * @param includeToday 오늘 날짜 포함 여부
 * @returns 조정된 기간
 * @throws PeriodCalculationError 기간이 유효하지 않은 경우
 * 
 * @example
 * ```ts
 * // placementDateRange 우선 사용
 * const period = calculateAdjustedPeriodUnified(
 *   { from: '2025-12-15', to: '2025-12-20' },
 *   { from: '2025-12-10', to: '2025-12-25' },
 *   '2025-12-10',
 *   '2025-12-31'
 * );
 * // { start: '2025-12-15', end: '2025-12-20' }
 * 
 * // placementDateRange가 없으면 rescheduleDateRange 기반 자동 계산
 * const period = calculateAdjustedPeriodUnified(
 *   null,
 *   { from: '2025-12-10', to: '2025-12-25' },
 *   '2025-12-10',
 *   '2025-12-31'
 * );
 * // { start: '2025-12-11', end: '2025-12-25' } (오늘 이후로 조정)
 * ```
 */
export function calculateAdjustedPeriodUnified(
  placementDateRange: { from: string; to: string } | null | undefined,
  rescheduleDateRange: { from: string; to: string } | null | undefined,
  today: string,
  groupEnd: string,
  includeToday: boolean = false
): AdjustedPeriod {
  if (placementDateRange?.from && placementDateRange?.to) {
    // 수동으로 선택한 배치 범위 사용
    // 유효성 검증 수행
    const validation = validateReschedulePeriod(placementDateRange, today, groupEnd);
    if (!validation.valid) {
      throw new PeriodCalculationError(
        validation.error || '유효하지 않은 날짜 범위입니다.',
        validation.errorCode || 'INVALID_DATE_RANGE'
      );
    }
    
    return {
      start: placementDateRange.from,
      end: placementDateRange.to,
    };
  }

  // 자동 계산: rescheduleDateRange를 기반으로 오늘 이후 기간 계산
  return getAdjustedPeriod(rescheduleDateRange || null, today, groupEnd, includeToday);
}
