// ============================================
// Excel 파일 파싱
// Phase 8.1 — xlsx 라이브러리로 시트 읽기
// ============================================

import * as XLSX from "xlsx";
import type { RawAdmissionRow } from "../types";

/** Excel 파일에서 특정 시트를 읽어 raw 행 배열 반환 */
export function parseSheet(filePath: string, sheetName: string): {
  headers: string[];
  rows: RawAdmissionRow[];
} {
  const wb = XLSX.readFile(filePath);

  if (!wb.SheetNames.includes(sheetName)) {
    throw new Error(`시트 "${sheetName}"을 찾을 수 없습니다. 존재하는 시트: ${wb.SheetNames.join(", ")}`);
  }

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    blankrows: false,
    raw: true,
  });

  if (raw.length < 2) {
    throw new Error(`시트 "${sheetName}"에 데이터가 없습니다.`);
  }

  // 헤더 행 (줄바꿈 제거)
  const headers = (raw[0] ?? []).map((h) =>
    String(h ?? "").replace(/\r\n/g, "").replace(/\n/g, "").trim(),
  );

  // 데이터 행
  const rows: RawAdmissionRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const rawRow = raw[i];
    if (!rawRow || rawRow.length === 0) continue;

    const row: RawAdmissionRow = {};
    headers.forEach((header, idx) => {
      if (header) {
        row[header] = rawRow[idx] ?? null;
      }
    });
    rows.push(row);
  }

  return { headers, rows };
}
