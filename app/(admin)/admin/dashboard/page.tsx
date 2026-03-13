
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import Link from "next/link";
import { getWeeklyStudyTimeSummary } from "@/lib/reports/weekly";
import { getWeeklyPlanSummary } from "@/lib/reports/weekly";
import { getBatchAtRiskStudents } from "@/lib/risk/batch";
import {
  getCachedStudentStatistics,
  getCachedTopStudents,
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

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// 전체 학생 통계 조회
async function getStudentStatistics(
  supabase: SupabaseServerClient,
  weekStart: Date,
  weekEnd: Date
) {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    // 활성화된 전체 학생 수
    const { count: totalCount, error: countError } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (countError && countError.code === "42703") {
      const { count: retryCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });
      return {
        total: retryCount ?? 0,
        activeThisWeek: 0,
        withScores: 0,
        withPlans: 0,
      };
    }

    const total = totalCount ?? 0;

    // 이번주 학습한 학생 수
    const { data: activeStudents } = await supabase
      .from("student_study_sessions")
      .select("student_id", { count: "exact" })
      .gte("started_at", weekStartStr)
      .lte("started_at", weekEndStr);

    const activeStudentIds = new Set(
      (activeStudents ?? []).map((s: { student_id?: string }) => s.student_id).filter(Boolean)
    );
    const activeThisWeek = activeStudentIds.size;

    // 성적 입력한 학생 수 (두 테이블에서 각각 조회 후 합치기)
    // ⚠️ student_school_scores는 student_internal_scores로 변경되었습니다.
    const [schoolScores, mockScores] = await Promise.all([
      supabase.from("student_internal_scores").select("student_id"),
      supabase.from("student_mock_scores").select("student_id"),
    ]);

    const studentIdsWithScores = new Set<string>();
    (schoolScores.data ?? []).forEach((s: { student_id?: string }) => {
      if (s.student_id) studentIdsWithScores.add(s.student_id);
    });
    (mockScores.data ?? []).forEach((s: { student_id?: string }) => {
      if (s.student_id) studentIdsWithScores.add(s.student_id);
    });
    const withScores = studentIdsWithScores.size;

    // 이번주 플랜이 있는 학생 수
    const { data: plansData } = await supabase
      .from("student_plan")
      .select("student_id")
      .gte("plan_date", weekStartStr)
      .lte("plan_date", weekEndStr);

    const studentIdsWithPlans = new Set(
      (plansData ?? []).map((p: { student_id?: string }) => p.student_id).filter(Boolean)
    );
    const withPlans = studentIdsWithPlans.size;

    return {
      total,
      activeThisWeek,
      withScores,
      withPlans,
    };
  } catch (error) {
    console.error("[admin/dashboard] 학생 통계 조회 실패", error);
    return {
      total: 0,
      activeThisWeek: 0,
      withScores: 0,
      withPlans: 0,
    };
  }
}

// 이번주 학습시간 Top5
async function getTopStudyTimeStudents(
  supabase: SupabaseServerClient,
  weekStart: Date,
  weekEnd: Date
) {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { data: sessions, error } = await supabase
      .from("student_study_sessions")
      .select("student_id,duration_seconds")
      .gte("started_at", weekStartStr)
      .lte("started_at", weekEndStr);

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      return [];
    }

    if (error) throw error;

    // 학생별 학습시간 집계
    const studentTimeMap = new Map<string, number>();
    (sessions ?? []).forEach((s: { student_id?: string; duration_seconds?: number | null }) => {
      if (!s.student_id || !s.duration_seconds) return;
      const current = studentTimeMap.get(s.student_id) ?? 0;
      studentTimeMap.set(s.student_id, current + s.duration_seconds);
    });

    // Top5 추출
    const topStudents = Array.from(studentTimeMap.entries())
      .map(([studentId, seconds]) => ({ studentId, minutes: Math.floor(seconds / 60) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);

    // 학생 이름 배치 조회 (N+1 문제 해결)
    if (topStudents.length === 0) return [];

    const studentIds = topStudents.map((s) => s.studentId);
    const { data: students } = await supabase
      .from("students")
      .select("id,name")
      .in("id", studentIds);

    const studentMap = new Map(
      (students ?? []).map((s: { id: string; name?: string | null }) => [
        s.id,
        s.name ?? "이름 없음",
      ])
    );

    return topStudents.map((s) => ({
      studentId: s.studentId,
      name: studentMap.get(s.studentId) ?? "이름 없음",
      minutes: s.minutes,
    }));
  } catch (error) {
    console.error("[admin/dashboard] 학습시간 Top5 조회 실패", error);
    return [];
  }
}

// 이번주 플랜 실행률 Top5
async function getTopPlanCompletionStudents(
  supabase: SupabaseServerClient,
  weekStart: Date,
  weekEnd: Date
) {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { data: plans, error } = await supabase
      .from("student_plan")
      .select("student_id,completed_amount")
      .gte("plan_date", weekStartStr)
      .lte("plan_date", weekEndStr);

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      return [];
    }

    if (error) throw error;

    // 학생별 플랜 집계
    const studentPlanMap = new Map<
      string,
      { total: number; completed: number }
    >();
    (plans ?? []).forEach(
      (p: { student_id?: string; completed_amount?: number | null }) => {
        if (!p.student_id) return;
        const current = studentPlanMap.get(p.student_id) ?? { total: 0, completed: 0 };
        current.total++;
        if (p.completed_amount !== null && p.completed_amount !== undefined && p.completed_amount > 0) {
          current.completed++;
        }
        studentPlanMap.set(p.student_id, current);
      }
    );

    // 실행률 계산 및 Top5 추출
    const topStudents = Array.from(studentPlanMap.entries())
      .map(([studentId, data]) => ({
        studentId,
        completionRate:
          data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);

    // 학생 이름 배치 조회 (N+1 문제 해결)
    if (topStudents.length === 0) return [];

    const studentIds = topStudents.map((s) => s.studentId);
    const { data: students } = await supabase
      .from("students")
      .select("id,name")
      .in("id", studentIds);

    const studentMap = new Map(
      (students ?? []).map((s: { id: string; name?: string | null }) => [
        s.id,
        s.name ?? "이름 없음",
      ])
    );

    return topStudents.map((s) => ({
      studentId: s.studentId,
      name: studentMap.get(s.studentId) ?? "이름 없음",
      completionRate: s.completionRate,
    }));
  } catch (error) {
    console.error("[admin/dashboard] 플랜 실행률 Top5 조회 실패", error);
    return [];
  }
}

