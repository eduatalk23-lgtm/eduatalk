"use client";

type WeeklySummaryHeaderProps = {
  totalStudyTimeMinutes: number;
  planCompletionRate: number;
  goalProgressRate: number;
  studyTimeChange: number;
  planCompletionChange: number;
  goalProgressChange: number;
};

export function WeeklySummaryHeader({
  totalStudyTimeMinutes,
  planCompletionRate,
  goalProgressRate,
  studyTimeChange,
  planCompletionChange,
  goalProgressChange,
}: WeeklySummaryHeaderProps) {
  const hours = Math.floor(totalStudyTimeMinutes / 60);
  const minutes = totalStudyTimeMinutes % 60;

  const formatChange = (change: number) => {
    if (change === 0) return null;
    const sign = change > 0 ? "+" : "";
    const absValue = Math.abs(change);
    return { sign, value: absValue, isPositive: change > 0 };
  };

  const studyTimeChangeData = formatChange(studyTimeChange);
  const planChangeData = formatChange(planCompletionChange);
  const goalChangeData = formatChange(goalProgressChange);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-8 shadow-sm">
      <div className="grid gap-6 sm:grid-cols-3">
        {/* 총 학습시간 */}
        <div className="flex flex-col gap-2 text-center">
          <div className="text-sm font-medium text-gray-600">총 학습시간</div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-indigo-600">
              {hours}
            </span>
            <span className="text-2xl font-semibold text-indigo-600">시간</span>
            {minutes > 0 && (
              <>
                <span className="text-2xl font-semibold text-indigo-600">{minutes}</span>
                <span className="text-lg font-medium text-indigo-600">분</span>
              </>
            )}
          </div>
          {studyTimeChangeData && (
            <div
              className={`text-sm font-medium ${
                studyTimeChangeData.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {studyTimeChangeData.isPositive ? "▲" : "▼"} {studyTimeChangeData.sign}
              {studyTimeChangeData.value}분 (지난주 대비)
            </div>
          )}
        </div>

        {/* 플랜 실행률 */}
        <div className="flex flex-col gap-2 text-center">
          <div className="text-sm font-medium text-gray-600">플랜 실행률</div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-purple-600">
              {planCompletionRate}
            </span>
            <span className="text-2xl font-semibold text-purple-600">%</span>
          </div>
          {planChangeData && (
            <div
              className={`text-sm font-medium ${
                planChangeData.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {planChangeData.isPositive ? "▲" : "▼"} {planChangeData.sign}
              {planChangeData.value}%p (지난주 대비)
            </div>
          )}
        </div>

        {/* 목표 달성률 */}
        <div className="flex flex-col gap-2 text-center">
          <div className="text-sm font-medium text-gray-600">목표 달성률</div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-emerald-600">
              {goalProgressRate}
            </span>
            <span className="text-2xl font-semibold text-emerald-600">%</span>
          </div>
          {goalChangeData && (
            <div
              className={`text-sm font-medium ${
                goalChangeData.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {goalChangeData.isPositive ? "▲" : "▼"} {goalChangeData.sign}
              {goalChangeData.value}%p (지난주 대비)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

