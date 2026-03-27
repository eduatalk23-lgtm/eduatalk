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

import { COMPETENCY_ITEMS, getMajorRecommendedCourses } from "./constants";
import type { CompetencyArea } from "./types";

interface CompetencyGradeInput {
  item: string;
  grade: string;
  reasoning?: string;
  rubricScores?: { questionIndex: number; grade: string; reasoning: string }[];
}

export interface AggregatedItemGrade {
  item: string;
  area: CompetencyArea;
  finalGrade: CompetencyGrade;
  rubricScores: { questionIndex: number; grade: CompetencyGrade; reasoning: string }[] | null;
  recordCount: number;
  method: "rubric" | "vote";
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

  for (const g of allGrades) {
    if (!gradeVotes.has(g.item)) gradeVotes.set(g.item, new Map());
    const votes = gradeVotes.get(g.item)!;
    votes.set(g.grade, (votes.get(g.grade) ?? 0) + 1);

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
      });
    }
  }

  return results;
}

// ============================================
// Phase F1: 교과 이수/성취도 결정론적 산정
// AI 추측 대신 실제 데이터(이수율+성적)로 평가
// ============================================

import type { CourseAdequacyResult } from "./types";
import { normalizeSubjectName } from "@/lib/domains/subject/normalize";

/**
 * 교과 학습단계 선수과목 체인 (2015+2022 통합)
 * [선수 과목, 후수 과목] — 선수를 먼저(낮은 학년에) 이수해야 정상
 */
export const LEARNING_SEQUENCE_CHAINS: [string, string][] = [
  // 수학
  ["수학1", "수학2"],
  ["수학2", "미적분"],
  ["수학2", "확률과통계"],
  ["수학2", "기하"],
  ["미적분", "수학과제탐구"],
  ["미적분", "경제수학"],
  ["미적분", "인공지능수학"],
  // 과학
  ["물리학1", "역학과에너지"],
  ["물리학1", "전자기와양자"],
  ["화학1", "화학반응의세계"],
  ["생명과학1", "세포와물질대사"],
  ["생명과학1", "생물다양성과생태"],
  ["지구과학1", "지구시스템과학"],
  // 2022 과학 (1/2 분리 없음 → 선수 관계 유지)
  ["물리학", "역학과에너지"],
  ["물리학", "전자기와양자"],
  ["화학", "화학반응의세계"],
  ["생명과학", "세포와물질대사"],
  ["생명과학", "생물다양성과생태"],
  ["지구과학", "지구시스템과학"],
];

/** 학년별 이수 정보 */
export interface GradedSubject {
  subjectName: string;
  grade: number;   // 1, 2, 3
  semester: number; // 1, 2
}

/**
 * 학습단계 이수 순서 검증
 * @returns { score: 0~100, violations: 위반 목록 }
 */
function evaluateLearningSequence(
  takenSubjects: GradedSubject[],
): { score: number; violations: string[] } {
  // 정규화된 과목명 → 최초 이수 시점 매핑
  const subjectTiming = new Map<string, number>();
  for (const s of takenSubjects) {
    const norm = normalizeSubjectName(s.subjectName);
    const timing = s.grade * 10 + s.semester; // e.g. 1학년 2학기 = 12
    const existing = subjectTiming.get(norm);
    if (existing == null || timing < existing) {
      subjectTiming.set(norm, timing);
    }
  }

  let checkedChains = 0;
  const violations: string[] = [];

  for (const [prereq, followup] of LEARNING_SEQUENCE_CHAINS) {
    const prereqNorm = normalizeSubjectName(prereq);
    const followupNorm = normalizeSubjectName(followup);

    const prereqTime = subjectTiming.get(prereqNorm);
    const followupTime = subjectTiming.get(followupNorm);

    // 둘 다 이수한 경우만 검증 대상
    if (prereqTime == null || followupTime == null) continue;
    checkedChains++;

    // 후수 과목이 선수 과목보다 먼저 이수된 경우만 위반 (동일 학기는 허용)
    if (followupTime < prereqTime) {
      violations.push(`${prereq} → ${followup}`);
    }
  }

  if (checkedChains === 0) return { score: -1, violations: [] }; // 검증 불가
  const correctRate = ((checkedChains - violations.length) / checkedChains) * 100;
  return { score: Math.round(correctRate), violations };
}

