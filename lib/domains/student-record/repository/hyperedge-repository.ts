// ============================================
// 하이퍼엣지(Hyperedge) Repository — Layer 2 Hypergraph
// student_record_hyperedges CRUD
//
// Phase 1 (2026-04-14): N-ary 수렴 엣지
// Layer 1 (edge-repository.ts, binary) 위의 상위 계층
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EdgeContext } from "./edge-repository";

// ============================================
// 1. 타입
// ============================================

export type HyperedgeType = "theme_convergence" | "narrative_arc";
export type HyperedgeContext = EdgeContext;

export interface HyperedgeMember {
  recordType: string;
  recordId: string;
  label: string;
  grade: number | null;
  role?: "anchor" | "support" | "evidence";
}

export interface PersistedHyperedge {
  id: string;
  tenant_id: string;
  student_id: string;
  pipeline_id: string | null;
  theme_slug: string;
  theme_label: string;
  hyperedge_type: HyperedgeType;
  members: HyperedgeMember[];
  member_count: number;
  edge_context: HyperedgeContext;
  confidence: number;
  evidence: string | null;
  shared_keywords: string[] | null;
  shared_competencies: string[] | null;
  is_stale: boolean;
  stale_reason: string | null;
  snapshot_version: number;
  created_at: string;
  updated_at: string;
}

/** 신규/추론 hyperedge 입력 */
export interface HyperedgeInput {
  themeSlug: string;
  themeLabel: string;
  hyperedgeType?: HyperedgeType;
  members: HyperedgeMember[];
  confidence?: number;
  evidence?: string | null;
  sharedKeywords?: string[] | null;
  sharedCompetencies?: string[] | null;
}

// ============================================
// 2. 조회
// ============================================

/**
 * 학생의 hyperedge 목록 조회.
 * 기본: stale 제외. contexts/types 필터 지원.
 */
export async function findHyperedges(
  studentId: string,
  tenantId: string,
  options?: {
    contexts?: HyperedgeContext[];
    types?: HyperedgeType[];
    includeStale?: boolean;
  },
): Promise<PersistedHyperedge[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_hyperedges")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (options?.contexts && options.contexts.length > 0) {
    query = query.in("edge_context", options.contexts);
  }
  if (options?.types && options.types.length > 0) {
    query = query.in("hyperedge_type", options.types);
  }
  if (!options?.includeStale) {
    query = query.eq("is_stale", false);
  }

  const { data, error } = await query
    .order("confidence", { ascending: false })
    .order("created_at");

  if (error) throw error;
  return (data ?? []) as PersistedHyperedge[];
}

// ============================================
// 3. 일괄 교체 (규칙 기반 컴퓨테이션 산출물)
// ============================================

/**
 * 학생의 기존 hyperedge(해당 컨텍스트)를 모두 삭제 후 재삽입 (RPC 트랜잭션).
 */
export async function replaceHyperedges(
  studentId: string,
  tenantId: string,
  pipelineId: string,
  hyperedges: HyperedgeInput[],
  context: HyperedgeContext = "analysis",
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const rows = hyperedges.map(toHyperedgeRow);

  const { data, error } = await supabase.rpc("replace_student_record_hyperedges", {
    p_student_id: studentId,
    p_tenant_id: tenantId,
    p_pipeline_id: pipelineId,
    p_edge_context: context,
    p_hyperedges: rows,
  });

  if (error) throw error;
  return (data as number) ?? rows.length;
}

// ============================================
// 3-b. 보존형 삽입 (Phase 1.5 LLM 추론용)
// ============================================

/**
 * 기존 hyperedge를 유지한 채 새 항목만 추가. 중복은 ON CONFLICT DO NOTHING.
 * (student_id, hyperedge_type, theme_slug, edge_context) 기준 unique.
 */
export async function insertHyperedges(
  studentId: string,
  tenantId: string,
  pipelineId: string | null,
  hyperedges: HyperedgeInput[],
  context: HyperedgeContext = "synthesis_inferred",
): Promise<number> {
  if (hyperedges.length === 0) return 0;
  const supabase = await createSupabaseServerClient();
  const rows = hyperedges.map(toHyperedgeRow);

  const { data, error } = await supabase.rpc("insert_student_record_hyperedges", {
    p_student_id: studentId,
    p_tenant_id: tenantId,
    p_pipeline_id: pipelineId,
    p_edge_context: context,
    p_hyperedges: rows,
  });

  if (error) throw error;
  return (data as number) ?? 0;
}

// ============================================
// 4. Stale 마킹
// ============================================

/**
 * 특정 record가 멤버로 포함된 모든 hyperedge를 stale 처리.
 * members jsonb에 `{ recordId: ... }` 가 포함된 행을 contains 연산자로 필터.
 */
export async function markHyperedgesStaleByRecord(
  recordId: string,
  reason: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_hyperedges")
    .update({
      is_stale: true,
      stale_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .contains("members", [{ recordId }])
    .eq("is_stale", false)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

/** 학생의 모든 hyperedge를 stale 처리 (임포트/성적 변동 등 전체 재분석 시). */
export async function markAllStudentHyperedgesStale(
  studentId: string,
  reason: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_hyperedges")
    .update({
      is_stale: true,
      stale_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("is_stale", false)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

/** stale 해제 (재분석 완료 후). */
export async function clearHyperedgesStale(
  studentId: string,
  tenantId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_hyperedges")
    .update({
      is_stale: false,
      stale_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("is_stale", true);

  if (error) throw error;
}

// ============================================
// 내부 헬퍼
// ============================================

export interface HyperedgeRow {
  theme_slug: string;
  theme_label: string;
  hyperedge_type: HyperedgeType;
  members: HyperedgeMember[];
  confidence: number;
  evidence: string | null;
  shared_keywords: string[] | null;
  shared_competencies: string[] | null;
}

/** HyperedgeInput → RPC payload row (테스트용 export) */
export function toHyperedgeRow(input: HyperedgeInput): HyperedgeRow {
  if (input.members.length < 2) {
    throw new Error(
      `hyperedge members must be ≥2 (got ${input.members.length}, theme_slug=${input.themeSlug})`,
    );
  }
  return {
    theme_slug: input.themeSlug,
    theme_label: input.themeLabel,
    hyperedge_type: input.hyperedgeType ?? "theme_convergence",
    members: input.members,
    confidence: clampConfidence(input.confidence ?? 0.6),
    evidence: input.evidence ?? null,
    shared_keywords: input.sharedKeywords ?? null,
    shared_competencies: input.sharedCompetencies ?? null,
  };
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0.6;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 100) / 100;
}
