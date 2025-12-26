/**
 * React Query 캐시 전략 상수
 *
 * 데이터 변경 빈도에 따라 staleTime을 분류:
 * - STATIC: 거의 변하지 않는 데이터 (마스터 콘텐츠, 교재 메타데이터)
 * - STABLE: 자주 변하지 않는 데이터 (학생 정보, 블록 세트, 플랜 그룹)
 * - DYNAMIC: 자주 변하는 데이터 (플랜 목록, 스케줄 결과)
 * - REALTIME: 실시간 업데이트가 필요한 데이터 (활성 플랜, 타이머)
 */

// Static Data: 마스터 콘텐츠, 교재 메타데이터 (2시간)
// - 거의 변하지 않으므로 길게 캐싱
export const CACHE_STALE_TIME_STATIC = 1000 * 60 * 120; // 2시간

// Stable Data: 학생 정보, 블록 세트, 플랜 그룹 메타데이터 (30분)
// - 세션 중 변경될 가능성이 낮음
export const CACHE_STALE_TIME_STABLE = 1000 * 60 * 30; // 30분

// Dynamic Data: 플랜 목록, 스케줄 결과 (1분)
// - 다른 탭/기기에서 변경될 수 있음
export const CACHE_STALE_TIME_DYNAMIC = 1000 * 60; // 1분

// Realtime Data: 활성 플랜, 타이머 (10초)
// - 즉시 반영이 필요한 데이터
export const CACHE_STALE_TIME_REALTIME = 1000 * 10; // 10초

// GC Time (캐시 유지 시간) - staleTime의 2배 권장
export const CACHE_GC_TIME_STATIC = 1000 * 60 * 240; // 4시간
export const CACHE_GC_TIME_STABLE = 1000 * 60 * 60; // 1시간
export const CACHE_GC_TIME_DYNAMIC = 1000 * 60 * 10; // 10분
export const CACHE_GC_TIME_REALTIME = 1000 * 60 * 5; // 5분

