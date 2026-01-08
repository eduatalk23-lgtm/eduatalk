"use server";

/**
 * 플래너 검증 유틸리티
 *
 * 모든 플랜 생성 액션에서 플래너 검증을 위해 사용
 * 플래너 존재 여부, 상태, 권한 등을 검사
 *
 * @module lib/domains/admin-plan/actions/planCreation/validatePlanner
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlannerValidationResult, ValidatedPlanner } from "./types";

/**
 * 플래너를 검증하고 플랜 생성에 필요한 설정을 반환
 *
 * @param plannerId - 검증할 플래너 ID
 * @param tenantId - 테넌트 ID (격리 확인용)
 * @returns 검증 결과 및 플래너 설정
 *
 * @example
 * ```ts
 * const result = await validatePlanner(plannerId, tenantId);
 * if (!result.success) {
 *   return { success: false, error: result.error };
 * }
 * // result.planner를 사용하여 플랜 생성
 * ```
 */
export async function validatePlanner(
  plannerId: string,
  tenantId: string
): Promise<PlannerValidationResult> {
  // 입력 검증
  if (!plannerId || plannerId.trim() === "") {
    return {
      success: false,
      error: "플래너 ID가 필요합니다.",
    };
  }

  if (!tenantId || tenantId.trim() === "") {
    return {
      success: false,
      error: "테넌트 ID가 필요합니다.",
    };
  }

  const supabase = await createSupabaseServerClient();

  // 플래너 조회 (삭제되지 않은 것만)
  const { data: planner, error } = await supabase
    .from("planners")
    .select(
      `
      id,
      tenant_id,
      name,
      status,
      period_start,
      period_end,
      block_set_id,
      default_scheduler_type,
      default_scheduler_options,
      study_hours,
      self_study_hours,
      lunch_time,
      non_study_time_blocks,
      deleted_at
    `
    )
    .eq("id", plannerId)
    .is("deleted_at", null)
    .single();

  if (error || !planner) {
    console.error("[validatePlanner] 플래너 조회 실패:", {
      plannerId,
      tenantId,
      error: error?.message,
    });
    return {
      success: false,
      error: "플래너를 찾을 수 없습니다. 먼저 플래너를 선택해주세요.",
    };
  }

  // 테넌트 격리 확인
  if (planner.tenant_id !== tenantId) {
    console.error("[validatePlanner] 테넌트 불일치:", {
      plannerId,
      plannerTenantId: planner.tenant_id,
      requestTenantId: tenantId,
    });
    return {
      success: false,
      error: "해당 플래너에 접근 권한이 없습니다.",
    };
  }

  // 상태 확인
  if (planner.status === "archived") {
    return {
      success: false,
      error: "보관된 플래너로는 플랜을 생성할 수 없습니다.",
    };
  }

  if (planner.status === "completed") {
    return {
      success: false,
      error: "완료된 플래너로는 새 플랜을 생성할 수 없습니다.",
    };
  }

  // 검증된 플래너 정보 반환
  const validatedPlanner: ValidatedPlanner = {
    id: planner.id,
    name: planner.name,
    status: planner.status,
    periodStart: planner.period_start,
    periodEnd: planner.period_end,
    blockSetId: planner.block_set_id,
    defaultSchedulerType: planner.default_scheduler_type ?? "even",
    defaultSchedulerOptions: planner.default_scheduler_options ?? {},
    studyHours: planner.study_hours,
    selfStudyHours: planner.self_study_hours,
    lunchTime: planner.lunch_time,
    nonStudyTimeBlocks: planner.non_study_time_blocks ?? [],
  };

  return {
    success: true,
    planner: validatedPlanner,
  };
}

/**
 * 플래너가 특정 학생에게 속하는지 확인
 *
 * @param plannerId - 플래너 ID
 * @param studentId - 학생 ID
 * @returns 검증 결과
 */
export async function validatePlannerOwnership(
  plannerId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!plannerId || !studentId) {
    return {
      success: false,
      error: "플래너 ID와 학생 ID가 필요합니다.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: planner, error } = await supabase
    .from("planners")
    .select("id, student_id")
    .eq("id", plannerId)
    .is("deleted_at", null)
    .single();

  if (error || !planner) {
    return {
      success: false,
      error: "플래너를 찾을 수 없습니다.",
    };
  }

  if (planner.student_id !== studentId) {
    return {
      success: false,
      error: "해당 플래너는 이 학생에게 속하지 않습니다.",
    };
  }

  return { success: true };
}

/**
 * 플래너의 기간이 유효한지 확인
 *
 * @param plannerId - 플래너 ID
 * @param targetDate - 확인할 날짜
 * @returns 검증 결과
 */
export async function validatePlannerPeriod(
  plannerId: string,
  targetDate: string
): Promise<{ success: boolean; error?: string; isWithinPeriod?: boolean }> {
  const supabase = await createSupabaseServerClient();

  const { data: planner, error } = await supabase
    .from("planners")
    .select("period_start, period_end")
    .eq("id", plannerId)
    .is("deleted_at", null)
    .single();

  if (error || !planner) {
    return {
      success: false,
      error: "플래너를 찾을 수 없습니다.",
    };
  }

  const target = new Date(targetDate);
  const start = new Date(planner.period_start);
  const end = new Date(planner.period_end);

  const isWithinPeriod = target >= start && target <= end;

  return {
    success: true,
    isWithinPeriod,
  };
}
