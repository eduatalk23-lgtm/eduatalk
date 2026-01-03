"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { calculateAllRiskIndices, saveRiskAnalysis } from "../utils";
import type { SubjectRiskAnalysis } from "../types";

/**
 * Risk Index 재계산 및 저장
 */
export async function recalculateRiskIndex(options?: {
  studentId?: string;
  tenantId?: string;
}): Promise<{
  success: boolean;
  error?: string;
  analyses?: SubjectRiskAnalysis[];
}> {
  const supabase = await createSupabaseServerClient();
  
  let targetStudentId = options?.studentId;
  let targetTenantId = options?.tenantId;

  // studentId가 없으면 현재 로그인 사용자 기준
  if (!targetStudentId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }
    targetStudentId = user.id;
  }

  // tenantId가 없으면 학생 정보에서 조회
  if (!targetTenantId) {
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", targetStudentId)
      .maybeSingle();

    if (!student || !student.tenant_id) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }
    targetTenantId = student.tenant_id;
  }

  try {
    // TypeScript에게 targetTenantId가 이 시점에서 반드시 정의되어 있음을 알림
    // (위에서 undefined인 경우 early return 함)
    const analyses = await calculateAllRiskIndices(
      supabase,
      targetStudentId,
      targetTenantId!
    );
    await saveRiskAnalysis(supabase, targetStudentId, analyses);

    revalidatePath("/analysis");
    return { success: true, analyses };
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "recalculateRiskIndex", userId: targetStudentId, tenantId: targetTenantId },
      error,
      { message: "Risk Index 계산 실패" }
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Risk Index 계산에 실패했습니다.",
    };
  }
}
