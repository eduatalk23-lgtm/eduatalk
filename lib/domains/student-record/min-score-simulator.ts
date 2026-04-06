// ============================================
// 수능최저 시뮬레이션 엔진
// 모평 점수 기반 수능최저 충족 여부 + what-if 시나리오
// 순수 계산 함수 — DB 의존 없음, client/server safe
// ============================================

import type { MinScoreCriteria, MinScoreSimulationResult } from "./types";

/**
 * 단일 목표에 대한 수능최저 충족 시뮬레이션
 *
 * @param criteria - 최저 조건 (type, subjects, count, maxSum, additional)
 * @param grades - 현재 등급 { "국어": 1, "수학": 3, "영어": 2, ... }
 * @returns 충족 여부 + 등급합 + gap + bottleneck
 */
export function simulateMinScore(
  criteria: MinScoreCriteria,
  grades: Record<string, number>,
): Omit<MinScoreSimulationResult, "targetId" | "universityName" | "department"> {
  // 최저 없음
  if (criteria.type === "none") {
    return {
      isMet: true,
      actualGrades: grades,
      gradeSum: null,
      gap: 0,
      bottleneckSubjects: [],
      whatIf: {},
    };
  }

  // 단일 등급 조건
  if (criteria.type === "single_grade") {
    const bottleneck: string[] = [];
    let isMet = true;
    for (const add of criteria.additional) {
      const g = grades[add.subject];
      if (g === undefined || (add.maxGrade !== undefined && g > add.maxGrade)) {
        isMet = false;
        bottleneck.push(add.subject);
      }
    }
    return {
      isMet,
      actualGrades: grades,
      gradeSum: null,
      gap: 0,
      bottleneckSubjects: bottleneck,
      whatIf: {},
    };
  }

  // 등급합 조건 (grade_sum) — 가장 일반적
  if (criteria.count <= 0) {
    return { isMet: false, actualGrades: grades, gradeSum: null, gap: null, bottleneckSubjects: [], whatIf: {} };
  }

  const availableGrades = criteria.subjects
    .map(s => ({ subject: s, grade: grades[s] }))
    .filter(sg => sg.grade !== undefined)
    .sort((a, b) => a.grade - b.grade);

  // N개 선택 (최소 등급합 조합)
  const selected = availableGrades.slice(0, criteria.count);

  // 선택 가능한 과목이 요구 수보다 부족하면 충족 불가
  if (selected.length < criteria.count) {
    const missing = criteria.subjects.filter(s => grades[s] === undefined);
    return {
      isMet: false,
      actualGrades: grades,
      gradeSum: selected.reduce((sum, sg) => sum + sg.grade, 0),
      gap: null,
      bottleneckSubjects: missing,
      whatIf: {},
    };
  }

  const gradeSum = selected.reduce((sum, sg) => sum + sg.grade, 0);
  const gap = criteria.maxSum - gradeSum; // 양수=여유, 음수=미달

  // 추가 조건 체크 (한국사 등)
  const additionalFailures: string[] = [];
  for (const add of criteria.additional) {
    const g = grades[add.subject];
    if (g === undefined) {
      additionalFailures.push(add.subject);
    } else if (add.maxGrade !== undefined && g > add.maxGrade) {
      additionalFailures.push(add.subject);
    }
  }

  const isMet = gap >= 0 && additionalFailures.length === 0;

  // bottleneck: 미달 원인 과목 (등급합에서 가장 높은 등급)
  const bottleneck: string[] = [...additionalFailures];
  if (gap < 0) {
    // 선택된 과목 중 등급이 가장 높은(나쁜) 것이 bottleneck
    const worst = [...selected].sort((a, b) => b.grade - a.grade);
    bottleneck.push(...worst.slice(0, Math.min(2, worst.length)).map(w => w.subject));
  }

  // what-if: 각 과목 1등급 개선 시
  const whatIf: Record<string, { isMet: boolean; newSum: number }> = {};
  for (const sg of selected) {
    if (sg.grade > 1) {
      const improved = { ...grades, [sg.subject]: sg.grade - 1 };
      const result = simulateMinScore(criteria, improved);
      whatIf[`if_${sg.subject}_${sg.grade - 1}`] = {
        isMet: result.isMet,
        newSum: result.gradeSum ?? 0,
      };
    }
  }

  return {
    isMet,
    actualGrades: grades,
    gradeSum,
    gap,
    bottleneckSubjects: [...new Set(bottleneck)],
    whatIf,
  };
}

/**
 * 과목별 영향도 분석
 * "수학이 2등급이 되면 몇 개 대학 최저를 추가 충족하는가?"
 */
export function analyzeSubjectImpact(
  targets: { criteria: MinScoreCriteria }[],
  currentGrades: Record<string, number>,
  targetSubject: string,
  improvedGrade: number,
): { currentMet: number; afterMet: number; additionalMet: number } {
  const improvedGrades = { ...currentGrades, [targetSubject]: improvedGrade };

  let currentMet = 0;
  let afterMet = 0;
  for (const target of targets) {
    if (simulateMinScore(target.criteria, currentGrades).isMet) currentMet++;
    if (simulateMinScore(target.criteria, improvedGrades).isMet) afterMet++;
  }

  return {
    currentMet,
    afterMet,
    additionalMet: afterMet - currentMet,
  };
}
