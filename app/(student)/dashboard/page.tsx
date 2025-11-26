export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTodayPlans,
  calculateTodayProgress,
  fetchLearningStatistics,
  fetchWeeklyBlockCounts,
  fetchContentTypeProgress,
  fetchActivePlan,
  type TodayPlan,
  type LearningStatistics,
  type WeeklyBlockCount,
  type ContentTypeProgress,
  type ActivePlan,
} from "./_utils";
import {
  getWeeklyStudyTimeSummary,
  getWeeklyPlanSummary,
  getWeeklyGoalProgress,
} from "@/lib/reports/weekly";
import type {
  WeeklyPlanSummary,
  WeeklyStudyTimeSummary,
  WeeklyGoalProgress,
} from "@/lib/reports/weekly";
import { getMonthlyReportData } from "@/lib/reports/monthly";
import { RecommendationCard } from "./_components/RecommendationCard";
import { ActiveLearningWidget } from "./_components/ActiveLearningWidget";
import { TimeStatistics } from "./_components/TimeStatistics";
import { getSessionsInRange } from "@/lib/data/studentSessions";
import {
  calculatePlanStudySeconds,
  buildActiveSessionMap,
} from "@/lib/metrics/studyTime";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

type StudentRow = {
  id: string;
  name?: string | null;
};

const contentTypeLabels: Record<string, string> = {
  book: "책",
  lecture: "강의",
  custom: "커스텀",
};

const difficultyLabels: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

const DEFAULT_LEARNING_STATISTICS: LearningStatistics = {
  weekProgress: 0,
  completedCount: 0,
  inProgressCount: 0,
  totalLearningAmount: 0,
};

const EMPTY_WEEKLY_BLOCKS: WeeklyBlockCount[] = [
  { dayOfWeek: 0, dayLabel: "일", blockCount: 0 },
  { dayOfWeek: 1, dayLabel: "월", blockCount: 0 },
  { dayOfWeek: 2, dayLabel: "화", blockCount: 0 },
  { dayOfWeek: 3, dayLabel: "수", blockCount: 0 },
  { dayOfWeek: 4, dayLabel: "목", blockCount: 0 },
  { dayOfWeek: 5, dayLabel: "금", blockCount: 0 },
  { dayOfWeek: 6, dayLabel: "토", blockCount: 0 },
];

const DEFAULT_CONTENT_TYPE_PROGRESS: ContentTypeProgress = {
  book: 0,
  lecture: 0,
  custom: 0,
};

const DEFAULT_WEEKLY_STUDY_TIME: WeeklyStudyTimeSummary = {
  totalSeconds: 0,
  totalMinutes: 0,
  totalHours: 0,
  byDay: [],
  bySubject: [],
  byContentType: [],
};

const DEFAULT_WEEKLY_PLAN_SUMMARY: WeeklyPlanSummary = {
  totalPlans: 0,
  completedPlans: 0,
  completionRate: 0,
  byDay: [],
  byBlock: [],
};

const DEFAULT_WEEKLY_GOAL_PROGRESS: WeeklyGoalProgress = {
  totalGoals: 0,
  activeGoals: 0,
  completedGoals: 0,
  averageProgress: 0,
  goals: [],
};

type TodayPlanSummary = {
  todayProgress: number;
  completedPlans: number;
  incompletePlans: number;
  timeStats: {
    totalStudySeconds: number;
    pausedSeconds: number;
    completedCount: number;
    pureStudySeconds: number;
    averagePlanMinutes: number;
  };
};

