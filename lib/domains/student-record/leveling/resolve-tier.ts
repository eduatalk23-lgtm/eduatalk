/**
 * 학교권 폴백 체인
 *
 * 1순위: 명시 입력 (students.target_school_tier)
 * 2순위: 내신 평균 등급 기반 추론
 * 3순위: 기본값 "general"
 *
 * 배치 엔진(3순위 원안)은 수능 점수 기반이라 내신만 있는 학생에게 부적합.
 * 향후 L7(수시 레벨링)에서 exemplar 데이터 기반 추론 추가 예정.
 */

import type { SchoolTier } from "@/lib/constants/school-tiers";
import { isSchoolTier } from "@/lib/constants/school-tiers";
import { gpaToInferredTier } from "./engine";

export interface ResolveTierInput {
  /** students.target_school_tier (DB에서 읽은 값) */
  explicitTier: string | null;
  /** 내신 전과목 평균 등급 (null이면 데이터 없음) */
  currentGpa: number | null;
}

export interface ResolveTierResult {
  tier: SchoolTier;
  source: "explicit" | "gpa_inferred" | "default";
}

/**
 * 학교권 해석 (순수 함수 — DB 호출 없음)
 */
export function resolveSchoolTier(input: ResolveTierInput): ResolveTierResult {
  // 1순위: 명시 입력
  if (input.explicitTier && isSchoolTier(input.explicitTier)) {
    return { tier: input.explicitTier, source: "explicit" };
  }

  // 2순위: 내신 추론
  if (input.currentGpa !== null && input.currentGpa > 0) {
    return { tier: gpaToInferredTier(input.currentGpa), source: "gpa_inferred" };
  }

  // 3순위: 기본값
  return { tier: "general", source: "default" };
}
