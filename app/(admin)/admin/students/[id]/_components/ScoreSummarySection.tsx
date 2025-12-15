/**
 * 성적 요약 섹션 (관리자 영역)
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
} from "@/lib/api/scoreDashboardUtils";

export async function ScoreSummarySection({ studentId }: { studentId: string }) {
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
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">기관 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  // tenantId 불일치 검증 - 공통 유틸리티 사용
  if (student) {
    validateTenantIdMismatch(
      tenantContext,
      student.tenant_id,
      studentId,
      "ScoreSummarySection"
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

    const { internalAnalysis, mockAnalysis } = dashboardData;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">성적 요약</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 내신 분석 */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">내신 분석</h3>
            {internalAnalysis.totalGpa === null ? (
              <p className="text-sm text-gray-500">내신 성적이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">전체 GPA</span>
                  <span className="font-semibold text-gray-900">
                    {internalAnalysis.totalGpa.toFixed(2)}
                  </span>
                </div>
                {internalAnalysis.zIndex !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Z-Index</span>
                    <span className="font-semibold text-gray-900">
                      {internalAnalysis.zIndex.toFixed(2)}
                    </span>
                  </div>
                )}
                {Object.keys(internalAnalysis.subjectStrength).length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-gray-600">교과군별 평점</p>
                    {Object.entries(internalAnalysis.subjectStrength).map(([subject, gpa]) => (
                      <div key={subject} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{subject}</span>
                        <span className="font-medium text-gray-900">{gpa.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 모의고사 분석 */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">모의고사 분석</h3>
            {mockAnalysis.recentExam === null && mockAnalysis.avgPercentile === null ? (
              <p className="text-sm text-gray-500">모의고사 성적이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {mockAnalysis.recentExam && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">최근 시험</span>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-gray-900">
                        {mockAnalysis.recentExam.examTitle}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(mockAnalysis.recentExam.examDate).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  </div>
                )}
                {mockAnalysis.avgPercentile !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">평균 백분위</span>
                    <span className="font-semibold text-gray-900">
                      {mockAnalysis.avgPercentile.toFixed(1)}%
                    </span>
                  </div>
                )}
                {mockAnalysis.totalStdScore !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">표준점수 합</span>
                    <span className="font-semibold text-gray-900">
                      {mockAnalysis.totalStdScore}
                    </span>
                  </div>
                )}
                {mockAnalysis.best3GradeSum !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">상위 3개 등급 합</span>
                    <span className="font-semibold text-gray-900">
                      {mockAnalysis.best3GradeSum}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    const errorMessage = handleScoreDashboardError(error, "ScoreSummarySection");
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          성적 정보를 불러오는 중 오류가 발생했습니다: {errorMessage}
        </p>
      </div>
    );
  }
}

