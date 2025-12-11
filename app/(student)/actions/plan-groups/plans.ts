"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

// --- 리팩토링된 함수 import 및 re-export ---
// 원본 함수는 previewPlansRefactored.ts와 generatePlansRefactored.ts로 이동됨
import { generatePlansFromGroupRefactoredAction } from "./generatePlansRefactored";
import { previewPlansFromGroupRefactoredAction } from "./previewPlansRefactored";

export const generatePlansFromGroupAction = generatePlansFromGroupRefactoredAction;
export const previewPlansFromGroupAction = previewPlansFromGroupRefactoredAction;

// --- 나머지 유틸리티 함수들 ---

async function _getPlansByGroupId(groupId: string): Promise<{
  plans: Array<{
    id: string;
    plan_date: string;
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
    console.error("[planGroupActions] 플랜 목록 조회 실패", error);
    throw new AppError(
      error.message || "플랜 목록 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return {
    plans: (plans || []).map((plan) => ({
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
      sequence: (plan as any).sequence ?? null,
    })),
  };
}

export const getPlansByGroupIdAction = withErrorHandling(_getPlansByGroupId);

async function _checkPlansExist(groupId: string): Promise<{
  hasPlans: boolean;
  planCount: number;
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
  const { count, error } = await supabase
    .from("student_plan")
    .select("*", { count: "exact", head: true })
    .eq("plan_group_id", groupId)
    .eq("student_id", user.userId);

  if (error) {
    console.error("[planGroupActions] 플랜 개수 확인 실패", error);
    throw new AppError(
      error.message || "플랜 개수 확인에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  return {
    hasPlans: (count ?? 0) > 0,
    planCount: count ?? 0,
  };
}

export const checkPlansExistAction = withErrorHandling(_checkPlansExist);

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
