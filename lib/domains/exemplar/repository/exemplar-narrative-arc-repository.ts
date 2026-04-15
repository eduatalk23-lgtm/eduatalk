// ============================================
// Exemplar Narrative Arc Repository — Phase γ G8
// exemplar_narrative_arcs CRUD
//
// exemplar_narrative_arcs 는 student_record_narrative_arc 와 동형.
// record_type ∈ {exemplar_setek, exemplar_creative_activity, exemplar_haengteuk}
// UNIQUE 제약: (exemplar_id, record_type, record_id, source)
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

// ============================================
// 1. 타입
// ============================================

type DbRow = Database["public"]["Tables"]["exemplar_narrative_arcs"]["Row"];
type DbInsert = Database["public"]["Tables"]["exemplar_narrative_arcs"]["Insert"];

/** 지원하는 레코드 타입 */
export type ExemplarNarrativeArcRecordType =
  | "exemplar_setek"
  | "exemplar_creative_activity"
  | "exemplar_haengteuk";

export type ExemplarNarrativeArcSource = "ai" | "manual";

/** upsert 입력 타입 */
export interface ExemplarNarrativeArcUpsertInput {
  tenantId: string;
  exemplarId: string;
  recordType: ExemplarNarrativeArcRecordType;
  recordId: string;
  source?: ExemplarNarrativeArcSource;
  modelName?: string | null;
  extractorVersion?: string | null;
  // 8단계 boolean
  curiosityPresent?: boolean;
  topicSelectionPresent?: boolean;
  inquiryContentPresent?: boolean;
  referencesPresent?: boolean;
  conclusionPresent?: boolean;
  teacherObservationPresent?: boolean;
  growthNarrativePresent?: boolean;
  reinquiryPresent?: boolean;
  // 세부 정보 (confidence + evidence per stage)
  stageDetails?: Record<string, { confidence: number; evidence: string }>;
}

type Client = SupabaseClient<Database>;

// ============================================
// 2. resolveClient 헬퍼
// ============================================

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

// ============================================
// 3. stages_present_count 계산 헬퍼
// ============================================

function calcStagesPresentCount(input: ExemplarNarrativeArcUpsertInput): number {
  return [
    input.curiosityPresent,
    input.topicSelectionPresent,
    input.inquiryContentPresent,
    input.referencesPresent,
    input.conclusionPresent,
    input.teacherObservationPresent,
    input.growthNarrativePresent,
    input.reinquiryPresent,
  ].filter(Boolean).length;
}

// ============================================
// 4. 조회
// ============================================

/**
 * 특정 exemplar 의 모든 narrative_arc 조회.
 * source 필터 기본값: "ai"
 */
export async function listExemplarNarrativeArcs(
  exemplarId: string,
  options?: { source?: ExemplarNarrativeArcSource; recordType?: ExemplarNarrativeArcRecordType },
  client?: Client,
): Promise<DbRow[]> {
  const supabase = await resolveClient(client);
  let query = supabase
    .from("exemplar_narrative_arcs")
    .select("*")
    .eq("exemplar_id", exemplarId)
    .eq("source", options?.source ?? "ai");

  if (options?.recordType) {
    query = query.eq("record_type", options.recordType);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbRow[];
}

/**
 * (exemplar_id, record_type, record_id, source) 키로 단건 조회.
 * 없으면 null 반환.
 */
export async function findExemplarNarrativeArc(
  exemplarId: string,
  recordType: ExemplarNarrativeArcRecordType,
  recordId: string,
  source: ExemplarNarrativeArcSource = "ai",
  client?: Client,
): Promise<DbRow | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("exemplar_narrative_arcs")
    .select("*")
    .eq("exemplar_id", exemplarId)
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .eq("source", source)
    .maybeSingle();

  if (error) throw error;
  return (data as DbRow | null) ?? null;
}

// ============================================
// 5. 업서트
// ============================================

/**
 * narrative_arc upsert.
 * UNIQUE (exemplar_id, record_type, record_id, source) 기반 ON CONFLICT.
 */
export async function upsertExemplarNarrativeArc(
  input: ExemplarNarrativeArcUpsertInput,
  client?: Client,
): Promise<DbRow> {
  const supabase = await resolveClient(client);

  const payload: DbInsert = {
    tenant_id: input.tenantId,
    exemplar_id: input.exemplarId,
    record_type: input.recordType,
    record_id: input.recordId,
    source: input.source ?? "ai",
    model_name: input.modelName ?? null,
    extractor_version: input.extractorVersion ?? null,
    curiosity_present: input.curiosityPresent ?? false,
    topic_selection_present: input.topicSelectionPresent ?? false,
    inquiry_content_present: input.inquiryContentPresent ?? false,
    references_present: input.referencesPresent ?? false,
    conclusion_present: input.conclusionPresent ?? false,
    teacher_observation_present: input.teacherObservationPresent ?? false,
    growth_narrative_present: input.growthNarrativePresent ?? false,
    reinquiry_present: input.reinquiryPresent ?? false,
    stages_present_count: calcStagesPresentCount(input),
    stage_details: (input.stageDetails ?? {}) as Json,
  };

  const { data, error } = await supabase
    .from("exemplar_narrative_arcs")
    .upsert(payload, {
      onConflict: "exemplar_id,record_type,record_id,source",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as DbRow;
}
