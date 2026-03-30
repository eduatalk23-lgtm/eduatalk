"use server";

/**
 * Plan Domain Transaction Utilities
 *
 * PostgreSQL RPC 함수를 통한 원자적 트랜잭션 처리
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAdminClient } from "@/lib/supabase/clientSelector";
import type { Json } from "@/lib/supabase/database.types";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 플랜 그룹 생성 데이터 타입
 */
export type AtomicPlanGroupInput = {
  tenant_id: string;
  student_id: string;
  name: string | null;
  plan_purpose: string | null;
  scheduler_type: string | null;
  scheduler_options: Record<string, unknown> | null;
  period_start: string;
  period_end: string;
  target_date: string | null;
  block_set_id: string | null;
  status: string;
  subject_constraints: Record<string, unknown> | null;
  additional_period_reallocation: Record<string, unknown> | null;
  non_study_time_blocks: unknown[] | null;
  daily_schedule: unknown[] | null;
  plan_type: string | null;
  camp_template_id: string | null;
  camp_invitation_id: string | null;
  use_slot_mode: boolean;
  content_slots: unknown[] | null;

  // Phase 3 캘린더 연계 필드
  calendar_id?: string | null;
  creation_mode?: string | null;
  plan_mode?: string | null;
  is_single_day?: boolean;
  study_type?: string | null;
  strategy_days_per_week?: number | null;

  // 단일 콘텐츠 모드 필드
  content_type?: string | null;
  content_id?: string | null;
  master_content_id?: string | null;
  start_range?: number | null;
  end_range?: number | null;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
  is_single_content?: boolean;
};

/**
 * 플랜 콘텐츠 입력 타입
 */
export type AtomicPlanContentInput = {
  content_type: string;
  content_id: string;
  master_content_id?: string | null;
  start_range: number;
  end_range: number;
  display_order?: number;
};

/**
 * 제외일 입력 타입
 */
export type AtomicExclusionInput = {
  exclusion_date: string;
  exclusion_type: string;
  reason?: string | null;
};

/**
 * 학원 일정 입력 타입
 */
export type AtomicAcademyScheduleInput = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string | null;
  subject?: string | null;
};

/**
 * 플랜 그룹 생성 결과 타입
 */
export type AtomicPlanGroupResult = {
  success: boolean;
  group_id?: string;
  error?: string;
  error_code?: string;
};

/**
 * 원자적으로 플랜 그룹과 관련 데이터를 생성합니다.
 *
 * PostgreSQL 트랜잭션으로 래핑되어 있어 부분 실패 시 자동 롤백됩니다.
 *
 * @param groupData 플랜 그룹 데이터
 * @param contents 플랜 콘텐츠 배열
 * @param exclusions 제외일 배열
 * @param academySchedules 학원 일정 배열
 * @param useAdmin Admin 클라이언트 사용 여부 (관리자 모드)
 */
