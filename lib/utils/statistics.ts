/**
 * 통계 계산 유틸리티
 * 공통 통계 계산 함수 통합
 */

// ============================================
// 비율 계산 함수
// ============================================

/**
 * 비율 계산 (백분율)
 * @param numerator 분자
 * @param denominator 분모
 * @param decimals 소수점 자릿수 (기본값: 2)
 * @returns 비율 (0-100)
 */
export function calculateRate(
  numerator: number,
  denominator: number,
  decimals: number = 2
): number {
  if (denominator === 0) {
    return 0;
  }
  const rate = (numerator / denominator) * 100;
  return Math.round(rate * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * 완료율 계산
 * @param completed 완료된 항목 수
 * @param total 전체 항목 수
 * @returns 완료율 (0-100)
 */
export function calculateCompletionRate(
  completed: number,
  total: number
): number {
  return calculateRate(completed, total, 0);
}

/**
 * 평균 계산
 * @param values 값 배열
 * @returns 평균값
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/**
 * 합계 계산
 * @param values 값 배열
 * @returns 합계
 */
export function calculateSum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}

// ============================================
// 날짜 범위 유틸리티
// ============================================

/**
 * 날짜 범위의 총 일수 계산
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 * @returns 총 일수 (시작일과 종료일 포함)
 */
export function calculateTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // 시작일과 종료일 포함
}

/**
 * 날짜 범위 필터링
 * @param date 날짜 (YYYY-MM-DD)
 * @param startDate 시작일 (YYYY-MM-DD, 선택)
 * @param endDate 종료일 (YYYY-MM-DD, 선택)
 * @returns 범위 내에 있는지 여부
 */
export function isDateInRange(
  date: string,
  startDate?: string | null,
  endDate?: string | null
): boolean {
  if (!startDate && !endDate) {
    return true;
  }
  if (startDate && date < startDate) {
    return false;
  }
  if (endDate && date > endDate) {
    return false;
  }
  return true;
}

// ============================================
// 출석 통계 계산 (기존 함수 재사용)
// ============================================

/**
 * 출석 기록 배열로부터 통계 계산
 * @param records 출석 기록 배열
 * @returns 출석 통계
 */
export type AttendanceStatsInput = {
  status: "present" | "absent" | "late" | "early_leave" | "excused";
};

export type AttendanceStatsResult = {
  total_days: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  early_leave_count: number;
  excused_count: number;
  attendance_rate: number;
  late_rate: number;
  absent_rate: number;
};

export function calculateAttendanceStatsFromRecords(
  records: AttendanceStatsInput[]
): AttendanceStatsResult {
  const totalDays = records.length;
  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const earlyLeaveCount = records.filter(
    (r) => r.status === "early_leave"
  ).length;
  const excusedCount = records.filter((r) => r.status === "excused").length;

  return {
    total_days: totalDays,
    present_count: presentCount,
    absent_count: absentCount,
    late_count: lateCount,
    early_leave_count: earlyLeaveCount,
    excused_count: excusedCount,
    attendance_rate: calculateRate(presentCount, totalDays),
    late_rate: calculateRate(lateCount, totalDays),
    absent_rate: calculateRate(absentCount, totalDays),
  };
}

// ============================================
// 플랜 완료율 계산
// ============================================

/**
 * 플랜 완료율 계산
 * @param plans 플랜 배열
 * @param isCompleted 완료 여부 판단 함수
 * @returns 완료율 (0-100)
 */
export function calculatePlanCompletionRate<T>(
  plans: T[],
  isCompleted: (plan: T) => boolean
): number {
  if (plans.length === 0) {
    return 0;
  }
  const completedCount = plans.filter(isCompleted).length;
  return calculateCompletionRate(completedCount, plans.length);
}

// ============================================
// 그룹별 집계
// ============================================

/**
 * 그룹별 집계
 * @param items 항목 배열
 * @param getKey 그룹 키 추출 함수
 * @param getValue 값 추출 함수
 * @returns 그룹별 집계 맵
 */
export function groupByAndSum<T>(
  items: T[],
  getKey: (item: T) => string,
  getValue: (item: T) => number
): Record<string, number> {
  const result: Record<string, number> = {};
  items.forEach((item) => {
    const key = getKey(item);
    const value = getValue(item);
    result[key] = (result[key] || 0) + value;
  });
  return result;
}

/**
 * 그룹별 개수 집계
 * @param items 항목 배열
 * @param getKey 그룹 키 추출 함수
 * @returns 그룹별 개수 맵
 */
export function groupByAndCount<T>(
  items: T[],
  getKey: (item: T) => string
): Record<string, number> {
  const result: Record<string, number> = {};
  items.forEach((item) => {
    const key = getKey(item);
    result[key] = (result[key] || 0) + 1;
  });
  return result;
}

