/**
 * 생기부 역량 시계열 분석 엔진
 *
 * A3 목표: 학생의 1~3학년 역량 점수 변화를 분석하여
 * 성장 추이, 이상 감지, 강약 역량을 파악한다.
 *
 * 외부 라이브러리 의존 없음 — 순수 TypeScript.
 * 데이터가 1개 학년만 있어도 동작 (graceful degradation).
 *
 * 사용처: scripts/eval-student-record.ts (A3 통합)
 */

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

/** 학년별 역량 점수 단일 측정점 */
export interface TimeSeriesPoint {
  gradeYear: 1 | 2 | 3;
  competencyId: string;
  competencyName: string;
  /** 0~100 정규화 점수 */
  score: number;
}

/** 추세 분류 */
export type TrendType = "rising" | "falling" | "stable" | "volatile";

/** 단일 역량의 학년별 추세 분석 결과 */
export interface CompetencyTrend {
  competencyId: string;
  competencyName: string;
  /** 학년 오름차순 정렬된 측정점 목록 */
  points: TimeSeriesPoint[];
  /** 전체 성장률: 마지막 학년 점수 - 첫 학년 점수 */
  growthRate: number;
  /** 학년 간 평균 변화량 (delta 평균) */
  avgDelta: number;
  /** 추세 유형 */
  trend: TrendType;
  /** 이상 감지 여부 */
  isAnomaly: boolean;
  /** 이상 감지 시 사유 */
  anomalyReason?: string;
}

/** 전체 시계열 분석 결과 */
export interface TimeSeriesAnalysis {
  studentId: string;
  /** 역량별 추세 목록 */
  trends: CompetencyTrend[];
  /** 전체 역량 평균 성장률 */
  overallGrowthRate: number;
  /** 최종 학년 기준 가장 높은 점수의 역량 ID */
  strongestCompetency: string;
  /** 최종 학년 기준 가장 낮은 점수의 역량 ID */
  weakestCompetency: string;
  /** 성장률(growthRate)이 가장 높은 역량 ID */
  mostImprovedCompetency: string;
  /** 이상 감지된 역량 목록 */
  anomalies: CompetencyTrend[];
  /** 한 줄 요약 */
  summary: string;
}

// ─── 상수 ───────────────────────────────────────────────────────────────────

/** 추세 판정: 평균 delta 임계값 (점수 단위) */
const TREND_DELTA_THRESHOLD = 3;

/** 이상 감지: 단일 구간 급격 하락 임계값 */
const ANOMALY_SHARP_DROP_THRESHOLD = -15;

/** 이상 감지: 정체 판정 — 전 학년 점수 범위 (max - min) */
const ANOMALY_STAGNANT_RANGE_THRESHOLD = 2;

/** 이상 감지: 역전 판정 — 3학년 점수가 1학년보다 낮은 차이 */
const ANOMALY_REVERSAL_THRESHOLD = -10;

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

/** 숫자 배열 평균 (빈 배열이면 0 반환) */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** 소수점 1자리 반올림 */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 연속된 점수 배열에서 학년 간 delta 배열을 계산한다.
 * [70, 75, 80] → [5, 5]
 */
function computeDeltas(scores: number[]): number[] {
  const deltas: number[] = [];
  for (let i = 1; i < scores.length; i++) {
    deltas.push(scores[i] - scores[i - 1]);
  }
  return deltas;
}

// ─── 공개 함수 ──────────────────────────────────────────────────────────────

/**
 * 학년별 점수 배열로부터 추세를 분류한다.
 *
 * 판정 우선순위:
 *   1. stable  : |평균 delta| ≤ TREND_DELTA_THRESHOLD (소폭 변화 → 안정)
 *   2. rising  : 모든 delta > 0 AND 평균 delta > TREND_DELTA_THRESHOLD
 *   3. falling : 모든 delta < 0 AND 평균 delta < -TREND_DELTA_THRESHOLD
 *   4. volatile: 방향 혼재 (상승↔하락 교차, 평균 delta가 threshold 초과하지만 allRising/allFalling 아님)
 *
 * stable을 최우선 판정하므로 소폭 전진(avg ≤ 3)은 rising이 아닌 stable로 처리된다.
 *
 * @param scores - 학년 오름차순 점수 배열 (최소 1개)
 */