export async function createPlanGroupAtomic(
  groupData: AtomicPlanGroupInput,
  contents: AtomicPlanContentInput[],
  exclusions: AtomicExclusionInput[],
  academySchedules: AtomicAcademyScheduleInput[],
  useAdmin = false
): Promise<AtomicPlanGroupResult> {
  const supabase = useAdmin
    ? ensureAdminClient()
    : await createSupabaseServerClient();

  if (!supabase) {
    return {
      success: false,
      error: "Supabase 클라이언트를 생성할 수 없습니다.",
    };
  }

  // RPC 함수의 새 시그니처에 맞게 plan_group JSONB로 전달
  const planGroupJsonb = {
    tenant_id: groupData.tenant_id,
    student_id: groupData.student_id,
    name: groupData.name,
    plan_purpose: groupData.plan_purpose,
    scheduler_type: groupData.scheduler_type,
    scheduler_options: groupData.scheduler_options
      ? JSON.parse(JSON.stringify(groupData.scheduler_options))
      : null,
    period_start: groupData.period_start,
    period_end: groupData.period_end,
    target_date: groupData.target_date,
    block_set_id: groupData.block_set_id,
    status: groupData.status,
    subject_constraints: groupData.subject_constraints
      ? JSON.parse(JSON.stringify(groupData.subject_constraints))
      : null,
    additional_period_reallocation: groupData.additional_period_reallocation
      ? JSON.parse(JSON.stringify(groupData.additional_period_reallocation))
      : null,
    non_study_time_blocks: groupData.non_study_time_blocks
      ? JSON.parse(JSON.stringify(groupData.non_study_time_blocks))
      : null,
    daily_schedule: groupData.daily_schedule
      ? JSON.parse(JSON.stringify(groupData.daily_schedule))
      : null,
    plan_type: groupData.plan_type,
    camp_template_id: groupData.camp_template_id,
    camp_invitation_id: groupData.camp_invitation_id,
    use_slot_mode: groupData.use_slot_mode,
    content_slots: groupData.content_slots
      ? JSON.parse(JSON.stringify(groupData.content_slots))
      : null,

    // Phase 3 캘린더 연계 필드
    calendar_id: groupData.calendar_id ?? null,
    creation_mode: groupData.creation_mode ?? null,
    plan_mode: groupData.plan_mode ?? null,
    is_single_day: groupData.is_single_day ?? false,
    study_type: groupData.study_type ?? null,
    strategy_days_per_week: groupData.strategy_days_per_week ?? null,

    // 단일 콘텐츠 모드 필드
    content_type: groupData.content_type ?? null,
    content_id: groupData.content_id ?? null,
    master_content_id: groupData.master_content_id ?? null,
    start_range: groupData.start_range ?? null,
    end_range: groupData.end_range ?? null,
    start_detail_id: groupData.start_detail_id ?? null,
    end_detail_id: groupData.end_detail_id ?? null,
    is_single_content: groupData.is_single_content ?? false,
  };

  const { data, error } = await supabase.rpc("create_plan_group_atomic", {
    p_tenant_id: groupData.tenant_id,
    p_student_id: groupData.student_id,
    p_plan_group: planGroupJsonb as unknown as Json,
    p_contents: contents as unknown as Json,
    p_exclusions: exclusions as unknown as Json,
    p_schedules: academySchedules as unknown as Json,
  });

  if (error) {
    logActionError(
      { domain: "plan", action: "createPlanGroupAtomic" },
      error,
      { tenantId: groupData.tenant_id, studentId: groupData.student_id }
    );
    return {
      success: false,
      error: error.message,
      error_code: error.code,
    };
  }

  // RPC 함수에서 반환한 결과 파싱
  const result = data as {
    success: boolean;
    group_id?: string;
    error?: string;
    error_code?: string;
  };

  if (!result.success) {
    logActionError(
      { domain: "plan", action: "createPlanGroupAtomic" },
      new Error(result.error || "트랜잭션 실패"),
      {
        tenantId: groupData.tenant_id,
        studentId: groupData.student_id,
        errorCode: result.error_code,
      }
    );
    return {
      success: false,
      error: result.error || "알 수 없는 오류가 발생했습니다.",
      error_code: result.error_code,
    };
  }

  return {
    success: true,
    group_id: result.group_id,
  };
}

/**
 * 플랜 페이로드 타입
 */
export type AtomicPlanPayload = {
  plan_group_id: string;
  student_id: string;
  tenant_id: string;
  plan_date: string;
  block_index: number;
  status?: string;
  content_type: string;
  content_id: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  chapter?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  day_type?: string | null;
  week?: number | null;
  day?: number | null;
  is_partial?: boolean;
  is_continued?: boolean;
  content_title?: string | null;
  /** 사용자 정의 플랜 제목 (형식: [과목] 콘텐츠명 범위) */
  custom_title?: string | null;
  content_subject?: string | null;
  content_subject_category?: string | null;
  content_category?: string | null;
  sequence?: number | null;
  plan_number?: number | null;
  is_reschedulable?: boolean;
  is_virtual?: boolean;
  slot_index?: number | null;
  virtual_subject_category?: string | null;
  virtual_description?: string | null;
  // 복습 시스템 필드
  subject_type?: string | null;
  review_group_id?: string | null;
  review_source_content_ids?: string[] | null;
  container_type?: string | null;
  is_active?: boolean;
};

