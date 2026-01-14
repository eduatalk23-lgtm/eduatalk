/**
 * 플랜 그룹 CRUD 기본 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { createTypedConditionalQuery } from "@/lib/data/core/typedQueryBuilder";
import type {
  PlanGroup,
  SchedulerOptions,
  SubjectConstraints,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  DailyScheduleInfo,
} from "@/lib/types/plan";
import type { ContentSlot } from "@/lib/types/content-selection";
import type {
  PlanGroupFilters,
  PlanGroupPayload,
  PlanGroupInsert,
  PlanGroupUpdate,
} from "./types";

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
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,plan_type,camp_template_id,camp_invitation_id,plan_mode,is_single_day,created_at,updated_at"
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

  const result = await createTypedConditionalQuery<PlanGroup[]>(
    async () => {
      const queryResult = await query;
      return { data: queryResult.data as PlanGroup[] | null, error: queryResult.error };
    },
    {
      context: "[data/planGroups] getPlanGroupsForStudent",
      defaultValue: [],
      fallbackQuery: async () => {
        // fallback: scheduler_options 컬럼이 없는 경우
        const fallbackQuery = supabase
          .from("plan_groups")
          .select(
            "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,plan_type,camp_template_id,camp_invitation_id,plan_mode,is_single_day,created_at,updated_at"
          )
          .eq("student_id", filters.studentId);

        if (filters.tenantId) {
          fallbackQuery.eq("tenant_id", filters.tenantId);
        }

        if (!filters.includeDeleted) {
          fallbackQuery.is("deleted_at", null);
        }

        const fallbackResult = await fallbackQuery.order("created_at", {
          ascending: false,
        });

        // fallback 성공 시 scheduler_options를 null로 설정
        if (fallbackResult.data && !fallbackResult.error) {
          return {
            data: fallbackResult.data.map((group) => ({
              ...group,
              scheduler_options: null,
              subject_constraints: null,
              additional_period_reallocation: null,
              non_study_time_blocks: null,
              study_hours: null,
              self_study_hours: null,
            })) as PlanGroup[],
            error: null,
          };
        }

        return { data: fallbackResult.data as PlanGroup[] | null, error: fallbackResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  return result ?? [];
}

/**
 * 플랜 그룹 단건 조회
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
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,plan_mode,is_single_day,created_at,updated_at"
      )
      .eq("id", groupId)
      .eq("student_id", studentId)
      .is("deleted_at", null);

  let query = selectGroup();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const result = await createTypedConditionalQuery<PlanGroup>(
    async () => {
      const queryResult = await query.maybeSingle();
      return { data: queryResult.data, error: queryResult.error };
    },
    {
      context: "[data/planGroups] getPlanGroupById",
      defaultValue: null,
      fallbackQuery: async () => {
        // fallback: scheduler_options 컬럼이 없는 경우
        const fallbackSelect = () =>
          supabase
            .from("plan_groups")
            .select(
              "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,plan_mode,is_single_day,created_at,updated_at"
            )
            .eq("id", groupId)
            .eq("student_id", studentId)
            .is("deleted_at", null);

        let fallbackQuery = fallbackSelect();
        if (tenantId) {
          fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
        }

        const fallbackResult = await fallbackQuery.maybeSingle();

        // fallback 성공 시 scheduler_options를 null로 설정
        if (fallbackResult.data && !fallbackResult.error) {
          return {
            data: { ...fallbackResult.data, scheduler_options: null } as PlanGroup,
            error: null,
          };
        }

        return { data: fallbackResult.data, error: fallbackResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  return result;
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
    scheduler_options?: SchedulerOptions | null;
    period_start: string;
    period_end: string;
    target_date?: string | null;
    block_set_id?: string | null;
    status?: string;
    subject_constraints?: SubjectConstraints | null;
    additional_period_reallocation?: AdditionalPeriodReallocation | null;
    non_study_time_blocks?: NonStudyTimeBlock[] | null;
    daily_schedule?: DailyScheduleInfo[] | null;
    plan_type?: string | null;
    camp_template_id?: string | null;
    camp_invitation_id?: string | null;
    use_slot_mode?: boolean;
    content_slots?: ContentSlot[] | null;
    is_calendar_only?: boolean;
    content_status?: "pending" | "partial" | "complete";
    schedule_generated_at?: string | null;
  }
): Promise<{ success: boolean; groupId?: string; error?: string; errorCode?: string | null }> {
  const supabase = await createSupabaseServerClient();

  const payload: PlanGroupPayload = {
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

  // Optional fields
  if (group.scheduler_options !== undefined && group.scheduler_options !== null) {
    payload.scheduler_options = group.scheduler_options;
  }
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
  if (group.plan_type !== undefined && group.plan_type !== null) {
    payload.plan_type = group.plan_type;
  }
  if (group.camp_template_id !== undefined && group.camp_template_id !== null) {
    payload.camp_template_id = group.camp_template_id;
  }
  if (group.camp_invitation_id !== undefined && group.camp_invitation_id !== null) {
    payload.camp_invitation_id = group.camp_invitation_id;
  }
  if (group.use_slot_mode !== undefined) {
    payload.use_slot_mode = group.use_slot_mode;
  }
  if (group.content_slots !== undefined && group.content_slots !== null) {
    payload.content_slots = group.content_slots;
  }
  if (group.is_calendar_only !== undefined) {
    payload.is_calendar_only = group.is_calendar_only;
  }
  if (group.content_status !== undefined && group.content_status !== null) {
    payload.content_status = group.content_status;
  }
  if (group.schedule_generated_at !== undefined) {
    payload.schedule_generated_at = group.schedule_generated_at;
  }

  const queryResult = await supabase
    .from("plan_groups")
    .insert(payload as PlanGroupInsert)
    .select("id")
    .single();

  if (queryResult.error) {
    console.error("[data/planGroups] createPlanGroup INSERT 실패:", {
      error: queryResult.error.message,
      errorCode: queryResult.error.code,
      errorDetails: queryResult.error.details,
      errorHint: queryResult.error.hint,
      payload: {
        tenant_id: payload.tenant_id,
        student_id: payload.student_id,
        name: payload.name,
        plan_purpose: payload.plan_purpose,
        scheduler_type: payload.scheduler_type,
        period_start: payload.period_start,
        period_end: payload.period_end,
        status: payload.status,
        plan_type: payload.plan_type,
        camp_template_id: payload.camp_template_id,
        camp_invitation_id: payload.camp_invitation_id,
        has_scheduler_options: !!payload.scheduler_options,
        scheduler_options_keys: payload.scheduler_options ? Object.keys(payload.scheduler_options) : [],
      },
    });
  }

  const result = await createTypedConditionalQuery<{ id: string }>(
    async () => {
      return { data: queryResult.data, error: queryResult.error };
    },
    {
      context: "[data/planGroups] createPlanGroup",
      defaultValue: null,
      fallbackQuery: async () => {
        if (payload.scheduler_options !== undefined) {
          const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
          const fallbackResult = await supabase
            .from("plan_groups")
            .insert(fallbackPayload as PlanGroupInsert)
            .select("id")
            .single();

          if (fallbackResult.error) {
            console.error("[data/planGroups] createPlanGroup fallback INSERT 실패:", {
              error: fallbackResult.error.message,
              errorCode: fallbackResult.error.code,
              errorDetails: fallbackResult.error.details,
            });
          }

          return { data: fallbackResult.data, error: fallbackResult.error };
        } else {
          const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
          const fallbackResult = await supabase
            .from("plan_groups")
            .insert(fallbackPayload as PlanGroupInsert)
            .select("id")
            .single();

          if (fallbackResult.error) {
            console.error("[data/planGroups] createPlanGroup 일반 fallback INSERT 실패:", {
              error: fallbackResult.error.message,
              errorCode: fallbackResult.error.code,
              errorDetails: fallbackResult.error.details,
            });
          }

          return { data: fallbackResult.data, error: fallbackResult.error };
        }
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  if (!result) {
    const errorCode = queryResult.error?.code || null;
    const errorMessage = queryResult.error
      ? `플랜 그룹 생성 실패: ${queryResult.error.message} (코드: ${errorCode})`
      : "플랜 그룹 생성 실패: 알 수 없는 오류";

    console.error("[data/planGroups] createPlanGroup 최종 실패:", {
      errorMessage,
      errorCode,
      originalError: queryResult.error,
      payload: {
        tenant_id: payload.tenant_id,
        student_id: payload.student_id,
        plan_type: payload.plan_type,
        camp_template_id: payload.camp_template_id,
        camp_invitation_id: payload.camp_invitation_id,
      },
    });

    return { success: false, error: errorMessage, errorCode };
  }

  return { success: true, groupId: result.id };
}

/**
 * 플랜 그룹 수정
 */
