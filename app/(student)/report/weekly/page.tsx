import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeekRange, formatWeekRangeKorean } from "@/lib/date/weekRange";
import {
  getWeeklyPlanSummary,
  getWeeklyStudyTimeSummary,
  getWeeklyGoalProgress,
  getWeeklyWeakSubjectTrend,
  getDailyBreakdown,
} from "@/lib/reports/weekly";
import { WeeklySummaryHeader } from "./_components/WeeklySummaryHeader";
import { WeeklyChartsSection } from "./_components/WeeklyChartsSection";
import { GoalProgressSection } from "./_components/GoalProgressSection";
import { WeakSubjectsSection } from "./_components/WeakSubjectsSection";
import { DailyBreakdownSection } from "./_components/DailyBreakdownSection";
import { WeeklyCoachingSection } from "./_components/WeeklyCoachingSection";
import { getWeeklyCoaching } from "@/app/(student)/report/weekly/coachingAction";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function WeeklyReportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
      getWeeklyPlanSummary(supabase, user.id, weekStart, weekEnd),
      getWeeklyStudyTimeSummary(supabase, user.id, weekStart, weekEnd),
      getWeeklyGoalProgress(supabase, user.id, weekStart, weekEnd),
      getWeeklyWeakSubjectTrend(supabase, user.id, weekStart, weekEnd),
      getDailyBreakdown(supabase, user.id, weekStart, weekEnd),
      getWeeklyPlanSummary(supabase, user.id, lastWeek.weekStart, lastWeek.weekEnd),
      getWeeklyStudyTimeSummary(supabase, user.id, lastWeek.weekStart, lastWeek.weekEnd),
      getWeeklyCoaching(user.id),
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
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">주간 학습 리포트</h1>
            <p className="mt-1 text-sm text-gray-500">
              {formatWeekRangeKorean(weekStart, weekEnd)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/report/weekly/pdf?week=${weekStart.toISOString().slice(0, 10)}`}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              PDF로 저장하기
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              대시보드로 돌아가기
            </Link>
          </div>
        </div>
        {hasData && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            학부모 상담용으로 다운로드할 수 있는 리포트입니다.
          </div>
        )}

        {!hasData ? (
          <EmptyState
            title="이번 주 아직 학습 기록이 없습니다"
            description="학습을 시작하면 주간 리포트가 자동으로 생성됩니다."
            actionLabel="오늘부터 학습 시작하기"
            actionHref="/today"
            icon="📊"
          />
        ) : (
          <>
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
              <WeeklyCoachingSection coaching={coachingResult.data} />
            )}

            {/* 그래프 섹션 */}
            <div className="mb-8">
              <WeeklyChartsSection
                studyTimeByDay={studyTimeSummary.byDay}
                studyTimeBySubject={studyTimeSummary.bySubject}
                planCompletionByDay={planSummary.byDay}
              />
            </div>

            {/* 목표 진행률 */}
            {goalProgress.goals.length > 0 && (
              <div className="mb-8">
                <GoalProgressSection goals={goalProgress.goals} />
              </div>
            )}

            {/* 취약과목 */}
            {weakSubjects.subjects.length > 0 && (
              <div className="mb-8">
                <WeakSubjectsSection subjects={weakSubjects.subjects} />
              </div>
            )}

            {/* 일별 상세 분석 */}
            <div className="mb-8">
              <DailyBreakdownSection breakdown={dailyBreakdown} />
            </div>
          </>
        )}
      </section>
    );
  } catch (error) {
    console.error("[report/weekly] 페이지 로드 실패", error);
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-sm text-red-700 mb-4">
            데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </p>
          <Link
            href="/report/weekly"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            새로고침
          </Link>
        </div>
      </section>
    );
  }
}

