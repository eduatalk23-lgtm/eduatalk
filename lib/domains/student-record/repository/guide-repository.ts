// ============================================
// 가이드(Guide) Repository
// setek_guides / changche_guides / haengteuk_guides CRUD
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================
// 내부 헬퍼
// ============================================

async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient> {
  if (client) return client;
  return createSupabaseServerClient();
}

// ============================================
// 1. 세특 가이드 (setek_guides)
// ============================================

/** 세특 가이드 다건 삽입 → 삽입된 id 배열 반환 */
export async function insertSetekGuides(
  rows: Record<string, unknown>[],
  client?: SupabaseClient,
): Promise<{ id: string }[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_setek_guides")
    .insert(rows)
    .select("id");
  if (error) throw error;
  return (data ?? []) as { id: string }[];
}

/** 세특 가이드 요약 조회 (direction + keywords) — 컨텍스트 주입용 */
export async function findSetekGuideSummary(
  params: { studentId: string; tenantId: string; schoolYear: number; source?: string; limit?: number },
  client?: SupabaseClient,
): Promise<Array<{ direction: string | null; keywords: string[] | null }>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_setek_guides")
    .select("direction, keywords")
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("school_year", params.schoolYear)
    .eq("source", params.source ?? "ai")
    .limit(params.limit ?? 4);
  if (error) throw error;
  return (data ?? []) as Array<{ direction: string | null; keywords: string[] | null }>;
}

/** 세특 가이드 상세 조회 (과목명 조인 포함) — 세특→창체 연계용 */
export async function findSetekGuideWithSubject(
  params: { studentId: string; tenantId: string; schoolYear: number; source?: string; limit?: number },
  client?: SupabaseClient,
): Promise<Array<{ subject: { id: string; name: string } | null; direction: string | null; keywords: string[] | null; competency_focus: string[] | null }>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_setek_guides")
    .select("subject:subject_id(id, name), direction, keywords, competency_focus")
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("school_year", params.schoolYear)
    .eq("source", params.source ?? "ai")
    .limit(params.limit ?? 6);
  if (error) throw error;
  return (data ?? []) as Array<{ subject: { id: string; name: string } | null; direction: string | null; keywords: string[] | null; competency_focus: string[] | null }>;
}

/** 세특 가이드 방향 조회 (P7 가안 생성용) — guide_mode 필터 */
export async function findSetekGuideDirectionsForDraft(
  params: { studentId: string; schoolYear: number; guideMode: string },
  client?: SupabaseClient,
): Promise<Array<{ subject_id: string; direction: string; keywords: string[] | null }>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_setek_guides")
    .select("subject_id, direction, keywords")
    .eq("student_id", params.studentId)
    .eq("school_year", params.schoolYear)
    .eq("guide_mode", params.guideMode);
  if (error) throw error;
  return (data ?? []) as Array<{ subject_id: string; direction: string; keywords: string[] | null }>;
}

/** 세특 가이드 건수 조회 (캐시 체크용) */
export async function countSetekGuides(
  params: { studentId: string; tenantId: string; schoolYear: number; source: string },
  client?: SupabaseClient,
): Promise<number> {
  const supabase = await resolveClient(client);
  const { count, error } = await supabase
    .from("student_record_setek_guides")
    .select("id", { count: "exact", head: true })
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("school_year", params.schoolYear)
    .eq("source", params.source);
  if (error) throw error;
  return count ?? 0;
}

/** 세특 가이드 전체 조회 (Unified Input 빌더용) */
export async function findAllSetekGuides(
  params: { studentId: string; tenantId: string; source?: string },
  client?: SupabaseClient,
): Promise<Array<{ id: string; school_year: number; direction: string | null; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null; subject: { name: string } | null }>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_setek_guides")
    .select("id, school_year, direction, keywords, competency_focus, teacher_points, subject:subject_id(name)")
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("source", params.source ?? "ai");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; school_year: number; direction: string | null; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null; subject: { name: string } | null }>;
}

// ============================================
// 2. 창체 가이드 (changche_guides)
// ============================================

/** 창체 가이드 다건 삽입 → 삽입된 id 배열 반환 */
export async function insertChangcheGuides(
  rows: Record<string, unknown>[],
  client?: SupabaseClient,
): Promise<{ id: string }[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_changche_guides")
    .insert(rows)
    .select("id");
  if (error) throw error;
  return (data ?? []) as { id: string }[];
}

