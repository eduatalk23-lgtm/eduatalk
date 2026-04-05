/**
 * IP 기반 인메모리 sliding window rate limiter.
 *
 * Vercel 서버리스 특성상 인스턴스당 독립 → 대략적 제한.
 * 정밀 제한이 필요하면 Upstash Redis로 교체 가능.
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  /** 윈도우 크기 (ms). 기본 60_000 (1분) */
  windowMs?: number;
  /** 윈도우당 최대 요청 수 */
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// GC: 만료 엔트리 정리 (60초 주기)
let gcTimer: ReturnType<typeof setInterval> | null = null;

function ensureGc() {
  if (gcTimer) return;
  gcTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
    // 모든 엔트리가 정리되면 타이머 해제
    if (store.size === 0 && gcTimer) {
      clearInterval(gcTimer);
      gcTimer = null;
    }
  }, 60_000);
  // Node.js에서 프로세스 종료를 막지 않도록
  if (gcTimer && typeof gcTimer === "object" && "unref" in gcTimer) {
    gcTimer.unref();
  }
}

export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs = 60_000, maxRequests } = config;

  function check(ip: string): RateLimitResult {
    ensureGc();
    const now = Date.now();
    const key = ip;
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      // 새 윈도우 시작
      const resetAt = now + windowMs;
      store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    // 기존 윈도우
    entry.count += 1;
    if (entry.count > maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  return { check };
}

/**
 * API route에서 사용하는 래퍼.
 * rate limit 초과 시 429 응답 반환, 허용 시 null 반환.
 */
export function applyRateLimit(
  req: NextRequest,
  limiter: ReturnType<typeof createRateLimiter>,
): NextResponse | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const result = limiter.check(ip);

  if (!result.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((result.resetAt - Date.now()) / 1000),
          ),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetAt),
        },
      },
    );
  }

  return null;
}
