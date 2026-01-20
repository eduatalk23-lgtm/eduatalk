/**
 * 통합 Ad-hoc 플랜 조회
 *
 * Phase 3.1: student_plan (is_adhoc=true)와 ad_hoc_plans 통합 조회
 *
 * @module lib/data/unifiedAdHocPlans
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

// ============================================
// Types
// ============================================

/**
 * 통합 Ad-hoc 플랜 타입
 * 두 테이블의 공통 필드를 통합한 타입
 */
export type UnifiedAdHocPlan = {
  id: string;
  student_id: string;
  tenant_id: string;
  plan_group_id: string | null;
  plan_date: string;
  title: string;
  description: string | null;
  content_type: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  status: string | null;
  container_type: string | null;
  start_time: string | null;
  end_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  simple_completed_at: string | null;
  simple_completion: boolean | null;
  paused_at: string | null;
  paused_duration_seconds: number | null;
  pause_count: number | null;
  color: string | null;
  icon: string | null;
  tags: string[] | null;
  priority: number | null;
  order_index: number | null;
  page_range_start: number | null;
  page_range_end: number | null;
  flexible_content_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** 데이터 소스 테이블 */
  source_table: "student_plan" | "ad_hoc_plans";
};

/**
 * 조회 옵션
 */
export type UnifiedAdHocQueryOptions = {
  studentId: string;
  tenantId?: string | null;
  /** 특정 날짜 조회 */
  planDate?: string;
  /** 날짜 범위 조회 */
  dateRange?: {
    start: string;
    end: string;
  };
  /** 상태 필터 */
  status?: string[];
  /** 컨테이너 타입 필터 */
  containerType?: string;
  /** Plan Group 필터 */
  planGroupId?: string;
  /** 정렬 */
  orderBy?: {
    column: "plan_date" | "created_at" | "order_index";
    ascending?: boolean;
  };
  /** 레거시 테이블 포함 여부 (기본: true) */
  includeLegacy?: boolean;
};

// ============================================
// Helper Functions
// ============================================

/**
 * student_plan 행을 UnifiedAdHocPlan으로 변환
 */
function mapStudentPlanToUnified(
  plan: Tables<"student_plan">
): UnifiedAdHocPlan {
  return {
    id: plan.id,
    student_id: plan.student_id,
    tenant_id: plan.tenant_id,
    plan_group_id: plan.plan_group_id,
    plan_date: plan.plan_date,
    title: plan.content_title ?? "",
    description: plan.description,
    content_type: plan.content_type,
    estimated_minutes: plan.estimated_minutes,
    actual_minutes: plan.actual_minutes,
    status: plan.status,
    container_type: plan.container_type,
    start_time: plan.start_time,
    end_time: plan.end_time,
    started_at: plan.started_at,
    completed_at: plan.completed_at,
    simple_completed_at: plan.simple_completed_at,
    simple_completion: plan.simple_completion,
    paused_at: plan.paused_at,
    paused_duration_seconds: plan.paused_duration_seconds,
    pause_count: plan.pause_count,
    color: plan.color,
    icon: plan.icon,
    tags: plan.tags,
    priority: plan.priority,
    order_index: plan.order_index,
    page_range_start: plan.planned_start_page_or_time,
    page_range_end: plan.planned_end_page_or_time,
    flexible_content_id: plan.flexible_content_id,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    source_table: "student_plan",
  };
}

/**
 * ad_hoc_plans 행을 UnifiedAdHocPlan으로 변환
 */
function mapAdHocPlanToUnified(
  plan: Tables<"ad_hoc_plans">
): UnifiedAdHocPlan {
  return {
    id: plan.id,
    student_id: plan.student_id,
    tenant_id: plan.tenant_id,
    plan_group_id: plan.plan_group_id,
    plan_date: plan.plan_date,
    title: plan.title,
    description: plan.description,
    content_type: plan.content_type,
    estimated_minutes: plan.estimated_minutes,
    actual_minutes: plan.actual_minutes,
    status: plan.status,
    container_type: plan.container_type,
    start_time: plan.start_time,
    end_time: plan.end_time,
    started_at: plan.started_at,
    completed_at: plan.completed_at,
    simple_completed_at: plan.simple_completed_at,
    simple_completion: plan.simple_completion,
    paused_at: plan.paused_at,
    paused_duration_seconds: plan.paused_duration_seconds,
    pause_count: plan.pause_count,
    color: plan.color,
    icon: plan.icon,
    tags: plan.tags,
    priority: plan.priority,
    order_index: plan.order_index,
    page_range_start: plan.page_range_start,
    page_range_end: plan.page_range_end,
    flexible_content_id: plan.flexible_content_id,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    source_table: "ad_hoc_plans",
  };
}

// ============================================
// Main Query Functions
// ============================================

/**
 * 통합 Ad-hoc 플랜 목록 조회
 *
 * student_plan (is_adhoc=true)와 ad_hoc_plans를 함께 조회하여 통합 반환
 *
 * @param options 조회 옵션
 * @returns 통합 Ad-hoc 플랜 목록
 */
