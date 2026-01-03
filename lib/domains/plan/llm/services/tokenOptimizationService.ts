/**
 * Token Optimization Service
 * Phase 2.3: 토큰 최적화
 *
 * LLM 요청의 토큰 사용량을 최적화하여 비용을 절감합니다.
 */

import { estimateTokens } from "../client";

// ============================================
// Types
// ============================================

/**
 * 콘텐츠 정보 (최적화 전)
 */
export interface ContentInfoFull {
  id: string;
  title: string;
  subject?: string;
  subjectCategory?: string;
  contentType?: "book" | "lecture" | "custom";
  totalPages?: number;
  totalLectures?: number;
  difficulty?: string;
  priority?: string;
  // 불필요한 필드들
  description?: string;
  toc?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  publisher?: string;
  author?: string;
  coverImageUrl?: string;
  isbn?: string;
}

/**
 * 콘텐츠 정보 (최적화 후)
 */
export interface ContentInfoOptimized {
  id: string;
  title: string;
  subject?: string;
  subjectCategory?: string;
  contentType?: "book" | "lecture" | "custom";
  totalPages?: number;
  totalLectures?: number;
  difficulty?: string;
  priority?: string;
}

/**
 * 학습 이력 (최적화 전)
 */
export interface LearningHistoryFull {
  recentPlans?: Array<{
    date: string;
    contentId: string;
    completed: boolean;
    duration?: number;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  subjectPerformance?: Array<{
    subject: string;
    completionRate: number;
    avgDuration?: number;
    lastStudied?: string;
    detailedStats?: object;
  }>;
  weeklyStats?: object;
  monthlyStats?: object;
  allTimePlans?: object[];
}

/**
 * 학습 이력 (최적화 후)
 */
export interface LearningHistoryOptimized {
  recentPlans?: Array<{
    date: string;
    contentId: string;
    completed: boolean;
    duration?: number;
  }>;
  subjectPerformance?: Array<{
    subject: string;
    completionRate: number;
    avgDuration?: number;
  }>;
}

/**
 * 토큰 분석 결과
 */
export interface TokenAnalysis {
  /** 예상 총 토큰 수 */
  estimatedTokens: number;
  /** 토큰 제한 내 여부 */
  isWithinLimit: boolean;
  /** 권장 최대 토큰 수 */
  recommendedLimit: number;
  /** 최적화 제안 */
  suggestions: TokenOptimizationSuggestion[];
  /** 컴포넌트별 토큰 수 */
  breakdown: TokenBreakdown;
}

/**
 * 토큰 최적화 제안
 */
export interface TokenOptimizationSuggestion {
  /** 제안 유형 */
  type: "reduce_contents" | "reduce_history" | "simplify_settings" | "truncate_text";
  /** 설명 */
  description: string;
  /** 예상 절감 토큰 수 */
  estimatedSavings: number;
  /** 우선순위 (1이 가장 높음) */
  priority: number;
}

/**
 * 토큰 상세 내역
 */
export interface TokenBreakdown {
  systemPrompt: number;
  contents: number;
  learningHistory: number;
  settings: number;
  other: number;
}

/**
 * 최적화 결과
 */
export interface OptimizationResult<T> {
  /** 최적화된 데이터 */
  data: T;
  /** 원본 토큰 수 */
  originalTokens: number;
  /** 최적화 후 토큰 수 */
  optimizedTokens: number;
  /** 절감률 (%) */
  savingsPercent: number;
}

// ============================================
// Constants
// ============================================

/**
 * 기본 토큰 제한
 */
const DEFAULT_TOKEN_LIMITS = {
  /** 권장 최대 입력 토큰 */
  recommended: 4000,
  /** 경고 임계값 */
  warning: 8000,
  /** 절대 최대값 */
  maximum: 16000,
};

/**
 * 학습 이력 최적화 설정
 */
const LEARNING_HISTORY_LIMITS = {
  /** 최근 플랜 최대 개수 */
  maxRecentPlans: 20,
  /** 과목 성과 최대 개수 */
  maxSubjectPerformance: 10,
};

/**
 * 콘텐츠 필드 중요도 (제거 우선순위, 높을수록 먼저 제거)
 */
const CONTENT_FIELD_PRIORITY: Record<string, number> = {
  coverImageUrl: 10,
  isbn: 9,
  author: 8,
  publisher: 7,
  notes: 6,
  toc: 5,
  description: 4,
  createdAt: 3,
  updatedAt: 3,
};

// ============================================
// Token Optimization Service
// ============================================

export class TokenOptimizationService {
  private tokenLimit: number;

  constructor(tokenLimit: number = DEFAULT_TOKEN_LIMITS.recommended) {
    this.tokenLimit = tokenLimit;
  }

