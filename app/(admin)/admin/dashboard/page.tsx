
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getBatchAtRiskStudents } from "@/lib/risk/batch";
import {
  getCachedAtRiskStudents,
  getCachedConsultingNotes,
} from "@/lib/cache/dashboard";
import { getCampStatisticsForTenant } from "@/lib/data/campTemplates";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/molecules/StatCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { getWeekRange } from "@/lib/date/weekRange";
import { riskLevelColors, textPrimary, textSecondary, textMuted, bgSurface, borderDefault } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";
import { getFileRequestKpiAction } from "@/lib/domains/drive/actions/workflow";
import { Clock, FileUp, AlertTriangle, ArrowRight } from "lucide-react";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/dashboard";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// ============================================
// 대시보드 통계: 1개 RPC로 ~15개 쿼리 대체
// ============================================

interface DashboardStats {
  total_students: number;
  active_this_week: number;
  with_scores: number;
  with_plans: number;
  top_study_time: Array<{ studentId: string; name: string; minutes: number }>;
  top_plan_completion: Array<{ studentId: string; name: string; completionRate: number }>;
  top_goal_achievement: Array<{ studentId: string; name: string; count: number }>;
}

async function getDashboardStatisticsRpc(
  supabase: SupabaseServerClient,
  weekStart: Date,
  weekEnd: Date
): Promise<DashboardStats> {
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("get_dashboard_statistics", {
    p_week_start: weekStartStr,
    p_week_end: weekEndStr,
  });

  if (error) {
    console.error("[admin/dashboard] RPC 실패, fallback 사용:", error.message);
    return {
      total_students: 0,
      active_this_week: 0,
      with_scores: 0,
      with_plans: 0,
      top_study_time: [],
      top_plan_completion: [],
      top_goal_achievement: [],
    };
  }

  return data as DashboardStats;
}

async function getCachedDashboardStats(
  supabase: SupabaseServerClient,
  weekStart: Date,
  weekEnd: Date
) {
  return unstable_cache(
    async () => getDashboardStatisticsRpc(supabase, weekStart, weekEnd),
    [`dashboard-rpc-stats-${weekStart.toISOString()}-${weekEnd.toISOString()}`],
    { tags: [CACHE_TAGS.DASHBOARD_STATS], revalidate: 60 }
  )();
}

// 위험 학생 조회 (배치 방식 — ~9 쿼리로 전체 학생 처리)
async function getAtRiskStudents(supabase: SupabaseServerClient) {
  try {
    // name, is_active는 user_profiles에서 조회
    const { data: students, error } = await supabase
      .from("user_profiles")
      .select("id, name")
      .eq("role", "student")
      .eq("is_active", true);

    if (error) {
      throw error;
    }

    const studentRows = (students as Array<{ id: string; name?: string | null }> | null) ?? [];
    if (studentRows.length === 0) return [];

    return buildBatchRiskResults(supabase, studentRows);
  } catch (error) {
    console.error("[admin/dashboard] 위험 학생 조회 실패", error);
    return [];
  }
}

