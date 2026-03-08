/**
 * Realtime Payload 변환 유틸리티
 *
 * Supabase Realtime에서 수신한 payload (snake_case)를
 * 클라이언트용 Notification 타입 (camelCase)으로 변환합니다.
 *
 * @module lib/notifications/mapPayloadToNotification
 */

import type { NotificationPayload } from "@/lib/realtime/useNotificationRealtime";
import type { NotificationType } from "@/lib/domains/notification/types";

export type { NotificationType };

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  readAt?: string;
  tenantId?: string;
};

/**
 * Realtime Payload (snake_case) → Notification (camelCase) 변환
 *
 * @example
 * ```typescript
 * useNotificationRealtime({
 *   onNewNotification: (payload) => {
 *     const notification = mapPayloadToNotification(payload);
 *     // notification.userId, notification.createdAt 등 camelCase로 접근 가능
 *   },
 * });
 * ```
 */
export function mapPayloadToNotification(
  payload: NotificationPayload
): Notification {
  return {
    id: payload.id,
    userId: payload.user_id,
    type: payload.type as NotificationType,
    title: payload.title,
    message: payload.message,
    data: payload.metadata ?? undefined,
    read: payload.is_read,
    createdAt: payload.created_at,
    readAt: payload.read_at ?? undefined,
    tenantId: payload.tenant_id ?? undefined,
  };
}
