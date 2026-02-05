"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import {
  getPlanGroupById,
  getPlanGroupByIdForAdmin,
  createPlanExclusions,
  createStudentExclusions,
  getStudentExclusions,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 시간 관리 데이터 반영 (제외일)
 * 관리자/컨설턴트 모드에서도 사용 가능하도록 수정
 */
async function _syncTimeManagementExclusions(
  groupId: string | null,
  periodStart: string,
  periodEnd: string,
  studentId?: string
): Promise<{
  count: number;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
    source?: "time_management";
  }>;
}> {
  const { role, userId } = await getCurrentUserRole();
  const tenantContext = await getTenantContext();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 관리자/컨설턴트 모드일 때는 studentId 파라미터 필수
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  let targetStudentId: string;

  const supabase = await createSupabaseServerClient();

  // 플랜 그룹 조회 (groupId가 있는 경우만)
  if (groupId) {
    let group;
    if (isAdminOrConsultant) {
      // 관리자 모드: getPlanGroupByIdForAdmin 사용
      group = await getPlanGroupByIdForAdmin(groupId, tenantContext.tenantId);
      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      // 관리자 모드에서 studentId가 없으면 플랜 그룹에서 student_id 가져오기
      targetStudentId = studentId || group.student_id;
      if (!targetStudentId) {
        throw new AppError(
          "학생 ID를 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
    } else {
      // 학생 모드: 기존 로직
      group = await getPlanGroupById(
        groupId,
        userId,
        tenantContext.tenantId
      );
      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      targetStudentId = userId;
      // 기존 플랜 그룹인 경우 revalidate
      revalidatePath(`/plan/group/${groupId}/edit`);
    }
  } else {
    // groupId가 없는 경우
    if (isAdminOrConsultant) {
      // 관리자 모드: studentId 파라미터 필수
      if (!studentId) {
        // 템플릿 모드에서는 빈 결과 반환
        return {
          count: 0,
          exclusions: [],
        };
      }
      targetStudentId = studentId;
    } else {
      // 학생 모드: 현재 사용자 ID 사용
      targetStudentId = userId;
    }
  }

  // 관리자 모드일 때는 학생의 tenant_id를 직접 조회
  let effectiveTenantId = tenantContext.tenantId;
  if (isAdminOrConsultant && targetStudentId) {
    const { data: studentData } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", targetStudentId)
      .maybeSingle();

    if (studentData?.tenant_id) {
      effectiveTenantId = studentData.tenant_id;
    }
  }

  // 학생의 모든 제외일 조회 (시간 관리에 등록된 모든 제외일)
  // 관리자/컨설턴트 모드에서는 Admin 클라이언트 사용 (RLS 우회)
  const allExclusions = await getStudentExclusions(
    targetStudentId,
    effectiveTenantId,
    { useAdminClient: isAdminOrConsultant }
  );

  // 기간에 해당하는 제외일 필터링
  const periodStartDate = new Date(periodStart);
  periodStartDate.setHours(0, 0, 0, 0);
  const periodEndDate = new Date(periodEnd);
  periodEndDate.setHours(23, 59, 59, 999);

  const filteredExclusions = allExclusions.filter((e) => {
    const exclusionDate = new Date(e.exclusion_date);
    exclusionDate.setHours(0, 0, 0, 0);
    return exclusionDate >= periodStartDate && exclusionDate <= periodEndDate;
  });

  // 최신 제외일 데이터 반환 (source 필드 추가)
  return {
    count: filteredExclusions.length,
    exclusions: filteredExclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as
        | "휴가"
        | "개인사정"
        | "휴일지정"
        | "기타",
      reason: e.reason || undefined,
      source: "time_management" as const,
    })),
  };
}

/**
 * 플랜 그룹 찾기 헬퍼 함수
 * 활성 플랜 그룹 → draft/saved 플랜 그룹 순서로 찾기
 */
