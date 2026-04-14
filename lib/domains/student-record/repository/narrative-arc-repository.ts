// ============================================
// Narrative Arc Repository — Layer 3 서사 태깅
// student_record_narrative_arc CRUD
//
// Phase 2 (2026-04-14): 8단계 서사 태깅 영속화
// 레코드 단위 분석 결과를 저장/조회 (source = 'ai' | 'manual')
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  NarrativeArcExtractionResult,
  NarrativeArcStage,
} from "@/lib/domains/record-analysis/llm/types";

// ============================================
// 1. 타입
// ============================================

export type NarrativeArcRecordType =
  | "setek"
  | "personal_setek"
  | "changche"
  | "haengteuk";

export type NarrativeArcSource = "ai" | "manual";

export interface PersistedNarrativeArc {
  id: string;
  tenant_id: string;
  student_id: string;
  pipeline_id: string | null;
  record_type: NarrativeArcRecordType;
  record_id: string;
  school_year: number;
  grade: number;
  curiosity_present: boolean;
  topic_selection_present: boolean;
  inquiry_content_present: boolean;
  references_present: boolean;
  conclusion_present: boolean;
  teacher_observation_present: boolean;
  growth_narrative_present: boolean;
  reinquiry_present: boolean;
  stages_present_count: number | null;
  stage_details: Record<string, { confidence: number; evidence: string }>;
  source: NarrativeArcSource;
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

/** narrative_arc upsert 입력 */
export interface NarrativeArcUpsertInput {
  recordType: NarrativeArcRecordType;
  recordId: string;
  schoolYear: number;
  grade: number;
  result: Pick<
    NarrativeArcExtractionResult,
    | "curiosity"
    | "topicSelection"
    | "inquiryContent"
    | "references"
    | "conclusion"
    | "teacherObservation"
    | "growthNarrative"
    | "reinquiry"
  >;
  source?: NarrativeArcSource;
  modelName?: string | null;
  pipelineId?: string | null;
}

// 카멜 → 스네이크 컬럼 매핑
const STAGE_COLUMN_MAP: Record<NarrativeArcStage, keyof Pick<PersistedNarrativeArc,
  | "curiosity_present"
  | "topic_selection_present"
  | "inquiry_content_present"
  | "references_present"
  | "conclusion_present"
  | "teacher_observation_present"
  | "growth_narrative_present"
  | "reinquiry_present"
>> = {
  curiosity: "curiosity_present",
  topicSelection: "topic_selection_present",
  inquiryContent: "inquiry_content_present",
  references: "references_present",
  conclusion: "conclusion_present",
  teacherObservation: "teacher_observation_present",
  growthNarrative: "growth_narrative_present",
  reinquiry: "reinquiry_present",
};

// ============================================
// 2. 조회
// ============================================

/** 단일 레코드의 narrative_arc 조회 (source 필터) */
export async function findNarrativeArc(
  studentId: string,
  tenantId: string,
  recordType: NarrativeArcRecordType,
  recordId: string,
  source: NarrativeArcSource = "ai",
): Promise<PersistedNarrativeArc | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_narrative_arc")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .eq("source", source)
    .maybeSingle();

  if (error) throw error;
  return (data as PersistedNarrativeArc | null) ?? null;
}

/** 학생의 모든 narrative_arc 조회 (source 필터, 기본 ai) */
export async function findNarrativeArcsByStudent(
  studentId: string,
  tenantId: string,
  options?: { source?: NarrativeArcSource; schoolYear?: number },
): Promise<PersistedNarrativeArc[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_narrative_arc")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", options?.source ?? "ai");
  if (options?.schoolYear !== undefined) {
    query = query.eq("school_year", options.schoolYear);
  }
  const { data, error } = await query.order("school_year").order("grade");
  if (error) throw error;
  return (data ?? []) as PersistedNarrativeArc[];
}

/**
 * 이미 분석된 (record_type, record_id) 집합 — ai source 기준.
 * 파이프라인 재실행 시 스킵 판정용.
 */
export async function loadAnalyzedRecordKeys(
  studentId: string,
  tenantId: string,
): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_narrative_arc")
    .select("record_type, record_id")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", "ai");
  if (error) throw error;
  return new Set(
    (data ?? []).map((r) => `${r.record_type}:${r.record_id}`),
  );
}

// ============================================
// 3. 업서트
// ============================================

/**
 * narrative_arc upsert (레코드 + source 단위).
 * UNIQUE (tenant_id, student_id, record_type, record_id, source)에 따라
 * onConflict로 동일 키 레코드 덮어쓰기.
 *
 * supabase 인자는 optional: 미제공 시 server client 생성. 파이프라인에서
 * adminClient를 사용할 경우 명시적으로 전달.
 */
export async function upsertNarrativeArc(
  studentId: string,
  tenantId: string,
  input: NarrativeArcUpsertInput,
  supabase?: SupabaseClient<Database>,
): Promise<PersistedNarrativeArc> {
  const client: SupabaseClient<Database> =
    supabase ?? (await createSupabaseServerClient());

  const stagesRow: Record<string, boolean> = {};
  const stageDetails: Record<string, { confidence: number; evidence: string }> = {};

  (Object.keys(STAGE_COLUMN_MAP) as NarrativeArcStage[]).forEach((stage) => {
    const v = input.result[stage];
    stagesRow[STAGE_COLUMN_MAP[stage]] = v.present;
    stageDetails[stage] = {
      confidence: v.confidence,
      evidence: v.evidence,
    };
  });

  const payload = {
    tenant_id: tenantId,
    student_id: studentId,
    pipeline_id: input.pipelineId ?? null,
    record_type: input.recordType,
    record_id: input.recordId,
    school_year: input.schoolYear,
    grade: input.grade,
    ...stagesRow,
    stage_details: stageDetails,
    source: input.source ?? "ai",
    model_name: input.modelName ?? null,
  };

  const { data, error } = await client
    .from("student_record_narrative_arc")
    .upsert(payload, {
      onConflict: "tenant_id,student_id,record_type,record_id,source",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PersistedNarrativeArc;
}
