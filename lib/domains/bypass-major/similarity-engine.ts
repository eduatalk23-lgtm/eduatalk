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

import { normalizeSubjectName as _normalizeSubject } from "@/lib/domains/subject/normalize";

/**
 * 과목명 정규화 — 비교용
 *
 * 공백/특수문자 차이, 로마 숫자 등 흡수.
 * 단일 정본: lib/domains/subject/normalize.ts
 */
export const normalizeCourseNameForComparison = _normalizeSubject;

/**
 * 느슨한 정규화 — 교육과정 유사도 비교 전용
 *
 * 기본 정규화 + 끝자리 아라비아 숫자 제거.
 * "회로이론1" → "회로이론", "전자회로2" → "전자회로"
 * enrichment(웹검색) vs import(Access DB) 간 과목명 차이 흡수.
 */
export function normalizeCourseFuzzy(name: string): string {
  const base = _normalizeSubject(name);
  // 끝자리 숫자 제거 (단, 전체가 숫자인 경우 제외)
  const stripped = base.replace(/\d+$/, "") || base;
  // 동의어 정규화
  return SYNONYM_MAP.get(stripped) ?? stripped;
}

/**
 * 과목명 동의어 맵 — 대학마다 다른 이름으로 부르는 동일 과목 통합.
 * key: normalizeCourseFuzzy 적용 후의 이름, value: 정규 이름
 */
const SYNONYM_ENTRIES: [string[], string][] = [
  // 회로 계열
  [["전기회로", "회로이론", "기초회로이론", "회로이론및실험", "전기회로및실험"], "회로이론"],
  // 전자기학 계열
  [["전기자기학", "전자기학", "전자장론", "전자물리학"], "전자기학"],
  // 전자회로 계열
  [["전자회로", "아날로그전자회로", "기초전자회로"], "전자회로"],
  // 신호/시스템 계열
  [["신호처리", "신호및시스템", "신호와시스템", "선형시스템", "신호시스템"], "신호및시스템"],
  // 디지털 계열
  [["디지털회로", "디지털논리회로", "디지털회로설계", "논리회로", "디지털논리설계", "디지털시스템", "디지털논리회로및실험"], "디지털논리회로"],
  // 제어 계열
  [["제어공학", "자동제어", "제어공학기초", "자동제어개론", "선형제어시스템"], "제어공학"],
  // 반도체 계열
  [["반도체공학", "반도체소자", "물리전자", "물리전자공학", "고체전자물리"], "반도체공학"],
  // 통신 계열
  [["통신이론", "통신공학", "통신시스템", "통신공학개론", "데이터통신기초"], "통신이론"],
  // 프로그래밍 계열
  [["프로그래밍", "프로그래밍응용", "컴퓨터프로그래밍", "프로그래밍기초와실습", "c프로그래밍", "프로그래밍기초", "공학컴퓨터프로그래밍", "객체지향프로그래밍"], "프로그래밍"],
  // 자료구조 계열
  [["자료구조", "데이터구조", "자료구조와알고리즘", "자료구조및알고리즘"], "자료구조"],
  // 운영체제 계열
  [["운영체제", "운영체제입문", "운영체제및시스템프로그래밍"], "운영체제"],
  // 컴퓨터구조 계열
  [["컴퓨터구조", "컴퓨터구조론", "컴퓨터아키텍쳐", "임베디드컴퓨터구조"], "컴퓨터구조"],
  // 마이크로프로세서 계열
  [["마이크로프로세서", "마이크로프로세서응용", "마이크로프로세서응용실험"], "마이크로프로세서"],
  // 수학 계열
  [["미적분학", "미분적분학", "미적분", "미분적분학및연습"], "미적분학"],
  [["선형대수학", "선형대수", "선형대수학및연습", "전산선형대수학"], "선형대수학"],
  [["확률및통계", "확률과통계", "확률및랜덤변수", "확률및랜덤프로세스"], "확률및통계"],
  [["수치해석", "공학수치해석"], "수치해석"],
  // 물리 계열
  [["일반물리학", "일반물리", "물리학", "대학물리학"], "일반물리학"],
  [["일반화학", "일반화학및실험"], "일반화학"],
  // 전력 계열
  [["전력시스템", "전력시스템공학", "전력계통", "전력계통공학"], "전력시스템"],
  [["전력전자", "전력전자공학", "전력전자공학및설계", "기초전력전자공학"], "전력전자"],
  // 임베디드 계열
  [["임베디드시스템", "임베디드시스템설계", "임베디드시스템프로그래밍"], "임베디드시스템"],
  // AI 계열
  [["인공지능", "인공지능개론", "기초인공지능", "기초머신러닝", "기계학습개론", "머신러닝"], "인공지능"],
  [["딥러닝", "딥러닝개론", "딥러닝입문", "인공신경망"], "딥러닝"],
  // 영상/비전
  [["영상처리", "디지털영상처리", "디지털영상처리개론", "컴퓨터비전"], "영상처리"],
];

const SYNONYM_MAP = new Map<string, string>();
for (const [aliases, canonical] of SYNONYM_ENTRIES) {
  for (const alias of aliases) {
    SYNONYM_MAP.set(alias, canonical);
  }
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
  // 느슨한 정규화 맵 구축 (정규화명 → 원본명)
  const mapA = new Map<string, string>();
  for (const c of coursesA) {
    const normalized = normalizeCourseFuzzy(c);
    if (normalized && !mapA.has(normalized)) {
      mapA.set(normalized, c);
    }
  }

  const mapB = new Map<string, string>();
  for (const c of coursesB) {
    const normalized = normalizeCourseFuzzy(c);
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
  // 느슨한 정규화 맵: normalized → { original, courseType }
  const mapA = new Map<string, { original: string; courseType: string | null }>();
  for (const c of coursesA) {
    const normalized = normalizeCourseFuzzy(c.courseName);
    if (normalized && !mapA.has(normalized)) {
      mapA.set(normalized, { original: c.courseName, courseType: c.courseType });
    }
  }

  const mapB = new Map<string, { original: string; courseType: string | null }>();
  for (const c of coursesB) {
    const normalized = normalizeCourseFuzzy(c.courseName);
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
  const jaccardScore =
    unionSize > 0 ? Math.round((shared.length / unionSize) * 1000) / 10 : 0;
  const weightedJaccard =
    totalWeightSum > 0
      ? Math.round((sharedWeightSum / totalWeightSum) * 1000) / 10
      : 0;

  // Target recall 보정: target 과목이 소량(enrichment 등)일 때 Jaccard가 구조적으로 불리하므로
  // target 과목 중 매칭 비율(recall)을 동적 가중으로 병행하여 최종 점수 산출
  // 가중치: target 5과목 이하 → 0.4, 10과목 → 0.55, 20+ → 0.7 (선형 보간)
  const smallerSize = Math.min(mapA.size, mapB.size);
  const recallWeight = Math.min(0.7, Math.max(0.4, 0.4 + (smallerSize - 5) * 0.02));
  const targetRecall = smallerSize > 0
    ? Math.round((shared.length / smallerSize) * 1000) / 10
    : 0;
  const recallAdjusted = Math.round(targetRecall * recallWeight * 10) / 10;
  const weightedOverlapScore = Math.max(weightedJaccard, recallAdjusted);
  const overlapScore = Math.max(jaccardScore, recallAdjusted);

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
