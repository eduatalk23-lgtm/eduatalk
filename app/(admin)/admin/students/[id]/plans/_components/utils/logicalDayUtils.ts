/**
 * 논리적 하루(Logical Day) 유틸리티
 *
 * 논리적 하루: 01:00 ~ 25:00 (= 다음날 01:00)
 * 시간 그리드 순서: 새벽 접기(01:00~07:00) → 메인(07:00~24:00) → 연장(24:00~25:00)
 *
 * 논리적 분(logical minutes):
 *   물리적 01:00 → 0, 07:00 → 360, 24:00(자정) → 1380, 다음날 01:00 → 1440
 *
 * 변환 공식:
 *   물리적 01:00~23:59 → logicalMin = physicalMin - 60
 *   물리적 00:00~00:59 (D+1) → logicalMin = 1380 + physicalMin (전날 컬럼에 배정)
 */

import { timeToMinutes, minutesToTime } from './timeGridUtils';

// ============================================
// 상수
// ============================================

/** 논리적 하루 시작 물리적 시각 (분) */
export const LOGICAL_DAY_PHYSICAL_START = 60; // 01:00

/** 새벽 접기 구간 (논리적 분) */
export const DEAD_ZONE_START = 0;
export const DEAD_ZONE_END = 360; // 07:00 - 01:00 = 6시간

/** 접힌 상태 새벽 구간 높이 (px) */
export const DEAD_ZONE_COLLAPSED_PX = 40;

/** 연장 구간 (논리적 분) */
export const EXTENSION_ZONE_START = 1380; // 24:00 - 01:00 = 23시간
export const EXTENSION_ZONE_END = 1440;   // 25:00 - 01:00 = 24시간

/** 논리적 하루 표시 범위 (displayRange 호환) */
export const LOGICAL_DISPLAY_RANGE = { start: '01:00', end: '25:00' };

// ============================================
// 접기 설정
// ============================================

export interface LogicalDayConfig {
  deadZoneCollapsed: boolean;
  pxPerMinute: number;
}

// ============================================
// 물리적 ↔ 논리적 변환
// ============================================

/**
 * 물리적 시각 → 논리적 좌표.
 *
 * 00:00~00:59 → 전날 컬럼의 연장 영역 (logicalMin 1380~1440)
 * 01:00~23:59 → 당일 컬럼 (logicalMin 0~1380)
 */
export function resolveLogicalMinutes(
  physicalDate: string,
  physicalTimeHHMM: string,
): { logicalDate: string; logicalMinutes: number } {
  const physicalMin = timeToMinutes(physicalTimeHHMM);

  if (physicalMin < LOGICAL_DAY_PHYSICAL_START) {
    // 00:00~00:59 → 전날 컬럼의 연장 영역
    return {
      logicalDate: shiftDate(physicalDate, -1),
      logicalMinutes: EXTENSION_ZONE_START + physicalMin,
    };
  }

  return {
    logicalDate: physicalDate,
    logicalMinutes: physicalMin - LOGICAL_DAY_PHYSICAL_START,
  };
}

/**
 * 논리적 좌표 → 물리적 시각.
 * 서버 액션에 전달할 때 사용.
 */
export function resolvePhysicalTime(
  logicalDate: string,
  logicalMinutes: number,
): { physicalDate: string; physicalTimeHHMM: string } {
  if (logicalMinutes >= EXTENSION_ZONE_START) {
    // 연장 영역 → 다음날 00:00~00:59
    const physicalMin = logicalMinutes - EXTENSION_ZONE_START;
    return {
      physicalDate: shiftDate(logicalDate, 1),
      physicalTimeHHMM: minutesToTime(physicalMin),
    };
  }

  return {
    physicalDate: logicalDate,
    physicalTimeHHMM: minutesToTime(logicalMinutes + LOGICAL_DAY_PHYSICAL_START),
  };
}

// ============================================
// 물리적 분 → 논리적 분 (컬럼 내부용, 날짜 변환 불필요)
// ============================================

