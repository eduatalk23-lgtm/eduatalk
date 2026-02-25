/**
 * Google Calendar 색상 시스템
 *
 * 색상 우선순위: eventColor → calendarColor → fallback (peacock blue)
 * 좌측 바: 항상 calendarColor (캘린더 식별)
 * 배경: eventColor 있으면 그것, 없으면 calendarColor
 *
 * Status는 opacity로만 구분 (향후 Google Tasks 스타일로 확장 예정):
 * - 기본 (confirmed/in_progress/pending): opacity 1.0
 * - completed: opacity 0.6
 * - cancelled/missed: opacity 0.5 + 취소선
 * - deferred: opacity 0.8
 */

import { getEventColor } from './eventColors';

// ============================================
// New GCal-style color system
// ============================================

/** GCal 기본 색상 (Peacock Blue) */
const GCAL_DEFAULT_COLOR = '#039be5';

/** GCal 스타일 블록 색상 — 모든 뷰에서 공통 사용 */
export interface CalendarBlockStyle {
  /** 배경색 (hex) — inline style용 */
  bgHex: string;
  /** 좌측 바 색상 (hex) — 항상 캘린더 색상 */
  barHex: string;
  /** 텍스트 흰색 여부 (배경 밝기 기반) */
  textIsWhite: boolean;
  /** opacity (0~1) — status에 따라 결정 */
  opacity: number;
  /** 취소선 여부 (cancelled/missed만) */
  strikethrough: boolean;
  /** 이벤트 고유색이 있어서 배경 ≠ 캘린더색인지 여부 */
  hasDistinctEventColor: boolean;
}

/** hex 색상이 어두운지 판별 (W3C perceived luminance) */
function isColorDark(hex: string): boolean {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length !== 6) return true; // fallback: 어두운 것으로 간주
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 150;
}

