export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../_utils";
import { getAllGoals, getActiveGoals } from "@/lib/goals/queries";
import { calculateGoalProgress } from "@/lib/goals/calc";
import { StudentSelector } from "../_components/StudentSelector";
import Link from "next/link";

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
          <h1 className="text-3xl font-semibold text-gray-900">목표 현황</h1>
          <p className="text-sm text-gray-500">
            자녀의 학습 목표 진행 상황을 확인하세요
          </p>
        </div>
        <Link
          href="/parent/dashboard"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">등록된 목표가 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 현재 목표 진행률 */}
          {activeGoals.length > 0 && (
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                현재 목표 진행률
              </h2>
              <div className="flex flex-col gap-4">
                {inProgressGoals.map((goal) => (
                  <div key={goal.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-base font-semibold text-gray-900">
                          {goal.title}
                        </span>
                        {goal.progress.daysRemaining !== null && (
                          <span className="text-sm text-gray-500">
                            {" "}(D-{goal.progress.daysRemaining})
                          </span>
                        )}
                      </div>
                      <span className="text-base font-semibold text-indigo-600">
                        {goal.progress.progressPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all"
                        style={{
                          width: `${goal.progress.progressPercentage}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {goal.start_date} ~ {goal.end_date}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 목표 달성률 트렌드 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              목표 달성률 요약
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-medium text-blue-700 mb-1">
                  예정
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {upcomingGoals.length}
                </div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <div className="text-sm font-medium text-indigo-700 mb-1">
                  진행중
                </div>
                <div className="text-2xl font-bold text-indigo-600">
                  {inProgressGoals.length}
                </div>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="text-sm font-medium text-green-700 mb-1">
                  완료
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {completedGoals.length}
                </div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-medium text-red-700 mb-1">
                  실패
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {failedGoals.length}
                </div>
              </div>
            </div>
          </div>

          {/* 취약 과목 목표 */}
          {inProgressGoals.filter((g) => g.goal_type === "weak_subject").length >
            0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-orange-900 mb-4">
                취약 과목 목표
              </h2>
              <div className="space-y-3">
                {inProgressGoals
                  .filter((g) => g.goal_type === "weak_subject")
                  .map((goal) => (
                    <div
                      key={goal.id}
                      className="flex flex-col gap-2 rounded-lg border border-orange-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-gray-900">
                          {goal.title}
                        </span>
                        <span className="text-sm font-semibold text-orange-600">
                          {goal.progress.progressPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 transition-all"
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

