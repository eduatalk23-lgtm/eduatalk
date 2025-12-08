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

