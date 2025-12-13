export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationSettingsView } from "./_components/NotificationSettingsView";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

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
    <PageContainer widthType="FORM">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="알림 설정"
          description="학습 관련 알림을 받을 항목과 시간을 설정하세요"
        />

        <NotificationSettingsView initialSettings={settings} />
      </div>
    </PageContainer>
  );
}

