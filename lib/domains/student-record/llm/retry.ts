// ============================================
// 지수 백오프 재시도 래퍼
// LLM 호출 실패 시 1s → 3s → 10s 대기 후 재시도 (최대 3회)
// ============================================

/**
 * 지수 백오프 재시도 래퍼.
 * LLM 호출 실패 시 1s → 3s → 10s 대기 후 재시도 (최대 3회).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; backoff?: number[]; label?: string },
): Promise<T> {
  const { maxRetries = 3, backoff = [1000, 3000, 10000], label = "LLM" } = options ?? {};
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = backoff[Math.min(attempt, backoff.length - 1)];
        // Rate limit / quota 에러는 즉시 재시도하지 않고 반드시 백오프 대기
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
