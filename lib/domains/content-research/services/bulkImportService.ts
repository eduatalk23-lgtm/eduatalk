/**
 * 벌크 임포트 서비스
 *
 * Excel 파일에서 콘텐츠를 가져올 때 필수 필드 검증 및 AI 추정값 제안
 */

import { getAIMetadataExtractor } from "./aiMetadataExtractor";
import type {
  ContentType,
  ExtractedMetadata,
  ImportRowValidation,
  BulkImportValidationResult,
} from "../types";

// ============================================
// AI 플랜 생성 필수 필드
// ============================================

/**
 * AI 플랜 생성에 필요한 필수 필드
 */
export const REQUIRED_FIELDS = {
  book: ["title", "subject", "subject_category", "total_pages", "difficulty_level"] as const,
  lecture: ["title", "subject", "subject_category", "total_episodes", "total_duration", "difficulty_level"] as const,
};

/**
 * 권장 필드 (있으면 좋음)
 */
export const RECOMMENDED_FIELDS = {
  book: ["publisher_name", "isbn_13", "revision", "grade_min", "grade_max"] as const,
  lecture: ["platform", "instructor_name", "grade_level", "lecture_type"] as const,
};

// ============================================
// 필드 매핑 (다양한 컬럼명 지원)
// ============================================

const FIELD_ALIASES: Record<string, string[]> = {
  title: ["title", "교재명", "강의명", "제목", "name"],
  subject: ["subject", "과목", "과목명"],
  subject_category: ["subject_category", "과목카테고리", "교과", "교과목"],
  total_pages: ["total_pages", "totalPages", "총페이지", "페이지수", "pages"],
  total_episodes: ["total_episodes", "totalEpisodes", "총강의수", "강의수", "episodes"],
  total_duration: ["total_duration", "totalDuration", "총시간", "총분", "duration"],
  difficulty_level: ["difficulty_level", "difficultyLevel", "난이도", "difficulty"],
  publisher_name: ["publisher_name", "publisherName", "출판사", "publisher"],
  platform: ["platform", "플랫폼", "강의플랫폼"],
  instructor_name: ["instructor_name", "instructorName", "강사", "강사명"],
  isbn_13: ["isbn_13", "isbn13", "ISBN", "isbn"],
  revision: ["revision", "교육과정", "개정"],
  grade_min: ["grade_min", "gradeMin", "최소학년"],
  grade_max: ["grade_max", "gradeMax", "최대학년"],
  grade_level: ["grade_level", "gradeLevel", "학년", "대상학년"],
  lecture_type: ["lecture_type", "lectureType", "강의유형", "유형"],
};

// ============================================
// Bulk Import Service
// ============================================

export class BulkImportService {
  private contentType: ContentType;
  private aiExtractor = getAIMetadataExtractor();

  constructor(contentType: ContentType) {
    this.contentType = contentType;
  }

  /**
   * 필수 필드 목록 반환
   */
  getRequiredFields(): readonly string[] {
    return REQUIRED_FIELDS[this.contentType];
  }

  /**
   * 권장 필드 목록 반환
   */
  getRecommendedFields(): readonly string[] {
    return RECOMMENDED_FIELDS[this.contentType];
  }

  /**
   * 행 데이터에서 필드 값 추출 (별칭 지원)
   */
  private getFieldValue(row: Record<string, unknown>, fieldName: string): unknown {
    // 직접 매칭
    if (row[fieldName] !== undefined) {
      return row[fieldName];
    }

    // 별칭 검색
    const aliases = FIELD_ALIASES[fieldName];
    if (aliases) {
      for (const alias of aliases) {
        if (row[alias] !== undefined) {
          return row[alias];
        }
      }
    }

    return undefined;
  }

  /**
   * 단일 행 검증
   */
  async validateRow(
    row: Record<string, unknown>,
    rowIndex: number,
    options: { useAI?: boolean } = {}
  ): Promise<ImportRowValidation> {
    const requiredFields = this.getRequiredFields();
    const missingFields: string[] = [];
    const messages: string[] = [];

    // 필수 필드 검증
    for (const field of requiredFields) {
      const value = this.getFieldValue(row, field);
      if (value === undefined || value === null || value === "") {
        missingFields.push(field);
      }
    }

    // 제목은 반드시 있어야 함
    const title = this.getFieldValue(row, "title");
    if (!title || String(title).trim() === "") {
      return {
        rowIndex,
        originalData: row,
        status: "invalid",
        missingFields: ["title"],
        messages: ["제목은 필수 필드입니다."],
      };
    }

    // AI 추정값 제안 (누락 필드가 있고 AI 옵션이 활성화된 경우)
    let aiSuggestions: Partial<ExtractedMetadata> | undefined;
    if (missingFields.length > 0 && options.useAI) {
      try {
        const publisher = this.getFieldValue(row, "publisher_name") as string | undefined;
        const result = await this.aiExtractor.extractFromTitle({
          title: String(title),
          contentType: this.contentType,
          publisher,
        });

        if (result.success && result.metadata) {
          aiSuggestions = result.metadata;
          messages.push(`AI가 ${missingFields.length}개 누락 필드에 대한 추정값을 제안합니다.`);
        }
      } catch (error) {
        messages.push("AI 추정 실패: " + (error instanceof Error ? error.message : "알 수 없는 오류"));
      }
    }

    // 상태 결정
    let status: "valid" | "needs_review" | "invalid";
    if (missingFields.length === 0) {
      status = "valid";
    } else if (missingFields.includes("title")) {
      status = "invalid";
    } else if (aiSuggestions) {
      status = "needs_review";
      messages.push("AI 추정값을 확인 후 적용해주세요.");
    } else {
      status = "needs_review";
      messages.push(`${missingFields.length}개 필드가 누락되었습니다: ${missingFields.join(", ")}`);
    }

    // 파생 필드 계산
    const enrichedData = this.calculateDerivedFields(row);

    return {
      rowIndex,
      originalData: row,
      status,
      missingFields,
      aiSuggestions,
      messages,
      enrichedData,
    };
  }

