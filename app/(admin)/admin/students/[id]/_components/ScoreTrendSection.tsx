/**
 * 성적 변화 조회 섹션 (관리자 영역)
 *
 * 새로운 통합 대시보드 API(/api/students/[id]/score-dashboard)를 사용합니다.
 */
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getStudentWithTenant,
  getEffectiveTenantId,
  validateTenantIdMismatch,
  handleScoreDashboardError,
  hasScoreDashboardData,
} from "@/lib/api/scoreDashboardUtils";

export async function ScoreTrendSection({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();

  // 학생 정보 조회 - 공통 유틸리티 사용
  const student = await getStudentWithTenant(supabase, studentId);

  // effectiveTenantId 결정 - 공통 유틸리티 사용
  const effectiveTenantId = getEffectiveTenantId(
    tenantContext,
    student?.tenant_id || null
  );

  if (!effectiveTenantId) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed border-yellow-300 bg-yellow-50 p-6">
        <p className="text-sm font-medium text-yellow-700">
          기관 정보를 찾을 수 없습니다.
        </p>
        <p className="text-xs text-yellow-600">
          성적 분석을 보려면 학생이 속한 기관 정보가 필요합니다.
        </p>
      </div>
    );
  }

  // tenantId 불일치 검증 - 공통 유틸리티 사용
  if (student) {
    validateTenantIdMismatch(
      tenantContext,
      student.tenant_id,
      studentId,
      "ScoreTrendSection"
    );
  }

  try {
    // 새로운 통합 대시보드 API 사용 (쿠키 전달)
    const cookieStore = await cookies();
    const dashboardData = await fetchScoreDashboard(
      {
        studentId,
        tenantId: effectiveTenantId,
      },
      {
        cookies: cookieStore,
      }
    );

    const { internalAnalysis, mockAnalysis, strategyResult } = dashboardData;

    const hasData = hasScoreDashboardData(internalAnalysis, mockAnalysis);

    return (
      <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">성적 분석</h2>

        {!hasData && (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              성적 데이터가 없습니다.
            </p>
            <p className="text-xs text-gray-500">
              학생의 내신 또는 모의고사 성적을 입력하면 분석 결과가 표시됩니다.
            </p>
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 rounded-lg bg-indigo-50 p-4">
            <div className="text-sm text-indigo-600">내신 GPA</div>
            <div className="text-2xl font-bold text-indigo-700">
              {internalAnalysis.totalGpa !== null
                ? internalAnalysis.totalGpa.toFixed(2)
                : "-"}
            </div>
            {internalAnalysis.zIndex !== null && (
              <div className="text-xs text-indigo-500">
                Z-Index: {internalAnalysis.zIndex.toFixed(2)}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-purple-50 p-4">
            <div className="text-sm text-purple-600">모의고사 평균 백분위</div>
            <div className="text-2xl font-bold text-purple-700">
              {mockAnalysis.avgPercentile !== null
                ? `${mockAnalysis.avgPercentile.toFixed(1)}%`
                : "-"}
            </div>
            {mockAnalysis.best3GradeSum !== null && (
              <div className="text-xs text-purple-500">
                상위 3개 등급 합: {mockAnalysis.best3GradeSum}
              </div>
            )}
          </div>
        </div>

        {/* 전략 분석 */}
        {strategyResult && (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-700">
              입시 전략
            </h3>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  strategyResult.type === "BALANCED"
                    ? "bg-blue-100 text-blue-800"
                    : strategyResult.type === "MOCK_ADVANTAGE"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-indigo-100 text-indigo-800"
                }`}
              >
                {strategyResult.type === "BALANCED"
                  ? "균형형"
                  : strategyResult.type === "MOCK_ADVANTAGE"
                  ? "모의고사 우위"
                  : "내신 우위"}
              </span>
              <p className="text-sm text-gray-700">{strategyResult.message}</p>
            </div>
            {strategyResult.data.diff !== null && (
              <div className="text-xs text-gray-600">
                내신 {strategyResult.data.internalPct?.toFixed(1) ?? "-"}% vs
                모의고사 {strategyResult.data.mockPct?.toFixed(1) ?? "-"}%
                (차이: {Math.abs(strategyResult.data.diff).toFixed(1)}%)
              </div>
            )}
          </div>
        )}

        {/* 교과군별 평점 */}
        {Object.keys(internalAnalysis.subjectStrength).length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-gray-700">
              교과군별 평점
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(internalAnalysis.subjectStrength).map(
                ([subject, gpa]) => (
                  <div
                    key={subject}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2"
                  >
                    <span className="text-sm text-gray-700">{subject}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {gpa.toFixed(2)}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    const errorMessage = handleScoreDashboardError(error, "ScoreTrendSection");
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-700">
          성적 정보를 불러오는 중 오류가 발생했습니다.
        </p>
        <p className="text-xs text-red-600">{errorMessage}</p>
      </div>
    );
  }
}
