"use server";

/**
 * Plan Group 선택 및 자동 생성 유틸리티
 *
 * 플래너에 연결된 Plan Group을 자동 선택하거나 새로 생성
 *
 * @module lib/domains/admin-plan/utils/planGroupSelector
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type { PlanGroupSelectorResult, PlanGroupInfo } from "../actions/planCreation/types";
import {
  inheritPlannerConfigFromRaw,
  type PlannerConfigRaw,
} from "./plannerConfigInheritance";

/**
 * 플래너에 연결된 활성 Plan Group 선택
 *
 * 선택 로직:
 * 1. 플래너에 연결된 모든 활성 plan_group 조회
 * 2. 1개만 존재하면 자동 선택
 * 3. 여러 개 존재하면 가장 최근 생성된 것 반환 (UI에서 선택 유도)
 * 4. 없으면 not-found 상태 반환
 *
 * @param plannerId - 플래너 ID
 * @param options - 추가 옵션
 * @returns Plan Group 선택 결과
 */
export async function selectPlanGroupForPlanner(
  plannerId: string,
  options?: {
    /** 특정 기간을 선호 */
    preferPeriod?: { start: string; end: string };
    /** 보관된 그룹도 포함 */
    includeArchived?: boolean;
    /** 학생 ID (필터링용) */
    studentId?: string;
  }
): Promise<PlanGroupSelectorResult> {
  if (!plannerId) {
    return {
      status: "error",
      message: "플래너 ID가 필요합니다.",
    };
  }

  const supabase = await createSupabaseServerClient();

  try {
    let query = supabase
      .from("plan_groups")
      .select("id, name, period_start, period_end, status, created_at")
      .eq("planner_id", plannerId);

    // 학생 ID 필터 (선택적)
    if (options?.studentId) {
      query = query.eq("student_id", options.studentId);
    }

    // 상태 필터
    if (!options?.includeArchived) {
      query = query.in("status", ["active", "draft"]);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("[selectPlanGroupForPlanner] 조회 실패:", error);
      return {
        status: "error",
        message: error.message,
      };
    }

    if (!data || data.length === 0) {
      return { status: "not-found" };
    }

    // 기간 선호 옵션이 있으면 해당 기간에 맞는 그룹 우선
    if (options?.preferPeriod) {
      const matchingGroups = data.filter((g) => {
        const groupStart = new Date(g.period_start);
        const groupEnd = new Date(g.period_end);
        const prefStart = new Date(options.preferPeriod!.start);
        const prefEnd = new Date(options.preferPeriod!.end);

        // 기간이 겹치는지 확인
        return groupStart <= prefEnd && groupEnd >= prefStart;
      });

      if (matchingGroups.length > 0) {
        return {
          status: matchingGroups.length === 1 ? "found" : "multiple",
          planGroupId: matchingGroups[0].id,
          planGroups: matchingGroups.map(mapToPlanGroupInfo),
        };
      }
    }

    // 가장 최근 그룹 반환
    return {
      status: data.length === 1 ? "found" : "multiple",
      planGroupId: data[0].id,
      planGroups: data.map(mapToPlanGroupInfo),
    };
  } catch (err) {
    console.error("[selectPlanGroupForPlanner] 예외 발생:", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "알 수 없는 오류",
    };
  }
}

/**
 * 플래너에 새 Plan Group 생성
 *
 * @param input - 생성 입력값
 * @returns 생성 결과
 */
