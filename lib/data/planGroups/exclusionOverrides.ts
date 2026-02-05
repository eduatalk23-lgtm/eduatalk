/**
 * 플래너별 제외일 오버라이드 관련 함수
 *
 * 전역 제외일(시간관리)을 플래너/플랜그룹별로 커스터마이징할 수 있게 합니다.
 * - 'add': 전역에 없지만 이 플래너에만 추가
 * - 'remove': 전역에 있지만 이 플래너에서는 제외
 *
 * 지원하는 상위 엔티티:
 * - planner_id: 플래너 테이블 (planners)
 * - plan_group_id: 플랜 그룹 테이블 (plan_groups)
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import type {
  PlannerExclusionOverride,
  EffectiveExclusion,
  ExclusionType,
} from "@/lib/types/plan";
import { getSupabaseClient } from "./utils";
import { getStudentExclusions } from "./exclusions";

// ============================================================================
// 공통 타입
// ============================================================================

type OverrideParent =
  | { type: "planner"; id: string }
  | { type: "plan_group"; id: string };

type OverrideInput = {
  exclusion_date: string;
  override_type: "add" | "remove";
  exclusion_type?: ExclusionType;
  reason?: string;
};

// ============================================================================
// 플랜 그룹용 함수 (기존)
// ============================================================================

/**
 * 플랜 그룹 오버라이드 조회
 */
export async function getPlannerOverrides(
  planGroupId: string,
  options?: { useAdminClient?: boolean }
): Promise<PlannerExclusionOverride[]> {
  return getOverridesInternal({ type: "plan_group", id: planGroupId }, options);
}

// ============================================================================
// 플래너(Planner)용 함수 (신규)
// ============================================================================

/**
 * 플래너 오버라이드 조회
 */
export async function getPlannerOverridesForPlanner(
  plannerId: string,
  options?: { useAdminClient?: boolean }
): Promise<PlannerExclusionOverride[]> {
  return getOverridesInternal({ type: "planner", id: plannerId }, options);
}

/**
 * 플래너의 실제 적용될 제외일 계산
 */
export async function getEffectiveExclusionsForPlanner(
  plannerId: string,
  studentId: string,
  periodStart: string,
  periodEnd: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveExclusion[]> {
  return getEffectiveExclusionsInternal(
    { type: "planner", id: plannerId },
    studentId,
    periodStart,
    periodEnd,
    tenantId,
    options
  );
}

/**
 * 플래너 오버라이드 저장 (기존 오버라이드 교체)
 */
export async function savePlannerOverridesForPlanner(
  plannerId: string,
  overrides: OverrideInput[],
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return saveOverridesInternal({ type: "planner", id: plannerId }, overrides, options);
}

/**
 * 단일 플래너 오버라이드 추가/업데이트 (upsert)
 */
export async function upsertPlannerOverrideForPlanner(
  plannerId: string,
  override: OverrideInput,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return upsertOverrideInternal({ type: "planner", id: plannerId }, override, options);
}

/**
 * 단일 플래너 오버라이드 삭제
 */
export async function deletePlannerOverrideForPlanner(
  plannerId: string,
  exclusionDate: string,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return deleteOverrideInternal({ type: "planner", id: plannerId }, exclusionDate, options);
}

/**
 * 플래너 오버라이드가 있는지 확인
 */
export async function hasPlannerOverridesForPlanner(
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
): Promise<PlannerExclusionOverride[]> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  const { data, error } = await supabase
    .from("planner_exclusion_overrides")
    .select("*")
    .eq(column, parent.id)
    .order("exclusion_date", { ascending: true });

  if (error) {
    handleQueryError(error, {
      context: `[data/planGroups] getOverridesInternal (${parent.type})`,
    });
    return [];
  }

  return (data as PlannerExclusionOverride[] | null) ?? [];
}

/**
 * 실제 적용될 제외일 계산 (내부용)
 */
