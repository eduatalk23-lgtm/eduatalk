/**
 * 서버 사이드 메모리 캐시 유틸리티
 *
 * LRU(Least Recently Used) 방식의 TTL 지원 메모리 캐시입니다.
 * 서버 컴포넌트/액션에서 DB 쿼리 결과를 캐싱하는 데 사용됩니다.
 *
 * @module lib/cache/memoryCache
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  lastAccessed: number;
};

/**
 * 서버 사이드 LRU 메모리 캐시
 */
export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  /**
   * @param maxSize 최대 캐시 항목 수 (기본: 1000)
   * @param defaultTtlMs 기본 TTL (밀리초, 기본: 5분)
   */
  constructor(maxSize = 1000, defaultTtlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * 캐시에서 값을 가져옵니다.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // TTL 만료 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // 접근 시간 업데이트 (LRU)
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  /**
   * 캐시에 값을 저장합니다.
   */
  set(key: string, data: T, ttlMs?: number): void {
    // 캐시 크기 제한 확인
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      expiresAt: now + (ttlMs ?? this.defaultTtl),
      lastAccessed: now,
    });
  }

  /**
   * 캐시에서 값을 삭제합니다.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 특정 prefix로 시작하는 키들을 모두 삭제합니다.
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 특정 prefix로 시작하는 키들의 존재 여부를 확인합니다.
   */
  hasKeyWithPrefix(prefix: string): boolean {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        const entry = this.cache.get(key);
        if (entry && Date.now() <= entry.expiresAt) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 캐시를 모두 비웁니다.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 현재 캐시 크기를 반환합니다.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 만료된 항목들을 정리합니다.
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * LRU 방식으로 가장 오래된 항목을 제거합니다.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 캐시 통계를 반환합니다 (디버깅용).
   */
  getStats(): {
    size: number;
    maxSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let oldest = Infinity;
    let newest = 0;

    for (const entry of this.cache.values()) {
      if (entry.lastAccessed < oldest) oldest = entry.lastAccessed;
      if (entry.lastAccessed > newest) newest = entry.lastAccessed;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      oldestEntry: oldest === Infinity ? null : oldest,
      newestEntry: newest === 0 ? null : newest,
    };
  }
}

/**
 * 캐시 키 생성 헬퍼
 */
export function createCacheKey(
  ...parts: (string | number | null | undefined)[]
): string {
  return parts.filter((p) => p !== null && p !== undefined).join(":");
}

// ============================================
// 전역 캐시 인스턴스들 (도메인별)
// ============================================

/** 콘텐츠 메타데이터 캐시 (5분 TTL, 최대 500개) */
export const contentMetadataCache = new MemoryCache<unknown>(
  500,
  5 * 60 * 1000
);

/** 콘텐츠 소요시간 캐시 (5분 TTL, 최대 500개) */
export const contentDurationCache = new MemoryCache<number>(500, 5 * 60 * 1000);

/** 콘텐츠 ID 매핑 캐시 (5분 TTL, 최대 1000개) */
export const contentIdMappingCache = new MemoryCache<string>(
  1000,
  5 * 60 * 1000
);

/** 학습 세션 캐시 (1분 TTL, 최대 200개) */
export const studySessionCache = new MemoryCache<unknown>(200, 1 * 60 * 1000);

/** 진행률 데이터 캐시 (5분 TTL, 최대 500개) */
export const progressCache = new MemoryCache<unknown>(500, 5 * 60 * 1000);

// ============================================
// LLM 관련 캐시 인스턴스들
// ============================================

/** LLM 플랜 최적화 결과 캐시 (1일 TTL, 최대 100개) */
export const llmOptimizationCache = new MemoryCache<unknown>(
  100,
  24 * 60 * 60 * 1000 // 1일
);

/** LLM 콘텐츠 추천 결과 캐시 (1일 TTL, 최대 100개) */
export const llmRecommendationCache = new MemoryCache<unknown>(
  100,
  24 * 60 * 60 * 1000 // 1일
);
