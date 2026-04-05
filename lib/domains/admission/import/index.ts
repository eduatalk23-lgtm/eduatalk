// ============================================
// Import 파이프라인 오케스트레이터
// Phase 8.1
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportResult } from "../types";
import { parseSheet } from "./excel-parser";
import { detectYears } from "./header-detector";
import { cleanRows } from "./cleaner";
import { transformRows } from "./transformer";
import { bulkInsertAdmissions } from "./bulk-inserter";
import { logActionDebug } from "@/lib/logging/actionLogger";

export interface ImportOptions {
  filePath: string;
  sheetName?: string;
  dataYear?: number;
  dryRun?: boolean;
  batchSize?: number;
  replace?: boolean;
}

/** 추천선택 시트 → DB import 전체 파이프라인 */
export async function runAdmissionImport(
  supabase: SupabaseClient | null,
  options: ImportOptions,
): Promise<ImportResult> {
  const sheetName = options.sheetName ?? "추천선택";

  logActionDebug({ domain: "admission", action: "runAdmissionImport" }, `Excel 파싱: ${options.filePath}, 시트: ${sheetName}`);

  // 1. Excel 파싱
  const { headers, rows: rawRows } = parseSheet(options.filePath, sheetName);
  logActionDebug({ domain: "admission", action: "runAdmissionImport" }, `파싱 완료: ${rawRows.length}행`);

  // 2. 연도 감지
  const years = detectYears(headers);
  const dataYear = options.dataYear ?? years.year0 + 1; // 경쟁률 최신연도+1 = 파일 기준연도
  logActionDebug({ domain: "admission", action: "runAdmissionImport" }, `연도 감지: ${years.year0}/${years.year1}/${years.year2} (data_year=${dataYear})`);

  // 3. 데이터 정제
  const basisHeaders = headers.filter((h) => h.includes("기준"));
  const { cleaned, stats } = cleanRows(rawRows, basisHeaders);
  logActionDebug({ domain: "admission", action: "runAdmissionImport" }, `정제 완료: ${cleaned.length}행 (중복 제거: ${stats.exactDuplicatesRemoved}, 오타 수정: ${stats.typosNormalized}, "-"->null: ${stats.dashToNull})`);

  // 4. 변환
  const { transformed, errors } = transformRows(cleaned, headers, years);
  logActionDebug({ domain: "admission", action: "runAdmissionImport" }, `변환 완료: ${transformed.length}행 (에러: ${errors.length}건)`);

  if (errors.length > 0) {
    const errorSummary = errors.slice(0, 5).map(e => `행${e.row}: ${e.universityName} ${e.departmentName} - ${e.error}`).join("; ");
    logActionDebug({ domain: "admission", action: "runAdmissionImport" }, `변환 에러 (처음 5건): ${errorSummary}`);
  }

  // 5. DB 삽입
  if (options.dryRun || !supabase) {
    logActionDebug({ domain: "admission", action: "runAdmissionImport" }, "[DRY RUN] DB 삽입 건너뜀");
    return {
      total: rawRows.length,
      inserted: 0,
      duplicatesSkipped: 0,
      errors,
      cleaningStats: stats,
    };
  }

  logActionDebug({ domain: "admission", action: "runAdmissionImport" }, `DB 삽입 시작 (배치: ${options.batchSize ?? 500}행)`);
  const { inserted, skipped } = await bulkInsertAdmissions(supabase, transformed, dataYear, {
    batchSize: options.batchSize,
    replace: options.replace,
  });

  logActionDebug({ domain: "admission", action: "runAdmissionImport" }, `완료: 삽입 ${inserted}건, 스킵 ${skipped}건`);

  return {
    total: rawRows.length,
    inserted,
    duplicatesSkipped: skipped,
    errors,
    cleaningStats: stats,
  };
}

export { parseSheet } from "./excel-parser";
export { detectYears } from "./header-detector";
export { cleanRows } from "./cleaner";
export { transformRows } from "./transformer";
export { bulkInsertAdmissions, bulkInsertMathRequirements, bulkInsertScoreConfigs, bulkInsertConversions, bulkInsertRestrictions, bulkInsertPercentageConversions } from "./bulk-inserter";
export { parseComputeSheet } from "./score-config-parser";
export { parseSubject3Sheet } from "./conversion-parser";
export { parseRestrictSheet } from "./restriction-parser";
export { parsePercentageSheet } from "./percentage-parser";
