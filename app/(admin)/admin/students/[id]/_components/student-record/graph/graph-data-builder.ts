// ============================================
// Phase 1.x — 단일 학생 그래프 뷰 데이터 빌더
// Layer 1 edges + Layer 2 hyperedges → Cytoscape elements
//
// hyperedge는 compound parent가 아닌 pseudo-node로 표현.
// (한 record가 여러 hyperedge 소속 가능하므로 compound parent 제약 회피)
// ============================================

import type { ElementDefinition } from "cytoscape";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import type { PersistedHyperedge } from "@/lib/domains/student-record/repository/hyperedge-repository";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";

export const COMPETENCY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  COMPETENCY_ITEMS.map((c) => [c.code, c.label]),
);

/**
 * theme_label은 `code1 · code2 · code3` 형식.
 * 각 code를 한글 라벨로 치환.
 */
export function localizeThemeLabel(raw: string): string {
  if (!raw) return "";
  return raw
    .split("·")
    .map((s) => {
      const key = s.trim();
      return COMPETENCY_LABEL_MAP[key] ?? key;
    })
    .join(" · ");
}

export function localizeCompetencyList(codes: string[]): string[] {
  return codes.map((c) => COMPETENCY_LABEL_MAP[c] ?? c);
}

export interface BuildGraphInput {
  edges: PersistedEdge[];
  hyperedges: PersistedHyperedge[];
}

export function buildGraphElements({ edges, hyperedges }: BuildGraphInput): ElementDefinition[] {
  const elements: ElementDefinition[] = [];
  const seenNodes = new Set<string>();

  const addRecordNode = (
    recordType: string,
    recordId: string,
    label: string,
    grade: number | null,
  ) => {
    const id = `${recordType}:${recordId}`;
    if (seenNodes.has(id)) return;
    seenNodes.add(id);
    elements.push({
      data: {
        id,
        label,
        recordType,
        recordId,
        grade: grade ?? 0,
        kind: "record",
      },
    });
  };

  for (const e of edges) {
    addRecordNode(e.source_record_type, e.source_record_id, e.source_label, e.source_grade);
    if (e.target_record_id) {
      addRecordNode(e.target_record_type, e.target_record_id, e.target_label, e.target_grade);
    }
  }

  for (const h of hyperedges) {
    for (const m of h.members) {
      addRecordNode(m.recordType, m.recordId, m.label, m.grade);
    }
  }

  for (const e of edges) {
    if (!e.target_record_id) continue;
    elements.push({
      data: {
        id: `edge:${e.id}`,
        source: `${e.source_record_type}:${e.source_record_id}`,
        target: `${e.target_record_type}:${e.target_record_id}`,
        edgeType: e.edge_type,
        edgeContext: e.edge_context,
        reason: e.reason,
        confidence: e.confidence,
        kind: "layer1",
      },
    });
  }

  for (const h of hyperedges) {
    const heId = `he:${h.id}`;
    const localized = localizeThemeLabel(h.theme_label);
    elements.push({
      data: {
        id: heId,
        label: localized,
        themeLabel: localized,
        themeLabelRaw: h.theme_label,
        themeSlug: h.theme_slug,
        confidence: h.confidence,
        memberCount: h.member_count,
        evidence: h.evidence ?? "",
        sharedCompetencies: localizeCompetencyList(h.shared_competencies ?? []),
        kind: "hyperedge",
      },
    });
    for (const m of h.members) {
      elements.push({
        data: {
          id: `he-spoke:${h.id}:${m.recordId}`,
          source: heId,
          target: `${m.recordType}:${m.recordId}`,
          kind: "hyperedge-spoke",
          role: m.role ?? "evidence",
        },
      });
    }
  }

  return elements;
}

export const RECORD_TYPE_LABEL: Record<string, string> = {
  setek: "세특",
  personal_setek: "개인세특",
  changche: "창체",
  haengteuk: "행특",
  reading: "독서",
  score: "성적",
};
