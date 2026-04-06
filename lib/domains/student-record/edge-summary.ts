// ============================================
// 엣지 요약 헬퍼 — AI 프롬프트용
// PersistedEdge[] 또는 CrossRefEdge[] → 텍스트
// ============================================

import { EDGE_TYPE_META, type CrossRefEdgeType } from "./cross-reference";
import type { PersistedEdge } from "./repository/edge-repository";

/** AI 프롬프트에 삽입할 엣지 요약 텍스트 생성 */
export function buildEdgeSummary(
  edges: PersistedEdge[] | EdgeLike[],
): string {
  if (edges.length === 0) return "";

  // 타입별 그룹화
  const byType = new Map<string, Array<{ source: string; target: string; reason: string }>>();
  for (const e of edges) {
    const type = "edge_type" in e ? e.edge_type : e.type;
    const source = "source_label" in e ? e.source_label : "";
    const target = "target_label" in e ? e.target_label : e.targetLabel;
    const reason = "reason" in e ? e.reason : "";

    const arr = byType.get(type) ?? [];
    arr.push({ source, target, reason });
    byType.set(type, arr);
  }

  const lines: string[] = [];
  for (const [type, items] of byType) {
    const label = EDGE_TYPE_META[type as CrossRefEdgeType]?.label ?? type;
    const examples = items
      .slice(0, 2)
      .map((e) => e.source ? `${e.source}→${e.target}` : e.target)
      .join(", ");
    const reasonSample = items[0]?.reason ? ` (${items[0].reason})` : "";
    lines.push(`- ${label} ${items.length}건: ${examples}${reasonSample}`);
  }

  return lines.join("\n");
}

/** CrossRefEdge와 호환되는 최소 인터페이스 */
interface EdgeLike {
  type: string;
  targetLabel: string;
  reason: string;
}

/** 엣지 프롬프트 섹션 전체 생성 (빈 엣지면 빈 문자열) */
export function buildEdgePromptSection(
  edges: PersistedEdge[] | EdgeLike[],
  context: "diagnosis" | "guide" | "summary",
): string {
  const summary = buildEdgeSummary(edges);
  if (!summary) return "";

  const instruction = context === "diagnosis"
    ? "연결이 강한 영역은 진로 일관성과 학업 깊이의 근거로 활용하세요.\n연결이 약하거나 없는 영역은 약점(보완 필요)으로 판단하세요."
    : context === "guide"
      ? "기존 연결을 강화하는 방향을 우선하고, 약한 영역은 새 연결을 만들 수 있는 방향을 제안하세요."
      : "활동 요약서의 '종합 성장 요약' 섹션에서 이 연결을 자연스럽게 녹여 진로 일관성을 보여주세요.";

  return `## 영역간 연결 분석\n\n${summary}\n\n${instruction}\n`;
}
