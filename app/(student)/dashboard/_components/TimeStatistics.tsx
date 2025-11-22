"use client";

type TimeStatisticsProps = {
  totalStudySeconds: number;
  pureStudySeconds: number;
  pausedSeconds: number;
  averagePlanMinutes: number;
};

export function TimeStatistics({
  totalStudySeconds,
  pureStudySeconds,
  pausedSeconds,
  averagePlanMinutes,
}: TimeStatisticsProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-gray-900">📊 오늘의 시간 분석</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1 text-center">
            <div className="text-sm font-medium text-gray-600">총 학습 시간</div>
            <div className="text-2xl font-bold text-indigo-600">
              {formatTime(totalStudySeconds)}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <div className="text-sm font-medium text-gray-600">순수 학습 시간</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatTime(pureStudySeconds)}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <div className="text-sm font-medium text-gray-600">일시정지 시간</div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatTime(pausedSeconds)}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <div className="text-sm font-medium text-gray-600">평균 플랜 시간</div>
            <div className="text-2xl font-bold text-purple-600">
              {averagePlanMinutes}분
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

