// 플랜 그룹 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  SchedulerOptions,
  SubjectConstraints,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  DailyScheduleInfo,
  PlanContentWithDetails,
} from "@/lib/types/plan";
import type { ContentSlot } from "@/lib/types/content-selection";
import { isPlanContentWithDetails } from "@/lib/types/guards";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import {
  createTypedConditionalQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { getPlanContentsForAdmin } from "@/lib/data/planGroups/admin";
import type { Database } from "@/lib/supabase/database.types";

// ============================================
// Internal imports + Re-exports (Single Source of Truth)
// ============================================

// Exclusions - import for internal use, then re-export
import {
  getPlanExclusions,
  getStudentExclusions,
  createPlanExclusions,
  createStudentExclusions,
} from "./planGroups/exclusions";
export {
  getPlanExclusions,
  getStudentExclusions,
  createPlanExclusions,
  createStudentExclusions,
};

// Academy Schedules - import for internal use, then re-export
import {
  getAcademySchedules,
  getStudentAcademySchedules,
  getPlanGroupAcademySchedules,
  createAcademySchedules,
  createPlanAcademySchedules,
  createStudentAcademySchedules,
} from "./planGroups/academies";
export {
  getAcademySchedules,
  getStudentAcademySchedules,
  getPlanGroupAcademySchedules,
  createAcademySchedules,
  createPlanAcademySchedules,
  createStudentAcademySchedules,
};

// ============================================

// Database 타입에서 테이블 타입 추출
type PlanGroupInsert = Database["public"]["Tables"]["plan_groups"]["Insert"];
type PlanGroupUpdate = Database["public"]["Tables"]["plan_groups"]["Update"];

/**
 * 플랜 그룹 생성 시 사용하는 payload 타입
 */
type PlanGroupPayload = {
  tenant_id: string;
  student_id: string;
  name: string | null;
  plan_purpose: string | null;
  scheduler_type: string | null;
  scheduler_options?: SchedulerOptions | null;
  period_start: string;
  period_end: string;
  target_date: string | null;
  block_set_id: string | null;
  status: string;
  subject_constraints?: SubjectConstraints | null;
  additional_period_reallocation?: AdditionalPeriodReallocation | null;
  non_study_time_blocks?: NonStudyTimeBlock[] | null;
  daily_schedule?: DailyScheduleInfo[] | null;
  plan_type?: string | null;
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
  use_slot_mode?: boolean;
  content_slots?: ContentSlot[] | null;
  // 캘린더 우선 생성 지원
  is_calendar_only?: boolean;
  content_status?: "pending" | "partial" | "complete";
  schedule_generated_at?: string | null;
};

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
 * 플랜 그룹 ID로 조회
 */
/**
 * 플랜 그룹을 ID로 조회합니다.
 *
 * 학생 ID와 테넌트 ID를 사용하여 RLS(Row Level Security)를 통해 접근 권한을 확인합니다.
 * 삭제되지 않은 플랜 그룹만 조회합니다.
 *
 * Fallback 처리:
 * - 컬럼이 없는 경우(UNDEFINED_COLUMN 에러) fallback 쿼리를 사용합니다.
 * - scheduler_options 컬럼이 없는 경우 null로 설정합니다.
 *
 * @param groupId 플랜 그룹 ID
 * @param studentId 학생 ID (RLS 확인용)
 * @param tenantId 테넌트 ID (선택사항, RLS 확인용)
 * @returns 플랜 그룹 객체 또는 null (조회 실패 시)
 *
 * @example
 * ```typescript
 * const group = await getPlanGroupById(
 *   "group-123",
 *   "student-456",
 *   "tenant-789"
 * );
 * if (group) {
 *   console.log(group.name);
 * }
 * ```
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
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,plan_mode,is_single_day,created_at,updated_at,study_hours,self_study_hours,lunch_time,planner_id"
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
              "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,plan_mode,is_single_day,created_at,updated_at,study_hours,self_study_hours,lunch_time,planner_id"
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
 * 플랜 그룹을 생성합니다.
 *
 * 플랜 그룹의 메타데이터와 JSONB 필드들을 데이터베이스에 저장합니다.
 * 생성 성공 시 플랜 그룹 ID를 반환합니다.
 *
 * JSONB 필드:
 * - scheduler_options: 스케줄러 옵션
 * - daily_schedule: 일별 스케줄 정보
 * - subject_constraints: 교과 제약 조건
 * - additional_period_reallocation: 추가 기간 재배치 정보
 * - non_study_time_blocks: 학습 시간 제외 항목
 *
 * @param group 플랜 그룹 생성 데이터
 * @param group.tenant_id 테넌트 ID (필수)
 * @param group.student_id 학생 ID (필수)
 * @param group.name 플랜 그룹 이름 (선택사항)
 * @param group.plan_purpose 플랜 목적 (선택사항)
 * @param group.scheduler_type 스케줄러 유형 (선택사항)
 * @param group.scheduler_options 스케줄러 옵션 (JSONB, 선택사항)
 * @param group.period_start 기간 시작일 (필수)
 * @param group.period_end 기간 종료일 (필수)
 * @param group.target_date 목표일 (선택사항)
 * @param group.block_set_id 블록 세트 ID (선택사항)
 * @param group.status 플랜 상태 (선택사항, 기본값: "draft")
 * @param group.subject_constraints 교과 제약 조건 (JSONB, 선택사항)
 * @param group.additional_period_reallocation 추가 기간 재배치 정보 (JSONB, 선택사항)
 * @param group.non_study_time_blocks 학습 시간 제외 항목 (JSONB, 선택사항)
 * @param group.daily_schedule 일별 스케줄 정보 (JSONB, 선택사항)
 * @param group.plan_type 플랜 유형 (선택사항)
 * @param group.camp_template_id 캠프 템플릿 ID (선택사항)
 * @param group.camp_invitation_id 캠프 초대 ID (선택사항)
 * @returns 생성 결과 객체 (success, groupId, error 포함)
 *
 * @example
 * ```typescript
 * const result = await createPlanGroup({
 *   tenant_id: "tenant-123",
 *   student_id: "student-456",
 *   name: "2025년 1학기 학습 계획",
 *   plan_purpose: "내신대비",
 *   scheduler_type: "1730_timetable",
 *   period_start: "2025-01-01",
 *   period_end: "2025-06-30",
 *   scheduler_options: { study_days: 6, review_days: 1 },
 * });
 * if (result.success) {
 *   console.log("플랜 그룹 생성 성공:", result.groupId);
 * }
 * ```
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
    daily_schedule?: DailyScheduleInfo[] | null; // JSONB: 일별 스케줄 정보
    // 캠프 관련 필드
    plan_type?: string | null;
    camp_template_id?: string | null;
    camp_invitation_id?: string | null;
    // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
    use_slot_mode?: boolean;
    content_slots?: ContentSlot[] | null;
    // 캘린더 우선 생성 지원
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

  // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
  if (group.use_slot_mode !== undefined) {
    payload.use_slot_mode = group.use_slot_mode;
  }
  if (group.content_slots !== undefined && group.content_slots !== null) {
    payload.content_slots = group.content_slots;
  }

  // 캘린더 우선 생성 지원
  if (group.is_calendar_only !== undefined) {
    payload.is_calendar_only = group.is_calendar_only;
  }
  if (group.content_status !== undefined && group.content_status !== null) {
    payload.content_status = group.content_status;
  }
  if (group.schedule_generated_at !== undefined) {
    payload.schedule_generated_at = group.schedule_generated_at;
  }

  // 상세한 에러 로깅을 위한 쿼리 실행
  const queryResult = await supabase
    .from("plan_groups")
    .insert(payload as PlanGroupInsert)
    .select("id")
    .single();

  // 에러가 있는 경우 상세 로깅
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
        // fallback: scheduler_options가 포함된 경우 제외하고 재시도
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
          // 다른 컬럼 문제인 경우 일반 fallback
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
    // 상세한 에러 메시지 반환
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
 * 플랜 그룹 업데이트
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
    daily_schedule?: DailyScheduleInfo[] | null; // JSONB: 일별 스케줄 정보
    subject_constraints?: SubjectConstraints | null; // JSONB: 교과 제약 조건
    additional_period_reallocation?: AdditionalPeriodReallocation | null; // JSONB: 추가 기간 재배치 정보
    non_study_time_blocks?: NonStudyTimeBlock[] | null; // JSONB: 학습 시간 제외 항목
    // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
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
  // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
  if (updates.use_slot_mode !== undefined) payload.use_slot_mode = updates.use_slot_mode;
  if (updates.content_slots !== undefined) payload.content_slots = updates.content_slots;

  const result = await createTypedConditionalQuery<null>(
    async () => {
      const queryResult = await supabase
        .from("plan_groups")
        .update(payload as PlanGroupUpdate)
        .eq("id", groupId)
        .eq("student_id", studentId)
        .is("deleted_at", null);
      return { data: null, error: queryResult.error };
    },
    {
      context: "[data/planGroups] updatePlanGroup",
      defaultValue: null,
      fallbackQuery: async () => {
        // fallback: scheduler_options가 포함된 경우 제외하고 재시도
        if (payload.scheduler_options !== undefined) {
          const { scheduler_options: _schedulerOptions, ...fallbackPayload } = payload;
          const queryResult = await supabase
            .from("plan_groups")
            .update(fallbackPayload as PlanGroupUpdate)
            .eq("id", groupId)
            .eq("student_id", studentId)
            .is("deleted_at", null);
          return { data: null, error: queryResult.error };
        } else {
          // 다른 컬럼 문제인 경우 일반 fallback
          const queryResult = await supabase
            .from("plan_groups")
            .update(payload as PlanGroupUpdate)
            .eq("id", groupId);
          return { data: null, error: queryResult.error };
        }
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  // update 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
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
    handleQueryError(error, {
      context: "[data/planGroups] deletePlanGroup",
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 캠프 초대 ID로 플랜 그룹 삭제 (관리자용, Hard Delete)
 * 초대 삭제 시 관련된 플랜 그룹도 함께 삭제하기 위한 함수
 * 
 * 삭제 전략:
 * 1. camp_invitation_id로 플랜 그룹 조회 및 삭제
 * 2. 초대 정보를 조회하여 camp_template_id와 student_id로도 플랜 그룹 조회 및 삭제
 *    (camp_invitation_id가 NULL로 변경된 경우 대비)
 */
export async function deletePlanGroupByInvitationId(
  invitationId: string
): Promise<{ success: boolean; error?: string; deletedGroupId?: string }> {
  const supabase = await createSupabaseServerClient();

  // 0. 초대 정보 조회 (camp_template_id와 student_id 확인용)
  const { getCampInvitation } = await import("@/lib/data/campTemplates");
  const invitation = await getCampInvitation(invitationId);
  
  if (!invitation) {
    // 초대가 없으면 플랜 그룹도 없을 것으로 예상되지만, 안전을 위해 확인
    console.warn("[deletePlanGroupByInvitationId] 초대를 찾을 수 없음:", invitationId);
  }

  const templateId = invitation?.camp_template_id;
  const studentId = invitation?.student_id;

  // 1. camp_invitation_id로 플랜 그룹 조회
  const { data: planGroupByInvitationId, error: fetchError1 } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_invitation_id", invitationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError1 && fetchError1.code !== "PGRST116") {
    handleQueryError(fetchError1, {
      context: "[data/planGroups] deletePlanGroupByInvitationId - fetch_by_invitation_id",
    });
    return { success: false, error: fetchError1.message };
  }

  // 2. camp_template_id와 student_id로도 플랜 그룹 조회 (camp_invitation_id가 NULL인 경우 대비)
  let planGroupByTemplateAndStudent: { id: string; student_id: string } | null = null;
  if (templateId && studentId) {
    const { data: planGroupByTemplate, error: fetchError2 } = await supabase
      .from("plan_groups")
      .select("id, student_id")
      .eq("camp_template_id", templateId)
      .eq("student_id", studentId)
      .eq("plan_type", "camp")
      .is("camp_invitation_id", null) // camp_invitation_id가 NULL인 것만 (이미 삭제된 초대의 플랜 그룹)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError2 && fetchError2.code !== "PGRST116") {
      handleQueryError(fetchError2, {
        context: "[data/planGroups] deletePlanGroupByInvitationId - fetch_by_template_and_student",
      });
      // 에러가 있어도 계속 진행 (camp_invitation_id로 찾은 플랜 그룹은 삭제 가능)
    } else {
      planGroupByTemplateAndStudent = planGroupByTemplate;
    }
  }

  // 삭제할 플랜 그룹 결정 (우선순위: camp_invitation_id로 찾은 것)
  const planGroup = planGroupByInvitationId || planGroupByTemplateAndStudent;

  // 플랜 그룹이 없으면 성공으로 처리 (삭제할 것이 없음)
  if (!planGroup) {
    return { success: true };
  }

  const groupId = planGroup.id;
  const finalStudentId = planGroup.student_id;

  // 3. 관련 student_plan 삭제 (hard delete)
  const { error: deletePlansError } = await supabase
    .from("student_plan")
    .delete()
    .eq("plan_group_id", groupId);

  if (deletePlansError) {
    handleQueryError(deletePlansError, {
      context: "[data/planGroups] deletePlanGroupByInvitationId",
    });
    return {
      success: false,
      error: `플랜 삭제 실패: ${deletePlansError.message}`,
    };
  }

  // 4. plan_contents 삭제 (안전을 위해 명시적으로 삭제)
  const { error: deleteContentsError } = await supabase
    .from("plan_contents")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteContentsError) {
    handleQueryError(deleteContentsError, {
      context: "[data/planGroups] deletePlanGroupByInvitationId - deleteContents",
    });
    // 콘텐츠 삭제 실패해도 계속 진행 (외래키 제약으로 자동 삭제될 수 있음)
  }

  // 5. plan_exclusions 삭제 (안전을 위해 명시적으로 삭제)
  const { error: deleteExclusionsError } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteExclusionsError) {
    handleQueryError(deleteExclusionsError, {
      context: "[data/planGroups] deletePlanGroupByInvitationId - deleteExclusions",
    });
    // 제외일 삭제 실패해도 계속 진행 (외래키 제약으로 자동 삭제될 수 있음)
  }

  // 6. academy_schedules 삭제는 수행하지 않음
  // 이유:
  // - 캠프 모드에서는 academy_schedules가 plan_group_id 없이 저장됨 (학생별 전역 관리)
  // - submitCampParticipation에서 기존 학원 일정을 모두 삭제하고 템플릿 일정으로 교체
  // - 초대 취소 시 academy_schedules를 삭제하면 다른 플랜 그룹의 학원 일정까지 삭제될 위험이 있음
  // - 따라서 academy_schedules는 삭제하지 않고 유지 (다른 플랜 그룹 보호)

  // 7. plan_groups 삭제 (hard delete)
  const { error: deleteGroupError } = await supabase
    .from("plan_groups")
    .delete()
    .eq("id", groupId);

  if (deleteGroupError) {
    handleQueryError(deleteGroupError, {
      context: "[data/planGroups] deletePlanGroupByInvitationId",
    });
    return {
      success: false,
      error: `플랜 그룹 삭제 실패: ${deleteGroupError.message}`,
    };
  }

  console.log("[deletePlanGroupByInvitationId] 플랜 그룹 삭제 완료:", {
    invitationId,
    groupId,
    studentId: finalStudentId,
    foundByInvitationId: !!planGroupByInvitationId,
    foundByTemplateAndStudent: !!planGroupByTemplateAndStudent,
  });

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
    handleQueryError(fetchError, {
      context: "[data/planGroups] deletePlanGroupsByTemplateId",
    });
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
      handleQueryError(deletePlansError, {
        context: "[data/planGroups] deletePlanGroupsByTemplateId - deletePlans",
      });
      // 개별 플랜 삭제 실패해도 계속 진행
    }

    // 2-2. plan_contents 삭제 (안전을 위해 명시적으로 삭제)
    const { error: deleteContentsError } = await supabase
      .from("plan_contents")
      .delete()
      .eq("plan_group_id", groupId);

    if (deleteContentsError) {
      handleQueryError(deleteContentsError, {
        context: "[data/planGroups] deletePlanGroupsByTemplateId - deleteContents",
      });
      // 콘텐츠 삭제 실패해도 계속 진행
    }

    // 2-3. plan_exclusions 삭제 (안전을 위해 명시적으로 삭제)
    const { error: deleteExclusionsError } = await supabase
      .from("plan_exclusions")
      .delete()
      .eq("plan_group_id", groupId);

    if (deleteExclusionsError) {
      handleQueryError(deleteExclusionsError, {
        context: "[data/planGroups] deletePlanGroupsByTemplateId - deleteExclusions",
      });
      // 제외일 삭제 실패해도 계속 진행
    }

    // 2-4. plan_groups 삭제 (hard delete)
    const { error: deleteGroupError } = await supabase
      .from("plan_groups")
      .delete()
      .eq("id", groupId);

    if (deleteGroupError) {
      handleQueryError(deleteGroupError, {
        context: "[data/planGroups] deletePlanGroupsByTemplateId - deleteGroup",
      });
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

  if (process.env.NODE_ENV === "development") {
    console.log("[getPlanContents] 플랜 콘텐츠 조회 시작", { groupId, tenantId });
  }

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

  if (process.env.NODE_ENV === "development") {
    console.log("[getPlanContents] 플랜 콘텐츠 조회 결과", {
      groupId,
      tenantId,
      dataCount: data?.length || 0,
      error: error ? { message: error.message, code: error.code } : null,
    });
  }

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
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
    handleQueryError(error, {
      context: "[data/planGroups] getPlanContents",
    });
    
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

  const payload = contents.map((content, index) => {
    // PlanContentWithDetails 타입으로 안전하게 처리
    const contentWithDetails: PlanContentWithDetails = isPlanContentWithDetails(content as PlanContent | PlanContentWithDetails)
      ? (content as PlanContentWithDetails)
      : { ...content, start_detail_id: null, end_detail_id: null } as PlanContentWithDetails;
    
    return {
      tenant_id: tenantId,
      plan_group_id: groupId,
      content_type: content.content_type,
      content_id: content.content_id,
      master_content_id: content.master_content_id ?? null,
      start_range: content.start_range,
      end_range: content.end_range,
      start_detail_id: 'start_detail_id' in contentWithDetails 
        ? contentWithDetails.start_detail_id ?? null 
        : null,
      end_detail_id: 'end_detail_id' in contentWithDetails 
        ? contentWithDetails.end_detail_id ?? null 
        : null,
      display_order: content.display_order ?? index,
      // 자동 추천 관련 필드
      is_auto_recommended: content.is_auto_recommended ?? false,
      recommendation_source: content.recommendation_source ?? null,
      recommendation_reason: content.recommendation_reason ?? null,
      recommendation_metadata: content.recommendation_metadata ?? null,
      recommended_at: content.recommended_at ?? null,
      recommended_by: content.recommended_by ?? null,
    };
  });

  let { error } = await supabase.from("plan_contents").insert(payload);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[createPlanContents] 컬럼이 없어 fallback 쿼리 사용", {
        groupId,
        tenantId,
      });
    }
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
    handleQueryError(error, {
      context: "[data/planGroups] createPlanContents",
    });
    return { success: false, error: error.message };
  }

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
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at,study_hours,self_study_hours,lunch_time,planner_id"
      )
      .eq("id", groupId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

  let { data, error } = await selectGroup().maybeSingle<PlanGroup>();

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // 컬럼이 없는 경우 fallback
    const fallbackSelect = () =>
      supabase
        .from("plan_groups")
        .select(
          "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at,study_hours,self_study_hours,lunch_time,planner_id"
        )
        .eq("id", groupId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);

    ({ data, error } = await fallbackSelect().maybeSingle<PlanGroup>());

    if (data && !error) {
      data = { ...data, scheduler_options: null } as PlanGroup;
    }
  }

  if (error && !ErrorCodeCheckers.isNoRowsReturned(error)) {
    handleQueryError(error, {
      context: "[data/planGroups] getPlanGroupByIdForAdmin",
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
  // 전역 관리: 학생별 제외일/학원 일정 조회 (plan_group_id IS NULL)
  // 각 조회가 실패해도 다른 데이터는 정상적으로 반환되도록 Promise.allSettled 사용
  const [groupResult, contentsResult, exclusionsResult, academySchedulesResult] = await Promise.allSettled([
    getPlanGroupById(groupId, studentId, tenantId),
    getPlanContents(groupId, tenantId),
    getPlanExclusions(groupId, tenantId), // 학생별 전역 제외일
    getAcademySchedules(groupId, tenantId), // 학생별 전역 학원 일정
  ]);

  // 결과 추출 (실패 시 기본값 사용)
  const group = groupResult.status === "fulfilled" ? groupResult.value : null;
  const contents = contentsResult.status === "fulfilled" ? contentsResult.value : [];
  const exclusions = exclusionsResult.status === "fulfilled" ? exclusionsResult.value : [];
  const academySchedules = academySchedulesResult.status === "fulfilled" ? academySchedulesResult.value : [];

  // 실패한 조회가 있으면 로깅
  if (contentsResult.status === "rejected") {
    handleQueryError(contentsResult.reason as PostgrestError, {
      context: "[data/planGroups] getPlanGroupWithDetails - contents",
    });
  }
  if (exclusionsResult.status === "rejected") {
    handleQueryError(exclusionsResult.reason as PostgrestError, {
      context: "[data/planGroups] getPlanGroupWithDetails - exclusions",
    });
  }
  if (academySchedulesResult.status === "rejected") {
    handleQueryError(academySchedulesResult.reason as PostgrestError, {
      context: "[data/planGroups] getPlanGroupWithDetails - academySchedules",
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
  // 전역 관리: 학생별 학원 일정 조회 (plan_group_id IS NULL)
  const getAcademySchedulesForAdmin = async (): Promise<AcademySchedule[]> => {
    let adminSchedulesData: AcademySchedule[] | null = null; // Declare adminSchedulesData here

    // 1. Service Role Key로 시도 (RLS 우회)
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      // Admin 클라이언트를 생성할 수 없으면 일반 함수 사용 (fallback)
      if (process.env.NODE_ENV === "development") {
        console.warn("[getPlanGroupWithDetailsForAdmin] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      }
      return getAcademySchedules(groupId, tenantId); // 전역 관리 함수 사용
    }

    // 전역 관리: academies와 조인하여 travel_time 가져오기 (student_id + plan_group_id IS NULL)
    const selectSchedules = () =>
      adminClient
        .from("academy_schedules")
        .select(
          "id,tenant_id,student_id,academy_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at,academies(travel_time)"
        )
        .eq("student_id", group.student_id) // 전역 관리: student_id로 조회
        .is("plan_group_id", null) // 전역 관리: plan_group_id IS NULL
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

    let { data, error } = await selectSchedules();
    adminSchedulesData = data as AcademySchedule[] | null;

    if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
      // academy_id가 없는 경우를 대비한 fallback (전역 관리)
      const fallbackSelect = () =>
        adminClient
          .from("academy_schedules")
          .select(
            "id,tenant_id,student_id,day_of_week,start_time,end_time,academy_name,subject,created_at,updated_at"
          )
          .eq("student_id", group.student_id) // 전역 관리: student_id로 조회
          .is("plan_group_id", null) // 전역 관리: plan_group_id IS NULL
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

      const fallbackResult = await fallbackSelect();
      error = fallbackResult.error;
      
      // academy_id를 빈 문자열로 설정 (fallback 쿼리에는 academy_id가 없음)
      if (fallbackResult.data && !error) {
        type ScheduleRow = Database["public"]["Tables"]["academy_schedules"]["Row"] & {
          academies?: { travel_time?: number } | null;
          academy_name?: string | null;
        };
        adminSchedulesData = fallbackResult.data.map((schedule) => ({
            id: schedule.id,
            tenant_id: schedule.tenant_id || "", 
            student_id: schedule.student_id,
            academy_id: "", // fallback 쿼리에는 academy_id가 없으므로 빈 문자열
            day_of_week: schedule.day_of_week,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            subject: schedule.subject ?? null,
            created_at: schedule.created_at,
            updated_at: schedule.updated_at,
            academy_name: schedule.academy_name || null,
            travel_time: null,
          })) as AcademySchedule[];
      }
    }

    if (error) {
      handleQueryError(error, {
        context: "[data/planGroups] getPlanGroupWithDetailsForAdmin",
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

    if (process.env.NODE_ENV === "development") {
      console.log("[getPlanGroupWithDetailsForAdmin] 관리자용 학원 일정 조회 성공", {
        groupId,
        studentId: group.student_id,
        tenantId,
        academySchedulesCount: academySchedules.length,
      });
    }

    return academySchedules;
  };

  // 플랜 그룹별 제외일과 학원 일정 조회 (RLS 우회)
  const [contents, exclusions, academySchedules] = await Promise.all([
    getPlanContentsForAdmin(groupId, tenantId), // RLS 우회를 위해 Admin 버전 사용
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
  /** 상태별 개수 (pending, in_progress, completed) */
  statusBreakdown?: {
    pending: number;
    inProgress: number;
    completed: number;
  };
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
  const [planCountsResult, planCompletionResult, planStatusResult] = await Promise.all([
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
    // 플랜 상태별 개수 조회
    supabase
      .from("student_plan")
      .select("plan_group_id, status")
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

  // 상태별 개수 계산
  const statusBreakdownMap = new Map<
    string,
    { pending: number; inProgress: number; completed: number }
  >();
  (planStatusResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      const breakdown = statusBreakdownMap.get(plan.plan_group_id) || {
        pending: 0,
        inProgress: 0,
        completed: 0,
      };
      if (plan.status === "pending") {
        breakdown.pending++;
      } else if (plan.status === "in_progress") {
        breakdown.inProgress++;
      } else if (plan.status === "completed") {
        breakdown.completed++;
      }
      statusBreakdownMap.set(plan.plan_group_id, breakdown);
    }
  });

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

    const statusBreakdown = statusBreakdownMap.get(group.id) || {
      pending: 0,
      inProgress: 0,
      completed: 0,
    };

    return {
      ...group,
      status: displayStatus as typeof group.status,
      planCount,
      completedCount: completion.completedCount,
      totalCount: completion.totalCount,
      isCompleted: completion.isCompleted,
      statusBreakdown,
    };
  });
}

/**
 * 플랜 그룹의 콘텐츠 요약 정보 조회
 * 콘텐츠 유형별 개수와 콘텐츠 이름 목록을 반환
 */
export type PlanGroupContentSummary = {
  bookCount: number;
  lectureCount: number;
  customCount: number;
  adHocCount: number;
  totalContentCount: number;
  contentNames: string[]; // 최대 4개
};

export async function getPlanGroupContentSummary(
  planGroupId: string
): Promise<PlanGroupContentSummary> {
  const supabase = await createSupabaseServerClient();

  // 기본 응답
  const defaultSummary: PlanGroupContentSummary = {
    bookCount: 0,
    lectureCount: 0,
    customCount: 0,
    adHocCount: 0,
    totalContentCount: 0,
    contentNames: [],
  };

  try {
    // 1. plan_contents에서 콘텐츠 유형별 개수 및 이름 조회
    const { data: planContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select("content_type, content_name")
      .eq("plan_group_id", planGroupId)
      .order("display_order", { ascending: true });

    if (contentsError) {
      console.error("[getPlanGroupContentSummary] plan_contents 조회 오류:", contentsError);
      return defaultSummary;
    }

    // 2. ad_hoc_plans에서 연결된 플랜 개수 조회
    const { count: adHocCount, error: adHocError } = await supabase
      .from("ad_hoc_plans")
      .select("*", { count: "exact", head: true })
      .eq("plan_group_id", planGroupId);

    if (adHocError) {
      console.error("[getPlanGroupContentSummary] ad_hoc_plans 조회 오류:", adHocError);
    }

    // 3. 콘텐츠 유형별 개수 집계
    let bookCount = 0;
    let lectureCount = 0;
    let customCount = 0;
    const contentNames: string[] = [];

    for (const content of planContents || []) {
      switch (content.content_type) {
        case "book":
          bookCount++;
          break;
        case "lecture":
          lectureCount++;
          break;
        case "custom":
          customCount++;
          break;
      }

      // 콘텐츠 이름 수집 (최대 4개)
      if (content.content_name && contentNames.length < 4) {
        contentNames.push(content.content_name);
      }
    }

    return {
      bookCount,
      lectureCount,
      customCount,
      adHocCount: adHocCount ?? 0,
      totalContentCount: (planContents?.length ?? 0) + (adHocCount ?? 0),
      contentNames,
    };
  } catch (error) {
    console.error("[getPlanGroupContentSummary] 오류:", error);
    return defaultSummary;
  }
}

/**
 * 여러 플랜 그룹의 콘텐츠 요약 정보를 일괄 조회
 */
export async function getPlanGroupContentSummaries(
  planGroupIds: string[]
): Promise<Map<string, PlanGroupContentSummary>> {
  const supabase = await createSupabaseServerClient();
  const summaryMap = new Map<string, PlanGroupContentSummary>();

  if (planGroupIds.length === 0) {
    return summaryMap;
  }

  // 기본값 초기화
  for (const id of planGroupIds) {
    summaryMap.set(id, {
      bookCount: 0,
      lectureCount: 0,
      customCount: 0,
      adHocCount: 0,
      totalContentCount: 0,
      contentNames: [],
    });
  }

  try {
    // 1. plan_contents 일괄 조회
    const { data: planContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select("plan_group_id, content_type, content_name")
      .in("plan_group_id", planGroupIds)
      .order("display_order", { ascending: true });

    if (contentsError) {
      console.error("[getPlanGroupContentSummaries] plan_contents 조회 오류:", contentsError);
    }

    // 2. ad_hoc_plans 일괄 조회 (plan_group_id별 개수)
    const { data: adHocCounts, error: adHocError } = await supabase
      .from("ad_hoc_plans")
      .select("plan_group_id")
      .in("plan_group_id", planGroupIds);

    if (adHocError) {
      console.error("[getPlanGroupContentSummaries] ad_hoc_plans 조회 오류:", adHocError);
    }

    // 3. ad_hoc_plans 개수 집계
    const adHocCountMap = new Map<string, number>();
    for (const item of adHocCounts || []) {
      if (item.plan_group_id) {
        adHocCountMap.set(
          item.plan_group_id,
          (adHocCountMap.get(item.plan_group_id) ?? 0) + 1
        );
      }
    }

    // 4. plan_contents 집계
    for (const content of planContents || []) {
      const summary = summaryMap.get(content.plan_group_id);
      if (!summary) continue;

      switch (content.content_type) {
        case "book":
          summary.bookCount++;
          break;
        case "lecture":
          summary.lectureCount++;
          break;
        case "custom":
          summary.customCount++;
          break;
      }

      if (content.content_name && summary.contentNames.length < 4) {
        summary.contentNames.push(content.content_name);
      }
    }

    // 5. ad_hoc 개수 및 총 개수 계산
    for (const [id, summary] of summaryMap) {
      summary.adHocCount = adHocCountMap.get(id) ?? 0;
      summary.totalContentCount =
        summary.bookCount +
        summary.lectureCount +
        summary.customCount +
        summary.adHocCount;
    }

    return summaryMap;
  } catch (error) {
    console.error("[getPlanGroupContentSummaries] 오류:", error);
    return summaryMap;
  }
}

