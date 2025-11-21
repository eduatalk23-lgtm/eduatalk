"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculateAllRiskIndices,
  saveRiskAnalysis,
  type SubjectRiskAnalysis,
} from "./_utils";

// Risk Index 재계산 및 저장
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

  try {
    const analyses = await calculateAllRiskIndices(supabase, user.id);
    await saveRiskAnalysis(supabase, user.id, analyses);

    revalidatePath("/analysis");
    return { success: true, analyses };
  } catch (error) {
    console.error("[analysis] Risk Index 계산 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Risk Index 계산에 실패했습니다.",
    };
  }
}

