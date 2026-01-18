/**
 * 콜드 스타트 배치 처리 대상 정의
 *
 * 사전 크롤링할 교과/과목/난이도/콘텐츠타입 조합을 정의합니다.
 */

import type { BatchTarget, BatchPreset } from "./types";

/**
 * 핵심 교과/과목 조합 (우선순위 높음)
 *
 * 수능 필수 과목 및 주요 선택 과목 위주
 */
export const CORE_TARGETS: BatchTarget[] = [
  // ─────────────────────────────────────────────────────
  // 국어 (필수)
  // ─────────────────────────────────────────────────────
  { subjectCategory: "국어", subject: "국어", contentType: "book" },
  { subjectCategory: "국어", subject: "문학", contentType: "book" },
  { subjectCategory: "국어", subject: "독서", contentType: "book" },
  { subjectCategory: "국어", subject: "문학", contentType: "lecture" },

  // ─────────────────────────────────────────────────────
  // 수학 (필수 + 주요 선택)
  // ─────────────────────────────────────────────────────
  { subjectCategory: "수학", subject: "수학", contentType: "book" },
  { subjectCategory: "수학", subject: "수학I", contentType: "book" },
  { subjectCategory: "수학", subject: "수학II", contentType: "book" },
  { subjectCategory: "수학", subject: "미적분", contentType: "book" },
  { subjectCategory: "수학", subject: "확률과 통계", contentType: "book" },
  { subjectCategory: "수학", subject: "기하", contentType: "book" },
  { subjectCategory: "수학", subject: "미적분", contentType: "lecture" },
  { subjectCategory: "수학", subject: "수학I", contentType: "lecture" },

  // ─────────────────────────────────────────────────────
  // 영어 (필수)
  // ─────────────────────────────────────────────────────
  { subjectCategory: "영어", subject: "영어", contentType: "book" },
  { subjectCategory: "영어", subject: "영어I", contentType: "book" },
  { subjectCategory: "영어", subject: "영어 독해와 작문", contentType: "book" },
  { subjectCategory: "영어", subject: "영어", contentType: "lecture" },

  // ─────────────────────────────────────────────────────
  // 한국사 (필수)
  // ─────────────────────────────────────────────────────
  { subjectCategory: "한국사", subject: "한국사", contentType: "book" },
  { subjectCategory: "한국사", subject: "한국사", contentType: "lecture" },

  // ─────────────────────────────────────────────────────
  // 탐구 영역 핵심 (인기 선택 과목)
  // ─────────────────────────────────────────────────────
  // 사회탐구
  { subjectCategory: "사회", subject: "생활과 윤리", contentType: "book" },
  { subjectCategory: "사회", subject: "사회문화", contentType: "book" },

  // 과학탐구
  { subjectCategory: "과학", subject: "생명과학I", contentType: "book" },
  { subjectCategory: "과학", subject: "지구과학I", contentType: "book" },
];

/**
 * 수학 전체 조합
 */
export const MATH_TARGETS: BatchTarget[] = [
  // 교재
  { subjectCategory: "수학", subject: "수학", difficulty: "개념", contentType: "book" },
  { subjectCategory: "수학", subject: "수학", difficulty: "기본", contentType: "book" },
  { subjectCategory: "수학", subject: "수학", difficulty: "심화", contentType: "book" },
  { subjectCategory: "수학", subject: "수학I", difficulty: "개념", contentType: "book" },
  { subjectCategory: "수학", subject: "수학I", difficulty: "기본", contentType: "book" },
  { subjectCategory: "수학", subject: "수학I", difficulty: "심화", contentType: "book" },
  { subjectCategory: "수학", subject: "수학II", difficulty: "개념", contentType: "book" },
  { subjectCategory: "수학", subject: "수학II", difficulty: "기본", contentType: "book" },
  { subjectCategory: "수학", subject: "수학II", difficulty: "심화", contentType: "book" },
  { subjectCategory: "수학", subject: "미적분", difficulty: "개념", contentType: "book" },
  { subjectCategory: "수학", subject: "미적분", difficulty: "기본", contentType: "book" },
  { subjectCategory: "수학", subject: "미적분", difficulty: "심화", contentType: "book" },
  { subjectCategory: "수학", subject: "확률과 통계", difficulty: "개념", contentType: "book" },
  { subjectCategory: "수학", subject: "확률과 통계", difficulty: "기본", contentType: "book" },
  { subjectCategory: "수학", subject: "기하", difficulty: "개념", contentType: "book" },
  { subjectCategory: "수학", subject: "기하", difficulty: "기본", contentType: "book" },
  // 강의
  { subjectCategory: "수학", subject: "수학I", contentType: "lecture" },
  { subjectCategory: "수학", subject: "수학II", contentType: "lecture" },
  { subjectCategory: "수학", subject: "미적분", contentType: "lecture" },
  { subjectCategory: "수학", subject: "확률과 통계", contentType: "lecture" },
  { subjectCategory: "수학", subject: "기하", contentType: "lecture" },
];

/**
 * 영어 전체 조합
 */
