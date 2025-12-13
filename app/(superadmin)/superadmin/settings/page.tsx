export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminById } from "@/lib/data/admins";

export default async function SuperAdminSettingsPage() {
  const { userId, role } = await getCurrentUserRole();

  // Super Admin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // 현재 관리자 정보 조회
  const currentAdmin = await getAdminById(userId, null);

  return (
    <div className="p-6 md:p-10 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Super Admin 설정</h1>
        <p className="text-sm text-gray-600">시스템 관리 설정</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* 현재 계정 정보 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-900">현재 계정 정보</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-500">역할</div>
              <div className="text-lg font-medium text-gray-900">Super Admin</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-500">계정 ID</div>
              <div className="text-lg font-medium text-gray-900">{userId}</div>
            </div>
          </div>
        </div>

        {/* 시스템 관리 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-900">시스템 관리</h2>
          <p className="text-sm text-gray-600">
            Super Admin은 전체 시스템을 관리할 수 있는 권한을 가지고 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

