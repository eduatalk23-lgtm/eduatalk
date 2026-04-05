/**
 * IP 기반 sliding window rate limiter.
 *
 * UPSTASH_REDIS_REST_URL 환경변수가 설정된 경우 → Upstash Redis 사용 (분산 정확도 보장).
 * 환경변수 없으면 → 인메모리 Map 폴백 (로컬 개발 / Vercel 인스턴스당 독립).
 */

import { NextRequest, NextResponse } from "next/server";

// ────────────────────────────────────────────────────────────
// Upstash 초기화 (환경변수 존재 시에만)
// ────────────────────────────────────────────────────────────

let upstashRatelimit: typeof import("@upstash/ratelimit").Ratelimit | null =
  null;
let upstashRedis: import("@upstash/redis").Redis | null = null;

async function initUpstash(): Promise<void> {
  if (upstashRedis) return; // 이미 초기화됨
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return;
  const { Redis } = await import("@upstash/redis");
  const { Ratelimit } = await import("@upstash/ratelimit");
  upstashRedis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  upstashRatelimit = Ratelimit;
}

// 초기화 프로미스 (모듈 로드 시 1회)
const _init = initUpstash();

// ────────────────────────────────────────────────────────────
// 공유 타입
// ────────────────────────────────────────────────────────────

interface RateLimitConfig {
  /** 윈도우 크기 (ms). 기본 60_000 (1분) */
  windowMs?: number;
  /** 윈도우당 최대 요청 수 */
  maxRequests: number;
  /**
   * Upstash Redis 버킷 prefix (라우트별 독립 카운터).
   * 예: "rl:admissions", "rl:gpa"
   * 미지정 시 "rl:default" 사용.
   */
  prefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface Limiter {
  check: (ip: string) => Promise<RateLimitResult>;
}

// ────────────────────────────────────────────────────────────
// 인메모리 폴백 구현
// ────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
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
    if (store.size === 0 && gcTimer) {
      clearInterval(gcTimer);
      gcTimer = null;
    }
  }, 60_000);
  if (gcTimer && typeof gcTimer === "object" && "unref" in gcTimer) {
    gcTimer.unref();
  }
}

function checkInMemory(
  ip: string,
  windowMs: number,
  maxRequests: number,
): RateLimitResult {
  ensureGc();
  const now = Date.now();
  const key = ip;
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

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

// ────────────────────────────────────────────────────────────
// 공개 API
// ────────────────────────────────────────────────────────────

export function createRateLimiter(config: RateLimitConfig): Limiter {
  const {
    windowMs = 60_000,
    maxRequests,
    prefix = "rl:default",
  } = config;

  // Upstash limiter 인스턴스를 lazy 생성 (init 완료 후)
  let upstashLimiter: InstanceType<typeof import("@upstash/ratelimit").Ratelimit> | null = null;

  return {
    check: async (ip: string): Promise<RateLimitResult> => {
      // Upstash 초기화 대기
      await _init;

      // Upstash 경로
      if (upstashRedis && upstashRatelimit) {
        if (!upstashLimiter) {
          upstashLimiter = new upstashRatelimit({
            redis: upstashRedis,
            limiter: upstashRatelimit.slidingWindow(maxRequests, `${windowMs}ms`),
            prefix,
          });
        }
        const { success, remaining, reset } = await upstashLimiter.limit(ip);
        return { allowed: success, remaining, resetAt: Number(reset) };
      }

      // 인메모리 폴백
      return checkInMemory(ip, windowMs, maxRequests);
    },
  };
}

/**
 * API route에서 사용하는 래퍼.
 * rate limit 초과 시 429 응답 반환, 허용 시 null 반환.
 */
export async function applyRateLimit(
  req: NextRequest,
  limiter: Limiter,
): Promise<NextResponse | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const result = await limiter.check(ip);

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
