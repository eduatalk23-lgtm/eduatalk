/**
 * Task 1: 사용자 입력 검증
 *
 * 이 파일은 사용자가 선택한 교과/과목/난이도/타입을 검증합니다.
 *
 * 📥 INPUT:  사용자가 입력한 값 (문자열)
 * 📤 OUTPUT: 검증된 입력값 또는 에러 메시지
 *
 * 검증 규칙:
 * 1. 교과(subjectCategory)는 필수
 * 2. 교과는 지원하는 목록에 있어야 함
 * 3. 과목은 해당 교과에 속해야 함 (선택사항)
 * 4. 난이도는 지원하는 목록에 있어야 함 (선택사항)
 * 5. 콘텐츠 타입은 book 또는 lecture (선택사항)
 */

import {
  type ColdStartRawInput,
  type ValidateInputResult,
  type ValidatedColdStartInput,
  type SubjectCategory,
  type DifficultyLevel,
  type ContentType,
  SUPPORTED_SUBJECT_CATEGORIES,
  SUBJECTS_BY_CATEGORY,
  DIFFICULTY_LEVELS,
  CONTENT_TYPES,
} from "./types";

/**
 * 콜드 스타트 입력값을 검증합니다.
 *
 * @param input - 사용자가 입력한 원본 값
 * @returns 검증 결과 (성공 시 validatedInput, 실패 시 error)
 *
 * @example
 * // 성공 케이스
 * const result = validateColdStartInput({
 *   subjectCategory: "수학",
 *   subject: "미적분",
 *   difficulty: "개념",
 *   contentType: "book"
 * });
 * // { success: true, validatedInput: { subjectCategory: "수학", ... } }
 *
 * @example
 * // 실패 케이스 - 교과 누락
 * const result = validateColdStartInput({});
 * // { success: false, error: "교과를 선택해주세요" }
 */
export function validateColdStartInput(
  input: ColdStartRawInput
): ValidateInputResult {
  // ────────────────────────────────────────────────────────────────────
  // 1단계: 교과 검증 (필수)
  // ────────────────────────────────────────────────────────────────────

  // 교과가 입력되지 않은 경우
  if (!input.subjectCategory || input.subjectCategory.trim() === "") {
    return {
      success: false,
      error: "교과를 선택해주세요",
    };
  }

  const trimmedCategory = input.subjectCategory.trim();

  // 지원하는 교과인지 확인
  if (!isValidSubjectCategory(trimmedCategory)) {
    return {
      success: false,
      error: `지원하지 않는 교과입니다: ${trimmedCategory}. 지원 교과: ${SUPPORTED_SUBJECT_CATEGORIES.join(", ")}`,
    };
  }

  const validatedCategory = trimmedCategory as SubjectCategory;

  // ────────────────────────────────────────────────────────────────────
  // 2단계: 과목 검증 (선택)
  // ────────────────────────────────────────────────────────────────────

  let validatedSubject: string | null = null;

  if (input.subject && input.subject.trim() !== "") {
    const trimmedSubject = input.subject.trim();

    // 해당 교과에 속하는 과목인지 확인
    const availableSubjects = SUBJECTS_BY_CATEGORY[validatedCategory];

    if (!availableSubjects.includes(trimmedSubject)) {
      // 과목이 목록에 없어도 일단 허용 (AI가 검색할 수 있음)
      // 단, 경고 로그는 남김
      console.warn(
        `[validateInput] 과목 "${trimmedSubject}"이(가) ${validatedCategory} 교과의 표준 과목 목록에 없습니다. 검색은 계속 진행됩니다.`
      );
    }

    validatedSubject = trimmedSubject;
  }

  // ────────────────────────────────────────────────────────────────────
  // 3단계: 난이도 검증 (선택)
  // ────────────────────────────────────────────────────────────────────

  let validatedDifficulty: DifficultyLevel | null = null;

  if (input.difficulty && input.difficulty.trim() !== "") {
    const trimmedDifficulty = input.difficulty.trim();

    if (!isValidDifficulty(trimmedDifficulty)) {
      return {
        success: false,
        error: `지원하지 않는 난이도입니다: ${trimmedDifficulty}. 지원 난이도: ${DIFFICULTY_LEVELS.join(", ")}`,
      };
    }

    validatedDifficulty = trimmedDifficulty as DifficultyLevel;
  }

  // ────────────────────────────────────────────────────────────────────
  // 4단계: 콘텐츠 타입 검증 (선택)
  // ────────────────────────────────────────────────────────────────────

  let validatedContentType: ContentType | null = null;

  if (input.contentType && input.contentType.trim() !== "") {
    const trimmedContentType = input.contentType.trim().toLowerCase();

    if (!isValidContentType(trimmedContentType)) {
      return {
        success: false,
        error: `지원하지 않는 콘텐츠 타입입니다: ${input.contentType}. 지원 타입: ${CONTENT_TYPES.join(", ")}`,
      };
    }

    validatedContentType = trimmedContentType as ContentType;
  }

  // ────────────────────────────────────────────────────────────────────
  // 5단계: 검증 완료 - 결과 반환
  // ────────────────────────────────────────────────────────────────────

  const validatedInput: ValidatedColdStartInput = {
    subjectCategory: validatedCategory,
    subject: validatedSubject,
    difficulty: validatedDifficulty,
    contentType: validatedContentType,
  };

  return {
    success: true,
    validatedInput,
  };
}

// ============================================================================
// 헬퍼 함수들 (타입 가드)
// ============================================================================

/**
 * 유효한 교과인지 확인하는 타입 가드
 */
function isValidSubjectCategory(value: string): value is SubjectCategory {
  return SUPPORTED_SUBJECT_CATEGORIES.includes(value as SubjectCategory);
}

/**
 * 유효한 난이도인지 확인하는 타입 가드
 */
function isValidDifficulty(value: string): value is DifficultyLevel {
  return DIFFICULTY_LEVELS.includes(value as DifficultyLevel);
}

/**
 * 유효한 콘텐츠 타입인지 확인하는 타입 가드
 */
function isValidContentType(value: string): value is ContentType {
  return CONTENT_TYPES.includes(value as ContentType);
}

// ============================================================================
// 유틸리티 함수들
// ============================================================================

/**
 * 지원하는 교과 목록을 반환합니다.
 * UI에서 드롭다운 옵션을 만들 때 사용할 수 있습니다.
 */
export function getSupportedSubjectCategories(): readonly string[] {
  return SUPPORTED_SUBJECT_CATEGORIES;
}

/**
 * 특정 교과에 속하는 과목 목록을 반환합니다.
 *
 * @param category - 교과명
 * @returns 과목 목록 (교과가 유효하지 않으면 빈 배열)
 */
export function getSubjectsForCategory(category: string): string[] {
  if (!isValidSubjectCategory(category)) {
    return [];
  }
  return SUBJECTS_BY_CATEGORY[category];
}

/**
 * 지원하는 난이도 목록을 반환합니다.
 */
export function getSupportedDifficultyLevels(): readonly string[] {
  return DIFFICULTY_LEVELS;
}

/**
 * 지원하는 콘텐츠 타입 목록을 반환합니다.
 */
export function getSupportedContentTypes(): readonly string[] {
  return CONTENT_TYPES;
}
