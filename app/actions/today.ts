"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// 플랜 완료/미완료 토글
export async function togglePlanCompletion(
  planId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    // 플랜 정보 조회
    const selectPlan = () =>
      supabase
        .from("student_plan")
        .select("id,content_type,content_id,planned_start_page_or_time,planned_end_page_or_time")
        .eq("id", planId);

    let { data: plan, error: planError } = await selectPlan().eq("student_id", user.id).maybeSingle();

    if (planError && planError.code === "42703") {
      ({ data: plan, error: planError } = await selectPlan().maybeSingle());
    }

    if (planError || !plan) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    // progress 조회
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("id,progress,start_page_or_time,end_page_or_time")
        .eq("plan_id", planId);

    let { data: progressData, error: progressError } = await selectProgress().eq("student_id", user.id).maybeSingle();

    if (progressError && progressError.code === "42703") {
      ({ data: progressData, error: progressError } = await selectProgress().maybeSingle());
    }

    const progress = completed ? 100 : 0;
    const startPageOrTime = plan.planned_start_page_or_time ?? null;
    const endPageOrTime = plan.planned_end_page_or_time ?? null;

    if (progressData) {
      // 기존 progress 업데이트
      const updatePayload: {
        progress: number;
        start_page_or_time?: number | null;
        end_page_or_time?: number | null;
      } = {
        progress,
      };

      // completed일 때만 start/end 업데이트
      if (completed) {
        updatePayload.start_page_or_time = startPageOrTime;
        updatePayload.end_page_or_time = endPageOrTime;
      }

      let { error: updateError } = await supabase
        .from("student_content_progress")
        .update(updatePayload)
        .eq("id", progressData.id)
        .eq("student_id", user.id);

      if (updateError && updateError.code === "42703") {
        ({ error: updateError } = await supabase
          .from("student_content_progress")
          .update(updatePayload)
          .eq("id", progressData.id));
      }

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    } else {
      // 새 progress 생성
      const insertPayload = {
        student_id: user.id,
        plan_id: planId,
        content_type: plan.content_type,
        content_id: plan.content_id,
        progress,
        start_page_or_time: startPageOrTime,
        end_page_or_time: endPageOrTime,
      };

      let { error: insertError } = await supabase
        .from("student_content_progress")
        .insert(insertPayload)
        .eq("student_id", user.id);

      if (insertError && insertError.code === "42703") {
        const { student_id: _studentId, ...fallbackPayload } = insertPayload;
        ({ error: insertError } = await supabase
          .from("student_content_progress")
          .insert(fallbackPayload));
      }

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    revalidatePath("/today");
    revalidatePath("/plan");
    return { success: true };
  } catch (error) {
    console.error("[today] 완료 토글 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "완료 처리에 실패했습니다.",
    };
  }
}