/**
 * 물리적 시간(HH:mm의 분 변환값) → 논리적 분.
 * 이벤트가 이미 올바른 논리적 날짜 컬럼에 그룹핑되어 있을 때 사용.
 *
 * - physicalMin < 60 (00:00~00:59) → 연장 영역 (1380~1440)
 * - physicalMin >= 60 (01:00~23:59) → 정상 (0~1380)
 */
export function physicalMinToLogical(physicalMin: number): number {
  if (physicalMin < LOGICAL_DAY_PHYSICAL_START) {
    return EXTENSION_ZONE_START + physicalMin;
  }
  return physicalMin - LOGICAL_DAY_PHYSICAL_START;
}

// ============================================
// 픽셀 변환 (접기 반영)
// ============================================

/**
 * 논리적 분 → px 위치 (접기 상태 반영).
 *
 * 접힌 상태:
 *   새벽(0~360) → 0~40px (압축)
 *   메인+연장(360~1440) → 40px + (logicalMin - 360) * ppm
 *
 * 펼친 상태:
 *   전체 0~1440 → logicalMin * ppm
 */
export function logicalMinutesToPx(
  logicalMinutes: number,
  config: LogicalDayConfig,
): number {
  const { deadZoneCollapsed, pxPerMinute } = config;

  if (!deadZoneCollapsed) {
    return logicalMinutes * pxPerMinute;
  }

  // 접힌 상태
  if (logicalMinutes <= DEAD_ZONE_START) return 0;

  if (logicalMinutes < DEAD_ZONE_END) {
    // 새벽 구간: 360분을 40px로 압축
    return (logicalMinutes / DEAD_ZONE_END) * DEAD_ZONE_COLLAPSED_PX;
  }

  // 메인 + 연장 영역
  return DEAD_ZONE_COLLAPSED_PX + (logicalMinutes - DEAD_ZONE_END) * pxPerMinute;
}

/**
 * px → 논리적 분 (역변환).
 * 드래그/클릭 위치 → 논리적 시각.
 */
export function pxToLogicalMinutes(
  px: number,
  config: LogicalDayConfig,
): number {
  const { deadZoneCollapsed, pxPerMinute } = config;

  if (!deadZoneCollapsed) {
    return px / pxPerMinute;
  }

  if (px <= 0) return DEAD_ZONE_START;

  if (px < DEAD_ZONE_COLLAPSED_PX) {
    // 접힌 새벽 구간 내부
    return (px / DEAD_ZONE_COLLAPSED_PX) * DEAD_ZONE_END;
  }

  // 메인 + 연장 영역
  return DEAD_ZONE_END + (px - DEAD_ZONE_COLLAPSED_PX) / pxPerMinute;
}

/**
 * 논리적 하루 전체 그리드 높이 (px).
 */
export function getLogicalDayTotalHeight(config: LogicalDayConfig): number {
  const { deadZoneCollapsed, pxPerMinute } = config;

  if (!deadZoneCollapsed) {
    return EXTENSION_ZONE_END * pxPerMinute;
  }

  // 접힌 새벽(40px) + 메인+연장(1080분 * ppm)
  const mainAndExtensionMinutes = EXTENSION_ZONE_END - DEAD_ZONE_END;
  return DEAD_ZONE_COLLAPSED_PX + mainAndExtensionMinutes * pxPerMinute;
}

// ============================================
// 시간 라벨
// ============================================

/**
 * 논리적 시간(hour) → 시간 라벨.
 * 시간 거터에 사용.
 *
 * 1~11 → "AM 1시"~"AM 11시"
 * 12 → "PM 12시"
 * 13~23 → "PM 1시"~"PM 11시"
 * 24 → "AM 12시" (자정)
 * 25 → "AM 1시" (다음날)
 */
