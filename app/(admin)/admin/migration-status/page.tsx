import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getContainerClass } from "@/lib/constants/layout";

/**
 * 마이그레이션 상태 확인 페이지
 * 
 * student_school_scores와 student_internal_scores 테이블의 데이터 개수를 비교하여
 * 마이그레이션 상태를 확인합니다.
 */
export default async function MigrationStatusPage() {
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCurrentUserRole();

  // Admin 권한 체크
  if (!userId || (role !== "admin" && role !== "superadmin")) {
    redirect("/login");
  }

  // 레거시 테이블 데이터 개수 조회
  const { count: legacyCount, error: legacyError } = await supabase
    .from("student_school_scores")
    .select("*", { count: "exact", head: true });

  // 신규 테이블 데이터 개수 조회
  const { count: newCount, error: newError } = await supabase
    .from("student_internal_scores")
    .select("*", { count: "exact", head: true });

  // 에러 처리
  const hasError = legacyError || newError;
  const legacyCountValue = legacyCount ?? 0;
  const newCountValue = newCount ?? 0;
  const isMatch = legacyCountValue === newCountValue;

  return (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">마이그레이션 상태</h1>
          <p className="text-sm text-gray-600">
            레거시 테이블과 신규 테이블의 데이터 개수를 비교합니다.
          </p>
        </div>

        {hasError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">에러 발생</p>
            {legacyError && (
              <p>레거시 테이블 조회 실패: {legacyError.message}</p>
            )}
            {newError && (
              <p>신규 테이블 조회 실패: {newError.message}</p>
            )}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* 레거시 테이블 정보 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                레거시 테이블
              </h2>
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                Deprecated
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">student_school_scores</p>
            <p className="text-3xl font-bold text-gray-900">
              {legacyCountValue.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-2">레코드 수</p>
          </div>

          {/* 신규 테이블 정보 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                신규 테이블
              </h2>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                Active
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">student_internal_scores</p>
            <p className="text-3xl font-bold text-gray-900">
              {newCountValue.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-2">레코드 수</p>
          </div>
        </div>

        {/* 상태 배지 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">마이그레이션 상태</h2>
            {isMatch ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                ✓ 데이터 일치
              </span>
            ) : (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                ⚠ 데이터 불일치
              </span>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {isMatch ? (
              <p className="text-sm text-gray-600">
                레거시 테이블과 신규 테이블의 데이터 개수가 일치합니다. 마이그레이션이 완료된 것으로 보입니다.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-700 font-semibold">
                  데이터 개수가 일치하지 않습니다.
                </p>
                <p className="text-sm text-gray-600">
                  차이: {Math.abs(legacyCountValue - newCountValue).toLocaleString()}개
                </p>
                <p className="text-sm text-gray-600">
                  {legacyCountValue > newCountValue
                    ? "레거시 테이블에 더 많은 데이터가 있습니다. 마이그레이션 스크립트를 실행해야 할 수 있습니다."
                    : "신규 테이블에 더 많은 데이터가 있습니다. 이는 정상일 수 있습니다 (신규 데이터 추가)."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 참고 정보 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">참고 사항</p>
          <ul className="list-disc list-inside space-y-1">
            <li>레거시 테이블(student_school_scores)은 Phase 4 이후 삭제 예정입니다.</li>
            <li>신규 테이블(student_internal_scores)이 정규화된 스키마를 사용합니다.</li>
            <li>데이터 불일치가 발생한 경우, 마이그레이션 스크립트를 확인하세요.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

