/**
 * 스케줄 가능 날짜 및 시간 계산 모듈
 * 1730 Timetable 및 자동 스케줄러를 위한 학습 가능 날짜 산출
 */

export type DayType = "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";

export type TimeRange = {
  start: string; // HH:mm 형식
  end: string; // HH:mm 형식
};

export type TimeSlot = {
  type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string; // "학원(이름-과목)" 형태
};

export type DailySchedule = {
  date: string; // YYYY-MM-DD 형식
  day_type: DayType;
  study_hours: number; // 학습 가능 시간 (시간 단위)
  available_time_ranges: TimeRange[]; // 학습 가능 시간대
  note: string; // 설명 (예: "10:00~12:00, 13:00~19:00")
  academy_schedules?: AcademySchedule[]; // 해당 날짜의 학원일정
  exclusion?: Exclusion | null; // 해당 날짜의 제외일 정보
  week_number?: number; // 주차 번호 (1730 Timetable인 경우)
  time_slots?: TimeSlot[]; // 시간 흐름 순 타임라인
};

export type AcademyGroup = {
  academy_name: string;
  subject: string;
  days_of_week: number[]; // 요일 배열
  time_range: {
    start: string;
    end: string;
  };
  travel_time: number; // 분 단위
  total_count: number; // 총 일정 횟수
  total_academy_hours: number; // 총 학원 수업 시간 (시간 단위)
  total_travel_hours: number; // 총 이동시간 (시간 단위)
};

export type ScheduleSummary = {
  total_days: number;
  total_study_days: number;
  total_review_days: number;
  total_study_hours: number;
  total_study_hours_학습일: number;
  total_study_hours_복습일: number;
  total_self_study_hours: number; // 총 자율학습 시간 (지정휴일 + 캠프 자율학습시간)
  total_exclusion_days: {
    휴가: number;
    개인사정: number;
    지정휴일: number;
  };
  academy_statistics: {
    total_academy_schedules: number; // 총 학원일정 횟수
    unique_academies: number; // 고유 학원 수
    total_academy_hours: number; // 총 학원 수업 시간
    total_travel_hours: number; // 총 이동시간
    average_travel_time: number; // 평균 이동시간 (분)
    academy_groups: AcademyGroup[]; // 학원별 그룹화 정보
  };
  camp_period: {
    start_date: string;
    end_date: string;
  };
};

export type ScheduleAvailabilityResult = {
  summary: ScheduleSummary;
  daily_schedule: DailySchedule[];
  errors: string[];
};

export type Block = {
  day_of_week: number; // 0: 일요일, 1: 월요일, ..., 6: 토요일
  start_time: string; // HH:mm 형식
  end_time: string; // HH:mm 형식
};

export type Exclusion = {
  exclusion_date: string; // YYYY-MM-DD 형식
  exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
  reason?: string;
};

export type AcademySchedule = {
  day_of_week: number;
  start_time: string; // HH:mm 형식
  end_time: string; // HH:mm 형식
  academy_name?: string;
  subject?: string;
  travel_time?: number; // 이동시간 (분 단위, 기본값: 60분)
};

type CalculateOptions = {
  scheduler_type: "1730_timetable" | "자동스케줄러";
  scheduler_options?: {
    study_days?: number; // 1730 Timetable: 학습일 수 (기본 6)
    review_days?: number; // 1730 Timetable: 복습일 수 (기본 1)
  };
  camp_study_hours?: TimeRange; // 캠프 학습시간 (기본: 10:00~19:00)
  camp_self_study_hours?: TimeRange; // 캠프 자율학습시간 (기본: 19:00~22:00)
  lunch_time?: TimeRange; // 점심시간 (기본: 12:00~13:00)
  designated_holiday_hours?: TimeRange; // 지정휴일 학습시간 (기본: 13:00~19:00)
  use_self_study_with_blocks?: boolean; // 블록이 있어도 자율학습시간 사용 (기본: false)
  enable_self_study_for_holidays?: boolean; // 지정휴일 자율학습 시간 배정 (기본: false)
  enable_self_study_for_study_days?: boolean; // 학습일/복습일 자율학습 시간 배정 (기본: false)
};

