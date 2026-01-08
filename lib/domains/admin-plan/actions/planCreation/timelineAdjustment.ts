/**
 * 타임라인 조정 함수
 *
 * 기존 플랜의 시간을 고려하여 dateTimeSlots에서
 * 사용 가능한 빈 시간대만 추출
 *
 * @module lib/domains/admin-plan/actions/planCreation/timelineAdjustment
 */

import type { ExistingPlansByDate } from './existingPlansQuery';

/**
 * 시간 슬롯 타입 (scheduler.ts의 DateTimeSlots와 호환)
 */
export interface TimeSlot {
  type: '학습시간' | '점심시간' | '학원일정' | '이동시간' | '자율학습';
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string;
}

/**
 * 날짜별 시간 슬롯 Map
 */
export type DateTimeSlots = Map<string, TimeSlot[]>;

/**
 * 시간 범위 타입
 */
export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
}

/**
 * 시간 문자열(HH:mm)을 분 단위로 변환
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위를 시간 문자열(HH:mm)로 변환
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 시간 범위에서 다른 시간 범위를 제외
 *
 * @param base - 기본 시간 범위
 * @param exclude - 제외할 시간 범위
 * @returns 남은 시간 범위 배열
 */
export function subtractTimeRange(
  base: TimeRange,
  exclude: TimeRange
): TimeRange[] {
  const baseStart = timeToMinutes(base.start);
  const baseEnd = timeToMinutes(base.end);
  const excludeStart = timeToMinutes(exclude.start);
  const excludeEnd = timeToMinutes(exclude.end);

  // 겹치지 않으면 원본 반환
  if (excludeEnd <= baseStart || excludeStart >= baseEnd) {
    return [base];
  }

  const result: TimeRange[] = [];

  // 앞부분 (exclude 시작 전)
  if (baseStart < excludeStart) {
    result.push({
      start: minutesToTime(baseStart),
      end: minutesToTime(excludeStart),
    });
  }

  // 뒷부분 (exclude 종료 후)
  if (excludeEnd < baseEnd) {
    result.push({
      start: minutesToTime(excludeEnd),
      end: minutesToTime(baseEnd),
    });
  }

  return result;
}

/**
 * 기존 플랜 시간을 고려한 dateTimeSlots 조정
 *
 * 학습시간 슬롯에서 기존 플랜이 점유한 시간을 제외하여
 * 실제로 사용 가능한 빈 시간대만 남김
 *
 * @param dateTimeSlots - 원본 날짜별 시간 슬롯
 * @param existingPlansByDate - 날짜별 기존 플랜 시간 정보
 * @returns 조정된 날짜별 시간 슬롯
 */
export function adjustDateTimeSlotsWithExistingPlans(
  dateTimeSlots: DateTimeSlots,
  existingPlansByDate: ExistingPlansByDate
): DateTimeSlots {
  const adjustedDateTimeSlots: DateTimeSlots = new Map();

  dateTimeSlots.forEach((slots, date) => {
    const existingPlansForDate = existingPlansByDate.get(date) || [];
    const adjustedSlots: TimeSlot[] = [];

    for (const slot of slots) {
      if (slot.type === '학습시간') {
        // 학습시간 슬롯에서 기존 플랜 시간 제외
        let remainingRanges: TimeRange[] = [{ start: slot.start, end: slot.end }];

        for (const existingPlan of existingPlansForDate) {
          remainingRanges = remainingRanges.flatMap((range) =>
            subtractTimeRange(range, { start: existingPlan.start, end: existingPlan.end })
          );
        }

        // 남은 시간대를 새로운 학습시간 슬롯으로 추가
        for (const range of remainingRanges) {
          const durationMinutes = timeToMinutes(range.end) - timeToMinutes(range.start);
          // 최소 5분 이상인 시간대만 포함
          if (durationMinutes >= 5) {
            adjustedSlots.push({
              type: '학습시간',
              start: range.start,
              end: range.end,
              label: slot.label,
            });
          }
        }
      } else {
        // 학습시간이 아닌 슬롯(점심시간, 학원일정 등)은 그대로 유지
        adjustedSlots.push(slot);
      }
    }

    adjustedDateTimeSlots.set(date, adjustedSlots);
  });

  return adjustedDateTimeSlots;
}

/**
 * 날짜별 사용 가능한 시간 범위에서 기존 플랜 시간 제외
 *
 * @param dateAvailableTimeRanges - 원본 날짜별 사용 가능 시간 범위
 * @param existingPlansByDate - 날짜별 기존 플랜 시간 정보
 * @returns 조정된 날짜별 사용 가능 시간 범위
 */
export function adjustDateAvailableTimeRangesWithExistingPlans(
  dateAvailableTimeRanges: Map<string, TimeRange[]>,
  existingPlansByDate: ExistingPlansByDate
): Map<string, TimeRange[]> {
  const adjusted = new Map<string, TimeRange[]>();

  dateAvailableTimeRanges.forEach((ranges, date) => {
    const existingPlansForDate = existingPlansByDate.get(date) || [];
    let remainingRanges = [...ranges];

    for (const existingPlan of existingPlansForDate) {
      remainingRanges = remainingRanges.flatMap((range) =>
        subtractTimeRange(range, { start: existingPlan.start, end: existingPlan.end })
      );
    }

    // 최소 5분 이상인 시간대만 포함
    const validRanges = remainingRanges.filter((range) => {
      const duration = timeToMinutes(range.end) - timeToMinutes(range.start);
      return duration >= 5;
    });

    adjusted.set(date, validRanges);
  });

  return adjusted;
}

/**
 * 날짜의 총 사용 가능 시간(분) 계산
 *
 * @param timeSlots - 시간 슬롯 배열
 * @returns 총 학습 가능 시간 (분)
 */
export function calculateTotalAvailableMinutes(timeSlots: TimeSlot[]): number {
  return timeSlots
    .filter((slot) => slot.type === '학습시간')
    .reduce((total, slot) => {
      const duration = timeToMinutes(slot.end) - timeToMinutes(slot.start);
      return total + duration;
    }, 0);
}

/**
 * 특정 날짜에 플랜 배치 가능 여부 확인
 *
 * @param dateTimeSlots - 날짜별 시간 슬롯
 * @param date - 확인할 날짜
 * @param requiredMinutes - 필요한 시간 (분)
 * @returns 배치 가능 여부 및 사용 가능한 시간
 */
export function canPlacePlanOnDate(
  dateTimeSlots: DateTimeSlots,
  date: string,
  requiredMinutes: number
): { canPlace: boolean; availableMinutes: number } {
  const slots = dateTimeSlots.get(date) || [];
  const availableMinutes = calculateTotalAvailableMinutes(slots);

  return {
    canPlace: availableMinutes >= requiredMinutes,
    availableMinutes,
  };
}
