// 플랜 그룹 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  PlanGroupCreationData,
  PlanFilters,
  SchedulerOptions,
  SubjectConstraints,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  DailyScheduleInfo,
  PlanContentWithDetails,
} from "@/lib/types/plan";
import { isPlanContentWithDetails } from "@/lib/types/guards";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import {
  createTypedQuery,
  createTypedConditionalQuery,
} from "@/lib/data/core/typedQueryBuilder";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/data/core/types";

// Database 타입에서 테이블 타입 추출
type PlanGroupRow = Database["public"]["Tables"]["plan_groups"]["Row"];
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
};


/**
 * Supabase 클라이언트 생성 (Admin 모드 지원)
 */
async function getSupabaseClient(useAdminClient: boolean = false): Promise<SupabaseClient> {
  if (useAdminClient) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getSupabaseClient] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      }
      return await createSupabaseServerClient();
    }
    return adminClient;
  }
  return await createSupabaseServerClient();
}

/**
 * Academy 찾기 또는 생성
 */
async function getOrCreateAcademy(
  supabase: SupabaseClient,
  studentId: string,
  tenantId: string,
  academyName: string
): Promise<string | null> {
  const { data: existingAcademy } = await supabase
    .from("academies")
    .select("id")
    .eq("student_id", studentId)
    .eq("name", academyName)
    .maybeSingle();

  if (existingAcademy) {
    return existingAcademy.id;
  }

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
    handleQueryError(academyError as PostgrestError | null, {
      context: "[data/planGroups] getOrCreateAcademy",
    });
    return null;
  }

  return newAcademy.id;
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
            "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
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
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
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
              "id,tenant_id,student_id,name,plan_purpose,scheduler_type,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
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
    status?: string;
    daily_schedule?: DailyScheduleInfo[] | null; // JSONB: 일별 스케줄 정보
    subject_constraints?: SubjectConstraints | null; // JSONB: 교과 제약 조건
    additional_period_reallocation?: AdditionalPeriodReallocation | null; // JSONB: 추가 기간 재배치 정보
    non_study_time_blocks?: NonStudyTimeBlock[] | null; // JSONB: 학습 시간 제외 항목
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
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.daily_schedule !== undefined) payload.daily_schedule = updates.daily_schedule;
  if (updates.subject_constraints !== undefined) payload.subject_constraints = updates.subject_constraints;
  if (updates.additional_period_reallocation !== undefined) payload.additional_period_reallocation = updates.additional_period_reallocation;
  if (updates.non_study_time_blocks !== undefined) payload.non_study_time_blocks = updates.non_study_time_blocks;

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
 * 플랜 그룹 제외일 조회 (플랜 그룹별 관리)
 * 캠프 플랜인 경우 템플릿 제외일을 자동으로 포함합니다.
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

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ data, error } = await selectExclusions());
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getPlanExclusions",
    });
    return [];
  }

  const dbExclusions = (data as PlanExclusion[] | null) ?? [];

  // 캠프 플랜인 경우 템플릿 제외일 확인 및 포함
  const { data: planGroup } = await supabase
    .from("plan_groups")
    .select("camp_template_id, plan_type, student_id")
    .eq("id", groupId)
    .maybeSingle();

  if (planGroup?.plan_type === "camp" && planGroup.camp_template_id) {
    try {
      const { getCampTemplate } = await import("@/lib/data/campTemplates");
      const template = await getCampTemplate(planGroup.camp_template_id);

      if (template?.template_data?.exclusions) {
        const templateExclusions = template.template_data.exclusions;
        const dbExclusionDates = new Set(
          dbExclusions.map((e) => e.exclusion_date)
        );

        // 템플릿 제외일 중 DB에 없는 것만 추가
        const missingTemplateExclusions = templateExclusions.filter(
          (te) => !dbExclusionDates.has(te.exclusion_date)
        );

        // 템플릿 제외일을 PlanExclusion 형식으로 변환하여 추가
        const templateExclusionsAsPlanExclusions: PlanExclusion[] =
          missingTemplateExclusions.map((te) => ({
            id: `template-${te.exclusion_date}`, // 임시 ID (템플릿 제외일임을 표시)
            tenant_id: tenantId || "",
            student_id: planGroup.student_id || "",
            plan_group_id: groupId,
            exclusion_date: te.exclusion_date,
            exclusion_type: te.exclusion_type,
            reason: te.reason || null,
            created_at: new Date().toISOString(),
          }));

        // DB 제외일과 템플릿 제외일을 합쳐서 반환 (날짜 순 정렬)
        const allExclusions = [
          ...dbExclusions,
          ...templateExclusionsAsPlanExclusions,
        ].sort((a, b) => {
          const dateA = new Date(a.exclusion_date).getTime();
          const dateB = new Date(b.exclusion_date).getTime();
          return dateA - dateB;
        });

        return allExclusions;
      }
    } catch (templateError) {
      // 템플릿 조회 실패 시 로그만 남기고 DB 제외일만 반환
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[getPlanExclusions] 템플릿 제외일 조회 실패:",
          templateError
        );
      }
    }
  }

  return dbExclusions;
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

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ data, error } = await selectExclusions());
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getStudentExclusions",
    });
    return [];
  }

  return (data as PlanExclusion[] | null) ?? [];
}

