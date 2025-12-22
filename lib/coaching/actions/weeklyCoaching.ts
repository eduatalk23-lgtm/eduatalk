"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeeklyMetrics } from "../getWeeklyMetrics";
import { coachingEngine, type WeeklyCoaching } from "../engine";

/**
 * 주간 코칭 데이터 조회
 */
export async function getWeeklyCoaching(
  studentId?: string
): Promise<{ success: boolean; data?: WeeklyCoaching; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // studentId가 제공되지 않으면 현재 사용자 ID 사용
    const targetStudentId = studentId || user.id;

    // 주간 메트릭 수집
    const metrics = await getWeeklyMetrics(supabase, targetStudentId);

    // 코칭 엔진 실행
    const coaching = coachingEngine(metrics);

    return {
      success: true,
      data: coaching,
    };
  } catch (error) {
    console.error("[coachingAction] 주간 코칭 조회 실패", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "주간 코칭 조회에 실패했습니다.",
    };
  }
}
