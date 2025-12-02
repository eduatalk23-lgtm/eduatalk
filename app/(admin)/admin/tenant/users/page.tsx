export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { TenantUsersManagement } from "./_components/TenantUsersManagement";

export default async function TenantUsersPage() {
  const tenantContext = await getTenantContext();

  // Admin만 접근 가능
  if (tenantContext?.role !== "admin") {
    redirect("/admin/dashboard");
  }

  if (!tenantContext.tenantId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
          기관 정보를 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-h1 text-gray-900">기관별 사용자 관리</h1>
        <p className="mt-2 text-body-2 text-gray-600">
          기관별 학생 및 학부모를 조회하고 관리할 수 있습니다.
        </p>
      </div>

      <TenantUsersManagement tenantId={tenantContext.tenantId} />
    </div>
  );
}

