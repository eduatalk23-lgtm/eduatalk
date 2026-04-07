// ============================================
// 교과 이수 적합도 규칙 엔진
// Phase 5 — AI 불필요, 결정론적 계산
//
// 입력: 학생 이수 과목 목록 + 목표 전공 + 학교 개설 과목
// 출력: 적합도 점수 + 이수/미이수 분류 + 안내 메시지
// ============================================

import { getMajorRecommendedCourses, LEARNING_SEQUENCE_CHAINS } from "./constants";
import type { CourseAdequacyResult } from "./types";
import type { CompetencyGrade } from "./types";
import { normalizeSubjectName } from "@/lib/domains/subject/normalize";
import { deriveItemGradeFromRubrics } from "./rubric-matcher";

/** 과목명 세트 생성 (정규화 기반 비교용) */
function buildNameSet(names: string[]): Set<string> {
  return new Set(names.map(normalizeSubjectName));
}

/**
 * 교과 이수 적합도 계산
 *
 * @param majorCategory - 전공 계열 (MAJOR_RECOMMENDED_COURSES 키)
 * @param takenSubjects - 학생이 이수한 과목명 목록
 * @param offeredSubjects - 학교에서 개설한 과목명 목록 (null이면 필터링 안 함)
 * @param curriculumYear - 교육과정 연도 (2015 또는 2022, 기본 2015)
 */
export function calculateCourseAdequacy(
  majorCategory: string,
  takenSubjects: string[],
  offeredSubjects: string[] | null,
  curriculumYear?: number,
): CourseAdequacyResult | null {
  // 항상 getMajorRecommendedCourses 사용 (curriculumYear 미전달 시 내부에서 2015 기본)
  const recommended = getMajorRecommendedCourses(majorCategory, curriculumYear);
  if (!recommended) return null;

  const takenSet = buildNameSet(takenSubjects);
  const offeredSet = offeredSubjects ? buildNameSet(offeredSubjects) : null;

  const fusionCourses = "fusion" in recommended && recommended.fusion
    ? recommended.fusion as string[]
    : [];

  const allRecommended = [
    ...recommended.general.map((s) => ({ name: s, type: "general" as const })),
    ...recommended.career.map((s) => ({ name: s, type: "career" as const })),
    ...fusionCourses.map((s) => ({ name: s, type: "fusion" as const })),
  ];

  const taken: string[] = [];
  const notTaken: string[] = [];
  const notOffered: string[] = [];

  let generalTaken = 0;
  let generalAvailable = 0;
  let careerTaken = 0;
  let careerAvailable = 0;
  let fusionTaken = 0;
  let fusionAvailable = 0;

  for (const rec of allRecommended) {
    const normalized = normalizeSubjectName(rec.name);

    // 학교 미개설 과목은 분모에서 제외
    if (offeredSet && !offeredSet.has(normalized)) {
      notOffered.push(rec.name);
      continue;
    }

    if (rec.type === "general") generalAvailable++;
    else if (rec.type === "career") careerAvailable++;
    else fusionAvailable++;

    if (takenSet.has(normalized)) {
      taken.push(rec.name);
      if (rec.type === "general") generalTaken++;
      else if (rec.type === "career") careerTaken++;
      else fusionTaken++;
    } else {
      notTaken.push(rec.name);
    }
  }

  const totalAvailable = generalAvailable + careerAvailable + fusionAvailable;
  const totalTaken = taken.length;
  const score = totalAvailable > 0
    ? Math.round((totalTaken / totalAvailable) * 100)
    : 0;

  const generalRate = generalAvailable > 0
    ? Math.round((generalTaken / generalAvailable) * 100)
    : 0;
  const careerRate = careerAvailable > 0
    ? Math.round((careerTaken / careerAvailable) * 100)
    : 0;
  const fusionRate = fusionAvailable > 0
    ? Math.round((fusionTaken / fusionAvailable) * 100)
    : null;

  return {
    score,
    majorCategory,
    totalRecommended: allRecommended.length,
    totalAvailable,
    taken,
    notTaken,
    notOffered,
    generalRate,
    careerRate,
    fusionRate,
  };
}

// ============================================
// 교과 이수/성취도 결정론적 산정 (S8-b: rubric-matcher에서 이동)
// AI 추측 대신 실제 데이터(이수율+성적)로 평가
// ============================================

/** 학년별 이수 정보 */
export interface GradedSubject {
  subjectName: string;
  grade: number;
  semester: number;
}

