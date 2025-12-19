/**
 * 캠프 초대 리마인더 발송 서비스
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampTemplate } from "@/lib/data/campTemplates";
import { sendCampReminderNotification } from "./campNotificationService";
import type { CampReminderSettings } from "@/lib/types/plan/domain";

/**
 * 리마인더 발송 여부 판단
 * @param invitation 초대 정보
 * @param template 템플릿 정보
 * @returns 리마인더 발송 여부
 */
export function shouldSendReminder(
  invitation: {
    invited_at: string;
    status: string;
  },
  template: {
    reminder_settings: CampReminderSettings | null;
  }
): boolean {
  // 리마인더 설정이 없거나 비활성화된 경우
  if (!template.reminder_settings || !template.reminder_settings.enabled) {
    return false;
  }

  // 초대 상태가 'pending'이 아닌 경우
  if (invitation.status !== "pending") {
    return false;
  }

  const reminderSettings = template.reminder_settings;
  const invitedAt = new Date(invitation.invited_at);
  const now = new Date();
  const daysSinceInvitation = Math.floor(
    (now.getTime() - invitedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 초대 발송 후 경과 일수가 리마인더 간격에 해당하는지 확인
  return reminderSettings.intervals.includes(daysSinceInvitation);
}

/**
 * 템플릿별 리마인더 간격 조회
 * @param template 템플릿 정보
 * @returns 리마인더 간격 배열
 */
export function getReminderIntervals(
  template: {
    reminder_settings: CampReminderSettings | null;
  }
): number[] {
  if (!template.reminder_settings || !template.reminder_settings.enabled) {
    return [];
  }

  return template.reminder_settings.intervals || [];
}

/**
 * 대기 중인 초대에 대한 리마인더 발송
 * @returns 발송된 리마인더 개수
 */
export async function processReminders(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // 상태가 'pending'인 초대 조회
    const { data: pendingInvitations, error: selectError } = await supabase
      .from("camp_invitations")
      .select("id, camp_template_id, invited_at, status")
      .eq("status", "pending")
      .order("invited_at", { ascending: true });

    if (selectError) {
      console.error(
        "[campReminderService] 대기 중인 초대 조회 실패:",
        selectError
      );
      return {
        success: false,
        count: 0,
        error: selectError.message,
      };
    }

    if (!pendingInvitations || pendingInvitations.length === 0) {
      return {
        success: true,
        count: 0,
      };
    }

    // 템플릿별로 그룹화하여 중복 조회 방지
    const templateIds = Array.from(
      new Set(pendingInvitations.map((inv) => inv.camp_template_id))
    );

    // 템플릿 정보 조회
    const templates = await Promise.all(
      templateIds.map(async (templateId) => {
        const template = await getCampTemplate(templateId);
        return template ? { id: templateId, template } : null;
      })
    );

    const templateMap = new Map(
      templates
        .filter((t): t is { id: string; template: NonNullable<typeof t.template> } => t !== null)
        .map((t) => [t.id, t.template])
    );

    // 리마인더 발송 대상 필터링
    const remindersToSend = pendingInvitations.filter((invitation) => {
      const template = templateMap.get(invitation.camp_template_id);
      if (!template) {
        return false;
      }

      return shouldSendReminder(invitation, template);
    });

    if (remindersToSend.length === 0) {
      return {
        success: true,
        count: 0,
      };
    }

    // 리마인더 발송 (병렬 처리)
    const results = await Promise.allSettled(
      remindersToSend.map((invitation) =>
        sendCampReminderNotification(invitation.id)
      )
    );

    const successCount = results.filter(
      (result) => result.status === "fulfilled"
    ).length;

    // 실패한 경우 로깅
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `[campReminderService] 초대 ${remindersToSend[index].id} 리마인더 발송 실패:`,
          result.reason
        );
      }
    });

    console.log(
      `[campReminderService] ${successCount}/${remindersToSend.length}개의 리마인더를 발송했습니다.`
    );

    return {
      success: true,
      count: successCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      "[campReminderService] 리마인더 처리 중 예외 발생:",
      errorMessage
    );
    return {
      success: false,
      count: 0,
      error: errorMessage,
    };
  }
}

