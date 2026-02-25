/**
 * 한국 공휴일 데이터 (2025~2027)
 *
 * 고정 공휴일 + 음력 기반 변동 공휴일 (설날, 추석, 부처님오신날)
 * 대체공휴일 포함
 *
 * 데이터 출처: 한국천문연구원 + 공공데이터포털
 */

interface HolidayEntry {
  date: string; // YYYY-MM-DD
  name: string;
}

/** 고정 공휴일 (매년 동일 날짜) */
const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: '신정' },
  { month: 3, day: 1, name: '삼일절' },
  { month: 5, day: 5, name: '어린이날' },
  { month: 6, day: 6, name: '현충일' },
  { month: 8, day: 15, name: '광복절' },
  { month: 10, day: 3, name: '개천절' },
  { month: 10, day: 9, name: '한글날' },
  { month: 12, day: 25, name: '성탄절' },
];

/**
 * 변동 공휴일 (음력 기반 — 연도별 하드코딩)
 * 설날(연휴 3일), 추석(연휴 3일), 부처님오신날, 대체공휴일 포함
 */
const VARIABLE_HOLIDAYS: Record<number, HolidayEntry[]> = {
  2025: [
    // 설날 연휴 (1/28~30) + 대체공휴일 (1/31)
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-01-31', name: '대체공휴일(설날)' },
    // 부처님오신날
    { date: '2025-05-05', name: '부처님오신날' }, // 어린이날과 겹침
    { date: '2025-05-06', name: '대체공휴일(어린이날)' },
    // 추석 연휴 (10/5~7) + 대체공휴일 (10/8)
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
    { date: '2025-10-08', name: '대체공휴일(추석)' },
  ],
  2026: [
    // 설날 연휴 (2/16~18)
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    // 부처님오신날
    { date: '2026-05-24', name: '부처님오신날' },
    // 대체공휴일 (광복절 15일 토요일 → 17일 월요일)
    { date: '2026-08-17', name: '대체공휴일(광복절)' },
    // 추석 연휴 (9/24~26)
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
    // 대체공휴일 (한글날 10/9 금 → 대체 없음, 개천절 10/3 토 → 10/5 월)
    { date: '2026-10-05', name: '대체공휴일(개천절)' },
  ],
  2027: [
    // 설날 연휴 (2/6~8) + 대체공휴일 (2/9)
    { date: '2027-02-06', name: '설날 연휴' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날 연휴' },
    { date: '2027-02-09', name: '대체공휴일(설날)' },
    // 부처님오신날
    { date: '2027-05-13', name: '부처님오신날' },
    // 추석 연휴 (9/14~16)
    { date: '2027-09-14', name: '추석 연휴' },
    { date: '2027-09-15', name: '추석' },
    { date: '2027-09-16', name: '추석 연휴' },
    // 대체공휴일 (성탄절 12/25 토 → 12/27 월)
    { date: '2027-12-27', name: '대체공휴일(성탄절)' },
  ],
};

/** 연도별 공휴일 캐시 */
const yearCache = new Map<number, Map<string, string>>();

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 특정 연도의 공휴일 Map 반환
 * @returns Map<YYYY-MM-DD, 공휴일 이름>
 */
export function getKoreanHolidayMap(year: number): Map<string, string> {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const map = new Map<string, string>();

  // 고정 공휴일
  for (const h of FIXED_HOLIDAYS) {
    const dateStr = `${year}-${pad2(h.month)}-${pad2(h.day)}`;
    map.set(dateStr, h.name);
  }

  // 변동 공휴일 (해당 연도 데이터가 있는 경우만)
  const variable = VARIABLE_HOLIDAYS[year];
  if (variable) {
    for (const h of variable) {
      // 기존 고정 공휴일과 겹치면 이름 합침 (예: 어린이날 + 부처님오신날)
      const existing = map.get(h.date);
      if (existing) {
        map.set(h.date, `${existing} / ${h.name}`);
      } else {
        map.set(h.date, h.name);
      }
    }
  }

  yearCache.set(year, map);
  return map;
}

/**
 * 특정 날짜가 공휴일인지 확인
 * @returns 공휴일 이름 또는 null
 */
export function getHolidayName(dateStr: string): string | null {
  const year = parseInt(dateStr.substring(0, 4), 10);
  if (isNaN(year)) return null;
  const map = getKoreanHolidayMap(year);
  return map.get(dateStr) ?? null;
}

/**
 * 범위 내 공휴일 목록 반환 (주간/월간 뷰용)
 */
export function getHolidaysInRange(
  startDate: string,
  endDate: string,
): Map<string, string> {
  const startYear = parseInt(startDate.substring(0, 4), 10);
  const endYear = parseInt(endDate.substring(0, 4), 10);

  const result = new Map<string, string>();
  for (let y = startYear; y <= endYear; y++) {
    const yearMap = getKoreanHolidayMap(y);
    for (const [date, name] of yearMap) {
      if (date >= startDate && date <= endDate) {
        result.set(date, name);
      }
    }
  }
  return result;
}

/**
 * 공휴일을 AllDayItem 형태로 반환 (종일 이벤트 영역에 표시용)
 *
 * AllDayItem 인터페이스: { id, type, label, exclusionType, startDate?, endDate?, spanDays? }
 */
export function getHolidayAllDayItems(
  dates: string[],
): Array<{ id: string; type: string; label: string; exclusionType: null; startDate: string; endDate: string; spanDays: number; color: string }> {
  const items: Array<{ id: string; type: string; label: string; exclusionType: null; startDate: string; endDate: string; spanDays: number; color: string }> = [];

  for (const date of dates) {
    const name = getHolidayName(date);
    if (name) {
      items.push({
        id: `holiday-${date}`,
        type: 'holiday',
        label: name,
        exclusionType: null,
        startDate: date,
        endDate: date,
        spanDays: 1,
        color: '#0b8043', // GCal 공휴일 기본 색상 (basil green)
      });
    }
  }

  return items;
}
