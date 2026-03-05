/**
 * 비학습시간 날짜별 레코드 생성 유틸리티
 *
 * 플래너 생성 시 템플릿 기반으로 날짜별 비학습시간 레코드를 생성합니다.
 * calendar_events 테이블 삽입용 레코드를 생성합니다.
 *
 * @module lib/domains/admin-plan/utils/nonStudyTimeGenerator
 */

import { eachDayOfInterval, getDay, format, parseISO } from 'date-fns';
import type { NonStudyTimeBlock } from './calendarConfigInheritance';
import type { CalendarEventInsert } from '@/lib/domains/calendar/types';
import { toTimestamptz, mapNonStudyType, mapExclusionType } from '@/lib/domains/calendar/helpers';
import { extractTimeHHMM, extractDateYMD } from '@/lib/domains/calendar/adapters';

// ============================================
// 타입 정의
// ============================================

/**
 * 학원 일정 입력 (플래너 학원 일정)
 */
export interface AcademyScheduleInput {
  id?: string;
  academyId?: string;
  academyName?: string;
  dayOfWeek: number; // 0-6 (일-토)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  subject?: string;
  travelTime?: number; // 분
}

/**
 * 비학습시간 생성 옵션
 */
export interface GenerateNonStudyTimesOptions {
  /** 학원 일정 목록 */
  academySchedules?: AcademyScheduleInput[];
  /** 제외일 목록 (YYYY-MM-DD) - 이 날짜들은 레코드 생성 안함 */
  excludedDates?: string[];
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 시간에서 분을 빼기
 */
function subtractMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m - minutes;
  const newH = Math.floor(Math.max(0, totalMinutes) / 60);
  const newM = Math.max(0, totalMinutes) % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * 특정 날짜에 비학습시간 블록이 적용되는지 확인
 */
function shouldApplyBlock(
  block: NonStudyTimeBlock,
  date: Date,
  dateString: string
): boolean {
  if (block.specific_dates && block.specific_dates.length > 0) {
    return block.specific_dates.includes(dateString);
  }
  if (block.day_of_week && block.day_of_week.length > 0) {
    const dayOfWeek = getDay(date);
    return block.day_of_week.includes(dayOfWeek);
  }
  return true;
}

// ============================================
// 메인 함수
// ============================================

/**
 * 플래너 기간 동안의 비학습시간 레코드 생성
 *
 * @param calendarId 캘린더 ID (calendars 테이블의 primary calendar)
 * @param studentId 학생 ID
 * @param tenantId 테넌트 ID
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 * @param nonStudyTimeBlocks 비학습시간 템플릿 배열
 * @param options 추가 옵션 (학원 일정, 제외일 등)
 * @returns calendar_events 테이블 삽입용 레코드 배열
 */
export function generateNonStudyRecordsForDateRange(
  calendarId: string,
  studentId: string,
  tenantId: string,
  startDate: string,
  endDate: string,
  nonStudyTimeBlocks: NonStudyTimeBlock[] | null | undefined,
  options: GenerateNonStudyTimesOptions = {}
): CalendarEventInsert[] {
  const records: CalendarEventInsert[] = [];
  const { academySchedules = [], excludedDates = [] } = options;

  const excludedDateSet = new Set(excludedDates);

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const dateInterval = eachDayOfInterval({ start, end });

  for (const date of dateInterval) {
    const dateString = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date);

    if (excludedDateSet.has(dateString)) {
      continue;
    }

    let orderIndex = 0;

    // 1. 일반 비학습시간 (점심식사 등)
    if (nonStudyTimeBlocks) {
      for (const block of nonStudyTimeBlocks) {
        if (!shouldApplyBlock(block, date, dateString)) {
          continue;
        }

        const { eventType, eventSubtype } = mapNonStudyType(block.type);

        records.push({
          calendar_id: calendarId,
          student_id: studentId,
          tenant_id: tenantId,
          title: block.description || block.type,
          event_type: eventType,
          event_subtype: eventSubtype,
          label: block.type,
          is_task: false,
          is_exclusion: false,
          start_at: toTimestamptz(dateString, block.start_time),
          end_at: toTimestamptz(dateString, block.end_time),
          is_all_day: false,
          status: 'confirmed',
          transparency: 'opaque',
          source: 'template',
          order_index: orderIndex++,
        });
      }
    }

    // 2. 학원 일정 (요일 매칭)
    for (const academy of academySchedules) {
      if (academy.dayOfWeek !== dayOfWeek) {
        continue;
      }

      // 이동시간 (학원 시작 전)
      if (academy.travelTime && academy.travelTime > 0) {
        const travelStart = subtractMinutes(academy.startTime, academy.travelTime);

        records.push({
          calendar_id: calendarId,
          student_id: studentId,
          tenant_id: tenantId,
          title: academy.academyName ? `${academy.academyName} 이동` : '학원 이동',
          event_type: 'academy',
          event_subtype: '이동시간',
          label: '이동시간',
          is_task: false,
          is_exclusion: false,
          start_at: toTimestamptz(dateString, travelStart),
          end_at: toTimestamptz(dateString, academy.startTime),
          is_all_day: false,
          status: 'confirmed',
          transparency: 'opaque',
          source: 'template',
          order_index: orderIndex++,
        });
      }

      // 학원 본 일정
      const subjectLabel = academy.subject ? ` (${academy.subject})` : '';
      const academyLabel = academy.academyName
        ? `${academy.academyName}${subjectLabel}`
        : `학원${subjectLabel}`;

      records.push({
        calendar_id: calendarId,
        student_id: studentId,
        tenant_id: tenantId,
        title: academyLabel,
        event_type: 'academy',
        event_subtype: '학원',
        label: '학원',
        is_task: false,
        is_exclusion: false,
        start_at: toTimestamptz(dateString, academy.startTime),
        end_at: toTimestamptz(dateString, academy.endTime),
        is_all_day: false,
        status: 'confirmed',
        transparency: 'opaque',
        source: 'template',
        order_index: orderIndex++,
      });
    }
  }