/** hex 키 또는 팔레트 키 → hex 값 해석 */
function resolveColorHex(colorKey: string | null | undefined): string | null {
  if (!colorKey) return null;
  const ec = getEventColor(colorKey);
  if (ec) return ec.hex;
  // getEventColor가 못 찾았지만 hex 형식이면 그대로
  if (/^#[0-9a-fA-F]{6}$/.test(colorKey)) return colorKey;
  return null;
}

/**
 * GCal 스타일 이벤트 색상 해석
 *
 * @param eventColor - 이벤트 개별 색상 (calendar_events.color)
 * @param calendarColor - 캘린더 기본 색상 (calendars.default_color)
 * @param status - 이벤트 상태
 * @param isCompleted - 완료 여부
 */
export function resolveCalendarColors(
  eventColor: string | null | undefined,
  calendarColor: string | null | undefined,
  status: string,
  isCompleted: boolean,
): CalendarBlockStyle {
  // 색상 해석: eventColor → calendarColor → fallback
  const resolvedEvent = resolveColorHex(eventColor);
  const resolvedCal = resolveColorHex(calendarColor);
  const bgHex = resolvedEvent ?? resolvedCal ?? GCAL_DEFAULT_COLOR;
  const rawBarHex = resolvedCal ?? GCAL_DEFAULT_COLOR;

  // 이벤트 고유색 존재 여부
  const hasDistinctEventColor = resolvedEvent != null && rawBarHex !== resolvedEvent;

  // 좌측 바 색상: 항상 캘린더 색상 (이벤트색 없으면 배경과 통일)
  const barHex = rawBarHex;

  // 텍스트 대비
  const textIsWhite = isColorDark(bgHex);

  // Status → opacity + strikethrough
  let opacity = 1;
  let strikethrough = false;
  if (isCompleted || status === 'completed') {
    opacity = 0.6;
  } else if (status === 'cancelled' || status === 'missed') {
    opacity = 0.5;
    strikethrough = true;
  } else if (status === 'deferred') {
    opacity = 0.8;
  }

  return { bgHex, barHex, textIsWhite, opacity, strikethrough, hasDistinctEventColor };
}

// ============================================
// Legacy: 기존 호환 (deprecated — 단계적 제거 예정)
// ============================================

/** @deprecated resolveCalendarColors() 사용 */
export interface SolidColorSet {
  solidBg: string;
  lightBg: string;
  coloredText: string;
  coloredBorder: string;
  progressBar: string;
}

/** @deprecated resolveCalendarColors() 사용 */
export interface BlockStyle {
  bgColor: string | null;
  bgClass: string | null;
  textClass: string;
  borderClass: string;
  opacityClass: string;
  strikethrough: boolean;
  progressBar: string;
  variant: 'solid' | 'bordered' | 'muted';
  barColor: string;
  inlineTextColor?: string;
  inlineBorderColor?: string;
  inlineLightBg?: string;
  inlineProgressBar?: string;
}

const SOLID_PALETTE: SolidColorSet[] = [
  { solidBg: '#5b5fc7', lightBg: 'bg-indigo-50', coloredText: 'text-indigo-700', coloredBorder: 'border-indigo-400', progressBar: 'bg-indigo-200' },
  { solidBg: '#7c3aed', lightBg: 'bg-purple-50', coloredText: 'text-purple-700', coloredBorder: 'border-purple-400', progressBar: 'bg-purple-200' },
  { solidBg: '#db2777', lightBg: 'bg-pink-50', coloredText: 'text-pink-700', coloredBorder: 'border-pink-400', progressBar: 'bg-pink-200' },
  { solidBg: '#d97706', lightBg: 'bg-amber-50', coloredText: 'text-amber-700', coloredBorder: 'border-amber-400', progressBar: 'bg-amber-200' },
  { solidBg: '#059669', lightBg: 'bg-emerald-50', coloredText: 'text-emerald-700', coloredBorder: 'border-emerald-400', progressBar: 'bg-emerald-200' },
  { solidBg: '#2563eb', lightBg: 'bg-blue-50', coloredText: 'text-blue-700', coloredBorder: 'border-blue-400', progressBar: 'bg-blue-200' },
  { solidBg: '#dc2626', lightBg: 'bg-red-50', coloredText: 'text-red-700', coloredBorder: 'border-red-400', progressBar: 'bg-red-200' },
  { solidBg: '#0d9488', lightBg: 'bg-teal-50', coloredText: 'text-teal-700', coloredBorder: 'border-teal-400', progressBar: 'bg-teal-200' },
];

const DEFAULT_PALETTE_INDEX = 5;

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getSubjectColorIndex(subject: string): number {
  return djb2Hash(subject) % SOLID_PALETTE.length;
}

export function getSubjectPalette(subject: string | undefined): SolidColorSet {
  if (!subject) return SOLID_PALETTE[DEFAULT_PALETTE_INDEX];
  return SOLID_PALETTE[getSubjectColorIndex(subject)];
}

/** @deprecated resolveCalendarColors() 사용 */
export function getGridBlockColors(
  subject: string | undefined,
  status: string,
  isCompleted: boolean,
  colorOverride?: string | null,
  calendarColor?: string | null,
): BlockStyle {
  // 새 시스템으로 해석 후 레거시 형태로 변환
  const c = resolveCalendarColors(colorOverride ?? null, calendarColor ?? null, status, isCompleted);

  // colorOverride/calendarColor 없으면 subject palette fallback
  const hasDirect = colorOverride || calendarColor;
  const bgHex = hasDirect ? c.bgHex : (getSubjectPalette(subject).solidBg);
  const barHex = calendarColor ? c.barHex : bgHex;

  return {
    bgColor: bgHex,
    bgClass: null,
    textClass: isColorDark(bgHex) ? 'text-white' : 'text-gray-900',
    borderClass: 'border-transparent',
    opacityClass: c.opacity < 1 ? `opacity-${Math.round(c.opacity * 100)}` : '',
    strikethrough: c.strikethrough,
    progressBar: '',
    variant: 'solid',
    barColor: barHex,
  };
}
