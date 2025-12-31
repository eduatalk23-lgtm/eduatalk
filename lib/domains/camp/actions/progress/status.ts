"use server";

/**
 * 캠프 플랜 그룹 상태 관련 함수
 * - updateCampPlanGroupSubjectAllocations: 전략과목/취약과목 설정 업데이트
 * - updateCampPlanGroupStatus: 단일 상태 변경
 * - batchUpdateCampPlanGroupStatus: 일괄 상태 변경
 */

import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  AppError,
  ErrorCode,
  withErrorHandling,
} from "@/lib/errors";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanStatus } from "@/lib/types/plan";
import type { PlanGroupSchedulerOptions } from "@/lib/types/schedulerSettings";
import { logError } from "@/lib/errors/handler";

/**
 * 관리자용 캠프 플랜 그룹 전략과목/취약과목 설정 업데이트
 */
export const updateCampPlanGroupSubjectAllocations = withErrorHandling(
  async (
    groupId: string,
    subjectAllocations: Array<{
      subject_id: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }> | null
  ) => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 존재 및 권한 확인
    const { data: group, error: groupError } = await supabase
      .from("plan_groups")
      .select("id, plan_type, tenant_id")
      .eq("id", groupId)
      .eq("tenant_id", tenantContext.tenantId)
      .maybeSingle();

    if (groupError || !group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (group.plan_type !== "camp") {
      throw new AppError(
        "캠프 플랜 그룹이 아닙니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // scheduler_options 업데이트 (subject_allocations 포함)
    const { data: currentGroup } = await supabase
      .from("plan_groups")
      .select("scheduler_options")
      .eq("id", groupId)
      .maybeSingle();

    const currentSchedulerOptions =
      (currentGroup?.scheduler_options as PlanGroupSchedulerOptions | null) || {};
    const updatedSchedulerOptions = {
      ...currentSchedulerOptions,
      subject_allocations: subjectAllocations,
    };

    const { error: updateError } = await supabase
      .from("plan_groups")
      .update({
        scheduler_options: updatedSchedulerOptions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (updateError) {
      throw new AppError(
        "전략과목/취약과목 설정 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: updateError.message }
      );
    }

    return { success: true };
  }
);

/**
 * 관리자용 캠프 플랜 그룹 상태 변경 (단일)
 */
export const updateCampPlanGroupStatus = withErrorHandling(
  async (
    groupId: string,
    status: string
  ): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 존재 및 권한 확인
    const { data: group, error: groupError } = await supabase
      .from("plan_groups")
      .select("id, student_id, plan_type, tenant_id, status, camp_template_id")
      .eq("id", groupId)
      .eq("tenant_id", tenantContext.tenantId)
      .maybeSingle();

    if (groupError || !group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (group.plan_type !== "camp") {
      throw new AppError(
        "캠프 플랜 그룹이 아닙니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 상태 전이 검증
    const { PlanValidator } = await import("@/lib/validation/planValidator");
    const statusValidation = PlanValidator.validateStatusTransition(
      group.status as PlanStatus,
      status as PlanStatus
    );
    if (!statusValidation.valid) {
      throw new AppError(
        statusValidation.errors.join(", ") || "상태 전이가 불가능합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // active로 변경 시 플랜 생성 여부 확인
    if (status === "active") {
      const { count, error: plansError } = await supabase
        .from("student_plan")
        .select("*", { count: "exact", head: true })
        .eq("plan_group_id", groupId);

      if (plansError) {
        logError(plansError, {
          function: "updateCampPlanGroupStatus",
          groupId,
          action: "checkPlanCount",
        });
        throw new AppError(
          "플랜 개수 확인에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      if ((count ?? 0) === 0) {
        throw new AppError(
          "플랜이 생성되지 않은 플랜 그룹은 활성화할 수 없습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }

      // 활성화 시 같은 모드(캠프 모드)의 다른 활성 플랜 그룹만 비활성화
      // 일반 모드와 캠프 모드는 각각 1개씩 활성화 가능
      // 이 함수는 캠프 플랜 그룹 활성화이므로, 캠프 모드 활성 플랜 그룹만 비활성화
      const { data: allActiveGroups, error: activeGroupsError } = await supabase
        .from("plan_groups")
        .select("id, plan_type, camp_template_id, camp_invitation_id")
        .eq("student_id", group.student_id)
        .eq("status", "active")
        .neq("id", groupId)
        .is("deleted_at", null);

      if (activeGroupsError) {
        logError(
          activeGroupsError,
          {
            function: "updateCampPlanGroupStatus",
            message: "활성 플랜 그룹 조회 실패",
          }
        );
      } else if (allActiveGroups && allActiveGroups.length > 0) {
        // 캠프 모드 활성 플랜 그룹만 필터링
        const campModeGroups = allActiveGroups.filter(
          (g) =>
            g.plan_type === "camp" ||
            g.camp_template_id !== null ||
            g.camp_invitation_id !== null
        );

        if (campModeGroups.length > 0) {
          // 같은 모드(캠프 모드)의 다른 활성 플랜 그룹들을 "saved" 상태로 변경
          const activeGroupIds = campModeGroups.map((g) => g.id);
          const { error: deactivateError } = await supabase
            .from("plan_groups")
            .update({ status: "saved", updated_at: new Date().toISOString() })
            .in("id", activeGroupIds);

          if (deactivateError) {
            logError(
              deactivateError,
              {
                function: "updateCampPlanGroupStatus",
                message: "같은 모드(캠프 모드)의 다른 활성 플랜 그룹 비활성화 실패",
              }
            );
            // 비활성화 실패해도 계속 진행 (경고만)
          }
        }
      }
    }

    // 상태 업데이트
    const { error: updateError } = await supabase
      .from("plan_groups")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (updateError) {
      throw new AppError(
        "플랜 그룹 상태 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: updateError.message }
      );
    }

    return { success: true };
  }
);

/**
 * 관리자용 캠프 플랜 그룹 상태 일괄 변경
 */
export const batchUpdateCampPlanGroupStatus = withErrorHandling(
  async (
    groupIds: string[],
    status: string
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ groupId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      throw new AppError(
        "플랜 그룹을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 중복 제거
    const uniqueGroupIds = Array.from(new Set(groupIds));

    const supabase = await createSupabaseServerClient();

    // 모든 플랜 그룹 조회 및 권한 확인
    const { data: groups, error: groupsError } = await supabase
      .from("plan_groups")
      .select("id, student_id, plan_type, tenant_id, status, camp_template_id")
      .in("id", uniqueGroupIds)
      .eq("tenant_id", tenantContext.tenantId);

    if (groupsError) {
      throw new AppError(
        "플랜 그룹 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: groupsError.message }
      );
    }

    if (!groups || groups.length === 0) {
      throw new AppError(
        "선택한 플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 캠프 플랜 그룹인지 확인
    const invalidGroups = groups.filter((g) => g.plan_type !== "camp");
    if (invalidGroups.length > 0) {
      throw new AppError(
        "캠프 플랜 그룹이 아닌 항목이 포함되어 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // active로 변경 시 플랜 생성 여부 일괄 확인
    if (status === "active") {
      const { data: plansData, error: plansError } = await supabase
        .from("student_plan")
        .select("plan_group_id")
        .in("plan_group_id", uniqueGroupIds);

      if (plansError) {
        logError(
          plansError,
          {
            function: "batchUpdateCampPlanGroupStatus",
            message: "플랜 개수 일괄 확인 실패",
          }
        );
        throw new AppError(
          "플랜 개수 확인에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      // 플랜 그룹별 플랜 존재 여부 매핑
      const plansMap = new Set((plansData || []).map((p) => p.plan_group_id));
      const groupsWithoutPlans = groups.filter((g) => !plansMap.has(g.id));

      if (groupsWithoutPlans.length > 0) {
        throw new AppError(
          `플랜이 생성되지 않은 플랜 그룹이 ${groupsWithoutPlans.length}개 있습니다.`,
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }

      // 활성화 시 각 학생별로 다른 활성 플랜 그룹 비활성화
      const studentIds = Array.from(new Set(groups.map((g) => g.student_id)));
      for (const studentId of studentIds) {
        const studentGroups = groups.filter((g) => g.student_id === studentId);
        const studentGroupIds = new Set(studentGroups.map((g) => g.id));

        // 해당 학생의 모든 활성 플랜 그룹 조회
        const { data: allActiveGroups } = await supabase
          .from("plan_groups")
          .select("id")
          .eq("student_id", studentId)
          .eq("status", "active")
          .is("deleted_at", null);

        if (allActiveGroups && allActiveGroups.length > 0) {
          // 현재 선택한 그룹을 제외한 다른 활성 플랜 그룹들만 필터링
          const otherActiveGroupIds = allActiveGroups
            .map((g) => g.id)
            .filter((id) => !studentGroupIds.has(id));

          if (otherActiveGroupIds.length > 0) {
            // 다른 활성 플랜 그룹들을 "saved" 상태로 변경
            await supabase
              .from("plan_groups")
              .update({ status: "saved", updated_at: new Date().toISOString() })
              .in("id", otherActiveGroupIds);
            // 에러는 무시 (경고만)
          }
        }
      }
    }

    // 각 그룹에 대한 상태 전이 검증 및 일괄 업데이트
    const { PlanValidator } = await import("@/lib/validation/planValidator");
    const errors: Array<{ groupId: string; error: string }> = [];
    const successGroupIds: string[] = [];

    for (const group of groups) {
      const statusValidation = PlanValidator.validateStatusTransition(
        group.status as PlanStatus,
        status as PlanStatus
      );

      if (!statusValidation.valid) {
        errors.push({
          groupId: group.id,
          error:
            statusValidation.errors.join(", ") || "상태 전이가 불가능합니다.",
        });
        continue;
      }

      successGroupIds.push(group.id);
    }

    // 성공한 그룹들만 일괄 업데이트
    let successCount = 0;
    if (successGroupIds.length > 0) {
      const { error: updateError } = await supabase
        .from("plan_groups")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .in("id", successGroupIds);

      if (updateError) {
        // 일괄 업데이트 실패 시 개별 업데이트 시도
        logError(
          updateError,
          {
            function: "batchUpdateCampPlanGroupStatus",
            message: "일괄 상태 업데이트 실패, 개별 업데이트 시도",
          }
        );

        for (const groupId of successGroupIds) {
          const { error: individualError } = await supabase
            .from("plan_groups")
            .update({
              status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", groupId);

          if (individualError) {
            errors.push({
              groupId,
              error: individualError.message || "상태 업데이트에 실패했습니다.",
            });
          } else {
            successCount++;
          }
        }
      } else {
        successCount = successGroupIds.length;
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);
