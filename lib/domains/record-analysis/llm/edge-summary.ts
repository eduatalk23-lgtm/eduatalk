// ============================================
// 엣지 데이터 → AI 프롬프트용 요약 변환 (순수 유틸)
// "use server" 파일에 넣으면 Server Action으로 간주되므로 분리
// ============================================

interface EdgeLike {
  edge_type: string;
  source_label: string;
  target_label: string;
  reason: string;
  confidence: number;
  is_stale: boolean;
  shared_competencies: string[] | null;
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
