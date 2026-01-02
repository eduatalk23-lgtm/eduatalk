/**
 * Drift-free Timer Utilities
 *
 * 서버 시간과 클라이언트 시간의 차이를 보정하여 정확한 시간 계산을 보장합니다.
 */

import { z } from "zod";
import { getStateTransitionError } from "@/lib/domains/today/errors";

// ============================================================================
// Timer State Machine
// ============================================================================

/**
 * 타이머 상태 Zod 스키마
 */
export const TimerStatusSchema = z.enum([
  "NOT_STARTED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
]);

/**
 * 타이머 액션 Zod 스키마
 */
export const TimerActionSchema = z.enum([
  "START",
  "PAUSE",
  "RESUME",
  "COMPLETE",
]);

export type TimerAction = z.infer<typeof TimerActionSchema>;

/**
 * 유효한 상태 전환 맵
 *
 * 상태 머신 규칙:
 * - NOT_STARTED → START → RUNNING
 * - RUNNING → PAUSE → PAUSED
 * - RUNNING → COMPLETE → COMPLETED
 * - PAUSED → RESUME → RUNNING
 * - PAUSED → COMPLETE → COMPLETED
 * - COMPLETED → (종료 상태, 전환 불가)
 */
const VALID_TRANSITIONS: Record<TimerStatus, Partial<Record<TimerAction, TimerStatus>>> = {
  NOT_STARTED: {
    START: "RUNNING",
  },
  RUNNING: {
    PAUSE: "PAUSED",
    COMPLETE: "COMPLETED",
  },
  PAUSED: {
    RESUME: "RUNNING",
    COMPLETE: "COMPLETED",
  },
  COMPLETED: {
    // 종료 상태 - 전환 불가
  },
};

/**
 * 상태 전환 결과 타입
 */
export type TransitionResult =
  | { valid: true; nextStatus: TimerStatus }
  | { valid: false; error: string; currentStatus: TimerStatus; action: TimerAction };

/**
 * 상태 전환이 유효한지 검증하고 다음 상태를 반환합니다.
 *
 * @param currentStatus 현재 상태
 * @param action 실행할 액션
 * @returns 전환 결과 (유효/무효 및 다음 상태 또는 에러 메시지)
 */
export function validateTimerTransition(
  currentStatus: TimerStatus,
  action: TimerAction
): TransitionResult {
  const transitions = VALID_TRANSITIONS[currentStatus];
  const nextStatus = transitions[action];

  if (nextStatus) {
    return { valid: true, nextStatus };
  }

  return {
    valid: false,
    error: `Invalid transition: ${currentStatus} → ${action}`,
    currentStatus,
    action,
  };
}

/**
 * 특정 액션이 현재 상태에서 허용되는지 확인합니다.
 *
 * @param currentStatus 현재 상태
 * @param action 확인할 액션
 * @returns 허용 여부
 */
export function canPerformAction(
  currentStatus: TimerStatus,
  action: TimerAction
): boolean {
  return VALID_TRANSITIONS[currentStatus][action] !== undefined;
}

/**
 * 현재 상태에서 허용되는 모든 액션을 반환합니다.
 *
 * @param currentStatus 현재 상태
 * @returns 허용되는 액션 배열
 */
export function getAllowedActions(currentStatus: TimerStatus): TimerAction[] {
  const transitions = VALID_TRANSITIONS[currentStatus];
  return Object.keys(transitions) as TimerAction[];
}

/**
 * 상태가 종료 상태인지 확인합니다.
 *
 * @param status 확인할 상태
 * @returns 종료 상태 여부
 */
export function isTerminalStatus(status: TimerStatus): boolean {
  return status === "COMPLETED";
}

/**
 * 상태가 활성 상태인지 확인합니다 (RUNNING 또는 PAUSED).
 *
 * @param status 확인할 상태
 * @returns 활성 상태 여부
 */
export function isActiveStatus(status: TimerStatus): boolean {
  return status === "RUNNING" || status === "PAUSED";
}

/**
 * 플랜/세션 데이터에서 TimerStatus를 결정합니다.
 *
 * @param plan 플랜 정보
 * @param activeSession 활성 세션 정보 (선택)
 * @returns 현재 TimerStatus
 */
