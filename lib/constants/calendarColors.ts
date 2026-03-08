/**
 * 캘린더 색상 팔레트 키 (서버/클라이언트 공유)
 *
 * eventColors.ts의 EVENT_COLOR_PALETTE 순서와 동기화 필요.
 * 색상환 순서: 빨강(warm) → 노랑 → 초록 → 파랑(cool) → 보라 → 무채색
 */
export const CALENDAR_COLOR_KEYS = [
  // GCal 기본 11색
  'tomato', 'flamingo', 'tangerine', 'banana', 'sage', 'basil',
  'peacock', 'blueberry', 'lavender', 'grape', 'graphite',
  // 확장 13색
  'cherry', 'radicchio', 'pumpkin', 'mango', 'cocoa',
  'pistachio', 'avocado', 'eucalyptus', 'ocean', 'cobalt',
  'wisteria', 'amethyst', 'birch',
] as const;

export type CalendarColorKey = (typeof CALENDAR_COLOR_KEYS)[number];

/**
 * 기존 캘린더 색상 목록을 참고하여 미사용 팔레트 색상 자동 선택
 */
export function pickNextCalendarColor(
  existingColors: (string | null | undefined)[]
): CalendarColorKey {
  const usedSet = new Set(existingColors.filter((c): c is string => !!c));
  for (const key of CALENDAR_COLOR_KEYS) {
    if (!usedSet.has(key)) return key;
  }
  return CALENDAR_COLOR_KEYS[existingColors.length % CALENDAR_COLOR_KEYS.length];
}