export async function getUnifiedAdHocPlans(
  options: UnifiedAdHocQueryOptions
): Promise<UnifiedAdHocPlan[]> {
  const {
    studentId,
    tenantId,
    planDate,
    dateRange,
    status,
    containerType,
    planGroupId,
    orderBy = { column: "plan_date", ascending: true },
    includeLegacy = true,
  } = options;

  const supabase = await createSupabaseServerClient();
  const results: UnifiedAdHocPlan[] = [];

  // 1. student_plan에서 is_adhoc=true 조회
  let studentPlanQuery = supabase
    .from("student_plan")
    .select("*")
    .eq("student_id", studentId)
    .eq("is_adhoc", true);

  if (tenantId) {
    studentPlanQuery = studentPlanQuery.eq("tenant_id", tenantId);
  }

  if (planDate) {
    studentPlanQuery = studentPlanQuery.eq("plan_date", planDate);
  } else if (dateRange) {
    studentPlanQuery = studentPlanQuery
      .gte("plan_date", dateRange.start)
      .lte("plan_date", dateRange.end);
  }

  if (status && status.length > 0) {
    studentPlanQuery = studentPlanQuery.in("status", status);
  }

  if (containerType) {
    studentPlanQuery = studentPlanQuery.eq("container_type", containerType);
  }

  if (planGroupId) {
    studentPlanQuery = studentPlanQuery.eq("plan_group_id", planGroupId);
  }

  studentPlanQuery = studentPlanQuery.order(orderBy.column, {
    ascending: orderBy.ascending ?? true,
  });

  const { data: studentPlans, error: studentPlanError } = await studentPlanQuery;

  if (studentPlanError) {
    console.error("[unifiedAdHocPlans] student_plan 조회 오류:", studentPlanError);
  } else if (studentPlans) {
    results.push(...studentPlans.map(mapStudentPlanToUnified));
  }

  // 2. ad_hoc_plans에서 레거시 데이터 조회 (옵션)
  if (includeLegacy) {
    let adHocQuery = supabase
      .from("ad_hoc_plans")
      .select("*")
      .eq("student_id", studentId);

    if (tenantId) {
      adHocQuery = adHocQuery.eq("tenant_id", tenantId);
    }

    if (planDate) {
      adHocQuery = adHocQuery.eq("plan_date", planDate);
    } else if (dateRange) {
      adHocQuery = adHocQuery
        .gte("plan_date", dateRange.start)
        .lte("plan_date", dateRange.end);
    }

    if (status && status.length > 0) {
      adHocQuery = adHocQuery.in("status", status);
    }

    if (containerType) {
      adHocQuery = adHocQuery.eq("container_type", containerType);
    }

    if (planGroupId) {
      adHocQuery = adHocQuery.eq("plan_group_id", planGroupId);
    }

    adHocQuery = adHocQuery.order(orderBy.column, {
      ascending: orderBy.ascending ?? true,
    });

    const { data: adHocPlans, error: adHocError } = await adHocQuery;

    if (adHocError) {
      console.error("[unifiedAdHocPlans] ad_hoc_plans 조회 오류:", adHocError);
    } else if (adHocPlans) {
      results.push(...adHocPlans.map(mapAdHocPlanToUnified));
    }
  }

  // 3. 정렬 (두 테이블 결과 통합 후)
  results.sort((a, b) => {
    const aVal = a[orderBy.column] ?? "";
    const bVal = b[orderBy.column] ?? "";
    const comparison = String(aVal).localeCompare(String(bVal));
    return orderBy.ascending ? comparison : -comparison;
  });

  return results;
}

/**
 * 특정 날짜의 통합 Ad-hoc 플랜 조회 (Today 페이지용)
 */
export async function getUnifiedAdHocPlansForDate(
  studentId: string,
  planDate: string,
  tenantId?: string | null
): Promise<UnifiedAdHocPlan[]> {
  return getUnifiedAdHocPlans({
    studentId,
    tenantId,
    planDate,
    orderBy: { column: "order_index", ascending: true },
  });
}

/**
 * 날짜 범위의 통합 Ad-hoc 플랜 조회 (캘린더용)
 */
export async function getUnifiedAdHocPlansForDateRange(
  studentId: string,
  startDate: string,
  endDate: string,
  tenantId?: string | null
): Promise<UnifiedAdHocPlan[]> {
  return getUnifiedAdHocPlans({
    studentId,
    tenantId,
    dateRange: { start: startDate, end: endDate },
    orderBy: { column: "plan_date", ascending: true },
  });
}

/**
 * 단일 Ad-hoc 플랜 조회 (ID로)
 *
 * 두 테이블 모두에서 검색하여 반환
 */
export async function getUnifiedAdHocPlanById(
  planId: string,
  studentId: string
): Promise<UnifiedAdHocPlan | null> {
  const supabase = await createSupabaseServerClient();

  // 1. student_plan에서 먼저 검색
  const { data: studentPlan, error: spError } = await supabase
    .from("student_plan")
    .select("*")
    .eq("id", planId)
    .eq("student_id", studentId)
    .eq("is_adhoc", true)
    .maybeSingle();

  if (!spError && studentPlan) {
    return mapStudentPlanToUnified(studentPlan);
  }

  // 2. ad_hoc_plans에서 검색
  const { data: adHocPlan, error: ahError } = await supabase
    .from("ad_hoc_plans")
    .select("*")
    .eq("id", planId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!ahError && adHocPlan) {
    return mapAdHocPlanToUnified(adHocPlan);
  }

  return null;
}

/**
 * 컨테이너별 Ad-hoc 플랜 조회 (Today 페이지 컨테이너용)
 */
export async function getUnifiedAdHocPlansByContainer(
  studentId: string,
  planDate: string,
  containerType: "daily" | "weekly" | "unfinished",
  tenantId?: string | null
): Promise<UnifiedAdHocPlan[]> {
  return getUnifiedAdHocPlans({
    studentId,
    tenantId,
    planDate,
    containerType,
    orderBy: { column: "order_index", ascending: true },
  });
}
