/**
 * notificationActions.ts - 알림 설정 관련 Server Actions
 *
 * 이 파일은 lib/domains/student의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/student에서 직접 import 사용을 권장합니다.
 */

export type { NotificationSettings } from "@/lib/domains/student";

export { updateNotificationSettings } from "@/lib/domains/student";
