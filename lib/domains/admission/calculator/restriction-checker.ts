// ============================================
// 결격사유 체크
// Phase 8.2 — RESTRICT 3종 규칙 평가
// ============================================

import type { SuneungScores, RestrictionRule, EligibilityResult } from "./types";
import { SCIENCE_INQUIRY } from "./constants";

/**
 * 결격사유 체크.
 * 하나라도 해당되면 isEligible=false + 사유 목록 반환.
 */
export function checkRestrictions(
  scores: SuneungScores,
  restrictions: RestrictionRule[],
): EligibilityResult {
  const reasons: string[] = [];

  for (const rule of restrictions) {
    const config = rule.ruleConfig as Record<string, unknown>;

    switch (rule.restrictionType) {
      case "no_show":
        // 수학/탐구 미응시 체크
        if (hasMathScore(scores) === false || hasInquiryScore(scores) === false) {
          reasons.push(rule.description ?? "수학 또는 탐구 미응시");
        }
        break;

      case "grade_sum": {
        // 등급합 초과 체크
        const maxSum = config.max_sum as number | undefined;
        if (maxSum != null) {
          const subjects = config.subjects as string[] | undefined;
          const sum = calculateGradeSum(scores, subjects);
          if (sum > maxSum) {
            reasons.push(rule.description ?? `등급합 ${sum} > 기준 ${maxSum}`);
          }
        }
        // 제2외국어 미응시 체크
        if (config.requires_foreign && scores.foreignLang == null) {
          reasons.push(rule.description ?? "제2외국어 미응시");
        }
        break;
      }

      case "subject_req": {
        // 특정 과탐 과목 응시 요건
        const requiredAny = config.required_any as string[] | undefined;
        const minCount = (config.min_count as number) ?? 1;
        if (requiredAny) {
          const taken = requiredAny.filter((subj) => scores.inquiry[subj] != null);
          if (taken.length < minCount) {
            reasons.push(rule.description ?? `지정과목 미응시: ${requiredAny.join("/")} 중 ${minCount}개 이상 필요`);
          }
        }
        break;
      }
    }
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
  };
}

/** 수학 점수 존재 여부 */
function hasMathScore(scores: SuneungScores): boolean {
  return scores.mathCalculus != null || scores.mathGeometry != null || scores.mathStatistics != null;
}

/** 탐구 점수 존재 여부 */
function hasInquiryScore(scores: SuneungScores): boolean {
  return Object.keys(scores.inquiry).length > 0;
}

/** 등급합 계산 (영어 + 지정 과목) */
function calculateGradeSum(scores: SuneungScores, subjects?: string[]): number {
  let sum = 0;
  // 기본: 영어 + 한국사 등급합
  if (!subjects || subjects.includes("영")) sum += scores.english ?? 9;
  if (!subjects || subjects.includes("한")) sum += scores.history ?? 9;
  return sum;
}
