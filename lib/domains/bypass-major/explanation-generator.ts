// ============================================================
// "왜 이 학과인가" 근거 텍스트 생성
// 순수 함수 — 서버/클라이언트 모두 사용 가능
// ============================================================

export interface ExplanationInput {
  targetDeptName: string;
  candidateDeptName: string;
  candidateUnivName: string;
  curriculumSimilarity: number | null;
  sharedCourseCount: number;
  topSharedCourses: string[];
  placementGrade: string | null;
  competencyFitScore: number | null;
  competencyHighlights: string[];
}

const PLACEMENT_LABELS: Record<string, string> = {
  safe: "안정",
  possible: "적정",
  bold: "소신",
  unstable: "불안정",
  danger: "위험",
};

/**
 * 3필터 결과를 조합한 구조화된 근거 텍스트 생성
 */
export function generateExplanation(input: ExplanationInput): string {
  const parts: string[] = [];

  // 1. 커리큘럼 유사도
  if (input.curriculumSimilarity != null && input.sharedCourseCount > 0) {
    const topCourses = input.topSharedCourses.slice(0, 5).join(", ");
    parts.push(
      `교육과정 유사도 ${input.curriculumSimilarity}%: ${input.targetDeptName}과(와) ${topCourses} 등 ${input.sharedCourseCount}개 공통 과목`,
    );
  }

  // 2. 배치 판정
  if (input.placementGrade) {
    const label = PLACEMENT_LABELS[input.placementGrade] ?? input.placementGrade;
    parts.push(`배치 판정: ${label}`);
  }

  // 3. 역량 적합도
  if (input.competencyFitScore != null) {
    let line = `역량 적합도 ${input.competencyFitScore}점`;
    if (input.competencyHighlights.length > 0) {
      line += ` (강점: ${input.competencyHighlights.join(", ")})`;
    }
    parts.push(line);
  }

  return parts.join("\n");
}
