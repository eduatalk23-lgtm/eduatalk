/**
 * React Query 캐시 전략 상수
 * 
 * 데이터 변경 빈도에 따라 staleTime을 분류:
 * - STATIC: 거의 변하지 않는 데이터 (마스터 데이터, 메타데이터)
 * - STABLE: 자주 변하지 않는 데이터 (블록 세트, 플랜 그룹)
 * - DYNAMIC: 자주 변하는 데이터 (플랜 목록, 세션)
 * - REALTIME: 실시간 업데이트가 필요한 데이터 (활성 플랜)
 */

// Static Data: 마스터 콘텐츠, 메타데이터 (5분)
export const CACHE_STALE_TIME_STATIC = 1000 * 60 * 5; // 5분

// Stable Data: 블록 세트, 플랜 그룹 메타데이터 (5분)
export const CACHE_STALE_TIME_STABLE = 1000 * 60 * 5; // 5분

// Dynamic Data: 플랜 목록, 스케줄 결과 (1분)
export const CACHE_STALE_TIME_DYNAMIC = 1000 * 60; // 1분

// Realtime Data: 활성 플랜, 세션 (10초)
export const CACHE_STALE_TIME_REALTIME = 1000 * 10; // 10초

// GC Time (캐시 유지 시간)
export const CACHE_GC_TIME_STATIC = 1000 * 60 * 30; // 30분
export const CACHE_GC_TIME_STABLE = 1000 * 60 * 15; // 15분
export const CACHE_GC_TIME_DYNAMIC = 1000 * 60 * 10; // 10분
export const CACHE_GC_TIME_REALTIME = 1000 * 60 * 5; // 5분

