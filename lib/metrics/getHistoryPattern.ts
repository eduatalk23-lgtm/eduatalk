import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import { HISTORY_PATTERN_CONSTANTS } from "@/lib/metrics/constants";
import type {
  SupabaseServerClient,
  MetricsResult,
  DateBasedMetricsOptions,
} from "./types";
import {
  normalizeDateString,
  toDateString,
  handleMetricsError,
  nullToDefault,
  isNotNullString,
} from "./utils";

type HistoryRow = {
  event_type: string | null;
  created_at: string | null;
};

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
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param options - 메트릭 조회 옵션
 * @param options.studentId - 학생 ID
 * @param options.todayDate - 기준 날짜 (Date 객체 또는 YYYY-MM-DD 형식 문자열)
 * @returns 히스토리 패턴 메트릭 결과
 * 
 * @example
 * ```typescript
 * const result = await getHistoryPattern(supabase, {
 *   studentId: "student-123",
 *   todayDate: new Date('2025-01-15'),
 * });
 * 
 * if (result.success) {
 *   console.log(`연속 미완료: ${result.data.consecutivePlanFailures}일`);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function getHistoryPattern(
  supabase: SupabaseServerClient,
  options: DateBasedMetricsOptions
): Promise<MetricsResult<HistoryPatternMetrics>> {
  try {
    const { studentId, todayDate } = options;
    const todayDateStr = normalizeDateString(todayDate);
    const today = new Date(todayDateStr);
    today.setHours(0, 0, 0, 0);

    // 최근 30일 히스토리 조회
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - HISTORY_PATTERN_CONSTANTS.HISTORY_LOOKBACK_DAYS);
    const thirtyDaysAgoStr = toDateString(thirtyDaysAgo);

    const historyRows = await safeQueryArray<HistoryRow>(
      async () => {
        const result = await supabase
          .from("student_history")
          .select("event_type,created_at")
          .eq("student_id", studentId)
          .gte("created_at", thirtyDaysAgoStr)
          .order("created_at", { ascending: false });
        return { data: result.data as HistoryRow[] | null, error: result.error };
      },
      async () => {
        const result = await supabase
          .from("student_history")
          .select("event_type,created_at")
          .gte("created_at", thirtyDaysAgoStr)
          .order("created_at", { ascending: false });
        return { data: result.data as HistoryRow[] | null, error: result.error };
      },
      { context: "[metrics/getHistoryPattern] 히스토리 조회" }
    );

    // null 체크 및 기본값 처리
    const safeHistoryRows = nullToDefault(historyRows, []);

    // 날짜별로 그룹화
    const dateMap = new Map<string, Set<string>>();
    safeHistoryRows.forEach((row) => {
      if (!isNotNullString(row.created_at) || !isNotNullString(row.event_type)) {
        return;
      }
      const date = toDateString(new Date(row.created_at));
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
    safeHistoryRows.forEach((row) => {
      if (
        row.event_type === "study_session" &&
        isNotNullString(row.created_at)
      ) {
        const date = toDateString(new Date(row.created_at));
        studySessionDates.add(date);
      }
    });

    // 오늘부터 역순으로 확인
    const checkDate = new Date(today);
    for (let i = 0; i < HISTORY_PATTERN_CONSTANTS.HISTORY_LOOKBACK_DAYS; i++) {
      const dateStr = toDateString(checkDate);
      if (!studySessionDates.has(dateStr)) {
        consecutiveNoStudyDays++;
      } else {
        break; // 학습세션이 있는 날이 나오면 중단
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // 최근 이벤트 목록
    const recentHistoryEvents = safeHistoryRows
      .slice(0, HISTORY_PATTERN_CONSTANTS.RECENT_EVENTS_LIMIT)
      .map((row) => ({
        eventType: row.event_type ?? "",
        date: isNotNullString(row.created_at)
          ? toDateString(new Date(row.created_at))
          : "",
      }));

    return {
      success: true,
      data: {
        consecutivePlanFailures,
        consecutiveNoStudyDays,
        recentHistoryEvents,
      },
    };
  } catch (error) {
    return handleMetricsError(
      error,
      "[metrics/getHistoryPattern]",
      {
        consecutivePlanFailures: 0,
        consecutiveNoStudyDays: 0,
        recentHistoryEvents: [],
      }
    );
  }
}

