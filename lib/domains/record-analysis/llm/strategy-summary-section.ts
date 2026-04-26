// ============================================
// 격차 A+B: S5 strategy 결과 → S6 interview/roadmap 프롬프트 섹션 빌더
//
// student_record_strategies 행 배열을 받아 priority(high 우선) 기준으로
// 최대 5건을 직렬화한 마크다운 섹션을 반환한다.
//
// 소비처:
//   pipeline/synthesis/phase-s6-interview.ts
//     → generateInterviewQuestions (InterviewInput.strategySummarySection)
//     → generateAiRoadmap (RoadmapGenerationInput.strategySummarySection)
//
// 설계 원칙:
//   - 빈 입력(null/undefined/0건) → undefined 반환 (graceful, no-op)
//   - priority 'critical' > 'high' > 'medium' > 'low' 정렬 후 상위 5건
//   - strategy_content 는 100자 slice (프롬프트 토큰 절감)
//   - 순수 함수 (LLM 호출 없음, 부수효과 없음)
// ============================================

/** 섹션 빌더가 소비하는 최소 Strategy 형태 (DB Row 와 호환) */
export interface StrategySummaryRow {
  priority: string | null;
  target_area: string;
  strategy_content: string;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * S5 strategy 결과를 S6 면접/로드맵 프롬프트에 주입할 마크다운 섹션으로 렌더한다.
 *
 * @param strategies - student_record_strategies 행 배열 (또는 그 부분 집합)
 * @param maxItems - 최대 직렬화 건수 (기본 5)
 * @returns 마크다운 섹션, 또는 undefined (빈 입력 시)
 */
export function buildStrategySummarySection(
  strategies: StrategySummaryRow[] | null | undefined,
  maxItems = 5,
): string | undefined {
  if (!strategies || strategies.length === 0) return undefined;

  // priority 내림차순 정렬 (critical 우선), 동순위는 target_area 알파벳순
  const sorted = [...strategies].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority ?? "medium"] ?? 2;
    const pb = PRIORITY_ORDER[b.priority ?? "medium"] ?? 2;
    if (pa !== pb) return pa - pb;
    return a.target_area.localeCompare(b.target_area);
  });

  const top = sorted.slice(0, maxItems);

  const lines: string[] = [];
  lines.push("## S5 합의 전략 요약 (면접·로드맵 방향 기준)");
  lines.push(
    "아래 전략은 컨설턴트가 S5 단계에서 확정한 보완 방향입니다. " +
      "면접 질문과 로드맵 항목이 이 전략 방향과 정합하도록 생성하세요.",
  );
  lines.push("");

  for (const s of top) {
    const priorityLabel = s.priority ? `[${s.priority.toUpperCase()}]` : "[MEDIUM]";
    const contentSlice = s.strategy_content.slice(0, 100);
    const ellipsis = s.strategy_content.length > 100 ? "…" : "";
    lines.push(`- ${priorityLabel} **${s.target_area}**: ${contentSlice}${ellipsis}`);
  }

  lines.push("");
  lines.push(
    "**면접 질문**: 위 전략 영역의 약점(보완 필요 축)을 겨냥하는 질문을 1개 이상 포함하라. " +
      "**로드맵**: 위 전략을 이행하는 구체 활동을 학기별로 최소 1건 배치하라.",
  );

  return lines.join("\n");
}
