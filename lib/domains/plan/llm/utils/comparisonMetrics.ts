/**
 * 플랜 생성 방식 비교 메트릭스
 *
 * 하이브리드(AI Framework + 코드 스케줄러) vs AI-only 방식의
 * 성능 및 품질을 비교하기 위한 유틸리티입니다.
 *
 * @module lib/domains/plan/llm/utils/comparisonMetrics
 */

import { estimateCost } from "../client";
import type { ModelTier } from "../types";

// ============================================
// 타입 정의
// ============================================

/**
 * 토큰 사용량
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * 비용 정보 (USD)
 */
export interface CostInfo {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

/**
 * 처리 시간 정보 (ms)
 */
export interface TimingInfo {
  aiProcessingMs: number;
  schedulerProcessingMs?: number;
  totalMs: number;
}

/**
 * 플랜 품질 메트릭
 */
export interface QualityMetrics {
  /** 총 생성된 플랜 수 */
  planCount: number;
  /** 콘텐츠 커버리지 (0-1) */
  contentCoverage: number;
  /** 과목 균형 점수 (0-1) */
  subjectBalance: number;
  /** 시간 효율성 (0-1) */
  timeEfficiency: number;
  /** 학원 일정 충돌 여부 */
  hasAcademyConflicts: boolean;
  /** 제외일 위반 여부 */
  hasExclusionViolations: boolean;
  /** 일일 학습량 초과 여부 */
  hasOverloadDays: boolean;
}

/**
 * 생성 방식 별 메트릭 결과
 */
export interface GenerationMetrics {
  method: "hybrid" | "ai-only" | "code-only";
  tokens: TokenUsage;
  cost: CostInfo;
  timing: TimingInfo;
  quality: QualityMetrics;
  /** AI 신뢰도 (하이브리드, AI-only만 해당) */
  aiConfidence?: number;
  /** AI 추천사항 포함 여부 */
  hasRecommendations: boolean;
  /** 모델 티어 */
  modelTier: ModelTier;
}

/**
 * 비교 결과
 */
export interface ComparisonResult {
  hybrid: GenerationMetrics;
  aiOnly?: GenerationMetrics;
  codeOnly?: GenerationMetrics;
  summary: ComparisonSummary;
}

/**
 * 비교 요약
 */
export interface ComparisonSummary {
  /** 토큰 절감률 (하이브리드 vs AI-only) */
  tokenSavingsPercent: number;
  /** 비용 절감률 */
  costSavingsPercent: number;
  /** 처리 시간 차이 (ms) */
  timeDifferenceMs: number;
  /** 품질 점수 차이 */
  qualityScoreDifference: number;
  /** 권장 방식 */
  recommendedMethod: "hybrid" | "ai-only" | "code-only";
  /** 권장 이유 */
  recommendationReason: string;
}

// ============================================
// 토큰 및 비용 계산
// ============================================

/**
 * 토큰 사용량 계산
 */
export function calculateTokenUsage(
  inputTokens: number,
  outputTokens: number
): TokenUsage {
  return {
    input: inputTokens,
    output: outputTokens,
    total: inputTokens + outputTokens,
  };
}

/**
 * 비용 계산
 */
export function calculateCost(
  tokens: TokenUsage,
  modelTier: ModelTier
): CostInfo {
  const totalCost = estimateCost(tokens.input, tokens.output, modelTier);

  // 대략적인 입력/출력 비율로 분할 (입력이 일반적으로 더 저렴)
  const inputRatio = tokens.input / tokens.total;
  const outputRatio = tokens.output / tokens.total;

  return {
    inputCost: totalCost * inputRatio * 0.6, // 입력 토큰이 더 저렴
    outputCost: totalCost * outputRatio * 1.4, // 출력 토큰이 더 비쌈
    totalCost,
  };
}

/**
 * 토큰 절감률 계산
 */
export function calculateTokenSavings(
  baseline: TokenUsage,
  comparison: TokenUsage
): number {
  if (baseline.total === 0) return 0;
  return ((baseline.total - comparison.total) / baseline.total) * 100;
}

// ============================================
// 품질 메트릭 계산
// ============================================

/**
 * 콘텐츠 커버리지 계산
 *
 * 요청된 콘텐츠 중 플랜에 포함된 비율
 */
export function calculateContentCoverage(
  requestedContentIds: string[],
  generatedPlans: Array<{ contentId: string }>
): number {
  if (requestedContentIds.length === 0) return 1;

  const coveredIds = new Set(generatedPlans.map(p => p.contentId));
  const coveredCount = requestedContentIds.filter(id => coveredIds.has(id)).length;

  return coveredCount / requestedContentIds.length;
}

/**
 * 과목 균형 점수 계산
 *
 * 모든 과목이 균등하게 배분되었는지 측정 (지니 계수 기반)
 */
export function calculateSubjectBalance(
  plans: Array<{ subject: string; durationMinutes: number }>
): number {
  if (plans.length === 0) return 1;

  // 과목별 총 학습 시간 집계
  const subjectTotals = new Map<string, number>();
  plans.forEach(plan => {
    const current = subjectTotals.get(plan.subject) || 0;
    subjectTotals.set(plan.subject, current + plan.durationMinutes);
  });

  const totals = Array.from(subjectTotals.values());
  if (totals.length <= 1) return 1;

  // 지니 계수 계산 (0 = 완벽한 균형, 1 = 완전 불균형)
  totals.sort((a, b) => a - b);
  const n = totals.length;
  const sum = totals.reduce((a, b) => a + b, 0);

  if (sum === 0) return 1;

  let giniNumerator = 0;
  for (let i = 0; i < n; i++) {
    giniNumerator += (2 * (i + 1) - n - 1) * totals[i];
  }

  const gini = giniNumerator / (n * sum);

  // 균형 점수로 변환 (1 - 지니 계수)
  return 1 - Math.max(0, Math.min(1, gini));
}

/**
 * 시간 효율성 계산
 *
 * 가용 시간 대비 실제 배치된 학습 시간 비율
 */
export function calculateTimeEfficiency(
  totalAvailableMinutes: number,
  totalScheduledMinutes: number
): number {
  if (totalAvailableMinutes === 0) return 0;

  // 90-100%가 가장 효율적 (약간의 여유 포함)
  const ratio = totalScheduledMinutes / totalAvailableMinutes;

  if (ratio >= 0.9 && ratio <= 1.0) return 1;
  if (ratio > 1.0) return Math.max(0, 2 - ratio); // 초과 시 감점
  return ratio; // 부족 시 비율 그대로
}

/**
 * 전체 품질 점수 계산 (0-100)
 */
export function calculateOverallQualityScore(metrics: QualityMetrics): number {
  let score = 0;

  // 콘텐츠 커버리지 (30점)
  score += metrics.contentCoverage * 30;

  // 과목 균형 (20점)
  score += metrics.subjectBalance * 20;

  // 시간 효율성 (20점)
  score += metrics.timeEfficiency * 20;

  // 충돌 없음 (각 10점)
  if (!metrics.hasAcademyConflicts) score += 10;
  if (!metrics.hasExclusionViolations) score += 10;
  if (!metrics.hasOverloadDays) score += 10;

  return Math.round(score);
}

// ============================================
// 비교 분석
// ============================================

/**
 * 두 생성 방식 비교
 */
export function compareGenerationMethods(
  hybrid: GenerationMetrics,
  aiOnly?: GenerationMetrics,
  codeOnly?: GenerationMetrics
): ComparisonResult {
  const baseline = aiOnly || codeOnly;

  // 토큰 절감률 (하이브리드 vs AI-only)
  const tokenSavingsPercent = baseline
    ? calculateTokenSavings(baseline.tokens, hybrid.tokens)
    : 0;

  // 비용 절감률
  const costSavingsPercent = baseline && baseline.cost.totalCost > 0
    ? ((baseline.cost.totalCost - hybrid.cost.totalCost) / baseline.cost.totalCost) * 100
    : 0;

  // 처리 시간 차이
  const timeDifferenceMs = baseline
    ? hybrid.timing.totalMs - baseline.timing.totalMs
    : 0;

  // 품질 점수 차이
  const hybridQuality = calculateOverallQualityScore(hybrid.quality);
  const baselineQuality = baseline
    ? calculateOverallQualityScore(baseline.quality)
    : hybridQuality;
  const qualityScoreDifference = hybridQuality - baselineQuality;

  // 권장 방식 결정
  let recommendedMethod: "hybrid" | "ai-only" | "code-only" = "hybrid";
  let recommendationReason = "";

  if (tokenSavingsPercent > 20 && qualityScoreDifference >= -5) {
    recommendedMethod = "hybrid";
    recommendationReason = `토큰 ${tokenSavingsPercent.toFixed(1)}% 절감, 품질 유지`;
  } else if (qualityScoreDifference < -10) {
    recommendedMethod = aiOnly ? "ai-only" : "code-only";
    recommendationReason = `하이브리드 품질이 ${Math.abs(qualityScoreDifference)}점 낮음`;
  } else if (timeDifferenceMs > 5000) {
    recommendedMethod = aiOnly ? "ai-only" : "code-only";
    recommendationReason = `하이브리드가 ${(timeDifferenceMs / 1000).toFixed(1)}초 더 느림`;
  } else {
    recommendedMethod = "hybrid";
    recommendationReason = "균형 잡힌 성능과 비용";
  }

  return {
    hybrid,
    aiOnly,
    codeOnly,
    summary: {
      tokenSavingsPercent,
      costSavingsPercent,
      timeDifferenceMs,
      qualityScoreDifference,
      recommendedMethod,
      recommendationReason,
    },
  };
}

/**
 * 비교 결과 포맷팅 (로깅/디버깅용)
 */
export function formatComparisonResult(result: ComparisonResult): string {
  const { summary, hybrid, aiOnly } = result;

  let output = "=== 플랜 생성 방식 비교 결과 ===\n\n";

  // 하이브리드 메트릭
  output += "📊 하이브리드 방식:\n";
  output += `  - 토큰: ${hybrid.tokens.total} (입력: ${hybrid.tokens.input}, 출력: ${hybrid.tokens.output})\n`;
  output += `  - 비용: $${hybrid.cost.totalCost.toFixed(4)}\n`;
  output += `  - 시간: ${hybrid.timing.totalMs}ms\n`;
  output += `  - 품질 점수: ${calculateOverallQualityScore(hybrid.quality)}/100\n`;

  // AI-only 메트릭 (있는 경우)
  if (aiOnly) {
    output += "\n🤖 AI-only 방식:\n";
    output += `  - 토큰: ${aiOnly.tokens.total} (입력: ${aiOnly.tokens.input}, 출력: ${aiOnly.tokens.output})\n`;
    output += `  - 비용: $${aiOnly.cost.totalCost.toFixed(4)}\n`;
    output += `  - 시간: ${aiOnly.timing.totalMs}ms\n`;
    output += `  - 품질 점수: ${calculateOverallQualityScore(aiOnly.quality)}/100\n`;
  }

  // 요약
  output += "\n📈 비교 요약:\n";
  output += `  - 토큰 절감: ${summary.tokenSavingsPercent.toFixed(1)}%\n`;
  output += `  - 비용 절감: ${summary.costSavingsPercent.toFixed(1)}%\n`;
  output += `  - 시간 차이: ${summary.timeDifferenceMs > 0 ? "+" : ""}${summary.timeDifferenceMs}ms\n`;
  output += `  - 품질 차이: ${summary.qualityScoreDifference > 0 ? "+" : ""}${summary.qualityScoreDifference}점\n`;
  output += `\n✅ 권장: ${summary.recommendedMethod} (${summary.recommendationReason})\n`;

  return output;
}

// ============================================
// 예상 토큰 비교 (사전 분석용)
// ============================================

/**
 * 하이브리드 vs AI-only 예상 토큰 비교
 *
 * 실제 API 호출 없이 프롬프트 크기 기반으로 예측
 */
export interface TokenEstimateComparison {
  hybrid: {
    frameworkPromptTokens: number;
    expectedOutputTokens: number;
    totalEstimate: number;
  };
  aiOnly: {
    fullPromptTokens: number;
    expectedOutputTokens: number;
    totalEstimate: number;
  };
  savingsPercent: number;
}

/**
 * 예상 토큰 절감률 계산
 *
 * @param contentCount 콘텐츠 수
 * @param subjectCount 과목 수
 * @param daysCount 학습 일수
 */
export function estimateTokenSavings(
  contentCount: number,
  subjectCount: number,
  daysCount: number
): TokenEstimateComparison {
  // 하이브리드 (Framework 프롬프트는 더 작음)
  const frameworkSystemPrompt = 1400; // ~5,500자 / 4
  const frameworkUserPrompt =
    100 + // 학생 정보
    subjectCount * 50 + // 성적 정보
    contentCount * 80 + // 콘텐츠 정보
    50; // 기간 정보
  const frameworkOutput =
    200 + // 기본 구조
    subjectCount * 150 + // 과목 분류
    contentCount * 50 + // 콘텐츠 우선순위
    100; // 추천사항

  // AI-only (전체 플랜 생성 프롬프트)
  const fullSystemPrompt = 2000; // ~8,000자 / 4
  const fullUserPrompt =
    100 + // 학생 정보
    subjectCount * 50 + // 성적 정보
    contentCount * 80 + // 콘텐츠 정보
    daysCount * 20 + // 시간 슬롯
    100; // 설정
  const fullOutput =
    daysCount * contentCount * 100; // 각 날짜별 플랜

  const hybridTotal = frameworkSystemPrompt + frameworkUserPrompt + frameworkOutput;
  const aiOnlyTotal = fullSystemPrompt + fullUserPrompt + fullOutput;

  return {
    hybrid: {
      frameworkPromptTokens: frameworkSystemPrompt + frameworkUserPrompt,
      expectedOutputTokens: frameworkOutput,
      totalEstimate: hybridTotal,
    },
    aiOnly: {
      fullPromptTokens: fullSystemPrompt + fullUserPrompt,
      expectedOutputTokens: fullOutput,
      totalEstimate: aiOnlyTotal,
    },
    savingsPercent: ((aiOnlyTotal - hybridTotal) / aiOnlyTotal) * 100,
  };
}
