/**
 * 성적 산출 엔진
 *
 * 엑셀 기반 교과성적 분석(조정등급, 백분위 추정, 표준편차 추정, 9등급 변환)을
 * 시스템으로 이관한 순수 계산 라이브러리.
 * 2015 개정(9등급제)과 2022 개정(5등급제) 모두 대응.
 *
 * 클라이언트/서버 양쪽에서 import 가능 ("use client" 불필요).
 */

// ============================================
// 상수 테이블
// ============================================

/**
 * 9등급 백분위 경계 (누적비율)
 * 1등급: ~4%, 2등급: ~11%, ..., 9등급: ~100%
 */
export const GRADE_9_BOUNDS = [0, 0.04, 0.11, 0.23, 0.40, 0.60, 0.77, 0.89, 0.96];

/**
 * 5등급 백분위 경계 (2022 개정)
 * A: ~10%, B: ~34%, C: ~66%, D: ~90%, E: ~100%
 */
export const GRADE_5_BOUNDS = [0, 0.10, 0.34, 0.66, 0.90];

/**
 * 성취도 레벨별 비율 누적 상한 → 대표 백분위 매핑용 순서
 */
const ACHIEVEMENT_ORDER = ["A", "B", "C", "D", "E"] as const;

/**
 * 성취도 구간별 점수 범위
 * A: 90~100 (10점), B: 80~90, C: 70~80, D: 60~70, E: 0~60 (60점)
 */
const ACHIEVEMENT_SCORE_RANGES: Record<string, { ceiling: number; span: number }> = {
  A: { ceiling: 100, span: 10 },
  B: { ceiling: 90, span: 10 },
  C: { ceiling: 80, span: 10 },
  D: { ceiling: 70, span: 10 },
  E: { ceiling: 60, span: 60 },
};

/**
 * 변환석차등급 테이블 (진로선택/융합선택용)
 * 누적비율(%) → 등급
 * 9등급 경계와 동일: 4% 이하 = 1등급, 11% 이하 = 2등급, ...
 */
const GRADE_CONVERSION_TABLE: Array<{ maxRatio: number; grade: number }> = [
  { maxRatio: 4, grade: 1 },
  { maxRatio: 11, grade: 2 },
  { maxRatio: 23, grade: 3 },
  { maxRatio: 40, grade: 4 },
  { maxRatio: 60, grade: 5 },
  { maxRatio: 77, grade: 6 },
  { maxRatio: 89, grade: 7 },
  { maxRatio: 96, grade: 8 },
];

// ============================================
// 핵심 수학 함수
// ============================================

/**
 * 표준정규분포 역함수 (NORM.S.INV 근사)
 *
 * Rational approximation (Abramowitz & Stegun, formula 26.2.23)
 * 엑셀 NORM.S.INV와 동일 결과 (오차 < 4.5e-4)
 *
 * @param p - 확률값 (0 < p < 1)
 * @returns z-score
 */
export function normSInv(p: number): number {
  if (p <= 0 || p >= 1) return NaN;

  // Coefficients for rational approximation
  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.383577518672690e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239e0;

  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;

  const c1 = -7.784894002430293e-3;
  const c2 = -3.223964580411365e-1;
  const c3 = -2.400758277161838e0;
  const c4 = -2.549732539343734e0;
  const c5 = 4.374664141464968e0;
  const c6 = 2.938163982698783e0;

  const d1 = 7.784695709041462e-3;
  const d2 = 3.224671290700398e-1;
  const d3 = 2.445134137142996e0;
  const d4 = 3.754408661907416e0;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }

  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    );
  }

  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  );
}

// ============================================
// 백분위 / 등급 계산 함수
// ============================================

/**
 * 등급 경계에서 해당 등급의 하한·상한 백분위를 반환
 */
function getGradeBounds(
  rankGrade: number,
  gradeSystem: 5 | 9
): { lower: number; upper: number } | null {
  const bounds = gradeSystem === 5 ? GRADE_5_BOUNDS : GRADE_9_BOUNDS;
  const maxGrade = gradeSystem === 5 ? 5 : 9;

  if (rankGrade < 1 || rankGrade > maxGrade) return null;

  const lower = bounds[rankGrade - 1]; // 하한 (이전 등급 경계)
  const upper = rankGrade < maxGrade ? bounds[rankGrade] : 1.0; // 상한

  return { lower, upper };
}

