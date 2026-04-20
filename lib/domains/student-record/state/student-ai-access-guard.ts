// ============================================
// 학생 AI 접근 권한 Guard (M0, 2026-04-20)
//
// "학생 대면 자율 에이전트" 경로의 최상위 권한 체크.
// feedback_student-agent-opt-in-gate.md — Chat Shell 진입 시 이 가드 필수.
//
// 사용:
//   const access = await assertStudentAiAccess(studentId, "observer");
//   if (!access.ok) redirect("/chat/unavailable");
//   // else access.level === 'observer' | 'active'
//
// 이 모듈은 server-only (createSupabaseServerClient 호출). client 분기 주입 가능.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  getStudentAiAccessOrDefault,
} from "../repository/student-ai-access-repository";
import type {
  AiAccessLevel,
  StudentAiAccess,
} from "../types/ai-access";
import { isAtLeast } from "../types/ai-access";

type Client = SupabaseClient<Database>;

export type AssertAiAccessResult =
  | {
      readonly ok: true;
      readonly access: StudentAiAccess;
      readonly level: AiAccessLevel;
    }
  | {
      readonly ok: false;
      readonly access: StudentAiAccess;
      readonly reason: string;
    };

/**
 * 학생의 AI 접근 권한이 `required` 이상인지 확인.
 *
 * @param studentId — 대상 학생
 * @param tenantId  — RLS 안전을 위해 필수
 * @param required  — 요구 최소 레벨 ('observer' 또는 'active')
 * @param client    — 선택. admin client 주입 시 RLS 우회 (cron 등)
 */
export async function assertStudentAiAccess(
  studentId: string,
  tenantId: string,
  required: Exclude<AiAccessLevel, "disabled">,
  client?: Client,
): Promise<AssertAiAccessResult> {
  const access = await getStudentAiAccessOrDefault(studentId, tenantId, client);
  if (!isAtLeast(access.accessLevel, required)) {
    return {
      ok: false,
      access,
      reason: `요구 레벨=${required}, 현재=${access.accessLevel}`,
    };
  }
  return { ok: true, access, level: access.accessLevel };
}

/** boolean 만 필요한 경로용 shortcut. */
export async function hasStudentAiAccess(
  studentId: string,
  tenantId: string,
  required: Exclude<AiAccessLevel, "disabled">,
  client?: Client,
): Promise<boolean> {
  const r = await assertStudentAiAccess(studentId, tenantId, required, client);
  return r.ok;
}
