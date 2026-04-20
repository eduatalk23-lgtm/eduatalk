"use server";

// ============================================
// 학생 AI 접근 권한 Server Action (M0 + M0.5, 2026-04-20)
//
// admin/consultant 만 호출 가능.
// active 승격은 유효한 ai_consent_grants 레코드가 있어야 통과 (M0.5).
// ============================================

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import {
  findActiveGrant,
  insertGrant,
  listGrantsByStudent,
  revokeGrant,
} from "../repository/ai-consent-grants-repository";
import {
  getStudentAiAccessOrDefault,
  upsertStudentAiAccess,
} from "../repository/student-ai-access-repository";
import {
  isGrantCurrentlyValid,
  type AiAccessLevel,
  type AiConsentGrant,
  type StudentAiAccess,
} from "../types/ai-access";

const LOG_CTX = { domain: "student-record", action: "student-ai-access" };

export type AiAccessActionResult =
  | { readonly success: true; readonly access: StudentAiAccess }
  | { readonly success: false; readonly error: string };

export type GrantActionResult =
  | { readonly success: true; readonly grant: AiConsentGrant }
  | { readonly success: false; readonly error: string };

export type FetchGrantsActionResult =
  | {
      readonly success: true;
      readonly active: AiConsentGrant | null;
      readonly history: readonly AiConsentGrant[];
    }
  | { readonly success: false; readonly error: string };

export interface UpdateAccessInput {
  readonly studentId: string;
  readonly nextLevel: AiAccessLevel;
  readonly revokeReason?: string | null;
  readonly notes?: string | null;
}

export interface RecordGrantInput {
  readonly studentId: string;
  readonly grantedLevel: "observer" | "active";
  readonly consentVersion: string;
  readonly studentSignedAt?: string | null;
  readonly parentSignedAt?: string | null;
  readonly consultantSignedAt?: string | null;
  readonly scope?: Record<string, unknown>;
  readonly consentNotes?: string | null;
  readonly expiresAt?: string | null;
}

// ─── 1. 현재 access 조회 ────────────────────────────────

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

// ─── 2. access 변경 (M0.5: active 승격 시 grant 검증) ─────

export async function updateStudentAiAccessAction(
  input: UpdateAccessInput,
): Promise<AiAccessActionResult> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant();
    if (!tenantId) throw new Error("tenant 없음");

    // M0.5 게이트: active 승격 시 유효한 consent grant 필수
    if (input.nextLevel === "active") {
      const grant = await findActiveGrant(input.studentId);
      if (!grant) {
        return {
          success: false,
          error:
            "active 승격 불가: 3자 동의(ai_consent_grants) 레코드가 없습니다. 먼저 동의를 기록하세요.",
        };
      }
      const valid = isGrantCurrentlyValid(grant, {
        nowIso: new Date().toISOString(),
      });
      if (!valid) {
        return {
          success: false,
          error: `active 승격 불가: consent grant 유효하지 않음 (revoked/만료/서명 누락). grantId=${grant.id}`,
        };
      }
      logActionWarn(LOG_CTX, "active 승격 — grant 검증 통과", {
        studentId: input.studentId,
        grantId: grant.id,
        grantedBy: userId,
      });
    }

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

// ─── 3. consent grants CRUD ────────────────────────────

export async function fetchStudentGrantsAction(
  studentId: string,
): Promise<FetchGrantsActionResult> {
  try {
    await requireAdminOrConsultant();
    const [active, history] = await Promise.all([
      findActiveGrant(studentId),
      listGrantsByStudent(studentId, 10),
    ]);
    return { success: true, active, history };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, err, { studentId });
    return { success: false, error: msg };
  }
}

/**
 * admin 이 기존 paper-based 3자 동의를 기록.
 * granted_level='active' 이면 3 signed_at 모두 필수 (DB CHECK + application 이중 방어).
 */
export async function recordConsentGrantAction(
  input: RecordGrantInput,
): Promise<GrantActionResult> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant();
    if (!tenantId) throw new Error("tenant 없음");

    if (input.grantedLevel === "active") {
      if (
        !input.studentSignedAt ||
        !input.parentSignedAt ||
        !input.consultantSignedAt
      ) {
        return {
          success: false,
          error:
            "active grant 기록 불가: 학생·학부모·컨설턴트 3자 서명 timestamp 모두 필요합니다.",
        };
      }
      // 이미 활성 active grant 가 있으면 거부 (partial UNIQUE index 와 정합)
      const existing = await findActiveGrant(input.studentId);
      if (existing) {
        return {
          success: false,
          error: `이미 활성 active grant 존재 (id=${existing.id}). 먼저 철회 후 재발급.`,
        };
      }
    }

    if (!input.consentVersion.trim()) {
      return { success: false, error: "consent_version 필수" };
    }

    const grant = await insertGrant({
      tenantId,
      studentId: input.studentId,
      grantedLevel: input.grantedLevel,
      studentSignedAt: input.studentSignedAt ?? null,
      parentSignedAt: input.parentSignedAt ?? null,
      consultantSignedAt: input.consultantSignedAt ?? null,
      consentVersion: input.consentVersion.trim(),
      consentNotes: input.consentNotes ?? null,
      expiresAt: input.expiresAt ?? null,
      recordedBy: userId ?? null,
      scope: input.scope ?? {},
    });

    revalidatePath(`/admin/students/${input.studentId}`);
    return { success: true, grant };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, err, { studentId: input.studentId });
    return { success: false, error: msg };
  }
}

export async function revokeConsentGrantAction(
  grantId: string,
  studentId: string,
  revokeReason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await requireAdminOrConsultant();
    if (!revokeReason.trim()) {
      return { success: false, error: "revoke 사유 필수" };
    }
    await revokeGrant(grantId, userId ?? null, revokeReason.trim());
    // 철회되면 active 상태도 자동 강등 (observer 로)
    const accessRes = await fetchStudentAiAccessAction(studentId);
    if (accessRes.success && accessRes.access.accessLevel === "active") {
      await updateStudentAiAccessAction({
        studentId,
        nextLevel: "observer",
        revokeReason: `consent grant ${grantId} 철회`,
      });
    }
    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, err, { grantId, studentId });
    return { success: false, error: msg };
  }
}
