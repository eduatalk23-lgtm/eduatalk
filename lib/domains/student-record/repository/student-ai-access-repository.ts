// ============================================
// 학생 AI 에이전트 접근 권한 Repository (M0, 2026-04-20)
//
// student_ai_access 테이블 CRUD. RLS 준수.
// admin/consultant 가 학생별 access_level 을 수동 부여.
// row 가 없으면 기본값 'disabled' 로 간주 (getOrDefault).
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type {
  AiAccessLevel,
  StudentAiAccess,
} from "../types/ai-access";

type Client = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["student_ai_access"]["Row"];

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

function rowToAccess(row: Row): StudentAiAccess {
  return {
    studentId: row.student_id,
    tenantId: row.tenant_id,
    accessLevel: row.access_level as AiAccessLevel,
    grantedAt: row.granted_at,
    grantedBy: row.granted_by,
    lastRevokedAt: row.last_revoked_at,
    revokeReason: row.revoke_reason,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findStudentAiAccess(
  studentId: string,
  client?: Client,
): Promise<StudentAiAccess | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_ai_access")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToAccess(data) : null;
}

/**
 * row 가 없으면 `disabled` 기본값으로 가상 반환 (영속화 X).
 * 학생 가입 직후 row 미존재 상태에서 guard 가 동작하도록.
 */
export async function getStudentAiAccessOrDefault(
  studentId: string,
  tenantId: string,
  client?: Client,
): Promise<StudentAiAccess> {
  const found = await findStudentAiAccess(studentId, client);
  if (found) return found;
  const nowIso = new Date().toISOString();
  return {
    studentId,
    tenantId,
    accessLevel: "disabled",
    grantedAt: null,
    grantedBy: null,
    lastRevokedAt: null,
    revokeReason: null,
    notes: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export interface UpsertAccessInput {
  readonly studentId: string;
  readonly tenantId: string;
  readonly accessLevel: AiAccessLevel;
  readonly grantedBy: string | null;
  readonly revokeReason?: string | null;
  readonly notes?: string | null;
}

/**
 * access_level 변경. 레벨 내려갈 때 revoke_reason 권장.
 * `active` 승격 시 M0.5 gate 검증은 호출자(action) 책임.
 */
export async function upsertStudentAiAccess(
  input: UpsertAccessInput,
  client?: Client,
): Promise<StudentAiAccess> {
  const supabase = await resolveClient(client);

  const existing = await findStudentAiAccess(input.studentId, client);

  const now = new Date().toISOString();
  const patch = {
    tenant_id: input.tenantId,
    access_level: input.accessLevel,
    granted_at:
      input.accessLevel !== "disabled" ? now : existing?.grantedAt ?? null,
    granted_by:
      input.accessLevel !== "disabled"
        ? input.grantedBy
        : existing?.grantedBy ?? null,
    last_revoked_at:
      existing &&
      existing.accessLevel !== "disabled" &&
      input.accessLevel === "disabled"
        ? now
        : existing?.lastRevokedAt ?? null,
    revoke_reason:
      input.revokeReason ?? existing?.revokeReason ?? null,
    notes: input.notes ?? existing?.notes ?? null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("student_ai_access")
      .update(patch)
      .eq("student_id", input.studentId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToAccess(data);
  }

  const { data, error } = await supabase
    .from("student_ai_access")
    .insert({
      student_id: input.studentId,
      ...patch,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToAccess(data);
}
