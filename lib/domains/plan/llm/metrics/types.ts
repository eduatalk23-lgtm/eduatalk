/**
 * LLM 추천 시스템 메트릭스 타입 정의
 *
 * 추천 품질, 비용, 성능 추적을 위한 메트릭스 스키마
 *
 * @module lib/domains/plan/llm/metrics/types
 */

/**
 * 추천 전략 타입
 */
export type RecommendationStrategy = "cache" | "recommend" | "coldStart" | "enhanced";

/**
 * 메트릭스 소스 (어떤 액션에서 발생했는지)
 */
export type MetricsSource =
  | "recommendContent"
  | "unifiedContentRecommendation"
  | "coldStartPipeline"
  | "enhancedRecommendContent"
  | "generatePlan";

/**
 * LLM 토큰 사용량
 */
export interface TokenUsage {
  /** 입력 토큰 수 */
  inputTokens: number;
  /** 출력 토큰 수 */
  outputTokens: number;
  /** 전체 토큰 수 */
  totalTokens: number;
}

/**
 * LLM 비용 정보
 */
export interface CostInfo {
  /** 예상 비용 (USD) */
  estimatedUSD: number;
  /** 사용된 모델 티어 */
  modelTier: string;
  /** 사용된 프로바이더 (gemini, anthropic, openai) */
  provider?: string;
}

/**
 * 웹 검색 메트릭스
 */
export interface WebSearchMetrics {
  /** 웹 검색 활성화 여부 */
  enabled: boolean;
  /** 검색 쿼리 수 */
  queriesCount: number;
  /** 검색 결과 수 */
  resultsCount: number;
  /** DB에 저장된 결과 수 */
  savedCount?: number;
}

/**
 * 캐시 메트릭스
 */
export interface CacheMetrics {
  /** 캐시 히트 여부 */
  hit: boolean;
  /** 캐시 키 (디버깅용) */
  key?: string;
}

/**
 * 추천 결과 메트릭스
 */
export interface RecommendationResultMetrics {
  /** 추천된 콘텐츠 수 */
  count: number;
  /** 사용된 전략 */
  strategy: RecommendationStrategy;
  /** 폴백 발생 여부 */
  usedFallback: boolean;
  /** 폴백 이유 */
  fallbackReason?: string;
}

/**
 * 에러 메트릭스
 */
export interface ErrorMetrics {
  /** 에러 발생 여부 */
  occurred: boolean;
  /** 에러 타입 */
  type?: string;
  /** 에러 메시지 */
  message?: string;
  /** 에러 발생 단계 */
  stage?: string;
}

/**
 * LLM 추천 메트릭스 전체
 */
export interface LLMRecommendationMetrics {
  /** 메트릭스 ID (유니크) */
  id: string;
  /** 타임스탬프 */
  timestamp: string;
  /** 메트릭스 소스 */
  source: MetricsSource;

  // 컨텍스트 정보
  /** 테넌트 ID */
  tenantId?: string;
  /** 학생 ID */
  studentId?: string;
  /** 사용자 ID (관리자 등) */
  userId?: string;
  /** 상관 ID (요청 추적용) */
  correlationId?: string;

  // 성능 메트릭스
  /** 전체 처리 시간 (ms) */
  durationMs: number;
  /** LLM API 호출 시간 (ms) */
  llmCallDurationMs?: number;

  // 토큰 및 비용
  /** 토큰 사용량 */
  tokenUsage?: TokenUsage;
  /** 비용 정보 */
  cost?: CostInfo;

  // 추천 결과
  /** 추천 결과 메트릭스 */
  recommendation: RecommendationResultMetrics;

  // 선택적 메트릭스
  /** 웹 검색 메트릭스 */
  webSearch?: WebSearchMetrics;
  /** 캐시 메트릭스 */
  cache?: CacheMetrics;
  /** 에러 메트릭스 */
  error?: ErrorMetrics;

  // 추가 메타데이터
  /** 요청 파라미터 요약 */
  requestParams?: {
    subjectCategory?: string;
    subject?: string;
    contentType?: string;
    maxRecommendations?: number;
    focusArea?: string;
  };
}

/**
 * 메트릭스 집계 통계 (대시보드용)
 */
export interface AggregatedMetrics {
  /** 집계 기간 */
  period: {
    start: string;
    end: string;
  };

  // 요청 통계
  /** 전체 요청 수 */
  totalRequests: number;
  /** 성공 요청 수 */
  successCount: number;
  /** 실패 요청 수 */
  failureCount: number;
  /** 성공률 (%) */
  successRate: number;

  // 성능 통계
  /** 평균 응답 시간 (ms) */
  avgDurationMs: number;
  /** P95 응답 시간 (ms) */
  p95DurationMs: number;
  /** 최대 응답 시간 (ms) */
  maxDurationMs: number;

  // 토큰 통계
  /** 전체 입력 토큰 */
  totalInputTokens: number;
  /** 전체 출력 토큰 */
  totalOutputTokens: number;
  /** 전체 비용 (USD) */
  totalCostUSD: number;

  // 전략별 통계
  /** 전략별 사용 횟수 */
  strategyUsage: Record<RecommendationStrategy, number>;

  // 캐시 통계
  /** 캐시 히트 수 */
  cacheHits: number;
  /** 캐시 히트율 (%) */
  cacheHitRate: number;
}
