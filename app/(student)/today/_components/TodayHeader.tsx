import { getStudentById } from "@/lib/data/students";
import { calculateStreak } from "@/lib/metrics/streak";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

export async function TodayHeader() {
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
  const dayOfWeek = dayNames[today.getDay()];
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {student?.name || "학생"}님, 오늘 시작해볼까요?
        </h1>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-semibold text-orange-700">
              {streak}일 연속
            </span>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600">
        {dateStr} ({dayOfWeek})
      </p>
    </div>
  );
  } catch (error) {
    console.error("[TodayHeader] 컴포넌트 렌더링 실패", error);
    const today = new Date();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayOfWeek = dayNames[today.getDay()];
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    return (
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            학생님, 오늘 시작해볼까요?
          </h1>
        </div>
        <p className="text-sm text-gray-600">
          {dateStr} ({dayOfWeek})
        </p>
      </div>
    );
  }
}

