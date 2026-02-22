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
}

/**
 * 시간 세그먼트들에 대해 greedy first-fit 레벨 할당
 * 겹치는 아이템들은 서로 다른 레벨에 배치됨
 */
export function assignLevels<T extends { id: string; startMinutes: number; endMinutes: number }>(
  items: T[]
): (T & { level: number; totalLevels: number })[] {
  // 시작 시간 오름차순, 같으면 종료 시간 내림차순
  const sorted = [...items].sort((a, b) => {
    const diff = a.startMinutes - b.startMinutes;
    if (diff !== 0) return diff;
    return b.endMinutes - a.endMinutes;
  });

  // First-fit 레벨 할당
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

    return { ...item, level: assignedLevel, totalLevels: 1 };
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

  return result;
}

// ============================================
// 그리드 배경 스타일 (CSS gradient 기반 시간축 라인)
// ============================================

/** CSS gradient 기반 시간 그리드 배경 스타일 생성 (DailyDockGridView, WeeklyGridColumn 공용) */
export function createGridBackgroundStyle(rangeStartMin: number): CSSProperties {
  return {
    backgroundImage: `repeating-linear-gradient(
      to bottom,
      var(--grid-hour-color, #dadce0) 0px, var(--grid-hour-color, #dadce0) 1px,
      transparent 1px, transparent 30px,
      var(--grid-half-color, #e8eaed) 30px, var(--grid-half-color, #e8eaed) 31px,
      transparent 31px, transparent 60px
    )`,
    backgroundSize: `100% ${HOUR_HEIGHT_PX}px`,
    backgroundPositionY: `${-(rangeStartMin % 60) * PX_PER_MINUTE}px`,
  };
}

// ============================================
// 그리드 상수
// ============================================

export const HOUR_HEIGHT_PX = 60; // 1시간 = 60px, 1분 = 1px
export const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60; // = 1
export const SNAP_MINUTES = 15;
export const TIME_GUTTER_WIDTH = 56; // px
export const DEFAULT_DISPLAY_RANGE = { start: '00:00', end: '24:00' };
