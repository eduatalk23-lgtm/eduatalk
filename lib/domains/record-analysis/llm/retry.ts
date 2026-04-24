import * as Sentry from "@sentry/nextjs";
import { logActionWarn } from "@/lib/logging/actionLogger";
import { classifyLlmError, type LlmErrorCategory } from "./error-classifier";

// ============================================
// 에러 분류 기반 적응형 재시도 래퍼
//
// 에러 분류 규칙은 `error-classifier.ts` 단일 소스. withExtendedRetry 와 공유.
//
// 카테고리별 차등 백오프:
//   rate_limit   → 5s → 15s → 30s  (길게 대기)
//   timeout      → 1s → 2s  → 5s   (빠르게 재시도)
//   server_error → 2s → 5s  → 15s  (중간)
//   client_error → 재시도 안 함     (즉시 throw)
//   unknown      → 1s → 3s  → 10s  (기존과 동일)
// ============================================

interface BackoffStrategy {
  delays: number[];
  maxRetries: number;
}

const BACKOFF_STRATEGIES: Record<LlmErrorCategory, BackoffStrategy> = {
  rate_limit:   { delays: [5000, 15000, 30000], maxRetries: 3 },
  timeout:      { delays: [1000, 2000, 5000],   maxRetries: 3 },
  server_error: { delays: [2000, 5000, 15000],  maxRetries: 3 },
  client_error: { delays: [],                    maxRetries: 0 },
  unknown:      { delays: [1000, 3000, 10000],   maxRetries: 3 },
};

/**
 * 적응형 재시도 래퍼.
 *
 * - `adaptiveBackoff: true` (기본): 에러 카테고리별 자동 백오프
 * - `backoff` 배열 명시 전달 시: adaptive 무시, 지정된 백오프 사용 (하위 호환)
 * - `maxRetries` 명시 전달 시: adaptive의 maxRetries 대신 사용
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: number[];
    label?: string;
    /** 에러 카테고리별 자동 백오프 (기본: true) */
    adaptiveBackoff?: boolean;
  },
): Promise<T> {
  const {
    label = "LLM",
    adaptiveBackoff = true,
    backoff: explicitBackoff,
    maxRetries: explicitMaxRetries,
  } = options ?? {};

  // 명시적 backoff 배열 → 기존 동작 (하위 호환)
  const useAdaptive = adaptiveBackoff && !explicitBackoff;

  // 비적응형 기본값
  const defaultBackoff = explicitBackoff ?? [1000, 3000, 10000];
  const defaultMaxRetries = explicitMaxRetries ?? 3;

  let lastError: unknown;
  let attempt = 0;

  // 적응형은 첫 시도 후 에러 카테고리로 전략 결정
  const maxFirstPass = useAdaptive ? (explicitMaxRetries ?? 3) : defaultMaxRetries;

  for (attempt = 0; attempt <= maxFirstPass; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (useAdaptive) {
        const category = classifyLlmError(error);
        const strategy = BACKOFF_STRATEGIES[category];

        // client_error → 재시도 무의미
        if (strategy.maxRetries === 0) {
          throw error;
        }

        const effectiveMax = explicitMaxRetries ?? strategy.maxRetries;
        if (attempt >= effectiveMax) break;

        const delay = strategy.delays[Math.min(attempt, strategy.delays.length - 1)] ?? 10000;
        logActionWarn(
          { domain: "record-analysis", action: "llm-retry" },
          `[${label}] ${category} 에러, 재시도 ${attempt + 1}/${effectiveMax} (${delay}ms 대기)`,
        );
        await new Promise<void>((r) => setTimeout(r, delay));
      } else {
        if (attempt >= defaultMaxRetries) break;
        const delay = defaultBackoff[Math.min(attempt, defaultBackoff.length - 1)];
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
  }

  // 최종 실패 시 Sentry에 재시도 컨텍스트 기록
  if (process.env.NODE_ENV === "production") {
    Sentry.setContext("llm_retry", {
      label,
      totalAttempts: attempt + 1,
      adaptive: useAdaptive,
      errorCategory: useAdaptive && lastError ? classifyLlmError(lastError) : undefined,
    });
  }

  throw lastError;
}
