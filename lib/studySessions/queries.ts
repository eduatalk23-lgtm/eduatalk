import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type StudySession = {
  id: string;
  student_id: string;
  plan_id: string | null;
  content_type: string | null;
  content_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  focus_level: number | null;
  note: string | null;
  created_at: string;
};

// 현재 진행 중인 세션 조회
export async function getActiveSession(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<StudySession | null> {
  try {
    const selectSession = () =>
      supabase
        .from("student_study_sessions")
        .select("*")
        .eq("student_id", studentId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    let { data, error } = await selectSession();

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data, error } = await supabase
        .from("student_study_sessions")
        .select("*")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle());
    }

    if (error) {
      console.error("[studySessions] 활성 세션 조회 실패", error);
      return null;
    }

    return (data as StudySession | null) ?? null;
  } catch (error) {
    console.error("[studySessions] 활성 세션 조회 실패", error);
    return null;
  }
}

// 특정 플랜의 오늘 학습 세션 조회
export async function getTodaySessionsForPlan(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string,
  todayDate: string
): Promise<StudySession[]> {
  try {
    const startOfDay = `${todayDate}T00:00:00Z`;
    const endOfDay = `${todayDate}T23:59:59Z`;

    const selectSessions = () =>
      supabase
        .from("student_study_sessions")
        .select("*")
        .eq("student_id", studentId)
        .eq("plan_id", planId)
        .gte("started_at", startOfDay)
        .lte("started_at", endOfDay)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false });

    let { data, error } = await selectSessions();

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data, error } = await supabase
        .from("student_study_sessions")
        .select("*")
        .eq("plan_id", planId)
        .gte("started_at", startOfDay)
        .lte("started_at", endOfDay)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false }));
    }

    if (error) {
      console.error("[studySessions] 플랜 세션 조회 실패", error);
      return [];
    }

    return (data as StudySession[] | null) ?? [];
  } catch (error) {
    console.error("[studySessions] 플랜 세션 조회 실패", error);
    return [];
  }
}

// 날짜 범위로 세션 조회
export async function getSessionsByDateRange(
  supabase: SupabaseServerClient,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<StudySession[]> {
  try {
    const startOfDay = `${startDate}T00:00:00Z`;
    const endOfDay = `${endDate}T23:59:59Z`;

    const selectSessions = () =>
      supabase
        .from("student_study_sessions")
        .select("*")
        .eq("student_id", studentId)
        .gte("started_at", startOfDay)
        .lte("started_at", endOfDay)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false });

    let { data, error } = await selectSessions();

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data, error } = await supabase
        .from("student_study_sessions")
        .select("*")
        .gte("started_at", startOfDay)
        .lte("started_at", endOfDay)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false }));
    }

    if (error) {
      console.error("[studySessions] 날짜 범위 세션 조회 실패", error);
      return [];
    }

    return (data as StudySession[] | null) ?? [];
  } catch (error) {
    console.error("[studySessions] 날짜 범위 세션 조회 실패", error);
    return [];
  }
}

