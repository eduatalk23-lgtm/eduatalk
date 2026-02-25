/**
 * RRULE 반복 이벤트 확장 유틸리티
 *
 * RFC 5545 RRULE을 사용하여 반복 이벤트를 날짜 범위 내 개별 인스턴스로 확장합니다.
 * `rrule` npm 패키지를 사용하여 RRULE 파싱 및 확장을 처리합니다.
 *
 * @module lib/domains/calendar/rrule
 */

import { RRule, rrulestr } from 'rrule';
import type { CalendarEventWithStudyData } from './types';

/**
 * 반복 이벤트 인스턴스 (확장된 개별 발생)
 *
 * 원본 이벤트의 모든 필드를 복사하되,
 * start_at/end_at/start_date/end_date를 해당 인스턴스 날짜로 교체합니다.
 */
export interface ExpandedEventInstance extends CalendarEventWithStudyData {
  /** 원본 반복 이벤트 ID (recurring_event_id가 없으면 자기 자신의 id) */
  _recurring_parent_id: string;
  /** 확장된 인스턴스 날짜 (YYYY-MM-DD) */
  _instance_date: string;
  /** 확장된 인스턴스인지 여부 (원본이 아닌 생성된 복사본) */
  _is_expanded: boolean;
}

/**
 * 날짜 문자열을 RRULE 호환 Date 객체로 변환
 * KST(+09:00) 시간대를 UTC로 변환하지 않고 로컬 시간으로 처리
 */
