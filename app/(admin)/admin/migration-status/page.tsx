export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getContainerClass } from "@/lib/constants/layout";

/**
 * 마이그레이션 상태 확인 페이지
 * 
 * student_school_scores (레거시)와 student_internal_scores (신규) 테이블의
 * 데이터 개수를 비교하여 마이그레이션 상태를 확인합니다.
 */
export default async function MigrationStatusPage() {
  const { userId, role } = await getCurrentUserRole();

  // 권한 확인 (admin만 접근 가능)
  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // 두 테이블의 레코드 수 조회
  const [legacyCountResult, newCountResult] = await Promise.all([
    supabase
      .from("student_school_scores")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("student_internal_scores")
      .select("id", { count: "exact", head: true }),
  ]);

  const legacyCount = legacyCountResult.count ?? 0;
  const newCount = newCountResult.count ?? 0;
  const isMatch = legacyCount === newCount;

  // 상태 결정
  const status = isMatch ? "success" : "warning";
  const statusText = isMatch ? "✅ 마이그레이션 성공" : "⚠️ 데이터 불일치";
  const statusColor = isMatch ? "text-green-600" : "text-amber-600";
  const statusBgColor = isMatch ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200";

  return (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">마이그레이션 상태</h1>
          <p className="text-sm text-gray-600">
            성적 데이터 마이그레이션 상태를 확인합니다.
          </p>
        </div>

        {/* 상태 카드 */}
        <div className={`rounded-lg border p-6 ${statusBgColor}`}>
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-bold ${statusColor}`}>
              {statusText}
            </div>
          </div>
        </div>

        {/* 데이터 비교 테이블 */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">테이블별 레코드 수</h2>
          </div>
          <div className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* 레거시 테이블 */}
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium text-gray-500">레거시 테이블</div>
                <div className="text-3xl font-bold text-gray-900">
                  {legacyCount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  student_school_scores
                </div>
              </div>

              {/* 신규 테이블 */}
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium text-gray-500">신규 테이블</div>
                <div className="text-3xl font-bold text-gray-900">
                  {newCount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  student_internal_scores
                </div>
              </div>
            </div>

            {/* 차이 표시 */}
            {!isMatch && (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-amber-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium text-amber-800">
                    데이터 불일치: {Math.abs(newCount - legacyCount).toLocaleString()}개의 레코드 차이가 있습니다.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">안내</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  이 페이지는 성적 데이터 마이그레이션 상태를 확인하는 용도입니다.
                  두 테이블의 레코드 수가 일치하면 마이그레이션이 성공적으로 완료된 것으로 간주됩니다.
                </p>
                <p className="mt-2">
                  데이터 불일치가 발생한 경우, 마이그레이션 스크립트를 다시 실행하거나
                  시스템 관리자에게 문의하세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
