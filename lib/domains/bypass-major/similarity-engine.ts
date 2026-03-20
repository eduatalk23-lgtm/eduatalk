// ============================================================
// 교육과정 유사도 계산 엔진
//
// Jaccard similarity 기반 — 정규화된 과목명으로 비교
// 참고: lib/domains/student-record/course-adequacy.ts 정규화 패턴
// ============================================================

export interface SimilarityResult {
  departmentA: string;
  departmentB: string;
  overlapScore: number; // 0-100 (비가중)
  sharedCourses: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  totalCoursesA: number;
  totalCoursesB: number;
}

// ------------------------------------
// 가중치 Jaccard 타입 + 상수
// ------------------------------------

export interface CourseWithType {
  courseName: string;
  courseType: string | null;
}

export interface WeightedSimilarityResult extends SimilarityResult {
  weightedOverlapScore: number; // 가중치 Jaccard 0-100
  sharedCoursesDetail: { name: string; courseType: string | null; weight: number }[];
}

/** 과목 유형별 가중치 — 전공필수가 가장 중요 */
export const COURSE_TYPE_WEIGHTS: Record<string, number> = {
  "전공필수": 3.0,
  "전공핵심": 2.5,
  "전공기초": 2.0,
  "전공선택": 1.5,
  "교양필수": 1.0,
  "교직": 0.5,
};
export const DEFAULT_COURSE_TYPE_WEIGHT = 0.5;

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

// ============================================================
// 가중치 Jaccard — course_type 기반 가중치 적용
// ============================================================

function getCourseWeight(courseType: string | null): number {
  if (!courseType) return DEFAULT_COURSE_TYPE_WEIGHT;
  return COURSE_TYPE_WEIGHTS[courseType] ?? DEFAULT_COURSE_TYPE_WEIGHT;
}

/**
 * 가중치 Jaccard 유사도 계산
 *
 * 공통 과목에 가중치를 부여하여 전공필수 겹침이 교양 겹침보다 높게 반영됨.
 * 비가중 Jaccard(overlapScore)도 함께 반환하여 하위호환 유지.
 */
export function calculateWeightedCurriculumSimilarity(
  coursesA: CourseWithType[],
  coursesB: CourseWithType[],
): WeightedSimilarityResult {
  // 정규화 맵: normalized → { original, courseType }
  const mapA = new Map<string, { original: string; courseType: string | null }>();
  for (const c of coursesA) {
    const normalized = normalizeCourseNameForComparison(c.courseName);
    if (normalized && !mapA.has(normalized)) {
      mapA.set(normalized, { original: c.courseName, courseType: c.courseType });
    }
  }

  const mapB = new Map<string, { original: string; courseType: string | null }>();
  for (const c of coursesB) {
    const normalized = normalizeCourseNameForComparison(c.courseName);
    if (normalized && !mapB.has(normalized)) {
      mapB.set(normalized, { original: c.courseName, courseType: c.courseType });
    }
  }

  const shared: string[] = [];
  const sharedDetail: { name: string; courseType: string | null; weight: number }[] = [];
  const uniqueToA: string[] = [];
  const uniqueToB: string[] = [];

  let sharedWeightSum = 0;
  let totalWeightSum = 0;

  for (const [normalized, entryA] of mapA) {
    const entryB = mapB.get(normalized);
    if (entryB) {
      shared.push(entryA.original);
      // 공통 과목: 양쪽 가중치 중 큰 값 사용 (전공필수 쪽이 우세)
      const weight = Math.max(
        getCourseWeight(entryA.courseType),
        getCourseWeight(entryB.courseType),
      );
      sharedDetail.push({ name: entryA.original, courseType: entryA.courseType, weight });
      sharedWeightSum += weight;
      totalWeightSum += weight;
    } else {
      uniqueToA.push(entryA.original);
      totalWeightSum += getCourseWeight(entryA.courseType);
    }
  }

  for (const [normalized, entryB] of mapB) {
    if (!mapA.has(normalized)) {
      uniqueToB.push(entryB.original);
      totalWeightSum += getCourseWeight(entryB.courseType);
    }
  }

  const unionSize = mapA.size + mapB.size - shared.length;
  const overlapScore =
    unionSize > 0 ? Math.round((shared.length / unionSize) * 1000) / 10 : 0;
  const weightedOverlapScore =
    totalWeightSum > 0
      ? Math.round((sharedWeightSum / totalWeightSum) * 1000) / 10
      : 0;

  return {
    departmentA: "",
    departmentB: "",
    overlapScore,
    weightedOverlapScore,
    sharedCourses: shared.sort(),
    sharedCoursesDetail: sharedDetail.sort((a, b) => b.weight - a.weight),
    uniqueToA: uniqueToA.sort(),
    uniqueToB: uniqueToB.sort(),
    totalCoursesA: mapA.size,
    totalCoursesB: mapB.size,
  };
}
