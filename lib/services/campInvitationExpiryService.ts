/**
 * 캠프 초대 만료 처리 서비스
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendInAppNotification } from "./inAppNotificationService";
import { sendCampReminderNotification } from "./campNotificationService";
import { logActionDebug, logActionError } from "@/lib/utils/serverActionLogger";

/**
 * 만료된 초대를 찾아 상태를 'expired'로 변경
 * @returns 처리된 초대 개수
 */
export async function processExpiredInvitations(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();

    // 만료된 초대 조회 (expires_at이 현재 시간보다 이전이고, status가 'pending'인 경우)
    const { data: expiredInvitations, error: selectError } = await supabase
      .from("camp_invitations")
      .select("id, student_id, camp_template_id, tenant_id")
      .eq("status", "pending")
      .not("expires_at", "is", null)
      .lt("expires_at", now);

    if (selectError) {
      logActionError("campInvitationExpiryService.processExpiredInvitations", `만료된 초대 조회 실패: ${selectError.message}`);
      return {
        success: false,
        count: 0,
        error: selectError.message,
      };
    }

    if (!expiredInvitations || expiredInvitations.length === 0) {
      return {
        success: true,
        count: 0,
      };
    }

    // 만료된 초대 ID 목록
    const expiredIds = expiredInvitations.map((inv) => inv.id);

    // 상태를 'expired'로 업데이트
    const { error: updateError } = await supabase
      .from("camp_invitations")
      .update({ status: "expired", updated_at: now })
      .in("id", expiredIds);

    if (updateError) {
      logActionError("campInvitationExpiryService.processExpiredInvitations", `만료 상태 업데이트 실패: ${updateError.message}`);
      return {
        success: false,
        count: 0,
        error: updateError.message,
      };
    }

    // 각 학생에게 인앱 알림 발송 (비동기, 실패해도 만료 처리는 성공으로 처리)
    expiredInvitations.forEach((invitation) => {
      sendInAppNotification(
        invitation.student_id,
        "camp_invitation_expired" as any,
        "캠프 초대가 만료되었습니다",
        "캠프 초대가 만료되었습니다. 관리자에게 문의해주세요.",
        {
          invitationId: invitation.id,
          templateId: invitation.camp_template_id,
        }
      ).catch((err) => {
        logActionError("campInvitationExpiryService.processExpiredInvitations", `초대 ${invitation.id} 알림 발송 실패: ${err instanceof Error ? err.message : String(err)}`);
      });
    });

    logActionDebug("campInvitationExpiryService.processExpiredInvitations", `${expiredInvitations.length}개의 초대를 만료 처리했습니다.`);

    return {
      success: true,
      count: expiredInvitations.length,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError("campInvitationExpiryService.processExpiredInvitations", `만료 처리 중 예외 발생: ${errorMessage}`);
    return {
      success: false,
      count: 0,
      error: errorMessage,
    };
  }
}

/**
 * 만료 1일 전 알림 발송
 * @returns 발송된 알림 개수
 */
export async function sendExpiryReminderNotifications(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 만료 1일 전인 초대 조회 (expires_at이 내일이고, status가 'pending'인 경우)
    const { data: expiringInvitations, error: selectError } = await supabase
      .from("camp_invitations")
      .select("id, student_id, camp_template_id, expires_at")
      .eq("status", "pending")
      .not("expires_at", "is", null)
      .gte("expires_at", now.toISOString())
      .lt("expires_at", tomorrow.toISOString());

    if (selectError) {
      logActionError("campInvitationExpiryService.sendExpiryReminderNotifications", `만료 예정 초대 조회 실패: ${selectError.message}`);
      return {
        success: false,
        count: 0,
        error: selectError.message,
      };
    }

    if (!expiringInvitations || expiringInvitations.length === 0) {
      return {
        success: true,
        count: 0,
      };
    }

    // 각 초대에 대해 리마인더 알림 발송
    const results = await Promise.allSettled(
      expiringInvitations.map((invitation) =>
        sendCampReminderNotification(invitation.id)
      )
    );

    const successCount = results.filter(
      (result) => result.status === "fulfilled"
    ).length;

    logActionDebug("campInvitationExpiryService.sendExpiryReminderNotifications", `${successCount}/${expiringInvitations.length}개의 만료 예정 알림을 발송했습니다.`);

    return {
      success: true,
      count: successCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError("campInvitationExpiryService.sendExpiryReminderNotifications", `만료 예정 알림 발송 중 예외 발생: ${errorMessage}`);
    return {
      success: false,
      count: 0,
      error: errorMessage,
    };
  }
}

/**
 * 곧 만료될 초대 조회 (1일 이내)
 * @param days 만료까지 남은 일수 (기본값: 1)
 * @returns 만료 예정 초대 목록
 */
export async function getExpiringInvitations(days: number = 1): Promise<{
  success: boolean;
  invitations: Array<{
    id: string;
    student_id: string;
    camp_template_id: string;
    expires_at: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);

    const { data: invitations, error } = await supabase
      .from("camp_invitations")
      .select("id, student_id, camp_template_id, expires_at")
      .eq("status", "pending")
      .not("expires_at", "is", null)
      .gte("expires_at", now.toISOString())
      .lt("expires_at", futureDate.toISOString())
      .order("expires_at", { ascending: true });

    if (error) {
      logActionError("campInvitationExpiryService.getExpiringInvitations", `만료 예정 초대 조회 실패: ${error.message}`);
      return {
        success: false,
        invitations: [],
        error: error.message,
      };
    }

    return {
      success: true,
      invitations: (invitations || []) as Array<{
        id: string;
        student_id: string;
        camp_template_id: string;
        expires_at: string;
      }>,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logActionError("campInvitationExpiryService.getExpiringInvitations", `만료 예정 초대 조회 중 예외 발생: ${errorMessage}`);
    return {
      success: false,
      invitations: [],
      error: errorMessage,
    };
  }
}

