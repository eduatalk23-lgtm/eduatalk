import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeekRange } from "@/lib/date/weekRange";
import {
  getWeeklyPlanSummary,
  getWeeklyStudyTimeSummary,
  getWeeklyGoalProgress,
} from "@/lib/reports/weekly";
import { getMonthlyReportData } from "@/lib/reports/monthly";
import { getActiveGoals, getGoalProgress } from "@/lib/goals/queries";
import { calculateGoalProgress } from "@/lib/goals/calc";
import { fetchAllScores } from "@/app/(student)/scores/dashboard/_utils";
import { calculateAllRiskIndices } from "@/app/(student)/analysis/_utils";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import { TodaySummary } from "./TodaySummary";
import { WeeklyMonthlySummary } from "./WeeklyMonthlySummary";
import { RecentScores } from "./RecentScores";
import { WeakSubjects } from "./WeakSubjects";
import { RiskSignals } from "./RiskSignals";
import { RecommendationSection } from "./RecommendationSection";
import {
  getRecentScores,
  getWeakSubjects,
  getRiskSignals,
} from "./_utils/calculations";
import { ProgressBar } from "@/components/atoms/ProgressBar";

type ParentDashboardContentProps = {
  studentId: string;
};

export async function ParentDashboardContent({
  studentId,
}: ParentDashboardContentProps) {
  const supabase = await createSupabaseServerClient();

  // 학생 정보 조회
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, class")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-700">학생 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  // 오늘 날짜 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);

  // 이번 주 범위 계산
  const { weekStart, weekEnd } = getWeekRange();
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // 데이터 병렬 조회
  const [
    todaySessions,
    weeklyPlanSummary,
    weeklyStudyTime,
    weeklyGoalProgress,
    monthlyReport,
    activeGoals,
    allScores,
    riskAnalyses,
  ] = await Promise.all([
    // 오늘 학습시간
    getSessionsByDateRange(supabase, studentId, todayDate, todayDate),
    // 주간 플랜 요약
    getWeeklyPlanSummary(supabase, studentId, weekStart, weekEnd),
    // 주간 학습시간
    getWeeklyStudyTimeSummary(supabase, studentId, weekStart, weekEnd),
    // 주간 목표 진행률
    getWeeklyGoalProgress(supabase, studentId, weekStart, weekEnd),
    // 월간 리포트
    getMonthlyReportData(supabase, studentId, today).catch(() => null),
    // 활성 목표
    getActiveGoals(supabase, studentId, todayDate),
    // 모든 성적
    fetchAllScores(supabase, studentId),
    // 위험 신호 분석
    calculateAllRiskIndices(supabase, studentId).catch(() => []),
  ]);

  // 오늘 학습시간 계산
  const todayMinutes = Math.floor(
    todaySessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60
  );

  // 오늘 플랜 개수 (주간 플랜 요약에서 오늘 날짜 추출)
  const todayPlanData = weeklyPlanSummary.byDay.find(
    (d) => d.date === todayDate
  );
  const todayPlanCount = todayPlanData?.totalPlans || 0;
  const todayCompletedPlans = todayPlanData?.completedPlans || 0;
  const todayExecutionRate =
    todayPlanCount > 0
      ? Math.round((todayCompletedPlans / todayPlanCount) * 100)
      : 0;

  // 목표 진행률 계산
  const goalsWithProgress = await Promise.all(
    activeGoals.slice(0, 3).map(async (goal) => {
      const progressRows = await getGoalProgress(supabase, studentId, goal.id);
      const progress = calculateGoalProgress(goal, progressRows, today);
      return {
        id: goal.id,
        title: goal.title,
        progressPercentage: progress.progressPercentage,
        daysRemaining: progress.daysRemaining,
      };
    })
  );

  // 최근 성적, 취약 과목, 위험 신호 계산 (유틸리티 함수로 분리하여 재사용성 및 가독성 향상)
  const recentScores = getRecentScores(allScores);
  const weakSubjects = getWeakSubjects(riskAnalyses);
  const riskSignals = getRiskSignals(riskAnalyses);

  return (
    <div className="space-y-6">
      {/* 오늘 학습 요약 */}
      <TodaySummary
        todayMinutes={todayMinutes}
        todayPlanCount={todayPlanCount}
        todayExecutionRate={todayExecutionRate}
      />

      {/* 이번주/이번달 핵심 지표 */}
      <WeeklyMonthlySummary
        weeklyPlanSummary={weeklyPlanSummary}
        weeklyStudyTime={weeklyStudyTime}
        weeklyGoalProgress={weeklyGoalProgress}
        monthlyReport={monthlyReport}
      />

      {/* 최근 성적 변화 */}
      {recentScores.length > 0 && (
        <RecentScores scores={recentScores} />
      )}

      {/* 취약 과목 경고 */}
      {weakSubjects.length > 0 && (
        <WeakSubjects subjects={weakSubjects} />
      )}

      {/* 위험 신호 카드 */}
      {riskSignals.length > 0 && (
        <RiskSignals signals={riskSignals} />
      )}

      {/* 학습 추천 섹션 */}
      <RecommendationSection studentId={studentId} />

      {/* 목표 진행률 */}
      {goalsWithProgress.length > 0 && (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">
            현재 목표 진행률
          </h3>
          <div className="flex flex-col gap-4">
            {goalsWithProgress.map((goal) => (
              <div key={goal.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {goal.title}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {goal.progressPercentage}%
                  </span>
                </div>
                <ProgressBar
                  value={goal.progressPercentage}
                  max={100}
                  color="indigo"
                  size="sm"
                />
                {goal.daysRemaining !== null && (
                  <p className="text-xs text-gray-500">
                    D-{goal.daysRemaining}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

