/**
 * 플랜 상태 관련 유틸리티 함수
 * 
 * 재조정 기능에서 플랜 상태를 판단하는 데 사용됩니다.
 * 
 * @module lib/utils/planStatusUtils
 */

import type { PlanStatus } from "@/lib/types/plan";

// ============================================
// 타입 정의
// ============================================

/**
 * 플랜 상태 타입은 @/lib/types/plan에서 import합니다.
 * 
 * 사용 가능한 상태:
 * - pending: 대기 중 (아직 시작하지 않음)
 * - in_progress: 진행 중 (시작했지만 완료하지 않음)
 * - completed: 완료됨 (학습 완료)
 * - cancelled: 취소됨
 * - draft: 초안
 * - saved: 저장됨
 * - active: 활성화됨
 * - paused: 일시정지됨
 */
export type { PlanStatus };

/**
 * 플랜 상태가 포함된 객체 타입
 */
export interface PlanWithStatus {
  status: PlanStatus;
  is_active?: boolean;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
}

// ============================================
// 상태 판단 함수
// ============================================

/**
 * 재조정 대상 여부 판단
 *
 * 재조정 가능한 플랜:
 * - status가 'pending' 또는 'in_progress' (NULL은 'pending'으로 처리)
 * - is_active가 true (또는 undefined/null)
 *
 * @param plan 플랜 객체
 * @returns 재조정 가능 여부
 */
export function isReschedulable(plan: PlanWithStatus): boolean {
  const { status, is_active } = plan;

  // NULL/undefined status는 'pending'으로 간주 (신규 플랜)
  const effectiveStatus = status || 'pending';

  // 완료되거나 취소된 플랜은 재조정 불가
  if (effectiveStatus === 'completed' || effectiveStatus === 'cancelled') {
    return false;
  }

  // 비활성화된 플랜은 재조정 불가
  if (is_active === false) {
    return false;
  }

  // pending 또는 in_progress 상태만 재조정 가능
  return effectiveStatus === 'pending' || effectiveStatus === 'in_progress';
}

/**
 * 완료 플랜 여부 (재조정 제외 대상)
 * 
 * @param plan 플랜 객체
 * @returns 완료 여부
 */
export function isCompletedPlan(plan: PlanWithStatus): boolean {
  return plan.status === 'completed';
}

/**
 * 롤백 가능 여부 (새 플랜이 아직 시작하지 않음)
 * 
 * 롤백 가능 조건:
 * - status가 'pending' (아직 시작하지 않음)
 * 
 * @param plan 플랜 객체
 * @returns 롤백 가능 여부
 */
export function isRollbackable(plan: PlanWithStatus): boolean {
  return plan.status === 'pending';
}

/**
 * 진행 중 플랜 여부
 * 
 * @param plan 플랜 객체
 * @returns 진행 중 여부
 */
export function isInProgressPlan(plan: PlanWithStatus): boolean {
  return plan.status === 'in_progress';
}

/**
 * 대기 중 플랜 여부
 * 
 * @param plan 플랜 객체
 * @returns 대기 중 여부
 */
export function isPendingPlan(plan: PlanWithStatus): boolean {
  return plan.status === 'pending';
}

/**
 * 취소된 플랜 여부
 * 
 * @param plan 플랜 객체
 * @returns 취소 여부
 */
export function isCanceledPlan(plan: PlanWithStatus): boolean {
  return plan.status === 'cancelled';
}

// ============================================
// 상태 변환 함수
// ============================================

/**
 * actual_start_time과 actual_end_time을 기반으로 상태 추론
 * 
 * @param plan 플랜 객체
 * @returns 추론된 상태
 */
export function inferStatusFromTimes(plan: {
  actual_start_time?: string | null;
  actual_end_time?: string | null;
}): PlanStatus {
  if (plan.actual_end_time) {
    return 'completed';
  }
  if (plan.actual_start_time) {
    return 'in_progress';
  }
  return 'pending';
}

/**
 * 상태에 따른 한글 라벨 반환
 * 
 * @param status 플랜 상태
 * @returns 한글 라벨
 */
export function getStatusLabel(status: PlanStatus): string {
  const labels: Partial<Record<PlanStatus, string>> = {
    pending: '대기',
    in_progress: '진행중',
    completed: '완료',
    cancelled: '취소',
    draft: '초안',
    saved: '저장됨',
    active: '활성',
    paused: '일시정지',
  };
  return labels[status] || status;
}

/**
 * 상태에 따른 색상 클래스 반환 (Tailwind CSS)
 * 
 * @deprecated 이 함수는 하위 호환성을 위해 유지됩니다.
 * 새로운 코드에서는 `darkMode.ts`의 `getStatusBadgeColorClasses()`를 사용하세요.
 * 
 * @param status 플랜 상태
 * @returns 다크 모드를 포함한 색상 클래스
 */
export function getStatusColorClass(status: PlanStatus): string {
  const colors: Partial<Record<PlanStatus, string>> = {
    pending: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
    in_progress: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    completed: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    cancelled: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
    draft: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
    saved: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    active: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    paused: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
  };
  return colors[status] || 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
}