  // ============================================
  // Content Optimization
  // ============================================

  /**
   * 콘텐츠 페이로드 최적화 (불필요 필드 제거)
   */
  optimizeContentPayload(
    contents: ContentInfoFull[]
  ): OptimizationResult<ContentInfoOptimized[]> {
    const originalJson = JSON.stringify(contents);
    const originalTokens = estimateTokens(originalJson);

    const optimized = contents.map((c) => this.stripUnnecessaryFields(c));

    const optimizedJson = JSON.stringify(optimized);
    const optimizedTokens = estimateTokens(optimizedJson);

    const savingsPercent =
      originalTokens > 0
        ? ((originalTokens - optimizedTokens) / originalTokens) * 100
        : 0;

    return {
      data: optimized,
      originalTokens,
      optimizedTokens,
      savingsPercent,
    };
  }

  /**
   * 불필요한 필드 제거
   */
  private stripUnnecessaryFields(content: ContentInfoFull): ContentInfoOptimized {
    return {
      id: content.id,
      title: content.title,
      subject: content.subject,
      subjectCategory: content.subjectCategory,
      contentType: content.contentType,
      totalPages: content.totalPages,
      totalLectures: content.totalLectures,
      difficulty: content.difficulty,
      priority: content.priority,
    };
  }

  /**
   * 콘텐츠 수 제한
   */
  limitContents<T extends { id: string }>(
    contents: T[],
    maxCount: number = 15
  ): OptimizationResult<T[]> {
    const originalJson = JSON.stringify(contents);
    const originalTokens = estimateTokens(originalJson);

    const limited = contents.slice(0, maxCount);

    const limitedJson = JSON.stringify(limited);
    const optimizedTokens = estimateTokens(limitedJson);

    const savingsPercent =
      originalTokens > 0
        ? ((originalTokens - optimizedTokens) / originalTokens) * 100
        : 0;

    return {
      data: limited,
      originalTokens,
      optimizedTokens,
      savingsPercent,
    };
  }

  // ============================================
  // Learning History Optimization
  // ============================================

  /**
   * 학습 이력 최적화 (최근 N개만, 불필요 필드 제거)
   */
  optimizeLearningHistory(
    history: LearningHistoryFull,
    options: {
      maxRecentPlans?: number;
      maxSubjectPerformance?: number;
    } = {}
  ): OptimizationResult<LearningHistoryOptimized> {
    const maxRecentPlans =
      options.maxRecentPlans ?? LEARNING_HISTORY_LIMITS.maxRecentPlans;
    const maxSubjectPerformance =
      options.maxSubjectPerformance ?? LEARNING_HISTORY_LIMITS.maxSubjectPerformance;

    const originalJson = JSON.stringify(history);
    const originalTokens = estimateTokens(originalJson);

    const optimized: LearningHistoryOptimized = {
      recentPlans: history.recentPlans
        ?.slice(0, maxRecentPlans)
        .map((p) => ({
          date: p.date,
          contentId: p.contentId,
          completed: p.completed,
          duration: p.duration,
        })),
      subjectPerformance: history.subjectPerformance
        ?.slice(0, maxSubjectPerformance)
        .map((s) => ({
          subject: s.subject,
          completionRate: s.completionRate,
          avgDuration: s.avgDuration,
        })),
    };

    const optimizedJson = JSON.stringify(optimized);
    const optimizedTokens = estimateTokens(optimizedJson);

    const savingsPercent =
      originalTokens > 0
        ? ((originalTokens - optimizedTokens) / originalTokens) * 100
        : 0;

    return {
      data: optimized,
      originalTokens,
      optimizedTokens,
      savingsPercent,
    };
  }

  // ============================================
  // Token Analysis
  // ============================================

