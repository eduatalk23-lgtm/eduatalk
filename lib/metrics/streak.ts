import { getSessionsInRange } from "@/lib/data/studentSessions";

/**
 * 연속 학습일 계산
 * 최근 30일 중 학습이 30분 이상 있었던 날을 "학습일"로 계산
 */
export async function calculateStreak(
  studentId: string,
  tenantId?: string | null
): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 최근 30일 범위 계산
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const startDate = thirtyDaysAgo.toISOString();
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    const endDateStr = endDate.toISOString();

    // 최근 30일 세션 조회
    const sessions = await getSessionsInRange({
      studentId,
      tenantId,
      dateRange: {
        start: startDate,
        end: endDateStr,
      },
    });

    // 날짜별 학습 시간 집계 (분 단위)
    const dailyMinutes = new Map<string, number>();

    sessions.forEach((session) => {
      if (!session.ended_at || !session.duration_seconds) {
        return;
      }

      const sessionDate = new Date(session.started_at);
      sessionDate.setHours(0, 0, 0, 0);
      const dateKey = sessionDate.toISOString().slice(0, 10);

      const minutes = Math.floor(session.duration_seconds / 60);
      const currentMinutes = dailyMinutes.get(dateKey) || 0;
      dailyMinutes.set(dateKey, currentMinutes + minutes);
    });

    // 연속 학습일 계산 (오늘부터 역순으로)
    let streak = 0;
    const currentDate = new Date(today);

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(currentDate.getDate() - i);
      const dateKey = checkDate.toISOString().slice(0, 10);

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
    console.error("[metrics/streak] 연속 학습일 계산 실패", error);
    return 0;
  }
}