async function summarizeTodayPlans(
  plans: TodayPlan[],
  studentId: string,
  todayDate: string
): Promise<TodayPlanSummary> {
  const todayProgress = calculateTodayProgress(plans);
  const completedPlans = plans.filter(
    (plan) => plan.progress !== null && plan.progress >= 100
  ).length;
  const incompletePlans = plans.length - completedPlans;

  // 세션 조회 (활성 세션 확인을 위해)
  const tenantContext = await getTenantContext();
  const today = new Date(todayDate + "T00:00:00");
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  
  const sessions = await getSessionsInRange({
    studentId,
    tenantId: tenantContext?.tenantId || null,
    dateRange: {
      start: today.toISOString(),
      end: todayEnd.toISOString(),
    },
  });

  const activeSessionMap = buildActiveSessionMap(sessions);
  const nowMs = Date.now();

  // Today 페이지와 동일한 로직으로 학습 시간 계산
  const timeStats = plans.reduce(
    (acc, plan) => {
      // actual_start_time이 있는 플랜만 계산 (Today 페이지와 동일)
      if (plan.actual_start_time) {
        const studySeconds = calculatePlanStudySeconds(
          plan,
          nowMs,
          plan.actual_end_time ? undefined : activeSessionMap.get(plan.id)
        );
        
        // total_duration_seconds는 표시용으로만 사용
        const totalDuration = plan.total_duration_seconds || 0;
        const pausedDuration = plan.paused_duration_seconds || 0;
        
        acc.totalStudySeconds += totalDuration;
        acc.pausedSeconds += pausedDuration;
        acc.pureStudySeconds += studySeconds; // 실제 계산된 순수 학습 시간
        acc.completedCount++;
      }
      return acc;
    },
    { totalStudySeconds: 0, pausedSeconds: 0, pureStudySeconds: 0, completedCount: 0 }
  );

  const averagePlanMinutes =
    timeStats.completedCount > 0
      ? Math.round(timeStats.pureStudySeconds / timeStats.completedCount / 60)
      : 0;

  return {
    todayProgress,
    completedPlans,
    incompletePlans,
    timeStats: {
      totalStudySeconds: timeStats.totalStudySeconds,
      pausedSeconds: timeStats.pausedSeconds,
      completedCount: timeStats.completedCount,
      pureStudySeconds: timeStats.pureStudySeconds,
      averagePlanMinutes,
    },
  };
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  // 현재 로그인 사용자 가져오기
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인 안되어 있으면 로그인 페이지로 이동
  if (!user) redirect("/login");

  // 학생 정보 불러오기
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,name")
    .eq("id", user.id)
    .maybeSingle<StudentRow>();

  if (studentError) {
    console.error("[dashboard] 학생 정보 조회 실패", studentError);
    // 에러가 발생해도 페이지는 표시되도록 함
  }

  // 오늘 날짜 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);
  const dayOfWeek = today.getDay();

  // 이번 주 범위 계산
  const weekStart = new Date(today);
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(today.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // 이번 달 범위 계산
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  // 오늘 플랜 및 통계 조회 (개별 실패 처리)
  const [
    todayPlansResult,
    statisticsResult,
    weeklyBlocksResult,
    contentTypeProgressResult,
    weeklyStudyTimeResult,
    weeklyPlanSummaryResult,
    weeklyGoalProgressResult,
    monthlyReportResult,
    activePlanResult,
  ] = await Promise.allSettled([
    fetchTodayPlans(supabase, user.id, todayDate, dayOfWeek),
    fetchLearningStatistics(supabase, user.id),
    fetchWeeklyBlockCounts(supabase, user.id),
    fetchContentTypeProgress(supabase, user.id),
    getWeeklyStudyTimeSummary(supabase, user.id, weekStart, weekEnd),
    getWeeklyPlanSummary(supabase, user.id, weekStart, weekEnd),
    getWeeklyGoalProgress(supabase, user.id, weekStart, weekEnd),
    getMonthlyReportData(supabase, user.id, today),
    fetchActivePlan(supabase, user.id, todayDate),
  ]);

  // 결과 추출 및 기본값 설정
  const todayPlans =
    todayPlansResult.status === "fulfilled" ? todayPlansResult.value : [];
  const statistics =
    statisticsResult.status === "fulfilled"
      ? statisticsResult.value
      : DEFAULT_LEARNING_STATISTICS;
  const weeklyBlocks =
    weeklyBlocksResult.status === "fulfilled"
      ? weeklyBlocksResult.value
      : EMPTY_WEEKLY_BLOCKS;
  const contentTypeProgress =
    contentTypeProgressResult.status === "fulfilled"
      ? contentTypeProgressResult.value
      : DEFAULT_CONTENT_TYPE_PROGRESS;
  const weeklyStudyTime =
    weeklyStudyTimeResult.status === "fulfilled"
      ? weeklyStudyTimeResult.value
      : DEFAULT_WEEKLY_STUDY_TIME;
  const weeklyPlanSummary =
    weeklyPlanSummaryResult.status === "fulfilled"
      ? weeklyPlanSummaryResult.value
      : DEFAULT_WEEKLY_PLAN_SUMMARY;
  const weeklyGoalProgress =
    weeklyGoalProgressResult.status === "fulfilled"
      ? weeklyGoalProgressResult.value
      : DEFAULT_WEEKLY_GOAL_PROGRESS;
  const monthlyReport =
    monthlyReportResult.status === "fulfilled"
      ? monthlyReportResult.value
      : null;
  const activePlan =
    activePlanResult.status === "fulfilled" ? activePlanResult.value : null;

  const {
    todayProgress,
    completedPlans,
    incompletePlans,
    timeStats: todayTimeStats,
  } = await summarizeTodayPlans(todayPlans, user.id, todayDate);

  const studentName = student?.name ?? "학생";

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-8">
          {/* 상단: 학생 인사 + 요약 */}
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold text-gray-900">
                  안녕하세요, {studentName}님
                </h1>
                <p className="text-sm text-gray-600">
                  오늘도 열심히 학습하시는 모습이 멋집니다!
                </p>

                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-indigo-600">
                    {todayProgress}%
                  </span>
                  <span className="text-lg text-gray-600">
                    오늘 학습 진행률
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 실시간 학습 중 위젯 */}
          {activePlan && <ActiveLearningWidget activePlan={activePlan} />}

          {/* 오늘 학습 계획 요약 */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">
                    전체 계획
                  </h3>
                  <span className="text-2xl">📋</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {todayPlans.length}개
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-green-700">완료</h3>
                  <span className="text-2xl">✅</span>
                </div>
                <div className="text-3xl font-bold text-green-700">
                  {completedPlans}개
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-orange-700">
                    미완료
                  </h3>
                  <span className="text-2xl">⏳</span>
                </div>
                <div className="text-3xl font-bold text-orange-700">
                  {incompletePlans}개
                </div>
              </div>
            </div>
          </div>

          {/* 오늘의 시간 통계 */}
          {todayTimeStats.completedCount > 0 && (
            <TimeStatistics
              totalStudySeconds={todayTimeStats.totalStudySeconds}
              pureStudySeconds={todayTimeStats.pureStudySeconds}
              pausedSeconds={todayTimeStats.pausedSeconds}
              averagePlanMinutes={todayTimeStats.averagePlanMinutes}
            />
          )}

          {/* 오늘 일정 카드 리스트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              오늘의 학습 일정
            </h2>

            {todayPlans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                <p className="text-sm text-gray-500">
                  오늘 학습 일정이 없습니다.
                </p>
              </div>
            ) : (
              <ul className="grid gap-4">
                {todayPlans.map((plan) => (
                  <TodayPlanCard key={plan.id} plan={plan} />
                ))}
              </ul>
            )}
          </div>

          {/* 학습 추천 */}
          <RecommendationCard />

          {/* 이번 주 요일별 계획 블록 카운트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              이번 주 학습 계획
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-7 gap-3">
                {weeklyBlocks.map((day) => {
                  const isToday = day.dayOfWeek === dayOfWeek;
                  return (
                    <div
                      key={day.dayOfWeek}
                      className={`text-center rounded-lg p-3 ${
                        isToday
                          ? "bg-indigo-50 border-2 border-indigo-300"
                          : "bg-gray-50 border border-gray-200"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div
                          className={`text-sm font-medium ${
                            isToday ? "text-indigo-700" : "text-gray-600"
                          }`}
                        >
                          {day.dayLabel}
                        </div>
                        <div
                          className={`text-2xl font-bold ${
                            isToday ? "text-indigo-600" : "text-gray-900"
                          }`}
                        >
                          {day.blockCount}
                        </div>
                        <div className="text-xs text-gray-500">블록</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 콘텐츠별 누적 진행률 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              콘텐츠별 진행률
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      📚 책
                    </h3>
                  </div>
                  <div className="text-4xl font-bold text-indigo-600">
                    {contentTypeProgress.book}%
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all"
                      style={{ width: `${contentTypeProgress.book}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      🎧 강의
                    </h3>
                  </div>
                  <div className="text-4xl font-bold text-purple-600">
                    {contentTypeProgress.lecture}%
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 transition-all"
                      style={{ width: `${contentTypeProgress.lecture}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      📝 커스텀
                    </h3>
                  </div>
                  <div className="text-4xl font-bold text-emerald-600">
                    {contentTypeProgress.custom}%
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all"
                      style={{ width: `${contentTypeProgress.custom}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 주간 요약 하이라이트 */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                이번 주 요약
              </h2>
              <div className="flex items-center gap-3">
                <Link
                  href="/report/weekly"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  상세 리포트 보기 →
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-sm font-medium text-gray-600">
                    총 학습시간
                  </div>
                  <div className="text-2xl font-bold text-indigo-600">
                    {weeklyStudyTime.totalHours}시간{" "}
                    {weeklyStudyTime.totalMinutes % 60}분
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-sm font-medium text-gray-600">
                    플랜 실행률
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {weeklyPlanSummary.completionRate}%
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-sm font-medium text-gray-600">
                    목표 달성률
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {weeklyGoalProgress.averageProgress}%
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-center">
                  <div className="text-sm font-medium text-gray-600">
                    이번주 집중 과목
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {weeklyStudyTime.bySubject.length > 0
                      ? weeklyStudyTime.bySubject
                          .slice(0, 3)
                          .map((s) => s.subject)
                          .join(", ")
                      : "없음"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 월간 요약 하이라이트 */}
          {monthlyReport && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900">
                  이번 달 요약
                </h2>
                <div className="flex items-center gap-3">
                  <Link
                    href="/report/monthly"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    상세 리포트 보기 →
                  </Link>
                </div>
              </div>
              <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="flex flex-col gap-1 text-center">
                    <div className="text-sm font-medium text-gray-600">
                      총 학습시간
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.floor(monthlyReport.totals.studyMinutes / 60)}시간{" "}
                      {monthlyReport.totals.studyMinutes % 60}분
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-center">
                    <div className="text-sm font-medium text-gray-600">
                      플랜 실행률
                    </div>
                    <div className="text-2xl font-bold text-indigo-600">
                      {monthlyReport.totals.completionRate}%
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-center">
                    <div className="text-sm font-medium text-gray-600">
                      목표 달성률
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {monthlyReport.totals.goalRate}%
                    </div>
                  </div>
                  <div className="text-center">
                    <Link
                      href="/report/monthly"
                      className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      월간 리포트 보기
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 학습 통계 요약 카드 3개 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-gray-900">학습 통계</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatisticsCard
                title="이번 주 학습 완성도"
                value={`${statistics.weekProgress}%`}
                description="월요일부터 오늘까지의 평균 진행률"
                icon="📊"
              />
              <StatisticsCard
                title="진행 중 콘텐츠"
                value={`${statistics.inProgressCount}개`}
                description="현재 학습 중인 콘텐츠 수"
                icon="📚"
              />
              <StatisticsCard
                title="완료된 콘텐츠"
                value={`${statistics.completedCount}개`}
                description="학습을 완료한 콘텐츠 수"
                icon="🎯"
              />
            </div>
          </div>

          {/* 주요 기능 바로가기 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-gray-900">주요 기능</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <QuickActionCard
                href="/plan"
                title="오늘의 플랜 보기"
                description="오늘의 학습 계획을 확인하세요"
                icon="📅"
                color="indigo"
              />
              <QuickActionCard
                href="/plan/new-group"
                title="플랜 생성하기"
                description="새로운 학습 계획을 만들어보세요"
                icon="➕"
                color="blue"
              />
              <QuickActionCard
                href="/blocks"
                title="시간블록 설정"
                description="학습 가능한 시간대를 설정하세요"
                icon="⏰"
                color="orange"
              />
              <QuickActionCard
                href="/contents"
                title="콘텐츠 등록하기"
                description="책, 강의, 커스텀 콘텐츠를 등록하세요"
                icon="📚"
                color="green"
              />
              <QuickActionCard
                href="/scores/dashboard"
                title="성적 관리"
                description="내신 및 모의고사 성적을 조회하고 관리하세요"
                icon="📝"
                color="red"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function TodayPlanCard({ plan }: { plan: TodayPlan }) {
  const contentTypeLabel = contentTypeLabels[plan.content_type] ?? "콘텐츠";
  const difficultyLabel = plan.difficulty_level
    ? difficultyLabels[plan.difficulty_level] ?? plan.difficulty_level
    : null;

  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-gray-500">
              블록 #{plan.block_index}
              {plan.start_time && plan.end_time
                ? ` · ${plan.start_time} ~ ${plan.end_time}`
                : ""}
            </p>
            <h3 className="text-lg font-semibold text-gray-900">
              {plan.title}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            {plan.subject && (
              <span className="text-gray-500">{plan.subject}</span>
            )}
            {difficultyLabel && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500">{difficultyLabel}</span>
              </>
            )}
          </div>
          {(plan.planned_start_page_or_time !== null ||
            plan.planned_end_page_or_time !== null) && (
            <p className="text-sm text-gray-500">
              범위:{" "}
              {plan.planned_start_page_or_time !== null &&
              plan.planned_end_page_or_time !== null
                ? `${plan.planned_start_page_or_time} → ${plan.planned_end_page_or_time}`
                : plan.planned_start_page_or_time !== null
                ? `${plan.planned_start_page_or_time}부터`
                : plan.planned_end_page_or_time !== null
                ? `${plan.planned_end_page_or_time}까지`
                : "미지정"}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {contentTypeLabel}
          </span>
          {plan.progress !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                진행률 {plan.progress}%
              </span>
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${plan.progress}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-400">진행률 없음</span>
          )}
        </div>
      </div>
    </li>
  );
}

function StatisticsCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="text-3xl font-bold text-indigo-600">{value}</div>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function formatLearningAmount(amount: number): string {
  if (amount === 0) return "0";
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`;
  }
  return amount.toString();
}

function QuickActionCard({
  href,
  title,
  description,
  icon,
  color,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
  color: "indigo" | "blue" | "purple" | "orange" | "green" | "red";
}) {
  const colorClasses = {
    indigo:
      "border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900",
    blue: "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900",
    purple:
      "border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900",
    orange:
      "border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-900",
    green: "border-green-200 bg-green-50 hover:bg-green-100 text-green-900",
    red: "border-red-200 bg-red-50 hover:bg-red-100 text-red-900",
  };

  return (
    <Link
      href={href}
      className={`rounded-xl border-2 p-6 transition-all hover:shadow-md ${colorClasses[color]}`}
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl">{icon}</span>
        <div className="flex flex-col gap-1 flex-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm opacity-80">{description}</p>
        </div>
        <span className="text-xl">→</span>
      </div>
    </Link>
  );
}
