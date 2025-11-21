type TodaySummaryProps = {
  todayMinutes: number;
  todayPlanCount: number;
  todayExecutionRate: number;
};

export function TodaySummary({
  todayMinutes,
  todayPlanCount,
  todayExecutionRate,
}: TodaySummaryProps) {
  const hours = Math.floor(todayMinutes / 60);
  const minutes = todayMinutes % 60;

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">오늘 학습 요약</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4">
          <div className="text-sm font-medium text-gray-500 mb-1">
            오늘 학습시간
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {hours > 0 ? `${hours}시간 ` : ""}
            {minutes}분
          </div>
        </div>
        <div className="rounded-lg bg-white p-4">
          <div className="text-sm font-medium text-gray-500 mb-1">
            오늘 플랜 개수
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {todayPlanCount}개
          </div>
        </div>
        <div className="rounded-lg bg-white p-4">
          <div className="text-sm font-medium text-gray-500 mb-1">
            실행률
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {todayExecutionRate}%
          </div>
        </div>
      </div>
    </div>
  );
}

