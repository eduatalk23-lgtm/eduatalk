export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationSettingsView } from "./_components/NotificationSettingsView";

export default async function NotificationSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 알림 설정 조회 (없으면 기본값 사용)
  const { data: notificationSettings } = await supabase
    .from("student_notification_preferences")
    .select("*")
    .eq("student_id", user.id)
    .single();

  // 기본값 설정
  const defaultSettings = {
    plan_start_enabled: true,
    plan_complete_enabled: true,
    daily_goal_achieved_enabled: true,
    weekly_report_enabled: true,
    plan_delay_enabled: true,
    plan_delay_threshold_minutes: 30,
    notification_time_start: "09:00",
    notification_time_end: "22:00",
    quiet_hours_enabled: false,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
  };

  const settings = notificationSettings || defaultSettings;

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-semibold">알림 설정</h1>
        <p className="mb-6 text-sm text-gray-600">
          학습 관련 알림을 받을 항목과 시간을 설정하세요
        </p>

        <NotificationSettingsView initialSettings={settings} />
      </div>
    </div>
  );
}

