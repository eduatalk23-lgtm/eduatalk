/**
 * 이벤트 기간 분류 유틸리티
 *
 * 논리적 하루 기준 (01:00 ~ 다음날 01:00):
 * - same-day: 시작/종료가 같은 논리적 날짜 → 해당 날짜 time grid 블록
 * - cross-day: 논리적 하루를 넘김 → 상단 spanning bar (all-day 영역)
 *
 * 예외: 종료가 다음날 01:00 미만(00:00~00:59 KST)인 경우 → same-day 취급
 *       (PM 10시 ~ AM 12:30 = 시작일 time grid 연장 영역에서 표시)
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

  // 논리적 하루 경계: end의 KST 시간이 01:00 이하(00:00~01:00)이고,
  // 시작일 다음날이면 same-day 취급 (연장 영역에서 표시)
  const endTime = toKSTTimeHHMM(endAt);
  const isWithinExtensionZone = endTime.h === 0 || (endTime.h === 1 && endTime.m === 0);
  if (isWithinExtensionZone) {
    const nextDay = new Date(startDate + 'T00:00:00Z');
    nextDay.setDate(nextDay.getDate() + 1);
    if (endDate === nextDay.toISOString().split('T')[0]) return 'same-day';
  }

  return 'cross-day';
}
