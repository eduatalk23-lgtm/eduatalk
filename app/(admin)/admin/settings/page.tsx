export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getAdminById, listAdminsByTenant } from "@/lib/data/admins";

export default async function AdminSettingsPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // 현재 관리자 정보 조회
  const currentAdmin = await getAdminById(userId, null);

  // 기관 관리자 목록 조회 (admin만)
  let allAdmins: Array<{ id: string; role: string }> = [];
  if (role === "admin" && currentAdmin?.tenant_id) {
    const admins = await listAdminsByTenant(currentAdmin.tenant_id);
    allAdmins = admins.map((a) => ({ id: a.id, role: a.role }));
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-h1 text-gray-900">설정</h1>
        <p className="mt-2 text-body-2 text-gray-600">기관 및 계정 관리 설정</p>
      </div>

      <div className="space-y-6">
        {/* 현재 계정 정보 */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="mb-4 text-h2 text-gray-900 dark:text-gray-100">현재 계정 정보</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">역할</div>
              <div className="mt-1 text-lg font-medium text-gray-900 dark:text-gray-100">
                {currentAdmin?.role === "admin" ? "관리자" : "상담사"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">계정 ID</div>
              <div className="mt-1 text-lg font-medium text-gray-900 dark:text-gray-100">{userId}</div>
            </div>
          </div>
        </div>

        {/* 기관 설정 */}
        {role === "admin" && (
          <>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-h2 text-gray-900 dark:text-gray-100">기관 설정</h2>
                <Link
                  href="/admin/tenant/settings"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  기관 설정 관리
                </Link>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">기관 정보 및 설정을 관리할 수 있습니다.</p>
            </div>

            {/* 스케줄러 설정 */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-h2 text-gray-900 dark:text-gray-100">스케줄러 설정</h2>
                <Link
                  href="/admin/settings/scheduler"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  스케줄러 설정 관리
                </Link>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                기관 전체의 기본 스케줄러 설정을 관리합니다. 학습일/복습일 비율, 취약과목 집중 모드 등을 설정할 수 있습니다.
              </p>
            </div>

            {/* 추천 시스템 설정 */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-h2 text-gray-900 dark:text-gray-100">추천 시스템 설정</h2>
                <Link
                  href="/admin/recommendation-settings"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  추천 시스템 설정 관리
                </Link>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                추천 알고리즘의 파라미터를 조정합니다. 학습 범위 추천, 콘텐츠 추천 등의 설정을 관리할 수 있습니다.
              </p>
            </div>
          </>
        )}

        {/* 코치 계정 관리 */}
        {role === "admin" && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h2 className="mb-4 text-h2 text-gray-900 dark:text-gray-100">코치 계정 관리</h2>
            {allAdmins.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">등록된 코치 계정이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {allAdmins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {admin.role === "admin" ? "관리자" : "상담사"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{admin.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 기타 설정 */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="mb-4 text-h2 text-gray-900 dark:text-gray-100">기타 설정</h2>
          <div className="space-y-3">
            <Link
              href="/admin/tools"
              className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">도구</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">관리자 도구 및 유틸리티</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

