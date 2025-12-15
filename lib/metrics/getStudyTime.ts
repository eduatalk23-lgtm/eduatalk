import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import {
  getStartOfDayUTC,
  getEndOfDayUTC,
  formatDateInTimezone,
} from "@/lib/utils/dateUtils";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type StudyTimeMetrics = {
  thisWeekMinutes: number;
  lastWeekMinutes: number;
  changePercent: number; // 지난주 대비 변화율 (%)
  changeMinutes: number; // 지난주 대비 변화량 (분)
};

/**
 * 주간 학습시간 메트릭 조회
 */
export async function getStudyTime(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<StudyTimeMetrics> {
  try {
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

    // 이번 주 및 지난 주 세션 조회 (UTC 범위 사용)
    const [thisWeekSessions, lastWeekSessions] = await Promise.all([
      getSessionsByDateRange(
        supabase,
        studentId,
        weekStartUTC.toISOString().slice(0, 10),
        weekEndUTC.toISOString().slice(0, 10)
      ),
      getSessionsByDateRange(
        supabase,
        studentId,
        lastWeekStartUTC.toISOString().slice(0, 10),
        lastWeekEndUTC.toISOString().slice(0, 10)
      ),
    ]);

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

