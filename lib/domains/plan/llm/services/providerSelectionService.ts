/**
 * Provider Selection Service
 * Phase 2.2: 동적 프로바이더 선택
 *
 * 요청 복잡도를 분석하여 최적의 LLM 프로바이더와 티어를 선택합니다.
 * 비용 효율성을 극대화하면서 품질을 유지합니다.
 */

import type { ModelTier, ProviderType } from "../providers/base";
import {
  getAvailableProviders,
  hasApiKey,
  getAllProviderCosts,
} from "../providers/config";

// ============================================
// Types
// ============================================

/**
 * 복잡도 분석 입력
 */
export interface ComplexityInput {
  /** 콘텐츠 개수 */
  contentCount: number;
  /** 학습 기간 (일수) */
  periodDays: number;
  /** 약점 과목 우선 모드 활성화 여부 */
  weaknessSubjectPriority?: boolean;
  /** 과목 균형 모드 활성화 여부 */
  subjectBalance?: boolean;
  /** 커스텀 타임슬롯 존재 여부 */
  hasCustomTimeSlots?: boolean;
  /** 학원 일정 충돌 체크 활성화 여부 */
  academyScheduleCheck?: boolean;
  /** 블록 수 */
  blockCount?: number;
  /** 학원 일정 수 */
  academyScheduleCount?: number;
  /** 추가 컨텍스트 데이터 (선택적) */
  additionalContext?: {
    /** 학습 이력 포함 여부 */
    hasLearningHistory?: boolean;
    /** 시험 일정 포함 여부 */
    hasExamSchedule?: boolean;
    /** 세부 설정 활성화 여부 */
    hasDetailedSettings?: boolean;
  };
}

/**
 * 복잡도 분석 결과
 */
export interface ComplexityResult {
  /** 총 복잡도 점수 (0-100) */
  score: number;
  /** 점수 내역 */
  breakdown: ComplexityBreakdown;
  /** 권장 티어 */
  recommendedTier: ModelTier;
  /** 분석 근거 설명 */
  reasoning: string[];
}

/**
 * 복잡도 점수 상세 내역
 */
export interface ComplexityBreakdown {
  contentScore: number;
  periodScore: number;
  weaknessScore: number;
  balanceScore: number;
  timeSlotsScore: number;
  academyScore: number;
  contextScore: number;
}

/**
 * 프로바이더 선택 결과
 */
export interface ProviderSelectionResult {
  /** 선택된 프로바이더 */
  provider: ProviderType;
  /** 선택된 티어 */
  tier: ModelTier;
  /** 복잡도 분석 결과 */
  complexity: ComplexityResult;
  /** 예상 비용 (USD, 1000 입력 + 500 출력 토큰 기준) */
  estimatedCostPer1kIO: number;
  /** 폴백 프로바이더 (선택된 프로바이더 불가 시) */
  fallbackProvider?: ProviderType;
  /** 선택 근거 */
  selectionReason: string;
}

// ============================================
// Constants
// ============================================

/**
 * 복잡도 점수 가중치
 */
const COMPLEXITY_WEIGHTS = {
  /** 콘텐츠 수 >10개: +30점, 5-10개: +15점 */
  content: {
    high: { threshold: 10, score: 30 },
    medium: { threshold: 5, score: 15 },
  },
  /** 기간 >60일: +20점, 30-60일: +10점 */
  period: {
    high: { threshold: 60, score: 20 },
    medium: { threshold: 30, score: 10 },
  },
  /** 약점 과목 우선: +10점 */
  weakness: 10,
  /** 과목 균형: +10점 */
  balance: 10,
  /** 커스텀 타임슬롯: +15점 */
  timeSlots: 15,
  /** 학원 일정 체크: +10점 */
  academy: 10,
  /** 추가 컨텍스트 (학습 이력, 시험 일정 등): 각 +5점, 최대 +15점 */
  context: 5,
};