/**
 * 백분위 대표 추정 (엑셀 T열)
 *
 * 엑셀 수식:
 * =IFERROR(MEDIAN(
 *   IFS(성취도="A", rA×((100-원점수)/10),
 *       성취도="B", rA + rB×((90-원점수)/10),
 *       성취도="C", (rA+rB) + rC×((80-원점수)/10),
 *       성취도="D", (rA+rB+rC) + rD×((70-원점수)/10),
 *       성취도="E", (rA+rB+rC+rD) + rE×((60-원점수)/60)),
 *   등급하한+0.001, 등급상한-0.001
 * ), "")
 *
 * 성취도 구간 내 원점수 위치를 기반으로 선형보간하여 백분위를 추정합니다.
 */
export function estimatePercentile(input: {
  rawScore: number;
  achievementLevel: string; // A~E
  ratioA: number;
  ratioB: number;
  ratioC: number;
  ratioD: number;
  ratioE: number;
  rankGrade: number | null; // 석차등급
  gradeSystem: 5 | 9;
}): number | null {
  const { rawScore, achievementLevel, ratioA, ratioB, ratioC, ratioD, ratioE, rankGrade, gradeSystem } = input;

  const rA = ratioA / 100;
  const rB = ratioB / 100;
  const rC = ratioC / 100;
  const rD = ratioD / 100;
  const rE = ratioE / 100;

  const level = achievementLevel.toUpperCase();
  const range = ACHIEVEMENT_SCORE_RANGES[level];
  if (!range) return null;

  // 성취도 구간 내 선형보간: 상위 누적비율 + 해당 구간 내 위치 비율
  let achievementPercentile: number;

  switch (level) {
    case "A":
      achievementPercentile = rA * ((range.ceiling - rawScore) / range.span);
      break;
    case "B":
      achievementPercentile = rA + rB * ((range.ceiling - rawScore) / range.span);
      break;
    case "C":
      achievementPercentile = (rA + rB) + rC * ((range.ceiling - rawScore) / range.span);
      break;
    case "D":
      achievementPercentile = (rA + rB + rC) + rD * ((range.ceiling - rawScore) / range.span);
      break;
    case "E":
      achievementPercentile = (rA + rB + rC + rD) + rE * ((range.ceiling - rawScore) / range.span);
      break;
    default:
      return null;
  }

  // 석차등급이 있으면 MEDIAN(성취도추정, 하한+0.001, 상한-0.001) 사용
  if (rankGrade !== null) {
    const bounds = getGradeBounds(rankGrade, gradeSystem);
    if (bounds) {
      const lower = bounds.lower + 0.001;
      const upper = bounds.upper - 0.001;
      const values = [achievementPercentile, lower, upper].sort((a, b) => a - b);
      return values[1];
    }
  }

  // 석차등급 없으면 보간값 직접 반환 (0~1 범위 클램프)
  return Math.max(0, Math.min(1, achievementPercentile));
}

/**
 * 표준편차 추정 (엑셀 U열)
 *
 * |원점수 - 과목평균| / |NORM.S.INV(1 - percentile)| × sqrt(N/(N-1))
 */
export function estimateStdDev(input: {
  rawScore: number;
  avgScore: number;
  percentile: number;
  totalStudents: number;
}): number | null {
  const { rawScore, avgScore, percentile, totalStudents } = input;

  if (totalStudents <= 1) return null;

  // 백분위가 0.5(=정확히 평균)이면 Z=0 → 계산 불가
  const zArg = 1 - percentile;
  if (zArg <= 0 || zArg >= 1) return null;

  const z = normSInv(zArg);
  if (isNaN(z) || Math.abs(z) < 1e-10) return null;

  const diff = Math.abs(rawScore - avgScore);
  const bessel = Math.sqrt(totalStudents / (totalStudents - 1));

  return (diff / Math.abs(z)) * bessel;
}

/**
 * 백분위 → 9등급 변환 (엑셀 V/Z열)
 *
 * 한국 9등급제: 상위 4% 이하 = 1등급, 상위 11% 이하 = 2등급, ...
 * 경계값은 해당 등급에 포함 (예: 0.23 → 3등급)
 */
