/**
 * 재조정 미리보기 결과 캐싱
 * 
 * 미리보기 결과를 캐싱하여 동일한 요청에 대해 빠르게 응답합니다.
 * 
 * @module lib/reschedule/previewCache
 */

import type { ReschedulePreviewResult } from '@/app/(student)/actions/plan-groups/reschedule';
import type { AdjustmentInput } from './scheduleEngine';

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
}

// ============================================
// 캐시 저장소 (메모리 기반)
// ============================================

/**
 * 캐시 저장소 (Map 기반)
 * 프로덕션에서는 Redis 등을 사용하는 것을 권장합니다.
 */
const cacheStore = new Map<string, CacheItem>();

/**
 * 캐시 TTL (Time To Live) - 5분
 */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * 캐시 정리 주기 (10분마다 만료된 항목 제거)
 */
const CACHE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10분

// 캐시 정리 타이머 시작
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredCache();
  }, CACHE_CLEANUP_INTERVAL_MS);
}

// ============================================
// 캐시 키 생성
// ============================================

/**
 * 미리보기 캐시 키 생성
 * 
 * @param groupId 플랜 그룹 ID
 * @param adjustments 조정 요청 목록
 * @returns 캐시 키
 */
export function generatePreviewCacheKey(
  groupId: string,
  adjustments: AdjustmentInput[]
): string {
  // 조정 요청을 정렬하여 동일한 조정에 대해 같은 키 생성
  const sortedAdjustments = [...adjustments].sort((a, b) => {
    if (a.plan_content_id !== b.plan_content_id) {
      return a.plan_content_id.localeCompare(b.plan_content_id);
    }
    return a.change_type.localeCompare(b.change_type);
  });

  // JSON 문자열로 직렬화하여 키 생성
  const adjustmentsStr = JSON.stringify(sortedAdjustments);
  
  // 간단한 해시 생성 (실제로는 crypto를 사용하는 것이 좋음)
  let hash = 0;
  for (let i = 0; i < adjustmentsStr.length; i++) {
    const char = adjustmentsStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `reschedule_preview:${groupId}:${Math.abs(hash).toString(36)}`;
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
    expiresAt: now + CACHE_TTL_MS,
  });
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

