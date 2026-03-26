/**
 * 모의고사 도메인 상수
 *
 * 한국 수능/모의고사 시스템의 시험 유형, 월, 교과군 채점 규칙 등
 * 도메인 전반에서 공유되는 상수를 중앙 관리합니다.
 */

// ── 시험 유형 ──────────────────────────────

export const MOCK_EXAM_TYPES = ["평가원", "교육청", "사설"] as const;
export type MockExamType = (typeof MOCK_EXAM_TYPES)[number];

// ── 시험 월 (3~11월) ──────────────────────────

export const MOCK_EXAM_MONTHS = [
  "3", "4", "5", "6", "7", "8", "9", "10", "11",
] as const;
export type MockExamMonth = (typeof MOCK_EXAM_MONTHS)[number];

// ── 탭 UI용 옵션 배열 ──────────────────────────

export const MOCK_EXAM_TYPE_OPTIONS = MOCK_EXAM_TYPES.map((v) => ({
  value: v,
  label: v,
}));

export const MOCK_EXAM_MONTH_OPTIONS = MOCK_EXAM_MONTHS.map((v) => ({
  value: v,
  label: `${v}월`,
}));

// ── 교과군 분류 ──────────────────────────────

/** 내신용 교과군 */
export const SCHOOL_SUBJECT_GROUPS = [
  "국어", "수학", "영어", "사회", "과학",
] as const;

/** 모의고사용 교과군 (탐구 = 사회+과학) */
export const MOCK_SUBJECT_GROUPS = [
  "국어", "수학", "영어", "탐구",
] as const;

// ── 교과군별 채점 규칙 ──────────────────────────

/** 등급만 입력 (표준점수/백분위 없음) */
export const GRADE_ONLY_GROUPS = ["영어", "한국사"] as const;

/** 과목 선택 필요 (탐구 세부과목) */
export const SUBJECT_SELECTION_GROUPS = ["사회", "과학"] as const;

/** 수학 선택과목이 있는 교과군 */
export const MATH_VARIANT_GROUP = "수학" as const;

// ── 헬퍼 함수 ──────────────────────────────

/** 표준점수/백분위 입력이 불필요한 교과군인지 (영어, 한국사) */
export function isGradeOnlyGroup(groupName: string): boolean {
  return (GRADE_ONLY_GROUPS as readonly string[]).includes(groupName);
}

/** 세부 과목 선택이 필요한 교과군인지 (사회, 과학) */
export function needsSubjectSelection(groupName: string): boolean {
  return (SUBJECT_SELECTION_GROUPS as readonly string[]).includes(groupName);
}

/** 수학 교과군인지 (수학 선택과목 필드 표시용) */
export function isMathGroup(groupName: string): boolean {
  return groupName === MATH_VARIANT_GROUP;
}

// ── 수학 선택과목 (admission 엔진에서 재수출) ──────────

export { MATH_VARIANTS } from "@/lib/domains/admission/calculator/constants";
