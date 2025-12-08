/**
 * 성적 변화 조회 섹션 (관리자 영역)
 * 
 * 새로운 통합 대시보드 API(/api/students/[id]/score-dashboard)를 사용합니다.
 */
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export async function ScoreTrendSection({ studentId }: { studentId: string }) {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    return (
      <div className="rounded-lg border border-dashed border-yellow-300 bg-yellow-50 p-6">
        <p className="text-sm font-medium text-yellow-700">기관 정보를 찾을 수 없습니다.</p>
        <p className="mt-1 text-xs text-yellow-600">
          성적 분석을 보려면 학생이 속한 기관 정보가 필요합니다.
        </p>
      </div>
    );
  }

  try {
    // 새로운 통합 대시보드 API 사용
    const dashboardData = await fetchScoreDashboard({
      studentId,
      tenantId: tenantContext.tenantId,
    });

    const { internalAnalysis, mockAnalysis, strategyResult } = dashboardData;

    const hasData =
      internalAnalysis.totalGpa !== null ||
      mockAnalysis.avgPercentile !== null ||
      Object.keys(internalAnalysis.subjectStrength).length > 0;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">성적 분석</h2>

        {!hasData && (
          <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">성적 데이터가 없습니다.</p>
            <p className="mt-1 text-xs text-gray-500">
              학생의 내신 또는 모의고사 성적을 입력하면 분석 결과가 표시됩니다.
            </p>
          </div>
        )}

        {/* 통계 */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-indigo-50 p-4">
            <div className="text-sm text-indigo-600">내신 GPA</div>
            <div className="mt-1 text-2xl font-bold text-indigo-700">
              {internalAnalysis.totalGpa !== null ? internalAnalysis.totalGpa.toFixed(2) : "-"}
            </div>
            {internalAnalysis.zIndex !== null && (
              <div className="mt-1 text-xs text-indigo-500">
                Z-Index: {internalAnalysis.zIndex.toFixed(2)}
              </div>
            )}
          </div>
          <div className="rounded-lg bg-purple-50 p-4">
            <div className="text-sm text-purple-600">모의고사 평균 백분위</div>
            <div className="mt-1 text-2xl font-bold text-purple-700">
              {mockAnalysis.avgPercentile !== null ? `${mockAnalysis.avgPercentile.toFixed(1)}%` : "-"}
            </div>
            {mockAnalysis.best3GradeSum !== null && (
              <div className="mt-1 text-xs text-purple-500">
                상위 3개 등급 합: {mockAnalysis.best3GradeSum}
              </div>
            )}
          </div>
        </div>

        {/* 전략 분석 */}
        {strategyResult && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">입시 전략</h3>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                strategyResult.type === "BALANCED" ? "bg-blue-100 text-blue-800" :
                strategyResult.type === "MOCK_ADVANTAGE" ? "bg-purple-100 text-purple-800" :
                "bg-indigo-100 text-indigo-800"
              }`}>
                {strategyResult.type === "BALANCED" ? "균형형" :
                 strategyResult.type === "MOCK_ADVANTAGE" ? "모의고사 우위" :
                 "내신 우위"}
              </span>
              <p className="text-sm text-gray-700">{strategyResult.message}</p>
            </div>
            {strategyResult.data.diff !== null && (
              <div className="mt-2 text-xs text-gray-600">
                내신 {strategyResult.data.internalPct?.toFixed(1) ?? "-"}% vs 모의고사 {strategyResult.data.mockPct?.toFixed(1) ?? "-"}%
                (차이: {Math.abs(strategyResult.data.diff).toFixed(1)}%)
              </div>
            )}
          </div>
        )}

        {/* 교과군별 평점 */}
        {Object.keys(internalAnalysis.subjectStrength).length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">교과군별 평점</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(internalAnalysis.subjectStrength).map(([subject, gpa]) => (
                <div key={subject} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2">
                  <span className="text-sm text-gray-700">{subject}</span>
                  <span className="text-sm font-semibold text-gray-900">{gpa.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[ScoreTrendSection] 성적 변화 조회 실패", error);
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-700">성적 정보를 불러오는 중 오류가 발생했습니다.</p>
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      </div>
    );
  }
}

