/**
 * 단일 날짜 스케줄러
 *
 * today 모드에서 기존 플랜을 고려하여
 * 최적의 시간 슬롯을 찾아 배정
 *
 * @module lib/domains/admin-plan/actions/planCreation/singleDayScheduler
 */

import { generateScheduleForPlanner } from './scheduleGenerator';
import { getExistingPlansForStudent, groupExistingPlansByDate } from './existingPlansQuery';
import { logActionError } from '@/lib/utils/serverActionLogger';
import {
  adjustDateTimeSlotsWithExistingPlans,
  timeToMinutes,
  minutesToTime,
  type TimeSlot,
} from './timelineAdjustment';

/**
 * 단일 날짜 스케줄 입력 타입
 */
export interface SingleDayScheduleInput {
  /** 학생 ID */
  studentId: string;
  /** 플래너 ID */
  plannerId: string;
  /** 대상 날짜 (YYYY-MM-DD) */
  targetDate: string;
  /** 예상 소요시간 (분) */
  estimatedMinutes: number;
}

/**
 * 단일 날짜 스케줄 결과 타입
 */
export interface SingleDayScheduleResult {
  /** 성공 여부 */
  success: boolean;
  /** 시작 시간 (HH:mm) */
  startTime?: string;
  /** 종료 시간 (HH:mm) */
  endTime?: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 단일 날짜에서 사용 가능한 시간 슬롯을 Best Fit 알고리즘으로 찾음
 *
 * @param input - 스케줄 입력 정보
 * @returns 스케줄 결과 (시작/종료 시간 또는 에러)
 *
 * @example
 * ```typescript
 * const result = await findAvailableTimeSlot({
 *   studentId: 'student-123',
 *   plannerId: 'planner-456',
 *   targetDate: '2026-01-08',
 *   estimatedMinutes: 60,
 * });
 *
 * if (result.success) {
 *   console.log(`배정된 시간: ${result.startTime} - ${result.endTime}`);
 * }
 * ```
 */
export async function findAvailableTimeSlot(
  input: SingleDayScheduleInput
): Promise<SingleDayScheduleResult> {
  const { studentId, plannerId, targetDate, estimatedMinutes } = input;

  try {
    // 1. 플래너 기반 단일 날짜 스케줄 생성
    const scheduleResult = await generateScheduleForPlanner(
      plannerId,
      targetDate,
      targetDate // 단일 날짜: 시작 = 종료
    );

    if (!scheduleResult.success) {
      return {
        success: false,
        error: scheduleResult.error || '스케줄 생성 실패',
      };
    }

    // 2. 해당 날짜의 기존 플랜 조회
    const existingPlans = await getExistingPlansForStudent(
      studentId,
      targetDate,
      targetDate
    );
    const existingPlansByDate = groupExistingPlansByDate(existingPlans);

    // 3. 기존 플랜을 고려한 타임슬롯 조정
    const adjustedTimeSlots = adjustDateTimeSlotsWithExistingPlans(
      scheduleResult.dateTimeSlots,
      existingPlansByDate
    );

    // 4. 해당 날짜의 조정된 시간 슬롯 가져오기
    const slots = adjustedTimeSlots.get(targetDate) || [];

    // 5. Best Fit 알고리즘으로 최적 슬롯 찾기
    const bestSlot = findBestFitSlot(slots, estimatedMinutes);

    if (!bestSlot) {
      return {
        success: false,
        error: '사용 가능한 시간 슬롯이 없습니다.',
      };
    }

    // 6. 시작 시간부터 필요한 시간만큼 배정
    const startMinutes = timeToMinutes(bestSlot.start);
    const endMinutes = startMinutes + estimatedMinutes;
    const slotEndMinutes = timeToMinutes(bestSlot.end);

    // 슬롯 종료 시간을 넘지 않도록 제한
    const actualEndMinutes = Math.min(endMinutes, slotEndMinutes);

    return {
      success: true,
      startTime: bestSlot.start,
      endTime: minutesToTime(actualEndMinutes),
    };
  } catch (error) {
    logActionError('singleDayScheduler.findAvailableTimeSlot', `시간 슬롯 검색 실패: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : '시간 슬롯 검색 중 오류 발생',
    };
  }
}

/**
 * Best Fit 알고리즘으로 최적의 시간 슬롯 찾기
 *
 * 필요한 시간을 수용할 수 있는 가장 작은 슬롯을 선택
 * (공간 낭비 최소화)
 *
 * @param slots - 사용 가능한 시간 슬롯 배열
 * @param requiredMinutes - 필요한 시간 (분)
 * @returns 최적의 시간 슬롯 또는 null
 */
function findBestFitSlot(
  slots: TimeSlot[],
  requiredMinutes: number
): TimeSlot | null {
  // 학습시간 슬롯만 필터링
  const studySlots = slots.filter((slot) => slot.type === '학습시간');

  if (studySlots.length === 0) {
    return null;
  }

  let bestSlot: TimeSlot | null = null;
  let bestRemainingSpace = Infinity;

  for (const slot of studySlots) {
    const slotDuration = timeToMinutes(slot.end) - timeToMinutes(slot.start);

    // 슬롯이 필요한 시간을 수용할 수 있는지 확인
    if (slotDuration >= requiredMinutes) {
      const remainingSpace = slotDuration - requiredMinutes;

      // 더 적합한 슬롯 찾기 (남는 공간이 더 작은 것)
      if (remainingSpace < bestRemainingSpace) {
        bestSlot = slot;
        bestRemainingSpace = remainingSpace;
      }
    }
  }

  // Best Fit 실패 시 First Fit 폴백
  // (필요한 시간보다 큰 슬롯이 없으면 첫 번째 슬롯이라도 반환)
  if (!bestSlot && studySlots.length > 0) {
    // 가장 큰 슬롯 선택 (시간이 부족하더라도)
    const sortedByDuration = [...studySlots].sort((a, b) => {
      const durationA = timeToMinutes(a.end) - timeToMinutes(a.start);
      const durationB = timeToMinutes(b.end) - timeToMinutes(b.start);
      return durationB - durationA; // 내림차순
    });
    bestSlot = sortedByDuration[0];
  }

  return bestSlot;
}

/**
 * 특정 날짜의 총 사용 가능 시간 조회
 *
 * @param studentId - 학생 ID
 * @param plannerId - 플래너 ID
 * @param targetDate - 대상 날짜
 * @returns 사용 가능한 총 시간 (분)
 */
export async function getAvailableMinutesForDate(
  studentId: string,
  plannerId: string,
  targetDate: string
): Promise<number> {
  try {
    // 1. 스케줄 생성
    const scheduleResult = await generateScheduleForPlanner(
      plannerId,
      targetDate,
      targetDate
    );

    if (!scheduleResult.success) {
      return 0;
    }

    // 2. 기존 플랜 조회 및 조정
    const existingPlans = await getExistingPlansForStudent(
      studentId,
      targetDate,
      targetDate
    );
    const existingPlansByDate = groupExistingPlansByDate(existingPlans);
    const adjustedTimeSlots = adjustDateTimeSlotsWithExistingPlans(
      scheduleResult.dateTimeSlots,
      existingPlansByDate
    );

    // 3. 총 사용 가능 시간 계산
    const slots = adjustedTimeSlots.get(targetDate) || [];
    const studySlots = slots.filter((slot) => slot.type === '학습시간');

    return studySlots.reduce((total, slot) => {
      const duration = timeToMinutes(slot.end) - timeToMinutes(slot.start);
      return total + duration;
    }, 0);
  } catch (error) {
    logActionError('singleDayScheduler.getAvailableMinutesForDay', `가용 시간 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}
