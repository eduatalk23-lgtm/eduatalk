// ============================================
// 역량 평가 + 활동 태그 Repository
// Phase 5 — competency_scores + activity_tags CRUD
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionWarn } from "@/lib/logging/actionLogger";
import type {
  CompetencyScore,
  CompetencyScoreInsert,
  CompetencyScoreUpdate,
  ActivityTag,
  ActivityTagInsert,
  TagContext,
} from "../types";

// ============================================
// competency_scores
// ============================================

/** 학생의 학년도별 역량 평가 조회 (source 필터 가능) */
export async function findCompetencyScores(
  studentId: string,
  schoolYear: number,
  tenantId: string,
  source?: "ai" | "ai_projected" | "manual",
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
  options?: { recordType?: string; recordId?: string; excludeTagContext?: TagContext; tagContext?: TagContext },
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
  if (options?.excludeTagContext) {
    query = query.neq("tag_context", options.excludeTagContext);
  }
  if (options?.tagContext) {
    query = query.eq("tag_context", options.tagContext);
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
  tenantId?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_activity_tags")
    .delete()
    .eq("record_type", recordType)
    .eq("record_id", recordId);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { error } = await query;
  if (error) throw error;
}

/** 특정 레코드의 AI 생성 태그만 삭제 (재분석 전 정리용) */
/** 학생의 특정 레코드 ID 목록에 대한 AI 태그 일괄 삭제 (배치) */
export async function deleteAiActivityTagsByRecordIds(
  recordIds: string[],
  tenantId: string,
): Promise<void> {
  if (recordIds.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_activity_tags")
    .delete()
    .in("record_id", recordIds)
    .eq("tenant_id", tenantId)
    .eq("source", "ai");
  if (error) throw error;
}

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

/**
 * AI 역량 태그 원자적 교체 (RPC 트랜잭션)
 * deleteAiActivityTagsByRecordIds + insertActivityTags를 단일 트랜잭션으로 실행.
 * 크래시 시 데이터 유실 방지.
 *
 * @param newTags — tag_context는 필수. "analysis"(P1-3 역량분석) 또는 "draft_analysis"(P8 가안분석).
 *   RPC 내부 COALESCE 기본값('analysis')에 의존하지 않도록 명시적 전달 필수.
 */
export async function refreshCompetencyTagsAtomic(
  studentId: string,
  tenantId: string,
  recordIds: string[],
  newTags: Array<{ record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary: string; tag_context: TagContext }>,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("refresh_competency_tags", {
    p_student_id: studentId,
    p_tenant_id: tenantId,
    p_record_ids: recordIds,
    p_new_tags: JSON.stringify(newTags),
  });
  if (error) throw error;
  return (data as number) ?? newTags.length;
}

// ============================================
// content_quality
// ============================================

export interface ContentQualityRow {
  record_type: string;
  record_id?: string;
  overall_score: number;
  issues: string[] | null;
  feedback: string | null;
}

/** 학생의 콘텐츠 품질 점수 조회 (source 필터, record_id 포함/제외 선택) */
export async function findContentQualityByStudent(
  studentId: string,
  tenantId: string,
  options?: {
    source?: "ai" | "ai_projected";
    selectRecordId?: boolean;
    selectRecordType?: boolean;
  },
): Promise<ContentQualityRow[]> {
  const supabase = await createSupabaseServerClient();
  const fields = [
    "record_type",
    options?.selectRecordId !== false ? "record_id" : null,
    "overall_score",
    "issues",
    "feedback",
  ]
    .filter(Boolean)
    .join(", ");

  let query = supabase
    .from("student_record_content_quality")
    .select(fields)
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (options?.source) query = query.eq("source", options.source);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ContentQualityRow[];
}

/** 특정 레코드 ID 목록의 콘텐츠 품질 점수 조회 */
export async function findContentQualityByRecordIds(
  recordIds: string[],
  tenantId: string,
  source: "ai" | "ai_projected" = "ai",
): Promise<Array<{ record_id: string; record_type: string; overall_score: number; issues: string[] | null; feedback: string | null }>> {
  if (recordIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_content_quality")
    .select("record_id, record_type, overall_score, issues, feedback")
    .in("record_id", recordIds)
    .eq("tenant_id", tenantId)
    .eq("source", source);
  if (error) throw error;
  return data ?? [];
}

// ============================================
// 분석 결과 캐시 (하이라이트 영속화)
// ⚠️ analysis_cache.source = "ai" | "consultant" (DB CHECK 제약)
//    diagnosis/competency_scores.source = "ai" | "manual" 과 별개 도메인
// ============================================

/** 분석 결과 캐시 upsert (AI 또는 컨설턴트) + 증분 분석용 content_hash */
export async function upsertAnalysisCache(input: {
  tenant_id: string;
  student_id: string;
  record_type: string;
  record_id: string;
  source: "ai" | "consultant";
  analysis_result: unknown;
  content_hash?: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_analysis_cache")
    .upsert(input, {
      onConflict: "tenant_id,record_type,record_id,source",
    });

  if (error) throw error;
}

/** 학생의 전체 AI 분석 캐시 조회 (하이라이트 복원 + 증분 분석용) */
export async function findAnalysisCacheByStudent(
  studentId: string,
  tenantId: string,
  source?: "ai" | "consultant",
): Promise<Array<{ record_type: string; record_id: string; source: string; analysis_result: unknown; content_hash: string | null }>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_analysis_cache")
    .select("record_type, record_id, source, analysis_result, content_hash")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** 학생의 AI 분석 캐시 전체 삭제 — 재실행 시 LLM 강제 재호출용 */
export async function deleteAnalysisCacheByStudentId(
  studentId: string,
  tenantId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_analysis_cache")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", "ai");

  if (error) throw error;
}

/**
 * 특정 학년의 AI 파생 분석 데이터 삭제 — 재실행 시 이전 결과 잔류 방지.
 * analysis_cache와 별개로 competency_scores, activity_tags, content_quality를 정리한다.
 *
 * @param targetSchoolYear - grade → school_year 변환값. 호출부에서 계산하여 전달.
 *   `gradeToSchoolYear(grade, studentGrade, currentSchoolYear)` 사용.
 */
export async function deleteAnalysisResultsByGrade(
  studentId: string,
  tenantId: string,
  grade: number,
  targetSchoolYear: number,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // 해당 학년의 record ID 일괄 조회
  const [sRes, cRes, hRes] = await Promise.all([
    supabase.from("student_record_seteks")
      .select("id").eq("student_id", studentId).eq("tenant_id", tenantId).eq("grade", grade).is("deleted_at", null),
    supabase.from("student_record_changche")
      .select("id").eq("student_id", studentId).eq("tenant_id", tenantId).eq("grade", grade),
    supabase.from("student_record_haengteuk")
      .select("id").eq("student_id", studentId).eq("tenant_id", tenantId).eq("grade", grade),
  ]);

  const recordIds = [
    ...(sRes.data ?? []).map((r) => r.id as string),
    ...(cRes.data ?? []).map((r) => r.id as string),
    ...(hRes.data ?? []).map((r) => r.id as string),
  ];

  // competency_scores: school_year(연도) 기반 직접 삭제 (ai + ai_projected)
  const scoreDeletePromise = supabase
    .from("student_record_competency_scores")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .in("source", ["ai", "ai_projected"]);

  if (recordIds.length === 0) {
    await scoreDeletePromise;
    return;
  }

  // activity_tags + content_quality: record_id 기반 삭제 (AI 생성분만)
  const [scoreRes, tagRes, qualityRes] = await Promise.all([
    scoreDeletePromise,
    supabase.from("student_record_activity_tags")
      .delete().in("record_id", recordIds).in("tag_context", ["analysis", "draft_analysis"]),
    supabase.from("student_record_content_quality")
      .delete().in("record_id", recordIds).in("source", ["ai", "ai_projected"]),
  ]);
  if (scoreRes.error) logActionWarn({ domain: "student-record", action: "deleteAnalysisResultsByGrade" }, `역량 점수 삭제 실패: ${scoreRes.error.message}`, { studentId, grade });
  if (tagRes.error) logActionWarn({ domain: "student-record", action: "deleteAnalysisResultsByGrade" }, `태그 삭제 실패: ${tagRes.error.message}`, { studentId, grade });
  if (qualityRes.error) logActionWarn({ domain: "student-record", action: "deleteAnalysisResultsByGrade" }, `품질 삭제 실패: ${qualityRes.error.message}`, { studentId, grade });
}

/** 배치 캐시 조회 — 증분 분석용 (record_id 목록 → content_hash 포함 캐시 Map) */
export async function findAnalysisCacheByRecordIds(
  recordIds: string[],
  tenantId: string,
  source: "ai" | "consultant" = "ai",
): Promise<Array<{ record_id: string; analysis_result: unknown; content_hash: string | null }>> {
  if (recordIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_analysis_cache")
    .select("record_id, analysis_result, content_hash")
    .in("record_id", recordIds)
    .eq("tenant_id", tenantId)
    .eq("source", source);
  if (error) throw error;
  return data ?? [];
}
