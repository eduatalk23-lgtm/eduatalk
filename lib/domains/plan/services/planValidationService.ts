/**
 * 플랜 검증 서비스
 *
 * 플랜 생성 과정에서 콘텐츠, 페이로드, 삽입 결과를 검증합니다.
 *
 * @module lib/domains/plan/services/planValidationService
 */

import { isDummyContent } from "@/lib/utils/planUtils";
import type {
  PlanServiceContext,
  ContentResolutionResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  GeneratePlanPayload,
  PlanInsertResult,
  SupabaseAnyClient,
} from "./types";

// ============================================
// PlanValidationService 클래스
// ============================================

/**
 * 플랜 검증 서비스
 *
 * 플랜 생성 전후로 데이터 유효성을 검증합니다.
 */
export class PlanValidationService {
  /**
   * 콘텐츠 해석 결과를 검증합니다.
   */
  validateContentResolution(
    resolution: ContentResolutionResult
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 복사 실패 콘텐츠 경고
    for (const failure of resolution.copyFailures) {
      warnings.push({
        code: "CONTENT_COPY_FAILED",
        message: failure.reason,
        contentId: failure.contentId,
      });
    }

    // 매핑되지 않은 콘텐츠 확인
    const unmappedContents = resolution.resolvedContents.filter(
      (c) =>
        !resolution.contentIdMap.has(c.originalContentId) &&
        !isDummyContent(c.originalContentId)
    );

    if (unmappedContents.length > 0) {
      errors.push({
        code: "UNMAPPED_CONTENTS",
        message: `${unmappedContents.length}개의 콘텐츠가 학생 콘텐츠로 매핑되지 않았습니다.`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 플랜 페이로드를 검증합니다.
   */
  validatePayloads(payloads: GeneratePlanPayload[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (payloads.length === 0) {
      errors.push({
        code: "NO_PAYLOADS",
        message: "저장할 플랜이 없습니다.",
      });
      return { isValid: false, errors, warnings };
    }

    // 필수 필드 검증
    const invalidPayloads = payloads.filter(
      (p) =>
        !p.plan_group_id ||
        !p.student_id ||
        !p.tenant_id ||
        !p.content_id ||
        !p.plan_date
    );

    if (invalidPayloads.length > 0) {
      errors.push({
        code: "INVALID_PAYLOADS",
        message: `${invalidPayloads.length}개의 플랜에 필수 필드가 누락되었습니다.`,
      });
    }

    // 날짜 형식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const invalidDates = payloads.filter(
      (p) => !dateRegex.test(p.plan_date)
    );
    if (invalidDates.length > 0) {
      errors.push({
        code: "INVALID_DATE_FORMAT",
        message: `${invalidDates.length}개의 플랜에 잘못된 날짜 형식이 있습니다.`,
      });
    }

    // 범위 검증
    const invalidRanges = payloads.filter(
      (p) =>
        p.planned_start_page_or_time !== null &&
        p.planned_end_page_or_time !== null &&
        p.planned_start_page_or_time > p.planned_end_page_or_time
    );
    if (invalidRanges.length > 0) {
      warnings.push({
        code: "INVALID_RANGE",
        message: `${invalidRanges.length}개의 플랜에서 시작 범위가 종료 범위보다 큽니다.`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 콘텐츠 존재 여부를 DB에서 검증합니다.
   */
  async validateContentExistence(
    payloads: GeneratePlanPayload[],
    queryClient: SupabaseAnyClient,
    studentId: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 가상 플랜 제외
    const realPayloads = payloads.filter(
      (p) => !(p as { is_virtual?: boolean }).is_virtual
    );

    // 콘텐츠 타입별로 분류
    const bookIds = [
      ...new Set(
        realPayloads
          .filter((p) => p.content_type === "book" && p.content_id)
          .map((p) => p.content_id)
      ),
    ];
    const lectureIds = [
      ...new Set(
        realPayloads
          .filter((p) => p.content_type === "lecture" && p.content_id)
          .map((p) => p.content_id)
      ),
    ];

    // 병렬 조회
    const [booksCheck, lecturesCheck] = await Promise.all([
      bookIds.length > 0
        ? queryClient
            .from("books")
            .select("id")
            .in("id", bookIds)
            .eq("student_id", studentId)
        : Promise.resolve({ data: [], error: null }),
      lectureIds.length > 0
        ? queryClient
            .from("lectures")
            .select("id")
            .in("id", lectureIds)
            .eq("student_id", studentId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // 존재하지 않는 콘텐츠 확인
    const existingBookIds = new Set(
      (booksCheck.data || []).map((b) => b.id)
    );
    const existingLectureIds = new Set(
      (lecturesCheck.data || []).map((l) => l.id)
    );

    const missingBooks = bookIds.filter((id) => !existingBookIds.has(id));
    const missingLectures = lectureIds.filter(
      (id) => !existingLectureIds.has(id)
    );

    if (missingBooks.length > 0) {
      errors.push({
        code: "MISSING_BOOKS",
        message: `${missingBooks.length}개의 교재가 존재하지 않습니다.`,
      });
    }

    if (missingLectures.length > 0) {
      errors.push({
        code: "MISSING_LECTURES",
        message: `${missingLectures.length}개의 강의가 존재하지 않습니다.`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 삽입 결과를 검증합니다.
   */
  validateInsertResult(
    payloads: GeneratePlanPayload[],
    result: PlanInsertResult
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!result.success) {
      errors.push({
        code: "INSERT_FAILED",
        message: `플랜 삽입에 실패했습니다: ${result.errors.map((e) => e.message).join(", ")}`,
      });
    }

    if (result.insertedCount !== payloads.length) {
      warnings.push({
        code: "PARTIAL_INSERT",
        message: `${payloads.length}개 중 ${result.insertedCount}개만 삽입되었습니다.`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 모든 검증 결과를 병합합니다.
   */
  mergeResults(...results: ValidationResult[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const result of results) {
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 플랜 검증 서비스 인스턴스 생성
 */
export function createPlanValidationService(): PlanValidationService {
  return new PlanValidationService();
}