/**
 * 플랜 생성 결과 타입
 */
export type AtomicPlansResult = {
  success: boolean;
  deleted_count?: number;
  inserted_count?: number;
  error?: string;
  error_code?: string;
};

/**
 * 원자적으로 플랜을 생성합니다.
 *
 * 기존 플랜 삭제 → 새 플랜 삽입 → 상태 업데이트가
 * PostgreSQL 트랜잭션으로 래핑되어 있어 부분 실패 시 자동 롤백됩니다.
 *
 * @param groupId 플랜 그룹 ID
 * @param plans 플랜 페이로드 배열
 * @param updateStatusTo 변경할 상태 (선택적)
 * @param useAdmin Admin 클라이언트 사용 여부 (관리자 모드)
 */
export async function generatePlansAtomic(
  groupId: string,
  plans: AtomicPlanPayload[],
  updateStatusTo?: string,
  useAdmin = false
): Promise<AtomicPlansResult> {
  const supabase = useAdmin
    ? ensureAdminClient()
    : await createSupabaseServerClient();

  if (!supabase) {
    return {
      success: false,
      error: "Supabase 클라이언트를 생성할 수 없습니다.",
    };
  }

  const { data, error } = await supabase.rpc("generate_plans_atomic", {
    p_group_id: groupId,
    p_plans: plans,
    p_update_status_to: updateStatusTo ?? undefined,
  });

  if (error) {
    logActionError(
      { domain: "plan", action: "generatePlansAtomic" },
      error,
      { groupId, plansCount: plans.length }
    );
    return {
      success: false,
      error: error.message,
      error_code: error.code,
    };
  }

  // RPC 함수에서 반환한 결과 파싱
  const result = data as {
    success: boolean;
    deleted_count?: number;
    inserted_count?: number;
    error?: string;
    error_code?: string;
  };

  if (!result.success) {
    logActionError(
      { domain: "plan", action: "generatePlansAtomic" },
      new Error(result.error || "트랜잭션 실패"),
      { groupId, plansCount: plans.length, errorCode: result.error_code }
    );
    return {
      success: false,
      error: result.error || "알 수 없는 오류가 발생했습니다.",
      error_code: result.error_code,
    };
  }

  return {
    success: true,
    deleted_count: result.deleted_count,
    inserted_count: result.inserted_count,
  };
}

/**
 * 플랜 콘텐츠 입력 타입 (upsert용)
 */
export type UpsertPlanContentInput = {
  content_type: string;
  content_id: string;
  content_name?: string | null;
  start_range: number;
  end_range: number;
  subject_name?: string | null;
  subject_category?: string | null;
  display_order?: number;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
  master_content_id?: string | null;
  priority?: string | null;
  is_paused?: boolean;
  paused_until?: string | null;
  scheduler_mode?: string | null;
  individual_schedule?: Record<string, unknown> | null;
  custom_study_days?: number[] | null;
  content_scheduler_options?: Record<string, unknown> | null;
  is_auto_recommended?: boolean;
  recommendation_source?: string | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: Record<string, unknown> | null;
  recommended_by?: string | null;
  recommended_at?: string | null;
  generation_status?: string | null;
};

/**
 * 플랜 콘텐츠 upsert 결과 타입
 */
export type UpsertPlanContentsResult = {
  success: boolean;
  deleted_count?: number;
  inserted_count?: number;
  error?: string;
  error_code?: string;
};

/**
 * 원자적으로 plan_contents를 교체합니다.
 *
 * 기존 plan_contents 삭제 → 새 plan_contents 삽입이
 * PostgreSQL 트랜잭션으로 래핑되어 있어 부분 실패 시 자동 롤백됩니다.
 *
 * @param groupId 플랜 그룹 ID
 * @param tenantId 테넌트 ID
 * @param contents 플랜 콘텐츠 배열
 * @param useAdmin Admin 클라이언트 사용 여부 (관리자 모드)
 */
