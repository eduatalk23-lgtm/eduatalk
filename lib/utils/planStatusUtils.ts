/**
 * 플랜 상태 관련 유틸리티 함수
 * 
 * 재조정 기능에서 플랜 상태를 판단하는 데 사용됩니다.
 * 
 * @module lib/utils/planStatusUtils
 */

// ============================================
// 타입 정의
// ============================================

/**
 * 플랜 상태 타입
 * - pending: 대기 중 (아직 시작하지 않음)
 * - in_progress: 진행 중 (시작했지만 완료하지 않음)
 * - completed: 완료됨 (학습 완료)
 * - canceled: 취소됨
 */
export type PlanStatus = 'pending' | 'in_progress' | 'completed' | 'canceled';

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
 * - status가 'pending' 또는 'in_progress'
 * - is_active가 true (또는 undefined/null)
 * 
 * @param plan 플랜 객체
 * @returns 재조정 가능 여부
 */
export function isReschedulable(plan: PlanWithStatus): boolean {
  const { status, is_active } = plan;
  
  // 완료되거나 취소된 플랜은 재조정 불가
  if (status === 'completed' || status === 'canceled') {
    return false;
  }
  
  // 비활성화된 플랜은 재조정 불가
  if (is_active === false) {
    return false;
  }
  
  // pending 또는 in_progress 상태만 재조정 가능
  return status === 'pending' || status === 'in_progress';
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
  return plan.status === 'canceled';
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
  const labels: Record<PlanStatus, string> = {
    pending: '대기',
    in_progress: '진행중',
    completed: '완료',
    canceled: '취소',
  };
  return labels[status] || status;
}

/**
 * 상태에 따른 색상 클래스 반환 (Tailwind CSS)
 * 
 * @param status 플랜 상태
 * @returns 색상 클래스
 */
export function getStatusColorClass(status: PlanStatus): string {
  const colors: Record<PlanStatus, string> = {
    pending: 'text-gray-600 bg-gray-100',
    in_progress: 'text-blue-600 bg-blue-100',
    completed: 'text-green-600 bg-green-100',
    canceled: 'text-red-600 bg-red-100',
  };
  return colors[status] || 'text-gray-600 bg-gray-100';
}