  /**
   * 파생 필드 계산 (estimated_hours 등)
   */
  private calculateDerivedFields(row: Record<string, unknown>): Record<string, unknown> {
    const enriched = { ...row };

    if (this.contentType === "book") {
      const totalPages = this.getFieldValue(row, "total_pages");
      if (totalPages && typeof totalPages === "number" && totalPages > 0) {
        enriched.estimated_hours = Math.round(totalPages / 10 * 10) / 10; // 소수점 1자리
      }
    } else {
      const totalDuration = this.getFieldValue(row, "total_duration");
      if (totalDuration && typeof totalDuration === "number" && totalDuration > 0) {
        enriched.estimated_hours = Math.round(totalDuration / 60 * 10) / 10; // 분 → 시간
      }
    }

    return enriched;
  }

  /**
   * 전체 데이터 검증
   */
  async validateAll(
    rows: Array<Record<string, unknown>>,
    options: { useAI?: boolean; maxAIRequests?: number } = {}
  ): Promise<BulkImportValidationResult> {
    const { useAI = false, maxAIRequests = 50 } = options;
    const validations: ImportRowValidation[] = [];

    let aiRequestCount = 0;

    for (let i = 0; i < rows.length; i++) {
      // AI 요청 제한 (비용 관리)
      const shouldUseAI = useAI && aiRequestCount < maxAIRequests;

      const validation = await this.validateRow(rows[i], i, { useAI: shouldUseAI });
      validations.push(validation);

      if (validation.aiSuggestions) {
        aiRequestCount++;
      }
    }

    // 요약 계산
    const validRows = validations.filter((v) => v.status === "valid").length;
    const needsReviewRows = validations.filter((v) => v.status === "needs_review").length;
    const invalidRows = validations.filter((v) => v.status === "invalid").length;

    return {
      totalRows: rows.length,
      validRows,
      needsReviewRows,
      invalidRows,
      rows: validations,
    };
  }

  /**
   * AI 추정값을 원본 데이터에 병합
   */
  applyAISuggestions(
    row: Record<string, unknown>,
    aiSuggestions: Partial<ExtractedMetadata>,
    fieldsToApply: string[] = []
  ): Record<string, unknown> {
    const result = { ...row };

    // 필드별 매핑
    const fieldMapping: Record<string, keyof ExtractedMetadata> = {
      subject: "subject",
      subject_category: "subjectCategory",
      difficulty_level: "difficulty",
      revision: "curriculum",
      grade_level: "gradeLevel",
      lecture_type: "lectureType",
      instructor_name: "instructorName",
    };

    for (const [dbField, aiField] of Object.entries(fieldMapping)) {
      // 적용할 필드가 지정된 경우 해당 필드만, 아니면 모든 누락 필드
      if (fieldsToApply.length > 0 && !fieldsToApply.includes(dbField)) {
        continue;
      }

      const aiValue = aiSuggestions[aiField];
      const currentValue = this.getFieldValue(row, dbField);

      // 현재 값이 없고 AI 추정값이 있으면 적용
      if ((currentValue === undefined || currentValue === null || currentValue === "") && aiValue) {
        if (dbField === "grade_level" && Array.isArray(aiValue)) {
          // gradeLevel 배열을 grade_min/grade_max로 변환
          const grades = aiValue
            .map((g: string) => parseInt(g.replace(/[^0-9]/g, "")))
            .filter((n: number) => !isNaN(n));
          if (grades.length > 0) {
            result.grade_min = Math.min(...grades);
            result.grade_max = Math.max(...grades);
          }
        } else {
          result[dbField] = aiValue;
        }
      }
    }

    return result;
  }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 검증 결과 요약 메시지 생성
 */
export function formatValidationSummary(result: BulkImportValidationResult): string {
  const lines: string[] = [];
  lines.push(`총 ${result.totalRows}개 행 분석 완료`);
  lines.push(`- 유효: ${result.validRows}개`);
  lines.push(`- 검토 필요: ${result.needsReviewRows}개`);
  lines.push(`- 무효: ${result.invalidRows}개`);

  if (result.needsReviewRows > 0) {
    lines.push("");
    lines.push("검토 필요 항목은 AI 추정값을 확인 후 적용하거나 직접 입력해주세요.");
  }

  if (result.invalidRows > 0) {
    lines.push("");
    lines.push("무효 항목은 제목이 누락되어 가져올 수 없습니다.");
  }

  return lines.join("\n");
}

/**
 * 행 데이터를 DB 형식으로 정규화
 */
export function normalizeRowForDB(
  row: Record<string, unknown>,
  contentType: ContentType
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  // 모든 필드 별칭을 표준 필드명으로 변환
  for (const [stdField, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (row[alias] !== undefined) {
        normalized[stdField] = row[alias];
        break;
      }
    }
  }

  // 원본에 있지만 별칭 목록에 없는 필드도 포함
  for (const [key, value] of Object.entries(row)) {
    if (normalized[key] === undefined) {
      normalized[key] = value;
    }
  }

  return normalized;
}
