/**
 * Today Domain Types
 *
 * 오늘 학습 관련 타입 정의
 */

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