export async function upsertPlanContentsAtomic(
  groupId: string,
  tenantId: string,
  contents: UpsertPlanContentInput[],
  useAdmin = false
): Promise<UpsertPlanContentsResult> {
  const supabase = useAdmin
    ? ensureAdminClient()
    : await createSupabaseServerClient();

  if (!supabase) {
    return {
      success: false,
      error: "Supabase 클라이언트를 생성할 수 없습니다.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("upsert_plan_contents_atomic", {
    p_group_id: groupId,
    p_tenant_id: tenantId,
    p_contents: contents as unknown as Json,
  });



  if (error) {
    logActionError(
      { domain: "plan", action: "upsertPlanContentsAtomic" },
      error,
      { groupId, contentsCount: contents.length }
    );
    return {
      success: false,
      error: error.message,
      error_code: error.code,
    };
  }

  // RPC 함수에서 반환한 결과 파싱
  const result = data as {
    success: boolean;
    deleted_count?: number;
    inserted_count?: number;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    logActionError(
      { domain: "plan", action: "upsertPlanContentsAtomic" },
      new Error(result.error || "트랜잭션 실패"),
      { groupId, contentsCount: contents.length, errorCode: result.code }
    );
    return {
      success: false,
      error: result.error || "알 수 없는 오류가 발생했습니다.",
      error_code: result.code,
    };
  }

  return {
    success: true,
    deleted_count: result.deleted_count,
    inserted_count: result.inserted_count,
  };
}

// ============================================
// Quick Create Atomic RPCs
// ============================================

/**
 * quickCreateFromContent용 플랜그룹 입력 타입
 */
export type QuickCreateFromContentGroupInput = {
  tenant_id: string;
  student_id: string;
  name: string;
  period_start: string;
  period_end: string;
  status?: string;
  creation_mode?: string;
  study_type?: string;
  scheduler_options?: Record<string, unknown>;
};

/**
 * quickCreateFromContent용 플랜 콘텐츠 입��� 타입
 */
export type QuickCreatePlanContentInput = {
  tenant_id: string;
  content_type: string;
  content_id: string;
  content_name: string;
  start_range: number;
  end_range: number;
  subject_name?: string | null;
  subject_category?: string | null;
  display_order?: number;
};

/**
 * quickCreateFromContent용 학습 플랜 입력 타입
 */
export type QuickCreateStudyPlanInput = {
  id: string;
  tenant_id: string;
  student_id: string;
  plan_date: string;
  block_index?: number;
  content_type: string;
  content_id: string;
  content_title: string;
  content_subject?: string | null;
  content_subject_category?: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  status?: string;
  container_type?: string;
  subject_type?: string | null;
  is_active?: boolean;
  sequence?: number;
};

/**
 * quickCreateFromContent 결과 타입
 */
export type QuickCreateFromContentResult = {
  success: boolean;
  group_id?: string;
  study_count?: number;
  review_count?: number;
  error?: string;
  error_code?: string;
};

/**
 * 원자적으로 콘텐츠 기반 빠른 플랜을 생성합니다.
 *
 * plan_groups + plan_contents + student_plan(학습) + student_plan(복습)을
 * 하나의 PostgreSQL 트랜잭션으로 처리합니다.
 */
