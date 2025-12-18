import { cn } from "@/lib/cn";
import type { ReportData } from "../_utils";
import {
  bgSurfaceVar,
  bgPageVar,
  borderDefaultVar,
  textPrimaryVar,
  textSecondaryVar,
  textTertiaryVar,
  divideDefaultVar,
} from "@/lib/utils/darkMode";

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
      <div className={cn("rounded-lg border p-6", bgPageVar, borderDefaultVar)}>
        <div className="flex flex-col gap-4">
          <h2 className={cn("text-xl font-semibold", textPrimaryVar)}>학생 정보</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className={cn("text-sm", textTertiaryVar)}>이름</p>
            <p className={cn("text-lg font-semibold", textPrimaryVar)}>
              {studentInfo.name ?? "정보 없음"}
            </p>
          </div>
          <div>
            <p className={cn("text-sm", textTertiaryVar)}>학년</p>
            <p className={cn("text-lg font-semibold", textPrimaryVar)}>
              {studentInfo.grade ?? "정보 없음"}
            </p>
          </div>
          <div>
            <p className={cn("text-sm", textTertiaryVar)}>반</p>
            <p className={cn("text-lg font-semibold", textPrimaryVar)}>
              {studentInfo.class ?? "정보 없음"}
            </p>
          </div>
          <div>
            <p className={cn("text-sm", textTertiaryVar)}>기간</p>
            <p className={cn("text-lg font-semibold", textPrimaryVar)}>{periodLabel}            </p>
          </div>
        </div>
        </div>
      </div>

      {/* 학습 요약 */}
      <div className={cn("rounded-lg border p-6 shadow-sm", bgSurfaceVar, borderDefaultVar)}>
        <div className="flex flex-col gap-4">
          <h2 className={cn("text-xl font-semibold", textPrimaryVar)}>
            📊 이번 {data.period === "weekly" ? "주" : "달"} 학습 요약
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 p-4">
            <p className="text-sm text-indigo-600 dark:text-indigo-400">총 학습 시간</p>
            <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-200">
              {Math.round(weeklySummary.totalLearningTime / 60)}시간{" "}
              {weeklySummary.totalLearningTime % 60}분
            </p>
          </div>
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 p-4">
            <p className="text-sm text-green-600 dark:text-green-400">완료율</p>
            <p className="text-2xl font-bold text-green-900 dark:text-green-200">
              {weeklySummary.completionRate.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-4">
            <p className="text-sm text-blue-600 dark:text-blue-400">완료된 플랜</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
              {weeklySummary.completedPlans} / {weeklySummary.totalPlans}
            </p>
          </div>
          <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 p-4">
            <p className="text-sm text-purple-600 dark:text-purple-400">학습한 과목</p>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
              {weeklySummary.subjects.length}개
            </p>
          </div>
        </div>
        {weeklySummary.subjects.length > 0 && (
          <div>
            <p className={cn("text-sm", textTertiaryVar)}>
              <strong>과목:</strong> {weeklySummary.subjects.join(", ")}
            </p>
          </div>
        )}
        </div>
      </div>

      {/* 성적 변화 추이 */}
      {gradeTrends.length > 0 && (
        <div className={cn("rounded-lg border p-6 shadow-sm", bgSurfaceVar, borderDefaultVar)}>
          <div className="flex flex-col gap-4">
            <h2 className={cn("text-xl font-semibold", textPrimaryVar)}>
              📈 과목별 성적 변화 추이
            </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
                <tr>
                  <th className={cn("px-4 py-3 text-left text-xs font-semibold", textSecondaryVar)}>
                    과목
                  </th>
                  <th className={cn("px-4 py-3 text-left text-xs font-semibold", textSecondaryVar)}>
                    평균 등급
                  </th>
                  <th className={cn("px-4 py-3 text-left text-xs font-semibold", textSecondaryVar)}>
                    추이
                  </th>
                  <th className={cn("px-4 py-3 text-left text-xs font-semibold", textSecondaryVar)}>
                    최근 시험
                  </th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", divideDefaultVar)}>
                {gradeTrends.map((trend) => {
                  const latest = trend.recentGrades[trend.recentGrades.length - 1];
                  const trendClass =
                    trend.trend === "improving"
                      ? "text-green-600 dark:text-green-400"
                      : trend.trend === "declining"
                      ? "text-red-600 dark:text-red-400"
                      : textTertiaryVar;
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
                    <tr key={trend.subject} className="hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-900))]">
                      <td className={cn("px-4 py-3 text-sm font-medium", textPrimaryVar)}>
                        {trend.subject}
                      </td>
                      <td className={cn("px-4 py-3 text-sm", textSecondaryVar)}>
                        {trend.averageGrade.toFixed(1)}등급
                      </td>
                      <td className={cn("px-4 py-3 text-sm font-semibold", trendClass)}>
                        {trendIcon} {trendText}
                      </td>
                      <td className={cn("px-4 py-3 text-sm", textSecondaryVar)}>
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
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-200">⚠️ 취약과목 알림</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-100 dark:bg-red-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-900 dark:text-red-200">
                    과목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-900 dark:text-red-200">
                    Risk Index
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-900 dark:text-red-200">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-200 dark:divide-red-800">
                {weakSubjects.map((weak) => {
                  const riskClass =
                    weak.risk_score >= 70
                      ? "bg-red-600 dark:bg-red-700 text-white"
                      : "bg-orange-500 dark:bg-orange-600 text-white";

                  return (
                    <tr key={weak.subject} className="hover:bg-red-100 dark:hover:bg-red-900/50">
                      <td className="px-4 py-3 text-sm font-medium text-red-900 dark:text-red-200">
                        {weak.subject}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={cn("inline-block rounded px-3 py-1 font-semibold", riskClass)}
                        >
                          {weak.risk_score.toFixed(1)}점
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-red-800 dark:text-red-300">{weak.reason}</td>
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
        <div className={cn("rounded-lg border p-6 shadow-sm", bgSurfaceVar, borderDefaultVar)}>
          <div className="flex flex-col gap-4">
            <h2 className={cn("text-xl font-semibold", textPrimaryVar)}>💡 추천 학습 전략</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
                <tr>
                  <th className={cn("px-4 py-3 text-left text-xs font-semibold", textSecondaryVar)}>
                    과목
                  </th>
                  <th className={cn("px-4 py-3 text-left text-xs font-semibold", textSecondaryVar)}>
                    우선순위
                  </th>
                  <th className={cn("px-4 py-3 text-left text-xs font-semibold", textSecondaryVar)}>
                    전략
                  </th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", divideDefaultVar)}>
                {strategies.map((strategy) => {
                  const priorityClass =
                    strategy.priority === "high"
                      ? "text-red-600 dark:text-red-400 font-bold"
                      : strategy.priority === "medium"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-green-600 dark:text-green-400";
                  const priorityText =
                    strategy.priority === "high"
                      ? "높음"
                      : strategy.priority === "medium"
                      ? "보통"
                      : "낮음";

                  return (
                    <tr key={strategy.subject} className="hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-900))]">
                      <td className={cn("px-4 py-3 text-sm font-medium", textPrimaryVar)}>
                        {strategy.subject}
                      </td>
                      <td className={cn("px-4 py-3 text-sm", priorityClass)}>
                        {priorityText}
                      </td>
                      <td className={cn("px-4 py-3 text-sm", textSecondaryVar)}>
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
        <div className={cn("rounded-lg border p-6 shadow-sm", bgSurfaceVar, borderDefaultVar)}>
          <div className="flex flex-col gap-4">
            <h2 className={cn("text-xl font-semibold", textPrimaryVar)}>
              📅 다음주 학습 스케줄 요약
            </h2>
          <div className="space-y-4">
            {nextWeekSchedule.map((day) => (
              <div
                key={day.date}
                className={cn("rounded-lg border p-4", bgPageVar, borderDefaultVar)}
              >
                <h3 className={cn("text-lg font-semibold", textPrimaryVar)}>
                  {day.date} ({day.dayOfWeek})
                </h3>
                <div className="space-y-2">
                  {day.plans.map((plan, index) => (
                    <div
                      key={index}
                      className={cn("flex items-center gap-3 text-sm", textSecondaryVar)}
                    >
                      <span className={cn("font-medium w-24", textPrimaryVar)}>{plan.time}</span>
                      <span>
                        {plan.content}
                        {plan.subject && (
                          <span className={cn(textTertiaryVar)}> ({plan.subject})</span>
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

