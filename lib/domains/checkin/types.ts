/**
 * Daily Check-In Domain Types
 * 일일 체크인 + 칭호 시스템 타입 정의
 */

// ============================================
// 기본 타입
// ============================================

export type TitleType = "streak" | "cumulative";

export interface DailyCheckIn {
  id: string;
  studentId: string;
  tenantId: string;
  checkDate: string; // YYYY-MM-DD
  checkedAt: string;
  createdAt: string;
}

export interface CheckInTitle {
  id: string;
  titleType: TitleType;
  requiredDays: number;
  title: string;
  sortOrder: number;
}

// ============================================
// 응답 타입
// ============================================

export interface CheckInActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CheckInStatus {
  checkedInToday: boolean;
  currentStreak: number;
  totalDays: number;
  currentTitle: string | null;
  newTitle: string | null; // 방금 달성한 칭호 (마일스톤 표시용)
}

// ============================================
// 변환 함수
// ============================================

export function dbToDailyCheckIn(row: Record<string, unknown>): DailyCheckIn {
  return {
    id: row.id as string,
    studentId: row.student_id as string,
    tenantId: row.tenant_id as string,
    checkDate: row.check_date as string,
    checkedAt: row.checked_at as string,
    createdAt: row.created_at as string,
  };
}

export function dbToCheckInTitle(row: Record<string, unknown>): CheckInTitle {
  return {
    id: row.id as string,
    titleType: row.title_type as TitleType,
    requiredDays: row.required_days as number,
    title: row.title as string,
    sortOrder: row.sort_order as number,
  };
}
