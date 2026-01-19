/**
 * 스케줄 계산 결과 캐싱 유틸리티
 *
 * LRU (Least Recently Used) 캐시 구현
 * - Map의 삽입 순서 특성을 활용하여 LRU 정책 구현
 * - 캐시 히트 시 항목을 맨 뒤로 이동 (최근 사용)
 * - 캐시 초과 시 맨 앞 항목 제거 (가장 오래 사용 안됨)
 */

import type { ScheduleAvailabilityResult } from "@/lib/scheduler/utils/scheduleCalculator";

/**
 * 스케줄 계산 입력 파라미터 타입
 */
export type ScheduleCalculationParams = {
  periodStart: string;
  periodEnd: string;
  blockSetId: string;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string;
  }>;
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
    travel_time?: number;
  }>;
  schedulerType: "1730_timetable";
  schedulerOptions?: {
    study_days?: number;
    review_days?: number;
  };
  timeSettings?: {
    lunch_time?: { start: string; end: string };
    camp_study_hours?: { start: string; end: string };
    camp_self_study_hours?: { start: string; end: string };
    designated_holiday_hours?: { start: string; end: string };
    use_self_study_with_blocks?: boolean;
    enable_self_study_for_holidays?: boolean;
    enable_self_study_for_study_days?: boolean;
  };
};

/**
 * 캐시 키 생성 함수 (최적화됨)
 *
 * - 핵심 필드만 사용하여 키 생성
 * - 배열은 길이와 첫/마지막 항목의 해시만 사용 (성능 최적화)
 */
function generateCacheKey(params: ScheduleCalculationParams): string {
  // 배열 해시 헬퍼: 길이 + 첫/마지막 항목 정보
  const hashArray = <T>(arr: T[] | undefined, keyFn: (item: T) => string): string => {
    if (!arr || arr.length === 0) return "[]";
    if (arr.length === 1) return `[${keyFn(arr[0])}]`;
    return `[${arr.length}:${keyFn(arr[0])}:${keyFn(arr[arr.length - 1])}]`;
  };

  const exclusionKey = hashArray(params.exclusions, (e) => e.exclusion_date);
  const academyKey = hashArray(params.academySchedules, (s) => `${s.day_of_week}:${s.start_time}`);

  // 시간 설정 해시 (null-safe)
  const timeKey = params.timeSettings
    ? `${params.timeSettings.lunch_time?.start || ""}|${params.timeSettings.camp_study_hours?.start || ""}`
    : "";

  // 스케줄러 옵션 해시
  const optKey = params.schedulerOptions
    ? `${params.schedulerOptions.study_days || 6}:${params.schedulerOptions.review_days || 1}`
    : "6:1";

  return `${params.periodStart}|${params.periodEnd}|${params.blockSetId}|${exclusionKey}|${academyKey}|${params.schedulerType}|${optKey}|${timeKey}`;
}

/**
 * 캐시 결과 타입 (타임스탬프 포함)
 */
export type CacheResultWithTimestamp = {
  result: ScheduleAvailabilityResult;
  timestamp: number;
  isFromCache: boolean;
};

/**
 * LRU 스케줄 계산 결과 캐시
 *
 * - 최대 50개 항목 저장
 * - TTL: 5분
 * - LRU 정책: 가장 오래 사용되지 않은 항목 먼저 제거
 */
class ScheduleCache {
  private cache: Map<string, { result: ScheduleAvailabilityResult; timestamp: number }> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5분
  private readonly MAX_SIZE = 50; // 캐시 최대 크기 증가 (10 → 50)

  /**
   * 캐시에서 결과 조회 (LRU 업데이트)
   */
  get(params: ScheduleCalculationParams): ScheduleAvailabilityResult | null {
    const key = generateCacheKey(params);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // TTL 체크
    const now = Date.now();
    if (now - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    // LRU 업데이트: 항목을 맨 뒤로 이동 (최근 사용)
    this.cache.delete(key);
    this.cache.set(key, cached);

    return cached.result;
  }

  /**
   * 캐시에서 결과 조회 (타임스탬프 포함, LRU 업데이트)
   */
  getWithTimestamp(params: ScheduleCalculationParams): CacheResultWithTimestamp | null {
    const key = generateCacheKey(params);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // TTL 체크
    const now = Date.now();
    if (now - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    // LRU 업데이트: 항목을 맨 뒤로 이동 (최근 사용)
    this.cache.delete(key);
    this.cache.set(key, cached);

    return {
      result: cached.result,
      timestamp: cached.timestamp,
      isFromCache: true,
    };
  }

  /**
   * 캐시에 결과 저장 (LRU 정책)
   */
  set(params: ScheduleCalculationParams, result: ScheduleAvailabilityResult): void {
    const key = generateCacheKey(params);

    // 이미 존재하면 삭제 (LRU 업데이트를 위해)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 캐시 크기 제한 (LRU: 가장 오래된 항목 = Map의 첫 번째 항목)
    while (this.cache.size >= this.MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * 특정 파라미터의 캐시 무효화
   */
  invalidate(params: ScheduleCalculationParams): void {
    const key = generateCacheKey(params);
    this.cache.delete(key);
  }

  /**
   * 캐시 초기화
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 만료된 항목 정리
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 캐시 통계 조회 (디버깅용)
   */
  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      ttlMs: this.TTL,
    };
  }
}

// 싱글톤 인스턴스
export const scheduleCache = new ScheduleCache();

// 주기적으로 만료된 항목 정리 (5분마다)
if (typeof window !== "undefined") {
  setInterval(() => {
    scheduleCache.cleanup();
  }, 5 * 60 * 1000);
}
