"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { checkPipelineStaleness } from "../stale-detection";

/** 파이프라인 stale 여부 조회 (서버 액션) */
export async function checkPipelineStalenessAction(
  studentId: string,
): Promise<{ isStale: boolean }> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return { isStale: false };

    const result = await checkPipelineStaleness(studentId, tenantId);
    return { isStale: result.isStale };
  } catch {
    return { isStale: false };
  }
}
