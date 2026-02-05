/**
 * 플래너별 학원 일정 오버라이드 관련 함수
 *
 * 전역 학원 일정(시간관리)을 플래너/플랜그룹별로 커스터마이징할 수 있게 합니다.
 * - 'add': 전역에 없지만 이 플래너에만 추가
 * - 'remove': 전역에 있지만 이 플래너에서는 제외
 * - 'modify': 전역 일정의 시간/메타데이터 변경
 *
 * 지원하는 상위 엔티티:
 * - planner_id: 플래너 테이블 (planners)
 * - plan_group_id: 플랜 그룹 테이블 (plan_groups)
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import type {
  PlannerAcademyOverride,
  EffectiveAcademySchedule,
  AcademyOverrideType,
  AcademySchedule,
} from "@/lib/types/plan";
import { getSupabaseClient } from "./utils";
import { getStudentAcademySchedules } from "./academies";

// ============================================================================
// 공통 타입
// ============================================================================

type OverrideParent =
  | { type: "planner"; id: string }
  | { type: "plan_group"; id: string };

type AcademyOverrideInput = {
  source_schedule_id?: string | null;
  override_type: AcademyOverrideType;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  academy_name?: string | null;
  subject?: string | null;
  travel_time?: number | null;
  reason?: string | null;
};

// ============================================================================
// 플랜 그룹용 함수 (기존 패턴과 일관성 유지)
// ============================================================================

/**
 * 플랜 그룹 학원 일정 오버라이드 조회
 */
export async function getAcademyOverrides(
  planGroupId: string,
  options?: { useAdminClient?: boolean }
): Promise<PlannerAcademyOverride[]> {
  return getOverridesInternal({ type: "plan_group", id: planGroupId }, options);
}

/**
 * 플랜 그룹의 실제 적용될 학원 일정 계산
 */