export function percentileToGrade9(percentile: number): number {
  for (let g = 1; g < GRADE_9_BOUNDS.length; g++) {
    if (percentile <= GRADE_9_BOUNDS[g]) {
      return g; // 1~9
    }
  }
  return 9;
}

/**
 * 백분위 → 5등급 변환
 *
 * 2022 개정 5등급제: 상위 10% 이하 = 1등급, 상위 34% 이하 = 2등급, ...
 */
export function percentileToGrade5(percentile: number): number {
  for (let g = 1; g < GRADE_5_BOUNDS.length; g++) {
    if (percentile <= GRADE_5_BOUNDS[g]) {
      return g; // 1~5
    }
  }
  return 5;
}

/**
 * 변환석차등급 테이블 MATCH 룩업
 *
 * Excel MATCH(value, 비율최대, 1): value 이하의 최대 maxRatio에 해당하는 등급 반환
 * 일치하는 항목이 없으면 null (Excel #N/A → IFERROR → "")
 */
function lookupConversionGrade(ratio: number): number | null {
  let result: number | null = null;
  for (const entry of GRADE_CONVERSION_TABLE) {
    if (entry.maxRatio <= ratio) {
      result = entry.grade;
    } else {
      break;
    }
  }
  return result;
}

/**
 * 조정등급 산출 (엑셀 R열)
 *
 * 엑셀 IFS 조건 순서:
 * 1. 과학탐구실험 → null (experiment)
 * 2. 표준편차 없음 → 진로선택 공식 (career)
 *    - A: 1
 *    - B: LOOKUP(ratioA) + (ratioA+ratioB)/100  ← 소수점 등급
 *    - C: LOOKUP(ratioA+ratioB) + 1
 *    - D, E: null
 * 3. 표준편차 있음 + 석차등급 없음 → null
 * 4. 표준편차 있음 + 석차등급 있음 → MIN(Z등급, 석차등급)
 */
export function computeAdjustedGrade(input: {
  subjectCategory: "regular" | "career" | "experiment";
  rawScore: number | null;
  avgScore: number | null;
  stdDev: number | null;
  rankGrade: number | null;
  achievementLevel: string | null;
  ratioA: number | null;
  ratioB: number | null;
  ratioC: number | null;
  ratioD: number | null;
  ratioE: number | null;
}): number | null {
  const {
    subjectCategory,
    rawScore,
    avgScore,
    stdDev,
    rankGrade,
    achievementLevel,
    ratioA,
    ratioB,
  } = input;

  // 1. experiment (과학탐구실험) → null
  if (subjectCategory === "experiment") return null;

  // 2. career (표준편차 없음) → 성취도 기반 변환
  if (subjectCategory === "career") {
    if (!achievementLevel) return null;
    const level = achievementLevel.toUpperCase();
    const rA = ratioA ?? 0;
    const rB = ratioB ?? 0;

    if (level === "A") return 1;

    if (level === "B") {
      const baseGrade = lookupConversionGrade(rA);
      if (baseGrade === null) return null;
      return baseGrade + (rA + rB) / 100;
    }

    if (level === "C") {
      const baseGrade = lookupConversionGrade(rA + rB);
      if (baseGrade === null) return null;
      return baseGrade + 1;
    }

    // D, E → null
    return null;
  }

  // 3. regular: 석차등급 없으면 null (엑셀 조건3)
  if (rankGrade === null) return null;

  // 4. regular: Z점수 기반 등급 계산
  if (rawScore === null || avgScore === null || stdDev === null || stdDev <= 0) {
    return rankGrade; // Z점수 계산 불가 시 석차등급 그대로
  }

  const z = (rawScore - avgScore) / stdDev;
  const percentile = 1 - normalCdf(z);
  const zGrade = percentileToGrade9(percentile);

  // 석차등급과 Z점수 등급 중 유리한 값 (낮을수록 유리)
  return Math.min(rankGrade, zGrade);
}

/**
 * 표준정규분포 CDF 근사 (Phi 함수)
 *
 * Abramowitz & Stegun 7.1.26 erfc 근사를 통한 계산.
 * erfc(z) ≈ poly(t) × exp(-z²), t = 1/(1+p·z)
 * Phi(x) = 1 - 0.5·erfc(x/√2)  (x ≥ 0)
 *        = 0.5·erfc(|x|/√2)     (x < 0)
 */
