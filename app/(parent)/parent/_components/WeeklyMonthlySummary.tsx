import type {
  WeeklyPlanSummary,
  WeeklyStudyTimeSummary,
  WeeklyGoalProgress,
} from "@/lib/reports/weekly";
import type { MonthlyReport } from "@/lib/reports/monthly";
import { ProgressBar } from "@/components/atoms/ProgressBar";

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
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          이번 주 핵심 지표
        </h3>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">학습시간</span>
            <span className="text-sm font-semibold text-gray-900">
              {weeklyHours > 0 ? `${weeklyHours}시간 ` : ""}
              {weeklyMinutes}분
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">플랜 실행률</span>
              <span className="text-sm font-semibold text-gray-900">
                {weeklyPlanSummary.completionRate.toFixed(1)}%
              </span>
            </div>
            <ProgressBar
              value={weeklyPlanSummary.completionRate}
              max={100}
              color="indigo"
              size="sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">목표 달성률</span>
              <span className="text-sm font-semibold text-gray-900">
                {weeklyGoalProgress.averageProgress.toFixed(1)}%
              </span>
            </div>
            <ProgressBar
              value={weeklyGoalProgress.averageProgress}
              max={100}
              color="green"
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* 이번달 요약 */}
      {monthlyReport && (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">
            이번 달 핵심 지표
          </h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">학습시간</span>
              <span className="text-sm font-semibold text-gray-900">
                {Math.floor(monthlyReport.totals.studyMinutes / 60)}시간{" "}
                {monthlyReport.totals.studyMinutes % 60}분
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">플랜 실행률</span>
                <span className="text-sm font-semibold text-gray-900">
                  {monthlyReport.totals.completionRate.toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                value={monthlyReport.totals.completionRate}
                max={100}
                color="indigo"
                size="sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">목표 달성률</span>
                <span className="text-sm font-semibold text-gray-900">
                  {monthlyReport.totals.goalRate.toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                value={monthlyReport.totals.goalRate}
                max={100}
                color="green"
                size="sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

