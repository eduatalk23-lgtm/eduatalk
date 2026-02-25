/**
 * 학원 일정 조회 헬퍼
 *
 * 기존 planner_academy_overrides 테이블 기반 오버라이드 로직은 제거됨 (테이블 DROP).
 * 전역 학원 일정을 EffectiveAcademySchedule 형식으로 래핑하여 반환합니다.
 */

import type {
  EffectiveAcademySchedule,
  AcademySchedule,
} from "@/lib/types/plan";
import { getStudentAcademySchedules } from "./index";

// ============================================================================
// Plan Group용 함수 (기존 API 유지)
// ============================================================================

/**
 * 플랜 그룹의 실제 적용될 학원 일정 반환
 */
export async function getEffectiveAcademySchedules(
  _planGroupId: string,
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveAcademySchedule[]> {
  return getEffectiveSchedulesFromGlobal(studentId, tenantId, options);
}

// ============================================================================
// Calendar용 함수
// ============================================================================

/**
 * 캘린더의 실제 적용될 학원 일정 반환
 */
export async function getEffectiveAcademySchedulesForCalendar(
  _calendarId: string,
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveAcademySchedule[]> {
  return getEffectiveSchedulesFromGlobal(studentId, tenantId, options);
}

// ============================================================================
// 헬퍼
// ============================================================================

/**
 * 전역 학원 일정을 EffectiveAcademySchedule 형식으로 변환
 */
export function toEffectiveSchedule(
  schedule: AcademySchedule
): EffectiveAcademySchedule {
  return {
    id: schedule.id,
    day_of_week: schedule.day_of_week,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    academy_name: schedule.academy_name,
    subject: schedule.subject,
    travel_time: schedule.travel_time ?? 60,
    source: "global",
  };
}

// ============================================================================
// 내부 함수
// ============================================================================

async function getEffectiveSchedulesFromGlobal(
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<EffectiveAcademySchedule[]> {
  const globalSchedules = await getStudentAcademySchedules(
    studentId,
    tenantId,
    { useAdminClient: options?.useAdminClient }
  );

  return globalSchedules
    .map(toEffectiveSchedule)
    .sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) {
        return a.day_of_week - b.day_of_week;
      }
      return a.start_time.localeCompare(b.start_time);
    });
}
