import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeeklyStudyTimeSummary } from "@/lib/reports/weekly";
import { getWeeklyPlanSummary } from "@/lib/reports/weekly";
import { getWeeklyGoalProgress } from "@/lib/reports/weekly";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// 이번 주 날짜 범위 계산
function getWeekRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

export async function WeeklySummarySection({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();
  const { weekStart, weekEnd } = getWeekRange();

  const [studyTime, planSummary, goalProgress] = await Promise.all([
    getWeeklyStudyTimeSummary(supabase, studentId, weekStart, weekEnd),
    getWeeklyPlanSummary(supabase, studentId, weekStart, weekEnd),
    getWeeklyGoalProgress(supabase, studentId, weekStart, weekEnd),
  ]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">이번주 요약</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <div className="text-sm text-gray-500">학습시간</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {studyTime.totalHours}시간 {studyTime.totalMinutes % 60}분
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">플랜 실행률</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {planSummary.completionRate}%
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {planSummary.completedPlans} / {planSummary.totalPlans} 완료
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">목표 달성률</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {goalProgress.averageProgress}%
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {goalProgress.activeGoals}개 진행 중
          </div>
        </div>
      </div>
    </div>
  );
}