/**
 * 제외일 일괄 생성 (통합 함수)
 * plan_group_id가 제공되면 플랜 그룹별로, 없으면 시간 관리 영역에 저장
 */
async function createExclusions(
  studentId: string,
  tenantId: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>,
  planGroupId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (exclusions.length === 0) {
    return { success: true };
  }

  // plan_group_id가 있는 경우: 플랜 그룹별 관리 로직
  if (planGroupId) {
    // 플랜 그룹에서 student_id 확인
    const { data: group } = await supabase
      .from("plan_groups")
      .select("student_id")
      .eq("id", planGroupId)
      .maybeSingle();

    if (!group?.student_id) {
      return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
    }

    // student_id 일치 확인
    if (group.student_id !== studentId) {
      return { success: false, error: "학생 ID가 일치하지 않습니다." };
    }

    // 중복 체크: 현재 플랜 그룹 내 제외일 조회 (날짜+유형 조합)
    const currentExclusionsQuery = supabase
      .from("plan_exclusions")
      .select("id, exclusion_date, exclusion_type")
      .eq("student_id", studentId)
      .eq("plan_group_id", planGroupId);

    if (tenantId) {
      currentExclusionsQuery.eq("tenant_id", tenantId);
    }

    const { data: currentExclusions, error: exclusionsError } =
      await currentExclusionsQuery;

    if (exclusionsError) {
      handleQueryError(exclusionsError as PostgrestError | null, {
        context: "[data/planGroups] createExclusions - checkExclusions",
      });
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
      .eq("student_id", studentId);

    if (tenantId) {
      timeManagementExclusionsQuery.eq("tenant_id", tenantId);
    }

    // plan_group_id가 NULL이거나 현재 그룹이 아닌 것
    timeManagementExclusionsQuery.or(
      `plan_group_id.is.null,plan_group_id.neq.${planGroupId}`
    );

    const { data: timeManagementExclusions } =
      await timeManagementExclusionsQuery;

    // 시간 관리 영역의 제외일을 키로 매핑
    const timeManagementMap = new Map(
      (timeManagementExclusions || []).map((e) => [
        `${e.exclusion_date}-${e.exclusion_type}`,
        e,
      ])
    );

    // 업데이트할 항목과 새로 생성할 항목 분리
    const toUpdate: Array<{ id: string; exclusion: typeof exclusions[0] }> =
      [];
    const toInsert: typeof exclusions = [];

    for (const exclusion of exclusions) {
      const key = `${exclusion.exclusion_date}-${exclusion.exclusion_type}`;

      // 현재 플랜 그룹에 이미 있으면 스킵
      if (existingKeys.has(key)) {
        if (process.env.NODE_ENV === "development") {
          console.log("[createExclusions] 이미 존재하는 제외일 스킵", {
            key,
            planGroupId,
          });
        }
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

    if (process.env.NODE_ENV === "development") {
      console.log("[createExclusions] 처리 요약", {
        updateCount: toUpdate.length,
        insertCount: toInsert.length,
        skipCount:
          exclusions.length - toUpdate.length - toInsert.length,
        planGroupId,
      });
    }

    // 시간 관리 영역의 제외일을 현재 플랜 그룹으로 업데이트
    if (toUpdate.length > 0) {
      for (const { id, exclusion } of toUpdate) {
        const { error: updateError } = await supabase
          .from("plan_exclusions")
          .update({
            plan_group_id: planGroupId,
            reason: exclusion.reason || null,
          })
          .eq("id", id);

        if (updateError) {
          handleQueryError(updateError, {
            context: "[data/planGroups] createExclusions - updateExclusion",
          });
          // 업데이트 실패 시 새로 생성 목록에 추가
          toInsert.push(exclusion);
        } else if (process.env.NODE_ENV === "development") {
          console.log("[createExclusions] 제외일 재활용 성공", {
            exclusionDate: exclusion.exclusion_date,
            exclusionType: exclusion.exclusion_type,
            planGroupId,
          });
        }
      }
    }

    // 새로 생성할 제외일
    if (toInsert.length > 0) {
      const payload = toInsert.map((exclusion) => ({
        tenant_id: tenantId,
        student_id: studentId,
        plan_group_id: planGroupId,
        exclusion_date: exclusion.exclusion_date,
        exclusion_type: exclusion.exclusion_type,
        reason: exclusion.reason || null,
      }));

      let { error } = await supabase.from("plan_exclusions").insert(payload);

      if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
        const fallbackPayload = payload.map(
          ({ tenant_id: _tenantId, ...rest }) => rest
        );
        ({ error } = await supabase
          .from("plan_exclusions")
          .insert(fallbackPayload));
      }

      // 중복 키 에러 처리 (데이터베이스 레벨 unique 제약조건)
      if (error && (ErrorCodeCheckers.isUniqueViolation(error) || error.message?.includes("duplicate"))) {
        return {
          success: false,
          error: "이미 등록된 제외일이 있습니다.",
        };
      }

      if (error) {
        handleQueryError(error, {
          context: "[data/planGroups] createExclusions",
        });
        return { success: false, error: error.message };
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[createExclusions] 제외일 생성 완료", {
          insertCount: toInsert.length,
          planGroupId,
        });
      }
    }

    return { success: true };
  }

  // plan_group_id가 없는 경우: 시간 관리 영역에 저장 (plan_group_id = NULL)
  // 중복 체크: 같은 날짜+유형의 제외일이 이미 있으면 스킵
  const existingExclusionsQuery = supabase
    .from("plan_exclusions")
    .select("id, exclusion_date, exclusion_type")
    .eq("student_id", studentId)
    .is("plan_group_id", null);

  if (tenantId) {
    existingExclusionsQuery.eq("tenant_id", tenantId);
  }

  const { data: existingExclusions, error: existingError } =
    await existingExclusionsQuery;

  if (existingError) {
    handleQueryError(existingError as PostgrestError | null, {
      context: "[data/planGroups] createExclusions - checkExisting",
    });
  }

  // 기존 제외일 키 (날짜+유형 조합)
  const existingKeys = new Set(
    (existingExclusions || []).map(
      (e) => `${e.exclusion_date}-${e.exclusion_type}`
    )
  );

  // 중복되지 않은 제외일만 필터링
  const newExclusions = exclusions.filter(
    (e) => !existingKeys.has(`${e.exclusion_date}-${e.exclusion_type}`)
  );

  if (newExclusions.length === 0) {
    return { success: true }; // 모든 제외일이 이미 존재
  }

  const payload = newExclusions.map((exclusion) => ({
    tenant_id: tenantId,
    student_id: studentId,
    plan_group_id: null, // 시간 관리 영역
    exclusion_date: exclusion.exclusion_date,
    exclusion_type: exclusion.exclusion_type,
    reason: exclusion.reason || null,
  }));

  let { error } = await supabase.from("plan_exclusions").insert(payload);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    const fallbackPayload = payload.map(
      ({ tenant_id: _tenantId, ...rest }) => rest
    );
    ({ error } = await supabase.from("plan_exclusions").insert(fallbackPayload));
  }

  // 중복 키 에러 처리
  if (error && (ErrorCodeCheckers.isUniqueViolation(error) || error.message?.includes("duplicate"))) {
    return {
      success: false,
      error: "이미 등록된 제외일이 있습니다.",
    };
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] createExclusions",
    });
    return { success: false, error: error.message };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[createExclusions] 시간 관리 영역 제외일 생성 완료", {
      insertCount: newExclusions.length,
    });
  }

  return { success: true };
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
  // 플랜 그룹에서 student_id 조회
  const supabase = await createSupabaseServerClient();
  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  // 통합 함수 호출
  return createExclusions(group.student_id, tenantId, exclusions, groupId);
}

