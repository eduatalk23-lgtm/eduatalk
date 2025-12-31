"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import type { ActionResult } from "../types";

/**
 * 플랜 그룹의 메모 조회
 */
export async function getPlanMemo(
  planNumber: number | null,
  planDate: string
): Promise<{ success: boolean; memo?: string | null; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    // 같은 plan_number를 가진 플랜 중 하나를 찾아서 메모 조회
    // 메모는 같은 plan_number를 가진 플랜들 간에 공유된다고 가정
    const { data: plan } = await supabase
      .from("student_plan")
      .select("memo")
      .eq("student_id", user.userId)
      .eq("plan_date", planDate)
      .eq("plan_number", planNumber ?? null)
      .limit(1)
      .maybeSingle();

    if (!plan) {
      // plan_number가 null인 경우도 처리
      if (planNumber === null) {
        // plan_number가 null인 플랜 조회
        const { data: planNull } = await supabase
          .from("student_plan")
          .select("memo")
          .eq("student_id", user.userId)
          .eq("plan_date", planDate)
          .is("plan_number", null)
          .limit(1)
          .maybeSingle();

        return { success: true, memo: planNull?.memo ?? null };
      }
      return { success: true, memo: null };
    }

    return { success: true, memo: plan.memo ?? null };
  } catch (error) {
    logActionError({ domain: "today", action: "getPlanMemo" }, error, { planNumber, planDate });
    return {
      success: false,
      error: error instanceof Error ? error.message : "메모 조회에 실패했습니다.",
    };
  }
}

/**
 * 플랜 그룹의 메모 저장
 */
export async function savePlanMemo(
  planNumber: number | null,
  planDate: string,
  memo: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    // 같은 plan_number를 가진 모든 플랜의 메모 업데이트
    const trimmedMemo = memo.trim();
    const updateData: { memo: string | null; updated_at: string } = {
      memo: trimmedMemo.length > 0 ? trimmedMemo : null,
      updated_at: new Date().toISOString(),
    };

    let query = supabase
      .from("student_plan")
      .update(updateData)
      .eq("student_id", user.userId)
      .eq("plan_date", planDate);

    if (planNumber === null) {
      query = query.is("plan_number", null);
    } else {
      query = query.eq("plan_number", planNumber);
    }

    const { error } = await query;

    if (error) {
      // memo 컬럼이 없는 경우를 대비한 폴백
      if (ErrorCodeCheckers.isColumnNotFound(error)) {
        logActionWarn({ domain: "today", action: "savePlanMemo" }, "memo 컬럼이 없습니다. 테이블 스키마를 확인해주세요.", { planNumber, planDate });
        return {
          success: false,
          error: "메모 기능을 사용할 수 없습니다. 데이터베이스 스키마를 확인해주세요.",
        };
      }
      throw error;
    }

    revalidatePath("/today");
    revalidatePath("/camp/today");
    return { success: true };
  } catch (error) {
    logActionError({ domain: "today", action: "savePlanMemo" }, error, { planNumber, planDate });
    return {
      success: false,
      error: error instanceof Error ? error.message : "메모 저장에 실패했습니다.",
    };
  }
}
