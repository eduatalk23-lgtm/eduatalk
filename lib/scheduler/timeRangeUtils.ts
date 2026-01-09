/**
 * 시간 범위 유틸리티
 *
 * 시간 범위 계산, 병합, 차감 등의 공통 로직을 제공합니다.
 * calculateAvailableDates, SchedulerEngine 등에서 재사용됩니다.
 *
 * @module lib/scheduler/timeRangeUtils
 */

import { timeToMinutes, minutesToTime } from "@/lib/utils/time";

/**
 * 시간 범위 타입
 */
export interface TimeRange {
  start: string; // HH:mm 형식
  end: string; // HH:mm 형식
}

/**
 * 시간 범위 유틸리티 클래스
 *
 * 시간 범위 관련 계산을 위한 정적 메서드 모음
 */
export class TimeRangeUtils {
  /**
   * 두 시간 범위가 겹치는지 확인
   *
   * @param range1 - 첫 번째 시간 범위
   * @param range2 - 두 번째 시간 범위
   * @returns 겹치면 true, 아니면 false
   *
   * @example
   * ```typescript
   * TimeRangeUtils.overlap(
   *   { start: "10:00", end: "12:00" },
   *   { start: "11:00", end: "13:00" }
   * ); // true
   * ```
   */
  static overlap(range1: TimeRange, range2: TimeRange): boolean {
    const start1 = timeToMinutes(range1.start);
    const end1 = timeToMinutes(range1.end);
    const start2 = timeToMinutes(range2.start);
    const end2 = timeToMinutes(range2.end);

    return start1 < end2 && start2 < end1;
  }

  /**
   * 시간 범위에서 다른 시간 범위를 제외
   *
   * @param base - 기준 시간 범위
   * @param exclude - 제외할 시간 범위
   * @returns 제외 후 남은 시간 범위들
   *
   * @example
   * ```typescript
   * TimeRangeUtils.subtract(
   *   { start: "10:00", end: "14:00" },
   *   { start: "12:00", end: "13:00" }
   * ); // [{ start: "10:00", end: "12:00" }, { start: "13:00", end: "14:00" }]
   * ```
   */
  static subtract(base: TimeRange, exclude: TimeRange): TimeRange[] {
    const baseStart = timeToMinutes(base.start);
    const baseEnd = timeToMinutes(base.end);
    const excludeStart = timeToMinutes(exclude.start);
    const excludeEnd = timeToMinutes(exclude.end);

    // 겹치지 않으면 원본 반환
    if (excludeEnd <= baseStart || excludeStart >= baseEnd) {
      return [base];
    }

    const result: TimeRange[] = [];

    // 앞부분
    if (baseStart < excludeStart) {
      result.push({
        start: minutesToTime(baseStart),
        end: minutesToTime(excludeStart),
      });
    }

    // 뒷부분
    if (excludeEnd < baseEnd) {
      result.push({
        start: minutesToTime(excludeEnd),
        end: minutesToTime(baseEnd),
      });
    }

    return result;
  }

