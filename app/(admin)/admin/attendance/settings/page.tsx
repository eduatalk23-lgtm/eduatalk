import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { LocationSettingsForm } from "./_components/LocationSettingsForm";
import { AttendanceSMSSettingsForm } from "./_components/AttendanceSMSSettingsForm";
import { AttendanceSettingsTabs } from "./_components/AttendanceSettingsTabs";


export default async function AttendanceSettingsPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">출석 설정</h1>
        <p className="text-sm text-gray-600">
          출석 관련 위치 및 SMS 알림 설정을 관리할 수 있습니다.
        </p>
      </div>

      <AttendanceSettingsTabs
        locationForm={<LocationSettingsForm />}
        smsForm={<AttendanceSMSSettingsForm />}
      />
    </div>
  );
}
