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
import { getContainerClass } from "@/lib/constants/layout";

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
      <section className={getContainerClass("DASHBOARD", "lg")}>
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
              href="/dashboard"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              대시보드로 돌아가기
            </Link>
          </div>
        </div>

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
          </>
        )}
      </section>
    );
  } catch (error) {
    console.error("[report/weekly] 페이지 로드 실패", error);
    return (
      <section className={getContainerClass("DASHBOARD", "lg")}>
        <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">오류가 발생했습니다</h2>
          <p className="text-sm text-red-700">
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

