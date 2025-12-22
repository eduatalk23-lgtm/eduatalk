
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../_utils";
import { getAllGoals, getActiveGoals } from "@/lib/goals/queries";
import { calculateGoalProgress } from "@/lib/goals/calc";
import { StudentSelector } from "../_components/StudentSelector";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  bgPage,
  bgHover,
  textPrimary,
  textSecondary,
  textMuted,
  borderDefault,
  borderInput,
} from "@/lib/utils/darkMode";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ParentGoalsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 연결된 학생 목록 조회
  const linkedStudents = await getLinkedStudents(supabase, userId);

  if (linkedStudents.length === 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-yellow-900">
            연결된 자녀가 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 선택된 학생 ID
  const selectedStudentId =
    params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    redirect("/parent/goals");
  }

  // 접근 권한 확인
  const hasAccess = await canAccessStudent(
    supabase,
    userId,
    selectedStudentId
  );

  if (!hasAccess) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900">
            접근 권한이 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 오늘 날짜
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);

  // 목표 조회
  const [allGoals, activeGoals] = await Promise.all([
    getAllGoals(supabase, selectedStudentId),
    getActiveGoals(supabase, selectedStudentId, todayDate),
  ]);

  // 목표 진행률 계산
  const goalsWithProgress = await Promise.all(
    allGoals.map(async (goal) => {
      const progressRows = await import("@/lib/goals/queries").then((m) =>
        m.getGoalProgress(supabase, selectedStudentId, goal.id)
      );
      const progress = calculateGoalProgress(goal, progressRows, today);
      return {
        ...goal,
        progress,
      };
    })
  );

  // 목표 상태별 분류
  const upcomingGoals = goalsWithProgress.filter(
    (g) => g.progress.status === "scheduled"
  );
  const inProgressGoals = goalsWithProgress.filter(
    (g) => g.progress.status === "in_progress"
  );
  const completedGoals = goalsWithProgress.filter(
    (g) => g.progress.status === "completed"
  );
  const failedGoals = goalsWithProgress.filter(
    (g) => g.progress.status === "failed"
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className={cn("text-3xl font-semibold", textPrimary)}>목표 현황</h1>
          <p className={cn("text-sm", textMuted)}>
            자녀의 학습 목표 진행 상황을 확인하세요
          </p>
        </div>
        <Link
          href="/parent/dashboard"
          className={cn(
            "rounded-lg border px-4 py-2 text-sm font-medium transition",
            borderInput,
            textSecondary,
            bgHover
          )}
        >
          대시보드로 돌아가기
        </Link>
      </div>

      {/* 학생 선택 */}
      <div>
        <StudentSelector
          students={linkedStudents}
          selectedStudentId={selectedStudentId}
        />
      </div>

      {allGoals.length === 0 ? (
        <div className={cn(
          "rounded-xl border p-8 text-center",
          borderDefault,
          bgPage
        )}>
          <p className={cn("text-sm", textMuted)}>등록된 목표가 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 현재 목표 진행률 */}
          {activeGoals.length > 0 && (
            <div className={cn(
              "flex flex-col gap-4 rounded-xl border p-6 shadow-sm",
              borderDefault,
              bgSurface
            )}>
              <h2 className={cn("text-lg font-semibold", textPrimary)}>
                현재 목표 진행률
              </h2>
              <div className="flex flex-col gap-4">
                {inProgressGoals.map((goal) => (
                  <div key={goal.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={cn("text-base font-semibold", textPrimary)}>
                          {goal.title}
                        </span>
                        {goal.progress.daysRemaining !== null && (
                          <span className={cn("text-sm", textMuted)}>
                            {" "}(D-{goal.progress.daysRemaining})
                          </span>
                        )}
                      </div>
                      <span className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
                        {goal.progress.progressPercentage.toFixed(1)}%
                      </span>
                    </div>
                    {/* TODO: ProgressBar 컴포넌트로 교체 검토 필요 (서버 컴포넌트에서 클라이언트 컴포넌트 분리 필요) */}
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all"
                        style={{
                          width: `${goal.progress.progressPercentage}%`,
                        }}
                      />
                    </div>
                    <div className={cn("text-xs", textMuted)}>
                      {goal.start_date} ~ {goal.end_date}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 목표 달성률 트렌드 */}
          <div className={cn(
            "flex flex-col gap-4 rounded-xl border p-6 shadow-sm",
            borderDefault,
            bgSurface
          )}>
            <h2 className={cn("text-lg font-semibold", textPrimary)}>
              목표 달성률 요약
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-4">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  예정
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {upcomingGoals.length}
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 p-4">
                <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  진행중
                </div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {inProgressGoals.length}
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 p-4">
                <div className="text-sm font-medium text-green-700 dark:text-green-300">
                  완료
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {completedGoals.length}
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4">
                <div className="text-sm font-medium text-red-700 dark:text-red-300">
                  실패
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {failedGoals.length}
                </div>
              </div>
            </div>
          </div>

          {/* 취약 과목 목표 */}
          {inProgressGoals.filter((g) => g.goal_type === "weak_subject").length >
            0 && (
            <div className={cn(
              "flex flex-col gap-4 rounded-xl border p-6 shadow-sm",
              "border-orange-200 dark:border-orange-800",
              "bg-orange-50 dark:bg-orange-900/30"
            )}>
              <h2 className="text-lg font-semibold text-orange-900 dark:text-orange-200">
                취약 과목 목표
              </h2>
              <div className="flex flex-col gap-3">
                {inProgressGoals
                  .filter((g) => g.goal_type === "weak_subject")
                  .map((goal) => (
                    <div
                      key={goal.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border p-4",
                        "border-orange-200 dark:border-orange-800",
                        bgSurface
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-base font-semibold", textPrimary)}>
                          {goal.title}
                        </span>
                        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                          {goal.progress.progressPercentage.toFixed(1)}%
                        </span>
                      </div>
                      {/* TODO: ProgressBar 컴포넌트로 교체 검토 필요 (서버 컴포넌트에서 클라이언트 컴포넌트 분리 필요) */}
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 dark:bg-orange-600 transition-all"
                          style={{
                            width: `${goal.progress.progressPercentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