/**
 * 학생별 제외일 일괄 생성 (전역 관리 - 시간 관리 영역)
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
  // 통합 함수 호출 (plan_group_id = null)
  return createExclusions(studentId, tenantId, exclusions, null);
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
  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getAcademySchedules] tenant_id 컬럼 없음, 재시도", { groupId, tenantId });
    }
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
      type ScheduleRow = Database["public"]["Tables"]["academy_schedules"]["Row"] & {
        academies?: { travel_time?: number } | Array<{ travel_time?: number }> | null;
      };
      schedulesData = retryResult.data.map((schedule) => {
        const scheduleRow = schedule as unknown as ScheduleRow;
        const travelTime = Array.isArray(scheduleRow.academies)
          ? scheduleRow.academies[0]?.travel_time ?? null
          : (scheduleRow.academies as { travel_time?: number } | null)?.travel_time ?? null;
        return {
          id: scheduleRow.id,
          tenant_id: null,
          student_id: scheduleRow.student_id,
          academy_id: scheduleRow.academy_id || "", 
          day_of_week: scheduleRow.day_of_week,
          start_time: scheduleRow.start_time,
          end_time: scheduleRow.end_time,
          subject: scheduleRow.subject ?? null,
          created_at: scheduleRow.created_at,
          updated_at: scheduleRow.updated_at,
          academy_name: null,
          travel_time: travelTime,
        } as AcademySchedule;
      });
    } else {
      schedulesData = (retryResult.data as AcademySchedule[] | null) ?? null;
    }
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getAcademySchedules",
    });
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

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
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
      type ScheduleRow = Database["public"]["Tables"]["academy_schedules"]["Row"] & {
        academies?: { travel_time?: number } | null;
        academy_name?: string | null;
      };
      studentSchedulesData = fallbackResult.data.map((schedule) => ({
        id: schedule.id,
        tenant_id: "",
        student_id: schedule.student_id,
        academy_id: "", 
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        subject: schedule.subject ?? null,
        created_at: schedule.created_at,
        updated_at: schedule.updated_at,
        academy_name: schedule.academy_name || null,
        travel_time: null,
      })) as AcademySchedule[];
    } else {
      studentSchedulesData = (fallbackResult.data as AcademySchedule[] | null) ?? null;
    }
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getStudentAcademySchedules",
    });
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
  const supabase = await getSupabaseClient(useAdminClient);

  if (schedules.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[createPlanAcademySchedules] 학원 일정이 없습니다.");
    }
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
  if (process.env.NODE_ENV === "development") {
    console.log("[createPlanAcademySchedules] 입력된 학원 일정", {
      groupId,
      studentId: group.student_id,
      tenantId,
      schedulesCount: schedules.length,
    });
  }

  const studentId = group.student_id;

  // 중복 체크: 현재 플랜 그룹의 기존 학원 일정 조회
  const existingSchedules = await getAcademySchedules(groupId, tenantId);
  const existingKeys = new Set(
    existingSchedules.map((s) => 
      `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`
    )
  );

  if (process.env.NODE_ENV === "development") {
    console.log("[createPlanAcademySchedules] 기존 학원 일정 (현재 플랜 그룹)", {
      existingSchedulesCount: existingSchedules.length,
    });
  }

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
      if (process.env.NODE_ENV === "development") {
        console.log("[createPlanAcademySchedules] 이미 존재하는 학원 일정 스킵", { key });
      }
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

  if (process.env.NODE_ENV === "development") {
    console.log("[createPlanAcademySchedules] 처리 요약", {
      updateCount: toUpdate.length,
      insertCount: toInsert.length,
      skipCount: schedules.length - toUpdate.length - toInsert.length,
    });
  }

  // 시간 관리 영역의 학원 일정을 현재 플랜 그룹으로 업데이트
  if (toUpdate.length > 0) {
    for (const { id, schedule } of toUpdate) {
      // academy_name으로 academy 찾기 또는 생성
      const academyName = schedule.academy_name || "학원";
      const academyId = await getOrCreateAcademy(supabase, studentId, tenantId, academyName);
      
      if (!academyId) {
        console.warn("[createPlanAcademySchedules] 학원 ID 확보 실패, 새로 생성으로 폴백", {
          academyName,
          scheduleId: id,
        });
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
        handleQueryError(updateError, {
          context: "[data/planGroups] createPlanAcademySchedules - updateSchedule",
        });
        toInsert.push(schedule);
      } else if (process.env.NODE_ENV === "development") {
        console.log("[createPlanAcademySchedules] 학원 일정 재활용 성공", {
          dayOfWeek: schedule.day_of_week,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
        });
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
        const academyId = await getOrCreateAcademy(supabase, studentId, tenantId, academyName);
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

    if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
      const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
      ({ error } = await supabase.from("academy_schedules").insert(fallbackPayload));
    }

    if (error) {
      handleQueryError(error, {
        context: "[data/planGroups] createPlanAcademySchedules",
      });
      return { success: false, error: error.message };
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[createPlanAcademySchedules] 학원 일정 생성 완료", { insertCount: toInsert.length });
    }
  }

  return { success: true };
}

/**
 * 학생별 학원 일정 일괄 생성 (시간 관리 영역 - plan_group_id = NULL)
 * 시간 관리 영역에서 플랜 그룹 없이 학원 일정을 미리 등록할 때 사용
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
  const supabase = await getSupabaseClient(useAdminClient);

  if (schedules.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[createStudentAcademySchedules] 학원 일정이 없습니다.");
    }
    return { success: true };
  }

  // 디버깅: 입력된 학원 일정 확인
  if (process.env.NODE_ENV === "development") {
    console.log("[createStudentAcademySchedules] 입력된 학원 일정", {
      studentId,
      tenantId,
      schedulesCount: schedules.length,
    });
  }

  // 중복 체크: 같은 요일, 시간대의 학원 일정이 이미 있으면 스킵
  const existingSchedules = await getStudentAcademySchedules(studentId, tenantId);
  const existingKeys = new Set(
    existingSchedules.map((s) => `${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  // 디버깅: 기존 학원 일정 확인
  if (process.env.NODE_ENV === "development") {
    console.log("[createStudentAcademySchedules] 기존 학원 일정", {
      existingSchedulesCount: existingSchedules.length,
    });
  }

  const newSchedules = schedules.filter(
    (s) => !existingKeys.has(`${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  // 디버깅: 필터링된 새 학원 일정 확인
  if (process.env.NODE_ENV === "development") {
    console.log("[createStudentAcademySchedules] 필터링된 새 학원 일정", {
      newSchedulesCount: newSchedules.length,
      skippedCount: schedules.length - newSchedules.length,
    });
  }

  if (newSchedules.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[createStudentAcademySchedules] 모든 학원 일정이 이미 존재합니다.");
    }
    return { success: true }; // 모든 학원 일정이 이미 존재
  }

  // academy_name별로 academy를 찾거나 생성
  const academyNameMap = new Map<string, string>(); // academy_name -> academy_id

  for (const schedule of newSchedules) {
    const academyName = schedule.academy_name || "학원";
    
    if (!academyNameMap.has(academyName)) {
      const academyId = await getOrCreateAcademy(supabase, studentId, tenantId, academyName);
      
      if (!academyId) {
        return { success: false, error: `학원 생성에 실패했습니다: ${academyName}` };
      }

      academyNameMap.set(academyName, academyId);
    }
  }

  // academy_id를 포함한 payload 생성
  // 시간 관리 영역에 저장 (plan_group_id = NULL)
  const payload = newSchedules.map((schedule) => {
    const academyName = schedule.academy_name || "학원";
    const academyId = academyNameMap.get(academyName);
    
    if (!academyId) {
      throw new Error(`학원 ID를 찾을 수 없습니다: ${academyName}`);
    }

    return {
      tenant_id: tenantId,
      student_id: studentId,
      plan_group_id: null, // 시간 관리 영역 (NULL 허용)
      academy_id: academyId,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      academy_name: schedule.academy_name || null, // 하위 호환성
      subject: schedule.subject || null,
    };
  });

  let { error } = await supabase.from("academy_schedules").insert(payload);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    const fallbackPayload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
    ({ error } = await supabase.from("academy_schedules").insert(fallbackPayload));
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] createStudentAcademySchedules",
    });
    return { success: false, error: error.message };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[createStudentAcademySchedules] 학원 일정 저장 완료", { savedCount: payload.length });
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
        "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
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
    adminSchedulesData = data as AcademySchedule[] | null;

    if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
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

