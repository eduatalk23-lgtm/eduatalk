import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export async function TodayAchievements() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return null;
    }

    const tenantContext = await getTenantContext();
    const progress = await calculateTodayProgress(
      user.userId,
      tenantContext?.tenantId || null
    ).catch((error) => {
      console.error("[TodayAchievements] 진행률 계산 실패", error);
      return {
        todayStudyMinutes: 0,
        planCompletedCount: 0,
        planTotalCount: 0,
        goalProgressSummary: [],
        achievementScore: 0,
      };
    });

  const completionRate =
    progress.planTotalCount > 0
      ? Math.round((progress.planCompletedCount / progress.planTotalCount) * 100)
      : 0;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">오늘 성취도</h2>
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-gray-600">학습 시간</span>
            <span className="font-semibold text-gray-900">
              {Math.floor(progress.todayStudyMinutes / 60)}시간{" "}
              {progress.todayStudyMinutes % 60}분
            </span>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-gray-600">완료한 플랜</span>
            <span className="font-semibold text-gray-900">
              {progress.planCompletedCount} / {progress.planTotalCount}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-gray-600">학습 효율 점수</span>
            <span className="font-semibold text-blue-600">
              {progress.achievementScore}점
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.achievementScore}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error("[TodayAchievements] 컴포넌트 렌더링 실패", error);
    return (
      <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">오늘 성취도</h2>
        <p className="text-sm text-gray-500">성취도 정보를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    );
  }
}

