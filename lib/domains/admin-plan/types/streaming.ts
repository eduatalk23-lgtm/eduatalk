/**
 * 배치 플랜 생성 스트리밍 타입
 *
 * Phase 1: 실시간 진행률 스트리밍을 위한 이벤트 타입
 *
 * @module lib/domains/admin-plan/types/streaming
 */

import type { StudentPlanResult } from "../actions/batchAIPlanGeneration";

// ============================================
// 스트리밍 이벤트 타입
// ============================================

/**
 * 배치 스트림 이벤트 기본 타입
 */
interface BatchStreamEventBase {
  /** 현재 진행 인덱스 (1-based) */
  progress: number;
  /** 전체 학생 수 */
  total: number;
  /** 타임스탬프 */
  timestamp: number;
}

/**
 * 배치 시작 이벤트
 */
export interface BatchStreamStartEvent extends BatchStreamEventBase {
  type: "start";
  /** 처리할 학생 ID 목록 */
  studentIds: string[];
}

/**
 * 학생 처리 시작 이벤트
 */
export interface BatchStreamStudentStartEvent extends BatchStreamEventBase {
  type: "student_start";
  studentId: string;
  studentName: string;
}

/**
 * 학생 처리 완료 이벤트
 */
export interface BatchStreamStudentCompleteEvent extends BatchStreamEventBase {
  type: "student_complete";
  studentId: string;
  studentName: string;
  result: StudentPlanResult;
}

/**
 * 학생 처리 오류 이벤트
 */
export interface BatchStreamStudentErrorEvent extends BatchStreamEventBase {
  type: "student_error";
  studentId: string;
  studentName: string;
  error: string;
}

/**
 * 배치 완료 이벤트
 */
export interface BatchStreamCompleteEvent extends BatchStreamEventBase {
  type: "complete";
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    totalPlans: number;
    totalCost: number;
  };
  results: StudentPlanResult[];
}

/**
 * 배치 전체 오류 이벤트
 */
export interface BatchStreamBatchErrorEvent extends BatchStreamEventBase {
  type: "batch_error";
  error: string;
}

/**
 * 배치 스트림 이벤트 유니온 타입
 */
export type BatchStreamEvent =
  | BatchStreamStartEvent
  | BatchStreamStudentStartEvent
  | BatchStreamStudentCompleteEvent
  | BatchStreamStudentErrorEvent
  | BatchStreamCompleteEvent
  | BatchStreamBatchErrorEvent;

// ============================================
// 스트리밍 콜백 타입
// ============================================

/**
 * 진행률 콜백 함수 타입
 */
export type OnProgressCallback = (event: BatchStreamEvent) => void;

/**
 * 스트리밍 옵션
 */
export interface StreamingOptions {
  /** 진행률 콜백 */
  onProgress?: OnProgressCallback;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

// ============================================
// SSE 헬퍼 함수
// ============================================

/**
 * 이벤트를 SSE 형식 문자열로 변환
 */
export function formatSSEEvent(event: BatchStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * SSE 이벤트 파싱
 */
export function parseSSEEvent(data: string): BatchStreamEvent | null {
  try {
    const jsonStr = data.replace(/^data:\s*/, "").trim();
    if (!jsonStr) return null;
    return JSON.parse(jsonStr) as BatchStreamEvent;
  } catch {
    return null;
  }
}
