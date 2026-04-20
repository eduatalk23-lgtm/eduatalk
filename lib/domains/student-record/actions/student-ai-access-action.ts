"use server";

// ============================================
// 학생 AI 접근 권한 Server Action (M0, 2026-04-20)
//
// admin/consultant 만 호출 가능. active 승격 시 경고 로그 (M0.5 consent 미배포).
// ============================================

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import {
  getStudentAiAccessOrDefault,
  upsertStudentAiAccess,
} from "../repository/student-ai-access-repository";
import type { AiAccessLevel, StudentAiAccess } from "../types/ai-access";

const LOG_CTX = { domain: "student-record", action: "student-ai-access" };

export type AiAccessActionResult =
  | { readonly success: true; readonly access: StudentAiAccess }
  | { readonly success: false; readonly error: string };

export interface UpdateAccessInput {
  readonly studentId: string;
  readonly nextLevel: AiAccessLevel;
  readonly revokeReason?: string | null;
  readonly notes?: string | null;
}

export async function fetchStudentAiAccessAction(
  studentId: string,
): Promise<AiAccessActionResult> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) throw new Error("tenant 없음");
    const access = await getStudentAiAccessOrDefault(studentId, tenantId);
    return { success: true, access };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, err, { studentId });
    return { success: false, error: msg };
  }
}

export async function updateStudentAiAccessAction(
  input: UpdateAccessInput,
): Promise<AiAccessActionResult> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant();
    if (!tenantId) throw new Error("tenant 없음");

    // M0.5 ai_consent_grants 미배포 상태에서 active 승격은 명시적 경고 로그.
    if (input.nextLevel === "active") {
      logActionWarn(
        LOG_CTX,
        "active 승격 — M0.5 3자 동의 스키마 미배포 상태",
        {
          studentId: input.studentId,
          grantedBy: userId,
        },
      );
    }

    // disabled 강등 시 revokeReason 권장 (강제는 아님 — 빠른 긴급 차단 허용)
    const access = await upsertStudentAiAccess({
      studentId: input.studentId,
      tenantId,
      accessLevel: input.nextLevel,
      grantedBy: userId ?? null,
      revokeReason: input.revokeReason ?? null,
      notes: input.notes ?? null,
    });

    revalidatePath(`/admin/students/${input.studentId}`);
    return { success: true, access };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, err, { studentId: input.studentId });
    return { success: false, error: msg };
  }
}