  /**
   * 여러 시간 범위를 병합 (겹치는 부분 제거)
   *
   * @param ranges - 병합할 시간 범위들
   * @returns 병합된 시간 범위들
   *
   * @example
   * ```typescript
   * TimeRangeUtils.merge([
   *   { start: "10:00", end: "12:00" },
   *   { start: "11:00", end: "13:00" },
   *   { start: "15:00", end: "17:00" }
   * ]);
   * // [{ start: "10:00", end: "13:00" }, { start: "15:00", end: "17:00" }]
   * ```
   */
  static merge(ranges: TimeRange[]): TimeRange[] {
    if (ranges.length === 0) return [];

    // 시작 시간 기준 정렬
    const sorted = [...ranges].sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    const merged: TimeRange[] = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      const currentEnd = timeToMinutes(current.end);
      const nextStart = timeToMinutes(next.start);

      // 겹치거나 연속된 경우 병합
      if (nextStart <= currentEnd) {
        current = {
          start: current.start,
          end: minutesToTime(Math.max(currentEnd, timeToMinutes(next.end))),
        };
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * 시간 범위의 총 시간(시간 단위) 계산
   *
   * @param ranges - 시간 범위들
   * @returns 총 시간 (시간 단위, 소수점 포함)
   *
   * @example
   * ```typescript
   * TimeRangeUtils.calculateHours([
   *   { start: "10:00", end: "12:00" },
   *   { start: "13:00", end: "15:30" }
   * ]); // 4.5
   * ```
   */
  static calculateHours(ranges: TimeRange[]): number {
    return ranges.reduce((total, range) => {
      const start = timeToMinutes(range.start);
      const end = timeToMinutes(range.end);
      return total + (end - start) / 60;
    }, 0);
  }

  /**
   * 시간 범위의 총 시간(분 단위) 계산
   *
   * @param ranges - 시간 범위들
   * @returns 총 시간 (분 단위)
   *
   * @example
   * ```typescript
   * TimeRangeUtils.calculateMinutes([
   *   { start: "10:00", end: "12:00" },
   *   { start: "13:00", end: "15:30" }
   * ]); // 270
   * ```
   */
  static calculateMinutes(ranges: TimeRange[]): number {
    return ranges.reduce((total, range) => {
      const start = timeToMinutes(range.start);
      const end = timeToMinutes(range.end);
      return total + (end - start);
    }, 0);
  }

  /**
   * 기준 시간 범위에서 여러 시간 범위를 모두 제외
   *
   * @param base - 기준 시간 범위
   * @param excludes - 제외할 시간 범위들
   * @returns 제외 후 남은 시간 범위들 (병합됨)
   *
   * @example
   * ```typescript
   * TimeRangeUtils.subtractMultiple(
   *   { start: "10:00", end: "18:00" },
   *   [
   *     { start: "12:00", end: "13:00" }, // 점심
   *     { start: "15:00", end: "16:00" }, // 휴식
   *   ]
   * );
   * // [{ start: "10:00", end: "12:00" }, { start: "13:00", end: "15:00" }, { start: "16:00", end: "18:00" }]
   * ```
   */
  static subtractMultiple(base: TimeRange, excludes: TimeRange[]): TimeRange[] {
    let remaining: TimeRange[] = [base];

    for (const exclude of excludes) {
      const newRemaining: TimeRange[] = [];
      for (const range of remaining) {
        newRemaining.push(...this.subtract(range, exclude));
      }
      remaining = newRemaining;
    }

    return this.merge(remaining);
  }

  /**
   * 두 시간 범위의 교집합 계산
   *
   * @param range1 - 첫 번째 시간 범위
   * @param range2 - 두 번째 시간 범위
   * @returns 교집합 시간 범위 (없으면 null)
   *
   * @example
   * ```typescript
   * TimeRangeUtils.intersect(
   *   { start: "10:00", end: "14:00" },
   *   { start: "12:00", end: "16:00" }
   * ); // { start: "12:00", end: "14:00" }
   * ```
   */
  static intersect(range1: TimeRange, range2: TimeRange): TimeRange | null {
    if (!this.overlap(range1, range2)) {
      return null;
    }

    const start1 = timeToMinutes(range1.start);
    const end1 = timeToMinutes(range1.end);
    const start2 = timeToMinutes(range2.start);
    const end2 = timeToMinutes(range2.end);

    return {
      start: minutesToTime(Math.max(start1, start2)),
      end: minutesToTime(Math.min(end1, end2)),
    };
  }
}

// 하위 호환성을 위한 함수 export
export const timeRangesOverlap = TimeRangeUtils.overlap.bind(TimeRangeUtils);
export const subtractTimeRange = TimeRangeUtils.subtract.bind(TimeRangeUtils);
export const mergeTimeRanges = TimeRangeUtils.merge.bind(TimeRangeUtils);
export const calculateHours = TimeRangeUtils.calculateHours.bind(TimeRangeUtils);
