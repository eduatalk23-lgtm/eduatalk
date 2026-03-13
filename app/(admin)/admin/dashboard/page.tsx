
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
import { getWeekRange } from "@/lib/date/weekRange";
import { riskLevelColors, textPrimary, textSecondary, textMuted, bgSurface, borderDefault } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";
import { getFileRequestKpiAction } from "@/lib/domains/drive/actions/workflow";
import { Clock, FileUp, AlertTriangle } from "lucide-react";
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
    const { data: students, error } = await supabase
      .from("students")
      .select("id,name")
      .eq("is_active", true);

    if (error) {
      if (ErrorCodeCheckers.isColumnNotFound(error)) {
        const { data: retryStudents } = await supabase
          .from("students")
          .select("id,name")
          .eq("is_active", true);
        if (!retryStudents || retryStudents.length === 0) return [];
        return buildBatchRiskResults(supabase, retryStudents as Array<{ id: string; name?: string | null }>);
      }
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
      .select("id, student_id, note, created_at, students(name)")
      .order("created_at", { ascending: false })
      .limit(5);

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      return [];
    }

    if (error) throw error;

    return (notes ?? []).map((n) => {
      // FK join: students는 many-to-one이므로 단일 객체 또는 배열로 올 수 있음
      const studentData = Array.isArray(n.students) ? n.students[0] : n.students;
      return {
        id: n.id,
        studentId: n.student_id ?? "",
        studentName: studentData?.name ?? "이름 없음",
        note: n.note ?? "",
        createdAt: n.created_at ?? "",
      };
    });
  } catch (error) {
    console.error("[admin/dashboard] 최근 상담노트 조회 실패", error);
    return [];
  }
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

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={cn("rounded-xl border p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow", bgSurface, borderDefault)}>
            <div className="flex flex-col gap-1">
              <div className={cn("text-sm font-medium", textMuted)}>전체 학생 수</div>
              <div className={cn("text-3xl md:text-4xl font-bold", textPrimary)}>{studentStats.total}</div>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/30 dark:to-indigo-800/20 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300">이번주 학습한 학생</div>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                {studentStats.activeThisWeek}
              </div>
              <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {studentStats.total > 0
                  ? Math.round((studentStats.activeThisWeek / studentStats.total) * 100)
                  : 0}
                % 활성
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/30 dark:to-green-800/20 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-green-700 dark:text-green-300">성적 입력 학생</div>
              <div className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400">{studentStats.withScores}</div>
              <div className="text-xs font-medium text-green-600 dark:text-green-400">
                {studentStats.total > 0
                  ? Math.round((studentStats.withScores / studentStats.total) * 100)
                  : 0}
                % 입력
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/30 dark:to-purple-800/20 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-purple-700 dark:text-purple-300">이번주 플랜 학생</div>
              <div className="text-3xl md:text-4xl font-bold text-purple-600 dark:text-purple-400">{studentStats.withPlans}</div>
              <div className="text-xs font-medium text-purple-600 dark:text-purple-400">
                {studentStats.total > 0
                  ? Math.round((studentStats.withPlans / studentStats.total) * 100)
                  : 0}
                % 계획
              </div>
            </div>
          </div>
        </div>

        {/* 이번주 학습시간 Top5 */}
        <div className={cn("rounded-xl border p-5 md:p-6 shadow-sm", bgSurface, borderDefault)}>
          <div className="flex flex-col gap-4">
            <h2 className={cn("text-lg md:text-xl font-semibold", textPrimary)}>이번주 학습시간 Top5</h2>
            {topStudyTime.length === 0 ? (
              <p className={cn("text-sm", textMuted)}>데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2 min-h-[200px]">
                {topStudyTime.map((student, index) => (
                  <Link
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition hover:shadow-sm",
                      bgSurface,
                      borderDefault,
                      "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                        {index + 1}
                      </span>
                      <span className={cn("font-medium", textPrimary)}>{student.name}</span>
                    </div>
                    <span className={cn("text-sm", textSecondary)}>{student.minutes}분</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 이번주 플랜 실행률 Top5 */}
        <div className={cn("rounded-xl border p-5 md:p-6 shadow-sm", bgSurface, borderDefault)}>
          <div className="flex flex-col gap-4">
            <h2 className={cn("text-lg md:text-xl font-semibold", textPrimary)}>이번주 플랜 실행률 Top5</h2>
            {topPlanCompletion.length === 0 ? (
              <p className={cn("text-sm", textMuted)}>데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2 min-h-[200px]">
                {topPlanCompletion.map((student, index) => (
                  <Link
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition hover:shadow-sm",
                      bgSurface,
                      borderDefault,
                      "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                        {index + 1}
                      </span>
                      <span className={cn("font-medium", textPrimary)}>{student.name}</span>
                    </div>
                    <span className={cn("text-sm font-semibold", textPrimary)}>
                      {student.completionRate}%
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 최근 목표 달성 Top3 */}
        <div className={cn("rounded-xl border p-5 md:p-6 shadow-sm", bgSurface, borderDefault)}>
          <div className="flex flex-col gap-4">
            <h2 className={cn("text-lg md:text-xl font-semibold", textPrimary)}>최근 목표 달성 Top3</h2>
            {topGoalAchievement.length === 0 ? (
              <p className={cn("text-sm", textMuted)}>데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2 min-h-[150px]">
                {topGoalAchievement.map((student, index) => (
                  <Link
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition hover:shadow-sm",
                      bgSurface,
                      borderDefault,
                      "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-sm font-semibold text-green-700 dark:text-green-300">
                        {index + 1}
                      </span>
                      <span className={cn("font-medium", textPrimary)}>{student.name}</span>
                    </div>
                    <span className={cn("text-sm", textSecondary)}>{student.count}개 달성</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 위험 학생 리스트 */}
        <div className={cn(
          "rounded-xl border p-5 md:p-6 shadow-sm",
          "border-red-200 dark:border-red-800",
          "bg-gradient-to-br from-red-50 to-red-100/50",
          "dark:from-red-900/30 dark:to-red-800/20"
        )}>
          <div className="flex flex-col gap-4">
            <h2 className={cn("text-lg md:text-xl font-semibold", "text-red-900 dark:text-red-300")}>🚨 위험 학생 리스트</h2>
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
                        "hover:bg-red-50 dark:hover:bg-red-900/30"
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
        </div>

        {/* 최근 상담노트 */}
        <div className={cn("rounded-xl border p-5 md:p-6 shadow-sm", bgSurface, borderDefault)}>
          <div className="flex flex-col gap-4">
            <h2 className={cn("text-lg md:text-xl font-semibold", textPrimary)}>최근 상담노트</h2>
            {recentNotes.length === 0 ? (
              <p className={cn("text-sm", textMuted)}>상담노트가 없습니다.</p>
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
                      "hover:bg-gray-50 dark:hover:bg-gray-700"
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
        </div>

        {/* 파일 요청 현황 */}
        {(fileRequestKpi.pending > 0 || fileRequestKpi.submitted > 0 || fileRequestKpi.overdue > 0) && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className={cn("text-lg md:text-xl font-semibold", textPrimary)}>
                파일 요청 현황
              </h2>
              <Link
                href="/admin/files"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                자세히 보기 →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="대기중" value={fileRequestKpi.pending} color="amber" icon={<Clock className="w-4 h-4" />} />
              <StatCard label="제출됨" value={fileRequestKpi.submitted} color="blue" icon={<FileUp className="w-4 h-4" />} />
              <StatCard label="기한초과" value={fileRequestKpi.overdue} color="red" icon={<AlertTriangle className="w-4 h-4" />} />
            </div>
          </div>
        )}

        {/* 캠프 통계 섹션 */}
        {campStats && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                캠프 통계
              </h2>
              <Link
                href="/admin/camp-templates"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                캠프 관리 →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className={cn("rounded-xl border p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow", bgSurface, borderDefault)}>
                <div className="flex flex-col gap-1">
                  <div className={cn("text-sm font-medium", textMuted)}>활성 템플릿</div>
                  <div className={cn("text-3xl md:text-4xl font-bold", textPrimary)}>
                    {campStats.activeTemplates}
                  </div>
                </div>
              </div>
              <div className={cn("rounded-xl border p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow", bgSurface, borderDefault)}>
                <div className="flex flex-col gap-1">
                  <div className={cn("text-sm font-medium", textMuted)}>전체 초대</div>
                  <div className={cn("text-3xl md:text-4xl font-bold", textPrimary)}>
                    {campStats.totalInvitations}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/30 dark:to-green-800/20 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">수락</div>
                  <div className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400">
                    {campStats.acceptedInvitations}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/30 dark:to-yellow-800/20 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300">대기중</div>
                  <div className="text-3xl md:text-4xl font-bold text-yellow-600 dark:text-yellow-400">
                    {campStats.pendingInvitations}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/30 dark:to-indigo-800/20 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300">참여율</div>
                  <div className="text-3xl md:text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                    {campStats.participationRate}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

