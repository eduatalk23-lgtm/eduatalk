import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { ProgressBar } from "@/components/ui/ProgressBar";

type TodayGoalsProps = {
  todayProgress: TodayProgress;
};

export async function TodayGoals({ todayProgress }: TodayGoalsProps) {
  try {
    // goalProgressSummary 속성이 없으므로 빈 배열로 처리
    // TODO: 목표 진행률 데이터를 별도로 조회하거나 TodayProgress 타입에 추가 필요
    const topGoals: Array<{ goalId: string; title: string; progress: number }> = [];

    if (topGoals.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-gray-900">오늘 목표</h2>
            <p className="text-sm text-gray-500">오늘 완료해야 할 목표가 없습니다.</p>
          </div>
        </div>
      );
    }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">오늘 목표</h2>
        <div className="flex flex-col gap-3">
          {topGoals.map((goal) => (
            <div key={goal.goalId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{goal.title}</span>
                <span className="text-gray-600">{goal.progress}%</span>
              </div>
              <ProgressBar value={goal.progress} height="md" color="blue" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error("[TodayGoals] 컴포넌트 렌더링 실패", error);
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-gray-900">오늘 목표</h2>
          <p className="text-sm text-gray-500">목표 정보를 불러오는 중 오류가 발생했습니다.</p>
        </div>
      </div>
    );
  }
}

