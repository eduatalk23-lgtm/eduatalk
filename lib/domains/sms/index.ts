/**
 * SMS 도메인 Public API
 *
 * 외부에서는 이 파일을 통해서만 sms 도메인에 접근합니다.
 */

// ============================================
// Types
// ============================================

export type {
  SMSRecipientSetting,
  AttendanceSMSType,
  SMSRecipientType,
  SMSResult,
  BulkSMSResult,
  StudentPhoneInfo,
} from "./types";

// ============================================
// Actions (Server Actions)
// ============================================

export {
  // 출석 SMS
  sendAttendanceSMSInternal,
  sendAttendanceSMS,
  sendBulkAttendanceSMS,
  // 일반 SMS
  sendGeneralSMS,
  sendBulkGeneralSMS,
} from "./actions";

/**
 * 사용 예시:
 *
 * // 출석 SMS 발송 (학생 자체 체크인)
 * import { sendAttendanceSMSInternal } from "@/lib/domains/sms";
 * await sendAttendanceSMSInternal(studentId, "attendance_check_in", { 시간: "14:30" });
 *
 * // 관리자 출석 SMS 발송
 * import { sendAttendanceSMS } from "@/lib/domains/sms";
 * await sendAttendanceSMS(studentId, "attendance_check_in", { 시간: "14:30" });
 *
 * // 일반 SMS 일괄 발송
 * import { sendBulkGeneralSMS } from "@/lib/domains/sms";
 * await sendBulkGeneralSMS(studentIds, "안녕하세요 {학생명}님...", {}, "mother");
 */
