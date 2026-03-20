/**
 * Access DB(학과조회4.accdb) CSV 파서
 *
 * mdb-export로 추출한 CSV를 파싱하여 타입별 배열로 변환.
 * CSV 컬럼명이 한글 키와 동일.
 *
 * 패턴 참조: lib/domains/guide/import/access-parser.ts
 */

import { readFileSync } from "fs";
import type {
  AccessDepartmentRow,
  AccessCurriculumRow,
  AccessBypassPairRow,
  AccessClassificationRow,
} from "../types";

// ============================================================
// RFC 4180 호환 CSV 파서 (multi-line quoted fields 지원)
// ============================================================

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
      } else if (ch === "\n" || (ch === "\r" && content[i + 1] === "\n")) {
        if (ch === "\r") i++;
        row.push(current);
        current = "";
        if (row.length > 1 || row[0] !== "") {
          rows.push(row);
        }
        row = [];
      } else {
        current += ch;
      }
    }
  }

  // 마지막 행
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

/** 공통 CSV → Record[] 변환 */
function csvToRecords(filePath: string): Record<string, string>[] {
  const content = readFileSync(filePath, "utf-8");
  const allRows = parseCSV(content);

  if (allRows.length < 2) {
    throw new Error(`CSV 파일에 데이터가 없습니다: ${filePath}`);
  }

  const headers = allRows[0];
  const result: Record<string, string>[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const values = allRows[i];
    if (values.length < headers.length) continue;

    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? "";
    }

    result.push(obj);
  }

  return result;
}

/** 학과 CSV 파싱 */
export function parseDepartmentCSV(filePath: string): AccessDepartmentRow[] {
  const records = csvToRecords(filePath);
  return records.filter(
    (r) => r["ID"] && r["대학명"],
  ) as unknown as AccessDepartmentRow[];
}

/** 교육과정 CSV 파싱 */
export function parseCurriculumCSV(filePath: string): AccessCurriculumRow[] {
  const records = csvToRecords(filePath);
  return records.filter(
    (r) => r["ID"] && r["과목명"],
  ) as unknown as AccessCurriculumRow[];
}

/** 우회학과 페어 CSV 파싱 */
export function parseBypassPairCSV(filePath: string): AccessBypassPairRow[] {
  const records = csvToRecords(filePath);
  return records.filter(
    (r) => r["학과ID"] && r["우회학과"],
  ) as unknown as AccessBypassPairRow[];
}

/** 분류 코드 CSV 파싱 */
export function parseClassificationCSV(
  filePath: string,
): AccessClassificationRow[] {
  const records = csvToRecords(filePath);
  return records.filter(
    (r) => r["대분류코드"] && r["대분류명"],
  ) as unknown as AccessClassificationRow[];
}