/**
 * 시간 문자열을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위를 시간 문자열로 변환
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * 두 시간 범위가 겹치는지 확인
 */
function timeRangesOverlap(
  range1: TimeRange,
  range2: TimeRange
): boolean {
  const start1 = timeToMinutes(range1.start);
  const end1 = timeToMinutes(range1.end);
  const start2 = timeToMinutes(range2.start);
  const end2 = timeToMinutes(range2.end);

  return start1 < end2 && start2 < end1;
}

/**
 * 시간 범위에서 다른 시간 범위를 제외
 */
function subtractTimeRange(
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
 */
function mergeTimeRanges(ranges: TimeRange[]): TimeRange[] {
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
 */
function calculateHours(ranges: TimeRange[]): number {
  return ranges.reduce((total, range) => {
    const start = timeToMinutes(range.start);
    const end = timeToMinutes(range.end);
    return total + (end - start) / 60;
  }, 0);
}

/**
 * 날짜의 요일 반환 (0: 일요일, 1: 월요일, ..., 6: 토요일)
 */
function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * 날짜 범위의 모든 날짜 생성
 */
function generateDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 특정 날짜의 제외일 정보 조회
 */
function getExclusionForDate(
  date: string,
  exclusions: Exclusion[]
): Exclusion | null {
  return exclusions.find((e) => e.exclusion_date === date) || null;
}

/**
 * 특정 날짜의 학원 일정 조회
 */
function getAcademySchedulesForDate(
  date: Date,
  academySchedules: AcademySchedule[]
): AcademySchedule[] {
  const dayOfWeek = getDayOfWeek(date);
  return academySchedules.filter((s) => s.day_of_week === dayOfWeek);
}

/**
 * 학원일정 그룹화 (학원명 + 과목 기준)
 * 같은 학원-과목 조합을 하나로 묶어서 통계 계산
 */
function groupAcademySchedules(
  academySchedules: AcademySchedule[],
  dates: Date[]
): AcademyGroup[] {
  const groups = new Map<string, {
    academy_name: string;
    subject: string;
    days_of_week: Set<number>;
    time_range: { start: string; end: string };
    travel_time: number;
    count: number;
    total_academy_minutes: number;
    total_travel_minutes: number;
  }>();

  // 각 학원일정을 그룹화
  for (const schedule of academySchedules) {
    // 학원명과 과목이 같으면 같은 그룹으로 처리
    const key = `${schedule.academy_name || ""}_${schedule.subject || ""}`;
    
    if (!groups.has(key)) {
      groups.set(key, {
        academy_name: schedule.academy_name || "학원",
        subject: schedule.subject || "",
        days_of_week: new Set(),
        time_range: {
          start: schedule.start_time,
          end: schedule.end_time,
        },
        travel_time: schedule.travel_time || 60,
        count: 0,
        total_academy_minutes: 0,
        total_travel_minutes: 0,
      });
    }

    const group = groups.get(key)!;
    group.days_of_week.add(schedule.day_of_week);
    
    // 해당 요일의 일정 횟수 계산 (기간 내 해당 요일의 날짜 수)
    const dayCount = dates.filter((date) => getDayOfWeek(date) === schedule.day_of_week).length;
    group.count += dayCount;
    
    // 학원 수업 시간 계산
    const academyStart = timeToMinutes(schedule.start_time);
    const academyEnd = timeToMinutes(schedule.end_time);
    const academyMinutes = (academyEnd - academyStart) * dayCount;
    group.total_academy_minutes += academyMinutes;
    
    // 이동시간 계산 (왕복이므로 2배)
    const travelTime = schedule.travel_time || 60;
    group.total_travel_minutes += travelTime * 2 * dayCount;
  }

  // AcademyGroup 형태로 변환
  return Array.from(groups.values()).map((group) => ({
    academy_name: group.academy_name,
    subject: group.subject,
    days_of_week: Array.from(group.days_of_week).sort(),
    time_range: group.time_range,
    travel_time: group.travel_time,
    total_count: group.count,
    total_academy_hours: group.total_academy_minutes / 60,
    total_travel_hours: group.total_travel_minutes / 60,
  }));
}

/**
 * 특정 날짜의 블록 조회
 */
function getBlocksForDate(
  date: Date,
  blocks: Block[]
): Block[] {
  const dayOfWeek = getDayOfWeek(date);
  return blocks.filter((b) => b.day_of_week === dayOfWeek);
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 1730 Timetable: 주차 계산 (모든 제외일 제외한 7일 단위)
 * 제외일(휴가, 개인사정, 지정휴일)은 주차 계산에서 완전히 제외
 */
function calculateWeeksFor1730(
  dates: Date[],
  exclusions: Exclusion[]
): Map<number, Date[]> {
  const weeks = new Map<number, Date[]>();
  let currentWeek = 1;
  let currentWeekDates: Date[] = [];

  for (const date of dates) {
    const dateStr = formatDate(date);
    const exclusion = getExclusionForDate(dateStr, exclusions);

    // 모든 제외일(휴가, 개인사정, 지정휴일)은 주차 계산에서 제외
    if (exclusion) {
      continue;
    }

    // 제외일이 아닌 날짜만 주차에 포함
    currentWeekDates.push(date);

    // 7일이 되면 다음 주차로
    if (currentWeekDates.length >= 7) {
      weeks.set(currentWeek, [...currentWeekDates]);
      currentWeek++;
      currentWeekDates = [];
    }
  }

  // 남은 날짜 처리
  if (currentWeekDates.length > 0) {
    weeks.set(currentWeek, currentWeekDates);
  }

  return weeks;
}

/**
 * 1730 Timetable: 학습일/복습일 분류
 * 제외일(휴가, 개인사정, 지정휴일)은 주차 계산에서 제외하고,
 * 제외일이 아닌 날짜만으로 학습일 6개 + 복습일 1개 구조를 유지
 */
function classifyDaysFor1730(
  dates: Date[],
  exclusions: Exclusion[],
  studyDays: number = 6,
  reviewDays: number = 1
): Map<string, DayType> {
  const dayTypeMap = new Map<string, DayType>();
  
  // 1. 먼저 모든 제외일을 dayTypeMap에 추가
  for (const date of dates) {
    const dateStr = formatDate(date);
    const exclusion = getExclusionForDate(dateStr, exclusions);
    
    if (exclusion) {
      if (exclusion.exclusion_type === "휴가") {
        dayTypeMap.set(dateStr, "휴가");
      } else if (exclusion.exclusion_type === "개인사정") {
        dayTypeMap.set(dateStr, "개인일정");
      } else if (exclusion.exclusion_type === "휴일지정") {
        dayTypeMap.set(dateStr, "지정휴일");
      }
    }
  }

  // 2. 주차 계산 (모든 제외일 제외)
  // 제외일이 아닌 날짜만으로 주차를 구성
  const weeks = calculateWeeksFor1730(dates, exclusions);

  // 3. 각 주차에서 학습일과 복습일 분류
  // 주차에 포함된 날짜는 이미 제외일이 아니므로 바로 분류 가능
  for (const [weekNum, weekDates] of weeks.entries()) {
    for (let i = 0; i < weekDates.length; i++) {
      const date = weekDates[i];
      const dateStr = formatDate(date);
      
      // 주차에 포함된 날짜는 제외일이 아니므로 학습일/복습일로 분류
      if (i < studyDays) {
        dayTypeMap.set(dateStr, "학습일");
      } else {
        dayTypeMap.set(dateStr, "복습일");
      }
    }
  }

  // 4. 모든 날짜가 dayTypeMap에 있는지 확인 (없으면 학습일로 기본값 설정)
  // 제외일이 아니면서 주차에도 포함되지 않은 날짜는 학습일로 처리
  for (const date of dates) {
    const dateStr = formatDate(date);
    if (!dayTypeMap.has(dateStr)) {
      dayTypeMap.set(dateStr, "학습일");
    }
  }

  return dayTypeMap;
}

/**
 * 시간 타임라인 생성 (시간 흐름 순)
 * 블록 시간을 기준으로 점심시간, 학원일정(이동시간 포함), 자율학습을 시간 순으로 배치
 * 더 간단하고 정확한 방식으로 재작성
 */
function generateTimeSlots(
  date: Date,
  dayType: DayType,
  blocks: Block[],
  academySchedules: AcademySchedule[],
  options: CalculateOptions
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dateBlocks = getBlocksForDate(date, blocks);
  const dateAcademySchedules = getAcademySchedulesForDate(date, academySchedules);

  // 기본 설정값
  const campStudyHours: TimeRange =
    options.camp_study_hours || { start: "10:00", end: "19:00" };
  const campSelfStudyHours: TimeRange =
    options.camp_self_study_hours || { start: "19:00", end: "22:00" };
  const lunchTime: TimeRange =
    options.lunch_time || { start: "12:00", end: "13:00" };
  const designatedHolidayHours: TimeRange =
    options.designated_holiday_hours || { start: "13:00", end: "19:00" };

  // 지정휴일 처리
  if (dayType === "지정휴일") {
    // enable_self_study_for_holidays가 true일 때만 자율학습 시간 배정
    if (options.enable_self_study_for_holidays) {
      slots.push({
        type: "자율학습",
        start: designatedHolidayHours.start,
        end: designatedHolidayHours.end,
      });
    }
    return slots;
  }

  // 휴가/개인일정은 빈 배열 반환
  if (dayType === "휴가" || dayType === "개인일정") {
    return slots;
  }

  // 블록이 있으면 블록 사용, 없으면 캠프 시간 사용
  let baseRanges: TimeRange[] = [];
  if (dateBlocks.length > 0) {
    baseRanges = dateBlocks.map((block) => ({
      start: block.start_time,
      end: block.end_time,
    }));
  } else {
    baseRanges = [campStudyHours];
    if (campSelfStudyHours) {
      baseRanges.push(campSelfStudyHours);
    }
  }

  // 각 블록/캠프 시간 범위에 대해 타임라인 생성
  for (const baseRange of baseRanges) {
    const rangeStart = timeToMinutes(baseRange.start);
    const rangeEnd = timeToMinutes(baseRange.end);
    const lunchStart = timeToMinutes(lunchTime.start);
    const lunchEnd = timeToMinutes(lunchTime.end);

    // 이 범위 내의 학원일정 수집 (이동시간 포함)
    const academyEvents: Array<{
      start: number;
      end: number;
      type: "이동시간" | "학원일정";
      label?: string;
    }> = [];

    for (const academy of dateAcademySchedules) {
      const travelTime = academy.travel_time || 60;
      const academyStart = timeToMinutes(academy.start_time);
      const academyEnd = timeToMinutes(academy.end_time);
      
      // 학원일정이 이 범위와 겹치는지 확인
      if (academyStart < rangeEnd && academyEnd > rangeStart) {
        // 이동시간 (학원 가는 시간) - 범위 내에 있는 부분만
        const travelStart = Math.max(rangeStart, academyStart - travelTime);
        const travelEnd = academyStart;
        if (travelStart < travelEnd) {
          academyEvents.push({
            start: travelStart,
            end: travelEnd,
            type: "이동시간",
          });
        }
        
        // 학원일정 - 범위 내에 있는 부분만
        const academyStartInRange = Math.max(rangeStart, academyStart);
        const academyEndInRange = Math.min(rangeEnd, academyEnd);
        if (academyStartInRange < academyEndInRange) {
          academyEvents.push({
            start: academyStartInRange,
            end: academyEndInRange,
            type: "학원일정",
            label: `${academy.academy_name || "학원"}${academy.subject ? `-${academy.subject}` : ""}`,
          });
        }
        
        // 이동시간 (학원에서 돌아오는 시간) - 범위 내에 있는 부분만
        const returnTravelStart = academyEnd;
        const returnTravelEnd = Math.min(rangeEnd, academyEnd + travelTime);
        if (returnTravelStart < returnTravelEnd) {
          academyEvents.push({
            start: returnTravelStart,
            end: returnTravelEnd,
            type: "이동시간",
          });
        }
      }
    }

    // 모든 시간 구간을 수집 (점심시간, 학원일정, 이동시간)
    // 시간 순으로 정렬하여 겹치지 않도록 처리
    const allSegments: Array<{ start: number; end: number; type: TimeSlot["type"]; label?: string }> = [];

    // 점심시간 추가 (범위 내에 있는 경우)
    if (lunchStart < rangeEnd && lunchEnd > rangeStart) {
      allSegments.push({
        start: Math.max(rangeStart, lunchStart),
        end: Math.min(rangeEnd, lunchEnd),
        type: "점심시간",
      });
    }

    // 학원일정 및 이동시간 추가
    allSegments.push(...academyEvents.map((e) => ({
      start: e.start,
      end: e.end,
      type: e.type as TimeSlot["type"],
      label: e.label,
    })));

    // 시간 순으로 정렬
    allSegments.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      // 같은 시작 시간이면 종료 시간이 빠른 것 먼저
      return a.end - b.end;
    });

    // 겹치는 세그먼트 병합 (같은 타입이 연속된 경우)
    const mergedSegments: typeof allSegments = [];
    for (const segment of allSegments) {
      if (mergedSegments.length === 0) {
        mergedSegments.push({ ...segment });
      } else {
        const last = mergedSegments[mergedSegments.length - 1];
        // 겹치거나 연속된 경우 병합 (같은 타입이고, 겹치거나 바로 이어지는 경우)
        if (
          last.type === segment.type &&
          last.end >= segment.start &&
          last.label === segment.label
        ) {
          last.end = Math.max(last.end, segment.end);
        } else {
          mergedSegments.push({ ...segment });
        }
      }
    }

    // 학습시간 구간 계산 (전체 범위에서 다른 구간들을 제외)
    let currentPos = rangeStart;
    for (const segment of mergedSegments) {
      // 학습시간 구간 추가 (현재 위치 ~ 세그먼트 시작)
      if (currentPos < segment.start) {
        slots.push({
          type: "학습시간",
          start: minutesToTime(currentPos),
          end: minutesToTime(segment.start),
        });
      }
      
      // 세그먼트 추가
      slots.push({
        type: segment.type,
        start: minutesToTime(segment.start),
        end: minutesToTime(segment.end),
        label: segment.label,
      });
      
      currentPos = Math.max(currentPos, segment.end);
    }

    // 마지막 학습시간 구간 추가
    if (currentPos < rangeEnd) {
      slots.push({
        type: "학습시간",
        start: minutesToTime(currentPos),
        end: minutesToTime(rangeEnd),
      });
    }
  }

  // 자율학습 시간 추가
  // - 블록이 없을 때: 항상 추가
  // - 블록이 있을 때: use_self_study_with_blocks가 true이면 추가
  if (campSelfStudyHours) {
    if (dateBlocks.length === 0 || options.use_self_study_with_blocks) {
      slots.push({
        type: "자율학습",
        start: campSelfStudyHours.start,
        end: campSelfStudyHours.end,
      });
    }
  }

  // 시간 순으로 정렬
  slots.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  return slots;
}

/**
 * 특정 날짜의 학습 가능 시간 계산
 */
function calculateAvailableTimeForDate(
  date: Date,
  dayType: DayType,
  blocks: Block[],
  academySchedules: AcademySchedule[],
  exclusion: Exclusion | null,
  options: CalculateOptions
): { ranges: TimeRange[]; hours: number; note: string; timeSlots: TimeSlot[] } {
  const dateStr = formatDate(date);
  const dayOfWeek = getDayOfWeek(date);
  const dateBlocks = getBlocksForDate(date, blocks);
  const dateAcademySchedules = getAcademySchedulesForDate(
    date,
    academySchedules
  );

  let availableRanges: TimeRange[] = [];

  // 기본 설정값
  const campStudyHours: TimeRange =
    options.camp_study_hours || { start: "10:00", end: "19:00" };
  const campSelfStudyHours: TimeRange =
    options.camp_self_study_hours || { start: "19:00", end: "22:00" };
  const lunchTime: TimeRange =
    options.lunch_time || { start: "12:00", end: "13:00" };
  const designatedHolidayHours: TimeRange =
    options.designated_holiday_hours || { start: "13:00", end: "19:00" };

  // 1. 지정휴일 처리
  if (dayType === "지정휴일") {
    // enable_self_study_for_holidays가 true일 때만 자율학습 시간 배정
    if (options.enable_self_study_for_holidays) {
      availableRanges = [designatedHolidayHours];
    } else {
      availableRanges = [];
    }
  }
  // 2. 휴가/개인일정 처리
  else if (dayType === "휴가" || dayType === "개인일정") {
    availableRanges = [];
  }
  // 3. 일반 학습일/복습일 처리
  else {
    // 블록이 있으면 블록 사용, 없으면 캠프 시간 사용
    if (dateBlocks.length > 0) {
      // 블록 시간대를 TimeRange로 변환
      availableRanges = dateBlocks.map((block) => ({
        start: block.start_time,
        end: block.end_time,
      }));
    } else {
      // 캠프 시간 사용 (학습시간 + 자율학습)
      availableRanges = [campStudyHours, campSelfStudyHours];
    }

    // 점심시간 제외
    availableRanges = availableRanges.flatMap((range) =>
      subtractTimeRange(range, lunchTime)
    );

    // 학원 일정 시간 제외 (이동시간 포함)
    for (const academy of dateAcademySchedules) {
      const travelTime = academy.travel_time || 60; // 기본값: 60분
      const academyStartMinutes = timeToMinutes(academy.start_time);
      const academyEndMinutes = timeToMinutes(academy.end_time);
      
      // 이동시간을 고려한 제외 범위 계산
      const exclusionStartMinutes = academyStartMinutes - travelTime;
      const exclusionEndMinutes = academyEndMinutes + travelTime;
      
      const academyRangeWithTravel: TimeRange = {
        start: minutesToTime(exclusionStartMinutes),
        end: minutesToTime(exclusionEndMinutes),
      };
      
      availableRanges = availableRanges.flatMap((range) =>
        subtractTimeRange(range, academyRangeWithTravel)
      );
    }
  }

  // 병합 및 정리
  availableRanges = mergeTimeRanges(availableRanges);
  const hours = calculateHours(availableRanges);

  // 노트 생성
  const noteParts: string[] = [];
  if (availableRanges.length > 0) {
    noteParts.push(
      availableRanges.map((r) => `${r.start}~${r.end}`).join(", ")
    );
  } else {
    noteParts.push("학습 불가");
  }

  const note = noteParts.join(" ");

  // 시간 타임라인 생성
  const timeSlots = generateTimeSlots(date, dayType, blocks, academySchedules, options);

  // 타임라인에서 학습시간만 계산하여 검증 (디버깅용, 실제 계산은 availableRanges 기준)
  // 자율학습도 학습 가능 시간에 포함되므로 계산에 포함
  const timeSlotsStudyHours = timeSlots
    .filter((slot) => slot.type === "학습시간" || slot.type === "자율학습")
    .reduce((sum, slot) => {
      const start = timeToMinutes(slot.start);
      const end = timeToMinutes(slot.end);
      return sum + (end - start) / 60;
    }, 0);

  // 시간이 크게 다르면 경고 (0.5시간 이상 차이 - 자율학습 포함 여부 차이 고려)
  if (Math.abs(hours - timeSlotsStudyHours) > 0.5) {
    console.warn(
      `시간 불일치: ${dateStr} - 계산: ${hours.toFixed(2)}h, 타임라인: ${timeSlotsStudyHours.toFixed(2)}h`
    );
  }

  return { ranges: availableRanges, hours, note, timeSlots };
}

/**
 * 메인 계산 함수
 */
export function calculateAvailableDates(
  periodStart: string,
  periodEnd: string,
  blocks: Block[],
  exclusions: Exclusion[],
  academySchedules: AcademySchedule[],
  options: CalculateOptions
): ScheduleAvailabilityResult {
  const errors: string[] = [];

  // 입력 검증
  if (!periodStart || !periodEnd) {
    errors.push("캠프 시작일과 종료일을 입력해주세요.");
    return {
      summary: {
        total_days: 0,
        total_study_days: 0,
        total_review_days: 0,
        total_study_hours: 0,
        total_study_hours_학습일: 0,
        total_study_hours_복습일: 0,
        total_self_study_hours: 0,
        total_exclusion_days: {
          휴가: 0,
          개인사정: 0,
          지정휴일: 0,
        },
        academy_statistics: {
          total_academy_schedules: 0,
          unique_academies: 0,
          total_academy_hours: 0,
          total_travel_hours: 0,
          average_travel_time: 0,
          academy_groups: [],
        },
        camp_period: {
          start_date: periodStart || "",
          end_date: periodEnd || "",
        },
      },
      daily_schedule: [],
      errors,
    };
  }

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    errors.push("올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)");
  }

  if (startDate > endDate) {
    errors.push("시작일은 종료일보다 앞서야 합니다.");
  }

  // 날짜 범위 생성
  const dates = generateDateRange(startDate, endDate);

  // 중복 제외일 확인
  const exclusionDates = new Set<string>();
  for (const exclusion of exclusions) {
    if (exclusionDates.has(exclusion.exclusion_date)) {
      errors.push(
        `${exclusion.exclusion_date}: 중복된 제외일이 있습니다.`
      );
    }
    exclusionDates.add(exclusion.exclusion_date);
  }

  // 날짜별 타입 분류 및 주차 정보 계산
  let dayTypeMap: Map<string, DayType>;
  let weekMap: Map<string, number> = new Map(); // 날짜 -> 주차 번호 매핑 (모든 날짜 포함)
  
  if (options.scheduler_type === "1730_timetable") {
    const studyDays = options.scheduler_options?.study_days || 6;
    const reviewDays = options.scheduler_options?.review_days || 1;
    dayTypeMap = classifyDaysFor1730(dates, exclusions, studyDays, reviewDays);
    
    // 주차 정보 매핑 (학습일/복습일 분류용)
    const weeks = calculateWeeksFor1730(dates, exclusions);
    
    // 모든 날짜를 주차에 매핑 (제외일 포함)
    // 주차는 날짜 순서대로 배정하되, 학습일/복습일 분류는 별도로 처리
    let currentWeek = 1;
    let currentWeekCount = 0;
    
    for (const date of dates) {
      const dateStr = formatDate(date);
      const exclusion = getExclusionForDate(dateStr, exclusions);
      
      // 제외일이 아닌 경우에만 주차 카운트 증가 (학습일/복습일 분류용)
      if (!exclusion) {
        currentWeekCount++;
        // 7일이 되면 다음 주차로
        if (currentWeekCount > 7) {
          currentWeek++;
          currentWeekCount = 1;
        }
      }
      
      // 모든 날짜를 현재 주차에 매핑
      weekMap.set(dateStr, currentWeek);
    }
  } else {
    // 자동 스케줄러: 제외일만 고려
    dayTypeMap = new Map();
    for (const date of dates) {
      const dateStr = formatDate(date);
      const exclusion = getExclusionForDate(dateStr, exclusions);
      if (exclusion) {
        if (exclusion.exclusion_type === "휴가") {
          dayTypeMap.set(dateStr, "휴가");
        } else if (exclusion.exclusion_type === "개인사정") {
          dayTypeMap.set(dateStr, "개인일정");
        } else if (exclusion.exclusion_type === "휴일지정") {
          dayTypeMap.set(dateStr, "지정휴일");
        } else {
          dayTypeMap.set(dateStr, "학습일");
        }
      } else {
        dayTypeMap.set(dateStr, "학습일");
      }
    }
  }

  // 일별 스케줄 계산
  const dailySchedule: DailySchedule[] = [];
  let totalStudyDays = 0;
  let totalReviewDays = 0;
  let totalStudyHours = 0;
  let totalStudyHours_학습일 = 0;
  let totalStudyHours_복습일 = 0;
  let totalSelfStudyHours = 0; // 자율학습 시간 합계
  
  // 제외일 통계
  let totalExclusionDays = {
    휴가: 0,
    개인사정: 0,
    지정휴일: 0,
  };

  // 학원일정 통계 계산
  const academyGroups = groupAcademySchedules(academySchedules, dates);
  let totalAcademySchedules = 0;
  let totalAcademyHours = 0;
  let totalTravelHours = 0;
  let totalTravelMinutes = 0;

  for (const date of dates) {
    const dateStr = formatDate(date);
    const dayType = dayTypeMap.get(dateStr) || "학습일";
    const exclusion = getExclusionForDate(dateStr, exclusions);
    
    // 해당 날짜의 학원일정 조회
    const dateAcademySchedules = getAcademySchedulesForDate(
      date,
      academySchedules
    );

    const { ranges, hours, note, timeSlots } = calculateAvailableTimeForDate(
      date,
      dayType,
      blocks,
      academySchedules,
      exclusion,
      options
    );

    dailySchedule.push({
      date: dateStr,
      day_type: dayType,
      study_hours: hours,
      available_time_ranges: ranges,
      note,
      academy_schedules: dateAcademySchedules.length > 0 ? dateAcademySchedules : undefined,
      exclusion: exclusion || null,
      week_number: weekMap.get(dateStr),
      time_slots: timeSlots.length > 0 ? timeSlots : undefined,
    });

    // 통계 계산
    if (dayType === "학습일") {
      totalStudyDays++;
      totalStudyHours_학습일 += hours;
    } else if (dayType === "복습일") {
      totalReviewDays++;
      totalStudyHours_복습일 += hours;
    } else if (dayType === "휴가") {
      totalExclusionDays.휴가++;
    } else if (dayType === "개인일정") {
      totalExclusionDays.개인사정++;
    } else if (dayType === "지정휴일") {
      totalExclusionDays.지정휴일++;
    }
    totalStudyHours += hours;
    
    // 자율학습 시간 계산 (timeSlots에서 "자율학습" 타입의 시간 합산)
    if (timeSlots && timeSlots.length > 0) {
      for (const slot of timeSlots) {
        if (slot.type === "자율학습") {
          const slotStart = timeToMinutes(slot.start);
          const slotEnd = timeToMinutes(slot.end);
          const slotHours = (slotEnd - slotStart) / 60;
          totalSelfStudyHours += slotHours;
        }
      }
    }

    // 학원일정 통계 계산
    if (dateAcademySchedules.length > 0) {
      totalAcademySchedules += dateAcademySchedules.length;
      
      for (const academy of dateAcademySchedules) {
        const academyStart = timeToMinutes(academy.start_time);
        const academyEnd = timeToMinutes(academy.end_time);
        const academyMinutes = academyEnd - academyStart;
        totalAcademyHours += academyMinutes / 60;
        
        const travelTime = academy.travel_time || 60;
        totalTravelMinutes += travelTime * 2; // 왕복
      }
    }
  }

  totalTravelHours = totalTravelMinutes / 60;
  const averageTravelTime = totalAcademySchedules > 0 
    ? totalTravelMinutes / totalAcademySchedules 
    : 0;

  const summary: ScheduleSummary = {
    total_days: dailySchedule.length,
    total_study_days: totalStudyDays,
    total_review_days: totalReviewDays,
    total_study_hours: totalStudyHours,
    total_study_hours_학습일: totalStudyHours_학습일,
    total_study_hours_복습일: totalStudyHours_복습일,
    total_self_study_hours: totalSelfStudyHours,
    total_exclusion_days: totalExclusionDays,
    academy_statistics: {
      total_academy_schedules: totalAcademySchedules,
      unique_academies: academyGroups.length,
      total_academy_hours: totalAcademyHours,
      total_travel_hours: totalTravelHours,
      average_travel_time: averageTravelTime,
      academy_groups: academyGroups,
    },
    camp_period: {
      start_date: periodStart,
      end_date: periodEnd,
    },
  };

  return {
    summary,
    daily_schedule: dailySchedule,
    errors,
  };
}