export function detectTrend(scores: number[]): TrendType {
  if (scores.length <= 1) return "stable";

  const deltas = computeDeltas(scores);
  const avg = mean(deltas);

  // 1. stable 우선: 소폭 변화 (방향 무관)
  if (Math.abs(avg) <= TREND_DELTA_THRESHOLD) return "stable";

  const allRising = deltas.every((d) => d > 0);
  const allFalling = deltas.every((d) => d < 0);

  // 2. 명확한 상승
  if (allRising && avg > TREND_DELTA_THRESHOLD) return "rising";
  // 3. 명확한 하락
  if (allFalling && avg < -TREND_DELTA_THRESHOLD) return "falling";
  // 4. 방향 혼재 (avg > threshold이지만 역방향 delta 존재)
  return "volatile";
}

/**
 * 단일 CompetencyTrend에서 이상을 감지한다.
 *
 * 이상 기준 (우선순위 순):
 *   1. 급격한 하락: 어느 구간이든 delta < ANOMALY_SHARP_DROP_THRESHOLD (-15)
 *   2. 정체: 전 학년 점수의 max-min < ANOMALY_STAGNANT_RANGE_THRESHOLD (2)
 *   3. 역전: 3학년 점수 < 1학년 점수 + ANOMALY_REVERSAL_THRESHOLD (-10)
 *
 * @param trend - detectTrend, growthRate, avgDelta가 계산된 CompetencyTrend
 */
export function detectAnomalies(trend: CompetencyTrend): {
  isAnomaly: boolean;
  reason?: string;
} {
  const scores = trend.points.map((p) => p.score);

  if (scores.length <= 1) {
    return { isAnomaly: false };
  }

  // 1. 급격한 하락
  const deltas = computeDeltas(scores);
  const sharpDrop = deltas.find((d) => d < ANOMALY_SHARP_DROP_THRESHOLD);
  if (sharpDrop !== undefined) {
    return {
      isAnomaly: true,
      reason: `급격한 하락 감지 (구간 변화량 ${round1(sharpDrop)}점)`,
    };
  }

  // 2. 정체
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  if (maxScore - minScore < ANOMALY_STAGNANT_RANGE_THRESHOLD) {
    return {
      isAnomaly: true,
      reason: `전 학년 정체 (점수 범위 ${round1(maxScore - minScore)}점)`,
    };
  }

  // 3. 역전 (3학년 데이터가 있고 1학년 데이터도 있을 때만)
  const point1 = trend.points.find((p) => p.gradeYear === 1);
  const point3 = trend.points.find((p) => p.gradeYear === 3);
  if (point1 !== undefined && point3 !== undefined) {
    const reversal = point3.score - point1.score;
    if (reversal < ANOMALY_REVERSAL_THRESHOLD) {
      return {
        isAnomaly: true,
        reason: `3학년이 1학년보다 크게 하락 (역전 ${round1(reversal)}점)`,
      };
    }
  }

  return { isAnomaly: false };
}

/**
 * TimeSeriesPoint 배열로부터 전체 역량 시계열을 분석한다.
 *
 * 데이터가 1개 학년만 있어도 동작한다 (graceful degradation).
 * - 1개 학년: growthRate=0, avgDelta=0, trend='stable', 이상감지 불가
 *
 * @param studentId - 학생 고유 ID
 * @param points    - 전체 측정점 목록 (여러 역량 + 여러 학년 혼재 가능)
 */
