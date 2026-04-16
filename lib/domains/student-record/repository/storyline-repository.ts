// ============================================
// 스토리라인(storylines) + 스토리라인 링크(storyline_links) 데이터 접근
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Storyline, StorylineInsert, StorylineUpdate,
  StorylineLink, StorylineLinkInsert,
} from "../types";

// ============================================
// 8. 스토리라인 (storylines)
// ============================================

/**
 * 학생 스토리라인 조회 — **scope='final' 기본 필터** (2026-04-16 D).
 * Past Analytics의 scope='past' 스토리라인은 findStorylinesByScope로 별도 조회.
 */
export async function findStorylinesByStudent(
  studentId: string,
  tenantId: string,
): Promise<Storyline[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storylines")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", "final")
    .order("sort_order");
  if (error) throw error;
  return (data as Storyline[]) ?? [];
}

/**
 * scope 기준 스토리라인 조회 (2026-04-16 D: 4축×3층 아키텍처).
 * scope='past': Past Analytics A층 산출물
 * scope='final': Final Integration C층 산출물
 */
export async function findStorylinesByScope(
  studentId: string,
  tenantId: string,
  scope: "past" | "final",
): Promise<Storyline[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storylines")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", scope)
    .order("sort_order");
  if (error) throw error;
  return (data as Storyline[]) ?? [];
}

/**
 * scope 기준 스토리라인 일괄 삭제 (재실행 전 정리).
 * storyline_links는 ON DELETE CASCADE로 자동 삭제됨.
 */
export async function deleteStorylinesByScope(
  studentId: string,
  tenantId: string,
  scope: "past" | "final",
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storylines")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", scope)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function insertStoryline(
  input: StorylineInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storylines")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateStorylineById(
  id: string,
  updates: StorylineUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storylines")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteStorylineById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storylines")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 9. 스토리라인 링크 (storyline_links)
// ============================================

export async function findStorylineLinksByStoryline(
  storylineId: string,
): Promise<StorylineLink[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .select("*")
    .eq("storyline_id", storylineId)
    .order("grade")
    .order("sort_order");
  if (error) throw error;
  return (data as StorylineLink[]) ?? [];
}

export async function findAllStorylineLinksByStudent(
  studentId: string,
  tenantId: string,
): Promise<StorylineLink[]> {
  const supabase = await createSupabaseServerClient();
  // Join through storylines to get all links for a student
  const { data: storylines } = await supabase
    .from("student_record_storylines")
    .select("id")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);
  if (!storylines || storylines.length === 0) return [];

  const storylineIds = storylines.map(s => s.id);
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .select("*")
    .in("storyline_id", storylineIds)
    .order("grade")
    .order("sort_order");
  if (error) throw error;
  return (data as StorylineLink[]) ?? [];
}

export async function insertStorylineLink(
  input: StorylineLinkInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_storyline_links")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteStorylineLinkById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_storyline_links")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 트랜잭션 RPC (원자적 연산)
// ============================================

/**
 * AI 스토리라인 일괄 삭제 RPC (트랜잭션)
 * [AI] 접두사 스토리라인 + 연관 링크를 단일 트랜잭션으로 삭제.
 * storyline_links는 ON DELETE CASCADE로 자동 삭제.
 * Returns: 삭제된 스토리라인 수
 */
export async function deleteAiStorylinesByStudent(
  studentId: string,
  tenantId: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("delete_ai_storylines_by_student", {
    p_student_id: studentId,
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/**
 * AI 스토리라인 1건 + 링크 N건 삽입 RPC (트랜잭션)
 * 스토리라인 삽입과 링크 삽입을 단일 트랜잭션으로 보장.
 * Returns: 생성된 스토리라인 ID
 */
export async function createAiStorylineWithLinks(
  tenantId: string,
  studentId: string,
  storyline: {
    title: string;
    keywords: string[];
    narrative: string | null;
    career_field: string | null;
    grade_1_theme: string | null;
    grade_2_theme: string | null;
    grade_3_theme: string | null;
    strength: string;
    sort_order: number;
  },
  links: Array<{
    record_type: string;
    record_id: string;
    grade: number;
    connection_note: string;
    sort_order: number;
  }>,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_ai_storyline_with_links", {
    p_tenant_id: tenantId,
    p_student_id: studentId,
    // jsonb 파라미터는 객체/배열 그대로 전달 — JSON.stringify 시 jsonb scalar로 저장되어
    // RPC 내부 `p_storyline->>'field'`는 NULL, `jsonb_array_length(p_links)`는 22023 에러
    p_storyline: storyline,
    p_links: links,
  });
  if (error) throw error;
  if (!data) throw new Error("스토리라인 RPC 결과가 비어있습니다.");
  return data as string;
}
