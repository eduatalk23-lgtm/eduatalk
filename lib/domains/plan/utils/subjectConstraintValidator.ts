/**
 * Subject Constraint Validator
 *
 * P2 구현: 플랜 생성 시 subject_constraints 검증
 *
 * 검증 로직:
 * - 제외 과목(excluded_subjects) 포함 시: 에러 (strict 모드에서 차단)
 * - 필수 과목(required_subjects) 미포함 시: 경고 (생성은 허용)
 *
 * @module lib/domains/plan/utils/subjectConstraintValidator
 */

import type { SubjectConstraints, RequiredSubject } from "@/lib/types/plan/domain";

/**
 * 콘텐츠 메타데이터 (검증에 필요한 최소 정보)
 */
export type ContentMetadataForValidation = {
  contentId: string;
  title?: string | null;
  subject?: string | null;
  subject_category?: string | null;
};

/**
 * 제약 조건 위반 상세 정보
 */
export type ConstraintViolation = {
  type: "excluded" | "missing_required";
  contentId?: string;
  contentTitle?: string | null;
  subject?: string | null;
  subject_category?: string | null;
  message: string;
};

/**
 * 검증 결과
 */
export type SubjectConstraintValidationResult = {
  isValid: boolean;
  hasWarnings: boolean;
  errors: ConstraintViolation[];
  warnings: ConstraintViolation[];
  summary: {
    totalContents: number;
    excludedContents: number;
    missingRequiredSubjects: string[];
  };
};

/**
 * 콘텐츠가 제외 과목에 해당하는지 확인
 */
function isContentExcluded(
  content: ContentMetadataForValidation,
  excludedSubjects: string[]
): boolean {
  if (!excludedSubjects || excludedSubjects.length === 0) {
    return false;
  }

  // subject_category 또는 subject가 제외 목록에 있는지 확인
  const subjectCategory = content.subject_category?.toLowerCase();
  const subject = content.subject?.toLowerCase();

  return excludedSubjects.some((excluded) => {
    const excludedLower = excluded.toLowerCase();
    return subjectCategory === excludedLower || subject === excludedLower;
  });
}

/**
 * 필수 과목 충족 여부 확인
 */
function checkRequiredSubjects(
  contents: ContentMetadataForValidation[],
  requiredSubjects: RequiredSubject[]
): { satisfied: RequiredSubject[]; unsatisfied: RequiredSubject[] } {
  const satisfied: RequiredSubject[] = [];
  const unsatisfied: RequiredSubject[] = [];

  for (const required of requiredSubjects) {
    const matchingCount = contents.filter((content) => {
      const subjectCategory = content.subject_category?.toLowerCase();
      const subject = content.subject?.toLowerCase();
      const requiredCategory = required.subject_category.toLowerCase();
      const requiredSubject = required.subject?.toLowerCase();

      // 교과 카테고리 일치
      if (subjectCategory !== requiredCategory) {
        return false;
      }

      // 세부 과목 지정된 경우 추가 검증
      if (requiredSubject && subject !== requiredSubject) {
        return false;
      }

      return true;
    }).length;

    if (matchingCount >= required.min_count) {
      satisfied.push(required);
    } else {
      unsatisfied.push(required);
    }
  }

  return { satisfied, unsatisfied };
}

/**
 * subject_constraints 검증 수행
 *
 * @param contents - 검증할 콘텐츠 메타데이터 목록
 * @param constraints - 플랜 그룹의 subject_constraints
 * @returns 검증 결과 (에러, 경고, 요약)
 */
export function validateSubjectConstraints(
  contents: ContentMetadataForValidation[],
  constraints: SubjectConstraints | null | undefined
): SubjectConstraintValidationResult {
  const result: SubjectConstraintValidationResult = {
    isValid: true,
    hasWarnings: false,
    errors: [],
    warnings: [],
    summary: {
      totalContents: contents.length,
      excludedContents: 0,
      missingRequiredSubjects: [],
    },
  };

  // 제약 조건이 없으면 검증 패스
  if (!constraints) {
    return result;
  }

  // 1. 제외 과목 검증 (에러)
  if (constraints.excluded_subjects && constraints.excluded_subjects.length > 0) {
    for (const content of contents) {
      if (isContentExcluded(content, constraints.excluded_subjects)) {
        result.summary.excludedContents++;

        const violation: ConstraintViolation = {
          type: "excluded",
          contentId: content.contentId,
          contentTitle: content.title,
          subject: content.subject,
          subject_category: content.subject_category,
          message: `제외된 과목 포함: ${content.subject || content.subject_category} (콘텐츠: ${content.title || content.contentId})`,
        };

        // constraint_handling에 따라 에러 또는 경고 처리
        if (constraints.constraint_handling === "strict") {
          result.errors.push(violation);
          result.isValid = false;
        } else {
          result.warnings.push(violation);
          result.hasWarnings = true;
        }
      }
    }
  }

  // 2. 필수 과목 검증 (경고)
  if (constraints.required_subjects && constraints.required_subjects.length > 0) {
    const { unsatisfied } = checkRequiredSubjects(contents, constraints.required_subjects);

    for (const required of unsatisfied) {
      const subjectName = required.subject
        ? `${required.subject_category}/${required.subject}`
        : required.subject_category;

      result.summary.missingRequiredSubjects.push(subjectName);

      const violation: ConstraintViolation = {
        type: "missing_required",
        subject: required.subject,
        subject_category: required.subject_category,
        message: `필수 과목 부족: ${subjectName} (최소 ${required.min_count}개 필요)`,
      };

      // 필수 과목 부족은 항상 경고 (strict 모드에서도 차단하지 않음)
      result.warnings.push(violation);
      result.hasWarnings = true;
    }
  }

  return result;
}

/**
 * 검증 결과를 로그 메시지로 포맷팅
 */
export function formatValidationResultForLog(
  result: SubjectConstraintValidationResult
): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push(`[ERRORS] ${result.errors.length}개의 제약 조건 위반:`);
    for (const error of result.errors) {
      lines.push(`  - ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push(`[WARNINGS] ${result.warnings.length}개의 경고:`);
    for (const warning of result.warnings) {
      lines.push(`  - ${warning.message}`);
    }
  }

  if (lines.length === 0) {
    return "모든 제약 조건 충족";
  }

  return lines.join("\n");
}

/**
 * 검증 결과를 사용자 친화적 메시지로 변환
 */
export function getValidationErrorMessage(
  result: SubjectConstraintValidationResult
): string | null {
  if (result.isValid) {
    return null;
  }

  if (result.errors.length === 0) {
    return null;
  }

  const excludedCount = result.summary.excludedContents;
  if (excludedCount > 0) {
    const excludedSubjects = result.errors
      .filter((e) => e.type === "excluded")
      .map((e) => e.subject || e.subject_category)
      .filter((s, i, arr) => arr.indexOf(s) === i) // unique
      .join(", ");

    return `제외된 과목(${excludedSubjects})이 포함된 콘텐츠 ${excludedCount}개가 있습니다. 해당 콘텐츠를 제거하거나 제약 조건을 수정해주세요.`;
  }

  return "과목 제약 조건을 충족하지 못했습니다.";
}
