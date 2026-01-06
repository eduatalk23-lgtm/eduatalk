/**
 * 배치 처리 관련 타입 정의
 */

import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";

// 생성 방법 타입 (템플릿/이력용 - 간소화된 버전)
export type CreationMethod = "ai" | "planGroup" | "quickPlan" | "contentAdd";

// 배치 처리 학생 정보
export interface BatchStudentInfo {
  id: string;
  name: string;
  data: StudentListRow;
}

// 배치 처리 상태
export type BatchItemStatus = "pending" | "processing" | "success" | "error" | "skipped";

// 개별 학생 처리 결과
export interface BatchItemResult {
  studentId: string;
  studentName: string;
  status: BatchItemStatus;
  message?: string;
  planId?: string;
  planGroupId?: string;
  error?: Error;
  startedAt?: Date;
  completedAt?: Date;
}

// 배치 전체 진행 상태
export interface BatchProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentStudentId?: string;
  currentStudentName?: string;
  items: BatchItemResult[];
}

// 재시도 정책
export interface RetryPolicy {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff?: boolean;
}

// 처리 전략
export type ProcessingStrategy = "sequential" | "parallel";

// 병렬 처리 설정
export interface ParallelConfig {
  maxConcurrent: number;
}

// 배치 처리 상태 머신
export type BatchProcessorState =
  | "idle"
  | "preparing"
  | "processing"
  | "paused"
  | "completed"
  | "error";

// 배치 처리 이벤트
export type BatchProcessorEvent =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "CANCEL" }
  | { type: "RETRY"; studentIds: string[] }
  | { type: "ITEM_COMPLETE"; result: BatchItemResult }
  | { type: "ALL_COMPLETE" }
  | { type: "ERROR"; error: Error };

// 배치 처리기 설정
export interface BatchProcessorConfig {
  strategy: ProcessingStrategy;
  parallel?: ParallelConfig;
  retry?: RetryPolicy;
  onProgress?: (progress: BatchProgress) => void;
  onItemComplete?: (result: BatchItemResult) => void;
  onComplete?: (results: BatchItemResult[]) => void;
  onError?: (error: Error) => void;
}

// 배치 처리기 컨트롤
export interface BatchProcessorControl {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  retry: (studentIds: string[]) => Promise<void>;
}
