/**
 * 타이머 상태 계산 유틸리티
 * 
 * 서버에서 받은 데이터를 기반으로 클라이언트 타이머 상태를 계산합니다.
 * PlanTimerCard와 PlanCard에서 공통으로 사용됩니다.
 */

import type { TimerStatus } from "@/lib/store/planTimerStore";

export type TimerStateInput = {
  /** 실제 시작 시간 */
  actualStartTime: string | null;
  /** 실제 종료 시간 */
  actualEndTime: string | null;
  /** 총 학습 시간 (초) */
  totalDurationSeconds: number | null;
  /** 일시정지된 시간 (초) */
  pausedDurationSeconds: number | null;
  /** 현재 일시정지 상태 */
  isPaused: boolean;
  /** 현재 일시정지 시작 시간 */
  currentPausedAt: string | null;
  /** 세션 시작 시간 */
  sessionStartedAt: string | null;
  /** 세션 일시정지 시간 (초) */
  sessionPausedDurationSeconds: number | null;
};

export type TimerState = {
  /** 타이머 상태 */
  status: TimerStatus;
  /** 누적 시간 (초) */
  accumulatedSeconds: number;
  /** 시작 시각 (UTC ISO 타임스탬프) */
  startedAt: string | null;
};

/**
 * 서버 데이터를 기반으로 타이머 상태를 계산합니다.
 * 
 * @param input 타이머 상태 계산에 필요한 입력 데이터
 * @returns 계산된 타이머 상태
 */
export function calculateTimerState(input: TimerStateInput): TimerState {
  const {
    actualStartTime,
    actualEndTime,
    totalDurationSeconds,
    pausedDurationSeconds,
    isPaused,
    currentPausedAt,
    sessionStartedAt,
    sessionPausedDurationSeconds,
  } = input;

  // 완료된 경우
  if (actualEndTime && totalDurationSeconds !== null && totalDurationSeconds !== undefined) {
    return {
      status: "COMPLETED",
      accumulatedSeconds: totalDurationSeconds,
      startedAt: null,
    };
  }

  // 시작하지 않은 경우
  if (!actualStartTime) {
    return {
      status: "NOT_STARTED",
      accumulatedSeconds: 0,
      startedAt: null,
    };
  }

  const startMs = new Date(actualStartTime).getTime();
  if (!Number.isFinite(startMs)) {
    return {
      status: "NOT_STARTED",
      accumulatedSeconds: 0,
      startedAt: null,
    };
  }

  const now = Date.now();

  // 일시정지 중인 경우
  if (isPaused && currentPausedAt) {
    const pausedAtMs = new Date(currentPausedAt).getTime();
    if (Number.isFinite(pausedAtMs)) {
      const elapsedUntilPause = Math.floor((pausedAtMs - startMs) / 1000);
      const sessionPausedDuration = sessionPausedDurationSeconds || 0;
      const planPausedDuration = pausedDurationSeconds || 0;
      const accumulatedSeconds = Math.max(0, elapsedUntilPause - sessionPausedDuration - planPausedDuration);

      return {
        status: "PAUSED",
        accumulatedSeconds,
        startedAt: null,
      };
    }
  }

  // 실행 중인 경우
  if (sessionStartedAt) {
    const sessionStartMs = new Date(sessionStartedAt).getTime();
    if (Number.isFinite(sessionStartMs)) {
      const elapsed = Math.floor((now - sessionStartMs) / 1000);
      const sessionPausedDuration = sessionPausedDurationSeconds || 0;
      const planPausedDuration = pausedDurationSeconds || 0;
      const accumulatedSeconds = Math.max(0, elapsed - sessionPausedDuration - planPausedDuration);

      return {
        status: "RUNNING",
        accumulatedSeconds,
        startedAt: sessionStartedAt,
      };
    }
  }

  // 활성 세션이 없지만 플랜이 시작된 경우
  const elapsed = Math.floor((now - startMs) / 1000);
  const pausedDuration = pausedDurationSeconds || 0;
  const accumulatedSeconds = Math.max(0, elapsed - pausedDuration);

  return {
    status: "RUNNING",
    accumulatedSeconds,
    startedAt: actualStartTime,
  };
}

