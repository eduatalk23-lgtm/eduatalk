/**
 * Access DB(탐구DB_ver2_4.accdb) CSV 파서
 *
 * mdb-export로 추출한 CSV를 파싱하여 AccessGuideRow[]로 변환.
 * CSV 컬럼명이 AccessGuideRow 키와 동일 (한글 그대로).
 *
 * 주의: mdb-export CSV는 multi-line 필드를 포함하므로
 *       Python csv 모듈 수준의 파싱이 필요.
 */

import { readFileSync } from "fs";
import type { AccessGuideRow } from "../types";

// ============================================================
// CSV 파서 (RFC 4180 호환 — 따옴표 내 줄바꿈 지원)
// ============================================================

/** RFC 4180 호환 CSV 파서 — multi-line quoted fields 지원 */
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

/** CSV 파일 파싱 */
export function parseAccessCSV(filePath: string): AccessGuideRow[] {
  const content = readFileSync(filePath, "utf-8");
  const allRows = parseCSV(content);

  if (allRows.length < 2) {
    throw new Error(`CSV 파일에 데이터가 없습니다: ${filePath}`);
  }

  const headers = allRows[0];
  const result: AccessGuideRow[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const values = allRows[i];
    if (values.length < headers.length) continue;

    const obj = {} as Record<string, string | number>;
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? "";
    }

    // ID를 숫자로 변환
    const id = parseInt(String(obj["ID"]), 10);
    if (isNaN(id)) continue;
    obj["ID"] = id;

    result.push(obj as unknown as AccessGuideRow);
  }

  return result;
}

/** JSON 파일 파싱 (사전 추출) */
export function parseAccessJSON(filePath: string): AccessGuideRow[] {
  const content = readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    throw new Error(`JSON 파일이 배열이 아닙니다: ${filePath}`);
  }

  return data.map((item: Record<string, unknown>) => {
    const row = { ...item } as Record<string, unknown>;
    row.ID = Number(row.ID ?? 0);
    return row as unknown as AccessGuideRow;
  });
}
