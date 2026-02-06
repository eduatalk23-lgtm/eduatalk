/**
 * 비학습시간 날짜별 레코드 생성 유틸리티
 *
 * 플래너 생성 시 템플릿 기반으로 날짜별 비학습시간 레코드를 생성합니다.
 *
 * @module lib/domains/admin-plan/utils/nonStudyTimeGenerator
 */

import { eachDayOfInterval, getDay, format, parseISO } from 'date-fns';
import type { NonStudyTimeBlock } from './plannerConfigInheritance';

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
 * student_non_study_time 테이블 삽입용 레코드
 */
export interface NonStudyTimeRecord {
  planner_id: string;
  tenant_id: string;
  plan_date: string; // YYYY-MM-DD
  type: string;
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  label: string | null;
  academy_schedule_id: string | null;
  sequence: number;
  is_template_based: boolean;
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
 * HH:mm 형식을 HH:mm:ss 형식으로 변환
 */
function toTimeWithSeconds(time: string): string {
  if (time.length === 5) {
    return `${time}:00`;
  }
  return time;
}

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
  // specific_dates가 있으면 해당 날짜만 적용
  if (block.specific_dates && block.specific_dates.length > 0) {
    return block.specific_dates.includes(dateString);
  }

  // day_of_week가 있으면 해당 요일만 적용
  if (block.day_of_week && block.day_of_week.length > 0) {
    const dayOfWeek = getDay(date);
    return block.day_of_week.includes(dayOfWeek);
  }

  // 둘 다 없으면 매일 적용
  return true;
}

// ============================================
// 메인 함수
// ============================================

/**
 * 플래너 기간 동안의 비학습시간 레코드 생성
 *
 * @param plannerId 플래너 ID
 * @param tenantId 테넌트 ID
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 * @param nonStudyTimeBlocks 비학습시간 템플릿 배열
 * @param options 추가 옵션 (학원 일정, 제외일 등)
 * @returns student_non_study_time 테이블 삽입용 레코드 배열
 *
 * @example
 * ```typescript
 * const records = generateNonStudyRecordsForDateRange(
 *   plannerId,
 *   tenantId,
 *   '2026-02-01',
 *   '2026-02-28',
 *   nonStudyTimeBlocks,
 *   { academySchedules, excludedDates }
 * );
 * await supabase.from('student_non_study_time').insert(records);
 * ```
 */
export function generateNonStudyRecordsForDateRange(
  plannerId: string,
  tenantId: string,
  startDate: string,
  endDate: string,
  nonStudyTimeBlocks: NonStudyTimeBlock[] | null | undefined,
  options: GenerateNonStudyTimesOptions = {}
): NonStudyTimeRecord[] {
  const records: NonStudyTimeRecord[] = [];
  const { academySchedules = [], excludedDates = [] } = options;

  // 제외일 Set (빠른 조회)
  const excludedDateSet = new Set(excludedDates);

  // 시작일부터 종료일까지 각 날짜에 대해
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const dateInterval = eachDayOfInterval({ start, end });

  for (const date of dateInterval) {
    const dateString = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date);

    // 제외일이면 스킵
    if (excludedDateSet.has(dateString)) {
      continue;
    }

    // 같은 type 내 sequence 추적용 Map
    const typeSequenceMap = new Map<string, number>();

    // 1. 일반 비학습시간 (점심식사 등)
    if (nonStudyTimeBlocks) {
      for (const block of nonStudyTimeBlocks) {
        // 해당 날짜에 적용되는지 확인
        if (!shouldApplyBlock(block, date, dateString)) {
          continue;
        }

        const currentSeq = typeSequenceMap.get(block.type) ?? 0;
        typeSequenceMap.set(block.type, currentSeq + 1);

        records.push({
          planner_id: plannerId,
          tenant_id: tenantId,
          plan_date: dateString,
          type: block.type,
          start_time: toTimeWithSeconds(block.start_time),
          end_time: toTimeWithSeconds(block.end_time),
          label: block.description || null,
          academy_schedule_id: null,
          sequence: currentSeq,
          is_template_based: true,
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
        const travelSeq = typeSequenceMap.get('이동시간') ?? 0;
        typeSequenceMap.set('이동시간', travelSeq + 1);

        const travelStart = subtractMinutes(academy.startTime, academy.travelTime);

        records.push({
          planner_id: plannerId,
          tenant_id: tenantId,
          plan_date: dateString,
          type: '이동시간',
          start_time: toTimeWithSeconds(travelStart),
          end_time: toTimeWithSeconds(academy.startTime),
          label: academy.academyName ? `${academy.academyName} 이동` : '학원 이동',
          academy_schedule_id: academy.id || null,
          sequence: travelSeq,
          is_template_based: true,
        });
      }

      // 학원 본 일정
      const academySeq = typeSequenceMap.get('학원') ?? 0;
      typeSequenceMap.set('학원', academySeq + 1);

      const subjectLabel = academy.subject ? ` (${academy.subject})` : '';
      const academyLabel = academy.academyName
        ? `${academy.academyName}${subjectLabel}`
        : `학원${subjectLabel}`;

      records.push({
        planner_id: plannerId,
        tenant_id: tenantId,
        plan_date: dateString,
        type: '학원',
        start_time: toTimeWithSeconds(academy.startTime),
        end_time: toTimeWithSeconds(academy.endTime),
        label: academyLabel,
        academy_schedule_id: academy.id || null,
        sequence: academySeq,
        is_template_based: true,
      });
    }
  }

  return records;
}

/**
 * 단일 날짜의 비학습시간 레코드 생성
 *
 * 플랜 생성 시 해당 날짜의 비학습시간 레코드만 생성할 때 사용
 */
export function generateNonStudyRecordsForDate(
  plannerId: string,
  tenantId: string,
  date: string,
  nonStudyTimeBlocks: NonStudyTimeBlock[] | null | undefined,
  options: GenerateNonStudyTimesOptions = {}
): NonStudyTimeRecord[] {
  return generateNonStudyRecordsForDateRange(
    plannerId,
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
 * 플래너 기간이 연장될 때 기존 레코드는 유지하고 새 날짜만 추가
 *
 * @param existingDates 이미 레코드가 있는 날짜들 (YYYY-MM-DD)
 */
export function generateNonStudyRecordsForNewDates(
  plannerId: string,
  tenantId: string,
  startDate: string,
  endDate: string,
  nonStudyTimeBlocks: NonStudyTimeBlock[] | null | undefined,
  existingDates: string[],
  options: GenerateNonStudyTimesOptions = {}
): NonStudyTimeRecord[] {
  // 기존 날짜 + 제외일 모두 스킵
  const excludedDates = [
    ...(options.excludedDates || []),
    ...existingDates,
  ];

  return generateNonStudyRecordsForDateRange(
    plannerId,
    tenantId,
    startDate,
    endDate,
    nonStudyTimeBlocks,
    { ...options, excludedDates }
  );
}
