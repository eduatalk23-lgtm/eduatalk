"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { endStudySession } from "@/app/(student)/actions/studySessionActions";
import { revalidatePath } from "next/cache";

/**
 * 플랜 그룹의 타이머 기록 초기화
 * plan_number를 기준으로 같은 그룹의 모든 플랜의 타이머 기록을 초기화합니다.
 */
export async function resetPlanTimer(
  planNumber: number | null,
  planDate: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
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
      console.error("[timerResetActions] 플랜 조회 실패:", plansError);
      return { success: false, error: "플랜 조회에 실패했습니다." };
    }

    if (!plans || plans.length === 0) {
      return { success: false, error: "초기화할 플랜을 찾을 수 없습니다." };
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
      console.error("[timerResetActions] 세션 삭제 실패:", deleteSessionsError);
      // 세션 삭제 실패는 치명적이지 않으므로 계속 진행
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
      console.error("[timerResetActions] 플랜 업데이트 실패:", updateError);
      return { success: false, error: "타이머 기록 초기화에 실패했습니다." };
    }

    // 4. student_content_progress에서 plan_id로 연결된 진행률 삭제
    const { error: deleteProgressError } = await supabase
      .from("student_content_progress")
      .delete()
      .in("plan_id", planIds)
      .eq("student_id", user.userId);

    if (deleteProgressError) {
      console.error("[timerResetActions] 진행률 삭제 실패:", deleteProgressError);
      // 진행률 삭제 실패는 치명적이지 않으므로 계속 진행
    }

    revalidatePath("/today");
    revalidatePath("/camp/today");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[timerResetActions] 타이머 초기화 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "타이머 초기화에 실패했습니다.",
    };
  }
}