  return records;
}

/**
 * 단일 날짜의 비학습시간 레코드 생성
 */
export function generateNonStudyRecordsForDate(
  calendarId: string,
  studentId: string,
  tenantId: string,
  date: string,
  nonStudyTimeBlocks: NonStudyTimeBlock[] | null | undefined,
  options: GenerateNonStudyTimesOptions = {}
): CalendarEventInsert[] {
  return generateNonStudyRecordsForDateRange(
    calendarId,
    studentId,
    tenantId,
    date,
    date,
    nonStudyTimeBlocks,
    options
  );
}

/**
 * 특정 날짜 범위 확장 시 새 레코드만 생성
 *
 * @param existingDates 이미 레코드가 있는 날짜들 (YYYY-MM-DD)
 */
export function generateNonStudyRecordsForNewDates(
  calendarId: string,
  studentId: string,
  tenantId: string,
  startDate: string,
  endDate: string,
  nonStudyTimeBlocks: NonStudyTimeBlock[] | null | undefined,
  existingDates: string[],
  options: GenerateNonStudyTimesOptions = {}
): CalendarEventInsert[] {
  const excludedDates = [
    ...(options.excludedDates || []),
    ...existingDates,
  ];

  return generateNonStudyRecordsForDateRange(
    calendarId,
    studentId,
    tenantId,
    startDate,
    endDate,
    nonStudyTimeBlocks,
    { ...options, excludedDates }
  );
}

// ============================================
// 캘린더 통합용 함수
// ============================================

/**
 * 제외일 목록으로 CalendarEventInsert 생성 (event_type='exclusion', is_all_day=true)
 */
export function generateExclusionRecordsForDates(
  calendarId: string,
  studentId: string,
  tenantId: string,
  exclusions: Array<{
    date: string; // YYYY-MM-DD
    exclusionType: string;
    reason?: string;
  }>,
  source: string = 'imported'
): CalendarEventInsert[] {
  return exclusions.map((exc, idx) => ({
    calendar_id: calendarId,
    student_id: studentId,
    tenant_id: tenantId,
    title: exc.reason || '제외일',
    event_type: 'exclusion',
    event_subtype: mapExclusionType(exc.exclusionType),
    label: mapExclusionType(exc.exclusionType),
    is_task: false,
    is_exclusion: true,
    start_date: exc.date,
    end_date: exc.date,
    is_all_day: true,
    status: 'confirmed',
    transparency: 'transparent',
    source,
    order_index: idx,
  }));
}

