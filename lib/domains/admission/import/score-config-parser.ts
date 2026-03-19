// ============================================
// COMPUTE 시트 파서
// Phase 8.2 — 행×대학 매트릭스 → ScoreConfigImportRow[]
// ============================================

import * as XLSX from "xlsx";
import type { ScoreConfigImportRow } from "../types";

/**
 * COMPUTE 시트 구조:
 * - Row 0: 대학 약칭 (col 5+)
 * - Row 1: 대학 상세명 (col 5+) ← university_name으로 사용
 * - Row 64: 필수 (mandatory_pattern)
 * - Row 65: 선택 (optional_pattern)
 * - Row 66: 가중택 (weighted_pattern)
 * - Row 67: 탐구과목수 (inquiry_count)
 * - Row 68: 수학선택 (math_selection)
 * - Row 69: 탐구선택 (inquiry_selection)
 * - Row 70: 한국사 대체 (history_substitute)
 * - Row 71: 제2외국어 대체 (foreign_substitute)
 */

/** Config 행 인덱스 */
const CONFIG_ROWS = {
  mandatory: 64,
  optional: 65,
  weighted: 66,
  inquiryCount: 67,
  mathSelection: 68,
  inquirySelection: 69,
  historySubstitute: 70,
  foreignSubstitute: 71,
} as const;

/** 대학 컬럼 시작 인덱스 (col 5부터) */
const UNIV_COL_START = 5;

function cleanStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "-" ? null : s;
}

export function parseComputeSheet(
  filePath: string,
  sheetName = "COMPUTE",
): { rows: ScoreConfigImportRow[]; errors: string[] } {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`시트 "${sheetName}"을 찾을 수 없습니다.`);
  }

  const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    blankrows: false,
    raw: true,
  });

  if (raw.length < 72) {
    throw new Error(`COMPUTE 시트에 충분한 행이 없습니다 (${raw.length}행, 최소 72행 필요).`);
  }

  const univNames = raw[1]; // Row 1 = 대학 상세명
  const rows: ScoreConfigImportRow[] = [];
  const errors: string[] = [];

  for (let col = UNIV_COL_START; col < univNames.length; col++) {
    const univName = cleanStr(univNames[col]);
    if (!univName) continue;

    const mandatory = cleanStr(raw[CONFIG_ROWS.mandatory]?.[col]);
    const weighted = cleanStr(raw[CONFIG_ROWS.weighted]?.[col]);

    if (!mandatory && !weighted) {
      errors.push(`${univName}: mandatory_pattern과 weighted_pattern 모두 비어있음 → 건너뜀`);
      continue;
    }

    // 필수 없고 가중택만 있으면 → 경로 B (PERCENTAGE lookup)
    const scoringPath: "subject" | "percentage" = mandatory ? "subject" : "percentage";

    const inquiryCountRaw = raw[CONFIG_ROWS.inquiryCount]?.[col];
    const inquiryCount = typeof inquiryCountRaw === "number"
      ? inquiryCountRaw
      : Number(inquiryCountRaw) || 2;

    rows.push({
      university_name: univName,
      mandatory_pattern: mandatory,
      optional_pattern: cleanStr(raw[CONFIG_ROWS.optional]?.[col]),
      weighted_pattern: weighted,
      inquiry_count: inquiryCount,
      math_selection: cleanStr(raw[CONFIG_ROWS.mathSelection]?.[col]) ?? "가나",
      inquiry_selection: cleanStr(raw[CONFIG_ROWS.inquirySelection]?.[col]) ?? "사과",
      history_substitute: cleanStr(raw[CONFIG_ROWS.historySubstitute]?.[col]),
      foreign_substitute: cleanStr(raw[CONFIG_ROWS.foreignSubstitute]?.[col]),
      bonus_rules: {},
      conversion_type: "표+변",
      scoring_path: scoringPath,
    });
  }

  return { rows, errors };
}
