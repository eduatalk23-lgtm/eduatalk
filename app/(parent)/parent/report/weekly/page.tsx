export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../../_utils";
import { getWeekRange, formatWeekRangeKorean } from "@/lib/date/weekRange";
import {
  getWeeklyPlanSummary,
  getWeeklyStudyTimeSummary,
  getWeeklyGoalProgress,
  getWeeklyWeakSubjectTrend,
  getDailyBreakdown,
} from "@/lib/reports/weekly";
import { WeeklySummaryHeader } from "@/app/(student)/report/weekly/_components/WeeklySummaryHeader";
import { WeeklyChartsSection } from "@/app/(student)/report/weekly/_components/WeeklyChartsSection";
import { GoalProgressSection } from "@/app/(student)/report/weekly/_components/GoalProgressSection";
import { WeakSubjectsSection } from "@/app/(student)/report/weekly/_components/WeakSubjectsSection";
import { DailyBreakdownSection } from "@/app/(student)/report/weekly/_components/DailyBreakdownSection";
import { ParentWeeklyCoachingSection } from "./_components/ParentWeeklyCoachingSection";
import { getWeeklyCoaching } from "@/app/(student)/report/weekly/coachingAction";
import { StudentSelector } from "../../_components/StudentSelector";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { getContainerClass } from "@/lib/constants/layout";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ParentWeeklyReportPage({ searchParams }: PageProps) {
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
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-yellow-900">
            연결된 자녀가 없습니다
          </h2>
          <p className="text-sm text-yellow-700">
            관리자에게 자녀 연결을 요청해주세요.
          </p>
        </div>
      </section>
    );
  }

  // 선택된 학생 ID
  const selectedStudentId =
    params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    redirect("/parent/report/weekly");
  }

  // 접근 권한 확인
  const hasAccess = await canAccessStudent(
    supabase,
    userId,
    selectedStudentId
  );

  if (!hasAccess) {
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900">
            접근 권한이 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 이번 주 범위 계산
  const { weekStart, weekEnd } = getWeekRange();
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // 지난 주 범위 (비교용)
  const lastWeek = getWeekRange(new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
  const lastWeekStartStr = lastWeek.weekStart.toISOString().slice(0, 10);
  const lastWeekEndStr = lastWeek.weekEnd.toISOString().slice(0, 10);

  try {
    // 데이터 병렬 조회
    const [
      planSummary,
      studyTimeSummary,
      goalProgress,
      weakSubjects,
      dailyBreakdown,
      lastWeekPlanSummary,
      lastWeekStudyTimeSummary,
      coachingResult,
    ] = await Promise.all([
      getWeeklyPlanSummary(supabase, selectedStudentId, weekStart, weekEnd),
      getWeeklyStudyTimeSummary(supabase, selectedStudentId, weekStart, weekEnd),
      getWeeklyGoalProgress(supabase, selectedStudentId, weekStart, weekEnd),
      getWeeklyWeakSubjectTrend(supabase, selectedStudentId, weekStart, weekEnd),
      getDailyBreakdown(supabase, selectedStudentId, weekStart, weekEnd),
      getWeeklyPlanSummary(supabase, selectedStudentId, lastWeek.weekStart, lastWeek.weekEnd),
      getWeeklyStudyTimeSummary(supabase, selectedStudentId, lastWeek.weekStart, lastWeek.weekEnd),
      getWeeklyCoaching(selectedStudentId),
    ]);

    // 지난주 대비 변화 계산
    const studyTimeChange = studyTimeSummary.totalMinutes - lastWeekStudyTimeSummary.totalMinutes;
    const planCompletionChange =
      planSummary.completionRate - lastWeekPlanSummary.completionRate;
    const goalProgressChange =
      goalProgress.averageProgress - (lastWeekPlanSummary.completionRate || 0);

    const hasData =
      studyTimeSummary.totalMinutes > 0 ||
      planSummary.totalPlans > 0 ||
      goalProgress.totalGoals > 0;

    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-semibold text-gray-900">주간 학습 리포트</h1>
              <p className="text-sm text-gray-500">
                {formatWeekRangeKorean(weekStart, weekEnd)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/parent/dashboard"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                대시보드로 돌아가기
              </Link>
            </div>
          </div>

          {/* 학생 선택 */}
          <div>
            <StudentSelector
              students={linkedStudents}
              selectedStudentId={selectedStudentId}
            />
          </div>

          {hasData && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              자녀의 주간 학습 리포트입니다. 상담이나 공유용으로 활용해 보세요.
            </div>
          )}

          {!hasData ? (
            <EmptyState
              title="이번 주 아직 학습 기록이 없습니다"
              description="학습을 시작하면 주간 리포트가 자동으로 생성됩니다."
              actionLabel="대시보드로 돌아가기"
              actionHref="/parent/dashboard"
              icon="📊"
            />
          ) : (
            <div className="flex flex-col gap-8">
            {/* 요약 헤더 */}
            <WeeklySummaryHeader
              totalStudyTimeMinutes={studyTimeSummary.totalMinutes}
              planCompletionRate={planSummary.completionRate}
              goalProgressRate={goalProgress.averageProgress}
              studyTimeChange={studyTimeChange}
              planCompletionChange={planCompletionChange}
              goalProgressChange={goalProgressChange}
            />

            {/* 코칭 섹션 */}
            {coachingResult.success && coachingResult.data && (
              <ParentWeeklyCoachingSection coaching={coachingResult.data} />
            )}

            {/* 그래프 섹션 */}
            <div>
              <WeeklyChartsSection
                studyTimeByDay={studyTimeSummary.byDay}
                studyTimeBySubject={studyTimeSummary.bySubject}
                planCompletionByDay={planSummary.byDay}
              />
            </div>

            {/* 목표 진행률 */}
            {goalProgress.goals.length > 0 && (
              <div>
                <GoalProgressSection goals={goalProgress.goals} />
              </div>
            )}

            {/* 취약과목 */}
            {weakSubjects.subjects.length > 0 && (
              <div>
                <WeakSubjectsSection subjects={weakSubjects.subjects} />
              </div>
            )}

            {/* 일별 상세 분석 */}
            <div>
              <DailyBreakdownSection breakdown={dailyBreakdown} />
            </div>
            </div>
          )}
        </div>
      </section>
    );
  } catch (error) {
    console.error("[parent/report/weekly] 페이지 로드 실패", error);
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">오류가 발생했습니다</h2>
          <p className="text-sm text-red-700">
            데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </p>
          <Link
            href="/parent/report/weekly"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            새로고침
          </Link>
        </div>
      </section>
    );
  }
}

