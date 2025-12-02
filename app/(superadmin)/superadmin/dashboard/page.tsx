export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import Link from "next/link";
import {
  getTenantStatistics,
  getUserStatistics,
  getRecentTenants,
} from "@/lib/data/superadminDashboard";

export default async function SuperAdminDashboardPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  // 통계 데이터 조회
  const [tenantStats, userStats, recentTenants] = await Promise.all([
    getTenantStatistics(),
    getUserStatistics(),
    getRecentTenants(5),
  ]);

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Super Admin 대시보드</h1>

      {/* 기관 통계 카드 */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">기관 통계</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">전체 기관 수</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{tenantStats.total}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">활성 기관</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{tenantStats.active}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">비활성 기관</div>
            <div className="mt-2 text-3xl font-bold text-gray-600">{tenantStats.inactive}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">정지된 기관</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{tenantStats.suspended}</div>
          </div>
        </div>
      </div>

      {/* 사용자 통계 카드 */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">사용자 통계</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">학생</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">{userStats.students}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">학부모</div>
            <div className="mt-2 text-3xl font-bold text-purple-600">{userStats.parents}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">관리자</div>
            <div className="mt-2 text-3xl font-bold text-indigo-600">{userStats.admins}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">컨설턴트</div>
            <div className="mt-2 text-3xl font-bold text-cyan-600">{userStats.consultants}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">Super Admin</div>
            <div className="mt-2 text-3xl font-bold text-orange-600">{userStats.superadmins}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-gray-500">전체 사용자</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{userStats.total}</div>
          </div>
        </div>
      </div>

      {/* 최근 생성된 기관 */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">최근 생성된 기관</h2>
          <Link
            href="/superadmin/tenants"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            전체 보기 →
          </Link>
        </div>
        {recentTenants.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 기관이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {recentTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-4 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium text-gray-900">{tenant.name}</div>
                  <div className="text-sm text-gray-500">
                    {tenant.type === "academy"
                      ? "학원"
                      : tenant.type === "school"
                      ? "학교"
                      : tenant.type === "enterprise"
                      ? "기업"
                      : "기타"}
                    {" · "}
                    {new Date(tenant.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <Link
                  href={`/superadmin/tenants`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  관리 →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 빠른 액션 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">빠른 액션</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/superadmin/tenants"
            className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
          >
            <div className="font-medium text-gray-900">기관 관리</div>
            <div className="mt-1 text-sm text-gray-600">기관 추가, 수정, 삭제</div>
          </Link>
          <Link
            href="/superadmin/admin-users"
            className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
          >
            <div className="font-medium text-gray-900">관리자 계정</div>
            <div className="mt-1 text-sm text-gray-600">관리자 계정 생성 및 관리</div>
          </Link>
          <Link
            href="/superadmin/unverified-users"
            className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
          >
            <div className="font-medium text-gray-900">미인증 가입 관리</div>
            <div className="mt-1 text-sm text-gray-600">미인증 사용자 확인 및 처리</div>
          </Link>
          <Link
            href="/superadmin/tenantless-users"
            className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
          >
            <div className="font-medium text-gray-900">테넌트 미할당 사용자</div>
            <div className="mt-1 text-sm text-gray-600">테넌트가 할당되지 않은 사용자 관리</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

