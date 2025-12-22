/**
 * 재조정 미리보기 결과 캐싱
 * 
 * 미리보기 결과를 캐싱하여 동일한 요청에 대해 빠르게 응답합니다.
 * LRU(Least Recently Used) 정책으로 최대 항목 수를 제한합니다.
 * 
 * @module lib/reschedule/previewCache
 */

import type { ReschedulePreviewResult } from '@/lib/domains/plan';
import type { AdjustmentInput } from './scheduleEngine';

// ============================================
// 설정 (환경 변수 지원)
// ============================================

/**
 * 캐시 설정값
 * 환경 변수로 오버라이드 가능
 */
export const CACHE_CONFIG = {
  /** 캐시 TTL (Time To Live) - 기본 5분 */
  TTL_MS: parseInt(process.env.RESCHEDULE_CACHE_TTL_MS || '300000', 10),
  /** 캐시 최대 항목 수 - 기본 100개 */
  MAX_ITEMS: parseInt(process.env.RESCHEDULE_CACHE_MAX_ITEMS || '100', 10),
  /** 캐시 정리 주기 - 기본 10분 */
  CLEANUP_INTERVAL_MS: parseInt(process.env.RESCHEDULE_CACHE_CLEANUP_MS || '600000', 10),
} as const;

// ============================================
// 타입 정의
// ============================================

/**
 * 캐시 항목
 */
interface CacheItem {
  result: ReschedulePreviewResult;
  timestamp: number;
  expiresAt: number;
  lastAccessed: number; // LRU를 위한 마지막 접근 시간
}

// ============================================
// 캐시 저장소 (메모리 기반 LRU)
// ============================================

/**
 * 캐시 저장소 (Map 기반)
 * 프로덕션에서는 Redis 등을 사용하는 것을 권장합니다.
 */
const cacheStore = new Map<string, CacheItem>();

/**
 * LRU 캐시 정리 (최대 항목 수 초과 시 가장 오래된 항목 제거)
 */
function evictLRU(): void {
  if (cacheStore.size <= CACHE_CONFIG.MAX_ITEMS) return;

  // 삭제할 항목 수
  const itemsToRemove = cacheStore.size - CACHE_CONFIG.MAX_ITEMS;
  
  // lastAccessed 기준으로 정렬하여 가장 오래된 항목 삭제
  const entries = Array.from(cacheStore.entries())
    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  
  for (let i = 0; i < itemsToRemove; i++) {
    if (entries[i]) {
      cacheStore.delete(entries[i][0]);
    }
  }
  
  if (itemsToRemove > 0) {
    console.debug(`[previewCache] LRU 정리: ${itemsToRemove}개 항목 제거 (현재: ${cacheStore.size}개)`);
  }
}

// 캐시 정리 타이머 시작
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredCache();
  }, CACHE_CONFIG.CLEANUP_INTERVAL_MS);
}

// ============================================
// 캐시 키 생성
// ============================================

/**
 * 미리보기 캐시 키 생성
 * 
 * @param groupId 플랜 그룹 ID
 * @param adjustments 조정 요청 목록
 * @param rescheduleDateRange 재조정할 플랜 범위 (선택)
 * @param placementDateRange 새 플랜 배치 범위 (선택)
 * @param includeToday 오늘 포함 여부
 * @returns 캐시 키
 */
export function generatePreviewCacheKey(
  groupId: string,
  adjustments: AdjustmentInput[],
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): string {
  // 조정 요청을 정렬하여 동일한 조정에 대해 같은 키 생성
  const sortedAdjustments = [...adjustments].sort((a, b) => {
    if (a.plan_content_id !== b.plan_content_id) {
      return a.plan_content_id.localeCompare(b.plan_content_id);
    }
    return a.change_type.localeCompare(b.change_type);
  });

  // 캐시 키 구성 요소
  const keyComponents = {
    adjustments: sortedAdjustments,
    rescheduleDateRange: rescheduleDateRange || null,
    placementDateRange: placementDateRange || null,
    includeToday,
  };

  // JSON 문자열로 직렬화
  const keyStr = JSON.stringify(keyComponents);
  
  // FNV-1a 해시 (빠르고 충돌 적음)
  let hash = 2166136261;
  for (let i = 0; i < keyStr.length; i++) {
    hash ^= keyStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `reschedule_preview:${groupId}:${(hash >>> 0).toString(36)}`;
}

// ============================================
// 캐시 조회/저장
// ============================================

/**
 * 캐시된 미리보기 결과 조회
 * 
 * @param key 캐시 키
 * @returns 캐시된 결과 또는 null
 */
export async function getCachedPreview(
  key: string
): Promise<ReschedulePreviewResult | null> {
  const item = cacheStore.get(key);
  
  if (!item) {
    return null;
  }

  // 만료 확인
  if (Date.now() > item.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  // LRU: 마지막 접근 시간 갱신
  item.lastAccessed = Date.now();

  return item.result;
}

/**
 * 미리보기 결과 캐싱
 * 
 * @param key 캐시 키
 * @param result 미리보기 결과
 */
export async function cachePreviewResult(
  key: string,
  result: ReschedulePreviewResult
): Promise<void> {
  const now = Date.now();
  
  cacheStore.set(key, {
    result,
    timestamp: now,
    expiresAt: now + CACHE_CONFIG.TTL_MS,
    lastAccessed: now,
  });

  // 캐시 크기 제한 초과 시 LRU 정리
  evictLRU();
}

/**
 * 캐시 삭제
 * 
 * @param key 캐시 키
 */
export function deleteCachedPreview(key: string): void {
  cacheStore.delete(key);
}

/**
 * 플랜 그룹 관련 캐시 모두 삭제
 * 
 * @param groupId 플랜 그룹 ID
 */
export function clearGroupCache(groupId: string): void {
  const prefix = `reschedule_preview:${groupId}:`;
  const keysToDelete: string[] = [];
  
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach((key) => cacheStore.delete(key));
}

/**
 * 만료된 캐시 정리
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, item] of cacheStore.entries()) {
    if (now > item.expiresAt) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach((key) => cacheStore.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`[previewCache] ${keysToDelete.length}개의 만료된 캐시 항목 정리`);
  }
}

/**
 * 캐시 통계 조회
 * 
 * @returns 캐시 통계
 */
export function getCacheStats(): {
  totalItems: number;
  expiredItems: number;
  memoryUsage: number; // 대략적인 메모리 사용량 (바이트)
} {
  const now = Date.now();
  let expiredCount = 0;
  let totalSize = 0;
  
  for (const item of cacheStore.values()) {
    if (now > item.expiresAt) {
      expiredCount++;
    }
    // 대략적인 크기 계산 (JSON 문자열 길이)
    totalSize += JSON.stringify(item.result).length;
  }
  
  return {
    totalItems: cacheStore.size,
    expiredItems: expiredCount,
    memoryUsage: totalSize,
  };
}

