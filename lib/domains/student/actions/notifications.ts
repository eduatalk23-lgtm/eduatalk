"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

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
};

export async function updateNotificationSettings(
  settings: NotificationSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
        console.error("[notifications] 업데이트 실패:", error);
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
        console.error("[notifications] 생성 실패:", error);
        return { success: false, error: "설정 저장에 실패했습니다." };
      }
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("[notifications] 오류:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "설정 저장 중 오류가 발생했습니다.",
    };
  }
}
