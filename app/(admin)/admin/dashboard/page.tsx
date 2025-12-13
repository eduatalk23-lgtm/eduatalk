export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getWeeklyStudyTimeSummary } from "@/lib/reports/weekly";
import { getWeeklyPlanSummary } from "@/lib/reports/weekly";
import { getStudentRiskScore } from "@/lib/risk/engine";
import {
  getCachedStudentStatistics,
  getCachedTopStudents,
  getCachedAtRiskStudents,
  getCachedConsultingNotes,
} from "@/lib/cache/dashboard";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/molecules/StatCard";
import { getWeekRange } from "@/lib/date/weekRange";

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

    // 전체 학생 수
    const { count: totalCount, error: countError } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true });

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
    const [schoolScores, mockScores] = await Promise.all([
      supabase.from("student_school_scores").select("student_id"),
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

    if (error && error.code === "42703") {
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

    if (error && error.code === "42703") {
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

    if (error && error.code === "42703") {
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

// 위험 학생 조회 (Risk Engine 사용)
async function getAtRiskStudents(supabase: SupabaseServerClient) {
  try {
    // 모든 학생 조회
    const { data: students, error } = await supabase
      .from("students")
      .select("id,name");

    if (error && error.code === "42703") {
      const { data: retryStudents } = await supabase.from("students").select("id,name");
      if (!retryStudents) return [];
      const studentRows = retryStudents as Array<{ id: string; name?: string | null }>;
      const riskResults = await Promise.all(
        studentRows.map(async (student) => {
          try {
            const risk = await getStudentRiskScore(supabase, student.id);
            return {
              studentId: student.id,
              name: student.name ?? "이름 없음",
              riskScore: risk.riskScore,
              level: risk.level,
              reasons: risk.reasons,
            };
          } catch (err) {
            console.error(`[admin/dashboard] 학생 ${student.id} 위험 점수 계산 실패`, err);
            return null;
          }
        })
      );
      return riskResults.filter((r): r is NonNullable<typeof r> => r !== null);
    }

    if (error) throw error;

    const studentRows = (students as Array<{ id: string; name?: string | null }> | null) ?? [];

    // 각 학생의 위험 점수 계산 (병렬 처리)
    const riskResults = await Promise.all(
      studentRows.map(async (student) => {
        try {
          const risk = await getStudentRiskScore(supabase, student.id);
          return {
            studentId: student.id,
            name: student.name ?? "이름 없음",
            riskScore: risk.riskScore,
            level: risk.level,
            reasons: risk.reasons,
          };
        } catch (err) {
          console.error(`[admin/dashboard] 학생 ${student.id} 위험 점수 계산 실패`, err);
          return null;
        }
      })
    );

    // null 제거 및 위험 점수 순으로 정렬 (높은 순)
    return riskResults
      .filter((r): r is NonNullable<typeof riskResults[0]> => r !== null)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5); // 상위 5명만 반환
  } catch (error) {
    console.error("[admin/dashboard] 위험 학생 조회 실패", error);
    return [];
  }
}

// 최근 상담노트 조회
async function getRecentConsultingNotes(supabase: SupabaseServerClient) {
  try {
    const { data: notes, error } = await supabase
      .from("student_consulting_notes")
      .select("id,student_id,note,created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error && error.code === "42703") {
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
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const { weekStart, weekEnd } = getWeekRange();

  // 캐싱을 적용한 데이터 조회
  const [
    studentStats,
    topStudyTime,
    topPlanCompletion,
    topGoalAchievement,
    atRiskStudents,
    recentNotes,
  ] = await Promise.all([
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

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="관리자 대시보드"
          description="전체 학생 현황과 주요 지표를 확인하세요"
        />

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-gray-500">전체 학생 수</div>
              <div className="text-3xl md:text-4xl font-bold text-gray-900">{studentStats.total}</div>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-indigo-700">이번주 학습한 학생</div>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600">
                {studentStats.activeThisWeek}
              </div>
              <div className="text-xs font-medium text-indigo-600">
                {studentStats.total > 0
                  ? Math.round((studentStats.activeThisWeek / studentStats.total) * 100)
                  : 0}
                % 활성
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-green-700">성적 입력 학생</div>
              <div className="text-3xl md:text-4xl font-bold text-green-600">{studentStats.withScores}</div>
              <div className="text-xs font-medium text-green-600">
                {studentStats.total > 0
                  ? Math.round((studentStats.withScores / studentStats.total) * 100)
                  : 0}
                % 입력
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-purple-700">이번주 플랜 학생</div>
              <div className="text-3xl md:text-4xl font-bold text-purple-600">{studentStats.withPlans}</div>
              <div className="text-xs font-medium text-purple-600">
                {studentStats.total > 0
                  ? Math.round((studentStats.withPlans / studentStats.total) * 100)
                  : 0}
                % 계획
              </div>
            </div>
          </div>
        </div>

        {/* 이번주 학습시간 Top5 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">이번주 학습시간 Top5</h2>
            {topStudyTime.length === 0 ? (
              <p className="text-sm text-gray-500">데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topStudyTime.map((student, index) => (
                  <Link
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900">{student.name}</span>
                    </div>
                    <span className="text-sm text-gray-600">{student.minutes}분</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 이번주 플랜 실행률 Top5 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">이번주 플랜 실행률 Top5</h2>
            {topPlanCompletion.length === 0 ? (
              <p className="text-sm text-gray-500">데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topPlanCompletion.map((student, index) => (
                  <Link
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900">{student.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {student.completionRate}%
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 최근 목표 달성 Top3 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">최근 목표 달성 Top3</h2>
            {topGoalAchievement.length === 0 ? (
              <p className="text-sm text-gray-500">데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topGoalAchievement.map((student, index) => (
                  <Link
                    key={student.studentId}
                    href={`/admin/students/${student.studentId}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900">{student.name}</span>
                    </div>
                    <span className="text-sm text-gray-600">{student.count}개 달성</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 위험 학생 리스트 */}
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg md:text-xl font-semibold text-red-900">🚨 위험 학생 리스트</h2>
            {atRiskStudents.length === 0 ? (
              <p className="text-sm text-red-600">위험 학생이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {atRiskStudents.map((student) => {
                  const levelColors = {
                    high: "bg-red-500 text-white",
                    medium: "bg-yellow-500 text-white",
                    low: "bg-green-500 text-white",
                  };
                  const levelLabels = {
                    high: "높음",
                    medium: "보통",
                    low: "낮음",
                  };
                  return (
                    <Link
                      key={student.studentId}
                      href={`/admin/students/${student.studentId}`}
                      className="flex items-center gap-4 rounded-lg border border-red-200 bg-white p-3 transition hover:bg-red-50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${levelColors[student.level]}`}
                        >
                          {levelLabels[student.level]}
                        </span>
                        <span className="font-medium text-gray-900">{student.name}</span>
                        <span className="text-xs text-gray-500">({student.riskScore}점)</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-red-600 line-clamp-2">
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
        <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">최근 상담노트</h2>
            {recentNotes.length === 0 ? (
              <p className="text-sm text-gray-500">상담노트가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {recentNotes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/admin/students/${note.studentId}`}
                    className="block rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">{note.studentName}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(note.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{note.note}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

