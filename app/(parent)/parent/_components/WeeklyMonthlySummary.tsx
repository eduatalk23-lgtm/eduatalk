import type {
  WeeklyPlanSummary,
  WeeklyStudyTimeSummary,
  WeeklyGoalProgress,
} from "@/lib/reports/weekly";
import type { MonthlyReport } from "@/lib/reports/monthly";

type WeeklyMonthlySummaryProps = {
  weeklyPlanSummary: WeeklyPlanSummary;
  weeklyStudyTime: WeeklyStudyTimeSummary;
  weeklyGoalProgress: WeeklyGoalProgress;
  monthlyReport: MonthlyReport | null;
};

export function WeeklyMonthlySummary({
  weeklyPlanSummary,
  weeklyStudyTime,
  weeklyGoalProgress,
  monthlyReport,
}: WeeklyMonthlySummaryProps) {
  const weeklyHours = Math.floor(weeklyStudyTime.totalMinutes / 60);
  const weeklyMinutes = weeklyStudyTime.totalMinutes % 60;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* 이번주 요약 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          이번 주 핵심 지표
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">학습시간</span>
              <span className="text-sm font-semibold text-gray-900">
                {weeklyHours > 0 ? `${weeklyHours}시간 ` : ""}
                {weeklyMinutes}분
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">플랜 실행률</span>
              <span className="text-sm font-semibold text-gray-900">
                {weeklyPlanSummary.completionRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${weeklyPlanSummary.completionRate}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">목표 달성률</span>
              <span className="text-sm font-semibold text-gray-900">
                {weeklyGoalProgress.averageProgress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all"
                style={{ width: `${weeklyGoalProgress.averageProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 이번달 요약 */}
      {monthlyReport && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            이번 달 핵심 지표
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">학습시간</span>
                <span className="text-sm font-semibold text-gray-900">
                  {Math.floor(monthlyReport.totals.studyMinutes / 60)}시간{" "}
                  {monthlyReport.totals.studyMinutes % 60}분
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">플랜 실행률</span>
                <span className="text-sm font-semibold text-gray-900">
                  {monthlyReport.totals.completionRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${monthlyReport.totals.completionRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">목표 달성률</span>
                <span className="text-sm font-semibold text-gray-900">
                  {monthlyReport.totals.goalRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${monthlyReport.totals.goalRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

