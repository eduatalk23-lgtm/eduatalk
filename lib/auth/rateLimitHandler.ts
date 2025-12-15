/**
 * Rate limit 에러 처리 유틸리티
 */

/**
 * Supabase 에러 인터페이스 (PostgrestError, AuthError와 호환)
 */
export interface SupabaseErrorLike {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
  details?: string;
  hint?: string;
}

/**
 * Rate limit 에러 체크
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  const err = error as SupabaseErrorLike;
  return (
    err.code === "over_request_rate_limit" ||
    err.status === 429 ||
    (err.message?.toLowerCase().includes("rate limit") ?? false)
  );
}

/**
 * Refresh token 에러 체크 (재시도 불가능)
 */
export function isRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  const err = error as SupabaseErrorLike;
  const errorMessage = err.message?.toLowerCase() || "";
  const errorCode = err.code?.toLowerCase() || "";
  
  return (
    errorMessage.includes("refresh token") ||
    errorMessage.includes("refresh_token") ||
    errorMessage.includes("session") ||
    errorCode === "refresh_token_not_found"
  );
}

/**
 * 재시도 가능한 에러 체크
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  // Refresh token 에러는 재시도 불가능
  if (isRefreshTokenError(error)) {
    return false;
  }
  
  const err = error as SupabaseErrorLike;
  return (
    isRateLimitError(error) ||
    err.code === "ECONNRESET" ||
    err.code === "ETIMEDOUT" ||
    err.status === 503 ||
    err.status === 502
  );
}

/**
 * 지수 백오프를 사용한 재시도 유틸리티
 * @param fn 재시도할 함수
 * @param maxRetries 최대 재시도 횟수 (기본값: 2)
 * @param initialDelay 초기 지연 시간 (밀리초, 기본값: 2000)
 * @param isAuthRequest 인증 요청 여부 (true면 더 긴 대기 시간)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 2000,
  isAuthRequest: boolean = false
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Refresh token 에러는 즉시 반환 (재시도 불가능)
      if (isRefreshTokenError(error)) {
        throw error;
      }

      // Rate limit 에러인 경우 더 긴 대기 시간
      if (isRateLimitError(error) && attempt < maxRetries) {
        // 인증 요청인 경우 더 긴 대기 시간 (5초, 10초, 15초)
        const baseDelay = isAuthRequest 
          ? initialDelay * (attempt + 1) * 2.5 
          : initialDelay * Math.pow(2, attempt);
        
        // jitter 추가 (0~1초 랜덤)
        const delay = baseDelay + Math.random() * 1000;
        
        const err = error as SupabaseErrorLike;
        console.warn(`[rateLimit] 재시도 ${attempt + 1}/${maxRetries} (${Math.round(delay)}ms 후)`, {
          code: err.code,
          status: err.status,
        });
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // 재시도 가능한 에러가 아니면 즉시 실패
      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error;
      }

      // 재시도 가능한 에러인 경우 백오프 후 재시도
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 요청 간격 제어 (throttling)
 */
class RequestThrottler {
  private lastRequestTime: number = 0;
  private minInterval: number;

  constructor(minIntervalMs: number = 100) {
    this.minInterval = minIntervalMs;
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    return fn();
  }
}

// 인증 요청용 throttler (100ms 간격)
export const authRequestThrottler = new RequestThrottler(100);