/**
 * 티어 임계값
 */
const TIER_THRESHOLDS = {
  advanced: 70, // >=70: advanced
  standard: 40, // 40-69: standard
  // <40: fast
};

/**
 * 티어별 기본 프로바이더 (비용 효율성 기준)
 */
const TIER_PREFERRED_PROVIDERS: Record<ModelTier, ProviderType[]> = {
  fast: ["gemini", "openai", "anthropic"], // Gemini Flash가 가장 저렴
  standard: ["openai", "anthropic", "gemini"], // GPT-4o가 비용 대비 성능 좋음
  advanced: ["anthropic", "openai", "gemini"], // Claude Sonnet이 복잡한 작업에 최적
};

// ============================================
// Provider Selection Service
// ============================================

export class ProviderSelectionService {
  /**
   * 요청 복잡도 분석
   */
  static analyzeComplexity(input: ComplexityInput): ComplexityResult {
    const breakdown: ComplexityBreakdown = {
      contentScore: 0,
      periodScore: 0,
      weaknessScore: 0,
      balanceScore: 0,
      timeSlotsScore: 0,
      academyScore: 0,
      contextScore: 0,
    };
    const reasoning: string[] = [];

    // 콘텐츠 수 점수
    if (input.contentCount > COMPLEXITY_WEIGHTS.content.high.threshold) {
      breakdown.contentScore = COMPLEXITY_WEIGHTS.content.high.score;
      reasoning.push(`콘텐츠 ${input.contentCount}개 (>10): +${breakdown.contentScore}점`);
    } else if (input.contentCount >= COMPLEXITY_WEIGHTS.content.medium.threshold) {
      breakdown.contentScore = COMPLEXITY_WEIGHTS.content.medium.score;
      reasoning.push(`콘텐츠 ${input.contentCount}개 (5-10): +${breakdown.contentScore}점`);
    }

    // 기간 점수
    if (input.periodDays > COMPLEXITY_WEIGHTS.period.high.threshold) {
      breakdown.periodScore = COMPLEXITY_WEIGHTS.period.high.score;
      reasoning.push(`학습 기간 ${input.periodDays}일 (>60): +${breakdown.periodScore}점`);
    } else if (input.periodDays >= COMPLEXITY_WEIGHTS.period.medium.threshold) {
      breakdown.periodScore = COMPLEXITY_WEIGHTS.period.medium.score;
      reasoning.push(`학습 기간 ${input.periodDays}일 (30-60): +${breakdown.periodScore}점`);
    }

    // 약점 과목 우선
    if (input.weaknessSubjectPriority) {
      breakdown.weaknessScore = COMPLEXITY_WEIGHTS.weakness;
      reasoning.push(`약점 과목 우선 활성화: +${breakdown.weaknessScore}점`);
    }

    // 과목 균형
    if (input.subjectBalance) {
      breakdown.balanceScore = COMPLEXITY_WEIGHTS.balance;
      reasoning.push(`과목 균형 활성화: +${breakdown.balanceScore}점`);
    }

    // 커스텀 타임슬롯
    if (input.hasCustomTimeSlots) {
      breakdown.timeSlotsScore = COMPLEXITY_WEIGHTS.timeSlots;
      reasoning.push(`커스텀 타임슬롯 존재: +${breakdown.timeSlotsScore}점`);
    }

    // 학원 일정 체크
    if (input.academyScheduleCheck && (input.academyScheduleCount ?? 0) > 0) {
      breakdown.academyScore = COMPLEXITY_WEIGHTS.academy;
      reasoning.push(`학원 일정 체크 (${input.academyScheduleCount}개): +${breakdown.academyScore}점`);
    }

    // 추가 컨텍스트
    const context = input.additionalContext ?? {};
    let contextPoints = 0;
    if (context.hasLearningHistory) {
      contextPoints += COMPLEXITY_WEIGHTS.context;
      reasoning.push(`학습 이력 포함: +${COMPLEXITY_WEIGHTS.context}점`);
    }
    if (context.hasExamSchedule) {
      contextPoints += COMPLEXITY_WEIGHTS.context;
      reasoning.push(`시험 일정 포함: +${COMPLEXITY_WEIGHTS.context}점`);
    }
    if (context.hasDetailedSettings) {
      contextPoints += COMPLEXITY_WEIGHTS.context;
      reasoning.push(`세부 설정 포함: +${COMPLEXITY_WEIGHTS.context}점`);
    }
    breakdown.contextScore = Math.min(contextPoints, 15); // 최대 15점

    // 총점 계산
    const score = Math.min(
      100,
      breakdown.contentScore +
        breakdown.periodScore +
        breakdown.weaknessScore +
        breakdown.balanceScore +
        breakdown.timeSlotsScore +
        breakdown.academyScore +
        breakdown.contextScore
    );

    // 티어 결정
    let recommendedTier: ModelTier;
    if (score >= TIER_THRESHOLDS.advanced) {
      recommendedTier = "advanced";
    } else if (score >= TIER_THRESHOLDS.standard) {
      recommendedTier = "standard";
    } else {
      recommendedTier = "fast";
    }

    reasoning.push(`총 복잡도 점수: ${score}/100 → 권장 티어: ${recommendedTier}`);

    return {
      score,
      breakdown,
      recommendedTier,
      reasoning,
    };
  }

