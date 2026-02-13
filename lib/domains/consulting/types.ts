export type SessionType =
  | "정기상담"
  | "학부모상담"
  | "진로상담"
  | "성적상담"
  | "긴급상담"
  | "기타"
  | (string & {}); // 커스텀 입력 허용

export const SESSION_TYPE_PRESETS = [
  "정기상담",
  "학부모상담",
  "진로상담",
  "성적상담",
  "긴급상담",
] as const;

/** @deprecated SESSION_TYPE_PRESETS 사용 */
export const SESSION_TYPES = SESSION_TYPE_PRESETS;

export const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  정기상담: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  학부모상담:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  진로상담:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  성적상담:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  긴급상담: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  기타: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
};

// ── 알림 채널 (Notification Channel) ──

export type NotificationChannel = "alimtalk" | "sms";

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["alimtalk", "sms"];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  alimtalk: "알림톡 (SMS 대체)",
  sms: "SMS/LMS",
};

// ── 알림 대상 (Notification Target) ──

export type NotificationTarget = "student" | "mother" | "father";

export const NOTIFICATION_TARGETS: NotificationTarget[] = ["student", "mother", "father"];

export const NOTIFICATION_TARGET_LABELS: Record<NotificationTarget, string> = {
  student: "학생",
  mother: "모",
  father: "부",
};

// ── 상담 방식 (Consultation Mode) ──

export type ConsultationMode = "대면" | "원격";

export const CONSULTATION_MODES: ConsultationMode[] = ["대면", "원격"];

// ── 상담 일정 (Consultation Schedule) ──

export type ScheduleStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface ConsultationSchedule {
  id: string;
  tenant_id: string;
  student_id: string;
  consultant_id: string;
  session_type: string; // CHECK 해제 후 자유 입력 가능
  enrollment_id: string | null;
  program_name: string | null; // DB 컬럼 (직접 입력 또는 enrollment에서 복사)
  scheduled_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  consultation_mode: ConsultationMode;
  meeting_link: string | null;
  visitor: string | null;
  location: string | null;
  description: string | null;
  notification_targets: NotificationTarget[];
  notification_sent: boolean;
  notification_sent_at: string | null;
  reminder_sent: boolean;
  reminder_sent_at: string | null;
  status: ScheduleStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // JOIN 결과
  consultant_name?: string;
}

// ── 알림 발송 로그 (sms_logs 에서 조회) ──

export type NotificationLogEntry = {
  id: string;
  recipient_phone: string | null;
  status: "pending" | "sent" | "delivered" | "failed" | null;
  channel: "sms" | "lms" | "alimtalk" | "friendtalk" | null;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  ppurio_result_code: string | null;
  notification_target: string | null; // 발송 시점 기록 (학생/부/모)
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  scheduled: "예정",
  completed: "완료",
  cancelled: "취소",
  no_show: "미참석",
};

export const SCHEDULE_STATUS_COLORS: Record<ScheduleStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
  no_show: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

// ── 알림 대상 매칭 ──

/**
 * 수신번호를 학생/부/모 전화번호와 비교하여 알림 대상을 결정
 * 전화번호 끝 8자리로 비교 (국가코드/하이픈 차이 무시)
 */
export function resolveNotificationTarget(
  recipientPhone: string | null,
  studentPhones: { phone: string | null; mother_phone: string | null; father_phone: string | null }
): string {
  if (!recipientPhone) return "-";
  const normalize = (p: string | null) => p?.replace(/[^0-9]/g, "").slice(-8) ?? "";
  const target = normalize(recipientPhone);
  if (!target) return "-";
  if (studentPhones.phone && normalize(studentPhones.phone) === target) return "학생";
  if (studentPhones.mother_phone && normalize(studentPhones.mother_phone) === target) return "모";
  if (studentPhones.father_phone && normalize(studentPhones.father_phone) === target) return "부";
  return "-";
}