async function findTargetPlanGroup(
  userId: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  // 1. 활성 플랜 그룹 찾기
  const { data: activeGroup } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("student_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (activeGroup) {
    return activeGroup.id;
  }

  // 2. 활성 플랜 그룹이 없으면 가장 최근 draft 또는 saved 플랜 그룹 사용
  const { data: recentGroup } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("student_id", userId)
    .in("status", ["draft", "saved"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return recentGroup?.id || null;
}

/**
 * 플랜 그룹 제외일 추가
 * 플랜 그룹이 없어도 시간 관리 영역에 제외일을 추가할 수 있음
 */
async function _addPlanExclusion(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  const exclusionDate = formData.get("exclusion_date");
  const exclusionType = formData.get("exclusion_type");
  const reason = formData.get("reason");
  const planGroupId = formData.get("plan_group_id");

  // 입력 검증
  if (!exclusionDate || typeof exclusionDate !== "string") {
    throw new AppError(
      "제외일을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!exclusionType || typeof exclusionType !== "string") {
    throw new AppError(
      "제외 유형을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // plan_group_id가 제공되지 않으면 플랜 그룹 찾기
  const targetGroupId =
    planGroupId && typeof planGroupId === "string"
      ? planGroupId
      : await findTargetPlanGroup(user.userId);

  const exclusionData = {
    exclusion_date: exclusionDate,
    exclusion_type: exclusionType,
    reason: reason && typeof reason === "string" ? reason.trim() : null,
  };

  // 플랜 그룹이 있으면 플랜 그룹별로, 없으면 시간 관리 영역에 저장
  const result = targetGroupId
    ? await createPlanExclusions(targetGroupId, tenantContext.tenantId, [
        exclusionData,
      ])
    : await createStudentExclusions(user.userId, tenantContext.tenantId, [
        exclusionData,
      ]);

  if (!result.success) {
    // 중복 에러인 경우 VALIDATION_ERROR로 처리
    const isDuplicateError = result.error?.includes("이미 등록된 제외일");
    throw new AppError(
      result.error || "제외일 추가에 실패했습니다.",
      isDuplicateError ? ErrorCode.VALIDATION_ERROR : ErrorCode.DATABASE_ERROR,
      isDuplicateError ? 400 : 500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

/**
 * 플랜 그룹 제외일 삭제
 */
async function _deletePlanExclusion(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();

  const exclusionId = formData.get("exclusion_id");

  if (!exclusionId || typeof exclusionId !== "string") {
    throw new AppError(
      "제외일 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 제외일 조회 (전역 관리: plan_group_id는 항상 NULL)
  const { data: exclusion, error: fetchError } = await supabase
    .from("plan_exclusions")
    .select("id, student_id")
    .eq("id", exclusionId)
    .single();

  if (fetchError || !exclusion) {
    throw new AppError(
      "제외일을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생 소유권 확인
  if (exclusion.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  const { error } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("id", exclusionId);

  if (error) {
    throw new AppError(
      error.message || "제외일 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

// ============================================================================
// 반복 제외일 관리
// ============================================================================

export interface RecurringExclusion {
  id?: string;
  pattern: "weekly" | "biweekly" | "monthly";
  dayOfWeek?: number[]; // 0=일요일 ~ 6=토요일
  dayOfMonth?: number; // 1-31
  exclusionType: "휴가" | "개인사정" | "휴일지정" | "기타";
  reason?: string;
  startDate: string;
  endDate?: string;
}

export interface ExpandedExclusion {
  exclusion_date: string;
  exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
  reason?: string;
  source: "recurring";
  recurring_pattern: "weekly" | "biweekly" | "monthly";
}

/**
 * 반복 패턴을 실제 날짜 목록으로 확장
 */
function expandRecurringPattern(
  pattern: RecurringExclusion["pattern"],
  dayOfWeek: number[] | undefined,
  dayOfMonth: number | undefined,
  exclusionType: RecurringExclusion["exclusionType"],
  reason: string | undefined,
  startDate: string,
  endDate: string | undefined,
  periodStart: string,
  periodEnd: string
): ExpandedExclusion[] {
  const results: ExpandedExclusion[] = [];

  // 유효 기간 계산 (반복 패턴의 유효 기간과 플랜 기간의 교집합)
  const effectiveStart = new Date(
    Math.max(new Date(startDate).getTime(), new Date(periodStart).getTime())
  );
  const effectiveEnd = new Date(
    Math.min(
      endDate ? new Date(endDate).getTime() : new Date(periodEnd).getTime() + 365 * 24 * 60 * 60 * 1000,
      new Date(periodEnd).getTime()
    )
  );

  if (effectiveStart > effectiveEnd) {
    return results;
  }

  const currentDate = new Date(effectiveStart);
  const patternStartDate = new Date(startDate);
  let weekCounter = 0;
  let lastWeekNumber = -1;

  while (currentDate <= effectiveEnd) {
    const dayOfWeekValue = currentDate.getDay();
    const dayOfMonthValue = currentDate.getDate();
    const weekNumber = Math.floor(
      (currentDate.getTime() - patternStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    let shouldAdd = false;

    if (pattern === "weekly") {
      // 매주 지정된 요일
      if (dayOfWeek && dayOfWeek.includes(dayOfWeekValue)) {
        shouldAdd = true;
      }
    } else if (pattern === "biweekly") {
      // 격주 지정된 요일
      if (weekNumber !== lastWeekNumber) {
        weekCounter++;
        lastWeekNumber = weekNumber;
      }
      if (weekCounter % 2 === 0 && dayOfWeek && dayOfWeek.includes(dayOfWeekValue)) {
        shouldAdd = true;
      }
    } else if (pattern === "monthly") {
      // 매월 지정된 날짜
      if (dayOfMonth) {
        if (dayOfMonthValue === dayOfMonth) {
          shouldAdd = true;
        }
        // 해당 월에 그 날짜가 없는 경우 마지막 날 처리
        const lastDayOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        ).getDate();
        if (dayOfMonth > lastDayOfMonth && dayOfMonthValue === lastDayOfMonth) {
          shouldAdd = true;
        }
      }
    }

    if (shouldAdd) {
      results.push({
        exclusion_date: currentDate.toISOString().split("T")[0],
        exclusion_type: exclusionType,
        reason,
        source: "recurring",
        recurring_pattern: pattern,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return results;
}

/**
 * 반복 제외일 목록 조회
 */
async function _getRecurringExclusions(
  studentId?: string
): Promise<{
  success: boolean;
  data?: RecurringExclusion[];
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const targetStudentId = isAdminOrConsultant && studentId ? studentId : userId;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("recurring_exclusions")
    .select("*")
    .eq("student_id", targetStudentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("반복 제외일 조회 실패:", error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: (data || []).map((row) => ({
      id: row.id,
      pattern: row.pattern as RecurringExclusion["pattern"],
      dayOfWeek: row.day_of_week || undefined,
      dayOfMonth: row.day_of_month || undefined,
      exclusionType: row.exclusion_type as RecurringExclusion["exclusionType"],
      reason: row.reason || undefined,
      startDate: row.start_date,
      endDate: row.end_date || undefined,
    })),
  };
}

/**
 * 반복 제외일 추가
 */
async function _createRecurringExclusion(
  exclusion: Omit<RecurringExclusion, "id">,
  studentId?: string
): Promise<{
  success: boolean;
  data?: RecurringExclusion;
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const targetStudentId = isAdminOrConsultant && studentId ? studentId : userId;

  // 검증
  if (exclusion.pattern === "weekly" || exclusion.pattern === "biweekly") {
    if (!exclusion.dayOfWeek || exclusion.dayOfWeek.length === 0) {
      return { success: false, error: "요일을 선택해주세요." };
    }
  }

  if (exclusion.pattern === "monthly") {
    if (!exclusion.dayOfMonth) {
      return { success: false, error: "날짜를 선택해주세요." };
    }
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("recurring_exclusions")
    .insert({
      student_id: targetStudentId,
      pattern: exclusion.pattern,
      day_of_week: exclusion.dayOfWeek || [],
      day_of_month: exclusion.dayOfMonth || null,
      exclusion_type: exclusion.exclusionType,
      reason: exclusion.reason || null,
      start_date: exclusion.startDate,
      end_date: exclusion.endDate || null,
    })
    .select()
    .single();

  if (error) {
    console.error("반복 제외일 추가 실패:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");

  return {
    success: true,
    data: {
      id: data.id,
      pattern: data.pattern as RecurringExclusion["pattern"],
      dayOfWeek: data.day_of_week || undefined,
      dayOfMonth: data.day_of_month || undefined,
      exclusionType: data.exclusion_type as RecurringExclusion["exclusionType"],
      reason: data.reason || undefined,
      startDate: data.start_date,
      endDate: data.end_date || undefined,
    },
  };
}

/**
 * 반복 제외일 삭제
 */
async function _deleteRecurringExclusion(
  exclusionId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const supabase = await createSupabaseServerClient();

  // 소유권 확인
  const { data: exclusion, error: fetchError } = await supabase
    .from("recurring_exclusions")
    .select("student_id")
    .eq("id", exclusionId)
    .single();

  if (fetchError || !exclusion) {
    return { success: false, error: "반복 제외일을 찾을 수 없습니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  if (!isAdminOrConsultant && exclusion.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const { error } = await supabase
    .from("recurring_exclusions")
    .delete()
    .eq("id", exclusionId);

  if (error) {
    console.error("반복 제외일 삭제 실패:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");

  return { success: true };
}

/**
 * 반복 제외일을 실제 날짜 목록으로 확장
 */
async function _expandRecurringExclusions(
  periodStart: string,
  periodEnd: string,
  studentId?: string
): Promise<{
  success: boolean;
  data?: ExpandedExclusion[];
  error?: string;
}> {
  const result = await _getRecurringExclusions(studentId);

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const allExclusions: ExpandedExclusion[] = [];

  for (const recurring of result.data) {
    const expanded = expandRecurringPattern(
      recurring.pattern,
      recurring.dayOfWeek,
      recurring.dayOfMonth,
      recurring.exclusionType,
      recurring.reason,
      recurring.startDate,
      recurring.endDate,
      periodStart,
      periodEnd
    );
    allExclusions.push(...expanded);
  }

  // 중복 제거 (같은 날짜)
  const uniqueExclusions = allExclusions.filter(
    (e, i, arr) => arr.findIndex((x) => x.exclusion_date === e.exclusion_date) === i
  );

  return {
    success: true,
    data: uniqueExclusions.sort((a, b) => a.exclusion_date.localeCompare(b.exclusion_date)),
  };
}

export const syncTimeManagementExclusionsAction = withErrorHandling(
  _syncTimeManagementExclusions
);
export const addPlanExclusion = withErrorHandling(_addPlanExclusion);
export const deletePlanExclusion = withErrorHandling(_deletePlanExclusion);
export const getRecurringExclusions = withErrorHandling(_getRecurringExclusions);
export const createRecurringExclusion = withErrorHandling(_createRecurringExclusion);
export const deleteRecurringExclusion = withErrorHandling(_deleteRecurringExclusion);
export const expandRecurringExclusions = withErrorHandling(_expandRecurringExclusions);

// ============================================================================
// 플래너별 제외일 오버라이드 관리
// ============================================================================

import {
  // Plan Group용 (기존)
  getEffectiveExclusions as getEffectiveExclusionsData,
  savePlannerOverrides as savePlannerOverridesData,
  getPlannerOverrides as getPlannerOverridesData,
  upsertPlannerOverride as upsertPlannerOverrideData,
  deletePlannerOverride as deletePlannerOverrideData,
  // Planner용 (신규)
  getEffectiveExclusionsForPlanner as getEffectiveExclusionsForPlannerData,
  savePlannerOverridesForPlanner as savePlannerOverridesForPlannerData,
  getPlannerOverridesForPlanner as getPlannerOverridesForPlannerData,
  upsertPlannerOverrideForPlanner as upsertPlannerOverrideForPlannerData,
  deletePlannerOverrideForPlanner as deletePlannerOverrideForPlannerData,
} from "@/lib/data/planGroups/exclusionOverrides";
import type {
  EffectiveExclusion,
  PlannerExclusionOverride,
  ExclusionType,
} from "@/lib/types/plan";

/**
 * 플래너의 실제 적용될 제외일 조회
 *
 * 전역 제외일(시간관리)과 플래너 오버라이드를 병합하여
 * 최종 적용될 제외일 목록을 반환합니다.
 */
async function _getEffectiveExclusionsAction(
  planGroupId: string,
  periodStart: string,
  periodEnd: string,
  studentId?: string
): Promise<{
  success: boolean;
  data?: EffectiveExclusion[];
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();
  const tenantContext = await getTenantContext();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 플랜 그룹 조회하여 student_id 확인
  const { data: planGroup, error: groupError } = await supabase
    .from("plan_groups")
    .select("student_id, tenant_id")
    .eq("id", planGroupId)
    .maybeSingle();

  if (groupError || !planGroup) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  // 권한 확인
  const targetStudentId = studentId || planGroup.student_id;
  if (!isAdminOrConsultant && planGroup.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const effectiveExclusions = await getEffectiveExclusionsData(
    planGroupId,
    targetStudentId,
    periodStart,
    periodEnd,
    planGroup.tenant_id || tenantContext?.tenantId,
    { useAdminClient: isAdminOrConsultant }
  );

  return { success: true, data: effectiveExclusions };
}

/**
 * 플래너의 오버라이드 목록 조회
 */
async function _getPlannerOverridesAction(
  planGroupId: string
): Promise<{
  success: boolean;
  data?: PlannerExclusionOverride[];
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 권한 확인: 플랜 그룹 조회
  const { data: planGroup, error: groupError } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", planGroupId)
    .maybeSingle();

  if (groupError || !planGroup) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  if (!isAdminOrConsultant && planGroup.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const overrides = await getPlannerOverridesData(planGroupId, {
    useAdminClient: isAdminOrConsultant,
  });

  return { success: true, data: overrides };
}

/**
 * 플래너 오버라이드 저장 (기존 오버라이드 교체)
 */
async function _savePlannerOverridesAction(
  planGroupId: string,
  overrides: Array<{
    exclusion_date: string;
    override_type: "add" | "remove";
    exclusion_type?: ExclusionType;
    reason?: string;
  }>
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 권한 확인
  const { data: planGroup, error: groupError } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", planGroupId)
    .maybeSingle();

  if (groupError || !planGroup) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  if (!isAdminOrConsultant && planGroup.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const result = await savePlannerOverridesData(planGroupId, overrides, {
    useAdminClient: isAdminOrConsultant,
  });

  if (result.success) {
    revalidatePath("/plan");
    revalidatePath("/blocks");
  }

  return result;
}

/**
 * 단일 플래너 오버라이드 추가/업데이트
 */
async function _upsertPlannerOverrideAction(
  planGroupId: string,
  override: {
    exclusion_date: string;
    override_type: "add" | "remove";
    exclusion_type?: ExclusionType;
    reason?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 권한 확인
  const { data: planGroup, error: groupError } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", planGroupId)
    .maybeSingle();

  if (groupError || !planGroup) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  if (!isAdminOrConsultant && planGroup.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const result = await upsertPlannerOverrideData(planGroupId, override, {
    useAdminClient: isAdminOrConsultant,
  });

  if (result.success) {
    revalidatePath("/plan");
    revalidatePath("/blocks");
  }

  return result;
}

/**
 * 단일 플래너 오버라이드 삭제
 */
async function _deletePlannerOverrideAction(
  planGroupId: string,
  exclusionDate: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 권한 확인
  const { data: planGroup, error: groupError } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", planGroupId)
    .maybeSingle();

  if (groupError || !planGroup) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  if (!isAdminOrConsultant && planGroup.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const result = await deletePlannerOverrideData(planGroupId, exclusionDate, {
    useAdminClient: isAdminOrConsultant,
  });

  if (result.success) {
    revalidatePath("/plan");
    revalidatePath("/blocks");
  }

  return result;
}

export const getEffectiveExclusionsAction = withErrorHandling(
  _getEffectiveExclusionsAction
);
export const getPlannerOverridesAction = withErrorHandling(
  _getPlannerOverridesAction
);
export const savePlannerOverridesAction = withErrorHandling(
  _savePlannerOverridesAction
);
export const upsertPlannerOverrideAction = withErrorHandling(
  _upsertPlannerOverrideAction
);
export const deletePlannerOverrideAction = withErrorHandling(
  _deletePlannerOverrideAction
);

// ============================================================================
// 플래너(Planner) 기반 제외일 오버라이드 관리 (신규)
// PlannerCreationModal에서 사용
// ============================================================================

/**
 * 플래너(Planner)의 실제 적용될 제외일 조회
 *
 * 전역 제외일(시간관리)과 플래너 오버라이드를 병합하여
 * 최종 적용될 제외일 목록을 반환합니다.
 */
async function _getEffectiveExclusionsForPlannerAction(
  plannerId: string,
  periodStart: string,
  periodEnd: string,
  studentId?: string
): Promise<{
  success: boolean;
  data?: EffectiveExclusion[];
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();
  const tenantContext = await getTenantContext();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 플래너 조회하여 student_id 확인
  const { data: planner, error: plannerError } = await supabase
    .from("planners")
    .select("student_id, tenant_id")
    .eq("id", plannerId)
    .maybeSingle();

  if (plannerError || !planner) {
    return { success: false, error: "플래너를 찾을 수 없습니다." };
  }

  // 권한 확인
  const targetStudentId = studentId || planner.student_id;
  if (!isAdminOrConsultant && planner.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const effectiveExclusions = await getEffectiveExclusionsForPlannerData(
    plannerId,
    targetStudentId,
    periodStart,
    periodEnd,
    planner.tenant_id || tenantContext?.tenantId,
    { useAdminClient: isAdminOrConsultant }
  );

  return { success: true, data: effectiveExclusions };
}

/**
 * 플래너(Planner)의 오버라이드 목록 조회
 */
async function _getPlannerOverridesForPlannerAction(
  plannerId: string
): Promise<{
  success: boolean;
  data?: PlannerExclusionOverride[];
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 권한 확인: 플래너 조회
  const { data: planner, error: plannerError } = await supabase
    .from("planners")
    .select("student_id")
    .eq("id", plannerId)
    .maybeSingle();

  if (plannerError || !planner) {
    return { success: false, error: "플래너를 찾을 수 없습니다." };
  }

  if (!isAdminOrConsultant && planner.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const overrides = await getPlannerOverridesForPlannerData(plannerId, {
    useAdminClient: isAdminOrConsultant,
  });

  return { success: true, data: overrides };
}

/**
 * 플래너(Planner) 오버라이드 저장 (기존 오버라이드 교체)
 */
async function _savePlannerOverridesForPlannerAction(
  plannerId: string,
  overrides: Array<{
    exclusion_date: string;
    override_type: "add" | "remove";
    exclusion_type?: ExclusionType;
    reason?: string;
  }>
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 권한 확인
  const { data: planner, error: plannerError } = await supabase
    .from("planners")
    .select("student_id")
    .eq("id", plannerId)
    .maybeSingle();

  if (plannerError || !planner) {
    return { success: false, error: "플래너를 찾을 수 없습니다." };
  }

  if (!isAdminOrConsultant && planner.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const result = await savePlannerOverridesForPlannerData(plannerId, overrides, {
    useAdminClient: isAdminOrConsultant,
  });

  if (result.success) {
    revalidatePath("/plan");
    revalidatePath("/blocks");
  }

  return result;
}

/**
 * 단일 플래너(Planner) 오버라이드 추가/업데이트
 */
async function _upsertPlannerOverrideForPlannerAction(
  plannerId: string,
  override: {
    exclusion_date: string;
    override_type: "add" | "remove";
    exclusion_type?: ExclusionType;
    reason?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 권한 확인
  const { data: planner, error: plannerError } = await supabase
    .from("planners")
    .select("student_id")
    .eq("id", plannerId)
    .maybeSingle();

  if (plannerError || !planner) {
    return { success: false, error: "플래너를 찾을 수 없습니다." };
  }

  if (!isAdminOrConsultant && planner.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const result = await upsertPlannerOverrideForPlannerData(plannerId, override, {
    useAdminClient: isAdminOrConsultant,
  });

  if (result.success) {
    revalidatePath("/plan");
    revalidatePath("/blocks");
  }

  return result;
}

/**
 * 단일 플래너(Planner) 오버라이드 삭제
 */
async function _deletePlannerOverrideForPlannerAction(
  plannerId: string,
  exclusionDate: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { role, userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const supabase = await createSupabaseServerClient();

  // 권한 확인
  const { data: planner, error: plannerError } = await supabase
    .from("planners")
    .select("student_id")
    .eq("id", plannerId)
    .maybeSingle();

  if (plannerError || !planner) {
    return { success: false, error: "플래너를 찾을 수 없습니다." };
  }

  if (!isAdminOrConsultant && planner.student_id !== userId) {
    return { success: false, error: "권한이 없습니다." };
  }

  const result = await deletePlannerOverrideForPlannerData(plannerId, exclusionDate, {
    useAdminClient: isAdminOrConsultant,
  });

  if (result.success) {
    revalidatePath("/plan");
    revalidatePath("/blocks");
  }

  return result;
}

// Planner용 액션 export
export const getEffectiveExclusionsForPlannerAction = withErrorHandling(
  _getEffectiveExclusionsForPlannerAction
);
export const getPlannerOverridesForPlannerAction = withErrorHandling(
  _getPlannerOverridesForPlannerAction
);
export const savePlannerOverridesForPlannerAction = withErrorHandling(
  _savePlannerOverridesForPlannerAction
);
export const upsertPlannerOverrideForPlannerAction = withErrorHandling(
  _upsertPlannerOverrideForPlannerAction
);
export const deletePlannerOverrideForPlannerAction = withErrorHandling(
  _deletePlannerOverrideForPlannerAction
);