export function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const z = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * z);
  const erfc =
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return x >= 0 ? 1 - 0.5 * erfc : 0.5 * erfc;
}

/**
 * 석차 활용 백분위 (엑셀 X열)
 *
 * 석차 있으면 → (rank - 0.5) / total
 * 석차 없으면 → estimatePercentile 결과 그대로
 */
export function computeRankBasedPercentile(input: {
  classRank: number | null;
  totalStudents: number;
  fallbackPercentile: number;
}): number {
  const { classRank, totalStudents, fallbackPercentile } = input;

  if (classRank !== null && classRank > 0 && totalStudents > 0) {
    return (classRank - 0.5) / totalStudents;
  }

  return fallbackPercentile;
}

// ============================================
// 통합 산출 함수
// ============================================

export type ScoreComputationInput = {
  rawScore: number | null;
  avgScore: number | null;
  stdDev: number | null; // 사용자 직접 입력 표준편차 (없으면 추정)
  rankGrade: number | null;
  achievementLevel: string | null;
  ratioA: number | null;
  ratioB: number | null;
  ratioC: number | null;
  ratioD: number | null;
  ratioE: number | null;
  totalStudents: number | null;
  classRank: number | null;
  subjectCategory: "regular" | "career" | "experiment";
  gradeSystem: 5 | 9;
};

export type ComputationMeta = {
  method: "interpolation" | "rank" | "gradeMidpoint" | "achievement5";
  methodLabel: string;
  confidence: "precise" | "estimated" | "reference";
  inputsUsed: string[];
  inputsMissing: string[];
  percentileBounds?: { lower: number; upper: number };
  /** 산출 경로 상세 — 실제 숫자가 포함된 단계별 설명 */
  steps: string[];
};

export type ScoreComputationResult = {
  estimatedPercentile: number | null; // T/X열
  estimatedStdDev: number | null; // U/Y열
  convertedGrade9: number | null; // V/Z열
  adjustedGrade: number | null; // R열
  meta: ComputationMeta | null;
};

/**
 * 통합 산출 함수 — 모든 산출값을 한 번에 계산
 */
