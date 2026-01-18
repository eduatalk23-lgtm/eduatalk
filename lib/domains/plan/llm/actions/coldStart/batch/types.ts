/**
 * 콜드 스타트 배치 처리 타입 정의
 */

import type { ContentType, DifficultyLevel } from "../types";

/**
 * 배치 처리 대상 조합
 */
export interface BatchTarget {
  /** 교과 카테고리 */
  subjectCategory: string;
  /** 세부 과목 (선택) */
  subject?: string;
  /** 난이도 (선택) */
  difficulty?: DifficultyLevel;
  /** 콘텐츠 타입 (선택) */
  contentType?: ContentType;
}

/**
 * 배치 처리 옵션
 */
export interface BatchOptions {
  /** 테넌트 ID (null = 공유 카탈로그) */
  tenantId?: string | null;

  /** DB 저장 여부 (기본: true) */
  saveToDb?: boolean;

  /** Mock 모드 (API 호출 없이 테스트) */
  useMock?: boolean;

  /** 요청 간 딜레이 (ms, 기본: 5000) - Rate limit 방지 */
  delayBetweenRequests?: number;

  /** 실패 시 재시도 횟수 (기본: 1) */
  maxRetries?: number;

  /** 진행 상황 콜백 */
  onProgress?: (progress: BatchProgress) => void;

  /** 에러 콜백 */
  onError?: (error: BatchError) => void;

  /** 완료 콜백 */
  onComplete?: (result: BatchResult) => void;

  /** 최대 동시 처리 수 (기본: 1, Rate limit으로 인해 순차 처리 권장) */
  concurrency?: number;

  /** 처리할 대상 제한 (기본: 전체) */
  limit?: number;
}

/**
 * 배치 진행 상황
 */
export interface BatchProgress {
  /** 현재 처리 중인 대상 */
  current: BatchTarget;
  /** 현재 인덱스 (0-based) */
  currentIndex: number;
  /** 전체 대상 수 */
  total: number;
  /** 완료율 (%) */
  percentComplete: number;
  /** 성공 수 */
  successCount: number;
  /** 실패 수 */
  failureCount: number;
  /** 스킵 수 (이미 존재) */
  skippedCount: number;
}

/**
 * 배치 에러 정보
 */
export interface BatchError {
  /** 실패한 대상 */
  target: BatchTarget;
  /** 에러 메시지 */
  error: string;
  /** 시도 횟수 */
  attempts: number;
  /** Rate limit 에러 여부 */
  isRateLimitError: boolean;
}

/**
 * 개별 항목 처리 결과
 */
export interface BatchItemResult {
  /** 대상 조합 */
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
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 처리 시간 (ms) */
  durationMs: number;
}

/**
 * 배치 처리 최종 결과
 */
export interface BatchResult {
  /** 성공 여부 */
  success: boolean;
  /** 시작 시간 */
  startedAt: string;
  /** 종료 시간 */
  completedAt: string;
  /** 총 처리 시간 (ms) */
  totalDurationMs: number;
  /** 통계 */
  stats: {
    /** 전체 대상 수 */
    total: number;
    /** 성공 수 */
    succeeded: number;
    /** 실패 수 */
    failed: number;
    /** 스킵 수 (Rate limit 등으로 인한 fallback 사용) */
    usedFallback: number;
    /** 새로 저장된 총 콘텐츠 수 */
    totalNewlySaved: number;
    /** 중복으로 스킵된 총 수 */
    totalDuplicatesSkipped: number;
  };
  /** 개별 결과 */
  items: BatchItemResult[];
  /** 에러 목록 */
  errors: BatchError[];
}

/**
 * 배치 설정 프리셋
 */
export type BatchPreset = "all" | "core" | "math" | "english" | "science" | "custom";