  /**
   * 최적 프로바이더 선택
   */
  static selectProvider(input: ComplexityInput): ProviderSelectionResult {
    const complexity = this.analyzeComplexity(input);
    const availableProviders = getAvailableProviders();

    // 티어별 선호 프로바이더 순서대로 확인
    const preferredOrder = TIER_PREFERRED_PROVIDERS[complexity.recommendedTier];
    let selectedProvider: ProviderType | null = null;
    let fallbackProvider: ProviderType | undefined;

    for (const provider of preferredOrder) {
      if (availableProviders.includes(provider)) {
        if (!selectedProvider) {
          selectedProvider = provider;
        } else if (!fallbackProvider) {
          fallbackProvider = provider;
          break; // 폴백까지 찾으면 종료
        }
      }
    }

    // 사용 가능한 프로바이더가 없으면 기본값 사용
    if (!selectedProvider) {
      selectedProvider = availableProviders[0] ?? "anthropic";
    }

    // 비용 계산
    const costs = getAllProviderCosts(complexity.recommendedTier);
    const providerCost = costs.find((c) => c.provider === selectedProvider);
    const estimatedCostPer1kIO = providerCost?.estimatedCostPer1kIO ?? 0;

    // 선택 근거 생성
    const selectionReason = this.buildSelectionReason(
      selectedProvider,
      complexity.recommendedTier,
      complexity.score,
      estimatedCostPer1kIO
    );

    return {
      provider: selectedProvider,
      tier: complexity.recommendedTier,
      complexity,
      estimatedCostPer1kIO,
      fallbackProvider,
      selectionReason,
    };
  }

  /**
   * 강제 티어 오버라이드로 프로바이더 선택
   */
  static selectProviderWithTier(
    tier: ModelTier,
    preferredProvider?: ProviderType
  ): Omit<ProviderSelectionResult, "complexity"> & { provider: ProviderType } {
    const availableProviders = getAvailableProviders();

    // 선호 프로바이더가 사용 가능하면 사용
    let selectedProvider: ProviderType;
    if (preferredProvider && availableProviders.includes(preferredProvider)) {
      selectedProvider = preferredProvider;
    } else {
      // 티어별 기본 선호도 순서로 선택
      const preferredOrder = TIER_PREFERRED_PROVIDERS[tier];
      selectedProvider =
        preferredOrder.find((p) => availableProviders.includes(p)) ??
        availableProviders[0] ??
        "anthropic";
    }

    const costs = getAllProviderCosts(tier);
    const providerCost = costs.find((c) => c.provider === selectedProvider);
    const estimatedCostPer1kIO = providerCost?.estimatedCostPer1kIO ?? 0;

    return {
      provider: selectedProvider,
      tier,
      estimatedCostPer1kIO,
      selectionReason: `강제 티어 지정: ${tier}, 프로바이더: ${selectedProvider}`,
    };
  }

