// ============================================
// Config 패턴 문자열 파싱
// Phase 8.2 — 레지스트리 우선, 정규식 폴백
// ============================================

import type { ParsedMandatoryPattern, ParsedOptionalPattern, ParsedWeightedPattern, SubjectSlot } from "./types";
import { MANDATORY_PATTERNS, OPTIONAL_PATTERNS, WEIGHTED_PATTERNS } from "./constants";

/** 필수 패턴 파싱 */
export function parseMandatoryPattern(pattern: string): ParsedMandatoryPattern {
  const trimmed = pattern.trim();
  const exact = MANDATORY_PATTERNS[trimmed];
  if (exact) return exact;

  // 정규식 폴백
  return { subjects: parseSubjectTokens(trimmed) };
}

/** 선택 패턴 파싱 — null이면 null 반환 */
export function parseOptionalPattern(pattern: string | null): ParsedOptionalPattern | null {
  if (!pattern) return null;
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  const exact = OPTIONAL_PATTERNS[trimmed];
  if (exact) return exact;

  // 정규식 폴백: "...中택N"
  const match = trimmed.match(/^(.+)中택(\d+)$/);
  if (match) {
    const pool = parseSubjectTokens(match[1]);
    return { pool, pickCount: Number(match[2]) };
  }

  return null;
}

/** 가중택 패턴 파싱 — null이면 null 반환 */
export function parseWeightedPattern(pattern: string | null): ParsedWeightedPattern | null {
  if (!pattern) return null;
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  const exact = WEIGHTED_PATTERNS[trimmed];
  if (exact) return exact;

  // 정규식 폴백: "...中가중택N"
  const match = trimmed.match(/^(.+)中가중택(\d+)$/);
  if (match) {
    const pool = parseSubjectTokens(match[1]);
    return { pool, pickCount: Number(match[2]) };
  }

  return null;
}

// ── 토큰 파서 (정규식 폴백용) ───────────────

/**
 * 패턴 문자열에서 과목 토큰을 추출.
 * "국수영탐(2)" → [korean, math, english, inquiry(2)]
 */
function parseSubjectTokens(pattern: string): SubjectSlot[] {
  const slots: SubjectSlot[] = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "국") {
      slots.push({ type: "korean" });
      i++;
    } else if (ch === "수") {
      slots.push({ type: "math" });
      i++;
    } else if (ch === "영") {
      slots.push({ type: "english" });
      i++;
    } else if (ch === "한") {
      slots.push({ type: "history" });
      i++;
    } else if (ch === "외") {
      slots.push({ type: "foreign" });
      i++;
    } else if (ch === "탐") {
      // "탐(N)" 형태
      const numMatch = pattern.slice(i).match(/^탐\((\d+)\)/);
      if (numMatch) {
        slots.push({ type: "inquiry", count: Number(numMatch[1]) });
        i += numMatch[0].length;
      } else {
        slots.push({ type: "inquiry", count: 2 });
        i++;
      }
    } else {
      i++; // 무시 (공백 등)
    }
  }

  return slots;
}
