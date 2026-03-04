/**
 * API 응답용 Cache-Control 헤더 프리셋
 */

/** 정적 참조 데이터 — 1h CDN + 24h stale-while-revalidate */
export const CACHE_STATIC: HeadersInit = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

/** 준정적 카탈로그 — 10m CDN + 1h stale-while-revalidate */
export const CACHE_SEMI_STATIC: HeadersInit = {
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
};

/** 유저별 데이터 — CDN 캐싱 방지 */
export const CACHE_PRIVATE: HeadersInit = {
  "Cache-Control": "private, no-cache",
};

/** 실시간성이 중요한 데이터 — 캐시 완전 비활성 */
export const CACHE_NO_STORE: HeadersInit = {
  "Cache-Control": "no-store",
};

/** 기존 Response에 캐시 헤더를 추가하여 반환 */
export function withCache(response: Response, headers: HeadersInit): Response {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
