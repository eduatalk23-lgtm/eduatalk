/**
 * 재조정 롤백 Server Actions
 * 
 * 재조정을 롤백하여 이전 상태로 복원합니다.
 * 
 * @module app/(student)/actions/plan-groups/rollback
 */

"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { validateRollback } from "@/lib/reschedule/rollbackValidator";
import { executeRescheduleTransaction } from "@/lib/reschedule/transaction";

// ============================================
// 타입 정의
// ============================================

/**
 * 롤백 결과
 */
export interface RollbackResult {
  success: boolean;
  restoredPlans: number;
  canceledPlans: number;
  error?: string;
}

// ============================================
// 롤백 실행 함수
// ============================================

/**
 * 재조정 롤백 실행
 * 
 * 재조정 로그에 연결된 새 플랜을 비활성화하고,
 * plan_history에 백업된 플랜을 다시 활성화합니다.
 * 
 * @param rescheduleLogId 재조정 로그 ID
 * @returns 롤백 결과
 */
async function _rollbackReschedule(
  rescheduleLogId: string
): Promise<RollbackResult> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  // 1. 재조정 로그 조회
  const { data: log, error: logError } = await supabase
    .from("reschedule_log")
    .select("*")
    .eq("id", rescheduleLogId)
    .single();

  if (logError || !log) {
    throw new AppError(
      "재조정 로그를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 2. 권한 확인 (학생이 자신의 플랜만 롤백 가능)
  if (log.student_id !== user.userId) {
      throw new AppError(
        "권한이 없습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // 3. 롤백 가능 여부 검증
    const validation = await validateRollback(supabase, rescheduleLogId);
    if (!validation.canRollback) {
      throw new AppError(
        validation.reason || "롤백할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 4. 트랜잭션으로 롤백 실행
    return executeRescheduleTransaction(log.plan_group_id, async (txSupabase) => {
      // 4-1. 재조정 후 생성된 새 플랜 조회 및 비활성화
      const { data: newPlans, error: newPlansError } = await txSupabase
        .from("student_plan")
        .select("id")
        .eq("plan_group_id", log.plan_group_id)
        .eq("student_id", log.student_id)
        .eq("is_active", true)
        .gte("created_at", log.created_at); // 재조정 이후 생성된 플랜

      if (newPlansError) {
        throw new AppError(
          `새 플랜 조회 실패: ${newPlansError.message}`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      const newPlanIds = (newPlans || []).map((p) => p.id);
      let canceledCount = 0;

      if (newPlanIds.length > 0) {
        // 새 플랜 비활성화 및 취소
        const { error: cancelError } = await txSupabase
          .from("student_plan")
          .update({
            is_active: false,
            status: "canceled",
          })
          .in("id", newPlanIds);

        if (cancelError) {
          throw new AppError(
            `새 플랜 비활성화 실패: ${cancelError.message}`,
            ErrorCode.DATABASE_ERROR,
            500,
            true
          );
        }

        canceledCount = newPlanIds.length;
      }

      // 4-2. plan_history에서 백업된 플랜 조회
      const { data: histories, error: historyError } = await txSupabase
        .from("plan_history")
        .select("plan_data, plan_id")
        .eq("reschedule_log_id", rescheduleLogId);

      if (historyError) {
        throw new AppError(
          `히스토리 조회 실패: ${historyError.message}`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      if (!histories || histories.length === 0) {
        // 백업된 플랜이 없으면 새 플랜만 비활성화하고 종료
        return {
          success: true,
          restoredPlans: 0,
          canceledPlans: canceledCount,
        };
      }

      // 4-3. 백업된 플랜 복원
      const restoredPlans: any[] = [];
      for (const history of histories) {
        const planData = history.plan_data;
        if (!planData || !planData.id) {
          continue; // 유효하지 않은 데이터 스킵
        }

        // 기존 플랜이 여전히 존재하는지 확인
        const { data: existingPlan } = await txSupabase
          .from("student_plan")
          .select("id, is_active")
          .eq("id", planData.id)
          .maybeSingle();

        if (existingPlan) {
          // 기존 플랜이 있으면 활성화
          const { error: restoreError } = await txSupabase
            .from("student_plan")
            .update({
              is_active: true,
              status: planData.status || "pending", // 원래 상태 복원
            })
            .eq("id", planData.id);

          if (restoreError) {
            console.error(
              `[rollback] 플랜 복원 실패 (${planData.id}):`,
              restoreError
            );
            continue; // 개별 실패는 로그만 남기고 계속 진행
          }

          restoredPlans.push(planData.id);
        } else {
          // 기존 플랜이 없으면 새로 생성 (삭제된 경우)
          const { id, ...planDataWithoutId } = planData;
          const { error: insertError } = await txSupabase
            .from("student_plan")
            .insert({
              ...planDataWithoutId,
              is_active: true,
              status: planData.status || "pending",
            });

          if (insertError) {
            console.error(
              `[rollback] 플랜 재생성 실패 (${planData.id}):`,
              insertError
            );
            continue;
          }

          restoredPlans.push(planData.id);
        }
      }

      // 4-4. 재조정 로그 상태 업데이트
      const { error: updateLogError } = await txSupabase
        .from("reschedule_log")
        .update({
          status: "rolled_back",
          rolled_back_at: new Date().toISOString(),
        })
        .eq("id", rescheduleLogId);

      if (updateLogError) {
        console.error("[rollback] 로그 상태 업데이트 실패:", updateLogError);
        // 로그 업데이트 실패는 치명적이지 않으므로 계속 진행
      }

      return {
        success: true,
        restoredPlans: restoredPlans.length,
        canceledPlans: canceledCount,
      };
    });
}

export const rollbackReschedule = withErrorHandling(_rollbackReschedule);