export async function getEffectiveAcademySchedules(
  planGroupId: string,
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveAcademySchedule[]> {
  return getEffectiveAcademySchedulesInternal(
    { type: "plan_group", id: planGroupId },
    studentId,
    tenantId,
    options
  );
}

/**
 * 플랜 그룹 학원 일정 오버라이드 저장 (기존 오버라이드 교체)
 */
export async function saveAcademyOverrides(
  planGroupId: string,
  overrides: AcademyOverrideInput[],
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return saveOverridesInternal({ type: "plan_group", id: planGroupId }, overrides, options);
}

/**
 * 단일 플랜 그룹 학원 일정 오버라이드 추가/업데이트 (upsert)
 */
export async function upsertAcademyOverride(
  planGroupId: string,
  override: AcademyOverrideInput,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return upsertOverrideInternal({ type: "plan_group", id: planGroupId }, override, options);
}

/**
 * 단일 플랜 그룹 학원 일정 오버라이드 삭제
 */
export async function deleteAcademyOverride(
  planGroupId: string,
  overrideId: string,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return deleteOverrideInternal({ type: "plan_group", id: planGroupId }, overrideId, options);
}

/**
 * 플랜 그룹 학원 일정 오버라이드가 있는지 확인
 */
export async function hasAcademyOverrides(
  planGroupId: string,
  options?: { useAdminClient?: boolean }
): Promise<boolean> {
  return hasOverridesInternal({ type: "plan_group", id: planGroupId }, options);
}

// ============================================================================
// 플래너(Planner)용 함수
// ============================================================================

/**
 * 플래너 학원 일정 오버라이드 조회
 */
export async function getAcademyOverridesForPlanner(
  plannerId: string,
  options?: { useAdminClient?: boolean }
): Promise<PlannerAcademyOverride[]> {
  return getOverridesInternal({ type: "planner", id: plannerId }, options);
}

/**
 * 플래너의 실제 적용될 학원 일정 계산
 */
export async function getEffectiveAcademySchedulesForPlanner(
  plannerId: string,
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveAcademySchedule[]> {
  return getEffectiveAcademySchedulesInternal(
    { type: "planner", id: plannerId },
    studentId,
    tenantId,
    options
  );
}

/**
 * 플래너 학원 일정 오버라이드 저장 (기존 오버라이드 교체)
 */
export async function saveAcademyOverridesForPlanner(
  plannerId: string,
  overrides: AcademyOverrideInput[],
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return saveOverridesInternal({ type: "planner", id: plannerId }, overrides, options);
}

/**
 * 단일 플래너 학원 일정 오버라이드 추가/업데이트 (upsert)
 */
export async function upsertAcademyOverrideForPlanner(
  plannerId: string,
  override: AcademyOverrideInput,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return upsertOverrideInternal({ type: "planner", id: plannerId }, override, options);
}

/**
 * 단일 플래너 학원 일정 오버라이드 삭제
 */
export async function deleteAcademyOverrideForPlanner(
  plannerId: string,
  overrideId: string,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return deleteOverrideInternal({ type: "planner", id: plannerId }, overrideId, options);
}

/**
 * 플래너 학원 일정 오버라이드가 있는지 확인
 */
export async function hasAcademyOverridesForPlanner(
  plannerId: string,
  options?: { useAdminClient?: boolean }
): Promise<boolean> {
  return hasOverridesInternal({ type: "planner", id: plannerId }, options);
}

// ============================================================================
// 내부 공통 함수
// ============================================================================

/**
 * 오버라이드 조회 (내부용)
 */
async function getOverridesInternal(
  parent: OverrideParent,
  options?: { useAdminClient?: boolean }
): Promise<PlannerAcademyOverride[]> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  const { data, error } = await supabase
    .from("planner_academy_overrides")
    .select("*")
    .eq(column, parent.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    handleQueryError(error, {
      context: `[data/planGroups] getAcademyOverridesInternal (${parent.type})`,
    });
    return [];
  }

  return (data as PlannerAcademyOverride[] | null) ?? [];
}

/**
 * 실제 적용될 학원 일정 계산 (내부용)
 *
 * 전역 학원 일정 + 오버라이드를 병합하여 최종 적용될 학원 일정 목록을 반환합니다.
 */
async function getEffectiveAcademySchedulesInternal(
  parent: OverrideParent,
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveAcademySchedule[]> {
  // 1. 전역 학원 일정 조회
  const globalSchedules = await getStudentAcademySchedules(studentId, tenantId, {
    useAdminClient: options?.useAdminClient,
  });

  // 2. 오버라이드 조회
  const overrides = await getOverridesInternal(parent, options);

  // 3. 전역 일정을 Map으로 변환 (ID 기준)
  const effectiveMap = new Map<string, EffectiveAcademySchedule>(
    globalSchedules.map((schedule) => [
      schedule.id,
      {
        id: schedule.id,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        academy_name: schedule.academy_name,
        subject: schedule.subject,
        travel_time: schedule.travel_time ?? 60,
        source: "global" as const,
      },
    ])
  );

  // 4. 오버라이드 적용
  for (const override of overrides) {
    if (override.override_type === "remove") {
      // 전역 일정에서 제거
      if (override.source_schedule_id) {
        effectiveMap.delete(override.source_schedule_id);
        if (process.env.NODE_ENV === "development") {
          logActionDebug(
            { domain: "data", action: "getEffectiveAcademySchedulesInternal" },
            "오버라이드로 학원 일정 제거",
            { scheduleId: override.source_schedule_id, parent }
          );
        }
      }
    } else if (override.override_type === "add") {
      // 플래너에만 추가
      if (
        override.day_of_week != null &&
        override.start_time &&
        override.end_time
      ) {
        const addedSchedule: EffectiveAcademySchedule = {
          id: override.id,
          day_of_week: override.day_of_week,
          start_time: override.start_time,
          end_time: override.end_time,
          academy_name: override.academy_name,
          subject: override.subject,
          travel_time: override.travel_time ?? 60,
          source: "override_add",
        };
        effectiveMap.set(override.id, addedSchedule);
        if (process.env.NODE_ENV === "development") {
          logActionDebug(
            { domain: "data", action: "getEffectiveAcademySchedulesInternal" },
            "오버라이드로 학원 일정 추가",
            { overrideId: override.id, dayOfWeek: override.day_of_week, parent }
          );
        }
      }
    } else if (override.override_type === "modify") {
      // 기존 일정 수정
      if (override.source_schedule_id && effectiveMap.has(override.source_schedule_id)) {
        const existing = effectiveMap.get(override.source_schedule_id)!;
        const modifiedSchedule: EffectiveAcademySchedule = {
          id: existing.id,
          day_of_week: override.day_of_week ?? existing.day_of_week,
          start_time: override.start_time ?? existing.start_time,
          end_time: override.end_time ?? existing.end_time,
          academy_name: override.academy_name ?? existing.academy_name,
          subject: override.subject ?? existing.subject,
          travel_time: override.travel_time ?? existing.travel_time,
          source: "override_modify",
          source_schedule_id: override.source_schedule_id,
        };
        effectiveMap.set(override.source_schedule_id, modifiedSchedule);
        if (process.env.NODE_ENV === "development") {
          logActionDebug(
            { domain: "data", action: "getEffectiveAcademySchedulesInternal" },
            "오버라이드로 학원 일정 수정",
            { scheduleId: override.source_schedule_id, parent }
          );
        }
      }
    }
  }

  // 5. 요일/시간 순으로 정렬하여 반환
  return Array.from(effectiveMap.values()).sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.start_time.localeCompare(b.start_time);
  });
}