export async function createPlanGroupForPlanner(input: {
  plannerId: string;
  studentId: string;
  tenantId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{
  success: boolean;
  planGroupId?: string;
  error?: string;
}> {
  const { plannerId, studentId, tenantId, name, periodStart, periodEnd } =
    input;

  // 입력 검증
  if (!plannerId || !studentId || !tenantId) {
    return {
      success: false,
      error: "필수 입력값이 누락되었습니다.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: "인증이 필요합니다.",
    };
  }

  try {
    // 플래너 설정 조회 (non_study_time_blocks 포함)
    const { data: planner, error: plannerError } = await supabase
      .from("planners")
      .select(
        `
        study_hours,
        self_study_hours,
        lunch_time,
        default_scheduler_type,
        default_scheduler_options,
        block_set_id,
        non_study_time_blocks
      `
      )
      .eq("id", plannerId)
      .single();

    if (plannerError || !planner) {
      return {
        success: false,
        error: "플래너를 찾을 수 없습니다.",
      };
    }

    // 플래너 제외일 조회 (periodStart 이후만)
    const { data: plannerExclusions } = await supabase
      .from("planner_exclusions")
      .select("*")
      .eq("planner_id", plannerId)
      .gte("exclusion_date", periodStart);

    // 플래너 학원일정 조회
    const { data: plannerSchedules } = await supabase
      .from("planner_academy_schedules")
      .select("*")
      .eq("planner_id", plannerId);

    // 플래너 설정을 플랜 그룹 생성용 설정으로 변환
    const inheritedConfig = inheritPlannerConfigFromRaw(planner as PlannerConfigRaw);

    // Plan Group 생성 (플래너 설정 상속)
    const { data: planGroup, error: insertError } = await supabase
      .from("plan_groups")
      .insert({
        planner_id: plannerId,
        student_id: studentId,
        tenant_id: tenantId,
        name: name,
        period_start: periodStart,
        period_end: periodEnd,
        status: "active",
        creation_mode: "calendar_only",
        // 플래너에서 설정 상속 (일관된 기본값 사용)
        ...inheritedConfig,
        // 메타데이터
        created_by: user.userId,
      })
      .select("id")
      .single();

    if (insertError || !planGroup) {
      console.error("[createPlanGroupForPlanner] 생성 실패:", insertError);
      return {
        success: false,
        error: insertError?.message ?? "Plan Group 생성에 실패했습니다.",
      };
    }

    const planGroupId = planGroup.id;

    // 플래너 제외일을 플랜 그룹에 상속
    if (plannerExclusions && plannerExclusions.length > 0) {
      const exclusionsToInsert = plannerExclusions.map((e) => ({
        tenant_id: tenantId,
        plan_group_id: planGroupId,
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type,
        reason: e.reason,
        source: "inherited",
        is_locked: false,
      }));

      const { error: exclusionError } = await supabase
        .from("plan_exclusions")
        .insert(exclusionsToInsert);

      if (exclusionError) {
        console.warn("[createPlanGroupForPlanner] 제외일 상속 실패:", exclusionError);
        // 플랜 그룹은 이미 생성되었으므로 경고만 로깅
      }
    }

    // 플래너 학원일정을 플랜 그룹에 상속
    if (plannerSchedules && plannerSchedules.length > 0) {
      const schedulesToInsert = plannerSchedules.map((s) => ({
        tenant_id: tenantId,
        plan_group_id: planGroupId,
        academy_id: s.academy_id,
        academy_name: s.academy_name,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        subject: s.subject,
        travel_time: s.travel_time,
        source: "inherited",
        is_locked: false,
      }));

      const { error: scheduleError } = await supabase
        .from("academy_schedules")
        .insert(schedulesToInsert);

      if (scheduleError) {
        console.warn("[createPlanGroupForPlanner] 학원일정 상속 실패:", scheduleError);
        // 플랜 그룹은 이미 생성되었으므로 경고만 로깅
      }
    }

    return {
      success: true,
      planGroupId: planGroupId,
    };
  } catch (err) {
    console.error("[createPlanGroupForPlanner] 예외 발생:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "알 수 없는 오류",
    };
  }
}

/**
 * 플래너의 활성 Plan Group이 있는지 확인
 *
 * @param plannerId - 플래너 ID
 * @returns 존재 여부
 */
export async function hasPlanGroupForPlanner(
  plannerId: string
): Promise<boolean> {
  const result = await selectPlanGroupForPlanner(plannerId);
  return result.status === "found" || result.status === "multiple";
}

/**
 * DB 행을 PlanGroupInfo로 변환
 */
function mapToPlanGroupInfo(row: {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
}): PlanGroupInfo {
  return {
    id: row.id,
    name: row.name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    createdAt: row.created_at,
  };
}