/**
 * 반복 패턴으로 날짜별 CalendarEventInsert 생성 (metadata.group_id로 묶음)
 */
export function generateRecurringNonStudyRecords(
  calendarId: string,
  studentId: string,
  tenantId: string,
  pattern: {
    type: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    daysOfWeek: number[]; // 0-6
    label?: string;
    groupId: string;
  },
  periodStart: string,
  periodEnd: string,
  source: string = 'manual'
): CalendarEventInsert[] {
  const records: CalendarEventInsert[] = [];
  const start = parseISO(periodStart);
  const end = parseISO(periodEnd);
  const dateInterval = eachDayOfInterval({ start, end });
  const daysSet = new Set(pattern.daysOfWeek);

  const { eventType, eventSubtype } = mapNonStudyType(pattern.type);

  let orderIndex = 0;
  for (const date of dateInterval) {
    if (!daysSet.has(getDay(date))) continue;

    const dateString = format(date, 'yyyy-MM-dd');

    records.push({
      calendar_id: calendarId,
      student_id: studentId,
      tenant_id: tenantId,
      title: pattern.label || pattern.type,
      event_type: eventType,
      event_subtype: eventSubtype,
      label: pattern.type,
      is_task: false,
      is_exclusion: false,
      start_at: toTimestamptz(dateString, pattern.startTime),
      end_at: toTimestamptz(dateString, pattern.endTime),
      is_all_day: false,
      status: 'confirmed',
      transparency: 'opaque',
      source,
      order_index: orderIndex++,
      metadata: { group_id: pattern.groupId },
    });
  }

  return records;
}

// ============================================
// 날짜 레코드 → 주간 패턴 역변환
// ============================================

/**
 * calendar_events의 학원 레코드를 주간 패턴으로 역변환
 * scheduleCalculator 입력 형식에 맞춤
 *
 * event_type='academy' 기반 필터 + start_at/end_at에서 시간 추출
 */
export function reconstructAcademyPatternsFromCalendarEvents(
  records: Array<{
    start_at: string | null;
    end_at: string | null;
    start_date: string | null;
    event_type?: string;
    event_subtype?: string | null;
    label?: string | null;
    title: string;
  }>
): Array<{
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  travel_time?: number;
}> {
  const academyRecords = records.filter(
    (r) => (r.label === '학원' || (r.event_type === 'academy' && r.event_subtype === '학원')) && r.start_at && r.end_at
  );

  const patternMap = new Map<
    string,
    {
      day_of_week: number;
      start_time: string;
      end_time: string;
      academy_name?: string;
      travel_time?: number;
    }
  >();

  for (const rec of academyRecords) {
    const planDate = rec.start_date || extractDateYMD(rec.start_at!) || '';
    const dayOfWeek = new Date(planDate + 'T00:00:00').getDay();
    const startTime = extractTimeHHMM(rec.start_at!) ?? '00:00';
    const endTime = extractTimeHHMM(rec.end_at!) ?? '00:00';
    const key = `${dayOfWeek}-${startTime}-${endTime}`;

    if (!patternMap.has(key)) {
      // 이동시간 찾기
      const travelRecord = records.find(
        (r) =>
          (r.label === '이동시간' || (r.event_type === 'academy' && r.event_subtype === '이동시간')) &&
          (r.start_date ?? extractDateYMD(r.start_at ?? null)) === planDate &&
          extractTimeHHMM(r.end_at ?? null) === startTime
      );

      let travelTime: number | undefined;
      if (travelRecord?.start_at && travelRecord?.end_at) {
        const tStart = extractTimeHHMM(travelRecord.start_at) ?? '00:00';
        const tEnd = extractTimeHHMM(travelRecord.end_at) ?? '00:00';
        const [th, tm] = tStart.split(':').map(Number);
        const [eh, em] = tEnd.split(':').map(Number);
        travelTime = eh * 60 + em - (th * 60 + tm);
      }

      patternMap.set(key, {
        day_of_week: dayOfWeek,
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        academy_name: rec.title ?? undefined,
        travel_time: travelTime,
      });
    }
  }

  return Array.from(patternMap.values());
}