/** 이수적합도 점수 → 등급 매핑 */
function scoreToGrade(score: number): CompetencyGrade {
  if (score >= 85) return "A+";
  if (score >= 70) return "A-";
  if (score >= 55) return "B+";
  if (score >= 40) return "B";
  if (score >= 25) return "B-";
  return "C";
}

/** 평균 석차등급 → 역량 등급 매핑 */
function rankGradeToCompetencyGrade(avgRank: number): CompetencyGrade {
  if (avgRank <= 1.5) return "A+";
  if (avgRank <= 2.5) return "A-";
  if (avgRank <= 3.5) return "B+";
  if (avgRank <= 4.5) return "B";
  if (avgRank <= 6.0) return "B-";
  return "C";
}

/**
 * career_course_effort (교과 이수 노력) 결정론적 산정
 * courseAdequacy의 이수율 데이터 기반
 * @param gradedSubjects - 학년/학기별 이수 데이터 (있으면 Q2 학습단계 순서 검증)
 */
export function computeCourseEffortGrades(
  courseAdequacy: CourseAdequacyResult,
  gradedSubjects?: GradedSubject[],
): CompetencyGradeInput {
  const rubricScores: { questionIndex: number; grade: string; reasoning: string }[] = [];

  // Q0: "전공 관련 과목을 적절하게 선택하고 이수한 과목은 얼마나 되는가?"
  const overallGrade = scoreToGrade(courseAdequacy.score);
  rubricScores.push({
    questionIndex: 0,
    grade: overallGrade,
    reasoning: `전공 추천 과목 ${courseAdequacy.taken.length}/${courseAdequacy.totalAvailable}개 이수 (${courseAdequacy.score}%)`,
  });

  // Q1: "이수하기 위하여 추가적인 노력을 하였는가?" → 진로선택 이수율 기반
  const careerGrade = scoreToGrade(courseAdequacy.careerRate);
  rubricScores.push({
    questionIndex: 1,
    grade: careerGrade,
    reasoning: `진로선택 이수율 ${courseAdequacy.careerRate}%`,
  });

  // Q2: "선택과목은 교과목 학습단계에 따라 이수하였는가?"
  if (gradedSubjects && gradedSubjects.length > 0) {
    const seq = evaluateLearningSequence(gradedSubjects);
    if (seq.score >= 0) {
      const seqGrade = scoreToGrade(seq.score);
      const reasoning = seq.violations.length > 0
        ? `학습단계 순서 준수율 ${seq.score}% (위반: ${seq.violations.join(", ")})`
        : `학습단계 순서 100% 준수`;
      rubricScores.push({ questionIndex: 2, grade: seqGrade, reasoning });
    } else {
      rubricScores.push({ questionIndex: 2, grade: "B", reasoning: "학습단계 체인 해당 과목 없음 (기본값)" });
    }
  } else {
    rubricScores.push({ questionIndex: 2, grade: "B", reasoning: "학년별 이수 데이터 없음 (기본값)" });
  }

  return {
    item: "career_course_effort",
    grade: deriveItemGradeFromRubrics(rubricScores.map((r) => ({ grade: r.grade as CompetencyGrade }))) ?? "B",
    rubricScores,
  };
}

/**
 * career_course_achievement (교과 성취도) 결정론적 산정
 * 전공 관련 과목의 실제 성적 기반
 * @param courseAdequacy - 적합도 결과 (general/career 분류용, 없으면 전체 평균 사용)
 */