export function determineTimerStatus(
  plan: {
    actual_start_time: string | null | undefined;
    actual_end_time: string | null | undefined;
  },
  activeSession?: SessionStateFields | null
): TimerStatus {
  // 완료된 경우
  if (plan.actual_end_time) {
    return "COMPLETED";
  }

  // 시작하지 않은 경우
  if (!plan.actual_start_time) {
    return "NOT_STARTED";
  }

  // 활성 세션이 있고 일시정지 중인 경우
  if (activeSession && isSessionPaused(activeSession)) {
    return "PAUSED";
  }

  // 그 외는 실행 중
  return "RUNNING";
}

/**
 * 타이머 액션 실행 전 상태 검증을 수행합니다.
 * 에러가 있으면 에러 메시지를 반환하고, 없으면 null을 반환합니다.
 *
 * @param plan 플랜 정보
 * @param activeSession 활성 세션 정보
 * @param action 실행할 액션
 * @returns 에러 메시지 또는 null
 */
export function validateTimerAction(
  plan: {
    actual_start_time: string | null | undefined;
    actual_end_time: string | null | undefined;
  },
  activeSession: SessionStateFields | null | undefined,
  action: TimerAction
): string | null {
  const currentStatus = determineTimerStatus(plan, activeSession);
  const result = validateTimerTransition(currentStatus, action);

  if (!result.valid) {
    return result.error;
  }

  return null;
}

// ============================================================================
// Ad-hoc Plan Timer Validation
// ============================================================================

/**
 * Ad-hoc 플랜 상태 타입 (DB의 status 필드 값)
 */
export type AdHocPlanStatus = "pending" | "in_progress" | "paused" | "completed";

/**
 * Ad-hoc 플랜의 status 필드를 TimerStatus로 변환
 *
 * @param status Ad-hoc 플랜의 status 필드 값
 * @returns TimerStatus
 */
export function mapAdHocStatusToTimerStatus(status: AdHocPlanStatus): TimerStatus {
  const statusMap: Record<AdHocPlanStatus, TimerStatus> = {
    pending: "NOT_STARTED",
    in_progress: "RUNNING",
    paused: "PAUSED",
    completed: "COMPLETED",
  };
  return statusMap[status];
}

/**
 * Ad-hoc 플랜의 상태 전이 검증
 *
 * @param currentStatus Ad-hoc 플랜의 현재 status 필드 값
 * @param action 실행할 타이머 액션
 * @returns 에러 메시지 (유효하면 null)
 */
export function validateAdHocTimerAction(
  currentStatus: AdHocPlanStatus,
  action: TimerAction
): string | null {
  const timerStatus = mapAdHocStatusToTimerStatus(currentStatus);
  const result = validateTimerTransition(timerStatus, action);

  if (!result.valid) {
    // TODAY-005: 중앙화된 에러 메시지 사용
    return getStateTransitionError(timerStatus, action);
  }

  return null;
}

// ============================================================================
// Timer Formatting Utilities
// ============================================================================

/**
 * 초를 HH:MM:SS 형식으로 포맷팅
 *
 * @param totalSeconds 총 초
 * @returns HH:MM:SS 또는 MM:SS 형식 문자열
 */
