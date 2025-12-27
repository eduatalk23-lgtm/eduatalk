import { getStudentById } from "@/lib/data/students";
import { calculateStreak } from "@/lib/metrics/streak";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { formatDateString } from "@/lib/date/calendarUtils";

const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

type TodayHeaderProps = {
  selectedDate?: string; // YYYY-MM-DD 형식
};

export async function TodayHeader({ selectedDate }: TodayHeaderProps = {}) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return null;
    }

    const tenantContext = await getTenantContext();
    const [studentResult, streakResult] = await Promise.allSettled([
      getStudentById(user.userId, tenantContext?.tenantId || null),
      calculateStreak(user.userId, tenantContext?.tenantId || null),
    ]);

    const student =
      studentResult.status === "fulfilled" ? studentResult.value : null;
    const streak =
      streakResult.status === "fulfilled" ? streakResult.value : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateString(today);

    // 선택된 날짜 또는 오늘 날짜
    const displayDate = selectedDate ? new Date(selectedDate) : today;
    const isToday = !selectedDate || selectedDate === todayStr;

    const dayOfWeek = dayNames[displayDate.getDay()];
    const dateStr = `${displayDate.getFullYear()}년 ${displayDate.getMonth() + 1}월 ${displayDate.getDate()}일`;

    // 날짜 차이 계산
    const diffTime = displayDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // 날짜에 따른 제목
    const getTitle = () => {
      if (isToday) {
        return `${student?.name || "학생"}님, 오늘 시작해볼까요?`;
      }

      if (diffDays < 0) {
        return `${displayDate.getMonth() + 1}월 ${displayDate.getDate()}일 학습 기록`;
      } else {
        return `${displayDate.getMonth() + 1}월 ${displayDate.getDate()}일 학습 계획`;
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {getTitle()}
          </h1>
          {streak > 0 && isToday && (
            <div className="flex items-center gap-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5">
              <span className="text-lg">🔥</span>
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                {streak}일 연속
              </span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {dateStr} ({dayOfWeek})
          {!isToday && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              • {diffDays < 0 ? "지난 날짜" : "예정된 날짜"}
            </span>
          )}
        </p>
      </div>
    );
  } catch (error) {
    console.error("[TodayHeader] 컴포넌트 렌더링 실패", error);
    const today = new Date();
    const dayOfWeek = dayNames[today.getDay()];
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            학생님, 오늘 시작해볼까요?
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {dateStr} ({dayOfWeek})
        </p>
      </div>
    );
  }
}

