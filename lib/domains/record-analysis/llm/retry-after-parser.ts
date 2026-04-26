// ============================================
// Retry-After / X-RateLimit-Reset 파서
//
// 429 응답에서 정확한 회복 시점 힌트를 추출하여 retry.ts / withExtendedRetry.ts
// 양쪽이 공유. 힌트가 없으면 null → 호출 측에서 기존 고정 백오프 사용.
//
// 지원 소스:
//   1) AI SDK APICallError.responseHeaders["retry-after" | "x-ratelimit-reset"]
//   2) Error.message 정규식 ("retry after 30s", "wait 12 sec" 등)
//   3) error.cause.headers (fetch Response)
// ============================================

import { APICallError } from "ai";

/** 안전한 정수 변환 (NaN → null) */
function toMs(value: string | number | null | undefined, unit: "s" | "ms"): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return unit === "s" ? n * 1000 : n;
}

/** HTTP-date 형식의 Retry-After (RFC 7231) 처리 */
function parseHttpDate(value: string): number | null {
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  const delta = ts - Date.now();
  return delta > 0 ? delta : 0;
}

/**
 * 응답 헤더 객체에서 retry 힌트 추출.
 * Retry-After (초 또는 HTTP-date) 우선, X-RateLimit-Reset (초) fallback.
 */
function extractFromHeaders(headers: Record<string, string | undefined> | Headers | null | undefined): number | null {
  if (!headers) return null;

  const get = (key: string): string | null => {
    if (headers instanceof Headers) return headers.get(key);
    return (headers[key] ?? headers[key.toLowerCase()] ?? null) || null;
  };

  const retryAfter = get("retry-after");
  if (retryAfter) {
    // 숫자 형식 ("23", "-1") 은 초 단위로만 해석. HTTP-date fallback 금지
    // (Date.parse 가 "-1" 을 유효 날짜로 해석해 0 반환하는 버그 회피).
    if (/^-?\d+$/.test(retryAfter.trim())) {
      const asSeconds = toMs(retryAfter, "s");
      if (asSeconds !== null) return asSeconds;
    } else {
      const asDate = parseHttpDate(retryAfter);
      if (asDate !== null) return asDate;
    }
  }

  const reset = get("x-ratelimit-reset");
  if (reset) {
    // x-ratelimit-reset 은 보통 초 단위 (절대 timestamp 또는 delta)
    const n = parseInt(reset, 10);
    if (Number.isFinite(n)) {
      // 1e9 이상이면 unix epoch (절대값) 으로 간주
      if (n > 1_000_000_000) {
        const delta = n * 1000 - Date.now();
        return delta > 0 ? delta : 0;
      }
      return n * 1000;
    }
  }

  return null;
}

/**
 * 429 등 rate-limit 에러에서 회복 대기 ms 추출.
 * 추출 실패 시 null → 호출 측은 기존 고정 백오프 사용.
 */
export function extractRetryAfterMs(error: unknown): number | null {
  // 1) AI SDK APICallError
  if (APICallError.isInstance(error) && error.responseHeaders) {
    const ms = extractFromHeaders(error.responseHeaders as Record<string, string>);
    if (ms !== null) return ms;
  }

  // 2) error.cause.headers (fetch Response 가 cause 에 박힌 케이스)
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause?: { headers?: unknown } }).cause;
    if (cause && typeof cause === "object" && "headers" in cause) {
      const ms = extractFromHeaders(cause.headers as Headers);
      if (ms !== null) return ms;
    }
  }

  // 3) Error.message 정규식
  if (error instanceof Error) {
    const retryMatch = error.message.match(/retry\s*(?:after|in)\s*(\d+)\s*(?:s|sec|seconds?)/i);
    if (retryMatch) return parseInt(retryMatch[1], 10) * 1000;

    const waitMatch = error.message.match(/wait\s*(\d+)\s*(?:s|sec|seconds?)/i);
    if (waitMatch) return parseInt(waitMatch[1], 10) * 1000;

    // Gemini 응답 메시지: "Please retry in 23.5s"
    const geminiMatch = error.message.match(/retry\s*in\s*(\d+(?:\.\d+)?)\s*s/i);
    if (geminiMatch) return Math.ceil(parseFloat(geminiMatch[1]) * 1000);
  }

  return null;
}
