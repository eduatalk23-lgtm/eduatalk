import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import {
  getStartOfDayUTC,
  getEndOfDayUTC,
  formatDateInTimezone,
} from "@/lib/utils/dateUtils";
import type {
  SupabaseServerClient,
  MetricsResult,
  WeeklyMetricsOptions,
} from "./types";
import { handleMetricsError } from "./utils";

/**
 * 주간 학습시간 메트릭 타입
 * 
 * @property thisWeekMinutes - 이번 주 학습시간 (분)
 * @property lastWeekMinutes - 지난 주 학습시간 (분)
 * @property changePercent - 지난주 대비 변화율 (%, 양수면 증가, 음수면 감소)
 * @property changeMinutes - 지난주 대비 변화량 (분, 양수면 증가, 음수면 감소)
 */
export type StudyTimeMetrics = {
  thisWeekMinutes: number;
  lastWeekMinutes: number;
  changePercent: number; // 지난주 대비 변화율 (%)
  changeMinutes: number; // 지난주 대비 변화량 (분)
};

/**
 * 주간 학습시간 메트릭 조회
 * 
 * 최적화: 이번 주와 지난 주 데이터를 한 번의 쿼리로 조회한 뒤 메모리에서 분리
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param options - 메트릭 조회 옵션
 * @param options.studentId - 학생 ID
 * @param options.weekStart - 주간 시작일
 * @param options.weekEnd - 주간 종료일
 * @returns 주간 학습시간 메트릭 결과
 * 
 * @example
 * ```typescript
 * const result = await getStudyTime(supabase, {
 *   studentId: "student-123",
 *   weekStart: new Date('2025-01-13'),
 *   weekEnd: new Date('2025-01-19'),
 * });
 * 
 * if (result.success) {
 *   console.log(`이번주 학습시간: ${result.data.thisWeekMinutes}분`);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function getStudyTime(
  supabase: SupabaseServerClient,
  options: WeeklyMetricsOptions
): Promise<MetricsResult<StudyTimeMetrics>> {
  try {
    const { studentId, weekStart, weekEnd } = options;
    // weekStart와 weekEnd를 KST 기준으로 해석하여 UTC 범위로 변환
    const weekStartStr = formatDateInTimezone(weekStart, "Asia/Seoul");
    const weekEndStr = formatDateInTimezone(weekEnd, "Asia/Seoul");

    // 지난 주 범위 계산 (KST 기준)
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(weekEnd.getDate() - 7);
    const lastWeekStartStr = formatDateInTimezone(lastWeekStart, "Asia/Seoul");
    const lastWeekEndStr = formatDateInTimezone(lastWeekEnd, "Asia/Seoul");

    // UTC 범위로 변환
    const weekStartUTC = getStartOfDayUTC(weekStartStr, "Asia/Seoul");
    const weekEndUTC = getEndOfDayUTC(weekEndStr, "Asia/Seoul");
    const lastWeekStartUTC = getStartOfDayUTC(lastWeekStartStr, "Asia/Seoul");
    const lastWeekEndUTC = getEndOfDayUTC(lastWeekEndStr, "Asia/Seoul");

    // 이번 주와 지난 주를 포함하는 전체 범위로 한 번에 조회
    const overallStartUTC = lastWeekStartUTC < weekStartUTC ? lastWeekStartUTC : weekStartUTC;
    const overallEndUTC = lastWeekEndUTC > weekEndUTC ? lastWeekEndUTC : weekEndUTC;

    const allSessions = await getSessionsByDateRange(
      supabase,
      studentId,
      overallStartUTC.toISOString().slice(0, 10),
      overallEndUTC.toISOString().slice(0, 10)
    );

    // 이번 주와 지난 주로 분리 (UTC 기준 날짜 비교)
    const weekStartUTCStr = weekStartUTC.toISOString().slice(0, 10);
    const weekEndUTCStr = weekEndUTC.toISOString().slice(0, 10);
    const lastWeekStartUTCStr = lastWeekStartUTC.toISOString().slice(0, 10);
    const lastWeekEndUTCStr = lastWeekEndUTC.toISOString().slice(0, 10);

    const thisWeekSessions = allSessions.filter((session) => {
      const sessionDate = new Date(session.started_at).toISOString().slice(0, 10);
      return sessionDate >= weekStartUTCStr && sessionDate <= weekEndUTCStr;
    });

    const lastWeekSessions = allSessions.filter((session) => {
      const sessionDate = new Date(session.started_at).toISOString().slice(0, 10);
      return sessionDate >= lastWeekStartUTCStr && sessionDate <= lastWeekEndUTCStr;
    });

    // 학습시간 계산 (초 단위)
    const thisWeekSeconds = thisWeekSessions.reduce(
      (sum, s) => sum + (s.duration_seconds || 0),
      0
    );
    const lastWeekSeconds = lastWeekSessions.reduce(
      (sum, s) => sum + (s.duration_seconds || 0),
      0
    );

    const thisWeekMinutes = Math.floor(thisWeekSeconds / 60);
    const lastWeekMinutes = Math.floor(lastWeekSeconds / 60);
    const changeMinutes = thisWeekMinutes - lastWeekMinutes;
    const changePercent =
      lastWeekMinutes > 0
        ? Math.round((changeMinutes / lastWeekMinutes) * 100)
        : thisWeekMinutes > 0
        ? 100
        : 0;

    return {
      thisWeekMinutes,
      lastWeekMinutes,
      changePercent,
      changeMinutes,
    };
  } catch (error) {
    console.error("[metrics/getStudyTime] 학습시간 조회 실패", error);
    return {
      thisWeekMinutes: 0,
      lastWeekMinutes: 0,
      changePercent: 0,
      changeMinutes: 0,
    };
  }
}

