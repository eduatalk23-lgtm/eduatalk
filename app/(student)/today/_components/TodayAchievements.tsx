import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { ProgressBar } from "@/components/ui/ProgressBar";

type TodayAchievementsProps = {
  todayProgress: TodayProgress;
};

export async function TodayAchievements({ todayProgress }: TodayAchievementsProps) {
  try {
    const completionRate =
      todayProgress.planTotalCount > 0
        ? Math.round((todayProgress.planCompletedCount / todayProgress.planTotalCount) * 100)
        : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">오늘 성취도</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">학습 시간</span>
            <span className="font-semibold text-gray-900">
              {Math.floor(todayProgress.todayStudyMinutes / 60)}시간{" "}
              {todayProgress.todayStudyMinutes % 60}분
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">완료한 플랜</span>
              {todayProgress.planTotalCount > 0 ? (
                <span className="font-semibold text-gray-900">
                  {todayProgress.planCompletedCount} / {todayProgress.planTotalCount}
                </span>
              ) : (
                <span className="text-gray-400">플랜 없음</span>
              )}
            </div>
            {todayProgress.planTotalCount > 0 ? (
              <ProgressBar value={completionRate} height="md" color="green" />
            ) : (
              <ProgressBar value={0} height="md" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">학습 효율 점수</span>
              <span className="font-semibold text-blue-600">
                {todayProgress.achievementScore}점
              </span>
            </div>
            <ProgressBar value={todayProgress.achievementScore} height="md" color="blue" />
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error("[TodayAchievements] 컴포넌트 렌더링 실패", error);
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">오늘 성취도</h2>
          <p className="text-sm text-gray-500">성취도 정보를 불러오는 중 오류가 발생했습니다.</p>
        </div>
      </div>
    );
  }
}