async function buildBatchRiskResults(
  supabase: SupabaseServerClient,
  studentRows: Array<{ id: string; name?: string | null }>
) {
  const studentIds = studentRows.map((s) => s.id);
  const nameMap = new Map(studentRows.map((s) => [s.id, s.name ?? "이름 없음"]));

  const riskResults = await getBatchAtRiskStudents(supabase, studentIds);

  return riskResults
    .map((r) => ({
      studentId: r.studentId,
      name: nameMap.get(r.studentId) ?? "이름 없음",
      riskScore: r.riskScore,
      level: r.level,
      reasons: r.reasons,
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
}

// 최근 상담노트 조회 (FK join으로 1회 쿼리)
async function getRecentConsultingNotes(supabase: SupabaseServerClient) {
  try {
    const { data: notes, error } = await supabase
      .from("student_consulting_notes")
      .select("id, student_id, note, created_at, students(user_profiles(name))")
      .order("created_at", { ascending: false })
      .limit(5);

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      return [];
    }

    if (error) throw error;

    return (notes ?? []).map((n) => {
      // FK join: students → user_profiles nested join
      const studentRaw = n.students as unknown;
      const sObj = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
      const sUp = (sObj as Record<string, unknown> | null)?.user_profiles;
      const sUpObj = Array.isArray(sUp) ? sUp[0] : sUp;
      const studentName = (sUpObj as Record<string, unknown> | null)?.name as string | null;
      return {
        id: n.id,
        studentId: n.student_id ?? "",
        studentName: studentName ?? "이름 없음",
        note: n.note ?? "",
        createdAt: n.created_at ?? "",
      };
    });
  } catch (error) {
    console.error("[admin/dashboard] 최근 상담노트 조회 실패", error);
    return [];
  }
}

// ============================================
// 섹션 헬퍼 컴포넌트
// ============================================

function SectionHeader({
  id,
  title,
  viewAllHref,
}: {
  id: string;
  title: string;
  viewAllHref?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 id={id} className={cn("text-lg md:text-xl font-semibold", textPrimary)}>
        {title}
      </h2>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          전체 보기
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function RankRow({
  href,
  rank,
  rankColor,
  name,
  rightLabel,
  rightStrong,
}: {
  href: string;
  rank: number;
  rankColor: "indigo" | "green";
  name: string;
  rightLabel: string;
  rightStrong?: boolean;
}) {
  const rankClass =
    rankColor === "green"
      ? "bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300"
      : "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300";
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-lg border p-3 transition hover:shadow-sm",
        bgSurface,
        borderDefault,
        "hover:bg-bg-secondary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
            rankClass
          )}
        >
          {rank}
        </span>
        <span className={cn("font-medium", textPrimary)}>{name}</span>
      </div>
      <span
        className={cn(
          rightStrong ? "text-sm font-semibold" : "text-sm",
          rightStrong ? textPrimary : textSecondary
        )}
      >
        {rightLabel}
      </span>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const { weekStart, weekEnd } = getWeekRange();
  const tenantContext = await getTenantContext();

  // 모든 데이터를 한번에 병렬 조회
  // dashboardStats: 1개 RPC로 통계 + Top5 + Top3 통합 (기존 ~15개 쿼리 → 1개)
  const [
    campStatsResult,
    fileRequestKpiResult,
    dashboardStats,
    atRiskStudents,
    recentNotes,
  ] = await Promise.all([
    tenantContext?.tenantId
      ? getCampStatisticsForTenant(tenantContext.tenantId)
      : Promise.resolve(null),
    getFileRequestKpiAction().catch(() => ({ pending: 0, submitted: 0, overdue: 0 })),
    getCachedDashboardStats(supabase, weekStart, weekEnd),
    getCachedAtRiskStudents(() => getAtRiskStudents(supabase)),
    getCachedConsultingNotes(() => getRecentConsultingNotes(supabase)),
  ]);

  if (campStatsResult && !campStatsResult.success) {
    console.error("[admin/dashboard] 캠프 통계 조회 실패:", campStatsResult.error);
  }
  const campStats = campStatsResult?.success ? campStatsResult.data : null;
  const fileRequestKpi = fileRequestKpiResult;

  // RPC 결과를 기존 변수 형식으로 매핑
  const studentStats = {
    total: dashboardStats.total_students,
    activeThisWeek: dashboardStats.active_this_week,
    withScores: dashboardStats.with_scores,
    withPlans: dashboardStats.with_plans,
  };
  const topStudyTime = dashboardStats.top_study_time;
  const topPlanCompletion = dashboardStats.top_plan_completion;
  const topGoalAchievement = dashboardStats.top_goal_achievement;

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="관리자 대시보드"
          description="전체 학생 현황과 주요 지표를 확인하세요"
        />

        {/* KPI 카드 — Stripe 패턴: 1선 KPI 4개, 색상은 시맨틱 토큰만 사용 */}
        <section aria-labelledby="kpi-heading" className="flex flex-col gap-4">
          <h2 id="kpi-heading" className="sr-only">학생 KPI 요약</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="전체 학생 수"
              value={studentStats.total}
              color="neutral"
              href="/admin/students"
            />
            <StatCard
              label="이번주 학습한 학생"
              value={studentStats.activeThisWeek}
              color="indigo"
              subValue={`${
                studentStats.total > 0
                  ? Math.round((studentStats.activeThisWeek / studentStats.total) * 100)
                  : 0
              }% 활성`}
              href="/admin/students"
            />
            <StatCard
              label="성적 입력 학생"
              value={studentStats.withScores}
              color="green"
              subValue={`${
                studentStats.total > 0
                  ? Math.round((studentStats.withScores / studentStats.total) * 100)
                  : 0
              }% 입력`}
              href="/admin/students"
            />
            <StatCard
              label="이번주 플랜 학생"
              value={studentStats.withPlans}
              color="purple"
              subValue={`${
                studentStats.total > 0
                  ? Math.round((studentStats.withPlans / studentStats.total) * 100)
                  : 0
              }% 계획`}
              href="/admin/plan-creation"
            />
          </div>
        </section>

        {/* 이번주 학습시간 Top5 */}
        <section
          aria-labelledby="study-time-heading"
          className={cn("rounded-xl border p-5 md:p-6 shadow-sm", bgSurface, borderDefault)}
        >
          <div className="flex flex-col gap-4">
            <SectionHeader id="study-time-heading" title="이번주 학습시간 Top5" viewAllHref="/admin/students" />
            {topStudyTime.length === 0 ? (
              <EmptyState
                title="아직 학습 데이터가 없습니다"
                description="학생을 등록하고 플랜을 발행하면 이번주 학습 현황이 여기에 표시됩니다."
                actionLabel="학생 관리"
                actionHref="/admin/students"
                variant="compact"
                headingLevel="p"
              />
            ) : (
              <div className="flex flex-col gap-2 min-h-[200px]">
                {topStudyTime.map((student, index) => (
                  <RankRow
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    rank={index + 1}
                    rankColor="indigo"
                    name={student.name}
                    rightLabel={`${student.minutes}분`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 이번주 플랜 실행률 Top5 */}
        <section
          aria-labelledby="plan-completion-heading"
          className={cn("rounded-xl border p-5 md:p-6 shadow-sm", bgSurface, borderDefault)}
        >
          <div className="flex flex-col gap-4">
            <SectionHeader
              id="plan-completion-heading"
              title="이번주 플랜 실행률 Top5"
              viewAllHref="/admin/plan-creation"
            />
            {topPlanCompletion.length === 0 ? (
              <EmptyState
                title="플랜 데이터가 없습니다"
                description="플랜을 발행하면 학생별 실행률이 여기에 표시됩니다."
                actionLabel="플랜 만들기"
                actionHref="/admin/plan-creation"
                variant="compact"
                headingLevel="p"
              />
            ) : (
              <div className="flex flex-col gap-2 min-h-[200px]">
                {topPlanCompletion.map((student, index) => (
                  <RankRow
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    rank={index + 1}
                    rankColor="indigo"
                    name={student.name}
                    rightLabel={`${student.completionRate}%`}
                    rightStrong
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 최근 목표 달성 Top3 */}
        <section
          aria-labelledby="goal-achievement-heading"
          className={cn("rounded-xl border p-5 md:p-6 shadow-sm", bgSurface, borderDefault)}
        >
          <div className="flex flex-col gap-4">
            <SectionHeader id="goal-achievement-heading" title="최근 목표 달성 Top3" />
            {topGoalAchievement.length === 0 ? (
              <EmptyState
                title="달성된 목표가 없습니다"
                description="학생이 목표를 달성하면 여기에 표시됩니다."
                variant="compact"
                headingLevel="p"
              />
            ) : (
              <div className="flex flex-col gap-2 min-h-[150px]">
                {topGoalAchievement.map((student, index) => (
                  <RankRow
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    rank={index + 1}
                    rankColor="green"
                    name={student.name}
                    rightLabel={`${student.count}개 달성`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 위험 학생 리스트 */}
        <section
          aria-labelledby="at-risk-heading"
          className={cn(
            "rounded-xl border p-5 md:p-6 shadow-sm",
            "border-red-200 dark:border-red-800",
            "bg-gradient-to-br from-red-50 to-red-100/50",
            "dark:from-red-900/30 dark:to-red-800/20"
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="at-risk-heading"
                className={cn(
                  "flex items-center gap-2 text-lg md:text-xl font-semibold",
                  "text-red-900 dark:text-red-300"
                )}
              >
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                위험 학생 리스트
              </h2>
              <Link
                href="/admin/students"
                className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                전체 보기
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
            {atRiskStudents.length === 0 ? (
              <p className={cn("text-sm", "text-red-600 dark:text-red-400")}>위험 학생이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2 min-h-[200px]">
                {atRiskStudents.map((student) => {
                  const levelLabels = {
                    high: "높음",
                    medium: "보통",
                    low: "낮음",
                  };
                  return (
                    <Link
                      key={student.studentId}
                      href={`/admin/students/${student.studentId}`}
                      className={cn(
                        "flex items-center gap-4 rounded-lg border p-3 transition",
                        "border-red-200 dark:border-red-800",
                        bgSurface,
                        "hover:bg-red-50 dark:hover:bg-red-900/30",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn("rounded-full px-2 py-1 text-xs font-semibold", riskLevelColors[student.level])}
                        >
                          {levelLabels[student.level]}
                        </span>
                        <span className={cn("font-medium", textPrimary)}>{student.name}</span>
                        <span className={cn("text-xs", textMuted)}>({student.riskScore}점)</span>
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-sm line-clamp-2", "text-red-600 dark:text-red-400")}>
                          {student.reasons.length > 0
                            ? student.reasons[0]
                            : "위험 요인 없음"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 최근 상담노트 */}
        <section
          aria-labelledby="recent-notes-heading"
          className={cn("rounded-xl border p-5 md:p-6 shadow-sm", bgSurface, borderDefault)}
        >
          <div className="flex flex-col gap-4">
            <SectionHeader id="recent-notes-heading" title="최근 상담노트" viewAllHref="/admin/students" />
            {recentNotes.length === 0 ? (
              <EmptyState
                title="상담노트가 없습니다"
                description="학생 상세에서 상담노트를 작성하면 여기에 표시됩니다."
                actionLabel="학생 보기"
                actionHref="/admin/students"
                variant="compact"
                headingLevel="p"
              />
            ) : (
              <div className="flex flex-col gap-3 min-h-[200px]">
                {recentNotes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/admin/students/${note.studentId}`}
                    className={cn(
                      "block rounded-lg border p-4 transition hover:shadow-sm",
                      bgSurface,
                      borderDefault,
                      "hover:bg-bg-secondary",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("font-medium", textPrimary)}>{note.studentName}</span>
                      <span className={cn("text-xs", textMuted)}>
                        {new Date(note.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <p className={cn("text-sm line-clamp-2", textSecondary)}>{note.note}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 파일 요청 현황 */}
        {(fileRequestKpi.pending > 0 || fileRequestKpi.submitted > 0 || fileRequestKpi.overdue > 0) && (
          <section aria-labelledby="file-request-heading" className="flex flex-col gap-4">
            <SectionHeader id="file-request-heading" title="파일 요청 현황" viewAllHref="/admin/files" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="대기중"
                value={fileRequestKpi.pending}
                color="amber"
                icon={<Clock className="w-4 h-4" aria-hidden="true" />}
                href="/admin/files"
              />
              <StatCard
                label="제출됨"
                value={fileRequestKpi.submitted}
                color="blue"
                icon={<FileUp className="w-4 h-4" aria-hidden="true" />}
                href="/admin/files"
              />
              <StatCard
                label="기한초과"
                value={fileRequestKpi.overdue}
                color="red"
                icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}
                href="/admin/files"
              />
            </div>
          </section>
        )}

        {/* 캠프 통계 섹션 */}
        {campStats && (
          <section aria-labelledby="camp-stats-heading" className="flex flex-col gap-4">
            <SectionHeader id="camp-stats-heading" title="캠프 통계" viewAllHref="/admin/camp-templates" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="활성 템플릿"
                value={campStats.activeTemplates}
                color="neutral"
                href="/admin/camp-templates"
              />
              <StatCard
                label="전체 초대"
                value={campStats.totalInvitations}
                color="neutral"
                href="/admin/camp-templates"
              />
              <StatCard
                label="수락"
                value={campStats.acceptedInvitations}
                color="green"
                href="/admin/camp-templates"
              />
              <StatCard
                label="대기중"
                value={campStats.pendingInvitations}
                color="amber"
                href="/admin/camp-templates"
              />
              <StatCard
                label="참여율"
                value={`${campStats.participationRate}%`}
                color="indigo"
                href="/admin/camp-templates"
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

