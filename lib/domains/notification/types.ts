/** 알림 카테고리 */
export type NotificationType =
  // 채팅
  | "chat_message"
  | "chat_group_message"
  | "chat_mention"
  // 학습 플랜
  | "plan_created"
  | "plan_updated"
  | "plan_overdue"
  | "plan_incomplete_reminder"
  | "plan_delayed_warning"
  | "weekly_plan_summary"
  // 학습 성과
  | "study_reminder"
  | "achievement"
  | "learning_milestone"
  | "daily_goal_complete"
  | "study_streak"
  // 캘린더/이벤트
  | "event_reminder"
  // 캠프
  | "camp_invitation"
  | "camp_reminder"
  | "camp_status_change"
  // 관리
  | "admin_notification"
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
  /** 채팅 메시지 생성 시각 (읽음 억제 판단용) */
  messageCreatedAt?: string;
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
  | "viewing_room"
  | "already_read"
  | "rate_limited"
  | "duplicate"
  | "no_subscription";

/** 알림 카테고리 → 설정 필드 매핑 (null = 항상 발송) */
export const NOTIFICATION_PREFERENCE_MAP: Record<
  NotificationType,
  string | null
> = {
  // 채팅
  chat_message: "chat_push_enabled",
  chat_group_message: "chat_group_push_enabled",
  chat_mention: null,
  // 학습 플랜
  plan_created: "plan_update_push_enabled",
  plan_updated: "plan_update_push_enabled",
  plan_overdue: "plan_delay_enabled",
  plan_incomplete_reminder: "plan_delay_enabled",
  plan_delayed_warning: "plan_delay_enabled",
  weekly_plan_summary: "plan_update_push_enabled",
  // 학습 성과
  study_reminder: "study_reminder_push_enabled",
  achievement: "achievement_push_enabled",
  learning_milestone: "achievement_push_enabled",
  daily_goal_complete: "achievement_push_enabled",
  study_streak: "achievement_push_enabled",
  // 캘린더/이벤트
  event_reminder: "event_reminder_push_enabled",
  // 캠프
  camp_invitation: null,
  camp_reminder: null,
  camp_status_change: null,
  // 관리
  admin_notification: null,
  payment_reminder: null,
  consultation_reminder: null,
  attendance: "attendance_check_in_enabled",
  system: null,
};
