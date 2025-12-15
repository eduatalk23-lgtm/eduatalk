/**
 * 타임존 및 날짜 처리 유틸리티
 * 
 * 학습 지표가 0시~9시 사이 누락되는 문제를 해결하기 위해
 * 모든 날짜 처리를 타임존을 고려하여 수행합니다.
 * 
 * 기본 타임존: Asia/Seoul (KST, UTC+9)
 */

import { TZDate } from "@date-fns/tz";
import { startOfDay, endOfDay, format, isSameDay } from "date-fns";
import { tz } from "@date-fns/tz";

const DEFAULT_TIMEZONE = "Asia/Seoul";

/**
 * 특정 타임존의 하루 시작 시간을 UTC Date로 변환
 * 
 * @param date - 날짜 (Date 객체 또는 YYYY-MM-DD 형식 문자열)
 * @param timezone - 타임존 (기본값: 'Asia/Seoul')
 * @returns UTC 기준 하루 시작 시간 (Date 객체)
 * 
 * @example
 * // KST 2024-01-15 00:00:00을 UTC로 변환
 * const start = getStartOfDayUTC('2024-01-15', 'Asia/Seoul');
 * // 결과: 2024-01-14 15:00:00 UTC (KST는 UTC+9이므로)
 */
export function getStartOfDayUTC(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const dateObj = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  const tzDate = TZDate.tz(timezone, dateObj);
  const startOfDayTz = startOfDay(tzDate, { in: tz(timezone) });
  
  // TZDate를 일반 Date로 변환 (UTC 기준)
  return new Date(startOfDayTz.getTime());
}

/**
 * 특정 타임존의 하루 끝 시간을 UTC Date로 변환
 * 
 * @param date - 날짜 (Date 객체 또는 YYYY-MM-DD 형식 문자열)
 * @param timezone - 타임존 (기본값: 'Asia/Seoul')
 * @returns UTC 기준 하루 끝 시간 (Date 객체, 23:59:59.999)
 * 
 * @example
 * // KST 2024-01-15 23:59:59.999를 UTC로 변환
 * const end = getEndOfDayUTC('2024-01-15', 'Asia/Seoul');
 * // 결과: 2024-01-15 14:59:59.999 UTC
 */
export function getEndOfDayUTC(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const dateObj = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  const tzDate = TZDate.tz(timezone, dateObj);
  const endOfDayTz = endOfDay(tzDate, { in: tz(timezone) });
  
  // TZDate를 일반 Date로 변환 (UTC 기준)
  return new Date(endOfDayTz.getTime());
}

/**
 * UTC Date를 특정 타임존 기준으로 변환하여 YYYY-MM-DD 형식 문자열로 반환
 * 
 * @param date - UTC Date 객체
 * @param timezone - 타임존 (기본값: 'Asia/Seoul')
 * @returns YYYY-MM-DD 형식 문자열
 * 
 * @example
 * // UTC 2024-01-15 00:00:00을 KST로 변환
 * const dateStr = formatDateInTimezone(new Date('2024-01-15T00:00:00Z'), 'Asia/Seoul');
 * // 결과: '2024-01-15' (KST는 UTC+9이므로)
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const tzDate = TZDate.tz(timezone, date);
  return format(tzDate, "yyyy-MM-dd", { in: tz(timezone) });
}

/**
 * 현재 시간을 특정 타임존 기준으로 오늘 날짜를 반환
 * 
 * @param timezone - 타임존 (기본값: 'Asia/Seoul')
 * @returns YYYY-MM-DD 형식 문자열
 * 
 * @example
 * // 현재 시간이 KST 기준으로 2024-01-15 10:00:00이면
 * const today = getTodayInTimezone('Asia/Seoul');
 * // 결과: '2024-01-15'
 */
export function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  const now = new Date();
  return formatDateInTimezone(now, timezone);
}

/**
 * 두 날짜가 특정 타임존에서 같은 날인지 확인
 * 
 * @param date1 - 첫 번째 날짜
 * @param date2 - 두 번째 날짜
 * @param timezone - 타임존 (기본값: 'Asia/Seoul')
 * @returns 같은 날이면 true, 아니면 false
 * 
 * @example
 * // UTC 2024-01-15 00:00:00과 UTC 2024-01-14 15:00:00이 KST에서 같은 날인지 확인
 * const same = isSameDayInTimezone(
 *   new Date('2024-01-15T00:00:00Z'),
 *   new Date('2024-01-14T15:00:00Z'),
 *   'Asia/Seoul'
 * );
 * // 결과: true (둘 다 KST 2024-01-15)
 */
export function isSameDayInTimezone(
  date1: Date,
  date2: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const tz1 = TZDate.tz(timezone, date1);
  const tz2 = TZDate.tz(timezone, date2);
  return isSameDay(tz1, tz2, { in: tz(timezone) });
}

/**
 * 타임존 기준으로 날짜 문자열을 Date 객체로 변환
 * 
 * @param dateStr - YYYY-MM-DD 형식 문자열
 * @param timezone - 타임존 (기본값: 'Asia/Seoul')
 * @returns 해당 타임존의 날짜 시작 시간을 나타내는 Date 객체
 * 
 * @example
 * // '2024-01-15'를 KST 기준으로 변환
 * const date = parseDateInTimezone('2024-01-15', 'Asia/Seoul');
 * // 결과: KST 2024-01-15 00:00:00에 해당하는 Date 객체
 */
export function parseDateInTimezone(
  dateStr: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const tzDate = TZDate.tz(timezone, dateStr + "T00:00:00");
  return new Date(tzDate.getTime());
}

