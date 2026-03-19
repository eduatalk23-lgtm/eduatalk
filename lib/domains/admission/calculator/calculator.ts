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
  PercentageTable,
  PercentageInput,
} from "./types";
import { resolveAllSubjects } from "./subject-selector";
import { parseMandatoryPattern, parseOptionalPattern, parseWeightedPattern } from "./config-parser";
import { calculateMandatoryScore } from "./mandatory-scorer";
import { calculateOptionalScore } from "./optional-scorer";
import { calculateWeightedScore } from "./weighted-scorer";
import { calculatePercentageScore } from "./percentage-scorer";
import { checkRestrictions } from "./restriction-checker";

/**
 * 단일 대학에 대한 환산점수 계산.
 *
 * 경로 A (subject): 과목별 SUBJECT3 lookup → 합산
 * 경로 B (percentage): 등수(%) → PERCENTAGE lookup → 총점
 *
 * @param scores 학생의 수능 원점수/표준점수
 * @param config 대학별 환산 설정
 * @param conversionTable 과목+점수 → 환산점수 룩업 (경로 A + 한국사 가감)
 * @param restrictions 대학별 결격사유 규칙
 * @param options 추가 옵션 (weights, percentageInput, percentageTable)
 */
export function calculateUniversityScore(
  scores: SuneungScores,
  config: UniversityScoreConfig,
  conversionTable: ConversionTable,
  restrictions: RestrictionRule[],
  options?: {
    weights?: number[];
    percentageInput?: PercentageInput;
    percentageTable?: PercentageTable;
  },
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

  // 2. 과목별 환산점수 해결 (경로 A/B 모두 한국사 가감점에 필요)
  const resolved = resolveAllSubjects(scores, config, conversionTable);
  const bonusScore = resolved.history; // 한국사 가감점

  // ── 경로 B: PERCENTAGE lookup ──────────────
  if (config.scoringPath === "percentage") {
    const pctInput = options?.percentageInput;
    const pctTable = options?.percentageTable;

    if (!pctInput || !pctTable) {
      return {
        universityName: config.universityName,
        isEligible: true,
        disqualificationReasons: [],
        mandatoryScore: 0,
        optionalScore: 0,
        weightedScore: 0,
        bonusScore,
        totalScore: bonusScore,
        breakdown: { math: null, inquiry: [], mandatory: [], optional: [] },
      };
    }

    const pctResult = calculatePercentageScore(pctInput, pctTable);

    return {
      universityName: config.universityName,
      isEligible: true,
      disqualificationReasons: [],
      mandatoryScore: 0,
      optionalScore: 0,
      weightedScore: pctResult.total,
      bonusScore,
      totalScore: pctResult.total + bonusScore,
      breakdown: { math: null, inquiry: [], mandatory: [], optional: [] },
    };
  }

  // ── 경로 A: 과목별 SUBJECT3 lookup ──────────
  const mandatoryParsed = parseMandatoryPattern(config.mandatoryPattern);
  const optionalParsed = parseOptionalPattern(config.optionalPattern);
  const weightedParsed = parseWeightedPattern(config.weightedPattern);

  const mandatory = calculateMandatoryScore(mandatoryParsed, resolved);
  const optional = calculateOptionalScore(optionalParsed, resolved);
  const weighted = calculateWeightedScore(weightedParsed, resolved, options?.weights);

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
  batchOptions?: {
    weightsByUniv?: Map<string, number[]>;
    percentageInputByUniv?: Map<string, PercentageInput>;
    percentageTablesByUniv?: Map<string, PercentageTable>;
  },
): ScoreCalculationResult[] {
  return configs.map((config) => {
    const table = conversionTables.get(config.universityName) ?? new Map();
    const restrictions = restrictionsByUniv.get(config.universityName) ?? [];
    return calculateUniversityScore(scores, config, table, restrictions, {
      weights: batchOptions?.weightsByUniv?.get(config.universityName),
      percentageInput: batchOptions?.percentageInputByUniv?.get(config.universityName),
      percentageTable: batchOptions?.percentageTablesByUniv?.get(config.universityName),
    });
  });
}
