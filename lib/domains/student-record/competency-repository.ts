// ============================================
// 역량 평가 + 활동 태그 Repository
// Phase 5 — competency_scores + activity_tags CRUD
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CompetencyScore,
  CompetencyScoreInsert,
  CompetencyScoreUpdate,
  ActivityTag,
  ActivityTagInsert,
} from "./types";

// ============================================
// competency_scores
// ============================================

/** 학생의 학년도별 역량 평가 조회 */
export async function findCompetencyScores(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<CompetencyScore[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_competency_scores")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("competency_area")
    .order("competency_item");

  if (error) throw error;
  return data ?? [];
}

/** 역량 평가 upsert (UNIQUE: tenant+student+year+scope+item) */
export async function upsertCompetencyScore(
  input: CompetencyScoreInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_competency_scores")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,scope,competency_item",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/** 역량 평가 개별 수정 */
export async function updateCompetencyScore(
  id: string,
  updates: CompetencyScoreUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_competency_scores")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

/** 역량 평가 삭제 */
export async function deleteCompetencyScore(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_competency_scores")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// activity_tags
// ============================================

/** 학생의 활동 태그 조회 (특정 레코드 또는 전체) */
export async function findActivityTags(
  studentId: string,
  tenantId: string,
  options?: { recordType?: string; recordId?: string },
): Promise<ActivityTag[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_activity_tags")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (options?.recordType) {
    query = query.eq("record_type", options.recordType);
  }
  if (options?.recordId) {
    query = query.eq("record_id", options.recordId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** 활동 태그 추가 */
export async function insertActivityTag(
  input: ActivityTagInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_activity_tags")
    .insert(input)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/** 활동 태그 삭제 */
export async function deleteActivityTag(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_activity_tags")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/** 특정 레코드의 모든 태그 삭제 */
export async function deleteActivityTagsByRecord(
  recordType: string,
  recordId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_activity_tags")
    .delete()
    .eq("record_type", recordType)
    .eq("record_id", recordId);

  if (error) throw error;
}
