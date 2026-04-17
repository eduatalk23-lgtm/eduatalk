/**
 * Phase T-4 handoff 입력 검증 + 리졸버 실행
 *
 * 검증 순서:
 * 1. from 화이트리스트 존재
 * 2. role allowedRoles 포함
 * 3. requiresStudentId 인 경우 studentId 제공
 * 4. studentId 테넌트가 user.tenantId 와 일치 (크로스-테넌트 방지)
 * 5. 리졸버 실행
 *
 * 실패는 {ok:false, reason} 반환. 호출자는 일반 진입으로 폴백.
 */

import type { CurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHandoffSource, type HandoffSource } from "./sources";
import { resolveScoresContext } from "./resolvers/scores";

export type HandoffInput = {
  from?: string;
  studentId?: string;
  grade?: number;
  semester?: number;
  subject?: string;
  seed?: string;
};

export type HandoffResolved = {
  /** 프롬프트용 1-3줄 한국어 요약 */
  snippet: string;
  /** 선공 템플릿 slot 값 */
  openerSlots: {
    name: string;
    grade: string;
    semester: string;
    count: string;
  };
  /** 기록용 studentId (테넌트 검증 통과한 값) */
  resolvedStudentId: string | null;
};

export type HandoffValidationResult =
  | { ok: true; source: HandoffSource; resolved: HandoffResolved }
  | {
      ok: false;
      reason:
        | "no-input"
        | "unknown-source"
        | "forbidden-role"
        | "missing-studentId"
        | "cross-tenant"
        | "resolver-failed";
    };

async function verifyStudentTenant(
  studentId: string,
  tenantId: string | null,
): Promise<boolean> {
  if (!tenantId) return false;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .maybeSingle();
  if (error || !data) return false;
  const rowTenant = (data as unknown as { tenant_id: string | null }).tenant_id;
  return rowTenant === tenantId;
}

export async function validateAndResolveHandoff(
  input: HandoffInput,
  user: CurrentUser,
): Promise<HandoffValidationResult> {
  if (!input.from) return { ok: false, reason: "no-input" };

  const source = getHandoffSource(input.from);
  if (!source) return { ok: false, reason: "unknown-source" };

  if (!source.allowedRoles.includes(user.role)) {
    return { ok: false, reason: "forbidden-role" };
  }

  if (source.requiresStudentId && !input.studentId) {
    return { ok: false, reason: "missing-studentId" };
  }

  // 학생 본인이 admin 경로 접근 시도 차단 (allowedRoles 로 이미 막히지만 방어 심화)
  if (input.studentId && user.role !== "student") {
    const ok = await verifyStudentTenant(input.studentId, user.tenantId);
    if (!ok) return { ok: false, reason: "cross-tenant" };
  }

  try {
    if (source.contextResolver === "scores") {
      const resolved = await resolveScoresContext(input, user);
      return { ok: true, source, resolved };
    }
    return { ok: false, reason: "resolver-failed" };
  } catch {
    return { ok: false, reason: "resolver-failed" };
  }
}
