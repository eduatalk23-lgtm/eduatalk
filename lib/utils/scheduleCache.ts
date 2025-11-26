/**
 * 스케줄 계산 결과 캐싱 유틸리티
 */

import type { ScheduleAvailabilityResult } from "@/lib/scheduler/calculateAvailableDates";

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
  schedulerOptions?: any;
  timeSettings?: any;
};

/**
 * 캐시 키 생성 함수
 */
function generateCacheKey(params: ScheduleCalculationParams): string {
  return JSON.stringify({
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    blockSetId: params.blockSetId,
    exclusions: params.exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason,
    })),
    academySchedules: params.academySchedules.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      academy_name: s.academy_name,
      subject: s.subject,
      travel_time: s.travel_time,
    })),
    schedulerType: params.schedulerType,
    schedulerOptions: params.schedulerOptions,
    timeSettings: params.timeSettings,
  });
}

/**
 * 스케줄 계산 결과 캐시
 */
class ScheduleCache {
  private cache: Map<string, { result: ScheduleAvailabilityResult; timestamp: number }> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5분

  /**
   * 캐시에서 결과 조회
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

    return cached.result;
  }

  /**
   * 캐시에 결과 저장
   */
  set(params: ScheduleCalculationParams, result: ScheduleAvailabilityResult): void {
    const key = generateCacheKey(params);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });

    // 캐시 크기 제한 (최대 10개)
    if (this.cache.size > 10) {
      // 가장 오래된 항목 제거
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
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
}

// 싱글톤 인스턴스
export const scheduleCache = new ScheduleCache();

// 주기적으로 만료된 항목 정리 (5분마다)
if (typeof window !== "undefined") {
  setInterval(() => {
    scheduleCache.cleanup();
  }, 5 * 60 * 1000);
}

