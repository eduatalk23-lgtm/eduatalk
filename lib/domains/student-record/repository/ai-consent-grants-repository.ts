// ============================================
// ai_consent_grants Repository (M0.5, 2026-04-20)
//
// 3-party signature 레코드 CRUD. RLS 준수.
// active 승격 게이트는 isGrantCurrentlyValid + 이 repository 조회 결과로 판정.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import type {
  AiConsentGrant,
  ConsentGrantLevel,
} from "../types/ai-access";

type Client = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["ai_consent_grants"]["Row"];
type Insert = Database["public"]["Tables"]["ai_consent_grants"]["Insert"];

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

function rowToGrant(row: Row): AiConsentGrant {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    grantedLevel: row.granted_level as ConsentGrantLevel,
    studentSignedAt: row.student_signed_at,
    studentUserId: row.student_user_id,
    parentSignedAt: row.parent_signed_at,
    parentUserId: row.parent_user_id,
    consultantSignedAt: row.consultant_signed_at,
    consultantUserId: row.consultant_user_id,
    scope: (row.scope as unknown as Record<string, unknown>) ?? {},
    consentVersion: row.consent_version,
    consentNotes: row.consent_notes,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    revokeReason: row.revoke_reason,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
  };
}

/** 학생의 활성(revoked_at IS NULL) active grant 1건 조회. 없으면 null. */
export async function findActiveGrant(
  studentId: string,
  client?: Client,
): Promise<AiConsentGrant | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("ai_consent_grants")
    .select("*")
    .eq("student_id", studentId)
    .eq("granted_level", "active")
    .is("revoked_at", null)
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToGrant(data) : null;
}

/** 학생의 최근 grant 목록 (모든 level, revoked 포함). */
export async function listGrantsByStudent(
  studentId: string,
  limit = 10,
  client?: Client,
): Promise<AiConsentGrant[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("ai_consent_grants")
    .select("*")
    .eq("student_id", studentId)
    .order("effective_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToGrant);
}

export interface InsertGrantInput {
  readonly tenantId: string;
  readonly studentId: string;
  readonly grantedLevel: ConsentGrantLevel;
  readonly studentSignedAt?: string | null;
  readonly studentUserId?: string | null;
  readonly parentSignedAt?: string | null;
  readonly parentUserId?: string | null;
  readonly consultantSignedAt?: string | null;
  readonly consultantUserId?: string | null;
  readonly scope?: Record<string, unknown>;
  readonly consentVersion: string;
  readonly consentNotes?: string | null;
  readonly effectiveAt?: string;
  readonly expiresAt?: string | null;
  readonly recordedBy?: string | null;
}

export async function insertGrant(
  input: InsertGrantInput,
  client?: Client,
): Promise<AiConsentGrant> {
  const supabase = await resolveClient(client);
  const row: Insert = {
    tenant_id: input.tenantId,
    student_id: input.studentId,
    granted_level: input.grantedLevel,
    student_signed_at: input.studentSignedAt ?? null,
    student_user_id: input.studentUserId ?? null,
    parent_signed_at: input.parentSignedAt ?? null,
    parent_user_id: input.parentUserId ?? null,
    consultant_signed_at: input.consultantSignedAt ?? null,
    consultant_user_id: input.consultantUserId ?? null,
    scope: (input.scope ?? {}) as unknown as Json,
    consent_version: input.consentVersion,
    consent_notes: input.consentNotes ?? null,
    effective_at: input.effectiveAt ?? new Date().toISOString(),
    expires_at: input.expiresAt ?? null,
    recorded_by: input.recordedBy ?? null,
  };
  const { data, error } = await supabase
    .from("ai_consent_grants")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToGrant(data);
}

export async function revokeGrant(
  id: string,
  revokedBy: string | null,
  revokeReason: string | null,
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("ai_consent_grants")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
      revoke_reason: revokeReason,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