export function analyzeTimeSeries(
  studentId: string,
  points: TimeSeriesPoint[],
): TimeSeriesAnalysis {
  // 역량별로 그룹핑 (competencyId 기준)
  const byCompetency = new Map<string, TimeSeriesPoint[]>();
  for (const pt of points) {
    const list = byCompetency.get(pt.competencyId) ?? [];
    list.push(pt);
    byCompetency.set(pt.competencyId, list);
  }

  const trends: CompetencyTrend[] = [];

  for (const [competencyId, pts] of byCompetency) {
    // 학년 오름차순 정렬
    const sorted = [...pts].sort((a, b) => a.gradeYear - b.gradeYear);
    const scores = sorted.map((p) => p.score);
    const name = sorted[0].competencyName;

    // delta 계산
    const deltas = computeDeltas(scores);
    const growthRate = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;
    const avgDelta = deltas.length > 0 ? mean(deltas) : 0;
    const trend = detectTrend(scores);

    const partialTrend: CompetencyTrend = {
      competencyId,
      competencyName: name,
      points: sorted,
      growthRate: round1(growthRate),
      avgDelta: round1(avgDelta),
      trend,
      isAnomaly: false,
    };

    const anomaly = detectAnomalies(partialTrend);
    partialTrend.isAnomaly = anomaly.isAnomaly;
    if (anomaly.reason) partialTrend.anomalyReason = anomaly.reason;

    trends.push(partialTrend);
  }

  // 역량이 없으면 빈 결과 반환
  if (trends.length === 0) {
    return {
      studentId,
      trends: [],
      overallGrowthRate: 0,
      strongestCompetency: "",
      weakestCompetency: "",
      mostImprovedCompetency: "",
      anomalies: [],
      summary: "분석 가능한 역량 데이터가 없습니다.",
    };
  }

  // 전체 성장률 평균
  const overallGrowthRate = round1(mean(trends.map((t) => t.growthRate)));

  // 최종 학년 기준 강/약 역량 (마지막 측정점 점수 기준)
  const latestScoreOf = (t: CompetencyTrend): number =>
    t.points[t.points.length - 1].score;

  const strongest = trends.reduce((a, b) =>
    latestScoreOf(a) >= latestScoreOf(b) ? a : b,
  );
  const weakest = trends.reduce((a, b) =>
    latestScoreOf(a) <= latestScoreOf(b) ? a : b,
  );

  // 가장 많이 성장한 역량
  const mostImproved = trends.reduce((a, b) =>
    a.growthRate >= b.growthRate ? a : b,
  );

  const anomalies = trends.filter((t) => t.isAnomaly);

  // 한 줄 요약 생성
  const summary = buildSummary({
    trends,
    overallGrowthRate,
    strongest,
    weakest,
    mostImproved,
    anomalies,
  });

  return {
    studentId,
    trends,
    overallGrowthRate,
    strongestCompetency: strongest.competencyId,
    weakestCompetency: weakest.competencyId,
    mostImprovedCompetency: mostImproved.competencyId,
    anomalies,
    summary,
  };
}

// ─── 내부: 요약 생성 ─────────────────────────────────────────────────────────

interface SummaryInput {
  trends: CompetencyTrend[];
  overallGrowthRate: number;
  strongest: CompetencyTrend;
  weakest: CompetencyTrend;
  mostImproved: CompetencyTrend;
  anomalies: CompetencyTrend[];
}

function buildSummary({
  trends,
  overallGrowthRate,
  strongest,
  weakest,
  mostImproved,
  anomalies,
}: SummaryInput): string {
  const risingCount = trends.filter((t) => t.trend === "rising").length;
  const fallingCount = trends.filter((t) => t.trend === "falling").length;

  const growthLabel =
    overallGrowthRate > 5
      ? "전반적 성장세"
      : overallGrowthRate < -5
        ? "전반적 하락세"
        : "전반적 안정세";

  const parts: string[] = [
    `${growthLabel} (평균 성장 ${overallGrowthRate > 0 ? "+" : ""}${overallGrowthRate}점)`,
    `강점: ${strongest.competencyName}`,
    `보완 필요: ${weakest.competencyName}`,
  ];

  if (mostImproved.growthRate > 0) {
    parts.push(`최대 성장: ${mostImproved.competencyName} (+${mostImproved.growthRate}점)`);
  }

  if (risingCount > 0) parts.push(`상승 역량 ${risingCount}개`);
  if (fallingCount > 0) parts.push(`하락 역량 ${fallingCount}개`);
  if (anomalies.length > 0) parts.push(`이상 감지 ${anomalies.length}개`);

  return parts.join(" / ");
}