async function getEffectiveExclusionsInternal(
  parent: OverrideParent,
  studentId: string,
  periodStart: string,
  periodEnd: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveExclusion[]> {
  // 1. 전역 제외일 조회 (plan_group_id가 NULL인 것)
  const globalExclusions = await getStudentExclusions(studentId, tenantId, {
    useAdminClient: options?.useAdminClient,
  });

  // 기간 필터링
  const periodStartDate = new Date(periodStart);
  periodStartDate.setHours(0, 0, 0, 0);
  const periodEndDate = new Date(periodEnd);
  periodEndDate.setHours(23, 59, 59, 999);

  const filteredGlobalExclusions = globalExclusions.filter((e) => {
    const exclusionDate = new Date(e.exclusion_date);
    exclusionDate.setHours(0, 0, 0, 0);
    return exclusionDate >= periodStartDate && exclusionDate <= periodEndDate;
  });

  // 2. 오버라이드 조회
  const overrides = await getOverridesInternal(parent, options);

  // 3. 오버라이드 적용
  const effectiveMap = new Map<string, EffectiveExclusion>(
    filteredGlobalExclusions.map((e) => [
      e.exclusion_date,
      {
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type as ExclusionType,
        reason: e.reason,
        source: "global" as const,
      },
    ])
  );

  for (const override of overrides) {
    // 기간 내 오버라이드만 처리
    const overrideDate = new Date(override.exclusion_date);
    overrideDate.setHours(0, 0, 0, 0);
    if (overrideDate < periodStartDate || overrideDate > periodEndDate) {
      continue;
    }

    if (override.override_type === "remove") {
      // 전역 제외일에서 제거
      effectiveMap.delete(override.exclusion_date);
      if (process.env.NODE_ENV === "development") {
        logActionDebug(
          { domain: "data", action: "getEffectiveExclusionsInternal" },
          "오버라이드로 제외일 제거",
          { date: override.exclusion_date, parent }
        );
      }
    } else if (override.override_type === "add") {
      // 플래너에만 추가
      effectiveMap.set(override.exclusion_date, {
        exclusion_date: override.exclusion_date,
        exclusion_type: override.exclusion_type as ExclusionType,
        reason: override.reason,
        source: "override_add",
      });
      if (process.env.NODE_ENV === "development") {
        logActionDebug(
          { domain: "data", action: "getEffectiveExclusionsInternal" },
          "오버라이드로 제외일 추가",
          { date: override.exclusion_date, type: override.exclusion_type, parent }
        );
      }
    }
  }

  // 날짜 순으로 정렬하여 반환
  return Array.from(effectiveMap.values()).sort((a, b) =>
    a.exclusion_date.localeCompare(b.exclusion_date)
  );
}

/**
 * 오버라이드 저장 (내부용)
 */
async function saveOverridesInternal(
  parent: OverrideParent,
  overrides: OverrideInput[],
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  // 1. 기존 오버라이드 삭제
  const { error: deleteError } = await supabase
    .from("planner_exclusion_overrides")
    .delete()
    .eq(column, parent.id);

  if (deleteError) {
    handleQueryError(deleteError, {
      context: `[data/planGroups] saveOverridesInternal (${parent.type}) - delete`,
    });
    return { success: false, error: "기존 오버라이드 삭제에 실패했습니다." };
  }

  // 2. 새로운 오버라이드가 없으면 완료
  if (overrides.length === 0) {
    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "saveOverridesInternal" },
        "오버라이드 초기화 완료",
        { parent }
      );
    }
    return { success: true };
  }

  // 3. 검증: 'add' 타입은 exclusion_type 필수
  for (const override of overrides) {
    if (override.override_type === "add" && !override.exclusion_type) {
      return {
        success: false,
        error: `'add' 타입 오버라이드는 exclusion_type이 필수입니다. (날짜: ${override.exclusion_date})`,
      };
    }
  }

  // 4. 새로운 오버라이드 삽입
  const insertData = overrides.map((o) => ({
    [column]: parent.id,
    exclusion_date: o.exclusion_date,
    override_type: o.override_type,
    exclusion_type: o.exclusion_type ?? null,
    reason: o.reason ?? null,
  }));

  const { error: insertError } = await supabase
    .from("planner_exclusion_overrides")
    .insert(insertData);

  if (insertError) {
    handleQueryError(insertError, {
      context: `[data/planGroups] saveOverridesInternal (${parent.type}) - insert`,
    });
    return { success: false, error: insertError.message };
  }

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "saveOverridesInternal" },
      "오버라이드 저장 완료",
      { parent, count: overrides.length }
    );
  }

  return { success: true };
}

