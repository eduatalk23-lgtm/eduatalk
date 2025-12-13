import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllGoals } from "@/lib/goals/queries";
import { calculateGoalProgress } from "@/lib/goals/calc";
import { ProgressBar } from "@/components/atoms/ProgressBar";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export async function GoalsSummarySection({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();

  const goals = await getAllGoals(supabase, studentId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 진행 중인 목표만 필터링 (최대 3개)
  const { getGoalProgress } = await import("@/lib/goals/queries");
  const goalsWithProgress = await Promise.all(
    goals.map(async (goal) => {
      const progressRows = await getGoalProgress(supabase, studentId, goal.id);
      const progress = calculateGoalProgress(goal, progressRows, today);
      return { goal, progress };
    })
  );

  const activeGoals = goalsWithProgress
    .filter((g) => g.progress.status === "in_progress")
    .slice(0, 3);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">목표 요약</h2>
      {activeGoals.length === 0 ? (
        <p className="text-sm text-gray-500">진행 중인 목표가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {activeGoals.map(({ goal, progress }) => (
            <div key={goal.id} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-gray-900">{goal.title}</div>
                <div className="text-sm font-semibold text-gray-900">
                  {progress.progressPercentage}%
                </div>
              </div>
              <ProgressBar
                value={progress.progressPercentage}
                max={100}
                color="indigo"
                size="sm"
              />
              {progress.daysRemaining !== null && (
                <div className="mt-2 text-xs text-gray-500">
                  {progress.daysRemaining}일 남음
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

