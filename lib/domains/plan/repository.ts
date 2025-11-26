/**
 * Plan 도메인 Repository
 *
 * 이 파일은 순수한 데이터 접근만을 담당합니다.
 * 기존 lib/data/planGroups.ts, lib/data/studentPlans.ts의
 * 데이터 접근 로직을 추출했습니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PlanGroup,
  Plan,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
} from "@/lib/types/plan";
import type { PlanGroupFilters, StudentPlanFilters } from "./types";

// ============================================
// Plan Group Repository
// ============================================

/**
 * 플랜 그룹 목록 조회
 */
export async function findPlanGroups(
  filters: PlanGroupFilters
): Promise<PlanGroup[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_groups")
    .select(
      "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
    )
    .eq("student_id", filters.studentId);

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

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return (data as PlanGroup[]) ?? [];
}

/**
 * 플랜 그룹 ID로 조회
 */
export async function findPlanGroupById(
  groupId: string,
  studentId: string,
  tenantId?: string | null
): Promise<PlanGroup | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_groups")
    .select(
      "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
    )
    .eq("id", groupId)
    .eq("student_id", studentId)
    .is("deleted_at", null);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data as PlanGroup | null;
}

/**
 * 플랜 그룹 생성
 */
export async function insertPlanGroup(
  data: Partial<PlanGroup>
): Promise<PlanGroup> {
  const supabase = await createSupabaseServerClient();

  const { data: created, error } = await supabase
    .from("plan_groups")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return created as PlanGroup;
}

/**
 * 플랜 그룹 수정
 */
export async function updatePlanGroupById(
  groupId: string,
  studentId: string,
  updates: Partial<PlanGroup>
): Promise<PlanGroup> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("plan_groups")
    .update(updates)
    .eq("id", groupId)
    .eq("student_id", studentId)
    .select()
    .single();

  if (error) throw error;
  return data as PlanGroup;
}

/**
 * 플랜 그룹 삭제 (soft delete)
 */
export async function softDeletePlanGroup(
  groupId: string,
  studentId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("plan_groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", groupId)
    .eq("student_id", studentId);

  if (error) throw error;
}

// ============================================
// Plan Content Repository
// ============================================

/**
 * 플랜 콘텐츠 목록 조회
 */
export async function findPlanContents(
  planGroupId: string
): Promise<PlanContent[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("plan_contents")
    .select("*")
    .eq("plan_group_id", planGroupId)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data as PlanContent[]) ?? [];
}

/**
 * 플랜 콘텐츠 일괄 생성
 */
export async function insertPlanContents(
  contents: Array<Partial<PlanContent>>
): Promise<PlanContent[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("plan_contents")
    .insert(contents)
    .select();

  if (error) throw error;
  return (data as PlanContent[]) ?? [];
}

/**
 * 플랜 콘텐츠 삭제 (plan_group_id 기준)
 */
export async function deletePlanContentsByGroupId(
  planGroupId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("plan_contents")
    .delete()
    .eq("plan_group_id", planGroupId);

  if (error) throw error;
}

// ============================================
// Student Plan Repository
// ============================================

/**
 * 학생 플랜 목록 조회
 */
export async function findStudentPlans(
  filters: StudentPlanFilters
): Promise<Plan[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("student_plan")
    .select(
      "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,memo,created_at,updated_at"
    )
    .eq("student_id", filters.studentId);

  if (filters.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }

  if (filters.planDate) {
    const planDateStr = filters.planDate.slice(0, 10);
    query = query.eq("plan_date", planDateStr);
  } else if (filters.dateRange) {
    const startStr = filters.dateRange.start.slice(0, 10);
    const endStr = filters.dateRange.end.slice(0, 10);
    query = query.gte("plan_date", startStr).lte("plan_date", endStr);
  }

  if (filters.contentType) {
    query = query.eq("content_type", filters.contentType);
  }

  if (filters.planGroupIds && filters.planGroupIds.length > 0) {
    query = query.in("plan_group_id", filters.planGroupIds);
  }

  const { data, error } = await query
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (error) throw error;
  return (data as Plan[]) ?? [];
}

/**
 * 학생 플랜 단건 조회
 */
export async function findStudentPlanById(
  planId: string,
  studentId: string
): Promise<Plan | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_plan")
    .select("*")
    .eq("id", planId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data as Plan | null;
}

/**
 * 학생 플랜 생성
 */
export async function insertStudentPlan(
  plan: Partial<Plan>
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_plan")
    .insert(plan)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * 학생 플랜 일괄 생성
 */
export async function insertStudentPlans(
  plans: Array<Partial<Plan>>
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_plan")
    .insert(plans)
    .select("id");

  if (error) throw error;
  return (data ?? []).map((p) => p.id);
}

/**
 * 학생 플랜 수정
 */
export async function updateStudentPlanById(
  planId: string,
  studentId: string,
  updates: Partial<Plan>
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_plan")
    .update(updates)
    .eq("id", planId)
    .eq("student_id", studentId);

  if (error) throw error;
}

/**
 * 학생 플랜 삭제
 */
export async function deleteStudentPlanById(
  planId: string,
  studentId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_plan")
    .delete()
    .eq("id", planId)
    .eq("student_id", studentId);

  if (error) throw error;
}

/**
 * 플랜 그룹의 모든 플랜 삭제
 */
export async function deleteStudentPlansByGroupId(
  planGroupId: string,
  studentId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_plan")
    .delete()
    .eq("plan_group_id", planGroupId)
    .eq("student_id", studentId);

  if (error) throw error;
}

// ============================================
// Plan Exclusion Repository
// ============================================

/**
 * 제외일 목록 조회
 */
export async function findPlanExclusions(
  studentId: string,
  tenantId?: string | null
): Promise<PlanExclusion[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_exclusions")
    .select("*")
    .eq("student_id", studentId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.order("exclusion_date", {
    ascending: true,
  });

  if (error) throw error;
  return (data as PlanExclusion[]) ?? [];
}

/**
 * 제외일 생성
 */
export async function insertPlanExclusion(
  exclusion: Partial<PlanExclusion>
): Promise<PlanExclusion> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("plan_exclusions")
    .insert(exclusion)
    .select()
    .single();

  if (error) throw error;
  return data as PlanExclusion;
}

/**
 * 제외일 삭제
 */
export async function deletePlanExclusionById(
  exclusionId: string,
  studentId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("id", exclusionId)
    .eq("student_id", studentId);

  if (error) throw error;
}

// ============================================
// Academy Schedule Repository
// ============================================

/**
 * 학원 일정 목록 조회
 */
export async function findAcademySchedules(
  studentId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("academy_schedules")
    .select("*")
    .eq("student_id", studentId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data as AcademySchedule[]) ?? [];
}

