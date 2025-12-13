import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllGoals } from "@/lib/goals/queries";
import { calculateGoalProgress } from "@/lib/goals/calc";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { SectionCard } from "@/components/ui/SectionCard";

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
    <SectionCard title="목표 요약">
      {activeGoals.length === 0 ? (
        <p className="text-sm text-gray-500">진행 중인 목표가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {activeGoals.map(({ goal, progress }) => (
            <div key={goal.id} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
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
                <div className="text-xs text-gray-500">
                  {progress.daysRemaining}일 남음
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

