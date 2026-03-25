// ============================================
// 엣지(Edge) Repository
// student_record_edges + edge_snapshots CRUD
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConnectionGraph, CrossRefEdge, CrossRefEdgeType } from "./cross-reference";

// ============================================
// 1. 타입
// ============================================

export interface PersistedEdge {
  id: string;
  tenant_id: string;
  student_id: string;
  pipeline_id: string | null;
  source_record_type: string;
  source_record_id: string;
  source_label: string;
  source_grade: number | null;
  target_record_type: string;
  target_record_id: string | null;
  target_label: string;
  target_grade: number | null;
  edge_type: CrossRefEdgeType;
  reason: string;
  shared_competencies: string[] | null;
  confidence: number;
  is_stale: boolean;
  stale_reason: string | null;
  snapshot_version: number;
  created_at: string;
  updated_at: string;
}

export interface EdgeSnapshot {
  id: string;
  student_id: string;
  pipeline_id: string;
  edge_count: number;
  edges_json: PersistedEdge[];
  computed_at: string;
}

// ============================================
// 2. 조회
// ============================================

/** 학생의 현재 엣지 목록 조회 */
export async function findEdges(
  studentId: string,
  tenantId: string,
): Promise<PersistedEdge[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_edges")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("edge_type")
    .order("created_at");

  if (error) throw error;
  return (data ?? []) as PersistedEdge[];
}

/** 학생의 스냅샷 이력 조회 (최신 순) */
export async function findSnapshots(
  studentId: string,
  limit = 5,
): Promise<EdgeSnapshot[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_edge_snapshots")
    .select("*")
    .eq("student_id", studentId)
    .order("computed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as EdgeSnapshot[];
}

// ============================================
// 3. 일괄 교체 (파이프라인 edge_computation)
// ============================================

/**
 * 학생의 기존 엣지를 모두 삭제하고 새 엣지로 교체
 * ConnectionGraph → DB 행 변환
 */
export async function replaceEdges(
  studentId: string,
  tenantId: string,
  pipelineId: string,
  graph: ConnectionGraph,
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  // 1. 기존 엣지 삭제
  const { error: deleteError } = await supabase
    .from("student_record_edges")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (deleteError) throw deleteError;

  // 2. 새 엣지 INSERT
  const rows = graphToEdgeRows(studentId, tenantId, pipelineId, graph);
  if (rows.length === 0) return 0;

  // 50개씩 배치 INSERT
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error: insertError } = await supabase
      .from("student_record_edges")
      .insert(batch);
    if (insertError) throw insertError;
  }

  return rows.length;
}

// ============================================
// 4. 스냅샷 저장
// ============================================

/** 현재 엣지 상태를 스냅샷으로 저장 (파이프라인당 1개) */
export async function saveSnapshot(
  studentId: string,
  pipelineId: string,
  graph: ConnectionGraph,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // 모든 노드의 엣지를 flat하게 수집
  const allEdges = graph.nodes.flatMap((node) =>
    node.edges.map((edge) => ({
      source_record_type: node.recordType,
      source_record_id: [...node.recordIds][0],
      source_label: node.label,
      source_grade: node.grade,
      edge_type: edge.type,
      target_record_type: edge.targetRecordType,
      target_record_id: edge.targetRecordId ?? null,
      target_label: edge.targetLabel,
      reason: edge.reason,
      shared_competencies: edge.sharedCompetencies ?? null,
    })),
  );

  const { error } = await supabase
    .from("student_record_edge_snapshots")
    .upsert(
      {
        student_id: studentId,
        pipeline_id: pipelineId,
        edge_count: graph.totalEdges,
        edges_json: allEdges,
      },
      { onConflict: "student_id,pipeline_id" },
    );

  if (error) throw error;
}

// ============================================
// 5. Stale 마킹
// ============================================

/** 특정 레코드와 관련된 엣지를 stale로 마킹 */
export async function markEdgesStale(
  recordId: string,
  reason: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  // source OR target에 해당 recordId가 있는 엣지를 stale 처리
  const { data: sourceData, error: sourceError } = await supabase
    .from("student_record_edges")
    .update({ is_stale: true, stale_reason: reason, updated_at: new Date().toISOString() })
    .eq("source_record_id", recordId)
    .eq("is_stale", false)
    .select("id");

  if (sourceError) throw sourceError;

  const { data: targetData, error: targetError } = await supabase
    .from("student_record_edges")
    .update({ is_stale: true, stale_reason: reason, updated_at: new Date().toISOString() })
    .eq("target_record_id", recordId)
    .eq("is_stale", false)
    .select("id");

  if (targetError) throw targetError;

  return (sourceData?.length ?? 0) + (targetData?.length ?? 0);
}

/** 학생의 모든 엣지 stale 해제 (파이프라인 재실행 후) */
export async function clearStale(
  studentId: string,
  tenantId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_edges")
    .update({ is_stale: false, stale_reason: null, updated_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("is_stale", true);

  if (error) throw error;
}

// ============================================
// 내부 헬퍼
// ============================================

interface EdgeInsertRow {
  tenant_id: string;
  student_id: string;
  pipeline_id: string;
  source_record_type: string;
  source_record_id: string;
  source_label: string;
  source_grade: number | null;
  target_record_type: string;
  target_record_id: string | null;
  target_label: string;
  target_grade: number | null;
  edge_type: string;
  reason: string;
  shared_competencies: string[] | null;
  confidence: number;
}

function graphToEdgeRows(
  studentId: string,
  tenantId: string,
  pipelineId: string,
  graph: ConnectionGraph,
): EdgeInsertRow[] {
  const rows: EdgeInsertRow[] = [];

  for (const node of graph.nodes) {
    const sourceRecordId = [...node.recordIds][0];

    for (const edge of node.edges) {
      rows.push({
        tenant_id: tenantId,
        student_id: studentId,
        pipeline_id: pipelineId,
        source_record_type: node.recordType,
        source_record_id: sourceRecordId,
        source_label: node.label,
        source_grade: node.grade || null,
        target_record_type: edge.targetRecordType,
        target_record_id: edge.targetRecordId ?? null,
        target_label: edge.targetLabel,
        target_grade: resolveTargetGrade(edge),
        edge_type: edge.type,
        reason: edge.reason,
        shared_competencies: edge.sharedCompetencies ?? null,
        confidence: 1.0,
      });
    }
  }

  return rows;
}

function resolveTargetGrade(edge: CrossRefEdge): number | null {
  // TEMPORAL_GROWTH reason에서 학년 추출: "1→2학년 심화"
  if (edge.type === "TEMPORAL_GROWTH") {
    const match = edge.reason.match(/→(\d)학년/);
    if (match) return Number(match[1]);
  }
  return null;
}
