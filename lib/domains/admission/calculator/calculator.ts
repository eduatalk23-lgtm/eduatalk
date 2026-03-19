// ============================================
// 정시 환산 엔진 — 메인 파이프라인
// Phase 8.2
// ============================================

import type {
  SuneungScores,
  UniversityScoreConfig,
  ConversionTable,
  RestrictionRule,
  ScoreCalculationResult,
} from "./types";
import { resolveAllSubjects } from "./subject-selector";
import { parseMandatoryPattern, parseOptionalPattern, parseWeightedPattern } from "./config-parser";
import { calculateMandatoryScore } from "./mandatory-scorer";
import { calculateOptionalScore } from "./optional-scorer";
import { calculateWeightedScore } from "./weighted-scorer";
import { checkRestrictions } from "./restriction-checker";

/**
 * 단일 대학에 대한 환산점수 계산.
 *
 * @param scores 학생의 수능 원점수/표준점수
 * @param config 대학별 환산 설정
 * @param conversionTable 과목+점수 → 환산점수 룩업
 * @param restrictions 대학별 결격사유 규칙
 * @param weights 가중택 가중치 배열 (optional)
 */
export function calculateUniversityScore(
  scores: SuneungScores,
  config: UniversityScoreConfig,
  conversionTable: ConversionTable,
  restrictions: RestrictionRule[],
  weights?: number[],
): ScoreCalculationResult {
  // 1. 결격사유 체크 (탈락 시 조기 반환)
  const eligibility = checkRestrictions(scores, restrictions);
  if (!eligibility.isEligible) {
    return {
      universityName: config.universityName,
      isEligible: false,
      disqualificationReasons: eligibility.reasons,
      mandatoryScore: 0,
      optionalScore: 0,
      weightedScore: 0,
      bonusScore: 0,
      totalScore: 0,
      breakdown: { math: null, inquiry: [], mandatory: [], optional: [] },
    };
  }

  // 2. 과목별 환산점수 해결
  const resolved = resolveAllSubjects(scores, config, conversionTable);

  // 3. 패턴 파싱
  const mandatoryParsed = parseMandatoryPattern(config.mandatoryPattern);
  const optionalParsed = parseOptionalPattern(config.optionalPattern);
  const weightedParsed = parseWeightedPattern(config.weightedPattern);

  // 4. 각 영역 점수 계산
  const mandatory = calculateMandatoryScore(mandatoryParsed, resolved);
  const optional = calculateOptionalScore(optionalParsed, resolved);
  const weighted = calculateWeightedScore(weightedParsed, resolved, weights);

  // 5. 추가가감 (bonus_rules — 향후 확장)
  const bonusScore = 0;

  // 6. 최종 합산
  const totalScore = mandatory.total + optional.total + weighted.total + bonusScore;

  return {
    universityName: config.universityName,
    isEligible: true,
    disqualificationReasons: [],
    mandatoryScore: mandatory.total,
    optionalScore: optional.total,
    weightedScore: weighted.total,
    bonusScore,
    totalScore,
    breakdown: {
      math: resolved.math > 0
        ? { subject: "수학", rawScore: 0, convertedScore: resolved.math }
        : null,
      inquiry: [],
      mandatory: mandatory.breakdown,
      optional: optional.breakdown,
    },
  };
}

/**
 * 여러 대학에 대한 환산점수 일괄 계산.
 * Phase 8.5 배치 분석에서 사용.
 */
export function calculateBatch(
  scores: SuneungScores,
  configs: UniversityScoreConfig[],
  conversionTables: Map<string, ConversionTable>,
  restrictionsByUniv: Map<string, RestrictionRule[]>,
  weightsByUniv?: Map<string, number[]>,
): ScoreCalculationResult[] {
  return configs.map((config) => {
    const table = conversionTables.get(config.universityName) ?? new Map();
    const restrictions = restrictionsByUniv.get(config.universityName) ?? [];
    const weights = weightsByUniv?.get(config.universityName);
    return calculateUniversityScore(scores, config, table, restrictions, weights);
  });
}
