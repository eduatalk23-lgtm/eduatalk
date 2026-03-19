// ============================================
// PERCENTAGE 시트 파서
// Phase 8.2b — 와이드→롱 언피벗 → PercentageConversionImportRow[]
// ============================================

import * as XLSX from "xlsx";
import type { PercentageConversionImportRow } from "../types";

/**
 * PERCENTAGE 시트 구조 (와이드 포맷):
 * - Row 1: 헤더 "대학명 이과/문과" (col 1+, 1118개)
 * - Row 2: 최고점 (max score per university+track)
 * - Row 3+: percentile(col 0) × 대학(col 1+) 매트릭스
 *   - col 0: 누적% (0.01~80.00)
 *   - values: 대학별 환산총점
 */

const HEADER_ROW = 1;
const DATA_ROW_START = 3;

export interface PercentageParseResult {
  rows: PercentageConversionImportRow[];
  universityTrackCount: number;
  maxScores: Map<string, number>; // "대학명|트랙" → 최고점
  skippedZeros: number;
}

export function parsePercentageSheet(
  filePath: string,
  sheetName = "PERCENTAGE",
  options?: { onProgress?: (current: number, total: number) => void },
): PercentageParseResult {
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

  if (raw.length < DATA_ROW_START + 1) {
    throw new Error(`PERCENTAGE 시트에 데이터가 없습니다.`);
  }

  // 헤더에서 대학명+트랙 추출
  const headers = raw[HEADER_ROW];
  const columns: { col: number; universityName: string; track: string }[] = [];

  for (let c = 1; c < headers.length; c++) {
    const h = String(headers[c] ?? "").trim();
    const match = h.match(/^(.+?)\s+(이과|문과)$/);
    if (match) {
      columns.push({ col: c, universityName: match[1], track: match[2] });
    }
  }

  const universityTrackCount = columns.length;

  // 최고점 추출 (row 2)
  const maxScores = new Map<string, number>();
  const maxRow = raw[2];
  for (const { col, universityName, track } of columns) {
    const v = maxRow?.[col];
    if (v != null && typeof v === "number") {
      maxScores.set(`${universityName}|${track}`, v);
    }
  }

  // 데이터 언피벗
  const rows: PercentageConversionImportRow[] = [];
  let skippedZeros = 0;
  const totalDataRows = raw.length - DATA_ROW_START;

  for (let rowIdx = DATA_ROW_START; rowIdx < raw.length; rowIdx++) {
    const row = raw[rowIdx];
    if (!row) continue;

    const pctRaw = row[0];
    if (pctRaw == null) continue;

    const pctNum = typeof pctRaw === "number" ? pctRaw : Number(pctRaw);
    if (isNaN(pctNum)) continue;

    // percentile → smallint (0.01 → 1, 6.75 → 675, 80.00 → 8000)
    const percentile = Math.round(pctNum * 100);
    if (percentile <= 0) continue;

    for (const { col, universityName, track } of columns) {
      const converted = row[col];
      if (converted == null || converted === "" || converted === 0) {
        skippedZeros++;
        continue;
      }

      const convertedNum = typeof converted === "number" ? converted : Number(converted);
      if (isNaN(convertedNum) || convertedNum === 0) {
        skippedZeros++;
        continue;
      }

      rows.push({
        university_name: universityName,
        track,
        percentile,
        converted_score: convertedNum,
      });
    }

    if (options?.onProgress && (rowIdx - DATA_ROW_START) % 50 === 0) {
      options.onProgress(rowIdx - DATA_ROW_START, totalDataRows);
    }
  }

  return { rows, universityTrackCount, maxScores, skippedZeros };
}
