/**
 * Today Domain Public API
 *
 * 오늘 학습 관련 기능을 통합합니다:
 * - 플랜 타이머 (시작, 일시정지, 재개, 완료)
 * - 플랜 메모
 * - 플랜 순서 변경
 * - 플랜 범위 조정
 * - 세션 시간 이벤트
 * - 타이머 초기화
 */

// Types
export type {
  PlanRecordPayload,
  StartPlanResult,
  CompletePlanResult,
  PausePlanResult,
  ResumePlanResult,
  PreparePlanCompletionResult,
  TimeEvent,
  PlanOrderUpdate,
  PlanRange,
  ActionResult,
  PendingAction,
  DeviceConflictInfo,
  TimerActionWithConflict,
  // State Machine Types (TODAY-005)
  TimerStatus,
  TimerAction,
  TransitionResult,
} from "./types";

// State Machine Functions (TODAY-005)
export {
  TimerStatusSchema,
  TimerActionSchema,
  validateTimerTransition,
  canPerformAction,
  getAllowedActions,
  isTerminalStatus,
  isActiveStatus,
  determineTimerStatus,
  validateTimerAction,
  validateAdHocTimerAction,
  isSessionPaused,
  isSessionActivelyRunning,
  isSessionEnded,
} from "./types";

// Error constants and types
export {
  TIMER_ERRORS,
  STATE_TRANSITION_ERRORS,
  getStateTransitionError,
  type TimerErrorKey,
  type StateTransitionErrorKey,
} from "./errors";

// Logger utilities
export {
  todayLogger,
  timerLogger,
  sessionLogger,
  planLogger,
  type LogLevel,
} from "./logger";

// Actions
export {
  // Timer
  startPlan,
  completePlan,
  postponePlan,
  startTimer,
  endTimer,
  pausePlan,
  resumePlan,
  preparePlanCompletion,
  getServerTime,
  syncTimerProgress,
  // Memo
  getPlanMemo,
  savePlanMemo,
  // Order
  updatePlanOrder,
  // Range
  adjustPlanRanges,
  // Session Time
  getTimeEventsByPlanNumber,
  // Reset
  resetPlanTimer,
  // Device Conflict
  checkDeviceConflict,
  updateSessionHeartbeat,
  takeoverSession,
  setSessionDeviceInfo,
  // Execution Log
  logPlanExecutionEvent,
  getPlanExecutionLogs,
  getTodayExecutionSummary,
  logTimerEvent,
} from "./actions";
