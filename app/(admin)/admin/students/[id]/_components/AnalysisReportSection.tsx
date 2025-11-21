import { getStudentAnalysisForAdmin } from "@/lib/data/admin/studentData";

export async function AnalysisReportSection({ studentId }: { studentId: string }) {
  try {
    const analysis = await getStudentAnalysisForAdmin(studentId);

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">분석 리포트</h2>

        {/* 주간 요약 */}
        {analysis.weeklyPlanSummary && (
          <div className="mb-6 rounded-lg bg-indigo-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-indigo-700">이번 주 플랜 실행률</h3>
            <div className="text-3xl font-bold text-indigo-700">
              {analysis.weeklyPlanSummary.completionRate}%
            </div>
            <div className="mt-2 text-xs text-indigo-600">
              완료: {analysis.weeklyPlanSummary.completedPlans} /{" "}
              {analysis.weeklyPlanSummary.totalPlans}
            </div>
          </div>
        )}

        {/* 주간 학습시간 */}
        {analysis.weeklyStudyTime && (
          <div className="mb-6 rounded-lg bg-purple-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-purple-700">이번 주 학습시간</h3>
            <div className="text-3xl font-bold text-purple-700">
              {analysis.weeklyStudyTime.totalHours}시간{" "}
              {analysis.weeklyStudyTime.totalMinutes % 60}분
            </div>
          </div>
        )}

        {/* 월간 리포트 */}
        {analysis.monthlyReport && (
          <div className="mb-6 rounded-lg bg-emerald-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-emerald-700">이번 달 요약</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-emerald-600">총 학습시간</div>
                <div className="mt-1 text-lg font-bold text-emerald-700">
                  {Math.floor(analysis.monthlyReport.totals.studyMinutes / 60)}시간
                </div>
              </div>
              <div>
                <div className="text-xs text-emerald-600">플랜 실행률</div>
                <div className="mt-1 text-lg font-bold text-emerald-700">
                  {analysis.monthlyReport.totals.completionRate}%
                </div>
              </div>
              <div>
                <div className="text-xs text-emerald-600">목표 달성률</div>
                <div className="mt-1 text-lg font-bold text-emerald-700">
                  {analysis.monthlyReport.totals.goalRate}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 위험 분석 */}
        {analysis.riskAnalysis.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">과목별 위험 분석</h3>
            <div className="space-y-2">
              {analysis.riskAnalysis.slice(0, 5).map((risk: any, index: number) => {
                const riskLevel =
                  risk.risk_score >= 70 ? "high" : risk.risk_score >= 40 ? "medium" : "low";
                const riskColors = {
                  high: "bg-red-100 text-red-800 border-red-200",
                  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
                  low: "bg-green-100 text-green-800 border-green-200",
                };
                const riskLabels = {
                  high: "높음",
                  medium: "보통",
                  low: "낮음",
                };

                return (
                  <div
                    key={index}
                    className={`rounded-lg border p-3 ${riskColors[riskLevel]}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">{risk.subject ?? "미분류"}</span>
                      <span className="text-xs font-semibold">
                        {riskLabels[riskLevel]} ({risk.risk_score}점)
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-gray-600">최근 성적 추이</div>
                        <div className="font-semibold">{risk.recent_grade_trend ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">일관성 점수</div>
                        <div className="font-semibold">{risk.consistency_score ?? 100}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">숙련도 추정</div>
                        <div className="font-semibold">{risk.mastery_estimate ?? 0}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!analysis.weeklyPlanSummary &&
          !analysis.weeklyStudyTime &&
          !analysis.monthlyReport &&
          analysis.riskAnalysis.length === 0 && (
            <p className="text-sm text-gray-500">분석 데이터가 없습니다.</p>
          )}
      </div>
    );
  } catch (error) {
    console.error("[AnalysisReportSection] 분석 리포트 조회 실패", error);
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6">
        <p className="text-sm text-gray-500">분석 리포트를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    );
  }
}