export function formatSecondsToHHMMSS(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * 초를 시간 형식으로 포맷팅 (formatSecondsToHHMMSS의 별칭)
 *
 * @param seconds 총 초
 * @returns HH:MM:SS 또는 MM:SS 형식 문자열
 */
export const formatTime = formatSecondsToHHMMSS;

// TimerStatus는 Zod 스키마에서 추론 (상단에 정의됨)
export type TimerStatus = z.infer<typeof TimerStatusSchema>;

/**
 * 세션 상태 판별에 필요한 최소 필드
 */
export type SessionStateFields = {
  paused_at?: string | null;
  resumed_at?: string | null;
  ended_at?: string | null;
};

/**
 * 세션이 일시정지 상태인지 확인
 *
 * 일시정지 상태: paused_at이 있고 resumed_at이 없는 상태
 * - paused_at != null AND resumed_at == null
 *
 * @param session 세션 객체 (paused_at, resumed_at 필드 필요)
 * @returns 일시정지 상태이면 true
 */
export function isSessionPaused(session: SessionStateFields | null | undefined): boolean {
  if (!session) return false;
  return Boolean(session.paused_at) && !session.resumed_at;
}

/**
 * 세션이 활성 실행 중인지 확인 (일시정지되지 않은 활성 세션)
 *
 * 활성 실행 중: ended_at이 없고, 일시정지 상태가 아닌 상태
 * - ended_at == null AND (paused_at == null OR resumed_at != null)
 *
 * @param session 세션 객체
 * @returns 활성 실행 중이면 true
 */
export function isSessionActivelyRunning(session: SessionStateFields | null | undefined): boolean {
  if (!session) return false;
  if (session.ended_at) return false;
  return !isSessionPaused(session);
}

/**
 * 세션이 종료되었는지 확인
 *
 * @param session 세션 객체
 * @returns 종료되었으면 true
 */
export function isSessionEnded(session: SessionStateFields | null | undefined): boolean {
  if (!session) return false;
  return Boolean(session.ended_at);
}

/**
 * 세션 배열에서 실제 활성 세션만 필터링 (일시정지된 세션 제외)
 *
 * @param sessions 세션 배열
 * @returns 활성 실행 중인 세션 배열
 */
export function filterActivelyRunningSessions<T extends SessionStateFields>(
  sessions: T[] | null | undefined
): T[] {
  if (!sessions) return [];
  return sessions.filter(isSessionActivelyRunning);
}

export type PlanTimerState = {
  /** 서버 기준 상태 */
  status: TimerStatus;
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
 * 서버 시간 오프셋 계산
 * 
 * @param serverNow 서버 현재 시간 (밀리초)
 * @param clientNow 클라이언트 현재 시간 (밀리초, 기본값: Date.now())
 * @returns 서버 시간 오프셋 (밀리초)
 */
export function calculateServerTimeOffset(
  serverNow: number,
  clientNow: number = Date.now()
): number {
  return serverNow - clientNow;
}

/**
 * Drift-free 시간 계산
 * 
 * @param startedAt 시작 시각 (밀리초, 서버 시간 기준)
 * @param baseAccumulated 시작 시점의 누적 시간 (초)
 * @param timeOffset 서버 시간 오프셋 (밀리초)
 * @param now 현재 시간 (밀리초, 기본값: Date.now())
 * @returns 현재 경과 시간 (초)
 */
export function calculateDriftFreeSeconds(
  startedAt: number | null,
  baseAccumulated: number,
  timeOffset: number,
  now: number = Date.now()
): number {
  if (!startedAt) {
    return baseAccumulated;
  }

  const serverNow = now + timeOffset;
  const elapsed = Math.floor((serverNow - startedAt) / 1000);
  return baseAccumulated + elapsed;
}

/**
 * 플랜의 타이머 초기 상태를 계산합니다.
 * 
 * @param plan 플랜 정보
 * @param activeSession 활성 세션 정보 (선택)
 * @param serverNow 서버 현재 시간 (밀리초)
 * @param clientNow 클라이언트 현재 시간 (밀리초, 기본값: Date.now())
 * @returns 타이머 초기 상태
 */
export function computeInitialTimerState(
  plan: {
    actual_start_time: string | null | undefined;
    actual_end_time: string | null | undefined;
    total_duration_seconds: number | null | undefined;
    paused_duration_seconds: number | null | undefined;
  },
  serverNow: number,
  activeSession?: {
    started_at: string;
    paused_at?: string | null;
    resumed_at?: string | null;
    paused_duration_seconds?: number | null;
  } | null,
  clientNow: number = Date.now()
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
  if (activeSession && isSessionPaused(activeSession)) {
    // isSessionPaused가 true면 paused_at은 반드시 존재
    const pausedAtMs = new Date(activeSession.paused_at!).getTime();
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
      // 서버 시간 기준으로 계산
      const timeOffset = calculateServerTimeOffset(serverNow, clientNow);
      const serverNowAdjusted = clientNow + timeOffset;
      const elapsed = Math.floor((serverNowAdjusted - sessionStartMs) / 1000);
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

  // 활성 세션이 없지만 플랜이 시작된 경우
  const timeOffset = calculateServerTimeOffset(serverNow, clientNow);
  const serverNowAdjusted = clientNow + timeOffset;
  const elapsed = Math.floor((serverNowAdjusted - startMs) / 1000);
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
