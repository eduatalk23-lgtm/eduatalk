import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type StudySession = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  plan_id?: string | null;
  content_type?: string | null;
  content_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  paused_at?: string | null;
  resumed_at?: string | null;
  paused_duration_seconds?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SessionFilters = {
  studentId: string;
  tenantId?: string | null;
  dateRange?: {
    start: string;
    end: string;
  };
  planId?: string;
  isActive?: boolean; // ended_at이 null인 세션만
};

/**
 * 학습 세션 목록 조회
 */
export async function getSessionsInRange(
  filters: SessionFilters
): Promise<StudySession[]> {
  const supabase = await createSupabaseServerClient();

  const selectSessions = () =>
    supabase
      .from("student_study_sessions")
      .select(
        "id,tenant_id,student_id,plan_id,content_type,content_id,started_at,ended_at,duration_seconds,paused_at,resumed_at,paused_duration_seconds,created_at,updated_at"
      )
      .eq("student_id", filters.studentId);

  let query = selectSessions();

  if (filters.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }

  if (filters.planId) {
    query = query.eq("plan_id", filters.planId);
  }

  if (filters.isActive !== undefined) {
    if (filters.isActive) {
      query = query.is("ended_at", null);
    } else {
      query = query.not("ended_at", "is", null);
    }
  }

  if (filters.dateRange) {
    query = query
      .gte("started_at", filters.dateRange.start)
      .lte("started_at", filters.dateRange.end);
  }

  query = query.order("started_at", { ascending: false });

  let { data, error } = await query;

  if (error && error.code === "42703") {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const fallbackQuery = supabase
      .from("student_study_sessions")
      .select("*")
      .eq("student_id", filters.studentId);

    if (filters.planId) {
      fallbackQuery.eq("plan_id", filters.planId);
    }

    if (filters.isActive !== undefined) {
      if (filters.isActive) {
        fallbackQuery.is("ended_at", null);
      } else {
        fallbackQuery.not("ended_at", "is", null);
      }
    }

    if (filters.dateRange) {
      fallbackQuery
        .gte("started_at", filters.dateRange.start)
        .lte("started_at", filters.dateRange.end);
    }

    ({ data, error } = await fallbackQuery.order("started_at", { ascending: false }));
  }

  if (error) {
    console.error("[data/studentSessions] 세션 조회 실패", error);
    return [];
  }

  return (data as StudySession[] | null) ?? [];
}

/**
 * 활성 세션 조회 (ended_at이 null인 세션)
 */
export async function getActiveSession(
  studentId: string,
  tenantId?: string | null
): Promise<StudySession | null> {
  const sessions = await getSessionsInRange({
    studentId,
    tenantId,
    isActive: true,
  });

  return sessions.length > 0 ? sessions[0] : null;
}

/**
 * 세션 ID로 세션 조회
 */
export async function getSessionById(
  sessionId: string,
  studentId: string,
  tenantId?: string | null
): Promise<StudySession | null> {
  const supabase = await createSupabaseServerClient();

  const selectSession = () =>
    supabase
      .from("student_study_sessions")
      .select(
        "id,tenant_id,student_id,plan_id,content_type,content_id,started_at,ended_at,duration_seconds,paused_at,resumed_at,paused_duration_seconds,created_at,updated_at"
      )
      .eq("id", sessionId)
      .eq("student_id", studentId);

  let query = selectSession();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query.maybeSingle<StudySession>();

  if (error && error.code === "42703") {
    ({ data, error } = await selectSession().maybeSingle<StudySession>());
  }

  if (error && error.code !== "PGRST116") {
    console.error("[data/studentSessions] 세션 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * 학습 세션 생성
 */
export async function createSession(
  session: {
    tenant_id?: string | null;
    student_id: string;
    plan_id?: string | null;
    content_type?: string | null;
    content_id?: string | null;
    started_at?: string; // 없으면 현재 시간 사용
  }
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: session.tenant_id || null,
    student_id: session.student_id,
    plan_id: session.plan_id || null,
    content_type: session.content_type || null,
    content_id: session.content_id || null,
    started_at: session.started_at || new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("student_study_sessions")
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === "42703") {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("student_study_sessions")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[data/studentSessions] 세션 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, sessionId: data?.id };
}

/**
 * 학습 세션 종료
 */
export async function endSession(
  sessionId: string,
  studentId: string,
  endedAt?: string, // 없으면 현재 시간 사용
  pausedDurationSeconds?: number // 일시정지된 총 시간 (초 단위)
): Promise<{ success: boolean; durationSeconds?: number; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 세션 조회
  const session = await getSessionById(sessionId, studentId);
  if (!session) {
    return { success: false, error: "세션을 찾을 수 없습니다." };
  }

  if (session.ended_at) {
    return { success: false, error: "이미 종료된 세션입니다." };
  }

  const endedAtTime = endedAt || new Date().toISOString();
  const startedAt = new Date(session.started_at);
  const endedAtDate = new Date(endedAtTime);
  const totalDurationSeconds = Math.floor((endedAtDate.getTime() - startedAt.getTime()) / 1000);
  
  // 일시정지 시간이 전달된 경우 사용, 없으면 세션의 paused_duration_seconds 사용
  const finalPausedDuration = pausedDurationSeconds ?? session.paused_duration_seconds ?? 0;
  
  // 순수 학습 시간 = 총 시간 - 일시정지 시간
  const actualDurationSeconds = Math.max(0, totalDurationSeconds - finalPausedDuration);

  const payload = {
    ended_at: endedAtTime,
    duration_seconds: actualDurationSeconds,
    paused_duration_seconds: finalPausedDuration,
  };

  let { error } = await supabase
    .from("student_study_sessions")
    .update(payload)
    .eq("id", sessionId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase
      .from("student_study_sessions")
      .update(payload)
      .eq("id", sessionId));
  }

  if (error) {
    console.error("[data/studentSessions] 세션 종료 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, durationSeconds: actualDurationSeconds };
}

/**
 * 학습 세션 삭제 (취소)
 */
export async function deleteSession(
  sessionId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  let { error } = await supabase
    .from("student_study_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase.from("student_study_sessions").delete().eq("id", sessionId));
  }

  if (error) {
    console.error("[data/studentSessions] 세션 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

