import type { ReportData } from "../_utils";

type ReportViewProps = {
  data: ReportData;
};

export function ReportView({ data }: ReportViewProps) {
  const {
    studentInfo,
    periodLabel,
    weeklySummary,
    gradeTrends,
    weakSubjects,
    strategies,
    nextWeekSchedule,
  } = data;

  return (
    <div className="space-y-6">
      {/* 학생 정보 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-900">학생 정보</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-sm text-gray-500">이름</p>
            <p className="text-lg font-semibold text-gray-900">
              {studentInfo.name ?? "정보 없음"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">학년</p>
            <p className="text-lg font-semibold text-gray-900">
              {studentInfo.grade ?? "정보 없음"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">반</p>
            <p className="text-lg font-semibold text-gray-900">
              {studentInfo.class ?? "정보 없음"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">기간</p>
            <p className="text-lg font-semibold text-gray-900">{periodLabel}            </p>
          </div>
        </div>
        </div>
      </div>

      {/* 학습 요약 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            📊 이번 {data.period === "weekly" ? "주" : "달"} 학습 요약
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm text-indigo-600">총 학습 시간</p>
            <p className="text-2xl font-bold text-indigo-900">
              {Math.round(weeklySummary.totalLearningTime / 60)}시간{" "}
              {weeklySummary.totalLearningTime % 60}분
            </p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-600">완료율</p>
            <p className="text-2xl font-bold text-green-900">
              {weeklySummary.completionRate.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-600">완료된 플랜</p>
            <p className="text-2xl font-bold text-blue-900">
              {weeklySummary.completedPlans} / {weeklySummary.totalPlans}
            </p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm text-purple-600">학습한 과목</p>
            <p className="text-2xl font-bold text-purple-900">
              {weeklySummary.subjects.length}개
            </p>
          </div>
        </div>
        {weeklySummary.subjects.length > 0 && (
          <div>
            <p className="text-sm text-gray-500">
              <strong>과목:</strong> {weeklySummary.subjects.join(", ")}
            </p>
          </div>
        )}
        </div>
      </div>

      {/* 성적 변화 추이 */}
      {gradeTrends.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              📈 과목별 성적 변화 추이
            </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    과목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    평균 등급
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    추이
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    최근 시험
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {gradeTrends.map((trend) => {
                  const latest = trend.recentGrades[trend.recentGrades.length - 1];
                  const trendClass =
                    trend.trend === "improving"
                      ? "text-green-600"
                      : trend.trend === "declining"
                      ? "text-red-600"
                      : "text-gray-600";
                  const trendIcon =
                    trend.trend === "improving"
                      ? "📈"
                      : trend.trend === "declining"
                      ? "📉"
                      : "➡️";
                  const trendText =
                    trend.trend === "improving"
                      ? "개선"
                      : trend.trend === "declining"
                      ? "하락"
                      : "유지";

                  return (
                    <tr key={trend.subject} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {trend.subject}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {trend.averageGrade.toFixed(1)}등급
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${trendClass}`}>
                        {trendIcon} {trendText}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {latest
                          ? `${latest.test_date} (${latest.grade}등급)`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* 취약과목 알림 */}
      {weakSubjects.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-red-900">⚠️ 취약과목 알림</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-900">
                    과목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-900">
                    Risk Index
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-900">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-200">
                {weakSubjects.map((weak) => {
                  const riskClass =
                    weak.risk_score >= 70
                      ? "bg-red-600 text-white"
                      : "bg-orange-500 text-white";

                  return (
                    <tr key={weak.subject} className="hover:bg-red-100">
                      <td className="px-4 py-3 text-sm font-medium text-red-900">
                        {weak.subject}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-block rounded px-3 py-1 font-semibold ${riskClass}`}
                        >
                          {weak.risk_score.toFixed(1)}점
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-red-800">{weak.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* 추천 학습 전략 */}
      {strategies.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-900">💡 추천 학습 전략</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    과목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    우선순위
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    전략
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {strategies.map((strategy) => {
                  const priorityClass =
                    strategy.priority === "high"
                      ? "text-red-600 font-bold"
                      : strategy.priority === "medium"
                      ? "text-orange-600"
                      : "text-green-600";
                  const priorityText =
                    strategy.priority === "high"
                      ? "높음"
                      : strategy.priority === "medium"
                      ? "보통"
                      : "낮음";

                  return (
                    <tr key={strategy.subject} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {strategy.subject}
                      </td>
                      <td className={`px-4 py-3 text-sm ${priorityClass}`}>
                        {priorityText}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {strategy.strategy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* 다음주 스케줄 */}
      {nextWeekSchedule.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              📅 다음주 자동 스케줄 요약
            </h2>
          <div className="space-y-4">
            {nextWeekSchedule.map((day) => (
              <div
                key={day.date}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {day.date} ({day.dayOfWeek})
                </h3>
                <div className="space-y-2">
                  {day.plans.map((plan, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 text-sm text-gray-700"
                    >
                      <span className="font-medium text-gray-900 w-24">{plan.time}</span>
                      <span>
                        {plan.content}
                        {plan.subject && (
                          <span className="text-gray-500"> ({plan.subject})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

