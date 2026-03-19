// ============================================
// 연도 컬럼 동적 감지
// Phase 8.1 — 추천선택 헤더에서 연도 추출
// ============================================

import type { YearMapping } from "../types";

/**
 * 헤더 배열에서 경쟁률/입결 연도를 동적으로 감지.
 * "2025학년도경쟁률", "2024학년도경쟁률" 등의 패턴에서 연도 추출.
 */
export function detectYears(headers: string[]): YearMapping {
  const yearPattern = /(\d{4})학년도\s*경쟁률/;
  const years: number[] = [];

  for (const h of headers) {
    const match = h.match(yearPattern);
    if (match) {
      years.push(Number(match[1]));
    }
  }

  years.sort((a, b) => b - a); // 내림차순

  if (years.length < 2) {
    throw new Error(`헤더에서 연도를 2개 이상 감지하지 못했습니다. 감지된 연도: ${years.join(", ")}`);
  }

  return {
    year0: years[0],
    year1: years[1],
    year2: years[2] ?? years[1] - 1,
  };
}

/**
 * 헤더명과 연도로 실제 Excel 컬럼명 매칭.
 * 예: findHeader(headers, "경쟁률", 2025) → "2025학년도경쟁률"
 */
export function findHeader(headers: string[], keyword: string, year: number): string | null {
  const target = `${year}학년도${keyword}`;
  const targetAlt = `${year}${keyword}`;

  for (const h of headers) {
    const clean = h.replace(/\s/g, "");
    if (clean.includes(target) || clean.includes(targetAlt)) {
      return h;
    }
  }
  return null;
}
