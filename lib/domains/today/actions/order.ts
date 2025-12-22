"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanOrderUpdate, ActionResult } from "../types";

export async function updatePlanOrder(
  planDate: string,
  updates: PlanOrderUpdate[]
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 트랜잭션처럼 모든 업데이트를 한 번에 처리
    const updatePromises = updates.map((update) =>
      supabase
        .from("student_plan")
        .update({ block_index: update.newBlockIndex })
        .eq("id", update.planId)
        .eq("student_id", user.id)
        .eq("plan_date", planDate)
    );

    const results = await Promise.all(updatePromises);

    // 에러 확인
    for (const result of results) {
      if (result.error) {
        console.error("[planOrder] 업데이트 실패:", result.error);
        return {
          success: false,
          error: "플랜 순서 업데이트에 실패했습니다.",
        };
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("[planOrder] 오류:", error);
    return {
      success: false,
      error: error.message || "플랜 순서 업데이트 중 오류가 발생했습니다.",
    };
  }
}