export function formatLogicalHourLabel(logicalHour: number): string {
  // 논리적 시간 → 물리적 시간 (logicalHour + 1 = physicalHour)
  const physicalHour = logicalHour + 1;
  const wrapped = physicalHour % 24;

  // 56px 거터에 맞는 축약 포맷 (AM/PM + 숫자)
  if (wrapped === 0) return 'AM 12';
  if (wrapped === 12) return 'PM 12';
  if (wrapped < 12) return `AM ${wrapped}`;
  return `PM ${wrapped - 12}`;
}

/**
 * 논리적 시간 라벨 배열 생성 (접기 상태 반영).
 *
 * 접힌 상태: 새벽(1~6시) 라벨 생략, 7~25시 표시 (첫 라벨 제외)
 * 펼친 상태: 1~25시 전체 (첫 라벨 제외)
 */
export function getLogicalHourLabels(deadZoneCollapsed: boolean): number[] {
  const labels: number[] = [];

  if (deadZoneCollapsed) {
    // 새벽 생략, 메인+연장 (8~24시 = logicalHour 7~22)
    // logicalHour 6 (= AM 7) 생략 — DeadZoneBar 바로 아래라 겹침
    // logicalHour 23 (= AM 12/자정) 제외 — "다음날" 라벨이 대체
    for (let h = 7; h <= 22; h++) {
      labels.push(h);
    }
    // 연장 영역: logicalHour 24 (= AM 1)
    labels.push(24);
  } else {
    // 전체 (2~24시 = logicalHour 1~22, 첫 라벨 제외)
    // logicalHour 23 (= AM 12/자정) 제외 — "다음날" 라벨이 대체
    for (let h = 1; h <= 22; h++) {
      labels.push(h);
    }
    // 연장 영역: logicalHour 24 (= AM 1)
    labels.push(24);
  }

  return labels;
}

// ============================================
// 새벽 구간 이벤트 판별
// ============================================

/** 논리적 분이 새벽 접기 구간에 완전히 포함되는지 */
export function isFullyInDeadZone(startLogical: number, endLogical: number): boolean {
  return startLogical >= DEAD_ZONE_START && endLogical <= DEAD_ZONE_END;
}

/** 논리적 분이 새벽 접기 구간과 겹치는지 */
export function overlapsDeadZone(startLogical: number, endLogical: number): boolean {
  return startLogical < DEAD_ZONE_END && endLogical > DEAD_ZONE_START;
}

/** 새벽 접기 구간을 걸치는 이벤트의 가시 시작 분 (접힌 상태용) */
export function getVisibleStartAfterDeadZone(startLogical: number): number {
  if (startLogical < DEAD_ZONE_END) return DEAD_ZONE_END;
  return startLogical;
}

// ============================================
// 날짜 유틸
// ============================================

/** YYYY-MM-DD 날짜를 days만큼 이동 */
export function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ============================================
// 그리드 배경 스타일 (접기 반영)
// ============================================

/**
 * 메인+연장 구간용 CSS gradient 배경.
 * 새벽 구간은 DeadZoneBar가 별도 렌더링하므로 이 함수는 메인+연장만 커버.
 */
export function createLogicalGridBackgroundStyle(
  config: LogicalDayConfig,
): React.CSSProperties {
  const { pxPerMinute } = config;
  const hourPx = 60 * pxPerMinute;
  const halfPx = 30 * pxPerMinute;

  return {
    backgroundImage: `repeating-linear-gradient(
      to bottom,
      var(--grid-hour-color, #dadce0) 0px, var(--grid-hour-color, #dadce0) 1px,
      transparent 1px, transparent ${halfPx}px,
      var(--grid-half-color, #e8eaed) ${halfPx}px, var(--grid-half-color, #e8eaed) ${halfPx + 1}px,
      transparent ${halfPx + 1}px, transparent ${hourPx}px
    )`,
    backgroundSize: `100% ${hourPx}px`,
    // 메인 구간은 07:00(= logicalMin 360) 시작, 시간 정각에 맞춤
    backgroundPositionY: '0px',
  };
}
