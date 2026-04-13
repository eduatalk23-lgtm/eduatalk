// ============================================
// L4-D / L3 Targeted Repair — 공용 엔진
//
// diagnosis/strategy의 L1+L2에서 감지된 error violations를 Flash로 부분 재생성.
// DeCRIM(Detect → Context → Re-generate → Integrate → Monitor) 패턴을 L1+L2 결과 위에서 실행.
//
// 가이드 도메인 c3.3-v1 targeted-repair.ts 패턴 이식 (섹션 단위 → 필드 단위).
// ============================================

import type { Violation } from "./types";

/** 무한 루프 방지 — 재검증 후 error 남아도 repair 재시도 금지 */
export const MAX_REPAIR_ATTEMPTS = 1;

/**
 * 필드 단위 repair 결과. 도메인별 repair 함수가 반환.
 * @template T - 수리 대상 출력 타입 (DiagnosisGenerationResult | SuggestStrategiesResult)
 */
export interface RepairResult<T> {
  /** 수리 시도 여부 (error 없으면 false) */
  repaired: boolean;
  /** 수리된 출력 (실패·건너뜀 시 원본 그대로) */
  output: T;
  /** 수리 대상으로 선택된 필드 경로 목록 */
  repairedFieldPaths: string[];
  /** 수리 후 남은 L1 재검증 위반 (재검증 스킵한 도메인은 빈 배열) */
  remainingViolations: Violation[];
  /** Flash 모델 사용 토큰 */
  usage: { inputTokens: number; outputTokens: number };
}

/** error severity 위반만 필터링 */
export function extractErrorViolations(violations: Violation[]): Violation[] {
  return violations.filter((v) => v.severity === "error");
}

/**
 * `fieldPath`의 최상위 세그먼트를 반환.
 * - `strengths[2]` → `strengths`
 * - `improvements[0].action` → `improvements`
 * - `suggestions[1].targetArea` → `suggestions`
 * - `strategyNotes` → `strategyNotes`
 * - `undefined` → `""`
 */
export function getTopLevelField(fieldPath: string | undefined): string {
  if (!fieldPath) return "";
  const bracketIdx = fieldPath.indexOf("[");
  const dotIdx = fieldPath.indexOf(".");
  const cuts = [bracketIdx, dotIdx].filter((n) => n >= 0);
  if (cuts.length === 0) return fieldPath;
  return fieldPath.slice(0, Math.min(...cuts));
}

/**
 * `fieldPath`에서 배열 인덱스를 추출. 없으면 `null`.
 * - `suggestions[3].priority` → 3
 * - `strengths[0]` → 0
 * - `strategyNotes` → null
 */
export function extractArrayIndex(fieldPath: string | undefined): number | null {
  if (!fieldPath) return null;
  const match = fieldPath.match(/\[(\d+)\]/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 위반들을 최상위 필드별로 그룹화.
 * 수리 범위(field scope) 결정에 사용.
 */
export function groupViolationsByTopField(
  violations: Violation[],
): Map<string, Violation[]> {
  const map = new Map<string, Violation[]>();
  for (const v of violations) {
    const key = getTopLevelField(v.fieldPath);
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push(v);
    map.set(key, arr);
  }
  return map;
}
