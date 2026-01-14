import { getSessionsInRange } from "@/lib/data/studentSessions";
import {
  getTodayInTimezone,
  getStartOfDayUTC,
  getEndOfDayUTC,
  formatDateInTimezone,
} from "@/lib/utils/dateUtils";
import { logActionError } from "@/lib/utils/serverActionLogger";

/**
 * 연속 학습일 계산
 * 최근 30일 중 학습이 30분 이상 있었던 날을 "학습일"로 계산
 */
export async function calculateStreak(
  studentId: string,
  tenantId?: string | null
): Promise<number> {
  try {
    // 오늘 날짜를 KST 기준으로 가져오기
    const todayStr = getTodayInTimezone("Asia/Seoul");
    
    // 최근 30일 범위 계산 (KST 기준)
    const todayDate = new Date(todayStr + "T00:00:00");
    const thirtyDaysAgoDate = new Date(todayDate);
    thirtyDaysAgoDate.setDate(todayDate.getDate() - 30);
    const thirtyDaysAgoStr = formatDateInTimezone(thirtyDaysAgoDate, "Asia/Seoul");

    // UTC 범위로 변환
    const startDate = getStartOfDayUTC(thirtyDaysAgoStr, "Asia/Seoul");
    const endDate = getEndOfDayUTC(todayStr, "Asia/Seoul");

    // 최근 30일 세션 조회 (UTC 범위 사용)
    const sessions = await getSessionsInRange({
      studentId,
      tenantId,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });

    // 날짜별 학습 시간 집계 (분 단위, KST 기준)
    const dailyMinutes = new Map<string, number>();

    sessions.forEach((session) => {
      if (!session.ended_at || !session.duration_seconds) {
        return;
      }

      // 세션 시작 시간을 KST 기준 날짜로 변환
      const sessionDate = new Date(session.started_at);
      const dateKey = formatDateInTimezone(sessionDate, "Asia/Seoul");

      const minutes = Math.floor(session.duration_seconds / 60);
      const currentMinutes = dailyMinutes.get(dateKey) || 0;
      dailyMinutes.set(dateKey, currentMinutes + minutes);
    });

    // 연속 학습일 계산 (오늘부터 역순으로, KST 기준)
    let streak = 0;
    const todayDateObj = new Date(todayStr + "T00:00:00");

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(todayDateObj);
      checkDate.setDate(todayDateObj.getDate() - i);
      const dateKey = formatDateInTimezone(checkDate, "Asia/Seoul");

      const minutes = dailyMinutes.get(dateKey) || 0;

      // 30분 이상 학습한 날이면 연속일 증가
      if (minutes >= 30) {
        streak++;
      } else {
        // 연속이 끊어지면 종료
        break;
      }
    }

    return streak;
  } catch (error) {
    logActionError("metrics.calculateStreak", `연속 학습일 계산 실패: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

