// ============================================
// L3-C: resolveInferredEdges 테스트
// LLM 출력(라벨 기반) → InferredEdgeInput(ID 기반) 해소 로직 검증
// ============================================

import { describe, it, expect } from "vitest";
import { resolveInferredEdges } from "../pipeline/synthesis/phase-s3-diagnosis";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import type { DiagnosisInferredEdge } from "../llm/actions/generateDiagnosis";

// 테스트 헬퍼: 최소 필드만 가진 PersistedEdge 생성
function mkEdge(partial: Partial<PersistedEdge>): PersistedEdge {
  return {
    id: partial.id ?? "e-1",
    tenant_id: "t-1",
    student_id: "s-1",
    pipeline_id: null,
    source_record_type: partial.source_record_type ?? "setek",
    source_record_id: partial.source_record_id ?? "src-1",
    source_label: partial.source_label ?? "",
    source_grade: partial.source_grade ?? 1,
    target_record_type: partial.target_record_type ?? "setek",
    target_record_id: partial.target_record_id ?? "tgt-1",
    target_label: partial.target_label ?? "",
    target_grade: partial.target_grade ?? 1,
    edge_type: partial.edge_type ?? "COMPETENCY_SHARED",
    edge_context: partial.edge_context ?? "analysis",
    reason: partial.reason ?? "",
    shared_competencies: partial.shared_competencies ?? null,
    confidence: partial.confidence ?? 0.8,
    is_stale: false,
    stale_reason: null,
    snapshot_version: 1,
    created_at: "2026-04-13T00:00:00Z",
    updated_at: "2026-04-13T00:00:00Z",
  };
}

describe("resolveInferredEdges", () => {
  it("라벨이 기존 엣지에 존재하면 ID로 resolve한다", () => {
    const existing = [
      mkEdge({
        source_record_id: "rec-A",
        source_label: "1학년 화학 세특",
        target_record_id: "rec-B",
        target_label: "1학년 독서 A",
      }),
    ];
    const inferred: DiagnosisInferredEdge[] = [
      {
        sourceLabel: "1학년 화학 세특",
        targetLabel: "1학년 독서 A",
        edgeType: "READING_ENRICHES",
        reason: "독서가 세특 탐구를 심화",
      },
    ];

    const resolved = resolveInferredEdges(inferred, existing);
    // 주의: 기존 엣지(COMPETENCY_SHARED)와 edgeType이 다르므로 중복 처리되지 않음
    expect(resolved).toHaveLength(1);
    expect(resolved[0].sourceRecordId).toBe("rec-A");
    expect(resolved[0].targetRecordId).toBe("rec-B");
    expect(resolved[0].edgeType).toBe("READING_ENRICHES");
  });

  it("라벨이 기존 데이터에 없으면 폐기된다 (LLM 환각 방어)", () => {
    const existing = [
      mkEdge({
        source_record_id: "rec-A",
        source_label: "1학년 화학 세특",
        target_record_id: "rec-B",
        target_label: "1학년 독서 A",
      }),
    ];
    const inferred: DiagnosisInferredEdge[] = [
      {
        sourceLabel: "존재하지 않는 레코드",
        targetLabel: "역시 존재하지 않음",
        edgeType: "COMPETENCY_SHARED",
        reason: "LLM이 지어낸 연결",
      },
    ];

    const resolved = resolveInferredEdges(inferred, existing);
    expect(resolved).toHaveLength(0);
  });

  it("기존 엣지와 완전 중복(same source+target+edgeType)이면 제외", () => {
    const existing = [
      mkEdge({
        source_record_id: "rec-A",
        source_label: "세특 A",
        target_record_id: "rec-B",
        target_label: "세특 B",
        edge_type: "COMPETENCY_SHARED",
      }),
    ];
    const inferred: DiagnosisInferredEdge[] = [
      {
        sourceLabel: "세특 A",
        targetLabel: "세특 B",
        edgeType: "COMPETENCY_SHARED",
        reason: "LLM이 같은 연결을 재제시",
      },
    ];

    const resolved = resolveInferredEdges(inferred, existing);
    expect(resolved).toHaveLength(0);
  });

  it("source==target 자기참조 엣지는 폐기", () => {
    const existing = [
      mkEdge({ source_record_id: "rec-A", source_label: "세특 A", target_record_id: "rec-A", target_label: "세특 A" }),
    ];
    const inferred: DiagnosisInferredEdge[] = [
      {
        sourceLabel: "세특 A",
        targetLabel: "세특 A",
        edgeType: "COMPETENCY_SHARED",
        reason: "자기참조",
      },
    ];

    const resolved = resolveInferredEdges(inferred, existing);
    expect(resolved).toHaveLength(0);
  });

  it("동일 배치 내 중복 엣지는 1건만 유지", () => {
    const existing = [
      mkEdge({ source_record_id: "rec-A", source_label: "세특 A", target_record_id: "rec-B", target_label: "세특 B" }),
    ];
    const inferred: DiagnosisInferredEdge[] = [
      { sourceLabel: "세특 A", targetLabel: "세특 B", edgeType: "THEME_CONVERGENCE", reason: "첫 번째" },
      { sourceLabel: "세특 A", targetLabel: "세특 B", edgeType: "THEME_CONVERGENCE", reason: "중복 두 번째" },
    ];

    const resolved = resolveInferredEdges(inferred, existing);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].reason).toBe("첫 번째");
  });

  it("복수 inferred 엣지에서 라벨 resolve가 혼재해도 정상 처리", () => {
    const existing = [
      mkEdge({ source_record_id: "rec-A", source_label: "세특 A", target_record_id: "rec-B", target_label: "세특 B" }),
      mkEdge({ source_record_id: "rec-C", source_label: "세특 C", target_record_id: "rec-D", target_label: "독서 D" }),
    ];
    const inferred: DiagnosisInferredEdge[] = [
      { sourceLabel: "세특 A", targetLabel: "독서 D", edgeType: "READING_ENRICHES", reason: "매칭" },
      { sourceLabel: "유령 라벨", targetLabel: "세특 B", edgeType: "COMPETENCY_SHARED", reason: "폐기됨" },
      { sourceLabel: "세특 C", targetLabel: "세특 A", edgeType: "THEME_CONVERGENCE", reason: "매칭" },
    ];

    const resolved = resolveInferredEdges(inferred, existing);
    expect(resolved).toHaveLength(2);
    expect(resolved.map((r) => `${r.sourceRecordId}->${r.targetRecordId}`)).toEqual([
      "rec-A->rec-D",
      "rec-C->rec-A",
    ]);
  });

  it("confidence 기본값은 0.55 (THEME_CONVERGENCE보다 낮음)", () => {
    const existing = [
      mkEdge({ source_record_id: "rec-A", source_label: "세특 A", target_record_id: "rec-B", target_label: "세특 B" }),
    ];
    const inferred: DiagnosisInferredEdge[] = [
      { sourceLabel: "세특 A", targetLabel: "세특 B", edgeType: "THEME_CONVERGENCE", reason: "테스트" },
    ];

    const resolved = resolveInferredEdges(inferred, existing);
    expect(resolved[0].confidence).toBeLessThanOrEqual(0.6);
    expect(resolved[0].confidence).toBeGreaterThanOrEqual(0.5);
  });
});
