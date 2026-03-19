// ============================================
// 데이터 정제
// Phase 8.1 — 오타 정규화, "-"→null, 중복 제거
// ============================================

import type { RawAdmissionRow, CleaningStats } from "../types";

// ── 기준 오타 정규화 맵 ─────────────────────

const RESULT_BASIS_TYPO_MAP: Record<string, string> = {
  // 퍙균 → 평균
  "최종등록자퍙균": "최종등록자평균",
  "최종등록자펑균": "최종등록자평균",
  "최종동륵자평균": "최종등록자평균",
  "최종등록자펴균": "최종등록자평균",
  // 증록 → 등록
  "최종증록자70%컷": "최종등록자70%컷",
  "최종증록자85%컷": "최종등록자85%컷",
  "최종증록자평균": "최종등록자평균",
  // 최저 → 최종
  "최저등록자85%컷": "최종등록자85%컷",
  "최저등록자70%컷": "최종등록자70%컷",
  "최저등록자평균": "최종등록자평균",
  // 공백 변형
  "최종등록자 평균": "최종등록자평균",
  "최종등록자 70%컷": "최종등록자70%컷",
  "최종등록자 85%컷": "최종등록자85%컷",
  // 70컷 (% 누락)
  "최종등록자70컷": "최종등록자70%컷",
  "최종등록자85컷": "최종등록자85%컷",
};

/** 기준값 오타 정규화 */
function normalizeBasis(value: string): string {
  const trimmed = value.trim();
  return RESULT_BASIS_TYPO_MAP[trimmed] ?? trimmed;
}

/** 문자열이 비어있는지 ("-", 빈 문자열, null) 확인 */
function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  const str = String(value).trim();
  return str === "" || str === "-" || str === "—" || str === "–";
}

/** 값을 정제된 문자열로 변환. 비어있으면 null */
function cleanValue(value: unknown): string | null {
  if (isEmptyValue(value)) return null;
  return String(value).trim();
}

// ── 중복 제거 ───────────────────────────────

function buildRowKey(row: RawAdmissionRow, keyFields: string[]): string {
  return keyFields.map((f) => String(row[f] ?? "")).join("|");
}

// ── 메인 정제 함수 ──────────────────────────

export function cleanRows(
  rows: RawAdmissionRow[],
  basisHeaders: string[],
): { cleaned: RawAdmissionRow[]; stats: CleaningStats } {
  const stats: CleaningStats = {
    dashToNull: 0,
    typosNormalized: 0,
    exactDuplicatesRemoved: 0,
  };

  // 1. 선택 컬럼 제거 (첫 번째 컬럼)
  for (const row of rows) {
    delete row["선택"];
    delete row["열1"];
  }

  // 2. "-" → null 카운팅 (실제 변환은 transformer에서)
  for (const row of rows) {
    for (const [, value] of Object.entries(row)) {
      if (value != null && String(value).trim() === "-") {
        stats.dashToNull++;
      }
    }
  }

  // 3. 기준 오타 정규화
  for (const row of rows) {
    for (const basisHeader of basisHeaders) {
      const val = row[basisHeader];
      if (val != null && typeof val === "string") {
        const normalized = normalizeBasis(val);
        if (normalized !== val.trim()) {
          row[basisHeader] = normalized;
          stats.typosNormalized++;
        }
      }
    }
  }

  // 4. 정확 중복 제거
  const allFields = Object.keys(rows[0] ?? {});
  const seen = new Set<string>();
  const deduplicated: RawAdmissionRow[] = [];

  for (const row of rows) {
    const key = buildRowKey(row, allFields);
    if (seen.has(key)) {
      stats.exactDuplicatesRemoved++;
      continue;
    }
    seen.add(key);
    deduplicated.push(row);
  }

  return { cleaned: deduplicated, stats };
}

export { cleanValue, isEmptyValue, normalizeBasis };