function parseLocalDate(dateStr: string): Date {
  // YYYY-MM-DD or YYYY-MM-DDT... 형식
  const [datePart] = dateStr.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Date 객체를 YYYY-MM-DD 형식으로 변환
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 시간 이벤트의 start_at/end_at을 새 날짜로 시프트
 *
 * @example shiftTimestamp("2026-02-22T09:00:00+09:00", "2026-02-22", "2026-03-01")
 *          → "2026-03-01T09:00:00+09:00"
 */
function shiftTimestamp(
  original: string,
  originalDate: string,
  newDate: string,
): string {
  // 단순 날짜 부분 교체 (시간+오프셋은 유지)
  return original.replace(originalDate, newDate);
}

/**
 * RRULE 문자열에서 반복 발생 날짜 목록을 생성합니다.
 *
 * @param rruleStr RRULE 문자열 (예: "FREQ=WEEKLY;BYDAY=MO,WE,FR")
 * @param dtstart 시작 날짜 (DTSTART)
 * @param rangeStart 조회 범위 시작 (YYYY-MM-DD)
 * @param rangeEnd 조회 범위 종료 (YYYY-MM-DD)
 * @param exdates 제외 날짜 목록 (YYYY-MM-DD[])
 * @returns 발생 날짜 목록 (YYYY-MM-DD[])
 */
export function expandRRule(
  rruleStr: string,
  dtstart: string,
  rangeStart: string,
  rangeEnd: string,
  exdates?: string[] | null,
): string[] {
  try {
    const dtstartDate = parseLocalDate(dtstart);
    const afterDate = parseLocalDate(rangeStart);
    const beforeDate = parseLocalDate(rangeEnd);
    // 범위를 하루 더 확장 (inclusive)
    beforeDate.setDate(beforeDate.getDate() + 1);

    // RRULE에 DTSTART가 없으면 추가
    const fullRuleStr = rruleStr.startsWith('RRULE:')
      ? rruleStr
      : `RRULE:${rruleStr}`;

    const rule = rrulestr(fullRuleStr, { dtstart: dtstartDate });
    const occurrences = rule.between(afterDate, beforeDate, true);

    const exdateSet = new Set(exdates ?? []);
    return occurrences
      .map((d) => formatDate(d))
      .filter((d) => !exdateSet.has(d));
  } catch {
    // RRULE 파싱 실패 시 빈 배열 반환
    return [];
  }
}

/**
 * 반복 이벤트를 날짜 범위 내 개별 인스턴스로 확장합니다.
 *
 * 동작:
 * 1. rrule 필드가 없는 이벤트는 그대로 통과
 * 2. rrule 필드가 있는 이벤트는 날짜 범위 내 발생 날짜를 계산
 * 3. is_exception=true인 이벤트는 해당 날짜의 확장 인스턴스를 대체
 * 4. 원본 이벤트(rrule 보유)는 결과에서 제외되고 확장 인스턴스로 대체
 *
 * @param events 원본 이벤트 배열 (DB 쿼리 결과)
 * @param rangeStart 조회 범위 시작 (YYYY-MM-DD)
 * @param rangeEnd 조회 범위 종료 (YYYY-MM-DD)
 * @returns 확장된 이벤트 배열
 */
export function expandRecurringEvents(
  events: CalendarEventWithStudyData[],
  rangeStart: string,
  rangeEnd: string,
): CalendarEventWithStudyData[] {
  const result: CalendarEventWithStudyData[] = [];

  // exception 인스턴스 인덱스: recurring_event_id + date → exception event
  const exceptionMap = new Map<string, CalendarEventWithStudyData>();
  for (const event of events) {
    if (event.is_exception && event.recurring_event_id) {
      const date = event.start_date ?? event.start_at?.split('T')[0] ?? '';
      if (date) {
        exceptionMap.set(`${event.recurring_event_id}:${date}`, event);
      }
    }
  }

  for (const event of events) {
    // exception 이벤트는 별도 처리 (아래 반복에서 삽입)
    if (event.is_exception) continue;

    // 비반복 이벤트: 그대로 통과
    if (!event.rrule) {
      result.push(event);
      continue;
    }

    // 반복 이벤트: RRULE 확장
    const dtstart = event.start_date ?? event.start_at?.split('T')[0] ?? '';
    if (!dtstart) {
      result.push(event); // dtstart를 알 수 없으면 원본 유지
      continue;
    }

    const occurrenceDates = expandRRule(
      event.rrule,
      dtstart,
      rangeStart,
      rangeEnd,
      event.exdates,
    );

    for (const occDate of occurrenceDates) {
      // exception 인스턴스가 있으면 그것을 사용
      const exceptionKey = `${event.id}:${occDate}`;
      const exception = exceptionMap.get(exceptionKey);
      if (exception) {
        result.push(exception);
        continue;
      }

      // 확장 인스턴스 생성 (원본 복사 + 날짜 시프트)
      const instance: CalendarEventWithStudyData = {
        ...event,
        // 날짜 필드 시프트
        start_date: event.start_date ? occDate : null,
        end_date: event.end_date
          ? occDate // all-day 단일날: 같은 날짜
          : null,
        start_at: event.start_at
          ? shiftTimestamp(event.start_at, dtstart, occDate)
          : null,
        end_at: event.end_at
          ? shiftTimestamp(event.end_at, dtstart, occDate)
          : null,
        // 메타 필드
        recurring_event_id: event.id,
      };

      result.push(instance);
    }
  }

  return result;
}

// ============================================
// RRULE → 한국어 텍스트 변환
// ============================================

const KO_DAY_NAMES: Record<string, string> = {
  MO: '월', TU: '화', WE: '수', TH: '목', FR: '금', SA: '토', SU: '일',
};

const KO_FREQ: Record<string, string> = {
  DAILY: '매일',
  WEEKLY: '매주',
  MONTHLY: '매월',
  YEARLY: '매년',
};

/** BYSETPOS 값 → 한국어 서수 */
const KO_SETPOS: Record<number, string> = {
  1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', 5: '다섯째', [-1]: '마지막',
};

/**
 * RRULE 문자열을 한국어 텍스트로 변환
 *
 * @example formatRRuleToKorean("FREQ=WEEKLY;BYDAY=MO,WE,FR") → "매주 월, 수, 금"
 * @example formatRRuleToKorean("FREQ=DAILY") → "매일"
 * @example formatRRuleToKorean("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU") → "2주마다 화"
 * @example formatRRuleToKorean("FREQ=MONTHLY;UNTIL=20260301T000000Z") → "매월 (3/1까지)"
 */
export function formatRRuleToKorean(rruleStr: string | null | undefined): string | null {
  if (!rruleStr) return null;

  const rule = rruleStr.replace(/^RRULE:/, '');
  const parts = Object.fromEntries(
    rule.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k, v];
    }),
  );

  const freq = parts.FREQ;
  if (!freq || !KO_FREQ[freq]) return null;

  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1;
  const byDay = parts.BYDAY?.split(',').map((d: string) => KO_DAY_NAMES[d]).filter(Boolean);

  // 기본 빈도 텍스트
  let text: string;
  if (interval > 1) {
    const unit = freq === 'WEEKLY' ? '주' : freq === 'DAILY' ? '일' : freq === 'MONTHLY' ? '개월' : '년';
    text = `${interval}${unit}마다`;
  } else {
    text = KO_FREQ[freq];
  }

  // MONTHLY: BYMONTHDAY or BYDAY+BYSETPOS
  if (freq === 'MONTHLY') {
    if (parts.BYMONTHDAY) {
      text += ` ${parts.BYMONTHDAY}일`;
    } else if (byDay && byDay.length > 0 && parts.BYSETPOS) {
      const setPos = parseInt(parts.BYSETPOS, 10);
      const posLabel = KO_SETPOS[setPos] ?? `${setPos}번째`;
      text += ` ${posLabel} ${byDay[0]}요일`;
    }
  } else if (byDay && byDay.length > 0) {
    // WEEKLY 등 요일
    text += ` ${byDay.join(', ')}`;
  }

  // COUNT
  if (parts.COUNT) {
    text += ` (${parts.COUNT}회)`;
  }

  // UNTIL
  if (parts.UNTIL) {
    const u = parts.UNTIL.replace(/[TZ]/g, '');
    const y = parseInt(u.substring(0, 4), 10);
    const m = parseInt(u.substring(4, 6), 10);
    const d = parseInt(u.substring(6, 8), 10);
    text += ` (${y !== new Date().getFullYear() ? `${y}/` : ''}${m}/${d}까지)`;
  }

  return text;
}

