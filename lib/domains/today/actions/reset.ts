"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { endStudySession } from "@/lib/domains/student";
import { revalidateTimerPaths } from "@/lib/utils/revalidatePathOptimized";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type { ActionResult } from "../types";

/**
 * 플랜 그룹의 타이머 기록 초기화
 * plan_number를 기준으로 같은 그룹의 모든 플랜의 타이머 기록을 초기화합니다.
 */
export async function resetPlanTimer(
  planNumber: number | null,
  planDate: string
): Promise<ActionResult> {
  try {
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
    const tenantContext = await getTenantContext();

    // 같은 plan_number를 가진 모든 플랜 조회
    let query = supabase
      .from("student_plan")
      .select("id")
      .eq("student_id", user.userId)
      .eq("plan_date", planDate);

    if (planNumber === null) {
      query = query.is("plan_number", null);
    } else {
      query = query.eq("plan_number", planNumber);
    }

    const { data: plans, error: plansError } = await query;

    if (plansError) {
      throw new AppError(
        "플랜 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    if (!plans || plans.length === 0) {
      throw new AppError(
        "초기화할 플랜을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const planIds = plans.map((p) => p.id);

    // 1. 활성 세션 종료
    const { data: activeSessions } = await supabase
      .from("student_study_sessions")
      .select("id")
      .in("plan_id", planIds)
      .eq("student_id", user.userId)
      .is("ended_at", null);

    if (activeSessions && activeSessions.length > 0) {
      for (const session of activeSessions) {
        await endStudySession(session.id);
      }
    }

    // 2. 해당 플랜의 모든 세션 삭제 (전체 진행률 반영을 위해)
    const { error: deleteSessionsError } = await supabase
      .from("student_study_sessions")
      .delete()
      .in("plan_id", planIds)
      .eq("student_id", user.userId);

    if (deleteSessionsError) {
      // 세션 삭제 실패는 치명적이지 않으므로 경고만 로그하고 계속 진행
      console.warn(
        "[today/reset] 세션 삭제 실패:",
        deleteSessionsError.message
      );
    }

    // 3. 플랜의 타이머 기록 및 진행률 초기화
    const updateData = {
      actual_start_time: null,
      actual_end_time: null,
      total_duration_seconds: null,
      paused_duration_seconds: 0,
      pause_count: 0,
      progress: 0,
      completed_amount: 0,
    };

    const { error: updateError } = await supabase
      .from("student_plan")
      .update(updateData)
      .in("id", planIds)
      .eq("student_id", user.userId);

    if (updateError) {
      throw new AppError(
        "타이머 기록 초기화에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 4. student_content_progress에서 plan_id로 연결된 진행률 삭제
    const { error: deleteProgressError } = await supabase
      .from("student_content_progress")
      .delete()
      .in("plan_id", planIds)
      .eq("student_id", user.userId);

    if (deleteProgressError) {
      // 진행률 삭제 실패는 치명적이지 않으므로 경고만 로그하고 계속 진행
      console.warn(
        "[today/reset] 진행률 삭제 실패:",
        deleteProgressError.message
      );
    }

    await revalidateTimerPaths(false, true);
    return { success: true };
  } catch (error) {
    // AppError는 사용자 친화적 메시지를 포함
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    // 예상치 못한 에러는 일반 메시지 반환
    return {
      success: false,
      error: "타이머 초기화 중 오류가 발생했습니다.",
    };
  }
}
