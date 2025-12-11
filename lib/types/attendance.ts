/**
 * 출석 SMS 설정 타입 정의
 */

/**
 * 학원 기본 출석 SMS 설정
 */
export type AttendanceSMSSettings = {
  attendance_sms_check_in_enabled: boolean;
  attendance_sms_check_out_enabled: boolean;
  attendance_sms_absent_enabled: boolean;
  attendance_sms_late_enabled: boolean;
  attendance_sms_student_checkin_enabled: boolean;
  attendance_sms_recipient: 'mother' | 'father' | 'both' | 'auto';
  attendance_sms_show_failure_to_user?: boolean;
};

/**
 * 학생별 출석 알림 설정
 */
export type StudentAttendanceNotificationSettings = {
  attendance_check_in_enabled: boolean | null;
  attendance_check_out_enabled: boolean | null;
  attendance_absent_enabled: boolean | null;
  attendance_late_enabled: boolean | null;
};

/**
 * 출석 기록 수정 이력
 */
export type AttendanceRecordHistory = {
  id: string;
  attendance_record_id: string;
  tenant_id: string;
  student_id: string;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  modified_by: string;
  modified_at: string;
  reason: string;
  created_at: string;
};

/**
 * 출석 기록 수정 요청
 */
export type UpdateAttendanceRecordRequest = {
  check_in_time?: string | null;
  check_out_time?: string | null;
  check_in_method?: "manual" | "qr" | "location" | "auto" | null;
  check_out_method?: "manual" | "qr" | "location" | "auto" | null;
  status?: "present" | "absent" | "late" | "early_leave" | "excused";
  notes?: string | null;
  reason: string; // 수정 사유 (필수)
};

