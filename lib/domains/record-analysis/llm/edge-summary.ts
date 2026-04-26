// ============================================
// 엣지 데이터 → AI 프롬프트용 요약 변환 (순수 유틸)
// "use server" 파일에 넣으면 Server Action으로 간주되므로 분리
//
// 통합 이력: student-record/edge-summary.ts 의 buildEdgeSummary +
//   buildEdgePromptSection 을 이 파일로 흡수 (2026-04-26).
//   모든 파이프라인·에이전트 소비처가 이 파일을 단일 참조함.
// ============================================

import { EDGE_TYPE_META, type CrossRefEdgeType } from "@/lib/domains/student-record/cross-reference";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";

// ─── buildEdgeSummaryForPrompt 전용 EdgeLike (PersistedEdge 기반, is_stale 포함) ───
interface EdgeLike {
  edge_type: string;
  source_label: string;
  target_label: string;
  reason: string;
  confidence: number;
  is_stale: boolean;
  shared_competencies: string[] | null;
}

// ─── buildEdgePromptSection 전용 최소 인터페이스 (CrossRefEdge 호환) ───
interface CrossRefEdgeLike {
  type: string;
  targetLabel: string;
  reason: string;
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  COMPETENCY_SHARED: "역량 공유",
  CONTENT_REFERENCE: "내용 참조",
  TEMPORAL_GROWTH: "시간적 성장",
  COURSE_SUPPORTS: "교과 지원",
  READING_ENRICHES: "독서 심화",
  THEME_CONVERGENCE: "주제 수렴",
  TEACHER_VALIDATION: "교사 검증",
};

const COMPETENCY_LABELS_MAP: Record<string, string> = {
  academic_achievement: "학업성취도",
  academic_attitude: "학업태도",
  academic_inquiry: "탐구력",
  career_course_effort: "전공이수노력",
  career_course_achievement: "전공성취도",
  career_exploration: "진로탐색",
  community_collaboration: "협업소통",
  community_caring: "나눔배려",
  community_integrity: "성실성",
  community_leadership: "리더십",
};

/**
 * 엣지 배열 → AI 프롬프트용 요약 텍스트
 * 유형별 대표 3건 + 역량 공유 빈도 집계
 */
export function buildEdgeSummaryForPrompt(edges: EdgeLike[]): string {
  if (edges.length === 0) return "";

  const active = edges.filter((e) => !e.is_stale);
  if (active.length === 0) return "";

  // 유형별 그룹
  const byType = new Map<string, EdgeLike[]>();
  for (const e of active) {
    const arr = byType.get(e.edge_type) ?? [];
    arr.push(e);
    byType.set(e.edge_type, arr);
  }

  const lines: string[] = [`## 교과 간 연관성 분석 (총 ${active.length}건)`];

  for (const [type, list] of byType) {
    const label = EDGE_TYPE_LABELS[type] ?? type;
    lines.push(`\n### ${label} (${list.length}건)`);

    // 대표 최대 3건
    const samples = list.slice(0, 3);
    for (const e of samples) {
      const competencies = e.shared_competencies
        ?.map((c) => COMPETENCY_LABELS_MAP[c] ?? c)
        .join(", ");
      const compInfo = competencies ? ` [${competencies}]` : "";
      lines.push(`  · ${e.source_label} ↔ ${e.target_label}: ${e.reason}${compInfo}`);
    }
    if (list.length > 3) {
      lines.push(`  · ... +${list.length - 3}건`);
    }
  }

  // 가장 많이 공유되는 역량 집계
  const compFreq = new Map<string, number>();
  for (const e of active) {
    for (const c of e.shared_competencies ?? []) {
      compFreq.set(c, (compFreq.get(c) ?? 0) + 1);
    }
  }
  if (compFreq.size > 0) {
    const topComps = [...compFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c, n]) => `${COMPETENCY_LABELS_MAP[c] ?? c}(${n}건)`)
      .join(", ");
    lines.push(`\n### 가장 많이 공유되는 역량: ${topComps}`);
  }

  lines.push(`\n이 연관성 데이터를 활용하여 진로 일관성 강도(directionStrength) 판단의 근거로 삼고,`);
  lines.push(`교과 간 연결이 강한 영역을 강점으로, 고립된 영역을 약점으로 반영하세요.`);

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// buildEdgeSummary / buildEdgePromptSection
// 원래 student-record/edge-summary.ts 에 있던 함수.
// PersistedEdge[] | CrossRefEdgeLike[] 양방향 처리.
// ─────────────────────────────────────────────────────────────────────────────

/** AI 프롬프트에 삽입할 엣지 요약 텍스트 생성 */
export function buildEdgeSummary(
  edges: PersistedEdge[] | CrossRefEdgeLike[],
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

/** 엣지 프롬프트 섹션 전체 생성 (빈 엣지면 빈 문자열) */
export function buildEdgePromptSection(
  edges: PersistedEdge[] | CrossRefEdgeLike[],
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
