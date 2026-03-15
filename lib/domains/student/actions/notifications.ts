"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";
import { logActionError } from "@/lib/logging/actionLogger";

export type NotificationSettings = {
  plan_start_enabled: boolean;
  plan_complete_enabled: boolean;
  daily_goal_achieved_enabled: boolean;
  weekly_report_enabled: boolean;
  plan_delay_enabled: boolean;
  plan_delay_threshold_minutes: number;
  notification_time_start: string;
  notification_time_end: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  attendance_check_in_enabled?: boolean | null;
  attendance_check_out_enabled?: boolean | null;
  attendance_absent_enabled?: boolean | null;
  attendance_late_enabled?: boolean | null;
  // Push 알림 카테고리별 설정
  chat_push_enabled: boolean;
  chat_group_push_enabled: boolean;
  study_reminder_push_enabled: boolean;
  plan_update_push_enabled: boolean;
  achievement_push_enabled: boolean;
  event_reminder_push_enabled: boolean;
  // 채팅 부가 설정
  chat_sound_enabled: boolean;
  chat_vibrate_enabled: boolean;
  chat_read_receipt_enabled: boolean;
};

export type ChatNotificationPrefs = {
  chat_sound_enabled: boolean;
  chat_vibrate_enabled: boolean;
  chat_read_receipt_enabled: boolean;
};

export async function getChatNotificationPrefs(): Promise<ChatNotificationPrefs> {
  const defaults: ChatNotificationPrefs = {
    chat_sound_enabled: true,
    chat_vibrate_enabled: true,
    chat_read_receipt_enabled: true,
  };

  try {
    const user = await getCachedAuthUser();
    if (!user) return defaults;

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("student_notification_preferences")
      .select("chat_sound_enabled, chat_vibrate_enabled, chat_read_receipt_enabled")
      .eq("student_id", user.id)
      .single();

    if (!data) return defaults;

    return {
      chat_sound_enabled: data.chat_sound_enabled ?? true,
      chat_vibrate_enabled: data.chat_vibrate_enabled ?? true,
      chat_read_receipt_enabled: data.chat_read_receipt_enabled ?? true,
    };
  } catch {
    return defaults;
  }
}

export async function updateNotificationSettings(
  settings: NotificationSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCachedAuthUser();
    const supabase = await createSupabaseServerClient();

    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 기존 설정 확인
    const { data: existing } = await supabase
      .from("student_notification_preferences")
      .select("id")
      .eq("student_id", user.id)
      .single();

    if (existing) {
      // 업데이트
      const { error } = await supabase
        .from("student_notification_preferences")
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", user.id);

      if (error) {
        logActionError(
          { domain: "student", action: "updateNotificationSettings", userId: user.id },
          error,
          { operation: "update" }
        );
        return { success: false, error: "설정 저장에 실패했습니다." };
      }
    } else {
      // 생성
      const { error } = await supabase
        .from("student_notification_preferences")
        .insert({
          student_id: user.id,
          ...settings,
        });

      if (error) {
        logActionError(
          { domain: "student", action: "updateNotificationSettings", userId: user.id },
          error,
          { operation: "insert" }
        );
        return { success: false, error: "설정 저장에 실패했습니다." };
      }
    }

    return { success: true };
  } catch (error: unknown) {
    logActionError(
      { domain: "student", action: "updateNotificationSettings" },
      error
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "설정 저장 중 오류가 발생했습니다.",
    };
  }
}
