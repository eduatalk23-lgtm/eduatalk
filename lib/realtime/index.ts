/**
 * Supabase Realtime 훅 모음
 * P2 개선: 실시간 기능 확대
 */

// 플랜 관련 실시간 업데이트
export { usePlanRealtimeUpdates } from "./usePlanRealtimeUpdates";
export {
  usePlanGroupRealtime,
  usePlanProgressRealtime,
} from "./usePlanGroupRealtime";

// 출석 관련 실시간 업데이트
export {
  useAttendanceRealtime,
  useAdminAttendanceRealtime,
} from "./useAttendanceRealtime";

// 관리자 플랜 실시간 업데이트
export { useAdminPlanRealtime } from "./useAdminPlanRealtime";

// 알림 실시간 업데이트
export {
  useNotificationRealtime,
  useNotificationPermission,
  requestNotificationPermission,
  type NotificationPayload,
  type NotificationRealtimeEvent,
  type NotificationEventHandler,
  type UseNotificationRealtimeOptions,
} from "./useNotificationRealtime";
