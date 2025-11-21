import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type HistoryPatternMetrics = {
  consecutivePlanFailures: number; // 연속 플랜 미완료 횟수
  consecutiveNoStudyDays: number; // 연속 학습세션 없는 날 수
  recentHistoryEvents: Array<{
    eventType: string;
    date: string;
  }>;
};

/**
 * 히스토리 패턴 메트릭 조회
 */
export async function getHistoryPattern(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string
): Promise<HistoryPatternMetrics> {
  try {
    const today = new Date(todayDate);
    today.setHours(0, 0, 0, 0);

    // 최근 30일 히스토리 조회
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

    const selectHistory = () =>
      supabase
        .from("student_history")
        .select("event_type,created_at")
        .gte("created_at", thirtyDaysAgoStr)
        .order("created_at", { ascending: false });

    let { data: history, error } = await selectHistory().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: history, error } = await selectHistory());
    }

    if (error) throw error;

    const historyRows = (history as Array<{
      event_type?: string | null;
      created_at?: string | null;
    }> | null) ?? [];

    // 날짜별로 그룹화
    const dateMap = new Map<string, Set<string>>();
    historyRows.forEach((row) => {
      if (!row.created_at || !row.event_type) return;
      const date = new Date(row.created_at).toISOString().slice(0, 10);
      const existing = dateMap.get(date) || new Set();
      existing.add(row.event_type);
      dateMap.set(date, existing);
    });

    // 연속 플랜 미완료 확인
    let consecutivePlanFailures = 0;
    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
    for (const date of sortedDates) {
      const events = dateMap.get(date) || new Set();
      // plan_completed 이벤트가 없으면 미완료로 간주
      if (!events.has("plan_completed")) {
        consecutivePlanFailures++;
      } else {
        break; // 완료된 날이 나오면 중단
      }
    }

    // 연속 학습세션 없는 날 확인
    let consecutiveNoStudyDays = 0;
    const studySessionDates = new Set<string>();
    historyRows.forEach((row) => {
      if (row.event_type === "study_session" && row.created_at) {
        const date = new Date(row.created_at).toISOString().slice(0, 10);
        studySessionDates.add(date);
      }
    });

    // 오늘부터 역순으로 확인
    const checkDate = new Date(today);
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      if (!studySessionDates.has(dateStr)) {
        consecutiveNoStudyDays++;
      } else {
        break; // 학습세션이 있는 날이 나오면 중단
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // 최근 이벤트 목록
    const recentHistoryEvents = historyRows
      .slice(0, 20)
      .map((row) => ({
        eventType: row.event_type || "",
        date: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : "",
      }));

    return {
      consecutivePlanFailures,
      consecutiveNoStudyDays,
      recentHistoryEvents,
    };
  } catch (error) {
    console.error("[metrics/getHistoryPattern] 히스토리 패턴 조회 실패", error);
    return {
      consecutivePlanFailures: 0,
      consecutiveNoStudyDays: 0,
      recentHistoryEvents: [],
    };
  }
}

