/**
 * 학원 일정 시간대 겹침 검증 유틸리티
 */

type AcademySchedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
};

/**
 * 시간 문자열을 분 단위로 변환
 * @param timeStr "HH:mm" 형식의 시간 문자열
 * @returns 자정부터의 분 단위 시간
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위 시간에서 이동시간을 빼거나 더한 시간을 "HH:mm" 형식으로 반환
 * @param timeStr "HH:mm" 형식의 시간 문자열
 * @param travelMinutes 이동시간 (분)
 * @param subtract true면 빼기, false면 더하기
 * @returns "HH:mm" 형식의 시간 문자열
 */
function adjustTime(
  timeStr: string,
  travelMinutes: number,
  subtract: boolean
): string {
  const minutes = timeToMinutes(timeStr);
  const adjusted = subtract ? minutes - travelMinutes : minutes + travelMinutes;
  const hours = Math.floor(adjusted / 60);
  const mins = adjusted % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * 두 시간 범위가 겹치는지 확인
 * @param start1 범위1 시작 시간 (분)
 * @param end1 범위1 종료 시간 (분)
 * @param start2 범위2 시작 시간 (분)
 * @param end2 범위2 종료 시간 (분)
 * @returns 겹치면 true
 */
function doTimeRangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  // 범위가 겹치려면: start1 < end2 AND start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * 학원 일정의 실제 제외 시간 계산 (이동시간 포함)
 * @param schedule 학원 일정
 * @returns 이동시간을 포함한 실제 제외 시작/종료 시간 (분)
 */
function getActualScheduleTime(schedule: AcademySchedule): {
  startMinutes: number;
  endMinutes: number;
} {
  const travelTime = schedule.travel_time || 60; // 기본값 60분
  const actualStartTime = adjustTime(schedule.start_time, travelTime, true);
  const actualEndTime = adjustTime(schedule.end_time, travelTime, false);

  return {
    startMinutes: timeToMinutes(actualStartTime),
    endMinutes: timeToMinutes(actualEndTime),
  };
}

/**
 * 학원 일정 시간대 겹침 검증
 * @param newSchedule 추가하려는 새 학원 일정
 * @param existingSchedules 기존 학원 일정 목록
 * @returns 검증 결과 (isValid: 겹치지 않으면 true, conflictSchedules: 겹치는 일정 목록)
 */
export function validateAcademyScheduleOverlap(
  newSchedule: AcademySchedule,
  existingSchedules: AcademySchedule[]
): { isValid: boolean; conflictSchedules: AcademySchedule[] } {
  const conflictSchedules: AcademySchedule[] = [];

  // 새 일정의 실제 제외 시간 계산
  const newActualTime = getActualScheduleTime(newSchedule);

  // 같은 요일의 기존 일정들과 비교
  const sameDaySchedules = existingSchedules.filter(
    (s) => s.day_of_week === newSchedule.day_of_week
  );

  for (const existingSchedule of sameDaySchedules) {
    const existingActualTime = getActualScheduleTime(existingSchedule);

    // 시간대 겹침 확인
    if (
      doTimeRangesOverlap(
        newActualTime.startMinutes,
        newActualTime.endMinutes,
        existingActualTime.startMinutes,
        existingActualTime.endMinutes
      )
    ) {
      conflictSchedules.push(existingSchedule);
    }
  }

  return {
    isValid: conflictSchedules.length === 0,
    conflictSchedules,
  };
}

/**
 * 여러 학원 일정 간의 겹침 검증
 * @param schedules 검증할 학원 일정 목록
 * @returns 겹치는 일정 쌍의 목록
 */
export function validateMultipleSchedulesOverlap(
  schedules: AcademySchedule[]
): Array<{ schedule1: AcademySchedule; schedule2: AcademySchedule }> {
  const conflicts: Array<{
    schedule1: AcademySchedule;
    schedule2: AcademySchedule;
  }> = [];

  // 요일별로 그룹화
  const schedulesByDay = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.day_of_week]) {
      acc[schedule.day_of_week] = [];
    }
    acc[schedule.day_of_week].push(schedule);
    return acc;
  }, {} as Record<number, AcademySchedule[]>);

  // 각 요일별로 일정 간 겹침 확인
  for (const daySchedules of Object.values(schedulesByDay)) {
    for (let i = 0; i < daySchedules.length; i++) {
      for (let j = i + 1; j < daySchedules.length; j++) {
        const schedule1ActualTime = getActualScheduleTime(daySchedules[i]);
        const schedule2ActualTime = getActualScheduleTime(daySchedules[j]);

        if (
          doTimeRangesOverlap(
            schedule1ActualTime.startMinutes,
            schedule1ActualTime.endMinutes,
            schedule2ActualTime.startMinutes,
            schedule2ActualTime.endMinutes
          )
        ) {
          conflicts.push({
            schedule1: daySchedules[i],
            schedule2: daySchedules[j],
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * 학원 일정 설명 문자열 생성 (디버깅/표시용)
 * @param schedule 학원 일정
 * @returns 일정 설명 문자열
 */
export function getScheduleDescription(schedule: AcademySchedule): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = weekdays[schedule.day_of_week];
  const travelTime = schedule.travel_time || 60;
  const actualStartTime = adjustTime(schedule.start_time, travelTime, true);
  const actualEndTime = adjustTime(schedule.end_time, travelTime, false);

  return `${dayName}요일 ${actualStartTime}~${actualEndTime} (학원: ${schedule.start_time}~${schedule.end_time}, 이동시간: ${travelTime}분)${
    schedule.academy_name ? ` - ${schedule.academy_name}` : ""
  }${schedule.subject ? ` (${schedule.subject})` : ""}`;
}

