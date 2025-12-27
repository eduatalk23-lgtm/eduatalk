/**
 * 가용 날짜 계산 유틸리티
 *
 * 주어진 기간 내에서 학습 가능한 날짜들을 계산합니다.
 * - 제외일 처리 (시험, 공휴일 등)
 * - 학원 일정 반영
 * - 학습일/복습일 주기 적용 (기본 6:1)
 */

import type { DayType } from "@/lib/types/plan/domain";
import type {
  AvailableDate,
  AcademyScheduleInfo,
} from "@/lib/types/plan/timezone";

// AvailableDate 타입 re-export
export type { AvailableDate };

/**
 * 가용 날짜 계산
 *
 * @param periodStart - 시작일 (YYYY-MM-DD)
 * @param periodEnd - 종료일 (YYYY-MM-DD)
 * @param exclusions - 제외일 목록
 * @param academySchedules - 학원 일정
 * @param schedulerOptions - 스케줄러 옵션 (학습일/복습일 주기)
 * @returns 가용 날짜 배열
 */
export function calculateAvailableDates(
  periodStart: string,
  periodEnd: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string;
  }>,
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
  }>,
  schedulerOptions?: unknown
): AvailableDate[] {
  const dates: AvailableDate[] = [];
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  // 제외일 맵 생성
  const exclusionMap = new Map(
    exclusions.map((e) => [e.exclusion_date, e])
  );

  // 학원 일정 맵 (요일별)
  const academyByDay = new Map<number, AcademyScheduleInfo[]>();
  for (const schedule of academySchedules) {
    const existing = academyByDay.get(schedule.day_of_week) || [];
    existing.push({
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      academy_name: schedule.academy_name,
      subject: schedule.subject,
    });
    academyByDay.set(schedule.day_of_week, existing);
  }

  // 6:1 주기 계산
  const options = schedulerOptions as
    | { study_days?: number; review_days?: number }
    | undefined;
  const studyDays = options?.study_days ?? 6;
  const reviewDays = options?.review_days ?? 1;
  const cycleLength = studyDays + reviewDays;

  let dayIndex = 0;

  for (
    let current = new Date(start);
    current <= end;
    current.setDate(current.getDate() + 1)
  ) {
    const dateStr = current.toISOString().split("T")[0];
    const dayOfWeek = current.getDay();

    // 제외일 확인
    const exclusion = exclusionMap.get(dateStr);
    if (exclusion) {
      dates.push({
        date: dateStr,
        day_type: "exclusion",
        is_exclusion: true,
        exclusion_reason: exclusion.reason,
        academy_schedules: [],
        available_slots: [],
        allocated_contents: [],
        remaining_minutes: 0,
      });
      continue;
    }

    // 학습일/복습일 결정
    const cyclePosition = dayIndex % cycleLength;
    const dayType: DayType = cyclePosition < studyDays ? "study" : "review";

    // 학원 일정
    const academySchedulesForDay = academyByDay.get(dayOfWeek) || [];

    dates.push({
      date: dateStr,
      day_type: dayType,
      is_exclusion: false,
      academy_schedules: academySchedulesForDay,
      available_slots: [], // TODO: 블록셋 기반 계산
      allocated_contents: [],
      remaining_minutes: 480, // 기본 8시간
    });

    dayIndex++;
  }

  return dates;
}
