type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5분 (밀리초)

/**
 * 캐시에서 데이터 조회
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    // 캐시 만료
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * 캐시에 데이터 저장
 */
export function setCached<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * 캐시 키 생성
 */
export function getCacheKey(studentId: string): string {
  return `risk-${studentId}`;
}

/**
 * 캐시 삭제
 */
export function clearCache(studentId?: string): void {
  if (studentId) {
    cache.delete(getCacheKey(studentId));
  } else {
    cache.clear();
  }
}

