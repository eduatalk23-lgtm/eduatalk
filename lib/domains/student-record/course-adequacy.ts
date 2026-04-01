// ============================================
// 교과 이수 적합도 규칙 엔진
// Phase 5 — AI 불필요, 결정론적 계산
//
// 입력: 학생 이수 과목 목록 + 목표 전공 + 학교 개설 과목
// 출력: 적합도 점수 + 이수/미이수 분류 + 안내 메시지
// ============================================

import { getMajorRecommendedCourses } from "./constants";
import type { CourseAdequacyResult } from "./types";
import { normalizeSubjectName } from "@/lib/domains/subject/normalize";

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
