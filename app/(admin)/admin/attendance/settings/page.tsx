import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { LocationSettingsForm } from "./_components/LocationSettingsForm";

export const dynamic = "force-dynamic";

export default async function LocationSettingsPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">출석 위치 설정</h1>
        <p className="mt-2 text-sm text-gray-600">
          학원의 위치를 설정하여 위치 기반 출석 체크를 사용할 수 있습니다.
        </p>
      </div>

      <LocationSettingsForm />
    </div>
  );
}

