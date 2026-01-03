"use server";

/**
 * 벌크 임포트 검증 서버 액션
 */

import { BulkImportService, formatValidationSummary } from "../services/bulkImportService";
import type { ContentType, BulkImportValidationResult } from "../types";

/**
 * Excel 데이터 검증 (임포트 전 미리보기)
 */
export async function validateImportData(
  rows: Array<Record<string, unknown>>,
  contentType: ContentType,
  options: {
    useAI?: boolean;
    maxAIRequests?: number;
  } = {}
): Promise<{
  success: boolean;
  result?: BulkImportValidationResult;
  summary?: string;
  error?: string;
}> {
  try {
    if (!rows || rows.length === 0) {
      return {
        success: false,
        error: "검증할 데이터가 없습니다.",
      };
    }

    const service = new BulkImportService(contentType);
    const result = await service.validateAll(rows, options);
    const summary = formatValidationSummary(result);

    return {
      success: true,
      result,
      summary,
    };
  } catch (error) {
    console.error("[validateImportData] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "검증 중 오류가 발생했습니다.",
    };
  }
}

/**
 * AI 추정값 적용 후 데이터 반환
 */
export async function applyAISuggestionsToRows(
  rows: Array<{
    originalData: Record<string, unknown>;
    aiSuggestions?: Record<string, unknown>;
    fieldsToApply?: string[];
  }>,
  contentType: ContentType
): Promise<{
  success: boolean;
  enrichedRows?: Array<Record<string, unknown>>;
  error?: string;
}> {
  try {
    const service = new BulkImportService(contentType);
    const enrichedRows: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      if (row.aiSuggestions && Object.keys(row.aiSuggestions).length > 0) {
        const enriched = service.applyAISuggestions(
          row.originalData,
          row.aiSuggestions,
          row.fieldsToApply
        );
        enrichedRows.push(enriched);
      } else {
        enrichedRows.push(row.originalData);
      }
    }

    return {
      success: true,
      enrichedRows,
    };
  } catch (error) {
    console.error("[applyAISuggestionsToRows] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "AI 추정값 적용 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 필수/권장 필드 정보 반환
 */
export async function getFieldRequirements(contentType: ContentType): Promise<{
  required: readonly string[];
  recommended: readonly string[];
}> {
  const service = new BulkImportService(contentType);
  return {
    required: service.getRequiredFields(),
    recommended: service.getRecommendedFields(),
  };
}
