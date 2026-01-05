/**
 * Today Domain Types
 *
 * 오늘 학습 관련 타입 정의
 */

// ============================================================================
// Timer State Machine Types (re-exported from timerUtils)
// TODAY-005: 상태 머신 규칙 중앙화
// ============================================================================

export {
  TimerStatusSchema,
  TimerActionSchema,
  type TimerAction,
  type TransitionResult,
  // State machine functions
  validateTimerTransition,
  canPerformAction,
  getAllowedActions,
  isTerminalStatus,
  isActiveStatus,
  determineTimerStatus,
  validateTimerAction,
  validateAdHocTimerAction,
  // Session state helpers
  isSessionPaused,
  isSessionActivelyRunning,
  isSessionEnded,
} from "@/lib/utils/timerUtils";

// Derive TimerStatus type from schema
import type { z } from "zod";
import type { TimerStatusSchema as TimerStatusSchemaType } from "@/lib/utils/timerUtils";
export type TimerStatus = z.infer<typeof TimerStatusSchemaType>;

// ============================================================================
// Timer/Plan action types
// ============================================================================

export type PlanRecordPayload = {
  startPageOrTime: number;
  endPageOrTime: number;
  memo?: string | null;
};

export type StartPlanResult = {
  success: boolean;
  sessionId?: string;
  error?: string;
  serverNow?: number;
  status?: "RUNNING";
  startedAt?: string;
  accumulatedSeconds?: number;
};

// Import types for next plan suggestion
import type {
  NextPlanSuggestion,
  DailyProgress,
} from "./services/nextPlanService";

export type CompletePlanResult = {
  success: boolean;
  error?: string;
  serverNow?: number;
  status?: "COMPLETED";
  accumulatedSeconds?: number;
  startedAt?: string | null;
  /** 다음 플랜 추천 정보 */
  nextPlanSuggestion?: NextPlanSuggestion;
  /** 일일 진행률 정보 */
  dailyProgress?: DailyProgress;
};

export type PausePlanResult = {
  success: boolean;
  error?: string;
  serverNow?: number;
  status?: "PAUSED";
  accumulatedSeconds?: number;
  pausedAt?: string;
};

export type ResumePlanResult = {
  success: boolean;
  error?: string;
  serverNow?: number;
  status?: "RUNNING";
  startedAt?: string | null;
  accumulatedSeconds?: number;
};

export type PreparePlanCompletionResult = {
  success: boolean;
  error?: string;
  plan?: {
    id: string;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    actual_start_time: string | null;
    actual_end_time: string | null;
    total_duration_seconds: number | null;
    paused_duration_seconds: number | null;
    is_reschedulable: boolean;
    plan_date: string;
  };
  hasActiveSession: boolean;
  isAlreadyCompleted: boolean;
};

// Session time types
export type TimeEvent = {
  type: "start" | "pause" | "resume" | "complete";
  timestamp: string;
  durationSeconds?: number | null;
};

// Plan order types
export type PlanOrderUpdate = {
  planId: string;
  newBlockIndex: number;
};

// Plan range types
export type PlanRange = {
  planId: string;
  startPageOrTime: number;
  endPageOrTime: number;
};

// Common result types
export type ActionResult = {
  success: boolean;
  error?: string;
};

// Timer pending action type
export type PendingAction = "start" | "pause" | "resume" | "complete";

// Device conflict types
export type DeviceConflictInfo = {
  /** 충돌 디바이스 세션 ID */
  deviceSessionId: string;
  /** 디바이스 정보 (userAgent, platform) */
  deviceInfo: {
    userAgent?: string;
    platform?: string;
  } | null;
  /** 읽기 쉬운 디바이스 설명 */
  deviceDescription: string;
  /** 마지막 활성 시각 */
  lastHeartbeat: string;
  /** 같은 디바이스의 다른 탭인지 */
  isSameDevice: boolean;
};

export type TimerActionWithConflict<T> = T & {
  /** 다른 디바이스 충돌 정보 */
  deviceConflict?: DeviceConflictInfo;
};
