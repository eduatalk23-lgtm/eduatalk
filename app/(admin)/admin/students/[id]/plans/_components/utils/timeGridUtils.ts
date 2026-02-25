import type { CSSProperties } from 'react';

/**
 * 시간 그리드 관련 유틸리티 함수들
 * DailyDockTimeline과 DailyDockGridView에서 공통 사용
 */

/** HH:mm → 분 단위 변환 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** 분 → HH:mm 변환 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 분을 범위 내 퍼센트(0~100)로 변환 (가로 타임라인용) */
export function minutesToPercent(
  minutes: number,
  rangeStart: number,
  rangeEnd: number
): number {
  const total = rangeEnd - rangeStart;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((minutes - rangeStart) / total) * 100));
}

/** 분을 px 위치로 변환 (세로 그리드용) */
export function minutesToPx(
  minutes: number,
  rangeStartMinutes: number,
  pxPerMinute: number
): number {
  return (minutes - rangeStartMinutes) * pxPerMinute;
}

/** 시간 라벨 — 구글 캘린더 한국어 로케일 (AM 1시, PM 2시) */
export function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return 'AM 12시';
  if (hour === 12) return 'PM 12시';
  if (hour < 12) return `AM ${hour}시`;
  return `PM ${hour - 12}시`;
}

/**
 * HH:mm → 구글 캘린더 한국어 AM/PM 포맷
 * "09:00" → "AM 9시", "14:30" → "PM 2:30", "12:00" → "PM 12시"
 */