export async function quickCreateFromContentAtomic(
  groupData: QuickCreateFromContentGroupInput,
  contentData: QuickCreatePlanContentInput,
  studyPlans: QuickCreateStudyPlanInput[],
  reviewPlans: QuickCreateStudyPlanInput[] = [],
  useAdmin = false
): Promise<QuickCreateFromContentResult> {
  const supabase = useAdmin
    ? ensureAdminClient()
    : await createSupabaseServerClient();

  if (!supabase) {
    return {
      success: false,
      error: "Supabase 클라이언트를 생성할 수 없습니다.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("quick_create_from_content_atomic", {
    p_plan_group: groupData as unknown as Json,
    p_plan_content: contentData as unknown as Json,
    p_study_plans: studyPlans as unknown as Json,
    p_review_plans: reviewPlans as unknown as Json,
  });

  if (error) {
    logActionError(
      { domain: "plan", action: "quickCreateFromContentAtomic" },
      error,
      { tenantId: groupData.tenant_id, studentId: groupData.student_id }
    );
    return {
      success: false,
      error: error.message,
      error_code: error.code,
    };
  }

  const result = data as {
    success: boolean;
    group_id?: string;
    study_count?: number;
    review_count?: number;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    logActionError(
      { domain: "plan", action: "quickCreateFromContentAtomic" },
      new Error(result.error || "트랜잭션 실패"),
      {
        tenantId: groupData.tenant_id,
        studentId: groupData.student_id,
        errorCode: result.code,
      }
    );
    return {
      success: false,
      error: result.error || "알 수 없는 오류가 발생했습니다.",
      error_code: result.code,
    };
  }

  return {
    success: true,
    group_id: result.group_id,
    study_count: result.study_count,
    review_count: result.review_count,
  };
}

/**
 * createQuickPlan용 flexible_contents 입력 타입
 */
export type QuickPlanFlexibleContentInput = {
  tenant_id: string;
  student_id: string;
  content_type?: string;
  title: string;
  item_type?: string;
  estimated_minutes?: number;
  subject?: string | null;
};

/**
 * createQuickPlan용 플랜그룹 입력 타입 (레거시 생성)
 */
export type QuickPlanGroupInput = {
  student_id: string;
  tenant_id: string;
  name: string;
  plan_purpose?: string | null;
  period_start: string;
  period_end: string;
  status?: string;
  plan_mode?: string | null;
  is_single_day?: boolean;
  creation_mode?: string | null;
  last_admin_id?: string | null;
  admin_modified_at?: string | null;
};

/**
 * createQuickPlan용 student_plan 입력 타입
 */
export type QuickPlanStudentPlanInput = {
  student_id: string;
  tenant_id: string;
  plan_date: string;
  block_index?: number;
  content_type: string;
  content_id?: string | null;
  content_title: string;
  container_type?: string;
  status?: string;
  is_virtual?: boolean;
  is_adhoc?: boolean;
  flexible_content_id?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  estimated_minutes?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  tags?: string[];
  color?: string | null;
  icon?: string | null;
  priority?: number;
};

/**
 * createQuickPlan 결과 타입
 */
export type CreateQuickPlanAtomicResult = {
  success: boolean;
  plan_group_id?: string;
  plan_id?: string;
  flexible_content_id?: string;
  error?: string;
  error_code?: string;
};

/**
 * 원자적으로 빠른 단일 플랜을 생성합니다.
 *
 * (optional) flexible_contents + (optional) plan_groups + student_plan을
 * 하나의 PostgreSQL 트랜잭션으로 처리합니다.
 */
export async function createQuickPlanAtomic(
  studentPlan: QuickPlanStudentPlanInput,
  options: {
    flexibleContent?: QuickPlanFlexibleContentInput;
    planGroup?: QuickPlanGroupInput;
    planGroupId?: string;
  },
  useAdmin = false
): Promise<CreateQuickPlanAtomicResult> {
  const supabase = useAdmin
    ? ensureAdminClient()
    : await createSupabaseServerClient();

  if (!supabase) {
    return {
      success: false,
      error: "Supabase 클라이언트를 생성할 수 없습니다.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("create_quick_plan_atomic", {
    p_flexible_content: options.flexibleContent
      ? (options.flexibleContent as unknown as Json)
      : null,
    p_plan_group: options.planGroup
      ? (options.planGroup as unknown as Json)
      : null,
    p_plan_group_id: options.planGroupId ?? null,
    p_student_plan: studentPlan as unknown as Json,
  });

  if (error) {
    logActionError(
      { domain: "plan", action: "createQuickPlanAtomic" },
      error,
      {
        studentId: studentPlan.student_id,
        tenantId: studentPlan.tenant_id,
      }
    );
    return {
      success: false,
      error: error.message,
      error_code: error.code,
    };
  }

  const result = data as {
    success: boolean;
    plan_group_id?: string;
    plan_id?: string;
    flexible_content_id?: string;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    logActionError(
      { domain: "plan", action: "createQuickPlanAtomic" },
      new Error(result.error || "트랜잭션 실패"),
      {
        studentId: studentPlan.student_id,
        tenantId: studentPlan.tenant_id,
        errorCode: result.code,
      }
    );
    return {
      success: false,
      error: result.error || "알 수 없는 오류가 발생했습니다.",
      error_code: result.code,
    };
  }

  return {
    success: true,
    plan_group_id: result.plan_group_id,
    plan_id: result.plan_id,
    flexible_content_id: result.flexible_content_id,
  };
}

