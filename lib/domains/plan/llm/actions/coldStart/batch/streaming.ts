/**
 * 콜드 스타트 배치 SSE 스트리밍 타입 정의
 *
 * 배치 처리 진행 상황을 실시간으로 클라이언트에 전달하기 위한 이벤트 타입
 *
 * @module lib/domains/plan/llm/actions/coldStart/batch/streaming
 */

import type { BatchTarget, BatchProgress, BatchError, BatchResult } from "./types";

// ============================================
// 스트리밍 이벤트 타입
// ============================================

/**
 * 콜드 스타트 배치 스트림 이벤트 기본 타입
 */
interface ColdStartBatchStreamEventBase {
  /** 타임스탬프 */
  timestamp: number;
}

/**
 * 배치 시작 이벤트
 */
export interface ColdStartBatchStartEvent extends ColdStartBatchStreamEventBase {
  type: "start";
  /** 전체 대상 수 */
  total: number;
  /** 프리셋 이름 */
  preset: string;
}

/**
 * 진행 상황 이벤트
 */
export interface ColdStartBatchProgressEvent extends ColdStartBatchStreamEventBase {
  type: "progress";
  /** 현재 진행 상황 */
  progress: BatchProgress;
}

/**
 * 개별 항목 완료 이벤트
 */
export interface ColdStartBatchItemCompleteEvent extends ColdStartBatchStreamEventBase {
  type: "item_complete";
  /** 완료된 대상 */
  target: BatchTarget;
  /** 성공 여부 */
  success: boolean;
  /** 추천 콘텐츠 수 */
  recommendationCount: number;
  /** 새로 저장된 수 */
  newlySaved: number;
  /** 중복 스킵 수 */
  duplicatesSkipped: number;
  /** Fallback 사용 여부 */
  usedFallback: boolean;
  /** 현재 인덱스 */
  currentIndex: number;
  /** 전체 수 */
  total: number;
}

/**
 * 에러 이벤트
 */
export interface ColdStartBatchErrorEvent extends ColdStartBatchStreamEventBase {
  type: "error";
  /** 에러 정보 */
  error: BatchError;
}

/**
 * 배치 완료 이벤트
 */
export interface ColdStartBatchCompleteEvent extends ColdStartBatchStreamEventBase {
  type: "complete";
  /** 최종 결과 */
  result: BatchResult;
}

/**
 * 배치 전체 오류 이벤트
 */
export interface ColdStartBatchFatalErrorEvent extends ColdStartBatchStreamEventBase {
  type: "batch_error";
  /** 에러 메시지 */
  error: string;
}

/**
 * 콜드 스타트 배치 스트림 이벤트 유니온 타입
 */
export type ColdStartBatchStreamEvent =
  | ColdStartBatchStartEvent
  | ColdStartBatchProgressEvent
  | ColdStartBatchItemCompleteEvent
  | ColdStartBatchErrorEvent
  | ColdStartBatchCompleteEvent
  | ColdStartBatchFatalErrorEvent;

// ============================================
// SSE 헬퍼 함수
// ============================================

/**
 * 이벤트를 SSE 형식 문자열로 변환
 */
export function formatColdStartSSEEvent(event: ColdStartBatchStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * SSE 이벤트 파싱
 */
export function parseColdStartSSEEvent(data: string): ColdStartBatchStreamEvent | null {
  try {
    const jsonStr = data.replace(/^data:\s*/, "").trim();
    if (!jsonStr) return null;
    return JSON.parse(jsonStr) as ColdStartBatchStreamEvent;
  } catch {
    return null;
  }
}

// ============================================
// 스트리밍 옵션 타입
// ============================================

/**
 * 스트리밍 콜백 함수 타입
 */
export type OnColdStartBatchProgressCallback = (event: ColdStartBatchStreamEvent) => void;

/**
 * 스트리밍 옵션
 */
export interface ColdStartBatchStreamingOptions {
  /** 진행률 콜백 */
  onProgress?: OnColdStartBatchProgressCallback;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}