export function formatTimeKoAmPm(time: string): string {
  const [h, m] = time.substring(0, 5).split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${period} ${hour12}시`;
  return `${period} ${hour12}:${String(m).padStart(2, '0')}`;
}

/** 분 → 한국어 시간 표시 */
export function formatDurationKo(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

/** 플랜 상태에 따른 색상 클래스 */
export function getPlanColor(status: string, actualEndTime?: string | null): string {
  if (status === 'completed' || actualEndTime != null) return 'bg-emerald-500 shadow-emerald-200';
  if (status === 'deferred') return 'bg-amber-500 shadow-amber-200';
  if (status === 'missed') return 'bg-rose-500 shadow-rose-200';
  return 'bg-blue-500 shadow-blue-200';
}

/** 플랜 상태에 따른 배경색 (그리드 블록용, 연한 색상) */
export function getPlanBlockColors(status: string, actualEndTime?: string | null): {
  bg: string;
  border: string;
  text: string;
} {
  if (status === 'completed' || actualEndTime != null) {
    return { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800' };
  }
  if (status === 'deferred') {
    return { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800' };
  }
  if (status === 'missed') {
    return { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-800' };
  }
  return { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' };
}

/** 비학습시간 유형에 따른 색상 */
export function getNonStudyBlockColors(type: string): {
  bg: string;
  border: string;
  text: string;
  stripe: string;
} {
  switch (type) {
    case '학원':
      return { bg: 'bg-orange-50/80', border: 'border-orange-200', text: 'text-orange-700', stripe: 'bg-orange-100' };
    case '아침식사':
    case '점심식사':
    case '저녁식사':
      return { bg: 'bg-sky-50/80', border: 'border-sky-200', text: 'text-sky-700', stripe: 'bg-sky-100' };
    case '수면':
      return { bg: 'bg-purple-50/80', border: 'border-purple-200', text: 'text-purple-700', stripe: 'bg-purple-100' };
    case 'focus_time':
    case '집중 학습':
      return { bg: 'bg-indigo-50/80', border: 'border-indigo-300', text: 'text-indigo-700', stripe: 'bg-indigo-100' };
    default:
      return { bg: 'bg-gray-50/80', border: 'border-gray-200', text: 'text-gray-600', stripe: 'bg-gray-100' };
  }
}

// ============================================
// 겹침 계산 (First-Fit 레벨 할당)
// ============================================

export interface SegmentWithLevel {
  id: string;
  startMinutes: number;
  endMinutes: number;
  level: number;
  totalLevels: number;
  /** Greedy expansion: 확장된 컬럼 수 (기본 1, 빈 인접 컬럼으로 확장 시 증가) */
  expandedSpan: number;
}

/**
 * 시간 세그먼트들에 대해 greedy first-fit 레벨 할당 + Google Calendar Greedy Column Expansion
 * 겹치는 아이템들은 서로 다른 레벨에 배치됨
 *
 * Phase 1: 시작 시간 기준 정렬
 * Phase 2: First-fit 컬럼 할당 + 클러스터 totalLevels 계산
 * Phase 3: Greedy Column Expansion — 인접 빈 컬럼으로 너비 확장
 */
export function assignLevels<T extends { id: string; startMinutes: number; endMinutes: number }>(
  items: T[]
): (T & { level: number; totalLevels: number; expandedSpan: number })[] {
  if (items.length === 0) return [];

  // Phase 1: 시작 시간 오름차순, 같으면 종료 시간 내림차순
  const sorted = [...items].sort((a, b) => {
    const diff = a.startMinutes - b.startMinutes;
    if (diff !== 0) return diff;
    return b.endMinutes - a.endMinutes;
  });

  // Phase 2: First-fit 레벨 할당
  const levels: number[] = []; // levels[i] = i번째 레벨의 마지막 종료 시간

  const result = sorted.map((item) => {
    let assignedLevel = -1;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] <= item.startMinutes) {
        assignedLevel = i;
        levels[i] = item.endMinutes;
        break;
      }
    }

    if (assignedLevel === -1) {
      assignedLevel = levels.length;
      levels.push(item.endMinutes);
    }

    return { ...item, level: assignedLevel, totalLevels: 1, expandedSpan: 1 };
  });

  // 로컬 클러스터 별 totalLevels 계산
  result.forEach((item) => {
    const overlapping = result.filter(
      (other) =>
        other.id !== item.id &&
        !(other.endMinutes <= item.startMinutes || other.startMinutes >= item.endMinutes)
    );
    const maxLevel = Math.max(item.level, ...overlapping.map((o) => o.level));
    item.totalLevels = maxLevel + 1;
  });

  // 겹치는 클러스터 내 모든 아이템의 totalLevels를 동일하게 맞춤
  result.forEach((item) => {
    const overlapping = result.filter(
      (other) =>
        other.id !== item.id &&
        !(other.endMinutes <= item.startMinutes || other.startMinutes >= item.endMinutes)
    );
    const clusterMax = Math.max(item.totalLevels, ...overlapping.map((o) => o.totalLevels));
    item.totalLevels = clusterMax;
    overlapping.forEach((o) => { o.totalLevels = clusterMax; });
  });

  // Phase 3: Greedy Column Expansion (Google Calendar 스타일)
  // 각 이벤트의 인접 오른쪽 컬럼에 겹치는 이벤트가 없으면 확장
  result.forEach((item) => {
    if (item.totalLevels <= 1) {
      item.expandedSpan = 1;
      return;
    }

    let expandTo = item.level + 1;
    while (expandTo < item.totalLevels) {
      // expandTo 컬럼에 이 이벤트와 시간이 겹치는 이벤트가 있는지 확인
      const hasConflict = result.some(
        (other) =>
          other.id !== item.id &&
          other.level === expandTo &&
          !(other.endMinutes <= item.startMinutes || other.startMinutes >= item.endMinutes)
      );
      if (hasConflict) break;
      expandTo++;
    }
    item.expandedSpan = expandTo - item.level;
  });

  return result;
}

// ============================================
// Z-Index 계산 (Google Calendar 규칙)
// ============================================

/**
 * Google Calendar z-index 규칙:
 * - 컬럼 인덱스(level)가 높을수록 z 높음 → 카드 스택에서 뒤 이벤트가 앞에 표시
 * - 호버: z-40 (onMouseEnter에서 처리)
 * - 드래그 중: z-30 (컴포넌트 레벨에서 처리)
 */
export function computeZIndex(level: number): number {
  return 3 + level;
}

// ============================================
// 그리드 배경 스타일 (CSS gradient 기반 시간축 라인)
// ============================================

/** CSS gradient 기반 시간 그리드 배경 스타일 생성 (DailyDockGridView, WeeklyGridColumn 공용) */
export function createGridBackgroundStyle(rangeStartMin: number, ppm: number = PX_PER_MINUTE): CSSProperties {
  const hourPx = 60 * ppm;
  const halfPx = 30 * ppm;
  return {
    backgroundImage: `repeating-linear-gradient(
      to bottom,
      var(--grid-hour-color, #dadce0) 0px, var(--grid-hour-color, #dadce0) 1px,
      transparent 1px, transparent ${halfPx}px,
      var(--grid-half-color, #e8eaed) ${halfPx}px, var(--grid-half-color, #e8eaed) ${halfPx + 1}px,
      transparent ${halfPx + 1}px, transparent ${hourPx}px
    )`,
    backgroundSize: `100% ${hourPx}px`,
    backgroundPositionY: `${-(rangeStartMin % 60) * ppm}px`,
  };
}

// ============================================
// 겹침 레이아웃 위치 계산 (Google Calendar 스타일)
// ============================================

/** 단독 이벤트의 오른쪽 여유 공간 (%) — 빈 영역 클릭/더블클릭 허용, 종일 이벤트에도 공유 */
export const SINGLE_RIGHT_GUTTER_PCT = 8;
/** 겹침 그룹에서 마지막 컬럼의 오른쪽 여유 공간 (%) */
const OVERLAP_RIGHT_GUTTER_PCT = 5;
/** 겹침 이벤트의 추가 너비 (%) — 컬럼 경계를 넘어 확장하여 카드 스택 효과 생성 */
const OVERLAP_EXTRA_PCT_BASE = 30;

/**
 * assignLevels 결과를 바탕으로 실제 렌더링 left/width(%) 계산
 *
 * Google Calendar "Card-Stack" 레이아웃:
 * 1. 단독 이벤트: 92% 폭 (오른쪽 8% 여유)
 * 2. 겹침 이벤트: 각 이벤트가 자기 컬럼 폭보다 넓게 확장 → 뒤 이벤트와 겹침
 * 3. z-index가 높은(뒤) 이벤트가 앞 이벤트 위에 표시 → 스택 효과
 * 4. 마지막 컬럼은 오른쪽 여유 공간을 가짐
 */
export function computeLayoutPosition(
  level: number,
  totalLevels: number,
  expandedSpan: number,
): { left: number; width: number } {
  // 단독 이벤트 (겹침 없음)
  if (totalLevels <= 1) {
    return { left: 0, width: 100 - SINGLE_RIGHT_GUTTER_PCT };
  }

  // Google Calendar card-stack: 각 이벤트가 자기 컬럼 시작부터 오른쪽 끝까지 확장
  // 뒤 이벤트(높은 level)가 앞 이벤트 위에 겹쳐서 표시됨
  const colWidth = 100 / totalLevels;
  const left = level * colWidth;

  // 이벤트 폭: 기본 컬럼 폭 + 추가 확장 (카드 스택 효과)
  // 추가 확장량은 컬럼 수에 반비례 (2열→15%, 3열→10%, 4열→7.5%)
  const extraWidth = Math.min(OVERLAP_EXTRA_PCT_BASE / totalLevels, 20);
  const baseWidth = expandedSpan * colWidth;
  const isLastColumn = level + expandedSpan >= totalLevels;
  const rightGutter = isLastColumn ? OVERLAP_RIGHT_GUTTER_PCT : 0;

  // 폭이 컬럼 오른쪽을 넘지 않도록 cap
  const maxWidth = 100 - left - rightGutter;
  const width = Math.max(Math.min(baseWidth + extraWidth, maxWidth), 15);

  return { left, width };
}

// ============================================
// 그리드 상수
// ============================================

export const HOUR_HEIGHT_PX = 60; // 1시간 = 60px, 1분 = 1px
export const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60; // = 1
export const SNAP_MINUTES = 15;
export const TIME_GUTTER_WIDTH = 56; // px
export const DEFAULT_DISPLAY_RANGE = { start: '00:00', end: '24:00' };
