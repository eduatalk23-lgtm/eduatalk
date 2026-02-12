import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { getConnectionStatus, getSyncQueueStats } from "@/lib/domains/googleCalendar";
import GoogleCalendarSettingsForm from "./_components/GoogleCalendarSettingsForm";

export default async function GoogleCalendarSettingsPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/admin/settings");
  }

  const adminClient = await getSupabaseClientForRLSBypass({
    forceAdmin: true,
    fallbackToServer: false,
  });

  let connectionStatus = {
    connected: false,
    googleEmail: null as string | null,
    calendarId: "primary",
    connectedAt: null as string | null,
    lastSyncAt: null as string | null,
    syncEnabled: false,
  };

  let queueStats = { pending: 0, failed: 0, completed: 0 };

  if (adminClient) {
    [connectionStatus, queueStats] = await Promise.all([
      getConnectionStatus(adminClient, userId),
      getSyncQueueStats(adminClient, tenantContext.tenantId),
    ]);
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-gray-900 dark:text-gray-100">
          Google Calendar 연동
        </h1>
        <p className="text-body-2 text-gray-600 dark:text-gray-400">
          상담 일정을 Google Calendar와 자동으로 동기화합니다.
        </p>
      </div>

      <GoogleCalendarSettingsForm
        connectionStatus={connectionStatus}
        queueStats={queueStats}
        isAdmin={role === "admin"}
      />
    </div>
  );
}
