/**
 * 타이머 초기값 계산 유틸리티
 * 서버에서 클라이언트로 전달할 초기 타이머 상태를 계산합니다.
 */

export type PlanTimerState = {
  /** 서버 기준 상태 */
  status: "NOT_STARTED" | "RUNNING" | "PAUSED" | "COMPLETED";
  /** 누적된 학습 시간 (초) */
  accumulatedSeconds: number;
  /** 마지막 시작 시각 (UTC ISO 타임스탬프, RUNNING일 때만 존재) */
  startedAt: string | null;
  /** 클라이언트에 전달할 초기 경과 시간 (초) */
  initialDuration: number;
  /** 클라이언트에 전달할 초기 실행 상태 */
  isInitiallyRunning: boolean;
};

/**
 * 플랜의 타이머 초기 상태를 계산합니다.
 * 
 * @param plan 플랜 정보
 * @param activeSession 활성 세션 정보 (선택)
 * @param now 현재 시간 (밀리초, 기본값: Date.now())
 * @returns 타이머 초기 상태
 */
export function calculatePlanTimerState(
  plan: {
    actual_start_time: string | null | undefined;
    actual_end_time: string | null | undefined;
    total_duration_seconds: number | null | undefined;
    paused_duration_seconds: number | null | undefined;
  },
  activeSession?: {
    started_at: string;
    paused_at?: string | null;
    resumed_at?: string | null;
    paused_duration_seconds?: number | null;
  } | null,
  now: number = Date.now()
): PlanTimerState {
  // 완료된 경우
  if (plan.actual_end_time && plan.total_duration_seconds !== null && plan.total_duration_seconds !== undefined) {
    return {
      status: "COMPLETED",
      accumulatedSeconds: plan.total_duration_seconds,
      startedAt: null,
      initialDuration: plan.total_duration_seconds,
      isInitiallyRunning: false,
    };
  }

  // 시작하지 않은 경우
  if (!plan.actual_start_time) {
    return {
      status: "NOT_STARTED",
      accumulatedSeconds: 0,
      startedAt: null,
      initialDuration: 0,
      isInitiallyRunning: false,
    };
  }

  const startMs = new Date(plan.actual_start_time).getTime();
  if (!Number.isFinite(startMs)) {
    return {
      status: "NOT_STARTED",
      accumulatedSeconds: 0,
      startedAt: null,
      initialDuration: 0,
      isInitiallyRunning: false,
    };
  }

  // 활성 세션이 있고 일시정지 중인 경우
  if (activeSession && activeSession.paused_at && !activeSession.resumed_at) {
    const pausedAtMs = new Date(activeSession.paused_at).getTime();
    if (Number.isFinite(pausedAtMs)) {
      // 일시정지 시점까지의 경과 시간 계산
      const elapsedUntilPause = Math.floor((pausedAtMs - startMs) / 1000);
      const sessionPausedDuration = activeSession.paused_duration_seconds || 0;
      const planPausedDuration = plan.paused_duration_seconds || 0;
      const accumulatedSeconds = Math.max(0, elapsedUntilPause - sessionPausedDuration - planPausedDuration);

      return {
        status: "PAUSED",
        accumulatedSeconds,
        startedAt: null, // 일시정지 중이므로 startedAt은 null
        initialDuration: accumulatedSeconds,
        isInitiallyRunning: false,
      };
    }
  }

  // 실행 중인 경우
  if (activeSession && activeSession.started_at) {
    const sessionStartMs = new Date(activeSession.started_at).getTime();
    if (Number.isFinite(sessionStartMs)) {
      const elapsed = Math.floor((now - sessionStartMs) / 1000);
      const sessionPausedDuration = activeSession.paused_duration_seconds || 0;
      const planPausedDuration = plan.paused_duration_seconds || 0;
      const accumulatedSeconds = Math.max(0, elapsed - sessionPausedDuration - planPausedDuration);

      return {
        status: "RUNNING",
        accumulatedSeconds,
        startedAt: activeSession.started_at,
        initialDuration: accumulatedSeconds,
        isInitiallyRunning: true,
      };
    }
  }

  // 활성 세션이 없지만 플랜이 시작된 경우 (이론적으로는 발생하지 않아야 함)
  // 기존 accumulated_seconds를 사용
  const elapsed = Math.floor((now - startMs) / 1000);
  const pausedDuration = plan.paused_duration_seconds || 0;
  const accumulatedSeconds = Math.max(0, elapsed - pausedDuration);

  return {
    status: "RUNNING",
    accumulatedSeconds,
    startedAt: plan.actual_start_time,
    initialDuration: accumulatedSeconds,
    isInitiallyRunning: true,
  };
}