/**
 * appendPlansToGroup용 플랜 콘텐츠 입력 타입
 */
export type AppendPlanContentInput = {
  tenant_id: string;
  content_type: string;
  content_id: string;
  content_name: string;
  start_range: number;
  end_range: number;
  subject_name?: string | null;
  subject_category?: string | null;
  display_order?: number;
};

/**
 * appendPlansToGroup용 플랜 입력 타입
 */
export type AppendStudentPlanInput = {
  tenant_id: string;
  student_id: string;
  plan_date: string;
  block_index?: number;
  content_type: string;
  content_id: string;
  content_title: string;
  content_subject?: string | null;
  content_subject_category?: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  status?: string;
  container_type?: string;
  subject_type?: string | null;
  day_type?: string | null;
  review_group_id?: string | null;
  review_source_content_ids?: string[];
  is_active?: boolean;
};

/**
 * appendPlansToGroup용 그룹 업데이트 입력 타입
 */
export type AppendGroupUpdateInput = {
  is_calendar_only?: boolean;
  content_status?: string;
  status?: string;
};

/**
 * appendPlansToGroup 결과 타입
 */
export type AppendPlansToGroupResult = {
  success: boolean;
  content_id?: string;
  inserted_count?: number;
  error?: string;
  error_code?: string;
};

/**
 * 원자적으로 기존 플랜 그룹에 콘텐츠와 플랜을 추가��니다.
 *
 * plan_contents 생성 + student_plan 일괄 삽입 + plan_groups 메타데이터 업데이트를
 * 하나의 PostgreSQL 트랜잭션으로 처리합니다. 기존 데이터는 보존됩니다.
 */
export async function appendPlansToGroupAtomic(
  planGroupId: string,
  contentData: AppendPlanContentInput,
  plans: AppendStudentPlanInput[],
  groupUpdate: AppendGroupUpdateInput = {},
  useAdmin = false
): Promise<AppendPlansToGroupResult> {
  const supabase = useAdmin
    ? ensureAdminClient()
    : await createSupabaseServerClient();

  if (!supabase) {
    return {
      success: false,
      error: "Supabase 클라이언트를 생성할 수 없습니다.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("append_plans_to_group_atomic", {
    p_plan_group_id: planGroupId,
    p_plan_content: contentData as unknown as Json,
    p_plans: plans as unknown as Json,
    p_group_update: groupUpdate as unknown as Json,
  });

  if (error) {
    logActionError(
      { domain: "plan", action: "appendPlansToGroupAtomic" },
      error,
      { planGroupId, plansCount: plans.length }
    );
    return {
      success: false,
      error: error.message,
      error_code: error.code,
    };
  }

  const result = data as {
    success: boolean;
    content_id?: string;
    inserted_count?: number;
    error?: string;
    code?: string;
  };

  if (!result.success) {
    logActionError(
      { domain: "plan", action: "appendPlansToGroupAtomic" },
      new Error(result.error || "트랜잭션 실패"),
      { planGroupId, plansCount: plans.length, errorCode: result.code }
    );
    return {
      success: false,
      error: result.error || "알 수 없는 오류가 발생했습니다.",
      error_code: result.code,
    };
  }

  return {
    success: true,
    content_id: result.content_id,
    inserted_count: result.inserted_count,
  };
}
