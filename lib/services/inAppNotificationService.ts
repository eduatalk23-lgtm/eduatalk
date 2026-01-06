/**
 * 인앱 알림 서비스
 *
 * 데이터베이스(Supabase) 기반 알림 영속화
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { logActionError } from "@/lib/logging/actionLogger";

export type NotificationType =
  | "camp_invitation"
  | "camp_reminder"
  | "camp_status_change"
  | "plan_created"
  | "plan_updated"
  | "admin_notification"
  // Learning milestone notifications (Phase 2)
  | "learning_milestone"
  | "daily_goal_complete"
  | "study_streak"
  // Plan reminder notifications (Phase 3)
  | "plan_incomplete_reminder"
  | "plan_delayed_warning"
  | "weekly_plan_summary";

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
 * DB 레코드를 Notification 타입으로 변환
 */
function mapDbRecordToNotification(record: {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  tenant_id: string | null;
}): Notification {
  return {
    id: record.id,
    userId: record.user_id,
    type: record.type as NotificationType,
    title: record.title,
    message: record.message,
    data: record.metadata ?? undefined,
    read: record.is_read,
    createdAt: record.created_at,
    readAt: record.read_at ?? undefined,
    tenantId: record.tenant_id ?? undefined,
  };
}

/**
 * 알림 발송 (데이터베이스 저장)
 */
export async function sendInAppNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
  tenantId?: string
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return {
        success: false,
        error: "Admin 클라이언트를 초기화할 수 없습니다.",
      };
    }

    const { data: notification, error } = await adminClient
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        message,
        metadata: (data ?? {}) as Json,
        is_read: false,
        tenant_id: tenantId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      logActionError(
        { domain: "service", action: "sendInAppNotification" },
        error,
        { userId, type }
      );
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true, notificationId: notification.id };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError(
      { domain: "service", action: "sendInAppNotification" },
      error,
      { userId, type }
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 특정 사용자들에게 일괄 알림 발송
 */
export async function sendBulkInAppNotification(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
  tenantId?: string
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  try {
    if (userIds.length === 0) {
      return { success: true, sentCount: 0 };
    }

    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return {
        success: false,
        sentCount: 0,
        error: "Admin 클라이언트를 초기화할 수 없습니다.",
      };
    }

    const notifications = userIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      message,
      metadata: (data ?? {}) as Json,
      is_read: false,
      tenant_id: tenantId ?? null,
    }));

    const { error } = await adminClient
      .from("notifications")
      .insert(notifications);

    if (error) {
      logActionError(
        { domain: "service", action: "sendBulkInAppNotification" },
        error,
        { userCount: userIds.length, type }
      );
      return {
        success: false,
        sentCount: 0,
        error: error.message,
      };
    }

    return { success: true, sentCount: userIds.length };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError(
      { domain: "service", action: "sendBulkInAppNotification" },
      error,
      { userCount: userIds.length, type }
    );
    return {
      success: false,
      sentCount: 0,
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
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logActionError(
        { domain: "service", action: "getUnreadNotifications" },
        error,
        { userId }
      );
      return [];
    }

    return (data ?? []).map(mapDbRecordToNotification);
  } catch (error) {
    logActionError(
      { domain: "service", action: "getUnreadNotifications" },
      error,
      { userId }
    );
    return [];
  }
}

/**
 * 사용자의 모든 알림 조회
 */
export async function getAllNotifications(
  userId: string,
  limit = 100
): Promise<Notification[]> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logActionError(
        { domain: "service", action: "getAllNotifications" },
        error,
        { userId, limit }
      );
      return [];
    }

    return (data ?? []).map(mapDbRecordToNotification);
  } catch (error) {
    logActionError(
      { domain: "service", action: "getAllNotifications" },
      error,
      { userId, limit }
    );
    return [];
  }
}

/**
 * 사용자의 미읽은 알림 개수 조회
 */
export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      logActionError(
        { domain: "service", action: "getUnreadNotificationCount" },
        error,
        { userId }
      );
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    logActionError(
      { domain: "service", action: "getUnreadNotificationCount" },
      error,
      { userId }
    );
    return 0;
  }
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      logActionError(
        { domain: "service", action: "markNotificationAsRead" },
        error,
        { userId, notificationId }
      );
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError(
      { domain: "service", action: "markNotificationAsRead" },
      error,
      { userId, notificationId }
    );
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
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      logActionError(
        { domain: "service", action: "markAllNotificationsAsRead" },
        error,
        { userId }
      );
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError(
      { domain: "service", action: "markAllNotificationsAsRead" },
      error,
      { userId }
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
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      logActionError(
        { domain: "service", action: "deleteNotification" },
        error,
        { userId, notificationId }
      );
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError(
      { domain: "service", action: "deleteNotification" },
      error,
      { userId, notificationId }
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// 실시간 브로드캐스트 (Supabase Realtime)
// ============================================

/**
 * 실시간 알림 브로드캐스트 (일시적 알림용)
 *
 * DB에 저장하지 않고 실시간으로 클라이언트에 알림을 전송합니다.
 * 일시적인 알림(예: 타이머 완료, 실시간 상태 업데이트)에 사용합니다.
 *
 * @example
 * ```typescript
 * // 타이머 완료 시 실시간 알림
 * await broadcastNotification(userId, {
 *   type: 'timer_complete',
 *   title: '학습 완료!',
 *   message: '수학 30분 학습을 완료했습니다.',
 * });
 * ```
 */
export async function broadcastNotification(
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return {
        success: false,
        error: "Admin 클라이언트를 초기화할 수 없습니다.",
      };
    }

    // Supabase Realtime 브로드캐스트 채널 사용
    const channel = adminClient.channel(`notifications-${userId}`);

    await channel.send({
      type: "broadcast",
      event: "notification",
      payload: {
        id: crypto.randomUUID(),
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.data ?? {},
        is_read: false,
        created_at: new Date().toISOString(),
        read_at: null,
        tenant_id: null,
      },
    });

    // 채널 정리
    await adminClient.removeChannel(channel);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError(
      { domain: "service", action: "broadcastNotification" },
      error,
      { userId, type: notification.type }
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 특정 사용자들에게 실시간 알림 브로드캐스트
 */
export async function broadcastBulkNotification(
  userIds: string[],
  notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  try {
    if (userIds.length === 0) {
      return { success: true, sentCount: 0 };
    }

    const results = await Promise.allSettled(
      userIds.map((userId) => broadcastNotification(userId, notification))
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    return { success: true, sentCount: successCount };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError(
      { domain: "service", action: "broadcastBulkNotification" },
      error,
      { userCount: userIds.length, type: notification.type }
    );
    return {
      success: false,
      sentCount: 0,
      error: errorMessage,
    };
  }
}

// ============================================
// 관리 기능
// ============================================

/**
 * 오래된 알림 정리 (관리자용)
 * @param daysOld 삭제할 알림의 최소 기간 (일)
 */
export async function cleanupOldNotifications(
  daysOld: number = 30
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return {
        success: false,
        error: "Admin 클라이언트를 초기화할 수 없습니다.",
      };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await adminClient
      .from("notifications")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .eq("is_read", true)
      .select("id");

    if (error) {
      logActionError(
        { domain: "service", action: "cleanupOldNotifications" },
        error,
        { daysOld }
      );
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true, deletedCount: data?.length ?? 0 };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError(
      { domain: "service", action: "cleanupOldNotifications" },
      error,
      { daysOld }
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}
