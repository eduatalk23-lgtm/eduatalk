// ============================================
// P9: draft_refinement — 가안 재생성 프롬프트 빌더
//
// Phase 5 Sprint 1 (2026-04-19): IMPROVE 논문 component-at-a-time iteration.
// P8 에서 overall_score<70 판정된 레코드를 이전 draft + 5축 score + issues + feedback 을
// 프롬프트에 주입하여 1회 재생성한다.
// ============================================

export interface RefinementUserPromptInput {
  /** P7 빌더가 생성한 원본 user prompt 그대로 재활용 */
  originalUserPrompt: string;
  /** DB 에서 조회한 이전 ai_draft_content */
  previousDraft: string;
  /** content_quality.issues 배열 */
  issues: string[];
  /** content_quality.feedback 문자열 */
  feedback: string;
  /** content_quality 5축 점수 */
  axisScores: {
    specificity: number;
    coherence: number;
    depth: number;
    grammar: number;
    scientificValidity: number | null;
  };
}

/**
 * 세특 가안 재생성 user prompt 빌더.
 * 원본 user prompt 를 그대로 유지한 뒤, "이전 가안 + 약점 + 개선 지시" 섹션을 추가한다.
 */
export function buildSetekRefinementUserPrompt(input: RefinementUserPromptInput): string {
  return buildRefinementUserPrompt(input);
}

/**
 * 창체 가안 재생성 user prompt 빌더.
 */
export function buildChangcheRefinementUserPrompt(input: RefinementUserPromptInput): string {
  return buildRefinementUserPrompt(input);
}

/**
 * 행특 가안 재생성 user prompt 빌더.
 */
export function buildHaengteukRefinementUserPrompt(input: RefinementUserPromptInput): string {
  return buildRefinementUserPrompt(input);
}

// ─── 내부 공통 빌더 ─────────────────────────────────────────────────────────

function formatAxisScores(
  axisScores: RefinementUserPromptInput["axisScores"],
): string {
  const lines: string[] = [
    `- 구체성(specificity): ${axisScores.specificity}/5`,
    `- 일관성(coherence): ${axisScores.coherence}/5`,
    `- 심화도(depth): ${axisScores.depth}/5`,
    `- 문법(grammar): ${axisScores.grammar}/5`,
  ];
  if (axisScores.scientificValidity != null) {
    lines.push(`- 학술정합(scientificValidity): ${axisScores.scientificValidity}/5`);
  }
  return lines.join("\n");
}

function buildRefinementUserPrompt(input: RefinementUserPromptInput): string {
  const { originalUserPrompt, previousDraft, issues, feedback, axisScores } = input;

  const issueList =
    issues.length > 0
      ? issues.join(", ")
      : "없음";

  return `${originalUserPrompt}

---

## 이전 가안 (재생성 필요)
${previousDraft}

## 지적된 약점
- 5축 점수:
${formatAxisScores(axisScores)}
- 문제 코드: ${issueList}
- 피드백: ${feedback || "없음"}

## 개선 지시
- 위 약점을 구체적으로 해결하여 재작성하세요.
- 기존 강점(키워드·주제·길이)은 유지하세요.
- 원본 대비 품질이 반드시 향상되어야 합니다.`;
}
