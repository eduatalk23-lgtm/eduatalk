"use server";

/**
 * Goal 도메인 Server Actions
 *
 * 학생용 목표 관리 액션을 제공합니다.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireStudent } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  createGoal,
  updateGoal,
  deleteGoal,
  getGoalById,
  recordGoalProgress,
} from "@/lib/data/studentGoals";
import { getPlanById } from "@/lib/data/studentPlans";
import { getSessionById } from "@/lib/data/studentSessions";
import { recordHistory } from "@/lib/history/record";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllGoals } from "@/lib/goals/queries";

// ============================================
// Goal CRUD Actions
// ============================================

/**
 * 목표 생성
 */
export async function createGoalAction(formData: FormData): Promise<void> {
  const { userId, tenantId } = await requireStudent();

  if (!tenantId) {
    throw new Error("기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const goalType = String(formData.get("goal_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const contentId = String(formData.get("content_id") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const expectedAmountInput = String(formData.get("expected_amount") ?? "").trim();
  const targetScoreInput = String(formData.get("target_score") ?? "").trim();

  // 유효성 검증
  if (!goalType || !["range", "exam", "weekly", "monthly"].includes(goalType)) {
    throw new Error("목표 종류를 선택해주세요.");
  }

  if (!title) {
    throw new Error("목표명을 입력해주세요.");
  }

  if (!startDate || !endDate) {
    throw new Error("시작일과 종료일을 입력해주세요.");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("올바른 날짜 형식을 입력해주세요.");
  }

  if (end < start) {
    throw new Error("종료일은 시작일 이후여야 합니다.");
  }

  const expectedAmount = expectedAmountInput ? parseInt(expectedAmountInput, 10) : null;
  const targetScore = targetScoreInput ? parseInt(targetScoreInput, 10) : null;

  if (expectedAmount !== null && (!Number.isFinite(expectedAmount) || expectedAmount <= 0)) {
    throw new Error("목표량은 0보다 큰 숫자여야 합니다.");
  }

  if (targetScore !== null && (!Number.isFinite(targetScore) || targetScore < 1 || targetScore > 9)) {
    throw new Error("성적 목표는 1~9 사이의 숫자여야 합니다.");
  }

  // 목표 생성
  const result = await createGoal({
    tenant_id: tenantId,
    student_id: userId,
    goal_type: goalType as "range" | "exam" | "weekly" | "monthly",
    title,
    description: description || null,
    subject: subject || null,
    content_id: contentId || null,
    start_date: startDate,
    end_date: endDate,
    expected_amount: expectedAmount,
    target_score: targetScore,
  });

  if (!result.success) {
    throw new Error(result.error || "목표 생성에 실패했습니다.");
  }

  // 히스토리 기록
  const supabase = await createSupabaseServerClient();
  await recordHistory(
    supabase,
    userId,
    "goal_created",
    {
      goal_type: goalType,
      title,
      subject: subject || null,
      start_date: startDate,
      end_date: endDate,
    },
    tenantId
  );

  revalidatePath("/today");
  redirect("/today");
}

/**
 * 목표 수정
 */
export async function updateGoalAction(goalId: string, formData: FormData): Promise<void> {
  const { userId } = await requireStudent();

  const goalType = String(formData.get("goal_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const contentId = String(formData.get("content_id") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const expectedAmountInput = String(formData.get("expected_amount") ?? "").trim();
  const targetScoreInput = String(formData.get("target_score") ?? "").trim();

  // 유효성 검증
  if (!goalType || !["range", "exam", "weekly", "monthly"].includes(goalType)) {
    throw new Error("목표 종류를 선택해주세요.");
  }

  if (!title) {
    throw new Error("목표명을 입력해주세요.");
  }

  if (!startDate || !endDate) {
    throw new Error("시작일과 종료일을 입력해주세요.");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("올바른 날짜 형식을 입력해주세요.");
  }

  if (end < start) {
    throw new Error("종료일은 시작일 이후여야 합니다.");
  }

  const expectedAmount = expectedAmountInput ? parseInt(expectedAmountInput, 10) : null;
  const targetScore = targetScoreInput ? parseInt(targetScoreInput, 10) : null;

  if (expectedAmount !== null && (!Number.isFinite(expectedAmount) || expectedAmount <= 0)) {
    throw new Error("목표량은 0보다 큰 숫자여야 합니다.");
  }

  if (targetScore !== null && (!Number.isFinite(targetScore) || targetScore < 1 || targetScore > 9)) {
    throw new Error("성적 목표는 1~9 사이의 숫자여야 합니다.");
  }

  // 목표 수정
  const result = await updateGoal(goalId, userId, {
    goal_type: goalType as "range" | "exam" | "weekly" | "monthly",
    title,
    description: description || null,
    subject: subject || null,
    content_id: contentId || null,
    start_date: startDate,
    end_date: endDate,
    expected_amount: expectedAmount,
    target_score: targetScore,
  });

  if (!result.success) {
    throw new Error(result.error || "목표 수정에 실패했습니다.");
  }

  revalidatePath("/today");
  redirect("/today");
}

/**
 * 목표 삭제
 */
export async function deleteGoalAction(goalId: string): Promise<void> {
  const { userId } = await requireStudent();

  const result = await deleteGoal(goalId, userId);

  if (!result.success) {
    throw new Error(result.error || "목표 삭제에 실패했습니다.");
  }

  revalidatePath("/today");
  redirect("/today");
}

// ============================================
// Goal Query Actions
// ============================================

/**
 * 모든 목표 조회
 */
export async function getAllGoalsAction(): Promise<Array<{ id: string; title: string; goal_type: string }>> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return [];
  }

  try {
    const supabase = await createSupabaseServerClient();
    const goals = await getAllGoals(supabase, user.userId);
    return goals.map((g) => ({
      id: g.id,
      title: g.title,
      goal_type: g.goal_type,
    }));
  } catch (error) {
    logActionError({ domain: "goal", action: "getAllGoalsAction" }, error);
    return [];
  }
}

// ============================================
// Goal Progress Actions
// ============================================

/**
 * 목표 진행률 기록
 */
export async function recordGoalProgressAction(
  goalId: string,
  planId?: string,
  sessionId?: string,
  progressAmount?: number
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요." };
    }

    // 목표 검증
    const goal = await getGoalById(
      goalId,
      user.userId,
      tenantContext.tenantId
    );

    if (!goal) {
      return { success: false, error: "목표를 찾을 수 없습니다." };
    }

    // progress_amount 계산
    let calculatedAmount = progressAmount || 0;

    if (planId && !progressAmount) {
      // 플랜에서 진행률 계산
      const plan = await getPlanById(
        planId,
        user.userId,
        tenantContext.tenantId
      );

      if (plan) {
        const start = plan.planned_start_page_or_time || 0;
        const end = plan.planned_end_page_or_time || 0;
        calculatedAmount = Math.max(0, end - start);
      }
    }

    if (sessionId && !progressAmount) {
      // 세션에서 학습 시간 계산 (초 단위를 분으로 변환)
      const session = await getSessionById(
        sessionId,
        user.userId,
        tenantContext.tenantId
      );

      if (session && session.duration_seconds) {
        calculatedAmount = Math.floor(session.duration_seconds / 60); // 분 단위
      }
    }

    // 진행률 기록
    const result = await recordGoalProgress({
      tenant_id: tenantContext.tenantId,
      student_id: user.userId,
      goal_id: goalId,
      plan_id: planId || null,
      session_id: sessionId || null,
      progress_amount: calculatedAmount,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 히스토리 기록
    const supabase = await createSupabaseServerClient();
    await recordHistory(
      supabase,
      user.userId,
      "goal_progress",
      {
        goal_id: goalId,
        progress_amount: calculatedAmount,
        plan_id: planId || null,
        session_id: sessionId || null,
      },
      tenantContext.tenantId
    );

    revalidatePath("/today");
    revalidatePath("/today");
    return { success: true };
  } catch (error) {
    logActionError({ domain: "goal", action: "recordGoalProgressAction" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "진행률 기록에 실패했습니다.",
    };
  }
}
