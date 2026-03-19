// ============================================
// SUBJECT3 시트 파서
// Phase 8.2 — 와이드→롱 언피벗 → ConversionImportRow[]
// ============================================

import * as XLSX from "xlsx";
import type { ConversionImportRow } from "../types";

/**
 * SUBJECT3 시트 구조 (와이드 포맷):
 * - Row 3: 헤더 [영역, 과목, 표준점수, ...(메타 col 3~11), 대학1, 대학2, ...]
 * - Row 4+: 데이터 [영역, 과목, raw_score, ..., converted_score1, converted_score2, ...]
 * - Col 12+: 대학별 환산점수 (557개)
 *
 * 과목별 행 수: 국어 101, 수학(미적/기하/확통) 각 79, 영어 9, 한국사 9, ...
 * 0/null 값 → 해당 대학에서 해당 과목 미반영 → 건너뜀
 */

/** 대학 컬럼 시작 인덱스 */
const UNIV_COL_START = 12;
/** 헤더 행 인덱스 */
const HEADER_ROW = 3;
/** 데이터 시작 행 */
const DATA_ROW_START = 4;

export interface ConversionParseResult {
  rows: ConversionImportRow[];
  subjectStats: Record<string, number>;
  universityCount: number;
  skippedZeros: number;
}

export function parseSubject3Sheet(
  filePath: string,
  sheetName = "SUBJECT3",
  options?: { onProgress?: (current: number, total: number) => void },
): ConversionParseResult {
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
    throw new Error(`SUBJECT3 시트에 데이터가 없습니다.`);
  }

  // 헤더에서 대학명 추출
  const header = raw[HEADER_ROW];
  const univNames: string[] = [];
  for (let col = UNIV_COL_START; col < header.length; col++) {
    const name = header[col];
    univNames.push(name ? String(name).trim() : "");
  }

  const universityCount = univNames.filter(Boolean).length;
  const rows: ConversionImportRow[] = [];
  const subjectStats: Record<string, number> = {};
  let skippedZeros = 0;

  const totalDataRows = raw.length - DATA_ROW_START;

  for (let rowIdx = DATA_ROW_START; rowIdx < raw.length; rowIdx++) {
    const row = raw[rowIdx];
    if (!row) continue;

    const subject = row[1]; // col 1 = 과목
    const rawScore = row[2]; // col 2 = 표준점수

    if (!subject || rawScore == null) continue;

    const subjectStr = String(subject).trim();
    const rawScoreNum = typeof rawScore === "number" ? rawScore : Number(rawScore);
    if (isNaN(rawScoreNum)) continue;

    // 각 대학 컬럼의 환산점수
    for (let uIdx = 0; uIdx < univNames.length; uIdx++) {
      const univName = univNames[uIdx];
      if (!univName) continue;

      const converted = row[UNIV_COL_START + uIdx];
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
        university_name: univName,
        subject: subjectStr,
        raw_score: rawScoreNum,
        converted_score: convertedNum,
      });

      subjectStats[subjectStr] = (subjectStats[subjectStr] ?? 0) + 1;
    }

    if (options?.onProgress && (rowIdx - DATA_ROW_START) % 100 === 0) {
      options.onProgress(rowIdx - DATA_ROW_START, totalDataRows);
    }
  }

  return { rows, subjectStats, universityCount, skippedZeros };
}