// ============================================
// RRULE 생성 헬퍼
// ============================================

/** 요일 인덱스(0=일, 1=월, ..., 6=토) → RRULE BYDAY 문자열 */
const DAY_MAP = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/**
 * 주간 반복 RRULE 문자열 생성
 *
 * @param days 반복할 요일 인덱스 배열 (0=일요일, 1=월요일, ...)
 * @returns RRULE 문자열 (예: "FREQ=WEEKLY;BYDAY=MO,WE,FR")
 */
export function createWeeklyRRule(days: number[]): string {
  if (days.length === 0) return '';
  const byDay = days.map((d) => DAY_MAP[d]).join(',');
  return `FREQ=WEEKLY;BYDAY=${byDay}`;
}

/**
 * RRULE 문자열에서 반복 요일 인덱스 배열 추출
 *
 * @param rruleStr RRULE 문자열
 * @returns 요일 인덱스 배열 (빈 배열이면 비반복)
 */
export function parseWeeklyDays(rruleStr: string | null | undefined): number[] {
  if (!rruleStr) return [];
  const match = rruleStr.match(/BYDAY=([A-Z,]+)/);
  if (!match) return [];
  const dayStrs = match[1].split(',');
  return dayStrs
    .map((d) => DAY_MAP.indexOf(d as typeof DAY_MAP[number]))
    .filter((i) => i >= 0);
}

// ============================================
// 커스텀 RRULE 빌더 / 파서
// ============================================

export interface CustomRRuleParams {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  byDay?: number[];           // 0=일 ~ 6=토 (WEEKLY용)
  monthlyMode?: 'dayOfMonth' | 'dayOfWeek';
  byMonthDay?: number;        // 매월 N일
  bySetPos?: number;          // N번째 (1=첫째, 2=둘째, -1=마지막)
  byDayForMonthly?: number;   // 요일 인덱스 (monthlyMode='dayOfWeek'일 때)
  endMode?: 'never' | 'count' | 'until';
  count?: number;
  until?: string;             // YYYY-MM-DD
}

