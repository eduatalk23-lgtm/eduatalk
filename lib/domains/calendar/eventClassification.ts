/**
 * 이벤트 기간 분류 유틸리티
 *
 * GCal 기준:
 * - same-day: 시작/종료가 같은 KST 날짜 → 해당 날짜 time grid 블록
 * - cross-day: 시작/종료가 다른 KST 날짜 → 상단 spanning bar (all-day 영역)
 *
 * 예외: 종료가 다음날 정확히 자정(00:00 KST)인 경우 → same-day 취급
 *       (PM 10시 ~ AM 12시(자정) = 시작일 time grid에서 하단까지 표시)
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type EventDisplayMode = 'same-day' | 'cross-day';

/** KST 기준 YYYY-MM-DD 추출 */
function toKSTDate(isoString: string): string {
  const d = new Date(isoString);
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return kst.toISOString().split('T')[0];
}

/** KST 기준 시:분 추출 */
function toKSTTimeHHMM(isoString: string): { h: number; m: number } {
  const d = new Date(isoString);
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return { h: kst.getUTCHours(), m: kst.getUTCMinutes() };
}

/**
 * 이벤트의 표시 모드를 분류합니다.
 *
 * @returns 'same-day' → time grid 블록, 'cross-day' → 상단 spanning bar
 */
export function classifyEventDuration(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  isAllDay: boolean,
): EventDisplayMode {
  if (isAllDay || !startAt || !endAt) return 'same-day';

  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();

  if (endMs <= startMs) return 'same-day';

  const startDate = toKSTDate(startAt);
  const endDate = toKSTDate(endAt);

  // 같은 KST 날짜
  if (startDate === endDate) return 'same-day';

  // 자정 정확 종료: end의 KST 시간이 00:00이고, 시작일 다음날이면 same-day 취급
  const endTime = toKSTTimeHHMM(endAt);
  if (endTime.h === 0 && endTime.m === 0) {
    const nextDay = new Date(startDate + 'T00:00:00Z');
    nextDay.setDate(nextDay.getDate() + 1);
    if (endDate === nextDay.toISOString().split('T')[0]) return 'same-day';
  }

  return 'cross-day';
}