/**
 * 오버라이드 저장 (내부용)
 */
async function saveOverridesInternal(
  parent: OverrideParent,
  overrides: AcademyOverrideInput[],
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  // 1. 기존 오버라이드 삭제
  const { error: deleteError } = await supabase
    .from("planner_academy_overrides")
    .delete()
    .eq(column, parent.id);

  if (deleteError) {
    handleQueryError(deleteError, {
      context: `[data/planGroups] saveAcademyOverridesInternal (${parent.type}) - delete`,
    });
    return { success: false, error: "기존 오버라이드 삭제에 실패했습니다." };
  }

  // 2. 새로운 오버라이드가 없으면 완료
  if (overrides.length === 0) {
    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "saveAcademyOverridesInternal" },
        "학원 일정 오버라이드 초기화 완료",
        { parent }
      );
    }
    return { success: true };
  }

  // 3. 검증
  for (const override of overrides) {
    // 'add' 타입은 day_of_week, start_time, end_time 필수
    if (override.override_type === "add") {
      if (
        override.day_of_week == null ||
        !override.start_time ||
        !override.end_time
      ) {
        return {
          success: false,
          error: `'add' 타입 오버라이드는 day_of_week, start_time, end_time이 필수입니다.`,
        };
      }
    }
    // 'remove'/'modify' 타입은 source_schedule_id 필수
    if (
      (override.override_type === "remove" || override.override_type === "modify") &&
      !override.source_schedule_id
    ) {
      return {
        success: false,
        error: `'${override.override_type}' 타입 오버라이드는 source_schedule_id가 필수입니다.`,
      };
    }
  }

  // 4. 새로운 오버라이드 삽입
  const insertData = overrides.map((o) => ({
    [column]: parent.id,
    source_schedule_id: o.source_schedule_id ?? null,
    override_type: o.override_type,
    day_of_week: o.day_of_week ?? null,
    start_time: o.start_time ?? null,
    end_time: o.end_time ?? null,
    academy_name: o.academy_name ?? null,
    subject: o.subject ?? null,
    travel_time: o.travel_time ?? 60,
    reason: o.reason ?? null,
  }));

  const { error: insertError } = await supabase
    .from("planner_academy_overrides")
    .insert(insertData);

  if (insertError) {
    handleQueryError(insertError, {
      context: `[data/planGroups] saveAcademyOverridesInternal (${parent.type}) - insert`,
    });
    return { success: false, error: insertError.message };
  }

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "saveAcademyOverridesInternal" },
      "학원 일정 오버라이드 저장 완료",
      { parent, count: overrides.length }
    );
  }

  return { success: true };
}