interface CompetencyGradeInput {
  item: string;
  grade: string;
  rubricScores: { questionIndex: number; grade: string; reasoning: string }[];
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
 * 학습단계 이수 순서 검증
 * @returns { score: 0~100, violations: 위반 목록 }
 */
function evaluateLearningSequence(
  takenSubjects: GradedSubject[],
): { score: number; violations: string[] } {
  const subjectTiming = new Map<string, number>();
  for (const s of takenSubjects) {
    const norm = normalizeSubjectName(s.subjectName);
    const timing = s.grade * 10 + s.semester;
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
    if (prereqTime == null || followupTime == null) continue;
    checkedChains++;
    if (followupTime < prereqTime) {
      violations.push(`${prereq} → ${followup}`);
    }
  }

  if (checkedChains === 0) return { score: -1, violations: [] };
  const correctRate = ((checkedChains - violations.length) / checkedChains) * 100;
  return { score: Math.round(correctRate), violations };
}

/**
 * career_course_effort (교과 이수 노력) 결정론적 산정
 */
export function computeCourseEffortGrades(
  courseAdequacy: CourseAdequacyResult,
  gradedSubjects?: GradedSubject[],
): CompetencyGradeInput {
  const rubricScores: { questionIndex: number; grade: string; reasoning: string }[] = [];

  // Q0
  const overallGrade = scoreToGrade(courseAdequacy.score);
  rubricScores.push({
    questionIndex: 0,
    grade: overallGrade,
    reasoning: `전공 추천 과목 ${courseAdequacy.taken.length}/${courseAdequacy.totalAvailable}개 이수 (${courseAdequacy.score}%)`,
  });

  // Q1
  const careerGrade = scoreToGrade(courseAdequacy.careerRate);
  rubricScores.push({
    questionIndex: 1,
    grade: careerGrade,
    reasoning: `진로선택 이수율 ${courseAdequacy.careerRate}%`,
  });

  // Q2
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
 */
export function computeCourseAchievementGrades(
  taken: string[],
  scores: Array<{ subjectName: string; rankGrade: number; grade?: number; semester?: number }>,
  courseAdequacy?: CourseAdequacyResult,
): CompetencyGradeInput {
  const rubricScores: { questionIndex: number; grade: string; reasoning: string }[] = [];

  const relevantScores = scores.filter((s) =>
    taken.some((t) => t === s.subjectName),
  );

  if (relevantScores.length === 0) {
    rubricScores.push({ questionIndex: 0, grade: "B", reasoning: "전공 관련 과목 성적 데이터 없음 (기본값)" });
    rubricScores.push({ questionIndex: 1, grade: "B", reasoning: "일반/진로선택 비교 데이터 없음 (기본값)" });
    rubricScores.push({ questionIndex: 2, grade: "B", reasoning: "학기별 추이 데이터 없음 (기본값)" });
    return { item: "career_course_achievement", grade: "B", rubricScores };
  }

  // Q0: 전공 관련 과목 성취수준
  const avgRank = relevantScores.reduce((s, r) => s + r.rankGrade, 0) / relevantScores.length;
  const achievementGrade = rankGradeToCompetencyGrade(avgRank);
  rubricScores.push({
    questionIndex: 0,
    grade: achievementGrade,
    reasoning: `전공 관련 ${relevantScores.length}과목 평균 ${avgRank.toFixed(1)}등급`,
  });

  // Q1: 일반선택 대비 진로선택 성취수준
  if (courseAdequacy) {
    const recommended = getMajorRecommendedCourses(courseAdequacy.majorCategory);
    if (recommended) {
      const generalSet = new Set(recommended.general.map(normalizeSubjectName));
      const careerSet = new Set(recommended.career.map(normalizeSubjectName));
      const generalScores = relevantScores.filter((s) => generalSet.has(normalizeSubjectName(s.subjectName)));
      const careerScores = relevantScores.filter((s) => careerSet.has(normalizeSubjectName(s.subjectName)));

      if (generalScores.length > 0 && careerScores.length > 0) {
        const generalAvg = generalScores.reduce((s, r) => s + r.rankGrade, 0) / generalScores.length;
        const careerAvg = careerScores.reduce((s, r) => s + r.rankGrade, 0) / careerScores.length;
        const comparisonGrade = rankGradeToCompetencyGrade(careerAvg);
        const delta = generalAvg - careerAvg;
        const reasoning = delta >= 0
          ? `진로선택 ${careerAvg.toFixed(1)}등급 ≤ 일반선택 ${generalAvg.toFixed(1)}등급 (우수)`
          : `진로선택 ${careerAvg.toFixed(1)}등급 > 일반선택 ${generalAvg.toFixed(1)}등급 (${Math.abs(delta).toFixed(1)}등급 차)`;
        rubricScores.push({ questionIndex: 1, grade: comparisonGrade, reasoning });
      } else {
        rubricScores.push({ questionIndex: 1, grade: achievementGrade, reasoning: `일반선택 ${generalScores.length}개, 진로선택 ${careerScores.length}개 (한쪽 부재 → 전체 평균)` });
      }
    } else {
      rubricScores.push({ questionIndex: 1, grade: achievementGrade, reasoning: "추천 과목 데이터 없음 (전체 평균)" });
    }
  } else {
    rubricScores.push({ questionIndex: 1, grade: achievementGrade, reasoning: "일반/진로선택 성취 비교 (전체 평균 기준)" });
  }

  // Q2: 학기별 성적 추이 (S8-c)
  const trendResult = computeSemesterTrend(relevantScores);
  rubricScores.push(trendResult);

  return {
    item: "career_course_achievement",
    grade: deriveItemGradeFromRubrics(rubricScores.map((r) => ({ grade: r.grade as CompetencyGrade }))) ?? "B",
    rubricScores,
  };
}

/**
 * Q2: 전공 관련 과목 성적이 학기별로 향상/유지되고 있는가?
 * 학기별 평균 등급의 추이를 분석하여 성장/유지/하락 판정
 */
function computeSemesterTrend(
  scores: Array<{ subjectName: string; rankGrade: number; grade?: number; semester?: number }>,
): { questionIndex: number; grade: string; reasoning: string } {
  // 학기 정보가 있는 점수만 필터
  const withSemester = scores.filter((s) => s.grade != null && s.semester != null);

  if (withSemester.length < 2) {
    return { questionIndex: 2, grade: "B", reasoning: "학기별 추이 분석에 충분한 데이터 없음 (기본값)" };
  }

  // 학기별 그룹핑 → 평균 등급
  const semesterAvgs = new Map<string, { sum: number; count: number }>();
  for (const s of withSemester) {
    const key = `${s.grade}-${s.semester}`;
    const existing = semesterAvgs.get(key) ?? { sum: 0, count: 0 };
    existing.sum += s.rankGrade;
    existing.count++;
    semesterAvgs.set(key, existing);
  }

  // 시간순 정렬 (1-1, 1-2, 2-1, 2-2, 3-1)
  const sorted = [...semesterAvgs.entries()]
    .map(([key, { sum, count }]) => ({
      key,
      avg: sum / count,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  if (sorted.length < 2) {
    return { questionIndex: 2, grade: "B", reasoning: "비교 가능한 학기가 1개뿐 (기본값)" };
  }

  // 추이 판정: 마지막 학기 vs 첫 학기 (등급은 숫자 작을수록 좋음)
  const firstAvg = sorted[0].avg;
  const lastAvg = sorted[sorted.length - 1].avg;
  const delta = firstAvg - lastAvg; // 양수 = 등급 향상 (1등급→2등급이면 lastAvg가 더 큼 = delta 음수)

  // 연속 하락 감지
  let consecutiveDecline = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].avg > sorted[i - 1].avg + 0.3) {
      consecutiveDecline++;
    }
  }

  let trendGrade: CompetencyGrade;
  let reasoning: string;

  if (delta > 0.5) {
    // 뚜렷한 향상 (등급 숫자 감소 = 성적 향상)
    trendGrade = "A+";
    reasoning = `${sorted[0].key}학기 ${firstAvg.toFixed(1)}등급 → ${sorted[sorted.length - 1].key}학기 ${lastAvg.toFixed(1)}등급 (${delta.toFixed(1)}등급 향상)`;
  } else if (delta > 0) {
    trendGrade = "A-";
    reasoning = `소폭 향상 (${delta.toFixed(1)}등급)`;
  } else if (delta > -0.3) {
    trendGrade = "B+";
    reasoning = `유지 수준 (변동 ${Math.abs(delta).toFixed(1)}등급 이내)`;
  } else if (consecutiveDecline >= 2) {
    trendGrade = "C";
    reasoning = `연속 하락 ${consecutiveDecline}학기, ${sorted[0].key}학기 ${firstAvg.toFixed(1)} → ${sorted[sorted.length - 1].key}학기 ${lastAvg.toFixed(1)}등급`;
  } else {
    trendGrade = "B-";
    reasoning = `하락 추세 (${Math.abs(delta).toFixed(1)}등급 하락)`;
  }

  return { questionIndex: 2, grade: trendGrade, reasoning };
}
