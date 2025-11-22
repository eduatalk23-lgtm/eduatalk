"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pausePlan } from "./todayActions";

type PlanRange = {
  planId: string;
  startPageOrTime: number;
  endPageOrTime: number;
};

/**
 * 플랜 그룹의 범위 일괄 조정
 */
export async function adjustPlanRanges(
  planIds: string[],
  ranges: PlanRange[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 1. 진행 중인 플랜 일시정지
    for (const planId of planIds) {
      // 활성 세션 확인
      const { data: activeSession } = await supabase
        .from("student_study_sessions")
        .select("id, paused_at")
        .eq("plan_id", planId)
        .eq("student_id", user.userId)
        .is("ended_at", null)
        .maybeSingle();

      // 진행 중이고 일시정지되지 않은 경우 일시정지
      if (activeSession && !activeSession.paused_at) {
        await pausePlan(planId);
      }
    }

    // 2. 범위 업데이트
    const updates = ranges.map((range) => ({
      id: range.planId,
      planned_start_page_or_time: range.startPageOrTime,
      planned_end_page_or_time: range.endPageOrTime,
      updated_at: new Date().toISOString(),
    }));

    // 배치 업데이트 (Supabase는 한 번에 최대 100개까지)
    const batchSize = 100;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      // 각 플랜을 개별적으로 업데이트
      await Promise.all(
        batch.map(async (update) => {
          const { error } = await supabase
            .from("student_plan")
            .update({
              planned_start_page_or_time: update.planned_start_page_or_time,
              planned_end_page_or_time: update.planned_end_page_or_time,
              updated_at: update.updated_at,
            })
            .eq("id", update.id)
            .eq("student_id", user.userId);

          if (error) throw error;
        })
      );
    }

    revalidatePath("/today");
    return { success: true };
  } catch (error) {
    console.error("[planRangeActions] 범위 조정 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "범위 조정에 실패했습니다.",
    };
  }
}

