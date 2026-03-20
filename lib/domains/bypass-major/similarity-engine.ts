// ============================================================
// 교육과정 유사도 계산 엔진
//
// Jaccard similarity 기반 — 정규화된 과목명으로 비교
// 참고: lib/domains/student-record/course-adequacy.ts 정규화 패턴
// ============================================================

export interface SimilarityResult {
  departmentA: string;
  departmentB: string;
  overlapScore: number; // 0-100
  sharedCourses: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  totalCoursesA: number;
  totalCoursesB: number;
}

/**
 * 과목명 정규화 — 비교용
 *
 * 공백/특수문자 차이, 로마 숫자 등 흡수.
 * course-adequacy.ts의 normalizeSubjectName 패턴 재사용.
 */
export function normalizeCourseNameForComparison(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/[·‧・]/g, "·")
    .replace(/Ⅰ/g, "1")
    .replace(/Ⅱ/g, "2")
    .replace(/\(.*?\)/g, "") // 괄호 내용 제거
    .replace(/[()[\]]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Jaccard similarity 기반 교육과정 유사도 계산
 *
 * @param coursesA - 학과 A 교육과정 과목명 목록
 * @param coursesB - 학과 B 교육과정 과목명 목록
 * @returns 유사도 결과 (0-100 점수 + 공통/고유 과목 목록)
 */
export function calculateCurriculumSimilarity(
  coursesA: string[],
  coursesB: string[],
): SimilarityResult {
  // 정규화 맵 구축 (정규화명 → 원본명)
  const mapA = new Map<string, string>();
  for (const c of coursesA) {
    const normalized = normalizeCourseNameForComparison(c);
    if (normalized && !mapA.has(normalized)) {
      mapA.set(normalized, c);
    }
  }

  const mapB = new Map<string, string>();
  for (const c of coursesB) {
    const normalized = normalizeCourseNameForComparison(c);
    if (normalized && !mapB.has(normalized)) {
      mapB.set(normalized, c);
    }
  }

  const setA = new Set(mapA.keys());
  const setB = new Set(mapB.keys());

  // 교집합 / 합집합
  const shared: string[] = [];
  const uniqueToA: string[] = [];
  const uniqueToB: string[] = [];

  for (const [normalized, original] of mapA) {
    if (setB.has(normalized)) {
      shared.push(original);
    } else {
      uniqueToA.push(original);
    }
  }

  for (const [normalized, original] of mapB) {
    if (!setA.has(normalized)) {
      uniqueToB.push(original);
    }
  }

  const unionSize = setA.size + setB.size - shared.length;
  const overlapScore =
    unionSize > 0 ? Math.round((shared.length / unionSize) * 1000) / 10 : 0;

  return {
    departmentA: "",
    departmentB: "",
    overlapScore,
    sharedCourses: shared.sort(),
    uniqueToA: uniqueToA.sort(),
    uniqueToB: uniqueToB.sort(),
    totalCoursesA: mapA.size,
    totalCoursesB: mapB.size,
  };
}