/**
 * CustomRRuleParams → RRULE 문자열 생성
 *
 * @example buildCustomRRule({ freq: 'WEEKLY', interval: 2, byDay: [1,3,5] })
 *          → "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
 * @example buildCustomRRule({ freq: 'MONTHLY', monthlyMode: 'dayOfWeek', bySetPos: 3, byDayForMonthly: 6 })
 *          → "FREQ=MONTHLY;BYDAY=SA;BYSETPOS=3"
 */
export function buildCustomRRule(params: CustomRRuleParams): string {
  const parts: string[] = [`FREQ=${params.freq}`];

  if (params.interval && params.interval > 1) {
    parts.push(`INTERVAL=${params.interval}`);
  }

  if (params.freq === 'WEEKLY' && params.byDay && params.byDay.length > 0) {
    const byDayStr = params.byDay.map((d) => DAY_MAP[d]).join(',');
    parts.push(`BYDAY=${byDayStr}`);
  }

  if (params.freq === 'MONTHLY') {
    if (params.monthlyMode === 'dayOfWeek' && params.byDayForMonthly !== undefined) {
      parts.push(`BYDAY=${DAY_MAP[params.byDayForMonthly]}`);
      if (params.bySetPos !== undefined) {
        parts.push(`BYSETPOS=${params.bySetPos}`);
      }
    } else if (params.byMonthDay !== undefined) {
      parts.push(`BYMONTHDAY=${params.byMonthDay}`);
    }
  }

  const endMode = params.endMode ?? 'never';
  if (endMode === 'count' && params.count) {
    parts.push(`COUNT=${params.count}`);
  } else if (endMode === 'until' && params.until) {
    const untilStr = params.until.replace(/-/g, '') + 'T235959Z';
    parts.push(`UNTIL=${untilStr}`);
  }

  return parts.join(';');
}

/**
 * RRULE 문자열 → CustomRRuleParams 역파싱 (편집 UI 초기값용)
 *
 * @example parseCustomRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR")
 *          → { freq: 'WEEKLY', interval: 2, byDay: [1,3,5], endMode: 'never' }
 */
export function parseCustomRRule(rruleStr: string | null | undefined): CustomRRuleParams | null {
  if (!rruleStr) return null;

  const rule = rruleStr.replace(/^RRULE:/, '');
  const map = Object.fromEntries(
    rule.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k, v];
    }),
  );

  const freq = map.FREQ as CustomRRuleParams['freq'];
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;

  const params: CustomRRuleParams = { freq };

  // INTERVAL
  if (map.INTERVAL) {
    params.interval = parseInt(map.INTERVAL, 10);
  }

  // BYDAY
  if (map.BYDAY) {
    const dayStrs = map.BYDAY.split(',');
    const dayIndices = dayStrs
      .map((d) => DAY_MAP.indexOf(d as typeof DAY_MAP[number]))
      .filter((i) => i >= 0);

    if (freq === 'WEEKLY') {
      params.byDay = dayIndices;
    } else if (freq === 'MONTHLY') {
      params.monthlyMode = 'dayOfWeek';
      params.byDayForMonthly = dayIndices[0];
      if (map.BYSETPOS) {
        params.bySetPos = parseInt(map.BYSETPOS, 10);
      }
    }
  }

  // BYMONTHDAY
  if (map.BYMONTHDAY && freq === 'MONTHLY') {
    params.monthlyMode = 'dayOfMonth';
    params.byMonthDay = parseInt(map.BYMONTHDAY, 10);
  }

  // End mode
  if (map.COUNT) {
    params.endMode = 'count';
    params.count = parseInt(map.COUNT, 10);
  } else if (map.UNTIL) {
    params.endMode = 'until';
    // UNTIL: YYYYMMDDTHHMMSSZ → YYYY-MM-DD
    const u = map.UNTIL.replace(/[TZ]/g, '');
    params.until = `${u.substring(0, 4)}-${u.substring(4, 6)}-${u.substring(6, 8)}`;
  } else {
    params.endMode = 'never';
  }

  return params;
}