  /**
   * 토큰 사용량 분석 및 최적화 제안
   */
  analyzeTokenUsage(request: {
    systemPrompt?: string;
    contents?: unknown[];
    learningHistory?: unknown;
    settings?: unknown;
    other?: unknown;
  }): TokenAnalysis {
    // 컴포넌트별 토큰 계산
    const breakdown: TokenBreakdown = {
      systemPrompt: request.systemPrompt
        ? estimateTokens(request.systemPrompt)
        : 0,
      contents: request.contents
        ? estimateTokens(JSON.stringify(request.contents))
        : 0,
      learningHistory: request.learningHistory
        ? estimateTokens(JSON.stringify(request.learningHistory))
        : 0,
      settings: request.settings
        ? estimateTokens(JSON.stringify(request.settings))
        : 0,
      other: request.other ? estimateTokens(JSON.stringify(request.other)) : 0,
    };

    const estimatedTokens =
      breakdown.systemPrompt +
      breakdown.contents +
      breakdown.learningHistory +
      breakdown.settings +
      breakdown.other;

    const isWithinLimit = estimatedTokens <= this.tokenLimit;
    const suggestions: TokenOptimizationSuggestion[] = [];

    // 콘텐츠 최적화 제안
    if (breakdown.contents > this.tokenLimit * 0.4) {
      suggestions.push({
        type: "reduce_contents",
        description: "콘텐츠 정보에서 불필요한 필드 제거 또는 콘텐츠 수 제한",
        estimatedSavings: Math.floor(breakdown.contents * 0.3),
        priority: 1,
      });
    }

    // 학습 이력 최적화 제안
    if (breakdown.learningHistory > this.tokenLimit * 0.2) {
      suggestions.push({
        type: "reduce_history",
        description: "학습 이력을 최근 20개로 제한 및 상세 정보 제거",
        estimatedSavings: Math.floor(breakdown.learningHistory * 0.5),
        priority: 2,
      });
    }

    // 설정 최적화 제안
    if (breakdown.settings > this.tokenLimit * 0.1) {
      suggestions.push({
        type: "simplify_settings",
        description: "기본값과 동일한 설정 제거",
        estimatedSavings: Math.floor(breakdown.settings * 0.2),
        priority: 3,
      });
    }

    // 우선순위로 정렬
    suggestions.sort((a, b) => a.priority - b.priority);

    return {
      estimatedTokens,
      isWithinLimit,
      recommendedLimit: this.tokenLimit,
      suggestions,
      breakdown,
    };
  }

  // ============================================
  // Text Truncation
  // ============================================

  /**
   * 긴 텍스트 자르기
   */
  truncateText(
    text: string,
    maxTokens: number,
    suffix: string = "..."
  ): OptimizationResult<string> {
    const originalTokens = estimateTokens(text);

    if (originalTokens <= maxTokens) {
      return {
        data: text,
        originalTokens,
        optimizedTokens: originalTokens,
        savingsPercent: 0,
      };
    }

    // 대략적인 문자 수 계산 (한글 1.5 토큰/문자, 영어 0.25 토큰/문자)
    // 평균 0.5 토큰/문자로 가정
    const estimatedMaxChars = Math.floor(maxTokens / 0.5);
    const truncated = text.slice(0, estimatedMaxChars - suffix.length) + suffix;
    const optimizedTokens = estimateTokens(truncated);

    const savingsPercent =
      originalTokens > 0
        ? ((originalTokens - optimizedTokens) / originalTokens) * 100
        : 0;

    return {
      data: truncated,
      originalTokens,
      optimizedTokens,
      savingsPercent,
    };
  }

  // ============================================
  // Full Request Optimization
  // ============================================

  /**
   * 전체 요청 최적화
   */
  optimizeFullRequest<T extends {
    contents?: ContentInfoFull[];
    learningHistory?: LearningHistoryFull;
    [key: string]: unknown;
  }>(request: T): OptimizationResult<T> {
    const originalJson = JSON.stringify(request);
    const originalTokens = estimateTokens(originalJson);

    const optimized = { ...request };

    // 콘텐츠 최적화
    if (optimized.contents) {
      const contentResult = this.optimizeContentPayload(optimized.contents);
      optimized.contents = contentResult.data as unknown as ContentInfoFull[];
    }

    // 학습 이력 최적화
    if (optimized.learningHistory) {
      const historyResult = this.optimizeLearningHistory(optimized.learningHistory);
      optimized.learningHistory = historyResult.data as unknown as LearningHistoryFull;
    }

    const optimizedJson = JSON.stringify(optimized);
    const optimizedTokens = estimateTokens(optimizedJson);

    const savingsPercent =
      originalTokens > 0
        ? ((originalTokens - optimizedTokens) / originalTokens) * 100
        : 0;

    return {
      data: optimized,
      originalTokens,
      optimizedTokens,
      savingsPercent,
    };
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 기본 토큰 최적화 서비스 인스턴스
 */
let defaultService: TokenOptimizationService | null = null;

export function getTokenOptimizationService(
  tokenLimit?: number
): TokenOptimizationService {
  if (!defaultService || tokenLimit !== undefined) {
    defaultService = new TokenOptimizationService(tokenLimit);
  }
  return defaultService;
}

/**
 * 빠른 콘텐츠 최적화
 */
export function optimizeContents(
  contents: ContentInfoFull[]
): ContentInfoOptimized[] {
  const service = getTokenOptimizationService();
  return service.optimizeContentPayload(contents).data;
}

/**
 * 빠른 학습 이력 최적화
 */
export function optimizeLearningHistory(
  history: LearningHistoryFull
): LearningHistoryOptimized {
  const service = getTokenOptimizationService();
  return service.optimizeLearningHistory(history).data;
}
