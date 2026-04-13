// ============================================
// L4-D Hypothesis-Verify Loop — 공용 검증 타입
// L1 Deterministic / L2 Coherence / L3 Repair 모듈이 공유.
// 가이드 도메인 c3.3-v1 패턴(deterministic-validator.ts) 이식.
// ============================================

export type ViolationSeverity = "error" | "warning";

export interface Violation {
  /** 규칙 ID (예: "STRENGTHS_NEGATIVE_WORD") — 디버깅·로깅·repair 타겟 식별용 */
  rule: string;
  severity: ViolationSeverity;
  /** 사람이 읽을 수 있는 설명 */
  message: string;
  /** 위반 발생 위치 (배열 인덱스, 객체 키 등) */
  fieldPath?: string;
  /** 검증된 실제 값 (스니펫) */
  actual?: string | number;
  /** 기대값 또는 임계 */
  expected?: string | number;
}

export interface ValidationResult {
  passed: boolean;
  violations: Violation[];
  errorCount: number;
  warningCount: number;
}

export function summarizeViolations(violations: Violation[]): ValidationResult {
  let errorCount = 0;
  let warningCount = 0;
  for (const v of violations) {
    if (v.severity === "error") errorCount++;
    else warningCount++;
  }
  return {
    passed: errorCount === 0,
    violations,
    errorCount,
    warningCount,
  };
}

/**
 * Violation 목록을 사람이 읽을 수 있는 짧은 라벨로 변환.
 * `warnings: string[]` 필드에 첨부하기 위한 포맷.
 */
export function formatViolationLabels(violations: Violation[]): string[] {
  return violations.map((v) => {
    const sev = v.severity === "error" ? "❗" : "⚠";
    const path = v.fieldPath ? ` (${v.fieldPath})` : "";
    return `${sev} ${v.rule}${path}: ${v.message}`;
  });
}
