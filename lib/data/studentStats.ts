/**
 * 학생 통계 배치 조회 (N+1 문제 해결)
 */

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type StudentStats = {
  studentId: string;
  studyTimeMinutes: number;
  planCompletionRate: number;
  lastActivity: string | null;
  hasScore: boolean;
};

/**
 * 여러 학생의 주간 학습 시간을 한 번에 조회
 */
export async function getStudentsWeeklyStudyTime(
  supabase: SupabaseServerClient,
  studentIds: string[],
  weekStart: Date,
  weekEnd: Date
): Promise<Map<string, number>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data: sessions, error } = await supabase
    .from("student_study_sessions")
    .select("student_id, duration_seconds")
    .in("student_id", studentIds)
    .gte("started_at", weekStartStr)
    .lte("started_at", weekEndStr);

  if (error && error.code !== "PGRST116") {
    console.error("[studentStats] 학습 시간 조회 실패", error);
    return new Map();
  }

  const timeMap = new Map<string, number>();
  (sessions ?? []).forEach((s: { student_id?: string; duration_seconds?: number | null }) => {
    if (!s.student_id || !s.duration_seconds) return;
    const current = timeMap.get(s.student_id) ?? 0;
    timeMap.set(s.student_id, current + s.duration_seconds);
  });

  // 초를 분으로 변환
  const minutesMap = new Map<string, number>();
  timeMap.forEach((seconds, studentId) => {
    minutesMap.set(studentId, Math.floor(seconds / 60));
  });

  return minutesMap;
}

/**
 * 여러 학생의 주간 플랜 완료율을 한 번에 조회
 */
export async function getStudentsWeeklyPlanCompletion(
  supabase: SupabaseServerClient,
  studentIds: string[],
  weekStart: Date,
  weekEnd: Date
): Promise<Map<string, number>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data: plans, error } = await supabase
    .from("student_plan")
    .select("student_id, completed_amount")
    .in("student_id", studentIds)
    .gte("plan_date", weekStartStr)
    .lte("plan_date", weekEndStr);

  if (error && error.code !== "PGRST116") {
    console.error("[studentStats] 플랜 완료율 조회 실패", error);
    return new Map();
  }

  // 학생별 집계
  const studentPlanMap = new Map<string, { total: number; completed: number }>();
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

  // 완료율 계산
  const completionMap = new Map<string, number>();
  studentPlanMap.forEach((data, studentId) => {
    const rate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    completionMap.set(studentId, rate);
  });

  return completionMap;
}

/**
 * 여러 학생의 마지막 활동 시간을 한 번에 조회
 */
export async function getStudentsLastActivity(
  supabase: SupabaseServerClient,
  studentIds: string[]
): Promise<Map<string, string | null>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  // 학습 세션에서 마지막 활동 시간 조회
  const { data: sessions, error } = await supabase
    .from("student_study_sessions")
    .select("student_id, started_at")
    .in("student_id", studentIds)
    .order("started_at", { ascending: false });

  if (error && error.code !== "PGRST116") {
    console.error("[studentStats] 마지막 활동 조회 실패", error);
    return new Map();
  }

  const activityMap = new Map<string, string | null>();
  
  // 각 학생의 가장 최근 활동 시간만 저장
  (sessions ?? []).forEach((s: { student_id?: string; started_at?: string | null }) => {
    if (!s.student_id || !s.started_at) return;
    if (!activityMap.has(s.student_id)) {
      activityMap.set(s.student_id, s.started_at);
    }
  });

  // 활동 기록이 없는 학생은 null로 설정
  studentIds.forEach((id) => {
    if (!activityMap.has(id)) {
      activityMap.set(id, null);
    }
  });

  return activityMap;
}

/**
 * 여러 학생의 성적 입력 여부를 한 번에 조회
 */
export async function getStudentsHasScore(
  supabase: SupabaseServerClient,
  studentIds: string[]
): Promise<Set<string>> {
  if (studentIds.length === 0) {
    return new Set();
  }

  const [schoolScores, mockScores] = await Promise.all([
    supabase
      .from("student_school_scores")
      .select("student_id")
      .in("student_id", studentIds)
      .limit(10000), // 충분히 큰 제한
    supabase
      .from("student_mock_scores")
      .select("student_id")
      .in("student_id", studentIds)
      .limit(10000),
  ]);

  const hasScoreSet = new Set<string>();
  
  (schoolScores.data ?? []).forEach((s: { student_id?: string }) => {
    if (s.student_id) hasScoreSet.add(s.student_id);
  });
  
  (mockScores.data ?? []).forEach((s: { student_id?: string }) => {
    if (s.student_id) hasScoreSet.add(s.student_id);
  });

  return hasScoreSet;
}

/**
 * 여러 학생의 통계를 한 번에 조회 (배치 처리)
 */
export async function getStudentsStatsBatch(
  supabase: SupabaseServerClient,
  studentIds: string[],
  weekStart: Date,
  weekEnd: Date
): Promise<Map<string, StudentStats>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  // 모든 통계를 병렬로 조회
  const [studyTimeMap, completionMap, activityMap, hasScoreSet] = await Promise.all([
    getStudentsWeeklyStudyTime(supabase, studentIds, weekStart, weekEnd),
    getStudentsWeeklyPlanCompletion(supabase, studentIds, weekStart, weekEnd),
    getStudentsLastActivity(supabase, studentIds),
    getStudentsHasScore(supabase, studentIds),
  ]);

  // 결과 통합
  const statsMap = new Map<string, StudentStats>();
  
  studentIds.forEach((studentId) => {
    statsMap.set(studentId, {
      studentId,
      studyTimeMinutes: studyTimeMap.get(studentId) ?? 0,
      planCompletionRate: completionMap.get(studentId) ?? 0,
      lastActivity: activityMap.get(studentId) ?? null,
      hasScore: hasScoreSet.has(studentId),
    });
  });

  return statsMap;
}

