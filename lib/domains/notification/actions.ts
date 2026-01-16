"use server";

/**
 * Notification 도메인 Server Actions
 *
 * 알림 관련 CRUD 액션을 제공합니다.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getAllNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/lib/services/inAppNotificationService";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type { Notification } from "@/lib/services/inAppNotificationService";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// Notification Actions
// ============================================

/**
 * 사용자의 모든 알림 조회
 */
export async function fetchNotificationsAction(): Promise<
  ActionResponse<{ notifications: Notification[] }>
> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const notifications = await getAllNotifications(user.userId);

    return {
      success: true,
      data: { notifications },
    };
  } catch (error) {
    logActionError(
      { domain: "notification", action: "fetchNotificationsAction" },
      error,
      {}
    );
    return {
      success: false,
      error: "알림 조회에 실패했습니다.",
    };
  }
}

/**
 * 알림 읽음 처리
 */
export async function markAsReadAction(
  notificationId: string
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    if (!notificationId) {
      return {
        success: false,
        error: "알림 ID가 필요합니다.",
      };
    }

    const result = await markNotificationAsRead(user.userId, notificationId);

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "알림 읽음 처리에 실패했습니다.",
      };
    }

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "notification", action: "markAsReadAction" },
      error,
      { notificationId }
    );
    return {
      success: false,
      error: "알림 읽음 처리에 실패했습니다.",
    };
  }
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllAsReadAction(): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const result = await markAllNotificationsAsRead(user.userId);

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "전체 알림 읽음 처리에 실패했습니다.",
      };
    }

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "notification", action: "markAllAsReadAction" },
      error,
      {}
    );
    return {
      success: false,
      error: "전체 알림 읽음 처리에 실패했습니다.",
    };
  }
}

/**
 * 알림 삭제
 */
export async function deleteNotificationAction(
  notificationId: string
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    if (!notificationId) {
      return {
        success: false,
        error: "알림 ID가 필요합니다.",
      };
    }

    const result = await deleteNotification(user.userId, notificationId);

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "알림 삭제에 실패했습니다.",
      };
    }

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "notification", action: "deleteNotificationAction" },
      error,
      { notificationId }
    );
    return {
      success: false,
      error: "알림 삭제에 실패했습니다.",
    };
  }
}
