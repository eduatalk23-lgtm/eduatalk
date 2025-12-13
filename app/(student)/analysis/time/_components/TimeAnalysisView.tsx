"use client";

import ProgressBar from "@/components/atoms/ProgressBar";

type TimeStats = {
  totalSeconds: number;
  pausedSeconds: number;
  byContentType?: Record<string, number>;
  byDayOfWeek?: Record<number, number>;
};

type TimeAnalysisViewProps = {
  todayStats: TimeStats;
  weekStats: TimeStats & { byContentType: Record<string, number> };
  monthStats: TimeStats & { byDayOfWeek: Record<number, number> };
};

export function TimeAnalysisView({
  todayStats,
  weekStats,
  monthStats,
}: TimeAnalysisViewProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  const pureStudySeconds = (stats: TimeStats) =>
    Math.max(0, stats.totalSeconds - stats.pausedSeconds);

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const contentTypeLabels: Record<string, string> = {
    book: "📚 교재",
    lecture: "🎧 강의",
    custom: "📝 커스텀",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 오늘의 시간 통계 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">오늘의 시간</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">총 학습 시간</div>
            <div className="text-2xl font-bold text-indigo-600">
              {formatTime(todayStats.totalSeconds)}
            </div>
          </div>
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">순수 학습 시간</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatTime(pureStudySeconds(todayStats))}
            </div>
          </div>
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">일시정지 시간</div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatTime(todayStats.pausedSeconds)}
            </div>
          </div>
        </div>
      </div>

      {/* 이번 주 시간 통계 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">이번 주 시간</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">총 학습 시간</div>
            <div className="text-2xl font-bold text-indigo-600">
              {formatTime(weekStats.totalSeconds)}
            </div>
          </div>
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">순수 학습 시간</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatTime(pureStudySeconds(weekStats))}
            </div>
          </div>
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">일시정지 시간</div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatTime(weekStats.pausedSeconds)}
            </div>
          </div>
        </div>

        {/* 콘텐츠별 분포 */}
        {Object.keys(weekStats.byContentType).length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-700">콘텐츠별 학습 시간</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(weekStats.byContentType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, seconds]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {contentTypeLabels[type] || type}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatTime(seconds)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 이번 달 시간 통계 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">이번 달 시간</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">총 학습 시간</div>
            <div className="text-2xl font-bold text-indigo-600">
              {formatTime(monthStats.totalSeconds)}
            </div>
          </div>
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">순수 학습 시간</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatTime(pureStudySeconds(monthStats))}
            </div>
          </div>
          <div className="text-center flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-600">일시정지 시간</div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatTime(monthStats.pausedSeconds)}
            </div>
          </div>
        </div>

        {/* 요일별 분포 */}
        {Object.keys(monthStats.byDayOfWeek).length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-700">요일별 학습 시간</h3>
            <div className="flex flex-col gap-2">
              {weekdays.map((day, index) => {
                const seconds = monthStats.byDayOfWeek[index] || 0;
                const maxSeconds = Math.max(...Object.values(monthStats.byDayOfWeek), 1);
                const percentage = (seconds / maxSeconds) * 100;

                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-12 text-sm font-medium text-gray-700">{day}</div>
                    <div className="flex-1">
                      <ProgressBar
                        value={percentage}
                        color="indigo"
                        height="md"
                      />
                    </div>
                    <div className="w-20 text-right text-sm font-semibold text-gray-900">
                      {formatTime(seconds)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