export function computeScoreAnalysis(
  input: ScoreComputationInput
): ScoreComputationResult {
  const {
    rawScore,
    avgScore,
    stdDev: inputStdDev,
    rankGrade,
    achievementLevel,
    ratioA,
    ratioB,
    ratioC,
    ratioD,
    ratioE,
    totalStudents,
    classRank,
    subjectCategory,
    gradeSystem,
  } = input;

  const result: ScoreComputationResult = {
    estimatedPercentile: null,
    estimatedStdDev: null,
    convertedGrade9: null,
    adjustedGrade: null,
    meta: null,
  };

  // 최소 데이터 확인
  if (rawScore === null) return result;

  // --- meta 수집 준비 ---
  const allInputKeys = [
    "rawScore", "avgScore", "stdDev", "rankGrade",
    "achievementLevel", "ratioA", "ratioB", "ratioC", "ratioD", "ratioE",
    "totalStudents", "classRank",
  ] as const;
  const inputValues: Record<string, unknown> = {
    rawScore, avgScore, stdDev: inputStdDev, rankGrade,
    achievementLevel, ratioA, ratioB, ratioC, ratioD, ratioE,
    totalStudents, classRank,
  };
  const inputsUsed = allInputKeys.filter((k) => inputValues[k] !== null && inputValues[k] !== undefined);
  const inputsMissing = allInputKeys.filter((k) => inputValues[k] === null || inputValues[k] === undefined);

  let method: ComputationMeta["method"] = "gradeMidpoint";
  let methodLabel = "등급 중앙값 추정";
  let confidence: ComputationMeta["confidence"] = "reference";
  const steps: string[] = [];

  // Step 1: 백분위 추정
  let basePercentile: number | null = null;
  const hasRatios = achievementLevel &&
    ratioA !== null &&
    ratioB !== null &&
    ratioC !== null &&
    ratioD !== null &&
    ratioE !== null;

  if (hasRatios) {
    // 보간 중간값 계산 (steps 기록용)
    const lvl = achievementLevel!.toUpperCase();
    const rA = ratioA! / 100;
    const rB = ratioB! / 100;
    const rC = ratioC! / 100;
    const rD = ratioD! / 100;
    const scoreRanges: Record<string, { ceiling: number; span: number }> = {
      A: { ceiling: 100, span: 10 }, B: { ceiling: 90, span: 10 },
      C: { ceiling: 80, span: 10 }, D: { ceiling: 70, span: 10 }, E: { ceiling: 60, span: 60 },
    };
    const sr = scoreRanges[lvl];
    if (sr) {
      const cumBefore: Record<string, number> = {
        A: 0, B: rA, C: rA + rB, D: rA + rB + rC, E: rA + rB + rC + rD,
      };
      const ratioVal: Record<string, number> = {
        A: rA, B: rB, C: rC, D: rD, E: ratioE! / 100,
      };
      const pos = (sr.ceiling - rawScore) / sr.span;
      const rawPct = cumBefore[lvl] + ratioVal[lvl] * pos;

      steps.push(`${lvl}구간(${sr.ceiling - sr.span}~${sr.ceiling}점) 내 ${rawScore}점`);
      if (cumBefore[lvl] > 0) {
        steps.push(`누적(${(cumBefore[lvl] * 100).toFixed(1)}%) + ${lvl}비율(${(ratioVal[lvl] * 100).toFixed(1)}%) × ${pos.toFixed(1)} = ${(rawPct * 100).toFixed(1)}%`);
      } else {
        steps.push(`${lvl}비율(${(ratioVal[lvl] * 100).toFixed(1)}%) × ${pos.toFixed(1)} = ${(rawPct * 100).toFixed(1)}%`);
      }

      if (rankGrade !== null) {
        const gb = getGradeBounds(rankGrade, gradeSystem);
        if (gb) {
          steps.push(`석차등급 ${rankGrade}등급 범위: ${(gb.lower * 100).toFixed(1)}%~${(gb.upper * 100).toFixed(1)}%`);
          steps.push(`MEDIAN(${(rawPct * 100).toFixed(1)}%, ${((gb.lower + 0.001) * 100).toFixed(1)}%, ${((gb.upper - 0.001) * 100).toFixed(1)}%)`);
        }
      }
    }

    basePercentile = estimatePercentile({
      rawScore,
      achievementLevel: achievementLevel!,
      ratioA: ratioA!,
      ratioB: ratioB!,
      ratioC: ratioC!,
      ratioD: ratioD!,
      ratioE: ratioE!,
      rankGrade,
      gradeSystem,
    });
    method = "interpolation";
    if (rankGrade !== null) {
      methodLabel = "성취도비율 선형보간 → 석차등급 보정";
      confidence = "precise";
    } else {
      methodLabel = "성취도비율 선형보간";
      confidence = "estimated";
    }
  }

  // Step 2: 석차 활용 백분위
  if (basePercentile !== null && totalStudents !== null && totalStudents > 0) {
    result.estimatedPercentile = computeRankBasedPercentile({
      classRank,
      totalStudents,
      fallbackPercentile: basePercentile,
    });
    if (classRank !== null) {
      method = "rank";
      methodLabel = "석차 기반 백분위 ((석차-0.5)/수강자수)";
      confidence = "precise";
      steps.length = 0; // 석차 우선 시 이전 보간 steps 대체
      steps.push(`석차 기반 백분위 계산`);
      steps.push(`(${classRank} - 0.5) / ${totalStudents} = ${((result.estimatedPercentile!) * 100).toFixed(1)}%`);
    }
  } else if (basePercentile !== null) {
    result.estimatedPercentile = basePercentile;
  } else if (classRank !== null && totalStudents !== null && totalStudents > 0) {
    // 성취도비율 없이 석차만 있는 경우
    result.estimatedPercentile = (classRank - 0.5) / totalStudents;
    method = "rank";
    methodLabel = "석차 기반 백분위 ((석차-0.5)/수강자수)";
    confidence = "estimated";
    steps.push(`석차 기반 백분위 계산`);
    steps.push(`(${classRank} - 0.5) / ${totalStudents} = ${(result.estimatedPercentile * 100).toFixed(1)}%`);
  } else if (rankGrade !== null) {
    // 석차등급만 있는 경우 — 등급 중앙 백분위 추정
    const bounds = getGradeBounds(rankGrade, gradeSystem);
    if (bounds) {
      result.estimatedPercentile = (bounds.lower + bounds.upper) / 2;
      steps.push(`${rankGrade}등급 범위: ${(bounds.lower * 100).toFixed(1)}%~${(bounds.upper * 100).toFixed(1)}%`);
      steps.push(`중앙값 = (${(bounds.lower * 100).toFixed(1)} + ${(bounds.upper * 100).toFixed(1)}) / 2 = ${(result.estimatedPercentile * 100).toFixed(1)}%`);
    }
    method = "gradeMidpoint";
    methodLabel = "등급 중앙값 추정";
    confidence = "reference";
  } else if (gradeSystem === 5 && achievementLevel) {
    // 5등급제: 성취도만 있는 경우 — 성취도→5등급 매핑 후 중앙 백분위 추정
    const achievementToGrade5: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
    const grade5 = achievementToGrade5[achievementLevel.toUpperCase()];
    if (grade5 !== undefined) {
      const bounds = getGradeBounds(grade5, 5);
      if (bounds) {
        result.estimatedPercentile = (bounds.lower + bounds.upper) / 2;
        steps.push(`성취도 ${achievementLevel.toUpperCase()} → ${grade5}등급`);
        steps.push(`범위: ${(bounds.lower * 100).toFixed(1)}%~${(bounds.upper * 100).toFixed(1)}%`);
        steps.push(`중앙값 = ${(result.estimatedPercentile * 100).toFixed(1)}%`);
      }
    }
    method = "achievement5";
    methodLabel = "성취도 등급 중앙값 추정 (5등급제)";
    confidence = "reference";
  }

  // Step 3: 표준편차 추정
  if (inputStdDev !== null && inputStdDev > 0) {
    result.estimatedStdDev = inputStdDev;
  } else if (
    result.estimatedPercentile !== null &&
    avgScore !== null &&
    totalStudents !== null &&
    totalStudents > 1
  ) {
    result.estimatedStdDev = estimateStdDev({
      rawScore,
      avgScore,
      percentile: result.estimatedPercentile,
      totalStudents,
    });
  }

  // Step 4: 9등급 변환
  if (result.estimatedPercentile !== null) {
    result.convertedGrade9 = percentileToGrade9(result.estimatedPercentile);
  }

  // Step 5: 조정등급 (엑셀 R열은 원래 입력 표준편차 사용, 추정값 아님)
  result.adjustedGrade = computeAdjustedGrade({
    subjectCategory,
    rawScore,
    avgScore,
    stdDev: inputStdDev,
    rankGrade,
    achievementLevel,
    ratioA,
    ratioB,
    ratioC,
    ratioD,
    ratioE,
  });

  // --- meta 구성 ---
  let percentileBounds: ComputationMeta["percentileBounds"];
  if (result.convertedGrade9 !== null) {
    const bounds = getGradeBounds(result.convertedGrade9, gradeSystem);
    if (bounds) percentileBounds = bounds;
  }

  result.meta = {
    method,
    methodLabel,
    confidence,
    inputsUsed: inputsUsed as unknown as string[],
    inputsMissing: inputsMissing as unknown as string[],
    percentileBounds,
    steps,
  };

  return result;
}

// ============================================
// 유틸리티 — subjectCategory / gradeSystem 판별
// ============================================

/**
 * subjectCategory 판별
 *
 * 엑셀 R열 조건과 동일:
 * - isAchievementOnly (과학탐구실험 등) → "experiment"
 * - 표준편차 없음 (ISBLANK(표준편차)) → "career" (진로선택/융합선택)
 * - 그 외 → "regular"
 *
 * @param isAchievementOnly - subject_types.is_achievement_only 값
 * @param _rankGrade - 석차등급 (현재 미사용, 하위 호환용)
 * @param stdDev - 표준편차
 */
export function determineSubjectCategory(
  isAchievementOnly: boolean,
  _rankGrade: number | null,
  stdDev: number | null
): "regular" | "career" | "experiment" {
  if (isAchievementOnly) return "experiment";
  if (stdDev === null) return "career";
  return "regular";
}

/**
 * gradeSystem 판별
 *
 * @param curriculumYear - curriculum_revisions.year
 */
export function determineGradeSystem(
  curriculumYear: number | null | undefined
): 5 | 9 {
  if (curriculumYear !== null && curriculumYear !== undefined && curriculumYear >= 2022) return 5;
  return 9;
}
