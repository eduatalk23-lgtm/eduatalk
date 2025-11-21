/**
 * 클라이언트 사이드 캐싱 유틸리티
 * 브라우저의 sessionStorage를 활용한 간단한 캐싱
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
};

const CACHE_PREFIX = "app_cache_";

export function setCache<T>(key: string, data: T, ttl: number = 1000 * 60 * 5): void {
  if (typeof window === "undefined") return;

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    // sessionStorage가 가득 찬 경우 무시
    console.warn("[cache] 캐시 저장 실패:", error);
  }
}

export function getCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const item = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!item) return null;

    const entry: CacheEntry<T> = JSON.parse(item);
    const now = Date.now();

    // TTL 확인
    if (now - entry.timestamp > entry.ttl) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn("[cache] 캐시 읽기 실패:", error);
    return null;
  }
}

export function clearCache(key?: string): void {
  if (typeof window === "undefined") return;

  try {
    if (key) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } else {
      // 모든 캐시 삭제
      const keys = Object.keys(sessionStorage);
      keys.forEach((k) => {
        if (k.startsWith(CACHE_PREFIX)) {
          sessionStorage.removeItem(k);
        }
      });
    }
  } catch (error) {
    console.warn("[cache] 캐시 삭제 실패:", error);
  }
}

/**
 * 캐시 키 생성 헬퍼
 */
export function createCacheKey(...parts: (string | number | null | undefined)[]): string {
  return parts.filter(Boolean).join(":");
}

