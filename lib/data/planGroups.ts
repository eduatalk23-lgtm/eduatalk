// 플랜 그룹 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  PlanGroupCreationData,
  PlanFilters,
} from "@/lib/types/plan";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * PostgrestError 타입 가드 함수
 */
function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "code" in error
  );
}

/**
 * 에러에서 details와 hint를 안전하게 추출
 */
function getErrorDetails(error: unknown): {
  details: unknown;
  hint: string | null;
} {
  if (isPostgrestError(error)) {
    return {
      details: error.details ?? null,
      hint: error.hint ?? null,
    };
  }
  return {
    details: null,
    hint: null,
  };
}

/**
 * 플랜 그룹 필터
 */
export type PlanGroupFilters = {
  studentId: string;
  tenantId?: string | null;
  status?: string | string[];
  planPurpose?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  includeDeleted?: boolean;
};

/**
 * 학생의 플랜 그룹 목록 조회
 */
export async function getPlanGroupsForStudent(
  filters: PlanGroupFilters
): Promise<PlanGroup[]> {
  const supabase = await createSupabaseServerClient();

  const selectGroups = () =>
    supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
      )
      .eq("student_id", filters.studentId);

  let query = selectGroups();

  if (filters.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status);
    } else {
      query = query.eq("status", filters.status);
    }
  }

  if (filters.planPurpose) {
    query = query.eq("plan_purpose", filters.planPurpose);
  }

  if (filters.dateRange) {
    query = query
      .gte("period_start", filters.dateRange.start)
      .lte("period_end", filters.dateRange.end);
  }

  if (!filters.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  query = query.order("created_at", { ascending: false });

  let { data, error } = await query;
  let planGroupsData: PlanGroup[] | null = data as PlanGroup[] | null;

  if (error && error.code === "42703") {
    // fallback: 컬럼이 없는 경우 (scheduler_options 제외)
    console.warn("[data/planGroups] scheduler_options 컬럼이 없어 fallback 쿼리 사용", {
      studentId: filters.studentId,
      tenantId: filters.tenantId,
    });
    
    const fallbackQuery = supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
      )
      .eq("student_id", filters.studentId);

    if (filters.tenantId) {
      fallbackQuery.eq("tenant_id", filters.tenantId);
    }

    if (!filters.includeDeleted) {
      fallbackQuery.is("deleted_at", null);
    }

    const fallbackResult = await fallbackQuery.order("created_at", { ascending: false });
    error = fallbackResult.error;
    
    // fallback 성공 시 scheduler_options를 null로 설정
    if (fallbackResult.data && !error) {
      planGroupsData = fallbackResult.data.map((group: PlanGroup) => ({ ...group, scheduler_options: null })) as PlanGroup[];
    } else {
      planGroupsData = (fallbackResult.data as PlanGroup[] | null) ?? null;
    }
  }

  if (error) {
    // 에러 객체의 모든 속성을 안전하게 추출
    const errorInfo: Record<string, unknown> = {
      message: error.message || String(error),
      code: error.code || "UNKNOWN",
    };
    
    // 에러 객체의 다른 속성들도 추출
    if ("details" in error) errorInfo.details = (error as { details?: unknown }).details;
    if ("hint" in error) errorInfo.hint = (error as { hint?: unknown }).hint;
    if ("statusCode" in error) errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
    
    console.error("[data/planGroups] 플랜 그룹 목록 조회 실패", {
      error: errorInfo,
      filters,
      errorString: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    return [];
  }

  return planGroupsData ?? [];
}

/**
 * 플랜 그룹 ID로 조회
 */
export async function getPlanGroupById(
  groupId: string,
  studentId: string,
  tenantId?: string | null
): Promise<PlanGroup | null> {
  const supabase = await createSupabaseServerClient();

  const selectGroup = () =>
    supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
      )
      .eq("id", groupId)
      .eq("student_id", studentId)
      .is("deleted_at", null);

  let query = selectGroup();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query.maybeSingle<PlanGroup>();

  // 컬럼이 없는 경우 fallback (scheduler_options 포함 시도)
  if (error && error.code === "42703") {
    console.warn("[data/planGroups] 컬럼 에러 발생, fallback 쿼리 사용", {
      groupId,
      studentId,
      tenantId,
    });
    
    // 먼저 scheduler_options 포함하여 시도
    const fallbackSelectWithScheduler = () =>
      supabase
        .from("plan_groups")
        .select(
          "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
        )
        .eq("id", groupId)
        .eq("student_id", studentId)
        .is("deleted_at", null);
    
    let fallbackQuery = fallbackSelectWithScheduler();
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
    }
    
    ({ data, error } = await fallbackQuery.maybeSingle<PlanGroup>());
    
    // scheduler_options가 없는 경우 다시 시도
    if (error && error.code === "42703") {
      console.warn("[data/planGroups] scheduler_options 컬럼이 없어 최종 fallback 쿼리 사용");
      
      const fallbackSelectWithoutScheduler = () =>
        supabase
          .from("plan_groups")
          .select(
            "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
          )
          .eq("id", groupId)
          .eq("student_id", studentId)
          .is("deleted_at", null);
      
      let finalFallbackQuery = fallbackSelectWithoutScheduler();
      if (tenantId) {
        finalFallbackQuery = finalFallbackQuery.eq("tenant_id", tenantId);
      }
      
      ({ data, error } = await finalFallbackQuery.maybeSingle<PlanGroup>());
      
      // 최종 fallback 성공 시 scheduler_options를 null로 설정
      if (data && !error) {
        data = { ...data, scheduler_options: null } as PlanGroup;
      }
    }
  }

  if (error && error.code !== "PGRST116") {
    // 에러 객체의 모든 속성을 안전하게 추출
    const errorInfo: Record<string, unknown> = {
      message: error.message || String(error),
      code: error.code || "UNKNOWN",
    };
    
    // 에러 객체의 다른 속성들도 추출
    if ("details" in error) errorInfo.details = (error as { details?: unknown }).details;
    if ("hint" in error) errorInfo.hint = (error as { hint?: unknown }).hint;
    if ("statusCode" in error) errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
    
    console.error("[data/planGroups] 플랜 그룹 조회 실패", {
      error: errorInfo,
      groupId,
      studentId,
      tenantId,
      errorString: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    return null;
  }

  return data ?? null;
}

/**
 * 플랜 그룹 생성
 */
export async function createPlanGroup(
  group: {
    tenant_id: string;
    student_id: string;
    name?: string | null;
    plan_purpose: string | null;
    scheduler_type: string | null;
    scheduler_options?: any | null;
    period_start: string;
    period_end: string;
    target_date?: string | null;
    block_set_id?: string | null;
    status?: string;
    subject_constraints?: any | null;
    additional_period_reallocation?: any | null;
    non_study_time_blocks?: any | null;
    daily_schedule?: any | null; // JSONB: 일별 스케줄 정보
    // 캠프 관련 필드
    plan_type?: string | null;
    camp_template_id?: string | null;
    camp_invitation_id?: string | null;
  }
): Promise<{ success: boolean; groupId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: any = {
    tenant_id: group.tenant_id,
    student_id: group.student_id,
    name: group.name || null,
    plan_purpose: group.plan_purpose,
    scheduler_type: group.scheduler_type,
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date || null,
    block_set_id: group.block_set_id || null,
    status: group.status || "draft",
  };

  // scheduler_options가 실제 값이 있으면 추가 (데이터베이스에 컬럼이 있을 경우)
  // null이나 undefined가 아닐 때만 추가
  if (group.scheduler_options !== undefined && group.scheduler_options !== null) {
    payload.scheduler_options = group.scheduler_options;
  }

  // 1730 Timetable 추가 필드
  if (group.subject_constraints !== undefined && group.subject_constraints !== null) {
    payload.subject_constraints = group.subject_constraints;
  }

  if (group.additional_period_reallocation !== undefined && group.additional_period_reallocation !== null) {
    payload.additional_period_reallocation = group.additional_period_reallocation;
  }

  if (group.non_study_time_blocks !== undefined && group.non_study_time_blocks !== null) {
    payload.non_study_time_blocks = group.non_study_time_blocks;
  }

  if (group.daily_schedule !== undefined && group.daily_schedule !== null) {
    payload.daily_schedule = group.daily_schedule;
  }

  // 캠프 관련 필드
  if (group.plan_type !== undefined && group.plan_type !== null) {
    payload.plan_type = group.plan_type;
  }
  if (group.camp_template_id !== undefined && group.camp_template_id !== null) {
    payload.camp_template_id = group.camp_template_id;
  }
  if (group.camp_invitation_id !== undefined && group.camp_invitation_id !== null) {
    payload.camp_invitation_id = group.camp_invitation_id;
  }

  let { data, error } = await supabase
    .from("plan_groups")
    .insert(payload)
    .select("id")
    .single();

  // 컬럼이 없는 경우 fallback 처리
  if (error && error.code === "42703") {
    // scheduler_options가 포함된 경우 제외하고 재시도
    if (payload.scheduler_options !== undefined) {
      console.warn("[data/planGroups] scheduler_options 컬럼이 없어 fallback 생성 사용", {
        studentId: group.student_id,
        tenantId: group.tenant_id,
      });
      
      const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
      ({ data, error } = await supabase
        .from("plan_groups")
        .insert(fallbackPayload)
        .select("id")
        .single());
      
      // fallback 성공 시 경고만 출력
      if (!error) {
        console.warn("[data/planGroups] scheduler_options 컬럼이 없어 해당 필드는 저장되지 않았습니다. 마이그레이션을 실행해주세요.");
      }
    } else {
      // 다른 컬럼 문제인 경우 일반 fallback
      const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
      ({ data, error } = await supabase
        .from("plan_groups")
        .insert(fallbackPayload)
        .select("id")
        .single());
    }
  }

  if (error) {
    // 에러 객체의 모든 속성을 안전하게 추출
    const errorInfo: Record<string, unknown> = {
      message: error.message || String(error),
      code: error.code || "UNKNOWN",
    };
    
    // 에러 객체의 다른 속성들도 추출
    if ("details" in error) errorInfo.details = (error as { details?: unknown }).details;
    if ("hint" in error) errorInfo.hint = (error as { hint?: unknown }).hint;
    if ("statusCode" in error) errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
    
    console.error("[data/planGroups] 플랜 그룹 생성 실패", {
      error: errorInfo,
      studentId: group.student_id,
      tenantId: group.tenant_id,
      payload: Object.keys(payload),
      errorString: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    return { success: false, error: error.message || String(error) };
  }

  return { success: true, groupId: data?.id };
}

/**
 * 플랜 그룹 업데이트
 */
export async function updatePlanGroup(
  groupId: string,
  studentId: string,
  updates: {
    name?: string | null;
    plan_purpose?: string | null;
    scheduler_type?: string | null;
    scheduler_options?: any | null;
    period_start?: string;
    period_end?: string;
    target_date?: string | null;
    block_set_id?: string | null;
    status?: string;
    daily_schedule?: any | null; // JSONB: 일별 스케줄 정보
    subject_constraints?: any | null; // JSONB: 교과 제약 조건
    additional_period_reallocation?: any | null; // JSONB: 추가 기간 재배치 정보
    non_study_time_blocks?: any | null; // JSONB: 학습 시간 제외 항목
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.plan_purpose !== undefined) payload.plan_purpose = updates.plan_purpose;
  if (updates.scheduler_type !== undefined) payload.scheduler_type = updates.scheduler_type;
  if (updates.scheduler_options !== undefined) payload.scheduler_options = updates.scheduler_options;
  if (updates.period_start !== undefined) payload.period_start = updates.period_start;
  if (updates.period_end !== undefined) payload.period_end = updates.period_end;
  if (updates.target_date !== undefined) payload.target_date = updates.target_date;
  if (updates.block_set_id !== undefined) payload.block_set_id = updates.block_set_id;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.daily_schedule !== undefined) payload.daily_schedule = updates.daily_schedule;
  if (updates.subject_constraints !== undefined) payload.subject_constraints = updates.subject_constraints;
  if (updates.additional_period_reallocation !== undefined) payload.additional_period_reallocation = updates.additional_period_reallocation;
  if (updates.non_study_time_blocks !== undefined) payload.non_study_time_blocks = updates.non_study_time_blocks;

  let { error } = await supabase
    .from("plan_groups")
    .update(payload)
    .eq("id", groupId)
    .eq("student_id", studentId)
    .is("deleted_at", null);

  // 컬럼이 없는 경우 fallback 처리
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    // scheduler_options가 포함된 경우 제외하고 재시도
    if (payload.scheduler_options !== undefined) {
      console.warn("[data/planGroups] scheduler_options 컬럼이 없어 fallback 업데이트 사용", {
        groupId,
        studentId,
      });
      
      const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
      ({ error } = await supabase
        .from("plan_groups")
        .update(fallbackPayload)
        .eq("id", groupId)
        .eq("student_id", studentId)
        .is("deleted_at", null));
      
      // scheduler_options가 없어도 다른 필드는 업데이트 성공
      if (!error) {
        console.warn("[data/planGroups] scheduler_options 컬럼이 없어 해당 필드는 저장되지 않았습니다. 마이그레이션을 실행해주세요.");
        return { success: true };
      }
    }
    
    // 다른 컬럼 문제인 경우 일반 fallback
    ({ error } = await supabase
      .from("plan_groups")
      .update(payload)
      .eq("id", groupId));
  }

  if (error) {
    // 에러 객체의 모든 속성을 안전하게 추출
    const errorInfo: Record<string, unknown> = {
      message: error.message || String(error),
      code: error.code || "UNKNOWN",
    };
    
    // 에러 객체의 다른 속성들도 추출
    if ("details" in error) errorInfo.details = (error as { details?: unknown }).details;
    if ("hint" in error) errorInfo.hint = (error as { hint?: unknown }).hint;
    if ("statusCode" in error) errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
    
    console.error("[data/planGroups] 플랜 그룹 업데이트 실패", {
      error: errorInfo,
      groupId,
      studentId,
      payload: Object.keys(payload),
      errorString: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    return { success: false, error: error.message || String(error) };
  }

  return { success: true };
}

/**
 * 플랜 그룹 Soft Delete
 */
export async function deletePlanGroup(
  groupId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("plan_groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", groupId)
    .eq("student_id", studentId)
    .is("deleted_at", null);

  if (error) {
    console.error("[data/planGroups] 플랜 그룹 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 캠프 초대 ID로 플랜 그룹 삭제 (관리자용, Hard Delete)
 * 초대 삭제 시 관련된 플랜 그룹도 함께 삭제하기 위한 함수
 */
export async function deletePlanGroupByInvitationId(
  invitationId: string
): Promise<{ success: boolean; error?: string; deletedGroupId?: string }> {
  const supabase = await createSupabaseServerClient();

  // 1. camp_invitation_id로 플랜 그룹 조회
  const { data: planGroup, error: fetchError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_invitation_id", invitationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    console.error("[data/planGroups] 플랜 그룹 조회 실패", fetchError);
    return { success: false, error: fetchError.message };
  }

  // 플랜 그룹이 없으면 성공으로 처리 (삭제할 것이 없음)
  if (!planGroup) {
    return { success: true };
  }

  const groupId = planGroup.id;
  const studentId = planGroup.student_id;

  // 2. 관련 student_plan 삭제 (hard delete)
  const { error: deletePlansError } = await supabase
    .from("student_plan")
    .delete()
    .eq("plan_group_id", groupId);

  if (deletePlansError) {
    console.error("[data/planGroups] 플랜 삭제 실패", deletePlansError);
    return {
      success: false,
      error: `플랜 삭제 실패: ${deletePlansError.message}`,
    };
  }

  // 3. plan_contents 삭제 (안전을 위해 명시적으로 삭제)
  const { error: deleteContentsError } = await supabase
    .from("plan_contents")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteContentsError) {
    console.error("[data/planGroups] 플랜 콘텐츠 삭제 실패", deleteContentsError);
    // 콘텐츠 삭제 실패해도 계속 진행 (외래키 제약으로 자동 삭제될 수 있음)
  }

  // 4. plan_exclusions 삭제 (안전을 위해 명시적으로 삭제)
  const { error: deleteExclusionsError } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteExclusionsError) {
    console.error(
      "[data/planGroups] 플랜 제외일 삭제 실패",
      deleteExclusionsError
    );
    // 제외일 삭제 실패해도 계속 진행 (외래키 제약으로 자동 삭제될 수 있음)
  }

  // 5. academy_schedules 삭제는 수행하지 않음
  // 이유:
  // - 캠프 모드에서는 academy_schedules가 plan_group_id 없이 저장됨 (학생별 전역 관리)
  // - submitCampParticipation에서 기존 학원 일정을 모두 삭제하고 템플릿 일정으로 교체
  // - 초대 취소 시 academy_schedules를 삭제하면 다른 플랜 그룹의 학원 일정까지 삭제될 위험이 있음
  // - 따라서 academy_schedules는 삭제하지 않고 유지 (다른 플랜 그룹 보호)

  // 6. plan_groups 삭제 (hard delete)
  const { error: deleteGroupError } = await supabase
    .from("plan_groups")
    .delete()
    .eq("id", groupId);

  if (deleteGroupError) {
    console.error("[data/planGroups] 플랜 그룹 삭제 실패", deleteGroupError);
    return {
      success: false,
      error: `플랜 그룹 삭제 실패: ${deleteGroupError.message}`,
    };
  }

  return { success: true, deletedGroupId: groupId };
}

/**
 * 캠프 템플릿 ID로 플랜 그룹 삭제 (관리자용, Hard Delete)
 * 템플릿 삭제 시 관련된 플랜 그룹도 함께 삭제하기 위한 함수
 * 여러 플랜 그룹이 있을 수 있으므로 모두 삭제
 */
export async function deletePlanGroupsByTemplateId(
  templateId: string
): Promise<{ success: boolean; error?: string; deletedGroupIds?: string[] }> {
  const supabase = await createSupabaseServerClient();

  // 1. camp_template_id로 플랜 그룹 조회 (여러 개일 수 있음)
  const { data: planGroups, error: fetchError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .is("deleted_at", null);

  if (fetchError) {
    console.error("[data/planGroups] 플랜 그룹 조회 실패", fetchError);
    return { success: false, error: fetchError.message };
  }

  // 플랜 그룹이 없으면 성공으로 처리 (삭제할 것이 없음)
  if (!planGroups || planGroups.length === 0) {
    return { success: true, deletedGroupIds: [] };
  }

  const groupIds = planGroups.map((g) => g.id);
  const deletedGroupIds: string[] = [];

  // 2. 각 플랜 그룹에 대해 관련 데이터 삭제
  for (const groupId of groupIds) {
    // 2-1. 관련 student_plan 삭제 (hard delete)
    const { error: deletePlansError } = await supabase
      .from("student_plan")
      .delete()
      .eq("plan_group_id", groupId);

    if (deletePlansError) {
      console.error(
        `[data/planGroups] 플랜 삭제 실패 (groupId: ${groupId})`,
        deletePlansError
      );
      // 개별 플랜 삭제 실패해도 계속 진행
    }

    // 2-2. plan_contents 삭제 (안전을 위해 명시적으로 삭제)
    const { error: deleteContentsError } = await supabase
      .from("plan_contents")
      .delete()
      .eq("plan_group_id", groupId);

    if (deleteContentsError) {
      console.error(
        `[data/planGroups] 플랜 콘텐츠 삭제 실패 (groupId: ${groupId})`,
        deleteContentsError
      );
      // 콘텐츠 삭제 실패해도 계속 진행
    }

    // 2-3. plan_exclusions 삭제 (안전을 위해 명시적으로 삭제)
    const { error: deleteExclusionsError } = await supabase
      .from("plan_exclusions")
      .delete()
      .eq("plan_group_id", groupId);

    if (deleteExclusionsError) {
      console.error(
        `[data/planGroups] 플랜 제외일 삭제 실패 (groupId: ${groupId})`,
        deleteExclusionsError
      );
      // 제외일 삭제 실패해도 계속 진행
    }

    // 2-4. plan_groups 삭제 (hard delete)
    const { error: deleteGroupError } = await supabase
      .from("plan_groups")
      .delete()
      .eq("id", groupId);

    if (deleteGroupError) {
      console.error(
        `[data/planGroups] 플랜 그룹 삭제 실패 (groupId: ${groupId})`,
        deleteGroupError
      );
      // 개별 플랜 그룹 삭제 실패는 기록만 하고 계속 진행
    } else {
      deletedGroupIds.push(groupId);
    }
  }

  return { success: true, deletedGroupIds };
}

/**
 * 플랜 그룹 콘텐츠 조회
 */
export async function getPlanContents(
  groupId: string,
  tenantId?: string | null
): Promise<PlanContent[]> {
  const supabase = await createSupabaseServerClient();

  console.log("[getPlanContents] 조회 시작:", {
    groupId,
    tenantId,
  });

  const selectContents = () =>
    supabase
      .from("plan_contents")
      .select(
        "id,tenant_id,plan_group_id,content_type,content_id,master_content_id,start_range,end_range,start_detail_id,end_detail_id,display_order,is_auto_recommended,recommendation_source,recommendation_reason,recommendation_metadata,recommended_at,recommended_by,created_at,updated_at"
      )
      .eq("plan_group_id", groupId)
      .order("display_order", { ascending: true });

  let query = selectContents();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  console.log("[getPlanContents] 조회 결과:", {
    groupId,
    tenantId,
    dataCount: data?.length || 0,
    error: error ? { message: error.message, code: error.code } : null,
    contents: data?.map((c) => ({
      content_type: c.content_type,
      content_id: c.content_id,
      master_content_id: c.master_content_id,
      start_range: c.start_range,
      end_range: c.end_range,
    })),
  });

  if (error && error.code === "42703") {
    // 컬럼이 없는 경우 fallback 쿼리 시도
    const fallbackSelect = () =>
      supabase
        .from("plan_contents")
        .select("id,tenant_id,plan_group_id,content_type,content_id,master_content_id,start_range,end_range,start_detail_id,end_detail_id,display_order,is_auto_recommended,recommendation_source,recommendation_reason,recommendation_metadata,recommended_at,recommended_by,created_at,updated_at")
        .eq("plan_group_id", groupId)
        .order("display_order", { ascending: true });
    
    let fallbackQuery = fallbackSelect();
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
    }
    
    ({ data, error } = await fallbackQuery);
  }

  if (error) {
    // 에러 정보를 더 자세히 로깅
    const { details, hint } = getErrorDetails(error);
    const errorInfo: Record<string, unknown> = {
      message: isPostgrestError(error) ? error.message : String(error),
      code: isPostgrestError(error) ? error.code : "UNKNOWN",
      details,
      hint,
      groupId,
      tenantId,
    };
    
    console.error("[data/planGroups] 플랜 콘텐츠 조회 실패", errorInfo);
    
    // 에러가 발생해도 빈 배열 반환 (페이지가 깨지지 않도록)
    return [];
  }

  return (data as PlanContent[] | null) ?? [];
}

/**
 * 플랜 그룹 콘텐츠 일괄 생성
 */
export async function createPlanContents(
  groupId: string,
  tenantId: string,
  contents: Array<{
    content_type: string;
    content_id: string;
    master_content_id?: string | null; // 마스터 콘텐츠 ID (학생 콘텐츠가 마스터 콘텐츠와 연계된 경우)
    start_range: number;
    end_range: number;
    display_order?: number;
    // 자동 추천 관련 필드 (선택)
    is_auto_recommended?: boolean;
    recommendation_source?: "auto" | "admin" | "template" | null;
    recommendation_reason?: string | null;
    recommendation_metadata?: {
      scoreDetails?: {
        schoolGrade?: number | null;
        schoolAverageGrade?: number | null;
        mockPercentile?: number | null;
        mockGrade?: number | null;
        riskScore?: number;
      };
      priority?: number;
    } | null;
    recommended_at?: string | null;
    recommended_by?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (contents.length === 0) {
    return { success: true };
  }

  const payload = contents.map((content, index) => ({
    tenant_id: tenantId,
    plan_group_id: groupId,
    content_type: content.content_type,
    content_id: content.content_id,
    master_content_id: content.master_content_id ?? null,
    start_range: content.start_range,
    end_range: content.end_range,
    start_detail_id: (content as any).start_detail_id ?? null,
    end_detail_id: (content as any).end_detail_id ?? null,
    display_order: content.display_order ?? index,
    // 자동 추천 관련 필드
    is_auto_recommended: content.is_auto_recommended ?? false,
    recommendation_source: content.recommendation_source ?? null,
    recommendation_reason: content.recommendation_reason ?? null,
    recommendation_metadata: content.recommendation_metadata ?? null,
    recommended_at: content.recommended_at ?? null,
    recommended_by: content.recommended_by ?? null,
  }));

  let { error } = await supabase.from("plan_contents").insert(payload);

  if (error && error.code === "42703") {
    // 필드가 없는 경우 fallback (하위 호환성)
    const fallbackPayload = payload.map(({ 
      tenant_id: _tenantId, 
      master_content_id: _masterContentId,
      is_auto_recommended: _isAuto,
      recommendation_source: _source,
      recommendation_reason: _reason,
      recommendation_metadata: _metadata,
      recommended_at: _at,
      recommended_by: _by,
      ...rest 
    }) => rest);
    ({ error } = await supabase.from("plan_contents").insert(fallbackPayload));
  }

  if (error) {
    console.error("[data/planGroups] 플랜 콘텐츠 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 그룹 제외일 조회 (플랜 그룹별 관리)
 */
export async function getPlanExclusions(
  groupId: string,
  tenantId?: string | null
): Promise<PlanExclusion[]> {
  const supabase = await createSupabaseServerClient();

  const selectExclusions = () =>
    supabase
      .from("plan_exclusions")
      .select("id,tenant_id,student_id,plan_group_id,exclusion_date,exclusion_type,reason,created_at")
      .eq("plan_group_id", groupId)
      .order("exclusion_date", { ascending: true });

  let query = selectExclusions();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  if (error && error.code === "42703") {
    ({ data, error } = await selectExclusions());
  }

  if (error) {
    console.error("[data/planGroups] 플랜 그룹 제외일 조회 실패", error);
    return [];
  }

  return (data as PlanExclusion[] | null) ?? [];
}

/**
 * 학생별 제외일 조회 (전역 관리)
 */
export async function getStudentExclusions(
  studentId: string,
  tenantId?: string | null
): Promise<PlanExclusion[]> {
  const supabase = await createSupabaseServerClient();

  const selectExclusions = () =>
    supabase
      .from("plan_exclusions")
      .select("id,tenant_id,student_id,exclusion_date,exclusion_type,reason,created_at")
      .eq("student_id", studentId)
      .order("exclusion_date", { ascending: true });

  let query = selectExclusions();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  if (error && error.code === "42703") {
    ({ data, error } = await selectExclusions());
  }

  if (error) {
    console.error("[data/planGroups] 학생 제외일 조회 실패", error);
    return [];
  }

  return (data as PlanExclusion[] | null) ?? [];
}

/**
 * 플랜 그룹 제외일 일괄 생성 (플랜 그룹별 관리)
 */
export async function createPlanExclusions(
  groupId: string,
  tenantId: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (exclusions.length === 0) {
    return { success: true };
  }

  // 플랜 그룹에서 student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();
  
  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  // 중복 체크: 현재 플랜 그룹 내 제외일 조회 (날짜+유형 조합)
  const currentExclusionsQuery = supabase
    .from("plan_exclusions")
    .select("id, exclusion_date, exclusion_type")
    .eq("student_id", group.student_id)
    .eq("plan_group_id", groupId);
  
  if (tenantId) {
    currentExclusionsQuery.eq("tenant_id", tenantId);
  }
  
  const { data: currentExclusions, error: exclusionsError } = await currentExclusionsQuery;
  
  if (exclusionsError) {
    console.error("[data/planGroups] 제외일 조회 실패 (중복 체크용)", exclusionsError);
  }

  // 현재 플랜 그룹에 이미 있는 제외일 (날짜+유형 조합)
  const existingKeys = new Set(
    (currentExclusions || []).map(
      (e) => `${e.exclusion_date}-${e.exclusion_type}`
    )
  );

  // 시간 관리 영역의 제외일 조회 (plan_group_id가 NULL이거나 다른 플랜 그룹)
  const timeManagementExclusionsQuery = supabase
    .from("plan_exclusions")
    .select("id, exclusion_date, exclusion_type, reason")
    .eq("student_id", group.student_id);
  
  if (tenantId) {
    timeManagementExclusionsQuery.eq("tenant_id", tenantId);
  }
  
  // plan_group_id가 NULL이거나 현재 그룹이 아닌 것
  timeManagementExclusionsQuery.or(`plan_group_id.is.null,plan_group_id.neq.${groupId}`);
  
  const { data: timeManagementExclusions } = await timeManagementExclusionsQuery;
  
  // 시간 관리 영역의 제외일을 키로 매핑
  const timeManagementMap = new Map(
    (timeManagementExclusions || []).map((e) => [
      `${e.exclusion_date}-${e.exclusion_type}`,
      e,
    ])
  );

  // 업데이트할 항목과 새로 생성할 항목 분리
  const toUpdate: Array<{ id: string; exclusion: typeof exclusions[0] }> = [];
  const toInsert: typeof exclusions = [];

  for (const exclusion of exclusions) {
    const key = `${exclusion.exclusion_date}-${exclusion.exclusion_type}`;
    
    // 현재 플랜 그룹에 이미 있으면 스킵
    if (existingKeys.has(key)) {
      console.log(`[createPlanExclusions] 이미 존재하는 제외일 스킵: ${key}`);
      continue;
    }
    
    // 시간 관리 영역에 있으면 업데이트
    const timeManagementExclusion = timeManagementMap.get(key);
    if (timeManagementExclusion) {
      toUpdate.push({
        id: timeManagementExclusion.id,
        exclusion,
      });
    } else {
      // 없으면 새로 생성
      toInsert.push(exclusion);
    }
  }

  console.log(`[createPlanExclusions] 처리 요약: 업데이트 ${toUpdate.length}개, 생성 ${toInsert.length}개, 스킵 ${exclusions.length - toUpdate.length - toInsert.length}개`);

  // 시간 관리 영역의 제외일을 현재 플랜 그룹으로 업데이트
  if (toUpdate.length > 0) {
    for (const { id, exclusion } of toUpdate) {
      const { error: updateError } = await supabase
        .from("plan_exclusions")
        .update({
          plan_group_id: groupId,
          reason: exclusion.reason || null,
        })
        .eq("id", id);

      if (updateError) {
        console.error(
          `[createPlanExclusions] 제외일 업데이트 실패 (id: ${id}), 새로 생성으로 폴백`,
          updateError
        );
        // 업데이트 실패 시 새로 생성 목록에 추가
        toInsert.push(exclusion);
      } else {
        console.log(`[createPlanExclusions] 제외일 재활용 성공: ${exclusion.exclusion_date} (${exclusion.exclusion_type})`);
      }
    }
  }

  // 새로 생성할 제외일
  if (toInsert.length > 0) {
    const payload = toInsert.map((exclusion) => ({
      tenant_id: tenantId,
      student_id: group.student_id,
      plan_group_id: groupId,
      exclusion_date: exclusion.exclusion_date,
      exclusion_type: exclusion.exclusion_type,
      reason: exclusion.reason || null,
    }));

    let { error } = await supabase.from("plan_exclusions").insert(payload);

    if (error && error.code === "42703") {
      const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
      ({ error } = await supabase.from("plan_exclusions").insert(fallbackPayload));
    }

    // 중복 키 에러 처리 (데이터베이스 레벨 unique 제약조건)
    if (error && (error.code === "23505" || error.message?.includes("duplicate"))) {
      return {
        success: false,
        error: "이미 등록된 제외일이 있습니다.",
      };
    }

    if (error) {
      console.error("[createPlanExclusions] 플랜 그룹 제외일 생성 실패", error);
      return { success: false, error: error.message };
    }

    console.log(`[createPlanExclusions] 제외일 생성 완료: ${toInsert.length}개`);
  }

  return { success: true };
}

/**
 * 학생별 제외일 일괄 생성 (전역 관리)
 */
export async function createStudentExclusions(
  studentId: string,
  tenantId: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (exclusions.length === 0) {
    return { success: true };
  }

  // 중복 체크: 같은 날짜의 제외일이 이미 있으면 스킵
  const existingExclusions = await getStudentExclusions(studentId, tenantId);
  const existingDates = new Set(existingExclusions.map((e) => e.exclusion_date));

  const newExclusions = exclusions.filter(
    (e) => !existingDates.has(e.exclusion_date)
  );

  if (newExclusions.length === 0) {
    return { success: true }; // 모든 제외일이 이미 존재
  }

  const payload = newExclusions.map((exclusion) => ({
    tenant_id: tenantId,
    student_id: studentId,
    exclusion_date: exclusion.exclusion_date,
    exclusion_type: exclusion.exclusion_type,
    reason: exclusion.reason || null,
  }));

  let { error } = await supabase.from("plan_exclusions").insert(payload);

  if (error && error.code === "42703") {
    const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
    ({ error } = await supabase.from("plan_exclusions").insert(fallbackPayload));
  }

  if (error) {
    console.error("[data/planGroups] 학생 제외일 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 플랜 그룹별 학원 일정 조회 (Phase 2: plan_group_id 기반)
 */
export async function getAcademySchedules(
  groupId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  const supabase = await createSupabaseServerClient();
  
  // academies와 조인하여 travel_time 가져오기
  const selectSchedules = () =>
    supabase
      .from("academy_schedules")
      .select(
        "id,tenant_id,student_id,plan_group_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
      )
      .eq("plan_group_id", groupId) // plan_group_id로 조회 (플랜 그룹별 관리)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

  let query = selectSchedules();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;
  let schedulesData: AcademySchedule[] | null = data as AcademySchedule[] | null;

  // tenant_id 컬럼 없는 경우 재시도
  if (error && error.code === "42703") {
    console.warn("[getAcademySchedules] tenant_id 컬럼 없음, 재시도");
    const retryQuery = supabase
      .from("academy_schedules")
      .select(
        "id,student_id,plan_group_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
      )
      .eq("plan_group_id", groupId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    const retryResult = await retryQuery;
    error = retryResult.error;
    
    // tenant_id를 null로 설정
    if (retryResult.data && !error) {
      schedulesData = retryResult.data.map((schedule: AcademySchedule) => ({ ...schedule, tenant_id: null })) as AcademySchedule[];
    } else {
      schedulesData = (retryResult.data as AcademySchedule[] | null) ?? null;
    }
  }

  if (error) {
    console.error("[getAcademySchedules] 학원 일정 조회 실패", error);
    return [];
  }

  // travel_time 추출 및 반환
  type ScheduleWithAcademies = AcademySchedule & {
    academies?: { travel_time?: number } | Array<{ travel_time?: number }> | null;
  };
  
  return (
    schedulesData?.map((schedule) => {
      const scheduleWithAcademies = schedule as ScheduleWithAcademies;
      const travelTime = Array.isArray(scheduleWithAcademies.academies)
        ? scheduleWithAcademies.academies[0]?.travel_time ?? 60
        : (scheduleWithAcademies.academies as { travel_time?: number } | null)?.travel_time ?? 60;
      return {
        ...schedule,
        travel_time: travelTime,
      };
    }) || []
  );
}

/**
 * 학생별 학원 일정 조회 (전역 관리)
 */
export async function getStudentAcademySchedules(
  studentId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  const supabase = await createSupabaseServerClient();

  // academies와 조인하여 travel_time 가져오기
  const selectSchedules = () =>
    supabase
      .from("academy_schedules")
      .select(
        "id,tenant_id,student_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
      )
      .eq("student_id", studentId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

  let query = selectSchedules();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;
  let studentSchedulesData: AcademySchedule[] | null = (data as AcademySchedule[] | null) ?? null;

  if (error && isPostgrestError(error) && error.code === "42703") {
    // academy_id가 없는 경우를 대비한 fallback
    const fallbackSelect = () =>
      supabase
        .from("academy_schedules")
        .select(
          "id,tenant_id,student_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at"
        )
        .eq("student_id", studentId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
    
    let fallbackQuery = fallbackSelect();
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
    }
    const fallbackResult = await fallbackQuery;
    error = fallbackResult.error;
    
    // academy_id를 빈 문자열로 설정
    if (fallbackResult.data && !error) {
      studentSchedulesData = fallbackResult.data.map((schedule: AcademySchedule) => ({ ...schedule, academy_id: "" })) as AcademySchedule[];
    } else {
      studentSchedulesData = (fallbackResult.data as AcademySchedule[] | null) ?? null;
    }
  }

  if (error) {
    console.error("[data/planGroups] 학생 학원 일정 조회 실패", error);
    return [];
  }

  // 데이터 변환: academies 관계 데이터를 travel_time으로 변환
  type ScheduleWithAcademies = AcademySchedule & {
    academies?: { travel_time?: number } | null;
  };
  
  const schedules = (studentSchedulesData ?? []) as ScheduleWithAcademies[];
  return schedules.map((schedule) => ({
    ...schedule,
    travel_time: schedule.academies?.travel_time ?? 60, // 기본값 60분
    academies: undefined, // 관계 데이터 제거
  })) as AcademySchedule[];
}

/**
 * 플랜 그룹 학원 일정 일괄 생성 (학생별 전역 관리)
 * @deprecated createStudentAcademySchedules 사용 권장
 */
export async function createAcademySchedules(
  groupId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  // 하위 호환성을 위해 student_id를 조회하여 사용
  const supabase = await createSupabaseServerClient();
  
  // 플랜 그룹에서 student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();
  
  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }
  
  return createStudentAcademySchedules(group.student_id, tenantId, schedules);
}

/**
 * 플랜 그룹별 학원 일정 생성
 * @param groupId 플랜 그룹 ID
 * @param tenantId 테넌트 ID
 * @param schedules 생성할 학원 일정 목록
 * @param useAdminClient 관리자 모드일 때 true로 설정 (RLS 우회)
 */
export async function createPlanAcademySchedules(
  groupId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // 관리자 모드일 때 Admin 클라이언트 사용 (RLS 우회)
  let supabase;
  if (useAdminClient) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn("[createPlanAcademySchedules] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      supabase = await createSupabaseServerClient();
    } else {
      supabase = adminClient;
    }
  } else {
    supabase = await createSupabaseServerClient();
  }

  if (schedules.length === 0) {
    console.log("[createPlanAcademySchedules] 학원 일정이 없습니다.");
    return { success: true };
  }

  // 플랜 그룹에서 student_id 조회
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();
  
  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  // 디버깅: 입력된 학원 일정 확인
  console.log("[createPlanAcademySchedules] 입력된 학원 일정:", {
    groupId,
    studentId: group.student_id,
    tenantId,
    schedulesCount: schedules.length,
    schedules: schedules,
  });

  const studentId = group.student_id;

  // 중복 체크: 현재 플랜 그룹의 기존 학원 일정 조회
  const existingSchedules = await getAcademySchedules(groupId, tenantId);
  const existingKeys = new Set(
    existingSchedules.map((s) => 
      `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`
    )
  );

  console.log("[createPlanAcademySchedules] 기존 학원 일정 (현재 플랜 그룹):", {
    existingSchedulesCount: existingSchedules.length,
  });

  // 시간 관리 영역의 학원 일정 조회 (plan_group_id가 NULL이거나 다른 플랜 그룹)
  const timeManagementSchedulesQuery = supabase
    .from("academy_schedules")
    .select("id, day_of_week, start_time, end_time, academy_name, subject, academy_id")
    .eq("student_id", studentId);
  
  if (tenantId) {
    timeManagementSchedulesQuery.eq("tenant_id", tenantId);
  }
  
  // plan_group_id가 NULL이거나 현재 그룹이 아닌 것
  timeManagementSchedulesQuery.or(`plan_group_id.is.null,plan_group_id.neq.${groupId}`);
  
  const { data: timeManagementSchedules } = await timeManagementSchedulesQuery;
  
  // 시간 관리 영역의 학원 일정을 키로 매핑
  const timeManagementMap = new Map(
    (timeManagementSchedules || []).map((s) => [
      `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`,
      s,
    ])
  );

  // 업데이트할 항목과 새로 생성할 항목 분리
  const toUpdate: Array<{ id: string; schedule: typeof schedules[0] }> = [];
  const toInsert: typeof schedules = [];

  for (const schedule of schedules) {
    const key = `${schedule.day_of_week}:${schedule.start_time}:${schedule.end_time}:${schedule.academy_name || ""}:${schedule.subject || ""}`;
    
    // 현재 플랜 그룹에 이미 있으면 스킵
    if (existingKeys.has(key)) {
      console.log(`[createPlanAcademySchedules] 이미 존재하는 학원 일정 스킵: ${key}`);
      continue;
    }
    
    // 시간 관리 영역에 있으면 업데이트
    const timeManagementSchedule = timeManagementMap.get(key);
    if (timeManagementSchedule) {
      toUpdate.push({
        id: timeManagementSchedule.id,
        schedule,
      });
    } else {
      // 없으면 새로 생성
      toInsert.push(schedule);
    }
  }

  console.log(`[createPlanAcademySchedules] 처리 요약: 업데이트 ${toUpdate.length}개, 생성 ${toInsert.length}개, 스킵 ${schedules.length - toUpdate.length - toInsert.length}개`);

  // academy_name별로 academy를 찾거나 생성하는 헬퍼 함수
  const getOrCreateAcademy = async (academyName: string): Promise<string | null> => {
    const { data: existingAcademy } = await supabase
      .from("academies")
      .select("id")
      .eq("student_id", studentId)
      .eq("name", academyName)
      .maybeSingle();

    if (existingAcademy) {
      return existingAcademy.id;
    }

    // 새 academy 생성
    const { data: newAcademy, error: academyError } = await supabase
      .from("academies")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        name: academyName,
        travel_time: 60,
      })
      .select("id")
      .single();

    if (academyError || !newAcademy) {
      console.error("[createPlanAcademySchedules] 학원 생성 실패", academyError);
      return null;
    }

    return newAcademy.id;
  };

  // 시간 관리 영역의 학원 일정을 현재 플랜 그룹으로 업데이트
  if (toUpdate.length > 0) {
    for (const { id, schedule } of toUpdate) {
      // academy_name으로 academy 찾기 또는 생성
      const academyName = schedule.academy_name || "학원";
      const academyId = await getOrCreateAcademy(academyName);
      
      if (!academyId) {
        console.error(`[createPlanAcademySchedules] 학원 ID 확보 실패: ${academyName}, 새로 생성으로 폴백`);
        toInsert.push(schedule);
        continue;
      }

      const { error: updateError } = await supabase
        .from("academy_schedules")
        .update({
          plan_group_id: groupId,
          academy_id: academyId,
          academy_name: schedule.academy_name || null,
          subject: schedule.subject || null,
        })
        .eq("id", id);

      if (updateError) {
        console.error(
          `[createPlanAcademySchedules] 학원 일정 업데이트 실패 (id: ${id}), 새로 생성으로 폴백`,
          updateError
        );
        toInsert.push(schedule);
      } else {
        console.log(`[createPlanAcademySchedules] 학원 일정 재활용 성공: ${schedule.day_of_week}요일 ${schedule.start_time}-${schedule.end_time}`);
      }
    }
  }

  // 새로 생성할 학원 일정
  if (toInsert.length > 0) {
    // academy_name별로 academy를 찾거나 생성
    const academyNameMap = new Map<string, string>();

    for (const schedule of toInsert) {
      const academyName = schedule.academy_name || "학원";
      
      if (!academyNameMap.has(academyName)) {
        const academyId = await getOrCreateAcademy(academyName);
        if (!academyId) {
          return { success: false, error: `학원 생성에 실패했습니다: ${academyName}` };
        }
        academyNameMap.set(academyName, academyId);
      }
    }

    // academy_id와 plan_group_id를 포함한 payload 생성
    const payload = toInsert.map((schedule) => {
      const academyName = schedule.academy_name || "학원";
      const academyId = academyNameMap.get(academyName);
      
      if (!academyId) {
        throw new Error(`학원 ID를 찾을 수 없습니다: ${academyName}`);
      }

      return {
        tenant_id: tenantId,
        student_id: studentId,
        plan_group_id: groupId,
        academy_id: academyId,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        academy_name: schedule.academy_name || null,
        subject: schedule.subject || null,
      };
    });

    let { error } = await supabase.from("academy_schedules").insert(payload);

    if (error && error.code === "42703") {
      const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
      ({ error } = await supabase.from("academy_schedules").insert(fallbackPayload));
    }

    if (error) {
      console.error("[createPlanAcademySchedules] 학원 일정 생성 실패", error);
      return { success: false, error: error.message };
    }

    console.log(`[createPlanAcademySchedules] 학원 일정 생성 완료: ${toInsert.length}개`);
  }

  return { success: true };
}

/**
 * 학생별 학원 일정 일괄 생성 (전역 관리)
 * @deprecated Phase 2 이후 createPlanAcademySchedules 사용 권장
 * @param useAdminClient 관리자 모드일 때 true로 설정 (RLS 우회)
 */
export async function createStudentAcademySchedules(
  studentId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // 관리자 모드일 때 Admin 클라이언트 사용 (RLS 우회)
  let supabase;
  if (useAdminClient) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn("[createStudentAcademySchedules] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      supabase = await createSupabaseServerClient();
    } else {
      supabase = adminClient;
    }
  } else {
    supabase = await createSupabaseServerClient();
  }

  if (schedules.length === 0) {
    console.log("[createStudentAcademySchedules] 학원 일정이 없습니다.");
    return { success: true };
  }

  // 디버깅: 입력된 학원 일정 확인
  console.log("[createStudentAcademySchedules] 입력된 학원 일정:", {
    studentId,
    tenantId,
    schedulesCount: schedules.length,
    schedules: schedules,
  });

  // 중복 체크: 같은 요일, 시간대의 학원 일정이 이미 있으면 스킵
  const existingSchedules = await getStudentAcademySchedules(studentId, tenantId);
  const existingKeys = new Set(
    existingSchedules.map((s) => `${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  // 디버깅: 기존 학원 일정 확인
  console.log("[createStudentAcademySchedules] 기존 학원 일정:", {
    existingSchedulesCount: existingSchedules.length,
    existingKeys: Array.from(existingKeys),
  });

  const newSchedules = schedules.filter(
    (s) => !existingKeys.has(`${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  // 디버깅: 필터링된 새 학원 일정 확인
  console.log("[createStudentAcademySchedules] 필터링된 새 학원 일정:", {
    newSchedulesCount: newSchedules.length,
    newSchedules: newSchedules,
    skippedCount: schedules.length - newSchedules.length,
  });

  if (newSchedules.length === 0) {
    console.log("[createStudentAcademySchedules] 모든 학원 일정이 이미 존재합니다.");
    return { success: true }; // 모든 학원 일정이 이미 존재
  }

  // academy_name별로 academy를 찾거나 생성
  const academyNameMap = new Map<string, string>(); // academy_name -> academy_id

  for (const schedule of newSchedules) {
    const academyName = schedule.academy_name || "학원";
    
    if (!academyNameMap.has(academyName)) {
      // 기존 academy 찾기
      const { data: existingAcademy } = await supabase
        .from("academies")
        .select("id")
        .eq("student_id", studentId)
        .eq("name", academyName)
        .maybeSingle();

      let academyId: string;
      
      if (existingAcademy) {
        academyId = existingAcademy.id;
      } else {
        // 새 academy 생성
        const { data: newAcademy, error: academyError } = await supabase
          .from("academies")
          .insert({
            student_id: studentId,
            tenant_id: tenantId,
            name: academyName,
            travel_time: 60, // 기본값
          })
          .select("id")
          .single();

        if (academyError || !newAcademy) {
          console.error("[data/planGroups] 학원 생성 실패", {
            error: academyError,
            studentId,
            tenantId,
            academyName,
            useAdminClient,
          });
          return { success: false, error: academyError?.message || "학원 생성에 실패했습니다." };
        }

        academyId = newAcademy.id;
      }

      academyNameMap.set(academyName, academyId);
    }
  }

  // academy_id를 포함한 payload 생성
  // 주의: 이 함수는 deprecated되었으며, Phase 2 이후 plan_group_id가 필수입니다.
  // 이 함수는 시간 관리 메뉴에서만 사용되며, 마이그레이션 전까지만 유효합니다.
  const payload = newSchedules.map((schedule) => {
    const academyName = schedule.academy_name || "학원";
    const academyId = academyNameMap.get(academyName);
    
    if (!academyId) {
      throw new Error(`학원 ID를 찾을 수 없습니다: ${academyName}`);
    }

    return {
      tenant_id: tenantId,
      student_id: studentId,
      // plan_group_id는 마이그레이션 후 NOT NULL이므로 이 함수는 더 이상 사용 불가
      academy_id: academyId,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      academy_name: schedule.academy_name || null, // 하위 호환성
      subject: schedule.subject || null,
    };
  });

  let { error } = await supabase.from("academy_schedules").insert(payload);

  if (error && error.code === "42703") {
    const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
    ({ error } = await supabase.from("academy_schedules").insert(fallbackPayload));
  }

  if (error) {
    console.error("[data/planGroups] 학생 학원 일정 생성 실패", error);
    return { success: false, error: error.message };
  }

  console.log("[createStudentAcademySchedules] 학원 일정 저장 완료:", {
    savedCount: payload.length,
    savedSchedules: payload,
  });

  return { success: true };
}

/**
 * 관리자용 플랜 그룹 조회 (student_id 없이 조회)
 */
export async function getPlanGroupByIdForAdmin(
  groupId: string,
  tenantId: string
): Promise<PlanGroup | null> {
  const supabase = await createSupabaseServerClient();

  const selectGroup = () =>
    supabase
      .from("plan_groups")
      .select(
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
      )
      .eq("id", groupId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

  let { data, error } = await selectGroup().maybeSingle<PlanGroup>();

  if (error && error.code === "42703") {
    // 컬럼이 없는 경우 fallback
    const fallbackSelect = () =>
      supabase
        .from("plan_groups")
        .select(
          "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
        )
        .eq("id", groupId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);

    ({ data, error } = await fallbackSelect().maybeSingle<PlanGroup>());

    if (data && !error) {
      data = { ...data, scheduler_options: null } as PlanGroup;
    }
  }

  if (error && error.code !== "PGRST116") {
    console.error("[data/planGroups] 관리자용 플랜 그룹 조회 실패", {
      error,
      groupId,
      tenantId,
    });
    return null;
  }

  return data ?? null;
}

/**
 * 플랜 그룹 전체 조회 (관련 데이터 포함)
 */
export async function getPlanGroupWithDetails(
  groupId: string,
  studentId: string,
  tenantId?: string | null
): Promise<{
  group: PlanGroup | null;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
}> {
  // 플랜 그룹별 제외일과 학원 일정 조회
  // 각 조회가 실패해도 다른 데이터는 정상적으로 반환되도록 Promise.allSettled 사용
  const [groupResult, contentsResult, exclusionsResult, academySchedulesResult] = await Promise.allSettled([
    getPlanGroupById(groupId, studentId, tenantId),
    getPlanContents(groupId, tenantId),
    getPlanExclusions(groupId, tenantId), // 플랜 그룹별 제외일
    getStudentAcademySchedules(studentId, tenantId), // 학원 일정은 여전히 전역 관리
  ]);

  // 결과 추출 (실패 시 기본값 사용)
  const group = groupResult.status === "fulfilled" ? groupResult.value : null;
  const contents = contentsResult.status === "fulfilled" ? contentsResult.value : [];
  const exclusions = exclusionsResult.status === "fulfilled" ? exclusionsResult.value : [];
  const academySchedules = academySchedulesResult.status === "fulfilled" ? academySchedulesResult.value : [];

  // 실패한 조회가 있으면 로깅
  if (contentsResult.status === "rejected") {
    console.error("[data/planGroups] 플랜 콘텐츠 조회 실패 (getPlanGroupWithDetails)", {
      groupId,
      tenantId,
      error: contentsResult.reason,
    });
  }
  if (exclusionsResult.status === "rejected") {
    console.error("[data/planGroups] 플랜 제외일 조회 실패 (getPlanGroupWithDetails)", {
      groupId,
      tenantId,
      error: exclusionsResult.reason,
    });
  }
  if (academySchedulesResult.status === "rejected") {
    console.error("[data/planGroups] 학원 일정 조회 실패 (getPlanGroupWithDetails)", {
      studentId,
      tenantId,
      error: academySchedulesResult.reason,
    });
  }

  return {
    group,
    contents,
    exclusions,
    academySchedules,
  };
}

/**
 * 관리자용 플랜 그룹 전체 조회 (관련 데이터 포함)
 */
export async function getPlanGroupWithDetailsForAdmin(
  groupId: string,
  tenantId: string
): Promise<{
  group: PlanGroup | null;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
}> {
  const group = await getPlanGroupByIdForAdmin(groupId, tenantId);
  
  if (!group) {
    return {
      group: null,
      contents: [],
      exclusions: [],
      academySchedules: [],
    };
  }

  // 관리자용 학원 일정 조회 (RLS 우회를 위해 Admin 클라이언트 사용)
  const getAcademySchedulesForAdmin = async (): Promise<AcademySchedule[]> => {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();
    
    if (!adminClient) {
      // Admin 클라이언트를 생성할 수 없으면 일반 함수 사용 (fallback)
      console.warn("[getPlanGroupWithDetailsForAdmin] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      return getStudentAcademySchedules(group.student_id, tenantId);
    }

    // academies와 조인하여 travel_time 가져오기
    const selectSchedules = () =>
      adminClient
        .from("academy_schedules")
        .select(
          "id,tenant_id,student_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
        )
        .eq("student_id", group.student_id)
        .eq("tenant_id", tenantId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

    let { data, error } = await selectSchedules();
    let adminSchedulesData: AcademySchedule[] | null = data as AcademySchedule[] | null;

    if (error && error.code === "42703") {
      // academy_id가 없는 경우를 대비한 fallback
      const fallbackSelect = () =>
        adminClient
          .from("academy_schedules")
          .select(
            "id,tenant_id,student_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at"
          )
          .eq("student_id", group.student_id)
          .eq("tenant_id", tenantId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

      const fallbackResult = await fallbackSelect();
      error = fallbackResult.error;
      
      // academy_id를 null로 설정
      if (fallbackResult.data && !error) {
        adminSchedulesData = fallbackResult.data.map((schedule: AcademySchedule) => ({ ...schedule, academy_id: "" })) as AcademySchedule[];
      } else {
        adminSchedulesData = (fallbackResult.data as AcademySchedule[] | null) ?? null;
      }
    }

    if (error) {
      console.error("[getPlanGroupWithDetailsForAdmin] 관리자용 학원 일정 조회 실패:", {
        groupId,
        studentId: group.student_id,
        tenantId,
        error,
      });
      // 에러 발생 시 빈 배열 반환
      return [];
    }

    // 데이터 변환: academies 관계 데이터를 travel_time으로 변환
    type ScheduleWithAcademies = AcademySchedule & {
      academies?: { travel_time?: number } | null;
    };
    
    const schedules = (adminSchedulesData ?? []) as ScheduleWithAcademies[];
    const academySchedules = schedules.map((schedule) => ({
      ...schedule,
      travel_time: schedule.academies?.travel_time ?? 60, // 기본값 60분
      academies: undefined, // 관계 데이터 제거
    })) as AcademySchedule[];

    console.log("[getPlanGroupWithDetailsForAdmin] 관리자용 학원 일정 조회 성공:", {
      groupId,
      studentId: group.student_id,
      tenantId,
      academySchedulesCount: academySchedules.length,
      academySchedules: academySchedules,
    });

    return academySchedules;
  };

  // 플랜 그룹별 제외일과 학원 일정 조회
  const [contents, exclusions, academySchedules] = await Promise.all([
    getPlanContents(groupId, tenantId),
    getPlanExclusions(groupId, tenantId),
    getAcademySchedulesForAdmin(),
  ]);

  return {
    group,
    contents,
    exclusions,
    academySchedules,
  };
}

/**
 * 플랜 그룹 통계 정보 타입
 */
export type PlanGroupStats = {
  planCount: number;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean; // 실제 완료 상태
};

/**
 * 플랜 그룹과 통계 정보를 함께 조회
 */
export async function getPlanGroupsWithStats(
  filters: PlanGroupFilters
): Promise<Array<PlanGroup & PlanGroupStats>> {
  const supabase = await createSupabaseServerClient();
  
  // 1. 플랜 그룹 조회
  const groups = await getPlanGroupsForStudent(filters);
  
  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((g) => g.id);
  const studentId = filters.studentId;

  // 2. 플랜 개수 및 완료 상태 조회 (배치)
  const [planCountsResult, planCompletionResult] = await Promise.all([
    // 플랜 개수 조회
    supabase
      .from("student_plan")
      .select("plan_group_id")
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds),
    // 플랜 완료 상태 조회
    supabase
      .from("student_plan")
      .select(
        "plan_group_id, planned_end_page_or_time, completed_amount"
      )
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds)
      .not("plan_group_id", "is", null),
  ]);

  // 3. 통계 계산
  const planCountsMap = new Map<string, number>();
  (planCountsResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      planCountsMap.set(
        plan.plan_group_id,
        (planCountsMap.get(plan.plan_group_id) || 0) + 1
      );
    }
  });

  const completionMap = new Map<
    string,
    { completedCount: number; totalCount: number; isCompleted: boolean }
  >();

  // plan_group_id별로 그룹화
  const plansByGroup = new Map<
    string,
    Array<{ planned_end: number | null; completed: number | null }>
  >();

  (planCompletionResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      const groupPlans = plansByGroup.get(plan.plan_group_id) || [];
      groupPlans.push({
        planned_end: plan.planned_end_page_or_time ?? null,
        completed: plan.completed_amount ?? null,
      });
      plansByGroup.set(plan.plan_group_id, groupPlans);
    }
  });

  // 완료 상태 계산
  plansByGroup.forEach((groupPlans, groupId) => {
    const totalCount = groupPlans.length;
    let completedCount = 0;

    groupPlans.forEach((plan) => {
      if (
        plan.planned_end !== null &&
        plan.completed !== null &&
        plan.completed >= plan.planned_end
      ) {
        completedCount++;
      }
    });

    const isCompleted =
      totalCount > 0 &&
      completedCount === totalCount &&
      groupPlans.every((plan) => {
        if (plan.planned_end === null) return false;
        return plan.completed !== null && plan.completed >= plan.planned_end;
      });

    completionMap.set(groupId, {
      completedCount,
      totalCount,
      isCompleted,
    });
  });

  // 4. 결과 병합
  return groups.map((group) => {
    const planCount = planCountsMap.get(group.id) || 0;
    const completion = completionMap.get(group.id) || {
      completedCount: 0,
      totalCount: planCount,
      isCompleted: false,
    };

    // 완료 상태 표시 (실제 완료되었고 현재 상태가 completed가 아니면 표시용으로 completed)
    let displayStatus = group.status;
    if (
      completion.isCompleted &&
      group.status !== "completed" &&
      group.status !== "cancelled"
    ) {
      displayStatus = "completed";
    }

    return {
      ...group,
      status: displayStatus as typeof group.status,
      planCount,
      completedCount: completion.completedCount,
      totalCount: completion.totalCount,
      isCompleted: completion.isCompleted,
    };
  });
}