/**
 * 단일 오버라이드 upsert (내부용)
 */
async function upsertOverrideInternal(
  parent: OverrideParent,
  override: AcademyOverrideInput,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  // 검증
  if (override.override_type === "add") {
    if (
      override.day_of_week == null ||
      !override.start_time ||
      !override.end_time
    ) {
      return {
        success: false,
        error: "'add' 타입 오버라이드는 day_of_week, start_time, end_time이 필수입니다.",
      };
    }
  }
  if (
    (override.override_type === "remove" || override.override_type === "modify") &&
    !override.source_schedule_id
  ) {
    return {
      success: false,
      error: `'${override.override_type}' 타입 오버라이드는 source_schedule_id가 필수입니다.`,
    };
  }

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  // add 타입: 같은 요일/시간 삭제 후 삽입
  // remove/modify 타입: 같은 source_schedule_id 삭제 후 삽입
  if (override.override_type === "add") {
    // 같은 요일/시간의 기존 add 오버라이드 삭제
    await supabase
      .from("planner_academy_overrides")
      .delete()
      .eq(column, parent.id)
      .eq("override_type", "add")
      .eq("day_of_week", override.day_of_week!)
      .eq("start_time", override.start_time!)
      .eq("end_time", override.end_time!);
  } else {
    // 같은 source_schedule_id의 기존 오버라이드 삭제
    await supabase
      .from("planner_academy_overrides")
      .delete()
      .eq(column, parent.id)
      .eq("source_schedule_id", override.source_schedule_id!);
  }

  // 새 오버라이드 삽입
  const { error: insertError } = await supabase
    .from("planner_academy_overrides")
    .insert({
      [column]: parent.id,
      source_schedule_id: override.source_schedule_id ?? null,
      override_type: override.override_type,
      day_of_week: override.day_of_week ?? null,
      start_time: override.start_time ?? null,
      end_time: override.end_time ?? null,
      academy_name: override.academy_name ?? null,
      subject: override.subject ?? null,
      travel_time: override.travel_time ?? 60,
      reason: override.reason ?? null,
    });

  if (insertError) {
    handleQueryError(insertError, {
      context: `[data/planGroups] upsertAcademyOverrideInternal (${parent.type}) - insert`,
    });
    return { success: false, error: insertError.message };
  }

  return { success: true };
}

/**
 * 단일 오버라이드 삭제 (내부용)
 */
async function deleteOverrideInternal(
  parent: OverrideParent,
  overrideId: string,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  const { error } = await supabase
    .from("planner_academy_overrides")
    .delete()
    .eq(column, parent.id)
    .eq("id", overrideId);

  if (error) {
    handleQueryError(error, {
      context: `[data/planGroups] deleteAcademyOverrideInternal (${parent.type})`,
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 오버라이드 존재 여부 확인 (내부용)
 */
async function hasOverridesInternal(
  parent: OverrideParent,
  options?: { useAdminClient?: boolean }
): Promise<boolean> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  const { count, error } = await supabase
    .from("planner_academy_overrides")
    .select("id", { count: "exact", head: true })
    .eq(column, parent.id);

  if (error) {
    logActionWarn(
      { domain: "data", action: "hasAcademyOverridesInternal" },
      "학원 일정 오버라이드 존재 여부 확인 실패",
      { parent, error }
    );
    return false;
  }

  return (count ?? 0) > 0;
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 전역 학원 일정을 EffectiveAcademySchedule 형식으로 변환
 */
export function toEffectiveSchedule(
  schedule: AcademySchedule
): EffectiveAcademySchedule {
  return {
    id: schedule.id,
    day_of_week: schedule.day_of_week,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    academy_name: schedule.academy_name,
    subject: schedule.subject,
    travel_time: schedule.travel_time ?? 60,
    source: "global",
  };
}
