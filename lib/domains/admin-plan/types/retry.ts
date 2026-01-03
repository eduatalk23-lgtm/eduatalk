/**
 * 배치 플랜 재시도 타입
 *
 * Phase 2: 실패 학생 선택적 재시도
 *
 * @module lib/domains/admin-plan/types/retry
 */

import type { StudentPlanResult } from "../actions/batchAIPlanGeneration";

// ============================================
// 재시도 입력 타입
// ============================================

/**
 * 재시도 대상 학생 정보
 */
export interface RetryStudent {
  studentId: string;
  studentName: string;
  /** 이전 실패 사유 */
  previousError?: string;
  /** 콘텐츠 ID 목록 (미리 로드된 경우) */
  contentIds?: string[];
}

/**
 * 재시도 요청 입력
 */
export interface BatchRetryInput {
  /** 재시도할 학생 목록 */
  students: RetryStudent[];
  /** 플랜 설정 (기존 설정 재사용) */
  settings: {
    startDate: string;
    endDate: string;
    dailyMinutes: number;
    model: string;
    planGroupNameTemplate: string;
  };
  /** 테넌트 ID */
  tenantId: string;
}

// ============================================
// 재시도 결과 타입
// ============================================

/**
 * 재시도 결과
 */
export interface BatchRetryResult {
  success: boolean;
  /** 학생별 결과 */
  results: StudentPlanResult[];
  /** 요약 */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    totalPlans: number;
    totalCost: number;
  };
  error?: string;
}

// ============================================
// UI 상태 타입
// ============================================

/**
 * 재시도 선택 상태
 */
export interface RetrySelectionState {
  /** 선택된 학생 ID 목록 */
  selectedIds: string[];
  /** 재시도 가능한 학생 목록 (실패/건너뜀) */
  retryableStudents: RetryStudent[];
}
