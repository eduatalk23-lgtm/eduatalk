/**
 * Today Domain Transactions
 *
 * 플랜 완료 등 다중 테이블 업데이트가 필요한 작업의
 * 원자적 트랜잭션 처리를 위한 RPC 래퍼 함수들
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { timerLogger } from "./logger";

/**
 * 각 플랜별 업데이트 데이터
 */
export interface PlanUpdateData {
  id: string;
  paused_duration_seconds: number;
  pause_count: number;
}

/**
 * 플랜 완료 트랜잭션 입력
 */
export interface CompletePlanAtomicInput {
  planId: string;
  studentId: string;
  planIds: string[]; // 같은 plan_number를 가진 모든 플랜 ID
  actualEndTime: string; // ISO timestamp
  planUpdates: PlanUpdateData[]; // 각 플랜별 업데이트 데이터
}

/**
 * 플랜 완료 트랜잭션 결과
 */
export interface CompletePlanAtomicResult {
  success: boolean;
  closedSessions?: number;
  updatedPlans?: number;
  error?: string;
  errorCode?: string;
}

/**
 * 플랜 완료 원자적 트랜잭션
 *
 * 세션 종료와 플랜 상태 업데이트를 하나의 트랜잭션으로 처리하여
 * 데이터 정합성을 보장합니다.
 *
 * @param input 트랜잭션 입력 데이터
 * @returns 트랜잭션 결과
 */
export async function completePlanAtomic(
  input: CompletePlanAtomicInput
): Promise<CompletePlanAtomicResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("complete_plan_atomic", {
    p_plan_id: input.planId,
    p_student_id: input.studentId,
    p_plan_ids: input.planIds,
    p_actual_end_time: input.actualEndTime,
    p_plan_updates: input.planUpdates,
  });

  if (error) {
    timerLogger.error("completePlanAtomic RPC 호출 실패", {
      action: "completePlanAtomic",
      id: input.planId,
      error,
    });
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
    };
  }

  // RPC 함수 결과 파싱
  const result = data as {
    success: boolean;
    closed_sessions?: number;
    updated_plans?: number;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    timerLogger.error("completePlanAtomic 트랜잭션 실패", {
      action: "completePlanAtomic",
      id: input.planId,
      data: { error: result.error, code: result.code },
    });
    return {
      success: false,
      error: result.error || "트랜잭션 실패",
      errorCode: result.code,
    };
  }

  timerLogger.info("completePlanAtomic 트랜잭션 성공", {
    action: "completePlanAtomic",
    id: input.planId,
    data: {
      closedSessions: result.closed_sessions,
      updatedPlans: result.updated_plans,
    },
  });

  return {
    success: true,
    closedSessions: result.closed_sessions,
    updatedPlans: result.updated_plans,
  };
}
