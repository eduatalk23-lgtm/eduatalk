/**
 * 인앱 알림 발송 서비스
 * 
 * 현재는 메모리 기반 큐를 사용하며, 향후 Redis로 확장 가능
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NotificationType =
  | "camp_invitation"
  | "camp_reminder"
  | "camp_status_change"
  | "plan_created"
  | "plan_updated";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
};

// 메모리 기반 알림 큐 (향후 Redis로 교체 가능)
const notificationQueue = new Map<string, Notification[]>();

/**
 * 알림 발송
 */
export async function sendInAppNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // 메모리 큐에 추가
    if (!notificationQueue.has(userId)) {
      notificationQueue.set(userId, []);
    }
    notificationQueue.get(userId)!.push(notification);

    // 데이터베이스에 저장 (선택사항, 향후 구현)
    // await saveNotificationToDatabase(notification);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[inAppNotificationService] 알림 발송 실패:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 사용자의 미읽은 알림 조회
 */
export async function getUnreadNotifications(
  userId: string
): Promise<Notification[]> {
  const userNotifications = notificationQueue.get(userId) || [];
  return userNotifications.filter((n) => !n.read);
}

/**
 * 사용자의 모든 알림 조회
 */
export async function getAllNotifications(
  userId: string
): Promise<Notification[]> {
  return notificationQueue.get(userId) || [];
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userNotifications = notificationQueue.get(userId);
    if (!userNotifications) {
      return {
        success: false,
        error: "알림을 찾을 수 없습니다.",
      };
    }

    const notification = userNotifications.find((n) => n.id === notificationId);
    if (!notification) {
      return {
        success: false,
        error: "알림을 찾을 수 없습니다.",
      };
    }

    notification.read = true;
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[inAppNotificationService] 알림 읽음 처리 실패:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllNotificationsAsRead(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userNotifications = notificationQueue.get(userId);
    if (!userNotifications) {
      return { success: true };
    }

    userNotifications.forEach((n) => {
      n.read = true;
    });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      "[inAppNotificationService] 전체 알림 읽음 처리 실패:",
      errorMessage
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 알림 삭제
 */
export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userNotifications = notificationQueue.get(userId);
    if (!userNotifications) {
      return {
        success: false,
        error: "알림을 찾을 수 없습니다.",
      };
    }

    const index = userNotifications.findIndex((n) => n.id === notificationId);
    if (index === -1) {
      return {
        success: false,
        error: "알림을 찾을 수 없습니다.",
      };
    }

    userNotifications.splice(index, 1);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[inAppNotificationService] 알림 삭제 실패:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

