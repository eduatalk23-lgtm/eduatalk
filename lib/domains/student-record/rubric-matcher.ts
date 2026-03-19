// ============================================
// Phase 9.1c — 루브릭 질문 역매핑 유틸리티
// evidence_summary 텍스트에서 루브릭 질문을 추출하여
// COMPETENCY_RUBRIC_QUESTIONS 배열 인덱스로 매핑
// ============================================

import { COMPETENCY_RUBRIC_QUESTIONS } from "./constants";
import type { CompetencyItemCode } from "./types";

/**
 * evidence_summary에서 "루브릭: ..." 텍스트를 추출
 */
export function extractRubricQuestion(
  evidenceSummary: string | null,
): string | null {
  if (!evidenceSummary) return null;
  const match = evidenceSummary.match(/루브릭:\s*(.+?)$/m);
  return match?.[1]?.trim() ?? null;
}

/**
 * 루브릭 질문 텍스트를 해당 competencyItem의 질문 인덱스로 매핑
 * @returns 0-based index, 매칭 실패 시 -1
 */
export function findRubricQuestionIndex(
  competencyItem: string,
  questionText: string,
): number {
  const questions =
    COMPETENCY_RUBRIC_QUESTIONS[competencyItem as CompetencyItemCode];
  if (!questions) return -1;

  // 1. 정확 매칭
  const exactIdx = questions.findIndex((q) => q === questionText);
  if (exactIdx >= 0) return exactIdx;

  // 2. 접두사 매칭 (AI가 질문을 약간 잘라서 반환할 수 있음)
  const prefixIdx = questions.findIndex(
    (q) =>
      q.startsWith(questionText.slice(0, 15)) ||
      questionText.startsWith(q.slice(0, 15)),
  );
  if (prefixIdx >= 0) return prefixIdx;

  // 3. 포함 매칭
  const containIdx = questions.findIndex(
    (q) => q.includes(questionText) || questionText.includes(q),
  );
  if (containIdx >= 0) return containIdx;

  return -1;
}

/** 질문별 태그 집계 결과 */
export interface RubricQuestionStat {
  questionIndex: number;
  questionText: string;
  positive: number;
  negative: number;
  needsReview: number;
  evidences: string[];
}

/**
 * 특정 역량 항목의 활동 태그를 질문별로 집계
 */
export function aggregateTagsByQuestion(
  competencyItem: string,
  tags: {
    competency_item: string;
    evaluation: string;
    evidence_summary: string | null;
  }[],
): RubricQuestionStat[] {
  const questions =
    COMPETENCY_RUBRIC_QUESTIONS[competencyItem as CompetencyItemCode];
  if (!questions) return [];

  // 초기화
  const stats: RubricQuestionStat[] = questions.map((q, i) => ({
    questionIndex: i,
    questionText: q,
    positive: 0,
    negative: 0,
    needsReview: 0,
    evidences: [],
  }));

  // 미매칭 태그용 (질문에 배정 안 된 것)
  const unmatchedTags: typeof tags = [];

  for (const tag of tags) {
    if (tag.competency_item !== competencyItem) continue;

    const rubricQ = extractRubricQuestion(tag.evidence_summary);
    let idx = -1;

    if (rubricQ) {
      idx = findRubricQuestionIndex(competencyItem, rubricQ);
    }

    if (idx >= 0) {
      const stat = stats[idx];
      if (tag.evaluation === "positive") stat.positive++;
      else if (tag.evaluation === "negative") stat.negative++;
      else stat.needsReview++;
      if (tag.evidence_summary) {
        // "루브릭:" 이전 텍스트만 (reasoning + 근거)
        const cleaned = tag.evidence_summary
          .replace(/^\[AI\]\s*/, "")
          .replace(/\n루브릭:.*$/m, "")
          .trim();
        if (cleaned) stat.evidences.push(cleaned);
      }
    } else {
      unmatchedTags.push(tag);
    }
  }

  // 미매칭 태그는 첫 번째 질문에 "기타"로 배정하지 않음 (무시)
  // → Report에서는 항목별 총계와 질문별 합계를 별도 표시

  return stats;
}
