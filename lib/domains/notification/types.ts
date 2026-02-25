/** 알림 카테고리 */
export type NotificationType =
  | "chat_message"
  | "chat_group_message"
  | "chat_mention"
  | "study_reminder"
  | "plan_created"
  | "plan_overdue"
  | "plan_updated"
  | "achievement"
  | "event_reminder"
  | "payment_reminder"
  | "consultation_reminder"
  | "attendance"
  | "system";

/** 알림 우선순위 */
export type NotificationPriority = "high" | "normal" | "low";

/** 서버 사이드 알림 라우터 요청 페이로드 */
export interface NotificationRequest {
  type: NotificationType;
  recipientIds: string[];
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
  };
  priority: NotificationPriority;
  source: "db_trigger" | "cron" | "server_action";
  referenceId?: string;
}

/** 클라이언트 라우터 디스패치 페이로드 */
export interface ClientNotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  inApp: "toast" | "badge" | "none";
}

/** 알림이 스킵된 이유 */
export type SkipReason =
  | "preference_off"
  | "muted"
  | "quiet_hours"
  | "online"
  | "rate_limited"
  | "duplicate"
  | "no_subscription";

/** 알림 카테고리 → 설정 필드 매핑 (null = 항상 발송) */
export const NOTIFICATION_PREFERENCE_MAP: Record<
  NotificationType,
  string | null
> = {
  chat_message: "chat_push_enabled",
  chat_group_message: "chat_group_push_enabled",
  chat_mention: null,
  study_reminder: "study_reminder_push_enabled",
  plan_created: "plan_update_push_enabled",
  plan_overdue: "plan_delay_enabled",
  plan_updated: "plan_update_push_enabled",
  achievement: "achievement_push_enabled",
  event_reminder: "event_reminder_push_enabled",
  payment_reminder: null,
  consultation_reminder: null,
  attendance: "attendance_check_in_enabled",
  system: null,
};
