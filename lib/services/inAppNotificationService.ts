/**
 * 인앱 알림 서비스
 *
 * 데이터베이스(Supabase) 기반 알림 영속화
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NotificationType =
  | "camp_invitation"
  | "camp_reminder"
  | "camp_status_change"
  | "plan_created"
  | "plan_updated"
  | "admin_notification";

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
        metadata: data ?? {},
        is_read: false,
        tenant_id: tenantId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[inAppNotificationService] 알림 저장 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true, notificationId: notification.id };
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
      metadata: data ?? {},
      is_read: false,
      tenant_id: tenantId ?? null,
    }));

    const { error } = await adminClient
      .from("notifications")
      .insert(notifications);

    if (error) {
      console.error("[inAppNotificationService] 일괄 알림 저장 실패:", error);
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
    console.error("[inAppNotificationService] 일괄 알림 발송 실패:", errorMessage);
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
      console.error("[inAppNotificationService] 미읽은 알림 조회 실패:", error);
      return [];
    }

    return (data ?? []).map(mapDbRecordToNotification);
  } catch (error) {
    console.error("[inAppNotificationService] 미읽은 알림 조회 오류:", error);
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
      console.error("[inAppNotificationService] 알림 조회 실패:", error);
      return [];
    }

    return (data ?? []).map(mapDbRecordToNotification);
  } catch (error) {
    console.error("[inAppNotificationService] 알림 조회 오류:", error);
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
      console.error("[inAppNotificationService] 알림 개수 조회 실패:", error);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error("[inAppNotificationService] 알림 개수 조회 오류:", error);
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
      console.error("[inAppNotificationService] 알림 읽음 처리 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[inAppNotificationService] 알림 읽음 처리 오류:", errorMessage);
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
      console.error("[inAppNotificationService] 전체 알림 읽음 처리 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      "[inAppNotificationService] 전체 알림 읽음 처리 오류:",
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
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      console.error("[inAppNotificationService] 알림 삭제 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[inAppNotificationService] 알림 삭제 오류:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

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
      console.error("[inAppNotificationService] 알림 정리 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true, deletedCount: data?.length ?? 0 };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[inAppNotificationService] 알림 정리 오류:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