export const ENGLISH_TARGETS: BatchTarget[] = [
  { subjectCategory: "영어", subject: "영어", difficulty: "개념", contentType: "book" },
  { subjectCategory: "영어", subject: "영어", difficulty: "기본", contentType: "book" },
  { subjectCategory: "영어", subject: "영어", difficulty: "심화", contentType: "book" },
  { subjectCategory: "영어", subject: "영어I", difficulty: "개념", contentType: "book" },
  { subjectCategory: "영어", subject: "영어I", difficulty: "기본", contentType: "book" },
  { subjectCategory: "영어", subject: "영어II", difficulty: "기본", contentType: "book" },
  { subjectCategory: "영어", subject: "영어 독해와 작문", difficulty: "기본", contentType: "book" },
  { subjectCategory: "영어", subject: "영어", contentType: "lecture" },
  { subjectCategory: "영어", subject: "영어I", contentType: "lecture" },
  { subjectCategory: "영어", subject: "영어II", contentType: "lecture" },
];

/**
 * 과학탐구 전체 조합
 */
export const SCIENCE_TARGETS: BatchTarget[] = [
  // 통합과학
  { subjectCategory: "과학", subject: "통합과학", contentType: "book" },
  // 물리학
  { subjectCategory: "과학", subject: "물리학I", difficulty: "개념", contentType: "book" },
  { subjectCategory: "과학", subject: "물리학I", difficulty: "기본", contentType: "book" },
  { subjectCategory: "과학", subject: "물리학II", difficulty: "기본", contentType: "book" },
  { subjectCategory: "과학", subject: "물리학I", contentType: "lecture" },
  // 화학
  { subjectCategory: "과학", subject: "화학I", difficulty: "개념", contentType: "book" },
  { subjectCategory: "과학", subject: "화학I", difficulty: "기본", contentType: "book" },
  { subjectCategory: "과학", subject: "화학II", difficulty: "기본", contentType: "book" },
  { subjectCategory: "과학", subject: "화학I", contentType: "lecture" },
  // 생명과학
  { subjectCategory: "과학", subject: "생명과학I", difficulty: "개념", contentType: "book" },
  { subjectCategory: "과학", subject: "생명과학I", difficulty: "기본", contentType: "book" },
  { subjectCategory: "과학", subject: "생명과학II", difficulty: "기본", contentType: "book" },
  { subjectCategory: "과학", subject: "생명과학I", contentType: "lecture" },
  // 지구과학
  { subjectCategory: "과학", subject: "지구과학I", difficulty: "개념", contentType: "book" },
  { subjectCategory: "과학", subject: "지구과학I", difficulty: "기본", contentType: "book" },
  { subjectCategory: "과학", subject: "지구과학II", difficulty: "기본", contentType: "book" },
  { subjectCategory: "과학", subject: "지구과학I", contentType: "lecture" },
];

/**
 * 전체 조합 (모든 주요 교과/과목)
 */
export const ALL_TARGETS: BatchTarget[] = [
  ...CORE_TARGETS,
  // 국어 추가
  { subjectCategory: "국어", subject: "화법과 작문", contentType: "book" },
  { subjectCategory: "국어", subject: "언어와 매체", contentType: "book" },
  // 수학 추가 (CORE에 없는 것)
  ...MATH_TARGETS.filter(
    (t) => !CORE_TARGETS.some((c) => c.subject === t.subject && c.contentType === t.contentType)
  ),
  // 영어 추가
  ...ENGLISH_TARGETS.filter(
    (t) => !CORE_TARGETS.some((c) => c.subject === t.subject && c.contentType === t.contentType)
  ),
  // 사회탐구 추가
  { subjectCategory: "사회", subject: "통합사회", contentType: "book" },
  { subjectCategory: "사회", subject: "한국지리", contentType: "book" },
  { subjectCategory: "사회", subject: "세계지리", contentType: "book" },
  { subjectCategory: "사회", subject: "동아시아사", contentType: "book" },
  { subjectCategory: "사회", subject: "세계사", contentType: "book" },
  { subjectCategory: "사회", subject: "경제", contentType: "book" },
  { subjectCategory: "사회", subject: "정치와 법", contentType: "book" },
  { subjectCategory: "사회", subject: "윤리와 사상", contentType: "book" },
  // 과학탐구 추가
  ...SCIENCE_TARGETS.filter(
    (t) => !CORE_TARGETS.some((c) => c.subject === t.subject && c.contentType === t.contentType)
  ),
];

/**
 * 프리셋에 따른 대상 목록 반환
 */
export function getTargetsForPreset(preset: BatchPreset): BatchTarget[] {
  switch (preset) {
    case "all":
      return ALL_TARGETS;
    case "core":
      return CORE_TARGETS;
    case "math":
      return MATH_TARGETS;
    case "english":
      return ENGLISH_TARGETS;
    case "science":
      return SCIENCE_TARGETS;
    case "custom":
      return [];
    default:
      return CORE_TARGETS;
  }
}

/**
 * 대상 조합을 문자열로 변환 (로깅용)
 */
export function targetToString(target: BatchTarget): string {
  const parts = [target.subjectCategory];
  if (target.subject) parts.push(target.subject);
  if (target.difficulty) parts.push(`(${target.difficulty})`);
  if (target.contentType) parts.push(`[${target.contentType}]`);
  return parts.join(" > ");
}
