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

/** 학생의 학년도별 역량 평가 조회 (source 필터 가능) */
export async function findCompetencyScores(
  studentId: string,
  schoolYear: number,
  tenantId: string,
  source?: "ai" | "manual",
): Promise<CompetencyScore[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_competency_scores")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId);

  if (source) query = query.eq("source", source);

  const { data, error } = await query
    .order("competency_area")
    .order("competency_item");

  if (error) throw error;
  return data ?? [];
}

/** 역량 평가 upsert (UNIQUE: tenant+student+year+scope+item+source) */
export async function upsertCompetencyScore(
  input: CompetencyScoreInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_competency_scores")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,scope,competency_item,source",
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("역량 평가 upsert 결과가 비어있습니다.");
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
  if (!data) throw new Error("활동 태그 insert 결과가 비어있습니다.");
  return data.id;
}

/** 활동 태그 배치 추가 */
export async function insertActivityTags(
  inputs: ActivityTagInsert[],
): Promise<string[]> {
  if (inputs.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_activity_tags")
    .insert(inputs)
    .select("id");

  if (error) throw error;
  return (data ?? []).map((d) => d.id);
}

/** 활동 태그 업데이트 (status 변경 등) */
export async function updateActivityTag(
  id: string,
  updates: { status?: string; evaluation?: string; evidence_summary?: string },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_activity_tags")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
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

/** 고아 태그 정리 — 삭제된 record를 참조하는 태그 제거 */
export async function cleanupOrphanedTags(
  studentId: string,
  tenantId: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  // 학생의 모든 태그 조회
  const { data: tags } = await supabase
    .from("student_record_activity_tags")
    .select("id, record_type, record_id")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);
  if (!tags || tags.length === 0) return 0;

  // 각 record_type 별 존재하는 record_id 조회
  const tableMap: Record<string, string> = {
    setek: "student_record_seteks",
    personal_setek: "student_record_seteks",
    changche: "student_record_changche",
    haengteuk: "student_record_haengteuk",
    reading: "student_record_reading",
  };

  const existingIds = new Set<string>();
  for (const table of new Set(Object.values(tableMap))) {
    const { data: records } = await supabase
      .from(table)
      .select("id")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);
    for (const r of records ?? []) existingIds.add(r.id);
  }

  // 존재하지 않는 record를 참조하는 태그 삭제
  const orphanIds = tags
    .filter((t) => !existingIds.has(t.record_id))
    .map((t) => t.id);

  if (orphanIds.length === 0) return 0;

  const { error } = await supabase
    .from("student_record_activity_tags")
    .delete()
    .in("id", orphanIds);

  if (error) throw error;
  return orphanIds.length;
}

/** 특정 레코드의 AI 생성 태그만 삭제 (재분석 전 정리용) */
export async function deleteAiActivityTagsByRecord(
  recordType: string,
  recordId: string,
  tenantId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_activity_tags")
    .delete()
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .eq("tenant_id", tenantId)
    .eq("source", "ai");

  if (error) throw error;
}

// ============================================
// 분석 결과 캐시 (하이라이트 영속화)
// ============================================

/** 분석 결과 캐시 upsert (AI 또는 컨설턴트) */
export async function upsertAnalysisCache(input: {
  tenant_id: string;
  student_id: string;
  record_type: string;
  record_id: string;
  source: "ai" | "consultant";
  analysis_result: unknown;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_analysis_cache")
    .upsert(input, {
      onConflict: "tenant_id,record_type,record_id,source",
    });

  if (error) throw error;
}

/** 학생의 전체 AI 분석 캐시 조회 (하이라이트 복원용) */
export async function findAnalysisCacheByStudent(
  studentId: string,
  tenantId: string,
  source?: "ai" | "consultant",
): Promise<Array<{ record_type: string; record_id: string; source: string; analysis_result: unknown }>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_analysis_cache")
    .select("record_type, record_id, source, analysis_result")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
