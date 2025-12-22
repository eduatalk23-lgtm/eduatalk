/**
 * Today Domain Types
 *
 * 오늘 학습 관련 타입 정의
 */

// Timer/Plan action types
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

export type CompletePlanResult = {
  success: boolean;
  error?: string;
  serverNow?: number;
  status?: "COMPLETED";
  accumulatedSeconds?: number;
  startedAt?: string | null;
};

export type PausePlanResult = {
  success: boolean;
  error?: string;
  serverNow?: number;
  status?: "PAUSED";
  accumulatedSeconds?: number;
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
