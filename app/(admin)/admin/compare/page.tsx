export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ComparePageClient } from "./_components/ComparePageClient";
import { getWeekRange } from "@/lib/date/weekRange";

type StudentRow = {
  id: string;
  name?: string | null;
  grade?: string | null;
};

// 이번주 학습시간 조회
async function getStudentWeeklyStudyTime(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { data: sessions, error } = await supabase
      .from("student_study_sessions")
      .select("duration_seconds")
      .eq("student_id", studentId)
      .gte("started_at", weekStartStr)
      .lte("started_at", weekEndStr);

    if (error && error.code === "42703") {
      return 0;
    }

    if (error) throw error;

    const totalSeconds = (sessions ?? []).reduce(
      (sum: number, s: { duration_seconds?: number | null }) =>
        sum + (s.duration_seconds ?? 0),
      0
    );

    return Math.floor(totalSeconds / 60);
  } catch (error) {
    console.error(`[compare] 학생 ${studentId} 학습시간 조회 실패`, error);
    return 0;
  }
}

// 이번주 플랜 실행률 조회
async function getStudentWeeklyPlanCompletion(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { data: plans, error } = await supabase
      .from("student_plan")
      .select("completed_amount")
      .eq("student_id", studentId)
      .gte("plan_date", weekStartStr)
      .lte("plan_date", weekEndStr);

    if (error && error.code === "42703") {
      return 0;
    }

    if (error) throw error;

    const planRows = plans ?? [];
    if (planRows.length === 0) return 0;

    const completed = planRows.filter(
      (p: { completed_amount?: number | null }) =>
        p.completed_amount !== null && p.completed_amount !== undefined && p.completed_amount > 0
    ).length;

    return Math.round((completed / planRows.length) * 100);
  } catch (error) {
    console.error(`[compare] 학생 ${studentId} 플랜 실행률 조회 실패`, error);
    return 0;
  }
}

export default async function AdminComparePage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const { weekStart, weekEnd } = getWeekRange();

  // 학생 목록 조회
  const { data: students, error } = await supabase
    .from("students")
    .select("id,name,grade")
    .order("name", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[compare] 학생 목록 조회 실패", error);
  }

  const studentRows = (students as StudentRow[] | null) ?? [];

  // 각 학생의 통계 조회
  const studentsWithStats = await Promise.allSettled(
    studentRows.map(async (student) => {
      const [studyTimeResult, planCompletionResult] = await Promise.allSettled([
        getStudentWeeklyStudyTime(supabase, student.id, weekStart, weekEnd),
        getStudentWeeklyPlanCompletion(supabase, student.id, weekStart, weekEnd),
      ]);

      return {
        id: student.id,
        name: student.name ?? "이름 없음",
        grade: student.grade ?? null,
        studyTimeMinutes:
          studyTimeResult.status === "fulfilled" ? studyTimeResult.value : 0,
        planCompletionRate:
          planCompletionResult.status === "fulfilled" ? planCompletionResult.value : 0,
      };
    })
  );

  const validStudents = studentsWithStats
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return <ComparePageClient students={validStudents} />;
}