/** 창체 가이드 요약 조회 (activity_type + direction + keywords) — 컨텍스트 주입용 */
export async function findChangcheGuideSummary(
  params: { studentId: string; tenantId: string; schoolYear: number; source?: string; limit?: number },
  client?: SupabaseClient,
): Promise<Array<{ activity_type: string; direction: string | null; keywords: string[] | null }>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_changche_guides")
    .select("activity_type, direction, keywords")
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("school_year", params.schoolYear)
    .eq("source", params.source ?? "ai")
    .limit(params.limit ?? 3);
  if (error) throw error;
  return (data ?? []) as Array<{ activity_type: string; direction: string | null; keywords: string[] | null }>;
}

/** 창체 가이드 방향 조회 (P7 가안 생성용) — guide_mode 필터 */
export async function findChangcheGuideDirectionsForDraft(
  params: { studentId: string; schoolYear: number; guideMode: string },
  client?: SupabaseClient,
): Promise<Array<{ activity_type: string; direction: string; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null }>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_changche_guides")
    .select("activity_type, direction, keywords, competency_focus, teacher_points")
    .eq("student_id", params.studentId)
    .eq("school_year", params.schoolYear)
    .eq("guide_mode", params.guideMode);
  if (error) throw error;
  return (data ?? []) as Array<{ activity_type: string; direction: string; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null }>;
}

/** 창체 가이드 건수 조회 (캐시 체크용) */
export async function countChangcheGuides(
  params: { studentId: string; tenantId: string; schoolYear: number; source: string },
  client?: SupabaseClient,
): Promise<number> {
  const supabase = await resolveClient(client);
  const { count, error } = await supabase
    .from("student_record_changche_guides")
    .select("id", { count: "exact", head: true })
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("school_year", params.schoolYear)
    .eq("source", params.source);
  if (error) throw error;
  return count ?? 0;
}

/** 창체 가이드 전체 조회 (Unified Input 빌더용) */
export async function findAllChangcheGuides(
  params: { studentId: string; tenantId: string; source?: string },
  client?: SupabaseClient,
): Promise<Array<{ id: string; school_year: number; activity_type: string | null; direction: string | null; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null }>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_changche_guides")
    .select("id, school_year, activity_type, direction, keywords, competency_focus, teacher_points")
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("source", params.source ?? "ai");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; school_year: number; activity_type: string | null; direction: string | null; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null }>;
}

// ============================================
// 3. 행특 가이드 (haengteuk_guides)
// ============================================

/** 행특 가이드 1건 삽입 → 삽입된 id 반환 */
export async function insertHaengteukGuide(
  row: Record<string, unknown>,
  client?: SupabaseClient,
): Promise<{ id: string }> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_haengteuk_guides")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

/** 행특 가이드 방향 조회 (P7 가안 생성용) — guide_mode 필터, 1건 */
export async function findHaengteukGuideDirectionForDraft(
  params: { studentId: string; schoolYear: number; guideMode: string },
  client?: SupabaseClient,
): Promise<{ direction: string; keywords: string[] | null; competency_focus: string[] | null; evaluation_items: unknown; teacher_points: string[] | null } | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_haengteuk_guides")
    .select("direction, keywords, competency_focus, evaluation_items, teacher_points")
    .eq("student_id", params.studentId)
    .eq("school_year", params.schoolYear)
    .eq("guide_mode", params.guideMode)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { direction: string; keywords: string[] | null; competency_focus: string[] | null; evaluation_items: unknown; teacher_points: string[] | null } | null;
}

/** 행특 가이드 건수 조회 (캐시 체크용) */
export async function countHaengteukGuides(
  params: { studentId: string; tenantId: string; schoolYear: number; source: string },
  client?: SupabaseClient,
): Promise<number> {
  const supabase = await resolveClient(client);
  const { count, error } = await supabase
    .from("student_record_haengteuk_guides")
    .select("id", { count: "exact", head: true })
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("school_year", params.schoolYear)
    .eq("source", params.source);
  if (error) throw error;
  return count ?? 0;
}

/** 행특 가이드 전체 조회 (Unified Input 빌더용) */
export async function findAllHaengteukGuides(
  params: { studentId: string; tenantId: string; source?: string },
  client?: SupabaseClient,
): Promise<Array<{ id: string; school_year: number; direction: string | null; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null }>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_record_haengteuk_guides")
    .select("id, school_year, direction, keywords, competency_focus, teacher_points")
    .eq("student_id", params.studentId)
    .eq("tenant_id", params.tenantId)
    .eq("source", params.source ?? "ai");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; school_year: number; direction: string | null; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null }>;
}
