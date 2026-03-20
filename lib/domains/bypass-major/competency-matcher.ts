// ============================================================
// 역량 적합도 계산 — 학생 역량 등급 × 계열별 가중치
// ============================================================

import type { CompetencyItemCode } from "@/lib/domains/student-record/types";
import {
  CLASSIFICATION_TO_CAREER_FIELD,
  CAREER_FIELD_COMPETENCY_WEIGHTS,
  DEFAULT_COMPETENCY_WEIGHTS,
  GRADE_TO_SCORE,
} from "./constants";

interface CompetencyScoreInput {
  competency_item: string;
  grade_value: string;
}

/**
 * 학과의 mid_classification → 계열 key 변환
 */
export function resolveCareerField(midClassification: string | null): string | null {
  if (!midClassification) return null;
  return CLASSIFICATION_TO_CAREER_FIELD[midClassification] ?? null;
}

/**
 * 역량 적합도 점수 계산 (0-100)
 *
 * 학생의 10개 역량 등급에 계열별 가중치를 적용한 가중 평균.
 * 의학·약학이면 학업성취도에 1.8배 가중, 컴퓨터·정보면 탐구력에 1.8배 가중 등.
 */
export function calculateCompetencyFitScore(
  competencyScores: CompetencyScoreInput[],
  careerField: string | null,
): number | null {
  if (competencyScores.length === 0) return null;

  const weights = careerField
    ? CAREER_FIELD_COMPETENCY_WEIGHTS[careerField] ?? DEFAULT_COMPETENCY_WEIGHTS
    : DEFAULT_COMPETENCY_WEIGHTS;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const score of competencyScores) {
    const itemCode = score.competency_item as CompetencyItemCode;
    const weight = weights[itemCode] ?? 1.0;
    const numeric = GRADE_TO_SCORE[score.grade_value];
    if (numeric != null) {
      weightedSum += numeric * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
}

/**
 * 가장 높은 역량 항목 추출 (근거 텍스트용)
 */
export function getTopCompetencyItems(
  competencyScores: CompetencyScoreInput[],
  careerField: string | null,
  topN = 3,
): string[] {
  const weights = careerField
    ? CAREER_FIELD_COMPETENCY_WEIGHTS[careerField] ?? DEFAULT_COMPETENCY_WEIGHTS
    : DEFAULT_COMPETENCY_WEIGHTS;

  const ITEM_LABELS: Record<string, string> = {
    academic_achievement: "학업성취도",
    academic_attitude: "학업태도",
    academic_inquiry: "탐구력",
    career_course_effort: "과목이수노력",
    career_course_achievement: "과목성취도",
    career_exploration: "진로탐색",
    community_collaboration: "협업",
    community_caring: "배려",
    community_integrity: "성실성",
    community_leadership: "리더십",
  };

  return competencyScores
    .map((s) => {
      const weight = weights[s.competency_item as CompetencyItemCode] ?? 1.0;
      const numeric = GRADE_TO_SCORE[s.grade_value] ?? 0;
      return { item: s.competency_item, score: numeric * weight };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => ITEM_LABELS[s.item] ?? s.item);
}
