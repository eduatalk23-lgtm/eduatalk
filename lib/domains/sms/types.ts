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

// ── 커스텀 템플릿 ──

export type SMSCustomTemplateCategory = 'general' | 'payment' | 'notice' | 'consultation';

export interface SMSCustomTemplate {
  id: string;
  tenant_id: string;
  name: string;
  content: string;
  category: SMSCustomTemplateCategory;
  variables: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateCustomTemplateInput = {
  name: string;
  content: string;
  category?: SMSCustomTemplateCategory;
};

export type UpdateCustomTemplateInput = {
  name?: string;
  content?: string;
  category?: SMSCustomTemplateCategory;
  is_active?: boolean;
};

// ── SMS 패널 데이터 (Client-safe) ──

export interface SMSPanelPhoneData {
  id: string;
  name: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
}

export interface SMSPanelData {
  phoneData: SMSPanelPhoneData;
  customTemplates: SMSCustomTemplate[];
  smsHistory: SMSLogEntry[];
  academyName: string;
}

// ── SMS 발송 이력 ──

export interface SMSLogEntry {
  id: string;
  recipient_phone: string;
  message_content: string;
  status: string;
  channel: string | null;
  created_at: string;
  sent_at: string | null;
}
