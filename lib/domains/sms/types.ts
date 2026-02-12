/**
 * SMS 도메인 Types
 */

export type SMSRecipientSetting = 'mother' | 'father' | 'both' | 'auto';

export type AttendanceSMSType =
  | 'attendance_check_in'
  | 'attendance_check_out'
  | 'attendance_absent'
  | 'attendance_late';

export type SMSRecipientType = 'student' | 'mother' | 'father';

export interface SMSResult {
  msgId?: string;
  channel?: "alimtalk" | "sms";
}

export interface BulkSMSResult {
  success: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}

export interface StudentPhoneInfo {
  id: string;
  name: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
}
