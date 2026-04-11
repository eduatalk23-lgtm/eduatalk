// ============================================
// Phase 9.1c — 루브릭 질문 역매핑 유틸리티
// evidence_summary 텍스트에서 루브릭 질문을 추출하여
// COMPETENCY_RUBRIC_QUESTIONS 배열 인덱스로 매핑
// ============================================

import { COMPETENCY_RUBRIC_QUESTIONS } from "./constants";
import type { CompetencyItemCode, CompetencyGrade } from "./types";

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

// ============================================
// 루브릭 등급 → 항목 등급 산출 (Bottom-Up)
// ============================================

const GRADE_TO_NUM: Record<string, number> = {
  "A+": 5, "A-": 4, "B+": 3, "B": 2, "B-": 1, "C": 0,
};
const NUM_TO_GRADE: CompetencyGrade[] = ["C", "B-", "B", "B+", "A-", "A+"];

/**
 * 루브릭 질문별 등급에서 항목 종합 등급을 산출한다.
 * 평균 후 반올림 (표준 반올림).
 * @returns 루브릭 점수가 없으면 null
 */
export function deriveItemGradeFromRubrics(
  rubricScores: { grade: CompetencyGrade }[],
): CompetencyGrade | null {
  if (rubricScores.length === 0) return null;
  const sum = rubricScores.reduce((s, r) => s + (GRADE_TO_NUM[r.grade] ?? 2), 0);
  const avg = sum / rubricScores.length;
  const rounded = Math.round(avg);
  return NUM_TO_GRADE[Math.max(0, Math.min(5, rounded))];
}

/** 등급을 수치로 변환 (외부에서 비교·정렬용) */
export function gradeToNum(grade: string): number {
  return GRADE_TO_NUM[grade] ?? 2;
}

// ============================================
// 다중 레코드 루브릭 집계 (공유 유틸리티)
// pipeline.ts + CompetencyAnalysisSection.tsx 공용
// ============================================

import { COMPETENCY_ITEMS } from "./constants";
import type { CompetencyArea } from "./types";

interface CompetencyGradeInput {
  item: string;
  grade: string;
  reasoning?: string;
  rubricScores?: { questionIndex: number; grade: string; reasoning: string }[];
  /** Phase 0: 이 등급을 산출한 원본 레코드 ID */
  sourceRecordId?: string;
}

export interface AggregatedItemGrade {
  item: string;
  area: CompetencyArea;
  finalGrade: CompetencyGrade;
  rubricScores: { questionIndex: number; grade: CompetencyGrade; reasoning: string }[] | null;
  recordCount: number;
  method: "rubric" | "vote";
  /** Phase 0: 집계에 기여한 원본 레코드 ID 배열 */
  sourceRecordIds?: string[];
}

/**
 * 다중 레코드의 competencyGrades를 집계하여 항목별 최종 등급을 산출.
 * 루브릭이 있으면 질문별 최고 등급 → 항목 등급 산출 (bottom-up).
 * 없으면 기존 최빈값 로직 (폴백).
 */
export function aggregateCompetencyGrades(
  allGrades: CompetencyGradeInput[],
): AggregatedItemGrade[] {
  const rubricCollector = new Map<string, Map<number, { grade: string; reasoning: string }[]>>();
  const gradeVotes = new Map<string, Map<string, number>>();
  // Phase 0: 항목별 기여 레코드 ID 수집
  const sourceRecordCollector = new Map<string, Set<string>>();

  for (const g of allGrades) {
    if (!gradeVotes.has(g.item)) gradeVotes.set(g.item, new Map());
    const votes = gradeVotes.get(g.item)!;
    votes.set(g.grade, (votes.get(g.grade) ?? 0) + 1);

    // Phase 0: sourceRecordId 수집
    if (g.sourceRecordId) {
      if (!sourceRecordCollector.has(g.item)) sourceRecordCollector.set(g.item, new Set());
      sourceRecordCollector.get(g.item)!.add(g.sourceRecordId);
    }

    if (g.rubricScores && g.rubricScores.length > 0) {
      if (!rubricCollector.has(g.item)) rubricCollector.set(g.item, new Map());
      const itemMap = rubricCollector.get(g.item)!;
      for (const rs of g.rubricScores) {
        if (!itemMap.has(rs.questionIndex)) itemMap.set(rs.questionIndex, []);
        itemMap.get(rs.questionIndex)!.push(rs);
      }
    }
  }

  const results: AggregatedItemGrade[] = [];
  const allItems = new Set([...rubricCollector.keys(), ...gradeVotes.keys()]);

  for (const item of allItems) {
    const areaObj = COMPETENCY_ITEMS.find((i) => i.code === item);
    if (!areaObj) continue;

    const questionMap = rubricCollector.get(item);
    const sourceRecordIds = [...(sourceRecordCollector.get(item) ?? [])];

    if (questionMap && questionMap.size > 0) {
      const aggregated: { questionIndex: number; grade: CompetencyGrade; reasoning: string }[] = [];
      for (const [qIdx, entries] of questionMap) {
        const best = entries.reduce((a, b) =>
          gradeToNum(a.grade) >= gradeToNum(b.grade) ? a : b,
        );
        aggregated.push({ questionIndex: qIdx, grade: best.grade as CompetencyGrade, reasoning: best.reasoning });
      }
      results.push({
        item,
        area: areaObj.area as CompetencyArea,
        finalGrade: deriveItemGradeFromRubrics(aggregated) ?? "B",
        rubricScores: aggregated,
        recordCount: questionMap.size,
        method: "rubric",
        sourceRecordIds: sourceRecordIds.length > 0 ? sourceRecordIds : undefined,
      });
    } else {
      const votes = gradeVotes.get(item)!;
      let bestGrade = "B";
      let bestCount = 0;
      for (const [grade, count] of votes) {
        if (count > bestCount || (count === bestCount && gradeToNum(grade) > gradeToNum(bestGrade))) {
          bestGrade = grade;
          bestCount = count;
        }
      }
      results.push({
        item,
        area: areaObj.area as CompetencyArea,
        finalGrade: bestGrade as CompetencyGrade,
        rubricScores: null,
        recordCount: bestCount,
        method: "vote",
        sourceRecordIds: sourceRecordIds.length > 0 ? sourceRecordIds : undefined,
      });
    }
  }

  return results;
}

// ============================================
// 교과 이수/성취도 함수는 course-adequacy.ts로 이동 (S8-b)
// 호환을 위한 re-export
// ============================================

export {
  computeCourseEffortGrades,
  computeCourseAchievementGrades,
  type GradedSubject,
} from "./course-adequacy";