  /**
   * 비용 비교 결과 반환
   */
  static compareCosts(tier: ModelTier): {
    recommended: { provider: ProviderType; costPer1kIO: number };
    alternatives: Array<{ provider: ProviderType; costPer1kIO: number }>;
  } {
    const costs = getAllProviderCosts(tier);
    const availableProviders = getAvailableProviders();

    // 사용 가능한 프로바이더만 필터링
    const availableCosts = costs
      .filter((c) => availableProviders.includes(c.provider))
      .sort((a, b) => a.estimatedCostPer1kIO - b.estimatedCostPer1kIO);

    if (availableCosts.length === 0) {
      return {
        recommended: { provider: "anthropic", costPer1kIO: 0 },
        alternatives: [],
      };
    }

    return {
      recommended: {
        provider: availableCosts[0].provider,
        costPer1kIO: availableCosts[0].estimatedCostPer1kIO,
      },
      alternatives: availableCosts.slice(1).map((c) => ({
        provider: c.provider,
        costPer1kIO: c.estimatedCostPer1kIO,
      })),
    };
  }

  /**
   * 선택 근거 문자열 생성
   */
  private static buildSelectionReason(
    provider: ProviderType,
    tier: ModelTier,
    score: number,
    cost: number
  ): string {
    const tierDescriptions: Record<ModelTier, string> = {
      fast: "간단한 요청",
      standard: "일반적인 요청",
      advanced: "복잡한 요청",
    };

    const providerDescriptions: Record<ProviderType, string> = {
      anthropic: "Claude (높은 품질)",
      openai: "GPT-4o (균형잡힌 성능)",
      gemini: "Gemini (비용 효율적)",
    };

    return (
      `복잡도 ${score}/100 → ${tierDescriptions[tier]} 티어 선택. ` +
      `${providerDescriptions[provider]} 사용. ` +
      `예상 비용: $${cost.toFixed(6)}/1K IO`
    );
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 플랜 생성 요청에서 복잡도 입력 추출
 */
export function extractComplexityFromPlanRequest(request: {
  contents?: unknown[];
  settings?: {
    startDate?: string;
    endDate?: string;
    weaknessSubjectPriority?: boolean;
    subjectBalance?: boolean;
  };
  blocks?: unknown[];
  academySchedules?: unknown[];
  timeSlots?: unknown[];
  learningHistory?: unknown;
  examSchedule?: unknown;
}): ComplexityInput {
  // 기간 계산
  let periodDays = 14; // 기본값
  if (request.settings?.startDate && request.settings?.endDate) {
    const start = new Date(request.settings.startDate);
    const end = new Date(request.settings.endDate);
    periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    contentCount: request.contents?.length ?? 0,
    periodDays,
    weaknessSubjectPriority: request.settings?.weaknessSubjectPriority,
    subjectBalance: request.settings?.subjectBalance,
    hasCustomTimeSlots: (request.timeSlots?.length ?? 0) > 0,
    academyScheduleCheck: (request.academySchedules?.length ?? 0) > 0,
    blockCount: request.blocks?.length ?? 0,
    academyScheduleCount: request.academySchedules?.length ?? 0,
    additionalContext: {
      hasLearningHistory: !!request.learningHistory,
      hasExamSchedule: !!request.examSchedule,
      hasDetailedSettings: !!(
        request.settings?.weaknessSubjectPriority ||
        request.settings?.subjectBalance
      ),
    },
  };
}
