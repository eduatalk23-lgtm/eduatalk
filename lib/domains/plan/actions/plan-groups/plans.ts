"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import {
  verifyPlanGroupAccess,
  getStudentIdForPlanGroup,
  getPlanGroupWithDetailsByRole,
} from "@/lib/auth/planGroupAuth";
import {
  generatePlansWithServices,
  previewPlansWithServices,
} from "@/lib/plan/services";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 플랜 생성 액션
 *
 * 서비스 레이어 기반 구현을 사용합니다.
 */
async function _generatePlansFromGroup(
  groupId: string
): Promise<{ count: number }> {
  console.log("[_generatePlansFromGroup] 호출됨", { groupId });
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();
  console.log("[_generatePlansFromGroup] 인증 정보", { role: access.role, tenantId: tenantContext.tenantId });

  // 플랜 그룹 정보 조회하여 studentId와 isCampMode 결정
  const { group } = await getPlanGroupWithDetailsByRole(
    groupId,
    access.user.userId,
    access.role,
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

  // admin/consultant인 경우 group.student_id 사용, 아니면 현재 사용자
  const studentId = getStudentIdForPlanGroup(
    group,
    access.user.userId,
    access.role
  );

  // 캠프 모드 여부: camp_template_id가 있으면 캠프 모드
  const isCampMode = !!group.camp_template_id;

  const result = await generatePlansWithServices({
    groupId,
    context: {
      studentId,
      tenantId: tenantContext.tenantId,
      userId: access.user.userId,
      role: access.role,
      isCampMode,
    },
    accessInfo: {
      userId: access.user.userId,
      role: access.role,
    },
  });

  if (!result.success) {
    throw new AppError(
      result.error ?? "플랜 생성에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
      { errorCode: result.errorCode }
    );
  }

  return { count: result.count ?? 0 };
}

export const generatePlansFromGroupAction = withErrorHandling(
  _generatePlansFromGroup
);

/**
 * 플랜 미리보기 액션
 *
 * 서비스 레이어 기반 구현을 사용합니다.
 */
async function _previewPlansFromGroup(
  groupId: string
): Promise<{ plans: Array<{
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null;
  end_time: string | null;
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  plan_number: number | null;
}> }> {
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();

  // 플랜 그룹 정보 조회하여 studentId와 isCampMode 결정
  const { group } = await getPlanGroupWithDetailsByRole(
    groupId,
    access.user.userId,
    access.role,
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

  // admin/consultant인 경우 group.student_id 사용, 아니면 현재 사용자
  const studentId = getStudentIdForPlanGroup(
    group,
    access.user.userId,
    access.role
  );

  // 캠프 모드 여부: camp_template_id가 있으면 캠프 모드
  const isCampMode = !!group.camp_template_id;

  const result = await previewPlansWithServices({
    groupId,
    context: {
      studentId,
      tenantId: tenantContext.tenantId,
      userId: access.user.userId,
      role: access.role,
      isCampMode,
    },
    accessInfo: {
      userId: access.user.userId,
      role: access.role,
    },
  });

  if (!result.success) {
    throw new AppError(
      result.error ?? "플랜 미리보기에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true,
      { errorCode: result.errorCode }
    );
  }

  return { plans: result.plans ?? [] };
}

export const previewPlansFromGroupAction = withErrorHandling(
  _previewPlansFromGroup
);

// --- 나머지 유틸리티 함수들 ---

async function _getPlansByGroupId(groupId: string): Promise<{
  plans: Array<{
    id: string;
    plan_date: string | null;
    block_index: number | null;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
    is_reschedulable: boolean;
    sequence: number | null;
  }>;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 플랜 데이터 조회
  const { data: plans, error } = await supabase
    .from("student_plan")
    .select(
      `
      id,
      plan_date,
      block_index,
      content_type,
      content_id,
      chapter,
      planned_start_page_or_time,
      planned_end_page_or_time,
      completed_amount,
      is_reschedulable,
      sequence
    `
    )
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (error) {
    logActionError(
      { domain: "plan", action: "getPlansByGroupId" },
      error,
      { groupId }
    );
    throw new AppError(
      error.message || "플랜 목록 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  // student_plan 테이블의 타입 정의 (sequence 필드 포함)
  type StudentPlanRow = {
    id: string;
    plan_date: string | null;
    block_index: number | null;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
    is_reschedulable: boolean | null;
    sequence: number | null;
  };

  return {
    plans: ((plans as StudentPlanRow[] | null) || []).map((plan) => ({
      id: plan.id,
      plan_date: plan.plan_date,
      block_index: plan.block_index,
      content_type: plan.content_type,
      content_id: plan.content_id,
      chapter: plan.chapter,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      completed_amount: plan.completed_amount,
      is_reschedulable: plan.is_reschedulable ?? true,
      sequence: plan.sequence ?? null,
    })),
  };
}

export const getPlansByGroupIdAction = withErrorHandling(_getPlansByGroupId);

async function _getActivePlanGroups(
  excludeGroupId?: string
): Promise<Array<{ id: string; name: string | null }>> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_groups")
    .select("id, name")
    .eq("student_id", user.userId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (excludeGroupId) {
    query = query.neq("id", excludeGroupId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      "활성 플랜 그룹 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return data || [];
}

export const getActivePlanGroups = withErrorHandling(_getActivePlanGroups);
