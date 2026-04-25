// ============================================
// L4-D Validators — 공유 규칙 (diagnosis + strategy 공통)
//
// 이 파일은 diagnosis-validator.ts와 strategy-validator.ts가 공유하는
// 패턴 상수와 체커 유틸리티를 제공한다.
//
// 참여한 규칙:
//   - GENERIC_SLOGAN_PATTERNS: 공허 구호 문구 6종 합집합
//   - checkNotEmpty, checkMinLength, checkDuplicate: 반복 패턴 헬퍼
//
// 각 파일 전용 규칙(STRENGTH_NEGATIVE_TOKENS, WEAKNESS_POSITIVE_TOKENS 등)은
// 해당 파일에 그대로 유지 — 이 파일에서 공유하지 않는다.
// ============================================

import type { Violation } from "./types";

// ─────────────────────────────────────────────
// 공허 구호 문구 패턴 — 6종 합집합
//
// diagnosis 원본 4종 + strategy 추가 2종 합집합.
// "더 열심히", "꾸준히 노력", "성실히 임", "최선을 다",
// "열심히 공부", "적극적으로 참여" — 비실행 가능 문구.
// ─────────────────────────────────────────────

export const GENERIC_SLOGAN_PATTERNS: RegExp[] = [
  /^더\s*열심히/,
  /^꾸준히\s*노력/,
  /^성실히\s*임/,
  /^최선을\s*다/,
  /^열심히\s*공부/,
  /^적극적으로\s*참여/,
];

// ─────────────────────────────────────────────
// 체커 헬퍼 — 빈값, 최소 길이, 중복
// ─────────────────────────────────────────────

/**
 * 트림된 text가 비어 있으면 Violation을 vs에 추가한다.
 * @returns 비었으면 true (호출 측에서 early return 판단용)
 */
export function checkNotEmpty(
  text: string,
  rule: string,
  fieldPath: string,
  vs: Violation[],
): boolean {
  if (text.length === 0) {
    vs.push({
      rule,
      severity: "error",
      message: `${fieldPath}가 비어 있습니다`,
      fieldPath,
    });
    return true;
  }
  return false;
}

/**
 * 트림된 text가 min 미만이면 warning Violation을 vs에 추가한다.
 * checkNotEmpty 이후에 호출할 것 (빈값 케이스는 이미 처리됨).
 */
export function checkMinLength(
  text: string,
  min: number,
  rule: string,
  fieldPath: string,
  vs: Violation[],
): void {
  if (text.length < min) {
    vs.push({
      rule,
      severity: "warning",
      message: `${fieldPath}가 너무 짧습니다 (최소 ${min}자)`,
      fieldPath,
      actual: text.length,
      expected: min,
    });
  }
}

/**
 * seenSet에 text가 이미 있으면 error Violation을 vs에 추가한다.
 * 호출 후 seenSet.add(text)는 호출 측에서 수행한다.
 */
export function checkDuplicate(
  seenSet: Set<string>,
  text: string,
  rule: string,
  fieldPath: string,
  vs: Violation[],
): void {
  if (seenSet.has(text)) {
    vs.push({
      rule,
      severity: "error",
      message: `${fieldPath}가 중복됩니다`,
      fieldPath,
      actual: text.slice(0, 40),
    });
  }
}