export async function updatePlanGroup(
  groupId: string,
  studentId: string,
  updates: {
    name?: string | null;
    plan_purpose?: string | null;
    scheduler_type?: string | null;
    scheduler_options?: SchedulerOptions | null;
    period_start?: string;
    period_end?: string;
    target_date?: string | null;
    block_set_id?: string | null;
    planner_id?: string | null;
    status?: string;
    daily_schedule?: DailyScheduleInfo[] | null;
    subject_constraints?: SubjectConstraints | null;
    additional_period_reallocation?: AdditionalPeriodReallocation | null;
    non_study_time_blocks?: NonStudyTimeBlock[] | null;
    use_slot_mode?: boolean;
    content_slots?: ContentSlot[] | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Partial<PlanGroupUpdate> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.plan_purpose !== undefined) payload.plan_purpose = updates.plan_purpose;
  if (updates.scheduler_type !== undefined) payload.scheduler_type = updates.scheduler_type;
  if (updates.scheduler_options !== undefined) payload.scheduler_options = updates.scheduler_options;
  if (updates.period_start !== undefined) payload.period_start = updates.period_start;
  if (updates.period_end !== undefined) payload.period_end = updates.period_end;
  if (updates.target_date !== undefined) payload.target_date = updates.target_date;
  if (updates.block_set_id !== undefined) payload.block_set_id = updates.block_set_id;
  if (updates.planner_id !== undefined) payload.planner_id = updates.planner_id;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.daily_schedule !== undefined) payload.daily_schedule = updates.daily_schedule;
  if (updates.subject_constraints !== undefined) payload.subject_constraints = updates.subject_constraints;
  if (updates.additional_period_reallocation !== undefined) payload.additional_period_reallocation = updates.additional_period_reallocation;
  if (updates.non_study_time_blocks !== undefined) payload.non_study_time_blocks = updates.non_study_time_blocks;
  if (updates.use_slot_mode !== undefined) payload.use_slot_mode = updates.use_slot_mode;
  if (updates.content_slots !== undefined) payload.content_slots = updates.content_slots;

  // Primary query: 모든 필드 포함
  const { error } = await supabase
    .from("plan_groups")
    .update(payload as PlanGroupUpdate)
    .eq("id", groupId)
    .eq("student_id", studentId)
    .is("deleted_at", null);

  // 에러가 없으면 성공
  if (!error) {
    return { success: true };
  }

  // 컬럼 미존재 에러인 경우 fallback 시도
  if (ErrorCodeCheckers.isColumnNotFound(error) && payload.scheduler_options !== undefined) {
    const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
    const fallbackResult = await supabase
      .from("plan_groups")
      .update(fallbackPayload as PlanGroupUpdate)
      .eq("id", groupId)
      .eq("student_id", studentId)
      .is("deleted_at", null);

    if (fallbackResult.error) {
      handleQueryError(fallbackResult.error, {
        context: "[data/planGroups] updatePlanGroup fallback",
      });
      return { success: false, error: fallbackResult.error.message };
    }

    return { success: true };
  }

  // 다른 에러인 경우
  handleQueryError(error, {
    context: "[data/planGroups] updatePlanGroup",
  });
  return { success: false, error: error.message };
}

/**
 * 플랜 그룹 삭제 (소프트 삭제)
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
    handleQueryError(error, {
      context: "[data/planGroups] deletePlanGroup",
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}
