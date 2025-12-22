"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateAllRiskIndices, saveRiskAnalysis } from "../utils";
import type { SubjectRiskAnalysis } from "../types";

/**
 * Risk Index 재계산 및 저장
 */
export async function recalculateRiskIndex(): Promise<{
  success: boolean;
  error?: string;
  analyses?: SubjectRiskAnalysis[];
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 학생 정보 조회 (tenant_id 포함)
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!student || !student.tenant_id) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  try {
    const analyses = await calculateAllRiskIndices(
      supabase,
      user.id,
      student.tenant_id
    );
    await saveRiskAnalysis(supabase, user.id, analyses);

    revalidatePath("/analysis");
    return { success: true, analyses };
  } catch (error) {
    console.error("[analysis] Risk Index 계산 실패", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Risk Index 계산에 실패했습니다.",
    };
  }
}
