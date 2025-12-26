/**
 * LRU Cache 구현
 *
 * Phase 2 성능 최적화: LRU 캐시
 * 콘텐츠 데이터 캐싱을 위한 LRU(Least Recently Used) 캐시입니다.
 */

import { CACHE } from "../constants/wizardConstants";

/**
 * 캐시 엔트리 타입
 */
type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

/**
 * LRU Cache 옵션
 */
type LRUCacheOptions = {
  /** 최대 캐시 항목 수 */
  maxSize?: number;
  /** TTL (Time To Live) in milliseconds */
  ttl?: number;
};

/**
 * LRU Cache 클래스
 *
 * - 최대 크기 제한: 캐시 크기가 최대치에 도달하면 가장 오래 사용되지 않은 항목 제거
 * - TTL 지원: 일정 시간이 지난 항목 자동 만료
 * - 접근 시 순서 갱신: get 시 해당 항목이 가장 최근 사용된 것으로 갱신
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private ttl: number;

  constructor(options: LRUCacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize ?? CACHE.MAX_CACHE_ENTRIES;
    this.ttl = options.ttl ?? CACHE.CONTENT_CACHE_TTL_MS;
  }

  /**
   * 캐시에서 값 가져오기
   * 접근 시 해당 항목이 가장 최근 사용된 것으로 갱신됨
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // TTL 확인
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    // LRU 순서 갱신: 삭제 후 다시 추가하여 맨 뒤로 이동
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * 캐시에 값 설정
   */
  set(key: K, value: V): void {
    // 이미 존재하면 삭제 (순서 갱신)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 최대 크기 도달 시 가장 오래된 항목 제거
    else if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * 캐시에 키가 존재하는지 확인
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 캐시에서 항목 삭제
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * 캐시 전체 삭제
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 현재 캐시 크기
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 만료된 항목인지 확인
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  /**
   * 가장 오래된 항목 제거 (LRU eviction)
   * Map은 삽입 순서를 유지하므로, 첫 번째 항목이 가장 오래된 항목
   */
  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * 만료된 항목들 정리
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: K[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * 캐시 통계 정보
   */
  stats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  /**
   * 디버그용: 모든 키 목록
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * 콘텐츠 상세 정보 캐시 (싱글톤)
 */
export const contentDetailsLRUCache = new LRUCache<string, unknown>({
  maxSize: CACHE.MAX_CACHE_ENTRIES,
  ttl: CACHE.CONTENT_CACHE_TTL_MS,
});

/**
 * 콘텐츠 메타데이터 캐시 (싱글톤)
 */
export const contentMetadataLRUCache = new LRUCache<string, unknown>({
  maxSize: CACHE.MAX_CACHE_ENTRIES,
  ttl: CACHE.CONTENT_CACHE_TTL_MS,
});
