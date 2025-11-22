import type { TodayProgress } from "@/lib/metrics/todayProgress";

type TodayFocusPreviewProps = {
  todayProgress: TodayProgress;
};

export async function TodayFocusPreview({ todayProgress }: TodayFocusPreviewProps) {
  try {
    const hours = Math.floor(todayProgress.todayStudyMinutes / 60);
    const minutes = todayProgress.todayStudyMinutes % 60;

  return (
    <div className="mb-6 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">집중 타이머</h2>
      <div>
        <div className="mb-1 text-2xl font-bold text-purple-700">
          {hours > 0 ? `${hours}시간 ` : ""}
          {minutes}분
        </div>
        <p className="text-sm text-gray-600">오늘 집중한 시간</p>
      </div>
    </div>
  );
  } catch (error) {
    console.error("[TodayFocusPreview] 컴포넌트 렌더링 실패", error);
    return (
      <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">집중 타이머</h2>
        <p className="text-sm text-gray-500">타이머 정보를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    );
  }
}

