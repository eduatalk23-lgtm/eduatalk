// ============================================
// 공통과목 자동 시드 상수
//
// 모든 계열 공통으로 이수하는 1학년 과목을 교육과정별로 정의한다.
// `generateAndSaveRecommendations` 가 진로 기반 선택과목 추천과 별개로
// 이 목록을 1학년 `recommended` plan 으로 시드한다.
//
// 2022 개정: 공통국어1/2 처럼 학기 분리된 과목이 명시됨 → 학기별 1행.
// 2015 개정: 전 학년 단위 과목(국어, 수학 등) → 1학기/2학기 각각 1행.
// ============================================

export interface CommonCourseSeed {
  name: string;
  grade: number;
  semester: number;
}

/** 2022 개정 1학년 공통과목 (DB subjects 테이블의 name 과 일치) */
export const COMMON_COURSES_2022: CommonCourseSeed[] = [
  { name: "공통국어1", grade: 1, semester: 1 },
  { name: "공통국어2", grade: 1, semester: 2 },
  { name: "공통수학1", grade: 1, semester: 1 },
  { name: "공통수학2", grade: 1, semester: 2 },
  { name: "공통영어1", grade: 1, semester: 1 },
  { name: "공통영어2", grade: 1, semester: 2 },
  { name: "한국사1", grade: 1, semester: 1 },
  { name: "한국사2", grade: 1, semester: 2 },
  { name: "통합사회1", grade: 1, semester: 1 },
  { name: "통합사회2", grade: 1, semester: 2 },
  { name: "통합과학1", grade: 1, semester: 1 },
  { name: "통합과학2", grade: 1, semester: 2 },
  { name: "과학탐구실험1", grade: 1, semester: 1 },
  { name: "과학탐구실험2", grade: 1, semester: 2 },
];

/** 2015 개정 1학년 공통과목 (학년 단위 과목 → 두 학기 모두 시드) */
export const COMMON_COURSES_2015: CommonCourseSeed[] = [
  { name: "국어", grade: 1, semester: 1 },
  { name: "국어", grade: 1, semester: 2 },
  { name: "수학", grade: 1, semester: 1 },
  { name: "수학", grade: 1, semester: 2 },
  { name: "영어", grade: 1, semester: 1 },
  { name: "영어", grade: 1, semester: 2 },
  { name: "한국사", grade: 1, semester: 1 },
  { name: "한국사", grade: 1, semester: 2 },
  { name: "통합사회", grade: 1, semester: 1 },
  { name: "통합사회", grade: 1, semester: 2 },
  { name: "통합과학", grade: 1, semester: 1 },
  { name: "통합과학", grade: 1, semester: 2 },
  { name: "과학탐구실험", grade: 1, semester: 1 },
  { name: "과학탐구실험", grade: 1, semester: 2 },
];

export function getCommonCourseSeeds(curriculumYear?: number): CommonCourseSeed[] {
  return curriculumYear === 2022 ? COMMON_COURSES_2022 : COMMON_COURSES_2015;
}
