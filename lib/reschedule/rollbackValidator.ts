/**
 * 롤백 검증 유틸리티
 * 
 * 재조정 롤백 가능 여부를 검증합니다.
 * 
 * @module lib/reschedule/rollbackValidator
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isRollbackable } from '@/lib/utils/planStatusUtils';

// ============================================
// 타입 정의
// ============================================

/**
 * 롤백 차단 요인
 */
export interface RollbackBlocker {
  planId: string;
  status: string;
  reason: string;
}

/**
 * 롤백 검증 결과
 */
export interface RollbackValidation {
  canRollback: boolean;
  reason?: string;
  blockers?: RollbackBlocker[];
}

// ============================================
// 검증 함수
// ============================================

/**
 * 롤백 가능 여부 검증
 * 
 * 재조정 로그에 연결된 새 플랜들이 모두 롤백 가능한 상태인지 확인합니다.
 * 
 * 롤백 가능 조건:
 * - 새 플랜 중 status가 'pending'인 것만 (아직 시작하지 않음)
 * - 새 플랜 중 status가 'in_progress' 또는 'completed'가 있으면 롤백 불가
 * 
 * @param supabase Supabase 클라이언트
 * @param rescheduleLogId 재조정 로그 ID
 * @returns 롤백 검증 결과
 */
export async function validateRollback(
  supabase: SupabaseClient,
  rescheduleLogId: string
): Promise<RollbackValidation> {
  try {
    // 1. 재조정 로그 조회
    const { data: log, error: logError } = await supabase
      .from('reschedule_log')
      .select('*')
      .eq('id', rescheduleLogId)
      .single();

    if (logError || !log) {
      return {
        canRollback: false,
        reason: '재조정 로그를 찾을 수 없습니다.',
      };
    }

    // 2. 이미 롤백된 경우
    if (log.status === 'rolled_back') {
      return {
        canRollback: false,
        reason: '이미 롤백된 재조정입니다.',
      };
    }

    // 3. 재조정 로그에 연결된 plan_history 조회
    const { data: histories, error: historyError } = await supabase
      .from('plan_history')
      .select('plan_id')
      .eq('reschedule_log_id', rescheduleLogId);

    if (historyError) {
      console.error('[rollbackValidator] plan_history 조회 실패:', historyError);
      return {
        canRollback: false,
        reason: '히스토리 조회에 실패했습니다.',
      };
    }

    if (!histories || histories.length === 0) {
      return {
        canRollback: false,
        reason: '롤백할 플랜이 없습니다.',
      };
    }

    // 4. 재조정 후 생성된 새 플랜 조회
    // plan_history에 백업된 플랜의 plan_id를 기반으로
    // 같은 plan_group_id에서 새로 생성된 플랜을 찾아야 함
    // 하지만 현재 구조에서는 직접적인 연결이 없으므로,
    // reschedule_log의 plan_group_id와 created_at을 기준으로 조회

    const { data: newPlans, error: plansError } = await supabase
      .from('student_plan')
      .select('id, status, is_active, created_at')
      .eq('plan_group_id', log.plan_group_id)
      .eq('student_id', log.student_id)
      .eq('is_active', true)
      .gte('created_at', log.created_at); // 재조정 이후 생성된 플랜

    if (plansError) {
      console.error('[rollbackValidator] 새 플랜 조회 실패:', plansError);
      return {
        canRollback: false,
        reason: '새 플랜 조회에 실패했습니다.',
      };
    }

    // 5. 롤백 불가능한 플랜 확인
    const blockers: RollbackBlocker[] = [];
    const rollbackablePlans: string[] = [];

    (newPlans || []).forEach((plan) => {
      if (isRollbackable(plan)) {
        rollbackablePlans.push(plan.id);
      } else {
        blockers.push({
          planId: plan.id,
          status: plan.status || 'unknown',
          reason: getBlockerReason(plan.status || 'unknown'),
        });
      }
    });

    // 6. 롤백 가능 여부 판단
    if (blockers.length > 0) {
      return {
        canRollback: false,
        reason: `${blockers.length}개의 플랜이 이미 시작되었거나 완료되어 롤백할 수 없습니다.`,
        blockers,
      };
    }

    // 7. 시간 제한 확인 (24시간)
    const now = new Date();
    const logCreatedAt = new Date(log.created_at);
    const hoursSinceCreation = (now.getTime() - logCreatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation > 24) {
      return {
        canRollback: false,
        reason: '재조정 후 24시간이 지나 롤백할 수 없습니다.',
      };
    }

    return {
      canRollback: true,
    };
  } catch (error) {
    console.error('[rollbackValidator] 검증 중 에러:', error);
    return {
      canRollback: false,
      reason: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
    };
  }
}

/**
 * 롤백 차단 사유 반환
 * 
 * @param status 플랜 상태
 * @returns 차단 사유
 */
function getBlockerReason(status: string): string {
  switch (status) {
    case 'in_progress':
      return '학습이 진행 중입니다.';
    case 'completed':
      return '학습이 완료되었습니다.';
    case 'canceled':
      return '플랜이 취소되었습니다.';
    default:
      return `상태: ${status}`;
  }
}