export function computeCourseAchievementGrades(
  taken: string[],
  scores: Array<{ subjectName: string; rankGrade: number }>,
  courseAdequacy?: CourseAdequacyResult,
): CompetencyGradeInput {
  const rubricScores: { questionIndex: number; grade: string; reasoning: string }[] = [];

  // 전공 관련 과목의 성적만 필터
  const relevantScores = scores.filter((s) =>
    taken.some((t) => t === s.subjectName),
  );

  if (relevantScores.length === 0) {
    rubricScores.push({
      questionIndex: 0,
      grade: "B",
      reasoning: "전공 관련 과목 성적 데이터 없음 (기본값)",
    });
    rubricScores.push({
      questionIndex: 1,
      grade: "B",
      reasoning: "일반/진로선택 비교 데이터 없음 (기본값)",
    });
    return { item: "career_course_achievement", grade: "B", rubricScores };
  }

  // Q0: "전공 관련 과목의 성취수준은 적절한가?" → 평균 석차등급
  const avgRank = relevantScores.reduce((s, r) => s + r.rankGrade, 0) / relevantScores.length;
  const achievementGrade = rankGradeToCompetencyGrade(avgRank);
  rubricScores.push({
    questionIndex: 0,
    grade: achievementGrade,
    reasoning: `전공 관련 ${relevantScores.length}과목 평균 ${avgRank.toFixed(1)}등급`,
  });

  // Q1: "동일 교과 내 일반선택 대비 진로선택 성취수준은?"
  if (courseAdequacy) {
    // constants.ts의 추천 과목 데이터로 general/career 분류
    const recommended = getMajorRecommendedCourses(courseAdequacy.majorCategory);
    if (recommended) {
      const generalSet = new Set(recommended.general.map(normalizeSubjectName));
      const careerSet = new Set(recommended.career.map(normalizeSubjectName));

      const generalScores = relevantScores.filter((s) => generalSet.has(normalizeSubjectName(s.subjectName)));
      const careerScores = relevantScores.filter((s) => careerSet.has(normalizeSubjectName(s.subjectName)));

      if (generalScores.length > 0 && careerScores.length > 0) {
        const generalAvg = generalScores.reduce((s, r) => s + r.rankGrade, 0) / generalScores.length;
        const careerAvg = careerScores.reduce((s, r) => s + r.rankGrade, 0) / careerScores.length;
        // 진로선택이 일반선택보다 같거나 좋으면 좋은 평가
        const comparisonGrade = rankGradeToCompetencyGrade(careerAvg);
        const delta = generalAvg - careerAvg; // 양수면 진로가 더 좋음
        const reasoning = delta >= 0
          ? `진로선택 ${careerAvg.toFixed(1)}등급 ≤ 일반선택 ${generalAvg.toFixed(1)}등급 (우수)`
          : `진로선택 ${careerAvg.toFixed(1)}등급 > 일반선택 ${generalAvg.toFixed(1)}등급 (${Math.abs(delta).toFixed(1)}등급 차)`;
        rubricScores.push({ questionIndex: 1, grade: comparisonGrade, reasoning });
      } else {
        // 한쪽만 있으면 전체 평균 사용
        rubricScores.push({
          questionIndex: 1,
          grade: achievementGrade,
          reasoning: `일반선택 ${generalScores.length}개, 진로선택 ${careerScores.length}개 (한쪽 부재 → 전체 평균)`,
        });
      }
    } else {
      rubricScores.push({ questionIndex: 1, grade: achievementGrade, reasoning: "추천 과목 데이터 없음 (전체 평균)" });
    }
  } else {
    rubricScores.push({ questionIndex: 1, grade: achievementGrade, reasoning: "일반/진로선택 성취 비교 (전체 평균 기준)" });
  }

  return {
    item: "career_course_achievement",
    grade: deriveItemGradeFromRubrics(rubricScores.map((r) => ({ grade: r.grade as CompetencyGrade }))) ?? "B",
    rubricScores,
  };
}
