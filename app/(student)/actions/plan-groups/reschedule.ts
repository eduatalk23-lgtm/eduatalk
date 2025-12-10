/**
 * 플랜 그룹 재조정 Server Actions
 * 
 * 재조정 기능의 미리보기 및 실행을 처리합니다.
 * 
 * @module app/(student)/actions/plan-groups/reschedule
 */

"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { executeRescheduleTransaction } from "@/lib/reschedule/transaction";
import { generatePlans, type AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import { isReschedulable } from "@/lib/utils/planStatusUtils";
import type { PlanGroup, PlanContent } from "@/lib/types/plan";

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 미리보기 결과
 */
export interface ReschedulePreviewResult {
  plans_before_count: number;
  plans_after_count: number;
  affected_dates: string[];
  estimated_hours: number;
  adjustments_summary: {
    range_changes: number;
    replacements: number;
    full_regenerations: number;
  };
}

/**
 * 재조정 실행 결과
 */
export interface RescheduleResult {
  success: boolean;
  reschedule_log_id: string;
  plans_before_count: number;
  plans_after_count: number;
  error?: string;
}

// ============================================
// 미리보기 함수
// ============================================

/**
 * 재조정 미리보기
 * 
 * DB에 변경을 적용하지 않고 재조정 결과를 미리 확인합니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param adjustments 조정 요청 목록
 * @param dateRange 날짜 범위 (선택, null이면 전체 재생성)
 * @returns 미리보기 결과
 */
export async function getReschedulePreview(
  groupId: string,
  adjustments: AdjustmentInput[],
  dateRange?: { from: string; to: string } | null
): Promise<ReschedulePreviewResult> {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const tenantContext = await requireTenantContext();
    const supabase = await createSupabaseServerClient();

    // 1. 플랜 그룹 및 콘텐츠 조회
    const { data: group } = await supabase
      .from("plan_groups")
      .select("*")
      .eq("id", groupId)
      .eq("tenant_id", tenantContext.tenantId)
      .single();

    if (!group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 2. 플랜 콘텐츠 조회
    const { data: contents } = await supabase
      .from("plan_contents")
      .select("*")
      .eq("plan_group_id", groupId)
      .order("display_order");

    if (!contents || contents.length === 0) {
      throw new AppError(
        "플랜 콘텐츠를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 3. 기존 플랜 수 조회 (재조정 대상만)
    let query = supabase
      .from("student_plan")
      .select("id, status, is_active, plan_date")
      .eq("plan_group_id", groupId)
      .eq("student_id", group.student_id);

    // 날짜 범위 필터링 (선택한 경우)
    if (dateRange?.from && dateRange?.to) {
      query = query.gte("plan_date", dateRange.from).lte("plan_date", dateRange.to);
    }

    const { data: existingPlans } = await query;

    const reschedulablePlans = (existingPlans || []).filter((plan) =>
      isReschedulable(plan)
    );

    // 4. 스케줄 엔진으로 플랜 생성 (미리보기)
    // TODO: 실제 플랜 생성 로직 통합 필요
    const result = generatePlans({
      group: group as PlanGroup,
      contents: contents as PlanContent[],
      adjustments,
    });

    // 5. 결과 반환
    return {
      plans_before_count: reschedulablePlans.length,
      plans_after_count: result.summary.total_plans,
      affected_dates: result.summary.affected_dates,
      estimated_hours: result.summary.estimated_hours,
      adjustments_summary: {
        range_changes: adjustments.filter((a) => a.change_type === "range")
          .length,
        replacements: adjustments.filter((a) => a.change_type === "replace")
          .length,
        full_regenerations: adjustments.filter(
          (a) => a.change_type === "full"
        ).length,
      },
    };
  });
}

// ============================================
// 실행 함수
// ============================================

/**
 * 재조정 실행
 * 
 * 실제로 재조정을 수행하고 DB에 반영합니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param adjustments 조정 요청 목록
 * @param reason 재조정 사유 (선택)
 * @param dateRange 날짜 범위 (선택, null이면 전체 재생성)
 * @returns 실행 결과
 */
export async function rescheduleContents(
  groupId: string,
  adjustments: AdjustmentInput[],
  reason?: string,
  dateRange?: { from: string; to: string } | null
): Promise<RescheduleResult> {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const tenantContext = await requireTenantContext();

    return executeRescheduleTransaction(groupId, async (supabase) => {
      // 1. 플랜 그룹 및 콘텐츠 조회
      const { data: group } = await supabase
        .from("plan_groups")
        .select("*")
        .eq("id", groupId)
        .eq("tenant_id", tenantContext.tenantId)
        .single();

      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }

      // 2. 기존 플랜 조회 (재조정 대상만)
      let query = supabase
        .from("student_plan")
        .select("*")
        .eq("plan_group_id", groupId)
        .eq("student_id", group.student_id);

      // 날짜 범위 필터링 (선택한 경우)
      if (dateRange?.from && dateRange?.to) {
        query = query.gte("plan_date", dateRange.from).lte("plan_date", dateRange.to);
      }

      const { data: existingPlans } = await query;

      const reschedulablePlans = (existingPlans || []).filter((plan) =>
        isReschedulable(plan)
      );

      const plansBeforeCount = reschedulablePlans.length;

      // 3. 기존 플랜 히스토리 백업
      const planHistoryInserts = reschedulablePlans.map((plan) => ({
        plan_id: plan.id,
        plan_group_id: groupId,
        plan_data: plan as any, // 전체 플랜 데이터 스냅샷
        content_id: plan.content_id,
        adjustment_type: "full" as const, // TODO: 실제 조정 유형에 맞게 수정
      }));

      // 4. 재조정 로그 생성 (임시 ID)
      const tempLogId = crypto.randomUUID();

      // 5. 히스토리 저장 (reschedule_log_id는 나중에 업데이트)
      if (planHistoryInserts.length > 0) {
        const { error: historyError } = await supabase
          .from("plan_history")
          .insert(planHistoryInserts);

        if (historyError) {
          throw new AppError(
            `플랜 히스토리 저장 실패: ${historyError.message}`,
            ErrorCode.DATABASE_ERROR,
            500,
            true
          );
        }
      }

      // 6. 기존 플랜 비활성화
      const planIds = reschedulablePlans.map((p) => p.id);
      if (planIds.length > 0) {
        const { error: deactivateError } = await supabase
          .from("student_plan")
          .update({ is_active: false })
          .in("id", planIds);

        if (deactivateError) {
          throw new AppError(
            `기존 플랜 비활성화 실패: ${deactivateError.message}`,
            ErrorCode.DATABASE_ERROR,
            500,
            true
          );
        }
      }

      // 7. 새 플랜 생성
      // TODO: 실제 플랜 생성 로직 통합 필요
      // generatePlansFromGroup 함수를 호출하여 새 플랜 생성
      // 날짜 범위가 지정된 경우, 생성된 플랜 중 선택한 날짜 범위의 플랜만 저장
      // 현재는 필터링 로직만 완료, 실제 생성은 별도 작업으로 분리
      const plansAfterCount = 0; // TODO: 실제 생성된 플랜 수
      
      // 날짜 범위가 지정된 경우, 해당 범위의 플랜만 생성하도록 필터링
      // 실제 구현 시: generatePlansFromGroup 호출 후 날짜 범위 필터링 적용

      // 8. 재조정 로그 저장
      const { data: rescheduleLog, error: logError } = await supabase
        .from("reschedule_log")
        .insert({
          plan_group_id: groupId,
          student_id: group.student_id,
          adjusted_contents: adjustments as any,
          plans_before_count: plansBeforeCount,
          plans_after_count: plansAfterCount,
          reason: reason || null,
          status: "completed",
        })
        .select("id")
        .single();

      if (logError || !rescheduleLog) {
        throw new AppError(
          `재조정 로그 저장 실패: ${logError?.message || "Unknown error"}`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      // 9. 히스토리와 로그 연결
      if (planHistoryInserts.length > 0) {
        const { error: updateError } = await supabase
          .from("plan_history")
          .update({ reschedule_log_id: rescheduleLog.id })
          .eq("plan_group_id", groupId)
          .is("reschedule_log_id", null);

        if (updateError) {
          console.error(
            "[reschedule] 히스토리-로그 연결 실패:",
            updateError
          );
          // 에러는 로그만 남기고 계속 진행
        }
      }

      return {
        success: true,
        reschedule_log_id: rescheduleLog.id,
        plans_before_count: plansBeforeCount,
        plans_after_count: plansAfterCount,
      };
    });
  });
}