// 최근 목표 달성 학생 Top3
async function getTopGoalAchievementStudents(supabase: SupabaseServerClient) {
  try {
    const { data: history, error } = await supabase
      .from("student_history")
      .select("student_id,created_at")
      .eq("event_type", "goal_completed")
      .order("created_at", { ascending: false })
      .limit(10);

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      return [];
    }

    if (error) throw error;

    // 학생별 달성 횟수 집계
    const studentCountMap = new Map<string, number>();
    (history ?? []).forEach((h: { student_id?: string }) => {
      if (!h.student_id) return;
      const current = studentCountMap.get(h.student_id) ?? 0;
      studentCountMap.set(h.student_id, current + 1);
    });

    // Top3 추출
    const topStudents = Array.from(studentCountMap.entries())
      .map(([studentId, count]) => ({ studentId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 학생 이름 배치 조회 (N+1 문제 해결)
    if (topStudents.length === 0) return [];

    const studentIds = topStudents.map((s) => s.studentId);
    const { data: students } = await supabase
      .from("students")
      .select("id,name")
      .in("id", studentIds);

    const studentMap = new Map(
      (students ?? []).map((s: { id: string; name?: string | null }) => [
        s.id,
        s.name ?? "이름 없음",
      ])
    );

    return topStudents.map((s) => ({
      studentId: s.studentId,
      name: studentMap.get(s.studentId) ?? "이름 없음",
      count: s.count,
    }));
  } catch (error) {
    console.error("[admin/dashboard] 목표 달성 Top3 조회 실패", error);
    return [];
  }
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

// 최근 상담노트 조회
async function getRecentConsultingNotes(supabase: SupabaseServerClient) {
  try {
    const { data: notes, error } = await supabase
      .from("student_consulting_notes")
      .select("id,student_id,note,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      return [];
    }

    if (error) throw error;

    // 학생 이름 배치 조회 (N+1 문제 해결)
    const studentIds = (notes ?? []).map(
      (n: { student_id?: string }) => n.student_id
    ).filter(Boolean) as string[];
    
    if (studentIds.length === 0) {
      return (notes ?? []).map((n: {
        id: string;
        student_id?: string;
        note?: string | null;
        created_at?: string | null;
      }) => ({
        id: n.id,
        studentId: n.student_id ?? "",
        studentName: "이름 없음",
        note: n.note ?? "",
        createdAt: n.created_at ?? "",
      }));
    }

    const { data: students } = await supabase
      .from("students")
      .select("id,name")
      .in("id", studentIds);

    const studentMap = new Map(
      (students ?? []).map((s: { id: string; name?: string | null }) => [
        s.id,
        s.name ?? "이름 없음",
      ])
    );

    return (notes ?? []).map((n: {
      id: string;
      student_id?: string;
      note?: string | null;
      created_at?: string | null;
    }) => ({
      id: n.id,
      studentId: n.student_id ?? "",
      studentName: studentMap.get(n.student_id ?? "") ?? "이름 없음",
      note: n.note ?? "",
      createdAt: n.created_at ?? "",
    }));
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

  // 모든 데이터를 한번에 병렬 조회 (기존: campStats → fileKpi → 순차 후 6개 병렬)
  const [
    campStatsResult,
    fileRequestKpiResult,
    studentStats,
    topStudyTime,
    topPlanCompletion,
    topGoalAchievement,
    atRiskStudents,
    recentNotes,
  ] = await Promise.all([
    tenantContext?.tenantId
      ? getCampStatisticsForTenant(tenantContext.tenantId)
      : Promise.resolve(null),
    getFileRequestKpiAction().catch(() => ({ pending: 0, submitted: 0, overdue: 0 })),
    getCachedStudentStatistics(
      supabase,
      weekStart,
      weekEnd,
      getStudentStatistics
    ),
    getCachedTopStudents(
      `dashboard-top-study-time-${weekStart.toISOString()}-${weekEnd.toISOString()}`,
      () => getTopStudyTimeStudents(supabase, weekStart, weekEnd)
    ),
    getCachedTopStudents(
      `dashboard-top-plan-completion-${weekStart.toISOString()}-${weekEnd.toISOString()}`,
      () => getTopPlanCompletionStudents(supabase, weekStart, weekEnd)
    ),
    getCachedTopStudents(
      "dashboard-top-goal-achievement",
      () => getTopGoalAchievementStudents(supabase)
    ),
    getCachedAtRiskStudents(() => getAtRiskStudents(supabase)),
    getCachedConsultingNotes(() => getRecentConsultingNotes(supabase)),
  ]);

  if (campStatsResult && !campStatsResult.success) {
    console.error("[admin/dashboard] 캠프 통계 조회 실패:", campStatsResult.error);
  }
  const campStats = campStatsResult?.success ? campStatsResult.data : null;
  const fileRequestKpi = fileRequestKpiResult;

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

