/**
 * Attendance 도메인 타입 정의
 */

// ============================================
// 출석 상태
// ============================================

export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "early_leave"
  | "excused";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "출석",
  absent: "결석",
  late: "지각",
  early_leave: "조퇴",
  excused: "공결",
};

// ============================================
// 입실/퇴실 방법
// ============================================

export type CheckMethod = "manual" | "qr" | "location" | "auto";

export const CHECK_METHOD_LABELS: Record<CheckMethod, string> = {
  manual: "수동",
  qr: "QR코드",
  location: "위치기반",
  auto: "자동",
};

// ============================================
// 출석 기록
// ============================================

export type AttendanceRecord = {
  id: string;
  tenant_id: string;
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  check_in_time: string | null; // ISO 8601
  check_out_time: string | null; // ISO 8601
  check_in_method: CheckMethod | null;
  check_out_method: CheckMethod | null;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// 출석 기록 생성/수정 입력
// ============================================

export type CreateAttendanceRecordInput = {
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  check_in_time?: string | null; // ISO 8601
  check_out_time?: string | null; // ISO 8601
  check_in_method?: CheckMethod | null;
  check_out_method?: CheckMethod | null;
  status?: AttendanceStatus;
  notes?: string | null;
};

export type UpdateAttendanceRecordInput = {
  check_in_time?: string | null;
  check_out_time?: string | null;
  check_in_method?: CheckMethod | null;
  check_out_method?: CheckMethod | null;
  status?: AttendanceStatus;
  notes?: string | null;
};

// ============================================
// 출석 통계
// ============================================

export type AttendanceStatistics = {
  total_days: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  early_leave_count: number;
  excused_count: number;
  attendance_rate: number; // 출석률 (%)
  late_rate: number; // 지각률 (%)
  absent_rate: number; // 결석률 (%)
};

// ============================================
// 출석 조회 필터
// ============================================

export type AttendanceFilters = {
  student_id?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  status?: AttendanceStatus;
};

// ============================================
// 검증 결과
// ============================================

export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

