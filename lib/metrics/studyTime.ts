import type { StudySession } from "@/lib/data/studentSessions";

/**
 * 플랜의 학습 시간 계산 (초 단위)
 * Today 페이지와 대시보드에서 동일한 로직 사용
 * 
 * @param plan 플랜 정보 (actual_start_time, actual_end_time, total_duration_seconds, paused_duration_seconds 포함)
 * @param nowMs 현재 시간 (밀리초)
 * @param activeSession 활성 세션 정보 (현재 일시정지 중인 경우)
 * @returns 순수 학습 시간 (초, 일시정지 제외)
 */
export function calculatePlanStudySeconds(
  plan: {
    actual_start_time: string | null | undefined;
    actual_end_time: string | null | undefined;
    total_duration_seconds: number | null | undefined;
    paused_duration_seconds: number | null | undefined;
  },
  nowMs: number,
  activeSession?: StudySession | null
): number {
  if (!plan.actual_start_time) {
    return 0;
  }

  const startMs = new Date(plan.actual_start_time).getTime();
  if (!Number.isFinite(startMs)) {
    return 0;
  }

  let endMs = plan.actual_end_time ? new Date(plan.actual_end_time).getTime() : nowMs;
  if (!Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  let elapsedSeconds: number;
  if (plan.total_duration_seconds && plan.actual_end_time) {
    // 완료된 플랜: 저장된 total_duration_seconds 사용
    elapsedSeconds = plan.total_duration_seconds;
  } else {
    // 진행 중인 플랜: 타임스탬프 차이 계산
    elapsedSeconds = Math.floor((endMs - startMs) / 1000);
  }

  let pausedSeconds = plan.paused_duration_seconds ?? 0;

  // 현재 일시정지 중인 경우 추가 계산
  if (!plan.actual_end_time && activeSession && activeSession.paused_at && !activeSession.resumed_at) {
    const pausedAtMs = new Date(activeSession.paused_at).getTime();
    if (Number.isFinite(pausedAtMs)) {
      pausedSeconds += Math.max(0, Math.floor((nowMs - pausedAtMs) / 1000));
    }
  }

  return Math.max(0, elapsedSeconds - pausedSeconds);
}

/**
 * 활성 세션 맵 생성
 * @param sessions 세션 목록
 * @returns plan_id를 키로 하는 활성 세션 맵
 */
export function buildActiveSessionMap(sessions: StudySession[]): Map<string, StudySession> {
  const map = new Map<string, StudySession>();
  sessions.forEach((session) => {
    if (session.plan_id && !session.ended_at) {
      const existing = map.get(session.plan_id);
      if (!existing) {
        map.set(session.plan_id, session);
        return;
      }
      const existingStart = new Date(existing.started_at).getTime();
      const currentStart = new Date(session.started_at).getTime();
      if (currentStart >= existingStart) {
        map.set(session.plan_id, session);
      }
    }
  });
  return map;
}









