"use server";

/**
 * Plan Domain Transaction Utilities
 *
 * PostgreSQL RPC 함수를 통한 원자적 트랜잭션 처리
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAdminClient } from "@/lib/supabase/clientSelector";
import type { Json } from "@/lib/supabase/database.types";

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
    console.error("[createPlanGroupAtomic] RPC 호출 실패:", error);
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
    console.error("[createPlanGroupAtomic] 트랜잭션 실패:", result);
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
  content_subject?: string | null;
  content_subject_category?: string | null;
  sequence?: number | null;
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
    console.error("[generatePlansAtomic] RPC 호출 실패:", error);
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
    console.error("[generatePlansAtomic] 트랜잭션 실패:", result);
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
