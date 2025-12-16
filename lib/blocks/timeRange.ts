/**
 * 타임테이블 시간 영역 계산 유틸리티
 */

import { timeToMinutes } from "@/lib/utils/time";

type Block = {
  start_time: string;
  end_time: string;
};

/**
 * 분을 시간으로 변환
 */
function minutesToHour(minutes: number): number {
  return Math.floor(minutes / 60);
}

/**
 * 블록들로부터 자동으로 시간 영역 계산
 * 블록이 있는 최소/최대 시간을 찾아서 여유를 두고 반환
 */
export function calculateAutoTimeRange(blocks: Block[]): {
  startHour: number;
  endHour: number;
  hours: number[];
} {
  if (blocks.length === 0) {
    // 기본값: 6시-24시
    return {
      startHour: 6,
      endHour: 24,
      hours: Array.from({ length: 19 }, (_, i) => i + 6), // 6-24시
    };
  }

  let minHour = 24;
  let maxHour = 0;

  blocks.forEach((block) => {
    const start = timeToMinutes(block.start_time);
    const end = timeToMinutes(block.end_time);
    
    const startHour = minutesToHour(start);
    const endHour = minutesToHour(end);
    
    if (startHour < minHour) minHour = startHour;
    if (endHour > maxHour) maxHour = endHour;
  });

  // 여유를 두기 위해 최소 1시간씩 여유 추가
  const startHour = Math.max(0, minHour - 1);
  const endHour = Math.min(24, maxHour + 1);

  // 시간 배열 생성
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  );

  return {
    startHour,
    endHour,
    hours,
  };
}

/**
 * 수동으로 시간 영역 설정
 */
export function createManualTimeRange(
  startHour: number,
  endHour: number
): {
  startHour: number;
  endHour: number;
  hours: number[];
} {
  const start = Math.max(0, Math.min(23, startHour));
  const end = Math.max(start + 1, Math.min(24, endHour));

  const hours = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return {
    startHour: start,
    endHour: end,
    hours,
  };
}

