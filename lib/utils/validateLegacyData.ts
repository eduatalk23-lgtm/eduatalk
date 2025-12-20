/**
 * 기존 데이터 검증 유틸리티
 * 
 * DB에서 가져온 기존 플랜 데이터를 planWizardSchema로 검증하고,
 * 실패한 원인(Zod issues)을 리스트업하는 로직을 제공합니다.
 * 
 * 이는 기존 데이터와 신규 스키마 간의 간극을 파악하는 용도로 사용됩니다.
 * 
 * 주의: 실제 DB에 영향을 주는 쓰기 작업은 포함하지 않습니다 (Read-only validation).
 */

import { z } from "zod";
import { planWizardSchema, validateWizardDataSafe } from "@/lib/schemas/planWizardSchema";
import type { WizardData } from "@/lib/schemas/planWizardSchema";

/**
 * 검증 결과 타입
 */
export type ValidationResult = {
  success: boolean;
  data?: WizardData;
  errors: ValidationIssue[];
  warnings: string[];
};

/**
 * 검증 이슈 타입
 */
export type ValidationIssue = {
  field: string;
  message: string;
  code: z.ZodIssueCode;
  path: (string | number)[];
  received?: unknown;
  expected?: unknown;
};

/**
 * 검증 결과 요약
 */
export type ValidationSummary = {
  total: number;
  valid: number;
  invalid: number;
  issuesByField: Record<string, number>;
  commonIssues: Array<{
    field: string;
    message: string;
    count: number;
  }>;
};

/**
 * 단일 데이터 검증
 * 
 * @param data 검증할 데이터 (unknown 타입으로 받아 타입 안전성 보장)
 * @returns 검증 결과
 */
export function validateLegacyData(data: unknown): ValidationResult {
  const result = validateWizardDataSafe(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
      warnings: [],
    };
  }

  // Zod 에러를 ValidationIssue로 변환
  const errors: ValidationIssue[] = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
    code: issue.code,
    path: issue.path,
    received: "received" in issue ? issue.received : undefined,
    expected: "expected" in issue ? issue.expected : undefined,
  }));

  // 경고 메시지 생성 (일부 필드 누락 등)
  const warnings: string[] = [];
  if (errors.some((e) => e.code === "invalid_type" && e.received === "undefined")) {
    warnings.push("일부 선택적 필드가 누락되었습니다.");
  }

  return {
    success: false,
    errors,
    warnings,
  };
}

/**
 * 여러 데이터 일괄 검증
 * 
 * @param dataArray 검증할 데이터 배열
 * @returns 각 데이터의 검증 결과 배열
 */
export function validateLegacyDataBatch(
  dataArray: unknown[]
): ValidationResult[] {
  return dataArray.map((data) => validateLegacyData(data));
}

/**
 * 검증 결과 요약 생성
 * 
 * @param results 검증 결과 배열
 * @returns 검증 요약 정보
 */
export function summarizeValidationResults(
  results: ValidationResult[]
): ValidationSummary {
  const total = results.length;
  const valid = results.filter((r) => r.success).length;
  const invalid = total - valid;

  // 필드별 이슈 카운트
  const issuesByField: Record<string, number> = {};
  const issueMessages: Record<string, number> = {};

  results.forEach((result) => {
    if (!result.success) {
      result.errors.forEach((error) => {
        // 필드별 카운트
        issuesByField[error.field] = (issuesByField[error.field] || 0) + 1;

        // 메시지별 카운트 (필드 + 메시지 조합)
        const key = `${error.field}:${error.message}`;
        issueMessages[key] = (issueMessages[key] || 0) + 1;
      });
    }
  });

  // 공통 이슈 추출 (빈도순 정렬)
  const commonIssues = Object.entries(issueMessages)
    .map(([key, count]) => {
      const [field, ...messageParts] = key.split(":");
      return {
        field,
        message: messageParts.join(":"),
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // 상위 10개만

  return {
    total,
    valid,
    invalid,
    issuesByField,
    commonIssues,
  };
}

/**
 * 검증 결과를 읽기 쉬운 형식으로 출력
 * 
 * @param result 검증 결과
 * @returns 포맷된 문자열
 */
export function formatValidationResult(result: ValidationResult): string {
  if (result.success) {
    return "✅ 검증 성공";
  }

  const lines: string[] = ["❌ 검증 실패"];
  lines.push(`\n총 ${result.errors.length}개의 오류 발견:`);

  result.errors.forEach((error, index) => {
    lines.push(`\n${index + 1}. [${error.field}]`);
    lines.push(`   메시지: ${error.message}`);
    lines.push(`   코드: ${error.code}`);
    if (error.path.length > 0) {
      lines.push(`   경로: ${error.path.join(" -> ")}`);
    }
    if (error.received !== undefined) {
      lines.push(`   받은 값: ${JSON.stringify(error.received)}`);
    }
    if (error.expected !== undefined) {
      lines.push(`   예상 값: ${JSON.stringify(error.expected)}`);
    }
  });

  if (result.warnings.length > 0) {
    lines.push(`\n⚠️ 경고:`);
    result.warnings.forEach((warning) => {
      lines.push(`   - ${warning}`);
    });
  }

  return lines.join("\n");
}

/**
 * 검증 요약을 읽기 쉬운 형식으로 출력
 * 
 * @param summary 검증 요약
 * @returns 포맷된 문자열
 */
export function formatValidationSummary(summary: ValidationSummary): string {
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("검증 결과 요약");
  lines.push("=".repeat(60));
  lines.push(`\n총 데이터: ${summary.total}개`);
  lines.push(`✅ 유효한 데이터: ${summary.valid}개 (${((summary.valid / summary.total) * 100).toFixed(1)}%)`);
  lines.push(`❌ 무효한 데이터: ${summary.invalid}개 (${((summary.invalid / summary.total) * 100).toFixed(1)}%)`);

  if (Object.keys(summary.issuesByField).length > 0) {
    lines.push(`\n필드별 오류 발생 횟수:`);
    const sortedFields = Object.entries(summary.issuesByField)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20); // 상위 20개만

    sortedFields.forEach(([field, count]) => {
      lines.push(`   ${field}: ${count}회`);
    });
  }

  if (summary.commonIssues.length > 0) {
    lines.push(`\n가장 흔한 오류 (상위 10개):`);
    summary.commonIssues.forEach((issue, index) => {
      lines.push(`   ${index + 1}. [${issue.field}] ${issue.message} (${issue.count}회)`);
    });
  }

  lines.push("=".repeat(60));

  return lines.join("\n");
}

/**
 * 검증 결과를 JSON 파일로 저장 (디버깅용)
 * 
 * @param results 검증 결과 배열
 * @param filePath 저장할 파일 경로 (선택적)
 * @returns 저장된 파일 경로
 */
export async function saveValidationResultsToFile(
  results: ValidationResult[],
  filePath?: string
): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const outputPath =
    filePath ||
    path.join(process.cwd(), `validation-results-${Date.now()}.json`);

  const output = {
    timestamp: new Date().toISOString(),
    total: results.length,
    results: results.map((result, index) => ({
      index,
      ...result,
      // data는 제외 (너무 클 수 있음)
      data: result.success ? { _validated: true } : undefined,
    })),
    summary: summarizeValidationResults(results),
  };

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");

  return outputPath;
}