/**
 * 단일 오버라이드 upsert (내부용)
 *
 * Note: 부분 유니크 인덱스는 Supabase onConflict에서 직접 사용할 수 없으므로
 * delete-then-insert 방식을 사용합니다.
 */
async function upsertOverrideInternal(
  parent: OverrideParent,
  override: OverrideInput,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  // 검증: 'add' 타입은 exclusion_type 필수
  if (override.override_type === "add" && !override.exclusion_type) {
    return {
      success: false,
      error: "'add' 타입 오버라이드는 exclusion_type이 필수입니다.",
    };
  }

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  // 1. 기존 오버라이드 삭제 (있는 경우)
  const { error: deleteError } = await supabase
    .from("planner_exclusion_overrides")
    .delete()
    .eq(column, parent.id)
    .eq("exclusion_date", override.exclusion_date);

  if (deleteError) {
    handleQueryError(deleteError, {
      context: `[data/planGroups] upsertOverrideInternal (${parent.type}) - delete`,
    });
    return { success: false, error: deleteError.message };
  }

  // 2. 새 오버라이드 삽입
  const { error: insertError } = await supabase
    .from("planner_exclusion_overrides")
    .insert({
      [column]: parent.id,
      exclusion_date: override.exclusion_date,
      override_type: override.override_type,
      exclusion_type: override.exclusion_type ?? null,
      reason: override.reason ?? null,
    });

  if (insertError) {
    handleQueryError(insertError, {
      context: `[data/planGroups] upsertOverrideInternal (${parent.type}) - insert`,
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
  exclusionDate: string,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const column = parent.type === "planner" ? "planner_id" : "plan_group_id";

  const { error } = await supabase
    .from("planner_exclusion_overrides")
    .delete()
    .eq(column, parent.id)
    .eq("exclusion_date", exclusionDate);

  if (error) {
    handleQueryError(error, {
      context: `[data/planGroups] deleteOverrideInternal (${parent.type})`,
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
    .from("planner_exclusion_overrides")
    .select("id", { count: "exact", head: true })
    .eq(column, parent.id);

  if (error) {
    logActionWarn(
      { domain: "data", action: "hasOverridesInternal" },
      "오버라이드 존재 여부 확인 실패",
      { parent, error }
    );
    return false;
  }

  return (count ?? 0) > 0;
}

// ============================================================================
// 플랜 그룹용 함수 (기존 - 하위 호환성 유지)
// ============================================================================

/**
 * 실제 적용될 제외일 계산
 *
 * 전역 제외일 + 오버라이드를 병합하여 최종 적용될 제외일 목록을 반환합니다.
 *
 * @param planGroupId - 플래너(플랜 그룹) ID
 * @param studentId - 학생 ID
 * @param periodStart - 기간 시작일 (YYYY-MM-DD)
 * @param periodEnd - 기간 종료일 (YYYY-MM-DD)
 * @param tenantId - 테넌트 ID (선택)
 * @param options - 추가 옵션
 */
export async function getEffectiveExclusions(
  planGroupId: string,
  studentId: string,
  periodStart: string,
  periodEnd: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveExclusion[]> {
  // 1. 전역 제외일 조회 (plan_group_id가 NULL인 것)
  const globalExclusions = await getStudentExclusions(studentId, tenantId, {
    useAdminClient: options?.useAdminClient,
  });

  // 기간 필터링
  const periodStartDate = new Date(periodStart);
  periodStartDate.setHours(0, 0, 0, 0);
  const periodEndDate = new Date(periodEnd);
  periodEndDate.setHours(23, 59, 59, 999);

  const filteredGlobalExclusions = globalExclusions.filter((e) => {
    const exclusionDate = new Date(e.exclusion_date);
    exclusionDate.setHours(0, 0, 0, 0);
    return exclusionDate >= periodStartDate && exclusionDate <= periodEndDate;
  });

  // 2. 플래너 오버라이드 조회
  const overrides = await getPlannerOverrides(planGroupId, options);

  // 3. 오버라이드 적용
  const effectiveMap = new Map<string, EffectiveExclusion>(
    filteredGlobalExclusions.map((e) => [
      e.exclusion_date,
      {
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type as ExclusionType,
        reason: e.reason,
        source: "global" as const,
      },
    ])
  );

  for (const override of overrides) {
    // 기간 내 오버라이드만 처리
    const overrideDate = new Date(override.exclusion_date);
    overrideDate.setHours(0, 0, 0, 0);
    if (overrideDate < periodStartDate || overrideDate > periodEndDate) {
      continue;
    }

    if (override.override_type === "remove") {
      // 전역 제외일에서 제거
      effectiveMap.delete(override.exclusion_date);
      if (process.env.NODE_ENV === "development") {
        logActionDebug(
          { domain: "data", action: "getEffectiveExclusions" },
          "오버라이드로 제외일 제거",
          { date: override.exclusion_date, planGroupId }
        );
      }
    } else if (override.override_type === "add") {
      // 플래너에만 추가
      effectiveMap.set(override.exclusion_date, {
        exclusion_date: override.exclusion_date,
        exclusion_type: override.exclusion_type as ExclusionType,
        reason: override.reason,
        source: "override_add",
      });
      if (process.env.NODE_ENV === "development") {
        logActionDebug(
          { domain: "data", action: "getEffectiveExclusions" },
          "오버라이드로 제외일 추가",
          { date: override.exclusion_date, type: override.exclusion_type, planGroupId }
        );
      }
    }
  }

  // 날짜 순으로 정렬하여 반환
  return Array.from(effectiveMap.values()).sort((a, b) =>
    a.exclusion_date.localeCompare(b.exclusion_date)
  );
}

/**
 * 플래너 오버라이드 저장 (기존 오버라이드 교체)
 *
 * 기존 오버라이드를 모두 삭제하고 새로운 오버라이드를 저장합니다.
 *
 * @param planGroupId - 플래너(플랜 그룹) ID
 * @param overrides - 저장할 오버라이드 목록
 * @param options - 추가 옵션
 */
export async function savePlannerOverrides(
  planGroupId: string,
  overrides: Array<{
    exclusion_date: string;
    override_type: "add" | "remove";
    exclusion_type?: ExclusionType;
    reason?: string;
  }>,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  // 트랜잭션처럼 처리: 기존 오버라이드 삭제 후 새로운 오버라이드 삽입
  // Supabase에서 트랜잭션을 직접 지원하지 않으므로 순차 처리

  // 1. 기존 오버라이드 삭제
  const { error: deleteError } = await supabase
    .from("planner_exclusion_overrides")
    .delete()
    .eq("plan_group_id", planGroupId);

  if (deleteError) {
    handleQueryError(deleteError, {
      context: "[data/planGroups] savePlannerOverrides - delete",
    });
    return { success: false, error: "기존 오버라이드 삭제에 실패했습니다." };
  }

  // 2. 새로운 오버라이드가 없으면 완료
  if (overrides.length === 0) {
    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "savePlannerOverrides" },
        "오버라이드 초기화 완료",
        { planGroupId }
      );
    }
    return { success: true };
  }

  // 3. 검증: 'add' 타입은 exclusion_type 필수
  for (const override of overrides) {
    if (override.override_type === "add" && !override.exclusion_type) {
      return {
        success: false,
        error: `'add' 타입 오버라이드는 exclusion_type이 필수입니다. (날짜: ${override.exclusion_date})`,
      };
    }
  }

  // 4. 새로운 오버라이드 삽입
  const insertData = overrides.map((o) => ({
    plan_group_id: planGroupId,
    exclusion_date: o.exclusion_date,
    override_type: o.override_type,
    exclusion_type: o.exclusion_type ?? null,
    reason: o.reason ?? null,
  }));

  const { error: insertError } = await supabase
    .from("planner_exclusion_overrides")
    .insert(insertData);

  if (insertError) {
    handleQueryError(insertError, {
      context: "[data/planGroups] savePlannerOverrides - insert",
    });
    return { success: false, error: insertError.message };
  }

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "savePlannerOverrides" },
      "오버라이드 저장 완료",
      { planGroupId, count: overrides.length }
    );
  }

  return { success: true };
}

/**
 * 단일 플래너 오버라이드 추가/업데이트 (upsert)
 *
 * 날짜별로 하나의 오버라이드만 유지됩니다.
 * Note: 부분 유니크 인덱스는 onConflict에서 직접 사용할 수 없으므로
 * delete-then-insert 방식을 사용합니다.
 */
export async function upsertPlannerOverride(
  planGroupId: string,
  override: {
    exclusion_date: string;
    override_type: "add" | "remove";
    exclusion_type?: ExclusionType;
    reason?: string;
  },
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  // 검증: 'add' 타입은 exclusion_type 필수
  if (override.override_type === "add" && !override.exclusion_type) {
    return {
      success: false,
      error: "'add' 타입 오버라이드는 exclusion_type이 필수입니다.",
    };
  }

  // 1. 기존 오버라이드 삭제 (있는 경우)
  const { error: deleteError } = await supabase
    .from("planner_exclusion_overrides")
    .delete()
    .eq("plan_group_id", planGroupId)
    .eq("exclusion_date", override.exclusion_date);

  if (deleteError) {
    handleQueryError(deleteError, {
      context: "[data/planGroups] upsertPlannerOverride - delete",
    });
    return { success: false, error: deleteError.message };
  }

  // 2. 새 오버라이드 삽입
  const { error: insertError } = await supabase
    .from("planner_exclusion_overrides")
    .insert({
      plan_group_id: planGroupId,
      exclusion_date: override.exclusion_date,
      override_type: override.override_type,
      exclusion_type: override.exclusion_type ?? null,
      reason: override.reason ?? null,
    });

  if (insertError) {
    handleQueryError(insertError, {
      context: "[data/planGroups] upsertPlannerOverride - insert",
    });
    return { success: false, error: insertError.message };
  }

  return { success: true };
}

/**
 * 단일 플래너 오버라이드 삭제
 */
export async function deletePlannerOverride(
  planGroupId: string,
  exclusionDate: string,
  options?: { useAdminClient?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const { error } = await supabase
    .from("planner_exclusion_overrides")
    .delete()
    .eq("plan_group_id", planGroupId)
    .eq("exclusion_date", exclusionDate);

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] deletePlannerOverride",
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플래너 오버라이드가 있는지 확인
 */
export async function hasPlannerOverrides(
  planGroupId: string,
  options?: { useAdminClient?: boolean }
): Promise<boolean> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("planner_exclusion_overrides")
    .select("id", { count: "exact", head: true })
    .eq("plan_group_id", planGroupId);

  if (error) {
    logActionWarn(
      { domain: "data", action: "hasPlannerOverrides" },
      "오버라이드 존재 여부 확인 실패",
      { planGroupId, error }
    );
    return false;
  }

  return (count ?? 0) > 0;
}
